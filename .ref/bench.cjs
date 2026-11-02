const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://127.0.0.1:3000/');
  await page.getByRole('button', { name: 'Try the demo songs' }).click();
  await page.getByRole('region', { name: 'Player' }).getByText('Neon Static').waitFor();
  await page.keyboard.press('l');
  await page.waitForFunction(() => window.__ls && window.__ls.r && window.__ls.r.timeline);
  for (const st of ['liquid', 'terminal', 'sketch', 'nebula', 'acid', 'ascii']) {
    await page.evaluate((s) => window.__ls.ui.getState().set({ mode: 'turbo', turboStyle: s }), st);
    await page.waitForTimeout(1200);
    const ms = await page.evaluate(() => { const r = window.__ls.r; const sc = r.timeline.scenes; const a = sc[2].startMs + 900; r.render(a); return [r.bench(a, 40), r.bench(sc[4].startMs + 900, 40)]; });
    console.log(st, ms.map((x) => x.toFixed(2)).join(' / '), 'ms');
  }
  console.log('errors', JSON.stringify(errs));
  await browser.close();
})();
