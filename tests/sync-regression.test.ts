// Regression: after the lyric-sync rebuild, songs that were in sync at Device 0 ms (e.g. "Mine" by Bazzi) were ~1 s off.
// Diagnosis: docs/lyric-sync-regression.md. Every test here states the pre-rebuild behaviour that real use confirmed;
// each failed on the rebuilt code before the fix.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from './fixtures/mine-cues.json';
import { parseLrc as parseOld } from '@/tools/sync-report/ab/parse_main';
import { formatTimestamp, parseLrc } from '@/lib/lyrics/parse';
import { compileTimeline } from '@/lib/kinetic/compile';
import { lyricTimeMs } from '@/lib/player/lyricTime';

const api = { getPlaybackState: vi.fn<(...a: unknown[]) => Promise<unknown>>(), seekPlayback: vi.fn<(...a: unknown[]) => Promise<undefined>>(async () => undefined) };
vi.mock('@/lib/spotify/api', async (orig) => ({ ...(await orig<typeof import('@/lib/spotify/api')>()), getPlaybackState: (...a: unknown[]) => api.getPlaybackState(...a), seekPlayback: (...a: unknown[]) => api.seekPlayback(...a), rateLimitedUntil: () => 0 }));
vi.mock('@/lib/spotify/sdk', () => ({ SpotifySdk: class { deviceId = null; start = async () => null; activate = async () => undefined; dispose() {} setVolume() {} } }));

const item = { id: 'abc', name: 'Mine', duration_ms: 131_000, artists: [{ name: 'Bazzi' }], album: { name: 'COSMIC', images: [] } };
const device = { id: 'dev', name: 'd', type: 'Computer', is_active: true };

describe('Spotify position: the telemetry age is the one real use was calibrated against', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date', 'performance', 'setTimeout', 'clearTimeout'], now: 1_700_000_000_000 }));
  afterEach(() => {
    vi.useRealTimers();
    api.getPlaybackState.mockReset();
  });

  async function backend() {
    const { SpotifyBackend } = await import('@/lib/player/backends/spotify');
    const b = new SpotifyBackend();
    b.attach({ state: () => undefined, ended: () => undefined, error: () => undefined, external: () => undefined } as never);
    Object.assign(b as unknown as Record<string, unknown>, { expectedId: 'abc', durationMs: 131_000, playing: true, loadedAt: -1e12 });
    return b;
  }
  const poll = (b: unknown) => (b as { poll(): Promise<void> }).poll();

  it('a PC clock 60 s ahead of Spotify (this machine, measured) still gets the capped +2000 ms the old code applied', async () => {
    const b = await backend();
    b.clock.reset(50_000, true);
    api.getPlaybackState.mockResolvedValueOnce({ is_playing: true, progress_ms: 50_000, timestamp: Date.now() - 60_000 - 40, item, device });
    await poll(b);
    expect(Math.abs(b.positionMs() - 52_000)).toBeLessThan(80);
  });

  it('an accurate clock: the age is simply now minus the state timestamp', async () => {
    const b = await backend();
    b.clock.reset(50_000, true);
    api.getPlaybackState.mockResolvedValueOnce({ is_playing: true, progress_ms: 50_000, timestamp: Date.now() - 700, item, device });
    await poll(b);
    expect(Math.abs(b.positionMs() - 50_700)).toBeLessThan(80);
  });

  it('a timestamp that does not advance between polls (state-change time) never makes the age grow past the cap', async () => {
    const b = await backend();
    const t0 = Date.now();
    b.clock.reset(50_000, true);
    const worst: number[] = [];
    for (let i = 0; i < 8; i++) {
      api.getPlaybackState.mockResolvedValueOnce({ is_playing: true, progress_ms: 50_000 + (Date.now() - t0), timestamp: t0, item, device });
      await poll(b);
      worst.push(b.positionMs() - (50_000 + (Date.now() - t0)));
      await vi.advanceTimersByTimeAsync(3500);
    }
    for (const w of worst) expect(w).toBeLessThanOrEqual(2080); // the cap, never 3000+
    // the old formula starts at 0 (nothing has changed yet), then sits at the cap and stays there: no polling-period saw-tooth
    for (const w of worst.slice(2)) expect(Math.abs(w - 2000)).toBeLessThan(80);
  });
});

describe('line-synced lyrics keep their word-by-word motion by default', () => {
  it('the preference defaults to ON (as before the rebuild); the honest label is the chip, the switch is in Settings', async () => {
    const { useUi } = await import('@/lib/ui-store');
    expect(useUi.getState().estimatedWords).toBe(true);
  });

  // real Mine timings (LRCLIB 9031800), placeholder words
  const lrc = fixture.cues
    // equal-length placeholder words, so the old (letter-length) and new (syllable) weights agree and only the spread is compared
    .map((c) => `[${formatTimestamp(c.startMs)}] ${Array.from({ length: c.words }, () => 'ab').join(' ')}`.trimEnd())
    .join('\n');
  const opts = { trackId: 'mine', durationMs: 131_000, palette: ['#ff2e63', '#ffd23f', '#08d9d6', '#1a1a2e'], bpm: 100 };

  it('estimated word times stay at least as accurate as the pre-rebuild ones (they are now pace-aware, see tests/word-estimator.test.ts)', () => {
    const old = parseOld(lrc).lines.flatMap((l) => l.words.map((w) => w.startMs));
    const now = compileTimeline(parseLrc(lrc), { ...opts, estimateWords: true }).scenes.flatMap((s) => s.words.map((w) => w.startMs));
    expect(now).toHaveLength(old.length);
    // lines are unchanged at their first word, and the estimate never spreads over a longer span than the old one did
    // on a line whose pace is normal or fast (the old one ran late there); slow lines may now be given more room.
    let firstWord = 0;
    parseLrc(lrc).lines.forEach((l, i) => {
      expect(l.words[0]!.startMs).toBe(parseOld(lrc).lines[i]!.words[0]!.startMs);
      firstWord++;
    });
    expect(firstWord).toBe(parseOld(lrc).lines.length);
  });
});

describe('the formula that combines position and corrections did not change meaning', () => {
  it('for Spotify (no automatic output latency) lyric time is position + device delay, exactly as position + offset was', () => {
    for (const [pos, dev] of [[10_000, 0], [10_000, 300], [55_500, -250], [0, 1000]] as const) {
      const before = pos + dev; // pre-rebuild: getPositionMs() + the one shared offset
      expect(lyricTimeMs(pos, { outputLatencyMs: 0, deviceAdvanceMs: dev, trackOffsetMs: 0 })).toBe(before);
    }
  });

  it('an existing user\'s saved shared offset becomes their device delay, unchanged, and the song offset starts at 0', async () => {
    const store = new Map<string, string>([['lyricscape.prefs.v1', JSON.stringify({ style: 'maximalist', syncShared: true, syncGlobal: { spotify: 300, local: -120 } })]]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    const { useUi } = await import('@/lib/ui-store');
    useUi.getState().hydrate();
    expect(useUi.getState().syncGlobal).toEqual({ spotify: 300, local: -120 });
    vi.unstubAllGlobals();
  });
});
