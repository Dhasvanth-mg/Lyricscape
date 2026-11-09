// The shared art library: 300+ small drawings made in code (canvas paths, no image files), used by Sketch cards, the doodles of
// every look and Acid grain. Each drawing has an id like `critter-07`; its shape comes from a seed made from that id, so the same
// id always draws the same thing. Families are tagged so a look can ask for drawings that suit the song (love, night, nature...).
//
// Every drawing is centred on (0,0) and fits roughly inside a circle of radius r. Paint is the same as the doodles':
// a fill, a stroke and an accent colour for small details.

import { hashKey, seeded } from '../variety';
import type { DoodlePaint } from '../doodles';

const TAU = Math.PI * 2;
type R = () => number;
type Gen = (c: CanvasRenderingContext2D, r: number, p: DoodlePaint, rnd: R, i: number) => void;

function paint(c: CanvasRenderingContext2D, p: DoodlePaint, closed = true) {
  c.lineJoin = 'round';
  c.lineCap = 'round';
  if (p.fill && closed) {
    c.fillStyle = p.fill;
    c.fill();
  }
  if (p.stroke) {
    c.strokeStyle = p.stroke;
    c.lineWidth = p.lineWidth;
    c.stroke();
  }
}
const ink = (p: DoodlePaint) => p.stroke ?? p.fill ?? '#ffffff';
const acc = (p: DoodlePaint) => p.accent ?? p.stroke ?? p.fill ?? '#ffffff';
function dot(c: CanvasRenderingContext2D, x: number, y: number, rad: number, col: string) {
  c.beginPath();
  c.arc(x, y, Math.max(0.5, rad), 0, TAU);
  c.fillStyle = col;
  c.fill();
}
function line(c: CanvasRenderingContext2D, pts: [number, number][], col: string, w: number) {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.strokeStyle = col;
  c.lineWidth = w;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.stroke();
}
function poly(c: CanvasRenderingContext2D, pts: [number, number][]) {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
}
/** a closed blob through n points around a circle, radius varied by rnd */
function blob(c: CanvasRenderingContext2D, r: number, n: number, rough: number, rnd: R, sx = 1, sy = 1) {
  const pts: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU;
    const rad = r * (1 - rough + rough * 2 * rnd());
    pts.push([Math.cos(a) * rad * sx, Math.sin(a) * rad * sy]);
  }
  c.beginPath();
  for (let k = 0; k <= n; k++) {
    const a = pts[k % n]!;
    const b = pts[(k + 1) % n]!;
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    if (k === 0) c.moveTo(mx, my);
    else c.quadraticCurveTo(a[0], a[1], mx, my);
  }
  c.closePath();
}
function starPath(c: CanvasRenderingContext2D, r: number, n: number, inner: number, rot = -Math.PI / 2) {
  const pts: [number, number][] = [];
  for (let k = 0; k < n * 2; k++) {
    const a = rot + (k * Math.PI) / n;
    const rad = k % 2 ? r * inner : r;
    pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
  }
  poly(c, pts);
}
function heartPath(c: CanvasRenderingContext2D, r: number, fat = 1) {
  c.beginPath();
  c.moveTo(0, r * 0.85);
  c.bezierCurveTo(-r * 1.25 * fat, r * 0.1, -r * 0.7 * fat, -r * 0.95, 0, -r * 0.35);
  c.bezierCurveTo(r * 0.7 * fat, -r * 0.95, r * 1.25 * fat, r * 0.1, 0, r * 0.85);
  c.closePath();
}

// ---- faces: eyes and mouths shared by critters, faces, animals ------------------------------------------------------------------
function eyes(c: CanvasRenderingContext2D, r: number, kind: number, col: string, gap = 0.32, y = -0.1) {
  const ex = r * gap;
  const ey = r * y;
  const s = r * 0.11;
  for (const sx of [-1, 1]) {
    const x = sx * ex;
    switch (kind % 8) {
      case 0:
        dot(c, x, ey, s, col);
        break;
      case 1: // sleepy arcs
        c.beginPath();
        c.arc(x, ey, s * 1.3, 0.15 * Math.PI, 0.85 * Math.PI);
        c.strokeStyle = col;
        c.lineWidth = s * 0.6;
        c.stroke();
        break;
      case 2: // happy arcs
        c.beginPath();
        c.arc(x, ey + s, s * 1.3, 1.15 * Math.PI, 1.85 * Math.PI);
        c.strokeStyle = col;
        c.lineWidth = s * 0.6;
        c.stroke();
        break;
      case 3: // big with a shine
        dot(c, x, ey, s * 1.6, col);
        dot(c, x - s * 0.5, ey - s * 0.5, s * 0.5, '#ffffff');
        break;
      case 4: // crosses
        line(c, [[x - s, ey - s], [x + s, ey + s]], col, s * 0.5);
        line(c, [[x + s, ey - s], [x - s, ey + s]], col, s * 0.5);
        break;
      case 5: // tall ovals
        c.beginPath();
        c.ellipse(x, ey, s * 0.7, s * 1.5, 0, 0, TAU);
        c.fillStyle = col;
        c.fill();
        break;
      case 6: // star eyes
        c.save();
        c.translate(x, ey);
        starPath(c, s * 1.6, 5, 0.45);
        c.fillStyle = col;
        c.fill();
        c.restore();
        break;
      default: // wink: one dot, one line
        if (sx < 0) dot(c, x, ey, s, col);
        else line(c, [[x - s, ey], [x + s, ey]], col, s * 0.6);
    }
  }
}
function mouth(c: CanvasRenderingContext2D, r: number, kind: number, col: string, y = 0.22) {
  const my = r * y;
  const w = r * 0.22;
  c.strokeStyle = col;
  c.fillStyle = col;
  c.lineWidth = r * 0.06;
  c.lineCap = 'round';
  c.beginPath();
  switch (kind % 7) {
    case 0:
      c.arc(0, my - w * 0.4, w, 0.2 * Math.PI, 0.8 * Math.PI);
      c.stroke();
      break;
    case 1: // open
      c.ellipse(0, my, w * 0.45, w * 0.6, 0, 0, TAU);
      c.fill();
      break;
    case 2: // flat
      c.moveTo(-w * 0.7, my);
      c.lineTo(w * 0.7, my);
      c.stroke();
      break;
    case 3: // cat mouth
      c.arc(-w * 0.35, my, w * 0.35, 0, Math.PI);
      c.moveTo(w * 0.7, my);
      c.arc(w * 0.35, my, w * 0.35, 0, Math.PI);
      c.stroke();
      break;
    case 4: // grin
      c.arc(0, my - w * 0.2, w * 1.1, 0.1 * Math.PI, 0.9 * Math.PI);
      c.closePath();
      c.fill();
      break;
    case 5: // tongue out
      c.arc(0, my - w * 0.4, w, 0.2 * Math.PI, 0.8 * Math.PI);
      c.stroke();
      c.beginPath();
      c.ellipse(w * 0.2, my + w * 0.45, w * 0.28, w * 0.35, 0, 0, TAU);
      c.fillStyle = '#ff6b8a';
      c.fill();
      break;
    default: // little o
      c.arc(0, my, w * 0.25, 0, TAU);
      c.stroke();
  }
}

