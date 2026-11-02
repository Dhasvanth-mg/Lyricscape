// usage: node .ref/shoot.cjs <style> <outPrefix> <w>x<h> [lineIdx:offsetMs,...]
const { chromium } = require('@playwright/test');
const fs = require('fs');
(async () => {
  const [style, out, size = '1280x720', spec = ''] = process.argv.slice(2);
  const [vw, vh] = size.split('x').map(Number);
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: vw, height: vh } });
  const errs = [];
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errs.push(m.text()));
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  await page.goto('http://127.0.0.1:3000/');
  await page.getByRole('button', { name: 'Try the demo songs' }).click();
  await page.getByRole('region', { name: 'Player' }).getByText('Neon Static').waitFor();
  await page.keyboard.press('l');
  await page.waitForFunction(() => window.__ls && window.__ls.r && window.__ls.r.timeline, null, { timeout: 60000 }).catch(() => {});
  await page.evaluate((s) => window.__ls.ui.getState().set({ mode: 'turbo', turboStyle: s }), style);
  await page.waitForTimeout(1500);
  if (process.env.LABEL) await page.evaluate((l) => { const r = window.__ls.r; r.setTimeline({ ...r.timeline, label: l }); }, process.env.LABEL);
  const info = await page.evaluate(() => {
    const tl = window.__ls.r.timeline;
    return tl ? tl.scenes.map((s) => [s.startMs, s.endMs, s.words.map((w) => w.text).join(' ')]) : null;
  });
  console.log(JSON.stringify(info && info.slice(0, 14)));
  const plan = (spec || '0:300,0:1200,1:300,1:1400,2:300,2:1400,3:400,3:1500').split(',').map((x) => x.split(':').map(Number));
  let i = 0;
  for (const [li, off] of plan) {
    const url = await page.evaluate(([li, off, label]) => {
      const r = window.__ls.r;
      if (label && r.timeline.label !== label) r.setTimeline({ ...r.timeline, label });
      const sc = r.timeline.scenes[li];
      const t = sc.startMs + off;
      r.render(t);
      const c = document.querySelector('[data-testid=lyric-stage] canvas');
      return c.toDataURL('image/png');
    }, [li, off, process.env.LABEL || '']);
    fs.writeFileSync(`${out}-${String(i++).padStart(2, '0')}.png`, Buffer.from(url.split(',')[1], 'base64'));
  }
  console.log('errors:', JSON.stringify(errs.slice(0, 6)));
  await browser.close();
})();
