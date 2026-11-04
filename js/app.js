(() => {
'use strict';
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const wait = ms => new Promise(r => setTimeout(r, ms));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const root = document.documentElement;
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
scrollTo(0, 0);

/* The real party date, read from her invitation card. */
const BIRTH_MONTH = 9, BIRTH_DAY = 24;

/* ---------- music ---------- */
const song = $('#song'), songSrc = song.getAttribute('src');
let songHeld = false;   // the candle moment: the microphone needs the room quiet
let volRaf = 0, songAt = 0, songReloads = 0, songFails = 0, watchAt = -1, watchStuck = 0;
const startSong = () => { const p = song.play(); if (p) p.catch(() => {}); };
/* There is no off switch, so anything that stops the song (a call, a blocked
   start) must not leave it silent: the next touch brings it back. */
const keepPlaying = () => { if (opened && !songHeld && !document.hidden && song.paused) startSong(); };
['touchend', 'click', 'keydown'].forEach(t => document.addEventListener(t, keepPlaying, { capture: true, passive: true }));
document.addEventListener('visibilitychange', () => { if (document.hidden) song.pause(); else keepPlaying(); });
/* A tap may never come, since scrolling doesn't count as one, so the page also looks after
   the song by itself: restart it if it stopped, and fetch it again if the file failed or
   playback froze (a lost connection, the file replaced on the server), resuming in place. */
song.addEventListener('timeupdate', () => { if (song.currentTime > 0) { songAt = song.currentTime; songFails = 0; } });
function reloadSong() {
  const at = songAt;
  song.addEventListener('loadedmetadata', () => { try { song.currentTime = Math.min(at, song.duration - 1); } catch (e) {} }, { once: true });
  song.src = `${songSrc}&r=${++songReloads}`;
  startSong();
}
song.addEventListener('error', () => { if (opened) setTimeout(reloadSong, Math.min(10000, 1000 * ++songFails)); });
setInterval(() => {
  if (!opened || songHeld || document.hidden || song.error) return;
  if (song.paused) { startSong(); return; }
  if (song.currentTime !== watchAt) { watchAt = song.currentTime; watchStuck = 0; return; }
  if (++watchStuck >= 4) { watchStuck = 0; reloadSong(); }
}, 2000);
function rampVolume(to) { // iOS ignores volume; there it simply stays as it is
  cancelAnimationFrame(volRaf);
  const step = () => {
    const d = to - song.volume;
    if (Math.abs(d) < .01) { song.volume = to; return; }
    song.volume = clamp(song.volume + Math.sign(d) * .008);
    volRaf = requestAnimationFrame(step);
  };
  step();
}

/* ---------- gate ---------- */
const gate = $('#gate'), genv = $('#genv'), seal = $('#seal'), iris = $('#iris'), hero = $('#top');
let opened = false;
$('img', iris).decode().catch(() => {});   // ready before it is needed, so nothing pops in later

function breakSeal() {
  seal.classList.add('broken');
  const half = (clip, x, rot) => {
    const h = document.createElement('span');
    h.className = 'seal__half';
    h.innerHTML = `<svg viewBox="0 0 100 100" style="clip-path:${clip}"><use href="#seal-art"/></svg>`;
    seal.appendChild(h);
    h.animate([
      { transform: 'none', opacity: 1, offset: 0 },
      { transform: `translate(${x * .2}%,-5%) rotate(${rot * .22}deg)`, opacity: 1, offset: .18 },
      { transform: `translate(${x}%,210%) rotate(${rot}deg)`, opacity: 0, offset: 1 }
    ], { duration: 1000, easing: 'cubic-bezier(.45,.1,.75,.65)', fill: 'forwards' });
  };
  half('polygon(0 0,55% 0,46% 22%,57% 40%,44% 58%,54% 78%,47% 100%,0 100%)', -36, -38);
  half('polygon(55% 0,100% 0,100% 100%,47% 100%,54% 78%,44% 58%,57% 40%,46% 22%)', 36, 32);
  for (let i = 0; i < 18; i++) {
    const s = document.createElement('i'), a = Math.random() * 6.283, d = 46 + Math.random() * 130;
    s.className = 'spark';
    genv.appendChild(s);
    s.animate([
      { transform: 'none', opacity: 1 },
      { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d + 34}px) scale(.15)`, opacity: 0 }
    ], { duration: 650 + Math.random() * 650, easing: 'cubic-bezier(.12,.72,.3,1)', fill: 'forwards' }).finished.then(() => s.remove());
  }
}
async function openGate() {
  if (opened) return; opened = true;
  startSong();                      // must stay inside the tap for mobile browsers
  if (navigator.vibrate) navigator.vibrate(12);
  gate.classList.add('opening');
  if (reduce) return reveal();

  seal.classList.add('pressed');
  await wait(170);
  if (navigator.vibrate) navigator.vibrate(18);
  breakSeal();
  await wait(260);
  genv.classList.add('open');
  await wait(1020);

  // The letter comes up out of the pocket...
  const letterEl = $('#gletter'), h = genv.offsetHeight, up = h * .6;
  await letterEl.animate([{ transform: 'none' }, { transform: `translateY(${-up}px)` }],
    { duration: 1050, easing: 'cubic-bezier(.32,.04,.2,1)', fill: 'forwards' }).finished;

  // ...then the envelope falls away while the letter settles, straight, in the middle.
  const box = genv.getBoundingClientRect(), sink = h * 1.05;
  const middle = innerHeight / 2 - (box.top + box.height / 2);
  const settle = { duration: 1000, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' };
  genv.classList.add('out');
  genv.animate([{ transform: 'rotate(-1.4deg)' }, { transform: `translateY(${sink}px)` }], settle);
  letterEl.animate([{ transform: `translateY(${-up}px)` }, { transform: `translateY(${middle - sink}px) scale(1.14)` }], settle);
  await wait(1030);
  await reveal();
}
/* Where a cover-fitted image really sits inside a w x h box. */
function coverOf(el, w, h) {
  const [px, py] = getComputedStyle(el).objectPosition.split(' ').map(parseFloat);
  const k = Math.max(w / el.naturalWidth, h / el.naturalHeight);
  return { w: el.naturalWidth * k, h: el.naturalHeight * k, x: (w - el.naturalWidth * k) * px / 100, y: (h - el.naturalHeight * k) * py / 100 };
}
async function reveal() {
  const img = $('img', iris), small = $('#gletter img');
  // On a slow connection the letter simply stays in the middle until the photo is ready.
  try { await Promise.race([img.decode(), wait(8000)]); } catch (e) {}

  // Start the full-screen photo exactly on top of the letter's photo, same crop and
  // same size, so what follows reads as that one photo growing rather than a new one.
  iris.style.visibility = 'hidden';
  iris.hidden = false;
  const r = small.getBoundingClientRect(), W = iris.clientWidth, H = iris.clientHeight;
  const from = `inset(${Math.max(0, r.top)}px ${Math.max(0, W - r.right)}px ${Math.max(0, H - r.bottom)}px ${Math.max(0, r.left)}px round 1px)`;
  const big = coverOf(img, W, H), lil = coverOf(small, r.width, r.height);
  const dur = reduce ? 1 : 1750;
  const opts = { duration: dur, easing: 'cubic-bezier(.62,0,.14,1)', fill: 'forwards' };
  // The whole picture, not just the part a full-screen crop would keep: scaled down, the
  // sides that are off-screen at full size are needed to fill the letter's wider shape.
  Object.assign(img.style, { position: 'absolute', left: 0, top: 0, width: big.w + 'px', height: big.h + 'px', maxWidth: 'none', objectFit: 'fill', transformOrigin: '0 0' });
  const a = iris.animate([{ clipPath: from }, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }], opts);
  img.animate([
    { transform: `translate(${r.left + lil.x}px,${r.top + lil.y}px) scale(${lil.w / big.w})` },
    { transform: `translate(${big.x}px,${big.y}px) scale(1)` }
  ], opts);
  iris.style.visibility = '';
  setTimeout(() => petals(70), dur * .42);
  setTimeout(() => hero.classList.add('on'), dur * .8);
  try { await a.finished; } catch (e) {}
  root.classList.remove('locked');
  root.classList.add('unlocked');
  gate.remove();
  scrollTo(0, 0);
  onScroll();
  setTimeout(() => { heroTipReady = true; onScroll(); }, 1300);
  iris.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, fill: 'forwards' }).finished.then(() => iris.remove());
}
genv.addEventListener('click', openGate);   // the seal is the hint, the whole envelope responds
$('#replay').addEventListener('click', () => location.reload());

/* ---------- the little cat that explains things ---------- */
const CAT = `<svg class="cat__svg" width="84" height="77" viewBox="0 0 120 110" aria-hidden="true">
  <path class="cat__tail" d="M38 98C20 102 9 92 10 78c.4-6 4-10 9-10" fill="none" stroke="#f1dfca" stroke-width="10" stroke-linecap="round"/>
  <path d="M34 110c-2-24 8-40 26-40s28 16 26 40z" fill="#fbf0e2"/>
  <ellipse cx="47" cy="105" rx="9.5" ry="6" fill="#fffaf2"/><ellipse cx="72" cy="105" rx="9.5" ry="6" fill="#fffaf2"/>
  <g class="cat__paw"><path d="M84 88c3-11 8-20 14-25 3-3 9-1 9 4 0 8-6 18-13 26z" fill="#fbf0e2"/><ellipse cx="102" cy="63" rx="7.6" ry="7" fill="#fffaf2"/><ellipse cx="102" cy="64" rx="3.2" ry="2.8" fill="#f2b8b5"/></g>
  <path d="M27 36 28 6l27 17z" fill="#f6e7d5"/><path d="M33 28l.6-14 12.4 8.2z" fill="#f2b8b5"/>
  <g class="cat__ear"><path d="M93 36 92 6 65 23z" fill="#f6e7d5"/><path d="M87 28l-.6-14-12.4 8.2z" fill="#f2b8b5"/></g>
  <ellipse cx="60" cy="47" rx="37" ry="31" fill="#fff8ee"/>
  <path d="M60 17c-4 5-4 10-3 14M60 17c4 5 4 10 3 14" stroke="#ecd4ba" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <g class="cat__eyes"><ellipse cx="45" cy="46" rx="6.6" ry="8" fill="#2a1410"/><ellipse cx="75" cy="46" rx="6.6" ry="8" fill="#2a1410"/><circle cx="47.4" cy="42.6" r="2.5" fill="#fff"/><circle cx="77.4" cy="42.6" r="2.5" fill="#fff"/><circle cx="43.4" cy="49.6" r="1.2" fill="#fff"/><circle cx="73.4" cy="49.6" r="1.2" fill="#fff"/></g>
  <ellipse cx="34" cy="58" rx="6.5" ry="3.8" fill="#f4b0ab" opacity=".8"/><ellipse cx="86" cy="58" rx="6.5" ry="3.8" fill="#f4b0ab" opacity=".8"/>
  <path d="M56.8 54.5h6.4L60 58z" fill="#d9666e"/>
  <path d="M60 58c0 3.2-2.8 4.8-5.3 3.5M60 58c0 3.2 2.8 4.8 5.3 3.5" stroke="#6b3a35" stroke-width="1.7" fill="none" stroke-linecap="round"/>
  <path d="M27 52 13 49M27 58l-15 1M93 52l14-3M93 58l15 1" stroke="#cdb9a4" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M60 80 44 71v18zM60 80l16-9v18z" fill="#8d0f1f"/><path d="M60 80 47 75M60 80l13-5" stroke="#c9303f" stroke-width="1.4" opacity=".7"/><circle cx="60" cy="80" r="4" fill="#b3141f"/>
</svg>`;
function makeTip(host, html, cls, tag) {
  const el = document.createElement(tag || 'div');
  el.className = 'cat-tip ' + (cls || '');
  el.innerHTML = `<span class="cat-bubble">${html}</span>${CAT}`;
  host.appendChild(el);
  return el;
}
function showTip(el, delay, life) {
  clearTimeout(el._a); clearTimeout(el._b);
  el._a = setTimeout(() => {
    setTip(el, true);
    if (life) el._b = setTimeout(() => setTip(el, false), life);
  }, delay || 0);
}
function hideTip(el) { clearTimeout(el._a); clearTimeout(el._b); setTip(el, false); }
function setTip(el, on) { el.classList.toggle('show', on); if (el._cb) el._cb(on); }
const DOWN = '<svg class="down" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v15M5 12l7 7 7-7"/></svg>';
const heroTip = makeTip(hero, 'Pastga suring' + DOWN, 'cat-tip--hero', 'button');
heroTip.type = 'button';
heroTip.setAttribute('aria-label', 'Pastga suring');
heroTip.addEventListener('click', () => $('#words').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }));
let heroTipReady = false;
const MORE = 'Bu tugmani bossangiz, qolgan rasmlaringiz chiqadi';
const letterTip = makeTip($('.letter__nav'), MORE);
letterTip._cb = on => $('#letter').classList.toggle('tip-on', on);
const magTip = makeTip($('.mag-nav'), MORE);
const deckTip = makeTip($('#deck'), 'Konvertni bosing, ichida rasm bor', 'cat-tip--deck');
let letterNextUsed = false, magNextUsed = false, deckUsed = false;
new IntersectionObserver(([e]) => {
  if (e.isIntersecting && !deckUsed) showTip(deckTip, 500, 9000);
}, { threshold: .25 }).observe($('#deck'));
new IntersectionObserver(([e]) => {
  if (e.isIntersecting && !magNextUsed) showTip(magTip, 600, 11000);
}, { threshold: .9 }).observe($('.mag-nav'));

/* ---------- reveal on scroll ---------- */
/* Every photo must arrive, whatever the network does: fetch them all up front in page
   order, show a soft shimmer rather than an empty box, retry for as long as it takes, and
   never play a photo's reveal before the photo is actually there. */
const imgDone = img => img.complete && img.naturalWidth > 0;
const waitBox = img => img.closest('.rv-img') || img;
$$('img').forEach(i => { if (i.id !== 'tImg' && !imgDone(i)) waitBox(i).classList.add('wait'); });
document.addEventListener('load', e => {
  if (e.target.tagName === 'IMG') waitBox(e.target).classList.remove('wait');
}, true);
const imgTries = new WeakMap();
document.addEventListener('error', e => {
  const img = e.target;
  if (img.tagName !== 'IMG' || img.id === 'tImg') return;
  const n = (imgTries.get(img) || 0) + 1, src = img.getAttribute('src'), set = img.getAttribute('srcset');
  if (!src) return;
  imgTries.set(img, n);
  waitBox(img).classList.add('wait');
  img.removeAttribute('srcset'); img.removeAttribute('src');     // no broken-image icon meanwhile
  setTimeout(() => {
    if (img.hasAttribute('src')) return;                         // something newer was put there
    const fresh = u => u.replace(/([^\s,?]+\.webp)(\?r=\d+)?/g, `$1?r=${n}`);
    if (set) img.setAttribute('srcset', fresh(set));
    img.setAttribute('src', fresh(src));
  }, Math.min(15000, 1000 * 2 ** (n - 1)));
}, true);
const photoQueue = $$('img[loading="lazy"]');
let photosActive = 0;
(function nextPhotos() {
  while (photosActive < 3 && photoQueue.length) {
    const img = photoQueue.shift();
    if (imgDone(img)) continue;
    photosActive++;
    let over = false;
    const next = () => { if (over) return; over = true; photosActive--; nextPhotos(); };
    img.addEventListener('load', next, { once: true });
    img.addEventListener('error', next, { once: true });
    setTimeout(next, 8000);                                      // a stuck one must not hold up the rest
    img.loading = 'eager';
  }
})();
const photoReady = img => (imgDone(img) ? Promise.resolve() : new Promise(r => img.addEventListener('load', r, { once: true })))
  .then(() => (img.decode ? img.decode().catch(() => {}) : 0));
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  const t = e.target;
  io.unobserve(t);
  if (!t.classList.contains('rv-img')) { t.classList.add('in'); return; }
  const img = $('img', t);
  img.loading = 'eager';
  photoReady(img).then(() => {
    t.classList.add('in');
    // Once revealed, drop the clip and its layer: some phones stop repainting them.
    setTimeout(() => t.classList.add('shown'), 2000);
  });
}), { rootMargin: '0px 0px -10% 0px', threshold: .06 });
$$('.rv,.rv-img').forEach(el => io.observe(el));

/* ---------- the note after the hero simply writes itself, once ---------- */
const wordsEl = $('[data-words]'), wordsSmall = $('.words__small');
const HL = /^(yorug‘lik,|kayfiyat|sukunat|sovg‘a\.)$/;
wordsEl.innerHTML = wordsEl.textContent.trim().split(/\s+/)
  .map((w, i) => `<span${HL.test(w) ? ' data-hl' : ''} style="transition-delay:${i * 55}ms">${w}</span>`).join(' ');
new IntersectionObserver(([e], o) => {
  if (!e.isIntersecting) return;
  o.disconnect();
  wordsEl.classList.add('on');
  wordsSmall.classList.add('on');
}, { threshold: .15 }).observe(wordsEl);

/* ---------- scroll driver ---------- */
const parallax = $$('[data-speed]').map(el => ({ el, s: parseFloat(el.dataset.speed), on: false }));
const pio = new IntersectionObserver(es => es.forEach(e => {
  const p = parallax.find(x => x.el === e.target); if (p) p.on = e.isIntersecting;
}), { rootMargin: '20% 0px' });
parallax.forEach(p => pio.observe(p.el));
const nightSec = $('#oqshom'), nightPin = $('.night__pin');
const chain = $('#chain');
let ticking = false;
function onScroll() {
  ticking = false;
  const vh = innerHeight, y = scrollY;

  // hero
  if (y < vh * 1.2) hero.style.setProperty('--hp', clamp(y / vh).toFixed(3));
  if (heroTipReady) heroTip.classList.toggle('show', y < vh * .08);

  // night: window opens, then the words arrive
  const nr = nightSec.getBoundingClientRect();
  if (nr.top < vh && nr.bottom > 0) {
    const p = clamp(-nr.top / (nr.height - vh));
    const enter = clamp((vh - nr.top) / (vh * 1.05));
    nightPin.style.setProperty('--ne', (enter * enter * (3 - 2 * enter)).toFixed(3));
    nightPin.style.setProperty('--nt', clamp((p - .12) / .3).toFixed(3));
  }

  // parallax
  if (!reduce && innerWidth >= 700) parallax.forEach(p => {
    if (!p.on) return;
    const r = p.el.getBoundingClientRect();
    const natural = r.top - (p.t || 0);          // position without our own offset
    p.t = (natural + r.height / 2 - vh / 2) * p.s;
    p.el.style.transform = `translate3d(0,${p.t.toFixed(1)}px,0)`;
  });

  // necklace progress
  const max = document.documentElement.scrollHeight - vh;
  chain.style.setProperty('--sp', max > 0 ? clamp(y / max).toFixed(4) : 0);
}
const requestTick = () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } };
addEventListener('scroll', requestTick, { passive: true });
addEventListener('resize', requestTick);
onScroll();

/* ---------- chain nav + per-section details ---------- */
const links = $$('a', chain);
links.forEach(a => a.addEventListener('click', e => {
  e.preventDefault();
  $(a.getAttribute('href')).scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
}));
const secIO = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  chain.dataset.theme = e.target.dataset.theme || 'dark';
  const a = links.find(l => l.getAttribute('href') === '#' + e.target.id);
  if (a || !e.target.id) links.forEach(l => l.classList.toggle('on', l === a));
}), { rootMargin: '-50% 0px -50% 0px' });
$$('section[data-theme]').forEach(s => secIO.observe(s));
// the music gets quieter while she sleeps
new IntersectionObserver(([e]) => { rampVolume(e.isIntersecting ? .5 : 1); }, { threshold: .2 }).observe($('.sleep__in'));

/* ---------- the late counter ---------- */
(function late() {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const DAY = 864e5;
  let last = new Date(now.getFullYear(), BIRTH_MONTH, BIRTH_DAY);
  if (last > now) last = new Date(now.getFullYear() - 1, BIRTH_MONTH, BIRTH_DAY);
  const next = new Date(last.getFullYear() + 1, BIRTH_MONTH, BIRTH_DAY);
  const days = Math.round((now - last) / DAY);
  $('#nextN').textContent = Math.round((next - now) / DAY);
  const n = $('#lateN');
  if (days === 0) { // opened on the day itself: nothing is late
    $('.late__a').textContent = 'Bu safar kechikmadik:';
    n.textContent = '24'; $('#lateU').textContent = 'oktabr';
    $('#lateB').textContent = 'Tabrik aynan o‘z kunida.';
    return;
  }
  if (reduce) { n.textContent = days; return; }
  const cio = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return; cio.disconnect();
    const t0 = performance.now(), T = 1500;
    (function tick(t) {
      const k = clamp((t - t0) / T);
      n.textContent = Math.round(days * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    })(t0);
  }, { threshold: .4 });
  cio.observe(n);
})();

/* ---------- candles + petals ---------- */
const candles = $('#candles');
for (let i = 0; i < 18; i++) {
  const c = document.createElement('i');
  const x = (i - 8.5) / 8.5;
  c.className = 'candle';
  c.style.setProperty('--y', Math.round(x * x * 22));
  c.style.setProperty('--r', Math.random().toFixed(2));
  c.style.setProperty('--x', x.toFixed(2));
  c.innerHTML = '<b class="flame"></b>';
  candles.appendChild(c);
}
const blow = $('#blow'), wish = $('#wish');
let lit = true;
async function relight(gap = 0) {
  lit = true; candles.classList.remove('out'); wish.classList.remove('done', 'wow');
  tapOut.hidden = false; blowTip.hidden = false;
  blow.textContent = 'Shamlarni puflash'; blow.classList.remove('btn--ghost');
  // From the middle outwards.
  const list = $$('.candle', candles).map((c, i) => [Math.abs(i - 8.5), c]).sort((a, b) => a[0] - b[0]);
  for (const [, c] of list) { c.classList.remove('out'); if (gap) await wait(gap); }
}
/* The reward for really blowing: a burst of gold from the candles, a warm flash and a ring. */
function blowBurst() {
  const cv = document.createElement('canvas');
  cv.className = 'burst'; cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const g = cv.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, 2);
  const W = innerWidth, H = innerHeight, r = candles.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height * .2;
  cv.width = W * dpr; cv.height = H * dpr;
  const TONES = ['#fff6d6', '#ffe9b4', '#f7cf7f', '#e9a94f', '#ff9d5c'];
  const sparks = Array.from({ length: 240 }, (_, i) => {
    const a = Math.random() * 6.283, v = 90 + Math.pow(Math.random(), .6) * 620;
    return {
      x: cx + (Math.random() - .5) * r.width * .8, y: cy + (Math.random() - .5) * 30,
      vx: Math.cos(a) * v, vy: Math.sin(a) * v - 130,
      r: .8 + Math.random() * 2.6, life: 1.1 + Math.random() * 1.5, c: TONES[i % TONES.length], star: i % 6 === 0
    };
  });
  const t0 = performance.now();
  let last = t0;
  (function frame(now) {
    const t = (now - t0) / 1000, dt = Math.min(.05, (now - last) / 1000);
    last = now;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    const flash = clamp(1 - t / .55);
    if (flash > 0) {
      const f = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * .8);
      f.addColorStop(0, `rgba(255,205,130,${.55 * flash})`);
      f.addColorStop(1, 'rgba(255,150,70,0)');
      g.fillStyle = f; g.fillRect(0, 0, W, H);
    }
    for (const [delay, reach, width] of [[0, .95, 3], [.14, .7, 1.5]]) {
      const k = clamp((t - delay) / .95);
      if (k > 0 && k < 1) {
        g.strokeStyle = `rgba(255,226,170,${(1 - k) * .75})`;
        g.lineWidth = width;
        g.beginPath(); g.arc(cx, cy, (1 - Math.pow(1 - k, 3)) * Math.max(W, H) * reach, 0, 6.283); g.stroke();
      }
    }
    let alive = false;
    for (const p of sparks) {
      const k = t / p.life;
      if (k >= 1) continue;
      alive = true;
      p.vx *= 1 - 1.5 * dt; p.vy = p.vy * (1 - 1.5 * dt) + 210 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      g.globalAlpha = (1 - k) * (.55 + .45 * Math.sin(t * 18 + p.r * 9));
      g.fillStyle = p.c;
      g.beginPath();
      if (p.star) {
        const q = p.r * 3.2, w = q * .17;
        g.moveTo(p.x, p.y - q); g.lineTo(p.x + w, p.y - w); g.lineTo(p.x + q, p.y); g.lineTo(p.x + w, p.y + w);
        g.lineTo(p.x, p.y + q); g.lineTo(p.x - w, p.y + w); g.lineTo(p.x - q, p.y); g.lineTo(p.x - w, p.y - w);
        g.closePath();
      } else g.arc(p.x, p.y, p.r, 0, 6.283);
      g.fill();
    }
    g.globalAlpha = 1;
    if (alive || t < 1.2) requestAnimationFrame(frame); else cv.remove();
  })(t0);
}
async function candlesOut(blown = false) {
  lit = false; blow.disabled = true;
  tapOut.hidden = true; blowTip.hidden = true;
  if (navigator.vibrate) navigator.vibrate(blown ? [30, 40, 60] : 20);
  wish.classList.remove('sent');
  candles.classList.add('out');
  if (blown && !reduce) {
    blowBurst();
    wish.classList.add('wow');
    candles.animate([{ transform: 'none' }, { transform: 'translateY(-7px) scale(1.04)', offset: .3 }, { transform: 'none' }], { duration: 620, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  for (const c of $$('.candle:not(.out)', candles)) { c.classList.add('out'); await wait(reduce ? 0 : 48); }
  await wait(reduce ? 0 : 320);
  songHeld = false; startSong();     // the music comes back with the petals
  petals(blown ? 280 : 170);
  wish.classList.add('done');
  blow.textContent = 'Yana yoqish'; blow.disabled = false; blow.classList.add('btn--ghost');
  await wait(reduce ? 0 : blown ? 2800 : 1500);
  if (!lit) tilak.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
}

/* Really blowing them out. The music waits while the microphone listens, and the candles
   go one by one as she blows, so it feels physical and a short breath is enough. Only the
   loudness is read; nothing is recorded or sent. It gets easier every few seconds, and
   there is always a way past it: this must never stand between her and the rest. */
const breath = $('#breath'), breathSay = $('#breathSay'), breathSkip = $('#breathSkip');
const tapOut = $('#tapOut'), blowTip = $('#blowTip');
let listening = false;
function listenForBreath() {
  const md = navigator.mediaDevices, AC = window.AudioContext || window.webkitAudioContext;
  if (!md || !md.getUserMedia || !AC) return Promise.resolve('nomic');
  return new Promise(resolve => {
    listening = true;
    songHeld = true; song.pause();
    blow.disabled = true; blow.classList.add('listening'); blow.textContent = 'Kutilmoqda…';
    tapOut.hidden = true; blowTip.hidden = true;
    breathSay.textContent = 'Puflaganingizni sezish uchun mikrofonga ruxsat bering. Hech narsa yozib olinmaydi.';
    breath.hidden = false; breathSkip.hidden = true;

    const ac = new AC();             // created and resumed inside the tap, or phones keep it asleep
    if (ac.resume) ac.resume().catch(() => {});
    let over = false, stream = null, raf = 0;
    const timers = [setTimeout(() => { breathSkip.hidden = false; }, 4500), setTimeout(() => finish('left'), 45000)];
    const seen = new IntersectionObserver(([e]) => { if (!e.isIntersecting) finish('left'); }, { rootMargin: '140px 0px' });
    const hide = () => { if (document.hidden) finish('left'); };
    const skip = () => finish('skip');
    function finish(how) {
      if (over) return;
      over = true;
      timers.forEach(clearTimeout);
      cancelAnimationFrame(raf);
      seen.disconnect();
      document.removeEventListener('visibilitychange', hide);
      breathSkip.removeEventListener('click', skip);
      // Let go of the microphone at once: phones keep audio degraded while it is open.
      if (stream) stream.getTracks().forEach(t => t.stop());
      ac.close().catch(() => {});
      candles.style.removeProperty('--lean');
      breath.hidden = true;
      blow.classList.remove('listening'); blow.disabled = false;
      listening = false;
      if (how === 'left') { relight(); songHeld = false; startSong(); }
      resolve(how);
    }
    seen.observe(candles);
    document.addEventListener('visibilitychange', hide);
    breathSkip.addEventListener('click', skip);

    md.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }).then(got => {
      if (over) { got.getTracks().forEach(t => t.stop()); return; }
      stream = got;
      blow.textContent = 'Puflang…';
      breathSay.innerHTML = '<span class="sv-phone">Telefonga</span><span class="sv-desk">Mikrofonga</span> yaqinlashib, shamlarni rostan puflang';
      const an = ac.createAnalyser();
      an.fftSize = 1024; an.smoothingTimeConstant = 0;
      ac.createMediaStreamSource(stream).connect(an);
      const silent = ac.createGain();
      silent.gain.value = 0;
      an.connect(silent); silent.connect(ac.destination);   // Safari only runs nodes that reach an output
      const data = new Uint8Array(an.fftSize);
      const list = $$('.candle', candles).map((c, i) => [Math.abs(i - 8.5), c]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
      const t0 = performance.now();
      let last = t0, quiet = 0, heard = 0, out = 0, warm = 0;
      (function tick(now) {
        const dt = Math.min(50, now - last); last = now;
        an.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        const rms = Math.sqrt(sum / data.length), age = now - t0;
        if (age < 300) { warm++; quiet += (Math.min(rms, .02) - quiet) / warm; raf = requestAnimationFrame(tick); return; }
        const need = Math.max(Math.max(.015, .05 * Math.pow(.8, Math.floor(age / 2500))), quiet * 2.5);
        if (rms < need * .6) quiet += (rms - quiet) * .02;
        const strength = clamp(rms / need / 3);
        candles.style.setProperty('--lean', rms >= need ? (10 + strength * 22).toFixed(1) : '0');
        if (rms >= need) {
          heard += dt;
          const should = Math.floor((heard - 70) / 36);      // about 0.7 s of breath for all 18
          while (out < should && out < list.length) list[out++].classList.add('out');
          if (out === 1) breathSay.textContent = 'Yana bir oz puflang!';
          if (out >= list.length) { finish('blown'); return; }
        }
        raf = requestAnimationFrame(tick);
      })(t0);
    }).catch(() => finish('denied'));
  });
}
blow.addEventListener('click', async () => {
  if (listening) return;
  if (!lit) { relight(); return; }
  const how = reduce ? 'tap' : await listenForBreath();
  if (how !== 'left') candlesOut(how === 'blown');
});
tapOut.addEventListener('click', () => { if (!listening && lit) candlesOut(); });

/* ---------- the wish letter ---------- */
const WISH_URL = 'https://soliha-tilak.vercel.app/api/tilak';   // relay/api/tilak.js holds the bot's token, not this page
// ?sinov rehearses everything but the sending; ?sinov=xato rehearses a failed send.
const wishTrial = new URLSearchParams(location.search).get('sinov');
const tilak = $('#tilak'), tForm = $('#tForm'), tSheet = $('#tSheet'), tText = $('#tText'), tFile = $('#tFile');
const tAdd = $('#tAdd'), tPhoto = $('#tPhoto'), tImg = $('#tImg'), tErr = $('#tErr'), tSend = $('#tSend');
let tBlob = null, sending = false, goldOn = false, wishSent = false;

$('#tDate').textContent = new Date().toLocaleDateString('en-GB').replace(/\//g, '.');

/* Re-encoding shrinks the photo and also drops its EXIF, location included. */
async function shrinkPhoto(file, max = 1600) {
  const url = URL.createObjectURL(file);
  try {
    const im = new Image();
    im.src = url;
    await im.decode();
    const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    return await new Promise((ok, no) => c.toBlob(b => (b ? ok(b) : no(new Error('encode'))), 'image/jpeg', .86));
  } finally { URL.revokeObjectURL(url); }
}
function setPhoto(blob) {
  if (tImg.src) URL.revokeObjectURL(tImg.src);
  tBlob = blob;
  if (blob) tImg.src = URL.createObjectURL(blob); else tImg.removeAttribute('src');
  tPhoto.hidden = !blob; tAdd.hidden = !!blob;
}
tFile.addEventListener('change', async () => {
  const f = tFile.files[0];
  tFile.value = '';
  if (!f) return;
  tErr.textContent = '';
  try {
    setPhoto(await shrinkPhoto(f));
    await tImg.decode();
    tPhoto.style.setProperty('--ar', (tImg.naturalWidth / tImg.naturalHeight).toFixed(3));
  }
  catch (e) { setPhoto(null); tErr.textContent = 'Bu rasmni ochib bo‘lmadi. Boshqasini tanlab ko‘ring.'; }
});
$('#tRemove').addEventListener('click', () => setPhoto(null));

async function deliver(text, photo) {
  if (wishTrial !== null) {
    await wait(500);
    if (wishTrial === 'xato') throw new Error('trial failure');
    return;
  }
  const body = new FormData();
  body.set('text', text);
  if (photo) body.set('photo', photo, 'tilak.jpg');
  const stop = new AbortController(), timer = setTimeout(() => stop.abort(), 30000);
  try {
    const r = await fetch(WISH_URL, { method: 'POST', body, signal: stop.signal });
    if (!r.ok) throw new Error('relay ' + r.status);
  } finally { clearTimeout(timer); }
}

/* The sheet as a picture, measured from the page so the hand-over to the canvas doesn't show. */
function paintSheet() {
  const box = tSheet.getBoundingClientRect(), W = box.width, H = box.height, k = Math.min(devicePixelRatio || 1, 2);
  const c = document.createElement('canvas');
  c.width = Math.round(W * k); c.height = Math.round(H * k);
  const g = c.getContext('2d');
  g.scale(k, k);
  g.fillStyle = '#f8efe1'; g.fillRect(0, 0, W, H);
  const at = el => { const b = el.getBoundingClientRect(); return { x: b.left - box.left, y: b.top - box.top, w: b.width, h: b.height }; };
  const fontOf = el => { const s = getComputedStyle(el); return `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`; };
  const baseline = (top, height) => {
    const m = g.measureText('Hg');
    const asc = m.fontBoundingBoxAscent || parseFloat(g.font) * .8, desc = m.fontBoundingBoxDescent || parseFloat(g.font) * .2;
    return top + (height + asc - desc) / 2;
  };

  const title = $('#tTitle'), date = $('#tDate'), tr = at(title), dr = at(date);
  g.textBaseline = 'alphabetic';
  g.font = fontOf(title); g.fillStyle = getComputedStyle(title).color;
  g.fillText(title.textContent, tr.x, baseline(tr.y, tr.h));
  g.font = fontOf(date); g.fillStyle = getComputedStyle(date).color;
  if ('letterSpacing' in g) g.letterSpacing = getComputedStyle(date).letterSpacing;
  g.fillText(date.textContent, dr.x, baseline(dr.y, dr.h));
  if ('letterSpacing' in g) g.letterSpacing = '0px';

  if (tBlob) {
    const pr = at(tPhoto), w = tPhoto.offsetWidth, h = tPhoto.offsetHeight, pad = parseFloat(getComputedStyle(tPhoto).paddingLeft);
    g.save();
    g.translate(pr.x + pr.w / 2, pr.y + pr.h / 2);
    g.rotate(-1.6 * Math.PI / 180);
    g.save();
    g.shadowColor = 'rgba(60,20,20,.3)'; g.shadowBlur = 10 * k; g.shadowOffsetY = 3 * k;
    g.fillStyle = '#fffdf8'; g.fillRect(-w / 2, -h / 2, w, h);
    g.restore();
    const iw = w - pad * 2, ih = h - pad * 2, nw = tImg.naturalWidth, nh = tImg.naturalHeight;
    const s = Math.max(iw / nw, ih / nh), cw = iw / s, ch = ih / s;
    g.drawImage(tImg, (nw - cw) / 2, (nh - ch) / 2, cw, ch, -iw / 2, -ih / 2, iw, ih);
    const tape = $('.tape', tPhoto), tw = tape.offsetWidth, th = tape.offsetHeight;
    g.save();
    g.translate(tape.offsetLeft + tw / 2 - w / 2, tape.offsetTop + th / 2 - h / 2);
    g.rotate(-5 * Math.PI / 180);
    g.fillStyle = 'rgba(240,208,190,.88)'; g.fillRect(-tw / 2, -th / 2, tw, th);
    g.restore();
    g.restore();
  }

  const tb = at(tText), st = getComputedStyle(tText), lh = parseFloat(st.lineHeight);
  g.save();
  g.beginPath(); g.rect(tb.x, tb.y, tb.w, tb.h); g.clip();
  g.fillStyle = 'rgba(141,15,31,.22)';
  const scroll = tText.scrollTop;
  for (let i = 1, y; (y = tb.y + i * lh - scroll) < tb.y + tb.h + lh; i++) g.fillRect(tb.x, y - 1, tb.w, 1);
  g.font = fontOf(tText); g.fillStyle = st.color;
  const lines = [];
  for (const para of tText.value.split('\n')) {
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      if (g.measureText(line + word).width <= tb.w) { line += word; continue; }
      if (line.trim()) { lines.push(line); line = ''; }
      let rest = word.trimStart();
      while (g.measureText(rest).width > tb.w) {
        let n = rest.length;
        while (n > 1 && g.measureText(rest.slice(0, n)).width > tb.w) n--;
        lines.push(rest.slice(0, n)); rest = rest.slice(n);
      }
      line = rest;
    }
    lines.push(line);
  }
  lines.forEach((t, i) => g.fillText(t, tb.x, baseline(tb.y + i * lh - scroll, lh)));
  g.restore();
  return { canvas: c, box };
}

function startGold() {
  if (goldOn) return;
  goldOn = true;
  const cv = document.createElement('canvas');
  cv.className = 'wish__gold'; cv.setAttribute('aria-hidden', 'true');
  wish.prepend(cv);
  const g = cv.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, 1.5);
  const TONES = ['#fff4c9', '#f7dc97', '#ecbd6e', '#c8933f'];
  let W = 0, H = 0, flakes = [], raf = 0, last = 0, born = performance.now();
  const flake = (top) => {
    const shine = Math.random() < .22;
    return {
      x: Math.random() * W, y: top ? -Math.random() * H * .8 - 10 : Math.random() * H,
      fall: 20 + Math.random() * 38, sway: Math.random() * 6.28, swaySp: .5 + Math.random() * 1.1,
      rot: Math.random() * 6.28, rotSp: (Math.random() - .5) * 1.5, spin: Math.random() * 6.28, spinSp: 1.5 + Math.random() * 3.5,
      r: shine ? 3 + Math.random() * 4 : 1.9 + Math.random() * 3.2, shine
    };
  };
  const fit = () => {
    W = wish.clientWidth; H = wish.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const want = Math.round(Math.min(230, W * H / 2800));
    while (flakes.length < want) flakes.push(flake(!reduce));
    flakes.length = want;
  };
  const paint = (now, dt) => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    // A first rush of gold, easing into a steady drift.
    const rush = 1 + 3.2 * Math.exp(-(now - born) / 1500);
    for (const p of flakes) {
      p.y += p.fall * rush * dt; p.sway += p.swaySp * dt; p.rot += p.rotSp * dt; p.spin += p.spinSp * dt;
      if (p.y > H + 12) { p.y = -12; p.x = Math.random() * W; }
      const x = p.x + Math.sin(p.sway) * 14, edge = clamp(Math.min(p.y / 70, (H - p.y) / 90));
      if (edge <= 0) continue;
      const face = Math.cos(p.spin);
      if (p.shine) {
        const r = p.r * (1.2 + .9 * Math.abs(face)), w = r * .16;
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = edge * (.3 + .7 * Math.abs(face));
        g.fillStyle = TONES[0];
        g.beginPath();
        g.moveTo(x, p.y - r); g.lineTo(x + w, p.y - w); g.lineTo(x + r, p.y); g.lineTo(x + w, p.y + w);
        g.lineTo(x, p.y + r); g.lineTo(x - w, p.y + w); g.lineTo(x - r, p.y); g.lineTo(x - w, p.y - w);
        g.closePath(); g.fill();
        g.globalCompositeOperation = 'source-over';
      } else {
        g.save();
        g.translate(x, p.y); g.rotate(p.rot); g.scale(Math.max(.28, Math.abs(face)), 1);
        g.globalAlpha = edge * .95;
        g.fillStyle = TONES[Math.min(3, Math.floor((1 - Math.abs(face)) * 4))];
        g.beginPath();
        g.moveTo(0, -p.r); g.lineTo(p.r * .8, -p.r * .1); g.lineTo(p.r * .3, p.r); g.lineTo(-p.r * .7, p.r * .4);
        g.closePath(); g.fill();
        g.restore();
      }
    }
    g.globalAlpha = 1;
  };
  const step = now => {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    paint(now, dt);
    raf = requestAnimationFrame(step);
  };
  const run = () => { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(step); };
  fit();
  new ResizeObserver(() => { fit(); if (reduce) paint(performance.now(), 0); }).observe(wish);
  if (reduce) { paint(performance.now(), 0); return; }
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) run(); else cancelAnimationFrame(raf);
  }).observe(wish);
  born = performance.now();
  run();
}

function resetLetter() {
  tText.value = ''; tText.scrollTop = 0;
  setPhoto(null);
  tErr.textContent = '';
  tForm.classList.remove('folding', 'preparing');
}

tForm.addEventListener('submit', async e => {
  e.preventDefault();
  if (sending) return;
  const text = tText.value.trim();
  if (!text && !tBlob) { tErr.textContent = 'Avval bir-ikki so‘z yozing yoki rasm qo‘shing.'; tText.focus(); return; }

  sending = true; blow.disabled = true; tErr.textContent = '';
  const arrived = deliver(text, tBlob).then(() => { wishSent = true; return true; }, () => false);
  const failed = 'Xat yo‘lda qoldi. Bir ozdan keyin yana jo‘natib ko‘ring. Yozganingiz o‘chmadi.';

  if (reduce) {
    if (await arrived) { startGold(); resetLetter(); relight(); wish.classList.add('sent'); }
    else tErr.textContent = failed;
    sending = false; blow.disabled = false;
    return;
  }

  // Let a phone's keyboard go down first: it moves everything on the page.
  if (document.activeElement === tText) { tText.blur(); await wait(340); }
  const b = tSheet.getBoundingClientRect();
  if (b.top < 12 || b.bottom > innerHeight - 12) {
    tSheet.scrollIntoView({ block: 'center', behavior: 'smooth' });
    await wait(520);
  }
  tForm.classList.add('preparing');
  await wait(180);
  if (document.fonts && document.fonts.ready) await document.fonts.ready;

  const { canvas, box } = paintSheet();
  const plane = PaperPlane.create(box, canvas);
  tForm.classList.add('folding');
  await plane.fold();

  if (!await plane.hold(arrived)) {
    await plane.unfold();
    tForm.classList.remove('folding', 'preparing');
    plane.destroy();
    tErr.textContent = failed;
    sending = false; blow.disabled = false;
    return;
  }

  const flight = plane.fly();
  await wait(650);
  candles.scrollIntoView({ block: 'center', behavior: 'smooth' });
  wish.classList.remove('done');
  wish.classList.add('sent');
  await wait(450);
  startGold();
  await wait(750);
  await relight(70);
  await flight;
  plane.destroy();
  resetLetter();
  sending = false; blow.disabled = false;
});

/* ---------- the kart: three red lights and a count, green, and off it goes ---------- */
(function () {
  const sec = $('.kart');
  if (reduce) { sec.classList.add('off'); return; }
  const lights = $$('.lights i', sec), speed = $('.kart__speed', sec), checks = $$('.checker', sec), count = $('#kartCount');
  let started = false;
  async function race() {
    if (started) return;
    started = true;
    starter.disconnect(); passed.disconnect();
    const img = $('img', sec);
    img.loading = 'eager';
    await Promise.race([photoReady(img), wait(6000)]);   // never drive an empty frame in
    for (let i = 0; i < lights.length; i++) {
      lights[i].classList.add('red');
      count.textContent = lights.length - i;
      count.animate([{ scale: 1.7, opacity: 0 }, { scale: 1, opacity: 1, offset: .35 }, { scale: .92, opacity: .9 }], { duration: 400, easing: 'cubic-bezier(.2,.8,.2,1)' });
      if (navigator.vibrate) navigator.vibrate(10);
      await wait(400);
    }
    count.textContent = '';
    lights.forEach(l => { l.classList.remove('red'); l.classList.add('green'); });
    if (navigator.vibrate) navigator.vibrate([25, 30, 40]);
    // The final look is the plain CSS; these only animate from where it comes from.
    sec.classList.add('off');
    sec.animate([{ backgroundColor: '#1d6b3c' }, { backgroundColor: '#141416' }], { duration: 650, easing: 'ease-out' });
    $('.kart__in', sec).animate([
      { transform: 'translate(0,0)' }, { transform: 'translate(-7px,4px)' }, { transform: 'translate(7px,-4px)' },
      { transform: 'translate(-5px,-3px)' }, { transform: 'translate(4px,3px)' }, { transform: 'translate(-2px,1px)' }, { transform: 'translate(0,0)' }
    ], { duration: 520, delay: 520 });
    $('.kart__photo', sec).animate([
      { transform: 'translateX(-135vw) skewX(24deg) scale(1.12)', filter: 'blur(9px)' },
      { transform: 'translateX(8vw) skewX(-8deg) scale(1.02)', filter: 'blur(0)', offset: .62 },
      { transform: 'translateX(-2vw) skewX(2deg) scale(1)', filter: 'blur(0)', offset: .84 },
      { transform: 'none', filter: 'blur(0)' }
    ], { duration: 1050, easing: 'cubic-bezier(.16,.72,.3,1)' });
    $('.kart__title', sec).animate([
      { transform: 'translateX(-70vw) skewX(22deg) scale(1.3)', opacity: 0 },
      { transform: 'translateX(3vw) skewX(-5deg) scale(1)', opacity: 1, offset: .75 },
      { transform: 'none', opacity: 1 }
    ], { duration: 750, delay: 300, easing: 'cubic-bezier(.16,.72,.3,1)', fill: 'backwards' });
    $('.kart__num', sec).animate([{ scale: 1.8, opacity: 0 }, { scale: 1, opacity: 1 }],
      { duration: 800, delay: 480, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
    checks.forEach((c, i) => c.animate(
      [{ backgroundPositionX: '0px' }, { backgroundPositionX: `${i ? 1100 : -1100}px` }],
      { duration: 1500, easing: 'cubic-bezier(.1,.75,.25,1)' }));
    for (let i = 0; i < 22; i++) {
      const s = document.createElement('i');
      s.style.top = `${4 + Math.random() * 92}%`;
      s.style.setProperty('--h', `${1 + Math.ceil(Math.random() * 3)}px`);
      speed.appendChild(s);
      s.animate([
        { transform: 'translateX(-80vw)', opacity: 0 },
        { opacity: 1, offset: .2 },
        { transform: 'translateX(140vw)', opacity: 0 }
      ], { duration: 300 + Math.random() * 360, delay: Math.random() * 520, easing: 'linear', fill: 'backwards' }).finished.then(() => s.remove());
    }
    await wait(1500);
    lights.forEach(l => l.classList.remove('green'));
  }
  // Starts once the place where the kart will arrive is really on screen.
  const starter = new IntersectionObserver(([e]) => { if (e.isIntersecting) race(); }, { rootMargin: '0px 0px -55% 0px' });
  starter.observe($('.lights', sec));
  // Flung past it: don't leave an empty stage to come back to.
  const passed = new IntersectionObserver(([e]) => {
    if (e.isIntersecting || e.boundingClientRect.bottom > 0 || started) return;
    started = true;
    starter.disconnect(); passed.disconnect();
    sec.classList.add('off');
  });
  passed.observe(sec);
})();

/* ---------- the ending: her photos rise and become the stars of an "18" ---------- */
(function () {
  const sky = $('#sky18'), finale = $('#end');
  const STARS = [[9, 26], [23, 7], [23, 32], [23, 60], [23, 92], [67, 49], [50, 37], [52, 16], [67, 7], [82, 16], [84, 37], [87, 60], [87, 81], [67, 93], [47, 81], [47, 60]];
  const PHOTOS = ['flowers', 'eighteen', 'balloons', 'cafe', 'headphones', 'eclair', 'bite', 'closeup', 'cover', 'suit', 'selfie', 'portrait', 'ridge', 'shades', 'kart', 'hero'];
  sky.innerHTML = `<svg class="sky18__lines" viewBox="0 0 100 100" preserveAspectRatio="none"><path pathLength="1" d="M9 26L23 7 23 32 23 60 23 92"/><path pathLength="1" d="M67 49 50 37 52 16 67 7 82 16 84 37 67 49 87 60 87 81 67 93 47 81 47 60 67 49"/></svg>` +
    STARS.map(([x, y], i) => `<i class="fstar" style="left:${x}%;top:${y}%;--d:${(i * .37 % 3).toFixed(2)}s"><svg width="26" height="26" viewBox="0 0 24 24"><use href="#star"/></svg></i>`).join('');
  const stars = $$('.fstar', sky);
  const finish = () => { stars.forEach(s => s.classList.add('on')); sky.classList.add('drawn'); finale.classList.add('told'); };
  if (reduce) {
    finish();
    $$('.hw', finale).forEach(h => { h.style.clipPath = 'none'; });
    return;
  }
  // Small copies, ready before she gets here; a photo that can't load just leaves its star.
  let pics = null;
  const loadPics = () => pics || (pics = Promise.all(PHOTOS.map(n => new Promise(ok => {
    const im = new Image();
    im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => ok(im));
    im.onerror = () => ok(null);
    im.alt = '';
    im.src = `assets/img/thumb/${n}.webp`;
  }))));
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); loadPics(); } }, { rootMargin: '1800px 0px' }).observe(finale);
  new IntersectionObserver(([e]) => { rampVolume(e.isIntersecting ? .6 : 1); }, { threshold: .15 }).observe(finale);

  const teller = new IntersectionObserver(async es => {
    if (!es.some(x => x.isIntersecting)) return;
    teller.disconnect();
    // Flung straight to the bottom: the words can't wait for a show nobody is watching.
    if (sky.getBoundingClientRect().bottom < innerHeight * .3) { finish(); return; }
    const safety = setTimeout(finish, 11000);                // the words must always appear
    const imgs = await Promise.race([loadPics(), wait(2500).then(() => PHOTOS.map(() => null))]);
    const box = sky.getBoundingClientRect();
    const flying = [];
    imgs.forEach((im, i) => {
      if (!im) return;
      const fp = document.createElement('div');
      fp.className = 'fp';
      fp.appendChild(im);
      sky.appendChild(fp);
      const dx = (Math.random() - .5) * box.width * .16, dy = (Math.random() - .5) * box.height * .12;
      const rot = (Math.random() - .5) * 26;
      const at = `translate(-50%,-50%) translate(${dx}px,${dy}px) rotate(${rot}deg)`;
      fp.style.transform = at;
      fp.animate([
        { transform: `translate(-50%,-50%) translate(${dx * 2.4}px,-${innerHeight * 1.1}px) rotate(${rot * 3}deg) scale(1.2)` },
        { transform: `${at} scale(.97)`, offset: .82 },
        { transform: `${at} scale(1)` }
      ], { duration: 620, delay: i * 150, easing: 'cubic-bezier(.3,.7,.25,1)', fill: 'backwards' });
      flying.push({ fp, i, at });
    });
    await wait(flying.length ? flying.length * 150 + 620 + 480 : 0);
    const rise = stars.map((star, i) => {
      const f = flying.find(x => x.i === i), gap = i * 95;
      const light = () => {
        star.classList.add('on');
        star.animate([{ scale: 0, opacity: 0 }, { scale: 1.9, opacity: 1, offset: .5 }, { scale: 1, opacity: 1 }], { duration: 520, easing: 'ease-out' });
      };
      if (!f) return wait(gap + 700).then(light);
      const tx = (STARS[i][0] / 100 - .5) * box.width, ty = (STARS[i][1] / 100 - .5) * box.height;
      const a = f.fp.animate([
        { transform: `${f.at} scale(1)`, opacity: 1 },
        { opacity: 1, offset: .62 },
        { transform: `translate(-50%,-50%) translate(${tx}px,${ty}px) rotate(0deg) scale(.1)`, opacity: 0 }
      ], { duration: 880, delay: gap, easing: 'cubic-bezier(.55,.05,.35,1)', fill: 'forwards' });
      return a.finished.catch(() => {}).then(() => { light(); f.fp.remove(); });
    });
    await Promise.all(rise);
    sky.classList.add('drawn');
    await wait(1500);
    clearTimeout(safety);
    finish();
  }, { threshold: .5 });
  teller.observe(sky);
  teller.observe($('.end__foot', finale));
})();

/* ---------- passing the letter by: a kitten in tears asks her to come back ---------- */
const PLEA_CAT = `<svg class="plea__cat" width="106" height="97" viewBox="0 0 120 110" aria-hidden="true">
  <path d="M34 110c-2-24 8-40 26-40s28 16 26 40z" fill="#fbf0e2"/>
  <path d="M26 40 11 17l32 7z" fill="#f6e7d5"/><path d="M29 31 20 23l15 3z" fill="#f2b8b5"/>
  <path d="M94 40l15-23-32 7z" fill="#f6e7d5"/><path d="M91 31l9-8-15 3z" fill="#f2b8b5"/>
  <ellipse cx="60" cy="47" rx="37" ry="31" fill="#fff8ee"/>
  <path d="M33 32c5-1.5 11-3.5 16-7M87 32c-5-1.5-11-3.5-16-7" stroke="#b98f78" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <ellipse cx="44" cy="47" rx="10.5" ry="12" fill="#2a1410"/><ellipse cx="76" cy="47" rx="10.5" ry="12" fill="#2a1410"/>
  <circle cx="47.5" cy="41.5" r="4" fill="#fff"/><circle cx="79.5" cy="41.5" r="4" fill="#fff"/>
  <circle cx="40.5" cy="50" r="2.2" fill="#fff"/><circle cx="72.5" cy="50" r="2.2" fill="#fff"/>
  <path class="plea__wet" d="M34.5 51c2 8.5 17 8.5 19 0-3 3.5-16 3.5-19 0zM66.5 51c2 8.5 17 8.5 19 0-3 3.5-16 3.5-19 0z" fill="#a6dbf8"/>
  <ellipse cx="29" cy="60" rx="5.5" ry="3.4" fill="#f4b0ab" opacity=".85"/><ellipse cx="91" cy="60" rx="5.5" ry="3.4" fill="#f4b0ab" opacity=".85"/>
  <path d="M57 60h6l-3 3z" fill="#d9666e"/>
  <path d="M52.5 70c2.5-4 12.5-4 15 0" stroke="#6b3a35" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path class="plea__tear" d="M38 57c-2.4 3.6-3.8 5.8-3.8 7.7a3.8 3.8 0 0 0 7.6 0c0-1.9-1.4-4.1-3.8-7.7z" fill="#8fd0f6"/>
  <path class="plea__tear plea__tear--b" d="M82 57c-2.4 3.6-3.8 5.8-3.8 7.7a3.8 3.8 0 0 0 7.6 0c0-1.9-1.4-4.1-3.8-7.7z" fill="#8fd0f6"/>
  <path d="M60 80 46 73v15zM60 80l14-7v15z" fill="#8d0f1f"/><circle cx="60" cy="80" r="3.6" fill="#b3141f"/>
  <ellipse cx="51.5" cy="96" rx="10" ry="8.5" fill="#fffaf2"/><ellipse cx="68.5" cy="96" rx="10" ry="8.5" fill="#fffaf2"/>
  <path d="M60 89v14" stroke="#ecd4ba" stroke-width="1.6" stroke-linecap="round"/>
</svg>`;
const plea = document.createElement('div');
plea.className = 'plea';
plea.setAttribute('role', 'status');
plea.innerHTML = `${PLEA_CAT}<div class="plea__box"><p class="plea__title"></p><p class="plea__text"></p><div class="plea__btns"><button class="plea__go" type="button"></button><button class="plea__no" type="button">Keyinroq</button></div></div>`;
document.body.appendChild(plea);
let pleaCount = 0, pleaTimer = 0;
const hidePlea = () => { clearTimeout(pleaTimer); plea.classList.remove('show'); };
function showPlea() {
  if (wishSent || sending || pleaCount >= 2) return;   // asking twice is sweet, a third time is nagging
  pleaCount++;
  const [title, text, go] = lit
    ? ['Iltimos, o‘tib ketmang 🥺', 'Shamlarni puflang-da, bir og‘iz yozib keting.', 'Qaytaman']
    : tText.value.trim() || tBlob
      ? ['Xatingiz jo‘natilmadi 🥺', 'Iltimos, «Jo‘natish»ni bosib keting.', 'Jo‘nataman']
      : ['Iltimos, nimadur yozing 🥺', 'Bo‘sh qoldirmang, bitta «salom» ham yetadi.', 'Yozaman'];
  $('.plea__title', plea).textContent = title;
  $('.plea__text', plea).textContent = text;
  $('.plea__go', plea).textContent = go;
  plea.classList.add('show');
  clearTimeout(pleaTimer);
  pleaTimer = setTimeout(hidePlea, 9000);
}
$('.plea__no', plea).addEventListener('click', hidePlea);
$('.plea__go', plea).addEventListener('click', () => {
  hidePlea();
  (lit ? candles : tSheet).scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
});
new IntersectionObserver(([e]) => {
  if (e.isIntersecting) hidePlea();
  else if (e.boundingClientRect.bottom < 0) showPlea();
}).observe($('.wish__next'));
function petals(count) {
  if (reduce) return;
  const cv = $('#petals'), g = cv.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, 1.5);
  cv.style.display = 'block';
  const W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
  const COL = ['#b3141f', '#8d0f1f', '#efc7c0', '#f6eadb', '#e9b46a', '#d1242b'];
  const P = Array.from({ length: count }, (_, i) => ({
    x: Math.random() * W,
    y: -Math.random() * H * .9 - 20,
    r: (5 + Math.random() * 7) * dpr,
    c: COL[i % COL.length],
    vy: (1.5 + Math.random() * 2.4) * dpr,
    sway: Math.random() * 6.28,
    swaySp: .012 + Math.random() * .03,
    rot: Math.random() * 6.28,
    rotSp: (Math.random() - .5) * .08,
    star: i % 9 === 0
  }));
  const t0 = performance.now();
  (function frame(t) {
    g.clearRect(0, 0, W, H);
    let alive = false;
    const fade = clamp(1 - (t - t0 - 4800) / 1200);
    for (const p of P) {
      p.y += p.vy; p.sway += p.swaySp; p.rot += p.rotSp;
      p.x += Math.sin(p.sway) * 1.3 * dpr;
      if (p.y < H + 30) alive = true;
      g.save(); g.globalAlpha = fade; g.translate(p.x, p.y); g.rotate(p.rot);
      g.scale(1, .45 + .55 * Math.abs(Math.sin(p.sway * 2)));
      g.fillStyle = p.c; g.beginPath();
      if (p.star) {
        for (let k = 0; k < 10; k++) {
          const a = k * Math.PI / 5, q = k % 2 ? p.r * .42 : p.r;
          g[k ? 'lineTo' : 'moveTo'](Math.cos(a) * q, Math.sin(a) * q);
        }
        g.closePath();
      } else {
        g.moveTo(0, -p.r);
        g.bezierCurveTo(p.r, -p.r * .6, p.r * .85, p.r * .7, 0, p.r);
        g.bezierCurveTo(-p.r * .85, p.r * .7, -p.r, -p.r * .6, 0, -p.r);
      }
      g.fill(); g.restore();
    }
    if (alive && fade > 0) requestAnimationFrame(frame);
    else { g.clearRect(0, 0, W, H); cv.style.display = 'none'; }
  })(t0);
}

/* ---------- letters ---------- */
const LETTERS = [
  { img: 'balloons', pos: '50% 62%', title: "Soliha's birthday", polar: 'My 18!',
    alt: 'Soliha pushti sharlar va guldasta bilan, sochlari havoda, kulib turibdi',
    meta: ['Sharlar: 4 ta', 'Guldasta: 1 ta', 'Tabassum: cheksiz'],
    note: 'Sharlar shiftga intiladi, gullar qo‘ldan tushmaydi, tabassum esa hammasidan yorqin.' },
  { img: 'cafe', pos: '50% 35%', title: "Soliha's café", polar: 'Sokin kun',
    alt: 'Soliha kafeda, qo‘lini yuziga tirab o‘tiribdi, oldida sariq gullar',
    meta: ['Joy: kafe', 'Stolda: sariq gullar', 'Shoshilish: yo‘q'],
    note: 'Eng chiroyli kunlar — shoshilmaydigan kunlar.' },
  { img: 'headphones', pos: '50% 40%', title: "Soliha's playlist", polar: 'Quyoncha',
    alt: 'Soliha pushti mushuk quloqli quloqchinda',
    meta: ['Quloqchin: mushukniki', 'Nigoh: quyonchaniki', 'Dunyo: o‘chiq'],
    note: 'Quyoncha rejimi yoqilgan. Qo‘shiq tugamaguncha bezovta qilinmasin.' },
  { img: 'library', pos: '30% 50%', title: "Soliha's library", polar: 'Kutubxonada',
    alt: 'Soliha kutubxonada planshet ekranida o‘zini suratga olyapti, qo‘lida bordo g‘ilofli telefon',
    meta: ['Joy: kutubxona', 'Telefon: bordo', 'Quvvat: 57%'],
    note: 'Kitoblar kutib turadi. Yaxshi kadr esa kutib turmaydi.' },
  { img: 'lesson', pos: '50% 30%', title: "Soliha's lesson", polar: 'Darsda',
    alt: 'Soliha darsda selfi olyapti, kulrang kofta kiygan',
    meta: ['Joy: dars', 'Kayfiyat: «tezroq tugasin»', 'O‘qituvchi: ko‘rmadi'],
    note: 'Bu selfi shu xatda qoladi. Hech kimga aytmaymiz.' }
];
const deck = $('#deck'), dlg = $('#letter'), stage = $('#lStage');
const ROT = [-5, 3, -2.4, 4.6, -3.6];
const read = new Set();
LETTERS.forEach((l, i) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'mail rv';
  b.style.setProperty('--rot', ROT[i] + 'deg');
  b.style.transitionDelay = (i * 70) + 'ms';
  b.addEventListener('transitionend', () => { b.style.transitionDelay = '0ms'; }, { once: true });
  b.setAttribute('aria-label', `${i + 1}-xatni ochish`);
  b.innerHTML = `
    <span class="e-back"></span>
    <span class="e-flapw"><span class="e-flap"></span></span>
    <span class="e-front"></span>
    <span class="seal"><svg viewBox="0 0 100 100"><use href="#seal-art"/></svg></span>
    <svg class="mail__tick"><use href="#star"/></svg>
    <span class="mail__to"><b class="foil">${l.title}</b></span>
    <span class="mail__tag mono">Xat 0${i + 1}</span>`;
  b.addEventListener('click', () => openLetter(i));
  deck.appendChild(b);
  io.observe(b);
  new Image().src = `assets/img/${l.img}-800.webp`;
});
let cur = 0, seq = 0;
// Every letter plays the same way: sealed envelope, flap opens, card comes out.
async function showLetter(i, dir) {
  const my = ++seq, l = LETTERS[i];
  cur = i;
  const note = $('#lNote'), img = $('#lImg');
  hideTip(letterTip);
  note.classList.remove('in');
  $('#lCount').textContent = `${i + 1} / ${LETTERS.length}`;
  $('#lPrev').disabled = i === 0;
  const lastLetter = i === LETTERS.length - 1;
  $('#lNextLabel').textContent = lastLetter ? 'Yopish' : 'Keyingi xat';
  $('#lNext').classList.toggle('end', lastLetter);
  if (dir && !reduce) {                     // the letter on screen leaves first
    stage.style.setProperty('--lx', (dir * 34) + 'px');
    stage.classList.add('leaving');
    await wait(260);
    if (my !== seq) return;
  }
  // back into a sealed envelope with transitions off, so it never visibly rises from below
  stage.classList.add('reset');
  stage.classList.remove('open', 'out', 'leaving');
  $('#lTitle').textContent = l.title;
  $('#lPolar').textContent = l.polar;
  $('#lMeta').innerHTML = l.meta.join('<br>');
  img.src = `assets/img/${l.img}-800.webp`; img.alt = l.alt; img.style.objectPosition = l.pos;
  note.textContent = l.note;
  stage.style.animation = 'none'; void stage.offsetWidth; stage.style.animation = '';
  stage.classList.remove('reset');
  try { await Promise.race([img.decode(), wait(700)]); } catch (e) {}
  if (my !== seq) return;
  await wait(reduce ? 0 : 420);
  if (my !== seq) return;
  stage.classList.add('open');
  await wait(reduce ? 0 : 760);
  if (my !== seq) return;
  stage.classList.add('out');
  note.classList.add('in');
  if (!letterNextUsed) showTip(letterTip, 2600, 7000);
  read.add(i);
  const m = $$('.mail', deck)[i];
  m.classList.add('read');
  m.setAttribute('aria-label', `${i + 1}-xatni qayta ochish (o‘qilgan)`);
  if (read.size === LETTERS.length) $('#reward').classList.add('in');
}
function openLetter(i) {
  deckUsed = true; hideTip(deckTip);
  dlg.showModal();
  root.classList.add('modal');
  showLetter(i, 0);
}
function closeLetter() { seq++; hideTip(letterTip); if (dlg.open) dlg.close(); }
dlg.addEventListener('close', () => root.classList.remove('modal'));
dlg.addEventListener('click', e => { if (e.target === dlg) closeLetter(); });
$('#lClose').addEventListener('click', closeLetter);
$('#lPrev').addEventListener('click', () => cur > 0 && showLetter(cur - 1, 1));
$('#lNext').addEventListener('click', () => {
  $('#lNext').classList.remove('nudge');
  letterNextUsed = true;
  if (cur < LETTERS.length - 1) showLetter(cur + 1, -1); else closeLetter();
});
dlg.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') $('#lPrev').click();
  if (e.key === 'ArrowRight' && cur < LETTERS.length - 1) $('#lNext').click();
});

/* ---------- magazine ---------- */
const mag = $('#mag'), pages = $$('.page', mag);
let pi = 0;
function renderMag() {
  pages.forEach((p, i) => {
    p.classList.toggle('turned', i < pi);
    p.style.zIndex = i === pi - 1 ? pages.length + 1 : pages.length - i;
    p.setAttribute('aria-hidden', i !== pi);
  });
  $('#magCount').textContent = `${pi + 1} / ${pages.length}`;
  $('#magPrev').disabled = pi === 0;
  const lastPage = pi === pages.length - 1;
  $('#magNextLabel').textContent = lastPage ? 'Boshiga qaytish' : 'Keyingi sahifa';
  $('#magNext').classList.toggle('end', lastPage);
}
const go = d => {
  if (d > 0) { $('#magNext').classList.remove('nudge'); magNextUsed = true; hideTip(magTip); }
  pi = clamp(pi + d, 0, pages.length - 1);
  renderMag();
};
const nextPage = () => {            // from the last page, back to the cover
  $('#magNext').classList.remove('nudge');
  magNextUsed = true; hideTip(magTip);
  pi = pi === pages.length - 1 ? 0 : pi + 1;
  renderMag();
};
renderMag();
$('#magPrev').addEventListener('click', () => go(-1));
$('#magNext').addEventListener('click', nextPage);
let downX = null;
mag.addEventListener('pointerdown', e => { downX = e.clientX; });
mag.addEventListener('pointerup', e => {
  if (downX === null) return;
  const dx = e.clientX - downX, r = mag.getBoundingClientRect();
  downX = null;
  if (Math.abs(dx) > 34) go(dx < 0 ? 1 : -1);
  else if (e.clientX - r.left < r.width * .28) go(-1);
  else nextPage();
});
mag.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') go(1);
  if (e.key === 'ArrowLeft') go(-1);
});

/* ---------- stars (only drawn while on screen) ---------- */
$$('canvas.stars').forEach(cv => {
  const g = cv.getContext('2d'), N = +cv.dataset.stars || 80;
  let W = 0, H = 0, S = [], on = false, raf = 0;
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const size = () => {
    const r = cv.getBoundingClientRect();
    W = cv.width = r.width * dpr; H = cv.height = r.height * dpr;
    const count = Math.round(N * clamp(r.height / innerHeight, 1, 3.2));
    S = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      r: (.35 + Math.random() * Math.random() * 1.5) * dpr,
      ph: Math.random() * 6.28, sp: .4 + Math.random() * 1.2
    }));
    draw(performance.now());
  };
  function draw(t) {
    g.clearRect(0, 0, W, H);
    for (const s of S) {
      g.globalAlpha = reduce ? .7 : .28 + .62 * (.5 + .5 * Math.sin(s.ph + t * .001 * s.sp));
      g.fillStyle = '#fbeed2';
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, 6.29); g.fill();
    }
    if (on && !reduce) raf = requestAnimationFrame(draw);
  }
  new IntersectionObserver(([e]) => {
    on = e.isIntersecting; cancelAnimationFrame(raf);
    if (on) raf = requestAnimationFrame(draw);
  }).observe(cv);
  size();
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(size, 200); });
  // the sleep section grows as lazy images load
  if (window.ResizeObserver) new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(size, 200); }).observe(cv);
});
})();
