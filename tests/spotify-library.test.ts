import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCollectionTracks, getPlaylists, getSavedTracks, libraryMix } from '@/lib/spotify/library';
import { spFetch } from '@/lib/spotify/api';
import type { Track } from '@/lib/types';
vi.mock('@/lib/spotify/api', async (original) => ({ ...await original<typeof import('@/lib/spotify/api')>(), spFetch: vi.fn() }));
const apiTrack = { id: 'one', name: 'One', duration_ms: 10000, artists: [{ name: 'Artist' }], type: 'track' };
const page = (items: unknown[], next: string | null = null) => ({ items, offset: 0, limit: 50, total: 100, next });
afterEach(() => vi.clearAllMocks());
describe('Spotify library', () => {
  it('paginates playlists without fetching a URL supplied by the upstream response', async () => {
    vi.mocked(spFetch).mockResolvedValue(page([{ id: 'p', name: 'My playlist', uri: 'spotify:playlist:p' }], 'https://untrusted.test'));
    const data = await getPlaylists();
    expect(data.nextOffset).toBe(50);
    expect(data.items[0]?.name).toBe('My playlist');
    expect(spFetch).toHaveBeenCalledWith('/me/playlists', { query: { limit: 50, offset: 0 } });
  });
  it('skips unavailable and local saved tracks', async () => {
    vi.mocked(spFetch).mockResolvedValue(page([{ track: null }, { track: apiTrack }, { track: { ...apiTrack, is_local: true } }]));
    expect((await getSavedTracks()).items.map(t => t.id)).toEqual(['spotify:one']);
  });
  it('reads the current items endpoint and skips podcast episodes', async () => {
    vi.mocked(spFetch).mockResolvedValue(page([{ item: apiTrack }, { item: { id: 'episode', name: 'Episode', type: 'episode' } }, null]));
    const data = await getCollectionTracks({ id: 'p', name: 'Playlist', uri: 'spotify:playlist:p', kind: 'playlist' });
    expect(data.items).toHaveLength(1);
    expect(spFetch).toHaveBeenCalledWith('/playlists/p/items', { query: { limit: 50, offset: 0 } });
  });
  it('preserves access failures instead of showing an empty library', async () => {
    vi.mocked(spFetch).mockRejectedValue(new Error('Spotify refused this request (403)'));
    await expect(getPlaylists()).rejects.toThrow('403');
  });
  it('makes a unique mix and separates artists when alternatives exist', () => {
    const track = (id: string, artist: string) => ({ id, artists: [artist] } as Track);
    const mix = libraryMix([track('1', 'A'), track('2', 'A'), track('3', 'B'), track('4', 'B'), track('1', 'A')], () => .5);
    expect(new Set(mix.map(t => t.id)).size).toBe(4);
    expect(mix.every((t, i) => i === 0 || t.artists[0] !== mix[i - 1]?.artists[0])).toBe(true);
  });
});
