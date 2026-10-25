// "Screens": every lyric is typed into a different screen the camera flies through, as in the code-edit reference clip:
// a dark code editor (the lyric is a string literal that gets typed, the camera racks focus onto it), an IDE error list
// (the lyric is a row, the camera zooms in and pans along it), huge pale words over blurred code with glitch blocks, a light
// login form (the lyric is typed into the username field, the camera spins), red error banners, and a green console.
// Each shot is a camera path over a "sheet" painted once into a texture; blur is the texture's mip level.

import { mul, translate, type Affine } from '../gpu';
import { camera, clamp, cursorOn, drawText, easeInOut, easeOut, easeOutExpo, hash01, lerp, lineAt, noise1, prefixPx, smooth, textTex, typedChars, wrapText, type Line } from './common';
import type { SceneFx, SceneHost, TexEntry } from './types';

const MONO = (px: number) => `600 ${px}px "JetBrains Mono Variable", ui-monospace, monospace`;
const MONO_B = (px: number) => `700 ${px}px "JetBrains Mono Variable", ui-monospace, monospace`;
const UI = (px: number) => `500 ${px}px "Inter Variable", "Segoe UI", system-ui, sans-serif`;

export const SHOT_ORDER = ['code', 'code', 'errors', 'big', 'form', 'banner', 'console', 'big'] as const;
export type Shot = (typeof SHOT_ORDER)[number];

export function shotFor(line: Line): Shot {
  const s = SHOT_ORDER[line.i % SHOT_ORDER.length]!;
  if (s === 'big' && line.text.length > 30) return 'console';
  return s;
}

// ---- the sheets (painted once, 2x so a zoom stays sharp) --------------------------------------------------------------------------
type Sheet = { t: TexEntry; w: number; h: number };
function sheet(h: SceneHost, key: string, w: number, ht: number, paint: (c: CanvasRenderingContext2D) => void, res = 2): Sheet {
  const t = h.tex(`sheet|${key}`, Math.round(w * res), Math.round(ht * res), (c) => {
    c.scale(res, res);
    paint(c);
  });
  return { t, w, h: ht };
}
function put(h: SceneHost, M: Affine, s: Sheet, o: { alpha?: number; lod?: number } = {}) {
  h.sprite({ tex: s.t.tex, m: mul(M, translate(s.w / 2, s.h / 2)), w: s.w, h: s.h, alpha: o.alpha ?? 1, lod: o.lod ?? 0, mode: 0, camera: false });
}

const CODE_ROW = 56;
const CODE_FS = 34;
const LYRIC_ROW = 11; // the row the lyric is typed into
const CODE_LINES = [
  "function R(n, t) {",
  "  if (n === t) return v(n, new TypeError('A promise cannot be resolved with itself.'));",
  "  if (t && ('object' == typeof t || 'function' == typeof t)) {",
  "    var e = h(t);",
  "    if (e === d) return v(n, d.error);",
  "    if (e === n.then && t instanceof _) return n._V = 3, n._W = t, void y(n);",
  "    if ('function' == typeof e) return void X(e.bind(t), n);",
  "  }",
  "  n._V = 1, n._W = t, y(n);",
  "}",
  "function p(u, n) { return null === u.onFulfilled ? v(u.promise, n._W) : c(u.promise, n._W); }",
  "", // 11: the lyric row (prefix painted below)
  "  if ('function' == typeof f)) {",
  "",
  "  } else if (instanceof _) return n._V = 3, n._W = f, void y(n);",
  "  if ('function' == typeof c) return void X(c.bind(f), n);",
  "",
  "  Promise.prototype.then = function (a, b) {",
  "    if (this.constructor !== Promise) return safeThen(this, a, b);",
  "    var res = new Promise(noop);",
  "    handle(this, new Handler(a, b, res));",
  "    return res;",
  "  };",
  "  var r = 1 === n._V ? u.onFulfilled : u.onRejected, s = n._W;",
  "  try { y = r(s) } catch (_) { return void v(u.promise, _) }",
  "  return void p(u.promise, y);",
  "}",
  "function safeThen(t, a, b) { return new t.constructor(function (u, n) { var e = new Promise(noop); e.then(u, n); handle(t, new Handler(a, b, e)); }); }",
  "function handle(self, deferred) {",
  "  while (3 === self._V) self = self._W;",
  "  if (0 === self._V) return void (self._U = deferred);",
  "}",
];
const KEYWORDS = new Set(['typeof', 'instanceof', 'new', 'function', 'void', 'if', 'else', 'throw', 'var', 'try', 'catch', 'while', 'in']);
const KW2 = new Set(['return']);

