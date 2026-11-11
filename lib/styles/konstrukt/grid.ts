// Konstrukt grid systems (KON-LAY-GRD-001..011) and layout templates (KON-LAY-LAY-001..019): the solver that turns a template
// into pixel slots for one frame size. Every slot is a whole number of modules inside the 6% outer margin. The type slot is a
// hard exclusion: forms are laid out in their own regions and the shader also refuses to ink inside the type slot.

import type { Orientation } from '../scene/planner';

export type GridId = `KON-LAY-GRD-${'001' | '002' | '003' | '004' | '005' | '006' | '007' | '008' | '009' | '010' | '011'}`;
export type LayId = `KON-LAY-LAY-${'001' | '002' | '003' | '004' | '005' | '006' | '007' | '008' | '009' | '010' | '011' | '012' | '013' | '014' | '015' | '016' | '017' | '018' | '019'}`;
export type Rect = { x: number; y: number; w: number; h: number };

export type Grid = {
  id: GridId;
  W: number;
  H: number;
  /** inner area (inside the margin) */
  x0: number;
  y0: number;
  w: number;
  h: number;
  cols: number;
  rows: number;
  mw: number;
  mh: number;
  /** the column whose rule is drawn heavier (asymmetric and golden grids), -1 for none */
  bold: number;
  /** rule angle for diagonal grids (degrees), 0 for none */
  diag: number;
  radial: boolean;
};

const COLS: Record<GridId, number> = {
  'KON-LAY-GRD-001': 12,
  'KON-LAY-GRD-002': 8,
  'KON-LAY-GRD-003': 6,
  'KON-LAY-GRD-004': 4,
  'KON-LAY-GRD-005': 5,
  'KON-LAY-GRD-006': 4,
  'KON-LAY-GRD-007': 8,
  'KON-LAY-GRD-008': 8,
  'KON-LAY-GRD-009': 12,
  'KON-LAY-GRD-010': 8,
  'KON-LAY-GRD-011': 8,
};

/** the base grid per frame shape (composition.md "Responsive") */
export function baseGrid(o: Orientation, pick: number): GridId {
  if (o === 'small') return 'KON-LAY-GRD-004';
  if (o === 'portrait') return pick < 0.3 ? 'KON-LAY-GRD-005' : 'KON-LAY-GRD-003';
  if (o === 'square') return pick < 0.35 ? 'KON-LAY-GRD-006' : 'KON-LAY-GRD-002';
  return pick < 0.5 ? 'KON-LAY-GRD-001' : pick < 0.75 ? 'KON-LAY-GRD-007' : 'KON-LAY-GRD-008';
}

export function gridOf(id: GridId, W: number, H: number): Grid {
  const m = 0.06 * Math.min(W, H);
  const x0 = m;
  const y0 = m;
  const w = W - 2 * m;
  const h = H - 2 * m;
  let cols = COLS[id];
  // a narrow frame never gets more columns than its shape allows (12 columns on a phone would be slivers)
  if (W < 480) cols = Math.min(cols, 4);
  else if (W < H) cols = Math.min(cols, 6);
  const rows = id === 'KON-LAY-GRD-005' ? 7 : id === 'KON-LAY-GRD-006' ? 4 : Math.max(3, Math.round(h / (w / cols)));
  const bold = id === 'KON-LAY-GRD-007' ? Math.round(cols * (3 / 8)) : id === 'KON-LAY-GRD-008' ? Math.round(cols * 0.618) : -1;
  const diag = id === 'KON-LAY-GRD-010' ? 45 : id === 'KON-LAY-GRD-011' ? 30 : 0;
  return { id, W, H, x0, y0, w, h, cols, rows, mw: w / cols, mh: h / rows, bold, diag, radial: id === 'KON-LAY-GRD-009' };
}

/** a module rect: columns [c0, c1), rows [r0, r1) */
export function mod(g: Grid, c0: number, r0: number, c1: number, r1: number): Rect {
  const a = Math.max(0, Math.min(g.cols, c0));
  const b = Math.max(a, Math.min(g.cols, c1));
  const r = Math.max(0, Math.min(g.rows, r0));
  const s = Math.max(r, Math.min(g.rows, r1));
  return { x: g.x0 + a * g.mw, y: g.y0 + r * g.mh, w: (b - a) * g.mw, h: (s - r) * g.mh };
}

export type TypeMode = 'block' | 'stack' | 'stack2' | 'rotated' | 'centre' | 'arc' | 'scatter' | 'listing' | 'corner';
export type Field = { kind: 'rect'; rect: Rect; ink: 'a' | 'b' | 'type' } | { kind: 'diag'; ink: 'a' | 'b' | 'type' };

