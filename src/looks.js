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
};
const RARITIES = Object.keys(RARITY);
// Case grades, from playing the easier levels up to the hardest. odds: percent chance of each rarity, in RARITIES
// order (legendaries only in the two best). open: what opening one costs. price: what buying one costs.
const GRADES = {
  bronze: { name: 'Bronze case', col: '#c98a4b', odds: [72, 24, 4, 0], open: 15, price: 45 },
  silver: { name: 'Silver case', col: '#c9d1dc', odds: [50, 36, 12, 2], open: 40, price: 110 },
  gold: { name: 'Gold case', col: '#ffd36b', odds: [25, 45, 24, 6], open: 90, price: 260 },
  diamond: { name: 'Diamond case', col: '#7fe8ff', odds: [0, 50, 36, 14], open: 200, price: 600 },
};
const GRADE_IDS = Object.keys(GRADES);
const PITY = 8;   // at least one epic or better in every 8 cases opened

// What playing earns. A frame won against the computer pays money and moves that level's case meter on; METER frames
// fill it. Career frames fill the meter of the tier's grade (prize money is their pay). An event won gives a case of
// the tier's grade, its championship the grade above (two of the best at the top). The day's first online win gives
// ONLINE. Practice and same-device games earn nothing.
const CPU_PAY = { easy: 5, medium: 15, hard: 30, expert: 50 };
const LEVEL_GRADE = { easy: 'bronze', medium: 'silver', hard: 'gold', expert: 'diamond' };
const TIER_GRADE = ['bronze', 'silver', 'gold', 'diamond'];
const METER = 3;
const ONLINE = { pay: 30, grade: 'gold' };
// a new locker: one silver case and the money to open it, so everyone can try a case straight away
const START = { money: 40, cases: { silver: 1 } };

// The catalogue. Cloths: col, and a pattern (pat: kind, col2 its colour, kept close to the cloth so the balls stay
// easy to see). Cues: the six colours of a design (see career.js), plus an optional pattern on the forearm and butt
// (pat: kind and colour) and an effect (fx: glow, rainbow, neon). Gloves: base, accent and cuff colours, a glove type
// (style; skin for the bare fingers of wraps and fingerless gloves) and an optional effect (fx: glow, flicker, ghost;
// fxc the glow colour).
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
  { id: 'q-rainbow', kind: 'cue', name: 'Spectrum', rarity: 'legendary', col: cue('#f1e4c4', '#ffffff', '#ff4d4d', '#141018', '#4d6bff', '#ffffff'), fx: 'rainbow' },
  { id: 'q-neon', kind: 'cue', name: 'Neon', rarity: 'legendary', col: cue('#2a2238', '#ff4fd8', '#141018', '#141018', '#141018', '#4ff0ff'), pat: 'rings', pc: '#4ff0ff', fx: 'neon' },
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
];
// the free glove everyone starts with ('none' shows no gloves at all)
const FREE_GLOVE = { id: 'g-white', kind: 'glove', name: 'Classic white', rarity: 'common', base: '#f4f1ea', accent: '#1a1433', cuff: '#ffffff', style: 'sport' };
// every look by id: the shop's (career.js), the cases', and the free glove
const ALL = Object.fromEntries([...K.SHOP, ...CASE_ITEMS, FREE_GLOVE].map(it => [it.id, it]));
const POOL = Object.fromEntries(RARITIES.map(r => [r, CASE_ITEMS.filter(it => it.rarity === r).map(it => it.id)]));
const FREE = ['house', 'none', FREE_GLOVE.id];   // looks everyone owns (with the five original cloths, in game.js)

// Picks what a case gives. The rarity comes from the grade's odds, except that after PITY - 1 cases in a row without
// an epic or better, only epic and legendary can come up (in the grade's proportions of the two). The item is then any
// of that rarity, all equally likely. rnd: a function giving numbers from 0 up to 1.
function roll(grade, pity, rnd) {
  const odds = [...GRADES[grade].odds];
  if (pity >= PITY - 1) odds[0] = odds[1] = 0;
  let r = rnd() * odds.reduce((a, b) => a + b, 0), ri = 0;
  while (ri < odds.length - 1 && (r >= odds[ri] || !odds[ri])) { r -= odds[ri]; ri++; }
  while (!odds[ri]) ri--;   // rounding at the very top end
  const pool = POOL[RARITIES[ri]];
  return pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
}
// the items shown passing on the reel: drawn by the case's own odds, without the guarantee, so they show what the
// case really holds
const reelItems = (grade, n, rnd) => Array.from({ length: n }, () => roll(grade, 0, rnd));

