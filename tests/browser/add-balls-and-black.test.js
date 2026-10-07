// "Add balls" in the trick-shot editor, and the "one visit on the black" rule option (locally and online).
const { chromium, SITE, shot } = require('./lib');
const BASE = SITE.new + '?relay=ws://127.0.0.1:8787';
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const logs = [];
let b;
async function win(name, size = { width: 1000, height: 640 }, extra = {}) {
  const ctx = await b.newContext({ viewport: size, reducedMotion: 'reduce', ...extra });
  await ctx.addInitScript(n => { try { localStorage.setItem('retroRack.name', n); localStorage.setItem('retroRack.rotateHint', 'off'); } catch (e) {} }, name);
  const p = await ctx.newPage();
  p.on('console', m => { if (!/GPU stall/.test(m.text())) logs.push(`${name} [${m.type()}] ${m.text()}`); });
  p.on('pageerror', e => logs.push(`${name} [pageerror] ${e.message}`));
  await p.goto(BASE); await sleep(1200); return p;
}
const balls = p => p.evaluate(() => window.__rr.world.balls.filter(b => !b.potted).map(b => b.id));
const lit = p => p.evaluate(() => [...document.querySelectorAll('#ballGrid .bp')].map((x, i) => x.getAttribute('aria-pressed') === 'true' ? i + 1 : 0).filter(Boolean));
const clear = p => p.evaluate(() => { const bs = window.__rr.world.balls.filter(b => !b.potted); for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) if (Math.hypot(bs[i].x - bs[j].x, bs[i].z - bs[j].z) < 2 * 0.0285) return false; return true; });
function overlaps() {   // evaluated in the page: does the picker cover any HUD piece?
  const pick = document.querySelector('#ballPick').getBoundingClientRect(), out = [];
  const others = [['spin/power panel', '#shot'], ['scoreboard', '#board'], ...[...document.querySelectorAll('#tools .btn, #practice > .btn, #trickInfo')].filter(e => !e.hidden && e.getBoundingClientRect().width).map(e => [e.textContent.trim() || e.id, e])];
  for (const [n, sel] of others) { const el = typeof sel === 'string' ? document.querySelector(sel) : sel; if (!el || el.closest('[hidden]')) continue; const r = el.getBoundingClientRect(); if (pick.left < r.right - 1 && r.left < pick.right - 1 && pick.top < r.bottom - 1 && r.top < pick.bottom - 1) out.push(n); }
  if (pick.left < 0 || pick.right > innerWidth || pick.top < 0 || pick.bottom > innerHeight) out.push('the screen edge');
  return out;
}

