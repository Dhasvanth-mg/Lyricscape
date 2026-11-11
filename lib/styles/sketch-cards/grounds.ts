// SKC-SRF-GRD: the surfaces the cards land on. Phase 2 planned them as photographs or paintings; with no photographs in this
// project they are painted in code (recorded in design-deviations.md, D3-SKC-01): texture from layered value noise, then the
// objects that make each place specific (plank seams, cork granules and a frame, a notebook's gutter and rules, a drying line,
// paste scraps on a street wall). Painted once per ground, colour set and size bucket, then drawn as one texture.

import { mix } from '../../kinetic/util';
import { rng } from './pen';

export type GroundId =
  | 'SKC-SRF-GRD-001'
  | 'SKC-SRF-GRD-002'
  | 'SKC-SRF-GRD-003'
  | 'SKC-SRF-GRD-004'
  | 'SKC-SRF-GRD-005'
  | 'SKC-SRF-GRD-006'
  | 'SKC-SRF-GRD-007'
  | 'SKC-SRF-GRD-008'
  | 'SKC-SRF-GRD-009'
  | 'SKC-SRF-GRD-010'
  | 'SKC-SRF-GRD-011';

export type GroundSpec = { id: GroundId; name: string; /** the ground is light (dark text on cards reads either way; affects shadows) */ light: boolean; /** cards are pinned or taped here, not dropped */ wall: boolean };

export const GROUNDS: Record<GroundId, GroundSpec> = {
  'SKC-SRF-GRD-001': { id: 'SKC-SRF-GRD-001', name: 'Wooden desk', light: false, wall: false },
  'SKC-SRF-GRD-002': { id: 'SKC-SRF-GRD-002', name: 'Kitchen table (laminate)', light: true, wall: false },
  'SKC-SRF-GRD-003': { id: 'SKC-SRF-GRD-003', name: 'Painted bedroom wall', light: true, wall: true },
  'SKC-SRF-GRD-004': { id: 'SKC-SRF-GRD-004', name: 'Street wall (painted concrete)', light: false, wall: true },
  'SKC-SRF-GRD-005': { id: 'SKC-SRF-GRD-005', name: 'Notebook spread', light: true, wall: false },
  'SKC-SRF-GRD-006': { id: 'SKC-SRF-GRD-006', name: 'Corkboard', light: false, wall: true },
  'SKC-SRF-GRD-007': { id: 'SKC-SRF-GRD-007', name: 'Plain wall for notes', light: true, wall: true },
  'SKC-SRF-GRD-008': { id: 'SKC-SRF-GRD-008', name: 'Drying line with clips', light: true, wall: true },
  'SKC-SRF-GRD-009': { id: 'SKC-SRF-GRD-009', name: 'Wooden floor', light: false, wall: false },
  'SKC-SRF-GRD-010': { id: 'SKC-SRF-GRD-010', name: 'Black paper', light: false, wall: false },
  'SKC-SRF-GRD-011': { id: 'SKC-SRF-GRD-011', name: 'Bus seat fabric (held cards backdrop, blurred)', light: false, wall: true },
};

// ---- noise -------------------------------------------------------------------------------------------------------------------
function makeNoise(seed: number) {
  const r = rng(seed);
  const N = 256;
  const perm = new Uint8Array(N * 2);
  const vals = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    perm[i] = i;
    vals[i] = r();
  }
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = perm[i]!;
    perm[i] = perm[j]!;
    perm[j] = t;
  }
  for (let i = 0; i < N; i++) perm[N + i] = perm[i]!;
  const at = (x: number, y: number) => vals[perm[(perm[x & 255]! + (y & 255)) & 511]!]!;
  const v = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const u = fx * fx * (3 - 2 * fx);
    const w = fy * fy * (3 - 2 * fy);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  };
  return (x: number, y: number, oct = 4) => {
    let s = 0;
    let amp = 0.5;
    let f = 1;
    for (let o = 0; o < oct; o++) {
      s += v(x * f, y * f) * amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return s;
  };
}
const hex = (c: string): [number, number, number] => {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** per-pixel paint: `f` returns a 0..1 mix between two colours, plus a brightness offset */
function field(cx: CanvasRenderingContext2D, w: number, h: number, a: string, b: string, f: (x: number, y: number) => [number, number]) {
  const img = cx.createImageData(w, h);
  const A = hex(a);
  const B = hex(b);
  const d = img.data;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [t, l] = f(x, y);
      const i = (y * w + x) * 4;
      for (let k = 0; k < 3; k++) d[i + k] = Math.max(0, Math.min(255, A[k]! + (B[k]! - A[k]!) * t + l * 255));
      d[i + 3] = 255;
    }
  cx.putImageData(img, 0, 0);
}

