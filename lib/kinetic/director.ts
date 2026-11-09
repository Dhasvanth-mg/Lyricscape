// The auto director: Turbo changes scene with the song's structure, like a VJ. Verses keep the person's chosen scene,
// choruses cut to a partner scene, long instrumental breaks to a third. Each cut lands on the beat nearest the section's start.
//
// Pure and deterministic: the plan comes from the timeline alone, and the scene at a moment is a lookup by time, so a seek,
// a replay and an export all show the same scene at the same moment (AGENTS.md rule 3).
//
// What counts as a chorus: a run of lines the compiler marked as hooks (a line that appears twice or more). That is a guess from
// the lyrics, not a structural analysis of the audio; songs whose chorus never repeats a line get no chorus cuts.

import type { VisualTimeline } from './types';
import type { TurboStyleId } from './turbo';

export type SectionRole = 'verse' | 'chorus' | 'break';
export type DirectorCut = { atMs: number; style: TurboStyleId; role: SectionRole };
export type DirectorPlan = { home: TurboStyleId; cuts: DirectorCut[] };

/** Chorus partner for each home scene: chosen for contrast (calm vs loud, text-led vs picture-led). */
export const CHORUS_PARTNER: Record<TurboStyleId, TurboStyleId> = { liquid: 'nebula', terminal: 'ascii', sketch: 'acid', nebula: 'liquid', acid: 'sketch', ascii: 'terminal' };
/** Instrumental breaks: a scene that carries no lyrics well. */
const BREAK_SCENE: Record<TurboStyleId, TurboStyleId> = { liquid: 'acid', terminal: 'liquid', sketch: 'liquid', nebula: 'acid', acid: 'liquid', ascii: 'liquid' };

/** A section shorter than this is folded into its neighbour: cutting more often than this reads as flicker, not direction. */
export const MIN_SECTION_MS = 8000;
/** A gap in the vocals at least this long is a break of its own. */
export const MIN_BREAK_MS = 6000;

type Seg = { startMs: number; endMs: number; role: SectionRole };

export function sectionsOf(tl: Pick<VisualTimeline, 'scenes' | 'gaps' | 'durationMs'>): Seg[] {
  const segs: Seg[] = [];
  const push = (s: Seg) => {
    const last = segs[segs.length - 1];
    if (last && last.role === s.role) last.endMs = Math.max(last.endMs, s.endMs);
    else segs.push({ ...s });
  };
  const scenes = [...tl.scenes].sort((a, b) => a.startMs - b.startMs);
  const breaks = tl.gaps.filter((g) => g.endMs - g.startMs >= MIN_BREAK_MS);
  let bi = 0;
  for (const sc of scenes) {
    while (bi < breaks.length && breaks[bi]!.startMs <= sc.startMs) push({ ...breaks[bi++]!, role: 'break' });
    push({ startMs: sc.startMs, endMs: sc.endMs, role: sc.hook ? 'chorus' : 'verse' });
  }
  while (bi < breaks.length) push({ ...breaks[bi++]!, role: 'break' });
  if (!segs.length) return [];
  // the scene before the first section, and the space between sections, belong to the section that follows
  segs[0]!.startMs = 0;
  // fold sections that are too short to deserve a cut into the one before (or, for the first, the one after)
  let changed = true;
  while (changed && segs.length > 1) {
    changed = false;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i]!;
      const next = segs[i + 1];
      const len = (next ? next.startMs : Math.max(s.endMs, tl.durationMs)) - s.startMs;
      if (len >= MIN_SECTION_MS) continue;
      if (i > 0) segs.splice(i, 1);
      else if (next) {
        next.startMs = s.startMs;
        segs.splice(0, 1);
      } else continue;
      // neighbours with the same role are now one section
      for (let j = segs.length - 1; j > 0; j--) if (segs[j]!.role === segs[j - 1]!.role) segs.splice(j, 1);
      changed = true;
      break;
    }
  }
  return segs;
}

/** The beat nearest `t` (within half a beat), else `t`. */
export function snapToBeat(t: number, beats: number[] | undefined): number {
  if (!beats?.length || t <= 0) return t;
  let lo = 0;
  let hi = beats.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (beats[mid]! < t) lo = mid + 1;
    else hi = mid;
  }
  const cands = [beats[lo - 1], beats[lo]].filter((b): b is number => b !== undefined);
  const best = cands.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a));
  const period = beats.length > 1 ? (beats[beats.length - 1]! - beats[0]!) / (beats.length - 1) : Infinity;
  return Math.abs(best - t) <= period / 2 ? best : t;
}

export function planDirector(tl: Pick<VisualTimeline, 'scenes' | 'gaps' | 'durationMs' | 'beatTimesMs'>, home: TurboStyleId): DirectorPlan {
  const styleFor = (r: SectionRole): TurboStyleId => (r === 'verse' ? home : r === 'chorus' ? CHORUS_PARTNER[home] : BREAK_SCENE[home]);
  const cuts: DirectorCut[] = [];
  for (const s of sectionsOf(tl)) {
    const style = styleFor(s.role);
    if (cuts.length && cuts[cuts.length - 1]!.style === style) continue;
    const at = cuts.length ? Math.round(snapToBeat(s.startMs, tl.beatTimesMs)) : 0;
    // snapping must never reorder cuts
    if (cuts.length && at <= cuts[cuts.length - 1]!.atMs) continue;
    cuts.push({ atMs: at, style, role: s.role });
  }
  if (!cuts.length) cuts.push({ atMs: 0, style: home, role: 'verse' });
  return { home, cuts };
}

/** The scene at time t. */
export function styleAt(plan: DirectorPlan, t: number): TurboStyleId {
  const c = plan.cuts;
  let lo = 0;
  let hi = c.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (c[mid]!.atMs <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return c[ans]?.style ?? plan.home;
}
