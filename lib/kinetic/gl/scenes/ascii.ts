// "ASCII eye": the screen-recording reference. In a dark room a window shows a huge eye drawn entirely in characters: amber iris,
// dark pupil, grey-white lids and a skin of tiny glyphs. It opens, looks around, blinks, then the picture crumbles into flecks and
// re-forms as a banded, ringed planet (also in characters) before coming back to the eye. A code editor glows at the left edge, a
// taskbar runs under the window and a blue backlit keyboard fills the bottom. The lyric is typed on the screen below the window.
// The picture is a fragment shader (shaders.ts EYE_FS); the GPU turns it into characters with the shared ASCII pass.

import { mul, rotate, translate } from '../gpu';
import { clamp, cursorOn, drawText, drawTextC, easeInOut, hash01, lerp, lineAt, prefixPx, smooth, textTex, typedChars, wrapText } from './common';
import { EYE_FS } from './shaders';
import { pickSubject, SUBJECTS, subjectIndex, type Subject } from './subject';
import type { SceneFx, SceneHost, TexEntry } from './types';
import { hashKey, hsl, pick, seeded, songHues } from '../../variety';
import { ART_IDS, drawArt } from '../../art/library';

const LOOP = 26000;

/** character ramps, dark to bright: the glyphs the picture is made of */
export const ASCII_RAMPS = [' .:;i1tfLCG08@', ' .:-=+*#%@', ' .,:;irsXA253hMHGS#9B&@', ' ░▒▓█', ' 01', ' .oO@', ' ·•●', ' .:+x#', ' -=≡■', " `'^*%&@", ' ./|\\#', ' .:ox%#@'] as const;
/** iris colours (0..1 rgb); the last slot is filled from the cover */
const IRISES: readonly [number, number, number][] = [
  [0.86, 0.55, 0.16],
  [0.35, 0.62, 0.95],
  [0.36, 0.78, 0.36],
  [0.62, 0.42, 0.92],
  [0.92, 0.3, 0.24],
  [0.95, 0.8, 0.25],
  [0.2, 0.8, 0.75],
  [0.7, 0.72, 0.76],
  [0.95, 0.45, 0.7],
];
const DENSITY = [70, 56, 84, 100, 64] as const;

export type AsciiVariant = { ramp: string; iris: [number, number, number]; text: string; pool: string; keys: number; cells: number; linesPer: number };

