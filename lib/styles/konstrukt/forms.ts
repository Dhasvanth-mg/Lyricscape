// Konstrukt shape choreographies (KON-GEO-*-*): each is the state of its forms after n steps, as a list of flat primitives.
// The scene asks for the state after the previous step and after the latest one and eases between them over one step
// (90-160 ms, ease-out quart), so forms snap and settle: no floating, rotation in 15-degree steps, sizes and positions in module
// steps. A form that appears grows from nothing on its centre (or along its axis); one that leaves shrinks back.
//
// Counters a choreography may read (steps, words sung, lines sung, downbeat hits) are all taken at the time of a step, so a
// state only ever changes on a step.

import type { Grid, Rect } from './grid';

/** 0 rect, 1 disc, 2 ring, 3 arc (or sector when its width reaches the diameter), 4 bar between two points, 5 triangle,
 * 6 wave line, 7 dot matrix */
export type Kind = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
/** 0 type ink, 1 second ink, 2 third ink, 3 extra ink (the primaries' yellow), 4 paper (knock-out), 5 and 6 low-contrast tints
 * of the second and third inks (waves and fields of small marks: no op-art flicker) */
export type InkIdx = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type Prim = { k: Kind; ink: InkIdx; x: number; y: number; a: number; b: number; rot: number; c: number; d: number; e: number; f: number };

export type ChoreoId = string;
export type FormCtx = {
  r: Rect;
  g: Grid;
  /** steps so far in the section */
  n: number;
  /** words and lines sung in the section by that step, downbeat hits so far, the section's index */
  words: number;
  lines: number;
  hits: number;
  section: number;
  /** accumulation and intensity, 0..3 (lines in the section, chorus, repeats) */
  level: number;
  /** forms that step per beat at this energy, 1..4 */
  per: number;
  /** letters per word of the line being sung (bar heights follow words, not a spectrum) */
  wordLens: number[];
  /** the current line's position in the song, 0..1 */
  songPos: number;
  seed: number;
  reduced: boolean;
};

const P = (k: Kind, ink: InkIdx, x: number, y: number, a = 0, b = 0, rot = 0, c = 0, d = 0, e = 0, f = 0): Prim => ({ k, ink, x, y, a, b, rot, c, d, e, f });
const DEG = Math.PI / 180;
const hash = (...n: number[]) => {
  let h = 2166136261;
  for (const v of n) h = Math.imul(h ^ Math.floor(v * 1000 + 7), 16777619);
  return ((h >>> 0) % 10007) / 10007;
};

/** module layout of a region */
function cells(c: FormCtx) {
  const { r, g } = c;
  const cols = Math.max(1, Math.round(r.w / g.mw));
  const rows = Math.max(1, Math.round(r.h / g.mh));
  const mw = r.w / cols;
  const mh = r.h / rows;
  const m = Math.min(mw, mh);
  const at = (i: number, j: number) => ({ x: r.x + (i + 0.5) * mw, y: r.y + (j + 0.5) * mh });
  return { cols, rows, mw, mh, m, at, cx: r.x + r.w / 2, cy: r.y + r.h / 2, s: Math.min(r.w, r.h) };
}

/** a dot matrix of up to 48 cells with the cells given on */
function matrix(c: FormCtx, on: (i: number, j: number, k: number) => boolean, ink: InkIdx = 1): Prim[] {
  const q = cells(c);
  let cols = q.cols;
  let rows = q.rows;
  while (cols * rows > 48) {
    if (cols >= rows) cols--;
    else rows--;
  }
  let lo = 0;
  let hi = 0;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      if (!on(i, j, k)) continue;
      if (k < 24) lo |= 1 << k;
      else hi |= 1 << (k - 24);
    }
  const w = cols * q.mw;
  const h = rows * q.mh;
  return [P(7, ink, q.cx, q.cy, w / 2, h / 2, cols, rows, lo, hi)];
}

/** spiral order of a cols x rows matrix, from the centre outward */
function spiralOrder(cols: number, rows: number): number[] {
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const idx: { k: number; d: number; a: number }[] = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) idx.push({ k: j * cols + i, d: Math.max(Math.abs(i - cx), Math.abs(j - cy)), a: Math.atan2(j - cy, i - cx) });
  return idx.sort((p, q) => p.d - q.d || p.a - q.a).map((x) => x.k);
}

