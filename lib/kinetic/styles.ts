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
  background: 'palette' | 'mono' | 'paper' | 'cycle' | 'grid' | 'noir' | 'sunset' | 'notebook' | 'aurora' | 'pop';
  /** how visible the blurred album-cover wash is behind the words (0..1, default 0.36) */
  artwork?: number;
  /** edge darkening 0..1 (default 0.55) */
  vignette?: number;
  /** backdrop scenery the renderer paints behind the words */
  scene?: 'sunset' | 'notebook' | 'aurora';
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
  };
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
  comic: { family: 'Bangers', weight: 400, widthFactor: 0.46, uppercase: true, letterSpacingEm: 0.03 },
  marker: { family: 'Permanent Marker', weight: 400, widthFactor: 0.56, uppercase: false, letterSpacingEm: 0 },
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
  neon: {
    id: 'neon',
    label: 'Neon noir',
    description: 'Glowing tube-light type on a night-black ground, in the brightest colors of the cover.',
    fonts: withFonts(),
    displayFont: 'wide',
    accentFont: 'wide',
    motion: 1,
    background: 'noir',
    artwork: 0.2,
    hookPreset: 'burst',
    calmPresets: ['stack', 'ticker', 'drop'],
    grain: 0.05,
    halftone: 0,
    echo: 1,
    scanlines: 0,
    chromeText: false,
    beatShake: 0.7,
    text: { glow: 1, multicolor: true },
  },
  vaporwave: {
    id: 'vaporwave',
    label: 'Vaporwave',
    description: 'Striped sunset, a gliding horizon grid and pink-to-cyan italic type.',
    fonts: withFonts({ serif: { family: 'DM Serif Display', italic: true, uppercase: true, widthFactor: 0.55 } }),
    displayFont: 'serif',
    accentFont: 'wide',
    motion: 0.85,
    background: 'sunset',
    artwork: 0.12,
    scene: 'sunset',
    hookPreset: 'wave',
    calmPresets: ['wave', 'ticker', 'stack'],
    grain: 0.07,
    halftone: 0,
    echo: 1,
    scanlines: 0.1,
    chromeText: false,
    beatShake: 0.35,
    text: { gradient: 'sunset', glow: 0.35 },
  },
  vhs: {
    id: 'vhs',
    label: 'Retro VHS',
    description: 'Tape-era monospace with scanlines, grain and a red/cyan colour split.',
    fonts: withFonts({ mono: { weight: 800 } }),
    displayFont: 'mono',
    accentFont: 'mono',
    motion: 0.9,
    background: 'noir',
    artwork: 0.22,
    hookPreset: 'ticker',
    calmPresets: ['ticker', 'stack', 'drop'],
    grain: 0.18,
    halftone: 0,
    echo: 0,
    scanlines: 0.3,
    chromeText: false,
    beatShake: 0.9,
    text: { aberration: 1 },
  },
  notebook: {
    id: 'notebook',
    label: 'Notebook',
    description: 'Marker handwriting on ruled paper, with a highlighter swipe on the word being sung.',
    fonts: withFonts(),
    displayFont: 'marker',
    accentFont: 'marker',
    motion: 0.7,
    background: 'notebook',
    artwork: 0.06,
    vignette: 0.2,
    scene: 'notebook',
    hookPreset: 'stack',
    calmPresets: ['stack', 'ticker', 'drop'],
    grain: 0.05,
    halftone: 0,
    echo: 0,
    scanlines: 0,
    chromeText: false,
    beatShake: 0.25,
    text: { highlight: true },
  },
  aurora: {
    id: 'aurora',
    label: 'Aurora',
    description: 'Slow northern-lights gradients and soft glowing type. Easy on the eyes.',
    fonts: withFonts({ body: { weight: 800, uppercase: false } }),
    displayFont: 'body',
    accentFont: 'serif',
    motion: 0.5,
    background: 'aurora',
    artwork: 0.14,
    scene: 'aurora',
    hookPreset: 'stack',
    calmPresets: ['ticker', 'stack'],
    grain: 0.05,
    halftone: 0,
    echo: 0,
    scanlines: 0,
    chromeText: false,
    beatShake: 0.12,
    text: { glow: 0.55 },
  },
  popart: {
    id: 'popart',
    label: 'Pop art',
    description: 'Comic-book caps with thick outlines, hard shadows and big halftone dots.',
    fonts: withFonts(),
    displayFont: 'comic',
    accentFont: 'comic',
    motion: 1.25,
    background: 'pop',
    artwork: 0.08,
    vignette: 0.25,
    hookPreset: 'burst',
    calmPresets: ['stack', 'drop', 'ticker'],
    grain: 0.04,
    halftone: 0.3,
    echo: 0,
    scanlines: 0,
    chromeText: false,
    beatShake: 1,
    text: { outline: true, shadow: 1, multicolor: true },
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
  '400 64px "Bangers"',
  '400 64px "Permanent Marker"',
];

/** Cheap width estimator used in tests / SSR; the browser passes ctx.measureText. */
export function estimateWidth(text: string, font: FontDef, sizePx: number): number {
  const t = font.uppercase ? text.toUpperCase() : text;
  return t.length * (font.widthFactor + font.letterSpacingEm) * sizePx;
}
