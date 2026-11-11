// Character ramps (GLY-TYP-RMP-*), registers (GLY-PRC-REG-*) and palettes (GLY-PAL-PAL-*). A ramp is an ordered set of
// characters from empty to full, painted once into an atlas the shared character pass samples; ramps marked `measure` are
// sorted by the ink each character actually puts down in the face used, so the order is measured, not guessed. Blocks and
// braille are drawn as shapes (exact coverage). The teletext mosaic (RMP-013) needs no atlas: the pass draws 2x3 sixels.

import type { AsciiAtlas } from '../../kinetic/gl/renderer';

export type RampId =
  | 'GLY-TYP-RMP-001'
  | 'GLY-TYP-RMP-002'
  | 'GLY-TYP-RMP-003'
  | 'GLY-TYP-RMP-004'
  | 'GLY-TYP-RMP-005'
  | 'GLY-TYP-RMP-006'
  | 'GLY-TYP-RMP-007'
  | 'GLY-TYP-RMP-008'
  | 'GLY-TYP-RMP-009'
  | 'GLY-TYP-RMP-010'
  | 'GLY-TYP-RMP-011'
  | 'GLY-TYP-RMP-012'
  | 'GLY-TYP-RMP-013';

type RampDef = { name: string; glyphs: string[]; measure: boolean; face: 'mono' | 'type' | 'cjk'; shape?: 'block' | 'braille' };

const split = (s: string) => [...s];
const PRINTABLE = split('.\'`,-_:;"~^=+<>!/\\|()[]{}?17ijltrcvxzsoaeunJLTYCIFZ2345690&%$#@MWNQBDRHKGESOPAXV8');

export const RAMPS: Record<RampId, RampDef> = {
  'GLY-TYP-RMP-001': { name: 'Classic ten', glyphs: split(' .:-=+*#%@'), measure: false, face: 'mono' },
  // the full printable set measured by coverage, thinned to 24 evenly spaced steps (the atlas stays small)
  'GLY-TYP-RMP-002': { name: 'Dense seventy', glyphs: [' ', ...PRINTABLE], measure: true, face: 'mono' },
  'GLY-TYP-RMP-003': { name: 'Block shades', glyphs: [' ', '░', '▒', '▓', '█'], measure: false, face: 'mono', shape: 'block' },
  'GLY-TYP-RMP-004': { name: 'Braille dots', glyphs: split('012345678'), measure: false, face: 'mono', shape: 'braille' },
  'GLY-TYP-RMP-005': { name: 'Box drawing', glyphs: split(' ·─│┌┼╪╬▒█'), measure: true, face: 'mono' },
  'GLY-TYP-RMP-006': { name: 'Quiet punctuation', glyphs: split(" .,':;"), measure: true, face: 'type' },
  'GLY-TYP-RMP-007': { name: 'Numerals', glyphs: [' ', ...split('0123456789')], measure: true, face: 'mono' },
  'GLY-TYP-RMP-008': { name: 'Greek accents', glyphs: [' ', ...split('ιτνγλπαεσοκυδζξηθβφψωΛΣΘΦΨΩ')], measure: true, face: 'mono' },
  'GLY-TYP-RMP-009': { name: 'Cyrillic', glyphs: [' ', ...split('гтлпкнсаеоьзэяуцдбвжфшщыюЖШЩЫЮФ')], measure: true, face: 'mono' },
  'GLY-TYP-RMP-010': { name: 'Kana', glyphs: [' ', ...split('ノヽ一ニソシツトハカキクケコサスセタナヌネマミムメモヤユヨラリルレロワヲン')], measure: true, face: 'cjk' },
  'GLY-TYP-RMP-011': { name: 'Hangul jamo', glyphs: [' ', ...split('ㅡㅣㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎㅏㅑㅓㅕㅗㅛㅜㅠ')], measure: true, face: 'cjk' },
  // typewriter overstrike: two strikes in one cell for the dark end of the ramp
  'GLY-TYP-RMP-012': { name: 'Typewriter overstrike pairs', glyphs: [' ', '.', ',', ':', '-', '=', 'c', 'o', 'c/', 'o/', 'O-', 'X=', 'O#', 'M#', 'W#'], measure: true, face: 'type' },
  'GLY-TYP-RMP-013': { name: 'Teletext mosaics', glyphs: [], measure: false, face: 'mono' },
};

