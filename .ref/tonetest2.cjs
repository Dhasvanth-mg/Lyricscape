const { chromium } = require('@playwright/test');
(async () => {
  const mode = process.argv[2] || 'tab';
  const args = ['--auto-accept-this-tab-capture', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--use-angle=d3d11'];
  if (mode === 'system') args.unshift('--auto-select-desktop-capture-source=Entire screen');
  const browser = await chromium.launch({ channel: 'msedge', headless: false, args, ignoreDefaultArgs: ['--mute-audio'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  await page.goto('http://127.0.0.1:3000/');
  await page.getByRole('button', { name: 'Try the demo songs' }).click();
  await page.getByRole('region', { name: 'Player' }).getByText('Neon Static').waitFor();
  await page.waitForFunction(() => window.__lsIndex);
  await page.evaluate(() => window.__lsIndex.player.pause());
  await page.waitForTimeout(800);
  const r = await page.evaluate(async (mode) => {
    const { AudioCapture } = window.__lsIndex;
    const pctx = new AudioContext();
    const osc = pctx.createOscillator(); osc.frequency.value = 440;
    const g = pctx.createGain(); g.gain.value = 0.5;
    osc.connect(g); g.connect(pctx.destination); const an = pctx.createAnalyser(); g.connect(an); window.__an = an; window.__state = () => pctx.state;
    const cap = new AudioCapture(); const chunks = []; let on = false;
    cap.onBlock = (s) => { if (on) chunks.push(s.slice()); };
    await cap.start(mode); await pctx.resume(); on = true; osc.start();
    await new Promise((r) => setTimeout(r, 2000)); const td = new Float32Array(2048); an.getFloatTimeDomainData(td); window.__localPeak = Math.max(...td.map(Math.abs)); await new Promise((r) => setTimeout(r, 2000));
    osc.stop(); cap.stop();
    const n = chunks.reduce((a, c) => a + c.length, 0); const m = new Float32Array(n); let o = 0; for (const c of chunks) { m.set(c, o); o += c.length; }
    // amplitude of the steady part: peak and RMS over the middle second; and the dominant frequency by zero-crossings
    const sr = cap.sampleRate; const a = Math.round(sr * 1.5), b = Math.round(sr * 2.5);
    let pk = 0, ss = 0, zc = 0; for (let i = a; i < b; i++) { pk = Math.max(pk, Math.abs(m[i])); ss += m[i] * m[i]; if (m[i - 1] < 0 && m[i] >= 0) zc++; }
    return { ctxState: pctx.state, localPeakAtSource: window.__localPeak, sr, secs: (n / sr).toFixed(1), peak: +pk.toFixed(3), rms: +Math.sqrt(ss / (b - a)).toFixed(3), hz: zc, expectedPeak: 0.5, expectedRms: 0.354 };
  }, mode);
  console.log(mode, JSON.stringify(r));
  await browser.close();
})();
