const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');
(async () => {
  const seen = new Map();
  const w = fs.watch('.', { recursive: true }, (ev, f) => { if (!f || f.startsWith('node_modules') || f.startsWith('.git' + path.sep) || f.includes('next-development.log')) return; const k = ev + ' ' + f; seen.set(k, (seen.get(k) || 0) + 1); });
  const home = require('os').homedir() + path.sep + '.lyricscape';
  let hw = null; try { hw = fs.watch(home, (ev, f) => { const k = 'HOME ' + ev + ' ' + f; seen.set(k, (seen.get(k) || 0) + 1); }); } catch {}
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3000/');
  await page.waitForTimeout(6000);
  await browser.close();
  w.close(); hw && hw.close();
  console.log([...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15));
})();
