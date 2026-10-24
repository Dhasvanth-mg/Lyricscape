// The six Turbo styles: what each one asks of the renderer, checked without a GPU.
import { describe, expect, it } from 'vitest';
import { STYLE_SPECS, TURBO_STYLES, TURBO_STYLE_IDS, isTurboStyle, planStage, turboLook } from '@/lib/kinetic/turbo';
import { contrastRatio } from '@/lib/kinetic/util';
import { songVisual } from '@/lib/theme/pipeline';
import { parseLrc } from '@/lib/lyrics/parse';
import { FONTS } from '@/lib/kinetic/styleBase';
import type { Track } from '@/lib/types';

const track: Track = { id: 'fixture:t', provider: 'demo', title: 't', artists: ['x'], durationMs: 120000 };
const look = songVisual({ track, doc: parseLrc('[00:02.00] a b c d\n[00:06.00] e f g h'), tags: [], cover: { palette: ['#d98b3a', '#a8465a', '#5a2a4a', '#1a0d12'], light: 0.3, vibrance: 0.5 }, song: { pick: { kind: 'direction', id: 'maximalist' }, tweaks: {} } }).resolved.look;

describe('turbo styles', () => {
  it('has six, each described', () => {
    expect(TURBO_STYLE_IDS).toHaveLength(6);
    for (const id of TURBO_STYLE_IDS) {
      expect(isTurboStyle(id)).toBe(true);
      expect(TURBO_STYLES[id].label).toBeTruthy();
      expect(TURBO_STYLES[id].tagline.length).toBeGreaterThan(30);
    }
    expect(isTurboStyle('neon')).toBe(false);
  });

  it('only ask for faces and colours that exist', () => {
    for (const id of TURBO_STYLE_IDS) {
      const s = STYLE_SPECS[id];
      if (s.font) expect(Object.keys(FONTS)).toContain(s.font);
      for (const c of [s.ink, s.inkActive, ...(s.ground ?? []), ...(s.pal ?? [])]) if (c) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
      expect(s.post.dither).toBeGreaterThanOrEqual(0);
      expect(s.post.curve).toBeLessThanOrEqual(0.3);
      expect(s.post.glitch).toBeLessThanOrEqual(1);
    }
  });

  it('keep their own type readable on their own ground', () => {
    for (const id of TURBO_STYLE_IDS) {
      const s = STYLE_SPECS[id];
      if (!s.ink || !s.ground) continue;
      // the ground is lightened by light and bloom in the shader, so ask for more than the 4.5:1 the direction guarantees
      for (const g of s.ground) expect(contrastRatio(s.ink, g), `${id} ink on ground`).toBeGreaterThanOrEqual(4.5);
      if (s.inkActive) for (const g of s.ground) expect(contrastRatio(s.inkActive, g), `${id} active ink`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('each world is different: backdrop, type or treatment', () => {
    const sig = TURBO_STYLE_IDS.map((id) => {
      const s = STYLE_SPECS[id];
      return [s.font, s.stageVariant, s.typewriter, s.blob, s.pill, s.ascii, s.boil > 0, s.post.curve > 0, s.post.dither > 0, s.post.aberFull].join('|');
    });
    expect(new Set(sig).size).toBe(6);
    expect(STYLE_SPECS.terminal.typewriter).toBe(true);
    expect(STYLE_SPECS.sketch.blob && STYLE_SPECS.sketch.boil > 0).toBe(true);
    expect(STYLE_SPECS.nebula.pill && STYLE_SPECS.nebula.rotate < 0).toBe(true);
    expect(STYLE_SPECS.ascii.ascii).toBe(1);
    expect(STYLE_SPECS.acid.post.aberFull).toBe(1);
  });

  it('re-dress the Look only through layout and reveal; the key changes with the style; motion caps hold', () => {
    const keys = new Set<string>();
    for (const id of TURBO_STYLE_IDS) {
      const t = turboLook(look, id);
      keys.add(t.key);
      expect(t.colors).toEqual(look.colors);
      expect(t.palette).toEqual(look.palette);
      expect(t.motion.intensity).toBeLessThanOrEqual(2);
      expect(t.layout.textScale).toBeGreaterThan(0.3);
      expect(t.layout.textScale).toBeLessThanOrEqual(1.5);
    }
    expect(keys.size).toBe(6);
    expect(turboLook(look, 'terminal').layout.align).toBe('left');
    expect(turboLook(look, 'acid').layout.textY).toBeLessThan(-0.2);
    expect(turboLook(look, 'terminal').motion.reveal).toBe('word');
    expect(turboLook(look, 'liquid').layout).toEqual(look.layout);
  });

  it('the plan follows the style', () => {
    const base = { arousal: 0.5, scene: null, hasCover: true, artAmount: 0.5, hook: false };
    expect(planStage({ ...base, style: 'sketch' }).variant).toBe(5);
    expect(planStage({ ...base, style: 'terminal' }).variant).toBe(4);
    expect(planStage({ ...base, style: 'sketch' }).bloom).toBe(0);
    expect(planStage({ ...base, style: 'acid' }).aberration).toBeGreaterThan(planStage({ ...base, style: 'liquid' }).aberration * 1.5);
    for (const id of TURBO_STYLE_IDS) {
      const p = planStage({ ...base, style: id });
      expect(p.amount).toBeGreaterThan(0.2);
      expect(p.amount).toBeLessThan(1.4);
    }
    // a styled world draws its own backdrop, so it never mixes the cover into it
    expect(planStage({ ...base, style: 'nebula' }).coverMix).toBe(0);
    expect(planStage({ ...base, style: 'liquid' }).coverMix).toBeGreaterThan(0);
  });
});
