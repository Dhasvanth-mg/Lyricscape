// Original, deterministic cover art. Same input -> byte-identical SVG, no raster, no AI, no network.
// Used for the bundled demo songs (scripts/generate-demo-audio.mjs) and as the cover for any track that has none.
//
// Deliberately standalone (no imports) so a plain `node` script can load it.

export const ART_STYLES = ['sunset', 'bauhaus', 'contour', 'waves', 'orbit', 'mesh'] as const;
export type ArtStyle = (typeof ART_STYLES)[number];

export type CoverInput = {
  /** any stable string: the same seed always makes the same picture */
  seed: string;
  title?: string;
  artist?: string;
  /** [accent1, accent2, accent3, dark] as hex. Derived from the seed when absent. */
  palette?: string[];
  style?: ArtStyle;
};

const W = 800;

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
function rgb(c: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  const v = m ? parseInt(m[1]!, 16) : 0x808080;
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function mixHex(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return '#' + [0, 1, 2].map((i) => hex(x[i]! + (y[i]! - x[i]!) * t)).join('');
}
const luma = (c: string) => {
  const [r, g, b] = rgb(c);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

function hsl(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((v) => hex(v * 255)).join('');
}

/** [accent1, accent2, accent3, dark] from a seed: same recipe the visualizer uses for tracks without a palette. */
export function paletteFromSeed(seed: string): string[] {
  const h = hashString(seed) % 360;
  return [hsl(h, 88, 60), hsl((h + 42) % 360, 92, 62), hsl((h + 180) % 360, 70, 55), hsl(h, 38, 8)];
}

const f1 = (n: number) => n.toFixed(1);

// ---------------------------------------------------------------------------
// styles
// ---------------------------------------------------------------------------
type Ctx = { rnd: () => number; c1: string; c2: string; c3: string; bg: string; defs: string[] };

function sunset({ rnd, c1, c2, c3, bg, defs }: Ctx): string {
  const cx = 300 + rnd() * 200;
  const cy = 250 + rnd() * 110;
  const r = 175 + rnd() * 70;
  defs.push(
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${mixHex(bg, c3, 0.55)}"/></linearGradient>`,
    `<linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c2}"/><stop offset="1" stop-color="${c1}"/></linearGradient>`,
  );
  const cuts: string[] = [];
  for (let i = 0; i < 7; i++) cuts.push(`<rect x="0" y="${f1(cy + r * (0.08 + i * 0.13))}" width="${W}" height="${f1(r * (0.02 + i * 0.022))}" fill="#000"/>`);
  defs.push(`<mask id="cut"><rect width="${W}" height="${W}" fill="#fff"/>${cuts.join('')}</mask>`);
  const out = [`<rect width="${W}" height="${W}" fill="url(#sky)"/>`];
  for (let i = 0; i < 46; i++) out.push(`<circle cx="${f1(rnd() * W)}" cy="${f1(rnd() * W * 0.5)}" r="${f1(0.8 + rnd() * 1.8)}" fill="${c2}" opacity="${f1(0.25 + rnd() * 0.5)}"/>`);
  out.push(`<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r * 1.35)}" fill="${c1}" opacity="0.18"/>`);
  out.push(`<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}" fill="url(#sun)" mask="url(#cut)"/>`);
  const horizon = W * 0.68;
  out.push(`<rect y="${f1(horizon)}" width="${W}" height="${f1(W - horizon)}" fill="${mixHex(bg, '#000000', 0.4)}"/>`);
  const grid: string[] = [];
  for (let i = 0; i < 9; i++) {
    const y = horizon + Math.pow(i / 8, 1.9) * (W - horizon);
    grid.push(`M0 ${f1(y)}H${W}`);
  }
  for (let i = -8; i <= 8; i++) grid.push(`M${f1(W / 2 + i * 14)} ${f1(horizon)}L${f1(W / 2 + i * 120)} ${W}`);
  out.push(`<path d="${grid.join('')}" stroke="${c3}" stroke-width="2" fill="none" opacity="0.7"/>`);
  return out.join('');
}

function bauhaus({ rnd, c1, c2, c3, bg }: Ctx): string {
  const cell = W / 3;
  const cols = [c1, c2, c3, mixHex(bg, '#ffffff', 0.12)];
  const out = [`<rect width="${W}" height="${W}" fill="${mixHex(bg, '#ffffff', luma(bg) < 0.5 ? 0.06 : 0)}"/>`];
  for (let gy = 0; gy < 3; gy++) {
    for (let gx = 0; gx < 3; gx++) {
      const x = gx * cell;
      const y = gy * cell;
      const col = cols[Math.floor(rnd() * cols.length)]!;
      const alt = cols[Math.floor(rnd() * cols.length)]!;
      const pick = Math.floor(rnd() * 6);
      const rot = Math.floor(rnd() * 4) * 90;
      const g = (inner: string) => `<g transform="rotate(${rot} ${f1(x + cell / 2)} ${f1(y + cell / 2)})">${inner}</g>`;
      if (pick === 0) out.push(`<circle cx="${f1(x + cell / 2)}" cy="${f1(y + cell / 2)}" r="${f1(cell * 0.4)}" fill="${col}"/>`);
      else if (pick === 1) out.push(g(`<path d="M${f1(x)} ${f1(y + cell)}A${f1(cell)} ${f1(cell)} 0 0 1 ${f1(x + cell)} ${f1(y)}V${f1(y + cell)}Z" fill="${col}"/>`));
      else if (pick === 2) out.push(g(`<path d="M${f1(x)} ${f1(y + cell / 2)}A${f1(cell / 2)} ${f1(cell / 2)} 0 0 1 ${f1(x + cell)} ${f1(y + cell / 2)}Z" fill="${col}"/>`));
      else if (pick === 3) out.push(g(`<rect x="${f1(x + cell * 0.12)}" y="${f1(y + cell * 0.12)}" width="${f1(cell * 0.76)}" height="${f1(cell * 0.76)}" fill="${col}"/><circle cx="${f1(x + cell / 2)}" cy="${f1(y + cell / 2)}" r="${f1(cell * 0.2)}" fill="${alt}"/>`));
      else if (pick === 4) out.push(g(`<path d="M${f1(x + cell * 0.1)} ${f1(y + cell * 0.9)}L${f1(x + cell / 2)} ${f1(y + cell * 0.1)}L${f1(x + cell * 0.9)} ${f1(y + cell * 0.9)}Z" fill="${col}"/>`));
      else for (let k = 0; k < 5; k++) out.push(`<rect x="${f1(x + cell * 0.1)}" y="${f1(y + cell * (0.12 + k * 0.17))}" width="${f1(cell * 0.8)}" height="${f1(cell * 0.09)}" fill="${col}"/>`);
    }
  }
  return out.join('');
}

function contour({ rnd, c1, c2, c3, bg }: Ctx): string {
  const cx = 250 + rnd() * 300;
  const cy = 250 + rnd() * 300;
  const harm = [0, 1, 2].map(() => ({ k: 2 + Math.floor(rnd() * 4), a: 0.05 + rnd() * 0.09, p: rnd() * 6.283 }));
  const out = [`<rect width="${W}" height="${W}" fill="${bg}"/>`];
  const rings = 17;
  for (let i = rings; i >= 1; i--) {
    const r0 = i * 38;
    const pts: string[] = [];
    for (let s = 0; s <= 120; s++) {
      const th = (s / 120) * Math.PI * 2;
      const wob = 1 + harm.reduce((a, h) => a + h.a * Math.sin(h.k * th + h.p + i * 0.07), 0);
      pts.push(`${f1(cx + Math.cos(th) * r0 * wob)} ${f1(cy + Math.sin(th) * r0 * wob * 0.9)}`);
    }
    const col = i % 3 === 0 ? c1 : i % 3 === 1 ? c2 : c3;
    out.push(`<path d="M${pts.join('L')}Z" fill="${i % 4 === 0 ? mixHex(bg, col, 0.16) : 'none'}" stroke="${col}" stroke-width="${f1(2 + (i % 3))}" opacity="${f1(0.55 + (rings - i) * 0.025)}"/>`);
  }
  out.push(`<circle cx="${f1(cx)}" cy="${f1(cy)}" r="14" fill="${c2}"/>`);
  return out.join('');
}

function waves({ rnd, c1, c2, c3, bg }: Ctx): string {
  const cols = [c1, c2, c3, mixHex(c1, c3, 0.5), mixHex(c2, bg, 0.5)];
  const out = [`<rect width="${W}" height="${W}" fill="${bg}"/>`];
  const layers = 9;
  for (let i = 0; i < layers; i++) {
    const base = W * (0.2 + (i / layers) * 0.78);
    const a1 = 22 + rnd() * 34;
    const f = 1 + rnd() * 2.2;
    const ph = rnd() * 6.283;
    const a2 = 8 + rnd() * 14;
    const pts: string[] = [];
    for (let x = 0; x <= W; x += 10) pts.push(`${x} ${f1(base + Math.sin((x / W) * Math.PI * 2 * f + ph) * a1 + Math.sin((x / W) * Math.PI * 6 + ph * 2) * a2)}`);
    out.push(`<path d="M${pts.join('L')}V${W}H0Z" fill="${cols[i % cols.length]}" opacity="${f1(0.88)}"/>`);
    out.push(`<path d="M${pts.join('L')}" fill="none" stroke="${mixHex(cols[i % cols.length]!, '#ffffff', 0.35)}" stroke-width="2" opacity="0.5"/>`);
  }
  return out.join('');
}

function orbit({ rnd, c1, c2, c3, bg, defs }: Ctx): string {
  const cx = 300 + rnd() * 200;
  const cy = 280 + rnd() * 240;
  defs.push(`<radialGradient id="glow"><stop offset="0" stop-color="${c2}" stop-opacity="0.75"/><stop offset="1" stop-color="${c2}" stop-opacity="0"/></radialGradient>`);
  const out = [`<rect width="${W}" height="${W}" fill="${bg}"/>`];
  for (let i = 0; i < 80; i++) out.push(`<circle cx="${f1(rnd() * W)}" cy="${f1(rnd() * W)}" r="${f1(0.6 + rnd() * 1.6)}" fill="#fff" opacity="${f1(0.2 + rnd() * 0.6)}"/>`);
  out.push(`<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(210 + rnd() * 40)}" fill="url(#glow)"/>`);
  const tilt = -20 + rnd() * 40;
  for (let i = 1; i <= 6; i++) {
    const rx = 70 + i * 62;
    const ry = rx * (0.28 + rnd() * 0.12);
    out.push(`<ellipse cx="${f1(cx)}" cy="${f1(cy)}" rx="${f1(rx)}" ry="${f1(ry)}" transform="rotate(${f1(tilt)} ${f1(cx)} ${f1(cy)})" fill="none" stroke="${i % 2 ? c3 : c1}" stroke-width="2.5" opacity="${f1(0.85 - i * 0.08)}"/>`);
    const th = rnd() * 6.283;
    const px = cx + Math.cos(th) * rx;
    const py = cy + Math.sin(th) * ry;
    const rot = (tilt * Math.PI) / 180;
    const x = cx + (px - cx) * Math.cos(rot) - (py - cy) * Math.sin(rot);
    const y = cy + (px - cx) * Math.sin(rot) + (py - cy) * Math.cos(rot);
    out.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(7 + rnd() * 14)}" fill="${i % 2 ? c1 : c2}"/>`);
  }
  out.push(`<circle cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(48 + rnd() * 26)}" fill="${c1}"/>`);
  out.push(`<circle cx="${f1(cx - 14)}" cy="${f1(cy - 14)}" r="22" fill="${c2}" opacity="0.45"/>`);
  return out.join('');
}

function mesh({ rnd, c1, c2, c3, bg, defs }: Ctx): string {
  defs.push(`<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="78"/></filter>`);
  const out = [`<rect width="${W}" height="${W}" fill="${bg}"/>`, '<g filter="url(#soft)">'];
  const cols = [c1, c2, c3, mixHex(c1, c2, 0.5), c1];
  for (let i = 0; i < 6; i++) out.push(`<circle cx="${f1(rnd() * W)}" cy="${f1(rnd() * W)}" r="${f1(130 + rnd() * 150)}" fill="${cols[i % cols.length]}" opacity="${f1(0.7 + rnd() * 0.3)}"/>`);
  out.push('</g>');
  // a crisp ring so it still reads as a designed object, not a blur
  out.push(`<circle cx="${f1(280 + rnd() * 240)}" cy="${f1(280 + rnd() * 240)}" r="${f1(120 + rnd() * 60)}" fill="none" stroke="#fff" stroke-width="3" opacity="0.55"/>`);
  return out.join('');
}

const PAINT: Record<ArtStyle, (c: Ctx) => string> = { sunset, bauhaus, contour, waves, orbit, mesh };

/** Wrap the title into at most 3 short lines. */
function titleLines(title: string): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > 11 && lines.length < 2) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? cur + ' ' + w : w;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function coverStyleFor(seed: string): ArtStyle {
  return ART_STYLES[hashString(seed + '|style') % ART_STYLES.length]!;
}

