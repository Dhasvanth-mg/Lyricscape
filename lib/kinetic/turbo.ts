// What Turbo changes about a song's Look, and the six Turbo styles. It never replaces the art direction's timing or readability:
// it turns its own dials up. The default style (liquid light) is the direction itself at full intensity. The other five are
// reference scenes (lib/kinetic/gl/scenes): each draws its own whole picture, modelled on one reference clip.

import type { Look } from './look';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ---- styles ---------------------------------------------------------------------------------------------------------------------
export const TURBO_STYLE_IDS = ['liquid', 'terminal', 'sketch', 'nebula', 'acid', 'ascii'] as const;
export type TurboStyleId = (typeof TURBO_STYLE_IDS)[number];
export const isTurboStyle = (v: unknown): v is TurboStyleId => (TURBO_STYLE_IDS as readonly unknown[]).includes(v);
/** every style except the default liquid light is a reference scene that draws its own picture */
export const isSceneStyle = (v: TurboStyleId) => v !== 'liquid';

export const TURBO_STYLES: Record<TurboStyleId, { label: string; tagline: string }> = {
  liquid: { label: 'Liquid light', tagline: "The song's own palette as flowing light, rays and bokeh, with beat shockwaves." },
  terminal: { label: 'Code screens', tagline: 'Each lyric is typed into a different screen the camera flies through: a code editor, an error list, a login form, red error banners, a green console.' },
  sketch: { label: 'Sketch cards', tagline: 'Every line becomes a hand-lettered, dithered poster card with colour highlights and a little drawing.' },
  nebula: { label: 'Lyrics app', tagline: 'Apple-style rolling lyrics: big rounded words stacked over a colour mesh or a nebula with racing neon streaks, a chip on the key word.' },
  acid: { label: 'Acid grain', tagline: 'Roaring colour blobs with heavy grain, looping hand-drawn eyeballs with split-colour outlines, the line as a yellow subtitle.' },
  ascii: { label: 'ASCII eye', tagline: 'A living eye drawn in characters: it looks around, blinks, then crumbles into a ringed planet; the lyrics are typed on the screen.' },
};

/** The direction's Look at full intensity: more beat, more emphasis, more glow, a lighter reveal. The style only changes the key (so caches are per style). */
export function turboLook(look: Look, style: TurboStyleId = 'liquid'): Look {
  const m = look.motion;
  return {
    ...look,
    key: `${look.key}|turbo|${style}`,
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
export type StagePlan = { variant: 0 | 1 | 2 | 3 | 4 | 5; amount: number; coverMix: number; bloom: number; aberration: number };

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
