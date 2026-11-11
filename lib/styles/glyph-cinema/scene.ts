// Glyph Cinema (GLY), Phase 3: pictures made of characters. A subject from the song (a title word, the lyrics' strongest
// image, or a seeded pick inside the section's scene family) is drawn as a brightness map on the GPU and turned into a grid of
// characters by the shared character pass, in one of five registers: phosphor ASCII, teletext mosaic, typewriter overstrike,
// one-bit print and block shade. The lyric types into a clean band of whole cells on the same grid (never over the picture),
// into the double-height rows of a teletext page, or onto a typewriter sheet. Cells change at 30 fps at most; nothing slides.
// A pure function of time (AGENTS.md rule 3).

import { clamp, cursorOn } from '../../kinetic/gl/scenes/common';
import type { SceneFx, SceneHost } from '../../kinetic/gl/scenes/types';
import type { VisualTimeline } from '../../kinetic/types';
import { guardFx } from '../flash';
import { orientationOf, plannedAt } from '../scene/planner';
import { isRtl } from '../sketch-cards/letter';
import { blankPage, fillRow, GRID_FONT, paintCells, paintPage, paintPaper, paintTyped, put, STRIP_FONT, TYPE_FONT, wrapCells, wrapStrip, type Row, type TtPage } from './paint';
import { coloursOf, glyPlan, quantise, type Density, type GlyPlan, type LineLook, type SectionLook } from './plan';
import { rampAtlas } from './ramps';
import { GLY_FS } from './shader';
import { SUBJECTS } from './subjects';

type Grid = { cell: number; cellY: number; cols: number; rows: number; ox: number; oy: number };
type Rect = [number, number, number, number];

const HOLD_AFTER_MS = 1500;
const DECAY_MS = 260;

export function gridFor(W: number, H: number, d: Density): Grid {
  const div = d === 'macro' ? 22 : d === 'coarse' ? 40 : d === 'fine' && H >= 600 ? 72 : 56;
  // portrait frames: never fewer than 14 (macro) to 24 columns across
  const cell = Math.min(H / div, W / (d === 'macro' ? 14 : d === 'coarse' ? 18 : 24));
  const cols = Math.ceil(W / cell);
  const rows = Math.ceil(H / cell);
  return { cell, cellY: cell, cols, rows, ox: (W - cols * cell) / 2, oy: (H - rows * cell) / 2 };
}

/** the line on screen at t: from its start until the next line starts or it has been gone HOLD_AFTER_MS */
function lineState(tl: VisualTimeline, t: number): { li: number; prev: number } {
  const sc = tl.scenes;
  let lo = 0;
  let hi = sc.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sc[mid]!.startMs - 30 <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (found < 0) return { li: -1, prev: -1 };
  const s = sc[found]!;
  const next = sc[found + 1];
  const until = Math.min(next ? next.startMs - 30 : Infinity, s.endMs + HOLD_AFTER_MS);
  return { li: t < until + DECAY_MS ? found : -1, prev: found };
}

const typedCount = (L: LineLook, t: number) => {
  let n = 0;
  while (n < L.revealMs.length && L.revealMs[n]! <= t) n++;
  return n;
};

// ---- the picture --------------------------------------------------------------------------------------------------------------
type PicOpts = { subject: number; subject2: number; front: number; develop: number; zoom: number; pan: [number, number] };

function drawPicture(h: SceneHost, look: SectionLook, rect: Rect, grid: Grid, t: number, o: PicOpts, outside: string) {
  const { W, H } = h;
  const col = look.colours;
  const pc = (c: string) => {
    const n = parseInt(c.replace('#', '').slice(0, 6), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255] as const;
  };
  h.fullscreen('gly', GLY_FS, 1, (p) => {
    p.f('u_time', quantise(t) / 1000);
    p.i('u_subject', o.subject);
    p.i('u_subject2', o.subject2);
    p.f('u_front', o.front);
    p.v4('u_rect', rect[0] / W, rect[1] / H, rect[2] / W, rect[3] / H);
    p.f('u_zoom', o.zoom);
    p.v2('u_pan', o.pan[0], o.pan[1]);
    p.f('u_develop', o.develop);
    p.f('u_beat', h.reduced ? 0 : h.frame.beat.pulse);
    p.v3('u_c0', ...pc(col.c0));
    p.v3('u_c1', ...pc(col.c1));
    p.v3('u_c2', ...pc(col.c2));
    p.v3('u_bgc', ...pc(outside));
    p.v2('u_cells', (rect[2] - rect[0]) / grid.cell, (rect[3] - rect[1]) / grid.cellY);
    p.f('u_flash', h.reduced ? 0 : 1);
  });
  if ((globalThis as { __LS_QA_GLY_RAW?: boolean }).__LS_QA_GLY_RAW) return;
  const reg = look.register;
  const mode = reg === 'GLY-PRC-REG-002' ? 2 : reg === 'GLY-PRC-REG-003' ? 1 : reg === 'GLY-PRC-REG-004' ? 3 : 0;
  h.ascii({
    cell: grid.cell,
    cellY: grid.cellY,
    mix: 1,
    exact: true,
    origin: [grid.ox, grid.oy],
    region: rect,
    atlas: look.ramp === 'GLY-TYP-RMP-013' ? undefined : rampAtlas(look.ramp),
    mode,
    ink: col.ink ?? '#000000',
    paper: mode === 2 ? '#000000' : (col.paper ?? '#ffffff'),
    boost: reg === 'GLY-PRC-REG-005' ? 1.05 : 1.6,
    bg: reg === 'GLY-PRC-REG-005' ? 0 : 0.03,
    wear: mode === 1 ? 0.28 : 0,
    gain: reg === 'GLY-PRC-REG-005' ? 1.4 : 1.6,
  });
}

