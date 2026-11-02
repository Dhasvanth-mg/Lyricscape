const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 1100 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
  await page.goto('http://127.0.0.1:3000/settings');
  await page.getByTestId('song-index').waitFor();
  await page.waitForTimeout(1500);
  console.log('stats:', (await page.getByTestId('song-index-stats').innerText()).replace(/\n/g, ' | '));
  console.log('status:', await page.getByTestId('indexer-status').innerText());
  await page.getByTestId('song-index').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.ref/out/settings-index.png', clip: undefined, fullPage: false });
  const box = await page.getByTestId('song-index').boundingBox();
  await page.screenshot({ path: '.ref/out/settings-index.png', clip: { x: Math.max(0, box.x - 24), y: Math.max(0, box.y - 70), width: Math.min(1150, box.width + 48), height: Math.min(1000, box.height + 110) } });
  console.log('errors:', JSON.stringify(errs.slice(0, 4)));
  await browser.close();
})();
