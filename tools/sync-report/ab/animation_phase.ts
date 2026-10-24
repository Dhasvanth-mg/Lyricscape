// When does a word actually appear on screen relative to its cue time? (renderer timing, no audio involved)
//   pnpm exec tsx tools/sync-report/ab/animation_phase.ts
import { parseLrc } from '../../../lib/lyrics/parse';
import { compileTimeline } from '../../../lib/kinetic/compile';
import { computeFrame } from '../../../lib/kinetic/frame';
import { STYLE_IDS } from '../../../lib/kinetic/types';

const doc = parseLrc('[00:10.00] <00:10.00>hello <00:10.60>there <00:11.20>my <00:11.70>friend\n[00:16.00] <00:16.00>next <00:16.50>line <00:17.00>of <00:17.40>words');
const env = { width: 1280, height: 720, reducedMotion: false };
const cue = (id: string) => id;
console.log('style'.padEnd(11), 'first visible (alpha>0.05)', ' alpha>=0.5', ' ~settled (alpha>=0.95)   all vs cue time T of the SECOND word of the first line, ms');
for (const style of STYLE_IDS) {
  const tl = compileTimeline(doc, { trackId: 'phase', durationMs: 30_000, palette: ['#ff2e63', '#ffd23f', '#08d9d6', '#1a1a2e'], bpm: 100, style });
  const target = tl.scenes[0]!.words[1]!; // 'there' at 10.60 s
  const T = target.startMs;
  let first = NaN, half = NaN, settled = NaN;
  for (let d = -600; d <= 900; d += 10) {
    const f = computeFrame(tl, T + d, env);
    const w = f.words.find((x) => x.id === cue(target.id));
    const a = w?.alpha ?? 0;
    if (Number.isNaN(first) && a > 0.05) first = d;
    if (Number.isNaN(half) && a >= 0.5) half = d;
    if (Number.isNaN(settled) && a >= 0.95) settled = d;
  }
  console.log(style.padEnd(11), String(first).padStart(10), String(half).padStart(18), String(settled).padStart(22));
}
