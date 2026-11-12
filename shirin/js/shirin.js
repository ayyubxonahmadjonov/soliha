/* Shirinlik: a 46-second film that follows the song.
   Every frame is worked out from the song's own clock, so the pieces, words and box stay on the beat
   after a stall, a pause or a replay, and a frozen moment can be rendered on its own (?at=12.5). */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const qs = new URLSearchParams(location.search);
const AT = qs.has('at') ? parseFloat(qs.get('at')) || 0 : null;     // rehearsal: no gate, no sound
const RUN = qs.has('run');                                           // with ?at, keep the clock running

/* ---- the song (Love You Like A Love Song): 120 BPM, the chorus hook "I love you like a love song" lands at 8.2 s ---- */
const BEAT = .5, B0 = 8.2;
const beatAt = k => B0 + k * BEAT;
const bar = n => beatAt(4 * n);                                     // one bar = two seconds; the hook repeats every two bars
const DROP = B0, REVEAL = 1.6;
const PIECE = k => DROP + k * 2 * BEAT;                              // a piece snaps off on every beat of the hook, eight in a row
/* the back half is spaced so each line can be read: pieces 8.2-15.2, a line to read 14-19, then the box, title and burst */
const GATHER = beatAt(22), TITLE = beatAt(27), TITLE2 = beatAt(31), BURST = beatAt(27), END = beatAt(44);
const CLIP = 33;
const TOKENS = { wa: 2.0, wa2: 4.0, drop: DROP, wb: PIECE(1) + .3, wc: 14.0, wc2: 15.0, gather: GATHER, wt: TITLE, wt2b: TITLE + .5, wt2: TITLE2, never: Infinity };
const timeOf = (tok, out) => (tok in TOKENS ? TOKENS[tok] : parseFloat(tok)) - (out ? .3 : 0);

/* ---- little maths ---- */
const cl = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const lerp = (a, b, p) => a + (b - a) * p;
const span = (t, a, b) => cl((t - a) / (b - a));
const eo = p => 1 - (1 - p) ** 3;
const eio = p => p < .5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
const eback = p => { const c = 1.6; return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2; };
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const f1 = v => v.toFixed(1), f2 = v => v.toFixed(2);

/* a thump on every beat once the song is going; downbeats land harder */
function pulse(t) {
  if (t < DROP) return 0;
  const k = Math.floor((t - B0) / BEAT), d = t - beatAt(k);
  return (k % 4 === 0 ? 1 : .6) * Math.exp(-d / .1);
}

/* ================= the wrapper's artwork: the real box, with her on it ================= */
const PACK_ART = 'assets/img/pack.webp?v=3';
const PACK_AR = 1792 / 1064;                                    // the box front's width over its height
document.querySelectorAll('.art').forEach(a => { a.style.background = `#fff url(${PACK_ART}) center/100% 100% no-repeat`; });

/* ================= layout ================= */
const stage = $('#stage'), slab = $('#slab'), piecesEl = $('#pieces'), box = $('#box'), boxIn = $('#boxIn'), glow = $('#glow'), flash = $('#flash'), drips = $('#drips');
const gate = $('#gate'), pack = $('#pack');
let W = 0, H = 0, G = {};
const safe = () => { const s = getComputedStyle(document.documentElement); return { t: parseFloat(s.getPropertyValue('--sat')) || 0, b: parseFloat(s.getPropertyValue('--sab')) || 0 }; };

/* the tear runs across the wrapper a little above a third of the way down */
const JAG = []; for (let i = 0; i <= 12; i++) JAG.push([i / 12, .275 + (i % 2 ? .02 : -.016) + Math.sin(i * 2.3) * .008]);
const pt = ([x, y]) => `${(x * 100).toFixed(2)}% ${(y * 100).toFixed(2)}%`;
const CLIP_FLAP = `polygon(0 0,100% 0,${JAG.slice().reverse().map(([x, y]) => pt([x, y + .004])).join(',')})`;   // a hair past the halves, so no seam shows before the tear
/* the halves overlap by a hair in the middle, so the join never shows as a line */
const CLIP_L = `polygon(${JAG.slice(0, 6).map(pt).join(',')},${pt([.504, JAG[6][1]])},50.4% 100%,0 100%)`;
const CLIP_R = `polygon(${pt([.496, JAG[6][1]])},${JAG.slice(7).map(pt).join(',')},100% 100%,49.6% 100%)`;
$('#flap').style.setProperty('--clip', CLIP_FLAP);
$('.pack__half--l').style.setProperty('--clip', CLIP_L);
$('.pack__half--r').style.setProperty('--clip', CLIP_R);

