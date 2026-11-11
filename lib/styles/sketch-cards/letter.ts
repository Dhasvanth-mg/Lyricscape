// Hand lettering on a card (Sketch Cards design-spec sections 3 and 6): the role layout ported from the Turbo sketch scene (a few
// huge words, one or two on a coloured pill, the rest thin hand lettering), made script-aware. Latin is lettered a letter at a
// time with a small wobble; Devanagari, Tamil, Arabic and Hebrew are lettered a word at a time (a per-letter jitter would break
// conjuncts and joining), are never upper-cased, and use a hand face that has the script. RTL lines flow right to left.

import { contrastRatio } from '../../kinetic/util';
import { onPill, readable, type ColourSet } from './colour';
import type { Rect } from './cards';
import { rng } from './pen';

export type Script = 'latin' | 'devanagari' | 'tamil' | 'arabic' | 'hebrew' | 'other';

export function scriptOf(text: string): Script {
  let lat = 0;
  const n: Record<Exclude<Script, 'latin' | 'other'>, number> = { devanagari: 0, tamil: 0, arabic: 0, hebrew: 0 };
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c >= 0x0900 && c <= 0x097f) n.devanagari++;
    else if (c >= 0x0b80 && c <= 0x0bff) n.tamil++;
    else if ((c >= 0x0600 && c <= 0x06ff) || (c >= 0x0750 && c <= 0x077f)) n.arabic++;
    else if (c >= 0x0590 && c <= 0x05ff) n.hebrew++;
    else if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || (c >= 0xc0 && c <= 0x24f)) lat++;
  }
  let best: Script = lat > 0 ? 'latin' : 'other';
  let bn = lat;
  for (const [k, v] of Object.entries(n) as [Script, number][]) if (v > bn) (best = k), (bn = v);
  return best;
}
export const isRtl = (s: Script) => s === 'arabic' || s === 'hebrew';
const complex = (s: Script) => s !== 'latin' && s !== 'other';

export type Role = 'big' | 'pill' | 'mid' | 'thin';
export type Hand = { id: string; big: string; mid: string; thin: string };

/** SKC-TYP-FNT-001..008: the Latin pairings (big / mid / thin), as the manifest names them */
export const LATIN_HANDS: Hand[] = [
  { id: 'SKC-TYP-FNT-001', big: 'Anton', mid: 'Permanent Marker', thin: 'Special Elite' },
  { id: 'SKC-TYP-FNT-002', big: 'Anton', mid: 'Special Elite', thin: 'Cormorant Garamond' },
  { id: 'SKC-TYP-FNT-003', big: 'Anton', mid: 'Permanent Marker', thin: 'Instrument Serif' },
  { id: 'SKC-TYP-FNT-004', big: 'Bebas Neue', mid: 'Permanent Marker', thin: 'Caveat' },
  { id: 'SKC-TYP-FNT-005', big: 'Bangers', mid: 'Permanent Marker', thin: 'Caveat' },
  { id: 'SKC-TYP-FNT-006', big: 'Bebas Neue', mid: 'Special Elite', thin: 'Instrument Serif' },
  { id: 'SKC-TYP-FNT-007', big: 'Anton', mid: 'Caveat', thin: 'Cormorant Garamond' },
  { id: 'SKC-TYP-FNT-008', big: 'Bangers', mid: 'Special Elite', thin: 'Caveat' },
];
/** SKC-TYP-FNT-009..012: the script pairings */
const SCRIPT_HAND: Partial<Record<Script, Hand>> = {
  devanagari: { id: 'SKC-TYP-FNT-009', big: 'Noto Sans Devanagari Variable', mid: 'Kalam', thin: 'Kalam' },
  tamil: { id: 'SKC-TYP-FNT-010', big: 'Noto Sans Tamil Variable', mid: 'Kavivanar', thin: 'Noto Sans Tamil Variable' },
  arabic: { id: 'SKC-TYP-FNT-011', big: 'Noto Sans Arabic Variable', mid: 'Noto Sans Arabic Variable', thin: 'Noto Sans Arabic Variable' },
  hebrew: { id: 'SKC-TYP-FNT-012', big: 'Noto Sans Hebrew Variable', mid: 'Noto Sans Hebrew Variable', thin: 'Noto Sans Hebrew Variable' },
};
export const handFor = (script: Script, pick: number): Hand => SCRIPT_HAND[script] ?? LATIN_HANDS[pick % LATIN_HANDS.length]!;