// ---- the families -------------------------------------------------------------------------------------------------------------------
const critter: Gen = (c, r, p, rnd, i) => {
  const body = i % 6;
  const R0 = r * 0.82;
  if (body === 0) blob(c, R0, 9, 0.12, rnd);
  else if (body === 1) {
    c.beginPath();
    c.ellipse(0, r * 0.08, R0, R0 * 0.78, 0, 0, TAU);
  } else if (body === 2) {
    // drop / ghost
    c.beginPath();
    c.moveTo(-R0 * 0.8, R0 * 0.8);
    c.lineTo(-R0 * 0.8, 0);
    c.arc(0, 0, R0 * 0.8, Math.PI, 0);
    c.lineTo(R0 * 0.8, R0 * 0.8);
    for (let k = 0; k < 4; k++) c.quadraticCurveTo(R0 * (0.6 - k * 0.4), R0 * (k % 2 ? 0.95 : 0.6), R0 * (0.4 - k * 0.4), R0 * 0.8);
    c.closePath();
  } else if (body === 3) {
    c.beginPath();
    c.roundRect(-R0 * 0.85, -R0 * 0.75, R0 * 1.7, R0 * 1.5, R0 * 0.45);
  } else if (body === 4) starPath(c, R0, 5 + Math.floor(rnd() * 3), 0.72);
  else blob(c, R0, 14, 0.06, rnd, 1.1, 0.85);
  paint(c, p);
  const col = ink(p) === p.fill ? '#1a1a1a' : ink(p);
  // ears / antennae / horns
  const top = Math.floor(rnd() * 5);
  if (top === 1) for (const sx of [-1, 1]) line(c, [[sx * r * 0.25, -R0 * 0.7], [sx * r * 0.45, -r * 1.05]], col, r * 0.05), dot(c, sx * r * 0.45, -r * 1.05, r * 0.08, acc(p));
  if (top === 2)
    for (const sx of [-1, 1]) {
      poly(c, [[sx * r * 0.2, -R0 * 0.75], [sx * r * 0.55, -R0 * 0.6], [sx * r * 0.5, -r * 1.05]]);
      paint(c, p);
    }
  if (top === 3) for (const sx of [-1, 1]) dot(c, sx * r * 0.55, -R0 * 0.62, r * 0.18, p.fill ?? col);
  eyes(c, r, Math.floor(rnd() * 8), col);
  mouth(c, r, Math.floor(rnd() * 7), col);
  if (rnd() < 0.5) for (const sx of [-1, 1]) dot(c, sx * r * 0.5, r * 0.12, r * 0.1, 'rgba(255,120,150,0.55)');
};

const face: Gen = (c, r, p, rnd, i) => {
  const head = i % 5;
  if (head === 0) {
    c.beginPath();
    c.arc(0, 0, r * 0.9, 0, TAU);
  } else if (head === 1) {
    c.beginPath();
    c.roundRect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7, r * 0.3);
  } else if (head === 2) {
    c.beginPath();
    c.ellipse(0, 0, r * 0.75, r * 0.95, 0, 0, TAU);
  } else if (head === 3) {
    poly(c, Array.from({ length: 6 }, (_, k) => [Math.cos((k / 6) * TAU) * r * 0.9, Math.sin((k / 6) * TAU) * r * 0.9] as [number, number]));
  } else blob(c, r * 0.88, 8, 0.1, rnd);
  paint(c, p);
  const col = p.stroke && p.fill ? p.stroke : '#1a1a1a';
  eyes(c, r, i + Math.floor(rnd() * 3), col, 0.34, -0.15);
  mouth(c, r, Math.floor(i / 5) + Math.floor(rnd() * 2), col, 0.3);
  if (rnd() < 0.3) {
    // shades
    c.fillStyle = col;
    c.beginPath();
    c.roundRect(-r * 0.65, -r * 0.3, r * 0.55, r * 0.28, r * 0.08);
    c.roundRect(r * 0.1, -r * 0.3, r * 0.55, r * 0.28, r * 0.08);
    c.fill();
  }
};

const flower: Gen = (c, r, p, rnd, i) => {
  const n = 4 + (i % 6);
  const shape = Math.floor(i / 6) % 5;
  const layers = rnd() < 0.4 ? 2 : 1;
  for (let L = layers; L >= 1; L--) {
    const rr = r * (L === 2 ? 1 : 0.95) * (L === 2 ? 1 : layers === 2 ? 0.7 : 1);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU + (L === 2 ? Math.PI / n : 0);
      c.save();
      c.rotate(a);
      c.beginPath();
      if (shape === 0) c.ellipse(rr * 0.5, 0, rr * 0.45, rr * 0.22, 0, 0, TAU);
      else if (shape === 1) {
        c.moveTo(0, 0);
        c.quadraticCurveTo(rr * 0.5, -rr * 0.4, rr, 0);
        c.quadraticCurveTo(rr * 0.5, rr * 0.4, 0, 0);
      } else if (shape === 2) c.arc(rr * 0.6, 0, rr * 0.32, 0, TAU);
      else if (shape === 3) {
        c.moveTo(0, 0);
        c.lineTo(rr * 0.8, -rr * 0.25);
        c.lineTo(rr, 0);
        c.lineTo(rr * 0.8, rr * 0.25);
      } else {
        c.moveTo(0, 0);
        c.bezierCurveTo(rr * 0.4, -rr * 0.55, rr * 1.1, -rr * 0.3, rr * 0.85, 0);
        c.bezierCurveTo(rr * 1.1, rr * 0.3, rr * 0.4, rr * 0.55, 0, 0);
      }
      c.closePath();
      c.restore();
      paint(c, L === 2 ? { ...p, fill: acc(p) } : p);
    }
  }
  c.beginPath();
  c.arc(0, 0, r * 0.2, 0, TAU);
  paint(c, { ...p, fill: acc(p) === p.fill ? '#ffd43b' : acc(p) });
  if (rnd() < 0.5) for (let k = 0; k < 6; k++) dot(c, Math.cos(k) * r * 0.1, Math.sin(k) * r * 0.1, r * 0.025, ink(p));
};

