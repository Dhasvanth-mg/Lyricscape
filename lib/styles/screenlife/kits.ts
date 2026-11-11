// Screenlife app kits (SCR-UIK-APP-*) and their states (SCR-UIK-STA-*): invented interfaces, original design language
// (rounded rectangles on an 8-unit grid, the theme's neutral ramp, one accent), no real app's chrome, icons, names or colours.
// Every non-lyric word comes from the song's metadata (SCR-PRC-META-001..008): the contact is the artist, timestamps and
// clocks are song time, the battery is the song remaining, file names are the title and the section, search suggestions are
// only lines that are already timed. Nothing is ever written in another person's voice (the fabricated-conversation rule).
//
// A kit is laid out in screen units (a phone is 390 x 844) by a pure function of what has been written so far (the kit layout
// engine); the layout gives three painted layers (back, content, front) and where the active field is. The lyric size is passed
// in: the camera decides the scale, and the lyric size is raised until its x-height meets the floor at that scale.

import type { Script } from '../sketch-cards/letter';
import { clock, fillRR, glow, rng, rr, textAt, withA, wrap, type Ctx, type Measure } from './draw';
import { font, type Face } from './fonts';
import type { Theme } from './theme';

export const KIT_IDS = [
  'SCR-UIK-APP-001', // Murmur messenger
  'SCR-UIK-APP-002', // Margin notes
  'SCR-UIK-APP-003', // Lantern search
  'SCR-UIK-APP-004', // Quire documents
  'SCR-UIK-APP-005', // Frame composer
  'SCR-UIK-APP-006', // tty terminal
  'SCR-UIK-APP-008', // Halo lock screen
  'SCR-UIK-APP-009', // Echo voice memo
  'SCR-UIK-APP-010', // Tick checklist
  'SCR-UIK-APP-012', // Wayfinder car display
  'SCR-UIK-APP-013', // Plaid desktop
] as const;
export type KitId = (typeof KIT_IDS)[number];

export type ScreenKind = 'phone' | 'tablet' | 'laptop' | 'crt' | 'car' | 'full';
export const SCREENS: Record<Exclude<ScreenKind, 'full'>, { w: number; h: number }> = {
  phone: { w: 390, h: 844 },
  tablet: { w: 1024, h: 720 },
  laptop: { w: 1280, h: 800 },
  crt: { w: 960, h: 720 },
  car: { w: 1200, h: 520 },
};

export type Sent = { text: string; script: Script; atMs: number; repeat: number; line: number };

export type KitEnv = {
  kit: KitId;
  screen: { w: number; h: number };
  /** the lyric size in screen units (already raised to the x-height floor) */
  size: number;
  theme: Theme;
  script: Script;
  rtl: boolean;
  title: string;
  artist: string;
  section: string;
  /** song time at the start of the current line (clocks and timestamps) and the song's length */
  nowMs: number;
  durationMs: number;
  /** what has been written in this section, oldest first */
  sent: Sent[];
  /** the full text of the line being written (sizes the field), or null in a gap */
  current: string | null;
  /** the next already-timed lines (search suggestions; never invented) */
  upcoming: string[];
  cover: HTMLCanvasElement | null;
  /** the kit's state for this section (SCR-UIK-STA-*) */
  state: string;
  measure: Measure;
  seed: number;
  /** terminal phosphor: green or amber */
  phosphor: 'green' | 'amber';
};

export type FieldSpec = {
  x: number;
  y: number;
  w: number;
  face: Face;
  weight: number;
  size: number;
  /** row pitch in units */
  lh: number;
  color: string;
  rtl: boolean;
  align: 'start' | 'center';
  caret: 'bar' | 'block' | 'underline';
  caretColor: string;
  /** 'top': rows run down from y; 'bottom': the last row's bottom sits at y (chat input grows upward) */
  anchor: 'top' | 'bottom';
  prefix?: { text: string; color: string };
  /** a card painted behind the text (lock-screen notification, nav banner) */
  card?: { x: number; y: number; w: number; h: number; r: number; fill: string; head?: string; headColor?: string; glyph?: 'bell' | 'arrow' | 'wave' };
  placeholder?: string;
};

export type Spec = {
  back(c: Ctx): void;
  content(c: Ctx): void;
  front(c: Ctx): void;
  /** content scroll in units (applied when the content is painted) */
  field: FieldSpec | null;
  /** where the camera looks: the active field, and the newest written item */
  focus: { x: number; y: number };
  newest: { x: number; y: number } | null;
  /** where a typing indicator (three dots) sits in a gap, if the kit has one */
  indicator: { x: number; y: number; r: number } | null;
  /** a live clock the scene draws (lock screen, recorder) */
  clockAt: { x: number; y: number; size: number; color: string; face: Face } | null;
  /** terminals glow; light kits never do (invalid-combination table) */
  glowOk: boolean;
  bg: string;
};

// ---- shared chrome -------------------------------------------------------------------------------------------------------
function statusBar(c: Ctx, e: KitEnv, color: string) {
  const w = e.screen.w;
  textAt(c, clock(e.nowMs), 28, 24, font('ui', 600, 15), color);
  // battery = song remaining (SCR-PRC-META-003)
  const rem = Math.max(0, Math.min(1, 1 - e.nowMs / Math.max(1, e.durationMs)));
  c.strokeStyle = withA(color, 0.8);
  c.lineWidth = 1.4;
  rr(c, w - 54, 17, 26, 13, 3.5);
  c.stroke();
  fillRR(c, w - 52, 19, 22 * rem, 9, 2, rem < 0.1 ? '#e5484d' : color);
  c.fillStyle = color;
  c.fillRect(w - 27, 21, 2, 5);
  // signal: four rising bars (generic)
  for (let i = 0; i < 4; i++) fillRR(c, w - 92 + i * 6, 28 - 4 - i * 3, 4, 4 + i * 3, 1, withA(color, i < 3 ? 1 : 0.35));
}

function avatar(c: Ctx, x: number, y: number, r: number, e: KitEnv) {
  const g = c.createLinearGradient(x - r, y - r, x + r, y + r);
  g.addColorStop(0, e.theme.accent);
  g.addColorStop(1, e.theme.accent2);
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  const initial = Array.from(e.artist.trim() || '?')[0]!.toUpperCase();
  textAt(c, initial, x, y + 1, font('ui', 700, r * 0.95), '#ffffff', false, 'center');
}

