// Looks Lab: nine lyric looks rendered on the GPU (WebGL2), each an original take on a current, high-end genre of lyric or music graphics.
// Every look is a fragment shader drawn from song time only, except Ink, whose fluid carries over between frames (it is re-simulated after a jump).
// Sound is a small synth scheduled from the same event list the visuals read, so the spectrum, the beat signals and the audio agree.
(() => {
  'use strict';

  // ---------- maths ----------
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - x, 3));
  const easeBack = (x) => { x = clamp(x, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const TAU = Math.PI * 2;

  // ---------- the demo song (original words, 112 BPM) ----------
  const BPM = 112, BEAT = 60 / BPM, BAR = BEAT * 4;
  const TITLE = 'Static Bloom', ARTIST = 'Lyricscape demo';
  // [bar, text, singer, translation, held last word, adlib [text, beat offset, beats]]
  const RAW = [
    [2, 'City lights are humming low', 'A', 'Las luces de la ciudad zumban bajo'],
    [4, 'Every window keeps a glow', 'A', 'Cada ventana guarda un brillo'],
    [6, 'I wrote your name on the rain', 'A', 'Escribí tu nombre en la lluvia', false, ['on the rain', 6.2, 1.6]],
    [8, 'Watched it run down the glass again', 'A', 'Lo vi correr por el cristal otra vez'],
    [10, 'Turn it up, turn it up', 'AB', 'Súbelo, súbelo', true],
    [12, 'Let the static fill the room', 'AB', 'Que la estática llene el cuarto', true],
    [14, 'We were never meant to stop', 'AB', 'Nunca debimos detenernos', true],
    [16, 'Dancing on the edge of June', 'AB', 'Bailando al borde de junio', true, ['edge of June', 6.4, 1.5]],
    [22, 'Paper planes across the street', 'B', 'Aviones de papel cruzan la calle'],
    [24, 'Carry every word I keep', 'B', 'Llevan cada palabra que guardo'],
    [26, 'Hold the moment, hold it still', 'B', 'Sostén el momento, quieto', false, ['hold it', 6.2, 1.4]],
    [28, 'Count the seconds, never will', 'B', 'Contar los segundos, nunca'],
    [30, 'Turn it up, turn it up', 'AB', 'Súbelo, súbelo', true],
    [32, 'Let the static fill the room', 'AB', 'Que la estática llene el cuarto', true],
    [34, 'We were never meant to stop', 'AB', 'Nunca debimos detenernos', true],
    [36, 'Dancing on the edge of June', 'AB', 'Bailando al borde de junio', true, ['edge of June', 6.4, 1.5]],
    [38, 'Turn it up and let it bloom', 'AB', 'Súbelo y deja que florezca', true],
  ];
  const SECTIONS = [['Intro', 0, 2], ['Verse 1', 2, 10], ['Chorus', 10, 18], ['Break', 18, 22], ['Verse 2', 22, 30], ['Chorus', 30, 38], ['Outro', 38, 42]]
    .map(([name, a, b], i) => ({ name, i, start: a * BAR, end: b * BAR }));
  const DURATION = 42 * BAR;

  const LINES = RAW.map(([bar, text, singer, sub, held, ad], i) => {
    const start = bar * BAR;
    const parts = text.split(' ');
    const lastBeats = held ? 2.6 : 1.6;
    const body = 5.4;
    const weights = parts.slice(0, -1).map((p) => p.replace(/[^a-z]/gi, '').length + 2);
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    const words = parts.map((w, k) => {
      if (k === parts.length - 1) {
        const s = start + body * BEAT;
        return { text: w, s, e: s + lastBeats * BEAT, k };
      }
      const s = start + (acc / total) * body * BEAT;
      acc += weights[k];
      return { text: w, s, e: start + (acc / total) * body * BEAT - 0.02, k };
    });
    const line = { i, text, singer, sub, start, end: words[words.length - 1].e, words };
    if (ad) line.adlib = { text: ad[0], s: start + ad[1] * BEAT, e: start + (ad[1] + ad[2]) * BEAT };
    line.section = SECTIONS.findIndex((s) => start >= s.start && start < s.end);
    return line;
  });

  const Song = {
    lineAt(t) {
      for (let i = LINES.length - 1; i >= 0; i--) {
        const L = LINES[i];
        const next = LINES[i + 1];
        const until = Math.min(next ? next.start - 0.03 : Infinity, L.end + 0.9);
        if (t >= L.start - 0.03 && t <= until) return { L, age: t - L.start, p: clamp((t - L.start) / (until - L.start), 0, 1), until };
        if (t >= L.start) return null;
      }
      return null;
    },
    lastStarted(t) { let r = -1; for (const L of LINES) if (t >= L.start - 0.03) r = L.i; return r; },
    wordP: (w, t) => clamp((t - w.s) / Math.max(0.05, w.e - w.s), 0, 1),
    curWord(L, t) { let r = null; for (const w of L.words) if (t >= w.s) r = w; return r; },
    section(t) { for (const s of SECTIONS) if (t >= s.start && t < s.end) return s; return SECTIONS[SECTIONS.length - 1]; },
    beat(t) {
      const x = Math.max(0, t) / BEAT;
      const i = Math.floor(x), ph = x - i;
      return { i, ph, env: Math.exp(-ph * 5), bar: Math.floor(i / 4), down: i % 4 === 0, barEnv: i % 4 === 0 ? Math.exp(-ph * 4) : 0 };
    },
  };

  // ---------- music: one event list for both the synth and the spectrum ----------
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
  const SCALE = [69, 72, 74, 76, 79, 81];
  const EVENTS = [];
  for (let b = 0; b < 42 * 4; b++) {
    const t = b * BEAT, bar = Math.floor(b / 4), inBreak = bar >= 18 && bar < 22, outro = bar >= 40;
    const ch = CHORDS[bar % 4];
    if (!outro) {
      if (bar >= 2 && !(inBreak && b % 4 !== 0)) EVENTS.push({ t, kind: 'kick' });
      if (bar >= 2 && (b % 4 === 1 || b % 4 === 3) && !inBreak) EVENTS.push({ t, kind: 'snare' });
      if (bar >= 1) { EVENTS.push({ t, kind: 'hat' }); EVENTS.push({ t: t + BEAT / 2, kind: 'hat' }); }
      if (bar >= 2 && !inBreak) { EVENTS.push({ t, kind: 'bass', note: ch[0] - 24, dur: BEAT * 0.45 }); EVENTS.push({ t: t + BEAT / 2, kind: 'bass', note: ch[0] - 12, dur: BEAT * 0.4 }); }
    }
    if (b % 4 === 0 && bar < 41) EVENTS.push({ t, kind: 'pad', notes: ch, dur: BAR });
  }
  for (const L of LINES) for (const w of L.words) EVENTS.push({ t: w.s, kind: 'lead', note: SCALE[Math.floor(hash(L.i * 13 + w.k * 7) * SCALE.length)] - (L.singer === 'B' ? 5 : 0), dur: Math.min(0.9, w.e - w.s) });
  EVENTS.sort((a, b) => a.t - b.t);
  const byKind = (k) => EVENTS.filter((e) => e.kind === k).map((e) => e.t);
  const KICKS = byKind('kick'), SNARES = byKind('snare'), HATS = byKind('hat');
  const LEADS = EVENTS.filter((e) => e.kind === 'lead');
  const lastBefore = (arr, t) => { let lo = 0, hi = arr.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m] <= t) { r = m; lo = m + 1; } else hi = m - 1; } return r < 0 ? -1e9 : arr[r]; };

  /** A spectrum of n bands (0..1) built from what is playing at t: deterministic, matches the synth. */
  function spectrum(t, n) {
    const out = new Float32Array(n);
    const k = Math.exp(-(t - lastBefore(KICKS, t)) * 9);
    const s = Math.exp(-(t - lastBefore(SNARES, t)) * 10);
    const h = Math.exp(-(t - lastBefore(HATS, t)) * 22);
    const bar = Math.floor(t / BAR), pad = bar < 41 ? 0.28 : 0.05, bass = bar >= 2 && bar < 40 && !(bar >= 18 && bar < 22) ? 0.55 : 0.1;
    let lead = 0, leadBand = 0.4;
    for (let i = LEADS.length - 1; i >= 0; i--) { const e = LEADS[i]; if (e.t <= t) { const a = t - e.t; if (a < e.dur + 0.3) { lead = Math.exp(-a * 2.2); leadBand = 0.35 + (e.note - 60) / 60; } break; } }
    const jit = Math.floor(t * 24);
    for (let b = 0; b < n; b++) {
      const x = b / (n - 1);
      let v = 0;
      v += k * Math.exp(-Math.pow((x - 0.03) / 0.07, 2)) * 1.0;
      v += bass * Math.exp(-Math.pow((x - 0.1) / 0.08, 2)) * (0.7 + 0.3 * Math.sin(t * 9));
      v += pad * Math.exp(-Math.pow((x - 0.3) / 0.18, 2));
      v += s * Math.exp(-Math.pow((x - 0.5) / 0.22, 2)) * 0.8;
      v += h * Math.exp(-Math.pow((x - 0.85) / 0.15, 2)) * 0.55;
      v += lead * Math.exp(-Math.pow((x - leadBand) / 0.05, 2)) * 0.75;
      v *= 0.82 + 0.36 * hash(b * 7.1 + jit * 3.3);
      out[b] = clamp(v, 0, 1);
    }
    return out;
  }

  // =====================================================================================
  //  GPU renderer: every look is a WebGL2 fragment shader that renders HDR light into a
  //  float buffer, followed by one shared camera stage: bloom, halation, ACES tone map,
  //  chromatic fringe, vignette and film grain.
  //  The lyric is drawn each frame into a small "text mask" canvas whose colour channels
  //  carry meaning (red = sung, green = still to sing, blue = context lines); the shaders
  //  read it at several blur levels (mipmaps) to get soft height fields, glows and shadows.
  // =====================================================================================

  const PAL = { plum: '#2b1641', coral: '#ff6f59', teal: '#2ec4b6', sun: '#ffd23f', cream: '#fff4e6', pink: '#ff9fb2' };
  const lin = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.pow(v / 255, 2.2)); };
  const PALL = [lin(PAL.plum), lin(PAL.coral), lin(PAL.teal), lin(PAL.sun), lin(PAL.pink)];
  let REDUCED = false;

  // ---------- the cover: an original procedural "album cover" (abstract light, contour lines, petals) ----------
  const cover = document.createElement('canvas');
  cover.width = cover.height = 1024;
  (function paintCover() {
    const c = cover.getContext('2d'), S = 1024;
    const g = c.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, '#190b2b'); g.addColorStop(0.55, '#3a1747'); g.addColorStop(1, '#5a1f45');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    const blobs = [[PAL.coral, 0.72, 0.3, 0.34], [PAL.teal, 0.2, 0.72, 0.3], [PAL.sun, 0.62, 0.78, 0.2], [PAL.pink, 0.28, 0.22, 0.24], [PAL.coral, 0.9, 0.9, 0.18]];
    c.globalCompositeOperation = 'screen';
    for (const [col, x, y, r] of blobs) {
      const rg = c.createRadialGradient(x * S, y * S, 0, x * S, y * S, r * S);
      rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
      c.globalAlpha = 0.85; c.fillStyle = rg; c.fillRect(0, 0, S, S);
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    // contour lines: give the glass and water something to bend
    c.lineWidth = 2.2;
    for (let k = 0; k < 34; k++) {
      c.strokeStyle = `rgba(255,244,230,${0.08 + 0.12 * hash(k * 3.3)})`;
      c.beginPath();
      for (let a = 0; a <= 220; a++) {
        const th = (a / 220) * TAU, r = 60 + k * 15 + 18 * Math.sin(th * 3 + k * 0.4) + 10 * Math.sin(th * 7 - k * 0.3);
        const x = S * 0.52 + Math.cos(th) * r, y = S * 0.56 + Math.sin(th) * r * 0.86;
        if (a) c.lineTo(x, y); else c.moveTo(x, y);
      }
      c.stroke();
    }
    // petals
    c.globalCompositeOperation = 'screen';
    for (let i = 0; i < 9; i++) {
      c.save(); c.translate(S * 0.52, S * 0.56); c.rotate(i * TAU / 9 + 0.2);
      const pg = c.createLinearGradient(0, 0, 0, -S * 0.3);
      pg.addColorStop(0, 'rgba(255,244,230,0.0)'); pg.addColorStop(1, [PAL.coral, PAL.pink, PAL.sun][i % 3]);
      c.fillStyle = pg; c.globalAlpha = 0.55;
      c.beginPath(); c.ellipse(0, -S * 0.16, S * 0.045, S * 0.16, 0, 0, TAU); c.fill(); c.restore();
    }
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.fillStyle = PAL.cream; c.beginPath(); c.arc(S * 0.52, S * 0.56, S * 0.032, 0, TAU); c.fill();
    const img = c.getImageData(0, 0, S, S), d = img.data;
    for (let p = 0; p < d.length; p += 4) { const n = (hash(p * 0.37) - 0.5) * 18; d[p] += n; d[p + 1] += n; d[p + 2] += n; }
    c.putImageData(img, 0, 0);
  })();

  // ---------- text-mask helpers ----------
  const F = {
    tight: (w, px) => `${w} ${px}px "Inter Tight", Inter, system-ui, sans-serif`,
    serif: (px, it) => `${it ? 'italic ' : ''}400 ${px}px "Instrument Serif", Georgia, serif`,
    brico: (px) => `800 ${px}px "Bricolage Grotesque", "Inter Tight", system-ui, sans-serif`,
  };
  const CHN = { r: [255, 0, 0], g: [0, 255, 0], b: [0, 0, 255] };
  const rgba = (ch, a) => `rgba(${CHN[ch][0]},${CHN[ch][1]},${CHN[ch][2]},${clamp(a, 0, 1)})`;
  const spacing = (ctx, em) => { if ('letterSpacing' in ctx) ctx.letterSpacing = `${em}px`; };

  function wrap(ctx, words, maxW, upper) {
    const sp = ctx.measureText(' ').width, rows = [];
    let row = [], w = 0;
    for (const wd of words) {
      const txt = upper ? wd.text.toUpperCase() : wd.text;
      const ww = ctx.measureText(txt).width;
      if (row.length && w + sp + ww > maxW) { rows.push({ items: row, width: w }); row = []; w = 0; }
      const x = row.length ? w + sp : 0;
      row.push({ wd, txt, x, ww }); w = x + ww;
    }
    if (row.length) rows.push({ items: row, width: w });
    return rows;
  }
  // Fit a font size so the line takes at most maxRows rows.
  function fitRows(ctx, words, fontAt, maxW, maxPx, maxRows, upper) {
    let px = maxPx;
    for (let i = 0; i < 30; i++) {
      ctx.font = fontAt(px);
      const rows = wrap(ctx, words, maxW, upper);
      if (rows.length <= maxRows && rows.every((r) => r.width <= maxW)) return { px, rows };
      px *= 0.92;
    }
    ctx.font = fontAt(px);
    return { px, rows: wrap(ctx, words, maxW, upper) };
  }
  // Paint one word into the mask: sung part red, the rest green, with a soft wipe edge.
  function paintWord(ctx, it, x, y, p, a, soft) {
    if (p >= 1) { ctx.fillStyle = rgba('r', a); ctx.fillText(it.txt, x, y); return; }
    if (p <= 0) { ctx.fillStyle = rgba('g', a); ctx.fillText(it.txt, x, y); return; }
    const e = soft * it.ww, gx = x - e + p * (it.ww + 2 * e);
    const gr = ctx.createLinearGradient(gx - e, 0, gx + e, 0);
    gr.addColorStop(0, rgba('r', a)); gr.addColorStop(1, rgba('g', a));
    ctx.fillStyle = gr; ctx.fillText(it.txt, x, y);
  }
  /** Draws a line block centred on (cx, cy). align: 'center' | 'left' | 'right'. */
  function block(ctx, rows, px, cx, cy, maxW, o) {
    const lh = px * (o.lh || 1.08), h = rows.length * lh;
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    rows.forEach((row, ri) => {
      const x0 = o.align === 'left' ? cx - maxW / 2 : o.align === 'right' ? cx + maxW / 2 - row.width : cx - row.width / 2;
      const y = cy - h / 2 + lh * (ri + 0.5);
      for (const it of row.items) {
        const w = it.wd, t = o.t;
        if (o.ch) { ctx.fillStyle = rgba(o.ch, o.a); ctx.fillText(it.txt, x0 + it.x, y); continue; }
        const p = o.mode === 'word' ? smooth(w.s - 0.04, w.s + 0.16, t) : Song.wordP(w, t);
        const live = t >= w.s && t < w.e + 0.25 ? Math.sin(Math.PI * clamp((t - w.s) / Math.max(0.2, w.e - w.s + 0.25), 0, 1)) : 0;
        ctx.save();
        if (o.lift && live > 0) {
          const s = 1 + o.lift * live;
          ctx.translate(x0 + it.x + it.ww / 2, y - px * o.lift * 0.6 * live); ctx.scale(s, s); ctx.translate(-(x0 + it.x + it.ww / 2), -y);
        }
        if (o.word) o.word(ctx, it, x0 + it.x, y, p, live);
        else paintWord(ctx, it, x0 + it.x, y, p, o.a == null ? 1 : o.a, o.soft == null ? 0.12 : o.soft);
        ctx.restore();
      }
    });
    return h;
  }
  const lineFade = (hit, t) => (hit ? smooth(hit.L.start - 0.3, hit.L.start + 0.08, t) * (1 - smooth(hit.until - 0.4, hit.until, t)) : 0);
  const BRK = SECTIONS.find((x) => x.name === 'Break');
  const titleFade = (t) => Math.max(1 - smooth(LINES[0].start - 1.2, LINES[0].start - 0.3, t), smooth(BRK.start + 0.5, BRK.start + 1.5, t) * (1 - smooth(BRK.end - 1.4, BRK.end - 0.5, t)), smooth(LINES[LINES.length - 1].end + 1.0, LINES[LINES.length - 1].end + 2.4, t));
  const outroFade = (t) => smooth(LINES[LINES.length - 1].end + 0.8, LINES[LINES.length - 1].end + 2.2, t);

  // ---------- section energy and palette signals ----------
  const SEC_E = { Intro: 0.18, 'Verse 1': 0.5, Chorus: 1, Break: 0.28, 'Verse 2': 0.55, Outro: 0.2 };
  function energy(t) {
    const s = Song.section(t), prev = SECTIONS[s.i - 1];
    const e = SEC_E[s.name], pe = prev ? SEC_E[prev.name] : e;
    return lerp(pe, e, smooth(s.start - BEAT, s.start + BEAT * 2, t));
  }
  const envAt = (arr, t, k) => Math.exp(-Math.max(0, t - lastBefore(arr, t)) * k);

  // =====================================================================================
  //  WebGL2 plumbing
  // =====================================================================================
  const $ = (s) => document.querySelector(s);
  const stage = $('#stage');
  const gl = stage.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  if (!gl) { const p = $('#nogl'); if (p) p.hidden = false; return; }
  const HAS_FLOAT = !!gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('OES_texture_float_linear');
  const PT_MAX = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1] || 64;

  const VS = `#version 300 es
  out vec2 vUv;
  void main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); vUv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

  const PRE = `#version 300 es
  precision highp float;
  precision highp sampler2D;
  in vec2 vUv; out vec4 o;
  uniform vec2 uRes; uniform float uT, uDt, uBeat, uKick, uSnare, uHat, uBarEnv, uEnergy, uLod, uAspect, uInv, uLead;
  uniform sampler2D uText, uCover, uPrev, uSpec;
  uniform vec3 uP0, uP1, uP2, uP3, uP4;
  #define PI 3.14159265
  float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  vec2 h22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
  float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3. - 2. * f);
    return mix(mix(h12(i), h12(i + vec2(1, 0)), u.x), mix(h12(i + vec2(0, 1)), h12(i + vec2(1, 1)), u.x), u.y); }
  float fbm(vec2 p){ float a = .5, s = 0.; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 5; i++){ s += a * vn(p); p = m * p; a *= .5; } return s; }
  float fbm3(vec2 p){ float a = .5, s = 0.; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 3; i++){ s += a * vn(p); p = m * p; a *= .5; } return s; }
  vec2 curl(vec2 p){ float e = .02; return vec2(fbm3(p + vec2(0, e)) - fbm3(p - vec2(0, e)), -(fbm3(p + vec2(e, 0)) - fbm3(p - vec2(e, 0)))) / (2. * e); }
  vec4 TX(vec2 uv, float lod){ return textureLod(uText, uv, max(0., lod + uLod)); }
  float SP(float x){ return texture(uSpec, vec2(x, .5)).r; }
  vec3 COV(vec2 uv, float lod){ return pow(textureLod(uCover, uv, lod).rgb, vec3(2.2)); }
  vec2 asp(vec2 uv){ return (uv - .5) * vec2(uAspect, 1.); }
  mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
  `;

  function compile(type, src, name) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); console.error(name, log); throw new Error(`${name}: ${log}`); }
    return s;
  }
  function program(fs, name, vs = VS) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs, name + ' vs'));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs, name));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`${name}: ${gl.getProgramInfoLog(p)}`);
    const locs = {};
    return { p, loc: (n) => (n in locs ? locs[n] : (locs[n] = gl.getUniformLocation(p, n))) };
  }
  function setU(pr, U) {
    for (const k in U) {
      const l = pr.loc(k); if (l == null) continue;
      const v = U[k];
      if (typeof v === 'number') gl.uniform1f(l, v);
      else if (v.length === 2) gl.uniform2f(l, v[0], v[1]);
      else if (v.length === 3) gl.uniform3f(l, v[0], v[1], v[2]);
      else gl.uniform4f(l, v[0], v[1], v[2], v[3]);
    }
  }
  function bindTex(pr, name, unit, tex) { const l = pr.loc(name); if (l == null) return; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(l, unit); }
  function makeTex(w, h, opt = {}) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    const f = opt.float && HAS_FLOAT;
    gl.texImage2D(gl.TEXTURE_2D, 0, f ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, f ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function makeFB(w, h) {
    const tex = makeTex(w, h, { float: true }), fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  }
  function freeFB(f) { if (f) { gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.tex); } }
  const vao = gl.createVertexArray();
  function quad(target) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.viewport(0, 0, target ? target.w : gl.drawingBufferWidth, target ? target.h : gl.drawingBufferHeight);
    gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // shared textures
  const texCover = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texCover);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, cover);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
  const texText = gl.createTexture();
  const texSpec = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texSpec);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 64, 1, 0, gl.RED, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  const specBytes = new Uint8Array(64);

  const tc = document.createElement('canvas');
  const tctx = tc.getContext('2d');

  // =====================================================================================
  //  Post: bloom chain + camera finish
  // =====================================================================================
  const P_DOWN = program(`#version 300 es
  precision highp float; in vec2 vUv; out vec4 o;
  uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uThresh, uFirst;
  void main(){
    vec2 d = uTexel;
    vec3 c = texture(uSrc, vUv + d * vec2(-1, -1)).rgb + texture(uSrc, vUv + d * vec2(1, -1)).rgb + texture(uSrc, vUv + d * vec2(-1, 1)).rgb + texture(uSrc, vUv + d * vec2(1, 1)).rgb;
    c *= .25;
    if (uFirst > .5) { c = min(c, vec3(40.)); float l = max(c.r, max(c.g, c.b)); float k = max(l - uThresh, 0.); k = k * k / (k + .5); c *= k / max(l, 1e-4); }
    o = vec4(c, 1);
  }`, 'down');
  const P_UP = program(`#version 300 es
  precision highp float; in vec2 vUv; out vec4 o;
  uniform sampler2D uSrc; uniform vec2 uTexel;
  void main(){
    vec2 d = uTexel;
    vec3 c = texture(uSrc, vUv).rgb * 4.;
    c += (texture(uSrc, vUv + vec2(d.x, 0)).rgb + texture(uSrc, vUv - vec2(d.x, 0)).rgb + texture(uSrc, vUv + vec2(0, d.y)).rgb + texture(uSrc, vUv - vec2(0, d.y)).rgb) * 2.;
    c += texture(uSrc, vUv + d).rgb + texture(uSrc, vUv - d).rgb + texture(uSrc, vUv + vec2(d.x, -d.y)).rgb + texture(uSrc, vUv + vec2(-d.x, d.y)).rgb;
    o = vec4(c / 16., 1);
  }`, 'up');
  const P_FINAL = program(`#version 300 es
  precision highp float; in vec2 vUv; out vec4 o;
  uniform sampler2D uScene, uBloom; uniform vec2 uRes; uniform float uBloomK, uHal, uGrain, uCA, uVig, uExp, uFrame, uLift;
  float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
  void main(){
    vec2 c = vUv - .5; float r2 = dot(c, c);
    vec2 off = c * r2 * uCA;
    vec3 col = vec3(texture(uScene, vUv - off).r, texture(uScene, vUv).g, texture(uScene, vUv + off).b);
    vec3 b = texture(uBloom, vUv).rgb;
    col += b * uBloomK;
    col += b * vec3(1., .32, .12) * uHal;
    col *= uExp;
    col *= mix(1., smoothstep(.95, .15, r2 * 2.2), uVig);
    col = aces(col);
    col = pow(col, vec3(1. / 2.2));
    col = col * (1. - uLift) + uLift;
    float g = h12(gl_FragCoord.xy + uFrame * vec2(37.1, 17.7)) + h12(gl_FragCoord.xy * 1.3 + uFrame * vec2(11.3, 53.1)) - 1.;
    col += g * uGrain * (1. - col * .5);
    o = vec4(col, 1);
  }`, 'final');

  let FB = null;
  function buildTargets(w, h) {
    if (FB) { freeFB(FB.scene); FB.bloom.forEach(freeFB); freeFB(FB.simA); freeFB(FB.simB); }
    const bloom = []; let bw = w, bh = h;
    for (let i = 0; i < 6; i++) { bw = Math.max(1, Math.ceil(bw / 2)); bh = Math.max(1, Math.ceil(bh / 2)); bloom.push(makeFB(bw, bh)); }
    const sw = Math.ceil(w / 2), sh = Math.ceil(h / 2);
    FB = { scene: makeFB(w, h), bloom, simA: makeFB(sw, sh), simB: makeFB(sw, sh), w, h };
    simFresh = true;
  }
  let simFresh = true;
  function clearSim() { for (const f of [FB.simA, FB.simB]) { gl.bindFramebuffer(gl.FRAMEBUFFER, f.fb); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); } simFresh = false; }

  // =====================================================================================
  //  The looks
  // =====================================================================================
  const LOOKS = [];
  const look = (o) => { o.prog = program(PRE + o.frag, o.id); if (o.sim) o.simProg = program(PRE + o.sim, o.id + ' sim'); LOOKS.push(o); };
  const POST = (o) => Object.assign({ thresh: 1.0, bloom: 0.6, hal: 0.0, grain: 0.035, ca: 0.0, vig: 0.6, exp: 1.0, lift: 0.0 }, o);

  // Wide stage or tall stage measures, in text-canvas pixels.
  const M = (W, H) => ({ tall: H > W, S: Math.min(W, H), cx: W / 2, cy: H / 2 });

  // ---------------------------------------------------------------- 1. Aura
  look({
    id: 'aura', name: 'Aura', family: 'Atmosphere',
    from: 'Streaming apps’ synced lyric view (big type over colours pulled from the cover), taken to film-grade light.',
    what: 'A slow, living gradient grown from the cover’s colours flows behind a big left-aligned lyric column. Each word ignites as it is sung and throws real light; past and next lines sit back in soft focus. Duet lines from the second voice move to the right.',
    post: POST({ thresh: 0.9, bloom: 0.7, grain: 0.04, ca: 0.35, vig: 0.55 }),
    text(ctx, W, H, t) {
      const m = M(W, H), maxW = W * (m.tall ? 0.86 : 0.74), px0 = m.tall ? W * 0.1 : H * 0.104;
      const font = (px) => F.tight(800, px);
      const f = Song.lastStarted(t);
      if (t < LINES[0].start - 0.3) {
        const a = titleFade(t);
        ctx.font = F.tight(800, px0 * 1.25); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        ctx.fillStyle = rgba('r', a); ctx.fillText(TITLE, (W - maxW) / 2, m.cy - px0 * 0.4);
        ctx.font = F.tight(600, px0 * 0.42); ctx.fillStyle = rgba('b', a * 0.9); ctx.fillText(ARTIST.toUpperCase(), (W - maxW) / 2, m.cy + px0 * 0.6);
      }
      const lay = (i) => { const L = LINES[i]; ctx.font = font(px0); return { L, rows: wrap(ctx, L.words, maxW), h: 0 }; };
      const lines = {};
      for (let i = Math.max(0, f - 3); i <= Math.min(LINES.length - 1, f + 3); i++) { lines[i] = lay(i); lines[i].h = lines[i].rows.length * px0 * 1.08; }
      const gap = px0 * 0.62;
      const stack = (focus) => {
        const ys = {}; const cy = m.cy;
        if (lines[focus]) ys[focus] = cy;
        for (let i = focus + 1; lines[i]; i++) ys[i] = (ys[i - 1] ?? cy) + ((lines[i - 1] ? lines[i - 1].h : 0) + lines[i].h) / 2 + gap;
        for (let i = focus - 1; lines[i]; i--) ys[i] = (ys[i + 1] ?? cy) - ((lines[i + 1] ? lines[i + 1].h : 0) + lines[i].h) / 2 - gap;
        if (focus < 0) { let y = cy + px0 * 2.2; for (let i = 0; lines[i]; i++) { ys[i] = y + lines[i].h / 2; y += lines[i].h + gap; } }
        return ys;
      };
      const sc = f >= 0 ? ease((t - LINES[f].start + 0.3) / 0.65) : 1;
      const A = stack(f - 1 >= 0 ? f - 1 : (f === 0 ? -1 : f)), B = stack(f);
      for (const k in lines) {
        const i = +k, ln = lines[i];
        const ya = A[i] ?? B[i], yb = B[i];
        const y = lerp(ya, yb, sc);
        const dist = Math.abs(y - m.cy) / (H * 0.5);
        const singer = ln.L.singer === 'B';
        ctx.font = font(px0);
        const o = { t, lh: 1.08, align: singer ? 'right' : 'left', lift: 0.035, soft: 0.18 };
        if (i !== f) { o.ch = 'b'; o.a = clamp(0.9 - dist * 1.1, 0, 0.9) * (i < f ? 0.75 : 1); }
        block(ctx, ln.rows, px0, W / 2, y, maxW, o);
        if (i === f && ln.L.adlib && t > ln.L.adlib.s - 0.2 && t < ln.L.adlib.e + 0.6) {
          const ad = ln.L.adlib, a = smooth(ad.s - 0.2, ad.s, t) * (1 - smooth(ad.e + 0.2, ad.e + 0.6, t));
          ctx.font = F.tight(700, px0 * 0.5);
          ctx.fillStyle = rgba(t >= ad.s ? 'r' : 'g', a * 0.85); ctx.textAlign = singer ? 'right' : 'left';
          ctx.fillText(`(${ad.text})`, singer ? W / 2 + maxW / 2 : W / 2 - maxW / 2, y + ln.h / 2 + px0 * 0.45);
        }
      }
      if (t > LINES[LINES.length - 1].end + 0.8) {
        const a = outroFade(t); ctx.globalAlpha = 1;
        ctx.font = F.tight(600, px0 * 0.42); ctx.textAlign = 'left'; ctx.fillStyle = rgba('b', a); ctx.fillText(`${TITLE.toUpperCase()} · ${ARTIST.toUpperCase()}`, (W - maxW) / 2, H * 0.86);
      }
    },
    frag: `
    void main(){
      vec2 p = asp(vUv);
      float t = uT * .045;
      vec2 q = vec2(fbm(p * 1.2 + vec2(0., t)), fbm(p * 1.2 + vec2(5.2, 1.3 - t)));
      vec2 r = vec2(fbm(p * 1.05 + 2.2 * q + vec2(1.7, 9.2) + t * .8), fbm(p * 1.05 + 2.2 * q + vec2(8.3, 2.8) - t * .6));
      float f = fbm(p * 1.1 + 2.4 * r);
      vec3 col = mix(uP0 * .9, uP1 * .9, smoothstep(.3, .78, f));
      col = mix(col, uP2 * .85, smoothstep(.5, .92, r.x) * .8);
      col = mix(col, uP4, smoothstep(.55, .95, q.y) * .45);
      col = mix(col, uP3, smoothstep(.62, 1., r.y * f * 1.7) * .5);
        col *= .12 + .17 * uEnergy + .1 * uKick * uEnergy;
      col = mix(col, col * vec3(.6, .7, 1.2), .4);
      // a lens bloom that rides the bass
      col += mix(uP1, uP3, .4) * .35 * (SP(.06) + .4 * SP(.12)) * smoothstep(.9, 0., length(p - vec2(.35 * uAspect, -.38)));
      vec4 tx = TX(vUv, 0.), tb = TX(vUv, 4.5), tm = TX(vUv, 2.8);
      col *= 1. - .55 * clamp((tb.r + tb.g) * 1.8 + tb.b * .6, 0., 1.);
      vec4 tc = TX(vUv, 1.7);
      col = mix(col, vec3(.85, .82, .9), clamp(tc.b, 0., 1.) * .42);
      col = mix(col, vec3(.95), tx.g * .34);
      col = mix(col, vec3(2.4, 2.3, 2.2), tx.r);
      col += mix(uP3, uP1, .35) * tm.r * .55 + uP1 * tb.r * .4;
      o = vec4(col, 1);
    }`,
  });

  // ---------------------------------------------------------------- 2. Liquid Glass
  look({
    id: 'glass', name: 'Liquid Glass', family: 'Light and glass',
    from: 'The refractive glass materials of current phone and desktop interfaces, used as a lyric material.',
    what: 'The line is cast in thick, rounded glass laid over the moving cover art. It bends what is behind it, splits light into a thin rainbow at the edges and catches a highlight from the top left. Letters run together like liquid as they arrive, and each word fills with warm light as it is sung.',
    post: POST({ thresh: 1.1, bloom: 0.55, grain: 0.03, ca: 0.25, vig: 0.5 }),
    text(ctx, W, H, t) {
      const m = M(W, H), hit = Song.lineAt(t), a = lineFade(hit, t);
      if (!hit) {
        if (titleFade(t) > 0) { ctx.font = F.tight(900, m.S * 0.2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = rgba('g', titleFade(t)); ctx.fillText('static', m.cx, m.cy - m.S * 0.1); ctx.fillText('bloom', m.cx, m.cy + m.S * 0.1); }
        return;
      }
      const maxW = W * 0.86, { px, rows } = fitRows(ctx, hit.L.words, (s) => F.tight(900, s), maxW, m.tall ? W * 0.2 : H * 0.24, m.tall ? 4 : 2);
      spacing(ctx, -px * 0.02);
      block(ctx, rows, px, m.cx, m.cy, maxW, { t, a, lh: 1.0, soft: 0.2, lift: 0.05 });
      spacing(ctx, 0);
    },
    frag: `
    float H(vec2 uv){ vec4 a = TX(uv, 1.2), b = TX(uv, 2.6), c = TX(uv, 4.);
      return (a.r + a.g) * .5 + (b.r + b.g) * .32 + (c.r + c.g) * .18; }
    vec3 bg(vec2 uv, float lod){
      vec2 p = asp(uv);
      float z = max(uAspect, 1.) * (1.08 + .04 * sin(uT * .07));
      vec2 cu = p / z * rot(uT * .012) + .5 + vec2(sin(uT * .05), cos(uT * .04)) * .03;
      vec3 c = COV(cu, lod);
      c += uP1 * .12 * uKick * uEnergy;
      return c * (.6 + .3 * uEnergy);
    }
    void main(){
      float h = H(vUv);
      float d = .0022;
      float hx = H(vUv + vec2(d / uAspect, 0)) - H(vUv - vec2(d / uAspect, 0));
      float hy = H(vUv + vec2(0, d)) - H(vUv - vec2(0, d));
      vec3 n = normalize(vec3(-hx, -hy, d * 7.));
      vec4 tm0 = TX(vUv, .3);
      float mask = smoothstep(.22, .5, (tm0.r + tm0.g) * .55 + h * .45);
      vec4 tl = TX(vUv, 1.6);
      float sung = clamp(tl.r / max(tl.r + tl.g, 1e-3), 0., 1.);
      // shadow cast by the glass onto the art
      vec4 sh = TX(vUv + vec2(-.006, .016), 4.2);
      vec3 col = bg(vUv, 3.6) * .8 * (1. - .45 * clamp((sh.r + sh.g) * 1.6, 0., 1.));
      // refraction with dispersion
      vec2 off = n.xy * (.07 + .06 * h);
      vec3 rf = vec3(bg(vUv - off * 1.0, .4).r, bg(vUv - off * 1.08, .4).g, bg(vUv - off * 1.16, .4).b);
      rf = rf * 1.06 + .012;
      rf *= mix(.92, 1.08, sung);
      float edge = 1. - n.z;
      vec3 L = normalize(vec3(-.55, .7, .55));
      float spec = pow(max(dot(reflect(-L, n), vec3(0, 0, 1)), 0.), 48.);
      float spec2 = pow(max(dot(reflect(-normalize(vec3(.6, -.5, .5)), n), vec3(0, 0, 1)), 0.), 22.) * .35;
      float rim = smoothstep(.25, .9, edge);
      vec3 glass = rf + vec3(1.) * (spec * 4. + spec2) + rim * vec3(.9, .95, 1.) * 1.1 - (1. - rim) * .03;
      glass += .9 * sung * mix(uP3, uP1, .4) * smoothstep(.75, 1.25, h) * (.5 + .6 * uKick);
      col = mix(col, glass, mask);
      o = vec4(col, 1);
    }`,
  });

  // ---------------------------------------------------------------- 3. Chrome
  look({
    id: 'chrome', name: 'Chrome', family: 'Light and glass',
    from: 'The liquid-chrome title type that is back in current pop videos, covers and tour screens.',
    what: 'Each word is poured as polished, inflated metal that reflects a studio of soft boxes and two coloured gels that swing with the song. A thin-film sheen runs across the surface, and every kick sends a ripple through the metal. Words still to come wait as dark gunmetal.',
    post: POST({ thresh: 1.2, bloom: 0.8, grain: 0.035, ca: 0.3, vig: 0.7 }),
    text(ctx, W, H, t) {
      const m = M(W, H), hit = Song.lineAt(t), a = lineFade(hit, t);
      const words = hit ? hit.L.words : (titleFade(t) > 0 ? [{ text: 'static', s: -9, e: -8 }, { text: 'bloom', s: -9, e: -8 }] : null);
      if (!words) return;
      const maxW = W * 0.84, { px, rows } = fitRows(ctx, words, F.brico, maxW, m.tall ? W * 0.22 : H * 0.26, m.tall ? 4 : 2);
      spacing(ctx, -px * 0.03);
      block(ctx, rows, px, m.cx, m.cy, maxW, { t, a: hit ? a : titleFade(t), lh: 0.98, mode: 'word', lift: 0.03 });
      spacing(ctx, 0);
    },
    frag: `
    float Hc(vec2 uv){ vec4 a = TX(uv, .6), b = TX(uv, 2.), c = TX(uv, 3.4);
      return (a.r + a.g) * .42 + (b.r + b.g) * .36 + (c.r + c.g) * .22; }
    vec3 env(vec3 r){
      float y = r.y, az = atan(r.x, r.z);
      vec3 c = mix(vec3(.015, .012, .02), vec3(.55, .55, .6), smoothstep(-.35, .12, y));
      c = mix(c, vec3(.02, .02, .03), smoothstep(.18, .75, y));
      c += vec3(3.) * exp(-pow((y - .06) * 16., 2.));
      c += vec3(2.4) * smoothstep(.06, .0, abs(y - .45 - .05 * sin(az * 2.))) * smoothstep(.9, .2, abs(az));
      c += uP1 * 4. * smoothstep(.32, .0, abs(az - 1.1 - .35 * sin(uT * .31))) * smoothstep(-.4, .3, y);
      c += uP2 * 3.6 * smoothstep(.32, .0, abs(az + 1.2 + .35 * cos(uT * .27))) * smoothstep(-.4, .3, y);
      c += uP3 * 1.2 * smoothstep(.5, .0, abs(az - 2.6)) * smoothstep(.2, -.5, y);
      return c;
    }
    float ripple(vec2 p){
      float r = 0.;
      r += sin(length(p - vec2(-.4, .2)) * 46. - uT * 9.) * uKick;
      r += sin(dot(p, vec2(.8, .6)) * 30. + uT * 3.) * .25;
      return r;
    }
    void main(){
      vec2 p = asp(vUv);
      float m0 = TX(vUv, 0.).r + TX(vUv, 0.).g;
      float mask = smoothstep(.25, .6, m0);
      float h = pow(clamp(Hc(vUv) * 1.25, 0., 1.), .7);
      float d = .0018;
      float hx = Hc(vUv + vec2(d / uAspect, 0)) - Hc(vUv - vec2(d / uAspect, 0));
      float hy = Hc(vUv + vec2(0, d)) - Hc(vUv - vec2(0, d));
      vec2 rp = vec2(ripple(p + vec2(d, 0)) - ripple(p - vec2(d, 0)), ripple(p + vec2(0, d)) - ripple(p - vec2(0, d))) * .0035;
      vec3 n = normalize(vec3(-hx - rp.x * h, -hy - rp.y * h, d * 9.));
      n.xy += p * .5 * vec2(1. / uAspect, 1.);
      n = normalize(n);
      vec3 r = reflect(vec3(0, 0, -1), n);
      r = vec3(r.x, r.y, -r.z);
      vec3 c = env(r);
      float fres = pow(1. - max(n.z, 0.), 3.);
      vec3 iri = .5 + .5 * cos(6.2831 * (vec3(0., .33, .67) + fres * 1.6 + h * .9 + uT * .05));
      c *= mix(vec3(1.), iri * 1.5, .32);
      c *= .75 + .4 * fres;
      vec4 tl = TX(vUv, .8);
      float sung = clamp(tl.r / max(tl.r + tl.g, 1e-3), 0., 1.);
      c *= mix(.16, 1. + .5 * uKick, sung);
      // backdrop: dark studio with a floor glow and haze
      vec3 bgc = mix(vec3(.004, .003, .008), uP0 * .25, smoothstep(.0, 1., vUv.y));
      bgc += mix(uP1, uP2, smoothstep(-.6, .6, p.x)) * .12 * smoothstep(.8, -.1, abs(p.y + .45)) * (.4 + .8 * uEnergy);
      bgc += uP3 * .05 * fbm(p * 3. + uT * .05);
      bgc *= .55;
      bgc *= 1. - .6 * clamp((TX(vUv + vec2(0, .02), 4.).r + TX(vUv + vec2(0, .02), 4.).g) * 1.5, 0., 1.);
      o = vec4(mix(bgc, c, mask), 1);
    }`,
  });

  // ---------------------------------------------------------------- 4. Cathedral
  look({
    id: 'cathedral', name: 'Cathedral', family: 'Light and glass',
    from: 'Arena tour screens and stage lighting design, where haze and light beams carry the show.',
    what: 'A light burns behind the lyric and the letters are its only windows. Real volumetric rays stream out of each word the moment it is sung, through drifting haze lit with dust, and the beams swell with the chorus and the kick.',
    post: POST({ thresh: 1.0, bloom: 0.8, hal: 0.15, grain: 0.045, ca: 0.2, vig: 0.75 }),
    text(ctx, W, H, t) {
      const m = M(W, H), hit = Song.lineAt(t), a = lineFade(hit, t);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (!hit) {
        if (titleFade(t) > 0) { ctx.font = F.tight(800, m.S * 0.11); spacing(ctx, m.S * 0.02); ctx.fillStyle = rgba('r', titleFade(t)); ctx.fillText('STATIC BLOOM', m.cx, m.cy); spacing(ctx, 0); }
        return;
      }
      const maxW = W * 0.86;
      spacing(ctx, (m.tall ? W : H) * 0.012);
      const { px, rows } = fitRows(ctx, hit.L.words, (s) => F.tight(800, s), maxW, m.tall ? W * 0.13 : H * 0.13, m.tall ? 4 : 2, true);
      block(ctx, rows, px, m.cx, m.cy, maxW, { t, a, lh: 1.12, mode: 'word' });
      spacing(ctx, 0);
    },
    frag: `
    float E(vec2 uv){ vec4 a = TX(uv, 2.2); return a.r + a.g * .07; }
    void main(){
      vec2 p = asp(vUv);
      vec2 lp = vec2(.5 + .06 * sin(uT * .21), .5 + .05 * cos(uT * .17));
      const int N = 72;
      vec2 dl = (vUv - lp);
      vec2 st = dl / float(N) * .92;
      vec2 uv = vUv - st * h12(gl_FragCoord.xy + fract(uT) * 91.);
      float acc = 0., w = 1.;
      for (int i = 0; i < N; i++){ uv -= st; acc += E(uv) * w; w *= .97; }
      acc /= float(N) * .32;
      float haze = .55 + .9 * fbm(p * 2.4 + vec2(uT * .05, -uT * .08));
      float drive = .55 + .7 * uEnergy + .6 * uKick * uEnergy;
      vec3 beam = mix(uP3, uP1, .35) * acc * haze * drive * 1.4;
      // dust motes lit by the beams
      vec2 g = vUv * vec2(uAspect, 1.) * 90. + vec2(uT * 1.5, uT * 4.);
      vec2 id = floor(g); vec2 fp = fract(g) - .5 - (h22(id) - .5) * .6;
      float mote = smoothstep(.12, .0, length(fp)) * step(.93, h12(id));
      beam += vec3(2.5, 2.2, 1.8) * mote * acc * 2.5;
      // ambient: cold room light and the glow of the source
      vec3 col = mix(vec3(.002, .004, .008), uP2 * .05, smoothstep(-.6, .7, p.y + .3 * fbm(p * 1.5 + uT * .03)));
      col += mix(uP3, uP1, .5) * .25 * exp(-length(vUv - lp) * 5.) * (.5 + uEnergy);
      col += beam;
      vec4 tx = TX(vUv, 0.);
      col = mix(col, vec3(.004), tx.g * .9);
      col += vec3(3.2, 2.7, 2.2) * tx.r * (.9 + .4 * uKick);
      o = vec4(col, 1);
    }`,
  });

  // ---------------------------------------------------------------- 5. Ink
  look({
    id: 'ink', name: 'Ink', family: 'Matter', stateful: true,
    from: 'Ink-in-water and fluid sequences from art-led music videos and title design.',
    what: 'Words are written in wet ink on warm paper. The moment a word is sung its ink lets go and blooms into slow, curling clouds of indigo and vermilion that drift and fold through everything after, so each verse leaves its trace on the page.',
    post: POST({ thresh: 3, bloom: 0.0, grain: 0.03, vig: 0.35 }),
    text(ctx, W, H, t) {
      const m = M(W, H), hit = Song.lineAt(t), a = lineFade(hit, t);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (!hit) {
        if (titleFade(t) > 0) { ctx.font = F.serif(m.S * 0.2, true); ctx.fillStyle = rgba('g', titleFade(t)); ctx.fillText('Static Bloom', m.cx, m.cy); }
        return;
      }
      const maxW = W * 0.84, { px, rows } = fitRows(ctx, hit.L.words, (s) => F.serif(s, true), maxW, m.tall ? W * 0.18 : H * 0.2, m.tall ? 4 : 2);
      block(ctx, rows, px, m.cx, m.cy, maxW, { t, a, lh: 1.0,
        word(c, it, x, y, p) {
          const sung = t >= it.wd.s;
          c.fillStyle = rgba(sung ? 'g' : 'b', a); c.fillText(it.txt, x, y);
          if (sung) { c.fillStyle = rgba('r', a * Math.exp(-(t - it.wd.s) * 1.4)); c.fillText(it.txt, x, y); }
        } });
    },
    sim: `
    void main(){
      vec2 p = asp(vUv);
      float k = uDt * 60.;
      vec2 v = curl(p * 2.2 + vec2(0., uT * .06)) * .0011 + curl(p * 6. - uT * .1) * .0004;
      v += vec2(0., .0005);
      v *= 1. + 1.5 * uKick * uEnergy;
      v *= vec2(1. / uAspect, 1.);
      vec2 tx = 1. / uRes;
      vec3 s = texture(uPrev, vUv - v * k).rgb;
      vec3 bl = (texture(uPrev, vUv + vec2(tx.x, 0)).rgb + texture(uPrev, vUv - vec2(tx.x, 0)).rgb + texture(uPrev, vUv + vec2(0, tx.y)).rgb + texture(uPrev, vUv - vec2(0, tx.y)).rgb) * .25;
      s = mix(s, bl, .08 * k);
      s *= pow(.9965, k);
      float inj = TX(vUv, .5).r;
      float pick = smoothstep(.35, .65, fbm(p * 1.7 + vec2(uT * .05, 3.)));
      vec3 indigo = vec3(2.6, 2.2, 1.1), verm = vec3(.25, 1.9, 2.6);
      s += inj * mix(indigo, verm, pick) * .11 * k;
      o = vec4(min(s, vec3(5.)), 1);
    }`,
    frag: `
    void main(){
      vec2 p = asp(vUv);
      vec3 paper = vec3(.86, .8, .7) * (.94 + .06 * fbm(p * vec2(140., 60.))) * (.96 + .04 * fbm(p * 4.));
      vec3 ab = texture(uPrev, vUv).rgb;
      vec3 col = paper * exp(-ab * .85);
      vec4 tx = TX(vUv, 0.), tb = TX(vUv, .9);
      col = mix(col, vec3(.035, .03, .05), tb.g * .25);
      col = mix(col, vec3(.012, .012, .03), tx.g * .94);
      col = mix(col, vec3(.3, .28, .27), tx.b * .5);
      o = vec4(col, 1);
    }`,
  });

  // ---------------------------------------------------------------- 6. Abyss
  look({
    id: 'abyss', name: 'Abyss', family: 'Atmosphere',
    from: 'Underwater and deep-water imagery from recent tour visuals and the music videos around them.',
    what: 'The lyric hangs deep under water. Sunlight falls in moving shafts, caustics crawl over the letters, the words sway and bend with the current, and bubbles rise on the kick. Sung words glow sea-glass green; the break sinks the whole frame into darkness.',
    post: POST({ thresh: 0.9, bloom: 0.75, hal: 0.05, grain: 0.04, ca: 0.4, vig: 0.8 }),
    text(ctx, W, H, t) {
      const m = M(W, H), hit = Song.lineAt(t), a = lineFade(hit, t);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (!hit) {
        if (titleFade(t) > 0) { ctx.font = F.tight(300, m.S * 0.12); spacing(ctx, m.S * 0.01); ctx.fillStyle = rgba('r', titleFade(t) * 0.8); ctx.fillText('static bloom', m.cx, m.cy); spacing(ctx, 0); }
        return;
      }
      const maxW = W * 0.84;
      spacing(ctx, (m.tall ? W : H) * 0.006);
      const { px, rows } = fitRows(ctx, hit.L.words, (s) => F.tight(300, s), maxW, m.tall ? W * 0.16 : H * 0.19, m.tall ? 4 : 2);
      block(ctx, rows, px, m.cx, m.cy, maxW, { t, a, lh: 1.15, mode: 'word',
        word(c, it, x, y, p) {
          const k = it.wd.k + hit.L.i * 7, dy = Math.sin(t * 0.9 + k * 1.7) * px * 0.08, dx = Math.sin(t * 0.6 + k) * px * 0.04;
          c.fillStyle = rgba(p > 0 ? 'r' : 'g', a * (p > 0 ? 0.4 + 0.6 * p : 1)); c.fillText(it.txt, x + dx, y + dy - (1 - p) * px * 0.15 * (p > 0 ? 1 : 0));
        } });
      spacing(ctx, 0);
    },
    frag: `
    float caus(vec2 p){
      float c = 0., a = .6;
      for (int i = 0; i < 3; i++){
        float n = vn(p + vec2(uT * .25, -uT * .18) * float(i + 1));
        c += pow(1. - abs(n * 2. - 1.), 9.) * a;
        p = p * 1.9 * rot(.7) + 3.1; a *= .6;
      }
      return c;
    }
    void main(){
      vec2 p = asp(vUv);
      vec2 w = vec2(fbm(p * 2.6 + vec2(0., uT * .25)), fbm(p * 2.6 + vec2(4.1, uT * .21))) - .5;
      vec2 tuv = vUv + w * .016;
      float depth = 1. - vUv.y;
      float lit = .35 + .65 * uEnergy;
      vec3 col = mix(uP2 * .32 * lit, vec3(.0, .004, .012), smoothstep(.0, .95, depth));
      float sh = pow(fbm(vec2(p.x * 2.8 + p.y * .9, uT * .08)), 2.6) * 3.;
      col += mix(uP2, vec3(.8, 1., .95), .4) * sh * smoothstep(.95, .1, depth) * .35 * lit;
      float cs = caus(p * 4.5 + w * 2.);
      col += uP2 * cs * .25 * smoothstep(1., .2, depth) * lit;
      // bubbles
      vec2 g = p * 13.; float col_ = floor(g.x);
      g.y -= uT * (.6 + .9 * h12(vec2(col_, 3.))) + h12(vec2(col_, 9.)) * 20.;
      vec2 id = floor(g), f = fract(g) - .5;
      float rn = h12(id);
      float bub = 0.;
      if (rn > .9){ float r = .1 + .14 * h12(id + 7.); f.x += sin(g.y * 3. + rn * 20.) * .12; float d = length(f); bub = smoothstep(r, r - .025, d) * smoothstep(r - .08, r - .02, d) + smoothstep(.05, .0, length(f - vec2(-.04, .05))) * .8; }
      col += vec3(.7, .95, 1.) * bub * (.25 + .5 * uKick) * smoothstep(1., .3, depth);
      // marine snow
      vec2 s = vUv * vec2(uAspect, 1.) * 160. + vec2(uT * .8, uT * 2.);
      vec2 si = floor(s); vec2 sf = fract(s) - .5 - (h22(si) - .5) * .7;
      col += vec3(.6, .8, .85) * smoothstep(.1, .0, length(sf)) * step(.965, h12(si)) * .3;
      vec4 tx = TX(tuv, 0.), tg = TX(tuv, 2.4), tw = TX(tuv, 4.6);
      col *= 1. - .35 * clamp(tw.g + tw.r, 0., 1.);
      col = mix(col, uP2 * .12 + vec3(.02, .04, .05), tx.g * .8);
      vec3 glow = mix(uP2, vec3(.75, 1., .9), .45);
      col += glow * tx.r * (1.6 + 2.2 * cs + .8 * uKick);
      col += uP2 * (tg.r * .8 + tw.r * .5);
      o = vec4(col, 1);
    }`,
  });

  // ---------------------------------------------------------------- 7. Swarm
  look({
    id: 'swarm', name: 'Swarm', family: 'Matter',
    from: 'Real-time particle and point-cloud visuals from live shows and generative stage content.',
    what: 'Forty thousand points of light orbit in a slow galaxy. As each word is sung, its share of the swarm breaks off and flies in to build the word in sharp focus, while everything nearer or further melts into soft bokeh. When the line ends, the points rush off to build the next one.',
    post: POST({ thresh: 0.8, bloom: 0.85, grain: 0.03, ca: 0.0, vig: 0.7 }),
    points: true,
    text() { /* Swarm reads the lyric through its particle targets, not the mask */ },
    frag: `
    void main(){
      vec2 p = asp(vUv);
      vec3 col = mix(vec3(.0, .0, .004), uP0 * .2, smoothstep(-.7, .7, p.y));
      float neb = fbm(p * 1.6 + vec2(uT * .02, 0.) + fbm(p * 3. - uT * .03));
      col += mix(uP0, uP1 * .5, smoothstep(.45, .85, neb)) * pow(neb, 4.) * .25 * (.4 + .6 * uEnergy);
      col += uP2 * .05 * pow(fbm(p * 2.3 + 7.), 4.) * 4.;
      o = vec4(col, 1);
    }`,
  });

  // ---------------------------------------------------------------- 8. Premiere
  look({
    id: 'premiere', name: 'Premiere', family: 'Atmosphere',
    from: 'Film title sequences and cinematic lyric videos: scope framing, lens flares and film stock.',
    what: 'A 2.39:1 frame, smoke lit from the side, and the lyric set in a fine serif like opening credits. Words resolve out of a soft focus pull as they are sung and throw a long anamorphic flare. Film halation and grain finish it, with the translation set small underneath like a subtitle.',
    post: POST({ thresh: 0.85, bloom: 0.5, hal: 0.55, grain: 0.06, ca: 0.5, vig: 0.85, lift: 0.012 }),
    text(ctx, W, H, t) {
      const m = M(W, H), hit = Song.lineAt(t), a = lineFade(hit, t);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const blur = (v) => { if ('filter' in ctx) ctx.filter = v > 0.3 ? `blur(${v.toFixed(1)}px)` : 'none'; };
      if (!hit) {
        if (titleFade(t) > 0) {
          const k = clamp(t / 2.5, 0, 1); ctx.font = F.serif(m.S * 0.1); spacing(ctx, m.S * 0.03);
          blur((1 - ease(k)) * m.S * 0.02); ctx.fillStyle = rgba('r', titleFade(t) * ease(k)); ctx.fillText('STATIC BLOOM', m.cx, m.cy); blur(0);
          ctx.font = F.serif(m.S * 0.032, true); spacing(ctx, m.S * 0.004); ctx.fillStyle = rgba('b', titleFade(t) * smooth(1, 3, t)); ctx.fillText('a Lyricscape demo', m.cx, m.cy + m.S * 0.1); spacing(ctx, 0);
        }
        return;
      }
      const push = 1 + 0.035 * clamp(hit.age / 4, 0, 1);
      ctx.save(); ctx.translate(m.cx, m.cy); ctx.scale(push, push); ctx.translate(-m.cx, -m.cy);
      spacing(ctx, (m.tall ? W : H) * 0.012);
      const maxW = W * (m.tall ? 0.86 : 0.74);
      const { px, rows } = fitRows(ctx, hit.L.words, (s) => F.serif(s), maxW, m.tall ? W * 0.13 : H * 0.125, m.tall ? 4 : 2, true);
      const h = block(ctx, rows, px, m.cx, m.cy - px * 0.2, maxW, { t, a, lh: 1.1,
        word(c, it, x, y) {
          const k = clamp((t - it.wd.s + 0.15) / 0.55, 0, 1);
          if (k <= 0) return;
          blur((1 - ease(k)) * px * 0.18);
          c.fillStyle = rgba('r', a * ease(k)); c.fillText(it.txt, x, y);
          blur(0);
        } });
      spacing(ctx, (m.tall ? W : H) * 0.003);
      ctx.textAlign = 'center';
      ctx.font = F.serif(px * 0.3, true);
      ctx.fillStyle = rgba('b', a * smooth(hit.L.start + 0.6, hit.L.start + 1.4, t) * 0.9);
      ctx.fillText(hit.L.sub, m.cx, m.cy - px * 0.2 + h / 2 + px * 0.42);
      spacing(ctx, 0); ctx.restore();
    },
    frag: `
    void main(){
      vec2 p = asp(vUv);
      float bars = uAspect > 1. ? (1. - uAspect / 2.39) * .5 : .1;
      float inFrame = step(bars, vUv.y) * step(vUv.y, 1. - bars);
      vec2 q = p + vec2(uT * .03, 0.);
      float sm = fbm(q * 1.6 + vec2(fbm(q * 2.2 + uT * .04), fbm(q * 2.1 - uT * .03)) * 1.3);
      vec3 col = vec3(.003, .004, .007);
      float side = smoothstep(-.2, 1.1, p.x / uAspect * 2.);
      col += mix(uP0 * .8, uP1, side * .7) * pow(sm, 2.2) * (.5 + .7 * side) * (.45 + .55 * uEnergy);
      col += uP2 * .06 * pow(sm, 4.) * (1. - side);
      // anamorphic streak from the lit words
      float st = 0.;
      for (int i = -7; i <= 7; i++) st += TX(vUv + vec2(float(i) * .055, 0.), 4.6).r * (1. - abs(float(i)) / 8.);
      float core = TX(vUv, 3.).r;
      float band = 0.;
      for (int i = -6; i <= 6; i++) band += TX(vec2(vUv.x * .3 + .35 + float(i) * .06, vUv.y), 3.2).r;
      col += vec3(.3, .5, 1.) * (st * .2 + band * .06 * exp(-pow((vUv.x - .5) * 1.6, 2.))) * (.7 + .5 * uKick);
      col += vec3(.3, .5, 1.) * core * .4;
      vec4 tx = TX(vUv, 0.);
      col += vec3(2.1, 1.95, 1.75) * tx.r;
      col += vec3(.85, .8, .7) * tx.b * .7;
      col *= inFrame;
      o = vec4(col, 1);
    }`,
  });

  // ---------------------------------------------------------------- 9. Monolith
  look({
    id: 'monolith', name: 'Monolith', family: 'Matter',
    from: 'Stark, minimal stage design from recent pop tours: one giant word, flat light, nothing else.',
    what: 'One word at a time, enormous and heavy, projected on a hanging drape that moves gently in the air, so the type folds with the fabric. Each beat squeezes the word. The chorus flips the room from flooded white to black. The full line runs small along the bottom.',
    post: POST({ thresh: 2.5, bloom: 0.15, grain: 0.05, ca: 0.1, vig: 0.35 }),
    text(ctx, W, H, t) {
      const m = M(W, H), hit = Song.lineAt(t), a = lineFade(hit, t);
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      let word = null;
      if (hit) word = Song.curWord(hit.L, t);
      const txt = word ? word.text.toLowerCase().replace(/[^a-z']/g, '') : titleFade(t) > 0 ? 'static bloom' : '';
      if (txt) {
        ctx.font = F.tight(900, 100);
        spacing(ctx, -6);
        const w = ctx.measureText(txt).width;
        const px = Math.min(100 * (W * 0.9) / w, H * (m.tall ? 0.3 : 0.62));
        ctx.font = F.tight(900, px); spacing(ctx, -px * 0.03);
        const B = Song.beat(t), k = REDUCED ? 0 : B.env;
        const pop = word ? easeBack(clamp((t - word.s) / 0.18, 0, 1)) : 1;
        ctx.save(); ctx.translate(m.cx, m.cy + px * 0.34); ctx.scale((1 + 0.05 * k) * (0.92 + 0.08 * pop), (1 - 0.035 * k) * (0.92 + 0.08 * pop));
        ctx.fillStyle = rgba('r', word ? a : titleFade(t)); ctx.fillText(txt, 0, 0); ctx.restore();
      }
      if (hit) {
        ctx.font = F.tight(600, m.S * 0.034); spacing(ctx, m.S * 0.002); ctx.textAlign = 'left';
        let x = W * 0.05; const y = H * 0.93;
        for (const w of hit.L.words) { const s = w.text.toLowerCase() + ' '; ctx.fillStyle = rgba(t >= w.s ? 'g' : 'b', a); ctx.fillText(s, x, y); x += ctx.measureText(s).width; }
      }
      spacing(ctx, 0);
    },
    frag: `
    float fold(vec2 p){ return sin(p.x * 7. + fbm(vec2(p.x * 1.5, uT * .12)) * 5. + sin(uT * .4 + p.y * 1.5) * .6) * .5 + .5 * fbm(vec2(p.x * 3., p.y * .4 + uT * .05)); }
    void main(){
      vec2 p = asp(vUv);
      float e = .004;
      float f0 = fold(p), fx = fold(p + vec2(e, 0)) - fold(p - vec2(e, 0));
      vec2 tuv = vUv + vec2(fx * .006, 0.);
      float shade = .72 + .28 * f0 - fx * 4.;
      vec3 room = mix(vec3(.82, .82, .8), vec3(1.), smoothstep(-.6, .6, p.y)) * shade;
      vec3 dark = mix(vec3(.006), vec3(.035, .033, .04), smoothstep(-.6, .6, p.y)) * shade * shade;
      vec4 tx = TX(tuv, 0.), tb = TX(tuv, 3.);
      vec3 inkL = vec3(.006) * shade;
      vec3 inkD = vec3(1.4, 1.38, 1.34) * shade;
      vec3 a = mix(room, room * .8, tb.r * .25);
      a = mix(a, inkL, tx.r);
      a = mix(a, vec3(.03), tx.g * .9);
      a = mix(a, vec3(.42), tx.b * .8);
      vec3 b = dark + uP1 * .015 * shade;
      b = mix(b, inkD, tx.r);
      b = mix(b, vec3(1.1), tx.g * .9);
      b = mix(b, vec3(.12), tx.b * .8);
      b += inkD * tb.r * .08;
      o = vec4(mix(a, b, uInv), 1);
    }`,
  });

  // title "lines" for the swarm to build during the intro, the break and the outro
  const TITLE_LINES = [[0.4, LINES[0].start - 0.6, 100], [BRK.start + 0.8, BRK.end - 0.9, 101], [LINES[LINES.length - 1].end + 1.4, DURATION - 0.6, 102]].map(([s0, e0, i]) => ({
    i, start: s0, end: e0, words: [{ text: 'static', s: s0, e: s0 + 0.5, k: 0 }, { text: 'bloom', s: s0 + 0.45, e: s0 + 1, k: 1 }] }));
  // ---------- Swarm particles ----------
  const SW_N = 40000, SW_TW = 256, SW_TH = Math.ceil(SW_N / SW_TW);
  const SWARM_VS = `#version 300 es
  precision highp float; precision highp sampler2D;
  uniform sampler2D uCur, uPrv; uniform int uCurN, uPrvN; uniform float uT, uCurEnd, uPrvEnd, uAspect, uKick, uEnergy, uPx, uPtMax, uLead;
  uniform vec3 uP1, uP2, uP3, uP4;
  in vec4 aSeed; out vec3 vCol; out float vSoft;
  vec4 tgt(sampler2D s, int n, int id){ int i = id % max(n, 1); return texelFetch(s, ivec2(i % ${SW_TW}, i / ${SW_TW}), 0); }
  float formed(vec4 g, float end, vec4 s){ float d = s.z * .35; return smoothstep(g.z - .2 + d * .3, g.z + .45 + d, uT) * (1. - smoothstep(end + d * .4, end + .9 + d, uT)); }
  void main(){
    vec4 s = aSeed;
    float ang = s.x * 6.2831 + uT * (.04 + .18 / (.5 + s.y * 2.));
    float rad = .55 + pow(s.y, .6) * 2.2;
    vec3 c = vec3(cos(ang) * rad, (s.z - .5) * .3 * rad + sin(ang * 3. + s.w * 9.) * .07, sin(ang) * rad);
    float tl = .45; c.yz = mat2(cos(tl), -sin(tl), sin(tl), cos(tl)) * c.yz;
    c.x *= max(uAspect, .7) * .75;
    c.y += .05;
    vec3 p = c;
    float fa = 0., fb = 0.;
    bool ambient = s.w > .86;
    if (!ambient && uPrvN > 0){ vec4 g = tgt(uPrv, uPrvN, gl_VertexID); fa = formed(g, uPrvEnd, s); p = mix(p, vec3(g.xy, (s.w - .5) * .03), fa); }
    if (!ambient && uCurN > 0){ vec4 g = tgt(uCur, uCurN, gl_VertexID); fb = formed(g, uCurEnd, s); p = mix(p, vec3(g.xy, (s.w - .5) * .03), fb); }
    float f = max(fa, fb);
    p += vec3(sin(s.x * 40.), cos(s.y * 40.), sin(s.z * 30.)) * f * (1. - f) * .7;
    float persp = 1. / max(.25, 1. + p.z * .42);
    vec2 sp = p.xy * persp;
    gl_Position = vec4(sp.x / uAspect, sp.y, 0., 1.);
    float coc = abs(p.z) * 1.1;
    float size = (2.4 + coc * 15.) * uPx * persp;
    gl_PointSize = min(size, uPtMax);
    float energy = 1. / (1. + coc * coc * 10.);
    vec3 base = mix(mix(uP1, uP2, step(.5, fract(s.x * 7.3))), uP4, step(.8, s.y)) * (.12 + .18 * uEnergy) * (ambient ? 1.6 : .7);
    vec3 hot = vec3(1.0, .96, .92) * (1.15 + .7 * uKick);
    vCol = mix(base, hot, f) * energy * (ambient ? .6 : 1.) * mix(.55 + .45 * s.z, .8, f) * (1. + .5 * uLead * f);
    vSoft = clamp(coc * 2., 0., 1.);
  }`;
  const SWARM_FS = `#version 300 es
  precision highp float; in vec3 vCol; in float vSoft; out vec4 o;
  void main(){ vec2 q = gl_PointCoord - .5; float d = length(q) * 2.; if (d > 1.) discard;
    float disc = mix(smoothstep(1., .35, d), smoothstep(1., .82, d) * (.65 + .35 * smoothstep(.55, .95, d)), vSoft);
    o = vec4(vCol * disc, 1.); }`;
  const P_SWARM = program(SWARM_FS, 'swarm', SWARM_VS);
  const swVao = gl.createVertexArray(), swBuf = gl.createBuffer();
  {
    const seeds = new Float32Array(SW_N * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = hash(i * 0.6180339 + 0.123);
    gl.bindVertexArray(swVao); gl.bindBuffer(gl.ARRAY_BUFFER, swBuf); gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(P_SWARM.p, 'aSeed'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  // =====================================================================================
  //  App shell
  // =====================================================================================
  const state = { look: 0, t: 12.2, playing: false, last: 0, aspect: 'wide', sound: true, lastFrameT: null };
  try { REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* no media query support */ }

  function size() {
    const wrap = $('#stageWrap');
    const portrait = state.aspect === 'tall';
    const bw = wrap.clientWidth - 24, maxH = Math.min(window.innerHeight * 0.72, 900);
    let w = bw, h = portrait ? bw * 16 / 9 : bw * 9 / 16;
    if (h > maxH) { h = maxH; w = portrait ? h * 9 / 16 : h * 16 / 9; }
    const dpr = Math.min(1.75, window.devicePixelRatio || 1);
    stage.style.width = `${w}px`; stage.style.height = `${h}px`;
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (stage.width !== pw || stage.height !== ph || !FB) {
      stage.width = pw; stage.height = ph;
      buildTargets(pw, ph);
      const k = Math.min(1, 1920 / Math.max(pw, ph));
      tc.width = Math.round(pw * k); tc.height = Math.round(ph * k);
    }
    state.W = w; state.H = h; state.dpr = dpr;
    for (const v of swarmCache.values()) gl.deleteTexture(v.tex);
    swarmCache.clear();
  }

  // swarm targets: sample the line's glyphs once, tagging each sample with its word's timing
  const swarmCache = new Map();
  const swCanvas = document.createElement('canvas');
  function swarmTargets(L) {
    if (swarmCache.has(L.i)) return swarmCache.get(L.i);
    const tall = stage.height > stage.width, aspect = stage.width / stage.height;
    const sw = tall ? 560 : 1000, sh = Math.round(sw / aspect);
    swCanvas.width = sw; swCanvas.height = sh;
    const c = swCanvas.getContext('2d', { willReadFrequently: true });
    c.fillStyle = '#000'; c.fillRect(0, 0, sw, sh);
    const maxW = sw * 0.86, { px, rows } = fitRows(c, L.words, (s) => F.tight(900, s), maxW, tall ? sw * 0.2 : sh * 0.24, tall ? 4 : 2);
    c.font = F.tight(900, px); c.textBaseline = 'middle';
    const lh = px * 1.0, H0 = rows.length * lh;
    rows.forEach((row, ri) => {
      const x0 = sw / 2 - row.width / 2, y = sh / 2 - H0 / 2 + lh * (ri + 0.5);
      for (const it of row.items) { c.fillStyle = `rgb(${(it.wd.k + 1) * 20},255,0)`; c.fillText(it.txt, x0 + it.x, y); }
    });
    const d = c.getImageData(0, 0, sw, sh).data, pts = [];
    let lit = 0; for (let o = 1; o < d.length; o += 4) if (d[o] > 200) lit++;
    const step = Math.max(1, Math.sqrt(lit / 15000));
    for (let fy = 0; fy < sh; fy += step) for (let fx = 0; fx < sw; fx += step) {
      const x = Math.floor(fx), y = Math.floor(fy), o = (y * sw + x) * 4;
      if (d[o + 1] > 200) pts.push([x, y, Math.round(d[o] / 20) - 1]);
    }
    for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(hash(i * 1.37 + L.i) * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
    const n = Math.min(SW_N, pts.length), arr = new Float32Array(SW_TW * SW_TH * 4);
    for (let i = 0; i < n; i++) {
      const [x, y, k] = pts[i], w = L.words[clamp(k, 0, L.words.length - 1)];
      arr[i * 4] = ((x + (hash(i * 3.1) - 0.5) * step) / sw - 0.5) * 2 * aspect;
      arr[i * 4 + 1] = -((y + (hash(i * 5.7) - 0.5) * step) / sh - 0.5) * 2;
      arr[i * 4 + 2] = w.s; arr[i * 4 + 3] = w.e;
    }
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, SW_TW, SW_TH, 0, gl.RGBA, gl.FLOAT, arr);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const r = { tex, n };
    swarmCache.set(L.i, r);
    return r;
  }

  // ---------- one frame ----------
  let frameNo = 0;
  function uniformsAt(t, dt) {
    const sec = Song.section(t);
    const inv = sec.name === 'Chorus' ? smooth(sec.start - 0.05, sec.start + 0.2, t) * (1 - smooth(sec.end - 0.25, sec.end - 0.02, t)) : 0;
    let lead = 0;
    for (let i = LEADS.length - 1; i >= 0; i--) { const e = LEADS[i]; if (e.t <= t) { lead = Math.exp(-(t - e.t) * 3); break; } }
    const r = REDUCED ? 0.35 : 1;
    return {
      uRes: [FB.w, FB.h], uT: t, uDt: dt, uAspect: FB.w / FB.h,
      uBeat: Song.beat(t).env * r, uKick: envAt(KICKS, t, 7) * r, uSnare: envAt(SNARES, t, 9) * r, uHat: envAt(HATS, t, 20) * r, uBarEnv: Song.beat(t).barEnv * r,
      uEnergy: energy(t), uInv: inv, uLead: lead * r,
      uLod: Math.log2(Math.min(tc.width, tc.height) / 720),
      uP0: PALL[0], uP1: PALL[1], uP2: PALL[2], uP3: PALL[3], uP4: PALL[4],
    };
  }
  function drawMask(Lk, t) {
    const c = tctx, W = tc.width, H = tc.height;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.filter = 'none';
    c.globalCompositeOperation = 'source-over'; c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'lighter';
    try { Lk.text(c, W, H, t); } catch (e) { console.error(Lk.id, 'text', e); }
    c.globalCompositeOperation = 'source-over';
    gl.bindTexture(gl.TEXTURE_2D, texText);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, tc);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  function bindCommon(pr, prevTex) {
    bindTex(pr, 'uText', 0, texText); bindTex(pr, 'uCover', 1, texCover); bindTex(pr, 'uSpec', 3, texSpec);
    if (prevTex) bindTex(pr, 'uPrev', 2, prevTex);
  }
  function step(t, dt) {
    const Lk = LOOKS[state.look];
    const U = uniformsAt(t, dt);
    const sp = spectrum(t, 64); for (let i = 0; i < 64; i++) specBytes[i] = Math.round(sp[i] * 255);
    gl.bindTexture(gl.TEXTURE_2D, texSpec); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 64, 1, gl.RED, gl.UNSIGNED_BYTE, specBytes);
    drawMask(Lk, t);
    gl.disable(gl.BLEND);
    if (Lk.sim) {
      if (simFresh) clearSim();
      gl.useProgram(Lk.simProg.p); setU(Lk.simProg, Object.assign({}, U, { uRes: [FB.simA.w, FB.simA.h] }));
      bindCommon(Lk.simProg, FB.simA.tex);
      quad(FB.simB);
      [FB.simA, FB.simB] = [FB.simB, FB.simA];
    }
    return { Lk, U };
  }
  function draw(t, dt) {
    const { Lk, U } = step(t, dt);
    gl.useProgram(Lk.prog.p); setU(Lk.prog, U); bindCommon(Lk.prog, FB.simA.tex);
    quad(FB.scene);
    if (Lk.points) drawSwarm(t, U);
    // bloom
    const P = Lk.post, B = FB.bloom;
    gl.useProgram(P_DOWN.p);
    for (let i = 0; i < B.length; i++) {
      const src = i === 0 ? FB.scene : B[i - 1];
      setU(P_DOWN, { uTexel: [1 / src.w, 1 / src.h], uThresh: P.thresh, uFirst: i === 0 ? 1 : 0 });
      bindTex(P_DOWN, 'uSrc', 0, src.tex); quad(B[i]);
    }
    gl.useProgram(P_UP.p); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = B.length - 2; i >= 0; i--) {
      const src = B[i + 1];
      setU(P_UP, { uTexel: [1 / src.w, 1 / src.h] }); bindTex(P_UP, 'uSrc', 0, src.tex); quad(B[i]);
    }
    gl.disable(gl.BLEND);
    gl.useProgram(P_FINAL.p);
    setU(P_FINAL, { uRes: [FB.w, FB.h], uBloomK: P.bloom / 3, uHal: P.hal / 3, uGrain: REDUCED ? P.grain * 0.5 : P.grain, uCA: P.ca * 0.06, uVig: P.vig, uExp: P.exp, uFrame: Math.floor(t * 24) % 997, uLift: P.lift });
    bindTex(P_FINAL, 'uScene', 0, FB.scene.tex); bindTex(P_FINAL, 'uBloom', 1, B[0].tex);
    quad(null);
    frameNo++;
  }
  function drawSwarm(t, U) {
    const cur = Song.lastStarted(t);
    let Lc = cur >= 0 ? LINES[cur] : null, Lp = cur > 0 ? LINES[cur - 1] : null;
    const tl = TITLE_LINES.find((x) => t >= x.start - 0.5 && t <= x.end + 1.2);
    if (tl) { if (t >= tl.start - 0.5 && Lc && Lc.start < tl.start) { Lp = Lc; Lc = tl; } else if (!Lc) Lc = tl; else if (tl.start < Lc.start) Lp = tl; }
    const A = Lc ? swarmTargets(Lc) : null, Bp = Lp ? swarmTargets(Lp) : null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, FB.scene.fb); gl.viewport(0, 0, FB.w, FB.h);
    gl.useProgram(P_SWARM.p);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    setU(P_SWARM, { uT: t, uAspect: U.uAspect, uKick: U.uKick, uEnergy: U.uEnergy, uLead: U.uLead, uPx: FB.h / 900, uPtMax: PT_MAX, uP1: PALL[1], uP2: PALL[2], uP3: PALL[3], uP4: PALL[4],
      uCurEnd: Lc ? Lc.end + 0.35 : 0, uPrvEnd: Lp ? Lp.end + 0.35 : 0 });
    gl.uniform1i(P_SWARM.loc('uCurN'), A ? A.n : 0);
    gl.uniform1i(P_SWARM.loc('uPrvN'), Bp ? Bp.n : 0);
    bindTex(P_SWARM, 'uCur', 0, A ? A.tex : texSpec);
    bindTex(P_SWARM, 'uPrv', 1, Bp ? Bp.tex : texSpec);
    gl.bindVertexArray(swVao);
    gl.drawArrays(gl.POINTS, 0, SW_N);
    gl.bindVertexArray(null);
    gl.disable(gl.BLEND);
  }

  function render(dt) {
    const L = LOOKS[state.look];
    const jump = state.lastFrameT == null || Math.abs(state.t - state.lastFrameT) > 0.5 || dt < 0;
    try { if (jump && L.sim) warm(state.t); else draw(state.t, jump ? 0 : clamp(dt, 0, 1 / 20)); } catch (e) { console.error(L.id, e); }
    state.lastFrameT = state.t;
    const sec = Song.section(state.t);
    $('#time').textContent = `${fmt(state.t)} / ${fmt(DURATION)}`;
    $('#section').textContent = sec.name;
    const sc = $('#scrub'); if (document.activeElement !== sc) sc.value = String(Math.round(state.t * 10));
  }
  // Stateful looks rebuild their history after a jump by simulating the last few seconds.
  function warm(t) {
    simFresh = true;
    const from = Math.max(0, t - 5);
    for (let x = from; x < t - 1 / 30; x += 1 / 30) step(x, 1 / 30);
    draw(t, 1 / 30);
  }
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // ---------- sound ----------
  let ac = null, out = null, sched = 0, timer = 0, base = 0;
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function voice(e, when) {
    const o = ac.createOscillator(), g = ac.createGain();
    if (e.kind === 'kick') { o.type = 'sine'; o.frequency.setValueAtTime(140, when); o.frequency.exponentialRampToValueAtTime(42, when + 0.16); g.gain.setValueAtTime(0.9, when); g.gain.exponentialRampToValueAtTime(0.001, when + 0.3); o.connect(g); g.connect(out); o.start(when); o.stop(when + 0.32); return; }
    if (e.kind === 'snare' || e.kind === 'hat') {
      const len = e.kind === 'hat' ? 0.05 : 0.18, buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * len), ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (hash(i * 0.731 + (e.kind === 'hat' ? 7 : 0)) * 2 - 1);
      const src = ac.createBufferSource(), f = ac.createBiquadFilter(); src.buffer = buf; f.type = e.kind === 'hat' ? 'highpass' : 'bandpass'; f.frequency.value = e.kind === 'hat' ? 7000 : 1800;
      g.gain.setValueAtTime(e.kind === 'hat' ? 0.12 : 0.4, when); g.gain.exponentialRampToValueAtTime(0.001, when + len);
      src.connect(f); f.connect(g); g.connect(out); src.start(when); src.stop(when + len); return;
    }
    if (e.kind === 'bass') { o.type = 'triangle'; o.frequency.value = hz(e.note); g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.32, when + 0.01); g.gain.exponentialRampToValueAtTime(0.001, when + e.dur); o.connect(g); g.connect(out); o.start(when); o.stop(when + e.dur + 0.02); return; }
    if (e.kind === 'lead') { o.type = 'square'; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200; o.frequency.value = hz(e.note); g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(0.07, when + 0.015); g.gain.exponentialRampToValueAtTime(0.001, when + e.dur + 0.15); o.connect(f); f.connect(g); g.connect(out); o.start(when); o.stop(when + e.dur + 0.2); return; }
    if (e.kind === 'pad') { for (const n of e.notes) { const p = ac.createOscillator(), pg = ac.createGain(); p.type = 'sawtooth'; p.frequency.value = hz(n); const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; pg.gain.setValueAtTime(0.0001, when); pg.gain.linearRampToValueAtTime(0.025, when + 0.3); pg.gain.linearRampToValueAtTime(0.0001, when + e.dur); p.connect(f); f.connect(pg); pg.connect(out); p.start(when); p.stop(when + e.dur + 0.05); } }
  }
  function startSound() {
    if (!state.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      ac.resume();
      out = ac.createGain(); out.gain.value = 0.6; out.connect(ac.destination);
      base = ac.currentTime + 0.05 - state.t; sched = state.t;
      clearInterval(timer);
      timer = setInterval(() => {
        const until = ac.currentTime - base + 0.2;
        for (const e of EVENTS) if (e.t >= sched && e.t < until) voice(e, base + e.t);
        sched = until;
      }, 40);
    } catch { state.sound = false; syncButtons(); }
  }
  function stopSound() { clearInterval(timer); if (out) { try { out.disconnect(); } catch { /* already gone */ } out = null; } }

  // ---------- loop and controls ----------
  function tick(now) {
    const t0 = state.t;
    if (state.playing) {
      if (out && ac) state.t = ac.currentTime - base;
      else state.t += Math.min(0.1, (now - state.last) / 1000);
      if (state.t >= DURATION) { state.t = 0; if (out) { stopSound(); startSound(); } }
    }
    state.last = now;
    render(state.t - t0);
    requestAnimationFrame(tick);
  }
  function play(on) { state.playing = on; if (on) startSound(); else stopSound(); syncButtons(); }
  function seek(t) { state.t = clamp(t, 0, DURATION - 0.01); if (state.playing) { stopSound(); startSound(); } render(0); }
  function syncButtons() {
    $('#play').textContent = state.playing ? 'Pause' : 'Play';
    $('#play').setAttribute('aria-pressed', String(state.playing));
    $('#sound').textContent = state.sound ? 'Sound on' : 'Sound off';
    $('#sound').setAttribute('aria-pressed', String(state.sound));
    for (const b of document.querySelectorAll('[data-aspect-btn]')) b.setAttribute('aria-pressed', String(b.dataset.aspectBtn === state.aspect));
  }
  function select(i, fromHash) {
    state.look = (i + LOOKS.length) % LOOKS.length;
    const L = LOOKS[state.look];
    for (const b of document.querySelectorAll('.look')) b.setAttribute('aria-current', String(b.dataset.id === L.id));
    $('#lookName').textContent = L.name;
    $('#lookFamily').textContent = L.family;
    $('#lookFrom').textContent = L.from;
    $('#lookWhat').textContent = L.what;
    $('#lookNote').hidden = !L.stateful;
    if (!fromHash) { try { history.replaceState(null, '', `#${L.id}`); } catch { location.hash = L.id; } }
    state.lastFrameT = null;
    render(0);
  }

  function buildList() {
    const list = $('#looks');
    const fams = [...new Set(LOOKS.map((l) => l.family))];
    for (const f of fams) {
      const h = document.createElement('h3'); h.textContent = f; list.appendChild(h);
      const row = document.createElement('div'); row.className = 'chips';
      LOOKS.forEach((l, i) => {
        if (l.family !== f) return;
        const b = document.createElement('button'); b.className = 'look'; b.dataset.id = l.id; b.type = 'button';
        b.innerHTML = `<span class="n">${String(i + 1).padStart(2, '0')}</span><span>${l.name}</span>`;
        b.addEventListener('click', () => select(i));
        row.appendChild(b);
      });
      list.appendChild(row);
    }
  }

  function fromHash() { const id = (location.hash || '').slice(1); const i = LOOKS.findIndex((l) => l.id === id); if (i >= 0) select(i, true); }

  buildList();
  $('#play').addEventListener('click', () => play(!state.playing));
  $('#sound').addEventListener('click', () => { state.sound = !state.sound; if (state.playing) { if (state.sound) startSound(); else stopSound(); } syncButtons(); });
  $('#prev').addEventListener('click', () => select(state.look - 1));
  $('#next').addEventListener('click', () => select(state.look + 1));
  for (const b of document.querySelectorAll('[data-aspect-btn]')) b.addEventListener('click', () => { state.aspect = b.dataset.aspectBtn; size(); syncButtons(); state.lastFrameT = null; render(0); });
  const sc = $('#scrub'); sc.max = String(Math.floor(DURATION * 10));
  sc.addEventListener('input', () => seek(Number(sc.value) / 10));
  for (const s of SECTIONS) { const b = document.createElement('button'); b.type = 'button'; b.className = 'sec'; b.textContent = s.name; b.addEventListener('click', () => seek(s.start + (s.name === 'Intro' ? 0 : 0.01))); $('#sections').appendChild(b); }
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') && e.key === ' ') return;
    if (e.key === 'ArrowRight') select(state.look + 1);
    else if (e.key === 'ArrowLeft') select(state.look - 1);
    else if (e.key === ' ') { e.preventDefault(); play(!state.playing); }
  });
  window.addEventListener('resize', () => { size(); state.lastFrameT = null; render(0); });
  window.addEventListener('hashchange', fromHash);
  size();
  select(0, true);
  fromHash();
  syncButtons();
  const fontsReady = document.fonts && document.fonts.load ? Promise.all(['300 40px "Inter Tight"', '600 40px "Inter Tight"', '700 40px "Inter Tight"', '800 40px "Inter Tight"', '900 40px "Inter Tight"', '400 40px "Instrument Serif"', 'italic 400 40px "Instrument Serif"', '800 40px "Bricolage Grotesque"'].map((f) => document.fonts.load(f).catch(() => null))) : Promise.resolve();
  fontsReady.then(() => { for (const v of swarmCache.values()) gl.deleteTexture(v.tex); swarmCache.clear(); state.lastFrameT = null; render(0); window.__labReady = true; });
  requestAnimationFrame((n) => { state.last = n; tick(n); });
  // test hook: draw a given look at a given time (used by the screenshot check)
  window.__lab = { looks: LOOKS.map((l) => l.id), show(id, t, aspect) { if (aspect && aspect !== state.aspect) { state.aspect = aspect; size(); syncButtons(); } state.playing = false; stopSound(); state.t = t; select(LOOKS.findIndex((l) => l.id === id)); } };
})();
