// Reproductions for the lyric-sync audit (docs/lyric-sync-audit.md). Each test states the CORRECT behaviour;
// before the rebuild they failed, and they stay as regression tests.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseLrc, parseLyrics, toEnhancedLrc } from '@/lib/lyrics/parse';

const state = { is_playing: true, progress_ms: 60_000, timestamp: 0, item: { id: 'abc', name: 't', duration_ms: 240_000, artists: [{ name: 'a' }], album: { name: 'x', images: [] } }, device: { id: 'dev', name: 'd', type: 'Computer', is_active: true } };
const api = { getPlaybackState: vi.fn<(...a: unknown[]) => Promise<unknown>>(), seekPlayback: vi.fn<(...a: unknown[]) => Promise<undefined>>(async () => undefined) };

vi.mock('@/lib/spotify/api', async (orig) => ({ ...(await orig<typeof import('@/lib/spotify/api')>()), getPlaybackState: (...a: unknown[]) => api.getPlaybackState(...a), seekPlayback: (...a: unknown[]) => api.seekPlayback(...a), rateLimitedUntil: () => 0 }));
vi.mock('@/lib/spotify/sdk', () => ({ SpotifySdk: class { deviceId = null; start = async () => null; dispose() {} setVolume() {} } }));

describe('Spotify position estimate (audit B1, B4)', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date', 'performance', 'setTimeout', 'clearTimeout'], now: 1_700_000_000_000 }));
  afterEach(() => vi.useRealTimers());

  async function backend() {
    const { SpotifyBackend } = await import('@/lib/player/backends/spotify');
    const b = new SpotifyBackend();
    b.attach({ state: () => undefined, ended: () => undefined, error: () => undefined, external: () => undefined } as never);
    Object.assign(b as unknown as Record<string, unknown>, { expectedId: 'abc', durationMs: 240_000, playing: true });
    return b;
  }

  it('B4: a poll that was already in flight when the user seeked must not drag the clock back', async () => {
    const b = await backend();
    let resolveStale!: (v: unknown) => void;
    api.getPlaybackState.mockImplementationOnce(() => new Promise((r) => (resolveStale = r)));
    const polling = (b as unknown as { poll(): Promise<void> }).poll();
    await vi.advanceTimersByTimeAsync(100);
    await b.seek(120_000); // user jumps ahead
    await vi.advanceTimersByTimeAsync(700);
    resolveStale({ ...state, progress_ms: 60_800, timestamp: Date.now() }); // response describes the PRE-seek moment
    await polling;
    expect(Math.abs(b.positionMs() - 120_700)).toBeLessThan(400);
  });

  it('B1: a wrong local clock must not be mistaken for telemetry age', async () => {
    const b = await backend();
    // the user's clock runs 3 s ahead of Spotify's; the data itself is fresh (+~30 ms of network)
    api.getPlaybackState.mockResolvedValueOnce({ ...state, progress_ms: 50_000, timestamp: Date.now() - 3000 - 30 });
    await (b as unknown as { poll(): Promise<void> }).poll();
    expect(Math.abs(b.positionMs() - 50_030)).toBeLessThan(400);
  });
});

describe('LRC parsing (audit A1, A2, A8)', () => {
  it('A1: honours the [offset:] tag (positive = lyrics sooner)', () => {
    const doc = parseLrc('[offset:500]\n[00:10.00] hello there\n');
    expect(doc.lines[0]!.startMs).toBe(9500);
  });

  it('A2: a blank cue is the explicit end of the previous line, not a cue to guess about', () => {
    const doc = parseLrc('[00:10.00] hello there\n[00:18.00]\n[00:30.00] next one\n');
    expect(doc.lines[0]!.endMs).toBe(18000);
  });

  it('A8: saving a line-synced document must not invent word timestamps', () => {
    const doc = parseLyrics('[00:10.00] hello big world\n[00:14.00] second line\n');
    expect(toEnhancedLrc(doc)).not.toMatch(/<\d{2}:\d{2}\.\d{2}>/);
  });
});
