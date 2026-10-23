import { z } from 'zod';

export const STYLE_IDS = ['maximalist', 'editorial', 'psychedelic', 'minimal', 'y2k', 'custom'] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export const PRESET_IDS = ['ticker', 'stack', 'burst', 'drop', 'wave', 'cut'] as const;
export type PresetId = (typeof PRESET_IDS)[number];

export const EFFECT_IDS = ['pop', 'slide', 'stretch', 'shake', 'mask', 'float'] as const;
export type EffectId = (typeof EFFECT_IDS)[number];

export type FontKey = 'display' | 'wide' | 'serif' | 'mono' | 'body';

export const wordCueSchema = z.object({
  id: z.string(),
  text: z.string(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  emphasis: z.number().min(0).max(1).optional(),
  effect: z.enum(EFFECT_IDS).optional(),
});
export type WordCue = z.infer<typeof wordCueSchema>;

/** README `VisualScene`-compatible scene (one per lyric line). */
export const sceneSchema = z.object({
  id: z.string(),
  lineIndex: z.number().int().nonnegative(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  seed: z.number().int(),
  preset: z.enum(PRESET_IDS),
  hook: z.boolean(),
  intensity: z.number().min(0).max(2),
  words: z.array(wordCueSchema),
  effects: z.array(
    z.object({
      type: z.string(),
      startMs: z.number(),
      durationMs: z.number(),
      targetWords: z.array(z.number().int()),
      intensity: z.number(),
      easing: z.string(),
    }),
  ),
  background: z.object({ type: z.enum(['solid', 'gradient', 'shader', 'licensedAsset']), assetId: z.string().optional() }),
});
export type Scene = z.infer<typeof sceneSchema>;

export const visualTimelineSchema = z.object({
  version: z.literal(1),
  trackId: z.string(),
  durationMs: z.number().nonnegative(),
  artworkAssetId: z.string().optional(),
  palette: z.array(z.string()).min(2),
  style: z.enum(STYLE_IDS),
  seed: z.number().int(),
  bpm: z.number().optional(),
  beatTimesMs: z.array(z.number()),
  cues: z.array(wordCueSchema),
  scenes: z.array(sceneSchema),
  gaps: z.array(z.object({ startMs: z.number(), endMs: z.number() })),
  effects: z.array(
    z.object({
      id: z.string(),
      startMs: z.number(),
      endMs: z.number(),
      preset: z.string(),
      params: z.record(z.string(), z.unknown()),
    }),
  ),
  custom: z
    .object({
      font: z.enum(['display', 'wide', 'serif', 'mono', 'body']).optional(),
      intensity: z.number().min(0).max(2).optional(),
      uppercase: z.boolean().optional(),
    })
    .optional(),
});
export type VisualTimeline = z.infer<typeof visualTimelineSchema>;

// ---- Frame (output of the pure function `computeFrame`) --------------------

export type DrawWord = {
  id: string;
  text: string;
  font: FontKey;
  sizePx: number;
  x: number; // px from canvas center
  y: number;
  scaleX: number;
  scaleY: number;
  rotationDeg: number;
  skewX: number;
  alpha: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  mask: boolean;
  /** px separation of the top/bottom halves (the "split" effect) */
  split: number;
  /** extra ghost copies (psychedelic echo) */
  echo: number;
  blur: number;
  active: boolean;
  z: number;
  /** Fit hint: renderer shrinks the word so it never exceeds this width in px */
  maxWidthPx: number;
};

export type MarqueeRow = { text: string; y: number; offsetX: number; sizePx: number; alpha: number; font: FontKey; color: string };

export type Frame = {
  tMs: number;
  sceneId: string | null;
  lineIndex: number;
  hook: boolean;
  activeWordId: string | null;
  visibleWordIds: string[];
  bg: { c0: string; c1: string; angleDeg: number; invert: boolean; pulse: number; solid: boolean };
  artwork: { mode: 'backdrop' | 'hero' | 'sticker'; alpha: number; scale: number; rotationDeg: number; x: number; y: number; hero: number };
  camera: { zoom: number; rotationDeg: number; x: number; y: number };
  overlays: { grain: number; vignette: number; halftone: number; flash: number; scanlines: number };
  beat: { pulse: number; index: number; strength: number };
  marquee: MarqueeRow[];
  words: DrawWord[];
  textColor: string;
  accent: string;
};

export type FrameEnv = {
  width: number;
  height: number;
  reducedMotion: boolean;
  /** Measure the rendered width of `text` at `sizePx` for `font`. Defaults to an estimator. */
  measure?: (text: string, font: FontKey, sizePx: number) => number;
  /** 0..1 motion scale, multiplied with scene intensity (readable-lyrics option => ~0.35). */
  motionScale?: number;
  /** Bump when fonts finish loading so cached layouts are re-measured. */
  layoutEpoch?: number;
};
