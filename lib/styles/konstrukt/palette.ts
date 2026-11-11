// Konstrukt colour systems (KON-PAL-PAL-001..010) and print textures (KON-TEX-TEX-001..006). Flat inks on paper, at most three
// inks plus the paper; type is always the darkest ink (or the paper colour on a negative print) and reads at 7:1 against its
// ground. Cover systems push two cover swatches to print-like saturation and darken the type ink until it meets the floor.

import { contrastRatio, hexToRgb, rgbToHex } from '../../kinetic/util';

export type PalId = `KON-PAL-PAL-${'001' | '002' | '003' | '004' | '005' | '006' | '007' | '008' | '009' | '010'}`;
export type TexId = `KON-TEX-TEX-${'001' | '002' | '003' | '004' | '005' | '006'}`;

export type Inks = {
  id: PalId;
  /** paper (or the near-black ground on a negative print) */
  paper: string;
  /** the type ink: darkest on paper, paper colour on a negative */
  type: string;
  /** the second ink: the dominant form */
  a: string;
  /** the third ink (secondary forms, split fields); may equal the type ink */
  b: string;
  negative: boolean;
  /** uncoated stock: riso grain and tooth allowed */
  uncoated: boolean;
};

const CREAM = '#efe8d8';
const WHITE = '#f7f6f2';
const BLACK = '#151515';
const NEAR_BLACK = '#121212';

export const FIXED: Record<Exclude<PalId, 'KON-PAL-PAL-002' | 'KON-PAL-PAL-003' | 'KON-PAL-PAL-004' | 'KON-PAL-PAL-010'>, Inks> = {
  'KON-PAL-PAL-001': { id: 'KON-PAL-PAL-001', paper: CREAM, type: BLACK, a: '#d7261e', b: BLACK, negative: false, uncoated: true },
  'KON-PAL-PAL-005': { id: 'KON-PAL-PAL-005', paper: '#f3efe4', type: BLACK, a: '#e03a2f', b: '#1f4fb4', negative: false, uncoated: true },
  'KON-PAL-PAL-006': { id: 'KON-PAL-PAL-006', paper: '#f4f1ea', type: '#262a6b', a: '#00a0d2', b: '#ff48b0', negative: false, uncoated: true },
  'KON-PAL-PAL-007': { id: 'KON-PAL-PAL-007', paper: '#f4f1ea', type: '#1c2251', a: '#ff48b0', b: '#0078bf', negative: false, uncoated: true },
  'KON-PAL-PAL-008': { id: 'KON-PAL-PAL-008', paper: '#ecebe7', type: '#1d1d1f', a: '#ff6c2f', b: '#8a8d91', negative: false, uncoated: false },
  'KON-PAL-PAL-009': { id: 'KON-PAL-PAL-009', paper: NEAR_BLACK, type: CREAM, a: CREAM, b: '#8f8a80', negative: true, uncoated: false },
};
/** the third colour of the three-primaries system (yellow), drawn as a second form ink only */
export const PRIMARY_YELLOW = '#f2c230';

type Hsl = [number, number, number];
export function toHsl(hex: string): Hsl {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255) as [number, number, number];
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
export function fromHsl([h, s, l]: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/** a cover swatch pushed to a flat print ink: saturated, mid lightness */
export function printInk(hex: string): string {
  const [h, s, l] = toHsl(hex);
  return fromHsl([h, Math.max(0.72, Math.min(1, s * 1.4)), Math.min(0.55, Math.max(0.38, l))]);
}

/** darken (positive) or lighten (negative print) `ink` along its hue until it reads at `min`:1 on `ground` */
export function toContrast(ink: string, ground: string, min: number, lighten = false): string {
  let [h, s, l] = toHsl(ink);
  let c = ink;
  for (let i = 0; i < 40 && contrastRatio(c, ground) < min; i++) {
    l = lighten ? Math.min(1, l + 0.03) : Math.max(0, l - 0.03);
    s = Math.min(s, 0.85);
    c = fromHsl([h, s, l]);
  }
  return contrastRatio(c, ground) >= min ? c : lighten ? '#ffffff' : '#000000';
}

/** the cover's usable hues: saturated swatches at least 40 degrees apart, most saturated first */
export function coverHues(colours: string[]): string[] {
  const out: { c: string; h: number; s: number }[] = [];
  const cand = colours
    .map((c) => ({ c, hsl: toHsl(c) }))
    .filter((x) => x.hsl[1] > 0.35 && x.hsl[2] > 0.12 && x.hsl[2] < 0.9)
    .sort((a, b) => b.hsl[1] - a.hsl[1]);
  for (const x of cand) {
    if (out.every((o) => Math.min(Math.abs(o.h - x.hsl[0]), 360 - Math.abs(o.h - x.hsl[0])) >= 40)) out.push({ c: x.c, h: x.hsl[0], s: x.hsl[1] });
  }
  return out.map((o) => o.c);
}

/** the colours of a system for a song (cover systems need the cover's hues; null when the cover cannot give them) */
export function inksOf(id: PalId, colours: string[]): Inks | null {
  if (id in FIXED) return FIXED[id as keyof typeof FIXED];
  const hues = coverHues(colours);
  switch (id) {
    case 'KON-PAL-PAL-002':
    case 'KON-PAL-PAL-003': {
      if (hues.length < 2) return null;
      const paper = id === 'KON-PAL-PAL-002' ? CREAM : WHITE;
      const a = printInk(hues[0]!);
      const b = printInk(hues[1]!);
      // the type is the darker of the two inks, taken down its hue until 7:1
      const dark = toHsl(a)[2] < toHsl(b)[2] ? a : b;
      return { id, paper, type: toContrast(dark, paper, 7), a, b: dark === a ? b : a, negative: false, uncoated: id === 'KON-PAL-PAL-002' };
    }
    case 'KON-PAL-PAL-004': {
      if (hues.length < 1) return null;
      return { id, paper: CREAM, type: BLACK, a: printInk(hues[0]!), b: BLACK, negative: false, uncoated: true };
    }
    case 'KON-PAL-PAL-010': {
      if (hues.length < 1) return null;
      return { id, paper: NEAR_BLACK, type: CREAM, a: toContrast(printInk(hues[0]!), NEAR_BLACK, 3, true), b: CREAM, negative: true, uncoated: false };
    }
  }
  return null;
}

/** textures per system: tooth on uncoated paper, sheen on coated white, newsprint on the grey system; riso grain on the riso
 * pairs; none on a negative print (light on dark is not paper ink) */
export function texturesOf(inks: Inks, drag: boolean): TexId[] {
  if (inks.negative) return [];
  const t: TexId[] = [];
  if (inks.id === 'KON-PAL-PAL-008') t.push('KON-TEX-TEX-003');
  else if (inks.uncoated) t.push('KON-TEX-TEX-001');
  else t.push('KON-TEX-TEX-002');
  if (inks.id === 'KON-PAL-PAL-006' || inks.id === 'KON-PAL-PAL-007' || (inks.uncoated && inks.id !== 'KON-PAL-PAL-001')) t.push('KON-TEX-TEX-004');
  if (drag && inks.uncoated) t.push('KON-TEX-TEX-005');
  t.push('KON-TEX-TEX-006');
  return t;
}