/** The song's ASCII look: a character set, an iris colour, the colour the lyric is typed in, the room's glow and the keyboard's backlight. */
export function asciiVariant(trackId: string, seed: number, palette: readonly string[] | undefined): AsciiVariant {
  const r = seeded(hashKey(`${trackId}|${seed}|ascii`));
  const hues = songHues(palette, seed);
  const ramp = r() < 0.4 ? ASCII_RAMPS[0] : pick(r, ASCII_RAMPS);
  let iris = pick(r, IRISES);
  if (r() < 0.3) {
    // the cover's own colour
    const hx = hsl(pick(r, hues), 0.75, 0.55);
    const n = parseInt(hx.slice(1), 16);
    iris = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const textHue = r() < 0.5 ? 0.1 : pick(r, hues) + (r() < 0.5 ? 0 : 0.5);
  return {
    ramp,
    iris,
    text: hsl(textHue, 0.95, 0.78),
    pool: hsl(r() < 0.4 ? 0.33 : pick(r, hues), 0.6, 0.14),
    keys: r() < 0.4 ? 0.64 : pick(r, hues),
    cells: pick(r, DENSITY),
    linesPer: pick(r, [2, 3, 3, 4]),
  };
}
export const ASCII_FRAMES = ['window', 'full', 'wide'] as const;
export type AsciiFrame = (typeof ASCII_FRAMES)[number];
/** drawings put into the picture before it turns into characters: one big library drawing, a swarm of them, a kaleidoscope, or the word being sung */
export const ASCII_OVERLAYS = ['art', 'swarm', 'kaleido', 'word'] as const;
export type AsciiOverlay = { kind: (typeof ASCII_OVERLAYS)[number]; ids: string[] };
export type AsciiSection = { subject: Subject; frame: AsciiFrame; tint: string | null; tintAmt: number; param: [number, number, number, number]; overlay: AsciiOverlay | null };
/** grounds that sit well behind a drawing */
const OVERLAY_GROUNDS: Subject[] = ['dark', 'dark', 'dark', 'space', 'vortex', 'tunnel', 'warp', 'aurora', 'sunburst', 'ripples', 'checker'];
/** pictures the ASCII scene can show: 28 animated scenes x 3 variations, 346 library drawings alone or as swarms and kaleidoscopes, and the sung word */
export const ASCII_PICTURES = (SUBJECTS.length - 1) * 3 + ART_IDS.length * 3 + 1;

/**
 * What a stretch of the song shows. The song changes picture every few lines: its own picture (from a title or lyric word) opens,
 * then pictures picked from all 18, never the same twice running. The eye is one picture among many, not the default for everything.
 */
export function asciiSection(trackId: string, seed: number, palette: readonly string[] | undefined, lead: Subject, k: number): AsciiSection {
  const r = seeded(hashKey(`${trackId}|${seed}|ascii-sec|${k}`));
  const hues = songHues(palette, seed);
  const subject = asciiSubjectAt(trackId, seed, lead, k);
  const frame: AsciiFrame = k === 0 ? 'window' : r() < 0.45 ? 'window' : r() < 0.55 ? 'full' : 'wide';
  const tinted = r() < 0.4;
  // three variations of each animated picture (counts, speed, shape, colour)
  const vi = Math.floor(r() * 3);
  const vr = seeded(hashKey(`${subject}|var|${vi}`));
  const param: [number, number, number, number] = [vr(), vr(), vr(), vr()];
  // about two sections in five draw from the art library instead (never the song's own opening picture)
  const overlay: AsciiOverlay | null = k > 0 && r() < 0.42 ? { kind: pick(r, ASCII_OVERLAYS), ids: Array.from({ length: 8 }, () => pick(r, ART_IDS)) } : null;
  return {
    subject: overlay ? pick(r, OVERLAY_GROUNDS) : subject,
    frame,
    tint: tinted ? hsl(pick(r, hues) + (r() < 0.5 ? 0 : 0.5), 0.8, 0.6) : null,
    tintAmt: tinted ? 0.5 + r() * 0.35 : 0,
    param,
    overlay,
  };
}
function asciiSubjectAt(trackId: string, seed: number, lead: Subject, k: number): Subject {
  if (k === 0) {
    // a song with no picture of its own opens on the eye only some of the time
    if (lead !== 'eye') return lead;
    return seeded(hashKey(`${trackId}|${seed}|lead`))() < 0.2 ? 'eye' : pick(seeded(hashKey(`${trackId}|${seed}|lead2`)), SUBJECTS.filter((x) => x !== 'eye' && x !== 'dark'));
  }
  const prev = asciiSubjectAt(trackId, seed, lead, k - 1);
  const r = seeded(hashKey(`${trackId}|${seed}|ascii-sub|${k}`));
  // the song's own picture comes back now and then; the eye is rarer than the rest
  if (lead !== 'eye' && prev !== lead && r() < 0.25) return lead;
  const pool = SUBJECTS.filter((x) => x !== prev && x !== 'dark' && (x !== 'eye' || r() < 0.3));
  return pick(r, pool);
}
const secMemo = new Map<string, AsciiSection>();
function sectionOf(tl: SceneHost['tl'], lead: Subject, k: number): AsciiSection {
  const key = `${tl.trackId}|${tl.seed}|${lead}|${k}`;
  let v = secMemo.get(key);
  if (!v) {
    if (secMemo.size > 400) secMemo.clear();
    v = asciiSection(tl.trackId, tl.seed, tl.palette, lead, k);
    secMemo.set(key, v);
  }
  return v;
}
/** the index of the last line that has started (-1 before the first) */
function lineIndexAt(tl: SceneHost['tl'], t: number): number {
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

let memo: { key: string; v: AsciiVariant } | null = null;
function variantOf(tl: SceneHost['tl']): AsciiVariant {
  const key = `${tl.trackId}|${tl.seed}|${(tl.palette ?? []).join(',')}`;
  if (memo?.key !== key) memo = { key, v: asciiVariant(tl.trackId, tl.seed, tl.palette) };
  return memo.v;
}
const MONO = (px: number) => `600 ${px}px "JetBrains Mono Variable", ui-monospace, monospace`;

function codeStrip(h: SceneHost): TexEntry {
  return h.tex('ascii|code', 220, 900, (c) => {
    c.font = '500 11px "JetBrains Mono Variable", monospace';
    c.textBaseline = 'middle';
    const words = ['self', '.update', 'return', 'import', 'def', 'class', 'if', 'None', 'for', 'in', 'range', 'append', 'len', 'else', 'print'];
    const cols = ['#8ab4ff', '#d8e2f2', '#c792ea', '#ffcb6b', '#89ddff', '#a6e3a1'];
    for (let y = 8, i = 0; y < 892; y += 15, i++) {
      let x = 6 + (i % 4) * 9;
      const n = 3 + ((i * 7) % 5);
      for (let k = 0; k < n; k++) {
        const w = words[(i * 3 + k * 5) % words.length]!;
        c.fillStyle = cols[(i + k) % cols.length]!;
        c.globalAlpha = 0.75;
        c.fillText(w, x, y);
        x += c.measureText(w).width + 6;
      }
    }
  });
}
function taskbar(h: SceneHost): TexEntry {
  return h.tex('ascii|task', 1024, 44, (c) => {
    c.fillStyle = '#12151c';
    c.fillRect(0, 0, 1024, 44);
    c.fillStyle = '#e8ebf2';
    c.globalAlpha = 0.85;
    c.beginPath();
    c.roundRect(18, 10, 24, 24, 4);
    c.fill();
    c.globalAlpha = 1;
    c.fillStyle = '#2a2f3b';
    c.beginPath();
    c.roundRect(56, 8, 220, 28, 14);
    c.fill();
    const cols = ['#4aa3ff', '#ff6a5a', '#ffd04a', '#5adf7a', '#c27bff', '#ff8ad0', '#6ad8ff', '#ff9f43'];
    cols.forEach((col, i) => {
      c.fillStyle = col;
      c.beginPath();
      c.roundRect(310 + i * 38, 10, 24, 24, 6);
      c.fill();
    });
    c.fillStyle = '#9aa3b5';
    c.font = '500 14px Inter, sans-serif';
    c.fillText('12:41', 940, 28);
  });
}
function keyboard(h: SceneHost, hue: number): TexEntry {
  return h.tex(`ascii|keys|${hue}`, 1200, 300, (c) => {
    c.fillStyle = '#030308';
    c.fillRect(0, 0, 1200, 300);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let r = 0; r < 6; r++) {
      const y = 20 + r * 46;
      const n = 16 - (r > 3 ? 2 : 0);
      for (let k = 0; k < n; k++) {
        const x = 40 + (k + 0.5) * (1120 / n);
        const lit = 0.35 + hash01(r * 40 + k) * 0.65;
        c.globalAlpha = 0.08 + lit * 0.16;
        c.fillStyle = hsl(hue, 1, 0.6 + lit * 0.1);
        c.beginPath();
        c.roundRect(x - 26, y - 14, 52, 28, 5);
        c.fill();
        c.globalAlpha = 0.55 + lit * 0.45;
        c.fillStyle = hsl(hue, 1, 0.8);
        c.font = '700 20px "JetBrains Mono Variable", monospace';
        c.fillText('QWERTYUIOPASDFGH'[(k + r * 3) % 16]!, x, y);
      }
    }
  });
}

const subjects = new WeakMap<object, Subject>();
/** what this song's picture is (decided once per song) */
export function subjectOf(tl: SceneHost['tl']): Subject {
  let s = subjects.get(tl);
  if (!s) {
    const o = tl.emotion?.overall;
    s = pickSubject(tl.label ?? '', tl.cues.map((c) => c.text).join(' '), o ? { arousal: o.arousal, valence: o.valence } : undefined);
    subjects.set(tl, s);
  }
  return s;
}

export function drawAsciiScene(h: SceneHost): SceneFx {
  const { W, H, frame, tl } = h;
  const t = frame.tMs;
  const ct = ((t % LOOP) + LOOP) % LOOP;
  const ts = ct / 1000;
  h.clear('#010301');
  const V = variantOf(tl);
  const li = lineIndexAt(tl, t);
  const k = Math.max(0, Math.floor(li / V.linesPer));
  const sec = sectionOf(tl, subjectOf(tl), k);
  const secStart = li >= 0 ? (tl.scenes[k * V.linesPer]?.startMs ?? 0) : 0;
  const cutAge = t - secStart;

  // ---- the picture ---------------------------------------------------------------------------------------------------------------
  const layout = sec.frame;
  const S = layout === 'full' ? Math.min(W, H) : layout === 'wide' ? Math.min(W * 0.9, H * 0.58) : Math.min(W * (H > W ? 0.86 : 0.62), H * 0.62);
  const cx = W / 2;
  const cy = layout === 'full' ? H / 2 : H * (H > W ? 0.33 : 0.4);
  const halfW = layout === 'full' ? W / 2 : layout === 'wide' ? Math.min(W * 0.45, S * 0.9) : S / 2;
  const halfH = layout === 'full' ? H / 2 : S / 2;
  const rect: [number, number, number, number] = [(cx - halfW) / W, (cy - halfH) / H, (cx + halfW) / W, (cy + halfH) / H];
  // blinks, a look that jumps every second and a half, a pupil that breathes
  const blinkAt = [4.4, 7.7, 9.0, 16.2, 19.6];
  let open = 1;
  for (const b of blinkAt) {
    const d = (ts - b) / 0.3;
    if (d > 0 && d < 1) open = Math.min(open, Math.abs(d * 2 - 1) * 0.92 + 0.05);
  }
  const intro = smooth(0, 0.5, ts) ;
  open = Math.min(open, 0.3 + 0.7 * intro);
  const step = Math.floor(ts / 1.5);
  const frac = easeInOut(clamp((ts - step * 1.5) / 0.35));
  const lk = (n: number) => [(hash01(n * 3 + 1) - 0.5) * 1.5, (hash01(n * 3 + 2) - 0.5) * 1.1];
  const a0 = lk(step - 1);
  const a1 = lk(step);
  const look: [number, number] = [lerp(a0[0]!, a1[0]!, frac), lerp(a0[1]!, a1[1]!, frac)];
  const zoom = lerp(2.3, 1, easeInOut(ts / 2.4)) * (1 + frame.beat.pulse * 0.03);
  const dil = 1 + 0.25 * Math.sin(ts * 0.8) + frame.beat.pulse * 0.25 + smooth(9.5, 11.2, ts) * 0.9 - smooth(21.5, 22.5, ts) * 0.2;
  const toPlanet = smooth(11.2, 14.6, ts);
  const back = smooth(22.0, 25.2, ts);
  const morph = clamp(toPlanet - back);
  const subject = sec.subject;
  h.fullscreen('eye', EYE_FS, 1, (p) => {
    p.f('u_time', ts);
    p.f('u_open', open);
    p.v2('u_look', look[0], look[1]);
    p.f('u_dil', dil);
    p.f('u_zoom', zoom);
    p.f('u_morph', morph);
    p.v4('u_rect', rect[0], rect[1], rect[2], rect[3]);
    p.i('u_subject', subjectIndex(subject));
    p.f('u_beat', frame.beat.pulse);
    p.f('u_energy', tl.emotion?.overall.arousal ?? 0.5);
    p.v3('u_iris', V.iris[0], V.iris[1], V.iris[2]);
    const tc = sec.tint ? parseInt(sec.tint.slice(1), 16) : 0;
    p.v3('u_tint', ((tc >> 16) & 255) / 255, ((tc >> 8) & 255) / 255, (tc & 255) / 255);
    p.f('u_tintAmt', sec.tintAmt);
    p.v4('u_param', sec.param[0], sec.param[1], sec.param[2], sec.param[3]);
  });
  if (sec.overlay) drawOverlay(h, sec.overlay, cx, cy, Math.min(halfW, halfH), t, V, lineAt(tl, t));
  h.ascii({ cell: Math.max(6, Math.round(S / V.cells)), mix: 1, boost: 2.1, ramp: V.ramp });

  // ---- the room --------------------------------------------------------------------------------------------------------------------
  h.pool(W / 2, -H * 0.05, Math.max(W, H) * 0.7, V.pool, 0.35);
  const room = layout !== 'full';
  const left = cx - halfW - 10;
  if (room && left > 50) {
    const cs = codeStrip(h);
    h.sprite({ tex: cs.tex, m: [1, 0, 0, 1, left / 2, cy], w: left, h: S, mode: 0, camera: false, alpha: 0.75, lod: 0.5, fade: [0, 0.4, 0, 0] });
  }
  if (room) {
    const tb = taskbar(h);
    h.sprite({ tex: tb.tex, m: [1, 0, 0, 1, cx, cy + halfH + S * 0.035], w: halfW * 2, h: S * 0.07, mode: 0, camera: false });
    const kb = keyboard(h, V.keys);
    const kh = H * (H > W ? 0.2 : 0.26);
    h.sprite({ tex: kb.tex, m: [1, 0, 0, 1, W / 2, H - kh / 2], w: W * 1.02, h: kh, mode: 0, camera: false, alpha: 0.95, fade: [0, 0, 0.55, 0] });
  }

  // ---- the lyric, typed on the screen --------------------------------------------------------------------------------------------------
  const line = lineAt(tl, t);
  const size = Math.min(W * 0.034, H * 0.05);
  const y0 = layout === 'full' ? H * 0.8 : cy + halfH + S * 0.16;
  if (line) {
    const font = MONO(Math.round(size * 2));
    const rows = wrapText(h, line.text, font, W * 0.8 * 2);
    const n = typedChars(line.text, line.age, 80, line.dur * 0.62, 24, 70);
    let remaining = n;
    rows.forEach((r, i) => {
      const tt = textTex(h, r, MONO, size, V.text, { hi: 2, shadow: { color: `${V.text}b3`, blur: size * 0.25 } });
      const take = clamp(remaining, 0, r.length);
      remaining -= r.length + 1;
      if (take <= 0) return;
      const pre = prefixPx(h, tt, r, take);
      const x = (W - tt.textW * tt.k) / 2;
      drawText(h, tt, [1, 0, 0, 1, 0, 0], x, y0 + i * size * 1.7, { clipPx: pre });
      const lastRow = i === rows.length - 1;
      if ((take < r.length || lastRow) && (take < r.length || cursorOn(t))) h.rect(x + pre + 3, y0 + i * size * 1.7 - size * 0.55, Math.max(3, size * 0.5), size * 1.1, V.text, 0.9);
    });
  } else if (cursorOn(t)) {
    h.rect(W / 2, y0 - size * 0.55, Math.max(3, size * 0.5), size * 1.1, V.text, 0.9);
  }

  // a short glitch where the picture changes
  const cut = k > 0 && !h.reduced ? Math.max(0, 1 - cutAge / 260) : 0;
  return { scan: 0.05, curve: 0.04, vignette: 0.55, grain: 0.05, bloom: 1.3, aber: 0.4 + cut * 1.5, exposure: 1, glitch: cut * 0.9, blocks: cut * 0.6 };
}

const BRIGHT = ['#ffd84a', '#ff5d8f', '#5ce1ff', '#9dff6a', '#ff9a3c', '#c69bff', '#ffffff'];
function artTex(h: SceneHost, id: string, i: number) {
  return h.tex(`ascii|art|${id}|${i % BRIGHT.length}`, 256, 256, (c) => {
    c.translate(128, 128);
    drawArt(c, id, 104, { fill: BRIGHT[i % BRIGHT.length]!, stroke: '#ffffff', lineWidth: 9, accent: BRIGHT[(i + 3) % BRIGHT.length]! });
  });
}
/** library drawings (or the sung word) put into the window before the ASCII pass turns everything into characters */
function drawOverlay(h: SceneHost, o: AsciiOverlay, cx: number, cy: number, R: number, t: number, V: AsciiVariant, line: ReturnType<typeof lineAt>) {
  const beat = h.frame.beat.pulse;
  const put = (id: string, i: number, x: number, y: number, size: number, rot: number) => {
    const tex = artTex(h, id, i);
    h.sprite({ tex: tex.tex, m: mul(translate(x, y), rotate(rot)), w: size, h: size, mode: 0, camera: false });
  };
  if (o.kind === 'art') {
    put(o.ids[0]!, 0, cx, cy + Math.sin(t / 900) * R * 0.04, R * 1.7 * (1 + beat * 0.06), Math.sin(t / 1400) * 0.18);
  } else if (o.kind === 'swarm') {
    o.ids.forEach((id, i) => {
      const a = (i / o.ids.length) * Math.PI * 2 + t / 2600;
      const rr = R * (0.45 + 0.25 * Math.sin(t / 1700 + i));
      put(id, i, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.85, R * 0.55 * (1 + beat * 0.1), a);
    });
  } else if (o.kind === 'kaleido') {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + t / 4000;
      put(o.ids[0]!, i % 2, cx + Math.cos(a) * R * 0.5, cy + Math.sin(a) * R * 0.5, R * 0.62, a + Math.PI / 2);
    }
    put(o.ids[1]!, 2, cx, cy, R * 0.6 * (1 + beat * 0.12), -t / 3000);
  } else {
    // the word being sung, huge; between lines a drawing holds the frame
    const words = line?.words ?? [];
    let w = words[0];
    for (const x of words) if (t >= x.startMs - 30) w = x;
    if (!w) return put(o.ids[0]!, 0, cx, cy, R * 1.6, 0);
    const tt = textTex(h, w.text, MONO, R * 0.5, V.text, { hi: 1 });
    const fit = Math.min(1, (R * 1.8) / Math.max(1, tt.textW * tt.k));
    drawTextC(h, tt, [1, 0, 0, 1, 0, 0], cx, cy, { s: fit * (1 + beat * 0.08) });
  }
}
