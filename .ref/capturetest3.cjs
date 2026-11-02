const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: false, args: ['--auto-accept-this-tab-capture', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--use-angle=d3d11'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  await page.goto('http://127.0.0.1:3000/');
  await page.getByRole('button', { name: 'Try the demo songs' }).click();
  await page.getByRole('region', { name: 'Player' }).getByText('Neon Static').waitFor();
  await page.waitForFunction(() => window.__lsIndex);
  await page.evaluate(() => window.__lsIndex.player.pause());
  await page.waitForTimeout(1000);
  const info = await page.evaluate(() => ({ status: window.__lsIndex.usePlayer.getState().status, audios: [...document.querySelectorAll('audio')].map((a) => ({ paused: a.paused, src: a.currentSrc.slice(-30) })) }));
  console.log('before:', JSON.stringify(info));
  const res = await page.evaluate(async () => {
    const { AudioCapture, FeatureTrack, usePlayer } = window.__lsIndex;
    const t = usePlayer.getState().track;
    const truth = t.beatTimesMs;
    const audio = new Audio(t.audioUrl);
    const cap = new AudioCapture();
    const chunks = [];
    cap.onBlock = (s) => chunks.push(s);
    await cap.start();
    await audio.play();
    await new Promise((r) => setTimeout(r, 25000));
    audio.pause(); cap.stop();
    const sr = cap.sampleRate;
    // does the captured sound have the demo's beat? compare to the same audio decoded from the file
    const { analysePcm } = await import('/_next/static/chunks/x.js').catch(() => ({}));
    const total = chunks.reduce((a, c) => a + c.length, 0);
    const mono = new Float32Array(total); let o = 0;
    for (const c of chunks) { mono.set(c, o); o += c.length; }
    // crude onset check: energy envelope in 20 ms steps, print the peaks' spacing
    const step = Math.round(sr * 0.02);
    const env = []; for (let i = 0; i + step < mono.length; i += step) { let e = 0; for (let k = 0; k < step; k++) e += mono[i + k] * mono[i + k]; env.push(Math.sqrt(e / step)); }
    const peaks = []; for (let i = 2; i < env.length - 2; i++) if (env[i] > 0.12 && env[i] > env[i - 1] && env[i] >= env[i + 1] && env[i] > env[i - 2] && env[i] >= env[i + 2]) peaks.push(i * 20);
    const gaps = peaks.slice(1).map((p, i) => p - peaks[i]);
    gaps.sort((a, b) => a - b);
    return { total, maxEnv: Math.max(...env), peaks: peaks.length, medianGapMs: gaps[gaps.length >> 1], first: peaks.slice(0, 10) };
  });
  console.log('captured envelope:', JSON.stringify(res));
  await browser.close();
})();
