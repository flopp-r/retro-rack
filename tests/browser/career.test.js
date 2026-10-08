// Career: a new career, entering an event, playing and leaving a match (it resumes exactly), winning and losing
// matches, prize money and unlocking, save to file / load, withdrawing and retiring; phone-sized screens throughout.
const { chromium, FILE, shot } = require('./lib');
const fs = require('fs');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(250); } return false; };

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 762, height: 341 }, reducedMotion: 'reduce', acceptDownloads: true });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1');
    localStorage.setItem('retroRack.rotateHint', 'off'); localStorage.setItem('retroRack.name', 'Tess');
    localStorage.setItem('retroRack.menu', JSON.stringify({ mode: '9ball', opp: 'bot', diff: 'hard', guide: 'auto', race: 0, last: { mode: '9ball', opp: 'bot', diff: 'hard', rack: '8ball', race: 0, guide: 'auto' } })); } });
  const logs = [];
  const open = async () => {
    const p = await ctx.newPage();
    p.on('console', m => { if (!/GPU stall/.test(m.text())) logs.push(`[${m.type()}] ${m.text()}`); });
    p.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
    p.on('dialog', d => d.accept());
    await p.goto(FILE); await sleep(1200); return p;
  };
  let p = await open();
  const fits = async name => { const o = await p.evaluate(() => { const s = document.querySelector('#mStage'); return s.scrollHeight - s.clientHeight; }); ok(o <= 1, `${name} fits a phone on its side without scrolling (${o})`); };
  const st = () => p.evaluate(() => ({ state: __rr.state, car: __rr.CAR.on, wins: [...__rr.matchWins], mode: __rr.M.mode, race: __rr.M.race, guide: __rr.M.guide }));
  const saved = () => p.evaluate(() => JSON.parse(localStorage.getItem('retroRack.career')));
  const table = () => p.evaluate(() => JSON.stringify(__rr.world.balls.map(b => [b.id, b.x, b.z, b.potted])));
  // ends the current frame by conceding for the given player, as soon as nothing is moving
  const concede = who => until(() => p.evaluate(w => __rr.state !== 'over' && __rr.concedeFrame(false, w), who));
  const overShown = () => until(() => p.isVisible('#over'), 5000);

  console.log('--- starting a career');
  await p.click('[data-go="single"]'); await sleep(300);
  ok(await p.isVisible('[data-go="career"]'), 'Single player has a Career card'); await fits('Single player (three cards)');
  await p.click('[data-go="career"]'); await sleep(300);
  ok(await p.isVisible('#sc-cnew') && await p.inputValue('#cName') === 'Tess', 'no career yet: the new-career form, with the online name filled in');
  await fits('New career');
  await p.click('#cStyle .cStyleBtn:nth-child(4)'); await p.click('#cShirt .swatch:nth-child(3)'); await p.click('#cGuide .btn:nth-child(3)');
  ok(await p.textContent('#bCareer') === 'Start career', 'the main button says Start career');
  await p.click('#bCareer'); await sleep(400);
  let c = await saved();
  ok(c && c.name === 'Tess' && c.look.s === 'cap' && c.look.shirt === '#ff6f8f' && c.guide === 'ghost' && c.money === 0, `career saved with the choices made (${c && JSON.stringify(c.look)}, guide ${c && c.guide})`);
  ok(await p.isVisible('#sc-career'), 'the hub shows'); await fits('Career hub');
  const states = await p.$$eval('.cEvtState', es => es.map(e => e.textContent));
  ok(states.join() === 'Open,Locked,Locked', `first event open, the rest locked (${states})`);
  await p.click('.cEvt:nth-child(2)', { force: true }); await sleep(300);
  ok(await p.isVisible('#sc-career'), 'a locked event does nothing');

  console.log('--- entering the first event');
  await p.click('.cEvt:nth-child(1)'); await sleep(300);
  ok(await p.isVisible('#sc-cevent') && await p.textContent('#mTitle') === 'The Red Lion Open', 'the event screen');
  ok((await p.$$('#cBracket .bName')).length === 8 && await p.textContent('#bCareer') === 'Enter', 'before entering: the field of 8 and an Enter button'); await fits('Event, before entering');
  await p.click('#bCareer'); await sleep(300);
  c = await saved();
  ok(c.run && c.run.slots.length === 8 && c.run.slots.includes('you'), 'entered: an 8-player draw including you');
  const opp1 = c.run.match.opp;
  ok(await p.textContent('#bCareer') === 'Play the quarter-final' && (await p.textContent('#cOpp')).includes(await p.evaluate(id => __rr.CAR && document.querySelector('.cOppName').textContent, opp1)), 'the draw, your opponent and a Play button');
  ok(await p.$eval('.bName.you', e => e.textContent) === 'Tess', 'you are marked in the draw'); await fits('Event, drawn');

  console.log('--- a career match');
  await p.click('#bCareer'); await sleep(1500);
  let s = await st();
  ok(s.car && s.mode === 'uk8' && s.race === 2 && s.guide === 'ghost', `reds & yellows, first to 2, your fixed aim guide (${JSON.stringify(s)})`);
  const names = await p.$$eval('.pname', es => es.map(e => e.textContent));
  ok(names[0] === 'You' && names[1] !== 'CPU' && !names[1].includes('('), `the scoreboard names your opponent (${names})`);
  await p.click('#bPause'); await sleep(200);
  ok(await p.isHidden('#rowSGuide') && await p.isHidden('#bRestart') && await p.textContent('#bQuit') === 'Save and quit', 'Pause: no aim guide choice, no re-rack, "Save and quit"');
  await p.click('#bResume');
  // play until a shot has been taken (yours or the computer's), then check the table after it was saved
  ok(await until(() => p.evaluate(() => __rr.state === 'aim' || __rr.state === 'botThink')), 'ready to play');
  const snap0 = JSON.stringify((await saved()).run.match.snap);
  if (await p.evaluate(() => __rr.state === 'aim')) await p.evaluate(() => __rr.beginStroke());
  ok(await until(async () => JSON.stringify((await saved()).run.match.snap) !== snap0 && ['aim', 'botThink'].includes(await p.evaluate(() => __rr.state)), 90000), 'a shot is played, and the table after it is saved');
  const snap1 = (await saved()).run.match.snap;
  const before = JSON.stringify(snap1.balls.map(x => [x[0], x[1], x[2], !!x[3]])), turn = snap1.game.turn;
  console.log('--- closing the app mid-match, and coming back');
  await p.close(); p = await open();
  await p.click('[data-go="single"]'); await sleep(300); await p.click('[data-go="career"]'); await sleep(300);
  ok((await p.textContent('#bCareer')).startsWith('Continue: quarter-final v '), `the hub offers "${await p.textContent('#bCareer')}"`);
  await p.click('#bCareer'); await sleep(1500);
  ok(await table() === before && await p.evaluate(() => __rr.game.turn) === turn, 'the match carries on from exactly the same table, same player to shoot');

  console.log('--- leaving between frames keeps the score');
  ok(await concede(1), 'a frame ends (your opponent concedes it)'); await overShown();
  ok(await p.textContent('#bAgain') === 'Next frame' && await p.textContent('#bOverMenu') === 'Save and quit', 'result screen: Next frame, Save and quit');
  await p.click('#bOverMenu'); await sleep(500);
  ok(await p.isVisible('#sc-cevent') && (await p.textContent('#cOpp')).includes('Score 1–0'), 'back at the event: score 1–0, match in progress');
  ok(await p.evaluate(() => __rr.M.mode === '9ball' && __rr.M.last.mode === '9ball' && __rr.M.diff === 'hard'), "your own menu choices and Play again are untouched");
  await p.click('#bCareer'); await sleep(1500);
  s = await st(); ok(s.wins.join() === '1,0' && s.state !== 'over', `continuing starts the next frame at 1–0 (${s.wins})`);

  console.log('--- winning the quarter-final');
  ok(await concede(1), 'second frame won'); await overShown();
  ok(/You win the match/.test(await p.textContent('#overTitle')) && /Through to the semi-final/.test(await p.textContent('#overStats')), `"${await p.textContent('#overTitle')}": ${await p.textContent('#overStats')}`);
  ok(await p.textContent('#bAgain') === 'Continue' && await p.isHidden('#bOverMenu'), 'Continue, and no Save and quit (nothing to save)');
  await p.click('#bAgain'); await sleep(500);
  c = await saved();
  ok(await p.isVisible('#sc-cevent') && c.run.round === 1 && c.run.res[0].length === 4 && c.run.res[0].includes('you'), 'back at the draw: quarter-finals decided, you are in the semi-final');
  ok((await p.$$('#cBracket .bName.out')).length === 4, 'the four quarter-final losers are dimmed');

  console.log('--- semi-final and final');
  for (const round of ['semi-final', 'final']) {
    await p.click('#bCareer'); await sleep(1200);
    const race = (await st()).race;
    for (let f = 0; f < race; f++) { ok(await concede(1), `${round}: frame ${f + 1} of ${race} won`); await overShown(); if (f < race - 1) { await p.click('#bAgain'); await sleep(1200); } }
    if (round === 'semi-final') { await p.click('#bAgain'); await sleep(500); }
  }
  const champ = await p.textContent('#overStats');
  ok(/You win The Red Lion Open! Prize: £100\. The Crown Cup is now open\./.test(champ), `champion: ${champ}`);
  await p.click('#bAgain'); await sleep(500);
  c = await saved();
  ok(c.money === 100 && c.trophies.length === 1 && !c.run && c.done.redlion.won === 1, 'prize £100, one trophy, the event finished');
  ok(await p.$eval('.bName.champ', e => e.textContent) === 'Tess', 'the draw shows you as champion');
  await p.click('#mBack'); await sleep(300);
  ok((await p.$$eval('.cEvtState', es => es.map(e => e.textContent))).join() === 'Won,Open,Locked' && (await p.textContent('.cMeStats')).includes('£100 to spend · 1 trophy'), 'hub: Red Lion won, Crown Cup open, £100 to spend and 1 trophy');

  console.log('--- losing in the next event');
  await p.click('.cEvt:nth-child(2)'); await sleep(300); await p.click('#bCareer'); await sleep(300); await p.click('#bCareer'); await sleep(1200);
  ok(await p.evaluate(() => __rr.game.oneVisitOnBlack === true), 'The Crown Cup plays "one visit on the black"');
  for (let f = 0; f < 2; f++) { ok(await concede(0), `frame ${f + 1} lost`); await overShown(); if (f === 0) { await p.click('#bAgain'); await sleep(1200); } }
  ok(/You win/.test(await p.textContent('#overTitle')) === false && /Out in the quarter-final\. Prize: £20\./.test(await p.textContent('#overStats')), `knocked out: ${await p.textContent('#overStats')}`);
  await p.click('#bAgain'); await sleep(500);
  c = await saved(); ok(c.money === 120 && !c.run && c.done.crown.best === 0, 'money now £120; best result: quarter-final');
  ok(await p.textContent('#bCareer') === 'Enter again', 'the event can be entered again');

  console.log('--- withdrawing');
  await p.click('#bCareer'); await sleep(300); await p.click('#bWithdraw'); await sleep(300);
  c = await saved(); ok(!c.run && c.money === 140 && /Withdrawn\. Prize: £20\./.test(await p.textContent('#cNote')), 'withdrawing counts as going out, and pays that round\'s prize');

  console.log('--- save to file, retire, load from file');
  await p.click('#mBack'); await sleep(300);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#cExport')]);
  const file = shot('career-save.json'); await dl.saveAs(file);
  const exported = JSON.parse(fs.readFileSync(file, 'utf8'));
  ok(dl.suggestedFilename() === 'retro-rack-career-tess.json' && exported.money === 140 && exported.trophies.length === 1, `saved to ${dl.suggestedFilename()}`);
  await p.click('#cRetire'); await sleep(600);
  ok(await p.isVisible('#sc-cnew') && !(await saved()), 'retired: the career is gone and the new-career form shows');
  await p.click('#bCareer'); await sleep(400);
  await p.setInputFiles('#cFile', file); await sleep(500);
  c = await saved();
  ok(c.name === 'Tess' && c.money === 140 && c.done.redlion.won === 1 && /Loaded Tess's career/.test(await p.textContent('#cNote')), 'loading the file brings the career back (after confirming the replacement)');
  fs.writeFileSync(file, '{"not":"a career"}'); await p.setInputFiles('#cFile', file); await sleep(400);
  ok(/isn't a Retro Rack career/.test(await p.textContent('#cNote')) && (await saved()).money === 140, 'a file that is not a career is refused, and nothing changes');

  ok(!logs.length, 'console clean' + (logs.length ? ':\n  ' + logs.join('\n  ') : ''));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
