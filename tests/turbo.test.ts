// The parts of Turbo that do not need a GPU: what changes about a Look, the stage plan, the 2D maths the shaders rely on.
// (The shaders themselves are exercised by the browser checks in docs/stage-modes.md.)
import { describe, expect, it } from 'vitest';
import { MODES, STAGE_MODES, isStageMode } from '@/lib/kinetic/modes';
import { planStage, turboLook } from '@/lib/kinetic/turbo';
import { cameraMatrix, IDENTITY, mul, parseColor, rotate, scale, skewX, toClip, translate } from '@/lib/kinetic/gl/gpu';
import { songVisual } from '@/lib/theme/pipeline';
import { parseLrc } from '@/lib/lyrics/parse';
import { NEW_DIRECTION_IDS } from '@/lib/theme/directions';
import type { Track } from '@/lib/types';

const track: Track = { id: 'fixture:t', provider: 'demo', title: 't', artists: ['x'], durationMs: 120000 };
const lookOf = (dir: (typeof NEW_DIRECTION_IDS)[number]) => songVisual({ track, doc: parseLrc('[00:02.00] a b c d\n[00:06.00] e f g h'), tags: [], cover: { palette: ['#d98b3a', '#a8465a', '#5a2a4a', '#1a0d12'], light: 0.3, vibrance: 0.5 }, song: { pick: { kind: 'direction', id: dir }, tweaks: {} } }).resolved.look;

describe('modes', () => {
  it('Clean and Turbo are defined, one per renderer, each with principles', () => {
    expect(STAGE_MODES).toEqual(['clean', 'turbo']);
    expect(MODES.clean.renderer).toBe('canvas2d');
    expect(MODES.turbo.renderer).toBe('webgl2');
    for (const m of STAGE_MODES) expect(MODES[m].principles.length).toBeGreaterThanOrEqual(4);
    expect(isStageMode('turbo')).toBe(true);
    expect(isStageMode('ultra')).toBe(false);
  });
});

describe('turboLook', () => {
  for (const dir of NEW_DIRECTION_IDS) {
    it(`${dir}: turns the dials up but keeps the direction's colours, type and layout`, () => {
      const base = lookOf(dir);
      const t = turboLook(base);
      expect(t.key).not.toBe(base.key);
      expect(t.colors).toEqual(base.colors);
      expect(t.palette).toEqual(base.palette);
      expect(t.ground).toEqual(base.ground);
      expect(t.layout).toEqual(base.layout);
      expect(t.artwork).toEqual(base.artwork);
      expect(t.style.displayFont).toBe(base.style.displayFont);
      expect(t.motion.intensity).toBeGreaterThanOrEqual(base.motion.intensity);
      expect(t.motion.beat).toBeGreaterThan(base.motion.beat);
      expect(t.motion.intensity).toBeLessThanOrEqual(2);
      expect(t.appearance.glow).toBeGreaterThanOrEqual(base.appearance.glow);
      // idempotent in shape: applying it twice stays within the caps
      expect(turboLook(t).motion.intensity).toBeLessThanOrEqual(2);
    });
  }
});

describe('stage plan', () => {
  it('stays in range and follows the mood and the scenery', () => {
    for (const arousal of [0, 0.3, 0.7, 1]) {
      for (const hook of [false, true]) {
        const p = planStage({ arousal, scene: null, hasCover: true, artAmount: 0.5, hook });
        expect(p.amount).toBeGreaterThan(0.5);
        expect(p.amount).toBeLessThanOrEqual(1.1);
        expect(p.coverMix).toBeGreaterThanOrEqual(0.12);
        expect(p.coverMix).toBeLessThanOrEqual(0.62);
        expect(p.bloom).toBeGreaterThanOrEqual(0.2);
        expect(p.bloom).toBeLessThanOrEqual(0.6);
        expect(p.aberration).toBeGreaterThanOrEqual(0.005);
        expect(p.aberration).toBeLessThanOrEqual(0.02);
      }
    }
    expect(planStage({ arousal: 0.2, scene: null, hasCover: true, artAmount: 0.5, hook: false }).variant).toBe(0);
    expect(planStage({ arousal: 0.9, scene: null, hasCover: true, artAmount: 0.5, hook: false }).variant).toBe(1);
    expect(planStage({ arousal: 0.9, scene: 'bokeh', hasCover: true, artAmount: 0.5, hook: false }).variant).toBe(2);
    expect(planStage({ arousal: 0.5, scene: null, hasCover: false, artAmount: 0.5, hook: false }).coverMix).toBe(0);
  });
  it('a louder moment gets more bloom and fringing', () => {
    const calm = planStage({ arousal: 0.1, scene: null, hasCover: true, artAmount: 0.4, hook: false });
    const loud = planStage({ arousal: 0.95, scene: null, hasCover: true, artAmount: 0.4, hook: true });
    expect(loud.bloom).toBeGreaterThan(calm.bloom);
    expect(loud.aberration).toBeGreaterThan(calm.aberration);
  });
});

describe('affine maths for the shaders', () => {
  const apply = (m: ReturnType<typeof translate>, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const close = (a: [number, number], b: [number, number]) => {
    expect(a[0]).toBeCloseTo(b[0], 6);
    expect(a[1]).toBeCloseTo(b[1], 6);
  };
  it('composes right to left', () => {
    close(apply(mul(translate(10, 0), scale(2, 2)), 1, 1), [12, 2]);
    close(apply(mul(scale(2, 2), translate(10, 0)), 1, 1), [22, 2]);
    close(apply(mul(IDENTITY, rotate(Math.PI / 2)), 1, 0), [0, 1]);
    close(apply(skewX(0.5), 0, 2), [1, 2]);
  });
  it('maps stage pixels to clip space with y flipped', () => {
    const c = toClip(1280, 720);
    close(apply(c, 0, 0), [-1, 1]);
    close(apply(c, 1280, 720), [1, -1]);
    close(apply(c, 640, 360), [0, 0]);
  });
  it('the camera matrix is the identity at rest and zooms about the centre', () => {
    close(apply(cameraMatrix(1280, 720, { zoom: 1, rotationDeg: 0, x: 0, y: 0 }), 100, 50), [100, 50]);
    close(apply(cameraMatrix(1280, 720, { zoom: 2, rotationDeg: 0, x: 0, y: 0 }), 640, 360), [640, 360]);
    close(apply(cameraMatrix(1280, 720, { zoom: 2, rotationDeg: 0, x: 0, y: 0 }), 740, 360), [840, 360]);
    close(apply(cameraMatrix(1280, 720, { zoom: 1, rotationDeg: 0, x: 12, y: -5 }), 640, 360), [652, 355]);
  });
  it('parses colours', () => {
    expect(parseColor('#ff0000')).toEqual([1, 0, 0, 1]);
    expect(parseColor('#0f0')).toEqual([0, 1, 0, 1]);
    expect(parseColor('rgba(255, 0, 255, 0.5)')).toEqual([1, 0, 1, 0.5]);
    expect(parseColor('rgb(0 0 255)')).toEqual([0, 0, 1, 1]);
  });
});