/* long drips at the sides, short ones in the middle, so the words under them stay readable */
const DRIPS = Array.from({ length: 11 }, (_, i) => { const r = mulberry(31 + i), x = 2 + i * 9.4 + r() * 3.5, c = Math.abs(x - 50) / 50; return { x, w: 2 + r() * 2.4, h: 3.5 + c ** 4 * 20 + r() * 1.5, delay: r() * 1.4, dur: 1.6 + r() * 1.8, ph: r() * 6.3, el: null }; });
DRIPS.forEach(d => { d.el = document.createElement('i'); d.el.style.cssText = `--x:${f1(d.x)}vw;--w:${f1(d.w)}vw;--h:${f1(d.h)}vh`; drips.appendChild(d.el); });

function layout() {
  W = innerWidth; H = innerHeight;
  const wide = W > H, sf = safe();
  const ps = Math.floor(Math.min(W * .72, (H - sf.t - sf.b) * .55 / 2) / 2.27);
  const g = ps * .07, pad = ps * .1;
  const sw = 2 * ps + g + 2 * pad, sh = 4 * ps + 3 * g + 2 * pad;
  const cx = W / 2, cy = sf.t + (H - sf.t - sf.b) * .5 + (wide ? 0 : 18);
  const sx = cx - sw / 2, sy = cy - sh / 2;
  const slots = [];
  for (let i = 0; i < 8; i++) slots.push({ x: sx + pad + (i % 2) * (ps + g) + ps / 2, y: sy + pad + (i >> 1) * (ps + g) + ps / 2 });
  /* two rows of four photos along the bottom, with the buttons under them */
  const tw = Math.min(Math.floor((W - 28 - 3 * 8) / 4), 64);
  const stripBottom = H - sf.b - 22 - 56 - 16, stripTop = stripBottom - 2 * tw - 8;
  const strip = [], sx0 = W / 2 - (4 * tw + 3 * 8) / 2 + tw / 2, sy0 = stripTop + tw / 2;
  for (let i = 0; i < 8; i++) strip.push({ x: sx0 + (i % 4) * (tw + 8), y: sy0 + (i >> 2) * (tw + 8) });
  /* the box sits between the title and the photos */
  const sayTop = Math.max(H * .145, 60) + sf.t;        // under the chocolate band and its shortest drips
  const titleBlock = Math.min(H * .17, 150), titleH = sayTop + titleBlock;
  const availH = stripTop - 18 - titleH;
  const bh = Math.min(availH * .9, W * .9 / PACK_AR), bw = bh * PACK_AR, bd = bh * .18;
  const bx = W / 2, by = titleH + availH / 2;
  const pw = Math.min(W * .95, (H - sf.t - sf.b) * .62 * PACK_AR), ph = pw / PACK_AR;
  G = { ps, g, pad, sw, sh, sx, sy, cx, cy, slots, tw, strip, bw, bh, bd, bx, by, pw, ph, m: Math.min(W, H), sayTop, titleH };
  const rs = stage.style;
  rs.setProperty('--ps', `${ps}px`); rs.setProperty('--sw', `${f1(sw)}px`); rs.setProperty('--sh', `${f1(sh)}px`);
  rs.setProperty('--bw', `${f1(bw)}px`); rs.setProperty('--bh', `${f1(bh)}px`); rs.setProperty('--bd', `${f1(bd)}px`);
  rs.setProperty('--sayTop', `${f1(sayTop)}px`); rs.setProperty('--sayLow', `${f1(sy + sh + 14)}px`); rs.setProperty('--finTop', `${f1(stripBottom + 14)}px`);
  rs.setProperty('--subTop', `${f1(titleBlock * .76)}px`);
  box.style.setProperty('--au', `${(bh * .515 / 100).toFixed(3)}px`);
  box.style.transform = `translate(${f1(bx - bw / 2)}px,${f1(by - bh / 2)}px)`;
  piecesEl.style.fontSize = `${ps}px`;
  pack.style.width = `${f1(pw)}px`; pack.style.height = `${f1(ph)}px`;
  pack.style.left = `${f1(cx - pw / 2)}px`; pack.style.top = `${f1(cy - ph / 2)}px`;     // placed, not transformed: its breathing animation owns the transform
  pack.style.setProperty('--au', `${(pw / 100).toFixed(3)}px`);
  gate.style.setProperty('--msgTop', `${f1(cy + ph / 2 + 16)}px`);
  fxSize();
  seedParticles();
}