function keyboard(c: Ctx, e: KitEnv, top: number) {
  // an abstract key grid: no letters, no real layout branding
  const { w, h } = e.screen;
  const t = e.theme;
  c.fillStyle = t.dark ? '#1A1D23' : '#D7DADF';
  c.fillRect(0, top, w, h - top);
  const rows = [10, 9, 9];
  const kw = (w - 16) / 10;
  rows.forEach((n, r) => {
    const x0 = (w - n * kw) / 2;
    for (let i = 0; i < n; i++) fillRR(c, x0 + i * kw + 3, top + 12 + r * 52, kw - 6, 42, 6, t.dark ? '#33373F' : '#FDFDFE');
  });
  fillRR(c, w * 0.25, top + 12 + 3 * 52, w * 0.5, 42, 6, t.dark ? '#33373F' : '#FDFDFE');
  fillRR(c, 11, top + 12 + 3 * 52, w * 0.2, 42, 6, t.dark ? '#262A31' : '#B9BEC6');
  fillRR(c, w * 0.79, top + 12 + 3 * 52, w * 0.2, 42, 6, t.accent);
}

const ROW = (size: number, k = 1.25) => size * k;

// ---- SCR-UIK-APP-001 Murmur messenger ------------------------------------------------------------------------------------
function messenger(e: KitEnv): Spec {
  const { w, h } = e.screen;
  const t = e.theme;
  const sz = e.size;
  const hist = sz * 0.86;
  const lyricFont = font('ui', 500, sz, e.script);
  const fieldW = w - 32 - 28 - 52;
  const rows = e.current ? wrap(e.measure, lyricFont, e.current, fieldW).length : 1;
  const lh = ROW(sz);
  const kbTop = h - 240;
  const barH = Math.min(4, rows) * lh + 26;
  const barTop = kbTop - barH - 16;
  const headH = 112;
  // thread: newest bubble just above the input bar, older ones above it
  type B = { x: number; y: number; bw: number; bh: number; rows: string[]; f: string; label: string | null; meta: string | null; s: Sent };
  const bubbles: B[] = [];
  let y = barTop - 18;
  const maxBW = w * 0.72;
  for (let i = e.sent.length - 1; i >= 0 && y > headH; i--) {
    const s = e.sent[i]!;
    const f = font('ui', 500, hist, s.script);
    const r = wrap(e.measure, f, s.text, maxBW - 28);
    const tw = Math.max(...r.map((x) => e.measure(f, x)));
    const bw = Math.min(maxBW, tw + 28);
    const bh = r.length * ROW(hist) + 18;
    const meta = i === e.sent.length - 1 ? (e.state === 'SCR-UIK-STA-004' ? `Read ${clock(s.atMs + 1000)}` : 'Delivered') : null;
    if (meta) y -= 22;
    const label = s.repeat > 1 ? `sent again ×${s.repeat}` : null;
    y -= bh;
    const x = e.rtl ? 16 : w - 16 - bw;
    bubbles.push({ x, y, bw, bh, rows: r, f, label, meta, s });
    y -= label ? 30 : 10;
  }
  const first = bubbles[bubbles.length - 1];
  const field: FieldSpec = {
    x: e.rtl ? 32 + 52 + 12 : 32,
    y: barTop + 13 + barH - 26,
    w: fieldW,
    face: 'ui',
    weight: 500,
    size: sz,
    lh,
    color: t.text,
    rtl: e.rtl,
    align: 'start',
    caret: 'bar',
    caretColor: t.accent,
    anchor: 'bottom',
    placeholder: 'Message',
  };
  return {
    bg: t.bg,
    glowOk: false,
    back(c) {
      c.fillStyle = t.bg;
      c.fillRect(0, 0, w, h);
    },
    content(c) {
      if (first) textAt(c, clock(first.s.atMs), w / 2, first.y - (first.label ? 50 : 26), font('ui', 500, 13), t.dim, false, 'center');
      for (const b of bubbles) {
        fillRR(c, b.x, b.y, b.bw, b.bh, Math.min(22, ROW(hist) * 0.7), t.bubble);
        b.rows.forEach((r, k) => textAt(c, r, e.rtl ? b.x + b.bw - 14 : b.x + 14, b.y + 9 + ROW(hist) * (k + 0.5), b.f, t.onBubble, e.rtl));
        if (b.label) textAt(c, b.label, e.rtl ? b.x : b.x + b.bw, b.y - 14, font('ui', 500, 12.5), t.dim, e.rtl, 'end');
        if (b.meta) textAt(c, b.meta, e.rtl ? b.x : b.x + b.bw, b.y + b.bh + 12, font('ui', 500, 12.5), t.dim, e.rtl, 'end');
      }
    },
    front(c) {
      c.fillStyle = t.bg;
      c.fillRect(0, 0, w, headH);
      statusBar(c, e, t.text);
      c.fillStyle = t.rule;
      c.fillRect(0, headH - 1, w, 1);
      // back chevron, avatar, contact = artist (SCR-PRC-META-001), song title under it
      c.strokeStyle = t.accent;
      c.lineWidth = 2.6;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(26, 66);
      c.lineTo(16, 78);
      c.lineTo(26, 90);
      c.stroke();
      avatar(c, 58, 78, 18, e);
      textAt(c, e.artist, 86, 70, font('ui', 600, 16), t.text);
      textAt(c, e.title, 86, 90, font('ui', 400, 12.5), t.dim);
      // input bar and keyboard
      c.fillStyle = t.s1;
      c.fillRect(0, barTop - 8, w, kbTop - barTop + 8);
      fillRR(c, 16, barTop, w - 32 - 52, barH, Math.min(24, barH / 2), t.s2);
      c.fillStyle = t.accent;
      c.beginPath();
      const bx = e.rtl ? 16 + 20 : w - 16 - 20;
      c.arc(bx, barTop + barH - 22, 19, 0, Math.PI * 2);
      c.fill();
      // send arrow
      c.strokeStyle = '#ffffff';
      c.lineWidth = 2.6;
      c.beginPath();
      c.moveTo(bx, barTop + barH - 14);
      c.lineTo(bx, barTop + barH - 30);
      c.moveTo(bx - 6, barTop + barH - 24);
      c.lineTo(bx, barTop + barH - 30);
      c.lineTo(bx + 6, barTop + barH - 24);
      c.stroke();
      keyboard(c, e, kbTop);
    },
    field: e.current ? field : null,
    focus: { x: w / 2, y: barTop + barH / 2 },
    newest: bubbles[0] ? { x: bubbles[0].x + bubbles[0].bw / 2, y: bubbles[0].y + bubbles[0].bh / 2 } : null,
    indicator: { x: e.rtl ? w - 16 - 34 : 16 + 34, y: barTop - 36, r: 5 },
    clockAt: null,
  };
}