/** camera in cell steps (GLY-CAM-CAM-*): zoom and pan for the section at `since` ms */
function cameraOf(look: SectionLook, since: number, dur: number, cellUnit: number, portrait: boolean): { zoom: number; pan: [number, number] } {
  const snap = (v: number) => Math.round(v / cellUnit) * cellUnit;
  const steps = (ms: number) => Math.min(4, Math.floor(ms / 250)) / 4; // four steps over a second
  switch (look.camera) {
    case 'GLY-CAM-CAM-001':
      return { zoom: 1 + 0.45 * steps(since), pan: [0, 0] };
    case 'GLY-CAM-CAM-002':
      return { zoom: 1.45 - 0.45 * steps(since), pan: [0, 0] };
    case 'GLY-CAM-CAM-003':
      return { zoom: 1.12, pan: [snap(-0.22 + (0.44 * since) / Math.max(1, dur)), 0] };
    case 'GLY-CAM-CAM-005':
      return { zoom: portrait ? 1.1 : 1.15, pan: [0, snap(0.25 - (0.5 * since) / Math.max(1, dur))] };
    default:
      return { zoom: 1, pan: [0, 0] };
  }
}

// ---- the lyric band -----------------------------------------------------------------------------------------------------------
/** `aspect`: a text cell's width over its height (the band sets type at a terminal's pitch, not in square picture cells) */
type BandGeo = { cell: number; k: number; cols: number; x0: number; textCols: number; rtl: boolean; aspect: number };
const TEXT_ASPECT = 0.72;

function bandGeo(W: number, H: number, grid: Grid, rtl: boolean, minCols: number): BandGeo {
  const o = orientationOf(W, H);
  const floorX = H * (o === 'landscape' ? 0.022 : o === 'portrait' ? 0.018 : o === 'small' ? 0.026 : 0.02);
  const need = floorX / 0.53 / 1.0; // x-height of the grid face ~0.53 em; cell ~ 1 em
  let k = clamp(Math.ceil(need / grid.cell - 0.2), 1, 4);
  while (k > 1 && W / (grid.cell * k) < minCols) k--;
  const cell = grid.cell * k;
  const cols = Math.floor((W - grid.cell * 2) / cell);
  const margin = cols >= 26 ? 2 : 1;
  const textCols = Math.max(4, Math.floor(((cols - margin * 2) * cell) / (cell * TEXT_ASPECT)));
  // the text block starts on a grid column
  const x0 = grid.ox + Math.round((((W - cols * cell) / 2 + margin * cell) - grid.ox) / grid.cell) * grid.cell;
  return { cell, k, cols, x0, textCols, rtl, aspect: TEXT_ASPECT };
}

function rowTex(h: SceneHost, gs: string[], cw: number, ch: number, fg: string, wide = 1) {
  const s = Math.min(2, Math.max(1, h.dpr));
  const text = gs.join('');
  return h.tex(`gly|row|${text}|${cw.toFixed(1)}|${ch.toFixed(1)}|${fg}|${wide}`, Math.max(2, Math.ceil(gs.length * cw * s)), Math.max(2, Math.ceil(ch * s)), (c) => {
    c.scale(s, s);
    paintCells(c, gs, cw, ch, fg, wide);
  });
}
function stripTex(h: SceneHost, text: string, font: string, wPx: number, ch: number, fg: string, rtl: boolean) {
  const s = Math.min(2, Math.max(1, h.dpr));
  return h.tex(`gly|strip|${text}|${font}|${fg}`, Math.max(2, Math.ceil((wPx + ch * 0.4) * s)), Math.max(2, Math.ceil(ch * 1.3 * s)), (c) => {
    c.scale(s, s);
    c.font = font;
    c.fillStyle = fg;
    c.textBaseline = 'middle';
    c.direction = rtl ? 'rtl' : 'ltr';
    c.textAlign = rtl ? 'right' : 'left';
    c.fillText(text, rtl ? wPx + ch * 0.2 : ch * 0.2, ch * 0.66);
  });
}

type BandStyle = { fg: string; bg: string; inv: string };

/**
 * Type a line into rows of cells at (x0, y0): `rows` already wrapped, `n` graphemes typed so far, `skipBefore` cells blanked by a
 * decay front. Returns the cursor cell (or null).
 */
function drawRows(h: SceneHost, L: LineLook, rows: Row[], geo: BandGeo, y0: number, rowH: number, n: number, st: BandStyle, t: number, decayFront = -1, wide = 1) {
  const cw = geo.cell * geo.aspect * wide;
  const ch = geo.cell * wide;
  let cursor: [number, number] | null = null;
  if (L.strip) {
    const font = STRIP_FONT(Math.round(ch * 0.95), L.script);
    rows.forEach((r, j) => {
      const text = L.graphemes.slice(r.from, r.to).join('');
      const full = h.measure(font, text);
      const typed = clamp(n - r.from, 0, r.to - r.from);
      if (typed <= 0) return;
      const vis = typed >= r.to - r.from ? full : h.measure(font, L.graphemes.slice(r.from, r.from + typed).join(''));
      const tex = stripTex(h, text, font, full, ch, st.fg, geo.rtl);
      const pad = ch * 0.2;
      const texW = tex.w / Math.min(2, Math.max(1, h.dpr));
      const texH = tex.h / Math.min(2, Math.max(1, h.dpr));
      const right = geo.x0 + geo.textCols * geo.cell * geo.aspect;
      const y = y0 + j * rowH + rowH / 2;
      if (geo.rtl) {
        const x1 = right;
        const u = (texW - pad - vis) / texW;
        h.sprite({ tex: tex.tex, m: [1, 0, 0, 1, x1 - vis / 2, y - ch * 0.66 + texH / 2], w: vis, h: texH, mode: 0, camera: false, uvRect: [u, 0, vis / texW, 1] });
        if (typed < r.to - r.from) cursor = [x1 - vis - geo.cell * 0.5, y];
      } else {
        const x = geo.x0;
        h.sprite({ tex: tex.tex, m: [1, 0, 0, 1, x + vis / 2, y - ch * 0.66 + texH / 2], w: vis, h: texH, mode: 0, camera: false, uvRect: [pad / texW, 0, vis / texW, 1] });
        if (typed < r.to - r.from) cursor = [x + vis + geo.cell * 0.5, y];
      }
    });
    return cursor;
  }
  const active = L.timing === 'authored' ? L.words.find((w) => t >= w.startMs && t < w.endMs) : undefined;
  rows.forEach((r, j) => {
    const gs = L.graphemes.slice(r.from, r.to);
    const typed = clamp(n - r.from, 0, gs.length);
    const from = decayFront > r.from ? clamp(decayFront - r.from, 0, gs.length) : 0;
    if (typed <= from) return;
    const len = gs.length;
    const rowX = geo.rtl ? geo.x0 + geo.textCols * geo.cell * geo.aspect - len * cw : geo.x0;
    const y = y0 + j * rowH + (rowH - ch) / 2;
    const tex = rowTex(h, gs, cw, ch, st.fg, 1);
    const seg = (a: number, b: number, tx = tex) => {
      if (b <= a) return;
      h.sprite({ tex: tx.tex, m: [1, 0, 0, 1, rowX + ((a + b) / 2) * cw, y + ch / 2], w: (b - a) * cw, h: ch, mode: 0, camera: false, uvRect: [a / len, 0, (b - a) / len, 1] });
    };
    // the word being sung (authored timing only) inverts
    if (active && active.to > r.from && active.from < r.to && L.timing === 'authored') {
      const a = clamp(active.from - r.from, from, typed);
      const b = clamp(active.to - r.from, from, typed);
      seg(from, a);
      if (b > a) {
        h.rect(rowX + a * cw, y, (b - a) * cw, ch, st.fg, 1);
        seg(a, b, rowTex(h, gs, cw, ch, st.inv, 1));
      }
      seg(b, typed);
    } else seg(from, typed);
    if (from > 0) {
      // the decay front: two thinning cells at its edge
      h.rect(rowX + (from - 1) * cw, y + ch * 0.3, cw, ch * 0.4, st.fg, 0.35);
    }
    if (typed < len && n >= r.from) cursor = [rowX + typed * cw + cw / 2, y + ch / 2];
    else if (j === rows.length - 1 && typed >= len) cursor = [rowX + len * cw + cw / 2, y + ch / 2];
  });
  return cursor;
}

