// Music analysis for the DJ / recap engine (runs in the media worker; pure TypeScript, no native deps).
//
//   PCM -> STFT -> onset strength -> tempo (autocorrelation + prior) -> beat tracking (Ellis DP)
//       -> downbeat phase (bass accents) -> bars -> sections (self-similarity novelty) -> highlight windows
//
// It only ever analyses audio the caller is allowed to process (demo CC0 audio, user-imported files).
// Spotify's stream is never an input.

import { dbfs, fft, hann, mean, median, movingAverage, resample, stddev } from './dsp';

export const ANALYSIS_VERSION = '1.0';

const SR = 22050;
const N = 1024;
const HOP = 256;
const FRAME_S = HOP / SR;
/**
 * Spectral flux peaks when an attack first enters the analysis window; calibrated against an impulse train
 * (tests/recap-analysis.test.ts) so reported beat times align with the audible hit.
 */
export const ONSET_LATENCY_S = 0.028; // measured with scripts/calibrate-onset.ts: detected beats lagged the hit by ~28 ms

export type Section = { startMs: number; endMs: number; label: 'intro' | 'verse' | 'build' | 'high' | 'outro'; energy: number };
export type Highlight = { startMs: number; endMs: number; score: number; reason: string };
export type Analysis = {
  analysisVersion: string;
  durationMs: number;
  sampleRate: number;
  bpm: number;
  /** confidence 0..1 that the tempo estimate is stable (beat grid fits the music) */
  tempoConfidence: number;
  beatTimesMs: number[];
  /** index into beatTimesMs of the first bar line */
  downbeatIndex: number;
  barStartsMs: number[];
  /** per-bar loudness 0..1 (relative to the loudest bar) and onset density, aligned to barStartsMs */
  barEnergy: number[];
  barOnset: number[];
  sections: Section[];
  highlights: Highlight[];
  rmsDb: number;
  peakDb: number;
  /** leading/trailing digital silence */
  contentStartMs: number;
  contentEndMs: number;
};

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------
type Features = { flux: Float64Array; bassFlux: Float64Array; rms: Float64Array; bands: Float64Array[]; frames: number };

const BAND_EDGES_HZ = [0, 80, 160, 320, 640, 1000, 1600, 2400, 3600, 5200, 7600, 11025];

function computeFeatures(x: Float32Array): Features {
  const frames = Math.max(0, Math.floor((x.length - N) / HOP) + 1);
  const win = hann(N);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const half = N / 2;
  const prev = new Float64Array(half);
  const flux = new Float64Array(frames);
  const bassFlux = new Float64Array(frames);
  const rms = new Float64Array(frames);
  const binHz = SR / N;
  const bandBins = BAND_EDGES_HZ.slice(0, -1).map((lo, i) => [Math.max(1, Math.floor(lo / binHz)), Math.min(half, Math.ceil(BAND_EDGES_HZ[i + 1]! / binHz))] as const);
  const bands: Float64Array[] = bandBins.map(() => new Float64Array(frames));
  const bassHi = Math.ceil(160 / binHz);
  const maxBin = Math.floor(8000 / binHz);

  for (let t = 0; t < frames; t++) {
    const base = t * HOP;
    let e = 0;
    for (let i = 0; i < N; i++) {
      const v = x[base + i]!;
      re[i] = v * win[i]!;
      im[i] = 0;
      e += v * v;
    }
    rms[t] = Math.sqrt(e / N);
    fft(re, im);
    let f = 0;
    let bf = 0;
    for (let k = 1; k < half; k++) {
      const mag = Math.log1p(10 * Math.hypot(re[k]!, im[k]!));
      const d = mag - prev[k]!;
      if (d > 0 && k < maxBin) f += d;
      if (d > 0 && k <= bassHi) bf += d;
      prev[k] = mag;
    }
    flux[t] = f;
    bassFlux[t] = bf;
    for (let b = 0; b < bandBins.length; b++) {
      const [lo, hi] = bandBins[b]!;
      let s = 0;
      for (let k = lo; k < hi; k++) s += Math.hypot(re[k]!, im[k]!);
      bands[b]![t] = Math.log1p(s);
    }
  }
  return { flux, bassFlux, rms, bands, frames };
}

