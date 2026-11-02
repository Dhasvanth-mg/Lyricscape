const { chromium } = require('@playwright/test');
const fs = require('fs');
(async () => {
  const dir = process.argv[2];
  const lrc = fs.readFileSync(`${dir}/FlashingLights.word.lrc`, 'utf8');
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
  const lookups = [];
  page.on('request', (r) => /api\/tempo\/lookup/.test(r.url()) && lookups.push(decodeURIComponent(r.url().split('?')[1] || '')));
  await page.addInitScript((k) => { try { const p = JSON.parse(localStorage.getItem(k) || '{}'); p.indexLocal = false; localStorage.setItem(k, JSON.stringify(p)); } catch {} }, 'lyricscape.prefs.v1');
  await page.goto('http://127.0.0.1:3000/');
  await page.getByRole('button', { name: 'Try the demo songs' }).click();
  await page.getByRole('region', { name: 'Player' }).getByText('Neon Static').waitFor();
  await page.waitForFunction(() => window.__lsIndex);
  await page.evaluate(() => window.__lsIndex.player.pause());
  // a stand-in for a Spotify song: Kanye West - Flashing Lights, 237 s, no beat grid of its own, its lyrics in the index (word-synced)
  const id = 'demo:tempo-fl-' + Date.now();
  await page.request.put('http://127.0.0.1:3000/api/index/' + encodeURIComponent(id), { data: { song: { provider: 'demo', title: 'Flashing Lights', artists: ['Kanye West'], durationMs: 237000 }, features: { lyrics: { lrc, source: 'Musixmatch (test)', synced: true, origin: 'musixmatch', savedAt: 1 } } } });
  await page.evaluate(async (id) => {
    window.__lsIndex.useIndexer; // indexer reference
    const ui = (await import('/_next/static/chunks/dummy.js').catch(() => null));
  }, id).catch(() => {});
  await page.evaluate(async (id) => {
    const { usePlayer, player } = window.__lsIndex;
    const t = usePlayer.getState().track;
    await player.playTrack({ ...t, id, title: 'Flashing Lights', artists: ['Kanye West'], durationMs: 237000, beatTimesMs: undefined, bpm: undefined, lyricsUrl: undefined });
    await player.pause();
  }, id);
  await page.keyboard.press('l');
  await page.waitForFunction(() => window.__ls && window.__ls.r && window.__ls.r.timeline, null, { timeout: 30000 });
  // wait for the lookup + lyric alignment to land in the index
  let tl = null;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(700);
    tl = await page.evaluate(() => { const t = window.__ls.r.timeline; return { bpm: t.bpm, beats: t.beatTimesMs.length, first: t.beatTimesMs.slice(0, 3), scenes: t.scenes.length }; });
    if (tl.bpm) break;
  }
  console.log('lookups:', JSON.stringify(lookups));
  console.log('stage timeline after lookup + lyrics:', JSON.stringify(tl));
  const entry = await (await page.request.get('http://127.0.0.1:3000/api/index/' + encodeURIComponent(id))).json();
  console.log('stored tempo:', JSON.stringify(entry.entry && entry.entry.features.tempo));
  // open the Sync tab and read the Beat section
  await page.mouse.move(640, 400);
  await page.getByTestId('sync-pill').click();
  await page.getByTestId('beat-panel').waitFor();
  console.log('beat panel says:', await page.getByTestId('beat-status').innerText());
  // tap along: 12 taps, 500 ms apart (120 BPM) while the song position advances
  await page.evaluate(() => window.__lsIndex.player.play && window.__lsIndex.player.play());
  for (let i = 0; i < 12; i++) { await page.getByTestId('beat-tap').dispatchEvent('pointerdown'); await page.waitForTimeout(500); }
  await page.getByTestId('beat-panel').scrollIntoViewIfNeeded(); await page.getByTestId('stage-panel').screenshot({ path: '.ref/out/beat-panel.png' }); console.log('tap label:', (await page.getByTestId('beat-tap').innerText()).replace(/\n/g, ' | '));
  await page.getByTestId('beat-save').click();
  await page.waitForTimeout(800);
  console.log('beat panel after saving taps:', await page.getByTestId('beat-status').innerText());
  const tl2 = await page.evaluate(() => { const t = window.__ls.r.timeline; return { bpm: t.bpm, beats: t.beatTimesMs.length }; });
  console.log('stage timeline after taps:', JSON.stringify(tl2));
  await page.getByRole('button', { name: 'Forget my taps' }).click();
  await page.waitForTimeout(1000);
  console.log('after forgetting taps:', await page.getByTestId('beat-status').innerText());
  console.log('errors:', JSON.stringify(errs.slice(0, 4)));
  await browser.close();
})();
