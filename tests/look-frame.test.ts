// What the art directions actually put on screen: readability, no piling, no decoration where there should be none,
// the colour hierarchy, held-word illumination and timing that never moves.
import { describe, expect, it } from 'vitest';
import { computeFrame, LEAD_MS } from '@/lib/kinetic/frame';
import { effectiveTreatment, layoutBox } from '@/lib/kinetic/look';
import { STYLES, estimateWidth } from '@/lib/kinetic/styles';
import { contrastRatio } from '@/lib/kinetic/util';
import type { FrameEnv, StyleId } from '@/lib/kinetic/types';
import { parseLrc } from '@/lib/lyrics/parse';
import { DIRECTIONS, NEW_DIRECTION_IDS } from '@/lib/theme/directions';
import { FIXTURES, tagsOf } from '@/lib/theme/fixtures';
import { songVisual } from '@/lib/theme/pipeline';
import type { Tweaks } from '@/lib/theme/types';
import type { Track } from '@/lib/types';

const track = (id: string): Track => ({ id: `fixture:${id}`, provider: 'demo', title: id, artists: ['x'], durationMs: 200000 });
const WORDS = ['City', 'hums', 'in', 'electric', 'blue', 'and', 'the', 'neon', 'never', 'sleeps', 'extraordinary', 'people', 'tonight', 'love'];
const line = (n: number) => `[00:10.00] ${Array.from({ length: n }, (_, i) => WORDS[i % WORDS.length]).join(' ')}\n[00:30.00] end`;
const COVER = { palette: ['#d98b3a', '#a8465a', '#5a2a4a', '#1a0d12'], light: 0.3, vibrance: 0.5 };

function visual(dir: StyleId, lrc: string, tweaks?: Tweaks) {
  return songVisual({ track: track('v'), doc: parseLrc(lrc), tags: [], cover: COVER, song: { pick: { kind: 'direction', id: dir }, tweaks: tweaks ?? {} } });
}
const envFor = (v: ReturnType<typeof visual>, W = 1280, H = 720): FrameEnv => ({ width: W, height: H, reducedMotion: false, look: v.resolved.look, measure: (t, f, s) => estimateWidth(t, v.resolved.look.style.fonts[f], s) });

describe('words never pile up or leave their part of the stage', () => {
  for (const dir of NEW_DIRECTION_IDS) {
    for (const n of [3, 7, 11, 14]) {
      for (const [W, H] of [[1280, 720], [1920, 1080], [900, 900], [390, 844]] as const) {
        it(`${dir}, ${n} words, ${W}x${H}`, () => {
          const v = visual(dir, line(n));
          const env = envFor(v, W, H);
          const scene = v.timeline.scenes[0]!;
          const t = Math.min(Math.max(...scene.words.map((w) => w.startMs)) + 900, scene.endMs - 100);
          const f = computeFrame(v.timeline, t, env);
          const box = layoutBox(v.resolved.look, W, H);
          const boxes = f.words.map((w) => {
            const width = estimateWidth(w.text, v.resolved.look.style.fonts[w.font], w.sizePx) * Math.abs(w.scaleX);
            return { id: w.id, x0: w.x - width / 2, x1: w.x + width / 2, y: w.y, h: w.sizePx * Math.abs(w.scaleY), w: width };
          });
          // no two words on the same row overlap
          for (let i = 0; i < boxes.length; i++)
            for (let j = i + 1; j < boxes.length; j++) {
              const a = boxes[i]!;
              const b = boxes[j]!;
              if (Math.abs(a.y - b.y) > 0.55 * Math.min(a.h, b.h)) continue;
              expect(Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), `${a.id}/${b.id}`).toBeLessThanOrEqual(0.1 * Math.min(a.w, b.w));
            }
          // everything stays on the canvas, and out of the artwork's panel
          const cap = W * 0.94 * box.widthFrac;
          for (const b of boxes) {
            const cx = (b.x0 + b.x1) / 2 + W / 2;
            expect(b.w, b.id).toBeLessThanOrEqual(cap * 1.02 + 1);
            expect(cx - b.w / 2, `${b.id} left edge`).toBeGreaterThanOrEqual(-4);
            expect(cx + b.w / 2, `${b.id} right edge`).toBeLessThanOrEqual(W + 4);
            if (box.cardRect) expect(cx + b.w / 2 <= box.cardRect.x + 6 || cx - b.w / 2 >= box.cardRect.x + box.cardRect.w - 6, `${b.id} clear of the card`).toBe(true);
            if (box.splitRect) expect(cx + b.w / 2 <= box.splitRect.x + 6 || cx - b.w / 2 >= box.splitRect.x + box.splitRect.w - 6, `${b.id} clear of the panel`).toBe(true);
          }
        });
      }
    }
  }
});

