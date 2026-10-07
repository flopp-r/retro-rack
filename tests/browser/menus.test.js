// Every route through the menus, back navigation (button, Esc, browser/phone back), Play again, and online.
const { chromium, SITE } = require('./lib');
const BASE = SITE.new + '?relay=ws://127.0.0.1:8787';
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const logs = [];
let b;
async function win(name, size = { width: 1000, height: 640 }, opts = {}) {
  const ctx = await b.newContext({ viewport: size, ...opts });
  await ctx.addInitScript(n => { try { localStorage.setItem('retroRack.name', n); localStorage.setItem('retroRack.rotateHint', 'off'); } catch (e) {} }, name);
  const p = await ctx.newPage();
  p.on('console', m => { if (!/GPU stall/.test(m.text())) logs.push(`${name} [${m.type()}] ${m.text()}`); });
  p.on('pageerror', e => logs.push(`${name} [pageerror] ${e.message}`));
  return p;
}
const screen = p => p.evaluate(() => { const s = [...document.querySelector('#menuPanel').querySelectorAll('.mScreen')].filter(x => !x.hidden); return s.map(x => x.id.slice(3)).join(','); });
const st = p => p.evaluate(() => ({ state: window.__rr.state, mode: window.__rr.M.mode, opp: window.__rr.M.opp, diff: window.__rr.M.diff, rack: window.__rr.M.rack, paused: !document.querySelector('#pause').hidden }));
const go = async (p, sel) => { await p.click(sel); await sleep(350); };

