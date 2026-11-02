// Tempo and beat tracking from an onset-strength envelope (one value per ONSET_HOP_MS). Pure and deterministic.
//
//  1. Clean the envelope: remove the slow local average, keep what rises above it, scale to unit spread.
//  2. Tempo: for every candidate tempo, how well does the envelope line up with itself one beat later (and two beats later)?
//     A mild preference for 120 BPM chooses between "half time" and "double time". Heard stretches only: gaps are masked, not counted.
//  3. Beats: dynamic programming over the whole envelope (Ellis, "Beat tracking by dynamic programming"): each beat should fall on
//     a strong onset and about one period after the previous one; gaps with no information simply keep the pulse going.

import { ONSET_HOP_MS } from './types';

export type TempoResult = { bpm: number | null; confidence: number; beatTimesMs: number[] };

const MIN_BPM = 55;
const MAX_BPM = 215;

/** Remove the local mean (about one second either side), keep the positive part, scale by the spread of what was heard. */
export function cleanOnset(onset: Float32Array, heard: Uint8Array): Float32Array {
  const n = onset.length;
  const out = new Float32Array(n);
  const prefix = new Float64Array(n + 1);
  const cnt = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) {
    prefix[i + 1] = prefix[i]! + (heard[i] ? onset[i]! : 0);
    cnt[i + 1] = cnt[i]! + (heard[i] ? 1 : 0);
  }
  const w = Math.round(1000 / ONSET_HOP_MS);
  let sum = 0;
  let sum2 = 0;
  let k = 0;
  for (let i = 0; i < n; i++) {
    if (!heard[i]) continue;
    const a = Math.max(0, i - w);
    const b = Math.min(n, i + w + 1);
    const c = cnt[b]! - cnt[a]!;
    const mean = c ? (prefix[b]! - prefix[a]!) / c : 0;
    const v = Math.max(0, onset[i]! - mean);
    out[i] = v;
    sum += v;
    sum2 += v * v;
    k++;
  }
  if (!k) return out;
  const m = sum / k;
  const sd = Math.sqrt(Math.max(1e-12, sum2 / k - m * m));
  for (let i = 0; i < n; i++) out[i] = heard[i] ? out[i]! / sd : 0;
  return out;
}

function lagScore(o: Float32Array, heard: Uint8Array, lag: number): number {
  const n = o.length;
  const l0 = Math.floor(lag);
  const f = lag - l0;
  let s = 0;
  let c = 0;
  for (let i = 0; i + l0 + 1 < n; i++) {
    if (!heard[i] || !heard[i + l0] || !heard[i + l0 + 1]) continue;
    const a = o[i]!;
    if (a === 0) {
      c++;
      continue;
    }
    s += a * (o[i + l0]! * (1 - f) + o[i + l0 + 1]! * f);
    c++;
  }
  return c > 0 ? s / c : 0;
}

/** a preference for the tempos people tap to (about 80-160) so that half time and double time resolve to the felt beat */
const prior = (bpm: number) => Math.exp(-0.5 * Math.pow(Math.log2(bpm / 112) / 0.55, 2));

export function estimateTempo(o: Float32Array, heard: Uint8Array): { bpm: number | null; confidence: number } {
  let nHeard = 0;
  for (let i = 0; i < heard.length; i++) nHeard += heard[i]!;
  if (nHeard * ONSET_HOP_MS < 8000) return { bpm: null, confidence: 0 };
  const cands: { bpm: number; score: number; raw: number }[] = [];
  for (let bpm = MIN_BPM; bpm <= MAX_BPM; bpm += 0.5) {
    const T = 60000 / bpm / ONSET_HOP_MS;
    const s = lagScore(o, heard, T) + 0.5 * lagScore(o, heard, 2 * T);
    cands.push({ bpm, score: s * prior(bpm), raw: s });
  }
  let best = cands[0]!;
  let sum = 0;
  for (const c of cands) {
    sum += c.score;
    if (c.score > best.score) best = c;
  }
  const raws = cands.map((c) => c.raw).sort((a, b) => a - b);
  // sparse onsets make most lags score exactly zero, so the median alone can be 0: never divide by less than half the mean
  const meanRaw = raws.reduce((a, b) => a + b, 0) / raws.length;
  const median = Math.max(raws[raws.length >> 1]!, 0.5 * meanRaw);
  if (best.score <= 0 || sum <= 0 || median <= 0) return { bpm: null, confidence: 0 };
  // refine around the winner
  let rb = best.bpm;
  let rs = -1;
  for (let bpm = best.bpm - 0.75; bpm <= best.bpm + 0.75; bpm += 0.05) {
    const T = 60000 / bpm / ONSET_HOP_MS;
    const s = lagScore(o, heard, T) + 0.5 * lagScore(o, heard, 2 * T);
    if (s > rs) {
      rs = s;
      rb = bpm;
    }
  }
  // a runner-up that is a different tempo (not an octave) lowers trust a little
  const confidence = Math.max(0, Math.min(1, (best.raw / median - 1) / 3));
  return { bpm: Math.round(rb * 100) / 100, confidence };
}

