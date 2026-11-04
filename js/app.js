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
const song = $('#song');
let volRaf = 0;
const startSong = () => { const p = song.play(); if (p) p.catch(() => {}); };
/* There is no off switch, so anything that stops the song (a call, a blocked
   start) must not leave it silent: the next touch brings it back. */
const keepPlaying = () => { if (opened && !document.hidden && song.paused) startSong(); };
['touchend', 'click', 'keydown'].forEach(t => document.addEventListener(t, keepPlaying, { capture: true, passive: true }));
document.addEventListener('visibilitychange', () => { if (document.hidden) song.pause(); else keepPlaying(); });
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
async function openGate() {
  if (opened) return; opened = true;
  startSong();                      // must stay inside the tap for mobile browsers
  if (navigator.vibrate) navigator.vibrate(12);
  gate.classList.add('opening');
  seal.classList.add('broken');
  await wait(reduce ? 0 : 320);
  genv.classList.add('open');
  await wait(reduce ? 0 : 800);
  genv.classList.add('out');
  await wait(reduce ? 0 : 1020);
  await reveal();
}
async function reveal() {
  const img = $('img', iris);
  iris.hidden = false;
  try { await Promise.race([img.decode(), wait(900)]); } catch (e) {}
  const r = $('#gletter').getBoundingClientRect(), W = innerWidth, H = innerHeight;
  const from = `inset(${Math.max(0, r.top)}px ${Math.max(0, W - r.right)}px ${Math.max(0, H - r.bottom)}px ${Math.max(0, r.left)}px round 3px)`;
  const dur = reduce ? 1 : 1350;
  const opts = { duration: dur, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' };
  const a = iris.animate([{ clipPath: from }, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }], opts);
  img.animate([{ transform: 'scale(1.14)' }, { transform: 'scale(1)' }], opts);
  gate.classList.add('fade');
  setTimeout(() => hero.classList.add('on'), dur * .62);
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
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { rootMargin: '0px 0px -10% 0px', threshold: .06 });
$$('.rv,.rv-img,.necklace').forEach(el => io.observe(el));

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
new IntersectionObserver(([e]) => { if (!song.paused) rampVolume(e.isIntersecting ? .5 : 1); }, { threshold: .2 }).observe($('.sleep__in'));

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
  c.innerHTML = '<b class="flame"></b>';
  candles.appendChild(c);
}
const blow = $('#blow'), wish = $('#wish');
let lit = true;
async function relight(gap = 0) {
  lit = true; candles.classList.remove('out'); wish.classList.remove('done');
  blow.textContent = 'Shamlarni puflash'; blow.classList.remove('btn--ghost');
  // From the middle outwards.
  const list = $$('.candle', candles).map((c, i) => [Math.abs(i - 8.5), c]).sort((a, b) => a[0] - b[0]);
  for (const [, c] of list) { c.classList.remove('out'); if (gap) await wait(gap); }
}
blow.addEventListener('click', async () => {
  const list = $$('.candle', candles);
  if (lit) {
    lit = false; blow.disabled = true;
    if (navigator.vibrate) navigator.vibrate(20);
    wish.classList.remove('sent');
    candles.classList.add('out');
    for (let i = 0; i < list.length; i++) { list[i].classList.add('out'); await wait(reduce ? 0 : 48); }
    await wait(reduce ? 0 : 320);
    petals(170);
    wish.classList.add('done');
    blow.textContent = 'Yana yoqish'; blow.disabled = false; blow.classList.add('btn--ghost');
    await wait(reduce ? 0 : 1500);
    if (!lit) tilak.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  } else {
    relight();
  }
});

/* ---------- the wish letter ---------- */
const WISH_URL = 'https://soliha-tilak.vercel.app/api/tilak';   // relay/api/tilak.js holds the bot's token, not this page
// ?sinov rehearses everything but the sending; ?sinov=xato rehearses a failed send.
const wishTrial = new URLSearchParams(location.search).get('sinov');
const tilak = $('#tilak'), tForm = $('#tForm'), tSheet = $('#tSheet'), tText = $('#tText'), tFile = $('#tFile');
const tAdd = $('#tAdd'), tPhoto = $('#tPhoto'), tImg = $('#tImg'), tErr = $('#tErr'), tSend = $('#tSend');
let tBlob = null, sending = false, goldOn = false;

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
  const arrived = deliver(text, tBlob).then(() => true, () => false);
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