/* ================= the pieces ================= */
/* row by row: a bite, a dessert, a close look, a selfie, eighteen, flowers, headphones, a white dress */
const PHOTOS = ['c', 'a', 'd', 'e', 'f', 'b', 'h', 'g'];
const pieces = PHOTOS.map((name, i) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'pc'; b.setAttribute('aria-label', 'Rasmni kattalashtirish');
  const f = document.createElement('span'); f.className = 'pc__f';
  const crack = document.createElement('i'); crack.className = 'pc__crack'; f.appendChild(crack);
  const bk = document.createElement('span'); bk.className = 'pc__b';
  const img = new Image(); img.alt = ''; img.decoding = 'async'; bk.appendChild(img);
  b.append(f, bk); piecesEl.appendChild(b);
  return { b, img, crack, name, src: `assets/img/${name}.webp?v=1`, big: `assets/img/${name}-big.webp?v=1`, vis: -1, z: -1, ck: -1 };
});

/* An image is only handed to a piece once it has really arrived; until then it keeps trying, quietly. */
function fetchImg(src, n = 0) {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => res(im.src));
    im.onerror = () => setTimeout(() => fetchImg(src, n + 1).then(res), Math.min(4000, 400 * 2 ** n));
    im.src = n ? `${src}${src.includes('?') ? '&' : '?'}r=${n}` : src;
  });
}

