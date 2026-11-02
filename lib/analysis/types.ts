// What audio analysis produces and what the song index stores. Numbers only: the audio itself is never kept.

import { z } from 'zod';

/** Onset strength is stored at this fixed step whatever the sample rate (about 43 per second). */
export const ONSET_HOP_MS = 23.2;
/** Loudness is stored at this step (10 per second). */
export const ENERGY_STEP_MS = 100;
export const AUDIO_FEATURES_VERSION = 1;

export const audioFeaturesSchema = z.object({
  version: z.literal(AUDIO_FEATURES_VERSION),
  /** 'file' = decoded audio we were given (fast, complete); 'capture' = heard while it played (real time, may have gaps) */
  source: z.enum(['file', 'capture']),
  durationMs: z.number().int().positive().max(3 * 3600_000),
  /** onset strength, one byte per ONSET_HOP_MS, base64 */
  onset: z.string().max(400_000),
  /** covered stretches of the song as [startMs, endMs] pairs: what has actually been heard */
  covered: z.array(z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])).max(400),
  /** loudness, one byte per ENERGY_STEP_MS (0 = silence, 255 = full scale), base64 */
  energy: z.string().max(120_000),
  bpm: z.number().min(40).max(260).nullable(),
  /** 0..1, how clearly the pulse stands out; below about 0.2 it is not trusted */
  bpmConfidence: z.number().min(0).max(1),
  beatTimesMs: z.array(z.number().int().nonnegative()).max(4000),
  /** mean loudness in dBFS (RMS) and brightness 0..1 (spectral centroid) */
  loudnessDb: z.number().min(-120).max(6).nullable(),
  brightness: z.number().min(0).max(1).nullable(),
  analyzedAt: z.number().int().nonnegative(),
});
export type AudioFeatures = z.infer<typeof audioFeaturesSchema>;

/** The least we need to trust a tempo: this much of the song heard (ms) and this confidence. */
export const MIN_COVERED_MS = 20_000;
export const MIN_CONFIDENCE = 0.2;

export const hasTempo = (f: AudioFeatures | null | undefined): f is AudioFeatures & { bpm: number } => !!f && f.bpm !== null && f.bpmConfidence >= MIN_CONFIDENCE && f.beatTimesMs.length >= 8;

/** Share of the song heard, 0..1. */
export function coverage(f: Pick<AudioFeatures, 'covered' | 'durationMs'>): number {
  let ms = 0;
  for (const [a, b] of f.covered) ms += Math.max(0, b - a);
  return Math.min(1, ms / Math.max(1, f.durationMs));
}
