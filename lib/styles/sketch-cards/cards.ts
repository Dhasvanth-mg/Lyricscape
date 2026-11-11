// SKC-FRM-CRD card types, SKC-PRP-COL borders and SKC-PRC-PRT print processes: the paper a line is lettered on and how it was
// made. Phase 2 planned the card types as hybrids (a photographed paper texture under a drawn shape); with no photographs in this
// project the paper is painted in code (fibre, tooth, rules, folds, tears), recorded as D3-SKC-02. A card is painted once per
// line onto a canvas with a margin for its own contact shadow, and the process is a pixel pass over that canvas.

import { mix } from '../../kinetic/util';
import { readable, type ColourSet } from './colour';
import { rng } from './pen';

export type CardTypeId = `SKC-FRM-CRD-0${'01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12' | '13' | '14'}`;
export type ProcessId = `SKC-PRC-PRT-00${1 | 2 | 3 | 4 | 5 | 6 | 7}`;
export type BorderId = `SKC-PRP-COL-0${'01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12'}`;

type Paper = 'index' | 'stock' | 'kraft' | 'sticky' | 'newsprint' | 'thermal' | 'black';
export type CardSpec = {
  id: CardTypeId;
  name: string;
  /** width / height */
  aspect: number;
  paper: Paper;
  /** the processes this card may be made with (material rule: riso only on riso sheets, photocopy only on wheatpaste and receipts) */
  processes: ProcessId[];
  /** takes a decorative border (SKC-PRP-COL) */
  border: boolean;
};

export const CARDS: Record<CardTypeId, CardSpec> = {
  'SKC-FRM-CRD-001': { id: 'SKC-FRM-CRD-001', name: 'Index card (ruled)', aspect: 5 / 3, paper: 'index', processes: ['SKC-PRC-PRT-005', 'SKC-PRC-PRT-001', 'SKC-PRC-PRT-004'], border: false },
  'SKC-FRM-CRD-002': { id: 'SKC-FRM-CRD-002', name: 'Plain card stock', aspect: 4 / 3, paper: 'stock', processes: ['SKC-PRC-PRT-001', 'SKC-PRC-PRT-004'], border: true },
  'SKC-FRM-CRD-003': { id: 'SKC-FRM-CRD-003', name: 'Napkin (folded edge)', aspect: 1, paper: 'index', processes: ['SKC-PRC-PRT-005', 'SKC-PRC-PRT-004'], border: false },
  'SKC-FRM-CRD-004': { id: 'SKC-FRM-CRD-004', name: 'Receipt (long, thermal paper)', aspect: 0.46, paper: 'thermal', processes: ['SKC-PRC-PRT-003'], border: false },
  'SKC-FRM-CRD-005': { id: 'SKC-FRM-CRD-005', name: 'Sticky note', aspect: 1, paper: 'sticky', processes: ['SKC-PRC-PRT-004', 'SKC-PRC-PRT-005'], border: false },
  'SKC-FRM-CRD-006': { id: 'SKC-FRM-CRD-006', name: 'Poster sheet', aspect: 0.75, paper: 'stock', processes: ['SKC-PRC-PRT-001', 'SKC-PRC-PRT-004'], border: true },
  'SKC-FRM-CRD-007': { id: 'SKC-FRM-CRD-007', name: 'Envelope back', aspect: 1.6, paper: 'kraft', processes: ['SKC-PRC-PRT-005', 'SKC-PRC-PRT-004'], border: false },
  'SKC-FRM-CRD-008': { id: 'SKC-FRM-CRD-008', name: 'Torn notebook page', aspect: 0.8, paper: 'index', processes: ['SKC-PRC-PRT-005', 'SKC-PRC-PRT-007'], border: false },
  'SKC-FRM-CRD-009': { id: 'SKC-FRM-CRD-009', name: 'Ruled notebook page', aspect: 0.78, paper: 'index', processes: ['SKC-PRC-PRT-007', 'SKC-PRC-PRT-005'], border: false },
  'SKC-FRM-CRD-010': { id: 'SKC-FRM-CRD-010', name: 'Riso print sheet', aspect: 0.72, paper: 'stock', processes: ['SKC-PRC-PRT-002'], border: true },
  'SKC-FRM-CRD-011': { id: 'SKC-FRM-CRD-011', name: 'Wheatpaste poster', aspect: 0.7, paper: 'newsprint', processes: ['SKC-PRC-PRT-003'], border: false },
  'SKC-FRM-CRD-012': { id: 'SKC-FRM-CRD-012', name: 'Large cue card board', aspect: 1.42, paper: 'index', processes: ['SKC-PRC-PRT-004'], border: false },
  'SKC-FRM-CRD-013': { id: 'SKC-FRM-CRD-013', name: 'Ticket stub', aspect: 2.2, paper: 'stock', processes: ['SKC-PRC-PRT-001', 'SKC-PRC-PRT-005'], border: false },
  'SKC-FRM-CRD-014': { id: 'SKC-FRM-CRD-014', name: 'Torn black page (dark register)', aspect: 0.78, paper: 'black', processes: ['SKC-PRC-PRT-006'], border: false },
};