const CHOREOS: Record<string, (c: FormCtx) => Prim[]> = {
  // ---- circles
  'KON-GEO-CIR-001': (c) => {
    const q = cells(c);
    const k = Math.min(q.cols, 6);
    const rowsUsed = Math.min(q.rows, 1 + Math.min(2, c.level));
    const out: Prim[] = [];
    for (let j = 0; j < rowsUsed; j++)
      for (let i = 0; i < k; i++) {
        const lead = (c.n + j) % (k + 1);
        const r = i === lead - 1 ? 0.47 : i < lead - 1 ? 0.3 : 0.1;
        const p = q.at(i + Math.floor((q.cols - k) / 2), j + Math.floor((q.rows - rowsUsed) / 2));
        out.push(P(1, i === lead - 1 ? 1 : 0, p.x, p.y, r * q.m));
      }
    return out;
  },
  'KON-GEO-CIR-002': (c) => {
    const q = cells(c);
    const s = q.s;
    const big = c.n % 2 === 0;
    const R = Math.min(q.mw * 1.6, s * 0.36);
    return [P(1, 1, q.cx - R * 1.05, q.cy, big ? R : R * 0.45), P(1, 0, q.cx + R * 1.05, q.cy, big ? R * 0.45 : R)];
  },
  'KON-GEO-CIR-003': (c) => {
    const q = cells(c);
    const R = q.s * 0.3;
    const ang = (c.reduced ? 0 : c.n * 30) * DEG;
    const orbit = R * 1.35;
    return [P(1, 1, q.cx, q.cy, R), P(2, 0, q.cx, q.cy, orbit, Math.max(1.5, q.m * 0.03)), P(1, 0, q.cx + Math.cos(ang) * orbit, q.cy + Math.sin(ang) * orbit, R * 0.22)];
  },
  'KON-GEO-CIR-004': (c) => {
    const q = cells(c);
    const rowsUsed = Math.min(q.rows, 1 + c.level);
    const total = q.cols * rowsUsed;
    const k = c.n % (total + 1);
    const out: Prim[] = [];
    for (let i = 0; i < total; i++) {
      const p = q.at(i % q.cols, Math.floor(i / q.cols) + Math.floor((q.rows - rowsUsed) / 2));
      out.push(P(1, i % 3 === 2 ? 0 : 1, p.x, p.y, i < k ? q.m * 0.44 : 0));
    }
    return out;
  },
  'KON-GEO-CIR-005': (c) => {
    const q = cells(c);
    const out: Prim[] = [];
    const n = Math.min(q.cols * q.rows, 12);
    for (let i = 0; i < n; i++) {
      const p = q.at(i % q.cols, Math.floor(i / q.cols) % q.rows);
      const turn = c.reduced ? i % 2 : (i + c.n) % 4;
      out.push(P(3, i % 2 ? 0 : 1, p.x, p.y, q.m * 0.46, q.m * 0.92, turn * 90 * DEG, Math.PI));
    }
    return out;
  },
  'KON-GEO-CIR-006': (c) => {
    const q = cells(c);
    const parts = [1, 2, 4][c.hits % 3]!;
    const R = (q.s * 0.42) / Math.sqrt(parts);
    const pos = parts === 1 ? [[0, 0]] : parts === 2 ? [[-1, 0], [1, 0]] : [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    return pos.map(([dx, dy], i) => P(1, i % 2 ? 0 : 1, q.cx + dx! * R * 1.05, q.cy + dy! * R * 1.05, R));
  },
  // ---- bars
  'KON-GEO-BAR-001': (c) => {
    const q = cells(c);
    const k = Math.min(q.cols, 8);
    const out: Prim[] = [];
    const base = c.r.y + c.r.h;
    for (let i = 0; i < k; i++) {
      const len = c.wordLens[(i + c.n) % Math.max(1, c.wordLens.length)] ?? 3;
      const hRows = Math.max(1, Math.min(q.rows, Math.round((len / 8) * q.rows)));
      const live = i <= c.n % (k + 1);
      const hh = live ? hRows * q.mh : 0;
      const x = c.r.x + (i + 0.5) * (c.r.w / k);
      out.push(P(0, i % 3 === 0 ? 1 : 0, x, base - hh / 2, (c.r.w / k) * 0.32, hh / 2));
    }
    return out;
  },
  'KON-GEO-BAR-002': (c) => {
    const q = cells(c);
    const rows = Math.min(q.rows, 6);
    const out: Prim[] = [];
    for (let j = 0; j < rows; j++) {
      const len = (((c.n + j * 2) % q.cols) + 1) * q.mw;
      const y = c.r.y + (j + 0.5) * (c.r.h / rows);
      out.push(P(0, j % 2 ? 0 : 1, c.r.x + len / 2, y, len / 2, (c.r.h / rows) * 0.28));
    }
    return out;
  },
  'KON-GEO-BAR-003': (c) => {
    const q = cells(c);
    const k = Math.min(q.rows * 2, 1 + c.lines + c.level);
    const out: Prim[] = [];
    const hh = q.mh * 0.38;
    for (let i = 0; i < k; i++) {
      const w = c.r.w * (0.35 + 0.65 * hash(c.seed, i));
      const y = c.r.y + c.r.h - (i + 0.5) * q.mh * 0.5;
      out.push(P(0, i % 2 ? 0 : 1, c.r.x + w / 2, y, w / 2, hh / 2));
    }
    return out;
  },
  'KON-GEO-BAR-004': (c) => {
    const q = cells(c);
    const total = Math.min(24, q.cols * 2);
    const on = c.n % (total + 1);
    const out: Prim[] = [];
    for (let i = 0; i < total; i++) {
      const x = c.r.x + (i + 0.5) * (c.r.w / total);
      out.push(P(0, 0, x, q.cy, (c.r.w / total) * 0.22, i < on ? c.r.h * 0.42 : 0));
    }
    return out;
  },
  'KON-GEO-BAR-005': (c) => {
    const q = cells(c);
    const i = c.n % q.cols;
    const p = q.at(i, 0);
    return [P(0, 1, p.x, q.cy, q.mw * 0.45, c.r.h / 2), P(0, 0, c.r.x + c.r.w / 2, c.r.y + c.r.h - q.mh * 0.08, c.r.w / 2, Math.max(1.5, q.mh * 0.04))];
  },
  'KON-GEO-BAR-006': (c) => {
    const q = cells(c);
    const rails = Math.min(c.r.w * 0.6, q.mw * 3);
    const x0 = q.cx - rails / 2;
    const rungs = Math.min(16, c.words % 17);
    const out: Prim[] = [P(0, 0, x0, q.cy, Math.max(2, q.m * 0.05), c.r.h / 2), P(0, 0, x0 + rails, q.cy, Math.max(2, q.m * 0.05), c.r.h / 2)];
    for (let i = 0; i < 16; i++) {
      const y = c.r.y + c.r.h - (i + 0.5) * (c.r.h / 16);
      out.push(P(0, 1, q.cx, y, i < rungs ? rails / 2 : 0, (c.r.h / 16) * 0.22));
    }
    return out;
  },
  // ---- arcs
  'KON-GEO-ARC-001': (c) => {
    const q = cells(c);
    const k = Math.min(4, Math.max(1, Math.floor(q.cols / 2)) * Math.max(1, Math.floor(q.rows / 2)));
    const out: Prim[] = [];
    for (let i = 0; i < k; i++) {
      const cc = Math.max(1, Math.floor(q.cols / 2));
      const p = { x: c.r.x + ((i % cc) + 0.5) * (c.r.w / cc), y: c.r.y + (Math.floor(i / cc) + 0.5) * (c.r.h / Math.max(1, Math.floor(q.rows / 2))) };
      const R = Math.min(c.r.w / cc, c.r.h / Math.max(1, Math.floor(q.rows / 2))) * 0.42;
      out.push(P(3, i % 2 ? 0 : 1, p.x, p.y, R, R * 0.3, ((c.reduced ? 0 : c.n * 15) + i * 90) * DEG, Math.PI / 2));
    }
    return out;
  },
  'KON-GEO-ARC-002': (c) => {
    const q = cells(c);
    const out: Prim[] = [];
    for (let i = 0; i < 4; i++) {
      const R = q.s * (0.46 - i * 0.1);
      const flip = (i + (c.reduced ? 0 : c.n)) % 2;
      out.push(P(3, i % 2 ? 0 : 1, q.cx, q.cy, R, q.s * 0.05, flip ? Math.PI : 0, Math.PI));
    }
    return out;
  },
  'KON-GEO-ARC-003': (c) => {
    const q = cells(c);
    const k = Math.min(12, c.words % 13);
    const out: Prim[] = [];
    const R = q.s * 0.46;
    for (let i = 0; i < 12; i++) out.push(P(3, i % 2 ? 0 : 1, q.cx, q.cy + R * 0.5, R, R * 2, Math.PI + i * 15 * DEG, i < k ? 14 * DEG : 0));
    return out;
  },
  'KON-GEO-ARC-004': (c) => {
    const q = cells(c);
    const k = Math.min(6, 1 + c.lines + c.level);
    const out: Prim[] = [];
    const base = c.r.y + c.r.h * 0.92;
    for (let i = 0; i < 6; i++) {
      const R = Math.min(c.r.w * 0.48, c.r.h * 0.85) * (1 - i * 0.15);
      out.push(P(3, i % 2 ? 0 : 1, q.cx, base, R, R * 0.12, Math.PI, i < k ? Math.PI : 0));
    }
    return out;
  },
  'KON-GEO-ARC-005': (c) => {
    const q = cells(c);
    const R = Math.min(c.r.w * 0.45, c.r.h * 0.8);
    const base = c.r.y + c.r.h * 0.9;
    const ang = Math.PI + (c.reduced ? 6 : c.n % 13) * 15 * DEG;
    return [P(3, 0, q.cx, base, R, Math.max(2, q.m * 0.06), Math.PI, Math.PI), P(1, 1, q.cx + Math.cos(ang) * R, base + Math.sin(ang) * R, q.m * 0.32)];
  },
  // ---- diagonals
  'KON-GEO-DIA-001': (c) => {
    const q = cells(c);
    const total = Math.min(16, q.cols * 2);
    const k = c.n % (total + 1);
    const out: Prim[] = [];
    for (let i = 0; i < total; i++) {
      const x = c.r.x + (i / total) * c.r.w;
      const len = Math.min(c.r.h, q.mw * 2.2);
      out.push(P(4, i % 4 === 0 ? 1 : 0, x, q.cy + len / 2, i < k ? q.m * 0.14 : 0, 0, 0, x + len * 0.7, q.cy - len / 2));
    }
    return out;
  },
  'KON-GEO-DIA-002': (c) => {
    const q = cells(c);
    const off = (c.n % q.cols) * q.mw;
    const x = c.r.x + q.mw * 0.6 + off;
    const hh = Math.min(c.r.h * 0.42, q.mw * 2);
    const tip = x + hh * 0.9;
    return [P(4, 1, x, q.cy - hh, q.m * 0.32, 0, 0, tip, q.cy), P(4, 1, x, q.cy + hh, q.m * 0.32, 0, 0, tip, q.cy)];
  },
  'KON-GEO-DIA-003': (c) => {
    const q = cells(c);
    const out: Prim[] = [];
    const nx = Math.min(8, q.cols * 2);
    const ny = Math.min(5, q.rows * 2);
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const x = c.r.x + ((i + 0.5) / nx) * c.r.w;
        const y = c.r.y + ((j + 0.5) / ny) * c.r.h;
        const len = Math.min(c.r.w / nx, c.r.h / ny) * 0.35;
        const on = hash(c.seed, i, j, c.n) < 0.55;
        out.push(P(4, 5, x - len, y + len, on ? Math.max(2, q.m * 0.06) : 0, 0, 0, x + len, y - len));
      }
    return out.slice(0, 40);
  },
  'KON-GEO-DIA-004': (c) => {
    const q = cells(c);
    const off = ((c.n % q.cols) - q.cols / 2) * q.mw;
    const L = Math.hypot(c.r.w, c.r.h);
    return [P(4, 1, q.cx + off - L / 2, q.cy + L / 2, q.m * 0.45, 0, 0, q.cx + off + L / 2, q.cy - L / 2)];
  },
  'KON-GEO-DIA-005': (c) => {
    const q = cells(c);
    const L = Math.hypot(c.r.w, c.r.h) * 0.6;
    const off = ((c.hits % 3) - 1) * q.mw;
    return [P(4, 1, q.cx - L / 2 + off, q.cy + L / 2, q.m * 0.36, 0, 0, q.cx + L / 2 + off, q.cy - L / 2), P(4, 0, q.cx - L / 2 - off, q.cy - L / 2, q.m * 0.36, 0, 0, q.cx + L / 2 - off, q.cy + L / 2)];
  },
  // ---- dot matrix
  'KON-GEO-DOT-001': (c) => matrix(c, (_i, _j, k) => k < c.n % 49),
  'KON-GEO-DOT-002': (c) => {
    const q = cells(c);
    let cols = q.cols;
    let rows = q.rows;
    while (cols * rows > 48) cols >= rows ? cols-- : rows--;
    const order = spiralOrder(cols, rows);
    const k = c.n % (order.length + 1);
    const on = new Set(order.slice(0, k));
    return matrix(c, (_i, _j, kk) => on.has(kk));
  },
  'KON-GEO-DOT-003': (c) => {
    const q = cells(c);
    let cols = q.cols;
    let rows = q.rows;
    while (cols * rows > 48) cols >= rows ? cols-- : rows--;
    let i = Math.floor(cols / 2);
    let j = Math.floor(rows / 2);
    for (let s = 0; s < c.n; s++) {
      const d = Math.floor(hash(c.seed, s) * 4);
      i = Math.max(0, Math.min(cols - 1, i + (d === 0 ? 1 : d === 1 ? -1 : 0)));
      j = Math.max(0, Math.min(rows - 1, j + (d === 2 ? 1 : d === 3 ? -1 : 0)));
    }
    const mw = (cols * q.mw) / cols;
    const x0 = q.cx - (cols * q.mw) / 2;
    const y0 = q.cy - (rows * q.mh) / 2;
    return [...matrix(c, () => true, 5), P(1, 1, x0 + (i + 0.5) * mw, y0 + (j + 0.5) * q.mh, Math.min(q.mw, q.mh) * 0.4)];
  },
  'KON-GEO-DOT-004': (c) => matrix(c, (_i, _j, k) => k < Math.min(48, c.words)),
  'KON-GEO-DOT-005': (c) => matrix(c, (_i, j) => (j + c.n) % 2 === 0),
  // ---- rings
  'KON-GEO-RNG-001': (c) => rings(c, 1 + (c.n % 6), (i) => (i % 2 ? 0 : 1), 0.06),
  'KON-GEO-RNG-002': (c) => rings(c, 6 - (c.n % 6), (i) => (i % 2 ? 0 : 1), 0.06),
  'KON-GEO-RNG-003': (c) => {
    const bar = Math.floor(c.n / 4);
    return rings(c, 5, (i) => (i % 2 ? 0 : 1), 0, (i) => ((i + bar) % 2 ? 0.11 : 0.03));
  },
  'KON-GEO-RNG-004': (c) => {
    const q = cells(c);
    const out = rings(c, 4, (i) => (i === 0 ? 1 : 0), 0.04);
    out.push(P(1, 1, q.cx, q.cy, q.s * 0.07 * (1 + (c.hits % 3) * 0.45)));
    return out;
  },
  'KON-GEO-RNG-005': (c) => {
    const q = cells(c);
    const off = ((c.section % 3) - 1) * 0.5 * q.mw;
    return rings(c, 2 + (c.n % 4), (i) => (i % 2 ? 0 : 1), 0.05, undefined, off);
  },
  // ---- squares
  'KON-GEO-SQR-001': (c) => {
    const q = cells(c);
    const out: Prim[] = [];
    const n = Math.min(q.cols * q.rows, 40);
    for (let k = 0; k < n; k++) {
      const p = q.at(k % q.cols, Math.floor(k / q.cols));
      out.push(P(0, hash(c.seed, k, c.n) < 0.5 ? 1 : 0, p.x, p.y, q.mw * 0.42, q.mh * 0.42));
    }
    return out;
  },
  'KON-GEO-SQR-002': (c) => {
    const q = cells(c);
    const out: Prim[] = [];
    const n = Math.min(q.cols * q.rows, 24);
    const rot = c.reduced ? 0 : (c.n % 4) * 15 * DEG;
    for (let k = 0; k < n; k++) {
      const p = q.at(k % q.cols, Math.floor(k / q.cols));
      out.push(P(0, k % 3 === 0 ? 1 : 0, p.x, p.y, q.m * 0.3, q.m * 0.3, rot));
    }
    return out;
  },
  'KON-GEO-SQR-003': (c) => {
    const q = cells(c);
    const k = 1 + (c.n % 5);
    const out: Prim[] = [];
    for (let i = 0; i < 5; i++) {
      const s = q.s * 0.46 * (1 - i * 0.18);
      out.push(P(0, i % 2 ? 4 : i === 0 ? 1 : 0, q.cx, q.cy, i < k ? s : 0, i < k ? s : 0));
    }
    return out;
  },
  'KON-GEO-SQR-004': (c) => {
    const q = cells(c);
    const out: Prim[] = [];
    const n = Math.min(q.cols * q.rows, 40);
    let on = 0;
    for (let k = 0; k < n; k++) {
      const i = k % q.cols;
      const j = Math.floor(k / q.cols);
      if ((i + j) % 2) continue;
      const p = q.at(i, j);
      out.push(P(0, 1, p.x, p.y, on < c.words ? q.mw / 2 : 0, on < c.words ? q.mh / 2 : 0));
      on++;
    }
    return out;
  },
  'KON-GEO-SQR-005': (c) => {
    const q = cells(c);
    const k = Math.min(Math.min(q.cols, q.rows), 1 + c.lines);
    const out: Prim[] = [];
    const n = Math.min(q.cols, q.rows);
    for (let i = 0; i < n; i++) {
      const p = q.at(i, q.rows - 1 - i);
      out.push(P(0, i % 2 ? 0 : 1, p.x, p.y, i < k ? q.m * 0.5 : 0, i < k ? q.m * 0.5 : 0));
    }
    return out;
  },
  // ---- waves (low-contrast tints only while they move)
  'KON-GEO-WAV-001': (c) => waves(c, 5, (i) => (c.reduced ? 0 : c.n * 45 * DEG) + i * 0.4, () => 0.32, 5),
  'KON-GEO-WAV-002': (c) => waves(c, 5, (i) => i * 0.5, () => 0.08 + 0.36 * c.songPos, 5),
  'KON-GEO-WAV-003': (c) => {
    const q = cells(c);
    return [P(6, 1, q.cx, q.cy, c.r.w / 2, c.r.h / 2, 0, c.r.h * 0.22, Math.max(q.mw * 2, c.r.w / 2), c.reduced ? 0 : c.n * 45 * DEG, q.m * 0.32)];
  },
  'KON-GEO-WAV-004': (c) => [...waves(c, 4, (i) => (c.reduced ? 0 : c.n * 30 * DEG) + i * 0.3, () => 0.3, 5), ...waves(c, 4, (i) => -(c.reduced ? 0 : c.n * 30 * DEG) - i * 0.3, () => 0.3, 6, 0.5)],
  // ---- rules
  'KON-GEO-RUL-001': (c) => {
    const q = cells(c);
    const rows = Math.min(q.rows * 2, 10);
    const out: Prim[] = [];
    for (let j = 0; j < rows; j++) {
      const len = j < (c.n % (rows + 1)) ? c.r.w * (0.4 + 0.6 * hash(c.seed, j)) : 0;
      const y = c.r.y + (j + 1) * (c.r.h / (rows + 1));
      out.push(P(0, j === 0 ? 1 : 0, c.r.x + len / 2, y, len / 2, Math.max(1, q.mh * (j === 0 ? 0.05 : 0.015))));
    }
    return out;
  },
  'KON-GEO-RUL-002': (c) => {
    const q = cells(c);
    const out: Prim[] = [];
    for (let i = 0; i <= q.cols; i++) {
      const on = i <= c.n % (q.cols + 2);
      out.push(P(0, 0, c.r.x + i * q.mw, q.cy, Math.max(0.75, q.m * 0.012), on ? c.r.h / 2 : 0));
    }
    return out;
  },
  // numerals are type (drawn by the scene); the form layer carries a short accent rule
  'KON-GEO-RUL-003': (c) => {
    const q = cells(c);
    return [P(0, 1, c.r.x + q.mw, c.r.y + q.mh * 0.15, q.mw, Math.max(2, q.mh * 0.06))];
  },
  'KON-GEO-RUL-004': (c) => {
    const q = cells(c);
    const total = Math.min(40, Math.max(8, q.rows * 4));
    const out: Prim[] = [];
    for (let i = 0; i < total; i++) {
      const y = c.r.y + (i + 0.5) * (c.r.h / total);
      const long = i % 4 === 0;
      const len = i < c.lines ? q.mw * (long ? 0.5 : 0.25) : 0;
      out.push(P(0, long ? 1 : 0, c.r.x + len / 2, y, len / 2, Math.max(0.75, (c.r.h / total) * 0.12)));
    }
    return out;
  },
  // ---- constructivist mix
  'KON-GEO-MIX-001': (c) => {
    const q = cells(c);
    const by = q.cy + q.s * 0.12;
    const bw = c.r.w * 0.42;
    const pos = ((c.n % 5) - 2) / 2;
    const R = q.s * 0.16;
    return [P(4, 0, q.cx - bw, by + bw * 0.06 * pos, q.m * 0.16, 0, 0, q.cx + bw, by - bw * 0.06 * pos), P(1, 1, q.cx + pos * bw * 0.8, by - R - q.m * 0.1 - bw * 0.06 * pos * pos, R)];
  },
  'KON-GEO-MIX-002': (c) => {
    const q = cells(c);
    const R = q.s * 0.4;
    const off = ((c.n % 3) - 1) * q.m * 0.6;
    return [P(1, 1, q.cx, q.cy, R), P(4, 4, q.cx - R * 1.3 + off, q.cy + R * 1.3, q.m * 0.28, 0, 0, q.cx + R * 1.3 + off, q.cy - R * 1.3), P(4, 0, q.cx - R * 1.4 - off, q.cy + R * 0.5, q.m * 0.12, 0, 0, q.cx + R * 0.6 - off, q.cy - R * 1.5)];
  },
  'KON-GEO-MIX-003': (c) => {
    const q = cells(c);
    const R = Math.min(c.r.w * 0.42, c.r.h * 0.5);
    const base = c.r.y + c.r.h * 0.95;
    const out: Prim[] = [P(3, 1, q.cx, base - R * 0.15, R, R * 0.28, Math.PI, Math.PI)];
    const k = 1 + (c.n % 6);
    for (let i = 0; i < 6; i++) {
      const x = q.cx - R + (i + 0.5) * ((2 * R) / 6);
      const hh = i < k ? R * 0.55 * (0.4 + 0.6 * hash(c.seed, i)) : 0;
      out.push(P(0, 0, x, base - hh / 2, (R / 6) * 0.5, hh / 2));
    }
    return out;
  },
  'KON-GEO-MIX-004': (c) => {
    const q = cells(c);
    const s = Math.min(c.r.w / 3.4, c.r.h * 0.8) * 0.42;
    const turn = c.n % 3;
    const sc = (i: number) => (i === turn ? 1 : 0.6);
    const xs = [q.cx - s * 2.4, q.cx, q.cx + s * 2.4];
    return [P(1, 1, xs[0]!, q.cy, s * sc(0)), P(0, 3, xs[1]!, q.cy, s * 0.85 * sc(1), s * 0.85 * sc(1)), P(5, 0, xs[2]!, q.cy + s * 0.15, s * 1.15 * sc(2), 0, c.reduced ? 0 : (turn === 2 ? 15 : 0) * DEG)];
  },
};