const FACE = {
  mono: (px: number) => `700 ${px}px "JetBrains Mono Variable", ui-monospace, monospace`,
  type: (px: number) => `400 ${px}px "Special Elite", "Courier New", monospace`,
  cjk: (px: number) => `600 ${px}px "Noto Sans JP", "Noto Sans KR", "Hiragino Sans", "Malgun Gothic", sans-serif`,
};

/** how many cells the atlas for a ramp has (the dense set is thinned to 24) */
export const rampSize = (id: RampId) => (id === 'GLY-TYP-RMP-002' ? 24 : RAMPS[id].glyphs.length);

function paintGlyph(c: CanvasRenderingContext2D, g: string, x: number, cell: number, face: RampDef['face'], shape?: RampDef['shape']) {
  if (shape === 'block') {
    const level = ['░', '▒', '▓', '█'].indexOf(g) + 1;
    if (level <= 0) return;
    if (level === 4) {
      c.fillRect(x, 0, cell, cell);
      return;
    }
    // shades as dot patterns with exact coverage 25 / 50 / 75 %
    const d = cell / 8;
    for (let yy = 0; yy < 8; yy++)
      for (let xx = 0; xx < 8; xx++) {
        const on = level === 1 ? (xx + yy * 2) % 4 === 0 : level === 2 ? (xx + yy) % 2 === 0 : (xx + yy * 2) % 4 !== 0;
        if (on) c.fillRect(x + xx * d, yy * d, d, d);
      }
    return;
  }
  if (shape === 'braille') {
    const n = Number(g);
    // dots filled in a fixed order that keeps the cell balanced
    const order = [
      [0, 1],
      [1, 2],
      [0, 3],
      [1, 0],
      [0, 0],
      [1, 3],
      [0, 2],
      [1, 1],
    ];
    const r = cell * 0.09;
    for (let k = 0; k < n; k++) {
      const [ix, iy] = order[k]!;
      c.beginPath();
      c.arc(x + cell * (0.32 + ix! * 0.36), cell * (0.14 + iy! * 0.24), r, 0, Math.PI * 2);
      c.fill();
    }
    return;
  }
  if (g === ' ') return;
  c.font = FACE[face](Math.round(cell * (face === 'cjk' ? 0.82 : 0.86)));
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  for (const ch of g) c.fillText(ch, x + cell / 2, cell / 2 + 1); // pairs strike the same cell twice
}

/** the atlas for a ramp, for `h.ascii({ atlas })` */
export function rampAtlas(id: RampId): AsciiAtlas {
  const def = RAMPS[id];
  const n = rampSize(id);
  return {
    key: id,
    n,
    paint(c, cell) {
      c.fillStyle = '#ffffff';
      let glyphs = def.glyphs;
      if (def.measure) {
        // measure each glyph's ink in the face, then sort (empty first); thin to n evenly spaced steps
        const m = document.createElement('canvas');
        m.width = cell;
        m.height = cell;
        const mc = m.getContext('2d', { willReadFrequently: true })!;
        mc.fillStyle = '#ffffff';
        const cover = glyphs.map((g) => {
          mc.clearRect(0, 0, cell, cell);
          paintGlyph(mc, g, 0, cell, def.face, def.shape);
          const px = mc.getImageData(0, 0, cell, cell).data;
          let s = 0;
          for (let i = 3; i < px.length; i += 4) s += px[i]!;
          return { g, s };
        });
        cover.sort((a, b) => a.s - b.s);
        glyphs = cover.map((x) => x.g);
        if (glyphs.length > n) glyphs = Array.from({ length: n }, (_, i) => glyphs[Math.round((i * (glyphs.length - 1)) / (n - 1))]!);
      }
      glyphs.forEach((g, i) => paintGlyph(c, g, i * cell, cell, def.face, def.shape));
    },
  };
}

export type RegisterId = 'GLY-PRC-REG-001' | 'GLY-PRC-REG-002' | 'GLY-PRC-REG-003' | 'GLY-PRC-REG-004' | 'GLY-PRC-REG-005';
export type PaletteId = 'GLY-PAL-PAL-001' | 'GLY-PAL-PAL-002' | 'GLY-PAL-PAL-003' | 'GLY-PAL-PAL-004' | 'GLY-PAL-PAL-005' | 'GLY-PAL-PAL-006' | 'GLY-PAL-PAL-007' | 'GLY-PAL-PAL-008';

