// A song's sections with the roles the scene families are written for: intro, verse, chorus, bridge, break and outro, plus
// the energy tags quiet and high. Built on the director's sectionsOf (verse, chorus, break from hooks and vocal gaps), with
// the extra roles derived from position and repetition only. No audio structure analysis is assumed (architecture-plan.md 2.6):
// a "bridge" here is a guess from the lyric layout, and the planner treats it as one.

import { sectionsOf } from '../../kinetic/director';
import type { VisualTimeline } from '../../kinetic/types';
import type { SectionRole } from './data';

export type Section = {
  index: number;
  startMs: number;
  endMs: number;
  /** the role the scene family is chosen for */
  role: SectionRole;
  /** secondary roles a scene family may also match (quiet, high, and the base role when the main one is derived) */
  tags: SectionRole[];
  /** 1 for the first chorus, 2 for the second... 0 when not a chorus */
  chorusOrdinal: number;
  /** lyric lines (indices into tl.scenes) that start inside the section */
  lines: [number, number] | null;
  /** mean line intensity relative to the song, -1..1 (0 = average); 0 for sections without lines */
  energy: number;
};

/** A lead-in before the first line at least this long is an intro of its own. */
export const MIN_INTRO_MS = 4000;
/** A tail after the last line at least this long is an outro of its own. */
export const MIN_OUTRO_MS = 4000;

type TL = Pick<VisualTimeline, 'scenes' | 'gaps' | 'durationMs'>;

export function songSections(tl: TL): Section[] {
  const base = sectionsOf(tl);
  const lines = [...tl.scenes].sort((a, b) => a.startMs - b.startMs);
  const out: Section[] = [];
  if (!lines.length) {
    // no lyrics at all: one long instrumental, split so the scene can still change (every 30 s)
    const n = Math.max(1, Math.round(tl.durationMs / 30000));
    for (let i = 0; i < n; i++) out.push({ index: i, startMs: (tl.durationMs * i) / n, endMs: (tl.durationMs * (i + 1)) / n, role: i === 0 ? 'intro' : 'break', tags: ['break'], chorusOrdinal: 0, lines: null, energy: 0 });
    return out;
  }
  const first = lines[0]!.startMs;
  const lastEnd = Math.max(...lines.map((l) => l.endMs));
  const meanI = lines.reduce((a, l) => a + l.intensity, 0) / lines.length;
  if (first >= MIN_INTRO_MS) out.push({ index: 0, startMs: 0, endMs: first, role: 'intro', tags: ['intro', 'quiet'], chorusOrdinal: 0, lines: null, energy: 0 });
  let chorus = 0;
  base.forEach((s, i) => {
    const startMs = i === 0 && first >= MIN_INTRO_MS ? first : s.startMs;
    const endMs = base[i + 1]?.startMs ?? Math.min(tl.durationMs, Math.max(s.endMs, lastEnd));
    const inside = lines.map((l, k) => ({ l, k })).filter(({ l }) => l.startMs >= startMs && l.startMs < endMs);
    const range: [number, number] | null = inside.length ? [inside[0]!.k, inside[inside.length - 1]!.k] : null;
    const energy = inside.length && meanI > 0 ? Math.max(-1, Math.min(1, inside.reduce((a, { l }) => a + l.intensity, 0) / inside.length / meanI - 1)) * 2.5 : 0;
    const role: SectionRole = s.role === 'chorus' ? 'chorus' : s.role === 'break' ? 'break' : 'verse';
    if (role === 'chorus') chorus++;
    out.push({ index: out.length, startMs, endMs, role, tags: [role], chorusOrdinal: role === 'chorus' ? chorus : 0, lines: range, energy: Math.max(-1, Math.min(1, energy)) });
  });
  // a verse after the second chorus that is followed by another chorus reads as a bridge
  let seen = 0;
  for (let i = 0; i < out.length; i++) {
    const s = out[i]!;
    if (s.role === 'chorus') seen++;
    else if (s.role === 'verse' && seen >= 2 && out.slice(i + 1).some((x) => x.role === 'chorus')) {
      s.role = 'bridge';
      s.tags = ['bridge', 'verse'];
    }
  }
  if (tl.durationMs - lastEnd >= MIN_OUTRO_MS) {
    const last = out[out.length - 1]!;
    if (last.role === 'break' && last.startMs >= lastEnd - 1) {
      last.role = 'outro';
      last.tags = ['outro', 'break'];
    } else {
      last.endMs = lastEnd;
      out.push({ index: out.length, startMs: lastEnd, endMs: tl.durationMs, role: 'outro', tags: ['outro', 'quiet'], chorusOrdinal: 0, lines: null, energy: 0 });
    }
  } else {
    // the closing vocal section still ends the song: let outro scene families take it if they fit
    const last = out[out.length - 1]!;
    if (!last.tags.includes('outro')) last.tags.push('outro');
  }
  for (const s of out) {
    if (s.energy <= -0.25 && !s.tags.includes('quiet')) s.tags.push('quiet');
    if (s.energy >= 0.25 && !s.tags.includes('high')) s.tags.push('high');
  }
  return out.map((s, i) => ({ ...s, index: i }));
}

/** The section at time t (binary search; the first section covers anything before it). */
export function sectionAt(sections: Section[], t: number): Section | null {
  if (!sections.length) return null;
  let lo = 0;
  let hi = sections.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sections[mid]!.startMs <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return sections[ans]!;
}
