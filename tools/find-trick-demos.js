// Finds a robust "Show me" demo shot for trick-shot layouts by searching with the real physics.
// Usage:  node tools/find-trick-demos.js            (checks every trick in src/game.js)
//         node tools/find-trick-demos.js "Side bank"  (re-searches one trick by name)
// Paste any printed demo into that trick's "demo" in the TRICKS list in src/game.js.
const fs = require('fs'), path = require('path');
const C = require('../src/core.js'); C.setTable('us9');
const R = C.P.R, DEG = Math.PI / 180;
const tricks = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'game.js'), 'utf8').match(/const TRICKS = (\[.*?\]);\n/)[1]);
const only = process.argv[2];
const works = (t, s) => { const w = C.makeWorld(t.balls.map(([id, x, z]) => C.newBall(id, x, z))); C.strike(w.balls[0], s); C.simulate(w, 20); return t.pot.every(id => w.rec.pots.includes(id)) && !w.rec.pots.includes(0); };
function aims(t) {      // aim lines worth trying: thin to full contact on each ball, plus one-cushion kicks
  const [, cx, cz] = t.balls[0], out = [];
  for (const [, x, z] of t.balls.slice(1)) {
    const targets = [[x, z], [2 * (C.TABLE.hl - R) - x, z], [-2 * (C.TABLE.hl - R) - x, z], [x, 2 * (C.TABLE.hw - R) - z], [x, -2 * (C.TABLE.hw - R) - z]];
    for (const [tx, tz] of targets) { const b = Math.atan2(tz - cz, tx - cx), d = Math.hypot(tz - cz, tx - cx); for (let f = -0.95; f <= 0.95; f += 0.1) out.push(b + Math.asin(f * 2 * R / d)); }
  }
  return out;
}
for (const t of tricks) {
  if (only && t.name !== only) continue;
  if (!only && t.demo && works(t, t.demo)) { console.log(`ok      ${t.name}`); continue; }
  let best = null;
  for (const a of aims(t)) for (let dp = -1; dp <= 1; dp += 0.25) for (const power of [0.3, 0.42, 0.55, 0.7, 0.85]) for (const [sx, sy] of [[0, 0], [0, 0.6], [0, -0.6], [0.6, 0], [-0.6, 0]]) {
    const s = { phi: a + dp * DEG, power, sx, sy };
    if (!works(t, s)) continue;
    let ok = 0; for (const [ea, ep] of [[-0.15, 0], [0.15, 0], [0, -0.03], [0, 0.03], [-0.3, 0], [0.3, 0]]) if (works(t, { ...s, phi: s.phi + ea * DEG, power: s.power + ep })) ok++;
    if (!best || ok > best.ok) best = { ...s, ok };
  }
  console.log(best ? `found   ${t.name} (forgiving ${best.ok}/6): "demo": ${JSON.stringify({ phi: +best.phi.toFixed(5), power: best.power, sx: best.sx, sy: best.sy })}` : `none    ${t.name}: no demo found, try moving the balls`);
}
