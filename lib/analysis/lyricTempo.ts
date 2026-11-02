// Tempo and beat phase from the timing of the lyrics alone (no audio): sung lines start on beats, half beats and quarter beats far
// more often than chance, so the grid that most onsets fall on is the song's pulse. Word-synced lyrics (every word stamped by a person)
// pin it down well; line-synced lyrics (a person tapped each line) are loose, so the confidence is lower and often too low to use.
//
// For every candidate tempo and phase the grid has points every quarter beat (a beat counts most, then a half beat, then a quarter);
// an onset scores by how close it is to a grid point. A finer grid is always easier to hit, so each candidate is scored by how much it
// beats what a random onset would get on that same grid. The confidence says how far the best candidate stands above what the best
// candidate of the same onsets, slid randomly out of place, would reach.

import type { LyricDocument } from '../types';

export type LyricTempo = {
  bpm: number;
  /** the time (ms) of one beat, within the first beat of the song */
  phaseMs: number;
  /** 0..1 */
  confidence: number;
  onsets: number;
  /** how many standard deviations above chance (for the curious) */
  z: number;
};

type Onset = { t: number; w: number; sigma: number };

const SUB_W = [1, 0.45, 0.75, 0.45]; // beat, quarter, half, quarter (by position within the beat)

export function onsetsOf(doc: LyricDocument): Onset[] {
  const out: Onset[] = [];
  for (const line of doc.lines) {
    if (!(line.startMs >= 0)) continue;
    out.push({ t: line.startMs, w: 1, sigma: 80 });
    if ((line.wordTiming ?? 'authored') === 'authored' && line.words.length > 1) for (let i = 1; i < line.words.length; i++) out.push({ t: line.words[i]!.startMs, w: 0.8, sigma: 45 });
  }
  out.sort((a, b) => a.t - b.t);
  // two onsets closer than 40 ms are one event
  const merged: Onset[] = [];
  for (const o of out) {
    const last = merged[merged.length - 1];
    if (last && o.t - last.t < 40) last.w = Math.max(last.w, o.w);
    else merged.push({ ...o });
  }
  return merged;
}

function bestFit(onsets: Onset[], bpms: number[], phaseStepMs: number): { bpm: number; phase: number; score: number } {
  let best = { bpm: 0, phase: 0, score: -Infinity };
  for (const bpm of bpms) {
    const P = 60000 / bpm;
    const q = P / 4;
    const gauss = 0.5;
    const steps = Math.max(4, Math.round(P / phaseStepMs));
    // what a random onset would score on this grid (so a finer grid gets no free credit)
    let wsum = 0;
    for (const o of onsets) wsum += o.w;
    const meanSub = (SUB_W[0]! + SUB_W[1]! + SUB_W[2]! + SUB_W[3]!) / 4;
    for (let s = 0; s < steps; s++) {
      const phase = (s / steps) * P;
      let score = 0;
      for (const o of onsets) {
        const x = (o.t - phase) / q;
        const k = Math.round(x);
        const d = (x - k) * q;
        const sub = ((k % 4) + 4) % 4;
        const g = SUB_W[sub]! * Math.exp(-gauss * (d / o.sigma) * (d / o.sigma));
        const chance = (meanSub * o.sigma * Math.sqrt(2 * Math.PI / (2 * gauss))) / q; // average closeness of a random onset
        score += o.w * (g - chance);
      }
      if (score > best.score) best = { bpm, phase, score };
    }
  }
  return best;
}

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

const prior = (bpm: number) => Math.exp(-0.5 * Math.pow(Math.log2(bpm / 112) / 0.6, 2));

/** Below this the estimate is not used (it says "cannot tell"). */
export const MIN_LYRIC_CONFIDENCE = 0.35;

function fitOnsets(onsets: Onset[], opts: { fixedBpm?: number }): { bpm: number; phase: number; z: number } {
  const bpms: number[] = [];
  if (opts.fixedBpm) for (let b = opts.fixedBpm * 0.985; b <= opts.fixedBpm * 1.015; b += opts.fixedBpm * 0.0025) bpms.push(b);
  else for (let b = 60; b <= 200; b += 0.5) bpms.push(b);
  const weigh = (bpm: number, score: number) => (opts.fixedBpm ? score : score * prior(bpm));

  // score every tempo, keep the best phase of each, then apply the preference for felt tempos
  let best = { bpm: 0, phase: 0, score: -Infinity };
  for (const bpm of bpms) {
    const f = bestFit(onsets, [bpm], 12);
    const adj = weigh(bpm, f.score);
    if (adj > best.score) best = { bpm, phase: f.phase, score: adj };
  }
  const fine: number[] = [];
  for (let b = best.bpm - 0.6; b <= best.bpm + 0.6; b += 0.05) fine.push(b);
  const rf = bestFit(onsets, fine, 4);

  // the same onsets, each slid by a random amount: what the best candidate reaches by chance
  const r = rng(12345);
  const nulls: number[] = [];
  const spanBpms = opts.fixedBpm ? bpms : bpms.filter((_, i) => i % 2 === 0);
  for (let n = 0; n < 10; n++) {
    const shifted = onsets.map((o) => ({ ...o, t: o.t + (r() - 0.5) * 1000 }));
    let nb = -Infinity;
    for (const bpm of spanBpms) nb = Math.max(nb, weigh(bpm, bestFit(shifted, [bpm], 24).score));
    nulls.push(nb);
  }
  const mean = nulls.reduce((a, b) => a + b, 0) / nulls.length;
  const sd = Math.sqrt(nulls.reduce((a, b) => a + (b - mean) ** 2, 0) / nulls.length) || 1e-6;
  return { bpm: rf.bpm, phase: rf.phase, z: (best.score - mean) / sd };
}

/**
 * @param fixedBpm when a tempo is already known (an online lookup), only the phase is searched (within 1.5%)
 * Two readings are tried and the clearer one is kept: every onset (lines and authored words), and line starts alone (lines are often
 * placed on bars while the words between them follow the singer's phrasing, not the grid).
 */
export function estimateTempoFromLyrics(doc: LyricDocument, opts: { fixedBpm?: number; minOnsets?: number } = {}): LyricTempo | null {
  const all = onsetsOf(doc);
  if (all.length < (opts.minOnsets ?? 14)) return null;
  const lines = all.filter((o) => o.w === 1);
  const sets = lines.length >= 8 && lines.length < all.length ? [all, lines] : [all];
  let best: { bpm: number; phase: number; z: number } | null = null;
  for (const set of sets) {
    const f = fitOnsets(set, opts);
    if (!best || f.z > best.z) best = f;
  }
  if (!best) return null;
  const P = 60000 / best.bpm;
  return { bpm: Math.round(best.bpm * 100) / 100, phaseMs: Math.round(((best.phase % P) + P) % P), confidence: Math.max(0, Math.min(1, (best.z - 2.5) / 5)), onsets: all.length, z: Math.round(best.z * 10) / 10 };
}