/** a register's colours: the picture gradient (dark, mid, bright), the band text, its background, the accent (inverted bar) */
export type Colours = { c0: string; c1: string; c2: string; text: string; bandBg: string; accent: string; bg: string; ink?: string; paper?: string };

export const PHOSPHOR: Record<'GLY-PAL-PAL-001' | 'GLY-PAL-PAL-002' | 'GLY-PAL-PAL-003', Colours> = {
  'GLY-PAL-PAL-001': { c0: '#000400', c1: '#0f7a2a', c2: '#7dff9a', text: '#c8ffd4', bandBg: '#000000', accent: '#3dff6e', bg: '#000300' },
  'GLY-PAL-PAL-002': { c0: '#050200', c1: '#8a4a00', c2: '#ffc266', text: '#ffe2b0', bandBg: '#000000', accent: '#ffb030', bg: '#040200' },
  'GLY-PAL-PAL-003': { c0: '#020304', c1: '#5d6670', c2: '#e8f0ff', text: '#ffffff', bandBg: '#000000', accent: '#e8f0ff', bg: '#020304' },
};

const hex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
function hsl(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return `#${hex(f(0) * 255)}${hex(f(8) * 255)}${hex(f(4) * 255)}`;
}
function hueSat(c: string): { h: number; s: number; l: number } {
  const n = parseInt(c.replace('#', '').slice(0, 6), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  if (d < 1e-6) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h /= 6;
  if (h < 0) h += 1;
  return { h, s, l };
}
export const lumOf = (c: string) => hueSat(c).l;

/** GLY-PAL-PAL-004: the cover's (or palette's) most saturated hue at high luminance; null when there is no real hue */
export function coverPhosphor(colours: string[]): Colours | null {
  let best: { h: number; s: number } | null = null;
  for (const c of colours) {
    if (!/^#[0-9a-f]{6}/i.test(c)) continue;
    const v = hueSat(c);
    if (v.s > 0.35 && v.l > 0.12 && v.l < 0.9 && (!best || v.s > best.s)) best = v;
  }
  if (!best) return null;
  return { c0: hsl(best.h, 0.6, 0.02), c1: hsl(best.h, 0.85, 0.3), c2: hsl(best.h, 1, 0.72), text: hsl(best.h, 1, 0.9), bandBg: '#000000', accent: hsl(best.h, 1, 0.62), bg: hsl(best.h, 0.5, 0.015) };
}

/** block shade (REG-005): coloured blocks from the song's palette on black */
export function blockColours(colours: string[], fallback: Colours): Colours {
  const vivid = colours.filter((c) => /^#[0-9a-f]{6}/i.test(c) && hueSat(c).s > 0.25);
  if (vivid.length < 2) return { ...fallback };
  const [a, b] = vivid.map(hueSat).sort((x, y) => x.l - y.l);
  return { c0: '#000000', c1: hsl(a!.h, Math.max(0.6, a!.s), 0.38), c2: hsl(b!.h, Math.max(0.6, b!.s), 0.68), text: '#ffffff', bandBg: '#000000', accent: hsl(b!.h, 0.9, 0.62), bg: '#000000' };
}

/** teletext (PAL-005): the eight colours */
export const TELETEXT = { black: '#000000', red: '#ff0000', green: '#00ff00', yellow: '#ffff00', blue: '#0000ff', magenta: '#ff00ff', cyan: '#00ffff', white: '#ffffff' } as const;
export type TtColour = keyof typeof TELETEXT;

/** typewriter ribbons on paper (PAL-006 black, PAL-007 red-black) */
export const RIBBON = {
  'GLY-PAL-PAL-006': { ink: '#1b1a1f', red: null as string | null },
  'GLY-PAL-PAL-007': { ink: '#1b1a1f', red: '#b3261e' },
};

/** 1-bit duotone (PAL-008): paper from the lightest swatch, ink from the darkest, pushed apart until they read (7:1) */
export function duotone(colours: string[]): { ink: string; paper: string } {
  const cs = colours.filter((c) => /^#[0-9a-f]{6}/i.test(c));
  if (cs.length < 2) return { ink: '#141414', paper: '#efe9dc' };
  const sorted = [...cs].sort((a, b) => lumOf(a) - lumOf(b));
  const dk = hueSat(sorted[0]!);
  const lt = hueSat(sorted[sorted.length - 1]!);
  return { ink: hsl(dk.h, Math.min(0.6, dk.s), 0.1), paper: hsl(lt.h, Math.min(0.45, lt.s), 0.9) };
}
