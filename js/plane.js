/* The letter becomes a paper plane.

   The sheet is cut along every crease up front; each piece remembers which folds
   carry it, so any moment of the folding can be computed from the flat sheet. It is
   drawn with a small 3D projection on a fixed canvas, which keeps the photo and the
   writing on the paper through every fold. */
window.PaperPlane = (() => {
'use strict';
const PI = Math.PI, rad = d => d * PI / 180;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(2 - 2 * t, 3) / 2);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

const FOCAL = 1200;
const LIGHT = [-.26, .46, .85];
const BACK = '#a8121e';            // the reverse of the paper
const GOLD = ['#fff1b8', '#f4cf83', '#e9b46a'];
const FOLD_TIME = 2.5;             // seconds
const FOLD_Z = -560, FLY_TIME = 3.3;
const AB = 4;                      // the first four folds lie flat, the rest shape the plane
const EPS = 1e-6;

/* Classic dart: corners to the centre, edges to the centre, wings, keel.
   Wings come before the keel in the maths (they ride on it), after it in time. */
function makeFolds(W, H) {
  const a = W / 2, top = H / 2, bot = -H / 2, nose = [0, top, 0], centre = [0, 0, 0];
  const s45 = Math.SQRT1_2, c22 = Math.cos(rad(22.5)), s22 = Math.sin(rad(22.5));
  const wx = a * .3, wl = Math.hypot(wx, top - bot), wa = (top - bot) / wl, wb = wx / wl;
  // D is chosen so that a positive angle lifts the S side towards the viewer.
  const fold = (P, sx, sy, ang, lift, from, to) => ({ P, S: [sx, sy, 0], D: [sy, -sx, 0], ang, lift, from, to });
  return [
    fold(nose, s45, s45, PI, .7, 0, .55),
    fold(nose, -s45, s45, PI, .7, .12, .67),
    fold(nose, c22, s22, PI, 1.8, .72, 1.22),
    fold(nose, -c22, s22, PI, 1.8, .84, 1.34),
    fold(nose, wa, wb, -rad(72), 0, 1.98, 2.5),
    fold(nose, -wa, wb, -rad(72), 0, 1.98, 2.5),
    fold(centre, 1, 0, rad(82), 0, 1.44, 1.98),
    fold(centre, -1, 0, rad(82), 0, 1.44, 1.98)
  ];
}

function place(q, flags, folds, amt) {
  let x = q[0], y = q[1], z = q[2] || 0;
  for (let i = 0; i < folds.length; i++) {
    const k = flags[i] ? amt[i] : 0;
    if (!k) continue;
    const F = folds[i], th = F.ang * k, c = Math.cos(th), s = Math.sin(th);
    const dx = x - F.P[0], dy = y - F.P[1], dz = z - F.P[2];
    const u = F.D[0], v = F.D[1], w = F.D[2], d = u * dx + v * dy + w * dz;
    x = F.P[0] + dx * c + (v * dz - w * dy) * s + u * d * (1 - c);
    y = F.P[1] + dy * c + (w * dx - u * dz) * s + v * d * (1 - c);
    z = F.P[2] + dz * c + (u * dy - v * dx) * s + w * d * (1 - c) + F.lift * k;
  }
  return [x, y, z];
}

const flatArea = v => {
  let s = 0;
  for (let i = 0; i < v.length; i++) { const a = v[i], b = v[(i + 1) % v.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return s / 2;
};

function cut(W, H, folds) {
  const a = W / 2, b = H / 2, full = folds.map(() => 1);
  let pieces = [{ v: [[-a, -b], [a, -b], [a, b], [-a, b]], f: [] }];
  folds.forEach((F, i) => {
    const next = [];
    for (const pc of pieces) {
      const dist = pc.v.map(q => {
        const p = place(q, pc.f, folds, full);
        return (p[0] - F.P[0]) * F.S[0] + (p[1] - F.P[1]) * F.S[1];
      });
      const pos = [], neg = [], n = pc.v.length;
      for (let k = 0; k < n; k++) {
        const A = pc.v[k], B = pc.v[(k + 1) % n], da = dist[k], db = dist[(k + 1) % n];
        if (da >= -EPS) pos.push(A);
        if (da <= EPS) neg.push(A);
        if ((da > EPS && db < -EPS) || (da < -EPS && db > EPS)) {
          const t = da / (da - db), X = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t];
          pos.push(X); neg.push(X);
        }
      }
      const keep = (v, flag) => {
        if (v.length < 3 || flatArea(v) < 1) return;
        const f = pc.f.slice(); f[i] = flag;
        next.push({ v, f });
      };
      keep(pos, 1); keep(neg, 0);
    }
    pieces = next;
  });
  return pieces.map(pc => {
    // Widest triangle: maps the texture and gives the normal, whatever the piece's shape.
    let tri = [0, 1, 2], best = 0;
    for (let j = 1; j < pc.v.length - 1; j++) {
      const area = Math.abs(flatArea([pc.v[0], pc.v[j], pc.v[j + 1]]));
      if (area > best) { best = area; tri = [0, j, j + 1]; }
    }
    return {
      ...pc, tri,
      group: pc.f.slice(AB).join(''),                     // pieces that stay coplanar once flat
      shape: pc.f.map((x, i) => (i < AB ? 0 : x))         // the folds that orient that surface
    };
  });
}

function create(rect, tex) {
  const W = rect.width, H = rect.height;
  const folds = makeFolds(W, H), pieces = cut(W, H, folds);
  const cv = document.createElement('canvas');
  cv.className = 'plane';
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const g = cv.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, 2);

  const amt = folds.map(() => 0), flatAmt = amt.slice();
  const pose = { cx: rect.left + W / 2, cy: rect.top + H / 2, z: 0, h: 0, pitch: 0, roll: 0 };
  const cy0 = pose.cy, sy0 = scrollY, dust = [];
  let VW = 0, VH = 0, raf = 0, dead = false, glued = true, bob = 0, planeGone = false;

  const fit = () => {
    VW = cv.clientWidth; VH = cv.clientHeight;
    const w = Math.round(VW * dpr), h = Math.round(VH * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  };

  function view(p) {
    const cr = Math.cos(pose.roll), sr = Math.sin(pose.roll);
    const cp = Math.cos(pose.pitch), sp = Math.sin(pose.pitch);
    const ch = Math.cos(pose.h), sh = Math.sin(pose.h);
    const x = p[0] * cr + p[2] * sr, y = p[1], z = -p[0] * sr + p[2] * cr;
    const y2 = y * cp - z * sp, z2 = y * sp + z * cp;
    return [x * ch - y2 * sh, x * sh + y2 * ch, z2 + pose.z];
  }
  function project(p) {
    const s = FOCAL / (FOCAL - p[2]);
    return [pose.cx + p[0] * s, pose.cy - p[1] * s];
  }
  const trace = q => { g.beginPath(); q.forEach((p, i) => g[i ? 'lineTo' : 'moveTo'](p[0], p[1])); g.closePath(); };

  function drawPiece(it) {
    const pc = it.pc, q = it.q, pts = it.pts, [i0, i1, i2] = pc.tri;
    let cx = 0, cy = 0;
    q.forEach(p => { cx += p[0]; cy += p[1]; }); cx /= q.length; cy /= q.length;
    // A hair larger than the piece, so neighbours leave no seam between them.
    const grown = q.map(p => { const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1; return [p[0] + dx / l * .6, p[1] + dy / l * .6]; });

    let area = 0;
    for (let i = 0; i < q.length; i++) { const a = q[i], b = q[(i + 1) % q.length]; area += a[0] * b[1] - b[0] * a[1]; }
    const front = area < 0;       // the flat sheet is counter-clockwise, and the screen's y runs down

    if (front) {
      const uv = v => [v[0] + W / 2, H / 2 - v[1]];
      const [u0, v0] = uv(pc.v[i0]), [u1, v1] = uv(pc.v[i1]), [u2, v2] = uv(pc.v[i2]);
      const [x0, y0] = q[i0], [x1, y1] = q[i1], [x2, y2] = q[i2];
      const det = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
      if (Math.abs(det) > 1e-6) {
        const A = ((x1 - x0) * (v2 - v0) - (x2 - x0) * (v1 - v0)) / det;
        const C = ((x2 - x0) * (u1 - u0) - (x1 - x0) * (u2 - u0)) / det;
        const B = ((y1 - y0) * (v2 - v0) - (y2 - y0) * (v1 - v0)) / det;
        const D = ((y2 - y0) * (u1 - u0) - (y1 - y0) * (u2 - u0)) / det;
        g.save();
        trace(grown); g.clip();
        g.setTransform(dpr * A, dpr * B, dpr * C, dpr * D, dpr * (x0 - A * u0 - C * v0), dpr * (y0 - B * u0 - D * v0));
        g.drawImage(tex, 0, 0, W, H);
        g.restore();
      }
    } else {
      trace(grown); g.fillStyle = BACK; g.fill();
    }

    // Light: nothing on a flat sheet, so the hand-over from the page is invisible.
    const a = pts[i0], b = pts[i1], c = pts[i2];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const nl = Math.hypot(nx, ny, nz) || 1, sign = nz < 0 ? -1 : 1;
    nx *= sign / nl; ny *= sign / nl; nz *= sign / nl;
    const delta = LIGHT[2] - (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
    if (Math.abs(delta) > .004) {
      trace(grown);
      g.fillStyle = delta > 0 ? `rgba(96,34,20,${Math.min(.5, delta * .62)})` : `rgba(255,240,220,${Math.min(.3, -delta * .7)})`;
      g.fill();
    }
    // A fine foil line along the folded edges.
    if (it.foil > 0 && !front) {
      trace(q);
      g.strokeStyle = `rgba(246,214,160,${.5 * it.foil})`;
      g.lineWidth = .7;
      g.stroke();
    }
  }

  function drawDust(dt) {
    g.globalCompositeOperation = 'lighter';
    for (let i = dust.length - 1; i >= 0; i--) {
      const d = dust[i];
      d.age += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 26 * dt; d.vx *= .985;
      const k = d.age / d.life;
      if (k >= 1) { dust.splice(i, 1); continue; }
      const a = (1 - k) * (.55 + .45 * Math.sin(d.age * d.tw));
      g.fillStyle = d.c; g.globalAlpha = clamp(a);
      if (d.r > 2) {
        const r = d.r * 1.9, w = d.r * .24;
        g.beginPath();
        g.moveTo(d.x, d.y - r); g.lineTo(d.x + w, d.y - w); g.lineTo(d.x + r, d.y); g.lineTo(d.x + w, d.y + w);
        g.lineTo(d.x, d.y + r); g.lineTo(d.x - w, d.y + w); g.lineTo(d.x - r, d.y); g.lineTo(d.x - w, d.y - w);
        g.closePath(); g.fill();
      } else {
        g.beginPath(); g.arc(d.x, d.y, d.r, 0, 6.29); g.fill();
      }
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }

  function draw(dt = 0) {
    fit();
    if (glued) pose.cy = cy0 + (sy0 - scrollY) + bob;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, VW, VH);
    drawDust(dt);
    if (planeGone) return;

    // The page's shadow under the sheet, fading as it stops being a flat sheet.
    const shade = 1 - amt[2];
    if (shade > 0) {
      g.save();
      g.shadowColor = `rgba(18,0,4,${.55 * shade})`;
      g.shadowBlur = 36 * dpr; g.shadowOffsetX = 5000 * dpr; g.shadowOffsetY = 18 * dpr;
      g.fillStyle = '#000';
      g.fillRect(pose.cx - W / 2 - 5000, pose.cy - H / 2, W, H);
      g.restore();
    }

    for (let i = 0; i < AB; i++) flatAmt[i] = amt[i];
    const shaped = amt.slice(AB).some(Boolean);
    const foil = amt[6];
    const items = pieces.map(pc => {
      const pts = pc.v.map(q => view(place(q, pc.f, folds, amt)));
      let z = 0, layer = 0;
      pc.v.forEach((q, i) => { z += pts[i][2]; layer += place(q, pc.f, folds, flatAmt)[2]; });
      return { pc, pts, q: pts.map(project), z: z / pts.length, layer: layer / pts.length, foil };
    });

    if (!shaped) {
      items.sort((a, b) => a.layer - b.layer);
    } else {
      // Sorting by depth alone would shuffle the layers of a surface as the plane
      // tilts: order the surfaces by depth, and layers by which way the surface faces.
      const groups = new Map();
      for (const it of items) {
        const G = groups.get(it.pc.group) || { n: 0, z: 0, pc: it.pc };
        G.n++; G.z += it.z; groups.set(it.pc.group, G);
      }
      for (const G of groups.values()) {
        const c = G.pc.v[0];
        const lo = view(place([c[0], c[1], 0], G.pc.shape, folds, amt))[2];
        const hi = view(place([c[0], c[1], 1], G.pc.shape, folds, amt))[2];
        G.dir = hi > lo ? 1 : -1; G.depth = G.z / G.n;
      }
      items.sort((a, b) => {
        const A = groups.get(a.pc.group), B = groups.get(b.pc.group);
        return A === B ? (a.layer - b.layer) * A.dir : A.depth - B.depth;
      });
    }
    items.forEach(drawPiece);
  }

  const play = (ms, fn) => new Promise(done => {
    const t0 = performance.now();
    let last = t0;
    (function step(now) {
      if (dead) return done();
      const k = clamp((now - t0) / ms);
      const dt = Math.min(.05, Math.max(0, (now - last) / 1000));
      last = now;
      fn(k, dt);
      draw(dt);
      if (k < 1) raf = requestAnimationFrame(step); else done();
    })(t0);
  });

  function setFolded(sec) {
    folds.forEach((F, i) => { amt[i] = ease(clamp((sec - F.from) / (F.to - F.from))); });
    const k = ease(clamp((sec - 1.44) / 1.06));
    pose.z = FOLD_Z * k; pose.pitch = -rad(30) * k; pose.roll = -rad(16) * k;
  }

  /* Waits for the sending to finish, gently hovering meanwhile. */
  function hold(promise) {
    let finished = false, value;
    promise.then(v => { finished = true; value = v; });
    return new Promise(done => {
      const t0 = performance.now();
      (function step(now) {
        if (finished || dead) return done(value);
        const t = (now - t0) / 1000, grow = clamp(t);
        bob = Math.sin(t * 2.3) * 7 * grow;
        pose.roll = -rad(16) + Math.sin(t * 1.5) * rad(5) * grow;
        draw(0);
        raf = requestAnimationFrame(step);
      })(t0);
    });
  }

  function route() {
    const pts = [
      [pose.cx, pose.cy],
      [.2 * VW, .36 * VH], [.56 * VW, .13 * VH], [.82 * VW, .32 * VH], [.62 * VW, .55 * VH],
      [.38 * VW, .38 * VH], [.66 * VW, .13 * VH], [1.32 * VW, -.24 * VH]
    ];
    const line = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let n = 0; n < 40; n++) {
        const t = n / 40, t2 = t * t, t3 = t2 * t;
        const at = j => .5 * (2 * p1[j] + (p2[j] - p0[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * t3);
        line.push([at(0), at(1)]);
      }
    }
    line.push(pts[pts.length - 1]);
    const len = [0];
    for (let i = 1; i < line.length; i++) len[i] = len[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
    const at = s => {
      let lo = 0, hi = len.length - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (len[m] < s) lo = m; else hi = m; }
      const t = clamp((s - len[lo]) / ((len[hi] - len[lo]) || 1));
      return [line[lo][0] + (line[hi][0] - line[lo][0]) * t, line[lo][1] + (line[hi][1] - line[lo][1]) * t];
    };
    return { at, total: len[len.length - 1] };
  }

  async function fly() {
    fit();
    bob = 0; glued = false;
    // A small pull back along the tail, the way a hand winds up a throw.
    const sx = pose.cx, sy = pose.cy, r0 = pose.roll;
    await play(380, (k) => {
      const e = ease(k);
      pose.cy = sy + 26 * e;
      pose.pitch = -rad(30) - rad(10) * e;
      pose.roll = r0 * (1 - e);
    });
    if (navigator.vibrate) navigator.vibrate(14);

    const path = route();
    pose.cx = sx;
    let prevH = 0, roll = pose.roll;
    const start = [pose.cx, pose.cy];
    const size = H * .5;
    await play(FLY_TIME * 1000, (k, dt) => {
      const s = Math.pow(k, 1.55) * path.total;
      const a = path.at(s), b = path.at(Math.min(path.total, s + 4));
      // Leave the wound-up spot smoothly instead of snapping onto the route.
      const blend = clamp(k * 7);
      pose.cx = start[0] + (a[0] - start[0]) * blend;
      pose.cy = start[1] + (a[1] - start[1]) * blend;
      const target = Math.atan2(-(b[0] - a[0]), -(b[1] - a[1]));
      const turn = wrap(target - prevH); prevH = target;
      pose.h += wrap(target - pose.h) * (1 - Math.exp(-dt * 11));
      const bank = dt > 0 ? clamp(turn / dt * .26, -1.15, 1.15) : 0;
      roll += (bank - roll) * (1 - Math.exp(-dt * 6));
      pose.roll = roll;
      pose.pitch = -rad(40) - rad(14) * k;
      pose.z = FOLD_Z - 2700 * Math.pow(clamp(k * 1.5), .75) - 2600 * k * k;

      // Gold falling off the tail: the first of the dust that follows.
      const s2 = FOCAL / (FOCAL - pose.z);
      const tail = project(view([0, -size, 0]));
      for (let n = 0; n < 3; n++) {
        const big = Math.random() < .2;
        dust.push({
          x: tail[0] + (Math.random() - .5) * 26 * s2, y: tail[1] + (Math.random() - .5) * 26 * s2,
          vx: (Math.random() - .5) * 22, vy: 10 + Math.random() * 26,
          r: big ? 2.4 + Math.random() * 1.6 : .7 + Math.random() * 1.1,
          age: 0, life: .9 + Math.random() * 1.3, tw: 5 + Math.random() * 9, c: GOLD[n]
        });
      }
    });
    planeGone = true;
    // Let the last of the trail settle.
    let last = performance.now();
    await new Promise(done => {
      (function step(now) {
        if (dead || !dust.length) return done();
        const dt = Math.min(.05, (now - last) / 1000); last = now;
        fit();
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, VW, VH);
        drawDust(dt);
        raf = requestAnimationFrame(step);
      })(last);
    });
  }

  draw(0);
  return {
    fold: () => play(FOLD_TIME * 1000, k => setFolded(FOLD_TIME * k)),
    hold,
    unfold: () => { bob = 0; return play(1300, k => setFolded(FOLD_TIME * (1 - ease(k)))); },
    fly,
    destroy() { dead = true; cancelAnimationFrame(raf); cv.remove(); }
  };
}

return { create };
})();
