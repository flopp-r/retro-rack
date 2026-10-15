// The game's buttons on a phone: small icon squares (Shoot keeps its word), a long press shows a button's name; the small
// spin ball beside the power bar shows or hides the spin diagram (hidden at first on a phone, shown on a computer, the
// choice kept); sliding along the aim readout turns very finely, holding an aim arrow starts slowly, Ctrl + arrow turns
// 0.01°; Ctrl + ↑/↓ changes the speed by 0.01 m/s a press and sliding along the power readout sets it finely; and the
// Controls panel's keys can be tapped (the ones written with Ctrl do the fine step). Over http, so the spin choice survives a reload.
const { chromium, SITE } = require('./lib');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const DEG = Math.PI / 180;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] }), log = [];
  const page = async (w, h) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript(() => { try { localStorage.setItem('retroRack.rotateHint', 'off'); } catch (e) {} });
    const p = await ctx.newPage();
    p.on('console', m => { if (!/GPU stall/.test(m.text())) log.push(`${w}x${h} [${m.type()}] ${m.text()}`); }); p.on('pageerror', e => log.push(`${w}x${h} [pageerror] ${e.message}`));
    await p.goto(SITE.new); await p.waitForTimeout(1200); return p;
  };
  const start = p => p.evaluate(() => { const r = __rr; r.M.mode = 'practice'; r.M.opp = 'friend'; r.M.rack = '8ball'; r.startGame(); });
  const settle = async p => { for (let i = 0; i < 100; i++) { if (await p.evaluate(() => __rr.state === 'aim')) return true; await p.waitForTimeout(200); } return false; };
  const phi = p => p.evaluate(() => __rr.aim.phi / (Math.PI / 180));

  console.log('--- a phone on its side: icon squares');
  const p = await page(762, 341); await start(p); await settle(p);
  await p.evaluate(() => { document.querySelector('#bReplay').hidden = false; });
  const icons = await p.evaluate(() => [...document.querySelectorAll('#tools .btn:not([hidden]), #practice > .btn:not([hidden])')].map(el => {
    const r = el.getBoundingClientRect(), svg = el.querySelector('svg'), lab = el.querySelector('.lab');
    return { id: el.id, w: Math.round(r.width), h: Math.round(r.height), svg: !!svg && getComputedStyle(svg).display !== 'none', words: !!lab && getComputedStyle(lab).display !== 'none', name: el.getAttribute('aria-label') };
  }));
  ok(icons.length >= 9 && icons.every(i => i.svg && !i.words && i.name && Math.abs(i.w - 34) <= 1 && Math.abs(i.h - 34) <= 1), `every button on the left is a 34 px square with a picture and no words (${icons.map(i => `${i.id} ${i.w}x${i.h}`).join(', ')})`);
  const shootTxt = await p.evaluate(() => { const s = document.querySelector('#bShoot'); return !s.querySelector('svg') && s.textContent.trim(); });
  ok(shootTxt === 'Shoot', 'Shoot keeps its word');
  const aimArrows = await p.evaluate(() => ['#bAimL', '#bAimR'].every(q => getComputedStyle(document.querySelector(q + ' svg')).display !== 'none'));
  ok(aimArrows, 'the aim arrows are pixel arrows too');
  // a long press shows the name, and doesn't press the button
  const cam0 = await p.evaluate(() => __rr.cam.mode), r = await p.locator('#bCam').boundingBox();
  await p.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await p.mouse.down(); await p.waitForTimeout(650);
  const tip = await p.evaluate(() => { const t = document.querySelector('#ibTip'); return !t.hidden && t.textContent; });
  await p.mouse.up(); await p.waitForTimeout(150);
  ok(tip === 'Cue view' && await p.evaluate(() => __rr.cam.mode) === cam0, `a long press shows the button's name ("${tip}") without pressing it`);
  await p.waitForTimeout(1000);
  ok(await p.evaluate(() => document.querySelector('#ibTip').hidden), 'and the name goes away again');
  await p.click('#bCam'); await p.waitForTimeout(150);
  ok(await p.evaluate(() => __rr.cam.mode) === 'aim', 'a quick tap presses it (Cue view)');
  await p.click('#bCam'); await p.waitForTimeout(150);

  console.log('--- the spin diagram');
  const spin = () => p.evaluate(() => ({ closed: document.querySelector('#shot').classList.contains('noSpin'), w: Math.round(document.querySelector('#shot').getBoundingClientRect().width), saved: JSON.parse(localStorage.getItem('retroRack.settings') || '{}').spinOpen }));
  const s0 = await spin();
  ok(s0.closed, `on a phone it starts hidden, with the small ball beside the power bar (panel ${s0.w} px wide)`);
  const mini0 = await p.evaluate(() => document.querySelector('#spinMini').toDataURL());
  await p.keyboard.press('KeyI'); await p.waitForTimeout(100);
  ok(await p.evaluate(() => document.querySelector('#spinMini').toDataURL()) !== mini0, 'the small ball shows where the tip will strike (I adds follow and it moves)');
  await p.keyboard.press('KeyO');
  await p.click('#bSpin'); await p.waitForTimeout(200); const s1 = await spin();
  ok(!s1.closed && s1.saved === true && s1.w > s0.w, `tapping the small ball shows the diagram, and the choice is kept (panel ${s1.w} px wide)`);
  await p.reload(); await p.waitForTimeout(1200); await start(p); await settle(p);
  ok(!(await spin()).closed, 'it stays shown after a reload');
  await p.click('#bSpin'); await p.waitForTimeout(150);
  ok((await spin()).closed, 'and a tap hides it again');

  console.log('--- fine aim');
  await p.evaluate(() => { __rr.aim.phi = 0; });
  const a = await p.locator('#aimTxt').boundingBox(), y = a.y + a.height / 2;
  await p.mouse.move(a.x + 10, y); await p.mouse.down(); await p.mouse.move(a.x + 30, y, { steps: 4 }); await p.mouse.move(a.x + 50, y, { steps: 4 }); await p.mouse.up();
  let d = await phi(p);
  ok(Math.abs(d - 0.1) < 0.006, `sliding 40 px right along the aim readout turns the aim 0.1° right (${d.toFixed(4)}°)`);
  await p.mouse.move(a.x + 50, y); await p.mouse.down(); await p.mouse.move(a.x + 46, y, { steps: 2 }); await p.mouse.up();
  ok(Math.abs(await phi(p) - d + 0.01) < 0.002, 'and 4 px back turns it 0.01° back');
  await p.evaluate(() => { __rr.aim.phi = 0; });
  await p.keyboard.down('Control'); await p.keyboard.press('ArrowRight'); await p.keyboard.up('Control');
  ok(Math.abs(await phi(p) - 0.01) < 1e-6, 'Ctrl + → turns 0.01°');
  await p.keyboard.press('ArrowRight');
  ok(Math.abs(await phi(p) - 0.06) < 1e-6, '→ alone still turns 0.05°');
  await p.evaluate(() => { __rr.aim.phi = 0; });
  const ar = await p.locator('#bAimR').boundingBox();
  await p.mouse.move(ar.x + ar.width / 2, ar.y + ar.height / 2); await p.mouse.down(); await p.waitForTimeout(1000); await p.mouse.up();
  d = await phi(p);
  ok(d > 0.1 && d < 1.5, `holding an aim arrow for a second starts slowly (${d.toFixed(2)}°; it used to be about 6°)`);

  console.log('--- fine power');
  const spd = () => p.evaluate(() => document.querySelector('#powTxt').textContent);
  const ctrlKey = async (...ks) => { await p.keyboard.down('Control'); for (const k of ks) await p.keyboard.press(k); await p.keyboard.up('Control'); await p.waitForTimeout(100); };
  await p.evaluate(() => { const r = __rr; r.aim.power = 0.5; r.aim.sx = r.aim.sy = 0; });   // 2.848 m/s, shown as 2.85
  await ctrlKey('ArrowUp'); const f1 = await spd(); await ctrlKey('ArrowDown', 'ArrowDown');
  ok(f1 === '2.86 m/s' && await spd() === '2.84 m/s', `Ctrl + ↑ adds exactly 0.01 m/s (2.85 → ${f1}), Ctrl + ↓ takes it off (twice: ${await spd()})`);
  await p.keyboard.down('Control'); await p.keyboard.down('ArrowUp'); await p.waitForTimeout(1000); await p.keyboard.up('ArrowUp'); await p.keyboard.up('Control'); await p.waitForTimeout(100);
  ok(await spd() === '2.85 m/s', `holding Ctrl + ↑ for a second is still one step (${await spd()})`);
  await p.keyboard.down('ArrowUp'); await p.waitForTimeout(400); await p.keyboard.up('ArrowUp');
  ok(parseFloat(await spd()) > 3.2, `↑ held without Ctrl still raises it smoothly (${await spd()})`);
  await p.evaluate(() => { const r = __rr; r.aim.power = 0.5; r.aim.sx = 0; r.aim.sy = -0.8; });   // screw back: the same power gives less speed
  await ctrlKey('ArrowUp'); const d0 = await spd(); await ctrlKey('ArrowUp', 'ArrowUp', 'ArrowUp');
  ok(Math.round((parseFloat(await spd()) - parseFloat(d0)) * 100) === 3, `with spin on too, three presses add 0.03 m/s (${d0} → ${await spd()})`);
  await p.evaluate(() => { const r = __rr; r.aim.power = 1; r.aim.sx = r.aim.sy = 0; }); await ctrlKey('ArrowUp');
  const top = await spd(); await p.evaluate(() => { __rr.aim.power = 0.02; }); await ctrlKey('ArrowDown');
  ok(top === '9.01 m/s' && await spd() === '0.12 m/s', `it stops at the hardest and softest shots (${top}, ${await spd()})`);
  await p.evaluate(() => { const r = __rr; r.aim.power = 0.5; r.aim.sx = r.aim.sy = 0; });
  const pt = await p.locator('#powTxt').boundingBox(), py = pt.y + pt.height / 2;
  await p.mouse.move(pt.x + 5, py); await p.mouse.down(); await p.mouse.move(pt.x + 25, py, { steps: 4 }); await p.mouse.move(pt.x + 45, py, { steps: 4 }); await p.mouse.up();
  const sl = await spd();
  await p.mouse.move(pt.x + 45, py); await p.mouse.down(); await p.mouse.move(pt.x + 37, py, { steps: 2 }); await p.mouse.up();
  ok(sl === '2.95 m/s' && await spd() === '2.93 m/s', `sliding 40 px right along the power readout adds 0.10 m/s (2.85 → ${sl}), 8 px back takes 0.02 off (${await spd()})`);

  console.log('--- the Controls panel\'s keys');
  const help = () => p.evaluate(() => !document.querySelector('#help').hidden);
  const tap = async k => { await p.click(`#help kbd[data-k="${k}"] >> nth=0`); await p.waitForTimeout(150); };
  await p.evaluate(() => { const r = __rr; r.aim.phi = 0; r.aim.power = 0.4; r.aim.sx = r.aim.sy = 0; });
  await p.click('#bHelp'); await p.waitForTimeout(150);
  ok(await help() && await p.evaluate(() => [...document.querySelectorAll('#help kbd.tap')].length >= 20), 'every key in the panel can be tapped (Shift, Ctrl and Alt aside)');
  await tap('ArrowRight');
  ok(await help() && Math.abs(await phi(p) - 0.05) < 1e-6, '→ turns the aim 0.05° and the panel stays open');
  await tap('ArrowUp');
  ok(await help() && Math.abs(await p.evaluate(() => __rr.aim.power) - 0.425) < 1e-6, '↑ adds a little power, the panel still open');
  const t0 = parseFloat(await spd()); await p.click('#help kbd[data-k="ArrowUp"][data-ctrl]'); await p.waitForTimeout(150);
  ok(await help() && Math.round((parseFloat(await spd()) - t0) * 100) === 1, `Fine power's ↑ adds 0.01 m/s (${t0} → ${await spd()})`);
  await p.click('#help kbd[data-k="ArrowRight"][data-ctrl]'); await p.waitForTimeout(150);
  ok(await help() && Math.abs(await phi(p) - 0.06) < 1e-6, 'and fine aim\'s Ctrl → turns 0.01°');
  await tap('KeyI'); const sy = await p.evaluate(() => __rr.aim.sy); await tap('KeyO');
  ok(await help() && sy > 0 && await p.evaluate(() => __rr.aim.sy === 0 && __rr.aim.sx === 0), 'I adds follow and O puts it back to the centre');
  await tap('KeyC');
  ok(!(await help()) && await p.evaluate(() => __rr.cam.mode) === 'aim', 'C closes the panel and switches to Cue view');
  await p.click('#bHelp'); await p.waitForTimeout(150); await tap('KeyT');
  ok(!(await help()) && await p.evaluate(() => __rr.cam.mode) === 'top', 'T: the overhead view');
  await p.click('#bHelp'); await p.waitForTimeout(150); await tap('KeyB');
  const bih = await p.evaluate(() => __rr.game.ballInHand);
  await p.click('#bHelp'); await p.waitForTimeout(150); await tap('KeyB');
  ok(bih !== await p.evaluate(() => __rr.game.ballInHand), 'B switches ball in hand (practice)');
  await p.click('#bHelp'); await p.waitForTimeout(150); await tap('Space');
  ok(!(await help()) && await p.evaluate(() => ['set', 'stroke', 'moving'].includes(__rr.state)), 'Space closes the panel and plays the shot');

  console.log('--- a computer: words, and the diagram shown');
  const q = await page(1280, 720); await start(q); await settle(q);
  const pc = await q.evaluate(() => ({ closed: document.querySelector('#shot').classList.contains('noSpin'), words: getComputedStyle(document.querySelector('#bCam .lab')).display !== 'none', svg: getComputedStyle(document.querySelector('#bCam svg')).display !== 'none', text: document.querySelector('#bCam').textContent }));
  ok(!pc.closed && pc.words && !pc.svg && pc.text === 'Cue view', 'on a computer the buttons keep their words and the spin diagram starts shown');

  ok(log.length === 0, 'console clean' + (log.length ? ': ' + log.join(' | ') : ''));
  await b.close();
})();
