// Playback position: PlaybackClock, TelemetryAgeEstimator, SpotifyBackend polling and LocalBackend.
// Time is virtual (fake timers), so every run of a scripted telemetry sequence is identical.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlaybackClock } from '@/lib/player/clock';
import { MAX_TELEMETRY_AGE_MS, SKEW_TRUST_MS, TelemetryAgeEstimator } from '@/lib/player/telemetry';
import { lyricTimeMs } from '@/lib/player/lyricTime';

/** tiny seeded PRNG so "noise" is reproducible */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('PlaybackClock', () => {
  it('never jumps for small disagreements, in either direction', () => {
    let t = 0;
    const c = new PlaybackClock(() => t);
    c.reset(0, true);
    let last = 0;
    const rnd = rng(1);
    for (let i = 1; i <= 200; i++) {
      t += 100;
      if (i % 35 === 0) c.observe({ positionMs: t + (rnd() - 0.5) * 300, playing: true }); // +-150 ms: under the snap threshold
      const p = c.position();
      expect(p - last).toBeGreaterThanOrEqual(0); // never backwards
      expect(p - last).toBeLessThanOrEqual(100 * 1.041 + 0.001); // never faster than the 4% trim
      last = p;
    }
  });

  it('snaps only for a real jump or when paused', () => {
    let t = 0;
    const c = new PlaybackClock(() => t);
    c.reset(0, true);
    t += 1000;
    expect(c.observe({ positionMs: 1000 + 600, playing: true })).toBe('snapped');
    expect(c.position()).toBe(1600);
    c.setPlaying(false);
    expect(c.observe({ positionMs: 4000, playing: false })).toBe('snapped');
    t += 10_000;
    expect(c.position()).toBe(4000); // paused: holds
  });

  it('moves a report forward by its age', () => {
    let t = 5000;
    const c = new PlaybackClock(() => t);
    c.reset(0, true);
    // "position 20 000 was true 400 ms ago" -> 20 400 now
    c.observe({ positionMs: 20_000, playing: true, validAt: t - 400 });
    expect(c.position()).toBe(20_400);
  });

  it('drops reports requested before a seek, pause or load (stale epoch)', () => {
    let t = 0;
    const c = new PlaybackClock(() => t);
    c.reset(10_000, true);
    const epochAtRequest = c.epoch;
    t += 300;
    c.reset(90_000, true); // user seeks while the request is in flight
    expect(c.observe({ positionMs: 10_300, playing: true, epoch: epochAtRequest })).toBe('stale');
    expect(c.position()).toBe(90_000);

    const e2 = c.epoch;
    c.setPlaying(false); // pause
    expect(c.observe({ positionMs: 90_100, playing: true, epoch: e2 })).toBe('stale'); // would flip back to playing
    expect(c.isPlaying()).toBe(false);
  });

  it('ignores a pushed report that is the pre-seek position arriving late, but accepts the new one', () => {
    let t = 0;
    const c = new PlaybackClock(() => t);
    c.reset(10_000, true);
    t += 500;
    c.reset(120_000, true); // seek
    t += 200;
    expect(c.observe({ positionMs: 10_700, playing: true, pushed: true })).toBe('stale');
    expect(c.observe({ positionMs: 120_150, playing: true, pushed: true })).not.toBe('stale');
    // a push far from the clock long after the command is a genuine change from elsewhere
    t += 5000;
    expect(c.observe({ positionMs: 30_000, playing: true, pushed: true })).toBe('snapped');
  });

  it('is deterministic: the same telemetry script gives the same positions', () => {
    const run = () => {
      let t = 0;
      const c = new PlaybackClock(() => t);
      c.reset(0, true);
      const rnd = rng(9);
      const out: number[] = [];
      for (let i = 1; i <= 300; i++) {
        t += 50;
        if (i % 70 === 0) c.observe({ positionMs: t * 1.001 + (rnd() - 0.5) * 80, playing: true, validAt: t - 120 });
        out.push(Math.round(c.position() * 1000) / 1000);
      }
      return out;
    };
    expect(run()).toEqual(run());
  });
});