// ---- SCR-UIK-APP-002 Margin notes / SCR-UIK-APP-010 Tick checklist (flowing lists) --------------------------------------
function flowing(e: KitEnv, kind: 'notes' | 'list' | 'memo'): Spec {
  const { w, h } = e.screen;
  const t = e.theme;
  const sz = e.size;
  const hist = kind === 'memo' ? sz * 0.8 : sz * 0.92;
  const lead = kind === 'notes' ? 1.4 : 1.3;
  const indent = kind === 'list' ? 58 : kind === 'notes' && e.state !== 'SCR-UIK-STA-011' ? 40 : 24;
  const right = 24;
  const top = kind === 'memo' ? 470 : 200;
  const textW = w - indent - right;
  type It = { y: number; rows: string[]; f: string; s: Sent; size: number };
  const items: It[] = [];
  let y = top;
  for (const s of e.sent) {
    const f = font('ui', kind === 'memo' ? 400 : 500, hist, s.script);
    const r = wrap(e.measure, f, s.text, textW);
    items.push({ y, rows: r, f, s, size: hist });
    y += r.length * hist * lead + hist * 0.55;
  }
  const curF = font('ui', 500, sz, e.script);
  const curRows = e.current ? wrap(e.measure, curF, e.current, textW).length : 1;
  const fieldTop = y;
  // keep the field above 66% of the screen: older items scroll up under the header
  const limit = (kind === 'memo' ? h - 150 : h * 0.66) - curRows * sz * lead;
  const scroll = Math.max(0, fieldTop - limit);
  const paper = kind === 'notes' ? (t.dark ? '#16171A' : '#FBF8F1') : t.bg;
  const head = kind === 'memo' ? 150 : 176;
  const field: FieldSpec = {
    x: e.rtl ? right : indent,
    y: fieldTop - scroll,
    w: textW,
    face: 'ui',
    weight: 500,
    size: sz,
    lh: sz * lead,
    color: t.text,
    rtl: e.rtl,
    align: 'start',
    caret: 'bar',
    caretColor: t.accent,
    anchor: 'top',
  };
  const mark = (c: Ctx, yy: number, ticked: boolean, rowH: number) => {
    const cx = e.rtl ? w - 30 : 30;
    const cy = yy + rowH / 2;
    if (kind === 'list') {
      c.lineWidth = 2;
      c.strokeStyle = ticked ? t.accent : t.dim;
      c.fillStyle = t.accent;
      c.beginPath();
      c.arc(cx, cy, 11, 0, Math.PI * 2);
      if (ticked) {
        c.fill();
        c.strokeStyle = '#ffffff';
        c.lineWidth = 2.4;
        c.beginPath();
        c.moveTo(cx - 5, cy);
        c.lineTo(cx - 1, cy + 4);
        c.lineTo(cx + 6, cy - 4);
      }
      c.stroke();
    } else if (kind === 'notes' && e.state !== 'SCR-UIK-STA-011') {
      c.fillStyle = t.accent;
      c.beginPath();
      c.arc(e.rtl ? w - 26 : 26, cy, 3.6, 0, Math.PI * 2);
      c.fill();
    }
  };
  return {
    bg: paper,
    glowOk: false,
    back(c) {
      c.fillStyle = paper;
      c.fillRect(0, 0, w, h);
      if (kind === 'notes') {
        // the left rule of the notes paper
        c.fillStyle = withA(t.accent, 0.35);
        c.fillRect(e.rtl ? w - 12 : 12, 0, 1.5, h);
      }
    },
    content(c) {
      c.save();
      c.translate(0, -scroll);
      // title block (song title, section and time; SCR-PRC-META-005)
      const tf = kind === 'memo' ? font('ui', 600, 15) : font('ui', 700, 30, 'latin');
      if (kind !== 'memo') {
        textAt(c, e.title, e.rtl ? w - 24 : 24, 130, tf, t.text, e.rtl);
        textAt(c, `${e.section} · ${clock(e.nowMs)}`, e.rtl ? w - 24 : 24, 164, font('ui', 500, 13), t.dim, e.rtl);
      }
      for (const it of items) {
        const rowH = it.size * lead;
        const ticked = kind === 'list';
        mark(c, it.y, ticked, rowH);
        it.rows.forEach((r, k) => textAt(c, r, e.rtl ? w - indent : indent, it.y + rowH * (k + 0.5), it.f, kind === 'memo' ? withA(t.text, 0.62) : ticked ? withA(t.text, 0.7) : t.text, e.rtl));
        if (it.s.repeat > 1 && kind !== 'memo') textAt(c, `×${it.s.repeat}`, e.rtl ? 6 : w - 6, it.y + rowH / 2, font('ui', 600, 12), t.accent, e.rtl, 'end');
      }
      if (e.current) mark(c, fieldTop, false, sz * lead);
      c.restore();
    },
    front(c) {
      c.fillStyle = paper;
      c.fillRect(0, 0, w, kind === 'memo' ? 0 : 108 - Math.min(0, 0));
      statusBar(c, e, t.text);
      if (kind === 'memo') {
        // the recorder sits above the transcript; earlier lines scroll away under it
        c.fillStyle = paper;
        c.fillRect(0, 0, w, top - 12);
        drawRecorder(c, e, head);
        return;
      }
      // header: back to the list, and Done (accent)
      textAt(c, kind === 'list' ? '‹ Lists' : '‹ Notes', 16, 74, font('ui', 500, 16), t.accent);
      textAt(c, 'Done', w - 18, 74, font('ui', 600, 16), t.accent, false, 'end');
      if (scroll > 0) {
        const g = c.createLinearGradient(0, 100, 0, 130);
        g.addColorStop(0, paper);
        g.addColorStop(1, withA(paper, 0));
        c.fillStyle = g;
        c.fillRect(0, 100, w, 30);
      }
    },
    field: e.current ? field : null,
    focus: { x: w / 2, y: fieldTop - scroll + (curRows * sz * lead) / 2 },
    newest: items.length ? { x: w / 2, y: items[items.length - 1]!.y - scroll } : null,
    indicator: null,
    clockAt: kind === 'memo' ? { x: w / 2, y: 112, size: 44, color: t.text, face: 'ui' } : null,
  };
}