function paintCodeLine(c: CanvasRenderingContext2D, line: string, x: number, y: number) {
  const re = /('[^']*'|\b\d+\b|[A-Za-z_$][\w$]*|\s+|[^\sA-Za-z_$\d'])/g;
  let cx = x;
  let m: RegExpExecArray | null;
  const toks: string[] = [];
  while ((m = re.exec(line))) toks.push(m[0]);
  toks.forEach((tk, i) => {
    let col = '#d7e3fb';
    if (tk.startsWith("'")) col = '#ffb27a';
    else if (/^\d+$/.test(tk)) col = '#ffb27a';
    else if (KW2.has(tk) || tk === 'void') col = '#c692f2';
    else if (KEYWORDS.has(tk)) col = '#52c7ff';
    else if (/^[A-Za-z_$]/.test(tk) && /^\(/.test((toks[i + 1] ?? '').trim() === '' ? (toks[i + 2] ?? '') : (toks[i + 1] ?? ''))) col = '#f4e3b8';
    else if (/^[=<>!&|:?+*]+$/.test(tk)) col = '#ffffff';
    c.fillStyle = col;
    c.fillText(tk, cx, y);
    cx += c.measureText(tk).width;
  });
}

function codeSheet(h: SceneHost): Sheet {
  const W = 2200;
  const H = 40 * CODE_ROW + 120;
  return sheet(h, 'code', W, H, (c) => {
    c.font = MONO(CODE_FS);
    c.textBaseline = 'middle';
    CODE_LINES.forEach((ln, i) => {
      if (i === LYRIC_ROW) {
        c.font = MONO(CODE_FS);
        c.fillStyle = '#d7e3fb';
        c.fillText('    throw ', 24, 60 + i * CODE_ROW);
        c.fillStyle = '#52c7ff';
        c.fillText('new ', 24 + c.measureText('    throw ').width, 60 + i * CODE_ROW);
        c.fillStyle = '#f4e3b8';
        c.fillText('TypeError', 24 + c.measureText('    throw new ').width, 60 + i * CODE_ROW);
        c.fillStyle = '#ffffff';
        c.fillText('(', 24 + c.measureText('    throw new TypeError').width, 60 + i * CODE_ROW);
        return;
      }
      paintCodeLine(c, ln, 24, 60 + i * CODE_ROW);
    });
    // more rows below so the camera never runs out of code
    for (let i = CODE_LINES.length; i < 40; i++) paintCodeLine(c, CODE_LINES[(i * 7) % CODE_LINES.length] || "  return n._V = 3, n._W = f, void X(c.bind(f), n);", 24, 60 + i * CODE_ROW);
  });
}
const CODE_PREFIX_W = 24 + 0.6 * CODE_FS * '    throw new TypeError('.length; // monospace advance