/** rows to show for a line: wrapped to the band, at most `maxRows`, scrolled so the row being typed is visible */
function visibleRows(L: LineLook, cols: number, h: SceneHost, cell: number, n: number, maxRows: number, aspect = TEXT_ASPECT): { rows: Row[]; all: number } {
  let rows: Row[];
  if (L.strip) {
    const font = STRIP_FONT(Math.round(cell * 0.95), L.script);
    rows = wrapStrip(L.graphemes, (a, b) => h.measure(font, L.graphemes.slice(a, b).join('')), cols * cell * aspect);
  } else rows = wrapCells(L.graphemes, cols);
  const all = rows.length;
  if (rows.length > maxRows) {
    let cur = rows.findIndex((r) => n <= r.to);
    if (cur < 0) cur = rows.length - 1;
    const start = clamp(cur - maxRows + 1, 0, rows.length - maxRows);
    rows = rows.slice(start, start + maxRows);
  }
  return { rows, all };
}

/** the band (GLY-LAY-LAY-001/002/003/007): a hard mask of whole grid rows in the top or bottom third */
function drawBand(h: SceneHost, gp: GlyPlan, look: SectionLook, grid: Grid, t: number, region: Rect) {
  const { W, H, tl } = h;
  const { li, prev } = lineState(tl, t);
  if (li < 0) return;
  const L = gp.lines[li]!;
  const rtl = isRtl(L.script);
  const o = orientationOf(W, H);
  const geo0 = bandGeo(region[2] - region[0], H, grid, rtl, o === 'small' ? 11 : 14);
  const geo: BandGeo = { ...geo0, x0: region[0] + (geo0.x0 - 0) };
  const n = typedCount(L, t);
  // short lines are set in double cells when they fit
  const short = !L.strip && L.graphemes.length <= Math.floor(geo.textCols / 2) && L.graphemes.length <= 12 && look.band !== 'GLY-LAY-LAY-007';
  const wide = short ? 2 : 1;
  const { rows } = visibleRows(L, Math.floor(geo.textCols / wide), h, geo.cell * wide, n, 3, geo.aspect);
  const pad = Math.max(1, Math.round(geo.k / 2));
  const rowH = geo.cell * wide;
  const bandRows = rows.length * geo.k * wide + pad * 2;
  const top = look.band === 'GLY-LAY-LAY-001' && o !== 'portrait' && o !== 'small';
  const rTop = top ? Math.round((H * 0.12 - grid.oy) / grid.cell) : Math.round((H * 0.86 - grid.oy) / grid.cell) - bandRows;
  const y0 = grid.oy + rTop * grid.cell;
  const inverted = look.band === 'GLY-LAY-LAY-003' && L.hook;
  const st: BandStyle = inverted ? { fg: look.colours.bandBg === '#00000000' ? '#000000' : look.colours.bg, bg: look.colours.accent, inv: look.colours.accent } : { fg: look.colours.text, bg: look.colours.bandBg, inv: look.colours.bandBg };
  if (inverted) st.fg = '#050505';
  // the band clears by a decay front for the first DECAY_MS of a line after another (and at the end)
  const since = t - (tl.scenes[li]!.startMs - 30);
  const end = Math.min(tl.scenes[li + 1] ? tl.scenes[li + 1]!.startMs - 30 : Infinity, tl.scenes[li]!.endMs + HOLD_AFTER_MS);
  const leaving = t > end ? clamp((t - end) / DECAY_MS) : 0;
  const bandX = region[0];
  const bandW = region[2] - region[0];
  h.rect(bandX, y0, bandW, bandRows * grid.cell, st.bg, 1);
  const textY = y0 + pad * grid.cell;
  if (leaving > 0) {
    const front = Math.floor(leaving * (geo.textCols + 2));
    drawRows(h, L, rows, geo, textY, rowH, L.graphemes.length, st, t, rows[0]!.from + front, wide);
    return;
  }
  // the previous line decays under the new one's first cells
  if (prev >= 0 && li > 0 && since < DECAY_MS && li === prev) {
    const P = gp.lines[li - 1]!;
    const pr = visibleRows(P, Math.floor(geo.textCols / wide), h, geo.cell * wide, P.graphemes.length, 3).rows.slice(0, rows.length);
    const front = Math.floor((since / DECAY_MS) * (geo.textCols + 2));
    if (!P.strip && !L.strip) drawRows(h, P, pr, geo, textY, rowH, P.graphemes.length, st, t, pr[0]!.from + Math.max(front, n), wide);
  }
  const cur = drawRows(h, L, rows, geo, textY, rowH, n, st, t, -1, wide);
  const typing = n < L.graphemes.length;
  if (cur && (typing || cursorOn(t))) h.rect(cur[0] - geo.cell * geo.aspect * wide * 0.45, cur[1] - rowH * 0.42, geo.cell * geo.aspect * wide * 0.9, rowH * 0.84, st.fg, 0.92);
  void since;
}

