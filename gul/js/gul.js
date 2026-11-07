/* Bir dona gul: a 45-second film that follows the song.
   Every frame is worked out from the song's own clock, so the flowers, words and photos stay on the beat
   after a stall, a pause or a replay, and a frozen moment can be rendered on its own (?at=23.4). */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const qs = new URLSearchParams(location.search);
const AT = qs.has('at') ? parseFloat(qs.get('at')) || 0 : null;     // rehearsal: no gate, no sound
const RUN = qs.has('run');                                           // with ?at, keep the clock running

/* ---- the song, measured: 82 BPM (a resting heartbeat), first beat at 0.611 s, the drop at 22.56 s ---- */
const BEAT = 0.73164835, HB = BEAT / 2, B0 = 0.611;
const beatAt = k => B0 + k * BEAT;
const bar = n => beatAt(2 + 4 * n);
const HUSH = 20.55, RISE = 21.62, LIFT = 22.15, DROP = bar(7), WHOLE = bar(8), END = 45.35;
const TOKENS = { rise: RISE, lift: LIFT, drop: DROP, never: Infinity };
const timeOf = (tok, out) => {
  if (tok in TOKENS) return TOKENS[tok];
  const m = /^b(\d+)$/.exec(tok);
  return m ? bar(+m[1]) - (out ? .32 : 0) : parseFloat(tok);
};

