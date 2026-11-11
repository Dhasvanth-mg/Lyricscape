// More screens for "Code screens": everyday app screens the lyric gets typed into: a chat, a search box, a notepad, a spreadsheet, a
// phone notification, an email, a git commit, sticky notes, a post composer, a system alert, a code review and a calendar. All drawn
// in code as generic, unbranded layouts. Each comes in light or dark and any accent colour, and each line gets one of six camera
// moves, so a song cuts through hundreds of different-looking screens. Same rules as the rest of the scene: a sheet painted once
// into a texture, a camera path over it, the lyric typed on top; nothing depends on the clock except through the song's time.

import { mul, translate } from '../gpu';
import { camera, clamp, cursorOn, drawText, easeInOut, easeOut, easeOutExpo, hash01, lerp, noise1, prefixPx, smooth, textTex, typedChars, type Line } from './common';
import type { SceneFx, SceneHost } from './types';
import { hsl } from '../../variety';

export const APP_SCREENS = ['chat', 'search', 'notes', 'sheet', 'phone', 'email', 'git', 'sticky', 'post', 'alert', 'diff', 'calendar'] as const;
export type AppScreen = (typeof APP_SCREENS)[number];
export const CAMERA_MOVES = ['tilt', 'spin', 'slide', 'push', 'dutch', 'float'] as const;
export type CameraMove = (typeof CAMERA_MOVES)[number];

type Pal = { hue: number; dark: boolean; bg: string; panel: string; fg: string; sub: string; accent: string; line: string; soft: string };
export function screenPalette(hue: number, dark: boolean): Pal {
  return dark
    ? { hue, dark, bg: hsl(hue, 0.18, 0.07), panel: hsl(hue, 0.14, 0.12), fg: '#f1f2f6', sub: '#8d91a5', accent: hsl(hue, 0.75, 0.62), line: hsl(hue, 0.14, 0.2), soft: hsl(hue, 0.35, 0.2) }
    : { hue, dark, bg: hsl(hue, 0.18, 0.93), panel: '#ffffff', fg: '#1c1c22', sub: '#8a8a95', accent: hsl(hue, 0.68, 0.48), line: '#e2e2e8', soft: hsl(hue, 0.6, 0.92) };
}

const UI = (w = 500) => (px: number) => `${w} ${px}px "Inter Variable", "Segoe UI", system-ui, sans-serif`;
const MONO = (px: number) => `500 ${px}px "JetBrains Mono Variable", ui-monospace, monospace`;
const HAND = (px: number) => `400 ${px}px "Permanent Marker", "Comic Sans MS", cursive`;

type C = CanvasRenderingContext2D;
function box(c: C, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fillStyle = fill;
  c.fill();
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 2;
    c.stroke();
  }
}
function txt(c: C, s: string, x: number, y: number, font: string, col: string, align: CanvasTextAlign = 'left') {
  c.font = font;
  c.fillStyle = col;
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillText(s, x, y);
  c.textAlign = 'left';
}
/** grey placeholder lines, like text too small to read */
function bars(c: C, x: number, y: number, w: number, rows: number, gap: number, col: string, seed: number, th = 12) {
  for (let i = 0; i < rows; i++) box(c, x, y + i * gap, w * (0.45 + 0.55 * hash01(seed + i * 7.3)), th, th / 2, col);
}
function avatar(c: C, x: number, y: number, r: number, col: string) {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = col;
  c.fill();
}

type Spec = {
  w: number;
  h: number;
  /** where the lyric is typed: left edge, middle line, and the width it may use */
  field: { x: number; y: number; w: number };
  size: number;
  font: (px: number) => string;
  ink: (P: Pal) => string;
  clear: (P: Pal) => string;
  paint: (c: C, P: Pal) => void;
  /** how the cursor looks */
  caret?: 'bar' | 'under';
};