describe('TelemetryAgeEstimator: independent of the local clock', () => {
  // Reality: Spotify's server wrote `timestamp` = serverNow when progress_ms was true. We receive it `age` ms later.
  // Local wall clock = server clock + skew. Sample = what Date.now() minus timestamp shows.
  function errors(skew: number, seed: number) {
    const est = new TelemetryAgeEstimator();
    const rnd = rng(seed);
    const errs: number[] = [];
    for (let i = 0; i < 80; i++) {
      const rtt = 30 + rnd() * 120; // 30-150 ms round trips
      const staleness = rnd() < 0.7 ? rnd() * 80 : 200 + rnd() * 600; // usually fresh, sometimes a cached 0.2-0.8 s old answer
      const trueAge = staleness + rtt / 2;
      const serverTs = 1_000_000_000_000 + i * 3500;
      const receivedWall = serverTs + skew + trueAge;
      const age = est.ageAtReceipt(serverTs, receivedWall, rtt);
      if (i >= 10) errs.push(age - trueAge);
    }
    return errs;
  }
  const abs = (a: number[]) => a.map(Math.abs).sort((x, y) => x - y);

  for (const skew of [-20_000, -4_000, 0, 2_500, 3_000, 45_000]) {
    it(`age error is small with the local clock ${skew} ms off`, () => {
      const e = abs(errors(skew, 7));
      const p50 = e[Math.floor(e.length * 0.5)]!;
      const p95 = e[Math.floor(e.length * 0.95)]!;
      expect(p50).toBeLessThan(60);
      expect(p95).toBeLessThan(260);
    });
  }

  it('a large skew is removed exactly as well as no skew would be (up to the freshest staleness ever seen)', () => {
    const a = errors(0, 3); // synced clock: the formula is exact
    const b = errors(31_337, 3); // skew removed by the min-filter: off by at most the smallest staleness in the window
    expect(Math.max(...a.map(Math.abs))).toBeLessThan(1e-3); // floating-point noise on 1e12-sized timestamps only
    b.forEach((x) => expect(Math.abs(x)).toBeLessThan(100));
  });

  it('a small apparent skew is staleness, never subtracted: the error is bounded by SKEW_TRUST_MS', () => {
    for (const skew of [-200, -60, 120, 240]) {
      const e = abs(errors(skew, 5));
      expect(e[e.length - 1]!).toBeLessThanOrEqual(SKEW_TRUST_MS + 1);
    }
  });

  it('never claims more than the cap, and survives garbage', () => {
    const est = new TelemetryAgeEstimator();
    expect(est.ageAtReceipt(NaN, 5, 40)).toBe(20);
    for (let i = 0; i < 30; i++) est.ageAtReceipt(i * 1000, i * 1000 + 100, 20);
    expect(est.ageAtReceipt(1000, 1000 + 60_000, 20)).toBeLessThanOrEqual(MAX_TELEMETRY_AGE_MS);
  });
});

