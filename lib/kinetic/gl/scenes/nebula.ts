// "Lyrics app": the rolling-lyrics screens from the reference clip. A column of big rounded bold words: the word being sung is
// large and white in the middle, the words before and after it are small and dim above and below (they slide as the song moves),
// the key word sits on a soft chip. Two worlds, switching every few lines: an Apple-style colour mesh (orange, pink, blue) and a
// deep-space nebula with racing neon streaks (each with a tiny ship at its head), drifting rocks and stars, where the whole column
// tilts along the streaks and steps down to the right.

import { rotate, translate } from '../gpu';
import { clamp, easeOut, easeOutExpo, hash01, lerp, lineAt, textTex, drawTextC } from './common';
import { MESH_FS, NEBULA_FS } from './shaders';
import type { SceneFx, SceneHost } from './types';

const NUNITO = (px: number) => `900 ${px}px "Nunito", "Inter Variable", system-ui, sans-serif`;

const MESH = ['#ff7a3d', '#ff3d7a', '#5560f0', '#ff9a4d'];
const NEBULA = ['#7a46ff', '#d03cff', '#4a6bff', '#0e0630'];

function rgbArr(cols: string[]): Float32Array {
  const a = new Float32Array(12);
  cols.forEach((c, i) => {
    const n = parseInt(c.slice(1), 16);
    a[i * 3] = ((n >> 16) & 255) / 255;
    a[i * 3 + 1] = ((n >> 8) & 255) / 255;
    a[i * 3 + 2] = (n & 255) / 255;
  });
  return a;
}

const interp = (arr: number[], d: number) => {
  const x = clamp(d, 0, arr.length - 1);
  const i = Math.floor(x);
  return lerp(arr[i]!, arr[Math.min(arr.length - 1, i + 1)]!, x - i);
};
const SIZE = [1, 0.42, 0.3, 0.22];
const ALPHA = [1, 0.55, 0.28, 0.08];
const PITCH = [0, 0.78, 1.28, 1.6];

export function drawNebulaScene(h: SceneHost): SceneFx {
  const { W, H, frame, tl } = h;
  const t = frame.tMs;
  const line = lineAt(tl, t);
  const space = line ? Math.floor(line.i / 3) % 2 === 1 : false;
  const k = Math.min(W / 1280, H / 720);

  if (!space) {
    h.fullscreen('mesh', MESH_FS, 0.5, (p) => {
      p.v3arr('u_c', rgbArr(MESH));
      p.f('u_time', t / 1000);
      p.f('u_pulse', frame.beat.pulse);
    });
  } else {
    h.fullscreen('nebula', NEBULA_FS, 0.5, (p) => {
      p.v3arr('u_c', rgbArr(NEBULA));
      p.f('u_time', t / 1000);
      p.f('u_pulse', frame.beat.pulse);
    });
    spaceFurniture(h, t, k);
  }

  if (line) drawColumn(h, line, space, k);

  return space ? { grain: 0.05, vignette: 0.3, bloom: 1.2, aber: 0.35 } : { grain: 0.03, chroma: 0.035, grainCell: 1.5, vignette: 0.12, bloom: 0.6, aber: 0.2 };
}

function ship(h: SceneHost, color: string) {
  return h.tex(`ship|${color}`, 96, 48, (c) => {
    c.translate(48, 24);
    c.fillStyle = color;
    c.strokeStyle = '#ffffff';
    c.lineWidth = 3;
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(36, 0);
    c.lineTo(-30, -16);
    c.lineTo(-16, 0);
    c.lineTo(-30, 16);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(8, 0, 4, 0, Math.PI * 2);
    c.fill();
  });
}
function rock(h: SceneHost, i: number) {
  return h.tex(`rock|${i}`, 128, 128, (c) => {
    c.translate(64, 64);
    c.beginPath();
    for (let a = 0; a < 11; a++) {
      const ang = (a / 11) * Math.PI * 2;
      const r = 44 + hash01(i * 31 + a) * 16;
      a ? c.lineTo(Math.cos(ang) * r, Math.sin(ang) * r) : c.moveTo(Math.cos(ang) * r, Math.sin(ang) * r);
    }
    c.closePath();
    const g = c.createLinearGradient(-50, -50, 50, 50);
    g.addColorStop(0, '#9aa0c0');
    g.addColorStop(1, '#3b3f66');
    c.fillStyle = g;
    c.fill();
    c.fillStyle = 'rgba(20,20,50,0.35)';
    for (let n = 0; n < 4; n++) {
      c.beginPath();
      c.arc((hash01(i * 7 + n) - 0.5) * 50, (hash01(i * 5 + n + 9) - 0.5) * 50, 7 + hash01(n + i) * 8, 0, Math.PI * 2);
      c.fill();
    }
  });
}

