// Looks: the cloths, cues and gloves a player can own, the cases most of them come in, and the locker that holds a
// device's money, its unopened cases and its collection. No DOM; also runs in Node for the tests.
// The career's shop items (career.js, SHOP) are bought outright; everything here comes out of cases.
const LOOKS = (K => {
'use strict';
const has = K.has;

// Rarities, commonest first. sell: what a duplicate fetches. col: the colour that marks the rarity on screen.
const RARITY = {
  common: { name: 'Common', col: '#cfd0dc', sell: 10 },
  rare: { name: 'Rare', col: '#6cb8ff', sell: 30 },
  epic: { name: 'Epic', col: '#c17bff', sell: 80 },
  legendary: { name: 'Legendary', col: '#ffc56b', sell: 200 },
  mythic: { name: 'Mythic', col: '#ff3b3b', sell: 500 },   // animated looks, in every case but very rarely
};
const RARITIES = Object.keys(RARITY);
// Case grades, from playing the easier levels up to the hardest. odds: percent chance of each rarity, in RARITIES
// order (legendaries in silver and better, mythics in all of them, very rarely; diamond only epic or better, and dearer
// to open for it). open: what opening one costs. price: what buying one costs.
const GRADES = {
  bronze: { name: 'Bronze case', col: '#c98a4b', odds: [72, 24, 3.8, 0, 0.2], open: 8, price: 45 },
  silver: { name: 'Silver case', col: '#c9d1dc', odds: [50, 36, 11.5, 2, 0.5], open: 20, price: 110 },
  gold: { name: 'Gold case', col: '#ffd36b', odds: [25, 45, 23, 6, 1], open: 45, price: 260 },
  diamond: { name: 'Diamond case', col: '#7fe8ff', odds: [0, 0, 70, 24, 6], open: 250, price: 900 },
  // a season's cases (series: see SERIES), holding only its own looks. trick: earned and bought, any of its looks, a
  // duplicate sold as usual. treat (fresh): bought only, and always a look you don't have yet, until you have them all.
  trick: { name: 'Trick case', col: '#ff8a1f', odds: [45, 33, 15, 5.5, 1.5], open: 20, price: 120, series: 'halloween' },
  treat: { name: 'Treat case', col: '#9b4dff', odds: [28, 28, 22, 14, 8], open: 0, price: 400, series: 'halloween', fresh: true },
};
const GRADE_IDS = ['bronze', 'silver', 'gold', 'diamond'];   // the everyday cases, earned by playing
const CASE_IDS = Object.keys(GRADES);   // every case, the seasons' too
const PITY = 8;   // at least one epic or better in every 8 cases opened
// Collections: the case looks of one rarity and one kind (the common cloths, the mythic gloves and so on), 15 in all.
// Each pays its reward once, when complete: money and cases, more for the rarer ones. All three of a rarity make its
// set, which pays far more and adds an effect only a set gives (drawn by game.js; display only, and only on your own
// screen). All fifteen add the starfield room (GRAND).
const KINDS = ['cloth', 'cue', 'glove'];
const KIND_REWARD = { common: { money: 150, cases: { silver: 1 } }, rare: { money: 400, cases: { gold: 1 } }, epic: { money: 800, cases: { diamond: 1 } },
  legendary: { money: 2000, cases: { diamond: 2 } }, mythic: { money: 5000, cases: { diamond: 3 } } };
const COLLECTIONS = {}; for (const r of RARITIES) for (const k of KINDS) COLLECTIONS[r + ':' + k] = { rarity: r, kind: k, ...KIND_REWARD[r] };
const SETS = {
  common: { money: 1000, cases: { gold: 3 }, fx: 'trail' },
  rare: { money: 2500, cases: { diamond: 3 }, fx: 'rails' },
  epic: { money: 5000, cases: { diamond: 5 }, fx: 'sparks' },
  legendary: { money: 12000, cases: { diamond: 8 }, fx: 'neon' },
  mythic: { money: 30000, cases: { diamond: 12 }, fx: 'cosmic' },
};
const GRAND = { money: 50000, cases: {}, fx: 'stars' };
// Seasons: looks that come only in their own cases, which can be bought and earned only between from and to (month-day)
// each year; cases already held open at any time, and what they gave is kept for good. daily: the case your first frame
// won each day earns in the season. Each rarity's looks (two of each kind) pay their reward once, when all six are
// yours (claimed as 'series:rarity'); all of them, the grand reward ('series:all'), with an effect.
const SERIES = {
  halloween: { name: 'Halloween', from: '10-01', to: '11-10', grades: ['trick', 'treat'], daily: 'trick',
    reward: { common: { money: 150, cases: { trick: 2 } }, rare: { money: 300, cases: { trick: 2 } }, epic: { money: 600, cases: { treat: 1 } },
      legendary: { money: 1200, cases: { treat: 1 } }, mythic: { money: 2500, cases: {} } },
    grand: { money: 5000, cases: {}, fx: 'haunted' } },
};
const SERIES_IDS = Object.keys(SERIES);
// day: the local date, YYYY-MM-DD
const inSeason = (sid, day) => { const S = SERIES[sid], md = String(day).slice(5); return S.from <= S.to ? md >= S.from && md <= S.to : md >= S.from || md <= S.to; };
const EFFECTS = {
  trail: { name: 'Chalk trail', txt: 'The cue ball leaves a trail of chalk dust as it rolls.' },
  rails: { name: 'Gold rails', txt: 'The table\'s rails are trimmed in polished gold.' },
  sparks: { name: 'Pot sparks', txt: 'A burst of sparks in the ball\'s colour when it drops.' },
  neon: { name: 'Your name in neon', txt: 'Your name lights up the neon sign at home.' },
  cosmic: { name: 'Cosmic cue ball', txt: 'A cue ball swirled with a far-off nebula.' },
  stars: { name: 'Starfield room', txt: 'The room at home opens onto the night sky.' },
  haunted: { name: 'Haunted Hall', txt: 'The room at home becomes a haunted hall: jack-o\'-lanterns, bats, cobwebs, a moonlit window and fog.' },
};

// What playing earns. A frame won against the computer pays money and moves that level's case meter on; METER frames
// fill it (one, so every frame won earns a case). Career frames fill the meter of the tier's grade (prize money is
// their pay). An event won gives EVENT_CASES of the tier's grade, its championship of the grade above (twice as many
// of the best at the top). The day's first online win gives ONLINE. Practice and same-device games earn nothing.
const CPU_PAY = { easy: 15, medium: 45, hard: 90, expert: 150 };
const LEVEL_GRADE = { easy: 'bronze', medium: 'silver', hard: 'gold', expert: 'diamond' };
const TIER_GRADE = ['bronze', 'silver', 'gold', 'diamond'];
const METER = 1, EVENT_CASES = 2;
const ONLINE = { pay: 100, grade: 'gold', n: 2 };
// a new locker: one silver case and the money to open it, so everyone can try a case straight away
const START = { money: 40, cases: { silver: 1 } };

// The catalogue. Cloths: col, and a pattern (pat: kind, col2 its colour, kept close to the cloth so the balls stay
// easy to see). Cues: the six colours of a design (see career.js), plus an optional pattern on the forearm and butt
// (pat: kind and colour) and an effect (fx: glow, rainbow, neon). Gloves: base, accent and cuff colours, a glove type
// (style; skin for the bare fingers of wraps and fingerless gloves) and an optional effect (fx: glow, flicker, ghost;
// fxc the glow colour). Mythic looks move: anim on a cloth (flow: the pattern drifts across the table; pulse: its
// cracks glow and fade), and on cues and gloves an fx of their own (spin, plasma, molten, prism).
const cue = (shaft, joint, fore, wrap, butt, inlay) => ({ shaft, joint, fore, wrap, butt, inlay });
const CASE_ITEMS = [
  // cloths
  { id: 'c-pin', kind: 'cloth', name: 'Pinstripe', rarity: 'common', col: '#1e3263', pat: 'pin', col2: '#2a4278' },
  { id: 'c-dots', kind: 'cloth', name: 'Polka', rarity: 'common', col: '#86263f', pat: 'dots', col2: '#93304a' },
  { id: 'c-herring', kind: 'cloth', name: 'Herringbone', rarity: 'common', col: '#3d434c', pat: 'herring', col2: '#4a515c' },
  { id: 'c-diamond', kind: 'cloth', name: 'Argyle', rarity: 'rare', col: '#1d8a74', pat: 'diamond', col2: '#25977f' },
  { id: 'c-wave', kind: 'cloth', name: 'Ocean', rarity: 'rare', col: '#1f5f8a', pat: 'wave', col2: '#286c99' },
  { id: 'c-tartan', kind: 'cloth', name: 'Tartan', rarity: 'rare', col: '#2f5a3a', pat: 'tartan', col2: '#3a6845' },
  { id: 'c-hex', kind: 'cloth', name: 'Honeycomb', rarity: 'rare', col: '#7a5a1c', pat: 'hex', col2: '#876724' },
  { id: 'c-stars', kind: 'cloth', name: 'Midnight', rarity: 'epic', col: '#1b1f4a', pat: 'stars', col2: '#8f97d6' },
  { id: 'c-circuit', kind: 'cloth', name: 'Circuit', rarity: 'epic', col: '#14532d', pat: 'circuit', col2: '#1f6a3c' },
  { id: 'c-crown', kind: 'cloth', name: 'Royal', rarity: 'epic', col: '#2a3f8f', pat: 'crown', col2: '#3a52a6' },
  { id: 'c-galaxy', kind: 'cloth', name: 'Galaxy', rarity: 'legendary', col: '#150f33', pat: 'galaxy', col2: '#3d2479' },
  { id: 'c-synth', kind: 'cloth', name: 'Synthwave', rarity: 'legendary', col: '#2b0f3f', pat: 'synth', col2: '#6d2a78' },
  { id: 'c-aurora', kind: 'cloth', name: 'Aurora', rarity: 'mythic', col: '#0b2a2e', pat: 'aurora', col2: '#3dffb0', col3: '#b45cff', anim: 'flow' },
  { id: 'c-magma', kind: 'cloth', name: 'Magma', rarity: 'mythic', col: '#2a0d08', pat: 'lava', col2: '#ff6a1a', col3: '#ffd23f', anim: 'pulse' },
  // cues
  { id: 'q-maple', kind: 'cue', name: 'Maple', rarity: 'common', col: cue('#f0dcae', '#e8e8ee', '#d9b77e', '#2d2344', '#8a5a32', '#2d2344') },
  { id: 'q-mint', kind: 'cue', name: 'Mint', rarity: 'common', col: cue('#e3c68f', '#f7ead2', '#3fbf9f', '#f7ead2', '#2a8c74', '#f7ead2') },
  { id: 'q-bubble', kind: 'cue', name: 'Bubblegum', rarity: 'common', col: cue('#f1e4c4', '#f7ead2', '#ff8fb8', '#6b2a52', '#ff6f9f', '#f7ead2') },
  { id: 'q-slate', kind: 'cue', name: 'Slate', rarity: 'common', col: cue('#e3c68f', '#9aa3b2', '#4a5568', '#1a1d24', '#2d3340', '#cfd0dc') },
  { id: 'q-stripe', kind: 'cue', name: 'Barber', rarity: 'common', col: cue('#e3c68f', '#e8e8ee', '#2461b0', '#141018', '#2461b0', '#f7ead2'), pat: 'spiral', pc: '#f7ead2' },
  { id: 'q-check', kind: 'cue', name: 'Chequers', rarity: 'common', col: cue('#e3c68f', '#e8e8ee', '#141018', '#141018', '#141018', '#f7ead2'), pat: 'check', pc: '#f7ead2' },
  { id: 'q-flame', kind: 'cue', name: 'Hot rod', rarity: 'rare', col: cue('#e3c68f', '#141018', '#141018', '#141018', '#141018', '#ff7a2f'), pat: 'flame', pc: '#ff7a2f' },
  { id: 'q-carbon', kind: 'cue', name: 'Carbon', rarity: 'rare', col: cue('#d8d2c4', '#cfd0dc', '#2a2d33', '#141018', '#2a2d33', '#6cb8ff'), pat: 'carbon', pc: '#3e434c' },
  { id: 'q-tiger', kind: 'cue', name: 'Tiger', rarity: 'rare', col: cue('#e3c68f', '#141018', '#f08a24', '#141018', '#f08a24', '#141018'), pat: 'tiger', pc: '#141018' },
  { id: 'q-zigzag', kind: 'cue', name: 'Surf', rarity: 'rare', col: cue('#f1e4c4', '#f7ead2', '#1f6fb0', '#f7ead2', '#1f6fb0', '#7fe8ff'), pat: 'zigzag', pc: '#7fe8ff' },
  { id: 'q-candy', kind: 'cue', name: 'Candy cane', rarity: 'rare', col: cue('#f7ead2', '#f7ead2', '#d6303b', '#f7ead2', '#d6303b', '#2d8a3c'), pat: 'spiral', pc: '#f7ead2' },
  { id: 'q-camo', kind: 'cue', name: 'Camo', rarity: 'rare', col: cue('#d8c79a', '#3b3a2a', '#56653a', '#2b3020', '#56653a', '#c9b98a'), pat: 'camo', pc: '#3b4a28' },
  { id: 'q-bolt', kind: 'cue', name: 'Thunder', rarity: 'epic', col: cue('#e3c68f', '#ffd36b', '#4b2a8a', '#141018', '#4b2a8a', '#ffd36b'), pat: 'bolt', pc: '#ffd36b', fx: 'glow' },
  { id: 'q-scales', kind: 'cue', name: 'Dragon', rarity: 'epic', col: cue('#e3c68f', '#d9a441', '#1f6b3a', '#141018', '#1f6b3a', '#d9a441'), pat: 'scales', pc: '#2f8f50' },
  { id: 'q-ice', kind: 'cue', name: 'Frostbite', rarity: 'epic', col: cue('#e8f4ff', '#bfe9ff', '#7fc8e8', '#e8f4ff', '#7fc8e8', '#ffffff'), pat: 'crystal', pc: '#e8f8ff', fx: 'glow' },
  { id: 'q-stars', kind: 'cue', name: 'Starlight', rarity: 'epic', col: cue('#e3c68f', '#cfd0dc', '#1b1f4a', '#141018', '#1b1f4a', '#ffffff'), pat: 'stars', pc: '#ffffff', fx: 'glow' },
  { id: 'q-rainbow', kind: 'cue', name: 'Spectrum', rarity: 'legendary', col: cue('#f1e4c4', '#ffffff', '#ff4d4d', '#141018', '#4d6bff', '#ffffff'), pat: 'holo', pc: '#ffffff', fx: 'rainbow' },
  { id: 'q-neon', kind: 'cue', name: 'Neon', rarity: 'legendary', col: cue('#2a2238', '#ff4fd8', '#141018', '#141018', '#141018', '#4ff0ff'), pat: 'tubes', pc: '#4ff0ff', fx: 'neon' },
  { id: 'q-horizon', kind: 'cue', name: 'Event horizon', rarity: 'mythic', col: cue('#2a2238', '#ff8a3d', '#05030a', '#05030a', '#05030a', '#ffd36b'), pat: 'swirl', pc: '#ff8a3d', fx: 'spin' },
  { id: 'q-plasma', kind: 'cue', name: 'Plasma', rarity: 'mythic', col: cue('#e8f4ff', '#7fe8ff', '#1a0f3a', '#141018', '#1a0f3a', '#ff4fd8'), pat: 'plasma', pc: '#7fe8ff', fx: 'plasma' },
  // gloves: style is the glove type (sport, driver, tactical, moto, fingerless, wraps), or a novelty (boxing, claw, bones)
  { id: 'g-leather', kind: 'glove', name: 'Leather', rarity: 'common', base: '#7a4a2a', accent: '#3b2416', cuff: '#5a341c', style: 'driver' },
  { id: 'g-golf', kind: 'glove', name: 'Golf', rarity: 'common', base: '#f7f4ee', accent: '#1e3263', cuff: '#1e3263', style: 'driver' },
  { id: 'g-biker', kind: 'glove', name: 'Biker', rarity: 'common', base: '#1d1a22', accent: '#9aa3b2', cuff: '#1d1a22', style: 'fingerless', skin: '#e0ac7e' },
  { id: 'g-driving', kind: 'glove', name: 'Tan driver', rarity: 'common', base: '#b8875a', accent: '#5a3a22', cuff: '#5a3a22', style: 'fingerless', skin: '#c68a5e' },
  { id: 'g-olive', kind: 'glove', name: 'Olive drab', rarity: 'common', base: '#5d6b3a', accent: '#2f3520', cuff: '#4a5530', style: 'tactical' },
  { id: 'g-wraps', kind: 'glove', name: 'Hand wraps', rarity: 'common', base: '#e8e4da', accent: '#b9b2a2', cuff: '#e8e4da', style: 'wraps', skin: '#e0ac7e' },
  { id: 'g-navy', kind: 'glove', name: 'Navy sport', rarity: 'common', base: '#1e3263', accent: '#6cb8ff', cuff: '#2a4a8a', style: 'sport' },
  { id: 'g-slate', kind: 'glove', name: 'Slate moto', rarity: 'common', base: '#4a5160', accent: '#1d1a22', cuff: '#3a404c', style: 'moto' },
  { id: 'g-boxing', kind: 'glove', name: 'Boxing', rarity: 'rare', base: '#c0262e', accent: '#f7ead2', cuff: '#f7ead2', style: 'boxing' },
  { id: 'g-racing', kind: 'glove', name: 'Racing', rarity: 'rare', base: '#f7f4ee', accent: '#d6303b', cuff: '#d6303b', style: 'sport' },
  { id: 'g-desert', kind: 'glove', name: 'Desert', rarity: 'rare', base: '#c9a46a', accent: '#6b4f2a', cuff: '#a8844f', style: 'tactical' },
  { id: 'g-redwrap', kind: 'glove', name: 'Red wraps', rarity: 'rare', base: '#a8202c', accent: '#5a0f16', cuff: '#a8202c', style: 'wraps', skin: '#c68a5e' },
  { id: 'g-royal', kind: 'glove', name: 'Royal sport', rarity: 'rare', base: '#4b2a8a', accent: '#ffd36b', cuff: '#2a1a5e', style: 'sport' },
  { id: 'g-hivis', kind: 'glove', name: 'Hi-vis', rarity: 'rare', base: '#ff7a2f', accent: '#1d1a22', cuff: '#1d1a22', style: 'moto' },
  { id: 'g-midnight', kind: 'glove', name: 'Midnight moto', rarity: 'rare', base: '#141018', accent: '#2461b0', cuff: '#1d1a22', style: 'moto' },
  { id: 'g-mint', kind: 'glove', name: 'Mint sport', rarity: 'rare', base: '#3fbf9f', accent: '#ff6f9f', cuff: '#f7ead2', style: 'sport' },
  { id: 'g-carbon', kind: 'glove', name: 'Carbon', rarity: 'epic', base: '#2a2d33', accent: '#9aa3b2', cuff: '#141018', style: 'tactical' },
  { id: 'g-robot', kind: 'glove', name: 'Robot', rarity: 'epic', base: '#9aa3b2', accent: '#4a5160', cuff: '#4a5160', style: 'claw', fx: 'glow', fxc: '#ff4d4d' },
  { id: 'g-bones', kind: 'glove', name: 'Skeleton', rarity: 'epic', base: '#ece6d2', accent: '#c9c0a4', cuff: '#2a2238', style: 'bones' },
  { id: 'g-acid', kind: 'glove', name: 'Acid', rarity: 'epic', base: '#7ad63a', accent: '#1d1a22', cuff: '#1d1a22', style: 'sport', fx: 'glow', fxc: '#9be22d' },
  { id: 'g-arctic', kind: 'glove', name: 'Arctic', rarity: 'epic', base: '#e8f4ff', accent: '#7fc8e8', cuff: '#bfe9ff', style: 'moto', fx: 'glow', fxc: '#7fe8ff' },
  { id: 'g-gold', kind: 'glove', name: 'Gold leaf', rarity: 'legendary', base: '#ffd36b', accent: '#141018', cuff: '#b8862a', style: 'driver', fx: 'glow', fxc: '#ffd36b' },
  { id: 'g-flame', kind: 'glove', name: 'Blaze', rarity: 'legendary', base: '#ff7a2f', accent: '#ffd23f', cuff: '#c0262e', style: 'sport', fx: 'flicker', fxc: '#ff9a3f' },
  { id: 'g-ghost', kind: 'glove', name: 'Phantom', rarity: 'legendary', base: '#b9a6ff', accent: '#ffffff', cuff: '#6d5ad6', style: 'tactical', fx: 'ghost', fxc: '#9f8bff' },
  { id: 'g-molten', kind: 'glove', name: 'Molten', rarity: 'mythic', base: '#ff5a1f', accent: '#ffd23f', cuff: '#3a0d05', style: 'tactical', fx: 'molten', fxc: '#ff8a1f' },
  { id: 'g-prism', kind: 'glove', name: 'Prism', rarity: 'mythic', base: '#ff4d4d', accent: '#ffffff', cuff: '#1d1a22', style: 'sport', fx: 'prism', fxc: '#ffffff' },
];
// The Halloween looks (series: 'halloween'), two of each kind at each rarity, only in Trick and Treat cases. The
// legendary cloths and cues are painted (game.js), and the mythics move like the others.
const h = it => ({ series: 'halloween', ...it });
const SEASON_ITEMS = [
  h({ id: 'c-h-pumpkin', kind: 'cloth', name: 'Pumpkin patch', rarity: 'common', col: '#40200d', pat: 'seeds', col2: '#532a12' }),
  h({ id: 'c-h-moss', kind: 'cloth', name: 'Graveyard moss', rarity: 'common', col: '#22351f', pat: 'graves', col2: '#2b4127' }),
  h({ id: 'c-h-bats', kind: 'cloth', name: 'Bat flock', rarity: 'rare', col: '#1c1a24', pat: 'bats', col2: '#312d3d' }),
  h({ id: 'c-h-web', kind: 'cloth', name: 'Cobweb', rarity: 'rare', col: '#26262d', pat: 'web', col2: '#3a3a44' }),
  h({ id: 'c-h-brew', kind: 'cloth', name: 'Witch\'s brew', rarity: 'epic', col: '#26123c', pat: 'bubbles', col2: '#3d2160' }),
  h({ id: 'c-h-spider', kind: 'cloth', name: 'Spider\'s lair', rarity: 'epic', col: '#150f13', pat: 'spider', col2: '#47220f' }),
  h({ id: 'c-h-mist', kind: 'cloth', name: 'Haunted mist', rarity: 'legendary', col: '#141a24', pat: 'mist', col2: '#7d8fa8' }),
  h({ id: 'c-h-lantern', kind: 'cloth', name: 'Lantern glow', rarity: 'legendary', col: '#160c08', pat: 'lantern', col2: '#ff8a1f' }),
  h({ id: 'c-h-moon', kind: 'cloth', name: 'Blood moon', rarity: 'mythic', col: '#14070a', pat: 'moon', col2: '#a8180f', col3: '#e0704a', anim: 'pulse' }),
  h({ id: 'c-h-soul', kind: 'cloth', name: 'Soul fire', rarity: 'mythic', col: '#040c0a', pat: 'soul', col2: '#3dff9a', col3: '#c8fff0', anim: 'flow' }),
  h({ id: 'q-h-bone', kind: 'cue', name: 'Bone', rarity: 'common', col: cue('#efe6cf', '#2a2238', '#e6dabd', '#2a2238', '#d9ccad', '#2a2238'), pat: 'bones', pc: '#3a3048' }),
  h({ id: 'q-h-jack', kind: 'cue', name: 'Jack', rarity: 'common', col: cue('#e3c68f', '#2f5a1f', '#e2701c', '#2f5a1f', '#c45a12', '#2f5a1f'), pat: 'vine', pc: '#2f6a24' }),
  h({ id: 'q-h-broom', kind: 'cue', name: 'Broomstick', rarity: 'rare', col: cue('#c9a46a', '#3b2416', '#6b4a2a', '#d9b25a', '#4a3020', '#d9b25a'), pat: 'straw', pc: '#e8c66a' }),
  h({ id: 'q-h-corn', kind: 'cue', name: 'Candy corn', rarity: 'rare', col: cue('#f1e4c4', '#f7ead2', '#ff8a1f', '#f7ead2', '#ffd23f', '#f7ead2'), pat: 'corn', pc: '#ffd23f' }),
  h({ id: 'q-h-vampire', kind: 'cue', name: 'Vampire', rarity: 'epic', col: cue('#e3c68f', '#b0101e', '#141018', '#141018', '#141018', '#b0101e'), pat: 'drip', pc: '#c0101e', fx: 'glow' }),
  h({ id: 'q-h-widow', kind: 'cue', name: 'Black widow', rarity: 'epic', col: cue('#d8d2c4', '#d6303b', '#141018', '#141018', '#141018', '#d6303b'), pat: 'widow', pc: '#d6303b', fx: 'glow' }),
  h({ id: 'q-h-cauldron', kind: 'cue', name: 'Cauldron', rarity: 'legendary', col: cue('#2a2238', '#7dff5a', '#0d1a0d', '#141018', '#0d1a0d', '#d8ff7a'), pat: 'brew', pc: '#7dff5a', fx: 'glow' }),
  h({ id: 'q-h-reaper', kind: 'cue', name: 'Reaper', rarity: 'legendary', col: cue('#cfd0dc', '#9aa3b2', '#141018', '#141018', '#1d1a22', '#e8f4ff'), pat: 'reaper', pc: '#cfe8ff', fx: 'glow' }),
  h({ id: 'q-h-wisp', kind: 'cue', name: 'Will-o\'-the-wisp', rarity: 'mythic', col: cue('#2a2238', '#7fe8ff', '#05080f', '#05080f', '#05080f', '#d8fff8'), pat: 'wisp', pc: '#7fffd8', fx: 'wisp' }),
  h({ id: 'q-h-hellfire', kind: 'cue', name: 'Hellfire', rarity: 'mythic', col: cue('#2a2238', '#ff5a1f', '#0a0302', '#0a0302', '#0a0302', '#ffd23f'), pat: 'hell', pc: '#ff6a1a', fx: 'hellfire' }),
  h({ id: 'g-h-mummy', kind: 'glove', name: 'Mummy', rarity: 'common', base: '#d9cfb4', accent: '#a89f86', cuff: '#cfc4a6', style: 'wraps', skin: '#d2c7aa' }),
  h({ id: 'g-h-pumpkin', kind: 'glove', name: 'Pumpkin', rarity: 'common', base: '#e2701c', accent: '#2f5a1f', cuff: '#3a2a1a', style: 'sport' }),
  h({ id: 'g-h-witch', kind: 'glove', name: 'Witch', rarity: 'rare', base: '#3b1f5c', accent: '#5fbf3a', cuff: '#1d1a22', style: 'fingerless', skin: '#8fbf6a' }),
  h({ id: 'g-h-zombie', kind: 'glove', name: 'Zombie', rarity: 'rare', base: '#4a4d3a', accent: '#7a2a2a', cuff: '#3a3a2a', style: 'fingerless', skin: '#7a9a5a' }),
  h({ id: 'g-h-vampire', kind: 'glove', name: 'Vampire', rarity: 'epic', base: '#141018', accent: '#b0101e', cuff: '#5a0a14', style: 'driver', fx: 'glow', fxc: '#ff2a3a' }),
  h({ id: 'g-h-wolf', kind: 'glove', name: 'Werewolf', rarity: 'epic', base: '#5a4030', accent: '#2a1d14', cuff: '#3a2a1f', style: 'fingerless', skin: '#3a3540' }),
  h({ id: 'g-h-spectre', kind: 'glove', name: 'Spectre', rarity: 'legendary', base: '#bfe8d8', accent: '#ffffff', cuff: '#5fa890', style: 'sport', fx: 'ecto', fxc: '#9bffd0' }),
  h({ id: 'g-h-lantern', kind: 'glove', name: 'Jack-o\'-lantern', rarity: 'legendary', base: '#e2701c', accent: '#ffd23f', cuff: '#2f5a1f', style: 'tactical', fx: 'lantern', fxc: '#ffb03a' }),
  h({ id: 'g-h-ghostfire', kind: 'glove', name: 'Ghost fire', rarity: 'mythic', base: '#1f6a4a', accent: '#9bffb0', cuff: '#0d2a1f', style: 'tactical', fx: 'ghostfire', fxc: '#7dffb0' }),
  h({ id: 'g-h-banshee', kind: 'glove', name: 'Banshee', rarity: 'mythic', base: '#d8d0ff', accent: '#ffffff', cuff: '#4a3a8a', style: 'sport', fx: 'banshee', fxc: '#c9b8ff' }),
];
// the free glove everyone starts with ('none' shows no gloves at all)
const FREE_GLOVE = { id: 'g-white', kind: 'glove', name: 'Classic white', rarity: 'common', base: '#f4f1ea', accent: '#1a1433', cuff: '#ffffff', style: 'sport' };
// every look by id: the shop's (career.js), the cases', and the free glove
const ALL = Object.fromEntries([...K.SHOP, ...CASE_ITEMS, ...SEASON_ITEMS, FREE_GLOVE].map(it => [it.id, it]));
const POOL = Object.fromEntries(RARITIES.map(r => [r, CASE_ITEMS.filter(it => it.rarity === r).map(it => it.id)]));
// a season's looks by rarity, and the looks a case can hold
const SERIES_POOL = Object.fromEntries(SERIES_IDS.map(sid => [sid, Object.fromEntries(RARITIES.map(r => [r, SEASON_ITEMS.filter(it => it.series === sid && it.rarity === r).map(it => it.id)]))]));
const poolOf = (grade, r) => GRADES[grade].series ? SERIES_POOL[GRADES[grade].series][r] : POOL[r];
const seriesItems = sid => RARITIES.flatMap(r => SERIES_POOL[sid][r]);
const FREE = ['house', 'none', FREE_GLOVE.id];   // looks everyone owns (with the five original cloths, in game.js)

// Picks what a case gives. The rarity comes from the grade's odds, except that after PITY - 1 cases in a row without
// an epic or better, only epic or better can come up (in the grade's proportions). The item is then any of that rarity,
// all equally likely. rnd: a function giving numbers from 0 up to 1. force: a rarity to give instead, if the grade holds
// it (dev mode's "next case mythic").
// owned: a fresh case's looks owned already, which it then leaves out (while any of its looks are missing).
function roll(grade, pity, rnd, force, owned) {
  const odds = [...GRADES[grade].odds], fi = RARITIES.indexOf(force), left = r => poolOf(grade, r).filter(id => !owned || !owned.includes(id));
  if (owned && RARITIES.some(r => left(r).length)) RARITIES.forEach((r, i) => { if (!left(r).length) odds[i] = 0; }); else owned = null;
  if (fi >= 0 && odds[fi]) { odds.fill(0); odds[fi] = 1; }
  if (pity >= PITY - 1 && odds.slice(2).some(o => o)) odds[0] = odds[1] = 0;
  let r = rnd() * odds.reduce((a, b) => a + b, 0), ri = 0;
  while (ri < odds.length - 1 && (r >= odds[ri] || !odds[ri])) { r -= odds[ri]; ri++; }
  while (!odds[ri]) ri--;   // rounding at the very top end
  const pool = owned ? left(RARITIES[ri]) : poolOf(grade, RARITIES[ri]);
  return pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
}
// the items shown passing on the reel: drawn by the case's own odds, without the guarantee, so they show what the
// case really holds
const reelItems = (grade, n, rnd) => Array.from({ length: n }, () => roll(grade, 0, rnd));

// The locker. money: what's left to spend. owned: looks owned beyond the free ones. cases: unopened cases by grade.
// meter: frames towards the next case of each grade. pity: cases opened since the last epic or better. daily: the day
// (YYYY-MM-DD) of the last online win that paid. opened: cases opened in all. claimed: the rewards paid: collections
// ('rarity:kind'), sets (a rarity) and 'all'.
// sdaily: the day a season's daily case was last earned.
function newLocker() {
  const l = { v: 1, money: START.money, owned: [], cases: {}, meter: {}, pity: 0, daily: '', sdaily: '', opened: 0, claimed: [] };
  for (const g of CASE_IDS) l.cases[g] = START.cases[g] || 0;
  for (const g of GRADE_IDS) l.meter[g] = 0;
  return l;
}
const isDay = d => typeof d === 'string' && /^\d{4}-\d\d-\d\d$/.test(d);
const rewardKey = k => k === 'all' || has(COLLECTIONS, k) || has(SETS, k) || SERIES_IDS.some(sid => k === sid + ':all' || RARITIES.some(r => k === sid + ':' + r));
// checks a saved locker and returns a clean copy (a new one if there isn't one)
function validateLocker(o) {
  const l = newLocker(); if (!o || typeof o !== 'object' || o.v !== 1) return l;
  const n = (v, max = 1e9) => Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0;
  l.money = n(o.money);
  l.owned = Array.isArray(o.owned) ? [...new Set(o.owned.filter(id => has(ALL, id) && !FREE.includes(id)))] : [];
  for (const g of CASE_IDS) l.cases[g] = n(o.cases && o.cases[g], 999);
  for (const g of GRADE_IDS) l.meter[g] = n(o.meter && o.meter[g], METER - 1);
  l.pity = n(o.pity, PITY - 1); l.daily = isDay(o.daily) ? o.daily : ''; l.sdaily = isDay(o.sdaily) ? o.sdaily : ''; l.opened = n(o.opened);
  l.claimed = Array.isArray(o.claimed) ? [...new Set(o.claimed.filter(rewardKey))] : [];
  return l;
}
// brings another locker (from a career file) into this one without taking anything away: the looks of both, and the
// larger of each amount
function mergeLocker(l, o) {
  const m = validateLocker(o);
  for (const id of m.owned) if (!l.owned.includes(id)) l.owned.push(id);
  l.money = Math.max(l.money, m.money);
  for (const g of CASE_IDS) l.cases[g] = Math.max(l.cases[g], m.cases[g]);
  for (const g of GRADE_IDS) l.meter[g] = Math.max(l.meter[g], m.meter[g]);
  l.opened = Math.max(l.opened, m.opened); if (m.sdaily > l.sdaily) l.sdaily = m.sdaily;
  for (const r of m.claimed) if (!l.claimed.includes(r)) l.claimed.push(r);   // a reward paid in the other locker isn't paid again
  return l;
}
const owns = (l, id) => FREE.includes(id) || l.owned.includes(id);

// opens one of the locker's cases and pays for it: { id, rarity, dup, sold, done } or why not ('unknown', 'none',
// 'money'). A duplicate is sold at once for its rarity's price, except that a mythic is always one not owned yet until
// all the case's are, and a fresh case (treat) always gives one not owned until all its looks are. done: the
// collections and season rewards it completed (see claimCollections). force: see roll().
function openCase(l, grade, rnd, force) {
  if (!has(GRADES, grade)) return 'unknown';
  if (!(l.cases[grade] > 0)) return 'none';
  if (l.money < GRADES[grade].open) return 'money';
  l.cases[grade]--; l.money -= GRADES[grade].open; l.opened++;
  let id = roll(grade, l.pity, rnd, force, GRADES[grade].fresh ? l.owned : null); const rarity = ALL[id].rarity;
  if (rarity === 'mythic' && l.owned.includes(id)) { const left = poolOf(grade, 'mythic').filter(x => !l.owned.includes(x)); if (left.length) id = left[Math.min(left.length - 1, Math.floor(rnd() * left.length))]; }
  const dup = l.owned.includes(id);
  l.pity = RARITIES.indexOf(rarity) >= 2 ? 0 : l.pity + 1;
  if (dup) l.money += RARITY[rarity].sell; else l.owned.push(id);
  return { id, rarity, dup, sold: dup ? RARITY[rarity].sell : 0, done: claimCollections(l) };
}
// a collection's looks (key: 'rarity:kind'); a collection is complete when all are owned (a rarity: all its looks)
const colItems = key => POOL[COLLECTIONS[key].rarity].filter(id => ALL[id].kind === COLLECTIONS[key].kind);
const collected = (l, key) => (has(COLLECTIONS, key) ? colItems(key) : POOL[key]).every(id => l.owned.includes(id));
function payOut(l, c) { l.money += c.money; for (const g in c.cases) l.cases[g] = Math.min(999, l.cases[g] + c.cases[g]); }
// pays the rewards of collections completed since last time, each only once: the collections newly completed
// ('rarity:kind'), then any sets (a rarity) they finish, then 'all' when the last of the fifteen is
function claimCollections(l) {
  const out = [];
  for (const key in COLLECTIONS) if (!l.claimed.includes(key) && collected(l, key)) { l.claimed.push(key); payOut(l, COLLECTIONS[key]); out.push(key); }
  for (const r of RARITIES) if (!l.claimed.includes(r) && KINDS.every(k => l.claimed.includes(r + ':' + k))) { l.claimed.push(r); payOut(l, SETS[r]); out.push(r); }
  if (!l.claimed.includes('all') && RARITIES.every(r => l.claimed.includes(r))) { l.claimed.push('all'); payOut(l, GRAND); out.push('all'); }
  for (const sid of SERIES_IDS) {   // a season: each rarity's six looks, then all of them
    for (const r of RARITIES) { const k = sid + ':' + r; if (!l.claimed.includes(k) && SERIES_POOL[sid][r].every(id => l.owned.includes(id))) { l.claimed.push(k); payOut(l, SERIES[sid].reward[r]); out.push(k); } }
    const k = sid + ':all'; if (!l.claimed.includes(k) && seriesItems(sid).every(id => l.owned.includes(id))) { l.claimed.push(k); payOut(l, SERIES[sid].grand); out.push(k); }
  }
  return out;
}
// the effects a locker has earned, in set order, then the seasons'
const effects = l => [...RARITIES.filter(r => l.claimed.includes(r)).map(r => SETS[r].fx), ...(l.claimed.includes('all') ? [GRAND.fx] : []),
  ...SERIES_IDS.filter(sid => l.claimed.includes(sid + ':all')).map(sid => SERIES[sid].grand.fx)];
// buys a case: 'ok' or why not ('unknown', 'season': a season's case out of its season, 'complete': a fresh case when
// every one of its looks is owned, 'money'). day: the local date, YYYY-MM-DD
function buyCase(l, grade, day) {
  if (!has(GRADES, grade)) return 'unknown';
  const sid = GRADES[grade].series;
  if (sid && !inSeason(sid, day)) return 'season';
  if (sid && GRADES[grade].fresh && seriesItems(sid).every(id => l.owned.includes(id))) return 'complete';
  if (l.money < GRADES[grade].price) return 'money';
  l.money -= GRADES[grade].price; l.cases[grade]++;
  return 'ok';
}
// buys one of the shop's looks outright: 'ok' or why not ('unknown', 'owned', 'money')
function buyLook(l, id) {
  if (!has(K.ITEMS, id)) return 'unknown';
  if (l.owned.includes(id)) return 'owned';
  if (l.money < K.ITEMS[id].price) return 'money';
  l.money -= K.ITEMS[id].price; l.owned.push(id);
  return 'ok';
}

// earning: each returns what was earned, { pay, grade (a case earned, or null), meter: { grade, n } }
function meterStep(l, grade) {
  l.meter[grade]++;
  const full = l.meter[grade] >= METER; if (full) { l.meter[grade] = 0; l.cases[grade]++; }
  return { grade: full ? grade : null, meter: { grade, n: l.meter[grade] } };
}
function cpuFrameWon(l, level) {
  if (!has(CPU_PAY, level)) return null;
  l.money += CPU_PAY[level];
  return { pay: CPU_PAY[level], ...meterStep(l, LEVEL_GRADE[level]) };
}
const careerFrameWon = (l, tier) => ({ pay: 0, ...meterStep(l, TIER_GRADE[tier]) });
// an event won: the cases it gives (prize money is added separately)
function eventWon(l, tier, champ) {
  const top = TIER_GRADE.length - 1, g = TIER_GRADE[Math.min(top, tier + (champ ? 1 : 0))], n = (champ && tier === top ? 2 : 1) * EVENT_CASES;
  l.cases[g] += n;
  return { grade: g, n };
}
// the day's first online win: the reward, or null if today's has been had. day: the local date, YYYY-MM-DD
function onlineWon(l, day) {
  if (l.daily === day) return null;
  l.daily = day; l.money += ONLINE.pay; l.cases[ONLINE.grade] += ONLINE.n;
  return { pay: ONLINE.pay, grade: ONLINE.grade, n: ONLINE.n };
}

// a frame won (one that earns: against the computer, in the career or online) in a season: its daily case, the first
// time each day. Returns { grade, n } or null
function seasonWon(l, day) {
  const sid = SERIES_IDS.find(s => inSeason(s, day)); if (!sid || l.sdaily === day) return null;
  const g = SERIES[sid].daily; l.sdaily = day; l.cases[g] = Math.min(999, l.cases[g] + 1);
  return { grade: g, n: 1 };
}

return { RARITY, RARITIES, GRADES, GRADE_IDS, CASE_IDS, SERIES, SERIES_IDS, SERIES_POOL, SEASON_ITEMS, inSeason, seriesItems, poolOf, seasonWon, PITY, KINDS, COLLECTIONS, SETS, GRAND, EFFECTS, colItems, collected, claimCollections, effects, EVENT_CASES, CPU_PAY, LEVEL_GRADE, TIER_GRADE, METER, ONLINE, START, CASE_ITEMS, FREE_GLOVE, ALL, POOL, FREE,
  roll, reelItems, newLocker, validateLocker, mergeLocker, owns, openCase, buyCase, buyLook, cpuFrameWon, careerFrameWon, eventWon, onlineWon };
})(typeof CAREER !== 'undefined' ? CAREER : require('./career.js'));
if (typeof module !== 'undefined') module.exports = LOOKS;
