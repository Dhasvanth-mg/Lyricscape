// The world around the screen: room plates (SCR-ENV-ROM-001..011), wallpapers (SCR-PRC-WAL-001..008), device frames
// (SCR-FRM-DEV-001..010) and glass (SCR-TEX-GLS-001..006). Rooms are out of focus by design: shapes, light and bokeh only, never
// detailed objects. Devices are invented and generic: no camera-bump shapes, logos or button layouts of a real product. All are
// painted in code (the spec allowed painted rooms; glass plates were to be photographed, which cannot be done here, so they are
// painted too: design-deviations D3-SCR-02).

import { fillRR, glow, rng, rr, withA, type Ctx } from './draw';

// ---- rooms -------------------------------------------------------------------------------------------------------------------
export const ROOM_IDS = Array.from({ length: 11 }, (_, i) => `SCR-ENV-ROM-${String(i + 1).padStart(3, '0')}`) as RoomId[];
export type RoomId = `SCR-ENV-ROM-0${string}`;

type RoomLook = {
  top: string;
  bottom: string;
  /** bokeh colours and how many discs */
  bokeh: string[];
  discs: number;
  /** one practical light: x, y (0..1), radius (share of the short side), colour */
  lamp: [number, number, number, string] | null;
  streaks?: string; // moving light streaks (train, car)
  rain?: boolean;
  tiles?: boolean;
  band?: string; // a window or counter band
};
const ROOMS: Record<string, RoomLook> = {
  'SCR-ENV-ROM-001': { top: '#0b0e18', bottom: '#151018', bokeh: ['#f3b66b', '#7aa2ff', '#ffd9a0'], discs: 14, lamp: [0.86, 0.2, 0.5, '#ffb36b'], band: '#1b2236' }, // bedroom at night
  'SCR-ENV-ROM-002': { top: '#d9e2ea', bottom: '#b9a993', bokeh: ['#fff6e0', '#ffffff', '#f0dcc0'], discs: 10, lamp: [0.15, 0.15, 0.9, '#fff3d6'], band: '#cdb59a' }, // morning kitchen
  'SCR-ENV-ROM-003': { top: '#2b2440', bottom: '#120f1c', bokeh: ['#ffb070', '#ff7a5c', '#ffd27a'], discs: 6, lamp: null, streaks: '#ffb070' }, // train window at dusk
  'SCR-ENV-ROM-004': { top: '#16120e', bottom: '#2a2018', bokeh: ['#ffcf8a', '#ffe1b0'], discs: 8, lamp: [0.2, 0.05, 0.7, '#ffc77a'], band: '#3a2b1e' }, // desk under a lamp
  'SCR-ENV-ROM-005': { top: '#0e1218', bottom: '#1a1410', bokeh: ['#ff9d3b', '#ffb85c', '#7ec8ff'], discs: 16, lamp: [0.5, 0.0, 0.6, '#ff9d3b'], rain: true }, // bus stop in rain
  'SCR-ENV-ROM-006': { top: '#22160f', bottom: '#120c08', bokeh: ['#ffbf69', '#ffd59a', '#e88a4a'], discs: 18, lamp: [0.7, 0.1, 0.35, '#ffbf69'] }, // cafe corner
  'SCR-ENV-ROM-007': { top: '#06070a', bottom: '#0d0f14', bokeh: ['#ffa94d', '#5ad1ff'], discs: 5, lamp: null, streaks: '#ffa94d', band: '#11151c' }, // car interior at night
  'SCR-ENV-ROM-008': { top: '#ff9a7a', bottom: '#2a2350', bokeh: ['#ffe2a8', '#ffffff', '#ffc2d6'], discs: 22, lamp: null, band: '#1d1838' }, // rooftop at dusk
  'SCR-ENV-ROM-009': { top: '#120622', bottom: '#060310', bokeh: ['#ff3fa4', '#4f7dff', '#9d4dff', '#ffd23f'], discs: 26, lamp: null }, // event lights
  'SCR-ENV-ROM-010': { top: '#d6e3ea', bottom: '#9fb2bd', bokeh: ['#ffffff', '#e8f6ff'], discs: 6, lamp: [0.5, 0.0, 0.8, '#f2fbff'], tiles: true }, // bathroom mirror light
  'SCR-ENV-ROM-011': { top: '#0d1614', bottom: '#050807', bokeh: ['#bfffe9', '#d8fff4'], discs: 7, lamp: [0.5, 0.45, 0.4, '#bfffe9'] }, // hospital corridor at night
};
export const roomIsLight = (id: RoomId) => id === 'SCR-ENV-ROM-002' || id === 'SCR-ENV-ROM-010';