function drawRecorder(c: Ctx, e: KitEnv, head: number) {
  const { w, h } = e.screen;
  const t = e.theme;
  textAt(c, e.title, w / 2, 70, font('ui', 600, 16), t.text, false, 'center');
  // waveform (SCR-UIK-STA-035): bar heights from the written lines' lengths, a stand-in for energy (no audio is analysed)
  const r = rng(e.seed + e.sent.length * 7);
  const mid = head + 150;
  c.fillStyle = withA(t.accent, 0.9);
  for (let x = 16; x < w - 16; x += 6) {
    const k = 0.15 + r() * 0.85 * (0.4 + 0.6 * Math.abs(Math.sin(x * 0.035 + e.sent.length)));
    const bh = 8 + k * 110;
    fillRR(c, x, mid - bh / 2, 3, bh, 1.5, x > w * 0.5 ? withA(t.dim, 0.5) : withA(t.accent, 0.9));
  }
  c.fillStyle = '#e5484d';
  c.fillRect(w / 2 - 1, head + 40, 2, 220);
  // the record control
  c.beginPath();
  c.arc(w / 2, h - 92, 34, 0, Math.PI * 2);
  c.strokeStyle = withA(t.text, 0.7);
  c.lineWidth = 3;
  c.stroke();
  fillRR(c, w / 2 - 13, h - 105, 26, 26, 6, '#e5484d');
}

// ---- SCR-UIK-APP-003 Lantern search ----------------------------------------------------------------------------------------
function search(e: KitEnv): Spec {
  const { w, h } = e.screen;
  const t = e.theme;
  const sz = e.size;
  const f = font('ui', 500, sz, e.script);
  const fw = w - 40 - 44;
  const rows = e.current ? Math.min(3, wrap(e.measure, f, e.current, fw).length) : 1;
  const lh = ROW(sz, 1.22);
  const boxY = 150;
  const boxH = rows * lh + 30;
  const results = e.state === 'SCR-UIK-STA-016' && !e.current && e.sent.length > 0;
  const field: FieldSpec = { x: e.rtl ? 20 : 20 + 44, y: boxY + 15, w: fw, face: 'ui', weight: 500, size: sz, lh, color: t.text, rtl: e.rtl, align: 'start', caret: 'bar', caretColor: t.accent, anchor: 'top', placeholder: 'Ask anything' };
  return {
    bg: t.bg,
    glowOk: false,
    back(c) {
      c.fillStyle = t.bg;
      c.fillRect(0, 0, w, h);
    },
    content(c) {
      const top = boxY + boxH + 24;
      if (results) {
        // results page (SCR-UIK-STA-016): the line as a result title, abstract snippet bars (no invented text)
        const last = e.sent[e.sent.length - 1]!;
        const rf = font('ui', 600, sz * 0.86, last.script);
        const rr2 = wrap(e.measure, rf, last.text, w - 48);
        rr2.forEach((r, k) => textAt(c, r, e.rtl ? w - 24 : 24, top + 20 + k * sz * 1.1, rf, t.accent, e.rtl));
        let y = top + 30 + rr2.length * sz * 1.1;
        const rnd = rng(e.seed + last.line);
        for (let i = 0; i < 9; i++) {
          if (i % 3 === 0) y += 22;
          const bw = (w - 48) * (0.55 + rnd() * 0.45);
          fillRR(c, e.rtl ? w - 24 - bw : 24, y, bw, 10, 5, i % 3 === 0 ? withA(t.accent, 0.45) : t.s3);
          y += 20;
        }
        return;
      }
      // suggestions (SCR-UIK-STA-015): the song's next timed lines only (SCR-PRC-META-004), up to three
      const sg = e.upcoming.slice(0, 3);
      const sf = font('ui', 400, Math.max(15, sz * 0.62), e.script);
      sg.forEach((s, i) => {
        const yy = top + i * 54;
        c.strokeStyle = t.dim;
        c.lineWidth = 1.8;
        c.beginPath();
        c.arc(e.rtl ? w - 34 : 34, yy + 2, 7, 0, Math.PI * 2);
        c.moveTo(e.rtl ? w - 39 : 39, yy + 7);
        c.lineTo(e.rtl ? w - 44 : 44, yy + 12);
        c.stroke();
        const one = wrap(e.measure, sf, s, w - 90)[0] ?? s;
        textAt(c, one + (one.length < s.length ? '…' : ''), e.rtl ? w - 60 : 60, yy + 4, sf, t.dim, e.rtl);
        c.fillStyle = t.rule;
        c.fillRect(24, yy + 28, w - 48, 1);
      });
    },
    front(c) {
      c.fillStyle = t.bg;
      c.fillRect(0, 0, w, boxY - 8);
      statusBar(c, e, t.text);
      // the lantern glyph (invented), no logo
      const lx = w / 2;
      c.fillStyle = withA(t.accent, 0.9);
      fillRR(c, lx - 9, 80, 18, 24, 6, t.accent);
      fillRR(c, lx - 5, 74, 10, 6, 2, t.dim);
      glow(c, lx, 92, 26, t.accent, 0.25);
      fillRR(c, 20, boxY, w - 40, boxH, Math.min(26, boxH / 2), t.s2);
      c.strokeStyle = withA(t.accent, 0.8);
      c.lineWidth = 2;
      rr(c, 20, boxY, w - 40, boxH, Math.min(26, boxH / 2));
      c.stroke();
      c.strokeStyle = t.dim;
      c.lineWidth = 2;
      c.beginPath();
      const gx = e.rtl ? w - 40 : 40;
      c.arc(gx, boxY + 15 + lh / 2, 8, 0, Math.PI * 2);
      c.moveTo(gx + (e.rtl ? -6 : 6), boxY + 21 + lh / 2);
      c.lineTo(gx + (e.rtl ? -12 : 12), boxY + 27 + lh / 2);
      c.stroke();
    },
    field: e.current ? field : null,
    focus: { x: w / 2, y: boxY + boxH / 2 + 40 },
    newest: null,
    indicator: null,
    clockAt: null,
  };
}

