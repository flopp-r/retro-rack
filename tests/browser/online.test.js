// Online test against the local relay: same-version games, reload rejoin, duplicated tabs, version mismatches.
const { chromium, SITE, WORK } = require('./lib');
const fs = require('fs'), path = require('path');
const RELAY = '?relay=ws://127.0.0.1:8787';
const NEW = SITE.new + RELAY, OLD = SITE.old + RELAY, ALT = SITE.alt + RELAY;
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const logs = {};
const sleep = ms => new Promise(r => setTimeout(r, ms));
const run = Date.now().toString(36).slice(-3).toUpperCase();   // fresh room codes each run

let b;
async function win(name, url) {
  const ctx = await b.newContext({ viewport: { width: 480, height: 360 } });
  await ctx.addInitScript(n => { try { localStorage.setItem('retroRack.name', n); } catch (e) {} }, name);
  // record every message the page shows, so short-lived ones can't be missed
  await ctx.addInitScript(() => { window.__toasts = []; new MutationObserver(ms => { for (const m of ms) for (const el of m.addedNodes) if (el.classList && el.classList.contains('toast')) window.__toasts.push(el.textContent); }).observe(document, { childList: true, subtree: true }); });
  const p = await ctx.newPage(); watch(p, name);
  await p.goto(url); return p;
}
function watch(p, name) {
  logs[name] = logs[name] || [];
  p.on('console', m => { if (!/GPU stall due to ReadPixels/.test(m.text())) logs[name].push(`[${m.type()}] ${m.text()}`); });
  p.on('pageerror', e => logs[name].push(`[pageerror] ${e.message}`));
}
const info = p => p.evaluate(() => { const r = window.__rr; return { state: r.state, seat: r.NET.seat, cid: r.NET.cid, started: r.NET.started, peer: r.NET.peer, link: r.NET.link, n: r.NET.n,
  lobby: document.querySelector('#lobbyStatus').textContent, note: document.querySelector('#netNote').textContent,
  toasts: window.__toasts || [], ver: (document.querySelector('#ver') || {}).textContent }; });
const table = p => p.evaluate(() => JSON.stringify({ b: window.__rr.world.balls.map(b => [b.id, b.x, b.z, b.potted]), g: window.__rr.game }));
async function until(fn, ms = 20000) { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(300); } return false; }
async function shoot(a, c) {
  // whoever's turn it is takes a shot; wait until both windows have finished it
  const [ia, ic] = [await info(a), await info(c)];
  const turn = await a.evaluate(() => window.__rr.game.turn);
  const shooter = turn === ia.seat ? a : c, n0 = Math.max(ia.n, ic.n);
  await shooter.evaluate(() => window.__rr.beginStroke());
  return until(async () => { const [x, y] = [await info(a), await info(c)];
    return x.n === n0 + 1 && y.n === n0 + 1 && ['aim', 'remote', 'over'].includes(x.state) && ['aim', 'remote', 'over'].includes(y.state); }, 90000);
}