function normalizeOnset(flux: Float64Array): Float64Array {
  const ma = movingAverage(flux, Math.round(0.4 / FRAME_S));
  const out = new Float64Array(flux.length);
  for (let i = 0; i < flux.length; i++) out[i] = Math.max(0, flux[i]! - ma[i]!);
  const sd = stddev(out) || 1;
  for (let i = 0; i < out.length; i++) out[i] = out[i]! / sd;
  return out;
}

// ---------------------------------------------------------------------------
// Tempo + beats
// ---------------------------------------------------------------------------
function estimatePeriodFrames(onset: Float64Array): { period: number; confidence: number } {
  const minBpm = 60;
  const maxBpm = 200;
  const lagMin = Math.floor(60 / maxBpm / FRAME_S);
  const lagMax = Math.ceil(60 / minBpm / FRAME_S);
  const n = onset.length;
  const acf = new Float64Array(lagMax * 2 + 2);
  for (let lag = 1; lag < acf.length; lag++) {
    let s = 0;
    for (let i = lag; i < n; i++) s += onset[i]! * onset[i - lag]!;
    acf[lag] = s / (n - lag);
  }
  let best = -Infinity;
  let bestLag = lagMin;
  const scores: number[] = [];
  for (let lag = lagMin; lag <= lagMax; lag++) {
    const bpm = 60 / (lag * FRAME_S);
    const prior = Math.exp(-0.5 * (Math.log2(bpm / 120) / 1.0) ** 2);
    // reward lags whose multiples also carry energy (a real pulse repeats)
    const support = acf[lag]! + 0.5 * (acf[lag * 2] ?? 0) + 0.25 * (acf[lag * 3] ?? 0) + 0.5 * (acf[Math.round(lag / 2)] ?? 0);
    const score = support * prior;
    scores.push(score);
    if (score > best) {
      best = score;
      bestLag = lag;
    }
  }
  // parabolic refinement
  const a = acf[bestLag - 1] ?? 0;
  const b = acf[bestLag]!;
  const c = acf[bestLag + 1] ?? 0;
  const denom = a - 2 * b + c;
  const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
  const period = bestLag + Math.max(-0.5, Math.min(0.5, shift));
  const sorted = [...scores].sort((x, y) => y - x);
  const confidence = best > 0 ? Math.max(0, Math.min(1, 1 - (sorted[Math.min(sorted.length - 1, 4)] ?? 0) / best)) : 0;
  return { period, confidence };
}

/** Ellis (2007) dynamic-programming beat tracker. Returns frame indices. */
function trackBeats(onset: Float64Array, period: number, tightness = 100): number[] {
  const n = onset.length;
  if (n === 0) return [];
  const score = new Float64Array(n);
  const prev = new Int32Array(n).fill(-1);
  const lo = Math.max(1, Math.round(period / 2));
  const hi = Math.round(period * 2);
  for (let i = 0; i < n; i++) {
    let best = 0;
    let arg = -1;
    for (let k = lo; k <= hi; k++) {
      const j = i - k;
      if (j < 0) break;
      const s = score[j]! - tightness * Math.log(k / period) ** 2;
      if (s > best) {
        best = s;
        arg = j;
      }
    }
    score[i] = onset[i]! + best;
    prev[i] = arg;
  }
  // start from the best score in the last two periods
  let end = n - 1;
  let bestEnd = -Infinity;
  for (let i = Math.max(0, n - Math.round(period * 2)); i < n; i++) {
    if (score[i]! > bestEnd) {
      bestEnd = score[i]!;
      end = i;
    }
  }
  const beats: number[] = [];
  for (let i = end; i >= 0; i = prev[i]!) {
    beats.push(i);
    if (prev[i]! < 0) break;
  }
  return beats.reverse();
}