/* ================= canvas: crumbs, sparks, confetti ================= */
const cv = $('#fx'), cx2 = cv.getContext('2d');
let DPR = 1;
function fxSize() { DPR = Math.min(window.devicePixelRatio || 1, 2); cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); }
const CHOC = ['#3b1d10', '#5b2f1b', '#7a4425', '#2a1208', '#4b2413'];
const CONF = ['#e2001a', '#fff8ef', '#3b1d10', '#f6c453', '#e2001a', '#fff', '#5b2f1b', '#ffd9a8'];
let crumbs = [], sparks = [], confetti = [], motes = [];
function seedParticles() {
  const r = mulberry(18), sc = G.m / 420;
  crumbs = []; sparks = [];
  G.slots.forEach((s, i) => {
    const t0 = PIECE(i);
    for (let k = 0; k < 16; k++) { const a = r() * 6.3, v = (90 + r() * 260) * sc; crumbs.push({ t0: t0 + .06, x: s.x, y: s.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120 * sc, s: (1.6 + r() * 3.4) * Math.max(.8, sc), spin: (r() - .5) * 12, a0: r() * 6.3, col: CHOC[(r() * CHOC.length) | 0], life: .9 + r() * .6 }); }
    for (let k = 0; k < 10; k++) sparks.push({ t0: t0 + .9, x: s.x, y: s.y, a: r() * 6.3, d: (G.ps * .5 + r() * G.ps * .5), gold: r() < .6 });
  });
  confetti = Array.from({ length: 150 }, () => {
    const a = -Math.PI / 2 + (r() - .5) * 2.2, v = (260 + r() * 820) * sc;
    return { t0: BURST, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: (3 + r() * 6) * Math.max(.8, sc), a0: r() * 6.3, spin: (r() - .5) * 10, flip: 2 + r() * 5, ph: r() * 6.3, wob: 10 + r() * 30, col: CONF[(r() * CONF.length) | 0], round: r() < .3, life: 3.2 + r() * 1.5 };
  });
  motes = Array.from({ length: 34 }, () => ({ x: r(), y: r(), sp: (6 + r() * 14) * Math.max(.8, sc), sw: 6 + r() * 20, ph: r() * 6.3, s: (.7 + r() * 1.6) * Math.max(.9, sc), warm: r() < .7, tw: 1 + r() * 2 }));
}
function chip(g, x, y, s, a, col, alpha) {
  g.save(); g.translate(x, y); g.rotate(a); g.globalAlpha = alpha; g.fillStyle = col;
  g.beginPath(); g.moveTo(-s, -s * .7); g.lineTo(s * .9, -s); g.lineTo(s, s * .6); g.lineTo(-s * .6, s); g.closePath(); g.fill();
  g.globalAlpha = alpha * .35; g.fillStyle = '#fff'; g.fillRect(-s * .5, -s * .6, s * .5, s * .22);
  g.restore();
}
function star(g, x, y, r, col, alpha) {
  g.globalAlpha = alpha; g.fillStyle = col;
  g.beginPath(); g.moveTo(x, y - r * 2.4); g.lineTo(x + r * .6, y); g.lineTo(x, y + r * 2.4); g.lineTo(x - r * .6, y); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(x - r * 2.4, y); g.lineTo(x, y + r * .6); g.lineTo(x + r * 2.4, y); g.lineTo(x, y - r * .6); g.closePath(); g.fill();
}
function drawFx(t) {
  const g = cx2;
  g.setTransform(DPR, 0, 0, DPR, 0, 0); g.clearRect(0, 0, W, H);
  const sc = G.m / 420, grav = 520 * sc;
  /* warm dust once the music is going, twinkling on the beat */
  if (t > DROP) {
    const vis = cl((t - DROP) / 2) * (t > END ? .8 : 1), tw = pulse(t);
    const te = t - DROP;
    for (const m of motes) {
      const y = ((m.y * (H + 40) - te * m.sp) % (H + 40) + H + 40) % (H + 40) - 20;
      const x = m.x * W + Math.sin(te * .45 + m.ph) * m.sw;
      const a = vis * (.22 + .4 * Math.sin(te * m.tw + m.ph) ** 2) * (1 + .8 * tw);
      g.globalAlpha = cl(a * .25); g.fillStyle = m.warm ? '#f0c56a' : '#fff';
      g.beginPath(); g.arc(x, y, m.s * 3, 0, 6.3); g.fill();
      g.globalAlpha = cl(a); g.beginPath(); g.arc(x, y, m.s, 0, 6.3); g.fill();
    }
  }
  /* crumbs fly when a piece snaps off */
  for (const c of crumbs) {
    const dt = t - c.t0; if (dt < 0 || dt > c.life) continue;
    const x = c.x + c.vx * dt, y = c.y + c.vy * dt + grav * dt * dt * .5;
    chip(g, x, y, c.s, c.a0 + c.spin * dt, c.col, cl((c.life - dt) * 3));
  }
  /* a glint when a photo turns up */
  for (const s of sparks) {
    const dt = t - s.t0; if (dt < 0 || dt > .7) continue;
    const p = dt / .7;
    star(g, s.x + Math.cos(s.a) * s.d * eo(p), s.y + Math.sin(s.a) * s.d * eo(p), 2.2 * (1 - p) + .4, s.gold ? '#e2ac4f' : '#fff', (1 - p) ** 1.3);
  }
  /* the burst: chocolate, milk, wrapper and gold, thrown up and falling back */
  const K = 2.1;
  for (const p of confetti) {
    const dt = t - p.t0; if (dt < 0 || dt > p.life) continue;
    const e = (1 - Math.exp(-K * dt)) / K;
    const x = G.bx + p.vx * e + Math.sin(dt * 2.2 + p.ph) * p.wob * (1 - Math.exp(-dt));
    const y = G.by + p.vy * e + grav * .7 * (dt / K - e / K);
    if (y > H + 30) continue;
    const alpha = cl((p.life - dt) * 1.2) * cl(dt * 14);
    if (p.round) { g.globalAlpha = alpha; g.fillStyle = p.col; g.beginPath(); g.ellipse(x, y, p.s * .8, p.s * .8 * (.3 + .7 * Math.abs(Math.cos(p.ph + p.flip * dt))), p.a0 + p.spin * dt, 0, 6.3); g.fill(); }
    else chip(g, x, y, p.s, p.a0 + p.spin * dt, p.col, alpha);
  }
  g.globalAlpha = 1;
}

/* ================= words arrive one by one ================= */
const cues = [];
document.querySelectorAll('[data-in]').forEach(el => {
  let i = 0;
  const words = [];
  const walk = n => {
    for (const c of [...n.childNodes]) {
      if (c.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const part of c.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.append(' '); continue; }
          const w = document.createElement('span'); w.className = 'w'; w.textContent = part; words.push({ el: w, i: i++ }); frag.append(w);
        }
        c.replaceWith(frag);
      } else if (c.nodeType === 1 && !c.hasAttribute('data-in')) walk(c);
    }
  };
  walk(el);
  const st = i <= 4 ? .2 : .13;
  const parent = cues.find(c => c.el.contains(el));
  const b = el.dataset.out ? timeOf(el.dataset.out, true) : Infinity;
  cues.push({ el, words, st, a: timeOf(el.dataset.in), b: parent ? Math.min(b, parent.b) : b, dirty: true });
});
const meltMap = $('#meltMap'), ttl = $('#ttl');
let meltK = -1;

