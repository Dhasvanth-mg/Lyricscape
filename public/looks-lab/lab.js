// Looks Lab: nine lyric looks rendered on the GPU (WebGL2), each an original take on a current, high-end genre of lyric or music graphics,
// plus fifteen hand-made, quirky Canvas 2D looks kept from round 1.
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
  const stage = $('#stage'), stage2 = document.createElement('canvas'), ctx2 = stage2.getContext('2d');
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


  // =====================================================================================
  //  The hand-made, quirky looks from round 1 (Canvas 2D), kept beside the GPU looks.
  //  They draw on their own 2D canvas; the code is unchanged from round 1.
  // =====================================================================================
  const COVER_ART = cover;
  // per-look camera finish for the hand-made looks
  const POLISH = {
    warp: { bloom: 0.8, thresh: 0.7, ca: 0.35 }, magnet: { bloom: 1.2, thresh: 0.5, exp: 1.5 }, highway: { bloom: 0.7, thresh: 0.75 },
    karaoke: { bloom: 0.6 }, lull: { bloom: 0.7, thresh: 0.7, hal: 0.3, grain: 0.05 }, platter: { bloom: 0.35, vig: 0.55 },
    recap: { bloom: 0.2, vig: 0.2, boost: 0, exp: 1.25 }, kinetic: { bloom: 0.15, vig: 0.25, boost: 0, exp: 1.25 }, marginalia: { bloom: 0.25, grain: 0.03, exp: 1.1 },
    sticker: { exp: 1.15 }, punch: { exp: 1.15 }, mirror: { exp: 1.1 }, melt: { exp: 1.1 }, boil: { exp: 1.1 }, strip: { bloom: 0.5 },
  };
  const CLASSIC = (() => {
  const NOTES = { 2: [3, 6, 'a goodbye that washes off'], 5: [2, 5, 'noise as company'], 9: [1, 4, 'letters never sent'], 11: [3, 4, 'refusing the ending'] };
  // ---------- the cover: an original procedural "album cover" ----------
  const PAL = { plum: '#2b1641', coral: '#ff6f59', teal: '#2ec4b6', sun: '#ffd23f', cream: '#fff4e6', pink: '#ff9fb2', ink: '#140b1f' };
  const cover = document.createElement('canvas');
  cover.width = cover.height = 512;
  (function paintCover() {
    const c = cover.getContext('2d');
    const g = c.createLinearGradient(0, 0, 512, 512);
    g.addColorStop(0, '#1e0f33'); g.addColorStop(1, '#4a1d4f');
    c.fillStyle = g; c.fillRect(0, 0, 512, 512);
    const petals = [[PAL.coral, 0], [PAL.teal, 1], [PAL.sun, 2], [PAL.pink, 3], [PAL.coral, 4], [PAL.teal, 5], [PAL.sun, 6]];
    c.globalCompositeOperation = 'screen';
    for (const [col, i] of petals) {
      c.save(); c.translate(256 + Math.cos(i) * 30, 286 + Math.sin(i * 2) * 20); c.rotate(i * 0.9);
      c.globalAlpha = 0.72; c.fillStyle = col;
      c.beginPath(); c.ellipse(0, -84, 52, 128, 0, 0, TAU); c.fill(); c.restore();
    }
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = PAL.cream; c.beginPath(); c.arc(256, 286, 34, 0, TAU); c.fill();
    c.fillStyle = PAL.plum; c.beginPath(); c.arc(256, 286, 14, 0, TAU); c.fill();
    const img = c.getImageData(0, 0, 512, 512), d = img.data;
    for (let p = 0; p < d.length; p += 4) { const n = (hash(p * 0.37) - 0.5) * 26; d[p] += n; d[p + 1] += n; d[p + 2] += n; }
    c.putImageData(img, 0, 0);
    c.fillStyle = 'rgba(255,244,230,0.9)'; c.font = '700 22px "Space Grotesk", system-ui, sans-serif'; c.fillText('STATIC BLOOM', 26, 44);
  })();
    // production pass: the hand-made looks share the richer cover art used by the GPU looks
    cover.width = cover.height = 1024; cover.getContext('2d').drawImage(COVER_ART, 0, 0, 1024, 1024);

  // ---------- drawing helpers ----------
  const FONT = {
    ui: (w, px) => `${w} ${px}px Inter, "Segoe UI", system-ui, sans-serif`,
    anton: (px) => `400 ${px}px Anton, Impact, "Arial Narrow", sans-serif`,
    grot: (w, px) => `${w} ${px}px "Space Grotesk", Inter, system-ui, sans-serif`,
    serif: (px, it) => `${it ? 'italic ' : ''}400 ${px}px "Instrument Serif", Georgia, serif`,
    mono: (w, px) => `${w} ${px}px "JetBrains Mono", ui-monospace, monospace`,
    marker: (px) => `400 ${px}px "Permanent Marker", "Comic Sans MS", cursive`,
  };
  const HAS_FILTER = (() => { try { const c = document.createElement('canvas').getContext('2d'); c.filter = 'blur(2px)'; return c.filter === 'blur(2px)'; } catch { return false; } })();
  let REDUCED = false;

  function coverFill(ctx, x, y, w, h, zoom = 1, fx = 0.5, fy = 0.5) {
    const s = Math.max(w, h) * zoom;
    ctx.drawImage(cover, x + (w - s) * fx, y + (h - s) * fy, s, s);
  }
  function fit(ctx, text, fontAt, maxW, maxPx, minPx = 8) {
    let px = maxPx;
    ctx.font = fontAt(px);
    const w = ctx.measureText(text).width;
    if (w > maxW) px = Math.max(minPx, px * (maxW / w));
    return px;
  }
  /** Break words into rows no wider than maxW; returns rows of {w, x, width}. */
  function layoutWords(ctx, words, font, maxW) {
    ctx.font = font;
    const space = ctx.measureText(' ').width;
    const rows = [];
    let row = [], x = 0;
    for (const w of words) {
      const width = ctx.measureText(w.text).width;
      if (row.length && x + width > maxW) { rows.push({ items: row, width: x - space }); row = []; x = 0; }
      row.push({ w, x, width });
      x += width + space;
    }
    if (row.length) rows.push({ items: row, width: x - space });
    return rows;
  }
  function roundRect(ctx, x, y, w, h, r) { r = Math.max(0, Math.min(Math.abs(r), Math.abs(w) / 2, Math.abs(h) / 2)); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); }
  /** A word filled left to right as it is sung: unsung style first, then the sung style clipped to the progress. */
  function wipeWord(ctx, text, x, y, p, unsung, sung, strokeW, stroke1, stroke2) {
    const w = ctx.measureText(text).width;
    ctx.lineJoin = 'round';
    if (strokeW) { ctx.lineWidth = strokeW; ctx.strokeStyle = stroke1; ctx.strokeText(text, x, y); }
    ctx.fillStyle = unsung; ctx.fillText(text, x, y);
    if (p <= 0) return w;
    ctx.save();
    ctx.beginPath(); ctx.rect(x - strokeW, y - 400, w * p + strokeW, 800); ctx.clip();
    if (strokeW) { ctx.strokeStyle = stroke2; ctx.strokeText(text, x, y); }
    ctx.fillStyle = sung; ctx.fillText(text, x, y);
    ctx.restore();
    return w;
  }
  function bg(ctx, W, H, col) { ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); }

  // ---------- the looks ----------
  const LOOKS = [];
  const look = (o) => LOOKS.push(o);

  // 1. Current: word-by-word column
  look({
    id: 'current', name: 'Current', family: 'Streaming lyric views', from: 'Word-by-word lyric columns (Apple Music Sing, Shazam, AMLL)', phase: 'A',
    what: 'A left-aligned column that scrolls on staggered springs. Each word fills with a soft edge and lifts as it is sung; held words swell letter by letter; ad-libs sit smaller underneath; the second singer is set on the right; breaks show breathing dots.',
    draw(ctx, W, H, t) {
      bg(ctx, W, H, '#1a0d2a');
      ctx.save();
      for (let k = 0; k < 5; k++) {
        const x = W * (0.5 + 0.38 * Math.sin(t * 0.11 * (k + 1) + k * 2.1)), y = H * (0.5 + 0.38 * Math.cos(t * 0.09 * (k + 1) + k));
        const r = Math.max(W, H) * 0.6;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, [PAL.coral, PAL.teal, PAL.pink, PAL.sun, '#6b3fa0'][k] + '88'); g.addColorStop(1, '#00000000');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(14,6,24,0.38)'; ctx.fillRect(0, 0, W, H);
      const portrait = H > W;
      const fs = portrait ? W * 0.085 : Math.min(H * 0.078, W * 0.05);
      const x0 = W * 0.08, maxW = W * 0.84, font = FONT.ui(800, fs);
      const layouts = LINES.map((L) => layoutWords(ctx, L.words, font, maxW));
      const hs = layouts.map((rows, i) => rows.length * fs * 1.12 + fs * 0.62 + (LINES[i].adlib ? fs * 0.6 : 0));
      const cum = [0]; for (const h of hs) cum.push(cum[cum.length - 1] + h);
      const cur = Math.max(0, Song.lastStarted(t));
      const anchor = portrait ? H * 0.34 : H * 0.36;
      const at = (a) => { const i = clamp(Math.floor(a), 0, LINES.length - 1); return cum[i] + (a - i) * hs[i]; };
      for (let j = 0; j < LINES.length; j++) {
        const delay = 0.045 * Math.min(Math.abs(j - cur), 6);
        let a = -1;
        for (const L of LINES) a += ease((t - delay - L.start + 0.3) / 0.65);
        a = Math.max(0, a);
        const y = anchor + cum[j] - at(a);
        if (y < -H * 0.3 || y > H * 1.2) continue;
        const L = LINES[j], dist = Math.abs(j - a);
        const active = t >= L.start - 0.03 && t <= L.end + 0.5 && j === cur;
        ctx.save();
        if (!active && HAS_FILTER && !REDUCED) ctx.filter = `blur(${Math.min(dist, 4) * 1.1}px)`;
        ctx.globalAlpha = active ? 1 : clamp(0.42 - dist * 0.06, 0.08, 0.42);
        ctx.font = font; ctx.textBaseline = 'alphabetic';
        const right = L.singer === 'B';
        layouts[j].forEach((row, r) => {
          const rx = right ? W - x0 - row.width : x0;
          const ry = y + (r + 1) * fs * 1.12;
          for (const it of row.items) {
            const w = it.w, p = active ? Song.wordP(w, t) : t > w.e ? 1 : 0;
            const held = w.e - w.s > 1.0;
            const lift = -fs * 0.06 * ease(p * 3);
            if (!active) { ctx.fillStyle = '#fff'; ctx.fillText(w.text, rx + it.x, ry); continue; }
            ctx.fillStyle = 'rgba(255,255,255,0.34)'; ctx.fillText(w.text, rx + it.x, ry + lift);
            if (p <= 0) continue;
            if (held) {
              let lx = rx + it.x;
              for (let c = 0; c < w.text.length; c++) {
                const ch = w.text[c], cw = ctx.measureText(ch).width;
                const q = ease((t - w.s - c * 0.07) / 0.35);
                ctx.save();
                ctx.shadowColor = 'rgba(255,240,220,0.9)'; ctx.shadowBlur = fs * 0.35 * Math.sin(Math.PI * p);
                ctx.fillStyle = `rgba(255,255,255,${0.34 + 0.66 * q})`;
                ctx.fillText(ch, lx, ry + lift - fs * 0.08 * q * (1 - p * 0.5));
                ctx.restore();
                lx += cw;
              }
            } else {
              const edge = p * 1.3 - 0.15;
              const g = ctx.createLinearGradient(rx + it.x, 0, rx + it.x + it.width, 0);
              g.addColorStop(0, '#fff'); g.addColorStop(clamp(edge, 0, 1), '#fff'); g.addColorStop(clamp(edge + 0.15, 0, 1), 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0)');
              ctx.fillStyle = g; ctx.fillText(w.text, rx + it.x, ry + lift);
            }
          }
        });
        if (L.adlib && active) {
          const ad = L.adlib, q = clamp((t - ad.s) / (ad.e - ad.s), 0, 1);
          ctx.font = FONT.ui(700, fs * 0.5);
          const ay = y + layouts[j].length * fs * 1.12 + fs * 0.62;
          const aw = ctx.measureText(ad.text).width;
          const ax = right ? W - x0 - aw : x0;
          ctx.globalAlpha = smooth(ad.s - 0.4, ad.s, t);
          wipeWord(ctx, ad.text, ax, ay, q, 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.85)', 0);
        }
        ctx.restore();
      }
      // breathing dots in gaps
      const next = LINES.find((L) => L.start > t);
      const prev = [...LINES].reverse().find((L) => L.start <= t);
      const gapStart = prev ? prev.end + 0.4 : 0;
      if (next && next.start - gapStart > 2.5 && t > gapStart && t < next.start - 0.2) {
        const q = (t - gapStart) / (next.start - 0.2 - gapStart);
        const y = anchor - fs * 0.2;
        for (let k = 0; k < 3; k++) {
          const f = clamp(q * 3 - k, 0, 1), r = fs * 0.16 * (1 + 0.12 * Math.sin(t * 4 + k));
          ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.75 * f})`;
          ctx.beginPath(); ctx.arc(x0 + r + k * r * 3, y, r, 0, TAU); ctx.fill();
        }
      }
    },
  });

  // 2. Swatch: cover-colour card
  look({
    id: 'swatch', name: 'Swatch', family: 'Streaming lyric views', from: 'Cover-colour lyric cards (Spotify, Deezer, TIDAL)', phase: 'B',
    what: 'One flat colour taken from the cover, tone-on-tone lines that snap up one at a time, the translation under the sung line, and a small looping tile cut from the cover.',
    draw(ctx, W, H, t) {
      bg(ctx, W, H, '#c8435a');
      const portrait = H > W;
      const tile = Math.min(W, H) * (portrait ? 0.3 : 0.24);
      const tx = W - tile - W * 0.06, ty = H * 0.07;
      const u = 1 - Math.abs(((t / 4) % 2) - 1);
      ctx.save(); roundRect(ctx, tx, ty, tile, tile, tile * 0.08); ctx.clip();
      coverFill(ctx, tx, ty, tile, tile, 1.6 + 0.2 * u, u, 0.3 + 0.4 * u); ctx.restore();
      ctx.font = FONT.ui(600, Math.max(11, tile * 0.08)); ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(TITLE, W * 0.06, ty + tile * 0.2);
      ctx.fillStyle = 'rgba(60,8,24,0.6)'; ctx.fillText(ARTIST, W * 0.06, ty + tile * 0.2 + tile * 0.11);
      const fs = portrait ? W * 0.074 : Math.min(H * 0.072, W * 0.048);
      const x0 = W * 0.06, maxW = portrait ? W * 0.88 : W * 0.62, font = FONT.ui(800, fs);
      const top = ty + tile + H * 0.06 + fs * 1.6;
      const cur = Song.lastStarted(t);
      let a = -1; for (const L of LINES) a += ease((t - L.start + 0.05) / 0.28);
      const rowsAll = LINES.map((L) => layoutWords(ctx, L.words, font, maxW));
      const hs = rowsAll.map((r, i) => r.length * fs * 1.1 + fs * 0.5 + (i === cur ? fs * 0.75 : 0));
      let y = top - (() => { let s = 0; const i = Math.max(0, Math.floor(a)); for (let k = 0; k < i; k++) s += hs[k]; return s + (a - Math.floor(a)) * (hs[i] || 0); })();
      ctx.save(); ctx.beginPath(); ctx.rect(0, ty + tile + H * 0.04, W, H); ctx.clip();
      for (let j = 0; j < LINES.length; j++) {
        const L = LINES[j];
        if (y > H) break;
        if (y + hs[j] > top - fs) {
          ctx.font = font;
          ctx.fillStyle = j < cur ? 'rgba(255,255,255,0.72)' : j === cur ? '#fff' : 'rgba(58,6,22,0.62)';
          rowsAll[j].forEach((row, r) => { for (const it of row.items) ctx.fillText(it.w.text, x0 + it.x, y + (r + 1) * fs * 1.1); });
          if (j === cur) {
            ctx.font = FONT.ui(500, fs * 0.42); ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillText(L.sub, x0, y + rowsAll[j].length * fs * 1.1 + fs * 0.62);
          }
        }
        y += hs[j];
      }
      ctx.restore();
      const fadeTop = ty + tile + H * 0.04, fade = ctx.createLinearGradient(0, fadeTop, 0, fadeTop + fs * 1.4);
      fade.addColorStop(0, '#c8435a'); fade.addColorStop(1, 'rgba(200,67,90,0)');
      ctx.fillStyle = fade; ctx.fillRect(0, fadeTop, W, fs * 1.4);
    },
  });

  // 3. Sleeve: artwork beside lyrics
  look({
    id: 'sleeve', name: 'Sleeve', family: 'Streaming lyric views', from: 'Artwork-beside-lyrics views (YouTube Music on TV, landscape lyric views)', phase: 'D',
    what: 'The cover as a record sleeve that breathes and tilts with the beat, a disc peeking out, and the lyric set beside it like a liner note with the sung line underlined.',
    draw(ctx, W, H, t) {
      const B = Song.beat(t);
      const g = ctx.createRadialGradient(W * 0.3, H * 0.4, 0, W * 0.3, H * 0.4, Math.max(W, H));
      g.addColorStop(0, '#3a1d4a'); g.addColorStop(1, '#120818');
      bg(ctx, W, H, '#120818'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const portrait = H > W;
      const S = portrait ? W * 0.6 : H * 0.6;
      const sx = portrait ? (W - S) / 2 - S * 0.08 : W * 0.07, sy = portrait ? H * 0.08 : (H - S) / 2;
      // disc
      ctx.save(); ctx.translate(sx + S * 0.62, sy + S / 2); ctx.rotate(t * 1.2);
      ctx.fillStyle = '#0b0b0d'; ctx.beginPath(); ctx.arc(0, 0, S * 0.47, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; for (let r = S * 0.18; r < S * 0.46; r += S * 0.018) { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); }
      ctx.fillStyle = PAL.coral; ctx.beginPath(); ctx.arc(0, 0, S * 0.14, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0b0b0d'; ctx.beginPath(); ctx.arc(0, 0, S * 0.012, 0, TAU); ctx.fill();
      ctx.restore();
      // sleeve
      const k = 1 + 0.012 * B.env;
      ctx.save(); ctx.translate(sx + S / 2, sy + S / 2); ctx.transform(k, 0.035 * Math.sin(t * 0.5), -0.03 * Math.cos(t * 0.43), k, 0, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.moveTo(-S / 2, S / 2); ctx.lineTo(S / 2, S / 2); ctx.lineTo(S / 2 + S * 0.3, S / 2 + S * 0.22); ctx.lineTo(-S / 2 + S * 0.3, S / 2 + S * 0.22); ctx.fill();
      ctx.drawImage(cover, -S / 2, -S / 2, S, S);
      const sh = ctx.createLinearGradient(-S / 2, -S / 2, S / 2, S / 2); sh.addColorStop(0, 'rgba(255,255,255,0.18)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,0.2)');
      ctx.fillStyle = sh; ctx.fillRect(-S / 2, -S / 2, S, S);
      ctx.restore();
      // liner column
      const cx = portrait ? W * 0.1 : sx + S * 1.22, cw = portrait ? W * 0.8 : W - cx - W * 0.06;
      const top = portrait ? sy + S + H * 0.08 : H * 0.2;
      const fs = portrait ? W * 0.062 : Math.min(H * 0.06, cw * 0.075);
      const cur = Math.max(0, Song.lastStarted(t));
      const first = clamp(cur - 1, 0, LINES.length - 1);
      let y = top;
      for (let j = first; j < Math.min(LINES.length, first + (portrait ? 5 : 6)); j++) {
        const L = LINES[j];
        ctx.font = FONT.mono(500, fs * 0.36); ctx.fillStyle = 'rgba(255,244,230,0.4)';
        ctx.fillText(String(j + 1).padStart(2, '0'), cx, y + fs * 0.8);
        const rows = layoutWords(ctx, L.words, FONT.serif(fs), cw - fs);
        ctx.font = FONT.serif(fs);
        ctx.fillStyle = j === cur ? '#fff4e6' : 'rgba(255,244,230,0.38)';
        rows.forEach((row, r) => { for (const it of row.items) ctx.fillText(it.w.text, cx + fs * 0.9 + it.x, y + fs * 0.9 + r * fs * 1.1); });
        if (j === cur) {
          const lc = Song.lineAt(t);
          const p = lc && lc.L === L ? clamp((t - L.start) / (L.end - L.start), 0, 1) : t > L.end ? 1 : 0;
          const last = rows[rows.length - 1];
          ctx.fillStyle = PAL.coral; ctx.fillRect(cx + fs * 0.9, y + fs * 1.1 + (rows.length - 1) * fs * 1.1, last.width * p, Math.max(2, fs * 0.05));
        }
        y += rows.length * fs * 1.1 + fs * 0.55;
      }
    },
  });

  // 4. Platter: turntable
  look({
    id: 'platter', name: 'Platter', family: 'Streaming lyric views', from: 'Spinning-record players (NetEase Cloud Music, QQ Music)', phase: 'D',
    what: 'A turntable from above: the cover is the label, the tonearm walks inward as the song plays, grooves catch light on the beat, and the sung line curls around the label before settling.',
    draw(ctx, W, H, t) {
      const B = Song.beat(t);
      bg(ctx, W, H, '#17141c');
      const portrait = H > W;
      const R = portrait ? W * 0.4 : H * 0.4;
      const cx = portrait ? W * 0.5 : W * 0.36, cy = portrait ? H * 0.36 : H * 0.5;
      ctx.fillStyle = '#221e29'; roundRect(ctx, cx - R * 1.2, cy - R * 1.15, R * 2.6, R * 2.3, R * 0.08); ctx.fill();
      const rot = t * 0.95;
      ctx.save(); ctx.translate(cx, cy);
      ctx.fillStyle = '#070708'; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
      for (let r = R * 0.36; r < R * 0.98; r += R * 0.012) { ctx.strokeStyle = `rgba(255,255,255,${0.025 + 0.02 * hash(r)})`; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); }
      if (ctx.createConicGradient) {
        const cg = ctx.createConicGradient(-0.6, 0, 0);
        const a = 0.07 + 0.12 * B.env;
        cg.addColorStop(0, 'rgba(255,255,255,0)'); cg.addColorStop(0.08, `rgba(255,255,255,${a})`); cg.addColorStop(0.16, 'rgba(255,255,255,0)');
        cg.addColorStop(0.5, 'rgba(255,255,255,0)'); cg.addColorStop(0.58, `rgba(255,255,255,${a})`); cg.addColorStop(0.66, 'rgba(255,255,255,0)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.arc(0, 0, R * 0.34, 0, TAU, true); ctx.fill();
      }
      ctx.save(); ctx.rotate(rot); ctx.beginPath(); ctx.arc(0, 0, R * 0.33, 0, TAU); ctx.clip(); ctx.drawImage(cover, -R * 0.33, -R * 0.33, R * 0.66, R * 0.66); ctx.restore();
      ctx.fillStyle = '#c9c4d1'; ctx.beginPath(); ctx.arc(0, 0, R * 0.02, 0, TAU); ctx.fill();
      // curved line around the label
      const lc = Song.lineAt(t);
      if (lc) {
        const L = lc.L, fs = R * 0.085, rr = R * 0.33 + fs * 0.75;
        ctx.font = FONT.grot(700, fs);
        const settle = ease(lc.age / 1.1);
        const full = ctx.measureText(L.text).width;
        let ang = -Math.PI / 2 - (full / rr) / 2 + (1 - settle) * 1.8;
        for (const w of L.words) {
          const p = Song.wordP(w, t);
          for (const ch of w.text + ' ') {
            const cw = ctx.measureText(ch).width;
            ctx.save(); ctx.rotate(ang + cw / rr / 2); ctx.translate(0, -rr);
            ctx.fillStyle = p > 0 ? '#fff4e6' : 'rgba(255,244,230,0.35)'; ctx.globalAlpha = clamp(lc.age / 0.3, 0, 1) * (1 - smooth(0.92, 1, lc.p));
            ctx.textAlign = 'center'; ctx.fillText(ch, 0, 0); ctx.restore();
            ang += cw / rr;
          }
        }
      }
      ctx.restore();
      // tonearm walks inward over the song
      const prog = clamp(t / DURATION, 0, 1);
      const px = cx + R * 1.02, py = cy - R * 0.9;
      const sr = lerp(R * 0.95, R * 0.42, prog), sa = lerp(2.2, 2.55, prog);
      const tx = cx + Math.cos(sa) * sr * -1 + R * 0.05, ty = cy + Math.sin(sa) * sr * 0.4;
      ctx.strokeStyle = '#d6d1dd'; ctx.lineWidth = R * 0.025; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx + R * 0.1, ty - R * 0.05); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.fillStyle = '#d6d1dd'; ctx.beginPath(); ctx.arc(px, py, R * 0.07, 0, TAU); ctx.fill();
      // plain readable line
      if (lc) {
        const fs = portrait ? W * 0.06 : Math.min(H * 0.065, W * 0.04);
        const lx = portrait ? W * 0.08 : cx + R * 1.5, maxW = portrait ? W * 0.84 : W - lx - W * 0.04;
        const rows = layoutWords(ctx, lc.L.words, FONT.ui(700, fs), maxW);
        const ly = portrait ? cy + R * 1.35 : cy - rows.length * fs * 0.6;
        ctx.font = FONT.ui(700, fs);
        rows.forEach((row, r) => { for (const it of row.items) { ctx.fillStyle = t >= it.w.s ? '#fff' : 'rgba(255,255,255,0.32)'; ctx.fillText(it.w.text, lx + it.x, ly + (r + 1) * fs * 1.2); } });
      }
    },
  });

  // 5. Strip: desktop lyric bar
  look({
    id: 'strip', name: 'Strip', family: 'Streaming lyric views', from: 'Desktop lyric bars and floating lyrics (Kugou, NetEase, Musixmatch FloatingLyrics)', phase: 'D',
    what: 'Two staggered outlined lines in a see-through strip over a desktop; each word fills with a gradient as it is sung. Meant for Lyricscape’s floating window, OBS overlay and wallpaper.',
    draw(ctx, W, H, t) {
      // wallpaper: the cover art, softly out of focus, drifting
      const wall = (blur) => { ctx.save(); if (HAS_FILTER) ctx.filter = `blur(${blur}px) saturate(1.15)`; coverFill(ctx, -W * 0.05, -H * 0.05, W * 1.1, H * 1.1, 1.15 + 0.02 * Math.sin(t * 0.1), 0.5 + 0.02 * Math.sin(t * 0.07), 0.45); ctx.restore(); };
      wall(Math.min(W, H) * 0.02);
      ctx.fillStyle = 'rgba(8,6,14,0.28)'; ctx.fillRect(0, 0, W, H);
      const fs = H > W ? W * 0.066 : Math.min(H * 0.065, W * 0.04);
      const sy = H * 0.68, sh = fs * 3.4, sx = W * 0.05, sw = W * 0.9;
      // frosted glass bar: blurred wallpaper inside, soft shadow under, hairline highlight on top
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = fs * 1.6; ctx.shadowOffsetY = fs * 0.4; ctx.fillStyle = 'rgba(20,16,30,0.6)'; roundRect(ctx, sx, sy, sw, sh, fs * 0.7); ctx.fill(); ctx.restore();
      ctx.save(); roundRect(ctx, sx, sy, sw, sh, fs * 0.7); ctx.clip(); wall(Math.min(W, H) * 0.06); ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(sx, sy, sw, sh);
      const hl = ctx.createLinearGradient(0, sy, 0, sy + sh); hl.addColorStop(0, 'rgba(255,255,255,0.16)'); hl.addColorStop(0.4, 'rgba(255,255,255,0)'); ctx.fillStyle = hl; ctx.fillRect(sx, sy, sw, sh); ctx.restore();
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1; roundRect(ctx, sx + 0.5, sy + 0.5, sw - 1, sh - 1, fs * 0.7); ctx.stroke(); ctx.restore();
      const cur = Math.max(0, Song.lastStarted(t));
      const rowFor = (j) => j % 2;
      const sungGrad = (x, w) => { const gg = ctx.createLinearGradient(x, 0, x + w, 0); gg.addColorStop(0, '#ff7ab6'); gg.addColorStop(1, '#ffd23f'); return gg; };
      for (const j of [cur, cur + 1]) {
        const L = LINES[j]; if (!L) continue;
        const r = rowFor(j);
        ctx.font = FONT.ui(800, fs);
        const tw = ctx.measureText(L.text).width;
        const scale = Math.min(1, (sw - fs * 1.2) / tw);
        ctx.save();
        const x = r === 0 ? sx + fs * 0.6 : sx + sw - fs * 0.6 - tw * scale;
        const y = sy + fs * 1.3 + r * fs * 1.45;
        ctx.translate(x, y); ctx.scale(scale, scale);
        ctx.globalAlpha = j === cur ? 1 : 0.85;
        let wx = 0;
        for (const w of L.words) {
          const p = j === cur ? Song.wordP(w, t) : 0;
          const ww = ctx.measureText(w.text).width;
          wipeWord(ctx, w.text, wx, 0, p, 'rgba(255,255,255,0.92)', sungGrad(wx, ww), 0);
          wx += ww + ctx.measureText(' ').width;
        }
        ctx.restore();
      }
      const L = LINES[cur];
      const p = L ? clamp((t - L.start) / (L.end - L.start), 0, 1) : 0;
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(sx + fs * 0.6, sy + sh - fs * 0.35, sw - fs * 1.2, 2);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(sx + fs * 0.6, sy + sh - fs * 0.35, (sw - fs * 1.2) * p, 2);
    },
  });

  // 6. Marginalia: annotated page and quote cards
  look({
    id: 'marginalia', name: 'Marginalia', family: 'Streaming lyric views', from: 'Annotated lyrics and quote cards (Genius)', phase: 'D',
    what: 'Verses are set like a printed page: a marker sweeps across a key phrase and a handwritten margin note draws itself. Chorus lines turn into quote cards over a tinted cover.',
    draw(ctx, W, H, t) {
      const sec = Song.section(t);
      const portrait = H > W;
      const lc = Song.lineAt(t);
      if (sec.name === 'Chorus' || sec.name === 'Outro') {
        ctx.drawImage(cover, 0, 0, 1, 1, 0, 0, 0, 0);
        coverFill(ctx, 0, 0, W, H, 1.15 + 0.05 * Math.sin(t * 0.2));
        ctx.save(); ctx.globalCompositeOperation = 'color'; ctx.fillStyle = '#3b2a7a'; ctx.fillRect(0, 0, W, H); ctx.restore();
        ctx.fillStyle = 'rgba(20,10,40,0.35)'; ctx.fillRect(0, 0, W, H);
        const L = lc ? lc.L : LINES[Math.max(0, Song.lastStarted(t))];
        const fs = portrait ? W * 0.085 : Math.min(H * 0.1, W * 0.06);
        const rows = layoutWords(ctx, L.words, FONT.serif(fs, true), W * (portrait ? 0.78 : 0.55));
        let y = H * (portrait ? 0.6 : 0.55) - rows.length * fs * 0.7;
        const x = W * 0.08;
        rows.forEach((row) => {
          const shown = row.items.filter((it) => t >= it.w.s - 0.05);
          if (!shown.length) { y += fs * 1.35; return; }
          const last = shown[shown.length - 1];
          const wide = last.x + last.width;
          ctx.fillStyle = '#fbfaf7'; ctx.fillRect(x - fs * 0.25, y - fs * 0.92, wide + fs * 0.5, fs * 1.22);
          ctx.font = FONT.serif(fs, true); ctx.fillStyle = '#16121f';
          for (const it of shown) ctx.fillText(it.w.text, x + it.x, y);
          y += fs * 1.35;
        });
        ctx.font = FONT.mono(500, Math.max(10, fs * 0.28)); ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(`${TITLE.toUpperCase()}  ·  ${ARTIST.toUpperCase()}`, x, y + fs * 0.3);
        return;
      }
      bg(ctx, W, H, '#fbfbf8');
      const fs = portrait ? W * 0.058 : Math.min(H * 0.058, W * 0.036);
      const lh = fs * 1.75;
      ctx.strokeStyle = 'rgba(80,130,200,0.18)'; ctx.lineWidth = 1;
      for (let y = lh; y < H; y += lh) { ctx.beginPath(); ctx.moveTo(0, y + fs * 0.35); ctx.lineTo(W, y + fs * 0.35); ctx.stroke(); }
      const mx = W * (portrait ? 0.1 : 0.12);
      ctx.strokeStyle = 'rgba(220,70,70,0.35)'; ctx.beginPath(); ctx.moveTo(mx - fs * 0.5, 0); ctx.lineTo(mx - fs * 0.5, H); ctx.stroke();
      const stanza = LINES.filter((L) => L.section === sec.i);
      const show = stanza.length ? stanza : LINES.filter((L) => L.section === 1);
      const textW = portrait ? W * 0.82 : W * 0.5;
      let y = lh * 2;
      for (const L of show) {
        const rows = layoutWords(ctx, L.words, FONT.serif(fs), textW);
        const note = NOTES[L.i];
        rows.forEach((row, r) => {
          const ry = y + r * lh;
          for (const it of row.items) {
            const w = it.w;
            if (note && w.k >= note[0] && w.k <= note[1]) {
              const sw = ease((t - L.words[note[0]].s) / 0.6);
              if (sw > 0) { ctx.fillStyle = 'rgba(255,214,10,0.55)'; ctx.fillRect(mx + it.x - 3, ry - fs * 0.78, (it.width + fs * 0.3) * clamp(sw * (note[1] - note[0] + 1) - (w.k - note[0]), 0, 1), fs * 1.0); }
            }
            ctx.font = FONT.serif(fs);
            ctx.fillStyle = t >= w.s ? '#17131f' : 'rgba(23,19,31,0.3)';
            ctx.fillText(w.text, mx + it.x, ry);
          }
        });
        if (note && t >= L.words[note[0]].s) {
          const q = ease((t - L.words[note[0]].s - 0.3) / 1.0);
          const nx = portrait ? mx : mx + textW + W * 0.04, ny = portrait ? H * 0.82 : y - fs * 0.2;
          ctx.font = FONT.marker(fs * 0.62);
          const nw = ctx.measureText(note[2]).width;
          ctx.save(); ctx.beginPath(); ctx.rect(nx - 4, ny - fs, (nw + 8) * q, fs * 1.6); ctx.clip();
          ctx.fillStyle = '#c0392b'; ctx.fillText(note[2], nx, ny); ctx.restore();
          ctx.strokeStyle = `rgba(192,57,43,${0.7 * q})`; ctx.lineWidth = 1.5;
          const firstRow = rows[0];
          const ax = mx + Math.min(firstRow.width, textW), ay = y - fs * 0.3;
          ctx.beginPath(); ctx.moveTo(ax + 6, ay); ctx.quadraticCurveTo((ax + nx) / 2, ay - fs * 0.8, nx - 6, ny - fs * 0.25); if (!portrait) ctx.stroke();
        }
        y += rows.length * lh + lh * 0.25;
      }
      ctx.font = FONT.mono(500, Math.max(10, fs * 0.32)); ctx.fillStyle = 'rgba(23,19,31,0.45)';
      ctx.fillText(`${sec.name.toUpperCase()} — ${TITLE}`, mx, lh * 0.9);
    },
  });

  // 7. Sticker: three registers
  look({
    id: 'sticker', name: 'Sticker', family: 'Social and creator apps', from: 'Music sticker lyrics (Instagram Stories and Reels)', phase: 'B',
    what: 'A lyric sticker over a drifting, blurred cover that changes register at each section: rolling teleprompter in verse 1, a packed billboard in the chorus, a typewriter in verse 2.',
    draw(ctx, W, H, t) {
      ctx.save(); if (HAS_FILTER) ctx.filter = 'blur(14px) saturate(1.2)';
      coverFill(ctx, -40, -40, W + 80, H + 80, 1.1, 0.5 + 0.1 * Math.sin(t * 0.15), 0.5 + 0.1 * Math.cos(t * 0.12)); ctx.restore();
      ctx.fillStyle = 'rgba(10,5,20,0.25)'; ctx.fillRect(0, 0, W, H);
      const sec = Song.section(t), lc = Song.lineAt(t), portrait = H > W;
      const reg = sec.name === 'Chorus' ? 'billboard' : sec.name === 'Verse 2' ? 'typewriter' : 'prompter';
      const cw = portrait ? W * 0.84 : Math.min(W * 0.56, H * 1.0), cx = W / 2;
      if (reg === 'billboard') {
        if (!lc) return;
        const w = Song.curWord(lc.L, t); if (!w) return;
        const txt = w.text.replace(/[,]/g, '').toUpperCase();
        const fs = fit(ctx, txt, FONT.anton, W * 0.86, H * 0.42);
        const col = [PAL.sun, PAL.teal, PAL.coral, PAL.pink][w.k % 4];
        ctx.font = FONT.anton(fs);
        const tw = ctx.measureText(txt).width;
        const pop = 0.9 + 0.1 * easeBack((t - w.s) / 0.18);
        ctx.save(); ctx.translate(cx, H * 0.52); ctx.scale(pop, pop); ctx.rotate(((w.k % 2) - 0.5) * 0.06);
        ctx.fillStyle = col; ctx.fillRect(-tw / 2 - fs * 0.08, -fs * 0.62, tw + fs * 0.16, fs * 1.1);
        ctx.fillStyle = PAL.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 0, -fs * 0.04);
        ctx.restore();
        return;
      }
      const ch = portrait ? H * 0.3 : H * 0.42;
      ctx.save(); ctx.translate(cx, H * 0.5); ctx.rotate(-0.035);
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
      ctx.fillStyle = reg === 'typewriter' ? '#14121a' : 'rgba(255,255,255,0.94)';
      roundRect(ctx, -cw / 2, -ch / 2, cw, ch, 22); ctx.fill(); ctx.shadowColor = 'transparent';
      ctx.font = FONT.ui(700, Math.max(10, cw * 0.028)); ctx.fillStyle = reg === 'typewriter' ? 'rgba(255,255,255,0.5)' : 'rgba(20,10,30,0.45)';
      ctx.fillText(`♪ ${TITLE} · ${ARTIST}`, -cw / 2 + cw * 0.06, -ch / 2 + cw * 0.075);
      const fs = cw * 0.06;
      if (reg === 'typewriter') {
        if (lc) {
          ctx.font = FONT.mono(600, fs * 0.92);
          let shown = '';
          for (const w of lc.L.words) { const p = Song.wordP(w, t); if (t < w.s) break; shown += w.text.slice(0, Math.ceil(w.text.length * clamp(p * 2.2, 0, 1))) + (p > 0.45 ? ' ' : ''); }
          const rows = []; let row = '';
          for (const word of shown.split(' ')) { if (ctx.measureText(row + word).width > cw * 0.84) { rows.push(row); row = ''; } row += word + ' '; }
          rows.push(row);
          rows.forEach((r, i) => { ctx.fillStyle = '#f2eff7'; ctx.fillText(r.trimEnd(), -cw * 0.42, -ch * 0.05 + i * fs * 1.3); });
          const last = rows[rows.length - 1].trimEnd();
          if (Math.floor(t * 2.4) % 2 === 0) { ctx.fillStyle = PAL.sun; ctx.fillRect(-cw * 0.42 + ctx.measureText(last).width + 4, -ch * 0.05 + (rows.length - 1) * fs * 1.3 - fs * 0.8, fs * 0.5, fs * 0.95); }
        }
      } else {
        const cur = Math.max(0, Song.lastStarted(t));
        for (let d = -1; d <= 1; d++) {
          const L = LINES[cur + d]; if (!L) continue;
          const f = d === 0 ? fs : fs * 0.72;
          ctx.font = FONT.ui(d === 0 ? 800 : 600, f);
          const sc = Math.min(1, cw * 0.86 / ctx.measureText(L.text).width);
          ctx.save(); ctx.translate(-cw * 0.43, d * fs * 1.35 + fs * 0.25); ctx.scale(sc, sc);
          if (d === 0) { let x = 0; for (const w of L.words) { ctx.fillStyle = t >= w.s ? '#15101e' : 'rgba(21,16,30,0.35)'; ctx.fillText(w.text, x, 0); x += ctx.measureText(w.text + ' ').width; } }
          else { ctx.fillStyle = 'rgba(21,16,30,0.3)'; ctx.fillText(L.text, 0, 0); }
          ctx.restore();
        }
      }
      ctx.restore();
    },
  });

  // 8. Punch: caption edits
  look({
    id: 'punch', name: 'Punch', family: 'Social and creator apps', from: 'Caption edits (TikTok, CapCut auto-lyrics, Reels)', phase: 'A',
    what: 'Two or three words at a time, heavy and outlined; the sung word jumps and turns yellow. Behind, crops of the cover cut on every beat with a zoom punch and a short shake (off with reduced motion).',
    draw(ctx, W, H, t) {
      const B = Song.beat(t);
      const zoom = 1.7 + 0.6 * hash(B.i * 3.1) + (REDUCED ? 0 : 0.08 * B.env);
      const sx = REDUCED ? 0 : (hash(B.i + t * 30) - 0.5) * 10 * B.barEnv, sy = REDUCED ? 0 : (hash(B.i * 2 + t * 40) - 0.5) * 10 * B.barEnv;
      ctx.save(); ctx.translate(sx, sy);
      coverFill(ctx, -12, -12, W + 24, H + 24, zoom, hash(B.i * 1.7), hash(B.i * 2.9));
      ctx.restore();
      ctx.fillStyle = 'rgba(8,4,14,0.38)'; ctx.fillRect(0, 0, W, H);
      if (!REDUCED && B.barEnv > 0) { ctx.fillStyle = `rgba(255,255,255,${0.16 * B.barEnv})`; ctx.fillRect(0, 0, W, H); }
      const lc = Song.lineAt(t); if (!lc) return;
      const words = lc.L.words, groups = [];
      let g = [];
      for (const w of words) { const len = g.reduce((a, x) => a + x.text.length, 0); if (g.length && (g.length >= 3 || len + w.text.length > 13)) { groups.push(g); g = []; } g.push(w); }
      if (g.length) groups.push(g);
      const cw = Song.curWord(lc.L, t);
      const grp = groups.find((gr) => cw && gr.includes(cw)) || groups[0];
      const label = grp.map((w) => w.text.toUpperCase()).join(' ');
      const fs = fit(ctx, label, FONT.anton, W * 0.86, Math.min(W, H) * 0.17);
      ctx.font = FONT.anton(fs);
      const space = ctx.measureText(' ').width;
      const total = grp.reduce((a, w) => a + ctx.measureText(w.text.toUpperCase()).width, 0) + space * (grp.length - 1);
      const enter = 0.85 + 0.15 * easeBack((t - grp[0].s) / 0.16);
      ctx.save(); ctx.translate(W / 2, H * (H > W ? 0.62 : 0.58)); ctx.scale(enter, enter);
      let x = -total / 2;
      ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      for (const w of grp) {
        const s = w.text.toUpperCase(), ww = ctx.measureText(s).width;
        const on = cw === w, k = on ? 1 + 0.18 * (1 - ease((t - w.s) / 0.14)) : 1;
        ctx.save(); ctx.translate(x + ww / 2, 0); ctx.scale(k, k);
        ctx.lineWidth = fs * 0.14; ctx.strokeStyle = '#0a0610'; ctx.strokeText(s, -ww / 2, 0);
        ctx.fillStyle = on ? PAL.sun : t >= w.s ? '#ffffff' : 'rgba(255,255,255,0.88)'; ctx.fillText(s, -ww / 2, 0);
        ctx.restore();
        x += ww + space;
      }
      ctx.restore();
    },
  });

  // 9. Recap: story cards
  const RECAP = [['#ff6f59', '#2b1641', '#ffd23f'], ['#2ec4b6', '#14081f', '#fff4e6'], ['#ffd23f', '#2b1641', '#ff6f59'], ['#2b1641', '#ff9fb2', '#2ec4b6'], ['#ff9fb2', '#2b1641', '#2ec4b6']];
  look({
    id: 'recap', name: 'Recap', family: 'Social and creator apps', from: 'Year-in-review story cards (Spotify Wrapped, Apple Music Replay)', phase: 'C',
    what: 'Every line is a story card: flat colours, big shapes that slide in and bounce on the beat, the key word huge, the rest of the line in a pill, and story progress bars on top.',
    draw(ctx, W, H, t) {
      const B = Song.beat(t);
      const cur = Math.max(0, Song.lastStarted(t)), L = LINES[cur];
      const [c0, c1, c2] = RECAP[cur % RECAP.length];
      bg(ctx, W, H, c0);
      const age = t - L.start, inn = ease(age / 0.45), m = Math.min(W, H), bounce = 1 + 0.05 * B.env;
      const comp = cur % 4;
      ctx.fillStyle = c1;
      if (comp === 0) { ctx.beginPath(); ctx.arc(W * 0.78, lerp(-m * 0.5, H * 0.3, inn), m * 0.42 * bounce, 0, TAU); ctx.fill(); ctx.fillStyle = c2; ctx.fillRect(lerp(-W, 0, inn), H * 0.78, W * 0.7, m * 0.12); }
      if (comp === 1) { for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? c2 : c1; ctx.fillRect(lerp(W, W * (0.1 + k * 0.08), ease((age - k * 0.06) / 0.45)), H * (0.12 + k * 0.2), W, m * 0.14 * bounce); } }
      if (comp === 2) { ctx.beginPath(); ctx.arc(W / 2, H + m * 0.1, lerp(0, m * 0.7, inn) * bounce, Math.PI, TAU); ctx.fill(); ctx.fillStyle = c2; ctx.beginPath(); ctx.arc(W * 0.2, H * 0.2, m * 0.1 * bounce, 0, TAU); ctx.fill(); }
      if (comp === 3) { ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(lerp(-0.6, -0.2, inn)); for (let k = -6; k < 7; k++) { ctx.fillStyle = k % 2 ? c1 : c2; ctx.fillRect(k * m * 0.16, -m * 1.5, m * 0.08 * bounce, m * 3); } ctx.restore(); }
      const sec = Song.section(t), inSec = LINES.filter((x) => x.section === sec.i);
      const segs = inSec.length || 1, gap = 6, bw = (W * 0.9 - gap * (segs - 1)) / segs;
      inSec.forEach((x, k) => {
        const p = x.i < cur ? 1 : x.i > cur ? 0 : clamp((t - x.start) / (8 * BEAT), 0, 1);
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; roundRect(ctx, W * 0.05 + k * (bw + gap), H * 0.04, bw, 4, 2); ctx.fill();
        ctx.fillStyle = '#fff'; roundRect(ctx, W * 0.05 + k * (bw + gap), H * 0.04, bw * p, 4, 2); ctx.fill();
      });
      const key = L.words.reduce((a, w) => (w.text.replace(/\W/g, '').length > a.text.replace(/\W/g, '').length ? w : a), L.words[0]);
      const rest = L.words.filter((w) => w !== key);
      const ktxt = key.text.replace(/\W/g, '').toUpperCase();
      const fs = fit(ctx, ktxt, FONT.anton, W * 0.86, H * 0.3);
      if (t >= key.s - 0.05) {
        const pop = easeBack((t - key.s) / 0.25);
        ctx.save(); ctx.translate(W * 0.07, H * 0.62); ctx.scale(pop, pop);
        ctx.font = FONT.anton(fs); ctx.fillStyle = c1 === '#2b1641' || c1 === '#14081f' ? '#fff4e6' : '#14081f';
        ctx.lineWidth = fs * 0.06; ctx.strokeStyle = c1; ctx.strokeText(ktxt, 0, 0); ctx.fillText(ktxt, 0, 0); ctx.restore();
      }
      const small = Math.max(12, Math.min(W, H) * 0.045);
      ctx.font = FONT.ui(800, small);
      const shown = rest.filter((w) => t >= w.s).map((w) => w.text).join(' ');
      if (shown) {
        const tw = Math.min(ctx.measureText(shown).width, W * 0.8);
        ctx.fillStyle = '#14081f'; roundRect(ctx, W * 0.07, H * 0.62 - fs - small * 2.2, tw + small * 1.2, small * 1.7, small * 0.85); ctx.fill();
        ctx.fillStyle = '#fff4e6'; ctx.fillText(shown, W * 0.07 + small * 0.6, H * 0.62 - fs - small * 0.95, W * 0.8);
      }
    },
  });

  // 10. Kinetic: block typography
  const KIN = [['#ffd23f', '#14081f', '#ff6f59'], ['#14081f', '#fff4e6', '#2ec4b6'], ['#ff6f59', '#14081f', '#fff4e6'], ['#2ec4b6', '#14081f', '#ffd23f'], ['#fff4e6', '#14081f', '#ff6f59']];
  const kinCache = new Map();
  look({
    id: 'kinetic', name: 'Kinetic', family: 'Lyric videos and channels', from: 'Kinetic-type lyric videos (official lyric videos, TextAlive, Japanese lyric MVs)', phase: 'B',
    what: 'Each line becomes a locked block of type: the key word on its own row, every row stretched to the same width. Letters fly in one by one on their timing; bars, a ring and halftone dots pulse with the beat.',
    draw(ctx, W, H, t) {
      const B = Song.beat(t);
      const lc = Song.lineAt(t);
      const cur = Math.max(0, Song.lastStarted(t));
      const [c0, c1, c2] = KIN[cur % KIN.length];
      bg(ctx, W, H, c0);
      const m = Math.min(W, H);
      ctx.strokeStyle = c2; ctx.lineWidth = m * 0.02;
      ctx.beginPath(); ctx.arc(W * 0.5, H * 0.5, m * (0.38 + 0.03 * B.env), 0, TAU); ctx.stroke();
      ctx.fillStyle = c2;
      for (let k = 0; k < 3; k++) { const y = ((t * 0.12 + k / 3) % 1) * H; ctx.fillRect(0, y, W * (0.08 + 0.05 * B.env), m * 0.012); }
      for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) { ctx.beginPath(); ctx.arc(W - m * 0.04 - i * m * 0.028, H - m * 0.04 - j * m * 0.028, m * 0.006 * (0.5 + B.env * (1 - (i + j) / 18)), 0, TAU); ctx.fill(); }
      if (!lc) return;
      const L = lc.L;
      const key = `${L.i}|${W}|${H}`;
      let lay = kinCache.get(key);
      if (!lay) {
        const kw = L.words.reduce((a, w) => (w.text.length > a.text.length ? w : a), L.words[0]);
        const rows = []; let row = [];
        for (const w of L.words) {
          if (w === kw) { if (row.length) rows.push(row); rows.push([w]); row = []; continue; }
          row.push(w);
          if (row.map((x) => x.text).join(' ').length > 10) { rows.push(row); row = []; }
        }
        if (row.length) rows.push(row);
        const BW = W * (H > W ? 0.84 : 0.56);
        let total = 0;
        const out = rows.map((r) => {
          const txt = r.map((w) => w.text.toUpperCase()).join(' ');
          const isKey = r.length === 1 && r[0] === kw;
          const f = isKey ? FONT.anton : (px) => FONT.grot(700, px);
          ctx.font = f(100);
          const fsz = 100 * BW / ctx.measureText(txt).width;
          total += fsz * (isKey ? 0.95 : 0.9);
          return { r, txt, f, fsz, isKey };
        });
        const scale = Math.min(1, (H * 0.74) / total);
        lay = { out, scale, BW: BW * scale, total: total * scale };
        kinCache.set(key, lay);
        if (kinCache.size > 40) kinCache.delete(kinCache.keys().next().value);
      }
      const exit = smooth(0.88, 1, lc.p);
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(1 + 0.12 * exit, 1 + 0.12 * exit); ctx.globalAlpha = 1 - exit;
      let y = -lay.total / 2;
      for (const row of lay.out) {
        const fsz = row.fsz * lay.scale;
        y += fsz * (row.isKey ? 0.95 : 0.9);
        ctx.font = row.f(fsz);
        let x = -lay.BW / 2;
        const space = ctx.measureText(' ').width;
        for (const w of row.r) {
          const s = w.text.toUpperCase();
          for (let c = 0; c < s.length; c++) {
            const at = w.s + (w.e - w.s) * 0.6 * (c / s.length);
            const q = clamp((t - at) / 0.2, 0, 1);
            const cw = ctx.measureText(s[c]).width;
            if (q > 0) {
              const e = easeBack(q);
              ctx.save(); ctx.translate(x + cw / 2, y - fsz * 0.35 * (1 - e)); ctx.rotate((1 - e) * (hash(c + w.k * 9) - 0.5) * 1.2);
              ctx.globalAlpha = (1 - exit) * clamp(q * 2, 0, 1);
              ctx.fillStyle = row.isKey ? c2 : c1; ctx.fillText(s[c], -cw / 2, 0); ctx.restore();
            }
            x += cw;
          }
          x += space;
        }
      }
      ctx.restore();
    },
  });

  // 11. Lull: lo-fi room
  look({
    id: 'lull', name: 'Lull', family: 'Lyric videos and channels', from: 'Aesthetic lyric channels and lo-fi loops (YouTube)', phase: 'D',
    what: 'A drawn night window: rain on the glass, city lights, a lamp, curtains that sway, a slow camera drift. The lyric is small, lowercase and quiet, with a thin spectrum line underneath.',
    draw(ctx, W, H, t) {
      bg(ctx, W, H, '#16121e');
      ctx.save();
      const dz = REDUCED ? 1 : 1.04;
      ctx.translate(W / 2 + (REDUCED ? 0 : Math.sin(t * 0.07) * W * 0.01), H / 2); ctx.scale(dz, dz); ctx.translate(-W / 2, -H / 2);
      const portrait = H > W;
      const wx = W * (portrait ? 0.12 : 0.28), wy = H * 0.1, ww = W * (portrait ? 0.76 : 0.44), wh = H * (portrait ? 0.48 : 0.58);
      const sky = ctx.createLinearGradient(0, wy, 0, wy + wh); sky.addColorStop(0, '#1b2440'); sky.addColorStop(1, '#3d2c55');
      ctx.fillStyle = sky; ctx.fillRect(wx, wy, ww, wh);
      ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
      for (let i = 0; i < 26; i++) { const bx = wx + hash(i) * ww, bh = wh * (0.15 + 0.3 * hash(i + 9)); ctx.fillStyle = '#121a2e'; ctx.fillRect(bx, wy + wh - bh, ww * 0.08, bh); }
      for (let i = 0; i < 70; i++) { const tw = 0.5 + 0.5 * Math.sin(t * (0.5 + hash(i * 3)) + i); ctx.fillStyle = `rgba(255,${190 + 50 * hash(i)},120,${0.25 + 0.5 * tw})`; ctx.beginPath(); ctx.arc(wx + hash(i * 7) * ww, wy + wh * (0.55 + 0.4 * hash(i * 11)), 1.2 + 2.5 * hash(i * 5), 0, TAU); ctx.fill(); }
      ctx.strokeStyle = 'rgba(190,210,255,0.35)'; ctx.lineWidth = 1;
      for (let i = 0; i < 90; i++) { const x = wx + hash(i * 1.3) * ww, sp = 0.6 + hash(i * 2.1), y = wy + ((hash(i * 4.7) * wh + t * wh * sp) % wh); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 10 + 10 * sp); ctx.stroke(); }
      for (let i = 0; i < 40; i++) { const x = wx + hash(i * 9.1) * ww, y = wy + ((hash(i * 3.3) * wh + t * 6 * hash(i)) % wh); ctx.fillStyle = 'rgba(220,230,255,0.28)'; ctx.beginPath(); ctx.arc(x, y, 1.5 + 2 * hash(i * 6.6), 0, TAU); ctx.fill(); }
      ctx.restore();
      ctx.strokeStyle = '#2a2233'; ctx.lineWidth = Math.max(6, W * 0.01); ctx.strokeRect(wx, wy, ww, wh);
      ctx.beginPath(); ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh); ctx.moveTo(wx, wy + wh * 0.45); ctx.lineTo(wx + ww, wy + wh * 0.45); ctx.stroke();
      const sway = REDUCED ? 0 : Math.sin(t * 0.6) * W * 0.008;
      ctx.fillStyle = '#4a2f4f';
      ctx.beginPath(); ctx.moveTo(wx - W * 0.05, wy - 10); ctx.quadraticCurveTo(wx + ww * 0.12 + sway, wy + wh * 0.5, wx + sway * 2, wy + wh + 30); ctx.lineTo(wx - W * 0.08, wy + wh + 30); ctx.fill();
      ctx.beginPath(); ctx.moveTo(wx + ww + W * 0.05, wy - 10); ctx.quadraticCurveTo(wx + ww * 0.88 - sway, wy + wh * 0.5, wx + ww - sway * 2, wy + wh + 30); ctx.lineTo(wx + ww + W * 0.08, wy + wh + 30); ctx.fill();
      const lamp = ctx.createRadialGradient(W * 0.1, H * 0.78, 0, W * 0.1, H * 0.78, Math.max(W, H) * 0.45);
      lamp.addColorStop(0, 'rgba(255,190,120,0.35)'); lamp.addColorStop(1, 'rgba(255,190,120,0)');
      ctx.fillStyle = lamp; ctx.fillRect(0, 0, W, H);
      ctx.restore();
      const lc = Song.lineAt(t);
      if (lc) {
        const fs = portrait ? W * 0.06 : Math.min(H * 0.05, W * 0.032);
        const txt = lc.L.text.toLowerCase();
        const a = clamp(lc.age / 0.7, 0, 1) * (1 - smooth(0.85, 1, lc.p));
        ctx.globalAlpha = a; ctx.font = FONT.serif(fs, true); ctx.textAlign = 'center'; ctx.fillStyle = '#f3ece4';
        ctx.fillText(txt, W / 2, H * 0.85, W * 0.9); ctx.textAlign = 'left'; ctx.globalAlpha = 1;
      }
      const sp = spectrum(t, 64);
      ctx.strokeStyle = 'rgba(243,236,228,0.35)'; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let b = 0; b < 64; b++) { const x = W * 0.3 + (b / 63) * W * 0.4, y = H * 0.93 - sp[b] * H * 0.03; b ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    },
  });

  // 12. Boil: doodles over the cover
  const doodle = (ctx, kind, x, y, s, fb, col) => {
    const j = (k) => (hash(fb * 13.7 + k * 3.1) - 0.5) * s * 0.06;
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(2.5, s * 0.05); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (kind === 'star') for (let k = 0; k <= 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? s * 0.22 : s * 0.5; const px = x + Math.cos(a) * r + j(k), py = y + Math.sin(a) * r + j(k + 20); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    if (kind === 'spiral') for (let k = 0; k < 40; k++) { const a = k * 0.45, r = s * 0.012 * k; const px = x + Math.cos(a) * r + j(k), py = y + Math.sin(a) * r + j(k + 50); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    if (kind === 'arrow') { ctx.moveTo(x - s * 0.5 + j(1), y + s * 0.2 + j(2)); ctx.quadraticCurveTo(x + j(3), y - s * 0.4 + j(4), x + s * 0.5 + j(5), y + j(6)); ctx.moveTo(x + s * 0.3 + j(7), y - s * 0.15 + j(8)); ctx.lineTo(x + s * 0.5 + j(5), y + j(6)); ctx.lineTo(x + s * 0.28 + j(9), y + s * 0.15 + j(10)); }
    if (kind === 'bolt') { const P = [[0, -0.5], [-0.2, 0], [0.05, 0], [-0.1, 0.5], [0.25, -0.1], [0, -0.1], [0.15, -0.5]]; P.forEach(([a, b], k) => (k ? ctx.lineTo : ctx.moveTo).call(ctx, x + a * s + j(k), y + b * s + j(k + 9))); ctx.closePath(); }
    if (kind === 'rays') for (let k = 0; k < 8; k++) { const a = k * TAU / 8; ctx.moveTo(x + Math.cos(a) * s * 0.25 + j(k), y + Math.sin(a) * s * 0.25 + j(k + 1)); ctx.lineTo(x + Math.cos(a) * s * 0.5 + j(k + 2), y + Math.sin(a) * s * 0.5 + j(k + 3)); }
    ctx.stroke();
  };
  look({
    id: 'boil', name: 'Boil', family: 'Lyric videos and channels', from: 'Hand-drawn doodles over footage (indie and rap music videos)', phase: 'C',
    what: 'The cover stands in for footage with a slow push; marker doodles and hand-lettered words are redrawn twelve times a second so every line wobbles, and the key word gets a scribbled underline.',
    draw(ctx, W, H, t) {
      const sec = Song.section(t), q = clamp((t - sec.start) / (sec.end - sec.start), 0, 1);
      ctx.save(); if (HAS_FILTER) ctx.filter = 'saturate(1.35) contrast(1.05)';
      coverFill(ctx, 0, 0, W, H, 1.15 + 0.2 * q, 0.5, 0.45); ctx.restore();
      ctx.fillStyle = 'rgba(20,6,30,0.22)'; ctx.fillRect(0, 0, W, H);
      const fb = Math.floor(t * 12), m = Math.min(W, H);
      const cur = Math.max(0, Song.lastStarted(t));
      const kinds = ['star', 'spiral', 'arrow', 'bolt', 'rays'], cols = ['#ff3ea5', '#ffe600', '#00e1ff', '#ffffff'];
      for (let k = 0; k < 5; k++) {
        const kind = kinds[(cur + k) % 5];
        const x = W * (0.1 + 0.8 * hash(cur * 7 + k)), y = H * (0.08 + 0.4 * hash(cur * 5 + k * 3));
        doodle(ctx, kind, x, y + Math.sin(t * 2 + k) * 4, m * (0.12 + 0.08 * hash(k + cur)), fb + k * 100, cols[k % 4]);
      }
      const lc = Song.lineAt(t); if (!lc) return;
      const L = lc.L, fs = H > W ? W * 0.1 : Math.min(H * 0.1, W * 0.06);
      const rows = layoutWords(ctx, L.words, FONT.marker(fs), W * 0.84);
      const key = L.words.reduce((a, w) => (w.text.length > a.text.length ? w : a), L.words[0]);
      let y = H * 0.62 - (rows.length - 1) * fs * 0.6;
      ctx.font = FONT.marker(fs); ctx.lineJoin = 'round';
      for (const row of rows) {
        const x0 = (W - row.width) / 2;
        for (const it of row.items) {
          if (t < it.w.s - 0.02) continue;
          let x = x0 + it.x;
          for (let c = 0; c < it.w.text.length; c++) {
            const ch = it.w.text[c], cw = ctx.measureText(ch).width;
            const jx = (hash(fb * 3.3 + c + it.w.k * 17) - 0.5) * fs * 0.06, jy = (hash(fb * 5.1 + c * 2 + it.w.k) - 0.5) * fs * 0.06, jr = (hash(fb + c * 9) - 0.5) * 0.1;
            ctx.save(); ctx.translate(x + jx, y + jy); ctx.rotate(jr);
            ctx.lineWidth = fs * 0.14; ctx.strokeStyle = '#120818'; ctx.strokeText(ch, 0, 0);
            ctx.fillStyle = it.w === key ? '#ffe600' : '#fff'; ctx.fillText(ch, 0, 0); ctx.restore();
            x += cw;
          }
          if (it.w === key) {
            const p = Song.wordP(it.w, t);
            ctx.strokeStyle = '#ff3ea5'; ctx.lineWidth = fs * 0.08; ctx.lineCap = 'round'; ctx.beginPath();
            for (let k = 0; k <= 12; k++) { const u = (k / 12) * clamp(p * 1.5, 0, 1); const px = x0 + it.x + u * it.width, py = y + fs * 0.22 + Math.sin(k * 1.7 + fb) * fs * 0.04; k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
            ctx.stroke();
          }
        }
        y += fs * 1.2;
      }
    },
  });

  // 13. Warp: feedback visualizer (stateful)
  const fbA = document.createElement('canvas'), fbB = document.createElement('canvas');
  let fbLastT = -1;
  look({
    id: 'warp', name: 'Warp', family: 'Music visualizers', from: 'Feedback-warp visualizers (MilkDrop, projectM, Butterchurn)', phase: 'A',
    what: 'Each frame is the last one zoomed, turned and faded, with a waveform ring and the sung word drawn into it, so everything leaves trails. The warp changes at each section; a clean copy of the line stays readable on top.',
    stateful: true,
    draw(ctx, W, H, t, dpr) {
      const pw = Math.round(W * dpr * 0.5), ph = Math.round(H * dpr * 0.5);
      if (fbA.width !== pw || fbA.height !== ph) { fbA.width = fbB.width = pw; fbA.height = fbB.height = ph; fbLastT = -1; }
      if (Math.abs(t - fbLastT) > 0.5) { fbA.getContext('2d').clearRect(0, 0, pw, ph); }
      fbLastT = t;
      const a = fbA.getContext('2d'), b = fbB.getContext('2d');
      const B = Song.beat(t), sec = Song.section(t), mode = sec.i % 4, s = pw / W;
      b.setTransform(1, 0, 0, 1, 0, 0); b.globalAlpha = 1; b.fillStyle = '#05030a'; b.fillRect(0, 0, pw, ph);
      b.save(); b.translate(pw / 2, ph / 2);
      const kick = REDUCED ? 0 : B.env;
      if (mode === 0) { b.rotate(0.012 + 0.01 * kick); b.scale(1.025 + 0.02 * kick, 1.025 + 0.02 * kick); }
      if (mode === 1) { b.rotate(-0.02); b.scale(1.04 + 0.03 * kick, 1.01); }
      if (mode === 2) { b.rotate(0.004 * Math.sin(t)); b.scale(0.985, 0.985); }
      if (mode === 3) { b.rotate(0.03 * Math.sin(t * 0.5)); b.scale(1.05 * (1 + 0.03 * kick), 1.05); }
      b.globalAlpha = 0.9; b.drawImage(fbA, -pw / 2, -ph / 2); b.restore(); b.globalAlpha = 1;
      const sp = spectrum(t, 96), hue = (t * 24) % 360, R = Math.min(pw, ph) * 0.22;
      b.save(); b.translate(pw / 2, ph / 2); b.lineWidth = 2 * s * dpr; b.strokeStyle = `hsl(${hue},90%,62%)`; b.beginPath();
      for (let k = 0; k <= 96; k++) { const v = sp[k % 96], ang = (k / 96) * TAU + t * 0.3, r = R * (1 + 0.45 * v); const x = Math.cos(ang) * r, y = Math.sin(ang) * r; k ? b.lineTo(x, y) : b.moveTo(x, y); }
      b.stroke();
      const lc = Song.lineAt(t);
      if (lc) {
        const w = Song.curWord(lc.L, t);
        if (w) { b.font = FONT.anton(Math.min(pw, ph) * 0.16); b.textAlign = 'center'; b.textBaseline = 'middle'; b.strokeStyle = `hsl(${(hue + 160) % 360},90%,66%)`; b.lineWidth = 1.5 * s * dpr; b.strokeText(w.text.toUpperCase(), 0, 0); }
      }
      b.restore();
      a.clearRect(0, 0, pw, ph); a.drawImage(fbB, 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.drawImage(fbB, 0, 0, W, H);
      if (lc) {
        const fs = H > W ? W * 0.065 : Math.min(H * 0.06, W * 0.04);
        ctx.font = FONT.ui(800, fs); ctx.textAlign = 'center';
        const txt = lc.L.text, tw = ctx.measureText(txt).width, sc = Math.min(1, W * 0.9 / tw);
        ctx.save(); ctx.translate(W / 2, H * 0.86); ctx.scale(sc, sc); ctx.textAlign = 'left';
        let x = -tw / 2;
        for (const w of lc.L.words) { ctx.fillStyle = t >= w.s ? '#fff' : 'rgba(255,255,255,0.4)'; ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 8; ctx.fillText(w.text, x, 0); x += ctx.measureText(w.text + ' ').width; }
        ctx.restore(); ctx.textAlign = 'left';
      }
    },
  });

  // 14. Skyline: bar spectrum
  look({
    id: 'skyline', name: 'Skyline', family: 'Music visualizers', from: 'Bar-spectrum channels and lyric-over-spectrum templates (Specterr, Videobolt)', phase: 'B',
    what: 'The spectrum as a city of bars on a horizon with a mirrored reflection and falling peak caps; the line is lit above it like a billboard. Bars come from the beat grid and word onsets when no audio is analysed.',
    draw(ctx, W, H, t) {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0d0b22'); g.addColorStop(0.62, '#3b1f4f'); g.addColorStop(0.63, '#0a0812'); g.addColorStop(1, '#120c1c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const n = H > W ? 32 : 56, hz = H * 0.63, sp = spectrum(t, n), sp2 = [spectrum(t - 0.1, n), spectrum(t - 0.2, n), spectrum(t - 0.35, n)];
      const bw = W / n;
      for (let b = 0; b < n; b++) {
        const v = 0.04 + sp[b] * 0.96, h = v * H * 0.42, x = b * bw + bw * 0.15, w = bw * 0.7;
        const gg = ctx.createLinearGradient(0, hz - h, 0, hz); gg.addColorStop(0, '#ff9fb2'); gg.addColorStop(1, '#2ec4b6');
        ctx.fillStyle = gg; ctx.fillRect(x, hz - h, w, h);
        ctx.globalAlpha = 0.22; ctx.fillRect(x, hz + 2, w, h * 0.5); ctx.globalAlpha = 1;
        const peak = Math.max(v, 0.04 + sp2[0][b] * 0.92, 0.04 + sp2[1][b] * 0.85, 0.04 + sp2[2][b] * 0.75);
        ctx.fillStyle = '#fff4e6'; ctx.fillRect(x, hz - peak * H * 0.42 - 6, w, 3);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(0, hz, W, 1);
      const m = Math.min(W, H);
      ctx.drawImage(cover, W * 0.04, H * 0.05, m * 0.12, m * 0.12);
      ctx.font = FONT.grot(700, m * 0.032); ctx.fillStyle = '#fff4e6'; ctx.fillText(TITLE.toUpperCase(), W * 0.04 + m * 0.14, H * 0.05 + m * 0.05);
      ctx.font = FONT.ui(500, m * 0.024); ctx.fillStyle = 'rgba(255,244,230,0.6)'; ctx.fillText(ARTIST, W * 0.04 + m * 0.14, H * 0.05 + m * 0.09);
      const lc = Song.lineAt(t); if (!lc) return;
      const txt = lc.L.text.toUpperCase();
      const fs = fit(ctx, txt, FONT.anton, W * 0.88, H * 0.12);
      ctx.font = FONT.anton(fs);
      let x = (W - ctx.measureText(txt).width) / 2;
      for (const w of lc.L.words) {
        const s = w.text.toUpperCase(), on = t >= w.s;
        ctx.save(); if (on) { ctx.shadowColor = PAL.pink; ctx.shadowBlur = fs * 0.3; }
        ctx.fillStyle = on ? '#fff' : 'rgba(255,255,255,0.12)'; ctx.fillText(s, x, H * 0.36);
        if (!on) { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.strokeText(s, x, H * 0.36); }
        ctx.restore(); x += ctx.measureText(s + ' ').width;
      }
    },
  });

  // 15. Halo: circular spectrum
  look({
    id: 'halo', name: 'Halo', family: 'Music visualizers', from: 'Circular-spectrum visualizers (trap and bass YouTube channels, circle-spectrum templates)', phase: 'A',
    what: 'The cover in a turning disc ringed by a mirrored spectrum, a slower ring of particles streaming outward, and a capped bass shake. The line sits under the disc with the next one waiting below.',
    draw(ctx, W, H, t) {
      const B = Song.beat(t);
      bg(ctx, W, H, '#0b0712');
      ctx.save(); ctx.globalAlpha = 0.28; if (HAS_FILTER) ctx.filter = 'blur(24px)'; coverFill(ctx, -50, -50, W + 100, H + 100, 1.2); ctx.restore();
      ctx.fillStyle = 'rgba(8,4,14,0.4)'; ctx.fillRect(0, 0, W, H);
      const kick = Math.exp(-(t - lastBefore(KICKS, t)) * 8);
      const shx = REDUCED ? 0 : (hash(Math.floor(t * 60)) - 0.5) * 6 * kick, shy = REDUCED ? 0 : (hash(Math.floor(t * 60) + 3) - 0.5) * 6 * kick;
      const portrait = H > W, cx = W / 2 + shx, cy = H * (portrait ? 0.4 : 0.42) + shy;
      const R = Math.min(W, H) * (portrait ? 0.24 : 0.2) * (1 + 0.04 * kick);
      for (let i = 0; i < 220; i++) {
        const a = hash(i) * TAU + t * 0.05, q = (hash(i * 3.7) + t * (0.06 + 0.1 * hash(i * 1.9))) % 1;
        const r = R * 1.35 + q * Math.max(W, H) * 0.6;
        ctx.fillStyle = `rgba(255,${200 + 55 * hash(i)},230,${(1 - q) * 0.7})`;
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.8 + 2.2 * hash(i * 5) * (1 - q), 0, TAU); ctx.fill();
      }
      const n = 64, sp = spectrum(t, n);
      ctx.save(); ctx.translate(cx, cy); ctx.lineCap = 'round';
      ctx.shadowColor = PAL.pink; ctx.shadowBlur = 12;
      for (let k = 0; k < n * 2; k++) {
        const b = k < n ? k : 2 * n - 1 - k, v = sp[b];
        const a = (k / (n * 2)) * TAU - Math.PI / 2;
        const r0 = R * 1.06, r1 = r0 + 4 + v * R * 0.6;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(2, R * 0.025);
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke();
      }
      ctx.shadowBlur = 0;
      ctx.rotate(t * 0.25); ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.clip(); ctx.drawImage(cover, -R, -R, R * 2, R * 2);
      ctx.restore();
      const lc = Song.lineAt(t); if (!lc) return;
      const fs = portrait ? W * 0.07 : Math.min(H * 0.065, W * 0.042);
      ctx.font = FONT.ui(800, fs);
      const tw = ctx.measureText(lc.L.text).width, sc = Math.min(1, W * 0.9 / tw);
      ctx.save(); ctx.translate(W / 2, cy + R * 1.75 + fs); ctx.scale(sc, sc);
      let x = -tw / 2;
      for (const w of lc.L.words) { ctx.fillStyle = t >= w.s ? '#fff' : 'rgba(255,255,255,0.38)'; ctx.fillText(w.text, x, 0); x += ctx.measureText(w.text + ' ').width; }
      ctx.restore();
      const nx = LINES[lc.L.i + 1];
      if (nx) { ctx.font = FONT.ui(600, fs * 0.5); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillText(nx.text, W / 2, cy + R * 1.75 + fs * 2, W * 0.9); ctx.textAlign = 'left'; }
    },
  });

  // 16. Magnet: particles that become the word
  const ptsCache = new Map();
  function glyphPoints(text, fs, W, H) {
    const key = `${text}|${Math.round(fs)}|${W}|${H}`;
    if (ptsCache.has(key)) return ptsCache.get(key);
    const c = document.createElement('canvas'); c.width = Math.ceil(W); c.height = Math.ceil(H);
    const x = c.getContext('2d', { willReadFrequently: true });
    x.font = FONT.anton(fs); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff'; x.fillText(text, W / 2, H * 0.46);
    const d = x.getImageData(0, 0, c.width, c.height).data, pts = [], step = Math.max(3, Math.round(fs / 26));
    for (let y = 0; y < c.height; y += step) for (let xx = 0; xx < c.width; xx += step) if (d[(y * c.width + xx) * 4 + 3] > 128) pts.push([xx, y]);
    for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(hash(i * 1.37) * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
    ptsCache.set(key, pts);
    if (ptsCache.size > 60) ptsCache.delete(ptsCache.keys().next().value);
    return pts;
  }
  look({
    id: 'magnet', name: 'Magnet', family: 'Music visualizers', from: 'Particle-field visualizers (iTunes Magnetosphere, Windows Media Player, Plane9)', phase: 'C',
    what: 'Two thousand particles orbit two drifting poles, then pull together into the letters of each word as it is sung and fall back into orbit at the end of the line.',
    draw(ctx, W, H, t) {
      bg(ctx, W, H, '#05040a');
      const m = Math.min(W, H), N = 2000;
      const P = [[W * (0.5 + 0.22 * Math.sin(t * 0.21)), H * (0.5 + 0.2 * Math.cos(t * 0.17))], [W * (0.5 + 0.22 * Math.sin(t * 0.19 + 3)), H * (0.5 + 0.2 * Math.cos(t * 0.23 + 2))]];
      const lc = Song.lineAt(t);
      let cur = null, prev = null, a = 0, bmix = 0, keep = 0;
      if (lc) {
        const L = lc.L, w = Song.curWord(L, t);
        if (w) {
          const fs = fit(ctx, w.text.toUpperCase(), FONT.anton, W * 0.82, H * 0.34);
          cur = glyphPoints(w.text.toUpperCase().replace(/[,]/g, ''), fs, W, H);
          a = ease((t - w.s) / 0.35);
          const pw = L.words[w.k - 1];
          if (pw) { const pfs = fit(ctx, pw.text.toUpperCase(), FONT.anton, W * 0.82, H * 0.34); prev = glyphPoints(pw.text.toUpperCase().replace(/[,]/g, ''), pfs, W, H); bmix = (1 - a) * ease((t - pw.s) / 0.35); }
          keep = 1 - ease((t - (L.end + 0.25)) / 0.5);
        }
      }
      const sp = spectrum(t, 8), loud = sp[0] * 0.5 + sp[3] * 0.5;
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < N; i++) {
        const pole = P[i & 1], r = m * (0.05 + 0.42 * hash(i * 1.3)), sp0 = (0.25 + 0.7 * hash(i * 2.7)) * (1 + loud * 0.6);
        const ang = hash(i * 3.9) * TAU + t * sp0 * (i & 1 ? 1 : -1) / (0.4 + r / m);
        let x = pole[0] + Math.cos(ang) * r, y = pole[1] + Math.sin(ang) * r * 0.55;
        if (cur && cur.length) {
          const tc = cur[i % cur.length], jx = (hash(i * 5.3) - 0.5) * 3, jy = (hash(i * 6.1) - 0.5) * 3;
          let tx = x + (tc[0] + jx - x) * a, ty = y + (tc[1] + jy - y) * a;
          if (prev && prev.length && bmix > 0) { const tp = prev[i % prev.length]; tx += (tp[0] - x) * bmix; ty += (tp[1] - y) * bmix; }
          x = x + (tx - x) * keep; y = y + (ty - y) * keep;
        }
        const hue = (i & 1 ? 330 : 175) + 20 * hash(i);
        ctx.fillStyle = `hsla(${hue},95%,${60 + 20 * hash(i * 7)}%,0.8)`;
        ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
      }
      ctx.globalCompositeOperation = 'source-over';
      if (lc) {
        const fs = H > W ? W * 0.05 : Math.min(H * 0.045, W * 0.03);
        ctx.font = FONT.ui(700, fs); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillText(lc.L.text, W / 2, H * 0.9, W * 0.9); ctx.textAlign = 'left';
      }
    },
  });

  // 17. Mirror: kaleidoscope
  look({
    id: 'mirror', name: 'Mirror', family: 'Music visualizers', from: 'VJ kaleidoscopes and shader scenes (Synesthesia, Resolume, Kaleidosync)', phase: 'C',
    what: 'A kaleidoscope of the cover whose segment count changes at each section and which steps round on the beat, with no strobe; the line sits on a calm band across the middle.',
    draw(ctx, W, H, t) {
      const B = Song.beat(t), sec = Song.section(t);
      const k = [6, 8, 10, 12, 8, 10, 6][sec.i] || 8;
      const ang = TAU / k, R = Math.hypot(W, H) / 2 + 4;
      const rot = t * 0.06 + (REDUCED ? 0 : 0.05 * (B.i + ease(B.ph * 4)));
      bg(ctx, W, H, '#100818');
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(rot);
      const S = R * 1.3, ox = Math.sin(t * 0.13) * S * 0.15, oy = Math.cos(t * 0.11) * S * 0.15;
      for (let s = 0; s < k; s++) {
        ctx.save(); ctx.rotate(s * ang);
        if (s % 2) { ctx.rotate(ang); ctx.scale(1, -1); }
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R, 0); ctx.arc(0, 0, R, 0, ang + 0.003); ctx.closePath(); ctx.clip();
        ctx.drawImage(cover, -S * 0.1 + ox, -S * 0.5 + oy, S, S);
        ctx.restore();
      }
      ctx.restore();
      const lc = Song.lineAt(t); if (!lc) return;
      const fs = H > W ? W * 0.07 : Math.min(H * 0.07, W * 0.045);
      ctx.fillStyle = 'rgba(12,6,20,0.62)'; ctx.fillRect(0, H / 2 - fs * 1.1, W, fs * 2);
      ctx.font = FONT.grot(700, fs);
      const tw = ctx.measureText(lc.L.text).width, sc = Math.min(1, W * 0.9 / tw);
      ctx.save(); ctx.translate(W / 2, H / 2 + fs * 0.32); ctx.scale(sc, sc);
      let x = -tw / 2;
      for (const w of lc.L.words) { ctx.fillStyle = t >= w.s ? '#fff4e6' : 'rgba(255,244,230,0.35)'; ctx.fillText(w.text, x, 0); x += ctx.measureText(w.text + ' ').width; }
      ctx.restore();
    },
  });

  // 18. Melt: displacement of the cover with the line pressed in
  const mSrc = document.createElement('canvas'), mTmp = document.createElement('canvas');
  look({
    id: 'melt', name: 'Melt', family: 'Music visualizers', from: 'AI music-video generators (Neural Frames, Kaiber), made with maths instead of a model', phase: 'C',
    what: 'The cover flows through a slow displacement field and the sung line is pressed into the image as a relief that the flow slowly erodes. A plain subtitle keeps it readable.',
    draw(ctx, W, H, t) {
      const sw = 360, sh = Math.round(360 * H / W);
      if (mSrc.width !== sw || mSrc.height !== sh) { mSrc.width = mTmp.width = sw; mSrc.height = mTmp.height = sh; }
      const s = mSrc.getContext('2d'), m = mTmp.getContext('2d');
      s.clearRect(0, 0, sw, sh);
      const z = 1.3 + 0.15 * Math.sin(t * 0.07);
      const S = Math.max(sw, sh) * z; s.drawImage(cover, (sw - S) / 2 + Math.sin(t * 0.09) * 20, (sh - S) / 2, S, S);
      s.fillStyle = `hsla(${(t * 8) % 360},80%,50%,0.12)`; s.fillRect(0, 0, sw, sh);
      const lc = Song.lineAt(t);
      if (lc) {
        const fs = fit(s, lc.L.text, (px) => FONT.anton(px), sw * 0.88, sh * 0.16);
        s.font = FONT.anton(fs); s.textAlign = 'center';
        const erode = 1 - 0.6 * ease((lc.age - 2) / 3);
        const shown = lc.L.words.filter((w) => t >= w.s).map((w) => w.text).join(' ');
        s.globalAlpha = 0.7 * erode; s.fillStyle = '#000'; s.fillText(shown, sw / 2 + 2, sh / 2 + 3);
        s.globalAlpha = 0.9 * erode; s.fillStyle = '#fff4e6'; s.fillText(shown, sw / 2, sh / 2);
        s.globalAlpha = 1; s.textAlign = 'left';
      }
      m.clearRect(0, 0, sw, sh);
      const amp = 9 + 4 * Song.beat(t).env;
      for (let y = 0; y < sh; y += 3) { const dx = Math.sin(y * 0.035 + t * 0.9) * amp + Math.sin(y * 0.011 - t * 0.4) * amp * 0.8; m.drawImage(mSrc, 0, y, sw, 3, dx, y, sw, 3); }
      s.clearRect(0, 0, sw, sh);
      for (let x = 0; x < sw; x += 3) { const dy = Math.sin(x * 0.03 - t * 0.7) * amp + Math.cos(x * 0.013 + t * 0.33) * amp * 0.7; s.drawImage(mTmp, x, 0, 3, sh, x, dy, 3, sh); }
      bg(ctx, W, H, '#140b1f');
      ctx.imageSmoothingEnabled = true; ctx.drawImage(mSrc, -W * 0.03, -H * 0.03, W * 1.06, H * 1.06);
      if (lc) {
        const fs = H > W ? W * 0.045 : Math.min(H * 0.04, W * 0.026);
        ctx.font = FONT.ui(600, fs); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.88)'; ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 6;
        ctx.fillText(lc.L.text, W / 2, H * 0.92, W * 0.9); ctx.shadowBlur = 0; ctx.textAlign = 'left';
      }
    },
  });

  // 19. Karaoke Room
  look({
    id: 'karaoke', name: 'Karaoke Room', family: 'Karaoke and games', from: 'Karaoke room screens (DAM, JOYSOUND, home karaoke)', phase: 'A',
    what: 'Two staggered lines, top left and bottom right. Each character changes colour with an outlined wipe as it is sung, countdown dots lead into a line after a gap, and the translation sits above as a reading aid.',
    draw(ctx, W, H, t) {
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1d2a52'); g.addColorStop(1, '#4b1f4e');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 26; i++) {
        const x = W * hash(i * 1.7) + Math.sin(t * 0.2 + i) * 30, y = (H * hash(i * 2.3) - t * 12 * (0.3 + hash(i))) % H;
        const r = Math.min(W, H) * (0.03 + 0.08 * hash(i * 4.1));
        const rg = ctx.createRadialGradient(x, (y + H) % H, 0, x, (y + H) % H, r);
        rg.addColorStop(0, `rgba(255,${160 + 80 * hash(i)},200,0.28)`); rg.addColorStop(1, 'rgba(255,200,220,0)');
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, (y + H) % H, r, 0, TAU); ctx.fill();
      }
      if (t < 2 * BAR) {
        const a = 1 - smooth(2 * BAR - 1, 2 * BAR, t);
        ctx.globalAlpha = a; ctx.textAlign = 'center';
        ctx.font = FONT.ui(900, Math.min(W, H) * 0.1); ctx.fillStyle = '#fff'; ctx.fillText(TITLE, W / 2, H * 0.42);
        ctx.font = FONT.ui(600, Math.min(W, H) * 0.04); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText(`${ARTIST}  ·  words and music: original`, W / 2, H * 0.52);
        ctx.textAlign = 'left'; ctx.globalAlpha = 1;
      }
      const cur = Song.lastStarted(t);
      const next = LINES.find((L) => L.start > t);
      const base = cur >= 0 ? cur : next ? next.i : 0;
      const prevEnd = cur >= 0 ? LINES[cur].end : 0;
      if (cur >= 0 && t > LINES[cur].end + 1.2 && next && next.start - t > 2 * BAR) return;
      const fs = H > W ? W * 0.072 : Math.min(H * 0.075, W * 0.05);
      const rowsY = [H * 0.66, H * 0.66 + fs * 2.1];
      for (const j of [base, base + 1]) {
        const L = LINES[j]; if (!L) continue;
        if (j > cur + 1) continue;
        const r = j % 2;
        ctx.font = FONT.ui(800, fs);
        const tw = ctx.measureText(L.text).width, sc = Math.min(1, W * 0.88 / tw);
        const x = r === 0 ? W * 0.06 : W * 0.94 - tw * sc, y = rowsY[r];
        ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
        ctx.font = FONT.ui(600, fs * 0.36); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText(L.sub, 0, -fs * 0.95);
        ctx.font = FONT.ui(800, fs);
        let wx = 0;
        for (const w of L.words) {
          const p = Song.wordP(w, t), ww = ctx.measureText(w.text).width;
          wipeWord(ctx, w.text, wx, 0, p, '#ffffff', '#ff5c8a', fs * 0.16, '#160c2a', '#ffffff');
          wx += ww + ctx.measureText(' ').width;
        }
        if (L.start - (j > 0 ? LINES[j - 1].end : 0) > 2 * BEAT && t < L.start && t > L.start - 4 * BEAT) {
          for (let d = 0; d < 4; d++) { const gone = t > L.start - (4 - d) * BEAT; if (!gone) { ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(d * fs * 0.42 + fs * 0.15, -fs * 1.45, fs * 0.13, 0, TAU); ctx.fill(); } }
        }
        ctx.restore();
      }
      void prevEnd;
    },
  });

  // 20. Highway: words ride a lane
  look({
    id: 'highway', name: 'Highway', family: 'Karaoke and games', from: 'Sing and rhythm games (singing and band games, Smule)', phase: 'B',
    what: 'Words ride a perspective highway toward a hit line and light up as they are sung, with a trail as long as the held note. Lane lights pulse on the beat. Uses word timing only: no microphone, no pitch.',
    draw(ctx, W, H, t) {
      const B = Song.beat(t);
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#07060f'); g.addColorStop(0.3, '#2a1240'); g.addColorStop(1, '#07060f');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const hz = H * 0.28, hit = H * 0.8, vx = W / 2, half = W * (H > W ? 0.46 : 0.3);
      const Y = (z) => hz + (hit - hz) / (1 + 3.2 * z), Sz = (z) => 1 / (1 + 3.2 * z);
      const X = (lane, z) => vx + (lane - 1) * (half * 0.66) * Sz(z);
      ctx.fillStyle = '#120b1e'; ctx.beginPath(); ctx.moveTo(vx - half * 0.02, hz); ctx.lineTo(vx + half * 0.02, hz); ctx.lineTo(vx + half, H); ctx.lineTo(vx - half, H); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
      for (const l of [-0.5, 0.5, 1.5]) { ctx.beginPath(); ctx.moveTo(vx, hz); const zz = -0.12; ctx.lineTo(vx + (l - 1) * half * 0.66 * Sz(zz) * 1.0, Y(zz) + (H - hit)); ctx.stroke(); }
      for (let k = 0; k < 14; k++) { const z = ((k / 14) - (t / 0.9) % (1 / 14) * 14 / 14 + 1) % 1 * 2.4; const y = Y(z), sz = Sz(z); ctx.fillStyle = `rgba(255,255,255,${0.05 * sz})`; ctx.fillRect(vx - half * sz, y, half * 2 * sz, 1); }
      for (const side of [-1, 1]) for (let k = 0; k < 8; k++) { const z = ((k / 8 - (t * 0.5) % 1 / 8 * 8 / 8) % 1 + 1) % 1 * 2.4; const sz = Sz(z), y = Y(z); ctx.fillStyle = `rgba(${side < 0 ? '46,196,182' : '255,111,89'},${(0.3 + 0.7 * B.env) * sz})`; ctx.beginPath(); ctx.arc(vx + side * half * 1.02 * sz, y, 6 * sz + 2, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = `rgba(255,244,230,${0.5 + 0.4 * B.env})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(vx - half, hit); ctx.lineTo(vx + half, hit); ctx.stroke();
      const LOOK = 2.2, items = [];
      for (const L of LINES) { if (L.end < t - 0.6 || L.start > t + LOOK + 0.5) continue; for (const w of L.words) items.push([L, w]); }
      items.sort((a, b) => b[1].s - a[1].s);
      for (const [L, w] of items) {
        const lane = (w.k + L.i) % 3;
        const z0 = (w.s - t) / LOOK, z1 = (w.e - t) / LOOK;
        if (z0 > 1.05 || z1 < -0.25) continue;
        const za = Math.max(z0, -0.08), zb = Math.max(z1, -0.08);
        if (zb > za) {
          ctx.fillStyle = 'rgba(255,159,178,0.25)';
          const wa = half * 0.18 * Sz(za), wb = half * 0.18 * Sz(zb);
          ctx.beginPath(); ctx.moveTo(X(lane, za) - wa, Y(za)); ctx.lineTo(X(lane, za) + wa, Y(za)); ctx.lineTo(X(lane, zb) + wb, Y(zb)); ctx.lineTo(X(lane, zb) - wb, Y(zb)); ctx.fill();
        }
        const z = t <= w.e ? Math.max(z0, 0) : -0.08 * clamp((t - w.e) / 0.4, 0, 1), sz = Sz(z), y = Y(z), x = X(lane, z);
        const active = t >= w.s && t <= w.e;
        const fs = Math.min(W, H) * 0.1 * sz;
        ctx.font = FONT.ui(800, fs);
        const tw = ctx.measureText(w.text).width;
        ctx.globalAlpha = t > w.e ? clamp(1 - (t - w.e) / 0.4, 0, 1) : clamp((1.05 - z0) / 0.2, 0, 1);
        ctx.fillStyle = active ? '#ffd23f' : t > w.e ? '#2ec4b6' : 'rgba(255,255,255,0.12)';
        roundRect(ctx, x - tw / 2 - fs * 0.4, y - fs * 0.9, tw + fs * 0.8, fs * 1.25, fs * 0.3); ctx.fill();
        ctx.fillStyle = active ? '#14081f' : '#fff'; ctx.fillText(w.text, x - tw / 2, y - fs * 0.02);
        if (active) { const q = Song.wordP(w, t); ctx.strokeStyle = `rgba(255,210,63,${1 - q})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, hit, tw * 0.6 + q * 40, 10 + q * 12, 0, 0, TAU); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      const lc = Song.lineAt(t);
      if (lc) { const fs = Math.min(W, H) * 0.04; ctx.font = FONT.ui(700, fs); ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillText(lc.L.text, W / 2, H * 0.12, W * 0.9); ctx.textAlign = 'left'; }
    },
  });
    try { REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* no media query support */ }
    const keep = ['platter', 'strip', 'marginalia', 'sticker', 'punch', 'recap', 'kinetic', 'lull', 'boil', 'warp', 'magnet', 'mirror', 'melt', 'karaoke', 'highway'];
    return { looks: LOOKS.filter((l) => keep.includes(l.id)), resize() { kinCache.clear(); }, fontsLoaded() { ptsCache.clear(); kinCache.clear(); } };
  })();
  for (const l of CLASSIC.looks) LOOKS.push(Object.assign(l, { kind: '2d', gpuFamily: l.family, family: 'Hand-made and quirky', post: POST(Object.assign({ thresh: 0.9, bloom: 0.45, grain: 0.032, ca: 0.12, vig: 0.4 }, POLISH[l.id] || {})) }));
  const P_PIC = program(PRE + `
  uniform sampler2D uPic; uniform float uBoost;
  void main(){
    vec3 c = pow(texture(uPic, vUv).rgb, vec3(2.2));
    float l = max(c.r, max(c.g, c.b));
    c *= 1. + pow(l, 4.) * 1.8 * uBoost;
    o = vec4(c, 1);
  }`, 'pic');
  const texPic = gl.createTexture();

  // =====================================================================================
  //  Live-motion looks: everything moves on the vocal and the beat, not on a fixed timer.
  //  Words land exactly when they are sung, held notes visibly hold, text dies with the voice,
  //  and camera cuts sit on the downbeat.
  // =====================================================================================
  const MOTION = [];
  const leadEnv = (t) => { for (let i = LEADS.length - 1; i >= 0; i--) { const e = LEADS[i]; if (e.t <= t) return Math.exp(-(t - e.t) * 3); } return 0; };
  const held = (w) => w.e - w.s > 0.55;
  const couplet = (i) => Math.floor(i / 2);

  // ---------- Constellation ----------
  // Each sung word becomes a star. A spark travels along a fresh line from the last word to the next and lands on the
  // syllable; the word blooms large if it is held, then settles into a small label. A couplet builds one constellation,
  // and the next couplet cuts to a clean sky on the downbeat.
  const constCache = new Map();
  function constLayout(c, W, H) {
    const key = `${c}:${W}x${H}`;
    if (constCache.has(key)) return constCache.get(key);
    const S = Math.min(W, H), tall = H > W;
    const box = tall ? [W * 0.12, H * 0.34, W * 0.88, H * 0.86] : [W * 0.1, H * 0.36, W * 0.9, H * 0.86];
    const words = [];
    for (const L of LINES) if (couplet(L.i) === c) for (const w of L.words) words.push(w);
    const pts = [];
    let x = lerp(box[0], box[2], 0.15 + 0.2 * hash(c * 7.7)), y = lerp(box[1], box[3], 0.3 + 0.5 * hash(c * 3.1));
    let ang = hash(c * 1.3) * TAU;
    words.forEach((w, k) => {
      if (k > 0) {
        let best = null;
        for (let tries = 0; tries < 16; tries++) {
          const a = ang + (hash(c * 31 + k * 7 + tries * 1.7) - 0.5) * 2.4 + (tries > 7 ? Math.PI : 0);
          const d = S * (0.11 + 0.1 * hash(c * 5 + k * 13 + tries));
          const nx = x + Math.cos(a) * d * (tall ? 0.9 : 1.25), ny = y + Math.sin(a) * d * 0.8;
          if (nx < box[0] || nx > box[2] || ny < box[1] || ny > box[3]) continue;
          if (pts.some((p) => Math.hypot(p.x - nx, p.y - ny) < S * 0.075)) continue;
          best = [nx, ny, a]; break;
        }
        if (!best) { const nx = lerp(box[0], box[2], hash(c + k * 9.1)), ny = lerp(box[1], box[3], hash(c * 2 + k * 4.3)); best = [nx, ny, ang + 1.3]; }
        [x, y, ang] = best;
      }
      pts.push({ x, y, w, k, side: x > (box[0] + box[2]) / 2 ? -1 : 1 });
    });
    const r = { pts };
    constCache.set(key, r);
    return r;
  }
  function sparkle(ctx, x, y, r, a) {
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha *= a;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.28 : r; const an = (i / 8) * TAU - Math.PI / 2; ctx.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  MOTION.push({
    id: 'constellation', name: 'Constellation', family: 'Live motion',
    from: 'Fan lyric edits that map each sung word to a star on a dark lock-screen-style sky.',
    what: 'Every sung word becomes a star. A spark races along a new line from the last word and lands exactly on the syllable; held words bloom large and glow while the note lasts, then shrink into a small label. Each couplet draws one constellation, and the next couplet cuts to a clean sky on the downbeat. The thin clock up top is the song’s own time.',
    post: POST({ thresh: 0.75, bloom: 0.75, grain: 0.04, ca: 0.15, vig: 0.7 }),
    draw(ctx, W, H, t) {
      const S = Math.min(W, H), tall = H > W;
      ctx.fillStyle = '#040407'; ctx.fillRect(0, 0, W, H);
      // a faint field of background stars, deterministic
      for (let i = 0; i < 90; i++) { const a = 0.08 + 0.18 * hash(i * 9.1) * (0.6 + 0.4 * Math.sin(t * (0.5 + hash(i)) + i)); ctx.fillStyle = `rgba(200,205,235,${a})`; ctx.fillRect(hash(i * 1.7) * W, hash(i * 2.9) * H, 1.2, 1.2); }
      const li = Song.lastStarted(t);
      const L = li >= 0 ? LINES[li] : null;
      const c = L ? couplet(L.i) : -1;
      const cs = c >= 0 ? LINES.find((x) => couplet(x.i) === c) : null;
      const ce = c >= 0 ? LINES.filter((x) => couplet(x.i) === c).pop() : null;
      // camera: a fresh framing per couplet (a cut), then a slow push and a breath of handheld drift
      const since = cs ? t - cs.start : t;
      const push = 1 + 0.05 * clamp(since / 8, 0, 1) + 0.008 * Song.beat(t).barEnv;
      const ox = (c >= 0 ? (hash(c * 4.4) - 0.5) * W * 0.04 : 0) + Math.sin(t * 0.7) * S * 0.003, oy = (c >= 0 ? (hash(c * 6.1) - 0.5) * H * 0.03 : 0) + Math.cos(t * 0.9) * S * 0.003;
      ctx.save(); ctx.translate(W / 2 + ox, H / 2 + oy); ctx.scale(push, push); ctx.translate(-W / 2, -H / 2);
      // clock: the song's own time, in a thin face
      const secs = Math.floor(t), clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = 'rgba(220,224,240,0.62)'; ctx.font = F.tight(600, S * 0.024); if ('letterSpacing' in ctx) ctx.letterSpacing = `${S * 0.002}px`;
      ctx.fillText(Song.section(t).name.toUpperCase(), W / 2, H * (tall ? 0.13 : 0.12));
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      ctx.fillStyle = 'rgba(214,218,236,0.82)'; ctx.font = F.tight(300, S * (tall ? 0.15 : 0.13)); ctx.fillText(clock, W / 2, H * (tall ? 0.24 : 0.26));
      // intro / break / outro: the song title floats where the stars will be
      const tf = titleFade(t);
      if (tf > 0 && (!L || t > (ce ? ce.end + 1.2 : 0) || t < LINES[0].start)) {
        ctx.globalAlpha = tf; ctx.fillStyle = '#eef0fa'; ctx.font = F.tight(700, S * 0.05); ctx.fillText(TITLE, W / 2, H * 0.6);
        ctx.fillStyle = 'rgba(200,205,225,0.7)'; ctx.font = F.tight(500, S * 0.022); ctx.fillText(ARTIST, W / 2, H * 0.6 + S * 0.05); ctx.globalAlpha = 1;
        sparkle(ctx, W / 2, H * 0.6 - S * 0.09, S * 0.016 * (1 + 0.3 * Song.beat(t).env), tf);
      }
      if (L) {
        const lay = constLayout(c, W, H);
        const fadeOut = 1 - smooth(ce.end + 0.5, ce.end + 1.3, t);
        const pts = lay.pts.filter((p) => p.w.s - 0.2 <= t);
        if (pts.length && fadeOut > 0) {
          ctx.globalAlpha = fadeOut;
          const cur = pts[pts.length - 1];
          // lines: each drawn as the spark travels it, landing on the syllable
          ctx.lineWidth = Math.max(1, S * 0.0016); ctx.lineCap = 'round';
          for (let k = 1; k < pts.length; k++) {
            const a = pts[k - 1], b = pts[k];
            const p = smooth(b.w.s - 0.2, b.w.s, t);
            const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y); g.addColorStop(0, 'rgba(190,198,235,0.35)'); g.addColorStop(1, 'rgba(225,230,255,0.7)');
            ctx.strokeStyle = g; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(lerp(a.x, b.x, p), lerp(a.y, b.y, p)); ctx.stroke();
          }
          // nodes and labels
          for (const q of pts) {
            const isCur = q === cur, w = q.w;
            const landed = t >= w.s;
            const age = t - w.s;
            const voice = t < w.e ? 1 : Math.exp(-(t - w.e) * 2.5);
            const big = held(w) || w.k === LINES[LINES.indexOf(LINES.find((x) => x.words.includes(w)))].words.length - 1;
            const peak = big ? S * 0.085 : S * 0.05;
            const settle = isCur ? 1 : 1 - smooth(0, 0.3, t - (pts[pts.indexOf(q) + 1] ? pts[pts.indexOf(q) + 1].w.s : 1e9));
            const pop = easeBack(clamp(age / 0.16, 0, 1));
            const size = landed ? lerp(S * 0.022, peak, settle * (big ? Math.max(voice, 0.35) : 1)) * (0.85 + 0.15 * pop) : 0;
            ctx.fillStyle = '#dfe3f6';
            sparkle(ctx, q.x, q.y, S * (isCur ? 0.012 : 0.008), landed ? 1 : 0.4);
            if (isCur && landed) {
              const env = leadEnv(t);
              ctx.strokeStyle = `rgba(230,235,255,${0.5 * voice + 0.25 * env})`; ctx.lineWidth = Math.max(1, S * 0.0018);
              ctx.beginPath(); ctx.arc(q.x, q.y, S * (0.02 + 0.006 * env + 0.004 * Song.beat(t).env), 0, TAU); ctx.stroke();
              ctx.fillStyle = '#ffffff'; sparkle(ctx, q.x, q.y, S * (0.016 + 0.01 * voice * env), 1);
            }
            if (size > 0) {
              ctx.font = F.tight(isCur || settle > 0.5 ? 700 : 600, size);
              ctx.textBaseline = 'middle';
              const bright = isCur ? 0.98 : lerp(0.55, 0.95, settle);
              ctx.fillStyle = `rgba(232,236,252,${bright})`;
              const dx = q.side * (S * 0.022 + size * 0.15), dy = isCur && big ? S * 0.03 : -S * 0.018;
              ctx.textAlign = q.side > 0 ? 'left' : 'right';
              ctx.fillText(w.text, q.x + dx, q.y + dy);
            }
          }
          // the travelling spark between nodes
          const nxt = lay.pts.find((p) => p.w.s > t);
          if (nxt && t > nxt.w.s - 0.2) {
            const p = smooth(nxt.w.s - 0.2, nxt.w.s, t);
            ctx.fillStyle = '#ffffff'; sparkle(ctx, lerp(cur.x, nxt.x, p), lerp(cur.y, nxt.y, p), S * 0.014, 1);
          }
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
    },
  });

  // ---------- Typecut ----------
  // Fast-edit lyric style: a hard cut to a new framing on every downbeat (every two beats in the chorus), the word typed
  // out letter by letter as it is sung, held notes stretching their last letter, and the line dying with the voice.
  const TC_FRAMES = ['center', 'corner', 'invert', 'stack', 'serif', 'mono'];
  MOTION.push({
    id: 'typecut', name: 'Typecut', family: 'Live motion',
    from: 'Fast-cut fan lyric edits: hard cuts on the beat, typed-out words and stretched held notes.',
    what: 'Hard cuts to a new framing land on every downbeat, twice as often in the chorus. Each word types itself out letter by letter as it is sung, held notes stretch their last letter while the voice holds (“bloommm…”), and the line fades as the voice dies. A two-frame flash marks each cut.',
    post: POST({ thresh: 0.95, bloom: 0.3, grain: 0.05, ca: 0.25, vig: 0.45, boost: 0, exp: 1.12 }),
    draw(ctx, W, H, t) {
      const S = Math.min(W, H), tall = H > W;
      const sec = Song.section(t), chorus = sec.name === 'Chorus';
      const unit = chorus ? 2 * BEAT : BAR;
      const cut = Math.floor(t / unit), cutT = t - cut * unit;
      const frame = TC_FRAMES[Math.floor(hash(cut * 3.7 + 1) * TC_FRAMES.length)];
      const inv = frame === 'invert';
      const bgc = inv ? '#f2efe9' : '#07060a', fg = inv ? '#0b0a0f' : '#f6f3ee', acc = '#ff7a5c';
      ctx.fillStyle = bgc; ctx.fillRect(0, 0, W, H);
      if (frame === 'corner' || frame === 'serif') { ctx.save(); ctx.globalAlpha = 0.5; if (HAS_FILTER2) ctx.filter = 'blur(2px) saturate(1.2)'; const z = Math.max(W, H) * (1.3 + 0.2 * hash(cut)); ctx.drawImage(cover, (W - z) * hash(cut * 1.9), (H - z) * hash(cut * 2.3), z, z); ctx.restore(); ctx.fillStyle = 'rgba(5,4,8,0.55)'; ctx.fillRect(0, 0, W, H); }
      // the line: words so far, current word typed by syllable timing
      const hit = Song.lineAt(t);
      const L = hit ? hit.L : null;
      const words = [];
      if (L) {
        for (const w of L.words) {
          if (t < w.s) break;
          const dur = Math.max(0.08, Math.min(w.e - w.s, 0.32));
          const n = Math.min(w.text.length, Math.ceil(w.text.length * clamp((t - w.s) / dur, 0, 1)));
          let txt = w.text.slice(0, n);
          if (held(w) && n === w.text.length && t < w.e + 0.1) {
            const base = w.text.replace(/[^a-z]+$/i, ''); const last = base.slice(-1);
            const extra = Math.min(6, Math.floor((t - w.s - dur) / 0.13));
            txt = base + last.repeat(Math.max(0, extra)) + w.text.slice(base.length) + (extra > 3 ? '…' : '');
          }
          words.push({ w, txt, typing: n < w.text.length, cur: w === Song.curWord(L, t) });
        }
      } else if (titleFade(t) > 0) {
        const k = Math.ceil(TITLE.length * clamp((t % BAR) / 0.6, 0, 1));
        words.push({ w: { s: 0, e: 1e9 }, txt: TITLE.toLowerCase().slice(0, k), typing: k < TITLE.length, cur: true });
      }
      const lastSung = L ? L.words[L.words.length - 1] : null;
      const voiceFade = lastSung && t > lastSung.e ? Math.exp(-(t - lastSung.e) * 2.6) : 1;
      ctx.globalAlpha = voiceFade * (L ? 1 : titleFade(t));
      const caret = (x, y, h) => { if (Math.floor(t * 4) % 2 === 0) { ctx.fillStyle = acc; ctx.fillRect(x + h * 0.06, y - h * 0.42, Math.max(2, h * 0.07), h * 0.84); } };
      ctx.textBaseline = 'middle';
      if (!inv) { ctx.shadowColor = 'rgba(255,240,230,0.35)'; ctx.shadowBlur = S * 0.03; }
      if (frame === 'center' || frame === 'invert') {
        // the current word huge, the rest of the line small above it
        const cw = words.find((x) => x.cur) || words[words.length - 1];
        if (cw) {
          ctx.textAlign = 'center';
          const prev = words.filter((x) => x !== cw).map((x) => x.txt).join(' ');
          ctx.font = F.tight(600, S * 0.032); ctx.fillStyle = inv ? 'rgba(11,10,15,0.55)' : 'rgba(246,243,238,0.55)'; ctx.fillText(prev.toLowerCase(), W / 2, H / 2 - S * 0.16);
          let px = S * 0.24; ctx.font = F.tight(900, px); const mw = ctx.measureText(cw.txt.toLowerCase()).width; if (mw > W * 0.9) { px *= W * 0.9 / mw; ctx.font = F.tight(900, px); }
          const sq = 1 + 0.05 * Song.beat(t).env;
          ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(sq, 1 / sq); ctx.fillStyle = fg; if ('letterSpacing' in ctx) ctx.letterSpacing = `${-px * 0.04}px`; ctx.fillText(cw.txt.toLowerCase(), 0, 0); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
          if (cw.typing) caret(ctx.measureText(cw.txt.toLowerCase()).width / 2, 0, px);
          ctx.restore();
        }
      } else if (frame === 'stack') {
        // words stacked as a left-aligned column, the newest one in the accent colour
        ctx.textAlign = 'left';
        const px = S * (tall ? 0.1 : 0.085), x0 = W * 0.08;
        const y0 = H / 2 - (words.length - 1) * px * 0.5;
        words.forEach((x, i) => { ctx.font = F.tight(900, px); ctx.fillStyle = x.cur ? acc : fg; ctx.fillText(x.txt.toUpperCase(), x0, y0 + i * px * 0.96); if (x.cur && x.typing) caret(x0 + ctx.measureText(x.txt.toUpperCase()).width, y0 + i * px * 0.96, px); });
      } else if (frame === 'serif') {
        ctx.textAlign = 'center';
        const txt = words.map((x) => x.txt).join(' ');
        let px = S * 0.12; ctx.font = F.serif(px, true); const mw = ctx.measureText(txt).width; if (mw > W * 0.86) { px *= W * 0.86 / mw; ctx.font = F.serif(px, true); }
        ctx.fillStyle = fg; ctx.fillText(txt, W / 2, H / 2);
      } else if (frame === 'mono') {
        ctx.textAlign = 'left';
        const px = S * 0.05, x0 = W * 0.08; let y = H * 0.4;
        ctx.font = `500 ${px * 0.5}px "JetBrains Mono", monospace`; ctx.fillStyle = 'rgba(246,243,238,0.45)'; ctx.fillText(`> ${TITLE.toLowerCase()} · ${sec.name.toLowerCase()} · ${Song.beat(t).i % 4 + 1}/4`, x0, y - px * 1.4);
        ctx.font = `600 ${px}px "JetBrains Mono", monospace`;
        let x = x0;
        for (const wd of words) { const s = wd.txt + ' '; const ww = ctx.measureText(s).width; if (x + ww > W * 0.92) { x = x0; y += px * 1.3; } ctx.fillStyle = wd.cur ? acc : fg; ctx.fillText(s, x, y); x += ww; if (wd.cur && wd.typing) caret(x - ctx.measureText(' ').width, y, px); }
      } else {
        // corner: lower-left caption over the cut-up cover
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        const px = S * 0.075, x0 = W * 0.07; const txt = words.map((x) => x.txt).join(' ');
        ctx.font = F.tight(800, px); ctx.fillStyle = fg; ctx.fillText(txt.toLowerCase(), x0, H * 0.86);
        const cw = words[words.length - 1]; if (cw && cw.typing) { ctx.textBaseline = 'middle'; caret(x0 + ctx.measureText(txt.toLowerCase()).width, H * 0.86 - px * 0.35, px); }
        ctx.font = F.tight(600, S * 0.022); ctx.fillStyle = acc; ctx.fillText(sec.name.toUpperCase(), x0, H * 0.86 - px * 1.1);
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      // the cut: a two-frame flash and a sliver of misregistration
      if (cutT < 1 / 15 && !REDUCED_M) { ctx.fillStyle = inv ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.35)'; ctx.fillRect(0, 0, W, H); }
    },
  });
  const HAS_FILTER2 = (() => { try { const c = document.createElement('canvas').getContext('2d'); c.filter = 'blur(2px)'; return c.filter === 'blur(2px)'; } catch { return false; } })();
  let REDUCED_M = false; try { REDUCED_M = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* none */ }
  LOOKS.unshift(...MOTION.map((l) => Object.assign(l, { kind: '2d' })));

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
    wrap.dataset.aspect = state.aspect;
    const bw = wrap.clientWidth, maxH = Math.min(window.innerHeight * (portrait ? 0.74 : 0.7), 900) - (portrait ? 28 : 0);
    let w = bw, h = portrait ? bw * 16 / 9 : bw * 9 / 16;
    if (h > maxH) { h = maxH; w = portrait ? h * 9 / 16 : h * 16 / 9; }
    const dpr = Math.min(1.75, window.devicePixelRatio || 1);
    stage.style.width = `${w}px`; stage.style.height = `${h}px`;
    stage2.width = Math.round(w * dpr); stage2.height = Math.round(h * dpr);
    CLASSIC.resize();
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
    if (Lk.kind === '2d') {
      gl.bindTexture(gl.TEXTURE_2D, texPic); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, stage2);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    } else drawMask(Lk, t);
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
    if (Lk.kind === '2d') { gl.useProgram(P_PIC.p); setU(P_PIC, U); setU(P_PIC, { uBoost: Lk.post.boost == null ? 1 : Lk.post.boost }); bindTex(P_PIC, 'uPic', 0, texPic); }
    else { gl.useProgram(Lk.prog.p); setU(Lk.prog, U); bindCommon(Lk.prog, FB.simA.tex); }
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
    const is2d = L.kind === '2d';
    if (is2d) {
      ctx2.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
      ctx2.globalAlpha = 1; ctx2.globalCompositeOperation = 'source-over'; ctx2.textAlign = 'left'; ctx2.textBaseline = 'alphabetic'; ctx2.shadowBlur = 0; ctx2.filter = 'none';
      ctx2.clearRect(0, 0, state.W, state.H);
      ctx2.save();
      try { L.draw(ctx2, state.W, state.H, state.t, state.dpr); } catch (e) { console.error(L.id, e); }
      ctx2.restore();
    }
    const jump = state.lastFrameT == null || Math.abs(state.t - state.lastFrameT) > 0.5 || dt < 0;
    try { if (jump && L.sim) warm(state.t); else draw(state.t, jump ? 0 : clamp(dt, 0, 1 / 20)); } catch (e) { console.error(L.id, e); }
    state.lastFrameT = state.t;
    const sec = Song.section(state.t);
    $('#time').textContent = `${fmt(state.t)} / ${fmt(DURATION)}`;
    $('#section').textContent = sec.name;
    for (const b of document.querySelectorAll('.sec')) b.setAttribute('aria-current', String(+b.dataset.i === sec.i));
    $('#scrub').style.setProperty('--p', `${(state.t / DURATION) * 100}%`);
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
    $('#play').setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
    $('#play').setAttribute('aria-pressed', String(state.playing));
    $('#play .pl').style.display = state.playing ? 'none' : ''; $('#play .pa').style.display = state.playing ? '' : 'none';
    $('#sound').setAttribute('aria-label', state.sound ? 'Mute' : 'Unmute');
    $('#sound').setAttribute('aria-pressed', String(state.sound));
    for (const b of document.querySelectorAll('[data-aspect-btn]')) b.setAttribute('aria-pressed', String(b.dataset.aspectBtn === state.aspect));
  }
  function select(i, fromHash) {
    state.look = (i + LOOKS.length) % LOOKS.length;
    const L = LOOKS[state.look];
    for (const b of document.querySelectorAll('.look')) b.setAttribute('aria-current', String(b.dataset.id === L.id));
    $('#lookName').textContent = L.name;
    $('#lookFamily').textContent = L.family;
    $('#nowName').textContent = L.name; const tag = $('#nowTag'); tag.classList.add('show'); clearTimeout(select.tm); select.tm = setTimeout(() => tag.classList.remove('show'), 1600);
    $('#lookFrom').textContent = L.from;
    $('#lookWhat').textContent = L.what;
    $('#lookNote').hidden = !L.stateful;
    $('#lookNote').textContent = L.kind === '2d' ? 'This look keeps a feedback buffer between frames, so after a jump it needs a moment to build its trails.' : 'This look runs a small fluid simulation, so after a jump it replays the last few seconds to rebuild the ink.';
    if (!fromHash) { try { history.replaceState(null, '', `#${L.id}`); } catch { location.hash = L.id; } }
    state.lastFrameT = null;
    render(0);
  }

  function buildList() {
    const list = $('#looks');
    const fams = [...new Set(LOOKS.map((l) => l.family))];
    for (const f of fams) {
      const h = document.createElement('h3'); h.textContent = f; list.appendChild(h);
      const row = document.createElement('div'); row.className = 'grid';
      LOOKS.forEach((l, i) => {
        if (l.family !== f) return;
        const b = document.createElement('button'); b.className = 'look'; b.dataset.id = l.id; b.type = 'button';
        b.innerHTML = `<span class="thumb"><img alt="" data-thumb="${l.id}"></span><span class="t">${l.name}</span>`;
        b.addEventListener('click', () => select(i));
        row.appendChild(b);
      });
      list.appendChild(row);
    }
  }

  // library thumbnails: each look is rendered once at a chorus moment, between frames, so the stage never flickers
  const thumbCan = document.createElement('canvas'); thumbCan.width = 384; thumbCan.height = 216;
  let thumbQ = [];
  function thumbNext() {
    if (!thumbQ.length) return;
    if (state.aspect !== 'wide' || state.playing) { setTimeout(thumbNext, 800); return; }
    const i = thumbQ.shift(), keep = state.look, keepT = state.t;
    try {
      state.look = i; state.t = LOOKS[i].thumbT || 24.6; state.lastFrameT = null; render(0);
      thumbCan.getContext('2d').drawImage(stage, 0, 0, 384, 216);
      const img = document.querySelector(`img[data-thumb="${LOOKS[i].id}"]`);
      if (img) { img.src = thumbCan.toDataURL('image/jpeg', 0.85); img.classList.add('ok'); }
    } catch (e) { console.error('thumb', e); }
    state.look = keep; state.t = keepT; state.lastFrameT = null; render(0);
    setTimeout(thumbNext, 60);
  }

  function fromHash() { const id = (location.hash || '').slice(1); const i = LOOKS.findIndex((l) => l.id === id); if (i >= 0) select(i, true); }

  buildList();
  $('#count').textContent = `${LOOKS.length} looks`;
  $('#play').addEventListener('click', () => play(!state.playing));
  $('#sound').addEventListener('click', () => { state.sound = !state.sound; if (state.playing) { if (state.sound) startSound(); else stopSound(); } syncButtons(); });
  $('#prev').addEventListener('click', () => select(state.look - 1));
  $('#next').addEventListener('click', () => select(state.look + 1));
  for (const b of document.querySelectorAll('[data-aspect-btn]')) b.addEventListener('click', () => { state.aspect = b.dataset.aspectBtn; size(); syncButtons(); state.lastFrameT = null; render(0); });
  const sc = $('#scrub'); sc.max = String(Math.floor(DURATION * 10));
  sc.addEventListener('input', () => seek(Number(sc.value) / 10));
  for (const s of SECTIONS) { const b = document.createElement('button'); b.type = 'button'; b.className = 'sec'; b.dataset.i = s.i; b.textContent = s.name; { const k = document.createElement('i'); k.style.left = `${(s.start / DURATION) * 100}%`; if (s.i) $('#ticks').appendChild(k); } b.addEventListener('click', () => seek(s.start + (s.name === 'Intro' ? 0 : 0.01))); $('#sections').appendChild(b); }
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
  const fontsReady = document.fonts && document.fonts.load ? Promise.all(['300 40px "Inter Tight"', '600 40px "Inter Tight"', '700 40px "Inter Tight"', '800 40px "Inter Tight"', '900 40px "Inter Tight"', '400 40px "Instrument Serif"', 'italic 400 40px "Instrument Serif"', '800 40px "Bricolage Grotesque"', '800 40px Inter', '400 40px Anton', '700 40px "Space Grotesk"', '500 40px "JetBrains Mono"', '400 40px "Permanent Marker"'].map((f) => document.fonts.load(f).catch(() => null))) : Promise.resolve();
  fontsReady.then(() => { for (const v of swarmCache.values()) gl.deleteTexture(v.tex); swarmCache.clear(); CLASSIC.fontsLoaded(); state.lastFrameT = null; render(0); window.__labReady = true; if (!/nothumbs/.test(location.search)) { thumbQ = LOOKS.map((_, i) => i); setTimeout(thumbNext, 400); } });
  requestAnimationFrame((n) => { state.last = n; tick(n); });
  // test hook: draw a given look at a given time (used by the screenshot check)
  window.__lab = { looks: LOOKS.map((l) => l.id), show(id, t, aspect) { if (aspect && aspect !== state.aspect) { state.aspect = aspect; size(); syncButtons(); } state.playing = false; stopSound(); state.t = t; select(LOOKS.findIndex((l) => l.id === id)); } };
})();
