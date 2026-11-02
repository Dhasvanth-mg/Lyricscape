const { chromium } = require('@playwright/test');
const fs = require('fs');
(async () => {
  const dir = process.argv[2];
  const cases = [['efd517ab', 'Let It Happen reel', 125, 28000], ['cc727550', 'Flashing Lights reel', 90, 14000], ['f4981a96', 'We Are The People reel', 126, 20000]];
  const browser = await chromium.launch({ channel: 'msedge', headless: false, ignoreDefaultArgs: ['--mute-audio'], args: ['--auto-accept-this-tab-capture', '--autoplay-policy=no-user-gesture-required', '--use-angle=d3d11'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  for (const [id] of cases) await page.route(`**/real-${id}.wav`, (r) => r.fulfill({ body: fs.readFileSync(`${dir}/${id}.wav`), contentType: 'audio/wav' }));
  await page.goto('http://127.0.0.1:3000/');
  await page.getByRole('button', { name: 'Try the demo songs' }).click();
  await page.getByRole('region', { name: 'Player' }).getByText('Neon Static').waitFor();
  await page.waitForFunction(() => window.__lsIndex);
  await page.evaluate(() => window.__lsIndex.player.pause());
  await page.waitForTimeout(800);
  for (const [id, name, truth, ms] of cases) {
    const r = await page.evaluate(async ([id, ms]) => {
      const { AudioCapture, ChunkClock, FeatureTrack } = window.__lsIndex;
      const ab = await (await fetch(`/real-${id}.wav`)).arrayBuffer();
      const pctx = new AudioContext();
      const buf = await pctx.decodeAudioData(ab);
      const src = pctx.createBufferSource(); src.buffer = buf; src.connect(pctx.destination);
      let startedAt = null;
      const clockMs = () => (startedAt === null ? 0 : (pctx.currentTime - startedAt) * 1000);
      const cap = new AudioCapture(); const clock = new ChunkClock(); const ft = new FeatureTrack(Math.round(buf.duration * 1000));
      let maxAbs = 0;
      cap.onBlock = (s, sr) => { if (startedAt === null) return; for (let i = 0; i < s.length; i += 16) maxAbs = Math.max(maxAbs, Math.abs(s[i])); const st = clock.place(s.length, sr, clockMs()); if (st !== null) ft.pushPcm(s, sr, st); };
      await cap.start(); await pctx.resume(); startedAt = pctx.currentTime; src.start();
      await new Promise((r) => setTimeout(r, Math.min(ms, buf.duration * 1000 - 500)));
      try { src.stop(); } catch {} cap.stop(); await pctx.close();
      const f = ft.toFeatures('capture');
      const ref = new FeatureTrack(Math.round(buf.duration * 1000)); const mono = buf.getChannelData(0); for (let i = 0; i < mono.length; i += 44100) ref.pushPcm(mono.subarray(i, i + 44100), buf.sampleRate, (i * 1000) / buf.sampleRate); const rf = ref.toFeatures('file');
      const heardEnd = ft.coveredRuns().reduce((a, r) => Math.max(a, r[1]), 0); const heardStart = ft.coveredRuns().reduce((a, r) => Math.min(a, r[0]), 1e9);
      const errs = f.beatTimesMs.filter((b) => b > heardStart + 1500 && b < heardEnd - 1500).map((b) => Math.min(...rf.beatTimesMs.map((x) => Math.abs(x - b)))).sort((a, b) => a - b);
      return { heardS: Math.round(ft.heardMs() / 1000), peakLevel: +maxAbs.toFixed(3), bpm: f.bpm, conf: f.bpmConfidence, beats: f.beatTimesMs.length, vsFileBeatsMedianMs: errs[errs.length >> 1], within50: +(errs.filter((e) => e <= 50).length / Math.max(1, errs.length)).toFixed(2) };
    }, [id, ms]);
    console.log(name.padEnd(24), 'known', truth, '| heard through tab capture:', JSON.stringify(r));
  }
  await browser.close();
})();
