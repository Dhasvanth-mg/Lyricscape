// Cover Pop type: CVP-TYP-VOI-001..009 voices, phrase splitting (short phrases, honest about timing) and CVP-LAY-PHL-001..014
// phrase layouts that arrange 1-4 words inside a region. Pure layout maths: the scene measures text through the host and draws.

import type { WordCue } from '../../kinetic/types';
import type { LineTiming } from '../timing';

export type VoiceId = `CVP-TYP-VOI-00${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;
export type Voice = { id: VoiceId; name: string; family: string; weight: number; italic: boolean; upper: boolean; /** line height as a share of the size */ lh: number };

export const VOICES: Record<VoiceId, Voice> = {
  'CVP-TYP-VOI-001': { id: 'CVP-TYP-VOI-001', name: 'Rounded heavy italic', family: 'Nunito', weight: 900, italic: true, upper: false, lh: 1.0 },
  'CVP-TYP-VOI-002': { id: 'CVP-TYP-VOI-002', name: 'Condensed grotesk', family: 'Bebas Neue', weight: 400, italic: false, upper: true, lh: 0.9 },
  'CVP-TYP-VOI-003': { id: 'CVP-TYP-VOI-003', name: 'Heavy grotesk', family: 'Archivo Variable', weight: 900, italic: false, upper: false, lh: 1.0 },
  'CVP-TYP-VOI-004': { id: 'CVP-TYP-VOI-004', name: 'Serif display', family: 'DM Serif Display', weight: 400, italic: false, upper: false, lh: 1.05 },
  'CVP-TYP-VOI-005': { id: 'CVP-TYP-VOI-005', name: 'Wide display', family: 'Syne Variable', weight: 800, italic: false, upper: true, lh: 1.0 },
  'CVP-TYP-VOI-006': { id: 'CVP-TYP-VOI-006', name: 'Retro script', family: 'Shrikhand', weight: 400, italic: false, upper: false, lh: 1.15 },
  'CVP-TYP-VOI-007': { id: 'CVP-TYP-VOI-007', name: 'Devanagari heavy', family: 'Noto Sans Devanagari Variable', weight: 900, italic: false, upper: false, lh: 1.35 },
  'CVP-TYP-VOI-008': { id: 'CVP-TYP-VOI-008', name: 'Tamil heavy', family: 'Noto Sans Tamil Variable', weight: 900, italic: false, upper: false, lh: 1.35 },
  'CVP-TYP-VOI-009': { id: 'CVP-TYP-VOI-009', name: 'Arabic and Hebrew heavy', family: 'Noto Sans Arabic Variable', weight: 800, italic: false, upper: false, lh: 1.35 },
};
export const LATIN_VOICES: VoiceId[] = ['CVP-TYP-VOI-001', 'CVP-TYP-VOI-002', 'CVP-TYP-VOI-003', 'CVP-TYP-VOI-004', 'CVP-TYP-VOI-005', 'CVP-TYP-VOI-006'];

export type Script = 'latin' | 'devanagari' | 'tamil' | 'arabic' | 'hebrew' | 'other';
/** the voice a script must use (no italic, no upper-casing, a face that has it) */
export function voiceForScript(script: Script, latin: VoiceId): Voice {
  if (script === 'devanagari') return VOICES['CVP-TYP-VOI-007'];
  if (script === 'tamil') return VOICES['CVP-TYP-VOI-008'];
  if (script === 'arabic') return VOICES['CVP-TYP-VOI-009'];
  if (script === 'hebrew') return { ...VOICES['CVP-TYP-VOI-009'], family: 'Noto Sans Hebrew Variable' };
  return VOICES[latin];
}
export const fontOf = (v: Voice, px: number) => `${v.italic ? 'italic ' : ''}${v.weight} ${Math.round(px)}px "${v.family}", sans-serif`;
export const labelOf = (v: Voice, text: string) => (v.upper ? text.toUpperCase() : text);

// ---- phrases -----------------------------------------------------------------------------------------------------------------
export type Phrase = {
  /** word indices into the line */
  words: number[];
  /** ms from the line start when the phrase pops */
  at: number;
  /** stacked rows of at most 4 words (an unsplit long line is shown as rows, all at once) */
  rows: number[][];
};

const MAX_WORDS = 4;

/**
 * Split a line into phrases. Authored word times: phrases of 2-4 words (2-3 when the line is dense), split where the singer
 * pauses, each popping on its first word. Estimated or no word times: one phrase, never split by time (the brief's honesty
 * rule), laid out in rows of at most four words.
 */
export function splitPhrases(words: Pick<WordCue, 'startMs' | 'endMs' | 'text'>[], lineStartMs: number, timing: LineTiming): Phrase[] {
  const n = words.length;
  if (!n) return [];
  const rows = (idx: number[]) => {
    const out: number[][] = [];
    const per = idx.length <= 4 ? idx.length : Math.ceil(idx.length / Math.ceil(idx.length / 3));
    for (let i = 0; i < idx.length; i += per) out.push(idx.slice(i, i + per));
    return out;
  };
  if (timing !== 'authored') {
    const all = [...words.keys()];
    return [{ words: all, at: 0, rows: rows(all) }];
  }
  const dense = n >= 9;
  const cap = dense ? 3 : MAX_WORDS;
  const out: Phrase[] = [];
  let cur: number[] = [];
  for (let i = 0; i < n; i++) {
    cur.push(i);
    const gap = i < n - 1 ? words[i + 1]!.startMs - words[i]!.endMs : 0;
    const left = n - 1 - i;
    // split at a pause (>= 180 ms), or at the cap, never leaving a single orphan word if it can be avoided
    if (i < n - 1 && (cur.length >= cap || (gap >= 180 && cur.length >= 2 && left !== 1))) {
      // at the cap with one word left: hand the last word on, so the line never ends on a lone word
      const carry = left === 1 && cur.length >= 3 ? cur.pop()! : null;
      out.push({ words: cur, at: Math.max(0, words[cur[0]!]!.startMs - lineStartMs), rows: [cur] });
      cur = carry === null ? [] : [carry];
    }
  }
  if (cur.length) out.push({ words: cur, at: Math.max(0, words[cur[0]!]!.startMs - lineStartMs), rows: [cur] });
  return out;
}

// ---- layouts -----------------------------------------------------------------------------------------------------------------
export type LayoutId = `CVP-LAY-PHL-0${'01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12' | '13' | '14'}`;
export const LAYOUT_IDS: LayoutId[] = Array.from({ length: 14 }, (_, i) => `CVP-LAY-PHL-${String(i + 1).padStart(3, '0')}` as LayoutId);

export type Region = { x: number; y: number; w: number; h: number };
export type PlacedWord = { idx: number; x: number; y: number; size: number; /** text width at that size */ w: number };

type Row = { words: number[]; align: number; /** 0 = left, 0.5 = centre, 1 = right */ k: number[]; /** size multipliers per word */ dx?: number };

function rowsFor(id: LayoutId, words: number[], chip: number | null, given: number[][]): { rows: Row[]; v: 'centre' | 'top' | 'bottom' | 'split' | 'spread' } {
  const one = (k: number) => words.map(() => k);
  const per = (rs: number[][], align: number) => rs.map((r) => ({ words: r, align, k: r.map(() => 1) }));
  switch (id) {
    case 'CVP-LAY-PHL-001':
      return { rows: given.map((r) => ({ words: r, align: 0.5, k: r.map(() => 1) })), v: 'centre' };
    case 'CVP-LAY-PHL-002':
      return { rows: per(words.map((w) => [w]), 0), v: 'centre' };
    case 'CVP-LAY-PHL-003':
      return { rows: per(words.map((w) => [w]), 0.5), v: 'centre' };
    case 'CVP-LAY-PHL-004':
      return { rows: words.map((w, i) => ({ words: [w], align: words.length > 1 ? i / (words.length - 1) : 0.5, k: [1] })), v: 'centre' };
    case 'CVP-LAY-PHL-005': {
      const big = chip ?? words[words.length - 1]!;
      const rest = words.filter((w) => w !== big);
      return { rows: [{ words: [big], align: 0.5, k: [1.6] }, ...(rest.length ? [{ words: rest, align: 0.5, k: rest.map(() => 0.55) }] : [])], v: 'centre' };
    }
    case 'CVP-LAY-PHL-006': {
      const h = Math.ceil(words.length / 2);
      return { rows: [{ words: words.slice(0, h), align: 0, k: one(1).slice(0, h) }, { words: words.slice(h), align: 1, k: one(1).slice(h) }].filter((r) => r.words.length), v: 'spread' };
    }
    case 'CVP-LAY-PHL-007':
      return { rows: words.map((w, i) => ({ words: [w], align: 0.5, k: [0.7 + (i / Math.max(1, words.length - 1)) * 0.6] })), v: 'centre' };
    case 'CVP-LAY-PHL-008':
      return { rows: given.map((r) => ({ words: r, align: 0.5, k: r.map(() => 1) })), v: 'bottom' };
    case 'CVP-LAY-PHL-009':
      return { rows: given.map((r) => ({ words: r, align: 0.5, k: r.map(() => 1) })), v: 'top' };
    case 'CVP-LAY-PHL-010':
      return { rows: words.map((w, i) => ({ words: [w], align: words.length > 1 ? 0.1 + (0.8 * i) / (words.length - 1) : 0.5, k: [1] })), v: 'spread' };
    case 'CVP-LAY-PHL-011':
      return { rows: given.map((r) => ({ words: r, align: 0.5, k: r.map((w) => (w === chip ? 1.45 : 0.8)) })), v: 'centre' };
    case 'CVP-LAY-PHL-012': {
      const h = Math.ceil(words.length / 2);
      return { rows: [{ words: words.slice(0, h), align: 0.5, k: words.slice(0, h).map(() => 1) }, { words: words.slice(h), align: 0.5, k: words.slice(h).map(() => 1) }].filter((r) => r.words.length), v: 'split' };
    }
    case 'CVP-LAY-PHL-013':
      return { rows: per(words.map((w) => [w]), 0), v: 'top' };
    default: {
      // tight block: rows of two, each row scaled to the same width (justified)
      const rs: number[][] = [];
      for (let i = 0; i < words.length; i += 2) rs.push(words.slice(i, i + 2));
      return { rows: rs.map((r) => ({ words: r, align: 0.5, k: r.map(() => 1), dx: -1 })), v: 'centre' };
    }
  }
}

/**
 * Place a phrase's words in `region` (frame px) with a layout. `measure(i, size)` is the width of word i at a size. The base
 * size is the largest that fits, capped so a cap height stays within 7-14% of the frame height (`capMin`, `capMax` in px).
 */
export function placePhrase(id: LayoutId, phrase: Phrase, chip: number | null, region: Region, measure: (i: number, size: number) => number, lh: number, sizeMax: number, rtl: boolean): PlacedWord[] {
  const { rows, v } = rowsFor(id, phrase.words, chip, phrase.rows);
  const gapK = 0.28;
  const rowW = (r: Row, s: number) => r.words.reduce((a, w, i) => a + measure(w, s * r.k[i]!), 0) + (r.words.length - 1) * s * gapK;
  const rowH = (r: Row, s: number) => Math.max(...r.k) * s * lh;
  const fits = (s: number): boolean => {
    // justified rows are scaled to the widest row, so the widest row is the width either way
    const tw = Math.max(...rows.map((r) => rowW(r, s)));
    const th = rows.reduce((a, r) => a + rowH(r, s) * (r.dx === -1 ? Math.min(1.8, tw / Math.max(1, rowW(r, s))) : 1), 0);
    return tw <= region.w && th <= region.h;
  };
  let lo = 4;
  let hi = sizeMax;
  for (let k = 0; k < 18; k++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  const s = lo;
  const widest = Math.max(...rows.map((r) => rowW(r, s)));
  const grow = (r: Row) => (r.dx === -1 ? Math.min(1.8, widest / Math.max(1, rowW(r, s))) : 1);
  const total = rows.reduce((a, r) => a + rowH(r, s) * grow(r), 0);
  const out: PlacedWord[] = [];
  let y = v === 'bottom' ? region.y + region.h - total : v === 'top' ? region.y : region.y + (region.h - total) / 2;
  const free = region.h - total;
  rows.forEach((r, ri) => {
    const hRow = rowH(r, s) * grow(r);
    if (v === 'split' && ri === 1) y = region.y + region.h - hRow;
    if (v === 'spread' && ri > 0) y += free / Math.max(1, rows.length - 1);
    let k = r.k;
    // justified rows: scale each row to the width of the widest
    if (r.dx === -1) k = r.k.map((x) => x * grow(r));
    const sizes = r.words.map((_, i) => s * k[i]!);
    const widths = r.words.map((w, i) => measure(w, sizes[i]!));
    const w = widths.reduce((a, b) => a + b, 0) + (r.words.length - 1) * s * gapK;
    const align = rtl ? 1 - r.align : r.align;
    let x = region.x + (region.w - w) * align;
    const order = rtl ? [...r.words.keys()].reverse() : [...r.words.keys()];
    const hMax = Math.max(...sizes) * lh;
    for (const i of order) {
      out.push({ idx: r.words[i]!, x, y: y + hMax / 2, size: sizes[i]!, w: widths[i]! });
      x += widths[i]! + s * gapK;
    }
    y += hRow;
  });
  return out;
}
