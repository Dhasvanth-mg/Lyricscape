// Screenlife (SCR), Phase 3: one invented device world per song; each line is typed into a fictional interface at a human
// cadence and then sent or saved, and the thread or document is the song's memory. A camera looks at the device: over the
// shoulder in a room (C1), macro on the field (C2), desktop windows (C3), the thread face-on (C4), the lock screen (C6), or a
// full-frame terminal (C7). A pure function of time (AGENTS.md rule 3): the field text comes from the line's keystrokes, the
// thread from which lines have been sent by t, and every animation from how long ago a state changed.

import { mul, rotate, scale, translate, type Affine } from '../../kinetic/gl/gpu';
import { clamp, easeInOut, easeOut, noise1 } from '../../kinetic/gl/scenes/common';
import type { SceneFx, SceneHost } from '../../kinetic/gl/scenes/types';
import { guardFx } from '../flash';
import { orientationOf, plannedAt } from '../scene/planner';
import { isRtl } from '../sketch-cards/letter';
import { canvasMeasure, fillRR, wrap, textAt, type Ctx } from './draw';
import { font, X_HEIGHT } from './fonts';
import { kitSpec, screenFor, type KitEnv, type KitId, type Sent, type Spec } from './kits';
import { screenPlan, type Comp, type ScreenPlan, type SectionWorld } from './plan';
import { paintBanner, paintSticker } from './props';
import { themeFor } from './theme';
import { fieldAt, typingNow } from './typing';
import { bezelOf, paintFrame, paintFrameOver, paintGlass, paintRoom, paintWall, type FrameId } from './world';

const BASE: Record<KitId, number> = {
  'SCR-UIK-APP-001': 24,
  'SCR-UIK-APP-002': 24,
  'SCR-UIK-APP-003': 24,
  'SCR-UIK-APP-004': 26,
  'SCR-UIK-APP-005': 22,
  'SCR-UIK-APP-006': 26,
  'SCR-UIK-APP-008': 22,
  'SCR-UIK-APP-009': 24,
  'SCR-UIK-APP-010': 22,
  'SCR-UIK-APP-012': 34,
  'SCR-UIK-APP-013': 22,
};
const SEND_MS = 280;

type State = { sent: Sent[]; cur: number | null; changeAt: number; lastSend: number | null; nextFocus: number | null };

/** what has been written in the section by t, and the line being written */
function stateAt(sp: ScreenPlan, tl: SceneHost['tl'], sw: SectionWorld, t: number): State {
  const L = sw.ps.section.lines;
  const sent: Sent[] = [];
  let cur: number | null = null;
  let changeAt = sw.ps.section.startMs;
  let lastSend: number | null = null;
  let nextFocus: number | null = null;
  if (L)
    for (let li = L[0]; li <= L[1]; li++) {
      const lw = sp.lines[li]!;
      if (lw.typing.focusAt > t) {
        nextFocus = lw.typing.focusAt;
        break;
      }
      const later = li < L[1] && sp.lines[li + 1]!.typing.focusAt <= t;
      if (t >= lw.typing.sendAt || later) {
        sent.push({ text: lw.typing.text, script: lw.script, atMs: tl.scenes[li]!.startMs, repeat: lw.repeat, line: li });
        lastSend = Math.min(lw.typing.sendAt, later ? sp.lines[li + 1]!.typing.focusAt : Infinity);
        changeAt = lastSend;
        cur = null;
      } else {
        cur = li;
        changeAt = lw.typing.focusAt;
      }
    }
  return { sent, cur, changeAt, lastSend, nextFocus };
}

const specCache = new Map<string, Spec>();
function cachedSpec(key: string, make: () => Spec): Spec {
  const hit = specCache.get(key);
  if (hit) return hit;
  const s = make();
  specCache.set(key, s);
  if (specCache.size > 64) specCache.delete(specCache.keys().next().value as string);
  return s;
}

