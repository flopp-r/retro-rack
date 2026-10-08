// Looks tests: the catalogue, case odds and the guarantee, opening, buying and selling, earning, and the saved locker.
// Run with:  node tests/looks.test.js   (no installs needed)
const assert = require('assert');
const K = require('../src/career.js'), L = require('../src/looks.js');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
// a repeatable stand-in for Math.random
const seeded = s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
const hex = v => /^#[0-9a-f]{6}$/.test(v);

console.log('\nThe catalogue');
test('every case item has a unique id, a known kind and rarity, and proper colours', () => {
  const ids = L.CASE_ITEMS.map(it => it.id);
  assert.strictEqual(new Set(ids).size, ids.length);
  assert.ok(ids.every(id => !K.has(K.ITEMS, id)), 'no clash with the shop');
  for (const it of L.CASE_ITEMS) {
    assert.ok(L.RARITY[it.rarity] && it.name, it.id);
    if (it.kind === 'cloth') assert.ok(hex(it.col) && hex(it.col2) && it.pat, it.id);
    else if (it.kind === 'cue') assert.ok(Object.keys(K.HOUSE_CUE).every(k => hex(it.col[k])) && (!it.pat || hex(it.pc)), it.id);
    else if (it.kind === 'glove') assert.ok(hex(it.base) && hex(it.accent) && hex(it.cuff) && it.style && (!it.fx || hex(it.fxc)), it.id);
    else assert.fail('unknown kind ' + it.kind);
  }
});
test('about 54 items: 12 cloths, 18 cues and 24 gloves, every rarity in each pool', () => {
  const n = k => L.CASE_ITEMS.filter(it => it.kind === k).length;
  assert.deepStrictEqual([n('cloth'), n('cue'), n('glove')], [12, 18, 24]);
  for (const r of L.RARITIES) assert.ok(L.POOL[r].length >= 5, r);
});
test('every grade\'s odds add up to 100, legendaries only in the two best, and the better grades cost more', () => {
  for (const g of L.GRADE_IDS) assert.strictEqual(L.GRADES[g].odds.reduce((a, b) => a + b, 0), 100, g);
  assert.ok(L.GRADES.bronze.odds[3] === 0 && L.GRADES.gold.odds[3] > 0 && L.GRADES.diamond.odds[3] > L.GRADES.gold.odds[3]);
  for (let i = 1; i < L.GRADE_IDS.length; i++) {
    const a = L.GRADES[L.GRADE_IDS[i - 1]], b = L.GRADES[L.GRADE_IDS[i]];
    assert.ok(b.open > a.open && b.price > a.price);
  }
});

test('career opponents\' gloves are real gloves', () => {
  const with_ = Object.entries(K.OPPONENTS).filter(([, o]) => o.glove);
  assert.ok(with_.length >= 8 && with_.every(([id, o]) => L.ALL[o.glove] && L.ALL[o.glove].kind === 'glove'), with_.map(([id]) => id).join());
});

console.log('\nOpening cases');
test('over many cases, each rarity comes up about as often as the odds say', () => {
  const rnd = seeded(7), N = 40000;
  for (const g of L.GRADE_IDS) {
    const count = { common: 0, rare: 0, epic: 0, legendary: 0 };
    for (let i = 0; i < N; i++) count[L.ALL[L.roll(g, 0, rnd)].rarity]++;
    L.RARITIES.forEach((r, i) => assert.ok(Math.abs(count[r] / N * 100 - L.GRADES[g].odds[i]) < 1, `${g} ${r}: ${count[r] / N * 100}%`));
  }
});
test('the guarantee: never more than 8 cases in a row without an epic or better', () => {
  const l = L.newLocker(), rnd = seeded(3); l.money = 1e6; l.cases.bronze = 3000;
  let run = 0, worst = 0;
  while (l.cases.bronze) { const r = L.openCase(l, 'bronze', rnd); run = L.RARITIES.indexOf(r.rarity) >= 2 ? 0 : run + 1; worst = Math.max(worst, run); }
  assert.ok(worst <= L.PITY - 1, `worst run ${worst}`);
  assert.strictEqual(l.opened, 3000);
});
test('opening needs a case and the money, takes both, and adds a new item', () => {
  const l = L.newLocker(); l.money = 10; l.cases = { bronze: 0, silver: 1, gold: 0, diamond: 0 };
  assert.strictEqual(L.openCase(l, 'bronze', Math.random), 'none');
  assert.strictEqual(L.openCase(l, 'silver', Math.random), 'money');
  assert.strictEqual(L.openCase(l, 'tin', Math.random), 'unknown');
  l.money = 50; const r = L.openCase(l, 'silver', seeded(1));
  assert.ok(r.id && !r.dup && l.owned.includes(r.id) && l.money === 10 && l.cases.silver === 0);
});
test('a duplicate is sold at once for its rarity\'s price', () => {
  const l = L.newLocker(); l.owned = L.CASE_ITEMS.map(it => it.id); l.money = 15; l.cases.bronze = 1;
  const r = L.openCase(l, 'bronze', seeded(9));
  assert.ok(r.dup && r.sold === L.RARITY[r.rarity].sell && l.money === r.sold && l.owned.length === L.CASE_ITEMS.length);
});
test('the reel shows items the case can really give', () => {
  const items = L.reelItems('bronze', 500, seeded(5));
  assert.ok(items.length === 500 && items.every(id => L.ALL[id].rarity !== 'legendary'));
});