/** split field (GLY-LAY-LAY-006): a column of clean grid text with the section's earlier lines above the current one */
function drawColumn(h: SceneHost, gp: GlyPlan, look: SectionLook, grid: Grid, t: number, col: Rect) {
  const { tl } = h;
  const { li } = lineState(tl, t);
  h.rect(col[0], col[1], col[2] - col[0], col[3] - col[1], look.colours.bandBg, 1);
  if (li < 0) return;
  const L = gp.lines[li]!;
  const rtl = isRtl(L.script);
  const o = orientationOf(h.W, h.H);
  const geo0 = bandGeo(col[2] - col[0], h.H, grid, rtl, o === 'small' ? 11 : 12);
  const cols = Math.max(4, Math.floor((col[2] - col[0] - geo0.cell * 2) / (geo0.cell * TEXT_ASPECT)));
  const geo: BandGeo = { ...geo0, cols, textCols: cols, x0: col[0] + geo0.cell };
  const n = typedCount(L, t);
  const st: BandStyle = { fg: look.colours.text, bg: look.colours.bandBg, inv: look.colours.bandBg };
  const dim: BandStyle = { fg: look.colours.c1, bg: look.colours.bandBg, inv: look.colours.bandBg };
  const rowH = geo.cell * 1.25;
  const cur = visibleRows(L, geo.textCols, h, geo.cell, n, 4);
  const yCur = col[1] + (col[3] - col[1]) * 0.58;
  const c = drawRows(h, L, cur.rows, geo, yCur, rowH, n, st, t);
  if (c && (n < L.graphemes.length || cursorOn(t))) h.rect(c[0] - geo.cell * TEXT_ASPECT * 0.45, c[1] - geo.cell * 0.42, geo.cell * TEXT_ASPECT * 0.9, geo.cell * 0.84, st.fg, 0.92);
  // earlier lines of the section stack upward, dimmer
  let y = yCur - rowH * 0.5;
  for (let k = li - 1; k >= 0 && gp.lines[k]!.section === L.section; k--) {
    const P = gp.lines[k]!;
    const pr = visibleRows(P, geo.textCols, h, geo.cell, P.graphemes.length, 4).rows;
    y -= pr.length * rowH;
    if (y < col[1] + geo.cell) break;
    drawRows(h, P, pr, { ...geo, rtl: isRtl(P.script) }, y, rowH, P.graphemes.length, dim, t);
  }
}

// ---- teletext (C3) ------------------------------------------------------------------------------------------------------------
const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

function buildPage(gp: GlyPlan, look: SectionLook, si: number, tl: VisualTimeline, t: number, cols: number, rows: number, lyricRow: number): TtPage {
  const p = blankPage(cols, rows);
  const title = ((tl.label ?? '').split('•')[0] ?? '').trim() || 'UNTITLED';
  const artist = ((tl.label ?? '').split('•')[1] ?? '').trim();
  const num = 100 + si;
  // header: page number, service, song time (seconds tick)
  const clock = mmss(t);
  put(p, 0, 0, ` P${num}`, 'white');
  put(p, 0, 6, title.toUpperCase().slice(0, cols - 15), 'yellow');
  put(p, 0, cols - clock.length - 1, clock, 'yellow');
  const body0 = 2;
  const body1 = lyricRow - 2;
  const short = cols < 30;
  switch (look.page) {
    case 'GLY-LAY-PAG-001': {
      fillRow(p, body0, 'blue');
      fillRow(p, body0 + 1, 'blue');
      put(p, body0, 1, 'INDEX', 'yellow', 'blue', true);
      gp.sections.slice(0, Math.max(0, body1 - body0 - 3)).forEach((s, k) => {
        const name = s.ps.section.role.toUpperCase();
        const dots = '.'.repeat(Math.max(1, cols - name.length - 7));
        put(p, body0 + 3 + k, 1, `${name}${dots}${100 + k}`, k === si ? 'yellow' : k % 2 ? 'cyan' : 'white');
      });
      break;
    }
    case 'GLY-LAY-PAG-002': {
      const big = mmss(t);
      const c0 = Math.floor((cols - big.length * 2) / 2);
      [...big].forEach((ch, k) => {
        put(p, Math.floor((body0 + body1) / 2) - 1, c0 + k * 2, ch, 'yellow', 'black', true);
        put(p, Math.floor((body0 + body1) / 2) - 1, c0 + k * 2 + 1, ' ', 'yellow', 'black', true);
      });
      put(p, body1 - 1, 1, 'SONG TIME', 'cyan');
      break;
    }
    case 'GLY-LAY-PAG-003': {
      put(p, body0, 1, 'MOST SUNG LINES', 'cyan', 'black', true);
      const counts = new Map<string, number>();
      for (const L of gp.lines) counts.set(L.text, (counts.get(L.text) ?? 0) + 1);
      [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, Math.max(0, body1 - body0 - 3))
        .forEach(([text, c], k) => {
          const tag = ` x${c}`;
          put(p, body0 + 3 + k, 1, `${k + 1}`.padStart(2, ' '), 'yellow');
          put(p, body0 + 3 + k, 4, text.slice(0, cols - 6 - tag.length), 'white');
          put(p, body0 + 3 + k, cols - tag.length - 1, tag, 'green');
        });
      break;
    }
    case 'GLY-LAY-PAG-004': {
      put(p, body0, 1, short ? 'GUIDE' : 'PROGRAMME GUIDE', 'green', 'black', true);
      const from = Math.max(0, gp.lines.findIndex((L) => tl.scenes[L.line]!.startMs > t) - 2);
      gp.lines.slice(from, from + Math.max(0, body1 - body0 - 3)).forEach((L, k) => {
        const at = tl.scenes[L.line]!.startMs;
        put(p, body0 + 3 + k, 1, mmss(at), at <= t ? 'yellow' : 'cyan');
        put(p, body0 + 3 + k, 7, L.text.slice(0, cols - 8), at <= t ? 'white' : 'cyan');
      });
      break;
    }
    case 'GLY-LAY-PAG-006':
      p.hole = [body0, body1];
      break;
    case 'GLY-LAY-PAG-007': {
      const bars: ('blue' | 'red' | 'magenta' | 'green' | 'cyan' | 'yellow' | 'white')[] = ['blue', 'red', 'magenta', 'green', 'cyan', 'yellow', 'white'];
      for (let r = body0; r <= body1; r++)
        for (let k = 0; k < cols; k++) {
          const b = bars[Math.floor((k / cols) * bars.length)]!;
          p.cells[r]![k] = { ch: ' ', fg: 'white', bg: r === body1 - 2 ? (k % 2 ? 'white' : 'black') : b };
        }
      const label = ` ${num} `;
      fillRow(p, Math.floor((body0 + body1) / 2) - 1, 'black', Math.floor(cols / 2 - 4), Math.floor(cols / 2 + 4));
      fillRow(p, Math.floor((body0 + body1) / 2), 'black', Math.floor(cols / 2 - 4), Math.floor(cols / 2 + 4));
      put(p, Math.floor((body0 + body1) / 2) - 1, Math.floor(cols / 2 - label.length / 2), label, 'white', 'black', true);
      break;
    }
    case 'GLY-LAY-PAG-009': {
      put(p, body0 + 1, 1, title.slice(0, cols - 2), 'yellow', 'black', true);
      if (artist) put(p, body0 + 4, 1, artist.slice(0, cols - 2), 'white');
      put(p, body0 + 6, 1, `${gp.lines.length} LINES`, 'cyan');
      put(p, body1 - 1, 1, 'END OF SERVICE', 'green');
      break;
    }
    default:
      break;
  }
  // footer: four coloured links
  const links: [string, 'red' | 'green' | 'yellow' | 'cyan'][] = short ? [['LYR', 'red'], ['IDX', 'green'], ['CLK', 'yellow'], ['END', 'cyan']] : [['Lyrics', 'red'], ['Index', 'green'], ['Clock', 'yellow'], ['Credits', 'cyan']];
  const w = Math.floor(cols / 4);
  links.forEach(([s, c], k) => put(p, rows - 1, k * w + 1, s, c));
  return p;
}

