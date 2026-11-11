// Cover Pop's flat marks: CVP-PRP-STK-001..036 annotation stickers (gestures that point at, circle and celebrate a word, each
// with a white die-cut border and a soft shadow), CVP-GEO-BST-001..008 burst shapes for the hook, CVP-PRC-CUT-001..004 stickers
// cut from the cover itself (cropped pixels only, never altered) and CVP-TYP-CHP-001..006 chips. All drawn as canvas vector
// code in a 100-unit box centred on (0, 0), in one hot colour plus white.

type C = CanvasRenderingContext2D;
export type StickerId = `CVP-PRP-STK-0${string}`;
export type BurstId = `CVP-GEO-BST-00${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
export type CutId = `CVP-PRC-CUT-00${1 | 2 | 3 | 4}`;
export type ChipId = `CVP-TYP-CHP-00${1 | 2 | 3 | 4 | 5 | 6}`;

const TAU = Math.PI * 2;
const line = (c: C, pts: [number, number][]) => {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.stroke();
};
const head = (c: C, x: number, y: number, ang: number, s = 14) => line(c, [[x + Math.cos(ang + 2.5) * s, y + Math.sin(ang + 2.5) * s], [x, y], [x + Math.cos(ang - 2.5) * s, y + Math.sin(ang - 2.5) * s]]);
const star = (c: C, x: number, y: number, R: number, r: number, n: number, rot = -Math.PI / 2) => {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n;
    const rr = i % 2 ? r : R;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
};
const heart = (c: C, x: number, y: number, s: number) => {
  c.beginPath();
  c.moveTo(x, y + s * 0.35);
  c.bezierCurveTo(x - s, y - s * 0.3, x - s * 0.45, y - s, x, y - s * 0.45);
  c.bezierCurveTo(x + s * 0.45, y - s, x + s, y - s * 0.3, x, y + s * 0.35);
  c.closePath();
};

/** the sticker's drawing in its colour (strokes 7 units, fills solid); the die-cut border is added by `paintSticker` */
const STICKERS: Record<string, { name: string; draw(c: C): void }> = {
  'CVP-PRP-STK-001': { name: 'Arrow (curved)', draw: (c) => { c.beginPath(); c.moveTo(-36, 26); c.quadraticCurveTo(-30, -30, 30, -24); c.stroke(); head(c, 30, -24, -0.1); } },
  'CVP-PRP-STK-002': { name: 'Arrow (straight, hand-drawn)', draw: (c) => { line(c, [[-38, 20], [-10, 6], [34, -14]]); head(c, 34, -14, -0.42); } },
  'CVP-PRP-STK-003': { name: 'Double arrow', draw: (c) => { line(c, [[-36, 0], [36, 0]]); head(c, 36, 0, 0); head(c, -36, 0, Math.PI); } },
  'CVP-PRP-STK-004': { name: 'Circle scribble', draw: (c) => { c.beginPath(); for (let i = 0; i <= 80; i++) { const a = -0.6 + (i / 64) * TAU; c.lineTo(Math.cos(a) * (38 + i * 0.06), Math.sin(a) * (24 + i * 0.05)); } c.stroke(); } },
  'CVP-PRP-STK-005': { name: 'Underline swoosh', draw: (c) => { c.beginPath(); c.moveTo(-40, 6); c.bezierCurveTo(-10, 18, 20, 10, 42, -8); c.stroke(); } },
  'CVP-PRP-STK-006': { name: 'Double underline', draw: (c) => { line(c, [[-40, -4], [40, -8]]); line(c, [[-34, 10], [36, 6]]); } },
  'CVP-PRP-STK-007': { name: 'Bracket pair', draw: (c) => { line(c, [[-26, -32], [-38, -32], [-38, 32], [-26, 32]]); line(c, [[26, -32], [38, -32], [38, 32], [26, 32]]); } },
  'CVP-PRP-STK-008': { name: 'Asterisk', draw: (c) => { for (let i = 0; i < 3; i++) { const a = (i * Math.PI) / 3; line(c, [[Math.cos(a) * -30, Math.sin(a) * -30], [Math.cos(a) * 30, Math.sin(a) * 30]]); } } },
  'CVP-PRP-STK-009': { name: 'Starburst badge (blank)', draw: (c) => { star(c, 0, 0, 40, 30, 14); c.fill(); } },
  'CVP-PRP-STK-010': { name: 'Exclamation mark', draw: (c) => { c.beginPath(); c.moveTo(-8, -38); c.lineTo(8, -38); c.lineTo(4, 14); c.lineTo(-4, 14); c.closePath(); c.fill(); c.beginPath(); c.arc(0, 30, 8, 0, TAU); c.fill(); } },
  'CVP-PRP-STK-011': { name: 'Question mark', draw: (c) => { c.beginPath(); c.arc(0, -16, 18, Math.PI * 1.05, Math.PI * 0.45); c.lineTo(0, 12); c.stroke(); c.beginPath(); c.arc(0, 30, 7, 0, TAU); c.fill(); } },
  'CVP-PRP-STK-012': { name: 'Quotation marks', draw: (c) => { for (const x of [-16, 16]) { c.beginPath(); c.arc(x, -6, 11, 0, TAU); c.fill(); c.beginPath(); c.moveTo(x + 10, -2); c.quadraticCurveTo(x + 8, 20, x - 8, 26); c.lineTo(x - 2, 6); c.fill(); } } },
  'CVP-PRP-STK-013': { name: 'Tape strip', draw: (c) => { c.save(); c.rotate(-0.2); c.globalAlpha = 0.85; c.fillRect(-42, -12, 84, 24); c.restore(); } },
  'CVP-PRP-STK-014': { name: 'Ticket stub (blank)', draw: (c) => { c.beginPath(); c.moveTo(-40, -22); c.lineTo(40, -22); c.lineTo(40, -8); c.arc(40, 0, 8, -Math.PI / 2, Math.PI / 2, true); c.lineTo(40, 22); c.lineTo(-40, 22); c.lineTo(-40, 8); c.arc(-40, 0, 8, Math.PI / 2, -Math.PI / 2, true); c.closePath(); c.fill(); } },
  'CVP-PRP-STK-015': { name: 'Crown doodle', draw: (c) => { c.beginPath(); c.moveTo(-34, 18); c.lineTo(-38, -18); c.lineTo(-16, 2); c.lineTo(0, -26); c.lineTo(16, 2); c.lineTo(38, -18); c.lineTo(34, 18); c.closePath(); c.fill(); } },
  'CVP-PRP-STK-016': { name: 'Halo ring', draw: (c) => { c.beginPath(); c.ellipse(0, 0, 38, 12, 0, 0, TAU); c.stroke(); } },
  'CVP-PRP-STK-017': { name: 'Sparkle cluster', draw: (c) => { star(c, -8, -4, 26, 6, 4); c.fill(); star(c, 26, -24, 12, 3, 4); c.fill(); star(c, 22, 24, 9, 2.5, 4); c.fill(); } },
  'CVP-PRP-STK-018': { name: 'Motion lines', draw: (c) => { line(c, [[-38, -18], [22, -18]]); line(c, [[-26, 0], [38, 0]]); line(c, [[-38, 18], [16, 18]]); } },
  'CVP-PRP-STK-019': { name: 'Speech tail', draw: (c) => { c.beginPath(); c.ellipse(0, -8, 38, 24, 0, 0, TAU); c.fill(); c.beginPath(); c.moveTo(-14, 10); c.lineTo(-24, 36); c.lineTo(4, 14); c.fill(); } },
  'CVP-PRP-STK-020': { name: 'Cursor pointer', draw: (c) => { c.beginPath(); c.moveTo(-22, -36); c.lineTo(-22, 22); c.lineTo(-8, 10); c.lineTo(4, 34); c.lineTo(14, 30); c.lineTo(2, 6); c.lineTo(20, 6); c.closePath(); c.fill(); } },
  'CVP-PRP-STK-021': { name: 'Check mark', draw: (c) => line(c, [[-32, 0], [-10, 24], [34, -26]]) },
  'CVP-PRP-STK-022': { name: 'Cross mark', draw: (c) => { line(c, [[-28, -28], [28, 28]]); line(c, [[28, -28], [-28, 28]]); } },
  'CVP-PRP-STK-023': { name: 'Plus signs', draw: (c) => { for (const [x, y, s] of [[-14, -6, 18], [24, -24, 10], [22, 22, 8]] as const) { line(c, [[x - s, y], [x + s, y]]); line(c, [[x, y - s], [x, y + s]]); } } },
  'CVP-PRP-STK-024': { name: 'Zigzag', draw: (c) => line(c, [[-40, 10], [-24, -12], [-8, 10], [8, -12], [24, 10], [40, -12]]) },
  'CVP-PRP-STK-025': { name: 'Squiggle', draw: (c) => { c.beginPath(); for (let i = 0; i <= 40; i++) c.lineTo(-40 + i * 2, Math.sin(i * 0.6) * 12 + Math.sin(i * 0.17) * 6); c.stroke(); } },
  'CVP-PRP-STK-026': { name: 'Heart outline doodle', draw: (c) => { heart(c, 0, 4, 40); c.stroke(); } },
  'CVP-PRP-STK-027': { name: 'Smile mark', draw: (c) => { c.beginPath(); c.arc(0, 0, 34, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, 4, 18, 0.2, Math.PI - 0.2); c.stroke(); for (const x of [-12, 12]) { c.beginPath(); c.arc(x, -10, 4.5, 0, TAU); c.fill(); } } },
  'CVP-PRP-STK-028': { name: 'Lightning stroke', draw: (c) => { c.beginPath(); c.moveTo(6, -40); c.lineTo(-22, 6); c.lineTo(-2, 6); c.lineTo(-10, 40); c.lineTo(22, -8); c.lineTo(2, -8); c.closePath(); c.fill(); } },
  'CVP-PRP-STK-029': { name: 'Wavy line', draw: (c) => { c.beginPath(); for (let i = 0; i <= 40; i++) c.lineTo(-40 + i * 2, Math.sin(i * 0.32) * 12); c.stroke(); } },
  'CVP-PRP-STK-030': { name: 'Dotted loop', draw: (c) => { for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU; c.beginPath(); c.arc(Math.cos(a) * 34, Math.sin(a) * 22, 4, 0, TAU); c.fill(); } } },
  'CVP-PRP-STK-031': { name: 'Sun rays', draw: (c) => { for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; line(c, [[Math.cos(a) * 16, 14 + Math.sin(a) * 16], [Math.cos(a) * 40, 14 + Math.sin(a) * 40]]); } } },
  'CVP-PRP-STK-032': { name: 'Music notes pair', draw: (c) => { for (const x of [-18, 18]) { c.beginPath(); c.ellipse(x - 6, 22, 10, 7, -0.4, 0, TAU); c.fill(); } line(c, [[-14, 22], [-14, -26], [26, -34], [26, 14]]); } },
  'CVP-PRP-STK-033': { name: 'Tiny stars', draw: (c) => { for (const [x, y, s] of [[-24, -14, 12], [6, 10, 9], [28, -22, 7], [-6, -32, 6]] as const) { star(c, x, y, s, s * 0.42, 5); c.fill(); } } },
  'CVP-PRP-STK-034': { name: 'Confetti trio', draw: (c) => { for (const [x, y, a] of [[-24, -8, 0.4], [4, 14, -0.7], [26, -16, 1.1]] as const) { c.save(); c.translate(x, y); c.rotate(a); c.fillRect(-12, -5, 24, 10); c.restore(); } } },
  'CVP-PRP-STK-035': { name: 'Ribbon banner (blank)', draw: (c) => { c.fillRect(-30, -14, 60, 28); for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 30, -8); c.lineTo(s * 46, -8); c.lineTo(s * 38, 6); c.lineTo(s * 46, 20); c.lineTo(s * 30, 20); c.fill(); } } },
  'CVP-PRP-STK-036': { name: 'Speed swoosh', draw: (c) => { c.beginPath(); c.moveTo(-42, 14); c.quadraticCurveTo(0, -30, 42, -6); c.quadraticCurveTo(4, -14, -42, 14); c.fill(); } },
};
export const STICKER_IDS = Object.keys(STICKERS) as StickerId[];
export const stickerName = (id: string) => STICKERS[id]?.name ?? id;
/** stickers that are playful in tone (never with a grief identity: the invalid-combination table) */
export const PLAYFUL = new Set(['CVP-PRP-STK-015', 'CVP-PRP-STK-017', 'CVP-PRP-STK-026', 'CVP-PRP-STK-027', 'CVP-PRP-STK-032', 'CVP-PRP-STK-033', 'CVP-PRP-STK-034', 'CVP-PRP-STK-009']);

/** draw `inner` (in a 100 box at the canvas centre), then a white die-cut border round its silhouette and a soft shadow */
function dieCut(c: C, px: number, inner: (c: C) => void, border = 7) {
  const k = px / 130;
  const art = document.createElement('canvas');
  art.width = art.height = px;
  const a = art.getContext('2d')!;
  a.translate(px / 2, px / 2);
  a.scale(k, k);
  a.lineCap = 'round';
  a.lineJoin = 'round';
  inner(a);
  // the silhouette in white, dilated by drawing it round a circle of offsets
  const sil = document.createElement('canvas');
  sil.width = sil.height = px;
  const s = sil.getContext('2d')!;
  const r = border * k;
  for (let i = 0; i < 16; i++) s.drawImage(art, Math.cos((i / 16) * TAU) * r, Math.sin((i / 16) * TAU) * r);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = '#ffffff';
  s.fillRect(0, 0, px, px);
  c.save();
  c.shadowColor = 'rgba(0,0,0,0.35)';
  c.shadowBlur = 6 * k;
  c.shadowOffsetY = 3 * k;
  c.drawImage(sil, 0, 0);
  c.restore();
  c.drawImage(art, 0, 0);
}

export function paintSticker(c: C, id: string, px: number, colour: string) {
  const s = STICKERS[id];
  if (!s) return;
  dieCut(c, px, (a) => {
    a.strokeStyle = colour;
    a.fillStyle = colour;
    a.lineWidth = 7;
    s.draw(a);
  });
}

// ---- bursts ----------------------------------------------------------------------------------------------------------------
export const BURST_IDS: BurstId[] = ['CVP-GEO-BST-001', 'CVP-GEO-BST-002', 'CVP-GEO-BST-003', 'CVP-GEO-BST-004', 'CVP-GEO-BST-005', 'CVP-GEO-BST-006', 'CVP-GEO-BST-007', 'CVP-GEO-BST-008'];

/** a burst in a px x px canvas, in colour `a` with `b` as the second colour; seeded */
export function paintBurst(c: C, id: BurstId, px: number, a: string, b: string, seed: number) {
  let s = seed >>> 0;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  c.save();
  c.translate(px / 2, px / 2);
  const R = px * 0.48;
  c.fillStyle = a;
  c.strokeStyle = a;
  switch (id) {
    case 'CVP-GEO-BST-001':
      star(c, 0, 0, R, R * 0.62, 16);
      c.fill();
      c.fillStyle = b;
      star(c, 0, 0, R * 0.72, R * 0.46, 16, -Math.PI / 2 + 0.1);
      c.fill();
      break;
    case 'CVP-GEO-BST-002':
      for (let i = 0; i < 24; i++) {
        const t0 = (i / 24) * TAU;
        c.fillStyle = i % 2 ? a : b;
        c.beginPath();
        c.moveTo(0, 0);
        c.arc(0, 0, R, t0, t0 + TAU / 24);
        c.closePath();
        c.fill();
      }
      break;
    case 'CVP-GEO-BST-003':
      for (let i = 0; i < 70; i++) {
        const ang = r() * TAU;
        const d = R * (0.25 + r() * 0.75);
        c.fillStyle = r() > 0.5 ? a : b;
        c.save();
        c.translate(Math.cos(ang) * d, Math.sin(ang) * d);
        c.rotate(r() * 3);
        c.fillRect(-px * 0.018, -px * 0.008, px * 0.036, px * 0.016);
        c.restore();
      }
      break;
    case 'CVP-GEO-BST-004':
      c.lineWidth = px * 0.05;
      for (const k of [0.95, 0.7, 0.45]) {
        c.strokeStyle = k === 0.7 ? b : a;
        c.beginPath();
        c.arc(0, 0, R * k, 0, TAU);
        c.stroke();
      }
      break;
    case 'CVP-GEO-BST-005':
      c.lineWidth = px * 0.018;
      c.lineCap = 'round';
      for (let i = 0; i < 30; i++) {
        const ang = (i / 30) * TAU + r() * 0.2;
        c.strokeStyle = i % 3 ? a : b;
        c.beginPath();
        c.moveTo(Math.cos(ang) * R * 0.3, Math.sin(ang) * R * 0.3);
        c.quadraticCurveTo(Math.cos(ang + 0.2) * R * 0.7, Math.sin(ang + 0.2) * R * 0.7, Math.cos(ang) * R * (0.8 + r() * 0.2), Math.sin(ang) * R * (0.8 + r() * 0.2));
        c.stroke();
      }
      break;
    case 'CVP-GEO-BST-006':
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * TAU + r() * 0.2;
        c.fillStyle = i % 2 ? a : b;
        c.beginPath();
        c.moveTo(Math.cos(ang - 0.08) * R * 0.25, Math.sin(ang - 0.08) * R * 0.25);
        c.lineTo(Math.cos(ang) * R * (0.75 + r() * 0.25), Math.sin(ang) * R * (0.75 + r() * 0.25));
        c.lineTo(Math.cos(ang + 0.1) * R * 0.3, Math.sin(ang + 0.1) * R * 0.3);
        c.closePath();
        c.fill();
      }
      break;
    case 'CVP-GEO-BST-007': {
      const step = px * 0.045;
      for (let y = -R; y <= R; y += step)
        for (let x = -R; x <= R; x += step) {
          const d = Math.hypot(x, y) / R;
          if (d > 1) continue;
          c.fillStyle = (Math.round(x / step) + Math.round(y / step)) % 2 ? a : b;
          c.beginPath();
          c.arc(x, y, step * 0.48 * (1 - d * 0.85), 0, TAU);
          c.fill();
        }
      break;
    }
    default: {
      c.beginPath();
      for (let i = 0; i <= 24; i++) {
        const ang = (i / 24) * TAU;
        const k = 0.72 + (i % 2 ? 0.2 : 0) + r() * 0.08;
        c.lineTo(Math.cos(ang) * R * k, Math.sin(ang) * R * k);
      }
      c.closePath();
      c.fill();
      for (let i = 0; i < 6; i++) {
        const ang = r() * TAU;
        c.beginPath();
        c.arc(Math.cos(ang) * R * 0.95, Math.sin(ang) * R * 0.95, px * (0.015 + r() * 0.02), 0, TAU);
        c.fill();
      }
    }
  }
  c.restore();
}

// ---- cut-outs from the cover ---------------------------------------------------------------------------------------------
export const CUT_IDS: CutId[] = ['CVP-PRC-CUT-001', 'CVP-PRC-CUT-002', 'CVP-PRC-CUT-003', 'CVP-PRC-CUT-004'];

/** a sticker cut from the cover: the region (uv box) drawn unaltered inside the shape, white die-cut border, soft shadow */
export function paintCutout(c: C, id: CutId, px: number, cover: HTMLCanvasElement, box: { x: number; y: number; w: number; h: number }, seed: number) {
  const shape = (a: C) => {
    a.beginPath();
    const R = 46;
    switch (id) {
      case 'CVP-PRC-CUT-002':
        a.arc(0, 0, R, 0, TAU);
        break;
      case 'CVP-PRC-CUT-003': {
        let s = seed >>> 0;
        const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
        for (let i = 0; i < 40; i++) {
          const t = i / 40;
          const side = Math.floor(t * 4);
          const f = (t * 4) % 1;
          const j = (r() - 0.5) * 6;
          const pts: [number, number][] = [[-R + f * 2 * R, -R + j], [R + j, -R + f * 2 * R], [R - f * 2 * R, R + j], [-R + j, R - f * 2 * R]];
          a.lineTo(...pts[side]!);
        }
        a.closePath();
        break;
      }
      case 'CVP-PRC-CUT-004':
        star(a, 0, 0, R * 1.05, R * 0.55, 5);
        break;
      default:
        a.roundRect(-R, -R * 0.8, R * 2, R * 1.6, 12);
    }
  };
  dieCut(
    c,
    px,
    (a) => {
      a.save();
      shape(a);
      a.clip();
      const S = cover.width;
      a.drawImage(cover, box.x * S, box.y * S, box.w * S, box.h * S, -50, -50, 100, 100);
      a.restore();
    },
    5,
  );
}

// ---- chips ---------------------------------------------------------------------------------------------------------------
export const CHIP_IDS: ChipId[] = ['CVP-TYP-CHP-001', 'CVP-TYP-CHP-002', 'CVP-TYP-CHP-003', 'CVP-TYP-CHP-004', 'CVP-TYP-CHP-005', 'CVP-TYP-CHP-006'];
