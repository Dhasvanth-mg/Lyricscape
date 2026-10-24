// Entrances, exits, speed and line-start effects chosen in the Studio: they change HOW words move, never WHEN they are shown.
import { describe, expect, it } from 'vitest';
import { computeFrame } from '@/lib/kinetic/frame';
import { EXIT_KINDS, LINE_TRANSITIONS, TRANSITIONS } from '@/lib/kinetic/look';
import { estimateWidth } from '@/lib/kinetic/styles';
import type { FrameEnv, StyleId } from '@/lib/kinetic/types';
import { parseLrc } from '@/lib/lyrics/parse';
import { songVisual } from '@/lib/theme/pipeline';
import type { Tweaks } from '@/lib/theme/types';
import type { Track } from '@/lib/types';

const track: Track = { id: 'fixture:t', provider: 'demo', title: 't', artists: ['x'], durationMs: 120000 };
const LRC = ['[00:02.00] City hums in electric blue', '[00:06.00] and the neon never sleeps', '[00:10.00] City hums in electric blue', '[00:14.00] and the neon never sleeps', '[00:18.00] end'].join('\n');
const COVER = { palette: ['#d98b3a', '#a8465a', '#5a2a4a', '#1a0d12'], light: 0.3, vibrance: 0.5 };

function visual(motion: NonNullable<Tweaks['motion']> = {}, dir: StyleId = 'maximalist') {
  return songVisual({ track, doc: parseLrc(LRC), tags: [], cover: COVER, song: { pick: { kind: 'direction', id: dir }, tweaks: { motion } } });
}
const envFor = (v: ReturnType<typeof visual>, extra: Partial<FrameEnv> = {}): FrameEnv => ({ width: 1280, height: 720, reducedMotion: false, look: v.resolved.look, measure: (t, f, s) => estimateWidth(t, v.resolved.look.style.fonts[f], s), ...extra });
const finite = (n: number) => Number.isFinite(n);

describe('every entrance, exit and line effect draws sane frames', () => {
  const sane = (motion: NonNullable<Tweaks['motion']>) => {
    const v = visual(motion);
    const env = envFor(v);
    for (let t = 0; t < 22000; t += 90) {
      const f = computeFrame(v.timeline, t, env);
      for (const w of f.words) {
        expect(finite(w.x) && finite(w.y) && finite(w.scaleX) && finite(w.scaleY) && finite(w.rotationDeg) && finite(w.skewX) && finite(w.blur) && finite(w.alpha)).toBe(true);
        expect(w.alpha).toBeGreaterThanOrEqual(0);
        expect(w.alpha).toBeLessThanOrEqual(1);
      }
      expect(finite(f.camera.zoom) && finite(f.camera.x) && finite(f.camera.rotationDeg)).toBe(true);
      expect(f.overlays.flash).toBeLessThanOrEqual(0.12);
    }
    const a = JSON.stringify(computeFrame(v.timeline, 12000, env));
    expect(JSON.stringify(computeFrame(v.timeline, 12000, env))).toBe(a);
  };
  for (const transition of TRANSITIONS) it(`enter: ${transition}`, () => sane({ transition }));
  for (const exit of EXIT_KINDS) it(`exit: ${exit}`, () => sane({ exit }));
  for (const lineTransition of LINE_TRANSITIONS) it(`line effect: ${lineTransition}`, () => sane({ lineTransition }));
  it('slow and fast', () => {
    sane({ speed: 0.5 });
    sane({ speed: 2 });
  });
});