/** a room plate in deep blur, tinted by the screen's spill */
export function paintRoom(c: Ctx, id: RoomId, w: number, h: number, seed: number, spill: string) {
  const L = ROOMS[id] ?? ROOMS['SCR-ENV-ROM-001']!;
  const r = rng(seed);
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, L.top);
  g.addColorStop(1, L.bottom);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
  const S = Math.min(w, h);
  if (L.band) {
    c.fillStyle = withA(L.band, 0.7);
    c.fillRect(0, h * (0.55 + r() * 0.1), w, h);
  }
  if (L.tiles) {
    c.strokeStyle = 'rgba(255,255,255,0.12)';
    c.lineWidth = S * 0.006;
    const k = S * 0.12;
    for (let x = 0; x < w; x += k) c.strokeRect(x, h * 0.5, k, h);
  }
  if (L.lamp) glow(c, L.lamp[0] * w, L.lamp[1] * h, L.lamp[2] * S, L.lamp[3], 0.55);
  if (L.streaks) {
    for (let i = 0; i < 9; i++) {
      const y = h * (0.15 + r() * 0.5);
      const x = r() * w;
      const len = w * (0.15 + r() * 0.35);
      const gg = c.createLinearGradient(x, 0, x + len, 0);
      gg.addColorStop(0, withA(L.streaks, 0));
      gg.addColorStop(0.5, withA(L.streaks, 0.35 + r() * 0.3));
      gg.addColorStop(1, withA(L.streaks, 0));
      c.fillStyle = gg;
      c.fillRect(x, y, len, S * (0.006 + r() * 0.012));
    }
  }
  for (let i = 0; i < L.discs; i++) {
    const col = L.bokeh[i % L.bokeh.length]!;
    const x = r() * w;
    const y = r() * h * 0.8;
    const rad = S * (0.025 + r() * 0.07);
    c.fillStyle = withA(col, 0.08 + r() * 0.16);
    c.beginPath();
    c.arc(x, y, rad, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = withA(col, 0.12);
    c.lineWidth = rad * 0.08;
    c.stroke();
  }
  if (L.rain) {
    c.strokeStyle = 'rgba(200,220,255,0.10)';
    c.lineWidth = S * 0.002;
    for (let i = 0; i < 160; i++) {
      const x = r() * w;
      const y = r() * h;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x - S * 0.01, y + S * 0.05);
      c.stroke();
    }
  }
  // the screen's spill on the room (weak, theme coloured)
  glow(c, w / 2, h * 0.55, S * 0.7, spill, 0.12);
}

