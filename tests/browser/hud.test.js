// Checks that no HUD pieces overlap, at phone-landscape, phone-portrait, tablet and computer sizes.
const { chromium, FILE, shot } = require('./lib');
const SIZES = [[762, 341, 'your phone, landscape fullscreen'], [800, 360, 'small phone landscape'], [844, 390, 'iPhone-size landscape'],
  [915, 412, 'large phone landscape'], [740, 360, 'narrow phone landscape'], [412, 915, 'phone portrait'], [1024, 768, 'tablet'],
  [1280, 720, 'laptop'], [1000, 640, 'computer window']];
const shotName = process.argv[2] || 'hud';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  let bad = 0; const log = [];
  for (const [w, h, label] of SIZES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    await ctx.addInitScript(() => { try { localStorage.setItem('retroRack.rotateHint', 'off'); localStorage.setItem('retroRack.settings', JSON.stringify({ pixel: 6 })); } catch (e) {} });
    const p = await ctx.newPage();
    p.on('console', m => { if (!/GPU stall/.test(m.text())) log.push(`${w}x${h} [${m.type()}] ${m.text()}`); });
    p.on('pageerror', e => log.push(`${w}x${h} [pageerror] ${e.message}`));
    await p.goto(FILE); await p.waitForTimeout(900);
    const problems = [];
    for (const mode of ['game', 'practice']) {
      await p.evaluate(m => { const r = window.__rr; if (m === 'game') { r.M.mode = '8ball'; r.M.opp = 'bot'; } else { r.M.mode = 'practice'; r.M.rack = 'trick'; } r.startGame(); }, mode);
      await p.waitForTimeout(500);
      // show every optional button at once: Replay and (as in online games) Chat
      await p.evaluate(m => { for (const id of m === 'game' ? ['#bReplay', '#bChat'] : ['#bReplay']) document.querySelector(id).hidden = false; }, mode);   // Chat is online-only
      await p.waitForTimeout(250);
      const found = await p.evaluate(() => {
        const vis = el => el && !el.closest('[hidden]') && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
        const items = [];
        const add = (name, el) => { if (vis(el)) items.push([name, el.getBoundingClientRect()]); };
        add('scoreboard', document.querySelector('#board'));
        add('spin/power panel', document.querySelector('#shot'));
        document.querySelectorAll('#tools .btn').forEach(el => add(`"${el.textContent}" button`, el));
        document.querySelectorAll('#practice > .btn').forEach(el => add(`practice "${el.textContent}"`, el));
        add('trick panel', document.querySelector('#trickInfo'));
        const out = [], W = innerWidth, H = innerHeight;
        for (let i = 0; i < items.length; i++) {
          const [n, r] = items[i];
          if (r.left < -1 || r.top < -1 || r.right > W + 1 || r.bottom > H + 1) out.push(`${n} runs off the screen`);
          for (let j = i + 1; j < items.length; j++) {
            const [m, s] = items[j];
            if (n.startsWith('"') && m.startsWith('"')) continue;            // buttons in the same column sit side by side
            if (n.startsWith('practice') && m.startsWith('practice')) continue;
            if (r.left < s.right - 1 && s.left < r.right - 1 && r.top < s.bottom - 1 && s.top < r.bottom - 1) out.push(`${n} overlaps ${m}`);
          }
        }
        return out;
      });
      problems.push(...found.map(f => `${mode}: ${f}`));
      if (w === 762 || w === 915 || w === 412 || w === 1280) await p.screenshot({ path: shot(`${shotName}-${mode}-${w}x${h}.png`) });
    }
    console.log(`${problems.length ? 'FAIL' : 'PASS'} ${w}x${h} (${label})${problems.length ? ':\n       ' + [...new Set(problems)].join('\n       ') : ''}`);
    bad += problems.length ? 1 : 0;
    await ctx.close();
  }
  console.log(log.length ? 'console:\n  ' + log.join('\n  ') : 'console clean');
  await b.close(); process.exitCode = bad ? 1 : 0;
})();