console.log('\nBuying');
test('buying a case or a shop look needs the money, and a look only once', () => {
  const l = L.newLocker(); l.money = 300;
  assert.strictEqual(L.buyCase(l, 'diamond'), 'money');
  assert.strictEqual(L.buyCase(l, 'silver'), 'ok'); assert.ok(l.money === 190 && l.cases.silver === 2);
  assert.strictEqual(L.buyLook(l, 'ice'), 'money');
  assert.strictEqual(L.buyLook(l, 'charcoal'), 'ok'); assert.ok(l.money === 90 && L.owns(l, 'charcoal'));
  assert.strictEqual(L.buyLook(l, 'charcoal'), 'owned'); assert.strictEqual(L.buyLook(l, 'g-gold'), 'unknown');
});

console.log('\nEarning');
test('frames won against the computer pay, and every 3 fill a case of the level\'s grade', () => {
  const l = L.newLocker(); l.money = 0;
  let r = L.cpuFrameWon(l, 'hard'); assert.ok(r.pay === 30 && !r.grade && r.meter.grade === 'gold' && r.meter.n === 1);
  L.cpuFrameWon(l, 'hard'); r = L.cpuFrameWon(l, 'hard');
  assert.ok(r.grade === 'gold' && l.cases.gold === 1 && l.meter.gold === 0 && l.money === 90);
  assert.ok(L.cpuFrameWon(l, 'easy').meter.grade === 'bronze' && L.cpuFrameWon(l, 'nonsense') === null);
});
test('career frames fill the tier\'s meter without pay; events give the tier\'s case, championships the next', () => {
  const l = L.newLocker(), m0 = l.money;
  assert.ok(L.careerFrameWon(l, 1).meter.grade === 'silver' && l.money === m0);
  assert.deepStrictEqual(L.eventWon(l, 0, false), { grade: 'bronze', n: 1 });
  assert.deepStrictEqual(L.eventWon(l, 0, true), { grade: 'silver', n: 1 });
  assert.deepStrictEqual(L.eventWon(l, 3, true), { grade: 'diamond', n: 2 });
  assert.ok(l.cases.bronze === 1 && l.cases.silver === 2 && l.cases.diamond === 2);
});
test('only the first online win of the day pays', () => {
  const l = L.newLocker();
  assert.ok(L.onlineWon(l, '2026-10-08').grade === 'gold' && L.onlineWon(l, '2026-10-08') === null && L.onlineWon(l, '2026-10-09'));
  assert.strictEqual(l.cases.gold, 2);
});

console.log('\nThe saved locker');
test('a new locker has one silver case and the money to open it', () => {
  const l = L.newLocker(); assert.ok(l.cases.silver === 1 && l.money >= L.GRADES.silver.open && !l.owned.length);
});
test('bad values are cleaned up: unknown or free looks, negative money, too many cases, a broken date', () => {
  const l = L.validateLocker({ v: 1, money: -5, owned: ['g-gold', 'g-gold', '__proto__', 'house', 'g-white', 'navy'], cases: { gold: 1e9, tin: 3 }, meter: { gold: 7 }, pity: 99, daily: 'today' });
  assert.ok(l.money === 0 && l.owned.join() === 'g-gold,navy' && l.cases.gold === 999 && !('tin' in l.cases) && l.meter.gold === L.METER - 1 && l.pity === L.PITY - 1 && l.daily === '');
  assert.deepStrictEqual(L.validateLocker(null), L.newLocker()); assert.deepStrictEqual(L.validateLocker({ v: 2 }), L.newLocker());
});
test('merging a locker from a file takes nothing away', () => {
  const l = L.newLocker(); l.money = 500; l.owned = ['g-gold']; l.cases.gold = 2;
  L.mergeLocker(l, { v: 1, money: 100, owned: ['q-neon'], cases: { gold: 1, bronze: 4 } });
  assert.ok(l.money === 500 && l.owned.join() === 'g-gold,q-neon' && l.cases.gold === 2 && l.cases.bronze === 4);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