export const BORDER_IDS: BorderId[] = Array.from({ length: 12 }, (_, i) => `SKC-PRP-COL-${String(i + 1).padStart(3, '0')}` as BorderId);

export type Rect = { x: number; y: number; w: number; h: number };

// ---- shapes ------------------------------------------------------------------------------------------------------------------
/** the outline of a card type in a w x h box at (0, 0): straight sides, torn edges, a receipt's zigzag, a ticket's notches */
function outline(cx: CanvasRenderingContext2D, id: CardTypeId, w: number, h: number, r: () => number) {
  cx.beginPath();
  const torn = (x0: number, y0: number, x1: number, y1: number, amp: number, step: number) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(2, Math.round(len / step));
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const o = i === 0 || i === n ? 0 : (r() - 0.5) * amp * 2;
      cx.lineTo(x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o);
    }
  };
  const s = Math.min(w, h);
  switch (id) {
    case 'SKC-FRM-CRD-004': {
      // receipt: torn-off zigzag at both ends
      const z = s * 0.035;
      cx.moveTo(0, z);
      for (let x = 0; x <= w; x += z * 2) cx.lineTo(Math.min(w, x + z), 0), cx.lineTo(Math.min(w, x + z * 2), z);
      cx.lineTo(w, h - z);
      for (let x = w; x >= 0; x -= z * 2) cx.lineTo(Math.max(0, x - z), h), cx.lineTo(Math.max(0, x - z * 2), h - z);
      cx.closePath();
      return;
    }
    case 'SKC-FRM-CRD-008':
      // torn out of a spiral notebook: the left edge is ragged
      cx.moveTo(w, 0);
      cx.lineTo(w, h);
      torn(s * 0.03, h, s * 0.03, 0, s * 0.012, s * 0.02);
      cx.closePath();
      return;
    case 'SKC-FRM-CRD-014':
      cx.moveTo(0, 0);
      torn(0, 0, w, 0, s * 0.02, s * 0.03);
      torn(w, 0, w, h, s * 0.012, s * 0.04);
      torn(w, h, 0, h, s * 0.025, s * 0.03);
      cx.closePath();
      return;
    case 'SKC-FRM-CRD-011':
      // pasted poster: slightly ragged everywhere, a corner peeled
      cx.moveTo(0, 0);
      torn(0, 0, w * 0.88, 0, s * 0.006, s * 0.04);
      cx.lineTo(w, h * 0.1);
      torn(w, h * 0.1, w, h, s * 0.006, s * 0.05);
      torn(w, h, 0, h, s * 0.006, s * 0.04);
      cx.closePath();
      return;
    case 'SKC-FRM-CRD-013': {
      // ticket: notched semicircles at the tear line, rounded corners
      const k = s * 0.08;
      const tx = w * 0.72;
      cx.moveTo(k, 0);
      cx.lineTo(tx - k, 0);
      cx.arc(tx, 0, k, Math.PI, 0, true);
      cx.lineTo(w - k, 0);
      cx.quadraticCurveTo(w, 0, w, k);
      cx.lineTo(w, h - k);
      cx.quadraticCurveTo(w, h, w - k, h);
      cx.lineTo(tx + k, h);
      cx.arc(tx, h, k, 0, Math.PI, true);
      cx.lineTo(k, h);
      cx.quadraticCurveTo(0, h, 0, h - k);
      cx.lineTo(0, k);
      cx.quadraticCurveTo(0, 0, k, 0);
      cx.closePath();
      return;
    }
    case 'SKC-FRM-CRD-012': {
      const k = s * 0.025;
      cx.roundRect(0, 0, w, h, k);
      return;
    }
    default:
      cx.rect(0, 0, w, h);
  }
}

