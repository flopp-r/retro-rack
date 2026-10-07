// ============================================================================
//  RETRO RACK — career: the tournament tour, its opponents, brackets and the saved career.
//  No DOM: runs in the browser after core.js, and in Node for the tests and tools/sim-career.js.
// ============================================================================
const CAREER = ((C) => {
'use strict';

// The computer players met on the tour. look: pixel portrait (sprite style, skin, hair, shirt; game.js draws it).
// base: the CPU level they start from; cfg overrides it (fields as in DIFF in core.js), and nerves multiplies their
// execution error when they're on the final ball. rating: strength on an Elo-style scale where the Medium CPU is
// 1500, measured by playing 80 frames each against the Medium CPU with tools/sim-career.js (about ±45). Ratings settle the matches
// between computer players in a bracket, and give the stars shown on screen.
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
    blurb: 'Pub champion nine years running. Rarely misses, but feels the pressure.', base: 'hard', cfg: { aimSd: 0.4, powSd: 0.06, robust: 1, bih: 4, nerves: 1.8 }, rating: 1560 },
};

// The tour, tier by tier. Each event is an 8-player knockout: you and seven of the tier's players. races: frames
// needed to win the quarter-final, semi-final and final. prize: money for going out in each of those rounds, then
// for winning. Winning an event opens the next one; winning the last opens the next tier.
const TIERS = [
  { id: 'pub', name: 'The pub circuit', champ: 'the pub champion', mode: 'uk8', events: [
    { id: 'redlion', name: 'The Red Lion Open', field: ['dave', 'maureen', 'mick', 'kev', 'gaz', 'priya', 'eddie'], races: [2, 2, 3], prize: [10, 25, 50, 100] },
    { id: 'crown', name: 'The Crown Cup', field: ['maureen', 'mick', 'kev', 'gaz', 'priya', 'eddie', 'shona'], races: [2, 3, 3], prize: [20, 50, 100, 200], blackOne: true },
    { id: 'pubchamp', name: 'The Pub Championship', field: ['mick', 'kev', 'gaz', 'priya', 'eddie', 'shona', 'ray'], races: [3, 3, 4], prize: [40, 100, 200, 400] },
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
// stars: 1 to 5, spread across the pub players (a rating of 1275 or less is 1 star, 1575 or more is 5). The tiers to
// come will be stronger, so this scale will need widening then.
const stars = id => id === YOU ? 0 : Math.max(1, Math.min(5, Math.round((OPPONENTS[id].rating - 1200) / 75)));
const nameOf = (career, id) => id === YOU ? career.name : OPPONENTS[id].name;

function newCareer({ name, look, guide }, now) {
  return { v: 1, name: cleanName(name), look: cleanLook(look), guide: GUIDES.includes(guide) ? guide : 'line', created: now, money: 0,
    trophies: [], done: {}, history: [], run: null, last: null };
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
  career.money += out.prize;
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
  out.trophies = Array.isArray(c.trophies) ? c.trophies.filter(t => t && EVENTS[t.event]).map(t => ({ event: t.event })) : [];
  for (const [k, d] of Object.entries(c.done && typeof c.done === 'object' ? c.done : {}))
    if (EVENTS[k] && d) out.done[k] = { played: Math.max(0, num(d.played) | 0), won: Math.max(0, num(d.won) | 0), best: num(d.best, -1) | 0 };
  out.history = Array.isArray(c.history) ? c.history.filter(h => h && EVENTS[h.event] && OPPONENTS[h.opp] && Array.isArray(h.wins)).slice(0, 20) : [];
  const okIds = a => Array.isArray(a) && a.every(id => id === YOU || OPPONENTS[id]);
  const r = c.run;
  if (r && EVENTS[r.event] && okIds(r.slots) && r.slots.length === 8 && r.slots.includes(YOU) && Number.isInteger(r.round) && r.round >= 0 && r.round < ROUNDS.length
    && Array.isArray(r.res) && r.res.length === r.round && r.res.every(okIds) && r.match && OPPONENTS[r.match.opp]) {
    const m = r.match;
    out.run = { event: r.event, seed: num(r.seed) >>> 0, slots: [...r.slots], round: r.round, res: r.res.map(x => [...x]), scores: Array.isArray(r.scores) ? r.scores : [],
      match: { opp: m.opp, race: EVENTS[r.event].races[r.round], wins: [num(m.wins && m.wins[0]) | 0, num(m.wins && m.wins[1]) | 0], breaker: m.breaker === 1 ? 1 : 0, snap: m.snap && Array.isArray(m.snap.balls) && m.snap.game ? m.snap : null } };
  }
  if (c.last && EVENTS[c.last.event] && okIds(c.last.slots)) out.last = c.last;
  return out;
}

return { OPPONENTS, TIERS, EVENTS, ROUNDS, YOU, rng, stars, nameOf, newCareer, unlocked, tierDone, enterEvent, entrants, recordMatch, withdraw, onFinalBall, profileFor, validate, simMatch };
})(typeof CORE !== 'undefined' ? CORE : require('./core.js'));
if (typeof module !== 'undefined') module.exports = CAREER;
