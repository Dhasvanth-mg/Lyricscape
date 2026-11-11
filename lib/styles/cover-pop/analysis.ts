// CVP-PRC-SAL-001..004: what the cover looks like, read once per cover from the renderer's 48x48 sample (no face recognition).
// 001 emptiness (flat, low-detail cells, the existing idea extended), 002 edge density, 003 colour variance, 004 a busy-ness
// score that steers the composition. Also the colour picks that read words against the pixels behind them (CVP-PAL-COL).
// Pure functions of the sample, so they are tested and the same cover always gives the same reading.

import { contrastRatio, mix } from '../../kinetic/util';

export const N = 48;
export type Map48 = Float32Array;
export type Box = { x: number; y: number; w: number; h: number }; // in cover uv (0..1)

export type CoverReading = {
  /** 0..1 per cell: 1 = empty enough for type */
  empty: Map48;
  edge: Map48;
  variance: Map48;
  /** 0..1, the share of the cover that is detailed */
  busy: number;
  /** mean luminance 0..1 */
  light: number;
  brightest: { x: number; y: number };
  /** the cover's colours, most common first (quantised) */
  colours: string[];
  /** true when the cover is mostly one flat colour or mostly text (a text-only cover cannot carry the style) */
  flat: boolean;
};

const lumOf = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

const cache = new WeakMap<Uint8ClampedArray, CoverReading>();

export function readCover(grid: Uint8ClampedArray): CoverReading {
  const hit = cache.get(grid);
  if (hit) return hit;
  const L = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) L[i] = lumOf(grid[i * 4]!, grid[i * 4 + 1]!, grid[i * 4 + 2]!);
  const at = (x: number, y: number) => L[Math.min(N - 1, Math.max(0, y)) * N + Math.min(N - 1, Math.max(0, x))]!;
  const edge = new Float32Array(N * N);
  const variance = new Float32Array(N * N);
  let lightSum = 0;
  let best = -1;
  let bx = 0.5;
  let by = 0.5;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = y * N + x;
      // Sobel magnitude
      const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
      const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
      edge[i] = Math.min(1, Math.hypot(gx, gy) * 1.4);
      // colour variance in a 3x3 window
      let mr = 0;
      let mg = 0;
      let mb = 0;
      const px: [number, number, number][] = [];
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const j = (Math.min(N - 1, Math.max(0, y + dy)) * N + Math.min(N - 1, Math.max(0, x + dx))) * 4;
          px.push([grid[j]!, grid[j + 1]!, grid[j + 2]!]);
          mr += grid[j]!;
          mg += grid[j + 1]!;
          mb += grid[j + 2]!;
        }
      mr /= 9;
      mg /= 9;
      mb /= 9;
      let v = 0;
      for (const [r, g, b] of px) v += (r - mr) ** 2 + (g - mg) ** 2 + (b - mb) ** 2;
      variance[i] = Math.min(1, Math.sqrt(v / 9) / 90);
      lightSum += L[i]!;
      // the brightest region, smoothed
      const sm = (at(x, y) * 4 + at(x - 2, y) + at(x + 2, y) + at(x, y - 2) + at(x, y + 2)) / 8;
      if (sm > best) {
        best = sm;
        bx = (x + 0.5) / N;
        by = (y + 0.5) / N;
      }
    }
  // emptiness: low edges and low variance, blurred a little so a region, not a cell, counts
  const raw = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) raw[i] = 1 - Math.min(1, edge[i]! * 0.6 + variance[i]! * 0.7);
  const empty = new Float32Array(N * N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let s = 0;
      let n = 0;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
          s += raw[yy * N + xx]!;
          n++;
        }
      empty[y * N + x] = s / n;
    }
  let busyCells = 0;
  for (let i = 0; i < N * N; i++) if (empty[i]! < 0.55) busyCells++;
  const busy = busyCells / (N * N);
  // colours: 4-bit quantised histogram
  const hist = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < N * N; i++) {
    const r = grid[i * 4]!;
    const g = grid[i * 4 + 1]!;
    const b = grid[i * 4 + 2]!;
    const k = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
    const e = hist.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += r;
    e.g += g;
    e.b += b;
    hist.set(k, e);
  }
  const top = [...hist.values()].sort((a, b) => b.n - a.n);
  const colours = top.slice(0, 8).map((e) => hex(e.r / e.n, e.g / e.n, e.b / e.n));
  const flat = (top[0]?.n ?? 0) / (N * N) > 0.82 || (busy < 0.04 && top.length < 4);
  const out: CoverReading = { empty, edge, variance, busy, light: lightSum / (N * N), brightest: { x: bx, y: by }, colours, flat };
  cache.set(grid, out);
  return out;
}

/** mean emptiness of a uv box */
export function emptinessOf(r: CoverReading, b: Box): number {
  const x0 = Math.max(0, Math.floor(b.x * N));
  const y0 = Math.max(0, Math.floor(b.y * N));
  const x1 = Math.min(N, Math.ceil((b.x + b.w) * N));
  const y1 = Math.min(N, Math.ceil((b.y + b.h) * N));
  let s = 0;
  let n = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      s += r.empty[y * N + x]!;
      n++;
    }
  return n ? s / n : 0;
}

/**
 * The emptiest place for a box of `w` x `h` (uv) inside `within`, searched on a coarse grid. Ties break toward the centre so
 * a flat cover puts type in the middle.
 */
