// Builds index.html from src/ and vendor/. Run with:  node tools/build.js   (no installs needed)
// Output is one self-contained file: fonts and the three.js engine are inlined so it also works offline.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const b64 = p => fs.readFileSync(path.join(root, p)).toString('base64');

let html = read('src/shell.html');
html = html.replace('__PS2P__', () => b64('vendor/press-start-2p-latin-400-normal.woff2'));
html = html.replace('__VT323__', () => b64('vendor/vt323-latin-400-normal.woff2'));

// three.js ES module build: turn its single trailing `export {...}` into a returned namespace object,
// so it can live inside one inline <script type="module"> with the game code.
let three = read('vendor/three.module.min.js').trimEnd();
const m = three.match(/export\s*\{([^}]*)\}\s*;?\s*$/);
if (!m || (three.match(/export/g) || []).length !== 1) throw new Error('Unexpected three.js module format');
const pairs = m[1].split(',').map(s => s.trim()).filter(Boolean).map(part => {
  const [loc, pub] = part.split(/\s+as\s+/);
  return `${(pub || loc).trim()}:${loc.trim()}`;
});
three = three.slice(0, m.index) + 'return Object.freeze({' + pairs.join(',') + '});';

const bundle = 'const THREE = (() => {\n' + three + '\n})();\n' + read('src/core.js') + '\n' + read('src/game.js');
if (bundle.includes('</script')) throw new Error('Bundle contains </script, which would break the page');
html = html.replace('__BUNDLE__', () => bundle);   // function form: the bundle contains $ characters
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log(`Built index.html (${Math.round(html.length / 1024)} KB, ${pairs.length} three.js exports)`);
