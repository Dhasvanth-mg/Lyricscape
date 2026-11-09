// Original vector motifs drawn with canvas paths (no images, no generated art).
// Every shape is centred on (0,0) and fits roughly inside a circle of radius `r`.

import type { MotifId } from './emotion';

export type DoodlePaint = { fill: string | null; stroke: string | null; lineWidth: number; accent?: string };

const TAU = Math.PI * 2;

function paint(ctx: CanvasRenderingContext2D, p: DoodlePaint, closed = true) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (p.fill && closed) {
    ctx.fillStyle = p.fill;
    ctx.fill();
  }
  if (p.stroke) {
    ctx.strokeStyle = p.stroke;
    ctx.lineWidth = p.lineWidth;
    ctx.stroke();
  }
}

function polygon(ctx: CanvasRenderingContext2D, pts: [number, number][]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/** Deterministic wobble so "hand-drawn" shapes don't change from frame to frame. */
const wob = (i: number, seed: number) => Math.sin(i * 12.9898 + seed * 78.233) * 0.5 + 0.5;

export const DRAWERS: Record<MotifId, (ctx: CanvasRenderingContext2D, r: number, p: DoodlePaint, seed: number) => void> = {
  star(ctx, r, p) {
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      const rad = i % 2 ? r * 0.42 : r;
      pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
    }
    polygon(ctx, pts);
    paint(ctx, p);
  },

  sparkle(ctx, r, p) {
    // four-point star with curved sides
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(r * 0.12, -r * 0.12, r, 0);
    ctx.quadraticCurveTo(r * 0.12, r * 0.12, 0, r);
    ctx.quadraticCurveTo(-r * 0.12, r * 0.12, -r, 0);
    ctx.quadraticCurveTo(-r * 0.12, -r * 0.12, 0, -r);
    ctx.closePath();
    paint(ctx, p);
  },

  heart(ctx, r, p) {
    ctx.beginPath();
    ctx.moveTo(0, r * 0.85);
    ctx.bezierCurveTo(-r * 1.25, r * 0.1, -r * 0.7, -r * 0.95, 0, -r * 0.35);
    ctx.bezierCurveTo(r * 0.7, -r * 0.95, r * 1.25, r * 0.1, 0, r * 0.85);
    ctx.closePath();
    paint(ctx, p);
  },

  bolt(ctx, r, p) {
    polygon(ctx, [
      [r * 0.15, -r],
      [-r * 0.6, r * 0.15],
      [-r * 0.08, r * 0.15],
      [-r * 0.28, r],
      [r * 0.6, -r * 0.2],
      [r * 0.05, -r * 0.2],
    ]);
    paint(ctx, p);
  },

  ring(ctx, r, p) {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.9, 0, TAU);
    ctx.arc(0, 0, r * 0.48, 0, TAU, true);
    paint(ctx, { ...p, fill: p.fill });
    if (!p.fill && p.stroke) {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.9, 0, TAU);
      ctx.stroke();
    }
  },

  wave(ctx, r, p) {
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const x = -r + (2 * r * i) / 24;
      const y = Math.sin((i / 24) * Math.PI * 4) * r * 0.32;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = p.stroke ?? p.fill ?? '#fff';
    ctx.lineWidth = Math.max(p.lineWidth, r * 0.16);
    ctx.lineCap = 'round';
    ctx.stroke();
  },

  cloud(ctx, r, p) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.7, r * 0.45);
    ctx.arc(-r * 0.62, r * 0.12, r * 0.33, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(-r * 0.2, -r * 0.2, r * 0.45, Math.PI, Math.PI * 1.95);
    ctx.arc(r * 0.38, -r * 0.02, r * 0.38, Math.PI * 1.45, Math.PI * 0.5);
    ctx.closePath();
    paint(ctx, p);
  },

  sun(ctx, r, p) {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.45, 0, TAU);
    paint(ctx, p);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i * TAU) / 10;
      ctx.moveTo(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62);
      ctx.lineTo(Math.cos(a) * r * (i % 2 ? 0.88 : 1), Math.sin(a) * r * (i % 2 ? 0.88 : 1));
    }
    ctx.strokeStyle = p.stroke ?? p.fill ?? '#fff';
    ctx.lineWidth = Math.max(p.lineWidth, r * 0.12);
    ctx.lineCap = 'round';
    ctx.stroke();
  },

  rain(ctx, r, p) {
    ctx.strokeStyle = p.stroke ?? p.fill ?? '#fff';
    ctx.lineWidth = Math.max(p.lineWidth, r * 0.1);
    ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * r * 0.55 + r * 0.15, -r * 0.7 + (i % 2) * r * 0.25);
      ctx.lineTo(i * r * 0.55 - r * 0.15, r * 0.1 + (i % 2) * r * 0.25);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, r * 0.45);
    ctx.bezierCurveTo(r * 0.28, r * 0.75, r * 0.2, r, 0, r);
    ctx.bezierCurveTo(-r * 0.2, r, -r * 0.28, r * 0.75, 0, r * 0.45);
    ctx.closePath();
    paint(ctx, p);
  },

  flame(ctx, r, p) {
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.bezierCurveTo(r * 0.2, -r * 0.5, r * 0.85, -r * 0.1, r * 0.55, r * 0.55);
    ctx.bezierCurveTo(r * 0.4, r * 0.95, -r * 0.4, r * 0.95, -r * 0.55, r * 0.5);
    ctx.bezierCurveTo(-r * 0.75, -r * 0.05, -r * 0.1, -r * 0.35, 0, -r);
    ctx.closePath();
    paint(ctx, p);
    if (p.accent) {
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.1);
      ctx.bezierCurveTo(r * 0.3, r * 0.2, r * 0.3, r * 0.65, 0, r * 0.7);
      ctx.bezierCurveTo(-r * 0.3, r * 0.65, -r * 0.3, r * 0.2, 0, -r * 0.1);
      ctx.fillStyle = p.accent;
      ctx.fill();
    }
  },

  spiral(ctx, r, p) {
    ctx.beginPath();
    for (let i = 0; i <= 70; i++) {
      const t = i / 70;
      const a = t * Math.PI * 5;
      const rad = r * (0.08 + 0.92 * t);
      const x = Math.cos(a) * rad;
      const y = Math.sin(a) * rad;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = p.stroke ?? p.fill ?? '#fff';
    ctx.lineWidth = Math.max(p.lineWidth, r * 0.1);
    ctx.lineCap = 'round';
    ctx.stroke();
  },

  zigzag(ctx, r, p) {
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const x = -r + (2 * r * i) / 6;
      const y = (i % 2 ? 1 : -1) * r * 0.38;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = p.stroke ?? p.fill ?? '#fff';
    ctx.lineWidth = Math.max(p.lineWidth, r * 0.16);
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'butt';
    ctx.stroke();
  },

  burst(ctx, r, p, seed) {
    // comic-book impact star
    const n = 14;
    const pts: [number, number][] = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (i * Math.PI) / n;
      const rad = i % 2 ? r * 0.55 : r * (0.85 + wob(i, seed) * 0.15);
      pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
    }
    polygon(ctx, pts);
    paint(ctx, p);
  },

  flower(ctx, r, p) {
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate((i * TAU) / 6);
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.55, r * 0.26, r * 0.42, 0, 0, TAU);
      paint(ctx, p);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.22, 0, TAU);
    ctx.fillStyle = p.accent ?? p.stroke ?? '#fff';
    ctx.fill();
  },

  moon(ctx, r, p) {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.85, Math.PI * 0.2, Math.PI * 1.8, false);
    ctx.arc(r * 0.3, -r * 0.05, r * 0.68, Math.PI * 1.7, Math.PI * 0.3, true);
    ctx.closePath();
    paint(ctx, p);
  },

  note(ctx, r, p) {
    ctx.beginPath();
    ctx.ellipse(-r * 0.3, r * 0.6, r * 0.34, r * 0.25, -0.4, 0, TAU);
    paint(ctx, p);
    ctx.beginPath();
    ctx.moveTo(-r * 0.04, r * 0.52);
    ctx.lineTo(-r * 0.04, -r * 0.85);
    ctx.bezierCurveTo(r * 0.1, -r * 0.5, r * 0.7, -r * 0.55, r * 0.5, -r * 0.05);
    ctx.strokeStyle = p.stroke ?? p.fill ?? '#fff';
    ctx.lineWidth = Math.max(p.lineWidth, r * 0.13);
    ctx.lineCap = 'round';
    ctx.stroke();
  },

  blob(ctx, r, p, seed) {
    const n = 9;
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const a = (i * TAU) / n;
      const rad = r * (0.62 + wob(i, seed) * 0.38);
      pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
    }
    ctx.beginPath();
    const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const start = mid(pts[n - 1]!, pts[0]!);
    ctx.moveTo(start[0], start[1]);
    for (let i = 0; i < n; i++) {
      const m = mid(pts[i]!, pts[(i + 1) % n]!);
      ctx.quadraticCurveTo(pts[i]![0], pts[i]![1], m[0], m[1]);
    }
    ctx.closePath();
    paint(ctx, p);
  },

  squiggle(ctx, r, p, seed) {
    ctx.beginPath();
    for (let i = 0; i <= 30; i++) {
      const t = i / 30;
      const x = -r + 2 * r * t;
      const y = Math.sin(t * Math.PI * 3 + seed) * r * 0.4 * (0.6 + wob(i, seed) * 0.5);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = p.stroke ?? p.fill ?? '#fff';
    ctx.lineWidth = Math.max(p.lineWidth, r * 0.12);
    ctx.lineCap = 'round';
    ctx.stroke();
  },
};

