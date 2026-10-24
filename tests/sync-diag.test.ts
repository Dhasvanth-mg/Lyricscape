import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { intersectClockProbes, summarizePolls, syncDiag, type PollSample } from '@/lib/player/syncDiag';
import { telemetryAgeMs, TELEMETRY_AGE_CAP_MS } from '@/lib/player/telemetry';

const poll = (i: number, over: Partial<PollSample> = {}): PollSample => ({
  wall: 1_000_000 + i * 3500,
  perf: i * 3500,
  rttMs: 80,
  timestamp: 1_000_000 + i * 3500 - 400,
  progressMs: 30_000 + i * 3500,
  playing: true,
  trackId: 't',
  appliedAgeMs: 400,
  shadowAgeMs: 40,
  positionBeforeMs: 0,
  epoch: 0,
  commandsInFlight: 0,
  ...over,
});

describe('telemetryAgeMs (the formula the app shipped with and real use was calibrated against)', () => {
  it('is now minus the state timestamp, never negative, capped', () => {
    expect(telemetryAgeMs(1000, 1700)).toBe(700);
    expect(telemetryAgeMs(5000, 1000)).toBe(0); // clock behind Spotify's
    expect(telemetryAgeMs(0, 60_400)).toBe(TELEMETRY_AGE_CAP_MS); // clock far ahead: the cap, as on the measured machine
    expect(telemetryAgeMs(NaN, 1000)).toBe(0);
  });
});

describe('diagnostics: reading the samples', () => {
  it('tells a timestamp that advances with each poll (response time) from one that stays put (last state change)', () => {
    const fresh = Array.from({ length: 8 }, (_, i) => poll(i));
    expect(summarizePolls(fresh).timestampBehaviour).toMatch(/ADVANCES/);
    const stuck = Array.from({ length: 8 }, (_, i) => poll(i, { timestamp: 1_000_000 }));
    expect(summarizePolls(stuck).timestampBehaviour).toMatch(/CONSTANT/);
    expect(summarizePolls([poll(0)]).timestampBehaviour).toMatch(/not enough/);
  });

  it('reports the raw age (which includes any clock error) next to the age actually applied', () => {
    const s = summarizePolls(Array.from({ length: 6 }, (_, i) => poll(i, { timestamp: 1_000_000 + i * 3500 - 60_800, appliedAgeMs: 2000 })));
    expect(s.rawAgeMedianMs).toBe(60_800);
    expect(s.appliedAgeMedianMs).toBe(2000);
  });
});

describe('diagnostics: this PC\'s clock against Spotify\'s', () => {
  // Spotify Date header has 1 s resolution; each probe says "local time was X, Spotify's header said second D"
  const probe = (localAtHeader: number, spotifyTrueMs: number) => ({ serverNowMs: localAtHeader + 60 /* half of a 120 ms upstream round trip */, rttMs: 120, spotifyDate: new Date(Math.floor(spotifyTrueMs / 1000) * 1000).toUTCString() });

  it('narrows to the real offset by intersecting probes taken at different moments in the second', () => {
    const trueSkew = 60_400; // this PC is 60.4 s ahead
    const base = Date.UTC(2026, 9, 23, 21, 49, 0);
    // ten probes whose moments fall at spread-out fractions of the second
    const probes = Array.from({ length: 10 }, (_, i) => {
      const spotify = base + i * 3000 + ((i * 337) % 1000);
      return probe(spotify + trueSkew, spotify);
    });
    const r = intersectClockProbes(probes)!;
    expect(r.probes).toBe(10);
    expect(Math.abs(r.offsetMs - trueSkew)).toBeLessThanOrEqual(r.halfWidthMs); // the truth is inside the reported interval
    expect(r.halfWidthMs).toBeLessThan(200); // ten probes: about +-150 ms (measured), from 1 s with one probe
  });

  it('one probe alone only pins the offset to within the 1 s resolution of the header', () => {
    const base = Date.UTC(2026, 9, 23, 21, 49, 0);
    const r = intersectClockProbes([probe(base + 340 + 60_400, base + 340)])!;
    expect(r.halfWidthMs).toBeGreaterThanOrEqual(450);
    expect(Math.abs(r.offsetMs - 60_400)).toBeLessThanOrEqual(r.halfWidthMs);
  });

  it('copes with no usable probes', () => {
    expect(intersectClockProbes([])).toBeNull();
    expect(intersectClockProbes([{ serverNowMs: 1, rttMs: 1, spotifyDate: null }])).toBeNull();
  });
});

describe('diagnostics are off unless asked for', () => {
  beforeEach(() => syncDiag._reset());
  afterEach(() => {
    vi.unstubAllGlobals();
    syncDiag._reset();
  });

  it('nothing is enabled, exposed or recorded by default', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null }, location: { search: '' } });
    expect(syncDiag.enabled()).toBe(false);
    expect((globalThis as unknown as { window: Record<string, unknown> }).window.lyricscapeSync).toBeUndefined();
  });

  it('the localStorage flag or ?syncdebug=1 turns it on and exposes the console API', () => {
    vi.stubGlobal('window', { localStorage: { getItem: (k: string) => (k === 'lyricscape.debug.sync' ? '1' : null) }, location: { search: '' } });
    expect(syncDiag.enabled()).toBe(true);
    expect(typeof (globalThis as unknown as { window: { lyricscapeSync: { summary: unknown } } }).window.lyricscapeSync.summary).toBe('function');
    syncDiag._reset();
    vi.stubGlobal('window', { localStorage: { getItem: () => null }, location: { search: '?x=1&syncdebug=1' } });
    expect(syncDiag.enabled()).toBe(true);
  });
});