/** SKC-TYP-PIL-001..005 and SKC-TYP-BIG-001..005 */
export type PillKind = 'blob' | 'box' | 'tape' | 'ring' | 'highlight';
export type BigKind = 'outline' | 'shadow' | 'plain' | 'underline' | 'stencil';
export const PILL_KINDS: PillKind[] = ['blob', 'box', 'tape', 'ring', 'highlight'];
export const BIG_KINDS: BigKind[] = ['outline', 'shadow', 'plain', 'underline', 'stencil'];

function face(name: string, role: Role, px: number, script: Script) {
  const weight = name === 'Kalam' ? (role === 'big' ? 700 : 400) : name.startsWith('Noto') ? (role === 'big' ? 900 : role === 'thin' ? 400 : 600) : name === 'Cormorant Garamond' ? 500 : 400;
  const italic = name === 'Instrument Serif' && role === 'thin' ? 'italic ' : '';
  void script;
  return `${italic}${weight} ${Math.round(px)}px "${name}", sans-serif`;
}

export type Placed = {
  text: string;
  /** the label actually lettered (big Latin words are capitals) */
  label: string;
  role: Role;
  /** box in card px */
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
  font: string;
  rot: number;
  color: string;
  outline: string | null;
  pill: string | null;
  pillKind: PillKind;
  bigKind: BigKind;
  idx: number;
};

