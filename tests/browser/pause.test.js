// Pause and Settings: tabs along the top, each tab its own page that scrolls. In a game it opens on Match (Resume, Re-rack,
// Concede, Quit, with what's being played), with a Resume button at the end of the tab row; from the menus there's no
// Match tab, it says Done, and it opens on the last settings tab used. Picking a tab glides the highlight under it and
// slides its page in from that side (← and → move between the tabs); dev mode adds a Dev tab. A large panel on a
// computer, the whole screen on a phone; the tabs scroll sideways on an upright phone. Still with reduced motion.
const { chromium, FILE } = require('./lib');
const ok = (c, msg) => { console.log((c ? 'PASS ' : 'FAIL ') + msg); if (!c) process.exitCode = 1; };
const ARGS = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
(async () => {
  const b = await chromium.launch({ args: ARGS }), log = [];
  const page = async (w, h, opts = {}, dev) => {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, ...opts });
    await ctx.addInitScript(d => { try { localStorage.setItem('retroRack.rotateHint', 'off'); if (d) localStorage.setItem('retroRack.dev', '1'); } catch (e) {} }, !!dev);
    const p = await ctx.newPage();
    p.on('console', m => { if (!/GPU stall/.test(m.text())) log.push(`${w}x${h} [${m.type()}] ${m.text()}`); }); p.on('pageerror', e => log.push(`${w}x${h} [pageerror] ${e.message}`));
    await p.goto(FILE); await p.waitForTimeout(1200); return p;
  };
  const game = (p, mode, opp) => p.evaluate(([m, o]) => { const r = __rr; r.M.mode = m; r.M.opp = o; r.M.diff = 'medium'; r.M.rack = '8ball'; r.startGame(); }, [mode, opp]);
  const tabs = p => p.$$eval('#pTabs .pTab', ts => ts.filter(t => !t.hidden).map(t => t.textContent));
  const on = p => p.evaluate(() => ({ tab: document.querySelector('#pTabs [aria-selected="true"]').dataset.tab, pages: [...document.querySelectorAll('.pPage')].filter(x => !x.hidden).map(x => x.dataset.tab) }));
  const ink = p => p.evaluate(() => { const i = document.querySelector('#pInk').getBoundingClientRect(), t = document.querySelector('#pTabs [aria-selected="true"]').getBoundingClientRect(); return Math.abs(i.left - t.left) < 1.5 && Math.abs(i.width - t.width) < 1.5; });
  const big = p => p.$$eval('#pauseGame .btn', bs => bs.filter(x => !x.hidden).map(x => x.textContent));

  console.log('--- in a game, on a computer');
  const p = await page(1280, 720);
  await game(p, '8ball', 'bot'); await p.waitForTimeout(1500);
  await p.keyboard.press('Escape'); await p.waitForTimeout(400);
  let s = await on(p);
  ok((await tabs(p)).join() === 'Match,Play,Looks,Display,Sound' && s.tab === 'match' && s.pages.join() === 'match', `Esc opens it on Match, with Play, Looks, Display and Sound beside it (${await tabs(p)})`);
  ok((await big(p)).join() === 'Resume,Re-rack,Concede frame,Quit to menu' && await p.textContent('#bResume') === 'Resume', `Match: ${await big(p)}, and Resume at the end of the tab row`);
  ok(/^8-ball · You 0, CPU 0$/.test(await p.textContent('#pSub')), `with what's being played ("${await p.textContent('#pSub')}")`);
  const box = await p.evaluate(() => { const r = document.querySelector('#pausePanel').getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round); });
  ok(box[2] <= 900 && box[3] <= 620 && box[2] > 800 && Math.abs(box[0] - (1280 - box[2]) / 2) < 2, `a large panel in the middle of the screen (${box})`);
  ok(await ink(p), 'the highlight sits under Match');
  await p.click('#pTabs [data-tab="display"]'); await p.waitForTimeout(60);
  const slide = await p.evaluate(() => { const g = document.querySelector('#pgDisplay'); return { cls: g.classList.contains('slide'), dx: g.style.getPropertyValue('--dx'), anim: getComputedStyle(g).animationName }; });
  await p.waitForTimeout(300); s = await on(p);
  ok(s.tab === 'display' && s.pages.join() === 'display' && await ink(p), 'picking Display shows only its page, the highlight under it');
  ok(slide.cls && slide.dx === '28px' && slide.anim === 'pSlide', `its page slides in from the right, the side it's on (${JSON.stringify(slide)})`);
  await p.click('#pTabs [data-tab="play"]'); await p.waitForTimeout(60);
  ok(await p.evaluate(() => document.querySelector('#pgPlay').style.getPropertyValue('--dx')) === '-28px', 'and Play, back to the left, slides in from the left');
  await p.waitForTimeout(300);
  await p.focus('#pTabs [data-tab="play"]'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(300);
  s = await on(p); ok(s.tab === 'looks' && await p.evaluate(() => document.activeElement.dataset.tab) === 'looks', '→ moves to the next tab, Looks');
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(300);
  ok((await on(p)).tab === 'match', '← twice goes back to Match');
  await p.click('#bResumeBig'); await p.waitForTimeout(200);
  ok(await p.isHidden('#pause') && await p.evaluate(() => __rr.state) === 'aim', 'the big Resume goes back to the game');
  await p.click('#bPause'); await p.waitForTimeout(300); await p.click('#pTabs [data-tab="sound"]'); await p.waitForTimeout(300);
  await p.click('#bResume'); await p.waitForTimeout(200);
  ok(await p.isHidden('#pause'), 'and so does Resume at the end of the tab row, from any tab');
  await p.click('#bPause'); await p.waitForTimeout(300);
  ok((await on(p)).tab === 'match', 'in a game it always opens on Match');
  await p.mouse.click(30, 360); await p.waitForTimeout(200);
  ok(await p.isHidden('#pause'), 'a click outside the panel closes it');

  console.log('--- practice');
  await game(p, 'practice', 'friend'); await p.waitForTimeout(1200); await p.click('#bPause'); await p.waitForTimeout(300);
  ok((await big(p)).join() === 'Resume,Reset table,Quit to menu' && await p.textContent('#pSub') === 'Practice', `Match in practice: ${await big(p)} ("${await p.textContent('#pSub')}")`);
  await p.click('#bQuit'); await p.waitForTimeout(600);

  console.log('--- from the menus');
  await p.click('#bMenuSettings'); await p.waitForTimeout(300);
  ok((await tabs(p)).join() === 'Play,Looks,Display,Sound' && await p.textContent('#bResume') === 'Done' && (await on(p)).tab === 'play', 'Settings: no Match tab, Done, and it opens on Play');
  await p.click('#pTabs [data-tab="sound"]'); await p.waitForTimeout(300); await p.click('#bResume'); await p.waitForTimeout(200);
  await p.click('#bMenuSettings'); await p.waitForTimeout(300);
  ok((await on(p)).tab === 'sound' && await ink(p), 'it opens again on the tab you were last on (Sound), the highlight under it');
  await p.click('#bResume');

  console.log('--- a phone on its side');
  const q = await page(762, 341);
  await game(q, '8ball', 'bot'); await q.waitForTimeout(1500); await q.click('#bPause'); await q.waitForTimeout(400);
  const ph = await q.evaluate(() => { const r = document.querySelector('#pausePanel').getBoundingClientRect(), m = document.querySelector('#pgMatch'); return { full: Math.round(r.width) === innerWidth && Math.round(r.height) === innerHeight, fits: m.scrollHeight <= m.clientHeight + 1 }; });
  ok(ph.full && ph.fits, `it fills the screen, and Match fits without scrolling (${JSON.stringify(ph)})`);
  await q.click('#pTabs [data-tab="display"]'); await q.waitForTimeout(300);
  const sc = await q.evaluate(() => { const g = document.querySelector('#pgDisplay'), pn = document.querySelector('#pausePanel'), h = document.querySelector('#pTabs').getBoundingClientRect().top; g.scrollTop = 9999; return { long: g.scrollHeight > g.clientHeight, scrolled: g.scrollTop > 0, panel: pn.scrollHeight <= pn.clientHeight, head: Math.abs(document.querySelector('#pTabs').getBoundingClientRect().top - h) < 1 }; });
  ok(sc.long && sc.scrolled && sc.panel && sc.head, `Display is longer than the screen: its page scrolls, the tabs stay put (${JSON.stringify(sc)})`);
  await q.waitForTimeout(200); await q.click('#sScan'); await q.waitForTimeout(150);
  ok(await q.textContent('#sScan') === 'On', 'and its last setting can be reached and used (Scanlines)');
  await q.click('#sScan');

  console.log('--- an upright phone');
  const u = await page(412, 915);
  await game(u, '8ball', 'bot'); await u.waitForTimeout(1500); await u.click('#bPause'); await u.waitForTimeout(400);
  await u.click('#pTabs [data-tab="sound"]'); await u.waitForTimeout(400);
  const up = await u.evaluate(() => { const bar = document.querySelector('#pTabs').getBoundingClientRect(), t = document.querySelector('#pTabs [data-tab="sound"]').getBoundingClientRect(), rs = document.querySelector('#bResume').getBoundingClientRect(); return { inBar: t.left >= bar.left - 1 && t.right <= bar.right + 1, resume: rs.right <= innerWidth && rs.left >= bar.right - 1 }; });
  ok(up.inBar && up.resume && await ink(u), `the tabs fit or scroll sideways: Sound comes into view when picked, Resume stays at the end (${JSON.stringify(up)})`);

  console.log('--- dev mode');
  const d = await page(1000, 640, {}, true);
  await d.click('#bMenuSettings'); await d.waitForTimeout(300);
  ok((await tabs(d)).join() === 'Play,Looks,Display,Sound,Dev', `dev mode adds a Dev tab (${await tabs(d)})`);
  await d.click('#pTabs [data-tab="dev"]'); await d.waitForTimeout(300);
  ok(await d.isVisible('#sDev') && await d.isVisible('#sDevMythic') && await d.isVisible('#sDevEmpty'), 'with its three switches, each on its own row');

  console.log('--- reduced motion');
  const r = await page(1000, 640, { reducedMotion: 'reduce' });
  await r.click('#bMenuSettings'); await r.waitForTimeout(300); await r.click('#pTabs [data-tab="looks"]'); await r.waitForTimeout(40);
  const still = await r.evaluate(() => ({ page: getComputedStyle(document.querySelector('#pgLooks')).animationName, panel: getComputedStyle(document.querySelector('#pausePanel')).animationName, ink: getComputedStyle(document.querySelector('#pInk')).transitionDuration }));
  ok(still.page === 'none' && still.panel === 'none' && /^0s/.test(still.ink) && await ink(r), `nothing slides, fades or glides; the tab still changes (${JSON.stringify(still)})`);

  ok(log.length === 0, 'console clean' + (log.length ? ': ' + log.join(' | ') : ''));
  await b.close();
})();
