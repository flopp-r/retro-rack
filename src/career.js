// ============================================================================
//  RETRO RACK — career: the tournament tour, its opponents, brackets and the saved career.
//  No DOM: runs in the browser after core.js, and in Node for the tests and tools/sim-career.js.
// ============================================================================
const CAREER = ((C) => {
'use strict';

// The computer players met on the tour. look: pixel portrait (sprite style, skin, hair, shirt; game.js draws it).
// base: the CPU level they start from; cfg overrides it (fields as in DIFF in core.js), and nerves multiplies their
// execution error when they're on the final ball; cue: the cue design they use (see SHOP). rating: strength on an
// Elo-style scale where the Medium CPU is 1500 in the same game, measured by playing 80 frames each against the
// Medium CPU in their tier's game with tools/sim-career.js (about ±45). Ratings settle the matches between computer
// players in a draw, and give the stars shown on screen.
const OPPONENTS = {
  dave:    { name: 'Dodgy Dave', full: 'Dave Pike', look: { s: 'cap', skin: '#e8b88f', hair: '#3b2a1a', shirt: '#7a8b3a' },
    blurb: 'Hits everything hard and hopes.', base: 'easy', cfg: { aimSd: 1.5, powSd: 0.18, brk: 0.95 }, rating: 1245 },
  maureen: { name: 'Maureen', full: 'Maureen Jolly', look: { s: 'long', skin: '#f2c49b', hair: '#c9c3bd', shirt: '#b04a7a' },
    blurb: 'Deadly from close range. Long pots, less so.', base: 'easy', cfg: { aimSd: 0.85, powSd: 0.1, long: 0.9, pickTop: 2 }, rating: 1310 },
  mick:    { name: 'Big Mick', full: 'Mick Malone', look: { s: 'bald', skin: '#c98e62', hair: '#3b2a1a', shirt: '#c0392b' },
    blurb: 'Big break, big shots, no safety game.', base: 'medium', cfg: { aimSd: 0.95, powSd: 0.12, variants: [[1.6, 0, 0], [2.3, 0, 0.3]], brk: 1, brkSpin: 0 }, rating: 1270 },
  kev:     { name: 'Kev', full: 'Kev Kissick', look: { s: 'man', skin: '#f2c49b', hair: '#b5432a', shirt: '#e0a526' },
    blurb: 'Never plays the same shot twice. Neither does the cue ball.', base: 'medium', cfg: { aimSd: 0.8, pickTop: 3 }, rating: 1330 },
  gaz:     { name: 'Gaz', full: 'Gaz Pritchard', look: { s: 'man', skin: '#e8b88f', hair: '#d9a441', shirt: '#2f6db5' },
    blurb: 'Pots well, until the black is on.', base: 'medium', cfg: { aimSd: 0.7, nerves: 2.5 }, rating: 1375 },
  priya:   { name: 'Priya', full: 'Priya Shah', look: { s: 'long', skin: '#a8714a', hair: '#1a1206', shirt: '#1d8a74' },
    blurb: 'Tidy. Always thinking about the next ball.', base: 'medium', cfg: { aimSd: 0.7, pos: 0.7 }, rating: 1455 },
  eddie:   { name: 'Steady Eddie', full: 'Eddie Shaw', look: { s: 'glasses', skin: '#f2c49b', hair: '#8a8a8a', shirt: '#56399a' },
    blurb: 'Plays safe at every chance. Patience wins.', base: 'medium', cfg: { aimSd: 0.65, safety: true, potMin: 75 }, rating: 1420 },
  shona:   { name: 'Shona', full: 'Shona McLeod', look: { s: 'long', skin: '#f6d2b4', hair: '#b5432a', shirt: '#e0a526' },
    blurb: 'A natural potter, long or short.', base: 'medium', cfg: { aimSd: 0.5, pos: 0.5 }, rating: 1515 },
  ray:     { name: 'The Landlord', full: 'Ray Doyle', look: { s: 'beard', skin: '#d9a07a', hair: '#4a4a4a', shirt: '#5a2d1b' },
    blurb: 'Pub champion nine years running. Rarely misses, but feels the pressure.', base: 'hard', cfg: { aimSd: 0.4, powSd: 0.06, robust: 1, bih: 4, nerves: 1.8 }, rating: 1560, cue: 'ash' },
  // the club circuit (8-ball)
  perry:   { name: 'Posh Perry', full: 'Peregrine Hale', look: { s: 'glasses', skin: '#f6d2b4', hair: '#d9a441', shirt: '#1e3263' },
    blurb: 'Plays in a waistcoat. Plays it safe.', base: 'medium', cfg: { aimSd: 0.65, safety: true, potMin: 60 }, rating: 1430 },
  bev:     { name: 'Bev', full: 'Bev Okafor', look: { s: 'long', skin: '#6b4429', hair: '#1a1206', shirt: '#e0a526' },
    blurb: 'Club secretary. Knows every roll of these cushions.', base: 'medium', cfg: { aimSd: 0.6, pos: 0.6 }, rating: 1470 },
  danny:   { name: 'The Kid', full: 'Danny Reyes', look: { s: 'cap', skin: '#c98e62', hair: '#1a1206', shirt: '#ff6f8f' },
    blurb: 'Seventeen, fearless, a little wild. Wobbles on the black.', base: 'medium', cfg: { aimSd: 0.6, powSd: 0.1, pickTop: 3, nerves: 1.8 }, rating: 1420 },
  hamish:  { name: 'Hamish', full: 'Hamish Grant', look: { s: 'beard', skin: '#f2c49b', hair: '#b5432a', shirt: '#2d8a3c' },
    blurb: 'Slow, methodical, and very hard to get past.', base: 'medium', cfg: { aimSd: 0.55 }, rating: 1500 },
  lin:     { name: 'Lin', full: 'Lin Zhao', look: { s: 'long', skin: '#f2d0a4', hair: '#1a1206', shirt: '#56399a' },
    blurb: 'Cuts the thinnest of balls. Long pots are her weak spot.', base: 'medium', cfg: { aimSd: 0.45, long: 0.5 }, rating: 1500 },
  tommo:   { name: 'Tommo', full: 'Tom Ashworth', look: { s: 'bald', skin: '#e8b88f', hair: '#3b2a1a', shirt: '#7a8b3a' },
    blurb: 'Breaks like thunder. Everything after that is a bonus.', base: 'medium', cfg: { aimSd: 0.6, variants: [[1.5, 0, 0], [2.2, 0, 0.3]], brk: 1, brkSpin: 0 }, rating: 1430 },
  aisha:   { name: 'Aisha', full: 'Aisha Bello', look: { s: 'long', skin: '#a8714a', hair: '#1a1206', shirt: '#1d8a74' },
    blurb: 'A smooth stroke and a calm head.', base: 'medium', cfg: { aimSd: 0.45, pos: 0.7 }, rating: 1550 },
  frank:   { name: 'Fingers', full: 'Frank Dolan', look: { s: 'man', skin: '#f2c49b', hair: '#c9c3bd', shirt: '#86263f' },
    blurb: 'A master of spin. Screw, stun and side on every shot.', base: 'medium', cfg: { aimSd: 0.5, refine: 2, variants: [[1.3, 0, 0], [1.9, 0, 0.3], [1.7, 0, -0.5], [1.7, 0.4, 0]] }, rating: 1550, cue: 'racing' },
  duchess: { name: 'The Duchess', full: 'Victoria Lane', look: { s: 'long', skin: '#f6d2b4', hair: '#c9c3bd', shirt: '#56399a' },
    blurb: 'Club champion. Expects to win, and usually does.', base: 'hard', cfg: { aimSd: 0.38, robust: 1, bih: 4, nerves: 1.5 }, rating: 1600, cue: 'gold' },
  // the hall circuit (8-ball)
  marco:   { name: 'Marco', full: 'Marco Bianchi', look: { s: 'man', skin: '#d9a07a', hair: '#1a1206', shirt: '#c0392b' },
    blurb: 'Hustles the tourists. You are not a tourist.', base: 'medium', cfg: { aimSd: 0.5, pickTop: 2 }, rating: 1510 },
  jade:    { name: 'Jade', full: 'Jade Kowalski', look: { s: 'cap', skin: '#f6d2b4', hair: '#d9a441', shirt: '#1d8a74' },
    blurb: 'Plays fast and pots faster.', base: 'medium', cfg: { aimSd: 0.45, powSd: 0.09 }, rating: 1530 },
  lou:     { name: 'Big Lou', full: 'Louis Fontaine', look: { s: 'bald', skin: '#6b4429', hair: '#1a1206', shirt: '#e0a526' },
    blurb: 'Owns the hall. Lets nobody forget it.', base: 'medium', cfg: { aimSd: 0.45, brk: 1, brkSpin: 0 }, rating: 1530, cue: 'ebony' },
  sunil:   { name: 'Sunil', full: 'Sunil Rao', look: { s: 'glasses', skin: '#a8714a', hair: '#1a1206', shirt: '#2f6db5' },
    blurb: 'Never out of position.', base: 'hard', cfg: { aimSd: 0.45, pos: 1.2, robust: 0 }, rating: 1560 },
  smokey:  { name: 'Smokey Joe', full: 'Joe Kirby', look: { s: 'beard', skin: '#e8b88f', hair: '#8a8a8a', shirt: '#2d2344' },
    blurb: 'Plays the percentages. Leaves you nothing.', base: 'hard', cfg: { aimSd: 0.42, safety: true, potMin: 70, robust: 1 }, rating: 1580 },
  rosa:    { name: 'Rosa', full: 'Rosa Delgado', look: { s: 'long', skin: '#c98e62', hair: '#3b2a1a', shirt: '#ff6f8f' },
    blurb: 'Fearless long potter.', base: 'hard', cfg: { aimSd: 0.38, robust: 0 }, rating: 1600 },
  ivan:    { name: 'Ivan', full: 'Ivan Petrov', look: { s: 'man', skin: '#f6d2b4', hair: '#d9a441', shirt: '#141018' },
    blurb: 'Silent. Relentless.', base: 'hard', cfg: { aimSd: 0.35, robust: 1 }, rating: 1630 },
  kaz:     { name: 'Kaz', full: 'Kaz Nakamura', look: { s: 'glasses', skin: '#f2d0a4', hair: '#1a1206', shirt: '#5a2d1b' },
    blurb: 'A safety specialist. Patience is the whole game.', base: 'hard', cfg: { aimSd: 0.35, safety: true, potMin: 80, robust: 1 }, rating: 1630 },
  professor: { name: 'The Professor', full: 'Alan Whitby', look: { s: 'beard', skin: '#f2c49b', hair: '#c9c3bd', shirt: '#5a2d1b' },
    blurb: 'Wrote the book on eight-ball. Gets flustered when it goes off script.', base: 'hard', cfg: { aimSd: 0.3, robust: 2, nerves: 1.4 }, rating: 1680, cue: 'ebony' },
  // the national tour (9-ball)
  callum:  { name: 'Callum', full: 'Callum Fraser', look: { s: 'man', skin: '#f6d2b4', hair: '#b5432a', shirt: '#1e3263' },
    blurb: 'A big break and a bigger grin.', base: 'hard', cfg: { aimSd: 0.42, robust: 0, brk: 1, brkSpin: 0 }, rating: 1580 },
  mei:     { name: 'Mei', full: 'Mei Tanaka', look: { s: 'long', skin: '#f2d0a4', hair: '#1a1206', shirt: '#ff6f8f' },
    blurb: 'Precise, patient, unhurried.', base: 'hard', cfg: { aimSd: 0.38, robust: 1 }, rating: 1610 },
  gareth:  { name: 'Gareth', full: 'Gareth Owen', look: { s: 'beard', skin: '#e8b88f', hair: '#3b2a1a', shirt: '#c0392b' },
    blurb: 'Rugby build, feather touch.', base: 'hard', cfg: { aimSd: 0.36, robust: 1 }, rating: 1620 },
  nadia:   { name: 'Nadia', full: 'Nadia Haddad', look: { s: 'long', skin: '#c98e62', hair: '#1a1206', shirt: '#e0a526' },
    blurb: 'Plans three balls ahead.', base: 'hard', cfg: { aimSd: 0.34, pos: 1.2, robust: 1 }, rating: 1640 },
  ollie:   { name: 'Ollie', full: 'Ollie Brooks', look: { s: 'cap', skin: '#f2c49b', hair: '#d9a441', shirt: '#2d8a3c' },
    blurb: 'Brilliant, until the nine is the only ball left.', base: 'hard', cfg: { aimSd: 0.33, robust: 1, nerves: 2 }, rating: 1640 },
  svetlana: { name: 'Svetlana', full: 'Svetlana Morozova', look: { s: 'long', skin: '#f6d2b4', hair: '#d9a441', shirt: '#2d2344' },
    blurb: 'Plays safe until you crack.', base: 'hard', cfg: { aimSd: 0.3, safety: true, potMin: 60, robust: 2 }, rating: 1670 },
  devm:    { name: 'Dev', full: 'Dev Mistry', look: { s: 'glasses', skin: '#a8714a', hair: '#1a1206', shirt: '#56399a' },
    blurb: 'Quiet, quick and deadly accurate.', base: 'hard', cfg: { aimSd: 0.3, robust: 1 }, rating: 1670, cue: 'arcade' },
  erin:    { name: 'Erin', full: 'Erin Gallagher', look: { s: 'long', skin: '#f6d2b4', hair: '#b5432a', shirt: '#1d8a74' },
    blurb: 'Last year\'s runner-up, and hungry.', base: 'hard', cfg: { aimSd: 0.28, robust: 2 }, rating: 1690, cue: 'racing' },
  viktor:  { name: 'The Metronome', full: 'Viktor Strand', look: { s: 'bald', skin: '#f2c49b', hair: '#3b2a1a', shirt: '#141018' },
    blurb: 'Reigning national champion. Same rhythm every shot, until the pressure is on.', base: 'hard', cfg: { aimSd: 0.26, robust: 3, nerves: 1.5 }, rating: 1710, cue: 'champion' },
};

// The shop: looks bought with prize money. Cloths and cues only, so the balls always stay easy to read. Bought looks
// work in every game (game.js keeps them in its settings, S.owned); online, both players see each other's cue and the
// host's cloth. Cue colours: shaft, joint, forearm, wrap, butt sleeve and the inlay points.
const HOUSE_CUE = { shaft: '#e3c68f', joint: '#cfd0dc', fore: '#5a2d1b', wrap: '#2d2344', butt: '#a03d2a', inlay: '#ffc56b' };
const SHOP = [
  { id: 'charcoal', kind: 'cloth', name: 'Charcoal', price: 100, col: '#3d434c' },
  { id: 'navy', kind: 'cloth', name: 'Navy', price: 250, col: '#1e3263' },
  { id: 'olive', kind: 'cloth', name: 'Olive', price: 400, col: '#5d6b2c' },
  { id: 'tan', kind: 'cloth', name: 'Tan', price: 600, col: '#9a7447' },
  { id: 'ice', kind: 'cloth', name: 'Ice blue', price: 900, col: '#5c8fb0' },
  { id: 'ash', kind: 'cue', name: 'Ash', price: 150, col: { shaft: '#ecd9ad', joint: '#cfd0dc', fore: '#b8925a', wrap: '#3a3a3a', butt: '#6b4b2a', inlay: '#f7ead2' } },
  { id: 'ebony', kind: 'cue', name: 'Ebony', price: 400, col: { shaft: '#e3c68f', joint: '#e8e8ee', fore: '#1d1a22', wrap: '#4e3270', butt: '#141018', inlay: '#f7ead2' } },
  { id: 'racing', kind: 'cue', name: 'Racing red', price: 700, col: { shaft: '#e3c68f', joint: '#141018', fore: '#c0392b', wrap: '#141018', butt: '#f7ead2', inlay: '#141018' } },
  { id: 'arcade', kind: 'cue', name: 'Arcade', price: 1200, col: { shaft: '#f7ead2', joint: '#6cb8ff', fore: '#ff6f8f', wrap: '#1a1433', butt: '#6cb8ff', inlay: '#ffc56b' } },
  { id: 'gold', kind: 'cue', name: 'Gold rush', price: 2500, col: { shaft: '#e3c68f', joint: '#ffd36b', fore: '#2a2238', wrap: '#141018', butt: '#d9a441', inlay: '#ffd36b' } },
  { id: 'champion', kind: 'cue', name: 'Champion', price: 5000, col: { shaft: '#f1e4c4', joint: '#d9a441', fore: '#f7ead2', wrap: '#1a1433', butt: '#f7ead2', inlay: '#d9a441' } },
];
const ITEMS = Object.fromEntries(SHOP.map(it => [it.id, it]));
// is id one of obj's own entries? (plain lookups would also find built-in names such as "__proto__")
const has = (obj, id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(obj, id);
// buys a look with the career's money: 'ok', or why not ('owned', 'money', 'unknown')
function buy(career, id) {
  if (!has(ITEMS, id)) return 'unknown';
  const it = ITEMS[id];
  if (career.bought.includes(id)) return 'owned';
  if (career.money < it.price) return 'money';
  career.money -= it.price; career.bought.push(id);
  return 'ok';
}

// The tour, tier by tier. Each event is an 8-player knockout: you and seven of the tier's players. races: frames
// needed to win the quarter-final, semi-final and final. prize: money for going out in each of those rounds, then
// for winning. Winning an event opens the next one; winning the last opens the next tier.
const TIERS = [
  { id: 'pub', name: 'The pub circuit', short: 'Pub', champ: 'the pub champion', mode: 'uk8', events: [
    { id: 'redlion', name: 'The Red Lion Open', sign: 'RED LION', field: ['dave', 'maureen', 'mick', 'kev', 'gaz', 'priya', 'eddie'], races: [2, 2, 3], prize: [10, 25, 50, 100] },
    { id: 'crown', name: 'The Crown Cup', sign: 'THE CROWN', field: ['maureen', 'mick', 'kev', 'gaz', 'priya', 'eddie', 'shona'], races: [2, 3, 3], prize: [20, 50, 100, 200], blackOne: true },
    { id: 'pubchamp', name: 'The Pub Championship', sign: 'PUB CHAMPS', field: ['mick', 'kev', 'gaz', 'priya', 'eddie', 'shona', 'ray'], races: [3, 3, 4], prize: [40, 100, 200, 400] },
  ] },
  { id: 'club', name: 'The club circuit', short: 'Club', champ: 'the club champion', mode: '8ball', events: [
    { id: 'oakfield', name: 'The Oakfield Classic', sign: 'OAKFIELD', field: ['perry', 'bev', 'danny', 'hamish', 'lin', 'tommo', 'aisha'], races: [2, 3, 3], prize: [50, 120, 250, 500] },
    { id: 'riverside', name: 'The Riverside Cup', sign: 'RIVERSIDE', field: ['bev', 'danny', 'hamish', 'lin', 'tommo', 'aisha', 'frank'], races: [3, 3, 4], prize: [80, 200, 400, 800] },
    { id: 'clubchamp', name: 'The Club Championship', sign: 'CLUB CHAMPS', field: ['danny', 'hamish', 'lin', 'tommo', 'aisha', 'frank', 'duchess'], races: [3, 4, 4], prize: [120, 300, 600, 1200] },
  ] },
  { id: 'hall', name: 'The hall circuit', short: 'Hall', champ: 'the hall champion', mode: '8ball', events: [
    { id: 'downtown', name: 'The Downtown Open', sign: 'DOWNTOWN', field: ['marco', 'jade', 'lou', 'sunil', 'smokey', 'rosa', 'ivan'], races: [3, 4, 4], prize: [100, 250, 500, 1000] },
    { id: 'shootout', name: 'The Eight-Ball Shootout', sign: 'SHOOTOUT', field: ['jade', 'lou', 'sunil', 'smokey', 'rosa', 'ivan', 'kaz'], races: [3, 4, 5], prize: [150, 400, 750, 1500] },
    { id: 'halloffame', name: 'The Hall of Fame Trophy', sign: 'HALL OF FAME', field: ['lou', 'sunil', 'smokey', 'rosa', 'ivan', 'kaz', 'professor'], races: [4, 4, 5], prize: [200, 500, 1000, 2000] },
  ] },
  { id: 'national', name: 'The national tour', short: 'National', champ: 'the national champion', mode: '9ball', events: [
    { id: 'northern', name: 'The Northern Open', sign: 'NORTHERN', field: ['callum', 'mei', 'gareth', 'nadia', 'ollie', 'svetlana', 'devm'], races: [4, 5, 5], prize: [300, 750, 1500, 3000] },
    { id: 'masters', name: 'The Masters', sign: 'MASTERS', field: ['mei', 'gareth', 'nadia', 'ollie', 'svetlana', 'devm', 'erin'], races: [4, 5, 6], prize: [400, 1000, 2000, 4000] },
    { id: 'nationals', name: 'The National Championship', sign: 'NATIONALS', field: ['gareth', 'nadia', 'ollie', 'svetlana', 'devm', 'erin', 'viktor'], races: [5, 5, 7], prize: [600, 1500, 3000, 6000] },
  ] },
];
const ROUNDS = ['Quarter-final', 'Semi-final', 'Final'];
const YOU = 'you';
const EVENTS = {};
TIERS.forEach((t, ti) => t.events.forEach((e, i) => { EVENTS[e.id] = { ...e, tier: ti, index: i, mode: t.mode }; }));

// a small seeded random generator, so the draw and the other players' results never change on reloading
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// stars: 1 to 5 across the whole tour: the pub players get 1 to 3, the national tour's best 5 (1340 is 2 stars,
// 1460 is 3, 1590 is 4, 1710 is 5)
const stars = id => id === YOU ? 0 : Math.max(1, Math.min(5, Math.round((OPPONENTS[id].rating - 1090) / 123)));
// the tier an opponent belongs to: the first whose events they play in
const tierOf = id => TIERS.findIndex(t => t.events.some(e => e.field.includes(id)));
const nameOf = (career, id) => id === YOU ? career.name : OPPONENTS[id].name;

function newCareer({ name, look, guide }, now) {
  return { v: 1, name: cleanName(name), look: cleanLook(look), guide: GUIDES.includes(guide) ? guide : 'line', created: now, money: 0, earned: 0,
    bought: [], trophies: [], done: {}, history: [], run: null, last: null };
}
const GUIDES = ['full', 'line', 'ghost', 'min'];
const cleanName = s => String(s || '').replace(/[<>]/g, '').trim().slice(0, 14) || 'You';
const HEX = /^#[0-9a-f]{6}$/i, STYLES = ['man', 'long', 'bald', 'cap', 'glasses', 'beard'];
function cleanLook(l) {
  l = l || {};
  return { s: STYLES.includes(l.s) ? l.s : 'man', skin: HEX.test(l.skin) ? l.skin : '#f2c49b', hair: HEX.test(l.hair) ? l.hair : '#5a3420', shirt: HEX.test(l.shirt) ? l.shirt : '#ffc56b' };
}

function unlocked(career, eventId) {
  const e = EVENTS[eventId]; if (!e) return false;
  if (e.index > 0) return (career.done[TIERS[e.tier].events[e.index - 1].id] || {}).won > 0;
  return e.tier === 0 || tierDone(career, e.tier - 1);
}
function tierDone(career, ti) { const evs = TIERS[ti].events; return (career.done[evs[evs.length - 1].id] || {}).won > 0; }

// a new draw: the two strongest players are seeded into opposite halves; everyone else, you included, is drawn at random
function enterEvent(career, eventId, seed) {
  const e = EVENTS[eventId];
  if (!e || career.run || !unlocked(career, eventId)) return false;
  const r = rng(seed), field = [...e.field].sort((a, b) => OPPONENTS[b].rating - OPPONENTS[a].rating);
  const rest = [YOU, ...field.slice(2)];
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  const slots = [field[0], ...rest.slice(0, 3), ...rest.slice(3), field[1]];
  career.run = { event: eventId, seed: seed >>> 0, slots, round: 0, res: [], scores: [], match: null };
  setMatch(career);
  return true;
}
// who meets whom in a round: pairs of slots in round 0, then pairs of the previous round's winners
const entrants = (run, round) => round === 0 ? run.slots : run.res[round - 1];
function setMatch(career) {
  const run = career.run, e = EVENTS[run.event], list = entrants(run, run.round), i = list.indexOf(YOU);
  run.match = { opp: list[i ^ 1], race: e.races[run.round], wins: [0, 0], breaker: rng(run.seed + 7 * run.round + 1)() < 0.5 ? 0 : 1, snap: null };
}
function simMatch(a, b, race, r) {
  const p = 1 / (1 + Math.pow(10, (OPPONENTS[b].rating - OPPONENTS[a].rating) / 400)), w = [0, 0];
  while (Math.max(w[0], w[1]) < race) w[r() < p ? 0 : 1]++;
  return w;
}
// plays out a round: your result as given, the computer players' matches from their ratings
function playRound(run, round, yours) {
  const e = EVENTS[run.event], list = entrants(run, round), r = rng(run.seed * 31 + round + 1), res = [], scores = [];
  for (let m = 0; m < list.length / 2; m++) {
    const a = list[2 * m], b = list[2 * m + 1];
    const w = a === YOU ? yours : b === YOU ? [yours[1], yours[0]] : simMatch(a, b, e.races[round], r);
    res.push(w[0] > w[1] ? a : b); scores.push(w);
  }
  run.res[round] = res; run.scores[round] = scores;
}
// your match is over (wins: [yours, theirs]). Returns what happened, for the result screen.
function recordMatch(career, wins) {
  const run = career.run; if (!run || !run.match) return null;
  const e = EVENTS[run.event], round = run.round, opp = run.match.opp, won = wins[0] > wins[1];
  playRound(run, round, wins);
  const out = { event: e.id, round, opp, wins: [...wins], won, prize: 0, champion: false, tierDone: false };
  career.history.unshift({ event: e.id, round, opp, wins: [...wins] }); career.history.length = Math.min(career.history.length, 20);
  if (won && round < ROUNDS.length - 1) { run.round++; setMatch(career); return out; }
  // the event is over for you: finish the bracket so it can be shown, then pay out
  for (let rd = round + 1; rd < ROUNDS.length; rd++) playRound(run, rd, null);
  out.prize = e.prize[won ? ROUNDS.length : round];
  out.champion = won;
  career.money += out.prize; career.earned += out.prize;
  const d = career.done[e.id] = career.done[e.id] || { played: 0, won: 0, best: -1 };
  d.played++; if (won) d.won++; d.best = Math.max(d.best, won ? ROUNDS.length : round);
  if (won) { career.trophies.push({ event: e.id }); out.tierDone = e.index === TIERS[e.tier].events.length - 1 && d.won === 1; }
  career.last = { event: e.id, slots: run.slots, res: run.res, scores: run.scores, result: won ? ROUNDS.length : round };
  career.run = null;
  return out;
}
// giving up an event: counts as losing your current match
function withdraw(career) {
  const run = career.run; if (!run) return null;
  const race = run.match ? run.match.race : 1;
  return recordMatch(career, [run.match ? Math.min(run.match.wins[0], race - 1) : 0, race]);
}

// true when the shooter is on the last ball of the frame: the black in 8-ball and reds & yellows, the 9 when it's alone
function onFinalBall(game, balls, player) {
  const left = balls.filter(b => b.id && !b.potted);
  if (game.mode === '9ball') return left.length === 1;
  const g = game.groups[player];
  return !!g && !left.some(b => b.id !== 8 && C.groupOf(b.id) === g);
}
// the CPU settings for an opponent; pressure: { onFinal } when they're on the last ball of the frame
function profileFor(id, pressure = {}) {
  const o = OPPONENTS[id], cfg = { ...C.DIFF[o.base], ...o.cfg };
  if (pressure.onFinal && o.cfg.nerves) { cfg.aimSd *= o.cfg.nerves; cfg.powSd *= o.cfg.nerves; }
  return cfg;
}

// checks a saved or imported career, and returns a clean copy (or null if it isn't one)
function validate(c) {
  if (!c || typeof c !== 'object' || c.v !== 1 || typeof c.name !== 'string') return null;
  const num = (v, d = 0) => Number.isFinite(v) ? v : d;
  const out = newCareer({ name: c.name, look: c.look, guide: c.guide }, num(c.created));
  out.money = Math.max(0, Math.round(num(c.money)));
  out.earned = Math.max(out.money, Math.round(num(c.earned, out.money)));   // saves from before the shop: all of it was won
  out.bought = Array.isArray(c.bought) ? [...new Set(c.bought.filter(id => has(ITEMS, id)))] : [];
  out.trophies = Array.isArray(c.trophies) ? c.trophies.filter(t => t && has(EVENTS, t.event)).map(t => ({ event: t.event })) : [];
  for (const [k, d] of Object.entries(c.done && typeof c.done === 'object' ? c.done : {}))
    if (has(EVENTS, k) && d) out.done[k] = { played: Math.max(0, num(d.played) | 0), won: Math.max(0, num(d.won) | 0), best: num(d.best, -1) | 0 };
  out.history = Array.isArray(c.history) ? c.history.filter(h => h && has(EVENTS, h.event) && has(OPPONENTS, h.opp) && Array.isArray(h.wins)).slice(0, 20) : [];
  const okIds = a => Array.isArray(a) && a.every(id => id === YOU || has(OPPONENTS, id));
  const r = c.run;
  if (r && has(EVENTS, r.event) && okIds(r.slots) && r.slots.length === 8 && r.slots.includes(YOU) && Number.isInteger(r.round) && r.round >= 0 && r.round < ROUNDS.length
    && Array.isArray(r.res) && r.res.length === r.round && r.res.every(okIds) && r.match && has(OPPONENTS, r.match.opp)) {
    const m = r.match;
    out.run = { event: r.event, seed: num(r.seed) >>> 0, slots: [...r.slots], round: r.round, res: r.res.map(x => [...x]), scores: Array.isArray(r.scores) ? r.scores : [],
      match: { opp: m.opp, race: EVENTS[r.event].races[r.round], wins: [num(m.wins && m.wins[0]) | 0, num(m.wins && m.wins[1]) | 0], breaker: m.breaker === 1 ? 1 : 0, snap: m.snap && Array.isArray(m.snap.balls) && m.snap.game ? m.snap : null } };
  }
  if (c.last && has(EVENTS, c.last.event) && okIds(c.last.slots)) out.last = c.last;
  return out;
}

return { OPPONENTS, TIERS, EVENTS, ROUNDS, YOU, SHOP, ITEMS, HOUSE_CUE, has, rng, stars, tierOf, nameOf, newCareer, unlocked, tierDone, enterEvent, entrants,
  recordMatch, withdraw, onFinalBall, profileFor, validate, simMatch, buy };
})(typeof CORE !== 'undefined' ? CORE : require('./core.js'));
if (typeof module !== 'undefined') module.exports = CAREER;