(async () => {
  b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

  console.log('--- Add balls, in the trick-shot editor');
  const p = await win('Solo');
  await p.evaluate(() => { const r = window.__rr; r.M.mode = 'practice'; r.M.rack = 'trick'; r.M.trick = 0; r.startGame(); }); await sleep(500);
  ok(await p.isHidden('#bBalls'), '"Add balls" stays hidden until Edit table is on');
  const start = await balls(p);
  await p.click('#bMove'); await sleep(200);
  ok(await p.isVisible('#bBalls'), 'Edit table shows "Add balls"');
  await p.click('#bBalls'); await sleep(200);
  ok(await p.isVisible('#ballPick') && (await p.$$('#ballGrid .bp')).length === 15, 'the picker opens with all 15 balls');
  ok(JSON.stringify(await lit(p)) === JSON.stringify(start.filter(id => id)), `balls already on the table are lit (${await lit(p)})`);
  for (const id of [5, 11, 8]) await p.click(`#ballGrid .bp:nth-child(${id})`);
  await sleep(200);
  const added = await balls(p);
  ok([5, 8, 11].every(id => added.includes(id)) && added.length === start.length + 3, `tapping 5, 11 and 8 puts them on the table (${added})`);
  ok(await clear(p), 'no two balls overlap');
  ok(await p.evaluate(() => window.__rr.world.balls[0].id === 0 && window.__rr.world.balls.every((b, i, a) => !i || a[i - 1].id < b.id)), 'the cue ball stays first and the rest stay in order');
  await p.click('#ballGrid .bp:nth-child(11)'); await sleep(150);
  ok(!(await balls(p)).includes(11), 'tapping 11 again takes it off');
  ok(JSON.stringify(await lit(p)) === JSON.stringify((await balls(p)).filter(id => id)), 'the picker always matches the table');
  ok((await p.evaluate(overlaps)).length === 0, `computer: the picker covers nothing (${await p.evaluate(overlaps)})`);
  await p.screenshot({ path: shot('pick-pc.png') });
  await p.click('#bSave'); await sleep(200);
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('retroRack.layouts') || localStorage.getItem('retroRack.tricks') || '[]').slice(-1)[0]);
  ok(saved && [5, 8].every(id => saved.balls.some(x => x[0] === id)), `Save layout keeps the added balls (${saved && saved.balls.map(x => x[0])})`);
  await p.click('#bPickDone'); await p.click('#bMove'); await sleep(200);
  ok(await p.isHidden('#ballPick') && await p.isHidden('#bBalls'), 'Done and Edit table off hide it again');
  await p.evaluate(() => { const a = window.__rr.aim; a.power = 0.5; window.__rr.beginStroke(); });
  let s; for (let i = 0; i < 150; i++) { await sleep(300); s = await p.evaluate(() => window.__rr.state); if (s === 'aim') break; }
  ok(s === 'aim', 'a shot with the extra balls plays out normally');
  await p.click('#bMove'); await p.click('#bBalls'); await sleep(150);
  await p.evaluate(() => { window.__rr.world.balls.find(b => b.id === 5).potted = true; });   // as if the 5 had gone in
  const potted = await p.evaluate(() => window.__rr.world.balls.filter(b => b.potted && b.id).map(b => b.id));
  await p.click('#bReturn'); await sleep(150);
  ok(potted.length > 0 && await p.evaluate(() => !window.__rr.world.balls.some(b => b.potted && b.id)), `Return potted (now in the picker) brings back potted balls (${potted})`);
  await p.click('#bPause'); await sleep(150);
  ok(await p.isHidden('#ballPick'), 'opening Pause closes the picker, so it never covers the Pause panel');
  await p.click('#bQuit'); await sleep(300);
  ok(await p.isHidden('#ballPick'), 'leaving to the menu closes the picker');

  for (const [w, h, tag] of [[762, 341, 'phone on its side'], [412, 915, 'phone upright']]) {
    const q = await win('Phone', { width: w, height: h }, { hasTouch: true, isMobile: true });
    await q.evaluate(() => { const r = window.__rr; r.M.mode = 'practice'; r.M.rack = 'trick'; r.M.trick = 0; r.startGame(); }); await sleep(500);
    await q.tap('#bMove'); await sleep(150); await q.tap('#bBalls'); await sleep(200);
    await q.tap('#ballGrid .bp:nth-child(4)'); await sleep(150);
    ok((await balls(q)).includes(4), `${tag}: tapping adds a ball`);
    const o = await q.evaluate(overlaps);
    ok(o.length === 0, `${tag}: the picker covers nothing (${o})`);
    await q.screenshot({ path: shot(`pick-${w}.png`) });
    await q.context().close();
  }

  console.log('--- "One visit on the black"');
  await p.click('[data-go="single"]'); await p.click('[data-go="game"][data-opp="bot"]'); await p.click('[data-mode="8ball"]'); await sleep(150);
  ok(await p.isHidden('#rowBlack'), '8-ball setup: no "On black" choice');
  await p.click('#mBack'); await p.click('[data-mode="uk8"]'); await sleep(150);
  ok(await p.isVisible('#rowBlack') && (await p.textContent('#mBlack')).includes('Two visits'), 'Reds & yellows setup: "On black: Two visits / One visit"');
  await p.click('#mBlack .btn:nth-child(2)'); await p.click('#bStart'); await sleep(500);
  ok(await p.evaluate(() => window.__rr.game.oneVisitOnBlack === true), 'choosing One visit turns the rule on for the game');
  await p.click('#bPause'); await p.click('#bQuit'); await sleep(300);
  await p.click('#bQuick'); await sleep(500);
  ok(await p.evaluate(() => window.__rr.game.oneVisitOnBlack === true), 'Play again keeps it');
  // a foul against a player on the black, played for real: player 0 (yellows) misses everything; the CPU is on the black
  await p.evaluate(() => {
    const r = window.__rr, g = r.game; g.breakShot = false; g.ballInHand = false; g.kitchen = false; g.groups = ['stripes', 'solids']; g.turn = 0;
    for (const b of r.world.balls) if (b.id >= 1 && b.id <= 7) b.potted = true;
    r.aim.power = 0.02;
  });
  await p.evaluate(() => window.__rr.beginStroke());
  let seen = null; for (let i = 0; i < 100 && !seen; i++) { await sleep(150); const st = await p.evaluate(() => ({ s: window.__rr.state, turn: window.__rr.game.turn, visits: window.__rr.game.visits, free: window.__rr.game.freeShot })); if (st.turn === 1) seen = st; }
  ok(seen && seen.visits === 1 && seen.free, `in a game: the CPU, on the black, gets one visit and a free ball (${JSON.stringify(seen)})`);
  const toasts = await p.evaluate(() => [...document.querySelectorAll('#notices .toast')].map(t => t.textContent).join(' | '));
  ok(/one visit \(on the black\)/.test(toasts), `and the message says so: "${toasts}"`);

  console.log('--- online: the host\'s choice reaches the guest');
  const h = await win('Host'), g = await win('Guest');
  await h.click('[data-go="multi"]'); await h.click('[data-go="online"]'); await h.click('#bCreate'); await h.click('[data-mode="uk8"]');
  await h.click('#mBlack .btn:nth-child(2)'); await h.click('#mListed .btn:nth-child(2)'); await h.click('#bStart'); await sleep(1500);
  const code = await h.textContent('#lobbyCode');
  await g.click('[data-go="multi"]'); await g.click('[data-go="online"]'); await g.fill('#netCode', code); await g.click('#bJoin');
  let both = false; for (let i = 0; i < 60 && !both; i++) { await sleep(300); both = await g.evaluate(() => window.__rr.NET.started) && await h.evaluate(() => window.__rr.NET.started); }
  ok(both, 'the online reds & yellows game starts');
  ok(await g.evaluate(() => window.__rr.game.oneVisitOnBlack === true && window.__rr.M.mode === 'uk8'), 'the guest plays with "one visit on the black" too');

  ok(!logs.length, 'console clean' + (logs.length ? ':\n  ' + logs.join('\n  ') : ''));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
