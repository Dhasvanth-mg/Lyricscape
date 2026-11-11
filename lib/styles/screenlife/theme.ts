// Screenlife colour (design-spec section 2): two fixed neutral ramps (dark and light) that never vary, and one accent per
// device world taken from the song's colours (the most saturated swatch, lightness clamped to 45-60%). The accent marks acts
// (the sent bubble, the caret, the selection, the send control), never decoration. Lyric text inside the UI keeps 4.5:1 against
// its bubble or field: the bubble is moved toward the theme neutral until it passes, and the accent is never kept behind the
// lyric if it fails.

import { contrastRatio, hexToRgb, mix, rgbToHex } from '../../kinetic/util';

export type Theme = {
  dark: boolean;
  bg: string;
  s1: string;
  s2: string;
  s3: string;
  text: string;
  /** chrome text (labels, timestamps): 40% hierarchy */
  dim: string;
  rule: string;
  accent: string;
  /** a second accent (the accent's complement), for one sticker or reaction per section only */
  accent2: string;
  /** the sent bubble and the text on it (4.5:1 checked) */
  bubble: string;
  onBubble: string;
};

export const DARK = { bg: '#0E1014', s1: '#14171C', s2: '#1C2027', s3: '#2A2F38', text: '#E9ECF1', dim: '#8E95A2', rule: '#262A32' } as const;
export const LIGHT = { bg: '#F6F5F2', s1: '#EFEEEA', s2: '#E6E7EA', s3: '#DADDE2', text: '#15171B', dim: '#5F6570', rule: '#D9DADD' } as const;

function hsl(hex: string): [number, number, number] {
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
function fromHsl(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

const FALLBACK_ACCENT = '#4C7DF0';

/** the most saturated usable swatch, its lightness clamped to 0.45-0.60 (the spec's OKLCH clamp, approximated in HSL) */
export function accentOf(colours: string[]): string {
  let best: string | null = null;
  let bestS = 0.18;
  for (const c of colours) {
    if (!/^#[0-9a-f]{6}$/i.test(c)) continue;
    const [, s, l] = hsl(c);
    const score = s * (1 - Math.abs(l - 0.5));
    if (score > bestS) (bestS = score), (best = c);
  }
  if (!best) return FALLBACK_ACCENT;
  const [h, s, l] = hsl(best);
  return fromHsl(h, Math.max(0.5, Math.min(0.85, s)), Math.max(0.45, Math.min(0.6, l)));
}

/** the bubble moved toward the theme neutral until its text passes `ratio` (and the text colour chosen) */
export function readableBubble(fill: string, neutral: string, ratio = 4.5): { bubble: string; on: string } {
  for (let t = 0; t <= 1.0001; t += 0.1) {
    const b = mix(fill, neutral, t);
    const on = contrastRatio('#ffffff', b) >= contrastRatio('#111318', b) ? '#ffffff' : '#111318';
    if (contrastRatio(on, b) >= ratio) return { bubble: b, on };
  }
  return { bubble: neutral, on: contrastRatio('#ffffff', neutral) > contrastRatio('#111318', neutral) ? '#ffffff' : '#111318' };
}

export function themeFor(dark: boolean, colours: string[]): Theme {
  const r = dark ? DARK : LIGHT;
  const accent = accentOf(colours);
  const [h, s, l] = hsl(accent);
  const accent2 = fromHsl((h + 180) % 360, s, l);
  const { bubble, on } = readableBubble(accent, dark ? r.s3 : r.s3);
  return { dark, ...r, accent, accent2, bubble, onBubble: on };
}

/** a CSS colour with alpha from a hex */
export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