function errorSheet(h: SceneHost): Sheet {
  return sheet(h, 'errors', 1700, 1250, (c) => {
    c.textBaseline = 'middle';
    c.fillStyle = '#dfe6f4';
    c.font = UI(38);
    c.fillText('Entire Solution', 110, 120);
    c.beginPath();
    c.moveTo(470, 112);
    c.lineTo(490, 112);
    c.lineTo(480, 126);
    c.closePath();
    c.fill();
    // the "0 Errors" button
    c.strokeStyle = '#7a5ad8';
    c.lineWidth = 3;
    c.fillStyle = 'rgba(40,30,90,0.6)';
    c.beginPath();
    c.roundRect(560, 76, 260, 88, 6);
    c.fill();
    c.stroke();
    c.fillStyle = '#e5484d';
    c.beginPath();
    c.arc(612, 120, 24, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#fff';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(603, 111);
    c.lineTo(621, 129);
    c.moveTo(621, 111);
    c.lineTo(603, 129);
    c.stroke();
    c.fillStyle = '#eaf0ff';
    c.font = UI(40);
    c.fillText('0 Errors', 658, 122);
    c.fillStyle = 'rgba(232,217,160,0.9)';
    triangle(c, 900, 120, 26);
    c.fillStyle = '#c9d3ea';
    c.font = UI(38);
    c.fillText('Code', 300, 230);
    c.fillText('Description', 560, 230);
    const rows: [string, string][] = [
      ['TS6387', 'The signature (from: number, length?: number): string\' of \'substr\' is deprecated.'],
      ['TS6387', "The signature (string: string): string' of 'unescape' is deprecated."],
      ['TS6387', "The signature (string: string): string' of 'escape' is deprecated."],
      ['TS6385', "'(from: number, length?: number): string' is deprecated."],
      ['TS6385', "'product' is deprecated."],
      ['TS6385', "'product' is deprecated."],
      ['TS6385', "'product' is deprecated."],
      ['TS6387', "The signature (string: string): string' of 'unescape' is deprecated."],
      ['TS6387', ''],
      ['TS6387', "The signature (from: number, length?: number): string' of 'substr' is deprecated."],
      ['TS6387', "The signature (string: string): string' of 'unescape' is deprecated."],
      ['TS6385', "'(from: number, length?: number): string' is deprecated."],
      ['TS6385', "'(from: number, length?: number): string' is deprecated."],
      ['TS6387', "The signature (string: string): string' of 'escape' is deprecated."],
    ];
    rows.forEach(([code, desc], i) => {
      const y = 320 + i * 74;
      c.fillStyle = 'rgba(236,222,170,0.95)';
      triangle(c, 215, y, 25);
      c.fillStyle = '#f1f5ff';
      c.font = UI(38);
      c.fillText(code, 300, y);
      c.fillText('(JS)', 560, y);
      if (desc) c.fillText(desc, 560 + c.measureText('(JS) ').width, y);
    });
  });
}
export const ERR_ROW = 8;
export const ERR_Y = 320 + ERR_ROW * 74;
export const ERR_X = 560 + 120;

function triangle(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  c.beginPath();
  c.moveTo(x, y - s * 0.9);
  c.lineTo(x + s, y + s * 0.75);
  c.lineTo(x - s, y + s * 0.75);
  c.closePath();
  c.fill();
  c.fillStyle = 'rgba(40,34,20,0.9)';
  c.fillRect(x - 2.5, y - s * 0.35, 5, s * 0.6);
  c.fillRect(x - 2.5, y + s * 0.38, 5, 5);
}

function formSheet(h: SceneHost): Sheet {
  return sheet(h, 'form', 1500, 1150, (c) => {
    const g = c.createRadialGradient(750, 560, 100, 750, 560, 900);
    g.addColorStop(0, '#f1f1f3');
    g.addColorStop(1, '#cfcfd4');
    c.fillStyle = g;
    c.fillRect(0, 0, 1500, 1150);
    c.textBaseline = 'middle';
    // wordmark (our own: a green arc and a condensed name)
    c.strokeStyle = '#2f9e52';
    c.lineWidth = 12;
    c.beginPath();
    c.arc(560, 215, 70, Math.PI * 0.85, Math.PI * 1.9);
    c.stroke();
    c.fillStyle = '#3a3a40';
    c.font = '400 118px "Anton", sans-serif';
    c.fillText('PORTAL', 640, 190);
    c.fillStyle = '#7d7d85';
    c.font = UI(30);
    c.fillText('Student services and records', 450, 290);
    // card
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.18)';
    c.shadowBlur = 40;
    c.shadowOffsetY = 12;
    c.fillStyle = '#f7f7f9';
    c.beginPath();
    c.roundRect(130, 340, 1240, 760, 14);
    c.fill();
    c.restore();
    c.fillStyle = '#8c8c94';
    c.font = `300 56px "Inter Variable", system-ui, sans-serif`;
    c.textAlign = 'center';
    c.fillText('Integrated Management System', 750, 420);
    c.fillText('Training and Student Life', 750, 492);
    c.textAlign = 'left';
    const field = (y: number, label: string, icon: 'user' | 'lock' | 'key') => {
      c.fillStyle = '#ffffff';
      c.strokeStyle = '#d0d0d6';
      c.lineWidth = 2;
      c.beginPath();
      c.roundRect(190, y, 1120, 82, 6);
      c.fill();
      c.stroke();
      if (label) {
        c.fillStyle = '#a2a2aa';
        c.font = UI(34);
        c.fillText(label, 215, y + 41);
      }
      c.strokeStyle = '#8a8a92';
      c.lineWidth = 4;
      const ix = 1262;
      const iy = y + 41;
      c.beginPath();
      if (icon === 'user') {
        c.arc(ix, iy - 8, 9, 0, Math.PI * 2);
        c.moveTo(ix - 16, iy + 20);
        c.quadraticCurveTo(ix, iy - 4, ix + 16, iy + 20);
      } else if (icon === 'lock') {
        c.roundRect(ix - 13, iy - 2, 26, 22, 3);
        c.moveTo(ix - 8, iy - 2);
        c.arc(ix, iy - 8, 8, Math.PI, 0);
      } else {
        c.arc(ix - 8, iy, 9, 0, Math.PI * 2);
        c.moveTo(ix + 1, iy);
        c.lineTo(ix + 22, iy);
      }
      c.stroke();
    };
    field(550, '', 'user');
    field(668, 'Password', 'lock');
    field(786, '2-step code', 'key');
    const btn = (x: number, w: number, label: string) => {
      c.fillStyle = '#2f9e52';
      c.beginPath();
      c.roundRect(x, 920, w, 78, 8);
      c.fill();
      c.fillStyle = '#ffffff';
      c.font = UI(32);
      c.textAlign = 'center';
      c.fillText(label, x + w / 2, 960);
      c.textAlign = 'left';
    };
    btn(190, 300, 'Sign in');
    btn(770, 540, 'Sign in with ID card');
    c.strokeStyle = '#3f6fd6';
    c.lineWidth = 4;
    c.strokeRect(194, 1038, 30, 30);
    c.fillStyle = '#8a8a92';
    c.font = UI(30);
    c.fillText('Stay signed in', 246, 1054);
  });
}
const FORM_FIELD = { x: 215, y: 591 };

