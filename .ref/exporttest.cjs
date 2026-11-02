// node .ref/exporttest.cjs <style>  -> exports a short clip from the export dialog and prints the result line
const { chromium } = require('@playwright/test');
const fs = require('fs');
(async () => {
  const style = process.argv[2] || 'sketch';
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
  await page.goto('http://127.0.0.1:3000/');
  await page.getByRole('button', { name: 'Try the demo songs' }).click();
  await page.getByRole('region', { name: 'Player' }).getByText('Neon Static').waitFor();
  await page.keyboard.press('l');
  await page.getByRole('button', { name: 'Export lyric video' }).click();
  const dlg = page.getByRole('dialog', { name: 'Export lyric video' });
  await dlg.getByTestId('export-mode-turbo').click();
  await dlg.getByTestId('export-turbo-style').selectOption(style);
  await dlg.getByLabel('Start second').fill('4');
  await dlg.getByLabel('End second').fill('8');
  await page.waitForTimeout(800);
  const dl = page.waitForEvent('download', { timeout: 170000 }).catch(() => null);
  await dlg.getByRole('button', { name: /Export video/ }).click();
  const d = await dl;
  if (d) { const path = '.ref/out/export-' + style + '-' + d.suggestedFilename(); await d.saveAs(path); console.log('downloaded', path, fs.statSync(path).size, 'bytes'); } else console.log('no download');
  console.log('alert:', await dlg.getByRole('alert').innerText().catch(() => '(none)'));
  console.log('errors:', JSON.stringify(errs.slice(0, 5)));
  await browser.close();
})();