const plant: Gen = (c, r, p, rnd, i) => {
  const kind = i % 5;
  const col = ink(p);
  if (kind === 0) {
    // a single leaf with veins
    c.beginPath();
    c.moveTo(0, r);
    c.bezierCurveTo(-r * 0.9, r * 0.2, -r * 0.5, -r * 0.8, 0, -r);
    c.bezierCurveTo(r * 0.5, -r * 0.8, r * 0.9, r * 0.2, 0, r);
    paint(c, p);
    line(c, [[0, r], [0, -r * 0.8]], col, r * 0.04);
    for (let k = 1; k < 4; k++) for (const sx of [-1, 1]) line(c, [[0, r - k * r * 0.45], [sx * r * 0.35, r - k * r * 0.45 - r * 0.25]], col, r * 0.03);
  } else if (kind === 1) {
    // sprig
    line(c, [[0, r], [0, -r * 0.9]], col, r * 0.05);
    const n = 3 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++)
      for (const sx of [-1, 1]) {
        const y = r * 0.7 - (k * r * 1.5) / n;
        c.beginPath();
        c.ellipse(sx * r * 0.22, y, r * 0.22, r * 0.1, sx * -0.5, 0, TAU);
        paint(c, p);
      }
  } else if (kind === 2) {
    // cactus
    c.beginPath();
    c.roundRect(-r * 0.22, -r * 0.85, r * 0.44, r * 1.7, r * 0.22);
    c.roundRect(-r * 0.72, -r * 0.35, r * 0.3, r * 0.6, r * 0.15);
    c.roundRect(r * 0.42, -r * 0.55, r * 0.3, r * 0.55, r * 0.15);
    paint(c, p);
    c.beginPath();
    c.rect(-r * 0.6, -r * 0.05, r * 0.4, r * 0.18);
    c.rect(r * 0.2, -r * 0.2, r * 0.4, r * 0.18);
    paint(c, p);
  } else if (kind === 3) {
    // potted plant
    c.beginPath();
    c.moveTo(-r * 0.45, r * 0.25);
    c.lineTo(r * 0.45, r * 0.25);
    c.lineTo(r * 0.32, r);
    c.lineTo(-r * 0.32, r);
    c.closePath();
    paint(c, { ...p, fill: acc(p) });
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * 0.45;
      c.save();
      c.translate(0, r * 0.2);
      c.rotate(a + Math.PI / 2);
      c.beginPath();
      c.ellipse(0, -r * 0.42, r * 0.14, r * 0.42, 0, 0, TAU);
      c.restore();
      paint(c, p);
    }
  } else {
    // palm
    line(c, [[0, r], [r * 0.1, 0], [0, -r * 0.4]], col, r * 0.09);
    for (let k = 0; k < 6; k++) {
      const a = Math.PI + (k / 5) * Math.PI;
      c.save();
      c.translate(0, -r * 0.4);
      c.rotate(a);
      c.beginPath();
      c.moveTo(0, 0);
      c.quadraticCurveTo(r * 0.4, -r * 0.25, r * 0.85, r * 0.1);
      c.quadraticCurveTo(r * 0.4, r * 0.05, 0, 0);
      c.restore();
      paint(c, p);
    }
  }
};

const star: Gen = (c, r, p, rnd, i) => {
  const kind = i % 5;
  if (kind === 0) {
    starPath(c, r, 4 + (i % 7), 0.35 + rnd() * 0.3);
    paint(c, p);
  } else if (kind === 1) {
    // sparkle with curved sides
    const n = 4 + 2 * Math.floor(rnd() * 2);
    c.beginPath();
    for (let k = 0; k <= n; k++) {
      const a = (k / n) * TAU - Math.PI / 2;
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (k === 0) c.moveTo(x, y);
      else c.quadraticCurveTo(0, 0, x, y);
    }
    c.closePath();
    paint(c, p);
  } else if (kind === 2) {
    // starburst rays
    const n = 8 + Math.floor(rnd() * 10);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU;
      const l = r * (k % 2 ? 0.6 : 1);
      line(c, [[Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25], [Math.cos(a) * l, Math.sin(a) * l]], ink(p), r * 0.08);
    }
    dot(c, 0, 0, r * 0.15, acc(p));
  } else if (kind === 3) {
    // asterisk
    const n = 3 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI;
      line(c, [[Math.cos(a) * r, Math.sin(a) * r], [-Math.cos(a) * r, -Math.sin(a) * r]], ink(p), r * 0.18);
    }
  } else {
    // rounded star with a face or a smaller star inside
    starPath(c, r, 5, 0.5);
    paint(c, p);
    c.save();
    c.scale(0.45, 0.45);
    starPath(c, r, 5, 0.5, Math.PI / 2 + Math.PI / 5);
    c.restore();
    paint(c, { ...p, fill: acc(p), stroke: null });
  }
};

const sky: Gen = (c, r, p, rnd, i) => {
  const kind = i % 5;
  if (kind === 0) {
    // moon phase
    const ph = 0.2 + ((i * 0.17) % 0.7);
    c.beginPath();
    c.arc(0, 0, r * 0.85, 0, TAU);
    paint(c, p);
    c.save();
    c.globalCompositeOperation = 'destination-out';
    c.beginPath();
    c.arc(r * ph * 1.6, -r * 0.1, r * 0.8, 0, TAU);
    c.fill();
    c.restore();
  } else if (kind === 1) {
    // planet with a tilted ring
    const tilt = -0.6 + rnd() * 1.2;
    c.beginPath();
    c.arc(0, 0, r * 0.5, 0, TAU);
    paint(c, p);
    c.save();
    c.rotate(tilt);
    c.beginPath();
    c.ellipse(0, 0, r * 0.95, r * 0.25, 0, 0, TAU);
    c.strokeStyle = acc(p);
    c.lineWidth = r * 0.08;
    c.stroke();
    c.restore();
  } else if (kind === 2) {
    // comet
    const a = rnd() * TAU;
    c.save();
    c.rotate(a);
    for (let k = 0; k < 3; k++) line(c, [[r * 0.25, (k - 1) * r * 0.15], [r * (0.9 - k * 0.1), (k - 1) * r * 0.3]], acc(p), r * 0.06);
    c.restore();
    starPath(c, r * 0.45, 5, 0.45);
    paint(c, p);
  } else if (kind === 3) {
    // sun with rays
    const n = 8 + (i % 8);
    const wavy = rnd() < 0.5;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU;
      c.save();
      c.rotate(a);
      if (wavy) line(c, [[r * 0.55, 0], [r * 0.7, r * 0.08], [r * 0.85, -r * 0.08], [r, 0]], ink(p), r * 0.07);
      else {
        poly(c, [[r * 0.55, -r * 0.08], [r, 0], [r * 0.55, r * 0.08]]);
        paint(c, { ...p, fill: acc(p) });
      }
      c.restore();
    }
    c.beginPath();
    c.arc(0, 0, r * 0.45, 0, TAU);
    paint(c, p);
  } else {
    // constellation
    const pts: [number, number][] = Array.from({ length: 5 + (i % 3) }, () => [(rnd() - 0.5) * r * 1.7, (rnd() - 0.5) * r * 1.7]);
    line(c, pts, ink(p), r * 0.03);
    pts.forEach(([x, y], k) => {
      c.save();
      c.translate(x, y);
      starPath(c, r * (k === 0 ? 0.2 : 0.12), 4, 0.4);
      c.fillStyle = acc(p);
      c.fill();
      c.restore();
    });
  }
};

