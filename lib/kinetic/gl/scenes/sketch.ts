// "Sketch cards": every line becomes a hand-lettered poster card, as in the pixel-scribble reference clip. A 4:3 card with a
// hatched window frame sits on black; the words are laid out like a poster (a few huge, a few on coloured blobs, the rest thin
// hand lettering), a little drawing fills the corner, and everything is snapped to a handful of colours with noisy edges, so it
// looks drawn in a paint program. Cards cut hard from one to the next; the words scribble in as they are sung.
// The card is painted once per line (CPU canvas, 360x270) and shown with nearest-neighbour filtering: the GPU only draws quads.

import { mul, translate } from '../gpu';
import { clamp, hashStr, lerp, lineAt } from './common';
import type { SceneFx, SceneHost, TexEntry } from './types';

const CW = 360;
const CH = 270;

type Theme = {
  paper: string;
  ink: string;
  accents: [string, string, string];
  frame: string;
  border: 'hatch' | 'dots' | 'scribble' | 'stripe';
  doodle: 'none' | 'face' | 'eyes' | 'chibi' | 'flower' | 'cat' | 'stars';
  /** big, mid, thin faces */
  fonts: [string, string, string];
};

const THEMES: Theme[] = [
  { paper: '#d6d3a4', ink: '#3b1d3c', accents: ['#4aa6d6', '#4b4fb0', '#9fd6e6'], frame: '#6b3a48', border: 'hatch', doodle: 'stars', fonts: ['Anton', 'Permanent Marker', 'Special Elite'] },
  { paper: '#efe9df', ink: '#2c2238', accents: ['#e57458', '#4f5a86', '#c9ccd8'], frame: '#7a6f86', border: 'scribble', doodle: 'face', fonts: ['Anton', 'Special Elite', 'Cormorant Garamond'] },
  { paper: '#e6e7ee', ink: '#1a1a22', accents: ['#d9242c', '#3aa0cf', '#f1c8c8'], frame: '#8a8a94', border: 'hatch', doodle: 'chibi', fonts: ['Anton', 'Permanent Marker', 'Instrument Serif'] },
  { paper: '#f4f0f6', ink: '#16224f', accents: ['#2f7fe0', '#14307a', '#f1d34a'], frame: '#3b4486', border: 'hatch', doodle: 'none', fonts: ['Permanent Marker', 'Anton', 'Cormorant Garamond'] },
  { paper: '#c7dcc6', ink: '#1f2a4a', accents: ['#e0325a', '#7fb3b0', '#2a3b66'], frame: '#59696a', border: 'hatch', doodle: 'none', fonts: ['Anton', 'Permanent Marker', 'Special Elite'] },
  { paper: '#f9e3de', ink: '#2a2030', accents: ['#a14f7b', '#f3b3c8', '#6d3b5f'], frame: '#5a4358', border: 'scribble', doodle: 'eyes', fonts: ['Bebas Neue', 'Permanent Marker', 'Special Elite'] },
  { paper: '#d9d6b0', ink: '#4a1f33', accents: ['#3d6fc4', '#5a3f8f', '#7fc4d6'], frame: '#5a3f8f', border: 'stripe', doodle: 'flower', fonts: ['Anton', 'Special Elite', 'Permanent Marker'] },
  { paper: '#e8e9ef', ink: '#17171c', accents: ['#e3262c', '#f4b92a', '#2c8fc4'], frame: '#2c8fc4', border: 'dots', doodle: 'stars', fonts: ['Anton', 'Permanent Marker', 'Cormorant Garamond'] },
];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};
const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mixHex = (a: string, b: string, t: number) => {
  const x = rgb(a);
  const y = rgb(b);
  const m = x.map((v, i) => Math.round(v + (y[i]! - v) * t));
  return `#${m.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
};

/** Snap every pixel to the palette after adding noise (that is what makes the edges stipple), and make alpha 0/1 with a noisy threshold. */
function snap(cx: CanvasRenderingContext2D, w: number, h: number, pal: [number, number, number][], noise: number, seed: number, keepAlpha: boolean) {
  const img = cx.getImageData(0, 0, w, h);
  const d = img.data;
  const r = rng(seed);
  for (let i = 0; i < d.length; i += 4) {
    if (keepAlpha) {
      const a = d[i + 3]! + (r() - 0.5) * 150;
      if (a < 120) {
        d[i + 3] = 0;
        continue;
      }
      d[i + 3] = 255;
    } else d[i + 3] = 255;
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
  cx.putImageData(img, 0, 0);
}

function blurred(src: HTMLCanvasElement, px: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const x = c.getContext('2d')!;
  x.filter = `blur(${px}px)`;
  x.drawImage(src, 0, 0);
  return c;
}

function paletteOf(t: Theme): [number, number, number][] {
  const list = [t.paper, t.ink, ...t.accents, t.frame, mixHex(t.paper, t.ink, 0.5), mixHex(t.paper, t.frame, 0.5)];
  return list.map(rgb);
}

// ---- doodles --------------------------------------------------------------------------------------------------------------------------
function wobble(c: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, r: () => number, amp = 0.06) {
  c.beginPath();
  const n = 28;
  const ph = r() * 6;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + amp * Math.sin(a * 3 + ph) + amp * 0.6 * Math.sin(a * 5 + ph * 2);
    const x = cx + Math.cos(a) * rx * k;
    const y = cy + Math.sin(a) * ry * k;
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  }
  c.closePath();
}
function star(c: CanvasRenderingContext2D, x: number, y: number, R: number, rot: number, fill: boolean) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? R * 0.42 : R;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  fill ? c.fill() : c.stroke();
}

function doodle(c: CanvasRenderingContext2D, t: Theme, kind: Theme['doodle'], R: { x: number; y: number; w: number; h: number }, r: () => number) {
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.strokeStyle = t.ink;
  c.fillStyle = t.ink;
  const cx = R.x + R.w / 2;
  const cy = R.y + R.h / 2;
  const S = Math.min(R.w, R.h);
  if (kind === 'face') {
    // a girl with two braids and bows
    wobble(c, cx, cy - S * 0.08, S * 0.36, S * 0.4, r, 0.04);
    c.fill(); // hair
    c.fillStyle = t.paper;
    wobble(c, cx, cy + S * 0.02, S * 0.27, S * 0.32, r, 0.03);
    c.fill();
    c.fillStyle = t.ink;
    c.fillRect(cx - S * 0.3, cy - S * 0.36, S * 0.6, S * 0.2); // fringe
    c.lineWidth = 2;
    for (const sx of [-1, 1]) {
      c.fillStyle = t.ink;
      for (let i = 0; i < 4; i++) {
        wobble(c, cx + sx * S * 0.36, cy + S * (0.1 + i * 0.14), S * 0.08, S * 0.075, r, 0.1);
        c.fill();
      }
      c.fillStyle = t.accents[0];
      c.fillRect(cx + sx * S * 0.36 - 5, cy + S * 0.66, 10, 5);
    }
    c.fillStyle = t.ink;
    for (const sx of [-1, 1]) {
      c.beginPath();
      c.ellipse(cx + sx * S * 0.11, cy + S * 0.0, 3, 4, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(cx - 5, cy + S * 0.17);
    c.quadraticCurveTo(cx, cy + S * 0.2, cx + 5, cy + S * 0.17);
    c.stroke();
  } else if (kind === 'eyes') {
    // two open eyes with lids, lashes and little flowers
    for (const [ex, ey, flip] of [[cx - S * 0.3, cy - S * 0.05, 1], [cx + S * 0.3, cy - S * 0.1, -1]] as const) {
      c.lineWidth = 2;
      c.fillStyle = t.paper;
      c.beginPath();
      c.moveTo(ex - S * 0.26, ey + 4);
      c.quadraticCurveTo(ex, ey - S * 0.28 * flip * flip, ex + S * 0.26, ey + 2);
      c.quadraticCurveTo(ex, ey + S * 0.16, ex - S * 0.26, ey + 4);
      c.fill();
      c.stroke();
      c.fillStyle = t.ink;
      c.beginPath();
      c.arc(ex + flip * 3, ey, S * 0.1, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = t.paper;
      c.fillRect(ex + flip * 3 - 3, ey - 4, 3, 3);
      c.lineWidth = 1.4;
      for (let i = -4; i <= 4; i++) {
        c.beginPath();
        c.moveTo(ex + i * S * 0.055, ey - S * 0.1 + Math.abs(i) * 1.6);
        c.lineTo(ex + i * S * 0.065, ey - S * 0.2 + Math.abs(i) * 2.4);
        c.stroke();
      }
    }
    c.fillStyle = t.accents[1];
    for (let i = 0; i < 6; i++) {
      wobble(c, R.x + r() * R.w, R.y + R.h * (0.55 + r() * 0.4), 4.5, 4, r, 0.2);
      c.fill();
    }
    c.fillStyle = t.ink;
    star(c, R.x + R.w * 0.46, R.y + 6, 4, 0.2, true);
  } else if (kind === 'chibi') {
    c.lineWidth = 2;
    c.fillStyle = t.paper;
    wobble(c, cx, cy - S * 0.12, S * 0.34, S * 0.3, r, 0.04);
    c.fill();
    c.stroke();
    c.fillStyle = t.ink;
    for (const sx of [-1, 1]) {
      c.beginPath();
      c.ellipse(cx + sx * S * 0.13, cy - S * 0.1, 6, 7, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = t.accents[2];
    for (const sx of [-1, 1]) {
      c.beginPath();
      c.ellipse(cx + sx * S * 0.23, cy - S * 0.02, 6, 4, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = t.accents[0];
    star(c, cx + S * 0.26, cy - S * 0.36, 5, 0.3, true);
    c.fillStyle = t.paper;
    wobble(c, cx, cy + S * 0.28, S * 0.2, S * 0.2, r, 0.05);
    c.fill();
    c.stroke();
    c.lineWidth = 2.4;
    c.beginPath();
    c.moveTo(cx + S * 0.34, cy - S * 0.5);
    c.lineTo(cx + S * 0.36, cy - S * 0.22);
    c.stroke();
    c.beginPath();
    c.arc(cx + S * 0.36, cy - S * 0.14, 2.6, 0, Math.PI * 2);
    c.fill();
  } else if (kind === 'flower') {
    c.fillStyle = t.accents[0];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      wobble(c, cx + Math.cos(a) * S * 0.2, cy + Math.sin(a) * S * 0.2, S * 0.17, S * 0.13, r, 0.1);
      c.fill();
      c.lineWidth = 1.8;
      c.stroke();
    }
    c.fillStyle = t.ink;
    wobble(c, cx, cy, S * 0.1, S * 0.1, r, 0.2);
    c.fill();
    c.fillStyle = t.accents[2];
    for (let i = 0; i < 4; i++) c.fillRect(cx + (r() - 0.5) * S * 0.9, cy + (r() - 0.5) * S * 0.9, 3, 3);
  } else if (kind === 'cat') {
    c.lineWidth = 2;
    c.fillStyle = t.paper;
    wobble(c, cx, cy, S * 0.32, S * 0.28, r, 0.03);
    c.fill();
    c.stroke();
    for (const sx of [-1, 1]) {
      c.beginPath();
      c.moveTo(cx + sx * S * 0.28, cy - S * 0.12);
      c.lineTo(cx + sx * S * 0.2, cy - S * 0.4);
      c.lineTo(cx + sx * S * 0.06, cy - S * 0.24);
      c.stroke();
    }
    c.fillStyle = t.ink;
    for (const sx of [-1, 1]) c.fillRect(cx + sx * S * 0.12 - 2, cy - S * 0.06, 4, 6);
    c.beginPath();
    c.moveTo(cx - S * 0.12, cy + S * 0.1);
    c.quadraticCurveTo(cx, cy + S * 0.2, cx + S * 0.12, cy + S * 0.1);
    c.stroke();
  } else if (kind === 'stars') {
    c.fillStyle = t.ink;
    star(c, cx + S * 0.22, cy + S * 0.28, S * 0.2, 0.2, true);
    c.lineWidth = 2;
    c.strokeStyle = t.ink;
    star(c, cx - S * 0.12, cy - S * 0.12, S * 0.4, -0.3, false);
    c.fillStyle = t.accents[1];
    star(c, cx + S * 0.34, cy - S * 0.3, S * 0.1, 0.4, true);
  }
}

function border(c: CanvasRenderingContext2D, t: Theme, r: () => number) {
  // the window bezel: a hatched band
  c.fillStyle = mixHex(t.paper, t.frame, 0.45);
  c.fillRect(0, 0, CW, CH);
  c.strokeStyle = t.frame;
  c.lineWidth = 1;
  for (let i = -CH; i < CW; i += 3) {
    c.beginPath();
    c.moveTo(i, CH);
    c.lineTo(i + CH, 0);
    c.stroke();
  }
  c.fillStyle = t.paper;
  c.fillRect(8, 8, CW - 16, CH - 16);
  if (t.border === 'stripe') {
    c.fillStyle = t.frame;
    c.fillRect(8, 8, 9, CH - 16);
    c.fillRect(CW - 17, 8, 9, CH - 16);
    c.fillStyle = t.accents[0];
    c.fillRect(8, 8, CW - 16, 7);
    c.fillStyle = t.accents[2];
    c.beginPath();
    c.moveTo(8, CH - 8);
    for (let x = 8; x <= CW - 8; x += 6) c.lineTo(x, CH - 8 - 6 - Math.sin(x * 0.4) * 2.5);
    c.lineTo(CW - 8, CH - 8);
    c.fill();
  } else if (t.border === 'dots') {
    c.fillStyle = t.accents[2];
    c.fillRect(8, 8, 7, CH - 16);
    c.fillRect(CW - 15, 8, 7, CH - 16);
    c.fillStyle = t.accents[1];
    for (let x = 14; x < CW - 12; x += 13) {
      c.beginPath();
      c.arc(x, CH - 14, 5, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.arc(x + 6, 14, 4, 0, Math.PI * 2);
      c.fill();
    }
  } else {
    c.strokeStyle = t.border === 'scribble' ? t.ink : t.frame;
    c.lineWidth = t.border === 'scribble' ? 2.6 : 3;
    c.beginPath();
    for (let x = 12; x <= CW - 12; x += 4) c.lineTo(x, 12 + (t.border === 'scribble' ? (r() - 0.5) * 3 : 0));
    for (let y = 12; y <= CH - 12; y += 4) c.lineTo(CW - 12 + (t.border === 'scribble' ? (r() - 0.5) * 3 : 0), y);
    for (let x = CW - 12; x >= 12; x -= 4) c.lineTo(x, CH - 12 + (t.border === 'scribble' ? (r() - 0.5) * 3 : 0));
    for (let y = CH - 12; y >= 12; y -= 4) c.lineTo(12 + (t.border === 'scribble' ? (r() - 0.5) * 3 : 0), y);
    c.closePath();
    c.stroke();
  }
  // paper grain
  c.fillStyle = mixHex(t.paper, t.ink, 0.12);
  for (let i = 0; i < 260; i++) c.fillRect(14 + r() * (CW - 28), 14 + r() * (CH - 28), 1 + (r() > 0.8 ? 1 : 0), 1);
}

// ---- layout ---------------------------------------------------------------------------------------------------------------------------
type Role = 'big' | 'pill' | 'mid' | 'thin';
type Placed = { text: string; role: Role; x: number; y: number; w: number; h: number; size: number; font: string; rot: number; color: string; pill: string | null; idx: number };

const STOP = new Set(['a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'is', 'it', 'and', 'or', 'i', 'my', 'me', 'you', 'we', 'be', 'so', 'do', 'if']);

function face(name: string, role: Role, px: number) {
  const weight = name === 'Cormorant Garamond' ? 500 : name === 'Nunito' ? 900 : 400;
  const style = name === 'Instrument Serif' && role === 'thin' ? 'italic ' : '';
  return `${style}${weight} ${px}px "${name}", sans-serif`;
}

function layout(h: SceneHost, text: string, words: string[], th: Theme, zone: { x: number; y: number; w: number; h: number }, r: () => number): Placed[] {
  const n = words.length;
  const score = words.map((w, i) => (STOP.has(w.toLowerCase().replace(/\W/g, '')) ? 0 : w.length) + (i === n - 1 ? 1.5 : 0) + r() * 0.8);
  const order = [...words.keys()].sort((a, b) => score[b]! - score[a]!);
  const roles: Role[] = words.map((_, i) => (i % 2 ? 'thin' : 'mid'));
  if (n >= 2) roles[order[0]!] = 'big';
  if (n >= 4) roles[order[1]!] = 'pill';
  if (n >= 6) roles[order[2]!] = 'big';
  if (n >= 7) roles[order[3]!] = 'pill';
  const fam = (role: Role) => (role === 'big' ? th.fonts[0] : role === 'thin' ? th.fonts[2] : th.fonts[1]);
  const mul = (role: Role) => (role === 'big' ? 1.75 : role === 'pill' ? 1.15 : role === 'thin' ? 0.95 : 1.0);
  const rowK = (role: Role) => (role === 'big' ? 1.04 : 1.2);
  const meas = (w: string, role: Role, size: number) => {
    const t = role === 'big' ? w.toUpperCase() : w;
    return h.measure(face(fam(role), role, 100), t) * ((size * mul(role)) / 100);
  };
  const flow = (size: number) => {
    const gap = size * 0.32;
    const rows: { items: number[]; w: number; h: number }[] = [];
    let cur = { items: [] as number[], w: 0, h: 0 };
    words.forEach((w, i) => {
      const role = roles[i]!;
      const ww = meas(w, role, size) + (role === 'pill' ? size * 0.5 : 0);
      const hh = size * mul(role) * rowK(role);
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
  let size = 78;
  while (size > 11) {
    const f = flow(size);
    if (f.total <= zone.h * 0.9 && f.maxW <= zone.w) break;
    size -= 1;
  }
  const f = flow(size);
  const free = Math.max(0, zone.h - f.total);
  const gapY = free / (f.rows.length + 1);
  const out: Placed[] = [];
  let y = zone.y + gapY;
  f.rows.forEach((row, ri) => {
    const slack = Math.max(0, zone.w - row.w);
    let x = zone.x + slack * (ri % 2 ? 0.55 + r() * 0.3 : r() * 0.25);
    row.items.forEach((i) => {
      const role = roles[i]!;
      const sz = size * mul(role);
      const ww = meas(words[i]!, role, size) + (role === 'pill' ? size * 0.5 : 0);
      const pillC = th.accents[(i + 1) % 3] ?? th.accents[0];
      const color = role === 'big' ? th.accents[i % 2 ? 1 : 0] : role === 'pill' ? (lum(pillC) > 0.45 ? th.ink : th.paper) : th.ink;
      out.push({ text: words[i]!, role, x, y: y + (row.h - sz * rowK(role)) / 2 + (r() - 0.5) * 4, w: ww, h: sz * rowK(role), size: sz, font: fam(role), rot: (r() - 0.5) * 0.1, color, pill: role === 'pill' ? (th.accents[(i + 1) % 3] ?? null) : null, idx: i });
      x += ww + f.gap;
    });
    y += row.h + gapY;
  });
  void text;
  return out;
}

// ---- painting -------------------------------------------------------------------------------------------------------------------------
function paintBase(th: Theme, kind: Theme['doodle'], seed: number, doodleRect: { x: number; y: number; w: number; h: number } | null): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = CW;
  c.height = CH;
  const x = c.getContext('2d')!;
  const r = rng(seed);
  border(x, th, r);
  if (kind !== 'none' && doodleRect) doodle(x, th, kind, doodleRect, r);
  const b = blurred(c, 0.9);
  const x2 = b.getContext('2d')!;
  snap(x2, CW, CH, paletteOf(th), 46, seed ^ 0x51ed, false);
  return b;
}

function wordDims(p: Placed) {
  const pad = 10;
  return { W: Math.ceil(p.w + pad * 2 + p.size * 0.3), H: Math.ceil(p.h + pad * 2 + p.size * 0.2) };
}

function paintWord(p: Placed, th: Theme, seed: number): { canvas: HTMLCanvasElement; ox: number; oy: number } {
  const { W, H } = wordDims(p);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d')!;
  const r = rng(seed);
  x.translate(W / 2, H / 2);
  x.rotate(p.rot);
  x.textBaseline = 'middle';
  x.lineJoin = 'round';
  const label = p.role === 'big' ? p.text.toUpperCase() : p.text;
  if (p.pill) {
    x.fillStyle = p.pill;
    wobble(x, 0, 0, p.w * 0.54, p.h * 0.5, r, 0.05);
    x.fill();
  }
  x.font = face(p.font, p.role, p.size);
  let cx0 = -(p.w - (p.pill ? p.size * 0.5 : 0)) / 2;
  if (p.pill) cx0 += 0;
  // letter by letter, each a little off: hand lettering
  for (const ch of label) {
    const wch = x.measureText(ch).width;
    x.save();
    x.translate(cx0 + wch / 2, (r() - 0.5) * p.size * 0.1);
    x.rotate((r() - 0.5) * 0.12);
    x.scale(1, 0.93 + r() * 0.16);
    if (p.role === 'big') {
      x.lineWidth = Math.max(2.4, p.size * 0.1);
      x.strokeStyle = th.ink;
      x.strokeText(ch, -wch / 2, 0);
    }
    x.fillStyle = p.color;
    x.fillText(ch, -wch / 2, 0);
    x.restore();
    cx0 += wch;
  }
  const b = blurred(c, 0.8);
  snap(b.getContext('2d')!, W, H, paletteOf(th), 40, seed ^ 0x9e37, true);
  return { canvas: b, ox: p.x + p.w / 2 - W / 2, oy: p.y + p.h / 2 - H / 2 };
}

const layoutCache = new Map<string, Placed[]>();

type Card = { base: TexEntry; words: { tex: TexEntry; x: number; y: number; w: number; h: number; idx: number }[] };

function buildCard(h: SceneHost, key: string, text: string, words: string[], themeIdx: number): Card {
  const th = THEMES[themeIdx % THEMES.length]!;
  const seed = hashStr(key);
  const r = rng(seed);
  const hasDoodle = th.doodle !== 'none' && words.length <= 7;
  const doodleRect = hasDoodle ? { x: CW * 0.68, y: CH * 0.45, w: CW * 0.28, h: CH * 0.46 } : null;
  const zone = hasDoodle ? { x: 16, y: 16, w: CW * 0.66 - 16, h: CH - 32 } : { x: 16, y: 16, w: CW - 32, h: CH - 32 };
  const baseKey = `card|${key}|${themeIdx}|base`;
  const base = h.tex(baseKey, CW, CH, (cx) => cx.drawImage(paintBase(th, th.doodle, seed, doodleRect), 0, 0), { nearest: true });
  const lk = `${key}|${themeIdx}`;
  let placed = layoutCache.get(lk);
  if (!placed) {
    placed = layout(h, text, words, th, zone, r);
    layoutCache.set(lk, placed);
    if (layoutCache.size > 12) layoutCache.delete(layoutCache.keys().next().value as string);
  }
  const out: Card['words'] = placed.map((p) => {
    const { W: ww, H: hh } = wordDims(p);
    const tex = h.tex(`card|${key}|${themeIdx}|w${p.idx}`, ww, hh, (cx) => cx.drawImage(paintWord(p, th, seed + p.idx * 131).canvas, 0, 0), { nearest: true });
    return { tex, x: p.x + p.w / 2 - ww / 2, y: p.y + p.h / 2 - hh / 2, w: ww, h: hh, idx: p.idx };
  });
  return { base, words: out };
}

export function drawSketchScene(h: SceneHost): SceneFx {
  const { W, H, frame, tl } = h;
  h.clear('#000000');
  const line = lineAt(tl, frame.tMs);
  const s = Math.min((W * 0.97) / CW, (H * 0.92) / CH);
  const cardW = CW * s;
  const cardH = CH * s;
  const ox = (W - cardW) / 2;
  const oy = (H - cardH) / 2;
  const toScreen = (x: number, y: number, w: number, hh: number) => mul(translate(ox + (x + w / 2) * s, oy + (y + hh / 2) * s), [1, 0, 0, 1, 0, 0]);
  if (!line) {
    const card = buildCard(h, 'idle', '', [], 7 % THEMES.length);
    h.sprite({ tex: card.base.tex, m: toScreen(0, 0, CW, CH), w: cardW, h: cardH, mode: 0, camera: false });
    return { grain: 0.04, vignette: 0.12 };
  }
  const words = line.words.map((w) => w.text);
  const themeIdx = line.i % THEMES.length;
  const card = buildCard(h, `${line.i}|${line.text}`, line.text, words, themeIdx);
  h.sprite({ tex: card.base.tex, m: toScreen(0, 0, CW, CH), w: cardW, h: cardH, mode: 0, camera: false });
  const a = line.age;
  card.words.forEach((wd) => {
    const cue = line.words[wd.idx];
    const start = cue && cue.timing !== 'none' ? Math.max(0, cue.startMs - line.startMs) : wd.idx * 120;
    const k = clamp((a - start) / 170);
    if (k <= 0) return;
    h.sprite({ tex: wd.tex.tex, m: toScreen(wd.x, wd.y, wd.w, wd.h), w: wd.w * s, h: wd.h * s, mode: 0, camera: false, clip: k < 1 ? { x: k, span: [0, 1] } : undefined });
  });
  void lerp;
  return { grain: 0.04, vignette: 0.1, bloom: 0, exposure: 1 };
}