(async () => {
  b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await win('Solo');
  await p.goto('about:blank'); await p.goto(BASE); await sleep(1200);

  console.log('--- home');
  ok(await screen(p) === 'home', 'starts on the home screen');
  ok(await p.isHidden('#bQuick'), 'no "Play again" before any game');
  ok(await p.isHidden('#mTop'), 'no Back button on the home screen');

  console.log('--- single player, vs computer');
  await go(p, '[data-go="single"]');
  ok(await screen(p) === 'single' && (await p.textContent('#mTitle')) === 'Single player', 'Single player screen, titled');
  await go(p, '[data-go="game"][data-opp="bot"]');
  ok(await screen(p) === 'game' && (await p.textContent('#mTitle')) === 'Choose a game', 'Choose a game screen');
  await go(p, '[data-mode="9ball"]');
  ok(await screen(p) === 'setup' && (await p.textContent('#mTitle')) === '9-ball v computer', 'setup screen: "9-ball v computer"');
  ok(await p.isVisible('#rowDiff') && await p.isHidden('#rowRoom') && await p.isVisible('#bStart'), 'shows Skill, no Room choice, and the Rack \'em up button');
  ok(await p.evaluate(() => window.__rr.world.balls.filter(b => b.id).length) === 9, 'the table behind shows a 9-ball rack');
  await p.click('#mDiff .btn:nth-child(3)');   // Hard
  await go(p, '#bStart');
  let s = await st(p);
  ok(s.state === 'aim' && s.mode === '9ball' && s.opp === 'bot' && s.diff === 'hard', `Rack 'em up starts 9-ball v computer (Hard): ${JSON.stringify(s)}`);
  ok((await p.textContent('#p1 .pname')).includes('hard'), 'scoreboard says CPU (hard)');

  console.log('--- back gesture in a game, then Main menu');
  await p.goBack(); await sleep(300);
  ok((await st(p)).paused, 'phone/browser back in a game opens Pause');
  await p.goBack(); await sleep(300);
  ok(!(await st(p)).paused && p.url().startsWith(SITE.new), 'back again closes Pause and stays in the game');
  await p.click('#bPause'); await go(p, '#bQuit');
  ok(await screen(p) === 'home', 'Quit to menu lands on home');
  ok(await p.isVisible('#bQuick') && (await p.textContent('#bQuick')) === 'Play again: 9-ball v computer (Hard)', `Play again label: "${await p.textContent('#bQuick')}"`);
  await go(p, '#bQuick');
  s = await st(p);
  ok(s.state === 'aim' && s.mode === '9ball' && s.diff === 'hard', 'Play again starts the same setup in one tap');
  await p.click('#bPause'); await go(p, '#bQuit');

  console.log('--- back: button, Esc and the browser/phone back gesture');
  await go(p, '[data-go="single"]'); await go(p, '[data-go="game"][data-opp="bot"]'); await go(p, '[data-mode="8ball"]');
  ok(await screen(p) === 'setup', 'three screens deep');
  await go(p, '#mBack'); ok(await screen(p) === 'game', 'Back button: back one screen');
  await p.keyboard.press('Escape'); await sleep(350); ok(await screen(p) === 'single', 'Esc: back one screen');
  await go(p, '[data-go="game"][data-opp="bot"]');
  await p.goBack(); await sleep(400); ok(await screen(p) === 'single', 'browser/phone back: back one screen');
  await p.goBack(); await sleep(400); ok(await screen(p) === 'home', 'and again: home');
  await p.click('#bMenuSettings'); await sleep(200); await p.click('#bResume'); await sleep(500);
  ok(await p.evaluate(() => history.state === null), 'Settings from home closed with Done: nothing left armed, so a back gesture works first time');
  await p.click('#bMenuSettings'); await sleep(200);
  await p.goBack(); await sleep(400);
  ok(await p.isHidden('#pause') && p.url().startsWith(SITE.new), 'Settings from home: back closes Settings, still on the page');
  await p.goBack(); await sleep(600);
  ok(p.url() === 'about:blank', 'at home with nothing open, back leaves the page as normal (no dead presses)');
  await p.goForward(); await sleep(1500);

  console.log('--- the glide between screens');
  await p.click('[data-go="single"]'); await sleep(120);
  const mid = await p.evaluate(() => {
    const ghost = document.querySelector('.mGhost'), real = document.querySelector('#menuPanel');
    const x = el => Math.round(el.getBoundingClientRect().left);
    return { ghost: !!ghost, ghostShowsHome: !!ghost && !ghost.querySelector('#sc-home').hidden, realShowsSingle: !real.querySelector('#sc-single').hidden,
      ghostX: ghost ? x(ghost) : null, realX: x(real), moving: document.getAnimations().length };
  });
  ok(mid.ghost && mid.ghostShowsHome && mid.realShowsSingle && mid.moving >= 2, `mid-glide: the old panel (home) and the new one (Single player) are both moving (${JSON.stringify(mid)})`);
  ok(mid.ghostX < 40 && mid.realX > 300, 'the old panel is heading off to the left while the new one arrives from the right');
  await sleep(700);
  ok(await p.evaluate(() => !document.querySelector('.mGhost') && document.querySelector('#menuPanel').getBoundingClientRect().left < 80), 'afterwards the copy is gone and the new panel has settled in place');
  await p.click('#mBack'); await sleep(120);
  const back = await p.evaluate(() => ({ ghostX: Math.round(document.querySelector('.mGhost').getBoundingClientRect().left), realX: Math.round(document.querySelector('#menuPanel').getBoundingClientRect().left) }));
  ok(back.ghostX > 40 && back.realX < 0, `going back, it runs the other way (${JSON.stringify(back)})`);
  await sleep(700);

  console.log('--- practice');
  await go(p, '[data-go="single"]'); await go(p, '[data-go="practice"]');
  ok(await screen(p) === 'practice' && (await p.evaluate(() => document.querySelector('#menuPanel').querySelectorAll('#sc-practice .card').length)) === 5, 'Practice screen with 5 racks');
  await go(p, '[data-rack="trick"]');
  s = await st(p);
  ok(s.state === 'aim' && s.mode === 'practice' && s.rack === 'trick' && await p.isVisible('#trickInfo'), 'Trick shots starts straight away');
  await p.click('#bPause'); await go(p, '#bQuit');
  ok((await p.textContent('#bQuick')) === 'Play again: Practice, trick shots', `Play again label: "${await p.textContent('#bQuick')}"`);

  console.log('--- multiplayer, same device');
  await go(p, '[data-go="multi"]'); await go(p, '[data-go="game"][data-opp="friend"]'); await go(p, '[data-mode="uk8"]');
  ok((await p.textContent('#mTitle')) === 'Reds & yellows, same device' && await p.isHidden('#rowDiff'), 'setup: "Reds & yellows, same device", no Skill');
  ok(await p.evaluate(() => window.__rr.world.balls.length) === 16, 'the table behind switches (reds & yellows rack)');
  await go(p, '#bStart');
  s = await st(p);
  ok(s.state === 'aim' && s.mode === 'uk8' && s.opp === 'friend', 'Rack \'em up starts reds & yellows on one device');
  await p.click('#bPause'); await go(p, '#bQuit');

  console.log('--- online: create, list, join');
  await go(p, '[data-go="multi"]'); await go(p, '[data-go="online"]');
  ok(await screen(p) === 'online' && await p.isVisible('#bCreate'), 'Online screen with Create a room');
  for (let i = 0; i < 30 && (await p.textContent('#roomsLive')) !== 'Live'; i++) await sleep(300);
  ok((await p.textContent('#roomsLive')) === 'Live', 'open rooms list is live');
  await go(p, '#bCreate');
  ok(await screen(p) === 'game' && (await p.textContent('#mTitle')) === 'New room: choose a game', 'Create a room → choose a game');
  await go(p, '[data-mode="8ball"]');
  ok(await p.isVisible('#rowRoom') && await p.isHidden('#rowDiff') && (await p.textContent('#bStart')) === 'Create room', 'setup: Room choice, no Skill, "Create room"');
  await p.click('#mListed .btn:nth-child(1)');   // Listed
  await go(p, '#bStart'); await sleep(1500);
  const code = await p.textContent('#lobbyCode');
  ok((await st(p)).state === 'lobby' && /^[A-Z0-9]{5}$/.test(code), `waiting room open, code ${code}`);
  const q = await win('Friend');
  await q.goto(BASE); await sleep(1200);
  await go(q, '[data-go="multi"]'); await go(q, '[data-go="online"]');
  let listed = false;
  for (let i = 0; i < 30 && !listed; i++) { await sleep(300); listed = (await q.textContent('#roomList')).includes("Solo's room"); }
  ok(listed, 'the friend sees "Solo\'s room" in Open rooms');
  await q.click('#roomList .roomItem .btn');
  let both = false;
  for (let i = 0; i < 60 && !both; i++) { await sleep(300); both = (await st(p)).state !== 'lobby' && ['aim', 'remote'].includes((await st(q)).state); }
  ok(both, 'Join starts the game for both');
  const turn = await p.evaluate(() => window.__rr.game.turn), shooter = turn === await p.evaluate(() => window.__rr.NET.seat) ? p : q;
  await shooter.evaluate(() => window.__rr.beginStroke());
  let done = false;
  for (let i = 0; i < 300 && !done; i++) { await sleep(300); done = (await p.evaluate(() => window.__rr.NET.n)) === 1 && (await q.evaluate(() => window.__rr.NET.n)) === 1 && ['aim', 'remote', 'over'].includes((await st(p)).state) && ['aim', 'remote', 'over'].includes((await st(q)).state); }
  const tbl = x => x.evaluate(() => JSON.stringify(window.__rr.world.balls.map(b => [b.id, b.x, b.z, b.potted])));
  ok(done && await tbl(p) === await tbl(q), 'the break plays out identically in both windows');
  await q.click('#bPause'); await go(q, '#bQuit');
  ok(await screen(q) === 'online', 'leaving an online game lands back on the Online screen');

  console.log('--- the waiting room and the back gesture');
  await go(q, '#bCreate'); await go(q, '[data-mode="9ball"]'); await go(q, '#bStart'); await sleep(800);
  ok((await st(q)).state === 'lobby', 'in the waiting room');
  await q.goBack(); await sleep(600);
  ok((await st(q)).state === 'menu' && await screen(q) === 'online', 'back gesture cancels the waiting room, back to Online');

  console.log('--- phone on its side');
  const ph = await win('Phone', { width: 762, height: 341 }, { hasTouch: true, isMobile: true });
  await ph.goto(BASE); await sleep(1500);
  await ph.tap('[data-go="single"]'); await sleep(350); await ph.tap('[data-go="game"][data-opp="bot"]'); await sleep(350); await ph.tap('[data-mode="8ball"]'); await sleep(400);
  const inView = await ph.evaluate(() => { const r = document.querySelector('#bStart').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.width > 0; });
  ok(inView, "Rack 'em up is on screen without scrolling");
  await ph.tap('#bStart'); await sleep(500);
  ok((await st(ph)).state === 'aim', 'taps start a game on a phone');

  console.log('--- reduced motion');
  const rm = await win('Calm', { width: 1000, height: 640 }, { reducedMotion: 'reduce' });
  await rm.goto(BASE); await sleep(1200);
  await rm.click('[data-go="multi"]'); await sleep(30);
  ok(await rm.evaluate(() => document.querySelector('#sc-home').hidden && !document.querySelector('.mGhost') && document.getAnimations().length === 0), 'with "reduce motion" the screen changes instantly, no glide');

  ok(!logs.length, 'console clean' + (logs.length ? ':\n  ' + logs.join('\n  ') : ''));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
