// "Acid grain": the grainy colour-blob reference. A full-frame field of saturated colour whose hues keep rolling, buried in coarse
// colour grain; hand-drawn eyeballs with thick black outlines whose red, green and blue copies are drawn apart (rainbow edges) loop
// through the same dance as in the clip: five big eyes in a row under a pyramid of small ones, a cluster of blank pale balls, then
// everybody scatters and bobs about with one huge ball rolling in from below. The lyric is a small yellow condensed subtitle near
// the top, whole line at once, outlined in dark brown.

import { clamp, easeInOut, hash01, lerp, lineAt, smooth, textTex } from './common';
import { ACID_FS } from './shaders';
import type { SceneFx, SceneHost } from './types';

const CYCLE = 7000;
// phase starts (ms): A pyramid, B blank balls, C scatter with the big ball, D dancing scatter
const PH = [0, 950, 1900, 2900, CYCLE];

const SCLERA = ['#f3e4ff', '#e6f7a6', '#ffffff', '#ffd8ec', '#d7f1ff', '#f5ecc0'];
const IRIS: [string, string][] = [
  ['#9b4fe0', '#d94fb8'],
  ['#3d9bd6', '#7c5ce0'],
  ['#5cc46a', '#2c8f7a'],
  ['#e05a7a', '#e8a13d'],
  ['#4f5ae0', '#3ec1c8'],
  ['#c64fe0', '#6ad06a'],
];

function wob(c: CanvasRenderingContext2D, r: number, seed: number, amp = 0.045) {
  c.beginPath();
  const n = 36;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + amp * Math.sin(a * 3 + seed) + amp * 0.6 * Math.sin(a * 5 + seed * 2.1) + amp * 0.3 * Math.sin(a * 8 + seed);
    const x = Math.cos(a) * r * k;
    const y = Math.sin(a) * r * k;
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  }
  c.closePath();
}

const S = 256;
function fillTex(h: SceneHost, v: number, iris: boolean) {
  return h.tex(`acid|fill|${v}|${iris ? 1 : 0}`, S, S, (c) => {
    c.translate(S / 2, S / 2);
    wob(c, 106, v + 1);
    c.fillStyle = SCLERA[v % SCLERA.length]!;
    c.fill();
    // soft shading on one side: a printed, flat crescent
    c.save();
    c.clip();
    c.fillStyle = 'rgba(120,90,170,0.22)';
    c.beginPath();
    c.arc(34, 38, 112, 0, Math.PI * 2);
    c.arc(-6, -8, 106, 0, Math.PI * 2, true);
    c.fill('evenodd');
    c.restore();
    if (!iris) return;
    const [a, b] = IRIS[v % IRIS.length]!;
    wob(c, 60, v + 2.2, 0.03);
    c.fillStyle = a;
    c.fill();
    wob(c, 40, v + 3.1, 0.03);
    c.fillStyle = b;
    c.fill();
    wob(c, 20, v + 4, 0.04);
    c.fillStyle = '#1a0d2a';
    c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(-8, -9, 6, 0, Math.PI * 2);
    c.fill();
  });
}
function lineTex(h: SceneHost, v: number, iris: boolean) {
  return h.tex(`acid|line|${v}|${iris ? 1 : 0}`, S, S, (c) => {
    c.translate(S / 2, S / 2);
    c.lineJoin = 'round';
    c.strokeStyle = '#fff';
    c.lineWidth = 15;
    wob(c, 106, v + 1);
    c.stroke();
    if (!iris) {
      // a couple of crescent lines, as the blank balls have
      c.lineWidth = 5;
      c.beginPath();
      c.arc(-6, -6, 74, Math.PI * 0.95, Math.PI * 1.45);
      c.stroke();
      return;
    }
    c.lineWidth = 10;
    wob(c, 60, v + 2.2, 0.03);
    c.stroke();
    c.lineWidth = 4;
    wob(c, 40, v + 3.1, 0.03);
    c.stroke();
    // lid
    c.lineWidth = 7;
    c.beginPath();
    c.arc(0, 6, 98, Math.PI * 1.12, Math.PI * 1.88);
    c.stroke();
  });
}

