// Cover Pop (CVP), Phase 3: the song's cover is the stage, undimmed and unmodified (only cropped and scaled). Lyrics arrive as
// short phrases in a hot colour that reads against the pixels behind each word, a chip on the heaviest word, now and then an
// annotation sticker; the camera tours the cover in verses, choruses return to the full cover with a burst on the downbeats,
// and the song ends with the cover receding to a framed square on its own colour. With no usable cover, a stage painted from
// the song's palette stands in. A pure function of time (AGENTS.md rule 3).

import { mul, rotate, scale, translate } from '../../kinetic/gl/gpu';
import { clamp, drawText, easeInOut, easeOut, textTex } from '../../kinetic/gl/scenes/common';
import type { SceneFx, SceneHost } from '../../kinetic/gl/scenes/types';
import { drawIcon, iconColors, iconForWord } from '../../kinetic/icons';
import type { VisualTimeline } from '../../kinetic/types';
import { contrastRatio } from '../../kinetic/util';
import { guardFx } from '../flash';
import { plannedAt } from '../scene/planner';
import { isRtl } from '../sketch-cards/letter';
import { hotFamily, readCover, wordColour, type Box, type CoverReading } from './analysis';
import { clampCrop, cropAt, type Crop } from './crops';
import { paintFallback } from './fallback';
import { paintBurst, paintCutout, paintSticker } from './marks';
import { coverPlan, type PhrasePlan, type SectionLook } from './plan';
import { fontOf, labelOf, placePhrase, voiceForScript, type PlacedWord, type Region } from './type';

const POP_MS = 170;
const HANDOFF_MS = 220;

