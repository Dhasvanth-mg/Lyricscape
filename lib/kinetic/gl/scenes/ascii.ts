// "ASCII eye": the screen-recording reference. In a dark room a window shows a huge eye drawn entirely in characters: amber iris,
// dark pupil, grey-white lids and a skin of tiny glyphs. It opens, looks around, blinks, then the picture crumbles into flecks and
// re-forms as a banded, ringed planet (also in characters) before coming back to the eye. A code editor glows at the left edge, a
// taskbar runs under the window and a blue backlit keyboard fills the bottom. The lyric is typed on the screen below the window.
// The picture is a fragment shader (shaders.ts EYE_FS); the GPU turns it into characters with the shared ASCII pass.

import { clamp, cursorOn, drawText, easeInOut, hash01, lerp, lineAt, prefixPx, smooth, textTex, typedChars, wrapText } from './common';
import { EYE_FS } from './shaders';
import { pickSubject, subjectIndex, type Subject } from './subject';
import type { SceneFx, SceneHost, TexEntry } from './types';

const LOOP = 26000;
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
function keyboard(h: SceneHost): TexEntry {
  return h.tex('ascii|keys', 1200, 300, (c) => {
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
        c.fillStyle = `rgba(${60 + lit * 50}, ${80 + lit * 60}, 255, ${0.08 + lit * 0.16})`;
        c.beginPath();
        c.roundRect(x - 26, y - 14, 52, 28, 5);
        c.fill();
        c.fillStyle = `rgba(150,170,255,${0.55 + lit * 0.45})`;
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

  // ---- the picture ---------------------------------------------------------------------------------------------------------------
  const S = Math.min(W * (H > W ? 0.86 : 0.62), H * 0.62);
  const cx = W / 2;
  const cy = H * (H > W ? 0.33 : 0.4);
  const rect: [number, number, number, number] = [(cx - S / 2) / W, (cy - S / 2) / H, (cx + S / 2) / W, (cy + S / 2) / H];
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
  const subject = subjectOf(tl);
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
  });
  h.ascii({ cell: Math.max(6, Math.round(S / 70)), mix: 1, boost: 2.1 });

  // ---- the room --------------------------------------------------------------------------------------------------------------------
  h.pool(W / 2, -H * 0.05, Math.max(W, H) * 0.7, '#0f3a10', 0.35);
  const left = cx - S / 2 - 10;
  if (left > 50) {
    const cs = codeStrip(h);
    h.sprite({ tex: cs.tex, m: [1, 0, 0, 1, left / 2, cy], w: left, h: S, mode: 0, camera: false, alpha: 0.75, lod: 0.5, fade: [0, 0.4, 0, 0] });
  }
  const tb = taskbar(h);
  h.sprite({ tex: tb.tex, m: [1, 0, 0, 1, cx, cy + S / 2 + S * 0.035], w: S * 1.0, h: S * 0.07, mode: 0, camera: false });
  const kb = keyboard(h);
  const kh = H * (H > W ? 0.2 : 0.26);
  h.sprite({ tex: kb.tex, m: [1, 0, 0, 1, W / 2, H - kh / 2], w: W * 1.02, h: kh, mode: 0, camera: false, alpha: 0.95, fade: [0, 0, 0.55, 0] });

  // ---- the lyric, typed on the screen --------------------------------------------------------------------------------------------------
  const line = lineAt(tl, t);
  const size = Math.min(W * 0.034, H * 0.05);
  const y0 = cy + S / 2 + S * 0.16;
  if (line) {
    const font = MONO(Math.round(size * 2));
    const rows = wrapText(h, line.text, font, W * 0.8 * 2);
    const n = typedChars(line.text, line.age, 80, line.dur * 0.62, 24, 70);
    let remaining = n;
    rows.forEach((r, i) => {
      const tt = textTex(h, r, MONO, size, '#ffd28a', { hi: 2, shadow: { color: 'rgba(255,190,90,0.7)', blur: size * 0.25 } });
      const take = clamp(remaining, 0, r.length);
      remaining -= r.length + 1;
      if (take <= 0) return;
      const pre = prefixPx(h, tt, r, take);
      const x = (W - tt.textW * tt.k) / 2;
      drawText(h, tt, [1, 0, 0, 1, 0, 0], x, y0 + i * size * 1.7, { clipPx: pre });
      const lastRow = i === rows.length - 1;
      if ((take < r.length || lastRow) && (take < r.length || cursorOn(t))) h.rect(x + pre + 3, y0 + i * size * 1.7 - size * 0.55, Math.max(3, size * 0.5), size * 1.1, '#ffd28a', 0.9);
    });
  } else if (cursorOn(t)) {
    h.rect(W / 2, y0 - size * 0.55, Math.max(3, size * 0.5), size * 1.1, '#ffd28a', 0.9);
  }

  return { scan: 0.05, curve: 0.04, vignette: 0.55, grain: 0.05, bloom: 1.3, aber: 0.4, exposure: 1 };
}
