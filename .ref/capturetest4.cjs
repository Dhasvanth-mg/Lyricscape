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
  const res = await page.evaluate(async () => {
    const { AudioCapture, usePlayer } = window.__lsIndex;
    const t = usePlayer.getState().track;
    const env = (mono, sr) => { const step = Math.round(sr * 0.02); const e = []; for (let i = 0; i + step < mono.length; i += step) { let s = 0; for (let k = 0; k < step; k++) s += mono[i + k] * mono[i + k]; e.push(Math.sqrt(s / step)); } return e; };
    const peaks = (e, rel) => { const mx = Math.max(...e); const p = []; for (let i = 2; i < e.length - 2; i++) if (e[i] > rel * mx && e[i] > e[i - 1] && e[i] >= e[i + 1] && e[i] > e[i - 2] && e[i] >= e[i + 2]) p.push(i * 20); return p; };
    // the file
    const ab = await (await fetch(t.audioUrl)).arrayBuffer();
    const ctx = new AudioContext();
    const buf = await ctx.decodeAudioData(ab);
    const fe = env(buf.getChannelData(0), buf.sampleRate);
    const fp = peaks(fe.slice(0, 1250), 0.5);
    // the capture
    const audio = new Audio(t.audioUrl);
    const cap = new AudioCapture();
    const chunks = [];
    cap.onBlock = (s) => chunks.push(s);
    await cap.start();
    await audio.play();
    await new Promise((r) => setTimeout(r, 14000));
    audio.pause(); cap.stop();
    const total = chunks.reduce((a, c) => a + c.length, 0);
    const mono = new Float32Array(total); let o = 0;
    for (const c of chunks) { mono.set(c, o); o += c.length; }
    const ce = env(mono, cap.sampleRate);
    const cp = peaks(ce, 0.5);
    return { fileMax: Math.max(...fe), capMax: Math.max(...ce), filePeaks: fp.slice(0, 14), capPeaks: cp.slice(0, 14), capEnvFirst: ce.slice(0, 30).map((x) => +x.toFixed(3)) };
  });
  console.log(JSON.stringify(res));
  await browser.close();
})();
