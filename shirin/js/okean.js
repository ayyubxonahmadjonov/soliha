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
  const V = 3;

  // the song: 67.4 bpm, first downbeat at B0
  const BEAT = .89, B0 = 3.61, END = 22.29;
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

  const HEART = Array.from({ length: 160 }, (_, i) => { const a = i / 160 * 6.2832, q = Math.sin(a); return [16 * q * q * q, 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)]; });
  const inHeart = (x, y) => { let c = false; for (let i = 0, j = HEART.length - 1; i < HEART.length; j = i++) { const [xi, yi] = HEART[i], [xj, yj] = HEART[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  function heartCells(HW, need) {
    const u = HW / 32;
    for (let cols = 7; cols <= 21; cols += 2) { // odd, so one column sits in the cleft and one at the tip
      const w = HW / cols, h = w * 4 / 3, rows = Math.ceil(30 * u / h) + 1, out = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = -HW / 2 + (c + .5) * w, y = -14.6 * u + (r + .5) * h;
        if (inHeart(x / u / 1.05, (-y / u - 2.45) / 1.05)) out.push({ x, y });
      }
      if (out.length >= need) return { cells: out, w, h };
    }
    return null;
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
    const order = cells.map((_, i) => i); // which tile takes which cell
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }

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
        node.muted = true; node.defaultMuted = true; node.loop = true; node.playsInline = true; node.autoplay = true; node.preload = 'auto';
        node.setAttribute('muted', ''); node.setAttribute('playsinline', '');
        node.poster = `${DIR}${m.n}.webp?v=${V}`; node.src = `${DIR}${m.n}.mp4?v=${V}`;
      } else { node = new Image(); node.decoding = 'async'; node.alt = ''; node.src = (m.url || `${DIR}${m.n}.webp?v=${V}`); }
      node.draggable = false;
      el.appendChild(node); tilesEl.appendChild(el);
      const z = m.k === 'v' ? .7 + .3 * r() : Math.pow(r(), .85);
      const rank = order[i];
      const sc = lerp(.34, 1.06, Math.pow(z, 1.4));
      el.style.zIndex = 1 + Math.round(z * 40);
      el.style.setProperty('--tint', (lerp(.5, .04, z)).toFixed(2));
      el.addEventListener('click', () => openBig(m));
      return {
        el, m, z, sc, i, vid: m.k === 'v' ? node : null, vi: vn += m.k === 'v' ? 1 : 0, on: true, zi: 0, home: false, cell: cells[rank], stag: 1.9 * rank / n,
        t0: .3 + 12 * Math.pow(i / n, 1.2), v: lerp(.085, .34, z), op: lerp(.5, 1, Math.pow(z, .7)),
        ph: r() * 6.283, sw: lerp(6, 26, r()), fr: lerp(.35, .8, r()), tilt: lerp(-7, 7, r()), swirl: (r() < .5 ? -1 : 1) * lerp(.25, .6, r()), tint: lerp(.5, .04, z),
      };
    });
    G = { HW, cw, ch, hs: hc.w * .93 / cw, cx: W / 2, cy: Math.max(H * .41, HW * .56 + H * .06), n };
    endEl.style.top = `${G.cy + HW * .52 + H * .035}px`;
    bloom.style.transform = `translate(-50%,-50%)`;
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
    const d = eio(span(t, .4, 16.4));
    deep.style.opacity = (d * .97).toFixed(3);
    rays.style.opacity = ((1 - .78 * d) * (.5 + .3 * p0) * span(t, 0, .8)).toFixed(3);
    rays.style.transform = `rotate(${(Math.sin(t * .31) * 3.2).toFixed(2)}deg) translateX(${(Math.sin(t * .23 + 1) * 3).toFixed(2)}%)`;

    const whole = span(t, WHOLE, WHOLE + .5);
    const hb = 1 + .034 * pulse(bt) * whole + .1 * Math.sin(Math.PI * span(t, WHOLE, WHOLE + .6)) * (t < WHOLE + .6 ? 1 : 0);
    const bob = Math.sin(t * .9) * 4 * whole;

    for (const T of tiles) {
      const s = T.el.style;
      if (t < T.t0 && t < GATHER) { s.opacity = 0; continue; }
      // adrift
      const m = G.ch * T.sc, SPAN = H + 2 * m;
      const run = Math.max(0, (D - T.t0)) * T.v * H, pass = Math.floor(run / SPAN);
      let y = H + m - (run - pass * SPAN);
      let x = W * lerp(.1, .9, hash(T.i, pass)) + Math.sin(t * T.fr + T.ph) * T.sw;
      let sc = T.sc * (1 + .05 * p0 * T.z), rz = T.tilt + Math.sin(t * T.fr * .8 + T.ph) * 5, ry = Math.sin(t * .7 + T.ph) * 16, rx = Math.cos(t * .55 + T.ph) * 7;
      let op = T.op * span(t, T.t0, T.t0 + .5);
      // home
      const g0 = GATHER + T.stag, g = span(t, g0, g0 + 1.62);
      if (g > 0) {
        const p = eio(g), hx = G.cx + T.cell.x * hb, hy = G.cy + T.cell.y * hb + bob;
        const dx = hx - x, dy = hy - y, arc = Math.sin(Math.PI * p) * T.swirl;
        x = lerp(x, hx, p) - dy * arc; y = lerp(y, hy, p) + dx * arc;
        sc = lerp(sc, G.hs * hb, p) * (1 + .16 * Math.sin(Math.PI * span(t, g0 + 1.5, g0 + 1.95)));
        rz = lerp(rz, 0, p) + 200 * T.swirl * (1 - p) * p; ry = lerp(ry, 0, p); rx = lerp(rx, 0, p);
        op = lerp(op, 1, span(g, 0, .5));
      }
      // only touch what changed: these writes are what make a phone stutter mid-flight
      const zi = g <= 0 ? 0 : g >= 1 ? 50 : 60;
      if (zi !== T.zi) { T.zi = zi; s.zIndex = zi || 1 + Math.round(T.z * 40); }
      if ((g > 0) !== T.home) { T.home = g > 0; T.el.classList.toggle('home', T.home); }
      if (T.vid) { // eighteen decoders at once is too much while everything is flying
        const on = !(t >= GATHER - .05 && t < WHOLE + .5 + T.vi * .1);
        if (on !== T.on) { T.on = on; if (on) { const pr = T.vid.play(); if (pr) pr.catch(() => {}); } else T.vid.pause(); }
      }
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

    drawFx(t, bt);
  }

  function layout() {
    W = innerWidth; H = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    fx.width = Math.round(W * dpr); fx.height = Math.round(H * dpr);
    build();
  }

  // ---------- clock ----------
  const q = new URLSearchParams(location.search);
  const AT = q.has('at') ? parseFloat(q.get('at')) : null;
  let state = 'wait', aP = 0, aT = 0, finAt = 0, tNow = 0;

  function clock() {
    const ct = song.currentTime, n = performance.now();
    let est = aT + (n - aP) / 1000;
    if (song.paused || Math.abs(est - ct) > .09) { aP = n; aT = ct; est = ct; }
    return est;
  }
  function frame() {
    requestAnimationFrame(frame);
    if (AT != null) { tNow = AT; render(AT, AT); return; }
    if (state === 'wait') { render(0, 0); return; }
    if (state === 'play') {
      tNow = clock();
      if (tNow >= END - .03 || song.ended) return fin();
      render(tNow, tNow);
    } else { tNow = END + (performance.now() - finAt) / 1000; render(tNow, clock()); }
  }
  function playAll() { tilesEl.querySelectorAll('video').forEach(v => { const p = v.play(); if (p) p.catch(() => {}); }); }
  function start() {
    state = 'play'; sea.classList.remove('is-fin');
    song.loop = false; song.volume = 1;
    try { song.currentTime = 0; } catch (e) {}
    aP = performance.now(); aT = 0;
    const p = song.play(); if (p) p.catch(() => { resume.hidden = false; });
    playAll();
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
  resume.addEventListener('click', () => { resume.hidden = true; const p = song.play(); if (p) p.catch(() => { resume.hidden = false; }); playAll(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state !== 'wait' && song.paused) resume.hidden = false; });
  $('again').addEventListener('click', start);
  gate.addEventListener('click', () => { if (gate.disabled) return; gate.classList.add('open'); start(); });

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
    const pics = MEDIA.map(m => fetchRetry(`${DIR}${m.n}.webp?v=${V}`).then(b => { if (m.k === 'i') m.url = URL.createObjectURL(b); }).then(step, step));
    const audio = fetchRetry(`assets/audio/okean.mp3?v=${V}`).then(b => { song.src = URL.createObjectURL(b); }, () => { song.src = `assets/audio/okean.mp3?v=${V}`; }).then(step);
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready.catch(() => {}) : 0;
    return Promise.all([...pics, audio, fonts]);
  }

  seedFx();
  addEventListener('resize', layout);
  prepare().then(() => {
    layout();
    if (AT != null) { gate.style.display = 'none'; if (AT >= END) sea.classList.add('is-fin'); playAll(); }
    else { gate.disabled = false; gate.classList.add('ready'); gateMsg.textContent = 'Bosing'; }
    requestAnimationFrame(frame);
  });
  window.__okean = { get t() { return tNow; }, get state() { return state; }, get n() { return tiles.length; } };
})();
