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
test('about 60 items: 14 cloths, 20 cues and 26 gloves, every rarity in the pools', () => {
  const n = k => L.CASE_ITEMS.filter(it => it.kind === k).length;
  assert.deepStrictEqual([n('cloth'), n('cue'), n('glove')], [14, 20, 26]);
  for (const r of L.RARITIES) assert.ok(L.POOL[r].length >= (r === 'mythic' ? 6 : 5), r);
});
test('a forced rarity (dev mode\'s next case mythic) comes up every time, but only where the grade holds it', () => {
  const rnd = seeded(4);
  for (const g of L.GRADE_IDS) for (let i = 0; i < 50; i++) assert.strictEqual(L.ALL[L.roll(g, 0, rnd, 'mythic')].rarity, 'mythic', g);
  const seen = new Set(); for (let i = 0; i < 400; i++) seen.add(L.ALL[L.roll('bronze', 0, rnd, 'legendary')].rarity);
  assert.ok(!seen.has('legendary') && seen.has('common'), 'bronze holds no legendaries, so it rolls as usual');
  const l = L.newLocker(); l.money = 100; l.cases.bronze = 1; l.pity = 3;
  const r = L.openCase(l, 'bronze', rnd, 'mythic');
  assert.ok(r.rarity === 'mythic' && l.money === 100 - 8 && l.cases.bronze === 0 && l.pity === 0 && l.owned.includes(r.id));
});
test('mythic looks are animated, two of each kind, and the rarest in every grade', () => {
  const m = L.POOL.mythic.map(id => L.ALL[id]);
  for (const k of ['cloth', 'cue', 'glove']) assert.strictEqual(m.filter(it => it.kind === k).length, 2, k);
  assert.ok(m.every(it => it.anim || it.fx), 'every mythic moves');
  for (const g of L.GRADE_IDS) { const o = L.GRADES[g].odds; assert.ok(o[4] > 0 && o[4] < Math.min(...o.slice(0, 4).filter(v => v > 0)), g); }
  assert.ok(L.RARITY.mythic.sell > L.RARITY.legendary.sell);
});
test('every grade\'s odds add up to 100, legendaries only in the two best, and the better grades cost more', () => {
  for (const g of L.GRADE_IDS) assert.ok(Math.abs(L.GRADES[g].odds.reduce((a, b) => a + b, 0) - 100) < 1e-9, g);
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
  const rnd = seeded(7), N = 60000;
  for (const g of L.GRADE_IDS) {
    const count = Object.fromEntries(L.RARITIES.map(r => [r, 0]));
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
  assert.ok(r.id && !r.dup && l.owned.includes(r.id) && l.money === 30 && l.cases.silver === 0);
});
test('a duplicate is sold at once for its rarity\'s price', () => {
  const l = L.newLocker(); l.owned = L.CASE_ITEMS.map(it => it.id); l.claimed = [...Object.keys(L.COLLECTIONS), ...L.RARITIES, 'all']; l.money = L.GRADES.bronze.open; l.cases.bronze = 1;
  const r = L.openCase(l, 'bronze', seeded(9));
  assert.ok(r.dup && r.sold === L.RARITY[r.rarity].sell && l.money === r.sold && l.owned.length === L.CASE_ITEMS.length);
});
test('the reel shows items the case can really give', () => {
  const items = L.reelItems('bronze', 500, seeded(5));
  assert.ok(items.length === 500 && items.every(id => L.ALL[id].rarity !== 'legendary'));
});

console.log('\nCollections');
test('fifteen collections, a cloth, a cue and a glove one in each rarity, each with a reward, more for the rarer', () => {
  const keys = Object.keys(L.COLLECTIONS);
  assert.strictEqual(keys.length, 15);
  for (const r of L.RARITIES) for (const k of L.KINDS) { const items = L.colItems(r + ':' + k); assert.ok(items.length >= 2 && items.every(id => L.ALL[id].kind === k && L.ALL[id].rarity === r), r + ':' + k); }
  assert.strictEqual(keys.reduce((a, k) => a + L.colItems(k).length, 0), L.CASE_ITEMS.length, 'every case look is in exactly one');
  for (let i = 1; i < L.RARITIES.length; i++) { const a = L.RARITIES[i - 1], b = L.RARITIES[i]; assert.ok(L.COLLECTIONS[b + ':cue'].money > L.COLLECTIONS[a + ':cue'].money && L.SETS[b].money > L.SETS[a].money); }
  for (const r of L.RARITIES) assert.ok(L.SETS[r].money >= 2 * 3 * L.COLLECTIONS[r + ':cloth'].money, `${r}: a set pays far more than its three collections`);
  const fx = [...L.RARITIES.map(r => L.SETS[r].fx), L.GRAND.fx]; assert.strictEqual(new Set(fx).size, 6); assert.ok(fx.every(f => L.EFFECTS[f] && L.EFFECTS[f].name));
  for (const c of [...Object.values(L.COLLECTIONS), ...Object.values(L.SETS), L.GRAND]) for (const g in c.cases) assert.ok(L.GRADES[g], g);
});
test('a collection pays once; all three of a rarity pay its set and its effect; all fifteen the starfield room', () => {
  const l = L.newLocker(); l.money = 0; for (const g of L.GRADE_IDS) l.cases[g] = 0;
  const cl = L.colItems('common:cloth');
  l.owned = cl.slice(1); assert.deepStrictEqual(L.claimCollections(l), []); assert.ok(!L.collected(l, 'common:cloth'));
  l.owned.push(cl[0]);
  assert.deepStrictEqual(L.claimCollections(l), ['common:cloth']); assert.ok(l.money === 150 && l.cases.silver === 1);
  assert.deepStrictEqual(L.claimCollections(l), []); assert.strictEqual(l.money, 150, 'never paid twice');
  assert.deepStrictEqual(L.effects(l), [], 'no effect until the set is complete');
  l.owned.push(...L.colItems('common:cue'), ...L.colItems('common:glove'));
  assert.deepStrictEqual(L.claimCollections(l), ['common:cue', 'common:glove', 'common']);
  assert.ok(l.money === 3 * 150 + 1000 && l.cases.silver === 3 && l.cases.gold === 3); assert.deepStrictEqual(L.effects(l), ['trail']);
  l.owned = L.CASE_ITEMS.map(it => it.id); const done = L.claimCollections(l);
  assert.ok(done.length === 12 + 4 + 1 && done.slice(-5).join() === 'rare,epic,legendary,mythic,all', done.join());
  assert.strictEqual(l.money, 3 * 150 + 1000 + 3 * 400 + 2500 + 3 * 800 + 5000 + 3 * 2000 + 12000 + 3 * 5000 + 30000 + 50000);
  assert.deepStrictEqual(L.effects(l), ['trail', 'rails', 'sparks', 'neon', 'cosmic', 'stars']);
});
test('opening the case that completes a collection says so', () => {
  const l = L.newLocker(); l.money = 1000; l.cases.diamond = 1; l.owned = L.POOL.mythic.slice(1);
  const r = L.openCase(l, 'diamond', seeded(2), 'mythic');
  assert.ok(r.id === L.POOL.mythic[0] && !r.dup && r.done.includes('mythic:' + L.ALL[r.id].kind) && r.done.includes('mythic') && l.claimed.includes('mythic'), JSON.stringify(r));
});
test('a mythic is never a duplicate until all six are owned', () => {
  const l = L.newLocker(), rnd = seeded(8); l.money = 1e6; l.cases.diamond = 6;
  for (let i = 0; i < 6; i++) assert.ok(!L.openCase(l, 'diamond', rnd, 'mythic').dup);
  assert.ok(L.collected(l, 'mythic')); l.cases.diamond = 1;
  const r = L.openCase(l, 'diamond', rnd, 'mythic'); assert.ok(r.dup && r.sold === 500 && r.done.length === 0);
});
test('the saved locker keeps what was claimed, cleaned, and merging never pays a reward twice', () => {
  assert.deepStrictEqual(L.validateLocker({ v: 1, claimed: ['rare', 'rare', 'tin', 'all', '__proto__', 'mythic:cue', 'mythic:hat'] }).claimed, ['rare', 'all', 'mythic:cue']);
  assert.deepStrictEqual(L.newLocker().claimed, []);
  const l = L.newLocker(); L.mergeLocker(l, { v: 1, owned: L.POOL.common, claimed: ['common:cloth', 'common:cue', 'common:glove', 'common'], money: 0 });
  const m = l.money; assert.deepStrictEqual(L.claimCollections(l), []); assert.strictEqual(l.money, m);
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
test('every frame won against the computer pays, and earns a case of the level\'s grade', () => {
  const l = L.newLocker(); l.money = 0;
  const r = L.cpuFrameWon(l, 'hard'); assert.ok(r.pay === 90 && r.grade === 'gold' && l.cases.gold === 1 && l.money === 90);
  L.cpuFrameWon(l, 'hard'); assert.ok(l.cases.gold === 2 && l.money === 180);
  assert.ok(L.cpuFrameWon(l, 'easy').grade === 'bronze' && L.cpuFrameWon(l, 'expert').pay === 150 && L.cpuFrameWon(l, 'nonsense') === null);
});
test('every career frame won earns the tier\'s case, without pay; an event two cases, a championship two of the next grade', () => {
  const l = L.newLocker(), m0 = l.money;
  assert.ok(L.careerFrameWon(l, 1).grade === 'silver' && l.money === m0 && l.cases.silver === 2);
  assert.deepStrictEqual(L.eventWon(l, 0, false), { grade: 'bronze', n: 2 });
  assert.deepStrictEqual(L.eventWon(l, 0, true), { grade: 'silver', n: 2 });
  assert.deepStrictEqual(L.eventWon(l, 3, true), { grade: 'diamond', n: 4 });
  assert.ok(l.cases.bronze === 2 && l.cases.silver === 4 && l.cases.diamond === 4);
});
test('only the first online win of the day pays: £100 and two gold cases', () => {
  const l = L.newLocker(); l.money = 0;
  assert.deepStrictEqual(L.onlineWon(l, '2026-10-08'), { pay: 100, grade: 'gold', n: 2 });
  assert.ok(L.onlineWon(l, '2026-10-08') === null && L.onlineWon(l, '2026-10-09'));
  assert.ok(l.cases.gold === 4 && l.money === 200);
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
