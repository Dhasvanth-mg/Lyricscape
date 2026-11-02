// Tempo without audio: tap tempo, tempo and phase from lyric timing, the online lookup's matching, and which source wins.
import { describe, expect, it } from 'vitest';
import { estimateTempoFromLyrics, MIN_LYRIC_CONFIDENCE } from '@/lib/analysis/lyricTempo';
import { gridFrom, resolveBeatGrid, tapEstimate } from '@/lib/analysis/tempoSources';
import { candidatesFor } from '@/lib/server/tempoLookup';
import type { AudioFeatures } from '@/lib/analysis/types';
import type { TempoFeature } from '@/lib/index/types';
import type { LyricDocument, TimedLine } from '@/lib/types';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5;
  };
}

const taps = (bpm: number, phase: number, n: number, jitterMs: number, seed = 1) => {
  const r = rng(seed);
  const P = 60000 / bpm;
  return Array.from({ length: n }, (_, i) => Math.round(phase + i * P + r() * jitterMs));
};

describe('tap tempo', () => {
  it('recovers tempo and phase from human-steady taps', () => {
    const e = tapEstimate(taps(120, 130 + 5000, 16, 30))!;
    expect(Math.abs(e.bpm - 120)).toBeLessThan(0.8);
    const P = 500;
    const err = Math.abs(((e.phaseMs - 130 + P * 1.5) % P) - P / 2);
    expect(err).toBeLessThan(25);
    expect(e.confidence).toBeGreaterThan(0.6);
    expect(e.used).toBeGreaterThanOrEqual(14);
  });

  it('needs at least four taps', () => {
    expect(tapEstimate([1000, 1500, 2000])).toBeNull();
    expect(tapEstimate(taps(100, 0, 4, 0))).not.toBeNull();
  });

  it('forgets taps from before a lost beat, and drops a stray tap', () => {
    const early = taps(90, 1000, 5, 20, 2); // an earlier attempt
    const late = taps(128, 20000, 12, 20, 3); // lost it, found it again at a new speed after a pause
    const stray = [...late.slice(0, 6), late[5]! + 190, ...late.slice(6)];
    const e = tapEstimate([...early, ...stray].sort((a, b) => a - b))!;
    expect(Math.abs(e.bpm - 128)).toBeLessThan(1.2);
  });

  it('is more precise than a single interval (a least-squares fit)', () => {
    const e = tapEstimate(taps(100, 0, 40, 60, 4))!;
    expect(Math.abs(e.bpm - 100)).toBeLessThan(0.6);
  });

  it('refuses a tempo outside 40-260 BPM', () => {
    expect(tapEstimate(taps(300, 0, 10, 0))).toBeNull();
    expect(tapEstimate(taps(30, 0, 10, 0))).toBeNull();
  });
});

describe('beat grids', () => {
  it('starts at the phase and keeps the tempo, over the whole song', () => {
    const g = gridFrom(120, 130, 10_000);
    expect(g[0]).toBe(130);
    expect(g[1]).toBe(630);
    expect(g.length).toBe(20);
    expect(gridFrom(120, 1130, 5000)[0]).toBe(130); // a phase more than a beat in is folded back
  });
});

const doc = (lines: TimedLine[]): LyricDocument => ({ source: 'lrc', licenseSource: 'test', lines });
const line = (startMs: number, words?: number[]): TimedLine => ({
  startMs,
  endMs: startMs + 1500,
  words: (words ?? [startMs]).map((w, i) => ({ text: `w${i}`, startMs: w, endMs: w + 200 })),
  wordTiming: words ? 'authored' : 'estimated',
});

describe('tempo from lyric timing', () => {
  const bpm = 112;
  const P = 60000 / bpm;
  const r = rng(7);
  // lines start on beats (mostly on bar starts and half bars), placed to within about 30 ms, with sung words on eighth positions
  const lines: TimedLine[] = [];
  for (let k = 0; k < 40; k++) {
    const beat = 8 + k * (k % 3 === 2 ? 4 : 6) + (k % 5 === 4 ? 2 : 0);
    const t = Math.round(80 + beat * P + r() * 40);
    const words = [t, ...[1, 2, 3, 4].map((j) => Math.round(80 + (beat + j * 0.5) * P + r() * 30))];
    lines.push(line(t, words));
  }
  const d = doc(lines);

  it('finds the tempo of neatly timed lyrics (or its half or double, which fit the same onsets)', () => {
    const e = estimateTempoFromLyrics(d)!;
    expect(e).not.toBeNull();
    const ratio = e.bpm / bpm;
    expect([0.5, 1, 2].some((x) => Math.abs(ratio - x) < 0.02)).toBe(true);
    expect(e.confidence).toBeGreaterThan(MIN_LYRIC_CONFIDENCE);
  });

  it('given the tempo, finds the phase', () => {
    const e = estimateTempoFromLyrics(d, { fixedBpm: bpm })!;
    expect(e.confidence).toBeGreaterThan(MIN_LYRIC_CONFIDENCE);
    const err = Math.abs(((e.phaseMs - 80 + P * 1.5) % P) - P / 2);
    expect(err).toBeLessThan(45);
  });

  it('says it cannot tell when the lines are placed at random', () => {
    const rr = rng(99);
    const random = doc(Array.from({ length: 50 }, (_, i) => line(Math.round(4000 + i * 3000 + rr() * 2500))));
    const e = estimateTempoFromLyrics(random);
    expect(!e || e.confidence < MIN_LYRIC_CONFIDENCE).toBe(true);
  });

  it('needs enough onsets', () => {
    expect(estimateTempoFromLyrics(doc([line(1000), line(3000), line(5000)]))).toBeNull();
  });
});

