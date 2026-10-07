// Physics and rules tests. Run with:  node tests/physics.test.js   (no installs needed)
// These protect the things online play depends on: deterministic physics, pockets, and the rules engine.
const assert = require('assert');
const fs = require('fs'), path = require('path');
const C = require('../src/core.js');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
const run = (balls, shot, t = 25) => { const w = C.makeWorld(balls); C.strike(w.balls[0], shot); C.simulate(w, t); return w; };
const B = (id, x, z) => C.newBall(id, x, z);
const rnd = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
// a fixed ghost-ball aim into a pocket
function potShot(cueX, cueZ, ox, oz, pocket, power = 0.35) {
  const p = C.TABLE.pockets[pocket], dx = p.tx - ox, dz = p.tz - oz, d = Math.hypot(dx, dz);
  const gx = ox - dx / d * 2 * C.P.R, gz = oz - dz / d * 2 * C.P.R;
  return { phi: Math.atan2(gz - cueZ, gx - cueX), power, sx: 0, sy: 0 };
}

for (const key of ['us9', 'uk7']) {
  C.setTable(key);
  const { TABLE: T, P } = C, R = P.R;
  console.log(`\n${key === 'us9' ? '9 ft American table' : '7 ft British table'}`);
  test('identical shots give bit-identical results (needed for online play)', () => {
    const a = run(C.rack8(rnd(7)), { phi: 0.001, power: 1, sx: 0.2, sy: -0.3 });
    const b = run(C.rack8(rnd(7)), { phi: 0.001, power: 1, sx: 0.2, sy: -0.3 });
    assert.strictEqual(JSON.stringify(a.balls), JSON.stringify(b.balls));
  });
  test('straight cut pots into a corner pocket', () => {
    const w = run([B(0, 0.2, 0.05), B(1, T.hl * 0.6, T.hw * 0.55)], potShot(0.2, 0.05, T.hl * 0.6, T.hw * 0.55, 3));
    assert.ok(w.rec.pots.includes(1), 'object ball not potted');
  });
  test('ball rolling along the rail drops into the corner', () => {
    const w = run([B(0, T.hl * 0.3, T.hw - R - 0.0005)], { phi: 0, power: 0.28, sx: 0, sy: 0 });
    assert.deepStrictEqual(w.rec.pots, [0]);
  });
  test('ball rolling along the rail passes the side pocket', () => {
    const w = run([B(0, -T.hl * 0.35, T.hw - R - 0.0005)], { phi: 0, power: 0.18, sx: 0, sy: 0 });
    assert.ok(!w.rec.pots.length, 'ball fell into the side pocket');
  });
  test('breaks stay on the table, settle and leave no overlaps', () => {
    for (let i = 0; i < 8; i++) {
      const w = run(C.rack8(rnd(100 + i)), { phi: (i - 4) * 0.0007, power: 1, sx: 0, sy: -0.1 }, 30);
      assert.ok(C.allStopped(w), 'balls still moving after 30 s');
      const on = w.balls.filter(b => !b.potted);
      for (const b of on) assert.ok(Math.abs(b.x) < T.hl && Math.abs(b.z) < T.hw && isFinite(b.x), `ball ${b.id} off the table`);
      for (let a = 0; a < on.length; a++) for (let c = a + 1; c < on.length; c++)
        assert.ok(Math.hypot(on[a].x - on[c].x, on[a].z - on[c].z) > 2 * R - 1e-4, 'balls overlapping');
    }
  });
}

