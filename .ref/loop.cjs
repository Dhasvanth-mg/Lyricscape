const { chromium } = require('@playwright/test');
const fs = require('fs');
const count = () => (fs.readFileSync('.next/dev/logs/next-development.log', 'utf8').match(/Compiled in/g) || []).length;
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  const urls = [];
  page.on('request', (r) => { const u = r.url().replace('http://127.0.0.1:3000', ''); if (!/_next\/static|\.(woff2?|png|svg|ico)/.test(u)) urls.push(r.method() + ' ' + u.slice(0, 90)); });
  const c0 = count();
  await page.goto('http://127.0.0.1:3000/');
  await page.waitForTimeout(8000);
  console.log('rebuilds in 8s:', count() - c0);
  const tally = {};
  for (const u of urls) tally[u] = (tally[u] || 0) + 1;
  console.log(Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 12));
  await browser.close();
})();