function grain(cx: CanvasRenderingContext2D, w: number, h: number, r: () => number, color: string, n: number, size: number) {
  cx.fillStyle = color;
  for (let i = 0; i < n; i++) cx.fillRect(r() * w, r() * h, size * (0.6 + r()), size * (0.4 + r() * 0.6));
}

/** the paper's own marks: rules, folds, flaps, perforations; drawn inside the outline */
function paperMarks(cx: CanvasRenderingContext2D, id: CardTypeId, w: number, h: number, set: ColourSet, r: () => number) {
  const s = Math.min(w, h);
  const line = (x0: number, y0: number, x1: number, y1: number, col: string, lw: number) => {
    cx.strokeStyle = col;
    cx.lineWidth = lw;
    cx.beginPath();
    cx.moveTo(x0, y0);
    cx.lineTo(x1, y1);
    cx.stroke();
  };
  switch (id) {
    case 'SKC-FRM-CRD-001': {
      line(0, h * 0.2, w, h * 0.2, 'rgba(214,74,74,0.75)', s * 0.008);
      for (let y = h * 0.2 + s * 0.11; y < h - s * 0.04; y += s * 0.11) line(0, y, w, y, 'rgba(90,140,200,0.45)', s * 0.005);
      break;
    }
    case 'SKC-FRM-CRD-009':
    case 'SKC-FRM-CRD-008': {
      for (let y = h * 0.12; y < h - s * 0.03; y += s * 0.075) line(0, y, w, y, 'rgba(90,140,200,0.5)', s * 0.005);
      line(w * 0.14, 0, w * 0.14, h, 'rgba(214,74,74,0.6)', s * 0.006);
      if (id === 'SKC-FRM-CRD-009') {
        cx.fillStyle = 'rgba(0,0,0,0.12)';
        for (let y = s * 0.08; y < h; y += s * 0.13) {
          cx.beginPath();
          cx.arc(w * 0.06, y, s * 0.022, 0, Math.PI * 2);
          cx.fill();
        }
      }
      break;
    }
    case 'SKC-FRM-CRD-003': {
      // napkin: an embossed quilt border and a fold across the middle
      cx.strokeStyle = 'rgba(0,0,0,0.08)';
      cx.lineWidth = s * 0.004;
      cx.strokeRect(s * 0.06, s * 0.06, w - s * 0.12, h - s * 0.12);
      for (let i = 0; i < 12; i++) {
        const t = (i + 0.5) / 12;
        for (const [x, y] of [[t * w, s * 0.03], [t * w, h - s * 0.03], [s * 0.03, t * h], [w - s * 0.03, t * h]] as const) {
          cx.beginPath();
          cx.arc(x, y, s * 0.008, 0, Math.PI * 2);
          cx.stroke();
        }
      }
      const g = cx.createLinearGradient(0, h * 0.48, 0, h * 0.52);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.12)');
      g.addColorStop(1, 'rgba(255,255,255,0.2)');
      cx.fillStyle = g;
      cx.fillRect(0, h * 0.48, w, h * 0.04);
      break;
    }
    case 'SKC-FRM-CRD-004': {
      // receipt: printed shop header bars and a dotted rule; thermal paper greys toward one end
      cx.fillStyle = 'rgba(0,0,0,0.55)';
      for (let i = 0; i < 3; i++) cx.fillRect(w * 0.2, s * 0.12 + i * s * 0.05, w * (0.6 - i * 0.15), s * 0.022);
      cx.setLineDash([s * 0.02, s * 0.02]);
      line(s * 0.06, s * 0.32, w - s * 0.06, s * 0.32, 'rgba(0,0,0,0.5)', s * 0.008);
      line(s * 0.06, h - s * 0.3, w - s * 0.06, h - s * 0.3, 'rgba(0,0,0,0.5)', s * 0.008);
      cx.setLineDash([]);
      cx.fillStyle = 'rgba(0,0,0,0.6)';
      for (let i = 0; i < 26; i++) cx.fillRect(s * 0.1 + i * ((w - s * 0.2) / 26), h - s * 0.22, ((w - s * 0.2) / 26) * (r() > 0.5 ? 0.6 : 0.3), s * 0.12);
      const g = cx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(120,110,90,0)');
      g.addColorStop(1, 'rgba(120,110,90,0.12)');
      cx.fillStyle = g;
      cx.fillRect(0, 0, w, h);
      break;
    }
    case 'SKC-FRM-CRD-005': {
      // sticky note: the glue strip is a touch darker; the bottom corner lifts (shade gradient)
      cx.fillStyle = 'rgba(0,0,0,0.05)';
      cx.fillRect(0, 0, w, h * 0.16);
      const g = cx.createLinearGradient(w * 0.6, h * 0.6, w, h);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.14)');
      cx.fillStyle = g;
      cx.fillRect(0, 0, w, h);
      break;
    }
    case 'SKC-FRM-CRD-007': {
      // envelope back: flap and side seams
      cx.strokeStyle = 'rgba(70,45,20,0.45)';
      cx.lineWidth = s * 0.008;
      cx.beginPath();
      cx.moveTo(0, 0);
      cx.lineTo(w * 0.5, h * 0.55);
      cx.lineTo(w, 0);
      cx.moveTo(0, h);
      cx.lineTo(w * 0.38, h * 0.45);
      cx.moveTo(w, h);
      cx.lineTo(w * 0.62, h * 0.45);
      cx.stroke();
      break;
    }
    case 'SKC-FRM-CRD-011': {
      // wheatpaste: wrinkles and paste sheen
      cx.strokeStyle = 'rgba(0,0,0,0.12)';
      cx.lineWidth = s * 0.004;
      for (let i = 0; i < 9; i++) {
        const x = r() * w;
        const y = r() * h;
        cx.beginPath();
        cx.moveTo(x, y);
        cx.quadraticCurveTo(x + (r() - 0.5) * s * 0.3, y + (r() - 0.5) * s * 0.3, x + (r() - 0.5) * s * 0.5, y + (r() - 0.5) * s * 0.5);
        cx.stroke();
      }
      cx.fillStyle = 'rgba(255,255,240,0.12)';
      cx.beginPath();
      cx.moveTo(w * 0.88, 0);
      cx.lineTo(w, h * 0.1);
      cx.lineTo(w * 0.86, h * 0.07);
      cx.closePath();
      cx.fill();
      break;
    }
    case 'SKC-FRM-CRD-012': {
      // cue board: the board's corrugated edge shows at the bottom, thick
      cx.fillStyle = mix(set.paper, '#a07a4a', 0.5);
      cx.fillRect(0, h - s * 0.03, w, s * 0.03);
      break;
    }
    case 'SKC-FRM-CRD-013': {
      cx.setLineDash([s * 0.03, s * 0.025]);
      line(w * 0.72, s * 0.1, w * 0.72, h - s * 0.1, mix(set.paper, set.ink, 0.4), s * 0.012);
      cx.setLineDash([]);
      cx.strokeStyle = mix(set.paper, set.accent, 0.6);
      cx.lineWidth = s * 0.02;
      cx.strokeRect(s * 0.07, s * 0.07, w * 0.72 - s * 0.16, h - s * 0.14);
      cx.save();
      cx.translate(w * 0.86, h / 2);
      cx.rotate(-Math.PI / 2);
      cx.fillStyle = mix(set.paper, set.ink, 0.6);
      cx.font = `700 ${Math.round(s * 0.13)}px "Special Elite", monospace`;
      cx.textAlign = 'center';
      cx.textBaseline = 'middle';
      cx.fillText(`№ ${String(Math.floor(r() * 9000) + 1000)}`, 0, 0);
      cx.restore();
      break;
    }
    case 'SKC-FRM-CRD-014':
      // black page: chalky smudges
      for (let i = 0; i < 5; i++) {
        const g = cx.createRadialGradient(r() * w, r() * h, 0, r() * w, r() * h, s * (0.2 + r() * 0.3));
        g.addColorStop(0, 'rgba(255,255,255,0.05)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        cx.fillStyle = g;
        cx.fillRect(0, 0, w, h);
      }
      break;
  }
}

