import { afterEach, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/lyrics/lookup/route';
import { lookupMusixmatch } from '@/lib/server/musixmatch';
vi.mock('@/lib/server/musixmatch', () => ({ lookupMusixmatch: vi.fn() }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
it('validates lookup input before calling a provider', async () => {
  const res = await GET(new Request('http://127.0.0.1/api/lyrics/lookup?title='));
  expect(res.status).toBe(400);
  expect(lookupMusixmatch).not.toHaveBeenCalled();
});
it('tries Musixmatch even when cycling past a previous LRCLIB record', async () => {
  vi.mocked(lookupMusixmatch).mockResolvedValue({ found: true, provider: 'musixmatch', source: 'Musixmatch (unofficial, development)', synced: '[00:01.000]test', plain: null, hasWordSync: false });
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const res = await GET(new Request('http://127.0.0.1/api/lyrics/lookup?title=Example&artist=Artist&exclude=123'));
  expect((await res.json()).provider).toBe('musixmatch');
  expect(fetcher).not.toHaveBeenCalled();
});
it('bypasses Musixmatch after that provider and returns a ranked LRCLIB fallback', async () => {
  const record = { id: 123, trackName: 'Fallback', artistName: 'Artist', duration: 120, syncedLyrics: '[00:01.000]test' };
  vi.stubGlobal('fetch', vi.fn(async (url: URL) => new Response(JSON.stringify(url.pathname.endsWith('/get') ? record : [record]))));
  const res = await GET(new Request('http://127.0.0.1/api/lyrics/lookup?title=Fallback&artist=Artist&duration=120&exclude=0'));
  expect((await res.json()).source).toBe('LRCLIB (community)');
  expect(lookupMusixmatch).not.toHaveBeenCalled();
});
