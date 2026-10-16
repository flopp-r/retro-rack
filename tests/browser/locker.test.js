// The locker: old saves moving in, opening a case (the reel stops on the prize, honestly), buying cases, duplicates
// sold, two open pages kept in step, earning from frames against the computer (and nothing from same-device games),
// the show behind the reel (dimmed room, big reel with tiles in their rarity's colour, a background matched to the prize,
// a still one with reduced motion), Preview (your looks at the table, trying on looks you don't own), the inventory
// (one long list, rarest first), the shop's collections and their rewards and effects,
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
  ok(await p.isVisible('#reel') && L.money === 320 && L.cases.silver === 0 && L.owned.includes(r1.id), `the reel spins; £20 paid and the prize is already yours (${r1.id})`);
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
  await setLock(p2, { money: 5, cases: { bronze: 1, silver: 0, gold: 0, diamond: 0 } });   // reaches the other page a moment later
  ok(await until(async () => /£5 to spend · 1 case to open/.test(await p.textContent('#lockMoney')), 5000), 'the first page shows the change made in the second');
  await p.click('.caseCard:nth-child(1) .btn:nth-child(1)'); await sleep(200);
  ok(/costs £8: you need £3 more/.test(await p.textContent('#lockNote')) && (await lock()).cases.bronze === 1, 'too little money to open it: nothing taken, and it says how much more');
  await p2.close();

  console.log('--- Preview: your looks at the table, and trying on ones you don\'t own');
  const mine = () => p.evaluate(() => ({ S: [__rr.S.cloth, __rr.S.cue, __rr.S.glove].join(), L: localStorage.getItem('retroRack.locker') }));
  const was = await mine();
  await p.click('#lockTabs .btn:nth-child(3)'); await sleep(250); await p.click('.colTile[data-id="q-plasma"]'); await sleep(250);   // the shop
  ok(/Preview tries it on/.test(await p.textContent('#lockNote')) && await p.evaluate(() => document.querySelector('.colTile[data-id="q-plasma"]').classList.contains('trying')), 'in the shop, tapping a cue you don\'t own marks it to try on');
  await p.click('.colTile[data-id="g-prism"]'); await sleep(250);
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
  const ALLC = await p.evaluate(() => [...Object.keys(__rr.LK.COLLECTIONS), ...__rr.LK.RARITIES, 'all']);   // every reward counted as paid
  await setLock(p, { owned: all, claimed: ALLC, money: 100 }); await p.reload(); await sleep(1200); await p.click('[data-go="locker"]'); await sleep(400);
  await p.click('.caseCard:nth-child(1) .btn:nth-child(1)'); await sleep(300); await p.click('#reelWin'); await sleep(300);
  const r2 = await p.evaluate(() => ({ ...__rr.reel.res })); L = await lock();
  ok(r2.dup && r2.sold > 0 && L.money === 100 - 8 + r2.sold && /sold for £\d+/.test(await p.textContent('#reelTxt')) && await p.isHidden('#bReelUse'), `a duplicate is sold at once (${r2.id} for £${r2.sold})`);
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

  console.log('--- collections: a row per rarity in the shop, and a reward for each one completed');
  const pools = await p.evaluate(() => __rr.LK.POOL), allBut = all.filter(id => id !== pools.common[0]), k0 = await p.evaluate(id => __rr.LK.ALL[id].kind, pools.common[0]), c0 = 'common:' + k0;
  await setLock(p, { owned: allBut, claimed: ALLC.filter(c => c !== c0 && c !== 'common' && c !== 'all'), money: 100, cases: { bronze: 1, silver: 0, gold: 0, diamond: 0 } }); await p.reload(); await sleep(1200);
  await p.click('[data-go="locker"]'); await sleep(400); await p.click('#lockTabs .btn:nth-child(3)'); await sleep(300); await fits('Locker, shop');
  const rows = await p.$$eval('.colHead', hs => hs.map(h => `${h.dataset.r || 'sale'} ${h.querySelector('.colN') ? h.querySelector('.colN').textContent : ''}`.trim()));
  ok(rows.join() === 'sale,mythic 3/3 ✓,legendary 3/3 ✓,epic 3/3 ✓,rare 3/3 ✓,common 2/3,all 14/15', `the shop: what's for sale, then each rarity's set, rarest first, with how many of its three collections you have (${rows})`);
  const subs = await p.$$eval('.colSub', ss => ss.map(x => `${x.dataset.c} ${x.querySelector('.colN').textContent}`)), n0 = (await p.evaluate(c => __rr.LK.colItems(c).length, c0));
  ok(subs.length === 15 && subs.includes(`${c0} ${n0 - 1}/${n0}`) && subs.filter(x => /✓$/.test(x)).length === 14, `fifteen collections, a cloth, cue and glove one in each rarity, the ${c0} one short of one (${subs.filter(x => !/✓$/.test(x))})`);
  ok(await p.evaluate(id => document.querySelector(`.colTile[data-id="${id}"]`).classList.contains('locked'), pools.common[0]) && (await p.$$('.colTile.sale')).length === 11, 'the one still missing is dimmed; eleven looks for sale');
  await p.click('#lockTabs .btn:nth-child(1)'); await sleep(250);
  await force(0.1); await p.click('.caseCard:nth-child(1) .btn:nth-child(1)'); await sleep(500); await p.click('#reelWin'); await sleep(600);
  const got = await p.evaluate(() => ({ ...__rr.reel.res })), rtxt = await p.textContent('#reelTxt'); L = await lock();
  ok(got.id === pools.common[0] && new RegExp(`Common ${k0} collection complete: £150 and a silver case!`).test(rtxt) && /Every common collection complete: £1,000, 3 gold cases and Chalk trail!/.test(rtxt) && /All fifteen collections complete: £50,000 and the Starfield room!/.test(rtxt),
    `the last common completes its collection, the common set, and all fifteen: the reel says so ("${rtxt}")`);
  ok(L.money === 100 - 8 + 150 + 1000 + 50000 && L.cases.silver === 1 && L.cases.gold === 3 && [c0, 'common', 'all'].every(c => L.claimed.includes(c)), `each reward is paid, once (money £${L.money})`);
  await p.click('#bReelDone'); await sleep(200);
  let fx = await p.evaluate(() => __rr.effects);
  ok(fx.on.join() === 'trail,rails,sparks,neon,cosmic,stars' && fx.rails && fx.cosmic && fx.stars && fx.sign === 'Tess', `every effect is on: gold rails, the cosmic cue ball, the starfield room, and your name in neon (${JSON.stringify(fx)})`);
  await p.click('#lockTabs .btn:nth-child(2)'); await sleep(250); await fits('Locker, inventory');
  ok((await p.$$('.fxRow')).length === 6, 'the inventory starts with the six rewards, each with a switch');
  await p.click('.fxRow[data-fx="rails"] .btn'); await sleep(200); fx = await p.evaluate(() => __rr.effects);
  ok(!fx.rails && !fx.on.includes('rails') && (await p.textContent('.fxRow[data-fx="rails"] .btn')) === 'Off', 'switching Gold rails off puts the wood back');
  await p.click('.fxRow[data-fx="rails"] .btn'); await sleep(200); ok((await p.evaluate(() => __rr.effects)).rails, 'and on again');
  await p.evaluate(() => __rr.sparkAt(0, 0, '#ffd23f')); ok((await p.evaluate(() => __rr.effects.sparks)) > 0, 'a pot throws sparks');

  console.log('--- the inventory, Settings and the table');
  const inv = await p.$$eval('.invRow[data-id]', es => es.map(e => e.dataset.id)), ranks = await p.evaluate(ids => ids.map(__rr.lookRank), inv);
  ok(inv.length > 60 && ranks[0] === 4 && ranks.every((r, i) => !i || r <= ranks[i - 1]) && inv.includes('g-white') && inv.includes('c-galaxy'), `one long list of everything owned, rarest first (${inv.length} looks)`);
  await p.click('.invRow[data-id="g-white"]'); await sleep(200);
  await p.click('.invRow[data-id="c-galaxy"]'); await sleep(300);
  let lk = await p.evaluate(() => __rr.look);
  ok(lk.cloth === 'c-galaxy' && lk.clothTex, 'a patterned cloth goes on the table as a picture');
  await p.click('#bMenuSettings'); await sleep(300);
  ok(await p.textContent('#sGlove .pickCur') === 'Classic white' && await p.textContent('#sCloth .pickCur') === 'Galaxy', 'Settings shows the glove and the cloth in use');
  await p.click('#sCloth .btn:last-child'); await sleep(200); ok(await p.textContent('#sCloth .pickCur') === 'Synthwave' && (await p.evaluate(() => __rr.look.clothTex)), 'the next cloth along');
  await p.click('#bResume'); await sleep(200);
  await p.evaluate(() => { const r = __rr; r.M.mode = '8ball'; r.M.opp = 'bot'; r.M.diff = 'hard'; r.M.race = 0; r.startGame(false); }); await sleep(1500);
  ok(await until(async () => (await p.evaluate(() => __rr.look.glove)) === 'g-white'), 'in a game, the glove in use is at the table');
  const hands = () => p.evaluate(() => __rr.hands), wear = async id => { await p.evaluate(id => { __rr.S.glove = id; }, id); await until(async () => (await p.evaluate(() => __rr.look.glove)) === id); await sleep(300); return hands(); };
  let hd = await hands();
  ok(hd.grip.skinned && hd.bridge.skinned && hd.grip.bones === 17 && hd.grip.tips.length === 4 && hd.grip.tips.every(d => d > 1.5 && d < 3.5),
    `each glove is one low-poly piece on a skeleton of ${hd.grip.bones} bones, and the cue hand's fingertips wrap round the cue (${hd.grip.tips} cm from its middle)`);
  const navy = await wear('g-navy');
  ok(navy.grip.geo === hd.grip.geo && navy.bridge.geo === hd.bridge.geo && hd.bridge.geo !== hd.grip.geo, 'another glove of the same type shares its shape: each type is made once, a left and a right hand');
  const robot = await wear('g-robot'), gold = await wear('g-gold');
  ok(!robot.grip.skinned && robot.grip.parts > 10 && !robot.textured && gold.grip.skinned && gold.textured, 'the robot claw keeps its jointed parts and its steel (no gold texture); Gold leaf is one piece in gold leaf');
  await wear('g-white');
  await p.evaluate(() => { const S = __rr.S; S.cloth = 'c-aurora'; S.glove = 'g-prism'; __rr.applyLook(); }); await until(async () => (await p.evaluate(() => __rr.look.glove)) === 'g-prism');
  // three readings: the Prism glow pulses about every 5 s, so two readings either side of its low point can match
  let f1 = await p.evaluate(() => __rr.fx); await sleep(1000); let f2 = await p.evaluate(() => __rr.fx); await sleep(400); const f3 = await p.evaluate(() => __rr.fx);
  ok(f2.cloth > f1.cloth && (f1.glove !== f2.glove || f2.glove !== f3.glove), `mythic looks move: the Aurora cloth drifts and the Prism glove changes colour (${JSON.stringify([f1, f2, f3])})`);
  await p.evaluate(() => { const S = __rr.S; S.cloth = 'c-magma'; S.glove = 'g-white'; __rr.applyLook(); }); await sleep(300);
  f1 = await p.evaluate(() => __rr.fx); await sleep(700); f2 = await p.evaluate(() => __rr.fx);
  ok(f1.glow !== '000000' && f1.glow !== f2.glow, `and the Magma cloth's cracks glow brighter and dimmer (${f1.glow}, ${f2.glow})`);

  console.log('--- a glove reacts: a shrug for a foul');
  await p.evaluate(() => { const r = __rr, c = r.world.balls[0]; r.game.breakShot = false; r.game.ballInHand = false; c.x = -0.6; c.z = 0.3; r.aim.phi = Math.PI; r.aim.power = 0.12; r.aim.sx = r.aim.sy = 0; });
  await until(() => p.evaluate(() => __rr.state === 'aim')); await p.evaluate(() => __rr.beginStroke());
  ok(await until(() => p.evaluate(() => __rr.effects.trail), 10000), 'the chalk trail follows the cue ball');
  ok(await until(() => p.evaluate(() => __rr.cheering === 'shrug'), 20000), 'hitting no ball is a foul, and the glove shrugs');
  await until(() => p.evaluate(() => __rr.state === 'botThink' || __rr.state === 'aim'));

  console.log('--- earning against the computer');
  await setLock(p, { money: 0, meter: { bronze: 0, silver: 0, gold: 0, diamond: 0 }, cases: { bronze: 0, silver: 0, gold: 0, diamond: 0 } });
  const win = async () => { await until(() => p.evaluate(() => __rr.state !== 'over' && __rr.concedeFrame(false, 1))); await until(() => p.isVisible('#over'), 5000); return p.textContent('#overEarn'); };
  let e = await win();
  ok(e === 'You earn £90 and a gold case!', `every frame won against Hard: "${e}"`);
  await p.click('#bAgain'); await sleep(1200); await win(); await p.click('#bAgain'); await sleep(1200); e = await win();
  L = await lock(); ok(e === 'You earn £90 and a gold case!' && L.cases.gold === 3 && L.money === 270, `three frames, three gold cases and £270 (${JSON.stringify(L.cases)})`);
  await p.click('#bAgain'); await sleep(1200);
  await until(() => p.evaluate(() => __rr.state !== 'over' && __rr.concedeFrame(false, 0))); await until(() => p.isVisible('#over'), 5000);
  ok(await p.textContent('#overEarn') === '' && (await lock()).money === 270, 'a frame lost earns nothing');
  await p.click('#bOverMenu'); await sleep(500);
  await p.evaluate(() => { const r = __rr; r.M.mode = '8ball'; r.M.opp = 'friend'; r.startGame(false); }); await sleep(1200);
  await until(() => p.evaluate(() => __rr.state !== 'over' && __rr.concedeFrame(false, 1))); await until(() => p.isVisible('#over'), 5000);
  ok(await p.textContent('#overEarn') === '' && (await lock()).money === 270, 'same-device games earn nothing');
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
  await p.click('#bMenuSettings'); await sleep(300); await p.click('#sDevMythic'); await sleep(150);
  ok(await p.textContent('#sDevMythic') === 'Next case mythic: On' && await p.getAttribute('#sDevMythic', 'aria-pressed') === 'true', 'Settings: "Next case mythic" switches on');
  await p.click('#bResume'); await sleep(200);
  ok(/next one mythic$/.test(await p.textContent('#lockMoney')), 'and the locker says the next case is a mythic');
  await p.click('.caseCard:nth-child(4) .btn:nth-child(1)'); await sleep(300); await p.click('#reelWin'); await sleep(300);
  const forced = await p.evaluate(() => ({ ...__rr.reel.res })); await p.click('#bReelDone');
  ok(forced.rarity === 'mythic' && await p.textContent('#reelTitle') === 'Mythic!', `the next case gives a mythic (${forced.id})`);
  ok(!/mythic/.test(await p.textContent('#lockMoney')) && (await p.evaluate(() => { document.querySelector('#bMenuSettings').click(); const t = document.querySelector('#sDevMythic').textContent; document.querySelector('#bResume').click(); return t; })) === 'Next case mythic: Off', 'once only: the switch turns itself off');
  ok((await p.evaluate(() => __rr.lock)).cases.diamond === 49 && JSON.stringify(await lock()) === real, 'opening a case uses the test locker only');
  await p.click('#lockTabs .btn:nth-child(2)'); await sleep(200); await p.click('.invRow[data-id="champion"]'); await sleep(200);
  ok(await p.evaluate(() => __rr.S.cue) === 'champion', 'the dearest shop cue can be used without buying it');
  await p.reload(); await sleep(1200);
  ok(await p.evaluate(() => __rr.dev && __rr.lock.cases.diamond === 49 && __rr.S.cue === 'champion'), 'dev mode stays on after a reload, test locker and all');

  console.log('--- dev mode: an empty test locker, so cases behave as they do for a new player');
  const reelGet = async () => { await sleep(300); await p.click('#reelWin'); await sleep(300); const r = await p.evaluate(() => ({ ...__rr.reel.res, txt: document.querySelector('#reelTxt').textContent })); await p.click('#bReelDone'); await sleep(200); return r; };
  await p.click('#bMenuSettings'); await sleep(300);
  ok(await p.textContent('#sDevEmpty') === 'Empty test locker', 'Settings offers to empty the test locker');
  await p.click('#sDevEmpty'); await sleep(300);   // the confirm is accepted
  D = await p.evaluate(() => __rr.lock);
  ok(!D.owned.length && !D.claimed.length && D.money === 100000 && D.cases.treat === 50 && D.cases.diamond === 50 && await p.textContent('#sDevEmpty') === 'Fill test locker' && JSON.stringify(await lock()) === real,
    'emptied: no looks and no rewards, £100,000 and 50 of each case, and the button now fills it; the real locker is untouched');
  ok(await p.evaluate(() => __rr.S.cue) === 'house' && !(await p.evaluate(() => __rr.effects.on.length)), 'the cue it no longer owns is put away, and no effects are on');
  await p.click('#bResume'); await sleep(200); await p.click('[data-go="locker"]'); await sleep(500);
  await p.click('#lockTabs .btn:nth-child(4)'); await sleep(300);   // Halloween
  const treats = []; for (let i = 0; i < 3; i++) { await p.click('.hwCases .caseCard:nth-child(2) .btn:nth-child(1)'); treats.push(await reelGet()); }
  ok(treats.every(r => !r.dup && /New!/.test(r.txt)) && new Set(treats.map(r => r.id)).size === 3, `Treat cases: three different looks, each one new (${treats.map(r => r.id).join(', ')})`);
  await p.click('#lockTabs .btn:nth-child(1)'); await sleep(300);
  const myths = []; for (let i = 0; i < 2; i++) {
    await p.click('#bMenuSettings'); await sleep(250); await p.click('#sDevMythic'); await sleep(100); await p.click('#bResume'); await sleep(200);
    await p.click('.caseCard:nth-child(4) .btn:nth-child(1)'); myths.push(await reelGet());
  }
  ok(myths.every(r => r.rarity === 'mythic' && !r.dup) && myths[0].id !== myths[1].id, `"Next case mythic" twice: two different mythics, both new (${myths.map(r => r.id).join(', ')})`);
  await p.reload(); await sleep(1200);
  ok(await p.evaluate(() => __rr.dev && __rr.lock.owned.length === 5), 'it stays empty after a reload, with what it won since');
  await p.click('#bMenuSettings'); await sleep(300); await p.click('#sDevEmpty'); await sleep(300);
  D = await p.evaluate(() => __rr.lock);
  ok(await p.evaluate(() => Object.keys(__rr.LK.ALL).every(id => __rr.LK.owns(__rr.lock, id))) && D.claimed.includes('all') && D.cases.treat === 47 && await p.textContent('#sDevEmpty') === 'Empty test locker', 'Fill test locker: everything again, keeping its money and cases');
  await p.click('#sDevEmpty'); await sleep(300); await p.click('#bResume'); await sleep(200);   // empty again: switching dev mode off forgets it (below)
  await p.click('#bMenuSettings'); await sleep(300);
  ok(await p.isVisible('#rowDev'), 'Settings shows a Dev mode row');
  await p.click('#sDev'); await sleep(300);
  ok(!(await p.evaluate(() => __rr.dev)) && JSON.stringify(await lock()) === real && (await p.evaluate(() => __rr.lock.money)) === JSON.parse(real).money && await p.isHidden('#rowDev'), 'Switch off: your own locker is back');
  ok(await p.evaluate(() => __rr.S.cue) === 'house', 'and the cue you don\'t own goes back to the house cue');
  ok(await p.evaluate(() => localStorage.getItem('retroRack.devEmpty')) === null, 'and an emptied test locker is forgotten: next time dev mode starts full');
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
