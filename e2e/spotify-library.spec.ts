import { expect, test } from '@playwright/test';

test('Spotify library collections, pagination and app queue controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('lyricscape.spotify.tokens', JSON.stringify({ accessToken: 'library-test', expiresAt: Date.now() + 3600000, scope: 'playlist-read-private playlist-read-collaborative user-library-read' }));
    localStorage.setItem('lyricscape.spotify.clientId', 'library-test');
  });
  await page.route('https://sdk.scdn.co/**', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  const track = (id: string) => ({ id, name: `Library song ${id}`, type: 'track', duration_ms: 180000, artists: [{ name: `Artist ${id}` }], album: { name: 'Album', images: [] } });
  const paged = (items: unknown[], next: string | null = null, offset = 0) => ({ items, next, offset, limit: 50, total: next ? 51 : items.length });
  let started: string[] = [];
  await page.route('https://api.spotify.com/**', async route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname.replace('/v1', '');
    if (req.method() !== 'GET') {
      if (path === '/me/player/play') started = req.postDataJSON()?.uris ?? [];
      return route.fulfill({ status: 204 });
    }
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const body = path === '/me/playlists' ? paged([{ id: offset ? 'p2' : 'p1', name: offset ? 'More music' : 'My playlist', uri: 'spotify:playlist:p1' }], offset ? null : 'https://api.spotify.com/v1/me/playlists?offset=50', offset)
      : path === '/me/tracks' ? paged([{ track: track('liked') }])
      : path === '/me/albums' ? paged([{ album: { id: 'album', name: 'Saved album', images: [] } }])
      : path === '/albums/album/tracks' ? paged([track('album')])
      : path === '/playlists/p1/items' ? offset ? paged([{ item: track('3') }], null, offset) : paged([{ item: track('1') }, { item: track('2') }], 'https://api.spotify.com/v1/playlists/p1/items?offset=50')
      : path === '/me/player/devices' ? { devices: [{ id: 'device', is_active: true, name: 'Test device', type: 'Computer' }] }
      : path === '/me' ? { id: 'test', product: 'premium' }
      : null;
    return route.fulfill({ status: body ? 200 : 204, ...(body ? { json: body } : {}) });
  });
  await page.route('**/api/lyrics/lookup?**', route => route.fulfill({ json: { found: false } }));
  await page.goto('/listen');
  await page.getByRole('tab', { name: 'Spotify', exact: true }).click();
  const library = page.getByRole('region', { name: 'Spotify library' });
  await expect(library.getByRole('button', { name: 'My playlist', exact: true })).toBeVisible();
  await library.getByRole('button', { name: 'Load more' }).click();
  await expect(library.getByRole('button', { name: 'More music' })).toBeVisible();
  await library.getByRole('button', { name: 'My playlist', exact: true }).click();
  await expect(library.getByRole('button', { name: 'Play Library song 1', exact: true })).toBeVisible();
  await library.getByRole('checkbox').check();
  await library.getByRole('button', { name: 'Play collection' }).click();
  await expect.poll(() => started).toEqual(['spotify:track:1']);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect.poll(() => started).toEqual(['spotify:track:2']);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect.poll(() => started).toEqual(['spotify:track:3']);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect.poll(() => started).toEqual(['spotify:track:liked']);
  await library.getByRole('button', { name: 'Shuffle: off' }).click();
  await expect(library.getByRole('button', { name: 'Shuffle: on' })).toBeVisible();
  await library.getByRole('button', { name: 'Loop: off' }).click();
  await expect(library.getByRole('button', { name: 'Loop: all' })).toBeVisible();
  await library.getByRole('button', { name: 'Loop: all' }).click();
  await expect(library.getByRole('button', { name: 'Loop: one' })).toBeVisible();
  await page.screenshot({ path: '.ref/spotify-library-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(library.getByRole('button', { name: 'Smart library mix' })).toBeVisible();
  await page.screenshot({ path: '.ref/spotify-library-phone.png', fullPage: true });
  await library.getByRole('button', { name: 'Liked songs' }).click();
  await expect(library.getByRole('button', { name: 'Play Library song liked', exact: true })).toBeVisible();
  await library.getByRole('button', { name: 'Saved albums' }).click();
  await library.getByRole('button', { name: 'Saved album', exact: true }).click();
  await expect(library.getByRole('button', { name: 'Play Library song album', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
