// What Turbo changes about a song's Look, and the six Turbo styles. It never replaces the art direction's timing or readability:
// it turns its own dials up, and a style may re-dress type and colour for its own world (terminal, sketchbook, nebula...).

import type { Look } from './look';
import type { FontKey } from './types';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ---- styles ---------------------------------------------------------------------------------------------------------------------
export const TURBO_STYLE_IDS = ['liquid', 'terminal', 'sketch', 'nebula', 'acid', 'ascii'] as const;
export type TurboStyleId = (typeof TURBO_STYLE_IDS)[number];
export const isTurboStyle = (v: unknown): v is TurboStyleId => (TURBO_STYLE_IDS as readonly unknown[]).includes(v);

export const TURBO_STYLES: Record<TurboStyleId, { label: string; tagline: string }> = {
  liquid: { label: 'Liquid light', tagline: "The song's own palette as flowing light, rays and bokeh, with beat shockwaves." },
  terminal: { label: 'Terminal', tagline: 'Lyrics typed out letter by letter in a green console, with scrolling code, CRT curve and glitch.' },
  sketch: { label: 'Sketchbook', tagline: 'Hand-drawn marker type that boils, paper grain, dithered colour, marker swipes behind the sung word.' },
  nebula: { label: 'Nebula', tagline: 'Deep purple space, light streaks and stars; type tilted along the streaks, the sung word on a pill.' },
  acid: { label: 'Acid', tagline: 'Grainy colour blobs, RGB-split eyes and orbs, a yellow subtitle at the top.' },
  ascii: { label: 'ASCII', tagline: 'The cover as living ASCII characters that dissolve into the picture on the beat.' },
};

export type StylePost = {
  /** scanline darkness 0..0.4 */
  scan: number;
  /** CRT barrel curve 0..0.3 */
  curve: number;
  /** horizontal glitch slices 0..1 */
  glitch: number;
  /** colour levels per channel for ordered dithering (0 = off) */
  dither: number;
  /** film grain override 0..0.5 (null = the direction's own) */
  grain: number | null;
  /** grain grain-size in device px */
  grainCell: number;
  /** fringing across the whole frame (1) instead of only at the edges (0) */
  aberFull: 0 | 1;
  /** multipliers on the plan's fringing and bloom */
  aber: number;
  bloom: number;
};

export type StyleSpec = {
  /** every word is drawn in this face (the layout is measured with it too) */
  font: FontKey | null;
  /** word colours: resting and being sung (null = the direction's) */
  ink: string | null;
  inkActive: string | null;
  /** the ground and the four light colours of the backdrop (null = the direction's) */
  ground: [string, string] | null;
  pal: [string, string, string, string] | null;
  /** stage shader variant (null = chosen from the mood) */
  stageVariant: 0 | 1 | 2 | 3 | 4 | 5 | null;
  amount: number | null;
  post: StylePost;
  /** hand-drawn "line boil" strength 0..1 */
  boil: number;
  typewriter: boolean;
  /** degrees every word is tilted by (along the light streaks) */
  rotate: number;
  /** marker swipe behind the sung word */
  blob: boolean;
  /** a pill behind the sung word */
  pill: boolean;
  /** how much of the picture is turned into ASCII characters (0..1) */
  ascii: number;
  /** layout dials applied to the Look */
  layout: Partial<{ textScale: number; textY: number; align: 'center' | 'left' }>;
};

const POST: StylePost = { scan: 0, curve: 0, glitch: 0, dither: 0, grain: null, grainCell: 1, aberFull: 0, aber: 1, bloom: 1 };
const BASE: StyleSpec = { font: null, ink: null, inkActive: null, ground: null, pal: null, stageVariant: null, amount: null, post: POST, boil: 0, typewriter: false, rotate: 0, blob: false, pill: false, ascii: 0, layout: {} };