describe('entrances differ, and all settle', () => {
  it('different entrances start differently but every word ends up fully visible', () => {
    const starts = new Set<string>();
    for (const transition of TRANSITIONS.filter((t) => t !== 'preset')) {
      const v = visual({ transition });
      const env = envFor(v);
      const scene = v.timeline.scenes[1]!;
      const cue = scene.words[2]!;
      const at = (t: number) => computeFrame(v.timeline, t, env).words.find((w) => w.id === cue.id);
      const early = at(cue.startMs - 30);
      const settled = at(Math.min(cue.startMs + 800, scene.endMs - 80));
      expect(settled?.alpha ?? 0, transition).toBeGreaterThan(0.85);
      if (early) starts.add([early.scaleX.toFixed(2), early.scaleY.toFixed(2), Math.round(early.x), Math.round(early.y), early.alpha.toFixed(2), Math.round(early.rotationDeg)].join('|'));
    }
    expect(starts.size).toBeGreaterThanOrEqual(7);
  });

  it('faster transitions finish sooner', () => {
    const slow = visual({ transition: 'fade', speed: 0.5 });
    const fast = visual({ transition: 'fade', speed: 2 });
    const cue = slow.timeline.scenes[0]!.words[1]!;
    const a = (v: ReturnType<typeof visual>) => computeFrame(v.timeline, cue.startMs + 40, envFor(v)).words.find((w) => w.id === cue.id)!.alpha;
    expect(a(fast)).toBeGreaterThan(a(slow));
  });

  it('a hard-cut exit is instant and a fade exit takes a moment', () => {
    for (const [exit, check] of [['cut', (a: number) => a === 0], ['fade', (a: number) => a > 0 && a < 0.9]] as const) {
      const v = visual({ exit });
      const scene = v.timeline.scenes[0]!;
      const last = scene.words[scene.words.length - 1]!;
      const f = computeFrame(v.timeline, scene.endMs + 100, envFor(v));
      expect(check(f.words.find((w) => w.id === last.id)?.alpha ?? 0), exit).toBe(true);
    }
  });

  it('never changes when words appear: the visible set at each time is the same for every transition', () => {
    const ids = (transition: (typeof TRANSITIONS)[number]) => {
      const v = visual({ transition });
      return [3000, 4500, 8000, 12000].map((t) => computeFrame(v.timeline, t, envFor(v)).visibleWordIds.sort().join(',')).join('|');
    };
    const ref = ids('preset');
    for (const t of ['fade', 'zoom', 'spin', 'glitch', 'scatter']) expect(ids(t as (typeof TRANSITIONS)[number]), t).toBe(ref);
  });
});

describe('line-start effects', () => {
  const start = 6000; // second line
  const at = (motion: NonNullable<Tweaks['motion']>, dt: number, extra: Partial<FrameEnv> = {}) => {
    const v = visual(motion);
    return computeFrame(v.timeline, start + dt, envFor(v, extra));
  };
  it('wipe, iris and bars emit a shape right after a line begins, then finish', () => {
    for (const kind of ['wipe', 'iris', 'bars'] as const) {
      const f = at({ lineTransition: kind }, 120);
      expect(f.transition?.kind).toBe(kind);
      expect(f.transition!.p).toBeGreaterThan(0);
      expect(at({ lineTransition: kind }, 1500).transition).toBeNull();
    }
    expect(at({ lineTransition: 'none' }, 120).transition).toBeNull();
    expect(at({}, 120).transition).toBeNull();
  });
  it('camera effects move the camera', () => {
    const base = at({}, 100).camera;
    expect(at({ lineTransition: 'zoomPunch' }, 100).camera.zoom).toBeGreaterThan(base.zoom + 0.02);
    expect(Math.abs(at({ lineTransition: 'pan' }, 100).camera.x - base.x)).toBeGreaterThan(5);
    expect(Math.abs(at({ lineTransition: 'tilt' }, 100).camera.rotationDeg - base.rotationDeg)).toBeGreaterThan(0.3);
  });
  it('the flash stays under the 12% limit', () => {
    for (let dt = -50; dt < 700; dt += 20) expect(at({ lineTransition: 'flash' }, dt).overlays.flash).toBeLessThanOrEqual(0.12);
    expect(at({ lineTransition: 'flash' }, 40).overlays.flash).toBeGreaterThan(0.05);
  });
  it('are off in reduced motion', () => {
    expect(at({ lineTransition: 'wipe' }, 100, { reducedMotion: true }).transition).toBeNull();
  });
  it('the next-line preview is gone', () => {
    for (let t = 0; t < 22000; t += 500) expect(at({}, t - start).caption).toBeNull();
  });
});
