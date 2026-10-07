// Behaviour of the "you're on" markers in every mode, plus the Settings switch.
const { chromium, FILE } = require('./lib');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 480, height: 360 } });
  const p = await ctx.newPage(); const log = [];
  p.on('console', m => { if (!/GPU stall/.test(m.text())) log.push(`[${m.type()}] ${m.text()}`); });
  p.on('pageerror', e => log.push(`[pageerror] ${e.message}`));
  await p.goto(FILE); await p.waitForTimeout(1500);
  const ev = (f, a) => p.evaluate(f, a);
  const marked = async () => { await p.waitForTimeout(150); return ev(() => window.__rr.marked()); };
  const settle = async (states = ['aim', 'over']) => { let s; for (let i = 0; i < 150; i++) { await p.waitForTimeout(400); s = await ev(() => window.__rr.state); if (states.includes(s)) return s; } return s; };
  const start = async (mode, opp = 'friend') => { await ev(([m, o]) => { const r = window.__rr; r.M.mode = m; r.M.opp = o; r.startGame(); }, [mode, opp]); await p.waitForTimeout(400); };
  const give = g => ev(g => { const r = window.__rr, o = g === 'solids' ? 'stripes' : 'solids'; r.game.breakShot = false; r.game.groups = r.game.turn === 0 ? [g, o] : [o, g]; }, g);
  const onTable = f => ev(f => window.__rr.world.balls.filter(b => !b.potted && b.id !== 0).map(b => b.id).filter(new Function('id', 'return ' + f)), f);

  await start('8ball');
  ok((await marked()).length === 0, '8-ball: nothing marked on the break');
  await ev(() => window.__rr.beginStroke()); await settle();
  await ev(() => { window.__rr.game.groups = [null, null]; window.__rr.game.breakShot = false; });
  ok((await marked()).length === 0, '8-ball: nothing marked on an open table');
  await give('solids');
  ok(JSON.stringify(await marked()) === JSON.stringify(await onTable('id >= 1 && id <= 7')), `8-ball: exactly the shooter's solids are marked (${await marked()})`);
  await give('stripes');
  ok(JSON.stringify(await marked()) === JSON.stringify(await onTable('id >= 9')), `8-ball: switch to stripes, exactly the stripes are marked (${await marked()})`);
  await ev(() => { window.__rr.game.ballInHand = true; });
  ok((await marked()).length > 0, '8-ball: still marked with ball in hand');
  await ev(() => { window.__rr.game.ballInHand = false; for (const b of window.__rr.world.balls) if (b.id >= 9) b.potted = true; });
  ok(JSON.stringify(await marked()) === '[8]', `8-ball: group cleared, only the 8 is marked (${await marked()})`);

  await start('uk8'); await ev(() => window.__rr.beginStroke()); await settle(); await give('solids');
  const reds = await marked();
  ok(reds.length > 0 && reds.every(id => id >= 1 && id <= 7), `reds & yellows: the shooter's colour is marked (${reds})`);
  await ev(() => { window.__rr.game.freeShot = true; window.__rr.game.visits = 2; });
  ok(JSON.stringify(await marked()) === JSON.stringify(reds), 'reds & yellows: a free ball still marks your own colour');

  await start('9ball'); await ev(() => window.__rr.beginStroke()); await settle();
  const low = Math.min(...await onTable('true'));
  ok(JSON.stringify(await marked()) === JSON.stringify([low]), `9-ball: only the lowest ball (${low}) is marked`);

  await start('practice');
  ok((await marked()).length === 0, 'practice: nothing marked');

  console.log('--- against the CPU');
  await start('8ball', 'bot');
  await ev(() => window.__rr.beginStroke());
  // play until the CPU has the table, giving groups so there would be something to mark
  let sawCpu = false, cpuMarked = 0;
  for (let i = 0; i < 200 && !sawCpu; i++) {
    await p.waitForTimeout(250);
    const s = await ev(() => window.__rr.state);
    if (s === 'aim') { await give('solids'); await ev(() => window.__rr.beginStroke()); }
    if (s === 'botThink' || s === 'botAim') { sawCpu = true; await give('solids'); cpuMarked = (await marked()).length; }
  }
  ok(sawCpu && cpuMarked === 0, "nothing is marked while it's the CPU's turn");
  const s2 = await settle(['aim', 'over']);
  if (s2 === 'aim') { await give('solids'); ok((await marked()).length > 0, 'markers come back on your turn'); }

  console.log('--- replay and the Settings switch');
  await start('8ball'); await ev(() => window.__rr.beginStroke()); await settle(); await give('solids');
  await p.keyboard.press('v'); await p.waitForTimeout(300);
  ok(await ev(() => !!window.__rr.replay) && (await marked()).length === 0, 'nothing marked during a replay');
  for (let i = 0; i < 100 && await ev(() => !!window.__rr.replay); i++) await p.waitForTimeout(300);
  ok((await marked()).length > 0, 'markers back after the replay');
  await p.click('#bPause'); await p.waitForTimeout(200);
  ok((await p.textContent('#sMarkers')) === 'On', 'Settings shows Markers: On by default');
  await p.click('#sMarkers'); await p.waitForTimeout(100);
  ok((await p.textContent('#sMarkers')) === 'Off', 'the switch turns to Off');
  await p.click('#bResume'); await p.waitForTimeout(200);
  ok((await marked()).length === 0, 'switched off: nothing marked');
  await p.reload(); await p.waitForTimeout(1500);
  ok(await ev(() => window.__rr.S.markers === false), 'the choice is remembered after a reload');
  await ev(() => { window.__rr.S.markers = true; localStorage.setItem('retroRack.settings', JSON.stringify(window.__rr.S)); });
  ok(!log.length, 'console clean' + (log.length ? ':\n  ' + log.join('\n  ') : ''));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
