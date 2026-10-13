// The shot camera: pressing Shoot holds your aim while the view glides in behind the cue, then the stroke plays; after
// the strike the view rises to a high one of the whole table (the overhead view, if that's where you shot from), and it
// goes back once the balls stop; not for the computer's shots, not with the Settings switch off or with reduced motion
// (the stroke then starts at once), and moving the camera yourself keeps it.
const { chromium, FILE } = require('./lib');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
(async () => {
  const b = await chromium.launch({ args: ARGS }), log = [];
  const page = async opts => {
    const p = await b.newPage({ viewport: { width: 480, height: 360 }, ...opts });
    p.on('console', m => { if (!/GPU stall/.test(m.text())) log.push(`[${m.type()}] ${m.text()}`); }); p.on('pageerror', e => log.push(`[pageerror] ${e.message}`));
    await p.goto(FILE); await p.waitForTimeout(1200); return p;
  };
  const p = await page(), ev = (f, a) => p.evaluate(f, a), sleep = ms => p.waitForTimeout(ms);
  const until = async (f, ms = 30000) => { for (let t = 0; t < ms; t += 200) { if (await f()) return true; await sleep(200); } return false; };
  const start = (mode, opp) => ev(([m, o]) => { const r = __rr; r.M.mode = m; r.M.opp = o; r.M.diff = 'hard'; r.startGame(); }, [mode, opp]);
  // a gentle shot at the 1-ball from the cue ball's own spot
  const aimAt = power => ev(pw => { const r = __rr, c = r.world.balls[0], o = r.world.balls.find(x => x.id && !x.potted); r.game.ballInHand = false; r.game.breakShot = false; r.aim.phi = Math.atan2(o.z - c.z, o.x - c.x); r.aim.power = pw; r.aim.sx = r.aim.sy = 0; }, power);
  const cam = () => ev(() => ({ mode: __rr.cam.mode, pitch: __rr.cam.cur.pitch, yaw: __rr.cam.cur.yaw, dist: __rr.cam.cur.dist, state: __rr.state, turn: __rr.game.turn, frame: __rr.tableFrame(), away: ['#shot', '#tools', '#practice'].every(q => document.querySelector(q).classList.contains('away')), back: !['#shot', '#tools', '#practice'].some(q => document.querySelector(q).classList.contains('away')) }));
  const risen = async () => { await until(() => ev(() => __rr.state === 'moving'), 5000); await sleep(2000); return cam(); };
  const settle = () => until(() => ev(() => __rr.state === 'aim'));

  console.log('--- your own shot');
  await start('practice', 'friend'); await settle(); await aimAt(0.3);
  const before = await cam();
  await ev(() => __rr.shoot()); await sleep(150);
  const held = await cam();
  ok(held.mode === 'shot' && held.state === 'set' && await p.isDisabled('#bShoot'), `pressing Shoot holds the aim while the view swings in (${held.state})`);
  ok(await until(() => ev(() => __rr.state === 'stroke' || __rr.state === 'moving'), 3000), 'then the stroke plays');
  const mid = await cam();
  ok(mid.mode === 'shot' && Math.abs(mid.pitch - 0.4) < 0.05 && Math.abs(mid.dist - 0.95) < 0.1, `by then the view is over the cue, looking down the line (${JSON.stringify(mid)})`);
  await settle(); await sleep(200);
  ok((await cam()).mode === before.mode, `once the balls stop it goes back to the view you had ("${before.mode}")`);

  console.log('--- after the strike, up to see the whole table');
  await aimAt(0.6); await ev(() => __rr.shoot());
  let up = await risen();
  ok(up.mode === 'shot' && up.state === 'moving' && Math.abs(up.pitch - 60 * Math.PI / 180) < 0.03 && Math.abs(Math.cos(up.yaw)) < 0.03,
    `the view rises high above a long side, 60 degrees down (${JSON.stringify(up)})`);
  ok(up.frame > 0.6 && up.frame <= 1, `the whole table is on screen, filling it (its corners reach ${up.frame.toFixed(2)} of the way to the edge)`);
  ok(up.away, 'the spin and power panel and the buttons on the left fade meanwhile');
  await settle(); await sleep(200); const back = await cam();
  ok(back.mode === before.mode && back.back, 'and once the balls stop, your view and the buttons come back');
  await ev(() => __rr.toggleTop()); await aimAt(0.6); await ev(() => __rr.shoot());
  up = await risen();
  ok(up.mode === 'shot' && up.pitch > 1.5, `a shot played from the overhead view rises back to the overhead view (pitch ${up.pitch.toFixed(2)})`);
  await settle(); await sleep(200); ok((await cam()).mode === 'top', 'and stays there once the balls stop');
  await ev(() => __rr.toggleTop());

  console.log('--- moving the camera during the shot keeps your view');
  await ev(() => __rr.toggleTop()); await aimAt(0.3); await ev(() => __rr.shoot()); await sleep(500);
  ok((await cam()).mode === 'shot', 'from the overhead view too');
  await ev(() => __rr.cam.orbit(40, 0)); await settle(); await sleep(200);
  ok((await cam()).mode === 'free', 'dragging the view mid-shot keeps it where you put it, rather than going back to overhead');

  console.log('--- the Settings switch');
  await p.click('#bPause'); await sleep(250);
  ok(await p.textContent('#sShotCam') === 'On', 'Settings has a Shot camera switch, on by default');
  await p.click('#sShotCam'); await sleep(150);
  ok(await p.textContent('#sShotCam') === 'Off' && await ev(() => JSON.parse(localStorage.getItem('retroRack.settings')).shotCam === false), 'switching it off is saved');
  await p.keyboard.press('Escape'); await sleep(250); await aimAt(0.3); await ev(() => __rr.shoot()); await sleep(100);
  ok((await cam()).mode !== 'shot' && ['stroke', 'moving'].includes((await cam()).state), 'with it off, the view stays put and the stroke starts at once');
  await settle(); await ev(() => { __rr.S.shotCam = true; });

  console.log('--- the computer\'s shots keep the normal view');
  await start('8ball', 'bot'); await settle(); await aimAt(0.1);
  await ev(() => { const r = __rr; r.aim.phi += Math.PI; });   // away from every ball: a foul, so the computer plays next
  await ev(() => __rr.shoot()); await sleep(400);
  ok((await cam()).mode === 'shot', 'your shot against the computer gets it');
  let cpuShot = false, cpuShots = 0;
  for (let t = 0; t < 40000 && cpuShots < 1; t += 100) {
    const c = await cam();
    if ((c.state === 'stroke' || c.state === 'moving') && c.turn === 1) { cpuShots += c.state === 'moving' ? 1 : 0; if (c.mode === 'shot') cpuShot = true; }   // one reading, so your own shot ending between two can't count
    await sleep(100);
  }
  ok(cpuShots > 0 && !cpuShot, `the computer's shot doesn't (${cpuShots ? 'watched it play' : 'it never played'})`);

  console.log('--- reduced motion');
  const q = await page({ reducedMotion: 'reduce' });
  await q.evaluate(() => { const r = __rr; r.M.mode = 'practice'; r.M.opp = 'friend'; r.startGame(); }); await q.waitForTimeout(1500);
  await q.evaluate(() => { const r = __rr, c = r.world.balls[0], o = r.world.balls.find(x => x.id); r.game.ballInHand = false; r.aim.phi = Math.atan2(o.z - c.z, o.x - c.x); r.aim.power = 0.3; r.shoot(); });
  await q.waitForTimeout(100);
  ok(await q.evaluate(() => __rr.cam.mode !== 'shot' && __rr.state !== 'set'), 'with reduced motion the view doesn\'t swing, and the stroke starts at once');

  ok(log.length === 0, 'console clean' + (log.length ? ': ' + log.join(' | ') : ''));
  await b.close();
})();
