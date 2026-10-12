// The shot camera: your own shot swings the view down to your eyes behind the cue and back once the balls stop; not for
// the computer's shots, not with the Settings switch off or with reduced motion, and moving the camera yourself keeps it.
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
  const cam = () => ev(() => ({ mode: __rr.cam.mode, pitch: __rr.cam.cur.pitch, dist: __rr.cam.cur.dist, state: __rr.state }));
  const settle = () => until(() => ev(() => __rr.state === 'aim'));

  console.log('--- your own shot');
  await start('practice', 'friend'); await settle(); await aimAt(0.3);
  const before = await cam();
  await ev(() => __rr.beginStroke()); await sleep(700);
  const mid = await cam();
  ok(mid.mode === 'shot' && Math.abs(mid.pitch - 0.24) < 0.08 && Math.abs(mid.dist - 0.62) < 0.2, `shooting swings the view down behind the cue (${JSON.stringify(mid)})`);
  await settle(); await sleep(200);
  ok((await cam()).mode === before.mode, `once the balls stop it goes back to the view you had ("${before.mode}")`);

  console.log('--- moving the camera during the shot keeps your view');
  await ev(() => __rr.toggleTop()); await aimAt(0.3); await ev(() => __rr.beginStroke()); await sleep(500);
  ok((await cam()).mode === 'shot', 'from the overhead view too');
  await ev(() => __rr.cam.orbit(40, 0)); await settle(); await sleep(200);
  ok((await cam()).mode === 'free', 'dragging the view mid-shot keeps it where you put it, rather than going back to overhead');

  console.log('--- the Settings switch');
  await p.click('#bPause'); await sleep(250);
  ok(await p.textContent('#sShotCam') === 'On', 'Settings has a Shot camera switch, on by default');
  await p.click('#sShotCam'); await sleep(150);
  ok(await p.textContent('#sShotCam') === 'Off' && await ev(() => JSON.parse(localStorage.getItem('retroRack.settings')).shotCam === false), 'switching it off is saved');
  await p.keyboard.press('Escape'); await sleep(250); await aimAt(0.3); await ev(() => __rr.beginStroke()); await sleep(600);
  ok((await cam()).mode !== 'shot', 'with it off, the view stays put');
  await settle(); await ev(() => { __rr.S.shotCam = true; });

  console.log('--- the computer\'s shots keep the normal view');
  await start('8ball', 'bot'); await settle(); await aimAt(0.1);
  await ev(() => { const r = __rr; r.aim.phi += Math.PI; });   // away from every ball: a foul, so the computer plays next
  await ev(() => __rr.beginStroke()); await sleep(400);
  ok((await cam()).mode === 'shot', 'your shot against the computer gets it');
  let cpuShot = false, cpuShots = 0;
  for (let t = 0; t < 40000 && cpuShots < 1; t += 100) {
    const c = await cam();
    if (c.state === 'stroke' || c.state === 'moving') { if (await ev(() => __rr.game.turn === 1)) { cpuShots += c.state === 'moving' ? 1 : 0; if (c.mode === 'shot') cpuShot = true; } }
    await sleep(100);
  }
  ok(cpuShots > 0 && !cpuShot, `the computer's shot doesn't (${cpuShots ? 'watched it play' : 'it never played'})`);

  console.log('--- reduced motion');
  const q = await page({ reducedMotion: 'reduce' });
  await q.evaluate(() => { const r = __rr; r.M.mode = 'practice'; r.M.opp = 'friend'; r.startGame(); }); await q.waitForTimeout(1500);
  await q.evaluate(() => { const r = __rr, c = r.world.balls[0], o = r.world.balls.find(x => x.id); r.game.ballInHand = false; r.aim.phi = Math.atan2(o.z - c.z, o.x - c.x); r.aim.power = 0.3; r.beginStroke(); });
  await q.waitForTimeout(600);
  ok(await q.evaluate(() => __rr.cam.mode !== 'shot'), 'with reduced motion the view doesn\'t swing');

  ok(log.length === 0, 'console clean' + (log.length ? ': ' + log.join(' | ') : ''));
  await b.close();
})();
