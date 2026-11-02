const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: false, args: ['--auto-accept-this-tab-capture', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--use-angle=d3d11'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  await page.goto('http://127.0.0.1:3000/');
  await page.getByRole('button', { name: 'Try the demo songs' }).click();
  await page.getByRole('region', { name: 'Player' }).getByText('Neon Static').waitFor();
  await page.waitForFunction(() => window.__lsIndex);
  await page.getByRole('region', { name: 'Player' }).getByRole('button', { name: /pause/i }).click().catch(() => {});
  const res = await page.evaluate(async () => {
    const { AudioCapture, FeatureTrack, usePlayer } = window.__lsIndex;
    const t = usePlayer.getState().track;
    const truth = t.beatTimesMs;
    const audio = new Audio(t.audioUrl);
    const cap = new AudioCapture();
    const chunks = [];
    const marks = [];
    cap.onBlock = (s, sr) => { chunks.push(s); marks.push(audio.currentTime * 1000); };
    await cap.start();
    await audio.play();
    await new Promise((r) => setTimeout(r, 25000));
    audio.pause(); cap.stop();
    const sr = cap.sampleRate;
    const total = chunks.reduce((a, c) => a + c.length, 0);
    const mono = new Float32Array(total); let o = 0; let rmsSum = 0;
    for (const c of chunks) { mono.set(c, o); o += c.length; for (let i = 0; i < c.length; i += 64) rmsSum += c[i] * c[i]; }
    // where did the audio start relative to the element clock: marks[i] - cumulative time
    const offs = marks.map((m, i) => m - ((i + 1) * 4096 * 1000) / sr);
    // B: contiguous placement anchored at the median offset
    offs.sort((a, b) => a - b);
    const med = offs[offs.length >> 1];
    const ftB = new FeatureTrack(t.durationMs);
    for (let i = 0; i < chunks.length; i++) ftB.pushPcm(chunks[i], sr, med + (i * 4096 * 1000) / sr);
    const fB = ftB.toFeatures('capture');
    const errB = fB.beatTimesMs.filter((b) => b > 2000 && b < 22000).map((b) => Math.min(...truth.map((x) => Math.abs(x - b)))).sort((a, b) => a - b);
    return { sr, total, rms: Math.sqrt(rmsSum / (total / 64)), offsetSpreadMs: [offs[0], med, offs[offs.length - 1]], bpm: fB.bpm, conf: fB.bpmConfidence, medErrInHeard: errB[errB.length >> 1], within70: errB.filter((e) => e <= 70).length / Math.max(1, errB.length) };
  });
  console.log(JSON.stringify(res));
  await browser.close();
})();