const weather: Gen = (c, r, p, rnd, i) => {
  const kind = i % 4;
  const cloud = (cy: number, s: number) => {
    c.beginPath();
    c.arc(-r * 0.4 * s, cy, r * 0.32 * s, Math.PI * 0.5, Math.PI * 1.5);
    c.arc(-r * 0.05 * s, cy - r * 0.25 * s, r * 0.4 * s, Math.PI, Math.PI * 1.9);
    c.arc(r * 0.42 * s, cy, r * 0.32 * s, Math.PI * 1.4, Math.PI * 0.5);
    c.closePath();
    paint(c, p);
  };
  if (kind === 0) {
    cloud(-r * 0.15, 1.15);
    for (let k = 0; k < 3 + (i % 3); k++) line(c, [[-r * 0.4 + k * r * 0.25, r * 0.35], [-r * 0.5 + k * r * 0.25, r * 0.65]], acc(p), r * 0.06);
  } else if (kind === 1) {
    cloud(-r * 0.2, 1.1);
    poly(c, [[r * 0.05, r * 0.1], [-r * 0.2, r * 0.55], [0, r * 0.55], [-r * 0.12, r * 0.95], [r * 0.25, r * 0.4], [r * 0.05, r * 0.4]]);
    paint(c, { ...p, fill: acc(p) });
  } else if (kind === 2) {
    // snowflake
    const n = 6;
    const branch = 0.3 + rnd() * 0.3;
    for (let k = 0; k < n; k++) {
      c.save();
      c.rotate((k / n) * TAU);
      line(c, [[0, 0], [0, -r]], ink(p), r * 0.07);
      line(c, [[0, -r * 0.55], [r * branch * 0.5, -r * (0.55 + branch * 0.5)]], ink(p), r * 0.06);
      line(c, [[0, -r * 0.55], [-r * branch * 0.5, -r * (0.55 + branch * 0.5)]], ink(p), r * 0.06);
      c.restore();
    }
  } else {
    // rainbow
    const bands = 3 + (i % 3);
    const cols = ['#ff5a5f', '#ffb13b', '#ffe14d', '#4cd97b', '#4aa8ff', '#9b6bff'];
    for (let k = 0; k < bands; k++) {
      c.beginPath();
      c.arc(0, r * 0.4, r * (0.95 - k * 0.14), Math.PI, 0);
      c.strokeStyle = cols[(k + i) % cols.length]!;
      c.lineWidth = r * 0.13;
      c.stroke();
    }
    if (rnd() < 0.6) cloud(r * 0.45, 0.45);
  }
};

const hearts: Gen = (c, r, p, rnd, i) => {
  const kind = i % 5;
  heartPath(c, r * (kind === 1 ? 0.7 : 0.9), 0.85 + rnd() * 0.3);
  paint(c, p);
  if (kind === 1) {
    // wings
    for (const sx of [-1, 1]) {
      c.beginPath();
      c.ellipse(sx * r * 0.75, -r * 0.2, r * 0.35, r * 0.18, sx * -0.5, 0, TAU);
      paint(c, { ...p, fill: acc(p) });
    }
  } else if (kind === 2) {
    // crack
    line(c, [[0, -r * 0.32], [-r * 0.12, -r * 0.05], [r * 0.1, r * 0.15], [-r * 0.05, r * 0.4]], acc(p), r * 0.07);
  } else if (kind === 3) {
    // arrow through it
    line(c, [[-r, r * 0.4], [r, -r * 0.4]], acc(p), r * 0.06);
    poly(c, [[r, -r * 0.4], [r * 0.75, -r * 0.42], [r * 0.85, -r * 0.2]]);
    paint(c, { ...p, fill: acc(p) });
  } else if (kind === 4) {
    c.save();
    c.scale(0.45, 0.45);
    heartPath(c, r * 0.9);
    c.restore();
    paint(c, { ...p, fill: acc(p), stroke: null });
  } else {
    // beat lines
    for (let k = 1; k <= 2; k++) {
      c.beginPath();
      c.arc(0, 0, r * (0.95 + k * 0.12), -0.6, 0.2);
      c.strokeStyle = acc(p);
      c.lineWidth = r * 0.05;
      c.stroke();
    }
  }
};

const music: Gen = (c, r, p, rnd, i) => {
  const kind = i % 6;
  const col = ink(p);
  if (kind === 0 || kind === 1) {
    const two = kind === 1;
    const heads: [number, number][] = two ? [[-r * 0.4, r * 0.55], [r * 0.45, r * 0.4]] : [[-r * 0.1, r * 0.55]];
    heads.forEach(([x, y]) => {
      c.beginPath();
      c.ellipse(x, y, r * 0.26, r * 0.19, -0.4, 0, TAU);
      paint(c, p);
      line(c, [[x + r * 0.23, y], [x + r * 0.23, y - r * 1.2]], col, r * 0.08);
    });
    if (two) line(c, [[-r * 0.17, r * 0.55 - r * 1.2], [r * 0.68, r * 0.4 - r * 1.2]], col, r * 0.16);
    else line(c, [[r * 0.13, r * 0.55 - r * 1.2], [r * 0.45, -r * 0.35]], col, r * 0.08);
  } else if (kind === 2) {
    // vinyl
    c.beginPath();
    c.arc(0, 0, r * 0.95, 0, TAU);
    paint(c, { ...p, fill: '#151515' });
    for (let k = 1; k < 4; k++) {
      c.beginPath();
      c.arc(0, 0, r * (0.4 + k * 0.15), 0, TAU);
      c.strokeStyle = 'rgba(255,255,255,0.18)';
      c.lineWidth = r * 0.02;
      c.stroke();
    }
    dot(c, 0, 0, r * 0.3, acc(p));
    dot(c, 0, 0, r * 0.05, '#151515');
  } else if (kind === 3) {
    // cassette
    c.beginPath();
    c.roundRect(-r * 0.95, -r * 0.6, r * 1.9, r * 1.2, r * 0.12);
    paint(c, p);
    c.beginPath();
    c.roundRect(-r * 0.7, -r * 0.42, r * 1.4, r * 0.45, r * 0.08);
    paint(c, { ...p, fill: acc(p) });
    for (const sx of [-1, 1]) dot(c, sx * r * 0.35, r * 0.25, r * 0.15, col);
  } else if (kind === 4) {
    // mic
    c.beginPath();
    c.roundRect(-r * 0.3, -r, r * 0.6, r * 0.95, r * 0.3);
    paint(c, p);
    c.beginPath();
    c.arc(0, -r * 0.2, r * 0.45, 0, Math.PI);
    c.strokeStyle = col;
    c.lineWidth = r * 0.07;
    c.stroke();
    line(c, [[0, r * 0.25], [0, r * 0.75]], col, r * 0.08);
    line(c, [[-r * 0.3, r * 0.8], [r * 0.3, r * 0.8]], col, r * 0.08);
  } else {
    // speaker
    c.beginPath();
    c.roundRect(-r * 0.65, -r * 0.95, r * 1.3, r * 1.9, r * 0.12);
    paint(c, p);
    dot(c, 0, r * 0.3, r * 0.42, acc(p));
    dot(c, 0, r * 0.3, r * 0.15, col);
    dot(c, 0, -r * 0.5, r * 0.2, acc(p));
    void rnd;
  }
};