function rings(c: FormCtx, k: number, inkOf: (i: number) => InkIdx, wk: number, wOf?: (i: number) => number, off = 0): Prim[] {
  const q = cells(c);
  const out: Prim[] = [];
  const N = 6;
  for (let i = 0; i < N; i++) {
    const R = q.s * 0.47 * ((i + 1) / N);
    const w = q.s * 0.47 * (wOf ? wOf(i) : wk);
    out.push(P(2, inkOf(i), q.cx + off * (i / N), q.cy, i < k ? R : 0, i < k ? Math.max(1.5, w) : 0));
  }
  return out;
}

function waves(c: FormCtx, n: number, phase: (i: number) => number, amp: (i: number) => number, ink: InkIdx, shift = 0): Prim[] {
  const q = cells(c);
  const out: Prim[] = [];
  for (let i = 0; i < n; i++) {
    const y = c.r.y + ((i + 0.5 + shift) / n) * c.r.h;
    out.push(P(6, ink, q.cx, y, c.r.w / 2, c.r.h / n, 0, amp(i) * (c.r.h / n), Math.max(q.mw * 1.5, c.r.w / 3), phase(i), Math.max(1.5, q.m * 0.06)));
  }
  return out;
}

export const CHOREO_IDS = Object.keys(CHOREOS);
/** the choreographies of a shape family (KON-GEO-CIR, BAR, ...) */
export const familyChoreos = (fam: string) => CHOREO_IDS.filter((id) => id.startsWith(fam + '-'));

