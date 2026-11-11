// Sketch Cards (SKC), Phase 3: the hand-lettered cards style as specified in docs/visual-production/styles/sketch-cards. Every
// lyric line is lettered on a real kind of paper (index card, receipt, napkin, riso sheet, wheatpaste...) that lands on a place
// (a desk at night, a kitchen table, a corkboard, a street wall...), with a small drawing from the line's register. Sections
// change the place; lines inside a section build up on it according to the section's composition (one card on a surface, a
// pile, a pinned wall, a full-bleed poster, a held cue card, a cluster of sticky notes). Breaks are danced by the doodles.
//
// A pure function of time (AGENTS.md rule 3): the song plan is computed once per timeline, and each frame only looks up what
// is on screen at t. Card and ground canvases are painted once and kept as textures by the host.

import { mul, rotate, scale, translate, type Affine } from '../../kinetic/gl/gpu';
import { clamp, easeOut, hash01, noise1 } from '../../kinetic/gl/scenes/common';
import type { SceneFx, SceneHost, TexEntry } from '../../kinetic/gl/scenes/types';
import type { VisualTimeline } from '../../kinetic/types';
import { guardFx } from '../flash';
import { plannedAt, type PlannedSection } from '../scene/planner';
import { lineTiming, revealAt } from '../timing';
import { applyProcess, CARDS, paintCard, processInk, textArea, type Rect } from './cards';
import { HANDS, TOOLS } from './drawings/props';
import { DOODLES } from './drawings/doodles';
import type { Drawing } from './drawings/types';
import { paintGround } from './grounds';
import { isRtl, layoutWords, letterWord, wordBox, type Placed } from './letter';
import { Pen } from './pen';
import { sceneSpec, sketchPlan, type CardPick } from './plan';

const LAND_MS = 240;
const WORD_MS = 170;

// ---- line lookup: the card on screen stays until the next one lands (a card does not vanish in a vocal gap) -------------------
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

// ---- textures ----------------------------------------------------------------------------------------------------------------
type CardTex = { base: TexEntry; pad: number; w: number; h: number; words: { p: Placed; tex: TexEntry; box: ReturnType<typeof wordBox> }[] };

const layouts = new Map<string, Placed[]>();

/** paint a card for a line (or a chunk of one) at a long side of `px` texture pixels */
function cardTex(h: SceneHost, pick: CardPick, words: string[], part: string, px: number): CardTex {
  const spec = CARDS[pick.card];
  const chunky = pick.process === 'SKC-PRC-PRT-001';
  const res = chunky ? Math.min(px, 420) : px; // the paint-program look is low-res, shown with nearest filtering
  const w = Math.round(spec.aspect >= 1 ? res : res * spec.aspect);
  const hh = Math.round(spec.aspect >= 1 ? res / spec.aspect : res);
  const pad = Math.round(Math.min(w, hh) * 0.08);
  const set = processInk(pick.process, pick.set);
  const key = `s|skc|${pick.line}|${part}|${res}`;
  const area = textArea(pick.card, w, hh, !!pick.border);
  let drawRect: Rect | null = null;
  let zone = area;
  if (pick.drawing && part === 'a') {
    if (w >= hh) {
      const dw = area.w * 0.32;
      drawRect = { x: area.x + area.w - dw, y: area.y + area.h * 0.3, w: dw, h: area.h * 0.7 };
      zone = { ...area, w: area.w - dw - area.w * 0.03 };
    } else {
      const dh = area.h * 0.3;
      drawRect = { x: area.x + area.w * 0.25, y: area.y + area.h - dh, w: area.w * 0.75, h: dh };
      zone = { ...area, h: area.h - dh - area.h * 0.03 };
    }
  }
  const base = h.tex(`${key}|base`, w + pad * 2, hh + pad * 2, (cx) => {
    paintCard(cx, pick.card, w, hh, pad, set, pick.seed, pick.border, 0.3);
    if (drawRect && pick.drawing) {
      cx.save();
      cx.translate(pad + drawRect.x + drawRect.w / 2, pad + drawRect.y + drawRect.h / 2);
      const k = Math.min(drawRect.w, drawRect.h) / 104;
      cx.scale(k, k);
      pick.drawing.d.draw(new Pen(cx, { ink: set.ink, accent: set.accent, paper: set.paper, shade: set.shade, width: 2.6 }, pick.seed ^ 0x77, set.dark ? 0.85 : 0.6));
      cx.restore();
    }
    applyProcess(cx, w + pad * 2, hh + pad * 2, pick.process, set, pick.seed, false);
  }, { nearest: chunky });
  const lk = `${key}|${zone.w | 0}`;
  let placed = layouts.get(lk);
  if (!placed) {
    placed = layoutWords((f, t) => h.measure(f, t), words, zone, set, pick.hand, pick.script, pick.seed ^ 0x51, { pill: pick.pill, big: pick.big });
    layouts.set(lk, placed);
    if (layouts.size > 48) layouts.delete(layouts.keys().next().value as string);
  }
  const hl = pick.process === 'SKC-PRC-PRT-007' ? '#fff35c' : null;
  const out = placed.map((p) => {
    const box = wordBox(p);
    const tex = h.tex(`${key}|w${p.idx}`, box.W, box.H, (cx) => {
      letterWord(cx, p, pick.script, pick.seed + p.idx * 131, p.role === 'big' ? hl : null);
      applyProcess(cx, box.W, box.H, pick.process, set, pick.seed + p.idx, true);
    }, { nearest: chunky });
    return { p, tex, box };
  });
  return { base, pad, w, h: hh, words: out };
}

