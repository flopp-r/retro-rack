// The locker: old saves moving in, opening a case (the reel stops on the prize, honestly), buying cases, duplicates
// sold, two open pages kept in step, earning from frames against the computer (and nothing from same-device games),
// and the looks from cases in use: a patterned cloth and a glove.
const { chromium, FILE } = require('./lib');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(200); } return false; };

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  // motion on, so the reel really spins
  const ctx = await b.newContext({ viewport: { width: 762, height: 341 } });
  await ctx.addInitScript(() => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.setItem('retroRack.rotateHint', 'off');
    // from before the locker: a bought cloth in the settings, and a career with unspent money and a bought cue
    localStorage.setItem('retroRack.settings', JSON.stringify({ owned: ['navy'], cloth: 'navy', cue: 'ash' }));
    localStorage.setItem('retroRack.career', JSON.stringify({ v: 1, name: 'Tess', look: { s: 'cap' }, guide: 'line', created: 1, money: 300, earned: 500, bought: ['ash'], trophies: [], done: {}, history: [] })); });
  const logs = [];
  const open = async () => {
    const p = await ctx.newPage();
    p.on('console', m => { if (!/GPU stall/.test(m.text())) logs.push(`[${m.type()}] ${m.text()}`); });
    p.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
    p.on('dialog', d => d.accept());
    await p.goto(FILE); await sleep(1200); return p;
  };
  const p = await open();
  const lock = (q = p) => q.evaluate(() => JSON.parse(localStorage.getItem('retroRack.locker')));
  const setLock = (q, ch) => q.evaluate(c => { const l = JSON.parse(localStorage.getItem('retroRack.locker')); Object.assign(l, c); localStorage.setItem('retroRack.locker', JSON.stringify(l)); }, ch);
  const fits = async name => { const o = await p.evaluate(() => { const s = document.querySelector('#mStage'); return s.scrollHeight - s.clientHeight; }); ok(o <= 1, `${name} fits a phone on its side without scrolling (${o})`); };

  console.log('--- moving in');
  let L = await lock(), st = await p.evaluate(() => JSON.parse(localStorage.getItem('retroRack.settings'))), car = await p.evaluate(() => JSON.parse(localStorage.getItem('retroRack.career')));
  ok(L && L.money === 340 && L.owned.join() === 'navy,ash' && L.cases.silver === 1, `the new locker: £40 to start, the career's £300, Navy and Ash, and a silver case (${JSON.stringify(L)})`);
  ok(!('owned' in st) && st.cloth === 'navy' && st.cue === 'ash' && !('money' in car) && !('bought' in car) && car.earned === 500, 'the settings and the career no longer hold them; looks in use stay in use');
  ok(await p.textContent('#lockerTxt') === '1 case to open', 'the home screen\'s Locker card says a case is waiting');

  console.log('--- opening a case');
  await p.click('[data-go="locker"]'); await sleep(500);
  ok(await p.isVisible('#sc-locker') && /£340 to spend · 1 case to open/.test(await p.textContent('#lockMoney')), 'the locker opens on the cases'); await fits('Locker, cases');
  ok((await p.$$('.caseCard')).length === 4 && /72% common, 24% rare, 4% epic/.test(await p.textContent('.caseCard:nth-child(1)')), 'four grades, each with its odds shown');
  await p.click('.caseCard:nth-child(1) .btn:nth-child(1)'); await sleep(200);
  ok(/No bronze cases yet/.test(await p.textContent('#lockNote')), 'no bronze case: it says how to get one');
  await p.click('.caseCard:nth-child(2) .btn:nth-child(1)'); await sleep(600);
  const r1 = await p.evaluate(() => ({ ...__rr.reel.res }));
  L = await lock();
  ok(await p.isVisible('#reel') && L.money === 300 && L.cases.silver === 0 && L.owned.includes(r1.id), `the reel spins; £40 paid and the prize is already yours (${r1.id})`);
  await sleep(600);
  const moving = await p.evaluate(() => getComputedStyle(document.querySelector('#reelStrip')).transform);
  ok(moving !== 'none' && await p.isHidden('#reelBtns'), 'still spinning, no buttons yet');
  await p.click('#reelWin'); await sleep(300);
  const land = await p.evaluate(() => { const at = __rr.reel.at, t = document.querySelectorAll('.reelTile')[at].getBoundingClientRect(), w = document.querySelector('#reelWin').getBoundingClientRect(), mid = w.left + w.width / 2;
    return { inside: mid > t.left && mid < t.right, won: document.querySelectorAll('.reelTile')[at].classList.contains('won'), n: document.querySelectorAll('.reelTile').length }; });
  ok(land.inside && land.won, `tapping skips to the end: the marker stops inside the prize's tile (${JSON.stringify(land)})`);
  const txt = await p.textContent('#reelTxt'), name = await p.evaluate(id => __rr.LK.ALL[id].name, r1.id);
  ok(txt.includes(name) && /New!/.test(txt), `the prize is named: "${txt}"`);
  const kind = await p.evaluate(id => __rr.LK.ALL[id].kind, r1.id);
  await p.click('#bReelUse'); await sleep(300);
  ok(await p.isHidden('#reel') && (await p.evaluate(k => __rr.S[k], kind)) === r1.id, 'Use it: the reel closes and the prize is in use');

  console.log('--- two pages open: changes in one show in the other');
  const p2 = await open();
  await setLock(p2, { money: 10, cases: { bronze: 1, silver: 0, gold: 0, diamond: 0 } }); await sleep(400);
  ok(/£10 to spend · 1 case to open/.test(await p.textContent('#lockMoney')), 'the first page shows the change made in the second');
  await p.click('.caseCard:nth-child(1) .btn:nth-child(1)'); await sleep(200);
  ok(/costs £15: you need £5 more/.test(await p.textContent('#lockNote')) && (await lock()).cases.bronze === 1, 'too little money to open it: nothing taken, and it says how much more');
  await p2.close();

  console.log('--- buying a case, and a duplicate');
  await setLock(p, { money: 200 }); await p.reload(); await sleep(1200); await p.click('[data-go="locker"]'); await sleep(400);
  await p.click('.caseCard:nth-child(1) .btn:nth-child(2)'); await sleep(300);
  L = await lock(); ok(L.money === 155 && L.cases.bronze === 2, `bought a bronze case for £45 (money £${L.money}, ${L.cases.bronze} bronze)`);
  const all = await p.evaluate(() => __rr.LK.CASE_ITEMS.map(it => it.id));
  await setLock(p, { owned: all, money: 100 }); await p.reload(); await sleep(1200); await p.click('[data-go="locker"]'); await sleep(400);
  await p.click('.caseCard:nth-child(1) .btn:nth-child(1)'); await sleep(300); await p.click('#reelWin'); await sleep(300);
  const r2 = await p.evaluate(() => ({ ...__rr.reel.res })); L = await lock();
  ok(r2.dup && r2.sold > 0 && L.money === 100 - 15 + r2.sold && /sold for £\d+/.test(await p.textContent('#reelTxt')) && await p.isHidden('#bReelUse'), `a duplicate is sold at once (${r2.id} for £${r2.sold})`);
  await p.click('#bReelDone'); await sleep(200);

  console.log('--- the looks, in Settings and at the table');
  for (const t of [2, 3, 4]) { await p.click(`#lockTabs .btn:nth-child(${t})`); await sleep(250); await fits(['', '', 'Locker, cloths', 'Locker, cues', 'Locker, gloves'][t]); }
  ok(/26 of 26 owned/.test(await p.textContent('#lockPages')) && (await p.$$('#lockPages .btn')).length === 2, 'gloves: all owned, in pages');
  await p.click('.shopItem[data-id="g-white"]'); await sleep(200);
  await p.click('#lockTabs .btn:nth-child(2)'); await sleep(200); await p.click('#lockPages .btn:last-child'); await sleep(200); await p.click('.shopItem[data-id="c-galaxy"]'); await sleep(300);
  let lk = await p.evaluate(() => __rr.look);
  ok(lk.cloth === 'c-galaxy' && lk.clothTex, 'a patterned cloth goes on the table as a picture');
  await p.click('#bMenuSettings'); await sleep(300);
  ok(await p.textContent('#sGlove .pickCur') === 'Classic white' && await p.textContent('#sCloth .pickCur') === 'Galaxy', 'Settings shows the glove and the cloth in use');
  await p.click('#sCloth .btn:last-child'); await sleep(200); ok(await p.textContent('#sCloth .pickCur') === 'Synthwave' && (await p.evaluate(() => __rr.look.clothTex)), 'the next cloth along');
  await p.click('#bResume'); await sleep(200);
  await p.evaluate(() => { const r = __rr; r.M.mode = '8ball'; r.M.opp = 'bot'; r.M.diff = 'hard'; r.M.race = 0; r.startGame(false); }); await sleep(1500);
  ok(await until(async () => (await p.evaluate(() => __rr.look.glove)) === 'g-white'), 'in a game, the glove in use is at the table');

  console.log('--- earning against the computer');
  await setLock(p, { money: 0, meter: { bronze: 0, silver: 0, gold: 0, diamond: 0 }, cases: { bronze: 0, silver: 0, gold: 0, diamond: 0 } });
  const win = async () => { await until(() => p.evaluate(() => __rr.state !== 'over' && __rr.concedeFrame(false, 1))); await until(() => p.isVisible('#over'), 5000); return p.textContent('#overEarn'); };
  let e = await win();
  ok(e === 'You earn £30. Gold case: 1 of 3 frames.', `a frame won against Hard: "${e}"`);
  await p.click('#bAgain'); await sleep(1200); await win(); await p.click('#bAgain'); await sleep(1200); e = await win();
  L = await lock(); ok(e === 'You earn £30 and a gold case!' && L.cases.gold === 1 && L.money === 90 && L.meter.gold === 0, `the third: "${e}"`);
  await p.click('#bAgain'); await sleep(1200);
  await until(() => p.evaluate(() => __rr.state !== 'over' && __rr.concedeFrame(false, 0))); await until(() => p.isVisible('#over'), 5000);
  ok(await p.textContent('#overEarn') === '' && (await lock()).money === 90, 'a frame lost earns nothing');
  await p.click('#bOverMenu'); await sleep(500);
  await p.evaluate(() => { const r = __rr; r.M.mode = '8ball'; r.M.opp = 'friend'; r.startGame(false); }); await sleep(1200);
  await until(() => p.evaluate(() => __rr.state !== 'over' && __rr.concedeFrame(false, 1))); await until(() => p.isVisible('#over'), 5000);
  ok(await p.textContent('#overEarn') === '' && (await lock()).money === 90, 'same-device games earn nothing');
  await p.click('#bOverMenu'); await sleep(500);

  ok(!logs.length, 'console clean' + (logs.length ? ':\n  ' + logs.join('\n  ') : ''));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