/* ---- little maths ---- */
const cl = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
const lerp = (a, b, p) => a + (b - a) * p;
const span = (t, a, b) => cl((t - a) / (b - a));
const eo = p => 1 - (1 - p) ** 3;
const eio = p => p < .5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
const eback = p => { const c = 1.6; return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2; };
const D2R = Math.PI / 180;
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, p) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * p)).join(',')})`; };

/* A heartbeat on every beat: lub, then a softer dub. Downbeats land harder. */
function pulse(t) {
  const k = Math.floor((t - B0) / BEAT), d = t - beatAt(k);
  const a = ((k - 2) % 4 + 4) % 4 === 0 ? 1 : .6;
  return a * (Math.exp(-d / .1) + (d > .19 ? .5 * Math.exp(-(d - .19) / .09) : 0));
}

const PAPER = '#f8f1e7', INK = '#5a4943', LEAF = '#6f8f5f', LEAF2 = '#4d6a45';

/* ================= svg: the rose and the row of flowers ================= */
const NS = 'http://www.w3.org/2000/svg';
const mk = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const ell = (cx, cy, rx, ry, deg = 0) => {
  const a = deg * D2R, dx = rx * Math.cos(a), dy = rx * Math.sin(a);
  return `M${cx - dx} ${cy - dy}A${rx} ${ry} ${deg} 1 0 ${cx + dx} ${cy + dy}A${rx} ${ry} ${deg} 1 0 ${cx - dx} ${cy - dy}Z`;
};

const svg = $('#ink');
const defs = mk('defs', {}, svg);
const PETAL_STOPS = [[0, '#6c0f27'], [.3, '#a2203f'], [.62, '#d24a67'], [.86, '#ef8ea2'], [1, '#f9c6ce']];
const petalGrad = mk('radialGradient', { id: 'pg', gradientUnits: 'userSpaceOnUse', cx: 0, cy: 0, r: 52 }, defs);
const petalStops = PETAL_STOPS.map(([o, c]) => mk('stop', { offset: o, 'stop-color': PAPER }, petalGrad));
const leafGrad = mk('linearGradient', { id: 'lg', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
const leafStops = [[0, LEAF], [1, LEAF2]].map(([o]) => mk('stop', { offset: o, 'stop-color': PAPER }, leafGrad));

const rowG = mk('g', {}, svg);
const roseAll = mk('g', {}, svg);
const stem = mk('path', { fill: 'none', stroke: INK, 'stroke-width': 1.7, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1' }, roseAll);
const LEAF_D = 'M0 0C9 -13 30 -17 48 -5C31 6 12 7 0 0Z', RIB_D = 'M2 -1C16 -6 30 -7 45 -5';
const leaves = [1, -1].map(side => {
  const g = mk('g', {}, roseAll);
  mk('path', { d: LEAF_D, fill: 'url(#lg)', stroke: INK, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }, g);
  mk('path', { d: RIB_D, fill: 'none', stroke: INK, 'stroke-width': .8, opacity: .7 }, g);
  return { g, side };
});

/* The rose is seen from a little above: five rings of petals, opened ring by ring. Local radius is 50. */
const RINGS = [
  { n: 3, r0: 0, r1: 13, rot: 10 }, { n: 4, r0: 3, r1: 21, rot: 55 }, { n: 5, r0: 6, r1: 30, rot: 20 },
  { n: 6, r0: 10, r1: 40, rot: 47 }, { n: 7, r0: 14, r1: 50, rot: 4 }
];
const head = mk('g', {}, svg);
const sepals = mk('g', {}, head);
for (let i = 0; i < 5; i++) {
  const g = mk('g', { transform: `rotate(${i * 72 + 36})` }, sepals);
  mk('path', { d: 'M-9 0C-12 22 -6 44 0 60C6 44 12 22 9 0Z', fill: 'url(#lg)', stroke: INK, 'stroke-width': 1 }, g);
}
const petalD = (r0, r1, hw) =>
  `M0 ${r0}C${-hw * .6} ${r0 + (r1 - r0) * .15} ${-hw * 1.05} ${r1 * .55} ${-hw * .9} ${r1 * .8}` +
  `C${-hw * .7} ${r1} ${-hw * .25} ${r1 * 1.04} 0 ${r1 * .97}C${hw * .25} ${r1 * 1.04} ${hw * .7} ${r1} ${hw * .9} ${r1 * .8}` +
  `C${hw * 1.05} ${r1 * .55} ${hw * .6} ${r0 + (r1 - r0) * .15} 0 ${r0}Z`;
const lipD = (r1, hw) => `M${-hw * .86} ${r1 * .8}C${-hw * .66} ${r1 * .98} ${-hw * .24} ${r1 * 1.02} 0 ${r1 * .95}C${hw * .24} ${r1 * 1.02} ${hw * .66} ${r1 * .98} ${hw * .86} ${r1 * .8}`;
const ringEls = [];
const lips = [];
for (let i = RINGS.length - 1; i >= 0; i--) {
  const R = RINGS[i], g = mk('g', {}, head), hw = R.r1 * Math.sin(Math.PI / R.n) * 1.28;
  for (let k = 0; k < R.n; k++) {
    const p = mk('g', { transform: `rotate(${k * 360 / R.n})` }, g);
    mk('path', { d: petalD(R.r0, R.r1, hw), fill: 'url(#pg)', stroke: '#5a1a2a', 'stroke-width': 1.05, 'stroke-linejoin': 'round' }, p);
    lips.push(mk('path', { d: lipD(R.r1, hw), fill: 'none', stroke: '#ffdbe1', 'stroke-width': 1.5, 'stroke-linecap': 'round', opacity: 0 }, p));
  }
  ringEls[i] = g;
}
mk('path', { d: 'M0 0C3 -2 4 2 1 4C-3 6 -6 1 -4 -3C-1 -8 7 -7 8 0C9 7 1 11 -5 9', fill: 'none', stroke: '#4a0f20', 'stroke-width': 1.3, 'stroke-linecap': 'round' }, head);

/* Until it opens, the rose is a bud seen from the side, in the same ink as the row. */
const BUD_COL = '#e98a9c';
const bud = mk('g', {}, svg);
const budParts = [
  { d: 'M0 18C-10 16 -22 8 -27 -6C-17 0 -8 4 -2 6Z', fill: LEAF },
  { d: 'M0 18C10 16 22 8 27 -6C17 0 8 4 2 6Z', fill: LEAF },
  { d: 'M0 18C-20 14 -24 -10 -12 -28C-7 -36 -2 -40 0 -42C2 -40 7 -36 12 -28C24 -10 20 14 0 18Z', fill: BUD_COL },
  { d: 'M-12 -28C-4 -18 1 -2 0 16' }, { d: 'M12 -28C10 -18 9 -6 10 8' }, { d: 'M-4 -37C0 -31 4 -29 9 -29' },
  { d: 'M0 18C-5 10 -4 1 0 -7C4 1 5 10 0 18Z', fill: LEAF }
].map(p => ({ ...p, e: mk('path', { d: p.d, fill: p.fill ? PAPER : 'none', stroke: INK, 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }, bud) }));

/* The row: every flower she has been given before, drawn in ink. Base at 0,0; about 100 tall. */
const FLOWERS = {
  tulip: () => [
    { d: 'M0 0C2 -26 -3 -50 0 -70', w: 1.4, stem: 1 },
    { d: 'M0 -6C14 -22 17 -44 9 -64C5 -46 2 -28 0 -16Z', fill: LEAF },
    { d: 'M-11 -68C-14 -80 -11 -91 -6 -97L-2.5 -87L0 -99L2.5 -87L6 -97C11 -91 14 -80 11 -68C7 -63 -7 -63 -11 -68Z', fill: '#ef8a6b' },
    { d: 'M-2.5 -87C-3 -79 -2 -72 0 -66M2.5 -87C3 -79 2 -72 0 -66', w: .9 }
  ],
  daisy: () => {
    const out = [{ d: 'M0 0C-3 -28 3 -54 0 -78', w: 1.4, stem: 1 }, { d: 'M0 -20C-10 -26 -16 -36 -15 -46C-8 -39 -3 -31 0 -27Z', fill: LEAF }];
    for (let i = 0; i < 12; i++) { const a = i * 30, r = 9.5; out.push({ d: ell(Math.sin(a * D2R) * r, -84 - Math.cos(a * D2R) * r, 3, 7.6, a + 90), fill: '#fffdf7', w: .9 }); }
    out.push({ d: ell(0, -84, 4.6, 4.6), fill: '#efbd45', w: .9 });
    return out;
  },
  lavender: () => {
    const out = [{ d: 'M0 0C1 -34 -1 -66 0 -100', w: 1.3, stem: 1 }, { d: 'M0 -14C-4 -30 -6 -46 -5 -60C-2 -45 0 -31 1 -21Z', fill: LEAF }];
    for (let i = 0; i < 10; i++) { const s = i % 2 ? 1 : -1; out.push({ d: ell(s * 2.5, -60 - i * 4.3, 2.3, 3.7, s * 28), fill: '#a08ad3', w: .8 }); }
    out.push({ d: ell(0, -104, 1.9, 3.3), fill: '#a08ad3', w: .8 });
    return out;
  },
  bells: () => {
    const out = [{ d: 'M0 0C0 -40 6 -70 22 -80', w: 1.3, stem: 1 }, { d: 'M0 -2C-16 -24 -18 -52 -8 -76C-4 -52 -2 -28 2 -12Z', fill: LEAF }];
    for (const [x, y] of [[5, -60], [11, -70], [19, -78]]) {
      out.push({ d: `M${x} ${y}L${x} ${y + 5}`, w: .9 });
      out.push({ d: `M${x - 4.6} ${y + 12}C${x - 5} ${y + 4} ${x + 5} ${y + 4} ${x + 4.6} ${y + 12}L${x + 5.6} ${y + 14}L${x + 2} ${y + 13}L${x} ${y + 15}L${x - 2} ${y + 13}L${x - 5.6} ${y + 14}Z`, fill: '#9fc0ea', w: .9 });
    }
    return out;
  },
  carnation: () => {
    let d = 'M-3 -85';
    for (let i = 0; i <= 16; i++) { const a = (200 + i * 140 / 16) * D2R, r = i % 2 ? 14 : 10.5; d += `L${(Math.cos(a) * r).toFixed(2)} ${(-90 + Math.sin(a) * r).toFixed(2)}`; }
    d += 'L3 -85Z';
    return [
      { d: 'M0 0C2 -28 -2 -52 0 -76', w: 1.4, stem: 1 },
      { d: 'M0 -18C8 -26 14 -34 19 -46C10 -39 5 -33 0 -29Z', fill: LEAF },
      { d: 'M-3.6 -76L-3 -86L3 -86L3.6 -76Z', fill: LEAF },
      { d, fill: '#ec7e98', w: .9 },
      { d: 'M-6 -92L-3 -96L0 -92L3 -97L6 -92', w: .8 }
    ];
  },
  breath: () => {
    const out = [{ d: 'M0 0C0 -30 0 -50 0 -62M0 -50C-6 -60 -12 -70 -15 -80M0 -56C-2 -68 -5 -80 -6 -90M0 -62C3 -72 5 -84 6 -94M0 -54C6 -62 11 -70 15 -78M0 -60C1 -68 1 -74 0 -82', w: 1.1, stem: 1 }];
    for (const [x, y] of [[-15, -80], [-6, -90], [6, -94], [15, -78], [0, -82]])
      for (const [dx, dy] of [[0, 0], [-2.6, -2.4], [2.6, -2.2]]) out.push({ d: ell(x + dx, y + dy, 2.3, 2.3), fill: '#fffaf3', w: .7 });
    return out;
  },
  bud: () => [
    { d: 'M0 0C-2 -26 2 -52 0 -72', w: 1.4, stem: 1 },
    { d: 'M0 -30C10 -34 18 -42 20 -53C12 -48 6 -42 0 -38Z', fill: LEAF },
    { d: 'M0 -70C-9 -75 -9 -90 0 -97C9 -90 9 -75 0 -70Z', fill: '#e0607e' },
    { d: 'M0 -97C-3 -88 -2 -80 2 -74', w: .8 },
    { d: 'M0 -70C-6 -72 -9 -78 -10 -83C-5 -79 -2 -77 0 -76ZM0 -70C6 -72 9 -78 10 -83C5 -79 2 -77 0 -76Z', fill: LEAF }
  ],
  cosmos: () => {
    const out = [{ d: 'M0 0C3 -30 -3 -58 0 -80', w: 1.3, stem: 1 }, { d: 'M0 -24C-8 -30 -12 -36 -14 -45M-4 -27L-9 -25M-8 -32L-13 -31', w: 1 }];
    for (let i = 0; i < 8; i++) { const a = i * 45 + 20, r = 8.5; out.push({ d: ell(Math.sin(a * D2R) * r, -86 - Math.cos(a * D2R) * r, 4.8, 8, a + 90), fill: '#f2a4c3', w: .9 }); }
    out.push({ d: ell(0, -86, 3.8, 3.8), fill: '#d39b35', w: .9 });
    return out;
  }
};
const ROW_LEFT = ['daisy', 'tulip', 'lavender', 'bells', 'breath', 'cosmos'];
const ROW_RIGHT = ['carnation', 'bud', 'cosmos', 'tulip', 'daisy', 'lavender'];
const HEIGHTS = [.86, 1, .8, .94, .78, .9];

/* ================= layout ================= */
let W = 0, H = 0, G = { row: [], slots: [] };
const heartEl = $('#heart'), stage = $('#stage'), glow = $('#glow'), flash = $('#flash');

const heartXY = th => [16 * Math.sin(th) ** 3, -(13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th))];

function layout() {
  W = innerWidth; H = innerHeight;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const m = Math.min(W, H);
  const ground = H - Math.max(14, H * .035);
  const rowH = cl(H * .16, 86, 165);
  const R = cl(m * .155, 46, 96);
  const headY = H * .5;
  const sayTop = Math.max(H * .075, 26);

  /* the rose's stem in screen space */
  const L = ground - headY;
  stem.setAttribute('d', `M${W / 2} ${ground}C${W / 2 - L * .05} ${ground - L * .35} ${W / 2 + L * .07} ${ground - L * .68} ${W / 2} ${headY + R * .35}`);
  const leafAt = [[.3, 1], [.46, -1]].map(([f, side]) => [W / 2 + (side > 0 ? 2 : -2), ground - L * f]);
  const leafScale = cl(R / 62, .75, 1.4);
  leaves.forEach((lf, i) => { lf.x = leafAt[i][0]; lf.y = leafAt[i][1]; lf.s = leafScale; });

  /* the row */
  rowG.textContent = '';
  const perSide = cl(Math.floor((W / 2 - R * .6) / (rowH * .34)), 2, 6);
  const gap = Math.max(R * .66, rowH * .3), reach = W / 2 - Math.max(26, rowH * .22);
  const row = [];
  for (let s of [-1, 1]) for (let j = 0; j < perSide; j++) {
    const name = (s < 0 ? ROW_LEFT : ROW_RIGHT)[j];
    const x = W / 2 + s * (gap + (perSide === 1 ? 0 : j * (reach - gap) / (perSide - 1)));
    const k = rowH * HEIGHTS[(j + (s > 0 ? 3 : 0)) % HEIGHTS.length] / 100;
    const g = mk('g', {}, rowG);
    const parts = FLOWERS[name]().map(p => {
      const e = mk('path', { d: p.d, fill: p.fill ? PAPER : 'none', stroke: INK, 'stroke-width': (p.w || 1) / Math.sqrt(k), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1, 'stroke-dasharray': '1 1', 'stroke-dashoffset': 1 }, g);
      return { e, fill: p.fill, stem: p.stem };
    });
    row.push({ g, parts, x, k, side: s, j, dist: j });
  }
  /* sprout order: nearest the rose first, alternating sides */
  row.sort((a, b) => a.j - b.j || a.side - b.side).forEach((f, q) => { f.q = q; });

  /* the heart of photos */
  const N = 600, pts = [], cum = [0];
  for (let i = 0; i <= N; i++) { pts.push(heartXY(Math.PI * i / N)); if (i) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); }
  const half = cum[N], step = half / 8;
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  const tileU = step * .98, tileHU = tileU * 1.17;
  const availH = H * (W > H ? .6 : .52);
  const u = Math.min((W - 30) / (32 + tileU), availH / (maxY - minY + tileHU));
  const top = Math.max(H * (W > H ? .05 : .1), 22);
  const hx = W / 2, hy = top + (tileHU / 2 - minY) * u;
  const slots = [];
  for (let k = 0; k < 8; k++) {
    const s = (k + .5) * step;
    let i = 1; while (cum[i] < s) i++;
    const f = (s - cum[i - 1]) / (cum[i] - cum[i - 1]);
    const x = lerp(pts[i - 1][0], pts[i][0], f), y = lerp(pts[i - 1][1], pts[i][1], f);
    const ang = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]) / D2R;
    for (const side of [-1, 1]) slots.push({ x: hx + side * x * u, y: hy + y * u, rot: side * (ang - 90) * .14 + side * (k % 2 ? 3 : -2.5), k, side });
  }
  const tile = tileU * u;
  heartEl.style.setProperty('--tw', `${tile.toFixed(1)}px`);
  heartEl.style.transformOrigin = `${hx}px ${hy + 2.5 * u}px`;
  const outline = [];
  for (let i = 0; i < 48; i++) { const [x, y] = heartXY(i / 48 * Math.PI * 2); outline.push([hx + x * u, hy + y * u]); }

  const heartBottom = hy + (maxY + tileHU / 2) * u;
  stage.style.setProperty('--sayTop', `${sayTop}px`);
  stage.style.setProperty('--sayLow', `${heartBottom + Math.max(16, H * .025)}px`);
  stage.style.setProperty('--finTop', `${heartBottom + Math.max(16, H * .025) + 54}px`);

  G = { ground, rowH, R, headY, row, slots, tile, u, hx, hy, rose: [hx, hy + 2.5 * u], roseR: 5.4 * u, outline, m };
  fxSize();
  seedParticles();
}

/* ================= photos ================= */
const PHOTOS = [   // name, object-position: faces stay in the square crop
  ['hero', '50% 28%'], ['portrait', '50% 30%'], ['eighteen', '50% 22%'], ['closeup', '50% 40%'],
  ['flowers', '50% 8%'], ['balloons', '30% 62%'], ['cafe', '50% 40%'], ['shades', '50% 30%'],
  ['eclair', '50% 24%'], ['headphones', '50% 40%'], ['bite', '50% 28%'], ['selfie', '42% 50%'],
  ['kart', '55% 42%'], ['suit', '50% 40%'], ['cover', '50% 30%'], ['ridge', '50% 45%']
];
const tiles = PHOTOS.map(([name, pos], i) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'ph'; b.setAttribute('aria-label', 'Rasmni kattalashtirish');
  const img = new Image(); img.alt = ''; img.decoding = 'async'; img.style.objectPosition = pos;
  b.appendChild(img); heartEl.appendChild(b);
  b.style.zIndex = i;
  return { b, img, name, src: `../assets/img/thumb/${name}.webp`, big: `../assets/img/${name}-800.webp`, spin: (i % 2 ? 1 : -1) * (120 + (i * 37) % 140) };
});

/* An image is only handed to a tile once it has really arrived; until then it keeps trying, quietly. */
function fetchImg(src, n = 0) {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()).then(() => res(im.src));
    im.onerror = () => setTimeout(() => fetchImg(src, n + 1).then(res), Math.min(4000, 400 * 2 ** n));
    im.src = n ? `${src}${src.includes('?') ? '&' : '?'}r=${n}` : src;
  });
}

/* ================= canvas: petals and sparks ================= */
const cv = $('#fx'), cx = cv.getContext('2d');
let DPR = 1;
function fxSize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
}
const PETAL_COLS = ['#c2314f', '#d9496a', '#e8708b', '#f29bb0', '#a61f3d', '#f7c1cb', '#e35d79'];
let bursts = [], ambient = [], sparks = [];
function seedParticles() {
  const r = mulberry(18), sc = G.m / 420;
  const burst = (t0, n, speed, size) => Array.from({ length: n }, () => {
    const a = r() * Math.PI * 2, v = (speed[0] + r() * (speed[1] - speed[0])) * sc;
    return { t0, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120 * sc, s: (size[0] + r() * (size[1] - size[0])) * Math.max(.8, sc),
      a0: r() * 6.3, spin: (r() - .5) * 9, flip: 2 + r() * 5, ph: r() * 6.3, wob: 8 + r() * 22, col: PETAL_COLS[(r() * PETAL_COLS.length) | 0], life: 3.2 + r() * 1.6 };
  });
  bursts = [...burst(DROP, 170, [380, 1150], [5, 11]), ...burst(WHOLE, 70, [200, 620], [4, 8])];
  ambient = Array.from({ length: 22 }, () => ({ x: r(), off: r(), vy: (34 + r() * 40) * Math.max(.8, sc), s: (4 + r() * 6) * Math.max(.8, sc),
    a0: r() * 6.3, spin: (r() - .5) * 2, flip: 1 + r() * 2.5, ph: r() * 6.3, wob: 14 + r() * 26, col: PETAL_COLS[(r() * PETAL_COLS.length) | 0] }));
  sparks = [];
  G.slots.forEach((s, i) => { const land = landOf(i); for (let k = 0; k < 7; k++) sparks.push({ t0: land, x: s.x, y: s.y, a: r() * 6.3, d: (16 + r() * 20) * sc, gold: r() < .6 }); });
  G.outline.forEach(([x, y], i) => sparks.push({ t0: WHOLE + (i % 6) * .02, x, y, a: r() * 6.3, d: (10 + r() * 26) * sc, gold: true, big: 1 }));
}
function petal(x, y, s, a, flip, col, alpha) {
  cx.save(); cx.translate(x, y); cx.rotate(a); cx.scale(1, .18 + .82 * Math.abs(Math.cos(flip)));
  cx.globalAlpha = alpha; cx.fillStyle = col;
  cx.beginPath(); cx.moveTo(0, -s); cx.bezierCurveTo(s * .95, -s * .55, s * .7, s * .85, 0, s); cx.bezierCurveTo(-s * .7, s * .85, -s * .95, -s * .55, 0, -s); cx.fill();
  cx.globalAlpha = alpha * .35; cx.fillStyle = '#fff'; cx.beginPath(); cx.ellipse(-s * .2, -s * .25, s * .18, s * .45, -.3, 0, 6.3); cx.fill();
  cx.restore();
}
function drawFx(t) {
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  cx.clearRect(0, 0, W, H);
  const [ox, oy] = G.rose;
  const K = 2.3, g = 270 * G.m / 420;
  for (const p of bursts) {
    const dt = t - p.t0; if (dt < 0 || dt > p.life + 1) continue;
    const e = (1 - Math.exp(-K * dt)) / K;
    const x = ox + p.vx * e + Math.sin(dt * 2.2 + p.ph) * p.wob * (1 - Math.exp(-dt));
    const y = oy + p.vy * e + g * (dt / K - e / K);
    if (y > H + 30) continue;
    petal(x, y, p.s, p.a0 + p.spin * dt, p.ph + p.flip * dt, p.col, cl((p.life + 1 - dt)) * cl(dt * 12));
  }
  if (t > WHOLE) {
    const tt = t - WHOLE, fade = cl(tt / 2) * (t > END ? .75 : 1);
    for (const p of ambient) {
      const y = ((p.off * (H + 60) + tt * p.vy) % (H + 60)) - 30;
      const x = p.x * W + Math.sin(tt * .9 + p.ph) * p.wob;
      petal(x, y, p.s, p.a0 + p.spin * tt, p.ph + p.flip * tt, p.col, .85 * fade);
    }
  }
  for (const s of sparks) {
    const dt = t - s.t0; if (dt < 0 || dt > .75) continue;
    const p = dt / .75, x = s.x + Math.cos(s.a) * s.d * eo(p), y = s.y + Math.sin(s.a) * s.d * eo(p), r = (s.big ? 2.6 : 1.9) * (1 - p) + .4;
    cx.globalAlpha = (1 - p) ** 1.3; cx.fillStyle = s.gold ? '#e2ac4f' : '#fff';
    cx.beginPath(); cx.moveTo(x, y - r * 2.4); cx.lineTo(x + r * .6, y); cx.lineTo(x, y + r * 2.4); cx.lineTo(x - r * .6, y); cx.closePath(); cx.fill();
    cx.beginPath(); cx.moveTo(x - r * 2.4, y); cx.lineTo(x, y + r * .6); cx.lineTo(x + r * 2.4, y); cx.lineTo(x, y - r * .6); cx.closePath(); cx.fill();
  }
  cx.globalAlpha = 1;
}

/* ================= the film ================= */
const landOf = i => DROP + (Math.floor(i / 2) + 1) * HB;   // pairs land on every half beat; the last pair closes the heart on the downbeat

function setRingOpen(o, color) {
  RINGS.forEach((R, i) => {
    const oi = eio(cl(o * 1.25 - (RINGS.length - 1 - i) * .06 - i * .02));
    const closed = (5 + i * 3.4) / R.r1;
    const s = lerp(closed, 1, oi);
    ringEls[i].setAttribute('transform', `rotate(${(R.rot + (1 - oi) * 38).toFixed(2)}) scale(${s.toFixed(4)})`);
  });
  PETAL_STOPS.forEach(([, c], i) => petalStops[i].setAttribute('stop-color', mix(PAPER, c, color)));
  [LEAF, LEAF2].forEach((c, i) => leafStops[i].setAttribute('stop-color', mix(PAPER, c, color)));
  const lo = (color * .6).toFixed(3);
  for (const l of lips) l.setAttribute('opacity', lo);
}

let lastTiles = -1;
function render(t) {
  const { ground, rowH, R, headY, row } = G;
  const still = t >= HUSH && t < RISE;                       // the song goes silent: so does everything else
  const swayAmp = still ? 0 : t < RISE ? 1 : t > WHOLE ? .8 : 0;
  const sway = (ph, a) => Math.sin((t - B0) / (2 * BEAT) * Math.PI * 2 + ph) * a * swayAmp;

  /* --- the rose: stem draws in, a bud, it opens on four beats, then steps down into the row --- */
  const stemP = eio(span(t, .55, 2.05));
  stem.setAttribute('stroke-dashoffset', (1 - stemP).toFixed(4));
  stem.setAttribute('visibility', stemP > 0 ? 'visible' : 'hidden');
  const color = eo(span(t, bar(4), bar(4) + 1.9));
  stem.setAttribute('stroke', mix('#5a4943', '#55744b', color));
  const shrink = eio(span(t, bar(5), beatAt(24)));
  const sRow = (rowH * 1.02) / (ground - headY + R * .5);
  const s = lerp(1, sRow, shrink);
  const lifting = span(t, RISE, DROP - .05);
  const stemFade = 1 - span(t, RISE, RISE + .5);
  roseAll.setAttribute('transform', `translate(${W / 2} ${ground}) rotate(${sway(0, 1.4)}) scale(${s.toFixed(4)}) translate(${-W / 2} ${-ground})`);
  roseAll.setAttribute('opacity', (t < DROP ? stemFade : 0).toFixed(3));
  leaves.forEach((lf, i) => {
    const p = eback(span(t, 1.15 + i * BEAT, 1.15 + i * BEAT + .8));
    lf.g.setAttribute('transform', `translate(${lf.x} ${lf.y}) scale(${lf.side * lf.s * p} ${lf.s * p}) rotate(${-24 + sway(i, 3)})`);
  });

  /* where the head sits: top of the (scaled) stem, then lifted into the heart */
  const topX = W / 2, topY = ground - (ground - headY) * s;
  let hx = topX, hy = topY, hr = R * s;
  if (t >= RISE) {
    const p = eio(lifting);
    hx = lerp(topX, G.rose[0], p); hy = lerp(topY, G.rose[1], p); hr = lerp(R * s, G.roseR, p);
  }
  /* the bud: drawn in ink on the first bar, swells and blushes on the fourth, hands over to the open rose on the fifth */
  const budDraw = eio(span(t, 1.8, 2.9));
  const budBlush = .5 * eo(span(t, bar(3), bar(4)));
  const budSwell = 1 + .14 * eio(span(t, bar(3), bar(4))) + (t >= bar(3) && t < bar(4) ? .035 * pulse(t) : 0);
  const budOp = 1 - span(t, bar(4), bar(4) + .45);
  bud.setAttribute('opacity', t < 1.8 ? 0 : budOp.toFixed(3));
  if (budOp > 0) {
    bud.setAttribute('transform', `translate(${hx.toFixed(2)} ${hy.toFixed(2)}) rotate(${sway(0, 1.4).toFixed(2)}) scale(${(hr / 50 * .72 * budSwell).toFixed(4)})`);
    for (const p of budParts) {
      p.e.setAttribute('stroke-dashoffset', (1 - budDraw).toFixed(4));
      if (p.fill) { p.e.setAttribute('fill', p.fill === BUD_COL ? mix(PAPER, BUD_COL, budBlush) : mix(PAPER, p.fill, budBlush * .8)); p.e.setAttribute('fill-opacity', cl(budDraw * 1.6 - .5).toFixed(3)); }
    }
  }
  const budIn = eo(span(t, bar(4) - .05, bar(4) + .4));
  const open = t < bar(4) ? 0 : [0, 1, 2, 3].reduce((acc, k) => acc + .25 * eo(span(t, beatAt(18 + k), beatAt(18 + k) + .55)), 0);
  setRingOpen(open, color);
  let punch = 1;
  if (t >= DROP) punch += .32 * Math.exp(-(t - DROP) / .16) + .22 * Math.exp(-Math.max(0, t - WHOLE) / .2) * (t >= WHOLE ? 1 : 0) + .05 * pulse(t);
  const squash = lerp(1.22, .86, eo(cl(open * 1.3)));
  const spin = t > DROP ? (t - DROP) * 5 : 0;
  const hs = hr / 50 * lerp(.7, 1, budIn) * punch;
  head.setAttribute('transform', `translate(${hx.toFixed(2)} ${hy.toFixed(2)}) rotate(${(sway(0, 1.4) * .5).toFixed(2)}) scale(${hs.toFixed(4)} ${(hs * squash).toFixed(4)}) rotate(${spin.toFixed(2)})`);
  sepals.setAttribute('transform', `scale(${lerp(.3, 1, eo(cl((open - .35) / .65)))})`);
  head.setAttribute('opacity', budIn.toFixed(3));

  /* --- the row of flowers: sprouts in on half beats, gets its colour when the rose joins, bows before the drop --- */
  const back = t >= WHOLE ? eo(span(t, WHOLE + .2, WHOLE + 1.6)) : 0;
  for (const f of row) {
    const st = bar(1) + f.q * HB;
    const draw = eio(span(t, st, st + 1.1));
    const c = t >= WHOLE ? 1 : eo(span(t, beatAt(24) + .25 + f.j * .28, beatAt(24) + 1.05 + f.j * .28));
    const bow = t >= WHOLE ? 0 : eio(lifting);
    const vis = t < RISE ? 1 : t < WHOLE ? 1 - bow : back;
    const grow = t >= WHOLE ? lerp(.6, 1, back) : 1;
    f.g.setAttribute('transform', `translate(${f.x} ${ground}) rotate(${(sway(f.x * .01, 2.4) + f.side * 14 * bow).toFixed(2)}) scale(${(f.k * grow).toFixed(4)})`);
    f.g.setAttribute('opacity', (draw <= 0 && t < WHOLE ? 0 : vis * (t >= WHOLE ? .92 : 1)).toFixed(3));   // round caps would leave dots before the ink starts
    const shown = t >= WHOLE ? 1 : draw;
    for (const p of f.parts) {
      p.e.setAttribute('stroke-dashoffset', (1 - shown).toFixed(4));
      if (p.fill) { p.e.setAttribute('fill', mix(PAPER, p.fill, c)); p.e.setAttribute('fill-opacity', cl(shown * 1.6 - .5).toFixed(3)); }
      if (p.stem) p.e.setAttribute('stroke', mix('#5a4943', '#55744b', c));
    }
  }

  /* --- the room: dusk in the silence, a flash on the drop, a glow that beats behind the heart --- */
  const dusk = t < HUSH ? 0 : t < DROP ? lerp(.22, .62, span(t, RISE, DROP)) * span(t, HUSH, HUSH + .6) : .0;
  stage.style.setProperty('--dusk', dusk.toFixed(3));
  const fl = t >= DROP ? (1 - span(t, DROP, DROP + .7)) ** 2 * .92 : 0;
  flash.style.opacity = fl.toFixed(3);
  const beatNow = t >= DROP ? pulse(t) : 0;
  const gl = t >= RISE ? (t < DROP ? .25 + .75 * lifting : .55 + .35 * beatNow) : 0;
  const gs = (G.u * 34) * (1 + .06 * beatNow) * (t < DROP ? lerp(.4, 1, lifting) : 1);
  glow.style.opacity = gl.toFixed(3);
  glow.style.transform = `translate(${(G.rose[0] - gs / 2).toFixed(1)}px,${(G.rose[1] - gs / 2).toFixed(1)}px)`;
  glow.style.width = glow.style.height = `${gs.toFixed(1)}px`;

  /* --- the heart: photos leave the rose in pairs, one pair every half beat, and close on the downbeat --- */
  const hb = t >= DROP ? 1 + (t >= WHOLE ? .045 : .018) * pulse(t) : 1;
  heartEl.style.transform = `scale(${hb.toFixed(4)})`;
  let landed = 0;
  tiles.forEach((tl, i) => {
    const slot = G.slots[i], land = landOf(i), launch = Math.max(DROP, land - .62);
    if (t < launch) {
      /* a few seconds early they are painted once, invisibly, inside the rose, so the drop never waits for a decode */
      const warm = t > HUSH - 1.5 ? 2 : 0;
      if (tl.vis !== warm) {
        tl.vis = warm; tl.b.style.opacity = warm ? .001 : 0;
        tl.b.style.transform = `translate3d(${(G.rose[0] - G.tile / 2).toFixed(1)}px,${(G.rose[1] - G.tile * 1.17 / 2).toFixed(1)}px,0) scale(.15)`;
      }
      return;
    }
    const p = span(t, launch, land);
    if (p >= 1) landed++;
    const [sx, sy] = G.rose;
    const x = lerp(sx, slot.x, eo(p)), y = lerp(sy, slot.y, eo(p)) - Math.sin(Math.PI * p) * G.u * 4;
    const sc = lerp(.15, 1, eback(p)), rot = lerp(tl.spin, slot.rot, eo(p));
    tl.b.style.transform = `translate3d(${(x - G.tile / 2).toFixed(1)}px,${(y - G.tile * 1.17 / 2).toFixed(1)}px,0) rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(3)})`;
    if (tl.vis !== 1) { tl.b.style.opacity = 1; tl.vis = 1; }
  });
  if (landed !== lastTiles) { lastTiles = landed; }

  /* --- words --- */
  for (const c of cues) {
    const on = t >= c.a && t < c.b;
    if (on !== c.on) { c.on = on; c.el.classList.toggle('on', on); }
  }
  drawFx(t);
}

/* words arrive one by one, a sixteenth or an eighth apart */
const cues = [];
document.querySelectorAll('[data-in]').forEach(el => {
  let i = 0;
  const walk = n => {
    for (const c of [...n.childNodes]) {
      if (c.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const part of c.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.append(' '); continue; }
          const w = document.createElement('span'); w.className = 'w'; w.textContent = part; w.style.setProperty('--i', i++); frag.append(w);
        }
        c.replaceWith(frag);
      } else if (c.nodeType === 1 && !c.hasAttribute('data-in')) walk(c);
    }
  };
  walk(el);
  el.style.setProperty('--st', `${i <= 5 ? HB : i <= 8 ? HB / 2 : HB / 4}s`);
  /* a part of a sentence leaves with its sentence */
  const parent = cues.find(c => c.el.contains(el));
  const b = el.dataset.out ? timeOf(el.dataset.out, true) : Infinity;
  cues.push({ el, a: timeOf(el.dataset.in), b: parent ? Math.min(b, parent.b) : b, on: false });
});

/* ================= the day counter: the real flower wilts, this one keeps count ================= */
let day = 1;
try {
  const k = 'gul-ochilgan', first = localStorage.getItem(k);
  if (first) day = Math.max(1, Math.floor((Date.now() - +first) / 864e5) + 1);
  else localStorage.setItem(k, String(Date.now()));
} catch (e) { /* private mode: it is simply day one */ }
$('#count').querySelectorAll('.w').forEach((w, i, all) => { if (i === all.length - 1) w.textContent = `${day}-kun`; });
if (day > 1) $('#tagKicker').textContent = 'Bu gul hali ham so‘limagan';

/* ================= clock ================= */
const song = $('#song');
let mode = 'wait', vt = 0, lastCT = -1, lastAt = 0, freeBase = 0, freeAt = 0, finished = false;
function clock(now) {
  if (mode === 'song') {
    const ct = song.currentTime;
    if (ct !== lastCT) { lastCT = ct; lastAt = now; }
    const est = song.paused ? ct : ct + Math.min(.25, (now - lastAt) / 1000);
    if (est > vt || vt - est > .3) vt = est;
    if (song.ended || vt >= END) { mode = 'free'; freeBase = Math.max(vt, END); freeAt = now; }
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
const SONG = 'assets/audio/telbalarcha.mp3?v=1';
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
  if (p && p.catch) p.catch(() => { if (song.paused) { mode = 'free'; freeBase = vt; freeAt = performance.now(); } });
}
/* If the song stops on its own mid-film, start it again; if the phone refuses without a tap, ask for one. */
const resume = $('#resume');
setInterval(() => {
  if (!wantSound || mode !== 'song' || finished || document.hidden) return;
  if (song.paused && !song.ended) song.play().then(() => { resume.hidden = true; }).catch(() => { resume.hidden = false; });
}, 1000);
resume.addEventListener('click', () => { song.play().then(() => { resume.hidden = true; }).catch(() => {}); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && wantSound && mode === 'song' && song.paused && !finished) song.play().catch(() => { resume.hidden = false; }); });

/* ================= gate ================= */
const gate = $('#gate'), bow = $('#bow'), msg = $('#gateMsg'), barEl = $('#gateBar');
async function prepare() {
  let done = 0;
  const total = tiles.length + 2;
  const tick = () => { done++; barEl.style.width = `${Math.round(done / total * 100)}%`; };
  const photos = Promise.all(tiles.map(tl => fetchImg(tl.src).then(src => { tl.img.src = src; tl.img.classList.add('ok'); tick(); })));
  const fonts = Promise.race([
    Promise.all([document.fonts.load('italic 400 20px Fraunces'), document.fonts.load('700 14px Manrope')]).catch(() => {}),
    new Promise(r => setTimeout(r, 4000))
  ]).then(tick);
  const sound = loadSong().then(tick);
  /* the song and the words are needed to begin; photos get until the drop, but we wait up to 12 s for them here */
  await Promise.all([sound, fonts]);
  await Promise.race([photos, new Promise(r => setTimeout(r, 12000))]);
  barEl.style.width = '100%';
  gate.classList.add('ready');
  msg.textContent = 'Lentani yechish uchun bosing';
  bow.disabled = false;
}
function openGate() {
  if (gate.classList.contains('open')) return;
  play(0);
  gate.classList.add('open');
  setTimeout(() => gate.classList.add('gone'), 2200);
  tiles.forEach(tl => { const i = new Image(); i.src = tl.big; });      // the larger versions, for later
}
bow.addEventListener('click', openGate);
gate.addEventListener('click', e => { if (!bow.disabled && e.target !== bow && !bow.contains(e.target)) openGate(); });

$('#again').addEventListener('click', () => {
  finished = false; fin.classList.remove('show'); stage.classList.remove('done');
  play(0);
});

/* ================= a closer look ================= */
const lb = $('#lb'), lbImg = lb.querySelector('img');
tiles.forEach(tl => tl.b.addEventListener('click', () => {
  if (!finished) return;
  lbImg.src = tl.img.src;
  fetchImg(tl.big).then(src => { if (!lb.hidden) lbImg.src = src; });
  lb.hidden = false; requestAnimationFrame(() => lb.classList.add('on'));
}));
lb.addEventListener('click', () => { lb.classList.remove('on'); setTimeout(() => { lb.hidden = true; }, 400); });

/* ================= go ================= */
let rz;
addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layout, 120); });
layout();
if (AT != null) {
  gate.classList.add('gone');
  tiles.forEach(tl => fetchImg(tl.src).then(src => { tl.img.src = src; tl.img.classList.add('ok'); }));
  freeBase = AT; freeAt = performance.now(); mode = RUN ? 'free' : 'frozen';
  if (AT >= END) { finished = true; fin.classList.add('show'); stage.classList.add('done'); }
} else prepare();
requestAnimationFrame(frame);
window.__gul = { get G() { return G; }, get t() { return clock(performance.now()); }, get mode() { return mode; }, freeze(t) { mode = 'frozen'; freeBase = t; }, DROP, WHOLE, END, bar, beatAt };
})();
