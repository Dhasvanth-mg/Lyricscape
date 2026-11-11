// Konstrukt typesetting (typography.md): one grotesk family (Archivo, weight axis) for Latin, the Noto Sans of each other
// script at the nearest weight; sizes from a modular scale of the module height (4, 3, 2, 1.5, 1 modules and below, never under
// the cap-height floor of 4% of the frame height); flush left (flush right in right-to-left lines) with a balanced rag on word
// boundaries and no hyphenation; tight tracking for Latin only. Pure layout: the scene paints the words it places.

import type { Script } from '../sketch-cards/letter';
import type { WordLook } from './plan';

export type Measure = (font: string, text: string) => number;

const FAMILY: Record<Script, string> = {
  latin: '"Archivo Variable", "Noto Sans", sans-serif',
  devanagari: '"Noto Sans Devanagari Variable", sans-serif',
  tamil: '"Noto Sans Tamil Variable", sans-serif',
  arabic: '"Noto Sans Arabic Variable", sans-serif',
  hebrew: '"Noto Sans Hebrew Variable", sans-serif',
  other: '"Archivo Variable", "Noto Sans", sans-serif',
};
export const fontOf = (script: Script, weight: number, px: number) => `${weight} ${px.toFixed(1)}px ${FAMILY[script]}`;
/** Latin display tracking -1.5%; complex scripts keep their default spacing */
export const trackOf = (script: Script, px: number) => (script === 'latin' ? -0.015 * px : 0);
/** line spacing is a module subdivision: 1.05 of the size for Latin, more for scripts with tall marks */
export const leadOf = (script: Script) => (script === 'latin' || script === 'other' ? 1.05 : 1.32);
/** cap height of the faces as a share of the size (Archivo about 0.72) */
export const CAP = 0.72;

let seg: Intl.Segmenter | null = null;
export function graphemeCount(s: string): number {
  try {
    seg ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    let n = 0;
    for (const _ of seg.segment(s)) n++;
    return n;
  } catch {
    return [...s].length;
  }
}

export function wordWidth(measure: Measure, w: Pick<WordLook, 'text' | 'script'>, weight: number, px: number): number {
  return measure(fontOf(w.script, weight, px), w.text) + trackOf(w.script, px) * Math.max(0, graphemeCount(w.text) - 1);
}

export type Placed = { i: number; x: number; row: number; w: number };
export type Block = { size: number; lead: number; rows: number; placed: Placed[]; width: number; height: number; fits: boolean };

function wrapRows(widths: number[], space: number, maxW: number): number[][] {
  const rows: number[][] = [];
  let cur: number[] = [];
  let w = 0;
  widths.forEach((ww, i) => {
    const add = cur.length ? space + ww : ww;
    if (cur.length && w + add > maxW) {
      rows.push(cur);
      cur = [i];
      w = ww;
    } else {
      cur.push(i);
      w += add;
    }
  });
  if (cur.length) rows.push(cur);
  return rows;
}

/** the type sizes the scale allows for a module height, largest first, capped by the hook size (cap height 18% of H) */
export function scaleSizes(mh: number, H: number, maxModules = 4): number[] {
  const floor = (0.04 * H) / CAP;
  const hook = (0.18 * H) / CAP;
  const steps = [4, 3, 2, 1.5, 1, 0.75, 0.6, 0.5].filter((k) => k <= maxModules);
  const out = steps.map((k) => Math.min(hook, k * mh * 0.82)).filter((s) => s >= floor);
  if (!out.length || out[out.length - 1]! > floor * 1.001) out.push(floor);
  return [...new Set(out.map((s) => Math.round(s * 10) / 10))].sort((a, b) => b - a);
}

/**
 * Set a line in a slot: the largest size of the scale whose wrapped rows fit the slot, then the rag balanced by narrowing the
 * measure while the row count stays. Words are measured at the heaviest weight they will reach, so nothing shifts when a word's
 * weight steps. If nothing fits, the smallest size is used and `fits` is false.
 */
export function setBlock(measure: Measure, words: Pick<WordLook, 'text' | 'script'>[], maxW: number, maxH: number, sizes: number[], rtl: boolean, weight = 800): Block {
  const script = words.find((w) => w.script !== 'latin')?.script ?? 'latin';
  const lead = leadOf(script);
  let chosen: { size: number; rows: number[][]; widths: number[]; space: number } | null = null;
  for (const size of sizes) {
    const widths = words.map((w) => wordWidth(measure, w, weight, size));
    const space = measure(fontOf(script, weight, size), ' ');
    if (widths.some((w) => w > maxW)) continue;
    const rows = wrapRows(widths, space, maxW);
    if (rows.length * size * lead <= maxH) {
      chosen = { size, rows, widths, space };
      break;
    }
  }
  let fits = true;
  if (!chosen) {
    fits = false;
    const size = sizes[sizes.length - 1]!;
    const widths = words.map((w) => wordWidth(measure, w, weight, size));
    const space = measure(fontOf(script, weight, size), ' ');
    chosen = { size, rows: wrapRows(widths, space, maxW), widths, space };
  }
  // balanced rag: the narrowest measure that keeps the row count
  const { widths, space, size } = chosen;
  let rows = chosen.rows;
  if (rows.length > 1) {
    let lo = Math.max(...widths);
    let hi = maxW;
    for (let k = 0; k < 14; k++) {
      const mid = (lo + hi) / 2;
      if (wrapRows(widths, space, mid).length <= rows.length) hi = mid;
      else lo = mid;
    }
    rows = wrapRows(widths, space, hi);
  }
  const placed: Placed[] = [];
  let width = 0;
  rows.forEach((row, r) => {
    let x = 0;
    for (const i of row) {
      placed.push({ i, x, row: r, w: widths[i]! });
      x += widths[i]! + space;
    }
    width = Math.max(width, x - space);
  });
  if (rtl) {
    // flush right, words in reading order from the right
    for (const r of new Set(placed.map((p) => p.row))) {
      const inRow = placed.filter((p) => p.row === r);
      const rowW = inRow.reduce((a, p) => a + p.w, 0) + space * (inRow.length - 1);
      let x = maxW - rowW;
      for (const p of [...inRow].reverse()) {
        p.x = x;
        x += p.w + space;
      }
      // words were pushed in reading order; the last read is leftmost
    }
  }
  return { size, lead, rows: rows.length, placed, width, height: rows.length * size * lead, fits };
}