function drawTeletext(h: SceneHost, gp: GlyPlan, look: SectionLook, si: number, t: number, since: number) {
  const { W, H, tl } = h;
  const o = orientationOf(W, H);
  const narrow = o === 'portrait' || o === 'small';
  const cols = narrow ? 24 : 40;
  const rows = narrow ? 36 : 24;
  const cw = W / cols;
  const ch = H / rows;
  const lyricRow = narrow ? 26 : 18;
  h.clear('#000000');
  const page = buildPage(gp, look, si, tl, t, cols, rows, lyricRow);
  // the mosaic picture (picture page): rows of the page body as 2x3 sixels in the eight colours
  if (page.hole) {
    const rect: Rect = [0, page.hole[0] * ch, W, (page.hole[1] + 1) * ch];
    const grid: Grid = { cell: cw, cellY: ch, cols, rows, ox: 0, oy: 0 };
    const sub = SUBJECTS[look.subject]!;
    drawPicture(h, look, rect, grid, t, { subject: look.subject, subject2: -1, front: 0, develop: 1, zoom: 1, pan: [0, 0] }, '#000000');
    const capRow = page.hole[1] + 1;
    put(page, capRow, 1, sub.name.toUpperCase().slice(0, cols - 2), 'cyan');
  }
  const s = Math.min(2, Math.max(1, h.dpr));
  const key = `gly|tt|${look.page}|${si}|${cols}|${Math.floor(t / 1000)}|${W}x${H}`;
  const tex = h.tex(key, Math.ceil(W * s), Math.ceil(H * s), (c) => {
    c.scale(s, s);
    paintPage(c, page, cw, ch);
  });
  // page update: rows rewrite top to bottom, 25 ms a row
  const revealed = look.transition === 'GLY-TRN-PAGE-UPDATE' ? Math.min(rows, Math.floor(since / 25)) : rows;
  h.sprite({ tex: tex.tex, m: [1, 0, 0, 1, W / 2, (revealed * ch) / 2], w: W, h: revealed * ch, mode: 0, camera: false, uvRect: [0, 0, 1, revealed / rows] });

  // the lyric: double-height rows on a coloured background (subtitle page: black boxes)
  const { li } = lineState(tl, t);
  if (li < 0 || revealed < lyricRow) return;
  const L = gp.lines[li]!;
  const subtitle = look.page === 'GLY-LAY-PAG-005';
  const wide = narrow ? 1 : 1;
  const geo: BandGeo = { cell: cw * wide, k: 1, cols, x0: cw, textCols: cols - 2, rtl: isRtl(L.script), aspect: 1 };
  const n = typedCount(L, t);
  const vis = visibleRows(L, Math.floor((cols - 2) / wide), h, cw * wide, n, 2, 1);
  const bg = subtitle ? '#000000' : '#0000ff';
  const fg = subtitle ? '#ffffff' : '#ffff00';
  for (let r = 0; r < 4; r++) h.rect(0, (lyricRow + r) * ch, W, ch + 0.5, subtitle ? '#000000' : bg, 1);
  vis.rows.forEach((r, j) => {
    const gs = L.graphemes.slice(r.from, r.to);
    const typed = clamp(n - r.from, 0, gs.length);
    if (typed <= 0) return;
    const y = (lyricRow + j * 2) * ch;
    const len = gs.length;
    const x = geo.rtl ? W - cw - len * cw : Math.floor((cols - len) / 2) * cw;
    if (subtitle) h.rect(x - cw * 0.5, y, typed * cw + cw, ch * 2, '#000000', 1);
    if (L.strip) {
      const font = STRIP_FONT(Math.round(ch * 1.3), L.script);
      const text = gs.join('');
      const full = h.measure(font, text);
      const tex2 = stripTex(h, text, font, full, ch * 1.7, fg, geo.rtl);
      const sc = Math.min(2, Math.max(1, h.dpr));
      const tw = tex2.w / sc;
      const th = tex2.h / sc;
      const part = typed >= len ? full : h.measure(font, gs.slice(0, typed).join(''));
      const xs = geo.rtl ? W - cw - part : Math.max(cw, (W - full) / 2);
      h.sprite({ tex: tex2.tex, m: [1, 0, 0, 1, xs + part / 2, y + ch + (th / 2 - ch * 1.7 * 0.66)], w: part, h: th, mode: 0, camera: false, uvRect: [geo.rtl ? (tw - ch * 0.34 - part) / tw : (ch * 0.34) / tw, 0, part / tw, 1] });
      return;
    }
    const tex2 = h.tex(`gly|ttrow|${gs.join('')}|${cw.toFixed(1)}|${ch.toFixed(1)}|${fg}`, Math.ceil(len * cw * s), Math.ceil(ch * 2 * s), (c) => {
      c.scale(s, s);
      paintCells(c, gs, cw, ch * 2, fg, 1);
    });
    h.sprite({ tex: tex2.tex, m: [1, 0, 0, 1, x + (typed * cw) / 2, y + ch], w: typed * cw, h: ch * 2, mode: 0, camera: false, uvRect: [0, 0, typed / len, 1] });
  });
}

