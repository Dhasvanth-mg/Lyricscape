// What Turbo changes about a song's Look. It never replaces the art direction: it turns its own dials up.

import type { Look } from './look';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The direction's Look at full intensity: more beat, more emphasis, more glow, a lighter reveal. Colours, type and layout are untouched. */
export function turboLook(look: Look): Look {
  const m = look.motion;
  return {
    ...look,
    key: `${look.key}|turbo`,
    motion: {
      ...m,
      intensity: clamp(m.intensity * 1.3, 0.9, 1.8),
      emphasis: clamp(m.emphasis * 1.4, 0.9, 2),
      beat: clamp(m.beat * 1.7 + 0.25, 0.5, 2.2),
      smooth: clamp(m.smooth * 0.8, 0, 1),
      complexity: clamp(m.complexity + 0.3, 0.6, 1),
      progress: true,
    },
    appearance: { ...look.appearance, glow: clamp(Math.max(look.appearance.glow, 0.55) + 0.15, 0, 1), density: clamp(look.appearance.density + 0.2, 0.5, 1) },
  };
}

/** What the GPU stage should look like for a frame: which backdrop, how strong. Chosen from the song's own mood and the direction's scenery. */
export type StagePlan = { variant: 0 | 1 | 2 | 3 | 4; amount: number; coverMix: number; bloom: number; aberration: number };

export function planStage(opts: { arousal: number; scene: string | null; hasCover: boolean; artAmount: number; hook: boolean }): StagePlan {
  const { arousal, scene, hasCover, artAmount, hook } = opts;
  let variant: StagePlan['variant'] = arousal >= 0.62 ? 1 : 0;
  if (scene === 'bokeh' || scene === 'halo' || scene === 'leaks') variant = 2;
  else if (scene === 'aurora' || scene === 'diffuse' || scene === 'sunset') variant = 0;
  else if (scene === 'structure' || scene === 'poster' || scene === 'graphic') variant = 1;
  return {
    variant,
    amount: clamp(0.75 + arousal * 0.3 + (hook ? 0.12 : 0), 0.6, 1.1),
    coverMix: hasCover ? clamp(artAmount * 0.9, 0.12, 0.62) : 0,
    bloom: clamp(0.22 + arousal * 0.22 + (hook ? 0.1 : 0), 0.2, 0.6),
    aberration: clamp(0.006 + arousal * 0.006 + (hook ? 0.004 : 0), 0.005, 0.02),
  };
}
