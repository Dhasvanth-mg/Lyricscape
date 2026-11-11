// Small canvas helpers shared by the Screenlife kits, devices, rooms and props.

import { graphemes } from './typing';

export type Ctx = CanvasRenderingContext2D;
export type Measure = (font: string, text: string) => number;

export function rr(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + k, y);
  c.arcTo(x + w, y, x + w, y + h, k);
  c.arcTo(x + w, y + h, x, y + h, k);
  c.arcTo(x, y + h, x, y, k);
  c.arcTo(x, y, x + w, y, k);
  c.closePath();
}

export function fillRR(c: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string) {
  rr(c, x, y, w, h, r);
  c.fillStyle = fill;
  c.fill();
}

/** a wrap at spaces into rows no wider than maxW; a word wider than a row is broken between grapheme clusters (never inside one) */
export function wrap(measure: Measure, font: string, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const rows: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (measure(font, next) <= maxW || !cur) {
      if (!cur && measure(font, w) > maxW) {
        // break a long word by grapheme
        let part = '';
        for (const g of graphemes(w)) {
          if (part && measure(font, part + g) > maxW) {
            rows.push(part);
            part = g;
          } else part += g;
        }
        cur = part;
        continue;
      }
      cur = next;
    } else {
      rows.push(cur);
      cur = '';
      if (measure(font, w) > maxW) {
        let part = '';
        for (const g of graphemes(w)) {
          if (part && measure(font, part + g) > maxW) {
            rows.push(part);
            part = g;
          } else part += g;
        }
        cur = part;
      } else cur = w;
    }
  }
  if (cur || !rows.length) rows.push(cur);
  return rows;
}

export const canvasMeasure = (c: Ctx): Measure => (f, t) => {
  c.font = f;
  return c.measureText(t).width;
};

/** text drawn with its reading-start edge at x (right edge for right-to-left), middle baseline at y */
export function textAt(c: Ctx, s: string, x: number, y: number, font: string, color: string, rtl = false, align: 'start' | 'center' | 'end' = 'start') {
  c.font = font;
  c.fillStyle = color;
  c.textBaseline = 'middle';
  c.direction = rtl ? 'rtl' : 'ltr';
  c.textAlign = align === 'center' ? 'center' : align === 'end' ? (rtl ? 'left' : 'right') : rtl ? 'right' : 'left';
  c.fillText(s, x, y);
  c.direction = 'ltr';
}

/** a soft round light (bokeh disc or lamp glow) */
export function glow(c: Ctx, x: number, y: number, r: number, color: string, a: number) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, withA(color, a));
  g.addColorStop(1, withA(color, 0));
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
}

export function withA(color: string, a: number): string {
  if (color.startsWith('#') && color.length === 7) {
    const n = parseInt(color.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  return color;
}

/** a seeded 0..1 sequence */
export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** m:ss of a time in ms (song time is the clock in every kit) */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
