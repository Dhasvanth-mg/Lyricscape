// Canvas 2D renderer for `Frame`s produced by computeFrame().
// Browser-only. Contains no timing logic: it draws exactly what the frame says.
//
// PERFORMANCE RULES (measured, see docs): the expensive things on a canvas are
//   - glyph rasterisation at a new size every frame (colour emoji!)  -> emoji are cached as sprites
//   - blend modes / filters / shadowBlur over large areas              -> replaced with source-over bakes
//   - long strings in huge fonts                                       -> marquee rows are cached strips
//   - too many device pixels                                           -> DPR capped by a pixel budget
// Quality level (high/medium/low) trades the remaining decoration for frame rate.

import { computeFrame } from './frame';
import { REQUIRED_FONT_LOADS, STYLES, fontCss } from './styles';
import { drawDoodle } from './doodles';
import { PIXEL_BUDGET, QUALITY_PROFILE, type QualityLevel } from './governor';
import type { DrawWord, FontKey, Frame, VisualTimeline } from './types';
import { mix } from './util';
import type { ColorMode } from './emotion';

export type ArtworkAmount = 'off' | 'background';

export type RendererOptions = {
  reducedMotion: boolean;
  motionScale: number;
  quality: QualityLevel;
  /** 'unmodified' = show artwork only as-is (required for Spotify art): no backdrop dimming, masks, tilt or recolouring. */
  artworkPolicy: 'full' | 'unmodified';
  colorMode: ColorMode;
  emojis: boolean;
  doodles: boolean;
  artwork: ArtworkAmount;
  /** the generative show in instrumental breaks */
  interlude: boolean;
  /** film grain, halftone dots and scanlines (default true) */
  texture: boolean;
};

type Ls = CanvasRenderingContext2D & { letterSpacing?: string };
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const SPRITE_PX = 128;

