// computeFrame(): a PURE function of (timeline, time, viewport).
//
// There is no animation state and no wall clock here. Seeking to any timestamp
// reconstructs exactly the frame that normal playback would have shown, which is
// what makes scrubbing, rewinding and deterministic export possible.

import {
  clamp,
  contrastRatio,
  easeInBack,
  easeInCubic,
  easeOutBack,
  easeOutBounce,
  easeOutCubic,
  easeOutElastic,
  lerp,
  mix,
  rotateHue,
  smoothstep,
  textOn,
} from './util';
import { STYLES, estimateWidth, type FontDef, type StyleDef } from './styles';
import { EMOTION_DEFS, emojiForWord } from './emotion';
import type { DrawDoodle, DrawEmoji, DrawWord, FontKey, Frame, FrameEnv, Interlude, MarqueeRow, Scene, VisualTimeline, WordCue } from './types';

export const LEAD_MS = 70; // words land slightly early so impact meets the sung syllable
const APPEAR_MS = 260;
const EXIT_MS = 240;

// ---------------------------------------------------------------------------
// cheap integer hash noise in [0,1)
// ---------------------------------------------------------------------------
function noise(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b1, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const signed = (a: number, b: number) => noise(a, b) * 2 - 1;

// ---------------------------------------------------------------------------
// beats
// ---------------------------------------------------------------------------
export function beatStateAt(beats: number[], tMs: number): { pulse: number; index: number; strength: number } {
  if (beats.length === 0 || tMs < beats[0]!) return { pulse: 0, index: -1, strength: 0 };
  let lo = 0;
  let hi = beats.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (beats[mid]! <= tMs) lo = mid;
    else hi = mid - 1;
  }
  const since = tMs - beats[lo]!;
  const strength = lo % 4 === 0 ? 1 : 0.55;
  return { pulse: Math.exp(-since / 150) * strength, index: lo, strength };
}

// ---------------------------------------------------------------------------
// layout (cached per timeline + viewport)
// ---------------------------------------------------------------------------
type LayoutItem = { x: number; y: number; size: number; rot: number; font: FontKey; text: string; widthPx: number };
type SceneLayout = Map<string, LayoutItem>;

const layoutCache = new WeakMap<VisualTimeline, Map<string, SceneLayout>>();

function fontDef(style: StyleDef, key: FontKey): FontDef {
  return style.fonts[key];
}

function applyCase(def: FontDef, text: string): string {
  return def.uppercase ? text.toUpperCase() : text;
}

type Measure = (text: string, font: FontKey, sizePx: number) => number;

function pickFont(style: StyleDef, cue: WordCue, custom: VisualTimeline['custom']): FontKey {
  if (style.id === 'custom' && custom?.font) return custom.font;
  return (cue.emphasis ?? 0) > 0.62 ? style.accentFont : style.displayFont;
}