// ---- typewriter sheet (C4) ------------------------------------------------------------------------------------------------------
const typedX = new Map<string, number[]>();
function xsOf(h: SceneHost, gs: string[], font: string): number[] {
  const key = `${font}|${gs.join('')}`;
  let xs = typedX.get(key);
  if (!xs) {
    xs = [];
    let acc = '';
    for (const g of gs) {
      xs.push(h.measure(font, acc));
      acc += g;
    }
    xs.push(h.measure(font, acc));
    typedX.set(key, xs);
    if (typedX.size > 400) typedX.delete(typedX.keys().next().value!);
  }
  return xs;
}

function drawSheet(h: SceneHost, gp: GlyPlan, look: SectionLook, t: number) {
  const { W, H, tl } = h;
  const o = orientationOf(W, H);
  const portrait = o === 'portrait' || o === 'small';
  const paperId = look.paper ?? 'GLY-SRF-PAP-001';
  const floorX = H * (o === 'landscape' ? 0.022 : o === 'portrait' ? 0.018 : o === 'small' ? 0.026 : 0.02);
  const fs = Math.max(floorX / 0.47, Math.min(W, H) * 0.042);
  const lh = fs * 1.55;
  const font = TYPE_FONT(Math.round(fs));
  const card = paperId === 'GLY-SRF-PAP-006';
  // the sheet: nearly the whole frame (an index card is smaller, centred)
  const sx0 = card ? W * 0.12 : W * 0.04;
  const sx1 = card ? W * 0.88 : W * 0.96;
  const carriage = H * (portrait ? 0.7 : 0.66);
  // lines typed in this section so far; the paper advances one line per line (a whole-row step, 180 ms in three steps)
  const ps = look.ps;
  const L0 = ps.section.lines ? ps.section.lines[0] : -1;
  const { li, prev } = lineState(tl, t);
  const cur = li >= 0 ? li : prev;
  const typedLines = cur >= L0 && L0 >= 0 ? cur - L0 + 1 : 0;
  let advance = typedLines;
  if (cur >= 0 && cur >= L0) {
    const since = t - (tl.scenes[cur]!.startMs - 30);
    if (since < 180) advance -= 1 - Math.floor((since / 180) * 3) / 3;
  }
  // the overstrike picture in the corner
  const picS = Math.min(W, H) * (portrait ? 0.34 : 0.36);
  const pic: Rect = portrait ? [sx1 - picS - W * 0.05, H * 0.07, sx1 - W * 0.05, H * 0.07 + picS] : [sx1 - picS - W * 0.04, H * 0.08, sx1 - W * 0.04, H * 0.08 + picS];
  const tx = sx0 + (sx1 - sx0) * (paperId === 'GLY-SRF-PAP-005' || card ? 0.12 : 0.08);
  const textR = portrait ? sx1 - W * 0.05 : pic[0] - W * 0.03;
  const maxW = textR - tx;
  // each typed line wraps to the typing width (long lines take more rows: the carriage returns mid-line); the row being typed
  // sits on the carriage and earlier rows stack above it, the whole sheet stepping up a row at a time
  const wrapped = new Map<number, Row[]>();
  const rowsOf = (k: number) => {
    let r = wrapped.get(k);
    if (!r) {
      const L = gp.lines[k]!;
      const f = L.strip ? STRIP_FONT(Math.round(fs * 0.92), L.script) : font;
      r = wrapStrip(L.graphemes, (a, b) => h.measure(f, L.graphemes.slice(a, b).join('')), maxW);
      wrapped.set(k, r);
    }
    return r;
  };
  const first = L0 >= 0 && cur >= L0 ? Math.max(L0, cur - 12) : -1;
  const topOf = new Map<number, number>();
  let rowsAbove = 0;
  if (first >= 0) {
    for (let k = cur; k >= first; k--) {
      rowsAbove += rowsOf(k).length;
      topOf.set(k, rowsAbove);
    }
  }
  const curTyped = cur >= 0 && first >= 0 ? typedCount(gp.lines[cur]!, t) : 0;
  const curRows = cur >= 0 && first >= 0 ? rowsOf(cur) : [];
  const curRow = Math.max(0, curRows.findIndex((r) => curTyped <= r.to));
  // y of row `j` of line k: the current row on the carriage
  let step = 0;
  if (cur >= 0 && first >= 0) {
    const since = t - (tl.scenes[cur]!.startMs - 30);
    if (since < 180) step = 1 - Math.floor((since / 180) * 3) / 3;
  }
  const rowY = (k: number, j: number) => carriage - (topOf.get(k)! - (rowsOf(cur).length - 1 - curRow) - 1 - j) * lh + (curRow === 0 ? step : 0) * lh;
  const firstTop = first >= 0 ? rowY(first, 0) : carriage;
  const headY = firstTop - lh * 3;
  const sheetTop = Math.min(headY - lh * 1.8, card ? H * 0.12 : H * 0.05);
  const ruleY0 = (((firstTop - sheetTop + fs * 0.45) % lh) + lh) % lh;
  const paperCol = { 'GLY-SRF-PAP-001': '#f4f1ea', 'GLY-SRF-PAP-002': '#e9e6dc', 'GLY-SRF-PAP-003': '#c9d0da', 'GLY-SRF-PAP-004': '#eadcbc', 'GLY-SRF-PAP-005': '#f2efe4', 'GLY-SRF-PAP-006': '#f6f2e6' }[paperId];
  const grid: Grid = { cell: Math.max(7, picS / 24), cellY: Math.max(7, picS / 24), cols: 24, rows: 24, ox: pic[0], oy: pic[1] };
  drawPicture(h, { ...look, colours: { ...look.colours, paper: paperCol, ink: look.colours.ink ?? '#1b1a1f' } }, pic, grid, t, { subject: look.subject, subject2: -1, front: 0, develop: 1, zoom: 1, pan: [0, 0] }, paperCol);
  // the desk around the sheet, then the paper's fibre over everything on it
  h.rect(0, 0, sx0, H, '#2a2622', 1);
  h.rect(sx1, 0, W - sx1, H, '#2a2622', 1);
  if (sheetTop > 0) h.rect(sx0, 0, sx1 - sx0, sheetTop, '#2a2622', 1);
  const pw = 1024;
  const phh = Math.round((pw * H) / Math.max(1, sx1 - sx0));
  const ptex = h.tex(`gly|paper|${paperId}|${Math.round(lh)}|${Math.round(ruleY0)}|${W}x${H}`, pw, Math.min(4096, phh), (c) => {
    const k = pw / (sx1 - sx0);
    paintPaper(c, paperId, pw, Math.min(4096, phh), lh * k, ruleY0 * k);
  });
  const shH = H - Math.max(0, sheetTop);
  h.sprite({ tex: ptex.tex, m: [1, 0, 0, 1, (sx0 + sx1) / 2, Math.max(0, sheetTop) + shH / 2], w: sx1 - sx0, h: shH, mode: 0, camera: false, alpha: 0.6, uvRect: [0, 0, 1, shH / H] });
  if (card) h.rect(0, H * 0.9, W, H * 0.1, '#2a2622', 1);

  // the heading (title and artist) and the typed lines
  const title = ((tl.label ?? '').split('•')[0] ?? '').trim();
  const artist = ((tl.label ?? '').split('•')[1] ?? '').trim();
  const ink = look.colours.ink ?? '#1b1a1f';
  const red = look.redRibbon ? (look.colours.accent ?? '#b3261e') : ink;
  const typedLine = (gs: string[], y: number, n: number, colr: string, seed: number, rtl: boolean) => {
    if (y < -lh || y > H + lh || n <= 0) return;
    const f = gs.some((g) => /[ऀ-௿֐-ۿ]/.test(g)) ? STRIP_FONT(Math.round(fs * 0.92), /[஀-௿]/.test(gs.join('')) ? 'tamil' : /[ऀ-ॿ]/.test(gs.join('')) ? 'devanagari' : /[֐-׿]/.test(gs.join('')) ? 'hebrew' : 'arabic') : font;
    const xs = xsOf(h, gs, f);
    const full = xs[xs.length - 1]!;
    const s = Math.min(2, Math.max(1, h.dpr));
    const tex = h.tex(`gly|typed|${gs.join('')}|${f}|${colr}|${seed}`, Math.ceil((full + fs) * s), Math.ceil(lh * s), (c) => {
      c.scale(s, s);
      if (rtl || f !== font) {
        c.font = f;
        c.fillStyle = colr;
        c.textBaseline = 'middle';
        c.direction = rtl ? 'rtl' : 'ltr';
        c.textAlign = rtl ? 'right' : 'left';
        c.fillText(gs.join(''), rtl ? full + fs * 0.5 : fs * 0.5, lh / 2);
      } else paintTyped(c, gs, xs.map((x) => x + fs * 0.5), f, colr, lh / 2, seed);
    });
    const vis = xs[Math.min(n, gs.length)]!;
    const tw = tex.w / s;
    const x = rtl ? textR - vis : tx;
    h.sprite({ tex: tex.tex, m: [1, 0, 0, 1, x + vis / 2, y], w: vis, h: lh, mode: 0, camera: false, uvRect: [rtl ? (tw - fs * 0.5 - vis) / tw : (fs * 0.5) / tw, 0, vis / tw, 1] });
  };
  // the heading never runs past the typing width
  const fit = (str: string) => {
    let gs = [...str];
    while (gs.length > 1 && h.measure(font, gs.join('')) > maxW) gs = gs.slice(0, -1);
    return gs;
  };
  if (title) typedLine(fit(title.toUpperCase()), headY, 999, ink, 1, false);
  if (artist) typedLine(fit(artist), headY + lh, 999, ink, 2, false);
  if (title) h.rect(tx, headY + lh * 1.55, Math.min(textR - tx, fs * 0.6 * Math.max(title.length, 8)), Math.max(1, fs * 0.06), ink, 0.75);
  if (first < 0) return;
  for (let k = first; k <= cur; k++) {
    const L = gp.lines[k]!;
    const n = k < cur ? L.graphemes.length : curTyped;
    rowsOf(k).forEach((r, j) => typedLine(L.graphemes.slice(r.from, r.to), rowY(k, j), n - r.from, L.hook && L.repeat > 1 ? red : ink, k * 31 + j, isRtl(L.script)));
  }
}

