// The listener's steer for ONE song: "this one is more intimate than you think". Explicit and transparent: each press moves
// one number by a fixed step and the result is stored with the song. There is no hidden learning from these.

import { DIM_KEYS, type DimKey } from './types';

export type CorrectionId = 'moreIntimate' | 'lessIntimate' | 'moreEnergetic' | 'lessEnergetic' | 'darker' | 'lighter' | 'warmer' | 'cooler' | 'moreCinematic' | 'moreExperimental' | 'moreMinimal';

export type Corrections = {
  /** dimension -> shift applied on top of the evidence, -0.6..0.6 */
  adjust: Partial<Record<DimKey, number>>;
  /** -1..1 taste axes the art directions respond to */
  taste: { cinematic: number; experimental: number; minimal: number };
  /** what was pressed, newest last (shown so the listener can see what they changed) */
  history: CorrectionId[];
};

export const EMPTY_CORRECTIONS: Corrections = { adjust: {}, taste: { cinematic: 0, experimental: 0, minimal: 0 }, history: [] };

export const CORRECTION_DEFS: { id: CorrectionId; label: string; dim?: DimKey; delta?: number; taste?: keyof Corrections['taste'] }[] = [
  { id: 'moreIntimate', label: 'More intimate', dim: 'intimacy', delta: 0.2 },
  { id: 'moreEnergetic', label: 'More energetic', dim: 'energy', delta: 0.2 },
  { id: 'lessEnergetic', label: 'Less energetic', dim: 'energy', delta: -0.2 },
  { id: 'darker', label: 'Darker', dim: 'valence', delta: -0.2 },
  { id: 'lighter', label: 'Lighter', dim: 'valence', delta: 0.2 },
  { id: 'warmer', label: 'Warmer', dim: 'warmth', delta: 0.2 },
  { id: 'cooler', label: 'Cooler', dim: 'warmth', delta: -0.2 },
  { id: 'moreCinematic', label: 'More cinematic', taste: 'cinematic', delta: 0.35 },
  { id: 'moreExperimental', label: 'More experimental', taste: 'experimental', delta: 0.35 },
  { id: 'moreMinimal', label: 'More minimal', taste: 'minimal', delta: 0.35 },
  { id: 'lessIntimate', label: 'Less intimate', dim: 'intimacy', delta: -0.2 },
];

const clampTo = (n: number, lim: number) => Math.min(lim, Math.max(-lim, n));
const round = (n: number) => Math.round(n * 100) / 100;

export function applyCorrection(cur: Corrections | null | undefined, id: CorrectionId): Corrections {
  const c: Corrections = cur ? { adjust: { ...cur.adjust }, taste: { ...cur.taste }, history: [...cur.history] } : { adjust: {}, taste: { ...EMPTY_CORRECTIONS.taste }, history: [] };
  const def = CORRECTION_DEFS.find((d) => d.id === id);
  if (!def || def.delta === undefined) return c;
  if (def.dim) c.adjust[def.dim] = round(clampTo((c.adjust[def.dim] ?? 0) + def.delta, 0.6));
  if (def.taste) c.taste[def.taste] = round(clampTo(c.taste[def.taste] + def.delta, 1));
  c.history.push(id);
  if (c.history.length > 24) c.history.shift();
  return c;
}

export const hasCorrections = (c: Corrections | null | undefined): boolean => !!c && (c.history.length > 0 || DIM_KEYS.some((k) => (c.adjust[k] ?? 0) !== 0));
