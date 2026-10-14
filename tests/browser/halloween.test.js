// Halloween: a season of looks in its own cases. In the season the locker has a Halloween tab with the Trick and Treat
// cases; a Treat case always gives a look you don't have; the first frame won each day earns a Trick case; out of the
// season the cases can't be bought (held ones still open) and the tab hides when there's nothing of it; all thirty looks
// pay their rewards and bring the Haunted Hall at home, which has its own switch. Pages see fixed dates (lib.js,
// testDate), over http so storage carries over.
const { chromium, SITE } = require('./lib');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }), log = [];
  const page = async (day, locker) => {
    const ctx = await b.newContext({ viewport: { width: 480, height: 360 }, testDate: day });
    await ctx.addInitScript(l => { try { if (l && !sessionStorage.getItem('rr.seeded')) { localStorage.setItem('retroRack.locker', JSON.stringify(l)); sessionStorage.setItem('rr.seeded', '1'); } localStorage.setItem('retroRack.rotateHint', 'off'); } catch (e) {} }, locker || null);
    const p = await ctx.newPage(); p.on('dialog', d => d.accept());
    p.on('console', m => { if (!/GPU stall/.test(m.text())) log.push(`${day} [${m.type()}] ${m.text()}`); }); p.on('pageerror', e => log.push(`${day} [pageerror] ${e.message}`));
    await p.goto(SITE.new); await p.waitForTimeout(1200); return p;
  };
  const lock = p => p.evaluate(() => JSON.parse(localStorage.getItem('retroRack.locker')));
  const until = async (p, f, ms = 15000) => { for (let t = 0; t < ms; t += 200) { if (await f()) return true; await p.waitForTimeout(200); } return false; };
  const tabs = p => p.evaluate(() => [...document.querySelectorAll('#lockTabs button')].map(x => x.textContent));
  const toTab = async (p, name) => { await p.click(`#lockTabs button:has-text("${name}")`); await p.waitForTimeout(250); };
  const L0 = { v: 1, money: 2000, owned: [], cases: {}, meter: {}, pity: 0, daily: '', opened: 0, claimed: [] };

  console.log('--- in the season (20 October)');
  const p = await page('2026-10-20', L0);
  await p.click('[data-go="locker"]'); await p.waitForTimeout(400);
  ok((await tabs(p)).includes('Halloween'), `the locker has a Halloween tab (${await tabs(p)})`);
  await toTab(p, 'Halloween');
  const cards = await p.evaluate(() => [...document.querySelectorAll('#lockBody .caseName')].map(x => x.textContent));
  ok(cards.join() === 'Trick case,Treat case' && /Until 10 November/.test(await p.textContent('#lockBody')), `with the Trick and Treat cases, on sale until 10 November (${cards})`);
  ok(await p.evaluate(() => document.querySelectorAll('#lockBody .colTile').length) === 30, 'and all thirty looks, by rarity');
  await p.click('#lockBody button[data-grade="treat"]:has-text("Buy")'); await p.waitForTimeout(250);
  let L = await lock(p); ok(L.cases.treat === 1 && L.money === 1600, `buying a Treat case: £400 (${L.money} left)`);
  const got = [];
  for (let i = 0; i < 3; i++) {
    if (i) { await p.click('#lockBody button[data-grade="treat"]:has-text("Buy")'); await p.waitForTimeout(200); }
    await p.click('#lockBody button[data-grade="treat"]:has-text("Open")');
    await until(p, () => p.evaluate(() => !document.querySelector('#reel').hidden));
    await p.click('#reelWin'); await p.waitForTimeout(300);   // skips to the end
    const r = await p.evaluate(() => { const x = __rr.reel.res; return x && { ...x, series: __rr.LK.ALL[x.id].series }; }); got.push(r && r.id);
    ok(r && !r.dup && r.series === 'halloween', `Treat case ${i + 1}: ${r && r.id}, a Halloween look you didn't have`);
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  }
  ok(new Set(got).size === 3, 'three Treat cases, three different looks');
  ok(/3 of 30 Halloween looks/.test(await p.textContent('#lockPages')), 'the tab counts them');
  const reel = await p.evaluate(() => [...document.querySelectorAll('#reelStrip .reelTile')].length);
  ok(reel > 10, 'the reel showed the case\'s own looks');

  console.log('--- the day\'s Trick case');
  await p.evaluate(() => { const r = __rr; r.M.mode = '8ball'; r.M.opp = 'bot'; r.M.diff = 'easy'; r.M.race = 0; r.startGame(false); }); await p.waitForTimeout(800);
  const win = async () => { await until(p, () => p.evaluate(() => __rr.state !== 'over' && __rr.concedeFrame(false, 1))); await until(p, () => p.isVisible('#over'), 5000); return p.textContent('#overEarn'); };
  let e = await win(); L = await lock(p);
  ok(/Halloween: a Trick case for your first win today!/.test(e) && L.cases.trick === 1, `the first frame won today brings a Trick case ("${e}")`);
  await p.click('#bAgain'); await p.waitForTimeout(1200); e = await win(); L = await lock(p);
  ok(!/Halloween/.test(e) && L.cases.trick === 1, `the second doesn't ("${e}")`);

  console.log('--- on a phone on its side');
  const ph = await b.newContext({ viewport: { width: 762, height: 341 }, testDate: '2026-10-20' }), pp = await ph.newPage();
  pp.on('pageerror', e => log.push(`phone [pageerror] ${e.message}`));
  await pp.goto(SITE.new); await pp.waitForTimeout(1200); await pp.click('[data-go="locker"]'); await pp.waitForTimeout(400); await toTab(pp, 'Halloween');
  const o = await pp.evaluate(() => { const s = document.querySelector('#mStage'); return s.scrollHeight - s.clientHeight; });
  ok(o <= 1 && await pp.isVisible('#lockTabs button:has-text("Halloween")'), `the locker with its Halloween tab fits a phone on its side without scrolling (${o})`);
  await ph.close();

  console.log('--- out of the season (1 December)');
  const q = await page('2026-12-01', L0);
  await q.click('[data-go="locker"]'); await q.waitForTimeout(400);
  ok(!(await tabs(q)).includes('Halloween'), 'with nothing of Halloween, there\'s no Halloween tab');
  await q.evaluate(() => { const l = JSON.parse(localStorage.getItem('retroRack.locker')); l.cases.trick = 1; localStorage.setItem('retroRack.locker', JSON.stringify(l)); });
  await q.reload(); await q.waitForTimeout(1200); await q.click('[data-go="locker"]'); await q.waitForTimeout(400);
  ok((await tabs(q)).includes('Halloween'), 'holding a Trick case, the tab is back');
  await toTab(q, 'Halloween');
  ok(/Season over/.test(await q.textContent('#lockBody')), 'it says the season is over');
  await q.click('#lockBody button[data-grade="treat"]:has-text("Buy")'); await q.waitForTimeout(200);
  ok(!((await lock(q)).cases.treat > 0) && /on sale in the Halloween season: 1 October to 10 November/.test(await q.textContent('#lockNote')), 'a Treat case can\'t be bought out of the season, and it says when');
  await q.click('#lockBody button[data-grade="trick"]:has-text("Open")');
  ok(await until(q, () => q.evaluate(() => !document.querySelector('#reel').hidden)), 'but the Trick case held still opens');
  await q.click('#reelWin'); await q.waitForTimeout(300); await q.keyboard.press('Escape'); await q.waitForTimeout(200);
  ok((await lock(q)).cases.trick === 0, 'and is used up');
  await q.evaluate(() => { const r = __rr; r.M.mode = '8ball'; r.M.opp = 'bot'; r.M.diff = 'easy'; r.M.race = 0; r.startGame(false); }); await q.waitForTimeout(800);
  await until(q, () => q.evaluate(() => __rr.state !== 'over' && __rr.concedeFrame(false, 1))); await until(q, () => q.isVisible('#over'), 5000);
  ok(!/Halloween/.test(await q.textContent('#overEarn')) && (await lock(q)).cases.trick === 0, 'no Trick case for a win out of the season');

  console.log('--- all thirty: the rewards and the Haunted Hall');
  const all = await p.evaluate(() => __rr.LK.seriesItems('halloween'));
  const h = await page('2026-12-01', { ...L0, money: 0, owned: all });
  await h.waitForTimeout(800);
  L = await lock(h);
  ok(['common', 'rare', 'epic', 'legendary', 'mythic', 'all'].every(r => L.claimed.includes('halloween:' + r)) && L.money === 150 + 300 + 600 + 1200 + 2500 + 5000, `a locker with all thirty is paid every Halloween reward, once (£${L.money})`);
  let fx = await h.evaluate(() => __rr.effects);
  ok(fx.on.includes('haunted') && fx.hall && fx.sign === 'Haunted Hall', `the Haunted Hall is up at home, its sign reading "${fx.sign}"`);
  await h.evaluate(() => { const r = __rr; r.M.mode = 'practice'; r.M.opp = 'friend'; r.startGame(); }); await h.waitForTimeout(1500);
  ok((await h.evaluate(() => __rr.effects)).hall, 'and around the table in a game at home');
  await h.evaluate(() => __rr.cam.orbit(300, 0)); await h.waitForTimeout(1200);   // a moment for the candles, bats, cloud and fog to move
  await h.keyboard.press('Escape'); await h.waitForTimeout(300); await h.click('#bQuit'); await h.waitForTimeout(500);
  await h.click('[data-go="locker"]'); await h.waitForTimeout(300); await toTab(h, 'Inventory');
  const sw = h.locator('.fxRow[data-fx="haunted"] .btn');
  ok(await sw.count() === 1, 'the Inventory lists the Haunted Hall with its switch');
  await sw.click(); await h.waitForTimeout(300); fx = await h.evaluate(() => __rr.effects);
  ok(!fx.hall && fx.sign !== 'Haunted Hall', `switched off, the room is back as it was (sign "${fx.sign}")`);
  await h.locator('.fxRow[data-fx="haunted"] .btn').click(); await h.waitForTimeout(300);
  ok((await h.evaluate(() => __rr.effects)).hall, 'and on again');
  await h.reload(); await h.waitForTimeout(1200);
  ok((await lock(h)).money === L.money, 'the rewards aren\'t paid twice after a reload');

  console.log('--- Halloween looks at the table');
  await h.evaluate(() => { const r = __rr; r.S.cloth = 'c-h-moon'; r.S.cue = 'q-h-hellfire'; r.S.glove = 'g-h-banshee'; r.applyLook(); r.M.mode = 'practice'; r.startGame(); }); await h.waitForTimeout(1500);
  const f1 = await h.evaluate(() => ({ ...__rr.fx, look: __rr.look })); await h.waitForTimeout(900); const f2 = await h.evaluate(() => __rr.fx);
  ok(f1.look.clothTex && f1.look.cue === 'q-h-hellfire' && f1.look.glove === 'g-h-banshee', 'the Blood moon cloth, the Hellfire cue and the Banshee gloves are at the table');
  ok(f1.glow !== f2.glow && f1.glove !== f2.glove, `the mythics move: the moon's glow and the Banshee's light change (${f1.glow} → ${f2.glow}, ${f1.glove} → ${f2.glove})`);

  ok(log.length === 0, 'console clean' + (log.length ? ': ' + log.join(' | ') : ''));
  await b.close();
})();