function drawingTex(h: SceneHost, key: string, d: Drawing, px: number, ink: string, accent: string, paper: string, seed: number): TexEntry {
  return h.tex(`s|skc|d|${key}|${px}|${ink}|${accent}`, px, px, (cx) => {
    cx.translate(px / 2, px / 2);
    cx.scale(px / 112, px / 112);
    d.draw(new Pen(cx, { ink, accent, paper, shade: ink + '66', width: 2.4 }, seed, 0.6));
  });
}

// ---- placement ---------------------------------------------------------------------------------------------------------------
type Place = { cx: number; cy: number; size: number; rot: number };

/** where a card sits, by composition: `slot` is its index among the section's lines (piles and walls keep earlier cards) */
function placeFor(comp: string, W: number, H: number, aspect: number, pick: CardPick, slot: number): Place {
  const portrait = H > W * 1.15;
  // card 60-80% of frame height (limits.scale), never wider than the frame allows
  const fit = (hFrac: number, wFrac: number) => {
    const hgt = Math.min(H * hFrac, (W * wFrac) / aspect);
    return hgt * Math.max(aspect, 1) > 0 ? Math.max(hgt * aspect, hgt) : hgt;
  };
  switch (comp) {
    case 'SKC-CMP-C5':
      return { cx: W / 2, cy: H / 2, size: fit(0.9, 0.94), rot: pick.rot * 0.3 };
    case 'SKC-CMP-C2':
      return { cx: W / 2, cy: H * (portrait ? 0.46 : 0.44), size: fit(0.66, 0.84), rot: pick.rot * 0.4 };
    case 'SKC-CMP-C4': {
      // pinned wall: the newest card in the middle, earlier ones pinned round it smaller
      if (slot === 0) return { cx: W / 2 + pick.dx * W, cy: H / 2 + pick.dy * H, size: fit(0.64, 0.7), rot: pick.rot * 0.6 };
      const spots = portrait
        ? [[0.26, 0.17], [0.74, 0.16], [0.26, 0.84], [0.74, 0.85]]
        : [[0.14, 0.27], [0.86, 0.3], [0.15, 0.76], [0.85, 0.74]];
      const s = spots[(slot - 1) % spots.length]!;
      return { cx: W * s[0]!, cy: H * s[1]!, size: fit(portrait ? 0.22 : 0.3, portrait ? 0.36 : 0.24), rot: pick.rot * 1.4 };
    }
    case 'SKC-CMP-C3':
      return { cx: W / 2 + pick.dx * W * (slot ? 1.8 : 1), cy: H / 2 + pick.dy * H * (slot ? 1.8 : 1), size: fit(0.68, 0.8) * (slot ? 0.97 : 1), rot: pick.rot * (slot ? 1.6 : 1) };
    default:
      return { cx: W / 2 + pick.dx * W, cy: H / 2 + pick.dy * H, size: fit(0.72, 0.84), rot: pick.rot };
  }
}