describe('lyricTimeMs', () => {
  it('composes the three corrections without touching the position', () => {
    expect(lyricTimeMs(10_000)).toBe(10_000);
    expect(lyricTimeMs(10_000, { outputLatencyMs: 120, deviceAdvanceMs: 0, trackOffsetMs: 0 })).toBe(9_880);
    expect(lyricTimeMs(10_000, { outputLatencyMs: 0, deviceAdvanceMs: -250, trackOffsetMs: 400 })).toBe(10_150);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// SpotifyBackend with scripted telemetry
// ---------------------------------------------------------------------------------------------------------------
type Sp = { is_playing: boolean; progress_ms: number; timestamp: number; item: unknown; device: unknown };
const apiMock = { getPlaybackState: vi.fn<(...a: unknown[]) => Promise<unknown>>(), seekPlayback: vi.fn<(...a: unknown[]) => Promise<undefined>>(async () => undefined), pausePlayback: vi.fn<(...a: unknown[]) => Promise<undefined>>(async () => undefined), resumePlayback: vi.fn<(...a: unknown[]) => Promise<undefined>>(async () => undefined) };
vi.mock('@/lib/spotify/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/spotify/api')>()),
  getPlaybackState: (...a: unknown[]) => apiMock.getPlaybackState(...a),
  seekPlayback: (...a: unknown[]) => apiMock.seekPlayback(...a),
  pausePlayback: (...a: unknown[]) => apiMock.pausePlayback(...a),
  resumePlayback: (...a: unknown[]) => apiMock.resumePlayback(...a),
  rateLimitedUntil: () => 0,
}));
vi.mock('@/lib/spotify/sdk', () => ({ SpotifySdk: class { deviceId = null; start = async () => null; activate = async () => undefined; dispose() {} setVolume() {} } }));

const item = { id: 'abc', name: 't', duration_ms: 600_000, artists: [{ name: 'a' }], album: { name: 'x', images: [] } };
const device = { id: 'dev', name: 'd', type: 'Computer', is_active: true };