type Ent = { x: number; y: number; r: number; eye: number; vis: number };

/** where entity i sits in a layout, in units of the playfield (-0.5..0.5 across, 0..1 down) and radius as a fraction of its width */
function layoutOf(p: 0 | 1 | 2 | 3, i: number): Ent {
  const off: Ent = { x: 0, y: 1.3, r: 0.05, eye: 0, vis: 0 };
  if (p === 0) {
    if (i < 5) return { x: -0.35 + i * 0.175, y: 0.605, r: 0.077, eye: 1, vis: 1 };
    const small: [number, number, number][] = [[-0.16, 0.548, 0.05], [0, 0.548, 0.05], [0.16, 0.548, 0.05], [-0.08, 0.518, 0.045], [0.08, 0.518, 0.045], [0, 0.492, 0.04]];
    if (i < 11) {
      const s = small[i - 5]!;
      return { x: s[0], y: s[1], r: s[2], eye: 0.7, vis: 1 };
    }
    if (i === 11) return { x: 0, y: 0.36, r: 0.014, eye: 1, vis: 1 };
    return off;
  }
  if (p === 1) {
    if (i < 11) {
      const left = i % 2 === 0;
      const row = Math.floor(i / 2);
      const jx = (hash01(i * 3 + 1) - 0.5) * 0.06;
      return { x: (left ? -0.36 : 0.12) + (row % 3) * 0.1 + jx + (left ? 0 : 0.05 * row), y: 0.5 + ((row * 37) % 5) * 0.02 + hash01(i + 9) * 0.03, r: 0.045 + hash01(i + 4) * 0.035, eye: 0, vis: 1 };
    }
    return off;
  }
  const seedBase = p === 2 ? 100 : 200;
  if (i === 12) return p === 2 ? { x: -0.02, y: 0.88, r: 0.17, eye: 0, vis: 1 } : { x: 0.1, y: 1.4, r: 0.17, eye: 0, vis: 0 };
  if (i === 11) return off;
  const band = hash01(seedBase + i * 5 + 1);
  return { x: (hash01(seedBase + i * 5 + 2) - 0.5) * 0.98, y: 0.5 + band * 0.14 + (i % 3) * 0.015, r: 0.032 + hash01(seedBase + i * 5 + 3) * 0.05, eye: 1, vis: 1 };
}

function mixEnt(a: Ent, b: Ent, w: number): Ent {
  return { x: lerp(a.x, b.x, w), y: lerp(a.y, b.y, w), r: lerp(a.r, b.r, w), eye: lerp(a.eye, b.eye, w), vis: lerp(a.vis, b.vis, w) };
}

