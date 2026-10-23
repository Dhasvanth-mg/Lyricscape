// Canvas 2D renderer for `Frame`s produced by computeFrame().
// Browser-only. Contains no timing logic: it draws exactly what the frame says.

import { computeFrame } from './frame';
import { REQUIRED_FONT_LOADS, STYLES, fontCss } from './styles';
import type { DrawWord, FontKey, Frame, VisualTimeline } from './types';
import { mix } from './util';

export type RendererOptions = {
  reducedMotion: boolean;
  motionScale: number;
  /** 'low' skips filters, echo and grain for weaker devices */
  quality: 'high' | 'low';
  /** 'unmodified' = show artwork only as-is (required for Spotify art): no backdrop dimming, masks, tilt or recolouring. */
  artworkPolicy: 'full' | 'unmodified';
};

export class KineticRenderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  width = 0;
  height = 0;
  private artwork: CanvasImageSource | null = null;
  private artworkPattern: CanvasPattern | null = null;
  private grain: HTMLCanvasElement | null = null;
  private halftoneCache = new Map<string, HTMLCanvasElement>();
  private layoutEpoch = 0;
  private timeline: VisualTimeline | null = null;
  options: RendererOptions = { reducedMotion: false, motionScale: 1, quality: 'high', artworkPolicy: 'full' };

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
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
    this.layoutEpoch++;
  }

  setTimeline(tl: VisualTimeline | null) {
    this.timeline = tl;
    this.layoutEpoch++;
  }

  setArtwork(img: CanvasImageSource | null) {
    this.artwork = img;
    this.artworkPattern = null;
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

  resize(cssWidth: number, cssHeight: number, dpr = Math.min(2, window.devicePixelRatio || 1)) {
    this.dpr = dpr;
    this.width = Math.max(2, Math.floor(cssWidth));
    this.height = Math.max(2, Math.floor(cssHeight));
    this.canvas.width = Math.floor(this.width * dpr);
    this.canvas.height = Math.floor(this.height * dpr);
    this.layoutEpoch++;
  }

  private measure = (text: string, font: FontKey, sizePx: number): number => {
    const style = this.timeline ? STYLES[this.timeline.style] : STYLES.maximalist;
    const def = style.fonts[font];
    this.ctx.font = fontCss(def, sizePx);
    (this.ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${def.letterSpacingEm * sizePx}px`;
    return this.ctx.measureText(text).width;
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
    });
    this.draw(frame, tl);
    return frame;
  }

  private draw(frame: Frame, tl: VisualTimeline) {
    const ctx = this.ctx;
    const { width: W, height: H, dpr } = this;
    const style = STYLES[tl.style];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';

    // ---- background -----------------------------------------------------------------------
    const ang = (frame.bg.angleDeg * Math.PI) / 180;
    const gx = Math.cos(ang) * W * 0.5;
    const gy = Math.sin(ang) * H * 0.5;
    const grad = ctx.createLinearGradient(W / 2 - gx, H / 2 - gy, W / 2 + gx, H / 2 + gy);
    grad.addColorStop(0, frame.bg.c0);
    grad.addColorStop(1, frame.bg.c1);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // ---- camera -----------------------------------------------------------------------------
    ctx.save();
    ctx.translate(W / 2 + frame.camera.x, H / 2 + frame.camera.y);
    ctx.rotate((frame.camera.rotationDeg * Math.PI) / 180);
    ctx.scale(frame.camera.zoom, frame.camera.zoom);
    ctx.translate(-W / 2, -H / 2);

    if (tl.style === 'y2k') this.drawGrid(frame, W, H);
    this.drawArtwork(frame, W, H);
    if (frame.overlays.halftone > 0.01 && this.options.quality === 'high') this.drawHalftone(frame, tl, W, H);

    // marquee rows behind words
    for (const row of frame.marquee) {
      const def = style.fonts[row.font];
      ctx.save();
      ctx.globalAlpha = row.alpha;
      ctx.fillStyle = row.color;
      ctx.font = fontCss(def, row.sizePx);
      ctx.textBaseline = 'middle';
      ctx.fillText(row.text, row.offsetX, H / 2 + row.y);
      ctx.restore();
    }

    // ---- words ---------------------------------------------------------------------------------
    ctx.translate(W / 2, H / 2);
    for (const w of frame.words) this.drawWord(w, tl);
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
    if (frame.overlays.scanlines > 0 && this.options.quality === 'high') {
      ctx.fillStyle = `rgba(0,0,0,${frame.overlays.scanlines})`;
      for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    }
    if (frame.overlays.flash > 0.002) {
      ctx.fillStyle = `rgba(255,255,255,${frame.overlays.flash})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (frame.overlays.grain > 0 && this.options.quality === 'high') this.drawGrain(frame, W, H);
  }

  private drawWord(w: DrawWord, tl: VisualTimeline) {
    const ctx = this.ctx;
    if (w.alpha <= 0.005) return;
    const style = STYLES[tl.style];
    const def = style.fonts[w.font];
    let size = w.sizePx;
    ctx.font = fontCss(def, size);
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${def.letterSpacingEm * size}px`;
    let width = ctx.measureText(w.text).width * Math.abs(w.scaleX);
    if (width > w.maxWidthPx) {
      size *= w.maxWidthPx / width;
      ctx.font = fontCss(def, size);
      (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${def.letterSpacingEm * size}px`;
      width = w.maxWidthPx;
    }
    const textWidth = ctx.measureText(w.text).width;

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
      if (this.options.quality === 'high' && w.blur > 0.4) ctx.filter = `blur(${w.blur.toFixed(1)}px)`;

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

    // echo trails first
    if (this.options.quality === 'high') {
      for (let i = w.echo; i >= 1; i--) {
        ctx.save();
        ctx.translate(-i * size * 0.035, i * size * 0.02);
        drawGlyphs(0.22 / i);
        ctx.restore();
      }
    }
    if (w.split > 0.5) {
      drawGlyphs(1, -w.split, 'top');
      drawGlyphs(1, w.split, 'bottom');
    } else {
      drawGlyphs(1);
    }
    ctx.filter = 'none';
  }

  private drawArtwork(frame: Frame, W: number, H: number) {
    const ctx = this.ctx;
    const art = this.artwork;
    const a = frame.artwork;
    if (!art || a.alpha <= 0.01) return;
    const plain = this.options.artworkPolicy === 'unmodified';
    if (plain && a.mode === 'backdrop') return;
    ctx.save();
    ctx.globalAlpha = plain ? Math.min(1, a.hero * 1.2) : Math.min(1, a.alpha);
    if (a.mode === 'hero') {
      const side = Math.min(W, H) * 0.74 * a.scale * 1.35;
      ctx.translate(W / 2 + a.x, H / 2 + a.y);
      if (!plain) ctx.rotate((a.rotationDeg * Math.PI) / 180);
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = 50;
      ctx.shadowOffsetY = 22;
      ctx.drawImage(art, -side / 2, -side / 2, side, side);
    } else if (a.mode === 'sticker') {
      const side = Math.min(W, H) * 0.34;
      ctx.translate(W * 0.82, H * 0.2);
      if (!plain) ctx.rotate((a.rotationDeg * Math.PI) / 180);
      ctx.globalAlpha = plain ? 1 : 0.9;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 10;
      ctx.drawImage(art, -side / 2, -side / 2, side, side);
    } else {
      const side = Math.max(W, H) * a.scale;
      ctx.translate(W / 2, H / 2);
      ctx.rotate((a.rotationDeg * Math.PI) / 180);
      ctx.drawImage(art, -side / 2, -side / 2, side, side);
    }
    ctx.restore();
  }

  private drawHalftone(frame: Frame, tl: VisualTimeline, W: number, H: number) {
    const key = `${tl.palette[0]}|${Math.round(W)}x${Math.round(H)}`;
    let c = this.halftoneCache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = Math.ceil(W);
      c.height = Math.ceil(H);
      const cx = c.getContext('2d')!;
      const step = Math.max(14, Math.min(W, H) / 38);
      cx.fillStyle = tl.palette[0] ?? '#fff';
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
      if (this.halftoneCache.size > 4) this.halftoneCache.clear();
      this.halftoneCache.set(key, c);
    }
    this.ctx.save();
    this.ctx.globalAlpha = frame.overlays.halftone * (frame.bg.invert ? 0.4 : 1);
    this.ctx.globalCompositeOperation = frame.bg.invert ? 'multiply' : 'screen';
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
    for (let i = 0; i < 14; i++) {
      const t = (i + phase) / 14;
      const y = horizon + Math.pow(t, 2.2) * (H - horizon);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    for (let i = -10; i <= 10; i++) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + i * 10, horizon);
      ctx.lineTo(W / 2 + i * W * 0.14, H);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawGrain(frame: Frame, W: number, H: number) {
    if (!this.grain) {
      const c = document.createElement('canvas');
      c.width = c.height = 192;
      const cx = c.getContext('2d')!;
      const img = cx.createImageData(192, 192);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      cx.putImageData(img, 0, 0);
      this.grain = c;
    }
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = frame.overlays.grain * 0.35;
    ctx.globalCompositeOperation = 'overlay';
    // jitter the tile on a fixed 80ms cadence (deterministic in tMs)
    const k = Math.floor(frame.tMs / 80);
    const ox = (k * 53) % 192;
    const oy = (k * 97) % 192;
    for (let y = -oy; y < H; y += 192) for (let x = -ox; x < W; x += 192) ctx.drawImage(this.grain, x, y);
    ctx.restore();
  }
}