const squiggle: Gen = (c, r, p, rnd, i) => {
  const kind = i % 6;
  const col = ink(p);
  const w = r * (0.07 + rnd() * 0.06);
  if (kind === 0) {
    // spiral
    const turns = 2 + (i % 3);
    const pts: [number, number][] = [];
    for (let k = 0; k <= turns * 40; k++) {
      const a = (k / 40) * TAU;
      const rad = (k / (turns * 40)) * r;
      pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
    }
    line(c, pts, col, w);
  } else if (kind === 1) {
    const n = 4 + (i % 5);
    line(c, Array.from({ length: n + 1 }, (_, k) => [-r + (k * 2 * r) / n, k % 2 ? -r * 0.4 : r * 0.4] as [number, number]), col, w);
  } else if (kind === 2) {
    const f = 2 + (i % 4);
    line(c, Array.from({ length: 50 }, (_, k) => [-r + (k / 49) * 2 * r, Math.sin((k / 49) * TAU * f * 0.5) * r * 0.35] as [number, number]), col, w);
  } else if (kind === 3) {
    // loops
    const n = 3 + (i % 3);
    line(c, Array.from({ length: 80 }, (_, k) => { const t = (k / 79) * n * TAU; return [-r + (k / 79) * 2 * r + Math.cos(t) * r * 0.2, Math.sin(t) * r * 0.3] as [number, number]; }), col, w);
  } else if (kind === 4) {
    // dot grid
    const n = 3 + (i % 3);
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) dot(c, -r * 0.8 + (a * 1.6 * r) / (n - 1), -r * 0.8 + (b * 1.6 * r) / (n - 1), r * 0.09, (a + b) % 2 ? acc(p) : col);
  } else {
    // scribble
    line(c, Array.from({ length: 14 }, () => [(rnd() - 0.5) * r * 1.8, (rnd() - 0.5) * r * 1.4] as [number, number]), col, w);
  }
};