export function drawAcidScene(h: SceneHost): SceneFx {
  const { W, H, frame, tl } = h;
  const t = frame.tMs;
  const ts = t / 1000;
  h.fullscreen('acid', ACID_FS, 0.5, (p) => p.f('u_time', ts));

  // ---- the eyes: a loop of four poses -------------------------------------------------------------------------------------------
  const ct = ((t % CYCLE) + CYCLE) % CYCLE;
  let ph = 0;
  for (let i = 0; i < 4; i++) if (ct >= PH[i]!) ph = i;
  const phase = ph as 0 | 1 | 2 | 3;
  const next = ((ph + 1) % 4) as 0 | 1 | 2 | 3;
  const into = clamp((ct - (PH[ph + 1]! - 420)) / 420);
  const w = easeInOut(into);
  const PW = Math.min(W, H * 0.78);
  const cxm = W / 2;
  const ent: { e: Ent; i: number }[] = [];
  for (let i = 0; i < 13; i++) {
    const e = mixEnt(layoutOf(phase, i), layoutOf(next, i), w);
    // the dance: everybody bobs, the bigger the quicker
    const dance = phase >= 2 ? 1 : 0.25;
    const bob = Math.sin(ts * (1.3 + hash01(i + 60) * 1.4) + i) * 0.012 * dance;
    const sway = Math.cos(ts * (0.9 + hash01(i + 70) * 1.1) + i * 2) * 0.012 * dance;
    ent.push({ i, e: { ...e, x: e.x + sway, y: e.y + bob + (e.vis < 0.5 ? 0.3 : 0) } });
  }
  // small ones first so the big eyes overlap them
  ent.sort((a, b) => a.e.r - b.e.r);
  const dpx = Math.max(2.5, PW * 0.009);
  for (const { i, e } of ent) {
    if (e.vis < 0.02) continue;
    const v = i % IRIS.length;
    const size = e.r * PW * 2.7 * (1 + frame.beat.pulse * 0.04);
    const x = cxm + e.x * PW;
    const y = H * 0.5 + (e.y - 0.5) * PW * 1.55 + (H - PW * 1.55) * 0 + (e.y - 0.5) * 0;
    const ang = Math.sin(ts * 0.6 + i * 1.7) * 0.25 * (phase >= 2 ? 1 : 0.2);
    const m: [number, number, number, number, number, number] = [Math.cos(ang), Math.sin(ang), -Math.sin(ang), Math.cos(ang), x, y];
    const drawAt = (dx: number, dy: number): typeof m => [m[0], m[1], m[2], m[3], x + dx, y + dy];
    const withIris = e.eye > 0.5;
    const fill = fillTex(h, v, withIris);
    const line = lineTex(h, v, withIris);
    h.sprite({ tex: fill.tex, m, w: size, h: size, mode: 0, camera: false, alpha: Math.min(1, e.vis) });
    // the three colour channels of the outline, slipped apart
    h.additive(true);
    h.sprite({ tex: line.tex, m: drawAt(-dpx, -dpx * 0.4), w: size, h: size, mode: 0, camera: false, color: [1, 0.1, 0.2, 1], alpha: 0.9 * e.vis });
    h.sprite({ tex: line.tex, m: drawAt(dpx, dpx * 0.5), w: size, h: size, mode: 0, camera: false, color: [0.1, 0.45, 1, 1], alpha: 0.9 * e.vis });
    h.sprite({ tex: line.tex, m: drawAt(0, dpx), w: size, h: size, mode: 0, camera: false, color: [0.1, 1, 0.3, 1], alpha: 0.7 * e.vis });
    h.additive(false);
    h.sprite({ tex: line.tex, m, w: size, h: size, mode: 0, camera: false, color: [0.06, 0.03, 0.08, 1], alpha: Math.min(1, e.vis) });
  }

  // ---- the subtitle ---------------------------------------------------------------------------------------------------------------
  const line = lineAt(tl, t);
  if (line) {
    const size0 = Math.min(W * 0.075, H * 0.085);
    const tt = textTex(h, line.text, (px) => `400 ${px}px "Anton", "Bebas Neue", Impact, sans-serif`, size0, '#ffc21a', { hi: 2, stroke: { color: '#2b1500', width: Math.max(3, size0 * 0.11) }, shadow: { color: 'rgba(255,170,0,0.55)', blur: size0 * 0.12 } });
    const maxW = W * 0.9;
    let s = 1;
    if (tt.textW * tt.k > maxW) s = maxW / (tt.textW * tt.k);
    const y = H > W ? H * 0.267 : H * 0.2;
    const pop = 1 + 0.04 * smooth(0, 1, 1 - clamp(line.age / 140));
    h.additive(false);
    h.sprite({
      tex: tt.tex,
      m: [s * pop, 0, 0, s * pop, W / 2, y],
      w: tt.tex.w * tt.k,
      h: tt.tex.h * tt.k,
      mode: 0,
      camera: false,
    });
  }

  return { chroma: 0.3, grainCell: 2, grain: 0.04, aber: 0.55, aberFull: 1, vignette: 0, bloom: 0.25 };
}
