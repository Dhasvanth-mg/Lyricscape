import { afterEach, describe, expect, it, vi } from 'vitest';
import { lookupMusixmatch, parseMusixmatch, richsyncLrc } from '@/lib/server/musixmatch';
import { parseLyrics } from '@/lib/lyrics/parse';

const call = (body: unknown, status_code = 200) => ({ message: { header: { status_code }, body } });
const q = { title: 'Test Song', artist: 'Test Artist', duration: 120 };
const rich = JSON.stringify([{ ts: 1, te: 3, l: [{ c: 'Hello ', o: 0 }, { c: 'world', o: 0.75 }] }]);
const body = { macro_calls: {
  'matcher.track.get': call({ track: { track_name: q.title, artist_name: q.artist, track_length: 120 } }),
  'track.richsync.get': call({ richsync: { richsync_body: rich } }),
  'track.subtitles.get': call({ subtitle_list: [{ subtitle: { subtitle_body: '[00:01.00]Hello world' } }] }),
} };
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('development Musixmatch provider', () => {
  it('preserves authored word offsets and the explicit line end', () => {
    const lrc = richsyncLrc(rich)!;
    const line = parseLyrics(lrc).lines[0]!;
    expect(line.wordTiming).toBe('authored');
    expect(line.words.map(w => w.startMs)).toEqual([1000, 1750]);
    expect(line.endMs).toBe(3000);
    expect(parseMusixmatch(body, q)?.hasWordSync).toBe(true);
  });
  it('rejects malformed and backwards word times', () => {
    expect(richsyncLrc('invalid')).toBeNull();
    expect(richsyncLrc(JSON.stringify([{ ts: 1, te: 2, l: [{ c: 'x', o: 2 }] }]))).toBeNull();
  });
  it('rejects other artists and mismatched recording lengths', () => {
    expect(parseMusixmatch(body, { ...q, artist: 'Someone else' })).toBeNull();
    expect(parseMusixmatch(body, { ...q, duration: 150 })).toBeNull();
    expect(parseMusixmatch({}, q)).toBeNull();
  });
  it('falls back to line timing without inventing word sync', () => {
    const result = parseMusixmatch({ macro_calls: { ...body.macro_calls, 'track.richsync.get': call({}, 404) } }, q);
    expect(result?.hasWordSync).toBe(false);
    expect(result?.synced).toBe('[00:01.00]Hello world');
  });
  it('does not call the unofficial provider in production by default', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('LYRICSCAPE_UNOFFICIAL_MUSIXMATCH', '');
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect(await lookupMusixmatch(q)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('backs off after rejection without throwing or leaking upstream data', async () => {
    vi.stubEnv('LYRICSCAPE_UNOFFICIAL_MUSIXMATCH', 'true');
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(call({}, 401))));
    vi.stubGlobal('fetch', fetcher);
    expect(await lookupMusixmatch(q)).toBeNull();
    expect(await lookupMusixmatch(q)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