function bannerSheet(h: SceneHost): Sheet {
  return sheet(h, 'banner-bg', 2000, 1100, (c) => {
    c.fillStyle = '#dcdce0';
    c.fillRect(0, 0, 2000, 1100);
    [60, 410, 760].forEach((y) => {
      c.fillStyle = '#f7c4cb';
      c.fillRect(120, y, 1860, 250);
      c.fillStyle = '#d32f3b';
      c.fillRect(120, y, 30, 250);
      c.strokeStyle = '#cf3a45';
      c.lineWidth = 5;
      c.beginPath();
      c.arc(270, y + 125, 38, 0, Math.PI * 2);
      c.moveTo(255, y + 110);
      c.lineTo(285, y + 140);
      c.moveTo(285, y + 110);
      c.lineTo(255, y + 140);
      c.stroke();
    });
  });
}

// ---- cameras and fx per shot --------------------------------------------------------------------------------------------------------
type Fx = SceneFx;
const baseFx = (): Fx => ({ grain: 0.07, vignette: 0.55, aber: 0.55, bloom: 1.4, curve: 0.03, exposure: 1 });

export function drawTerminalScene(h: SceneHost): SceneFx {
  const { W, H, frame, tl } = h;
  const t = frame.tMs;
  const line = lineAt(tl, t);
  const reduced = h.reduced;
  const fx = baseFx();
  h.clear('#04060d');
  if (!line) {
    // nobody is singing: the code drifts by, out of focus
    const cs = codeSheet(h);
    const z = 0.95 + 0.04 * Math.sin(t / 3400);
    const M = camera(W, H, { fx: 900 + Math.sin(t / 5200) * 120, fy: 600 + t * 0.02 % 500, zoom: z * (W / 1280), rot: Math.sin(t / 7000) * 1.2 });
    put(h, M, cs, { lod: 1.4, alpha: 0.55 });
    return { ...fx, exposure: 0.9, bloom: 1.2 };
  }
  const shot = shotFor(line);
  const a = line.age;
  const D = line.dur;
  const whip = 1 - smooth(0, 190, a); // 1 at the cut, 0 once the shot has settled
  const out = smooth(D - 130, D, a); // leaving
  const shake = reduced ? 0 : 1;
  const k = W / 1280; // everything below is tuned at 1280 wide
  const jx = noise1(t / 900, 1) * 5 * shake * k;
  const jy = noise1(t / 800, 2) * 4 * shake * k;
  let lod = whip * 2.6 + out * 0.8;
  let alpha = 1;

  if (shot === 'code') {
    const cs = codeSheet(h);
    const font = MONO(CODE_FS);
    const lyric = line.text;
    const tt = textTex(h, lyric, MONO, CODE_FS, '#ffb27a', { hi: 3 });
    const Lw = tt.textW * tt.k;
    const lx = CODE_PREFIX_W + 22; // after the opening quote
    const ly = 60 + LYRIC_ROW * CODE_ROW;
    const fullW = Lw + 2 * 0.6 * CODE_FS + 30;
    const z0 = clamp((0.92 * W) / fullW, 0.7, 3.4);
    const fx0 = CODE_PREFIX_W - 12 + fullW / 2;
    const approach = easeOutExpo(a / (D * 0.2));
    const push = lerp(1, 1.05, easeInOut(u01(a, D, 0.2, 0.85)));
    const dolly = lerp(1, 1.7, easeInOut(u01(a, D, 0.82, 1)));
    const zoom = z0 * lerp(0.74, 1, approach) * push * dolly;
    lod = Math.max(0, (1 - approach) * 3.2 + (1 - Math.min(1, a / 120)) * 1.2) + smooth(0.84, 1, line.p) * 1.4;
    const M = camera(W, H, { fx: fx0 + lerp(260, 0, approach), fy: ly + 18 + lerp(80, 0, approach), zoom, rot: lerp(2.5, 0, approach) + Math.sin(t / 2300) * 0.5, tx: jx, ty: jy + 0.02 * H });
    put(h, M, cs, { lod, alpha });
    // the string literal, typed
    const n = typedChars(lyric, a, D * 0.12, D * 0.66);
    const prefix = prefixPx(h, tt, lyric, n);
    const baseLod = Math.max(0, lod - 0.4);
    h.shape({ kind: 0, m: mul(M, translate(lx - 12, ly)), w: 20, h: 1, color: '#000000', alpha: 0, camera: false });
    drawQuote(h, M, lx - 0.6 * CODE_FS, ly, baseLod);
    drawText(h, tt, M, lx, ly, { clipPx: prefix, lod: baseLod, alpha });
    drawQuote(h, M, lx + Lw, ly, baseLod, ");");
    // the caret
    if (n < lyric.length || cursorOn(t)) {
      const cw = 3.4;
      const cxs = lx + prefix + 1;
      h.rect(0, 0, 0, 0, '#000', 0);
      h.sprite({ tex: caretTex(h).tex, m: mul(M, translate(cxs + cw / 2, ly)), w: cw, h: CODE_FS * 1.25, alpha: n >= lyric.length && !cursorOn(t) ? 0 : 1, mode: 1, color: '#ffe6cf', camera: false, lod: baseLod });
    }
    fx.mblur = [(whip * 0.045 + out * 0.02) * (reduced ? 0 : 1), 0];
    void font;
  } else if (shot === 'errors') {
    const es = errorSheet(h);
    const tt = textTex(h, line.text, UI, 52, '#ffffff', { hi: 3 });
    const Lw = tt.textW * tt.k;
    const n = typedChars(line.text, a, D * 0.1, D * 0.7, 28, 85);
    const prefix = prefixPx(h, tt, line.text, n);
    const zoomIn = easeInOut(u01(a, D, 0, 0.35));
    const zoom = lerp(0.62, 3.0, zoomIn) * (W / 1280) * lerp(1, 1.12, smooth(0.5, 1, line.p));
    const follow = Math.max(ERR_X + 0.45 * (W / zoom), ERR_X + prefix - 0.2 * (W / zoom));
    const M = camera(W, H, { fx: lerp(900, follow, zoomIn), fy: lerp(700, ERR_Y, zoomIn), zoom, rot: lerp(-8, -1.5, zoomIn) + Math.sin(t / 1900) * 0.35, skew: -0.04, tx: jx, ty: jy });
    lod = Math.max(0, (1 - zoomIn) * 1.4) + whip * 2.2 + out * 0.7;
    put(h, M, es, { lod });
    drawText(h, tt, M, ERR_X, ERR_Y, { clipPx: prefix, lod: Math.max(0, lod - 0.3) });
    if (n < line.text.length || cursorOn(t)) h.sprite({ tex: caretTex(h).tex, m: mul(M, translate(ERR_X + prefix + 5, ERR_Y)), w: 4, h: 56, mode: 1, color: '#ffffff', camera: false, lod: Math.max(0, lod - 0.3), alpha: n >= line.text.length && !cursorOn(t) ? 0 : 1 });
    fx.mblur = [(whip * 0.05 + zoomIn * (1 - zoomIn) * 0.06) * (reduced ? 0 : 1), 0];
    void Lw;
  } else if (shot === 'form') {
    const fs = formSheet(h);
    h.clear('#cfcfd4');
    const tt = textTex(h, line.text, UI, 44, '#2a2a30', { hi: 3 });
    const Lw = tt.textW * tt.k;
    const n = typedChars(line.text, a, D * 0.14, D * 0.62, 30, 90);
    const prefix = prefixPx(h, tt, line.text, n);
    // pulls in at an angle, settles, then spins away
    const settle = easeOutExpo(a / (D * 0.3));
    const spin = easeInOut(u01(a, D, 0.74, 1));
    const rot = lerp(-34, -14, settle) + spin * -78;
    const zoom = lerp(0.45, 1.05, easeOut(u01(a, D, 0, 0.55))) * (W / 1280) * lerp(1, 1.35, spin);
    const M = camera(W, H, { fx: lerp(750, FORM_FIELD.x + Math.max(380, prefix * 0.5), settle), fy: lerp(540, FORM_FIELD.y + 90, settle), zoom, rot, skew: 0.1 * (1 - spin * 0.5), tx: jx, ty: jy });
    lod = (1 - settle) * 2.4 + whip * 1.6 + spin * 2.2;
    put(h, M, fs, { lod });
    // the typed text sits on a grey selection, with an underscore caret
    h.rect(0, 0, 0, 0, '#000', 0);
    h.shape({ kind: 0, m: mul(M, translate(FORM_FIELD.x + Math.max(8, prefix) / 2, FORM_FIELD.y)), w: Math.max(8, prefix) + 16, h: 56, color: '#bdbdc2', alpha: 0.95, radius: 4, soft: 0.6, camera: false });
    drawText(h, tt, M, FORM_FIELD.x, FORM_FIELD.y, { clipPx: prefix, lod: Math.max(0, lod - 0.3) });
    if (n < line.text.length || cursorOn(t)) h.shape({ kind: 0, m: mul(M, translate(FORM_FIELD.x + prefix + 14, FORM_FIELD.y + 22)), w: 26, h: 4, color: '#2a2a30', alpha: 1, radius: 0, soft: 0.5, camera: false });
    fx.mblur = [(whip * 0.04 + spin * 0.07) * (reduced ? 0 : 1), spin * 0.03];
    fx.vignette = 0.7;
    fx.bloom = 0.3;
    fx.exposure = 1.0;
    void Lw;
  } else if (shot === 'banner') {
    const bs = bannerSheet(h);
    h.clear('#d4d4d8');
    const tt = textTex(h, line.text, (px) => `500 ${px}px "Inter Variable", "Segoe UI", sans-serif`, 70, '#c32f3a', { hi: 3 });
    const n = typedChars(line.text, a, D * 0.05, D * 0.34, 20, 60);
    const prefix = prefixPx(h, tt, line.text, n);
    const travel = easeInOut(line.p);
    const rot = lerp(-22, -12, travel);
    const textW = tt.textW * tt.k;
    const fit = clamp((0.9 * W) / (textW + 420), 0.35, 1.5);
    const zoom = lerp(fit * 0.62, fit, easeOut(u01(a, D, 0, 0.6))) * lerp(1, 0.92, smooth(0.8, 1, line.p));
    const M = camera(W, H, { fx: 350 + textW / 2 + lerp(-40, 120, travel), fy: lerp(480, 640, travel), zoom, rot, skew: 0.08, tx: jx, ty: jy });
    lod = whip * 2.2 + out * 0.8;
    put(h, M, bs, { lod });
    [60, 410, 760].forEach((y) => drawText(h, tt, M, 350, y + 125, { clipPx: prefix, lod: Math.max(0, lod - 0.2) }));
    fx.mblur = [whip * 0.05 * (reduced ? 0 : 1), 0];
    fx.vignette = 0.65;
    fx.bloom = 0.3;
  } else if (shot === 'console') {
    consoleShot(h, line, fx);
  } else {
    bigShot(h, line, fx);
  }

  const f2 = fx;
  f2.exposure = (f2.exposure ?? 1) * (1 + whip * 0.5) * (1 - out * 0.85) * alpha;
  f2.glitch = Math.max(f2.glitch ?? 0, whip * 0.9 * (reduced ? 0 : 1));
  f2.mblur = f2.mblur ?? [0, 0];
  void hash01;
  return f2;
}