/* ================= the film ================= */
function render(t) {
  const beat = pulse(t);

  /* --- the bar: under the wrapper at first, then pulsing with the music, then shrinking away as the pieces leave --- */
  const gone = eio(span(t, GATHER, GATHER + .8));
  slab.style.opacity = f2(1 - gone);
  slab.style.transform = `translate(${f1(G.sx)}px,${f1(G.sy)}px) scale(${f2((1 + .018 * beat) * (1 - .35 * gone))})`;
  const gl1 = span(t, REVEAL + .2, REVEAL + 1.3), gl2 = span(t, DROP, DROP + .8);
  const gl = gl2 > 0 && gl2 < 1 ? gl2 : gl1;
  slab.style.setProperty('--gl', `${(130 - 160 * (gl > 0 && gl < 1 ? gl : 1.01)).toFixed(1)}%`);

  /* --- the pieces: each one lifts, cracks, turns over into a photo; later they all slide down into a row --- */
  pieces.forEach((pc, i) => {
    const slot = G.slots[i], t0 = PIECE(i);
    let x = slot.x, y = slot.y, s = 1, rx = 0, ry = 0, rz = 0, crack = 0;
    if (t < t0) s = 1 + .014 * beat;
    else {
      const a = span(t, t0, t0 + .5), b = span(t, t0 + .32, t0 + 1.02);
      const hump = Math.sin(Math.PI * a);
      s = 1 + .24 * hump * (1 - b * .5) + .05 * Math.sin(Math.PI * b);
      rz = (i % 2 ? 8 : -8) * hump;
      rx = 16 * hump;
      ry = 180 * eio(b);
      crack = a > .06 && a < .55 ? Math.sin((a - .06) / .49 * Math.PI) : 0;
      if (b >= 1) s = 1 + .012 * beat;
    }
    if (t >= GATHER) {
      const p = eio(span(t, GATHER + i * .07, GATHER + i * .07 + .95));
      x = lerp(slot.x, G.strip[i].x, p); y = lerp(slot.y, G.strip[i].y, p) - Math.sin(Math.PI * p) * G.ps * .4;
      s = lerp(s, G.tw / G.ps, p); ry = 180; rx = 0; rz = lerp(rz, 0, p);
      if (t > END) s *= 1 + .02 * beat;
    }
    pc.b.style.transform = `translate3d(${f1(x - G.ps / 2)}px,${f1(y - G.ps / 2)}px,0) scale(${f2(s)}) rotateX(${f1(rx)}deg) rotateZ(${f1(rz)}deg) rotateY(${f1(ry)}deg)`;
    const ck = Math.round(crack * 20);
    if (pc.ck !== ck) { pc.ck = ck; pc.crack.style.opacity = f2(crack); }
    const z = t >= t0 && t < t0 + 1.2 ? 10 : 1;
    if (pc.z !== z) { pc.z = z; pc.b.style.zIndex = z; }
    if (pc.vis !== 1) { pc.vis = 1; pc.b.style.opacity = 1; }
  });

  /* --- the box arrives once the bar is gone, floats, turns a little, and jumps on the burst --- */
  const pop = eback(span(t, GATHER + .55, GATHER + 1.5));
  box.style.opacity = t >= GATHER + .55 ? 1 : 0;
  if (t >= GATHER + .5) {
    const dt = t - GATHER, jump = t >= BURST ? .16 * Math.exp(-(t - BURST) / .3) * Math.cos((t - BURST) * 14) : 0;
    const yaw = -22 + 16 * Math.sin(dt * .7), pitch = -9 + 4 * Math.sin(dt * .5 + 1);
    boxIn.style.transform = `translateY(${f1(7 * Math.sin(dt * 1.4))}px) scale(${f2(pop * (1 + .025 * beat + jump))}) rotateX(${f1(pitch)}deg) rotateY(${f1(yaw)}deg)`;
  }

  /* --- chocolate from the top, once the wrapper is off --- */
  const dv = span(t, REVEAL - .3, REVEAL + .4), away = eio(span(t, GATHER, GATHER + 1.1));
  drips.style.opacity = f2(dv * (1 - away));
  drips.style.transform = away > 0 ? `translateY(${f1(-110 * away)}%)` : 'none';
  if (dv > 0 && away < 1) for (const d of DRIPS) {
    const grow = eo(span(t, REVEAL + d.delay, REVEAL + d.delay + d.dur));
    const s = grow * (1 + .035 * Math.sin(t * 1.1 + d.ph)) + .06 * beat * grow;
    d.el.style.setProperty('--s', f2(s));
  }

  /* --- light: a warm glow behind the bar that beats with the song --- */
  const gs = G.sw * 2.4 * (1 + .06 * beat), gx = t < GATHER + .5 ? G.cx : lerp(G.cx, G.bx, eio(span(t, GATHER + .5, GATHER + 1.5))), gy = t < GATHER + .5 ? G.cy : lerp(G.cy, G.by, eio(span(t, GATHER + .5, GATHER + 1.5)));
  glow.style.opacity = f2(t < DROP ? .35 * span(t, REVEAL, REVEAL + 1) : .5 + .5 * beat);
  glow.style.width = glow.style.height = `${f1(gs)}px`;
  glow.style.transform = `translate(${f1(gx - gs / 2)}px,${f1(gy - gs / 2)}px)`;
  flash.style.opacity = f2(t >= DROP ? (1 - span(t, DROP, DROP + .6)) ** 2 * .9 : 0);

  /* --- the title melts into place --- */
  const mk = t < TITLE ? 60 : Math.round(60 * (1 - eo(span(t, TITLE, TITLE + 2.2))));
  if (mk !== meltK) { meltK = mk; meltMap.setAttribute('scale', mk); ttl.style.filter = mk > 0 && t >= TITLE ? 'url(#melt)' : 'none'; }

  /* --- words: each one rises out of a blur, and leaves with its sentence --- */
  for (const c of cues) {
    const active = t >= c.a - .05 && t < c.b + .6;
    if (!active && !c.dirty) continue;
    c.dirty = active;
    for (const w of c.words) {
      const pin = t < c.a ? 0 : eo(span(t, c.a + w.i * c.st, c.a + w.i * c.st + .75));
      const pout = c.b === Infinity ? 0 : span(t, c.b, c.b + .45);
      const v = pin * (1 - pout);
      const key = Math.round(v * 60) * 100 + Math.round(pin * 40);
      if (w.k === key) continue;
      w.k = key;
      w.el.style.opacity = f2(v);
      w.el.style.filter = v > .985 ? 'none' : `blur(${((1 - pin) * 7 + pout * 4).toFixed(2)}px)`;
      w.el.style.transform = pin > .995 ? 'none' : `translate3d(0,${((1 - pin) * .42).toFixed(3)}em,0)`;
    }
  }
  buzz(t);
  drawFx(t);
}