(async () => {
  b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

  console.log('--- 1. Two windows on the new version');
  const room1 = 'N' + run + 'A';
  const host = await win('Host', NEW + '#room=' + room1);
  await sleep(1500);
  const guest = await win('Guest', NEW + '#room=' + room1);
  ok(await until(async () => (await info(host)).started && (await info(guest)).started), 'game starts for both');
  ok(await shoot(host, guest), 'first shot (the break) finishes in both windows');
  ok(await table(host) === await table(guest), 'tables identical after the break');
  ok(await shoot(host, guest), 'second shot finishes in both windows');
  ok(await table(host) === await table(guest), 'tables identical after the second shot');

  // markers: give both windows the same groups (display only), then only the player whose shot it is sees them
  for (const w of [host, guest]) await w.evaluate(() => { const g = window.__rr.game; g.breakShot = false; g.groups = ['solids', 'stripes']; });
  await sleep(300);
  const turn = await host.evaluate(() => window.__rr.game.turn), [hs, gs] = [await info(host), await info(guest)];
  const [hm, gm] = [await host.evaluate(() => window.__rr.marked()), await guest.evaluate(() => window.__rr.marked())];
  const shooterM = turn === hs.seat ? hm : gm, waiterM = turn === hs.seat ? gm : hm;
  ok(shooterM.length > 0 && waiterM.length === 0, `markers: the shooter sees ${shooterM.length}, the waiting player sees ${waiterM.length}`);
  console.log('--- 2. Reload mid-game keeps the seat');
  const before = await info(guest);
  await guest.reload();
  ok(await until(async () => { const i = await info(guest); return i.started && i.state !== 'lobby'; }), 'reloaded window rejoins the game');
  const after = await info(guest);
  ok(after.cid === before.cid && after.seat === before.seat, `same player id and seat after reload (seat ${after.seat})`);
  ok(await table(host) === await table(guest), 'tables identical after the reload');
  ok(await shoot(host, guest), 'a shot after the reload finishes in both windows');
  ok(await table(host) === await table(guest), 'tables identical after that shot');

  console.log('--- 3. Duplicating a tab during a two-player game');
  const [dup] = await Promise.all([host.context().waitForEvent('page'), host.evaluate(() => window.open(location.href))]);
  watch(dup, 'Host duplicate');
  await until(async () => { try { return (await info(dup)).note !== ''; } catch (e) { return false; } }, 15000);
  const di = await info(dup), hi = await info(host);
  ok(di.cid !== hi.cid, 'the duplicate gets its own player id');
  ok(/already has two players/.test(di.note), `the duplicate is told the room is full: "${di.note}"`);
  await sleep(1500);
  const hi2 = await info(host), gi2 = await info(guest);
  ok(hi2.link === 'online' && hi2.peer && gi2.peer && hi2.seat === 0, 'the original window keeps its seat and its connection');
  ok(await shoot(host, guest), 'the original game carries on: a shot finishes in both windows');
  ok(await table(host) === await table(guest), 'tables identical');
  await dup.close();

  console.log('--- 4. Duplicating a waiting host tab gives you an opponent (two-tab testing)');
  const room2 = 'N' + run + 'B';
  const solo = await win('Solo', NEW + '#room=' + room2);
  await until(async () => /Waiting/.test((await info(solo)).lobby));
  const [twin] = await Promise.all([solo.context().waitForEvent('page'), solo.evaluate(() => window.open(location.href))]);
  watch(twin, 'Solo duplicate');
  ok(await until(async () => { try { return (await info(solo)).started && (await info(twin)).started; } catch (e) { return false; } }), 'the duplicate joins as the second player and the game starts');
  const si = await info(solo), ti = await info(twin);
  ok(si.seat === 0 && ti.seat === 1 && si.cid !== ti.cid, `seats ${si.seat} and ${ti.seat}, different player ids`);
  ok(await shoot(solo, twin), 'a shot finishes in both tabs');
  ok(await table(solo) === await table(twin), 'tables identical');

  console.log('--- 5. Old version hosts, new version joins');
  const room3 = 'N' + run + 'C';
  const oldHost = await win('Old host', OLD + '#room=' + room3);
  await sleep(1500);
  const newGuest = await win('New guest', NEW + '#room=' + room3);
  await sleep(4000);
  let ng = await info(newGuest);
  ok(ng.state === 'lobby' && !ng.started, `new guest stays in the room screen (state ${ng.state})`);
  ok(/older version/.test(ng.lobby), `new guest sees: "${ng.lobby}"`);

  console.log('--- 6. New version hosts, old version joins');
  const room4 = 'N' + run + 'D';
  const newHost = await win('New host', NEW + '#room=' + room4);
  await sleep(1500);
  const oldGuest = await win('Old guest', OLD + '#room=' + room4);
  await sleep(4000);
  const nh = await info(newHost), og = await info(oldGuest);
  ok(nh.state === 'lobby' && !nh.started, `new host doesn't start a game (state ${nh.state})`);
  ok(/older version/.test(nh.lobby), `new host sees: "${nh.lobby}"`);
  console.log(`     old guest (can't know about versions) sees: "${og.lobby}", state ${og.state}`);

  console.log('--- 7. Two different new versions');
  const room5 = 'N' + run + 'E';
  const h5 = await win('Version A', NEW + '#room=' + room5);
  await sleep(1500);
  const g5 = await win('Version B', ALT + '#room=' + room5);
  await sleep(4000);
  const a5 = await info(h5), b5 = await info(g5);
  ok(a5.state === 'lobby' && b5.state === 'lobby', 'neither starts a game');
  ok(/different versions/.test(a5.lobby) && /different versions/.test(b5.lobby), `both see: "${a5.lobby}"`);

  console.log('--- 8. Mid-game, one player reloads onto a different version');
  // a real deploy: the site now serves another version; only the guest reloads (through the service worker)
  const live = path.join(WORK, 'www-new/index.html'), keep = fs.readFileSync(live);
  fs.copyFileSync(path.join(WORK, 'www-alt/index.html'), live);
  await guest.reload();
  await sleep(1000); fs.writeFileSync(live, keep);
  ok(await until(async () => { const i = await info(guest); return i.started && i.state !== 'lobby'; }), 'the game carries on rather than blocking');
  const gw = await info(guest), hw = await info(host);
  ok(gw.ver === 'Version deadbeef', `the reloaded window really is on the other version (${gw.ver})`);
  await sleep(500);
  const gw2 = await info(guest), hw2 = await info(host);
  ok(hw2.toasts.some(t => /different versions/.test(t)), `the player who stayed gets a warning: "${hw2.toasts.find(t => /different versions/.test(t))}"`);
  ok(gw2.toasts.some(t => /different versions/.test(t)), `the player who reloaded gets it too, after "${gw2.toasts.find(t => /Back in the game/.test(t))}"`);
  ok(await guest.evaluate(() => [...document.querySelectorAll('#notices .toast')].some(t => /different versions/.test(t.textContent))), 'and it is still on screen for them (not wiped when the table came back)');
  ok(await table(host) === await table(guest), 'tables identical after rejoining');

  console.log('--- Console');
  for (const [k, v] of Object.entries(logs)) {
    if (/^Old/.test(k)) { console.log(`     ${k} (live version, for reference): ${v.length ? v.join(' | ') : 'clean'}`); continue; }
    ok(!v.length, `${k}: console ${v.length ? 'NOT clean:\n  ' + v.join('\n  ') : 'clean'}`);
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
