// The money counter in the menus' top-right corner: it shows the locker's money on every menu screen, counts down and
// up to each new amount with the change drifting beside it, holds while a case's reel spins (so a duplicate's sale isn't
// given away), counts in money earned in a game on the way back to the menu, follows another open page, hides in a game
// and in Preview, and opens the locker when tapped. Also the Diamond case's card: epic or better, £250 to open, £900.
// Over http, like the locker test: two pages share storage.
const { chromium, SITE } = require('./lib');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(100); } return false; };
const gbp = n => '£' + n.toLocaleString('en-GB');

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const logs = [];
  const watch = p => { p.on('console', m => { if (!/GPU stall/.test(m.text())) logs.push(`[${m.type()}] ${m.text()}`); }); p.on('pageerror', e => logs.push(`[pageerror] ${e.message}`)); p.on('dialog', d => d.accept()); };
  // a locker that owns every case look and has had every reward, so a case always gives a duplicate and pays nothing else
  const seed = () => { if (localStorage.getItem('test.seeded')) return; localStorage.setItem('test.seeded', '1'); localStorage.setItem('retroRack.rotateHint', 'off'); localStorage.setItem('test.fill', '1'); };
  const fill = p => p.evaluate(() => {
    if (!localStorage.getItem('test.fill')) return; localStorage.removeItem('test.fill');
    const LK = __rr.LK, l = LK.newLocker(); l.money = 1000; l.cases.bronze = 2; l.cases.silver = 0; l.cases.diamond = 1;
    l.owned = LK.CASE_ITEMS.map(it => it.id); l.claimed = [...Object.keys(LK.COLLECTIONS), ...LK.RARITIES, 'all'];
    localStorage.setItem('retroRack.locker', JSON.stringify(l)); location.reload();
  });
  const ctx = await b.newContext({ viewport: { width: 762, height: 341 } }); await ctx.addInitScript(seed);
  const open = async () => { const p = await ctx.newPage(); watch(p); await p.goto(SITE.new); await sleep(1000); await fill(p); await sleep(1200); return p; };
  const p = await open();
  const amt = (q = p) => q.textContent('#moneyAmt');
  const lock = (q = p) => q.evaluate(() => JSON.parse(localStorage.getItem('retroRack.locker')));
  const setLock = (q, ch) => q.evaluate(c => { const l = JSON.parse(localStorage.getItem('retroRack.locker')); Object.assign(l, c); localStorage.setItem('retroRack.locker', JSON.stringify(l)); }, ch);
  const deltas = () => p.evaluate(() => [...document.querySelectorAll('#bMoney .moneyDelta')].map(e => e.className.split(' ')[1] + ' ' + e.textContent));

  console.log('--- on every menu screen, in the corner');
  ok(await amt() === '£1,000' && await p.isVisible('#bMoney'), `the home screen shows the money (${await amt()})`);
  const where = await p.evaluate(() => { const m = document.querySelector('#bMoney').getBoundingClientRect(), g = document.querySelector('#bMenuSettings').getBoundingClientRect(); return { top: m.top, right: innerWidth - m.right, beside: m.right <= g.left && Math.abs(m.top - g.top) < 1, h: [m.height, g.height] }; });
  ok(where.beside && where.top < 30 && where.right < 120 && where.h[0] === where.h[1], `top right, just left of the Settings cog and the same height (${JSON.stringify(where)})`);
  for (const [sel, name] of [['[data-go="single"]', 'Single player'], ['[data-go="game"][data-opp="bot"]', 'Vs computer'], ['[data-mode="8ball"]', 'the game setup']]) {
    await p.click(sel); await sleep(650); ok(await p.isVisible('#bMoney') && await amt() === '£1,000', `${name}: still there`);
  }

  console.log('--- tapping it opens the locker; Back comes back');
  await p.click('#bMoney'); await sleep(700);
  ok(await p.isVisible('#sc-locker'), 'from the game setup, the locker opens');
  await p.click('#bMoney'); await sleep(300); ok(await p.isVisible('#sc-locker'), 'on the locker, tapping it does nothing more');
  await p.click('#mBack'); await sleep(700); ok(await p.isVisible('#sc-setup'), 'Back returns to the game setup');
  await p.click('#bMoney'); await sleep(700);

  console.log('--- the Diamond case');
  const dia = await p.textContent('.caseCard:nth-child(4)');
  ok(/Always epic or better: 70% epic, 24% legendary, 6% mythic/.test(dia) && /Open £250/.test(dia) && /Buy £900/.test(dia), `its card: epic or better every time, £250 to open, £900 to buy ("${dia}")`);
  ok(!/Always/.test(await p.textContent('.caseCard:nth-child(3)')), 'the gold case is as it was');

  console.log('--- spending: it counts down, with the change beside it');
  await p.click('.caseCard:nth-child(1) .btn:nth-child(2)'); await sleep(250);   // buy a bronze case, £45
  const mid = await amt(), d1 = await deltas();
  ok(d1.includes('down -£45'), `the change shows as it happens (${d1})`);
  ok(await until(async () => await amt() === '£955') && (await lock()).money === 955, `and it settles on what's left (${mid} on the way)`);
  ok(await until(async () => !(await deltas()).length, 3000), 'the change fades away');

  console.log('--- opening a case: the cost at once, a duplicate\'s sale only once the reel stops');
  await p.click('.caseCard:nth-child(1) .btn:nth-child(1)'); await sleep(200);
  const above = await p.evaluate(() => { const z = el => +getComputedStyle(el).zIndex, cog = getComputedStyle(document.querySelector('#bMenuSettings')).visibility;
    return { top: z(document.querySelector('#menuIcons')) > z(document.querySelector('#reel')) && getComputedStyle(document.querySelector('#bMoney')).visibility === 'visible', cog, reel: !document.querySelector('#reel').hidden }; });
  ok(above.reel && above.top && above.cog === 'hidden', `the reel spins with the counter in view above it, and the corner icons out of the way (${JSON.stringify(above)})`);
  const L1 = await lock(), sale = L1.money - (955 - 8);
  ok(sale > 0 && (await p.evaluate(() => __rr.reel.res.dup)), `the locker has paid £8 and sold the duplicate for ${gbp(sale)} already`);
  ok(await until(async () => await amt() === '£947'), `the counter shows only the £8 paid (${await amt()})`);
  await sleep(1500);
  ok(await amt() === '£947' && !(await deltas()).some(d => d.startsWith('up')) && await p.isHidden('#reelBtns'), 'still spinning: no sign of the sale yet');
  await p.evaluate(() => document.querySelector('#bMoney').click()); await sleep(200); ok(await p.isVisible('#reel') && await p.isVisible('#sc-locker'), 'its tap does nothing during the reel');
  await p.click('#reelWin'); await sleep(250);
  ok((await deltas()).includes(`up +${gbp(sale)}`), `when the reel stops, the sale comes in (${await deltas()})`);
  ok(await until(async () => await amt() === gbp(L1.money)), `and the counter settles on the locker's money (${await amt()})`);
  await p.click('#bReelDone'); await sleep(300);
  ok(await p.isVisible('#bMenuSettings') && await amt() === gbp(L1.money), 'Done: the icons are back and the counter is unchanged');
  await p.click('.caseCard:nth-child(1) .btn:nth-child(1)'); await sleep(80); await p.click('#reelWin'); await sleep(150);   // skipped while the cost is still counting down
  const L2 = await lock(), sale2 = L2.money - (L1.money - 8);
  ok((await deltas()).join() === `up +${gbp(sale2)}`, `skipped at once, the sale still shows in full (${await deltas()}, sold for ${gbp(sale2)})`);
  ok(await until(async () => await amt() === gbp(L2.money)), `and the counter settles on the locker's money (${await amt()})`);
  await p.click('#bReelDone'); await sleep(300); L1.money = L2.money;

  console.log('--- another open page');
  const p2 = await open();
  ok(await amt(p2) === gbp(L1.money), 'a second page shows the same money');
  await setLock(p2, { money: L1.money + 300 });
  ok(await until(async () => await amt() === gbp(L1.money + 300)), 'money added in the second page is counted in on the first');
  await p2.close();

  console.log('--- hidden in a game and in Preview; money earned meanwhile counts in on the way back');
  const before = (await lock()).money;
  await p.click('#mBack'); await sleep(700); await p.click('#bStart'); await sleep(900);
  ok(await p.evaluate(() => __rr.state) !== 'menu' && await p.isHidden('#bMoney') && await p.isHidden('#bMenuSettings'), 'in a game the counter and icons are hidden');
  const p3 = await open(); await setLock(p3, { money: before + 150 }); await p3.close(); await sleep(400);   // stands in for a frame's pay
  ok(await amt() === gbp(before), 'out of sight, it waits');
  await p.evaluate(() => { document.querySelector('#bPause').click(); }); await sleep(250); await p.click('#bQuit'); await sleep(250);
  ok((await deltas()).includes('up +£150'), `back at the menu, the £150 comes in (${await deltas()})`);
  ok(await until(async () => await amt() === gbp(before + 150)), `and the counter settles on it (${await amt()})`);
  await p.click('#bMoney'); await sleep(700); await p.click('#lockTabs .btn:nth-child(2)'); await sleep(250); await p.click('#bPreview'); await sleep(900);
  ok(await p.isHidden('#bMoney'), 'Preview: hidden with the menu');
  await p.mouse.click(380, 120); await sleep(600);
  ok(await p.isVisible('#bMoney') && await amt() === gbp(before + 150), 'back from Preview: shown again');

  console.log('--- dev mode\'s test locker is marked');
  await p.evaluate(() => { localStorage.setItem('retroRack.dev', '1'); location.reload(); }); await sleep(1500);
  ok(await amt() === '£100,000' && await p.getAttribute('#bMoney', 'title') === 'Test locker' && await p.evaluate(() => getComputedStyle(document.querySelector('#bMoney')).borderStyle) === 'dashed', 'the test locker\'s money, with a dashed border');
  await p.evaluate(() => { localStorage.removeItem('retroRack.dev'); }); await p.close();

  console.log('--- with reduced motion, the amount just changes');
  const rc = await b.newContext({ viewport: { width: 762, height: 341 }, reducedMotion: 'reduce' }); await rc.addInitScript(seed);
  const r = await rc.newPage(); watch(r); await r.goto(SITE.new); await sleep(1000); await fill(r); await sleep(1200);
  await r.click('[data-go="locker"]'); await sleep(300); await r.click('.caseCard:nth-child(1) .btn:nth-child(2)'); await sleep(60);
  ok(await amt(r) === '£955' && !(await r.$$('#bMoney .moneyDelta')).length, `no counting and nothing drifting (${await amt(r)})`);
  await rc.close();

  ok(!logs.length, 'console clean' + (logs.length ? ': ' + logs.join(' | ') : ''));
  await b.close();
})();
