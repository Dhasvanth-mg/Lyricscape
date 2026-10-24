import type { FontKey, PresetId, StyleId } from './types';

export type FontDef = {
  family: string;
  weight: number | string;
  italic?: boolean;
  /** average glyph advance / font-size, used by the width estimator and layout fallback */
  widthFactor: number;
  uppercase: boolean;
  letterSpacingEm: number;
};

/** Backdrop scenery the renderer paints behind the words (see render.ts drawScenery). */
export type SceneKind = 'sunset' | 'notebook' | 'aurora' | 'diffuse' | 'leaks' | 'bokeh' | 'paper' | 'structure' | 'poster' | 'halo' | 'graphic';

export type StyleDef = {
  id: StyleId;
  label: string;
  description: string;
  fonts: Record<FontKey, FontDef>;
  /** primary font for lines, accent font for emphasised words */
  displayFont: FontKey;
  accentFont: FontKey;
  /** base motion amplitude 0..1.5 */
  motion: number;
  background: 'palette' | 'mono' | 'paper' | 'cycle' | 'grid' | 'noir' | 'sunset' | 'notebook' | 'aurora' | 'pop' | 'gloss' | 'film';
  /** how visible the blurred album-cover wash is behind the words (0..1, default 0.36) */
  artwork?: number;
  /** how much decoration (doodles, emoji, floating shapes) accompanies the words, 0..1 (default 1). Calm themes use little. */
  decor?: number;
  /** may long words be filled with the cover art (default true)? It looks great on loud themes and costs readability on calm ones. */
  maskWords?: boolean;
  /** vector doodles on/off independent of `decor` (which still governs icons). Default true. */
  doodles?: boolean;
  /** multiplier on the readability pool behind the words (default 1; full-bleed art wants almost none) */
  scrim?: number;
  /** show each line as short phrases of 1 to 3 big words, one after another (only for lines with word-level timing) */
  phrases?: boolean;
  /** the quiet next-line preview (default true) */
  caption?: boolean;
  /** words pick their colour from a short list by what the art behind them looks like, with a sticker edge (renderer-side) */
  adapt?: boolean;
  /** edge darkening 0..1 (default 0.55) */
  vignette?: number;
  /** backdrop scenery the renderer paints behind the words */
  scene?: SceneKind;
  /** text treatments beyond font + colour */
  text?: {
    glow?: number;
    aberration?: number;
    shadow?: number;
    outline?: boolean;
    highlight?: boolean;
    gradient?: 'chrome' | 'sunset';
    /** every word gets its own palette colour, like Maximalist */
    multicolor?: boolean;
    /** a soft ghost copy that settles into the word as it lands ("focus pull"), 0..1 */
    focus?: number;
    /** emphasised words sit on a solid white chip */
    chip?: boolean;
  };
  hookPreset: PresetId;
  calmPresets: PresetId[];
  /**
   * 'calm' = every line uses the soft ticker entrance (no cuts, drops, bursts or sideways slides): intimate and atmospheric looks.
   * 'soft' = lines may also stack and drift, but fast passages never become single-word cuts.
   */
  presetPolicy?: 'calm' | 'soft';
  /** the chorus brightens the ground instead of flipping it (default true = classic invert) */
  invert?: boolean;
  /** each word draws from a pool of faces (deconstructed typography). Deterministic per word. */
  fontMix?: boolean;
  /** 0..1: brief coloured slices behind the words at line starts (controlled disorder) */
  disrupt?: number;
  grain: number;
  halftone: number;
  echo: number;
  scanlines: number;
  chromeText: boolean;
  beatShake: number;
};

export const FONTS: Record<FontKey, FontDef> = {
  display: { family: 'Anton', weight: 400, widthFactor: 0.44, uppercase: true, letterSpacingEm: 0.01 },
  wide: { family: 'Archivo Variable', weight: 900, widthFactor: 0.66, uppercase: true, letterSpacingEm: -0.02 },
  serif: { family: 'DM Serif Display', weight: 400, widthFactor: 0.5, uppercase: false, italic: true, letterSpacingEm: 0 },
  mono: { family: 'JetBrains Mono Variable', weight: 700, widthFactor: 0.6, uppercase: true, letterSpacingEm: 0 },
  body: { family: 'Inter Variable', weight: 800, widthFactor: 0.58, uppercase: false, letterSpacingEm: -0.03 },
  comic: { family: 'Bangers', weight: 400, widthFactor: 0.46, uppercase: true, letterSpacingEm: 0.03 },
  marker: { family: 'Permanent Marker', weight: 400, widthFactor: 0.56, uppercase: false, letterSpacingEm: 0 },
};

export function withFonts(overrides: Partial<Record<FontKey, Partial<FontDef>>> = {}): Record<FontKey, FontDef> {
  const out = { ...FONTS };
  for (const k of Object.keys(overrides) as FontKey[]) out[k] = { ...FONTS[k], ...overrides[k] };
  return out;
}
