const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: false, args: ['--auto-accept-this-tab-capture', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--use-angle=d3d11'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message));
  await page.goto('http://127.0.0.1:3000/');
  await page.getByRole('button', { name: 'Try the demo songs' }).click();
  await page.getByRole('region', { name: 'Player' }).getByText('Neon Static').waitFor();
  await page.waitForFunction(() => window.__lsIndex);
  await page.evaluate(() => window.__lsIndex.player.pause()); await page.waitForTimeout(800);
  const res = await page.evaluate(async () => {
    const { AudioCapture, ChunkClock, FeatureTrack, usePlayer } = window.__lsIndex;
    const truthTrack = usePlayer.getState().track;
    const truth = truthTrack.beatTimesMs;
    // play the demo audio in this tab, listen to it through the capture path, place blocks by the audio element's clock
    const ab = await (await fetch(truthTrack.audioUrl)).arrayBuffer(); const pctx = new AudioContext(); const buf = await pctx.decodeAudioData(ab); const src = pctx.createBufferSource(); src.buffer = buf; src.connect(pctx.destination); let startedAt = 0; const audio = { get currentTime() { return (pctx.currentTime - startedAt); }, get paused() { return !startedAt; }, play: async () => { await pctx.resume(); startedAt = pctx.currentTime; src.start(); }, pause: () => { try { src.stop(); } catch {} } };
    audio.crossOrigin = 'anonymous';
    const cap = new AudioCapture();
    const clock = new ChunkClock();
    const ft = new FeatureTrack(truthTrack.durationMs);
    let blocks = 0, placed = 0;
    cap.onBlock = (samples, sr) => {
      blocks++;
      const start = clock.place(samples.length, sr, audio.currentTime * 1000);
      if (start === null || audio.paused) return;
      placed++;
      ft.pushPcm(samples, sr, start);
    };
    await cap.start();
    await audio.play();
    await new Promise((r) => setTimeout(r, 30000));
    audio.pause();
    cap.stop();
    const f = ft.toFeatures('capture');
    const errs = f.beatTimesMs.map((b) => Math.min(...truth.map((x) => Math.abs(x - b))));
    errs.sort((a, b) => a - b);
    return { sampleRate: cap.sampleRate, blocks, placed, heardMs: ft.heardMs(), bpm: f.bpm, truthBpm: truthTrack.bpm, conf: f.bpmConfidence, beats: f.beatTimesMs.length, medianErrMs: errs[errs.length >> 1], within70: errs.filter((e) => e <= 70).length / Math.max(1, errs.length), covered: f.covered };
  });
  console.log('capture path vs ground truth:', JSON.stringify(res));
  console.log('errors:', JSON.stringify(errs.slice(0, 4)));
  await browser.close();
})();