export class KineticRenderer {
  private ctx: Ls;
  private dpr = 1;
  private rawDpr = 1;
  width = 0;
  height = 0;
  private artwork: CanvasImageSource | null = null;
  private artworkPattern: CanvasPattern | null = null;
  /** 56px copy of the cover: scaling it up is a free, cheap blur for the background layer */
  private artworkSoft: HTMLCanvasElement | null = null;
  private grainPattern: CanvasPattern | null = null;
  private scanPattern: CanvasPattern | null = null;
  private halftoneCache = new Map<string, HTMLCanvasElement>();
  private emojiSprites = new Map<string, HTMLCanvasElement>();
  private marqueeStrips = new Map<string, { canvas: HTMLCanvasElement; w: number }>();
  private widthCache = new Map<string, number>();
  private lastFont = '';
  private lastSpacing = '';
  private layoutEpoch = 0;
  private timeline: VisualTimeline | null = null;
  options: RendererOptions = {
    reducedMotion: false,
    motionScale: 1,
    quality: 'high',
    artworkPolicy: 'full',
    colorMode: 'blend',
    emojis: true,
    doodles: true,
    artwork: 'background',
    interlude: true,
    texture: true,
  };
  /** export mode: draw at exactly the pixel size asked for (no DPR cap or pixel budget) */
  exact = false;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true }) as Ls | null;
    if (!ctx) throw new Error('Canvas 2D is not available in this browser');
    this.ctx = ctx;
  }

  async loadFonts(): Promise<void> {
    if (typeof document === 'undefined' || !document.fonts) return;
    try {
      await Promise.all(REQUIRED_FONT_LOADS.map((f) => document.fonts.load(f, 'Aa lyrics')));
    } catch {
      /* fall back to system fonts; layout is re-measured anyway */
    }
    this.invalidateText();
  }

  private invalidateText() {
    this.layoutEpoch++;
    this.widthCache.clear();
    this.marqueeStrips.clear();
    this.lastFont = '';
  }

  setTimeline(tl: VisualTimeline | null) {
    this.timeline = tl;
    this.invalidateText();
  }

  setArtwork(img: CanvasImageSource | null) {
    this.artwork = img;
    this.artworkPattern = null;
    this.artworkSoft = null;
    if (img) {
      const s = document.createElement('canvas');
      s.width = s.height = 56;
      const sc = s.getContext('2d');
      if (sc) {
        sc.imageSmoothingQuality = 'high';
        sc.drawImage(img, 0, 0, 56, 56);
        this.artworkSoft = s;
      }
    }
    if (img) {
      const c = document.createElement('canvas');
      c.width = c.height = 512;
      const cx = c.getContext('2d');
      if (cx) {
        cx.drawImage(img, 0, 0, 512, 512);
        this.artworkPattern = this.ctx.createPattern(c, 'repeat');
      }
    }
  }

  /** Device-pixel ratio actually used: capped by quality and by a total pixel budget. */
  private effectiveDpr(): number {
    if (this.exact) return this.rawDpr;
    const cap = QUALITY_PROFILE[this.options.quality].dprCap;
    const budget = Math.sqrt(PIXEL_BUDGET / Math.max(1, this.width * this.height));
    return Math.max(0.75, Math.min(this.rawDpr, cap, budget));
  }

  resize(cssWidth: number, cssHeight: number, dpr = window.devicePixelRatio || 1) {
    this.rawDpr = dpr;
    this.width = Math.max(2, Math.floor(cssWidth));
    this.height = Math.max(2, Math.floor(cssHeight));
    this.applyDpr();
  }

  private applyDpr() {
    const dpr = this.effectiveDpr();
    if (Math.abs(dpr - this.dpr) < 0.01 && this.canvas.width === Math.floor(this.width * dpr)) return;
    this.dpr = dpr;
    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.lastFont = '';
    this.layoutEpoch++;
  }

  /** Change quality at runtime (adaptive governor or user choice). */
  setQuality(q: QualityLevel) {
    if (this.options.quality === q) return;
    this.options = { ...this.options, quality: q };
    this.applyDpr();
  }

  get density(): number {
    return QUALITY_PROFILE[this.options.quality].density;
  }

  // ---- text helpers (cached: setting fonts and measuring are not free) ------------------------------
  private setFont(css: string, spacingPx: number) {
    if (css !== this.lastFont) {
      this.ctx.font = css;
      this.lastFont = css;
    }
    const sp = `${Math.round(spacingPx * 100) / 100}px`;
    if (sp !== this.lastSpacing) {
      this.ctx.letterSpacing = sp;
      this.lastSpacing = sp;
    }
  }

  private measure = (text: string, font: FontKey, sizePx: number): number => {
    const style = this.timeline ? STYLES[this.timeline.style] : STYLES.maximalist;
    const def = style.fonts[font];
    const key = `${font}|${Math.round(sizePx * 4)}|${text}`;
    const hit = this.widthCache.get(key);
    if (hit !== undefined) return hit;
    this.setFont(fontCss(def, sizePx), def.letterSpacingEm * sizePx);
    const w = this.ctx.measureText(text).width;
    if (this.widthCache.size > 4000) this.widthCache.clear();
    this.widthCache.set(key, w);
    return w;
  };

  /** Compute + draw a frame for time `tMs`. Pure with respect to tMs: safe to call with any value in any order. */
  render(tMs: number): Frame | null {
    const tl = this.timeline;
    if (!tl || !this.width) return null;
    const frame = computeFrame(tl, tMs, {
      width: this.width,
      height: this.height,
      reducedMotion: this.options.reducedMotion,
      motionScale: this.options.motionScale,
      measure: this.measure,
      layoutEpoch: this.layoutEpoch,
      colorMode: this.options.colorMode,
      emojis: this.options.emojis,
      doodles: this.options.doodles,
      artwork: this.options.artwork,
      interlude: this.options.interlude,
      density: this.density,
    });
    this.draw(frame, tl);
    return frame;
  }

  /**
   * Dev tool: average cost of rendering the frame at `tMs`, in ms, INCLUDING the GPU flush
   * (a 1px readback forces the queued draw calls to actually execute).
   */
  bench(tMs: number, n = 30): number {
    this.render(tMs);
    this.ctx.getImageData(0, 0, 1, 1);
    const t0 = performance.now();
    for (let i = 0; i < n; i++) this.render(tMs + i * 16.7);
    this.ctx.getImageData(0, 0, 1, 1);
    return (performance.now() - t0) / n;
  }

  private draw(frame: Frame, tl: VisualTimeline) {
    const ctx = this.ctx;
    const { width: W, height: H, dpr } = this;
    const prof = QUALITY_PROFILE[this.options.quality];
    const style = STYLES[tl.style];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 0;

    // ---- background -----------------------------------------------------------------------
    const ang = (frame.bg.angleDeg * Math.PI) / 180;
    const gx = Math.cos(ang) * W * 0.5;
    const gy = Math.sin(ang) * H * 0.5;
    const grad = ctx.createLinearGradient(W / 2 - gx, H / 2 - gy, W / 2 + gx, H / 2 + gy);
    grad.addColorStop(0, frame.bg.c0);
    grad.addColorStop(1, frame.bg.c1);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    // a glow where the cover's brightest color sits: ties the whole stage to the artwork
    if (frame.bg.glow && frame.bg.glow.alpha > 0.01) {
      const g = frame.bg.glow;
      const rad = Math.max(W, H) * 0.7;
      const glow = ctx.createRadialGradient(g.x * W, g.y * H, 0, g.x * W, g.y * H, rad);
      glow.addColorStop(0, g.color);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.globalAlpha = g.alpha;
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // ---- camera -----------------------------------------------------------------------------
    ctx.save();
    ctx.translate(W / 2 + frame.camera.x, H / 2 + frame.camera.y);
    ctx.rotate((frame.camera.rotationDeg * Math.PI) / 180);
    ctx.scale(frame.camera.zoom, frame.camera.zoom);
    ctx.translate(-W / 2, -H / 2);

    if (tl.style === 'y2k') this.drawGrid(frame, W, H);
    this.drawArtwork(frame, W, H);
    if (frame.overlays.halftone > 0.01 && prof.halftone && this.options.texture) this.drawHalftone(frame, tl, W, H);
    this.drawMarquee(frame, style, prof.marqueeRows, W, H);
    if (frame.interlude.amount > 0.01) this.drawInterlude(frame, W, H);

    // ---- vector doodles (behind the words) ---------------------------------------------------------
    ctx.translate(W / 2, H / 2);
    for (const d of frame.doodles) {
      if (d.alpha <= 0.01 || d.size <= 1) continue;
      ctx.save();
      ctx.globalAlpha = d.alpha;
      ctx.translate(d.x, d.y);
      ctx.rotate((d.rotationDeg * Math.PI) / 180);
      drawDoodle(ctx, d.kind, d.size, { fill: d.fill, stroke: d.stroke, lineWidth: d.lineWidth, accent: d.accent }, d.seed);
      ctx.restore();
    }

    // ---- words ---------------------------------------------------------------------------------
    for (const w of frame.words) this.drawWord(w, tl, prof.echo);

    // ---- emoji stickers (cached sprites) ------------------------------------------------------------
    for (const e of frame.emojis) {
      if (e.alpha <= 0.01 || e.sizePx < 3) continue;
      const sprite = this.emojiSprite(e.char);
      if (!sprite) continue;
      ctx.save();
      ctx.globalAlpha = e.alpha;
      ctx.translate(e.x, e.y);
      ctx.rotate((e.rotationDeg * Math.PI) / 180);
      ctx.drawImage(sprite, -e.sizePx / 2, -e.sizePx / 2, e.sizePx, e.sizePx);
      ctx.restore();
    }
    ctx.restore();

    // ---- overlays (screen space) ------------------------------------------------------------------
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (frame.overlays.vignette > 0) {
      const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, `rgba(0,0,0,${frame.overlays.vignette * 0.6})`);
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
    }
    if (frame.overlays.scanlines > 0 && prof.scanlines && this.options.texture) {
      // one pattern fill instead of ~250 fillRect calls
      if (!this.scanPattern) {
        const c = document.createElement('canvas');
        c.width = 1;
        c.height = 3;
        const cx = c.getContext('2d')!;
        cx.fillStyle = '#000';
        cx.fillRect(0, 0, 1, 1);
        this.scanPattern = ctx.createPattern(c, 'repeat');
      }
      if (this.scanPattern) {
        ctx.save();
        ctx.globalAlpha = frame.overlays.scanlines;
        ctx.fillStyle = this.scanPattern;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    }
    if (frame.overlays.flash > 0.002) {
      ctx.fillStyle = `rgba(255,255,255,${frame.overlays.flash})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (frame.overlays.grain > 0 && prof.grain && this.options.texture) this.drawGrain(frame, W, H);
  }

  /** The generative show for instrumental moments. Everything is a plain gradient / stroke / dot: cheap and deterministic. */
  private drawInterlude(frame: Frame, W: number, H: number) {
    const ctx = this.ctx;
    const it = frame.interlude;
    ctx.save();
    // aurora lights: soft radial gradients (colors fade to fully transparent versions of themselves)
    for (const a of it.aurora) {
      const g = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, a.r);
      g.addColorStop(0, a.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = a.alpha;
      ctx.fillStyle = g;
      ctx.fillRect(a.x - a.r, a.y - a.r, a.r * 2, a.r * 2);
    }
    // beat rings
    for (const r of it.rings) {
      ctx.globalAlpha = r.alpha;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // flowing ribbons
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const b of it.ribbons) {
      ctx.globalAlpha = b.alpha;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.width;
      ctx.beginPath();
      const steps = 40;
      for (let i = 0; i <= steps; i++) {
        const x = (W * i) / steps;
        const u = i / steps;
        const y = b.y + Math.sin(u * Math.PI * b.freq * 2 + b.phase) * b.amp * (0.6 + 0.4 * Math.sin(u * Math.PI * 3 - b.phase * 0.5));
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    // rising particles
    for (const p of it.particles) {
      if (p.alpha < 0.02) continue;
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.8, p.size), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---- emoji: rasterise each emoji ONCE at a fixed size, then just scale the bitmap -----------------
  private emojiSprite(char: string): HTMLCanvasElement | null {
    let s = this.emojiSprites.get(char);
    if (!s) {
      s = document.createElement('canvas');
      s.width = s.height = SPRITE_PX;
      const c = s.getContext('2d') as Ls;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = `${Math.round(SPRITE_PX * 0.82)}px ${EMOJI_FONT}`;
      c.fillText(char, SPRITE_PX / 2, SPRITE_PX / 2 + SPRITE_PX * 0.04);
      if (this.emojiSprites.size > 120) this.emojiSprites.clear();
      this.emojiSprites.set(char, s);
    }
    return s;
  }

  // ---- marquee: one cached strip per row text, scrolled with drawImage ---------------------------------
  private drawMarquee(frame: Frame, style: (typeof STYLES)[keyof typeof STYLES], maxRows: number, W: number, H: number) {
    if (!frame.marquee.length || maxRows <= 0) return;
    const ctx = this.ctx;
    const every = Math.max(1, Math.ceil(frame.marquee.length / maxRows));
    const rows = frame.marquee.filter((_, i) => i % every === 0).slice(0, maxRows);
    for (const row of rows) {
      const def = style.fonts[row.font];
      const size = Math.round(row.sizePx / 4) * 4; // bucket sizes so strips are reusable
      const key = `${row.font}|${size}|${row.color}|${row.text.slice(0, 60)}`;
      let strip = this.marqueeStrips.get(key);
      if (!strip) {
        const unit = row.text.slice(0, Math.max(1, Math.floor(row.text.length / 4))); // one phrase (the frame repeats it 4x)
        const probe = document.createElement('canvas').getContext('2d') as Ls;
        probe.font = fontCss(def, size);
        probe.letterSpacing = `${def.letterSpacingEm * size}px`;
        const unitW = Math.max(40, probe.measureText(unit).width);
        const repeats = Math.max(2, Math.ceil((W * 1.2) / unitW) + 1);
        const c = document.createElement('canvas');
        c.width = Math.min(8192, Math.ceil(unitW * repeats));
        c.height = Math.ceil(size * 1.4);
        const cx = c.getContext('2d') as Ls;
        cx.font = fontCss(def, size);
        cx.letterSpacing = `${def.letterSpacingEm * size}px`;
        cx.fillStyle = row.color;
        cx.textBaseline = 'middle';
        cx.fillText(unit.repeat(repeats), 0, c.height / 2);
        strip = { canvas: c, w: unitW };
        if (this.marqueeStrips.size > 24) this.marqueeStrips.clear();
        this.marqueeStrips.set(key, strip);
      }
      ctx.save();
      ctx.globalAlpha = row.alpha;
      // wrap the scroll offset to one phrase width so the strip never runs out
      const off = ((row.offsetX % strip.w) + strip.w) % strip.w;
      ctx.drawImage(strip.canvas, -off, H / 2 + row.y - strip.canvas.height / 2);
      ctx.restore();
    }
  }

  private drawWord(w: DrawWord, tl: VisualTimeline, maxEcho: number) {
    const ctx = this.ctx;
    if (w.alpha <= 0.005) return;
    const style = STYLES[tl.style];
    const def = style.fonts[w.font];
    let size = w.sizePx;
    let textWidth = this.measure(w.text, w.font, size);
    if (textWidth * Math.abs(w.scaleX) > w.maxWidthPx) {
      size *= w.maxWidthPx / (textWidth * Math.abs(w.scaleX));
      textWidth = this.measure(w.text, w.font, size);
    }
    this.setFont(fontCss(def, size), def.letterSpacingEm * size);

    const drawGlyphs = (alpha: number, dy = 0, clip?: 'top' | 'bottom') => {
      ctx.save();
      ctx.globalAlpha = Math.min(1, w.alpha * alpha);
      ctx.translate(w.x, w.y + dy);
      ctx.rotate((w.rotationDeg * Math.PI) / 180);
      ctx.transform(1, 0, w.skewX, 1, 0, 0);
      ctx.scale(w.scaleX, w.scaleY);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (clip) {
        ctx.beginPath();
        const half = size * 0.6;
        if (clip === 'top') ctx.rect(-textWidth, -half * 2, textWidth * 2, half * 2);
        else ctx.rect(-textWidth, 0, textWidth * 2, half * 2);
        ctx.clip();
      }
      if (w.mask && this.artworkPattern && !clip && this.options.artworkPolicy === 'full') {
        const m = new DOMMatrix().translate(-textWidth / 2, -size / 2).scale((size * 2.4) / 512);
        this.artworkPattern.setTransform(m);
        ctx.fillStyle = this.artworkPattern;
      } else if (tl.style === 'y2k') {
        const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.48, w.fill);
        g.addColorStop(0.52, '#1b1030');
        g.addColorStop(1, w.fill);
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = w.fill;
      }
      if (w.stroke) {
        ctx.lineJoin = 'round';
        ctx.lineWidth = w.strokeWidth ?? 2;
        ctx.strokeStyle = w.stroke;
        ctx.strokeText(w.text, 0, 0);
      }
      ctx.fillText(w.text, 0, 0);
      ctx.restore();
    };

    // echo trails first (psychedelic / y2k)
    for (let i = Math.min(w.echo, maxEcho); i >= 1; i--) {
      ctx.save();
      ctx.translate(-i * size * 0.035, i * size * 0.02);
      drawGlyphs(0.22 / i);
      ctx.restore();
    }
    if (w.split > 0.5 && this.options.quality !== 'low') {
      drawGlyphs(1, -w.split, 'top');
      drawGlyphs(1, w.split, 'bottom');
    } else {
      drawGlyphs(1);
    }
  }

  private drawArtwork(frame: Frame, W: number, H: number) {
    const ctx = this.ctx;
    const art = this.artwork;
    const a = frame.artwork;
    if (!art || a.alpha <= 0.01 || this.options.artwork === 'off') return;
    const plain = this.options.artworkPolicy === 'unmodified';
    if (plain && a.mode === 'backdrop') return;
    ctx.save();
    ctx.globalAlpha = plain ? Math.min(1, a.hero * 1.2) : Math.min(1, a.alpha);
    if (a.mode === 'hero') {
      const side = Math.min(W, H) * 0.74 * a.scale * 1.35;
      ctx.translate(W / 2 + a.x, H / 2 + a.y);
      if (!plain) ctx.rotate((a.rotationDeg * Math.PI) / 180);
      // soft drop shadow without shadowBlur (which is very expensive on large images)
      const prev = ctx.globalAlpha;
      for (let i = 3; i >= 1; i--) {
        ctx.globalAlpha = prev * 0.12;
        ctx.fillStyle = '#000';
        ctx.fillRect(-side / 2 - i * 5, -side / 2 + 10 + i * 6, side + i * 10, side + i * 4);
      }
      ctx.globalAlpha = prev;
      ctx.drawImage(art, -side / 2, -side / 2, side, side);
    } else if (a.mode === 'sticker') {
      const side = Math.min(W, H) * 0.34;
      ctx.translate(W * 0.82, H * 0.2);
      if (!plain) ctx.rotate((a.rotationDeg * Math.PI) / 180);
      ctx.globalAlpha = plain ? 1 : 0.9;
      ctx.drawImage(art, -side / 2, -side / 2, side, side);
    } else {
      // background layer: the cover as a soft, blurred wash that slowly drifts (cheap: a 56px bitmap scaled up)
      const soft = this.artworkSoft;
      if (!soft) {
        ctx.restore();
        return;
      }
      const side = Math.max(W, H) * 1.25 * a.scale;
      const t = frame.tMs / 1000;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.translate(W / 2 + Math.sin(t / 7) * W * 0.03, H / 2 + Math.cos(t / 9) * H * 0.03);
      ctx.rotate((Math.sin(t / 13) * 2 * Math.PI) / 180);
      ctx.drawImage(soft, -side / 2, -side / 2, side, side);
    }
    ctx.restore();
  }

  /** Halftone dots are baked into a bitmap WITH their color; drawing it is a plain source-over blit (no blend mode). */
  private drawHalftone(frame: Frame, tl: VisualTimeline, W: number, H: number) {
    const dots = frame.bg.invert ? 'rgba(0,0,0,0.5)' : (frame.palette[0] ?? tl.palette[0] ?? '#fff');
    const key = `${dots}|${Math.round(W)}x${Math.round(H)}`;
    let c = this.halftoneCache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = Math.ceil(W);
      c.height = Math.ceil(H);
      const cx = c.getContext('2d')!;
      const step = Math.max(14, Math.min(W, H) / 38);
      cx.fillStyle = dots;
      for (let y = 0; y < H + step; y += step) {
        for (let x = 0; x < W + step; x += step) {
          const dx = (x - W * 0.5) / W;
          const dy = (y - H * 0.5) / H;
          const d = Math.min(1, Math.hypot(dx, dy) * 1.5);
          const r = (step / 2) * d * d * 1.1;
          if (r > 0.6) {
            cx.beginPath();
            cx.arc(x + ((y / step) % 2 ? step / 2 : 0), y, r, 0, Math.PI * 2);
            cx.fill();
          }
        }
      }
      if (this.halftoneCache.size > 6) this.halftoneCache.clear();
      this.halftoneCache.set(key, c);
    }
    this.ctx.save();
    this.ctx.globalAlpha = frame.overlays.halftone * (frame.bg.invert ? 0.6 : 0.8);
    this.ctx.drawImage(c, 0, 0, W, H);
    this.ctx.restore();
  }

  private drawGrid(frame: Frame, W: number, H: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = mix(frame.accent, frame.bg.c0, 0.5);
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    const horizon = H * 0.56;
    const phase = (frame.tMs / 1000) % 1;
    ctx.beginPath();
    for (let i = 0; i < 14; i++) {
      const t = (i + phase) / 14;
      const y = horizon + Math.pow(t, 2.2) * (H - horizon);
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    for (let i = -10; i <= 10; i++) {
      ctx.moveTo(W / 2 + i * 10, horizon);
      ctx.lineTo(W / 2 + i * W * 0.14, H);
    }
    ctx.stroke(); // one stroke call for the whole grid
    ctx.restore();
  }

  /**
   * Film grain: a tiny noise tile with its alpha baked in, painted via a repeating pattern in ONE fillRect
   * with normal blending (the old per-tile 'overlay' blend cost ~20 ms/frame).
   */
  private drawGrain(frame: Frame, W: number, H: number) {
    const ctx = this.ctx;
    if (!this.grainPattern) {
      const c = document.createElement('canvas');
      c.width = c.height = 160;
      const cx = c.getContext('2d')!;
      const img = cx.createImageData(160, 160);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() > 0.5 ? 255 : 0;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = Math.random() * 38;
      }
      cx.putImageData(img, 0, 0);
      this.grainPattern = ctx.createPattern(c, 'repeat');
    }
    if (!this.grainPattern) return;
    // jitter the pattern on a fixed 80 ms cadence (deterministic in tMs)
    const k = Math.floor(frame.tMs / 80);
    ctx.save();
    ctx.globalAlpha = Math.min(1, frame.overlays.grain * 4);
    ctx.translate((k * 53) % 160, (k * 97) % 160);
    ctx.fillStyle = this.grainPattern;
    ctx.fillRect(-160, -160, W + 320, H + 320);
    ctx.restore();
  }
}
