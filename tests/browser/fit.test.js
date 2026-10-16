// Every menu screen fits without scrolling, at phone, tablet and computer sizes; and the panels keep their styles.
const { chromium, FILE } = require('./lib');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const routes = { home: [], single: ['single'], game: ['single', 'cpu'], setup: ['single', 'cpu', 'uk8'], practice: ['single', 'practice'], multi: ['multi'], online: ['multi', 'online'], newroom: ['multi', 'online', 'create', '8ball'],
    locker: ['locker'], lockerInventory: ['locker', 'tInv'], lockerShop: ['locker', 'tShop'] };
  const SEL = { single: '[data-go="single"]', multi: '[data-go="multi"]', cpu: '[data-go="game"][data-opp="bot"]', practice: '[data-go="practice"]', online: '[data-go="online"]', create: '#bCreate', uk8: '[data-mode="uk8"]', '8ball': '[data-mode="8ball"]',
    locker: '[data-go="locker"]', tInv: '#lockTabs .btn:nth-child(2)', tShop: '#lockTabs .btn:nth-child(3)' };
  for (const [w, h] of [[762, 341], [740, 360], [915, 412], [412, 915], [1000, 640], [1280, 720]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    // dev mode's test locker owns every look, so the inventory is as long as it gets (the list scrolls; the screen mustn't)
    await ctx.addInitScript(() => { localStorage.setItem('retroRack.rotateHint', 'off'); localStorage.setItem('retroRack.dev', '1'); localStorage.setItem('retroRack.menu', JSON.stringify({ last: { mode: '8ball', opp: 'bot', diff: 'medium', rack: '8ball', race: 0, guide: 'auto' } })); });
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
      // the money counter and the icons in the corner cover none of the screen's buttons, cards or words
      const hit = await p.evaluate(() => {
        const corner = [...document.querySelectorAll('#menuIcons > button')].filter(e => !e.hidden).map(e => [e.id, e.getBoundingClientRect()]), boxes = [];
        const scope = [document.querySelector('#mTop'), document.querySelector('#menuPanel .mScreen:not([hidden])')].filter(e => e && !e.hidden);
        for (const sc of scope) {
          for (const e of sc.querySelectorAll('button, input, .card, .caseCard')) { const r = e.getBoundingClientRect(); if (r.width && r.height) boxes.push([e.id || e.className || e.tagName, r]); }
          const tw = document.createTreeWalker(sc, NodeFilter.SHOW_TEXT); let n;
          while ((n = tw.nextNode())) { if (!n.textContent.trim()) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const r of rg.getClientRects()) if (r.width && r.height) boxes.push(['"' + n.textContent.trim().slice(0, 20) + '"', r]); }
        }
        const out = [];
        for (const [id, c] of corner) for (const [what, r] of boxes) if (c.left < r.right - 1 && r.left < c.right - 1 && c.top < r.bottom - 1 && r.top < c.bottom - 1) out.push(`#${id} covers ${what}`);
        return [...new Set(out)];
      });
      if (hit.length) bad.push(`${name}: ${hit.join(', ')}`);
    }
    ok(!bad.length, `${w}x${h}: every menu screen fits without scrolling, with nothing under the corner buttons${bad.length ? ': ' + bad.join(', ') : ''}`);
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
