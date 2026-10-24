import type { FontKey, StyleId } from './types';
import { FONTS, withFonts, type FontDef, type SceneKind, type StyleDef } from './styleBase';
import { DIRECTION_STYLES } from './directionStyles';
import { hasDevanagari, hasIndic, hasTamil } from '../lyrics/script';

export { FONTS, withFonts };
export type { FontDef, SceneKind, StyleDef };

const LEGACY_STYLES = {
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
    decor: 0.3,
    maskWords: false,
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
    decor: 0.2,
    maskWords: false,
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
    decor: 0.7,
    maskWords: false,
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
    decor: 0.6,
    maskWords: false,
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
    decor: 0.5,
    maskWords: false,
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
    decor: 0.6,
    maskWords: false,
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
    decor: 0.4,
    maskWords: false,
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
  gloss: {
    id: 'gloss',
    decor: 0.35,
    maskWords: false,
    label: 'Gloss',
    description: 'Bright, clean pop: glossy cover-colour gradients and crisp, highly readable type.',
    fonts: withFonts(),
    displayFont: 'wide',
    accentFont: 'wide',
    motion: 0.9,
    background: 'gloss',
    artwork: 0.16,
    vignette: 0.12,
    hookPreset: 'stack',
    calmPresets: ['stack', 'ticker', 'drop'],
    grain: 0.03,
    halftone: 0,
    echo: 0,
    scanlines: 0,
    chromeText: false,
    beatShake: 0.45,
    text: { glow: 0.2 },
  },
  film: {
    id: 'film',
    decor: 0.3,
    maskWords: false,
    label: 'Film',
    description: 'Cinematic and a little raw: warm grain, a deep vignette and serif titles.',
    fonts: withFonts(),
    displayFont: 'serif',
    accentFont: 'serif',
    motion: 0.6,
    background: 'film',
    artwork: 0.3,
    vignette: 0.75,
    hookPreset: 'ticker',
    calmPresets: ['ticker', 'stack'],
    grain: 0.24,
    halftone: 0,
    echo: 0,
    scanlines: 0.04,
    chromeText: false,
    beatShake: 0.2,
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
} satisfies Partial<Record<StyleId, StyleDef>>;

export const STYLES: Record<StyleId, StyleDef> = { ...LEGACY_STYLES, ...DIRECTION_STYLES } as Record<StyleId, StyleDef>;

export function fontCss(def: FontDef, sizePx: number): string {
  return `${def.italic ? 'italic ' : ''}${def.weight} ${Math.max(1, Math.round(sizePx))}px "${def.family}", "Arial Black", Impact, sans-serif`;
}

// ---- Devanagari (Hindi) and Tamil -----------------------------------------------------------------------------------------------
// The display faces of the looks have no Indic glyphs, and Indic text needs its own treatment: a face that carries the script, no
// italic (a synthesised slant wrecks the vowel signs), no letter spacing (it separates a letter from its signs), and room for tall
// marks above and below the line.
const DEV_FAMILY = '"Noto Sans Devanagari Variable", "Nirmala UI", "Mangal"';
const TAM_FAMILY = '"Noto Sans Tamil Variable", "Nirmala UI", "Latha"';

/** The CSS font for a piece of text: the look's face for Latin text, a script face (then the look's face for any Latin words) for Indic. */
export function fontCssFor(def: FontDef, sizePx: number, text: string): string {
  if (!hasIndic(text)) return fontCss(def, sizePx);
  const fam = hasTamil(text) ? (hasDevanagari(text) ? `${TAM_FAMILY}, ${DEV_FAMILY}` : TAM_FAMILY) : DEV_FAMILY;
  const w = Number(def.weight);
  const weight = Number.isFinite(w) ? (w >= 800 ? 800 : w >= 600 ? 700 : 600) : 700;
  return `${weight} ${Math.max(1, Math.round(sizePx))}px ${fam}, "${def.family}", "Arial Black", sans-serif`;
}

/** Letter spacing in px for this text: the look's own, except Indic text which must not be spaced. */
export const spacingFor = (def: FontDef, sizePx: number, text: string): number => (hasIndic(text) ? 0 : def.letterSpacingEm * sizePx);

/**
 * Make the browser fetch the script faces a lyric needs (their font files are split by unicode range, so a Latin sample never
 * triggers them). Resolves when they are usable; callers re-measure text afterwards.
 */
export async function loadScriptFonts(text: string): Promise<boolean> {
  if (typeof document === 'undefined' || !document.fonts || !hasIndic(text)) return false;
  const jobs: Promise<unknown>[] = [];
  if (hasDevanagari(text)) jobs.push(document.fonts.load('700 64px "Noto Sans Devanagari Variable"', 'हिन्दी अआक'));
  if (hasTamil(text)) jobs.push(document.fonts.load('700 64px "Noto Sans Tamil Variable"', 'தமிழ் அஆக'));
  try {
    await Promise.all(jobs);
  } catch {
    /* system Indic faces (Nirmala UI, Mangal, Latha) take over */
  }
  return true;
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

/** Font shorthands a style needs before its first frame (display + accent + caption face, and the mixed pool if it has one). */
export function fontLoadsFor(style: StyleDef): string[] {
  const keys: FontKey[] = [style.displayFont, style.accentFont, 'body'];
  if (style.fontMix) keys.push('display', 'serif', 'mono', 'wide');
  const out = new Set<string>();
  for (const k of keys) {
    const f = style.fonts[k];
    out.add(`${f.italic ? 'italic ' : ''}${f.weight} 64px "${f.family}"`);
  }
  return [...out];
}

/** Cheap width estimator used in tests / SSR; the browser passes ctx.measureText. */
export function estimateWidth(text: string, font: FontDef, sizePx: number): number {
  const t = font.uppercase ? text.toUpperCase() : text;
  if (hasIndic(t)) {
    // vowel signs and viramas ride on the letter before them and add no width; Indic letters run a little wider than Latin ones
    const letters = Array.from(t).filter((c) => !/\p{M}/u.test(c)).length;
    return letters * 0.62 * sizePx;
  }
  return t.length * (font.widthFactor + font.letterSpacingEm) * sizePx;
}