/** SKC-PRP-COL: a decorative border drawn just inside the card edge in the card's own colours */
function paintBorder(cx: CanvasRenderingContext2D, id: BorderId, w: number, h: number, set: ColourSet, r: () => number) {
  const s = Math.min(w, h);
  const m = s * 0.045;
  const iw = w - m * 2;
  const ih = h - m * 2;
  const edge = (f: (x: number, y: number, ang: number, i: number) => void, step: number) => {
    let i = 0;
    for (let x = m; x <= w - m; x += step) f(x, m, 0, i++);
    for (let y = m; y <= h - m; y += step) f(w - m, y, Math.PI / 2, i++);
    for (let x = w - m; x >= m; x -= step) f(x, h - m, Math.PI, i++);
    for (let y = h - m; y >= m; y -= step) f(m, y, -Math.PI / 2, i++);
  };
  cx.lineCap = 'round';
  switch (id) {
    case 'SKC-PRP-COL-001': // hatch band
    case 'SKC-PRP-COL-005': {
      cx.save();
      cx.beginPath();
      cx.rect(0, 0, w, h);
      cx.rect(m * 1.8, m * 1.8, w - m * 3.6, h - m * 3.6);
      cx.clip('evenodd');
      cx.strokeStyle = set.shade;
      cx.lineWidth = s * 0.006;
      for (let i = -h; i < w + h; i += s * 0.022) {
        cx.beginPath();
        cx.moveTo(i, h);
        cx.lineTo(i + h, 0);
        cx.stroke();
        if (id === 'SKC-PRP-COL-005') {
          cx.beginPath();
          cx.moveTo(i, 0);
          cx.lineTo(i + h, h);
          cx.stroke();
        }
      }
      cx.restore();
      break;
    }
    case 'SKC-PRP-COL-002':
      cx.fillStyle = set.accent;
      edge((x, y) => {
        cx.beginPath();
        cx.arc(x, y, s * 0.014, 0, Math.PI * 2);
        cx.fill();
      }, s * 0.05);
      break;
    case 'SKC-PRP-COL-003':
      cx.strokeStyle = set.ink;
      cx.lineWidth = s * 0.008;
      cx.beginPath();
      edge((x, y) => cx.lineTo(x + (r() - 0.5) * s * 0.012, y + (r() - 0.5) * s * 0.012), s * 0.02);
      cx.closePath();
      cx.stroke();
      break;
    case 'SKC-PRP-COL-004':
      cx.fillStyle = set.accent;
      cx.fillRect(m, m, s * 0.035, ih);
      cx.fillRect(w - m - s * 0.035, m, s * 0.035, ih);
      cx.fillStyle = set.pill;
      cx.fillRect(m, m, iw, s * 0.025);
      break;
    case 'SKC-PRP-COL-006':
      cx.strokeStyle = set.accent;
      cx.lineWidth = s * 0.008;
      cx.beginPath();
      edge((x, y, a, i) => {
        const o = i % 2 ? s * 0.012 : -s * 0.012;
        cx.lineTo(x - Math.sin(a) * o, y + Math.cos(a) * o);
      }, s * 0.025);
      cx.closePath();
      cx.stroke();
      break;
    case 'SKC-PRP-COL-007':
      edge((x, y, _a, i) => {
        cx.fillStyle = i % 2 ? set.ink : set.paper;
        cx.fillRect(x - s * 0.012, y - s * 0.012, s * 0.024, s * 0.024);
      }, s * 0.024);
      break;
    case 'SKC-PRP-COL-008': {
      // tape strips on the corners (drawn as a border family, so a card can carry them without a wall)
      cx.fillStyle = 'rgba(240,232,200,0.75)';
      for (const [x, y, a] of [[0, 0, -0.7], [w, 0, 0.7], [w, h, -0.7], [0, h, 0.7]] as const) {
        cx.save();
        cx.translate(x, y);
        cx.rotate(a);
        cx.fillRect(-s * 0.12, -s * 0.03, s * 0.24, s * 0.06);
        cx.restore();
      }
      break;
    }
    case 'SKC-PRP-COL-009':
      cx.strokeStyle = set.ink;
      cx.lineWidth = s * 0.006;
      cx.strokeRect(m, m, iw, ih);
      cx.strokeRect(m * 1.5, m * 1.5, w - m * 3, h - m * 3);
      break;
    case 'SKC-PRP-COL-010':
      cx.strokeStyle = set.accent;
      cx.lineWidth = s * 0.007;
      cx.setLineDash([s * 0.025, s * 0.018]);
      cx.strokeRect(m, m, iw, ih);
      cx.setLineDash([]);
      break;
    case 'SKC-PRP-COL-011':
      cx.strokeStyle = set.pill;
      cx.lineWidth = s * 0.01;
      cx.beginPath();
      edge((x, y, a, i) => {
        const o = Math.sin(i * 0.9) * s * 0.012;
        cx.lineTo(x - Math.sin(a) * o, y + Math.cos(a) * o);
      }, s * 0.012);
      cx.closePath();
      cx.stroke();
      break;
    case 'SKC-PRP-COL-012': {
      const cols = [set.accent, set.pill, set.ink];
      edge((x, y) => {
        if (r() > 0.6) return;
        cx.fillStyle = cols[Math.floor(r() * 3)]!;
        cx.save();
        cx.translate(x + (r() - 0.5) * m, y + (r() - 0.5) * m);
        cx.rotate(r() * 3);
        cx.fillRect(-s * 0.012, -s * 0.005, s * 0.024, s * 0.01);
        cx.restore();
      }, s * 0.03);
      break;
    }
  }
}

