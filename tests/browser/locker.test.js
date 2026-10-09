// The locker: old saves moving in, opening a case (the reel stops on the prize, honestly), buying cases, duplicates
// sold, two open pages kept in step, earning from frames against the computer (and nothing from same-device games),
// the show behind the reel (dimmed room, big reel with tiles in their rarity's colour, a background matched to the prize,
// a still one with reduced motion), Preview (your looks at the table, trying on looks you don't own),
// the looks from cases in use (a patterned cloth, a glove, mythics that move), and dev mode's test locker.
const { chromium, SITE } = require('./lib');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(200); } return false; };

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  // motion on, so the reel really spins
  const ctx = await b.newContext({ viewport: { width: 762, height: 341 } });
  await ctx.addInitScript(() => { if (localStorage.getItem('test.seeded')) return; localStorage.setItem('test.seeded', '1');   // once for the device, not per tab
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
    await p.goto(SITE.new); await sleep(1200); return p;   // over http, like the real site: pages opened from disk don't reliably share storage
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
  ok((await p.$$('.caseCard')).length === 4 && /72% common, 24% rare, 3.8% epic, 0.2% mythic/.test(await p.textContent('.caseCard:nth-child(1)')), 'four grades, each with its odds shown');
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
  await setLock(p2, { money: 10, cases: { bronze: 1, silver: 0, gold: 0, diamond: 0 } });   // reaches the other page a moment later
  ok(await until(async () => /£10 to spend · 1 case to open/.test(await p.textContent('#lockMoney')), 5000), 'the first page shows the change made in the second');
  await p.click('.caseCard:nth-child(1) .btn:nth-child(1)'); await sleep(200);
  ok(/costs £15: you need £5 more/.test(await p.textContent('#lockNote')) && (await lock()).cases.bronze === 1, 'too little money to open it: nothing taken, and it says how much more');
  await p2.close();

  console.log('--- Preview: your looks at the table, and trying on ones you don\'t own');
  const page = async id => { for (let i = 0; i < 3 && !(await p.$(`.shopItem[data-id="${id}"]`)); i++) { await p.click('#lockPages .btn:last-child'); await sleep(150); } };
  const mine = () => p.evaluate(() => ({ S: [__rr.S.cloth, __rr.S.cue, __rr.S.glove].join(), L: localStorage.getItem('retroRack.locker') }));
  const was = await mine();
  await p.click('#lockTabs .btn:nth-child(3)'); await sleep(250); await page('q-plasma'); await p.click('.shopItem[data-id="q-plasma"]'); await sleep(250);
  ok(/Preview tries it on/.test(await p.textContent('#lockNote')) && await p.evaluate(() => document.querySelector('.shopItem[data-id="q-plasma"]').classList.contains('trying')), 'tapping a cue you don\'t own marks it to try on');
  await p.click('#lockTabs .btn:nth-child(4)'); await sleep(250); await page('g-prism'); await p.click('.shopItem[data-id="g-prism"]'); await sleep(250);
  await p.click('#bPreview'); await sleep(1500);
  let pv = await p.evaluate(() => ({ look: __rr.look, menu: document.querySelector('#menu').hidden, bar: !document.querySelector('#preview').hidden, txt: document.querySelector('#prevTxt').textContent }));
  ok(pv.menu && pv.bar && pv.look.cam === 'show' && pv.look.shown && pv.look.cue === 'q-plasma' && pv.look.glove === 'g-prism' && pv.look.cloth === was.S.split(',')[0], `Preview: the menu steps aside, and the camera shows your cloth with Plasma and Prism at the table (${JSON.stringify(pv.look)})`);
  ok(/Trying on Plasma and Prism\. Tap anywhere to go back\./.test(pv.txt), `it names the looks and says which are being tried on ("${pv.txt}")`);
  await p.mouse.click(380, 120); await sleep(600);
  pv = await p.evaluate(() => ({ look: __rr.look, menu: !document.querySelector('#menu').hidden, locker: !document.querySelector('#sc-locker').hidden }));
  ok(pv.menu && pv.locker && pv.look.cam === 'attract' && !pv.look.shown && JSON.stringify(await mine()) === JSON.stringify(was), 'a tap anywhere comes back to the locker, with nothing bought or changed');
  await p.click('#bPreview'); await sleep(600); await p.evaluate(() => history.back()); await sleep(700);
  ok(await p.isVisible('#sc-locker') && await p.isHidden('#preview'), 'a phone\'s back gesture ends it too, staying in the locker');
  await p.click('#bPreview'); await sleep(600); await p.keyboard.press('Escape'); await sleep(500);
  ok(await p.isVisible('#sc-locker') && await p.isHidden('#preview'), 'and so does Esc');

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

  console.log('--- the show: the room dims, the reel fills the screen, and the background matches the prize');
  const force = v => p.evaluate(v => { const o = Math.random, q = [v, 0]; Math.random = () => q.length ? q.shift() : o(); }, v);
  // how much of the background canvas is lit (its pixels are stored unpremultiplied, so weigh them by their alpha)
  const show = () => p.evaluate(() => { const c = document.querySelector('#reelFx'), k = Object.assign(document.createElement('canvas'), { width: c.width, height: c.height }), g = k.getContext('2d', { willReadFrequently: true });
    g.drawImage(c, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0;
    for (let i = 0; i < d.length; i += 4) if ((d[i] + d[i + 1] + d[i + 2]) * d[i + 3] / 255 > 120) n++;
    const t = document.querySelector('#reelTitle'); return { lit: n / (d.length / 4), title: t.textContent, col: getComputedStyle(t).color, shake: document.querySelector('.reelPanel').classList.contains('shake'), r: __rr.reel.res.rarity }; });
  await setLock(p, { money: 100, cases: { bronze: 2, silver: 0, gold: 0, diamond: 0 } }); await p.reload(); await sleep(1200); await p.click('[data-go="locker"]'); await sleep(400);
  await force(0.1); await p.click('.caseCard:nth-child(1) .btn:nth-child(1)'); await sleep(500);
  const room = await p.evaluate(() => { const bg = getComputedStyle(document.querySelector('#reel')).backgroundColor, a = +bg.match(/([\d.]+)\)$/)[1], t = document.querySelector('.reelTile').getBoundingClientRect(), w = document.querySelector('.reelPanel').getBoundingClientRect();
    return { a, tile: t.height / innerHeight, panel: w.height / innerHeight }; });
  ok(room.a >= 0.85 && room.a < 1 && room.tile >= 0.35 && room.panel >= 0.6, `the room behind is dimmed nearly to black but not quite, and the reel takes up most of the screen (${JSON.stringify(room)})`);
  await p.click('#reelWin'); await sleep(600); const common = await show();
  const tiles = await p.evaluate(() => [...document.querySelectorAll('.reelTile')].map(t => [t.dataset.r, getComputedStyle(t).backgroundImage])), by = {};
  for (const [r, bg] of tiles) (by[r] = by[r] || new Set()).add(bg);
  ok(tiles.every(([, bg]) => /linear-gradient/.test(bg)) && Object.keys(by).length >= 2 && Object.values(by).every(v => v.size === 1) && new Set(Object.values(by).map(v => [...v][0])).size === Object.keys(by).length,
    `each tile on the reel is in its rarity's colour, the same for the same rarity (${Object.keys(by).join(', ')})`);
  ok(common.r === 'common' && common.title === 'Bronze case' && !common.shake, `a common: a quiet reveal (${JSON.stringify(common)})`);
  await p.click('#bReelDone'); await sleep(200);
  await force(0.9999); await p.click('.caseCard:nth-child(1) .btn:nth-child(1)'); await sleep(500); await p.click('#reelWin'); await sleep(600); const myth = await show();
  ok(myth.r === 'mythic' && myth.title === 'Mythic!' && myth.col === 'rgb(255, 59, 59)' && myth.shake, `a mythic, very rarely in any case: a red "Mythic!" and a shake (${JSON.stringify(myth)})`);
  ok(myth.lit > 0.04 && myth.lit > common.lit * 3, `and the background lights up far more than for a common (${myth.lit.toFixed(3)} against ${common.lit.toFixed(3)} of the screen)`);
  ok(/sold for £500/.test(await p.textContent('#reelTxt')), 'a duplicate mythic sells for £500');
  await p.click('#bReelDone'); await sleep(200);
  ok(await p.isHidden('#reel') && !(await p.evaluate(() => __rr.fx.show)), 'Done: the reel closes and the show stops');

  console.log('--- the looks, in Settings and at the table');
  for (const t of [2, 3, 4]) { await p.click(`#lockTabs .btn:nth-child(${t})`); await sleep(250); await fits(['', '', 'Locker, cloths', 'Locker, cues', 'Locker, gloves'][t]); }
  ok(/28 of 28 owned/.test(await p.textContent('#lockPages')) && (await p.$$('#lockPages .btn:not(#bPreview)')).length === 2, 'gloves: all owned, in pages');
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
  await p.evaluate(() => { const S = __rr.S; S.cloth = 'c-aurora'; S.glove = 'g-prism'; __rr.applyLook(); }); await until(async () => (await p.evaluate(() => __rr.look.glove)) === 'g-prism');
  let f1 = await p.evaluate(() => __rr.fx); await sleep(1000); let f2 = await p.evaluate(() => __rr.fx);
  ok(f2.cloth > f1.cloth && f1.glove !== f2.glove, `mythic looks move: the Aurora cloth drifts and the Prism glove changes colour (${JSON.stringify([f1, f2])})`);
  await p.evaluate(() => { const S = __rr.S; S.cloth = 'c-magma'; S.glove = 'g-white'; __rr.applyLook(); }); await sleep(300);
  f1 = await p.evaluate(() => __rr.fx); await sleep(700); f2 = await p.evaluate(() => __rr.fx);
  ok(f1.glow !== '000000' && f1.glow !== f2.glow, `and the Magma cloth's cracks glow brighter and dimmer (${f1.glow}, ${f2.glow})`);

  console.log('--- a glove reacts: a shrug for a foul');
  await p.evaluate(() => { const r = __rr, c = r.world.balls[0]; r.game.breakShot = false; r.game.ballInHand = false; c.x = -0.6; c.z = 0.3; r.aim.phi = Math.PI; r.aim.power = 0.12; r.aim.sx = r.aim.sy = 0; });
  await until(() => p.evaluate(() => __rr.state === 'aim')); await p.evaluate(() => __rr.beginStroke());
  ok(await until(() => p.evaluate(() => __rr.cheering === 'shrug'), 20000), 'hitting no ball is a foul, and the glove shrugs');
  await until(() => p.evaluate(() => __rr.state === 'botThink' || __rr.state === 'aim'));

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

  console.log('--- dev mode: a test locker with everything (tested with a stand-in word; the real one stays secret)');
  await p.goto(SITE.new + '?relay=ws://127.0.0.1:8787'); await sleep(1200);
  const real = JSON.stringify(await lock());
  await p.evaluate(async () => { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('retroRack:testword')); __rr.DEVW.print = [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); });
  await p.evaluate(() => localStorage.setItem('retroRack.name', 'Tess'));
  await p.click('[data-go="multi"]'); await p.click('[data-go="online"]'); await sleep(300);
  await p.fill('#netName', 'notit'); await sleep(300);
  ok(!(await p.evaluate(() => __rr.dev)), 'a wrong word does nothing');
  await p.fill('#netName', 'TestWord'); await sleep(500);
  ok(await p.evaluate(() => __rr.dev) && await p.inputValue('#netName') === 'Tess', 'the word (any capitals) switches dev mode on, and the name box goes back to your name');
  let D = await p.evaluate(() => __rr.lock);
  ok(D.money === 100000 && D.cases.diamond === 50 && JSON.stringify(await lock()) === real, 'a test locker: £100,000 and 50 of each case; the real locker is untouched');
  ok(await p.evaluate(() => Object.keys(__rr.LK.ALL).every(id => __rr.LK.owns(__rr.lock, id))), 'every look is owned in the test locker');
  for (let i = 0; i < 6; i++) if (await p.isVisible('#mBack')) await p.click('#mBack');
  await sleep(300); ok(/Version [0-9a-f]{8} · DEV/.test(await p.textContent('#ver')), `the version line says DEV ("${await p.textContent('#ver')}")`);
  await p.click('[data-go="locker"]'); await sleep(400);
  ok(/^Test locker: £100,000 to spend/.test(await p.textContent('#lockMoney')), 'the locker says it is the test locker');
  await p.click('.caseCard:nth-child(4) .btn:nth-child(1)'); await sleep(300); await p.click('#reelWin'); await sleep(300); await p.click('#bReelDone');
  ok((await p.evaluate(() => __rr.lock)).cases.diamond === 49 && JSON.stringify(await lock()) === real, 'opening a case uses the test locker only');
  await p.click('#lockTabs .btn:nth-child(3)'); await sleep(200); await p.click('.shopItem[data-id="champion"]'); await sleep(200);
  ok(await p.evaluate(() => __rr.S.cue) === 'champion', 'the dearest shop cue can be used without buying it');
  await p.reload(); await sleep(1200);
  ok(await p.evaluate(() => __rr.dev && __rr.lock.cases.diamond === 49 && __rr.S.cue === 'champion'), 'dev mode stays on after a reload, test locker and all');
  await p.click('#bMenuSettings'); await sleep(300);
  ok(await p.isVisible('#rowDev'), 'Settings shows a Dev mode row');
  await p.click('#sDev'); await sleep(300);
  ok(!(await p.evaluate(() => __rr.dev)) && JSON.stringify(await lock()) === real && (await p.evaluate(() => __rr.lock.money)) === JSON.parse(real).money && await p.isHidden('#rowDev'), 'Switch off: your own locker is back');
  ok(await p.evaluate(() => __rr.S.cue) === 'house', 'and the cue you don\'t own goes back to the house cue');
  await p.click('#bResume'); await sleep(200);
  ok(!/DEV/.test(await p.textContent('#ver')), 'and the version line is back to normal');

  console.log('--- with reduced motion: no spin, and the show is one still picture');
  const rc = await b.newContext({ viewport: { width: 762, height: 341 }, reducedMotion: 'reduce' });
  await rc.addInitScript(() => { if (localStorage.getItem('test.seeded')) return; localStorage.setItem('test.seeded', '1'); localStorage.setItem('retroRack.rotateHint', 'off');
    localStorage.setItem('retroRack.locker', JSON.stringify({ v: 1, money: 100, owned: [], cases: { gold: 1 }, meter: {}, pity: 0, daily: '', opened: 0 })); });
  const q = await rc.newPage();
  q.on('console', m => { if (!/GPU stall/.test(m.text())) logs.push(`[${m.type()}] ${m.text()}`); }); q.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
  await q.goto(SITE.new); await sleep(1200); await q.click('[data-go="locker"]'); await sleep(400);
  await q.evaluate(() => { const o = Math.random, z = [0.995, 0]; Math.random = () => z.length ? z.shift() : o(); });
  await q.click('.caseCard:nth-child(3) .btn:nth-child(1)'); await sleep(400);
  const still = async () => q.evaluate(() => { const c = document.querySelector('#reelFx'); return c.toDataURL(); });
  const s1 = await still(); await sleep(800); const s2 = await still();
  ok(await q.isVisible('#reelBtns') && await q.textContent('#reelTitle') === 'Mythic!' && !(await q.evaluate(() => document.querySelector('.reelPanel').classList.contains('shake'))), 'the prize shows at once, without the shake');
  ok(s1 === s2 && !(await q.evaluate(() => __rr.fx.show)) && s1.length > 2000, 'the background is drawn once and stays still');
  await rc.close();

  ok(!logs.length, 'console clean' + (logs.length ? ':\n  ' + logs.join('\n  ') : ''));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
