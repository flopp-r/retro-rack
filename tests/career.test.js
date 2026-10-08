// Career tests: the tour data, draws, results and prize money, saving and loading, and the opponents' CPU settings.
// Run with:  node tests/career.test.js   (no installs needed)
const assert = require('assert');
const C = require('../src/core.js'), K = require('../src/career.js');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
const fresh = () => K.newCareer({ name: 'Tess', look: { s: 'cap', shirt: '#ff6f8f' }, guide: 'ghost' }, 0);
const playEvent = (c, id, seed, results) => {   // results: true/false per round, until you go out or win
  assert.ok(K.enterEvent(c, id, seed)); let r;
  for (const won of results) { const race = c.run.match.race; r = K.recordMatch(c, won ? [race, race - 1] : [race - 2 < 0 ? 0 : 1, race]); if (!c.run) break; }
  return r;
};

console.log('\nThe tour');
test('every event has 7 known, different opponents, three rounds and rising prizes', () => {
  for (const e of Object.values(K.EVENTS)) {
    assert.strictEqual(new Set(e.field).size, 7, e.id);
    assert.ok(e.field.every(id => K.OPPONENTS[id]), e.id);
    assert.strictEqual(e.races.length, K.ROUNDS.length, e.id);
    assert.ok(e.prize.length === 4 && e.prize.every((p, i) => i === 0 || p > e.prize[i - 1]), e.id);
  }
});
test('opponents have a name, a look, a blurb, a CPU level and a rating', () => {
  for (const [id, o] of Object.entries(K.OPPONENTS)) assert.ok(o.name && o.full && o.look.s && o.blurb && C.DIFF[o.base] && o.rating > 1000, id);
});

console.log('\nDraws');
test('only open events can be entered, and only one at a time', () => {
  const c = fresh();
  assert.ok(!K.enterEvent(c, 'crown', 1), 'locked event entered');
  assert.ok(K.enterEvent(c, 'redlion', 1));
  assert.ok(!K.enterEvent(c, 'redlion', 2), 'entered twice');
});
test('a draw has all 8 players once, and the top two seeds are in opposite halves', () => {
  for (let seed = 1; seed < 40; seed++) {
    const c = fresh(); K.enterEvent(c, 'redlion', seed);
    const s = c.run.slots, byRating = [...K.EVENTS.redlion.field].sort((a, b) => K.OPPONENTS[b].rating - K.OPPONENTS[a].rating);
    assert.strictEqual(new Set(s).size, 8); assert.ok(s.includes('you'));
    assert.ok(s.indexOf(byRating[0]) < 4 && s.indexOf(byRating[1]) >= 4, `seed ${seed}: ${s}`);
  }
});
test('the same seed always gives the same draw and the same results', () => {
  const a = fresh(), b = fresh();
  playEvent(a, 'redlion', 99, [true, true, false]); playEvent(b, 'redlion', 99, [true, true, false]);
  assert.strictEqual(JSON.stringify(a.last), JSON.stringify(b.last));
});