const SPECS: Record<AppScreen, Spec> = {
  chat: {
    w: 1500,
    h: 1100,
    field: { x: 190, y: 985, w: 1060 },
    size: 40,
    font: UI(450),
    ink: (P) => P.fg,
    clear: (P) => P.bg,
    paint: (c, P) => {
      c.fillStyle = P.bg;
      c.fillRect(0, 0, 1500, 1100);
      box(c, 0, 0, 1500, 120, 0, P.panel);
      avatar(c, 90, 60, 34, P.accent);
      txt(c, 'the group chat', 150, 48, UI(700)(34), P.fg);
      txt(c, 'online now', 150, 86, UI(400)(24), P.sub);
      const msgs: [boolean, number][] = [[false, 520], [false, 300], [true, 560], [false, 420], [true, 260], [true, 480], [false, 360]];
      let y = 170;
      msgs.forEach(([me, w], i) => {
        const x = me ? 1500 - 60 - w : 60;
        box(c, x, y, w, 86, 30, me ? P.accent : P.panel);
        bars(c, x + 28, y + 30, w - 56, 1, 0, me ? 'rgba(255,255,255,0.55)' : P.line, i * 3, 26);
        y += 112;
      });
      box(c, 0, 930, 1500, 170, 0, P.panel);
      box(c, 150, 945, 1150, 80, 40, P.bg, P.line);
      avatar(c, 1370, 985, 40, P.accent);
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(1352, 965);
      c.lineTo(1392, 985);
      c.lineTo(1352, 1005);
      c.closePath();
      c.fill();
      txt(c, '+', 85, 985, UI(400)(56), P.sub, 'center');
    },
  },
  search: {
    w: 1600,
    h: 1000,
    field: { x: 340, y: 360, w: 960 },
    size: 44,
    font: UI(400),
    ink: (P) => P.fg,
    clear: (P) => P.bg,
    paint: (c, P) => {
      c.fillStyle = P.bg;
      c.fillRect(0, 0, 1600, 1000);
      txt(c, 'find', 800, 200, UI(800)(110), P.accent, 'center');
      box(c, 250, 300, 1100, 120, 60, P.panel, P.line);
      c.strokeStyle = P.sub;
      c.lineWidth = 6;
      c.beginPath();
      c.arc(300, 352, 18, 0, Math.PI * 2);
      c.moveTo(313, 366);
      c.lineTo(328, 381);
      c.stroke();
      box(c, 250, 440, 1100, 400, 24, P.panel, P.line);
      for (let i = 0; i < 5; i++) {
        c.strokeStyle = P.line;
        c.beginPath();
        c.arc(305, 500 + i * 74, 12, 0, Math.PI * 2);
        c.stroke();
        bars(c, 340, 492 + i * 74, 700, 1, 0, P.line, i * 5, 18);
      }
    },
  },
  notes: {
    w: 1400,
    h: 1200,
    field: { x: 190, y: 383, w: 1100 },
    size: 46,
    font: HAND,
    ink: () => '#1f2a6b',
    clear: () => '#2a2622',
    paint: (c, P) => {
      c.fillStyle = '#fff3a8';
      c.fillRect(0, 0, 1400, 1200);
      c.fillStyle = hsl(P.hue, 0.5, 0.55);
      c.fillRect(0, 0, 1400, 90);
      c.strokeStyle = 'rgba(60,90,200,0.35)';
      c.lineWidth = 2;
      for (let y = 180; y < 1200; y += 68) {
        c.beginPath();
        c.moveTo(0, y + 30);
        c.lineTo(1400, y + 30);
        c.stroke();
      }
      c.strokeStyle = 'rgba(220,60,60,0.6)';
      c.beginPath();
      c.moveTo(160, 90);
      c.lineTo(160, 1200);
      c.stroke();
      txt(c, 'notes to self', 190, 247, HAND(44), '#1f2a6b');
      bars(c, 190, 450, 900, 4, 68, 'rgba(31,42,107,0.25)', 9, 16);
    },
  },
  sheet: {
    w: 1700,
    h: 1100,
    field: { x: 140, y: 125, w: 1450 },
    size: 34,
    font: UI(450),
    ink: (P) => P.fg,
    clear: (P) => P.bg,
    paint: (c, P) => {
      c.fillStyle = P.panel;
      c.fillRect(0, 0, 1700, 1100);
      box(c, 0, 0, 1700, 80, 0, P.accent);
      txt(c, 'budget_final_v7', 30, 40, UI(600)(30), '#ffffff');
      box(c, 0, 90, 1700, 70, 0, P.bg);
      txt(c, 'fx', 70, 125, UI(700)(30), P.sub, 'center');
      const cw = 210;
      const rh = 56;
      for (let col = 0; col < 8; col++) txt(c, String.fromCharCode(65 + col), 110 + col * cw + cw / 2, 190, UI(600)(24), P.sub, 'center');
      for (let r = 0; r < 15; r++) {
        txt(c, String(r + 1), 55, 245 + r * rh, UI(500)(22), P.sub, 'center');
        for (let col = 0; col < 8; col++) {
          c.strokeStyle = P.line;
          c.lineWidth = 1;
          c.strokeRect(110 + col * cw, 217 + r * rh, cw, rh);
          if (hash01(r * 13 + col) < 0.55) txt(c, String(Math.round(hash01(r * 7 + col * 3) * 9000) / 100), 110 + col * cw + cw - 14, 245 + r * rh, UI(400)(22), P.fg, 'right');
        }
      }
      c.strokeStyle = P.accent;
      c.lineWidth = 4;
      c.strokeRect(110 + cw * 2, 217 + rh * 4, cw, rh);
    },
  },
  phone: {
    w: 1000,
    h: 1500,
    field: { x: 190, y: 790, w: 700 },
    size: 38,
    font: UI(500),
    ink: () => '#111114',
    clear: () => '#050507',
    paint: (c, P) => {
      const g = c.createLinearGradient(0, 0, 1000, 1500);
      g.addColorStop(0, hsl(P.hue, 0.6, 0.35));
      g.addColorStop(1, hsl(P.hue + 0.15, 0.7, 0.15));
      c.fillStyle = g;
      c.fillRect(0, 0, 1000, 1500);
      txt(c, '9:41', 500, 330, UI(300)(190), 'rgba(255,255,255,0.92)', 'center');
      txt(c, 'Tuesday', 500, 450, UI(500)(40), 'rgba(255,255,255,0.75)', 'center');
      for (let i = 0; i < 3; i++) {
        box(c, 80, 690 + i * 220, 840, 190, 40, i === 0 ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.55)');
        box(c, 110, 715 + i * 220, 56, 56, 14, P.accent);
        txt(c, i === 0 ? 'messages · now' : 'reminders · 2m', 190, 742 + i * 220, UI(600)(26), '#444450');
        if (i) bars(c, 190, 785 + i * 220, 600, 2, 36, 'rgba(0,0,0,0.18)', i * 4, 18);
      }
    },
  },
  email: {
    w: 1600,
    h: 1150,
    field: { x: 270, y: 330, w: 1250 },
    size: 40,
    font: UI(500),
    ink: (P) => P.fg,
    clear: (P) => P.bg,
    paint: (c, P) => {
      c.fillStyle = P.bg;
      c.fillRect(0, 0, 1600, 1150);
      box(c, 60, 60, 1480, 1030, 24, P.panel, P.line);
      box(c, 60, 60, 1480, 90, 24, P.soft);
      txt(c, 'New message', 100, 105, UI(700)(32), P.fg);
      const rows = ['To', 'Cc', 'Subject'];
      rows.forEach((r, i) => {
        txt(c, r, 100, 210 + i * 120, UI(500)(30), P.sub);
        c.strokeStyle = P.line;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(100, 260 + i * 120);
        c.lineTo(1500, 260 + i * 120);
        c.stroke();
      });
      box(c, 270, 186, 260, 50, 25, P.soft);
      bars(c, 290, 199, 200, 1, 0, P.accent, 2, 22);
      bars(c, 100, 450, 1300, 7, 60, P.line, 11, 20);
      box(c, 100, 960, 200, 80, 40, P.accent);
      txt(c, 'Send', 200, 1000, UI(700)(32), '#ffffff', 'center');
    },
  },
  git: {
    w: 1700,
    h: 1000,
    field: { x: 590, y: 520, w: 1060 },
    size: 36,
    font: MONO,
    ink: (P) => hsl(P.hue, 0.7, 0.75),
    clear: () => '#07080b',
    paint: (c, P) => {
      c.fillStyle = '#0b0d12';
      c.fillRect(0, 0, 1700, 1000);
      box(c, 0, 0, 1700, 60, 0, '#1a1d25');
      ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => avatar(c, 40 + i * 40, 30, 12, col));
      const lines = ['~/songs (main) $ git status', 'On branch main', 'Changes to be committed:', '        modified:   verse.txt', '        new file:   chorus.txt', ''];
      lines.forEach((l, i) => txt(c, l, 40, 130 + i * 62, MONO(32), i === 0 ? '#e8e8ee' : i > 2 ? '#5fdc7a' : '#9aa0b4'));
      txt(c, '~/songs (main) $ git commit -m "', 40, 520, MONO(36), '#e8e8ee');
      txt(c, `[main ${Math.floor(hash01(P.hue * 99) * 0xfffffff).toString(16).slice(0, 7)}]`, 40, 640, MONO(30), '#6f7690');
    },
  },
  sticky: {
    w: 1600,
    h: 1100,
    field: { x: 560, y: 520, w: 480 },
    size: 52,
    font: HAND,
    ink: () => '#262018',
    clear: () => '#3a2c22',
    paint: (c, P) => {
      c.fillStyle = '#8b6a4f';
      c.fillRect(0, 0, 1600, 1100);
      for (let i = 0; i < 300; i++) {
        c.fillStyle = `rgba(0,0,0,${0.05 + hash01(i) * 0.08})`;
        c.fillRect(hash01(i * 3) * 1600, hash01(i * 5) * 1100, 4, 4);
      }
      const notes: [number, number, number][] = [[80, 90, -0.06], [1120, 120, 0.05], [130, 640, 0.04], [1080, 640, -0.05], [520, 300, -0.02]];
      notes.forEach(([x, y, a], i) => {
        c.save();
        c.translate(x + (i === 4 ? 280 : 190), y + (i === 4 ? 280 : 190));
        c.rotate(a);
        const s = i === 4 ? 560 : 380;
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.fillRect(-s / 2 + 10, -s / 2 + 14, s, s);
        c.fillStyle = i === 4 ? hsl(P.hue, 0.85, 0.78) : ['#ffe86b', '#ff9ec7', '#9ee6ff', '#b9f59a'][i % 4]!;
        c.fillRect(-s / 2, -s / 2, s, s);
        if (i !== 4) bars(c, -s / 2 + 40, -s / 2 + 80, s - 80, 4, 60, 'rgba(0,0,0,0.18)', i * 9, 16);
        c.restore();
      });
    },
  },
  post: {
    w: 1500,
    h: 1100,
    field: { x: 260, y: 300, w: 1100 },
    size: 42,
    font: UI(450),
    ink: (P) => P.fg,
    clear: (P) => P.bg,
    paint: (c, P) => {
      c.fillStyle = P.bg;
      c.fillRect(0, 0, 1500, 1100);
      box(c, 80, 140, 1340, 520, 30, P.panel, P.line);
      avatar(c, 175, 240, 50, P.accent);
      txt(c, "what's on your mind?", 260, 230, UI(400)(26), P.sub);
      c.strokeStyle = P.line;
      c.beginPath();
      c.moveTo(120, 540);
      c.lineTo(1380, 540);
      c.stroke();
      ['photo', 'song', 'feeling'].forEach((s, i) => {
        box(c, 140 + i * 230, 568, 200, 60, 30, P.soft);
        txt(c, s, 240 + i * 230, 598, UI(600)(26), P.accent, 'center');
      });
      box(c, 1190, 568, 200, 60, 30, P.accent);
      txt(c, 'Post', 1290, 598, UI(700)(28), '#ffffff', 'center');
      for (let k = 0; k < 2; k++) {
        box(c, 80, 700 + k * 200, 1340, 170, 30, P.panel, P.line);
        avatar(c, 160, 760 + k * 200, 36, P.line);
        bars(c, 220, 745 + k * 200, 900, 2, 44, P.line, k * 13, 20);
      }
    },
  },
  alert: {
    w: 1500,
    h: 1000,
    field: { x: 420, y: 470, w: 760 },
    size: 38,
    font: UI(500),
    ink: (P) => P.fg,
    clear: (P) => P.bg,
    paint: (c, P) => {
      c.fillStyle = P.bg;
      c.fillRect(0, 0, 1500, 1000);
      bars(c, 80, 80, 1200, 12, 70, P.line, 21, 24);
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(0, 0, 1500, 1000);
      box(c, 300, 260, 900, 480, 28, P.panel, P.line);
      box(c, 300, 260, 900, 80, 28, P.soft);
      txt(c, 'Are you sure?', 340, 300, UI(700)(32), P.fg);
      avatar(c, 360, 470, 34, P.accent);
      txt(c, '!', 360, 472, UI(800)(46), '#ffffff', 'center');
      box(c, 760, 640, 190, 70, 14, P.bg, P.line);
      txt(c, 'Cancel', 855, 675, UI(600)(28), P.fg, 'center');
      box(c, 970, 640, 190, 70, 14, P.accent);
      txt(c, 'OK', 1065, 675, UI(700)(28), '#ffffff', 'center');
    },
  },
  diff: {
    w: 1800,
    h: 1000,
    field: { x: 250, y: 532, w: 1450 },
    size: 32,
    font: MONO,
    ink: (P) => (P.dark ? '#d8ffe0' : '#0d3b1b'),
    clear: (P) => P.bg,
    paint: (c, P) => {
      c.fillStyle = P.panel;
      c.fillRect(0, 0, 1800, 1000);
      box(c, 0, 0, 1800, 90, 0, P.bg);
      txt(c, 'lyrics/verse.txt', 40, 45, MONO(30), P.fg);
      txt(c, '+1 −1', 1740, 45, MONO(28), P.sub, 'right');
      const rows: ['ctx' | 'del' | 'add', number][] = [['ctx', 0], ['ctx', 1], ['ctx', 2], ['del', 3], ['add', 4], ['ctx', 5], ['ctx', 6], ['ctx', 7], ['ctx', 8]];
      rows.forEach(([kind, i]) => {
        const y = 140 + i * 87;
        if (kind !== 'ctx') {
          c.fillStyle = kind === 'add' ? (P.dark ? 'rgba(46,160,67,0.28)' : 'rgba(46,160,67,0.18)') : P.dark ? 'rgba(248,81,73,0.25)' : 'rgba(248,81,73,0.15)';
          c.fillRect(0, y, 1800, 87);
        }
        txt(c, String(40 + i), 60, y + 44, MONO(26), P.sub, 'right');
        txt(c, kind === 'add' ? '+' : kind === 'del' ? '−' : ' ', 200, y + 44, MONO(32), kind === 'add' ? '#2ea043' : '#f85149');
        if (kind !== 'add') bars(c, 250, y + 34, 1100, 1, 0, kind === 'del' ? 'rgba(248,81,73,0.45)' : P.line, i * 3, 20);
      });
    },
  },
  calendar: {
    w: 1700,
    h: 1150,
    field: { x: 455, y: 432, w: 470 },
    size: 32,
    font: UI(600),
    ink: () => '#ffffff',
    clear: (P) => P.bg,
    paint: (c, P) => {
      c.fillStyle = P.panel;
      c.fillRect(0, 0, 1700, 1150);
      txt(c, 'This week', 40, 60, UI(800)(46), P.fg);
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      days.forEach((d, i) => txt(c, d, 160 + i * 220 + 110, 140, UI(600)(28), P.sub, 'center'));
      for (let hr = 0; hr < 10; hr++) {
        txt(c, `${hr + 8}:00`, 120, 200 + hr * 95, UI(400)(22), P.sub, 'right');
        c.strokeStyle = P.line;
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(150, 190 + hr * 95);
        c.lineTo(1700, 190 + hr * 95);
        c.stroke();
      }
      const ev: [number, number, number][] = [[0, 1, 1.5], [1, 3, 1], [3, 0.5, 2], [4, 5, 1], [5, 2, 1.5], [6, 6, 1]];
      ev.forEach(([d, s, l], i) => box(c, 165 + d * 220, 195 + s * 95, 205, l * 95 - 10, 12, hsl(P.hue + i * 0.13, 0.55, P.dark ? 0.35 : 0.8)));
      box(c, 385, 385, 650, 190, 14, P.accent);
    },
  },
};

