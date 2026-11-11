// Where Konstrukt's steps come from (KON-MOT-TIM-001..006, design-spec.md section 3): beats when the beat grid is trustworthy,
// bars when it is not, otherwise authored word starts, line starts and even line subdivisions, and a 2 s metronome when there
// is nothing at all. The step list is a pure function of the section and the timeline; the scene asks how many steps have
// happened by t and how long ago the last one was, so seeking and export agree with playback.

import type { VisualTimeline } from '../../kinetic/types';
import type { Section } from '../scene/sections';
import { lineTiming } from '../timing';

export type TrigId = `KON-MOT-TIM-00${1 | 2 | 3 | 4 | 5 | 6}`;
export type Tier = 'calm' | 'normal' | 'energetic';
export type Steps = { src: TrigId; times: number[]; hits: boolean[] };

/** no form steps more than 4 times a second (motion.md "Response to pacing") */
export const MIN_GAP_MS = 250;
export const METRONOME_MS = 2000;

/**
 * How much the beat grid can be trusted, 0..1. The timeline has no confidence of its own, so this measures it: the share of
 * beat intervals within 12% of the median interval (a steady grid scores near 1, a scattered one low). Fewer than 8 beats: 0.
 */
export function beatConfidence(beats: number[] | undefined): number {
  if (!beats || beats.length < 8) return 0;
  const iv: number[] = [];
  for (let i = 1; i < beats.length; i++) iv.push(beats[i]! - beats[i - 1]!);
  const med = [...iv].sort((a, b) => a - b)[Math.floor(iv.length / 2)]!;
  if (!(med > 150 && med < 2000)) return 0;
  return iv.filter((d) => Math.abs(d - med) <= med * 0.12).length / iv.length;
}

function thin(times: number[], hits: boolean[]): { times: number[]; hits: boolean[] } {
  const t: number[] = [];
  const h: boolean[] = [];
  for (let i = 0; i < times.length; i++) {
    const last = t[t.length - 1];
    if (last !== undefined && times[i]! - last < MIN_GAP_MS) {
      if (hits[i]) h[h.length - 1] = true;
      continue;
    }
    t.push(times[i]!);
    h.push(hits[i]!);
  }
  return { times: t, hits: h };
}

export function stepsFor(tl: Pick<VisualTimeline, 'scenes' | 'beatTimesMs'>, s: Pick<Section, 'startMs' | 'endMs' | 'lines'>, tier: Tier, reduced: boolean): Steps {
  const beats = tl.beatTimesMs ?? [];
  const conf = beatConfidence(beats);
  const inSec = (t: number) => t >= s.startMs && t < s.endMs;
  const times: number[] = [];
  const hits: boolean[] = [];
  let src: TrigId;
  const lines = s.lines ? tl.scenes.slice(s.lines[0], s.lines[1] + 1) : [];
  if (conf > 0 && (tier !== 'calm' || !lines.length)) {
    // a grid: beats (with downbeat hits) when it is trusted, bars otherwise; reduced motion and calm steps on bars only
    const bars = conf < 0.5 || reduced || tier === 'calm';
    src = bars ? 'KON-MOT-TIM-002' : 'KON-MOT-TIM-001';
    beats.forEach((b, i) => {
      if (!inSec(b)) return;
      const down = i % 4 === 0;
      if (bars && !down) return;
      times.push(b);
      hits.push(!bars && down && tier === 'energetic');
    });
  } else if (lines.length) {
    const t0 = lineTiming(lines[0]!);
    src = t0 === 'authored' && tier !== 'calm' && !reduced ? 'KON-MOT-TIM-003' : t0 === 'line' && tier !== 'calm' && !reduced ? 'KON-MOT-TIM-005' : 'KON-MOT-TIM-004';
    for (const ln of lines) {
      const timing = lineTiming(ln);
      times.push(ln.startMs);
      hits.push(false);
      if (tier === 'calm' || reduced) continue;
      if (timing === 'authored') {
        for (const w of ln.words.slice(1)) if (inSec(w.startMs)) (times.push(w.startMs), hits.push(false));
      } else {
        // even subdivisions: line duration / words, or every 500 ms, whichever is longer; no accents claimed
        const dur = ln.endMs - ln.startMs;
        const step = Math.max(500, dur / Math.max(1, ln.words.length));
        for (let t = ln.startMs + step; t < ln.endMs - 120; t += step) if (inSec(t)) (times.push(t), hits.push(false));
      }
    }
  } else {
    src = 'KON-MOT-TIM-006';
    const every = reduced ? METRONOME_MS * 2 : METRONOME_MS;
    for (let t = s.startMs; t < s.endMs; t += every) (times.push(t), hits.push(false));
  }
  const order = times.map((t, i) => [t, hits[i]!] as const).sort((a, b) => a[0] - b[0]);
  const thinned = thin(
    order.map((x) => x[0]),
    order.map((x) => x[1]),
  );
  return { src, ...thinned };
}

export type StepState = { n: number; last: number; age: number; hitN: number; hit: boolean };

/** how many steps have happened by t (n), when the last was, and how many of them were downbeat hits */
export function stepAt(st: Steps, t: number): StepState {
  let lo = 0;
  let hi = st.times.length - 1;
  let n = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (st.times[mid]! <= t) {
      n = mid + 1;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  const last = n ? st.times[n - 1]! : -Infinity;
  let hitN = 0;
  for (let i = 0; i < n; i++) if (st.hits[i]) hitN++;
  return { n, last, age: t - last, hitN, hit: n > 0 && st.hits[n - 1]! };
}

/** the corner label that says honestly where the tempo comes from (KON-TYP-TYP-006) */
export function tempoLabel(src: TrigId, bpm: number | undefined): string {
  if ((src === 'KON-MOT-TIM-001' || src === 'KON-MOT-TIM-002') && bpm) return `${Math.round(bpm)} bpm`;
  if (src === 'KON-MOT-TIM-006') return 'no tempo';
  return 'tempo from lyrics';
}
