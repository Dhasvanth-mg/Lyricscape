const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
  const reqs = [];
  page.on('request', (r) => /\/api\/index|\.mp3|\.wav|\.ogg|\.m4a/.test(r.url()) && reqs.push(r.method() + ' ' + r.url().replace('http://127.0.0.1:3000', '')));
  await page.goto('http://127.0.0.1:3000/');
  await page.getByRole('button', { name: 'Try the demo songs' }).click();
  await page.getByRole('region', { name: 'Player' }).getByText('Neon Static').waitFor();
  await page.waitForFunction(() => window.__lsIndex);
  // 1. analyser against the demo song's ground-truth beat grid
  const cmp = await page.evaluate(async () => {
    const { usePlayer, analyseTrackFile } = window.__lsIndex;
    const t = usePlayer.getState().track;
    const t0 = performance.now();
    const f = await analyseTrackFile(t);
    const ms = performance.now() - t0;
    const truth = t.beatTimesMs;
    const errs = f.beatTimesMs.map((b) => Math.min(...truth.map((x) => Math.abs(x - b))));
    errs.sort((a, b) => a - b);
    return { title: t.title, durationMs: t.durationMs, truthBpm: t.bpm, gotBpm: f.bpm, conf: f.bpmConfidence, beats: f.beatTimesMs.length, truthBeats: truth.length, medianErrMs: errs[errs.length >> 1], within70: errs.filter((e) => e <= 70).length / errs.length, analysisMs: Math.round(ms), covered: f.covered };
  });
  console.log('analyser vs demo ground truth:', JSON.stringify(cmp));
  // 2. the whole pipeline on a copy of the song that has no beat grid of its own
  const copyId = 'demo:index-test-' + Date.now();
  await page.evaluate(async (id) => {
    const { usePlayer, player } = window.__lsIndex;
    const t = usePlayer.getState().track;
    const copy = { ...t, id, beatTimesMs: undefined, bpm: undefined };
    window.__copy = copy;
    await player.playTrack(copy);
  }, copyId);
  await page.waitForFunction(() => /Learned|No steady beat|Could not/.test(window.__lsIndex.useIndexer.getState().message), null, { timeout: 90000 });
  console.log('indexer says:', await page.evaluate(() => window.__lsIndex.useIndexer.getState().message));
  await page.waitForTimeout(900);
  const entry = await (await page.request.get('http://127.0.0.1:3000/api/index/' + encodeURIComponent(copyId))).json();
  const a = entry.entry && entry.entry.features.audio;
  console.log('stored in the index:', JSON.stringify({ songs: entry.entry && entry.entry.song.title, bpm: a && a.bpm, beats: a && a.beatTimesMs.length, source: a && a.source }));
  console.log('stats:', JSON.stringify(await (await page.request.get('http://127.0.0.1:3000/api/index')).json()));
  console.log('requests so far:', reqs.length, JSON.stringify(reqs.slice(0, 8)));
  // 3. second time: reload, play the same song again, nothing is analysed
  reqs.length = 0;
  await page.reload();
  await page.getByRole('button', { name: 'Try the demo songs' }).click().catch(() => {});
  await page.waitForFunction(() => window.__lsIndex);
  await page.evaluate(async (id) => {
    const { usePlayer, player } = window.__lsIndex;
    const base = usePlayer.getState().track || (await (async () => null)());
    const t = base;
    await player.playTrack({ ...t, id, beatTimesMs: undefined, bpm: undefined });
  }, copyId);
  await page.waitForTimeout(2500);
  console.log('second play says:', await page.evaluate(() => window.__lsIndex.useIndexer.getState().message));
  console.log('second play requests:', JSON.stringify(reqs));
  // 4. the stage uses the learned beat grid
  await page.keyboard.press('l');
  await page.waitForFunction(() => window.__ls && window.__ls.r && window.__ls.r.timeline, null, { timeout: 30000 });
  const tl = await page.evaluate(() => { const t = window.__ls.r.timeline; return { bpm: t.bpm, beats: t.beatTimesMs.length, first: t.beatTimesMs.slice(0, 4) }; });
  console.log('stage timeline:', JSON.stringify(tl));
  console.log('errors:', JSON.stringify(errs.slice(0, 5)));
  await browser.close();
})();