function cardMatrix(pl: Place, k: number, extraRot = 0, dy = 0, sx = 1): Affine {
  let m = translate(pl.cx, pl.cy + dy);
  m = mul(m, rotate(((pl.rot + extraRot) * Math.PI) / 180));
  return mul(m, scale(k * sx, k));
}

/** draw one card at a place; `age` ms since it started to land (Infinity = resting); `reveal` decides each word's progress */
function drawCard(h: SceneHost, ct: CardTex, pl: Place, age: number, reveal: ((i: number) => number) | null, rtl: boolean, opts: { alpha?: number; flip?: number; dy?: number; extraRot?: number } = {}) {
  const long = Math.max(ct.w, ct.h);
  const k0 = pl.size / long; // texture px -> screen px
  const land = h.reduced ? 1 : easeOut(clamp(age / LAND_MS));
  // a dropped card: a little bigger and higher before it lands
  const k = k0 * (1 + (1 - land) * 0.08);
  const dy = (opts.dy ?? 0) - (1 - land) * pl.size * 0.04;
  const alpha = (opts.alpha ?? 1) * (h.reduced ? clamp(age / 200) : clamp(age / 60));
  const sx = opts.flip ?? 1;
  const m = cardMatrix(pl, k, opts.extraRot ?? 0, dy, sx);
  h.sprite({ tex: ct.base.tex, m, w: ct.base.w, h: ct.base.h, alpha, mode: 0, camera: false });
  if (!reveal) return;
  for (const wd of ct.words) {
    const p = reveal(wd.p.idx);
    if (p <= 0) continue;
    const bx = ct.pad + wd.p.x + wd.p.w / 2 - (ct.w + ct.pad * 2) / 2;
    const by = ct.pad + wd.p.y + wd.p.h / 2 - (ct.h + ct.pad * 2) / 2;
    const wm = mul(m, translate(bx, by));
    // Latin and other left-to-right text is lettered in (a wipe); right-to-left words fade, so nothing wipes against reading order
    const wipe = !rtl && !h.reduced && p < 1;
    h.sprite({ tex: wd.tex.tex, m: wm, w: wd.box.W, h: wd.box.H, alpha: alpha * (rtl || h.reduced ? p : 1), mode: 0, camera: false, clip: wipe ? { x: p, span: [0, 1] } : undefined });
  }
}

