// Builds the two "context packs" for AI assistants that can't open the repository (a chat in a browser, say):
//   CONTEXT.md        the project notes, a map of the code, and the full source of everything written for the project
//   CONTEXT-SHORT.md  the notes and the map only, for tools that can't take a file the size of CONTEXT.md
// tools/build.js runs this after every build, and tests/physics.test.js fails if either file is out of date.
// Run alone with:  node tools/make-context.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

const DOCS = ['AGENTS.md', 'HANDOVER.md', 'README.md'];
// the source written for this project, in reading order: [path, code-block language, what it is]
const SOURCE = [
  ['src/core.js', 'js', 'Physics, tables, rules and the CPU player. No DOM; also runs in Node for the tests and tools.'],
  ['src/career.js', 'js', 'The career: tour, events, opponents, draws, results and the saved career. No DOM; also runs in Node.'],
  ['src/game.js', 'js', 'Everything in the browser: rendering, camera, input, HUD, menus, sound, replay, trick shots, online play.'],
  ['src/shell.html', 'html', 'Page markup and CSS. The build fills in the fonts, favicon and code (__PS2P__, __VT323__, __FAVICON__, __BUNDLE__).'],
  ['relay/src/index.js', 'js', 'The Cloudflare Worker relay: a Room Durable Object per room code, and one Lobby for the open-rooms list.'],
  ['relay/wrangler.jsonc', 'jsonc', 'Relay settings: Worker name, Durable Object bindings and migrations.'],
  ['relay/package.json', 'json', 'The relay\'s packages (Wrangler).'],
  ['config.js', 'js', 'The live relay address.'],
  ['sw.js', 'js', 'Service worker for the installable app (network first).'],
  ['manifest.webmanifest', 'json', 'App name, colours and icons.'],
  ['package.json', 'json', 'npm shortcuts for the commands.'],
  ['tools/build.js', 'js', 'Builds index.html and these context packs.'],
  ['tools/make-context.js', 'js', 'Builds CONTEXT.md and CONTEXT-SHORT.md (this pack).'],
  ['tools/find-trick-demos.js', 'js', 'Searches with the real physics for "Show me" demo shots.'],
  ['tools/make-icons.js', 'js', 'Draws the app icons.'],
  ['tools/sim-career.js', 'js', 'Measures career opponents\' strength by playing them against the Medium CPU with the real physics.'],
  ['tests/physics.test.js', 'js', 'Physics, determinism, pocket and rules tests; also checks these packs are up to date.'],
  ['tests/career.test.js', 'js', 'Career tests: the tour data, draws, results, prize money, saving and loading, opponents\' CPU settings.'],
  ['tests/browser/lib.js', 'js', 'Shared helpers for the browser tests.'],
  ['tests/browser/run-all.js', 'js', 'Runs the browser tests against a local copy of the site and relay.'],
];
const SKIP_DIRS = new Set(['.git', 'node_modules', '.wrangler']);

function files(dir = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = dir ? dir + '/' + e.name : e.name;
    if (e.isDirectory()) out.push(...files(p)); else out.push(p);
  }
  return out;
}
const version = () => (read('index.html').match(/const BUILD = '([0-9a-f]{8})'/) || [, 'unknown'])[1];
const firstComment = p => { const m = read(p).match(/^\/\/ (.*)/); return m ? m[1] : ''; };

// a map of a JavaScript file: its "// ----- name" sections with line ranges, and the top-level names in each
function jsMap(p) {
  const lines = read(p).split('\n'), secs = [{ name: '(top of file)', from: 1, names: [] }];
  lines.forEach((l, i) => {
    let m;
    if ((m = l.match(/^\/\/ -{10,} (.+)$/))) secs.push({ name: m[1], from: i + 1, names: [] });
    else if ((m = l.match(/^(?:export )?(?:async )?function\*? ?(\w+)/))) secs[secs.length - 1].names.push(m[1] + '()');
    else if ((m = l.match(/^(?:export )?class (\w+)/))) secs[secs.length - 1].names.push('class ' + m[1]);
    else if ((m = l.match(/^ {2}(?:async )?(\w+)\([^)]*\) \{/)) && m[1] !== 'if' && m[1] !== 'for') secs[secs.length - 1].names.push('.' + m[1] + '()');
    else if ((m = l.match(/^(?:export )?(?:const|let|var) (\w+)/))) secs[secs.length - 1].names.push(m[1]);
    else if ((m = l.match(/^(?:const|let|var) \{ ([\w, ]+) \}/))) secs[secs.length - 1].names.push(...m[1].split(', '));
  });
  secs.forEach((s, i) => { s.to = i + 1 < secs.length ? secs[i + 1].from - 1 : lines.length; });
  return secs.filter(s => s.names.length || s.name !== '(top of file)')
    .map(s => `- **${s.name}** (lines ${s.from}–${s.to}): ${s.names.length ? s.names.map(n => '`' + n + '`').join(', ') : '(no top-level names)'}`).join('\n');
}
function htmlMap(p) {
  const t = read(p), ids = [...t.matchAll(/id="([^"]+)"/g)].map(m => '`#' + m[1] + '`');
  return `Elements with an id, in page order: ${ids.join(', ')}`;
}