export type Layout = {
  id: LayId;
  mode: TypeMode;
  /** where the lyric is set (for the two-stack template, the first stack) */
  type: Rect;
  /** the second stack (call and response) */
  type2?: Rect;
  /** regions the forms may use */
  forms: Rect[];
  /** areas no form may ink (type slots, padded by a quarter module) */
  excl: Rect[];
  field?: Field;
  /** split: where the field boundary is (vertical x, horizontal y) */
  split?: { dir: 'v' | 'h' | 'd'; at: number };
  /** concentric and giant forms: the form's centre and radius */
  centre?: { x: number; y: number; r: number };
  /** giant numeral slot */
  numeral?: Rect;
  /** scatter word modules */
  cells?: Rect[];
  /** the arc the text sits on (Latin short lines): centre, radius, from and to angle (radians) */
  arc?: { x: number; y: number; r: number; a0: number; a1: number };
  rtl: boolean;
};

const pad = (g: Grid, r: Rect, k = 0.25): Rect => ({ x: r.x - g.mw * k, y: r.y - g.mh * k, w: r.w + g.mw * k * 2, h: r.h + g.mh * k * 2 });
const mirror = (g: Grid, r: Rect): Rect => ({ ...r, x: g.W - r.x - r.w });

/** the last row the type may use: type stays out of the bottom 14% (the app stage's controls) */
export function lastTypeRow(g: Grid): number {
  const limit = g.H * 0.86;
  return Math.max(1, Math.min(g.rows, Math.floor((limit - g.y0) / g.mh + 1e-6)));
}

/** seeded, non-overlapping word modules for the scatter templates */
function scatterCells(g: Grid, n: number, seed: number, rEnd: number): Rect[] {
  const spanC = Math.max(1, Math.round(g.cols / (g.cols >= 8 ? 4 : 2)));
  const slots: Rect[] = [];
  for (let r = 0; r < rEnd; r++) for (let c = 0; c + spanC <= g.cols; c += spanC) slots.push(mod(g, c, r, c + spanC, r + 1));
  // a seeded order that keeps reading order (top to bottom, left to right) but skips cells
  const order = slots.map((s, i) => ({ s, k: Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453 })).map((x) => ({ s: x.s, k: x.k - Math.floor(x.k) }));
  const chosen = order
    .sort((a, b) => a.k - b.k)
    .slice(0, Math.min(n, slots.length))
    .map((x) => x.s)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  return chosen;
}