// ---- variants -------------------------------------------------------------------------------------------------------------------
// Each doodle is drawn in one of 10 treatments with one of 6 ornaments, picked from its seed: 18 motifs x 10 x 6 = 1080 looks,
// the same one every time for the same seed (layout and export stay deterministic).
export const DOODLE_TREATMENTS = ['solid', 'outline', 'sticker', 'echo', 'sketchy', 'shadow', 'squash', 'dotted', 'mono', 'tall'] as const;
export const DOODLE_ORNAMENTS = ['none', 'orbit', 'sparkles', 'motion', 'halo', 'confetti'] as const;
export type DoodleTreatment = (typeof DOODLE_TREATMENTS)[number];
export type DoodleOrnament = (typeof DOODLE_ORNAMENTS)[number];

export function doodleVariant(seed: number): { treatment: DoodleTreatment; ornament: DoodleOrnament } {
  const h = Math.imul((seed | 0) ^ 0x5bd1e995, 0x27d4eb2d) >>> 0;
  return { treatment: DOODLE_TREATMENTS[h % DOODLE_TREATMENTS.length]!, ornament: DOODLE_ORNAMENTS[(h >>> 8) % DOODLE_ORNAMENTS.length]! };
}

function ornament(ctx: CanvasRenderingContext2D, kind: DoodleOrnament, r: number, color: string, seed: number) {
  if (kind === 'none') return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.2, r * 0.06);
  const a0 = wob(1, seed) * TAU;
  if (kind === 'orbit') {
    for (let i = 0; i < 3; i++) {
      const a = a0 + (i * TAU) / 3;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 1.22, Math.sin(a) * r * 1.22, r * (0.07 + i * 0.025), 0, TAU);
      ctx.fill();
    }
  } else if (kind === 'sparkles') {
    for (let i = 0; i < 2; i++) {
      const a = a0 + i * 2.4;
      ctx.save();
      ctx.translate(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2);
      DRAWERS.sparkle(ctx, r * (0.2 - i * 0.06), { fill: color, stroke: null, lineWidth: 0 }, seed);
      ctx.restore();
    }
  } else if (kind === 'motion') {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(-r * 1.15, i * r * 0.35);
      ctx.lineTo(-r * (1.5 + Math.abs(i) * -0.15), i * r * 0.35);
      ctx.stroke();
    }
  } else if (kind === 'halo') {
    ctx.globalAlpha *= 0.6;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.3, 0, TAU);
    ctx.stroke();
  } else if (kind === 'confetti') {
    for (let i = 0; i < 5; i++) {
      const a = a0 + i * 1.3;
      ctx.save();
      ctx.translate(Math.cos(a) * r * (1.15 + wob(i, seed) * 0.2), Math.sin(a) * r * (1.15 + wob(i + 3, seed) * 0.2));
      ctx.rotate(a);
      ctx.fillRect(-r * 0.06, -r * 0.03, r * 0.12, r * 0.06);
      ctx.restore();
    }
  }
  ctx.restore();
}