// ---- SCR-UIK-APP-004 Quire documents (laptop) -----------------------------------------------------------------------------
function documents(e: KitEnv): Spec {
  const { w, h } = e.screen;
  const t = e.theme;
  const sz = e.size;
  const pageX = w * 0.2;
  const pageW = w * 0.6;
  const pad = 64;
  const textW = pageW - pad * 2;
  const lead = 1.5;
  const hist = sz * 0.92;
  type It = { y: number; rows: string[]; f: string };
  const items: It[] = [];
  let y = 236;
  for (const s of e.sent) {
    const f = font('serif', 400, hist, s.script);
    const r = wrap(e.measure, f, s.text, textW);
    items.push({ y, rows: r, f });
    y += r.length * hist * lead + hist * 0.5;
  }
  const curF = font('serif', 400, sz, e.script);
  const curRows = e.current ? wrap(e.measure, curF, e.current, textW).length : 1;
  const scroll = Math.max(0, y - (h * 0.64 - curRows * sz * lead));
  const canvas = t.dark ? '#1B1D21' : '#E4E5E8';
  const page = t.dark ? '#0F1013' : '#FFFFFF';
  const field: FieldSpec = { x: pageX + pad, y: y - scroll, w: textW, face: 'serif', weight: 400, size: sz, lh: sz * lead, color: t.text, rtl: e.rtl, align: 'start', caret: 'bar', caretColor: t.accent, anchor: 'top' };
  return {
    bg: canvas,
    glowOk: false,
    back(c) {
      c.fillStyle = canvas;
      c.fillRect(0, 0, w, h);
    },
    content(c) {
      c.save();
      c.translate(0, -scroll);
      c.fillStyle = 'rgba(0,0,0,0.12)';
      c.fillRect(pageX + 4, 96, pageW, Math.max(h, y + 400));
      c.fillStyle = page;
      c.fillRect(pageX, 92, pageW, Math.max(h, y + 400));
      // letter layout (SCR-UIK-STA-018): date as song time; the title as the heading
      textAt(c, clock(e.nowMs), e.rtl ? pageX + pad : pageX + pageW - pad, 140, font('ui', 500, 14), t.dim, e.rtl, 'end');
      textAt(c, e.title, e.rtl ? pageX + pageW - pad : pageX + pad, 186, font('serif', 400, 40, 'latin'), t.text, e.rtl);
      for (const it of items) it.rows.forEach((r, k) => textAt(c, r, e.rtl ? pageX + pageW - pad : pageX + pad, it.y + hist * lead * (k + 0.5), it.f, t.text, e.rtl));
      c.restore();
    },
    front(c) {
      // window chrome: three plain dots, the file name = song title and section (SCR-PRC-META-005), a ruler
      c.fillStyle = t.dark ? '#24272D' : '#F3F3F5';
      c.fillRect(0, 0, w, 52);
      [0, 1, 2].forEach((i) => {
        c.fillStyle = t.dim;
        c.beginPath();
        c.arc(24 + i * 20, 26, 6, 0, Math.PI * 2);
        c.fill();
      });
      textAt(c, `${e.title} — ${e.section}`, w / 2, 26, font('ui', 500, 15), t.dim, false, 'center');
      c.fillStyle = t.dark ? '#1F2227' : '#FAFAFB';
      c.fillRect(0, 52, w, 30);
      c.fillStyle = t.rule;
      for (let x = pageX; x <= pageX + pageW; x += 16) c.fillRect(x, (x - pageX) % 64 === 0 ? 62 : 70, 1, (x - pageX) % 64 === 0 ? 16 : 8);
      c.fillStyle = withA(t.accent, 0.8);
      c.fillRect(pageX + pad - 1, 58, 2, 22);
    },
    field: e.current ? field : null,
    focus: { x: pageX + pageW / 2, y: y - scroll + (curRows * sz * lead) / 2 },
    newest: items.length ? { x: pageX + pageW / 2, y: items[items.length - 1]!.y - scroll } : null,
    indicator: null,
    clockAt: null,
  };
}

// ---- SCR-UIK-APP-005 Frame composer ---------------------------------------------------------------------------------------
function composer(e: KitEnv): Spec {
  const { w, h } = e.screen;
  const t = e.theme;
  const sz = e.size;
  const side = w - 40;
  const photoY = 120;
  const capY = photoY + side + 24;
  const f = font('ui', 500, sz, e.script);
  const fw = w - 40 - 48;
  const lh = ROW(sz);
  const posted = !e.current && e.sent.length > 0;
  const last = e.sent[e.sent.length - 1];
  const field: FieldSpec = { x: e.rtl ? 20 : 20 + 48, y: capY, w: fw, face: 'ui', weight: 500, size: sz, lh, color: t.text, rtl: e.rtl, align: 'start', caret: 'bar', caretColor: t.accent, anchor: 'top', placeholder: 'Write a caption' };
  return {
    bg: t.bg,
    glowOk: false,
    back(c) {
      c.fillStyle = t.bg;
      c.fillRect(0, 0, w, h);
    },
    content(c) {
      // the photo is the album cover, unmodified (only scaled); without one, the song's own colours
      if (e.cover) c.drawImage(e.cover, 20, photoY, side, side);
      else {
        const g = c.createLinearGradient(20, photoY, 20 + side, photoY + side);
        g.addColorStop(0, t.accent);
        g.addColorStop(1, t.accent2);
        c.fillStyle = g;
        c.fillRect(20, photoY, side, side);
      }
      avatar(c, e.rtl ? w - 36 : 36, capY + lh / 2, 14, e);
      if (posted && last) {
        const pf = font('ui', 500, sz, last.script);
        wrap(e.measure, pf, last.text, fw).forEach((r, k) => textAt(c, r, e.rtl ? w - 68 : 68, capY + lh * (k + 0.5), pf, t.text, e.rtl));
      }
    },
    front(c) {
      c.fillStyle = t.bg;
      c.fillRect(0, 0, w, 108);
      statusBar(c, e, t.text);
      textAt(c, 'New post', w / 2, 76, font('ui', 600, 17), t.text, false, 'center');
      textAt(c, posted ? 'Posted' : 'Share', w - 20, 76, font('ui', 600, 16), t.accent, false, 'end');
      textAt(c, 'Cancel', 20, 76, font('ui', 500, 16), t.dim);
      // reaction bar (SCR-UIK-STA-023): the count is how many times the line has been sung (SCR-PRC-META-008)
      if (posted && last) {
        const ry = h - 70;
        c.fillStyle = t.rule;
        c.fillRect(0, ry - 26, w, 1);
        heartGlyph(c, 34, ry, 11, t.accent);
        textAt(c, String(last.repeat), 54, ry, font('ui', 600, 15), t.text);
      }
    },
    field: e.current ? field : null,
    focus: { x: w / 2, y: capY + lh },
    newest: null,
    indicator: null,
    clockAt: null,
  };
}

