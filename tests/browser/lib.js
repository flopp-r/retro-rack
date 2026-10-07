// Shared bits for the browser tests: Playwright, the addresses of the local test sites, and where screenshots go.
// run-all.js starts the sites and the relay; AGENTS.md (Testing) explains the set-up.
const path = require('path'), os = require('os'), fs = require('fs');

function loadPlaywright() {
  const tries = [process.env.PLAYWRIGHT_MODULE, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean);
  for (const t of tries) { try { return require(t); } catch (e) {} }
  console.error('Playwright not found. Install it (npm install --no-save playwright), or set PLAYWRIGHT_MODULE to its folder.');
  process.exit(2);
}
const pw = loadPlaywright();

const ROOT = path.resolve(__dirname, '..', '..');                                   // the repository
const WORK = process.env.RR_WORK || path.join(os.tmpdir(), 'retro-rack-browser-tests');  // test sites, relay copy, screenshots
const FILE = 'file://' + path.join(ROOT, 'index.html');                              // the built game, opened from disk
// Three copies of the game served like GitHub Pages (under /retro-rack/): the current build, an old build from before
// the version check, and the current build with its version changed (to stand in for "a different version").
const SITE = { new: 'http://127.0.0.1:8080/retro-rack/', old: 'http://127.0.0.1:8081/retro-rack/', alt: 'http://127.0.0.1:8082/retro-rack/' };
const PORTS = { new: 8080, old: 8081, alt: 8082, relay: 8787 };
const shot = name => { const d = path.join(WORK, 'shots'); fs.mkdirSync(d, { recursive: true }); return path.join(d, name); };

module.exports = { ...pw, ROOT, WORK, FILE, SITE, PORTS, shot };
