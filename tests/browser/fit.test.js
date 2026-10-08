// Every menu screen fits without scrolling, at phone, tablet and computer sizes; and the panels keep their styles.
const { chromium, FILE } = require('./lib');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const routes = { home: [], single: ['single'], game: ['single', 'cpu'], setup: ['single', 'cpu', 'uk8'], practice: ['single', 'practice'], multi: ['multi'], online: ['multi', 'online'], newroom: ['multi', 'online', 'create', '8ball'],
    locker: ['locker'], lockerCloths: ['locker', 'tCloth'], lockerCues: ['locker', 'tCue'], lockerGloves: ['locker', 'tGlove'] };
  const SEL = { single: '[data-go="single"]', multi: '[data-go="multi"]', cpu: '[data-go="game"][data-opp="bot"]', practice: '[data-go="practice"]', online: '[data-go="online"]', create: '#bCreate', uk8: '[data-mode="uk8"]', '8ball': '[data-mode="8ball"]',
    locker: '[data-go="locker"]', tCloth: '#lockTabs .btn:nth-child(2)', tCue: '#lockTabs .btn:nth-child(3)', tGlove: '#lockTabs .btn:nth-child(4)' };
  for (const [w, h] of [[762, 341], [740, 360], [915, 412], [412, 915], [1000, 640], [1280, 720]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { localStorage.setItem('retroRack.rotateHint', 'off'); localStorage.setItem('retroRack.menu', JSON.stringify({ last: { mode: '8ball', opp: 'bot', diff: 'medium', rack: '8ball', race: 0, guide: 'auto' } })); });
    const p = await ctx.newPage(); await p.goto(FILE + '?relay=ws://127.0.0.1:8787'); await p.waitForTimeout(900);
    const bad = [];
    for (const [name, steps] of Object.entries(routes)) {
      await p.evaluate(() => { while (window.__rrBack && window.__rrBack()); });
      for (let i = 0; i < 5; i++) { if (await p.isVisible('#mBack')) await p.click('#mBack'); }
      for (const st of steps) await p.click(SEL[st]);
      await p.waitForTimeout(150);
      const r = await p.evaluate(() => { const s = document.querySelector('#mStage'), pn = document.querySelector('#menuPanel').getBoundingClientRect(), f = document.querySelector('.mFoot').getBoundingClientRect();
        return { over: s.scrollHeight - s.clientHeight, panelFits: pn.top >= -1 && pn.bottom <= innerHeight + 1, footInView: f.bottom <= innerHeight + 1 }; });
      if (r.over > 1 || !r.panelFits || !r.footInView) bad.push(`${name} (needs ${r.over}px of scrolling${r.panelFits ? '' : ', panel off screen'})`);
    }
    ok(!bad.length, `${w}x${h}: every menu screen fits without scrolling${bad.length ? ': ' + bad.join(', ') : ''}`);
    await ctx.close();
  }
  // the panel styles that the earlier menu change lost by mistake
  const p = await b.newPage({ viewport: { width: 1000, height: 640 } }); await p.goto(FILE); await p.waitForTimeout(800);
  await p.click('#bMenuSettings'); await p.waitForTimeout(200);
  const st = await p.evaluate(() => { const sw = document.querySelector('#sCloth .pickCur .shopSw').getBoundingClientRect(), row = getComputedStyle(document.querySelector('#pausePanel .row:not([hidden])')), seg = getComputedStyle(document.querySelector('#sPixel')), act = getComputedStyle(document.querySelector('#pausePanel .actions'));
    return { swatch: [Math.round(sw.width), Math.round(sw.height)], row: row.display + ' ' + row.gridTemplateColumns, seg: seg.display + ' ' + seg.gap, actions: act.display + ' ' + act.gap }; });
  ok(st.swatch[0] === 22 && st.swatch[1] === 22, `Settings: the cloth picker shows a 22x22 px swatch (${st.swatch})`);
  ok(st.row.startsWith('grid 118px') && st.seg === 'flex 7px' && st.actions === 'flex 10px', `Settings: rows, button groups and the button row keep their layout (${JSON.stringify(st)})`);
  const ov = await p.evaluate(() => { const o = document.querySelector('#over'); o.hidden = false; const a = getComputedStyle(o.querySelector('.actions')); o.hidden = true; return a.display + ' ' + a.gap; });
  ok(ov === 'flex 10px', `game-over panel buttons keep their spacing (${ov})`);
  await b.close();
})();