describe('artwork treatments respect the room they need', () => {
  it('card, split and collage fall back to a wash on narrow or portrait stages instead of sitting under the words', () => {
    const v = visual('broadsheet', line(5));
    expect(effectiveTreatment(v.resolved.look, 1280, 720)).toBe('card');
    expect(effectiveTreatment(v.resolved.look, 390, 844)).toBe('wash');
    expect(effectiveTreatment(v.resolved.look, 600, 700)).toBe('wash');
    expect(layoutBox(v.resolved.look, 390, 844).widthFrac).toBe(1);
  });
});

describe('words appear on their cue, softly or sharply, and stay readable while they do', () => {
  const LRC = '[00:10.00] <00:10.00>hello <00:10.70>there <00:11.40>my <00:12.10>friend\n[00:18.00] <00:18.00>next <00:18.70>line <00:19.40>of <00:20.10>words';
  for (const dir of NEW_DIRECTION_IDS) {
    it(`${dir}: nothing shows before its lead-in, and the word is solid within 250 ms of its cue`, () => {
      const v = visual(dir, LRC);
      const env = envFor(v);
      const word = v.timeline.scenes[0]!.words[1]!;
      const reveal = v.resolved.look.motion.reveal === 'line';
      const firstShown = reveal ? v.timeline.scenes[0]!.startMs - LEAD_MS : word.startMs - LEAD_MS;
      const before = computeFrame(v.timeline, firstShown - 60, env).words.find((w) => w.id === word.id);
      expect(before, 'before lead-in').toBeUndefined();
      const solid = computeFrame(v.timeline, word.startMs + 250, env).words.find((w) => w.id === word.id)!;
      expect(solid.alpha).toBeGreaterThan(0.9);
    });
  }

  it('the same cue times are used whatever the look: motion style never moves a word in time', () => {
    const times = (dir: StyleId) => visual(dir, LRC).timeline.scenes.flatMap((s) => s.words.map((w) => [w.startMs, w.endMs]));
    const ref = JSON.stringify(times('maximalist'));
    for (const dir of NEW_DIRECTION_IDS) expect(JSON.stringify(times(dir)), dir).toBe(ref);
  });
});