console.log('\nResults and money');
test('winning every round: champion, top prize, a trophy, and the next event opens', () => {
  const c = fresh(), r = playEvent(c, 'redlion', 5, [true, true, true]);
  assert.ok(r.champion && r.prize === 100 && c.money === 100 && c.trophies.length === 1 && !c.run);
  assert.ok(K.unlocked(c, 'crown') && !K.unlocked(c, 'pubchamp'));
  assert.deepStrictEqual(c.last.res.map(x => x.length), [4, 2, 1]); assert.strictEqual(c.last.res[2][0], 'you');
});
test('going out pays that round: semi-final loss in the first event is £25', () => {
  const c = fresh(), r = playEvent(c, 'redlion', 6, [true, false]);
  assert.ok(!r.won && r.round === 1 && r.prize === 25 && c.money === 25 && c.done.redlion.best === 1 && !K.unlocked(c, 'crown'));
  assert.strictEqual(c.last.res[2].length, 1, 'the rest of the event is played out');
});
test('winning the last event of the tier completes it', () => {
  const c = fresh();
  playEvent(c, 'redlion', 1, [true, true, true]); playEvent(c, 'crown', 2, [true, true, true]);
  const r = playEvent(c, 'pubchamp', 3, [true, true, true]);
  assert.ok(r.tierDone && K.tierDone(c, 0) && c.money === 700 && c.trophies.length === 3);
  assert.ok(!playEvent(c, 'pubchamp', 4, [true, true, true]).tierDone, 'only the first win completes the tier');
});
test('withdrawing counts as losing the current match', () => {
  const c = fresh(); K.enterEvent(c, 'redlion', 8); K.recordMatch(c, [2, 0]);
  const r = K.withdraw(c);
  assert.ok(!r.won && r.round === 1 && c.money === 25 && !c.run);
});
test('computer players: the stronger wins more often', () => {
  const r = K.rng(42); let w = 0;
  for (let i = 0; i < 2000; i++) { const s = K.simMatch('ray', 'dave', 2, r); if (s[0] > s[1]) w++; }
  assert.ok(w > 1500 && w < 2000, `${w} of 2000`);
});

