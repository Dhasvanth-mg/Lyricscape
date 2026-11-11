// Canvas painters for Glyph Cinema: lyric text set one grapheme per cell (the band), shaped strips for complex scripts, the
// typewriter papers (GLY-SRF-PAP-001..006) and teletext pages (GLY-LAY-PAG-*). Each is painted once into a cached texture;
// nothing here runs per frame except the cheap wrapping helpers.

import { TELETEXT, type TtColour } from './ramps';
import type { PaperId } from './plan';

export const GRID_FONT = (px: number) => `700 ${px}px "JetBrains Mono Variable", ui-monospace, monospace`;
export const TYPE_FONT = (px: number) => `400 ${px}px "Special Elite", "Courier New", monospace`;
export const STRIP_FONT = (px: number, script: string) => {
  const face = script === 'devanagari' ? '"Noto Sans Devanagari Variable"' : script === 'tamil' ? '"Noto Sans Tamil Variable"' : script === 'arabic' ? '"Noto Sans Arabic Variable"' : script === 'hebrew' ? '"Noto Sans Hebrew Variable"' : '"Inter Variable"';
  return `500 ${px}px ${face}, "JetBrains Mono Variable", sans-serif`;
};

/** paint graphemes into cells of cw x ch (one each); the monospace glyph is scaled to fill the cell width a little */
export function paintCells(c: CanvasRenderingContext2D, gs: string[], cw: number, ch: number, fg: string, wide = 1) {
  const fs = Math.min(ch * 0.86, cw * 1.15);
  c.font = GRID_FONT(Math.round(fs));
  c.fillStyle = fg;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const sx = Math.min(1.6, Math.max(1, (cw * 0.84) / (fs * 0.6))) * wide;
  gs.forEach((g, i) => {
    if (g === ' ') return;
    c.save();
    c.translate((i + 0.5) * cw, ch * 0.54);
    c.scale(sx, 1);
    c.fillText(g, 0, 0);
    c.restore();
  });
}

export type Row = { from: number; to: number };

/** wrap graphemes into rows of at most `cols`, at spaces; a word longer than a row is split */
export function wrapCells(gs: string[], cols: number): Row[] {
  const rows: Row[] = [];
  let i = 0;
  const n = gs.length;
  while (i < n) {
    while (i < n && gs[i] === ' ') i++;
    if (i >= n) break;
    let end = Math.min(n, i + cols);
    if (end < n && gs[end] !== ' ') {
      let k = end;
      while (k > i && gs[k] !== ' ') k--;
      if (k > i) end = k;
    }
    rows.push({ from: i, to: end });
    i = end;
  }
  return rows.length ? rows : [{ from: 0, to: 0 }];
}

/** wrap a shaped strip by measured width, at spaces (graphemes stay whole) */
export function wrapStrip(gs: string[], width: (from: number, to: number) => number, maxW: number): Row[] {
  const rows: Row[] = [];
  let start = 0;
  let lastSpace = -1;
  for (let i = 0; i <= gs.length; i++) {
    if (i === gs.length || gs[i] === ' ') {
      if (width(start, i) > maxW && lastSpace > start) {
        rows.push({ from: start, to: lastSpace });
        start = lastSpace + 1;
      }
      lastSpace = i;
    }
  }
  if (start < gs.length) rows.push({ from: start, to: gs.length });
  return rows.length ? rows : [{ from: 0, to: 0 }];
}

// ---- papers -----------------------------------------------------------------------------------------------------------------
const rnd = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
};

export const PAPER_BASE: Record<PaperId, string> = {
  'GLY-SRF-PAP-001': '#f4f1ea',
  'GLY-SRF-PAP-002': '#e9e6dc',
  'GLY-SRF-PAP-003': '#c9d0da',
  'GLY-SRF-PAP-004': '#eadcbc',
  'GLY-SRF-PAP-005': '#f2efe4',
  'GLY-SRF-PAP-006': '#f6f2e6',
};