export function choreo(id: string, c: FormCtx): Prim[] {
  const f = CHOREOS[id] ?? CHOREOS['KON-GEO-CIR-001']!;
  return f(c);
}

/** the giant form of composition C7, in the scene family's form */
export function giantForm(fam: string, c: FormCtx, centre: { x: number; y: number; r: number }, bar: boolean): Prim[] {
  const step = c.reduced ? 0 : c.n % 4;
  const m = Math.min(c.g.mw, c.g.mh);
  if (bar) return [P(0, 1, centre.x, centre.y, centre.r * 0.3 + step * m * 0.25, c.g.H)];
  switch (fam) {
    case 'KON-GEO-RNG':
      return Array.from({ length: 6 }, (_, i) => P(2, i % 2 ? 0 : 1, centre.x, centre.y, i < 2 + step ? centre.r * (1 - i * 0.15) : 0, centre.r * 0.05));
    case 'KON-GEO-ARC':
      return [P(3, 1, centre.x, centre.y, centre.r, centre.r * 0.35, (180 + step * 15) * DEG, Math.PI), P(3, 0, centre.x, centre.y, centre.r * 0.55, centre.r * 0.08, (step * 15) * DEG, Math.PI / 2)];
    case 'KON-GEO-WAV':
      return [P(6, 5, centre.x, centre.y, c.g.W, centre.r, 0, centre.r * 0.35, centre.r * 2.2, step * 45 * DEG, centre.r * 0.4)];
    case 'KON-GEO-RUL':
      return [P(0, 1, centre.x, centre.y, m * 0.25, c.g.H)];
    default:
      return [P(1, 1, centre.x, centre.y, centre.r * (1 - step * 0.025)), P(1, 0, centre.x - centre.r * 0.62, centre.y - centre.r * 0.62, step % 2 ? m * 0.5 : m * 0.35)];
  }
}