// ---- the scene ---------------------------------------------------------------------------------------------------------------
export function drawSketchCardsScene(h: SceneHost): SceneFx {
  const { W, H, frame, tl } = h;
  const t = frame.tMs;
  const sp = sketchPlan(tl);
  const ps: PlannedSection | null = plannedAt(sp.plan, t) ?? sp.plan.sections[0] ?? null;
  const sceneId = ps?.scene.id ?? 'SKC-SCN-01';
  const spec = sceneSpec(sceneId);
  const comp = ps?.composition.id ?? 'SKC-CMP-C1';
  const sinceSection = ps ? t - ps.section.startMs : Infinity;
  const tint = sp.palette[0] ?? '#d0c0a0';

  // ground: painted at most 1600 px on the long side, stretched to the stage
  const gk = Math.min(1, 1600 / Math.max(W, H));
  const gw = Math.round(W * gk);
  const gh = Math.round(H * gk);
  const ground = h.tex(`s|skc|g|${spec.ground}|${gw}x${gh}|${tint}|${spec.night ? 1 : 0}`, gw, gh, (cx) => paintGround(cx, spec.ground, gw, gh, sp.plan.seed ^ 0x6a, tint, !!spec.night));
  // the transition into this section: a pull back zooms out from the old framing; a sweep slides the new ground in
  const tr = ps?.transition?.id ?? null;
  let gm: Affine = translate(W / 2, H / 2);
  if (!h.reduced && tr === 'SKC-TRN-SWEEP' && sinceSection < 600) gm = translate(W / 2 + (1 - easeOut(sinceSection / 600)) * W, H / 2);
  if (!h.reduced && tr === 'SKC-TRN-PULL-BACK' && sinceSection < 1400) gm = mul(gm, scale(1 + (1 - easeOut(sinceSection / 1400)) * 0.25, 1 + (1 - easeOut(sinceSection / 1400)) * 0.25));
  h.clear('#111012');
  h.sprite({ tex: ground.tex, m: gm, w: W, h: H, mode: 0, camera: false });

  const li = currentLine(tl, t);
  const inSection = (i: number) => !!ps?.section.lines && i >= ps.section.lines[0] && i <= ps.section.lines[1];
  const cardPx = Math.min(1100, Math.round(Math.max(W, H) * 0.8 * Math.min(1.5, h.dpr)));

  // intro, breaks and the creature break: no card of this section yet
  const lineHere = li >= 0 && inSection(li);
  if (!lineHere) {
    drawTools(h, sp.plan.seed, spec.ground);
    if (ps && (ps.section.role === 'break' || ps.section.role === 'intro' || ps.scene.id === 'SKC-SCN-10') && !sp.song.dark) drawCreatures(h, ps, t);
    if (tl.label && ps && (ps.section.role === 'intro' || ps.section.role === 'break') && t - ps.section.startMs > 1200) drawTitle(h, tl.label, sp.cards[0], cardPx, t - ps.section.startMs - 1200);
    return finish(h, sp.song.dark);
  }

  const pick = sp.cards[li]!;
  const scene = tl.scenes[li]!;
  const words = scene.words.map((w) => w.text);
  const lineStart = scene.startMs - 30;
  const age = t - lineStart;
  const next = tl.scenes[li + 1];
  const dur = Math.max(500, (next ? next.startMs : scene.endMs + 900) - lineStart);
  const timing = lineTiming(scene);
  const rtl = isRtl(pick.script);
  const startOf = (i: number) => (timing === 'line' ? 0 : revealAt(scene.words, i, lineStart, dur, timing));
  const reveal = (i: number) => (timing === 'line' ? 1 : clamp((age - startOf(i)) / WORD_MS));
  const aspect = CARDS[pick.card].aspect;
  const first = ps!.section.lines![0];
  const slotOf = (i: number) => li - i; // 0 = the newest

  if (comp === 'SKC-CMP-C6') {
    drawStickies(h, sp.cards, tl, li, first, cardPx, reveal, startOf, age);
    return finish(h, sp.song.dark);
  }

  // earlier cards that stay: the pile keeps up to 4 under the newest, the wall up to 4 round it; a single surface keeps the
  // previous card under the landing one until it has landed (one card moving at a time)
  const keep = comp === 'SKC-CMP-C3' ? 4 : comp === 'SKC-CMP-C4' ? 4 : age < LAND_MS ? 1 : 0;
  for (let i = Math.max(first, li - keep); i < li; i++) {
    const p = sp.cards[i]!;
    const sc = tl.scenes[i]!;
    const a = CARDS[p.card].aspect;
    const pl = placeFor(comp, W, H, a, p, comp === 'SKC-CMP-C3' || comp === 'SKC-CMP-C4' ? slotOf(i) : 0);
    const ct = cardTex(h, p, sc.words.map((w) => w.text), 'a', comp === 'SKC-CMP-C4' ? Math.round(cardPx * 0.5) : cardPx);
    drawCard(h, ct, pl, Infinity, () => 1, isRtl(p.script), { alpha: comp === 'SKC-CMP-C3' ? 0.96 : 1 });
    if (comp === 'SKC-CMP-C4') pin(h, pl, ct, p);
  }

  const pl = placeFor(comp, W, H, aspect, pick, 0);
  const ct = cardTex(h, pick, words, 'a', cardPx);
  let flip = 1;
  if (!h.reduced && tr === 'SKC-TRN-FLIP' && li === first && age < 400) flip = Math.abs(Math.cos((1 - age / 400) * Math.PI * 0.5)) || 0.02;
  let dy = 0;
  let extraRot = 0;
  if (comp === 'SKC-CMP-C2') {
    // held: a small handheld sway, and a hand swap (the old card drops away, the new one comes up) on each line
    if (!h.reduced) {
      dy = noise1(t / 900, 3) * H * 0.006 + (1 - easeOut(clamp(age / 350))) * H * 0.5;
      extraRot = noise1(t / 1300, 5) * 0.8;
    }
  }
  drawCard(h, ct, pl, comp === 'SKC-CMP-C5' ? Infinity : age, reveal, rtl, { flip, dy, extraRot });
  if (comp === 'SKC-CMP-C2') drawHands(h, pl, ct, pick, dy, extraRot);
  if (comp === 'SKC-CMP-C4') pin(h, pl, ct, pick);
  if (spec.ground === 'SKC-SRF-GRD-001' || spec.ground === 'SKC-SRF-GRD-009' || spec.ground === 'SKC-SRF-GRD-002') drawTools(h, sp.plan.seed, spec.ground, true);
  return finish(h, sp.song.dark);
}