/* Android lets a page vibrate after a tap: a knock for every piece, a jolt on the burst */
const canBuzz = typeof navigator.vibrate === 'function';
let buzzT = -1;
function buzz(t) {
  const prev = buzzT; buzzT = t;
  if (!canBuzz || !wantSound || mode !== 'song' || t < prev || t - prev > .3) return;
  try {
    for (let i = 0; i < 8; i++) if (prev < PIECE(i) + .1 && t >= PIECE(i) + .1) navigator.vibrate(28);
    if (prev < BURST && t >= BURST) navigator.vibrate([60, 60, 90]);
  } catch (e) {}
}

/* ================= clock ================= */
const song = $('#song');
let mode = 'wait', vt = 0, lastCT = -1, lastAt = 0, freeBase = 0, freeAt = 0, finished = false;
function clock(now) {
  if (mode === 'song') {
    const ct = song.currentTime;
    if (ct !== lastCT) { lastCT = ct; lastAt = now; }
    const est = song.paused ? ct : ct + Math.min(.25, (now - lastAt) / 1000);
    if (est > vt || vt - est > .3) vt = est;
    if (song.ended || vt >= CLIP) { mode = 'free'; freeBase = Math.max(vt, CLIP); freeAt = now; }
    return vt;
  }
  if (mode === 'free') return freeBase + (now - freeAt) / 1000;
  if (mode === 'frozen') return freeBase;
  return 0;
}
const fin = $('#fin');
function frame(now) {
  const t = clock(now);
  render(t);
  if (t >= END && !finished) { finished = true; fin.classList.add('show'); stage.classList.add('done'); }
  requestAnimationFrame(frame);
}

