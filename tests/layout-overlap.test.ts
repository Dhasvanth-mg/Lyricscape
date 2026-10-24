// Readability: words of a line must not pile on top of each other once they have landed.
import { describe, expect, it } from 'vitest';
import { compileTimeline } from '@/lib/kinetic/compile';
import { computeFrame } from '@/lib/kinetic/frame';
import { STYLES, estimateWidth } from '@/lib/kinetic/styles';
import { parseLrc } from '@/lib/lyrics/parse';
import type { FrameEnv, PresetId, StyleId } from '@/lib/kinetic/types';

const WORDS = ['City', 'hums', 'in', 'electric', 'blue', 'and', 'the', 'neon', 'never', 'sleeps', 'extraordinary', 'people', 'tonight', 'love'];
const line = (n: number) => `[00:10.00] ${Array.from({ length: n }, (_, i) => WORDS[i % WORDS.length]).join(' ')}\n[00:30.00] end`;

function overlaps(style: StyleId, preset: PresetId, n: number, wordLevel: boolean) {
  const env: FrameEnv = { width: 1280, height: 720, reducedMotion: false, measure: (text, font, size) => estimateWidth(text, STYLES[style].fonts[font], size) };
  const tl = compileTimeline(parseLrc(line(n)), { trackId: 'ov', durationMs: 60_000, palette: ['#ff2e63', '#ffd23f', '#08d9d6', '#1a1a2e'], bpm: 100, style, estimateWords: wordLevel, seed: 11 });
  tl.scenes[0]!.preset = preset;
  const scene = tl.scenes[0]!;
  const t = Math.max(...scene.words.map((w) => w.startMs)) + 800; // everything has landed
  const f = computeFrame(tl, Math.min(t, scene.endMs - 100), env);
  const boxes = f.words.map((w) => {
    const width = estimateWidth(w.text, STYLES[style].fonts[w.font], w.sizePx) * Math.abs(w.scaleX);
    return { id: w.id, x0: w.x - width / 2, x1: w.x + width / 2, y: w.y, h: w.sizePx * Math.abs(w.scaleY), w: width };
  });
  const bad: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!;
      const b = boxes[j]!;
      if (Math.abs(a.y - b.y) > 0.55 * Math.min(a.h, b.h)) continue; // different rows
      const inter = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      if (inter > 0.1 * Math.min(a.w, b.w)) bad.push(`${a.id}/${b.id} overlap ${Math.round(inter)}px`);
    }
  }
  return bad;
}

describe('landed words do not overlap', () => {
  const presets: PresetId[] = ['ticker', 'burst', 'drop', 'wave', 'stack'];
  const styles: StyleId[] = ['maximalist', 'gloss', 'film', 'aurora', 'neon'];
  for (const preset of presets) {
    for (const n of [3, 7, 11, 14]) {
      it(`${preset}, ${n} words, across styles`, () => {
        for (const style of styles) {
          for (const wordLevel of [true, false]) {
            const bad = overlaps(style, preset, n, wordLevel);
            expect(bad, `${style} ${preset} ${n}w wordLevel=${wordLevel}`).toEqual([]);
          }
        }
      });
    }
  }
});