function layoutScene(tl: VisualTimeline, scene: Scene, env: FrameEnv, style: StyleDef): SceneLayout {
  const W = env.width;
  const H = env.height;
  const S = Math.min(H, W * 0.9);
  const maxW = W * 0.9;
  const measure: Measure =
    env.measure ?? ((text, font, size) => estimateWidth(text, fontDef(style, font), size));
  const out: SceneLayout = new Map();
  const cues = scene.words;
  const cased = cues.map((c) => {
    const font = pickFont(style, c, tl.custom);
    const def = fontDef(style, font);
    const upper = style.id === 'custom' && tl.custom?.uppercase === false ? false : def.uppercase;
    return { cue: c, font, text: upper ? c.text.toUpperCase() : c.text };
  });

  const width = (text: string, font: FontKey, size: number) => measure(text, font, size);

  // ---- single-word cut --------------------------------------------------------
  if (scene.preset === 'cut') {
    for (const w of cased) {
      let size = S * (0.36 + (w.cue.emphasis ?? 0) * 0.14);
      const wpx = width(w.text, w.font, size);
      if (wpx > maxW) size *= maxW / wpx;
      out.set(w.cue.id, {
        x: 0,
        y: 0,
        size,
        rot: (noise(scene.seed, hashId(w.cue.id)) - 0.5) * 8,
        font: w.font,
        text: w.text,
        widthPx: width(w.text, w.font, size),
      });
    }
    return out;
  }

  // ---- stack: one big word (or pair) per row -------------------------------------
  if (scene.preset === 'stack') {
    const perRow = cased.length <= 4 ? 1 : 2;
    const rows: (typeof cased)[] = [];
    for (let i = 0; i < cased.length; i += perRow) rows.push(cased.slice(i, i + perRow));
    const rowH = Math.min((H * 0.84) / rows.length, S * 0.36);
    rows.forEach((row, ri) => {
      const sizeCap = rowH * 0.92;
      // fit row to width
      let size = sizeCap;
      const gap = 0.3;
      const rowWidth = (sz: number) => row.reduce((a, w) => a + width(w.text, w.font, sz), 0) + gap * sz * (row.length - 1);
      const rw = rowWidth(size);
      if (rw > maxW) size *= maxW / rw;
      const total = rowWidth(size);
      const align = ri % 2 === 0 ? -1 : 1; // alternate left/right drift
      const baseX = align * Math.max(0, (maxW - total) / 2) * 0.55;
      let cursor = baseX - total / 2;
      const y = (ri - (rows.length - 1) / 2) * rowH;
      row.forEach((w) => {
        const wpx = width(w.text, w.font, size);
        out.set(w.cue.id, {
          x: cursor + wpx / 2,
          y,
          size,
          rot: signed(scene.seed, ri * 31 + 7) * 4,
          font: w.font,
          text: w.text,
          widthPx: wpx,
        });
        cursor += wpx + gap * size;
      });
    });
    return out;
  }

  // ---- ticker / burst / drop / wave: wrapped block, centered --------------------
  const tryRows = (size: number) => {
    const gap = size * 0.28;
    const rows: { items: typeof cased; widths: number[]; total: number }[] = [];
    let cur: { items: typeof cased; widths: number[]; total: number } = { items: [], widths: [], total: 0 };
    for (const w of cased) {
      const wpx = width(w.text, w.font, size);
      const add = cur.items.length ? gap + wpx : wpx;
      if (cur.items.length && cur.total + add > maxW) {
        rows.push(cur);
        cur = { items: [], widths: [], total: 0 };
        cur.items.push(w);
        cur.widths.push(wpx);
        cur.total = wpx;
      } else {
        cur.items.push(w);
        cur.widths.push(wpx);
        cur.total += add;
      }
    }
    if (cur.items.length) rows.push(cur);
    return { rows, gap };
  };

  const factor = scene.preset === 'burst' ? 1.18 : scene.preset === 'wave' ? 0.85 : 1;
  const sizes = [0.3, 0.24, 0.19, 0.15, 0.12, 0.09, 0.07].map((f) => f * S * factor);
  let chosen = tryRows(sizes[sizes.length - 1]!);
  let chosenSize = sizes[sizes.length - 1]!;
  for (const sz of sizes) {
    const attempt = tryRows(sz);
    const tooWide = attempt.rows.some((r) => r.total > maxW * 1.0001);
    const maxRows = Math.max(1, Math.floor((H * 0.8) / (sz * 1.05)));
    if (!tooWide && attempt.rows.length <= Math.min(3, maxRows)) {
      chosen = attempt;
      chosenSize = sz;
      break;
    }
  }
  const rowH = chosenSize * 1.05;
  chosen.rows.forEach((row, ri) => {
    let cursor = -row.total / 2;
    const y = (ri - (chosen.rows.length - 1) / 2) * rowH;
    row.items.forEach((w, i) => {
      const wpx = row.widths[i]!;
      const h = hashId(w.cue.id);
      let size = chosenSize;
      let rot = 0;
      let jy = 0;
      if (scene.preset === 'burst') {
        size *= 0.88 + (w.cue.emphasis ?? 0.3) * 0.5;
        rot = signed(scene.seed, h) * 9;
        jy = signed(scene.seed, h + 3) * chosenSize * 0.12;
      } else if (scene.preset === 'drop') {
        rot = signed(scene.seed, h) * 2.5;
      }
      const wAdj = width(w.text, w.font, size);
      out.set(w.cue.id, { x: cursor + wpx / 2, y: y + jy, size, rot, font: w.font, text: w.text, widthPx: wAdj });
      cursor += wpx + chosen.gap;
    });
  });
  return out;
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

function getLayout(tl: VisualTimeline, scene: Scene, env: FrameEnv, style: StyleDef): SceneLayout {
  let perTl = layoutCache.get(tl);
  if (!perTl) {
    perTl = new Map();
    layoutCache.set(tl, perTl);
  }
  const key = `${scene.id}|${Math.round(env.width)}x${Math.round(env.height)}|${env.layoutEpoch ?? 0}`;
  let layout = perTl.get(key);
  if (!layout) {
    layout = layoutScene(tl, scene, env, style);
    if (perTl.size > 400) perTl.clear();
    perTl.set(key, layout);
  }
  return layout;
}

// ---------------------------------------------------------------------------
// colors per frame
// ---------------------------------------------------------------------------
function backgroundFor(
  tl: VisualTimeline,
  style: StyleDef,
  tMs: number,
  invert: number,
  p: string[],
): { c0: string; c1: string; solid: boolean; textColor: string; accent: string; wordColors: string[] } {
  const dark = p[p.length - 1]!;
  const a0 = p[0]!;
  const a1 = p[1] ?? p[0]!;
  const a2 = p[2] ?? a1;
  let c0: string;
  let c1: string;
  let solid = false;
  switch (style.background) {
    case 'mono':
      c0 = '#0b0b0e';
      c1 = '#15151a';
      solid = true;
      break;
    case 'paper':
      c0 = mix('#0b0b0b', '#efe9dd', invert);
      c1 = mix('#161616', '#e4dccb', invert);
      break;
    case 'cycle': {
      const deg = (tMs / 1000) * 14;
      c0 = mix(dark, rotateHue(a0, deg), 0.55 + invert * 0.3);
      c1 = mix(dark, rotateHue(a1, deg + 70), 0.5 + invert * 0.3);
      break;
    }
    case 'grid':
      c0 = mix('#070314', dark, 0.5);
      c1 = mix(dark, a2, 0.28 + invert * 0.4);
      break;
    case 'noir': // night-black ground with a breath of the cover colour (neon, VHS)
      c0 = mix('#04030a', dark, 0.35 + invert * 0.3);
      c1 = mix('#090818', a2, 0.14 + invert * 0.4);
      break;
    case 'sunset':
      c0 = mix('#14062e', dark, 0.25);
      c1 = mix('#6a1b6e', a0, 0.25 + invert * 0.35);
      break;
    case 'notebook':
      c0 = mix('#f6f0e1', a0, 0.06 + invert * 0.2);
      c1 = mix('#ece4d0', a1, 0.08 + invert * 0.2);
      break;
    case 'aurora':
      c0 = mix('#050914', dark, 0.4 + invert * 0.2);
      c1 = mix('#0a1224', a1, 0.2 + invert * 0.3);
      break;
    case 'pop':
      c0 = mix('#ffd23f', a1, 0.1 + invert * 0.45);
      c1 = mix('#ff4f5e', a0, 0.14 + invert * 0.45);
      break;
    default:
      if (tl.cover && tl.cover.light > 0.62 && invert < 0.5) {
        // a bright cover gets a bright ground in its own colors instead of a heavy dark slab
        c0 = mix('#f6f1e7', a0, 0.22 + invert * 0.3);
        c1 = mix('#f6f1e7', a1, 0.42 + invert * 0.3);
      } else {
        // the cover's own dark and dominant colors make the ground
        c0 = mix(dark, a0, invert);
        c1 = mix(mix(dark, a0, tl.cover ? 0.5 : 0.32), a1, invert);
      }
  }
  // Pick the text color that reads best on the WORSE end of the gradient, then nudge either end of the
  // gradient away from the text color until both ends reach contrast >= 3.2 (mood/album palettes can be bright).
  const LIGHT = '#fbfaf6';
  const INK = '#101014';
  const worst = (t: string) => Math.min(contrastRatio(t, c0), contrastRatio(t, c1));
  const textColor = worst(LIGHT) >= worst(INK) ? LIGHT : INK;
  const away = textColor === LIGHT ? '#000000' : '#ffffff';
  for (let i = 0; i < 14 && contrastRatio(textColor, c0) < 3.2; i++) c0 = mix(c0, away, 0.1);
  for (let i = 0; i < 14 && contrastRatio(textColor, c1) < 3.2; i++) c1 = mix(c1, away, 0.1);
  const mid = mix(c0, c1, 0.5);
  const candidates = [a1, a0, a2, p[3] ?? a2].filter((c) => contrastRatio(c, mid) >= 3);
  const accent = style.id === 'editorial' || style.id === 'minimal' ? (contrastRatio(a0, mid) >= 3 ? a0 : textColor) : (candidates[0] ?? textColor);
  const wordColors = style.id === 'editorial' ? [textColor] : candidates.length ? [textColor, ...candidates] : [textColor];
  return { c0, c1, solid, textColor, accent, wordColors };
}

// ---------------------------------------------------------------------------
// mood-aware palettes (album colors, tinted or replaced by the song's feeling)
// ---------------------------------------------------------------------------
function palettePad(p: string[]): string[] {
  return [p[0]!, p[1] ?? p[0]!, p[2] ?? p[1] ?? p[0]!, p[p.length - 1]!];
}

function scenePalette(tl: VisualTimeline, scene: Scene | undefined, mode: 'blend' | 'album' | 'emotion'): string[] {
  const base = palettePad(tl.palette);
  const mood = scene?.mood ?? tl.emotion?.overall;
  if (mode === 'album' || !mood) return base;
  const m = EMOTION_DEFS[mood.emotion].palette;
  const k = mode === 'emotion' ? 1 : clamp(0.1 + mood.confidence * 0.16, 0.1, 0.26);
  return base.map((c, i) => mix(c, m[i]!, k));
}

function blendPalettes(a: string[], b: string[], t: number): string[] {
  return t >= 1 ? b : t <= 0 ? a : a.map((c, i) => mix(c, b[i]!, t));
}

const STICKER_STYLES = new Set(['maximalist', 'custom', 'y2k', 'psychedelic']);

function buildDoodles(a: { tl: VisualTimeline; style: StyleDef; scenes: Scene[]; tMs: number; W: number; H: number; S: number; motionScale: number; beatPulse: number; palette: string[]; textColor: string; density: number; focal?: { x: number; y: number } }): DrawDoodle[] {
  const { tl, style, scenes, tMs, W, H, S, motionScale, beatPulse, palette, textColor, density, focal } = a;
  const out: DrawDoodle[] = [];
  const dark = palette[3]!;
  for (const scene of scenes) {
    const mood = scene.mood ?? tl.emotion?.overall;
    if (!mood) continue;
    const def = EMOTION_DEFS[mood.emotion];
    const dur = Math.max(400, scene.endMs - scene.startMs);
    const count = Math.round((2 + def.arousal * 5 + (scene.hook ? 3 : 0)) * clamp(motionScale, 0.3, 1.1) * clamp(density, 0.2, 1));
    for (let k = 0; k < Math.min(12, count); k++) {
      const kind = def.motifs[Math.floor(noise(scene.seed, 100 + k) * def.motifs.length)]!;
      let x = 0;
      let y = 0;
      for (let tries = 0; tries < 8; tries++) {
        x = signed(scene.seed, 200 + k * 7 + tries) * 0.47 * W;
        y = signed(scene.seed, 300 + k * 11 + tries) * 0.45 * H;
        if (focal && tries < 4) {
          // pull toward the side of the screen where the cover's brightest color sits
          x = x * 0.55 + (focal.x - 0.5) * W * 0.5;
          y = y * 0.55 + (focal.y - 0.5) * H * 0.5;
        }
        if (Math.abs(x) > 0.3 * W || Math.abs(y) > 0.24 * H) break; // keep the middle clear for the words
      }
      const size = S * (0.07 + noise(scene.seed, 400 + k) * 0.1) * (scene.hook ? 1.2 : 1);
      const birth = scene.startMs - LEAD_MS + noise(scene.seed, 500 + k) * dur * 0.35;
      const tIn = tMs - birth;
      if (tIn < 0) continue;
      const tOut = tMs - (scene.endMs + (scene.hook ? 120 : 0));
      if (tOut > 300) continue;
      const appear = easeOutBack(clamp(tIn / 420), 2.2);
      const exit = tOut > 0 ? 1 - clamp(tOut / 300) : 1;
      const pulse = 1 + beatPulse * 0.14 * (def.arousal + 0.3);
      const spin = kind === 'sun' || kind === 'flower' || kind === 'burst' || kind === 'spiral' ? tMs * 0.02 * (k % 2 ? -1 : 1) : 0;
      const col = palette[k % 3]!;
      const sticker = STICKER_STYLES.has(style.id);
      out.push({
        id: scene.id + ':d' + k,
        kind,
        x: x + Math.sin(tMs / 1100 + k * 1.7) * S * 0.01,
        y: y + Math.sin(tMs / 800 + k) * S * 0.014,
        size: size * appear * exit * pulse,
        rotationDeg: signed(scene.seed, 600 + k) * 25 + Math.sin(tMs / 1300 + k) * 8 + spin,
        alpha: clamp(0.88 * exit * Math.min(1, tIn / 160)),
        fill: sticker ? col : null,
        stroke: sticker ? dark : mix(textColor, col, 0.35),
        lineWidth: sticker ? Math.max(2, S * 0.007) : Math.max(1.5, S * 0.004),
        accent: palette[(k + 1) % 3],
        seed: Math.floor(noise(scene.seed, 700 + k) * 1000),
      });
    }
  }
  return out;
}

function buildAmbientEmojis(a: { tl: VisualTimeline; scenes: Scene[]; tMs: number; W: number; H: number; S: number; density: number }): DrawEmoji[] {
  const { tl, scenes, tMs, W, H, S, density } = a;
  const out: DrawEmoji[] = [];
  for (const scene of scenes) {
    const mood = scene.mood ?? tl.emotion?.overall;
    if (!mood || !scene.hook) continue; // hooks get a shower; verses stay clean
    const set = EMOTION_DEFS[mood.emotion].emojiSet;
    const dur = Math.max(800, scene.endMs - scene.startMs);
    const n = Math.max(2, Math.round(6 * density));
    for (let k = 0; k < n; k++) {
      const birth = scene.startMs + (k / n) * dur * 0.55;
      const life = 2600;
      const p = (tMs - birth) / life;
      if (p < 0 || p > 1) continue;
      out.push({
        id: scene.id + ':e' + k,
        char: set[Math.floor(noise(scene.seed, 800 + k) * set.length)]!,
        x: signed(scene.seed, 810 + k) * W * 0.42 + Math.sin(p * 6 + k) * S * 0.03,
        y: H * 0.5 - p * H * 1.05,
        sizePx: S * (0.07 + noise(scene.seed, 820 + k) * 0.06),
        rotationDeg: signed(scene.seed, 830 + k) * 24 + Math.sin(p * 8 + k) * 10,
        alpha: Math.min(1, p * 8) * (1 - smoothstep(0.75, 1, p)),
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// interlude: what happens when nobody is singing
// ---------------------------------------------------------------------------
const NO_INTERLUDE: Interlude = { amount: 0, aurora: [], rings: [], ribbons: [], particles: [] };

function buildInterlude(a: {
  tl: VisualTimeline;
  amount: number;
  tMs: number;
  W: number;
  H: number;
  S: number;
  palette: string[];
  beat: { pulse: number; index: number; strength: number };
  density: number;
  reduced: boolean;
  textColor: string;
}): { show: Interlude; doodles: DrawDoodle[]; emojis: DrawEmoji[] } {
  const { tl, amount, tMs, W, H, S, palette, beat, density, reduced } = a;
  if (amount <= 0.01) return { show: NO_INTERLUDE, doodles: [], emojis: [] };
  const mood = tl.emotion?.overall;
  const def = EMOTION_DEFS[mood?.emotion ?? 'calm'];
  const t = reduced ? 0 : tMs;
  const col = (k: number) => palette[k % 3]!;

  // 1) aurora: big soft lights drifting on slow Lissajous paths, in the cover's colors
  const nA = Math.max(2, Math.round(4 * density));
  const aurora = Array.from({ length: nA }, (_, k) => ({
    x: W * (0.5 + 0.4 * Math.sin(t / (4200 + k * 900) + k * 1.9)),
    y: H * (0.5 + 0.36 * Math.cos(t / (5100 + k * 700) + k * 1.3)),
    r: S * (0.55 + 0.18 * Math.sin(t / 3100 + k)) * (1 + (reduced ? 0 : beat.pulse) * 0.08),
    color: col(k),
    alpha: 0.4 * amount,
  }));
  if (reduced) return { show: { amount, aurora, rings: [], ribbons: [], particles: [] }, doodles: [], emojis: [] };

  // 2) rings pulsing out from the centre on every beat (a steady pseudo-beat when the track has no beat grid)
  const beats = tl.beatTimesMs;
  const rings: Interlude['rings'] = [];
  const RING_LIFE = 1500;
  for (let j = 0; j < 3; j++) {
    const idx = beat.index >= 0 ? beat.index - j : Math.floor(tMs / 700) - j;
    const bt = beat.index >= 0 ? beats[idx] : idx * 700;
    if (bt === undefined) continue;
    const age = tMs - bt;
    if (age < 0 || age > RING_LIFE) continue;
    const p = age / RING_LIFE;
    rings.push({ r: easeOutCubic(p) * Math.max(W, H) * 0.62, alpha: (1 - p) * 0.55 * amount * (idx % 4 === 0 ? 1 : 0.6), color: col(idx), width: Math.max(2, S * (0.014 - p * 0.008)) });
  }

  // 3) ribbons: two flowing waves that swell with the beat
  const ribbons: Interlude['ribbons'] = [0, 1].map((k) => ({
    y: H * (k ? 0.68 : 0.32),
    amp: S * (0.05 + 0.07 * beat.pulse) * (k ? 1 : 0.8),
    freq: 2.2 + k * 0.9,
    phase: t / (900 - k * 250) * (k ? -1 : 1),
    color: col(k + 1),
    width: Math.max(3, S * 0.012),
    alpha: 0.5 * amount,
  }));

  // 4) particles rising like embers / bubbles
  const nP = Math.round(46 * density);
  const particles: Interlude['particles'] = [];
  for (let k = 0; k < nP; k++) {
    const speed = 9000 + noise(7, k) * 7000;
    const p = (t / speed + noise(8, k)) % 1;
    particles.push({
      x: noise(9, k) * W + Math.sin(p * 9 + k) * S * 0.02,
      y: H * (1.04 - p * 1.1),
      size: S * (0.004 + noise(10, k) * 0.009) * (1 + beat.pulse * 0.4),
      alpha: Math.sin(p * Math.PI) * (0.35 + 0.4 * noise(11, k)) * amount,
      color: k % 5 === 0 ? a.textColor : col(k),
    });
  }

  // 5) the mood emoji pulses in the middle while vector doodles orbit it
  const doodles: DrawDoodle[] = [];
  const nO = Math.max(3, Math.round(6 * density));
  for (let k = 0; k < nO; k++) {
    const ang = t * 0.00042 * (k % 2 ? -1 : 1) + (k * Math.PI * 2) / nO;
    const rad = S * (0.3 + 0.03 * Math.sin(t / 900 + k));
    const kind = def.motifs[k % def.motifs.length]!;
    doodles.push({
      id: 'int:d' + k,
      kind,
      x: Math.cos(ang) * rad * 1.5,
      y: Math.sin(ang) * rad,
      size: S * (0.055 + 0.015 * Math.sin(t / 700 + k)) * (1 + beat.pulse * 0.2) * amount,
      rotationDeg: (ang * 180) / Math.PI + t * 0.02,
      alpha: 0.9 * amount,
      fill: col(k),
      stroke: palette[3]!,
      lineWidth: Math.max(2, S * 0.006),
      accent: col(k + 1),
      seed: k * 37,
    });
  }
  const emojis: DrawEmoji[] = [
    { id: 'int:mood', char: def.emoji, x: 0, y: Math.sin(t / 800) * S * 0.015, sizePx: S * 0.2 * (1 + beat.pulse * 0.14) * easeOutBack(clamp(amount * 1.4)), rotationDeg: Math.sin(t / 1300) * 8, alpha: clamp(amount * 1.2) },
  ];
  return { show: { amount, aurora, rings, ribbons, particles }, doodles, emojis };
}

// ---------------------------------------------------------------------------
// the frame
// ---------------------------------------------------------------------------
export function computeFrame(tl: VisualTimeline, tMsIn: number, env: FrameEnv): Frame {
  const tMs = Math.max(0, tMsIn);
  const style = STYLES[tl.style];
  const reduced = env.reducedMotion;
  const motionScale = reduced ? 0 : clamp(env.motionScale ?? 1, 0, 1.5) * (tl.custom?.intensity ?? 1);
  const W = env.width;
  const H = env.height;
  const S = Math.min(H, W * 0.9);

  const beat = beatStateAt(tl.beatTimesMs, tMs);

  // --- which scenes are on screen -------------------------------------------------
  const active: Scene[] = [];
  let primary: Scene | null = null;
  let foundIdx = -1;
  {
    // binary search last scene with start <= t+LEAD, then scan a few back
    let lo = 0;
    let hi = tl.scenes.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (tl.scenes[mid]!.startMs - LEAD_MS <= tMs) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    foundIdx = found;
    for (let i = Math.max(0, found - 3); i <= Math.min(tl.scenes.length - 1, found + 1); i++) {
      const s = tl.scenes[i]!;
      const lastExit = s.endMs + EXIT_MS + 40;
      if (tMs >= s.startMs - LEAD_MS && tMs <= lastExit) active.push(s);
    }
    for (const s of active) {
      if (s.startMs - LEAD_MS <= tMs && (!primary || s.startMs >= primary.startMs)) primary = s;
    }
  }

  // --- chorus inversion amount ---------------------------------------------------------
  let invert = 0;
  for (const e of tl.effects) {
    if (e.preset !== 'chorusInvert') continue;
    const inAmt = smoothstep(e.startMs - 60, e.startMs + 120, tMs);
    const outAmt = 1 - smoothstep(e.endMs + 60, e.endMs + 320, tMs);
    invert = Math.max(invert, Math.min(inAmt, outAmt));
  }
  const colorMode = env.colorMode ?? 'blend';
  const curScene = tl.scenes[foundIdx];
  const prevScene = foundIdx > 0 ? tl.scenes[foundIdx - 1] : undefined;
  const palette =
    prevScene && curScene
      ? blendPalettes(scenePalette(tl, prevScene, colorMode), scenePalette(tl, curScene, colorMode), smoothstep(curScene.startMs - 150, curScene.startMs + 650, tMs))
      : scenePalette(tl, curScene, colorMode);
  const bgInfo = backgroundFor(tl, style, tMs, invert, palette);

  // --- instrumental "hero artwork" amount ------------------------------------------------
  const artMode = env.artwork ?? 'background';
  const hero = 0; // the cover is always a background now: the interlude show takes the stage in breaks
  let interludeAmt = 0;
  for (const g of tl.gaps) {
    if (g.endMs - g.startMs < 1500) continue;
    const a = smoothstep(g.startMs + 200, g.startMs + 750, tMs);
    const b = 1 - smoothstep(g.endMs - 500, g.endMs - 60, tMs);
    interludeAmt = Math.max(interludeAmt, Math.min(a, b));
  }
  const hookNow = !!primary?.hook && tMs <= (primary?.endMs ?? 0) + 100;

  // --- words ---------------------------------------------------------------------------------
  const words: DrawWord[] = [];
  const emojis: DrawEmoji[] = [];
  const wantEmoji = env.emojis !== false && !reduced;
  const visibleWordIds: string[] = [];
  let activeWordId: string | null = null;

  for (const scene of active) {
    const layout = getLayout(tl, scene, env, style);
    const intensity = scene.intensity * motionScale;
    for (let wi = 0; wi < scene.words.length; wi++) {
      const cue = scene.words[wi]!;
      const item = layout.get(cue.id);
      if (!item) continue;
      const dw = poseWord({ tl, style, scene, cue, wi, item, tMs, W, H, S, intensity, reduced, beat, bgInfo, hook: scene.hook, env });
      if (!dw) continue;
      if (wantEmoji && emojis.length < 10) {
        const ch = emojiForWord(cue.text);
        if (ch && (cue.emphasis ?? 0) > 0.15) {
          const tE = tMs - (cue.startMs - LEAD_MS);
          if (tE >= 0 && tMs <= scene.endMs + 260) {
            const pop = easeOutElastic(clamp(tE / 520));
            const fade = 1 - smoothstep(scene.endMs, scene.endMs + 260, tMs);
            emojis.push({
              id: cue.id + ':emoji',
              char: ch,
              x: dw.x + Math.min(item.widthPx * 0.5, W * 0.4) * 0.9,
              y: dw.y - item.size * 0.55 - tE * 0.012,
              sizePx: clamp(item.size * 0.6, S * 0.07, S * 0.17) * pop,
              rotationDeg: signed(scene.seed, hashId(cue.id)) * 14,
              alpha: clamp(fade),
            });
          }
        }
      }
      words.push(dw);
      visibleWordIds.push(cue.id);
      if (scene === primary && tMs >= cue.startMs && tMs < cue.endMs) activeWordId = cue.id;
    }
  }
  // if between words of the primary line, keep the last sung word "active" briefly
  if (!activeWordId && primary) {
    for (let i = primary.words.length - 1; i >= 0; i--) {
      const c = primary.words[i]!;
      if (tMs >= c.endMs && tMs < c.endMs + 120) {
        activeWordId = c.id;
        break;
      }
    }
  }
  words.sort((a, b) => a.z - b.z);
  const inter = buildInterlude({ tl, amount: interludeAmt, tMs, W, H, S, palette, beat, density: env.density ?? 1, reduced, textColor: bgInfo.textColor });
  const doodles = env.doodles !== false && !reduced ? buildDoodles({ tl, style, scenes: active, tMs, W, H, S, motionScale, beatPulse: beat.pulse, palette, textColor: bgInfo.textColor, density: env.density ?? 1, focal: tl.cover?.focal }) : [];
  if (env.doodles !== false) doodles.push(...inter.doodles);
  if (wantEmoji) emojis.push(...inter.emojis);
  if (wantEmoji && emojis.length < 10) emojis.push(...buildAmbientEmojis({ tl, scenes: active, tMs, W, H, S, density: env.density ?? 1 }).slice(0, 10 - emojis.length));

  // --- camera / overlays -------------------------------------------------------------------------
  const sceneProgress = primary ? clamp((tMs - primary.startMs) / Math.max(1, primary.endMs - primary.startMs)) : 0;
  const strongKick = beat.index >= 0 && beat.strength === 1;
  const shakeAmp = motionScale * style.beatShake * beat.pulse * (strongKick ? 1 : 0.4);
  const camera = {
    zoom: 1 + 0.045 * sceneProgress * motionScale + 0.018 * beat.pulse * motionScale * (0.5 + style.beatShake * 0.5),
    rotationDeg: motionScale * Math.sin(tMs / 2600) * 0.35 + 0,
    x: shakeAmp * signed(beat.index + 1, 11) * W * 0.006,
    y: shakeAmp * signed(beat.index + 1, 29) * H * 0.006,
  };

  const artworkMode: Frame['artwork']['mode'] = hero > 0.02 ? 'hero' : 'backdrop';
  const artwork: Frame['artwork'] = {
    mode: artworkMode,
    hero,
    alpha: artMode === 'off' ? 0 : lerp(style.artwork ?? (style.background === 'mono' ? 0.18 : 0.36), Math.max(style.artwork ?? 0.55, 0.3), interludeAmt),
    scale: lerp(1.05, 0.62, hero) * (1 + beat.pulse * 0.03 * motionScale) + sceneProgress * 0.03 * motionScale,
    rotationDeg: lerp(0, -4 + Math.sin(tMs / 1800) * 3 * motionScale, hero),
    x: lerp(0, 0, hero),
    y: lerp(0, -H * 0.02, hero),
  };

  const marquee: MarqueeRow[] = [];
  if (primary && hookNow && (style.id === 'editorial' || style.id === 'maximalist' || style.id === 'y2k') && !reduced) {
    const phrase = primary.words.map((w) => w.text).join(' ').toUpperCase() + '  •  ';
    const font = style.displayFont;
    const fade = smoothstep(primary.startMs, primary.startMs + 220, tMs) * (1 - smoothstep(primary.endMs, primary.endMs + 220, tMs));
    for (let r = 0; r < 5; r++) {
      marquee.push({
        text: phrase.repeat(4),
        y: (r - 2) * S * 0.24,
        offsetX: ((tMs * 0.06 * (r % 2 ? -1 : 1)) % (S * 1.5)) - W * 0.3,
        sizePx: S * 0.2,
        alpha: 0.09 * fade,
        font,
        color: bgInfo.textColor,
      });
    }
  }

  if (tl.label && interludeAmt > 0.05 && !reduced) {
    const phrase = tl.label.toUpperCase() + '  •  ';
    for (let r = 0; r < 3; r++) {
      marquee.push({ text: phrase.repeat(4), y: (r - 1) * S * 0.36, offsetX: ((tMs * 0.05 * (r % 2 ? -1 : 1)) % (S * 1.5)) - W * 0.3, sizePx: S * 0.26, alpha: 0.08 * interludeAmt, font: style.displayFont, color: bgInfo.textColor });
    }
  }

  return {
    tMs,
    sceneId: primary?.id ?? null,
    lineIndex: primary?.lineIndex ?? -1,
    hook: hookNow,
    activeWordId,
    visibleWordIds,
    bg: {
      c0: bgInfo.c0,
      c1: bgInfo.c1,
      angleDeg: 160 + (reduced ? 0 : Math.sin(tMs / 5000) * 12),
      invert: invert > 0.5,
      pulse: reduced ? 0 : beat.pulse,
      solid: bgInfo.solid,
      glow: tl.cover && colorMode !== 'emotion' ? { x: tl.cover.focal.x, y: tl.cover.focal.y, color: palette[0]!, alpha: 0.22 + (reduced ? 0 : beat.pulse * 0.1) } : null,
    },
    artwork,
    camera,
    overlays: {
      grain: style.grain,
      vignette: style.vignette ?? 0.55,
      halftone: style.halftone * (1 - hero * 0.6),
      flash: reduced ? 0 : Math.min(0.12, beat.pulse * 0.12 * (strongKick ? 1 : 0.4) * style.beatShake * motionScale),
      scanlines: style.scanlines,
    },
    beat,
    marquee,
    interlude: inter.show,
    doodles,
    emojis,
    mood: (primary?.mood ?? curScene?.mood ?? tl.emotion?.overall)?.emotion ?? null,
    palette,
    words,
    textColor: bgInfo.textColor,
    accent: bgInfo.accent,
    caption: captionFor(tl, primary, tMs, interludeAmt, reduced),
  };
}

/** The next line, quietly, in the last stretch of the current one: enough to sing along without stealing the stage. */
function captionFor(tl: VisualTimeline, primary: Scene | null, tMs: number, interludeAmt: number, reduced: boolean): Frame['caption'] {
  if (!primary || interludeAmt > 0.2) return null;
  const next = tl.scenes[primary.lineIndex + 1] ?? tl.scenes.find((s) => s.startMs > primary.startMs);
  if (!next || next.startMs - primary.endMs > 6000) return null;
  const from = primary.startMs + (primary.endMs - primary.startMs) * 0.3;
  const appear = smoothstep(from, from + 350, tMs);
  const gone = 1 - smoothstep(next.startMs - LEAD_MS - 80, next.startMs - LEAD_MS + 120, tMs);
  const alpha = (reduced ? 1 : appear) * gone;
  if (alpha < 0.02) return null;
  return { text: next.words.map((w) => w.text).join(' '), alpha };
}

// ---------------------------------------------------------------------------
// per-word pose
// ---------------------------------------------------------------------------
type PoseArgs = {
  tl: VisualTimeline;
  style: StyleDef;
  scene: Scene;
  cue: WordCue;
  wi: number;
  item: LayoutItem;
  tMs: number;
  W: number;
  H: number;
  S: number;
  intensity: number;
  reduced: boolean;
  beat: { pulse: number; index: number; strength: number };
  bgInfo: ReturnType<typeof backgroundFor>;
  hook: boolean;
  env: FrameEnv;
};

const POP_FILLS = ['#fffdf5', '#ffe14d', '#7df0ff', '#ff9ec7'];

function poseWord(a: PoseArgs): DrawWord | null {
  const { style, scene, cue, wi, item, tMs, W, H, S, intensity, reduced, beat, bgInfo } = a;
  const tIn = tMs - (cue.startMs - LEAD_MS);
  if (tIn < 0) return null;
  const isCut = scene.preset === 'cut';
  const holdUntil = isCut ? cue.endMs + 20 : scene.endMs;
  const tOut = tMs - holdUntil;
  if (tOut > EXIT_MS) return null;

  const hid = hashId(cue.id);
  const effect = cue.effect ?? 'pop';
  const appearMs = isCut ? 150 : APPEAR_MS;
  const p = clamp(tIn / appearMs);

  let sx = 1;
  let sy = 1;
  let dx = 0;
  let dy = 0;
  let rot = item.rot;
  let alpha = 1;
  let skew = 0;
  let blur = 0;
  let split = 0;
  let mask = false;
  let echo = 0;

  if (reduced) {
    alpha = clamp(tIn / 200);
    rot = 0;
  } else {
    // preset-driven entrance
    switch (scene.preset) {
      case 'drop': {
        const q = clamp(tIn / 460);
        dy = -(1 - easeOutBounce(q)) * H * 0.55 * Math.min(1, intensity + 0.3);
        alpha = clamp(tIn / 60);
        if (q >= 1) {
          const land = clamp((tIn - 460) / 160);
          sy = 1 - 0.14 * (1 - land) * Math.sin(land * Math.PI * 0.5 + 0.5);
          sx = 1 + 0.1 * (1 - land);
        }
        break;
      }
      case 'burst': {
        const e = easeOutBack(p, 3.2);
        sx = sy = e;
        rot += signed(scene.seed, hid + 9) * 30 * (1 - easeOutCubic(p));
        alpha = clamp(p * 6);
        break;
      }
      case 'wave': {
        alpha = clamp(p * 3);
        sx = sy = easeOutBack(p, 1.2);
        dy += Math.sin(tMs / 380 + wi * 0.9) * S * 0.035 * intensity;
        rot += Math.sin(tMs / 700 + wi) * 2 * intensity;
        skew = Math.sin(tMs / 900 + wi * 0.5) * 0.08 * intensity;
        echo = style.echo;
        break;
      }
      case 'stack': {
        const dir = noise(scene.seed, hid) > 0.5 ? 1 : -1;
        dx = dir * W * 0.28 * (1 - easeOutCubic(p));
        alpha = clamp(p * 4);
        sy = lerp(1.25, 1, easeOutCubic(p));
        break;
      }
      case 'cut': {
        const e = easeOutBack(p, 2.4);
        sx = sy = 0.5 + 0.5 * e;
        alpha = clamp(p * 8);
        break;
      }
      default: {
        // ticker
        const e = easeOutBack(p, 1.9);
        sx = sy = e;
        dy = (1 - easeOutCubic(p)) * S * 0.05;
        alpha = clamp(p * 5);
      }
    }

    // per-word effect on top
    const since = tMs - cue.startMs;
    switch (effect) {
      case 'stretch': {
        const e = easeOutElastic(p);
        const dur = Math.max(1, cue.endMs - cue.startMs);
        const hold = clamp(since / dur);
        sx *= 1 + 0.55 * (1 - e) + 0.16 * hold * (since >= 0 ? 1 : 0);
        sy *= 1 - 0.22 * (1 - e) - 0.04 * hold * (since >= 0 ? 1 : 0);
        break;
      }
      case 'shake': {
        const k = Math.floor(since / 32);
        const decay = Math.exp(-Math.max(0, since) / 260);
        dx += signed(hid, k) * S * 0.02 * decay * intensity;
        dy += signed(hid + 1, k) * S * 0.02 * decay * intensity;
        rot += signed(hid + 2, k) * 4 * decay * intensity;
        break;
      }
      case 'slide':
        dx += (noise(scene.seed, hid + 4) > 0.5 ? 1 : -1) * W * 0.12 * (1 - easeOutCubic(p));
        break;
      case 'float':
        dy += Math.sin(tMs / 520 + wi) * S * 0.015 * intensity;
        break;
      case 'mask':
        mask = true;
        break;
      default:
        break;
    }

    // active syllable punch + beat pump
    const sinceStart = tMs - cue.startMs;
    if (sinceStart >= -LEAD_MS) {
      const punch = Math.exp(-Math.max(0, sinceStart) / 150);
      const k = 1 + 0.1 * intensity * punch;
      sx *= k;
      sy *= k;
    }
    const pump = 1 + beat.pulse * 0.03 * intensity;
    sx *= pump;
    sy *= pump;

    // split effect on strong hits
    if ((cue.emphasis ?? 0) > 0.7 && sinceStart >= 0) split = S * 0.03 * Math.exp(-sinceStart / 220) * intensity;
    // gentle blur on entrance
    blur = (1 - p) * 4 * Math.min(1, intensity);
    if (!echo) echo = (cue.emphasis ?? 0) > 0.75 ? style.echo : style.echo > 0 ? 1 : 0;
  }

  // exit
  if (tOut > 0 && !reduced) {
    const q = clamp(tOut / EXIT_MS);
    switch (scene.preset) {
      case 'burst': {
        const ang = noise(scene.seed, hid + 21) * Math.PI * 2;
        dx += Math.cos(ang) * q * q * W * 0.55;
        dy += Math.sin(ang) * q * q * H * 0.55;
        sx *= 1 + q * 0.5;
        sy *= 1 + q * 0.5;
        rot += signed(scene.seed, hid + 5) * 40 * q;
        alpha *= 1 - Math.pow(q, 1.5);
        break;
      }
      case 'drop':
        dy += easeInBack(q) * H * 0.45;
        alpha *= 1 - q * q;
        break;
      case 'cut':
        sx *= 1 + q * 0.25;
        sy *= 1 + q * 0.25;
        alpha *= 1 - q;
        break;
      case 'stack':
        dx += (wi % 2 ? 1 : -1) * easeInCubic(q) * W * 0.3;
        alpha *= 1 - q;
        break;
      default:
        dy -= easeInCubic(q) * S * 0.1;
        alpha *= 1 - q;
    }
  } else if (tOut > 0 && reduced) {
    alpha *= 1 - clamp(tOut / 200);
  }

  const active = tMs >= cue.startMs && tMs < cue.endMs;
  const sung = tMs >= cue.endMs;
  const wordIndexColor = bgInfo.wordColors[(hid + wi) % bgInfo.wordColors.length]!;
  const multicolor = style.id === 'maximalist' || style.id === 'custom' || style.id === 'y2k' || !!style.text?.multicolor;
  let fill = multicolor ? wordIndexColor : bgInfo.textColor;
  if (active) fill = style.text?.highlight ? bgInfo.textColor : bgInfo.accent; // a highlighter swipe sits behind the ink
  else if (sung && (style.id === 'minimal' || style.id === 'aurora' || style.id === 'notebook')) fill = mix(bgInfo.textColor, bgInfo.c0, style.id === 'notebook' ? 0.3 : 0.35);
  const tx = style.text;
  const outline = !!tx?.outline;
  // outlined (comic) type needs a bright fill so the ink outline and shadow frame it instead of swallowing it
  if (outline) fill = active ? '#ffffff' : POP_FILLS[(hid + wi) % POP_FILLS.length]!;

  return {
    id: cue.id,
    text: item.text,
    font: item.font,
    sizePx: item.size,
    x: item.x + dx,
    y: item.y + dy,
    scaleX: sx,
    scaleY: sy,
    rotationDeg: rot,
    skewX: skew,
    alpha: clamp(alpha),
    fill,
    stroke: outline ? '#111018' : style.chromeText ? bgInfo.accent : undefined,
    strokeWidth: outline ? Math.max(3, item.size * 0.075) : style.chromeText ? Math.max(2, item.size * 0.03) : undefined,
    glow: tx?.glow ? tx.glow * (active ? 1 : 0.7) : undefined,
    aberration: tx?.aberration ? Math.max(1.5, item.size * 0.018) * (1 + beat.pulse * 0.8) : undefined,
    shadow: tx?.shadow ? Math.max(3, item.size * 0.055) : undefined,
    highlight: tx?.highlight && active ? mix(bgInfo.accent, '#fff36b', 0.55) : undefined,
    gradient: tx?.gradient,
    mask,
    split,
    echo,
    blur,
    active,
    z: active ? 2 : 1 + wi * 0.001,
    maxWidthPx: W * 0.94,
  };
}