function spaceFurniture(h: SceneHost, t: number, k: number) {
  const { W, H } = h;
  const ts = t / 1000;
  const stars: { x: number; y: number; size: number; alpha: number; color: string }[] = [];
  const n = Math.round(170 * Math.max(0.5, h.density));
  for (let i = 0; i < n; i++) {
    const tw = 0.5 + 0.5 * Math.sin(ts * (0.8 + hash01(i + 5) * 2) + i);
    stars.push({ x: hash01(i * 2 + 1) * W, y: hash01(i * 2 + 2) * H, size: (0.5 + hash01(i + 9) * 1.4) * Math.max(0.7, k), alpha: (0.25 + 0.65 * tw) * (0.4 + hash01(i + 13) * 0.6), color: i % 7 === 0 ? '#b9a4ff' : '#ffffff' });
  }
  h.points(stars);
  // drifting rocks
  for (let i = 0; i < 5; i++) {
    const p = (ts * (0.012 + hash01(i + 3) * 0.012) + hash01(i + 20)) % 1;
    const x = W * (-0.1 + p * 1.2);
    const y = H * (0.15 + 0.7 * hash01(i + 30)) + Math.sin(ts * 0.3 + i) * H * 0.02;
    const s = (50 + hash01(i + 40) * 70) * k;
    const r = rock(h, i);
    h.sprite({ tex: r.tex, m: mulT(x, y, ts * (0.2 + hash01(i) * 0.3) * (i % 2 ? 1 : -1)), w: s, h: s, alpha: 0.9, mode: 0, camera: false });
  }
  // two neon streaks, each with a ship at its head, racing from lower left to upper right
  const cols: [string, string, string][] = [
    ['#ff4fd8', '#ffd1f6', '#ff7ae6'],
    ['#b6ff3a', '#f4ffd0', '#c8ff6a'],
  ];
  cols.forEach(([c1, c2, sc], i) => {
    const q = (ts * (0.07 + i * 0.015) + i * 0.4) % 1;
    const S = { x: -0.2 * W, y: H * (1.0 - i * 0.12) };
    const E = { x: 1.2 * W, y: H * (0.22 - i * 0.12) };
    const ang = Math.atan2(E.y - S.y, E.x - S.x);
    const len = W * 0.6;
    const hx = lerp(S.x, E.x, q);
    const hy = lerp(S.y, E.y, q);
    const cx = hx - Math.cos(ang) * len * 0.5;
    const cy = hy - Math.sin(ang) * len * 0.5;
    h.shape({ kind: 5, m: mulR(cx, cy, ang), w: len, h: 120 * k, color: c1, color2: c2, alpha: 0.95, camera: false });
    const s = ship(h, sc);
    h.sprite({ tex: s.tex, m: mulR(hx, hy, ang), w: 96 * k, h: 48 * k, mode: 0, camera: false });
  });
}

function mulT(x: number, y: number, rot: number) {
  return [Math.cos(rot), Math.sin(rot), -Math.sin(rot), Math.cos(rot), x, y] as [number, number, number, number, number, number];
}
function mulR(x: number, y: number, ang: number) {
  return mulT(x, y, ang);
}

function drawColumn(h: SceneHost, line: NonNullable<ReturnType<typeof lineAt>>, space: boolean, k: number) {
  const { W, H } = h;
  const a = line.age;
  const words = line.words;
  const n = words.length;
  if (!n) return;
  const starts = words.map((w, i) => (w.timing !== 'none' ? Math.max(0, w.startMs - line.startMs) : (line.dur * 0.78 * i) / n));
  let act = 0;
  for (let i = 0; i < n; i++) if (a >= starts[i]! - 25) act = i;
  const since = a - starts[act]!;
  const prev = Math.max(0, act - 1);
  // the cursor glides from the previous word to this one
  const cursor = act === 0 ? 0 : lerp(prev, act, easeOut(since / 220));
  const B = clamp(H * 0.2, 60, 220);
  const maxW = W * (space ? 0.74 : 0.84);
  const tilt = space ? -7 : 0;
  const base = [1, 0, 0, 1, 0, 0] as [number, number, number, number, number, number];
  const stack = space ? mulM(translate(W / 2, H / 2), mulM(rotate((tilt * Math.PI) / 180), translate(-W / 2, -H / 2))) : base;
  // longest word decides nothing: each word fits itself
  for (let i = Math.max(0, act - 3); i <= Math.min(n - 1, act + 3); i++) {
    const d = i - cursor;
    const ad = Math.abs(d);
    if (ad > 3.2) continue;
    const tt = textTex(h, words[i]!.text, NUNITO, B, '#ffffff', { hi: 2 });
    const w0 = tt.textW * tt.k;
    let s = interp(SIZE, ad);
    s = Math.min(s, maxW / Math.max(1, w0));
    const pop = i === act ? 0.9 + 0.1 * easeOutExpo(since / 160) : 1;
    const alpha = interp(ALPHA, ad) * (i === act ? clamp(since / 90 + 0.25) : 1);
    const y = H * 0.5 + Math.sign(d) * interp(PITCH, ad) * B * (space ? 0.95 : 1) * 1.0;
    const x = W / 2 + d * (space ? W * 0.085 : 0);
    const key = i === act && (words[i]!.emphasis ?? 0) > 0.5 ? true : i === act && words[i]!.text.replace(/\W/g, '').length >= 7;
    if (key) {
      const chipW = w0 * s * pop + B * 0.5 * s;
      const chipH = B * 0.98 * s * pop;
      h.shape({ kind: 0, m: mulM(stack, translate(x, y)), w: chipW, h: chipH, color: space ? '#6a5cf0' : '#7aa6ff', alpha: alpha * (space ? 0.95 : 0.6), radius: chipH * 0.28, soft: 0.8, camera: false });
    }
    drawTextC(h, tt, stack, x, y, { alpha, s: s * pop, color: ad < 0.5 ? [1, 1, 1, 1] : space ? [0.86, 0.82, 1, 1] : [1, 0.95, 0.97, 1] });
  }
  void k;
}

function mulM(a: readonly number[], b: readonly number[]): [number, number, number, number, number, number] {
  return [
    a[0]! * b[0]! + a[2]! * b[1]!,
    a[1]! * b[0]! + a[3]! * b[1]!,
    a[0]! * b[2]! + a[2]! * b[3]!,
    a[1]! * b[2]! + a[3]! * b[3]!,
    a[0]! * b[4]! + a[2]! * b[5]! + a[4]!,
    a[1]! * b[4]! + a[3]! * b[5]! + a[5]!,
  ];
}
