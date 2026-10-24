// When does a word LAND (reach its resting position, size and opacity) relative to its cue time, per entrance preset?
//   pnpm exec tsx tools/sync-report/ab/preset_landing.ts
import { parseLrc } from '../../../lib/lyrics/parse';
import { compileTimeline } from '../../../lib/kinetic/compile';
import { computeFrame } from '../../../lib/kinetic/frame';
import { PRESET_IDS } from '../../../lib/kinetic/types';

const doc = parseLrc('[00:10.00] <00:10.00>hello <00:10.60>there <00:11.20>my <00:11.70>friend\n[00:16.00] <00:16.00>next <00:16.50>line <00:17.00>of <00:17.40>words');
const env = { width: 1280, height: 720, reducedMotion: false };
console.log('preset   first visible   half visible   LANDED (still within 1% of rest)   ms relative to the word\'s cue time');
for (const preset of PRESET_IDS) {
  const tl = compileTimeline(doc, { trackId: 'land', durationMs: 30_000, palette: ['#ff2e63', '#ffd23f', '#08d9d6', '#1a1a2e'], bpm: 100, style: 'maximalist', seed: 7 });
  tl.scenes[0]!.preset = preset;
  const target = tl.scenes[0]!.words[1]!;
  const T = target.startMs;
  const rest = computeFrame(tl, T + 120, env).words.find((w) => w.id === target.id); // pose a moment after the cue
  const final = computeFrame(tl, T + 1300, env).words.find((w) => w.id === target.id);
  if (!rest || !final) continue;
  let first = NaN, half = NaN, landed = NaN;
  for (let d = -400; d <= 1300; d += 10) {
    const w = computeFrame(tl, T + d, env).words.find((x) => x.id === target.id);
    const a = w?.alpha ?? 0;
    if (Number.isNaN(first) && a > 0.05) first = d;
    if (Number.isNaN(half) && a >= 0.5) half = d;
    if (w && !Number.isNaN(first)) {
      const near = Math.abs(w.x - final.x) < 0.012 * env.width && Math.abs(w.y - final.y) < 0.012 * env.height && Math.abs(w.scaleX / final.scaleX - 1) < 0.12 && Math.abs(w.rotationDeg - final.rotationDeg) < 2 && a > 0.95;
      if (near && Number.isNaN(landed)) landed = d;
      if (!near) landed = NaN;
    }
  }
  console.log(preset.padEnd(8), String(first).padStart(10), String(half).padStart(14), String(landed).padStart(22));
}