/**
 * Paint a card (shape, paper, marks, border) into `cx` at its size; `pad` is the margin left round it for the contact shadow.
 * The shadow is painted here too, soft and offset down-right, so a card on any ground sits on it.
 */
export function paintCard(cx: CanvasRenderingContext2D, id: CardTypeId, w: number, h: number, pad: number, set: ColourSet, seed: number, border: BorderId | null, lift: number) {
  const r = rng(seed);
  cx.save();
  cx.translate(pad, pad);
  outline(cx, id, w, h, rng(seed ^ 0x2f));
  cx.shadowColor = `rgba(0,0,0,${0.28 + lift * 0.18})`;
  cx.shadowBlur = Math.min(w, h) * (0.02 + lift * 0.05);
  cx.shadowOffsetX = Math.min(w, h) * (0.008 + lift * 0.015);
  cx.shadowOffsetY = Math.min(w, h) * (0.014 + lift * 0.03);
  cx.fillStyle = set.paper;
  cx.fill();
  cx.shadowColor = 'transparent';
  cx.save();
  outline(cx, id, w, h, rng(seed ^ 0x2f));
  cx.clip();
  // paper tooth and fibre
  const dark = set.dark;
  grain(cx, w, h, r, dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.035)', Math.round((w * h) / 140), 1.2);
  grain(cx, w, h, r, dark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.3)', Math.round((w * h) / 260), 1.4);
  if (CARDS[id].paper === 'kraft' || CARDS[id].paper === 'newsprint') grain(cx, w, h, r, 'rgba(90,60,30,0.12)', Math.round((w * h) / 400), 2.2);
  paperMarks(cx, id, w, h, set, r);
  if (border) paintBorder(cx, border, w, h, set, r);
  cx.restore();
  cx.restore();
}

