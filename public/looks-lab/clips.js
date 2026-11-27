// Looks Lab: nine looks built from the owner's reference clips (Nov 2026). Each is an original take on a genre of
// fan lyric edit, drawn with Canvas 2D and finished by the lab's shared GPU camera stage (lab.js).
// Everything reads song time only: a word appears when it is sung, a held note stretches while the voice holds,
// text fades as the voice dies, and cuts land on the beat or on the syllable. Nothing runs on a fixed timer.
// lab.js calls window.LyricscapeClipLooks(api) once, with its song model and helpers, and adds what it returns.
(() => {
  'use strict';

  window.LyricscapeClipFonts = ['400 40px Arimo', '700 40px Arimo', '400 40px "DM Serif Display"', '400 40px "Gochi Hand"', '700 40px Caveat', '400 40px "Bowlby One"', '400 40px Silkscreen', '700 40px Silkscreen', '800 40px "Baloo Thambi 2"', '400 40px Anton'];

  window.LyricscapeClipLooks = (A) => {
    const { Song, LINES, F, POST, hash, lerp, clamp, smooth, ease, easeBack, TAU, held, couplet, cutAt, kickEnv, titleFade } = A;
    const LOOKS = [];
    const FAMILY = 'From your clips';

    // ---------- caches, cleared when the song or the fonts change ----------
    const caches = [];
    const cache = () => { const m = new Map(); caches.push(m); return m; };
    const clearAll = () => { for (const m of caches) m.clear(); };
    // lab.js sets up its song listeners after registering looks, so subscribe once it has finished loading
    Promise.resolve().then(() => A.onSong(clearAll));
    try { document.fonts.addEventListener('loadingdone', clearAll); } catch { /* no font events */ }

    // ---------- timing helpers ----------
    const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
    const gcache = new Map();
    const graphemes = (s) => { let g = gcache.get(s); if (!g) { g = seg ? Array.from(seg.segment(s), (x) => x.segment) : Array.from(s); gcache.set(s, g); } return g; };
    /** the part of a word sung so far, typed out across its first syllables */
    const typedText = (w, t, maxDur = 0.35) => {
      const g = graphemes(w.text), d = Math.max(0.06, Math.min(w.e - w.s, maxDur));
      return g.slice(0, Math.min(g.length, Math.ceil(g.length * clamp((t - w.s) / d, 0.0001, 1)))).join('');
    };
    /** 0..1 while a held note holds, easing back once it is released */
    /** a really long note (longer than a second): the ones worth a special treatment */
    const longNote = (w) => w.e - w.s > 1.0;
    const stretchOf = (w, t) => (!w || !held(w) || t < w.s ? 0 : t <= w.e ? smooth(w.s + 0.08, w.e, t) : Math.exp(-(t - w.e) * 5));
    /** 1 while the word is sung, then dying away with the voice */
    const voiceOf = (w, t, k = 2.6) => (!w || t < w.s ? 0 : t <= w.e ? 1 : Math.exp(-(t - w.e) * k));
    /** the line under the voice: its words, the current word, and a fade that follows the voice out */
    function now(t) {
      const hit = Song.lineAt(t); if (!hit) return null;
      const L = hit.L, last = L.words[L.words.length - 1], w = Song.curWord(L, t);
      const fade = (t > last.e ? Math.exp(-(t - last.e) * 1.4) : 1) * (1 - smooth(hit.until - 0.25, hit.until, t)) * smooth(L.start - 0.25, L.start + 0.02, t);
      return { L, w, hit, fade, last, sung: L.words.filter((x) => x.s <= t) };
    }
    const bare = (s) => s.replace(/^[^\p{L}\p{M}\p{N}']+|[^\p{L}\p{M}\p{N}']+$/gu, '');
    const beatOf = (t) => Song.beat(t);
    const REDUCED = () => A.reduced;
    const pick = (arr, x) => arr[Math.floor(clamp(x, 0, 0.9999) * arr.length)];
    /** the running index of a line's first word across the whole song (for alternation that never repeats per line) */
    const wordBase = cache();
    function baseIndex(L) {
      if (wordBase.has(L.i)) return wordBase.get(L.i);
      let n = 0; for (const x of LINES) { if (x === L) break; n += x.words.length; }
      wordBase.set(L.i, n); return n;
    }

    // ---------- drawing helpers ----------
    const wob = (pts, seed, amp) => pts.map(([x, y], i) => [x + (hash(seed + i * 1.37) - 0.5) * amp, y + (hash(seed * 1.91 + i * 2.17 + 5) - 0.5) * amp]);
    /** a smooth path through points: the hand-drawn line every doodle uses */
    function curve(ctx, pts, closed) {
      const n = pts.length; ctx.beginPath();
      if (closed) {
        ctx.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2);
        for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
        ctx.closePath();
      } else {
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < n - 1; i++) { const p = pts[i], q = pts[i + 1]; ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
        ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
      }
    }
    const ell = (cx, cy, rx, ry, n = 24, a0 = 0) => Array.from({ length: n }, (_, i) => { const a = a0 + (i / n) * TAU; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
    function heartPath(ctx, x, y, s) {
      ctx.beginPath(); ctx.moveTo(x, y + s * 0.42);
      ctx.bezierCurveTo(x - s * 1.0, y - s * 0.2, x - s * 0.5, y - s * 0.95, x, y - s * 0.42);
      ctx.bezierCurveTo(x + s * 0.5, y - s * 0.95, x + s * 1.0, y - s * 0.2, x, y + s * 0.42); ctx.closePath();
    }
    function starPath(ctx, x, y, r, n = 5, inner = 0.45, rot = -Math.PI / 2) {
      ctx.beginPath();
      for (let i = 0; i < n * 2; i++) { const rr = i % 2 ? r * inner : r, a = rot + (i / (n * 2)) * TAU; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      ctx.closePath();
    }
    function rrect(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(clamp(v * k, 0, 255))); return `rgb(${c[0]},${c[1]},${c[2]})`; };
    const spacing = (ctx, px) => { if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`; };

    /** an offscreen layer at device resolution, cleared, with CSS-pixel coordinates */
    const layers = new Map();
    function layer(key, W, H, dpr) {
      let c = layers.get(key); if (!c) { c = document.createElement('canvas'); layers.set(key, c); }
      const w = Math.max(1, Math.round(W * dpr)), h = Math.max(1, Math.round(H * dpr));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      const x = c.getContext('2d');
      x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.shadowBlur = 0; x.filter = 'none';
      x.clearRect(0, 0, w, h); x.setTransform(dpr, 0, 0, dpr, 0, 0);
      return x;
    }
    /** speckles for distressed ink and crayon grain (opaque dots on transparent) */
    const texCache = new Map();
    function speckles(key, size, n, r0, r1, seed, streaks = 0) {
      if (texCache.has(key)) return texCache.get(key);
      const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
      x.fillStyle = '#000';
      for (let i = 0; i < n; i++) {
        const r = lerp(r0, r1, Math.pow(hash(seed + i * 3.1), 3));
        x.globalAlpha = 0.55 + 0.45 * hash(seed + i * 7.7);
        x.beginPath(); x.arc(hash(seed + i * 1.3) * size, hash(seed + i * 2.9) * size, r, 0, TAU); x.fill();
      }
      x.globalAlpha = 0.8; x.strokeStyle = '#000';
      for (let i = 0; i < streaks; i++) {
        const sx = hash(seed + i * 5.3) * size, sy = hash(seed + i * 6.1) * size, a = (hash(seed + i * 8.3) - 0.5) * 0.6 + Math.PI / 2, l = size * (0.05 + 0.2 * hash(i * 9.9 + seed));
        x.lineWidth = 0.5 + hash(i + seed) * 1.5; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + Math.cos(a) * l, sy + Math.sin(a) * l); x.stroke();
      }
      texCache.set(key, c); return c;
    }
    /** fine pixel grain: a fraction of pixels opaque, the rest clear */
    function grain(key, size, density, seed) {
      if (texCache.has(key)) return texCache.get(key);
      const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
      const img = x.createImageData(size, size);
      for (let i = 0; i < size * size; i++) { const h = hash(seed + i * 0.731); if (h < density) img.data[i * 4 + 3] = 140 + 115 * hash(i * 1.37 + seed); }
      x.putImageData(img, 0, 0); texCache.set(key, c); return c;
    }
    /** wipe a pattern out of a layer (or paint it in another colour), shifted each boil frame */
    function patternOver(ctx, tex, W, H, op, color, shift, scale = 1) {
      const p = ctx.createPattern(tex, 'repeat'); if (!p) return;
      ctx.save(); ctx.globalCompositeOperation = op;
      if (color) {
        // tint the pattern: draw it on a scratch canvas filled with the colour
        const key = `${tex.width}:${color}`; let tc = texCache.get(key);
        if (!tc) { tc = document.createElement('canvas'); tc.width = tc.height = tex.width; const x = tc.getContext('2d'); x.drawImage(tex, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, tex.width, tex.width); texCache.set(key, tc); }
        const p2 = ctx.createPattern(tc, 'repeat'); ctx.fillStyle = p2;
      } else ctx.fillStyle = p;
      ctx.translate(-shift[0], -shift[1]); ctx.scale(scale, scale);
      ctx.fillRect(0, 0, (W + shift[0] + 2) / scale, (H + shift[1] + 2) / scale);
      ctx.restore();
    }
    /** flow words into rows at a font, then shrink until the block fits the box */
    function flowRows(ctx, items, maxW, gap) {
      const rows = []; let row = [], w = 0;
      for (const it of items) {
        const x = row.length ? w + gap : 0;
        if (row.length && x + it.ww > maxW) { rows.push({ items: row, width: w }); row = []; w = 0; }
        it.x = row.length ? w + gap : 0; row.push(it); w = it.x + it.ww;
      }
      if (row.length) rows.push({ items: row, width: w });
      return rows;
    }
    function fitText(ctx, texts, fontAt, maxW, maxH, maxPx, lh = 1.12, maxRows = 99) {
      let px = maxPx;
      for (let i = 0; i < 40; i++) {
        ctx.font = fontAt(px);
        const sp = ctx.measureText(' ').width;
        const items = texts.map((txt, k) => ({ txt, k, ww: ctx.measureText(txt).width }));
        const rows = flowRows(ctx, items, maxW, sp);
        if ((rows.length * px * lh <= maxH && rows.length <= maxRows && rows.every((r) => r.width <= maxW + 0.5)) || px < 6) return { px, rows, sp };
        px *= 0.93;
      }
      return null;
    }
    /** spread a row's words to the full width (justified), as long as it has two or more words */
    function justify(rows, maxW, lastToo = true) {
      rows.forEach((r, ri) => {
        const n = r.items.length; if (n < 2 || (!lastToo && ri === rows.length - 1)) return;
        const inner = r.items.reduce((a, it) => a + it.ww, 0), gap = (maxW - inner) / (n - 1);
        let x = 0; for (const it of r.items) { it.x = x; x += it.ww + gap; }
        r.width = maxW;
      });
      return rows;
    }

    // keyword → picture, shared by the doodle looks
    function themeOf(text, i) {
      const s = text.toLowerCase();
      const map = [
        [/\b(sun|day|light|bright|summer|morning|gold|shine)\b/, 'sun'], [/\b(night|moon|sleep|dream|dark|tonight|midnight)\b/, 'moon'],
        [/\b(love|heart|kiss|hold|baby|darling|close)\b/, 'heart'], [/\b(star|stars|sky|wish|fly|heaven|high)\b/, 'star'],
        [/\b(rain|cloud|cry|tears|storm|grey|blue)\b/, 'cloud'], [/\b(flower|bloom|rose|spring|grow|garden)\b/, 'flower'],
        [/\b(world|earth|planet|space|around|far|away)\b/, 'planet'], [/\b(see|look|eyes|find|search|watch)\b/, 'eye'],
        [/\b(sing|song|music|dance|dancing|sound|static|loud|turn)\b/, 'note'], [/\b(write|wrote|name|word|words|paper|letter|read)\b/, 'quill'],
      ];
      for (const [re, k] of map) if (re.test(s)) return k;
      return pick(['sun', 'moon', 'heart', 'star', 'cloud', 'flower', 'planet', 'note'], hash(i * 3.71 + 0.3));
    }

    // =====================================================================================
    //  1. Doodle Pals: hand-drawn bean friends beside a big plain lyric
    // =====================================================================================
    // Clip: soft white page, little cartoon figures acting out the line, the lyric set big and justified beside them.
    // Ours: two original bean characters drawn with a boiling hand line (it redraws 8 times a second, like a flipbook).
    // Their pose follows the words (thinking, hugging, holding a heart, waving, cheering, sleeping); they bounce on the
    // beat and squash on the kick. Words land as sung with a lilac glow, and a held note grows the heart.
    function bean(ctx, x, y, s, o) {
      const seed = o.seed, amp = s * 0.012;
      const lw = Math.max(1.3, s * 0.026);
      ctx.save(); ctx.translate(x, y); ctx.rotate(o.tilt || 0); ctx.scale(o.sx || 1, o.sy || 1);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = '#161616'; ctx.fillStyle = '#ffffff'; ctx.lineWidth = lw;
      // feet
      for (const sd of [-1, 1]) { curve(ctx, wob(ell(sd * s * 0.14, -s * 0.05, s * 0.085, s * 0.06, 12), seed + sd * 11, amp), true); ctx.fill(); ctx.stroke(); }
      // body: one soft blob, a touch wider at the head
      const body = ell(0, -s * 0.52, s * 0.34, s * 0.46, 30).map(([px, py]) => { const k = py < -s * 0.52 ? 1.06 : 0.97; return [px * k, py]; });
      curve(ctx, wob(body, seed + 3, amp), true); ctx.fill(); ctx.stroke();
      // arms: a white sausage with an ink outline, shoulder to hand
      const arm = (sd, hx, hy) => {
        const pts = wob([[sd * s * 0.27, -s * 0.5], [lerp(sd * s * 0.27, hx, 0.5) + sd * s * 0.04, lerp(-s * 0.5, hy, 0.5) + s * 0.03], [hx, hy]], seed + sd * 7 + hx, amp);
        curve(ctx, pts, false); ctx.lineWidth = s * 0.11; ctx.strokeStyle = '#161616'; ctx.stroke();
        ctx.lineWidth = s * 0.11 - lw * 2; ctx.strokeStyle = '#ffffff'; ctx.stroke();
        ctx.lineWidth = lw; ctx.strokeStyle = '#161616';
      };
      if (o.armL) arm(-1, o.armL[0] * s, o.armL[1] * s);
      if (o.armR) arm(1, o.armR[0] * s, o.armR[1] * s);
      // face
      const ey = -s * 0.66;
      ctx.fillStyle = 'rgba(255,140,175,0.6)';
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(sd * s * 0.19, ey + s * 0.085, s * 0.06, s * 0.034, 0, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#161616';
      for (const sd of [-1, 1]) {
        const ex = sd * s * 0.105;
        if (o.eyes === 'dot') { ctx.beginPath(); ctx.ellipse(ex, ey, s * 0.024, s * 0.03, 0, 0, TAU); ctx.fill(); }
        else if (o.eyes === 'shut') { ctx.beginPath(); ctx.moveTo(ex - s * 0.035, ey); ctx.lineTo(ex + s * 0.035, ey); ctx.stroke(); }
        else { ctx.beginPath(); ctx.arc(ex, ey + s * 0.012, s * 0.032, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
      }
      if (o.mouth === 'open') { ctx.beginPath(); ctx.ellipse(0, ey + s * 0.11, s * 0.03, s * 0.035, 0, 0, TAU); ctx.fill(); }
      else { ctx.beginPath(); ctx.arc(0, ey + s * 0.07, s * 0.03, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke(); }
      ctx.restore();
    }
    function inkHeart(ctx, x, y, s, a = 1) {
      ctx.save(); ctx.globalAlpha *= a; heartPath(ctx, x, y, s); ctx.fillStyle = '#e8344f'; ctx.fill(); ctx.lineWidth = Math.max(1.2, s * 0.08); ctx.strokeStyle = '#161616'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.ellipse(x - s * 0.32, y - s * 0.3, s * 0.1, s * 0.06, -0.6, 0, TAU); ctx.fill(); ctx.restore();
    }
    function poseOf(L) {
      const s = L.text.toLowerCase();
      if (/\b(kiss|hold|together|hug|stay|close|we|us)\b/.test(s)) return 'hug';
      if (/\b(love|heart|baby|darling|yours|mine)\b/.test(s)) return 'heart';
      if (/\b(think|dream|remember|mind|eyes|wonder|wish|face)\b/.test(s)) return 'think';
      if (/\b(sleep|night|tired|alone|slow|low)\b/.test(s)) return 'sleep';
      if (/\b(yeah|up|go|right|okay|fine|never|stop)\b/.test(s)) return 'cheer';
      if (/\b(hello|hey|bye|goodbye|again|see)\b/.test(s)) return 'wave';
      return pick(['wave', 'think', 'heart', 'hug', 'cheer', 'sleep'], hash(L.i * 3.3 + 1));
    }
    const palsLayout = cache();
    LOOKS.push({
      id: 'doodle-pals', name: 'Doodle Pals', family: FAMILY,
      from: 'Cute doodle lyric edits: hand-drawn cartoon friends acting out the line next to a big plain lyric.',
      what: 'Two original bean friends act out each line in a boiling hand-drawn line that redraws eight times a second. They think, hug, wave, cheer, hold a heart or doze depending on the words, bounce on the beat and squash on the kick. The lyric sits beside them, set big and justified, and each word lands the moment it is sung with a lilac glow. A held note pumps the heart up while the voice holds.',
      post: POST({ thresh: 1.6, bloom: 0.1, grain: 0.02, ca: 0, vig: 0.06, boost: 0, exp: 1.5 }),
      draw(ctx, W, H, t) {
        const S = Math.min(W, H), tall = H > W, b = beatOf(t), k = kickEnv(t);
        ctx.fillStyle = '#fdfbff'; ctx.fillRect(0, 0, W, H);
        // soft clouds drifting behind
        for (let i = 0; i < 6; i++) {
          const cx = ((hash(i * 4.1) * 1.4 - 0.2) * W + t * S * 0.006 * (0.5 + hash(i))) % (W * 1.3) - W * 0.1, cy = hash(i * 7.3) * H, r = S * (0.08 + 0.08 * hash(i * 2.2));
          ctx.fillStyle = 'rgba(247,232,250,0.75)';
          for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.arc(cx + (j - 1.5) * r * 0.8, cy + Math.sin(j * 2.1) * r * 0.25, r * (0.7 + 0.3 * hash(i + j)), 0, TAU); ctx.fill(); }
        }
        const N = now(t);
        const li = Song.lastStarted(t), L = N ? N.L : li >= 0 ? LINES[li] : null;
        const pose = L ? poseOf(L) : 'wave';
        const seed = Math.floor(t * 8) * 13 + (L ? L.i * 101 : 0);
        // character stage
        const cx = tall ? W * 0.5 : W * 0.25, base = tall ? H * 0.47 : H * 0.8, s = tall ? S * 0.5 : S * 0.52;
        const popIn = L ? easeBack(clamp((t - L.start + 0.12) / 0.28, 0, 1)) : 1;
        const bob = -S * 0.012 * b.env, sy = (1 - 0.05 * k) * (0.85 + 0.15 * popIn), sx = (1 + 0.035 * k) * (0.85 + 0.15 * popIn);
        const w = N && N.w, st = stretchOf(w, t);
        const lead = A.leadEnv(t);
        ctx.save(); ctx.translate(cx, base + bob);
        if (pose === 'hug') {
          bean(ctx, -s * 0.2, 0, s * 0.9, { seed, tilt: 0.12, sx, sy, eyes: 'happy', armR: [0.42, -0.55] });
          bean(ctx, s * 0.22, 0, s * 0.92, { seed: seed + 50, tilt: -0.14, sx, sy, eyes: 'happy', armL: [-0.48, -0.52] });
          inkHeart(ctx, 0, -s * 1.05 - S * 0.02 * Math.sin(t * 3), s * (0.1 + 0.08 * st + 0.02 * b.env));
        } else if (pose === 'heart') {
          bean(ctx, 0, 0, s, { seed, sx, sy, eyes: 'happy', armL: [-0.1, -0.42], armR: [0.1, -0.42] });
          inkHeart(ctx, 0, -s * 0.42, s * (0.18 + 0.12 * st + 0.04 * lead + 0.02 * k));
        } else if (pose === 'think') {
          bean(ctx, 0, 0, s, { seed, sx, sy, eyes: 'happy', armL: [-0.2, -0.6], armR: [0.2, -0.6] });
          ctx.lineWidth = Math.max(1.3, s * 0.022); ctx.strokeStyle = '#161616'; ctx.fillStyle = '#fff';
          const bx = -s * 0.42, by = -s * 1.22;
          const bubble = []; for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; bubble.push([bx + Math.cos(a) * s * 0.26 * (1 + 0.12 * (i % 2)), by + Math.sin(a) * s * 0.18 * (1 + 0.12 * (i % 2))]); }
          curve(ctx, wob(bubble, seed + 9, s * 0.02), true); ctx.fill(); ctx.stroke();
          for (const [dx, dy, r] of [[0.1, 0.25, 0.04], [0.22, 0.38, 0.025]]) { ctx.beginPath(); ctx.arc(bx + s * dx + s * 0.08, by + s * dy, s * r, 0, TAU); ctx.fill(); ctx.stroke(); }
          inkHeart(ctx, bx, by, s * (0.07 + 0.05 * st + 0.015 * b.env));
        } else if (pose === 'sleep') {
          bean(ctx, 0, 0, s, { seed, sx, sy, tilt: -0.12, eyes: 'shut', armL: [-0.36, -0.28], armR: [0.36, -0.28] });
          ctx.fillStyle = '#161616';
          for (let i = 0; i < 3; i++) { const p = ((t * 0.5 + i / 3) % 1); ctx.globalAlpha = Math.sin(p * Math.PI); ctx.font = `700 ${s * (0.08 + 0.06 * p)}px Arimo, Arial, sans-serif`; ctx.fillText('z', s * (0.3 + 0.25 * p), -s * (1.0 + 0.45 * p)); }
          ctx.globalAlpha = 1;
        } else if (pose === 'cheer') {
          const up = 0.06 * b.env;
          bean(ctx, 0, 0, s, { seed, sx, sy, eyes: 'happy', mouth: 'open', armL: [-0.55, -0.98 - up], armR: [0.55, -0.98 - up] });
          ctx.strokeStyle = '#161616'; ctx.lineWidth = Math.max(1.3, s * 0.02);
          for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) {
            const a = -Math.PI / 2 + sd * (0.5 + i * 0.35), r0 = s * (0.16 + 0.05 * b.env), r1 = r0 + s * 0.08;
            const hx = sd * s * 0.55, hy = -s * 1.0;
            ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * r0, hy + Math.sin(a) * r0); ctx.lineTo(hx + Math.cos(a) * r1, hy + Math.sin(a) * r1); ctx.stroke();
          }
        } else {
          const wave = Math.sin((b.i + b.ph) * Math.PI) * 0.12;
          bean(ctx, 0, 0, s, { seed, sx, sy, eyes: 'dot', mouth: 'open', armL: [-0.36, -0.3], armR: [0.52 + wave, -0.98 + Math.abs(wave)] });
        }
        ctx.restore();
        // the lyric, set justified in a fixed block; words show only once sung
        let box = tall ? [W * 0.08, H * 0.56, W * 0.84, H * 0.36] : [W * 0.5, H * 0.14, W * 0.44, H * 0.72];
        if (!N) {
          const tf = titleFade(t); if (tf <= 0) return;
          ctx.globalAlpha = tf; ctx.fillStyle = '#161616'; ctx.textBaseline = 'top'; ctx.font = `400 ${S * 0.075}px Arimo, Arial, sans-serif`;
          ctx.fillText(A.TITLE, box[0], box[1] + box[3] * 0.3); ctx.font = `400 ${S * 0.03}px Arimo, Arial, sans-serif`; ctx.fillStyle = '#8c7a96'; ctx.fillText(A.ARTIST, box[0], box[1] + box[3] * 0.3 + S * 0.1); ctx.globalAlpha = 1; return;
        }
        const key = `${N.L.i}:${W}x${H}`;
        let lay = palsLayout.get(key);
        if (!lay) {
          const fontAt = (px) => `400 ${px}px Arimo, Arial, sans-serif`;
          lay = fitText(ctx, N.L.words.map((x) => x.text), fontAt, box[2], box[3], S * 0.105, 1.12, 5);
          lay.rows = justify(lay.rows, box[2], lay.rows.length > 1);
          lay.font = fontAt(lay.px); lay.top = box[1] + (box[3] - lay.rows.length * lay.px * 1.12) * (tall ? 0.2 : 0.35);
          palsLayout.set(key, lay);
        }
        ctx.font = lay.font; ctx.textBaseline = 'top';
        lay.rows.forEach((r, ri) => {
          for (const it of r.items) {
            const wd = N.L.words[it.k]; if (t < wd.s) continue;
            const age = t - wd.s, isCur = wd === N.w, v = voiceOf(wd, t);
            const x = box[0] + it.x, y = lay.top + ri * lay.px * 1.12 - (1 - ease(age / 0.12)) * S * 0.012;
            ctx.globalAlpha = N.fade * ease(age / 0.08);
            ctx.shadowColor = 'rgba(214,140,255,0.85)'; ctx.shadowBlur = S * (0.012 + 0.02 * (isCur ? v : 0));
            ctx.fillStyle = '#121212';
            if (isCur && st > 0) { ctx.save(); ctx.translate(x + it.ww / 2, y + lay.px / 2); ctx.scale(1 + 0.12 * st, 1 + 0.12 * st); ctx.fillText(it.txt, -it.ww / 2, -lay.px / 2); ctx.restore(); }
            else ctx.fillText(it.txt, x, y);
          }
        });
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      },
    });

    // =====================================================================================
    //  2. Lily Split: one heavy word at a time, either side of a still flower on black
    // =====================================================================================
    // Clip: black frame, a painted lily in the middle, a single bold word flashing left or right of it.
    // Ours: an original painted lily (drawn in code: layered petals, speckles, stamens) that sways and breathes on the
    // kick. Each word punches in on its syllable, alternating sides; a held word stretches tall while the voice holds
    // and the next word wipes it away. The credit sits small beside the flower.
    const lilyCache = cache();
    function lily(R) {
      const key = Math.round(R);
      if (lilyCache.has(key)) return lilyCache.get(key);
      const size = Math.ceil(R * 3.4), c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
      const petal = (L, Wd, curl, s) => {
        x.beginPath(); x.moveTo(0, 0);
        x.bezierCurveTo(Wd, -L * 0.2, Wd * 1.15, -L * 0.68, curl * L * 0.12, -L);
        x.bezierCurveTo(-Wd * 1.15, -L * 0.68, -Wd, -L * 0.2, 0, 0); x.closePath();
        const g = x.createLinearGradient(0, 0, 0, -L);
        g.addColorStop(0, '#2a1023'); g.addColorStop(0.22, '#8e3a64'); g.addColorStop(0.5, '#e5829f'); g.addColorStop(0.8, '#f5bba5'); g.addColorStop(1, '#fbd9c4');
        x.fillStyle = g; x.fill();
        x.save(); x.clip();
        // a cool sheen down one side, and speckles near the throat
        const g2 = x.createLinearGradient(-Wd, 0, Wd, 0); g2.addColorStop(0, 'rgba(120,150,190,0.28)'); g2.addColorStop(0.5, 'rgba(0,0,0,0)'); x.fillStyle = g2; x.fillRect(-Wd * 2, -L, Wd * 4, L);
        x.fillStyle = 'rgba(90,20,55,0.65)';
        for (let i = 0; i < 26; i++) { const py = -L * (0.12 + 0.45 * hash(s + i * 1.7)), px = (hash(s + i * 2.3) - 0.5) * Wd * 1.2 * (-py / L + 0.3); x.beginPath(); x.ellipse(px, py, R * 0.008, R * 0.014, 0, 0, TAU); x.fill(); }
        x.restore();
        x.strokeStyle = 'rgba(255,225,235,0.35)'; x.lineWidth = R * 0.008; x.beginPath(); x.moveTo(0, -L * 0.05); x.quadraticCurveTo(curl * L * 0.05, -L * 0.5, curl * L * 0.1, -L * 0.95); x.stroke();
        x.strokeStyle = 'rgba(70,15,40,0.4)'; x.lineWidth = R * 0.006; x.stroke();
      };
      const flower = (cx, cy, r, rot, s) => {
        x.save(); x.translate(cx, cy); x.rotate(rot);
        for (let i = 0; i < 3; i++) { x.save(); x.rotate((i / 3) * TAU + Math.PI / 3); petal(r * (0.95 + 0.1 * hash(s + i)), r * 0.25, hash(s * 2 + i) - 0.5, s + i * 10); x.restore(); }
        for (let i = 0; i < 3; i++) { x.save(); x.rotate((i / 3) * TAU); petal(r * (1.0 + 0.1 * hash(s + i + 3)), r * 0.27, hash(s * 3 + i) - 0.5, s + i * 20 + 5); x.restore(); }
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + 0.3, l = r * (0.55 + 0.15 * hash(s + i * 4.4));
          x.strokeStyle = '#d9b7a0'; x.lineWidth = r * 0.012; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(Math.cos(a + 0.2) * l * 0.5, Math.sin(a + 0.2) * l * 0.5, Math.cos(a) * l, Math.sin(a) * l); x.stroke();
          x.fillStyle = '#7a2e16'; x.beginPath(); x.ellipse(Math.cos(a) * l, Math.sin(a) * l, r * 0.045, r * 0.018, a + Math.PI / 2, 0, TAU); x.fill();
        }
        x.restore();
      };
      x.translate(size / 2, size / 2);
      // leaves and a bud behind
      x.fillStyle = '#26302f';
      for (const [a, l] of [[2.2, 1.25], [-0.5, 1.1], [1.0, 0.9]]) { x.save(); x.rotate(a); x.beginPath(); x.ellipse(0, -R * l * 0.6, R * 0.12, R * l * 0.6, 0, 0, TAU); x.fill(); x.restore(); }
      x.save(); x.translate(-R * 0.55, -R * 0.95); x.rotate(-0.5); petal(R * 0.45, R * 0.1, 0.2, 77); x.restore();
      flower(R * 0.38, R * 0.5, R * 0.72, 0.6, 31);
      flower(-R * 0.08, -R * 0.12, R, 0.15, 7);
      lilyCache.set(key, c); return c;
    }
    LOOKS.push({
      id: 'lily-split', name: 'Lily Split', family: FAMILY,
      from: 'Minimal one-word-at-a-time lyric edits on black beside a fixed piece of flower art.',
      what: 'A painted lily holds the centre of a black frame, swaying slowly and breathing on the kick. One heavy word at a time punches in on its syllable, switching sides every word. A held word stretches tall while the voice holds, and the next syllable wipes it away. The song credit sits small beside the flower.',
      post: POST({ thresh: 0.85, bloom: 0.35, grain: 0.045, ca: 0.1, vig: 0.55, boost: 0.4 }),
      draw(ctx, W, H, t) {
        const S = Math.min(W, H), tall = H > W, k = kickEnv(t), b = beatOf(t);
        ctx.fillStyle = '#030303'; ctx.fillRect(0, 0, W, H);
        const R = tall ? W * 0.3 : S * 0.33, fx = W / 2, fy = tall ? H * 0.5 : H * 0.52;
        // glow behind the flower
        const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, R * 1.6); g.addColorStop(0, `rgba(160,60,100,${0.16 + 0.1 * k})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const img = lily(R);
        ctx.save(); ctx.translate(fx, fy); ctx.rotate(Math.sin(t * 0.45) * 0.035); const sc = 1 + 0.025 * k + 0.01 * Math.sin(t * 0.8); ctx.scale(sc, sc);
        ctx.drawImage(img, -img.width / 2, -img.height / 2); ctx.restore();
        // floating pollen
        for (let i = 0; i < 26; i++) { const p = (t * (0.02 + 0.03 * hash(i)) + hash(i * 3.3)) % 1; ctx.fillStyle = `rgba(250,210,190,${0.35 * Math.sin(p * Math.PI)})`; ctx.fillRect(fx + (hash(i * 5.1) - 0.5) * R * 3, fy + R * 1.2 - p * R * 2.6, 1.6, 1.6); }
        // credit
        ctx.font = `600 ${S * 0.017}px "Inter Tight", Inter, sans-serif`; ctx.fillStyle = 'rgba(240,215,200,0.55)'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(`${A.TITLE}${A.ARTIST ? ' · ' + A.ARTIST : ''}`.toUpperCase(), fx + R * 0.35, fy - R * 1.12);
        const N = now(t);
        const zone = (side) => (tall ? { x: W / 2, y: side < 0 ? H * 0.14 : H * 0.86, w: W * 0.8, h: H * 0.14 } : { x: side < 0 ? (W / 2 - R * 1.05) / 2 : W - (W / 2 - R * 1.05) / 2, y: fy, w: (W / 2 - R * 1.05) * 0.86, h: H * 0.3 });
        const drawWord = (txt, side, age, st, alpha) => {
          const z = zone(side);
          let px = Math.min(z.h, S * 0.13); ctx.font = `400 ${px}px Anton, Impact, sans-serif`;
          const tw = ctx.measureText(txt).width; if (tw > z.w) { px *= z.w / tw; ctx.font = `400 ${px}px Anton, Impact, sans-serif`; }
          const punch = 1 + 0.45 * (1 - ease(age / 0.11));
          ctx.save(); ctx.translate(z.x, z.y); ctx.scale(punch * (1 - 0.08 * st), punch * (1 + 0.7 * st));
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = alpha * ease(age / 0.05);
          const gr = ctx.createLinearGradient(0, -px / 2, 0, px / 2); gr.addColorStop(0, '#f8e1cc'); gr.addColorStop(1, '#c69f82');
          ctx.shadowColor = 'rgba(255,190,160,0.35)'; ctx.shadowBlur = S * 0.02 * (1 + st);
          ctx.fillStyle = gr; ctx.fillText(txt, 0, 0); ctx.restore();
        };
        if (!N || !N.w) {
          const tf = titleFade(t); if (tf > 0) drawWord(A.TITLE.toUpperCase().split(' ')[0], -1, 1, 0, tf);
          return;
        }
        const idx = baseIndex(N.L) + N.w.k, side = idx % 2 ? 1 : -1;
        const prev = N.L.words[N.w.k - 1];
        if (prev) { const gone = t - N.w.s; if (gone < 0.08) drawWord(bare(prev.text).toUpperCase(), -side, 1, 0, 1 - gone / 0.08); }
        drawWord(bare(N.w.text).toUpperCase() || N.w.text, side, t - N.w.s, stretchOf(N.w, t), N.fade * Math.max(voiceOf(N.w, t, 1.8), N.w === N.last ? 0 : 1));
      },
    });

    // =====================================================================================
    //  3. Reflow: plain justified text that re-sets itself on every word
    // =====================================================================================
    // Clip: a white card with plain black type; each new word makes the whole block re-set itself, justified.
    // Ours: the words sung so far are set as large as they can be, justified edge to edge. Every new syllable re-sets
    // the block and the words already there glide to their new place and size in a fifth of a second, so the text
    // breathes with the phrasing. A held note slowly opens the word spacing; the block fades with the voice.
    const reflowCache = cache();
    function reflowLayout(ctx, L, n, W, H) {
      const key = `${L.i}:${n}:${W}x${H}`;
      if (reflowCache.has(key)) return reflowCache.get(key);
      const S = Math.min(W, H), tall = H > W;
      const box = tall ? [W * 0.08, H * 0.18, W * 0.84, H * 0.5] : [W * 0.06, H * 0.1, W * 0.88, H * 0.68];
      const texts = L.words.slice(0, n).map((w) => w.text);
      const maxRows = n <= 2 ? 1 : n <= 5 ? 2 : n <= 9 ? 3 : 4;
      const fontAt = (px) => `400 ${px}px Arimo, Arial, sans-serif`;
      const f = fitText(ctx, texts, fontAt, box[2], box[3], S * (tall ? 0.2 : 0.24), 1.08, tall ? maxRows + 1 : maxRows);
      justify(f.rows, box[2]);
      const out = [];
      f.rows.forEach((r, ri) => { for (const it of r.items) out[it.k] = { x: box[0] + it.x, y: box[1] + ri * f.px * 1.08, px: f.px, ww: it.ww }; });
      const res = { pos: out, px: f.px, rows: f.rows.length, box };
      reflowCache.set(key, res); return res;
    }
    LOOKS.push({
      id: 'reflow', name: 'Reflow', family: FAMILY,
      from: 'Plain-text lyric edits: black type on a white card, justified, re-setting itself as each word arrives.',
      what: 'The words sung so far are set as large as they fit, justified edge to edge in plain black type on a white card. Every new syllable re-sets the whole block: the words already there glide to their new place and size in a fifth of a second, so the text visibly breathes with the phrasing. A held note slowly opens the spacing, and the block fades with the voice.',
      post: POST({ thresh: 1.6, bloom: 0.05, grain: 0.025, ca: 0, vig: 0.1, boost: 0, exp: 1.5 }),
      draw(ctx, W, H, t) {
        const S = Math.min(W, H), tall = H > W;
        ctx.fillStyle = '#f8f7fb'; ctx.fillRect(0, 0, W, H);
        const N = now(t);
        ctx.strokeStyle = 'rgba(20,20,30,0.12)'; ctx.lineWidth = Math.max(1, S * 0.0015 * (1 + 2 * kickEnv(t)));
        const ry = tall ? H * 0.74 : H * 0.86; ctx.beginPath(); ctx.moveTo(W * 0.06, ry); ctx.lineTo(W * 0.94, ry); ctx.stroke();
        ctx.fillStyle = '#0d0d10'; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
        if (!N || !N.sung.length) {
          const tf = titleFade(t); if (tf <= 0) return;
          ctx.globalAlpha = tf; ctx.font = `400 ${S * 0.13}px Arimo, Arial, sans-serif`; ctx.fillText(A.TITLE, W * 0.06, H * 0.12);
          ctx.font = `400 ${S * 0.035}px Arimo, Arial, sans-serif`; ctx.fillStyle = '#77737f'; ctx.fillText(A.ARTIST, W * 0.06, H * 0.12 + S * 0.17); ctx.globalAlpha = 1; return;
        }
        const n = N.sung.length, cur = reflowLayout(ctx, N.L, n, W, H), prev = n > 1 ? reflowLayout(ctx, N.L, n - 1, W, H) : null;
        const age = t - N.L.words[n - 1].s, k = ease(age / 0.2);
        const st = stretchOf(N.w, t);
        ctx.globalAlpha = N.fade;
        for (let i = 0; i < n; i++) {
          const a = cur.pos[i], p = prev && prev.pos[i];
          let x = a.x, y = a.y, px = a.px;
          if (p) { x = lerp(p.x, a.x, k); y = lerp(p.y, a.y, k); px = lerp(p.px, a.px, k); }
          ctx.font = `400 ${px}px Arimo, Arial, sans-serif`;
          if (i === n - 1 && !p) { ctx.globalAlpha = N.fade * ease(age / 0.07); y += (1 - k) * px * 0.08; }
          else ctx.globalAlpha = N.fade;
          if (st > 0) spacing(ctx, px * 0.08 * st);
          ctx.fillText(N.L.words[i].text, x, y);
          if (st > 0) spacing(ctx, 0);
        }
        ctx.globalAlpha = 1;
      },
    });

    // =====================================================================================
    //  4. Twin Ink: huge distressed serif words cutting against small quiet lines, cream ↔ navy
    // =====================================================================================
    // Clip: a single giant rough serif word fills the frame, then a small serif phrase; the ground cuts between
    // warm cream and deep navy. Ours: each line is split into heavy words (held notes, line endings, long words) and
    // quiet phrases. Heavy words fill the frame in a condensed serif with a worn, ink-specked edge and spray a few
    // drops as they land; quiet phrases are typed small, word by word. The ground cuts cream ↔ navy on each change,
    // right on the syllable, and a held heavy word grows taller while the voice holds.
    const inkChunks = cache();
    function chunksOf(L) {
      if (inkChunks.has(L.i)) return inkChunks.get(L.i);
      const out = []; const last = L.words.length - 1;
      L.words.forEach((w, k) => {
        const len = bare(w.text).length;
        const big = longNote(w) || (k === last && len > 2) || (len >= 6 && hash(L.i * 7 + k) > 0.45);
        if (big) out.push({ big: true, words: [w] });
        else if (out.length && !out[out.length - 1].big) out[out.length - 1].words.push(w);
        else out.push({ big: false, words: [w] });
      });
      let base = 0; for (const x of LINES) { if (x === L) break; base += (inkChunks.get(x.i) || chunksOf(x)).length; }
      out.forEach((c, i) => { c.g = base + i; c.s = c.words[0].s; });
      inkChunks.set(L.i, out); return out;
    }
    LOOKS.push({
      id: 'twin-ink', name: 'Twin Ink', family: FAMILY,
      from: 'Typographic lyric edits that alternate one giant worn serif word with small quiet lines, cutting between cream and navy.',
      what: 'Each line splits into heavy words and quiet phrases. Heavy words (held notes, line endings, long words) fill the frame in a condensed serif with a worn, ink-specked edge and spray a few drops as they land. Quiet phrases are typed small, word by word. The ground cuts between cream and navy right on the syllable, and a held heavy word grows taller while the voice holds.',
      post: POST({ thresh: 1.1, bloom: 0.3, grain: 0.06, ca: 0.05, vig: 0.3, boost: 0, exp: 1.3 }),
      draw(ctx, W, H, t, dpr) {
        const S = Math.min(W, H), tall = H > W;
        const N = now(t);
        let ch = null;
        if (N) { const cs = chunksOf(N.L); for (const c of cs) if (c.s <= t) ch = c; }
        const navy = ch ? ch.g % 2 === 1 : false;
        const bg = navy ? '#232a47' : '#f1e5d4', ink = navy ? '#f5f1e8' : '#5b6a98';
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        const vg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
        vg.addColorStop(0, navy ? 'rgba(80,95,150,0.35)' : 'rgba(255,250,240,0.5)'); vg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
        // paper speckle
        patternOver(ctx, speckles('paper', 512, 700, 0.4, 1.6, 4, 0), W, H, 'source-over', navy ? 'rgba(255,255,255,0.05)' : 'rgba(80,60,40,0.07)', [0, 0]);
        if (!N || !ch) {
          const tf = titleFade(t); if (tf <= 0) return;
          ctx.globalAlpha = tf; ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.font = `400 ${S * 0.07}px "DM Serif Display", Georgia, serif`; ctx.fillText(A.TITLE, W / 2, H / 2); ctx.globalAlpha = 1; return;
        }
        if (ch.big) {
          const w = ch.words[0], age = t - w.s, st = stretchOf(w, t);
          const txt = (bare(w.text) || w.text).toUpperCase();
          const L2 = layer('twin', W, H, dpr);
          let px = H * (tall ? 0.3 : 0.62); const cond = 0.66;
          L2.font = `400 ${px}px "DM Serif Display", Georgia, serif`;
          const tw = L2.measureText(txt).width * cond; const maxW = W * 0.86; if (tw > maxW) px *= maxW / tw;
          L2.font = `400 ${px}px "DM Serif Display", Georgia, serif`; L2.textAlign = 'center'; L2.textBaseline = 'middle';
          const zoom = (1 + 0.1 * (1 - ease(age / 0.3))) * (1 + 0.025 * clamp(age / 2, 0, 1));
          const shake = kickEnv(t) * S * 0.003;
          L2.save(); L2.translate(W / 2 + (hash(Math.floor(t * 24)) - 0.5) * shake, H / 2 + (hash(Math.floor(t * 24) + 9) - 0.5) * shake);
          L2.scale(zoom * cond, zoom * (1 + 0.22 * st)); L2.fillStyle = ink; L2.fillText(txt, 0, px * 0.04); L2.restore();
          // wear the edges: knock out specks and streaks, re-seeded per word
          patternOver(L2, speckles('distress', 384, 900, 0.3, 2.6, 11, 40), W, H, 'destination-out', null, [hash(ch.g) * 300, hash(ch.g + 1) * 300], Math.max(1, px / 260));
          // drops spraying out on landing
          L2.fillStyle = ink;
          for (let i = 0; i < 26; i++) {
            const a = hash(ch.g * 9 + i) * TAU, d = S * (0.2 + 0.35 * hash(ch.g + i * 3.3)) * ease(age / 0.25), r = S * 0.002 * (1 + 3 * Math.pow(hash(i * 7.7 + ch.g), 4));
            L2.globalAlpha = clamp(1 - age / 1.2, 0, 1); L2.beginPath(); L2.arc(W / 2 + Math.cos(a) * d * (tall ? 0.7 : 1.4), H / 2 + Math.sin(a) * d, r, 0, TAU); L2.fill();
          }
          L2.globalAlpha = 1;
          ctx.globalAlpha = N.fade * ease(age / 0.06);
          if (navy) { ctx.shadowColor = 'rgba(190,205,255,0.45)'; ctx.shadowBlur = S * 0.04; }
          ctx.drawImage(L2.canvas, 0, 0, W, H); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        } else {
          const sung = ch.words.filter((w) => w.s <= t);
          const px = S * (tall ? 0.075 : 0.05); ctx.font = `400 ${px}px "DM Serif Display", Georgia, serif`;
          const sp = ctx.measureText(' ').width;
          const all = ch.words.map((w) => ({ w, ww: ctx.measureText(w.text).width }));
          const rows = flowRows(ctx, all, W * 0.7, sp);
          ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
          rows.forEach((r, ri) => {
            const y = H / 2 + (ri - (rows.length - 1) / 2) * px * 1.25, x0 = W / 2 - r.width / 2;
            for (const it of r.items) {
              if (!sung.includes(it.w)) continue;
              const age = t - it.w.s;
              ctx.globalAlpha = N.fade * ease(age / 0.14) * (0.55 + 0.45 * Math.max(voiceOf(it.w, t, 1.2), 0.6));
              if (navy) { ctx.shadowColor = 'rgba(200,215,255,0.6)'; ctx.shadowBlur = S * 0.02; }
              ctx.fillStyle = navy ? '#f4f1ea' : '#6d6f86'; ctx.fillText(it.w.text, x0 + it.x, y - (1 - ease(age / 0.2)) * S * 0.01);
            }
          });
          ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        }
      },
    });

    // =====================================================================================
    //  5. Crayon Night: wax-crayon doodles on grainy black
    // =====================================================================================
    // Clip: pastel crayon drawings (little creatures, a sun, a star) scribbled on a black, grainy page.
    // Ours: an original set of crayon doodles (sun, moon, heart, star, cloud, flower, planet, note) picked from the
    // words of each line. The whole page has real wax grain (paper shows through every stroke), and it boils:
    // the grain and the outlines shift eight times a second. Doodles pop in on the line, bob on the beat and puff up
    // on a held note, throwing crayon sparks. The lyric is hand-written in crayon, each word appearing as it is sung.
    const CRAYON = { sun: '#ffd24a', moon: '#fff1a8', heart: '#ff8fb1', star: '#b9a8ff', cloud: '#e9e9f2', flower: '#ff9fc6', planet: '#ffb36b', note: '#9be37a', eye: '#bfe8ff', quill: '#f4e3c1' };
    function crayonDoodle(ctx, kind, x, y, r, seed, b) {
      const col = CRAYON[kind] || '#f0e6d2', amp = r * 0.05, lw = Math.max(1.5, r * 0.05);
      ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const face = (dx, dy, s, sleepy) => {
        ctx.fillStyle = '#2a2430'; ctx.strokeStyle = '#2a2430'; ctx.lineWidth = Math.max(1.2, s * 0.08);
        for (const sd of [-1, 1]) { if (sleepy) { ctx.beginPath(); ctx.arc(dx + sd * s * 0.35, dy, s * 0.14, 0.1, Math.PI - 0.1); ctx.stroke(); } else { ctx.beginPath(); ctx.ellipse(dx + sd * s * 0.35, dy, s * 0.09, s * 0.12, 0, 0, TAU); ctx.fill(); } }
        ctx.beginPath(); ctx.arc(dx, dy + s * 0.16, s * 0.13, 0.2, Math.PI - 0.2); ctx.stroke();
        ctx.fillStyle = 'rgba(255,120,150,0.7)'; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(dx + sd * s * 0.62, dy + s * 0.2, s * 0.13, s * 0.08, 0, 0, TAU); ctx.fill(); }
      };
      ctx.fillStyle = col; ctx.strokeStyle = shade(col, 0.72); ctx.lineWidth = lw;
      if (kind === 'sun') {
        for (let i = 0; i < 10; i++) { const a = (i / 10) * TAU + b * 0.2; ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(-r * 0.14, -r * 0.78); ctx.lineTo(0, -r * (1.12 + 0.06 * hash(seed + i))); ctx.lineTo(r * 0.14, -r * 0.78); ctx.closePath(); ctx.fill(); ctx.restore(); }
        curve(ctx, wob(ell(0, 0, r * 0.66, r * 0.66, 18), seed, amp), true); ctx.fill(); ctx.stroke(); face(0, 0, r * 0.45, true);
      } else if (kind === 'moon') {
        ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, TAU); ctx.arc(r * 0.35, -r * 0.2, r * 0.62, 0, TAU, true); ctx.fill('evenodd');
        face(-r * 0.35, r * 0.1, r * 0.3, true);
      } else if (kind === 'heart') {
        heartPath(ctx, 0, 0, r * 0.95); ctx.fill(); ctx.stroke(); face(0, -r * 0.1, r * 0.38, false);
      } else if (kind === 'star') {
        starPath(ctx, 0, 0, r * 0.95, 5, 0.5, -Math.PI / 2 + 0.1 * Math.sin(seed)); ctx.fill(); ctx.stroke(); face(0, r * 0.05, r * 0.3, false);
      } else if (kind === 'cloud') {
        for (const [dx, dy, rr] of [[-0.45, 0.1, 0.42], [0, -0.15, 0.55], [0.45, 0.1, 0.42], [0, 0.22, 0.42]]) { curve(ctx, wob(ell(dx * r, dy * r, rr * r, rr * r * 0.9, 14), seed + dx * 10, amp), true); ctx.fill(); }
        face(0, 0.05 * r, r * 0.32, true);
        ctx.strokeStyle = '#8fc8ff'; for (let i = 0; i < 3; i++) { const yy = r * (0.6 + ((b * 0.5 + i / 3) % 1) * 0.6); ctx.beginPath(); ctx.moveTo((i - 1) * r * 0.35, yy); ctx.lineTo((i - 1) * r * 0.35 - r * 0.04, yy + r * 0.14); ctx.stroke(); }
      } else if (kind === 'flower') {
        ctx.strokeStyle = '#7fcf6a'; ctx.lineWidth = lw * 1.4; ctx.beginPath(); ctx.moveTo(0, r * 0.3); ctx.quadraticCurveTo(r * 0.1, r * 0.8, 0, r * 1.2); ctx.stroke();
        ctx.fillStyle = col; for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + b * 0.1; curve(ctx, wob(ell(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.32, r * 0.32, 12), seed + i, amp), true); ctx.fill(); }
        ctx.fillStyle = '#ffd24a'; curve(ctx, wob(ell(0, 0, r * 0.32, r * 0.32, 12), seed + 9, amp), true); ctx.fill(); face(0, 0, r * 0.18, false);
      } else if (kind === 'planet') {
        ctx.strokeStyle = '#ffe2a8'; ctx.lineWidth = lw * 1.6; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.1, r * 0.3, -0.35, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
        curve(ctx, wob(ell(0, 0, r * 0.62, r * 0.62, 18), seed, amp), true); ctx.fill();
        ctx.fillStyle = shade(col, 0.8); for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(r * (0.3 * hash(i) - 0.2), r * (0.4 * hash(i + 3) - 0.2), r * 0.1, 0, TAU); ctx.fill(); }
        ctx.strokeStyle = '#ffe2a8'; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.1, r * 0.3, -0.35, Math.PI * -0.02, Math.PI * 1.02); ctx.stroke();
      } else if (kind === 'note') {
        ctx.save(); ctx.rotate(Math.sin(b * Math.PI) * 0.15);
        for (const dx of [-0.35, 0.4]) { ctx.beginPath(); ctx.ellipse(dx * r, r * 0.45, r * 0.24, r * 0.18, -0.4, 0, TAU); ctx.fill(); }
        ctx.lineWidth = lw * 1.5; ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(-0.15 * r, r * 0.42); ctx.lineTo(-0.15 * r, -r * 0.65); ctx.lineTo(0.6 * r, -r * 0.8); ctx.lineTo(0.6 * r, r * 0.4); ctx.stroke(); ctx.restore();
      } else if (kind === 'eye') {
        curve(ctx, wob([[-r, 0], [0, -r * 0.6], [r, 0], [0, r * 0.6]], seed, amp), true); ctx.fill();
        ctx.fillStyle = '#2a2430'; ctx.beginPath(); ctx.arc(Math.sin(b * 0.5) * r * 0.2, 0, r * 0.28, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r * 0.1, -r * 0.1, r * 0.08, 0, TAU); ctx.fill();
      } else {
        ctx.rotate(-0.5); curve(ctx, wob([[0, -r], [r * 0.3, -r * 0.3], [r * 0.08, r], [-r * 0.08, r], [-r * 0.3, -r * 0.3]], seed, amp), true); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
    const crayonBg = cache();
    LOOKS.push({
      id: 'crayon-night', name: 'Crayon Night', family: FAMILY,
      from: 'Cosy crayon-doodle lyric edits: pastel wax drawings on a grainy black page.',
      what: 'Original crayon doodles (a sleepy sun, a moon, a heart, a star, a rain cloud, a flower, a planet, a note) are picked from the words of each line and drawn in pastel wax on grainy black. The whole page boils like a flipbook, eight times a second. Doodles pop in on the line, bob on the beat and puff up on held notes, throwing crayon sparks. The lyric is hand-written in crayon underneath, each word appearing as it is sung.',
      post: POST({ thresh: 0.85, bloom: 0.25, grain: 0.07, ca: 0.08, vig: 0.5, boost: 0.2 }),
      draw(ctx, W, H, t, dpr) {
        const S = Math.min(W, H), tall = H > W, b = beatOf(t), k = kickEnv(t);
        const boil = Math.floor(t * 8);
        const N = now(t), li = Song.lastStarted(t), L = N ? N.L : li >= 0 ? LINES[li] : null;
        const C = layer('crayon', W, H, dpr);
        C.fillStyle = '#08080a'; C.fillRect(0, 0, W, H);
        // background scribble swirls, a new pattern each couplet
        const cpl = L ? couplet(L.i) : -1, bkey = `${cpl}:${W}x${H}`;
        let bg = crayonBg.get(bkey);
        if (!bg) {
          bg = document.createElement('canvas'); bg.width = Math.round(W); bg.height = Math.round(H); const x = bg.getContext('2d');
          x.strokeStyle = cpl % 2 ? '#1f1d2c' : '#22232a'; x.lineCap = 'round'; x.lineWidth = S * 0.028;
          for (let i = 0; i < 26; i++) {
            const cx = hash(cpl * 3 + i * 1.7) * W, cy = hash(cpl * 5 + i * 2.3) * H, r = S * (0.03 + 0.05 * hash(i + cpl));
            x.beginPath(); for (let a = 0; a < TAU * 2.2; a += 0.2) { const rr = r * (0.4 + a / (TAU * 2.2)); x.lineTo(cx + Math.cos(a) * rr * 1.6, cy + Math.sin(a) * rr); } x.stroke();
          }
          crayonBg.set(bkey, bg);
        }
        C.drawImage(bg, (hash(boil) - 0.5) * 2, (hash(boil + 1) - 0.5) * 2, W, H);
        // a dark card frame on alternate lines
        const card = L && L.i % 2 === 1;
        if (card) {
          const m = S * 0.05; C.fillStyle = '#030304'; curve(C, wob([[m, m], [W / 2, m * 0.9], [W - m, m], [W - m * 0.9, H / 2], [W - m, H - m], [W / 2, H - m * 1.1], [m, H - m], [m * 1.1, H / 2]], boil * 3, S * 0.01), true); C.fill();
          C.strokeStyle = '#4a4c58'; C.lineWidth = S * 0.012; C.stroke();
        }
        // doodles
        if (L) {
          const kind = themeOf(L.text, L.i), kind2 = themeOf(L.text.split(' ').reverse().join(' '), L.i + 7);
          const age = t - L.start, pop = easeBack(clamp((age + 0.1) / 0.3, 0, 1));
          const w = N && N.w, st = stretchOf(w, t);
          const r = S * (tall ? 0.17 : 0.18) * pop * (1 + 0.18 * st + 0.04 * k);
          const dx = tall ? W * 0.5 : W * (L.i % 2 ? 0.62 : 0.38), dy = (tall ? H * 0.38 : H * 0.4) - S * 0.02 * b.env;
          C.save(); C.translate(dx, dy); C.scale(1 + 0.05 * k, 1 - 0.05 * k); C.rotate(Math.sin(t * 2 + L.i) * 0.04);
          crayonDoodle(C, kind, 0, 0, r, boil * 7 + L.i, (b.i + b.ph) * 0.5); C.restore();
          if (kind2 !== kind) { const r2 = r * 0.5, d2 = easeBack(clamp((age - 0.25) / 0.3, 0, 1)); if (d2 > 0) crayonDoodle(C, kind2, dx + (tall ? W * 0.28 : S * 0.42) * (L.i % 2 ? 1 : -1) * 0.8, dy - r * 0.6 + Math.sin(t * 3) * S * 0.01, r2 * d2, boil * 5 + 3, b.i * 0.5); }
          // crayon sparks on a held note
          if (st > 0.05) { C.strokeStyle = '#ffe9a0'; C.lineWidth = S * 0.006; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + boil * 0.3, rr = r * (1.25 + 0.25 * hash(boil + i)); C.globalAlpha = st; C.beginPath(); C.moveTo(dx + Math.cos(a) * rr, dy + Math.sin(a) * rr); C.lineTo(dx + Math.cos(a) * (rr + S * 0.03), dy + Math.sin(a) * (rr + S * 0.03)); C.stroke(); } C.globalAlpha = 1; }
        }
        // the lyric in crayon handwriting
        C.textBaseline = 'middle';
        if (N && N.sung.length) {
          const fontAt = (px) => `400 ${px}px "Gochi Hand", "Comic Sans MS", cursive`;
          const f = fitText(C, N.L.words.map((x) => x.text), fontAt, W * 0.84, H * 0.22, S * 0.085, 1.1, 2);
          const y0 = (tall ? H * 0.72 : H * 0.78) - ((f.rows.length - 1) * f.px * 1.1) / 2;
          C.font = fontAt(f.px);
          f.rows.forEach((r, ri) => {
            const x0 = W / 2 - r.width / 2;
            for (const it of r.items) {
              const wd = N.L.words[it.k]; if (t < wd.s) continue;
              const isCur = wd === N.w, st = stretchOf(wd, t);
              C.globalAlpha = N.fade; C.fillStyle = isCur ? '#ffe27a' : '#f2ead8';
              const txt = typedText(wd, t), j = (hash(boil + it.k) - 0.5) * S * 0.003;
              if (st > 0) { const g = graphemes(txt); let xx = x0 + it.x; for (let gi = 0; gi < g.length; gi++) { const cw = C.measureText(g[gi]).width; C.fillText(g[gi], xx, y0 + ri * f.px * 1.1 + Math.sin(t * 9 + gi) * S * 0.008 * st); xx += cw; } }
              else C.fillText(txt, x0 + it.x + j, y0 + ri * f.px * 1.1 + j);
            }
          });
          C.globalAlpha = 1;
        } else {
          const tf = titleFade(t);
          if (tf > 0) { C.globalAlpha = tf; C.fillStyle = '#f2ead8'; C.textAlign = 'center'; C.font = `400 ${S * 0.08}px "Gochi Hand", cursive`; C.fillText(A.TITLE, W / 2, H * 0.78); C.globalAlpha = 1; C.textAlign = 'left'; }
        }
        // wax grain over everything: the black page shows through every stroke
        patternOver(C, grain('wax', 160, 0.33, 5), W, H, 'destination-out', null, [hash(boil) * 160, hash(boil + 2) * 160], Math.max(1, S / 520));
        ctx.fillStyle = '#08080a'; ctx.fillRect(0, 0, W, H);
        ctx.drawImage(C.canvas, 0, 0, W, H);
      },
    });

    // =====================================================================================
    //  6. Sticker Book: every word a different hand-lettered sticker on lilac
    // =====================================================================================
    // Clip: hand-lettered words on lilac, each in its own style (chunky outlined letters, a taped label, a script),
    // with doodled swirls and sparkles around them. Ours: each word gets a die-cut sticker style picked from the word:
    // chunky block letters, a navy label held by tape, a loopy script, tall poster letters or a tiny scribble for small
    // words. Stickers slap down on their syllable with a spring and a spark. A held word becomes letters strung out with
    // dashes and arrows that spread further apart as long as the voice holds. Old stickers peel away with the voice.
    const STYLES = ['block', 'label', 'script', 'tall'];
    function stickerStyle(w, L) {
      if (longNote(w)) return 'spread';
      if (bare(w.text).length <= 3) return 'tiny';
      return pick(STYLES, hash(L.i * 11 + w.k * 3.3));
    }
    const stickerFonts = {
      block: (px) => `400 ${px}px "Bowlby One", "Arial Black", sans-serif`,
      label: (px) => `400 ${px}px "Bowlby One", "Arial Black", sans-serif`,
      script: (px) => `700 ${px}px Caveat, "Segoe Script", cursive`,
      tall: (px) => `400 ${px}px Anton, Impact, sans-serif`,
      tiny: (px) => `400 ${px}px "Gochi Hand", cursive`,
      spread: (px) => `400 ${px}px "Gochi Hand", cursive`,
    };
    const stickerSize = { block: 1, label: 0.72, script: 1.15, tall: 1.05, tiny: 0.55, spread: 0.6 };
    const stickerText = (w, style) => { const b = bare(w.text) || w.text; return style === 'block' || style === 'label' || style === 'tall' ? b.toUpperCase() : style === 'spread' ? graphemes(b.toLowerCase()).join('-') : b.toLowerCase(); };
    const stickerLay = cache();
    function stickerLayout(ctx, L, W, H) {
      const key = `${L.i}:${W}x${H}`;
      if (stickerLay.has(key)) return stickerLay.get(key);
      const S = Math.min(W, H), tall = H > W;
      const maxW = W * (tall ? 0.86 : 0.84), maxH = H * (tall ? 0.6 : 0.7);
      let base = S * 0.16, out = null;
      for (let tries = 0; tries < 30; tries++) {
        const items = L.words.map((w) => {
          const style = stickerStyle(w, L), px = base * stickerSize[style];
          ctx.font = stickerFonts[style](px);
          const txt = stickerText(w, style);
          let ww = ctx.measureText(txt).width; if (style === 'spread') { const g = graphemes(bare(w.text).toLowerCase() || w.text); ww += (g.length - 1) * px * 1.7 + px * 2.6; } if (style === 'label') ww += px * 0.6;
          return { w, style, px, txt, ww, h: px * (style === 'label' ? 1.5 : 1.15) };
        });
        const rows = flowRows(ctx, items, maxW, base * 0.25);
        const hsum = rows.reduce((a, r) => a + Math.max(...r.items.map((i) => i.h)), 0) + (rows.length - 1) * base * 0.12;
        out = { rows, hsum, base };
        if (hsum <= maxH && rows.every((r) => r.width <= maxW)) break;
        base *= 0.92;
      }
      let y = H / 2 - out.hsum / 2;
      for (const r of out.rows) {
        const rh = Math.max(...r.items.map((i) => i.h));
        const x0 = W / 2 - r.width / 2;
        for (const it of r.items) { it.cx = x0 + it.x + it.ww / 2; it.cy = y + rh / 2 + (hash(L.i + it.w.k * 1.9) - 0.5) * rh * 0.25; it.rot = (hash(L.i * 3 + it.w.k * 7.1) - 0.5) * 0.16; }
        y += rh + out.base * 0.12;
      }
      stickerLay.set(key, out); return out;
    }
    function drawSticker(ctx, it, t, S) {
      const { style, px, w } = it;
      const font = stickerFonts[style](px); ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const cream = '#fbe9c8', plum = '#3a1c4f', navy = '#1d2552';
      if (style === 'spread') {
        const st = stretchOf(w, t), g = graphemes(bare(w.text).toLowerCase() || w.text), gap = px * (0.15 + 0.5 * st);
        const widths = g.map((c) => ctx.measureText(c).width), dash = ctx.measureText('-').width;
        const total = widths.reduce((a, b) => a + b, 0) + (g.length - 1) * (gap * 2 + dash);
        let x = -total / 2; ctx.fillStyle = plum; ctx.textAlign = 'left';
        const reveal = Math.ceil(g.length * clamp((t - w.s) / Math.max(0.12, Math.min(0.5, w.e - w.s)), 0, 1));
        for (let i = 0; i < g.length; i++) {
          if (i >= reveal) break;
          ctx.fillText(g[i], x, Math.sin(t * 6 + i) * px * 0.06 * st); x += widths[i];
          if (i < g.length - 1) { x += gap; ctx.fillText('-', x, 0); x += dash + gap; }
        }
        // arrows pushing outwards while the voice holds
        ctx.strokeStyle = plum; ctx.lineWidth = Math.max(1.5, px * 0.06); ctx.lineCap = 'round';
        for (const sd of [-1, 1]) { const ax = sd * (total / 2 + px * 0.3 + px * 0.25 * st); ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax + sd * px * 0.5, 0); ctx.moveTo(ax + sd * px * 0.5 - sd * px * 0.18, -px * 0.16); ctx.lineTo(ax + sd * px * 0.5, 0); ctx.lineTo(ax + sd * px * 0.5 - sd * px * 0.18, px * 0.16); ctx.stroke(); }
        return;
      }
      const txt = stickerText(w, style), tw = ctx.measureText(txt).width;
      if (style === 'label') {
        const bw = tw + px * 0.6, bh = px * 1.35;
        ctx.fillStyle = cream; rrect(ctx, -bw / 2 - px * 0.08, -bh / 2 - px * 0.08, bw + px * 0.16, bh + px * 0.16, px * 0.2); ctx.fill();
        ctx.fillStyle = navy; rrect(ctx, -bw / 2, -bh / 2, bw, bh, px * 0.14); ctx.fill();
        ctx.fillStyle = cream; ctx.fillText(txt, 0, px * 0.05);
        ctx.fillStyle = 'rgba(255,196,130,0.85)';
        for (const [sx, sy, r] of [[-1, -1, -0.6], [1, 1, -0.6]]) { ctx.save(); ctx.translate(sx * bw / 2, sy * bh / 2); ctx.rotate(r * sx * sy * -1); ctx.fillRect(-px * 0.4, -px * 0.13, px * 0.8, px * 0.26); ctx.restore(); }
        return;
      }
      // die-cut sticker: a thick cream outline under the lettering
      ctx.lineJoin = 'round'; ctx.strokeStyle = cream; ctx.lineWidth = px * (style === 'script' ? 0.16 : 0.2); ctx.strokeText(txt, 0, 0);
      ctx.fillStyle = style === 'tall' ? navy : style === 'script' ? '#5a2a86' : style === 'tiny' ? plum : plum;
      if (style === 'tiny') { ctx.lineWidth = 0; ctx.fillText(txt, 0, 0); return; }
      ctx.fillText(txt, 0, 0);
      if (style === 'block') { ctx.strokeStyle = 'rgba(251,233,200,0.9)'; ctx.lineWidth = Math.max(1, px * 0.025); ctx.setLineDash([px * 0.12, px * 0.08]); ctx.strokeText(txt, 0, 0); ctx.setLineDash([]); }
    }
    function swirl(ctx, x, y, r, seed, col, lw) { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; const pts = []; for (let a = 0; a < TAU * 2.4; a += 0.35) { const rr = r * (0.15 + a / (TAU * 2.4)); pts.push([x + Math.cos(a + seed) * rr, y + Math.sin(a + seed) * rr]); } curve(ctx, wob(pts, seed, r * 0.06), false); ctx.stroke(); }
    LOOKS.push({
      id: 'sticker-book', name: 'Sticker Book', family: FAMILY,
      from: 'Hand-lettered lyric edits: every word in its own lettering style, with tape, stickers and doodles on lilac.',
      what: 'Every word becomes a die-cut sticker in its own lettering: chunky block letters, a navy label held on with tape, a loopy script, tall poster letters, or a quick scribble for little words. Stickers slap down on their syllable with a spring. A held word turns into letters strung out with dashes and arrows that spread further apart as long as the voice holds. Swirls and sparkles boil around the page, and the stickers peel away as the voice fades.',
      post: POST({ thresh: 1.6, bloom: 0.08, grain: 0.035, ca: 0, vig: 0.12, boost: 0, exp: 1.4 }),
      draw(ctx, W, H, t) {
        const S = Math.min(W, H), b = beatOf(t), k = kickEnv(t), boil = Math.floor(t * 6);
        ctx.fillStyle = '#d6c1f2'; ctx.fillRect(0, 0, W, H);
        const N = now(t), li = Song.lastStarted(t), L = N ? N.L : li >= 0 ? LINES[li] : null;
        const cpl = L ? couplet(L.i) : 0;
        // doodles round the edges
        for (let i = 0; i < 9; i++) {
          const ang = (i / 9) * TAU + cpl, x = W / 2 + Math.cos(ang) * W * 0.46 * (0.85 + 0.15 * hash(i + cpl)), y = H / 2 + Math.sin(ang) * H * 0.44 * (0.85 + 0.15 * hash(i * 2 + cpl));
          const kind = Math.floor(hash(i * 3.1 + cpl * 7) * 3);
          if (kind === 0) swirl(ctx, x, y, S * 0.05, boil * 0.3 + i, '#8a5cc9', S * 0.008);
          else if (kind === 1) { ctx.fillStyle = i % 2 ? '#1d2552' : '#fbe9c8'; starPath(ctx, x, y, S * (0.025 + 0.012 * b.env), 4, 0.32, boil * 0.05); ctx.fill(); }
          else { ctx.strokeStyle = '#fbe9c8'; ctx.lineWidth = S * 0.006; for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc(x, y, S * (0.03 + j * 0.022), Math.PI + ang, Math.PI * 1.6 + ang); ctx.stroke(); } }
        }
        if (!N) {
          const tf = titleFade(t); if (tf <= 0) return;
          ctx.globalAlpha = tf; ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(-0.04);
          drawSticker(ctx, { style: 'label', px: S * 0.09, w: { text: A.TITLE, s: 0, e: 0 } }, t, S); ctx.restore(); ctx.globalAlpha = 1; return;
        }
        const lay = stickerLayout(ctx, N.L, W, H);
        const drift = [Math.sin(t * 0.6 + N.L.i) * S * 0.008, Math.cos(t * 0.5) * S * 0.006];
        for (const r of lay.rows) for (const it of r.items) {
          const w = it.w; if (t < w.s) continue;
          const age = t - w.s;
          const slap = REDUCED() ? 1 : 1 + 0.6 * (1 - easeBack(clamp(age / 0.2, 0, 1)));
          const wig = (hash(boil + w.k) - 0.5) * 0.012;
          const peel = 1 - N.fade;
          ctx.save(); ctx.translate(it.cx + drift[0], it.cy + drift[1] + peel * S * 0.05 * (1 + hash(w.k)));
          ctx.rotate(it.rot + wig + (1 - clamp(age / 0.2, 0, 1)) * 0.25 * (w.k % 2 ? 1 : -1) + peel * 0.3 * (w.k % 2 ? 1 : -1));
          const sc = slap * (1 + 0.025 * k) * (1 - 0.3 * peel); ctx.scale(sc, sc);
          ctx.globalAlpha = clamp(age / 0.05, 0, 1) * N.fade;
          drawSticker(ctx, it, t, S);
          ctx.restore();
          // a little spark where it lands
          if (age < 0.25) { ctx.strokeStyle = `rgba(29,37,82,${1 - age / 0.25})`; ctx.lineWidth = S * 0.004; for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + w.k; const r0 = it.ww * 0.55 + S * 0.03 * ease(age / 0.25); ctx.beginPath(); ctx.moveTo(it.cx + Math.cos(a) * r0, it.cy + Math.sin(a) * r0 * 0.6); ctx.lineTo(it.cx + Math.cos(a) * (r0 + S * 0.025), it.cy + Math.sin(a) * (r0 + S * 0.025) * 0.6); ctx.stroke(); } }
        }
        ctx.globalAlpha = 1;
      },
    });

    // =====================================================================================
    //  7. Neon Monitor: a pink-framed screen floating in a dark room, words stacked on it
    // =====================================================================================
    // Clip: a glowing pink-edged screen tilts in 3D; on it a few words stack with little stickers, while smaller
    // screens with the artist float behind. Ours: a real perspective projection of a floating screen (the panel
    // is texture-mapped in triangles) that whips to a new angle on every bar (every half bar in the chorus) and
    // drifts in between. On the screen the last three sung words stack, the newest big; held notes stretch it wide.
    // The neon edge flares on the kick; two small screens with the cover art float in the dark behind.
    const NEON_ICONS = ['heart', 'star', 'bolt', 'note', 'flame', 'drop'];
    function icon(ctx, kind, x, y, s) {
      ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round';
      const fills = { heart: '#ff5b7a', star: '#ffd24a', bolt: '#ffe14d', note: '#8fd3ff', flame: '#ff8a3d', drop: '#7ad7ff' };
      ctx.fillStyle = fills[kind];
      if (kind === 'heart') heartPath(ctx, 0, 0, s);
      else if (kind === 'star') starPath(ctx, 0, 0, s, 5, 0.45);
      else if (kind === 'bolt') { ctx.beginPath(); ctx.moveTo(s * 0.2, -s); ctx.lineTo(-s * 0.5, s * 0.1); ctx.lineTo(0, s * 0.1); ctx.lineTo(-s * 0.2, s); ctx.lineTo(s * 0.5, -s * 0.15); ctx.lineTo(0, -s * 0.15); ctx.closePath(); }
      else if (kind === 'note') { ctx.beginPath(); ctx.ellipse(-s * 0.2, s * 0.5, s * 0.35, s * 0.25, -0.4, 0, TAU); ctx.rect(s * 0.05, -s, s * 0.14, s * 1.5); ctx.rect(s * 0.05, -s, s * 0.6, s * 0.2); }
      else if (kind === 'flame') { ctx.beginPath(); ctx.moveTo(0, -s); ctx.bezierCurveTo(s * 0.9, -s * 0.2, s * 0.6, s, 0, s); ctx.bezierCurveTo(-s * 0.6, s, -s * 0.9, -s * 0.2, 0, -s); }
      else { ctx.beginPath(); ctx.moveTo(0, -s); ctx.bezierCurveTo(s * 0.8, 0, s * 0.6, s, 0, s); ctx.bezierCurveTo(-s * 0.6, s, -s * 0.8, 0, 0, -s); }
      ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(1, s * 0.12); ctx.stroke(); ctx.restore();
    }
    /** draw img into the triangle (x0..x2) taking it from (u0..u2): a plain affine map, clipped to the triangle */
    function tri(ctx, img, x0, y0, x1, y1, x2, y2, u0, v0, u1, v1, u2, v2) {
      const cx = (x0 + x1 + x2) / 3, cy = (y0 + y1 + y2) / 3, g = (px, c) => px + Math.sign(px - c) * 0.7;
      ctx.save(); ctx.beginPath(); ctx.moveTo(g(x0, cx), g(y0, cy)); ctx.lineTo(g(x1, cx), g(y1, cy)); ctx.lineTo(g(x2, cx), g(y2, cy)); ctx.closePath(); ctx.clip();
      const d = (u1 - u0) * (v2 - v0) - (u2 - u0) * (v1 - v0);
      if (d) {
        const a = ((x1 - x0) * (v2 - v0) - (x2 - x0) * (v1 - v0)) / d, bb = ((x2 - x0) * (u1 - u0) - (x1 - x0) * (u2 - u0)) / d;
        const c = ((y1 - y0) * (v2 - v0) - (y2 - y0) * (v1 - v0)) / d, dd = ((y2 - y0) * (u1 - u0) - (y1 - y0) * (u2 - u0)) / d;
        ctx.transform(a, c, bb, dd, x0 - a * u0 - bb * v0, y0 - c * u0 - dd * v0); ctx.drawImage(img, 0, 0);
      }
      ctx.restore();
    }
    function quad3d(ctx, img, corner, nx = 8, ny = 5) {
      // corner(u, v) -> [x, y] on screen, u and v in 0..1
      const pts = [];
      for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) pts.push(corner(i / nx, j / ny));
      const iw = img.width, ih = img.height;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const p = (ii, jj) => pts[jj * (nx + 1) + ii];
        const [a, b, c, d] = [p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)];
        const u0 = (i / nx) * iw, u1 = ((i + 1) / nx) * iw, v0 = (j / ny) * ih, v1 = ((j + 1) / ny) * ih;
        tri(ctx, img, a[0], a[1], b[0], b[1], c[0], c[1], u0, v0, u1, v0, u1, v1);
        tri(ctx, img, a[0], a[1], c[0], c[1], d[0], d[1], u0, v0, u1, v1, u0, v1);
      }
    }
    const neonTex = document.createElement('canvas'); neonTex.width = 960; neonTex.height = 600;
    function camFor(idx) { return { yaw: (hash(idx * 1.7 + 0.2) - 0.5) * 1.0, pitch: (hash(idx * 2.9 + 0.5) - 0.5) * 0.45, roll: (hash(idx * 4.1) - 0.5) * 0.16, x: (hash(idx * 5.3) - 0.5) * 0.35, y: (hash(idx * 6.7) - 0.5) * 0.2, z: 2.5 + hash(idx * 7.9) * 0.6 }; }
    LOOKS.push({
      id: 'neon-monitor', name: 'Neon Monitor', family: FAMILY,
      from: 'Lyric edits on a pink neon-framed screen floating in a dark room, words stacked with little stickers.',
      what: 'A pink neon-edged screen floats in a dark room in true perspective. It whips to a new angle on every bar, twice as often in the chorus, and drifts in between. On the screen the last three sung words stack up with small stickers, the newest one big; a held note stretches it wide. The neon edge flares on the kick, and two small screens showing the cover art hang in the dark behind.',
      post: POST({ thresh: 0.7, bloom: 0.8, grain: 0.05, ca: 0.25, vig: 0.65, boost: 0.6 }),
      draw(ctx, W, H, t) {
        const S = Math.min(W, H), tall = H > W, k = kickEnv(t), c = cutAt(t);
        ctx.fillStyle = '#040306'; ctx.fillRect(0, 0, W, H);
        // camera whip between cuts, then a slow drift
        const A0 = camFor(c.idx - 1), A1 = camFor(c.idx), wk = ease(clamp(c.into / 0.28, 0, 1));
        const cam = {}; for (const key of Object.keys(A1)) cam[key] = lerp(A0[key], A1[key], wk);
        cam.yaw += Math.sin(t * 0.4) * 0.05; cam.pitch += Math.cos(t * 0.33) * 0.03;
        const f = tall ? W * 1.6 : Math.min(W * 0.95, H * 1.7);
        const proj = (x, y, z, o) => {
          // rotate a panel-local point by the panel's orientation, then place it in front of the camera
          const cy = Math.cos(o.yaw), sy = Math.sin(o.yaw), cp = Math.cos(o.pitch), sp = Math.sin(o.pitch), cr = Math.cos(o.roll), sr = Math.sin(o.roll);
          let X = x * cr - y * sr, Y = x * sr + y * cr, Z = z;
          let X2 = X * cy + Z * sy, Z2 = -X * sy + Z * cy; X = X2; Z = Z2;
          const Y2 = Y * cp - Z * sp; Z2 = Y * sp + Z * cp; Y = Y2; Z = Z2;
          X += o.x; Y += o.y; Z += o.z;
          return [W / 2 + (f * X) / Z, H / 2 - (f * Y) / Z, Z];
        };
        // keyboard-like grid of dots on the desk below
        for (let j = 0; j < 9; j++) for (let i = 0; i < 26; i++) {
          const p = proj((i - 12.5) * 0.11, -0.78, (j - 2) * 0.12, { yaw: cam.yaw * 0.6, pitch: cam.pitch * 0.6, roll: 0, x: cam.x * 0.6, y: cam.y * 0.6, z: cam.z + 0.2 });
          if (p[2] < 0.3) continue;
          ctx.fillStyle = `rgba(150,140,170,${0.16 * clamp(3.2 - p[2], 0, 1)})`; ctx.fillRect(p[0], p[1], f * 0.06 / p[2], f * 0.03 / p[2]);
        }
        const edge = (corner, alpha) => {
          ctx.save(); ctx.lineJoin = 'round';
          ctx.beginPath(); for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { const p = corner(u, v); ctx.lineTo(p[0], p[1]); } ctx.closePath();
          ctx.shadowColor = '#ff2fd0'; ctx.shadowBlur = S * (0.03 + 0.04 * k); ctx.strokeStyle = `rgba(255,70,215,${alpha})`; ctx.lineWidth = S * 0.006 * (1 + 0.6 * k); ctx.stroke();
          ctx.shadowBlur = 0; ctx.strokeStyle = `rgba(255,200,245,${alpha * 0.8})`; ctx.lineWidth = S * 0.0018; ctx.stroke(); ctx.restore();
        };
        // the two side screens, behind
        const cov = A.cover;
        for (const [px, py, pz, s] of [[-1.55, 0.35, 1.3, 0.5], [1.6, -0.35, 0.9, 0.45]]) {
          const o = { yaw: cam.yaw + px * 0.25, pitch: cam.pitch, roll: cam.roll, x: cam.x, y: cam.y, z: cam.z };
          const corner = (u, v) => proj(px + (u - 0.5) * s, py - (v - 0.5) * s, pz, o);
          ctx.globalAlpha = 0.85; quad3d(ctx, cov, corner, 3, 3); ctx.globalAlpha = 1;
          ctx.fillStyle = 'rgba(4,3,6,0.35)'; ctx.beginPath(); for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { const p = corner(u, v); ctx.lineTo(p[0], p[1]); } ctx.fill();
          edge(corner, 0.7);
        }
        // paint the main screen's texture
        const T = neonTex.getContext('2d'), TW = neonTex.width, TH = neonTex.height;
        T.setTransform(1, 0, 0, 1, 0, 0); T.globalAlpha = 1; T.shadowBlur = 0;
        const bgG = T.createLinearGradient(0, 0, 0, TH); bgG.addColorStop(0, '#0d0b12'); bgG.addColorStop(1, '#060508'); T.fillStyle = bgG; T.fillRect(0, 0, TW, TH);
        for (let y = 0; y < TH; y += 4) { T.fillStyle = 'rgba(255,255,255,0.018)'; T.fillRect(0, y, TW, 1); }
        const N = now(t);
        T.textAlign = 'center'; T.textBaseline = 'middle';
        if (N && N.sung.length) {
          const sung = N.sung, n = sung.length;
          const show = sung.slice(Math.max(0, n - 3));
          show.forEach((w, i) => {
            const rank = show.length - 1 - i; // 0 = newest
            const age = t - w.s, st = rank === 0 ? stretchOf(w, t) : 0;
            const txt = (bare(w.text) || w.text).toLowerCase();
            const px = rank === 0 ? 150 : rank === 1 ? 64 : 58;
            const y = rank === 0 ? TH * 0.52 : rank === 1 ? TH * 0.24 : TH * 0.8;
            T.font = `${rank === 0 ? 800 : 700} ${px}px "Inter Tight", Inter, sans-serif`;
            let tw = T.measureText(txt).width, fit = Math.min(1, (TW * 0.82) / (tw * (1 + 0.35 * st)));
            const pop = rank === 0 ? 0.6 + 0.4 * easeBack(clamp(age / 0.18, 0, 1)) : 1;
            T.save(); T.translate(TW / 2, y); T.scale(fit * pop * (1 + 0.35 * st), fit * pop);
            T.globalAlpha = N.fade * (rank === 0 ? clamp(age / 0.04, 0, 1) : 0.85);
            if (rank === 2) { T.fillStyle = '#e8794a'; T.save(); T.rotate(-0.04); T.fillRect(-tw / 2 - 18, -px * 0.55, tw + 36, px * 1.1); T.restore(); T.fillStyle = '#1a0f0a'; T.fillText(txt, 0, 4); }
            else { T.fillStyle = rank === 0 ? '#f1e8da' : 'rgba(230,220,205,0.75)'; if (rank === 0) { T.shadowColor = 'rgba(255,170,120,0.5)'; T.shadowBlur = 30; } T.fillText(txt, 0, 4); T.shadowBlur = 0; }
            if (hash(N.L.i * 5 + w.k * 3.7) > 0.45) icon(T, pick(NEON_ICONS, hash(N.L.i + w.k * 1.3)), tw / 2 + px * 0.45, -px * 0.15, px * 0.28);
            T.restore();
          });
        } else {
          const tf = titleFade(t);
          T.globalAlpha = tf; T.fillStyle = '#f1e8da'; T.font = '800 92px "Inter Tight", Inter, sans-serif'; T.fillText(A.TITLE.toLowerCase(), TW / 2, TH * 0.46);
          T.font = '600 34px "Inter Tight", Inter, sans-serif'; T.fillStyle = 'rgba(230,220,205,0.6)'; T.fillText(A.ARTIST, TW / 2, TH * 0.62); T.globalAlpha = 1;
        }
        // flicker on the cut
        if (c.into < 0.08) { T.fillStyle = 'rgba(255,120,230,0.12)'; T.fillRect(0, 0, TW, TH); }
        const main = (u, v) => proj((u - 0.5) * 1.6, (0.5 - v) * 1.0, 0, cam);
        quad3d(ctx, neonTex, main);
        edge(main, 0.95);
      },
    });

    // =====================================================================================
    //  8. Blockworld: the lyric built out of blocks in little voxel dioramas
    // =====================================================================================
    // Clip: block-built worlds (an island, a city, a night sky) with each lyric word standing in the scene as a sign.
    // Ours: an original isometric voxel diorama per couplet (island, pastel city, aurora night, blossom meadow).
    // The sung word is built out of blocks that drop into place column by column as the syllables come, a held note
    // makes the letters ripple and glow, and the word crumbles the moment the next one starts. The camera eases its
    // zoom so each word fills the frame, and the scene cuts on each new couplet.
    const voxCache = cache();
    function wordVoxels(text) {
      if (voxCache.has(text)) return voxCache.get(text);
      const latin = !/[^\x20-\x7e]/.test(text);
      const c = document.createElement('canvas'), x = c.getContext('2d');
      const font = latin ? '400 8px Silkscreen, monospace' : '700 12px sans-serif', h = latin ? 9 : 14;
      x.font = font; const w = Math.max(1, Math.ceil(x.measureText(text).width) + 2);
      c.width = w; c.height = h; x.font = font; x.textBaseline = 'top'; x.fillStyle = '#000'; x.fillText(text, 1, latin ? 0 : 1);
      const d = x.getImageData(0, 0, w, h).data, vox = [];
      let minY = h, maxY = 0;
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) if (d[(yy * w + xx) * 4 + 3] > 110) { vox.push([xx, yy]); minY = Math.min(minY, yy); maxY = Math.max(maxY, yy); }
      const res = { vox: vox.map(([a, b2]) => [a, maxY - b2]), w, h: maxY - minY + 1 };
      voxCache.set(text, res); return res;
    }
    const SCENES = {
      isle: { sky: ['#8fd3e6', '#cdeef2'], water: '#3fa9bd', top: '#7cc96b', side: '#8a5a3c', leaf: '#4fa65a', letter: '#a8333f', letter2: '#e8e1d6' },
      city: { sky: ['#7cb6ec', '#d4e9f7'], water: '#7b8794', top: '#9aa3ad', side: '#6b737c', leaf: '#5fae6b', letter: '#ff8fb3', letter2: '#ffd75e' },
      aurora: { sky: ['#140f3a', '#3b2a74'], water: '#1d3a5c', top: '#3f8f88', side: '#2a4f5a', leaf: '#2f7a6a', letter: '#f2efe6', letter2: '#ff9ad5' },
      meadow: { sky: ['#a9d8f0', '#f4e6f2'], water: '#58b7c9', top: '#88cf6f', side: '#7a5a40', leaf: '#f4a6c8', letter: '#ffffff', letter2: '#ffd2e6' },
    };
    const SCENE_KEYS = ['isle', 'city', 'aurora', 'meadow'];
    function worldOf(sceneKey, seed) {
      // terrain columns and props on a 16 x 12 grid
      const G = 16, D = 12, cols = [];
      for (let y = 0; y < D; y++) for (let x = 0; x < G; x++) {
        const dx = (x - G / 2 + 0.5) / (G / 2), dy = (y - D / 2 + 0.5) / (D / 2);
        const r = Math.hypot(dx * 0.95, dy) + (hash(x * 3.1 + y * 7.3 + seed) - 0.5) * 0.25;
        if (sceneKey === 'city' ? false : r > 1.0) continue;
        const hgt = sceneKey === 'city' ? 1 : 1 + (r < 0.55 ? 1 : 0) + (r < 0.3 && hash(x + y * 9 + seed) > 0.5 ? 1 : 0);
        cols.push({ x, y, h: hgt });
      }
      const props = [];
      if (sceneKey === 'city') {
        for (let i = 0; i < 14; i++) { const x = Math.floor(hash(seed + i * 2.1) * G), y = Math.floor(hash(seed + i * 3.7) * (D - 5)); props.push({ kind: 'tower', x, y, h: 3 + Math.floor(hash(seed + i) * 5), col: pick(['#f1e6d2', '#cfe7df', '#d8d4e8', '#f5d0c5'], hash(i * 9.1 + seed)) }); }
      } else {
        for (let i = 0; i < 7; i++) { const c = cols[Math.floor(hash(seed + i * 4.3) * cols.length)]; if (c && c.y < D - 4) props.push({ kind: sceneKey === 'meadow' && i === 0 ? 'tower' : 'tree', x: c.x, y: c.y, z: c.h, h: sceneKey === 'meadow' && i === 0 ? 7 : 3, col: '#f4f1ea' }); }
      }
      return { G, D, cols, props };
    }
    LOOKS.push({
      id: 'blockworld', name: 'Blockworld', family: FAMILY,
      from: 'Block-world lyric edits: little voxel dioramas with each lyric word built into the scenery.',
      what: 'Each couplet gets its own isometric block diorama: a little island, a pastel city, an aurora night or a blossom meadow. The word being sung is built out of blocks that drop into place column by column as its syllables come. A held note makes the letters ripple and glow, and the word crumbles the moment the next one starts. The camera eases its zoom so every word fills the frame, and the scene cuts on each new couplet.',
      post: POST({ thresh: 0.95, bloom: 0.3, grain: 0.03, ca: 0.05, vig: 0.35, boost: 0.3, exp: 1.12 }),
      draw(ctx, W, H, t) {
        const S = Math.min(W, H), tall = H > W, b = beatOf(t), k = kickEnv(t);
        const N = now(t), li = Song.lastStarted(t), L = N ? N.L : li >= 0 ? LINES[li] : null;
        const cpl = L ? couplet(L.i) : -1;
        const sk = SCENE_KEYS[((cpl % 4) + 4) % 4], sc = SCENES[sk], world = (() => { const key = `w:${sk}:${cpl}`; let w = voxCache.get(key); if (!w) { w = worldOf(sk, cpl * 13 + 1); voxCache.set(key, w); } return w; })();
        // sky
        const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, sc.sky[0]); g.addColorStop(1, sc.sky[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        if (sk === 'aurora') {
          for (let i = 0; i < 60; i++) { ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * hash(i) * (0.6 + 0.4 * Math.sin(t * 2 + i))})`; ctx.fillRect(hash(i * 1.3) * W, hash(i * 2.7) * H * 0.5, 2, 2); }
          for (let band = 0; band < 3; band++) {
            ctx.beginPath(); for (let x = 0; x <= W; x += W / 40) ctx.lineTo(x, H * (0.18 + band * 0.07) + Math.sin(x / W * 6 + t * 0.6 + band) * H * 0.04);
            for (let x = W; x >= 0; x -= W / 40) ctx.lineTo(x, H * (0.26 + band * 0.07) + Math.sin(x / W * 6 + t * 0.6 + band + 0.5) * H * 0.05);
            ctx.fillStyle = band === 1 ? 'rgba(120,255,200,0.22)' : 'rgba(200,120,255,0.18)'; ctx.fill();
          }
        }
        // blocky clouds
        if (sk !== 'aurora') for (let i = 0; i < 5; i++) { const cx = ((hash(i * 3.3) * W * 1.3 + t * S * 0.01 * (1 + hash(i))) % (W * 1.3)) - W * 0.15, cy = H * (0.06 + 0.18 * hash(i * 5.1)), u = S * 0.025; ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(cx, cy, u * 6, u * 1.2); ctx.fillRect(cx + u * 1.5, cy - u, u * 3, u * 1.2); }
        const cur = N && N.w ? N.w : null;
        const prevW = cur && cur.k > 0 ? N.L.words[cur.k - 1] : null;
        // the diorama fills the frame and pushes in slowly through the couplet, bouncing a touch on the kick
        const { G, D } = world;
        const cs = L ? LINES.find((x) => couplet(x.i) === cpl) : null, since = cs ? Math.max(0, t - cs.start) : 0;
        const u = Math.min(W * (tall ? 0.05 : 0.026), H * (tall ? 0.026 : 0.038)) * (1 + 0.06 * clamp(since / 8, 0, 1) + 0.01 * k);
        const ox = W / 2 - ((G - D) / 2) * 0.866 * u, oy = (tall ? H * 0.4 : H * 0.44) - ((G + D) / 2) * 0.5 * u;
        const P = (x, y, z) => [ox + (x - y) * 0.866 * u, oy + (x + y) * 0.5 * u - z * u];
        const poly = (pts, col) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); };
        const cube = (x, y, z, top, side, front) => {
          poly([P(x, y, z + 1), P(x + 1, y, z + 1), P(x + 1, y + 1, z + 1), P(x, y + 1, z + 1)], top);
          poly([P(x, y + 1, z + 1), P(x + 1, y + 1, z + 1), P(x + 1, y + 1, z), P(x, y + 1, z)], front || shade(top, 0.82));
          poly([P(x + 1, y, z + 1), P(x + 1, y + 1, z + 1), P(x + 1, y + 1, z), P(x + 1, y, z)], side || shade(top, 0.66));
        };
        // water plane with a shimmer
        const wpad = 7;
        poly([P(-wpad, -wpad, 0), P(G + wpad, -wpad, 0), P(G + wpad, D + wpad, 0), P(-wpad, D + wpad, 0)], sc.water);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.max(1, u * 0.08);
        for (let i = 0; i < 16; i++) { const wx = -wpad + hash(i * 3.7) * (G + wpad * 2), wy = -wpad + ((hash(i * 5.9) * (D + wpad * 2) + t * 0.4) % (D + wpad * 2)); const p0 = P(wx, wy, 0), p1 = P(wx + 1.2, wy, 0); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + i); ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke(); }
        ctx.globalAlpha = 1;
        // terrain and props, back to front
        const items = [];
        for (const c of world.cols) for (let z = 0; z < c.h; z++) items.push([c.x, c.y, z, z === c.h - 1 ? sc.top : sc.side]);
        for (const p of world.props) {
          if (p.kind === 'tower') for (let z = 0; z < p.h; z++) items.push([p.x, p.y, (p.z || 1) + z, sk === 'meadow' ? (z % 2 ? '#d8414f' : '#f4f1ea') : z === p.h - 1 ? shade(p.col, 1.05) : p.col, true]);
          else { items.push([p.x, p.y, p.z, '#6b4a2e'], [p.x, p.y, p.z + 1, '#6b4a2e']); for (const [dx, dy, dz] of [[0, 0, 2], [-1, 0, 2], [1, 0, 2], [0, -1, 2], [0, 1, 2], [0, 0, 3]]) items.push([p.x + dx, p.y + dy, p.z + dz, sc.leaf]); }
        }
        items.sort((a, b2) => a[0] + a[1] - (b2[0] + b2[1]) || a[2] - b2[2]);
        for (const [x, y, z, col, win] of items) {
          cube(x, y, z, col);
          if (win && sk === 'city' && z > 1) { const p = P(x, y + 1, z + 0.75); ctx.fillStyle = (hash(x * 7 + y * 3 + z) > 0.4) ? 'rgba(255,240,180,0.9)' : 'rgba(40,60,90,0.6)'; ctx.fillRect(p[0] + u * 0.25, p[1] + u * 0.05, u * 0.3, u * 0.25); }
        }
        // the sung word, built from blocks: a sign facing the camera, standing on the front of the island.
        // Each column drops in as its part of the word is sung; a held note ripples it; the next word knocks it down.
        const front = P(G / 2, D, 1);
        const buildWord = (w, crumble) => {
          const v = wordVoxels((bare(w.text) || w.text).toUpperCase());
          const q = Math.min(S * (tall ? 0.05 : 0.055), (W * 0.84) / (v.w + 0.6), (H * 0.36) / (v.h + 0.6));
          const x0 = W / 2 - (v.w * q) / 2, y0 = Math.min(front[1] + u * 1.5, H * (tall ? 0.72 : 0.76));
          const dur = Math.max(0.15, Math.min(0.55, w.e - w.s)), st = stretchOf(w, t);
          const order = v.vox.slice().sort((a2, b2) => a2[1] - b2[1] || a2[0] - b2[0]);
          for (const p of order) {
            const land = w.s + (p[0] / v.w) * dur, a2 = t - land;
            if (a2 < -0.14 && !crumble) continue;
            let x = x0 + p[0] * q, y = y0 - (p[1] + 1) * q;
            if (!crumble) y -= a2 < 0 ? H * 0.5 * Math.pow(-a2 / 0.14, 2) : 0;
            else { y += H * 0.6 * Math.pow(crumble, 2) * (0.5 + hash(p[0] * 3 + p[1])); x += (hash(p[0] + p[1] * 7) - 0.5) * q * 3 * crumble; }
            y -= st * q * 0.6 * Math.max(0, Math.sin(t * 9 - p[0] * 0.45));
            const glow = st > 0 && hash(p[0] * 1.7 + p[1] + Math.floor(t * 10)) > 0.65;
            const top = glow ? '#fff6c8' : p[1] >= v.h - 1 ? shade(sc.letter, 1.12) : sc.letter;
            ctx.globalAlpha = crumble ? 1 - crumble : clamp((a2 + 0.14) / 0.08, 0, 1) * N.fade;
            const d = q * 0.32;
            poly([[x, y], [x + d, y - d * 0.6], [x + q + d, y - d * 0.6], [x + q, y]], top);
            poly([[x + q, y], [x + q + d, y - d * 0.6], [x + q + d, y + q - d * 0.6], [x + q, y + q]], shade(sc.letter, 0.62));
            poly([[x, y], [x + q, y], [x + q, y + q], [x, y + q]], glow ? '#fff1b0' : shade(sc.letter, 0.86));
          }
          ctx.globalAlpha = 1;
        };
        if (cur) {
          if (prevW && t - cur.s < 0.2) buildWord(prevW, clamp((t - cur.s) / 0.2, 0, 1));
          buildWord(cur, 0);
          // a small pixel caption so the whole line stays readable
          const cap = N.sung.map((w) => w.text).join(' ');
          ctx.font = `400 ${Math.max(10, S * 0.026)}px Silkscreen, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          const tw = ctx.measureText(cap).width, pad = S * 0.015;
          ctx.globalAlpha = N.fade * 0.92; ctx.fillStyle = 'rgba(20,18,30,0.62)'; ctx.fillRect(W / 2 - tw / 2 - pad, H * 0.9 - S * 0.03, tw + pad * 2, S * 0.06);
          ctx.fillStyle = '#fff'; ctx.fillText(cap, W / 2, H * 0.9); ctx.globalAlpha = 1;
        } else {
          const tf = titleFade(t);
          if (tf > 0) { ctx.globalAlpha = tf; ctx.font = `400 ${S * 0.05}px Silkscreen, monospace`; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(20,18,30,0.8)'; ctx.lineWidth = S * 0.01; ctx.strokeText(A.TITLE.toUpperCase(), W / 2, H * 0.86); ctx.fillText(A.TITLE.toUpperCase(), W / 2, H * 0.86); ctx.globalAlpha = 1; }
        }
      },
    });

    // =====================================================================================
    //  9. Paint Pad: the lyric drawn live inside a retro paint program
    // =====================================================================================
    // Clip (a Tamil lyric edit): a chunky old-school paint app with a toolbar, a palette and big buttons; each line is
    // a little picture plus the lyric hand-lettered on a fresh canvas. Ours: an original retro paint program, "Paint Pad",
    // in 1-bit black and white. The canvas is low resolution and scaled up with hard pixels. Each line gets a doodle
    // picked from its words that pixel-dissolves in on the line; each word is painted on as it is sung, with the brush
    // cursor riding the edge of the stroke. Held notes leave the brush scribbling sparkles; when the voice stops an
    // eraser sweeps the words away. The palette swatch, the tool and the brush-size slider all move with the music.
    // Lettering uses a font with Tamil as well as Latin, so lyrics in either script work.
    const PAD_PALS = [['#5e7d86', '#f3e6c8', '#22333a'], ['#191c3a', '#f4dcb0', '#0a0b18'], ['#f2d3cd', '#7a2c3a', '#3a1018'], ['#f7e8c6', '#c84f5d', '#3b1e14'], ['#f4efe4', '#3c6a6a', '#1c3232'], ['#e8b7c5', '#5b2a4a', '#2b0f22'], ['#f3dca0', '#8a3b1d', '#3a1a0c'], ['#2c2f36', '#e9e2d2', '#0d0e11']];
    const padLow = document.createElement('canvas'), padArt = document.createElement('canvas');
    function pixDoodle(x, kind, cx, cy, r, ink, t, b) {
      // drawn at low resolution, so every shape lands on a coarse pixel grid once scaled up
      x.save(); x.translate(Math.round(cx), Math.round(cy)); x.lineWidth = Math.max(1, Math.round(r * 0.09)); x.strokeStyle = ink; x.fillStyle = ink; x.lineJoin = 'miter';
      if (kind === 'planet') {
        x.fillStyle = '#3d6fb0'; x.beginPath(); x.arc(0, 0, r * 0.7, 0, TAU); x.fill(); x.fillStyle = '#5aa36b'; for (let i = 0; i < 4; i++) { x.beginPath(); x.arc(r * (hash(i) - 0.5), r * (hash(i + 4) - 0.5), r * 0.22, 0, TAU); x.fill(); }
        x.strokeStyle = '#f3e6c8'; x.beginPath(); x.ellipse(0, 0, r * 1.05, r * 0.35, -0.4, 0, TAU); x.stroke();
        const a = t * 1.6, rx = Math.cos(a) * r * 1.05, ry = Math.sin(a) * r * 0.35; x.save(); x.rotate(-0.4); x.translate(rx, ry); x.rotate(a + Math.PI / 2);
        x.fillStyle = '#e94f3b'; x.fillRect(-r * 0.1, -r * 0.22, r * 0.2, r * 0.36); x.fillStyle = '#f3e6c8'; x.fillRect(-r * 0.06, -r * 0.3, r * 0.12, r * 0.1); x.fillStyle = '#ffd24a'; x.fillRect(-r * 0.06, r * 0.14, r * 0.12, r * (0.1 + 0.1 * b)); x.restore();
      } else if (kind === 'eye') {
        x.fillStyle = '#f3e6c8'; x.beginPath(); x.moveTo(-r, 0); x.quadraticCurveTo(0, -r * 0.8, r, 0); x.quadraticCurveTo(0, r * 0.8, -r, 0); x.fill(); x.stroke();
        x.fillStyle = '#5a3a22'; x.beginPath(); x.arc(Math.sin(t * 0.7) * r * 0.25, 0, r * 0.34, 0, TAU); x.fill(); x.fillStyle = '#111'; x.beginPath(); x.arc(Math.sin(t * 0.7) * r * 0.25, 0, r * 0.16, 0, TAU); x.fill();
      } else if (kind === 'heart') {
        for (const [dx, dy, s] of [[-0.35, 0.1, 0.55], [0.45, -0.35, 0.38]]) { heartPath(x, dx * r, dy * r, r * s * (1 + 0.12 * b)); x.fillStyle = '#d9344c'; x.fill(); x.stroke(); }
      } else if (kind === 'quill') {
        x.fillStyle = '#3a2a22'; x.fillRect(-r * 0.6, r * 0.1, r * 0.55, r * 0.6); x.fillStyle = '#111'; x.fillRect(-r * 0.5, 0, r * 0.35, r * 0.12);
        x.save(); x.translate(r * 0.1 + Math.sin(t * 3) * r * 0.05, -r * 0.1); x.rotate(-0.7 + Math.sin(t * 3) * 0.1); x.fillStyle = '#f3e6c8'; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(r * 0.5, -r * 0.4, r * 1.1, -r * 0.2); x.quadraticCurveTo(r * 0.5, r * 0.05, 0, 0); x.fill(); x.stroke(); x.restore();
      } else if (kind === 'note') {
        x.save(); x.translate(0, -b * r * 0.1); x.fillStyle = ink;
        for (const dx of [-0.4, 0.35]) { x.beginPath(); x.ellipse(dx * r, r * 0.45, r * 0.22, r * 0.16, -0.4, 0, TAU); x.fill(); }
        x.fillRect(-0.24 * r, -r * 0.6, r * 0.1, r * 1.05); x.fillRect(0.51 * r, -r * 0.75, r * 0.1, r * 1.2); x.fillRect(-0.24 * r, -r * 0.75, r * 0.85, r * 0.18); x.restore();
      } else if (kind === 'sun') {
        x.save(); x.rotate(t * 0.4); x.fillStyle = '#ffcf3f'; for (let i = 0; i < 8; i++) { x.rotate(TAU / 8); x.fillRect(-r * 0.08, -r * 1.05, r * 0.16, r * 0.3); } x.restore();
        x.fillStyle = '#ffcf3f'; x.beginPath(); x.arc(0, 0, r * 0.6, 0, TAU); x.fill(); x.stroke();
      } else if (kind === 'moon') {
        x.fillStyle = '#f3e6c8'; x.beginPath(); x.arc(0, 0, r * 0.7, 0, TAU); x.arc(r * 0.3, -r * 0.2, r * 0.6, 0, TAU, true); x.fill('evenodd'); x.stroke();
        for (let i = 0; i < 5; i++) { x.globalAlpha = 0.5 + 0.5 * Math.sin(t * 3 + i * 2); x.fillRect(r * (hash(i) * 2 - 1), r * (hash(i + 9) * 2 - 1), Math.max(1, r * 0.08), Math.max(1, r * 0.08)); } x.globalAlpha = 1;
      } else if (kind === 'star') {
        for (let i = 0; i < 3; i++) { starPath(x, r * (hash(i * 3) - 0.5) * 1.4, r * (hash(i * 5) - 0.5) * 1.2, r * (0.3 + 0.2 * hash(i)) * (1 + 0.1 * b), 5, 0.45); x.fillStyle = '#ffd24a'; x.fill(); x.stroke(); }
      } else if (kind === 'flower') {
        x.fillStyle = '#5aa36b'; x.fillRect(-r * 0.04, 0, r * 0.08, r); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; x.fillStyle = '#ef8fb0'; x.beginPath(); x.arc(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35 - r * 0.2, r * 0.25, 0, TAU); x.fill(); }
        x.fillStyle = '#ffcf3f'; x.beginPath(); x.arc(0, -r * 0.2, r * 0.2, 0, TAU); x.fill();
      } else if (kind === 'cloud') {
        x.fillStyle = '#f3e6c8'; for (const [dx, dy, s] of [[-0.4, 0, 0.35], [0, -0.2, 0.45], [0.4, 0, 0.35]]) { x.beginPath(); x.arc(dx * r, dy * r, s * r, 0, TAU); x.stroke(); } for (const [dx, dy, s] of [[-0.4, 0, 0.35], [0, -0.2, 0.45], [0.4, 0, 0.35]]) { x.beginPath(); x.arc(dx * r, dy * r, s * r, 0, TAU); x.fill(); }
        x.fillStyle = '#6aa8d8'; for (let i = 0; i < 4; i++) { const yy = r * (0.4 + ((t * 0.8 + i / 4) % 1) * 0.7); x.fillRect(r * (i * 0.25 - 0.4), yy, Math.max(1, r * 0.06), r * 0.14); }
      } else {
        // a fish skeleton
        x.lineWidth = Math.max(1, Math.round(r * 0.07)); x.beginPath(); x.moveTo(-r, 0); x.lineTo(r * 0.6, 0); x.stroke();
        for (let i = 0; i < 6; i++) { const xx = -r * 0.7 + i * r * 0.22; x.beginPath(); x.moveTo(xx, -r * 0.3); x.lineTo(xx + r * 0.08, 0); x.lineTo(xx, r * 0.3); x.stroke(); }
        x.beginPath(); x.arc(r * 0.75, 0, r * 0.22, 0, TAU); x.stroke(); x.beginPath(); x.moveTo(-r, 0); x.lineTo(-r * 1.25, -r * 0.3); x.moveTo(-r, 0); x.lineTo(-r * 1.25, r * 0.3); x.stroke();
      }
      x.restore();
    }
    const padFont = (px) => `800 ${px}px "Baloo Thambi 2", "Gochi Hand", sans-serif`;
    const padLay = cache();
    LOOKS.push({
      id: 'paint-pad', name: 'Paint Pad', family: FAMILY,
      from: 'Retro paint-program lyric edits (seen in a Tamil song edit): each line drawn live on a pixel canvas with a doodle.',
      what: 'An original 1-bit paint program, “Paint Pad”, fills the frame: toolbar, palette, brush tools and chunky buttons. Its canvas is low resolution with hard pixels. Each line gets a doodle picked from its words (a planet with an orbiting rocket, an eye, hearts, a quill, notes, a sun, a moon, stars, a flower, a rain cloud) that pixel-dissolves in. Each word is painted on as it is sung, with the brush riding the edge of the stroke; held notes leave the brush scribbling sparkles, and when the voice stops an eraser sweeps the words away. The swatch, the tool and the brush-size slider move with the music. Tamil and Latin lyrics both work.',
      post: POST({ thresh: 1.4, bloom: 0.08, grain: 0.02, ca: 0.04, vig: 0.15, boost: 0, exp: 1.35 }),
      draw(ctx, W, H, t) {
        const S = Math.min(W, H), tall = H > W, b = beatOf(t), k = kickEnv(t);
        const N = now(t), li = Song.lastStarted(t), L = N ? N.L : li >= 0 ? LINES[li] : null;
        const pal = PAD_PALS[L ? Math.floor(hash(L.i * 2.3 + 0.7) * PAD_PALS.length) : 0];
        const ui = '#f2f0ea', ink = '#111';
        ctx.fillStyle = ui; ctx.fillRect(0, 0, W, H);
        const u = S * 0.012; // UI pixel
        const mono = (px, wgt = 400) => `${wgt} ${px}px Silkscreen, monospace`;
        // menu bar
        const mh = S * 0.045; ctx.fillStyle = ink; ctx.fillRect(0, mh, W, Math.max(1, u * 0.25));
        ctx.font = mono(S * 0.022); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
        let mx = S * 0.02; for (const m of ['Pad', 'File', 'Edit', 'Layers', 'Colours', 'Help']) { ctx.fillText(m, mx, mh / 2); mx += ctx.measureText(m).width + S * 0.03; }
        ctx.textAlign = 'right'; ctx.fillText('rec', W - S * 0.02, mh / 2); if (b.i % 2 === 0) { ctx.fillStyle = '#d9344c'; ctx.beginPath(); ctx.arc(W - S * 0.02 - ctx.measureText('rec').width - S * 0.018, mh / 2, S * 0.008, 0, TAU); ctx.fill(); }
        // layout
        const C = tall ? [S * 0.04, mh + S * 0.04, W - S * 0.08, H * 0.5] : [S * 0.03, mh + S * 0.03, W * 0.7, H * 0.72];
        const tools = tall ? [S * 0.04, C[1] + C[3] + S * 0.03, W - S * 0.08, H * 0.2] : [C[0] + C[2] + S * 0.03, C[1], W - (C[0] + C[2] + S * 0.06), C[3]];
        const bar = tall ? [S * 0.04, tools[1] + tools[3] + S * 0.02, W - S * 0.08, H - (tools[1] + tools[3] + S * 0.04)] : [S * 0.03, C[1] + C[3] + S * 0.025, W - S * 0.06, H - (C[1] + C[3] + S * 0.05)];
        // window chrome around the canvas
        ctx.fillStyle = ink; ctx.fillRect(C[0] - u * 0.6, C[1] - u * 0.6, C[2] + u * 1.2, C[3] + u * 1.2);
        ctx.fillRect(C[0] + u * 0.8, C[1] + u * 0.8, C[2] + u * 1.2, C[3] + u * 1.2);
        // the low-res canvas
        const lw = 200, lh = Math.round((200 * C[3]) / C[2]);
        if (padLow.width !== lw || padLow.height !== lh) { padLow.width = lw; padLow.height = lh; padArt.width = lw; padArt.height = lh; }
        const x = padLow.getContext('2d');
        x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; x.globalCompositeOperation = 'source-over'; x.imageSmoothingEnabled = false;
        x.fillStyle = pal[0]; x.fillRect(0, 0, lw, lh);
        // paper speckle
        x.fillStyle = 'rgba(255,255,255,0.12)'; for (let i = 0; i < 40; i++) x.fillRect(Math.floor(hash(i * 1.3 + (L ? L.i : 0)) * lw), Math.floor(hash(i * 2.9) * lh), 1, 1);
        let brush = null;
        if (L) {
          const kind = themeOf(L.text, L.i);
          const ax = padArt.getContext('2d'); ax.setTransform(1, 0, 0, 1, 0, 0); ax.clearRect(0, 0, lw, lh); ax.globalCompositeOperation = 'source-over';
          const dr = Math.min(lw, lh) * (tall ? 0.24 : 0.3), dcx = tall ? lw * 0.5 : lw * (L.i % 2 ? 0.25 : 0.75), dcy = tall ? lh * 0.32 : lh * 0.4;
          pixDoodle(ax, kind, dcx, dcy, dr * (1 + 0.04 * k), pal[2], t, b.env);
          // pixel dissolve in on the line
          const dis = clamp((t - L.start + 0.15) / 0.35, 0, 1);
          if (dis < 1) { ax.globalCompositeOperation = 'destination-out'; for (let by = 0; by < lh; by += 4) for (let bx = 0; bx < lw; bx += 4) if (hash(bx * 0.37 + by * 1.71 + L.i) > dis) ax.fillRect(bx, by, 4, 4); ax.globalCompositeOperation = 'source-over'; }
          x.drawImage(padArt, 0, 0);
        }
        // the lyric, painted on as it is sung
        if (N && N.sung.length) {
          const key = `${N.L.i}:${lw}x${lh}:${tall}`;
          let lay = padLay.get(key);
          if (!lay) {
            const box = tall ? [lw * 0.06, lh * 0.6, lw * 0.88, lh * 0.36] : [N.L.i % 2 ? lw * 0.48 : lw * 0.05, lh * 0.14, lw * 0.47, lh * 0.74];
            const f = fitText(x, N.L.words.map((w) => w.text), padFont, box[2], box[3], lh * 0.3, 1.05, 4);
            lay = { f, box, top: box[1] + (box[3] - f.rows.length * f.px * 1.05) / 2 };
            padLay.set(key, lay);
          }
          const { f, box } = lay;
          x.font = padFont(f.px); x.textBaseline = 'top'; x.lineJoin = 'round';
          const lastE = N.last.e, eraseP = clamp((t - lastE - 0.35) / 0.45, 0, 1);
          f.rows.forEach((r, ri) => {
            const rx = box[0] + (box[2] - r.width) / 2;
            for (const it of r.items) {
              const w = N.L.words[it.k]; if (t < w.s) continue;
              const dur = Math.max(0.15, Math.min(0.6, w.e - w.s)), p = clamp((t - w.s) / dur, 0, 1);
              const wx = Math.round(rx + it.x), wy = Math.round(lay.top + ri * f.px * 1.05);
              x.save(); x.beginPath(); x.rect(wx - 2, wy - f.px * 0.3, (it.ww + 4) * p, f.px * 1.6); x.clip();
              x.strokeStyle = pal[2]; x.lineWidth = Math.max(2, f.px * 0.14); x.strokeText(w.text, wx, wy);
              x.fillStyle = pal[1]; x.fillText(w.text, wx, wy); x.restore();
              if (p < 1 || w === N.w) brush = { x: wx + (it.ww + 4) * p, y: wy + f.px * (0.55 + 0.25 * Math.sin(t * 30)), held: stretchOf(w, t) };
              if (stretchOf(w, t) > 0.1) { x.fillStyle = pal[1]; for (let i = 0; i < 6; i++) { const sx = wx + hash(Math.floor(t * 12) + i) * it.ww, sy = wy - f.px * 0.25 + hash(Math.floor(t * 12) + i + 7) * f.px * 1.4; x.fillRect(Math.round(sx) - 1, Math.round(sy), 3, 1); x.fillRect(Math.round(sx), Math.round(sy) - 1, 1, 3); } }
            }
          });
          if (eraseP > 0) { const ex = eraseP * lw * 1.1; x.fillStyle = pal[0]; x.fillRect(0, 0, ex, lh); x.globalAlpha = 1; x.drawImage(padArt, 0, 0, Math.min(lw, ex), lh, 0, 0, Math.min(lw, ex), lh); brush = { x: ex, y: lh * 0.6, eraser: true }; }
        } else if (titleFade(t) > 0) {
          x.font = padFont(lh * 0.2); x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.globalAlpha = titleFade(t);
          x.strokeStyle = pal[2]; x.lineWidth = 4; x.strokeText(A.TITLE, lw / 2, lh * 0.75); x.fillStyle = pal[1]; x.fillText(A.TITLE, lw / 2, lh * 0.75); x.globalAlpha = 1; x.textAlign = 'left';
        }
        ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(padLow, C[0], C[1], C[2], C[3]); ctx.restore();
        // brush cursor on top, at screen resolution
        if (brush) {
          const bx = C[0] + (brush.x / lw) * C[2], by = C[1] + (brush.y / lh) * C[3];
          ctx.save(); ctx.translate(bx, by);
          if (brush.eraser) { ctx.fillStyle = '#fff'; ctx.strokeStyle = ink; ctx.lineWidth = u * 0.35; ctx.fillRect(-u * 1.5, -u * 4, u * 3, u * 8); ctx.strokeRect(-u * 1.5, -u * 4, u * 3, u * 8); }
          else { ctx.rotate(0.7); ctx.fillStyle = '#fff'; ctx.strokeStyle = ink; ctx.lineWidth = u * 0.35; ctx.fillRect(-u * 0.8, -u * 7, u * 1.6, u * 5.5); ctx.strokeRect(-u * 0.8, -u * 7, u * 1.6, u * 5.5); ctx.fillStyle = ink; ctx.beginPath(); ctx.moveTo(-u * 0.8, -u * 1.5); ctx.lineTo(u * 0.8, -u * 1.5); ctx.lineTo(0, 0); ctx.fill(); }
          ctx.restore();
        }
        // tool panel: brushes, palette, brush size
        const tp = tools, toolsList = ['pencil', 'marker', 'brush', 'spray', 'eraser'];
        const activeTool = brush && brush.eraser ? 4 : brush && brush.held > 0.1 ? 3 : N && N.w ? (N.w.k % 3) : 0;
        const nT = toolsList.length;
        if (!tall) {
          const th = tp[3] * 0.46, rowH = th / nT;
          for (let i = 0; i < nT; i++) {
            const y = tp[1] + i * rowH, on = i === activeTool;
            ctx.fillStyle = on ? ink : ui; ctx.fillRect(tp[0], y, tp[2], rowH - u * 0.5); ctx.strokeStyle = ink; ctx.lineWidth = u * 0.3; ctx.strokeRect(tp[0], y, tp[2], rowH - u * 0.5);
            ctx.fillStyle = on ? ui : ink; ctx.fillRect(tp[0] + u * 1.5, y + rowH * 0.38, tp[2] * 0.62, rowH * 0.22); ctx.beginPath(); ctx.moveTo(tp[0] + u * 1.5 + tp[2] * 0.62, y + rowH * 0.32); ctx.lineTo(tp[0] + tp[2] * 0.62 + u * 1.5 + rowH * 0.3, y + rowH * 0.49); ctx.lineTo(tp[0] + u * 1.5 + tp[2] * 0.62, y + rowH * 0.66); ctx.fill();
            ctx.font = mono(S * 0.016); ctx.textAlign = 'right'; ctx.fillText(toolsList[i], tp[0] + tp[2] - u, y + rowH * 0.22);
          }
        }
        // palette swatches; the selected one follows the ink in use and blinks on the beat
        const sw = PAD_PALS.flatMap((p) => p.slice(0, 2)).slice(0, 12);
        const pcols = tall ? 12 : 4, prow = Math.ceil(sw.length / pcols);
        const pz = tall ? [tp[0], tp[1], tp[2], tp[3] * 0.4] : [tp[0], tp[1] + tp[3] * 0.52, tp[2], tp[3] * 0.32];
        const cw = pz[2] / pcols, chh = Math.min(cw, pz[3] / prow);
        sw.forEach((c, i) => {
          const cx = pz[0] + (i % pcols) * cw + cw / 2, cy = pz[1] + Math.floor(i / pcols) * chh + chh / 2, r = Math.min(cw, chh) * 0.36;
          ctx.fillStyle = c; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); ctx.strokeStyle = ink; ctx.lineWidth = u * 0.25; ctx.stroke();
          if (c === pal[1] && b.ph < 0.6) { ctx.lineWidth = u * 0.45; ctx.strokeRect(cx - r * 1.35, cy - r * 1.35, r * 2.7, r * 2.7); }
        });
        // brush size slider: the knob rides the voice
        const sz = tall ? [tp[0], tp[1] + tp[3] * 0.62, tp[2], tp[3] * 0.3] : [tp[0], tp[1] + tp[3] * 0.9, tp[2], tp[3] * 0.1];
        ctx.fillStyle = ink; ctx.font = mono(S * 0.015); ctx.textAlign = 'left'; ctx.fillText('brush size', sz[0], sz[1]);
        ctx.fillRect(sz[0], sz[1] + sz[3] * 0.5, sz[2], u * 0.35);
        const knob = sz[0] + sz[2] * clamp(0.25 + 0.55 * A.leadEnv(t) + 0.15 * k, 0, 1);
        ctx.fillStyle = ui; ctx.fillRect(knob - u, sz[1] + sz[3] * 0.5 - u * 1.2, u * 2, u * 2.7); ctx.strokeStyle = ink; ctx.lineWidth = u * 0.3; ctx.strokeRect(knob - u, sz[1] + sz[3] * 0.5 - u * 1.2, u * 2, u * 2.7);
        // the big buttons along the bottom
        const btns = ['SAVE', 'SHAPES', 'UNDO!', 'WIPE IT'];
        const bw = bar[2] / btns.length;
        btns.forEach((label, i) => {
          const pressed = (i === 2 && N && t - N.last.e > 0.35) || (i === 0 && L && t - L.start < 0.15);
          const bx = bar[0] + i * bw + u, by = bar[1] + (pressed ? u * 0.5 : 0), bww = bw - u * 2, bh = Math.max(u * 3, bar[3] * 0.8);
          if (!pressed) { ctx.fillStyle = ink; ctx.fillRect(bx + u * 0.6, by + u * 0.6, bww, bh); }
          ctx.fillStyle = i % 2 ? ui : ink; ctx.fillRect(bx, by, bww, bh); ctx.strokeStyle = ink; ctx.lineWidth = u * 0.35; ctx.strokeRect(bx, by, bww, bh);
          ctx.fillStyle = i % 2 ? ink : ui; ctx.font = mono(Math.min(bh * 0.45, S * 0.03), 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, bx + bww / 2, by + bh / 2);
        });
      },
    });

    return LOOKS;
  };
})();
