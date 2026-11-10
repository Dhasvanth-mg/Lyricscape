// The hand that draws every Sketch Cards drawing. A drawing is code that calls this pen in a 100 x 100 box centred on (0, 0);
// the pen adds the human part: lines wobble a little along their length, overshoot their ends, circles do not quite close,
// fills sit slightly off their outlines (as a quick marker fill does). The wobble is seeded, so the same drawing with the same
// seed is the same picture every time (AGENTS.md rule 3), and a different seed is the same drawing by a slightly different hand.
//
// Paint roles instead of colours: `ink` (the outline), `accent` (one spot colour), `paper` (knock-outs), `shade` (a tint of the
// ink for hatching). The card's colour set decides what they are, so one drawing works on every card and process.

export type PenPaint = { ink: string; accent: string; paper: string; shade: string; width: number };
export type Role = 'ink' | 'accent' | 'paper' | 'shade';
type P = [number, number];

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Pen {
  private r: () => number;
  /** 0 = ruler-straight, 1 = loose; the dark register draws looser, the ballpoint tighter */
  constructor(
    readonly c: CanvasRenderingContext2D,
    readonly paint: PenPaint,
    seed: number,
    readonly loose = 0.6,
  ) {
    this.r = rng(seed);
    c.lineCap = 'round';
    c.lineJoin = 'round';
  }
  private j(k = 1) {
    return (this.r() - 0.5) * 2.2 * this.loose * k;
  }
  private col(role: Role) {
    return this.paint[role];
  }
  /** a wobbly path through points (the pen's own line) */
  private trace(pts: P[], closed: boolean) {
    const c = this.c;
    const out: P[] = [];
    const n = pts.length;
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = pts[i]!;
      const b = pts[(i + 1) % n]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const steps = Math.max(1, Math.round(len / 9));
      const nx = -(b[1] - a[1]) / (len || 1);
      const ny = (b[0] - a[0]) / (len || 1);
      const bow = this.j(0.9);
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        const off = Math.sin(t * Math.PI) * bow + this.j(0.35);
        out.push([a[0] + (b[0] - a[0]) * t + nx * off, a[1] + (b[1] - a[1]) * t + ny * off]);
      }
    }
    if (!closed) {
      // overshoot the last point a touch, as a quick stroke does
      const a = pts[n - 2] ?? pts[0]!;
      const b = pts[n - 1]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const k = 1 + (0.6 + this.r()) * this.loose * (1.4 / len);
      out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
    } else {
      // a closed shape rarely closes exactly: end a little past or short of the start
      const s = out[0]!;
      out.push([s[0] + this.j(1.2), s[1] + this.j(1.2)]);
    }
    c.beginPath();
    out.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  }

  /** a polyline (open) or polygon (closed) in ink, optionally filled with a role first */
  poly(pts: P[], o: { closed?: boolean; fill?: Role; stroke?: Role | null; w?: number } = {}) {
    const c = this.c;
    if (o.fill) {
      c.save();
      c.translate(this.j(1.5), this.j(1.5));
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      c.fillStyle = this.col(o.fill);
      c.fill();
      c.restore();
    }
    if (o.stroke === null) return this;
    this.trace(pts, o.closed ?? !!o.fill);
    c.strokeStyle = this.col(o.stroke ?? 'ink');
    c.lineWidth = this.paint.width * (o.w ?? 1);
    c.stroke();
    return this;
  }
  line(...pts: P[]) {
    return this.poly(pts, { closed: false });
  }
  /** a line in a role and weight */
  stroke(pts: P[], role: Role = 'ink', w = 1) {
    return this.poly(pts, { closed: false, stroke: role, w });
  }
  /** smooth curve through points (Catmull-Rom sampled into the wobbly tracer) */
  curve(pts: P[], o: { closed?: boolean; fill?: Role; stroke?: Role | null; w?: number } = {}) {
    const sm: P[] = [];
    const n = pts.length;
    const closed = o.closed ?? !!o.fill;
    const get = (i: number) => (closed ? pts[(i + n) % n]! : pts[Math.max(0, Math.min(n - 1, i))]!);
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = get(i - 1);
      const p1 = get(i);
      const p2 = get(i + 1);
      const p3 = get(i + 2);
      for (let k = 0; k < 6; k++) {
        const t = k / 6;
        const t2 = t * t;
        const t3 = t2 * t;
        sm.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    if (!closed) sm.push(pts[n - 1]!);
    return this.poly(sm, { ...o, closed });
  }
  ellipse(x: number, y: number, rx: number, ry: number, o: { fill?: Role; stroke?: Role | null; w?: number; from?: number; to?: number } = {}) {
    const from = o.from ?? 0;
    const to = o.to ?? Math.PI * 2;
    const full = to - from >= Math.PI * 2 - 1e-6;
    const n = Math.max(10, Math.round((Math.max(rx, ry) * (to - from)) / 5));
    const pts: P[] = [];
    for (let i = 0; i <= (full ? n - 1 : n); i++) {
      const a = from + ((to - from) * i) / n;
      pts.push([x + Math.cos(a) * rx, y + Math.sin(a) * ry]);
    }
    return this.poly(pts, { closed: full, fill: full ? o.fill : undefined, stroke: o.stroke, w: o.w });
  }
  circle(x: number, y: number, r: number, o: { fill?: Role; stroke?: Role | null; w?: number } = {}) {
    return this.ellipse(x, y, r, r, o);
  }
  arc(x: number, y: number, r: number, from: number, to: number, role: Role = 'ink', w = 1) {
    return this.ellipse(x, y, r, r, { from, to, stroke: role, w });
  }
  rect(x: number, y: number, w: number, h: number, o: { fill?: Role; stroke?: Role | null; w?: number } = {}) {
    return this.poly(
      [
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ],
      { closed: true, ...o },
    );
  }
  /** a solid dot (no outline wobble needed at this size) */
  dot(x: number, y: number, r: number, role: Role = 'ink') {
    const c = this.c;
    c.beginPath();
    c.arc(x + this.j(0.4), y + this.j(0.4), r, 0, Math.PI * 2);
    c.fillStyle = this.col(role);
    c.fill();
    return this;
  }
  /** quick parallel hatching inside a rectangle, at an angle (shading) */
  hatch(x: number, y: number, w: number, h: number, gap = 5, angle = -0.8, role: Role = 'shade') {
    const c = this.c;
    c.save();
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    const cx = x + w / 2;
    const cy = y + h / 2;
    const R = Math.hypot(w, h) / 2 + 2;
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    for (let d = -R; d <= R; d += gap) {
      const a: P = [cx + ca * -R - sa * d, cy + sa * -R + ca * d];
      const b: P = [cx + ca * R - sa * d, cy + sa * R + ca * d];
      this.stroke([a, b], role, 0.55);
    }
    c.restore();
    return this;
  }
  /** hatching clipped to a closed polygon */
  hatchIn(pts: P[], gap = 5, angle = -0.8, role: Role = 'shade') {
    const c = this.c;
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    c.save();
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.clip();
    this.hatch(Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), gap, angle, role);
    c.restore();
    return this;
  }
  /** a few short strokes radiating from a point (shine, shock, sparkle) */
  rays(x: number, y: number, r0: number, r1: number, n: number, start = 0, role: Role = 'ink') {
    for (let i = 0; i < n; i++) {
      const a = start + (i / n) * Math.PI * 2;
      this.stroke(
        [
          [x + Math.cos(a) * r0, y + Math.sin(a) * r0],
          [x + Math.cos(a) * r1, y + Math.sin(a) * r1],
        ],
        role,
      );
    }
    return this;
  }
  /** small wobbly squiggle (smoke, steam, motion) from (x, y) going up */
  squiggle(x: number, y: number, h: number, amp = 4, role: Role = 'ink') {
    const pts: P[] = [];
    for (let i = 0; i <= 6; i++) pts.push([x + Math.sin(i * 1.4) * amp, y - (h * i) / 6]);
    return this.curve(pts, { closed: false, stroke: role });
  }
  rnd() {
    return this.r();
  }
}
