// The built file opened straight from disk (as a downloaded copy): no install bits, clean console, game plays.
const { chromium, FILE, shot } = require('./lib');
const ok = (c, msg) => console.log((c ? 'PASS ' : 'FAIL ') + msg);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 480, height: 360 } }); const log = [];
  p.on('console', m => { if (!/GPU stall due to ReadPixels/.test(m.text())) log.push(`[${m.type()}] ${m.text()}`); });
  p.on('pageerror', e => log.push(`[pageerror] ${e.message}`));
  p.on('requestfailed', r => log.push(`[requestfailed] ${r.url()}`));
  await p.goto(FILE); await p.waitForTimeout(2500);
  const i = await p.evaluate(() => ({ ver: document.querySelector('#ver').textContent, manifest: !!document.querySelector('link[rel=manifest]'),
    sw: !!(navigator.serviceWorker && navigator.serviceWorker.controller), icon: (document.querySelector('link[rel=icon]') || {}).href || '' }));
  ok(/^Version [0-9a-f]{8}$/.test(i.ver), `menu shows "${i.ver}"`);
  ok(!i.manifest && !i.sw, 'no install link or service worker when opened from disk');
  ok(i.icon.startsWith('data:image/png;base64,'), 'tab icon is built into the file');
  for (const mode of ['8ball', 'uk8', '9ball']) {
    await p.evaluate(m => { const r = window.__rr; r.M.mode = m; r.M.opp = 'friend'; r.startGame(); }, mode); await p.waitForTimeout(600);
    await p.evaluate(() => window.__rr.beginStroke());
    let s; for (let k = 0; k < 80; k++) { await p.waitForTimeout(500); s = await p.evaluate(() => window.__rr.state); if (s === 'aim' || s === 'over') break; }
    ok(s === 'aim' || s === 'over', `${mode}: break plays and the next turn starts`);
  }
  await p.screenshot({ path: shot('file-menu.png') });
  ok(!log.length, 'console clean' + (log.length ? ':\n  ' + log.join('\n  ') : ''));
  await b.close();
})();