/** the inner area where words and the drawing may go (inside rules, borders, ticket stubs and receipt headers) */
export function textArea(id: CardTypeId, w: number, h: number, bordered: boolean): Rect {
  const s = Math.min(w, h);
  const m = s * (bordered ? 0.1 : 0.07);
  switch (id) {
    case 'SKC-FRM-CRD-001':
      return { x: m, y: h * 0.24, w: w - m * 2, h: h * 0.72 };
    case 'SKC-FRM-CRD-004':
      return { x: m, y: s * 0.38, w: w - m * 2, h: h - s * 0.75 };
    case 'SKC-FRM-CRD-008':
    case 'SKC-FRM-CRD-009':
      return { x: w * 0.18, y: h * 0.1, w: w * 0.76, h: h * 0.82 };
    case 'SKC-FRM-CRD-013':
      return { x: s * 0.12, y: s * 0.12, w: w * 0.72 - s * 0.24, h: h - s * 0.24 };
    case 'SKC-FRM-CRD-005':
      return { x: m, y: h * 0.18, w: w - m * 2, h: h * 0.74 };
    default:
      return { x: m, y: m, w: w - m * 2, h: h - m * 2 };
  }
}

// ---- processes ---------------------------------------------------------------------------------------------------------------
const rgbOf = (c: string): [number, number, number] => {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** the paint-program look (SKC-PRC-PRT-001, ported from the Turbo sketch scene): snap every pixel to the card's colours after noise */
function snap(d: Uint8ClampedArray, pal: [number, number, number][], noise: number, r: () => number, keepAlpha: boolean) {
  for (let i = 0; i < d.length; i += 4) {
    if (keepAlpha) {
      const a = d[i + 3]! + (r() - 0.5) * 150;
      if (a < 120) {
        d[i + 3] = 0;
        continue;
      }
    }
    if (d[i + 3] === 0) continue;
    d[i + 3] = 255;
    const nr = d[i]! + (r() - 0.5) * noise;
    const ng = d[i + 1]! + (r() - 0.5) * noise;
    const nb = d[i + 2]! + (r() - 0.5) * noise;
    let best = 0;
    let bd = 1e9;
    for (let k = 0; k < pal.length; k++) {
      const p = pal[k]!;
      const dd = (p[0] - nr) ** 2 + (p[1] - ng) ** 2 + (p[2] - nb) ** 2;
      if (dd < bd) {
        bd = dd;
        best = k;
      }
    }
    const p = pal[best]!;
    d[i] = p[0];
    d[i + 1] = p[1];
    d[i + 2] = p[2];
  }
}

/**
 * Apply a print process to a painted canvas region. `alphaOnly` = a word or drawing layer (transparent around it), otherwise
 * the whole card (its shadow margin is left alone by keeping fully transparent and shadow-only pixels out of the colour passes).
 */
export function applyProcess(cx: CanvasRenderingContext2D, w: number, h: number, process: ProcessId, set: ColourSet, seed: number, layer: boolean) {
  const r = rng(seed);
  if (process === 'SKC-PRC-PRT-004' || process === 'SKC-PRC-PRT-001' || process === 'SKC-PRC-PRT-006') {
    // marker bleed / paint-program soft edge / charcoal smudge all start from a slight blur of what was drawn
    const blur = process === 'SKC-PRC-PRT-006' ? 1.4 : process === 'SKC-PRC-PRT-001' ? 0.9 : 0.6;
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const tx = tmp.getContext('2d')!;
    tx.filter = `blur(${blur}px)`;
    tx.drawImage(cx.canvas, 0, 0);
    cx.clearRect(0, 0, w, h);
    cx.drawImage(tmp, 0, 0);
  }
  const img = cx.getImageData(0, 0, w, h);
  const d = img.data;
  switch (process) {
    case 'SKC-PRC-PRT-001': {
      const pal = [set.paper, set.ink, set.accent, set.pill, set.shade, mix(set.paper, set.accent, 0.5)].map(rgbOf);
      if (layer) snap(d, pal, 40, r, true);
      else {
        // only snap the card itself, not its shadow (alpha < 250)
        const sub = new Uint8ClampedArray(d.length);
        sub.set(d);
        snap(sub, pal, 46, r, false);
        for (let i = 0; i < d.length; i += 4) if (d[i + 3]! >= 250) (d[i] = sub[i]!), (d[i + 1] = sub[i + 1]!), (d[i + 2] = sub[i + 2]!);
      }
      break;
    }
    case 'SKC-PRC-PRT-002': {
      // riso: two drums. Dark values print in ink-drum A (the accent), mid values in drum B (the pill colour) offset by a few px
      // (misregistration), both with the drum's grainy coverage; paper shows through where neither prints.
      const A = rgbOf(set.accent);
      const B = rgbOf(set.pill === set.accent ? mix(set.accent, '#ffd23f', 0.6) : set.pill);
      const P = rgbOf(set.paper);
      const off = 3 + Math.round(r() * 3);
      const src = new Uint8ClampedArray(d);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          if (src[i + 3]! < (layer ? 40 : 250)) continue;
          const l = (src[i]! * 0.3 + src[i + 1]! * 0.59 + src[i + 2]! * 0.11) / 255;
          const j = (Math.min(h - 1, y + off) * w + Math.min(w - 1, x + off)) * 4;
          const l2 = (src[j]! * 0.3 + src[j + 1]! * 0.59 + src[j + 2]! * 0.11) / 255;
          const g = r();
          const covA = l < 0.45 ? (g < 0.92 ? 1 : 0) : l < 0.7 ? (g < (0.7 - l) * 2.4 ? 1 : 0) : 0;
          const covB = l2 < 0.8 && l2 > 0.2 ? (g < 0.75 ? 1 : 0) : 0;
          let c: [number, number, number] = [...P];
          // multiply the two inks over the paper, as overprinted riso does
          if (covB) c = [(c[0] * B[0]) / 255, (c[1] * B[1]) / 255, (c[2] * B[2]) / 255];
          if (covA) c = [(c[0] * A[0]) / 255, (c[1] * A[1]) / 255, (c[2] * A[2]) / 255];
          d[i] = c[0];
          d[i + 1] = c[1];
          d[i + 2] = c[2];
          if (layer) d[i + 3] = covA || covB ? 255 : 0;
        }
      break;
    }
    case 'SKC-PRC-PRT-003': {
      // photocopy: grey, hard contrast, toner specks and a streak
      const streak = r() * w;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          if (d[i + 3]! < (layer ? 40 : 250)) continue;
          let l = (d[i]! * 0.3 + d[i + 1]! * 0.59 + d[i + 2]! * 0.11) / 255;
          l = l < 0.55 ? l * 0.35 : Math.min(1, 0.55 + (l - 0.55) * 1.6);
          if (r() < 0.004) l = 0.1;
          if (Math.abs(x - streak) < 2) l *= 0.85;
          const v = l * 255;
          d[i] = v * 0.98;
          d[i + 1] = v * 0.97;
          d[i + 2] = v * 0.94;
        }
      break;
    }
    case 'SKC-PRC-PRT-004': {
      // marker: alcohol ink pools at stroke edges (a darker rim where alpha falls off)
      if (layer)
        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3]!;
          if (a > 30 && a < 230) {
            d[i] = d[i]! * 0.82;
            d[i + 1] = d[i + 1]! * 0.82;
            d[i + 2] = d[i + 2]! * 0.82;
            d[i + 3] = Math.min(255, a * 1.4);
          }
        }
      break;
    }
    case 'SKC-PRC-PRT-005':
      // ballpoint: fine pressure variation, lines a little thinner in places
      if (layer) for (let i = 0; i < d.length; i += 4) if (d[i + 3]! > 0 && r() < 0.18) d[i + 3] = d[i + 3]! * 0.55;
      break;
    case 'SKC-PRC-PRT-006':
      // charcoal and white pen: broken coverage on the light marks
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3]! === 0) continue;
        const l = (d[i]! + d[i + 1]! + d[i + 2]!) / 765;
        if (l > 0.5 && r() < 0.22) {
          if (layer) d[i + 3] = d[i + 3]! * 0.35;
          else d[i] = d[i + 1] = d[i + 2] = 40;
        }
      }
      break;
    case 'SKC-PRC-PRT-007':
      break;
  }
  cx.putImageData(img, 0, 0);
}

/** the ink colours a process forces (ballpoint is blue, photocopy is black, charcoal is chalk) */
export function processInk(process: ProcessId, set: ColourSet): ColourSet {
  switch (process) {
    case 'SKC-PRC-PRT-005':
      return { ...set, ink: readable(set.paper, ['#1e2f7a'], 7) };
    case 'SKC-PRC-PRT-003':
      return { ...set, ink: '#111111', accent: '#333333', pill: '#bdbdbd' };
    default:
      return set;
  }
}