/** solve a template for a frame */
export function solveLayout(id: LayId, g: Grid, o: Orientation, rtl: boolean, seed = 0): Layout {
  const C = g.cols;
  const R = g.rows;
  const T = lastTypeRow(g);
  const tall = o === 'portrait' || o === 'small';
  let L: Layout;
  switch (id) {
    case 'KON-LAY-LAY-001': {
      // block low-left, form high-right
      const typeRows = Math.max(2, Math.ceil(R * (tall ? 0.38 : 0.45)));
      const type = tall ? mod(g, 0, T - typeRows, C, T) : mod(g, 0, T - typeRows, Math.ceil(C * 0.66), T);
      const forms = tall ? [mod(g, Math.floor(C * 0.25), 0, C, T - typeRows - 1)] : [mod(g, Math.ceil(C * 0.42), 0, C, Math.max(1, T - typeRows))];
      L = { id, mode: 'block', type, forms, excl: [], rtl };
      break;
    }
    case 'KON-LAY-LAY-002': {
      // block full width at the bottom, a band of forms at the top
      const typeRows = Math.max(2, Math.ceil(R * 0.4));
      const type = mod(g, 0, T - typeRows, C, T);
      L = { id, mode: 'block', type, forms: [mod(g, 0, 0, C, Math.max(1, Math.floor(R * 0.38)))], excl: [], rtl };
      break;
    }
    case 'KON-LAY-LAY-003': {
      // block in a narrow column, a giant numeral beside it, a small form band above the numeral
      const tc = tall ? C : Math.max(2, Math.ceil(C * 0.36));
      const type = tall ? mod(g, 0, Math.ceil(R * 0.55), C, T) : mod(g, 0, Math.ceil(R * 0.3), tc, T);
      const numeral = tall ? mod(g, 0, 1, C, Math.ceil(R * 0.5)) : mod(g, tc + 1, 1, C, R);
      const forms = tall ? [mod(g, Math.ceil(C / 2), 0, C, 1)] : [mod(g, tc + 1, 0, C, 1)];
      L = { id, mode: 'block', type, forms, excl: [], numeral, rtl };
      break;
    }
    case 'KON-LAY-LAY-004': {
      // column stack left, forms right
      const sc = tall ? Math.ceil(C / 2) : Math.max(2, Math.ceil(C * 0.34));
      const type = mod(g, 0, 0, sc, T);
      L = { id, mode: 'stack', type, forms: [mod(g, sc + (tall ? 0 : 1), 0, C, R)], excl: [], rtl };
      break;
    }
    case 'KON-LAY-LAY-005': {
      // column stack centre, forms both sides
      const w = Math.max(2, Math.round(C * (tall ? 0.5 : 0.34)));
      const c0 = Math.floor((C - w) / 2);
      const type = mod(g, c0, 0, c0 + w, T);
      L = { id, mode: 'stack', type, forms: [mod(g, 0, 0, c0, R), mod(g, c0 + w, 0, C, R)].filter((r) => r.w > 0), excl: [], rtl };
      break;
    }
    case 'KON-LAY-LAY-006': {
      // two stacks, call and response
      const w = Math.max(1, Math.round(C * (tall ? 0.5 : 0.3)));
      const type = tall ? mod(g, 0, 0, C, Math.floor(T / 2)) : mod(g, 0, 0, w, T);
      const type2 = tall ? mod(g, 0, Math.floor(T / 2), C, T) : mod(g, C - w, 0, C, T);
      const forms = tall ? [mod(g, 0, T, C, R)] : [mod(g, w + 1, 0, C - w - 1, R)];
      L = { id, mode: 'stack2', type, type2, forms: forms.filter((r) => r.w > 0 && r.h > 0), excl: [], rtl };
      break;
    }
    case 'KON-LAY-LAY-007':
    case 'KON-LAY-LAY-008': {
      // a line along the left edge (right edge for Hebrew), a field of the second ink with the form centred on it
      const band = Math.max(1, Math.round(C / 8));
      const type = mod(g, 0, 0, band, R);
      const fieldR = mod(g, band + 1, Math.round(R * 0.12), C, R - Math.round(R * 0.12));
      const fr = id === 'KON-LAY-LAY-008' ? mirror(g, fieldR) : fieldR;
      const s = Math.min(fr.w, fr.h);
      L = {
        id,
        mode: 'rotated',
        type: id === 'KON-LAY-LAY-008' ? mirror(g, type) : type,
        forms: [fr],
        excl: [],
        field: { kind: 'rect', rect: fr, ink: 'a' },
        centre: { x: fr.x + fr.w / 2, y: fr.y + fr.h / 2, r: s * 0.42 },
        rtl,
      };
      break;
    }
    case 'KON-LAY-LAY-009':
    case 'KON-LAY-LAY-010':
    case 'KON-LAY-LAY-011': {
      // two fields, the type crossing the split (knocking out of the dark field)
      const dir = id === 'KON-LAY-LAY-009' ? 'v' : id === 'KON-LAY-LAY-010' ? 'h' : 'd';
      if (dir === 'v') {
        const sc = Math.round(C / 2);
        const at = g.x0 + sc * g.mw;
        const typeRows = Math.max(2, Math.ceil(R * 0.36));
        const r0 = Math.max(0, Math.round((T - typeRows) * 0.62));
        const type = mod(g, Math.round(C * 0.16), r0, Math.round(C * 0.84), r0 + typeRows);
        const forms = [mod(g, 0, 0, sc, Math.max(1, r0 - 1)), mod(g, 0, r0 + typeRows + 1, sc, R)].filter((r) => r.h > 0);
        L = { id, mode: 'block', type, forms, excl: [], field: { kind: 'rect', rect: { x: at, y: 0, w: g.W - at, h: g.H }, ink: 'type' }, split: { dir, at }, rtl };
      } else if (dir === 'h') {
        const sr = Math.round(R / 2);
        const at = g.y0 + sr * g.mh;
        const typeRows = Math.max(2, Math.min(T - sr + 1, Math.ceil(R * 0.3)));
        const r0 = Math.max(1, sr - Math.floor(typeRows / 2));
        const type = mod(g, 0, r0, C, Math.min(T, r0 + typeRows));
        const forms = [mod(g, 0, 0, C, Math.max(1, r0 - 1))];
        L = { id, mode: 'block', type, forms, excl: [], field: { kind: 'rect', rect: { x: 0, y: at, w: g.W, h: g.H - at }, ink: 'type' }, split: { dir, at }, rtl };
      } else {
        // diagonal (square frames): the type sits in the paper half, forms in the dark half do not exist (forms on one side only)
        const type = mod(g, 0, 0, Math.ceil(C * 0.62), Math.ceil(R * 0.42));
        const forms = [mod(g, Math.ceil(C * 0.08), Math.ceil(R * 0.45), Math.ceil(C * 0.5), T)];
        L = { id, mode: 'block', type, forms, excl: [], field: { kind: 'diag', ink: 'type' }, split: { dir, at: 0 }, rtl };
      }
      break;
    }
    case 'KON-LAY-LAY-012':
    case 'KON-LAY-LAY-013': {
      // concentric: rings around the centre, the line on the horizontal through it (or on an arc above it)
      const cx = g.W / 2;
      const cy = Math.min(g.H / 2, g.H * 0.86 - Math.min(g.W, g.H) * 0.3);
      const r = 0.45 * Math.min(g.W, g.H);
      const lineH = Math.max(g.mh * 1.2, g.H * 0.12);
      const type = { x: Math.max(g.x0, cx - g.W * 0.35), y: cy - lineH / 2, w: Math.min(g.w, g.W * 0.7), h: lineH };
      if (id === 'KON-LAY-LAY-013') {
        L = { id, mode: 'arc', type, forms: [{ x: cx - r, y: cy - r, w: 2 * r, h: 2 * r }], excl: [], centre: { x: cx, y: cy, r }, arc: { x: cx, y: cy, r: r * 0.62, a0: Math.PI * 1.12, a1: Math.PI * 1.88 }, rtl };
      } else L = { id, mode: 'centre', type, forms: [{ x: cx - r, y: cy - r, w: 2 * r, h: 2 * r }], excl: [], centre: { x: cx, y: cy, r }, rtl };
      break;
    }
    case 'KON-LAY-LAY-014':
    case 'KON-LAY-LAY-015': {
      const n = id === 'KON-LAY-LAY-014' ? 4 : o === 'landscape' ? 8 : o === 'small' ? 4 : 6;
      const cells = scatterCells(g, n, seed, T);
      L = { id, mode: 'scatter', type: mod(g, 0, 0, C, T), forms: [mod(g, 0, 0, C, R)], excl: [], cells, rtl };
      break;
    }
    case 'KON-LAY-LAY-016':
    case 'KON-LAY-LAY-017':
    case 'KON-LAY-LAY-018': {
      // giant form: a circle at 130% of the frame height (crop right or bottom) or a giant bar; type small in a corner
      const crop = id === 'KON-LAY-LAY-017' || tall ? 'bottom' : id === 'KON-LAY-LAY-018' ? 'bar' : 'right';
      const tc = tall ? C : Math.max(2, Math.ceil(C * 0.4));
      const typeRows = Math.max(2, Math.ceil(R * 0.3));
      const top = crop === 'bottom';
      const type = top ? mod(g, 0, 0, tc, typeRows) : mod(g, 0, T - typeRows, tc, T);
      const r = 0.65 * (tall ? g.W * 1.15 : g.H);
      const centre = crop === 'bottom' ? { x: g.W * 0.58, y: g.H + r * 0.12, r } : crop === 'right' ? { x: g.W - r * 0.35, y: g.H * 0.45, r } : { x: g.W * 0.72, y: g.H / 2, r: g.H };
      L = { id, mode: 'corner', type, forms: [{ x: 0, y: 0, w: g.W, h: g.H }], excl: [], centre, rtl };
      break;
    }
    case 'KON-LAY-LAY-019':
    default: {
      // programme listing for untimed lyrics: six lines numbered, forms in a column beside
      const tc = tall ? C : Math.ceil(C * 0.66);
      const type = tall ? mod(g, 0, Math.ceil(R * 0.3), C, T) : mod(g, 0, Math.ceil(R * 0.12), tc, T);
      const forms = tall ? [mod(g, 0, 0, C, Math.max(1, Math.ceil(R * 0.3) - 1))] : [mod(g, tc + 1, 0, C, R)];
      L = { id: 'KON-LAY-LAY-019', mode: 'listing', type, forms, excl: [], rtl };
    }
  }
  // right-to-left: the grid mirrors (flush right); the rotated template already chose its edge
  if (rtl && L.mode !== 'rotated' && L.mode !== 'centre' && L.mode !== 'arc') {
    L.type = mirror(g, L.type);
    if (L.type2) L.type2 = mirror(g, L.type2);
    L.forms = L.forms.map((r) => mirror(g, r));
    if (L.numeral) L.numeral = mirror(g, L.numeral);
    if (L.cells) L.cells = L.cells.map((r) => mirror(g, r));
    if (L.centre && L.mode === 'corner') L.centre = { ...L.centre, x: g.W - L.centre.x };
    if (L.field?.kind === 'rect') L.field = { ...L.field, rect: mirror(g, L.field.rect) };
    if (L.split?.dir === 'v') L.split = { ...L.split, at: g.W - L.split.at };
  }
  L.excl = [pad(g, L.type), ...(L.type2 ? [pad(g, L.type2)] : [])];
  if (L.cells) L.excl = L.cells.map((c) => pad(g, c, 0.1));
  return L;
}

/** rects overlap (for the exclusion test) */
export const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
