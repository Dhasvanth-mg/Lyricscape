// The estimated-timing soft mode (Phase 2 INF-04, P4): every style asks how much it may trust a line's timing before it
// animates word by word. Authored word times may drive per-word reveals; estimated ones only a reading-direction sweep across
// the first part of the line (never a karaoke claim); lines without word times show whole. Reading only: nothing here writes
// a cue time (AGENTS.md rule 2).

import type { Scene, WordCue } from '../kinetic/types';

export type LineTiming = 'authored' | 'estimated' | 'line';

export function lineTiming(scene: Pick<Scene, 'words'>): LineTiming {
  const ws = scene.words;
  if (!ws.length || ws.every((w) => w.timing === 'none')) return 'line';
  if (ws.every((w) => (w.timing ?? 'authored') === 'authored')) return 'authored';
  return 'estimated';
}

/** Fraction of a line's time on screen used for an untimed or estimated sweep (Sketch Cards spec: the first 40%). */
export const SWEEP_SHARE = 0.4;

/**
 * When word `i` of a line starts to appear, in ms from the line start. Authored times are used as they are; anything else is
 * spread evenly across `SWEEP_SHARE` of the line, left to right in reading order (so it reads as a sweep, not as timing).
 */
export function revealAt(words: Pick<WordCue, 'startMs' | 'timing'>[], i: number, lineStartMs: number, lineDurMs: number, timing: LineTiming): number {
  if (timing === 'authored') return Math.max(0, words[i]!.startMs - lineStartMs);
  const n = Math.max(1, words.length);
  return ((lineDurMs * SWEEP_SHARE) / n) * i;
}