export function heartGlyph(c: Ctx, x: number, y: number, r: number, color: string) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x, y + r * 0.9);
  c.bezierCurveTo(x - r * 1.6, y - r * 0.1, x - r * 0.7, y - r * 1.3, x, y - r * 0.45);
  c.bezierCurveTo(x + r * 0.7, y - r * 1.3, x + r * 1.6, y - r * 0.1, x, y + r * 0.9);
  c.fill();
}

// ---- SCR-UIK-APP-006 tty terminal -----------------------------------------------------------------------------------------
export const PHOSPHOR = { green: { fg: '#8CFFA8', dim: '#3E8F57', bg: '#040A06' }, amber: { fg: '#FFC46B', dim: '#9A6A26', bg: '#0A0603' } } as const;
function terminal(e: KitEnv): Spec {
  const { w, h } = e.screen;
  const p = PHOSPHOR[e.phosphor];
  const sz = e.size;
  const lh = sz * 1.32;
  const margin = sz * 1.2;
  const prompt = '~ $ ';
  const f = font('mono', 500, sz, e.script);
  const promptW = e.measure(font('mono', 500, sz), prompt);
  const textW = w - margin * 2 - promptW;
  type It = { y: number; rows: string[]; out: string; s: Sent; f: string };
  const items: It[] = [];
  let y = margin + lh * 2;
  for (const s of e.sent) {
    const fs = font('mono', 500, sz, s.script);
    const r = wrap(e.measure, fs, s.text, textW);
    // output = line index and timing source label (SCR-PRC-META-007)
    const out = `[${String(s.line + 1).padStart(2, '0')}] ${clock(s.atMs)}${s.repeat > 1 ? `  x${s.repeat}` : ''}`;
    items.push({ y, rows: r, out, s, f: fs });
    y += (r.length + 1) * lh;
  }
  const statusH = lh * 1.4;
  // the prompt line stays above the bottom 14% (player chrome) and below 62%
  const curRows = e.current ? wrap(e.measure, f, e.current, textW).length : 1;
  const limit = Math.min(h * 0.62, h * 0.86 - statusH - curRows * lh);
  const scroll = Math.max(0, y - limit);
  const field: FieldSpec = { x: margin + promptW, y: y - scroll, w: textW, face: 'mono', weight: 500, size: sz, lh, color: p.fg, rtl: e.rtl, align: 'start', caret: 'block', caretColor: p.fg, anchor: 'top', prefix: { text: prompt, color: p.dim } };
  return {
    bg: p.bg,
    glowOk: true,
    back(c) {
      c.fillStyle = p.bg;
      c.fillRect(0, 0, w, h);
    },
    content(c) {
      c.save();
      c.translate(0, -scroll);
      textAt(c, `tty1  ${e.title}  ·  ${e.artist}`, margin, margin + lh * 0.5, font('mono', 500, sz * 0.62), p.dim);
      for (const it of items) {
        textAt(c, prompt, margin, it.y + lh * 0.5, font('mono', 500, sz), p.dim);
        it.rows.forEach((r, k) => textAt(c, r, e.rtl ? w - margin : margin + promptW, it.y + lh * (k + 0.5), it.f, withA(p.fg, 0.78), e.rtl));
        textAt(c, it.out, margin, it.y + lh * (it.rows.length + 0.5), font('mono', 500, sz * 0.7), p.dim);
      }
      c.restore();
    },
    front(c) {
      // status bar: song time and a text progress bar (SCR-UIK-STA-027)
      const sy = h * 0.86 - statusH;
      c.fillStyle = p.bg;
      c.fillRect(0, sy - 4, w, h - sy + 4);
      c.fillStyle = withA(p.fg, 0.14);
      c.fillRect(0, sy, w, statusH);
      const k = Math.max(0, Math.min(1, e.nowMs / Math.max(1, e.durationMs)));
      const n = 24;
      const bar = '#'.repeat(Math.round(k * n)) + '.'.repeat(n - Math.round(k * n));
      textAt(c, ` ${clock(e.nowMs)} / ${clock(e.durationMs)}  [${bar}]  ${e.section}`, margin * 0.5, sy + statusH / 2, font('mono', 600, sz * 0.62), p.fg);
    },
    field: e.current ? field : null,
    focus: { x: w / 2, y: y - scroll + lh },
    newest: null,
    indicator: null,
    clockAt: null,
  };
}

// ---- SCR-UIK-APP-008 Halo lock screen ---------------------------------------------------------------------------------------
function lock(e: KitEnv, paintWall: (c: Ctx, w: number, h: number) => void): Spec {
  const { w, h } = e.screen;
  const t = e.theme;
  const sz = e.size;
  const wide = w > h;
  const cardW = Math.min(w - 32, wide ? 640 : w - 32);
  const cardX = (w - cardW) / 2;
  const lh = ROW(sz, 1.2);
  const f = font('ui', 500, sz, e.script);
  const rows = e.current ? wrap(e.measure, f, e.current, cardW - 40).length : 1;
  const top = h * (wide ? 0.42 : 0.4);
  const cardH = 52 + rows * lh + 16;
  // earlier sung lines stack under the newest (three to five; SCR-UIK-STA-033)
  const stack = e.sent.slice(-4).reverse();
  const card = { x: cardX, y: top, w: cardW, h: cardH, r: 22, fill: t.dark ? 'rgba(28,31,38,0.86)' : 'rgba(250,250,252,0.88)', head: `${e.artist}`, headColor: t.dim, glyph: 'bell' as const };
  const field: FieldSpec = { x: cardX + 20, y: top + 46, w: cardW - 40, face: 'ui', weight: 500, size: sz, lh, color: t.text, rtl: e.rtl, align: 'start', caret: 'bar', caretColor: t.accent, anchor: 'top', card };
  const clockSize = wide ? 120 : 92;
  return {
    bg: t.bg,
    glowOk: false,
    back(c) {
      paintWall(c, w, h);
    },
    content(c) {
      let y = e.current ? top + cardH + 12 : top;
      for (const s of stack) {
        const sf = font('ui', 500, sz * 0.72, s.script);
        const r = wrap(e.measure, sf, s.text, cardW - 40).slice(0, 2);
        const ch = 40 + r.length * sz * 0.72 * 1.2 + 12;
        if (y + ch > h * 0.86) break;
        fillRR(c, cardX + 8, y, cardW - 16, ch, 18, t.dark ? 'rgba(28,31,38,0.7)' : 'rgba(250,250,252,0.72)');
        textAt(c, e.artist, e.rtl ? cardX + cardW - 28 : cardX + 28, y + 20, font('ui', 600, 12.5), t.dim, e.rtl);
        textAt(c, clock(s.atMs), e.rtl ? cardX + 28 : cardX + cardW - 28, y + 20, font('ui', 500, 12), t.dim, e.rtl, 'end');
        r.forEach((x, k) => textAt(c, x, e.rtl ? cardX + cardW - 28 : cardX + 28, y + 36 + sz * 0.72 * 1.2 * (k + 0.5), sf, withA(t.text, 0.86), e.rtl));
        y += ch + 10;
      }
    },
    front(c) {
      statusBar(c, e, '#ffffff');
      // the date line: title and artist (the clock above it is drawn live by the scene)
      textAt(c, `${e.title} · ${e.artist}`, w / 2, h * 0.27, font('ui', 600, wide ? 22 : 17), 'rgba(255,255,255,0.88)', false, 'center');
    },
    field: e.current ? field : null,
    focus: { x: w / 2, y: e.current ? top + cardH / 2 : h * 0.3 },
    newest: null,
    indicator: null,
    clockAt: { x: w / 2, y: h * 0.27 - clockSize * 0.62, size: clockSize, color: '#ffffff', face: 'ui' },
  };
}