/* ================= sound ================= */
const SONG = 'assets/audio/shirin.mp3?v=2';
let wantSound = false;
async function loadSong() {
  for (let n = 0; n < 4; n++) {
    try {
      const r = await fetch(n ? `${SONG}&r=${n}` : SONG, { cache: 'force-cache' });
      if (!r.ok) throw new Error(r.status);
      const blob = await r.blob();
      if (blob.size < 50000) throw new Error('short');
      song.src = URL.createObjectURL(blob);
      return true;
    } catch (e) { await new Promise(r => setTimeout(r, 600 * 2 ** n)); }
  }
  song.src = SONG;             // last resort: let the browser stream it
  return false;
}
function play(from) {
  wantSound = true;
  try { if (from != null) song.currentTime = from; } catch (e) {}
  song.volume = 1;
  const p = song.play();
  mode = 'song'; vt = from || 0; lastCT = -1;
  if (p && p.catch) p.catch(() => { if (song.paused) resume.hidden = false; });   // the film waits for the song
}
/* If the song stops on its own mid-film, start it again; if the phone refuses without a tap, ask for one. */
const resume = $('#resume');
setInterval(() => {
  if (!wantSound || mode !== 'song' || finished || document.hidden) return;
  if (song.paused && !song.ended) song.play().then(() => { resume.hidden = true; }).catch(() => { resume.hidden = false; });
}, 1000);
let resumeFails = 0;
resume.addEventListener('click', () => {
  song.play().then(() => { resume.hidden = true; }).catch(() => {
    if (++resumeFails >= 2) { mode = 'free'; freeBase = vt; freeAt = performance.now(); resume.hidden = true; }
  });
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && wantSound && mode === 'song' && song.paused && !finished) song.play().catch(() => { resume.hidden = false; }); });

/* ================= gate ================= */
const msg = $('#gateMsg'), barEl = $('#gateBar');
async function prepare() {
  let done = 0;
  const total = pieces.length + 4;
  const step = () => { done++; barEl.style.width = `${Math.round(done / total * 100)}%`; };
  const photos = Promise.all(pieces.map(pc => fetchImg(pc.src).then(src => { pc.img.src = src; pc.img.classList.add('ok'); step(); })));
  const cover = fetchImg('assets/img/wrap.webp?v=2').then(step);
  const packArt = fetchImg(PACK_ART).then(step);
  const fonts = Promise.race([
    Promise.all([document.fonts.load('italic 400 20px Fraunces'), document.fonts.load('700 14px Manrope')]).catch(() => {}),
    new Promise(r => setTimeout(r, 4000))
  ]).then(step);
  const sound = loadSong().then(step);
  await Promise.all([sound, fonts, cover, packArt]);
  await Promise.race([photos, new Promise(r => setTimeout(r, 12000))]);
  barEl.style.width = '100%';
  gate.classList.add('ready');
  msg.textContent = 'Ochish uchun bosing';
  pack.disabled = false;
}
let started = false;
function openGate() {
  if (pack.disabled || started) return;
  started = true;
  play(0);
  gate.classList.add('open');
  setTimeout(() => gate.classList.add('gone'), 2300);
  pieces.forEach(pc => { const i = new Image(); i.src = pc.big; });      // the larger versions, for later
}
pack.addEventListener('click', openGate);
gate.addEventListener('click', e => { if (e.target !== pack && !pack.contains(e.target)) openGate(); });
/* a press held a little too long never becomes a click on an iPhone; lifting the finger still counts as the tap that lets sound play */
gate.addEventListener('touchend', openGate);

$('#again').addEventListener('click', () => {
  finished = false; fin.classList.remove('show'); stage.classList.remove('done');
  play(0);
});

/* ================= a closer look ================= */
const lb = $('#lb'), lbImg = lb.querySelector('img');
pieces.forEach(pc => pc.b.addEventListener('click', () => {
  if (!finished) return;
  lbImg.src = pc.img.src;
  fetchImg(pc.big).then(src => { if (!lb.hidden) lbImg.src = src; });
  lb.hidden = false; requestAnimationFrame(() => lb.classList.add('on'));
}));
lb.addEventListener('click', () => { lb.classList.remove('on'); setTimeout(() => { lb.hidden = true; }, 400); });

