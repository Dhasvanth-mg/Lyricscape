const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto('http://127.0.0.1:3000/');
  const put = await page.request.put('http://127.0.0.1:3000/api/index/' + encodeURIComponent('demo:neon-static'), { data: { song: { provider: 'demo', title: 'Neon Static', artists: ['Lyricscape Demo Lab'], durationMs: 52929 }, features: { lyrics: { lrc: '[00:02.00] copied from the song index\n[00:05.00] second line here', source: 'index test', synced: true, origin: 'user', savedAt: 1 } } } });
  console.log('PUT lyrics:', put.status());
  await page.reload();
  await page.getByRole('button', { name: 'Try the demo songs' }).click().catch(() => {});
  await page.getByRole('region', { name: 'Player' }).getByText('Neon Static').waitFor();
  await page.keyboard.press('l');
  await page.waitForFunction(() => window.__ls && window.__ls.r && window.__ls.r.timeline, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const first = await page.evaluate(() => window.__ls.r.timeline.scenes.slice(0, 2).map((s) => s.words.map((w) => w.text).join(' ')));
  console.log('stage lyrics now:', JSON.stringify(first));
  const del = await page.request.delete('http://127.0.0.1:3000/api/index/' + encodeURIComponent('demo:neon-static') + '?kind=lyrics');
  console.log('DELETE lyrics kind:', del.status(), JSON.stringify(await del.json()));
  // the browser also holds it now (stored in IndexedDB); remove it so the demo returns to its bundled lyrics
  await page.evaluate(async () => { await new Promise((res) => { const r = indexedDB.open('lyricscape'); r.onsuccess = () => { const db = r.result; const tx = db.transaction('lyrics', 'readwrite'); tx.objectStore('lyrics').delete('demo:neon-static'); tx.oncomplete = () => res(); }; }); });
  console.log('errors:', JSON.stringify(errs.slice(0, 3)));
  await browser.close();
})();
