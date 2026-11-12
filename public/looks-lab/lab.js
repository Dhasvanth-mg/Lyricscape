// Looks Lab: twenty lyric looks, each an original take on a genre of lyric or music graphics, playing one original demo song.
// Every look is a function (ctx, W, H, t) drawn from song time only, except Warp, whose feedback buffer carries over between frames.
// Sound is a small synth scheduled from the same event list the visuals read, so the spectrum and the audio agree.
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
  // Margin notes for Marginalia: line index -> [first word, last word, note]
  const NOTES = { 2: [3, 6, 'a goodbye that washes off'], 5: [2, 5, 'noise as company'], 9: [1, 4, 'letters never sent'], 11: [3, 4, 'refusing the ending'] };

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
      const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#26395c'); g.addColorStop(1, '#5b2a5e');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.beginPath(); ctx.arc(W * 0.8, H * 0.25, Math.min(W, H) * 0.35, 0, TAU); ctx.fill();
      const win = (x, y, w, h) => { ctx.fillStyle = 'rgba(245,245,250,0.9)'; roundRect(ctx, x, y, w, h, 8); ctx.fill(); ctx.fillStyle = 'rgba(30,30,40,0.08)'; ctx.fillRect(x, y + 26, w, 1); for (let k = 0; k < 3; k++) { ctx.fillStyle = '#c7c7d1'; ctx.beginPath(); ctx.arc(x + 16 + k * 14, y + 13, 4, 0, TAU); ctx.fill(); } for (let r = 0; r < 6; r++) { ctx.fillStyle = '#e1e1e8'; roundRect(ctx, x + 18, y + 44 + r * 20, (w - 36) * (0.4 + 0.6 * hash(r + x)), 8, 4); ctx.fill(); } };
      if (H > W) { win(W * 0.08, H * 0.08, W * 0.84, H * 0.3); } else { win(W * 0.06, H * 0.08, W * 0.42, H * 0.46); win(W * 0.52, H * 0.16, W * 0.4, H * 0.36); }
      const fs = H > W ? W * 0.066 : Math.min(H * 0.065, W * 0.04);
      const sy = H * 0.7, sh = fs * 3.4, sx = W * 0.04, sw = W * 0.92;
      ctx.fillStyle = 'rgba(10,8,16,0.42)'; roundRect(ctx, sx, sy, sw, sh, fs * 0.5); ctx.fill();
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
          wipeWord(ctx, w.text, wx, 0, p, '#fff', sungGrad(wx, ww), fs * 0.16, 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0.85)');
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

  // ---------- app shell ----------
  const $ = (s) => document.querySelector(s);
  const stage = $('#stage'), ctx = stage.getContext('2d');
  const state = { look: 0, t: 12.2, playing: false, last: 0, aspect: 'wide', sound: true };
  try { REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* no media query support */ }

  function size() {
    const wrap = $('#stageWrap');
    const portrait = state.aspect === 'tall';
    wrap.dataset.aspect = state.aspect;
    const bw = wrap.clientWidth, maxH = Math.min(window.innerHeight * 0.72, 900);
    let w = bw, h = portrait ? bw * 16 / 9 : bw * 9 / 16;
    if (h > maxH) { h = maxH; w = portrait ? h * 9 / 16 : h * 16 / 9; }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    stage.style.width = `${w}px`; stage.style.height = `${h}px`;
    stage.width = Math.round(w * dpr); stage.height = Math.round(h * dpr);
    state.W = w; state.H = h; state.dpr = dpr;
    kinCache.clear();
  }

  function render() {
    const L = LOOKS[state.look];
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.shadowBlur = 0; ctx.filter = 'none';
    ctx.clearRect(0, 0, state.W, state.H);
    ctx.save();
    try { L.draw(ctx, state.W, state.H, state.t, state.dpr); } catch (e) { console.error(L.id, e); }
    ctx.restore();
    const sec = Song.section(state.t);
    $('#time').textContent = `${fmt(state.t)} / ${fmt(DURATION)}`;
    $('#section').textContent = sec.name;
    const sc = $('#scrub'); if (document.activeElement !== sc) sc.value = String(Math.round(state.t * 10));
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
    if (state.playing) {
      if (out && ac) state.t = ac.currentTime - base;
      else state.t += Math.min(0.1, (now - state.last) / 1000);
      if (state.t >= DURATION) { state.t = 0; if (out) { stopSound(); startSound(); } }
    }
    state.last = now;
    render();
    requestAnimationFrame(tick);
  }
  function play(on) { state.playing = on; if (on) startSound(); else stopSound(); syncButtons(); }
  function seek(t) { state.t = clamp(t, 0, DURATION - 0.01); if (state.playing) { stopSound(); startSound(); } render(); }
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
    $('#lookFamily').textContent = `${L.family} · roadmap phase ${L.phase}`;
    $('#lookFrom').textContent = L.from;
    $('#lookWhat').textContent = L.what;
    $('#lookNote').hidden = !L.stateful;
    if (!fromHash) { try { history.replaceState(null, '', `#${L.id}`); } catch { location.hash = L.id; } }
    render();
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
  for (const b of document.querySelectorAll('[data-aspect-btn]')) b.addEventListener('click', () => { state.aspect = b.dataset.aspectBtn; size(); syncButtons(); render(); });
  const sc = $('#scrub'); sc.max = String(Math.floor(DURATION * 10));
  sc.addEventListener('input', () => seek(Number(sc.value) / 10));
  for (const s of SECTIONS) { const b = document.createElement('button'); b.type = 'button'; b.className = 'sec'; b.textContent = s.name; b.addEventListener('click', () => seek(s.start + (s.name === 'Intro' ? 0 : 0.01))); $('#sections').appendChild(b); }
  window.addEventListener('keydown', (e) => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') && e.key === ' ') return;
    if (e.key === 'ArrowRight') select(state.look + 1);
    else if (e.key === 'ArrowLeft') select(state.look - 1);
    else if (e.key === ' ') { e.preventDefault(); play(!state.playing); }
  });
  window.addEventListener('resize', () => { size(); render(); });
  window.addEventListener('hashchange', fromHash);
  size();
  select(0, true);
  fromHash();
  syncButtons();
  const fontsReady = document.fonts && document.fonts.load ? Promise.all(['800 40px Inter', '400 40px Anton', '700 40px "Space Grotesk"', '400 40px "Instrument Serif"', 'italic 400 40px "Instrument Serif"', '500 40px "JetBrains Mono"', '400 40px "Permanent Marker"'].map((f) => document.fonts.load(f).catch(() => null))) : Promise.resolve();
  fontsReady.then(() => { ptsCache.clear(); kinCache.clear(); render(); });
  requestAnimationFrame((n) => { state.last = n; tick(n); });
  // test hook: draw a given look at a given time (used by the screenshot check)
  window.__lab = { looks: LOOKS.map((l) => l.id), show(id, t, aspect) { if (aspect && aspect !== state.aspect) { state.aspect = aspect; size(); } state.playing = false; stopSound(); select(LOOKS.findIndex((l) => l.id === id)); state.t = t; render(); } };
})();