/** the same primitive at nothing: shapes grow from their centre, bars from their first end */
function zero(p: Prim): Prim {
  switch (p.k) {
    case 3:
      return { ...p, c: 0 };
    case 4:
      return { ...p, c: p.x, d: p.y };
    case 6:
      return { ...p, f: 0 };
    case 7:
      return p;
    default:
      return { ...p, a: 0, b: p.k === 0 ? 0 : p.b };
  }
}

const L = (a: number, b: number, t: number) => a + (b - a) * t;
/** ease between two states (the state after the previous step and after this one) */
export function lerpPrims(from: Prim[], to: Prim[], t: number): Prim[] {
  if (t >= 1) return to;
  const n = Math.max(from.length, to.length);
  const out: Prim[] = [];
  for (let i = 0; i < n; i++) {
    const b0 = to[i];
    const a0 = from[i];
    const a = a0 ?? zero(b0!);
    const b = b0 ?? zero(a0!);
    if (a.k !== b.k || b.k === 7) {
      out.push(t < 0.5 ? a : b);
      continue;
    }
    out.push({ k: b.k, ink: t < 0.5 ? a.ink : b.ink, x: L(a.x, b.x, t), y: L(a.y, b.y, t), a: L(a.a, b.a, t), b: L(a.b, b.b, t), rot: L(a.rot, b.rot, t), c: L(a.c, b.c, t), d: L(a.d, b.d, t), e: L(a.e, b.e, t), f: L(a.f, b.f, t) });
  }
  return out;
}

/** ease-out quart (motion.md "Easing") */
export const easeOutQuart = (x: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 4);