export function emptiestBox(r: CoverReading | null, within: Box, w: number, h: number): Box {
  const ww = Math.min(w, within.w);
  const hh = Math.min(h, within.h);
  if (!r) return { x: within.x + (within.w - ww) / 2, y: within.y + (within.h - hh) / 2, w: ww, h: hh };
  let best: Box = { x: within.x + (within.w - ww) / 2, y: within.y + (within.h - hh) / 2, w: ww, h: hh };
  let bs = -1;
  const steps = 8;
  for (let j = 0; j <= steps; j++)
    for (let i = 0; i <= steps; i++) {
      const b = { x: within.x + ((within.w - ww) * i) / steps, y: within.y + ((within.h - hh) * j) / steps, w: ww, h: hh };
      const centre = 1 - Math.hypot(b.x + ww / 2 - (within.x + within.w / 2), b.y + hh / 2 - (within.y + within.h / 2)) / Math.max(within.w, within.h);
      const s = emptinessOf(r, b) + centre * 0.08;
      if (s > bs) {
        bs = s;
        best = b;
      }
    }
  return best;
}

/** the mean colour of the cover under a uv box */
export function colourBehind(grid: Uint8ClampedArray | null, b: Box): string {
  if (!grid) return '#000000';
  const x0 = Math.max(0, Math.floor(b.x * N));
  const y0 = Math.max(0, Math.floor(b.y * N));
  const x1 = Math.min(N, Math.max(x0 + 1, Math.ceil((b.x + b.w) * N)));
  const y1 = Math.min(N, Math.max(y0 + 1, Math.ceil((b.y + b.h) * N)));
  let r = 0;
  let g = 0;
  let bl = 0;
  let n = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * N + x) * 4;
      r += grid[i]!;
      g += grid[i + 1]!;
      bl += grid[i + 2]!;
      n++;
    }
  return n ? hex(r / n, g / n, bl / n) : '#000000';
}

/** the worst contrast of `c` against any cell under the box (the busy cell behind one letter is what fails, not the mean) */
export function worstContrast(grid: Uint8ClampedArray | null, b: Box, c: string): number {
  if (!grid) return 21;
  const x0 = Math.max(0, Math.floor(b.x * N));
  const y0 = Math.max(0, Math.floor(b.y * N));
  const x1 = Math.min(N, Math.max(x0 + 1, Math.ceil((b.x + b.w) * N)));
  const y1 = Math.min(N, Math.max(y0 + 1, Math.ceil((b.y + b.h) * N)));
  let worst = 21;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * N + x) * 4;
      worst = Math.min(worst, contrastRatio(c, hex(grid[i]!, grid[i + 1]!, grid[i + 2]!)));
    }
  return worst;
}

export type ColourRule = 'CVP-PAL-COL-001' | 'CVP-PAL-COL-002' | 'CVP-PAL-COL-003' | 'CVP-PAL-COL-004' | 'CVP-PAL-COL-005';

/** hot colours: saturated, light enough to sing on dark art, dark enough on light art */
const HOT = ['#ff3d6e', '#ffd23f', '#00e0c6', '#ff7a1a', '#b65cff', '#3dff8b', '#2b7bff', '#ff4dd8'];

function complement(c: string): string {
  const n = parseInt(c.slice(1), 16);
  return hex(255 - ((n >> 16) & 255), 255 - ((n >> 8) & 255), 255 - (n & 255));
}

/**
 * A word colour for a box on the cover (CVP-PAL-COL-001..005). The result must reach 4.5:1 against every cell behind the word;
 * if nothing does, the fallback is white with a dark outline (004), which the caller draws with an outline.
 */
export function wordColour(rule: ColourRule, grid: Uint8ClampedArray | null, b: Box, family: string[], duo: [string, string]): { fill: string; outline: string | null } {
  const behind = colourBehind(grid, b);
  const tryList = (list: string[]) => list.find((c) => worstContrast(grid, b, c) >= 4.5) ?? null;
  let pick: string | null = null;
  switch (rule) {
    case 'CVP-PAL-COL-001':
      pick = tryList([...family, ...HOT, '#ffffff', '#111111']);
      break;
    case 'CVP-PAL-COL-002':
      pick = tryList([...family, mix(family[0] ?? '#ffffff', '#ffffff', 0.5), mix(family[0] ?? '#000000', '#000000', 0.6)]);
      break;
    case 'CVP-PAL-COL-003':
      pick = tryList([complement(behind), mix(complement(behind), '#ffffff', 0.4), mix(complement(behind), '#000000', 0.5)]);
      break;
    case 'CVP-PAL-COL-005':
      pick = tryList([duo[0], duo[1]]);
      break;
    default:
      pick = null;
  }
  if (pick) return { fill: pick, outline: null };
  return { fill: '#ffffff', outline: '#14101c' };
}

/** the hot family for a section, from the cover's own colours pushed toward saturation */
export function hotFamily(reading: CoverReading | null, palette: string[], k: number): string[] {
  const src = reading ? reading.colours : palette;
  const base = src.length ? src : palette;
  const pick = base[k % base.length] ?? '#ff3d6e';
  const hot = HOT[k % HOT.length]!;
  return [mix(pick, hot, 0.55), hot, mix(hot, '#ffffff', 0.35)];
}
