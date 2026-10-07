// Installable app (PWA): install-readiness, offline start, updates arriving, and a clean console throughout.
const { chromium, WORK } = require('./lib');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(WORK, 'www-new');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.md': 'text/plain' };
let override = null;   // replaces index.html to simulate a new deploy
let server;
function startServer() {
  server = http.createServer((req, res) => {
    let p = new URL(req.url, 'http://x').pathname;
    if (!p.startsWith('/retro-rack/')) { res.writeHead(404); return res.end(); }
    p = p.slice(11); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    let body = fs.readFileSync(f);
    if (override && p === '/index.html') body = Buffer.from(override);
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)], 'cache-control': 'max-age=600' });
    res.end(body);
  });
  return new Promise(r => server.listen(8090, '127.0.0.1', r));
}
const stopServer = () => new Promise(r => { server.closeAllConnections(); server.close(r); });
const URL0 = 'http://127.0.0.1:8090/retro-rack/';
const ok = (c, msg) => console.log((c ? 'PASS ' : 'FAIL ') + msg);

(async () => {
  await startServer();
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 480, height: 360 } });
  const p = await ctx.newPage();
  const log = [];
  p.on('console', m => { if (!/GPU stall due to ReadPixels/.test(m.text())) log.push(`[${m.type()}] ${m.text()}`); });
  p.on('pageerror', e => log.push(`[pageerror] ${e.message}`));

  await p.goto(URL0); await p.waitForTimeout(1500);
  const ver = await p.textContent('#ver');
  ok(/^Version [0-9a-f]{8}$/.test(ver), `menu shows "${ver}"`);
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.waitForTimeout(500);
  ok(await p.evaluate(() => !!navigator.serviceWorker.controller), 'service worker is running and in charge of the page');
  const cached = await p.evaluate(async () => (await (await caches.open('retro-rack')).keys()).map(r => r.url.replace(location.origin, '')));
  console.log('     saved files:', cached.join(', '));

  const cdp = await ctx.newCDPSession(p);
  const man = await cdp.send('Page.getAppManifest');
  ok(!man.errors.length, `manifest reads cleanly${man.errors.length ? ': ' + JSON.stringify(man.errors) : ''}`);
  const inst = await cdp.send('Page.getInstallabilityErrors');
  ok(!inst.installabilityErrors.length, `browser says it can be installed${inst.installabilityErrors.length ? ': ' + JSON.stringify(inst.installabilityErrors) : ''}`);

  // a visit to another page on the site must not replace the saved game
  await p.goto(URL0 + 'README.md'); await p.goto(URL0);
  await p.waitForTimeout(800);

  // offline: switch the web server off completely
  await stopServer();
  for (const u of [URL0, URL0 + 'index.html', URL0 + '?relay=ws://127.0.0.1:1']) {
    await p.goto(u); await p.waitForTimeout(1500);
    const st = await p.evaluate(() => window.__rr && window.__rr.state);
    ok(st === 'menu', `offline: ${u.replace('http://127.0.0.1:8090', '')} opens the game (state ${st})`);
  }
  await p.evaluate(() => { const r = window.__rr; r.M.mode = '8ball'; r.M.opp = 'bot'; r.startGame(); });
  await p.waitForTimeout(800);
  await p.evaluate(() => window.__rr.beginStroke());
  let s; for (let i = 0; i < 60; i++) { await p.waitForTimeout(500); s = await p.evaluate(() => window.__rr.state); if (s !== 'stroke' && s !== 'moving') break; }
  ok(s === 'botThink' || s === 'botAim' || s === 'aim', `offline: a game against the CPU plays (after the break: ${s})`);

  // back online with a "new deploy": a normal reload must show the new version straight away
  await startServer();
  override = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/const BUILD = '[0-9a-f]{8}'/, "const BUILD = 'cafef00d'");
  await p.goto(URL0); await p.waitForTimeout(1500);
  ok((await p.textContent('#ver')) === 'Version cafef00d', `after a new deploy, one normal reload shows: "${await p.textContent('#ver')}"`);
  // and that new copy is what's saved for offline use
  await stopServer();
  await p.reload(); await p.waitForTimeout(1500);
  ok((await p.textContent('#ver')) === 'Version cafef00d', 'offline afterwards: the saved copy is the new version');

  ok(!log.length, 'console clean' + (log.length ? ':\n  ' + log.join('\n  ') : ''));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