function finish(h: SceneHost, dark: boolean): SceneFx {
  return guardFx({ grain: dark ? 0.07 : 0.045, vignette: dark ? 0.22 : 0.12, bloom: 0, exposure: 1 }, { reducedMotion: h.reduced });
}

/** a pushpin or a strip of tape on a pinned card's top edge */
function pin(h: SceneHost, pl: Place, ct: CardTex, pick: CardPick) {
  const long = Math.max(ct.w, ct.h);
  const k = pl.size / long;
  const m = cardMatrix(pl, k);
  const topY = -ct.h / 2;
  if (hash01(pick.seed) < 0.5) {
    const at = mul(m, translate(0, topY + ct.h * 0.06));
    h.shape({ kind: 2, m: mul(at, translate(3 / k, 4 / k)), w: (26 / k) * k, h: (26 / k) * k, color: '#000000', alpha: 0.25, radius: 13, soft: 6, camera: false });
    h.shape({ kind: 2, m: at, w: 22, h: 22, color: pick.set.accent === pick.set.paper ? '#d23a2c' : pick.set.accent, alpha: 1, radius: 11, camera: false });
    h.shape({ kind: 2, m: mul(at, translate(-3 / k, -3 / k)), w: 7, h: 7, color: '#ffffff', alpha: 0.6, radius: 3.5, camera: false });
  } else {
    const at = mul(m, translate(0, topY));
    h.shape({ kind: 0, m: mul(at, rotate(0.05)), w: ct.w * 0.28, h: ct.h * 0.09, color: '#efe6c8', alpha: 0.78, camera: false });
  }
}

/** the hands that hold a cue card (SKC-OBJ-HND): two at the sides, or one under it */
function drawHands(h: SceneHost, pl: Place, ct: CardTex, pick: CardPick, dy: number, extraRot: number) {
  const long = Math.max(ct.w, ct.h);
  const k = pl.size / long;
  const m = cardMatrix(pl, k, extraRot, dy);
  const which = hash01(pick.seed + 7) < 0.6 ? 'SKC-OBJ-HND-002' : 'SKC-OBJ-HND-001';
  const d = HANDS[which]!;
  // the hand box is 100 units for the card's width; the gripped edge is y = 0 at the card's bottom
  const px = 512;
  const tex = drawingTex(h, which, d, px, '#1f1a24', pick.set.accent, '#fbf7ee', 41);
  const unit = ct.w / 100;
  const at = mul(m, mul(translate(0, ct.h / 2), scale((unit * 112) / px, (unit * 112) / px)));
  h.sprite({ tex: tex.tex, m: at, w: px, h: px, mode: 0, camera: false });
}

