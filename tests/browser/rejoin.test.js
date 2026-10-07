// "Rejoin": close a player's page completely mid-game (like swiping the app away), reopen fresh, rejoin.
const { chromium, SITE, shot } = require('./lib');
const BASE = SITE.new + '?relay=ws://127.0.0.1:8787';
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const logs = [];
let b;
async function ctxFor(name) {
  const ctx = await b.newContext({ viewport: { width: 900, height: 560 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(n => { try { localStorage.setItem('retroRack.name', n); localStorage.setItem('retroRack.rotateHint', 'off'); } catch (e) {} }, name);
  return ctx;
}
async function open(ctx, name, url = BASE) {
  const p = await ctx.newPage();
  p.on('console', m => { if (!/GPU stall/.test(m.text())) logs.push(`${name} [${m.type()}] ${m.text()}`); });
  p.on('pageerror', e => logs.push(`${name} [pageerror] ${e.message}`));
  await p.goto(url); await sleep(1200); return p;
}
const info = p => p.evaluate(() => ({ state: window.__rr.state, seat: window.__rr.NET.seat, started: window.__rr.NET.started, n: window.__rr.NET.n, cid: window.__rr.NET.cid, peer: window.__rr.NET.peer }));
const table = p => p.evaluate(() => JSON.stringify({ b: window.__rr.world.balls.map(b => [b.id, b.x, b.z, b.potted]), turn: window.__rr.game.turn }));
const until = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(300); } return false; };
async function shoot(a, c) {
  const turn = await a.evaluate(() => window.__rr.game.turn), shooter = turn === (await info(a)).seat ? a : c, n0 = (await info(a)).n;
  await shooter.evaluate(() => window.__rr.beginStroke());
  return until(async () => { const [x, y] = [await info(a), await info(c)]; return x.n === n0 + 1 && y.n === n0 + 1 && ['aim', 'remote', 'over'].includes(x.state) && ['aim', 'remote', 'over'].includes(y.state); }, 90000);
}
async function toOnline(p) { if (!(await p.isVisible('#netCode'))) { await p.click('[data-go="multi"]'); await p.click('[data-go="online"]'); } }
const saved = p => p.evaluate(() => JSON.parse(localStorage.getItem('retroRack.rejoin') || '[]'));
async function newRoom(h, g) {
  await toOnline(h); await h.click('#bCreate'); await h.click('[data-mode="8ball"]');
  await h.click('#mListed .btn:nth-child(2)'); await h.click('#bStart'); await sleep(1200);
  const code = await h.textContent('#lobbyCode');
  await toOnline(g); await g.fill('#netCode', code); await g.click('#bJoin');
  await until(async () => (await info(h)).started && (await info(g)).started);
  return code;
}

(async () => {
  b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const hc = await ctxFor('Sam'), gc = await ctxFor('Alex');
  let h = await open(hc, 'Sam'), g = await open(gc, 'Alex');
  ok(await h.isHidden('#bRejoin'), 'no Rejoin button before any online game');

  console.log('--- the guest closes the app mid-game, reopens it, and rejoins');
  const code = await newRoom(h, g);
  ok(await shoot(h, g), 'the break plays out in both windows');
  const before = await info(g), tbl = await table(h);
  await g.close();                                        // like swiping the app away: no goodbye is sent
  await sleep(1500);
  ok((await info(h)).peer === false, "Sam's game notices Alex has gone");
  g = await open(gc, 'Alex');                             // reopened from the icon: a fresh page, no room in the address
  ok(await g.isVisible('#bRejoin') && (await g.textContent('#bRejoin')) === 'Rejoin 8-ball with Sam', `home screen offers "${await g.textContent('#bRejoin')}"`);
  await g.click('#bRejoin');
  ok(await until(async () => { const i = await info(g); return i.started && i.state !== 'lobby'; }), 'Rejoin puts Alex back in the game');
  const after = await info(g);
  ok(after.seat === before.seat && after.cid === before.cid, `same seat (${after.seat}) and same player id`);
  ok(await table(g) === tbl && await table(h) === tbl, 'the table is exactly as it was');
  ok(await shoot(h, g), 'play carries on: the next shot plays out in both windows');
  ok(await table(g) === await table(h), 'tables identical after it');

  console.log('--- leaving on purpose forgets it, for both players');
  ok((await saved(h)).length === 1 && (await saved(g)).length === 1, 'before that, each device has its one saved game');
  await g.click('#bPause'); await g.click('#bQuit'); await sleep(1000);
  ok(!(await saved(g)).length, 'Alex quits: Alex\'s saved game is forgotten');
  ok(!(await saved(h)).length, 'Sam is told Alex left on purpose, so Sam\'s is forgotten too');
  await h.click('#bPause'); await h.click('#bQuit'); await sleep(500);
  { const p = await open(gc, 'Alex'); ok(await p.isHidden('#bRejoin') && await p.isVisible('[data-go="multi"]'), 'reopened afterwards: home has no Rejoin button'); await p.close(); }

  console.log('--- both players close their apps; each rejoins');
  await newRoom(h, g);
  ok(await shoot(h, g), 'a new game, one shot played');
  const hs = (await info(h)).seat, gs = (await info(g)).seat;
  await h.close(); await g.close(); await sleep(1500);
  g = await open(gc, 'Alex'); await g.click('#bRejoin'); await sleep(1500);
  ok((await info(g)).state === 'lobby' && /Waiting for Sam to come back/.test(await g.textContent('#lobbyStatus')), `first back waits: "${await g.textContent('#lobbyStatus')}"`);
  h = await open(hc, 'Sam'); ok(await h.isVisible('#bRejoin'), 'Sam is offered Rejoin too');
  await h.click('#bRejoin');
  ok(await until(async () => (await info(h)).started && (await info(g)).started), 'when Sam rejoins, a fresh frame starts in the same room');
  ok((await info(h)).seat === hs && (await info(g)).seat === gs, `each player is back in their own seat (${hs} and ${gs})`);
  ok(await table(h) === await table(g), 'tables identical');

  console.log('--- it expires');
  await h.evaluate(() => { const l = JSON.parse(localStorage.getItem('retroRack.rejoin')); for (const r of l) r.at -= 4 * 3600 * 1000; localStorage.setItem('retroRack.rejoin', JSON.stringify(l)); });
  await h.close(); h = await open(hc, 'Sam');
  ok(await h.isHidden('#bRejoin'), 'after more than 3 hours the button is gone');
  await g.close(); await h.close();

  console.log('--- one device, two tabs (playing yourself): rejoin takes the closed tab\'s seat, never the open one');
  const tc = await ctxFor('Tess');
  let A = await open(tc, 'Tess A'), B = await open(tc, 'Tess B');
  await newRoom(A, B);
  ok(await shoot(A, B), 'a shot plays out in both tabs');
  const aI = await info(A), bI = await info(B);
  ok((await saved(A)).length === 2, 'two saved entries, one per seat');
  let C = await open(tc, 'Tess C');
  ok(await C.isHidden('#bRejoin'), 'a third tab, with both seats still open: no Rejoin button');
  await B.close(); await sleep(1500);
  await A.evaluate(cid => { const l = JSON.parse(localStorage.getItem('retroRack.rejoin')); l.sort((x, y) => (y.cid === cid) - (x.cid === cid)); localStorage.setItem('retroRack.rejoin', JSON.stringify(l)); }, aI.cid);   // the open tab's entry is the newest
  await C.close(); C = await open(tc, 'Tess C');
  ok(await C.isVisible('#bRejoin'), 'after closing one tab, a new tab offers Rejoin');
  await C.click('#bRejoin');
  ok(await until(async () => { const i = await info(C); return i.started && i.state !== 'lobby'; }), 'the new tab is back in the game');
  const cI = await info(C), aNow = await info(A);
  ok(cI.cid === bI.cid && cI.seat === bI.seat, `it took the closed tab's seat (${cI.seat}), not the open one's`);
  ok(aNow.peer === true && aNow.state !== 'menu' && aNow.seat === aI.seat, 'the open tab was left alone and sees its opponent back');
  ok(await table(A) === await table(C), 'tables identical');
  ok(await shoot(A, C), 'play carries on');
  await tc.close();

  console.log('--- a phone on its side: home still fits with both buttons');
  const pc = await b.newContext({ viewport: { width: 762, height: 341 }, reducedMotion: 'reduce' });
  await pc.addInitScript(() => { localStorage.setItem('retroRack.rotateHint', 'off');
    localStorage.setItem('retroRack.menu', JSON.stringify({ last: { mode: '8ball', opp: 'bot', diff: 'medium', rack: '8ball', race: 0, guide: 'auto' } }));
    localStorage.setItem('retroRack.rejoin', JSON.stringify([{ code: 'ABCDE', cid: 'XYZXYZXYZXYZ', peer: 'Samantha', mode: 'uk8', at: Date.now() }])); });
  const ph = await open(pc, 'Phone');
  const fit = await ph.evaluate(() => { const s = document.querySelector('#mStage'), r = document.querySelector('#bRejoin').getBoundingClientRect(); return { over: s.scrollHeight - s.clientHeight, shown: r.width > 0 }; });
  ok(fit.shown && fit.over <= 1, `Rejoin and Play again both show, no scrolling (${JSON.stringify(fit)})`);
  await ph.screenshot({ path: shot('rejoin-phone.png') });

  ok(!logs.length, 'console clean' + (logs.length ? ':\n  ' + logs.join('\n  ') : ''));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