export const STYLE_SPECS: Record<TurboStyleId, StyleSpec> = {
  liquid: BASE,
  terminal: {
    ...BASE,
    font: 'mono',
    ink: '#6dff8e',
    inkActive: '#eafff1',
    ground: ['#02070a', '#04130e'],
    pal: ['#34ff9a', '#1fd1ff', '#a6ff5c', '#02070a'],
    stageVariant: 4,
    amount: 0.4,
    post: { ...POST, scan: 0.2, curve: 0.12, glitch: 0.45, grain: 0.1, aber: 0.7, bloom: 1.5 },
    typewriter: true,
    layout: { textScale: 0.66, align: 'left' },
  },
  sketch: {
    ...BASE,
    font: 'marker',
    ink: '#1c1630',
    inkActive: '#1c1630',
    ground: ['#efe9d6', '#e6dfc9'],
    pal: ['#ff5d73', '#3a86ff', '#ffd23f', '#1c1630'],
    stageVariant: 5,
    amount: 0.5,
    post: { ...POST, dither: 7, grain: 0.2, grainCell: 2, bloom: 0, aber: 0 },
    boil: 0.9,
    blob: true,
    layout: { textScale: 0.9 },
  },
  nebula: {
    ...BASE,
    ink: '#ffffff',
    inkActive: '#ffffff',
    ground: ['#07021a', '#150a38'],
    pal: ['#7a3cff', '#ff4fd8', '#3a7bff', '#07021a'],
    stageVariant: 0,
    amount: 1.15,
    post: { ...POST, grain: 0.05, aber: 0.8, bloom: 1.5 },
    rotate: -9,
    pill: true,
  },
  acid: {
    ...BASE,
    font: 'display',
    ink: '#ffd60a',
    inkActive: '#fff6a8',
    ground: ['#14584f', '#2d1b6b'],
    pal: ['#ff8a3d', '#35d07f', '#8a5bff', '#2a1b4a'],
    stageVariant: 0,
    amount: 0.75,
    post: { ...POST, grain: 0.4, grainCell: 2, aberFull: 1, aber: 2, glitch: 0.12, bloom: 0.5 },
    layout: { textScale: 0.5, textY: -0.34 },
  },
  ascii: {
    ...BASE,
    font: 'mono',
    ink: '#fff3d6',
    inkActive: '#ffffff',
    ground: ['#030303', '#0a0705'],
    stageVariant: 4,
    amount: 0.3,
    post: { ...POST, scan: 0.08, curve: 0.05, glitch: 0.25, grain: 0.12, bloom: 1 },
    ascii: 1,
    layout: { textScale: 0.7 },
  },
};

/** The direction's Look at full intensity: more beat, more emphasis, more glow, a lighter reveal; a style adds its own layout dials. */
export function turboLook(look: Look, style: TurboStyleId = 'liquid'): Look {
  const m = look.motion;
  const S = STYLE_SPECS[style];
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
      // the typed and hand-drawn styles reveal word by word, never as a whole line at once
      reveal: style === 'terminal' || style === 'sketch' ? 'word' : m.reveal,
    },
    appearance: { ...look.appearance, glow: clamp(Math.max(look.appearance.glow, 0.55) + 0.15, 0, 1), density: clamp(look.appearance.density + 0.2, 0.5, 1) },
    layout: { ...look.layout, ...S.layout },
  };
}

/** What the GPU stage should look like for a frame: which backdrop, how strong. Chosen from the song's own mood and the direction's scenery. */
export type StagePlan = { variant: 0 | 1 | 2 | 3 | 4 | 5; amount: number; coverMix: number; bloom: number; aberration: number };

export function planStage(opts: { arousal: number; scene: string | null; hasCover: boolean; artAmount: number; hook: boolean; style?: TurboStyleId }): StagePlan {
  const { arousal, scene, hasCover, artAmount, hook } = opts;
  const S = STYLE_SPECS[opts.style ?? 'liquid'];
  let variant: StagePlan['variant'] = arousal >= 0.62 ? 1 : 0;
  if (scene === 'bokeh' || scene === 'halo' || scene === 'leaks') variant = 2;
  else if (scene === 'aurora' || scene === 'diffuse' || scene === 'sunset') variant = 0;
  else if (scene === 'structure' || scene === 'poster' || scene === 'graphic') variant = 1;
  if (S.stageVariant !== null) variant = S.stageVariant;
  return {
    variant,
    amount: S.amount ?? clamp(0.75 + arousal * 0.3 + (hook ? 0.12 : 0), 0.6, 1.1),
    coverMix: hasCover && S.stageVariant === null ? clamp(artAmount * 0.9, 0.12, 0.62) : 0,
    bloom: clamp(0.22 + arousal * 0.22 + (hook ? 0.1 : 0), 0.2, 0.6) * S.post.bloom,
    aberration: clamp(0.006 + arousal * 0.006 + (hook ? 0.004 : 0), 0.005, 0.02) * S.post.aber,
  };
}