const STOP = new Set(['a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'is', 'it', 'and', 'or', 'i', 'my', 'me', 'you', 'we', 'be', 'so', 'do', 'if', 'oh', 'ooh', 'yeah']);

/**
 * Lay the words of a line into `zone`. `measure(font, text)` is the host's measurer. Deterministic for the same seed.
 * Contrast floors: big and mid words 7:1 against the paper (the big word is ink with an accent drop), thin 4.5:1, pill text 4.5:1
 * against its pill.
 */
export function layoutWords(measure: (font: string, text: string) => number, words: string[], zone: Rect, set: ColourSet, hand: Hand, script: Script, seed: number, treat: { pill: PillKind; big: BigKind } = { pill: 'blob', big: 'shadow' }): Placed[] {
  const r = rng(seed);
  const n = words.length;
  if (!n) return [];
  const caps = script === 'latin';
  const score = words.map((w, i) => (STOP.has(w.toLowerCase().replace(/[^\p{L}]/gu, '')) ? 0 : [...w].length) + (i === n - 1 ? 1.5 : 0) + r() * 0.8);
  const order = [...words.keys()].sort((a, b) => score[b]! - score[a]!);
  const roles: Role[] = words.map((_, i) => (i % 2 ? 'thin' : 'mid'));
  if (n === 1) roles[0] = 'big';
  if (n >= 2) roles[order[0]!] = 'big';
  if (n >= 4) roles[order[1]!] = 'pill';
  if (n >= 7) roles[order[2]!] = 'big';
  if (n >= 9) roles[order[3]!] = 'pill';
  const fam = (role: Role) => (role === 'big' ? hand.big : role === 'thin' ? hand.thin : hand.mid);
  const k = (role: Role) => (role === 'big' ? 1.75 : role === 'pill' ? 1.12 : role === 'thin' ? 0.95 : 1.0);
  const rowK = (role: Role) => (role === 'big' ? (complex(script) ? 1.35 : 1.04) : complex(script) ? 1.5 : 1.22);
  const label = (w: string, role: Role) => (role === 'big' && caps ? w.toUpperCase() : w);
  const meas = (w: string, role: Role, size: number) => measure(face(fam(role), role, 100, script), label(w, role)) * ((size * k(role)) / 100);
  const flow = (size: number) => {
    const gap = size * 0.3;
    const rows: { items: number[]; w: number; h: number }[] = [];
    let cur = { items: [] as number[], w: 0, h: 0 };
    words.forEach((w, i) => {
      const role = roles[i]!;
      const ww = meas(w, role, size) + (role === 'pill' ? size * 0.55 : 0);
      const hh = size * k(role) * rowK(role);
      if (cur.items.length && cur.w + gap + ww > zone.w) {
        rows.push(cur);
        cur = { items: [], w: 0, h: 0 };
      }
      cur.w += (cur.items.length ? gap : 0) + ww;
      cur.h = Math.max(cur.h, hh);
      cur.items.push(i);
    });
    if (cur.items.length) rows.push(cur);
    return { rows, gap, total: rows.reduce((a, b) => a + b.h, 0), maxW: Math.max(...rows.map((x) => x.w)) };
  };
  let size = Math.min(zone.h * 0.42, zone.w * 0.3);
  while (size > 8) {
    const f = flow(size);
    if (f.total <= zone.h * 0.92 && f.maxW <= zone.w) break;
    size *= 0.96;
  }
  const f = flow(size);
  const free = Math.max(0, zone.h - f.total);
  const gapY = free / (f.rows.length + 1);
  const rtl = isRtl(script);
  const bigCol = readable(set.paper, [set.ink], 7);
  const thinCol = readable(set.paper, [set.ink], 4.5);
  // the big word's drop colour: the accent when it shows against the paper, otherwise the shade
  const drop = contrastRatio(set.accent, set.paper) >= 1.8 ? set.accent : set.shade;
  const out: Placed[] = [];
  let y = zone.y + gapY;
  f.rows.forEach((row, ri) => {
    const slack = Math.max(0, zone.w - row.w);
    const lead = slack * (ri % 2 ? 0.5 + r() * 0.4 : r() * 0.3);
    let x = rtl ? zone.x + zone.w - lead : zone.x + lead;
    row.items.forEach((i) => {
      const role = roles[i]!;
      const sz = size * k(role);
      const ww = meas(words[i]!, role, size) + (role === 'pill' ? size * 0.55 : 0);
      const pill = role === 'pill' ? set.pill : null;
      const onPaper = treat.pill === 'ring' || treat.pill === 'highlight';
      const color = role === 'pill' ? (onPaper ? bigCol : onPill(set.pill, set)) : role === 'thin' ? thinCol : bigCol;
      const bx = rtl ? x - ww : x;
      out.push({ text: words[i]!, label: label(words[i]!, role), role, x: bx, y: y + (row.h - sz * rowK(role)) / 2 + (r() - 0.5) * size * 0.08, w: ww, h: sz * rowK(role), size: sz, font: face(fam(role), role, sz, script), rot: (r() - 0.5) * 0.08, color, outline: role === 'big' ? drop : null, pill, pillKind: treat.pill, bigKind: complex(script) && treat.big === 'stencil' ? 'shadow' : treat.big, idx: i });
      x += rtl ? -(ww + f.gap) : ww + f.gap;
    });
    y += row.h + gapY;
  });
  return out;
}

/** the canvas size a placed word needs (its box plus room for rotation, the drop and the pill) */
export function wordBox(p: Placed) {
  const pad = Math.ceil(p.size * 0.25 + 6);
  return { W: Math.ceil(p.w + pad * 2), H: Math.ceil(p.h + pad * 2), pad };
}

function blob(c: CanvasRenderingContext2D, rx: number, ry: number, r: () => number) {
  c.beginPath();
  const ph = r() * 6;
  for (let i = 0; i <= 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const q = 1 + 0.05 * Math.sin(a * 3 + ph) + 0.03 * Math.sin(a * 5 + ph * 2);
    c.lineTo(Math.cos(a) * rx * q, Math.sin(a) * ry * q);
  }
  c.closePath();
}

/** Letter one placed word into a canvas sized by `wordBox`. `highlight` paints a highlighter swipe behind it (SKC-PRC-PRT-007). */
export function letterWord(c: CanvasRenderingContext2D, p: Placed, script: Script, seed: number, highlight: string | null) {
  const { W, H } = wordBox(p);
  const r = rng(seed);
  c.save();
  c.translate(W / 2, H / 2);
  c.rotate(p.rot);
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  if (highlight) {
    c.fillStyle = highlight;
    c.globalAlpha = 0.55;
    c.beginPath();
    c.moveTo(-p.w / 2 - 4, -p.h * 0.05);
    c.lineTo(p.w / 2 + 6, -p.h * 0.12);
    c.lineTo(p.w / 2 + 4, p.h * 0.32);
    c.lineTo(-p.w / 2 - 6, p.h * 0.36);
    c.closePath();
    c.fill();
    c.globalAlpha = 1;
  }
  if (p.pill) {
    c.fillStyle = p.pill;
    c.strokeStyle = p.pill;
    const pw = p.w * 0.54;
    const ph = p.h * 0.5;
    switch (p.pillKind) {
      case 'box':
        c.beginPath();
        c.moveTo(-pw + (r() - 0.5) * 4, -ph);
        c.lineTo(pw, -ph + (r() - 0.5) * 4);
        c.lineTo(pw + (r() - 0.5) * 4, ph);
        c.lineTo(-pw, ph + (r() - 0.5) * 4);
        c.closePath();
        c.fill();
        break;
      case 'tape': {
        // a strip of coloured tape: torn ends, a little see-through
        c.globalAlpha = 0.85;
        c.beginPath();
        c.moveTo(-pw, -ph * 0.8);
        c.lineTo(pw, -ph * 0.85);
        for (let k = 0; k <= 6; k++) c.lineTo(pw + (k % 2 ? 4 : -2), -ph * 0.85 + (k / 6) * ph * 1.7);
        c.lineTo(-pw, ph * 0.8);
        for (let k = 6; k >= 0; k--) c.lineTo(-pw + (k % 2 ? -4 : 2), -ph * 0.8 + (k / 6) * ph * 1.6);
        c.closePath();
        c.fill();
        c.globalAlpha = 1;
        break;
      }
      case 'ring':
        // circled in marker, the loop not quite closing
        c.lineWidth = Math.max(2, p.size * 0.07);
        c.beginPath();
        for (let k = 0; k <= 34; k++) {
          const a = -0.4 + (k / 30) * Math.PI * 2;
          c.lineTo(Math.cos(a) * pw * (1 + k * 0.004), Math.sin(a) * ph * 1.05);
        }
        c.stroke();
        break;
      case 'highlight':
        c.globalAlpha = 0.6;
        c.fillRect(-pw, -ph * 0.35, pw * 2, ph * 1.0);
        c.globalAlpha = 1;
        break;
      default:
        blob(c, pw, ph, r);
        c.fill();
    }
  }
  c.font = p.font;
  const inner = p.w - (p.pill ? p.size * 0.55 : 0);
  const dropOff = p.size * 0.06;
  if (complex(script)) {
    // whole word: shaping and joining stay intact
    c.textAlign = 'center';
    c.direction = isRtl(script) ? 'rtl' : 'ltr';
    if (p.outline && p.bigKind === 'shadow') {
      c.fillStyle = p.outline;
      c.fillText(p.label, dropOff, dropOff);
    }
    if (p.outline && p.bigKind === 'outline') {
      c.lineWidth = Math.max(2, p.size * 0.09);
      c.strokeStyle = p.outline;
      c.strokeText(p.label, 0, 0);
    }
    c.fillStyle = p.color;
    c.fillText(p.label, 0, 0);
  } else {
    c.textAlign = 'left';
    let x = -inner / 2;
    for (const ch of p.label) {
      const wch = c.measureText(ch).width;
      c.save();
      c.translate(x + wch / 2, (r() - 0.5) * p.size * 0.08);
      c.rotate((r() - 0.5) * 0.1);
      c.scale(1, 0.94 + r() * 0.12);
      if (p.outline && p.bigKind === 'shadow') {
        c.fillStyle = p.outline;
        c.fillText(ch, -wch / 2 + dropOff, dropOff);
      }
      if (p.outline && p.bigKind === 'outline') {
        c.lineWidth = Math.max(2, p.size * 0.09);
        c.strokeStyle = p.outline;
        c.strokeText(ch, -wch / 2, 0);
      }
      c.fillStyle = p.color;
      c.fillText(ch, -wch / 2, 0);
      c.restore();
      x += wch;
    }
  }
  if (p.outline && p.bigKind === 'underline') {
    // a marker underline in the accent, under the big word
    c.strokeStyle = p.outline;
    c.lineWidth = Math.max(2, p.size * 0.08);
    c.beginPath();
    c.moveTo(-inner / 2, p.size * 0.5);
    c.quadraticCurveTo(0, p.size * (0.56 + (r() - 0.5) * 0.08), inner / 2 + p.size * 0.1, p.size * 0.46);
    c.stroke();
  }
  if (p.outline && p.bigKind === 'stencil' && !complex(script)) {
    // stencil bridges: two paper-coloured bars cut across the letters
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = '#000';
    for (const fy of [-0.08, 0.14]) c.fillRect(-inner / 2 - 4, p.size * fy, inner + 8, Math.max(1.5, p.size * 0.045));
    c.globalCompositeOperation = 'source-over';
  }
  c.restore();
}