function u01(a: number, D: number, from: number, to: number) {
  return clamp((a / D - from) / (to - from));
}

let caretCache: TexEntry | null = null;
function caretTex(h: SceneHost): TexEntry {
  return h.tex('caret', 8, 64, (c) => {
    c.fillStyle = '#fff';
    c.fillRect(0, 0, 8, 64);
  });
  void caretCache;
}

function drawQuote(h: SceneHost, M: Affine, x: number, y: number, lod: number, tail = '') {
  const tt = textTex(h, `'${tail}`, MONO, CODE_FS, '#ffb27a', { hi: 3 });
  drawText(h, tt, M, x, y, { lod });
}

function consoleShot(h: SceneHost, line: Line, fx: Fx) {
  const { W, H, frame } = h;
  const t = frame.tMs;
  const a = line.age;
  const D = line.dur;
  h.clear('#02050a');
  const green = '#43ff3c';
  const lyric = line.text;
  const big = lyric.length <= 34;
  const size = big ? W * 0.07 : W * 0.04;
  const tt = textTex(h, lyric, MONO_B, size, green, { hi: 2, shadow: { color: 'rgba(60,255,60,0.9)', blur: size * 0.22 } });
  const n = typedChars(lyric, a, D * 0.08, D * (big ? 0.62 : 0.7), 30, 80);
  const M: Affine = [1, 0, 0, 1, 0, 0];
  if (big) {
    const prefix = prefixPx(h, tt, lyric, n);
    const margin = W * 0.05;
    // the view follows the end of what has been typed
    const scroll = Math.max(0, prefix - (W - margin * 2) + size * 0.5);
    const shown = tt.textW * tt.k;
    void shown;
    drawText(h, tt, M, margin - scroll, H * 0.5, { clipPx: prefix, alpha: 1 });
    if (n < lyric.length || cursorOn(t)) h.rect(margin - scroll + prefix + 3, H * 0.5 - size * 0.55, Math.max(3, size * 0.12), size * 1.1, green, 1);
  } else {
    const font = MONO_B(Math.round(size * 2));
    const lines = wrapText(h, lyric, font, W * 0.86 * 2).map((s) => s);
    let remaining = n;
    const lineH = size * 1.9;
    const y0 = H * 0.46 - ((lines.length - 1) * lineH) / 2;
    lines.forEach((ln, i) => {
      const lt = textTex(h, ln, MONO_B, size, green, { hi: 2, shadow: { color: 'rgba(60,255,60,0.9)', blur: size * 0.22 } });
      const lw = lt.textW * lt.k;
      const take = clamp(remaining, 0, ln.length);
      remaining -= ln.length + 1;
      if (take <= 0) return;
      const pre = prefixPx(h, lt, ln, take);
      const x0 = (W - lw) / 2;
      drawText(h, lt, M, x0, y0 + i * lineH, { clipPx: pre });
      const active = take < ln.length || (i === lines.length - 1 && take >= ln.length);
      if (active && (take < ln.length || cursorOn(t))) h.rect(x0 + pre + 3, y0 + i * lineH - size * 0.55, Math.max(3, size * 0.12), size * 1.1, green, 1);
    });
  }
  fx.grain = 0.05;
  fx.vignette = 0.6;
  fx.bloom = 1.8;
  fx.scan = 0.06;
  fx.curve = 0.05;
  fx.aber = 0.5;
}