// ---- wallpapers ----------------------------------------------------------------------------------------------------------------
export const WALL_IDS = Array.from({ length: 8 }, (_, i) => `SCR-PRC-WAL-${String(i + 1).padStart(3, '0')}`) as WallId[];
export type WallId = `SCR-PRC-WAL-00${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;

export function paintWall(c: Ctx, id: WallId, w: number, h: number, colours: string[], cover: HTMLCanvasElement | null, seed: number, neutral: string) {
  const a = colours[0] ?? '#334';
  const b = colours[1] ?? '#a56';
  const r = rng(seed);
  if ((id === 'SCR-PRC-WAL-001' || id === 'SCR-PRC-WAL-002') && !cover) id = 'SCR-PRC-WAL-004';
  switch (id) {
    case 'SCR-PRC-WAL-001': {
      // the cover heavily blurred and darkened 30%
      const s = Math.max(w, h) * 1.3;
      c.filter = `blur(${Math.round(Math.min(w, h) * 0.06)}px)`;
      c.drawImage(cover!, (w - s) / 2, (h - s) / 2, s, s);
      c.filter = 'none';
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.fillRect(0, 0, w, h);
      return;
    }
    case 'SCR-PRC-WAL-002': {
      // a region of the cover, unmodified, scaled to cover the screen; a scrim keeps the clock readable
      const s = Math.max(w, h) * 1.6;
      c.drawImage(cover!, (w - s) / 2 - s * 0.1, (h - s) / 2, s, s);
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(0,0,0,0.35)');
      g.addColorStop(0.5, 'rgba(0,0,0,0.1)');
      g.addColorStop(1, 'rgba(0,0,0,0.4)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      return;
    }
    case 'SCR-PRC-WAL-003': {
      const g = c.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, a);
      g.addColorStop(1, b);
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(0, 0, w, h);
      return;
    }
    case 'SCR-PRC-WAL-004': {
      c.fillStyle = a;
      c.fillRect(0, 0, w, h);
      const cols = [b, colours[2] ?? a, colours[3] ?? b, a];
      cols.forEach((col, i) => glow(c, (i % 2 ? 0.85 : 0.15) * w, (i < 2 ? 0.2 : 0.85) * h, Math.max(w, h) * 0.75, col, 0.85));
      c.fillStyle = 'rgba(0,0,0,0.22)';
      c.fillRect(0, 0, w, h);
      return;
    }
    case 'SCR-PRC-WAL-005':
      c.fillStyle = neutral;
      c.fillRect(0, 0, w, h);
      return;
    case 'SCR-PRC-WAL-006': {
      c.fillStyle = '#05060b';
      c.fillRect(0, 0, w, h);
      glow(c, w * 0.5, h * 1.1, Math.max(w, h) * 0.8, a, 0.35);
      for (let i = 0; i < 220; i++) {
        c.fillStyle = withA(r() < 0.2 ? b : '#ffffff', 0.3 + r() * 0.6);
        const s = r() < 0.08 ? 2.4 : 1.2;
        c.fillRect(r() * w, r() * h, s, s);
      }
      return;
    }
    case 'SCR-PRC-WAL-007': {
      // the Plaid desktop's tiled pattern in two song colours
      c.fillStyle = a;
      c.fillRect(0, 0, w, h);
      const k = Math.min(w, h) / 9;
      for (let x = 0; x < w; x += k) {
        c.fillStyle = withA(b, 0.35);
        c.fillRect(x, 0, k * 0.3, h);
        c.fillStyle = 'rgba(255,255,255,0.08)';
        c.fillRect(x + k * 0.55, 0, k * 0.08, h);
      }
      for (let y = 0; y < h; y += k) {
        c.fillStyle = withA(b, 0.3);
        c.fillRect(0, y, w, k * 0.3);
        c.fillStyle = 'rgba(0,0,0,0.12)';
        c.fillRect(0, y + k * 0.55, w, k * 0.08);
      }
      return;
    }
    default: {
      // paper grain: cream with fibre noise
      c.fillStyle = '#efe7d6';
      c.fillRect(0, 0, w, h);
      for (let i = 0; i < 1600; i++) {
        c.fillStyle = r() < 0.5 ? 'rgba(120,100,70,0.06)' : 'rgba(255,255,255,0.18)';
        c.fillRect(r() * w, r() * h, 1 + r() * 6, 1);
      }
    }
  }
}

// ---- device frames --------------------------------------------------------------------------------------------------------------
export const FRAME_IDS = Array.from({ length: 10 }, (_, i) => `SCR-FRM-DEV-${String(i + 1).padStart(3, '0')}`) as FrameId[];
export type FrameId = `SCR-FRM-DEV-0${string}`;

/** bezel sizes around the screen, in screen units: left/right, top, bottom; the frame's outer corner radius */
export function bezelOf(id: FrameId, sw: number, sh: number): { side: number; top: number; bottom: number; r: number; base: number } {
  switch (id) {
    case 'SCR-FRM-DEV-002':
      return { side: 16, top: 84, bottom: 96, r: 56, base: 0 };
    case 'SCR-FRM-DEV-004':
      return { side: 34, top: 34, bottom: 34, r: 44, base: 0 };
    case 'SCR-FRM-DEV-005':
      return { side: 26, top: 30, bottom: 26, r: 22, base: sh * 0.2 };
    case 'SCR-FRM-DEV-006':
      return { side: 18, top: 18, bottom: 40, r: 14, base: sh * 0.26 };
    case 'SCR-FRM-DEV-007':
      return { side: 70, top: 64, bottom: 96, r: 40, base: sh * 0.12 };
    case 'SCR-FRM-DEV-008':
      return { side: 40, top: 40, bottom: 40, r: 30, base: 0 };
    default:
      return { side: 14, top: 14, bottom: 14, r: Math.min(sw, sh) * 0.12 + 14, base: 0 };
  }
}

/** the frame drawn around a screen at (0,0)-(sw,sh) in screen units, into a canvas offset by `ox, oy` */
export function paintFrame(c: Ctx, id: FrameId, sw: number, sh: number, ox: number, oy: number, seed: number) {
  const b = bezelOf(id, sw, sh);
  const x = ox - b.side;
  const y = oy - b.top;
  const w = sw + b.side * 2;
  const h = sh + b.top + b.bottom;
  const body = id === 'SCR-FRM-DEV-007' ? '#d9d2c2' : id === 'SCR-FRM-DEV-002' ? '#e9e9ec' : '#15171b';
  // stand or keyboard deck first (behind)
  if (id === 'SCR-FRM-DEV-005') {
    c.fillStyle = '#2a2d33';
    c.beginPath();
    c.moveTo(x - w * 0.06, y + h);
    c.lineTo(x + w * 1.06, y + h);
    c.lineTo(x + w * 1.12, y + h + b.base);
    c.lineTo(x - w * 0.12, y + h + b.base);
    c.closePath();
    c.fill();
    // an abstract key grid on the deck
    c.fillStyle = '#1b1d22';
    for (let r = 0; r < 4; r++) for (let k = 0; k < 14; k++) fillRR(c, x + w * (0.04 + k * 0.066) - r * 4, y + h + 12 + r * (b.base * 0.18), w * 0.056, b.base * 0.13, 4, '#1b1d22');
  }
  if (id === 'SCR-FRM-DEV-006' || id === 'SCR-FRM-DEV-007') {
    c.fillStyle = id === 'SCR-FRM-DEV-007' ? '#bfb7a5' : '#22252b';
    c.fillRect(x + w * 0.42, y + h - 4, w * 0.16, b.base);
    fillRR(c, x + w * 0.28, y + h + b.base - 18, w * 0.44, 22, 8, id === 'SCR-FRM-DEV-007' ? '#cfc7b4' : '#2a2d33');
  }
  // the shadow on the surface, then the body
  c.fillStyle = 'rgba(0,0,0,0.35)';
  rr(c, x + 10, y + 18, w, h, b.r);
  c.fill();
  fillRR(c, x, y, w, h, b.r, body);
  // a thin edge highlight
  c.strokeStyle = id === 'SCR-FRM-DEV-007' || id === 'SCR-FRM-DEV-002' ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.12)';
  c.lineWidth = 2;
  rr(c, x + 1, y + 1, w - 2, h - 2, b.r - 1);
  c.stroke();
  if (id === 'SCR-FRM-DEV-002') {
    // generic round home key
    c.strokeStyle = '#b9bac0';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(ox + sw / 2, oy + sh + b.bottom / 2, 22, 0, Math.PI * 2);
    c.stroke();
    fillRR(c, ox + sw / 2 - 30, y + b.top / 2 - 3, 60, 6, 3, '#b9bac0');
  }
  if (id === 'SCR-FRM-DEV-007') {
    // the deep CRT: inner recess
    fillRR(c, ox - 18, oy - 18, sw + 36, sh + 36, 28, '#4a463e');
    c.fillStyle = '#8f8878';
    c.fillRect(x + w * 0.78, y + h - b.bottom * 0.62, w * 0.12, 10);
  }
  if (id === 'SCR-FRM-DEV-008') {
    // set into a dark dashboard
    c.fillStyle = '#0a0b0d';
    c.fillRect(x - w, y + h - 6, w * 3, h);
  }
  // the screen well (the screen sprite is drawn over it)
  fillRR(c, ox, oy, sw, sh, id === 'SCR-FRM-DEV-001' || id === 'SCR-FRM-DEV-003' || id === 'SCR-FRM-DEV-010' ? Math.max(4, b.r - b.side) : 6, '#000000');
}

/** over the screen: the cracked corner (SCR-FRM-DEV-003), the thumb (010) */
export function paintFrameOver(c: Ctx, id: FrameId, sw: number, sh: number, ox: number, oy: number, seed: number) {
  if (id === 'SCR-FRM-DEV-003') {
    const r = rng(seed);
    c.strokeStyle = 'rgba(255,255,255,0.45)';
    c.lineWidth = 1.2;
    const cx = ox + sw * 0.86;
    const cy = oy + sh * 0.08;
    for (let i = 0; i < 9; i++) {
      c.beginPath();
      c.moveTo(cx, cy);
      let px = cx;
      let py = cy;
      const a = (i / 9) * Math.PI * 2 + r();
      for (let k = 0; k < 4; k++) {
        px += Math.cos(a + (r() - 0.5) * 0.6) * sw * 0.05;
        py += Math.sin(a + (r() - 0.5) * 0.6) * sw * 0.05;
        c.lineTo(px, py);
      }
      c.stroke();
    }
  }
  if (id === 'SCR-FRM-DEV-010') {
    // an abstract thumb silhouette over the lower bezel, soft, 40%
    c.fillStyle = 'rgba(30,22,20,0.32)';
    c.beginPath();
    c.ellipse(ox + sw * 0.97, oy + sh * 0.99, sw * 0.13, sh * 0.05, -0.7, 0, Math.PI * 2);
    c.fill();
  }
}

// ---- glass --------------------------------------------------------------------------------------------------------------------
export const GLASS_IDS = ['SCR-TEX-GLS-001', 'SCR-TEX-GLS-002', 'SCR-TEX-GLS-003', 'SCR-TEX-GLS-004'] as const;
export type GlassId = (typeof GLASS_IDS)[number] | 'SCR-TEX-GLS-005';

/** a glass plate at 3-8% (never over the active field: the scene clips it away from the field) */
export function paintGlass(c: Ctx, id: GlassId, w: number, h: number, seed: number) {
  const r = rng(seed);
  switch (id) {
    case 'SCR-TEX-GLS-001':
      // fingerprint smudge: soft concentric arcs near the lower half
      c.strokeStyle = 'rgba(255,255,255,0.06)';
      for (let i = 0; i < 18; i++) {
        c.lineWidth = 1.5;
        c.beginPath();
        c.ellipse(w * 0.7, h * 0.78, 10 + i * 4, 14 + i * 5, 0.4, 0, Math.PI * 1.6);
        c.stroke();
      }
      return;
    case 'SCR-TEX-GLS-002': {
      // window reflection: a soft tilted rectangle
      c.save();
      c.translate(w * 0.3, h * 0.1);
      c.rotate(-0.35);
      const g = c.createLinearGradient(0, 0, w * 0.5, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.07)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w * 0.5, h * 1.4);
      c.restore();
      return;
    }
    case 'SCR-TEX-GLS-003':
      glow(c, w * 0.82, h * 0.12, Math.min(w, h) * 0.4, '#ffffff', 0.08);
      return;
    case 'SCR-TEX-GLS-004':
      for (let i = 0; i < 90; i++) {
        c.fillStyle = `rgba(255,255,255,${0.04 + r() * 0.06})`;
        c.beginPath();
        c.arc(r() * w, r() * h, 0.6 + r() * 1.4, 0, Math.PI * 2);
        c.fill();
      }
      return;
    default:
      // CRT shadow mask (aperture grille)
      for (let x = 0; x < w; x += 3) {
        c.fillStyle = 'rgba(0,0,0,0.18)';
        c.fillRect(x, 0, 1, h);
      }
  }
}
