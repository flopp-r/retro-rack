// ============================================================================
//  RETRO RACK — core: physics, table, rules, bot AI  (units: metres, kg, s)
// ============================================================================
const CORE = (() => {
'use strict';

const P = {
  R: 0.028575,          // ball radius (57.15 mm ball)
  m: 0.17,              // ball mass
  g: 9.81,
  L: 2.54, W: 1.27,     // 9 ft table playing surface
  muS: 0.2,             // ball-cloth sliding friction
  muR: 0.010,           // rolling resistance
  spinDecel: 10.9,      // rad/s^2 decay of spin about vertical axis
  eBall: 0.95,          // ball-ball restitution
  eCush: 0.88,          // cushion restitution at low speed
  muCush: 0.2,          // ball-cushion friction
  cushSin: 0.27,        // cushion nose sits 0.27R above ball centre
  cueMass: 0.54,
  eTip: 0.8,
  squirt: 2.6 * Math.PI / 180,  // squirt per unit (a/R); 1.3deg at max english
  maxSpin: 0.5,         // max tip offset as fraction of R (miscue limit)
  dt: 1 / 1000,
};
P.I = 0.4 * P.m * P.R * P.R;
P.cushCos = Math.sqrt(1 - P.cushSin * P.cushSin);
let R = P.R, D2 = 4 * R * R;

// ---------------------------------------------------------------- determinism helpers
// Online play needs every browser to compute bit-identical physics. IEEE + - * / and sqrt are exact
// everywhere, but Math.exp/sin/cos can differ in the last bit between engines, so we avoid them in step().
const LN2 = 0.6931471805599453;
const POW2N = (() => { const t = []; let v = 1; for (let i = 0; i < 80; i++) { t.push(v); v /= 2; } return t; })();
function detExp(x) {             // e^x for x <= 0
  if (!(x < 0)) return 1; if (x < -50) return 0;
  const k = Math.round(-x / LN2), r = x + k * LN2;
  let s = 1, term = 1;
  for (let i = 1; i <= 14; i++) { term = term * r / i; s += term; }
  return s * POW2N[k];
}
const q9 = v => Math.round(v * 1e9) / 1e9;   // snap geometry so tiny trig differences vanish

// ---------------------------------------------------------------- tables
// us9: 9 ft American table, 2 1/4" balls, angled jaws.  uk7: 7 ft British pub table, 2" balls, tight rounded pockets.
const SPECS = {
  us9: { L: 2.54, W: 1.27, R: 0.028575, m: 0.17, cw: 0.05, mC: 0.116, mS: 0.132, devC: 38, devS: 76, filC: 0, filS: 0, head: 0.25, entryC: 1.0, entryS: 0.72, rail: 0.13 },
  uk7: { L: 1.83, W: 0.915, R: 0.0254, m: 0.14, cw: 0.045, mC: 0.089, mS: 0.097, devC: 52, devS: 80, filC: 0.03, filS: 0.024, head: 0.2, entryC: 0.88, entryS: 0.58, rail: 0.10 },
};
const TABLE = {};
function filletPoly(pts, rfor) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const V = pts[i], r = rfor(V);
    if (!r) { out.push(V); continue; }
    const a = pts[i - 1], b = pts[i + 1];
    let u1x = a[0] - V[0], u1z = a[1] - V[1], u2x = b[0] - V[0], u2z = b[1] - V[1];
    const l1 = Math.hypot(u1x, u1z), l2 = Math.hypot(u2x, u2z);
    u1x /= l1; u1z /= l1; u2x /= l2; u2z /= l2;
    const alpha = Math.acos(Math.max(-1, Math.min(1, u1x * u2x + u1z * u2z)));
    const t = Math.min(r / Math.tan(alpha / 2), l1 * 0.45, l2 * 0.85), rr = t * Math.tan(alpha / 2);
    let bx = u1x + u2x, bz = u1z + u2z; const bl = Math.hypot(bx, bz); bx /= bl; bz /= bl;
    const cd = rr / Math.sin(alpha / 2), cx = V[0] + bx * cd, cz = V[1] + bz * cd;
    const a1 = Math.atan2(V[1] + u1z * t - cz, V[0] + u1x * t - cx), a2 = Math.atan2(V[1] + u2z * t - cz, V[0] + u2x * t - cx);
    let da = a2 - a1; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const n = Math.max(2, Math.ceil(Math.abs(da) / (10 * Math.PI / 180)));
    for (let k = 0; k <= n; k++) out.push([cx + rr * Math.cos(a1 + da * k / n), cz + rr * Math.sin(a1 + da * k / n)]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
function setTable(key) {
  const sp = SPECS[key] || SPECS.us9;
  P.L = sp.L; P.W = sp.W; P.R = sp.R; P.m = sp.m; P.I = 0.4 * P.m * P.R * P.R;
  R = P.R; D2 = 4 * R * R;
  const hl = P.L / 2, hw = P.W / 2, cw = sp.cw;
  const dC = sp.mC / Math.SQRT2;
  const aC = sp.devC * Math.PI / 180, aS = sp.devS * Math.PI / 180;
  const lenC = cw / Math.sin(aC), lenS = cw / Math.sin(aS);
  const S = [sp.mS / 2, hw], Sj = [sp.mS / 2 - lenS * Math.cos(aS), hw + lenS * Math.sin(aS)];
  const A = [hl - dC, hw], Aj = [hl - dC + lenC * Math.cos(aC), hw + lenC * Math.sin(aC)];
  const B = [hl, hw - dC], Bj = [hl + lenC * Math.sin(aC), hw - dC + lenC * Math.cos(aC)];
  const mx = p => [-p[0], p[1]], mz = p => [p[0], -p[1]], mxz = p => [-p[0], -p[1]];
  const rfor = p => (Math.abs(p[0]) < hl * 0.5 ? sp.filS : sp.filC);
  const cushions = [
    [Sj, S, A, Aj], [mx(Aj), mx(A), mx(S), mx(Sj)],
    [mz(Aj), mz(A), mz(S), mz(Sj)], [mxz(Sj), mxz(S), mxz(A), mxz(Aj)],
    [Bj, B, mz(B), mz(Bj)], [mx(Bj), mx(B), mxz(B), mxz(Bj)],
  ].map(c => filletPoly(c, rfor));
  const segs = [];
  for (const c of cushions) for (let i = 0; i < c.length - 1; i++) {
    const s = { ax: q9(c[i][0]), az: q9(c[i][1]), bx: q9(c[i + 1][0]), bz: q9(c[i + 1][1]) };
    s.dx = s.bx - s.ax; s.dz = s.bz - s.az; s.len2 = s.dx * s.dx + s.dz * s.dz; s.len = Math.sqrt(s.len2);
    if (s.len > 1e-6) segs.push(s);
  }
  const pockets = [], k = Math.SQRT1_2;
  const finish = (p, jx, jz) => {
    const dx = jx - p.vx, dz = jz - p.vz; p.nr = Math.hypot(dx, dz);
    p.hwid = Math.acos(Math.max(-1, Math.min(1, (dx * p.axx + dz * p.axz) / p.nr)));
    const d = p.corner ? 1.05 * R : 0.63 * R; p.tx = p.mx + p.axx * d; p.tz = p.mz + p.axz * d;
    p.x = q9(p.x); p.z = q9(p.z); p.r = q9(p.r);
    pockets.push(p);
  };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const p = { corner: true, mx: sx * (hl - dC / 2), mz: sz * (hw - dC / 2), axx: sx * k, axz: sz * k, r: 1.75 * R };
    const off = p.r + 0.525 * R; p.x = p.mx + p.axx * off; p.z = p.mz + p.axz * off;
    p.vx = p.x + p.axx * 0.75 * R; p.vz = p.z + p.axz * 0.75 * R; p.vr = 2.45 * R;
    finish(p, sx * Aj[0], sz * Aj[1]);
  }
  for (const sz of [-1, 1]) {
    const p = { corner: false, mx: 0, mz: sz * hw, axx: 0, axz: sz, r: 1.575 * R };
    p.x = 0; p.z = p.mz + sz * 1.4 * R; p.vx = 0; p.vz = p.z + sz * 0.175 * R; p.vr = 2.31 * R;
    finish(p, Sj[0], sz * Sj[1]);
  }
  Object.assign(TABLE, { key, spec: sp, hl, hw, cw, cushions, segs, pockets, footX: P.L / 4, headX: -hl + sp.head * P.L,
    entryC: sp.entryC, entryS: sp.entryS, rail: sp.rail });
}
setTable('us9');

// ---------------------------------------------------------------- balls / world
function newBall(id, x, z) { return { id, x, z, vx: 0, vz: 0, wx: 0, wy: 0, wz: 0, potted: false, pocket: -1 }; }
function cloneBalls(bs) { return bs.map(b => ({ ...b })); }
function newRec() { return { first: -1, railAfter: false, pots: [], cushMask: 0, cueCush: 0 }; }
function makeWorld(balls) { return { balls, time: 0, rec: newRec(), ev: null }; }
function cloneWorld(w) { return { balls: cloneBalls(w.balls), time: 0, rec: newRec(), ev: null }; }
const moving = b => b.vx !== 0 || b.vz !== 0 || b.wx !== 0 || b.wz !== 0;
function allStopped(w) { for (const b of w.balls) if (!b.potted && moving(b)) return false; return true; }

// ---------------------------------------------------------------- integration
function integrate(b, dt) {
  if (b.wy !== 0) { const d = P.spinDecel * dt; b.wy = Math.abs(b.wy) <= d ? 0 : b.wy - Math.sign(b.wy) * d; }
  if (!moving(b)) return;
  const ux = b.vx + R * b.wz, uz = b.vz - R * b.wx;
  const u = Math.sqrt(ux * ux + uz * uz);
  if (u > 1e-5) {                                  // sliding
    const dec = P.muS * P.g * dt, du = 3.5 * dec, nx = ux / u, nz = uz / u;
    if (u <= du) {
      const f = u / du;
      b.vx -= nx * dec * f; b.vz -= nz * dec * f;
      b.wx = b.vz / R; b.wz = -b.vx / R;
    } else {
      b.vx -= nx * dec; b.vz -= nz * dec;
      const k = 2.5 * dec / R;
      b.wx += k * nz; b.wz -= k * nx;
    }
  } else {                                         // rolling
    const sp = Math.sqrt(b.vx * b.vx + b.vz * b.vz), dec = P.muR * P.g * dt;
    if (sp <= dec) { b.vx = 0; b.vz = 0; b.wx = 0; b.wz = 0; }
    else { const f = (sp - dec) / sp; b.vx *= f; b.vz *= f; b.wx = b.vz / R; b.wz = -b.vx / R; }
  }
  b.x += b.vx * dt; b.z += b.vz * dt;
}

// ---------------------------------------------------------------- collisions
function resolveBallBall(a, b, nx, nz) {
  const vn = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
  if (vn <= 0) return 0;
  const Jn = (1 + P.eBall) * 0.5 * P.m * vn;
  const u1x = a.vx + a.wy * R * nz, u1y = R * (a.wz * nx - a.wx * nz), u1z = a.vz - a.wy * R * nx;
  const u2x = b.vx - b.wy * R * nz, u2y = -R * (b.wz * nx - b.wx * nz), u2z = b.vz + b.wy * R * nx;
  let ux = u1x - u2x, uy = u1y - u2y, uz = u1z - u2z;
  const un = ux * nx + uz * nz; ux -= un * nx; uz -= un * nz;
  const ut = Math.sqrt(ux * ux + uy * uy + uz * uz);
  const jn = Jn / P.m;
  a.vx -= jn * nx; a.vz -= jn * nz; b.vx += jn * nx; b.vz += jn * nz;
  if (ut > 1e-6) {
    const mu = 9.951e-3 + 0.108 * detExp(-1.088 * ut);
    const Jt = Math.min(mu * Jn, P.m * ut / 7);
    const Px = -Jt * ux / ut, Py = -Jt * uy / ut, Pz = -Jt * uz / ut;
    a.vx += Px / P.m; a.vz += Pz / P.m; b.vx -= Px / P.m; b.vz -= Pz / P.m;
    const k = R / P.I, tx = -nz * Py, ty = nz * Px - nx * Pz, tz = nx * Py;
    a.wx += k * tx; a.wy += k * ty; a.wz += k * tz;
    b.wx += k * tx; b.wy += k * ty; b.wz += k * tz;
  }
  return vn;
}

function resolveCushion(b, nx, nz) {
  const vn = b.vx * nx + b.vz * nz;
  if (vn >= 0) return 0;
  const e = Math.max(0.62, P.eCush - 0.035 * (-vn));
  const Pn = -(1 + e) * P.m * vn;
  const cs = P.cushCos, sn = P.cushSin;
  const rx = -R * cs * nx, ry = R * sn, rz = -R * cs * nz;
  let ux = b.vx + (b.wy * rz - b.wz * ry), uy = (b.wz * rx - b.wx * rz), uz = b.vz + (b.wx * ry - b.wy * rx);
  const Nx = cs * nx, Ny = -sn, Nz = cs * nz;
  const uN = ux * Nx + uy * Ny + uz * Nz; ux -= uN * Nx; uy -= uN * Ny; uz -= uN * Nz;
  const ut = Math.sqrt(ux * ux + uy * uy + uz * uz);
  b.vx += Pn * nx / P.m; b.vz += Pn * nz / P.m;
  if (ut > 1e-6) {
    const Jt = Math.min(P.muCush * Pn / cs, P.m * ut / 3.5);
    const Px = -Jt * ux / ut, Py = -Jt * uy / ut, Pz = -Jt * uz / ut;
    b.vx += Px / P.m; b.vz += Pz / P.m;
    const k = 1 / P.I;
    b.wx += k * (ry * Pz - rz * Py); b.wy += k * (rz * Px - rx * Pz); b.wz += k * (rx * Py - ry * Px);
  }
  return -vn;
}

function closestOnSeg(s, x, z) {
  let t = ((x - s.ax) * s.dx + (z - s.az) * s.dz) / s.len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return [s.ax + s.dx * t, s.az + s.dz * t];
}

function potBall(w, b, k) {
  b.potted = true; b.pocket = k; b.vx = b.vz = b.wx = b.wy = b.wz = 0;
  w.rec.pots.push(b.id);
  if (w.ev) w.ev.push({ t: 'pot', id: b.id, p: k });
}

function step(w, dt) {
  const B = w.balls, n = B.length, rec = w.rec;
  for (let i = 0; i < n; i++) if (!B[i].potted) integrate(B[i], dt);

  // ball-ball
  for (let pass = 0; pass < 3; pass++) {
    let any = false;
    for (let i = 0; i < n; i++) {
      const a = B[i]; if (a.potted) continue;
      const am = moving(a);
      for (let j = i + 1; j < n; j++) {
        const b = B[j]; if (b.potted) continue;
        if (!am && !moving(b)) continue;
        let qx = b.x - a.x, qz = b.z - a.z;
        const d2 = qx * qx + qz * qz;
        if (d2 >= D2) continue;
        let d = Math.sqrt(d2) || 1e-9;
        let nx = qx / d, nz = qz / d;
        const rvx = a.vx - b.vx, rvz = a.vz - b.vz;
        const vn = rvx * nx + rvz * nz;
        if (vn <= 0) {            // overlapping but separating: nudge apart
          const push = (2 * R - d) * 0.5 + 1e-7;
          a.x -= nx * push; a.z -= nz * push; b.x += nx * push; b.z += nz * push;
          continue;
        }
        any = true;
        // rewind to exact contact
        const rv2 = rvx * rvx + rvz * rvz;
        const qr = qx * rvx + qz * rvz;
        // going back by tau: q' = q + rv*tau ; solve |q'| = 2R for the positive root
        let tau = (-qr + Math.sqrt(Math.max(0, qr * qr - rv2 * (d2 - D2)))) / rv2;
        if (!(tau >= 0)) tau = 0; else if (tau > dt * 2) tau = dt * 2;
        a.x -= a.vx * tau; a.z -= a.vz * tau; b.x -= b.vx * tau; b.z -= b.vz * tau;
        qx = b.x - a.x; qz = b.z - a.z; d = Math.sqrt(qx * qx + qz * qz) || 1e-9; nx = qx / d; nz = qz / d;
        const v = resolveBallBall(a, b, nx, nz);
        a.x += a.vx * tau; a.z += a.vz * tau; b.x += b.vx * tau; b.z += b.vz * tau;
        if (a.id === 0 && rec.first < 0) rec.first = b.id;
        else if (b.id === 0 && rec.first < 0) rec.first = a.id;
        if (w.ev) w.ev.push({ t: 'bb', v });
      }
    }
    if (!any) break;
  }

  // cushions + pockets
  const hl = TABLE.hl, hw = TABLE.hw, segs = TABLE.segs, pockets = TABLE.pockets;
  for (let i = 0; i < n; i++) {
    const b = B[i]; if (b.potted || !moving(b)) continue;
    if (Math.abs(b.x) > hl - R - 0.004 || Math.abs(b.z) > hw - R - 0.004) {
      for (let s = 0; s < segs.length; s++) {
        const sg = segs[s];
        let [cx, cz] = closestOnSeg(sg, b.x, b.z);
        let dx = b.x - cx, dz = b.z - cz, d2 = dx * dx + dz * dz;
        if (d2 >= R * R || d2 < 1e-14) continue;
        let d = Math.sqrt(d2), nx = dx / d, nz = dz / d;
        const vn = b.vx * nx + b.vz * nz;
        if (vn >= 0) { b.x = cx + nx * (R + 1e-7); b.z = cz + nz * (R + 1e-7); continue; }
        const tau = Math.min((R - d) / (-vn), dt * 2);
        b.x -= b.vx * tau; b.z -= b.vz * tau;
        [cx, cz] = closestOnSeg(sg, b.x, b.z);
        dx = b.x - cx; dz = b.z - cz; d = Math.sqrt(dx * dx + dz * dz) || 1e-9; nx = dx / d; nz = dz / d;
        const v = resolveCushion(b, nx, nz);
        b.x += b.vx * tau; b.z += b.vz * tau;
        if (rec.first >= 0) rec.railAfter = true;
        rec.cushMask |= (1 << b.id);
        if (b.id === 0 && rec.first < 0) rec.cueCush++;
        if (w.ev) w.ev.push({ t: 'cush', v });
      }
      for (let k = 0; k < pockets.length; k++) {
        const p = pockets[k], dx = b.x - p.x, dz = b.z - p.z;
        if (dx * dx + dz * dz < p.r * p.r) { potBall(w, b, k); break; }
      }
      if (!b.potted && (Math.abs(b.x) > hl + 0.03 || Math.abs(b.z) > hw + 0.03)) {
        let best = 0, bd = 1e9;
        pockets.forEach((p, k) => { const dd = (b.x - p.x) ** 2 + (b.z - p.z) ** 2; if (dd < bd) { bd = dd; best = k; } });
        potBall(w, b, best);
      }
    }
  }
  w.time += dt;
}

// ---------------------------------------------------------------- cue strike
function powerToCueSpeed(p) { return 0.08 + 6.5 * Math.pow(Math.max(0, Math.min(1, p)), 1.7); }
function cueSpeedToPower(V) { return Math.pow(Math.max(0, (V - 0.08) / 6.5), 1 / 1.7); }
function strikeImpulse(V, sx, sy) {           // returns ball speed for given cue speed / spin
  const a = sx * P.maxSpin * R, b = sy * P.maxSpin * R;
  return (1 + P.eTip) * V / (1 + P.m / P.cueMass + 2.5 * (a * a + b * b) / (R * R));
}
// shot: {phi, power, sx, sy}  sx/sy in [-1,1] of the usable spin disc
function strike(ball, shot) {
  const V = powerToCueSpeed(shot.power);
  const a = shot.sx * P.maxSpin * R, b = shot.sy * P.maxSpin * R;
  const v = strikeImpulse(V, shot.sx, shot.sy), J = v * P.m;
  const dx = Math.cos(shot.phi), dz = Math.sin(shot.phi), sx = -dz, sz = dx;
  const k = J / P.I;
  ball.wx = -k * b * sx; ball.wz = -k * b * sz; ball.wy = k * a;
  const lp = shot.phi - (a / R) * P.squirt;
  ball.vx = v * Math.cos(lp); ball.vz = v * Math.sin(lp);
}
function launchAngle(shot) { return shot.phi - shot.sx * P.maxSpin * P.squirt; }

// ---------------------------------------------------------------- simulate
function simulate(w, maxT, stop) {
  const dt = P.dt;
  let guard = 0;
  while (w.time < maxT) {
    step(w, dt);
    if (stop && stop(w)) return;
    if ((++guard & 15) === 0 && allStopped(w)) return;
  }
}

// ---------------------------------------------------------------- ray casting (aim guides)
function rayCircle(ox, oz, dx, dz, cx, cz, r) {
  const fx = ox - cx, fz = oz - cz, b = fx * dx + fz * dz, c = fx * fx + fz * fz - r * r;
  const disc = b * b - c; if (disc < 0) return Infinity;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : Infinity;
}
function cross(ax, az, bx, bz) { return ax * bz - az * bx; }
function rayCast(balls, ox, oz, dx, dz, ignore) {
  let best = { t: Infinity, kind: 'none', id: -1 };
  for (const b of balls) {
    if (b.potted || b.id === ignore) continue;
    const t = rayCircle(ox, oz, dx, dz, b.x, b.z, 2 * R);
    if (t < best.t) best = { t, kind: 'ball', id: b.id };
  }
  for (const s of TABLE.segs) {
    for (const [px, pz] of [[s.ax, s.az], [s.bx, s.bz]]) {
      const t = rayCircle(ox, oz, dx, dz, px, pz, R);
      if (t < best.t) best = { t, kind: 'cush', id: -1 };
    }
    const ex = s.dx / s.len, ez = s.dz / s.len, nx = -ez, nz = ex;
    const den = cross(dx, dz, ex, ez); if (Math.abs(den) < 1e-9) continue;
    for (const sg of [1, -1]) {
      const qx = s.ax + sg * R * nx - ox, qz = s.az + sg * R * nz - oz;
      const t = cross(qx, qz, ex, ez) / den, u = cross(qx, qz, dx, dz) / den;
      if (t > 0 && u >= 0 && u <= s.len && t < best.t) best = { t, kind: 'cush', id: -1 };
    }
  }
  for (const p of TABLE.pockets) {
    const t = rayCircle(ox, oz, dx, dz, p.x, p.z, p.r);
    if (t < best.t) best = { t, kind: 'pocket', id: -1 };
  }
  return best;
}

// ---------------------------------------------------------------- racks
function shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function rackPositions(rows, rnd) {
  const gap = 2 * R + 0.0002, dxr = gap * Math.sqrt(3) / 2, out = [];
  rows.forEach((c, r) => { for (let k = 0; k < c; k++) out.push([TABLE.footX + r * dxr + (rnd() - 0.5) * 0.0002, (k - (c - 1) / 2) * gap + (rnd() - 0.5) * 0.0002]); });
  return out;
}
function rack8(rnd = Math.random) {
  const pos = rackPositions([1, 2, 3, 4, 5], rnd);
  const solids = shuffle([1, 2, 3, 4, 5, 6, 7], rnd), stripes = shuffle([9, 10, 11, 12, 13, 14, 15], rnd);
  const ids = new Array(15);
  ids[4] = 8;
  const cs = solids.pop(), ct = stripes.pop();
  if (rnd() < 0.5) { ids[10] = cs; ids[14] = ct; } else { ids[10] = ct; ids[14] = cs; }
  const rest = shuffle([...solids, ...stripes], rnd);
  for (let i = 0; i < 15; i++) if (ids[i] === undefined) ids[i] = rest.pop();
  const balls = [newBall(0, TABLE.headX, 0)];
  for (let id = 1; id <= 15; id++) { const i = ids.indexOf(id); balls.push(newBall(id, pos[i][0], pos[i][1])); }
  return balls;
}
function rack9(rnd = Math.random) {
  const pos = rackPositions([1, 2, 3, 2, 1], rnd);
  const ids = new Array(9); ids[0] = 1; ids[4] = 9;
  const rest = shuffle([2, 3, 4, 5, 6, 7, 8], rnd);
  for (let i = 0; i < 9; i++) if (ids[i] === undefined) ids[i] = rest.pop();
  const balls = [newBall(0, TABLE.headX, 0)];
  for (let id = 1; id <= 9; id++) { const i = ids.indexOf(id); balls.push(newBall(id, pos[i][0], pos[i][1])); }
  return balls;
}
function rackScatter(rnd = Math.random) {
  const balls = [newBall(0, TABLE.headX, 0)];
  for (let id = 1; id <= 15; id++) {
    for (let tries = 0; tries < 500; tries++) {
      const x = (rnd() * 2 - 1) * (TABLE.hl - 0.12), z = (rnd() * 2 - 1) * (TABLE.hw - 0.1);
      if (balls.every(b => (b.x - x) ** 2 + (b.z - z) ** 2 > (2 * R + 0.03) ** 2)) { balls.push(newBall(id, x, z)); break; }
    }
  }
  return balls;
}

// placement validity (ball in hand, respots)
function validSpot(balls, x, z, ignoreId, kitchen) {
  const m = R + 0.001;
  if (Math.abs(x) > TABLE.hl - m || Math.abs(z) > TABLE.hw - m) return false;
  if (kitchen && x > TABLE.headX) return false;
  for (const p of TABLE.pockets) if ((x - p.x) ** 2 + (z - p.z) ** 2 < (p.r + R + 0.01) ** 2) return false;
  for (const b of balls) if (!b.potted && b.id !== ignoreId && (b.x - x) ** 2 + (b.z - z) ** 2 < (2 * R + 0.0005) ** 2) return false;
  return true;
}
function spotBall(balls, b) {       // re-spot on foot spot, moving back along the long string
  for (let x = TABLE.footX; x < TABLE.hl - R; x += 0.002) if (validSpot(balls, x, 0, b.id)) { b.x = x; b.z = 0; return; }
  for (let x = TABLE.footX; x > -TABLE.hl; x -= 0.002) if (validSpot(balls, x, 0, b.id)) { b.x = x; b.z = 0; return; }
}
function placeCueHead(balls, cue) {
  for (let r = 0; r < 0.5; r += 0.005) for (const s of [1, -1]) {
    const z = s * r; if (validSpot(balls, TABLE.headX, z, 0)) { cue.x = TABLE.headX; cue.z = z; return; }
  }
}

// ---------------------------------------------------------------- rules
const isSolid = id => id >= 1 && id <= 7, isStripe = id => id >= 9 && id <= 15;
const groupOf = id => isSolid(id) ? 'solids' : isStripe(id) ? 'stripes' : null;
const onTable = balls => balls.filter(b => !b.potted && b.id !== 0);
function groupLeft(balls, g) { return onTable(balls).filter(b => groupOf(b.id) === g).length; }
function popcount(x) { let c = 0; while (x) { c += x & 1; x >>>= 1; } return c; }

function newGame(mode) {
  return { mode, turn: 0, groups: [null, null], breakShot: mode !== 'practice', ballInHand: true,
    kitchen: mode !== 'practice', over: false, winner: -1, visits: 1, freeShot: false };
}
const groupName = (mode, g) => mode === 'uk8' ? (g === 'solids' ? 'reds' : 'yellows') : g;
function legalTargets(game, balls, player) {
  const on = onTable(balls);
  if (!on.length) return [];
  if (game.mode === '9ball') return [Math.min(...on.map(b => b.id))];
  if (game.mode === 'uk8') {
    if (game.breakShot) return on.map(b => b.id);
    const g = game.groups[player], onBlack = g && !on.some(b => groupOf(b.id) === g);
    if (game.freeShot) return on.filter(b => b.id !== 8 || onBlack).map(b => b.id);
    if (!g) return on.filter(b => b.id !== 8).map(b => b.id);
    return onBlack ? [8] : on.filter(b => groupOf(b.id) === g).map(b => b.id);
  }
  if (game.mode === '8ball') {
    if (game.breakShot) return on.map(b => b.id);
    const g = game.groups[player];
    if (!g) return on.filter(b => b.id !== 8).map(b => b.id);
    const mine = on.filter(b => groupOf(b.id) === g).map(b => b.id);
    return mine.length ? mine : [8];
  }
  return on.map(b => b.id);
}
const fmtBall = id => id === 8 ? 'the 8' : id === 9 ? 'the 9' : `the ${id}`;

function judge(game, rec, before, after, player) {
  const res = { foul: false, reason: '', keepTurn: false, win: -1, respot: [], assign: null, msgs: [], ballInHand: false };
  const opp = 1 - player, cueIn = rec.pots.includes(0), objPots = rec.pots.filter(id => id !== 0);
  if (game.mode === 'practice') {
    if (cueIn) { res.foul = true; res.reason = 'Scratch'; res.ballInHand = true; }
    res.keepTurn = true; return res;
  }
  if (game.mode === 'uk8') return judgeUK(game, rec, before, player, res);
  const targets = legalTargets(game, before, player);
  if (rec.first < 0) { res.foul = true; res.reason = 'No ball hit'; }
  else if (!game.breakShot && !targets.includes(rec.first)) {
    res.foul = true;
    res.reason = game.mode === '9ball' ? `Must hit ${fmtBall(targets[0])} first` :
      (game.groups[player] ? `Hit ${fmtBall(rec.first)} first — not your group` : `Can't hit the 8 first on an open table`);
  }
  if (!res.foul && !game.breakShot && objPots.length === 0 && !rec.railAfter) { res.foul = true; res.reason = 'No rail after contact'; }
  if (!res.foul && game.breakShot && objPots.length === 0 && popcount(rec.cushMask & ~1) < 4) { res.foul = true; res.reason = 'Illegal break — fewer than 4 balls reached a rail'; }
  if (cueIn) { res.foul = true; res.reason = game.breakShot ? 'Scratch on the break' : 'Scratch'; }

  if (game.mode === '8ball') {
    const g = game.groups[player];
    const onEight = g && groupLeft(before, g) === 0;
    if (objPots.includes(8)) {
      if (game.breakShot) { res.respot.push(8); res.msgs.push('8-ball on the break — re-spotted'); }
      else if (res.foul) { res.win = opp; res.reason2 = 'Potted the 8 with a foul'; return res; }
      else if (!onEight) { res.win = opp; res.reason2 = 'Potted the 8 too early'; return res; }
      else { res.win = player; res.reason2 = 'Potted the 8'; return res; }
    }
    let my = g;
    if (!g && !game.breakShot && !res.foul) {
      const f = objPots.find(id => id !== 8);
      if (f !== undefined) { my = groupOf(f); res.assign = { player, group: my }; }
    }
    if (!res.foul) {
      if (game.breakShot) res.keepTurn = objPots.some(id => id !== 8);
      else if (my) res.keepTurn = objPots.some(id => groupOf(id) === my);
    }
  } else {
    if (objPots.includes(9)) {
      if (res.foul) { res.respot.push(9); res.msgs.push('9-ball re-spotted'); }
      else { res.win = player; res.reason2 = 'Potted the 9'; return res; }
    }
    if (!res.foul) res.keepTurn = objPots.length > 0;
  }
  if (res.foul) { res.keepTurn = false; res.ballInHand = true; }
  return res;
}

// British pub rules for reds & yellows
function judgeUK(game, rec, before, player, res) {
  const opp = 1 - player, cueIn = rec.pots.includes(0), objPots = rec.pots.filter(id => id !== 0);
  const g = game.groups[player], og = g ? (g === 'solids' ? 'stripes' : 'solids') : null;
  const onBlack = g && groupLeft(before, g) === 0;
  const targets = legalTargets(game, before, player);
  const nm = id => id === 8 ? 'the black' : (isSolid(id) ? 'a red' : 'a yellow');
  if (rec.first < 0) { res.foul = true; res.reason = 'Missed every ball'; }
  else if (!game.breakShot && !targets.includes(rec.first)) { res.foul = true; res.reason = `Hit ${nm(rec.first)} first`; }
  if (!res.foul && g && !game.freeShot && !game.breakShot && objPots.some(id => groupOf(id) === og)) { res.foul = true; res.reason = `Potted ${groupName('uk8', og) === 'reds' ? 'a red' : 'a yellow'}, your opponent's colour`; }
  if (cueIn) { res.foul = true; res.reason = 'In-off'; }
  if (objPots.includes(8)) {
    if (game.breakShot) { res.respot.push(8); res.msgs.push('Black potted on the break, re-spotted'); }
    else if (res.foul) { res.win = opp; res.reason2 = 'Potted the black with a foul'; return res; }
    else if (!onBlack) { res.win = opp; res.reason2 = 'Potted the black too early'; return res; }
    else { res.win = player; res.reason2 = 'Potted the black'; return res; }
  }
  let my = g;
  if (!g && !game.breakShot && !res.foul) {
    const f = objPots.find(id => id !== 8);
    if (f !== undefined) { my = groupOf(f); res.assign = { player, group: my }; }
  }
  if (!res.foul) {
    if (game.breakShot) res.keepTurn = objPots.some(id => id !== 8);
    else if (my) res.keepTurn = objPots.some(id => groupOf(id) === my);
  }
  if (res.foul) { res.keepTurn = false; res.ballInHand = cueIn; }
  return res;
}

function nextGame(game, res, player) {
  const g = { ...game, groups: [...game.groups] };
  if (res.assign) { g.groups[res.assign.player] = res.assign.group; g.groups[1 - res.assign.player] = res.assign.group === 'solids' ? 'stripes' : 'solids'; }
  g.breakShot = false; g.kitchen = false;
  if (res.win >= 0) { g.over = true; g.winner = res.win; return g; }
  if (game.mode === 'uk8') {
    g.freeShot = false; g.ballInHand = false;
    if (res.foul) { g.turn = 1 - player; g.visits = 2; g.freeShot = true; g.ballInHand = res.ballInHand; g.kitchen = res.ballInHand; }
    else if (res.keepTurn) g.turn = player;
    else if ((game.visits || 1) > 1) { g.turn = player; g.visits = game.visits - 1; }
    else { g.turn = 1 - player; g.visits = 1; }
    return g;
  }
  g.turn = game.mode === 'practice' ? player : (res.keepTurn ? player : 1 - player);
  g.ballInHand = res.ballInHand;
  return g;
}

// ---------------------------------------------------------------- AI helpers
function segDist2(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + dx * t - px, cz = az + dz * t - pz; return cx * cx + cz * cz;
}
function pathClear(balls, ax, az, bx, bz, ignA, ignB, clr) {
  const c2 = clr * clr;
  for (const b of balls) { if (b.potted || b.id === ignA || b.id === ignB) continue; if (segDist2(b.x, b.z, ax, az, bx, bz) < c2) return false; }
  return true;
}
function shotCandidates(balls, cx, cz, targets) {
  const out = [];
  for (const tid of targets) {
    const t = balls.find(b => b.id === tid); if (!t || t.potted) continue;
    TABLE.pockets.forEach((p, k) => {
      let ex = p.tx - t.x, ez = p.tz - t.z; const d2 = Math.hypot(ex, ez); if (d2 < 1e-4) return;
      ex /= d2; ez /= d2;
      const entry = Math.acos(Math.max(-1, Math.min(1, ex * p.axx + ez * p.axz)));
      if (entry > (p.corner ? TABLE.entryC : TABLE.entryS)) return;
      const gx = t.x - ex * 2 * R, gz = t.z - ez * 2 * R;
      if (Math.abs(gx) > TABLE.hl - R + 0.003 || Math.abs(gz) > TABLE.hw - R + 0.003) return;
      let fx = gx - cx, fz = gz - cz; const d1 = Math.hypot(fx, fz); if (d1 < 1e-4) return;
      const cosc = (fx * ex + fz * ez) / d1; if (cosc < 0.2) return;
      if (!pathClear(balls, cx, cz, gx, gz, 0, tid, 2 * R - 0.001)) return;
      if (!pathClear(balls, t.x, t.z, p.tx, p.tz, 0, tid, 2 * R - 0.002)) return;
      const q = Math.pow(cosc, 1.6) * Math.exp(-(0.45 * d1 + 0.8 * d2)) * Math.pow(Math.cos(entry), p.corner ? 0.6 : 1.4);
      out.push({ tid, pk: k, gx, gz, ex, ez, d1, d2, cosc, q, phi: Math.atan2(fz, fx) });
    });
  }
  return out.sort((a, b) => b.q - a.q);
}
function bestQuality(game, balls, player) {
  if (game.over) return 0;
  const cue = balls[0]; if (cue.potted) return 0.9;
  const c = shotCandidates(balls, cue.x, cue.z, legalTargets(game, balls, player));
  return c.length ? Math.min(1, c[0].q * 1.6) : 0;
}
function estimatePower(c, factor) {
  const mr = P.muR * P.g;
  const vObj = 1.4 * Math.sqrt(2 * mr * (c.d2 + 0.25));
  const vContact = vObj / (Math.max(0.25, c.cosc) * (1 + P.eBall) / 2);
  const vLaunch = 1.4 * Math.sqrt(vContact * vContact + 2 * mr * c.d1);
  const V = vLaunch * factor / ((1 + P.eTip) / (1 + P.m / P.cueMass));
  return Math.min(1, cueSpeedToPower(V));
}
function gauss(rnd) { let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
const wrapA = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

const DIFF = {
  easy:   { aimSd: 1.3, powSd: 0.14, spinSd: 0.10, cands: 3, variants: [[1.4, 0, 0]], refine: 0, pos: 0, robust: 0, safety: false, pickTop: 3, bih: 2 },
  medium: { aimSd: 0.55, powSd: 0.07, spinSd: 0.06, cands: 5, variants: [[1.3, 0, 0], [1.9, 0, 0.3]], refine: 1, pos: 0.4, robust: 0, safety: false, pickTop: 2, bih: 3 },
  hard:   { aimSd: 0.22, powSd: 0.04, spinSd: 0.03, cands: 6, variants: [[1.2, 0, 0], [1.7, 0, 0.45], [1.7, 0, -0.5], [2.6, 0, -0.55], [2.5, 0, 0.4]], refine: 2, pos: 1, robust: 3, safety: true, pickTop: 1, bih: 5 },
  expert: { aimSd: 0.09, powSd: 0.025, spinSd: 0.015, cands: 7, variants: [[1.2, 0, 0], [1.7, 0, 0.45], [1.7, 0, -0.5], [2.6, 0, -0.6], [2.5, 0, 0.45], [1.8, 0.5, 0.25], [1.8, -0.5, 0.25], [1.7, 0.45, -0.45], [1.7, -0.45, -0.45]], refine: 2, pos: 1.3, robust: 4, safety: true, pickTop: 1, bih: 7 },
};

// measure object-ball launch angle for a shot (used to correct for throw/squirt)
function objAngle(balls, shot, tid) {
  const w = makeWorld(cloneBalls(balls));
  strike(w.balls[0], shot);
  let hitT = -1;
  simulate(w, 4, ww => { if (ww.rec.first >= 0 && hitT < 0) hitT = ww.time; return hitT >= 0 && ww.time - hitT > 0.012; });
  if (w.rec.first !== tid) return null;
  const t = w.balls.find(b => b.id === tid);
  return Math.atan2(t.vz, t.vx);
}

function evalShot(game, balls, shot, player, cfg) {
  const w = makeWorld(cloneBalls(balls));
  strike(w.balls[0], shot);
  simulate(w, 25);
  const res = judge(game, w.rec, balls, w.balls, player);
  let s;
  if (res.win === player) s = 1000;
  else if (res.win >= 0) s = -1000;
  else if (res.foul) s = game.mode === 'uk8' ? -160 : -120;
  else {
    const ng = nextGame(game, res, player);
    if (res.keepTurn) {
      s = 100;
      if (cfg.pos > 0) { const q = bestQuality(ng, w.balls, player); s += cfg.pos * 60 * q - (q === 0 ? cfg.pos * 25 : 0); }
    } else if (ng.turn === player) s = 25 + 40 * bestQuality(ng, w.balls, player);   // still have a second visit
    else s = cfg.safety ? -40 * bestQuality(ng, w.balls, 1 - player) : 0;
  }
  return { s, res };
}

// Bot planner — a generator so it can run spread over frames
function* planBot(game, balls0, player, diffName, rnd = Math.random) {
  const cfg = DIFF[diffName];
  let balls = cloneBalls(balls0);
  const cue = balls[0];
  const targets = legalTargets(game, balls, player);
  const deg = Math.PI / 180;

  if (game.breakShot) {
    const apex = balls.filter(b => !b.potted && b.id !== 0).reduce((a, b) => (b.x < a.x ? b : a));
    const opts = [];
    const n = cfg.robust ? 4 : 1;
    for (let i = 0; i < n; i++) {
      const z = (rnd() - 0.5) * (game.mode === '9ball' ? 0.7 : game.mode === 'uk8' ? 0.5 : 0.3);
      const pos = [TABLE.headX - 0.02, z];
      const phi = Math.atan2(apex.z - pos[1], apex.x - pos[0]) + (rnd() - 0.5) * 0.3 * deg;
      const shot = { phi, power: diffName === 'easy' ? 0.82 : 0.97, sx: 0, sy: diffName === 'easy' ? 0 : -0.1, cue: pos };
      if (n > 1) {
        const b2 = cloneBalls(balls); b2[0].x = pos[0]; b2[0].z = pos[1];
        const r = evalShot(game, b2, shot, player, cfg); shot.score = r.s; yield;
      } else shot.score = 0;
      opts.push(shot);
    }
    opts.sort((a, b) => b.score - a.score);
    return applyNoise(opts[0], cfg, rnd);
  }

  // cue ball positions to consider
  const positions = [];
  if (game.ballInHand) {
    const tmp = cloneBalls(balls); tmp[0].potted = true;
    const cand = [];
    for (const tid of targets) {
      const t = tmp.find(b => b.id === tid);
      TABLE.pockets.forEach((p, k) => {
        let ex = p.tx - t.x, ez = p.tz - t.z; const d = Math.hypot(ex, ez); ex /= d; ez /= d;
        if (!pathClear(tmp, t.x, t.z, p.tx, p.tz, 0, tid, 2 * R - 0.002)) return;
        const entry = Math.acos(Math.max(-1, Math.min(1, ex * p.axx + ez * p.axz)));
        if (entry > (p.corner ? TABLE.entryC : TABLE.entryS)) return;
        for (const dist of [0.28, 0.5]) for (const ang of [0, 16, -16]) {
          const a = Math.atan2(ez, ex) + ang * deg;
          const x = t.x - ex * 2 * R - Math.cos(a) * dist, z = t.z - ez * 2 * R - Math.sin(a) * dist;
          if (!validSpot(tmp, x, z, 0, game.kitchen)) continue;
          cand.push({ x, z, q: Math.exp(-0.8 * d) * (ang === 0 ? 1 : 0.85) * (dist < 0.3 ? 1 : 0.9) + rnd() * 0.02 });
        }
      });
    }
    cand.sort((a, b) => b.q - a.q);
    for (const c of cand.slice(0, cfg.bih)) positions.push([c.x, c.z]);
    if (!positions.length) {
      for (let i = 0; i < 200 && positions.length < 1; i++) {
        const x = (rnd() * 2 - 1) * (TABLE.hl - 0.1), z = (rnd() * 2 - 1) * (TABLE.hw - 0.1);
        if (validSpot(tmp, x, z, 0, game.kitchen)) positions.push([x, z]);
      }
    }
  } else positions.push([cue.x, cue.z]);

  const scored = [];
  for (const pos of positions) {
    const bs = cloneBalls(balls); bs[0].x = pos[0]; bs[0].z = pos[1]; bs[0].potted = false;
    const cands = shotCandidates(bs, pos[0], pos[1], targets).slice(0, cfg.cands);
    for (const c of cands) {
      for (const [pf, sx, sy] of cfg.variants) {
        const shot = { phi: c.phi, power: estimatePower(c, pf), sx, sy, cue: game.ballInHand ? pos : null };
        // aim refinement for throw / squirt
        const want = Math.atan2(c.ez, c.ex);
        let slope = null;
        for (let it = 0; it < cfg.refine; it++) {
          const a0 = objAngle(bs, shot, c.tid); yield;
          if (a0 === null) break;
          const e0 = wrapA(a0 - want);
          if (Math.abs(e0) < 0.0004) break;
          if (slope === null) {
            const s2 = { ...shot, phi: shot.phi + 0.003 };
            const a1 = objAngle(bs, s2, c.tid); yield;
            if (a1 === null) break;
            slope = wrapA(a1 - a0) / 0.003;
            if (!(Math.abs(slope) > 0.2)) break;
          }
          shot.phi -= Math.max(-0.05, Math.min(0.05, e0 / slope));
        }
        const r = evalShot(game, bs, shot, player, cfg); yield;
        scored.push({ shot, s: r.s, bs, c });
      }
    }
  }
  scored.sort((a, b) => b.s - a.s);

  // robustness: re-test top options under execution noise
  if (cfg.robust && scored.length) {
    const top = scored.slice(0, 3);
    for (const o of top) {
      let sum = o.s;
      for (let k = 0; k < cfg.robust; k++) {
        const ns = { ...o.shot, phi: o.shot.phi + gauss(rnd) * cfg.aimSd * deg * 1.3, power: o.shot.power * (1 + gauss(rnd) * cfg.powSd) };
        sum += evalShot(game, o.bs, ns, player, cfg).s; yield;
      }
      o.s = sum / (cfg.robust + 1);
    }
    scored.sort((a, b) => b.s - a.s);
  }

  let pick = null;
  if (scored.length && scored[0].s > (cfg.safety ? 40 : -50)) {
    const top = scored.filter(o => o.s > 0).slice(0, cfg.pickTop);
    pick = (top.length ? top[Math.floor(rnd() * top.length)] : scored[0]).shot;
  }

  if (!pick) {
    // safety / just make a legal hit
    const bs = cloneBalls(balls);
    if (game.ballInHand && positions.length) { bs[0].x = positions[0][0]; bs[0].z = positions[0][1]; bs[0].potted = false; }
    const c0 = bs[0];
    const opts = [];
    for (const tid of targets) {
      const t = bs.find(b => b.id === tid);
      const base = Math.atan2(t.z - c0.z, t.x - c0.x), dist = Math.hypot(t.z - c0.z, t.x - c0.x);
      const offs = [0, 0.5, -0.5, 0.8, -0.8];
      for (const f of offs) {
        const phi = base + Math.asin(Math.max(-1, Math.min(1, f * 2 * R / dist)));
        for (const pw of cfg.safety ? [0.24, 0.34, 0.48] : [0.4]) {
          const shot = { phi, power: pw, sx: 0, sy: 0, cue: game.ballInHand ? [c0.x, c0.z] : null };
          const r = evalShot(game, bs, shot, player, { ...cfg, safety: true }); yield;
          opts.push({ shot, s: r.s });
        }
      }
    }
    opts.sort((a, b) => b.s - a.s);
    if (!opts.length || opts[0].s <= -100) {
      // snookered: try one-rail kicks by mirroring the target across each cushion line
      const lx = TABLE.hl - R, lz = TABLE.hw - R;
      for (const tid of targets) {
        const t = bs.find(b => b.id === tid);
        const mirrors = [[2 * lx - t.x, t.z], [-2 * lx - t.x, t.z], [t.x, 2 * lz - t.z], [t.x, -2 * lz - t.z]];
        for (const [mx, mz] of mirrors) {
          const base = Math.atan2(mz - c0.z, mx - c0.x), dist = Math.hypot(mz - c0.z, mx - c0.x);
          for (const f of [0, 0.35, -0.35]) for (const pw of [0.38, 0.52]) {
            const phi = base + f * R / dist;
            const shot = { phi, power: pw, sx: 0, sy: 0, cue: game.ballInHand ? [c0.x, c0.z] : null };
            const r = evalShot(game, bs, shot, player, { ...cfg, safety: true }); yield;
            opts.push({ shot, s: r.s });
          }
        }
      }
      opts.sort((a, b) => b.s - a.s);
    }
    const best = scored.length && (!opts.length || scored[0].s >= opts[0].s) ? scored[0].shot : null;
    pick = best || (opts.length ? opts[0].shot : { phi: rnd() * 6.28, power: 0.5, sx: 0, sy: 0, cue: null });
  }
  return applyNoise(pick, cfg, rnd);
}
function applyNoise(shot, cfg, rnd) {
  const s = { ...shot };
  s.ideal = { ...shot };
  s.phi += gauss(rnd) * cfg.aimSd * Math.PI / 180;
  s.power = Math.max(0.02, Math.min(1, s.power * (1 + gauss(rnd) * cfg.powSd)));
  s.sx = Math.max(-1, Math.min(1, s.sx + gauss(rnd) * cfg.spinSd));
  s.sy = Math.max(-1, Math.min(1, s.sy + gauss(rnd) * cfg.spinSd));
  return s;
}

return { P, TABLE, SPECS, setTable, groupName, newBall, cloneBalls, makeWorld, cloneWorld, step, simulate, allStopped, moving,
  strike, launchAngle, powerToCueSpeed, strikeImpulse, rayCast, rack8, rack9, rackScatter,
  validSpot, spotBall, placeCueHead, newGame, legalTargets, judge, nextGame, groupOf, isSolid, isStripe,
  planBot, DIFF, shotCandidates, newRec };
})();
if (typeof module !== 'undefined') module.exports = CORE;