/** Beat times (ms) by dynamic programming over the whole envelope at the given tempo. */
export function trackBeats(o: Float32Array, bpm: number, tightness = 100): number[] {
  const n = o.length;
  if (!n) return [];
  const P = 60000 / bpm / ONSET_HOP_MS;
  const score = new Float64Array(n);
  const prev = new Int32Array(n).fill(-1);
  const lo = Math.max(1, Math.round(P / 2));
  const hi = Math.max(lo + 1, Math.round(P * 2));
  for (let i = 0; i < n; i++) {
    let best = -Infinity;
    let bj = -1;
    for (let d = lo; d <= hi; d++) {
      const j = i - d;
      if (j < 0) break;
      const cost = tightness * Math.pow(Math.log(d / P), 2);
      const v = score[j]! - cost;
      if (v > best) {
        best = v;
        bj = j;
      }
    }
    if (bj >= 0) {
      score[i] = o[i]! + best;
      prev[i] = bj;
    } else score[i] = o[i]!;
  }
  // start the backtrace at the best score in the last two periods
  let end = n - 1;
  let bs = -Infinity;
  for (let i = Math.max(0, n - Math.round(2 * P)); i < n; i++) {
    if (score[i]! > bs) {
      bs = score[i]!;
      end = i;
    }
  }
  const beats: number[] = [];
  for (let i = end; i >= 0; i = prev[i]!) {
    beats.push(i);
    if (prev[i]! < 0) break;
  }
  beats.reverse();
  // sub-bin position by parabolic interpolation around each onset peak
  return beats.map((i) => {
    const a = o[i - 1] ?? 0;
    const b = o[i]!;
    const c = o[i + 1] ?? 0;
    const den = a - 2 * b + c;
    const off = den < -1e-9 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / den)) : 0;
    return Math.round((i + off) * ONSET_HOP_MS);
  });
}

/** Tempo from beat positions: the median of the slopes between beats a few apart (robust to the odd misplaced beat). */
export function slopeBpm(beats: number[]): number | null {
  if (beats.length < 12) return null;
  const slopes: number[] = [];
  for (const gap of [4, 8, 16]) for (let i = 0; i + gap < beats.length; i++) slopes.push((beats[i + gap]! - beats[i]!) / gap);
  slopes.sort((a, b) => a - b);
  const m = slopes[slopes.length >> 1]!;
  return m > 0 ? 60000 / m : null;
}

export function analyseTempo(onset: Float32Array, heard: Uint8Array): TempoResult {
  const o = cleanOnset(onset, heard);
  const { bpm, confidence } = estimateTempo(o, heard);
  if (bpm === null) return { bpm: null, confidence: 0, beatTimesMs: [] };
  let beats = trackBeats(o, bpm);
  // the tempo grid is coarse (one step is 23 ms): refine from where the beats actually fell, then track again
  const fine = slopeBpm(beats);
  if (fine !== null && Math.abs(fine - bpm) / bpm < 0.03) {
    beats = trackBeats(o, fine);
    return { bpm: Math.round(fine * 100) / 100, confidence, beatTimesMs: beats };
  }
  return { bpm, confidence, beatTimesMs: beats };
}