function vignette(cx: CanvasRenderingContext2D, w: number, h: number, amount: number, warm?: { x: number; y: number; color: string }) {
  if (warm) {
    const g = cx.createRadialGradient(warm.x * w, warm.y * h, 0, warm.x * w, warm.y * h, Math.max(w, h) * 0.75);
    g.addColorStop(0, warm.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    cx.globalCompositeOperation = 'soft-light';
    cx.fillStyle = g;
    cx.fillRect(0, 0, w, h);
    cx.globalCompositeOperation = 'source-over';
  }
  const g = cx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${amount})`);
  cx.fillStyle = g;
  cx.fillRect(0, 0, w, h);
}

/**
 * Paint a ground at w x h. `tint` is one colour from the song (walls and laminate take it; wood, cork and paper keep their
 * own material colour, tinted only slightly). `night` darkens and warms the desk for night scenes.
 */
export function paintGround(cx: CanvasRenderingContext2D, id: GroundId, w: number, h: number, seed: number, tint: string, night = false) {
  const n = makeNoise(seed);
  const r = rng(seed ^ 0x5bd1e995);
  const s = Math.max(w, h) / 1000; // features are sized against a 1000 px long side
  switch (id) {
    case 'SKC-SRF-GRD-001':
    case 'SKC-SRF-GRD-009': {
      // planks: long grain lines bent by noise, darker seams, each plank its own tone
      const floor = id === 'SKC-SRF-GRD-009';
      const base = floor ? ['#5a3a25', '#7a5233'] : ['#6b4429', '#9a6a40'];
      const plankH = (floor ? 120 : 210) * s;
      field(cx, w, h, base[0]!, base[1]!, (x, y) => {
        const p = Math.floor(y / plankH);
        const off = (p * 0.37) % 1;
        const g = n(x * 0.004 / s + off * 40, y * 0.06 / s, 3);
        const ring = Math.sin((y * 0.11) / s + n(x * 0.002 / s, p * 3.1, 2) * 18) * 0.5 + 0.5;
        const tone = ((p * 0.618) % 1) * 0.25;
        return [Math.min(1, ring * 0.55 + g * 0.45 + tone - 0.1), (n(x * 0.03, y * 0.03, 2) - 0.5) * 0.04];
      });
      cx.strokeStyle = 'rgba(25,14,8,0.65)';
      cx.lineWidth = Math.max(1, 2.2 * s);
      for (let y = plankH; y < h; y += plankH) {
        cx.beginPath();
        cx.moveTo(0, y + (r() - 0.5) * 2);
        cx.lineTo(w, y + (r() - 0.5) * 2);
        cx.stroke();
        if (floor) {
          // board ends: staggered butt joints
          const x0 = r() * w;
          cx.beginPath();
          cx.moveTo(x0, y - plankH);
          cx.lineTo(x0, y);
          cx.stroke();
        }
      }
      if (night) vignette(cx, w, h, floor ? 0.5 : 0.62, { x: 0.28, y: 0.18, color: 'rgba(255,190,110,0.85)' });
      else vignette(cx, w, h, 0.3, { x: 0.25, y: 0.15, color: 'rgba(255,230,190,0.5)' });
      break;
    }
    case 'SKC-SRF-GRD-002': {
      // laminate: a pale song-tinted surface with fine speckle, a chrome edge band at the bottom
      const base = mix('#efe8da', tint, 0.22);
      field(cx, w, h, base, mix(base, '#000000', 0.08), (x, y) => [n(x * 0.01 / s, y * 0.01 / s, 2), 0]);
      for (let i = 0; i < (w * h) / 900; i++) {
        cx.fillStyle = r() > 0.5 ? 'rgba(60,50,40,0.18)' : 'rgba(255,255,255,0.35)';
        cx.fillRect(r() * w, r() * h, 1.6 * s, 1.6 * s);
      }
      const g = cx.createLinearGradient(0, h - 40 * s, 0, h);
      g.addColorStop(0, '#c9cdd2');
      g.addColorStop(0.5, '#f5f7f8');
      g.addColorStop(1, '#9aa0a6');
      cx.fillStyle = g;
      cx.fillRect(0, h - 40 * s, w, 40 * s);
      vignette(cx, w, h, 0.18, { x: 0.6, y: 0.1, color: 'rgba(255,250,235,0.6)' });
      break;
    }
    case 'SKC-SRF-GRD-003':
    case 'SKC-SRF-GRD-007': {
      // painted plaster: roller marks (soft vertical streaks), a faint light falloff
      const base = id === 'SKC-SRF-GRD-003' ? mix(tint, '#f3ece4', 0.55) : mix('#ece8e0', tint, 0.08);
      field(cx, w, h, base, mix(base, '#000000', 0.1), (x, y) => [n(x * 0.02 / s, y * 0.0025 / s, 3) * 0.7 + n(x * 0.2, y * 0.2, 1) * 0.3, 0]);
      vignette(cx, w, h, 0.22, { x: 0.3, y: 0.0, color: 'rgba(255,245,225,0.5)' });
      break;
    }
    case 'SKC-SRF-GRD-004': {
      // concrete with paint over it: blotchy, stained, scraps of old pasted paper torn off
      const base = mix('#8d8a84', tint, 0.15);
      field(cx, w, h, mix(base, '#000000', 0.25), base, (x, y) => {
        const blot = n(x * 0.004 / s, y * 0.004 / s, 5);
        const pit = n(x * 0.15, y * 0.15, 1) > 0.82 ? -0.08 : 0;
        return [blot, pit];
      });
      // remnants of old pasted posters: torn rectangles, some with a band of faded print still on them
      for (let i = 0; i < 18; i++) {
        const x = r() * w;
        const y = r() * h;
        const ww = (60 + r() * 220) * s;
        const hh = (50 + r() * 200) * s;
        cx.save();
        cx.translate(x, y);
        cx.rotate((r() - 0.5) * 0.08);
        cx.beginPath();
        const edge = (x0: number, y0: number, x1: number, y1: number) => {
          const n = 10;
          for (let k = 0; k <= n; k++) {
            const t = k / n;
            cx.lineTo(x0 + (x1 - x0) * t + (r() - 0.5) * 7 * s, y0 + (y1 - y0) * t + (r() - 0.5) * 7 * s);
          }
        };
        edge(0, 0, ww, 0);
        edge(ww, 0, ww, hh);
        edge(ww, hh, 0, hh);
        edge(0, hh, 0, 0);
        cx.closePath();
        const paper = r() > 0.35 ? 'rgba(232,226,210,0.62)' : mix(tint, '#ffffff', 0.45) + '99';
        cx.fillStyle = paper;
        cx.fill();
        cx.clip();
        if (r() > 0.4) {
          cx.fillStyle = r() > 0.5 ? 'rgba(30,30,30,0.28)' : mix(tint, '#000000', 0.2) + '55';
          for (let k = 0; k < 3; k++) cx.fillRect(ww * 0.1, hh * (0.15 + k * 0.22), ww * (0.5 + r() * 0.4), hh * 0.1);
        }
        cx.restore();
      }
      // drips of old paint
      cx.strokeStyle = 'rgba(30,28,26,0.25)';
      for (let i = 0; i < 12; i++) {
        const x = r() * w;
        cx.lineWidth = (1 + r() * 3) * s;
        cx.beginPath();
        cx.moveTo(x, r() * h * 0.3);
        cx.lineTo(x + (r() - 0.5) * 4, h * (0.4 + r() * 0.6));
        cx.stroke();
      }
      vignette(cx, w, h, 0.45);
      break;
    }
    case 'SKC-SRF-GRD-005': {
      // an open notebook filling the frame: two pages, gutter shadow, ruled lines, red margin on each page
      cx.fillStyle = '#3d3a40';
      cx.fillRect(0, 0, w, h);
      const m = 18 * s;
      const pg = '#f7f4ea';
      field(cx, w, h, pg, mix(pg, '#000000', 0.06), (x, y) => [n(x * 0.05, y * 0.05, 2), 0]);
      cx.fillStyle = 'rgba(0,0,0,0)';
      const rule = 34 * s;
      cx.strokeStyle = 'rgba(80,130,200,0.45)';
      cx.lineWidth = Math.max(1, 1.4 * s);
      for (let y = 90 * s; y < h - m; y += rule) {
        cx.beginPath();
        cx.moveTo(m, y);
        cx.lineTo(w - m, y);
        cx.stroke();
      }
      cx.strokeStyle = 'rgba(210,70,70,0.6)';
      for (const x of [w * 0.08, w * 0.58]) {
        cx.beginPath();
        cx.moveTo(x, 0);
        cx.lineTo(x, h);
        cx.stroke();
      }
      const g = cx.createLinearGradient(w / 2 - 60 * s, 0, w / 2 + 60 * s, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.28)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = g;
      cx.fillRect(w / 2 - 60 * s, 0, 120 * s, h);
      // highlighter swipes left on the pages by an earlier hand
      cx.fillStyle = mix(tint, '#fff36b', 0.5) + '55';
      for (let i = 0; i < 3; i++) cx.fillRect(w * (0.12 + r() * 0.7), 90 * s + rule * Math.floor(r() * 12) - rule * 0.7, (80 + r() * 160) * s, rule * 0.6);
      vignette(cx, w, h, 0.2);
      break;
    }
    case 'SKC-SRF-GRD-006': {
      // cork: warm granules, a pine frame
      field(cx, w, h, '#a5713f', '#d3a06a', (x, y) => {
        const g = n(x * 0.12 / s, y * 0.12 / s, 2);
        const fine = n(x * 0.6, y * 0.6, 1);
        return [g * 0.6 + fine * 0.4, fine > 0.78 ? -0.12 : 0];
      });
      const fw = 34 * s;
      cx.fillStyle = '#c9a26c';
      cx.fillRect(0, 0, w, fw);
      cx.fillRect(0, h - fw, w, fw);
      cx.fillRect(0, 0, fw, h);
      cx.fillRect(w - fw, 0, fw, h);
      cx.strokeStyle = 'rgba(80,50,20,0.5)';
      cx.lineWidth = 2 * s;
      cx.strokeRect(fw, fw, w - fw * 2, h - fw * 2);
      vignette(cx, w, h, 0.3);
      break;
    }
    case 'SKC-SRF-GRD-008': {
      // a pale studio wall with a cotton line strung across the top third
      const base = mix('#e9e4da', tint, 0.1);
      field(cx, w, h, base, mix(base, '#000000', 0.08), (x, y) => [n(x * 0.01 / s, y * 0.004 / s, 3), 0]);
      cx.strokeStyle = '#5a524a';
      cx.lineWidth = Math.max(1.2, 2.4 * s);
      cx.beginPath();
      cx.moveTo(0, h * 0.12);
      cx.quadraticCurveTo(w / 2, h * 0.2, w, h * 0.12);
      cx.stroke();
      vignette(cx, w, h, 0.2, { x: 0.5, y: 0, color: 'rgba(255,250,240,0.4)' });
      break;
    }
    case 'SKC-SRF-GRD-010': {
      // black paper: a little fibre and tooth so it is paper, not a void
      field(cx, w, h, '#0f0e10', '#1f1d21', (x, y) => [n(x * 0.02 / s, y * 0.02 / s, 4) * 0.6 + n(x * 0.5, y * 0.5, 1) * 0.4, 0]);
      cx.strokeStyle = 'rgba(255,255,255,0.035)';
      cx.lineWidth = 1;
      for (let i = 0; i < 400; i++) {
        const x = r() * w;
        const y = r() * h;
        const a = r() * Math.PI;
        const l = (6 + r() * 20) * s;
        cx.beginPath();
        cx.moveTo(x, y);
        cx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        cx.stroke();
      }
      vignette(cx, w, h, 0.5);
      break;
    }
    case 'SKC-SRF-GRD-011': {
      // bus-seat moquette: a busy repeat pattern in song colours, thrown out of focus (it is behind a held card)
      const A = mix(tint, '#1c2440', 0.55);
      const B = mix(tint, '#e8c25a', 0.35);
      cx.fillStyle = A;
      cx.fillRect(0, 0, w, h);
      const t = 70 * s;
      for (let y = 0; y < h + t; y += t)
        for (let x = 0; x < w + t; x += t) {
          const o = (Math.floor(y / t) % 2) * t * 0.5;
          cx.fillStyle = B;
          cx.beginPath();
          cx.moveTo(x + o, y - t * 0.3);
          cx.lineTo(x + o + t * 0.3, y);
          cx.lineTo(x + o, y + t * 0.3);
          cx.lineTo(x + o - t * 0.3, y);
          cx.closePath();
          cx.fill();
          cx.fillStyle = mix(A, '#c0392b', 0.4);
          cx.fillRect(x + o + t * 0.4, y + t * 0.35, t * 0.18, t * 0.18);
        }
      cx.filter = `blur(${Math.round(9 * s)}px)`;
      cx.drawImage(cx.canvas, 0, 0);
      cx.filter = 'none';
      vignette(cx, w, h, 0.5);
      break;
    }
  }
}
