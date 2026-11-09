// Variety for generated graphics. Scenes and decorations pick from large families of variants drawn in code (no image files),
// always the same way for the same song and line, so a replay or an export looks exactly like what was on screen.
//
// A pick is a pure function of a seed. Seeds come from the song (its id and colours) and the line index, never from the clock.

/** mulberry32: a small deterministic generator, 0..1 */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashKey(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const pick = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length) % list.length]!;

/** hsl (h in turns 0..1, s and l 0..1) to #rrggbb */
export function hsl(h: number, s: number, l: number): string {
  h = ((h % 1) + 1) % 1;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(Math.max(0, Math.min(1, c)) * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** hue (turns) of a #rrggbb colour, or null for greys */
export function hueOf(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d < 0.08) return null;
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h /= 6;
  return h;
}

/** Colour-harmony schemes: hue offsets (turns) of the three accents from a base hue. */
export const SCHEMES = {
  complementary: [0, 0.5, 0.04],
  splitComplement: [0, 0.42, 0.58],
  triadic: [0, 1 / 3, 2 / 3],
  analogous: [0, 0.08, -0.08],
  tetradic: [0, 0.25, 0.5],
  warmCool: [0.02, 0.55, 0.12],
  pop: [0, 0.15, 0.6],
  duo: [0, 0.5, 0.5],
} as const;
export type SchemeId = keyof typeof SCHEMES;
export const SCHEME_IDS = Object.keys(SCHEMES) as SchemeId[];

/** The song's own hues (from its cover palette), or a hue from the seed when the palette is grey. */
export function songHues(palette: readonly string[] | undefined, seed: number): number[] {
  const hs = (palette ?? []).map(hueOf).filter((h): h is number => h !== null);
  return hs.length ? hs : [seeded(seed)()];
}

export type PaperSet = { paper: string; ink: string; accents: [string, string, string]; frame: string };

/**
 * A printed-paper colour set: light paper, dark ink, three accents in a harmony around `hue`. Eight schemes, a continuous hue,
 * five paper tones and five ink weights: thousands of distinct, always-readable sets.
 */
export function paperSet(r: () => number, hue: number): PaperSet {
  const scheme = SCHEMES[pick(r, SCHEME_IDS)];
  const paperTone = pick(r, [
    [0.12, 0.9],
    [0.3, 0.88],
    [0.18, 0.93],
    [0.45, 0.85],
    [0.08, 0.95],
  ] as const);
  const paperHue = r() < 0.5 ? hue + 0.5 : hue + (r() - 0.5) * 0.2;
  const inkL = pick(r, [0.1, 0.13, 0.16, 0.2, 0.08]);
  const accentL = 0.42 + r() * 0.16;
  const accentS = 0.55 + r() * 0.35;
  const accents = scheme.map((o, i) => hsl(hue + o + (r() - 0.5) * 0.03, i === 2 ? accentS * 0.6 : accentS, i === 2 ? Math.min(0.78, accentL + 0.22) : accentL)) as [string, string, string];
  return {
    paper: hsl(paperHue, paperTone[0], paperTone[1]),
    ink: hsl(hue + 0.5 + (r() - 0.5) * 0.3, 0.35 + r() * 0.3, inkL),
    accents,
    frame: hsl(hue + (r() - 0.5) * 0.15, 0.25 + r() * 0.3, 0.32 + r() * 0.15),
  };
}

/** How many distinct combinations a family offers (for the docs and the tests). */
export const combos = (...counts: number[]) => counts.reduce((a, b) => a * b, 1);