export function drawScreenlifeScene(h: SceneHost): SceneFx {
  const { W, H, tl, frame } = h;
  const t = frame.tMs;
  const cover = h.cover;
  const sp = screenPlan(tl, h.reduced, !!cover);
  const ps = plannedAt(sp.plan, t) ?? sp.plan.sections[0];
  if (!ps) {
    h.clear('#000000');
    return {};
  }
  const si = Math.max(0, sp.plan.sections.indexOf(ps));
  let sw = sp.sections[si]!;
  // QA only (never in production builds): force a kit and composition so every scene family can be checked on real frames
  const qa = process.env.NODE_ENV !== 'production' ? (globalThis as { __LS_QA_SCR?: { kit: KitId; comp: Comp } }).__LS_QA_SCR : undefined;
  if (qa) sw = { ...sw, kit: qa.kit, comp: qa.comp };
  const since = t - ps.section.startMs;
  const orient = orientationOf(W, H);
  const landscape = orient === 'landscape';
  const st = stateAt(sp, tl, sw, t);
  // a section without lines (intro, break, outro) on the lock screen: the stack holds the song's last sung lines
  if (!ps.section.lines && st.sent.length === 0)
    for (const lw of sp.lines) if (lw.typing.sendAt <= t) st.sent.push({ text: lw.typing.text, script: lw.script, atMs: tl.scenes[lw.line]!.startMs, repeat: lw.repeat, line: lw.line });
  const title = (tl.label ?? '').split('•')[0]?.trim() || 'Untitled';
  const artist = (tl.label ?? '').split('•')[1]?.trim() || 'Unknown artist';

  // a long gap inside a section: dim after 8 s, lock after 16 s, wake 800 ms before the next line
  let kit = sw.kit;
  let comp: Comp = sw.comp;
  let bright = 1;
  let indicator = false;
  if (st.cur === null && st.lastSend !== null && st.nextFocus !== null) {
    const gap = st.nextFocus - st.lastSend;
    const inGap = t - st.lastSend;
    const toNext = st.nextFocus - t;
    if (gap >= 6000 && inGap > 800 && inGap < 8000) indicator = true;
    const dimFrom = gap >= 6000 ? 8000 : gap >= 3000 ? 700 : Infinity;
    const dimK = clamp((inGap - dimFrom) / 1200) * clamp(toNext / 400);
    bright = 1 - (gap >= 6000 ? 0.45 : 0.45) * dimK;
    if (gap >= 17000 && inGap >= 16000 && toNext > 800 && kit !== 'SCR-UIK-APP-006' && kit !== 'SCR-UIK-APP-013' && kit !== 'SCR-UIK-APP-004' && kit !== 'SCR-UIK-APP-012') {
      kit = 'SCR-UIK-APP-008';
      bright = 0.3 + 0.7 * clamp((inGap - 16000) / 1000);
    }
  }
  const line = st.cur !== null ? sp.lines[st.cur]! : null;
  const script = line?.script ?? sp.lines[st.sent[st.sent.length - 1]?.line ?? 0]?.script ?? 'latin';
  const rtl = isRtl(script);
  const theme = themeFor(sw.dark, tl.palette);

  // ---- device and scale -----------------------------------------------------------------------------------------------------
  const scr = screenFor(kit, landscape && comp !== 'C1' && comp !== 'C2', W, H);
  const frameId: FrameId | null = scr.kind === 'full' ? null : scr.kind === 'phone' ? sp.phone : scr.kind === 'tablet' ? 'SCR-FRM-DEV-004' : scr.kind === 'laptop' ? (kit === 'SCR-UIK-APP-008' ? 'SCR-FRM-DEV-005' : sp.desk) : scr.kind === 'crt' ? 'SCR-FRM-DEV-007' : 'SCR-FRM-DEV-008';
  const bz = frameId ? bezelOf(frameId, scr.w, scr.h) : { side: 0, top: 0, bottom: 0, r: 0, base: 0 };
  const devW = scr.w + bz.side * 2;
  const devH = scr.h + bz.top + bz.bottom + bz.base * 0.6;
  const fit = (fw: number, fh: number) => Math.min((W * fw) / devW, (H * fh) / devH);
  const xh = X_HEIGHT[kit === 'SCR-UIK-APP-006' ? 'mono' : kit === 'SCR-UIK-APP-004' ? 'serif' : 'ui'];
  const floorPx = H * (orient === 'landscape' ? 0.022 : orient === 'portrait' ? 0.018 : orient === 'small' ? 0.026 : 0.02);
  const closer = 1;
  let s: number;
  let size: number;
  const base = BASE[kit];
  if (comp === 'C7' || scr.kind === 'full') {
    s = W / scr.w;
    const cols = landscape ? 72 : orient === 'square' ? 56 : orient === 'small' ? 30 : 38;
    size = Math.max(scr.w / cols / 0.6, floorPx / (xh * s));
  } else if (comp === 'C2') {
    // macro: the lyric's x-height 4-6% of the frame (3% in portrait, where the field wraps), never wider than 84% of the frame
    const want = (H * (landscape ? 0.05 : 0.03)) / xh;
    size = base;
    s = Math.min(want / size, (W * 0.84) / (scr.w * 0.8));
  } else {
    s = comp === 'C1' ? (landscape ? fit(0.6, 0.62) * 1.6 : fit(0.9, 0.94) * 1.04) : comp === 'C6' ? fit(0.86, 0.92) : comp === 'C3' ? fit(0.9, 0.86) : fit(0.92, 0.94);
    s *= closer;
    // a wide screen (laptop, monitor, car display) in a tall frame: the camera crops to the part that holds the field
    if (!landscape && scr.w > scr.h) s = Math.max(s, (W * 0.94) / (scr.w * (kit === 'SCR-UIK-APP-012' ? 0.56 : 0.66)));
    size = Math.min(scr.w * 0.1, Math.max(base, floorPx / (xh * s)));
  }
  size = Math.round(size * 2) / 2;

  // ---- the kit layout (cached per state) --------------------------------------------------------------------------------------
  const measure = (f: string, x: string) => h.measure(f, x);
  const wallPainter = (c: Ctx, w: number, hh: number) => paintWall(c, sw.wall, w, hh, tl.palette, cover?.canvas ?? null, sp.seed + si, theme.s1);
  const upcoming = (() => {
    const L = ps.section.lines;
    const from = (st.cur ?? (st.sent.length ? st.sent[st.sent.length - 1]!.line : (L?.[0] ?? 0) - 1)) + 1;
    return tl.scenes.slice(from, from + 3).map((x) => x.words.map((w) => w.text).join(' '));
  })();
  const envFor = (stt: State): KitEnv => ({
    kit,
    screen: { w: scr.w, h: scr.h },
    size,
    theme,
    script,
    rtl,
    title,
    artist,
    section: ps.section.role,
    nowMs: stt.cur !== null ? tl.scenes[stt.cur]!.startMs : (stt.lastSend ?? ps.section.startMs),
    durationMs: tl.durationMs,
    sent: stt.sent,
    current: stt.cur !== null ? sp.lines[stt.cur]!.typing.text : null,
    upcoming,
    cover: cover?.canvas ?? null,
    state: sw.state,
    measure,
    seed: sp.seed + si * 31,
    phosphor: sp.phosphor,
  });
  const keyOf = (stt: State) => `${tl.trackId}|${si}|${kit}|${scr.w}x${scr.h}|${size}|${sw.dark ? 1 : 0}|${stt.sent.length}|${stt.cur ?? -1}|${script}|${cover ? 1 : 0}`;
  const spec = cachedSpec(keyOf(st), () => kitSpec(envFor(st), wallPainter));

  // ---- camera ---------------------------------------------------------------------------------------------------------------
  const changeK = h.reduced ? 1 : easeOut(clamp((t - st.changeAt) / 450));
  let focus = { ...spec.focus };
  if (changeK < 1 && st.changeAt > ps.section.startMs) {
    const prevSt = stateAt(sp, tl, sw, st.changeAt - 1);
    const prev = cachedSpec(keyOf(prevSt), () => kitSpec(envFor(prevSt), wallPainter));
    focus = { x: prev.focus.x + (focus.x - prev.focus.x) * changeK, y: prev.focus.y + (focus.y - prev.focus.y) * changeK };
  }
  const dur = Math.max(1, ps.section.endMs - ps.section.startMs);
  const push = h.reduced ? 1 : 1 + (comp === 'C2' ? 0.05 : comp === 'C4' || comp === 'C7' ? 0.02 : 0.04) * easeInOut(clamp(since / dur));
  const tier = ps.section.energy > 0.25 ? 0.004 : ps.section.energy < -0.2 ? 0.0015 : 0.0025;
  const hand = h.reduced || comp === 'C4' || comp === 'C6' || comp === 'C7' ? 0 : tier * Math.min(W, H);
  const jx = hand * noise1(t * 0.0003, sp.seed % 97);
  const jy = hand * noise1(t * 0.00027, (sp.seed % 89) + 3);
  let rot = 0;
  let skew = 0;
  if (comp === 'C1') {
    rot = (landscape ? 4 + 4 * (((sp.seed >> 3) % 100) / 100) : 1.5) * ((sp.seed >> 5) % 2 ? 1 : -1);
    skew = landscape ? 0.05 : 0.015;
  } else if (comp === 'C3' && !h.reduced) skew = 0.025 * Math.sin(t * 0.00018);
  // keep the device covering the frame when it is bigger than the frame; otherwise centre it (face-on compositions)
  const zs = s * push;
  let fx = focus.x;
  let fy = focus.y;
  if (comp === 'C4' || comp === 'C6' || comp === 'C3' || comp === 'C7') {
    const halfW = W / 2 / zs;
    const halfH = H / 2 / zs;
    const left = -bz.side;
    const right = scr.w + bz.side;
    const top = -bz.top;
    const bottom = scr.h + bz.bottom + bz.base * 0.6;
    fx = right - left <= halfW * 2 ? (left + right) / 2 : clamp(fx, left + halfW, right - halfW);
    fy = bottom - top <= halfH * 2 ? (top + bottom) / 2 : clamp(fy, top + halfH, bottom - halfH);
  }
  // section entrances (motion.md transitions): whip pan, device swap, app switch; with reduced motion a 200 ms fade
  let tx = jx;
  let ty = jy;
  let enterScale = 1;
  let fade = 1;
  let mblur: [number, number] | undefined;
  const trn = ps.transition?.id;
  if (trn && si > 0) {
    if (h.reduced) fade = clamp(since / 200);
    else if (trn === 'SCR-TRN-WHIP-PAN' && since < 220) {
      const k = easeInOut(since / 220);
      tx += (1 - k) * W * 0.9;
      mblur = [0.05 * (1 - k), 0];
    } else if (trn === 'SCR-TRN-DEVICE-SWAP' && since < 900) ty += (1 - easeOut(since / 900)) * H * 0.7;
    else if (trn === 'SCR-TRN-APP-SWITCH' && since < 600) {
      const k = easeOut(since / 600);
      enterScale = 0.84 + 0.16 * k;
      tx += (1 - k) * W * 0.35;
    } else if (trn === 'SCR-TRN-LOCK-WAKE' && since < 800) bright *= 0.3 + 0.7 * easeOut(since / 800);
    else if (since < 300) fade = clamp(since / 300);
  }
  let M: Affine = translate(W / 2 + tx, H * (comp === 'C1' ? 0.47 : 0.5) + ty);
  if (rot) M = mul(M, rotate((rot * Math.PI) / 180));
  if (skew) M = mul(M, [1, skew * 0.4, 0, 1, 0, 0]);
  M = mul(M, scale(zs * enterScale, zs * enterScale));
  M = mul(M, translate(-fx, -fy));

  // ---- the room ----------------------------------------------------------------------------------------------------------------
  const roomShown = scr.kind !== 'full';
  if (roomShown) {
    const rw = Math.round(Math.min(1024, W / 2));
    const rh = Math.round((rw * H) / W);
    const room = h.tex(`scr|room|${sw.room}|${rw}x${rh}|${theme.accent}`, rw, rh, (c) => paintRoom(c, sw.room, rw, rh, sp.seed, sw.dark ? '#6d8cff' : '#fff2d8'));
    // parallax: the room moves at 30% of the device's motion, and drifts slowly
    const drift = h.reduced ? 0 : Math.sin(t * 0.0001) * W * 0.008;
    h.sprite({ tex: room.tex, m: translate(W / 2 + tx * 0.3 + drift, H / 2 + ty * 0.3), w: W * 1.06, h: H * 1.06, lod: 2.2, mode: 0, camera: false, alpha: fade });
  } else h.clear(spec.bg);

  // ---- device frame ------------------------------------------------------------------------------------------------------------
  const res = Math.max(1, Math.min(3, zs * 1.5, 4096 / Math.max(scr.w + 200, scr.h + 300)));
  const put = (tex: { tex: import('../../kinetic/gl/gpu').Tex }, x: number, y: number, w: number, hh: number, o: { lod?: number; alpha?: number; uv?: [number, number, number, number] } = {}) =>
    h.sprite({ tex: tex.tex, m: mul(M, translate(x + w / 2, y + hh / 2)), w, h: hh, mode: 0, camera: false, lod: o.lod ?? 0, alpha: (o.alpha ?? 1) * fade, uvRect: o.uv });
  if (frameId) {
    const pad = Math.max(bz.side, bz.top, bz.bottom) + (scr.kind === 'laptop' ? scr.w * 0.14 : 40);
    const fw = scr.w + pad * 2;
    const fh = scr.h + pad * 2 + bz.base;
    const fres = Math.min(res, 4096 / Math.max(fw, fh));
    const fr = h.tex(`scr|frame|${frameId}|${scr.w}x${scr.h}|${fres.toFixed(2)}`, Math.round(fw * fres), Math.round(fh * fres), (c) => {
      c.scale(fres, fres);
      paintFrame(c, frameId, scr.w, scr.h, pad, pad, sp.seed);
    });
    put(fr, -pad, -pad, fw, fh);
  }

  // ---- the screen: back, content (scrolls on send), front -------------------------------------------------------------------------
  const k = keyOf(st);
  const layer = (name: string, paint: (c: Ctx) => void) =>
    h.tex(`scr|${name}|${k}|${res.toFixed(2)}`, Math.round(scr.w * res), Math.round(scr.h * res), (c) => {
      c.scale(res, res);
      paint(c);
    });
  const uiLod = comp === 'C2' ? 2.6 : comp === 'C1' ? 0.9 : 0;
  const back = h.tex(`scr|back|${tl.trackId}|${cover ? 1 : 0}|${si}|${kit}|${scr.w}x${scr.h}|${sw.dark ? 1 : 0}|${size}|${res.toFixed(2)}`, Math.round(scr.w * res), Math.round(scr.h * res), (c) => {
    c.scale(res, res);
    spec.back(c);
  });
  const dimA = (a: number) => a * bright;
  put(back, 0, 0, scr.w, scr.h, { lod: uiLod, alpha: dimA(1) });
  const content = layer('content', (c) => spec.content(c));
  let shift = 0;
  if (!h.reduced && st.lastSend !== null && t - st.lastSend < SEND_MS && st.changeAt === st.lastSend && kit === 'SCR-UIK-APP-001') shift = (1 - easeOut((t - st.lastSend) / SEND_MS)) * size * 1.6;
  put(content, 0, 0, scr.w, scr.h, { lod: uiLod * 0.8, alpha: dimA(1), uv: shift ? [0, -shift / scr.h, 1, 1] : undefined });
  const front = layer('front', (c) => spec.front(c));
  put(front, 0, 0, scr.w, scr.h, { lod: uiLod, alpha: dimA(1) });

  // a live clock (lock screen, recorder): song elapsed time
  if (spec.clockAt) {
    const ca = spec.clockAt;
    const label = clockText(t);
    const cw = Math.round(ca.size * 3.2);
    const chh = Math.round(ca.size * 1.3);
    const ct = h.tex(`scr|clock|${label}|${ca.size}|${ca.color}|${res.toFixed(2)}`, Math.round(cw * res), Math.round(chh * res), (c) => {
      c.scale(res, res);
      textAt(c, label, cw / 2, chh / 2, font(ca.face, 300, ca.size), ca.color, false, 'center');
    });
    put(ct, ca.x - cw / 2, ca.y - chh / 2, cw, chh, { alpha: dimA(1) });
  }

  // ---- the active field: text typed so far, and the caret -------------------------------------------------------------------
  const f = spec.field;
  if (f && line) {
    const typed = fieldAt(line.typing, t);
    const fs = font(f.face, f.weight, f.size, script);
    const rows = typed ? wrap(measure, fs, typed, f.w) : [''];
    const n = Math.min(rows.length, 6);
    const shown = rows.slice(-n);
    const top = f.anchor === 'bottom' ? f.y - n * f.lh : f.y;
    if (f.card) {
      const cd = f.card;
      const drop = h.reduced ? 1 : easeOut(clamp((t - line.typing.focusAt) / 300));
      const card = h.tex(`scr|card|${cd.w}x${cd.h}|${cd.fill}|${cd.head}|${cd.glyph}|${res.toFixed(2)}`, Math.round(cd.w * res), Math.round(cd.h * res), (c) => {
        c.scale(res, res);
        fillRR(c, 0, 0, cd.w, cd.h, cd.r, cd.fill);
        if (cd.glyph === 'arrow') {
          c.fillStyle = theme.accent;
          c.beginPath();
          const ax = 46;
          const ay = cd.h / 2;
          c.moveTo(ax, ay - 26);
          c.lineTo(ax + 24, ay);
          c.lineTo(ax + 9, ay);
          c.lineTo(ax + 9, ay + 26);
          c.lineTo(ax - 9, ay + 26);
          c.lineTo(ax - 9, ay);
          c.lineTo(ax - 24, ay);
          c.closePath();
          c.fill();
        } else if (cd.head) {
          c.fillStyle = theme.accent;
          c.beginPath();
          c.arc(30, 24, 10, 0, Math.PI * 2);
          c.fill();
          textAt(c, cd.head, 48, 24, font('ui', 600, 14), cd.headColor ?? '#888');
          textAt(c, 'now', cd.w - 18, 24, font('ui', 500, 13), cd.headColor ?? '#888', false, 'end');
        }
      });
      put(card, cd.x, cd.y - (1 - drop) * 40, cd.w, cd.h, { alpha: dimA(drop) });
    }
    const pre = f.prefix ? h.measure(font(f.face, f.weight, f.size), f.prefix.text) : 0;
    const fw = f.w + pre + f.size;
    const fh = n * f.lh + f.size * 0.4;
    const empty = !typed;
    const tex = h.tex(`scr|fld|${f.face}|${f.size}|${f.w}|${f.color}|${rtl ? 1 : 0}|${f.prefix?.text ?? ''}|${typed}|${res.toFixed(2)}`, Math.round(fw * res), Math.round(fh * res), (c) => {
      c.scale(res, res);
      if (f.prefix) textAt(c, f.prefix.text, 0, f.lh * 0.5, font(f.face, f.weight, f.size), f.prefix.color);
      if (empty && f.placeholder) textAt(c, f.placeholder, rtl ? pre + f.w : pre, f.lh * (n - 0.5), font(f.face, 400, f.size, 'latin'), theme.dim, rtl);
      shown.forEach((r, i) => textAt(c, r, rtl ? pre + f.w : pre, f.lh * (i + 0.5), fs, f.color, rtl));
    });
    const fieldAlpha = f.card ? (h.reduced ? 1 : easeOut(clamp((t - line.typing.focusAt) / 300))) : 1;
    put(tex, f.x - pre, top, fw, fh, { alpha: dimA(fieldAlpha) });
    // the caret: solid while keys are pressed, blinking at 1 Hz when idle (reduced motion: a soft 0.35-1 pulse, never a flash)
    const last = shown[shown.length - 1] ?? '';
    const lw = last ? h.measure(fs, last) : 0;
    const cx = rtl ? f.x + f.w - lw - 3 : f.x + lw + 2;
    const cy = top + f.lh * (n - 0.5);
    const busy = typingNow(line.typing, t);
    let ca = busy ? 1 : Math.floor(t / 530) % 2 === 0 ? 1 : 0;
    if (h.reduced) ca = busy ? 1 : 0.35 + 0.65 * (0.5 + 0.5 * Math.cos((t / 1000) * Math.PI * 2));
    if (t > line.typing.sendAt - 60) ca = 0;
    if (ca > 0) {
      const cw = f.caret === 'block' ? f.size * 0.6 : f.caret === 'underline' ? f.size * 0.6 : Math.max(2, f.size * 0.08);
      const chh = f.caret === 'underline' ? Math.max(2, f.size * 0.1) : f.size * (f.caret === 'block' ? 1.05 : 1.1);
      const cyy = f.caret === 'underline' ? cy + f.size * 0.5 : cy;
      h.shape({ kind: 0, m: mul(M, translate(cx + cw / 2, cyy)), w: cw, h: chh, color: f.caretColor, alpha: ca * 0.95 * fade, radius: f.caret === 'bar' ? cw / 2 : 1, camera: false });
    }
  }

  // ---- overlays: typing indicator, sticker, notification ----------------------------------------------------------------------
  if (indicator && spec.indicator && kit === 'SCR-UIK-APP-001') {
    const ind = spec.indicator;
    h.shape({ kind: 0, m: mul(M, translate(ind.x, ind.y)), w: ind.r * 11, h: ind.r * 5.6, color: theme.s2, alpha: fade * bright, radius: ind.r * 2.8, camera: false });
    for (let i = 0; i < 3; i++) {
      const bob = h.reduced ? 0 : Math.max(0, Math.sin(t * 0.008 - i * 0.9)) * ind.r * 0.8;
      h.shape({ kind: 0, m: mul(M, translate(ind.x + (i - 1) * ind.r * 2.8, ind.y - bob)), w: ind.r * 1.7, h: ind.r * 1.7, color: theme.dim, alpha: fade * bright, radius: ind.r, camera: false });
    }
  }
  if (sw.sticker && ps.section.lines) {
    // on the first hook line of the chorus, once it is sent; pops with an overshoot of 1.08
    const L = ps.section.lines;
    let hookLine = -1;
    for (let li = L[0]; li <= L[1]; li++)
      if (tl.scenes[li]!.hook) {
        hookLine = li;
        break;
      }
    if (hookLine < 0) hookLine = L[0];
    const lw = sp.lines[hookLine]!;
    const from = lw.typing.sendAt;
    const nextLine = sp.lines[hookLine + 1];
    const until = Math.min(from + 3200, nextLine ? nextLine.typing.sendAt : Infinity);
    if (t >= from && t < until) {
      const age = t - from;
      const pop = h.reduced ? 1 : age < 160 ? easeOut(age / 160) * 1.08 : 1.08 - 0.08 * easeOut((age - 160) / 120);
      const fadeOut = 1 - clamp((t - (until - 250)) / 250);
      const S = 96;
      const stx = h.tex(`scr|stk|${sw.sticker}|${theme.accent}|${res.toFixed(2)}`, Math.round(S * res), Math.round(S * res), (c) => {
        c.scale(res, res);
        paintSticker(c, sw.sticker!, S, theme.accent, theme.accent2);
      });
      const at = spec.newest ?? spec.focus;
      // at the trailing edge of the newest item, never over the active field or the header
      const sx = rtl ? S * 0.62 : scr.w - S * 0.62;
      const sy = Math.max(150, at.y + S * 0.15);
      h.sprite({ tex: stx.tex, m: mul(M, mul(translate(sx, sy), mul(rotate(-0.15), scale(pop, pop)))), w: S, h: S, mode: 0, camera: false, alpha: fadeOut * fade });
    }
  }
  if (sw.notif && kit !== 'SCR-UIK-APP-006' && kit !== 'SCR-UIK-APP-013') {
    const a0 = 600;
    const a1 = 4100;
    if (since > a0 && since < a1) {
      const k2 = h.reduced ? 1 : easeOut(clamp((since - a0) / 300)) * (1 - easeOut(clamp((since - (a1 - 300)) / 300)));
      const bw = Math.min(scr.w - 24, 420);
      const bh = 68;
      const bt = h.tex(`scr|ntf|${sw.notif.id}|${sw.notif.title}|${sw.notif.body}|${sw.dark ? 1 : 0}|${res.toFixed(2)}`, Math.round(bw * res), Math.round(bh * res), (c) => {
        c.scale(res, res);
        paintBanner(c, sw.notif!, bw, bh, sw.dark, theme.accent);
      });
      put(bt, (scr.w - bw) / 2, 52 - (1 - k2) * 80, bw, bh, { alpha: k2 });
    }
  }

  // ---- glass and the frame's own over-screen details ---------------------------------------------------------------------
  if (sw.glass && frameId) {
    const g = h.tex(`scr|glass|${sw.glass}|${scr.w}x${scr.h}`, Math.round(scr.w), Math.round(scr.h), (c) => paintGlass(c, sw.glass!, scr.w, scr.h, sp.seed));
    put(g, 0, 0, scr.w, scr.h, { alpha: sw.dark ? 1 : 0.6 });
  }
  if (frameId === 'SCR-FRM-DEV-003' || frameId === 'SCR-FRM-DEV-010') {
    const ov = h.tex(`scr|over|${frameId}|${scr.w}x${scr.h}`, Math.round(scr.w), Math.round(scr.h * 1.2), (c) => paintFrameOver(c, frameId, scr.w, scr.h, 0, 0, sp.seed));
    put(ov, 0, 0, scr.w, scr.h * 1.2);
  }

  // ---- finishing: CRT scan for terminals; no bloom on light themes; the song ends with the screen going off ------------------
  const crt = kit === 'SCR-UIK-APP-006' || kit === 'SCR-UIK-APP-013';
  const endK = clamp((tl.durationMs - t) / 2000);
  const out: SceneFx = {
    grain: 0.03,
    scan: crt ? 0.35 : 0,
    curve: kit === 'SCR-UIK-APP-006' && comp === 'C7' ? 0.12 : 0,
    bloom: spec.glowOk && sw.dark ? 0.8 : 0,
    vignette: comp === 'C1' ? 0.25 : 0.12,
    exposure: Math.max(0.15, endK),
    mblur,
  };
  return guardFx(out, { reducedMotion: h.reduced });
}

function clockText(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// re-exported for tests
export { stateAt, canvasMeasure };