/** desk tools at the frame edges (SKC-PRP-TOL), fixed for the song */
function drawTools(h: SceneHost, seed: number, ground: string, edgesOnly = false) {
  if (ground === 'SKC-SRF-GRD-010' || ground === 'SKC-SRF-GRD-004' || ground === 'SKC-SRF-GRD-006' || ground === 'SKC-SRF-GRD-008' || ground === 'SKC-SRF-GRD-011' || ground === 'SKC-SRF-GRD-007' || ground === 'SKC-SRF-GRD-003') return;
  const ids = Object.keys(TOOLS);
  const S = Math.min(h.W, h.H);
  const spots: [number, number][] = edgesOnly ? [[0.06, 0.9], [0.95, 0.12]] : [[0.18, 0.78], [0.82, 0.22], [0.78, 0.8], [0.22, 0.24]];
  spots.forEach(([x, y], i) => {
    const id = ids[Math.floor(hash01(seed + i * 17) * ids.length)]!;
    const tex = drawingTex(h, id, TOOLS[id]!, 384, '#1f1a24', '#e0574a', '#f6f1e6', seed + i);
    const sz = S * (edgesOnly ? 0.26 : 0.3);
    h.sprite({ tex: tex.tex, m: mul(translate(h.W * x, h.H * y), mul(rotate(hash01(seed + i) * 6), scale(sz / 384, sz / 384))), w: 384, h: 384, mode: 0, camera: false });
  });
}

/** SKC-MOT-CRE: doodles dance on the ground in a break; ten choreographies, one per break by its index */
function drawCreatures(h: SceneHost, ps: PlannedSection, t: number) {
  const ids = Object.keys(DOODLES);
  const n = 5;
  const tl = h.tl;
  const beatMs = tl.bpm ? 60000 / tl.bpm : 500;
  const b = (t - ps.section.startMs) / beatMs; // beats since the break began
  const ph = b % 1;
  const chore = ps.section.index % 10;
  const S = Math.min(h.W, h.H);
  const size = S * 0.2;
  const groundY = h.H * 0.66;
  for (let i = 0; i < n; i++) {
    const id = ids[(ps.section.index * 3 + i * 5) % ids.length]!;
    const tex = drawingTex(h, id, DOODLES[id]!, 320, '#1f1a24', ['#e0574a', '#2f7fe0', '#f1b92a', '#2e9a6a', '#a14f7b'][i]!, '#fbf7ee', i * 31 + 7);
    let x = h.W * (0.16 + (i * 0.68) / (n - 1));
    let y = groundY;
    let rot = 0;
    let sc = 1;
    const m = h.reduced ? 0 : 1;
    const hop = Math.abs(Math.sin(ph * Math.PI));
    switch (chore) {
      case 0: // bounce in place
        y -= hop * size * 0.18 * m;
        break;
      case 1: // conga line
        x = h.W * (((i / n + b * 0.06) % 1.2) - 0.1);
        y -= Math.abs(Math.sin((b + i * 0.5) * Math.PI)) * size * 0.08 * m;
        break;
      case 2: // spin
        rot = b * 90 * m + i * 30;
        break;
      case 3: // hop across
        x = h.W * (((i * 0.2 + b * 0.1) % 1.1) - 0.05);
        y -= hop * size * 0.3 * m;
        break;
      case 4: // wave (a sway)
        rot = Math.sin((b + i * 0.25) * Math.PI) * 14 * m;
        break;
      case 5: // bob heads: alternate
        y -= (Math.floor(b + i) % 2) * size * 0.1 * m;
        break;
      case 6: { // circle dance
        const a = (b / 8) * Math.PI * 2 * m + (i / n) * Math.PI * 2;
        x = h.W / 2 + Math.cos(a) * h.W * 0.3;
        y = groundY - h.H * 0.08 + Math.sin(a) * h.H * 0.08;
        sc = 0.85 + (Math.sin(a) + 1) * 0.1;
        break;
      }
      case 7: // jump on downbeats (every 4th beat is higher)
        y -= (Math.floor(b) % 4 === 0 ? 0.4 : 0.12) * hop * size * m;
        break;
      case 8: // sleep: slow breathing
        sc = 1 + Math.sin(t / 900 + i) * 0.03 * m;
        rot = -80;
        y += size * 0.2;
        break;
      default: // peek from behind the edge
        y = h.H - size * (0.3 + 0.25 * Math.max(0, Math.sin((b / 4 + i * 0.3) * Math.PI)) * m);
    }
    h.sprite({ tex: tex.tex, m: mul(translate(x, y), mul(rotate((rot * Math.PI) / 180), scale((size * sc) / 320, (size * sc) / 320))), w: 320, h: 320, mode: 0, camera: false });
  }
}