function bigShot(h: SceneHost, line: Line, fx: Fx) {
  const { W, H, frame } = h;
  const t = frame.tMs;
  const a = line.age;
  const D = line.dur;
  const cs = codeSheet(h);
  const k = W / 1280;
  const M0 = camera(W, H, { fx: 1000 + Math.sin(t / 3000) * 80, fy: 700, zoom: 1.2 * k, rot: -3 + Math.sin(t / 2600) * 0.8 });
  put(h, M0, cs, { lod: 1.8, alpha: 0.5 });
  const size = W * 0.12;
  const font = (px: number) => `500 ${px}px "JetBrains Mono Variable", ui-monospace, monospace`;
  const lines = wrapText(h, line.text, font(Math.round(size)), W * 0.88);
  const dolly = lerp(2.4, 1, easeOutExpo(a / (D * 0.35))) * lerp(1, 1.06, line.p);
  const lineH = size * 1.25;
  const y0 = H * 0.46 - ((lines.length - 1) * lineH) / 2;
  let wi = 0;
  let burst = 0;
  const words = line.words;
  const sizeFit = Math.min(size, (W * 0.9) / Math.max(1, Math.max(...lines.map((l) => h.measure(font(Math.round(size)), l)))) * size);
  lines.forEach((ln, li) => {
    const lt = textTex(h, ln, (px) => font(px), sizeFit, '#f3e5a6', { hi: 2, shadow: { color: 'rgba(255,236,160,0.6)', blur: sizeFit * 0.12 } });
    const lw = lt.textW * lt.k;
    // words appear as they are sung
    const parts = ln.split(' ');
    let x = (W - lw) / 2 / 1;
    parts.forEach((p, pi) => {
      const wc = words[wi++];
      const start = wc ? Math.max(0, wc.startMs - line.startMs) : 0;
      const on = a >= start - 20;
      const since = a - start;
      if (since >= 0 && since < 320) burst = Math.max(burst, 1 - since / 320);
      const pre = pi === 0 ? '' : `${parts.slice(0, pi).join(' ')} `;
      const px = h.measure(lt.f, pre) * lt.k;
      void x;
      if (!on) return;
      const wt = textTex(h, p, (q) => font(q), sizeFit, '#f3e5a6', { hi: 2, shadow: { color: 'rgba(255,236,160,0.6)', blur: sizeFit * 0.12 } });
      const jitter = since >= 0 && since < 160 ? (hash01(Math.floor(t / 40) + pi) - 0.5) * sizeFit * 0.12 : 0;
      const m = mul(translate(W / 2, H / 2), mul([dolly, 0, 0, dolly, 0, 0], translate(-W / 2, -H / 2)));
      drawText(h, wt, m, (W - lw) / 2 + px + jitter, y0 + li * lineH, { alpha: smooth(0, 90, since), lod: smooth(0.85, 1, line.p) * 1.5 });
    });
  });
  fx.blocks = burst * 0.9;
  fx.glitch = Math.max(fx.glitch ?? 0, burst * 0.5);
  fx.aber = 0.9 + burst * 1.5;
  fx.bloom = 1.6;
  fx.grain = 0.08;
}