const object: Gen = (c, r, p, rnd, i) => {
  const kind = i % 15;
  const col = ink(p);
  switch (kind) {
    case 0: // crown
      poly(c, [[-r * 0.85, r * 0.5], [-r * 0.85, -r * 0.4], [-r * 0.42, 0], [0, -r * 0.65], [r * 0.42, 0], [r * 0.85, -r * 0.4], [r * 0.85, r * 0.5]]);
      paint(c, p);
      for (const x of [-0.85, 0, 0.85]) dot(c, x * r, x === 0 ? -r * 0.7 : -r * 0.45, r * 0.1, acc(p));
      break;
    case 1: // diamond gem
      poly(c, [[-r * 0.8, -r * 0.25], [-r * 0.45, -r * 0.7], [r * 0.45, -r * 0.7], [r * 0.8, -r * 0.25], [0, r * 0.85]]);
      paint(c, p);
      line(c, [[-r * 0.8, -r * 0.25], [r * 0.8, -r * 0.25]], acc(p), r * 0.04);
      line(c, [[-r * 0.25, -r * 0.25], [0, r * 0.85], [r * 0.25, -r * 0.25]], acc(p), r * 0.04);
      break;
    case 2: // key
      c.beginPath();
      c.arc(-r * 0.5, 0, r * 0.35, 0, TAU);
      paint(c, p);
      dot(c, -r * 0.5, 0, r * 0.12, acc(p));
      line(c, [[-r * 0.15, 0], [r * 0.9, 0]], col, r * 0.12);
      line(c, [[r * 0.6, 0], [r * 0.6, r * 0.3]], col, r * 0.1);
      line(c, [[r * 0.85, 0], [r * 0.85, r * 0.22]], col, r * 0.1);
      break;
    case 3: // candle
      c.beginPath();
      c.roundRect(-r * 0.25, -r * 0.2, r * 0.5, r * 1.1, r * 0.06);
      paint(c, p);
      c.beginPath();
      c.moveTo(0, -r * 0.95);
      c.quadraticCurveTo(r * 0.25, -r * 0.45, 0, -r * 0.3);
      c.quadraticCurveTo(-r * 0.25, -r * 0.45, 0, -r * 0.95);
      paint(c, { ...p, fill: '#ffb13b' });
      break;
    case 4: // mushroom
      c.beginPath();
      c.arc(0, 0, r * 0.85, Math.PI, 0);
      c.closePath();
      paint(c, p);
      for (let k = 0; k < 3; k++) dot(c, (k - 1) * r * 0.42, -r * (0.35 + (k % 2) * 0.2), r * 0.12, '#ffffff');
      c.beginPath();
      c.roundRect(-r * 0.25, 0, r * 0.5, r * 0.75, r * 0.15);
      paint(c, { ...p, fill: '#f4ead7' });
      break;
    case 5: // cherry
      line(c, [[-r * 0.35, r * 0.3], [r * 0.1, -r * 0.8], [r * 0.4, r * 0.25]], col, r * 0.06);
      for (const [x, y] of [[-r * 0.35, r * 0.45], [r * 0.4, r * 0.4]] as [number, number][]) {
        c.beginPath();
        c.arc(x, y, r * 0.32, 0, TAU);
        paint(c, p);
        dot(c, x - r * 0.1, y - r * 0.1, r * 0.07, '#ffffff');
      }
      break;
    case 6: // ice cream
      poly(c, [[-r * 0.45, -r * 0.05], [r * 0.45, -r * 0.05], [0, r]]);
      paint(c, { ...p, fill: '#e8b06a' });
      blob(c, r * 0.5, 8, 0.1, rnd, 1, 0.8);
      c.translate(0, 0);
      paint(c, p);
      dot(c, 0, -r * 0.55, r * 0.12, '#e23b4f');
      break;
    case 7: // balloon
      c.beginPath();
      c.ellipse(0, -r * 0.25, r * 0.55, r * 0.65, 0, 0, TAU);
      paint(c, p);
      line(c, [[0, r * 0.4], [r * 0.1, r * 0.65], [-r * 0.08, r * 0.95]], col, r * 0.03);
      break;
    case 8: // gift
      c.beginPath();
      c.rect(-r * 0.7, -r * 0.3, r * 1.4, r * 1.1);
      paint(c, p);
      c.fillStyle = acc(p);
      c.fillRect(-r * 0.1, -r * 0.3, r * 0.2, r * 1.1);
      c.fillRect(-r * 0.7, r * 0.15, r * 1.4, r * 0.18);
      for (const sx of [-1, 1]) {
        c.beginPath();
        c.ellipse(sx * r * 0.22, -r * 0.45, r * 0.24, r * 0.13, sx * 0.4, 0, TAU);
        paint(c, { ...p, fill: acc(p) });
      }
      break;
    case 9: // rocket
      c.beginPath();
      c.moveTo(0, -r);
      c.quadraticCurveTo(r * 0.45, -r * 0.4, r * 0.3, r * 0.5);
      c.lineTo(-r * 0.3, r * 0.5);
      c.quadraticCurveTo(-r * 0.45, -r * 0.4, 0, -r);
      paint(c, p);
      dot(c, 0, -r * 0.25, r * 0.15, acc(p));
      poly(c, [[-r * 0.2, r * 0.5], [0, r], [r * 0.2, r * 0.5]]);
      paint(c, { ...p, fill: '#ff8a3b' });
      break;
    case 10: // ufo
      c.beginPath();
      c.ellipse(0, r * 0.05, r * 0.95, r * 0.3, 0, 0, TAU);
      paint(c, p);
      c.beginPath();
      c.arc(0, -r * 0.05, r * 0.4, Math.PI, 0);
      paint(c, { ...p, fill: acc(p) });
      for (let k = -2; k <= 2; k++) dot(c, k * r * 0.35, r * 0.1, r * 0.06, '#ffe14d');
      break;
    case 11: // paper plane
      poly(c, [[-r * 0.9, 0], [r * 0.9, -r * 0.55], [-r * 0.2, r * 0.15]]);
      paint(c, p);
      poly(c, [[-r * 0.2, r * 0.15], [r * 0.9, -r * 0.55], [r * 0.05, r * 0.6]]);
      paint(c, { ...p, fill: acc(p) });
      break;
    case 12: // anchor
      line(c, [[0, -r * 0.65], [0, r * 0.8]], col, r * 0.12);
      c.beginPath();
      c.arc(0, -r * 0.8, r * 0.17, 0, TAU);
      c.strokeStyle = col;
      c.lineWidth = r * 0.1;
      c.stroke();
      c.beginPath();
      c.arc(0, r * 0.2, r * 0.6, 0.15 * Math.PI, 0.85 * Math.PI);
      c.stroke();
      line(c, [[-r * 0.35, -r * 0.35], [r * 0.35, -r * 0.35]], col, r * 0.1);
      break;
    case 13: // eye
      c.beginPath();
      c.moveTo(-r, 0);
      c.quadraticCurveTo(0, -r * 0.8, r, 0);
      c.quadraticCurveTo(0, r * 0.8, -r, 0);
      paint(c, { ...p, fill: '#ffffff' });
      dot(c, 0, 0, r * 0.32, acc(p));
      dot(c, 0, 0, r * 0.14, '#111111');
      for (let k = -2; k <= 2; k++) line(c, [[k * r * 0.25, -r * 0.42], [k * r * 0.32, -r * 0.62]], col, r * 0.05);
      break;
    default: // cup
      c.beginPath();
      c.moveTo(-r * 0.55, -r * 0.3);
      c.lineTo(r * 0.55, -r * 0.3);
      c.lineTo(r * 0.42, r * 0.7);
      c.lineTo(-r * 0.42, r * 0.7);
      c.closePath();
      paint(c, p);
      c.beginPath();
      c.arc(r * 0.6, r * 0.1, r * 0.22, -Math.PI / 2, Math.PI / 2);
      c.strokeStyle = col;
      c.lineWidth = r * 0.08;
      c.stroke();
      for (let k = -1; k <= 1; k++) line(c, [[k * r * 0.25, -r * 0.45], [k * r * 0.25 + r * 0.08, -r * 0.65], [k * r * 0.25, -r * 0.85]], col, r * 0.05);
  }
};

const shape: Gen = (c, r, p, rnd, i) => {
  const kind = i % 6;
  if (kind === 0) {
    // nested polygons
    const n = 3 + (i % 5);
    for (let k = 3; k >= 1; k--) {
      poly(c, Array.from({ length: n }, (_, j) => { const a = (j / n) * TAU - Math.PI / 2 + k * 0.2; return [Math.cos(a) * r * k * 0.32, Math.sin(a) * r * k * 0.32] as [number, number]; }));
      paint(c, k % 2 ? p : { ...p, fill: acc(p) });
    }
  } else if (kind === 1) {
    // isometric cube
    const s = r * 0.8;
    const h = s * 0.5;
    poly(c, [[0, -s], [s * 0.87, -h], [0, 0], [-s * 0.87, -h]]);
    paint(c, { ...p, fill: acc(p) });
    poly(c, [[-s * 0.87, -h], [0, 0], [0, s], [-s * 0.87, h]]);
    paint(c, p);
    poly(c, [[s * 0.87, -h], [0, 0], [0, s], [s * 0.87, h]]);
    paint(c, { ...p, fill: ink(p) });
  } else if (kind === 2) {
    // concentric rings
    const n = 3 + (i % 3);
    for (let k = n; k >= 1; k--) {
      c.beginPath();
      c.arc(0, 0, (r * k) / n, 0, TAU);
      paint(c, k % 2 ? p : { ...p, fill: acc(p) });
    }
  } else if (kind === 3) {
    // pyramid
    poly(c, [[0, -r * 0.9], [r * 0.9, r * 0.7], [0, r * 0.45]]);
    paint(c, p);
    poly(c, [[0, -r * 0.9], [-r * 0.9, r * 0.7], [0, r * 0.45]]);
    paint(c, { ...p, fill: acc(p) });
  } else if (kind === 4) {
    // half circles stacked
    for (let k = 0; k < 3; k++) {
      c.beginPath();
      c.arc(0, r * (0.6 - k * 0.5), r * (0.8 - k * 0.15), Math.PI, 0);
      c.closePath();
      paint(c, k % 2 ? { ...p, fill: acc(p) } : p);
    }
  } else {
    // checkered tile
    const n = 2 + (i % 3);
    const s = (r * 1.6) / n;
    for (let a = 0; a < n; a++)
      for (let b = 0; b < n; b++) {
        if ((a + b) % 2) continue;
        c.beginPath();
        c.rect(-r * 0.8 + a * s, -r * 0.8 + b * s, s, s);
        paint(c, rnd() < 0.3 ? { ...p, fill: acc(p) } : p);
      }
  }
};