/** a sheet of paper: base colour, fibre, edge character and the paper's own marks (rules, foxing, carbon smudge) */
export function paintPaper(c: CanvasRenderingContext2D, id: PaperId, w: number, h: number, ruleGap: number, ruleY0: number) {
  const r = rnd(id.charCodeAt(id.length - 1) * 977);
  c.fillStyle = PAPER_BASE[id];
  c.fillRect(0, 0, w, h);
  if (id === 'GLY-SRF-PAP-002') {
    // onionskin over a darker backing: a faint mottling of the backing through it
    for (let i = 0; i < 260; i++) {
      c.fillStyle = `rgba(90,85,70,${0.015 + r() * 0.02})`;
      c.beginPath();
      c.ellipse(r() * w, r() * h, 20 + r() * 90, 10 + r() * 50, r() * 3, 0, Math.PI * 2);
      c.fill();
    }
  }
  // fibre: short faint strokes
  c.lineWidth = 1;
  for (let i = 0; i < (w * h) / 1400; i++) {
    const x = r() * w;
    const y = r() * h;
    const a = r() * Math.PI;
    const l = 3 + r() * 9;
    c.strokeStyle = r() < 0.5 ? `rgba(120,110,90,${0.05 + r() * 0.06})` : `rgba(255,255,255,${0.12 + r() * 0.1})`;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    c.stroke();
  }
  if (id === 'GLY-SRF-PAP-003') {
    // carbon copy: blue-grey smudges and a faint offset ghost band
    for (let i = 0; i < 40; i++) {
      c.fillStyle = `rgba(40,55,90,${0.03 + r() * 0.05})`;
      c.beginPath();
      c.ellipse(r() * w, r() * h, 30 + r() * 140, 6 + r() * 30, (r() - 0.5) * 0.4, 0, Math.PI * 2);
      c.fill();
    }
  }
  if (id === 'GLY-SRF-PAP-004') {
    // foxing: rust-brown spots, denser toward the edges
    for (let i = 0; i < 70; i++) {
      const edge = r() < 0.6;
      const x = edge ? (r() < 0.5 ? r() * w * 0.12 : w - r() * w * 0.12) : r() * w;
      const y = r() * h;
      const rad = 1.5 + r() * 6;
      const g = c.createRadialGradient(x, y, 0, x, y, rad * 2);
      g.addColorStop(0, `rgba(140,90,40,${0.18 + r() * 0.2})`);
      g.addColorStop(1, 'rgba(140,90,40,0)');
      c.fillStyle = g;
      c.fillRect(x - rad * 2, y - rad * 2, rad * 4, rad * 4);
    }
    const v = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(160,120,60,0)');
    v.addColorStop(1, 'rgba(160,120,60,0.22)');
    c.fillStyle = v;
    c.fillRect(0, 0, w, h);
  }
  if (id === 'GLY-SRF-PAP-005' || id === 'GLY-SRF-PAP-006') {
    // ruled: faint blue rules on the typing pitch, a red margin
    c.strokeStyle = 'rgba(70,120,200,0.28)';
    c.lineWidth = Math.max(1, ruleGap * 0.03);
    for (let y = ruleY0; y < h; y += ruleGap) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    for (let y = ruleY0 - ruleGap; y > 0; y -= ruleGap) {
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(w, y);
      c.stroke();
    }
    c.strokeStyle = 'rgba(200,60,60,0.35)';
    c.beginPath();
    c.moveTo(w * 0.09, 0);
    c.lineTo(w * 0.09, h);
    c.stroke();
  }
  // edge character: a slightly darker deckle along the sides
  const e = c.createLinearGradient(0, 0, w, 0);
  e.addColorStop(0, 'rgba(80,70,50,0.12)');
  e.addColorStop(0.03, 'rgba(80,70,50,0)');
  e.addColorStop(0.97, 'rgba(80,70,50,0)');
  e.addColorStop(1, 'rgba(80,70,50,0.12)');
  c.fillStyle = e;
  c.fillRect(0, 0, w, h);
}

/** a typed line: each strike a little different (position, pressure, the odd double strike); returns nothing, positions are measured by the caller */
export function paintTyped(c: CanvasRenderingContext2D, gs: string[], xs: number[], font: string, ink: string, y: number, seed: number) {
  const r = rnd(seed);
  c.font = font;
  c.textBaseline = 'middle';
  c.textAlign = 'left';
  gs.forEach((g, i) => {
    if (g === ' ') return;
    const pressure = 0.72 + r() * 0.28;
    const dy = (r() - 0.5) * 2.2;
    c.globalAlpha = pressure;
    c.fillStyle = ink;
    c.fillText(g, xs[i]!, y + dy);
    if (r() < 0.06) {
      c.globalAlpha = pressure * 0.45;
      c.fillText(g, xs[i]! + 0.8, y + dy + 0.6);
    }
  });
  c.globalAlpha = 1;
}

