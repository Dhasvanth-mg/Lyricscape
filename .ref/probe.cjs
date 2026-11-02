const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11'] });
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  page.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 200)));
  page.on('pageerror', (e) => console.log('[pageerror]', e.message.slice(0, 300)));
  page.on('requestfailed', (r) => console.log('[reqfailed]', r.url().slice(0, 100)));
  await page.goto('http://127.0.0.1:3000/');
  await page.waitForTimeout(6000);
  console.log('disabled?', await page.getByRole('button', { name: 'Try the demo songs' }).isDisabled().catch((e) => 'n/a ' + e.message.slice(0, 80)));
  await browser.close();
})();