console.log('\nThe tiers and the shop');
test('four tiers, three events each: pub reds & yellows, club and hall 8-ball, national 9-ball', () => {
  assert.deepStrictEqual(K.TIERS.map(t => t.mode), ['uk8', '8ball', '8ball', '9ball']);
  assert.ok(K.TIERS.every(t => t.events.length === 3 && t.short && t.champ));
});
test('each tier opens when the one before is won, event by event', () => {
  const c = fresh();
  assert.ok(!K.unlocked(c, 'oakfield'));
  playEvent(c, 'redlion', 1, [true, true, true]); playEvent(c, 'crown', 2, [true, true, true]);
  assert.ok(!K.unlocked(c, 'oakfield'), 'club open before the pub tier is won');
  const r = playEvent(c, 'pubchamp', 3, [true, true, true]);
  assert.ok(r.tierDone && K.unlocked(c, 'oakfield') && !K.unlocked(c, 'riverside') && !K.unlocked(c, 'downtown'));
});
test('opponents play in one tier each, get stronger tier by tier, and use real cue designs', () => {
  const avg = ti => { const ids = Object.keys(K.OPPONENTS).filter(id => K.tierOf(id) === ti); return ids.reduce((a, id) => a + K.OPPONENTS[id].rating, 0) / ids.length; };
  for (let ti = 1; ti < K.TIERS.length; ti++) assert.ok(avg(ti) > avg(ti - 1), `tier ${ti}`);
  for (const [id, o] of Object.entries(K.OPPONENTS)) {
    assert.ok(K.tierOf(id) >= 0, id);
    assert.ok(!o.cue || (K.ITEMS[o.cue] && K.ITEMS[o.cue].kind === 'cue'), id);
  }
  const st = Object.keys(K.OPPONENTS).map(K.stars);
  assert.ok(Math.min(...st) === 1 && Math.max(...st) === 5, 'stars use the whole 1 to 5 range');
});
test('the shop: buying needs the money, takes it, and only once', () => {
  const c = fresh(); c.money = 300;
  assert.strictEqual(K.buy(c, 'ice'), 'money');
  assert.strictEqual(K.buy(c, 'navy'), 'ok'); assert.ok(c.money === 50 && c.bought.includes('navy'));
  assert.strictEqual(K.buy(c, 'navy'), 'owned'); assert.strictEqual(K.buy(c, 'nothing'), 'unknown');
  assert.ok(K.SHOP.every(it => (it.kind === 'cloth' && /^#[0-9a-f]{6}$/.test(it.col)) || (it.kind === 'cue' && Object.keys(K.HOUSE_CUE).every(k => /^#[0-9a-f]{6}$/.test(it.col[k])))));
});
test('prize money counts towards both what you can spend and what you have won', () => {
  const c = fresh(); playEvent(c, 'redlion', 5, [true, true, true]); K.buy(c, 'charcoal');
  assert.ok(c.money === 0 && c.earned === 100);
});
test('a save from before the shop loads: everything it had was won', () => {
  const c = K.validate({ v: 1, name: 'Old', money: 300, trophies: [], done: {}, history: [] });
  assert.ok(c.earned === 300 && Array.isArray(c.bought) && !c.bought.length);
});

console.log('\nSaving and loading');
test('a career survives saving and loading unchanged, mid-event too', () => {
  const c = fresh(); K.enterEvent(c, 'redlion', 3); K.recordMatch(c, [2, 1]);
  c.run.match.wins = [1, 0]; c.run.match.snap = { balls: [[0, 0.1, 0.2, 0]], game: { mode: 'uk8', groups: [null, null] }, shots: [1, 2], wins: [1, 0] };
  assert.strictEqual(JSON.stringify(K.validate(JSON.parse(JSON.stringify(c)))), JSON.stringify(c));
});
test('anything that is not a career is refused', () => {
  for (const x of [null, 5, 'hi', {}, { v: 2, name: 'x' }, { v: 1 }]) assert.strictEqual(K.validate(x), null, JSON.stringify(x));
});
test('bad values are cleaned up: look, money, unknown events and a broken run', () => {
  const c = K.validate({ v: 1, name: '<b>Tess</b>', look: { s: 'robot', shirt: 'red' }, money: -5, done: { nowhere: { won: 1 } }, trophies: [{ event: 'nowhere' }], run: { event: 'redlion', slots: ['you'] } });
  assert.ok(c.name === 'bTess/b' && c.look.s === 'man' && c.look.shirt === '#ffc56b' && c.money === 0 && !c.done.nowhere && !c.trophies.length && c.run === null);
});

console.log('\nOpponents at the table');
test('every opponent\'s CPU settings are complete, and nerves only bite on the final ball', () => {
  for (const id of Object.keys(K.OPPONENTS)) {
    const calm = K.profileFor(id), tense = K.profileFor(id, { onFinal: true });
    for (const k of Object.keys(C.DIFF.medium)) assert.ok(calm[k] !== undefined, `${id}.${k}`);
    assert.ok(tense.aimSd >= calm.aimSd, id);
  }
  assert.ok(K.profileFor('gaz', { onFinal: true }).aimSd > 2 * K.profileFor('gaz').aimSd);
});
test('a level name and the same settings as a profile plan the same shot', () => {
  C.setTable('uk7');
  const plan = d => { const rnd = K.rng(11), g = C.newGame('uk8'); g.breakShot = false; g.ballInHand = false; const it = C.planBot(g, C.rack8(K.rng(3)).map((b, i) => (i ? b : Object.assign(b, { x: -0.6, z: 0.1 }))), 0, d, rnd); let r; do r = it.next(); while (!r.done); return JSON.stringify(r.value); };
  assert.strictEqual(plan('medium'), plan({ ...C.DIFF.medium }));
});
test('every opponent can break and play a shot', () => {
  C.setTable('uk7');
  for (const id of Object.keys(K.OPPONENTS)) {
    const g = C.newGame('uk8'), it = C.planBot(g, C.rack8(K.rng(1)), 0, K.profileFor(id), K.rng(2)); let r; do r = it.next(); while (!r.done);
    assert.ok(Number.isFinite(r.value.phi) && r.value.power > 0.5, `${id} break`);
  }
});
test('"on the final ball": the black once your colour is cleared, the 9 when it is alone', () => {
  C.setTable('uk7');
  const balls = C.rack8(K.rng(1)), g = C.newGame('uk8'); g.groups = ['solids', 'stripes'];
  assert.ok(!K.onFinalBall(g, balls, 0));
  for (const b of balls) if (C.groupOf(b.id) === 'solids') b.potted = true;
  assert.ok(K.onFinalBall(g, balls, 0) && !K.onFinalBall(g, balls, 1));
  const nine = C.rack9(K.rng(1)), g9 = C.newGame('9ball');
  for (const b of nine) if (b.id && b.id !== 9) b.potted = true;
  assert.ok(K.onFinalBall(g9, nine, 0));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
