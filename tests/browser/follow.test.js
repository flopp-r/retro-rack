// Following the next shot: after a shot, when it's your turn and you're in the free view, the camera glides to just
// behind the cue ball, looking along the line to the ball the cue points at, with both on screen below the scoreboard;
// also when you'd moved the view mid-shot (a player's report: the view stayed parked on the last ball). Cue view and the
// overhead view are left alone, it has a Settings switch, it waits for your turn against the computer, and with reduced
// motion it's there at once. On a phone held sideways, where the HUD takes the most room.
const { chromium, FILE } = require('./lib');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
(async () => {
  const b = await chromium.launch({ args: ARGS }), log = [];
  const page = async opts => {
    const p = await b.newPage({ viewport: { width: 762, height: 341 }, ...opts });
    p.on('console', m => { if (!/GPU stall/.test(m.text())) log.push(`[${m.type()}] ${m.text()}`); }); p.on('pageerror', e => log.push(`[pageerror] ${e.message}`));
    await p.goto(FILE); await p.waitForTimeout(1200); return p;
  };
  const run = async p => {
    const ev = (f, a) => p.evaluate(f, a), sleep = ms => p.waitForTimeout(ms);
    const until = async (f, ms = 30000) => { for (let t = 0; t < ms; t += 200) { if (await f()) return true; await sleep(200); } return false; };
    const settle = () => until(() => ev(() => __rr.state === 'aim'));
    // the 1 a short way from the top right corner pocket with the cue ball behind it on the same line, the 2 far away
    // (checked with the physics: a soft stun shot pots the 1 and leaves the cue ball on the table)
    const layout = () => ev(() => {
      const r = __rr, put = (id, x, z) => Object.assign(r.world.balls.find(q => q.id === id), { x, z });
      for (const q of r.world.balls) Object.assign(q, { vx: 0, vz: 0, wx: 0, wy: 0, wz: 0, potted: q.id > 2 });
      put(0, 0.555, -0.08); put(1, 0.955, 0.32); put(2, -0.7, -0.3); r.syncBallMeshes();
      Object.assign(r.game, { ballInHand: false, breakShot: false }); Object.assign(r.aim, { phi: Math.PI / 4, power: 0.3, sx: 0, sy: -0.5 });
    });
    const view = () => ev(() => {
      const r = __rr, c = r.world.balls[0], t = r.world.balls.find(q => q.id === 2), g = r.cam.goal();
      return { mode: r.cam.mode, yaw: r.cam.cur.yaw, phi: Math.atan2(t.z - c.z, t.x - c.x), cue: r.ballScreen(0), tgt: r.ballScreen(2), top: document.querySelector('#board').getBoundingClientRect().bottom,
        w: innerWidth, h: innerHeight, free: JSON.stringify(r.cam.free), potted: r.world.balls.find(q => q.id === 1).potted, faded: ['#shot', '#tools'].some(q => document.querySelector(q).classList.contains('away')), there: Math.abs(r.cam.cur.dist - g.dist) < 1e-6 && Math.cos(r.cam.cur.yaw - g.yaw) > 0.99999 };
    });
    const behind = v => Math.cos(v.yaw - (v.phi + Math.PI)) > 0.995;
    const seen = v => [v.cue, v.tgt].every(([x, y]) => x > 0 && x < v.w && y > v.top && y < v.h) && v.cue[1] > v.tgt[1];
    const shot = async (mid) => { await layout(); await ev(() => __rr.shoot()); if (mid) { await until(() => ev(() => __rr.state === 'moving'), 5000); await mid(); } await sleep(300); await settle(); };
    return { ev, sleep, until, settle, layout, view, behind, seen, shot };
  };

  const p = await page(), t = await run(p);
  await t.ev(() => { const r = __rr; r.M.mode = 'practice'; r.M.opp = 'friend'; r.M.rack = '8ball'; r.startGame(); }); await t.settle();

  console.log('--- after a pot, the view goes to the next ball');
  let v0 = await t.view(); await t.shot(); await t.sleep(1500); let v = await t.view();
  ok(v0.mode === 'free' && v.potted && v.mode === 'free', `the 1 went in, and it's still the free view (${v.mode})`);
  ok(t.behind(v), `the camera is behind the cue ball, looking along the line to the 2 (${(v.yaw * 180 / Math.PI).toFixed(1)}°)`);
  ok(t.seen(v), `the cue ball and the 2 are both on screen, below the scoreboard, the cue ball nearer (cue ${v.cue.map(Math.round)}, 2 ${v.tgt.map(Math.round)}, scoreboard to ${Math.round(v.top)})`);

  console.log('--- the report: the view moved mid-shot, close to the ball being hit');
  await t.shot(() => t.ev(() => __rr.cam.orbit(60, 0))); await t.sleep(1500); v = await t.view();
  ok(v.mode === 'free' && t.behind(v) && t.seen(v), 'it still goes to the next shot, rather than staying parked on the last ball');
  ok(!v.faded, 'and the buttons are back, not left faded');

  console.log('--- Cue view and the overhead view are left alone');
  await t.ev(() => __rr.toggleAimCam()); await t.shot(); v = await t.view();
  ok(v.mode === 'aim', `Cue view stays Cue view (${v.mode}), which already follows`);
  await t.ev(() => __rr.toggleAimCam()); await t.ev(() => __rr.toggleTop()); await t.shot(); v = await t.view();
  ok(v.mode === 'top', `the overhead view stays overhead (${v.mode})`);
  await t.ev(() => __rr.toggleTop()); await t.sleep(300);

  console.log('--- the Settings switch');
  await p.click('#bPause'); await t.sleep(250);
  ok(await p.textContent('#sFollow') === 'On', 'Settings has a Follow next shot switch, on by default');
  await p.click('#sFollow'); await t.sleep(150);
  ok(await p.textContent('#sFollow') === 'Off' && await t.ev(() => JSON.parse(localStorage.getItem('retroRack.settings')).follow === false), 'switching it off is saved');
  await p.keyboard.press('Escape'); await t.sleep(250);
  await t.ev(() => { Object.assign(__rr.cam.free, { yaw: 0.3, pitch: 0.7, dist: 3, tx: 0, tz: 0 }); }); v0 = await t.view(); await t.shot(); v = await t.view();
  ok(v.free === v0.free, 'with it off, the free view stays where it was');
  await t.ev(() => { __rr.S.follow = true; });

  console.log('--- against the computer, only your turns');
  await t.ev(() => { const r = __rr; r.M.mode = '8ball'; r.M.opp = 'bot'; r.M.diff = 'easy'; r.startGame(); }); await t.settle();
  await t.ev(() => { const r = __rr; Object.assign(r.game, { ballInHand: false, breakShot: false }); r.aim.phi += Math.PI; r.aim.power = 0.1; r.aim.sx = r.aim.sy = 0; });   // away from every ball: a foul
  v0 = await t.view(); await t.ev(() => __rr.shoot());
  ok(await t.until(() => t.ev(() => __rr.game.turn === 1 && ['botThink', 'botAim'].includes(__rr.state))), 'the computer is to play');
  v = await t.view();
  ok(v.free === v0.free, 'and while it lines up, your view stays put');
  ok(await t.until(() => t.ev(() => __rr.game.turn === 0 && __rr.state === 'aim'), 120000), 'back to you');
  await t.sleep(1500);
  const you = await t.ev(() => { const r = __rr; return { cos: Math.cos(r.cam.cur.yaw - (r.aim.phi + Math.PI)), mode: r.cam.mode }; });
  ok(you.mode === 'free' && you.cos > 0.995, `then it goes behind the cue ball for your shot (${you.mode})`);

  console.log('--- reduced motion: there at once');
  const q = await page({ reducedMotion: 'reduce' }), u = await run(q);
  await u.ev(() => { const r = __rr; r.M.mode = 'practice'; r.M.opp = 'friend'; r.M.rack = '8ball'; r.startGame(); }); await u.settle();
  await u.layout(); await u.ev(() => __rr.shoot());
  ok(await u.until(() => u.ev(() => { const r = __rr, g = r.cam.goal(); return r.state === 'aim' && r.world.balls.find(x => x.id === 1).potted && Math.abs(r.cam.cur.dist - g.dist) < 1e-6 && Math.cos(r.cam.cur.yaw - g.yaw) > 0.99999; })), 'the view is behind the cue ball the moment your turn starts, without a glide');
  v = await u.view(); ok(u.behind(v) && u.seen(v), 'with both balls in view');

  ok(log.length === 0, 'console clean' + (log.length ? ': ' + log.join(' | ') : ''));
  await b.close();
})();