const animal: Gen = (c, r, p, rnd, i) => {
  const kind = i % 10;
  const col = p.stroke && p.fill ? p.stroke : '#1a1a1a';
  switch (kind) {
    case 0: // butterfly
      for (const sx of [-1, 1]) {
        c.beginPath();
        c.ellipse(sx * r * 0.45, -r * 0.3, r * 0.45, r * 0.38, sx * 0.4, 0, TAU);
        c.ellipse(sx * r * 0.35, r * 0.35, r * 0.3, r * 0.27, sx * -0.4, 0, TAU);
        paint(c, p);
        dot(c, sx * r * 0.45, -r * 0.3, r * 0.13, acc(p));
      }
      line(c, [[0, -r * 0.5], [0, r * 0.6]], col, r * 0.1);
      break;
    case 1: // bee
      c.beginPath();
      c.ellipse(0, 0, r * 0.65, r * 0.45, 0, 0, TAU);
      paint(c, { ...p, fill: '#ffd43b' });
      for (const x of [-0.2, 0.15]) line(c, [[x * r, -r * 0.42], [x * r, r * 0.42]], '#1a1a1a', r * 0.14);
      for (const sx of [-1, 1]) {
        c.beginPath();
        c.ellipse(sx * r * 0.15, -r * 0.55, r * 0.22, r * 0.3, sx * 0.3, 0, TAU);
        paint(c, { fill: 'rgba(255,255,255,0.85)', stroke: col, lineWidth: r * 0.03 });
      }
      dot(c, r * 0.45, -r * 0.08, r * 0.06, '#1a1a1a');
      break;
    case 2: // fish
      c.beginPath();
      c.ellipse(-r * 0.1, 0, r * 0.6, r * 0.38, 0, 0, TAU);
      paint(c, p);
      poly(c, [[r * 0.4, 0], [r * 0.9, -r * 0.35], [r * 0.9, r * 0.35]]);
      paint(c, { ...p, fill: acc(p) });
      dot(c, -r * 0.4, -r * 0.08, r * 0.07, col);
      break;
    case 3: // bird
      c.beginPath();
      c.arc(0, 0, r * 0.55, 0, TAU);
      paint(c, p);
      poly(c, [[r * 0.5, -r * 0.05], [r * 0.85, r * 0.05], [r * 0.5, r * 0.15]]);
      paint(c, { ...p, fill: '#ffb13b' });
      c.beginPath();
      c.ellipse(-r * 0.15, r * 0.1, r * 0.3, r * 0.2, -0.4, 0, TAU);
      paint(c, { ...p, fill: acc(p) });
      dot(c, r * 0.22, -r * 0.15, r * 0.07, col);
      break;
    case 4: // snail
      c.beginPath();
      c.ellipse(0, r * 0.45, r * 0.85, r * 0.2, 0, 0, TAU);
      paint(c, { ...p, fill: acc(p) });
      c.beginPath();
      c.arc(-r * 0.1, 0, r * 0.5, 0, TAU);
      paint(c, p);
      line(c, Array.from({ length: 40 }, (_, k) => { const a = (k / 39) * TAU * 2; const rad = (1 - k / 39) * r * 0.4; return [-r * 0.1 + Math.cos(a) * rad, Math.sin(a) * rad] as [number, number]; }), col, r * 0.04);
      break;
    case 5: // cat face
      poly(c, [[-r * 0.7, -r * 0.2], [-r * 0.6, -r * 0.85], [-r * 0.2, -r * 0.5], [r * 0.2, -r * 0.5], [r * 0.6, -r * 0.85], [r * 0.7, -r * 0.2]]);
      paint(c, p);
      c.beginPath();
      c.ellipse(0, r * 0.05, r * 0.75, r * 0.6, 0, 0, TAU);
      paint(c, p);
      eyes(c, r, Math.floor(rnd() * 8), col, 0.3, -0.05);
      mouth(c, r, 3, col, 0.28);
      for (const sx of [-1, 1]) for (const dy of [0.15, 0.3]) line(c, [[sx * r * 0.35, r * dy], [sx * r * 0.9, r * (dy - 0.05)]], col, r * 0.025);
      break;
    case 6: // ladybug
      c.beginPath();
      c.arc(0, r * 0.1, r * 0.75, 0, TAU);
      paint(c, { ...p, fill: '#e23b4f' });
      line(c, [[0, -r * 0.6], [0, r * 0.85]], '#1a1a1a', r * 0.05);
      for (let k = 0; k < 6; k++) dot(c, (k % 2 ? 1 : -1) * r * (0.3 + (k % 3) * 0.1), r * (-0.25 + Math.floor(k / 2) * 0.35), r * 0.1, '#1a1a1a');
      c.beginPath();
      c.arc(0, -r * 0.6, r * 0.3, Math.PI, 0);
      paint(c, { ...p, fill: '#1a1a1a' });
      break;
    case 7: // jellyfish
      c.beginPath();
      c.arc(0, -r * 0.1, r * 0.65, Math.PI, 0);
      c.closePath();
      paint(c, p);
      for (let k = -2; k <= 2; k++) line(c, Array.from({ length: 8 }, (_, j) => [k * r * 0.22 + Math.sin(j + k) * r * 0.08, -r * 0.1 + j * r * 0.13] as [number, number]), acc(p), r * 0.05);
      eyes(c, r, 0, col, 0.22, -0.35);
      break;
    case 8: // octopus
      c.beginPath();
      c.arc(0, -r * 0.25, r * 0.55, Math.PI, 0);
      c.lineTo(r * 0.55, r * 0.1);
      c.lineTo(-r * 0.55, r * 0.1);
      c.closePath();
      paint(c, p);
      for (let k = 0; k < 6; k++) {
        const x = -r * 0.5 + k * r * 0.2;
        line(c, [[x, r * 0.05], [x + Math.sin(k) * r * 0.15, r * 0.5], [x - Math.sin(k) * r * 0.1, r * 0.85]], p.fill ?? col, r * 0.1);
      }
      eyes(c, r, 3, col, 0.22, -0.3);
      break;
    default: // ghost
      c.beginPath();
      c.moveTo(-r * 0.6, r * 0.8);
      c.lineTo(-r * 0.6, -r * 0.15);
      c.arc(0, -r * 0.15, r * 0.6, Math.PI, 0);
      c.lineTo(r * 0.6, r * 0.8);
      c.lineTo(r * 0.3, r * 0.6);
      c.lineTo(0, r * 0.8);
      c.lineTo(-r * 0.3, r * 0.6);
      c.closePath();
      paint(c, { ...p, fill: p.fill ?? '#ffffff' });
      eyes(c, r, 5, col, 0.22, -0.2);
  }
};