C.setTable('us9');
console.log('\nRules');
const judge = (mode, setup, rec, player = 0) => {
  const game = { ...C.newGame(mode), breakShot: false, ballInHand: false, kitchen: false, ...setup };
  const before = (setup.balls || C.rack8()).map(b => ({ ...b }));
  return { res: C.judge(game, { first: -1, railAfter: true, pots: [], cushMask: 0, ...rec }, before, before, player), game };
};
test('8-ball: potting the 8 early loses', () => {
  const { res } = judge('8ball', { groups: ['solids', 'stripes'] }, { first: 1, pots: [8] });
  assert.strictEqual(res.win, 1);
});
test('8-ball: scratch is a foul with ball in hand', () => {
  const { res } = judge('8ball', { groups: ['solids', 'stripes'] }, { first: 1, pots: [0] });
  assert.ok(res.foul && res.ballInHand && !res.keepTurn);
});
test('9-ball: hitting a higher ball first is a foul', () => {
  const balls = C.rack9(); const { res } = judge('9ball', { balls }, { first: 5 });
  assert.ok(res.foul);
});
test('reds & yellows: potting the opponent\'s colour is a foul giving two visits and a free ball', () => {
  const { res, game } = judge('uk8', { groups: ['solids', 'stripes'] }, { first: 1, pots: [1, 9] });
  assert.ok(res.foul);
  const ng = C.nextGame(game, res, 0);
  assert.strictEqual(ng.turn, 1); assert.strictEqual(ng.visits, 2); assert.ok(ng.freeShot);
});
test('reds & yellows: an in-off gives ball in hand behind the baulk line', () => {
  const { res, game } = judge('uk8', { groups: ['solids', 'stripes'] }, { first: 1, pots: [0] });
  const ng = C.nextGame(game, res, 0);
  assert.ok(ng.ballInHand && ng.kitchen);
});
test('reds & yellows: a miss on the first of two visits keeps the turn', () => {
  const { res, game } = judge('uk8', { groups: ['solids', 'stripes'], visits: 2 }, { first: 1 });
  const ng = C.nextGame(game, res, 0);
  assert.strictEqual(ng.turn, 0); assert.strictEqual(ng.visits, 1);
});
const onBlackTable = () => C.rack8().map(b => ({ ...b, potted: b.id >= 1 && b.id <= 7 }));   // reds (1-7) all potted
test('reds & yellows: a foul against a player on the black gives two visits (standard rules)', () => {
  const balls = onBlackTable(), { res, game } = judge('uk8', { groups: ['stripes', 'solids'], balls }, { first: 1, pots: [0] });
  const ng = C.nextGame(game, res, 0, balls);
  assert.strictEqual(ng.turn, 1); assert.strictEqual(ng.visits, 2);
});
test('reds & yellows, "one visit on the black": the player on the black gets one visit and the free ball', () => {
  const balls = onBlackTable(), { res, game } = judge('uk8', { groups: ['stripes', 'solids'], oneVisitOnBlack: true, balls }, { first: 1, pots: [0] });
  const ng = C.nextGame(game, res, 0, balls);
  assert.strictEqual(ng.turn, 1); assert.strictEqual(ng.visits, 1); assert.ok(ng.freeShot);
});
test('reds & yellows, "one visit on the black": clearing your colour on the first of two visits loses the second', () => {
  const after = onBlackTable(), before = after.map(b => ({ ...b, potted: b.potted && b.id !== 7 }));   // the 7 goes in on this shot
  const game = { ...C.newGame('uk8'), breakShot: false, ballInHand: false, kitchen: false, groups: ['solids', 'stripes'], visits: 2, oneVisitOnBlack: true };
  const res = C.judge(game, { first: 7, railAfter: true, pots: [7], cushMask: 0 }, before, after, 0);
  const ng = C.nextGame(game, res, 0, after);
  assert.ok(res.keepTurn); assert.strictEqual(ng.turn, 0); assert.strictEqual(ng.visits, 1);
  const miss = C.nextGame(ng, C.judge(ng, { first: 8, railAfter: true, pots: [], cushMask: 0 }, after, after, 0), 0, after);
  assert.strictEqual(miss.turn, 1, 'missing the black then passes the turn');
});
test('reds & yellows, "one visit on the black": a player not yet on the black still gets two visits', () => {
  const balls = C.rack8(), { res, game } = judge('uk8', { groups: ['solids', 'stripes'], oneVisitOnBlack: true, balls }, { first: 1, pots: [0] });
  assert.strictEqual(C.nextGame(game, res, 0, balls).visits, 2);
});

console.log('\nTrick shots');
const tricks = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'game.js'), 'utf8').match(/const TRICKS = (\[.*?\]);\n/)[1]);
for (const t of tricks) test(`"${t.name}" demo shot works`, () => {
  const w = run(t.balls.map(([id, x, z]) => B(id, x, z)), t.demo, 20);
  assert.ok(t.pot.every(id => w.rec.pots.includes(id)) && !w.rec.pots.includes(0), 'demo no longer pots its balls; run node tools/find-trick-demos.js');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
