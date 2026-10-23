import { z } from 'zod';
import { EMOTIONS, MOTIFS, type ColorMode, type EmotionId, type MotifId } from './emotion';

export const STYLE_IDS = ['maximalist', 'editorial', 'psychedelic', 'minimal', 'y2k', 'neon', 'vaporwave', 'vhs', 'notebook', 'aurora', 'popart', 'custom'] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export const PRESET_IDS = ['ticker', 'stack', 'burst', 'drop', 'wave', 'cut'] as const;
export type PresetId = (typeof PRESET_IDS)[number];

export const EFFECT_IDS = ['pop', 'slide', 'stretch', 'shake', 'mask', 'float'] as const;
export type EffectId = (typeof EFFECT_IDS)[number];

export type FontKey = 'display' | 'wide' | 'serif' | 'mono' | 'body' | 'comic' | 'marker';

export const wordCueSchema = z.object({
  id: z.string(),
  text: z.string(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  emphasis: z.number().min(0).max(1).optional(),
  effect: z.enum(EFFECT_IDS).optional(),
  /** where this word's times came from: 'none' = shown with its line, not individually timed */
  timing: z.enum(['authored', 'estimated', 'none']).optional(),
});
export type WordCue = z.infer<typeof wordCueSchema>;

export const moodSchema = z.object({ emotion: z.enum(EMOTIONS), valence: z.number().min(-1).max(1), arousal: z.number().min(0).max(1), confidence: z.number().min(0).max(1) });

/** README `VisualScene`-compatible scene (one per lyric line). */
export const sceneSchema = z.object({
  id: z.string(),
  lineIndex: z.number().int().nonnegative(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
  seed: z.number().int(),
  preset: z.enum(PRESET_IDS),
  hook: z.boolean(),
  mood: moodSchema.optional(),
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
  /** shown in the interlude marquee (song title / artist) */
  label: z.string().max(200).optional(),
  /** visual cues read from the album cover (brightness, where the focal color sits) */
  cover: z.object({ light: z.number().min(0).max(1), focal: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }), vibrance: z.number().min(0).max(1) }).optional(),
  emotion: z.object({ overall: moodSchema, basis: z.enum(['lyrics', 'tempo', 'lyrics+tempo', 'none']) }).optional(),
  custom: z
    .object({
      font: z.enum(['display', 'wide', 'serif', 'mono', 'body', 'comic', 'marker']).optional(),
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
  /** soft halo around the glyphs, 0..1 (neon, aurora) */
  glow?: number;
  /** red/cyan channel split in px (VHS) */
  aberration?: number;
  /** hard, flat drop shadow offset in px (pop art) */
  shadow?: number;
  /** marker swipe painted behind the word (notebook) */
  highlight?: string;
  /** vertical glyph gradient */
  gradient?: 'chrome' | 'sunset';
};

export type DrawDoodle = {
  id: string;
  kind: MotifId;
  x: number;
  y: number;
  size: number;
  rotationDeg: number;
  alpha: number;
  fill: string | null;
  stroke: string | null;
  lineWidth: number;
  accent?: string;
  seed: number;
};
export type DrawEmoji = { id: string; char: string; x: number; y: number; sizePx: number; rotationDeg: number; alpha: number };

export type Aurora = { x: number; y: number; r: number; color: string; alpha: number };
export type Ring = { r: number; alpha: number; color: string; width: number };
export type Ribbon = { y: number; amp: number; freq: number; phase: number; color: string; width: number; alpha: number };
export type Particle = { x: number; y: number; size: number; alpha: number; color: string };
/** The generative show that runs while nobody is singing (intro, breaks, outro, songs without lyrics). */
export type Interlude = { amount: number; aurora: Aurora[]; rings: Ring[]; ribbons: Ribbon[]; particles: Particle[] };

export type MarqueeRow = { text: string; y: number; offsetX: number; sizePx: number; alpha: number; font: FontKey; color: string };

/** A quiet preview of the line that comes next, so you can sing along. */
export type Caption = { text: string; alpha: number };

export type Frame = {
  tMs: number;
  sceneId: string | null;
  lineIndex: number;
  hook: boolean;
  activeWordId: string | null;
  visibleWordIds: string[];
  bg: { c0: string; c1: string; angleDeg: number; invert: boolean; pulse: number; solid: boolean; glow: { x: number; y: number; color: string; alpha: number } | null };
  artwork: { mode: 'backdrop' | 'hero' | 'sticker'; alpha: number; scale: number; rotationDeg: number; x: number; y: number; hero: number };
  camera: { zoom: number; rotationDeg: number; x: number; y: number };
  overlays: { grain: number; vignette: number; halftone: number; flash: number; scanlines: number };
  beat: { pulse: number; index: number; strength: number };
  marquee: MarqueeRow[];
  interlude: Interlude;
  doodles: DrawDoodle[];
  emojis: DrawEmoji[];
  /** mood of the current line and the palette actually in use (after album/mood blending) */
  mood: EmotionId | null;
  palette: string[];
  words: DrawWord[];
  textColor: string;
  accent: string;
  caption: Caption | null;
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
  /** blend = album colors tinted by mood, album = cover only, emotion = mood palettes only */
  colorMode?: ColorMode;
  /** emoji stickers next to matching words + ambient emoji in hooks (default true) */
  emojis?: boolean;
  /** animated vector doodles (default true) */
  doodles?: boolean;
  /** off = no cover; background = the cover as a soft blurred backdrop (default) */
  artwork?: 'off' | 'background';
  /** 0..1 visual budget from the quality level (fewer doodles/emoji when the machine struggles) */
  density?: number;
};

export type { ColorMode, EmotionId, MotifId };
export { MOTIFS };