describe('the colour hierarchy', () => {
  const LRC = '[00:10.00] <00:10.00>one <00:10.70>two <00:11.40>three <00:12.50>four\n[00:20.00] <00:20.00>next <00:20.70>line';
  it('line-reveal looks show upcoming words dimly, the word being sung lit, sung words at rest', () => {
    const v = visual('velvet', LRC);
    const C = v.resolved.look.colors!;
    const f = computeFrame(v.timeline, 11_500, envFor(v));
    const byId = Object.fromEntries(f.words.map((w) => [w.id, w]));
    expect(byId['0:0']!.fill).toBe(C.ink); // sung
    expect(byId['0:1']!.fill).toBe(C.ink); // sung
    // being sung, and held long enough that light travels through it: dim base, lit part in the active colour
    expect(byId['0:2']!.fill).toBe(C.inkDim);
    expect(byId['0:2']!.lit).toBe(C.active);
    expect(byId['0:2']!.progress).toBeGreaterThan(0);
    expect(byId['0:3']!.fill).toBe(C.inkDim); // upcoming
  });

  it('every word on every frame is readable against the ground it is drawn on', () => {
    for (const fx of FIXTURES) {
      const v = songVisual({ track: track(fx.id), doc: parseLrc(fx.lrc), tags: tagsOf(fx), cover: { palette: fx.cover.palette, light: 0.4, vibrance: 0.5 } });
      const env = envFor(v);
      for (let t = 0; t < 50_000; t += 700) {
        const f = computeFrame(v.timeline, t, env);
        for (const w of f.words) {
          if (w.alpha < 0.9) continue;
          const lit = w.lit ?? null;
          for (const g of [f.bg.c0, f.bg.c1]) {
            // a word is judged where it is solid; the hierarchy's dimmest colour has its own floor
            expect(contrastRatio(w.fill, g), `${fx.id} t=${t} "${w.text}" ${w.fill} on ${g}`).toBeGreaterThanOrEqual(3.4);
            if (lit) expect(contrastRatio(lit, g)).toBeGreaterThanOrEqual(3.4);
          }
        }
      }
    }
  });

  it('colour does not change per word for activity: within a line, at most ink / dim / active / accent are used', () => {
    const v = songVisual({ track: track('amber-hours'), doc: parseLrc(FIXTURES[0]!.lrc), tags: tagsOf(FIXTURES[0]!), cover: COVER });
    const C = v.resolved.look.colors!;
    const allowed = new Set([C.ink, C.inkDim, C.active, C.accent]);
    for (let t = 8000; t < 60_000; t += 500) for (const w of computeFrame(v.timeline, t, envFor(v)).words) expect(allowed.has(w.fill), `${t} ${w.text} ${w.fill}`).toBe(true);
  });

  it('light travels through a held word as it is sung (and only then)', () => {
    const v = visual('velvet', '[00:10.00] <00:10.00>long <00:12.00>held <00:12.30>note <00:12.60>end\n[00:20.00] <00:20.00>x <00:20.40>y');
    const env = envFor(v);
    const at = (t: number) => computeFrame(v.timeline, t, env).words.find((w) => w.id === '0:0')!;
    expect(at(9_990).progress).toBeUndefined();
    const p1 = at(10_500).progress!;
    const p2 = at(11_500).progress!;
    expect(p1).toBeGreaterThan(0);
    expect(p2).toBeGreaterThan(p1);
    expect(p2).toBeLessThanOrEqual(1);
    expect(at(12_400).progress).toBeUndefined();
    // a short word just switches
    expect(computeFrame(v.timeline, 12_350, env).words.find((w) => w.id === '0:2')!.progress).toBeUndefined();
  });

  it('lines without word timing are never lit word by word (that would claim timing nobody has)', () => {
    const v = songVisual({ track: track('u'), doc: parseLrc('[00:10.00] a line with no word times at all\n[00:16.00] and another one'), tags: [], cover: COVER, song: { pick: { kind: 'direction', id: 'velvet' }, tweaks: {} }, estimateWords: false });
    const C = v.resolved.look.colors!;
    const f = computeFrame(v.timeline, 11_000, envFor(v));
    expect(f.words.length).toBeGreaterThan(0);
    for (const w of f.words) expect([C.ink, C.inkDim]).toContain(w.fill);
    for (const w of f.words) expect(w.progress).toBeUndefined();
  });
});

