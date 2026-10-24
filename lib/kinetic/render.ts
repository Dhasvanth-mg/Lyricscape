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
import { REQUIRED_FONT_LOADS, STYLES, fontCss, fontLoadsFor, type SceneKind } from './styles';
import type { Look } from './look';
import { drawDoodle } from './doodles';
import { PIXEL_BUDGET, QUALITY_PROFILE, type QualityLevel } from './governor';
import type { DrawWord, FontKey, Frame, VisualTimeline } from './types';
import { contrastRatio, mix, rgbToHex } from './util';
import { drawIcon, iconColors, type IconId } from './icons';
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
  private iconSprites = new Map<string, HTMLCanvasElement>();
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
  };

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

  /** The resolved art direction for this song (null = the classic style table). Changing it re-measures text and loads its faces. */
  private look: Look | null = null;
  setLook(look: Look | null) {
    if (look?.key === this.look?.key) return;
    this.look = look;
    this.invalidateText();
    if (look && typeof document !== 'undefined' && document.fonts) {
      void Promise.all(fontLoadsFor(look.style).map((f) => document.fonts.load(f, 'Aa lyrics')))
        .then(() => this.invalidateText())
        .catch(() => undefined);
    }
  }
  private currentStyle() {
    return this.look?.style ?? (this.timeline ? STYLES[this.timeline.style] : STYLES.maximalist);
  }

  setTimeline(tl: VisualTimeline | null) {
    this.timeline = tl;
    this.invalidateText();
  }

  setArtwork(source: CanvasImageSource | null) {
    // Draw the cover into a canvas ONCE. A vector (SVG) cover would otherwise be re-rasterised by the browser on every drawImage
    // (measured: ~25 ms per frame at 1080p for a framed card), and a large photo is decoded and scaled again and again.
    let img = source;
    if (source && typeof document !== 'undefined') {
      const el = source as HTMLImageElement;
      const nw = el.naturalWidth || el.width || 0;
      const nh = el.naturalHeight || el.height || 0;
      if (nw > 0 && nh > 0) {
        const side = Math.min(1024, Math.max(nw, nh) > 1024 ? 1024 : Math.max(nw, nh, 512));
        const c = document.createElement('canvas');
        c.width = c.height = side;
        const cx = c.getContext('2d');
        if (cx) {
          cx.imageSmoothingQuality = 'high';
          // covers are square; anything else is centre-cropped
          const s = Math.min(nw, nh);
          cx.drawImage(source, (nw - s) / 2, (nh - s) / 2, s, s, 0, 0, side, side);
          img = c;
        }
      }
    }
    this.artwork = img;
    this.artGrid = null;
    if (img) {
      try {
        const g = document.createElement('canvas');
        g.width = g.height = 48;
        const gx = g.getContext('2d', { willReadFrequently: true });
        if (gx) {
          gx.drawImage(img, 0, 0, 48, 48);
          this.artGrid = gx.getImageData(0, 0, 48, 48).data;
        }
      } catch {
        this.artGrid = null; // a cross-origin cover without CORS headers cannot be read: words fall back to white with an edge
      }
    }
    this.artworkPattern = null;
    this.artworkSoft = null;
    this.artMist = null;
    this.artSoft160 = null;
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
    const style = this.currentStyle();
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
      density: this.density,
      look: this.look ?? undefined,
    });
    this.lastFrame = frame;
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
    const style = this.currentStyle();
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
    if (style.scene) this.drawScenery(style.scene, frame, W, H);
    this.bleedSide = 0;
    this.drawArtwork(frame, W, H);
    for (const d of frame.disrupt) {
      ctx.globalAlpha = d.alpha;
      ctx.fillStyle = d.color;
      ctx.fillRect(d.x, d.y, d.w, d.h);
    }
    ctx.globalAlpha = 1;
    if (frame.overlays.halftone > 0.01 && prof.halftone) this.drawHalftone(frame, tl, W, H);
    this.drawMarquee(frame, style, prof.marqueeRows, W, H);
    if (frame.interlude.amount > 0.01) this.drawInterlude(frame, W, H);

    // ---- readability scrim: a soft pool behind the words so they hold up over busy art and doodles ----------------
    if (frame.overlays.scrim > 0.01) {
      const rad = Math.max(W, H) * 0.62;
      const sc = ctx.createRadialGradient(W / 2, H / 2, rad * 0.15, W / 2, H / 2, rad);
      const base = frame.overlays.scrimDark ? '0,0,0' : '255,255,255';
      sc.addColorStop(0, `rgba(${base},${frame.overlays.scrim})`);
      sc.addColorStop(1, `rgba(${base},0)`);
      ctx.fillStyle = sc;
      ctx.fillRect(0, 0, W, H);
    }

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
    for (const e of frame.icons) {
      if (e.alpha <= 0.01 || e.sizePx < 3) continue;
      const sprite = this.iconSprite(e.icon, frame.tone.accent, frame.tone.ink);
      if (!sprite) continue;
      ctx.save();
      ctx.globalAlpha = e.alpha;
      ctx.translate(e.x, e.y);
      ctx.rotate((e.rotationDeg * Math.PI) / 180);
      ctx.drawImage(sprite, -e.sizePx / 2, -e.sizePx / 2, e.sizePx, e.sizePx);
      ctx.restore();
    }
    ctx.restore();

    // ---- next-line preview (screen space, quiet) -----------------------------------------------------
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (frame.caption && frame.caption.alpha > 0.02) this.drawCaption(frame, style, W, H);

    // ---- overlays (screen space) ------------------------------------------------------------------
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (frame.overlays.vignette > 0) {
      const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, `rgba(0,0,0,${frame.overlays.vignette * 0.6})`);
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, W, H);
    }
    if (frame.overlays.scanlines > 0 && prof.scanlines) {
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
    if (frame.overlays.grain > 0 && prof.grain) this.drawGrain(frame, W, H);
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

  // ---- icons: the custom vector set is drawn ONCE per icon and tone into a sprite, then just scaled ------------
  private iconSprite(id: IconId, accent: string, ink: string): HTMLCanvasElement | null {
    // a pale sticker edge on dark stages, a dark one on light stages, so the icon always separates from its ground
    const darkStage = contrastRatio(ink, '#000000') > contrastRatio(ink, '#ffffff');
    const edge = darkStage ? '#ffffff' : '#2a2433';
    const key = `${id}|${accent}|${edge}`;
    let s = this.iconSprites.get(key);
    if (!s) {
      s = document.createElement('canvas');
      s.width = s.height = SPRITE_PX;
      const c = s.getContext('2d') as Ls;
      c.translate(SPRITE_PX / 2, SPRITE_PX / 2);
      drawIcon(c, id, SPRITE_PX - 6, iconColors(id, accent), edge);
      if (this.iconSprites.size > 160) this.iconSprites.clear();
      this.iconSprites.set(key, s);
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

  private lastFrame!: Frame;

  /** The average colour of whatever sits behind a word: the full-bleed cover under its box, else the ground. */
  private sampleBehind(x: number, y: number, w: number, h: number, frame: Frame): string {
    const grid = this.artGrid;
    const side = this.bleedSide;
    if (!grid || !side) return mix(frame.bg.c0, frame.bg.c1, 0.5);
    const ox = this.width / 2 - side / 2;
    const oy = this.height / 2 - side / 2;
    const cell = (v: number) => Math.max(0, Math.min(47, Math.floor(v * 48)));
    const u0 = cell((this.width / 2 + x - w / 2 - ox) / side);
    const u1 = cell((this.width / 2 + x + w / 2 - ox) / side);
    const v0 = cell((this.height / 2 + y - h / 2 - oy) / side);
    const v1 = cell((this.height / 2 + y + h / 2 - oy) / side);
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let v = Math.min(v0, v1); v <= Math.max(v0, v1); v++)
      for (let u = Math.min(u0, u1); u <= Math.max(u0, u1); u++) {
        const i = (v * 48 + u) * 4;
        r += grid[i]!;
        g += grid[i + 1]!;
        b += grid[i + 2]!;
        n++;
      }
    return n ? rgbToHex(r / n, g / n, b / n) : mix(frame.bg.c0, frame.bg.c1, 0.5);
  }

  /** First colour on the word's list that reads (>= 3.4:1) against what is behind it, else the best of them, with a matching edge. */
  private adaptInk(w: DrawWord, size: number, textWidth: number, frame: Frame): { fill: string; edge: string; edgeK: number } | null {
    if (!w.adapt || w.adapt.length === 0) return null;
    const behind = this.sampleBehind(w.x, w.y, textWidth * Math.abs(w.scaleX), size * Math.abs(w.scaleY), frame);
    let pick: string | null = null;
    let best = w.adapt[0]!;
    let bestRatio = 0;
    for (const c of w.adapt) {
      const r = contrastRatio(c, behind);
      if (r >= 3.4 && !pick) pick = c;
      if (r > bestRatio) {
        bestRatio = r;
        best = c;
      }
    }
    const fill = pick ?? best;
    const light = contrastRatio(fill, '#000000') > contrastRatio(fill, '#ffffff');
    const ratio = contrastRatio(fill, behind);
    // the edge is a safety net: none where the colour already reads strongly, thin where it reads, full where it is marginal
    return { fill, edge: light ? 'rgba(20,12,28,0.9)' : 'rgba(255,255,255,0.95)', edgeK: ratio >= 7 ? 0 : ratio >= 4.5 ? 0.05 : 0.09 };
  }

  private drawWord(w: DrawWord, tl: VisualTimeline, maxEcho: number) {
    const ctx = this.ctx;
    if (w.alpha <= 0.005) return;
    const style = this.currentStyle();
    const def = style.fonts[w.font];
    let size = w.sizePx;
    let textWidth = this.measure(w.text, w.font, size);
    if (textWidth * Math.abs(w.scaleX) > w.maxWidthPx) {
      size *= w.maxWidthPx / (textWidth * Math.abs(w.scaleX));
      textWidth = this.measure(w.text, w.font, size);
    }
    this.setFont(fontCss(def, size), def.letterSpacingEm * size);
    const ink = this.adaptInk(w, size, textWidth, this.lastFrame);

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
      } else if (w.gradient === 'sunset') {
        const g = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
        g.addColorStop(0, '#ffe66d');
        g.addColorStop(0.5, '#ff5ea8');
        g.addColorStop(1, '#46e3ff');
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = ink?.fill ?? w.fill;
      }
      if (w.chip && !clip) {
        // a solid rounded chip behind the word, with a soft lift
        const px = size * 0.16;
        const cw = textWidth + px * 2;
        const ch = size * 0.86;
        ctx.save();
        ctx.fillStyle = 'rgba(20,10,30,0.22)';
        ctx.beginPath();
        ctx.roundRect(-cw / 2, -size * 0.46 + size * 0.05, cw, ch, size * 0.24);
        ctx.fill();
        ctx.fillStyle = w.chip;
        ctx.beginPath();
        ctx.roundRect(-cw / 2, -size * 0.46, cw, ch, size * 0.24);
        ctx.fill();
        ctx.restore();
      }
      // text treatments (skipped on the light profile and on the split halves)
      if (!clip && this.options.quality !== 'low') {
        const base = ctx.globalAlpha;
        if (w.focus && w.focus > 0.03) {
          // a soft ghost that settles into the word as it lands (a focus pull), no filters
          ctx.save();
          ctx.globalAlpha = base * 0.34 * w.focus;
          ctx.scale(1 + 0.08 * w.focus, 1 + 0.08 * w.focus);
          ctx.fillText(w.text, 0, 0);
          ctx.restore();
        }
        if (w.highlight) {
          ctx.save();
          ctx.globalAlpha = base * 0.8;
          ctx.fillStyle = w.highlight;
          ctx.beginPath();
          const pad = size * 0.08;
          ctx.roundRect(-textWidth / 2 - pad, -size * 0.3, textWidth + pad * 2, size * 0.62, size * 0.1);
          ctx.fill();
          ctx.restore();
        }
        if (w.shadow) {
          ctx.save();
          ctx.translate(w.shadow, w.shadow);
          ctx.fillStyle = '#111018';
          ctx.strokeStyle = '#111018';
          ctx.lineJoin = 'round';
          ctx.lineWidth = w.strokeWidth ?? 2;
          ctx.strokeText(w.text, 0, 0);
          ctx.fillText(w.text, 0, 0);
          ctx.restore();
        }
        if (w.glow) {
          // soft halo: baked ONCE per word into a small sprite (three wide strokes per word per frame cost ~15 ms at 1080p
          // on integrated graphics), then simply blitted
          const spr = this.glowSprite(w.text, def, size, w.gradient ? '#ff5ea8' : w.fill, w.glow);
          if (spr) {
            ctx.save();
            ctx.globalAlpha = base;
            ctx.drawImage(spr.canvas, -spr.w / 2, -spr.h / 2, spr.w, spr.h);
            ctx.restore();
          }
        }
        if (w.aberration) {
          ctx.save();
          ctx.globalAlpha = base * 0.7;
          ctx.fillStyle = '#ff2a55';
          ctx.fillText(w.text, -w.aberration, 0);
          ctx.fillStyle = '#19e3ff';
          ctx.fillText(w.text, w.aberration, 0);
          ctx.restore();
        }
      }
      if (w.stroke) {
        ctx.lineJoin = 'round';
        ctx.lineWidth = w.strokeWidth ?? 2;
        ctx.strokeStyle = w.stroke;
        ctx.strokeText(w.text, 0, 0);
      }
      if (ink && ink.edgeK > 0 && !clip) {
        // sticker edge: opposite in lightness to the chosen colour, so the word reads whatever the art does underneath
        ctx.save();
        ctx.strokeStyle = ink.edge;
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(2.5, size * ink.edgeK);
        ctx.strokeText(w.text, 0, 0);
        ctx.restore();
      }
      ctx.fillText(w.text, 0, 0);
      if (w.progress !== undefined && w.lit && !clip) {
        // light travels through a held word: the part already sung is painted in the active colour
        ctx.save();
        ctx.beginPath();
        ctx.rect(-textWidth / 2 - size * 0.1, -size, textWidth * w.progress + size * 0.1, size * 2);
        ctx.clip();
        ctx.fillStyle = w.lit;
        ctx.fillText(w.text, 0, 0);
        ctx.restore();
      }
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

  private drawArtworkClassic(frame: Frame, W: number, H: number) {
    const ctx = this.ctx;
    const art = this.artwork;
    const a = frame.artwork;
    if (!art || a.alpha <= 0.01 || this.options.artwork === 'off') return;
    const plain = this.options.artworkPolicy === 'unmodified';
    if (plain && a.mode === 'backdrop') return;
    ctx.save();
    ctx.globalAlpha = a.mode === 'hero' ? Math.min(1, a.hero * 1.15) : plain ? Math.min(1, a.hero * 1.2) : Math.min(1, a.alpha);
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

  // ---- art-direction artwork treatments --------------------------------------------------------------------------------
  private artSoft160: HTMLCanvasElement | null = null;
  private artMist: HTMLCanvasElement | null = null;
  /** the cover as 48 x 48 RGBA, for choosing a word's colour by what is behind it (null when the browser will not let us read it) */
  private artGrid: Uint8ClampedArray | null = null;
  /** side (px) of the full-bleed cover in the frame being drawn; 0 = not drawn this frame */
  private bleedSide = 0;

  /** A 14 px version of the cover: so soft that stripes and edges in the picture dissolve into plain colour fields. */
  private mist(): CanvasImageSource | null {
    if (!this.artworkSoft) return null;
    if (!this.artMist) {
      const c = document.createElement('canvas');
      c.width = c.height = 8;
      const cx = c.getContext('2d');
      if (cx) {
        cx.imageSmoothingQuality = 'high';
        cx.drawImage(this.artworkSoft, 0, 0, 8, 8);
        this.artMist = c;
      }
    }
    return this.artMist;
  }

  /** The cover at a softness level: 0 = as loaded, 1 = 160 px (gently soft), 2 = 56 px (a wash). Built once per cover. */
  private artAt(level: number): CanvasImageSource | null {
    if (!this.artwork) return null;
    if (level <= 0.15) return this.artwork;
    if (level >= 0.85) return this.artworkSoft;
    if (!this.artSoft160) {
      const c = document.createElement('canvas');
      c.width = c.height = 160;
      const cx = c.getContext('2d');
      if (cx) {
        cx.imageSmoothingQuality = 'high';
        cx.drawImage(this.artwork, 0, 0, 160, 160);
        this.artSoft160 = c;
      }
    }
    return this.artSoft160;
  }

  private glowSprites = new Map<string, { canvas: HTMLCanvasElement; w: number; h: number }>();
  private glowSprite(text: string, def: { family: string; weight: number | string; italic?: boolean; letterSpacingEm: number }, size: number, color: string, glow: number) {
    const g = Math.round(glow * 10) / 10;
    const s = Math.max(1, Math.round(size / 2) * 2);
    const key = `${def.family}|${def.weight}|${def.italic ? 1 : 0}|${s}|${text}|${color}|${g}`;
    const hit = this.glowSprites.get(key);
    if (hit) return hit;
    const pad = Math.ceil(s * 0.22 * Math.max(g, 0.3)) + 4;
    const tw = Math.ceil(this.ctx.measureText(text).width);
    const c = document.createElement('canvas');
    c.width = tw + pad * 2;
    c.height = Math.ceil(s * 1.5) + pad * 2;
    const cx = c.getContext('2d');
    if (!cx) return null;
    cx.font = this.ctx.font;
    cx.letterSpacing = `${def.letterSpacingEm * s}px`;
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.strokeStyle = color;
    cx.lineJoin = 'round';
    for (const [k, a] of [[0.2, 0.07], [0.11, 0.12], [0.05, 0.2]] as const) {
      cx.globalAlpha = Math.min(1, a * g * 2.2);
      cx.lineWidth = s * k * g;
      cx.strokeText(text, c.width / 2, c.height / 2);
    }
    const spr = { canvas: c, w: c.width, h: c.height };
    if (this.glowSprites.size > 300) this.glowSprites.clear();
    this.glowSprites.set(key, spr);
    return spr;
  }

  private drawArtwork(frame: Frame, W: number, H: number) {
    const a = frame.artwork;
    const t = a.treatment;
    const asCard = t === 'card' || t === 'collage' || t === 'split';
    if (!this.look || t === 'wash' || (a.mode === 'hero' && !asCard && t !== 'bleed')) return this.drawArtworkClassic(frame, W, H);
    const art = this.artwork;
    if (!art || t === 'off' || this.options.artwork === 'off') return;
    const plain = this.options.artworkPolicy === 'unmodified';
    const ctx = this.ctx;
    const tt = frame.tMs / 1000;
    if (t === 'bleed') {
      // the cover IS the stage: whole, vivid, undimmed, drifting a hair so it breathes
      const side = Math.max(W, H) * 1.1 * (1 + (frame.tMs > 0 ? Math.sin(tt / 23) * 0.012 : 0));
      this.bleedSide = side;
      ctx.drawImage(art, W / 2 - side / 2, H / 2 - side / 2, side, side);
      return;
    }
    if (t === 'defocus' || t === 'tonal') {
      const soft = this.mist();
      if (!soft || plain) return;
      ctx.save();
      ctx.globalAlpha = Math.min(1, a.alpha);
      const side = Math.max(W, H) * (t === 'defocus' ? 1.7 : 1.3) * a.scale;
      ctx.imageSmoothingEnabled = true;
      ctx.translate(W / 2 + Math.sin(tt / 11) * W * 0.04, H / 2 + Math.cos(tt / 13) * H * 0.04);
      ctx.drawImage(soft, -side / 2, -side / 2, side, side);
      if (t === 'tonal') {
        // the cover re-toned into the direction's own ground: one colour over the picture
        ctx.globalAlpha = 0.5;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.fillStyle = frame.bg.c1;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
      return;
    }
    if (t === 'cinema') {
      if (plain) return;
      const src = this.artAt(a.blur);
      if (!src) return;
      ctx.save();
      ctx.globalAlpha = Math.min(1, a.alpha * 1.6);
      // full-bleed crop with a very slow push in (the "tracking" of a long take)
      const side = Math.max(W, H) * 1.08 * (1 + Math.sin(tt / 23) * 0.015) * a.scale;
      ctx.translate(W / 2, H / 2);
      ctx.drawImage(src, -side / 2, -side / 2, side, side);
      ctx.restore();
      // the ground closes in from the side the words are on, so the picture never sits under them at full strength
      ctx.save();
      const g = ctx.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, frame.bg.c0);
      g.addColorStop(0.55, 'rgba(0,0,0,0)');
      g.addColorStop(1, frame.bg.c1);
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      return;
    }
    if (t === 'split' && a.split) {
      const src = this.artAt(a.blur);
      if (!src || plain) return;
      const r = a.split;
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x, 0, r.w, H);
      ctx.clip();
      const side = Math.max(r.w, H) * 1.1 * (1 + Math.sin(tt / 19) * 0.01);
      ctx.drawImage(src, r.x + r.w / 2 - side / 2, H / 2 - side / 2, side, side);
      // the picture dissolves into the ground on the side facing the words
      const inner = a.side === 'left' ? r.x + r.w : r.x;
      const g = ctx.createLinearGradient(inner, 0, inner + (a.side === 'left' ? -r.w * 0.45 : r.w * 0.45), 0);
      g.addColorStop(0, frame.bg.c0);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(r.x, 0, r.w, H);
      ctx.restore();
      return;
    }
    if ((t === 'card' || t === 'collage') && a.card) {
      const src = this.artAt(a.blur * 0.5);
      if (!src) return;
      const hero = plain ? 1 : a.hero;
      const c0 = a.card;
      const side = c0.w * (1 + hero * 0.55);
      const cx = c0.x + c0.w / 2 + (W / 2 - (c0.x + c0.w / 2)) * hero;
      const cy = c0.y + c0.h / 2 + (H / 2 - (c0.y + c0.h / 2)) * hero * 0.6;
      ctx.save();
      ctx.translate(cx, cy);
      if (t === 'collage') {
        // a paper scrap behind, the cover a little off square, a strip of tape: intentional imperfection
        ctx.save();
        ctx.rotate((3.2 * Math.PI) / 180);
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = frame.tone.support;
        ctx.fillRect(-side * 0.58, -side * 0.55, side * 1.16, side * 1.1);
        ctx.restore();
        ctx.rotate((-2.4 * Math.PI) / 180);
      }
      for (let i = 3; i >= 1; i--) {
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = '#000';
        ctx.fillRect(-side / 2 - i * 4, -side / 2 + 8 + i * 6, side + i * 8, side + i * 3);
      }
      ctx.globalAlpha = 1;
      ctx.drawImage(src, -side / 2, -side / 2, side, side);
      if (t === 'collage') {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = frame.tone.ink;
        ctx.save();
        ctx.rotate((-5 * Math.PI) / 180);
        ctx.fillRect(-side * 0.14, -side / 2 - side * 0.05, side * 0.28, side * 0.1);
        ctx.restore();
      }
      if (a.reflect && t === 'card') {
        // a soft reflection on the surface below the card (the cover flipped, fading into the ground)
        const rh = side * 0.42;
        ctx.save();
        ctx.beginPath();
        ctx.rect(-side / 2, side / 2 + side * 0.03, side, rh);
        ctx.clip();
        ctx.translate(0, side / 2 + side * 0.03 + side);
        ctx.scale(1, -1);
        ctx.globalAlpha = 0.3;
        ctx.drawImage(src, -side / 2, 0, side, side);
        ctx.restore();
        const rg = ctx.createLinearGradient(0, side / 2, 0, side / 2 + rh + side * 0.03);
        rg.addColorStop(0, 'rgba(0,0,0,0)');
        rg.addColorStop(1, frame.bg.c0);
        ctx.fillStyle = rg;
        ctx.fillRect(-side / 2, side / 2 + side * 0.03, side, rh);
      }
      ctx.restore();
      // a faint wash keeps the stage tied to the cover when the card sits alone
      const soft = this.mist();
      if (soft && !plain) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, a.alpha * 0.8);
        const s2 = Math.max(W, H) * 1.3;
        ctx.drawImage(soft, W / 2 - s2 / 2, H / 2 - s2 / 2, s2, s2);
        ctx.restore();
      }
    }
  }

  /** Scenery that belongs to the art directions. Plain gradients and strokes; returns false for the classic kinds. */
  private drawDirectionScenery(kind: SceneKind, frame: Frame, W: number, H: number): boolean {
    const ctx = this.ctx;
    const t = frame.tMs / 1000;
    const S = Math.min(H, W * 0.9);
    const pal = frame.palette;
    const lift = frame.lift;
    const pool = (x: number, y: number, r: number, color: string, alpha: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    switch (kind) {
      case 'diffuse': {
        // soft light diffusing through a dark room: two slow pools, one warm, one deep
        ctx.save();
        const breathe = 0.5 + 0.5 * Math.sin(t / 5.5);
        pool(W * (0.3 + Math.sin(t / 17) * 0.05), H * (0.34 + Math.cos(t / 13) * 0.04), Math.max(W, H) * 0.62, pal[0] ?? frame.accent, 0.26 + breathe * 0.05 + lift * 0.12);
        pool(W * (0.78 + Math.cos(t / 19) * 0.04), H * 0.78, Math.max(W, H) * 0.55, pal[2] ?? frame.accent, 0.2 + lift * 0.08);
        ctx.restore();
        return true;
      }
      case 'leaks': {
        // light leaking in from the edges of the frame, drifting slowly
        ctx.save();
        pool(W * 0.02, H * (0.35 + Math.sin(t / 9) * 0.18), Math.max(W, H) * 0.5, pal[1] ?? frame.accent, 0.3 + lift * 0.1);
        pool(W * 0.99, H * (0.7 + Math.cos(t / 11) * 0.16), Math.max(W, H) * 0.46, pal[0] ?? frame.accent, 0.24 + lift * 0.08);
        pool(W * 0.55, H * -0.05, Math.max(W, H) * 0.34, pal[2] ?? frame.accent, 0.14);
        ctx.restore();
        return true;
      }
      case 'bokeh': {
        // city light out of focus, kept to the edges and the lower half so the words stay clear; one accent colour
        ctx.save();
        for (let i = 0; i < 14; i++) {
          const nx = ((i * 0.6180339) % 1) * 0.96 + 0.02;
          const edge = nx < 0.28 || nx > 0.72;
          const ny = edge ? 0.12 + (((i * 0.7548776) % 1) * 0.8) : 0.68 + (((i * 0.7548776) % 1) * 0.28);
          const r = S * (0.03 + ((i * 0.3819) % 1) * 0.07);
          const x = W * nx + Math.sin(t / (9 + i) + i) * W * 0.008;
          const y = H * ny - ((t * (2 + (i % 4))) % 24);
          const color = i % 7 === 0 ? frame.tone.accent : i % 3 === 0 ? (pal[2] ?? frame.tone.support) : frame.tone.support;
          pool(x, y, r, color, i % 7 === 0 ? 0.34 : 0.16);
        }
        ctx.restore();
        return true;
      }
      case 'paper': {
        // paper with a faint fibre and two hairline margins
        const key = `paper|${Math.round(W)}x${Math.round(H)}|${frame.bg.c0}`;
        let tex = this.sceneCache.get(key);
        if (!tex) {
          tex = document.createElement('canvas');
          tex.width = Math.ceil(W);
          tex.height = Math.ceil(H);
          const c = tex.getContext('2d')!;
          const dark = contrastRatio(frame.tone.ink, '#000000') > contrastRatio(frame.tone.ink, '#ffffff');
          let seed = 12345;
          const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
          c.lineWidth = 1;
          for (let i = 0; i < 900; i++) {
            const x = rnd() * W;
            const y = rnd() * H;
            const l = 6 + rnd() * 22;
            const a = rnd() * Math.PI;
            c.strokeStyle = dark ? `rgba(0,0,0,${0.025 + rnd() * 0.035})` : `rgba(255,255,255,${0.02 + rnd() * 0.03})`;
            c.beginPath();
            c.moveTo(x, y);
            c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
            c.stroke();
          }
          this.sceneCache.set(key, tex);
          if (this.sceneCache.size > 8) this.sceneCache.delete(this.sceneCache.keys().next().value as string);
        }
        ctx.save();
        ctx.drawImage(tex, 0, 0, W, H);
        ctx.strokeStyle = frame.tone.support;
        ctx.globalAlpha = 0.28;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(W * 0.05, H * 0.075);
        ctx.lineTo(W * 0.95, H * 0.075);
        ctx.moveTo(W * 0.05, H * 0.925);
        ctx.lineTo(W * 0.95, H * 0.925);
        ctx.stroke();
        ctx.restore();
        return true;
      }
      case 'structure': {
        // structure: corner brackets, margin rules and (only when a real beat grid exists) a row of beat ticks
        ctx.save();
        ctx.strokeStyle = frame.tone.support;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.5;
        const m = Math.min(W, H) * 0.045;
        const L = Math.min(W, H) * 0.05;
        ctx.beginPath();
        for (const [cx, cy, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]] as const) {
          ctx.moveTo(cx + sx * L, cy);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx, cy + sy * L);
        }
        ctx.stroke();
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.moveTo(m, H * 0.5);
        ctx.lineTo(m + L * 0.6, H * 0.5);
        ctx.moveTo(W - m, H * 0.5);
        ctx.lineTo(W - m - L * 0.6, H * 0.5);
        ctx.stroke();
        if (frame.beat.index >= 0) {
          const n = 8;
          const bw = Math.min(W, H) * 0.012;
          for (let i = 0; i < n; i++) {
            const on = frame.beat.index % n === i;
            ctx.globalAlpha = on ? 0.9 : 0.25;
            ctx.fillStyle = on ? frame.tone.accent : frame.tone.support;
            const h = bw * (on ? 3 : 1.6) * (on ? 0.7 + frame.beat.pulse * 0.6 : 1);
            ctx.fillRect(m + i * bw * 2.2, H - m - L - h, bw, h);
          }
        }
        ctx.restore();
        return true;
      }
      case 'poster': {
        // a printed poster: inset keyline, registration marks, a warm leak in one corner
        ctx.save();
        pool(W * 0.96, H * 0.06, Math.max(W, H) * 0.42, pal[1] ?? frame.accent, 0.16 + lift * 0.08);
        ctx.strokeStyle = frame.tone.support;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.34;
        const i = Math.min(W, H) * 0.035;
        ctx.strokeRect(i, i, W - i * 2, H - i * 2);
        ctx.globalAlpha = 0.4;
        ctx.beginPath();
        for (const [x, y] of [[W / 2, i], [W / 2, H - i], [i, H / 2], [W - i, H / 2]] as const) {
          ctx.moveTo(x - 7, y);
          ctx.lineTo(x + 7, y);
          ctx.moveTo(x, y - 7);
          ctx.lineTo(x, y + 7);
        }
        ctx.stroke();
        ctx.restore();
        return true;
      }
      case 'halo': {
        // a single soft light, breathing very slowly: the only thing on stage besides the words
        ctx.save();
        pool(W * 0.5, H * 0.44, Math.min(W, H) * 0.7, mix(frame.tone.active, '#ffffff', 0.35), 0.13 + Math.sin(t / 7) * 0.025 + lift * 0.08);
        ctx.restore();
        return true;
      }
      case 'graphic': {
        // flat fields from the cover, kept close to the ground so they frame the words instead of competing with them
        ctx.save();
        // shapes sit AWAY from the ink's side: darker under light type, lighter under dark type
        const away = contrastRatio(frame.tone.ink, '#000000') > contrastRatio(frame.tone.ink, '#ffffff') ? '#000000' : '#ffffff';
        const f = (c: string) => mix(mix(frame.bg.c0, away, 0.2), c, 0.16 + lift * 0.06);
        const dx = Math.sin(t / 8) * W * 0.008;
        ctx.globalAlpha = 1;
        ctx.fillStyle = f(pal[0] ?? frame.accent);
        ctx.beginPath();
        ctx.arc(W * 0.84 + dx, H * 0.2, S * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = f(pal[1] ?? frame.accent);
        ctx.fillRect(0, H * 0.74, W * 0.5 + dx, H * 0.26);
        ctx.fillStyle = f(pal[2] ?? frame.accent);
        ctx.beginPath();
        ctx.arc(W * 0.12 - dx, H * 0.24, S * 0.13, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return true;
      }
      default:
        return false;
    }
  }

  /** Halftone dots are baked into a bitmap WITH their color; drawing it is a plain source-over blit (no blend mode). */
  private drawHalftone(frame: Frame, tl: VisualTimeline, W: number, H: number) {
    const dots = frame.bg.invert ? 'rgba(0,0,0,0.5)' : tl.style === 'popart' ? mix(frame.bg.c1, '#8a0f33', 0.55) : (frame.palette[0] ?? tl.palette[0] ?? '#fff');
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

  private drawCaption(frame: Frame, style: (typeof STYLES)[keyof typeof STYLES], W: number, H: number) {
    const ctx = this.ctx;
    const cap = frame.caption!;
    const S = Math.min(H, W * 0.9);
    let size = Math.max(13, S * 0.04);
    const def = { ...style.fonts.body, weight: 600, uppercase: false };
    this.setFont(fontCss(def, size), 0);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const limit = cap.maxW ?? W * 0.86;
    const wide = ctx.measureText(cap.text).width;
    if (wide > limit) {
      size *= limit / wide;
      this.setFont(fontCss(def, size), 0);
    }
    ctx.globalAlpha = Math.min(1, cap.alpha) * 0.8;
    ctx.fillStyle = frame.tone.inkDim;
    ctx.fillText(cap.text, cap.cx ?? W / 2, H - Math.max(26, S * 0.075));
    ctx.restore();
  }

  /** Backdrop scenery for themes that have a place, not just a colour. All plain gradients/strokes, cached where static. */
  private sceneCache = new Map<string, HTMLCanvasElement>();
  private drawScenery(kind: SceneKind, frame: Frame, W: number, H: number) {
    if (this.drawDirectionScenery(kind, frame, W, H)) return;
    const ctx = this.ctx;
    const t = frame.tMs / 1000;
    if (kind === 'sunset') {
      const horizon = H * 0.56;
      const R = Math.min(W, H) * 0.3;
      const key = `sun|${Math.round(W)}x${Math.round(H)}`;
      let sun = this.sceneCache.get(key);
      if (!sun) {
        sun = document.createElement('canvas');
        sun.width = Math.ceil(R * 2);
        sun.height = Math.ceil(R * 2);
        const c = sun.getContext('2d')!;
        const g = c.createLinearGradient(0, 0, 0, R * 2);
        g.addColorStop(0, '#ffe66d');
        g.addColorStop(0.55, '#ff6b9d');
        g.addColorStop(1, '#c13cff');
        c.fillStyle = g;
        c.beginPath();
        c.arc(R, R, R, 0, Math.PI * 2);
        c.fill();
        c.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < 7; i++) c.fillRect(0, R * (1.05 + i * 0.13), R * 2, R * (0.015 + i * 0.022));
        this.sceneCache.set(key, sun);
        if (this.sceneCache.size > 8) this.sceneCache.delete(this.sceneCache.keys().next().value as string);
      }
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.drawImage(sun, W / 2 - R, horizon - R * 1.15 + Math.sin(t / 3) * R * 0.02);
      const ground = ctx.createLinearGradient(0, horizon, 0, H);
      ground.addColorStop(0, 'rgba(255,94,168,0.35)');
      ground.addColorStop(0.08, 'rgba(14,4,36,0.92)');
      ground.addColorStop(1, 'rgba(8,2,22,0.98)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = ground;
      ctx.fillRect(0, horizon, W, H - horizon);
      ctx.restore();
      this.drawGrid(frame, W, H);
    } else if (kind === 'notebook') {
      const S = Math.min(H, W * 0.9);
      const step = Math.max(24, S * 0.075);
      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(70,110,200,0.26)';
      ctx.beginPath();
      for (let y = step * 1.5; y < H; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(220,70,70,0.4)';
      ctx.beginPath();
      ctx.moveTo(W * 0.1, 0);
      ctx.lineTo(W * 0.1, H);
      ctx.stroke();
      ctx.restore();
    } else {
      const R = Math.max(W, H) * 0.55;
      ctx.save();
      for (let k = 0; k < 3; k++) {
        const color = frame.palette[k] ?? frame.accent;
        const x = W * (0.2 + k * 0.3 + Math.sin(t / (5 + k * 1.7) + k * 2) * 0.12);
        const y = H * (0.4 + Math.sin(t / (6 + k) + k * 1.3) * 0.22);
        const g = ctx.createRadialGradient(x, y, 0, x, y, R * (0.8 + k * 0.1));
        g.addColorStop(0, color);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 0.34 + frame.beat.pulse * 0.08;
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
    }
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
