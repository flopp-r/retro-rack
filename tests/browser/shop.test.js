// Career Stage 2 on one device: the tier tabs, the shop (cloths and cues, now in the Locker), bought looks in Settings
// and in every game, the venues (the room changes with the tier), and the event screen's list of players.
const { chromium, FILE } = require('./lib');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(250); } return false; };
const PUB_DONE = { redlion: { played: 1, won: 1, best: 3 }, crown: { played: 1, won: 1, best: 3 }, pubchamp: { played: 1, won: 1, best: 3 } };

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 762, height: 341 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(done => { if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
    localStorage.setItem('retroRack.rotateHint', 'off');
    localStorage.setItem('retroRack.locker', JSON.stringify({ v: 1, money: 600 }));
    localStorage.setItem('retroRack.career', JSON.stringify({ v: 1, name: 'Tess', look: { s: 'cap' }, guide: 'line', created: 1, trophies: [{ event: 'pubchamp' }], done, history: [] })); }, PUB_DONE);
  const logs = [];
  const open = async () => {
    const p = await ctx.newPage();
    p.on('console', m => { if (!/GPU stall/.test(m.text())) logs.push(`[${m.type()}] ${m.text()}`); });
    p.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
    p.on('dialog', d => d.accept());
    await p.goto(FILE); await sleep(1200); return p;
  };
  let p = await open();
  const fits = async name => { const o = await p.evaluate(() => { const s = document.querySelector('#mStage'); return s.scrollHeight - s.clientHeight; }); ok(o <= 1, `${name} fits a phone on its side without scrolling (${o})`); };
  const look = () => p.evaluate(() => __rr.look);
  const saved = () => p.evaluate(() => JSON.parse(localStorage.getItem('retroRack.career')));
  const settings = () => p.evaluate(() => JSON.parse(localStorage.getItem('retroRack.settings') || '{}'));
  const lock = () => p.evaluate(() => JSON.parse(localStorage.getItem('retroRack.locker')));
  const item = id => `.shopItem[data-id="${id}"]`;

  console.log('--- the hub, one tier at a time');
  await p.click('[data-go="single"]'); await p.click('[data-go="career"]'); await sleep(400);
  const tabs = await p.$$eval('#cTiers .btn', bs => bs.map(x => ({ t: x.textContent, on: x.getAttribute('aria-pressed') === 'true', locked: x.classList.contains('locked') })));
  ok(tabs.map(t => t.t).join() === 'Pub,Club,Hall,National' && tabs[1].on && !tabs[1].locked && tabs[2].locked && tabs[3].locked, `tabs Pub, Club, Hall, National; the club tier shows, as the furthest one open (${JSON.stringify(tabs)})`);
  ok((await p.$$eval('.cEvtState', es => es.map(e => e.textContent))).join() === 'Open,Locked,Locked', 'club: the first event open');
  ok((await p.textContent('.cMeStats')) === '£600 to spend · 1 trophy', `money and trophies: "${await p.textContent('.cMeStats')}"`);
  await fits('Hub, club tier');
  await p.click('#cTiers .btn:nth-child(3)'); await sleep(200);
  ok(/Win The Club Championship to open The hall circuit/.test(await p.textContent('#cEvents')), 'a locked tier says what opens it');
  await p.click('#cTiers .btn:nth-child(1)'); await sleep(200);
  ok((await p.$$eval('.cEvtState', es => es.map(e => e.textContent))).join() === 'Won,Won,Won', 'the pub tab: all three won');
  await p.click('#cTiers .btn:nth-child(2)'); await sleep(200);

  console.log('--- an event before entering: the players, two columns');
  await p.click('.cEvt:nth-child(1)'); await sleep(500);
  const field = await p.evaluate(() => { const br = document.querySelector('#cBracket'), cs = getComputedStyle(br), n = br.querySelector('.bName:nth-child(2) span'); return { disp: cs.display, cols: cs.gridTemplateColumns.split(' ').length, name: n.textContent, w: n.getBoundingClientRect().width, full: n.scrollWidth <= n.clientWidth + 1 }; });
  ok(field.disp === 'grid' && field.cols === 2 && field.full, `players listed in a two-column grid, names in full (${JSON.stringify(field)})`);
  ok(/8-ball on the 9 ft table/.test(await p.textContent('#cInfo')), 'the club plays 8-ball on the 9 ft table');
  let lk = await look();
  ok(lk.venue === 'club' && lk.sign === 'OAKFIELD', `behind the menu: the club room, sign "${lk.sign}"`);
  ok(await p.evaluate(() => __rr.world.balls.length === 16 && Math.abs(__rr.world.balls[1].x) > 0), 'and an 8-ball rack on the table');
  await fits('Club event');

  console.log('--- the shop, in the Locker');
  await p.click('#mBack'); await sleep(300);
  lk = await look(); ok(lk.venue === 'home', 'back on the hub: the usual room');
  ok(await p.textContent('#cShop') === 'Locker', 'the hub has a Locker button');
  await p.click('#cShop'); await sleep(400); await p.click('#lockTabs .btn:nth-child(2)'); await sleep(300);
  ok(/£600 to spend/.test(await p.textContent('#lockMoney')), 'the locker shows what you can spend'); await fits('Locker, cloths');
  const prices = await p.$$eval('.shopItem', es => es.filter(e => /^£/.test(e.querySelector('.shopState').textContent)).map(e => e.querySelector('.shopName').textContent));
  ok(prices.join() === 'Charcoal,Navy,Olive,Tan,Ice blue', `cloths for sale: ${prices}`);
  await p.click(item('ice')); await sleep(300);
  ok(/You need £300 more for Ice blue/.test(await p.textContent('#lockNote')), 'too dear: says how much more is needed');
  await p.click(item('navy')); await sleep(300);
  let L = await lock(), st = await settings();
  ok(L.money === 350 && L.owned.includes('navy') && st.cloth === 'navy', `Navy bought for £250 and put on the table (money £${L.money})`);
  ok((await p.$eval(item('navy') + ' .shopState', e => e.textContent)) === 'In use', 'the locker marks it In use');
  await p.click('#lockTabs .btn:nth-child(3)'); await sleep(300); await fits('Locker, cues');
  ok((await p.$$eval('.shopItem .shopName', es => es.map(e => e.textContent))).slice(0, 7).join() === 'House cue,Ash,Ebony,Racing red,Arcade,Gold rush,Champion', 'cues: the house cue and six to buy come first');
  await p.click(item('ash')); await sleep(300);
  st = await settings(); ok(st.cue === 'ash' && (await lock()).money === 200, 'Ash bought for £150 and in use');
  await p.click(item('house')); await sleep(200);
  ok((await settings()).cue === 'house' && (await lock()).money === 200, 'switching back to an owned cue costs nothing');
  await p.click(item('ash')); await sleep(200);

  console.log('--- bought looks in Settings, and in an ordinary game');
  await p.click('#bMenuSettings'); await sleep(300);
  const names = [];
  for (let i = 0; i < 7; i++) { names.push(await p.textContent('#sCloth .pickCur')); if (i < 6) { await p.click('#sCloth .btn:last-child'); await sleep(100); } }
  ok(names.join() === 'Navy,Teal,Club green,Tournament blue,Wine,Violet,Navy', `Settings steps through the five free cloths and Navy (${names})`);
  ok(await p.isVisible('#rowCue') && await p.textContent('#sCue .pickCur') === 'Ash', 'Settings has a Cue row, showing Ash');
  await p.click('#sCue .btn:last-child'); await sleep(100); ok(await p.textContent('#sCue .pickCur') === 'House cue', 'the next cue is the house cue'); await p.click('#sCue .btn:last-child'); await sleep(100);
  await p.click('#bResume'); await sleep(200);
  await p.evaluate(() => { const r = __rr; r.M.mode = '8ball'; r.M.opp = 'friend'; r.startGame(false); }); await sleep(1000);
  lk = await look(); ok(lk.cloth === 'navy' && lk.cue === 'ash' && lk.venue === 'home', `a same-device game uses Navy and Ash (${JSON.stringify(lk)})`);
  await p.click('#bPause'); await p.click('#bQuit'); await sleep(500);

  console.log('--- a career match in the club');
  await p.click('[data-go="single"]'); await p.click('[data-go="career"]'); await sleep(300);
  await p.click('.cEvt:nth-child(1)'); await sleep(300); await p.click('#bCareer'); await sleep(300); await p.click('#bCareer'); await sleep(1500);
  lk = await look();
  ok(await p.evaluate(() => __rr.M.mode === '8ball' && __rr.CAR.on) && lk.venue === 'club' && lk.sign === 'OAKFIELD', 'the match is 8-ball, in the club room');
  ok(await until(async () => (await p.evaluate(() => __rr.state)) === 'aim' ? (await look()).cue === 'ash' : (await p.evaluate(() => __rr.state)) === 'botThink' && (await look()).cue === (await p.evaluate(() => __rr.CAR.data.run.match.opp === 'frank' ? 'racing' : 'house'))), 'the cue at the table is yours on your turn, your opponent\'s on theirs');
  await p.click('#bPause'); await p.click('#bQuit'); await sleep(500);
  ok((await look()).venue === 'club' && await p.isVisible('#sc-cevent'), 'Save and quit: back at the event, still in the club room');

  console.log('--- retiring keeps the looks');
  await p.click('#mBack'); await sleep(300); await p.click('#cRetire'); await sleep(500);
  st = await settings(); L = await lock(); ok(!(await saved()) && L.owned.join() === 'navy,ash' && L.money === 200 && st.cloth === 'navy', 'the career is gone; Navy, Ash and the money stay');

  ok(!logs.length, 'console clean' + (logs.length ? ':\n  ' + logs.join('\n  ') : ''));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