describe('calm directions stay calm', () => {
  it('no doodles, emoji, ribbons, rings or particles ever, including in instrumental gaps', () => {
    for (const dir of ['velvet', 'ether', 'nocturne', 'artbook', 'stillness', 'broadsheet'] as StyleId[]) {
      const v = visual(dir, '[00:20.00] love in the night sunshine fire\n[00:40.00] the moon the sun the sea');
      const env = envFor(v);
      for (let t = 0; t < 60_000; t += 400) {
        const f = computeFrame(v.timeline, t, env);
        expect(f.doodles.length, `${dir} ${t}`).toBe(0);
        expect(f.icons.length, `${dir} ${t}`).toBe(0);
        expect(f.interlude.ribbons.length + f.interlude.rings.length + f.interlude.particles.length, `${dir} ${t}`).toBe(0);
        expect(f.marquee.length, `${dir} ${t}`).toBe(0);
        expect(f.words.every((w) => !w.mask), `${dir} ${t}`).toBe(true);
      }
    }
  });

  it('they never turn a quick line into single-word cuts, bursts, drops or shakes', () => {
    for (const dir of ['velvet', 'ether', 'nocturne', 'artbook', 'stillness', 'analog', 'broadsheet'] as StyleId[]) {
      const lrc = Array.from({ length: 6 }, (_, i) => `[00:${String(10 + i * 2).padStart(2, '0')}.00] one two three four five six seven eight`).join('\n');
      const v = visual(dir, lrc);
      for (const s of v.timeline.scenes) {
        expect(['cut', 'burst', 'drop', 'wave'], `${dir} ${s.preset}`).not.toContain(s.preset);
        expect(s.words.every((w) => w.effect !== 'shake' && w.effect !== 'mask'), dir).toBe(true);
      }
    }
  });

  it('reduced motion removes entrance motion and disruption in every direction', () => {
    for (const dir of NEW_DIRECTION_IDS) {
      const v = visual(dir, line(8));
      const f = computeFrame(v.timeline, 10_300, { ...envFor(v), reducedMotion: true });
      expect(f.disrupt).toEqual([]);
      for (const w of f.words) {
        expect(w.rotationDeg).toBe(0);
        expect(w.focus).toBeUndefined();
        expect(w.progress).toBeUndefined();
      }
    }
  });
});

describe('listener adjustments reach the frame', () => {
  it('text size and position move the words, alignment moves them left, and none of it changes timing', () => {
    const lrc = line(6);
    const base = visual('rhythm', lrc);
    const t = 10_900;
    const a = computeFrame(base.timeline, t, envFor(base));
    const small = visual('rhythm', lrc, { appearance: { textScale: 0.5 } });
    const b = computeFrame(small.timeline, t, envFor(small));
    expect(Math.max(...b.words.map((w) => w.sizePx))).toBeLessThan(Math.max(...a.words.map((w) => w.sizePx)));
    const low = visual('rhythm', lrc, { appearance: { textY: 0.2 } });
    expect(computeFrame(low.timeline, t, envFor(low)).words[0]!.y - a.words[0]!.y).toBeCloseTo(0.2 * 720, 0);
    const left = visual('rhythm', lrc, { appearance: { align: 'left' } });
    const lw = computeFrame(left.timeline, t, envFor(left)).words;
    expect(Math.min(...lw.map((w) => w.x))).toBeLessThan(Math.min(...a.words.map((w) => w.x)) + 1);
    expect(JSON.stringify(small.timeline.cues)).toBe(JSON.stringify(base.timeline.cues));
  });

  it('removing the grain / glow / decoration sliders really turns them off', () => {
    const v = visual('nocturne', line(6), { appearance: { grain: 0, glow: 0 } });
    expect(v.resolved.look.style.grain).toBe(0);
    expect(v.resolved.look.style.text?.glow).toBeUndefined();
    expect(computeFrame(v.timeline, 10_500, envFor(v)).overlays.grain).toBe(0);
  });

  it('every direction renders a frame at every interesting size without throwing, with its own style table entry', () => {
    for (const id of Object.keys(DIRECTIONS) as StyleId[]) {
      expect(STYLES[id], id).toBeDefined();
      const v = visual(id, line(9));
      for (const [W, H] of [[320, 568], [1280, 720], [3840, 2160]] as const) expect(() => computeFrame(v.timeline, 11_000, envFor(v, W, H))).not.toThrow();
    }
  });
});
