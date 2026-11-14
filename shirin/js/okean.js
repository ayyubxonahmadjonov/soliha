/* Okean: a dive. Every frame is a pure function of the song's clock, so the picture can never drift from the music. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const sea = $('sea'), deep = $('deep'), rays = $('rays'), bloom = $('bloom'), fx = $('fx'), tilesEl = $('tiles'),
    endEl = $('end'), gate = $('gate'), gateMsg = $('gateMsg'), gateBar = $('gateBar'), resume = $('resume'), lb = $('lb'), song = $('song');
  const ctx = fx.getContext('2d');
  const lines = [...document.querySelectorAll('.ln')];
  const MEDIA = window.MEDIA || [];
  const DIR = 'assets/m/';
  const V = 16;

  // the song: 67.4 bpm, first downbeat at B0
  const STAR = 'v59';
  const RATE = .9; // the clip is played at nine tenths of its speed; every time below follows from that
  const BEAT = .89 / RATE, B0 = 3.61 / RATE, END = 22.29 / RATE;
  const beat = k => B0 + k * BEAT;
  const GATHER = beat(15), WHOLE = beat(19);

  const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
  const span = (t, a, b) => clamp((t - a) / (b - a));
  const lerp = (a, b, p) => a + (b - a) * p;
  const eio = p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
  const eout = p => 1 - Math.pow(1 - p, 3);
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };
  const hash = (a, b) => rng(a * 7919 + b * 104729 + 17)();

  // how far we have sunk: one second per second, but it lurches forward on every beat
  const sink = t => { const bp = (t - B0) / BEAT; if (bp < 0) return t; const k = Math.floor(bp); return B0 + BEAT * (.5 * bp + .5 * (k + eout(bp - k))); };
  // lub-dub
  const pulse = time => { const f = (((time - B0) / BEAT) % 1 + 1) % 1; return Math.exp(-7 * f) + (f > .28 ? .55 * Math.exp(-9 * (f - .28)) : 0); };

  let W = 0, H = 0, G = null, tiles = [];
  const NAME0 = WHOLE + .5;                       // when the school sets off to write her name
  const SC = { t0: -99, x: 0, y: 0, k: 0 };       // a touch on the water: everything darts away, then comes back
  const tilt = { x: 0, y: 0, tx: 0, ty: 0, on: false };
  const fx2 = document.getElementById('fx2'), ctx2 = fx2.getContext('2d');
  let fish = [], NM = null, fx2Dirty = false;

  const HEART = Array.from({ length: 160 }, (_, i) => { const a = i / 160 * 6.2832, q = Math.sin(a); return [16 * q * q * q, 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)]; });
  const inHeart = (x, y) => { let c = false; for (let i = 0, j = HEART.length - 1; i < HEART.length; j = i++) { const [xi, yi] = HEART[i], [xj, yj] = HEART[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  function heartCells(HW, need) {
    const u = HW / 32;
    let best = null, cost = 1e9;
    for (let cols = 7; cols <= 21; cols += 2) { // odd, so one column sits in the cleft and one at the tip
      const w = HW / cols, h = w * 4 / 3, rows = Math.ceil(30 * u / h) + 1, out = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = -HW / 2 + (c + .5) * w, y = -14.6 * u + (r + .5) * h;
        if (inHeart(x / u / 1.05, (-y / u - 2.45) / 1.05)) out.push({ x, y });
      }
      // the shape never bends to the count: a few spare cells get a second look at a photo, a few spare photos simply stay out of the heart
      const c = Math.abs(out.length - need);
      if (c < cost) { cost = c; best = { cells: out, w, h }; }
    }
    return best;
  }

  // Who sits next to whom in the heart: look-alikes are kept apart, a photo's second copy goes far from the first,
  // and the videos are spread through the whole shape instead of bunching. A few thousand trial swaps settle it.
  function arrange(list, seat, order, cells, hc, r) {
    const n = cells.length, it = new Array(n);
    seat.forEach((j, i) => { if (j >= 0) it[j] = list[i]; });
    if (it.some(x => !x)) return;
    const sg = it.map(m => m.s ? [...m.s].map(c => parseInt(c, 16)) : null);
    const pc = new Float32Array(n * n);
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
      let sim = 0;
      if (sg[a] && sg[b]) { let d = 0; for (let k = 0; k < 36; k++) d += Math.abs(sg[a][k] - sg[b][k]); sim = Math.exp(-d / 36 / 1.5); }
      pc[a * n + b] = pc[b * n + a] = sim + (it[a].k === 'v' && it[b].k === 'v' ? 1.6 : 0) + (it[a].n === it[b].n ? 6 : 0);
    }
    const nb = cells.map((c, i) => { const o = []; cells.forEach((d, j) => { if (i === j) return; const dx = Math.abs(c.x - d.x) / hc.w, dy = Math.abs(c.y - d.y) / hc.h, m = Math.max(dx, dy); if (m < 1.1) o.push([j, dx + dy < 1.1 ? 1 : .6]); else if (m < 2.1) o.push([j, .22]); }); return o; });
    const at = new Array(n); // cell -> slot
    const centre = cells.reduce((b, c, i) => (c.x * c.x + c.y * c.y < cells[b].x ** 2 + cells[b].y ** 2 ? i : b), 0);
    const star = it.findIndex(m => m.n === STAR);
    if (star >= 0) { const o = order.indexOf(centre); [order[star], order[o]] = [order[o], order[star]]; }
    order.forEach((c, j) => { at[c] = j; });
    const local = j => { let v = 0; for (const [c, w] of nb[order[j]]) v += w * pc[j * n + at[c]]; return v; };
    for (let k = 0, K = 26000; k < K; k++) {
      const a = Math.floor(r() * n), b = Math.floor(r() * n); if (a === b || a === star || b === star) continue;
      const before = local(a) + local(b);
      [order[a], order[b]] = [order[b], order[a]]; at[order[a]] = a; at[order[b]] = b;
      const d = local(a) + local(b) - before, T = .25 * (1 - k / K);
      if (d > 0 && r() > Math.exp(-d / Math.max(T, 1e-4))) { [order[a], order[b]] = [order[b], order[a]]; at[order[a]] = a; at[order[b]] = b; }
    }
  }

  function build() {
    const r = rng(20261113);
    const HW = Math.min(W * .92, H * .52);
    const hc = heartCells(HW, Math.max(MEDIA.length, 36));
    const n = hc.cells.length;
    const imgs = MEDIA.filter(m => m.k === 'i');
    const list = MEDIA.slice();
    for (let i = 0; list.length < n; i++) list.push((imgs.length ? imgs : MEDIA)[i % (imgs.length || MEDIA.length)]);
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    const cells = hc.cells.slice().sort((a, b) => (b.y - a.y) || (Math.abs(a.x) - Math.abs(b.x)));
    // more pictures than cells: every video keeps its place, the last photos in the shuffle drift on past the heart
    const seat = new Map(); let left = list.length - n;
    for (let i = list.length - 1; i >= 0 && left > 0; i--) if (list[i].k === 'i') { seat.set(i, -1); left--; }
    for (let i = 0, j = 0; i < list.length; i++) if (!seat.has(i)) seat.set(i, j < n ? j++ : -1);
    const order = cells.map((_, i) => i); // which tile takes which cell
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    arrange(list, seat, order, cells, hc, rng(909));

    const cw = clamp(W * .305, 94, 156), ch = cw * 4 / 3;
    document.documentElement.style.setProperty('--cw', cw + 'px');
    document.documentElement.style.setProperty('--ch', ch + 'px');
    tilesEl.textContent = '';
    let vn = 0;
    tiles = list.map((m, i) => {
      const el = document.createElement('div'); el.className = 'tl';
      let node;
      if (m.k === 'v') {
        node = document.createElement('video');
        node.muted = true; node.defaultMuted = true; node.loop = true; node.playsInline = true; node.preload = 'auto';
        node.setAttribute('muted', ''); node.setAttribute('playsinline', '');
        node.className = 'vd'; node.src = `${DIR}${m.n}.mp4?v=${V}`;
        // her still sits underneath; the video only shows once it is truly running, so a phone that refuses one never leaves a black card
        const still = new Image(); still.alt = ''; still.draggable = false; still.src = m.url || `${DIR}${m.n}.webp?v=${V}`; el.appendChild(still);
        node.addEventListener('timeupdate', () => { if (node.currentTime > 0 && !node.paused) node.classList.add('live'); });
        ['error', 'emptied', 'abort'].forEach(ev => node.addEventListener(ev, () => node.classList.remove('live')));
      } else { node = new Image(); node.decoding = 'async'; node.alt = ''; node.src = (m.url || `${DIR}${m.n}.webp?v=${V}`); }
      node.draggable = false;
      el.appendChild(node); tilesEl.appendChild(el);
      const star = m.n === STAR; // his favourite: always nearest, biggest, and the middle of the heart
      const z0 = m.k === 'v' ? .7 + .3 * r() : Math.pow(r(), .85), z = star ? 1 : z0;
      const out = seat.get(i) < 0, rank = out ? 0 : order[seat.get(i)];
      const sc = star ? 1.24 : lerp(.34, 1.06, Math.pow(z, 1.4)), bz = star ? 46 : 1 + Math.round(z * 40);
      el.style.zIndex = bz; if (star) el.classList.add('star');
            el.addEventListener('click', () => openBig(m));
      return {
        el, m, z, sc, i, bz, star: star ? 1 : 0, sk: hash(i, 9), vid: m.k === 'v' ? node : null, vi: vn += m.k === 'v' ? 1 : 0, on: true, zi: 0, home: false, out, cell: cells[rank], stag: 1.9 * rank / n,
        t0: star ? 0 : B0 - .3 + 11.8 * Math.pow(i / n, 1.5), v: star ? .27 : lerp(.085, .34, z), op: lerp(.5, 1, Math.pow(z, .7)),
        ph: r() * 6.283, sw: lerp(6, 26, r()), fr: lerp(.35, .8, r()), tilt: lerp(-7, 7, r()), swirl: (r() < .5 ? -1 : 1) * lerp(.25, .6, r()), tint: lerp(.5, .04, z),
      };
    });
    const S = tiles.find(T => T.star && !T.out);
    if (S) { // she takes the cell at the heart of the heart
      const C = tiles.filter(T => !T.out).reduce((a, b) => (a.cell.x ** 2 + a.cell.y ** 2 <= b.cell.x ** 2 + b.cell.y ** 2 ? a : b));
      [S.cell, C.cell] = [C.cell, S.cell]; [S.stag, C.stag] = [C.stag, S.stag];
    }
    G = { HW, cw, ch, hs: hc.w * .93 / cw, cx: W / 2, cy: Math.max(H * .41, HW * .56 + H * .06), n };
    endEl.style.top = `${G.cy + HW * .52 + H * .035}px`;
    tilesEl.style.transformOrigin = `50% ${G.cy.toFixed(0)}px`;
    buildName();
    bloom.style.transform = `translate(-50%,-50%)`;
  }

  // ---------- her name, written by a school of small fish ----------
  function buildName() {
    const top = G.cy - G.HW * .5, fs = Math.min(W * .255, top * .64), cy = Math.max(top * .5, fs * .7 + 6);
    const cw = Math.ceil(Math.min(fs * 3.9, W * .98)), chh = Math.ceil(fs * 1.7), c = document.createElement('canvas');
    c.width = cw; c.height = chh;
    const x = c.getContext('2d');
    x.font = `italic 500 ${fs}px Fraunces, Georgia, serif`; x.textBaseline = 'middle';
    const gap = fs * .075, ws = [...'Solixa'].map(ch => x.measureText(ch).width), tw = ws.reduce((a, b) => a + b, 0) + gap * 5;
    [...'Solixa'].reduce((px, ch, i) => { x.font = `${ch === 'x' ? 'italic 500' : 'italic 500'} ${fs}px Fraunces, Georgia, serif`; if (ch === 'x') { x.save(); x.lineWidth = fs * .085; x.lineCap = 'round'; const w = ws[i], m = chh / 2, t = m - fs * .17, b = m + fs * .25; x.beginPath(); x.moveTo(px + w * .12, t); x.lineTo(px + w * .8, b); x.moveTo(px + w * .98, t); x.lineTo(px + w * .02, b); x.stroke(); x.restore(); } else x.fillText(ch, px, chh / 2); return px + ws[i] + gap; }, (cw - tw) / 2);
    const d = x.getImageData(0, 0, cw, chh).data, r = rng(4242);
    let st = Math.max(2.8, fs / 19), pts = [];
    for (let k = 0; k < 6; k++) {
      pts = [];
      for (let j = 0, row = 0; j < chh; j += st * .86, row++) for (let i = (row % 2) * st * .5; i < cw; i += st) {
        if (d[(Math.round(j) * cw + Math.round(i)) * 4 + 3] > 120) pts.push([i, j]);
      }
      if (pts.length <= 430) break; st *= 1.12;
    }
    const x0 = W / 2 - cw / 2, y0 = cy - chh / 2;
    fish = pts.map(([px, py]) => {
      const nx = px / cw;
      return { x: x0 + px, y: y0 + py, d: (1 - nx) * 1.05 + r() * .55, ax: -30 - r() * 90, ay: cy + (r() - .5) * fs * 2.2 + fs * .5, ph: r() * 6.283, L: st * (1.3 + .45 * r()), w: lerp(9, 22, r()), gold: r() < .22, sk: r() };
    });
    NM = { fs, cy, st };
  }
  function fishPos(f, t, out) {
    const u = t - NAME0 - f.d, p = eout(clamp(u / 2.05)), q = 1 - p;
    out.x = lerp(f.ax, f.x, p) + Math.sin(t * 1.3 + f.ph) * .8 * p;
    out.y = lerp(f.ay, f.y, eio(clamp(u / 2.05))) + Math.sin(u * 4.6 + f.ph) * f.w * q + Math.cos(t * 1.7 + f.ph) * .8 * p;
    out.p = p;
  }
  // one dolphin, nose to +x, about one unit long
  function dolphin(c) {
    c.moveTo(.5, .03); c.lineTo(.4, .0);
    c.bezierCurveTo(.38, -.07, .3, -.11, .2, -.115); c.bezierCurveTo(.12, -.125, .05, -.125, 0, -.12);
    c.quadraticCurveTo(-.06, -.2, -.14, -.225); c.quadraticCurveTo(-.1, -.15, -.13, -.1);
    c.bezierCurveTo(-.25, -.07, -.36, 0, -.43, .07);
    c.quadraticCurveTo(-.5, .03, -.58, .04); c.quadraticCurveTo(-.5, .1, -.5, .22); c.quadraticCurveTo(-.45, .16, -.4, .12);
    c.bezierCurveTo(-.3, .1, -.1, .1, .05, .085);
    c.quadraticCurveTo(.04, .16, -.03, .2); c.quadraticCurveTo(.1, .17, .15, .08);
    c.bezierCurveTo(.25, .075, .33, .07, .4, .055); c.lineTo(.5, .03); c.closePath();
  }
  const _a = {}, _b = {};
  function drawName(t, bt) {
    const from = Math.max(NAME0, SC.t0 + .15);
    if (t < NAME0 - .4 || !NM) { if (fx2Dirty) { ctx2.setTransform(1, 0, 0, 1, 0, 0); ctx2.clearRect(0, 0, fx2.width, fx2.height); fx2Dirty = false; } return; }
    const dpr = fx2.width / W; fx2Dirty = true;
    ctx2.setTransform(1, 0, 0, 1, 0, 0); ctx2.clearRect(0, 0, fx2.width, fx2.height);
    // the two that lead the school in (and come by again whenever the water is touched)
    for (let k = 0; k < 2; k++) {
      const u = (t - from - k * .38) / 3.1; if (u < 0 || u > 1) continue;
      const S = W * (k ? .15 : .19), xx = lerp(-S, W + S, u), ph = k * 1.1;
      const yy = NM.cy + NM.fs * (k ? .75 : .2) - Math.sin(u * 9.2 + ph) * NM.fs * .5, ang = Math.atan2(-Math.cos(u * 9.2 + ph) * NM.fs * .5 * 9.2, W + 2 * S);
      const cs = Math.cos(ang) * S * dpr, sn = Math.sin(ang) * S * dpr;
      ctx2.setTransform(cs, sn, -sn, cs, xx * dpr, yy * dpr);
      ctx2.beginPath(); dolphin(ctx2);
      ctx2.globalAlpha = (k ? .62 : .82) * Math.min(1, u * 8, (1 - u) * 8); ctx2.fillStyle = k ? '#bfe6ff' : '#e6f6ff'; ctx2.fill();
    }
    const glow = .82 + .18 * pulse(bt);
    for (let pass = 0; pass < 2; pass++) {
      ctx2.beginPath();
      for (const f of fish) {
        if ((pass === 1) !== f.gold) continue;
        if (t - NAME0 - f.d < 0) continue;
        fishPos(f, t, _a); if (_a.p < 1) fishPos(f, t - .05, _b); else { _b.x = _a.x; _b.y = _a.y; }
        let x = _a.x, y = _a.y, dx = _a.x - _b.x, dy = _a.y - _b.y;
        let ang = Math.atan2(dy, dx) * (1 - span(_a.p, .8, 1)) + Math.sin(t * 2.2 + f.ph) * .16 * _a.p;
        if (SC.k > 0) { const ex = x - SC.x, ey = y - SC.y, el = Math.hypot(ex, ey) || 1, m = SC.k * (26 + 60 * f.sk); x += ex / el * m; y += ey / el * m; ang = lerp(ang, Math.atan2(ey, ex), Math.min(1, SC.k * 3) * (SC.out ? 1 : 0)) + (SC.out ? 0 : Math.PI * SC.k); }
        const L = f.L * dpr, cs = Math.cos(ang) * L, sn = Math.sin(ang) * L;
        ctx2.setTransform(cs, sn, -sn, cs, x * dpr, y * dpr);
        ctx2.moveTo(.52, 0); ctx2.quadraticCurveTo(.12, -.27, -.24, 0); ctx2.quadraticCurveTo(.12, .27, .52, 0);
        ctx2.moveTo(-.18, 0); ctx2.lineTo(-.52, -.22); ctx2.lineTo(-.42, 0); ctx2.lineTo(-.52, .22); ctx2.closePath();
      }
      ctx2.globalAlpha = glow; ctx2.fillStyle = pass ? '#ffd58a' : '#ffe9f0'; ctx2.fill();
    }
    ctx2.globalAlpha = 1;
  }

  // ---------- little things in the water ----------
  let bubbles = [], snow = [], burst = [], sparks = [];
  function seedFx() {
    const r = rng(77);
    bubbles = Array.from({ length: 42 }, () => ({ x: r(), r: lerp(1.5, 8, Math.pow(r(), 2.2)), v: lerp(.55, 1.5, r()), o: r(), ph: r() * 6.283 }));
    snow = Array.from({ length: 70 }, () => ({ x: r(), r: lerp(.5, 1.5, r()), v: lerp(.12, .4, r()), o: r(), a: lerp(.12, .4, r()) }));
    burst = Array.from({ length: 64 }, () => ({ x: r(), y: r(), r: lerp(2, 11, Math.pow(r(), 2)), v: lerp(.5, 1.3, r()), d: r(), ph: r() * 6.283 }));
    sparks = Array.from({ length: 34 }, () => ({ a: r() * 6.283, d: lerp(.56, .86, r()), r: lerp(.8, 2.2, r()), ph: r() * 6.283, f: lerp(1.2, 3, r()) }));
  }
  function bubble(x, y, r, a) {
    if (a <= .01) return;
    ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fillStyle = 'rgba(200,240,255,.10)'; ctx.fill();
    ctx.lineWidth = Math.max(.8, r * .16); ctx.strokeStyle = 'rgba(225,246,255,.75)'; ctx.stroke();
    if (r > 3) { ctx.beginPath(); ctx.arc(x - r * .32, y - r * .34, r * .2, 0, 6.283); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fill(); }
  }
  function drawFx(t, bt) {
    const dpr = fx.width / W;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const D = sink(t) + 1.3 * (1 - Math.exp(-3 * Math.max(t, 0)));
    const SP = H + 60;
    ctx.fillStyle = '#dff4ff';
    for (const s of snow) { const y = H + 30 - ((D * s.v * H + s.o * SP) % SP); ctx.globalAlpha = s.a; ctx.beginPath(); ctx.arc(s.x * W + Math.sin(t * .5 + s.o * 9) * 8, y, s.r, 0, 6.283); ctx.fill(); }
    for (const b of bubbles) { const y = H + 30 - ((D * b.v * H + b.o * SP) % SP); bubble(b.x * W + Math.sin(t * 1.6 + b.ph) * (4 + b.r), y, b.r, .5); }
    if (t < 3.2) for (const b of burst) { // the plunge
      const age = t - b.d * .55; if (age < 0) continue;
      bubble(b.x * W + Math.sin(age * 5 + b.ph) * 9, b.y * H * .9 - age * b.v * H * .62, b.r, .85 * (1 - span(age, .5, 2.4)));
    }
    if (t > WHOLE) { // the heart is whole
      for (const b of burst) {
        const age = t - WHOLE - b.d * .5; if (age < 0 || age > 3.4) continue;
        bubble(G.cx + (b.x - .5) * G.HW * 1.05 + Math.sin(age * 4 + b.ph) * 10, G.cy + (b.y - .3) * G.HW * .8 - age * b.v * H * .3, b.r * .9, .8 * (1 - span(age, 1.2, 3.4)));
      }
      const a = span(t, WHOLE, WHOLE + 1.2), p = pulse(bt);
      for (const s of sparks) {
        const rr = G.HW * s.d * (1 + .03 * p), x = G.cx + Math.cos(s.a + t * .05) * rr, y = G.cy + Math.sin(s.a + t * .05) * rr * .92;
        ctx.globalAlpha = a * (.25 + .75 * Math.pow(.5 + .5 * Math.sin(t * s.f + s.ph), 2)); ctx.fillStyle = '#ffd9e4';
        ctx.beginPath(); ctx.arc(x, y, s.r, 0, 6.283); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- one frame ----------
  function render(t, bt) {
    if (!G) return;
    const D = sink(t), p0 = pulse(bt) * span(t, B0 - .05, B0 + .05);
    const d = eio(span(t, .4, 18.2));
    deep.style.opacity = (d * .97).toFixed(3);
    rays.style.opacity = ((1 - .78 * d) * (.5 + .3 * p0) * span(t, 0, .8)).toFixed(3);
    rays.style.transform = `rotate(${(Math.sin(t * .31) * 3.2).toFixed(2)}deg) translateX(${(Math.sin(t * .23 + 1) * 3).toFixed(2)}%)`;

    const su = t - SC.t0; SC.out = su < .5;
    SC.k = su < 0 || su > 2.1 ? 0 : eout(span(su, 0, .42)) * (1 - eio(span(su, .95, 2.1)));
    const whole = span(t, WHOLE, WHOLE + .5);
    const hb = 1 + .034 * pulse(bt) * whole + .1 * Math.sin(Math.PI * span(t, WHOLE, WHOLE + .6)) * (t < WHOLE + .6 ? 1 : 0);
    const bob = Math.sin(t * .9) * 4 * whole;

    for (const T of tiles) {
      const s = T.el.style;
      if (t < T.t0 && t < GATHER) { s.opacity = 0; T.vis = false; continue; }
      if (T.out && t > GATHER + 1.4) { if (!T.home) { T.home = true; s.opacity = 0; s.transform = 'translate3d(-9999px,0,0)'; } T.vis = false; continue; }
      if (T.out && T.home) T.home = false;
      // adrift
      const m = G.ch * T.sc, SPAN = H + 2 * m;
      // the one he looked at first hangs alone in the middle until the song comes in, then the sea takes it like the rest
      const run = T.star ? H + m - H * .47 + Math.max(0, D - B0) * T.v * H : Math.max(0, (D - T.t0)) * T.v * H, pass = Math.floor(run / SPAN);
      let y = H + m - (run - pass * SPAN);
      let x = W * (T.star ? lerp(.32, .68, hash(T.i, pass)) : lerp(.1, .9, hash(T.i, pass))) + Math.sin(t * T.fr + T.ph) * T.sw;
      let sc = T.sc * (1 + .05 * p0 * T.z), rz = T.tilt + Math.sin(t * T.fr * .8 + T.ph) * 5, ry = Math.sin(t * .7 + T.ph) * 16, rx = Math.cos(t * .55 + T.ph) * 7;
      let op = T.op * span(t, T.t0, T.t0 + .5);
      if (tilt.on) { x += tilt.x * (T.z - .35) * 40; y += tilt.y * (T.z - .35) * 28; } // nearer ones slide further when the phone leans
      if (T.star && t < B0 + 1.4) {
        const k = eio(span(t, B0 - .1, B0 + 1.3));
        x = lerp(W / 2, x, k); y += (1 - k) * Math.sin(t * 1.1) * 7;
        sc = lerp(Math.min(W * .62 / G.cw, H * .42 / G.ch), sc, k);
        rz = lerp(-2 + Math.sin(t * .9) * 1.6, rz, k); ry *= .25 + .75 * k; rx *= .25 + .75 * k;
        op = span(t, .15, 1.1);
      }
      // home
      const g0 = GATHER + T.stag, g = T.out ? 0 : span(t, g0, g0 + 1.62);
      if (T.out) op *= 1 - span(t, GATHER, GATHER + 1.3);
      if (g > 0) {
        const p = eio(g), hx = G.cx + T.cell.x * hb, hy = G.cy + T.cell.y * hb + bob;
        const dx = hx - x, dy = hy - y, arc = Math.sin(Math.PI * p) * T.swirl;
        x = lerp(x, hx, p) - dy * arc; y = lerp(y, hy, p) + dx * arc;
        sc = lerp(sc, G.hs * hb * (T.star ? 1.34 : 1), p) * (1 + .16 * Math.sin(Math.PI * span(t, g0 + 1.5, g0 + 1.95)));
        if (whole > 0) sc *= 1 + .06 * whole * pulse(bt - .5 * Math.hypot(T.cell.x, T.cell.y) / G.HW); // each beat rolls outward from the middle
        rz = lerp(rz, 0, p) + 200 * T.swirl * (1 - p) * p; ry = lerp(ry, 0, p); rx = lerp(rx, 0, p);
        if (SC.k > 0) { const ex = hx - SC.x, ey = hy - SC.y, el = Math.hypot(ex, ey) || 1, m = SC.k * (W * .2 + G.HW * .55 * T.sk); x += ex / el * m; y += ey / el * m; rz += SC.k * T.swirl * 150; ry += SC.k * 40 * (T.sk - .5); sc *= 1 - .1 * SC.k; }
        op = lerp(op, 1, span(g, 0, .5));
      }
      T.vis = g > 0 || (y > -m && y < H + m);
      // only touch what changed: these writes are what make a phone stutter mid-flight
      const zi = g <= 0 ? 0 : g >= 1 ? 50 : 60;
      if (zi !== T.zi) { T.zi = zi; s.zIndex = zi ? zi + T.star * 2 : T.bz; }
      s.opacity = op.toFixed(3);
      s.transform = `translate3d(${(x - G.cw / 2).toFixed(1)}px,${(y - G.ch / 2).toFixed(1)}px,0) rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg) rotate(${rz.toFixed(1)}deg) scale(${sc.toFixed(4)})`;
    }

    for (const el of lines) {
      const a = beat(+el.dataset.in), b = beat(+el.dataset.out);
      const i = eout(span(t, a, a + .8)), o = span(t, b - .45, b + .15);
      el.style.opacity = (i * (1 - o)).toFixed(3);
      el.style.transform = `translateY(${(lerp(18, 0, i) - 14 * o + Math.sin(t * 1.1) * 2).toFixed(1)}px) scale(${(lerp(.96, 1, i)).toFixed(3)})`;
    }
    const e = eout(span(t, WHOLE + .1, WHOLE + 1.1));
    endEl.style.opacity = e.toFixed(3);
    endEl.style.transform = `translateY(${lerp(22, 0, e).toFixed(1)}px)`;

    const hit = Math.exp(-3.2 * Math.max(0, t - GATHER)) * (t >= GATHER ? .5 : 0);
    const glow = t >= WHOLE ? .34 + .5 * Math.exp(-1.1 * (t - WHOLE)) + .1 * pulse(bt) : 0;
    bloom.style.opacity = Math.max(hit, glow).toFixed(3);
    const bs = G.HW * (t >= WHOLE ? 1.75 * hb : lerp(.6, 2.6, eout(span(t, GATHER, GATHER + 1.2)))) / 10;
    bloom.style.transform = `translate(-50%,-50%) translateY(${G.cy.toFixed(0)}px) scale(${bs.toFixed(2)})`;

    if (tilt.on) {
      tilesEl.style.transform = `perspective(900px) rotateY(${(tilt.x * 7).toFixed(2)}deg) rotateX(${(-tilt.y * 5).toFixed(2)}deg)`;
      fx2.style.transform = `translate3d(${(-tilt.x * 9).toFixed(1)}px,${(-tilt.y * 7).toFixed(1)}px,0)`;
      rays.style.transform += ` translateX(${(-tilt.x * 2.5).toFixed(2)}%)`;
    }
    drawFx(t, bt); drawName(t, bt);
  }

  function layout() {
    W = innerWidth; H = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    fx.width = Math.round(W * Math.min(dpr, 1.5)); fx.height = Math.round(H * Math.min(dpr, 1.5)); // bubbles are soft anyway
    fx2.width = Math.round(W * dpr); fx2.height = Math.round(H * dpr);
    build();
  }

  // ---------- clock ----------
  const q = new URLSearchParams(location.search);
  const AT = q.has('at') ? parseFloat(q.get('at')) : null;
  let state = 'wait', aP = 0, aT = 0, finAt = 0, tNow = 0;

  // The song is the clock, but a phone reports its position in coarse steps. Snapping to each report makes the
  // film hitch; instead time runs on the screen's own clock and is only leaned, gently, toward the song.
  let lastT = 0;
  function clock() {
    const ct = song.currentTime, n = performance.now();
    let est = aT + (n - aP) / 1000;
    const err = ct - est;
    if (song.paused || Math.abs(err) > .3) { aP = n; aT = ct; est = ct; lastT = ct; return est; }
    aT += err * .03;
    est = Math.max(lastT, est + err * .03); lastT = est;
    return est;
  }
  function frame() {
    requestAnimationFrame(frame);
    if (tilt.on) { tilt.x += (tilt.tx - tilt.x) * .09; tilt.y += (tilt.ty - tilt.y) * .09; }
    if (AT != null) { tNow = AT; render(AT, AT); return; }
    if (state === 'wait') { render(0, 0); return; }
    if (state === 'play') {
      tNow = clock();
      if (tNow >= END - .03 || song.ended) return fin();
      render(tNow, tNow);
    } else { tNow = END + (performance.now() - finAt) / 1000; render(tNow, clock()); }
  }
  const MAXV = 6;
  function playAll() { // (frozen test frames only)
    tilesEl.querySelectorAll('video').forEach(v => { if (v.error) { v.classList.remove('live'); v.load(); } if (!v.paused && !v.ended) return; const p = v.play(); if (p) p.catch(() => {}); });
  }
  // Only a few clips run at any moment: the favourite, then whichever are on screen, taking turns once the heart is whole.
  // The rest hold their last frame over their own still, so nothing ever goes dark.
  function cast() {
    const vs = tiles.filter(T => T.vid && T.vis);
    const turn = Math.floor(tNow / 3.2);
    const score = T => (T.star ? 1e6 : 0) + (tNow >= WHOLE ? ((T.vi + turn * 5) % 18) : (T.vid.paused ? 0 : 50) + T.z * 10);
    vs.sort((a, b) => score(b) - score(a));
    const on = new Set(vs.slice(0, MAXV));
    for (const T of tiles) {
      const v = T.vid; if (!v) continue;
      if (on.has(T)) { if (v.error) { v.classList.remove('live'); v.load(); } if (v.paused || v.ended) { const p = v.play(); if (p) p.catch(() => {}); } }
      else if (!v.paused) v.pause();
    }
  }
  setInterval(() => { if (state !== 'wait' && !document.hidden && AT == null) cast(); }, 400);
  function start() {
    state = 'play'; sea.classList.remove('is-fin');
    song.loop = false; song.volume = 1; song.muted = false; SC.t0 = -99;
    try { song.currentTime = 0; } catch (e) {}
    aP = performance.now(); aT = 0; lastT = 0;
    const p = song.play(); if (p) p.catch(() => { resume.hidden = false; });
    cast();
  }
  function fin() {
    if (state === 'fin') return;
    state = 'fin'; finAt = performance.now(); sea.classList.add('is-fin');
    song.loop = true; song.volume = .75;
    try { song.currentTime = 0; } catch (e) {}
    const p = song.play(); if (p) p.catch(() => {});
  }
  song.addEventListener('pause', () => { if (state !== 'wait' && !song.ended && AT == null) setTimeout(() => { if (song.paused) resume.hidden = false; }, 250); });
  song.addEventListener('play', () => { resume.hidden = true; });
  song.addEventListener('ended', () => { if (state === 'play') fin(); });
  resume.addEventListener('click', () => { resume.hidden = true; const p = song.play(); if (p) p.catch(() => { resume.hidden = false; }); cast(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state !== 'wait' && song.paused) resume.hidden = false; });
  $('again').addEventListener('click', start);
  // leaning the phone: gyroscope where there is one, the mouse on a desktop
  let g0 = null, b0 = null;
  function onTilt(e) {
    if (e.gamma == null || e.beta == null) return;
    if (g0 == null) { g0 = e.gamma; b0 = e.beta; }
    g0 += (e.gamma - g0) * .004; b0 += (e.beta - b0) * .004; // however she holds it becomes the new level
    tilt.tx = clamp((e.gamma - g0) / 22, -1, 1); tilt.ty = clamp((e.beta - b0) / 22, -1, 1); tilt.on = true;
  }
  function listenTilt() { addEventListener('deviceorientation', onTilt); }
  addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; tilt.tx = clamp((e.clientX / W - .5) * 2, -1, 1); tilt.ty = clamp((e.clientY / H - .5) * 2, -1, 1); tilt.on = true; });
  sea.addEventListener('click', e => { if (state !== 'fin' || tNow - SC.t0 < 2.2 || e.target.closest('.tl,.btn')) return; SC.t0 = tNow; SC.x = e.clientX; SC.y = e.clientY; });

  let going = false;
  gate.addEventListener('click', () => {
    if (gate.disabled || going) return; going = true;
    const go = () => { gate.classList.add('open'); start(); };
    const DO = window.DeviceOrientationEvent;
    if (DO && typeof DO.requestPermission === 'function') {
      // iPhone asks before it shares its tilt. The song is woken (silently) inside this same tap so it is still free to play once she has answered.
      song.muted = true; const p = song.play(); if (p) p.catch(() => {});
      let done = false; const fin1 = ok => { if (done) return; done = true; if (ok) listenTilt(); go(); };
      try { DO.requestPermission().then(r => fin1(r === 'granted'), () => fin1(false)); } catch (e) { fin1(false); }
    } else { if (DO) listenTilt(); go(); }
  });

  function openBig(m) {
    if (state !== 'fin') return;
    lb.textContent = '';
    let n;
    if (m.k === 'v') { n = document.createElement('video'); n.muted = true; n.loop = true; n.playsInline = true; n.autoplay = true; n.setAttribute('playsinline', ''); n.poster = `${DIR}${m.n}.webp?v=${V}`; n.src = `${DIR}${m.n}b.mp4?v=${V}`; }
    else { n = new Image(); n.alt = ''; n.src = `${DIR}${m.n}b.webp?v=${V}`; }
    lb.appendChild(n); lb.hidden = false;
  }
  lb.addEventListener('click', () => { lb.hidden = true; lb.textContent = ''; });

  // ---------- nothing starts until every picture and the song are in hand ----------
  function fetchRetry(url, tries = 4) {
    return fetch(url).then(r => { if (!r.ok) throw 0; return r.blob(); })
      .catch(e => tries > 1 ? new Promise(ok => setTimeout(ok, 600)).then(() => fetchRetry(url, tries - 1)) : Promise.reject(e));
  }
  function prepare() {
    let done = 0; const total = MEDIA.length + 1;
    const step = x => { done++; gateBar.style.width = `${Math.round(done / total * 100)}%`; return x; };
    const pics = MEDIA.map(m => fetchRetry(`${DIR}${m.n}.webp?v=${V}`).then(b => { m.url = URL.createObjectURL(b); }).then(step, step));
    const audio = fetchRetry(`assets/audio/okean.mp3?v=${V}`).then(b => { song.src = URL.createObjectURL(b); }, () => { song.src = `assets/audio/okean.mp3?v=${V}`; }).then(step);
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => {}) : 0;
    return Promise.all([...pics, audio, fonts]);
  }

  seedFx();
  addEventListener('resize', layout);
  prepare().then(() => {
    layout();
    if (q.has('sc')) { SC.t0 = +q.get('sc'); SC.x = W / 2; SC.y = G.cy; }
    if (q.has('tilt')) { tilt.on = true; tilt.x = tilt.tx = +q.get('tilt'); tilt.y = tilt.ty = .6 * tilt.x; }
    if (AT != null) { gate.style.display = 'none'; if (AT >= END) sea.classList.add('is-fin'); playAll(); }
    else { gate.disabled = false; gate.classList.add('ready'); gateMsg.textContent = 'Bosing'; }
    requestAnimationFrame(frame);
  });
  window.__okean = { get t() { return tNow; }, get state() { return state; }, get n() { return tiles.length; } };
})();
