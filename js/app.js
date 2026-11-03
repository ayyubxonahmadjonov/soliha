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
const song = $('#song'), player = $('#player');
let resumeOnShow = false, volRaf = 0;
const startSong = () => { const p = song.play(); if (p) p.catch(() => {}); };
song.addEventListener('play', () => player.setAttribute('aria-pressed', 'true'));
song.addEventListener('pause', () => player.setAttribute('aria-pressed', 'false'));
player.addEventListener('click', () => { song.paused ? startSong() : song.pause(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { resumeOnShow = !song.paused; song.pause(); }
  else if (resumeOnShow) startSong();
});
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
  iris.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, fill: 'forwards' }).finished.then(() => iris.remove());
}
genv.addEventListener('click', openGate);   // the seal is the hint, the whole envelope responds
$('#replay').addEventListener('click', () => location.reload());

/* ---------- reveal on scroll ---------- */
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { rootMargin: '0px 0px -10% 0px', threshold: .06 });
$$('.rv,.rv-img,.necklace').forEach(el => io.observe(el));

/* ---------- word by word ---------- */
const wordsSec = $('#words'), wordsEl = $('[data-words]'), wordsSmall = $('.words__small');
const HL = /^(yorug‘lik,|kayfiyat|sukunat|sovg‘a\.)$/;
wordsEl.innerHTML = wordsEl.textContent.trim().split(/\s+/)
  .map(w => `<span${HL.test(w) ? ' data-hl' : ''}>${w}</span>`).join(' ');
const wordSpans = $$('span', wordsEl);

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

  // words
  const wr = wordsSec.getBoundingClientRect();
  if (wr.top < vh && wr.bottom > 0) {
    const p = clamp(-wr.top / (wr.height - vh));
    const lit = p * 1.2 * (wordSpans.length + 2);
    wordSpans.forEach((s, i) => {
      const on = i < lit;
      s.classList.toggle('on', on);
      if (s.hasAttribute('data-hl')) s.classList.toggle('hl', on);
    });
    wordsSmall.classList.toggle('on', p > .86);
  }

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
blow.addEventListener('click', async () => {
  const list = $$('.candle', candles);
  if (lit) {
    lit = false; blow.disabled = true;
    if (navigator.vibrate) navigator.vibrate(20);
    candles.classList.add('out');
    for (let i = 0; i < list.length; i++) { list[i].classList.add('out'); await wait(reduce ? 0 : 48); }
    await wait(reduce ? 0 : 320);
    petals(170);
    wish.classList.add('done');
    blow.textContent = 'Yana yoqish'; blow.disabled = false; blow.classList.add('btn--ghost');
  } else {
    lit = true; candles.classList.remove('out'); wish.classList.remove('done');
    list.forEach(c => c.classList.remove('out'));
    blow.textContent = 'Shamlarni puflash'; blow.classList.remove('btn--ghost');
  }
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
async function showLetter(i, withEnvelope) {
  const my = ++seq, l = LETTERS[i];
  cur = i;
  $('#lTitle').textContent = l.title;
  $('#lPolar').textContent = l.polar;
  $('#lMeta').innerHTML = l.meta.join('<br>');
  const img = $('#lImg');
  img.src = `assets/img/${l.img}-800.webp`; img.alt = l.alt; img.style.objectPosition = l.pos;
  $('#lCount').textContent = `${i + 1} / ${LETTERS.length}`;
  $('#lPrev').disabled = i === 0;
  $('#lNext').disabled = i === LETTERS.length - 1;
  const note = $('#lNote');
  note.classList.remove('in'); note.textContent = l.note;
  stage.classList.remove('open', 'out');
  stage.style.animation = 'none'; void stage.offsetWidth; stage.style.animation = '';
  try { await Promise.race([img.decode(), wait(700)]); } catch (e) {}
  if (my !== seq) return;
  await wait(reduce ? 0 : (withEnvelope ? 420 : 240));
  if (my !== seq) return;
  stage.classList.add('open');
  await wait(reduce ? 0 : 760);
  if (my !== seq) return;
  stage.classList.add('out');
  note.classList.add('in');
  read.add(i);
  const m = $$('.mail', deck)[i];
  m.classList.add('read');
  m.setAttribute('aria-label', `${i + 1}-xatni qayta ochish (o‘qilgan)`);
  if (read.size === LETTERS.length) $('#reward').classList.add('in');
}
function openLetter(i) {
  dlg.showModal();
  root.classList.add('modal');
  showLetter(i, true);
}
function closeLetter() { seq++; if (dlg.open) dlg.close(); }
dlg.addEventListener('close', () => root.classList.remove('modal'));
dlg.addEventListener('click', e => { if (e.target === dlg) closeLetter(); });
$('#lClose').addEventListener('click', closeLetter);
$('#lPrev').addEventListener('click', () => cur > 0 && showLetter(cur - 1));
$('#lNext').addEventListener('click', () => cur < LETTERS.length - 1 && showLetter(cur + 1));
dlg.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') $('#lPrev').click();
  if (e.key === 'ArrowRight') $('#lNext').click();
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
  $('#magNext').disabled = pi === pages.length - 1;
}
const go = d => { pi = clamp(pi + d, 0, pages.length - 1); renderMag(); };
renderMag();
$('#magPrev').addEventListener('click', () => go(-1));
$('#magNext').addEventListener('click', () => go(1));
let downX = null;
mag.addEventListener('pointerdown', e => { downX = e.clientX; });
mag.addEventListener('pointerup', e => {
  if (downX === null) return;
  const dx = e.clientX - downX, r = mag.getBoundingClientRect();
  downX = null;
  if (Math.abs(dx) > 34) go(dx < 0 ? 1 : -1);
  else go(e.clientX - r.left < r.width * .28 ? -1 : 1);
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
