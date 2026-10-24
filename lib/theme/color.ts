// Small colour helpers for composing art directions: harmonising a cover colour into a direction's palette without leaving it,
// and guaranteeing contrast. Pure, no DOM.

import { contrastRatio, hexToRgb, mix, rgbToHex } from '../kinetic/util';

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return [h, s, l];
}

export function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

export const hslOf = (hex: string) => rgbToHsl(...hexToRgb(hex));

/**
 * Pull a cover colour toward a direction's own colour by `k` (0 = ignore the cover, 1 = cover only), then cap how saturated the
 * result may be and keep its lightness near the direction's: the cover can tint the palette but never take it over.
 */
export function harmonize(cover: string | undefined, base: string, k: number, maxSat: number): string {
  if (!cover || k <= 0) return capSat(base, maxSat);
  const mixed = mix(base, cover, Math.min(1, Math.max(0, k)));
  const [h, s] = hslOf(mixed);
  const [, , lBase] = hslOf(base);
  return hslToHex(h, Math.min(s, maxSat), Math.min(Math.max(hslOf(mixed)[2], lBase - 0.1), lBase + 0.1));
}

export function capSat(hex: string, maxSat: number): string {
  const [h, s, l] = hslOf(hex);
  return s <= maxSat ? hex : hslToHex(h, maxSat, l);
}

/** Scale HSL lightness (used by the brightness control on grounds). */
export function scaleLightness(hex: string, k: number): string {
  const [h, s, l] = hslOf(hex);
  return hslToHex(h, s, Math.min(0.97, Math.max(0.015, l * k)));
}

/**
 * Nudge `color` toward black or white (whichever helps) until it reaches `min` contrast against EVERY background.
 * Returns the colour unchanged when it already passes.
 */
export function ensureContrast(color: string, bgs: string[], min: number): string {
  const worst = (c: string) => Math.min(...bgs.map((b) => contrastRatio(c, b)));
  if (worst(color) >= min) return color;
  // whichever extreme reads better against the WORST background (on a mid-tone ground that is often black, not white)
  const target = worst('#000000') >= worst('#ffffff') ? '#000000' : '#ffffff';
  let c = color;
  for (let i = 0; i < 40 && worst(c) < min; i++) c = mix(c, target, 0.15);
  return c;
}

/**
 * When no ink can reach `min` against the grounds (they sit in the mid-tones, e.g. a listener picked grey on grey), move the
 * GROUNDS away from the ink instead: darker under light ink, lighter under dark ink.
 */
export function pushGround<T extends string[]>(ink: string, grounds: T, min: number): T {
  const worst = (gs: string[]) => Math.min(...gs.map((g) => contrastRatio(ink, g)));
  if (worst(grounds) >= min) return grounds;
  // light ink reads best on dark: move the grounds toward black; dark ink toward white
  const away = contrastRatio(ink, '#000000') > contrastRatio(ink, '#ffffff') ? '#000000' : '#ffffff';
  let g: string[] = grounds;
  for (let i = 0; i < 40 && worst(g) < min; i++) g = g.map((c) => mix(c, away, 0.12));
  return g as T;
}

/** 0 = cold (blue), 1 = warm (red / orange / yellow). Saturation-weighted over a palette's accents. */
export function paletteWarmth(palette: string[] | undefined): number | undefined {
  if (!palette || !palette.length) return undefined;
  let wsum = 0;
  let acc = 0;
  for (const c of palette.slice(0, 3)) {
    const [h, s, l] = hslOf(c);
    const w = s * (1 - Math.abs(l - 0.5));
    if (w < 0.02) continue;
    acc += w * (0.5 + 0.5 * Math.cos(((h - 35) * Math.PI) / 180));
    wsum += w;
  }
  return wsum > 0 ? Math.round((acc / wsum) * 100) / 100 : undefined;
}

export { contrastRatio, mix };