/** how many different screens these add (types x light/dark x 12 accent colours x camera moves) */
export const APP_SCREEN_LOOKS = APP_SCREENS.length * 2 * 12 * CAMERA_MOVES.length;

/**
 * Draw one line typed into an app screen. `hue` and `dark` give the screen its colours; `move` is the camera.
 */
export function drawAppShot(h: SceneHost, line: Line, fx: SceneFx, kind: AppScreen, hue: number, dark: boolean, move: CameraMove): void {
  const { W, H, frame } = h;
  const t = frame.tMs;
  const a = line.age;
  const D = line.dur;
  const S = SPECS[kind];
  const P = screenPalette(hue, dark || kind === 'git');
  const sheet = h.tex(`sheet|app|${kind}|${Math.round(hue * 1000)}|${P.dark ? 1 : 0}`, S.w * 2, S.h * 2, (c) => {
    c.scale(2, 2);
    S.paint(c, P);
  });
  h.clear(S.clear(P));
  // fit the lyric into its field
  const base = S.size;
  const wBase = h.measure(S.font(base * 3), line.text) / 3;
  const size = Math.max(14, base * Math.min(1, S.field.w / Math.max(1, wBase)));
  const tt = textTex(h, line.text, S.font, size, S.ink(P), { hi: 3 });
  const textW = tt.textW * tt.k;
  const n = typedChars(line.text, a, D * 0.08, D * 0.6, 24, 85);
  const prefix = prefixPx(h, tt, line.text, n);
  const k = W / 1280;
  const whip = 1 - smooth(0, 190, a);
  const out = smooth(D - 130, D, a);
  const settle = easeOutExpo(a / (D * 0.3));
  const late = easeInOut(clamp((a / D - 0.75) / 0.25));
  const fxx = S.field.x + Math.min(textW, S.field.w) / 2;
  const fyy = S.field.y;
  const jx = h.reduced ? 0 : noise1(t / 900, 1) * 5 * k;
  const jy = h.reduced ? 0 : noise1(t / 800, 2) * 4 * k;
  const fit = clamp((0.86 * W) / Math.max(320, Math.min(textW, S.field.w) + 160), 0.35, 2.6);
  let cam: { fx: number; fy: number; zoom: number; rot?: number; skew?: number };
  let lod = whip * 2.2 + out * 0.8;
  switch (move) {
    case 'tilt':
      cam = { fx: lerp(S.w / 2, fxx, settle), fy: lerp(S.h / 2, fyy + 40, settle), zoom: lerp(0.5 * k, fit, easeOut(clamp(a / (D * 0.5)))), rot: lerp(-26, -10, settle), skew: 0.08 };
      lod += (1 - settle) * 2;
      break;
    case 'spin':
      cam = { fx: lerp(S.w / 2, fxx, settle), fy: lerp(S.h / 2, fyy, settle), zoom: lerp(0.45 * k, fit, settle) * lerp(1, 1.35, late), rot: lerp(30, 0, settle) - late * 70 };
      lod += (1 - settle) * 2 + late * 2;
      break;
    case 'slide':
      cam = { fx: lerp(fxx - 500, fxx + 60, easeInOut(line.p)), fy: fyy, zoom: fit * 0.95, rot: -4 };
      break;
    case 'push':
      cam = { fx: fxx, fy: fyy, zoom: lerp(0.4 * k, fit, easeOutExpo(a / (D * 0.4))) * lerp(1, 1.12, line.p) };
      lod += (1 - settle) * 1.5;
      break;
    case 'dutch':
      cam = { fx: S.field.x + prefix * 0.9, fy: fyy, zoom: fit * 1.1, rot: 12 + Math.sin(t / 1500) * 1.5 };
      break;
    default:
      cam = { fx: fxx + Math.sin(t / 2100) * 40, fy: fyy + Math.cos(t / 2600) * 30, zoom: fit * lerp(0.92, 1.02, line.p), rot: Math.sin(t / 3000) * 3 };
  }
  const M = camera(W, H, { ...cam, tx: jx, ty: jy });
  h.sprite({ tex: sheet.tex, m: mul(M, translate(S.w / 2, S.h / 2)), w: S.w, h: S.h, alpha: 1, lod, mode: 0, camera: false });
  const tl = Math.max(0, lod - 0.3);
  drawText(h, tt, M, S.field.x, S.field.y, { clipPx: prefix, lod: tl });
  if (n < line.text.length || cursorOn(t)) {
    const on = n >= line.text.length && !cursorOn(t) ? 0 : 1;
    if (S.caret === 'under') h.shape({ kind: 0, m: mul(M, translate(S.field.x + prefix + size * 0.3, S.field.y + size * 0.5)), w: size * 0.55, h: 4, color: S.ink(P), alpha: on, radius: 0, soft: 0.5, camera: false });
    else h.shape({ kind: 0, m: mul(M, translate(S.field.x + prefix + 4, S.field.y)), w: Math.max(3, size * 0.08), h: size * 1.15, color: kind === 'git' ? S.ink(P) : P.accent, alpha: on, radius: 0, soft: 0.5, camera: false });
  }
  fx.mblur = [(whip * 0.05 + (move === 'spin' ? late * 0.07 : 0)) * (h.reduced ? 0 : 1), 0];
  fx.vignette = 0.6;
  fx.bloom = P.dark ? 1.1 : 0.35;
  fx.exposure = 1;
}
