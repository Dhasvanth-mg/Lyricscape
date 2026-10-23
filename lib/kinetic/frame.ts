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
import type { DrawWord, FontKey, Frame, FrameEnv, MarqueeRow, Scene, VisualTimeline, WordCue } from './types';

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
): { c0: string; c1: string; solid: boolean; textColor: string; accent: string; wordColors: string[] } {
  const p = tl.palette;
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
    default:
      c0 = mix(dark, a0, invert);
      c1 = mix(mix(dark, a0, 0.32), a1, invert);
  }
  const mid = mix(c0, c1, 0.5);
  const textColor = textOn(mid);
  const candidates = [a1, a0, a2, p[3] ?? a2].filter((c) => contrastRatio(c, mid) >= 3);
  const accent = style.id === 'editorial' || style.id === 'minimal' ? (contrastRatio(a0, mid) >= 3 ? a0 : textColor) : (candidates[0] ?? textColor);
  const wordColors = style.id === 'editorial' ? [textColor] : candidates.length ? [textColor, ...candidates] : [textColor];
  return { c0, c1, solid, textColor, accent, wordColors };
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
  const bgInfo = backgroundFor(tl, style, tMs, invert);

  // --- instrumental "hero artwork" amount ------------------------------------------------
  let hero = 0;
  for (const g of tl.gaps) {
    const a = smoothstep(g.startMs + 150, g.startMs + 700, tMs);
    const b = 1 - smoothstep(g.endMs - 650, g.endMs - 100, tMs);
    hero = Math.max(hero, Math.min(a, b));
  }
  const hookNow = !!primary?.hook && tMs <= (primary?.endMs ?? 0) + 100;

  // --- words ---------------------------------------------------------------------------------
  const words: DrawWord[] = [];
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

  const artworkMode: Frame['artwork']['mode'] = hero > 0.02 ? 'hero' : hookNow ? 'sticker' : 'backdrop';
  const artwork: Frame['artwork'] = {
    mode: artworkMode,
    hero,
    alpha: lerp(style.background === 'mono' ? 0.1 : 0.22, 1, hero),
    scale: lerp(1.05, 0.62, hero) * (1 + beat.pulse * 0.03 * motionScale) + sceneProgress * 0.03 * motionScale,
    rotationDeg: lerp(0, -4 + Math.sin(tMs / 1800) * 3 * motionScale, hero) + (artworkMode === 'sticker' ? 6 : 0),
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

  return {
    tMs,
    sceneId: primary?.id ?? null,
    lineIndex: primary?.lineIndex ?? -1,
    hook: hookNow,
    activeWordId,
    visibleWordIds,
    bg: { c0: bgInfo.c0, c1: bgInfo.c1, angleDeg: 160 + (reduced ? 0 : Math.sin(tMs / 5000) * 12), invert: invert > 0.5, pulse: reduced ? 0 : beat.pulse, solid: bgInfo.solid },
    artwork,
    camera,
    overlays: {
      grain: style.grain,
      vignette: 0.55,
      halftone: style.halftone * (1 - hero * 0.6),
      flash: reduced ? 0 : Math.min(0.12, beat.pulse * 0.12 * (strongKick ? 1 : 0.4) * style.beatShake * motionScale),
      scanlines: style.scanlines,
    },
    beat,
    marquee,
    words,
    textColor: bgInfo.textColor,
    accent: bgInfo.accent,
  };
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
  let fill = style.id === 'maximalist' || style.id === 'custom' || style.id === 'y2k' ? wordIndexColor : bgInfo.textColor;
  if (active) fill = bgInfo.accent;
  else if (sung && style.id === 'minimal') fill = mix(bgInfo.textColor, bgInfo.c0, 0.35);

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
    stroke: style.chromeText ? bgInfo.accent : undefined,
    strokeWidth: style.chromeText ? Math.max(2, item.size * 0.03) : undefined,
    mask,
    split,
    echo,
    blur,
    active,
    z: active ? 2 : 1 + wi * 0.001,
    maxWidthPx: W * 0.94,
  };
}
