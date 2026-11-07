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
  const m = /^([bk])(\d+)$/.exec(tok);          // b3 = the third bar, k13 = the thirteenth beat
  return m ? (m[1] === 'b' ? bar(+m[2]) : beatAt(+m[2])) - (out ? .25 : 0) : parseFloat(tok);
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
const f2 = v => v.toFixed(2);

/* A heartbeat on every beat: lub, then a softer dub. Downbeats land harder. */
function pulse(t) {
  const k = Math.floor((t - B0) / BEAT), d = t - beatAt(k);
  const a = ((k - 2) % 4 + 4) % 4 === 0 ? 1 : .6;
  return a * (Math.exp(-d / .1) + (d > .19 ? .5 * Math.exp(-(d - .19) / .09) : 0));
}
/* a softer tick for the quiet half: just the beat, no dub */
const tick = t => { const d = t - beatAt(Math.floor((t - B0) / BEAT)); return Math.exp(-d / .16); };

const PAPER = '#f8f1e7', INK = '#5a4943', LEAF = '#6f8f5f', LEAF2 = '#4d6a45', STEM = '#55744b';

/* ================= svg ================= */
const NS = 'http://www.w3.org/2000/svg';
const mk = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const ell = (cx, cy, rx, ry, deg = 0) => {
  const a = deg * D2R, dx = rx * Math.cos(a), dy = rx * Math.sin(a);
  return `M${cx - dx} ${cy - dy}A${rx} ${ry} ${deg} 1 0 ${cx + dx} ${cy + dy}A${rx} ${ry} ${deg} 1 0 ${cx - dx} ${cy - dy}Z`;
};
const INKED = { stroke: INK, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', pathLength: 1, 'stroke-dasharray': '1 1' };

const svg = $('#ink');
const defs = mk('defs', {}, svg);
/* Shared colour ramps: they start as paper and are blended to their colour, so a drawing can turn into a painting. */
const ramps = [];
function ramp(id, stops, attrs) {
  const g = mk('linearGradient', { id, x1: 0, y1: 1, x2: 0, y2: 0, ...attrs }, defs);
  const els = stops.map(([o]) => mk('stop', { offset: o, 'stop-color': PAPER }, g));
  ramps.push({ stops, els });
}
ramp('tOut', [[0, '#5e0816'], [.32, '#a50f26'], [.72, '#d8233b'], [1, '#f05867']]);
ramp('tFront', [[0, '#6b0a1b'], [.35, '#bd132c'], [.8, '#e8364b'], [1, '#f7838d']]);
ramp('tIn', [[0, '#3e040f'], [.55, '#7d0b1e'], [1, '#b81d33']]);
ramp('lf', [[0, LEAF2], [1, '#86a873']], { x1: 0, y1: 0, x2: 1, y2: 0 });
let rampC = -1;
function paint(c) {
  c = Math.round(c * 200) / 200;
  if (c === rampC) return;
  rampC = c;
  for (const r of ramps) r.stops.forEach(([, col], i) => r.els[i].setAttribute('stop-color', mix(PAPER, col, c)));
}

const rowG = mk('g', {}, svg);
const heroAll = mk('g', {}, svg);                 // the tulip's stem and leaves; its head is drawn separately
const stem = mk('path', { fill: 'none', 'stroke-width': 1.9, ...INKED }, heroAll);
const TLEAF = 'M0 0C-14 -10 -27 -42 -25 -82C-23 -122 -10 -152 5 -172C-2 -132 -3 -72 6 -22C5 -13 3 -5 0 0Z';
const heroLeaves = [1, -1].map(side => {
  const g = mk('g', {}, heroAll);
  mk('path', { d: TLEAF, fill: 'url(#lf)', stroke: INK, 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, g);
  mk('path', { d: 'M1 -6C-6 -60 -4 -120 3 -165', fill: 'none', stroke: INK, 'stroke-width': .8, opacity: .55 }, g);
  return { g, side };
});

/* A tulip seen from the side. Base at 0,0 where it meets the stem; about 90 tall. Its outer petals lean out as it opens. */
const petalD = (w, h, tip = 1.08) =>
  `M0 0C${-w * .95} ${-h * .06} ${-w * 1.14} ${-h * .5} ${-w * .62} ${-h * .87}C${-w * .36} ${-h * 1.01} ${-w * .1} ${-h * tip} 0 ${-h * tip}` +
  `C${w * .1} ${-h * tip} ${w * .36} ${-h * 1.01} ${w * .62} ${-h * .87}C${w * 1.14} ${-h * .5} ${w * .95} ${-h * .06} 0 0Z`;
function makeTulip(parent, inked) {
  const g = mk('g', {}, parent);
  const strokeA = inked ? INKED : { stroke: '#4a1018', 'stroke-linejoin': 'round' };
  const P = (w, h, tip, fill) => { const pg = mk('g', {}, g); const e = mk('path', { d: petalD(w, h, tip), fill, 'stroke-width': 1.15, ...strokeA }, pg); return { pg, e }; };
  const inL = P(17, 80, 1.1, 'url(#tIn)'), inR = P(17, 80, 1.1, 'url(#tIn)'), inC = P(16, 86, 1.12, 'url(#tIn)');
  const stam = mk('g', { opacity: 0 }, g);
  for (const [x, y] of [[-9, -38], [-4, -44], [3, -45], [9, -39], [0, -33]]) {
    mk('path', { d: `M0 -6Q${x * .4} ${y * .5} ${x} ${y}`, fill: 'none', stroke: '#3a2a1a', 'stroke-width': 1.1 }, stam);
    mk('path', { d: ell(x, y - 2.5, 1.6, 3.4, x * 2), fill: '#2a1a12' }, stam);
  }
  const outL = P(22, 80, 1.07, 'url(#tOut)'), outR = P(22, 80, 1.07, 'url(#tOut)'), front = P(21, 77, 1.05, 'url(#tFront)');
  const vein = mk('path', { d: 'M0 -6C-2 -30 -1 -55 0 -72', fill: 'none', stroke: '#ffb3bb', 'stroke-width': 1.3, 'stroke-linecap': 'round', opacity: 0 }, front.pg);
  const sheen = mk('path', { d: 'M-14 -30C-15 -45 -11 -60 -5 -68', fill: 'none', stroke: '#ffd0d5', 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0 }, outL.pg);
  return { g, inked, inL, inR, inC, stam, outL, outR, front, vein, sheen, paths: [inL, inR, inC, outL, outR, front].map(p => p.e) };
}
function shapeTulip(tl, open, color, draw = 1) {
  const o = open;
  if (tl.inked) { const sc = mix(INK, '#4a1018', color); if (tl.sc !== sc) { tl.sc = sc; for (const e of tl.paths) e.setAttribute('stroke', sc); } }
  tl.inL.pg.setAttribute('transform', `translate(-3 0) rotate(${f2(-12 - 10 * o)})`);
  tl.inR.pg.setAttribute('transform', `translate(3 0) rotate(${f2(12 + 10 * o)})`);
  tl.outL.pg.setAttribute('transform', `translate(-6 0) rotate(${f2(-7 - 33 * o)})`);
  tl.outR.pg.setAttribute('transform', `translate(6 0) rotate(${f2(7 + 33 * o)})`);
  tl.front.pg.setAttribute('transform', `scale(${f2(1 + .05 * o)} ${f2(1 - .24 * o)})`);
  tl.stam.setAttribute('opacity', f2(cl(o * 1.6 - .4) * color));
  tl.vein.setAttribute('opacity', f2(.55 * color));
  tl.sheen.setAttribute('opacity', f2(.5 * color));
  const fo = f2(cl(draw * 1.6 - .5));
  for (const e of tl.paths) { e.setAttribute('stroke-dashoffset', f2(1 - draw)); e.setAttribute('fill-opacity', fo); }
}

/* the bouquet that forms in the middle of the heart: two more tulips, stems, leaves and a ribbon */
const bqBack = mk('g', { opacity: 0 }, svg);
const bqStems = [-1, 0, 1].map(() => mk('path', { fill: 'none', stroke: STEM, 'stroke-width': 1.6, 'stroke-linecap': 'round', pathLength: 1, 'stroke-dasharray': '1 1' }, bqBack));
const bqLeaves = [-1, 1].map(s => mk('path', { d: TLEAF, fill: 'url(#lf)', stroke: '#3a4a30', 'stroke-width': 1.4, 'stroke-linejoin': 'round' }, bqBack));
const sideTulips = [-1, 1].map(() => makeTulip(bqBack, false));
const bow = mk('g', { opacity: 0 }, svg);
mk('path', { d: 'M-2 3C-10 18 -16 30 -26 42L-17 41L-15 50C-6 36 0 22 3 6Z', fill: '#a8243f' }, bow);
mk('path', { d: 'M2 3C10 18 16 30 26 42L17 41L15 50C6 36 0 22 -3 6Z', fill: '#c33a56' }, bow);
mk('path', { d: 'M-4 -2C-22 -30 -56 -26 -52 -3C-48 15 -22 10 -4 3Z', fill: '#c73d58' }, bow);
mk('path', { d: 'M4 -2C22 -30 56 -26 52 -3C48 15 22 10 4 3Z', fill: '#b02a47' }, bow);
mk('path', { d: 'M-8 -1C-24 -20 -44 -19 -44 -5M8 -1C24 -20 44 -19 44 -5', fill: 'none', stroke: '#f3a3b2', 'stroke-width': 2, 'stroke-linecap': 'round', opacity: .6 }, bow);
mk('rect', { x: -8, y: -8, width: 16, height: 16, rx: 5, fill: '#8c1733' }, bow);

const heroHead = makeTulip(svg, true);

/* The row: every flower she has been given before, drawn in ink. Base at 0,0; about 100 tall. */
const FLOWERS = {
  tulip: () => [
    { d: 'M0 0C2 -26 -3 -50 0 -70', w: 1.4, stem: 1 },
    { d: 'M0 -6C14 -22 17 -44 9 -64C5 -46 2 -28 0 -16Z', fill: LEAF },
    { d: 'M-11 -68C-14 -80 -11 -91 -6 -97L-2.5 -87L0 -99L2.5 -87L6 -97C11 -91 14 -80 11 -68C7 -63 -7 -63 -11 -68Z', fill: '#f2b04f' },
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
const blobs = [...document.querySelectorAll('.blob')], splash = $('#splash');

const heartXY = th => [16 * Math.sin(th) ** 3, -1.1 * (13 * Math.cos(th) - 5 * Math.cos(2 * th) - 2 * Math.cos(3 * th) - Math.cos(4 * th))];   // a touch taller than the textbook heart
const N_PHOTOS = 20, STEPS = N_PHOTOS / 2;    // one at the dip, nine pairs down the sides, one at the point

function layout() {
  W = innerWidth; H = innerHeight;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const m = Math.min(W, H), wide = W > H;
  const ground = H - Math.max(14, H * .035);
  const rowH = cl(H * .16, 86, 165);
  const R = cl(m * .15, 44, 92);                  // the tulip's head is 1.8 R tall
  const headBase = H * .5 + R * .9;
  const sayTop = Math.max(H * .075, 26);

  /* the tulip's stem and its two long leaves, in screen space */
  const L = ground - headBase;
  stem.setAttribute('d', `M${W / 2} ${ground}C${W / 2 - L * .05} ${ground - L * .35} ${W / 2 + L * .07} ${ground - L * .68} ${W / 2} ${headBase + 2}`);
  heroLeaves.forEach((lf, i) => { lf.x = W / 2 + (i ? -1.5 : 1.5); lf.y = ground; lf.s = L * (i ? .5 : .62) / 172; });

  /* the row */
  rowG.textContent = '';
  const perSide = cl(Math.floor((W / 2 - R * .6) / (rowH * .34)), 2, 6);
  const gap = Math.max(R * .66, rowH * .3), reach = W / 2 - Math.max(26, rowH * .22);
  const row = [];
  for (const s of [-1, 1]) for (let j = 0; j < perSide; j++) {
    const name = (s < 0 ? ROW_LEFT : ROW_RIGHT)[j];
    const x = W / 2 + s * (gap + (perSide === 1 ? 0 : j * (reach - gap) / (perSide - 1)));
    const k = rowH * HEIGHTS[(j + (s > 0 ? 3 : 0)) % HEIGHTS.length] / 100;
    const g = mk('g', {}, rowG);
    const parts = FLOWERS[name]().map(p => {
      const e = mk('path', { d: p.d, fill: p.fill ? PAPER : 'none', 'stroke-width': (p.w || 1) / Math.sqrt(k), 'stroke-dashoffset': 1, ...INKED }, g);
      return { e, fill: p.fill, stem: p.stem };
    });
    row.push({ g, parts, x, k, side: s, j });
  }
  row.sort((a, b) => a.j - b.j || a.side - b.side).forEach((f, q) => { f.q = q; });

  /* the heart of photos: six pairs, big */
  const N = 600, pts = [], cum = [0];
  for (let i = 0; i <= N; i++) { pts.push(heartXY(Math.PI * i / N)); if (i) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); }
  const half = cum[N], step = half / STEPS;
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  const tileU = step * 1.02, tileHU = tileU * 1.17;          // edge to edge: twenty photos draw the outline on their own
  const availH = H * (wide ? .7 : .6);
  const u = Math.min((W - (wide ? 40 : 14)) / (32 + tileU), availH / (maxY - minY + tileHU));
  const top = Math.max(H * (wide ? .03 : .065), 16);
  const hx = W / 2, hy = top + (tileHU / 2 - minY) * u;
  const slots = [];
  for (let k = 0; k <= STEPS; k++) {
    const s = Math.min(k * step, half - 1e-6);
    let i = 1; while (cum[i] < s) i++;
    const f = (s - cum[i - 1]) / (cum[i] - cum[i - 1]);
    const x = lerp(pts[i - 1][0], pts[i][0], f), y = lerp(pts[i - 1][1], pts[i][1], f);
    const ang = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]) / D2R;
    if (k === 0 || k === STEPS) { slots.push({ x: hx, y: hy + y * u, rot: k ? 2 : -2, k, side: 0 }); continue; }
    for (const side of [-1, 1]) slots.push({ x: hx + side * x * u, y: hy + y * u, rot: side * (ang - 90) * .12 + side * (k % 2 ? 3.5 : -3), k, side });
  }
  const tile = tileU * u;
  heartEl.style.setProperty('--tw', `${tile.toFixed(1)}px`);
  heartEl.style.transformOrigin = `${hx}px ${hy + 3 * u}px`;
  const outline = [];
  for (let i = 0; i < 48; i++) { const [x, y] = heartXY(i / 48 * Math.PI * 2); outline.push([hx + x * u, hy + y * u]); }

  /* the bouquet in the middle of the heart */
  const bs = 5.4 * u / 90;
  const bq = { x: hx, base: hy + 4.6 * u, s: bs, tie: hy + 9.4 * u, end: hy + 12.6 * u, side: 3.3 * u, sideBase: hy + 5.8 * u };
  const fc = [hx, bq.base - 44 * bs];

  const heartBottom = hy + (maxY + tileHU / 2) * u;
  stage.style.setProperty('--sayTop', `${sayTop}px`);
  stage.style.setProperty('--sayLow', `${heartBottom + Math.max(14, H * .02)}px`);
  stage.style.setProperty('--finTop', `${heartBottom + Math.max(14, H * .02) + 54}px`);

  /* watercolour washes: where they rest */
  const vm = Math.max(W, H);
  const BL = [[.18, .22, .95, '#f4c4cc'], [.86, .72, .85, '#d6e3c6'], [.78, .12, .7, '#f8d8c0']];
  blobs.forEach((b, i) => { const [x, y, s, c] = BL[i]; b.style.width = b.style.height = `${(s * vm).toFixed(0)}px`; b.style.background = `radial-gradient(closest-side,${c},${c}00)`; b.dataset.x = x * W - s * vm / 2; b.dataset.y = y * H - s * vm / 2; });

  G = { ground, rowH, R, headBase, row, slots, tile, u, hx, hy, bq, fc, outline, m, L };
  fxSize();
  seedParticles();
}

/* ================= photos ================= */
/* the dip at the top, then left and right down the sides, then the point: every photo with flowers, and the loveliest of the rest between them */
const PHOTOS = ['portrait', 'g6', 'g1', 'selfie', 'eighteen', 'g5', 'g2', 'eclair', 'headphones', 'g3', 'cafe', 'shades', 'closeup', 'g8', 'g4', 'kart', 'profile', 'hero', 'suit', 'flowers'];
const tiles = PHOTOS.map((name, i) => {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'ph'; b.setAttribute('aria-label', 'Rasmni kattalashtirish');
  const img = new Image(); img.alt = ''; img.decoding = 'async';
  b.appendChild(img); heartEl.appendChild(b);
  b.style.zIndex = i;
  return { b, img, name, src: `assets/img/${name}.webp?v=2`, big: `assets/img/${name}-big.webp?v=2`, spin: (i % 2 ? 1 : -1) * (120 + (i * 37) % 140), vis: -1 };
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

/* ================= canvas: petals, light, sparks ================= */
const cv = $('#fx'), cx = cv.getContext('2d');
let DPR = 1;
function fxSize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
}
const PETAL_COLS = ['#c8102e', '#e0283f', '#a50d24', '#f05867', '#7a0c1f', '#f7a1aa', '#ff4d5e', '#f4c2c8'];
let bursts = [], ambient = [], sparks = [], motes = [], ripples = [];
function seedParticles() {
  const r = mulberry(18), sc = G.m / 420;
  const burst = (t0, n, speed, size) => Array.from({ length: n }, () => {
    const a = r() * Math.PI * 2, v = (speed[0] + r() * (speed[1] - speed[0])) * sc;
    return { t0, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120 * sc, s: (size[0] + r() * (size[1] - size[0])) * Math.max(.8, sc),
      a0: r() * 6.3, spin: (r() - .5) * 9, flip: 2 + r() * 5, ph: r() * 6.3, wob: 8 + r() * 22, col: PETAL_COLS[(r() * PETAL_COLS.length) | 0], life: 3.2 + r() * 1.6 };
  });
  bursts = [...burst(DROP, 190, [380, 1200], [5, 12]), ...burst(WHOLE, 80, [200, 650], [4, 9])];
  ambient = Array.from({ length: 22 }, () => ({ x: r(), off: r(), vy: (34 + r() * 40) * Math.max(.8, sc), s: (4 + r() * 6) * Math.max(.8, sc),
    a0: r() * 6.3, spin: (r() - .5) * 2, flip: 1 + r() * 2.5, ph: r() * 6.3, wob: 14 + r() * 26, col: PETAL_COLS[(r() * PETAL_COLS.length) | 0] }));
  motes = Array.from({ length: 46 }, () => ({ x: r(), y: r(), sp: (7 + r() * 16) * Math.max(.8, sc), sw: 8 + r() * 26, ph: r() * 6.3, s: (.7 + r() * 1.7) * Math.max(.9, sc), gold: r() < .72, tw: 1 + r() * 2 }));
  sparks = [];
  G.slots.forEach((s, i) => { const land = landOf(i); for (let k = 0; k < 9; k++) sparks.push({ t0: land, x: s.x, y: s.y, a: r() * 6.3, d: (18 + r() * 26) * sc, gold: r() < .6 }); });
  G.outline.forEach(([x, y], i) => sparks.push({ t0: WHOLE + (i % 6) * .02, x, y, a: r() * 6.3, d: (10 + r() * 28) * sc, gold: true, big: 1 }));
  ripples = [];
}
function petal(x, y, s, a, flip, col, alpha) {
  cx.save(); cx.translate(x, y); cx.rotate(a); cx.scale(1, .18 + .82 * Math.abs(Math.cos(flip)));
  cx.globalAlpha = alpha; cx.fillStyle = col;
  cx.beginPath(); cx.moveTo(0, -s); cx.bezierCurveTo(s * .95, -s * .55, s * .7, s * .85, 0, s); cx.bezierCurveTo(-s * .7, s * .85, -s * .95, -s * .55, 0, -s); cx.fill();
  cx.globalAlpha = alpha * .35; cx.fillStyle = '#fff'; cx.beginPath(); cx.ellipse(-s * .2, -s * .25, s * .18, s * .45, -.3, 0, 6.3); cx.fill();
  cx.restore();
}
function star(x, y, r, col, alpha) {
  cx.globalAlpha = alpha; cx.fillStyle = col;
  cx.beginPath(); cx.moveTo(x, y - r * 2.4); cx.lineTo(x + r * .6, y); cx.lineTo(x, y + r * 2.4); cx.lineTo(x - r * .6, y); cx.closePath(); cx.fill();
  cx.beginPath(); cx.moveTo(x - r * 2.4, y); cx.lineTo(x, y + r * .6); cx.lineTo(x + r * 2.4, y); cx.lineTo(x, y - r * .6); cx.closePath(); cx.fill();
}

/* the magic pen: wherever ink is being laid down, a few sparks fall off the nib */
let pens = [], penSparks = [], lastNow = 0;
const penRnd = mulberry(7);

function drawFx(t, now, flower, trails) {
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  cx.clearRect(0, 0, W, H);
  const [ox, oy] = G.fc;
  const sc = G.m / 420;

  /* dust in the light: drifts up, twinkles on the beat, stops dead in the silence, is pulled into the flower before the drop */
  const te = t < HUSH ? t : t < RISE ? HUSH : t - (RISE - HUSH);
  const pull = t < DROP ? eio(span(t, RISE, DROP - .04)) : 0;
  const moteVis = t < DROP ? 1 : t < WHOLE ? 0 : cl((t - WHOLE) / 2) * .75;
  if (moteVis > 0) {
    const tw = t < DROP ? tick(t) : pulse(t) * .6;
    for (const m of motes) {
      let y = ((m.y * (H + 40) - te * m.sp) % (H + 40) + H + 40) % (H + 40) - 20;
      let x = m.x * W + Math.sin(te * .45 + m.ph) * m.sw;
      if (pull > 0) { x = lerp(x, flower[0], pull); y = lerp(y, flower[1], pull); }
      const a = moteVis * (.28 + .42 * Math.sin(te * m.tw + m.ph) ** 2) * (1 + .9 * tw) * (1 - pull * .3);
      cx.globalAlpha = cl(a * .28); cx.fillStyle = m.gold ? '#f0c56a' : '#ffffff';
      cx.beginPath(); cx.arc(x, y, m.s * 3.2, 0, 6.3); cx.fill();
      cx.globalAlpha = cl(a); cx.beginPath(); cx.arc(x, y, m.s * (1 + pull * .6), 0, 6.3); cx.fill();
    }
  }

  /* rings: on each beat of the bloom, on the drop, when the heart closes */
  for (const rp of ripples) {
    const p = span(t, rp.t0, rp.t0 + rp.d); if (p <= 0 || p >= 1) continue;
    const [x, y] = rp.at();
    cx.globalAlpha = (1 - p) ** 2 * rp.a; cx.strokeStyle = rp.col; cx.lineWidth = rp.w * (1 - p) + .6;
    cx.beginPath(); cx.arc(x, y, lerp(rp.r0, rp.r1, eo(p)), 0, 6.3); cx.stroke();
  }

  /* the drop: the tulip bursts; then petals keep falling */
  const K = 2.3, g = 270 * sc;
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

  /* photos leave a short glittering wake */
  for (const tr of trails) for (let j = 0; j < tr.length; j++) star(tr[j][0], tr[j][1], 1.6 * (1 - j / tr.length) + .3, j % 2 ? '#fff' : '#f0c56a', .75 * (1 - j / tr.length));

  /* sparks where each photo lands, and around the whole heart when it closes */
  for (const s of sparks) {
    const dt = t - s.t0; if (dt < 0 || dt > .8) continue;
    const p = dt / .8;
    star(s.x + Math.cos(s.a) * s.d * eo(p), s.y + Math.sin(s.a) * s.d * eo(p), (s.big ? 2.7 : 2) * (1 - p) + .4, s.gold ? '#e2ac4f' : '#fff', (1 - p) ** 1.3);
  }

  /* the nib's sparks (real time, not song time: they are only decoration) */
  const dt = Math.min(.05, Math.max(0, (now - lastNow) / 1000)); lastNow = now;
  for (const pn of pens) {
    if (t < pn.a || t > pn.b || !pn.el.isConnected) continue;
    const L = pn.len || (pn.len = pn.el.getTotalLength());
    const q = pn.ease(span(t, pn.a, pn.b));
    const ctm = pn.el.getScreenCTM(); if (!ctm) continue;
    const pt = pn.el.getPointAtLength(L * q).matrixTransform(ctm);
    for (let k = 0; k < 2; k++) penSparks.push({ x: pt.x, y: pt.y, vx: (penRnd() - .5) * 60, vy: -10 - penRnd() * 40, life: .5 + penRnd() * .5, age: 0, gold: penRnd() < .7 });
    cx.globalAlpha = .9; cx.fillStyle = '#fff6dd'; cx.beginPath(); cx.arc(pt.x, pt.y, 3.2, 0, 6.3); cx.fill();
    cx.globalAlpha = .35; cx.fillStyle = '#f0c56a'; cx.beginPath(); cx.arc(pt.x, pt.y, 9, 0, 6.3); cx.fill();
  }
  penSparks = penSparks.filter(s => (s.age += dt) < s.life);
  for (const s of penSparks) {
    s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 30 * dt;
    star(s.x, s.y, 1.3 * (1 - s.age / s.life) + .3, s.gold ? '#e8b44f' : '#fff', 1 - s.age / s.life);
  }
  cx.globalAlpha = 1;
}

/* ================= the film ================= */
/* after the burst: the dip, then a pair on every sixteenth, and the point last, closing the heart on the downbeat */
const landOf = i => WHOLE - (STEPS - (i === N_PHOTOS - 1 ? STEPS : Math.floor((i + 1) / 2))) * HB / 2;
const BLOOM = [18, 19, 20, 21].map(beatAt);                  // the four beats the tulip opens on
let lastFlower = [0, 0];

function render(t, now) {
  const { ground, rowH, R, headBase, row, bq } = G;
  const still = t >= HUSH && t < RISE;                       // the song goes silent: so does everything else
  const swayAmp = still ? 0 : t < RISE ? 1 : t > WHOLE ? .8 : 0;
  const sway = (ph, a) => Math.sin((t - B0) / (2 * BEAT) * Math.PI * 2 + ph) * a * swayAmp;

  /* --- colour of the tulip: ink, a blush on the fourth bar, then red on the fifth --- */
  const color = t < bar(3) ? 0 : t < bar(4) ? .28 * eo(span(t, bar(3), bar(4))) : .28 + .72 * eo(span(t, bar(4), bar(4) + 1.6));
  paint(color);

  /* --- stem and leaves: drawn in, then the whole plant steps down into the row --- */
  const stemP = eio(span(t, .55, 2.05));
  stem.setAttribute('stroke-dashoffset', (1 - stemP).toFixed(4));
  stem.setAttribute('visibility', stemP > 0 ? 'visible' : 'hidden');
  stem.setAttribute('stroke', mix(INK, STEM, color));
  const shrink = eio(span(t, bar(5), beatAt(24)));
  const headTop = headBase - 1.8 * R;
  const sRow = (rowH * 1.06) / (ground - headTop);
  const s = lerp(1, sRow, shrink);
  const lifting = span(t, RISE, DROP - .05);
  const stemFade = 1 - span(t, RISE, RISE + .5);
  heroAll.setAttribute('transform', `translate(${W / 2} ${ground}) rotate(${f2(sway(0, 1.2))}) scale(${s.toFixed(4)}) translate(${-W / 2} ${-ground})`);
  heroAll.setAttribute('opacity', (t < DROP ? stemFade : 0).toFixed(3));
  heroLeaves.forEach((lf, i) => {
    const p = eback(span(t, 1.1 + i * HB, 1.1 + i * HB + .9));
    lf.g.setAttribute('transform', `translate(${lf.x} ${lf.y}) rotate(${f2(lf.side * (8 + sway(i, 2.5)))}) scale(${(lf.side * lf.s * p).toFixed(4)} ${(lf.s * p).toFixed(4)})`);
  });

  /* --- the head: on its stem, then lifted into the middle of the heart --- */
  let hx = W / 2, hy = ground - (ground - headBase) * s, hk = R / 50 * s;
  if (t >= RISE) { const p = eio(lifting); hx = lerp(hx, bq.x, p); hy = lerp(hy, bq.base, p); hk = lerp(hk, bq.s, p); }
  const draw = eio(span(t, 1.8, 2.9));
  const swell = 1 + (t >= bar(3) && t < bar(4) ? .1 * eio(span(t, bar(3), bar(4))) + .035 * pulse(t) : t >= bar(4) && t < bar(5) ? .1 * (1 - span(t, bar(4), bar(4) + .6)) : 0);
  const open = t < bar(4) ? 0 : BLOOM.reduce((a, b) => a + .19 * eo(span(t, b, b + .5)), 0) + (t > WHOLE ? .06 * pulse(t) : 0);
  let punch = 1;
  if (t >= DROP) punch += .3 * Math.exp(-(t - DROP) / .16) + (t >= WHOLE ? .2 * Math.exp(-(t - WHOLE) / .2) : 0) + .04 * pulse(t);
  shapeTulip(heroHead, open, color, draw);
  heroHead.g.setAttribute('transform', `translate(${f2(hx)} ${f2(hy)}) rotate(${f2(sway(0, 1.6))}) scale(${(hk * swell * punch).toFixed(4)})`);
  heroHead.g.setAttribute('opacity', t < 1.8 ? 0 : 1);
  const flower = [hx, hy - 44 * hk * swell * punch];
  lastFlower = flower;

  /* --- the bouquet gathers around it when the heart closes --- */
  const bqP = span(t, WHOLE - .05, WHOLE + 1.1);
  bqBack.setAttribute('opacity', t >= WHOLE - .05 ? 1 : 0);
  bow.setAttribute('opacity', t >= WHOLE ? cl((t - WHOLE - .35) * 4) : 0);
  if (t >= WHOLE - .05) {
    const k = bq.s, hb = 1 + .035 * pulse(t);
    bqStems.forEach((e, i) => {
      const sx = i === 1 ? bq.x : bq.x + (i - 1) * bq.side, sy = i === 1 ? bq.base : bq.sideBase;
      e.setAttribute('d', `M${f2(sx)} ${f2(sy)}Q${f2(lerp(sx, bq.x, .6))} ${f2(lerp(sy, bq.tie, .5))} ${f2(bq.x + (i - 1) * 2)} ${f2(bq.tie)}L${f2(bq.x + (i - 1) * G.u * 1.3)} ${f2(bq.end)}`);
      e.setAttribute('stroke-dashoffset', f2(1 - eo(span(t, WHOLE, WHOLE + .45))));
      e.setAttribute('stroke-width', f2(Math.max(1.4, G.u * .24)));
    });
    bqLeaves.forEach((e, i) => {
      const sd = i ? 1 : -1, p = eback(span(t, WHOLE + .1 + i * .18, WHOLE + .8 + i * .18));
      const lk = G.u * 7.5 / 172;
      e.setAttribute('transform', `translate(${f2(bq.x + sd * 2)} ${f2(bq.end)}) rotate(${sd * 26}) scale(${(-sd * lk * p).toFixed(4)} ${(lk * p).toFixed(4)})`);
    });
    sideTulips.forEach((tl, i) => {
      const sd = i ? 1 : -1, p = eback(span(t, WHOLE + .18 * (i + 1), WHOLE + .18 * (i + 1) + .7));
      shapeTulip(tl, .45 + .06 * pulse(t), 1, 1);
      tl.g.setAttribute('transform', `translate(${f2(bq.x + sd * bq.side)} ${f2(bq.sideBase)}) rotate(${sd * 19 + sway(i * 2, 1.5)}) scale(${(k * .82 * p * hb).toFixed(4)})`);
    });
    bow.setAttribute('transform', `translate(${f2(bq.x)} ${f2(bq.tie)}) scale(${(G.u * .045 * eback(span(t, WHOLE + .35, WHOLE + .95)) * hb).toFixed(4)})`);
  }

  /* --- the row of flowers: sprouts in on half beats, takes colour when the tulip joins, bows before the drop --- */
  const back = t >= WHOLE ? eo(span(t, WHOLE + .2, WHOLE + 1.6)) : 0;
  pens.length = 0;
  pens.push({ el: stem, a: .55, b: 2.05, ease: eio });
  pens.push({ el: heroHead.front.e, a: 1.8, b: 2.9, ease: eio });
  for (const f of row) {
    const st = bar(1) + f.q * HB;
    const fdraw = eio(span(t, st, st + 1.1));
    const c = t >= WHOLE ? 1 : eo(span(t, beatAt(24) + .25 + f.j * .28, beatAt(24) + 1.05 + f.j * .28));
    const bowP = t >= WHOLE ? 0 : eio(lifting);
    const vis = t < RISE ? 1 : t < WHOLE ? 1 - bowP : back;
    const grow = t >= WHOLE ? lerp(.45, .72, back) : 1;
    f.g.setAttribute('transform', `translate(${f.x} ${ground}) rotate(${f2(sway(f.x * .01, 2.4) + f.side * 14 * bowP)}) scale(${(f.k * grow).toFixed(4)})`);
    f.g.setAttribute('opacity', (fdraw <= 0 && t < WHOLE ? 0 : vis * (t >= WHOLE ? .92 : 1)).toFixed(3));
    const shown = t >= WHOLE ? 1 : fdraw;
    for (const p of f.parts) {
      p.e.setAttribute('stroke-dashoffset', (1 - shown).toFixed(4));
      if (p.fill) { p.e.setAttribute('fill', mix(PAPER, p.fill, c)); p.e.setAttribute('fill-opacity', cl(shown * 1.6 - .5).toFixed(3)); }
      if (p.stem) p.e.setAttribute('stroke', mix(INK, STEM, c));
    }
    if (t < WHOLE) pens.push({ el: f.parts[0].e, a: st, b: st + 1.1, ease: eio });
  }

  /* --- the room --- */
  /* watercolour washes drift all the time, warm up as the tulip turns red, and gather behind the heart */
  const warm = t < bar(4) ? .55 : t < DROP ? .55 + .35 * span(t, bar(4), bar(5)) : .8;
  blobs.forEach((b, i) => {
    const dx = Math.sin(t * .11 + i * 2) * 40, dy = Math.cos(t * .09 + i) * 30, sc2 = 1 + .06 * Math.sin(t * .2 + i) + (t >= DROP ? .05 * pulse(t) : 0);
    b.style.transform = `translate(${(+b.dataset.x + dx).toFixed(1)}px,${(+b.dataset.y + dy).toFixed(1)}px) scale(${sc2.toFixed(3)})`;
    b.style.opacity = (warm * (t < .4 ? t / .4 : 1)).toFixed(3);
  });
  /* the red wash that spreads behind the tulip on each beat it opens */
  const sp = BLOOM.reduce((a, b) => a + .25 * eo(span(t, b, b + .6)), 0);
  const spFade = t < bar(5) ? 1 : 1 - span(t, bar(5), bar(5) + 1.4);
  const spSize = R * 7 * (.35 + .65 * sp) * (1 + .05 * (t >= bar(4) ? tick(t) : 0));
  splash.style.width = splash.style.height = `${spSize.toFixed(1)}px`;
  splash.style.transform = `translate(${(flower[0] - spSize / 2).toFixed(1)}px,${(flower[1] - spSize / 2).toFixed(1)}px)`;
  splash.style.opacity = (t < bar(4) ? 0 : .72 * spFade * cl(sp * 3)).toFixed(3);

  const dusk = t < HUSH ? 0 : t < DROP ? lerp(.22, .62, span(t, RISE, DROP)) * span(t, HUSH, HUSH + .6) : 0;
  stage.style.setProperty('--dusk', dusk.toFixed(3));
  flash.style.opacity = (t >= DROP ? (1 - span(t, DROP, DROP + .7)) ** 2 * .92 : 0).toFixed(3);
  const beatNow = t >= DROP ? pulse(t) : 0;
  const gl = t >= RISE ? (t < DROP ? .25 + .75 * lifting : .55 + .35 * beatNow) : 0;
  const gs = (G.u * 30) * (1 + .07 * beatNow) * (t < DROP ? lerp(.4, 1, lifting) : 1);
  glow.style.opacity = gl.toFixed(3);
  glow.style.transform = `translate(${(G.fc[0] - gs / 2).toFixed(1)}px,${(G.fc[1] - gs / 2).toFixed(1)}px)`;
  glow.style.width = glow.style.height = `${gs.toFixed(1)}px`;

  /* --- the heart: photos leave the tulip in pairs, one pair every half beat, and close on the downbeat --- */
  heartEl.style.transform = `scale(${(t >= DROP ? 1 + (t >= WHOLE ? .04 : .015) * pulse(t) : 1).toFixed(4)})`;
  const trails = [];
  const [sx, sy] = G.fc;
  tiles.forEach((tl, i) => {
    const slot = G.slots[i], land = landOf(i), launch = land - .62;
    if (t < launch) {
      /* a few seconds early they are painted once, invisibly, inside the flower, so the drop never waits for a decode */
      const warmUp = t > HUSH - 1.5 ? 2 : 0;
      if (tl.vis !== warmUp) {
        tl.vis = warmUp; tl.b.style.opacity = warmUp ? .001 : 0;
        tl.b.style.transform = `translate3d(${(sx - G.tile / 2).toFixed(1)}px,${(sy - G.tile * 1.17 / 2).toFixed(1)}px,0) scale(.15)`;
      }
      return;
    }
    const p = span(t, launch, land);
    const pos = q => [lerp(sx, slot.x, eo(q)), lerp(sy, slot.y, eo(q)) - Math.sin(Math.PI * q) * G.u * 5];
    const [x, y] = pos(p);
    if (p < 1) { const tr = []; for (let j = 1; j <= 7; j++) { const q = p - j * .035; if (q > 0) tr.push(pos(q)); } trails.push(tr); }
    const scl = lerp(.15, 1, eback(p)), rot = lerp(tl.spin, slot.rot, eo(p));
    tl.b.style.transform = `translate3d(${(x - G.tile / 2).toFixed(1)}px,${(y - G.tile * 1.17 / 2).toFixed(1)}px,0) rotate(${rot.toFixed(2)}deg) scale(${scl.toFixed(3)})`;
    if (tl.vis !== 1) { tl.b.style.opacity = 1; tl.vis = 1; }
    /* a gleam runs across the photos, left to right, when the heart closes */
    const g0 = WHOLE + .05 + (slot.x / W) * .45, gp = span(t, g0, g0 + .85);
    const gv = gp > 0 && gp < 1 ? (130 - 160 * gp).toFixed(1) + '%' : '130%';
    if (tl.gleam !== gv) { tl.gleam = gv; tl.b.style.setProperty('--sh', gv); }
  });

  /* --- words --- */
  for (const c of cues) {
    const on = t >= c.a && t < c.b;
    if (on !== c.on) { c.on = on; c.el.classList.toggle('on', on); }
  }
  drawFx(t, now, flower, trails);
}

/* rings: the bloom's four beats, the drop, the heart closing */
function seedRipples() {
  const at = () => lastFlower;
  ripples = [
    ...BLOOM.map((b, i) => ({ t0: b, d: 1.1, at, r0: G.R * .4, r1: G.R * (2.4 + i * .35), w: 2.4, a: .45, col: '#d8233b' })),
    { t0: DROP, d: 1.2, at: () => G.fc, r0: G.u * 2, r1: G.u * 26, w: 4, a: .55, col: '#e0283f' },
    { t0: DROP + .12, d: 1.4, at: () => G.fc, r0: G.u * 2, r1: G.u * 34, w: 2, a: .35, col: '#f0c56a' },
    { t0: WHOLE, d: 1.3, at: () => G.fc, r0: G.u * 4, r1: G.u * 30, w: 3, a: .5, col: '#f0c56a' }
  ];
}

/* words arrive one by one, an eighth or a sixteenth apart */
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
  el.style.setProperty('--st', `${i <= 5 ? HB / 2 : HB / 4}s`);   // a whole line is in place within about a second
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
  render(t, now);
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
const gate = $('#gate'), bowBtn = $('#bow'), msg = $('#gateMsg'), barEl = $('#gateBar');
async function prepare() {
  let done = 0;
  const total = tiles.length + 2;
  const step = () => { done++; barEl.style.width = `${Math.round(done / total * 100)}%`; };
  const photos = Promise.all(tiles.map(tl => fetchImg(tl.src).then(src => { tl.img.src = src; tl.img.classList.add('ok'); step(); })));
  const fonts = Promise.race([
    Promise.all([document.fonts.load('italic 400 20px Fraunces'), document.fonts.load('700 14px Manrope')]).catch(() => {}),
    new Promise(r => setTimeout(r, 4000))
  ]).then(step);
  const sound = loadSong().then(step);
  /* the song and the words are needed to begin; photos get until the drop, but we wait up to 12 s for them here */
  await Promise.all([sound, fonts]);
  await Promise.race([photos, new Promise(r => setTimeout(r, 12000))]);
  barEl.style.width = '100%';
  gate.classList.add('ready');
  msg.textContent = 'Lentani yechish uchun bosing';
  bowBtn.disabled = false;
}
function openGate() {
  if (gate.classList.contains('open')) return;
  play(0);
  gate.classList.add('open');
  setTimeout(() => gate.classList.add('gone'), 2200);
  tiles.forEach(tl => { const i = new Image(); i.src = tl.big; });      // the larger versions, for later
}
bowBtn.addEventListener('click', openGate);
gate.addEventListener('click', e => { if (!bowBtn.disabled && e.target !== bowBtn && !bowBtn.contains(e.target)) openGate(); });

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
addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { layout(); seedRipples(); }, 120); });
layout(); seedRipples();
if (AT != null) {
  gate.classList.add('gone');
  tiles.forEach(tl => fetchImg(tl.src).then(src => { tl.img.src = src; tl.img.classList.add('ok'); }));
  freeBase = AT; freeAt = performance.now(); mode = RUN ? 'free' : 'frozen';
  if (AT >= END) { finished = true; fin.classList.add('show'); stage.classList.add('done'); }
} else prepare();
requestAnimationFrame(function first(now) { lastNow = now; frame(now); });
window.__gul = { get G() { return G; }, get t() { return clock(performance.now()); }, get mode() { return mode; }, freeze(t) { mode = 'frozen'; freeBase = t; }, DROP, WHOLE, END, bar, beatAt };
})();
