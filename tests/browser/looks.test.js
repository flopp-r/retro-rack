// Online looks: each player's cue and gloves show on both screens, the table wears the host's cloth, changes made
// mid-game reach the other player, nonsense from the other side is ignored, the day's first win pays, and your own
// cloth comes back afterwards.
const { chromium, SITE } = require('./lib');
const BASE = SITE.new + '?relay=ws://127.0.0.1:8787';
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(250); } return false; };
const logs = [];
let b;
async function player(name, settings) {
  const ctx = await b.newContext({ viewport: { width: 480, height: 360 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(([n, s]) => { try { localStorage.setItem('retroRack.name', n); localStorage.setItem('retroRack.rotateHint', 'off'); localStorage.setItem('retroRack.settings', JSON.stringify(s)); } catch (e) {} }, [name, settings]);
  const p = await ctx.newPage();
  p.on('console', m => { if (!/GPU stall/.test(m.text())) logs.push(`${name} [${m.type()}] ${m.text()}`); });
  p.on('pageerror', e => logs.push(`${name} [pageerror] ${e.message}`));
  await p.goto(BASE); await sleep(1200); return p;
}
const look = p => p.evaluate(() => __rr.look);
const st = p => p.evaluate(() => ({ state: __rr.state, turn: __rr.game.turn, seat: __rr.NET.seat, n: __rr.NET.n, started: __rr.NET.started, peerCue: __rr.NET.peerCue, peerGlove: __rr.NET.peerGlove }));

(async () => {
  b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const h = await player('Host', { owned: ['navy', 'ebony'], cloth: 'navy', cue: 'ebony', glove: 'g-white' });
  const g = await player('Guest', { owned: ['tan', 'arcade'], cloth: 'tan', cue: 'arcade' });
  ok((await look(g)).cloth === 'tan', "before the game, the guest's own cloth (Tan)");

  await h.click('[data-go="multi"]'); await h.click('[data-go="online"]'); await h.click('#bCreate'); await h.click('[data-mode="8ball"]');
  await h.click('#mListed .btn:nth-child(2)'); await h.click('#bStart'); await sleep(1200);
  const code = await h.textContent('#lobbyCode');
  await g.click('[data-go="multi"]'); await g.click('[data-go="online"]'); await g.fill('#netCode', code); await g.click('#bJoin');
  ok(await until(async () => (await st(h)).started && (await st(g)).started), 'the game starts');

  console.log('--- the cloth: the host\'s, on both tables');
  ok((await look(h)).cloth === 'navy' && (await look(g)).cloth === 'navy', 'both tables are Navy, the host\'s cloth');
  await g.click('#bPause'); await sleep(200);
  ok(/the table wears the host's cloth/.test(await g.textContent('#sClothTxt')), 'the guest\'s Settings explain why');
  await g.click('#bResume');

  console.log('--- the cues: each player\'s own, seen by both');
  ok((await st(g)).peerCue === 'ebony' && (await st(h)).peerCue === 'arcade', 'each game knows the other player\'s cue');
  ok((await st(g)).peerGlove === 'g-white' && (await st(h)).peerGlove === 'none', 'and gloves: the host wears the white pair, the guest none');
  // whoever is to shoot, both screens should show that player's cue
  const shooterCue = s => s.turn === 0 ? 'ebony' : 'arcade';
  for (let i = 0; i < 2; i++) {
    const s = await st(h), cueOk = await until(async () => (await look(h)).cue === shooterCue(await st(h)) && (await look(g)).cue === shooterCue(await st(g)), 5000);
    ok(cueOk, `${s.turn === 0 ? 'host' : 'guest'} to shoot: both screens show the ${shooterCue(s)} cue`);
    const glove = s.turn === 0 ? 'g-white' : 'none';
    ok(await until(async () => (await look(h)).glove === glove && (await look(g)).glove === glove, 5000), `...and the ${s.turn === 0 ? 'white gloves' : 'bare cue'} on both`);
    const shooter = s.turn === 0 ? h : g, n0 = s.n;
    await shooter.evaluate(() => __rr.beginStroke());
    await until(async () => { const [x, y] = [await st(h), await st(g)]; return x.n === n0 + 1 && y.n === n0 + 1 && ['aim', 'remote'].includes(x.state) && ['aim', 'remote'].includes(y.state); }, 90000);
    if ((await st(h)).turn === s.turn && i === 0) { // still the same shooter: hand the turn over by playing on until it changes
      for (let k = 0; k < 6 && (await st(h)).turn === s.turn; k++) {
        const sh = (await st(h)).turn === 0 ? h : g, m0 = (await st(h)).n;
        await sh.evaluate(() => { __rr.aim.power = 0.05; __rr.beginStroke(); });
        await until(async () => { const [x, y] = [await st(h), await st(g)]; return x.n === m0 + 1 && y.n === m0 + 1 && ['aim', 'remote'].includes(x.state) && ['aim', 'remote'].includes(y.state); }, 90000);
      }
    }
  }

  console.log('--- changes made mid-game reach the other player');
  await g.click('#bPause'); await sleep(200); await g.click('#sCue .btn:last-child'); await g.click('#bResume');   // Arcade, then round to the house cue
  ok(await until(async () => (await st(h)).peerCue === 'house'), 'the guest switches to the house cue: the host\'s game knows at once');
  await h.click('#bPause'); await sleep(200); await h.click('#sCloth .btn:last-child'); await h.click('#bResume');   // Navy, then round to Teal
  ok(await until(async () => (await look(g)).cloth === 'teal' && (await look(h)).cloth === 'teal'), 'the host changes the cloth to Teal: both tables follow');

  console.log('--- nonsense from the other side is ignored');
  await h.evaluate(() => __rr.NET.ws.send(JSON.stringify({ t: 'look', cue: '<img src=x>', cloth: 'tartan' })));
  await sleep(800);
  ok((await st(g)).peerCue === 'house' && (await look(g)).cloth === 'tan', 'an unknown cue becomes the house cue; an unknown cloth leaves the guest on their own');

  console.log('--- the day\'s first online win');
  await until(async () => ['aim', 'remote'].includes((await st(h)).state) && ['aim', 'remote'].includes((await st(g)).state));
  await h.click('#bPause'); await sleep(200); await h.click('#bConcede');   // the host gives the frame to the guest
  ok(await until(() => g.isVisible('#over')), 'the guest wins the frame');
  const gl = await g.evaluate(() => JSON.parse(localStorage.getItem('retroRack.locker')));
  ok(/Your first online win today: £30 and a gold case!/.test(await g.textContent('#overEarn')) && gl.cases.gold === 1 && gl.money === 70, `it pays: "${await g.textContent('#overEarn')}"`);
  ok(await h.textContent('#overEarn') === '', 'the host, who lost, gets nothing');

  console.log('--- afterwards');
  await g.click('#bOverMenu'); await sleep(600);
  ok((await look(g)).cloth === 'tan', "after leaving, the guest's own cloth is back");

  ok(!logs.length, 'console clean' + (logs.length ? ':\n  ' + logs.join('\n  ') : ''));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
