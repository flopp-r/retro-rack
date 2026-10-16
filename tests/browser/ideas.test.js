// Players' ideas: the lightbulb in the menus' corner opens a box for an idea of up to 100 characters, sent with the
// player's online name and the game's version to the relay, which keeps them, cleans them and limits how many come
// from one address in a day. In dev mode the lightbulb is the owner's inbox: the relay hands the ideas over only for
// the dev word (a stand-in here, 'testword'; run-all.js gives the local relay its fingerprint), new ones are counted
// on the lightbulb and in a note under the icons, and they can be deleted. Over http, against the local relay.
const fs = require('fs'), path = require('path');
const { chromium, SITE, PORTS, ROOT, shot } = require('./lib');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(100); } return false; };
const RELAY = `http://127.0.0.1:${PORTS.relay}/ideas`;
const relay = async body => (await fetch(RELAY, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(body) })).json();

(async () => {
  const gameSrc = fs.readFileSync(path.join(ROOT, 'src', 'game.js'), 'utf8'), relaySrc = fs.readFileSync(path.join(ROOT, 'relay', 'src', 'index.js'), 'utf8');
  const gp = /DEVW = \{ print: '([0-9a-f]{64})' \}/.exec(gameSrc), rp = /const DEV_PRINT = "([0-9a-f]{64})"/.exec(relaySrc);
  ok(gp && rp && gp[1] === rp[1], 'the relay checks the same dev word fingerprint as the game');
  const start = await relay({ op: 'list', key: 'testword' });
  if (!start.ok) { ok(false, 'the local relay knows the stand-in word (start it through run-all.js, not one already running)'); return; }

  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const logs = [];
  const page = async (ctx, who) => {
    const p = await ctx.newPage();
    p.on('console', m => { if (!/GPU stall/.test(m.text())) logs.push(`${who} [${m.type()}] ${m.text()}`); }); p.on('pageerror', e => logs.push(`${who} [pageerror] ${e.message}`)); p.on('dialog', d => d.accept());
    await p.goto(SITE.new); await sleep(1200); return p;
  };
  const pc = await b.newContext({ viewport: { width: 762, height: 341 } });
  await pc.addInitScript(() => { localStorage.setItem('retroRack.rotateHint', 'off'); if (!localStorage.getItem('retroRack.name')) localStorage.setItem('retroRack.name', 'Sam'); });
  const p = await page(pc, 'player');

  console.log('--- a player sends an idea');
  const corner = await p.evaluate(() => { const r = id => document.querySelector(id).getBoundingClientRect(), m = r('#bMoney'), i = r('#bIdea'), g = r('#bMenuSettings');
    return { order: m.right <= i.left && i.right <= g.left, top: Math.abs(i.top - g.top) < 1 && i.height === g.height, title: document.querySelector('#bIdea').title }; });
  ok(corner.order && corner.top && corner.title === 'Send an idea', `a lightbulb between the money and the cog, the same size as the cog (${JSON.stringify(corner)})`);
  await p.click('#bIdea'); await sleep(250);
  ok(await p.isVisible('#idea') && /Sam/.test(await p.textContent('#ideaFrom')) && await p.textContent('#ideaLeft') === '100 left' && await p.isDisabled('#bIdeaSend'),
    `the box opens, says it goes with the online name ("${await p.textContent('#ideaFrom')}"), 100 characters left, Send waits for words`);
  const fit = await p.evaluate(() => { const r = document.querySelector('#idea .panel').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
  ok(fit, 'it fits a phone on its side');
  await p.fill('#ideaIn', 'x'.repeat(130)); await sleep(100);
  ok((await p.inputValue('#ideaIn')).length === 100 && await p.textContent('#ideaLeft') === '0 left', 'it stops at 100 characters');
  await p.fill('#ideaIn', 'Add a snooker table'); await p.screenshot({ path: shot('ideas-box-762x341.png') }); await p.click('#bIdeaSend');
  ok(await until(async () => /Thanks!/.test(await p.textContent('#ideaNote'))) && await p.inputValue('#ideaIn') === '' && await p.textContent('#bIdeaClose') === 'Close', `sent: "${await p.textContent('#ideaNote')}"`);
  await p.fill('#ideaIn', 'Trick shot of the week'); await p.press('#ideaIn', 'Enter');
  ok(await until(async () => /Thanks!/.test(await p.textContent('#ideaNote'))), 'Enter sends too');
  await p.press('#ideaIn', 'Escape'); await sleep(200); ok(await p.isHidden('#idea'), 'Esc closes it');
  await p.click('#bIdea'); await sleep(200); await p.evaluate(() => history.back()); await sleep(500);
  ok(await p.isHidden('#idea') && await p.isVisible('#sc-home'), 'and so does the back gesture, staying on the home screen');

  console.log('--- the owner turns on dev mode: two new ideas');
  const oc = await b.newContext({ viewport: { width: 762, height: 341 } });
  await oc.addInitScript(() => localStorage.setItem('retroRack.rotateHint', 'off'));
  const o = await page(oc, 'owner');
  await o.evaluate(async () => { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('retroRack:testword')); __rr.DEVW.print = [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); });
  await o.click('[data-go="multi"]'); await sleep(600); await o.click('[data-go="online"]'); await sleep(600);
  await o.fill('#netName', 'testword');
  ok(await until(async () => await o.isVisible('#ideaPop')) && await o.textContent('#ideaPop') === '2 new ideas from players' && await o.textContent('#ideaN') === '2', `a note under the icons and a 2 on the lightbulb ("${await o.textContent('#ideaPop')}")`);
  ok(await o.evaluate(() => localStorage.getItem('retroRack.devWord')) === 'testword' && await o.getAttribute('#bIdea', 'title') === 'Players\' ideas', 'the word is kept on this device, and the lightbulb is the inbox');
  await o.screenshot({ path: shot('ideas-note-762x341.png') });
  await o.click('#ideaPop'); await sleep(200);
  ok(await until(async () => (await o.$$('.ideaRow')).length === 2), 'tapping the note opens the inbox with both');
  let rows = await o.$$eval('.ideaRow', rs => rs.map(r => ({ text: r.querySelector('.ideaText').textContent, sub: r.querySelector('.ideaSub').textContent, isNew: r.classList.contains('new') })));
  ok(rows[0].text === 'Trick shot of the week' && rows[1].text === 'Add a snooker table' && rows.every(r => r.isNew), `newest first, both marked new (${rows.map(r => r.text).join(' / ')})`);
  ok(/^Sam · \d{1,2} [A-Z][a-z]{2} \d{4}, \d\d:\d\d · version [0-9a-f]{8}$/.test(rows[0].sub), `with the name, the date and the version ("${rows[0].sub}")`);
  ok(await o.isHidden('#ideaN') && await o.isHidden('#ideaPop'), 'once read, the number and the note go');
  await o.click('#bIdeasClose'); await sleep(200); await o.click('#bIdea'); await sleep(200);
  ok(await until(async () => (await o.$$('.ideaRow')).length === 2) && !(await o.$$('.ideaRow.new')).length, 'opened again: nothing new');
  await o.click('#bIdeasClose'); await sleep(200);

  console.log('--- what the relay accepts');
  ok((await relay({ op: 'list' })).why === 'key' && (await relay({ op: 'list', key: 'not the word' })).why === 'key', 'no ideas without the dev word');
  ok((await relay({ op: 'send', text: 'y'.repeat(101) })).why === 'long' && (await relay({ op: 'send', text: ' \u200b\n ' })).why === 'empty', 'too long or empty is refused');
  const sent = await relay({ op: 'send', text: 'Pot\u200b sparks\n\nbigger', name: '<b>Jo</b>\u0007', v: 'nonsense' });
  const L = await relay({ op: 'list', key: 'testword' }), jo = L.ideas.find(i => i.text === 'Pot sparks bigger');
  ok(sent.ok && jo && jo.name === 'bJo/b' && jo.v === '', `hidden characters and extra spaces are taken out, and a name can't carry markup (${JSON.stringify(jo)})`);

  console.log('--- five a day from one address');
  await p.click('#bIdea'); await sleep(200);
  await p.fill('#ideaIn', 'Stats page'); await p.click('#bIdeaSend'); await until(async () => /Thanks!/.test(await p.textContent('#ideaNote')));
  await p.fill('#ideaIn', 'Colour-blind markers'); await p.click('#bIdeaSend'); await until(async () => /last one for today/.test(await p.textContent('#ideaNote')));
  ok(/last one for today/.test(await p.textContent('#ideaNote')), `the fifth says it's the last today ("${await p.textContent('#ideaNote')}")`);
  await p.fill('#ideaIn', 'One more'); await p.click('#bIdeaSend');
  ok(await until(async () => /the most for one day/.test(await p.textContent('#ideaNote'))) && await p.inputValue('#ideaIn') === 'One more', `the sixth is refused and kept in the box ("${await p.textContent('#ideaNote')}")`);
  await p.click('#bIdeaClose'); await sleep(200);

  console.log('--- the owner comes back later: three new');
  await o.reload(); await sleep(1500);
  ok(await until(async () => await o.isVisible('#ideaPop')) && await o.textContent('#ideaPop') === '3 new ideas from players', `at start-up, a note: "${await o.textContent('#ideaPop')}"`);
  await o.mouse.click(380, 300); await sleep(200);
  ok(await o.isHidden('#ideaPop') && await o.textContent('#ideaN') === '3', 'a tap anywhere else puts the note away; the number stays on the lightbulb');
  await o.click('#bIdea'); await sleep(200);
  ok(await until(async () => (await o.$$('.ideaRow')).length === 5) && (await o.$$('.ideaRow.new')).length === 3 && /5 ideas, 3 new/.test(await o.textContent('#ideasHead')), `five in all, three marked new ("${await o.textContent('#ideasHead')}")`);
  await o.screenshot({ path: shot('ideas-inbox-762x341.png') });
  await o.click('.ideaRow:nth-child(1) .btn'); await sleep(200);
  ok(await until(async () => (await o.$$('.ideaRow')).length === 4) && (await relay({ op: 'list', key: 'testword' })).ideas.length === 4, 'Delete takes one off, on the relay too');
  const fitO = await o.evaluate(() => { const r = document.querySelector('#ideas .panel').getBoundingClientRect(), l = document.querySelector('#ideasList'); return r.top >= 0 && r.bottom <= innerHeight && l.scrollHeight >= l.clientHeight; });
  ok(fitO, 'the inbox fits a phone on its side, its list scrolling inside it');
  await o.click('#bIdeasClear'); await sleep(200);
  ok(await until(async () => !(await o.$$('.ideaRow')).length) && /No ideas yet/.test(await o.textContent('#ideasHead')) && !(await relay({ op: 'list', key: 'testword' })).ideas.length, 'Delete all empties it');
  await o.click('#bIdeasClose'); await sleep(200);

  console.log('--- dev mode off, and a device in dev mode without the word');
  await o.click('#bMenuSettings'); await sleep(300); await o.click('#sDev'); await sleep(300); await o.click('#bResume'); await sleep(300);
  ok(await o.evaluate(() => localStorage.getItem('retroRack.devWord')) === null && await o.getAttribute('#bIdea', 'title') === 'Send an idea', 'switching dev mode off forgets the word, and the lightbulb sends ideas again');
  await o.evaluate(() => { localStorage.setItem('retroRack.dev', '1'); }); await o.reload(); await sleep(1500);
  await o.evaluate(async () => { const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('retroRack:testword')); __rr.DEVW.print = [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join(''); });
  await o.click('#bIdea'); await sleep(250);
  ok(await o.isVisible('#ideasUnlock') && /Type your dev word/.test(await o.textContent('#ideasHead')), 'the inbox asks for the dev word');
  await o.fill('#ideasKey', 'guess'); await o.click('#bIdeasKey'); await sleep(300);
  ok(/not the dev word/.test(await o.textContent('#ideasNote')) && await o.evaluate(() => localStorage.getItem('retroRack.devWord')) === null, 'a wrong word is turned away');
  await o.fill('#ideasKey', 'testword'); await o.press('#ideasKey', 'Enter');
  ok(await until(async () => await o.isHidden('#ideasUnlock') && /No ideas yet/.test(await o.textContent('#ideasHead'))) && await o.evaluate(() => localStorage.getItem('retroRack.devWord')) === 'testword', 'the right one unlocks it');
  await o.keyboard.press('Escape'); await sleep(200); ok(await o.isHidden('#ideas'), 'Esc closes the inbox');

  ok(!logs.length, 'console clean' + (logs.length ? ': ' + logs.join(' | ') : ''));
  await b.close();
})();