const symbol: Gen = (c, r, p, rnd, i) => {
  const kind = i % 8;
  const col = ink(p);
  const w = r * 0.16;
  switch (kind) {
    case 0: // infinity
      line(c, Array.from({ length: 60 }, (_, k) => { const t = (k / 59) * TAU; const d = 1 + Math.sin(t) ** 2; return [(r * 0.9 * Math.cos(t)) / d, (r * 0.9 * Math.sin(t) * Math.cos(t)) / d] as [number, number]; }), col, w * 0.7);
      break;
    case 1: // arrow
      line(c, [[-r * 0.8, r * 0.3], [r * 0.6, -r * 0.3]], col, w);
      poly(c, [[r * 0.9, -r * 0.45], [r * 0.35, -r * 0.55], [r * 0.6, -r * 0.05]]);
      paint(c, { ...p, fill: col });
      break;
    case 2: // plus
      line(c, [[0, -r * 0.8], [0, r * 0.8]], col, w * 1.4);
      line(c, [[-r * 0.8, 0], [r * 0.8, 0]], col, w * 1.4);
      break;
    case 3: // check
      line(c, [[-r * 0.7, 0], [-r * 0.2, r * 0.5], [r * 0.75, -r * 0.6]], col, w * 1.2);
      break;
    case 4: // exclamation
      line(c, [[0, -r * 0.85], [0, r * 0.3]], col, w * 1.5);
      dot(c, 0, r * 0.7, w, col);
      break;
    case 5: // question
      c.beginPath();
      c.arc(0, -r * 0.35, r * 0.4, Math.PI * 1.1, Math.PI * 0.5);
      c.strokeStyle = col;
      c.lineWidth = w;
      c.lineCap = 'round';
      c.stroke();
      line(c, [[0, r * 0.05], [0, r * 0.3]], col, w);
      dot(c, 0, r * 0.7, w * 0.8, col);
      break;
    case 6: // speech bubble
      c.beginPath();
      c.roundRect(-r * 0.9, -r * 0.7, r * 1.8, r * 1.1, r * 0.3);
      paint(c, p);
      poly(c, [[-r * 0.3, r * 0.38], [-r * 0.5, r * 0.85], [0, r * 0.38]]);
      paint(c, p);
      for (let k = -1; k <= 1; k++) dot(c, k * r * 0.4, -r * 0.15, r * 0.1, acc(p));
      break;
    default: // smiley badge
      c.beginPath();
      c.arc(0, 0, r * 0.9, 0, TAU);
      paint(c, { ...p, fill: '#ffd43b' });
      eyes(c, r, Math.floor(rnd() * 8), '#1a1a1a', 0.3, -0.2);
      mouth(c, r, 0, '#1a1a1a', 0.3);
  }
};

/** family -> generator, how many drawings it holds, and what songs it suits */
export const ART_FAMILIES = {
  critter: { gen: critter, n: 42, tags: ['cute', 'fun', 'party'] },
  face: { gen: face, n: 30, tags: ['fun', 'cute', 'party'] },
  flower: { gen: flower, n: 30, tags: ['nature', 'love', 'calm'] },
  plant: { gen: plant, n: 20, tags: ['nature', 'calm'] },
  star: { gen: star, n: 25, tags: ['night', 'party', 'energy'] },
  sky: { gen: sky, n: 25, tags: ['night', 'dream', 'calm'] },
  weather: { gen: weather, n: 16, tags: ['sad', 'calm', 'nature'] },
  heart: { gen: hearts, n: 20, tags: ['love'] },
  music: { gen: music, n: 18, tags: ['party', 'energy', 'fun'] },
  squiggle: { gen: squiggle, n: 30, tags: ['energy', 'fun', 'dream'] },
  object: { gen: object, n: 30, tags: ['fun', 'party', 'dream'] },
  shape: { gen: shape, n: 24, tags: ['energy', 'calm', 'dream'] },
  animal: { gen: animal, n: 20, tags: ['cute', 'nature', 'fun'] },
  symbol: { gen: symbol, n: 16, tags: ['energy', 'fun'] },
} as const satisfies Record<string, { gen: Gen; n: number; tags: readonly string[] }>;
export type ArtFamily = keyof typeof ART_FAMILIES;
export type ArtTag = 'cute' | 'fun' | 'party' | 'nature' | 'love' | 'calm' | 'night' | 'energy' | 'dream' | 'sad';

export const ART_IDS: readonly string[] = (Object.keys(ART_FAMILIES) as ArtFamily[]).flatMap((f) => Array.from({ length: ART_FAMILIES[f].n }, (_, i) => `${f}-${String(i).padStart(2, '0')}`));

export function artFamily(id: string): ArtFamily | null {
  const f = id.slice(0, id.lastIndexOf('-')) as ArtFamily;
  return f in ART_FAMILIES ? f : null;
}

/** Draw one library drawing centred on (0,0), about r in radius. */
export function drawArt(c: CanvasRenderingContext2D, id: string, r: number, p: DoodlePaint): void {
  const f = artFamily(id);
  if (!f) return;
  const i = Number(id.slice(id.lastIndexOf('-') + 1)) || 0;
  c.save();
  ART_FAMILIES[f].gen(c, r, p, seeded(hashKey(id)), i);
  c.restore();
}

/** The drawings that suit a tag (all of them for an unknown tag). */
export function artWithTag(tag: ArtTag | null): readonly string[] {
  if (!tag) return ART_IDS;
  const fams = (Object.keys(ART_FAMILIES) as ArtFamily[]).filter((f) => (ART_FAMILIES[f].tags as readonly string[]).includes(tag));
  return ART_IDS.filter((id) => fams.includes(artFamily(id)!));
}

/** Pick a drawing from a seed, preferring ones that suit the tag. */
export function pickArt(seed: number, tag: ArtTag | null = null): string {
  const r = seeded(seed);
  const pool = r() < 0.75 ? artWithTag(tag) : ART_IDS;
  return pool[Math.floor(r() * pool.length) % pool.length]!;
}
