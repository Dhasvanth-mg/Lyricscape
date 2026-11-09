// "Lyrics app": the rolling-lyrics screens from the reference clip. A column of big rounded bold words: the word being sung is
// large and white in the middle, the words before and after it are small and dim above and below (they slide as the song moves),
// the key word sits on a soft chip. Two worlds, switching every few lines: an Apple-style colour mesh (orange, pink, blue) and a
// deep-space nebula with racing neon streaks (each with a tiny ship at its head), drifting rocks and stars, where the whole column
// tilts along the streaks and steps down to the right.

import { rotate, translate } from '../gpu';
import { clamp, easeOut, easeOutExpo, hash01, lerp, lineAt, textTex, drawTextC } from './common';
import { MESH_FS, NEBULA_FS } from './shaders';
import type { SceneFx, SceneHost } from './types';
import { SCHEME_IDS, SCHEMES, hashKey, hsl, pick, seeded, songHues } from '../../variety';
import { ART_IDS, drawArt } from '../../art/library';

const NUNITO = (px: number) => `900 ${px}px "Nunito", "Inter Variable", system-ui, sans-serif`;

const MESH = ['#ff7a3d', '#ff3d7a', '#5560f0', '#ff9a4d'];

// ---- variants: every three lines a new look from the song's hues ---------------------------------------------------------------
// mesh and nebula colours (8 harmony schemes on a continuous hue), 8 faces, chip colour, tilt, spacing and which sections go to
// space: thousands of combinations, the same for the same song.
const FACES: ((px: number) => string)[] = [
  NUNITO_F,
  (px) => `800 ${px}px "Inter Variable", system-ui, sans-serif`,
  (px) => `700 ${px}px "Space Grotesk Variable", sans-serif`,
  (px) => `800 ${px}px "Syne Variable", sans-serif`,
  (px) => `400 ${px}px "Anton", Impact, sans-serif`,
  (px) => `400 ${px}px "DM Serif Display", serif`,
  (px) => `800 ${px}px "Playfair Display Variable", serif`,
  (px) => `400 ${px}px "Bangers", sans-serif`,
];
function NUNITO_F(px: number) {
  return `900 ${px}px "Nunito", "Inter Variable", system-ui, sans-serif`;
}
/** how the words are laid out: the rolling column, a sideways row, a diagonal, an arc, a fly-through, a left-aligned list, a scatter */
export const LYRIC_LAYOUTS = ['column', 'row', 'diagonal', 'arc', 'zoom', 'left', 'scatter'] as const;
export type LyricLayout = (typeof LYRIC_LAYOUTS)[number];
/** what is behind: the colour mesh, deep space, flat paper with floating stickers from the art library, soft glowing blobs */
export const LYRIC_GROUNDS = ['mesh', 'space', 'stickers', 'blobs'] as const;
export type LyricGround = (typeof LYRIC_GROUNDS)[number];
/** distinct screens: layouts x grounds x faces (before colours, tilt and spacing, which are continuous) */
export const LYRICS_APP_LOOKS = LYRIC_LAYOUTS.length * LYRIC_GROUNDS.length * 8;
type NebulaVariant = { mesh: string[]; neb: string[]; face: (px: number) => string; chip: string; tilt: number; pitch: number; space: boolean; layout: LyricLayout; ground: LyricGround; paper: string; stickers: string[] };
function nebulaVariant(seed: number, hues: number[], section: number): NebulaVariant {
  const r = seeded(seed);
  if (r() < 0.12) return { mesh: MESH, neb: NEBULA, face: NUNITO_F, chip: '#7aa6ff', tilt: -7, pitch: 1, space: section % 2 === 1, layout: 'column', ground: section % 2 === 1 ? 'space' : 'mesh', paper: '#141018', stickers: [] };
  const hue = pick(r, hues) + (r() - 0.5) * 0.1;
  const sch = SCHEMES[pick(r, SCHEME_IDS)];
  const mesh = [0, 1, 2, 0].map((i, k) => hsl(hue + sch[i]! + k * 0.02, 0.7 + r() * 0.25, 0.5 + r() * 0.15));
  const neb = [hsl(hue + 0.7, 0.8, 0.5), hsl(hue + 0.8, 0.85, 0.55), hsl(hue + 0.6, 0.8, 0.5), hsl(hue + 0.7, 0.7, 0.08)];
  const ground = pick(r, ['mesh', 'mesh', 'space', 'stickers', 'blobs'] as const);
  return {
    mesh,
    neb,
    face: pick(r, FACES),
    chip: hsl(hue + sch[1]!, 0.75, 0.62),
    tilt: (r() - 0.5) * 20,
    pitch: 0.85 + r() * 0.35,
    space: ground === 'space',
    layout: r() < 0.3 ? 'column' : pick(r, LYRIC_LAYOUTS),
    ground,
    paper: hsl(hue + 0.5, 0.35 + r() * 0.3, 0.08 + r() * 0.08),
    stickers: Array.from({ length: 7 }, () => pick(r, ART_IDS)),
  };
}
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
  const section = line ? Math.floor(line.i / 3) : 0;
  const V = nebulaVariant(hashKey(`${tl.trackId}|${tl.seed}|neb|${section}`), songHues(tl.palette, tl.seed), section);
  const space = line ? V.space : false;
  const k = Math.min(W / 1280, H / 720);
  const ground: LyricGround = line ? V.ground : 'mesh';

  if (ground === 'stickers' || ground === 'blobs') {
    h.clear(V.paper);
    if (ground === 'blobs') {
      V.mesh.forEach((c, i) => {
        const a = t / (5200 + i * 900) + i * 1.7;
        h.pool(W * (0.5 + 0.38 * Math.cos(a)), H * (0.5 + 0.36 * Math.sin(a * 1.3)), Math.max(W, H) * (0.32 + 0.06 * i), c, 0.55 + frame.beat.pulse * 0.15);
      });
    } else stickers(h, V, t, k);
  } else if (!space) {
    h.fullscreen('mesh', MESH_FS, 0.5, (p) => {
      p.v3arr('u_c', rgbArr(V.mesh));
      p.f('u_time', t / 1000);
      p.f('u_pulse', frame.beat.pulse);
    });
  } else {
    h.fullscreen('nebula', NEBULA_FS, 0.5, (p) => {
      p.v3arr('u_c', rgbArr(V.neb));
      p.f('u_time', t / 1000);
      p.f('u_pulse', frame.beat.pulse);
    });
    spaceFurniture(h, t, k);
  }

  if (line) drawColumn(h, line, space, k, V);

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

