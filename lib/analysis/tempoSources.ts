// Where a song's beat grid can come from, and which one wins. Pure functions (no audio, no network):
//   tapped         the person tapped along: the most trusted, always wins
//   learned        heard in the audio (lib/analysis/features.ts, the song index's `audio` feature)
//   lookup+lyrics  a tempo looked up online, with its phase found in the lyric timing
//   lyrics         tempo and phase both estimated from the lyric timing (lib/analysis/lyricTempo.ts)
// A tempo from a lookup alone has no phase and so makes no grid.

import type { TempoFeature } from '../index/types';
import { hasTempo, type AudioFeatures } from './types';
import { MIN_LYRIC_CONFIDENCE } from './lyricTempo';

export type BeatSource = 'tapped' | 'learned' | 'lookup+lyrics' | 'lyrics';
export type BeatGrid = { source: BeatSource; bpm: number; beatTimesMs: number[]; label: string };

export const BEAT_SOURCE_LABEL: Record<BeatSource, string> = {
  tapped: 'tapped by you',
  learned: 'learned from the audio',
  'lookup+lyrics': 'looked up, aligned by the lyrics',
  lyrics: 'estimated from the lyric timing',
};

/** beat times (ms) of a steady tempo: `phaseMs` is the time of one beat; the grid runs over the whole song */
export function gridFrom(bpm: number, phaseMs: number, durationMs: number): number[] {
  const P = 60000 / bpm;
  const first = ((phaseMs % P) + P) % P;
  const out: number[] = [];
  for (let t = first; t <= durationMs && out.length < 4000; t += P) out.push(Math.round(t));
  return out;
}

/** The best beat grid available for a song, or null. A grid the track brings itself is handled by the caller (it always wins). */
export function resolveBeatGrid(o: { durationMs: number; audio: AudioFeatures | null; tempo: TempoFeature | null; tap?: TempoFeature | null }): BeatGrid | null {
  const { audio, tempo, tap, durationMs } = o;
  const make = (source: BeatSource, bpm: number, beats: number[]): BeatGrid => ({ source, bpm, beatTimesMs: beats, label: BEAT_SOURCE_LABEL[source] });
  if (tap && tap.phaseMs !== null) return make('tapped', tap.bpm, gridFrom(tap.bpm, tap.phaseMs, durationMs));
  if (hasTempo(audio)) return make('learned', audio.bpm, audio.beatTimesMs);
  if (tempo && tempo.phaseMs !== null) {
    if (tempo.source === 'lookup+lyrics' && tempo.confidence >= MIN_LYRIC_CONFIDENCE) return make('lookup+lyrics', tempo.bpm, gridFrom(tempo.bpm, tempo.phaseMs, durationMs));
    if (tempo.source === 'lyrics' && tempo.confidence >= MIN_LYRIC_CONFIDENCE) return make('lyrics', tempo.bpm, gridFrom(tempo.bpm, tempo.phaseMs, durationMs));
  }
  return null;
}

// ---- tap tempo --------------------------------------------------------------------------------------------------------------------

export type TapEstimate = {
  bpm: number;
  /** the time (ms) of one beat: the fitted grid's first beat within the song */
  phaseMs: number;
  /** taps used (outliers dropped) */
  used: number;
  /** spread of the taps around the fitted grid, ms */
  sdMs: number;
  /** 0..1: how steady the taps were */
  confidence: number;
};

/**
 * Tempo and phase from tap times (ms of song time). Needs at least four taps. A pause of more than two and a half beats starts over (the
 * person lost the beat and found it again); taps that sit far off the grid fitted to the rest are dropped; the grid is a least-squares line
 * through the remaining taps, so it is more precise than any single interval.
 */
export function tapEstimate(taps: number[]): TapEstimate | null {
  if (taps.length < 4) return null;
  // keep the most recent run of steady taps
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1]!;
  let run = taps;
  for (let guard = 0; guard < 3; guard++) {
    const iv = run.slice(1).map((t, i) => t - run[i]!);
    const m = med(iv);
    let start = 0;
    for (let i = iv.length - 1; i >= 0; i--) {
      if (iv[i]! > m * 2.5 || iv[i]! < m * 0.4) {
        start = i + 1;
        break;
      }
    }
    if (start === 0) break;
    run = run.slice(start);
    if (run.length < 4) return null;
  }
  const iv = run.slice(1).map((t, i) => t - run[i]!);
  let P = med(iv);
  if (!(P > 60000 / 260) || !(P < 60000 / 40)) return null;
  // fit t_i = t0 + k_i * P, dropping taps more than 22% of a beat off the line, twice
  let pts = run.map((t) => ({ t, k: 0 }));
  let t0 = run[0]!;
  let used = run.length;
  for (let pass = 0; pass < 3; pass++) {
    pts = run.map((t) => ({ t, k: Math.round((t - t0) / P) }));
    const keep = pass === 0 ? pts : pts.filter((p) => Math.abs(p.t - (t0 + p.k * P)) <= 0.22 * P);
    if (keep.length < 4) return null;
    const n = keep.length;
    const sk = keep.reduce((a, p) => a + p.k, 0);
    const st = keep.reduce((a, p) => a + p.t, 0);
    const skk = keep.reduce((a, p) => a + p.k * p.k, 0);
    const skt = keep.reduce((a, p) => a + p.k * p.t, 0);
    const den = n * skk - sk * sk;
    if (Math.abs(den) < 1e-9) return null;
    P = (n * skt - sk * st) / den;
    t0 = (st - P * sk) / n;
    used = n;
    pts = keep;
  }
  const bpm = 60000 / P;
  if (!(bpm >= 40 && bpm <= 260)) return null;
  const res = pts.map((p) => p.t - (t0 + p.k * P));
  const sd = Math.sqrt(res.reduce((a, r) => a + r * r, 0) / res.length);
  const phase = ((t0 % P) + P) % P;
  return { bpm: Math.round(bpm * 100) / 100, phaseMs: Math.round(phase), used, sdMs: Math.round(sd * 10) / 10, confidence: Math.max(0, Math.min(1, 1 - sd / (0.1 * P))) };
}