// The locker. money: what's left to spend. owned: looks owned beyond the free ones. cases: unopened cases by grade.
// meter: frames towards the next case of each grade. pity: cases opened since the last epic or better. daily: the day
// (YYYY-MM-DD) of the last online win that paid. opened: cases opened in all.
function newLocker() {
  const l = { v: 1, money: START.money, owned: [], cases: {}, meter: {}, pity: 0, daily: '', opened: 0 };
  for (const g of GRADE_IDS) { l.cases[g] = START.cases[g] || 0; l.meter[g] = 0; }
  return l;
}
// checks a saved locker and returns a clean copy (a new one if there isn't one)
function validateLocker(o) {
  const l = newLocker(); if (!o || typeof o !== 'object' || o.v !== 1) return l;
  const n = (v, max = 1e9) => Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0;
  l.money = n(o.money);
  l.owned = Array.isArray(o.owned) ? [...new Set(o.owned.filter(id => has(ALL, id) && !FREE.includes(id)))] : [];
  for (const g of GRADE_IDS) { l.cases[g] = n(o.cases && o.cases[g], 999); l.meter[g] = n(o.meter && o.meter[g], METER - 1); }
  l.pity = n(o.pity, PITY - 1); l.daily = typeof o.daily === 'string' && /^\d{4}-\d\d-\d\d$/.test(o.daily) ? o.daily : ''; l.opened = n(o.opened);
  return l;
}
// brings another locker (from a career file) into this one without taking anything away: the looks of both, and the
// larger of each amount
function mergeLocker(l, o) {
  const m = validateLocker(o);
  for (const id of m.owned) if (!l.owned.includes(id)) l.owned.push(id);
  l.money = Math.max(l.money, m.money);
  for (const g of GRADE_IDS) { l.cases[g] = Math.max(l.cases[g], m.cases[g]); l.meter[g] = Math.max(l.meter[g], m.meter[g]); }
  l.opened = Math.max(l.opened, m.opened);
  return l;
}
const owns = (l, id) => FREE.includes(id) || l.owned.includes(id);

// opens one of the locker's cases and pays for it: { id, rarity, dup, sold } or why not ('unknown', 'none', 'money').
// A duplicate is sold at once for its rarity's price.
function openCase(l, grade, rnd) {
  if (!has(GRADES, grade)) return 'unknown';
  if (!(l.cases[grade] > 0)) return 'none';
  if (l.money < GRADES[grade].open) return 'money';
  l.cases[grade]--; l.money -= GRADES[grade].open; l.opened++;
  const id = roll(grade, l.pity, rnd), rarity = ALL[id].rarity, dup = l.owned.includes(id);
  l.pity = RARITIES.indexOf(rarity) >= 2 ? 0 : l.pity + 1;
  if (dup) l.money += RARITY[rarity].sell; else l.owned.push(id);
  return { id, rarity, dup, sold: dup ? RARITY[rarity].sell : 0 };
}
// buys a case: 'ok' or why not
function buyCase(l, grade) {
  if (!has(GRADES, grade)) return 'unknown';
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
  const top = TIER_GRADE.length - 1, g = TIER_GRADE[Math.min(top, tier + (champ ? 1 : 0))], n = champ && tier === top ? 2 : 1;
  l.cases[g] += n;
  return { grade: g, n };
}
// the day's first online win: the reward, or null if today's has been had. day: the local date, YYYY-MM-DD
function onlineWon(l, day) {
  if (l.daily === day) return null;
  l.daily = day; l.money += ONLINE.pay; l.cases[ONLINE.grade]++;
  return { pay: ONLINE.pay, grade: ONLINE.grade };
}

return { RARITY, RARITIES, GRADES, GRADE_IDS, PITY, CPU_PAY, LEVEL_GRADE, TIER_GRADE, METER, ONLINE, START, CASE_ITEMS, FREE_GLOVE, ALL, POOL, FREE,
  roll, reelItems, newLocker, validateLocker, mergeLocker, owns, openCase, buyCase, buyLook, cpuFrameWon, careerFrameWon, eventWon, onlineWon };
})(typeof CAREER !== 'undefined' ? CAREER : require('./career.js'));
if (typeof module !== 'undefined') module.exports = LOOKS;
