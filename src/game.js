(() => {
'use strict';
const C = CORE, P = C.P, T = C.TABLE, R_US = C.SPECS.us9.R;
let R = P.R;
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const wrapA = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const DEG = Math.PI / 180;
const BUILD = '__BUILD__';   // version: tools/build.js fills in a fingerprint of the game code
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

// ------------------------------------------------------------------ settings
const DEFAULTS = { pixel: 1, levels: 256, dither: true, outline: true, scan: false, volume: 0.75, cloth: 'teal', cue: 'house', glove: 'none', markers: true, vibrate: true, shotCam: true, follow: true, gfx: 2, fxOff: [] };   // fxOff: collection effects switched off
const S = { ...DEFAULTS };
try {
  const saved = JSON.parse(localStorage.getItem('retroRack.settings') || '{}');
  Object.assign(S, saved);
  if (!('volume' in saved) && saved.sound === false) S.volume = 0;   // the old Sound: Off carries over
  delete S.sound;
  if (saved.gfx !== 2) Object.assign(S, { pixel: 1, levels: 256, gfx: 2 });   // the sharpest picture became the default: everyone gets it once
} catch (e) {}
const saveS = () => { try { localStorage.setItem('retroRack.settings', JSON.stringify(S)); } catch (e) {} };
const CLOTHS = { teal: ['#1d8a74', 'Teal'], green: ['#2d8a3c', 'Club green'], blue: ['#2461b0', 'Tournament blue'], wine: ['#86263f', 'Wine'], violet: ['#56399a', 'Violet'] };
// the cloths from the shop and from cases (see looks.js); every game can use the ones owned on this device
for (const it of Object.values(LOOKS.ALL)) if (it.kind === 'cloth') CLOTHS[it.id] = [it.col, it.name];
const M = { mode: '8ball', opp: 'bot', diff: 'medium', guide: 'auto', rack: '8ball', listed: true, race: 0, trick: 0 };
try { Object.assign(M, JSON.parse(localStorage.getItem('retroRack.menu') || '{}')); } catch (e) {}
const saveM = () => { if (CAR.on) return; try { localStorage.setItem('retroRack.menu', JSON.stringify(M)); } catch (e) {} };
// career (see the career section): the saved career, and while a career match is on, who you're playing
const K = CAREER;
const CAR = { data: null, on: false, opp: null, stash: null, result: null, view: null };
try { CAR.data = K.validate(JSON.parse(localStorage.getItem('retroRack.career') || 'null')); } catch (e) {}
// the locker (src/looks.js): the money, unopened cases and looks owned on this device. Every change reads the stored
// copy, makes the change and writes it straight back, so two open pages never undo each other's changes.
const LK = LOOKS;
let LOCK = LK.newLocker(), DEV = false, DEV_MYTHIC = false;   // DEV: dev mode's test locker in use (see "dev mode"); DEV_MYTHIC: its next case gives a mythic
const lockKey = () => DEV ? 'retroRack.lockerDev' : 'retroRack.locker';
const lockerRead = () => { try { const raw = localStorage.getItem(lockKey()); return raw ? LK.validateLocker(JSON.parse(raw)) : null; } catch (e) { return null; } };
function lockerEdit(fn) {
  const l = lockerRead() || LOCK, r = fn(l); LOCK = l;
  try { localStorage.setItem(lockKey(), JSON.stringify(l)); } catch (e) {}
  return r;
}
LOCK = lockerRead() || LOCK;
const addOwned = (l, ids) => { for (const id of Array.isArray(ids) ? ids : []) if (K.has(LK.ALL, id) && !LK.owns(l, id)) l.owned.push(id); };
// looks bought before the locker were kept in the settings (owned), and a career kept its unspent prize money: both move in
if (S.owned || !lockerRead()) { lockerEdit(l => addOwned(l, S.owned)); delete S.owned; saveS(); }
if (CAR.data && (CAR.data.money || CAR.data.bought)) {
  const { money = 0, bought } = CAR.data; lockerEdit(l => { l.money += money; addOwned(l, bought); });
  delete CAR.data.money; delete CAR.data.bought; try { localStorage.setItem('retroRack.career', JSON.stringify(CAR.data)); } catch (e) {}
}
// Dev mode, for trying every look without unlocking them: typing the dev word as your name on the Online screen
// switches it on or off (see the online section), leaving your name as it was. Only a fingerprint of the word is kept
// here, because the repository is public. While it's on, the locker is a separate test locker with everything owned,
// £100,000 and 50 of each case; the real locker is left alone and comes back when it's switched off. A test locker kept
// from before is topped up at start-up with any looks, cases and rewards added since. Settings can empty it instead
// (devEmpty(), retroRack.devEmpty, until it's filled again or dev mode goes off): no looks and no rewards, so cases
// behave as they do for a new player (a Treat case always new, mythics never repeated, collections paying out).
const DEVW = { print: 'f5fbd99c8a9a458d2267847deb9aab64fd2f699c0746cea014e74f8cc48e6ee5' };
const devEmpty = () => { try { return localStorage.getItem('retroRack.devEmpty') === '1'; } catch (e) { return false; } };
function devLocker(l) {
  if (!l) { l = LK.newLocker(); l.money = 100000; for (const g of LK.CASE_IDS) l.cases[g] = 50; }
  for (const g of LK.CASE_IDS) if (LK.GRADES[g].series && !l.cases[g]) l.cases[g] = 50;
  if (!devEmpty()) {
    l.owned = Object.keys(LK.ALL).filter(id => !LK.FREE.includes(id));
    l.claimed = [...Object.keys(LK.COLLECTIONS), ...LK.RARITIES, 'all', ...LK.SERIES_IDS.flatMap(sid => [...LK.RARITIES.map(r => `${sid}:${r}`), `${sid}:all`])];   // every effect, without the money
  }
  try { localStorage.setItem('retroRack.lockerDev', JSON.stringify(l)); } catch (e) {}
  return l;
}
try { DEV = localStorage.getItem('retroRack.dev') === '1'; } catch (e) {}
if (DEV) LOCK = devLocker(lockerRead());
addEventListener('storage', e => {   // another open page changed the locker, or dev mode
  if (e.key === 'retroRack.dev') { DEV = e.newValue === '1'; LOCK = lockerRead() || (DEV ? devLocker() : LK.newLocker()); checkLooks(); }
  else if (e.key !== lockKey()) return;
  else LOCK = lockerRead() || LOCK;
  applyFx(); if (state === 'menu') refreshMenus();
});
const owns = id => (K.has(CLOTHS, id) && !K.has(LK.ALL, id)) || LK.owns(LOCK, id);
const kindOf = id => K.has(LK.ALL, id) ? LK.ALL[id].kind : '';
// the looks in use must be owned (after dev mode, say), else back to the free ones
function checkLooks() {
  if (!owns(S.cloth) || !K.has(CLOTHS, S.cloth)) S.cloth = 'teal';
  if (!owns(S.cue) || !(S.cue === 'house' || kindOf(S.cue) === 'cue')) S.cue = 'house';
  if (!owns(S.glove) || !(S.glove === 'none' || kindOf(S.glove) === 'glove')) S.glove = 'none';
}
checkLooks();
const NET = { on: false, ws: null, code: '', seat: 0, cid: '', peer: false, peerName: 'Friend', myName: 'Player', link: 'off', n: 0,
  guide: 'ghost', retry: 0, timer: 0, queue: [], pendingSync: {}, again: [false, false], games: 0, started: false,
  lastAim: 0, aimSig: '', aimT: null, stateAfter: false, cloth: null, peerCue: 'house', peerGlove: 'none' };

function guideLevel() {
  if (NET.on) return NET.guide;
  if (M.guide !== 'auto') return M.guide;
  if (M.mode === 'practice') return 'full';
  if (M.opp === 'friend' || M.opp === 'online') return 'ghost';
  return { easy: 'full', medium: 'line', hard: 'ghost', expert: 'min' }[M.diff];
}

// ------------------------------------------------------------------ renderer + post
const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
THREE.ColorManagement.enabled = false;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(1);
const scene = new THREE.Scene();
const ROOM = new THREE.Color('#1a1433');
scene.background = ROOM;
scene.fog = new THREE.Fog(ROOM, 5, 13);
const camera = new THREE.PerspectiveCamera(45, 1, 0.03, 30);

const postMat = new THREE.ShaderMaterial({
  uniforms: {
    tColor: { value: null }, tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
    uLevels: { value: 8 }, uDither: { value: 1 }, uOutline: { value: 1 }, uNear: { value: camera.near }, uFar: { value: camera.far },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `
    uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 uRes;
    uniform float uLevels, uDither, uOutline, uNear, uFar;
    varying vec2 vUv;
    float linZ(float d){ return uNear*uFar/(uFar - d*(uFar-uNear)); }
    float b2(vec2 v){ return mod(2.0*v.x + 3.0*v.y, 4.0); }
    float bayer4(vec2 p){ vec2 q = mod(floor(p), 4.0); return (4.0*b2(mod(q,2.0)) + b2(floor(q/2.0)) + 0.5)/16.0; }
    void main(){
      vec2 px = 1.0/uRes;
      vec3 col = texture2D(tColor, vUv).rgb;
      if (uOutline > 0.5) {
        float dc = texture2D(tDepth, vUv).x;
        float dl = texture2D(tDepth, vUv - vec2(px.x,0.0)).x, dr = texture2D(tDepth, vUv + vec2(px.x,0.0)).x;
        float dd = texture2D(tDepth, vUv - vec2(0.0,px.y)).x, du = texture2D(tDepth, vUv + vec2(0.0,px.y)).x;
        float zc = linZ(dc);
        float lap = abs(dl + dr - 2.0*dc) + abs(du + dd - 2.0*dc);
        float dz = lap * zc*zc*(uFar-uNear)/(uNear*uFar);
        float zmax = max(max(linZ(dl),linZ(dr)), max(linZ(du),linZ(dd)));
        float edge = step(0.02*zc + 0.012, dz) * step(0.03*zc + 0.015, zmax - zc);
        if (dc >= 0.99999) edge = 0.0;
        col = mix(col, col*0.22 + vec3(0.035,0.025,0.07), edge*0.9);
      }
      vec2 c = vUv - 0.5; col *= 1.0 - 0.55*dot(c,c);
      if (uLevels < 200.0) {
        float t = (bayer4(gl_FragCoord.xy) - 0.5) * uDither;
        col = floor(col*(uLevels-1.0) + 0.5 + t) / (uLevels-1.0);
      }
      gl_FragColor = vec4(clamp(col,0.0,1.0), 1.0);
    }`,
  depthTest: false, depthWrite: false,
});
const postScene = new THREE.Scene();
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
let rt = null, VW = 1, VH = 1;
// --bb: where the scoreboard ends (notices sit below it). --tb: how far the button grid reaches up from the bottom
// in the phone layout, so the practice buttons and the chat menu can stack above it whatever buttons are showing.
function hudVars() {
  const st = document.documentElement.style, bb = $('#board').getBoundingClientRect(), tb = $('#tools').getBoundingClientRect();
  st.setProperty('--bb', Math.round(bb.bottom) + 'px');
  st.setProperty('--tb', Math.round(innerHeight - tb.top) + 'px');
  // --lw / --sw: the right edge of the left-hand buttons and the width of the spin panel, so on a phone on its
  // side the ball picker can sit in the gap between them
  const right = s => { const el = $(s); return el && !el.closest('[hidden]') ? el.getBoundingClientRect().right : 0; };
  st.setProperty('--lw', Math.round(Math.max(right('#practice'), right('#tools'), right('#trickInfo'))) + 'px');   // the trick panel is wider than the icon buttons above it
  st.setProperty('--sw', Math.round(innerWidth - $('#shot').getBoundingClientRect().left) + 'px');
}
if (window.ResizeObserver) { const ro = new ResizeObserver(() => hudVars()); for (const s of ['#tools', '#board', '#practice', '#shot', '#trickInfo']) ro.observe($(s)); }
// Pixel size 0 is Max: one game pixel per real screen pixel (at most 3 per CSS pixel), so a screen scaled above 100%,
// or a phone, shows finer detail than 1×; on a screen at 100% it's the same as 1×.
const screenDpr = () => Math.min(3, Math.max(1, devicePixelRatio || 1));
function resize() {
  const px = S.pixel === 0 ? 1 / screenDpr() : clamp(Math.round(S.pixel), 1, 6);
  VW = Math.max(80, Math.ceil(innerWidth / px)); VH = Math.max(60, Math.ceil(innerHeight / px));
  renderer.setSize(VW, VH, false);
  canvas.style.width = VW * px + 'px'; canvas.style.height = VH * px + 'px';
  camera.aspect = VW / VH; camera.updateProjectionMatrix();
  if (rt) { rt.depthTexture.dispose(); rt.dispose(); }
  rt = new THREE.WebGLRenderTarget(VW, VH, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false });
  rt.depthTexture = new THREE.DepthTexture(VW, VH); rt.depthTexture.type = THREE.UnsignedIntType;
  postMat.uniforms.tColor.value = rt.texture; postMat.uniforms.tDepth.value = rt.depthTexture;
  postMat.uniforms.uRes.value.set(VW, VH);
  requestAnimationFrame(hudVars);
}
// the screen's pixels change size when the window moves to another screen or the page is zoomed
(function watchDpr() {
  if (!window.matchMedia) return;
  matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener('change', () => { if (S.pixel === 0) resize(); pixNote(); watchDpr(); }, { once: true });
})();
function pixNote() {
  const d = Math.round(screenDpr() * 100) / 100;
  $('#sPixelNote').textContent = (d > 1 ? `Max uses every pixel your screen has: here ${d} times as many each way as 1×.` : "Max uses every pixel your screen has; here that's the same as 1×.")
    + ' Bigger is more retro and less work for phones.';
}
function applyLook() {
  postMat.uniforms.uLevels.value = S.levels;
  postMat.uniforms.uDither.value = S.dither ? 1 : 0;
  postMat.uniforms.uOutline.value = S.outline ? 1 : 0;
  document.body.classList.toggle('scan', !!S.scan);
  setCloth();
}

// ------------------------------------------------------------------ textures
function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.minFilter = THREE.NearestMipmapLinearFilter; }
  else { t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  return t;
}
const woodTex = canvasTex(64, 64, (g, w, h) => {
  g.fillStyle = '#8d4a29'; g.fillRect(0, 0, w, h);
  let y = 0; const tones = ['#7a3d20', '#9b5731', '#84441f', '#a8643a'];
  while (y < h) { const t = 2 + Math.floor(Math.random() * 5); g.fillStyle = tones[Math.floor(Math.random() * 4)]; g.fillRect(0, y, w, 1 + (t > 4 ? 1 : 0)); y += t; }
  g.fillStyle = 'rgba(40,15,5,0.35)'; for (let i = 0; i < 6; i++) g.fillRect(Math.random() * w, Math.random() * h, 6 + Math.random() * 10, 1);
}, [5, 5]);
const railMat = new THREE.MeshLambertMaterial({ map: woodTex });   // the rails' top: wood, or gold (a collection effect)
// The rooms: the menu's own, and one per career tier. carpet and wall: base colour, pattern, accent; skirt: skirting
// board; glow, ink and frame: the neon sign's colours (its words come from the event, or 'Billiards').
const VENUES = {
  home: { carpet: ['#2b1d46', '#31224f', '#48284c'], wall: ['#2a1f45', '#33265a', '#3d2a52'], skirt: '#4a2b3f', glow: '#ff6f8f', ink: '#ffd1dc', frame: '#6cb8ff' },
  pub: { carpet: ['#4a1820', '#6a2428', '#b8913f'], wall: ['#3d2418', '#4c2d1f', '#2a170f'], skirt: '#24130b', glow: '#ff9a3c', ink: '#fff0c9', frame: '#c0392b' },
  club: { carpet: ['#16261d', '#1d3326', '#35553c'], wall: ['#1b3325', '#21402d', '#c9b37a'], skirt: '#33241a', glow: '#5fd68c', ink: '#e6ffe9', frame: '#c9b37a' },
  hall: { carpet: ['#18191d', '#212329', '#363b44'], wall: ['#25282e', '#2e3239', '#1a1c21'], skirt: '#0f1013', glow: '#6cb8ff', ink: '#e1f1ff', frame: '#ff6f8f' },
  national: { carpet: ['#0f1730', '#162244', '#2a3f7a'], wall: ['#121c38', '#18264b', '#c99a3a'], skirt: '#0a0f20', glow: '#ffd36b', ink: '#fff6d9', frame: '#6cb8ff' },
};
const VEN = { key: '', sign: 'Billiards', tex: {} };
function venueTex(key) {
  if (VEN.tex[key]) return VEN.tex[key];
  const v = VENUES[key], [cb, cp, ca] = v.carpet, [wb, wp, wa] = v.wall;
  return (VEN.tex[key] = {
    carpet: canvasTex(32, 32, (g) => {
      g.fillStyle = cb; g.fillRect(0, 0, 32, 32); g.fillStyle = cp;
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const d = Math.abs(x - 16) + Math.abs(y - 16); if (d < 14 && d > 10) g.fillRect(x, y, 1, 1); }
      g.fillStyle = ca; g.fillRect(15, 15, 2, 2); g.fillRect(0, 0, 2, 2); g.fillRect(30, 30, 2, 2); g.fillRect(0, 30, 2, 2); g.fillRect(30, 0, 2, 2);
    }, [16, 16]),
    wall: canvasTex(32, 32, (g) => { g.fillStyle = wb; g.fillRect(0, 0, 32, 32); g.fillStyle = wp; g.fillRect(0, 0, 10, 32); g.fillStyle = wa; g.fillRect(20, 0, 2, 32); }, [16, 3]),
  });
}

const BALL_COL = { 1: '#f2c21b', 2: '#1f52d6', 3: '#d62a2a', 4: '#5c2d91', 5: '#f07b16', 6: '#138a45', 7: '#7b1e22', 8: '#19151f' };
const UK_COL = { red: '#c8202c', yellow: '#f3c613', black: '#17141c' };
const ukStyle = () => T.key === 'uk7';
const ballColor = id => ukStyle() ? (id === 8 ? UK_COL.black : C.isSolid(id) ? UK_COL.red : UK_COL.yellow) : BALL_COL[id > 8 ? id - 8 : id];
const TEX = { us: [], uk: [] };
const ballTex = (id, uk) => (uk ? TEX.uk : TEX.us)[id] || ((uk ? TEX.uk : TEX.us)[id] = ballTexture(id, uk));
function ballTexture(id, uk) {
  return canvasTex(128, 64, (g, w, h) => {
    if (uk && id > 0) { g.fillStyle = id === 8 ? UK_COL.black : C.isSolid(id) ? UK_COL.red : UK_COL.yellow; g.fillRect(0, 0, w, h); return; }
    if (id === 0) {
      g.fillStyle = '#f6f1e2'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#d0302f';
      for (const [x, y] of [[16, 32], [48, 32], [80, 32], [112, 32], [32, 10], [96, 10], [32, 54], [96, 54]]) { g.fillRect(x - 2, y - 2, 4, 4); }
      return;
    }
    if (id >= 9) { g.fillStyle = '#f6f1e2'; g.fillRect(0, 0, w, h); g.fillStyle = ballColor(id); g.fillRect(0, 18, w, 28); }
    else { g.fillStyle = ballColor(id); g.fillRect(0, 0, w, h); }
    for (const cx of [32, 96]) {
      g.fillStyle = '#f6f1e2'; g.beginPath(); g.arc(cx, 32, 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#16121c'; g.font = 'bold 12px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(id), cx, 33);
    }
  });
}

// ------------------------------------------------------------------ scene: lights + room
// physically based light units (r155+): values are the old look scaled by PI
const PI = Math.PI;
const HEMI = new THREE.HemisphereLight(0xb7c0ff, 0x2a1a3a, 0.32 * PI); scene.add(HEMI);
const sun = new THREE.DirectionalLight(0xfff0d8, 0.22 * PI); sun.position.set(0.5, 3, 1.4); scene.add(sun);
const fill = new THREE.DirectionalLight(0xdfe4ff, 0.2 * PI); scene.add(fill); scene.add(fill.target);
for (const x of [-0.62, 0.62]) { const pl = new THREE.PointLight(0xffdca4, 0.51 * PI, 6, 0.43); pl.position.set(x, 1.02, 0); scene.add(pl); }

const FLOOR_Y = -0.77;
const floorMat = new THREE.MeshLambertMaterial({ map: venueTex('home').carpet }), wallMat = new THREE.MeshLambertMaterial({ map: venueTex('home').wall });
const skirtMat = new THREE.MeshLambertMaterial({ color: VENUES.home.skirt });
{
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR_Y; scene.add(floor);
  const mkWall = (w, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 3.4), wallMat); m.position.set(x, FLOOR_Y + 1.7, z); m.rotation.y = ry; scene.add(m); };
  mkWall(16, 0, -4.2, 0); mkWall(16, 0, 4.2, Math.PI); mkWall(8.4, -5.5, 0, Math.PI / 2); mkWall(8.4, 5.5, 0, -Math.PI / 2);
  // skirting
  for (const [w, x, z, ry] of [[16, 0, -4.19, 0], [16, 0, 4.19, Math.PI], [8.4, -5.49, 0, Math.PI / 2], [8.4, 5.49, 0, -Math.PI / 2]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.18), skirtMat); m.position.set(x, FLOOR_Y + 0.09, z); m.rotation.y = ry; scene.add(m);
  }
}
let neonMat = null;
function drawNeon() {
  const v = HALL.on ? HALL.sign : VENUES[VEN.key] || VENUES.home, text = signText();
  const tex = canvasTex(256, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    let size = 22; do g.font = `${size}px "Press Start 2P", monospace`; while (g.measureText(text).width > w - 30 && --size > 9);   // long names get smaller letters
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = v.glow; g.fillText(text, w / 2 + 2, h / 2 + 2);
    g.fillStyle = v.ink; g.fillText(text, w / 2, h / 2);
    g.strokeStyle = v.frame; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h - 12);
  });
  if (!neonMat) {
    neonMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, fog: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.45), neonMat); m.position.set(0.6, 0.95, -4.18); scene.add(m);
  } else { neonMat.map.dispose(); neonMat.map = tex; neonMat.needsUpdate = true; }
}
// dresses the room: key is a VENUES entry, sign the words on the neon sign
function setVenue(key, sign = 'Billiards') {
  if (!VENUES[key]) key = 'home';
  if (VEN.key === key && VEN.sign === sign) return;
  VEN.key = key; VEN.sign = sign; dressRoom();
}
// the room's floor, walls and skirting for the venue; at home the Haunted Hall or the starfield, if earned and switched on
function dressRoom() {
  const key = VEN.key || 'home', home = key === 'home', hall = home && fxOn('haunted'), t = venueTex(key);
  floorMat.map = hall ? hallTex().floor : t.carpet; wallMat.map = hall ? hallTex().wall : home && fxOn('stars') ? starTex() : t.wall; floorMat.needsUpdate = wallMat.needsUpdate = true;
  skirtMat.color.set(hall ? '#100a10' : VENUES[key].skirt); showHall(hall); drawNeon();
}
// The Haunted Hall: the room at home for the Halloween season's grand reward (looks.js, SERIES.halloween.grand), with its
// own switch like the other rewards (it wins over the starfield room). Damask walls and dark boards; jack-o'-lanterns
// round the room, their candles flickering slowly; bats hanging from the beams that stir now and then; cobwebs in the
// corners, on the lamp and on the table legs; two tall windows with a moon and drifting cloud; fog creeping across the
// floor; a crooked portrait whose eyes follow the cue ball; a skeleton slumped in a corner; the neon sign in orange and
// purple. Everything stays by the walls, out of every view of the table. Display only; with reduced motion it all holds
// still (the candles steady). Built the first time it's shown.
const HALL = { g: null, on: false, sign: { glow: '#ff8a1f', ink: '#ffe6c2', frame: '#9b4dff' }, tex: null, lights: [], lanterns: [], bats: [], drift: [], eyes: [], legWebs: [], lampWeb: null };
function hallTex() {
  if (HALL.tex) return HALL.tex;
  const n = makeNoise(121), n2 = makeNoise(122), clear = g => g.clearRect(0, 0, g.canvas.width, g.canvas.height);
  const t = HALL.tex = {
    wall: canvasTex(32, 32, g => {   // damask: a lattice of flourishes, faintly lighter than the plum ground
      g.fillStyle = '#1a0f1f'; g.fillRect(0, 0, 32, 32); g.fillStyle = '#2a1830';
      for (const [cx, cy] of [[16, 16], [0, 0], [32, 0], [0, 32], [32, 32]]) { g.beginPath(); g.moveTo(cx, cy - 9); g.quadraticCurveTo(cx + 7, cy - 3, cx, cy + 9); g.quadraticCurveTo(cx - 7, cy - 3, cx, cy - 9); g.fill(); g.fillRect(cx - 5, cy - 1, 10, 2); }
      g.fillStyle = '#231427'; g.fillRect(0, 15, 32, 1); g.fillRect(15, 0, 1, 32);
    }, [24, 5]),
    floor: canvasTex(64, 64, g => {   // dark boards, each a slightly different shade, with grain and the odd knot
      for (let i = 0; i < 4; i++) { const v = 24 + (i * 7) % 11; g.fillStyle = `rgb(${v + 8},${v - 2},${v - 6})`; g.fillRect(0, i * 16, 64, 16); g.fillStyle = '#0c0807'; g.fillRect(0, i * 16, 64, 1); g.fillRect((i * 23) % 64, i * 16, 1, 16); }
      g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 40; i++) g.fillRect((i * 37) % 64, (i * 13) % 64, 6 + i % 9, 1);
    }, [20, 20]),
    web: canvasTex(64, 64, g => {   // a cobweb spun from the top-left corner
      clear(g); g.strokeStyle = 'rgba(220,220,235,0.55)'; g.lineWidth = 1; g.beginPath();
      for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI / 2; g.moveTo(0, 0); g.lineTo(64 * Math.cos(a), 64 * Math.sin(a)); }
      for (let r = 9; r < 64; r += 8) for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI / 2, s = r * (i % 2 ? 0.92 : 1); if (i) g.lineTo(s * Math.cos(a), s * Math.sin(a)); else g.moveTo(s * Math.cos(a), s * Math.sin(a)); }
      g.stroke();
    }),
    sky: [true, false].map(moon => canvasTex(32, 64, (g, w, h) => {   // the night outside, one window with the moon
      paint(g, w, h, (x, y) => mixc(mixc(rgb('#0b0a24'), rgb('#2a1a4a'), y / h), rgb('#3a2a6a'), Math.max(0, fbm(n, x / 8, y / 8, 3) - 0.55) * 1.5));
      const r = K.rng(moon ? 3 : 4); for (let i = 0; i < 26; i++) { g.fillStyle = r() < 0.8 ? '#8a90c8' : '#ffffff'; g.fillRect(r() * w | 0, r() * h * 0.7 | 0, 1, 1); }
      if (moon) { const glow = g.createRadialGradient(18, 18, 4, 18, 18, 18); glow.addColorStop(0, 'rgba(255,240,200,0.5)'); glow.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = glow; g.fillRect(0, 0, w, 40);
        g.fillStyle = '#f2ead0'; g.beginPath(); g.arc(18, 18, 7, 0, 7); g.fill(); g.fillStyle = '#d8ccaa'; g.fillRect(15, 15, 2, 2); g.fillRect(20, 19, 3, 2); g.fillRect(16, 21, 2, 1); }
      g.fillStyle = '#05040a'; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 2) g.lineTo(x, h - 6 - 4 * fbm(n2, x / 6, 1, 2) - (Math.abs(x - 22) < 2 ? 10 : 0)); g.lineTo(w, h); g.fill();   // hills, and a dead tree
    })),
    cloud: canvasTex(64, 64, (g, w, h) => { paint(g, w, h, () => [0, 0, 0]); const d = g.getImageData(0, 0, w, h);   // drifting cloud: dark, soft-edged, seamless across
      for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) { const c = Math.max(0, fbm(n2, x / 16, y / 10, 4, 4, 0) - 0.48) * 3; d.data[i] = 30; d.data[i + 1] = 22; d.data[i + 2] = 48; d.data[i + 3] = Math.min(220, c * 255); }
      g.putImageData(d, 0, 0); }),
    fog: canvasTex(64, 64, (g, w, h) => { const d = g.createImageData(w, h);   // low fog, seamless both ways
      for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) { const c = Math.max(0, fbm(n, x / 16, y / 16, 4, 4, 4) - 0.4) * 2.2; d.data[i] = 190; d.data[i + 1] = 185; d.data[i + 2] = 215; d.data[i + 3] = Math.min(255, c * 255); }
      g.putImageData(d, 0, 0); }),
    portrait: canvasTex(32, 48, (g, w, h) => {   // a pale gentleman in black, his eyes left blank for the moving ones
      g.fillStyle = '#1c1410'; g.fillRect(0, 0, w, h); g.fillStyle = '#2c2018'; g.fillRect(0, 0, w, h * 0.5);
      g.fillStyle = '#0b0a0c'; g.beginPath(); g.moveTo(3, h); g.quadraticCurveTo(16, 22, 29, h); g.fill();
      g.fillStyle = '#c8bfa8'; g.beginPath(); g.ellipse(16, 18, 7, 9, 0, 0, 7); g.fill(); g.fillStyle = '#d8d0ba'; g.fillRect(14, 31, 4, 3);
      g.fillStyle = '#0b0a0c'; g.beginPath(); g.ellipse(16, 11, 8, 4, 0, Math.PI, 0); g.fill(); g.fillRect(13, 25, 6, 1);
      g.fillStyle = '#e8e4d8'; g.fillRect(11, 16, 4, 3); g.fillRect(17, 16, 4, 3);
    }),
    face: canvasTex(64, 32, g => {   // a jack-o'-lantern's carving (the glow map), on the side of the pumpkin facing +z
      g.fillStyle = '#000000'; g.fillRect(0, 0, 64, 32); g.fillStyle = '#ffffff';
      const cx = 16, poly = p => { g.beginPath(); p.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.fill(); };
      poly([[cx - 6, 14], [cx - 2, 14], [cx - 4, 10]]); poly([[cx + 2, 14], [cx + 6, 14], [cx + 4, 10]]); poly([[cx - 1, 17], [cx + 1, 17], [cx, 15]]);
      poly([[cx - 7, 19], [cx - 4, 21], [cx - 2, 19], [cx, 21], [cx + 2, 19], [cx + 4, 21], [cx + 7, 19], [cx + 5, 24], [cx - 5, 24]]);
    }),
  };
  t.web.magFilter = THREE.NearestFilter;
  for (const k of ['cloud', 'fog']) { t[k].wrapS = t[k].wrapT = THREE.RepeatWrapping; }
  return t;
}
function buildHall() {
  const g = HALL.g = new THREE.Group(), t = hallTex(), Fy = FLOOR_Y, top = Fy + 3.4; g.visible = false; scene.add(g);
  const lam = (col, o = {}) => new THREE.MeshLambertMaterial({ color: col, flatShading: true, ...o }), add = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; };
  const wood = lam('#2a1a14'), bone = lam('#e6dec6'), dark = lam('#0b0a0c');
  // beams along the walls (never over the table), the bats hanging from them
  for (const z of [-3.5, 3.5]) add(new THREE.BoxGeometry(10.6, 0.16, 0.2), wood, 0, top - 0.5, z);
  for (const x of [-4.9, 4.9]) add(new THREE.BoxGeometry(0.2, 0.16, 6.8), wood, x, top - 0.5, 0);
  const batMat = lam('#16121c'), wingG = new THREE.BufferGeometry(); wingG.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.11, -0.02, 0, 0, -0.13, 0, 0.11, -0.02, 0, 0.07, -0.1, 0, 0, -0.13, 0], 3)); wingG.computeVertexNormals();
  const r = K.rng(131);
  for (const [x, z] of [[-3.8, -3.5], [-1.2, -3.5], [2.1, -3.5], [3.6, -3.5], [-2.6, 3.5], [0.6, 3.5], [3.0, 3.5], [-4.9, 1.6], [4.9, -1.2]]) {
    const b = new THREE.Group(); b.position.set(x + (r() - 0.5) * 0.4, top - 0.58, z); b.rotation.y = r() * 6.28; b.scale.setScalar(1.9); g.add(b);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), batMat); body.scale.set(1, 1.7, 0.9); body.position.y = -0.07; b.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), batMat); head.position.y = -0.14; b.add(head);
    const wings = [-1, 1].map(s => { const w = new THREE.Mesh(wingG, new THREE.MeshLambertMaterial({ color: '#16121c', side: THREE.DoubleSide, flatShading: true })); w.position.set(0, -0.02, 0); w.scale.x = s; b.add(w); return w; });
    HALL.bats.push({ wings, next: 3 + r() * 12, t0: -9 });
  }
  // jack-o'-lanterns: ribbed pumpkins, carved on the side facing the room, a candle glowing in each
  const pumpG = new THREE.SphereGeometry(1, 14, 9), pp = pumpG.attributes.position;
  for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), z = pp.getZ(i), a = Math.atan2(z, x), k = 1 + 0.07 * Math.cos(a * 8); pp.setXYZ(i, x * k, pp.getY(i) * 0.78, z * k); }
  pumpG.computeVertexNormals();
  const stalkG = new THREE.CylinderGeometry(0.08, 0.12, 0.35, 5), stalkM = lam('#3a5a1f');
  const spots = [[-5.0, -3.6, 0.4], [-4.45, -3.85, 0.27], [-5.1, -3.0, 0.23], [-5.0, 3.6, 0.38], [-4.4, 3.85, 0.22], [5.0, -3.6, 0.36], [4.45, -3.85, 0.24], [4.15, 3.8, 0.27], [-1.9, -3.9, 0.25], [2.9, -3.9, 0.3], [-5.1, 0.9, 0.26], [5.1, 1.4, 0.3]];
  for (const [x, z, s] of spots) {
    const m = lam('#d0601a', { emissive: '#ffb03a', emissiveMap: t.face, emissiveIntensity: 1 }), p = add(pumpG, m, x, Fy + s * 0.78, z);
    p.scale.setScalar(s); p.rotation.y = Math.atan2(-x, -z) + (r() - 0.5) * 0.5;   // facing into the room (its carving is on +z)
    const st = new THREE.Mesh(stalkG, stalkM); st.position.y = 0.85; st.rotation.z = (r() - 0.5) * 0.5; p.add(st);
    HALL.lanterns.push({ m, ph: r() * 6.28 });
  }
  for (const [x, z] of [[-4.6, -3.3], [4.3, 3.4], [4.6, -3.3]]) { const l = new THREE.PointLight(0xff8a2a, 0.85 * PI, 5, 1.3); l.position.set(x, Fy + 0.55, z); g.add(l); HALL.lights.push(l); }
  // two tall arched windows on the far wall, the sky behind and cloud drifting across; a lantern on each sill
  const arch = (w, h) => { const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h - w / 2); s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false); s.lineTo(-w / 2, 0); return s; };
  const archUV = (geo, w, h) => { const p = geo.attributes.position, uv = []; for (let i = 0; i < p.count; i++) uv.push(p.getX(i) / w + 0.5, p.getY(i) / h); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return geo; };
  [-2.4, 1.6].forEach((x, i) => {
    const wnd = new THREE.Group(), W = 1.15, H = 2.0; wnd.position.set(x, Fy + 1.05, 4.19); wnd.rotation.y = Math.PI; g.add(wnd);
    const skyM = new THREE.MeshBasicMaterial({ map: t.sky[i], fog: false }), sky = new THREE.Mesh(archUV(new THREE.ShapeGeometry(arch(W, H), 12), W, H), skyM); wnd.add(sky);
    const cloudT = t.cloud.clone(); cloudT.needsUpdate = true; cloudT.repeat.set(1.5, 1); const cl = new THREE.Mesh(sky.geometry, new THREE.MeshBasicMaterial({ map: cloudT, transparent: true, depthWrite: false, fog: false }));
    cl.position.z = 0.005; wnd.add(cl); HALL.drift.push({ tex: cloudT, sx: 0.006 + i * 0.002, sy: 0 });
    const frame = lam('#140c0a'), bar = (bw, bh, bx, by) => { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.06), frame); m.position.set(bx, by, 0.02); wnd.add(m); };
    bar(0.08, H - W / 2, -W / 2, (H - W / 2) / 2); bar(0.08, H - W / 2, W / 2, (H - W / 2) / 2); bar(W + 0.2, 0.1, 0, -0.03); bar(0.05, H, 0, H / 2); bar(W, 0.05, 0, H * 0.45);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(W / 2, 0.04, 4, 12, Math.PI), frame); ring.position.set(0, H - W / 2, 0.02); wnd.add(ring);
    const p = new THREE.Mesh(pumpG, lam('#d0601a', { emissive: '#ffb03a', emissiveMap: t.face })); p.scale.setScalar(0.13); p.position.set(W * 0.28, 0.1, -0.12); p.rotation.y = Math.PI; wnd.add(p); HALL.lanterns.push({ m: p.material, ph: r() * 6.28 });
  });
  // cobwebs in the top corners of the room, on both walls of each corner
  const webM = new THREE.MeshBasicMaterial({ map: t.web, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }), webG = new THREE.PlaneGeometry(1.1, 1.1);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const a = add(webG, webM, sx * 5.49, top - 0.55, sz * (4.19 - 0.55), sx > 0 ? -Math.PI / 2 : Math.PI / 2); a.scale.x = sx * sz;   // on the end wall
    const b = add(webG, webM, sx * (5.49 - 0.55), top - 0.55, sz * 4.19, sz > 0 ? Math.PI : 0); b.scale.x = -sx * sz;   // on the side wall
  }
  for (let i = 0; i < 4; i++) { const w = add(new THREE.PlaneGeometry(0.34, 0.34), webM, 0, -0.3, 0); HALL.legWebs.push(w); }   // placed by the table's legs each frame
  HALL.lampWeb = add(new THREE.PlaneGeometry(0.5, 0.5), webM, 0, 1.5, 0);
  // fog creeping over the floor, in three thin layers drifting different ways
  for (const [y, o, sx, sy] of [[0.05, 0.3, 0.012, 0.004], [0.16, 0.2, -0.008, 0.006], [0.3, 0.12, 0.005, -0.007]]) {
    const ft = t.fog.clone(); ft.needsUpdate = true; ft.repeat.set(4, 2);
    const f = add(new THREE.PlaneGeometry(15.6, 8.0), new THREE.MeshBasicMaterial({ map: ft, transparent: true, opacity: o, depthWrite: false, fog: false }), 0, Fy + y, 0); f.rotation.x = -Math.PI / 2; f.renderOrder = 1;
    HALL.drift.push({ tex: ft, sx, sy });
  }
  // the crooked portrait on the left-hand wall, its eyes following the cue ball
  const pt = new THREE.Group(); pt.position.set(-5.44, Fy + 1.85, 0.6); pt.rotation.set(0, Math.PI / 2, 0); g.add(pt);
  const tilt = new THREE.Group(); tilt.rotation.z = 0.11; pt.add(tilt);
  const gilt = lam('#7a5a22'); for (const [bw, bh, bx, by] of [[0.86, 0.08, 0, 0.56], [0.86, 0.08, 0, -0.56], [0.08, 1.2, -0.43, 0], [0.08, 1.2, 0.43, 0]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.06), gilt); m.position.set(bx, by, 0); tilt.add(m); }
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 1.04), new THREE.MeshLambertMaterial({ map: t.portrait })); pic.position.z = -0.01; tilt.add(pic);
  t.portrait.magFilter = THREE.NearestFilter;
  for (const ex of [-0.075, 0.075]) { const p = new THREE.Mesh(new THREE.CircleGeometry(0.018, 6), dark); p.position.set(ex, 0.13, 0.005); tilt.add(p); HALL.eyes.push({ p, x: ex, y: 0.13 }); }
  HALL.portrait = tilt;
  // a skeleton slumped in the far corner, back to the wall, legs out across the floor
  const sk = new THREE.Group(); sk.position.set(5.05, Fy, 3.75); sk.rotation.y = Math.PI * 1.25; g.add(sk);
  const cap = (r0, len, x, y, z, rx, rz) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r0, len, 2, 5), bone); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); sk.add(m); return m; };
  const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.16), bone); pelvis.position.set(0, 0.1, 0.12); sk.add(pelvis);
  for (let i = 0; i < 6; i++) cap(0.025, 0.03, 0, 0.18 + i * 0.075, 0.1 - i * 0.022, -0.3, 0);   // the spine, leaning back to the wall
  for (let i = 0; i < 4; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(0.11 - i * 0.008, 0.012, 3, 8, Math.PI * 1.3), bone); rib.position.set(0, 0.34 + i * 0.07, 0.07 - i * 0.02); rib.rotation.set(Math.PI / 2 - 0.3, 0, Math.PI * 1.15); sk.add(rib); }
  const skull = new THREE.Group(); skull.position.set(0.04, 0.74, -0.04); skull.rotation.set(0.35, 0.3, 0.35); sk.add(skull);
  const cran = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), bone); cran.scale.set(0.9, 1, 1.05); skull.add(cran);
  for (const ex of [-0.035, 0.035]) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 4), dark); s.position.set(ex, 0.005, 0.085); skull.add(s); }
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.04, 0.08), bone); jaw.position.set(0, -0.085, 0.04); jaw.rotation.x = 0.35; skull.add(jaw);   // dropped open
  for (const s of [-1, 1]) {
    cap(0.022, 0.24, s * 0.17, 0.48, 0.1, 0.2, s * 0.25); cap(0.019, 0.22, s * 0.21, 0.24, 0.2, 0.9, s * 0.1);   // arms hanging, hands on the floor
    cap(0.03, 0.34, s * 0.09, 0.07, 0.36, Math.PI / 2, 0); cap(0.025, 0.32, s * 0.11, 0.07, 0.74, Math.PI / 2, s * 0.05);   // legs out in front
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.13), bone); foot.position.set(s * 0.11, 0.05, 0.96); sk.add(foot);
  }
}
// switches the hall in or out (the room's walls, floor and light are set by dressRoom)
function showHall(on) {
  HALL.on = on; if (on && !HALL.g) buildHall();
  if (HALL.g) HALL.g.visible = on;
  HEMI.intensity = (on ? 0.22 : 0.32) * PI; HEMI.color.set(on ? '#9a88cc' : '#b7c0ff');
}
// each frame while it's shown: candles, bats, cloud, fog, the portrait's eyes, and the cobwebs by the table's legs and lamp
const vH = new THREE.Vector3();
function hallFx(now) {
  if (!HALL.on || !HALL.g) return;
  const t = reduceMotion ? 0 : now / 1000;
  for (const L of HALL.lanterns) L.m.emissiveIntensity = reduceMotion ? 0.9 : 0.82 + 0.12 * Math.sin(t * 2.1 + L.ph) * Math.sin(t * 0.7 + L.ph * 2);
  HALL.lights.forEach((l, i) => { l.intensity = (reduceMotion ? 0.85 : 0.8 + 0.1 * Math.sin(t * 1.9 + i * 2) * Math.sin(t * 0.6 + i)) * PI; });
  for (const b of HALL.bats) {   // folded, until now and then one opens its wings for a moment
    if (!reduceMotion && t > b.next) { b.t0 = t; b.next = t + 8 + ((b.next * 7.3) % 1) * 14; }
    const u = (t - b.t0) / 1.4, k = u > 0 && u < 1 ? Math.sin(u * Math.PI) : 0;
    for (const w of b.wings) w.rotation.y = (w.scale.x > 0 ? -1 : 1) * (1.35 - 1.1 * k);
  }
  for (const d of HALL.drift) d.tex.offset.set(t * d.sx, t * d.sy);
  const cue = world.balls[0]; vH.set(cue.x, R, cue.z); HALL.portrait.worldToLocal(vH);
  for (const e of HALL.eyes) { const dx = vH.x - e.x, dy = vH.y - e.y, dz = Math.max(0.5, vH.z), k = reduceMotion ? 0 : 0.012; e.p.position.set(e.x + clamp(dx / dz, -1, 1) * k, e.y + clamp(dy / dz, -1, 1) * k * 0.6, 0.005); }
  HALL.legWebs.forEach((w, i) => { const sx = i % 2 ? 1 : -1, sz = i < 2 ? 1 : -1; w.position.set(sx * (T.hl - 0.1), -0.34, sz * (T.hw + 0.05)); w.scale.x = -sx; w.rotation.y = sz > 0 ? Math.PI : 0; });
  const rod = LAMP[LAMP.length - 1]; if (rod) { HALL.lampWeb.position.set(rod.position.x * 0.55, 1.5, 0.002); HALL.lampWeb.scale.set(rod.position.x > 0 ? -1 : 1, 1, 1); }
}
setVenue('home');
if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawNeon);

// ------------------------------------------------------------------ table
const clothMat = new THREE.MeshLambertMaterial({ color: '#1d8a74' });
const cushMat = new THREE.MeshLambertMaterial({ color: '#187563' });
// A patterned cloth (looks.js) is drawn onto the bed as a texture, metre for metre; a plain one is just a colour. The
// bed's texture coordinates are its x and z in metres, so repeat and offset map the whole bed onto the picture once.
// A mythic cloth moves (clothFx, every frame): 'flow' drifts its pattern slowly along the table (the picture repeats
// end to end), 'pulse' makes its cracks glow and fade through a glow map drawn from the same pattern.
let clothTex = null, clothGlow = null;
const CLOTH_CACHE = new Map(), PAINTED = ['galaxy', 'synth', 'aurora', 'lava', 'mist', 'lantern', 'moon', 'soul'];   // the last few cloth pictures made
// Preview (in the locker section): the looks tried on at the table, which the cloth, cue and gloves use while it's on
const PREV = { on: false, looks: null, cam: null, aim: null, t0: 0 };
function setCloth() {
  const id = PREV.on ? PREV.looks.cloth : NET.on && NET.cloth ? NET.cloth : S.cloth, base = (CLOTHS[id] || CLOTHS.teal)[0], it = K.has(LK.ALL, id) && LK.ALL[id].pat ? LK.ALL[id] : null;
  const key = it ? id + T.key : '';
  if (!it) clothTex = clothGlow = null;
  else if (CLOTH_CACHE.has(key)) ({ tex: clothTex, glow: clothGlow } = CLOTH_CACHE.get(key));
  else {
    const ex = 2 * (T.hl + 0.13), ez = 2 * (T.hw + 0.13), ppm = PAINTED.includes(it.pat) ? (it.pat === 'lava' || it.pat === 'moon' ? 200 : 150) : 300, make = mask => {
      const t = canvasTex(Math.round(ex * ppm), Math.round(ez * ppm), (g, w, h) => drawPattern(g, it, w, h, ppm, mask));
      t.repeat.set(1 / ex, 1 / ez); t.offset.set(0.5, 0.5); t.userData.key = key;
      t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;   // no shimmer at a distance
      if (it.anim === 'flow') t.wrapS = THREE.RepeatWrapping;
      return t;
    };
    clothTex = make(false); clothGlow = it.anim === 'pulse' ? make(true) : null;
    CLOTH_CACHE.set(key, { tex: clothTex, glow: clothGlow });
    if (CLOTH_CACHE.size > 4) { const [k0, e0] = CLOTH_CACHE.entries().next().value; e0.tex.dispose(); if (e0.glow) e0.glow.dispose(); CLOTH_CACHE.delete(k0); }
  }
  if (clothMat.map !== clothTex || clothMat.emissiveMap !== clothGlow) { clothMat.map = clothTex; clothMat.emissiveMap = clothGlow; clothMat.needsUpdate = true; }
  clothMat.color.set(clothTex ? '#ffffff' : base); clothMat.emissive.set('#000000'); cushMat.color.set(base).multiplyScalar(0.84);
  CLOTH_FX.it = it && it.anim ? it : null;
}
const CLOTH_FX = { it: null };
function clothFx(now) {
  const it = CLOTH_FX.it; if (!it || !clothTex) return;
  const t = reduceMotion ? 0 : now / 1000;
  if (it.anim === 'flow') clothTex.offset.x = 0.5 + t * 0.012;
  else if (it.anim === 'pulse') clothMat.emissive.set(it.col2).multiplyScalar(0.35 + 0.3 * (0.5 + 0.5 * Math.sin(t * 1.6)));
}
// draws a cloth's pattern over its colour; m is pixels per metre, so the patterns keep their real size. mask: the glow
// map of a pulsing cloth instead (black, with its glowing parts white)
function drawPattern(g, it, w, h, m, mask) {
  if (it.pat === 'galaxy') return clothGalaxy(g, it, w, h, m);
  if (it.pat === 'synth') return clothSynth(g, it, w, h, m);
  if (it.pat === 'aurora') return clothAurora(g, it, w, h, m);
  if (it.pat === 'lava') return clothMagma(g, it, w, h, m, mask);
  if (it.pat === 'mist') return clothMist(g, it, w, h, m);
  if (it.pat === 'lantern') return clothLantern(g, it, w, h, m);
  if (it.pat === 'moon') return clothMoon(g, it, w, h, m, mask);
  if (it.pat === 'soul') return clothSoul(g, it, w, h, m);
  const r = K.rng(7), c2 = it.col2, lw = v => { g.lineWidth = Math.max(1, v * m); };
  g.fillStyle = mask ? '#000000' : it.col; g.fillRect(0, 0, w, h); g.fillStyle = g.strokeStyle = c2; g.beginPath();
  const poly = pts => pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
  if (it.pat === 'pin') for (let y = 0; y < h; y += 0.07 * m) g.fillRect(0, y, w, Math.max(1, 0.005 * m));
  else if (it.pat === 'dots') { const s = 0.09 * m; for (let y = 0, row = 0; y < h + s; y += s / 2, row++) for (let x = row % 2 * s / 2; x < w + s; x += s) { g.moveTo(x + 0.012 * m, y); g.arc(x, y, 0.012 * m, 0, 7); } g.fill(); }
  else if (it.pat === 'herring') { const s = 0.05 * m; lw(0.008); for (let y = 0; y < h + s; y += s) for (let x = 0; x < w + s; x += 2 * s) poly([[x, y], [x + s, y + s * 0.6], [x + 2 * s, y]]); g.stroke(); }
  else if (it.pat === 'diamond') { const s = 0.16 * m; lw(0.006); for (let k = -h; k < w + h; k += s) { poly([[k, 0], [k + h, h]]); poly([[k + h, 0], [k, h]]); } g.stroke(); }
  else if (it.pat === 'wave') { const s = 0.1 * m; lw(0.008); for (let y = 0; y < h + s; y += s) for (let x = 0; x <= w; x += 3) { const yy = y + Math.sin(x / (0.16 * m) * 2 * Math.PI) * 0.02 * m; if (x) g.lineTo(x, yy); else g.moveTo(x, yy); } g.stroke(); }
  else if (it.pat === 'tartan') {
    const s = 0.3 * m; g.globalAlpha = 0.6; for (let x = 0; x < w; x += s) g.fillRect(x, 0, 0.1 * m, h); for (let y = 0; y < h; y += s) g.fillRect(0, y, w, 0.1 * m);
    g.globalAlpha = 1; for (let x = 0.2 * m; x < w; x += s) g.fillRect(x, 0, Math.max(1, 0.008 * m), h); for (let y = 0.2 * m; y < h; y += s) g.fillRect(0, y, w, Math.max(1, 0.008 * m));
  } else if (it.pat === 'hex') {
    const s = 0.06 * m, hh = s * Math.sqrt(3); lw(0.005);
    for (let row = 0, y = 0; y < h + hh; y += hh / 2, row++) for (let x = row % 2 * 1.5 * s; x < w + 3 * s; x += 3 * s) poly([0, 1, 2, 3, 4, 5, 6].map(i => [x + s * Math.cos(i * Math.PI / 3), y + s * Math.sin(i * Math.PI / 3)]));
    g.stroke();
  } else if (it.pat === 'stars') for (let i = 0; i < w * h / (m * m) * 60; i++) { const x = r() * w, y = r() * h, z = (r() < 0.15 ? 0.008 : 0.004) * m; g.fillRect(x - z, y - z / 3, 2 * z, z * 2 / 3); g.fillRect(x - z / 3, y - z, z * 2 / 3, 2 * z); }
  else if (it.pat === 'circuit') {
    const q = 0.04 * m; lw(0.006);
    for (let i = 0; i < w * h / (m * m) * 14; i++) {
      let x = Math.round(r() * w / q) * q, y = Math.round(r() * h / q) * q; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 3; k++) { if (r() < 0.5) x += (r() < 0.5 ? -2 : 2) * q; else y += (r() < 0.5 ? -2 : 2) * q; g.lineTo(x, y); }
      g.stroke(); g.fillRect(x - 0.01 * m, y - 0.01 * m, 0.02 * m, 0.02 * m);
    }
  } else if (it.pat === 'seeds') {   // pumpkin seeds, scattered at every angle
    for (let i = 0; i < w * h / (m * m) * 90; i++) { const x = r() * w, y = r() * h, a = r() * Math.PI; g.beginPath(); g.ellipse(x, y, 0.009 * m, 0.0045 * m, a, 0, 7); g.fill(); }
  } else if (it.pat === 'graves') {   // rows of little headstones and crosses, leaning this way and that
    const stone = (x, y, s, a, cross) => { g.save(); g.translate(x, y); g.rotate(a); g.beginPath();
      if (cross) { g.rect(-s * 0.12, -s, s * 0.24, s); g.rect(-s * 0.4, -s * 0.78, s * 0.8, s * 0.2); } else { g.moveTo(-s * 0.35, 0); g.lineTo(-s * 0.35, -s * 0.65); g.arc(0, -s * 0.65, s * 0.35, Math.PI, 0); g.lineTo(s * 0.35, 0); }
      g.fill(); g.restore(); };
    for (let y = 0.09 * m; y < h + 0.1 * m; y += 0.16 * m) for (let x = (y / m * 7 % 1) * 0.2 * m; x < w; x += (0.15 + r() * 0.12) * m) stone(x, y + (r() - 0.5) * 0.03 * m, (0.04 + r() * 0.02) * m, (r() - 0.5) * 0.3, r() < 0.3);
  } else if (it.pat === 'bats') {   // a flock of small bats on the wing
    const bat = (x, y, s, a) => { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(-s, 0); g.quadraticCurveTo(-s * 0.6, -s * 0.5, -s * 0.15, -s * 0.12);
      g.lineTo(0, -s * 0.3); g.lineTo(s * 0.15, -s * 0.12); g.quadraticCurveTo(s * 0.6, -s * 0.5, s, 0); g.quadraticCurveTo(s * 0.7, -s * 0.05, s * 0.55, s * 0.18);
      g.quadraticCurveTo(s * 0.4, 0, s * 0.25, s * 0.2); g.quadraticCurveTo(s * 0.1, 0.05 * s, 0, s * 0.3); g.quadraticCurveTo(-s * 0.1, 0.05 * s, -s * 0.25, s * 0.2);
      g.quadraticCurveTo(-s * 0.4, 0, -s * 0.55, s * 0.18); g.quadraticCurveTo(-s * 0.7, -s * 0.05, -s, 0); g.fill(); g.restore(); };
    for (let i = 0; i < w * h / (m * m) * 14; i++) bat(r() * w, r() * h, (0.022 + r() * 0.014) * m, (r() - 0.5) * 0.8);
  } else if (it.pat === 'web') {   // cobwebs spun across the corners, and a few hanging loose
    lw(0.0025);
    const web = (cx, cy, R, a0, a1) => {
      const k = 9; for (let i = 0; i <= k; i++) { const a = a0 + (a1 - a0) * i / k; g.moveTo(cx, cy); g.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a)); }
      for (let ring = 1; ring <= 7; ring++) { const rr = R * ring / 7; for (let i = 0; i <= k; i++) { const a = a0 + (a1 - a0) * i / k, sag = i % 1 ? 1 : 0.93 + 0.07 * Math.cos(Math.PI * (i % 1)), x = cx + rr * sag * Math.cos(a), y = cy + rr * sag * Math.sin(a); if (i) g.lineTo(x, y); else g.moveTo(x, y); } }
    };
    const R = Math.min(w, h) * 0.42;
    web(0, 0, R, 0, Math.PI / 2); web(w, 0, R, Math.PI / 2, Math.PI); web(0, h, R, -Math.PI / 2, 0); web(w, h, R, Math.PI, Math.PI * 1.5);
    for (let i = 0; i < 3; i++) web(w * (0.3 + 0.2 * i), h * (0.35 + 0.15 * (i % 2)), 0.12 * m, 0, Math.PI * 2);
    g.stroke();
  } else if (it.pat === 'bubbles') {   // a brew bubbling: rings of every size, a few catching the light
    lw(0.003);
    for (let i = 0; i < w * h / (m * m) * 70; i++) { const x = r() * w, y = r() * h, rr = (0.006 + Math.pow(r(), 2) * 0.03) * m; g.moveTo(x + rr, y); g.arc(x, y, rr, 0, 7); }
    g.stroke(); g.globalAlpha = 0.7;
    for (let i = 0; i < w * h / (m * m) * 18; i++) { const x = r() * w, y = r() * h; g.fillRect(x, y, Math.max(1, 0.004 * m), Math.max(1, 0.004 * m)); }
    g.globalAlpha = 1;
  } else if (it.pat === 'spider') {   // one great web across the middle of the bed, its spider waiting near the centre
    const x = w / 2, y = h / 2, R = h * 0.46, k = 14; lw(0.004);
    for (let i = 0; i < k; i++) { const a = i / k * 2 * Math.PI; g.moveTo(x, y); g.lineTo(x + R * 1.4 * Math.cos(a), y + R * Math.sin(a)); }
    for (let t = 0.06; t < 1; t += 0.055) for (let i = 0; i <= k; i++) { const a = i / k * 2 * Math.PI, rr = R * t * (0.92 + 0.08 * Math.cos(a * 7)), px = x + rr * 1.4 * Math.cos(a), py = y + rr * Math.sin(a); if (i) g.lineTo(px, py); else g.moveTo(px, py); }
    g.stroke();
    const sx = x + R * 0.18, sy = y - R * 0.1, sz = 0.02 * m; g.beginPath(); g.ellipse(sx, sy, sz, sz * 1.3, 0.4, 0, 7); g.fill(); g.beginPath(); g.arc(sx - sz * 0.5, sy - sz * 1.4, sz * 0.6, 0, 7); g.fill();
    lw(0.003); g.beginPath(); for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) { const yy = sy - sz * 0.6 + i * sz * 0.5; g.moveTo(sx, yy); g.lineTo(sx + sd * sz * 2.2, yy - sz * (0.8 - i * 0.5)); g.lineTo(sx + sd * sz * 2.8, yy + sz * (0.4 + i * 0.3)); } g.stroke();
  } else if (it.pat === 'crown') {   // one large crown in a ring, in the middle of the bed
    const x = w / 2, y = h / 2, s = Math.min(0.22 * m, h / 5); lw(0.012);
    poly([[x - s, y + s * 0.5], [x - s, y - s * 0.45], [x - s * 0.5, y], [x, y - s * 0.65], [x + s * 0.5, y], [x + s, y - s * 0.45], [x + s, y + s * 0.5]]); g.closePath();
    g.moveTo(x + s * 1.7, y); g.arc(x, y, s * 1.7, 0, 7); g.stroke();
  }
}
// The legendary and mythic cloths, painted pixel by pixel from noise (makeNoise, fbm and paint are in "collection
// effects"). They stay mostly dark, so the balls stand out. x / m and y / m are metres on the bed.
const clampc = c => [Math.min(255, c[0]), Math.min(255, c[1]), Math.min(255, c[2])];
function starDots(g, w, h, m, seed, perM2, cols) {   // scattered stars: most a pixel, a few with a little cross of light
  const r = K.rng(seed), n = Math.round(w * h / (m * m) * perM2);
  for (let i = 0; i < n; i++) {
    const x = r() * w | 0, y = r() * h | 0, b = r(); g.fillStyle = cols[b < 0.7 ? 0 : b < 0.95 ? 1 : 2]; g.fillRect(x, y, 1, 1);
    if (b > 0.97 && m > 150) { g.globalAlpha = 0.5; g.fillRect(x - 2, y, 5, 1); g.fillRect(x, y - 2, 1, 5); g.globalAlpha = 1; }
  }
}
// Galaxy: drifting clouds of violet, rose and blue dust over deep space, a spiral galaxy, and stars
function clothGalaxy(g, it, w, h, m) {
  const n = makeNoise(31), n2 = makeNoise(32), deep = rgb('#06041a'), base = rgb(it.col), neb = [rgb('#2d5fb8'), rgb('#5b2a9c'), rgb('#b0408f')], glow = rgb('#eadcff');
  const gx = 0.7 * w / m, gy = 0.38 * h / m, sz = Math.min(w, h) / m;
  paint(g, w, h, (x, y) => {
    const X = x / m, Y = y / m, wx = fbm(n2, X * 2, Y * 2, 3) * 1.4, wy = fbm(n2, X * 2 + 7, Y * 2 + 3, 3) * 1.4;
    const d = fbm(n, X * 1.5 + wx, Y * 1.5 + wy, 5), hue = fbm(n2, X * 0.7 + 3, Y * 0.7, 2);
    let c = mixc(deep, base, Math.min(1, d * 1.2));
    c = mixc(c, hue < 0.48 ? mixc(neb[0], neb[1], hue / 0.48) : mixc(neb[1], neb[2], (hue - 0.48) / 0.52), Math.max(0, d - 0.5) * 2);
    c = mixc(c, glow, Math.pow(Math.max(0, d - 0.72) * 3, 2) * 0.6);   // the brightest wisps
    const dx = (X - gx) / sz, dy = (Y - gy) / sz * 1.7, r = Math.hypot(dx, dy) + 1e-4, a = Math.atan2(dy, dx);
    const arm = Math.pow(Math.max(0, Math.cos(2 * a - Math.log(r) * 4)), 8) * Math.exp(-r * 9), core = Math.exp(-r * r * 900);
    return clampc(mixc(c, glow, Math.min(0.9, arm * 0.9 + core)));
  });
  starDots(g, w, h, m, 7, 300, ['#7f78b8', '#d9d2ff', '#ffffff']);
}
// Synthwave: a neon grid running away from each end of the table to a horizon across the middle, where a striped sun
// sets in pink and gold (mirrored, so it reads from either end)
function clothSynth(g, it, w, h, m) {
  const cx = w / 2, cy = h / 2, R = h * 0.27, sky = g.createLinearGradient(0, 0, w, 0);
  sky.addColorStop(0, '#0d0420'); sky.addColorStop(0.36, it.col); sky.addColorStop(0.47, '#5a1757'); sky.addColorStop(0.5, '#7a1f5c'); sky.addColorStop(0.53, '#5a1757'); sky.addColorStop(0.64, it.col); sky.addColorStop(1, '#0d0420');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  starDots(g, w, h, m, 3, 120, ['#6b4f9e', '#c8b8ff', '#ffffff']);
  const line = (x1, y1, x2, y2) => { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
  const grid = (wd, col, al) => {
    g.strokeStyle = col; g.globalAlpha = al; g.lineWidth = Math.max(1, wd * h);
    for (const sd of [-1, 1]) {
      for (let k = 0; k < 14; k++) { const f = 1 / (1 + 0.55 * k), x = cx + sd * (w / 2) * f; if (Math.abs(x - cx) > R * 0.9) line(x, 0, x, h); }   // rungs, closer together towards the horizon
      for (let j = -8; j <= 8; j++) { const y = cy + j * h * 0.14; line(cx + sd * R * 0.9, cy + (y - cy) * R * 0.9 / (w / 2), cx + sd * w / 2, y); }   // rails to the vanishing point
    }
  };
  grid(0.03, '#ff2fa0', 0.09); grid(0.012, '#ff4fd8', 0.2); grid(0.004, '#ffb3ee', 0.5);
  g.globalAlpha = 1;
  const halo = g.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 2.2); halo.addColorStop(0, 'rgba(255,90,170,0.32)'); halo.addColorStop(1, 'rgba(255,90,170,0)');
  g.fillStyle = halo; g.fillRect(cx - R * 2.2, cy - R * 2.2, R * 4.4, R * 4.4);
  const sun = g.createLinearGradient(cx - R, 0, cx + R, 0);
  sun.addColorStop(0, '#ffb04a'); sun.addColorStop(0.42, '#ff6a8a'); sun.addColorStop(0.5, '#ff3d8b'); sun.addColorStop(0.58, '#ff6a8a'); sun.addColorStop(1, '#ffb04a');
  g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip(); g.globalAlpha = 0.45; g.fillStyle = sun; g.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  g.globalAlpha = 1; g.fillStyle = '#2b0a35';   // the slices, wider towards the horizon
  for (let k = 0; k < 6; k++) { const off = R * (0.08 + 0.13 * k), th = R * (0.075 - 0.011 * k); for (const sd of [-1, 1]) g.fillRect(cx + sd * off - th / 2, cy - R, th, 2 * R); }
  g.restore();
}
// Aurora: curtains of green light with violet and cyan tops, rippling and streaked with rays, over a night sky. The
// noise repeats exactly across the width, so the picture can drift endlessly along the table.
function clothAurora(g, it, w, h, m) {
  const W = w / m, H = h / m, per = Math.max(2, Math.round(W / 0.45)), cell = W / per, n = makeNoise(41), BIG = 0;
  const sky0 = rgb('#02090f'), sky1 = rgb(it.col), green = rgb(it.col2), tops = [rgb('#7ff6ff'), rgb(it.col3), rgb('#7ff6ff')];
  paint(g, w, h, (x, y) => {
    const X = x / m / cell, Y = y / m;
    let c = mixc(sky0, sky1, 0.35 + 0.65 * fbm(n, X, Y * 2, 3, per, BIG));
    for (let k = 0; k < 3; k++) {
      const yc = (0.2 + 0.3 * k) * H + (fbm(n, X + k * 17, k * 5.3, 3, per, BIG) - 0.5) * 0.55 * H, d = Y - yc;
      const body = d < 0 ? Math.exp(d / 0.13) : Math.exp(-d * d / 0.0006);   // a sharp lower edge, fading away above
      const rays = 0.45 + 0.55 * Math.pow(n(X * 9 + k * 31, Y * 0.8, per * 9, BIG), 1.5), I = body * rays * (0.6 + 0.4 * fbm(n, X * 2 + k * 9, Y * 1.5, 2, per * 2, BIG));
      const col = mixc(green, tops[k], Math.min(1, Math.max(0, -d / 0.16)));
      c = [c[0] + col[0] * I * 0.7, c[1] + col[1] * I * 0.7, c[2] + col[2] * I * 0.7];
    }
    return clampc(c);
  });
  starDots(g, w, h, m, 5, 140, ['#5d8a98', '#cfefff', '#ffffff']);
}
// Magma: plates of cooling basalt split by glowing cracks, with molten pools; the glow map (mask) is the heat alone
function clothMagma(g, it, w, h, m, mask) {
  const cell = 0.14, n = makeNoise(51), hj = makeNoise(52), ramp = [rgb('#2a0703'), rgb('#8a1a06'), rgb(it.col2), rgb(it.col3), rgb('#fff4c8')];
  const heatCol = t => { const f = Math.min(3.999, t * 4), i = f | 0; return mixc(ramp[i], ramp[i + 1], f - i); };
  const rock0 = rgb('#140806'), rock1 = rgb(it.col), rim = rgb('#4d2216');
  paint(g, w, h, (x, y) => {
    const X = x / m, Y = y / m, gx = Math.floor(X / cell), gy = Math.floor(Y / cell);
    let f1 = 9, f2 = 9, id = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const cx = gx + dx, cy = gy + dy, px = (cx + 0.15 + 0.7 * hj(cx * 7.1, cy * 3.3)) * cell, py = (cy + 0.15 + 0.7 * hj(cx * 2.9 + 50, cy * 6.7)) * cell, d = Math.hypot(X - px, Y - py);
      if (d < f1) { f2 = f1; f1 = d; id = cx * 131 + cy * 71; } else if (d < f2) f2 = d;
    }
    const e = (f2 - f1) / 2, wob = fbm(n, X * 14, Y * 14, 3), crack = Math.exp(-e / (0.0025 + 0.0025 * wob)) * (0.45 + 0.35 * wob), halo = Math.exp(-e / 0.015) * 0.2;
    const pool = Math.max(0, Math.min(1, (fbm(n, X * 2.2 + 30, Y * 2.2, 4) - 0.69) / 0.06));
    const heat = Math.min(0.82, Math.max(crack, pool * (0.55 + 0.25 * wob)) + halo * (1 - crack));
    if (mask) { const v = Math.pow(heat, 1.4) * 255; return [v, v, v]; }
    const shadeC = 0.55 + 0.45 * hj(id * 0.37, id * 0.11), grain = fbm(n, X * 40, Y * 40, 2);
    let c = mixc(rock0, rock1, Math.min(1, shadeC * (0.6 + 0.6 * grain)));
    c = mixc(c, rim, Math.max(0, 1 - Math.abs(e - 0.012) / 0.005) * 0.6);   // the raised edge of each plate catches the light
    return clampc(heat > 0.02 ? mixc(c, heatCol(heat), Math.min(1, heat * 1.3)) : c);
  });
}
// Haunted mist: banks of fog rolling over dark felt, thinner and thicker, with a few pairs of pale eyes looking out
function clothMist(g, it, w, h, m) {
  const n = makeNoise(81), n2 = makeNoise(82), deep = rgb('#07090e'), base = rgb(it.col), fog = rgb(it.col2), pale = rgb('#d8e6f2');
  paint(g, w, h, (x, y) => {
    const X = x / m, Y = y / m, wx = fbm(n2, X * 1.2, Y * 1.2, 3) * 1.6, d = fbm(n, X * 1.4 + wx, Y * 2.6, 5), wisp = fbm(n2, X * 5 + wx * 2, Y * 9, 3);
    let c = mixc(deep, base, 0.5 + 0.5 * fbm(n2, X * 3, Y * 3, 2));
    c = mixc(c, fog, Math.max(0, d - 0.42) * 1.9 * (0.6 + 0.4 * wisp));
    return clampc(mixc(c, pale, Math.pow(Math.max(0, d - 0.66), 2) * 5));
  });
  const r = K.rng(83);
  for (let i = 0; i < 4; i++) {   // eyes, small and faint, in the gaps of the fog
    const x = (0.12 + 0.76 * r()) * w, y = (0.15 + 0.7 * r()) * h, e = 0.007 * m;
    g.fillStyle = 'rgba(200,255,220,0.45)'; for (const dx of [-1.6, 1.6]) { g.beginPath(); g.ellipse(x + dx * e, y, e, e * 0.6, 0, 0, 7); g.fill(); }
  }
}
// Lantern glow: jack-o'-lanterns carved into near-black felt, each face lit from inside, with a soft orange halo
function clothLantern(g, it, w, h, m) {
  const n = makeNoise(91), base = rgb(it.col), warm = rgb('#2a1408');
  paint(g, w, h, (x, y) => { const X = x / m, Y = y / m; return clampc(mixc(base, warm, fbm(n, X * 4, Y * 4, 4) * 0.8)); });
  const r = K.rng(92), faces = Math.max(6, Math.round(w * h / (m * m) * 2.2));
  for (let i = 0; i < faces; i++) {
    const x = (0.08 + 0.84 * r()) * w, y = (0.12 + 0.76 * r()) * h, s = (0.05 + r() * 0.03) * m;
    const halo = g.createRadialGradient(x, y, s * 0.3, x, y, s * 2.4); halo.addColorStop(0, 'rgba(255,138,31,0.28)'); halo.addColorStop(1, 'rgba(255,138,31,0)');
    g.fillStyle = halo; g.fillRect(x - s * 2.4, y - s * 2.4, s * 4.8, s * 4.8);
    g.fillStyle = 'rgba(70,28,8,0.9)'; g.beginPath(); g.ellipse(x, y, s * 1.15, s * 0.95, 0, 0, 7); g.fill();   // the pumpkin itself, dimly lit
    g.fillStyle = it.col2; g.beginPath();
    for (const sd of [-1, 1]) { g.moveTo(x + sd * s * 0.62, y - s * 0.1); g.lineTo(x + sd * s * 0.22, y - s * 0.12); g.lineTo(x + sd * s * 0.42, y - s * 0.5); }   // eyes
    g.moveTo(x - s * 0.1, y + s * 0.12); g.lineTo(x + s * 0.1, y + s * 0.12); g.lineTo(x, y - s * 0.06);   // nose
    g.fill(); g.beginPath(); g.moveTo(x - s * 0.7, y + s * 0.25);   // a grin with teeth
    for (let k = 0; k <= 6; k++) g.lineTo(x - s * 0.7 + k * s * 0.233, y + s * 0.25 + (k % 2 ? s * 0.16 : 0) + Math.sin(k / 6 * Math.PI) * s * 0.28);
    for (let k = 6; k >= 0; k--) g.lineTo(x - s * 0.7 + k * s * 0.233, y + s * 0.34 + Math.sin(k / 6 * Math.PI) * s * 0.42 - (k % 2 ? s * 0.12 : 0));
    g.fill();
  }
}
// Blood moon: a huge red moon in the middle of the bed behind drifting cloud, bats crossing it; the glow map (mask) is
// the moon and its halo, which pulse slowly (clothFx)
function clothMoon(g, it, w, h, m, mask) {
  const n = makeNoise(101), n2 = makeNoise(102), cx = w / 2, cy = h / 2, R = h * 0.26, sky0 = rgb('#050203'), sky1 = rgb(it.col), red = rgb('#5a0e0a'), hot = rgb(it.col3), cloudC = rgb('#22090c');   // kept dark, so red balls show on it
  paint(g, w, h, (x, y) => {
    const X = x / m, Y = y / m, d = Math.hypot(x - cx, y - cy) / R, cloud = Math.max(0, fbm(n, X * 1.8 + fbm(n2, X, Y, 2), Y * 3.5, 5) - 0.45) * 2.2;
    const disc = d < 1 ? 1 : 0, halo = Math.exp(-Math.max(0, d - 1) * 3.2) * (1 - disc), crater = fbm(n2, X * 9, Y * 9, 4);
    if (mask) { const v = Math.min(1, disc * (0.35 + 0.2 * crater) + halo * 0.3 + Math.exp(-Math.abs(d - 1) * 30) * 0.4) * (1 - Math.min(0.85, cloud)) * 255; return [v, v, v]; }   // the rim brightest
    let c = mixc(sky0, sky1, 0.4 + 0.6 * fbm(n2, X * 2, Y * 2, 2));
    c = mixc(c, red, halo * 0.45);
    if (disc) c = mixc(mixc(red, hot, Math.pow(Math.max(0, d - 0.55) / 0.45, 3) * 0.45), rgb('#3a0806'), Math.max(0, crater - 0.45) * 1.4);
    return clampc(mixc(c, cloudC, Math.min(0.9, cloud)));
  });
  if (mask) return;
  const r = K.rng(103); g.fillStyle = '#080304';
  for (let i = 0; i < 7; i++) {   // bats against the moon
    const a = r() * 2 * Math.PI, rr = R * (0.2 + 0.9 * r()), x = cx + Math.cos(a) * rr * 1.5, y = cy + Math.sin(a) * rr, s = (0.018 + r() * 0.012) * m;
    g.beginPath(); g.moveTo(x - s, y); g.quadraticCurveTo(x - s * 0.5, y - s * 0.55, x, y - s * 0.1); g.quadraticCurveTo(x + s * 0.5, y - s * 0.55, x + s, y);
    g.quadraticCurveTo(x + s * 0.5, y - s * 0.05, x, y + s * 0.25); g.quadraticCurveTo(x - s * 0.5, y - s * 0.05, x - s, y); g.fill();
  }
}
// Soul fire: green ghost-flames licking along the table over black, pale at their hottest. The noise repeats exactly
// across the width, so the picture can drift endlessly along the table (clothFx).
function clothSoul(g, it, w, h, m) {
  const W = w / m, per = Math.max(2, Math.round(W / 0.3)), cell = W / per, n = makeNoise(111), n2 = makeNoise(112);
  const black = rgb(it.col), green = rgb(it.col2), pale = rgb(it.col3), teal = rgb('#0b3a30');
  paint(g, w, h, (x, y) => {
    const X = x / m / cell, Y = y / m, warp = fbm(n2, X, Y * 3, 3, per, 0) * 1.6, f = fbm(n, X * 2 + warp, Y * 4, 5, per * 2, 0);   // whole multiples of per, so it stays seamless
    const fire = Math.max(0, Math.min(1, (f - 0.56) / 0.2)), lick = fbm(n2, X * 6 + warp * 3, Y * 14, 3, per * 6, 0);   // patches of flame over mostly black, so the balls stand out
    const k = Math.pow(fire, 1.6) * (0.55 + 0.45 * lick);
    let c = mixc(black, teal, Math.min(1, k * 2));
    c = mixc(c, green, Math.min(0.85, Math.max(0, k - 0.25) * 1.6)); return clampc(mixc(c, pale, Math.max(0, k - 0.75) * 2.4));
  });
}
const RAIL_TOP = 0.045, CUSH_TOP = 0.041;
let tableGroup = new THREE.Group(), LAMP = []; scene.add(tableGroup);
function extrudeFlat(shape, depth, top, mat) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 20 });
  g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, mat); m.position.y = top; tableGroup.add(m); return m;
}
function rectPts(hx, hz) { return [new THREE.Vector2(-hx, -hz), new THREE.Vector2(hx, -hz), new THREE.Vector2(hx, hz), new THREE.Vector2(-hx, hz)]; }
function notchedRect(hx, hz, notches) {
  const pts = [], cs = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
  for (let e = 0; e < 4; e++) {
    const a = cs[e], b = cs[(e + 1) % 4], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(len / 0.003);
    for (let i = 0; i < n; i++) {
      const t = i / n; let x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t, inside = false;
      for (const c of notches) { const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz); if (d < c.r) { x = c.x + dx / d * c.r; z = c.z + dz / d * c.r; inside = true; break; } }
      pts.push({ x, z, inside, corner: i === 0 });
    }
  }
  const N = pts.length;
  return pts.filter((p, i) => p.inside || p.corner || pts[(i + 1) % N].inside || pts[(i - 1 + N) % N].inside).map(p => new THREE.Vector2(p.x, p.z));
}
function buildTable() {
  const hl = T.hl, hw = T.hw, cw = T.cw, RAIL_W = T.rail;
  // bed with pocket holes
  const bed = new THREE.Shape(rectPts(hl + 0.13, hw + 0.13));
  for (const p of T.pockets) { const h = new THREE.Path(); h.absarc(p.vx, p.vz, p.vr, 0, Math.PI * 2, true); bed.holes.push(h); }
  extrudeFlat(bed, 0.02, 0, clothMat);
  // cushions
  for (const c of T.cushions) extrudeFlat(new THREE.Shape(c.map(p => new THREE.Vector2(p[0], p[1]))), CUSH_TOP, CUSH_TOP, cushMat);
  // wood rails
  const outer = new THREE.Shape(rectPts(hl + cw + RAIL_W, hw + cw + RAIL_W));
  outer.holes.push(new THREE.Path(notchedRect(hl + cw, hw + cw, T.pockets.map(p => ({ x: p.vx, z: p.vz, r: p.nr })))));
  extrudeFlat(outer, RAIL_TOP + 0.02, RAIL_TOP, railMat);
  // apron + legs
  const darkWood = new THREE.MeshLambertMaterial({ color: '#4d2413' });
  const apron = new THREE.Shape(rectPts(hl + cw + RAIL_W - 0.005, hw + cw + RAIL_W - 0.005));
  apron.holes.push(new THREE.Path(rectPts(hl + cw + RAIL_W - 0.06, hw + cw + RAIL_W - 0.06)));
  extrudeFlat(apron, 0.16, -0.02, darkWood);
  const legG = new THREE.BoxGeometry(0.13, FLOOR_Y * -1 - 0.16, 0.13);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const l = new THREE.Mesh(legG, darkWood); l.position.set(sx * (hl + 0.05), (FLOOR_Y - 0.18) / 2, sz * (hw + 0.05)); tableGroup.add(l);
  }
  // pockets
  const cupMat = new THREE.MeshLambertMaterial({ color: '#0f0a14', side: THREE.DoubleSide });
  const linerMat = new THREE.MeshLambertMaterial({ color: '#2a1813', side: THREE.DoubleSide });
  for (const p of T.pockets) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(p.vr, p.vr * 0.8, 0.14, 20, 1, true), cupMat);
    cup.position.set(p.vx, -0.07, p.vz); tableGroup.add(cup);
    const bot = new THREE.Mesh(new THREE.CircleGeometry(p.vr * 0.8, 20), cupMat); bot.rotation.x = -Math.PI / 2; bot.position.set(p.vx, -0.139, p.vz); tableGroup.add(bot);
    const a0 = Math.atan2(p.axz, p.axx), hwid = p.hwid;
    const liner = new THREE.Mesh(new THREE.CylinderGeometry(p.nr + 0.001, p.nr + 0.001, RAIL_TOP + 0.01, 18, 1, true, Math.PI / 2 - a0 - hwid, 2 * hwid), linerMat);
    liner.position.set(p.vx, RAIL_TOP / 2 - 0.004, p.vz); tableGroup.add(liner);
  }
  // diamonds + foot spot
  const pearl = new THREE.MeshBasicMaterial({ color: '#f3e7c8' });
  const dg = new THREE.CircleGeometry(0.009, 4); dg.rotateX(-Math.PI / 2);
  const rc = cw + RAIL_W / 2;
  for (let k = -3; k <= 3; k++) { if (!k) continue; for (const sz of [-1, 1]) { const d = new THREE.Mesh(dg, pearl); d.position.set(k * P.L / 8, RAIL_TOP + 0.0006, sz * (hw + rc)); tableGroup.add(d); } }
  for (const k of [-1, 0, 1]) for (const sx of [-1, 1]) { const d = new THREE.Mesh(dg, pearl); d.position.set(sx * (hl + rc), RAIL_TOP + 0.0006, k * P.W / 4); tableGroup.add(d); }
  const spot = new THREE.Mesh(new THREE.CircleGeometry(0.006, 10), new THREE.MeshLambertMaterial({ color: '#d9f0e6' }));
  spot.rotation.x = -Math.PI / 2; spot.position.set(T.footX, 0.0008, 0); tableGroup.add(spot);
  // baulk line (British tables)
  if (T.key === 'uk7') {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(T.headX, 0.0012, -hw), new THREE.Vector3(T.headX, 0.0012, hw)]);
    tableGroup.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#d6ebe1', depthWrite: false })));
  }
  // lamp
  const lampParts = [], LL = Math.min(1.7, P.L * 0.7);
  const shade = new THREE.Mesh(new THREE.BoxGeometry(LL, 0.07, 0.34), new THREE.MeshLambertMaterial({ color: '#1f4a3c' }));
  shade.position.set(0, 1.12, 0); tableGroup.add(shade); lampParts.push(shade);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(LL - 0.1, 0.28), new THREE.MeshBasicMaterial({ color: '#ffe3ae', fog: false }));
  glow.rotation.x = Math.PI / 2; glow.position.set(0, 1.084, 0); tableGroup.add(glow); lampParts.push(glow);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(LL + 0.02, 0.012, 0.36), new THREE.MeshLambertMaterial({ color: '#c89a3c' }));
  trim.position.set(0, 1.158, 0); tableGroup.add(trim); lampParts.push(trim);
  const rodG = new THREE.CylinderGeometry(0.005, 0.005, 1.6, 6), rodM = new THREE.MeshLambertMaterial({ color: '#3a3040' });
  for (const x of [-LL * 0.35, LL * 0.35]) { const r = new THREE.Mesh(rodG, rodM); r.position.set(x, 1.95, 0); tableGroup.add(r); lampParts.push(r); }
  return lampParts;
}
function rebuildTable() {
  tableGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== clothMat && o.material !== cushMat) o.material.dispose(); });
  scene.remove(tableGroup); tableGroup = new THREE.Group(); scene.add(tableGroup);
  LAMP = buildTable();
}
setCloth();

// ------------------------------------------------------------------ balls
const ballGeo = new THREE.SphereGeometry(R, 20, 14);
const shadowGeo = new THREE.CircleGeometry(R * 1.12, 16); shadowGeo.rotateX(-Math.PI / 2);
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false });
const BM = [], SH = [], ROT = [];
for (let id = 0; id <= 15; id++) {
  const m = new THREE.Mesh(ballGeo, new THREE.MeshPhongMaterial({ map: ballTex(id, false), shininess: 70, specular: 0x5a5a5a }));
  m.quaternion.setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
  m.visible = false; scene.add(m); BM.push(m);
  const s = new THREE.Mesh(shadowGeo, shadowMat); s.visible = false; s.renderOrder = 1; scene.add(s); SH.push(s);
  ROT.push(new THREE.Vector3());
}
// ------------------------------------------------------------------ collection effects
// What completing collections earns (looks.js, COLLECTIONS), each switchable in the inventory (S.fxOff): a chalk trail
// behind the cue ball, gold rails, sparks when a ball drops, your name on the neon sign at home, a cosmic cue ball, and
// with all five a starfield room at home. Display only, and only on your own screen, so online play is unchanged.
function fxOn(k) { return LK.effects(LOCK).includes(k) && !(S.fxOff || []).includes(k); }
// smooth value noise for the textures, from a 256 × 256 table of random values. px and py (whole numbers up to 256):
// make it repeat every px by py cells, so a texture can tile; 0 (the default) repeats only every 256. fbm layers it.
function makeNoise(seed) {
  const r = K.rng(seed * 7919 + 13), P = new Float32Array(65536); for (let i = 0; i < 65536; i++) P[i] = r();
  return (x, y, px = 0, py = 0) => {
    const xi = Math.floor(x), yi = Math.floor(y); let fx = x - xi, fy = y - yi; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const x0 = (px ? ((xi % px) + px) % px : xi) & 255, x1 = (px ? ((xi + 1) % px + px) % px : xi + 1) & 255;
    const y0 = ((py ? ((yi % py) + py) % py : yi) & 255) << 8, y1 = ((py ? ((yi + 1) % py + py) % py : yi + 1) & 255) << 8;
    const a = P[y0 + x0], b = P[y0 + x1], c = P[y1 + x0], d = P[y1 + x1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}
function fbm(n, x, y, oct, px = 0, py = 0) { let s = 0, a = 0.5, f = 1, t = 0; for (let i = 0; i < oct; i++) { s += a * n(x * f, y * f, px * f, py * f); t += a; a *= 0.5; f *= 2; } return s / t; }
// paints a canvas pixel by pixel: fn(x, y) gives [r, g, b] (0 to 255)
function paint(g, w, h, fn) {
  const d = g.createImageData(w, h);
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) { const c = fn(x, y); d.data[i] = c[0]; d.data[i + 1] = c[1]; d.data[i + 2] = c[2]; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0);
}
// (plain functions, not consts: the room and the cue ball can be drawn before this part of the file has run)
function mixc(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function rgb(hex) { return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]; }
// gold rails: brushed gold, polished streaks along the grain
function goldTex() {
  return goldTex.t || (goldTex.t = canvasTex(64, 64, (g, w, h) => {
    const n = makeNoise(5), lo = rgb('#5c3a06'), mid = rgb('#c4901c'), hi = rgb('#fff0b5');
    paint(g, w, h, (x, y) => { const v = fbm(n, x / 16, y / 2, 3, 4, 32), band = 0.5 + 0.5 * Math.sin((y + 6 * n(x / 16, 0, 4, 1)) / 64 * 6.283 * 3), s = Math.pow(Math.max(0, n(x / 8, y / 2, 8, 32) - 0.66) * 3, 2);
      return mixc(mixc(lo, mid, Math.min(1, 0.25 + v * 0.75 + band * 0.18)), hi, Math.min(0.9, s + Math.max(0, band - 0.9) * 2.5)); });
  }, [5, 5]));
}
// the cosmic cue ball: pale and bright, so it still reads as the cue ball, swirled with nebula and specks of stars
function cosmicTex() {
  return cosmicTex.t || (cosmicTex.t = canvasTex(128, 64, (g, w, h) => {
    const n = makeNoise(9), n2 = makeNoise(10), base = rgb('#f3efff'), pink = rgb('#ffb8e4'), blue = rgb('#a9dcff'), vio = rgb('#c9b0ff');
    paint(g, w, h, (x, y) => { const a = fbm(n, x / 16, y / 16, 4, 8, 4), b = fbm(n2, x / 16, y / 16, 3, 8, 4);
      let c = mixc(base, a > 0.5 ? pink : blue, Math.max(0, Math.abs(a - 0.5) * 2.2 - 0.15)); c = mixc(c, vio, Math.max(0, b - 0.62) * 2); return c; });
    const r = K.rng(4);
    for (let i = 0; i < 40; i++) { const x = r() * w | 0, y = r() * h | 0; g.fillStyle = r() < 0.3 ? '#fff6c4' : '#ffffff'; g.fillRect(x, y, 1, 1); if (r() < 0.25) { g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); } }
    g.fillStyle = '#c99a2a';   // the dots that show spin, in gold
    for (const [x, y] of [[16, 32], [48, 32], [80, 32], [112, 32], [32, 10], [96, 10], [32, 54], [96, 54]]) g.fillRect(x - 2, y - 2, 4, 4);
  }));
}
// the starfield room: night sky on the walls at home, deep blue to violet with drifting nebulae and stars
function starTex() {
  return starTex.t || (starTex.t = canvasTex(256, 128, (g, w, h) => {
    const n = makeNoise(21), n2 = makeNoise(22), top = rgb('#05060f'), low = rgb('#140b2c'), neb1 = rgb('#3b1d6e'), neb2 = rgb('#0f4a63');
    paint(g, w, h, (x, y) => { const v = fbm(n, x / 32, y / 32, 5, 8, 4), q = fbm(n2, x / 32, y / 32, 4, 8, 4);
      let c = mixc(top, low, y / h); c = mixc(c, neb1, Math.max(0, v - 0.5) * 1.6); return mixc(c, neb2, Math.max(0, q - 0.6) * 1.4); });
    const r = K.rng(13);
    for (let i = 0; i < 260; i++) { const x = r() * w | 0, y = r() * h | 0, b = r(); g.fillStyle = b < 0.6 ? '#8a90b8' : b < 0.9 ? '#dfe4ff' : '#ffffff'; g.fillRect(x, y, 1, 1);
      if (b > 0.96) { g.fillStyle = 'rgba(223,228,255,0.55)'; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); } }
  }, [4, 1]));
}
// the neon sign's words: your name at home with the neon effect, else the room's own
function signText() {
  if (VEN.key === 'home' && HALL.on && !fxOn('neon')) return 'Haunted Hall';
  if (VEN.key !== 'home' || !fxOn('neon')) return VEN.sign;
  let n = CAR.data && CAR.data.name; if (!n) try { n = localStorage.getItem('retroRack.name'); } catch (e) {}
  return String(n || '').replace(/[<>]/g, '').trim().slice(0, 14) || 'Retro Rack';
}
// the chalk trail: dots of chalk dust laid every 1.2 cm along the cue ball's path, shrinking away over a second and a bit
const TRAIL = { n: 220, i: 0, pts: [], at: null }, fxM4 = new THREE.Matrix4();
const trailMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 10).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#c4e6ff', transparent: true, opacity: 0.55, depthWrite: false }), TRAIL.n);
trailMesh.frustumCulled = false; trailMesh.visible = false; scene.add(trailMesh);
// pot sparks: a burst in the ball's colour from the pocket, falling and fading (off with reduced motion)
const SPK = { n: 200, parts: [] }, spkPos = new Float32Array(SPK.n * 3), spkCol = new Float32Array(SPK.n * 3);
const spkGeo = new THREE.BufferGeometry(); spkGeo.setAttribute('position', new THREE.BufferAttribute(spkPos, 3)); spkGeo.setAttribute('color', new THREE.BufferAttribute(spkCol, 3));
const spkMesh = new THREE.Points(spkGeo, new THREE.PointsMaterial({ size: 0.016, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
spkMesh.frustumCulled = false; spkMesh.visible = false; scene.add(spkMesh);
function sparkAt(x, z, hex) {
  if (!fxOn('sparks') || reduceMotion) return;
  const c = new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), 0.25), r = Math.random;
  for (let i = 0; i < 28; i++) { const a = r() * 6.283, s = 0.25 + r() * 0.6; SPK.parts.push({ x, y: 0.02, z, vx: Math.cos(a) * s, vy: 0.7 + r() * 0.9, vz: Math.sin(a) * s, age: 0, life: 0.45 + r() * 0.45, c }); }
  if (SPK.parts.length > SPK.n) SPK.parts.splice(0, SPK.parts.length - SPK.n);
}
function tableFx(now, dt) {
  const on = fxOn('trail'), cue = world.balls[0];
  if (on && cue && !cue.potted && (state === 'moving' || replay) && cue.vx * cue.vx + cue.vz * cue.vz > 1e-4) {
    const a = TRAIL.at || (TRAIL.at = { x: cue.x, z: cue.z }), d = Math.hypot(cue.x - a.x, cue.z - a.z), step = 0.012;
    if (d > 0.5) TRAIL.at = { x: cue.x, z: cue.z };   // a jump (a new rack, a replay starting): start afresh
    else for (let k = 1; k * step <= d; k++) { const f = k * step / d; TRAIL.pts[TRAIL.i] = { x: a.x + (cue.x - a.x) * f, z: a.z + (cue.z - a.z) * f, t: now }; TRAIL.i = (TRAIL.i + 1) % TRAIL.n; TRAIL.at = TRAIL.pts[(TRAIL.i + TRAIL.n - 1) % TRAIL.n]; }
  } else TRAIL.at = null;
  let any = false;
  if (on || trailMesh.visible) for (let k = 0; k < TRAIL.n; k++) {
    const p = TRAIL.pts[k], age = p ? (now - p.t) / 1300 : 1, sc = on && age < 1 ? R * 0.3 * (1 - age * age) : 0; if (sc) any = true;
    fxM4.makeScale(sc || 1e-6, 1, sc || 1e-6).setPosition(p ? p.x : 0, 0.0015, p ? p.z : 0); trailMesh.setMatrixAt(k, fxM4);
  }
  trailMesh.visible = any; if (any) trailMesh.instanceMatrix.needsUpdate = true;
  SPK.parts = SPK.parts.filter(p => (p.age += dt) < p.life);
  spkMesh.visible = SPK.parts.length > 0; if (!spkMesh.visible) return;
  for (let i = 0; i < SPK.n; i++) {
    const p = SPK.parts[i]; if (!p) { spkPos[i * 3 + 1] = -10; continue; }
    p.vy -= 3.5 * dt; p.x += p.vx * dt; p.y = Math.max(0.005, p.y + p.vy * dt); p.z += p.vz * dt;
    const f = 1 - p.age / p.life; spkPos[i * 3] = p.x; spkPos[i * 3 + 1] = p.y; spkPos[i * 3 + 2] = p.z; spkCol[i * 3] = p.c.r * f; spkCol[i * 3 + 1] = p.c.g * f; spkCol[i * 3 + 2] = p.c.b * f;
  }
  spkGeo.attributes.position.needsUpdate = spkGeo.attributes.color.needsUpdate = true;
}
// puts the effects in place after a change (one switched, a collection completed, dev mode)
function applyFx() {
  const gold = fxOn('rails'); railMat.map = gold ? goldTex() : woodTex; railMat.emissive.set(gold ? '#140d02' : '#000000'); railMat.needsUpdate = true;
  BM[0].material.map = fxOn('cosmic') ? cosmicTex() : ballTex(0, ukStyle()); BM[0].material.needsUpdate = true;
  dressRoom();
}

// "you're on" markers: a pulsing halo round each ball the player at the table is going for. It always faces
// the camera, so it reads from the cue view as well as from overhead (a ring flat on the cloth vanishes low down).
const markTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(0.56, 'rgba(255,255,255,1)');
  g.addColorStop(0.78, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const markMat = new THREE.SpriteMaterial({ map: markTex, color: '#ffc56b', transparent: true, depthWrite: false, fog: false });
const MK = [];
for (let id = 0; id <= 15; id++) { const k = new THREE.Sprite(markMat); k.visible = false; k.renderOrder = 2; scene.add(k); MK.push(k); }

// ------------------------------------------------------------------ cue stick
// the cue: tip, ferrule, shaft, joint, forearm, wrap, butt sleeve and bumper. The named parts take the colours of a cue
// design (the house cue, or one from the career shop, see CUE_COLS); applyCue() repaints them.
const cueMesh = new THREE.Group(), CUE_MAT = {};
let cueNow = 'house';
const cueCols = id => kindOf(id) === 'cue' ? LK.ALL[id].col : CAREER.HOUSE_CUE;
// A design with a pattern (looks.js: pat in colour pc) has it drawn round the forearm: u runs round the cue, v along it
// from the butt end (the bottom of the picture) towards the tip. Effects: glow lights the pattern up, neon pulses it
// between two colours, rainbow runs the forearm and butt through the colours (cueFx, every frame).
const CUE_TEX = {};
function cuePattern(it, mask) {
  if (['holo', 'tubes', 'swirl', 'plasma', 'brew', 'reaper', 'wisp', 'hell'].includes(it.pat)) return cuePaint(it, mask);
  return canvasTex(32, 128, (g, W, H) => {
    const r = K.rng(3); g.fillStyle = mask ? '#000000' : it.col.fore; g.fillRect(0, 0, W, H); g.fillStyle = mask ? '#ffffff' : it.pc;
    const poly = pts => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.fill(); };
    if (it.pat === 'spiral') for (let y = -W; y < H + W; y += 16) poly([[0, y], [W, y + W], [W, y + W + 7], [0, y + 7]]);
    else if (it.pat === 'check') for (let y = 0; y < H; y += 8) for (let x = y / 8 % 2 * 8; x < W; x += 16) g.fillRect(x, y, 8, 8);
    else if (it.pat === 'flame') for (let x = -4; x < W; x += 8) { const h = 50 + r() * 50; poly([[x, H], [x + 4, H - h * 0.55], [x + 2, H - h], [x + 8, H - h * 0.5], [x + 12, H]]); }
    else if (it.pat === 'carbon') for (let y = 0; y < H; y += 4) for (let x = (y / 4 % 2) * 4; x < W; x += 8) g.fillRect(x, y, 4, 2);
    else if (it.pat === 'tiger') for (let y = 6; y < H; y += 14 + r() * 8) poly([[0, y], [W * (0.5 + r() * 0.4), y + 3 + r() * 4], [0, y + 5], [W, y + 8], [W * (0.4 + r() * 0.3), y + 4]]);
    else if (it.pat === 'zigzag') for (let y = 8; y < H; y += 20) for (let x = 0; x < W; x += 8) poly([[x, y], [x + 4, y - 5], [x + 8, y], [x + 8, y + 3], [x + 4, y - 2], [x, y + 3]]);
    else if (it.pat === 'camo') for (let i = 0; i < 26; i++) { g.beginPath(); g.ellipse(r() * W, r() * H, 3 + r() * 5, 4 + r() * 8, r() * 3, 0, 7); g.fill(); }
    else if (it.pat === 'bolt') for (let y = 4; y < H; y += 24) for (const x of [0, 16]) poly([[x + 1, y], [x + 14, y + 7], [x + 8, y + 9], [x + 16, y + 20], [x + 2, y + 11], [x + 7, y + 9]]);
    else if (it.pat === 'scales') for (let y = 0; y < H + 8; y += 6) for (let x = y / 6 % 2 * 4; x < W + 8; x += 8) { g.beginPath(); g.arc(x, y, 4, 0, Math.PI); g.lineWidth = 1.5; g.strokeStyle = g.fillStyle; g.stroke(); }
    else if (it.pat === 'crystal') for (let y = -W; y < H; y += 22) { poly([[0, y], [W, y + 18], [W, y + 20], [0, y + 2]]); poly([[W, y + 6], [0, y + 20], [0, y + 21], [W, y + 7]]); }
    else if (it.pat === 'stars') for (let i = 0; i < 30; i++) { const x = r() * W, y = r() * H; g.fillRect(x - 2, y, 5, 1); g.fillRect(x, y - 2, 1, 5); }
    else if (it.pat === 'rings') for (let y = 4; y < H; y += 18) g.fillRect(0, y, W, 4);
    else if (it.pat === 'bones') for (let y = 10, k = 0; y < H; y += 22, k++) {   // crossbones, turned alternately
      const x = k % 2 ? 24 : 8; g.save(); g.translate(x, y); for (const a of [0.7, -0.7]) { g.rotate(a); g.fillRect(-6, -1, 12, 2); for (const e of [-6, 6]) { g.beginPath(); g.arc(e, -1.5, 1.6, 0, 7); g.arc(e, 1.5, 1.6, 0, 7); g.fill(); } g.rotate(-a); } g.restore();
    }
    else if (it.pat === 'vine') { g.lineWidth = 2; g.strokeStyle = g.fillStyle; g.beginPath(); for (let y = 0; y <= H; y += 2) { const x = 16 + Math.sin(y / 128 * 4 * Math.PI) * 11; if (y) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke();   // a pumpkin vine winding up, with leaves and curls
      for (let y = 8; y < H; y += 16) { const x = 16 + Math.sin(y / 128 * 4 * Math.PI) * 11, sd = y / 16 % 2 ? 1 : -1; g.beginPath(); g.ellipse(x + sd * 4, y, 4, 2.4, sd * 0.5, 0, 7); g.fill(); g.beginPath(); g.arc(x - sd * 3, y + 6, 2.4, 0, 5); g.stroke(); } }
    else if (it.pat === 'straw') for (let x = 0; x < W; x += 2) { g.globalAlpha = 0.5 + r() * 0.5; g.fillRect(x, 0, 1, H); g.globalAlpha = 1; if (r() < 0.3) g.fillRect(x, r() * H, 1, 6); }   // bristles of straw, bound halfway
    else if (it.pat === 'corn') for (let y = 0; y < H; y += 24) { g.fillStyle = mask ? '#ffffff' : '#f7ead2'; poly([[0, y], [W, y], [W, y + 6], [0, y + 6]]); g.fillStyle = mask ? '#ffffff' : it.pc; for (let x = 0; x < W; x += 8) poly([[x, y + 6], [x + 8, y + 6], [x + 4, y + 16]]); }   // candy corn: white, the orange forearm, then yellow points
    else if (it.pat === 'drip') { g.fillRect(0, 0, W, 10); for (let x = 1; x < W; x += 4 + r() * 4) { const len = 14 + r() * 50, wd = 1.5 + r() * 1.5; g.fillRect(x, 0, wd, len); g.beginPath(); g.arc(x + wd / 2, len, wd * 0.9, 0, 7); g.fill(); } }   // blood running down from the joint
    else if (it.pat === 'widow') { g.globalAlpha = 0.35; g.lineWidth = 1; g.strokeStyle = g.fillStyle; g.beginPath(); for (let y = -W; y < H; y += 12) { g.moveTo(0, y); g.lineTo(W, y + W); g.moveTo(W, y); g.lineTo(0, y + W); } g.stroke(); g.globalAlpha = 1;   // a web, and the widow's red hourglass
      for (let y = 18; y < H; y += 36) for (const x of [8, 24]) { const yy = y + (x > 16 ? 18 : 0); poly([[x - 4, yy - 6], [x + 4, yy - 6], [x, yy], [x + 4, yy + 6], [x - 4, yy + 6], [x, yy]]); } }
  });
}
// The legendary and mythic cues, painted pixel by pixel; u (x) runs round the cue, v (y) along it, and the noise repeats
// both ways, so a pattern can turn round the cue or flow along it without a seam. mask: the glow map (where it shines).
function cuePaint(it, mask) {
  const W = 64, H = 256, n = makeNoise(61), n2 = makeNoise(62), P = 2 * Math.PI, fore = rgb(it.col.fore), pc = rgb(it.pc), hot = rgb(it.col.inlay), white = [255, 255, 255];
  const frac = v => v - Math.floor(v), ramp = (cs, t) => { const f = Math.max(0, Math.min(cs.length - 1.001, t * (cs.length - 1))), i = f | 0; return mixc(cs[i], cs[i + 1], f - i); };
  return canvasTex(W, H, g => paint(g, W, H, (x, y) => {
    const U = x / W, V = y / H;
    if (it.pat === 'holo') {   // Spectrum: silver foil with diagonal bands of light; the cue's colours run through it (cueFx)
      const b = 0.5 + 0.5 * Math.sin(P * (3 * U + 7 * V) + 4 * fbm(n, U * 8, V * 32, 3, 8, 32)), sp = n2(U * 32, V * 128, 32, 128);
      const c = mixc(rgb('#b9bfd2'), white, b * 0.85); return mask ? [b * 255, b * 255, b * 255] : clampc(mixc(c, white, Math.max(0, sp - 0.8) * 4));
    }
    if (it.pat === 'tubes') {   // Neon: two glowing tubes wound round a black forearm, cyan and pink, with a faint grain
      let k = 0, col = pc;
      for (const [o, cc] of [[0, pc], [0.5, rgb(it.col.joint)]]) { const d = Math.abs(frac(U - 3 * V + o) - 0.5), e = Math.exp(-Math.pow(d / 0.045, 2)); if (e > k) { k = e; col = cc; } }
      if (mask) return [k * 255, k * 255, k * 255];
      const base = mixc([12, 9, 18], [30, 24, 40], fbm(n, U * 16, V * 64, 2, 16, 64));
      return clampc(mixc(mixc(base, col, Math.min(1, k * 1.6)), white, Math.max(0, k - 0.75) * 2.5));
    }
    if (it.pat === 'swirl') {   // Event horizon: streams of an accretion disc winding round a black hole, gold-white where hottest
      const warp = 3 * fbm(n, U * 8, V * 32, 4, 8, 32), s = 0.5 + 0.5 * Math.sin(P * (2 * U + 5 * V) + warp), streak = n2(U * 4, V * 64, 4, 64);
      const k = Math.pow(s, 4) * (0.55 + 0.45 * streak);
      if (mask) return [k * 255, k * 255, k * 255];
      return clampc(ramp([rgb('#05030a'), rgb('#4a0d05'), pc, hot, white], Math.min(1, k * 1.15)));
    }
    if (it.pat === 'brew') {   // Cauldron: green potion churning round the cue, bubbles rising through it, the brightest glowing
      const swirl = fbm(n, U * 4 + 2 * fbm(n2, U * 4, V * 16, 3, 4, 16), V * 16, 4, 4, 16), cell = 8, bx = U * cell, by = V * cell * 4, ix = Math.floor(bx), iy = Math.floor(by);
      let bub = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const cx = ((ix + dx) % cell + cell) % cell, cy = ((iy + dy) % (cell * 4) + cell * 4) % (cell * 4), px = ix + dx + 0.5 + 0.35 * (n2(cx * 7.3, cy * 3.1, 0, 0) - 0.5), py = iy + dy + 0.5 + 0.35 * (n2(cx * 2.7 + 40, cy * 5.9, 0, 0) - 0.5), rr = 0.18 + 0.2 * n2(cx * 9.1, cy * 1.7, 0, 0), d = Math.hypot(bx - px, by - py); bub = Math.max(bub, Math.max(0, 1 - Math.abs(d - rr) / 0.06)); }
      if (mask) { const v = Math.min(1, bub * 0.9 + Math.max(0, swirl - 0.6) * 1.5) * 255; return [v, v, v]; }
      return clampc(mixc(mixc(fore, pc, Math.min(1, swirl * 1.3)), hot, Math.min(1, bub * 0.9)));
    }
    if (it.pat === 'reaper') {   // Reaper: black smoke round the cue, with silver scythe blades curving through it, their edges gleaming
      const smoke = fbm(n, U * 4, V * 16, 5, 4, 16), b = frac(V * 5 + 0.15 * Math.sin(P * U)), blade = Math.max(0, 1 - Math.abs(b - 0.5 - 0.25 * Math.sin(P * (U * 2 + V * 3))) / 0.06);
      const edge = Math.pow(blade, 3);
      if (mask) { const v = Math.min(1, edge * 1.2) * 255; return [v, v, v]; }
      return clampc(mixc(mixc(fore, rgb('#3a3a48'), smoke * 0.8), mixc(rgb('#9aa3b2'), pc, edge), Math.min(1, blade * 1.1)));
    }
    if (it.pat === 'wisp') {   // Will-o'-the-wisp: soft lights drifting along the dark forearm, each trailing a tail of mist
      let k = 0; for (let i = 0; i < 6; i++) { const cu = n2(i * 13.1, 3.3, 0, 0), cv = i / 6, du = Math.min(Math.abs(U - cu), 1 - Math.abs(U - cu)), dv = frac(V - cv + 1) , tail = dv < 0.5 ? Math.exp(-dv * 18) : Math.exp(-(1 - dv) * 120); k = Math.max(k, Math.exp(-Math.pow(du / 0.08, 2)) * tail); }
      const mist = fbm(n, U * 4, V * 16, 3, 4, 16) * 0.25;
      if (mask) { const v = Math.min(1, k * 1.2) * 255; return [v, v, v]; }
      return clampc(mixc(mixc(fore, rgb('#0d2a30'), mist), mixc(pc, hot, Math.max(0, k - 0.6) * 2.5), Math.min(1, k * 1.3)));
    }
    if (it.pat === 'hell') {   // Hellfire: flames climbing the forearm towards the tip, gold where hottest
      const f = fbm(n, U * 4, V * 8 + 2 * fbm(n2, U * 4, V * 8, 3, 4, 8), 5, 4, 8), lick = Math.pow(Math.max(0, f - 0.35) / 0.65, 1.3);
      if (mask) { const v = Math.min(1, lick * 1.3) * 255; return [v, v, v]; }
      return clampc(ramp([fore, rgb('#5a0d05'), pc, hot, white], Math.min(1, lick * 1.1)));
    }
    // Plasma: violet gas threaded with branching cyan filaments, pink where they gather
    const r = 1 - Math.abs(2 * fbm(n, U * 8, V * 16, 5, 8, 16) - 1), k = Math.pow(r, 7), soft = Math.pow(r, 2.5) * 0.35, pink = Math.max(0, fbm(n2, U * 4, V * 8, 3, 4, 8) - 0.55) * 2.2;
    if (mask) { const v = Math.min(1, k + soft * 0.5) * 255; return [v, v, v]; }
    let c = mixc(fore, mixc(pc, hot, Math.min(1, pink)), Math.min(1, soft + k * 1.2)); return clampc(mixc(c, white, Math.max(0, k - 0.6) * 2));
  }), [1, 1]);
}
function applyCue(id) {
  cueNow = id; const c = cueCols(id), it = kindOf(id) === 'cue' ? LK.ALL[id] : {};
  for (const k in CUE_MAT) { CUE_MAT[k].color.set(c[k]); if (CUE_MAT[k].emissive) CUE_MAT[k].emissive.set('#000000'); }
  if (it.pat && !CUE_TEX[id]) CUE_TEX[id] = [cuePattern(it, false), it.fx ? cuePattern(it, true) : null];
  const [map, glow] = it.pat ? CUE_TEX[id] : [null, null], f = CUE_MAT.fore;
  if (f.map !== map || f.emissiveMap !== glow) { f.map = map; f.emissiveMap = glow; f.needsUpdate = true; }
  if (map) f.color.set('#ffffff');
}
function cueFx(now) {
  const it = kindOf(cueNow) === 'cue' ? LK.ALL[cueNow] : null; if (!it || !it.fx) return;
  const t = reduceMotion ? 0 : now / 1000, f = CUE_MAT.fore;
  if (it.fx === 'rainbow') { f.color.setHSL(t * 0.12 % 1, 0.85, 0.55); CUE_MAT.butt.color.setHSL((t * 0.12 + 0.5) % 1, 0.85, 0.55); }
  else if (it.fx === 'neon') f.emissive.set(it.pc).lerp(new THREE.Color(it.col.joint), 0.5 + 0.5 * Math.sin(t * 2.2));
  else if (it.fx === 'wisp' || it.fx === 'hellfire') {   // mythic: wisps drift slowly along the cue; flames climb it, wavering
    for (const tex of CUE_TEX[cueNow] || []) if (tex) { if (it.fx === 'wisp') tex.offset.set(t * 0.01, -t * 0.06); else tex.offset.y = -t * 0.3; }
    const k = it.fx === 'wisp' ? 0.7 + 0.3 * Math.sin(t * 1.1) : 0.75 + 0.15 * Math.sin(t * 2.3) * Math.sin(t * 0.9);
    f.emissive.set(it.pc).multiplyScalar(k); CUE_MAT.joint.emissive.set(it.col.joint).multiplyScalar(k * 0.5);
  }
  else if (it.fx === 'spin' || it.fx === 'plasma') {   // mythic: the pattern turns round the cue, or flows along it
    for (const tex of CUE_TEX[cueNow] || []) if (tex) { if (it.fx === 'spin') tex.offset.x = t * 0.45; else tex.offset.set(t * 0.06, t * 0.22); }
    f.emissive.set(it.pc).multiplyScalar(0.75 + 0.25 * Math.sin(t * 1.8)); CUE_MAT.joint.emissive.set(it.col.joint).multiplyScalar(0.5 + 0.3 * Math.sin(t * 1.8 + 1));
  }
  else f.emissive.set(it.pc).multiplyScalar(0.7 + 0.3 * Math.sin(t * 2.6));
}
{
  const H = CAREER.HOUSE_CUE, parts = [
    [0.010, 0.0062, 0.0062, '#3d78e0'], [0.022, 0.0063, 0.0063, '#f1ead2'], [0.68, 0.0064, 0.0098, H.shaft, 'shaft'],
    [0.02, 0.0102, 0.0102, H.joint, 'joint'], [0.30, 0.0105, 0.0125, H.fore, 'fore'], [0.28, 0.0126, 0.0138, H.wrap, 'wrap'],
    [0.14, 0.0139, 0.0145, H.butt, 'butt'], [0.012, 0.0146, 0.0146, '#141018'],
  ];
  let x = 0;
  for (const [len, rt0, rb, col, name] of parts) {
    const g = new THREE.CylinderGeometry(rt0, rb, len, 10); g.rotateZ(-Math.PI / 2); g.translate(x - len / 2, 0, 0);
    const mat = new THREE.MeshPhongMaterial({ color: col, shininess: 40, specular: 0x333333 }); if (name) CUE_MAT[name] = mat;
    cueMesh.add(new THREE.Mesh(g, mat));
    x -= len;
  }
  // inlay points on the forearm
  const inlay = CUE_MAT.inlay = new THREE.MeshBasicMaterial({ color: H.inlay });
  for (let i = 0; i < 4; i++) { const g = new THREE.BoxGeometry(0.06, 0.003, 0.003); const b = new THREE.Mesh(g, inlay); const a = i * Math.PI / 2; b.position.set(-0.78, Math.cos(a) * 0.0112, Math.sin(a) * 0.0112); cueMesh.add(b); }
  scene.add(cueMesh);
}
let tableBuilt = false;
function applyTable(key) {
  if (tableBuilt && T.key === key) return false;
  C.setTable(key); R = P.R; rebuildTable(); tableBuilt = true; if (clothTex) setCloth();   // a pattern is drawn to the table's size
  const uk = key === 'uk7', k = R / R_US;
  for (let id = 0; id <= 15; id++) { BM[id].scale.setScalar(k); SH[id].scale.setScalar(k); BM[id].material.map = id === 0 && fxOn('cosmic') ? cosmicTex() : ballTex(id, uk); BM[id].material.needsUpdate = true; }
  return true;
}
// trick shots: preset layouts (demo shots found by searching with the real physics) plus your saved layouts
const TRICKS = [{"name": "Warm-up cut", "goal": "Cut the 3 into the top corner.", "pot": [3], "balls": [[0, -0.35, 0.05], [3, 0.75, 0.4]], "demo": {"phi": 0.30558, "power": 0.7, "sx": 0, "sy": 0}}, {"name": "Combination", "goal": "Pot the 9 by hitting the 1 into it.", "pot": [9], "balls": [[0, -0.55, -0.15], [1, 0.55, 0.22], [9, 0.92, 0.43]], "demo": {"phi": 0.30175, "power": 0.85, "sx": -0.6, "sy": 0}}, {"name": "Side bank", "goal": "Bank the 5 off the bottom cushion into the top side pocket.", "pot": [5], "balls": [[0, -0.7, -0.05], [5, 0.12, -0.42]], "demo": {"phi": -0.44136, "power": 0.42, "sx": 0, "sy": 0}}, {"name": "Kick shot", "goal": "The 2 is hidden behind a wall of balls. Find a way to pot it.", "pot": [2], "balls": [[0, -0.2, -0.05], [2, 1.05, -0.48], [11, 0.25, -0.2], [12, 0.25, -0.1], [13, 0.25, 0]], "demo": {"phi": -0.2502, "power": 0.7, "sx": 0, "sy": 0.6}}, {"name": "Double trouble", "goal": "Pot the 4 and the 12 in one shot.", "pot": [4, 12], "balls": [[0, 0.25, 0], [4, 1.05, 0.42], [12, 1.05, -0.44]], "demo": {"phi": 0.51191, "power": 0.9, "sx": 0, "sy": 0}}, {"name": "Thread the needle", "goal": "Squeeze through the gap and pot the 8.", "pot": [8], "balls": [[0, -0.9, 0], [8, 0.95, 0.3], [6, -0.25, 0.032075], [14, -0.25, -0.032075]], "demo": {"phi": 0.14052, "power": 0.55, "sx": 0, "sy": 0}}];
const loadLayouts = () => { try { const l = JSON.parse(localStorage.getItem('retroRack.layouts') || '[]'); return Array.isArray(l) ? l : []; } catch (e) { return []; } };
const saveLayouts = l => { try { localStorage.setItem('retroRack.layouts', JSON.stringify(l)); } catch (e) {} };
const trickList = () => [...TRICKS, ...loadLayouts().map((l, i) => ({ name: l.name, goal: 'Pot every object ball in one shot.', pot: null, balls: l.balls, custom: i }))];
const TRK = { fresh: false, demo: false };
const raceTo = () => NET.on ? (NET.raceTo || 0) : (M.mode === 'practice' ? 0 : (M.race || 0));
const matchDone = () => raceTo() > 0 && Math.max(...matchWins) >= raceTo();
const tableKeyFor = () => (M.mode === 'uk8' || (M.mode === 'practice' && M.rack === 'uk')) ? 'uk7' : 'us9';
applyTable('us9');
const qA = new THREE.Quaternion(), qB = new THREE.Quaternion(), vY = new THREE.Vector3(0, 1, 0), vZ = new THREE.Vector3(0, 0, 1);

// ------------------------------------------------------------------ gloves
// Floating gloves play the shot: one grips the back of the cue (a child of the cue, so it strokes with it) and one
// makes the bridge on the cloth behind the cue ball, the cue resting between thumb and fingers. A third pops up for a
// moment after a shot: a thumbs-up for a pot, a shrug for a foul, a fist pump for winning the frame. Each is built as
// the design's glove type (looks.js: style), in its colours.
// Whose gloves are at the table follows the cue (gloveFor); 'none' shows none.
const gripGlove = new THREE.Group(), bridgeGlove = new THREE.Group(), cheerGlove = new THREE.Group();
const GLM = {}, CHM = {}, GLOVE_KEYS = ['base', 'accent', 'cuff', 'skin', 'tip', 'panel', 'palm', 'nail'];
for (const k of GLOVE_KEYS) { GLM[k] = new THREE.MeshLambertMaterial({ flatShading: true }); CHM[k] = new THREE.MeshLambertMaterial({ flatShading: true }); }
let gloveNow = null, cheerNow = null, tapFinger = null;
const CHEER = { kind: '', t0: 0, x: 0, z: 0 };
// The glove types. panel: a padded panel on the back of the hand (cuff colour); bar: a slim strip across the knuckles;
// knuckles: a moulded guard over the knuckles; guards: a pad on each finger; tab: a strap across the wrist (all three in
// the accent colour); cuffL: the cuff's length; tips: fingerless, cut off halfway up the fingers; wraps: cloth wrapped
// round the hand with the fingers bare. The novelties: ball (a boxing glove), claw (three jointed metal fingers with lit
// tips), bones (a skeleton hand).
const STYLE = {
  sport: { panel: 1, bar: 1, tab: 1 }, driver: { tab: 1 }, tactical: { panel: 1, knuckles: 1, cuffL: 0.03 }, moto: { panel: 1, knuckles: 1, guards: 1, tab: 1 },
  fingerless: { tab: 1, tips: 1 }, wraps: { wraps: 1, cuffL: 0.022 }, boxing: { ball: 1, cuffL: 0.034 }, claw: { claw: 1 }, bones: { bones: 1 },
};
// The robot claw and the skeleton are built from parts, in a frame of their own: the wrist at the origin, the fingers
// along +x, the back of the hand up (+y), the thumb on +z. It's a left hand; the cue hand is the same hand mirrored.
// Each finger has three sections from its knuckle (length and thickness at the knuckle and the tip, and how far it fans
// out); the thumb's first section starts at the wrist, inside the ball of the thumb, and its rest position points out
// and down.
const FINGER = [
  { at: [0.087, 0.001, 0.026], len: [0.038, 0.023, 0.018], r: [0.0092, 0.0074], fan: -0.07 },
  { at: [0.091, 0.002, 0.0085], len: [0.041, 0.026, 0.019], r: [0.0095, 0.0076], fan: 0 },
  { at: [0.088, 0.001, -0.0095], len: [0.039, 0.025, 0.018], r: [0.0091, 0.0073], fan: 0.07 },
  { at: [0.08, -0.001, -0.026], len: [0.031, 0.019, 0.016], r: [0.0082, 0.0066], fan: 0.15 },
];
const THUMB = { at: [0.016, -0.007, 0.02], len: [0.042, 0.03, 0.024], r: [0.0128, 0.0087], ty: -0.75, tz: -0.2 };
// their poses: the bend of each finger's three joints (negative curls towards the palm), how widely the fingers
// spread, and the thumb's turn out (ty), lift (tz) and the bend of its two joints. pb and pt: the bends of the two-section
// fingers and thumb, where they differ from the sum of the three.
const HAND_POSE = {
  bridge: { bend: [[-0.42, -0.2, -0.15], [-0.46, -0.2, -0.15], [-0.46, -0.2, -0.15], [-0.42, -0.2, -0.15]], spread: 1.9, ty: -0.2, tz: 0.3, tb: [0.15, 0.1] },
  grip: { bend: [[-0.1, -1.5, -0.5], [-0.3, -1.7, -0.3], [-0.1, -1.6, -0.4], [0.1, -1, -0.7]], spread: 0.4, ty: -0.3, tz: 0.05, tb: [-1, 0.2],
    pb: [[-1.15, -1.35], [-1.2, -1.4], [-1.25, -1.4], [-1.3, -1.4]], pt: [-1.1, -0.3, -0.6] },
  fist: { bend: [[-1.5, -1.3, -0.8], [-1.5, -1.3, -0.8], [-1.5, -1.3, -0.8], [-1.5, -1.3, -0.8]], spread: 0.2, ty: 0.5, tz: -0.75, tb: [-0.6, -0.5], pb: Array(4).fill([-1.5, -1.6]), pt: [0.5, -0.75, -0.6] },
  thumb: { bend: [[-1.5, -1.3, -0.8], [-1.5, -1.3, -0.8], [-1.5, -1.3, -0.8], [-1.5, -1.3, -0.8]], spread: 0.2, ty: -1.45, tz: 0.1, tb: [0.05, 0.05], pb: Array(4).fill([-1.5, -1.6]), pt: [-1.45, 0.1, 0.05] },
  open: { bend: [[-0.15, -0.08, -0.05], [-0.1, -0.08, -0.05], [-0.15, -0.08, -0.05], [-0.2, -0.08, -0.05]], spread: 1.4, ty: -0.7, tz: 0, tb: [-0.1, -0.1] },
};
// The one-piece hands are the owner's procedural model ("Retro Rack hands"): one flat-shaded, low-poly mesh per hand on a
// skeleton of 17 bones (the arm, the wrist, three for each finger and three for the thumb). In the model's own frame the
// fingers point along -z and the back of the hand faces +y; a right hand's thumb is on -x. A left hand is a true mirror
// (x flipped, each face turned back round), so the poses work on both. Sizes for a right hand, in metres: each knuckle,
// the finger's width and its three sections' lengths.
const GH_FINGERS = {
  index: { at: [-0.0295, 0.001, -0.078], w: 0.0195, len: [0.041, 0.025, 0.021] },
  middle: { at: [-0.0095, 0.001, -0.081], w: 0.02, len: [0.045, 0.028, 0.022] },
  ring: { at: [0.0105, 0.001, -0.078], w: 0.019, len: [0.042, 0.026, 0.021] },
  pinky: { at: [0.029, 0, -0.072], w: 0.0165, len: [0.033, 0.02, 0.018] },
};
const GH_THUMB = { at: [-0.03, -0.004, -0.012], len: [0.038, 0.03, 0.026] };
const GH_BONES = ['arm', 'wrist', ...['index', 'middle', 'ring', 'pinky', 'thumb'].flatMap(f => [f + '0', f + '1', f + '2'])];
const GH_BI = Object.fromEntries(GH_BONES.map((n, i) => [n, i]));
// Poses: each joint's turn [x, y, z] for a right hand (x < 0 curls towards the palm, y > 0 swings towards the thumb's
// side). anchor: where the cue's middle line passes, in the hand's frame, its -z towards the cue's tip; the bridge stays
// flat on the cloth (level), its anchor restHeight above it. fist, thumb and open are the reactions after a shot.
const GH_FIST = { index0: [-1.45, 0.04, 0], index1: [-1.6, 0, 0], index2: [-1, 0, 0], middle0: [-1.5, 0, 0], middle1: [-1.6, 0, 0], middle2: [-1, 0, 0],
  ring0: [-1.5, -0.03, 0], ring1: [-1.6, 0, 0], ring2: [-1, 0, 0], pinky0: [-1.45, -0.07, 0], pinky1: [-1.55, 0, 0], pinky2: [-1, 0, 0] };
const GH_POSES = {
  grip: { joints: { wrist: [0.15, 0, 0], index0: [-0.9, 0.04, 0], index1: [-1.4, 0, 0], index2: [-0.45, 0, 0], middle0: [-1, 0, 0], middle1: [-1.4, 0, 0], middle2: [-0.75, 0, 0],
    ring0: [-0.95, -0.03, 0], ring1: [-1.4, 0, 0], ring2: [-0.75, 0, 0], pinky0: [-0.7, -0.07, 0], pinky1: [-1.1, 0, 0], pinky2: [-0.6, 0, 0],
    thumb0: [-0.8, 0.4, 0], thumb1: [0, -1, 0], thumb2: [0, -0.8, 0] }, anchor: { pos: [0, -0.019, -0.076], rot: [0, Math.PI / 2, Math.PI / 2] } },
  bridge: { joints: { wrist: [0.52, -0.3, 0], index0: [-0.33, 0.14, 0], index1: [-0.15, 0, 0], index2: [0.12, 0, 0], middle0: [-0.29, 0.02, 0], middle1: [-0.15, 0, 0], middle2: [0.12, 0, 0],
    ring0: [-0.29, -0.12, 0], ring1: [-0.15, 0, 0], ring2: [0.12, 0, 0], pinky0: [-0.34, -0.3, 0], pinky1: [-0.15, 0, 0], pinky2: [0.12, 0, 0],
    thumb0: [0.2, 0.7, 0.6] }, anchor: { pos: [-0.0141, 0.0561, -0.0718], rot: [0.4, -0.55, 0] }, restHeight: 0.0401, level: true },
  fist: { joints: { ...GH_FIST, thumb0: [-0.55, 0.55, -0.35], thumb1: [0, -0.7, 0], thumb2: [0, -0.6, 0] } },
  thumb: { joints: { ...GH_FIST, thumb0: [0, 1.45, 0] } },
  open: { joints: { index0: [-0.15, 0.12, 0], index1: [-0.12, 0, 0], index2: [-0.08, 0, 0], middle0: [-0.1, 0, 0], middle1: [-0.12, 0, 0], middle2: [-0.08, 0, 0],
    ring0: [-0.15, -0.1, 0], ring1: [-0.12, 0, 0], ring2: [-0.08, 0, 0], pinky0: [-0.2, -0.22, 0], pinky1: [-0.12, 0, 0], pinky2: [-0.08, 0, 0],
    thumb0: [-0.2, 0.7, -0.5], thumb1: [0, -0.1, 0], thumb2: [0, -0.1, 0] } },
};
// Making the mesh: a list of triangles, each with its corners, their bones and weights, their texture positions and the
// part it belongs to (slot), which picks its material.
const HAND_GEO = {}, TEX_M = 0.032;   // the patterned gloves' pictures repeat every 3.2 cm
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vmid = (a, b, c) => [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
const vnorm = (a, b, c) => { const n = vcross(vsub(b, a), vsub(c, a)), l = Math.hypot(...n) || 1; return [n[0] / l, n[1] / l, n[2] / l]; };
const ghW = (...a) => { const out = []; for (let i = 0; i < a.length; i += 2) out.push([GH_BI[a[i]], a[i + 1]]); return out; };   // ghW('wrist', 0.5, 'index0', 0.5)
// a ring of n corners round a line along z; e < 1 squares it off, bottom scales the palm side
function ghRing(n, w, h, cx, cy, z, e = 1, bottom = 1, rot = 0) {
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = 2 * Math.PI * k / n + rot, c = Math.cos(a), s = Math.sin(a);
    pts.push([cx + w * Math.sign(c) * Math.abs(c) ** e, cy + (s < 0 ? h * bottom : h) * Math.sign(s) * Math.abs(s) ** e, z]);
  }
  return pts;
}
// joins rings (in order along -z) face by face, with a cap fanned to a point at either end; slotOf(middle, normal) picks
// the part. Textures run along the length and round the rings.
function ghLoft(T, rings, startCap, endCap, slotOf) {
  const n = rings[0].pts.length, per = rings.map(r => { let d = 0; return [...r.pts, r.pts[0]].map((p, k, a) => (d += k ? Math.hypot(...vsub(p, a[k - 1])) : 0) / TEX_M); });
  const u = r => -r.pts[0][2] / TEX_M, tri = (p, w, uv, slot) => T.push({ p, w, uv, slot: slot || slotOf(vmid(...p), vnorm(...p)) });
  for (let i = 0; i + 1 < rings.length; i++) for (let k = 0; k < n; k++) {
    const R0 = rings[i], R1 = rings[i + 1], k1 = (k + 1) % n, A = R0.pts[k], B = R0.pts[k1], C = R1.pts[k1], D = R1.pts[k];
    const ua = [u(R0), per[i][k]], ub = [u(R0), per[i][k + 1]], uc = [u(R1), per[i + 1][k + 1]], ud = [u(R1), per[i + 1][k]];
    tri([A, C, B], [R0.w, R1.w, R0.w], [ua, uc, ub]); tri([A, D, C], [R0.w, R1.w, R1.w], [ua, ud, uc]);
  }
  const fan = (R, pr, cap, flip) => { if (cap) for (let k = 0; k < n; k++) { const P = R.pts[k], Q = R.pts[(k + 1) % n], c = [-cap.p[2] / TEX_M, (pr[k] + pr[k + 1]) / 2];
    tri(flip ? [P, cap.p, Q] : [P, Q, cap.p], [R.w, R.w, R.w], flip ? [[u(R), pr[k]], c, [u(R), pr[k + 1]]] : [[u(R), pr[k]], [u(R), pr[k + 1]], c], cap.slot); } };
  fan(rings[0], per[0], startCap, false); fan(rings[rings.length - 1], per[rings.length - 1], endCap, true);
}
// a box lined up with the axes (nails, pads, a strap, panels), its faces turned outwards from its middle
function ghBlock(T, cx, cy, cz, w, h, d, wts, slot) {
  const v = (i, j, k) => [cx + (i - 0.5) * w, cy + (j - 0.5) * h, cz + (k - 0.5) * d], uv = p => [p[0] / TEX_M, -p[2] / TEX_M];
  for (const q of [[v(1, 0, 0), v(1, 1, 0), v(1, 1, 1), v(1, 0, 1)], [v(0, 0, 0), v(0, 0, 1), v(0, 1, 1), v(0, 1, 0)], [v(0, 1, 0), v(0, 1, 1), v(1, 1, 1), v(1, 1, 0)],
    [v(0, 0, 0), v(1, 0, 0), v(1, 0, 1), v(0, 0, 1)], [v(0, 0, 1), v(1, 0, 1), v(1, 1, 1), v(0, 1, 1)], [v(0, 0, 0), v(0, 1, 0), v(1, 1, 0), v(1, 0, 0)]])
    for (let t of [[q[0], q[1], q[2]], [q[0], q[2], q[3]]]) {
      const n = vnorm(...t), o = vsub(vmid(...t), [cx, cy, cz]); if (n[0] * o[0] + n[1] * o[1] + n[2] * o[2] < 0) t = [t[0], t[2], t[1]];
      T.push({ p: t, w: [wts, wts, wts], uv: t.map(uv), slot });
    }
}
const topOf = n => n[1] > -0.35;   // a face looking up or sideways, rather than at the palm side
// A glove type's parts: the cuff (open at the arm, darker inside), the wrist and palm in one piece to the line of the
// knuckles, four six-sided fingers, and the thumb webbed into the palm; then the type's extras: a strap across the wrist,
// a padded back panel, a knuckle strip or a raised guard, finger pads, and nails where the fingers are bare.
function ghTris(st) {
  const T = [], arm = ghW('arm', 1), long = (st.cuffL || 0) > 0.025 ? 0.01 : 0;
  const oct = (z, w, h) => ({ pts: ghRing(8, w, h, 0, 0, z, 1, 1, Math.PI / 8), w: arm });
  ghLoft(T, [oct(0.046 + long, 0.036, 0.025), oct(0.043 + long, 0.039, 0.028), oct(0.019, 0.039, 0.028), oct(0.016, 0.036, 0.025)],
    { p: [0, 0, 0.047 + long], slot: 'cuffEnd' }, { p: [0, 0, 0.015], slot: 'cuff' }, () => 'cuff');
  if (st.tab) ghBlock(T, 0, 0.0279, 0.031, 0.026, 0.004, 0.016, arm, 'cuffTrim');
  const palm = (z, w, h, cx, cy, bot, wt) => ({ pts: ghRing(10, w, h, cx, cy, z, 0.8, bot), w: wt });
  ghLoft(T, [palm(0.03, 0.026, 0.0165, 0, 0, 1, ghW('arm', 1)), palm(0.012, 0.028, 0.0165, 0, 0, 1, ghW('arm', 0.5, 'wrist', 0.5)), palm(0, 0.03, 0.016, -0.001, 0, 1, ghW('wrist', 1)),
    palm(-0.018, 0.036, 0.0162, -0.003, 0, 1, ghW('wrist', 1)), palm(-0.042, 0.0405, 0.0158, -0.002, 0.0005, 0.95, ghW('wrist', 1)), palm(-0.066, 0.042, 0.014, 0, 0.001, 0.9, ghW('wrist', 1)),
    palm(-0.08, 0.041, 0.0125, 0.0005, 0.0015, 0.85, ghW('wrist', 1))],
    { p: [0, 0, 0.032] }, { p: [0.0005, 0.001, -0.086] }, (c, n) => (c[2] > 0.004 ? 'wrist' : 'palm') + (topOf(n) ? 'Top' : 'Bottom'));
  if (st.knuckles) ghBlock(T, 0, 0.0148, -0.071, 0.07, 0.004, 0.02, ghW('wrist', 1), 'knuckle');   // a guard, a few millimetres proud
  else if (st.bar || st.wraps) ghBlock(T, 0, 0.0147, -0.073, 0.066, 0.0018, 0.008, ghW('wrist', 1), 'knuckle');   // a slim strip
  if (st.panel) ghBlock(T, 0, 0.0158, -0.04, 0.046, 0.0024, 0.03, ghW('wrist', 1), 'panel');
  for (const name in GH_FINGERS) {
    const { at: [x, y, z], w, len: L } = GH_FINGERS[name], j1 = z - L[0], j2 = j1 - L[1], tip = j2 - L[2], b0 = name + '0', b1 = name + '1', b2 = name + '2';
    const hex = (zz, sw, sh, wt, dy = 0) => ({ pts: ghRing(6, sw * w, sh * w, x, y + dy, zz), w: wt });
    ghLoft(T, [hex(z + 0.014, 0.44, 0.4, ghW('wrist', 1)), hex(z, 0.52, 0.48, ghW('wrist', 0.5, b0, 0.5)), hex(z - L[0] * 0.5, 0.47, 0.44, ghW(b0, 1)), hex(j1, 0.48, 0.45, ghW(b0, 0.5, b1, 0.5)),
      hex(j1 - L[1] * 0.5, 0.43, 0.4, ghW(b1, 1)), hex(j2, 0.42, 0.39, ghW(b1, 0.5, b2, 0.5)), hex(j2 - L[2] * 0.45, 0.4, 0.36, ghW(b2, 1)), hex(tip + 0.004, 0.33, 0.29, ghW(b2, 1), -0.0008)],
      { p: [x, y, z + 0.018] }, { p: [x, y - 0.15 * w, tip - 0.001] }, (c, n) => (c[2] > j1 ? 'prox' : c[2] > j2 ? 'mid' : 'dist') + (topOf(n) ? 'Top' : 'Bottom'));
    if (st.tips || st.wraps) ghBlock(T, x, y + 0.27 * w + 0.0003, tip + L[2] * 0.38, 0.36 * w, 0.0012, L[2] * 0.42, ghW(b2, 1), 'nail');
    if (st.guards) ghBlock(T, x, y + 0.47 * w * 0.866 + 0.0016, z - L[0] * 0.42, 0.5 * w, 0.004, L[0] * 0.45, ghW(b0, 1), 'pad');
  }
  const { at: [x, y, z], len: L } = GH_THUMB, j1 = z - L[0], j2 = j1 - L[1], tip = j2 - L[2], hex = (zz, sw, sh, wt) => ({ pts: ghRing(6, sw, sh, x, y, zz), w: wt });
  ghLoft(T, [hex(z + 0.008, 0.01, 0.009, ghW('wrist', 1)), hex(z, 0.0135, 0.0115, ghW('wrist', 0.4, 'thumb0', 0.6)), hex(z - 0.019, 0.0135, 0.0118, ghW('thumb0', 1)), hex(j1, 0.0112, 0.0098, ghW('thumb0', 0.5, 'thumb1', 0.5)),
    hex(j1 - L[1] * 0.5, 0.0104, 0.0092, ghW('thumb1', 1)), hex(j2, 0.01, 0.0088, ghW('thumb1', 0.5, 'thumb2', 0.5)), hex(j2 - L[2] * 0.5, 0.0093, 0.008, ghW('thumb2', 1)), hex(tip + 0.004, 0.0072, 0.0062, ghW('thumb2', 1))],
    { p: [x, y, z + 0.011] }, { p: [x, y - 0.0015, tip - 0.001] }, (c, n) => (c[2] > j1 + 0.006 ? 'palm' : c[2] > j2 ? 'prox' : 'dist') + (topOf(n) ? 'Top' : 'Bottom'));
  if (st.tips || st.wraps) ghBlock(T, x, y + 0.0065, tip + L[2] * 0.38, 0.0075, 0.0012, L[2] * 0.42, ghW('thumb2', 1), 'nail');
  return T;
}
// which of the glove's materials each part takes: the back of the hand and fingers in the main colour, the palm side a
// little lighter, bare skin past the cut of a fingerless glove (and all the fingers of hand wraps)
function ghMat(slot, st) {
  const f = /^(prox|mid|dist)(Top|Bottom)$/.exec(slot);
  if (f) return st.wraps || (st.tips && f[1] !== 'prox') ? 'skin' : f[2] === 'Top' ? 'base' : 'palm';
  return { cuff: 'cuff', cuffEnd: 'cuff', cuffTrim: 'accent', wristTop: 'base', wristBottom: 'palm', palmTop: 'base', palmBottom: 'palm', nail: 'nail', knuckle: 'accent', pad: 'accent', panel: 'panel' }[slot];
}
// the geometry from a list of triangles, for one side (s 1 for a right hand, -1 for a left: mirrored, each face turned
// back round): their corners, bones, texture positions and a shade (dark inside the cuff), a group of faces per material
function ghMake(tris, matOf, s) {
  const byMat = GLOVE_KEYS.map(() => []);
  for (const t of tris) { const m = matOf(t.slot); if (m) byMat[GLOVE_KEYS.indexOf(m)].push(t); }
  const all = byMat.flat(), n = all.length * 3, pos = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
  all.forEach((t, i) => (s < 0 ? [0, 2, 1] : [0, 1, 2]).forEach((c, j) => {
    const v = i * 3 + j, p = t.p[c], w = t.w[c], tot = w.reduce((a, e) => a + e[1], 0) || 1;
    pos.set([p[0] * s, p[1], p[2]], v * 3); uv.set(t.uv[c], v * 2); col.fill(t.slot === 'cuffEnd' ? 0.4 : 1, v * 3, v * 3 + 3);
    w.forEach((e, k) => { si[v * 4 + k] = e[0]; sw[v * 4 + k] = e[1] / tot; });
  }));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  let at = 0; byMat.forEach((g, m) => { if (g.length) geo.addGroup(at, g.length * 3, m); at += g.length * 3; });
  geo.computeVertexNormals(); geo.userData.keep = true;   // no shared corners, so every face stays flat
  return geo;
}
// a glove type's mesh for one side, made once
function ghGeo(key, s) { const id = key + s, st = STYLE[key]; return HAND_GEO[id] || (HAND_GEO[id] = ghMake(ghTris(st), slot => ghMat(slot, st), s)); }
// a boxing glove: one padded mitt with the thumb along its side, as a left hand in the model's frame (no joints to bend)
function boxingGeo() {
  if (HAND_GEO.boxing) return HAND_GEO.boxing;
  const T = [], wr = ghW('wrist', 1), oct = (z, w, h, y = 0) => ({ pts: ghRing(8, w, h, 0, y, z, 0.75, 1, Math.PI / 8), w: wr });
  ghLoft(T, [oct(0.05, 0.034, 0.026), oct(0.047, 0.037, 0.029), oct(0.014, 0.036, 0.028), oct(0.011, 0.033, 0.025)], { p: [0, 0, 0.051], slot: 'cuffEnd' }, { p: [0, 0, 0.01], slot: 'cuff' }, () => 'cuff');
  ghLoft(T, [oct(0.012, 0.03, 0.024, 0.004), oct(-0.012, 0.042, 0.032, 0.006), oct(-0.05, 0.046, 0.036, 0.006), oct(-0.085, 0.042, 0.032, 0.005), oct(-0.103, 0.029, 0.022, 0.004)],
    { p: [0, 0.004, 0.014] }, { p: [0, 0.004, -0.111] }, () => 'mitt');
  const th = (z, r) => ({ pts: ghRing(6, r, r * 0.85, -0.04, -0.008, z), w: wr });
  ghLoft(T, [th(-0.008, 0.012), th(-0.03, 0.0135), th(-0.05, 0.011)], { p: [-0.04, -0.008, -0.002] }, { p: [-0.039, -0.008, -0.058] }, () => 'mitt');
  return (HAND_GEO.boxing = ghMake(T, slot => slot === 'mitt' ? 'base' : 'cuff', -1));
}
// a hand of a glove type ('left' or 'right') on its own skeleton, in a pose
function ghHand(key, side, M, pose) {
  const s = side === 'right' ? 1 : -1, bones = {}, list = GH_BONES.map(n => (bones[n] = new THREE.Bone()));
  bones.arm.add(bones.wrist);
  for (const f of [...Object.keys(GH_FINGERS), 'thumb']) {
    const d = f === 'thumb' ? GH_THUMB : GH_FINGERS[f];
    bones[f + '0'].position.set(d.at[0] * s, d.at[1], d.at[2]); bones[f + '1'].position.set(0, 0, -d.len[0]); bones[f + '2'].position.set(0, 0, -d.len[1]);
    bones.wrist.add(bones[f + '0']); bones[f + '0'].add(bones[f + '1']); bones[f + '1'].add(bones[f + '2']);
  }
  const hand = new THREE.Group(), mesh = new THREE.SkinnedMesh(ghGeo(key, s), GLOVE_KEYS.map(k => M[k]));
  mesh.frustumCulled = false; mesh.add(bones.arm); hand.add(mesh); hand.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton(list));   // posed, it reaches well outside its resting bounds
  const h = { hand, s, bones, mesh }; ghPose(h, pose); return h;
}
function ghPose(h, pose) {   // each joint's turn, mirrored for a left hand, and where the cue goes
  const p = GH_POSES[pose]; h.pose = p;
  for (const n of GH_BONES) if (n !== 'arm') { const r = p.joints[n] || [0, 0, 0]; h.bones[n].rotation.set(r[0], r[1] * h.s, r[2] * h.s); }
  h.anchor = p.anchor && { pos: new THREE.Vector3(p.anchor.pos[0] * h.s, p.anchor.pos[1], p.anchor.pos[2]), quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(p.anchor.rot[0], p.anchor.rot[1] * h.s, p.anchor.rot[2] * h.s)).invert() };
}
// places a posed hand in its parent so its anchor sits on the cue's middle line at point, the cue pointing along dir
// towards its tip, up being up (for a level pose, the hand stays flat whatever the cue's slope)
const GA = { x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3(), m: new THREE.Matrix4(), up: new THREE.Vector3(0, 1, 0), p: new THREE.Vector3(), along: new THREE.Vector3(1, 0, 0), side: new THREE.Vector3(0, 0, 1), q: new THREE.Quaternion() };
function ghAttach(h, point, dir) {
  GA.z.copy(dir); if (h.pose.level && GA.z.x * GA.z.x + GA.z.z * GA.z.z > 1e-10) GA.z.y = 0;
  GA.z.normalize().negate(); GA.x.crossVectors(GA.up, GA.z); if (GA.x.lengthSq() < 1e-10) GA.x.set(1, 0, 0);
  GA.x.normalize(); GA.y.crossVectors(GA.z, GA.x);
  h.hand.quaternion.setFromRotationMatrix(GA.m.makeBasis(GA.x, GA.y, GA.z)).multiply(h.anchor.quat);
  h.hand.position.copy(point).sub(GA.p.copy(h.anchor.pos).applyQuaternion(h.hand.quaternion));
}
// The robot claw and the skeleton keep their jointed parts, faceted like the rest: two sections per finger, ending in a stub.
const capsuleX = (r, len) => { const g = new THREE.CapsuleGeometry(r, Math.max(0.0001, len - 2 * r), 2, 6); g.rotateZ(-Math.PI / 2); g.translate(len / 2, 0, 0); return g; };
function partsHand(hand, st, M, P) {
  const mesh = (geo, mat, g = hand) => { const m = new THREE.Mesh(geo, M[mat]); g.add(m); return m; };
  const blob = (sx, sy, sz, mat, x, y, z, ry = 0, g = hand) => { const m = mesh(new THREE.SphereGeometry(1, 8, 6), mat, g); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.y = ry; return m; };
  const ball = (r, mat, g, x = 0) => { const m = mesh(new THREE.SphereGeometry(r, 6, 4), mat, g); m.position.x = x; return m; };
  const cg = new THREE.CylinderGeometry(0.027, 0.025, 0.016, 8); cg.rotateZ(Math.PI / 2);
  const cuff = mesh(cg, 'cuff'); cuff.position.x = 0; cuff.scale.set(1, 0.78, 1.12);
  if (st.bones) {   // no palm: the small bones of the wrist, then one long bone out to each knuckle
    blob(0.013, 0.007, 0.021, 'base', 0.012, 0, 0);
    for (const f of FINGER) {
      const z0 = f.at[2] * 0.55, b = new THREE.Group(); b.position.set(0.016, 0, z0); b.rotation.y = Math.atan2(z0 - f.at[2], f.at[0] - 0.016); hand.add(b);
      mesh(capsuleX(0.0032, Math.hypot(f.at[0] - 0.016, f.at[2] - z0)), 'base', b);
    }
  } else { blob(0.047, 0.0155, 0.041, 'base', 0.047, 0, 0); blob(0.027, 0.0135, 0.017, 'base', 0.03, -0.003, 0.021, -0.5); }
  // a jointed chain of sections: each joint is a group turned by the pose, each section a capsule along its +x; jr adds a
  // ball at each joint, tip a lit ball at the end
  const chain = (at, len, r, bends, jr = 0, tip = 0) => {
    let g = new THREE.Group(); g.position.set(...at); hand.add(g); const joints = [];
    len.forEach((l, i) => {
      g.rotation.z = bends[i]; joints.push(g);
      const ri = r * (1 - i * 0.08); mesh(capsuleX(ri, l), 'base', g); if (jr) ball(jr, 'accent', g);
      if (i < len.length - 1) { const n = new THREE.Group(); n.position.x = l - ri * 0.4; g.add(n); g = n; }
      else if (tip) ball(tip, 'tip', g, l - ri);
    });
    return joints;
  };
  const which = st.claw ? [0, 1, 3] : [0, 1, 2, 3], fr = st.bones ? () => 0.0034 : f => f.r[0] * 1.1;
  const fingers = which.map((fi, i) => {
    const f = FINGER[fi], j = chain(f.at, [f.len[0], f.len[1]], fr(f), P.pb ? P.pb[fi] : [P.bend[fi][0], P.bend[fi][1] + P.bend[fi][2]], st.bones ? 0.0052 : fr(f) * 1.08, st.claw ? fr(f) * 0.85 : 0);
    j[0].rotation.y = (st.claw ? [-0.12, 0, 0.16][i] : f.fan) * P.spread;
    return j;
  });
  const [ty, tz, tb] = P.pt || [P.ty, P.tz, P.tb[0] + P.tb[1]], thumb = chain([0.016, -0.006, 0.024], [0.04, 0.031], st.bones ? 0.0038 : 0.0115, [tz, tb], st.bones ? 0.0055 : 0);
  thumb[0].rotation.y = ty; thumb[0].rotation.order = 'YZX';
  return { hand, fingers, thumb };
}
// a left hand in the parts' frame (fingers along +x): the robot claw and the skeleton from parts, the others as a
// one-piece hand turned round from the model's frame
function handBuild(parent, it, st, M, pose) {
  const hand = new THREE.Group(); parent.add(hand);
  if (st.claw || st.bones) return partsHand(hand, st, M, HAND_POSE[pose]);
  const inner = new THREE.Group(); inner.rotation.y = -Math.PI / 2; hand.add(inner);
  if (st.ball) inner.add(new THREE.Mesh(boxingGeo(), GLOVE_KEYS.map(k => M[k])));
  else inner.add(ghHand(it.style in STYLE ? it.style : 'sport', 'left', M, pose).hand);
  return { hand, fingers: [], thumb: [] };
}
// turns a group so its +x, +y and +z point along a, b and c
const orient = (g, a, b, c) => g.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(...a), new THREE.Vector3(...b), new THREE.Vector3(...c)));
function gloveBuild(root, it, kind, M) {
  root.traverse(o => { if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose(); if (o.skeleton) o.skeleton.dispose(); }); root.clear(); root.userData.h = null;
  const key = it.style in STYLE ? it.style : 'sport', st = STYLE[key], one = !st.claw && !st.bones && !st.ball, g = new THREE.Group(); root.add(g);
  if (kind === 'bridge') {   // an open bridge: heel of the hand and fingertips on the cloth, knuckles up, the cue in the V of the thumb
    tapFinger = null;
    if (one) { const h = root.userData.h = ghHand(key, 'left', M, 'bridge'); g.add(h.hand); tapFinger = h.bones.pinky0; tapFinger.userData.ax = 'x'; }   // placed on the cue's line by updateGloves
    else {
      const r = handBuild(g, it, st, M, 'bridge');
      if (st.ball) r.hand.position.set(-0.118, 0.03, -0.05);   // a boxing glove can't make a bridge: the cue rests on its thumb, beside the mitt
      else { r.hand.position.set(-0.118, 0.016, -0.036); r.hand.rotation.set(0, -0.32, 0.3); }   // turned a little, the arm coming from behind and to the left
      const f = r.fingers[r.fingers.length - 1]; if (f) { tapFinger = f[0]; tapFinger.userData.ax = 'z'; }
    }
    if (tapFinger) tapFinger.userData.bend = tapFinger.rotation[tapFinger.userData.ax];
  } else if (kind === 'grip') {   // the cue hand: hanging from the wrist, fingers wrapped round the cue near its butt
    g.position.set(-1.2, 0, 0);
    if (one) { const h = ghHand(key, 'right', M, 'grip'); g.add(h.hand); ghAttach(h, new THREE.Vector3(), GA.along); }   // the thumb towards the tip
    else {
      const m = new THREE.Group(); m.scale.z = -1; g.add(m);   // mirrored: a right hand
      const r = handBuild(m, it, st, M, 'grip');
      orient(r.hand, [0, -1, 0], [0, 0, -1], [1, 0, 0]);   // fingers down, back of the hand outwards, thumb towards the tip
      r.hand.position.set(0, 0.099, -0.022);
    }
  } else {   // the reaction hand, facing the camera (+z): a thumbs-up, a fist pump and a shrug
    const mk = (pose, a, b, c) => { const p = new THREE.Group(); g.add(p); const r = handBuild(p, it, st, M, pose); orient(r.hand, a, b, c); r.hand.position.set(0, -0.05, 0); return p; };
    const thumb = mk('thumb', [1, 0, 0], [0, 0, -1], [0, 1, 0]), pump = mk('fist', [1, 0, 0], [0, 0, -1], [0, 1, 0]), shrug = mk('open', [0, 0, 1], [0, -1, 0], [1, 0, 0]);
    for (const p of [thumb, pump]) p.children[0].position.set(-0.045, -0.02, 0);
    shrug.children[0].position.set(0, 0, -0.06); shrug.rotation.x = 0.3;
    g.scale.setScalar(1.25); CHEER.poses = { thumb, pump, shrug };
  }
}
// colours and effects: a design's base, accent and cuff (skin for fingerless gloves, tip for claws), a little of their
// own colour in the shadows so the near faces never go grey, and a glow for the designs that have one
// Textures for the legendary and mythic gloves, round each part of the hand (repeating both ways, 64 × 64): gold leaf
// with its crackle, flames, phantom smoke, molten crust with glowing cracks, and holographic prism bands. glow: a map
// of where the glove shines, if it does.
const GLOVE_TEX = {};
function gloveTex(it) {
  const kind = { glow: 'leaf', flicker: 'fire', ghost: 'smoke', molten: 'crust', prism: 'holo', ecto: 'ecto', lantern: 'pumpkin', ghostfire: 'gfire', banshee: 'wail' }[it.fx]; if (!kind || !['legendary', 'mythic'].includes(it.rarity)) return null;
  if (GLOVE_TEX[it.id]) return GLOVE_TEX[it.id];
  const n = makeNoise(71), n2 = makeNoise(72), W = 64, white = [255, 255, 255];
  const cellular = (X, Y) => {   // distance to the nearest crack between irregular cells, on a 4 × 4 repeating grid
    let f1 = 9, f2 = 9; const gx = Math.floor(X), gy = Math.floor(Y);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const cx = ((gx + dx) % 4 + 4) % 4, cy = ((gy + dy) % 4 + 4) % 4, px = gx + dx + 0.15 + 0.7 * n2(cx * 9.1, cy * 5.3), py = gy + dy + 0.15 + 0.7 * n2(cx * 3.7 + 40, cy * 8.9), d = Math.hypot(X - px, Y - py); if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d; }
    return (f2 - f1) / 2;
  };
  const pic = fn => canvasTex(W, W, g => paint(g, W, W, (x, y) => fn(x / W, y / W)), [1, 1]);
  let map, glow = null;
  if (kind === 'leaf') map = pic((u, v) => { const e = cellular(u * 4, v * 4), sheen = fbm(n, u * 8, v * 8, 3, 8, 8);
    return clampc(mixc(mixc(rgb('#9a6a12'), rgb('#ffd56b'), sheen * 1.2), rgb('#5a3a08'), Math.exp(-e / 0.03) * 0.8)); });
  else if (kind === 'fire') {
    const f = (u, v) => { const t = fbm(n, u * 8, v * 8, 4, 8, 8); return Math.max(0, Math.min(1, (t - 0.3) * 1.8)); };
    map = pic((u, v) => { const t = f(u, v); return clampc(t < 0.5 ? mixc(rgb('#5a0d06'), rgb('#ff4a1a'), t * 2) : mixc(rgb('#ff4a1a'), rgb('#ffe27a'), (t - 0.5) * 2)); });
    glow = pic((u, v) => { const t = Math.pow(f(u, v), 2) * 255; return [t, t, t]; });
  } else if (kind === 'smoke') { map = pic((u, v) => { const w = fbm(n, u * 4 + 2 * fbm(n2, u * 4, v * 4, 3, 4, 4), v * 4, 4, 4, 4); return clampc(mixc(rgb('#5d4bb0'), rgb('#efe8ff'), w * 1.3)); }); glow = map; }
  else if (kind === 'crust') {
    const heat = (u, v) => Math.exp(-cellular(u * 4, v * 4) / (0.03 + 0.02 * n(u * 16, v * 16, 16, 16)));
    map = pic((u, v) => { const h = heat(u, v), rock = mixc(rgb('#1a0806'), rgb('#4a1d10'), fbm(n, u * 16, v * 16, 2, 16, 16)); return clampc(mixc(rock, mixc(rgb('#ff6a1a'), rgb('#ffe27a'), Math.max(0, h - 0.6) * 2.5), Math.min(1, h * 1.3))); });
    glow = pic((u, v) => { const h = Math.pow(heat(u, v), 1.5) * 255; return [h, h, h]; });
  } else if (kind === 'ecto') { map = pic((u, v) => { const w = fbm(n, u * 4 + 1.5 * fbm(n2, u * 4, v * 4, 3, 4, 4), v * 4, 4, 4, 4); return clampc(mixc(rgb('#3d8a70'), rgb('#e8fff4'), Math.pow(w, 1.4) * 1.4)); }); glow = map; }   // Spectre: pale green ectoplasm, swirling
  else if (kind === 'pumpkin') {   // Jack-o'-lantern: an orange rind with its ribs, and carved holes glowing from inside
    const carve = (u, v) => { const cu = (u * 2) % 1, cv = (v * 2) % 1; return Math.max(0, 1 - Math.max(Math.abs(cu - 0.5) * 3.2 + (cv - 0.3) * 1.5, (0.3 - cv) * 5)) > 0.45 ? 1 : 0; };   // little triangles, as if carved
    map = pic((u, v) => { const rib = 0.5 + 0.5 * Math.cos(v * 2 * Math.PI * 8), c = mixc(rgb('#9a3a0a'), rgb('#ff8a2a'), 0.35 + 0.5 * rib + 0.15 * fbm(n, u * 8, v * 8, 2, 8, 8));
      return clampc(carve(u, v) ? mixc(rgb('#ffd23f'), white, 0.2) : c); });
    glow = pic((u, v) => { const k = carve(u, v) * 255; return [k, k, k * 0.6]; });
  } else if (kind === 'gfire') {   // Ghost fire: green flames, pale where hottest
    const f = (u, v) => { const t = fbm(n, u * 8, v * 8, 4, 8, 8); return Math.max(0, Math.min(1, (t - 0.3) * 1.8)); };
    map = pic((u, v) => { const t = f(u, v); return clampc(t < 0.5 ? mixc(rgb('#06221a'), rgb('#2fd67a'), t * 2) : mixc(rgb('#2fd67a'), rgb('#e0fff0'), (t - 0.5) * 2)); });
    glow = pic((u, v) => { const t = Math.pow(f(u, v), 2) * 255; return [t, t, t]; });
  } else if (kind === 'wail') { map = pic((u, v) => { const w = fbm(n, u * 2 + 2 * fbm(n2, u * 4, v * 4, 3, 4, 4), v * 6, 4, 2, 6), streak = Math.pow(1 - Math.abs(2 * w - 1), 4); return clampc(mixc(rgb('#3a2a7a'), rgb('#f2eeff'), Math.min(1, streak * 1.2 + w * 0.3))); }); glow = map; }   // Banshee: wailing streaks of pale violet light
  else { map = pic((u, v) => { const b = (u * 2 + v * 3 + 0.4 * fbm(n, u * 4, v * 4, 3, 4, 4)) % 1, c = new THREE.Color().setHSL(b, 0.85, 0.62); return clampc(mixc([c.r * 255, c.g * 255, c.b * 255], white, Math.max(0, n2(u * 16, v * 16, 16, 16) - 0.75) * 3)); }); glow = map; }
  return (GLOVE_TEX[it.id] = { map, glow });
}
// On a one-piece hand the trims are toned towards the glove's main colour, so they read as panels rather than blocks.
const TONE = { accent: 0.6, cuff: 0.75, panel: 0.4 };
function gloveColours(M, it) {
  const glow = it.fx ? it.fxc : null, tx = gloveTex(it), one = !['claw', 'bones'].includes(it.style);   // one: a one-piece hand (its vertex colours darken the inside of the cuff)
  for (const k of GLOVE_KEYS) {
    const raw = k === 'skin' ? it.skin || it.base : k === 'tip' ? it.fxc || it.accent : k === 'panel' ? it.cuff : k === 'palm' ? it.base : k === 'nail' ? it.skin || '#e0ac7e' : it[k];
    const col = one && TONE[k] ? new THREE.Color(it.base).lerp(new THREE.Color(raw), TONE[k]) : new THREE.Color(raw);
    if (k === 'palm' || k === 'nail') col.lerp(new THREE.Color(k === 'palm' ? '#ffffff' : '#fff4ee'), k === 'palm' ? 0.16 : 0.35);   // the palm side a little lighter, nails paler than the skin
    M[k].color.copy(col); M[k].emissive.copy(col).multiplyScalar(0.3);
    if (glow && (k === 'accent' || k === 'tip')) M[k].emissive.set(glow).multiplyScalar(one ? 0.5 : 1);
    const see = ['ghost', 'ecto', 'banshee'].includes(it.fx); M[k].transparent = see; M[k].opacity = see ? (it.fx === 'ecto' ? 0.75 : 0.6) : 1; M[k].vertexColors = one; M[k].needsUpdate = true;   // see-through
  }
  for (const k of ['base', 'palm', 'panel', 'accent']) {   // a textured glove shows its picture in full colour, all over (the trims lightly tinted)
    const on = tx && (k !== 'accent' || one); M[k].map = on ? tx.map : null; M[k].emissiveMap = on ? tx.glow : null;
    if (on) { M[k].color.set(k === 'panel' || k === 'accent' ? new THREE.Color('#ffffff').lerp(new THREE.Color(k === 'panel' ? it.cuff : it.accent), 0.35) : '#ffffff'); M[k].emissive.set(tx.glow ? '#000000' : it.base).multiplyScalar(tx.glow ? 1 : 0.15); }
  }
}
function applyGlove(id) {
  gloveNow = id; const it = kindOf(id) === 'glove' ? LK.ALL[id] : null;
  gripGlove.visible = bridgeGlove.visible = !!it; if (!it) return;
  gloveBuild(gripGlove, it, 'grip', GLM); gloveBuild(bridgeGlove, it, 'bridge', GLM); gloveColours(GLM, it);
}
cueMesh.add(gripGlove); scene.add(bridgeGlove, cheerGlove); applyGlove('none'); cheerGlove.visible = false;
// whose gloves are at the table: the same rules as the cue (cueFor)
function gloveFor(pl) {
  if (PREV.on) return PREV.looks.glove;
  if (NET.on) return pl === NET.seat ? S.glove : NET.peerGlove;
  if (M.opp === 'bot' && M.mode !== 'practice' && pl === 1) return CAR.on ? K.OPPONENTS[CAR.opp].glove || 'none' : 'none';
  return S.glove;
}
// the glow effects: a slow pulse, a flame's flicker, a ghost's fading in and out
function gloveFx(M, it, t) {
  if (!it.fx) return;
  const map = M.base.map;
  if (it.fx === 'molten') {   // mythic: the cracks glow red to orange to gold and back, and the crust creeps
    M.base.emissive.setHSL(0.02 + 0.07 * (0.5 + 0.5 * Math.sin(t * 0.9)), 1, 0.5).multiplyScalar(0.8 + 0.2 * Math.sin(t * 1.7)); if (map) map.offset.y = t * 0.02;
  } else if (it.fx === 'prism') {   // mythic: the holographic bands slide round the hand, shining in their own colours
    M.base.emissive.setScalar(0.35 + 0.1 * Math.sin(t * 1.3)); if (map) map.offset.x = t * 0.08;
  } else if (it.fx === 'flicker') {   // flames rising, their glow wavering about once a second
    const k = 0.6 + 0.25 * Math.sin(t * 5.5) * Math.sin(t * 2.1); M.base.emissive.set(it.fxc).multiplyScalar(0.45 + 0.4 * k); if (map) map.offset.y = -t * 0.15;
  } else if (it.fx === 'ghost') {
    M.base.emissive.set(it.fxc).multiplyScalar(0.4); if (map) map.offset.x = t * 0.03;
    for (const key of GLOVE_KEYS) M[key].opacity = 0.45 + 0.2 * Math.sin(t * 1.8);
  } else if (it.fx === 'ecto') {   // Spectre: the ectoplasm swirls slowly and its glow breathes
    M.base.emissive.set(it.fxc).multiplyScalar(0.3 + 0.12 * Math.sin(t * 1.2)); if (map) map.offset.set(t * 0.02, t * 0.01);
  } else if (it.fx === 'lantern') {   // Jack-o'-lantern: candlelight behind the carving, flickering gently
    M.base.emissive.set(it.fxc).multiplyScalar(0.75 + 0.2 * Math.sin(t * 2.3) * Math.sin(t * 0.8));
  } else if (it.fx === 'ghostfire') {   // mythic: green flames rising, their glow wavering
    const k = 0.6 + 0.25 * Math.sin(t * 4.6) * Math.sin(t * 1.7); M.base.emissive.set(it.fxc).multiplyScalar(0.5 + 0.4 * k); if (map) map.offset.y = -t * 0.18;
  } else if (it.fx === 'banshee') {   // mythic: fading in and out, its streaks drifting, from violet to pale blue and back
    M.base.emissive.setHSL(0.68 + 0.06 * Math.sin(t * 0.7), 0.7, 0.55).multiplyScalar(0.55); if (map) map.offset.x = t * 0.05;
    for (const key of GLOVE_KEYS) M[key].opacity = 0.42 + 0.28 * (0.5 + 0.5 * Math.sin(t * 0.9));
  }
  for (const k of ['palm', 'panel']) if (M[k].map) M[k].emissive.copy(M.base.emissive);
  const c = new THREE.Color(it.fxc), k = (0.75 + 0.25 * Math.sin(t * 2.4)) * (['claw', 'bones'].includes(it.style) ? 1 : 0.5);   // a one-piece glove's trim glows softly
  M.accent.emissive.copy(c).multiplyScalar(k); M.tip.emissive.copy(c).multiplyScalar(k);
}
const vG = new THREE.Vector3();
// places the bridge hand behind the cue ball (on the rail if the cloth runs out), hides the cue hand when the camera
// is right on top of it, and plays the small movements: a fingertip drumming while you line up, the reactions
function updateGloves(show, now) {
  const want = gloveFor(game.turn); if (want !== gloveNow) applyGlove(want);
  const t = reduceMotion ? 0 : now / 1000, it = kindOf(gloveNow) === 'glove' ? LK.ALL[gloveNow] : null;
  updateCheer(now);
  if (!it) return;
  bridgeGlove.visible = show; gloveFx(GLM, it, t); if (!show) return;
  const cue = world.balls[0], dx = Math.cos(aim.phi), dz = Math.sin(aim.phi), h = bridgeGlove.userData.h, d = h ? 0.2 : 0.25;
  const bx = cue.x - dx * d, bz = cue.z - dz * d, off = Math.abs(bx) > T.hl || Math.abs(bz) > T.hw;
  bridgeGlove.position.set(bx, off ? RAIL_TOP : 0, bz); bridgeGlove.rotation.y = -aim.phi;
  if (h) {   // the cue's middle line where it passes over the hand (as updateCue places it); a higher line (top spin)
    // tips the hand up on its fingertips, as a player raises the bridge, rather than lifting it off the cloth
    const a = aim.sx * P.maxSpin * R, b = aim.sy * P.maxSpin * R, c = Math.sqrt(Math.max(0, R * R - a * a - b * b));
    const y = R + b + (d - c) * Math.tan(5 * DEG) - bridgeGlove.position.y, rest = h.pose.restHeight, lift = Math.min(0.03, Math.max(0, y - rest));
    ghAttach(h, vG.set(0, rest, a), GA.along);   // a lower line just passes lower through the V
    if (lift) { const L = 0.085, th = -Math.asin(lift / L); vG.set(L, 0, a); h.hand.position.sub(vG).applyAxisAngle(GA.side, th).add(vG); h.hand.quaternion.premultiply(GA.q.setFromAxisAngle(GA.side, th)); }
  }
  if (tapFinger) tapFinger.rotation[tapFinger.userData.ax] = tapFinger.userData.bend + (state === 'aim' ? Math.max(0, Math.sin(t * 3.2)) * 0.35 * (Math.sin(t * 0.9) > 0.4 ? 1 : 0) : 0);
  gripGlove.children[0].position.y = state === 'aim' ? Math.sin(t * 1.7) * 0.0025 : 0;
  gripGlove.getWorldPosition(vG); gripGlove.visible = vG.distanceTo(camera.position) > 0.3;
}
// a reaction after a shot, by the shooter's glove: 'thumb' (potted), 'pump' (won the frame) or 'shrug' (fouled),
// floating above the cue ball for a moment and facing the camera. Off when the device asks for less motion.
function cheer(kind, player) {
  const id = gloveFor(player); if (reduceMotion || kindOf(id) !== 'glove' || replay) return;
  const it = LK.ALL[id]; if (cheerNow !== id) { cheerNow = id; gloveBuild(cheerGlove, it, 'cheer', CHM); gloveColours(CHM, it); }
  const cue = world.balls[0]; Object.assign(CHEER, { kind, t0: performance.now(), x: cue.x, z: cue.z, it });
}
function updateCheer(now) {
  const u = (now - CHEER.t0) / 1400; cheerGlove.visible = !!CHEER.kind && u < 1 && !paused;
  if (!cheerGlove.visible) { CHEER.kind = ''; return; }
  const P = CHEER.poses; for (const k in P) P[k].visible = k === CHEER.kind;
  const pop = Math.min(1, u * 7, (1 - u) * 6), t = (now - CHEER.t0) / 1000;
  cheerGlove.scale.setScalar(pop); cheerGlove.position.set(CHEER.x, 0.09 + u * 0.03 + (CHEER.kind === 'pump' ? Math.abs(Math.sin(t * 9)) * 0.03 : 0), CHEER.z);
  cheerGlove.rotation.set(0, Math.atan2(camera.position.x - CHEER.x, camera.position.z - CHEER.z), CHEER.kind === 'shrug' ? Math.sin(t * 10) * 0.3 : CHEER.kind === 'thumb' ? Math.sin(t * 6) * 0.12 : 0);
  gloveFx(CHM, CHEER.it, t);
}

// ------------------------------------------------------------------ guide lines
function mkLine(color, max = 800, loop = false) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3)); g.setDrawRange(0, 0);
  const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, fog: false });
  const l = loop ? new THREE.LineLoop(g, m) : new THREE.Line(g, m); l.frustumCulled = false; l.renderOrder = 5; l.visible = false; scene.add(l); return l;
}
function setLine(l, pts, y = 0.004) {
  const a = l.geometry.attributes.position.array, n = Math.min(pts.length, a.length / 3);
  for (let i = 0; i < n; i++) { a[i * 3] = pts[i][0]; a[i * 3 + 1] = y; a[i * 3 + 2] = pts[i][1]; }
  l.geometry.attributes.position.needsUpdate = true; l.geometry.setDrawRange(0, n); l.visible = n > 1;
}
const circlePts = (x, z, r, n = 28) => Array.from({ length: n }, (_, i) => [x + Math.cos(i / n * 6.2832) * r, z + Math.sin(i / n * 6.2832) * r]);
const G_CUE = mkLine('#fff4d6'), G_CUE2 = mkLine('#7cc4ff'), G_OBJ = mkLine('#ffc56b'), G_GHOST = mkLine('#fff4d6', 40, true);
const G_HAND = mkLine('#7dffb0', 40, true), G_KITCHEN = mkLine('#7dffb0', 4);
const allGuides = [G_CUE, G_CUE2, G_OBJ, G_GHOST, G_HAND, G_KITCHEN];

// ------------------------------------------------------------------ audio
const AU = { ctx: null, noise: null, lastT: 0, burst: 0 };
function ensureAudio() {
  if (!S.volume) return;
  if (!AU.ctx) {
    try {
      AU.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const len = Math.floor(AU.ctx.sampleRate * 0.4), buf = AU.ctx.createBuffer(1, len, AU.ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      AU.noise = buf; AU.master = AU.ctx.createGain(); AU.master.connect(AU.ctx.destination);
    } catch (e) { AU.ctx = null; }
  }
  if (AU.master) AU.master.gain.value = 0.7 * S.volume / 0.75;   // 75% is the original loudness
  if (AU.ctx && AU.ctx.state === 'suspended') AU.ctx.resume();
}
function blip(f, dur, vol, type = 'sine', f2 = 0, delay = 0) {
  const c = AU.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(AU.master); o.start(t); o.stop(t + dur + 0.02);
}
function hiss(dur, vol, fc, q, type = 'bandpass', delay = 0) {
  const c = AU.ctx, t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = AU.noise; f.type = type; f.frequency.value = fc; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(AU.master); s.start(t, Math.random() * 0.2); s.stop(t + dur + 0.02);
}
function sfx(kind, v = 1) {
  if (!S.volume || !AU.ctx) return;
  const now = AU.ctx.currentTime;
  if (kind === 'bb' || kind === 'cush') { if (now - AU.lastT < 0.015) { if (++AU.burst > 3) return; } else AU.burst = 0; AU.lastT = now; }
  try {
    if (kind === 'bb') { const g = clamp(v / 3, 0.02, 0.55); blip(2300 + Math.random() * 500, 0.03, g * 0.45, 'triangle'); hiss(0.022, g * 0.7, 3600, 1.4); }
    else if (kind === 'cush') { const g = clamp(v / 4, 0.02, 0.45); blip(160, 0.09, g * 0.8, 'sine', 80); hiss(0.05, g * 0.35, 700, 0.8, 'lowpass'); }
    else if (kind === 'pot') { blip(115, 0.2, 0.32, 'sine', 55); hiss(0.14, 0.12, 900, 2, 'bandpass', 0.05); blip(330, 0.06, 0.05, 'square', 0, 0.02); }
    else if (kind === 'cue') { const g = clamp(v / 6, 0.08, 0.5); blip(780, 0.045, g * 0.6, 'triangle', 420); hiss(0.02, g * 0.6, 2400, 1); }
    else if (kind === 'ui') blip(660, 0.05, 0.06, 'square');
    else if (kind === 'foul') { blip(220, 0.16, 0.08, 'square', 140); blip(165, 0.2, 0.07, 'square', 110, 0.14); }
    else if (kind === 'win') [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.14, 0.07, 'square', 0, i * 0.1));
    else if (kind === 'fanfare') {   // a case's prize: longer and brighter the rarer it is (v: 0 common to 4 mythic)
      const notes = [[659], [523, 659, 784], [523, 659, 784, 1046], [392, 523, 659, 784, 1046, 1318], [392, 523, 659, 784, 1046, 1318, 1568, 2093]][clamp(v, 0, 4)];
      notes.forEach((f, i) => blip(f, 0.15, 0.07, 'square', 0, i * 0.085));
      if (v >= 3) blip(98, 0.6, 0.14, 'sine', 49);
      if (v >= 4) [1046, 1318, 1568].forEach(f => blip(f, 0.9, 0.05, 'triangle', 0, notes.length * 0.085));
    }
  } catch (e) {}
}

// ------------------------------------------------------------------ game state
let world = C.makeWorld(C.rack8()), game = C.newGame('8ball');
let state = 'menu', paused = false, EARN = null;
const aim = { phi: 0, power: 0.35, sx: 0, sy: 0 };
let shotBefore = null, undoStack = [], shots = [0, 0], matchWins = [0, 0], breaker = 0, potAnims = [], acc = 0;
let lastShot = null, replay = null, EDIT = false, touchTurn = { dir: 0, t: 0 }, remoteStrike = null, movingT = 0, aimDirty = true, lastPreview = 0, stroke = null, bot = null, botAim = null, lastRes = null;
const isBot = pl => !NET.on && M.mode !== 'practice' && M.opp === 'bot' && pl === 1;
const humanTurn = () => NET.on ? game.turn === NET.seat : !isBot(game.turn);
const botName = () => CAR.on ? K.OPPONENTS[CAR.opp].name : 'CPU';
const pname = i => NET.on ? (i === NET.seat ? 'You' : NET.peerName) : M.mode === 'practice' ? 'You' : M.opp === 'bot' ? (i === 0 ? 'You' : botName()) : `Player ${i + 1}`;
const isYou = i => NET.on ? i === NET.seat : (M.mode === 'practice' || (M.opp === 'bot' && i === 0));
const ballById = id => world.balls.find(b => b.id === id);

function syncBallMeshes() {
  for (let id = 0; id <= 15; id++) { BM[id].visible = false; SH[id].visible = false; BM[id].scale.setScalar(R / R_US); }
  for (const b of world.balls) if (!b.potted) { BM[b.id].visible = true; SH[b.id].visible = true; }
}
function nearestTarget() {
  const cue = world.balls[0];
  const t = C.legalTargets(game, world.balls, game.turn).map(ballById).filter(Boolean);
  t.sort((a, b) => Math.hypot(a.x - cue.x, a.z - cue.z) - Math.hypot(b.x - cue.x, b.z - cue.z));
  return t[0] || null;
}
function aimAtNearest() { const cue = world.balls[0], t = nearestTarget(); return t ? Math.atan2(t.z - cue.z, t.x - cue.x) : aim.phi; }

function trickRack() {
  const list = trickList(); M.trick = (((M.trick | 0) % list.length) + list.length) % list.length;
  return list[M.trick].balls.map(([id, x, z]) => C.newBall(id, x, z));
}
// resume (career): { wins, breaker, snap } carries on a match: the score, who breaks, and a frame in progress
function startGame(rematch, rerack = false, resume = null) {
  const mode = M.mode;
  if (!CAR.on) M.last = { mode, opp: M.opp, diff: M.diff, rack: M.rack, race: M.race, guide: M.guide, blackOne: !!M.blackOne };
  saveM(); NAV.lastOnline = false; armBack();
  applyTable(tableKeyFor());
  const rack = mode === '9ball' ? C.rack9 : mode === 'practice' ? ({ '9ball': C.rack9, scatter: C.rackScatter, trick: trickRack }[M.rack] || C.rack8) : C.rack8;
  world = C.makeWorld(rack()); world.ev = [];
  game = C.newGame(mode); if (mode === 'uk8') game.oneVisitOnBlack = !!M.blackOne;
  if (rerack) { /* same breaker, score unchanged */ }
  else if (!rematch) { matchWins = [0, 0]; breaker = 0; }
  else { breaker = 1 - breaker; if (matchDone()) matchWins = [0, 0]; }
  if (resume) { matchWins = [...resume.wins]; breaker = resume.breaker; }
  game.turn = mode === 'practice' ? 0 : breaker;
  if (mode === 'practice') { game.ballInHand = M.rack !== 'trick'; game.kitchen = false; game.breakShot = false; }
  lastShot = null; endReplayNow(); TRK.fresh = mode === 'practice' && M.rack === 'trick'; TRK.demo = false; EDIT = false;
  shots = [0, 0]; undoStack = []; potAnims = []; acc = 0; stroke = null; bot = null; botAim = null; lastRes = null;
  if (resume && resume.snap) applySnapshot(resume.snap);
  syncBallMeshes();
  aim.sx = aim.sy = 0; aim.power = mode === 'practice' && (M.rack === 'scatter' || M.rack === 'trick') ? 0.45 : 0.88;
  updateTrickUI();
  $('#menu').hidden = true; $('#over').hidden = true; $('#hud').hidden = false;
  $('#practice').hidden = mode !== 'practice';
  if (cam.mode === 'attract') { cam.mode = 'free'; cam.free.dist = 3.1 * Math.pow(P.L / 2.54, 0.9); }
  toastClear();
  if (resume && resume.snap) toast(`Back at the table with ${botName()}`, 'info');
  else if (mode !== 'practice') toast(game.turn === 0 && M.opp === 'bot' ? 'Your break' : `${pname(game.turn)} to break`, 'info');
  beginTurn(true);
  if (CAR.on) careerSave();
}

function beginTurn() {
  EARN = null;
  world.rec = C.newRec();
  aim.sx = 0; aim.sy = 0;
  if (!game.breakShot) aim.power = Math.min(aim.power, 0.5);
  aim.phi = aimAtNearest();
  if (isBot(game.turn)) startBot();
  else if (NET.on && game.turn !== NET.seat) {
    state = 'remote'; NET.aimT = null;
    $('#thinking').textContent = `${NET.peerName} is lining up a shot`; $('#thinking').hidden = false;
  }
  else state = 'aim';
  aimDirty = true;
  updateHUD();
  if (NET.on) netProcessQueue();
}

function executeShot() {
  const cue = world.balls[0];
  shotBefore = C.cloneBalls(world.balls);
  if (M.mode === 'practice') { undoStack.push({ balls: C.cloneBalls(world.balls), game: { ...game, groups: [...game.groups] } }); if (undoStack.length > 40) undoStack.shift(); }
  world.rec = C.newRec(); world.ev = [];
  const shot = { phi: aim.phi, power: aim.power, sx: aim.sx, sy: aim.sy };
  if (remoteStrike) { [cue.vx, cue.vz, cue.wx, cue.wy, cue.wz] = remoteStrike; remoteStrike = null; }
  else C.strike(cue, shot);
  if (NET.on) NET.n++;
  lastShot = { balls: C.cloneBalls(shotBefore), v: [cue.vx, cue.vz, cue.wx, cue.wy, cue.wz] };
  sfx('cue', Math.hypot(cue.vx, cue.vz));
  shots[game.turn]++;
  game.ballInHand = false;
  cam.anchor = [cue.x, cue.z];
  state = 'moving'; acc = 0; movingT = 0;
  hideGuides(); updateHUD();
}

function endShot() {
  const pl = game.turn;
  const res = C.judge(game, world.rec, shotBefore, world.balls, pl);
  lastRes = res;
  for (const id of res.respot) { const b = ballById(id); b.potted = false; C.spotBall(world.balls, b); }
  const cue = world.balls[0];
  if (cue.potted) { cue.potted = false; C.placeCueHead(world.balls, cue); }
  syncBallMeshes();
  const wasBreak = game.breakShot, hadVisits = game.visits || 1;
  game = C.nextGame(game, res, pl, world.balls);
  if (game.over) cheer(game.winner === pl ? 'pump' : 'shrug', pl);
  else if (res.foul) cheer('shrug', pl);
  else if (res.keepTurn && world.rec.pots.some(id => id !== 0)) cheer('thumb', pl);
  if (res.foul) { toast(`Foul: ${res.reason}`, 'foul'); sfx('foul'); if (NET.on ? pl === NET.seat : !isBot(pl)) buzz([70, 60, 70]); }
  if (res.assign) toast(`${pname(res.assign.player)} ${isYou(res.assign.player) ? 'are' : 'is'} ${C.groupName(M.mode, res.assign.group)}`, 'good');
  res.msgs.forEach(m => toast(m, 'info'));
  if (game.over) {
    matchWins[game.winner]++; state = 'over'; updateHUD();
    frameEarn(); if (CAR.on) careerFrameOver();
    setTimeout(() => showOver(res, pl), 700);
    if (NET.on) netAfterShot(pl);
    return;
  }
  if (M.mode === 'practice') {
    if (M.rack === 'trick') trickResult(res);
    else if (!world.balls.some(b => b.id !== 0 && !b.potted)) toast(`Table cleared in ${shots[0]} shots. Press R to rerack.`, 'good');
  } else if (M.mode === 'uk8' && res.foul) {
    const who = game.turn;
    toast(`${pname(who)} ${isYou(who) ? 'get' : 'gets'} ${game.visits > 1 ? 'two visits and a free ball' : 'a free ball, one visit (on the black)'}${game.ballInHand ? ', from behind the baulk line' : ''}`, 'foul');
  } else if (M.mode === 'uk8' && res.keepTurn && hadVisits > 1 && game.visits === 1) {
    toast(`On the black: ${isYou(pl) ? 'your' : pname(pl) + "'s"} second visit is lost`, 'info');
  } else if (M.mode === 'uk8' && !res.keepTurn && game.turn === pl) {
    toast(isYou(pl) ? 'Your second visit' : `${pname(pl)}'s second visit`, 'info');
  } else if (game.turn !== pl) {
    toast(game.ballInHand ? `${pname(game.turn)}: ball in hand` : (isYou(game.turn) ? 'Your shot' : `${pname(game.turn)} to shoot`), game.ballInHand ? 'foul' : 'info');
  } else if (wasBreak && res.keepTurn) toast(`Good break, ${pname(pl) === 'You' ? 'keep going' : pname(pl) + ' continues'}`, 'good');
  beginTurn(); if (state === 'aim') followShot();
  if (NET.on) netAfterShot(pl);
  if (CAR.on) careerSave();
}

function trickResult(res) {
  if (!TRK.fresh) return;
  TRK.fresh = false;
  const t = trickList()[M.trick], ids = t.pot || world.balls.filter(b => b.id).map(b => b.id);
  const made = !res.foul && ids.every(id => { const b = ballById(id); return b && b.potted; });
  if (made) { toast(TRK.demo ? "That's how it's done. Press R to try it yourself" : 'Trick shot made!', 'good'); sfx('win'); }
  else toast(TRK.demo ? 'The demo missed this time. Press R to reset' : 'Not quite. Press R to set it up again', 'info');
  TRK.demo = false;
}
function matchText() {
  return NET.on ? `you ${matchWins[NET.seat]}, ${NET.peerName} ${matchWins[1 - NET.seat]}` : `${pname(0)} ${matchWins[0]}, ${pname(1)} ${matchWins[1]}`;
}
// What a finished frame earns (looks.js): against the computer, money and a frame towards a case of the level's grade;
// in the career, a frame towards the tier's case; online, the day's first win. Practice and same-device games earn
// nothing. In a season (looks.js, SERIES), the first frame that earns each day also brings its daily case (EARN.season).
// EARN keeps it all for the result screen.
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
function frameEarn() {
  const w = game.winner, online = NET.on && w === NET.seat, cpu = !NET.on && M.opp === 'bot' && M.mode !== 'practice' && w === 0; EARN = null;
  if (online) EARN = lockerEdit(l => LK.onlineWon(l, localDay()));
  else if (cpu) EARN = lockerEdit(l => CAR.on ? LK.careerFrameWon(l, K.EVENTS[CAR.view].tier) : LK.cpuFrameWon(l, M.diff));
  if (EARN && EARN.grade) toast(`${LK.GRADES[EARN.grade].name} earned: open it in the Locker`, 'good');
  const sw = online || cpu ? lockerEdit(l => LK.seasonWon(l, localDay())) : null;
  if (sw) { EARN = { ...(EARN || {}), season: sw }; toast(`Halloween: a ${LK.GRADES[sw.grade].name} for your first win today!`, 'good'); }
}
function earnText(e) {
  if (!e) return '';
  const hw = e.season ? `Halloween: a ${LK.GRADES[e.season.grade].name} for your first win today!` : '';
  if (!('pay' in e)) return hw;
  const pay = e.pay ? `You earn ${money(e.pay)}` : '', got = e.grade ? `${pay ? ' and' : 'You earn'} a ${LK.GRADES[e.grade].name.toLowerCase()}!` : '';
  const base = NET.on ? `Your first online win today: ${money(e.pay)} and ${e.n > 1 ? `${e.n} ${LK.GRADES[e.grade].name.toLowerCase()}s` : `a ${LK.GRADES[e.grade].name.toLowerCase()}`}!`
    : got ? pay + got : `${pay}${pay ? '. ' : ''}${LK.GRADES[e.meter.grade].name}: ${e.meter.n} of ${LK.METER} frames.`;
  return [base, hw].filter(Boolean).join(' ');
}
function showOver(res, shooter) {
  const w = game.winner;
  const rt = raceTo(), done = matchDone(), what = rt ? (done ? ' the match' : ' the frame') : '';
  const wn = NET.on ? (w === NET.seat ? null : NET.peerName) : M.opp === 'bot' ? (w === 0 ? null : botName()) : `Player ${w + 1}`;
  $('#overTitle').textContent = wn === null ? `You win${what}` : `${wn} wins${what}`;
  const who = shooter >= 0 ? pname(shooter) : '', why = ((res && res.reason2) || '').replace(/^./, c => c.toLowerCase());
  $('#overWhy').textContent = why ? `${who} ${why}.` : '';
  const sh = NET.on ? `you ${shots[NET.seat]}, ${NET.peerName} ${shots[1 - NET.seat]}` : `${pname(0)} ${shots[0]}, ${pname(1)} ${shots[1]}`;
  $('#overStats').textContent = `Shots taken: ${sh}. ${rt ? `Match, first to ${rt}: ${matchText()}.` : `Racks won: ${matchText()}.`}`;
  $('#bOverReplay').hidden = !lastShot;
  $('#over').hidden = false;
  if (NET.on) { NET.again = [false, false]; updateAgainBtn(); }
  else $('#bAgain').textContent = done ? (CAR.on ? 'Continue' : 'New match') : rt ? 'Next frame' : 'Play again';
  $('#bOverMenu').textContent = CAR.on ? 'Save and quit' : 'Main menu'; $('#bOverMenu').hidden = CAR.on && done;
  if (CAR.on && done) $('#overStats').textContent += ' ' + careerResultText();
  $('#overEarn').textContent = earnText(EARN);
  if (NET.on ? w === NET.seat : (M.opp !== 'bot' || w === 0)) sfx('win'); else sfx('foul');
  $('#bAgain').focus();
}

function undo() {
  if (M.mode !== 'practice' || state !== 'aim' || !undoStack.length) return;
  const u = undoStack.pop(); world = C.makeWorld(u.balls); world.ev = []; game = u.game; potAnims = [];
  syncBallMeshes(); beginTurn(); toast('Shot undone', 'info');
}

// ------------------------------------------------------------------ bot driver
function startBot() {
  state = 'botThink'; $('#thinking').textContent = `${botName()} is lining up a shot`;
  const diff = CAR.on ? K.profileFor(CAR.opp, { onFinal: K.onFinalBall(game, world.balls, game.turn) }) : M.diff;
  bot = { gen: C.planBot(game, world.balls, game.turn, diff), t0: performance.now(), shot: null };
  $('#thinking').hidden = false;
}
function botThinkTick(now) {
  if (!bot.shot) {
    const t0 = performance.now();
    while (performance.now() - t0 < 9) { const r = bot.gen.next(); if (r.done) { bot.shot = r.value; break; } }
  }
  if (bot.shot && now - bot.t0 > 700) {
    $('#thinking').hidden = true;
    const s = bot.shot, cue = world.balls[0];
    botAim = { t: 0, s, phi0: aim.phi, dphi: wrapA(s.phi - aim.phi), pw0: aim.power, cue0: [cue.x, cue.z],
      move: s.cue && game.ballInHand ? 0.55 : 0 };
    botAim.turn = 0.5 + Math.min(1.1, Math.abs(botAim.dphi) * 0.35);
    state = 'botAim';
  }
}
function botAimTick(dt) {
  const b = botAim; b.t += dt; const cue = world.balls[0];
  if (b.move) {
    const k = ease(clamp(b.t / b.move, 0, 1));
    cue.x = lerp(b.cue0[0], b.s.cue[0], k); cue.z = lerp(b.cue0[1], b.s.cue[1], k);
    if (b.t < b.move) return;
  }
  const t2 = b.t - b.move, k = ease(clamp(t2 / b.turn, 0, 1));
  aim.phi = b.phi0 + b.dphi * k;
  aim.power = lerp(b.pw0, b.s.power, k); aim.sx = b.s.sx * k; aim.sy = b.s.sy * k;
  if (t2 > b.turn + 0.35) { aim.phi = b.s.phi; aim.power = b.s.power; aim.sx = b.s.sx; aim.sy = b.s.sy; beginStroke(); }
  updateShotPanel();
}

// ------------------------------------------------------------------ stroke animation
function idleGap() { return 0.012 + aim.power * 0.1; }
function beginStroke() {
  if (state !== 'aim' && state !== 'botAim' && state !== 'remote') return;
  const cue = world.balls[0];
  if (state !== 'remote' && game.ballInHand && !C.validSpot(world.balls, cue.x, cue.z, 0, game.kitchen)) {
    if (isBot(game.turn)) C.placeCueHead(world.balls, cue);
    else { toast('Place the cue ball somewhere clear first', 'foul'); return; }
  }
  if (NET.on && state === 'aim') {
    if (!NET.peer || NET.link !== 'online') { toast(`Waiting for ${NET.peerName} to reconnect`, 'foul'); return; }
    const shot = { phi: aim.phi, power: aim.power, sx: aim.sx, sy: aim.sy }, t = { ...cue };
    C.strike(t, shot);
    netSend({ t: 'shot', n: NET.n + 1, s: shot, v: [t.vx, t.vz, t.wx, t.wy, t.wz], cue: game.ballInHand ? [cue.x, cue.z] : null });
  }
  $('#thinking').hidden = true;
  stroke = { t: 0, from: idleGap(), back: idleGap() + 0.07 + 0.13 * aim.power, fwd: lerp(0.24, 0.075, aim.power) };
  state = 'stroke'; hideGuides();
}
// Shoot pressed: with the shot camera, your aim is held (state 'set') while the view glides in behind the cue, and the
// stroke starts once it's there (SET_T seconds), so nothing feels rushed. Without it, the stroke starts at once. Once
// the cue has struck, the view rises to a high one of the whole table (cam.high) while the balls run.
const SET_T = 0.9, RISE_WAIT = 0.3, RISE_T = 1.2, HIGH_PITCH = 60 * DEG;   // after the strike: 0.3 s, then 1.2 s up to the high view
let setT = 0;
function shoot() {
  if (state !== 'aim' || !humanTurn()) return;
  const cue = world.balls[0];
  if (!S.shotCam || reduceMotion || (game.ballInHand && !C.validSpot(world.balls, cue.x, cue.z, 0, game.kitchen)) || (NET.on && (!NET.peer || NET.link !== 'online'))) return beginStroke();
  cam.shot = { x: cue.x, z: cue.z, phi: aim.phi, prev: cam.mode, t: 0, dur: SET_T, from: { ...cam.cur } }; cam.mode = 'shot';
  state = 'set'; setT = 0; hideGuides(); updateShotPanel();
}
function setTick(dt) { if ((setT += dt) >= SET_T) { state = 'aim'; beginStroke(); } }   // if the shot can't go now after all, the view goes back
function strokeGap(dt) {
  const s = stroke; s.t += dt;
  const BACK = 0.32;
  if (s.t < BACK) return lerp(s.from, s.back, ease(s.t / BACK));
  const k = (s.t - BACK) / s.fwd;
  if (k >= 1) { executeShot(); return 0; }
  return lerp(s.back, 0, k * k);
}

// ------------------------------------------------------------------ physics tick
const _q = new THREE.Quaternion(), _v = new THREE.Vector3();
function physicsTick(dt) {
  movingT += dt;
  if (movingT > 45) for (const b of world.balls) { b.vx = b.vz = b.wx = b.wy = b.wz = 0; }
  acc += dt * (replay ? replay.speed : 1); let n = 0;
  while (acc >= P.dt && n < 60) {
    C.step(world, P.dt);
    for (const b of world.balls) if (!b.potted) { const r = ROT[b.id]; r.x += b.wx * P.dt; r.y += b.wy * P.dt; r.z += b.wz * P.dt; }
    acc -= P.dt; n++;
  }
  if (n >= 60) acc = 0;
  for (const e of world.ev) {
    if (e.t === 'bb') sfx('bb', e.v);
    else if (e.t === 'cush') sfx('cush', e.v);
    else if (e.t === 'pot') {
      const b = ballById(e.id); potAnims.push({ id: e.id, t: 0, x0: b.x, z0: b.z, p: T.pockets[e.p] }); sfx('pot'); SH[e.id].visible = false;
      sparkAt(T.pockets[e.p].vx, T.pockets[e.p].vz, e.id ? ballColor(e.id) : '#f6f1e2');
      if (e.id !== 0 && humanTurn()) buzz(30);   // your own pot (game.turn is the shooter while balls move)
    }
  }
  world.ev.length = 0;
  if (C.allStopped(world) && !potAnims.length) { acc = 0; if (replay) endReplay(); else endShot(); }
}
// instant replay: the physics is deterministic, so re-running the last shot reproduces it exactly
const canReplay = () => !!lastShot && !replay && !paused && ['aim', 'remote', 'botThink', 'over'].includes(state);
function startReplay() {
  if (!canReplay()) return;
  replay = { prev: state, saved: world, speed: 1, over: !$('#over').hidden, thinking: !$('#thinking').hidden };
  $('#over').hidden = true; $('#thinking').hidden = true; $('#bihTip').hidden = true;
  world = C.makeWorld(C.cloneBalls(lastShot.balls)); world.ev = [];
  const cue = world.balls[0]; [cue.vx, cue.vz, cue.wx, cue.wy, cue.wz] = lastShot.v;
  potAnims = []; syncBallMeshes(); hideGuides();
  state = 'moving'; acc = 0; movingT = 0;
  setLab($('#bSlow'), 'Slow motion', 'slow'); $('#replayBar').hidden = false; sfx('cue', Math.hypot(cue.vx, cue.vz));
  updateHUD();
}
function endReplay() {
  if (!replay) return;
  const r = replay; replay = null;
  world = r.saved; state = r.prev; potAnims = []; syncBallMeshes();
  $('#replayBar').hidden = true;
  if (r.over) $('#over').hidden = false;
  if (r.thinking) $('#thinking').hidden = false;
  aimDirty = true; updateHUD();
  if (NET.on) { netCheckSync(); netProcessQueue(); }
}
function endReplayNow() { if (replay) { replay = null; $('#replayBar').hidden = true; } }

function potAnimTick(dt) {
  for (let i = potAnims.length - 1; i >= 0; i--) {
    const a = potAnims[i]; a.t += dt; const k = clamp(a.t / 0.32, 0, 1), m = BM[a.id];
    m.position.set(lerp(a.x0, a.p.x, ease(k)), R - k * k * 0.11, lerp(a.z0, a.p.z, ease(k)));
    if (k >= 1) { m.visible = false; potAnims.splice(i, 1); updateHUD(); }
  }
}
function updateBalls() {
  for (const b of world.balls) {
    const m = BM[b.id], r = ROT[b.id];
    const ang = r.length();
    if (ang > 1e-7) { _v.copy(r).divideScalar(ang); _q.setFromAxisAngle(_v, ang); m.quaternion.premultiply(_q); r.set(0, 0, 0); }
    if (!b.potted) { m.position.set(b.x, R, b.z); SH[b.id].position.set(b.x, 0.0015, b.z); }
  }
}

// ------------------------------------------------------------------ cue + guides
// whose cue is at the table: online, each player's own (the other's arrives in their hello); a career opponent's
// own design; the computer otherwise plays with the house cue
function cueFor(pl) {
  if (PREV.on) return PREV.looks.cue;
  if (NET.on) return pl === NET.seat ? S.cue : NET.peerCue;
  if (M.opp === 'bot' && M.mode !== 'practice' && pl === 1) return CAR.on ? K.OPPONENTS[CAR.opp].cue || 'house' : 'house';
  return S.cue;
}
function updateCue(dt) {
  const cue = world.balls[0];
  const show = (PREV.on || state === 'aim' || state === 'set' || state === 'botAim' || state === 'botThink' || state === 'stroke' || state === 'remote') && !cue.potted && !paused;
  cueMesh.visible = show; updateGloves(show, performance.now()); if (!show) return;
  const want = cueFor(game.turn); if (want !== cueNow) applyCue(want);
  cueFx(performance.now());
  const gap = state === 'stroke' ? strokeGap(dt) : idleGap();
  if (state === 'moving') return;
  const phi = aim.phi, dx = Math.cos(phi), dz = Math.sin(phi), sx = -dz, sz = dx;
  const a = aim.sx * P.maxSpin * R, b = aim.sy * P.maxSpin * R, c = Math.sqrt(Math.max(0, R * R - a * a - b * b));
  const e = 5 * DEG, ce = Math.cos(e), se = Math.sin(e);
  const px = cue.x - dx * c + sx * a, py = R + b, pz = cue.z - dz * c + sz * a;
  cueMesh.position.set(px - ce * dx * gap, py + se * gap, pz - ce * dz * gap);
  qA.setFromAxisAngle(vY, -phi); qB.setFromAxisAngle(vZ, -e);
  cueMesh.quaternion.copy(qA).multiply(qB);
}
function hideGuides() { for (const g of allGuides) g.visible = false; }
// The balls the shooter is on: their group, or the black once it's cleared; the lowest ball in 9-ball.
// Nothing on the break, on an open table or in practice. A free ball or ball in hand doesn't change it:
// the player still has to pot their own colour.
function markedBalls() {
  if (game.mode === 'practice' || game.breakShot || game.over) return [];
  const on = world.balls.filter(b => !b.potted && b.id !== 0);
  if (game.mode === '9ball') return on.length ? [Math.min(...on.map(b => b.id))] : [];
  const g = game.groups[game.turn];
  if (!g) return [];
  const mine = on.filter(b => C.groupOf(b.id) === g).map(b => b.id);
  return mine.length ? mine : on.some(b => b.id === 8) ? [8] : [];
}
function updateMarkers(now) {
  const ids = S.markers && state === 'aim' && humanTurn() && !paused ? markedBalls() : [];
  const pulse = reduceMotion ? 0.75 : 0.5 + 0.5 * Math.sin(now / 1000 * 2 * Math.PI / 1.3);   // one pulse every 1.3 s
  markMat.opacity = 0.55 + 0.45 * pulse;
  for (let id = 0; id <= 15; id++) {
    const k = MK[id], b = ids.includes(id) ? ballById(id) : null;
    k.visible = !!b; if (!b) continue;
    k.position.set(b.x, R, b.z); k.scale.setScalar(R * 4 * (1 + 0.08 * pulse));   // the halo's bright band starts just outside the ball
  }
}
function previewPaths(shot) {
  const w = C.makeWorld(C.cloneBalls(world.balls));
  C.strike(w.balls[0], shot);
  const c = w.balls[0], cuePts = [[c.x, c.z]], cue2 = [], objPts = [];
  let obj = null, ghost = null, lenAfter = 0, objLen = 0, n = 0;
  C.simulate(w, 6, ww => {
    n++;
    if (ww.rec.first >= 0 && !obj) { obj = ww.balls.find(b => b.id === ww.rec.first); ghost = [c.x, c.z]; cuePts.push([c.x, c.z]); cue2.push([c.x, c.z]); objPts.push([obj.x, obj.z]); }
    if (n % 6 === 0) {
      if (!c.potted) {
        const arr = obj ? cue2 : cuePts, last = arr[arr.length - 1];
        const d = Math.hypot(c.x - last[0], c.z - last[1]);
        if (d > 0.004) { arr.push([c.x, c.z]); if (obj) lenAfter += d; }
      }
      if (obj && !obj.potted) { const last = objPts[objPts.length - 1], d = Math.hypot(obj.x - last[0], obj.z - last[1]); if (d > 0.004) { objPts.push([obj.x, obj.z]); objLen += d; } }
    }
    return (obj && (lenAfter > 1.1 || c.potted) && (objLen > 1.5 || obj.potted)) || cuePts.length > 700 || cue2.length > 700;
  });
  if (c.potted && T.pockets[c.pocket]) (obj ? cue2 : cuePts).push([T.pockets[c.pocket].x, T.pockets[c.pocket].z]);
  if (obj && obj.potted) objPts.push([T.pockets[obj.pocket].x, T.pockets[obj.pocket].z]);
  return { cuePts, cue2, objPts, ghost };
}
function updateGuides(now) {
  const cue = world.balls[0];
  const human = state === 'aim' && humanTurn() && !paused;
  G_HAND.visible = G_KITCHEN.visible = false;
  if (human && game.ballInHand) {
    const ok = C.validSpot(world.balls, cue.x, cue.z, 0, game.kitchen);
    G_HAND.material.color.set(ok ? '#7dffb0' : '#ff6f8f'); setLine(G_HAND, circlePts(cue.x, cue.z, R * 1.6), 0.005);
    if (game.kitchen) setLine(G_KITCHEN, [[T.headX, -T.hw], [T.headX, T.hw]], 0.003);
  }
  if (!human) { G_CUE.visible = G_CUE2.visible = G_OBJ.visible = G_GHOST.visible = false; return; }
  const lvl = guideLevel();
  if (lvl === 'full') {
    if (!aimDirty || now - lastPreview < 50) return;
    lastPreview = now; aimDirty = false;
    const p = previewPaths({ phi: aim.phi, power: aim.power, sx: aim.sx, sy: aim.sy });
    setLine(G_CUE, p.cuePts); setLine(G_CUE2, p.cue2); setLine(G_OBJ, p.objPts);
    if (p.ghost) setLine(G_GHOST, circlePts(p.ghost[0], p.ghost[1], R)); else G_GHOST.visible = false;
    return;
  }
  if (!aimDirty) return; aimDirty = false;
  G_CUE2.visible = false; G_OBJ.visible = false; G_GHOST.visible = false;
  const dir = lvl === 'line' ? C.launchAngle({ phi: aim.phi, sx: aim.sx }) : aim.phi;
  const dx = Math.cos(dir), dz = Math.sin(dir);
  const hit = C.rayCast(world.balls, cue.x, cue.z, dx, dz, 0);
  if (lvl === 'min') { const t = Math.min(hit.t, 0.34); setLine(G_CUE, [[cue.x + dx * R * 1.3, cue.z + dz * R * 1.3], [cue.x + dx * t, cue.z + dz * t]]); return; }
  const t = Math.min(hit.t, 3.2), gx = cue.x + dx * t, gz = cue.z + dz * t;
  setLine(G_CUE, [[cue.x, cue.z], [gx, gz]]);
  if (hit.kind === 'ball') {
    setLine(G_GHOST, circlePts(gx, gz, R));
    if (lvl === 'line') { const o = ballById(hit.id), nx = (o.x - gx) / (2 * R), nz = (o.z - gz) / (2 * R); setLine(G_OBJ, [[o.x, o.z], [o.x + nx * 0.26, o.z + nz * 0.26]]); }
  }
}

// ------------------------------------------------------------------ camera
const cam = {
  mode: 'attract', prev: 'free', anchor: null,
  free: { yaw: -2.25, pitch: 0.62, dist: 3.6, tx: 0, tz: 0 },
  aimPitch: 0.2, aimDist: 0.95, topZoom: 1,
  cur: { yaw: -2.25, pitch: 0.55, dist: 3.4, tx: 0, ty: 0, tz: 0 },
  goal() {
    const cue = world.balls[0];
    if (this.mode === 'aim') {
      const a = state === 'moving' && this.anchor ? this.anchor : [cue.x, cue.z];
      return { yaw: aim.phi + Math.PI, pitch: this.aimPitch, dist: this.aimDist, tx: a[0], ty: R, tz: a[1] };
    }
    if (this.mode === 'shot') {   // your own shot, from your eyes: standing over the cue, looking down the line from where it was played
      const s = this.shot, dx = Math.cos(s.phi), dz = Math.sin(s.phi);
      if (s.up) return s.prev === 'top' ? this.top() : this.high(s.side);   // then up, to see the whole table while the balls run
      return { yaw: s.phi + Math.PI, pitch: 0.4, dist: 0.95, tx: s.x + dx * 0.25, ty: R, tz: s.z + dz * 0.25 };
    }
    if (this.mode === 'show') {   // Preview: swinging slowly round the side of your cue, so the whole cue and both hands stay in view
      const dx = Math.cos(aim.phi), dz = Math.sin(aim.phi), t = reduceMotion ? 0 : (performance.now() - PREV.t0) / 1000;
      return { yaw: aim.phi + Math.PI / 2 + 0.3 - 0.75 * Math.sin(t * 0.2), pitch: 0.45, dist: 1.12 * (camera.aspect < 1.6 ? 1.6 / camera.aspect : 1), tx: cue.x - dx * 0.62, ty: R, tz: cue.z - dz * 0.62 };
    }
    if (this.mode === 'top') return this.top();
    const f = this.free, narrow = camera.aspect < 1.25 ? Math.pow(1.25 / camera.aspect, 0.85) : 1;
    return { yaw: f.yaw, pitch: f.pitch, dist: f.dist * narrow, tx: f.tx, ty: 0, tz: f.tz };
  },
  top() {
    const th = Math.tan(22.5 * DEG), d = Math.max((T.hw + 0.26) / th, (T.hl + 0.26) / (th * camera.aspect)) * this.topZoom;
    return { yaw: Math.PI / 2, pitch: 1.553, dist: d, tx: 0, ty: 0, tz: 0 };
  },
  // high above one long side (side: its yaw), 60 degrees down, far enough back that the table and its rails fill 90% of
  // the screen: the near rail sets the height it needs, and the length its width
  high(side) {
    const p = HIGH_PITCH, t = Math.tan(22.5 * DEG) * 0.9, X = T.hl + 0.22, Z = T.hw + 0.22;
    return { yaw: side, pitch: p, dist: Z * Math.cos(p) + Math.max(Z * Math.sin(p), X / camera.aspect) / t, tx: 0, ty: 0, tz: 0 };
  },
  update(dt) {
    if (this.mode === 'attract' && !reduceMotion) this.free.yaw += dt * 0.07;
    const c = this.cur, k = 1 - Math.exp(-dt * 7), s = this.shot;
    if (this.mode === 'shot' && !s.up && state === 'moving' && !paused && (s.hit = (s.hit || 0) + dt) >= RISE_WAIT)   // the cue has struck: a beat, then up
      Object.assign(s, { up: true, side: camera.position.z < 0 ? -Math.PI / 2 : Math.PI / 2, from: { ...c }, t: 0, dur: RISE_T });   // to the long side you're nearer
    const up = this.mode === 'shot' && !!s.up; if (up !== !!this.away) { this.away = up; for (const q of ['#shot', '#tools', '#practice']) $(q).classList.toggle('away', up); }   // the buttons fade while the camera's up, so the whole table shows (they still work)
    const g = this.goal();
    if (this.mode === 'shot' && s.from && s.t < s.dur) {   // the swing in for a shot, and the rise after it: eased all the way there, not a snap
      s.t += dt; const e = ease(Math.min(1, s.t / s.dur)), f = s.from;
      c.yaw = f.yaw + wrapA(g.yaw - f.yaw) * e; c.pitch = lerp(f.pitch, g.pitch, e); c.dist = lerp(f.dist, g.dist, e);
      c.tx = lerp(f.tx, g.tx, e); c.ty = lerp(f.ty, g.ty, e); c.tz = lerp(f.tz, g.tz, e);
    } else {
      c.yaw += wrapA(g.yaw - c.yaw) * k; c.pitch += (g.pitch - c.pitch) * k; c.dist += (g.dist - c.dist) * k;
      c.tx += (g.tx - c.tx) * k; c.ty += (g.ty - c.ty) * k; c.tz += (g.tz - c.tz) * k;
    }
    const cp = Math.cos(c.pitch);
    camera.position.set(c.tx + c.dist * cp * Math.cos(c.yaw), c.ty + c.dist * Math.sin(c.pitch), c.tz + c.dist * cp * Math.sin(c.yaw));
    camera.lookAt(c.tx, c.ty, c.tz);
    fill.position.copy(camera.position); fill.target.position.set(c.tx, c.ty, c.tz);
    const above = camera.position.y > 1.0 && Math.abs(camera.position.x) < 1.2 && Math.abs(camera.position.z) < 0.6;
    for (const m of LAMP) m.visible = !above && camera.position.y < 1.9;
    // in the menu, push the table to the right so the panel doesn't cover it
    const wantOff = this.mode === 'attract' && innerWidth > 760 ? -VW * 0.2 : 0;
    this.off = lerp(this.off || 0, wantOff, k);
    if (Math.abs(this.off) > 0.5) camera.setViewOffset(VW, VH, this.off, 0, VW, VH); else if (camera.view && camera.view.enabled) camera.clearViewOffset();
  },
  toFree() { if (this.mode === 'free') return; const c = this.cur, narrow = camera.aspect < 1.25 ? Math.pow(1.25 / camera.aspect, 0.85) : 1; this.free = { yaw: c.yaw, pitch: c.pitch, dist: c.dist / narrow, tx: c.tx, tz: c.tz }; this.mode = 'free'; updateCamButtons(); },
  orbit(dx, dy) {
    if (this.mode === 'aim' && state === 'aim' && humanTurn()) {
      aim.phi = wrapA(aim.phi + dx * 0.0035); aimDirty = true;
      this.aimPitch = clamp(this.aimPitch + dy * 0.004, 0.03, 1.25); return;
    }
    this.toFree();
    this.free.yaw += dx * 0.006; this.free.pitch = clamp(this.free.pitch + dy * 0.005, 0.06, 1.55);
    this.cur.yaw = lerp(this.cur.yaw, this.free.yaw, 0.6); this.cur.pitch = lerp(this.cur.pitch, this.free.pitch, 0.6);
  },
  pan(dx, dy) {
    this.toFree();
    const s = this.free.dist * 0.0014, y = this.free.yaw;
    const rx = -Math.sin(y), rz = Math.cos(y), fx = -Math.cos(y), fz = -Math.sin(y);
    this.free.tx = clamp(this.free.tx - rx * dx * s + fx * dy * s, -3, 3); this.free.tz = clamp(this.free.tz - rz * dx * s + fz * dy * s, -2.5, 2.5);
  },
  zoom(delta) {
    const f = Math.pow(1.0015, delta);
    if (this.mode === 'aim') this.aimDist = clamp(this.aimDist * f, 0.22, 3.2);
    else if (this.mode === 'top') this.topZoom = clamp(this.topZoom * f, 0.35, 1.6);
    else this.free.dist = clamp(this.free.dist * f, 0.3, 7);
  },
  reset() { this.free = { yaw: -2.25, pitch: 0.6, dist: 3.1, tx: 0, tz: 0 }; this.mode = 'free'; updateCamButtons(); },
  // once the balls stop, the shot camera glides back to the view you had (unless you moved the camera meanwhile); a shot
  // played from the overhead view rises back to it
  shotOver() { this.mode = this.shot ? this.shot.prev : 'free'; this.shot = null; updateCamButtons(); },
};
// After a shot, when it's your turn (a local human's) and you're in the free view, the camera glides to just behind the
// cue ball, looking along the line to the ball the cue points at (the nearest one you're on), far enough back for both to
// show below the scoreboard, at your own tilt (S.follow). Cue view follows anyway; the overhead view shows everything.
// Not for the computer's or an online opponent's turn, nor the break. Display only.
function followShot() {
  const via = cam.mode === 'shot' ? cam.shot.prev : cam.mode, cue = world.balls[0], t = nearestTarget();
  if (!S.follow || via !== 'free' || !t) return;
  const L = Math.hypot(t.x - cue.x, t.z - cue.z), p = clamp(cam.free.pitch, 0.3, 1.2), half = 22.5 * DEG;
  const fits = d => { const D = d * Math.cos(p), H = d * Math.sin(p); return Math.atan2(H, D - L / 2) - p <= half * 0.7 && p - Math.atan2(H, D + L / 2) <= half * 0.55; };
  let d = 0.9; while (d < 7 && !fits(d)) d *= 1.04;
  const narrow = camera.aspect < 1.25 ? Math.pow(1.25 / camera.aspect, 0.85) : 1;
  cam.free = { yaw: Math.atan2(t.z - cue.z, t.x - cue.x) + Math.PI, pitch: p, dist: Math.min(d, 7) / narrow, tx: (cue.x + t.x) / 2, tz: (cue.z + t.z) / 2 };
  if (reduceMotion && cam.mode === 'free') Object.assign(cam.cur, cam.goal());   // there, without the glide
}
function toggleAimCam() { if (cam.mode === 'aim') cam.toFree(); else { cam.mode = 'aim'; } updateCamButtons(); }
function toggleTop() { if (cam.mode === 'top') { cam.mode = cam.prev || 'free'; } else { cam.prev = cam.mode === 'attract' ? 'free' : cam.mode === 'shot' ? cam.shot.prev : cam.mode; cam.mode = 'top'; } updateCamButtons(); }
function updateCamButtons() { $('#bCam').setAttribute('aria-pressed', cam.mode === 'aim'); $('#bTop').setAttribute('aria-pressed', cam.mode === 'top'); }

// ------------------------------------------------------------------ input
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -R), hitV = new THREE.Vector3();
function tablePoint(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return ray.ray.intersectPlane(plane, hitV) ? [hitV.x, hitV.z] : null;
}
function aimAtPoint(p) { const cue = world.balls[0]; if (!p) return; if (Math.hypot(p[0] - cue.x, p[1] - cue.z) < 0.03) return; aim.phi = Math.atan2(p[1] - cue.z, p[0] - cue.x); aimDirty = true; }
function moveBall(b, p) {
  if (!p || !b) return;
  const x = clamp(p[0], -T.hl + R + 0.002, T.hl - R - 0.002), z = clamp(p[1], -T.hw + R + 0.002, T.hw - R - 0.002);
  if (C.validSpot(world.balls, x, z, b.id, false)) { b.x = x; b.z = z; aimDirty = true; TRK.fresh = false; }
}
function placeCue(p) {
  if (!p) return; const cue = world.balls[0];
  let x = clamp(p[0], -T.hl + R + 0.002, T.hl - R - 0.002), z = clamp(p[1], -T.hw + R + 0.002, T.hw - R - 0.002);
  if (game.kitchen) x = Math.min(x, T.headX);
  if (C.validSpot(world.balls, x, z, 0, game.kitchen)) { cue.x = x; cue.z = z; aimDirty = true; }
  else { cue.x = x; cue.z = z; aimDirty = true; } // allowed to hover; shot is blocked until the spot is valid
}
const ptr = { mode: null, x: 0, y: 0, moved: 0 };
const touches = new Map(); let gest = null;
canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  ensureAudio(); canvas.setPointerCapture(e.pointerId);
  if (e.pointerType === 'touch') {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size >= 2) { ptr.mode = 'gesture'; const [a, b] = [...touches.values()]; gest = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; return; }
  }
  ptr.x = e.clientX; ptr.y = e.clientY; ptr.moved = 0;
  const humanAim = state === 'aim' && humanTurn() && !paused;
  if (e.button === 2 || (e.button === 0 && e.altKey)) ptr.mode = e.shiftKey ? 'pan' : 'orbit';
  else if (e.button === 1) { ptr.mode = 'pan'; e.preventDefault(); }
  else if (humanAim) {
    const p = tablePoint(e), cue = world.balls[0];
    const near = EDIT && p ? world.balls.filter(b => !b.potted).map(b => [b, Math.hypot(p[0] - b.x, p[1] - b.z)]).sort((a, b) => a[1] - b[1])[0] : null;
    if (near && near[1] < R * 1.8) { ptr.mode = 'moveBall'; ptr.ball = near[0]; }
    else if (game.ballInHand && p && Math.hypot(p[0] - cue.x, p[1] - cue.z) < R * 2.6) ptr.mode = 'hand';
    else if (cam.mode === 'aim' || e.shiftKey) ptr.mode = 'aimRel';
    else ptr.mode = 'point';
  } else ptr.mode = 'orbit';
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerType === 'touch' && touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptr.mode === 'gesture' && touches.size >= 2) {
    const [a, b] = [...touches.values()], d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
    cam.orbit(cx - gest.cx, cy - gest.cy); cam.zoom((gest.d - d) * 3); gest = { d, cx, cy }; return;
  }
  if (!ptr.mode) return;
  const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y; ptr.x = e.clientX; ptr.y = e.clientY; ptr.moved += Math.abs(dx) + Math.abs(dy);
  if (ptr.mode === 'orbit') cam.orbit(dx, dy);
  else if (ptr.mode === 'pan') cam.pan(dx, dy);
  else if (ptr.mode === 'point') { if (ptr.moved > 3) aimAtPoint(tablePoint(e)); }
  else if (ptr.mode === 'aimRel') { aim.phi = wrapA(aim.phi + dx * (e.shiftKey ? 0.015 : 0.2) * DEG); aimDirty = true; }
  else if (ptr.mode === 'hand') placeCue(tablePoint(e));
  else if (ptr.mode === 'moveBall') moveBall(ptr.ball, tablePoint(e));
});
const endPtr = e => {
  touches.delete(e.pointerId);
  if (ptr.mode === 'gesture' && touches.size < 2) { ptr.mode = null; return; }
  if (ptr.mode === 'point' && ptr.moved <= 3 && e.pointerType === 'touch') aimAtPoint(tablePoint(e));
  ptr.mode = null;
};
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('dblclick', e => { if (state === 'aim' && humanTurn()) aimAtPoint(tablePoint(e)); });
canvas.addEventListener('wheel', e => { e.preventDefault(); cam.zoom(e.deltaY); }, { passive: false });

const keys = new Set(); let holdT = 0;
const AIM_STEP = 0.05 * DEG, AIM_FINE = 0.01 * DEG;   // one press = one step (with Ctrl, a fifth of one); auto-repeat is ignored. Shift + key turns freely while held.
addEventListener('blur', () => keys.clear());
addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
  ensureAudio();
  const k = e.code;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(k)) e.preventDefault();
  if (k === 'Escape') {
    if (!$('#help').hidden) { $('#help').hidden = true; return; }
    if (!$('#reel').hidden) { closeReel(); return; }
    if (!$('#idea').hidden || !$('#ideas').hidden) { closeIdeaBox(); return; }
    if (PREV.on) { endPreview(); return; }
    if (paused) { togglePause(false); return; }
    if (state === 'menu') { menuBack(); return; }
    if (state !== 'over') togglePause(true);
    return;
  }
  if (k === 'KeyV' && !e.repeat && state !== 'menu' && state !== 'lobby') { if (replay) endReplay(); else startReplay(); return; }
  if (state === 'menu' || state === 'lobby' || paused || state === 'over') return;
  const fine = e.ctrlKey && (k === 'ArrowUp' || k === 'ArrowDown');   // Ctrl + ↑/↓: one step a press, not the held change
  if (e.repeat && !['KeyI', 'KeyJ', 'KeyK', 'KeyL'].includes(k)) { if (!fine) keys.add(k); return; }
  if (!fine) keys.add(k); keyAct(k, e.shiftKey, e.ctrlKey);
});
// what a single press of a key does (the Controls panel's keys call it too)
function keyAct(k, shift, ctrl) {
  const humanAim = state === 'aim' && humanTurn();
  const spinStep = shift ? 0.05 : 0.2;
  if (humanAim && (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'KeyA' || k === 'KeyD')) {
    if (!shift && !(ctrl && k.startsWith('Key'))) { aim.phi = wrapA(aim.phi + ((k === 'ArrowRight' || k === 'KeyD') ? 1 : -1) * (ctrl ? AIM_FINE : AIM_STEP)); aimDirty = true; }   // Ctrl + A or D is the browser's
  }
  else if (humanAim && ctrl && (k === 'ArrowUp' || k === 'ArrowDown')) stepSpeed(k === 'ArrowUp' ? 1 : -1);   // Ctrl + W or S is the browser's
  else if ((k === 'Space' || k === 'Enter') && humanAim) shoot();
  else if (k === 'KeyC') toggleAimCam();
  else if (k === 'KeyT') toggleTop();
  else if (k === 'KeyF') cam.reset();
  else if (k === 'KeyH') $('#help').hidden = !$('#help').hidden;
  else if (humanAim && k === 'KeyI') setSpin(aim.sx, aim.sy + spinStep);
  else if (humanAim && k === 'KeyK') setSpin(aim.sx, aim.sy - spinStep);
  else if (humanAim && k === 'KeyJ') setSpin(aim.sx - spinStep, aim.sy);
  else if (humanAim && k === 'KeyL') setSpin(aim.sx + spinStep, aim.sy);
  else if (humanAim && k === 'KeyO') setSpin(0, 0);
  else if (k === 'KeyU') undo();
  else if (k === 'KeyR' && M.mode === 'practice' && state === 'aim') startGame(false);
  else if (k === 'KeyB' && M.mode === 'practice' && state === 'aim') { game.ballInHand = !game.ballInHand; toast(game.ballInHand ? 'Ball in hand: drag the cue ball' : 'Ball in hand off', 'info'); updateHUD(); }
}
addEventListener('keyup', e => keys.delete(e.code));
function handleKeys(dt) {
  if (state === 'menu' || state === 'lobby' || paused) return;
  const has = c => keys.has(c), shift = has('ShiftLeft') || has('ShiftRight');
  if (has('KeyQ')) cam.orbit(-dt * 260, 0);
  if (has('KeyE')) cam.orbit(dt * 260, 0);
  if (state !== 'aim' || !humanTurn()) return;
  const l = has('ArrowLeft') || has('KeyA'), r = has('ArrowRight') || has('KeyD');
  if ((l || r) && !(l && r) && shift) {
    holdT += dt;
    const rate = 10 + Math.min(30, Math.max(0, holdT - 0.45) * 60);   // 10°/s, easing up to 40°/s
    aim.phi = wrapA(aim.phi + (r ? 1 : -1) * rate * DEG * dt); aimDirty = true;
  } else holdT = 0;
  if (touchTurn.dir) {
    touchTurn.t += dt;
    if (touchTurn.t > 0.35) { const rate = Math.min(40, 0.5 * Math.pow(2, (touchTurn.t - 0.35) / 0.4)); aim.phi = wrapA(aim.phi + touchTurn.dir * rate * DEG * dt); aimDirty = true; }   // starts at 0.5°/s, doubling every 0.4 s
  }
  const up = has('ArrowUp') || has('KeyW'), dn = has('ArrowDown') || has('KeyS');
  if (up || dn) { aim.power = clamp(aim.power + (up ? 1 : -1) * (shift ? 0.06 : 0.35) * dt, 0.02, 1); aimDirty = true; updateShotPanel(); }
}

// ------------------------------------------------------------------ HUD: spin + power
const spinC = $('#spin'), spinG = spinC.getContext('2d');
const SPIN_W = 32, SPIN_C = 16, SPIN_RB = 14, SPIN_LIM = 7;   // canvas px; limit ring = half the ball face (miscue limit)
function setSpin(x, y) {
  const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
  aim.sx = Math.abs(x) < 0.02 ? 0 : x; aim.sy = Math.abs(y) < 0.02 ? 0 : y; aimDirty = true; updateShotPanel();
}
function drawSpin() {
  const g = spinG, W = SPIN_W, c = SPIN_C, rb = SPIN_RB, lim = SPIN_LIM;
  g.clearRect(0, 0, W, W);
  g.fillStyle = '#0d0a1c'; g.beginPath(); g.arc(c, c, rb + 1.5, 0, 7); g.fill();
  g.fillStyle = '#f6f1e2'; g.beginPath(); g.arc(c, c, rb, 0, 7); g.fill();
  g.fillStyle = '#d9d0bb'; g.beginPath(); g.arc(c + 2.5, c + 2.5, rb - 2.5, 0, 7); g.fill();
  g.fillStyle = '#f6f1e2'; g.beginPath(); g.arc(c - 1, c - 1, rb - 3.5, 0, 7); g.fill();
  g.fillStyle = '#c9a15a';
  for (let i = 0; i < 20; i += 2) { const a = i / 20 * 6.283; g.fillRect(Math.floor(c + Math.cos(a) * lim), Math.floor(c + Math.sin(a) * lim), 1, 1); }
  g.fillStyle = '#bdb4a0'; g.fillRect(c, c - 3, 1, 7); g.fillRect(c - 3, c, 7, 1);
  const x = Math.floor(c + aim.sx * lim), y = Math.floor(c - aim.sy * lim);
  g.fillStyle = '#0d0a1c'; g.fillRect(x - 2, y - 2, 5, 5);
  g.fillStyle = '#ff4f6f'; g.fillRect(x - 1, y - 1, 3, 3);
}
// the small ball beside the power bar: where the tip will strike, and a button to show or hide the full diagram. Phones
// start with the diagram hidden, computers with it shown; a choice made is kept (S.spinOpen).
const miniG = $('#spinMini').getContext('2d'), phoneUI = matchMedia('(max-width:760px),(max-height:500px)');
function drawMini() {
  const g = miniG; g.clearRect(0, 0, 16, 16);
  g.fillStyle = '#0d0a1c'; g.beginPath(); g.arc(8, 8, 7.5, 0, 7); g.fill();
  g.fillStyle = '#f6f1e2'; g.beginPath(); g.arc(8, 8, 6.5, 0, 7); g.fill();
  const x = Math.round(8 + aim.sx * 3.5), y = Math.round(8 - aim.sy * 3.5);
  g.fillStyle = '#ff4f6f'; g.fillRect(x - 1, y - 1, 2, 2);
}
const spinOpen = () => S.spinOpen === undefined ? !phoneUI.matches : S.spinOpen;
function applySpinOpen() { const o = spinOpen(); $('#shot').classList.toggle('noSpin', !o); $('#bSpin').setAttribute('aria-pressed', String(o)); }
$('#bSpin').addEventListener('click', () => { sfx('ui'); S.spinOpen = !spinOpen(); saveS(); applySpinOpen(); });
phoneUI.addEventListener('change', applySpinOpen);
applySpinOpen();
function spinText() {
  const v = aim.sy, h = aim.sx, pct = x => Math.round(Math.abs(x) * 100) + '%';
  const top = Math.abs(v) >= 0.05 ? `${v > 0 ? 'Follow' : 'Draw'} ${pct(v)}` : 'No top or draw';
  const side = Math.abs(h) >= 0.05 ? `${h > 0 ? 'Right' : 'Left'} ${pct(h)}` : 'No side';
  if (top === 'No top or draw' && side === 'No side') return 'Centre ball\n\u00a0';
  return top + '\n' + side;
}
let lastAimTxt = '';
const JOG = 0.0025 * DEG;   // the aim readout's slide: 0.01° for every 4 screen pixels
function updateAimTxt() {
  let d = (((aim.phi * 180 / Math.PI) % 360 + 360) % 360).toFixed(2); if (d === '360.00') d = '0.00';
  const t = `Aim ${d}°`;
  if (t !== lastAimTxt) { $('#aimTxt').textContent = t; lastAimTxt = t; }
  $('#aimTxt').style.backgroundPositionX = (aim.phi / JOG % 6).toFixed(1) + 'px';
}
// power as the readout shows it, the cue ball's speed off the tip (the spin takes a little of it)
const POW_FINE = 0.01, POW_JOG = 0.0025;   // m/s: a Ctrl + ↑/↓ press, and each screen pixel of a slide along the power readout
const ballSpeed = () => C.strikeImpulse(C.powerToCueSpeed(aim.power), aim.sx, aim.sy);
function setBallSpeed(v) { aim.power = clamp(C.cueSpeedToPower(v / C.strikeImpulse(1, aim.sx, aim.sy)), 0.02, 1); aimDirty = true; updateShotPanel(); }
function stepSpeed(dir) { setBallSpeed(+ballSpeed().toFixed(2) + dir * POW_FINE); }   // from what the readout shows, so it moves exactly 0.01
function updateShotPanel() {
  drawSpin(); drawMini();
  $('#spinTxt').textContent = spinText();
  $('#powFill').style.height = (aim.power * 100).toFixed(1) + '%';
  const v = ballSpeed();
  $('#powTxt').textContent = `${v.toFixed(2)} m/s`;
  $('#powTxt').style.backgroundPositionX = (v / POW_JOG % 6).toFixed(1) + 'px';
  updateAimTxt();
  const off = state !== 'aim' || !humanTurn();
  $('#shot').classList.toggle('dim', off);
  $('#bShoot').disabled = off;
}
function dragOn(el, fn) {
  el.addEventListener('pointerdown', e => { ensureAudio(); if (state !== 'aim' || !humanTurn()) return; el.setPointerCapture(e.pointerId); el._drag = true; fn(e); });
  el.addEventListener('pointermove', e => { if (el._drag) fn(e); });
  const up = () => { el._drag = false; }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}
dragOn(spinC, e => {
  const r = spinC.getBoundingClientRect();
  const px = ((e.clientX - r.left) / r.width) * SPIN_W - SPIN_C, py = ((e.clientY - r.top) / r.height) * SPIN_W - SPIN_C;
  setSpin(px / SPIN_LIM, -py / SPIN_LIM);
});
const powEl = $('#pow');
dragOn(powEl, e => { const r = powEl.getBoundingClientRect(); aim.power = clamp(1 - (e.clientY - r.top) / r.height, 0.02, 1); aimDirty = true; updateShotPanel(); });
powEl.addEventListener('wheel', e => { e.preventDefault(); if (state === 'aim' && humanTurn()) { aim.power = clamp(aim.power - e.deltaY * 0.0004, 0.02, 1); aimDirty = true; updateShotPanel(); } }, { passive: false });
$('#bShoot').addEventListener('click', () => { ensureAudio(); shoot(); });

// ------------------------------------------------------------------ HUD: scoreboard + toasts
function ballIcon(id, dim, ring) {
  const s = document.createElement('span'); s.className = 'bi' + (dim ? ' gone' : '') + (ring ? ' ring' : '');
  const col = id === 0 ? '#f6f1e2' : ballColor(id);
  s.style.background = id >= 9 && !ukStyle() ? `linear-gradient(#f6f1e2 0 28%, ${col} 28% 72%, #f6f1e2 72%)` : col;
  s.title = id === 0 ? 'Cue ball' : ukStyle() ? (id === 8 ? 'Black' : C.isSolid(id) ? 'Red' : 'Yellow') : `${id}-ball`; return s;
}
function updateHUD() {
  const mode = M.mode, pl = game.turn;
  $('#modeName').textContent = { '8ball': '8-ball', '9ball': '9-ball', uk8: 'Reds & yellows', practice: 'Practice' }[mode];
  const extra = [];
  if (mode === 'uk8' && state !== 'over' && !game.breakShot) { if (game.visits > 1) extra.push('Two visits'); if (game.freeShot) extra.push(extra.length ? 'free ball' : 'Free ball'); }
  $('#extra').textContent = extra.join(', ');
  $('#bihTip').textContent = game.kitchen ? `Ball in hand: place the cue ball behind the ${T.key === 'uk7' ? 'baulk line' : 'head string'}` : 'Ball in hand: drag the cue ball to place it';
  let line = '';
  if (state === 'over') line = 'Game over';
  else if (mode === 'practice') line = game.ballInHand ? 'Ball in hand' : `Shots: ${shots[0]}`;
  else {
    const who = isYou(pl) ? 'Your' : `${pname(pl)}'s`;
    line = game.breakShot ? `${who} break` : `${who} shot`;
    if (game.ballInHand && !game.breakShot) line += ', ball in hand';
  }
  $('#turnLine').textContent = line;
  const mt = matchText().replace(/^./, c => c.toUpperCase()), rt = raceTo();
  $('#score').textContent = mode === 'practice' ? '' : rt ? `First to ${rt}: ${mt}` : NET.on ? mt : `Racks won ${matchWins[0]}–${matchWins[1]}`;
  $('#bReplay').hidden = !lastShot || mode === undefined;
  $('#bReplay').disabled = !canReplay();
  $('#bChat').hidden = !(NET.on && NET.started);
  updateNetBadge();
  for (let i = 0; i < 2; i++) {
    const el = $('#p' + i);
    el.hidden = mode === 'practice' && i === 1;
    el.classList.toggle('active', mode !== 'practice' && pl === i && state !== 'over');
    el.querySelector('.pname').textContent = mode === 'practice' ? 'You' : (M.opp === 'bot' && i === 1 && !CAR.on ? `CPU (${M.diff})` : pname(i));
    const grp = el.querySelector('.pgroup'), balls = el.querySelector('.pballs');
    balls.innerHTML = '';
    if (mode === '8ball' || mode === 'uk8') {
      const g = game.groups[i], gn = g && C.groupName(mode, g);
      grp.textContent = g ? gn[0].toUpperCase() + gn.slice(1) : 'Open table';
      if (g) {
        const ids = g === 'solids' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
        let left = 0; ids.forEach(id => { const b = ballById(id); const gone = !b || b.potted; if (!gone) left++; balls.appendChild(ballIcon(id, gone)); });
        balls.appendChild(ballIcon(8, left > 0, left === 0));
      }
    } else if (mode === '9ball') {
      grp.textContent = `Shots: ${shots[i]}`;
    } else {
      grp.textContent = `Potted: ${world.balls.filter(b => b.id && b.potted).length} of ${world.balls.length - 1}`;
    }
  }
  const rack = $('#rack'); rack.innerHTML = '';
  if (mode === '9ball') {
    const on = world.balls.filter(b => b.id && !b.potted).map(b => b.id), low = Math.min(...on);
    for (let id = 1; id <= 9; id++) rack.appendChild(ballIcon(id, !on.includes(id), id === low));
  }
  $('#bHand').setAttribute('aria-pressed', !!game.ballInHand);
  requestAnimationFrame(hudVars);
  $('#bihTip').hidden = !(state === 'aim' && humanTurn() && game.ballInHand);
  updateShotPanel();
}
// messages stack in one column under the scoreboard, so they never sit on top of each other
const notices = $('#notices');
const liveToasts = () => [...notices.querySelectorAll('.toast:not(.out)')];
function toast(msg, kind = 'info') {
  if (liveToasts().some(t => t.textContent === msg)) return;
  const el = document.createElement('div'); el.className = 'toast'; el.dataset.kind = kind; el.textContent = msg;
  notices.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
  while (liveToasts().length > 3) dismissToast(liveToasts()[0]);
  el._t = setTimeout(() => dismissToast(el), 2800 + msg.length * 30);
}
function dismissToast(el) {
  if (!el || el.classList.contains('out')) return;
  clearTimeout(el._t); el.classList.add('out'); el.classList.remove('show');
  setTimeout(() => el.remove(), 230);
}
function toastClear() { notices.querySelectorAll('.toast').forEach(el => el.remove()); }

// ------------------------------------------------------------------ menus + settings
function segControl(el, opts, get, set) {
  el.innerHTML = '';
  for (const [val, label] of opts) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = label;
    b.setAttribute('aria-pressed', String(get() === val));
    b.addEventListener('click', () => { ensureAudio(); set(val); sfx('ui'); refreshMenus(); });
    el.appendChild(b);
  }
}
const DIFF_TXT = { easy: 'Misses often.', medium: 'Steady, some position play.', hard: 'Plays position and safeties.', expert: 'Near-flawless.' };
const GUIDE_TXT = { full: 'Predicted paths for both balls.', line: 'Ghost ball and object-ball line.', ghost: 'Ghost ball only.', min: 'Short cue line only.' };
const MODE_TXT = { '8ball': 'Solids and stripes, 9 ft', '9ball': 'Lowest ball first, 9 ft', uk8: 'Pub rules, 7 ft', practice: 'Free play' };
const GUIDES = [['auto', 'Match skill'], ['full', 'Full paths'], ['line', 'Ghost + line'], ['ghost', 'Ghost only'], ['min', 'Cue line only']];
// ------------------------------------------------------------------ menu screens
// The menu is a stack of screens: home > single player / multiplayer > a game > its setup. Each choice slides to
// the next screen. Back (the button, Esc, or the phone's back gesture) slides back. While away from the home screen
// one browser history entry is kept "armed", so a phone's back gesture goes back a screen (or, in a game, opens
// Pause) instead of leaving the page.
const NAV = { stack: ['home'], armed: false, skipPop: false, wantArm: false, lastOnline: false };
const menuScreen = () => NAV.stack[NAV.stack.length - 1];
function menuTitle(id) {
  const mode = MODE_NAME[M.mode] || '8-ball';
  if (id === 'setup') return M.opp === 'bot' ? `${mode} v computer` : M.opp === 'online' ? `New room: ${mode}` : `${mode}, same device`;
  if (id === 'game') return M.opp === 'online' ? 'New room: choose a game' : 'Choose a game';
  if (id === 'cevent') return (K.EVENTS[CAR.view] || {}).name || 'Event';
  return $('#sc-' + id).dataset.title || '';
}
// Moving between screens, the whole panel glides across the screen: a copy of the old panel slides off one side
// while the real panel, already showing the new screen, arrives from the other. Both travel the same distance with
// the same easing, so they move together like slides on a strip, and the camera turns a little with them.
let slideGhost = null;
function menuSlide(dir, swap) {
  const panel = $('#menuPanel');
  if (slideGhost) { slideGhost.remove(); slideGhost = null; }
  if (panel.getAnimations) for (const an of panel.getAnimations()) an.cancel();
  if (!dir || reduceMotion || $('#menu').hidden || !panel.animate) { swap(); return; }
  const r = panel.getBoundingClientRect(), ghost = panel.cloneNode(true);
  // the copy keeps its ids so it looks identical; it sits after the real panel, so lookups still find the real one
  const from = panel.querySelectorAll('input'), to = ghost.querySelectorAll('input'); from.forEach((el, i) => { to[i].value = el.value; });
  ghost.classList.add('mGhost'); ghost.setAttribute('aria-hidden', 'true'); ghost.inert = true;
  Object.assign(ghost.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  const stageScroll = $('#mStage').scrollTop;
  $('#menu').appendChild(ghost); slideGhost = ghost;
  const gs = ghost.children[1]; if (gs) gs.scrollTop = stageScroll;   // the copy's screen area keeps its scroll position
  swap();
  const D = innerWidth + 40, opts = { duration: 560, easing: 'cubic-bezier(.75,0,.25,1)' };
  ghost.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-dir * D}px)` }], { ...opts, fill: 'forwards' })
    .onfinish = () => { if (slideGhost === ghost) slideGhost = null; ghost.remove(); };
  panel.animate([{ transform: `translateX(${dir * D}px)` }, { transform: 'translateX(0)' }], opts);
}
function showScreen(id, from, dir) {
  menuSlide(dir, () => {
    for (const sc of $('#menuPanel').querySelectorAll('.mScreen')) sc.hidden = sc.id !== 'sc-' + id;   // not the sliding copy's
    $('#mTop').hidden = NAV.stack.length < 2; $('#mTitle').textContent = menuTitle(id); $('#mStage').scrollTop = 0;
    $('#bStart').hidden = id !== 'setup'; $('#bCreate').hidden = id !== 'online';
    refreshMenus();
  });
  if (cam.mode === 'attract') {   // the camera swoops in a little deeper in the menus, and turns with each move
    const deep = NAV.stack.length > 1; cam.free.dist = deep ? 3.0 : 3.6; cam.free.pitch = deep ? 0.5 : 0.62;
    if (dir && !reduceMotion) cam.free.yaw += dir * 0.5;
  }
  if (dir) { const f = $('#sc-' + id).querySelector('.card, #bStart'); if (f) f.focus({ preventScroll: true }); }
}
function menuGo(id) { const from = menuScreen(); NAV.stack.push(id); showScreen(id, from, 1); armBack(); }
function menuBack(fromHistory) {
  if (NAV.stack.length < 2) return false;
  const from = NAV.stack.pop(); showScreen(menuScreen(), from, -1);
  if (!fromHistory && NAV.stack.length < 2) disarm();
  return true;
}
function menuReset(stack) {
  NAV.stack = stack.slice(); showScreen(menuScreen(), null, 0);
  if (NAV.stack.length > 1) armBack(); else disarm();
}
function armBack() {
  if (NAV.armed) return;
  if (NAV.skipPop) { NAV.wantArm = true; return; }   // a disarm is still on its way: arm once it has landed
  try { history.pushState({ rr: 1 }, ''); NAV.armed = true; } catch (e) {}
}
function disarm() { NAV.wantArm = false; if (!NAV.armed) return; NAV.armed = false; NAV.skipPop = true; history.back(); }
addEventListener('popstate', () => {
  if (NAV.skipPop) { NAV.skipPop = false; if (NAV.wantArm) { NAV.wantArm = false; armBack(); } return; }
  NAV.armed = false;
  if (!$('#help').hidden) $('#help').hidden = true;
  else if (!$('#reel').hidden) closeReel();
  else if (!$('#idea').hidden || !$('#ideas').hidden) closeIdeaBox();
  else if (PREV.on) endPreview();
  else if (paused) togglePause(false);
  else if (state === 'menu') menuBack(true);
  else if (state === 'lobby') $('#bLobbyCancel').click();
  else if (state !== 'over') togglePause(true);
  if (state !== 'menu' || NAV.stack.length > 1) armBack();
});
// the table behind the menu follows the choice: the 7 ft table for reds & yellows, a diamond rack for 9-ball
function menuTable() {
  if (state !== 'menu') return;
  const ev = menuScreen() === 'cevent' && K.EVENTS[CAR.view], tk = ev ? (ev.mode === 'uk8' ? 'uk7' : 'us9') : tableKeyFor();
  const nine = ev ? ev.mode === '9ball' : M.mode === '9ball' || (M.mode === 'practice' && M.rack === '9ball'), key = tk + (nine ? '9' : '8');
  if (applyTable(tk) || world.menuKey !== key) { world = C.makeWorld((nine ? C.rack9 : C.rack8)()); world.menuKey = key; syncBallMeshes(); }
}
// "Play again": the last game started from the menu (not online), in one tap
const RACK_NAME = { '8ball': '8-ball rack', '9ball': '9-ball rack', uk: 'reds & yellows', scatter: 'scatter', trick: 'trick shots' };
function quickLabel(l) {
  if (l.mode === 'practice') return `Practice, ${RACK_NAME[l.rack] || RACK_NAME['8ball']}`;
  const mode = MODE_NAME[l.mode] || '8-ball', d = String(l.diff || 'medium');
  return l.opp === 'bot' ? `${mode} v computer (${d[0].toUpperCase() + d.slice(1)})` : `${mode}, same device`;
}
function updateQuick() {
  const l = M.last, b = $('#bQuick');
  b.hidden = !l || !(l.mode === 'practice' || l.opp === 'bot' || l.opp === 'friend');
  if (!b.hidden) b.textContent = 'Play again: ' + quickLabel(l);
}
$('#bQuick').addEventListener('click', () => { ensureAudio(); sfx('ui'); Object.assign(M, M.last); startGame(false); });
// "Rejoin": an online game left by accident (app closed, tab shut, battery died) can be picked up again for a few
// hours. The room and this player's id are kept on the device, so the relay gives back the same seat, and the
// opponent's game (if it's still open) sends the table, just as after a reload. Leaving on purpose forgets it.
// There's one entry per player id, because two tabs on one device can each hold a seat in the same game.
const REJOIN_MS = 3 * 60 * 60 * 1000, REJOIN_KEY = 'retroRack.rejoin';
function rejoinList() {
  try { const l = JSON.parse(localStorage.getItem(REJOIN_KEY) || '[]'); return Array.isArray(l) ? l.filter(r => r && r.code && r.cid && Date.now() - r.at < REJOIN_MS) : []; } catch (e) { return []; }
}
function putRejoin(l) { try { if (l.length) localStorage.setItem(REJOIN_KEY, JSON.stringify(l)); else localStorage.removeItem(REJOIN_KEY); } catch (e) {} }
function saveRejoin() {
  if (!NET.on || !NET.started) return;
  putRejoin([{ code: NET.code, cid: NET.cid, peer: NET.peerName, mode: M.mode, at: Date.now() }, ...rejoinList().filter(r => r.cid !== NET.cid)].slice(0, 4));
}
function clearRejoin() { if (NET.cid) putRejoin(rejoinList().filter(r => r.cid !== NET.cid)); }
// A page in an online room holds a lock named after its player id; the browser frees it when the page closes.
// So another tab never offers to take over a seat that's still being played.
const seatLock = cid => 'retroRack.seat.' + cid;
function holdSeat() {
  const cid = NET.cid;
  if (!navigator.locks || NET.unlock) return;
  navigator.locks.request(seatLock(cid), () => NET.on && NET.cid === cid && !NET.unlock ? new Promise(res => { NET.unlock = res; }) : null).catch(() => {});
}
function freeSeat() { if (NET.unlock) { NET.unlock(); NET.unlock = null; } }
async function rejoinChoice() {
  let l = relayBase() ? rejoinList() : [];
  if (l.length && navigator.locks) {
    try { const q = await navigator.locks.query(), busy = new Set([...q.held, ...q.pending].map(k => k.name)); l = l.filter(r => !busy.has(seatLock(r.cid))); } catch (e) {}
  }
  return state === 'menu' && !NET.on ? l[0] || null : null;
}
async function updateRejoin() {
  const r = await rejoinChoice(), b = $('#bRejoin');
  b.hidden = !r; if (r) b.textContent = `Rejoin ${MODE_NAME[r.mode] || 'game'} with ${cleanName(r.peer)}`;
}
addEventListener('storage', e => { if (e.key === REJOIN_KEY && state === 'menu') updateRejoin(); });
addEventListener('focus', () => { if (state === 'menu') updateRejoin(); });
const waitText = () => NET.rejoin ? `Waiting for ${cleanName(NET.rejoin.peer)} to come back…` : 'Waiting for your friend to join…';
$('#bRejoin').addEventListener('click', async () => {
  ensureAudio();
  const r = await rejoinChoice(); if (!r) { updateRejoin(); return; }
  sfx('ui');
  try { sessionStorage.setItem('rr.cid', r.cid); } catch (e) {}   // the same player id gets the same seat back
  startOnline(cleanCode(r.code), false, r);
});
$('#mBack').addEventListener('click', () => { sfx('ui'); menuBack(); });
$('#bCreate').addEventListener('click', () => { ensureAudio(); sfx('ui'); M.opp = 'online'; menuGo('game'); });

// card pictures: tiny sprites in the style of early arcade "1 PLAYER / 2 PLAYERS" screens, and pixel balls in the
// game's own colours. Drawn once at a few pixels per sprite and shown at 2x with hard pixel edges.
const P1 = '#ffc56b', P2 = '#6cb8ff';   // player one in lamp gold, player two in chalk blue
const BODY = ['.ssssss.', 's.ssss.s', 's.ssss.s', 'f.ssss.f', '..pppp..', '..p..p..', '..p..p..', '.bb..bb.'];
const SPRITES = {
  // a player: hair, face, shirt (s, coloured per player), trousers and shoes; then the other looks for career portraits
  man: ['..hhhh..', '.hffffh.', '..ffff..', '...ff...', ...BODY],
  long: ['..hhhh..', '.hhffhh.', '.hffffh.', '.h.ff.h.', ...BODY],
  bald: ['..ffff..', '.ffffff.', '..ffff..', '...ff...', ...BODY],
  cap: ['..ssss..', '.sssssss', '..ffff..', '...ff...', ...BODY],
  glasses: ['..hhhh..', '.hggggh.', '..ffff..', '...ff...', ...BODY],
  beard: ['..hhhh..', '.hffffh.', '..hhhh..', '...hh...', ...BODY],
  // a computer with a face on its screen
  cpu: ['........', '.mmmmmm.', '.mccccm.', '.mcecem.', '.mccccm.', '.mceecm.', '.mccccm.', '.mmmmmm.', '...mm...', '.mmmmmm.', 'kkkkkkkk', 'k.k.k.kk'],
};
const SPRITE_COL = { h: '#5a3420', f: '#f2c49b', p: '#1a1433', b: '#0d0a1c', m: '#cfd0dc', c: '#1d8a74', e: '#0d0a1c', k: '#8d8aa6', g: '#0d0a1c' };
// pal: colours to use instead of the defaults, e.g. { f: skin, h: hair } for a career portrait
function drawSprite(g, name, x0, y0, shirt, pal) {
  SPRITES[name].forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch === '.') continue; g.fillStyle = ch === 's' ? shirt : (pal && pal[ch]) || SPRITE_COL[ch]; g.fillRect(x0 + x, y0 + y, 1, 1); } });
}
const TROPHY = ['.xxxxxx.', 'xxxxxxxx', 'x.xxxx.x', '.xxxxxx.', '..xxxx..', '...xx...', '...xx...', '..yyyy..', '.yyyyyy.'];
function drawTrophy(g, x0, y0) { TROPHY.forEach((row, y) => { for (let x = 0; x < 8; x++) if (row[x] !== '.') { g.fillStyle = row[x] === 'x' ? P1 : '#5a2d1b'; g.fillRect(x0 + x, y0 + y, 1, 1); } }); }
const DIGITS = { 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111',
  6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111' };
function hexMul(hex, f) { const n = parseInt(hex.slice(1), 16), c = s => Math.round(clamp(((n >> s) & 255) * f, 0, 255)); return `rgb(${c(16)},${c(8)},${c(0)})`; }
function drawBall2D(g, cx, cy, id, uk) {
  const Rb = 6.5, base = id === 0 ? '#f6f1e2' : uk ? (id === 8 ? UK_COL.black : C.isSolid(id) ? UK_COL.red : UK_COL.yellow) : BALL_COL[id > 8 ? id - 8 : id];
  const stripe = !uk && id > 8, numbered = !uk && id > 0;
  for (let y = -8; y <= 7; y++) for (let x = -8; x <= 7; x++) {
    const dx = x + 0.5, dy = y + 0.5, d = Math.hypot(dx, dy);
    let col = null;
    if (d <= Rb) {
      const own = stripe && Math.abs(dy) > 3 ? '#f6f1e2' : base, light = (-dx - dy) / (1.41 * Rb);
      col = light > 0.55 ? hexMul(own, 1.3) : light < -0.45 ? hexMul(own, 0.68) : own;
      if (numbered && Math.hypot(dx + 0.5, dy + 0.5) <= 3.2) col = '#f6f1e2';
    } else if (d <= Rb + 1.05) col = '#0d0a1c';
    if (col) { g.fillStyle = col; g.fillRect(cx + x, cy + y, 1, 1); }
  }
  const dg = numbered && DIGITS[id > 9 ? id % 10 || 1 : id];
  if (dg) { g.fillStyle = '#0d0a1c'; for (let i = 0; i < 15; i++) if (dg[i] === '1') g.fillRect(cx - 2 + (i % 3), cy - 3 + Math.floor(i / 3), 1, 1); }
}
const ART = {
  career: [22, 14, g => { drawSprite(g, 'man', 1, 1, P1); drawTrophy(g, 13, 4); }],
  locker: [20, 14, g => drawParts(g, caseParts('gold'), 1, 0)],
  single: [16, 14, g => drawSprite(g, 'man', 4, 1, P1)],
  multi: [22, 14, g => { drawSprite(g, 'man', 1, 1, P1); drawSprite(g, 'man', 13, 1, P2); }],
  cpu: [22, 14, g => { drawSprite(g, 'man', 1, 1, P1); drawSprite(g, 'cpu', 13, 1); }],
  practice: [22, 14, g => { drawSprite(g, 'man', 1, 1, P1); g.fillStyle = '#e3c68f'; for (let i = 0; i < 6; i++) g.fillRect(9 + i, 7 + (i >> 1), 1, 1); drawBall2D(g, 18, 10, 0); }],
  online: [30, 14, g => { drawSprite(g, 'man', 1, 1, P1); drawSprite(g, 'man', 21, 1, P2); g.fillStyle = P1;
    for (const [x, y] of [[11, 4], [12, 5], [12, 6], [11, 7], [17, 4], [16, 5], [16, 6], [17, 7], [14, 5], [14, 6]]) g.fillRect(x, y, 1, 1); }],
  local: [30, 14, g => { drawSprite(g, 'man', 1, 1, P1); drawSprite(g, 'man', 21, 1, P2); g.fillStyle = '#5a2d1b'; g.fillRect(10, 8, 10, 4); g.fillStyle = '#1d8a74'; g.fillRect(11, 8, 8, 2); g.fillStyle = '#5a2d1b'; g.fillRect(11, 12, 1, 2); g.fillRect(18, 12, 1, 2); }],
};
const BALL_ART = { '8ball': [[8]], '9ball': [[9]], uk8: [[1, 1], [9, 1]], r8: [[1], [8], [9]], r9: [[1], [9], [2]], ruk: [[1, 1], [8, 1], [9, 1]], scatter: [[3], [11], [6]], trick: [[0], [3]] };
function drawArt(name) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  if (ART[name]) { const [w, h, draw] = ART[name]; c.width = w; c.height = h; draw(g); }
  else if (BALL_ART[name]) {
    const balls = BALL_ART[name], gap = name === 'trick' ? 10 : 0;
    c.width = balls.length * 15 + gap + 1; c.height = 16;
    balls.forEach(([id, uk], i) => drawBall2D(g, 8 + i * (15 + gap), 8, id, !!uk));
    if (gap) { g.fillStyle = P1; for (let x = 17; x < 25; x += 3) g.fillRect(x, 8, 2, 1); }
  } else return null;
  // an image rather than the canvas itself, so the sliding copy of the panel (which can't copy canvases) keeps it
  const img = new Image(); img.src = c.toDataURL(); img.className = 'cardArt'; img.alt = ''; img.width = c.width * 2; img.height = c.height * 2;
  return img;
}
for (const c of document.querySelectorAll('#menu .card')) {
  const body = document.createElement('span'); body.className = 'cardBody';
  body.append(...c.querySelectorAll('.cardName, .cardTxt'));
  const art = drawArt(c.dataset.art); if (art) c.append(art);
  c.append(body);
  c.addEventListener('click', () => {
    ensureAudio(); sfx('ui');
    if (c.dataset.go === 'career') { menuGo(CAR.data ? 'career' : 'cnew'); return; }
    if (c.dataset.go === 'locker') lockNote('');
    if (c.dataset.opp) M.opp = c.dataset.opp;
    if (c.dataset.rack) { M.mode = 'practice'; M.rack = c.dataset.rack; startGame(false); return; }
    if (c.dataset.mode) { M.mode = c.dataset.mode; menuGo('setup'); return; }
    if (c.dataset.go === 'practice') M.mode = 'practice';
    else if (c.dataset.go === 'game' && M.mode === 'practice') M.mode = '8ball';
    menuGo(c.dataset.go);
  });
}

function refreshMenus() {
  saveM();
  segControl($('#mListed'), [[true, 'Listed'], [false, 'Private']], () => M.listed !== false, v => M.listed = v);
  $('#listedTxt').textContent = M.listed !== false ? 'Shown in Open rooms.' : 'Code or link only.';
  updateLobbyWatch();
  $('#bStart').textContent = M.opp === 'online' ? 'Create room' : "Rack 'em up";
  segControl($('#mDiff'), [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard'], ['expert', 'Expert']], () => M.diff, v => M.diff = v);
  segControl($('#mGuide'), GUIDES, () => M.guide, v => M.guide = v);
  segControl($('#mRace'), [[0, 'Single frames'], [3, 'First to 3'], [5, 'First to 5'], [7, 'First to 7']], () => M.race || 0, v => M.race = v);
  $('#rowMatch').hidden = M.mode === 'practice';
  menuTable();
  $('#rowDiff').hidden = M.opp !== 'bot';
  $('#rowRoom').hidden = M.opp !== 'online';
  $('#rowBlack').hidden = M.mode !== 'uk8';
  segControl($('#mBlack'), [[false, 'Two visits'], [true, 'One visit']], () => !!M.blackOne, v => M.blackOne = v);
  for (const c of document.querySelectorAll('#sc-game .card')) { c.setAttribute('aria-pressed', String(c.dataset.mode === M.mode)); c.querySelector('.cardTxt').textContent = MODE_TXT[c.dataset.mode]; }
  updateQuick(); updateRejoin(); careerMenus();
  $('#diffTxt').textContent = DIFF_TXT[M.diff];
  $('#guideTxt').textContent = GUIDE_TXT[guideLevel()];
  // settings panel
  segControl($('#sGuide'), GUIDES, () => M.guide, v => { M.guide = v; aimDirty = true; });
  segControl($('#sLevels'), [[4, '4'], [6, '6'], [8, '8'], [12, '12'], [256, 'Full']], () => S.levels, v => { S.levels = v; saveS(); applyLook(); });
  segControl($('#sVolume'), [[0, 'Off'], [0.25, '25%'], [0.5, '50%'], [0.75, '75%'], [1, '100%']], () => S.volume, v => { S.volume = v; saveS(); ensureAudio(); });
  segControl($('#sPixel'), [[0, 'Max'], [1, '1×'], [2, '2×'], [3, '3×'], [4, '4×'], [5, '5×']], () => S.pixel, v => { S.pixel = v; saveS(); resize(); });
  pixNote();
  for (const [id, key] of [['#sDither', 'dither'], ['#sOutline', 'outline'], ['#sScan', 'scan'], ['#sMarkers', 'markers'], ['#sShotCam', 'shotCam'], ['#sFollow', 'follow'], ['#sVibrate', 'vibrate']]) {
    const b = $(id); b.setAttribute('aria-pressed', String(!!S[key])); b.textContent = S[key] ? 'On' : 'Off';
  }
  const foot = document.querySelector('#menuPanel .mFoot'); foot.hidden = ![...foot.children].some(b => !b.hidden);
  lookPicker($('#sCloth'), 'cloth'); $('#rowCue').hidden = lookPicker($('#sCue'), 'cue') < 2; lookPicker($('#sGlove'), 'glove');
  if (menuScreen() === 'locker' && state === 'menu') renderLocker();
  const waiting = LK.CASE_IDS.reduce((a, g) => a + LOCK.cases[g], 0);
  $('#lockerTxt').textContent = waiting ? `${waiting} ${waiting === 1 ? 'case' : 'cases'} to open` : 'Cases and looks';
  purse(); ideaBadge();
  $('#sClothTxt').textContent = NET.on && NET.seat === 1 && NET.cloth ? "Online, the table wears the host's cloth." : '';
  $('#rowDev').hidden = !DEV; $('#ver').textContent = `Version ${BUILD}${DEV ? ' · DEV' : ''}`;
  $('#sDevMythic').setAttribute('aria-pressed', String(DEV_MYTHIC)); $('#sDevMythic').textContent = `Next case mythic: ${DEV_MYTHIC ? 'On' : 'Off'}`;
  $('#sDevEmpty').textContent = devEmpty() ? 'Fill test locker' : 'Empty test locker';
  $('#sGuideTxt').textContent = GUIDE_TXT[guideLevel()];
}
for (const [id, key] of [['#sDither', 'dither'], ['#sOutline', 'outline'], ['#sScan', 'scan'], ['#sMarkers', 'markers'], ['#sShotCam', 'shotCam'], ['#sFollow', 'follow'], ['#sVibrate', 'vibrate']]) {
  $(id).addEventListener('click', () => { S[key] = !S[key]; saveS(); applyLook(); ensureAudio(); sfx('ui'); refreshMenus(); });
}
function togglePause(force) {
  paused = force !== undefined ? force : !paused;
  $('#pause').hidden = !paused;
  const inMenu = state === 'menu';
  $('#pauseGame').hidden = inMenu; $('#rowSGuide').hidden = inMenu || NET.on || CAR.on; $('#bRestart').hidden = NET.on || CAR.on;
  $('#bQuit').textContent = CAR.on ? 'Save and quit' : 'Quit to menu';
  $('#bRestart').textContent = M.mode === 'practice' ? 'Reset table' : 'Re-rack';
  $('#bConcede').hidden = M.mode === 'practice' || game.over; $('#bOfferRerack').hidden = !NET.on || game.over;
  $('#bResume').textContent = inMenu ? 'Done' : 'Resume';
  if (paused) { refreshMenus(); $('#bResume').focus({ preventScroll: true }); $('#pausePanel').scrollTop = 0; armBack(); $('#ballPick').hidden = true; $('#bBalls').setAttribute('aria-pressed', 'false'); }   // the picker would sit on top of Pause
  else { aimDirty = true; if (state === 'menu' && NAV.stack.length < 2) disarm(); }
}
$('#bStart').addEventListener('click', () => { ensureAudio(); sfx('ui'); if (M.opp === 'online') startOnline(newCode(), M.listed !== false); else startGame(false); });
$('#bMenuSettings').addEventListener('click', () => { ensureAudio(); togglePause(true); });
$('#bResume').addEventListener('click', () => togglePause(false));
// a click outside the panel closes it, if it started outside too (pressing a button and sliding off doesn't)
let pauseDown = null;
$('#pause').addEventListener('pointerdown', e => { pauseDown = e.target; });
$('#pause').addEventListener('click', e => { if (e.target === $('#pause') && pauseDown === e.target) togglePause(false); pauseDown = null; });
$('#bRestart').addEventListener('click', () => { togglePause(false); if (M.mode === 'practice') startGame(false); else { startGame(true, true); toast("Re-racked. The last frame doesn't count", 'info'); } });
$('#bQuit').addEventListener('click', () => { togglePause(false); if (NET.on) clearRejoin(); toMenu(); });
$('#bAgain').addEventListener('click', () => {
  sfx('ui');
  if (CAR.on && matchDone()) { toMenu(); return; }   // the match is over: back to the event, where the draw shows what's next
  if (!NET.on) { startGame(true); return; }
  NET.again[NET.seat] = true; netSend({ t: 'again' }); updateAgainBtn(); tryRematch();
});
$('#bOverMenu').addEventListener('click', () => { sfx('ui'); if (NET.on) clearRejoin(); toMenu(); });
$('#bCam').addEventListener('click', toggleAimCam);
$('#bTop').addEventListener('click', toggleTop);
$('#bHelp').addEventListener('click', () => { $('#help').hidden = !$('#help').hidden; });
$('#bHelpClose').addEventListener('click', () => { $('#help').hidden = true; });
$('#bPause').addEventListener('click', () => togglePause(true));
$('#bRerack').addEventListener('click', () => { if (state === 'aim') startGame(false); });
$('#bUndo').addEventListener('click', undo);
for (const [id, dir] of [['#bAimL', -1], ['#bAimR', 1]]) {
  const b = $(id);
  b.addEventListener('pointerdown', e => {
    e.preventDefault(); ensureAudio();
    if (state !== 'aim' || !humanTurn()) return;
    aim.phi = wrapA(aim.phi + dir * AIM_STEP); aimDirty = true; touchTurn = { dir, t: 0 };
    try { b.setPointerCapture(e.pointerId); } catch (err) {}
  });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(ev, () => { touchTurn = { dir: 0, t: 0 }; });
}
// sliding a finger (or the mouse) along the aim readout turns the aim very finely: JOG per screen pixel
let jog = null;
$('#aimTxt').addEventListener('pointerdown', e => {
  if (state !== 'aim' || !humanTurn()) return;
  e.preventDefault(); ensureAudio(); jog = { x: e.clientX, id: e.pointerId };
  try { $('#aimTxt').setPointerCapture(e.pointerId); } catch (err) {}
});
$('#aimTxt').addEventListener('pointermove', e => {
  if (!jog || e.pointerId !== jog.id || state !== 'aim') return;
  aim.phi = wrapA(aim.phi + (e.clientX - jog.x) * JOG); jog.x = e.clientX; aimDirty = true;
});
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) $('#aimTxt').addEventListener(ev, () => { jog = null; });
// and sliding along the power readout sets the speed very finely: right for more, POW_JOG per screen pixel
let pjog = null;
$('#powTxt').addEventListener('pointerdown', e => {
  if (state !== 'aim' || !humanTurn()) return;
  e.preventDefault(); ensureAudio(); pjog = { x: e.clientX, id: e.pointerId };
  try { $('#powTxt').setPointerCapture(e.pointerId); } catch (err) {}
});
$('#powTxt').addEventListener('pointermove', e => {
  if (!pjog || e.pointerId !== pjog.id || state !== 'aim') return;
  const d = e.clientX - pjog.x; pjog.x = e.clientX; if (d) setBallSpeed(ballSpeed() + d * POW_JOG);
});
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) $('#powTxt').addEventListener(ev, () => { pjog = null; });
$('#bReplay').addEventListener('click', () => { if (replay) endReplay(); else startReplay(); });
$('#bOverReplay').addEventListener('click', startReplay);
$('#bSlow').addEventListener('click', () => { if (!replay) return; replay.speed = replay.speed < 1 ? 1 : 0.3; setLab($('#bSlow'), replay.speed < 1 ? 'Normal speed' : 'Slow motion', replay.speed < 1 ? 'play' : 'slow'); });
$('#bSkip').addEventListener('click', () => endReplay());
$('#bMove').addEventListener('click', () => { if (M.mode !== 'practice') return; EDIT = !EDIT; updateTrickUI(); if (EDIT) toast('Drag balls to move them', 'info'); });   // kept short, so on phones it clears the new Add balls button
$('#bReturn').addEventListener('click', () => {
  if (M.mode !== 'practice' || state !== 'aim') return;
  for (const b of world.balls) if (b.id && b.potted) { b.potted = false; C.spotBall(world.balls, b); }
  syncBallMeshes(); aimDirty = true; updateHUD(); renderBallPick();
});
// "Add balls" (in Edit table mode, in practice): every object ball, lit if it's on the table; tap to add or take off
function renderBallPick() {
  const grid = $('#ballGrid'); grid.innerHTML = '';
  for (let id = 1; id <= 15; id++) {
    const on = world.balls.some(b => b.id === id && !b.potted);
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'bp';
    btn.setAttribute('aria-pressed', String(on)); btn.setAttribute('aria-label', `${on ? 'Take off' : 'Add'} ball ${id}`);
    const c = document.createElement('canvas'); c.width = c.height = 16; drawBall2D(c.getContext('2d'), 8, 8, id, ukStyle());
    btn.appendChild(c); btn.addEventListener('click', () => toggleBall(id)); grid.appendChild(btn);
  }
}
function toggleBall(id) {
  if (M.mode !== 'practice' || state !== 'aim') return;
  const i = world.balls.findIndex(b => b.id === id), on = i >= 0 && !world.balls[i].potted;
  if (i >= 0) world.balls.splice(i, 1);
  if (!on) {   // a new ball goes on the nearest free spot to the middle of the table, ready to be dragged
    const nb = C.newBall(id, 0, 0);
    find: for (let r = 0; r < 0.8; r += 0.01) for (let a = 0; a < 6.3; a += 0.3) {
      const x = Math.cos(a) * r * 1.8, z = Math.sin(a) * r * 0.9;
      if (C.validSpot(world.balls, x, z, id)) { nb.x = x; nb.z = z; break find; }
    }
    world.balls.push(nb); world.balls.sort((a, b) => a.id - b.id);
  }
  syncBallMeshes(); aimDirty = true; updateHUD(); renderBallPick(); sfx('ui');
}
$('#bBalls').addEventListener('click', () => { const p = $('#ballPick'); p.hidden = !p.hidden; if (!p.hidden) renderBallPick(); updateTrickUI(); });
$('#bPickDone').addEventListener('click', () => { $('#ballPick').hidden = true; updateTrickUI(); });
$('#bSave').addEventListener('click', () => {
  if (M.mode !== 'practice' || state !== 'aim') return;
  const l = loadLayouts(); if (l.length >= 12) { toast('You can keep 12 layouts. Delete one under Trick shots first', 'foul'); return; }
  let n = 1; while (l.some(x => x.name === `My layout ${n}`)) n++;
  l.push({ name: `My layout ${n}`, balls: world.balls.filter(b => !b.potted).map(b => [b.id, +b.x.toFixed(5), +b.z.toFixed(5)]) });
  saveLayouts(l); toast(`Saved as My layout ${n}. Find it under Trick shots`, 'good');
});
$('#bTrickPrev').addEventListener('click', () => { M.trick = (M.trick | 0) - 1; saveM(); startGame(false); });
$('#bTrickNext').addEventListener('click', () => { M.trick = (M.trick | 0) + 1; saveM(); startGame(false); });
$('#bShowMe').addEventListener('click', () => {
  const t = trickList()[M.trick]; if (!t || !t.demo) return;
  startGame(false);
  setTimeout(() => { if (state !== 'aim') return; Object.assign(aim, t.demo); aimDirty = true; updateShotPanel(); TRK.demo = true; setTimeout(shoot, 900); }, 350);
});
$('#bDelLayout').addEventListener('click', () => {
  const t = trickList()[M.trick]; if (!t || t.custom === undefined) return;
  const l = loadLayouts(); l.splice(t.custom, 1); saveLayouts(l); M.trick = 0; saveM(); startGame(false); toast('Layout deleted', 'info');
});
function updateTrickUI() {
  const on = M.mode === 'practice' && M.rack === 'trick';
  $('#trickInfo').hidden = !on;
  $('#bMove').setAttribute('aria-pressed', String(EDIT));
  $('#bBalls').hidden = !EDIT; if (!EDIT) $('#ballPick').hidden = true;
  $('#bBalls').setAttribute('aria-pressed', String(!$('#ballPick').hidden));
  setLab($('#bRerack'), on ? 'Retry (R)' : 'Rerack');
  if (!on) return;
  const list = trickList(), t = list[M.trick] || list[0];
  $('#trickTitle').textContent = `Trick ${M.trick + 1} of ${list.length}: ${t.name}`;
  $('#trickGoal').textContent = t.goal;
  $('#bShowMe').hidden = !t.demo; $('#bDelLayout').hidden = t.custom === undefined;
}
$('#bHand').addEventListener('click', () => { if (M.mode === 'practice' && state === 'aim') { game.ballInHand = !game.ballInHand; updateHUD(); } });
function toMenu() {
  const fromCareer = CAR.on; if (fromCareer) careerLeave();
  leaveOnline(); endReplayNow(); lastShot = null; EDIT = false; $('#offer').hidden = true; $('#chatPop').hidden = true; $('#ballPick').hidden = true;
  state = 'menu'; bot = null; stroke = null;
  world = C.makeWorld(C.rack8()); game = C.newGame('8ball'); syncBallMeshes();
  $('#hud').hidden = true; $('#over').hidden = true; $('#menu').hidden = false; $('#thinking').hidden = true;
  cam.mode = 'attract'; cam.free = { yaw: cam.cur.yaw, pitch: 0.62, dist: 3.6, tx: 0, tz: 0 };
  menuReset(fromCareer ? ['home', 'single', 'career', 'cevent'] : NAV.lastOnline ? ['home', 'multi', 'online'] : ['home']);
  hideGuides(); refreshMenus(); updateCamButtons();
}

// ------------------------------------------------------------------ career
// The tour (src/career.js holds its rules, events and opponents): a hub with your events, an event screen with the
// draw, and career matches, which are ordinary games against the CPU set up from the career. The career is saved
// after every shot, so a match can be left, or the app closed, and picked up exactly where it was. The menu's own
// choices (M) are put aside during a career match and restored afterwards.
const careerStore = () => { try { if (CAR.data) localStorage.setItem('retroRack.career', JSON.stringify(CAR.data)); else localStorage.removeItem('retroRack.career'); } catch (e) {} };
function careerSave() {
  const m = CAR.data && CAR.data.run && CAR.data.run.match; if (!m || game.over) return;
  m.wins = [...matchWins]; m.breaker = breaker; m.snap = snapshot(); careerStore();
}
function careerFrameOver() {
  const m = CAR.data && CAR.data.run && CAR.data.run.match; if (!m) return;
  m.wins = [...matchWins]; m.breaker = 1 - breaker; m.snap = null;   // the next frame: the other player breaks
  CAR.result = matchDone() ? K.recordMatch(CAR.data, [...matchWins]) : null;
  careerPaid(CAR.result); careerStore();
}
function careerPlay() {
  const run = CAR.data && CAR.data.run; if (!run) return;
  const m = run.match, e = K.EVENTS[run.event];
  CAR.stash = { ...M }; CAR.on = true; CAR.opp = m.opp; CAR.view = run.event; CAR.result = null; CAR.tier = null;
  Object.assign(M, { mode: e.mode, opp: 'bot', race: m.race, blackOne: !!e.blackOne, guide: CAR.data.guide });
  setVenue(K.TIERS[e.tier].id, e.sign);
  startGame(false, false, { wins: m.wins, breaker: m.breaker, snap: m.snap });
  if (!m.snap) toast(`${K.ROUNDS[run.round]} v ${K.OPPONENTS[m.opp].name}, first to ${m.race}`, 'info');
}
function careerLeave() { Object.assign(M, CAR.stash || {}); CAR.stash = null; CAR.on = false; CAR.opp = null; saveM(); setVenue('home'); }
const money = n => '£' + n.toLocaleString('en-GB');
// a result's prize money goes into the locker, with the case an event win brings (r.cases, for the result screen)
function careerPaid(r) {
  if (!r || !(r.prize || r.champion)) return;
  const e = K.EVENTS[r.event], champ = e.index === K.TIERS[e.tier].events.length - 1;
  r.cases = lockerEdit(l => { l.money += r.prize; return r.champion ? LK.eventWon(l, e.tier, champ) : null; });
}
const caseText = c => c ? ` and ${c.n > 1 ? c.n + ' ' + LK.GRADES[c.grade].name.toLowerCase() + 's' : 'a ' + LK.GRADES[c.grade].name.toLowerCase()}` : '';
function nextEvent(e) { return K.TIERS[e.tier].events[e.index + 1] || null; }
function careerResultText() {
  const r = CAR.result; if (!r) return '';
  const e = K.EVENTS[r.event], first = (CAR.data.done[e.id] || {}).won === 1, nx = nextEvent(e);
  const nt = K.TIERS[e.tier + 1];
  if (r.champion) return `You win ${e.name}! Prize: ${money(r.prize)}${caseText(r.cases)}.` + (r.tierDone ? ` You're ${K.TIERS[e.tier].champ}. ${nt ? `${nt.name.replace(/^./, ch => ch.toUpperCase())} is now open.` : 'The world final opens in a coming update.'}` : first && nx ? ` ${nx.name} is now open.` : '');
  if (r.won) return `Through to the ${K.ROUNDS[r.round + 1].toLowerCase()}, against ${K.OPPONENTS[CAR.data.run.match.opp].name}.`;
  return (r.round === K.ROUNDS.length - 1 ? 'Runner-up.' : `Out in the ${K.ROUNDS[r.round].toLowerCase()}.`) + ` Prize: ${money(r.prize)}.`;
}

// pixel portraits and strength stars, drawn small and shown with hard pixel edges
function portrait(look, scale) {
  const c = document.createElement('canvas'), g = c.getContext('2d'); c.width = 10; c.height = 14;
  drawSprite(g, look.s, 1, 1, look.shirt, { f: look.skin, h: look.hair });
  const img = new Image(); img.src = c.toDataURL(); img.className = 'portrait'; img.alt = ''; img.width = 10 * scale; img.height = 14 * scale;
  return img;
}
const STAR = ['..x..', '.xxx.', 'xxxxx', '.xxx.', '.x.x.'];
function starsImg(n) {
  const c = document.createElement('canvas'), g = c.getContext('2d'); c.width = 29; c.height = 5;
  for (let i = 0; i < 5; i++) STAR.forEach((row, y) => { for (let x = 0; x < 5; x++) if (row[x] === 'x') { g.fillStyle = i < n ? P1 : '#4e3270'; g.fillRect(i * 6 + x, y, 1, 1); } });
  const img = new Image(); img.src = c.toDataURL(); img.className = 'stars'; img.width = 58; img.height = 10; img.alt = `Strength ${n} of 5`; img.title = `${img.alt} (the Medium computer would be about 3, Hard 5)`;
  return img;
}
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

// the new-career form
const LOOK_COLS = { skin: ['#f6d2b4', '#f2c49b', '#d9a07a', '#a8714a', '#6b4429'], hair: ['#1a1206', '#5a3420', '#b5432a', '#d9a441', '#c9c3bd'],
  shirt: ['#ffc56b', '#6cb8ff', '#ff6f8f', '#1d8a74', '#56399a', '#f7ead2'] };
const NEWC = { s: 'man', skin: '#f2c49b', hair: '#5a3420', shirt: '#ffc56b', guide: 'line' };
function renderCareerNew() {
  if (!$('#cName').value) { try { $('#cName').value = localStorage.getItem('retroRack.name') || ''; } catch (e) {} }
  const st = $('#cStyle'); st.innerHTML = '';
  for (const s of ['man', 'long', 'bald', 'cap', 'glasses', 'beard']) {
    const b = mk('button', 'btn cStyleBtn'); b.type = 'button'; b.setAttribute('aria-pressed', String(NEWC.s === s)); b.setAttribute('aria-label', 'Look ' + s);
    b.append(portrait({ ...NEWC, s }, 2)); b.addEventListener('click', () => { NEWC.s = s; sfx('ui'); refreshMenus(); }); st.append(b);
  }
  for (const k of ['skin', 'hair', 'shirt']) {
    const box = $('#c' + k[0].toUpperCase() + k.slice(1)); box.innerHTML = '';
    for (const hex of LOOK_COLS[k]) {
      const b = mk('button', 'swatch'); b.type = 'button'; b.style.background = hex; b.setAttribute('aria-label', `${k} colour`); b.setAttribute('aria-pressed', String(NEWC[k] === hex));
      b.addEventListener('click', () => { NEWC[k] = hex; sfx('ui'); refreshMenus(); }); box.append(b);
    }
  }
  segControl($('#cGuide'), GUIDES.filter(([v]) => v !== 'auto'), () => NEWC.guide, v => NEWC.guide = v);
  $('#cGuideTxt').textContent = GUIDE_TXT[NEWC.guide] + ' Fixed for the whole career.';
}

// the hub: you, then each tier's events
function eventState(e) {
  const c = CAR.data, d = c.done[e.id] || {};
  if (c.run && c.run.event === e.id) return `Playing: ${K.ROUNDS[c.run.round].toLowerCase()}`;
  if (!K.unlocked(c, e.id)) return 'Locked';
  if (d.won) return d.won > 1 ? `Won ×${d.won}` : 'Won';
  return d.played ? `Best: ${d.best === K.ROUNDS.length - 1 ? 'runner-up' : K.ROUNDS[d.best].toLowerCase()}` : 'Open';
}
const raceText = e => `First to ${e.races.slice(0, -1).join(', ')}, then ${e.races[e.races.length - 1]} in the final`;
// the tier shown on the hub: the one you're playing in, else the furthest one open
function careerTier() {
  const c = CAR.data;
  if (Number.isInteger(CAR.tier)) return CAR.tier;
  if (c.run) return K.EVENTS[c.run.event].tier;
  let ti = 0; while (ti < K.TIERS.length - 1 && K.tierDone(c, ti)) ti++;
  return ti;
}
function renderCareerHub() {
  const c = CAR.data, me = $('#cMe'), list = $('#cEvents'); me.innerHTML = ''; list.innerHTML = '';
  const txt = mk('div'); txt.append(mk('div', 'cMeName', c.name), mk('div', 'cMeStats', `${money(LOCK.money)} to spend · ${c.trophies.length} ${c.trophies.length === 1 ? 'trophy' : 'trophies'}`));
  me.append(portrait(c.look, 3), txt);
  const shown = careerTier(), tabs = $('#cTiers'); tabs.innerHTML = '';
  K.TIERS.forEach((t, ti) => {
    const b = mk('button', 'btn' + (K.unlocked(c, t.events[0].id) ? '' : ' locked'), t.short); b.type = 'button';
    b.setAttribute('aria-pressed', String(ti === shown));
    b.addEventListener('click', () => { CAR.tier = ti; sfx('ui'); refreshMenus(); }); tabs.append(b);
  });
  [K.TIERS[shown]].forEach(t => {
    const prev = K.TIERS[shown - 1];
    if (!K.unlocked(c, t.events[0].id)) list.append(mk('p', 'cTier', `Win ${prev.events[prev.events.length - 1].name} to open ${t.name}.`));
    for (const e0 of t.events) {
      const e = K.EVENTS[e0.id], open = K.unlocked(c, e.id), b = mk('button', 'cEvt'); b.type = 'button';
      b.append(mk('span', 'cEvtName', e.name), mk('span', 'cEvtState', eventState(e)), mk('span', 'cEvtTxt', `${MODE_NAME[e.mode]}${e.blackOne ? ', one visit on the black' : ''}. Winner ${money(e.prize[3])}`));
      b.setAttribute('aria-disabled', String(!open));
      b.addEventListener('click', () => { if (!K.unlocked(CAR.data, e.id)) return; sfx('ui'); CAR.view = e.id; menuGo('cevent'); });
      list.append(b);
    }
  });
}

// an event: the draw (or, before entering, the field) and your next opponent
function renderCareerEvent() {
  const c = CAR.data, e = K.EVENTS[CAR.view]; if (!e) return;
  const run = c.run && c.run.event === e.id ? c.run : null, last = !run && c.last && c.last.event === e.id ? c.last : null;
  $('#cInfo').textContent = `${MODE_NAME[e.mode]} on the ${e.mode === 'uk8' ? '7' : '9'} ft table${e.blackOne ? ', one visit on the black' : ''}. ${raceText(e)}. Prizes ${e.prize.map(money).join(', ')}.`;
  const br = $('#cBracket'), opp = $('#cOpp'); br.innerHTML = ''; opp.innerHTML = '';
  const b = run || last;
  br.classList.toggle('bField', !b);
  if (!b) for (const id of [K.YOU, ...e.field]) { const r = mk('div', 'bName' + (id === K.YOU ? ' you' : '')); r.append(mk('span', '', K.nameOf(c, id))); if (id !== K.YOU) r.append(starsImg(K.stars(id))); br.append(r); }
  else for (let rd = 0; rd <= K.ROUNDS.length; rd++) {
    const col = mk('div', 'bCol'), ids = rd === 0 ? b.slots : b.res[rd - 1], n = 8 >> rd;
    for (let i = 0; i < n; i++) {
      const id = ids ? ids[i] : null, done = b.res[rd], sc = b.scores[rd] && b.scores[rd][i >> 1];
      const r = mk('div', 'bName' + (id === K.YOU ? ' you' : '') + (rd === K.ROUNDS.length && id ? ' champ' : '') + (done && id && done[i >> 1] !== id ? ' out' : ''));
      r.append(mk('span', '', id ? K.nameOf(c, id) : '…'));
      if (sc && rd < K.ROUNDS.length) r.append(mk('span', '', String(sc[i & 1])));
      col.append(r);
    }
    br.append(col);
  }
  const show = run ? run.match.opp : null;
  if (show) {
    const o = K.OPPONENTS[show], m = run.match;
    opp.append(portrait(o.look, 3), mk('div', 'cOppName', o.name), mk('div', '', o.full), starsImg(K.stars(show)), mk('div', 'cOppTxt', o.blurb),
      mk('div', 'cOppTxt', `${K.ROUNDS[run.round]}, first to ${m.race}${m.wins[0] + m.wins[1] || m.snap ? `. Score ${m.wins[0]}–${m.wins[1]}, match in progress` : ''}.`));
  } else if (last) opp.append(mk('div', 'cOppTxt', last.result === K.ROUNDS.length ? 'You won this event last time.' : `Last time: ${last.result === K.ROUNDS.length - 1 ? 'runner-up' : 'out in the ' + K.ROUNDS[last.result].toLowerCase()}.`));
  else if (c.run) opp.append(mk('div', 'cOppTxt', `Finish ${K.EVENTS[c.run.event].name} first, or withdraw from it.`));
  else opp.append(mk('div', 'cOppTxt', 'Enter to see the draw and your first opponent.'));
}

// called by refreshMenus: draws whichever career screen is showing, and sets the footer's buttons
function careerMenus() {
  const sc = menuScreen(), c = CAR.data, bc = $('#bCareer'), ev = K.EVENTS[CAR.view];
  bc.hidden = true; $('#bWithdraw').hidden = true;
  if (!CAR.on && state === 'menu') { if (sc === 'cevent' && ev) setVenue(K.TIERS[ev.tier].id, ev.sign); else setVenue('home'); }
  if (sc === 'cnew') { renderCareerNew(); bc.hidden = false; bc.textContent = 'Start career'; return; }
  if (!c || (sc !== 'career' && sc !== 'cevent')) return;
  if (sc === 'career') {
    renderCareerHub();
    if (c.run) { bc.hidden = false; bc.textContent = `Continue: ${K.ROUNDS[c.run.round].toLowerCase()} v ${K.OPPONENTS[c.run.match.opp].name}`; }
  } else {
    renderCareerEvent();
    const mine = c.run && c.run.event === CAR.view;
    if (mine) { const m = c.run.match; bc.hidden = false; bc.textContent = m.wins[0] + m.wins[1] || m.snap ? 'Continue the match' : `Play the ${K.ROUNDS[c.run.round].toLowerCase()}`; $('#bWithdraw').hidden = false; }
    else if (!c.run && K.unlocked(c, CAR.view)) { bc.hidden = false; bc.textContent = (c.done[CAR.view] || {}).played ? 'Enter again' : 'Enter'; }
  }
}
$('#bCareer').addEventListener('click', () => {
  ensureAudio(); sfx('ui');
  const sc = menuScreen();
  if (sc === 'cnew') {
    const name = cleanName($('#cName').value, 'You');
    CAR.data = K.newCareer({ name, look: NEWC, guide: NEWC.guide }, Date.now()); careerStore();
    try { localStorage.setItem('retroRack.name', name); } catch (e) {}
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});   // ask the browser not to clear it
    NAV.stack.pop(); menuGo('career'); return;
  }
  if (sc === 'cevent' && !CAR.data.run) {
    const a = new Uint32Array(1); crypto.getRandomValues(a);
    if (K.enterEvent(CAR.data, CAR.view, a[0])) { careerStore(); refreshMenus(); }
    return;
  }
  if (CAR.data.run) careerPlay();
});
$('#bWithdraw').addEventListener('click', () => {
  if (!CAR.data.run || !confirm(`Withdraw from ${K.EVENTS[CAR.data.run.event].name}? It counts as losing your current match.`)) return;
  const r = K.withdraw(CAR.data); careerPaid(r); careerStore(); sfx('ui'); refreshMenus();
  if (r) $('#cNote').textContent = `Withdrawn. Prize: ${money(r.prize)}.`;
});
$('#cExport').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ ...CAR.data, locker: LOCK }, null, 1)], { type: 'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `retro-rack-career-${CAR.data.name.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}.json`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  $('#cNote').textContent = 'Saved. Keep the file somewhere safe, or load it on another device.';
});
$('#cImport').addEventListener('click', () => $('#cFile').click());
$('#cFile').addEventListener('change', async () => {
  const f = $('#cFile').files[0]; $('#cFile').value = ''; if (!f) return;
  let raw = null, c = null; try { raw = JSON.parse(await f.text()); c = K.validate(raw); } catch (e) {}
  if (!c) { $('#cNote').textContent = "That file isn't a Retro Rack career."; return; }
  if (CAR.data && !confirm(`Replace ${CAR.data.name}'s career on this device with ${c.name}'s from the file?`)) return;
  // the file's locker comes too, without taking anything away (an older file has its money and bought looks instead)
  lockerEdit(l => LK.mergeLocker(l, raw.locker || { v: 1, money: c.money, owned: c.bought })); claimDue();
  delete c.money; delete c.bought; CAR.data = c; CAR.tier = null; careerStore();
  refreshMenus(); $('#cNote').textContent = `Loaded ${c.name}'s career.`;
});
$('#cRetire').addEventListener('click', () => {
  if (!confirm(`Retire ${CAR.data.name}? This deletes the career from this device. Your money, cases and looks stay in the locker.`)) return;
  CAR.data = null; CAR.tier = null; careerStore(); sfx('ui'); NAV.stack.pop(); menuGo('cnew');
});

// ------------------------------------------------------------------ locker
// The locker screen: cases to open or buy (src/looks.js has the odds and prices), then every cloth, cue and glove,
// owned or not. Tap a look you own to use it, a shop look to buy it; a look from cases says which cases hold it.
// Opening a case spins a reel of the case's items that stops on the prize (see showReel).
const LOCKV = { tab: 'cases', top: false, try: {} };   // try: looks tapped but not owned, by kind, for Preview; top: back to the top of the list
function shade(hex, k) { return '#' + [1, 3, 5].map(i => Math.round(Math.min(255, parseInt(hex.slice(i, i + 2), 16) * k)).toString(16).padStart(2, '0')).join(''); }
// pixel pictures from rectangles: parts are [x, y, w, h, colour, no outline]; outlined parts get a 1-pixel ink edge
function drawParts(g, parts, ox = 0, oy = 0) {
  g.fillStyle = '#141018'; for (const [x, y, pw, ph, , bare] of parts) if (!bare) g.fillRect(ox + x - 1, oy + y - 1, pw + 2, ph + 2);
  for (const [x, y, pw, ph, col] of parts) { g.fillStyle = col; g.fillRect(ox + x, oy + y, pw, ph); }
}
function pixImg(w, h, parts, scale) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; drawParts(c.getContext('2d'), parts);
  const img = new Image(); img.src = c.toDataURL(); img.className = 'portrait'; img.alt = ''; img.width = w * scale; img.height = h * scale;
  return img;
}
// a case: a chest in the grade's colour, 18 × 14 (the Trick case carved like a jack-o'-lantern, the Treat case tied
// with a gold ribbon)
function caseParts(grade) {
  const col = LK.GRADES[grade].col, dk = shade(col, 0.62), lt = shade(col, 1.25);
  if (grade === 'trick') return [[1, 4, 16, 9, col], [1, 4, 16, 3, dk, 1], [2, 5, 14, 1, lt, 1], [1, 7, 16, 1, '#141018', 1], [3, 1, 12, 3, col], [3, 1, 12, 1, lt, 1], [1, 12, 16, 1, dk, 1],
    [8, 0, 2, 2, '#2f6a24'], [4, 8, 3, 2, '#ffd23f', 1], [11, 8, 3, 2, '#ffd23f', 1], [5, 11, 8, 1, '#ffd23f', 1], [7, 10, 1, 1, '#ffd23f', 1], [10, 10, 1, 1, '#ffd23f', 1]];
  if (grade === 'treat') return [[1, 4, 16, 9, col], [1, 4, 16, 3, dk, 1], [2, 5, 14, 1, lt, 1], [1, 7, 16, 1, '#141018', 1], [3, 1, 12, 3, col], [3, 1, 12, 1, lt, 1], [1, 12, 16, 1, dk, 1],
    [8, 1, 2, 12, '#ffd36b', 1], [1, 9, 16, 1, '#ffd36b', 1], [5, 0, 3, 2, '#ffd36b'], [10, 0, 3, 2, '#ffd36b']];
  return [[1, 4, 16, 9, col], [1, 4, 16, 3, dk, 1], [2, 5, 14, 1, lt, 1], [1, 7, 16, 1, '#141018', 1], [7, 6, 4, 4, '#141018', 1], [8, 7, 2, 2, lt, 1],
    [3, 1, 12, 3, col], [3, 1, 12, 1, lt, 1], [1, 12, 16, 1, dk, 1]];
}
const caseImg = (grade, scale) => pixImg(18, 14, caseParts(grade), scale);
// a glove from its type, as the back of the hand: fingers up, thumb out to the left, cuff below
function gloveImg(id, scale) {
  if (id === 'none') return pixImg(16, 18, [[3, 4, 10, 10, '#4e3270'], [5, 6, 6, 6, '#2a2238', 1], [3, 8, 10, 2, '#4e3270', 1]], scale);
  const it = LK.ALL[id], b = it.base, sk = it.skin || b, st = it.style, P = [], f = (...p) => P.push(p), tops = [3, 1, 2, 4];
  const one = !['claw', 'bones', 'boxing'].includes(st), tone = (x, k) => one ? '#' + new THREE.Color(b).lerp(new THREE.Color(x), k).getHexString() : x;   // trims toned as on the glove itself
  const a = tone(it.accent, TONE.accent), cf = tone(it.cuff, TONE.cuff), pn = tone(it.cuff, TONE.panel);
  if (st === 'boxing') f(3, 2, 13, 11, b);
  else if (st === 'claw') for (let i = 0; i < 3; i++) f(4 + i * 4, [3, 1, 3][i], 3, 9 - [3, 1, 3][i], b);
  else for (let i = 0; i < 4; i++) f(4 + i * 3, tops[i], st === 'bones' ? 1 : 2, 9 - tops[i], st === 'wraps' ? sk : b);
  if (st !== 'boxing') f(4, 7, 11, 6, st === 'bones' ? cf : b);   // the palm
  f(1, 8, 4, 3, st === 'wraps' ? sk : b);                          // the thumb
  f(5, 13, 9, st === 'tactical' ? 5 : 3, cf);                      // the cuff
  if (st === 'sport') { f(6, 8, 7, 3, pn, 1); f(4, 7, 11, 1, a, 1); }
  else if (st === 'moto' || st === 'tactical') for (let i = 0; i < 4; i++) { f(4 + i * 3, 7, 2, 1, a, 1); if (st === 'moto') f(4 + i * 3, tops[i] + 2, 2, 1, a, 1); }
  else if (st === 'fingerless') for (let i = 0; i < 4; i++) f(4 + i * 3, tops[i], 2, 2, sk, 1);
  else if (st === 'wraps') for (const y of [8, 11]) f(4, y, 11, 1, a, 1);
  else if (st === 'claw') for (let i = 0; i < 3; i++) f(4 + i * 4, [3, 1, 3][i], 3, 1, it.fxc || a, 1);
  else if (st === 'bones') for (const x of [5, 7, 9, 11]) f(x, 8, 1, 4, b, 1);
  else if (st === 'boxing') f(4, 4, 2, 7, a, 1);
  if (['sport', 'driver', 'fingerless', 'moto'].includes(st)) f(10, 14, 3, 1, a, 1);   // the strap tab
  return pixImg(17, 19, P, scale);
}
function clothImg(id, px) {
  const c = document.createElement('canvas'), it = K.has(LK.ALL, id) && LK.ALL[id].pat ? LK.ALL[id] : { col: CLOTHS[id][0] }; c.width = c.height = px;
  drawPattern(c.getContext('2d'), it, px, px, px / 0.4);
  const img = new Image(); img.src = c.toDataURL(); img.className = 'shopSw'; img.alt = ''; img.width = img.height = px;
  return img;
}
// a cue, drawn corner to corner: butt sleeve, wrap, forearm (with its pattern), joint, shaft and tip
function cueIcon(id, scale) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), it = kindOf(id) === 'cue' ? LK.ALL[id] : {}, col = cueCols(id); c.width = c.height = 16;
  for (let i = 0; i < 15; i++) {
    const f = i / 14, x = 1 + i, y = 14 - i, thick = f < 0.5;
    let hex = f < 0.06 ? '#141018' : f < 0.13 ? col.butt : f < 0.3 ? col.wrap : f < 0.5 ? col.fore : f < 0.56 ? col.joint : f < 0.95 ? col.shaft : '#3d78e0';
    if (it.fx === 'rainbow' && f >= 0.06 && f < 0.5) hex = `hsl(${Math.round(f * 600)},85%,58%)`;
    else if (it.pat && (f >= 0.3 && f < 0.5 || f >= 0.06 && f < 0.13) && i % 2) hex = it.pc;
    g.fillStyle = hex; g.fillRect(x, y, 1, 1); if (thick) { g.fillRect(x - 1, y, 1, 1); g.fillRect(x, y + 1, 1, 1); }
  }
  g.fillStyle = col.inlay; g.fillRect(8, 8, 1, 1);
  const img = new Image(); img.src = c.toDataURL(); img.className = 'portrait'; img.alt = ''; img.width = img.height = 16 * scale;
  return img;
}
const lookKind = id => id === 'house' ? 'cue' : id === 'none' ? 'glove' : kindOf(id) || 'cloth';
const lookName = id => id === 'house' ? 'House cue' : id === 'none' ? 'No gloves' : K.has(LK.ALL, id) ? LK.ALL[id].name : CLOTHS[id][1];
const lookIcon = (id, size) => { const k = lookKind(id); return k === 'cloth' ? clothImg(id, size) : k === 'cue' ? cueIcon(id, Math.max(1, Math.round(size / 16))) : gloveImg(id, Math.max(1, Math.round(size / 17))); };
// every look of a kind, in the order shown: the free ones, the shop's (cheapest first), then the cases' (commonest first)
function looksOf(kind) {
  const free = kind === 'cloth' ? Object.keys(CLOTHS).filter(id => !K.has(LK.ALL, id)) : kind === 'cue' ? ['house'] : ['none', LK.FREE_GLOVE.id];
  return [...free, ...K.SHOP.filter(it => it.kind === kind).map(it => it.id), ...[...LK.CASE_ITEMS, ...LK.SEASON_ITEMS].filter(it => it.kind === kind).map(it => it.id)];
}
function useLook(id) { S[lookKind(id)] = id; saveS(); applyLook(); sendLook(); }
const gradeList = ids => ids.map(g => LK.GRADES[g].name.replace(' case', '')).join(ids.length > 2 ? ', ' : ' or ').replace(/, ([^,]*)$/, ' or $1');
const lockNote = t => { $('#lockNote').textContent = t; };
// the looks in rarity order, rarest first, then the shop's and the free ones; rank: the rarity's place, -1 shop, -2 free
const lookRank = id => { const it = K.has(LK.ALL, id) ? LK.ALL[id] : null; return it && it.rarity && id !== LK.FREE_GLOVE.id ? LK.RARITIES.indexOf(it.rarity) : K.has(K.ITEMS, id) ? -1 : -2; };
const KINDS = ['cloth', 'cue', 'glove'], KIND_NAME = { cloth: 'cloth', cue: 'cue', glove: 'gloves' };
const lookSort = (a, b) => lookRank(b) - lookRank(a) || KINDS.indexOf(lookKind(a)) - KINDS.indexOf(lookKind(b)) || lookName(a).localeCompare(lookName(b));
const rankName = r => r >= 0 ? LK.RARITY[LK.RARITIES[r]].name : r === -1 ? 'From the shop' : 'Free';
const rankCol = r => r >= 0 ? LK.RARITY[LK.RARITIES[r]].col : '#8f86a8';
const casesTxt = c => Object.entries(c).map(([g, n]) => `${n === 1 ? 'a' : n} ${LK.GRADES[g].series ? LK.GRADES[g].name.replace(' case', '') : g} case${n === 1 ? '' : 's'}`).join(' and ');
// what completing collections brought, for the reel and the toasts
const KIND_COL = { cloth: 'cloth', cue: 'cue', glove: 'glove' }, KIND_HEAD = { cloth: 'Cloths', cue: 'Cues', glove: 'Gloves' };
const rewardTxt = c => [c.money ? money(c.money) : '', Object.keys(c.cases).length ? casesTxt(c.cases) : ''].filter(Boolean).join(' and ');
const seriesOf = id => K.has(LK.ALL, id) ? LK.ALL[id].series : null;
const doneTxt = done => done.map(k => {
  const [sid, sr] = k.split(':');
  if (K.has(LK.SERIES, sid)) {   // a season's rarity, or all of its looks
    const Sx = LK.SERIES[sid];
    return sr === 'all' ? `All ${LK.seriesItems(sid).length} ${Sx.name} looks: ${rewardTxt(Sx.grand)} and the ${LK.EFFECTS[Sx.grand.fx].name}!` : `Every ${LK.RARITY[sr].name.toLowerCase()} ${Sx.name} look: ${rewardTxt(Sx.reward[sr])}!`;
  }
  if (k === 'all') return `All fifteen collections complete: ${money(LK.GRAND.money)} and the ${LK.EFFECTS[LK.GRAND.fx].name}!`;
  if (K.has(LK.SETS, k)) return `Every ${LK.RARITY[k].name.toLowerCase()} collection complete: ${money(LK.SETS[k].money)}, ${casesTxt(LK.SETS[k].cases)} and ${LK.EFFECTS[LK.SETS[k].fx].name}!`;
  const c = LK.COLLECTIONS[k]; return `${LK.RARITY[c.rarity].name} ${KIND_COL[c.kind]} collection complete: ${rewardTxt(c)}!`;
}).join(' ');
// pays any collection rewards due (a career file can complete one); says so
function claimDue() {
  if (!LK.claimCollections(JSON.parse(JSON.stringify(LOCK))).length) return;   // nothing due (tried on a copy)
  const done = lockerEdit(l => LK.claimCollections(l)); if (done.length) { toast(doneTxt(done), 'good'); applyFx(); refreshMenus(); }
}
// tapping a look, in the inventory or the shop: one you own goes into use; one you don't is marked to try on in Preview
// (a shop look offers to be bought first)
function lookTap(id) {
  const it = K.has(LK.ALL, id) ? LK.ALL[id] : null, kind = lookKind(id), shop = K.has(K.ITEMS, id);
  if (owns(id)) { delete LOCKV.try[kind]; useLook(id); sfx('ui'); lockNote(''); refreshMenus(); return; }
  LOCKV.try[kind] = id; sfx('ui'); refreshMenus();
  if (!shop) { const gs = it.series ? LK.SERIES[it.series].grades : LK.GRADE_IDS; lockNote(`${it.name}: ${LK.RARITY[it.rarity].name.toLowerCase()} ${KIND_NAME[kind]}. In ${gradeList(gs.filter(g => LK.GRADES[g].odds[LK.RARITIES.indexOf(it.rarity)]))} cases${it.series ? ` (${LK.SERIES[it.series].name})` : ''}. Preview tries it on.`); return; }
  if (LOCK.money < it.price) { lockNote(`You need ${money(it.price - LOCK.money)} more for ${it.name}. Preview tries it on.`); return; }
  if (!confirm(`Buy ${it.name} for ${money(it.price)}?`)) { lockNote(`Preview tries ${it.name} on.`); return; }
  delete LOCKV.try[kind];
  if (lockerEdit(lk => LK.buyLook(lk, id)) !== 'ok') { refreshMenus(); return; }
  useLook(id); sfx('win'); lockNote(`${it.name} is yours, and in use.`); refreshMenus();
}
// a row of the inventory: picture, name, rarity and kind, and whether it's in use
function invRow(id) {
  const kind = lookKind(id), using = S[kind] === id, b = mk('button', 'invRow'); b.type = 'button'; b.dataset.id = id;
  b.style.setProperty('--rc', rankCol(lookRank(id))); b.setAttribute('aria-pressed', String(using));
  const r = lookRank(id), sub = r >= 0 ? rankName(r) : r === -1 ? 'Shop' : 'Free', sid = seriesOf(id);
  b.append(lookIcon(id, 30), mk('span', 'invName', lookName(id)), mk('span', 'invState', using ? 'In use' : ''), mk('span', 'invSub', `${sub} ${KIND_NAME[kind]}${sid ? ' · ' + LK.SERIES[sid].name : ''}`));
  b.addEventListener('click', () => lookTap(id));
  return b;
}
// a tile in the shop: the look's picture on its rarity's colour, dim until owned
function colTile(id) {
  const kind = lookKind(id), own = owns(id), r = lookRank(id), col = rankCol(r), it = K.has(LK.ALL, id) ? LK.ALL[id] : null;
  const b = mk('button', 'colTile' + (own ? ' owned' : ' locked') + (r === -1 ? ' sale' : '') + (LOCKV.try[kind] === id ? ' trying' : '')); b.type = 'button'; b.dataset.id = id;
  b.title = `${lookName(id)} (${rankName(r).toLowerCase()} ${KIND_NAME[kind]})`; b.setAttribute('aria-label', b.title);
  b.style.borderColor = col; b.style.background = `linear-gradient(${shade(col, 0.22)}, ${shade(col, 0.5)} 45%, ${shade(col, 0.85)})`;
  b.append(lookIcon(id, 30));
  if (r === -1) { b.classList.remove('locked'); b.append(mk('span', 'colPrice', own ? 'Owned' : money(it.price))); } else if (own) b.append(mk('span', 'colTick', '✓'));
  b.addEventListener('click', () => lookTap(id));
  return b;
}
// a case's card: its picture, how many are waiting, its odds, and Open and Buy (a season's cases sell only in season)
function caseCard(g) {
  const l = LOCK, G = LK.GRADES[g], n = l.cases[g], card = mk('div', 'caseCard'), btns = mk('div', 'caseBtns'), sid = G.series, day = localDay();
  const low = G.odds.findIndex(o => o), odds = (G.fresh ? 'Always a look you don\'t have yet: ' : low >= 2 ? `Always ${LK.RARITY[LK.RARITIES[low]].name.toLowerCase()} or better: ` : '') + G.odds.map((o, i) => o ? `${o}% ${LK.RARITY[LK.RARITIES[i]].name.toLowerCase()}` : '').filter(Boolean).join(', ');
  const open = mk('button', 'btn', G.open ? `Open ${money(G.open)}` : 'Open'), buy = mk('button', 'btn', `Buy ${money(G.price)}`); open.type = buy.type = 'button';
  open.classList.toggle('dim', !n); open.dataset.grade = buy.dataset.grade = g;   // still tappable: it says how to get one
  buy.classList.toggle('dim', !!sid && !LK.inSeason(sid, day));
  open.addEventListener('click', () => openCaseUI(g));
  buy.addEventListener('click', () => {
    if (sid && !LK.inSeason(sid, day)) { lockNote(`${G.name}s are on sale in the ${LK.SERIES[sid].name} season: ${seasonDates(sid)}.`); return; }
    if (LOCK.money < G.price) { lockNote(`A ${sid ? G.name : G.name.toLowerCase()} costs ${money(G.price)}: you need ${money(G.price - LOCK.money)} more.`); return; }
    if (!confirm(`Buy a ${sid ? G.name : G.name.toLowerCase()} for ${money(G.price)}?${G.open ? ` Opening it costs ${money(G.open)} more.` : ''}`)) return;
    const r = lockerEdit(lk => LK.buyCase(lk, g, day));
    if (r === 'ok') { sfx('ui'); lockNote(`A ${sid ? G.name : G.name.toLowerCase()} is yours. Open it when you like.`); }
    else if (r === 'complete') lockNote(`You have every ${LK.SERIES[sid].name} look already, so a ${G.name} has nothing new to give.`);
    refreshMenus();
  });
  btns.append(open, buy);
  card.append(caseImg(g, 3), mk('div', 'caseName', G.name), mk('div', 'caseN', n ? `${n} to open` : 'None yet'), mk('div', 'caseOdds', odds), btns);
  return card;
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const seasonDates = sid => [LK.SERIES[sid].from, LK.SERIES[sid].to].map(md => `${+md.slice(3)} ${MONTHS[+md.slice(0, 2) - 1]}`).join(' to ');
// the Halloween tab shows in the season, and whenever there's a Halloween case to open or look owned (and in dev mode)
const seriesShown = sid => DEV || LK.inSeason(sid, localDay()) || LK.SERIES[sid].grades.some(g => LOCK.cases[g]) || LK.seriesItems(sid).some(id => LOCK.owned.includes(id));
function renderLocker() {
  const l = LOCK, waiting = LK.CASE_IDS.reduce((a, g) => a + l.cases[g], 0), hw = seriesShown('halloween');
  if (LOCKV.tab === 'hw' && !hw) LOCKV.tab = 'cases';
  $('#lockMoney').textContent = `${DEV ? 'Test locker: ' : ''}${money(l.money)} to spend · ${waiting} ${waiting === 1 ? 'case' : 'cases'} to open${DEV && DEV_MYTHIC ? ' · next one mythic' : ''}`;
  segControl($('#lockTabs'), [['cases', 'Cases'], ['inv', 'Inventory'], ['shop', 'Shop'], ...(hw ? [['hw', 'Halloween']] : [])], () => LOCKV.tab, v => { LOCKV.tab = v; LOCKV.top = true; lockNote(''); });
  const hb = [...$('#lockTabs').children].find(x => x.textContent === 'Halloween');   // on a phone, a pumpkin rather than the word
  if (hb) { hb.textContent = ''; hb.classList.add('ib'); hb.insertAdjacentHTML('beforeend', '<span class="lab">Halloween</span>'); hb.setAttribute('aria-label', 'Halloween'); setIcon(hb, 'pumpkin'); }
  const body = $('#lockBody'), pager = $('#lockPages'), keep = LOCKV.top ? 0 : body.scrollTop; LOCKV.top = false;
  body.innerHTML = ''; pager.innerHTML = '';
  body.className = LOCKV.tab === 'cases' ? 'caseGrid' : 'lockList';
  if (LOCKV.tab === 'cases') {
    for (const g of LK.GRADE_IDS) body.append(caseCard(g));
    pager.textContent = `Every frame you win against the computer, or in the career, earns a case. Epic or better within ${LK.PITY - l.pity} ${LK.PITY - l.pity === 1 ? 'case' : 'cases'}.`;
    return;
  }
  const pv = mk('button', 'btn', 'Preview'); pv.type = 'button'; pv.id = 'bPreview';
  pv.title = 'See your cloth, cue and gloves at the table, with any look you tapped to try';
  pv.addEventListener('click', () => { sfx('ui'); startPreview(); });
  if (LOCKV.tab === 'hw') {   // the season: its two cases, then each rarity's six looks and reward, then the room for all of them
    const sid = 'halloween', Sx = LK.SERIES[sid], day = localDay(), on = LK.inSeason(sid, day), items = LK.seriesItems(sid), have = items.filter(id => l.owned.includes(id)).length;
    const top = mk('div', 'colHead hwHead'), name = mk('b', '', Sx.name); name.style.color = LK.GRADES.trick.col;
    top.append(name, mk('span', 'colN', on ? `Until ${seasonDates(sid).split(' to ')[1]}` : 'Season over'),
      mk('span', 'colRw', on ? `Your first frame won each day earns a ${LK.GRADES[Sx.daily].name}${l.sdaily === day ? ' (today\'s is yours)' : ''}. Treat cases are bought, and always give a look you don't have yet.` : `Back ${seasonDates(sid).split(' to ')[0]}. The cases you have still open, and the looks are yours for good.`));
    const cards = mk('div', 'caseGrid hwCases'); for (const g of Sx.grades) cards.append(caseCard(g));
    body.append(top, cards);
    for (const r of [...LK.RARITIES].reverse()) {
      const ids = LK.SERIES_POOL[sid][r], n = ids.filter(id => l.owned.includes(id)).length, got = l.claimed.includes(`${sid}:${r}`), h = mk('div', 'colSub'), row = mk('div', 'colRow');
      const rn = mk('span', 'colKind', LK.RARITY[r].name); rn.style.color = LK.RARITY[r].col; h.dataset.c = `${sid}:${r}`;
      h.append(rn, mk('span', 'colN' + (got ? ' done' : ''), got ? `${n}/${ids.length} ✓` : `${n}/${ids.length}`), mk('span', 'colRw', got ? 'Collected' : rewardTxt(Sx.reward[r])));
      for (const id of [...ids].sort(lookSort)) row.append(colTile(id));
      body.append(h, row);
    }
    const all = l.claimed.includes(`${sid}:all`), gh = mk('div', 'colHead'), E = LK.EFFECTS[Sx.grand.fx]; gh.dataset.r = `${sid}:all`;
    gh.append(mk('b', '', `All ${items.length}`), mk('span', 'colN' + (all ? ' done' : ''), all ? '✓' : `${have}/${items.length}`), mk('span', 'colRw', `${all ? 'Complete' : 'Reward'}: ${rewardTxt(Sx.grand)} and the ${E.name}. ${E.txt}`));
    body.append(gh);
    pager.append(mk('span', '', `${have} of ${items.length} ${Sx.name} looks`), pv);
    body.scrollTop = keep; return;
  }
  if (LOCKV.tab === 'inv') {
    const fx = LK.effects(l);
    if (fx.length) {   // the effects collections have earned, each with its switch
      body.append(mk('div', 'invHead', 'Collection rewards'));
      for (const k of fx) {
        const r = k === LK.GRAND.fx ? 4 : LK.RARITIES.findIndex(x => LK.SETS[x].fx === k), row = mk('div', 'invRow fxRow'), on = fxOn(k), sw = mk('button', 'btn', on ? 'On' : 'Off');
        row.style.setProperty('--rc', k === 'haunted' ? LK.GRADES.trick.col : rankCol(r)); row.dataset.fx = k; sw.type = 'button'; sw.setAttribute('aria-pressed', String(on));
        sw.addEventListener('click', () => { S.fxOff = (S.fxOff || []).filter(x => x !== k); if (on) S.fxOff.push(k); saveS(); applyFx(); sfx('ui'); refreshMenus(); });
        row.append(mk('span', 'fxIco', '✦'), mk('span', 'invName', LK.EFFECTS[k].name), sw, mk('span', 'invSub', LK.EFFECTS[k].txt));
        body.append(row);
      }
    }
    const ids = KINDS.flatMap(looksOf).filter(owns).sort(lookSort); let last = null;
    for (const id of ids) { const r = lookRank(id); if (r !== last) { last = r; const h = mk('div', 'invHead', rankName(r)); h.style.color = rankCol(r); body.append(h); } body.append(invRow(id)); }
    pager.append(mk('span', '', `${ids.length} looks, rarest first`), pv);
  } else {
    const sale = mk('div', 'colRow'); for (const it of K.SHOP) sale.append(colTile(it.id));
    const sh = mk('div', 'colHead'); sh.append(mk('b', '', 'For sale'), mk('span', 'colRw', 'Cloths and cues to buy outright. Tap one to buy it, or Cancel to try it on.'));
    body.append(sh, sale);
    for (const r of [...LK.RARITIES].reverse()) {   // a section per rarity: its set's reward, then its three collections
      const S5 = LK.SETS[r], kinds = LK.KINDS.filter(k => l.claimed.includes(r + ':' + k)).length, done = l.claimed.includes(r), h = mk('div', 'colHead');
      const name = mk('b', '', `${LK.RARITY[r].name} set`); name.style.color = LK.RARITY[r].col; h.dataset.r = r;
      h.append(name, mk('span', 'colN' + (done ? ' done' : ''), done ? '3/3 ✓' : `${kinds}/3`),
        mk('span', 'colRw', done ? `Complete: ${LK.EFFECTS[S5.fx].name} is yours (see Inventory).` : `All three: ${money(S5.money)}, ${casesTxt(S5.cases)} and ${LK.EFFECTS[S5.fx].name}: ${LK.EFFECTS[S5.fx].txt.toLowerCase()}`));
      body.append(h);
      for (const k of LK.KINDS) {
        const key = r + ':' + k, C = LK.COLLECTIONS[key], items = LK.colItems(key), have = items.filter(id => l.owned.includes(id)).length, got = l.claimed.includes(key), sub = mk('div', 'colSub'), row = mk('div', 'colRow');
        sub.dataset.c = key; sub.append(mk('span', 'colKind', KIND_HEAD[k]), mk('span', 'colN' + (got ? ' done' : ''), got ? `${have}/${items.length} ✓` : `${have}/${items.length}`), mk('span', 'colRw', got ? 'Collected' : rewardTxt(C)));
        for (const id of [...items].sort(lookSort)) row.append(colTile(id));
        body.append(sub, row);
      }
    }
    const sets = LK.RARITIES.filter(r => l.claimed.includes(r)).length, cols = Object.keys(LK.COLLECTIONS).filter(c => l.claimed.includes(c)).length, all = l.claimed.includes('all'), gh = mk('div', 'colHead'); gh.dataset.r = 'all';
    gh.append(mk('b', '', 'All fifteen'), mk('span', 'colN' + (all ? ' done' : ''), all ? '✓' : `${cols}/15`), mk('span', 'colRw', `${all ? 'Complete' : 'Reward'}: ${money(LK.GRAND.money)} and the ${LK.EFFECTS[LK.GRAND.fx].name}. ${LK.EFFECTS[LK.GRAND.fx].txt}`));
    body.append(gh);
    pager.append(mk('span', '', `${cols} of 15 collections · ${sets} of 5 sets`), pv);
  }
  body.scrollTop = keep;
}
// a compact chooser for Settings: the look in use, with arrows to step through the ones owned
function lookPicker(el, kind) {
  el.innerHTML = ''; const ids = looksOf(kind).filter(owns), i = Math.max(0, ids.indexOf(S[kind]));
  const prev = mk('button', 'btn', '<'), next = mk('button', 'btn', '>'), cur = mk('span', 'pickCur');
  prev.type = next.type = 'button'; prev.setAttribute('aria-label', `Previous ${kind}`); next.setAttribute('aria-label', `Next ${kind}`);
  cur.append(lookIcon(ids[i], 22), mk('span', '', lookName(ids[i])));
  const go = d => { useLook(ids[(i + d + ids.length) % ids.length]); sfx('ui'); refreshMenus(); };
  prev.addEventListener('click', () => go(-1)); next.addEventListener('click', () => go(1));
  el.append(prev, cur, next);
  return ids.length;
}

// Preview: the menu steps aside and the camera circles your cloth, cue and gloves at the table, with any look tapped in
// the locker but not owned tried on in its place. Nothing is saved; tapping anywhere, Esc or Back ends it.
function startPreview() {
  const cue = world.balls[0]; if (PREV.on || state !== 'menu' || cue.potted) return;
  const looks = {}; for (const k of ['cloth', 'cue', 'glove']) looks[k] = LOCKV.try[k] || S[k];
  const near = world.balls.filter(b => b.id && !b.potted).sort((a, b) => Math.hypot(a.x - cue.x, a.z - cue.z) - Math.hypot(b.x - cue.x, b.z - cue.z))[0];
  Object.assign(PREV, { on: true, looks, cam: cam.mode, aim: { ...aim }, t0: performance.now() });
  aim.phi = near ? Math.atan2(near.z - cue.z, near.x - cue.x) : 0; aim.power = 0.35; aim.sx = aim.sy = 0;   // lined up on the nearest ball
  cam.mode = 'show'; setCloth();
  const trying = ['cloth', 'cue', 'glove'].filter(k => !owns(looks[k])).map(k => lookName(looks[k]));
  $('#prevTxt').textContent = `${['cloth', 'cue', 'glove'].map(k => lookName(looks[k])).join(' · ')}${trying.length ? `. Trying on ${trying.join(' and ')}` : ''}. Tap anywhere to go back.`;
  $('#menu').hidden = true; $('#preview').hidden = false; $('#bPrevBack').focus({ preventScroll: true });
}
function endPreview() {
  if (!PREV.on) return;
  PREV.on = false; cam.mode = PREV.cam; Object.assign(aim, PREV.aim); setCloth();
  $('#preview').hidden = true; $('#menu').hidden = false; const b = $('#bPreview'); if (b) b.focus({ preventScroll: true });
  purse();
}
$('#preview').addEventListener('click', () => { sfx('ui'); endPreview(); });

// opening a case: the locker pays and picks the prize first (looks.js), then the reel spins to it. The other items on
// the reel are drawn from the case's own odds, and where the marker stops within the prize's tile is random, so the
// reel never fakes a near miss.
const REEL = { anim: 0, res: null, grade: null, at: 40 };
function openCaseUI(g) {
  const G = LK.GRADES[g];
  if (!LOCK.cases[g]) { lockNote(G.series ? `No ${G.name}s yet. ${G.fresh ? 'Buy one' : 'Win a frame today, or buy one'} in the ${LK.SERIES[G.series].name} season (${seasonDates(G.series)}).` : `No ${G.name.toLowerCase()}s yet. ${g === 'diamond' ? 'Beat the Expert computer, win events on the national tour, or buy one.' : 'Win frames against the computer or career events, or buy one.'}`); return; }
  if (LOCK.money < G.open) { lockNote(`Opening a ${G.name.toLowerCase()} costs ${money(G.open)}: you need ${money(G.open - LOCK.money)} more.`); return; }
  const force = DEV && DEV_MYTHIC ? 'mythic' : null, r = lockerEdit(l => { const m = l.money, res = LK.openCase(l, g, Math.random, force); if (typeof res === 'object') res.left = m - G.open; return res; });
  if (typeof r === 'string') { refreshMenus(); return; }   // another open page got there first
  if (force) DEV_MYTHIC = false;   // once only
  PURSE.hold = r.left; purse();   // the counter shows the cost now, and any sale or reward once the reel stops
  ensureAudio(); showReel(g, r);
}
function reelTile(id) {   // in its rarity's colour, from a dark shade at the top to the full colour at the bottom
  const t = mk('div', 'reelTile'), it = LK.ALL[id], col = LK.RARITY[it.rarity].col;
  t.dataset.r = it.rarity;
  t.style.borderColor = col; t.style.background = `linear-gradient(${shade(col, 0.22)}, ${shade(col, 0.5)} 45%, ${shade(col, 0.9)})`;
  t.append(lookIcon(id, 34)); return t;
}
function showReel(g, r) {
  const strip = $('#reelStrip'), items = LK.reelItems(g, REEL.at + 6, Math.random); items[REEL.at] = r.id;
  REEL.res = r; REEL.grade = g; strip.innerHTML = ''; strip.style.transform = 'translateX(0)';
  for (const id of items) strip.append(reelTile(id));
  const title = $('#reelTitle'); title.textContent = LK.GRADES[g].name; title.style.color = ''; title.classList.remove('big');
  $('#reelTxt').textContent = 'Tap the reel to skip'; $('#reelBtns').hidden = true; $('#reel').hidden = false; $('.reelPanel').classList.remove('shake');
  const tw = strip.children[1].offsetLeft - strip.children[0].offsetLeft, win = $('#reelWin').clientWidth;
  REEL.end = REEL.at * tw + tw / 2 - win / 2 + (Math.random() - 0.5) * tw * 0.7; REEL.tw = tw; REEL.win = win;
  fxStart(-1, ['#6d5a96']);
  if (reduceMotion) { reelDone(); return; }
  const T = 7000, t0 = performance.now(); let last = 0;
  const step = now => {
    const u = Math.min(1, (now - t0) / T), x = REEL.end * (1 - Math.pow(1 - u, 4.5));   // a long, slow crawl at the end
    strip.style.transform = `translateX(${-x}px)`;
    const k = Math.floor((x + win / 2) / tw); if (k !== last) { last = k; blipTick(); }
    if (u < 1) REEL.anim = requestAnimationFrame(step); else reelDone();
  };
  REEL.anim = requestAnimationFrame(step);
}
const blipTick = () => { if (S.volume && AU.ctx) try { blip(1400, 0.02, 0.035, 'square'); } catch (e) {} };
// a look's own main colour, for the show behind the reel
const lookCol = it => it.kind === 'cloth' ? it.col2 || it.col : it.kind === 'cue' ? it.pc || it.col.fore : it.base;
function reelDone() {
  if (!REEL.res || $('#reelBtns').hidden === false) return;
  cancelAnimationFrame(REEL.anim); REEL.anim = 0;
  const r = REEL.res, it = LK.ALL[r.id], R = LK.RARITY[r.rarity], tier = LK.RARITIES.indexOf(r.rarity), strip = $('#reelStrip'), tile = strip.children[REEL.at];
  strip.style.transform = `translateX(${-REEL.end}px)`; tile.classList.add('won'); tile.style.setProperty('--glow', R.col);
  const txt = $('#reelTxt'); txt.innerHTML = ''; const rr = mk('span', 'reelRarity', R.name); rr.style.color = R.col;
  txt.append(rr, mk('span', '', `${it.kind[0].toUpperCase() + it.kind.slice(1)}: ${it.name}. ${r.dup ? `Already yours, so it's sold for ${money(r.sold)}.` : 'New!'}`));
  if (r.done && r.done.length) { txt.append(mk('span', 'reelCol', doneTxt(r.done))); applyFx(); }
  if (tier >= 3) { const title = $('#reelTitle'); title.textContent = `${R.name}!`; title.style.color = R.col; title.classList.add('big'); }
  if (tier >= 4 && !reduceMotion) $('.reelPanel').classList.add('shake');
  const b = tile.getBoundingClientRect(), cols = tier === 4 ? ['#ff3b3b', '#ff4fd8', '#ff9a1f', '#ffd36b', lookCol(it)] : [R.col, lookCol(it), R.col];
  fxStart(tier, cols, [b.left + b.width / 2, b.top + b.height / 2]);
  sfx('fanfare', tier);
  const g = REEL.grade; $('#bReelUse').hidden = r.dup || S[it.kind] === r.id;
  $('#bReelAgain').hidden = !(LOCK.cases[g] > 0 && LOCK.money >= LK.GRADES[g].open); $('#bReelAgain').textContent = `Open another (${money(LK.GRADES[g].open)})`;
  $('#reelBtns').hidden = false; $(r.dup ? '#bReelDone' : '#bReelUse').focus();
  PURSE.hold = null; refreshMenus();
}
function closeReel() { if (REEL.anim) reelDone(); $('#reel').hidden = true; REEL.res = null; PURSE.hold = null; fxStop(); refreshMenus(); }

// The money counter in the menus' top-right corner (#bMoney): the locker's money, counting up or down to each new
// amount, with the change drifting in under it (money in) or falling away (money out). Money earned in a game is
// counted in on the way back to the menu. While a case's reel spins, it holds at what's left after paying to open the
// case (PURSE.hold), so it never gives away a duplicate's sale early. Tapping it opens the locker.
const PURSE = { shown: null, to: null, hold: null, raf: 0 };
function purse() {
  const b = $('#bMoney'), amt = $('#moneyAmt'), to = PURSE.hold !== null ? PURSE.hold : LOCK.money;
  b.classList.toggle('dev', DEV); b.title = DEV ? 'Test locker' : 'Locker';
  b.setAttribute('aria-label', `${money(to)}${DEV ? ' in the test locker' : ''}. Open the locker`);
  if ($('#menu').hidden || to === PURSE.to) return;   // out of sight: counted in when the menu comes back
  const from = PURSE.shown, ch = to - PURSE.to, d = to - from; PURSE.to = to;   // ch: the change itself; d: what's left to count (less, mid-count)
  cancelAnimationFrame(PURSE.raf); PURSE.raf = 0; for (const e of b.querySelectorAll('.moneyDelta')) e.remove();
  if (from === null || !d || reduceMotion) { PURSE.shown = to; amt.textContent = money(to); b.classList.remove('gain', 'spend'); return; }
  b.classList.toggle('gain', ch > 0); b.classList.toggle('spend', ch < 0);
  const f = mk('span', 'moneyDelta ' + (ch > 0 ? 'up' : 'down'), (ch > 0 ? '+' : '-') + money(Math.abs(ch))); b.append(f);   // a hyphen: the pixel font has no minus sign
  f.animate(ch > 0 ? [{ transform: 'translateY(14px)', opacity: 0 }, { transform: 'translateY(6px)', opacity: 1, offset: 0.3 }, { transform: 'translateY(0)', opacity: 0 }]
    : [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(6px)', opacity: 1, offset: 0.3 }, { transform: 'translateY(18px)', opacity: 0 }], { duration: 1600, easing: 'ease-out' }).onfinish = () => f.remove();
  const T = Math.min(1400, 500 + 160 * Math.log10(Math.abs(d))), t0 = performance.now();   // bigger sums take a little longer
  const step = now => {
    const u = Math.min(1, (now - t0) / T); PURSE.shown = Math.round(from + d * (1 - Math.pow(1 - u, 3))); amt.textContent = money(PURSE.shown);
    if (u < 1) PURSE.raf = requestAnimationFrame(step); else { PURSE.raf = 0; b.classList.remove('gain', 'spend'); }
  };
  PURSE.raf = requestAnimationFrame(step);
}
$('#bMoney').addEventListener('click', () => { if (state !== 'menu' || !$('#reel').hidden || menuScreen() === 'locker') return; ensureAudio(); sfx('ui'); lockNote(''); menuGo('locker'); });

// The show behind the reel, drawn small and scaled up like the game. While the reel spins, a few faint stripes drift
// in the dark. When it stops, stripes in the prize's colours bounce round the screen, more of them and livelier the
// rarer it is: sparkles from epic, turning rays from legendary, and for a mythic, shifting colours, rings and confetti.
// Nothing flashes: brightness only ever changes smoothly and slowly. With reduced motion it's one still picture.
const FX = { raf: 0, tier: -1, stripes: [], parts: [], cols: [], last: 0, t0: 0, spawn: 0 };
const fxRgba = (c, a) => `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
function fxStart(tier, cols, at) {
  const c = $('#reelFx'), W = c.width = Math.ceil(innerWidth / 4), H = c.height = Math.ceil(innerHeight / 4), r = Math.random, d = Math.hypot(W, H);
  Object.assign(FX, { tier, W, H, t0: performance.now(), last: performance.now(), spawn: 0, cols: cols.map(h => new THREE.Color(h)), parts: [] });
  const n = tier < 0 ? 5 : [5, 8, 12, 18, 26][tier], sp = tier < 0 ? 5 : [14, 26, 40, 58, 80][tier];
  FX.stripes = Array.from({ length: n }, (_, i) => ({ x: r() * W, y: r() * H, a: r() * Math.PI, va: (r() - 0.5) * (tier >= 2 ? 0.5 : 0.12),
    vx: (r() - 0.5) * 2 * sp, vy: (r() - 0.5) * 2 * sp, len: (0.25 + r() * 0.35) * d, th: 2 + r() * (2 + 2 * Math.max(0, tier)), ci: i % cols.length, ph: r() * 6.28,
    al: tier < 0 ? 0.05 : 0.16 + 0.07 * tier + r() * 0.08 }));
  if (tier >= 0 && at) for (let i = 0; i < [10, 22, 40, 70, 120][tier]; i++) {   // a burst from the prize
    const a = r() * 6.28, s = (20 + r() * 60) * (1 + tier * 0.4); FX.parts.push({ x: at[0] / 4, y: at[1] / 4, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.8 + r() * 1.4, age: 0, ci: i % cols.length, sz: 1 + (r() * 2 | 0), kind: 'burst' });
  }
  cancelAnimationFrame(FX.raf); FX.raf = requestAnimationFrame(fxFrame);
}
function fxStop() { cancelAnimationFrame(FX.raf); FX.raf = 0; }
function fxCol(i, t) {   // a mythic's colours drift from one to the next; everything else keeps its own
  const cs = FX.cols; if (FX.tier < 4) return cs[i % cs.length];
  const k = (i * 0.37 + Math.max(0, t) * 0.35) % cs.length, a = cs[Math.floor(k)], b = cs[(Math.floor(k) + 1) % cs.length];
  return a.clone().lerp(b, k % 1);
}
function fxFrame(now) {
  if ($('#reel').hidden) { FX.raf = 0; return; }
  const c = $('#reelFx'), g = c.getContext('2d'), { W, H, tier } = FX, dt = clamp((now - FX.last) / 1000, 0, 0.05), t = Math.max(0, now - FX.t0) / 1000, r = Math.random;
  FX.last = Math.max(FX.last, now); const move = reduceMotion ? 0 : dt;
  g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);   // the dim itself is #reel's background, so the room shows faintly
  g.globalCompositeOperation = 'lighter';
  if (tier >= 0) {   // a glow behind the reel, breathing slowly
    const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.65);
    gr.addColorStop(0, fxRgba(fxCol(0, t), (0.1 + 0.08 * tier) * (0.85 + 0.15 * Math.sin(t * 1.8)))); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  if (tier >= 3) {   // rays turning round the centre
    g.save(); g.translate(W / 2, H / 2); g.rotate(reduceMotion ? 0 : t * (tier === 4 ? 0.3 : 0.15));
    for (let i = 0; i < 14; i++) { g.rotate(Math.PI * 2 / 14); g.fillStyle = fxRgba(fxCol(i, t), tier === 4 ? 0.09 : 0.06); g.beginPath(); g.moveTo(0, 0); g.lineTo(W, -W * 0.08); g.lineTo(W, W * 0.08); g.fill(); }
    g.restore();
  }
  for (const s of FX.stripes) {   // the stripes, bouncing off the edges of the screen
    s.x += s.vx * move; s.y += s.vy * move; s.a += s.va * move;
    if (s.x < 0 || s.x > W) { s.vx = -s.vx; s.x = clamp(s.x, 0, W); }
    if (s.y < 0 || s.y > H) { s.vy = -s.vy; s.y = clamp(s.y, 0, H); }
    g.save(); g.translate(s.x, s.y); g.rotate(s.a); g.fillStyle = fxRgba(fxCol(s.ci, t), s.al * (0.85 + 0.15 * Math.sin(t * 1.3 + s.ph))); g.fillRect(-s.len / 2, -s.th / 2, s.len, s.th); g.restore();
  }
  if (tier === 4) for (let k = 0; k < 2; k++) {   // rings spreading from the centre, one every 1.6 s
    const u = ((reduceMotion ? 0.3 : t) / 1.6 + k / 2) % 1; g.strokeStyle = fxRgba(fxCol(k, t), 0.45 * (1 - u)); g.lineWidth = 2 + 3 * (1 - u);
    g.beginPath(); g.arc(W / 2, H / 2, u * Math.max(W, H) * 0.75, 0, 7); g.stroke();
  }
  if (tier >= 2 && !reduceMotion) {   // new sparkles (and for a mythic, confetti from the top)
    FX.spawn += dt * [0, 0, 10, 18, 30][tier];
    while (FX.spawn >= 1) { FX.spawn--; FX.parts.push({ x: r() * W, y: r() * H, vx: 0, vy: 0, life: 1 + r(), age: 0, ci: r() * 9 | 0, sz: 1, kind: 'spark' });
      if (tier === 4) FX.parts.push({ x: r() * W, y: -4, vx: (r() - 0.5) * 20, vy: 25 + r() * 30, life: 6, age: 0, ci: r() * 9 | 0, sz: 2, kind: 'confetti', a: r() * 6 }); }
  }
  FX.parts = FX.parts.filter(p => (p.age += move) < p.life && p.y < H + 8);
  for (const p of FX.parts) {
    const k = p.age / p.life, col = fxCol(p.ci, t);
    if (p.kind === 'burst') { p.vx *= 1 - 1.5 * move; p.vy *= 1 - 1.5 * move; p.x += p.vx * move; p.y += p.vy * move; g.fillStyle = fxRgba(col, 0.9 * (1 - k)); g.fillRect(p.x, p.y, p.sz, p.sz); }
    else if (p.kind === 'spark') { const a = Math.sin(Math.PI * k); g.fillStyle = fxRgba(col, 0.8 * a); g.fillRect(p.x - 1, p.y, 3, 1); g.fillRect(p.x, p.y - 1, 1, 3); }
    else { p.x += p.vx * move; p.y += p.vy * move; p.a += move * 4; g.fillStyle = fxRgba(col, 0.75); g.fillRect(p.x, p.y, 1 + Math.abs(Math.cos(p.a)) * 2, 2); }
  }
  FX.raf = reduceMotion ? 0 : requestAnimationFrame(fxFrame);
}
$('#reelWin').addEventListener('click', () => { if (REEL.anim) reelDone(); });
$('#bReelUse').addEventListener('click', () => { const id = REEL.res && REEL.res.id; closeReel(); if (id) { useLook(id); lockNote(`${LK.ALL[id].name} is in use.`); refreshMenus(); } });
$('#bReelAgain').addEventListener('click', () => { const g = REEL.grade; $('#reel').hidden = true; REEL.res = null; openCaseUI(g); });
$('#bReelDone').addEventListener('click', closeReel);
$('#cShop').addEventListener('click', () => { sfx('ui'); lockNote(''); menuGo('locker'); });

// ------------------------------------------------------------------ online play
// Each browser runs the full game. Only shot inputs travel over the network; the receiving browser
// re-checks every shot itself, and the shooter's final table is used as a cross-check.
function relayBase() {
  let u = '';
  try { u = new URLSearchParams(location.search).get('relay') || ''; } catch (e) {}
  u = String(u || window.RETRO_RACK_RELAY || '').trim().replace(/\/+$/, '');
  if (!u) return '';
  if (u.startsWith('https://')) u = 'wss://' + u.slice(8);
  else if (u.startsWith('http://')) u = 'ws://' + u.slice(7);
  else if (!/^wss?:\/\//.test(u)) u = 'wss://' + u;
  return u;
}
const CODE_CH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newCode(n = 5) { const a = new Uint32Array(n); crypto.getRandomValues(a); return Array.from(a, v => CODE_CH[v % CODE_CH.length]).join(''); }
const cleanCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
const cleanName = (s, d = 'Friend') => String(s || '').replace(/[<>]/g, '').trim().slice(0, 14) || d;
function getCid() { try { let c = sessionStorage.getItem('rr.cid'); if (!c) { c = newCode(12); sessionStorage.setItem('rr.cid', c); } return c; } catch (e) { return newCode(12); } }
// "Duplicate tab" copies sessionStorage, player id included, and two tabs with one id fight over one seat.
// An open page marks the id as in use until it closes, so a copy made while the original is still open
// sees the mark and picks a fresh id. A reload clears the mark first, so it keeps its seat.
try {
  if (sessionStorage.getItem('rr.live') === '1') sessionStorage.removeItem('rr.cid');
  sessionStorage.setItem('rr.live', '1');
  const mark = v => { try { sessionStorage.setItem('rr.live', v); } catch (e) {} };
  addEventListener('pagehide', () => mark('0'));
  addEventListener('pageshow', e => { if (e.persisted) mark('1'); });
  // phones may unload a background tab after freezing it, with no pagehide; coming back is then a reload, not a copy
  document.addEventListener('freeze', () => mark('0'));
  document.addEventListener('resume', () => mark('1'));
} catch (e) {}
function netSend(o) { if (NET.ws && NET.ws.readyState === 1) NET.ws.send(JSON.stringify(o)); }
function sendHello() { netSend({ t: 'hello', name: NET.myName, started: NET.started, n: NET.n, v: BUILD, cue: S.cue, cloth: S.cloth, glove: S.glove }); }
// looks: each player's cue is shown on both screens, and the table wears the host's cloth (the host is seat 0).
// Ids from the other player are checked against the known designs; anything else falls back to the defaults.
const lookCue = id => kindOf(id) === 'cue' ? id : 'house';
const lookGlove = id => kindOf(id) === 'glove' ? id : 'none';
const lookCloth = id => K.has(CLOTHS, id) ? id : null;
function takeLooks(m) { NET.peerCue = lookCue(m.cue); NET.peerGlove = lookGlove(m.glove); if (NET.seat === 1) { NET.cloth = lookCloth(m.cloth); setCloth(); } }
function sendLook() { if (NET.on) netSend({ t: 'look', cue: S.cue, cloth: S.cloth, glove: S.glove }); }
function netConnect() {
  let ws;
  const listQ = NET.list && !NET.started ? `&list=1&name=${encodeURIComponent(NET.myName)}&mode=${encodeURIComponent(M.mode)}` : '';
  try { ws = new WebSocket(`${relayBase()}/room/${NET.code}?cid=${NET.cid}${listQ}`); }
  catch (e) { lobbyStatus("Couldn't reach the relay. Check the relay address in the file."); return; }
  NET.ws = ws; NET.link = 'connecting'; updateNetBadge();
  ws.onopen = () => { NET.retry = 0; };
  ws.onmessage = e => { if (e.data === 'pong') return; let m; try { m = JSON.parse(e.data); } catch (err) { return; } onNet(m); };
  ws.onclose = ev => {
    if (NET.ws === ws) NET.ws = null;
    if (!NET.on || ev.code === 4000 || ev.code === 4001) return;
    NET.link = 'reconnecting'; updateNetBadge();
    lobbyStatus(NET.retry > 2 ? "Still can't reach the relay. Check your connection and the relay address." : 'Connecting…');
    const d = Math.min(8000, 600 * Math.pow(2, NET.retry++));
    clearTimeout(NET.timer); NET.timer = setTimeout(() => { if (NET.on && !NET.ws) netConnect(); }, d);
  };
}
setInterval(() => { if (NET.ws && NET.ws.readyState === 1) NET.ws.send('ping'); }, 20000);
function onNet(m) {
  switch (m.t) {
    case 'welcome':
      NET.seat = m.seat === 1 ? 1 : 0; NET.peer = !!m.peer; NET.link = 'online'; updateNetBadge();
      lobbyStatus(NET.peer ? 'Connected. Starting…' : waitText());
      if (NET.peer) sendHello();
      if (state !== 'lobby') updateHUD();
      break;
    case 'full':
      clearRejoin();
      leaveOnline(); toMenu(); menuNote('That room already has two players in it.'); break;
    case 'peer':
      NET.peer = !!m.on; updateNetBadge();
      if (m.on) sendHello();
      else if (NET.started) toast(`${NET.peerName} disconnected. Waiting for them to come back`, 'foul');
      else lobbyStatus(waitText());
      break;
    case 'hello':
      NET.peerName = cleanName(m.name); NET.peer = true; updateNetBadge(); takeLooks(m);
      // versions before this check sent no version, so a missing one means an older copy
      NET.peerVer = typeof m.v === 'string' ? m.v.slice(0, 16) : '';
      NET.verWarn = '';
      if (NET.peerVer !== BUILD) {
        const why = NET.peerVer ? `You and ${NET.peerName} have different versions of Retro Rack.` : `${NET.peerName} has an older version of Retro Rack.`;
        if (!NET.started && !m.started) {   // nothing to lose yet, so don't start a game that might not match
          lobbyStatus(`${why} ${NET.peerVer ? 'Both of you reload' : 'Ask them to reload'} it to get the latest (Ctrl+F5 on a computer, or close and reopen it on a phone), then come back to room ${NET.code}.`);
          break;
        }
        // mid-game: carry on (the after-shot cross-check keeps the tables matched) but say so
        NET.verWarn = `${why} If the tables stop matching, reload it (Ctrl+F5 on a computer, or close and reopen it on a phone) and come back to room ${NET.code}.`;
        if (NET.started) toast(NET.verWarn, 'foul');   // a player rejoining sees it once the table is back (adoptState)
      }
      if (NET.started) netSendState();
      else if (NET.seat === 0 && !m.started) hostStart();
      else lobbyStatus(`Connected to ${NET.peerName}. Starting…`);
      if (state !== 'lobby') updateHUD();
      break;
    case 'setup': if (NET.seat === 1 && (NET.started || NET.peerVer === BUILD)) startOnlineGame(m); break;
    case 'state': adoptState(m); break;
    case 'look': takeLooks(m); break;
    case 'aim': if (state === 'remote') NET.aimT = m; break;
    case 'shot': if (typeof m.n === 'number') { NET.queue.push(m); NET.queue.sort((a, b) => a.n - b.n); netProcessQueue(); } break;
    case 'sync': if (typeof m.n === 'number' && Array.isArray(m.balls) && m.game) { NET.pendingSync[m.n] = m; netCheckSync(); } break;
    case 'again': NET.again[1 - NET.seat] = true; tryRematch(); break;
    case 'bye': NET.peer = false; updateNetBadge(); clearRejoin(); toast(`${NET.peerName} left the game`, 'foul'); break;
    case 'chat': if (Number.isInteger(m.i) && CHAT[m.i]) { toast(`${NET.peerName}: ${CHAT[m.i]}`, 'chat'); sfx('ui'); } break;
    case 'concede':
      if (state === 'moving' || state === 'stroke') NET.pendingConcede = m.from === 1 ? 1 : 0;
      else concedeFrame(true, m.from === 1 ? 1 : 0);
      break;
    case 'rerackOffer': if (!game.over) { $('#offerTxt').textContent = `${NET.peerName} offers a re-rack. This frame won't count.`; $('#offer').hidden = false; } break;
    case 'rerackYes': toast(`${NET.peerName} accepted the re-rack`, 'good'); if (NET.seat === 0) hostStart(); break;
    case 'rerackNo': toast(`${NET.peerName} declined the re-rack`, 'info'); break;
  }
}
function menuNote(t) { $('#netNote').textContent = t; }
function lobbyStatus(t) { $('#lobbyStatus').textContent = t; }
function inviteLink() { return location.href.split('#')[0] + '#room=' + NET.code; }
function startOnline(code, listed = false, rejoin = null) {
  if (!relayBase()) { menuNote('Online play needs your relay address first. Paste it into config.js, next to this file (the README explains how).'); return; }
  if (!code || code.length < 4) { menuNote('Room codes are 5 letters and numbers.'); return; }
  NET.on = true; NET.code = code; NET.cid = getCid(); NET.myName = cleanName($('#netName').value, 'Player'); NET.peerName = 'Friend';
  try { localStorage.setItem('retroRack.name', NET.myName); } catch (e) {}
  holdSeat();
  Object.assign(NET, { started: false, n: 0, games: 0, queue: [], pendingSync: {}, again: [false, false], retry: 0, peer: false, peerVer: '', verWarn: '', aimT: null, stateAfter: false, list: listed, rejoin, cloth: null, peerCue: 'house' });
  matchWins = [0, 0]; M.opp = 'online'; saveM(); menuNote(''); NAV.lastOnline = true;
  try { history.replaceState(null, '', '#room=' + code); } catch (e) {}
  state = 'lobby'; $('#menu').hidden = true; $('#lobby').hidden = false; armBack();
  $('#lobbyCode').textContent = code; $('#lobbyLink').value = inviteLink();
  $('#lobbyNote').textContent = listed
    ? 'Your room is listed under Open rooms, so friends can join from there. They can also use the link or the code.'
    : 'This room is private. Your friend can open the link, or type the code into Join with code.';
  lobbyStatus('Connecting…'); updateLobbyWatch(); netConnect();
}
function leaveOnline() {
  if (!NET.on) return;
  netSend({ t: 'bye' });
  NET.on = false; NET.started = false; clearTimeout(NET.timer); freeSeat(); NET.cloth = null; NET.peerCue = 'house'; NET.peerGlove = 'none'; setCloth();
  const ws = NET.ws; NET.ws = null; if (ws) { try { ws.close(1000, 'bye'); } catch (e) {} }
  try { history.replaceState(null, '', location.href.split('#')[0]); } catch (e) {}
  $('#lobby').hidden = true; $('#thinking').hidden = true; updateNetBadge();
}
function showGameUI() {
  armBack();
  $('#menu').hidden = true; $('#over').hidden = true; $('#lobby').hidden = true; $('#hud').hidden = false; $('#practice').hidden = true;
  if (cam.mode === 'attract') { cam.mode = 'free'; cam.free.dist = 3.1 * Math.pow(P.L / 2.54, 0.9); }
  toastClear();
}
function hostStart() {
  if (M.mode === 'practice') M.mode = '8ball';
  applyTable(tableKeyFor());
  const balls = (M.mode === '9ball' ? C.rack9 : C.rack8)();
  const setup = { t: 'setup', mode: M.mode, guide: M.guide === 'auto' ? 'ghost' : M.guide,
    balls: balls.map(b => [b.id, b.x, b.z]), breaker: NET.games % 2, wins: matchDone() ? [0, 0] : [...matchWins], raceTo: M.race || 0, blackOne: !!M.blackOne };
  netSend(setup); startOnlineGame(setup);
}
function startOnlineGame(m) {
  if (!['8ball', '9ball', 'uk8'].includes(m.mode) || !Array.isArray(m.balls)) return;
  M.mode = m.mode; NET.guide = GUIDE_TXT[m.guide] ? m.guide : 'ghost';
  applyTable(tableKeyFor());
  world = C.makeWorld(m.balls.map(([id, x, z]) => C.newBall(id, x, z))); world.ev = [];
  game = C.newGame(m.mode); game.turn = m.breaker === 1 ? 1 : 0; if (m.mode === 'uk8') game.oneVisitOnBlack = !!m.blackOne;
  matchWins = Array.isArray(m.wins) ? [...m.wins] : [0, 0];
  NET.raceTo = [0, 3, 5, 7].includes(m.raceTo) ? m.raceTo : 0;
  lastShot = null; endReplayNow(); $('#offer').hidden = true;
  shots = [0, 0]; undoStack = []; potAnims = []; acc = 0; stroke = null; bot = null; botAim = null; remoteStrike = null;
  Object.assign(NET, { n: 0, started: true, queue: [], pendingSync: {}, again: [false, false], aimT: null });
  syncBallMeshes(); aim.sx = aim.sy = 0; aim.power = 0.88;
  showGameUI();
  toast(isYou(game.turn) ? 'Your break' : `${NET.peerName} to break`, 'info');
  beginTurn(); saveRejoin();
}
function snapshot() {
  return { balls: world.balls.map(b => [b.id, b.x, b.z, b.potted ? 1 : 0]), game: { ...game, groups: [...game.groups] }, shots: [...shots], wins: [...matchWins] };
}
function applySnapshot(m) {
  world = C.makeWorld(m.balls.map(([id, x, z, p]) => { const b = C.newBall(id, x, z); b.potted = !!p; return b; })); world.ev = [];
  game = { ...m.game, groups: [...m.game.groups] };
  if (Array.isArray(m.shots)) shots = [...m.shots];
  if (Array.isArray(m.wins)) matchWins = [...m.wins];
  potAnims = []; stroke = null; remoteStrike = null; acc = 0; syncBallMeshes();
}
function netSendState() {
  if (state === 'moving' || state === 'stroke') { NET.stateAfter = true; return; }
  netSend({ t: 'state', n: NET.n, mode: M.mode, guide: NET.guide, raceTo: NET.raceTo || 0, ...snapshot() });
}
function adoptState(m) {
  if (NET.started && !(m.n > NET.n)) return;
  if (!['8ball', '9ball', 'uk8'].includes(m.mode) || !Array.isArray(m.balls) || !m.game) return;
  M.mode = m.mode; NET.guide = GUIDE_TXT[m.guide] ? m.guide : NET.guide; applyTable(tableKeyFor());
  if ([0, 3, 5, 7].includes(m.raceTo)) NET.raceTo = m.raceTo;
  endReplayNow();
  applySnapshot(m);
  NET.n = m.n; NET.started = true; NET.queue = NET.queue.filter(q => q.n > m.n); NET.pendingSync = {};
  showGameUI(); toast(`Back in the game with ${NET.peerName}`, 'good');
  if (NET.verWarn) toast(NET.verWarn, 'foul');
  if (game.over) { state = 'over'; updateHUD(); showOver(null, -1); } else beginTurn();
  saveRejoin();
}
function netAfterShot(shooter) {
  saveRejoin();
  if (NET.pendingConcede === 0 || NET.pendingConcede === 1) { const l = NET.pendingConcede; NET.pendingConcede = null; setTimeout(() => concedeFrame(true, l), 0); }
  if (shooter === NET.seat) netSend({ t: 'sync', n: NET.n, ...snapshot() });
  else netCheckSync();
  if (NET.stateAfter) { NET.stateAfter = false; netSendState(); }
}
function sameTable(m) {
  if (m.balls.length !== world.balls.length) return false;
  for (let i = 0; i < m.balls.length; i++) {
    const [id, x, z, p] = m.balls[i], b = world.balls[i];
    if (b.id !== id || !!p !== b.potted) return false;
    if (!b.potted && (Math.abs(b.x - x) > 1e-6 || Math.abs(b.z - z) > 1e-6)) return false;
  }
  const g = m.game;
  return g.turn === game.turn && !!g.over === !!game.over && g.groups[0] === game.groups[0] && g.groups[1] === game.groups[1]
    && !!g.ballInHand === !!game.ballInHand && (g.visits || 1) === (game.visits || 1);
}
function netCheckSync() {
  if (!NET.on || state === 'moving' || state === 'stroke') return;
  for (const k of Object.keys(NET.pendingSync)) {
    const n = +k, m = NET.pendingSync[k];
    if (n > NET.n) continue;
    delete NET.pendingSync[k];
    if (n < NET.n || sameTable(m)) continue;
    applySnapshot(m);
    toast(`The tables didn't match after that shot, so yours was synced to ${NET.peerName}'s`, 'foul');
    if (game.over) { state = 'over'; updateHUD(); showOver(null, -1); } else beginTurn();
  }
}
function netProcessQueue() {
  while (NET.queue.length && NET.queue[0].n <= NET.n) NET.queue.shift();
  if (state !== 'remote' || !NET.queue.length || NET.queue[0].n !== NET.n + 1) return;
  applyRemoteShot(NET.queue.shift());
}
function applyRemoteShot(m) {
  const s = m.s || {}, num = v => typeof v === 'number' && isFinite(v);
  if (!num(s.phi) || !num(s.power) || !num(s.sx) || !num(s.sy)) return;
  const shot = { phi: wrapA(s.phi), power: clamp(s.power, 0.02, 1), sx: s.sx, sy: s.sy };
  const l = Math.hypot(shot.sx, shot.sy); if (l > 1) { shot.sx /= l; shot.sy /= l; }
  const cue = world.balls[0];
  if (game.ballInHand) {
    if (!Array.isArray(m.cue) || !num(m.cue[0]) || !num(m.cue[1]) || !C.validSpot(world.balls, m.cue[0], m.cue[1], 0, game.kitchen)) {
      toast(`Ignored a cue ball placement from ${NET.peerName} that breaks the rules`, 'foul'); return;
    }
    cue.x = m.cue[0]; cue.z = m.cue[1];
  }
  // the input-only check: recompute the strike here and only accept the sender's numbers if they agree
  const t = { ...cue }; C.strike(t, shot);
  const mine = [t.vx, t.vz, t.wx, t.wy, t.wz];
  let v = m.v;
  const ok = Array.isArray(v) && v.length === 5 && v.every((x, i) => num(x) && Math.abs(x - mine[i]) <= 1e-6 * Math.max(1, Math.abs(mine[i])));
  if (!ok) { v = mine; toast(`That shot's data didn't add up, so your game worked it out itself`, 'foul'); }
  Object.assign(aim, shot); NET.aimT = null; remoteStrike = v;
  beginStroke();
}
function netTick(now, dt) {
  if (!NET.on || !NET.started) return;
  if (state === 'aim' && humanTurn() && now - NET.lastAim > 80) {
    const cue = world.balls[0];
    const sig = `${aim.phi.toFixed(5)}|${aim.power.toFixed(4)}|${aim.sx.toFixed(3)}|${aim.sy.toFixed(3)}|${game.ballInHand ? cue.x.toFixed(4) + ',' + cue.z.toFixed(4) : ''}`;
    if (sig !== NET.aimSig) {
      NET.aimSig = sig; NET.lastAim = now;
      netSend({ t: 'aim', phi: aim.phi, power: aim.power, sx: aim.sx, sy: aim.sy, cue: game.ballInHand ? [cue.x, cue.z] : null });
    }
  }
  if (state === 'remote' && NET.aimT) {
    const t = NET.aimT, k = 1 - Math.exp(-dt * 14), n = v => typeof v === 'number' && isFinite(v);
    if (n(t.phi)) aim.phi = wrapA(aim.phi + wrapA(t.phi - aim.phi) * k);
    if (n(t.power)) aim.power = lerp(aim.power, clamp(t.power, 0, 1), k);
    if (n(t.sx) && n(t.sy)) { aim.sx = lerp(aim.sx, clamp(t.sx, -1, 1), k); aim.sy = lerp(aim.sy, clamp(t.sy, -1, 1), k); }
    if (game.ballInHand && Array.isArray(t.cue) && n(t.cue[0]) && n(t.cue[1])) {
      const cue = world.balls[0]; cue.x = lerp(cue.x, clamp(t.cue[0], -T.hl, T.hl), k); cue.z = lerp(cue.z, clamp(t.cue[1], -T.hw, T.hw), k);
    }
    updateShotPanel();
  }
}
function updateNetBadge() {
  const el = $('#net');
  if (!NET.on) { el.textContent = ''; return; }
  const ok = NET.link === 'online' && NET.peer;
  el.textContent = NET.link !== 'online' ? 'Reconnecting to the relay…' : ok ? `${NET.peerName} is connected` : `${NET.peerName} is not connected`;
  el.dataset.ok = ok ? '1' : '0';
}
// quick chat: preset messages only, so there's nothing to moderate in listed rooms
const CHAT = ['Nice shot!', 'Unlucky', 'Good luck', 'Good game', 'Thanks!', 'Oops!', 'Wow!', 'One more?'];
let lastChat = 0;
function sendChat(i) {
  if (!NET.on || performance.now() - lastChat < 1200) return;
  lastChat = performance.now(); netSend({ t: 'chat', i }); toast(`You: ${CHAT[i]}`, 'chat'); $('#chatPop').hidden = true;
}
CHAT.forEach((txt, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = txt; b.addEventListener('click', () => sendChat(i)); $('#chatPop').appendChild(b); });
$('#bChat').addEventListener('click', () => { $('#chatPop').hidden = !$('#chatPop').hidden; });
function concedeFrame(fromRemote, loser) {
  if (game.over || M.mode === 'practice') return false;
  if (state === 'moving' || state === 'stroke' || state === 'set' || state === 'botAim') { if (!fromRemote) toast('Wait for the balls to stop first', 'info'); return false; }
  if (loser !== 0 && loser !== 1) loser = NET.on ? NET.seat : (M.opp === 'bot' ? 0 : game.turn);
  const w = 1 - loser;
  game = { ...game, over: true, winner: w }; matchWins[w]++;
  state = 'over'; bot = null; $('#thinking').hidden = true; $('#offer').hidden = true; updateHUD();
  frameEarn(); if (CAR.on) careerFrameOver();
  showOver({ reason2: 'Conceded the frame' }, loser);
  return true;
}
$('#bConcede').addEventListener('click', () => { togglePause(false); if (concedeFrame(false) && NET.on) netSend({ t: 'concede' }); });
$('#bOfferRerack').addEventListener('click', () => {
  togglePause(false);
  if (!NET.on || game.over) return;
  netSend({ t: 'rerackOffer' }); toast(`Re-rack offered. Waiting for ${NET.peerName}`, 'info');
});
$('#bOfferYes').addEventListener('click', () => { $('#offer').hidden = true; netSend({ t: 'rerackYes' }); if (NET.seat === 0) hostStart(); });
$('#bOfferNo').addEventListener('click', () => { $('#offer').hidden = true; netSend({ t: 'rerackNo' }); });
function updateAgainBtn() {
  const b = $('#bAgain');
  const base = matchDone() ? 'New match' : raceTo() ? 'Next frame' : 'Play again';
  b.textContent = NET.again[NET.seat] ? `Waiting for ${NET.peerName}…` : NET.again[1 - NET.seat] ? `${base}: accept` : base;
}
function tryRematch() {
  if (!NET.on) return;
  if (NET.again[0] && NET.again[1]) { NET.again = [false, false]; if (NET.seat === 0) { NET.games++; hostStart(); } }
  else if (!$('#over').hidden) updateAgainBtn();
}
$('#bJoin').addEventListener('click', () => { ensureAudio(); sfx('ui'); startOnline(cleanCode($('#netCode').value)); });
// open rooms list: watched live from the relay while the online menu is showing
const LW = { ws: null, rooms: [], off: 0, retry: 0, timer: 0, want: false, failed: false, loaded: false };
const MODE_NAME = { '8ball': '8-ball', '9ball': '9-ball', uk8: 'Reds & yellows' };
function updateLobbyWatch() {
  const want = state === 'menu' && !NET.on && menuScreen() === 'online' && !!relayBase() && document.visibilityState === 'visible';
  LW.want = want;
  // short delay, so opening an invite link (which jumps straight into a room) never starts a list connection
  if (want && !LW.ws && !LW.pending) LW.pending = setTimeout(() => { LW.pending = 0; if (LW.want && !LW.ws) lobbyConnect(); }, 300);
  if (!want && LW.ws) {
    const ws = LW.ws; LW.ws = null;
    if (ws.readyState === 0) ws.onopen = () => { try { ws.close(1000); } catch (e) {} };
    else { try { ws.close(1000); } catch (e) {} }
  }
  renderRooms();
}
function lobbyConnect() {
  let ws;
  try { ws = new WebSocket(`${relayBase()}/lobby`); } catch (e) { LW.failed = true; renderRooms(); return; }
  LW.ws = ws; renderRooms();
  ws.onopen = () => { LW.retry = 0; LW.failed = false; renderRooms(); };
  ws.onmessage = e => {
    if (e.data === 'pong') return;
    let m; try { m = JSON.parse(e.data); } catch (err) { return; }
    if (m.t === 'rooms' && Array.isArray(m.rooms)) { LW.rooms = m.rooms; LW.off = (Number(m.now) || Date.now()) - Date.now(); LW.loaded = true; renderRooms(); }
  };
  ws.onclose = () => {
    if (LW.ws === ws) LW.ws = null;
    if (!LW.want) return;
    LW.failed = LW.retry > 1; renderRooms();
    clearTimeout(LW.timer); LW.timer = setTimeout(() => { if (LW.want && !LW.ws) lobbyConnect(); }, Math.min(10000, 1000 * Math.pow(2, LW.retry++)));
  };
}
setInterval(() => { if (LW.ws && LW.ws.readyState === 1) LW.ws.send('ping'); }, 25000);
setInterval(() => { if (LW.want) renderRooms(); }, 30000);
document.addEventListener('visibilitychange', () => { updateLobbyWatch(); if (!document.hidden && state === 'menu') updateRejoin(); });
function renderRooms() {
  const el = $('#roomList'), live = $('#roomsLive');
  const note = t => { el.innerHTML = ''; const d = document.createElement('div'); d.className = 'note'; d.textContent = t; el.appendChild(d); };
  if (!relayBase()) { live.textContent = ''; note('Add your relay address to config.js to see open rooms.'); return; }
  live.textContent = LW.ws && LW.ws.readyState === 1 ? 'Live' : LW.failed ? "Can't reach the relay" : 'Connecting…';
  if (!LW.rooms.length) { note(LW.loaded ? 'No open rooms right now. Create a listed room and it will show up here.' : 'Looking for open rooms…'); return; }
  el.innerHTML = '';
  const now = Date.now() + LW.off;
  for (const r of LW.rooms) {
    const row = document.createElement('div'); row.className = 'roomItem';
    const info = document.createElement('div');
    const n = document.createElement('div'); n.className = 'rn'; n.textContent = `${cleanName(r.name, 'Player')}'s room`;
    const mins = Math.max(0, Math.round((now - Number(r.at)) / 60000));
    const d = document.createElement('div'); d.className = 'rm'; d.textContent = `${MODE_NAME[r.mode] || '8-ball'}, ${mins < 1 ? 'just opened' : mins + ' min waiting'}`;
    info.append(n, d);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = 'Join';
    b.addEventListener('click', () => { ensureAudio(); sfx('ui'); startOnline(cleanCode(r.code)); });
    row.append(info, b); el.appendChild(row);
  }
}

$('#netCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('#bJoin').click(); });
$('#bLobbyCancel').addEventListener('click', () => { sfx('ui'); clearRejoin(); toMenu(); });
$('#bCopyLink').addEventListener('click', async () => {
  const link = inviteLink();
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: 'Retro Rack', text: 'Play pool with me', url: link }); return; }
    await navigator.clipboard.writeText(link); lobbyStatus('Invite link copied. Send it to your friend.');
  } catch (e) { const i = $('#lobbyLink'); i.focus(); i.select(); try { document.execCommand('copy'); lobbyStatus('Invite link copied.'); } catch (e2) { lobbyStatus('Copy the link below and send it to your friend.'); } }
});
try { $('#netName').value = localStorage.getItem('retroRack.name') || ''; } catch (e) {}
// dev mode (see the settings section): checked as each letter is typed, so it's done before Create or Join is pressed
async function isDevWord(v) {
  if (!v || !(window.crypto && crypto.subtle)) return false;
  try { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('retroRack:' + v.trim().toLowerCase())); return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('') === DEVW.print; }
  catch (e) { return false; }
}
function setDev(on, word) {
  DEV = on; DEV_MYTHIC = false; try { if (on) localStorage.setItem('retroRack.dev', '1'); else localStorage.removeItem('retroRack.dev'); localStorage.removeItem('retroRack.devEmpty'); } catch (e) {}
  keepDevWord(on ? word : ''); if (!on) IDEAS.list = [];   // the word unlocks the players' ideas (see "ideas")
  LOCK = on ? devLocker() : lockerRead() || LK.newLocker();
  checkLooks(); saveS(); applyLook(); applyFx(); sendLook(); refreshMenus();
  toast(on ? 'Dev mode on: every look, £100,000 and 50 of each case, in a test locker' : 'Dev mode off: your own locker is back', 'good');
  if (on) loadIdeas().then(ok => { if (ok) showPop(); });
}
$('#netName').addEventListener('input', async () => {
  const v = $('#netName').value; if (!(await isDevWord(v)) || $('#netName').value !== v) return;
  try { $('#netName').value = localStorage.getItem('retroRack.name') || ''; } catch (e) { $('#netName').value = ''; }
  setDev(!DEV, v.trim());
});
$('#sDev').addEventListener('click', () => { sfx('ui'); setDev(false); });
$('#sDevMythic').addEventListener('click', () => { DEV_MYTHIC = DEV && !DEV_MYTHIC; sfx('ui'); refreshMenus(); });
// empty the test locker (a fresh one with no looks and no rewards, £100,000 and 50 of each case), or fill it again
$('#sDevEmpty').addEventListener('click', () => {
  if (!DEV) return; const empty = !devEmpty();
  if (empty && !confirm('Empty the test locker? It starts again with no looks and no rewards, £100,000 and 50 of each case, so cases behave as they do for a new player. Your own locker isn\'t touched.')) return;
  sfx('ui'); try { if (empty) localStorage.setItem('retroRack.devEmpty', '1'); else localStorage.removeItem('retroRack.devEmpty'); } catch (e) {}
  LOCK = devLocker(empty ? null : lockerRead());
  checkLooks(); saveS(); applyLook(); applyFx(); sendLook(); refreshMenus();
});

// ------------------------------------------------------------------ ideas
// Players send ideas to the game's maker: up to IDEA_MAX characters, with their online name and the game's version,
// kept by the relay (Ideas in relay/src/index.js, which also sets the limits). The lightbulb beside the money counter
// opens the box. In dev mode it opens the owner's inbox instead: the relay only hands the ideas over for the dev word,
// which this page keeps on this device (retroRack.devWord) from when it switched dev mode on, or from the inbox's own
// box. In dev mode the page asks for them once at start-up (nothing is polled), and a note under the corner icons and
// a number on the lightbulb say how many are new since the newest one read (retroRack.ideasSeen).
const IDEA_MAX = 100, IDEAS = { list: [], seen: 0, shown: 0, busy: false, pop: 0 };
try { IDEAS.seen = +localStorage.getItem('retroRack.ideasSeen') || 0; } catch (e) {}
const ideaUrl = () => { const b = relayBase(); return b ? b.replace(/^ws/, 'http') + '/ideas' : ''; };
const devWord = () => { try { return localStorage.getItem('retroRack.devWord') || ''; } catch (e) { return ''; } };
function keepDevWord(w) { try { if (w) localStorage.setItem('retroRack.devWord', w); else localStorage.removeItem('retroRack.devWord'); } catch (e) {} }
async function ideaPost(body) {   // refusals come back as { ok: false, why }, so nothing reaches the console
  try { const r = await fetch(ideaUrl(), { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(body) }); return (await r.json()) || { ok: false, why: 'net' }; }
  catch (e) { return { ok: false, why: 'net' }; }
}
const IDEA_WHY = { busy: 'The idea box is full for today. Try again tomorrow.', long: `That's too long: ${IDEA_MAX} characters at most.`, empty: 'Write your idea first.',
  net: "Couldn't reach the game's server. Try again later.", key: "The server didn't take the dev word. Type it again." };
const ideaName = () => cleanName($('#netName').value, '');
const freshIdeas = () => IDEAS.list.filter(i => i.t > IDEAS.seen).length;
function ideaBadge() {
  const b = $('#bIdea'), n = DEV ? freshIdeas() : 0, lab = DEV ? 'Players\' ideas' : 'Send an idea';
  b.hidden = !ideaUrl(); b.title = lab; b.querySelector('.vh').textContent = lab + (n ? `: ${n} new` : '');
  $('#ideaN').hidden = !n; $('#ideaN').textContent = n > 99 ? '99+' : String(n);
  if (!n || !DEV) hidePop();
}
function showPop() {
  const n = freshIdeas(), p = $('#ideaPop'); if (!n || !DEV) return;
  p.textContent = `${n} new ${n === 1 ? 'idea' : 'ideas'} from players`; p.hidden = false;
  clearTimeout(IDEAS.pop); IDEAS.pop = setTimeout(hidePop, 12000);
}
function hidePop() { clearTimeout(IDEAS.pop); $('#ideaPop').hidden = true; }
function ideaLeft() {
  const t = $('#ideaIn').value; $('#ideaLeft').textContent = `${IDEA_MAX - t.length} left`;
  $('#bIdeaSend').disabled = !t.trim() || IDEAS.busy;
}
function openIdea() {
  if (DEV) { openIdeas(); return; }
  const name = ideaName();
  $('#ideaFrom').textContent = name ? `Sent with your online name, ${name}.` : 'Sent without a name: set one on the Online screen.';
  $('#ideaNote').textContent = ''; $('#bIdeaClose').textContent = 'Cancel'; ideaLeft();
  $('#idea').hidden = false; $('#ideaIn').focus({ preventScroll: true }); armBack();
}
function closeIdeaBox() {
  const was = !$('#idea').hidden || !$('#ideas').hidden; $('#idea').hidden = $('#ideas').hidden = true;
  if (was && state === 'menu' && NAV.stack.length < 2 && !paused) disarm();
}
async function sendIdea() {
  const text = $('#ideaIn').value.replace(/\s+/g, ' ').trim(); if (!text || IDEAS.busy) return;
  IDEAS.busy = true; ideaLeft(); $('#ideaNote').textContent = 'Sending…';
  const r = await ideaPost({ op: 'send', text, name: ideaName(), v: BUILD });
  IDEAS.busy = false;
  if (r.ok) { $('#ideaIn').value = ''; $('#bIdeaClose').textContent = 'Close'; sfx('ui'); }
  $('#ideaNote').textContent = r.ok ? `Thanks! Your idea is on its way.${r.left === 0 ? ' That was your last one for today.' : ''}`
    : r.why === 'limit' ? `You've sent ${r.max || 5} today, the most for one day. Try again tomorrow.` : IDEA_WHY[r.why] || IDEA_WHY.net;
  ideaLeft();
}
const ideaDate = t => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
// the inbox: fetches the ideas (with the dev word), newest first; the ones new since last time are marked
async function loadIdeas() {
  if (!DEV || !devWord() || !ideaUrl()) return false;
  const r = await ideaPost({ op: 'list', key: devWord() });
  if (r.ok) IDEAS.list = Array.isArray(r.ideas) ? r.ideas : [];
  else if (r.why === 'key') { keepDevWord(''); IDEAS.list = []; }
  ideaBadge(); if (!$('#ideas').hidden) renderIdeas(r.ok ? '' : IDEA_WHY[r.why] || IDEA_WHY.net);
  return r.ok;
}
function markRead() {
  IDEAS.seen = Math.max(IDEAS.seen, ...IDEAS.list.map(i => +i.t || 0));
  try { localStorage.setItem('retroRack.ideasSeen', String(IDEAS.seen)); } catch (e) {}
  ideaBadge();
}
function renderIdeas(note) {
  const key = devWord(), list = $('#ideasList'), n = IDEAS.list.length, fresh = IDEAS.list.filter(i => i.t > IDEAS.shown).length;
  $('#ideasUnlock').hidden = !!key; list.innerHTML = '';
  $('#ideasHead').textContent = !key ? 'Type your dev word to read them. It stays on this device.' : n ? `${n} ${n === 1 ? 'idea' : 'ideas'}${fresh ? `, ${fresh} new` : ''}, newest first.` : 'No ideas yet.';
  for (const it of IDEAS.list) {
    const row = mk('div', 'ideaRow' + (it.t > IDEAS.shown ? ' new' : '')), del = mk('button', 'btn', 'Delete'); del.type = 'button';
    del.addEventListener('click', async () => {
      sfx('ui'); const r = await ideaPost({ op: 'delete', key: devWord(), id: it.id });
      if (r.ok) IDEAS.list = IDEAS.list.filter(i => i.id !== it.id);
      renderIdeas(r.ok ? '' : IDEA_WHY[r.why] || IDEA_WHY.net); ideaBadge();
    });
    row.append(mk('div', 'ideaText', it.text), mk('div', 'ideaSub', `${it.name || 'No name'} · ${ideaDate(it.t)}${it.v ? ` · version ${it.v}` : ''}`), del);
    list.append(row);
  }
  $('#bIdeasClear').disabled = !n; $('#bIdeasRefresh').disabled = !key;
  $('#ideasNote').textContent = note || '';
}
async function openIdeas() {
  IDEAS.shown = IDEAS.seen; hidePop();
  $('#ideas').hidden = false; armBack();
  renderIdeas(devWord() ? 'Fetching the ideas…' : '');
  if (devWord()) { if (await loadIdeas()) markRead(); } else $('#ideasKey').focus({ preventScroll: true });
}
$('#bIdea').addEventListener('click', () => { if (state !== 'menu' || !$('#reel').hidden) return; ensureAudio(); sfx('ui'); openIdea(); });
$('#ideaPop').addEventListener('click', () => { ensureAudio(); sfx('ui'); openIdeas(); });
addEventListener('pointerdown', e => { if (!$('#ideaPop').hidden && !e.target.closest('#ideaPop')) hidePop(); }, true);   // a tap anywhere else puts the note away
$('#ideaIn').addEventListener('input', ideaLeft);
$('#ideaIn').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendIdea(); } });   // one line: Enter sends
$('#bIdeaSend').addEventListener('click', () => { sfx('ui'); sendIdea(); });
for (const id of ['#bIdeaClose', '#bIdeasClose']) $(id).addEventListener('click', () => { sfx('ui'); closeIdeaBox(); });
for (const id of ['#idea', '#ideas']) {
  $(id).addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closeIdeaBox(); } });
  let out = false;   // a tap outside the panel closes it, if the press started outside too
  $(id).addEventListener('pointerdown', e => { out = e.target === $(id); });
  $(id).addEventListener('click', e => { if (out && e.target === $(id)) closeIdeaBox(); });
}
$('#bIdeasRefresh').addEventListener('click', async () => { sfx('ui'); $('#ideasNote').textContent = 'Fetching the ideas…'; IDEAS.shown = IDEAS.seen; if (await loadIdeas()) markRead(); });
$('#bIdeasClear').addEventListener('click', async () => {
  if (!IDEAS.list.length || !confirm(`Delete all ${IDEAS.list.length} ideas? This can't be undone.`)) return;
  const r = await ideaPost({ op: 'clear', key: devWord() }); if (r.ok) IDEAS.list = [];
  renderIdeas(r.ok ? 'All deleted.' : IDEA_WHY[r.why] || IDEA_WHY.net); ideaBadge();
});
async function unlockIdeas() {
  const w = $('#ideasKey').value.trim(); if (!w) return;
  if (!(await isDevWord(w))) { $('#ideasNote').textContent = "That's not the dev word."; return; }
  keepDevWord(w); $('#ideasKey').value = ''; IDEAS.shown = IDEAS.seen; renderIdeas('Fetching the ideas…');
  if (await loadIdeas()) markRead();
}
$('#bIdeasKey').addEventListener('click', () => { sfx('ui'); unlockIdeas(); });
$('#ideasKey').addEventListener('keydown', e => { if (e.key === 'Enter') unlockIdeas(); });

// ------------------------------------------------------------------ installable app
// Only on a real web address: a downloaded copy opened from disk can't install or use a service worker.
$('#ver').textContent = `Version ${BUILD}${DEV ? ' · DEV' : ''}`;
if (/^https?:$/.test(location.protocol)) {
  const link = document.createElement('link'); link.rel = 'manifest'; link.href = 'manifest.webmanifest';
  const icon = document.createElement('link'); icon.rel = 'apple-touch-icon'; icon.href = 'icons/icon-192.png';
  document.head.append(link, icon);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { /* the game works without it */ });
}

// ------------------------------------------------------------------ phone and screen comforts
// Vibration: only Android lets web pages vibrate, so the setting only shows on touch screens that offer it.
const canVibrate = 'vibrate' in navigator && matchMedia('(pointer: coarse)').matches;
function buzz(pattern) {
  if (!canVibrate || !S.vibrate || replay || TRK.demo) return;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;   // refused (with a console warning) before the first tap
  try { navigator.vibrate(pattern); } catch (e) {}
}
$('#rowVibrate').hidden = !canVibrate;

// Fullscreen: iPhones don't allow it for web pages, so the buttons only show where the browser does
const canFull = !!(document.fullscreenEnabled && document.documentElement.requestFullscreen);
function toggleFull() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
}
// pixel-art icons, drawn from these rows (x = a pixel): the menu's corner buttons, and on phones the game's buttons
const ICONS = {
  cam: ['......xxx.', '.....xxxxx', '.....xxxxx', '...x.xxxxx', '..xx..xxx.', '.xx.......', 'xx........', 'x.........'],
  top: ['xx..xx..xx', 'xxxxxxxxxx', '.x......x.', '.x......x.', '.x......x.', '.x......x.', 'xxxxxxxxxx', 'xx..xx..xx'],
  help: ['..xxxxx...', '.xx...xx..', '......xx..', '.....xx...', '....xx....', '....xx....', '..........', '....xx....', '....xx....'],
  pause: ['.xxx..xxx.', '.xxx..xxx.', '.xxx..xxx.', '.xxx..xxx.', '.xxx..xxx.', '.xxx..xxx.', '.xxx..xxx.', '.xxx..xxx.'],
  replay: ['...xxxx.x.', '.xx....xx.', 'x.....xxx.', 'x.........', 'x........x', 'x........x', '.x......x.', '..xxxxxx..'],
  chat: ['.xxxxxxxx.', 'xxxxxxxxxx', 'xx.xx.xx.x', 'xxxxxxxxxx', '.xxxxxxxx.', '..xx......', '..x.......'],
  rack: ['....xx....', '....xx....', '..xx..xx..', '..xx..xx..', 'xx..xx..xx', 'xx..xx..xx'],
  undo: ['...x......', '..xx......', '.xxxxxxx..', '..xx....x.', '...x.....x', '.........x', '........x.', '....xxxx..'],
  hand: ['...x.x....', '.x.x.x.x..', '.x.x.x.x..', '.x.x.x.x..', '.xxxxxxx.x', '.xxxxxxxxx', '.xxxxxxxx.', '..xxxxxx..', '...xxxx...'],
  move: ['....xx....', '...xxxx...', '....xx....', '.x..xx..x.', 'xxxxxxxxxx', 'xxxxxxxxxx', '.x..xx..x.', '....xx....', '...xxxx...', '....xx....'],
  addball: ['..xxx.....', '.xxxxx....', 'xxxxxxx...', 'xxxxxxx...', 'xxxxxxx.x.', '.xxxxx.xxx', '..xxx...x.'],
  save: ['xxxxxxxxx.', 'x.xxxxx.xx', 'x.xxxxx..x', 'x.xxxxx..x', 'x........x', 'x.xxxxxx.x', 'x.x....x.x', 'xxxxxxxxxx'],
  left: ['...xx', '..xx.', '.xx..', 'xx...', '.xx..', '..xx.', '...xx'],
  right: ['xx...', '.xx..', '..xx.', '...xx', '..xx.', '.xx..', 'xx...'],
  eye: ['...xxxx...', '.xx....xx.', 'x...xx...x', 'x..xxxx..x', 'x...xx...x', '.xx....xx.', '...xxxx...'],
  bin: ['...xxxx...', 'xxxxxxxxxx', '.x......x.', '.x.x..x.x.', '.x.x..x.x.', '.x.x..x.x.', '.x......x.', '..xxxxxx..'],
  slow: ['xxxxxxxx', '.x....x.', '..x..x..', '...xx...', '..x..x..', '.x.xx.x.', 'xxxxxxxx'],
  play: ['x.....', 'xxx...', 'xxxxx.', 'xxxxxx', 'xxxxx.', 'xxx...', 'x.....'],
  skip: ['x....x', 'xx...x', 'xxx..x', 'xxxx.x', 'xxx..x', 'xx...x', 'x....x'],
  pumpkin: ['....xx....', '..xxxxxx..', '.xxxxxxxx.', 'xx..xx..xx', 'xxxxxxxxxx', 'xx.x..x.xx', 'xxx....xxx', '.xxxxxxxx.', '..xxxxxx..'],
  bulb: ['...xxxx...', '..x....x..', '.x..xx..x.', '.x.x..x.x.', '.x......x.', '..x....x..', '...x..x...', '...xxxx...', '...xxxx...', '....xx....'],   // ideas
  coin: ['...xxxx...', '.xxxxxxxx.', '.xxxx..xx.', 'xxxx.xxxxx', 'xxx...xxxx', 'xxxx.xxxxx', 'xxxx.xxxxx', '.xx....xx.', '.xxxxxxxx.', '...xxxx...'],   // a pound coin
  gear: ['...xxxx...', '.x.xxxx.x.', '..xxxxxx..', 'xxxx..xxxx', 'xxx....xxx', 'xxx....xxx', 'xxxx..xxxx', '..xxxxxx..', '.x.xxxx.x.', '...xxxx...'],
  full: ['xxx....xxx', 'x........x', 'x........x', '..........', '..........', '..........', '..........', 'x........x', 'x........x', 'xxx....xxx'],
  unfull: ['..x....x..', '..x....x..', 'xxx....xxx', '..........', '..........', '..........', '..........', 'xxx....xxx', '..x....x..', '..x....x..'],
};
function setIcon(btn, name) {
  const rows = ICONS[name], cells = [];
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === 'x') cells.push(`<rect x="${x}" y="${y}" width="1" height="1"/>`); });
  const old = btn.querySelector('svg'); if (old) old.remove();
  btn.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 ${rows[0].length} ${rows.length}" fill="currentColor" aria-hidden="true">${cells.join('')}</svg>`);
}
setIcon($('#bMenuSettings'), 'gear'); setIcon($('#bMoney'), 'coin'); setIcon($('#bIdea'), 'bulb');
// On phones the game's buttons are small squares with an icon; their names show on a computer, and on a phone a long
// press shows one. A button's name (label) can change: setLab keeps its words, icon and aria-label together.
function setLab(b, label, icon) { const l = b.querySelector('.lab'); if (l) l.textContent = label; else b.textContent = label; b.setAttribute('aria-label', label); if (icon) setIcon(b, icon); }
for (const [q, icon, name] of [['#bCam', 'cam'], ['#bTop', 'top'], ['#bHelp', 'help'], ['#bPause', 'pause'], ['#bFull', 'full'], ['#bReplay', 'replay'], ['#bChat', 'chat'],
  ['#bRerack', 'rack'], ['#bUndo', 'undo'], ['#bHand', 'hand'], ['#bMove', 'move'], ['#bBalls', 'addball'], ['#bSave', 'save'], ['#bAimL', 'left', 'Turn aim left'], ['#bAimR', 'right', 'Turn aim right'],
  ['#bTrickPrev', 'left', 'Previous trick'], ['#bTrickNext', 'right', 'Next trick'], ['#bShowMe', 'eye'], ['#bDelLayout', 'bin'], ['#bSlow', 'slow'], ['#bSkip', 'skip']]) {
  const b = $(q), words = b.textContent; b.textContent = ''; b.classList.add('ib'); b.insertAdjacentHTML('beforeend', '<span class="lab"></span>');
  setLab(b, words, icon); if (name) b.setAttribute('aria-label', name);
}
const LP = { t: 0, b: null, fired: false };   // a long press on an icon button (not the aim arrows, which turn while held)
addEventListener('pointerdown', e => {
  const b = e.target.closest && e.target.closest('.ib'); LP.fired = false; clearTimeout(LP.t);
  if (!b || !phoneUI.matches || b.closest('#aimRow')) return;
  LP.b = b; LP.t = setTimeout(() => {
    LP.fired = true; const t = $('#ibTip'), r = b.getBoundingClientRect(); t.textContent = b.getAttribute('aria-label'); t.hidden = false;
    t.style.left = Math.max(4, Math.min(innerWidth - t.offsetWidth - 4, r.left + r.width / 2 - t.offsetWidth / 2)) + 'px';
    t.style.top = (r.top > t.offsetHeight + 12 ? r.top - t.offsetHeight - 6 : r.bottom + 6) + 'px';
  }, 450);
}, true);
for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, () => { clearTimeout(LP.t); if (LP.fired) setTimeout(() => { $('#ibTip').hidden = true; }, 900); }, true);
addEventListener('click', e => { if (LP.fired && e.target.closest && e.target.closest('.ib') === LP.b) { e.stopImmediatePropagation(); e.preventDefault(); LP.fired = false; } }, true);   // the name, not the button
addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest('.ib')) e.preventDefault(); });
// The Controls panel's keys can be tapped, each doing what the key does. Views, shots and the practice keys close the
// panel first, so you see what happens; the ones that adjust the shot (aim, power, spin) leave it open for more taps.
const KEY_OF = { '←': 'ArrowLeft', '→': 'ArrowRight', '↑': 'ArrowUp', '↓': 'ArrowDown', Space: 'Space' }, KEY_STAY = /^(Arrow|Key[ADWSIJKLO]$)/;
for (const kb of document.querySelectorAll('#help kbd')) {
  const t = kb.textContent.trim(), k = KEY_OF[t] || (/^[A-Z]$/.test(t) ? 'Key' + t : null); if (!k) continue;   // Shift, Ctrl and Alt only go with other keys
  const ctrl = !!kb.closest('[data-ctrl]');   // the arrows written with Ctrl do the fine step
  kb.classList.add('tap'); kb.setAttribute('role', 'button'); kb.tabIndex = 0; kb.dataset.k = k; if (ctrl) kb.dataset.ctrl = '';
  kb.addEventListener('click', () => tapKey(k, ctrl));
  kb.addEventListener('keydown', e => { if (e.code === 'Enter') { e.preventDefault(); e.stopPropagation(); tapKey(k, ctrl); } });
}
function tapKey(k, ctrl) {
  ensureAudio(); if (!KEY_STAY.test(k)) $('#help').hidden = true;
  if (state === 'menu' || state === 'lobby' || paused) return;
  if (k === 'KeyV') { if (replay) endReplay(); else startReplay(); return; }
  if (state === 'over') return;
  if (k === 'KeyQ' || k === 'KeyE') { cam.orbit(k === 'KeyE' ? 70 : -70, 0); return; }   // a turn of about 25°
  if (/^(Arrow(Up|Down)|Key[WS])$/.test(k) && !ctrl) { if (state === 'aim' && humanTurn()) { aim.power = clamp(aim.power + (k === 'ArrowUp' || k === 'KeyW' ? 0.025 : -0.025), 0.02, 1); aimDirty = true; updateShotPanel(); } return; }
  keyAct(k, false, ctrl);
}
function updateFullBtns() {
  const on = !!document.fullscreenElement, word = on ? 'Exit fullscreen' : 'Fullscreen';
  $('#bFull').hidden = !canFull; setLab($('#bFull'), word, on ? 'unfull' : 'full'); $('#bFull').setAttribute('aria-pressed', String(on));
  const m = $('#bMenuFull'); m.hidden = !canFull; m.title = word; m.querySelector('.vh').textContent = word; m.setAttribute('aria-pressed', String(on)); setIcon(m, on ? 'unfull' : 'full');
}
$('#bFull').addEventListener('click', () => { sfx('ui'); toggleFull(); });
$('#bMenuFull').addEventListener('click', () => { ensureAudio(); sfx('ui'); toggleFull(); });
document.addEventListener('fullscreenchange', updateFullBtns);
updateFullBtns();

// "Turn your phone sideways": only on a phone held upright; goes when it's rotated, and OK hides it for good
const portraitPhone = matchMedia('(pointer: coarse) and (orientation: portrait) and (max-width: 600px)');
let rotateOff = false;
try { rotateOff = localStorage.getItem('retroRack.rotateHint') === 'off'; } catch (e) {}
function updateRotateHint() { $('#rotate').hidden = rotateOff || !portraitPhone.matches; }
portraitPhone.addEventListener('change', updateRotateHint);
$('#bRotateOk').addEventListener('click', () => { rotateOff = true; try { localStorage.setItem('retroRack.rotateHint', 'off'); } catch (e) {} updateRotateHint(); });
updateRotateHint();

// ------------------------------------------------------------------ main loop
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (!paused) {
    handleKeys(dt);
    if (state === 'moving') physicsTick(dt);
    else if (state === 'set') setTick(dt);
    else if (state === 'botThink') botThinkTick(now);
    else if (state === 'botAim') botAimTick(dt);
    potAnimTick(dt);
  }
  netTick(now, dt);
  updateBalls();
  updateCue(paused ? 0 : dt);
  if (aimDirty) updateAimTxt();
  updateGuides(now);
  updateMarkers(now); clothFx(now); tableFx(now, paused ? 0 : dt); hallFx(now);
  if (state !== 'aim') { G_CUE.visible = G_CUE2.visible = G_OBJ.visible = G_GHOST.visible = false; }
  if (cam.mode === 'shot' && state !== 'set' && state !== 'stroke' && state !== 'moving') cam.shotOver();
  cam.update(dt);
  renderer.setRenderTarget(rt); renderer.render(scene, camera);
  renderer.setRenderTarget(null); renderer.render(postScene, postCam);
}
addEventListener('resize', resize);
resize(); applyLook(); syncBallMeshes(); refreshMenus(); updateCamButtons();
requestAnimationFrame(frame);
{ // opening an invite link joins the room straight away
  const m = /#room=([A-Za-z0-9]+)/.exec(location.hash);
  if (m) { const code = cleanCode(m[1]); $('#netCode').value = code; M.opp = 'online'; if (M.mode === 'practice') M.mode = '8ball'; refreshMenus(); if (relayBase()) startOnline(code); else { menuReset(['home', 'multi', 'online']); menuNote('This is an invite link, but online play needs the relay address in config.js first.'); } }
}
// collection effects (see "collection effects"): their first drawing, and any reward a saved locker is owed
applyFx(); setTimeout(claimDue, 600);
ideaBadge(); if (DEV) loadIdeas().then(ok => { if (ok && state === 'menu') showPop(); });   // the players' ideas: once, at start-up
window.__rr = { get state() { return state; }, syncBallMeshes, get world() { return world; }, get game() { return game; }, NET, get replay() { return replay; },
  get matchWins() { return matchWins; }, CAR, LK, DEVW, get dev() { return DEV; }, concedeFrame, cheer, applyLook, get cheering() { return cheerGlove.visible ? CHEER.kind : ''; }, get lock() { return LOCK; }, get earn() { return EARN; }, get reel() { return REEL; },
  get fx() { return { cloth: clothTex ? clothTex.offset.x : 0, glow: clothMat.emissive.getHexString(), glove: GLM.base.emissive.getHexString(), show: FX.raf }; },
  get effects() { return { on: LK.effects(LOCK).filter(fxOn), rails: railMat.map !== woodTex, cosmic: BM[0].material.map === cosmicTex.t, stars: wallMat.map === starTex.t, hall: HALL.on, sign: signText(), trail: trailMesh.visible, sparks: SPK.parts.length }; }, lookRank, sparkAt,
  get look() { return { venue: VEN.key, sign: VEN.sign, cue: cueNow, cloth: PREV.on ? PREV.looks.cloth : NET.on && NET.cloth ? NET.cloth : S.cloth, glove: gloveNow, clothTex: !!clothMat.map, shown: cueMesh.visible, cam: cam.mode }; },
  ballScreen(id) { const b = world.balls.find(x => x.id === id); const v = new THREE.Vector3(b.x, R, b.z).project(camera); const r = canvas.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; }, aim, cam, startGame, M, S, beginStroke, shoot, toggleTop, toggleAimCam,
  get hands() {   // the gloves at the table: one piece on a skeleton or built from parts, and how far the cue hand's fingertips are from the middle of the cue (cm)
    const info = root => { let sk = null, parts = 0; root.traverse(o => { if (o.isSkinnedMesh) sk = o; else if (o.isMesh) parts++; }); return { skinned: !!sk, bones: sk ? sk.skeleton.bones.length : 0, parts, geo: sk ? sk.geometry.uuid : '' }; };
    const g = gripGlove.children[0], v = new THREE.Vector3(); let tips = [];
    if (g) g.traverse(o => { if (o.isSkinnedMesh) tips = [4, 7, 10, 13].map(i => { v.set(0, 0, -0.018); o.skeleton.bones[i].localToWorld(v); g.worldToLocal(v); return Math.round(Math.hypot(v.y, v.z) * 1000) / 10; }); });
    return { grip: { ...info(gripGlove), tips }, bridge: info(bridgeGlove), textured: !!GLM.base.map };
  },
  tableFrame() { const v = new THREE.Vector3(); let m = 0; for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { v.set(x * (T.hl + 0.2), 0, z * (T.hw + 0.2)).project(camera); m = Math.max(m, Math.abs(v.x), Math.abs(v.y)); } return m; },   // how far the table's corners reach across the screen (1: the edge)
  marked() { return MK.map((k, id) => k.visible ? id : -1).filter(id => id >= 0); } };
})();