function currentLine(tl: VisualTimeline, t: number): number {
  const sc = tl.scenes;
  let lo = 0;
  let hi = sc.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sc[mid]!.startMs - 30 <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

/** where the cover sits on screen: centre and side in px */
type Stage = { cx: number; cy: number; side: number; field: string | null; region: Region; onCover: boolean };

export function drawCoverPopScene(h: SceneHost): SceneFx {
  const { W, H, tl, frame } = h;
  const t = frame.tMs;
  const cover = h.cover;
  const reading: CoverReading | null = cover?.grid ? readCover(cover.grid) : null;
  const usable = !!cover && !!reading && !reading.flat;
  const cp = coverPlan(tl, usable ? { natural: cover!.natural } : null);
  const ps = plannedAt(cp.plan, t) ?? cp.plan.sections[0]!;
  const si = Math.max(0, cp.plan.sections.indexOf(ps));
  const look = cp.sections[si]!;
  const since = t - ps.section.startMs;
  const dur = Math.max(1, ps.section.endMs - ps.section.startMs);
  const comp = ps.composition.id;
  const dominant = reading?.colours[0] ?? tl.palette[0] ?? '#202020';
  const portrait = H > W * 1.15;
  const S = Math.min(W, H);

  // ---- the stage -----------------------------------------------------------------------------------------------------------
  h.clear(dominant);
  let stage: Stage;
  if (!usable || ps.scene.id === 'CVP-SCN-07') {
    const fw = Math.round(Math.min(1, 1400 / Math.max(W, H)) * W);
    const fh = Math.round(Math.min(1, 1400 / Math.max(W, H)) * H);
    const tex = h.tex(`cvp|fbk|${look.fallback}|${fw}x${fh}|${tl.palette.join(',')}`, fw, fh, (c) => paintFallback(c, look.fallback, fw, fh, tl.palette, cp.plan.seed, (tl.label ?? '').split('•')[0]!.trim()));
    h.sprite({ tex: tex.tex, m: translate(W / 2, H / 2), w: W, h: H, mode: 0, camera: false });
    stage = { cx: W / 2, cy: H / 2, side: 0, field: tl.palette[0] ?? dominant, region: inset(W, H, 0.08), onCover: false };
  } else if (ps.scene.id === 'CVP-SCN-08') {
    // framed ending: the cover recedes from filling the frame to a framed square on its own colour (CVP-TRN-RECEDE, 2.5 s)
    const k = h.reduced ? 1 : easeInOut(clamp(since / 2500));
    const full = Math.max(W, H);
    const framed = S * 0.62;
    const side = full + (framed - full) * k;
    const border = S * 0.022 * k;
    h.rect(W / 2 - side / 2 - border, H / 2 - side / 2 - border, side + border * 2, side + border * 2, '#ffffff', k);
    h.sprite({ tex: cover!.tex, m: translate(W / 2, H / 2), w: side, h: side, mode: 0, camera: false });
    stage = { cx: W / 2, cy: H / 2, side, field: dominant, region: portrait ? { x: W * 0.08, y: H / 2 + side / 2 + S * 0.04, w: W * 0.84, h: H / 2 - side / 2 - S * 0.08 } : { x: W * 0.08, y: H * 0.86, w: W * 0.84, h: H * 0.1 }, onCover: false };
  } else if (comp === 'CVP-CMP-C4') {
    // the cover beside a colour field that holds the phrases
    const side = portrait ? W * 0.86 : Math.min(H * 0.82, W * 0.46);
    const cx = portrait ? W / 2 : W * 0.06 + side / 2;
    const cy = portrait ? H * 0.06 + side / 2 : H / 2;
    h.sprite({ tex: cover!.tex, m: translate(cx, cy), w: side, h: side, mode: 0, camera: false });
    const region = portrait ? { x: W * 0.07, y: cy + side / 2 + H * 0.04, w: W * 0.86, h: H - (cy + side / 2) - H * 0.08 } : { x: cx + side / 2 + W * 0.05, y: H * 0.12, w: W - (cx + side / 2) - W * 0.1, h: H * 0.76 };
    stage = { cx, cy, side, field: dominant, region, onCover: false };
  } else if (comp === 'CVP-CMP-C1') {
    // the whole cover, fit, on its own colour; a slow push. Portrait: the field above and below holds the phrases.
    let side = S;
    if (!h.reduced) side *= 1 + 0.06 * easeInOut(clamp(since / dur));
    // chorus entry: zoom out from a detail to the full cover (CVP-TRN-FULL-OUT, 700 ms)
    if (!h.reduced && ps.transition?.id === 'CVP-TRN-FULL-OUT' && since < 700) side *= 1 + (1 - easeOut(since / 700)) * 0.9;
    h.sprite({ tex: cover!.tex, m: translate(W / 2, H / 2), w: side, h: side, mode: 0, camera: false });
    const fieldH = (H - S) / 2;
    const region = portrait && fieldH > H * 0.14 ? { x: W * 0.07, y: H / 2 + S / 2 + fieldH * 0.08, w: W * 0.86, h: fieldH * 0.84 } : null;
    // landscape: the phrase may run across the cover and its side fields, at the height where the cover is emptiest
    let onCov = onCoverRegion(reading, { cx: W / 2, cy: H / 2, side }, W, H);
    if (!portrait && W - side > W * 0.2) onCov = { x: W * 0.08, y: onCov.y, w: W * 0.84, h: onCov.h };
    stage = { cx: W / 2, cy: H / 2, side, field: region ? dominant : null, region: region ?? onCov, onCover: !region };
  } else {
    // C2 crop tour, C3 giant word, C5 collage: the cover covers the frame
    let crop: Crop = { u: 0.5, v: 0.5, z: comp === 'CVP-CMP-C5' ? 1.05 : 1 };
    if (comp === 'CVP-CMP-C2') crop = cropAt(look.crop, reading, since / dur, h.reduced);
    crop = clampCrop(crop, W, H);
    const side = Math.max(W, H) * crop.z;
    const cx = W / 2 + (0.5 - crop.u) * side;
    const cy = H / 2 + (0.5 - crop.v) * side;
    h.sprite({ tex: cover!.tex, m: translate(cx, cy), w: side, h: side, mode: 0, camera: false });
    const st = { cx, cy, side };
    const region = comp === 'CVP-CMP-C3' ? inset(W, H, portrait ? 0.05 : 0.2) : comp === 'CVP-CMP-C5' ? inset(W, H, 0.16) : onCoverRegion(reading, st, W, H);
    stage = { ...st, field: null, region, onCover: true };
    if (comp === 'CVP-CMP-C5') drawCutouts(h, look, cover!.canvas, cp.plan.seed + si);
  }

  // ---- lyrics --------------------------------------------------------------------------------------------------------------
  const li = currentLine(tl, t);
  const inSection = li >= 0 && !!ps.section.lines && li >= ps.section.lines[0] && li <= ps.section.lines[1];
  if (!inSection || ps.scene.id === 'CVP-SCN-08' && !inSection) return finish(h);
  const lp = cp.lines[li]!;
  const sc = tl.scenes[li]!;
  const age = t - (sc.startMs - 30);
  let cur = -1;
  for (let i = 0; i < lp.phrases.length; i++) if (lp.phrases[i]!.at <= age) cur = i;
  if (cur < 0) cur = 0;
  const ph = lp.phrases[cur]!;
  const voice = voiceForScript(lp.script, look.voice);
  const rtl = isRtl(lp.script);
  const family = hotFamily(reading, tl.palette, look.hotK);
  const giant = comp === 'CVP-CMP-C3' || ps.scene.id === 'CVP-SCN-03';
  // phrase cap height 7-14% of the frame (giant words are allowed to fill their region)
  const sizeMax = giant ? S * 0.42 : Math.min(W, H) * 0.14 / 0.7;
  const measure = (i: number, size: number) => h.measure(fontOf(voice, 100), labelOf(voice, sc.words[i]!.text)) * (size / 100);
  const placed = placePhrase(ph.layout, ph, ph.chipWord, stage.region, measure, voice.lh, sizeMax, rtl);

  // burst behind the hook on the downbeats (not with reduced motion)
  if (look.burst && !h.reduced && placed.length) drawBurst(h, look, placed, t, cp.plan.seed + si);

  // the previous phrase hands off: it slides up and fades while this one pops
  const pAge = age - ph.at;
  if (cur > 0 && pAge < HANDOFF_MS && !h.reduced) {
    const prev = lp.phrases[cur - 1]!;
    const pp = placePhrase(prev.layout, prev, prev.chipWord, stage.region, measure, voice.lh, sizeMax, rtl);
    const k = easeOut(pAge / HANDOFF_MS);
    drawPhrase(h, pp, prev, sc, voice, stage, look, family, cover?.grid ?? null, { alpha: 1 - k, dy: -S * 0.05 * k, s: 1 });
  }
  drawPhrase(h, placed, ph, sc, voice, stage, look, family, cover?.grid ?? null, entrance(ph, pAge, h.reduced, sc, age));
  if (ph.sticker) drawSticker(h, ph, placed, family[0]!, pAge, h.reduced, S);
  return finish(h);
}

function finish(h: SceneHost): SceneFx {
  return guardFx({ grain: 0.02, vignette: 0, bloom: 0, exposure: 1 }, { reducedMotion: h.reduced });
}

const inset = (W: number, H: number, k: number): Region => ({ x: W * k * 0.5 + W * 0.04, y: H * k * 0.5 + H * 0.06, w: W * (1 - k) - W * 0.08, h: H * (1 - k) - H * 0.12 });

/** the emptiest part of the visible cover, in frame px, inside the central 84% (CVP-PRC-SAL-001 placement) */
function onCoverRegion(r: CoverReading | null, st: { cx: number; cy: number; side: number }, W: number, H: number): Region {
  const safe = { x: W * 0.08, y: H * 0.08, w: W * 0.84, h: H * 0.84 };
  const toUv = (x: number, y: number) => ({ u: (x - (st.cx - st.side / 2)) / st.side, v: (y - (st.cy - st.side / 2)) / st.side });
  const a = toUv(safe.x, safe.y);
  const b = toUv(safe.x + safe.w, safe.y + safe.h);
  const within: Box = { x: Math.max(0, a.u), y: Math.max(0, a.v), w: Math.min(1, b.u) - Math.max(0, a.u), h: Math.min(1, b.v) - Math.max(0, a.v) };
  const bw = within.w * 0.78;
  const bh = within.h * 0.42;
  if (!r) return { x: safe.x + safe.w * 0.11, y: safe.y + safe.h * 0.29, w: safe.w * 0.78, h: safe.h * 0.42 };
  // search inline (the analysis helper picks the box)
  let best = { x: within.x + (within.w - bw) / 2, y: within.y + (within.h - bh) / 2 };
  let bs = -1;
  for (let j = 0; j <= 6; j++)
    for (let i = 0; i <= 6; i++) {
      const x = within.x + ((within.w - bw) * i) / 6;
      const y = within.y + ((within.h - bh) * j) / 6;
      let s = 0;
      let n = 0;
      for (let yy = Math.floor(y * 48); yy < Math.ceil((y + bh) * 48); yy++)
        for (let xx = Math.floor(x * 48); xx < Math.ceil((x + bw) * 48); xx++) {
          if (xx < 0 || yy < 0 || xx >= 48 || yy >= 48) continue;
          s += r.empty[yy * 48 + xx]!;
          n++;
        }
      const centre = 1 - Math.hypot(x + bw / 2 - 0.5, y + bh / 2 - 0.5);
      const score = (n ? s / n : 0) + centre * 0.06;
      if (score > bs) {
        bs = score;
        best = { x, y };
      }
    }
  return { x: st.cx - st.side / 2 + best.x * st.side, y: st.cy - st.side / 2 + best.y * st.side, w: bw * st.side, h: bh * st.side };
}

type Entr = { alpha: number; dy: number; s: number; dx?: number; words?: (i: number) => number };

/** CVP-MOT-PHM: how the phrase arrives */
function entrance(ph: PhrasePlan, pAge: number, reduced: boolean, sc: VisualTimeline['scenes'][number], lineAge: number): Entr {
  if (reduced) return { alpha: clamp(pAge / 200), dy: 0, s: 1 }; // 007 fade
  const k = clamp(pAge / POP_MS);
  switch (ph.motion) {
    case 'CVP-MOT-PHM-003':
      return { alpha: k, dy: 0, s: 1, dx: (1 - easeOut(k)) * -40 };
    case 'CVP-MOT-PHM-004': {
      const p = clamp(pAge / 110);
      return { alpha: 1, dy: 0, s: 1 + (1 - easeOut(p)) * 0.25 };
    }
    case 'CVP-MOT-PHM-005': {
      const p = clamp(pAge / 240);
      const b = p < 1 ? Math.sin(p * Math.PI * 1.5) * (1 - p) * 0.4 : 0;
      return { alpha: clamp(pAge / 60), dy: -(1 - easeOut(p)) * 60 + b * 18, s: 1 };
    }
    case 'CVP-MOT-PHM-006':
      // word-by-word build: each word pops on its own authored time
      return { alpha: 1, dy: 0, s: 1, words: (i) => clamp((lineAge - (sc.words[i]!.startMs - sc.startMs + 30)) / 120) };
    default: {
      // 001 pop and settle: 0.9 -> 1 with a small overshoot
      const over = k < 1 ? 0.9 + 0.13 * Math.sin(k * Math.PI * 0.75) / Math.sin(Math.PI * 0.75) * k : 1;
      return { alpha: clamp(pAge / 80), dy: 0, s: Math.min(1.04, over) };
    }
  }
}

function drawPhrase(h: SceneHost, placed: PlacedWord[], ph: PhrasePlan, sc: VisualTimeline['scenes'][number], voice: ReturnType<typeof voiceForScript>, stage: Stage, look: SectionLook, family: string[], grid: Uint8ClampedArray | null, e: Entr) {
  if (e.alpha <= 0.01 || !placed.length) return;
  // the phrase scales about its own centre
  const minX = Math.min(...placed.map((p) => p.x));
  const maxX = Math.max(...placed.map((p) => p.x + p.w));
  const minY = Math.min(...placed.map((p) => p.y - p.size * 0.6));
  const maxY = Math.max(...placed.map((p) => p.y + p.size * 0.6));
  const ox = (minX + maxX) / 2;
  const oy = (minY + maxY) / 2;
  // never past the frame's safe edge: a phrase whose measured width ran wide (italic overhang, an outline) is scaled down
  const fit = Math.min(1, (h.W * 0.94) / Math.max(1, maxX - minX + (maxY - minY) * 0.15), (h.H * 0.94) / Math.max(1, maxY - minY));
  const cxp = Math.min(Math.max(ox, h.W * 0.03 + ((maxX - minX) * fit) / 2), h.W * 0.97 - ((maxX - minX) * fit) / 2);
  const base = mul(translate(cxp + (e.dx ?? 0), oy + e.dy), mul(scale(e.s * fit, e.s * fit), translate(-ox, -oy)));
  const duo: [string, string] = [family[0]!, family[2] ?? '#ffffff'];
  for (const p of placed) {
    const wa = e.words ? e.words(p.idx) : 1;
    if (wa <= 0) continue;
    const label = labelOf(voice, sc.words[p.idx]!.text);
    const isChip = p.idx === ph.chipWord;
    // colour: against the cover cells behind the word, or against the field
    let fill: string;
    let outline: string | null = null;
    const boxPx = { x: p.x, y: p.y - p.size * 0.45, w: p.w, h: p.size * 0.9 };
    if (stage.onCover && stage.side > 0) {
      const uv: Box = { x: (boxPx.x - (stage.cx - stage.side / 2)) / stage.side, y: (boxPx.y - (stage.cy - stage.side / 2)) / stage.side, w: boxPx.w / stage.side, h: boxPx.h / stage.side };
      const c = wordColour(look.colour, grid, uv, family, duo);
      fill = c.fill;
      outline = c.outline;
    } else {
      const bg = stage.field ?? '#000000';
      fill = [...family, '#ffffff', '#111111'].find((c) => contrastRatio(c, bg) >= 4.5) ?? '#ffffff';
    }
    let textCol = fill;
    if (isChip) textCol = drawChip(h, look.chip, boxPx, fill, base, e.alpha * wa, p.size);
    const tt = textTex(h, label, (px) => fontOf(voice, px), p.size, textCol, { hi: p.size > 140 ? 1.5 : 2.5, stroke: outline && !isChip ? { color: outline, width: Math.max(2, p.size * 0.06) } : undefined });
    const s = e.words ? 0.85 + 0.15 * easeOut(wa) : 1;
    drawText(h, tt, mul(base, mul(translate(p.x + p.w / 2, p.y), mul(scale(s, s), translate(-(p.x + p.w / 2), -p.y)))), p.x, p.y, { alpha: e.alpha * wa });
    // an existing icon beside the chip word that has one (one mark per phrase: not when a sticker is up)
    if (isChip && !ph.sticker) {
      const icon = iconForWord(sc.words[p.idx]!.text);
      if (icon) {
        const px = 160;
        const tex = h.tex(`cvp|icn|${icon}|${family[0]}`, px, px, (c) => {
          c.translate(px / 2, px / 2);
          drawIcon(c, icon, px - 8, iconColors(icon, family[0]!), '#ffffff');
        });
        // above the chip word's top-right corner, so it never covers the next word
        const sz = p.size * 0.62;
        h.sprite({ tex: tex.tex, m: mul(base, mul(translate(p.x + p.w - sz * 0.2, p.y - p.size * 0.62 - sz * 0.35), rotate(0.18))), w: sz, h: sz, alpha: e.alpha * wa, mode: 0, camera: false });
      }
    }
  }
}

/** CVP-TYP-CHP-001..006 behind the chip word; returns the text colour that reads on it */
function drawChip(h: SceneHost, id: SectionLook['chip'], b: { x: number; y: number; w: number; h: number }, fill: string, base: ReturnType<typeof translate>, alpha: number, size: number): string {
  const pad = size * 0.16;
  const w = b.w + pad * 2;
  const hh = b.h + pad * 0.8;
  const m = mul(base, translate(b.x + b.w / 2, b.y + b.h / 2));
  const dark = '#14101c';
  switch (id) {
    case 'CVP-TYP-CHP-002':
      h.shape({ kind: 0, m, w, h: hh, color: fill, alpha, radius: 2 });
      return contrastRatio(dark, fill) >= contrastRatio('#ffffff', fill) ? dark : '#ffffff';
    case 'CVP-TYP-CHP-003': {
      const lw = Math.max(2, size * 0.05);
      for (const [x, y, ww, hhh] of [[0, -hh / 2, w, lw], [0, hh / 2, w, lw], [-w / 2, 0, lw, hh], [w / 2, 0, lw, hh]] as const) h.shape({ kind: 0, m: mul(m, translate(x, y)), w: ww, h: hhh, color: fill, alpha });
      return fill;
    }
    case 'CVP-TYP-CHP-004':
      h.shape({ kind: 4, m: mul(m, translate(0, hh * 0.12)), w: w * 1.04, h: hh * 0.62, color: fill, alpha: alpha * 0.85, radius: 3, width: 3 });
      return contrastRatio(dark, fill) >= 4.5 ? dark : '#ffffff';
    case 'CVP-TYP-CHP-005':
      h.shape({ kind: 0, m: mul(m, rotate(-0.04)), w: w * 1.06, h: hh, color: '#f3ead2', alpha: alpha * 0.92 });
      return dark;
    case 'CVP-TYP-CHP-006':
      h.shape({ kind: 0, m, w, h: hh, color: fill, alpha, radius: hh / 2 });
      return contrastRatio(dark, fill) >= contrastRatio('#ffffff', fill) ? dark : '#ffffff';
    default:
      // 001: the white chip (existing)
      h.shape({ kind: 0, m, w, h: hh, color: '#ffffff', alpha, radius: hh * 0.22 });
      return contrastRatio(fill, '#ffffff') >= 4.5 ? fill : dark;
  }
}

function drawSticker(h: SceneHost, ph: PhrasePlan, placed: PlacedWord[], colour: string, pAge: number, reduced: boolean, S: number) {
  const px = 256;
  const tex = h.tex(`cvp|stk|${ph.sticker}|${colour}`, px, px, (c) => paintSticker(c, ph.sticker!, px, colour));
  const last = placed[placed.length - 1]!;
  const sz = S * 0.13;
  const k = reduced ? 1 : easeOut(clamp((pAge - 120) / 200));
  if (k <= 0) return;
  const x = Math.min(h.W - sz * 0.6, last.x + last.w + sz * 0.45);
  const y = last.y - last.size * 0.5;
  // a little drift (not with reduced motion)
  const drift = reduced ? 0 : Math.sin(pAge / 900) * 0.06;
  h.sprite({ tex: tex.tex, m: mul(translate(x, y), mul(rotate(-0.15 + drift), scale((sz / px) * (0.7 + 0.3 * k), (sz / px) * (0.7 + 0.3 * k)))), w: px, h: px, alpha: k, mode: 0, camera: false });
}

function drawBurst(h: SceneHost, look: SectionLook, placed: PlacedWord[], t: number, seed: number) {
  const beats = h.tl.beatTimesMs;
  if (!beats.length) return;
  // the last downbeat (every fourth beat) before t
  let lo = 0;
  let hi = beats.length - 1;
  let f = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (beats[mid]! <= t) {
      f = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  if (f < 0) return;
  const down = f - (f % 4);
  const age = t - beats[down]!;
  if (age > 500) return;
  const p = age / 500;
  const minX = Math.min(...placed.map((q) => q.x));
  const maxX = Math.max(...placed.map((q) => q.x + q.w));
  const cy = placed.reduce((a, q) => a + q.y, 0) / placed.length;
  const px = 512;
  const fam = hotFamily(null, h.tl.palette, look.hotK);
  const tex = h.tex(`cvp|bst|${look.burst}|${fam[0]}`, px, px, (c) => paintBurst(c, look.burst!, px, fam[1]!, fam[0]!, seed));
  const size = Math.max(maxX - minX, h.H * 0.3) * (0.7 + 0.6 * easeOut(p));
  h.sprite({ tex: tex.tex, m: mul(translate((minX + maxX) / 2, cy), mul(rotate(p * 0.3), scale(size / px, size / px))), w: px, h: px, alpha: 1 - p, mode: 0, camera: false });
}

/** C5: three cut-out stickers from the cover round the phrase (cropped pixels only) */
function drawCutouts(h: SceneHost, look: SectionLook, canvas: HTMLCanvasElement, seed: number) {
  const spots: [number, number, number][] = h.H > h.W * 1.15 ? [[0.25, 0.14, -0.12], [0.75, 0.86, 0.1], [0.78, 0.16, 0.08]] : [[0.13, 0.24, -0.12], [0.87, 0.76, 0.1], [0.86, 0.22, 0.08]];
  look.cuts.forEach((id, i) => {
    const s = spots[i]!;
    const box = { x: 0.1 + ((seed * 7 + i * 31) % 50) / 100, y: 0.1 + ((seed * 13 + i * 17) % 50) / 100, w: 0.3, h: 0.3 };
    const px = 320;
    const tex = h.tex(`cvp|cut|${id}|${i}|${seed}`, px, px, (c) => paintCutout(c, id, px, canvas, box, seed + i));
    const sz = Math.min(h.W, h.H) * 0.3;
    h.sprite({ tex: tex.tex, m: mul(translate(h.W * s[0], h.H * s[1]), mul(rotate(s[2]), scale(sz / px, sz / px))), w: px, h: px, mode: 0, camera: false });
  });
}
