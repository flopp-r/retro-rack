// Runs the browser tests: builds the game, serves three copies of it locally, starts the relay locally, then runs each
// *.test.js in this folder in turn and prints a summary. Usage:
//   node tests/browser/run-all.js            every test
//   node tests/browser/run-all.js online     only tests whose file name contains "online" (several words allowed)
// Needs Playwright with Chromium, and npm for the relay's packages (installed once into a temporary folder).
const { spawn, execFileSync } = require('child_process');
const http = require('http'), fs = require('fs'), path = require('path');
const { ROOT, WORK, PORTS } = require('./lib');

const OLD_BUILD = '88b4cf0';   // the last commit before the version check (PR #1): stands in for "an older version"
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.md': 'text/plain' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const say = t => console.log(`\x1b[36m${t}\x1b[0m`);

// a static server that behaves like GitHub Pages for this repository: everything under /retro-rack/
function serve(dir, port) {
  return new Promise((resolve, reject) => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (!p.startsWith('/retro-rack/')) { res.writeHead(404); return res.end('not found'); }
      p = p.slice('/retro-rack'.length); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(dir, p);
      if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'max-age=600' });
      fs.createReadStream(f).pipe(res);
    });
    s.on('error', reject); s.listen(port, '127.0.0.1', () => resolve(s));
  });
}
function copySite(dir, html) {
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  for (const f of ['config.js', 'sw.js', 'manifest.webmanifest', 'README.md']) fs.copyFileSync(path.join(ROOT, f), path.join(dir, f));
  fs.cpSync(path.join(ROOT, 'icons'), path.join(dir, 'icons'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}
const get = url => new Promise(r => { http.get(url, res => { let b = ''; res.on('data', d => b += d); res.on('end', () => r(b)); }).on('error', () => r(null)); });

async function startRelay() {
  if (/relay is running/.test(await get(`http://127.0.0.1:${PORTS.relay}/`) || '')) { say(`Using the relay already running on port ${PORTS.relay}.`); return null; }
  const dir = path.join(WORK, 'relay');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of ['package.json', 'package-lock.json', 'wrangler.jsonc']) fs.copyFileSync(path.join(ROOT, 'relay', f), path.join(dir, f));
  fs.cpSync(path.join(ROOT, 'relay', 'src'), path.join(dir, 'src'), { recursive: true });
  if (!fs.existsSync(path.join(dir, 'node_modules', 'wrangler'))) {
    say('Installing the relay\'s packages (first run only)…');
    execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: dir, stdio: 'inherit' });
  }
  say('Starting the relay locally…');
  const log = fs.openSync(path.join(WORK, 'relay.log'), 'w');
  const p = spawn('npx', ['wrangler', 'dev', '--port', String(PORTS.relay), '--ip', '127.0.0.1'], { cwd: dir, stdio: ['ignore', log, log], env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, detached: true });
  for (let i = 0; i < 120; i++) { if (/relay is running/.test(await get(`http://127.0.0.1:${PORTS.relay}/`) || '')) return p; await sleep(1000); }
  throw new Error(`The relay didn't start; see ${path.join(WORK, 'relay.log')}`);
}

(async () => {
  const only = process.argv.slice(2);
  const tests = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js') && (!only.length || only.some(w => f.includes(w)))).sort();
  if (!tests.length) { console.error('No tests match.'); process.exit(2); }
  fs.mkdirSync(WORK, { recursive: true });

  say('Building index.html…');
  execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build.js')], { stdio: 'inherit' });
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  copySite(path.join(WORK, 'www-new'), html);
  copySite(path.join(WORK, 'www-alt'), html.replace(/const BUILD = '[0-9a-f]{8}'/, "const BUILD = 'deadbeef'"));
  let old = null;
  try { old = execFileSync('git', ['show', `${OLD_BUILD}:index.html`], { cwd: ROOT, maxBuffer: 64 << 20 }); }
  catch (e) { say(`Couldn't read the old build (${OLD_BUILD}) from git history; the online test needs it.`); }
  if (old) copySite(path.join(WORK, 'www-old'), old);

  const servers = [];
  const relay = await startRelay();
  const stop = () => { for (const s of servers) s.close(); if (relay) try { process.kill(-relay.pid); } catch (e) {} };
  process.on('SIGINT', () => { stop(); process.exit(130); });
  try {
    servers.push(await serve(path.join(WORK, 'www-new'), PORTS.new), await serve(path.join(WORK, 'www-alt'), PORTS.alt));
    if (old) servers.push(await serve(path.join(WORK, 'www-old'), PORTS.old));
  } catch (e) { stop(); console.error(`Couldn't start the test sites (${e.message}). Is something else using ports ${PORTS.new}-${PORTS.alt}?`); process.exit(2); }

  const results = [];
  for (const t of tests) {
    say(`\n=== ${t}`);
    const t0 = Date.now(); let pass = 0, fail = 0;
    const code = await new Promise(resolve => {
      const c = spawn(process.execPath, [path.join(__dirname, t)], { cwd: WORK, env: { ...process.env, RR_WORK: WORK } });
      let buf = '';
      const line = l => { if (/^PASS /.test(l)) pass++; if (/^FAIL /.test(l)) fail++; console.log(l); };
      c.stdout.on('data', d => { buf += d; const ls = buf.split('\n'); buf = ls.pop(); ls.forEach(line); });
      c.stderr.on('data', d => process.stderr.write(d));
      c.on('close', k => { if (buf) line(buf); resolve(k); });
    });
    results.push({ t, pass, fail, code, s: Math.round((Date.now() - t0) / 1000) });
  }
  stop();

  say('\n=== Summary');
  for (const r of results) console.log(`${r.fail || r.code ? 'FAIL' : 'ok  '}  ${r.t.padEnd(28)} ${String(r.pass).padStart(3)} passed, ${r.fail} failed${r.code ? `, exit code ${r.code}` : ''}  (${r.s} s)`);
  const bad = results.filter(r => r.fail || r.code).length;
  console.log(bad ? `\n${bad} test file(s) failed.` : `\nAll ${results.reduce((a, r) => a + r.pass, 0)} checks passed. Screenshots: ${path.join(WORK, 'shots')}`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
