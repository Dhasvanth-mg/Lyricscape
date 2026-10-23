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
  background: 'palette' | 'mono' | 'paper' | 'cycle' | 'grid';
  hookPreset: PresetId;
  calmPresets: PresetId[];
  grain: number;
  halftone: number;
  echo: number;
  scanlines: number;
  chromeText: boolean;
  beatShake: number;
};

const FONTS: Record<FontKey, FontDef> = {
  display: { family: 'Anton', weight: 400, widthFactor: 0.44, uppercase: true, letterSpacingEm: 0.01 },
  wide: { family: 'Archivo Variable', weight: 900, widthFactor: 0.66, uppercase: true, letterSpacingEm: -0.02 },
  serif: { family: 'DM Serif Display', weight: 400, widthFactor: 0.5, uppercase: false, italic: true, letterSpacingEm: 0 },
  mono: { family: 'JetBrains Mono Variable', weight: 700, widthFactor: 0.6, uppercase: true, letterSpacingEm: 0 },
  body: { family: 'Inter Variable', weight: 800, widthFactor: 0.58, uppercase: false, letterSpacingEm: -0.03 },
};

function withFonts(overrides: Partial<Record<FontKey, Partial<FontDef>>> = {}): Record<FontKey, FontDef> {
  const out = { ...FONTS };
  for (const k of Object.keys(overrides) as FontKey[]) out[k] = { ...FONTS[k], ...overrides[k] };
  return out;
}

export const STYLES: Record<StyleId, StyleDef> = {
  maximalist: {
    id: 'maximalist',
    label: 'Maximalist',
    description: 'Colorful, loud, cover-palette type with heavy punch on every beat.',
    fonts: withFonts(),
    displayFont: 'display',
    accentFont: 'wide',
    motion: 1.1,
    background: 'palette',
    hookPreset: 'burst',
    calmPresets: ['ticker', 'drop', 'stack'],
    grain: 0.14,
    halftone: 0.22,
    echo: 0,
    scanlines: 0,
    chromeText: false,
    beatShake: 1,
  },
  editorial: {
    id: 'editorial',
    label: 'Monochrome editorial',
    description: 'Black, white and bone. Big serif/grotesk type with razor-clean moves.',
    fonts: withFonts(),
    displayFont: 'display',
    accentFont: 'serif',
    motion: 0.8,
    background: 'paper',
    hookPreset: 'stack',
    calmPresets: ['ticker', 'stack', 'drop'],
    grain: 0.1,
    halftone: 0,
    echo: 0,
    scanlines: 0,
    chromeText: false,
    beatShake: 0.3,
  },
  psychedelic: {
    id: 'psychedelic',
    label: 'Psychedelic',
    description: 'Hue-cycling gradients, rippling baselines and echo trails.',
    fonts: withFonts({ display: { family: 'Archivo Variable', weight: 900, widthFactor: 0.66 } }),
    displayFont: 'wide',
    accentFont: 'serif',
    motion: 1,
    background: 'cycle',
    hookPreset: 'wave',
    calmPresets: ['wave', 'ticker', 'drop'],
    grain: 0.08,
    halftone: 0.08,
    echo: 3,
    scanlines: 0,
    chromeText: false,
    beatShake: 0.5,
  },
  minimal: {
    id: 'minimal',
    label: 'Minimal',
    description: 'Quiet, readable lyrics with gentle fades and a single accent.',
    fonts: withFonts({ body: { weight: 700, uppercase: false } }),
    displayFont: 'body',
    accentFont: 'serif',
    motion: 0.35,
    background: 'mono',
    hookPreset: 'ticker',
    calmPresets: ['ticker'],
    grain: 0.04,
    halftone: 0,
    echo: 0,
    scanlines: 0,
    chromeText: false,
    beatShake: 0,
  },
  y2k: {
    id: 'y2k',
    label: 'Y2K',
    description: 'Chrome gradients, wireframe grid, scanlines and tilted wide type.',
    fonts: withFonts(),
    displayFont: 'wide',
    accentFont: 'mono',
    motion: 1.2,
    background: 'grid',
    hookPreset: 'burst',
    calmPresets: ['stack', 'ticker', 'wave'],
    grain: 0.06,
    halftone: 0,
    echo: 1,
    scanlines: 0.18,
    chromeText: true,
    beatShake: 0.6,
  },
  custom: {
    id: 'custom',
    label: 'Custom',
    description: 'Start from Maximalist and tune the font, intensity and casing yourself.',
    fonts: withFonts(),
    displayFont: 'display',
    accentFont: 'wide',
    motion: 1,
    background: 'palette',
    hookPreset: 'burst',
    calmPresets: ['ticker', 'drop', 'stack', 'wave'],
    grain: 0.1,
    halftone: 0.12,
    echo: 0,
    scanlines: 0,
    chromeText: false,
    beatShake: 0.8,
  },
};

export function fontCss(def: FontDef, sizePx: number): string {
  return `${def.italic ? 'italic ' : ''}${def.weight} ${Math.max(1, Math.round(sizePx))}px "${def.family}", "Arial Black", Impact, sans-serif`;
}

/** Families the canvas needs loaded before the first frame. */
export const REQUIRED_FONT_LOADS = [
  '400 64px "Anton"',
  '900 64px "Archivo Variable"',
  'italic 400 64px "DM Serif Display"',
  '700 64px "JetBrains Mono Variable"',
  '800 64px "Inter Variable"',
];

/** Cheap width estimator used in tests / SSR; the browser passes ctx.measureText. */
export function estimateWidth(text: string, font: FontDef, sizePx: number): number {
  const t = font.uppercase ? text.toUpperCase() : text;
  return t.length * (font.widthFactor + font.letterSpacingEm) * sizePx;
}
