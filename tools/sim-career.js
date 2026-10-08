// Measures how strong each career opponent really is, by playing frames against the Medium CPU with the real physics
// and rules of their tier's game (reds & yellows on the 7 ft table for the pubs, 8-ball or 9-ball on the 9 ft table
// after that), and turns the win rate into a rating (Medium = 1500 in that game). The ratings in src/career.js come
// from this. Runs on all CPU cores; a full run takes a while.
//   node tools/sim-career.js                  every opponent, 60 frames each
//   node tools/sim-career.js ray shona 100    only these opponents, 100 frames each
//   node tools/sim-career.js @hard:9ball 80   a CPU level as a yardstick, in a given game (uk8, 8ball or 9ball)
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const os = require('os');
const C = require('../src/core.js'), K = require('../src/career.js');

// one frame between two CPU players; cfgs[i] is a function giving player i's settings for the position
function playFrame(cfgs, breaker, seed, mode) {
  const rnd = K.rng(seed);
  C.setTable(mode === 'uk8' ? 'uk7' : 'us9');
  let balls = mode === '9ball' ? C.rack9(rnd) : C.rack8(rnd), game = C.newGame(mode);
  game.turn = breaker;
  for (let n = 0; n < 300 && !game.over; n++) {
    const pl = game.turn, gen = C.planBot(game, balls, pl, cfgs[pl](game, balls, pl), rnd);
    let r; do r = gen.next(); while (!r.done);
    const shot = r.value, w = C.makeWorld(C.cloneBalls(balls)), cue = w.balls[0];
    if (shot.cue && game.ballInHand) { cue.x = shot.cue[0]; cue.z = shot.cue[1]; cue.potted = false; }
    const before = C.cloneBalls(w.balls);
    w.rec = C.newRec(); C.strike(cue, shot); C.simulate(w, 30);
    const res = C.judge(game, w.rec, before, w.balls, pl);
    for (const id of res.respot) { const b = w.balls.find(x => x.id === id); b.potted = false; C.spotBall(w.balls, b); }
    if (cue.potted) { cue.potted = false; C.placeCueHead(w.balls, cue); }
    game = C.nextGame(game, res, pl, w.balls); balls = w.balls;
  }
  return game.over ? game.winner : -1;
}

if (isMainThread) {
  const args = process.argv.slice(2), frames = +args.find(a => /^\d+$/.test(a)) || 60;
  const ids = args.filter(a => K.OPPONENTS[a] || /^@(easy|medium|hard|expert):(uk8|8ball|9ball)$/.test(a)); if (!ids.length) ids.push(...Object.keys(K.OPPONENTS));
  const jobs = []; for (const id of ids) for (let f = 0; f < frames; f++) jobs.push({ id, f });
  const tally = Object.fromEntries(ids.map(id => [id, { won: 0, played: 0, unfinished: 0 }]));
  let next = 0, busy = 0; const t0 = Date.now();
  const report = () => {
    console.log(`\n${'opponent'.padEnd(12)} won/played   win rate   rating (now in career.js)`);
    for (const id of ids) {
      const t = tally[id], p = Math.min(0.97, Math.max(0.03, t.won / Math.max(1, t.played)));
      console.log(`${id.padEnd(12)} ${String(t.won).padStart(3)}/${String(t.played).padEnd(4)}     ${(100 * t.won / Math.max(1, t.played)).toFixed(0).padStart(3)}%      ${Math.round(1500 + 400 * Math.log10(p / (1 - p)))} (${K.OPPONENTS[id] ? K.OPPONENTS[id].rating : 'a CPU level'})${t.unfinished ? `, ${t.unfinished} unfinished` : ''}`);
    }
    console.log(`\n${Math.round((Date.now() - t0) / 1000)} s`);
  };
  const start = () => {
    if (next >= jobs.length) { if (!busy) report(); return; }
    const job = jobs[next++]; busy++;
    const wk = new Worker(__filename, { workerData: job });
    wk.on('message', w => { const t = tally[job.id]; if (w < 0) t.unfinished++; else { t.played++; if (w === 0) t.won++; } });
    wk.on('exit', () => { busy--; if ((next % 20) === 0) process.stdout.write(`${next}/${jobs.length} `); start(); });
  };
  for (let i = 0; i < Math.max(1, os.cpus().length); i++) start();
} else {
  // player 0 is the opponent being measured, player 1 the Medium CPU; breaks alternate frame by frame
  const { id, f } = workerData, level = /^@(\w+):(\w+)$/.exec(id);
  const mode = level ? level[2] : K.TIERS[K.tierOf(id)].mode;
  const opp = level ? () => level[1] : (game, balls, pl) => K.profileFor(id, { onFinal: K.onFinalBall(game, balls, pl) });
  parentPort.postMessage(playFrame([opp, () => 'medium'], f % 2, 1000 + f * 7919 + id.length, mode));
}