describe('SpotifyBackend polling (virtual time)', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date', 'performance', 'setTimeout', 'clearTimeout'], now: 1_700_000_000_000 }));
  afterEach(() => {
    vi.useRealTimers();
    apiMock.getPlaybackState.mockReset();
  });

  async function make() {
    const { SpotifyBackend } = await import('@/lib/player/backends/spotify');
    const b = new SpotifyBackend();
    const events: { ended: number; external: number } = { ended: 0, external: 0 };
    b.attach({ state: () => undefined, ended: () => void events.ended++, error: () => undefined, external: () => void events.external++ } as never);
    Object.assign(b as unknown as Record<string, unknown>, { expectedId: 'abc', durationMs: 600_000, playing: true, loadedAt: -1e12 });
    return { b, events };
  }

  /** Spotify's world: the song position is truthMs(now); the server clock is wall - skew. */
  function world(opts: { skew: number; rttMs: () => number; stalenessMs: () => number; driftPpm?: number; playing?: () => boolean }) {
    const t0 = Date.now();
    const start = 30_000;
    const truth = (wall = Date.now()) => start + (wall - t0) * (1 + (opts.driftPpm ?? 0) / 1e6);
    apiMock.getPlaybackState.mockImplementation(async () => {
      const rtt = opts.rttMs();
      await new Promise((r) => setTimeout(r, rtt / 2));
      const stale = opts.stalenessMs();
      const serverWallTrue = Date.now() - stale; // when the answer was produced/true, in real time
      const st: Sp = { is_playing: opts.playing ? opts.playing() : true, progress_ms: Math.round(truth(serverWallTrue)), timestamp: serverWallTrue - opts.skew, item, device };
      await new Promise((r) => setTimeout(r, rtt / 2));
      return st;
    });
    return { truth, start };
  }

  it('tracks the song within ~100 ms for 3 minutes with a skewed clock, jittery network and 0.2% drift', async () => {
    for (const skew of [0, 3_000, -5_000]) {
      const { b } = await make();
      const rnd = rng(11 + skew);
      const w = world({ skew, rttMs: () => 40 + rnd() * 100, stalenessMs: () => (rnd() < 0.8 ? rnd() * 60 : 300 + rnd() * 500), driftPpm: 2000 });
      b.clock.reset(w.start, true);
      b.start({ webPlayer: false });
      const errs: number[] = [];
      for (let i = 0; i < 1800; i++) {
        await vi.advanceTimersByTimeAsync(100);
        if (i > 400) errs.push(Math.abs(b.positionMs() - w.truth()));
      }
      b.stop();
      errs.sort((x, y) => x - y);
      const p50 = errs[Math.floor(errs.length / 2)]!;
      const p95 = errs[Math.floor(errs.length * 0.95)]!;
      expect(p50).toBeLessThan(80);
      expect(p95).toBeLessThan(250);
    }
  });

  it('a pause is not undone by a poll that was already in flight', async () => {
    const { b } = await make();
    b.clock.reset(60_000, true);
    let release!: (v: unknown) => void;
    apiMock.getPlaybackState.mockImplementationOnce(() => new Promise((r) => (release = r)));
    const polling = (b as unknown as { poll(): Promise<void> }).poll();
    await vi.advanceTimersByTimeAsync(200);
    await b.pause();
    release({ is_playing: true, progress_ms: 60_100, timestamp: Date.now(), item, device }); // describes the moment before the pause
    await polling;
    expect(b.clock.isPlaying()).toBe(false);
    const held = b.positionMs();
    await vi.advanceTimersByTimeAsync(5000);
    expect(b.positionMs()).toBe(held);
  });

  it('a seek followed by an honest poll lands on the new position', async () => {
    const { b } = await make();
    b.clock.reset(60_000, true);
    await b.seek(200_000);
    await vi.advanceTimersByTimeAsync(1500);
    apiMock.getPlaybackState.mockResolvedValueOnce({ is_playing: true, progress_ms: 201_500, timestamp: Date.now(), item, device });
    await (b as unknown as { poll(): Promise<void> }).poll();
    expect(Math.abs(b.positionMs() - 201_500)).toBeLessThan(150);
  });

  it('a poll that started while the seek request was still in flight cannot move the clock back', async () => {
    const { b } = await make();
    b.clock.reset(60_000, true);
    let finishSeek!: () => void;
    apiMock.seekPlayback.mockImplementationOnce(() => new Promise<undefined>((r) => (finishSeek = () => r(undefined))));
    const seeking = b.seek(200_000);
    await vi.advanceTimersByTimeAsync(50);
    apiMock.getPlaybackState.mockResolvedValueOnce({ is_playing: true, progress_ms: 60_500, timestamp: Date.now(), item, device }); // Spotify has not applied the seek yet
    const polling = (b as unknown as { poll(): Promise<void> }).poll();
    await vi.advanceTimersByTimeAsync(10);
    finishSeek();
    await seeking;
    await polling;
    expect(b.positionMs()).toBeGreaterThan(199_000);
  });

  it('another device skipping to a new track resets the clock (a real change, not drift)', async () => {
    const { b, events } = await make();
    b.clock.reset(60_000, true);
    apiMock.getPlaybackState.mockResolvedValueOnce({ is_playing: true, progress_ms: 4_000, timestamp: Date.now(), item: { ...item, id: 'next', name: 'n' }, device });
    await (b as unknown as { poll(): Promise<void> }).poll();
    expect(events.external).toBe(1);
    expect(Math.abs(b.positionMs() - 4_000)).toBeLessThan(100);
  });

  it('resuming after a pause continues from the held position', async () => {
    const { b } = await make();
    b.clock.reset(60_000, true);
    // Spotify's side of the story: it plays, we pause it, it holds, we resume it
    let truthPos = 60_000;
    let truthPlaying = true;
    let truthAt = Date.now();
    const settle = () => {
      if (truthPlaying) truthPos += Date.now() - truthAt;
      truthAt = Date.now();
    };
    apiMock.getPlaybackState.mockImplementation(async () => {
      settle();
      return { is_playing: truthPlaying, progress_ms: Math.round(truthPos), timestamp: Date.now(), item, device };
    });
    apiMock.pausePlayback.mockImplementationOnce(async () => {
      settle();
      truthPlaying = false;
      return undefined;
    });
    apiMock.resumePlayback.mockImplementationOnce(async () => {
      settle();
      truthPlaying = true;
      return undefined;
    });
    await b.pause();
    await vi.advanceTimersByTimeAsync(8000);
    const held = b.positionMs();
    expect(Math.abs(held - 60_000)).toBeLessThan(50);
    await b.play();
    await vi.advanceTimersByTimeAsync(3000);
    expect(Math.abs(b.positionMs() - (held + 3000))).toBeLessThan(120);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// LocalBackend
// ---------------------------------------------------------------------------------------------------------------
describe('LocalBackend position', () => {
  class FakeAudio extends EventTarget {
    currentTime = 0;
    duration = 200;
    paused = true;
    ended = false;
    readyState = 4;
    src = '';
    volume = 1;
    muted = false;
    preload = '';
    crossOrigin = '';
    error = null;
    play = async () => {
      this.paused = false;
    };
    pause = () => {
      this.paused = true;
    };
    load = () => undefined;
    removeAttribute = () => undefined;
  }
  beforeEach(() => vi.stubGlobal('Audio', FakeAudio));
  afterEach(() => vi.unstubAllGlobals());

  it('reports the element position, clamps seeks, and holds while paused', async () => {
    const { LocalBackend } = await import('@/lib/player/backends/local');
    const b = new LocalBackend();
    b.attach({ state: () => undefined, ended: () => undefined, error: () => undefined } as never);
    await b.seek(12_345);
    expect(b.positionMs()).toBeCloseTo(12_345, 0);
    await b.seek(-5000);
    expect(b.positionMs()).toBe(0);
    await b.seek(10_000_000);
    expect(b.positionMs()).toBeLessThan(200_000);
  });

  it('uses the audio stack output latency when there is one, and 0 when there is none', async () => {
    const { LocalBackend } = await import('@/lib/player/backends/local');
    const b = new LocalBackend();
    expect(b.outputLatencyMs()).toBe(0);
    (b as unknown as { ctx: unknown }).ctx = { baseLatency: 0.01, outputLatency: 0.09 };
    expect(b.outputLatencyMs()).toBeCloseTo(100, 5);
    (b as unknown as { ctx: unknown }).ctx = { baseLatency: 0.01, outputLatency: Infinity };
    expect(b.outputLatencyMs()).toBe(0);
  });
});

describe('LocalBackend buffering and pauses', () => {
  class Elem extends EventTarget {
    currentTime = 5;
    duration = 200;
    paused = false;
    ended = false;
    readyState = 4;
    src = 'x';
    volume = 1;
    muted = false;
    preload = '';
    crossOrigin = '';
    error = null;
    play = async () => undefined;
    pause = () => undefined;
    load = () => undefined;
    removeAttribute = () => undefined;
  }
  beforeEach(() => vi.stubGlobal('Audio', Elem));
  afterEach(() => vi.unstubAllGlobals());

  it('reports buffering while the element is starved, with the position held where the audio stopped', async () => {
    const { LocalBackend } = await import('@/lib/player/backends/local');
    const b = new LocalBackend();
    const seen: { playing: boolean; buffering: boolean; positionMs: number }[] = [];
    b.attach({ state: (s: { playing: boolean; buffering: boolean; positionMs: number }) => seen.push(s), ended: () => undefined, error: () => undefined } as never);
    const a = (b as unknown as { audio: Elem }).audio;
    a.readyState = 2; // HAVE_CURRENT_DATA: stalled
    a.dispatchEvent(new Event('waiting'));
    a.readyState = 4;
    a.currentTime = 5.2;
    a.dispatchEvent(new Event('playing'));
    expect(seen[0]).toMatchObject({ playing: true, buffering: true, positionMs: 5000 });
    expect(seen[1]).toMatchObject({ playing: true, buffering: false });
    expect(seen[1]!.positionMs).toBeCloseTo(5200, 0);
  });

  it('a paused element holds its position, and a seek while paused is reflected immediately', async () => {
    const { LocalBackend } = await import('@/lib/player/backends/local');
    const b = new LocalBackend();
    b.attach({ state: () => undefined, ended: () => undefined, error: () => undefined } as never);
    await b.pause();
    const a = (b as unknown as { audio: Elem }).audio;
    a.paused = true;
    await b.seek(42_000);
    expect(b.positionMs()).toBe(42_000);
  });
});
