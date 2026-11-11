// CVP-CAM-CRP-001..012: crop and pan paths over the cover. A crop is a point of the cover (u, v in 0..1) put at the middle of
// the frame and a zoom (1 = the cover just covers the frame). The cover is only cropped and scaled, never rotated or altered
// (artwork rule). Paths are functions of progress through a section, so a frame at any time is the same.

import type { CoverReading } from './analysis';
import { N } from './analysis';

export type Crop = { u: number; v: number; z: number };
export type CropPathId = `CVP-CAM-CRP-0${'01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12'}`;
export const CROP_PATHS: CropPathId[] = Array.from({ length: 12 }, (_, i) => `CVP-CAM-CRP-${String(i + 1).padStart(3, '0')}` as CropPathId);

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** the busiest point (a detail worth touring) and the emptiest point, from the reading */
function points(r: CoverReading | null) {
  if (!r) return { detail: { x: 0.5, y: 0.45 }, empty: { x: 0.5, y: 0.2 }, second: { x: 0.3, y: 0.7 } };
  let dBest = -1;
  let eBest = -1;
  let detail = { x: 0.5, y: 0.5 };
  let empty = { x: 0.5, y: 0.5 };
  let second = { x: 0.3, y: 0.7 };
  let sBest = -1;
  for (let y = 4; y < N - 4; y += 2)
    for (let x = 4; x < N - 4; x += 2) {
      const i = y * N + x;
      const d = r.edge[i]! + r.variance[i]!;
      const e = r.empty[i]!;
      if (d > dBest) {
        dBest = d;
        detail = { x: (x + 0.5) / N, y: (y + 0.5) / N };
      }
      if (e > eBest) {
        eBest = e;
        empty = { x: (x + 0.5) / N, y: (y + 0.5) / N };
      }
    }
  // a second detail far from the first (for the two-region cut)
  for (let y = 4; y < N - 4; y += 3)
    for (let x = 4; x < N - 4; x += 3) {
      const far = Math.hypot((x + 0.5) / N - detail.x, (y + 0.5) / N - detail.y);
      if (far < 0.35) continue;
      const d = r.edge[y * N + x]! + r.variance[y * N + x]!;
      if (d > sBest) {
        sBest = d;
        second = { x: (x + 0.5) / N, y: (y + 0.5) / N };
      }
    }
  return { detail, empty, second };
}

/** the crop at progress `p` (0..1) of a path; `reduced` = static crops (cuts only, no motion) */
export function cropAt(id: CropPathId, r: CoverReading | null, p: number, reduced: boolean): Crop {
  if (reduced) p = 0.25; // one still crop per section; changes are cuts
  const t = reduced ? 0.5 : ease(Math.max(0, Math.min(1, p)));
  const { detail, empty, second } = points(r);
  const bright = r?.brightest ?? { x: 0.5, y: 0.5 };
  switch (id) {
    case 'CVP-CAM-CRP-001':
      return { u: 0.5, v: 0.5, z: lerp(1, 1.18, t) };
    case 'CVP-CAM-CRP-002':
      return { u: lerp(0.5, bright.x, t), v: lerp(0.5, bright.y, t), z: lerp(1.05, 1.7, t) };
    case 'CVP-CAM-CRP-003':
      return { u: lerp(0.25, 0.75, t), v: 0.5, z: 1.6 };
    case 'CVP-CAM-CRP-004':
      return { u: 0.5, v: lerp(0.25, 0.75, t), z: 1.6 };
    case 'CVP-CAM-CRP-005':
      return { u: lerp(0.3, 0.7, t), v: lerp(0.3, 0.7, t), z: 1.5 };
    case 'CVP-CAM-CRP-006': {
      // saliency hop: a cut between the two details half way (no motion in between)
      const a = p < 0.5 ? detail : second;
      return { u: a.x, v: a.y, z: 2.0 };
    }
    case 'CVP-CAM-CRP-007':
      return { u: lerp(detail.x, 0.5, t), v: lerp(detail.y, 0.5, t), z: lerp(2.4, 1.05, t) };
    case 'CVP-CAM-CRP-008': {
      // along the border: top edge left to right, then down the right side
      const k = t * 2;
      return k < 1 ? { u: lerp(0.22, 0.78, k), v: 0.22, z: 2.2 } : { u: 0.78, v: lerp(0.22, 0.78, k - 1), z: 2.2 };
    }
    case 'CVP-CAM-CRP-009':
      return { u: lerp(0.5, empty.x, t), v: lerp(0.5, empty.y, t), z: lerp(1.0, 1.9, t) };
    case 'CVP-CAM-CRP-010': {
      const a = p < 0.5 ? detail : second;
      return { u: a.x, v: a.y, z: lerp(1.8, 2.0, (p * 2) % 1) };
    }
    case 'CVP-CAM-CRP-011': {
      const a = Math.PI * (0.15 + t * 0.7);
      return { u: 0.5 - Math.cos(a) * 0.28, v: 0.62 - Math.sin(a) * 0.22, z: 1.7 };
    }
    default:
      // tilt up: bottom to top
      return { u: 0.5, v: lerp(0.75, 0.25, t), z: 1.6 };
  }
}

/** keep the crop's window on the cover (the cover must still cover the frame) */
export function clampCrop(c: Crop, W: number, H: number): Crop {
  // the cover side in frame px at z = 1 covers the larger frame side
  const side = Math.max(W, H) * c.z;
  const hu = W / 2 / side;
  const hv = H / 2 / side;
  return { u: Math.min(1 - hu, Math.max(hu, c.u)), v: Math.min(1 - hv, Math.max(hv, c.v)), z: c.z };
}

/** frame px -> cover uv under a crop, and the window of the cover visible */
export function visibleBox(c: Crop, W: number, H: number) {
  const side = Math.max(W, H) * c.z;
  return { x: c.u - W / 2 / side, y: c.v - H / 2 / side, w: W / side, h: H / side, side };
}