/* ================= a wallpaper for her phone ================= */
/* Drawn on her own phone from the photos it has already loaded: the box front and the eight pieces, sized for an iPhone screen. */
const loadImage = src => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
async function makeWallpaper() {
  const LW = 390, LH = 844, S = 3;
  const c = document.createElement('canvas'); c.width = LW * S; c.height = LH * S;
  const g = c.getContext('2d'); g.scale(S, S);
  const bg = g.createLinearGradient(0, 0, 0, LH); bg.addColorStop(0, '#fdf6ec'); bg.addColorStop(1, '#eedcc6');
  g.fillStyle = bg; g.fillRect(0, 0, LW, LH);
  const packIm = await loadImage(PACK_ART).catch(() => null);
  /* the box front, below where the lock-screen clock sits */
  const bw = 330, bh = bw / PACK_AR, bx = (LW - bw) / 2, by = 248;
  g.save(); g.shadowColor = 'rgba(40,15,5,.35)'; g.shadowBlur = 30; g.shadowOffsetY = 16; g.fillStyle = '#fff'; rrect(g, bx, by, bw, bh, 6); g.fill(); g.restore();
  g.save(); rrect(g, bx, by, bw, bh, 6); g.clip();
  g.fillStyle = '#fff'; g.fillRect(bx, by, bw, bh);
  if (packIm) g.drawImage(packIm, bx, by, bw, bh);
  g.restore();
  /* the eight pieces in a row of four, twice */
  const tw = 70, gap = 8, x0 = (LW - 4 * tw - 3 * gap) / 2, y0 = by + bh + 34;
  pieces.forEach((pc, i) => {
    const x = x0 + (i % 4) * (tw + gap), y = y0 + (i >> 2) * (tw + gap);
    g.save(); g.shadowColor = 'rgba(60,25,10,.3)'; g.shadowBlur = 10; g.shadowOffsetY = 5; g.fillStyle = '#fff8ef'; rrect(g, x, y, tw, tw, 8); g.fill(); g.restore();
    g.save(); rrect(g, x + 4, y + 4, tw - 8, tw - 8, 5); g.clip();
    if (pc.img.naturalWidth) { const r = Math.max((tw - 8) / pc.img.naturalWidth, (tw - 8) / pc.img.naturalHeight); g.drawImage(pc.img, x + 4 + ((tw - 8) - pc.img.naturalWidth * r) / 2, y + 4 + ((tw - 8) - pc.img.naturalHeight * r) * .28, pc.img.naturalWidth * r, pc.img.naturalHeight * r); }
    g.restore();
  });
  g.fillStyle = '#3b1d10'; g.font = 'italic 400 25px Fraunces, serif'; g.textAlign = 'center';
  g.fillText('Shirinlikdek shirin bo‘ling.', LW / 2, y0 + 2 * tw + gap + 44);
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('toBlob')), 'image/jpeg', .92));
}
let wpBlob = null, wpURL = null, wpJob = null;
function prepWallpaper() {
  if (!wpJob) wpJob = makeWallpaper().then(b => { wpBlob = b; wpURL = URL.createObjectURL(b); }).catch(e => { wpJob = null; throw e; });
  return wpJob;
}
const wp = $('#wp');
const keepBtn = $('#keep'), keepLabel = keepBtn.lastChild.textContent;
keepBtn.addEventListener('click', () => {
  if (!wpBlob) keepBtn.lastChild.textContent = 'Tayyorlanmoqda…';
  prepWallpaper().then(() => {
    keepBtn.lastChild.textContent = keepLabel;
    wp.querySelector('img').src = wpURL;
    wp.hidden = false; requestAnimationFrame(() => wp.classList.add('on'));
  }).catch(() => { keepBtn.lastChild.textContent = keepLabel; });
});
/* the share sheet is how an iPhone saves an image to Photos; elsewhere, a plain download */
$('#wpSave').addEventListener('click', () => {
  if (!wpBlob) return;
  const file = new File([wpBlob], 'shirinlik.jpg', { type: 'image/jpeg' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file] }).catch(() => {}); return; }
  const a = document.createElement('a'); a.href = wpURL; a.download = 'shirinlik.jpg'; document.body.appendChild(a); a.click(); a.remove();
});
$('#wpClose').addEventListener('click', () => { wp.classList.remove('on'); setTimeout(() => { wp.hidden = true; }, 400); });

/* ================= go ================= */
let rz;
addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layout, 120); });
layout();
if (AT != null) {
  gate.classList.add('gone');
  pieces.forEach(pc => fetchImg(pc.src).then(src => { pc.img.src = src; pc.img.classList.add('ok'); }));
  freeBase = AT; freeAt = performance.now(); mode = RUN ? 'free' : 'frozen';
  if (AT >= END) { finished = true; fin.classList.add('show'); stage.classList.add('done'); }
} else prepare();
requestAnimationFrame(frame);
window.__shirin = { prepWallpaper, get wpBlob() { return wpBlob; }, get G() { return G; }, get t() { return clock(performance.now()); }, get mode() { return mode; }, freeze(t) { mode = 'frozen'; freeBase = t; }, DROP, GATHER, TITLE, BURST, END, bar, beatAt };
})();