/** stickers from the art library drifting slowly behind the words */
function stickers(h: SceneHost, V: NebulaVariant, t: number, k: number) {
  const { W, H } = h;
  V.stickers.forEach((id, i) => {
    const tex = h.tex(`neb|art|${id}|${V.chip}`, 192, 192, (c) => {
      c.translate(96, 96);
      drawArt(c, id, 80, { fill: i % 2 ? V.chip : V.mesh[i % V.mesh.length]!, stroke: '#ffffff', lineWidth: 6, accent: V.mesh[(i + 1) % V.mesh.length]! });
    });
    const sx = hash01(i * 3.1 + 1);
    const sy = hash01(i * 5.7 + 2);
    const x = ((sx * W + t * 0.012 * (i % 2 ? 1 : -1) * k) % (W + 200) + W + 200) % (W + 200) - 100;
    const y = sy * H + Math.sin(t / 2400 + i) * 14 * k;
    const sz = (110 + hash01(i * 9.3) * 90) * k;
    h.sprite({ tex: tex.tex, m: mulM(translate(x, y), rotate(Math.sin(t / 3000 + i) * 0.2)), w: sz, h: sz, alpha: 0.55, mode: 0, camera: false });
  });
}

function drawColumn(h: SceneHost, line: NonNullable<ReturnType<typeof lineAt>>, space: boolean, k: number, V: NebulaVariant) {
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
  const tilt = space ? V.tilt : 0;
  const base = [1, 0, 0, 1, 0, 0] as [number, number, number, number, number, number];
  const stack = space ? mulM(translate(W / 2, H / 2), mulM(rotate((tilt * Math.PI) / 180), translate(-W / 2, -H / 2))) : base;
  // longest word decides nothing: each word fits itself
  for (let i = Math.max(0, act - 3); i <= Math.min(n - 1, act + 3); i++) {
    const d = i - cursor;
    const ad = Math.abs(d);
    if (ad > 3.2) continue;
    const tt = textTex(h, words[i]!.text, V.face, B, '#ffffff', { hi: 2 });
    const w0 = tt.textW * tt.k;
    let s = interp(SIZE, ad);
    let alpha = interp(ALPHA, ad) * (i === act ? clamp(since / 90 + 0.25) : 1);
    let y = H * 0.5 + Math.sign(d) * interp(PITCH, ad) * B * (space ? 0.95 : 1) * V.pitch;
    let x = W / 2 + d * (space ? W * 0.085 : 0);
    let rot = 0;
    switch (V.layout) {
      case 'row':
        s = interp([1, 0.5, 0.36, 0.28], ad);
        x = W / 2 + d * W * 0.3 * V.pitch;
        y = H * 0.5 + Math.sin(d * 0.9) * B * 0.2;
        break;
      case 'diagonal':
        x = W / 2 + d * W * 0.17;
        y = H * 0.5 + d * B * 0.85 * V.pitch;
        rot = 8;
        break;
      case 'arc': {
        const R = H * 1.05;
        const ang = d * 0.36 * V.pitch;
        x = W / 2 + Math.sin(ang) * R;
        y = H * 0.55 + R - Math.cos(ang) * R;
        rot = (ang * 180) / Math.PI;
        s = interp([1, 0.55, 0.42, 0.32], ad);
        break;
      }
      case 'zoom':
        // past words fly toward you and fade, coming words wait small in the distance
        if (d < 0) {
          s = 1 + ad * 1.4;
          alpha = clamp(1 - ad * 0.9) * 0.6;
        } else s = interp([1, 0.36, 0.22, 0.14], ad);
        x = W / 2 + d * W * 0.02;
        y = H * 0.5 - d * B * 0.32;
        break;
      case 'left':
        s = interp([1, 0.6, 0.5, 0.42], ad);
        y = H * 0.5 + d * B * 0.95 * V.pitch;
        x = W * 0.08 + Math.min(w0 * s, maxW) / 2;
        break;
      case 'scatter':
        if (i !== act) {
          x = W * (0.15 + 0.7 * hash01(i * 7.7 + line.i));
          y = H * (0.18 + 0.64 * hash01(i * 3.3 + line.i * 2.1));
          rot = (hash01(i * 1.9) - 0.5) * 30;
        }
        break;
      default:
    }
    s = Math.min(s, maxW / Math.max(1, w0));
    const pop = i === act ? 0.9 + 0.1 * easeOutExpo(since / 160) : 1;
    const key = i === act && (words[i]!.emphasis ?? 0) > 0.5 ? true : i === act && words[i]!.text.replace(/\W/g, '').length >= 7;
    if (key) {
      const chipW = w0 * s * pop + B * 0.5 * s;
      const chipH = B * 0.98 * s * pop;
      h.shape({ kind: 0, m: mulM(mulM(stack, translate(x, y)), rotate((rot * Math.PI) / 180)), w: chipW, h: chipH, color: V.chip, alpha: alpha * (space ? 0.95 : 0.6), radius: chipH * 0.28, soft: 0.8, camera: false });
    }
    drawTextC(h, tt, stack, x, y, { alpha, s: s * pop, rot, color: ad < 0.5 ? [1, 1, 1, 1] : space ? [0.86, 0.82, 1, 1] : [1, 0.95, 0.97, 1] });
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