export function drawDoodle(ctx: CanvasRenderingContext2D, kind: MotifId, r: number, p: DoodlePaint, seed = 1) {
  const draw = DRAWERS[kind];
  const v = doodleVariant(seed);
  const color = p.fill ?? p.stroke ?? '#ffffff';
  ctx.save();
  switch (v.treatment) {
    case 'outline':
      draw(ctx, r, { ...p, fill: null, stroke: color, lineWidth: Math.max(p.lineWidth, r * 0.09) }, seed);
      break;
    case 'sticker':
      draw(ctx, r, { fill: '#ffffff', stroke: '#ffffff', lineWidth: Math.max(4, r * 0.22) }, seed);
      draw(ctx, r, p, seed);
      break;
    case 'echo':
      ctx.save();
      ctx.translate(r * 0.14, r * 0.12);
      ctx.globalAlpha *= 0.45;
      draw(ctx, r, { ...p, fill: p.accent ?? color, stroke: null }, seed);
      ctx.restore();
      draw(ctx, r, p, seed);
      break;
    case 'sketchy':
      draw(ctx, r, p, seed);
      ctx.rotate(0.06);
      ctx.translate(r * 0.04, -r * 0.03);
      draw(ctx, r * 1.02, { fill: null, stroke: p.stroke ?? color, lineWidth: Math.max(1, p.lineWidth * 0.6) }, seed + 1);
      break;
    case 'shadow':
      ctx.save();
      ctx.translate(r * 0.1, r * 0.14);
      draw(ctx, r, { fill: 'rgba(0,0,0,0.32)', stroke: null, lineWidth: 0 }, seed);
      ctx.restore();
      draw(ctx, r, p, seed);
      break;
    case 'squash':
      ctx.scale(1.18, 0.84);
      draw(ctx, r, p, seed);
      break;
    case 'tall':
      ctx.scale(0.86, 1.16);
      draw(ctx, r, p, seed);
      break;
    case 'dotted':
      ctx.setLineDash([Math.max(2, r * 0.12), Math.max(2, r * 0.1)]);
      draw(ctx, r, { ...p, fill: null, stroke: color, lineWidth: Math.max(p.lineWidth, r * 0.08) }, seed);
      break;
    case 'mono':
      draw(ctx, r, { ...p, fill: p.stroke ?? color, stroke: p.fill ?? null }, seed);
      break;
    default:
      draw(ctx, r, p, seed);
  }
  ctx.restore();
  ornament(ctx, v.ornament, r, p.accent ?? color, seed);
}