export function generateCoverSvg(input: CoverInput): string {
  const palette = input.palette && input.palette.length >= 4 ? input.palette : paletteFromSeed(input.seed);
  const [c1, c2, c3, bg] = [palette[0]!, palette[1]!, palette[2]!, palette[3]!];
  const style = input.style ?? coverStyleFor(input.seed);
  const rnd = mulberry32(hashString(input.seed));
  const defs: string[] = [];
  const art = PAINT[style]({ rnd, c1, c2, c3, bg, defs });

  const lines = input.title ? titleLines(input.title) : [];
  const ink = luma(bg) > 0.55 ? '#14121f' : '#fbfaf6';
  const longest = Math.max(1, ...lines.map((l) => l.length));
  const size = Math.max(54, Math.min(120, 700 / (longest * 0.5)));
  let text = '';
  if (lines.length) {
    const y0 = W - 64 - (lines.length - 1) * size * 0.98;
    // a soft scrim so the title reads on any artwork
    text += `<rect x="0" y="${f1(y0 - size * 1.05)}" width="${W}" height="${f1(W - y0 + size * 1.05)}" fill="url(#scrim)"/>`;
    defs.push(`<linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg}" stop-opacity="0"/><stop offset="1" stop-color="${bg}" stop-opacity="0.78"/></linearGradient>`);
    text += lines
      .map((l, i) => `<text x="48" y="${f1(y0 + i * size * 0.98)}" font-family="Anton, Impact, 'Arial Black', sans-serif" font-size="${f1(size)}" fill="${ink}" letter-spacing="1.5">${esc(l.toUpperCase())}</text>`)
      .join('');
  }
  if (input.artist) {
    text += `<text x="50" y="${W - 26}" font-family="'JetBrains Mono', 'Courier New', monospace" font-size="22" fill="${ink}" opacity="0.75" letter-spacing="3">${esc(input.artist.toUpperCase().slice(0, 34))}</text>`;
  }
  defs.push(
    `<filter id="grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${hashString(input.seed) % 97}" stitchTiles="stitch"/><feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.6 -0.12"/></filter>`,
  );
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}"><defs>${defs.join('')}</defs>` +
    art +
    `<rect width="${W}" height="${W}" filter="url(#grain)" opacity="0.4"/>` +
    text +
    `</svg>`
  );
}

/** `data:` URL usable as an <img> / canvas source. */
export function coverDataUrl(input: CoverInput): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(generateCoverSvg(input));
}