/** the song's title on a card in an intro or break (from the timeline label) */
function drawTitle(h: SceneHost, label: string, pick: CardPick | undefined, cardPx: number, age: number) {
  if (!pick) return;
  const tp: CardPick = { ...pick, card: 'SKC-FRM-CRD-002', process: 'SKC-PRC-PRT-001', border: 'SKC-PRP-COL-001', drawing: null, line: -1, rot: -3, dx: 0, dy: -0.05 };
  const words = label.split(/\s+/).filter(Boolean).slice(0, 10);
  const ct = cardTex(h, tp, words, 't', Math.round(cardPx * 0.7));
  const pl = placeFor('SKC-CMP-C1', h.W, h.H, CARDS['SKC-FRM-CRD-002'].aspect, tp, 0);
  drawCard(h, ct, { ...pl, size: pl.size * 0.7, cy: h.H * 0.36 }, age, () => 1, false);
}

/** C6: the line split over sticky notes, each slapped on when its first word comes */
function drawStickies(h: SceneHost, cards: CardPick[], tl: VisualTimeline, li: number, first: number, cardPx: number, reveal: (i: number) => number, startOf: (i: number) => number, age: number) {
  const W = h.W;
  const H = h.H;
  const portrait = H > W * 1.15;
  const colours = ['#fbe57d', '#f9b9c8', '#b9e3f2', '#c9eeb1', '#fbcf8b'];
  const per = 3;
  // the previous line's notes stay up (dimmer) while this line's go up
  for (const [line, live] of [[li - 1, false], [li, true]] as const) {
    if (line < first || line < 0) continue;
    const pick = cards[line]!;
    const words = tl.scenes[line]!.words.map((w) => w.text);
    const chunks: number[][] = [];
    for (let i = 0; i < words.length; i += per) chunks.push(words.slice(i, i + per).map((_, k) => i + k));
    chunks.forEach((idx, c) => {
      const slot = (line - first) * 3 + c;
      const cols = portrait ? 2 : 4;
      const gx = (slot % cols) + 0.5;
      const gy = Math.floor(slot / cols) % (portrait ? 4 : 2);
      const note: CardPick = { ...pick, card: 'SKC-FRM-CRD-005', set: { ...pick.set, paper: colours[(line + c) % colours.length]! }, drawing: null, seed: pick.seed + c * 101, rot: (hash01(pick.seed + c) - 0.5) * 10 };
      const ct = cardTex(h, note, idx.map((i) => words[i]!), `n${c}`, Math.round(cardPx * 0.42));
      const size = Math.min(W / (cols + 0.6), H / ((portrait ? 4 : 2) + 0.6)) * 0.92;
      const pl: Place = { cx: (W * gx) / cols + (hash01(slot) - 0.5) * size * 0.1, cy: H * (portrait ? 0.14 + gy * 0.24 : 0.3 + gy * 0.42), size, rot: note.rot };
      const firstWord = idx[0]!;
      const a = live ? age - Math.max(0, startOf(firstWord)) : Infinity;
      if (a < 0) return;
      // remap word indices of the chunk to the chunk card's own 0..n
      drawCard(h, ct, pl, a, live ? (k) => reveal(idx[k] ?? 0) : () => 1, isRtl(note.script), { alpha: live ? 1 : 0.92 });
    });
  }
}
