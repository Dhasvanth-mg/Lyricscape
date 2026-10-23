// Cheap, deterministic image-quality scoring used to rank party media for recaps.
// Works on small grayscale thumbnails (the worker asks FFmpeg for them), so it needs no image library.
//
//   sharpness  : variance of the Laplacian (blur detector)
//   exposure   : mean luma + clipped-pixel ratios
//   dHash      : 64-bit perceptual hash for near-duplicate detection
//
// Similarity != consent to discard: duplicates are *suggested* for removal and the host can override.
// No face detection or identity recognition is performed.

export type GrayImage = { w: number; h: number; data: Uint8Array };

/** Box-filter resize (good enough for scoring and hashing). */
export function resizeGray(src: GrayImage, w: number, h: number): GrayImage {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y * src.h) / h);
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * src.h) / h));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * src.w) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * src.w) / w));
      let sum = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) (sum += src.data[yy * src.w + xx]!), n++;
      out[y * w + x] = Math.round(sum / n);
    }
  }
  return { w, h, data: out };
}

/** Variance of the 4-neighbour Laplacian: low values mean blurry/flat. */
export function laplacianVariance(img: GrayImage): number {
  const { w, h, data } = img;
  if (w < 3 || h < 3) return 0;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = 4 * data[i]! - data[i - 1]! - data[i + 1]! - data[i - w]! - data[i + w]!;
      sum += l;
      sumSq += l * l;
      n++;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export function exposure(img: GrayImage): { mean: number; clippedLow: number; clippedHigh: number } {
  let sum = 0;
  let lo = 0;
  let hi = 0;
  for (const v of img.data) {
    sum += v;
    if (v < 8) lo++;
    if (v > 247) hi++;
  }
  const n = img.data.length || 1;
  return { mean: sum / n, clippedLow: lo / n, clippedHigh: hi / n };
}

/** 64-bit difference hash as 16 hex chars. */
export function dHash(img: GrayImage): string {
  const s = resizeGray(img, 9, 8);
  let bits = '';
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += s.data[y * 9 + x]! > s.data[y * 9 + x + 1]! ? '1' : '0';
  let hex = '';
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

export function hamming(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

export type MediaQuality = {
  sharpness: number;
  meanLuma: number;
  tooDark: boolean;
  tooBright: boolean;
  blurry: boolean;
  hash: string;
  /** 0..1 composite used for ranking */
  score: number;
};

export const BLUR_THRESHOLD = 14;

/** Assess a thumbnail. Thumbnails of different sizes are normalised to 128px on the long side first. */
export function assessQuality(img: GrayImage): MediaQuality {
  const long = Math.max(img.w, img.h);
  const scale = long > 128 ? 128 / long : 1;
  const norm = scale < 1 ? resizeGray(img, Math.max(3, Math.round(img.w * scale)), Math.max(3, Math.round(img.h * scale))) : img;
  const sharpness = laplacianVariance(norm);
  const ex = exposure(norm);
  const tooDark = ex.mean < 28 || ex.clippedLow > 0.6;
  const tooBright = ex.mean > 232 || ex.clippedHigh > 0.6;
  const blurry = sharpness < BLUR_THRESHOLD;
  const sharpScore = Math.min(1, Math.log1p(sharpness) / Math.log1p(400));
  const expoScore = 1 - Math.min(1, Math.abs(ex.mean - 125) / 125);
  return {
    sharpness: Math.round(sharpness * 10) / 10,
    meanLuma: Math.round(ex.mean * 10) / 10,
    tooDark,
    tooBright,
    blurry,
    hash: dHash(norm),
    score: Math.round((0.7 * sharpScore + 0.3 * expoScore) * 1000) / 1000,
  };
}

export type DedupeItem = { id: string; hash: string; score: number; pinned?: boolean; takenAtMs?: number };

/**
 * Groups near-duplicates (Hamming distance <= threshold). Keeps the best-scoring item of each group
 * (pinned items always win), and reports which items were dropped and why.
 */
export function dedupe(items: DedupeItem[], threshold = 6): { kept: string[]; dropped: { id: string; duplicateOf: string }[] } {
  const order = [...items].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.score - a.score || a.id.localeCompare(b.id));
  const kept: DedupeItem[] = [];
  const dropped: { id: string; duplicateOf: string }[] = [];
  for (const it of order) {
    const twin = kept.find((k) => hamming(k.hash, it.hash) <= threshold);
    if (twin && !it.pinned) dropped.push({ id: it.id, duplicateOf: twin.id });
    else kept.push(it);
  }
  const keptIds = new Set(kept.map((k) => k.id));
  return { kept: items.filter((i) => keptIds.has(i.id)).map((i) => i.id), dropped };
}
