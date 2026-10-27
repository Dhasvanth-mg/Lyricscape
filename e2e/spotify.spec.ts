import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __spotifyPlaybackTest: { volume: number; position: number; playing: boolean; browser: boolean; at: number };
  }
}

test('Spotify browser selection, volume, mute and transport at desktop and phone widths', async ({ page }) => {
  const errors: string[] = [];
  const seekTargets: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('lyricscape.spotify.tokens', JSON.stringify({ accessToken: 'mock-playback-test', expiresAt: Date.now() + 3600_000 }));
    localStorage.setItem('lyricscape.spotify.clientId', 'mock-playback-test');
  });
  await page.route('https://sdk.scdn.co/spotify-player.js', (route) => route.fulfill({ contentType: 'application/javascript', body: `
    window.__spotifyPlaybackTest = { volume: .85, position: 10000, playing: true, browser: false, at: performance.now() };
    window.Spotify = { Player: class {
      constructor() { this.listeners = {}; }
      addListener(name, fn) { this.listeners[name] = fn; return true; }
      async connect() { setTimeout(() => this.listeners.ready({ device_id: 'browser-test' }), 10); return true; }
      disconnect() {}
      async activateElement() {}
      async setVolume(v) { window.__spotifyPlaybackTest.volume = v; }
      async getCurrentState() {
        const s = window.__spotifyPlaybackTest;
        if (!s.browser) return null;
        return { paused: !s.playing, loading: false, position: s.position + (s.playing ? performance.now() - s.at : 0), duration: 180000,
          track_window: { current_track: { id: 'test-song', uri: 'spotify:track:test-song', name: 'Browser Test Song', duration_ms: 180000, artists: [{ name: 'Test Artist' }], album: { name: 'Test Album', images: [] } }, previous_tracks: [], next_tracks: [] } };
      }
    }};
    window.onSpotifyWebPlaybackSDKReady();
  ` }));
  await page.route('https://api.spotify.com/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const suffix = url.pathname.replace('/v1', '');
    const state = await page.evaluate(() => window.__spotifyPlaybackTest);
    const item = { id: 'test-song', name: 'Browser Test Song', type: 'track', duration_ms: 180_000, artists: [{ id: 'test-artist', name: 'Test Artist' }], album: { name: 'Test Album', images: [] } };
    if (req.method() === 'PUT') {
      if (suffix !== '/me/player/volume') {
        const body = req.postDataJSON() as { play?: boolean; uris?: string[]; position_ms?: number } | null;
        if (suffix !== '/me/player') expect(url.searchParams.get('device_id')).toBe('browser-test');
        else expect(req.postDataJSON()).toMatchObject({ device_ids: ['browser-test'] });
        if (suffix.endsWith('/seek')) seekTargets.push(url.searchParams.get('position_ms')!);
        await page.evaluate(({ suffix, body, position }) => {
          const s = window.__spotifyPlaybackTest;
          s.position += s.playing ? performance.now() - s.at : 0;
          s.at = performance.now();
          if (suffix === '/me/player') { s.browser = true; s.playing = body?.play ?? false; }
          if (suffix.endsWith('/pause')) s.playing = false;
          if (suffix.endsWith('/play')) { s.playing = true; if (body?.uris) s.position = body.position_ms ?? 0; }
          if (suffix.endsWith('/seek')) s.position = Number(position);
        }, { suffix, body, position: url.searchParams.get('position_ms') });
      }
      return route.fulfill({ status: 204 });
    }
    let json: unknown = {};
    if (suffix === '/me') json = { id: 'test', display_name: 'Playback test', product: 'premium' };
    else if (suffix === '/me/player/devices') json = { devices: [{ id: 'browser-test', name: 'Lyricscape', type: 'Computer', is_active: state?.browser ?? false }, { id: 'phone-test', name: 'Phone', type: 'Smartphone', is_active: !state?.browser }] };
    else if (suffix === '/me/player') json = { device: { id: state?.browser ? 'browser-test' : 'phone-test', name: state?.browser ? 'Lyricscape' : 'Phone', type: 'Computer', is_active: true }, is_playing: state?.playing ?? true, progress_ms: state?.position ?? 10_000, timestamp: Date.now(), item };
    else if (suffix === '/search') json = { tracks: { items: [item] } };
    await route.fulfill({ json });
  });
  await page.route('**/api/lyrics/lookup?**', (route) => route.fulfill({ json: { found: true, id: 1, synced: '[00:00.00]A browser plays a song\n[00:10.00]We hear the words in time\n[00:20.00]The music keeps on moving', source: 'Original test fixture' } }));
  await page.route('**/api/meta/genres?**', (route) => route.fulfill({ json: { tags: [] } }));

  await page.goto('/settings');
  const select = page.getByRole('button', { name: 'Play on this browser', exact: true });
  await expect(select).toBeEnabled();
  await select.click();
  await expect(page.getByText('Output: this browser (Lyricscape)', { exact: true })).toBeVisible();
  await page.getByRole('slider', { name: 'Spotify volume', exact: true }).fill('0.33');
  await expect.poll(() => page.evaluate(() => window.__spotifyPlaybackTest.volume)).toBe(.33);
  await page.getByRole('button', { name: 'Mute', exact: true }).first().click();
  await expect.poll(() => page.evaluate(() => window.__spotifyPlaybackTest.volume)).toBe(0);
  await page.getByRole('button', { name: 'Unmute', exact: true }).first().click();
  await expect.poll(() => page.evaluate(() => window.__spotifyPlaybackTest.volume)).toBe(.33);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(select).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Spotify volume', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.getByRole('link', { name: 'Open now playing', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Browser Test Song', exact: true })).toBeVisible();
  const player = page.getByRole('region', { name: 'Player', exact: true });
  await player.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__spotifyPlaybackTest.playing)).toBe(false);
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/me/player/play') && r.request().method() === 'PUT'),
    player.getByRole('button', { name: 'Play', exact: true }).click(),
  ]);
  await expect.poll(() => page.evaluate(() => window.__spotifyPlaybackTest.playing)).toBe(true);
  await page.getByRole('slider', { name: 'Seek', exact: true }).fill('20000');
  await expect.poll(() => page.evaluate(() => window.__spotifyPlaybackTest.position)).toBe(20_000);
  expect(seekTargets).toEqual(['20000']);
  expect(errors).toEqual([]);
});