// ---- SCR-UIK-APP-012 Wayfinder car display ----------------------------------------------------------------------------------
function car(e: KitEnv): Spec {
  const { w, h } = e.screen;
  const t = e.theme;
  const sz = e.size;
  const bannerW = w * 0.5;
  const lh = ROW(sz, 1.18);
  const f = font('ui', 700, sz, e.script);
  // between lines the last instruction stays on the banner (dimmed)
  const last = e.sent[e.sent.length - 1];
  const shownText = e.current ?? last?.text ?? null;
  const rows = shownText ? wrap(e.measure, f, shownText, bannerW - 110).length : 1;
  const card = { x: 20, y: 20, w: bannerW, h: rows * lh + 70, r: 18, fill: '#16181D', head: '', headColor: t.dim, glyph: 'arrow' as const };
  const field: FieldSpec = { x: 20 + 92, y: 20 + 22, w: bannerW - 110, face: 'ui', weight: 700, size: sz, lh, color: '#F4F6F8', rtl: e.rtl, align: 'start', caret: 'bar', caretColor: t.accent, anchor: 'top', card };
  const r = rng(e.seed);
  const roads = Array.from({ length: 7 }, () => ({ a: r() * w, b: r() * h, c: r() * w, d: r() * h }));
  return {
    bg: '#0B0D10',
    glowOk: false,
    back(c) {
      c.fillStyle = '#0B0D10';
      c.fillRect(0, 0, w, h);
      // abstract roads and the route (accent)
      c.lineCap = 'round';
      for (const rd of roads) {
        c.strokeStyle = '#1E232B';
        c.lineWidth = 14;
        c.beginPath();
        c.moveTo(rd.a, -20);
        c.quadraticCurveTo(rd.c, rd.b, rd.a * 0.6 + w * 0.2, h + 20);
        c.stroke();
      }
      c.strokeStyle = '#1E232B';
      c.lineWidth = 10;
      c.beginPath();
      c.moveTo(-20, h * 0.6);
      c.quadraticCurveTo(w * 0.5, h * 0.35, w + 20, h * 0.7);
      c.stroke();
      c.strokeStyle = t.accent;
      c.lineWidth = 10;
      c.beginPath();
      c.moveTo(w * 0.62, h + 20);
      c.bezierCurveTo(w * 0.64, h * 0.7, w * 0.7, h * 0.55, w * 0.82, h * 0.3);
      c.stroke();
      // position marker
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(w * 0.635, h * 0.8);
      c.lineTo(w * 0.62, h * 0.86);
      c.lineTo(w * 0.635, h * 0.84);
      c.lineTo(w * 0.65, h * 0.86);
      c.closePath();
      c.fill();
    },
    content(c) {
      if (e.current || !last) return;
      fillRR(c, card.x, card.y, card.w, card.h, card.r, card.fill);
      const lf = font('ui', 700, sz, last.script);
      wrap(e.measure, lf, last.text, bannerW - 110).forEach((r, k) => textAt(c, r, e.rtl ? 20 + bannerW - 18 : 20 + 92, 20 + 22 + lh * (k + 0.5), lf, withA('#F4F6F8', 0.7), e.rtl));
      c.fillStyle = withA(e.theme.accent, 0.7);
      c.beginPath();
      const ax = 20 + 46;
      const ay = 20 + card.h / 2;
      [[0, -26], [24, 0], [9, 0], [9, 26], [-9, 26], [-9, 0], [-24, 0]].forEach(([dx, dy]) => c.lineTo(ax + dx!, ay + dy!));
      c.closePath();
      c.fill();
    },
    front(c) {
      // bottom bar: song time, and arrival = the song's end (SCR-PRC-META-006)
      c.fillStyle = 'rgba(16,18,22,0.92)';
      c.fillRect(0, h - 54, w, 54);
      textAt(c, clock(e.nowMs), 24, h - 27, font('ui', 600, 20), '#F4F6F8');
      textAt(c, `arrive ${clock(e.durationMs)}`, w - 24, h - 27, font('ui', 500, 18), '#9AA3AE', false, 'end');
      textAt(c, e.title, w / 2, h - 27, font('ui', 500, 17), '#9AA3AE', false, 'center');
    },
    field: e.current ? field : null,
    focus: { x: 20 + bannerW / 2, y: 20 + card.h / 2 },
    newest: null,
    indicator: null,
    clockAt: null,
  };
}

