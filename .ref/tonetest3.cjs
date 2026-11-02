const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: false, ignoreDefaultArgs: ['--mute-audio'], args: ['--auto-accept-this-tab-capture', '--autoplay-policy=no-user-gesture-required', '--use-angle=d3d11'] });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await page.goto('http://127.0.0.1:3000/');
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const out = {};
    const ctx = new AudioContext();
    const osc = ctx.createOscillator(); osc.frequency.value = 440; const g = ctx.createGain(); g.gain.value = 0.5; osc.connect(g); g.connect(ctx.destination); await ctx.resume(); osc.start();
    for (const variant of ['plain-analyser', 'video-kept']) {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, preferCurrentTab: true, selfBrowserSurface: 'include', systemAudio: 'exclude' });
      const a = stream.getAudioTracks();
      out[variant + ':audioTracks'] = a.length;
      out[variant + ':settings'] = a[0] ? JSON.stringify(a[0].getSettings()) : null;
      if (variant === 'plain-analyser') stream.getVideoTracks().forEach((v) => (v.enabled = false));
      const c2 = new AudioContext();
      const src = c2.createMediaStreamSource(new MediaStream(a));
      const an = c2.createAnalyser(); an.fftSize = 2048; src.connect(an);
      const mute = c2.createGain(); mute.gain.value = 0; an.connect(mute); mute.connect(c2.destination);
      await new Promise((r) => setTimeout(r, 1500));
      let pk = 0; const td = new Float32Array(2048);
      for (let k = 0; k < 20; k++) { an.getFloatTimeDomainData(td); for (const v of td) pk = Math.max(pk, Math.abs(v)); await new Promise((r) => setTimeout(r, 50)); }
      out[variant + ':peak'] = +pk.toFixed(3);
      stream.getTracks().forEach((t) => t.stop()); await c2.close();
    }
    osc.stop();
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
})();
