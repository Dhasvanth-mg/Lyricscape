// Choosing an art direction for a song. Deterministic: the same identity always gets the same direction, with the reasons attached.
//
// No randomness and no hidden state: every direction scores itself from the song's identity (genre shares, emotional dimensions,
// cover, the listener's taste steers). A direction that needs real genre evidence is not eligible without it, which is what keeps,
// for example, an R&B song from landing on a retro look just because its words are soft. With too little evidence the answer is
// the calm default, and it says so.

import type { GenreFamily } from '../identity/types';
import type { StyleId } from '../kinetic/types';
import { DIRECTIONS } from './directions';
import type { PickContext } from './types';

export const DEFAULT_DIRECTION: StyleId = 'stillness';
const MIN_EVIDENCE_SCORE = 0.9;

export type Choice = {
  direction: StyleId;
  /** the runner-up when it is close: it may lend a little of its motion and texture (never its type or ground) */
  secondary: { id: StyleId; weight: number } | null;
  reasons: string[];
  /** 0..1: margin over the runner-up. Low = a judgement call. */
  confidence: number;
  basis: 'evidence' | 'default' | 'family-default';
  family: GenreFamily | null;
  scores: { id: StyleId; score: number }[];
};

function eligible(id: StyleId, c: PickContext): boolean {
  const d = DIRECTIONS[id]!;
  if (!d.requires) return true;
  const have = d.requires.reduce((a, f) => a + (c.identity?.musical.familyShare[f] ?? 0), 0);
  if (have >= 0.25) return true;
  // the listener can steer toward these without tags
  const t = c.identity?.taste;
  return (id === 'disorder' || id === 'ether') && (t?.experimental ?? 0) >= 0.35;
}

export function chooseDirection(c: PickContext, opts: { familyDefaults?: Partial<Record<GenreFamily, StyleId>> } = {}): Choice {
  const family = c.identity?.musical.primaryGenre ?? null;
  const forced = family ? opts.familyDefaults?.[family] : undefined;
  const scored = (Object.keys(DIRECTIONS) as StyleId[])
    .filter((id) => eligible(id, c))
    .map((id) => ({ id, fit: DIRECTIONS[id]!.fit(c) }))
    .filter((s) => s.fit.score > 0)
    .sort((a, b) => b.fit.score - a.fit.score || (a.id < b.id ? -1 : 1));
  const scores = scored.map((s) => ({ id: s.id, score: s.fit.score }));
  if (forced && DIRECTIONS[forced]) return { direction: forced, secondary: null, reasons: [`your default for ${family}`], confidence: 1, basis: 'family-default', family, scores };
  const top = scored[0];
  if (!top || top.fit.score < MIN_EVIDENCE_SCORE) {
    return { direction: DEFAULT_DIRECTION, secondary: null, reasons: ['not enough information about this song yet: using the calm default'], confidence: 0, basis: 'default', family, scores };
  }
  const second = scored[1];
  const secondary = second && second.fit.score >= 0.72 * top.fit.score ? { id: second.id, weight: Math.round(Math.min(0.35, 0.35 * (second.fit.score / top.fit.score)) * 100) / 100 } : null;
  const reasons = [...top.fit.reasons];
  if (!c.identity || Object.keys(c.identity.musical.familyShare).length === 0) reasons.push('no genre tags: chosen from mood and cover only');
  return { direction: top.id, secondary, reasons, confidence: Math.round(Math.min(1, (top.fit.score - (second?.fit.score ?? 0)) / Math.max(1, top.fit.score)) * 100) / 100, basis: 'evidence', family, scores };
}
