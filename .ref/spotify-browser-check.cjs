const { chromium } = require('@playwright/test');
const fs = require('node:fs');

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(() => {
      localStorage.setItem('lyricscape.spotify.tokens', JSON.stringify({ accessToken: 'mock-browser-check', expiresAt: Date.now() + 3600000 }));
      localStorage.setItem('lyricscape.spotify.clientId', 'mock-browser-check');
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://sdk.scdn.co/spotify-player.js', route => route.fulfill({ contentType: 'application/javascript', body: `
      window.__spotifyTest = { volume: .85, position: 10000, playing: true, browser: false, at: performance.now() };
      window.Spotify = { Player: class {
        constructor(opts) { this.listeners = {}; window.__spotifyPlayer = this; }
        addListener(name, fn) { this.listeners[name] = fn; return true; }
        async connect() { setTimeout(() => this.listeners.ready({ device_id: 'browser-test' }), 10); return true; }
        disconnect() {}
        async activateElement() {}
        async setVolume(v) { window.__spotifyTest.volume = v; }
        async getCurrentState() {
          const t = window.__spotifyTest;
          if (!t.browser) return null;
          return { paused: !t.playing, loading: false, position: t.position + (t.playing ? performance.now() - t.at : 0), duration: 180000,
            track_window: { current_track: { id: 'test-song', uri: 'spotify:track:test-song', name: 'Browser Test Song', duration_ms: 180000, artists: [{ name: 'Test Artist' }], album: { name: 'Test Album', images: [] } }, previous_tracks: [], next_tracks: [] } };
        }
      }};
      window.onSpotifyWebPlaybackSDKReady();
    ` }));
    await page.route('https://api.spotify.com/**', async route => {
      const req = route.request();
      const url = new URL(req.url());
      const suffix = url.pathname.replace('/v1', '');
      const test = await page.evaluate(() => window.__spotifyTest);
      const item = { id: 'test-song', name: 'Browser Test Song', type: 'track', duration_ms: 180000, artists: [{ id: 'test-artist', name: 'Test Artist' }], album: { name: 'Test Album', images: [] } };
      if (req.method() === 'PUT') {
        console.log('Spotify command:', suffix, url.search);
        const body = req.postDataJSON();
        await page.evaluate(({ suffix, body, position }) => {
          const s = window.__spotifyTest;
          s.position += s.playing ? performance.now() - s.at : 0;
          s.at = performance.now();
          if (suffix === '/me/player') { s.browser = true; s.playing = body.play; }
          if (suffix.endsWith('/pause')) s.playing = false;
          if (suffix.endsWith('/play')) { s.playing = true; if (body?.uris) s.position = body.position_ms || 0; }
          if (suffix.endsWith('/seek')) s.position = Number(position);
        }, { suffix, body, position: url.searchParams.get('position_ms') });
        return route.fulfill({ status: 204 });
      }
      let json = {};
      if (suffix === '/me') json = { id: 'test', display_name: 'Browser check', product: 'premium' };
      else if (suffix === '/me/player/devices') json = { devices: [{ id: 'browser-test', name: 'Lyricscape', type: 'Computer', is_active: test?.browser || false }, { id: 'phone-test', name: 'Phone', type: 'Smartphone', is_active: !test?.browser }] };
      else if (suffix === '/me/player') json = { device: { id: test?.browser ? 'browser-test' : 'phone-test', name: test?.browser ? 'Lyricscape' : 'Phone', type: 'Computer', is_active: true }, is_playing: test?.playing ?? true, progress_ms: test?.position || 10000, timestamp: Date.now(), item };
      else if (suffix === '/search') json = { tracks: { items: [item] } };
      else if (suffix.startsWith('/artists')) json = { genres: [] };
      await route.fulfill({ json });
    });
    await page.route('**/api/lyrics/lookup?**', route => route.fulfill({ json: { found: true, id: 1, synced: '[00:00.00]A browser plays a song\n[00:10.00]We hear the words in time\n[00:20.00]The music keeps on moving', source: 'Browser check fixture' } }));
    await page.route('**/api/meta/genres?**', route => route.fulfill({ json: { tags: [] } }));
    await page.goto('http://127.0.0.1:3000/settings');
    const select = page.getByRole('button', { name: 'Play on this browser', exact: true });
    await select.waitFor();
    await page.waitForFunction(() => document.querySelector('button') && [...document.querySelectorAll('button')].some(b => b.textContent === 'Play on this browser' && !b.disabled));
    await select.click();
    await page.getByText('Output: this browser (Lyricscape)', { exact: true }).waitFor();
    await page.getByRole('slider', { name: 'Spotify volume', exact: true }).fill('0.33');
    await page.waitForFunction(() => window.__spotifyTest.volume === .33);
    await page.getByRole('button', { name: 'Mute', exact: true }).first().click();
    await page.waitForFunction(() => window.__spotifyTest.volume === 0);
    await page.getByRole('button', { name: 'Unmute', exact: true }).first().click();
    await page.waitForFunction(() => window.__spotifyTest.volume === .33);
    await page.screenshot({ path: '.ref/spotify-settings-desktop.png', fullPage: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '.ref/spotify-settings-phone.png', fullPage: false });
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Phone layout overflows');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('http://127.0.0.1:3000/listen/now-playing');
    await page.getByRole('heading', { name: 'Browser Test Song' }).waitFor();
    await page.getByRole('button', { name: 'Play on this browser', exact: true }).click();
    await page.getByText('Output: this browser (Lyricscape)', { exact: true }).waitFor();
    await page.getByRole('region', { name: 'Player', exact: true }).getByRole('button', { name: 'Pause', exact: true }).click();
    await page.waitForFunction(() => !window.__spotifyTest.playing);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/me/player/play') && r.request().method() === 'PUT'),
      page.getByRole('region', { name: 'Player', exact: true }).getByRole('button', { name: 'Play', exact: true }).click()
    ]);
    await page.waitForTimeout(100);
    await page.waitForFunction(() => window.__spotifyTest.playing);
    await page.getByRole('slider', { name: 'Seek', exact: true }).fill('20000');
    console.log('After seek:', await page.evaluate(() => window.__spotifyTest), await page.getByRole('slider', { name: 'Seek', exact: true }).inputValue());
    await page.waitForFunction(() => window.__spotifyTest.position === 20000);
    await page.screenshot({ path: '.ref/spotify-now-playing.png', fullPage: false });
    console.log(JSON.stringify({ volumeAndMute: 'pass', browserTransfer: 'pass', pauseResumeSeek: 'pass', phoneOverflow: false, pageErrors: errors }));
    if (errors.length) throw new Error(errors.join('\n'));
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