function codeMap() {
  const out = ['## Map of the code', '',
    'Made automatically from the source, so it always matches it. Line numbers refer to the files as they are in this version.', ''];
  for (const [p] of SOURCE) {
    if (!/\.(js|html)$/.test(p) || p.startsWith('tools/') || p.startsWith('tests/') || /^(config|sw)\.js$/.test(p)) continue;
    out.push(`### ${p} (${read(p).split('\n').length} lines)`, '', p.endsWith('.html') ? htmlMap(p) : jsMap(p), '');
  }
  out.push('### Browser tests (tests/browser/, not included here)', '',
    'Run with `node tests/browser/run-all.js` (see AGENTS.md, Testing). Each file is one test script:', '');
  for (const f of files('tests/browser').filter(f => f.endsWith('.test.js'))) out.push(`- \`${f}\`: ${firstComment(f)}`);
  out.push('');
  return out.join('\n');
}
function note(f, full) {
  if (SOURCE.some(x => x[0] === f)) return full ? 'included below' : 'included in CONTEXT.md';
  if (DOCS.includes(f)) return 'included below';
  if (/^CONTEXT/.test(f)) return 'a context pack (this file or its partner)';
  if (f.startsWith('tests/browser/')) return 'browser test, listed in the map';
  return { 'index.html': 'built output, left out (generated from src/)', 'CLAUDE.md': 'points Claude Code to AGENTS.md', '.nojekyll': 'stops GitHub Pages running Jekyll',
    'relay/package-lock.json': 'exact package versions for the relay, left out' }[f] || '';
}
function tree(full) {
  const out = ['## Files in the repository', ''], dirs = { vendor: 'three.js r159 and two pixel fonts with their licences; third-party, left out', icons: 'the app icons; images, left out' };
  const seen = new Set(), packs = ['CONTEXT.md', 'CONTEXT-SHORT.md'];   // listed whether or not they exist yet, so the output never depends on it
  const all = [...new Set([...files(), ...packs])].sort((a, b) => a.localeCompare(b));
  for (const f of all) {
    const d = f.split('/')[0];
    if (dirs[d]) { if (!seen.has(d)) { seen.add(d); out.push(`- \`${d}/\` (${files(d).length} files): ${dirs[d]}`); } continue; }
    const n = note(f, full);
    out.push(`- \`${f}\`${n ? ': ' + n : ''}`);
  }
  out.push('');
  return out.join('\n');
}
const fence = (lang, text) => { const f = text.includes('```') ? '~~~~' : '```'; return `${f}${lang}\n${text.replace(/\n$/, '')}\n${f}`; };

function make() {
  const v = version();
  const head = full => [
    `# Retro Rack: ${full ? 'full context' : 'short context'} for an AI assistant`, '',
    `Generated by \`tools/build.js\` from game version **${v}**. Do not edit by hand: change the files it is made from and rebuild.`, '',
    full
      ? 'This one file holds what an AI needs to understand and change Retro Rack: the project notes, a map of the code, and the full source of everything written for the project. Left out: the three.js engine and the pixel fonts in `vendor/` (third-party, unchanged), the built `index.html` (generated from `src/`), images, and the browser test scripts (listed in the map).'
      : 'This file holds the project notes and a map of the code, without the source. `CONTEXT.md` is the same plus the full source; use it when the AI can take a file of that size.',
    '', 'Live game: https://flopp-r.github.io/retro-rack/ · Repository: https://github.com/flopp-r/retro-rack', '',
    'Read AGENTS.md first: it explains how the game works and the rules any change must keep (above all, bit-identical physics in both browsers for online play).', '',
  ].join('\n');
  const docs = DOCS.map(d => `---\n\n# File: ${d}\n\n${read(d).replace(/\n$/, '')}\n`).join('\n');
  const src = SOURCE.map(([p, lang, what]) => `## ${p}\n\n${what} (${read(p).split('\n').length} lines)\n\n${fence(lang, read(p))}\n`).join('\n');
  const full = [head(true), tree(true), docs, '---\n', codeMap(), '---\n\n# Source code\n', src].join('\n');
  const short = [head(false), tree(false), docs, '---\n', codeMap()].join('\n');
  return { 'CONTEXT.md': full, 'CONTEXT-SHORT.md': short };
}
function write() {
  const out = make();
  for (const [f, text] of Object.entries(out)) fs.writeFileSync(path.join(root, f), text);
  return Object.entries(out).map(([f, t]) => `${f} ${Math.round(t.length / 1024)} KB`).join(', ');
}

module.exports = { make, write };
if (require.main === module) console.log('Wrote ' + write());
