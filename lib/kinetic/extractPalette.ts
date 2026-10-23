import { colorDistance } from './emotion';
import { contrastRatio, hexToRgb, mix, rgbToHex, rotateHue } from './util';

// Dominant-color extraction from album art. The artwork itself is never altered: we only *read* a handful of
// colors from a tiny downscaled copy to theme the UI around it.

export type ExtractedPalette = {
  /** [accent1, accent2, accent3, dark] */
  palette: [string, string, string, string];
  /** 0..1: how colourful the art is. Greyscale covers return ~0 and the caller falls back to mood colors. */
  vibrance: number;
  /** 0..1 average brightness of the art */
  light: number;
  /** where (0..1) the most vivid, bright part of the art sits: used as a light source / focal point */
  focal: { x: number; y: number };
};

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
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

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/** Make sure an accent is bright/saturated enough to read on the palette's dark base (contrast >= 3.2). */
function readable(hex: string, dark: string): string {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const s2 = Math.max(0.55, s);
  let l2 = Math.min(0.72, Math.max(0.5, l));
  let out = hslToHex(h, s2, l2);
  for (let i = 0; i < 12 && contrastRatio(out, dark) < 3.2; i++) {
    l2 = Math.min(0.92, l2 + 0.04);
    out = hslToHex(h, s2, l2);
  }
  return out;
}

/**
 * @param data RGBA bytes (e.g. from canvas getImageData on a ~48px thumbnail)
 */
export function paletteFromPixels(data: ArrayLike<number>): ExtractedPalette | null {
  type Bin = { n: number; r: number; g: number; b: number };
  const bins = new Map<number, Bin>();
  let total = 0;
  let satSum = 0;
  let lumSum = 0;
  let fw = 0;
  let fx = 0;
  let fy = 0;
  const side = Math.max(1, Math.round(Math.sqrt(data.length / 4)));
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3]! < 200) continue; // transparent
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    total++;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bin.n++;
    bin.r += r;
    bin.g += g;
    bin.b += b;
    bins.set(key, bin);
    const [, sat, lum] = rgbToHsl(r, g, b);
    satSum += sat;
    lumSum += lum;
    const w = sat * (0.25 + lum) * (lum > 0.93 ? 0.3 : 1); // vivid and bright, but not blown-out white
    const px = (i / 4) % side;
    const py = Math.floor(i / 4 / side);
    fw += w;
    fx += w * px;
    fy += w * py;
  }
  if (total < 16) return null;

  type Cand = { hex: string; weight: number; l: number; s: number; n: number };
  const cands: Cand[] = [];
  for (const bin of bins.values()) {
    const r = bin.r / bin.n;
    const g = bin.g / bin.n;
    const b = bin.b / bin.n;
    const [, s, l] = rgbToHsl(r, g, b);
    const lightOk = l < 0.1 || l > 0.94 ? 0.15 : l < 0.2 || l > 0.88 ? 0.5 : 1;
    cands.push({ hex: rgbToHex(r, g, b), weight: (bin.n / total) * Math.pow(0.2 + s, 1.6) * lightOk, l, s, n: bin.n });
  }

  const vibrance = Math.min(1, (satSum / total) * 1.6);
  const accents: string[] = [];
  for (const c of [...cands].sort((a, b) => b.weight - a.weight)) {
    if (c.s < 0.18) continue; // greys make poor accents
    if (accents.every((a) => colorDistance(a, c.hex) > 110)) accents.push(c.hex);
    if (accents.length === 3) break;
  }
  const light = lumSum / total;
  const focal = fw > 0 ? { x: Math.min(1, Math.max(0, fx / fw / side)), y: Math.min(1, Math.max(0, fy / fw / side)) } : { x: 0.5, y: 0.5 };
  if (accents.length === 0) return { palette: ['#e8e8ee', '#a9a9b8', '#6f6f80', '#0e0e12'], vibrance, light, focal };

  // fewer than three distinct colors: derive neighbours from the hue wheel so the palette still has range
  const base = accents[0]!;
  const derive = [35, -35, 150];
  for (let i = 0; accents.length < 3; i++) accents.push(rotateHue(base, derive[i % derive.length]!));

  // dark: the darkest well-populated color of the art, else a deep shade of the dominant accent
  const darkCand = cands.filter((c) => c.l < 0.28 && c.n / total > 0.03).sort((a, b) => b.n - a.n)[0];
  const [dh, ds] = rgbToHsl(...hexToRgb(base));
  const dark = darkCand ? mix(darkCand.hex, '#000000', 0.35) : hslToHex(dh, Math.min(0.5, ds), 0.07);

  const out = accents.map((a) => readable(a, dark)) as [string, string, string];
  return { palette: [out[0], out[1], out[2], dark], vibrance, light, focal };
}

const cache = new Map<string, ExtractedPalette | null>();

/**
 * Browser helper: load the image with CORS and read a 48px copy. Returns null when the image can't be read
 * (cross-origin without CORS headers, decode error), so callers fall back to mood/derived colors.
 */
export async function extractPaletteFromUrl(url: string): Promise<ExtractedPalette | null> {
  if (cache.has(url)) return cache.get(url)!;
  const result = await new Promise<ExtractedPalette | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 48;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, 48, 48);
        resolve(paletteFromPixels(ctx.getImageData(0, 0, 48, 48).data));
      } catch {
        resolve(null); // tainted canvas
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
  if (cache.size > 100) cache.clear();
  cache.set(url, result);
  return result;
}