// ---- teletext ---------------------------------------------------------------------------------------------------------------
/** one teletext cell: a character, its colours, double height (top half of a pair) */
export type TtCell = { ch: string; fg: TtColour; bg: TtColour; dbl?: boolean };
export type TtPage = {
  cols: number;
  rows: number;
  cells: (TtCell | null)[][];
  /** rows left transparent for the mosaic picture */
  hole: [number, number] | null;
  /** complex-script text set as shaped strips over the cells (never split into cells) */
  strips: { row: number; col: number; cols: number; text: string; fg: TtColour; script: string }[];
};

export function blankPage(cols: number, rows: number): TtPage {
  return { cols, rows, cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => null)), hole: null, strips: [] };
}
const COMPLEX = /[\u0590-\u08ff\u0900-\u0dff]/;
const scriptName = (s: string) => (/[\u0b80-\u0bff]/.test(s) ? 'tamil' : /[\u0900-\u097f]/.test(s) ? 'devanagari' : /[\u0590-\u05ff]/.test(s) ? 'hebrew' : /[\u0600-\u08ff]/.test(s) ? 'arabic' : 'other');
export function put(p: TtPage, row: number, col: number, text: string, fg: TtColour, bg: TtColour = 'black', dbl = false) {
  if (row < 0 || row >= p.rows) return;
  if (COMPLEX.test(text)) {
    p.strips.push({ row, col, cols: p.cols - col, text, fg, script: scriptName(text) });
    return;
  }
  const gs = [...text];
  for (let i = 0; i < gs.length && col + i < p.cols; i++) if (col + i >= 0) p.cells[row]![col + i] = { ch: gs[i]!, fg, bg, dbl };
}
export function fillRow(p: TtPage, row: number, bg: TtColour, from = 0, to = p.cols) {
  if (row < 0 || row >= p.rows) return;
  for (let c = from; c < to; c++) p.cells[row]![c] = { ch: ' ', fg: 'white', bg };
}

export function paintPage(c: CanvasRenderingContext2D, p: TtPage, cw: number, ch: number) {
  c.clearRect(0, 0, p.cols * cw, p.rows * ch);
  const fs = ch * 0.86;
  const sx = (cw * 0.9) / (fs * 0.6);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  for (let r = 0; r < p.rows; r++) {
    if (p.hole && r >= p.hole[0] && r <= p.hole[1]) continue;
    for (let k = 0; k < p.cols; k++) {
      const cell = p.cells[r]![k];
      const bg = cell?.bg ?? 'black';
      c.fillStyle = TELETEXT[bg];
      c.fillRect(k * cw, r * ch, cw + 0.5, (cell?.dbl ? 2 : 1) * ch + 0.5);
      if (!cell || cell.ch === ' ') continue;
      c.fillStyle = TELETEXT[cell.fg];
      c.save();
      c.translate((k + 0.5) * cw, (r + (cell.dbl ? 1 : 0.5)) * ch);
      c.scale(sx, cell.dbl ? 2 : 1);
      c.font = GRID_FONT(Math.round(fs));
      c.fillText(cell.ch, 0, 1);
      c.restore();
    }
    // a double-height row takes the row under it too
    if (p.cells[r]!.some((x) => x?.dbl)) r++;
  }
  for (const st of p.strips) {
    const rtl = st.script === 'arabic' || st.script === 'hebrew';
    c.save();
    c.beginPath();
    c.rect(st.col * cw, st.row * ch, st.cols * cw, ch);
    c.clip();
    c.font = STRIP_FONT(Math.round(ch * 0.78), st.script);
    c.fillStyle = TELETEXT[st.fg];
    c.textBaseline = 'middle';
    c.direction = rtl ? 'rtl' : 'ltr';
    c.textAlign = rtl ? 'right' : 'left';
    c.fillText(st.text, rtl ? (st.col + st.cols) * cw - cw * 0.5 : st.col * cw, (st.row + 0.55) * ch);
    c.restore();
  }
}
