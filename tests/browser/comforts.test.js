// Volume, fullscreen button, sideways hint and vibration, on a desktop window and an emulated Android phone; the
// Settings panel (two columns, closed by clicking outside it) and the sharpest-graphics default.
const { chromium, devices, FILE, shot } = require('./lib');
const URL = FILE;
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const logs = [];
const watch = (p, n) => { p.on('console', m => { if (!/GPU stall/.test(m.text())) logs.push(`${n} [${m.type()}] ${m.text()}`); }); p.on('pageerror', e => logs.push(`${n} [pageerror] ${e.message}`)); };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

  console.log('--- desktop');
  const dc = await b.newContext({ viewport: { width: 1000, height: 640 } });
  const d = await dc.newPage(); watch(d, 'desktop');
  await d.goto(URL + '?realdefaults'); await d.waitForTimeout(1200);   // the game's own defaults, not the tests' quicker picture
  ok(await d.isHidden('#rotate'), 'no sideways hint on a computer');
  ok(await d.isVisible('#bMenuFull'), 'menu has a Fullscreen button');
  await d.click('#bMenuSettings'); await d.waitForTimeout(200);
  const vol = await d.$$eval('#sVolume .btn', bs => bs.map(x => x.textContent + (x.getAttribute('aria-pressed') === 'true' ? '*' : '')));
  ok(vol.join(',') === 'Off,25%,50%,75%*,100%', `Sound row: ${vol.join(' ')} (75% chosen by default)`);
  ok(await d.isHidden('#rowVibrate'), 'no Vibration setting on a computer');
  await d.click('#sVolume .btn:nth-child(3)'); await d.waitForTimeout(100);
  const g50 = await d.evaluate(() => [window.__rr.S.volume, JSON.parse(localStorage.getItem('retroRack.settings')).volume]);
  ok(g50[0] === 0.5 && g50[1] === 0.5, 'choosing 50% sets and saves it');
  ok(await d.evaluate(() => __rr.S.pixel === 1 && __rr.S.levels === 256), 'the sharpest graphics by default: pixel size 1x, full colours');
  const cols = await d.evaluate(() => getComputedStyle(document.querySelector('.sGrid')).columnCount);
  ok(cols === '2' && (await d.$$('#pausePanel .sSec h3')).length === 4, `Settings in four sections, in two columns (${cols})`);
  await d.click('#pausePanel h2'); await d.waitForTimeout(150);
  ok(await d.isVisible('#pause'), 'a click inside the panel leaves it open');
  await d.mouse.click(5, 320); await d.waitForTimeout(200);
  ok(await d.isHidden('#pause'), 'a click outside the panel closes it');
  await d.click('#bMenuSettings'); await d.waitForTimeout(200);
  await d.screenshot({ path: shot('c-settings.png') });
  await d.click('#bResume');
  await d.click('#bMenuFull'); await d.waitForTimeout(400);
  ok(await d.evaluate(() => !!document.fullscreenElement) && (await d.textContent('#bMenuFull')) === 'Exit fullscreen', 'Fullscreen button enters fullscreen and changes to "Exit fullscreen"');
  await d.click('#bMenuFull'); await d.waitForTimeout(400);
  ok(await d.evaluate(() => !document.fullscreenElement) && (await d.textContent('#bMenuFull')) === 'Fullscreen', 'pressing it again leaves fullscreen');
  for (const sel of ['[data-go="single"]', '[data-go="game"][data-opp="bot"]', '[data-mode="8ball"]', '#bStart']) { await d.click(sel); await d.waitForTimeout(350); }   // through the new menus
  await d.waitForTimeout(500);
  ok(await d.isVisible('#bFull'), 'in-game button column has Fullscreen too');
  await d.screenshot({ path: shot('c-desktop-game.png') });

  console.log('--- old settings carry over');
  for (const [saved, want] of [[{ sound: false }, 0], [{ sound: true }, 0.75], [{}, 0.75]]) {
    const c = await b.newContext(); await c.addInitScript(s => localStorage.setItem('retroRack.settings', s), JSON.stringify(saved));
    const p = await c.newPage(); watch(p, 'migrate'); await p.goto(URL); await p.waitForTimeout(800);
    const v = await p.evaluate(() => [window.__rr.S.volume, 'sound' in window.__rr.S]);
    ok(v[0] === want && !v[1], `saved ${JSON.stringify(saved)} → volume ${v[0]}`);
    await c.close();
  }
  // the sharpest graphics reach everyone once; a choice made afterwards is kept
  for (const [saved, want] of [[{ pixel: 3, levels: 8 }, '1/256'], [{ pixel: 3, levels: 8, gfx: 2 }, '3/8']]) {
    const c = await b.newContext(); await c.addInitScript(s => localStorage.setItem('retroRack.settings', s), JSON.stringify(saved));
    const p = await c.newPage(); watch(p, 'graphics'); await p.goto(URL); await p.waitForTimeout(800);
    const v = await p.evaluate(() => `${__rr.S.pixel}/${__rr.S.levels}`);
    ok(v === want, `saved ${JSON.stringify(saved)} → pixel size and colours ${v}`);
    await c.close();
  }

  console.log('--- Android phone (emulated)');
  const pc = await b.newContext({ ...devices['Pixel 7'] });
  await pc.addInitScript(() => { window.__vib = []; navigator.vibrate = p => { window.__vib.push(p); return true; }; });
  const p = await pc.newPage(); watch(p, 'phone');
  await p.goto(URL); await p.waitForTimeout(1500);
  ok(await p.isVisible('#rotate'), 'held upright: the sideways hint shows');
  await p.screenshot({ path: shot('c-phone-portrait.png') });
  await p.setViewportSize({ width: 915, height: 412 }); await p.waitForTimeout(300);
  ok(await p.isHidden('#rotate'), 'turned sideways: the hint goes');
  await p.setViewportSize({ width: 412, height: 915 }); await p.waitForTimeout(300);
  ok(await p.isVisible('#rotate'), 'upright again: it comes back');
  await p.tap('#bRotateOk'); await p.waitForTimeout(200);
  ok(await p.isHidden('#rotate'), 'OK hides it');
  await p.reload(); await p.waitForTimeout(1500);
  ok(await p.isHidden('#rotate'), 'and it stays hidden after a reload');
  await p.setViewportSize({ width: 915, height: 412 }); await p.waitForTimeout(300);
  await p.tap('#bMenuSettings'); await p.waitForTimeout(200);
  ok(await p.isVisible('#rowVibrate') && (await p.textContent('#sVibrate')) === 'On', 'Vibration setting shows on the phone, On by default');
  await p.screenshot({ path: shot('c-phone-settings.png') });
  await p.tap('#bResume');

  const ev = f => p.evaluate(f);
  const vib = () => ev(() => window.__vib.slice());
  const settle = async () => { let s; for (let i = 0; i < 500; i++) { await p.waitForTimeout(300); s = await ev(() => window.__rr.state); if (['aim', 'over', 'botThink', 'botAim'].includes(s)) return s; } return s; };
  const potted = () => ev(() => window.__rr.world.balls.filter(b => b.potted && b.id !== 0).length);
  // your own pots buzz (same-device game, so every shot is yours)
  let found = false;
  for (let tries = 0; tries < 6 && !found; tries++) {
    await ev(() => { const r = window.__rr; r.M.mode = '8ball'; r.M.opp = 'friend'; r.startGame(); }); await p.waitForTimeout(300);
    const v0 = (await vib()).length;
    await ev(() => { window.__rr.aim.power = 1; window.__rr.beginStroke(); }); await settle();
    const n = await potted(), v = (await vib()).slice(v0);
    console.log(`     break ${tries + 1}: state ${await ev(() => window.__rr.state)}, potted ${n}, buzzes ${JSON.stringify(v)}`);
    if (n > 0) { found = true; ok(v.filter(x => x === 30).length === n, `break potted ${n}: ${v.filter(x => x === 30).length} short buzz(es)`); }
  }
  ok(found, 'found a break that potted a ball');
  // replaying that shot must not buzz again
  const vr = (await vib()).length;
  await p.keyboard.press('v'); await p.waitForTimeout(300);
  for (let i = 0; i < 100 && await ev(() => !!window.__rr.replay); i++) await p.waitForTimeout(300);
  ok((await vib()).length === vr, 'no buzz while watching the replay');
  // a foul: a feather-light shot that reaches nothing
  await ev(() => { const g = window.__rr.game; g.breakShot = false; });
  const vf = (await vib()).length;
  await ev(() => { const r = window.__rr; r.aim.power = 0.02; r.beginStroke(); }); await settle();
  const fv = (await vib()).slice(vf);
  ok(await ev(() => window.__rr.game && true) && fv.some(x => Array.isArray(x) && x.join() === '70,60,70'), `a foul gives the longer double buzz (${JSON.stringify(fv)})`);
  // the CPU's shots never buzz
  await ev(() => { const r = window.__rr; r.M.mode = '8ball'; r.M.opp = 'bot'; r.M.diff = 'expert'; r.startGame(); }); await p.waitForTimeout(300);
  await ev(() => { const r = window.__rr; r.aim.power = 0.02; r.beginStroke(); });   // your break barely moves: CPU's turn
  let cpuPots = 0, cpuBuzz = 0;
  for (let k = 0; k < 4; k++) {
    let s = await settle(); if (s === 'over') break;
    if (s === 'aim') { await ev(() => { const r = window.__rr; r.aim.power = 0.02; r.beginStroke(); }); continue; }
    const p0 = await potted(), v0 = (await vib()).length;
    for (let i = 0; i < 200; i++) { await p.waitForTimeout(300); const st = await ev(() => window.__rr.state); if (st === 'aim' || st === 'over') break; }
    cpuPots += (await potted()) - p0; cpuBuzz += (await vib()).length - v0;
  }
  ok(cpuBuzz === 0, `the CPU's shots never buzz (CPU potted ${cpuPots} ball(s) in this test${cpuPots ? '' : ', so this check is weaker'})`);
  // switching vibration off
  for (let i = 0; i < 400 && !['aim', 'over'].includes(await ev(() => window.__rr.state)); i++) await p.waitForTimeout(300);   // let the CPU's shot finish
  await p.waitForTimeout(1200);   // the CPU may have won: its game-over panel appears 0.7 s after the last shot
  await ev(() => { const r = window.__rr; r.M.mode = '8ball'; r.M.opp = 'friend'; r.startGame(); }); await p.waitForTimeout(300);
  await p.tap('#bPause'); await p.tap('#sVibrate'); await p.waitForTimeout(100);
  ok((await p.textContent('#sVibrate')) === 'Off' && await ev(() => window.__rr.S.vibrate === false), 'the Vibration switch turns it off');
  await p.tap('#bResume');
  await ev(() => { const r = window.__rr; r.M.mode = '8ball'; r.M.opp = 'friend'; r.startGame(); }); await p.waitForTimeout(300);
  const vo = (await vib()).length;
  await ev(() => { window.__rr.aim.power = 1; window.__rr.beginStroke(); }); await settle();
  await ev(() => { window.__rr.aim.power = 0.02; window.__rr.game.breakShot = false; window.__rr.beginStroke(); }); await settle();
  ok((await vib()).length === vo, 'with it off, no buzz at all');
  await p.screenshot({ path: shot('c-phone-game.png') });

  ok(!logs.length, 'console clean' + (logs.length ? ':\n  ' + logs.join('\n  ') : ''));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