describe('which source wins', () => {
  const audio = (bpm: number | null, conf = 0.9, beats = 40): AudioFeatures => ({
    version: 1,
    source: 'capture',
    durationMs: 200_000,
    onset: '',
    covered: [[0, 100_000]],
    energy: '',
    bpm,
    bpmConfidence: conf,
    beatTimesMs: Array.from({ length: beats }, (_, i) => i * 500),
    loudnessDb: -12,
    brightness: 0.3,
    analyzedAt: 1,
  });
  const tempo = (o: Partial<TempoFeature>): TempoFeature => ({ source: 'lyrics', bpm: 100, phaseMs: 50, confidence: 0.8, savedAt: 1, ...o });
  const dur = 200_000;

  it('a tapped beat beats everything', () => {
    const g = resolveBeatGrid({ durationMs: dur, audio: audio(120), tempo: tempo({ source: 'lookup+lyrics' }), tap: tempo({ source: 'tapped', bpm: 95, confidence: 1 }) })!;
    expect(g.source).toBe('tapped');
    expect(g.bpm).toBe(95);
  });
  it('then what was heard, then a lookup aligned by the lyrics, then the lyrics alone', () => {
    expect(resolveBeatGrid({ durationMs: dur, audio: audio(120), tempo: tempo({ source: 'lookup+lyrics' }) })!.source).toBe('learned');
    expect(resolveBeatGrid({ durationMs: dur, audio: null, tempo: tempo({ source: 'lookup+lyrics' }) })!.source).toBe('lookup+lyrics');
    expect(resolveBeatGrid({ durationMs: dur, audio: audio(null, 0), tempo: tempo({ source: 'lyrics' }) })!.source).toBe('lyrics');
  });
  it('a tempo with no phase, or an unsure estimate, makes no grid', () => {
    expect(resolveBeatGrid({ durationMs: dur, audio: null, tempo: tempo({ source: 'lookup', phaseMs: null }) })).toBeNull();
    expect(resolveBeatGrid({ durationMs: dur, audio: null, tempo: tempo({ source: 'lyrics', confidence: 0.1 }) })).toBeNull();
    expect(resolveBeatGrid({ durationMs: dur, audio: null, tempo: null })).toBeNull();
  });
  it('an untrusted heard tempo is ignored', () => {
    expect(resolveBeatGrid({ durationMs: dur, audio: audio(112, 0.05), tempo: null })).toBeNull();
  });
  it('labels every source in words', () => {
    expect(resolveBeatGrid({ durationMs: dur, audio: null, tempo: null, tap: tempo({ source: 'tapped' }) })!.label).toMatch(/tapped/);
  });
});

describe('online tempo lookup matching', () => {
  const t = (id: number, title: string, artist: string, duration: number) => ({ id, title, duration, artist: { name: artist } });
  const results = [
    t(1, 'Flashing Lights', 'Kanye West', 237),
    t(2, 'Flashing Lights (as made famous by Kanye West)', 'Hip Hop Chart Toppers', 244),
    t(3, 'Flashing Lights (Remix)', 'Kanye West', 238),
    t(4, 'Flashing Lights', 'Kanye West', 340),
    t(5, 'Flashing Lights - Live', 'Kanye West', 237),
    t(6, 'Flashing Lights', 'Someone Else', 237),
  ];
  it('keeps the same recording: title, artist and length; not remixes, live takes, tributes or a different length', () => {
    expect(candidatesFor(results, 'Flashing Lights', 'Kanye West', 237).map((c) => c.id)).toEqual([1]);
  });
  it('tolerates decoration on our side and a few seconds of length', () => {
    expect(candidatesFor(results, 'Flashing Lights (feat. Dwele)', 'Kanye West, Dwele', 239).map((c) => c.id)).toEqual([1]);
    expect(candidatesFor(results, 'Flashing Lights', 'Kanye West', 250)).toEqual([]);
  });
  it('without a length it still matches by title and artist', () => {
    expect(candidatesFor(results, 'Flashing Lights', 'Kanye West', null).map((c) => c.id)).toContain(1);
  });
});
