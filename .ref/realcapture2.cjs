const { chromium } = require('@playwright/test');
const fs = require('fs');
(async () => {
  const dir = process.argv[2];
  const browser = await chromium.launch({ channel: 'msedge', headless: false, args: ['--auto-accept-this-tab-capture', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--use-angle=d3d11'] });
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  await page.route('**/real-x.wav', (r) => r.fulfill({ body: fs.readFileSync(`${dir}/efd517ab.wav`), contentType: 'audio/wav' }));
  await page.goto('http://127.0.0.1:3000/');
  await page.getByRole('button', { name: 'Try the demo songs' }).click();
  await page.getByRole('region', { name: 'Player' }).getByText('Neon Static').waitFor();
  await page.waitForFunction(() => window.__lsIndex);
  await page.evaluate(() => window.__lsIndex.player.pause());
  await page.waitForTimeout(800);
  const b64 = await page.evaluate(async () => {
    const { AudioCapture } = window.__lsIndex;
    const ab = await (await fetch('/real-x.wav')).arrayBuffer();
    const pctx = new AudioContext();
    const buf = await pctx.decodeAudioData(ab);
    const src = pctx.createBufferSource(); src.buffer = buf; src.connect(pctx.destination);
    const cap = new AudioCapture(); const chunks = []; let on = false; let t0 = 0;
    cap.onBlock = (s) => { if (on) chunks.push(s.slice()); };
    await cap.start(); await pctx.resume(); on = true; t0 = performance.now(); src.start();
    await new Promise((r) => setTimeout(r, 12000));
    src.stop(); cap.stop();
    const n = chunks.reduce((a, c) => a + c.length, 0); const m = new Float32Array(n); let o = 0; for (const c of chunks) { m.set(c, o); o += c.length; }
    const u8 = new Uint8Array(m.buffer); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
    return { sr: cap.sampleRate, b64: btoa(s) };
  });
  fs.writeFileSync(dir + '/captured.f32', Buffer.from(b64.b64, 'base64'));
  fs.writeFileSync(dir + '/captured.sr', String(b64.sr));
  console.log('saved', b64.sr);
  await browser.close();
})();
