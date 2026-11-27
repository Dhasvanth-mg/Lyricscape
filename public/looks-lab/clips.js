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
    const bare = (s) => s.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '');
    const beatOf = (t) => Song.beat(t);
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
        const big = held(w) || (k === last && len > 2) || (len >= 6 && hash(L.i * 7 + k) > 0.45);
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
          const px = S * 0.05; ctx.font = `400 ${px}px "DM Serif Display", Georgia, serif`;
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

    //@@MORE@@

    return LOOKS;
  };
})();