/** Least-squares fit of a regular grid; returns null when the music is not steady enough. */
function fitGrid(beatsS: number[]): { t0: number; period: number; residual: number } | null {
  if (beatsS.length < 8) return null;
  const n = beatsS.length;
  let sx = 0;
  let sy = 0;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sx += i;
    sy += beatsS[i]!;
    sxy += i * beatsS[i]!;
    sxx += i * i;
  }
  const period = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const t0 = (sy - period * sx) / n;
  const res: number[] = [];
  for (let i = 0; i < n; i++) res.push(beatsS[i]! - (t0 + period * i));
  return { t0, period, residual: stddev(res) };
}

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------
function cosine(a: number[], b: number[]) {
  let d = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    d += a[i]! * b[i]!;
    na += a[i]! ** 2;
    nb += b[i]! ** 2;
  }
  return d / (Math.sqrt(na * nb) || 1);
}

function segmentBars(barFeat: number[][], barEnergy: number[]): number[] {
  const nb = barFeat.length;
  if (nb < 8) return [];
  const K = Math.min(4, Math.floor(nb / 4));
  const novelty = new Array<number>(nb).fill(0);
  for (let i = K; i < nb - K; i++) {
    let s = 0;
    for (let a = -K; a < K; a++) {
      for (let b = -K; b < K; b++) {
        const sim = cosine(barFeat[i + a]!, barFeat[i + b]!);
        s += (a < 0) === (b < 0) ? sim : -sim;
      }
    }
    // energy change also marks a section boundary
    const before = mean(barEnergy, i - K, i);
    const after = mean(barEnergy, i, i + K);
    novelty[i] = s / (4 * K * K) + Math.abs(after - before) * 2;
  }
  const thr = mean(novelty) + stddev(novelty) * 0.6;
  const cuts: number[] = [];
  for (let i = K; i < nb - K; i++) {
    const v = novelty[i]!;
    if (v > thr && v >= novelty[i - 1]! && v >= novelty[i + 1]! && (cuts.length === 0 || i - cuts[cuts.length - 1]! >= 4)) cuts.push(i);
  }
  return cuts;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function analyzeAudio(input: Float32Array, sampleRate: number): Analysis {
  const x = resample(input, sampleRate, SR);
  const durationMs = Math.round((input.length / sampleRate) * 1000);
  let peak = 0;
  let sq = 0;
  for (let i = 0; i < x.length; i++) {
    const a = Math.abs(x[i]!);
    if (a > peak) peak = a;
    sq += x[i]! * x[i]!;
  }
  const rmsDb = dbfs(Math.sqrt(sq / Math.max(1, x.length)));
  const peakDb = dbfs(peak);

  const base: Analysis = {
    analysisVersion: ANALYSIS_VERSION,
    durationMs,
    sampleRate,
    bpm: 0,
    tempoConfidence: 0,
    beatTimesMs: [],
    downbeatIndex: 0,
    barStartsMs: [],
    barEnergy: [],
    barOnset: [],
    sections: [],
    highlights: [],
    rmsDb,
    peakDb,
    contentStartMs: 0,
    contentEndMs: durationMs,
  };
  if (x.length < N * 8 || peak < 1e-4) return base; // silence or too short to analyse

  const f = computeFeatures(x);
  const onset = normalizeOnset(f.flux);
  const { period, confidence } = estimatePeriodFrames(onset);
  const beatFrames = trackBeats(onset, period);

  let beatsS = beatFrames.map((fr) => fr * FRAME_S + ONSET_LATENCY_S);
  let bpm = 60 / (period * FRAME_S);
  let tempoConfidence = confidence;
  const grid = fitGrid(beatsS);
  if (grid && grid.residual < 0.03) {
    // steady tempo: snap to a clean grid covering the whole track (fills gaps the tracker skipped)
    bpm = 60 / grid.period;
    const first = Math.ceil((0 - grid.t0) / grid.period);
    const last = Math.floor((durationMs / 1000 - grid.t0) / grid.period);
    beatsS = [];
    for (let i = first; i <= last; i++) beatsS.push(grid.t0 + i * grid.period);
    tempoConfidence = Math.max(tempoConfidence, 1 - grid.residual / 0.03);
  } else {
    const ibis = beatsS.slice(1).map((b, i) => b - beatsS[i]!);
    if (ibis.length) bpm = 60 / median(ibis);
  }
  const beatTimesMs = beatsS.filter((t) => t >= 0).map((t) => Math.round(t * 1000));

  // downbeat phase: where do bass accents land modulo 4 beats?
  const bassAtBeat = beatTimesMs.map((ms) => {
    const fr = Math.round((ms / 1000 - ONSET_LATENCY_S) / FRAME_S);
    let m = 0;
    for (let d = -2; d <= 2; d++) m = Math.max(m, f.bassFlux[fr + d] ?? 0);
    return m;
  });
  // second cue: bars start where the harmony changes (bass/chord notes move), not just where drums hit
  const beatFrame = (ms: number) => Math.round((ms / 1000 - ONSET_LATENCY_S) / FRAME_S);
  const changeAtBeat = beatTimesMs.map((ms, i) => {
    const fr = Math.max(0, Math.min(f.frames - 1, beatFrame(ms)));
    const span = Math.max(2, Math.round(((beatTimesMs[i + 1] ?? ms + 500) - ms) / 1000 / FRAME_S / 2));
    let d = 0;
    for (let b = 2; b <= 8; b++) d += Math.abs(mean(f.bands[b]!, fr, Math.min(f.frames, fr + span)) - mean(f.bands[b]!, Math.max(0, fr - span), fr));
    return d;
  });
  const zs = (v: number[]) => {
    const m = mean(v);
    const sd = stddev(v) || 1;
    return v.map((x) => (x - m) / sd);
  };
  const zBass = zs(bassAtBeat);
  const zChange = zs(changeAtBeat);
  const phase = [0, 0, 0, 0];
  beatTimesMs.forEach((_, i) => (phase[i % 4]! += zBass[i]! * 0.5 + zChange[i]!));
  const downbeatIndex = Math.max(0, phase.indexOf(Math.max(...phase)));
  const barStartsMs = beatTimesMs.filter((_, i) => i >= downbeatIndex && (i - downbeatIndex) % 4 === 0);

  // per-bar features
  const frameAt = (ms: number) => Math.max(0, Math.min(f.frames - 1, Math.round(ms / 1000 / FRAME_S)));
  const barFeat: number[][] = [];
  const barEnergy: number[] = [];
  const barOnset: number[] = [];
  for (let b = 0; b < barStartsMs.length; b++) {
    const s = frameAt(barStartsMs[b]!);
    const e = frameAt(barStartsMs[b + 1] ?? durationMs);
    if (e <= s) continue;
    barFeat.push(f.bands.map((band) => mean(band, s, e)));
    barEnergy.push(mean(f.rms, s, e));
    barOnset.push(mean(onset, s, e));
  }
  const maxE = Math.max(...barEnergy, 1e-9);
  const eNorm = barEnergy.map((e) => e / maxE);

  // sections
  const cuts = segmentBars(barFeat, eNorm);
  const bounds = [0, ...cuts, barFeat.length];
  const sections: Section[] = [];
  const sorted = [...eNorm].sort((a, b) => a - b);
  const hiThr = sorted[Math.floor(sorted.length * 0.65)] ?? 0.7;
  const loThr = sorted[Math.floor(sorted.length * 0.35)] ?? 0.4;
  for (let i = 0; i < bounds.length - 1; i++) {
    const a = bounds[i]!;
    const b = bounds[i + 1]!;
    if (b <= a) continue;
    const e = mean(eNorm, a, b);
    const next = bounds[i + 2] !== undefined ? mean(eNorm, b, bounds[i + 2]!) : e;
    let label: Section['label'] = 'verse';
    if (i === 0 && e <= loThr + 0.05) label = 'intro';
    else if (i === bounds.length - 2 && e <= loThr + 0.1) label = 'outro';
    else if (e >= hiThr) label = 'high';
    else if (next > e * 1.2) label = 'build';
    sections.push({ startMs: barStartsMs[a] ?? 0, endMs: barStartsMs[b] ?? durationMs, label, energy: Math.round(e * 100) / 100 });
  }

  // content bounds (skip digital silence)
  let cs = 0;
  while (cs < f.frames && f.rms[cs]! < 0.002) cs++;
  let ce = f.frames - 1;
  while (ce > cs && f.rms[ce]! < 0.002) ce--;

  const analysis: Analysis = {
    ...base,
    bpm: Math.round(bpm * 100) / 100,
    tempoConfidence: Math.round(tempoConfidence * 100) / 100,
    beatTimesMs,
    downbeatIndex,
    barStartsMs,
    barEnergy: eNorm.map((v) => Math.round(v * 1000) / 1000),
    barOnset: barOnset.map((v) => Math.round(v * 1000) / 1000),
    sections,
    contentStartMs: Math.round(cs * FRAME_S * 1000),
    contentEndMs: Math.round((ce + 1) * FRAME_S * 1000),
  };
  analysis.highlights = findHighlights(analysis, eNorm, barOnset, [8, 16]);
  return analysis;
}

/**
 * Highlight windows: loud, busy, phrase-aligned stretches that start on a bar line (ideally at a section entry)
 * and end on a bar line. A heuristic, so the UI always exposes preview + manual correction.
 */
export function findHighlights(a: Analysis, barEnergyNorm: number[], barOnset: number[], lengthsBars: number[] = [8, 16], max = 5): Highlight[] {
  const nb = Math.min(a.barStartsMs.length, barEnergyNorm.length);
  const onsetMax = Math.max(...barOnset, 1e-9);
  const entries = new Set(a.sections.map((s) => a.barStartsMs.indexOf(s.startMs)).filter((i) => i >= 0));
  const cand: (Highlight & { bars: number; from: number })[] = [];
  for (const L of lengthsBars) {
    for (let i = 0; i + L <= nb; i++) {
      const e = mean(barEnergyNorm, i, i + L);
      const o = mean(barOnset, i, i + L) / onsetMax;
      const lead = i > 0 ? mean(barEnergyNorm, Math.max(0, i - 2), i) : e;
      const entry = entries.has(i) ? 0.12 : 0;
      const lift = Math.max(0, e - lead) * 0.3; // arrives with a lift (a "drop")
      const steady = 1 - stddev(barEnergyNorm.slice(i, i + L)) * 1.5;
      const score = 0.55 * e + 0.2 * o + 0.1 * Math.max(0, steady) + entry + lift;
      const startMs = a.barStartsMs[i]!;
      const endMs = a.barStartsMs[i + L] ?? a.contentEndMs;
      cand.push({ startMs, endMs, score: Math.round(score * 1000) / 1000, reason: entry && lift > 0.03 ? 'drop / chorus entry' : entry ? 'section entry' : e > 0.8 ? 'high-energy phrase' : 'steady groove', bars: L, from: i });
    }
  }
  cand.sort((x, y) => y.score - x.score);
  const out: Highlight[] = [];
  for (const c of cand) {
    if (out.length >= max) break;
    if (out.some((h) => c.startMs < h.endMs && c.endMs > h.startMs)) continue; // non-overlapping
    out.push({ startMs: c.startMs, endMs: c.endMs, score: c.score, reason: c.reason });
  }
  return out;
}

export function beatsInRange(a: Analysis, startMs: number, endMs: number): number[] {
  return a.beatTimesMs.filter((t) => t >= startMs && t <= endMs);
}