// ---- the scene ------------------------------------------------------------------------------------------------------------------
export function drawGlyphCinemaScene(h: SceneHost): SceneFx {
  const { W, H, tl, frame } = h;
  const t = frame.tMs;
  const coverColours = h.cover?.grid ? sampleColours(h.cover.grid) : [];
  const gp = glyPlan(tl, h.reduced, coverColours.length ? coverColours : tl.palette);
  const ps = plannedAt(gp.plan, t) ?? gp.plan.sections[0]!;
  const si = Math.max(0, gp.plan.sections.indexOf(ps));
  let look = gp.sections[si]!;
  // QA only (never in production builds): force a composition, register, subject, page or ramp so every family can be checked
  const qa = process.env.NODE_ENV !== 'production' ? (globalThis as { __LS_QA_GLY?: Partial<Pick<SectionLook, 'comp' | 'register' | 'subject' | 'page' | 'ramp' | 'density' | 'band' | 'paper'>> }).__LS_QA_GLY : undefined;
  if (qa) {
    look = { ...look, ...qa };
    if (qa.register) look.colours = coloursOf(qa.register, gp.phosColours, gp.colours);
  }
  const since = t - ps.section.startMs;
  const dur = Math.max(1, ps.section.endMs - ps.section.startMs);
  const o = orientationOf(W, H);
  const portrait = o === 'portrait' || o === 'small';
  const reg = look.register;
  let fx: SceneFx;

  if (look.comp === 'C3') {
    drawTeletext(h, gp, look, si, t, since);
    fx = { scan: 0.1, curve: 0.02, bloom: 0.35, vignette: 0.3, grain: 0.02, exposure: 1 };
  } else if (look.comp === 'C4') {
    drawSheet(h, gp, look, t);
    fx = { bloom: 0, vignette: 0.28, grain: 0.04, exposure: 1 };
  } else {
    const grid = gridFor(W, H, look.density);
    const bg = reg === 'GLY-PRC-REG-004' ? (look.colours.paper ?? '#efe9dc') : look.colours.bg;
    h.clear(bg);
    // picture region: the whole frame, or one side of a split field
    let rect: Rect = [0, 0, W, H];
    let column: Rect | null = null;
    if (look.comp === 'C5') {
      const rtl = gp.lines.some((L) => isRtl(L.script));
      if (portrait) {
        const cut = grid.oy + Math.round((H * 0.56 - grid.oy) / grid.cell) * grid.cell;
        rect = [0, 0, W, cut];
        column = [0, cut, W, H];
      } else {
        const cut = grid.ox + Math.round((W * (rtl ? 0.42 : 0.58) - grid.ox) / grid.cell) * grid.cell;
        rect = rtl ? [cut, 0, W, H] : [0, 0, cut, H];
        column = rtl ? [0, 0, cut, H] : [cut, 0, W, H];
      }
    }
    // camera and transitions
    const unit = (2 * grid.cell) / Math.min(rect[2] - rect[0], rect[3] - rect[1]);
    const cam = cameraOf(look, since, dur, unit, portrait);
    let zoom = cam.zoom * (look.comp === 'C6' ? 2.1 : 1);
    const pan = cam.pan;
    if (look.comp === 'C6') {
      // macro: a detail of the subject (its upper focal area for tall subjects)
      pan[1] += SUBJECTS[look.subject]!.focal === 'low' ? -0.35 : 0.12;
    }
    const prevLook = si > 0 ? gp.sections[si - 1]! : null;
    let subject = look.subject;
    let subject2 = -1;
    let front = 0;
    if (look.transition === 'GLY-TRN-NOISE-FRONT' && prevLook && prevLook.subject !== look.subject && since < 800) {
      subject = prevLook.subject;
      subject2 = look.subject;
      front = quantise(since) / 800;
    }
    if (look.transition === 'GLY-TRN-ZOOM-STEP' && since < 1000) zoom = cam.zoom;
    let develop = 1;
    if (look.transition === 'GLY-TRN-DEVELOP') develop = clamp(quantise(since) / 1600);
    // decay to blank over the song's last 2.5 s
    const left = tl.durationMs - t;
    if (left < 2500) develop = Math.min(develop, h.reduced ? (left > 1200 ? 1 : 0) : clamp(quantise(left - 400) / 2100));
    drawPicture(h, look, rect, grid, h.reduced ? ps.section.startMs : t, { subject, subject2, front, develop, zoom, pan: [pan[0], pan[1]] }, bg);
    if (column) drawColumn(h, gp, look, grid, t, column);
    else drawBand(h, gp, look, grid, t, rect);
    fx =
      reg === 'GLY-PRC-REG-004'
        ? { bloom: 0, vignette: 0.12, grain: 0.02, exposure: 1 }
        : reg === 'GLY-PRC-REG-005'
          ? { scan: 0.05, bloom: 0.5, vignette: 0.35, grain: 0.03, exposure: 1 }
          : { scan: 0.12, curve: 0.025, bloom: 0.85, vignette: 0.45, grain: 0.03, aber: 0.15, exposure: 1 };
  }
  return guardFx(fx, { reducedMotion: h.reduced });
}

/** a few representative colours of the cover sample (48x48 RGBA): the most saturated and the lightest and darkest */
function sampleColours(grid: Uint8ClampedArray): string[] {
  const out: string[] = [];
  const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  let sat = { s: -1, c: '' };
  let light = { l: -1, c: '' };
  let dark = { l: 2, c: '' };
  for (let i = 0; i < grid.length; i += 4 * 7) {
    const r = grid[i]!;
    const g = grid[i + 1]!;
    const b = grid[i + 2]!;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const l = (mx + mn) / 510;
    const s = mx === mn ? 0 : (mx - mn) / 255 / (1 - Math.abs(2 * l - 1) + 1e-6);
    const c = hex(r, g, b);
    if (s * (l > 0.15 && l < 0.85 ? 1 : 0.3) > sat.s) sat = { s: s * (l > 0.15 && l < 0.85 ? 1 : 0.3), c };
    if (l > light.l) light = { l, c };
    if (l < dark.l) dark = { l, c };
  }
  if (sat.c) out.push(sat.c);
  if (light.c) out.push(light.c);
  if (dark.c) out.push(dark.c);
  return out;
}