// ---- SCR-UIK-APP-013 Plaid desktop (an invented late-90s window system) -------------------------------------------------------
function plaid(e: KitEnv, paintWall: (c: Ctx, w: number, h: number) => void): Spec {
  const { w, h } = e.screen;
  const t = e.theme;
  const sz = e.size;
  const face = '#C9C6BF';
  const bevel = (c: Ctx, x: number, y: number, ww: number, hh: number, inset = false) => {
    c.fillStyle = face;
    c.fillRect(x, y, ww, hh);
    c.fillStyle = inset ? '#7E7B75' : '#FFFFFF';
    c.fillRect(x, y, ww, 2);
    c.fillRect(x, y, 2, hh);
    c.fillStyle = inset ? '#FFFFFF' : '#5E5B56';
    c.fillRect(x, y + hh - 2, ww, 2);
    c.fillRect(x + ww - 2, y, 2, hh);
  };
  const win = (c: Ctx, x: number, y: number, ww: number, hh: number, title: string, active: boolean) => {
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.fillRect(x + 6, y + 6, ww, hh);
    bevel(c, x, y, ww, hh);
    c.fillStyle = active ? t.accent : '#8C8984';
    c.fillRect(x + 4, y + 4, ww - 8, 26);
    textAt(c, title, x + 12, y + 17, font('retro', 700, 15, 'latin'), '#ffffff');
    for (let i = 0; i < 2; i++) bevel(c, x + ww - 30 - i * 24, y + 7, 20, 20);
  };
  // front window: the chat; back window: a notepad of earlier lines
  const fx = w * 0.3;
  const fy = h * 0.2;
  const fw = w * 0.64;
  const fh = h * 0.62;
  const lh = ROW(sz, 1.25);
  const f = font('retro', 500, sz, e.script);
  const rows = e.current ? Math.min(3, wrap(e.measure, f, e.current, fw - 40).length) : 1;
  const inputH = rows * lh + 20;
  const inputY = fy + fh - inputH - 16;
  const field: FieldSpec = { x: fx + 20, y: inputY + 10, w: fw - 40, face: 'retro', weight: 500, size: sz, lh, color: '#101010', rtl: e.rtl, align: 'start', caret: 'underline', caretColor: '#101010', anchor: 'top' };
  return {
    bg: '#2a2a2a',
    glowOk: false,
    back(c) {
      paintWall(c, w, h);
    },
    content(c) {
      // notepad window with the section's earlier lines
      const nx = w * 0.05;
      const ny = h * 0.08;
      const nw = w * 0.42;
      const nh = h * 0.5;
      win(c, nx, ny, nw, nh, `${e.section}.txt`, false);
      c.fillStyle = '#FFFFFF';
      c.fillRect(nx + 8, ny + 36, nw - 16, nh - 44);
      let yy = ny + 52;
      for (const s of e.sent.slice(-8)) {
        const sf = font('retro', 400, 16, s.script);
        const r = wrap(e.measure, sf, s.text, nw - 36).slice(0, 2);
        for (const x of r) {
          if (yy > ny + nh - 18) break;
          textAt(c, x, nx + 18, yy, sf, '#202020', e.rtl);
          yy += 22;
        }
      }
      // the chat window
      win(c, fx, fy, fw, fh, `${e.artist} — chat`, true);
      c.fillStyle = '#FFFFFF';
      c.fillRect(fx + 8, fy + 36, fw - 16, inputY - fy - 48);
      let cy = inputY - 22;
      const hist = sz * 0.78;
      for (let i = e.sent.length - 1; i >= 0; i--) {
        const s = e.sent[i]!;
        const sf = font('retro', 500, hist, s.script);
        const r = wrap(e.measure, sf, s.text, fw - 60);
        cy -= r.length * hist * 1.25;
        if (cy < fy + 44) break;
        textAt(c, '»', fx + 18, cy + hist * 0.62, font('retro', 700, hist), t.accent);
        r.forEach((x, k) => textAt(c, x, fx + 40, cy + hist * 1.25 * (k + 0.5), sf, '#202020', e.rtl));
        cy -= 8;
      }
      bevel(c, fx + 10, inputY, fw - 20, inputH, true);
      c.fillStyle = '#FFFFFF';
      c.fillRect(fx + 12, inputY + 2, fw - 24, inputH - 4);
    },
    front(c) {
      // taskbar: original, a plain bar with a menu button and the song time
      bevel(c, 0, h - 40, w, 40);
      bevel(c, 6, h - 34, 92, 28);
      textAt(c, '◆ menu', 18, h - 20, font('retro', 700, 15, 'latin'), '#202020');
      bevel(c, w - 96, h - 34, 90, 28, true);
      textAt(c, clock(e.nowMs), w - 51, h - 20, font('retro', 600, 15, 'latin'), '#202020', false, 'center');
    },
    field: e.current ? field : null,
    focus: { x: fx + fw / 2, y: inputY },
    newest: null,
    indicator: null,
    clockAt: null,
  };
}

export type WallPainter = (c: Ctx, w: number, h: number) => void;

export function kitSpec(e: KitEnv, wall: WallPainter): Spec {
  switch (e.kit) {
    case 'SCR-UIK-APP-001':
      return messenger(e);
    case 'SCR-UIK-APP-002':
      return flowing(e, 'notes');
    case 'SCR-UIK-APP-003':
      return search(e);
    case 'SCR-UIK-APP-004':
      return documents(e);
    case 'SCR-UIK-APP-005':
      return composer(e);
    case 'SCR-UIK-APP-006':
      return terminal(e);
    case 'SCR-UIK-APP-008':
      return lock(e, wall);
    case 'SCR-UIK-APP-009':
      return flowing(e, 'memo');
    case 'SCR-UIK-APP-010':
      return flowing(e, 'list');
    case 'SCR-UIK-APP-012':
      return car(e);
    default:
      return plaid(e, wall);
  }
}

/** the device screen a kit runs on, per orientation (portrait export prefers the phone) */
export function screenFor(kit: KitId, landscape: boolean, fullW: number, fullH: number): { kind: ScreenKind; w: number; h: number } {
  switch (kit) {
    case 'SCR-UIK-APP-004':
      return { kind: 'laptop', ...SCREENS.laptop };
    case 'SCR-UIK-APP-006': {
      // the full-frame terminal: 80 columns in landscape, 40 in portrait; units follow the frame's shape
      const w = landscape ? 1280 : 720;
      return { kind: 'full', w, h: Math.round((w * fullH) / fullW) };
    }
    case 'SCR-UIK-APP-012':
      return { kind: 'car', ...SCREENS.car };
    case 'SCR-UIK-APP-013':
      return { kind: 'crt', ...SCREENS.crt };
    case 'SCR-UIK-APP-005':
      // the composer's photo slot is square: always a phone
      return { kind: 'phone', ...SCREENS.phone };
    case 'SCR-UIK-APP-008':
      return landscape ? { kind: 'laptop', ...SCREENS.laptop } : { kind: 'phone', ...SCREENS.phone };
    default:
      return landscape ? { kind: 'tablet', ...SCREENS.tablet } : { kind: 'phone', ...SCREENS.phone };
  }
}
