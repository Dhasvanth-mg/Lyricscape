// Shared pieces of the reference scenes: which line is on, easing, a camera, hand-drawn helpers and text textures.

import type { Scene, VisualTimeline, WordCue } from '../../types';
import { mul, rotate, scale, translate, type Affine } from '../gpu';
import type { SceneHost, TexEntry } from './types';

export type Line = {
  /** index among the timeline's scenes */
  i: number;
  scene: Scene;
  text: string;
  words: WordCue[];
  startMs: number;
  /** when the line stops being on screen (the next line, or a little after it ends) */
  untilMs: number;
  /** ms since it began, and 0..1 through its time on screen */
  age: number;
  p: number;
  /** ms on screen in total */
  dur: number;
};

/** The line that is on screen at `tMs`, with a short lead so a word lands with the syllable. */
export function lineAt(tl: VisualTimeline, tMs: number): Line | null {
  const sc = tl.scenes;
  if (!sc.length) return null;
  let lo = 0;
  let hi = sc.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sc[mid]!.startMs - 30 <= tMs) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (found < 0) return null;
  const s = sc[found]!;
  const next = sc[found + 1];
  const until = Math.min(next ? next.startMs - 30 : Infinity, s.endMs + 900);
  if (tMs > until) return null;
  const start = s.startMs - 30;
  const dur = Math.max(500, until - start);
  const age = Math.max(0, tMs - start);
  return { i: found, scene: s, text: s.words.map((w) => w.text).join(' '), words: s.words, startMs: start, untilMs: until, age, dur, p: Math.min(1, age / dur) };
}

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a || 1));
  return t * t * (3 - 2 * t);
};
export const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t)));
export const easeInOut = (t: number) => {
  t = clamp(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

/** a stable hash in 0..1 for a small integer */
export function hash01(n: number): number {
  let h = Math.imul(Math.floor(n) ^ 0x9e3779b1, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** value noise in time (smooth): used for handheld shake */
export function noise1(t: number, seed = 0): number {
  const i = Math.floor(t);
  const f = t - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash01(i * 7 + seed * 131), hash01((i + 1) * 7 + seed * 131), u) * 2 - 1;
}

/**
 * The camera: what point of a sheet is at the middle of the screen, how big, how turned.
 * sheet coords -> screen px: translate(W/2 + tx, H/2 + ty) · rotate · scale · translate(-fx, -fy)
 */
export function camera(W: number, H: number, c: { fx: number; fy: number; zoom: number; rot?: number; tx?: number; ty?: number; skew?: number }): Affine {
  let m = translate(W / 2 + (c.tx ?? 0), H / 2 + (c.ty ?? 0));
  if (c.rot) m = mul(m, rotate((c.rot * Math.PI) / 180));
  if (c.skew) m = mul(m, [1, 0, c.skew, 1, 0, 0]);
  m = mul(m, scale(c.zoom, c.zoom));
  return mul(m, translate(-c.fx, -c.fy));
}

/** a text texture: painted large once, then drawn at any size. `k` converts texture px to the size the caller asked for. */
export type TextTex = TexEntry & { textW: number; pad: number; k: number; /** height of one em in sheet units */ em: number; /** the css font it was painted with */ f: string };
export function textTex(h: SceneHost, text: string, font: (px: number) => string, sizePx: number, color: string, opts: { hi?: number; stroke?: { color: string; width: number }; shadow?: { color: string; blur: number }; spacing?: number } = {}): TextTex {
  const hi = opts.hi ?? 3; // supersample, so a zoom of up to ~3x stays sharp
  const P = Math.max(8, Math.round(sizePx * hi));
  const f = font(P);
  const textW = h.measure(f, text);
  const pad = Math.ceil(P * 0.35 + (opts.stroke?.width ?? 0) * hi);
  const w = Math.ceil(textW + pad * 2);
  const hh = Math.ceil(P * 1.6 + pad * 2);
  const key = `t|${f}|${color}|${opts.stroke?.color ?? ''}${opts.stroke?.width ?? 0}|${opts.shadow?.blur ?? 0}|${text}`;
  const t = h.tex(key, Math.min(4096, w), Math.min(4096, hh), (c) => {
    c.font = f;
    c.textBaseline = 'middle';
    c.textAlign = 'left';
    c.lineJoin = 'round';
    if (opts.shadow) {
      c.shadowColor = opts.shadow.color;
      c.shadowBlur = opts.shadow.blur * hi;
    }
    if (opts.stroke) {
      c.lineWidth = opts.stroke.width * hi;
      c.strokeStyle = opts.stroke.color;
      c.strokeText(text, pad, hh / 2);
    }
    c.fillStyle = color;
    c.fillText(text, pad, hh / 2);
  });
  return { ...t, textW, pad, k: 1 / hi, em: sizePx, f };
}

/** draw a TextTex with its text's left edge at (x, y-centre) in sheet space, under matrix `m`; `clipPx` = typed width in sheet px */
export function drawText(h: SceneHost, t: TextTex, m: Affine, x: number, y: number, o: { alpha?: number; lod?: number; clipPx?: number; color?: [number, number, number, number]; rot?: number; s?: number } = {}) {
  const w = t.tex.w * t.k;
  const hh = t.tex.h * t.k;
  let mm = mul(m, translate(x - t.pad * t.k + w / 2, y));
  if (o.rot) mm = mul(mm, rotate((o.rot * Math.PI) / 180));
  if (o.s && o.s !== 1) mm = mul(mm, scale(o.s, o.s));
  h.sprite({
    tex: t.tex,
    m: mm,
    w,
    h: hh,
    alpha: o.alpha ?? 1,
    lod: o.lod ?? 0,
    mode: 0,
    camera: false,
    color: o.color,
    clip: o.clipPx !== undefined ? { x: clamp((o.clipPx + t.pad * t.k) / w), span: [0, 1] } : undefined,
  });
}

/** width in sheet units of the first n characters of a text texture (n may be fractional: the partial letter is not drawn) */
export function prefixPx(h: SceneHost, t: TextTex, text: string, n: number): number {
  const m = Math.floor(n);
  return h.measure(t.f, text.slice(0, m)) * t.k;
}

/** the same, centred on (cx, cy) */
export function drawTextC(h: SceneHost, t: TextTex, m: Affine, cx: number, cy: number, o: Parameters<typeof drawText>[5] = {}) {
  drawText(h, t, m, cx - (t.textW * t.k) / 2, cy, o);
}

/** a wrap of `text` into lines no wider than `maxW` (px at the font given) */
export function wrapText(h: SceneHost, text: string, font: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && h.measure(font, next) > maxW) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** the number of characters of `text` typed `age` ms in, at a speed that finishes by `doneAt` ms (never slower than `minMsPerChar`/faster than `maxMsPerChar`) */
export function typedChars(text: string, age: number, startAt: number, doneAt: number, minMs = 26, maxMs = 90): number {
  const n = text.length;
  if (n === 0) return 0;
  const per = clamp((doneAt - startAt) / n, minMs, maxMs);
  return clamp((age - startAt) / per, 0, n);
}

export const cursorOn = (tMs: number, period = 520) => Math.floor(tMs / period) % 2 === 0;
