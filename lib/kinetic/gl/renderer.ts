// Turbo: a WebGL2 renderer for `Frame`s. Every layer is drawn by the GPU:
//   backdrop (liquid light / god rays / bokeh / grid, a fragment shader) -> cover artwork -> slices -> marquee ->
//   interlude -> doodles -> words -> icons -> a finishing pass (bloom, lens fringing, scrim, vignette,
//   halftone, scanlines, grain, flash).
// The CPU only decides WHAT to draw (computeFrame, pure) and rasterises text/sprites ONCE into textures. Drawing a frame is a
// few hundred textured quads. Like the Canvas renderer it contains no timing logic: the same time always gives the same picture.

import { computeFrame } from '../frame';
import { REQUIRED_FONT_LOADS, STYLES, fontCss, fontCssFor, fontLoadsFor, loadScriptFonts, spacingFor } from '../styles';
import type { FontDef, StyleDef } from '../styleBase';
import type { Look } from '../look';
import { drawDoodle } from '../doodles';
import { PIXEL_BUDGET, QUALITY_PROFILE, type QualityLevel } from '../governor';
import type { DrawWord, FontKey, Frame, VisualTimeline } from '../types';
import { contrastRatio, mix, rgbToHex } from '../util';
import { drawIcon, iconColors, type IconId } from '../icons';
import { EMOTION_DEFS } from '../emotion';
import type { RendererOptions } from '../render';
import { planStage, turboLook } from '../turbo';
import { IDENTITY, Program, cameraMatrix, createTarget, freeTarget, mul, parseColor, rotate, scale, skewX, textureFrom, toClip, translate, type Affine, type Target, type Tex } from './gpu';
import { BLIT_FS, BLUR_FS, BRIGHT_FS, FULL_VS, POINT_FS, POINT_VS, POST_FS, QUAD_VS, SHAPE_FS, SPRITE_FS, STAGE_FS, STRIP_FS, STRIP_VS } from './shaders';

type Ls = CanvasRenderingContext2D & { letterSpacing?: string };
type Glyph = { tex: Tex; /** quad size in css px at the bucketed font size */ w: number; h: number; textW: number; pad: number; sizeB: number };
type Sprite = { tex: Tex; w: number; h: number };

type SpriteOpts = {
    tex: Tex;
    m: Affine; // local -> stage (before the camera)
    w: number;
    h: number;
    alpha?: number;
    mode?: 0 | 1 | 2 | 3;
    color?: string | [number, number, number, number];
    lod?: number;
    camera?: boolean;
    fade?: [number, number, number, number];
    round?: number;
    uvRect?: [number, number, number, number];
    vclip?: [number, number];
    progress?: { v: number; lit: string; span: [number, number] };
    grad?: { kind: 1 | 2; colors: string[]; pos: [number, number, number, number]; vspan: [number, number] };
    glowR?: number;
    grey?: number;
    tone?: { color: string; amt: number };
    maskScale?: number;
  };

/** glyph textures may use about this much GPU memory in total; the least recently used are dropped first */
const GLYPH_BUDGET_BYTES = 192 * 1024 * 1024;
const ICON_PX = 192;
const DOODLE_PX = 192;
const DOODLE_R = 80;

export class TurboRenderer {
  readonly kind = 'webgl2' as const;
  width = 0;
  height = 0;
  /** export mode: exact pixel size, no DPR cap or pixel budget */
  exact = false;
  /** the GPU context is gone (driver reset, GPU switch, too many contexts). The stage falls back to Clean if it does not come back. */
  lost = false;
  /** told when the context is lost / comes back (the stage uses it to fall back to Clean) */
  onContextChange?: (lost: boolean) => void;
  private disposed = false;
  options: RendererOptions = { reducedMotion: false, motionScale: 1, quality: 'high', artworkPolicy: 'full', colorMode: 'blend', emojis: true, doodles: true, artwork: 'background', interlude: true, texture: true };

  private gl!: WebGL2RenderingContext;
  private programs!: { sprite: Program; shape: Program; point: Program; strip: Program; stage: Program; blit: Program; bright: Program; blur: Program; post: Program };
  private quadVao!: WebGLVertexArrayObject;
  private pointVao!: WebGLVertexArrayObject;
  private pointBuf!: WebGLBuffer;
  private stripVao!: WebGLVertexArrayObject;
  private stripBuf!: WebGLBuffer;
  private pointData = new Float32Array(7 * 700);
  private stripData = new Float32Array(2 * 200);

  private sceneRT: Target | null = null;
  private stageRT: Target | null = null;
  private bloomA: Target | null = null;
  private bloomB: Target | null = null;

  private dpr = 1;
  private rawDpr = 1;
  private timeline: VisualTimeline | null = null;
  private look: Look | null = null;
  private baseLook: Look | null = null;
  private lastFrame: Frame | null = null;

  // text
  private measureCtx: Ls;
  private widthCache = new Map<string, number>();
  private glyphs = new Map<string, Glyph>();
  private glyphSize = new Map<string, number>();
  private glyphBytes = 0;
  private marquees = new Map<string, { tex: Tex; w: number; h: number; unitW: number }>();
  private sprites = new Map<string, Sprite>();
  private layoutEpoch = 0;

  // artwork
  private artCanvas: HTMLCanvasElement | null = null;
  private artTex: Tex | null = null;
  private artLevels: { l160: Target; l56: Target; l14: Target } | null = null;
  private artGrid: Uint8ClampedArray | null = null;
  private bleedSide = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    private opts: { preserveDrawingBuffer?: boolean } = {},
  ) {
    const probe = document.createElement('canvas').getContext('2d') as Ls | null;
    if (!probe) throw new Error('Canvas 2D is not available in this browser');
    this.measureCtx = probe;
    this.initGl();
    canvas.addEventListener('webglcontextlost', this.onLost, false);
    canvas.addEventListener('webglcontextrestored', this.onRestored, false);
  }

  /** true when a WebGL2 context can be created at all */
  static supported(): boolean {
    // Cached, and the probe context is released at once: browsers keep only ~16 live WebGL contexts and silently kill the OLDEST
    // when the limit is hit (which would be the stage's own). This used to run on every render of the export dialog.
    if (supportedCache !== null) return supportedCache;
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2');
      supportedCache = !!gl;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      supportedCache = false;
    }
    return supportedCache;
  }

  // ---- setup ---------------------------------------------------------------------------------------------------------------
  private initGl() {
    const gl = this.canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!this.opts.preserveDrawingBuffer }) as WebGL2RenderingContext | null;
    if (!gl) throw new Error('WebGL2 is not available in this browser');
    if (gl.isContextLost()) throw new Error('the GPU context was lost; reload the page');
    this.gl = gl;
    this.programs = {
      sprite: new Program(gl, QUAD_VS, SPRITE_FS, 'sprite'),
      shape: new Program(gl, QUAD_VS, SHAPE_FS, 'shape'),
      point: new Program(gl, POINT_VS, POINT_FS, 'point'),
      strip: new Program(gl, STRIP_VS, STRIP_FS, 'strip'),
      stage: new Program(gl, FULL_VS, STAGE_FS, 'stage'),
      blit: new Program(gl, FULL_VS, BLIT_FS.replace('uniform float u_alpha;', 'uniform float u_alpha;\nuniform float u_lod;').replace('texture(u_tex, v_tc)', 'textureLod(u_tex, v_tc, u_lod)'), 'blit'),
      bright: new Program(gl, FULL_VS, BRIGHT_FS, 'bright'),
      blur: new Program(gl, FULL_VS, BLUR_FS, 'blur'),
      post: new Program(gl, FULL_VS, POST_FS, 'post'),
    };
    const quad = gl.createVertexArray()!;
    gl.bindVertexArray(quad);
    const qb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.quadVao = quad;

    this.pointVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.pointVao);
    this.pointBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.pointData.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 28, 8);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 28, 16);

    this.stripVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.stripVao);
    this.stripBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.stripBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.stripData.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.lost = false;
  }

  private onLost = (e: Event) => {
    e.preventDefault(); // lets the browser give the context back
    this.lost = true;
    this.onContextChange?.(true);
  };
  private onRestored = () => {
    // every GPU object died with the context: rebuild and re-upload what the picture needs
    this.glyphs.clear();
    this.marquees.clear();
    this.sprites.clear();
    this.sceneRT = this.stageRT = this.bloomA = this.bloomB = null;
    this.artTex = null;
    this.artLevels = null;
    this.initGl();
    if (this.artCanvas) this.uploadArtwork(this.artCanvas);
    this.allocTargets();
    this.onContextChange?.(false);
  };

  /**
   * Free every GPU object this renderer made, but do NOT destroy the context: React (strict mode, fast refresh, a remount) will build a
   * new renderer on the SAME canvas, and a context that was deliberately lost can never be used again (its shaders fail to compile).
   */
  dispose() {
    const gl = this.gl;
    this.disposed = true;
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    if (gl.isContextLost()) return;
    this.clearGlyphs();
    for (const m of this.marquees.values()) gl.deleteTexture(m.tex.tex);
    for (const s of this.sprites.values()) gl.deleteTexture(s.tex.tex);
    this.marquees.clear();
    this.sprites.clear();
    if (this.artTex) gl.deleteTexture(this.artTex.tex);
    if (this.artLevels) {
      freeTarget(gl, this.artLevels.l160);
      freeTarget(gl, this.artLevels.l56);
      freeTarget(gl, this.artLevels.l14);
    }
    this.artTex = null;
    this.artLevels = null;
    freeTarget(gl, this.sceneRT);
    freeTarget(gl, this.stageRT);
    freeTarget(gl, this.bloomA);
    freeTarget(gl, this.bloomB);
    this.sceneRT = this.stageRT = this.bloomA = this.bloomB = null;
    for (const p of Object.values(this.programs)) gl.deleteProgram(p.prog);
    gl.deleteVertexArray(this.quadVao);
    gl.deleteVertexArray(this.pointVao);
    gl.deleteVertexArray(this.stripVao);
    gl.deleteBuffer(this.pointBuf);
    gl.deleteBuffer(this.stripBuf);
  }

  async loadFonts(): Promise<void> {
    if (typeof document === 'undefined' || !document.fonts) return;
    try {
      await Promise.all(REQUIRED_FONT_LOADS.map((f) => document.fonts.load(f, 'Aa lyrics')));
    } catch {
      /* system fonts; layout is re-measured anyway */
    }
    this.invalidateText();
  }

  private invalidateText() {
    this.layoutEpoch++;
    this.widthCache.clear();
    // glyph textures made with a fallback face must not outlive the real face
    this.clearGlyphs();
    for (const m of this.marquees.values()) this.gl.deleteTexture(m.tex.tex);
    this.marquees.clear();
  }
  private clearGlyphs() {
    for (const g of this.glyphs.values()) this.gl.deleteTexture(g.tex.tex);
    this.glyphs.clear();
    this.glyphSize.clear();
    this.glyphBytes = 0;
  }

  setLook(look: Look | null) {
    if (look?.key === this.baseLook?.key) return;
    this.baseLook = look;
    this.look = look ? turboLook(look) : null;
    this.invalidateText();
    void this.loadLookFonts();
  }
  async loadLookFonts(): Promise<void> {
    const look = this.look;
    if (!look || typeof document === 'undefined' || !document.fonts) return;
    try {
      await Promise.all(fontLoadsFor(look.style).map((f) => document.fonts.load(f, 'Aa lyrics')));
    } catch {
      /* fall back to system faces */
    }
    this.invalidateText();
  }
  private currentStyle(): StyleDef {
    return this.look?.style ?? (this.timeline ? STYLES[this.timeline.style] : STYLES.maximalist);
  }

  setTimeline(tl: VisualTimeline | null) {
    this.timeline = tl;
    this.invalidateText();
    if (tl) {
      void loadScriptFonts(tl.cues.map((c) => c.text).join(' ')).then((used) => {
        if (used && this.timeline === tl) this.invalidateText();
      });
    }
  }

  // ---- size ----------------------------------------------------------------------------------------------------------------------
  private effectiveDpr(): number {
    if (this.exact) return this.rawDpr;
    const cap = QUALITY_PROFILE[this.options.quality].dprCap + 0.5; // the GPU takes a little more than the canvas path
    const budget = Math.sqrt((PIXEL_BUDGET * 1.4) / Math.max(1, this.width * this.height));
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
    const w = Math.max(2, Math.floor(this.width * dpr));
    const h = Math.max(2, Math.floor(this.height * dpr));
    if (this.canvas.width === w && this.canvas.height === h && this.sceneRT) {
      this.dpr = dpr;
      return;
    }
    this.dpr = dpr;
    this.canvas.width = w;
    this.canvas.height = h;
    this.allocTargets();
    this.layoutEpoch++;
  }
  private allocTargets() {
    const gl = this.gl;
    if (this.lost) return;
    freeTarget(gl, this.sceneRT);
    freeTarget(gl, this.stageRT);
    freeTarget(gl, this.bloomA);
    freeTarget(gl, this.bloomB);
    const w = this.canvas.width;
    const h = this.canvas.height;
    const s = this.options.quality === 'high' ? 0.5 : this.options.quality === 'medium' ? 0.38 : 0.28;
    this.sceneRT = createTarget(gl, w, h);
    this.stageRT = createTarget(gl, Math.max(8, Math.floor(w * s)), Math.max(8, Math.floor(h * s)));
    this.bloomA = createTarget(gl, Math.max(8, w >> 2), Math.max(8, h >> 2));
    this.bloomB = createTarget(gl, Math.max(8, w >> 2), Math.max(8, h >> 2));
  }
  setQuality(q: QualityLevel) {
    if (this.options.quality === q) return;
    this.options = { ...this.options, quality: q };
    this.applyDpr();
    this.allocTargets();
  }
  get density(): number {
    return QUALITY_PROFILE[this.options.quality].density;
  }

  // ---- text ----------------------------------------------------------------------------------------------------------------------
  private setMeasureFont(css: string, spacingPx: number) {
    this.measureCtx.font = css;
    this.measureCtx.letterSpacing = `${Math.round(spacingPx * 100) / 100}px`;
  }
  private measure = (text: string, font: FontKey, sizePx: number): number => {
    const def = this.currentStyle().fonts[font];
    const key = `${font}|${Math.round(sizePx * 4)}|${text}`;
    const hit = this.widthCache.get(key);
    if (hit !== undefined) return hit;
    this.setMeasureFont(fontCssFor(def, sizePx, text), spacingFor(def, sizePx, text));
    const w = this.measureCtx.measureText(text).width;
    if (this.widthCache.size > 4000) this.widthCache.clear();
    this.widthCache.set(key, w);
    return w;
  };

  /** A white-on-clear texture of one piece of text (fill, or stroke of a given width). Rasterised once, then it is just a quad. */
  private glyph(text: string, def: FontDef, size: number, stroke = 0): Glyph {
    const sizeB = Math.max(8, Math.round(size / 4) * 4);
    const key = `${def.family}|${def.weight}|${def.italic ? 1 : 0}|${def.letterSpacingEm.toFixed(3)}|${sizeB}|${stroke}|${text}`;
    const hit = this.glyphs.get(key);
    if (hit) {
      this.glyphs.delete(key);
      this.glyphs.set(key, hit); // LRU
      return hit;
    }
    const gl = this.gl;
    this.setMeasureFont(fontCssFor(def, sizeB, text), spacingFor(def, sizeB, text));
    const textW = this.measureCtx.measureText(text).width;
    const pad = Math.ceil(sizeB * 0.32 + stroke) + 6;
    const w = textW + pad * 2;
    const h = sizeB * 1.7 + pad * 2;
    const maxTex = Math.min(4096, gl.getParameter(gl.MAX_TEXTURE_SIZE) as number);
    // 1.5-2x supersampled, so a word that is drawn a little larger than its bucket (a punch, a zoom) still has pixels to spare
    const rs = Math.max(0.5, Math.min(Math.max(1.5, Math.min(2, this.dpr * 1.5)), (maxTex - 2) / w, (maxTex - 2) / h));
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.ceil(w * rs));
    c.height = Math.max(2, Math.ceil(h * rs));
    const cx = c.getContext('2d') as Ls;
    cx.setTransform(rs, 0, 0, rs, 0, 0);
    cx.font = fontCssFor(def, sizeB, text);
    cx.letterSpacing = `${spacingFor(def, sizeB, text)}px`;
    cx.textAlign = 'center';
    cx.textBaseline = 'middle';
    cx.fillStyle = '#fff';
    cx.strokeStyle = '#fff';
    cx.lineJoin = 'round';
    if (stroke > 0) {
      cx.lineWidth = stroke;
      cx.strokeText(text, w / 2, h / 2);
    } else cx.fillText(text, w / 2, h / 2);
    const g: Glyph = { tex: textureFrom(gl, c, c.width, c.height), w: c.width / rs, h: c.height / rs, textW, pad, sizeB };
    this.glyphs.set(key, g);
    this.glyphBytes += c.width * c.height * 4 * 1.34; // + mip chain
    this.glyphSize.set(key, c.width * c.height * 4 * 1.34);
    while (this.glyphBytes > GLYPH_BUDGET_BYTES && this.glyphs.size > 8) {
      const oldest = this.glyphs.keys().next().value as string;
      const og = this.glyphs.get(oldest);
      if (og) gl.deleteTexture(og.tex.tex);
      this.glyphs.delete(oldest);
      this.glyphBytes -= this.glyphSize.get(oldest) ?? 0;
      this.glyphSize.delete(oldest);
    }
    return g;
  }

  // ---- sprites (icons, doodles, marquee) ------------------------------------------------------------------------------
  private sprite(key: string, w: number, h: number, paint: (cx: Ls) => void): Sprite {
    const hit = this.sprites.get(key);
    if (hit) return hit;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    paint(c.getContext('2d') as Ls);
    const spr = { tex: textureFrom(this.gl, c, w, h), w, h };
    this.sprites.set(key, spr);
    if (this.sprites.size > 220) {
      const oldest = this.sprites.keys().next().value as string;
      this.gl.deleteTexture(this.sprites.get(oldest)!.tex.tex);
      this.sprites.delete(oldest);
    }
    return spr;
  }
  private iconSprite(id: IconId, accent: string, ink: string): Sprite {
    const darkStage = contrastRatio(ink, '#000000') > contrastRatio(ink, '#ffffff');
    const edge = darkStage ? '#ffffff' : '#2a2433';
    return this.sprite(`i|${id}|${accent}|${edge}`, ICON_PX, ICON_PX, (c) => {
      c.translate(ICON_PX / 2, ICON_PX / 2);
      drawIcon(c, id, ICON_PX - 8, iconColors(id, accent), edge);
    });
  }
  private doodleSprite(d: Frame['doodles'][number]): Sprite {
    const k = DOODLE_R / Math.max(1, d.size);
    const key = `d|${d.kind}|${d.fill}|${d.stroke}|${Math.round(d.lineWidth * k)}|${d.accent}|${d.seed}`;
    return this.sprite(key, DOODLE_PX, DOODLE_PX, (c) => {
      c.translate(DOODLE_PX / 2, DOODLE_PX / 2);
      drawDoodle(c, d.kind, DOODLE_R, { fill: d.fill, stroke: d.stroke, lineWidth: Math.max(1.5, d.lineWidth * k), accent: d.accent }, d.seed);
    });
  }

  // ---- artwork -------------------------------------------------------------------------------------------------------------
  setArtwork(source: CanvasImageSource | null) {
    const gl = this.gl;
    if (this.artTex) gl.deleteTexture(this.artTex.tex);
    this.artTex = null;
    this.artGrid = null;
    this.artCanvas = null;
    if (this.artLevels) {
      freeTarget(gl, this.artLevels.l160);
      freeTarget(gl, this.artLevels.l56);
      freeTarget(gl, this.artLevels.l14);
    }
    this.artLevels = null;
    if (!source) return;
    const el = source as HTMLImageElement;
    const nw = el.naturalWidth || el.width || 0;
    const nh = el.naturalHeight || el.height || 0;
    if (nw <= 0 || nh <= 0) return;
    const side = Math.min(1024, Math.max(512, Math.min(Math.max(nw, nh), 1024)));
    const c = document.createElement('canvas');
    c.width = c.height = side;
    const cx = c.getContext('2d');
    if (!cx) return;
    cx.imageSmoothingQuality = 'high';
    const s = Math.min(nw, nh); // covers are square; anything else is centre-cropped
    cx.drawImage(source, (nw - s) / 2, (nh - s) / 2, s, s, 0, 0, side, side);
    this.artCanvas = c;
    try {
      const g = document.createElement('canvas');
      g.width = g.height = 48;
      const gx = g.getContext('2d', { willReadFrequently: true });
      if (gx) {
        gx.drawImage(c, 0, 0, 48, 48);
        this.artGrid = gx.getImageData(0, 0, 48, 48).data;
      }
    } catch {
      this.artGrid = null; // tainted cover: words fall back to white with an edge
    }
    this.uploadArtwork(c);
  }

  /** The cover goes up once; its soft versions are made on the GPU (box down-scale, then a few separable blurs). */
  private uploadArtwork(c: HTMLCanvasElement) {
    const gl = this.gl;
    this.artTex = textureFrom(gl, c, c.width, c.height);
    const level = (px: number, lod: number, passes: number): Target => {
      const a = createTarget(gl, px, px);
      const b = createTarget(gl, px, px);
      gl.viewport(0, 0, px, px);
      gl.disable(gl.BLEND);
      const blit = this.programs.blit;
      blit.use();
      gl.bindFramebuffer(gl.FRAMEBUFFER, a.fbo);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.artTex!.tex);
      blit.i('u_tex', 0);
      blit.f('u_alpha', 1);
      blit.f('u_lod', lod);
      gl.bindVertexArray(this.quadVao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      const blur = this.programs.blur;
      blur.use();
      blur.i('u_tex', 0);
      let src = a;
      let dst = b;
      for (let i = 0; i < passes * 2; i++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
        gl.bindTexture(gl.TEXTURE_2D, src.tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        blur.v2('u_dir', i % 2 === 0 ? 1.4 / px : 0, i % 2 === 0 ? 0 : 1.4 / px);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        [src, dst] = [dst, src];
      }
      freeTarget(gl, dst);
      gl.enable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return src;
    };
    this.artLevels = { l160: level(160, 2, 1), l56: level(56, 4, 2), l14: level(14, 6, 2) };
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  /** The cover at a softness level: 0 as loaded, 1 gently soft, 2 a wash, 3 a mist of colour fields. */
  private artAt(level: 0 | 1 | 2 | 3): Tex | null {
    if (!this.artTex) return null;
    if (level === 0 || !this.artLevels) return this.artTex;
    const t = level === 1 ? this.artLevels.l160 : level === 2 ? this.artLevels.l56 : this.artLevels.l14;
    return { tex: t.tex, w: t.w, h: t.h };
  }
  private blurLevel(blur: number): 0 | 1 | 2 {
    return blur <= 0.15 ? 0 : blur >= 0.85 ? 2 : 1;
  }

  // ---- the frame ------------------------------------------------------------------------------------------------------------------
  render(tMs: number): Frame | null {
    const tl = this.timeline;
    if (!tl || !this.width || this.lost || this.disposed || !this.sceneRT) return null;
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
      look: this.look ?? undefined,
    });
    this.lastFrame = frame;
    this.draw(frame);
    return frame;
  }

  /** Dev tool: average cost of one frame in ms including the GPU flush (a 1 px readback waits for the queue). */
  bench(tMs: number, n = 30): number {
    const px = new Uint8Array(4);
    const flush = () => this.gl.readPixels(0, 0, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, px);
    this.render(tMs);
    flush();
    const t0 = performance.now();
    for (let i = 0; i < n; i++) this.render(tMs + i * 16.7);
    flush();
    return (performance.now() - t0) / n;
  }

  // ---- drawing primitives ---------------------------------------------------------------------------------------------------------
  private clip!: Affine;
  private cam: Affine = IDENTITY;

  private bindTex(unit: number, t: WebGLTexture | null) {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, t);
  }

  private drawSprite(o: SpriteOpts) {
    const gl = this.gl;
    const p = this.programs.sprite;
    p.use();
    const m = mul(this.clip, o.camera === false ? o.m : mul(this.cam, o.m));
    p.m('u_m', m);
    p.v2('u_size', o.w, o.h);
    this.bindTex(0, o.tex.tex);
    p.i('u_tex', 0);
    p.i('u_mode', o.mode ?? 0);
    const col = typeof o.color === 'string' ? parseColor(o.color) : (o.color ?? [1, 1, 1, 1]);
    p.col('u_color', col);
    p.f('u_alpha', o.alpha ?? 1);
    p.f('u_lod', o.lod ?? 0);
    p.v2('u_texel', 1 / o.tex.w, 1 / o.tex.h);
    p.f('u_glowR', o.glowR ?? 0);
    const prog = o.progress;
    p.f('u_progress', prog ? prog.v : -1);
    if (prog) {
      p.col3('u_lit', parseColor(prog.lit));
      p.v2('u_span', prog.span[0], prog.span[1]);
    }
    const gr = o.grad;
    p.i('u_grad', gr ? gr.kind : 0);
    if (gr) {
      const cs = gr.colors.map(parseColor);
      p.col3('u_g0', cs[0]!);
      p.col3('u_g1', cs[1] ?? cs[0]!);
      p.col3('u_g2', cs[2] ?? cs[1] ?? cs[0]!);
      p.col3('u_g3', cs[3] ?? cs[2] ?? cs[0]!);
      p.v4('u_gpos', gr.pos[0], gr.pos[1], gr.pos[2], gr.pos[3]);
      p.v2('u_vspan', gr.vspan[0], gr.vspan[1]);
    }
    const vc = o.vclip ?? [0, 1];
    p.v2('u_vclip', vc[0], vc[1]);
    const f = o.fade ?? [0, 0, 0, 0];
    p.v4('u_fade', f[0], f[1], f[2], f[3]);
    p.f('u_round', o.round ?? 0);
    const ur = o.uvRect ?? [0, 0, 1, 1];
    p.v4('u_uvRect', ur[0], ur[1], ur[2], ur[3]);
    p.f('u_grey', o.grey ?? 0);
    p.f('u_toneAmt', o.tone?.amt ?? 0);
    if (o.tone) p.col3('u_tone', parseColor(o.tone.color));
    if (o.mode === 3 && this.artTex) {
      this.bindTex(1, this.artTex.tex);
      p.i('u_art', 1);
      p.f('u_maskScale', o.maskScale ?? 200);
    }
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private drawShape(o: { kind: 0 | 1 | 2 | 3; m: Affine; w: number; h: number; color: string | [number, number, number, number]; color2?: string; alpha?: number; radius?: number; width?: number; soft?: number; camera?: boolean }) {
    const gl = this.gl;
    const p = this.programs.shape;
    p.use();
    p.m('u_m', mul(this.clip, o.camera === false ? o.m : mul(this.cam, o.m)));
    p.v2('u_size', o.w, o.h);
    p.i('u_kind', o.kind);
    p.col('u_color', typeof o.color === 'string' ? parseColor(o.color) : o.color);
    if (o.color2) p.col('u_color2', parseColor(o.color2));
    p.f('u_alpha', o.alpha ?? 1);
    p.f('u_radius', o.radius ?? 0);
    p.f('u_width', o.width ?? 0);
    p.f('u_soft', o.soft ?? 0);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private pool(x: number, y: number, r: number, color: string, alpha: number, camera = true) {
    if (alpha <= 0.005 || r < 1) return;
    this.drawShape({ kind: 2, m: translate(x, y), w: r * 2, h: r * 2, color, alpha, radius: r, camera });
  }

  /** ctx.fillRect-like: a flat rectangle (stage px, top-left origin) */
  private rect(x: number, y: number, w: number, h: number, color: string | [number, number, number, number], alpha: number, camera = true) {
    this.drawShape({ kind: 0, m: translate(x + w / 2, y + h / 2), w, h, color, alpha, radius: 0, soft: 0.5, camera });
  }

  // ---- the frame, layer by layer -----------------------------------------------------------------------------------------------------
  private draw(frame: Frame) {
    const gl = this.gl;
    const W = this.width;
    const H = this.height;
    const scene = this.sceneRT!;
    const style = this.currentStyle();
    const prof = QUALITY_PROFILE[this.options.quality];
    this.clip = toClip(W, H);
    this.cam = cameraMatrix(W, H, frame.camera);
    this.bleedSide = 0;

    const moodDef = frame.mood ? EMOTION_DEFS[frame.mood] : null;
    const arousal = moodDef?.arousal ?? 0.5;
    const lightGround = contrastRatio(frame.bg.c0, '#000000') < contrastRatio(frame.bg.c0, '#ffffff') * 0.55 && contrastRatio(frame.bg.c1, '#000000') < contrastRatio(frame.bg.c1, '#ffffff') * 0.55;
    const plan = planStage({ arousal, scene: style.scene ?? null, hasCover: !!this.artLevels && this.options.artwork !== 'off', artAmount: this.look?.artwork.amount ?? 0.4, hook: frame.hook });
    const since = frame.beat.index >= 0 && frame.beat.pulse > 0.001 ? -0.15 * Math.log(Math.min(1, frame.beat.pulse / Math.max(0.01, frame.beat.strength))) : 9;

    // 1) the stage: a fragment shader at reduced resolution, stretched under everything
    this.drawStage(frame, plan, arousal, Math.min(9, since), lightGround);

    // 2) the scene target
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fbo);
    gl.viewport(0, 0, scene.w, scene.h);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.BLEND);
    const blit = this.programs.blit;
    blit.use();
    this.bindTex(0, this.stageRT!.tex);
    blit.i('u_tex', 0);
    blit.f('u_alpha', 1);
    blit.f('u_lod', 0);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.enable(gl.BLEND);

    // 3) cover artwork, per treatment
    this.drawArtwork(frame, W, H);

    // 4) coloured slices (controlled disorder)
    for (const d of frame.disrupt) this.rect(d.x, d.y, d.w, d.h, d.color, d.alpha);

    // 5) marquee, the interlude show, always-on particles
    this.drawMarquee(frame, style, prof.marqueeRows, W, H);
    if (frame.interlude.amount > 0.01) this.drawInterlude(frame, W, H);
    if (frame.transition) this.drawLineTransition(frame.transition, W, H);
    this.drawSparks(frame, W, H, arousal, lightGround);

    // 6) doodles, words, icons (words are centred on the stage: stage coords = centre + offset)
    for (const d of frame.doodles) {
      if (d.alpha <= 0.01 || d.size <= 1) continue;
      const spr = this.doodleSprite(d);
      const k = d.size / DOODLE_R;
      this.drawSprite({ tex: spr.tex, m: mul(translate(W / 2 + d.x, H / 2 + d.y), rotate((d.rotationDeg * Math.PI) / 180)), w: spr.w * k, h: spr.h * k, alpha: d.alpha });
    }
    this.bloomPass(plan, lightGround); // the glow of everything behind the type, before the type
    for (const w of frame.words) this.drawWord(w, frame, style, prof.echo);
    for (const e of frame.icons) {
      if (e.alpha <= 0.01 || e.sizePx < 3) continue;
      const spr = this.iconSprite(e.icon, frame.tone.accent, frame.tone.ink);
      this.drawSprite({ tex: spr.tex, m: mul(translate(W / 2 + e.x, H / 2 + e.y), rotate((e.rotationDeg * Math.PI) / 180)), w: e.sizePx, h: e.sizePx, alpha: e.alpha });
    }

    // 8) bloom, then the finishing pass to the canvas
    this.finish(frame, plan, lightGround);
  }

  private drawStage(frame: Frame, plan: ReturnType<typeof planStage>, arousal: number, since: number, lightGround: boolean) {
    const gl = this.gl;
    const rt = this.stageRT!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fbo);
    gl.viewport(0, 0, rt.w, rt.h);
    gl.disable(gl.BLEND);
    const p = this.programs.stage;
    p.use();
    p.v2('u_res', rt.w, rt.h);
    p.f('u_time', frame.tMs / 1000);
    p.f('u_beat', this.options.reducedMotion ? 0 : frame.beat.pulse);
    p.f('u_age', since);
    p.f('u_lift', frame.lift);
    p.f('u_amount', this.options.reducedMotion ? 0.25 : plan.amount * (lightGround ? 0.55 : 1) * (this.options.quality === 'low' ? 0.7 : 1));
    p.f('u_arousal', arousal);
    p.f('u_angle', (frame.bg.angleDeg * Math.PI) / 180);
    p.f('u_guard', 0.5);
    p.i('u_variant', plan.variant);
    const pal = new Float32Array(12);
    for (let i = 0; i < 4; i++) {
      const c = parseColor(frame.palette[i] ?? frame.palette[0] ?? frame.accent);
      pal[i * 3] = c[0];
      pal[i * 3 + 1] = c[1];
      pal[i * 3 + 2] = c[2];
    }
    p.v3arr('u_pal', pal);
    p.col3('u_c0', parseColor(frame.bg.c0));
    p.col3('u_c1', parseColor(frame.bg.c1));
    const cover = this.artLevels && this.options.artwork !== 'off' && frame.artwork.treatment !== 'off' ? this.artLevels.l56 : null;
    p.f('u_hasCover', cover ? 1 : 0);
    p.f('u_coverMix', plan.coverMix * (lightGround ? 0.6 : 1));
    if (cover) {
      this.bindTex(0, cover.tex);
      p.i('u_cover', 0);
    }
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.enable(gl.BLEND);
  }

  private drawArtwork(frame: Frame, W: number, H: number) {
    const a = frame.artwork;
    const t = a.treatment;
    if (this.options.artwork === 'off' || t === 'off' || !this.artTex) return;
    const tt = frame.tMs / 1000;
    const asCard = t === 'card' || t === 'collage' || t === 'split';
    const alpha = Math.min(1, a.alpha);

    if (t === 'bleed') {
      const side = Math.max(W, H) * 1.1 * (1 + (frame.tMs > 0 ? Math.sin(tt / 23) * 0.012 : 0));
      this.bleedSide = side;
      this.drawSprite({ tex: this.artTex, m: translate(W / 2, H / 2), w: side, h: side, lod: 0 });
      return;
    }
    if (a.mode === 'hero' && !asCard) {
      const side = Math.min(W, H) * 0.74 * a.scale * 1.35;
      const m = mul(translate(W / 2 + a.x, H / 2 + a.y), rotate((a.rotationDeg * Math.PI) / 180));
      for (let i = 3; i >= 1; i--) this.drawShape({ kind: 0, m: mul(m, translate(0, 10 + i * 4)), w: side + i * 10, h: side + i * 4, color: '#000000', alpha: Math.min(1, a.hero * 1.15) * 0.12, soft: 6 });
      this.drawSprite({ tex: this.artTex, m, w: side, h: side, alpha: Math.min(1, a.hero * 1.15), round: side * 0.02 });
      return;
    }
    if (t === 'wash' || t === 'defocus' || t === 'tonal') {
      const lvl = t === 'wash' ? this.artAt(2) : this.artAt(3);
      if (!lvl) return;
      const side = Math.max(W, H) * (t === 'wash' ? 1.25 : t === 'defocus' ? 1.7 : 1.3) * a.scale;
      const drift = t === 'wash' ? translate(Math.sin(tt / 7) * W * 0.03, Math.cos(tt / 9) * H * 0.03) : translate(Math.sin(tt / 11) * W * 0.04, Math.cos(tt / 13) * H * 0.04);
      const m = mul(mul(translate(W / 2, H / 2), drift), t === 'wash' ? rotate(((Math.sin(tt / 13) * 2) * Math.PI) / 180) : IDENTITY);
      this.drawSprite({ tex: lvl, m, w: side, h: side, alpha, tone: t === 'tonal' ? { color: frame.bg.c1, amt: 0.5 } : undefined });
      return;
    }
    if (t === 'cinema') {
      const src = this.artAt(this.blurLevel(a.blur));
      if (!src) return;
      const side = Math.max(W, H) * 1.08 * (1 + Math.sin(tt / 23) * 0.015) * a.scale;
      this.drawSprite({ tex: src, m: translate(W / 2, H / 2), w: side, h: side, alpha: Math.min(1, a.alpha * 1.6) });
      // the ground closes in from the side the words are on
      this.drawShape({ kind: 3, m: translate(W / 2, H / 2), w: W, h: H, color: frame.bg.c0, color2: frame.bg.c1, alpha: 0.72 });
      return;
    }
    if (t === 'split' && a.split) {
      const src = this.artAt(this.blurLevel(a.blur));
      if (!src) return;
      const r = a.split;
      const side = Math.max(r.w, H) * 1.1 * (1 + Math.sin(tt / 19) * 0.01);
      this.drawSprite({
        tex: src,
        m: translate(r.x + r.w / 2, H / 2),
        w: r.w,
        h: H,
        uvRect: [0.5 - r.w / side / 2, 0.5 - H / side / 2, r.w / side, H / side],
        fade: a.side === 'left' ? [0, 0.45, 0, 0] : [0.45, 0, 0, 0],
      });
      return;
    }
    if ((t === 'card' || t === 'collage') && a.card) {
      const src = this.artAt(this.blurLevel(a.blur * 0.5));
      if (!src) return;
      const c0 = a.card;
      const hero = a.hero;
      const side = c0.w * (1 + hero * 0.55);
      const cx = c0.x + c0.w / 2 + (W / 2 - (c0.x + c0.w / 2)) * hero;
      const cy = c0.y + c0.h / 2 + (H / 2 - (c0.y + c0.h / 2)) * hero * 0.6;
      // a faint wash keeps the stage tied to the cover
      const mist = this.artAt(2);
      if (mist) this.drawSprite({ tex: mist, m: translate(W / 2, H / 2), w: Math.max(W, H) * 1.3, h: Math.max(W, H) * 1.3, alpha: Math.min(1, a.alpha * 0.8) });
      let m = translate(cx, cy);
      if (t === 'collage') {
        this.drawShape({ kind: 0, m: mul(m, rotate((3.2 * Math.PI) / 180)), w: side * 1.16, h: side * 1.1, color: frame.tone.support, alpha: 0.9, soft: 0.5 });
        m = mul(m, rotate((-2.4 * Math.PI) / 180));
      }
      for (let i = 3; i >= 1; i--) this.drawShape({ kind: 0, m: mul(m, translate(0, 8 + i * 2)), w: side + i * 8, h: side + i * 3, color: '#000000', alpha: 0.1, soft: 5 + i * 2 });
      this.drawSprite({ tex: src, m, w: side, h: side, round: side * 0.018 });
      if (t === 'collage') this.drawShape({ kind: 0, m: mul(mul(m, rotate((-5 * Math.PI) / 180)), translate(0, -side / 2)), w: side * 0.28, h: side * 0.1, color: frame.tone.ink, alpha: 0.55, soft: 0.5 });
      if (a.reflect && t === 'card') {
        const rh = side * 0.42;
        this.drawSprite({ tex: src, m: mul(m, mul(translate(0, side * 0.5 + side * 0.03 + rh / 2), scale(1, -1))), w: side, h: rh, uvRect: [0, 0.58, 1, 0.42], alpha: 0.3, fade: [0, 0, 0, 0.9] });
      }
    }
  }

  /** One-shot shapes when a line begins (wipe, iris, bars), behind the words. */
  private drawLineTransition(t: NonNullable<Frame['transition']>, W: number, H: number) {
    const { p, color, angle } = t;
    const eio = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
    const eo = (x: number) => 1 - Math.pow(1 - x, 3);
    if (t.kind === 'wipe') {
      const bw = W * 0.35;
      const e = eio(p);
      const x = angle > 0 ? -bw * 1.4 + (W + bw * 1.8) * e : W + bw * 0.4 - (W + bw * 1.8) * e;
      // a slanted band: a rotated rectangle covering the same area
      this.drawShape({ kind: 0, m: mul(translate(x + bw / 2, H / 2), rotate(Math.atan2(H * 0.44, H) * (angle > 0 ? -1 : 1))), w: bw, h: H * 1.4, color, alpha: 0.3 * (1 - p * 0.5), soft: 0.5 });
    } else if (t.kind === 'iris') {
      const r = eo(p) * Math.max(W, H) * 0.78;
      const width = Math.max(2, Math.min(W, H) * 0.03 * (1 - p));
      this.drawShape({ kind: 1, m: translate(W / 2, H / 2), w: (r + width) * 2 + 4, h: (r + width) * 2 + 4, color, alpha: (1 - p) * 0.55, radius: r, width, soft: 1 });
    } else {
      const n = 6;
      const bh = H / n;
      for (let i = 0; i < n; i++) {
        const w = W * (1 - eo(Math.min(1, Math.max(0, p * 1.5 - i * 0.1))));
        if (w < 1) continue;
        this.rect(angle > 0 ? 0 : W - w, i * bh, w, bh - 2, color, 0.28);
      }
    }
  }

  private drawMarquee(frame: Frame, style: StyleDef, maxRows: number, W: number, H: number) {
    if (!frame.marquee.length || maxRows <= 0) return;
    const every = Math.max(1, Math.ceil(frame.marquee.length / maxRows));
    const rows = frame.marquee.filter((_, i) => i % every === 0).slice(0, maxRows);
    for (const row of rows) {
      const def = style.fonts[row.font];
      const size = Math.round(row.sizePx / 4) * 4;
      const key = `${row.font}|${size}|${row.color}|${row.text.slice(0, 60)}`;
      let strip = this.marquees.get(key);
      if (!strip) {
        const unit = row.text.slice(0, Math.max(1, Math.floor(row.text.length / 4)));
        this.setMeasureFont(fontCssFor(def, size, unit), spacingFor(def, size, unit));
        const unitW = Math.max(40, this.measureCtx.measureText(unit).width);
        const repeats = Math.max(2, Math.ceil((W * 1.2) / unitW) + 1);
        const c = document.createElement('canvas');
        c.width = Math.min(8192, Math.ceil(unitW * repeats));
        c.height = Math.ceil(size * 1.4);
        const cx = c.getContext('2d') as Ls;
        cx.font = fontCssFor(def, size, unit);
        cx.letterSpacing = `${spacingFor(def, size, unit)}px`;
        cx.fillStyle = row.color;
        cx.textBaseline = 'middle';
        cx.fillText(unit.repeat(repeats), 0, c.height / 2);
        strip = { tex: textureFrom(this.gl, c, c.width, c.height, { mips: false }), w: c.width, h: c.height, unitW };
        if (this.marquees.size > 24) {
          for (const m of this.marquees.values()) this.gl.deleteTexture(m.tex.tex);
          this.marquees.clear();
        }
        this.marquees.set(key, strip);
      }
      const off = ((row.offsetX % strip.unitW) + strip.unitW) % strip.unitW;
      this.drawSprite({ tex: strip.tex, m: translate(-off + strip.w / 2, H / 2 + row.y), w: strip.w, h: strip.h, alpha: row.alpha });
    }
  }

  private drawInterlude(frame: Frame, W: number, H: number) {
    const gl = this.gl;
    const it = frame.interlude;
    for (const a of it.aurora) this.pool(a.x, a.y, a.r, a.color, a.alpha);
    for (const r of it.rings) this.drawShape({ kind: 1, m: translate(W / 2, H / 2), w: (r.r + r.width) * 2 + 4, h: (r.r + r.width) * 2 + 4, color: r.color, alpha: r.alpha, radius: r.r, width: r.width, soft: 1 });
    // ribbons: a thick line as a triangle strip
    const sp = this.programs.strip;
    sp.use();
    sp.m('u_m', mul(this.clip, this.cam));
    gl.bindVertexArray(this.stripVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.stripBuf);
    for (const b of it.ribbons) {
      const steps = 48;
      let n = 0;
      let px = 0;
      let py = 0;
      const pts: [number, number][] = [];
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        pts.push([W * u, b.y + Math.sin(u * Math.PI * b.freq * 2 + b.phase) * b.amp * (0.6 + 0.4 * Math.sin(u * Math.PI * 3 - b.phase * 0.5))]);
      }
      for (let i = 0; i < pts.length; i++) {
        const a0 = pts[Math.max(0, i - 1)]!;
        const a1 = pts[Math.min(pts.length - 1, i + 1)]!;
        const dx = a1[0] - a0[0];
        const dy = a1[1] - a0[1];
        const len = Math.hypot(dx, dy) || 1;
        const nx = (-dy / len) * (b.width / 2);
        const ny = (dx / len) * (b.width / 2);
        px = pts[i]![0];
        py = pts[i]![1];
        this.stripData[n++] = px + nx;
        this.stripData[n++] = py + ny;
        this.stripData[n++] = px - nx;
        this.stripData[n++] = py - ny;
      }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.stripData, 0, n);
      sp.col('u_color', parseColor(b.color));
      sp.f('u_alpha', b.alpha);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, n / 2);
    }
    this.drawPoints(it.particles.filter((p) => p.alpha >= 0.02).map((p) => ({ x: p.x, y: p.y, size: Math.max(0.8, p.size), alpha: p.alpha, color: p.color })));
  }

  /** Always-on motes of light, in the palette, brightening on the beat. Deterministic in time. Skipped for calm / reduced motion. */
  private drawSparks(frame: Frame, W: number, H: number, arousal: number, lightGround: boolean) {
    if (this.options.reducedMotion || lightGround) return;
    const n = Math.round(70 * this.density * (0.6 + arousal * 0.8));
    if (n < 4) return;
    const t = frame.tMs / 1000;
    const S = Math.min(H, W * 0.9);
    const pts: { x: number; y: number; size: number; alpha: number; color: string }[] = [];
    for (let k = 0; k < n; k++) {
      const h1 = hash01(k * 3 + 1);
      const h2 = hash01(k * 3 + 2);
      const h3 = hash01(k * 3 + 3);
      const speed = 0.018 + h3 * 0.05 + arousal * 0.03;
      const p = (t * speed + h2) % 1;
      const tw = 0.5 + 0.5 * Math.sin(t * (1.5 + h1 * 3) + k) + frame.beat.pulse * 0.7;
      pts.push({
        x: h1 * W + Math.sin(p * 8 + k) * S * 0.015,
        y: H * (1.05 - p * 1.1),
        size: S * (0.0035 + h3 * 0.007) * (1 + frame.beat.pulse * 0.6),
        alpha: Math.sin(p * Math.PI) * Math.min(1, 0.25 + tw * 0.5) * 0.7,
        color: frame.palette[k % 3] ?? frame.accent,
      });
    }
    this.drawPoints(pts);
  }

  private drawPoints(pts: { x: number; y: number; size: number; alpha: number; color: string }[]) {
    if (!pts.length) return;
    const gl = this.gl;
    const cap = Math.floor(this.pointData.length / 7);
    const n = Math.min(pts.length, cap);
    let o = 0;
    for (let i = 0; i < n; i++) {
      const p = pts[i]!;
      const c = parseColor(p.color);
      this.pointData[o++] = p.x;
      this.pointData[o++] = p.y;
      this.pointData[o++] = p.size;
      this.pointData[o++] = p.alpha;
      this.pointData[o++] = c[0];
      this.pointData[o++] = c[1];
      this.pointData[o++] = c[2];
    }
    const pp = this.programs.point;
    pp.use();
    pp.m('u_m', mul(this.clip, this.cam));
    pp.f('u_dpr', this.dpr);
    gl.bindVertexArray(this.pointVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pointBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.pointData, 0, o);
    gl.drawArrays(gl.POINTS, 0, n);
  }

  // ---- words ------------------------------------------------------------------------------------------------------------------------
  private sampleBehind(frame: Frame, x: number, y: number, w: number, h: number): string {
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

  private adaptInk(frame: Frame, w: DrawWord, size: number, textWidth: number): { fill: string; edge: string; edgeK: number } | null {
    if (!w.adapt || w.adapt.length === 0) return null;
    const behind = this.sampleBehind(frame, w.x, w.y, textWidth * Math.abs(w.scaleX), size * Math.abs(w.scaleY));
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
    return { fill, edge: light ? 'rgba(20,12,28,0.9)' : 'rgba(255,255,255,0.95)', edgeK: ratio >= 7 ? 0 : ratio >= 4.5 ? 0.05 : 0.09 };
  }

  private drawWord(w: DrawWord, frame: Frame, style: StyleDef, maxEcho: number) {
    if (w.alpha <= 0.005) return;
    const W = this.width;
    const H = this.height;
    const def = style.fonts[w.font];
    let size = w.sizePx;
    let textWidth = this.measure(w.text, w.font, size);
    if (textWidth * Math.abs(w.scaleX) > w.maxWidthPx) {
      size *= w.maxWidthPx / (textWidth * Math.abs(w.scaleX));
      textWidth = this.measure(w.text, w.font, size);
    }
    const low = this.options.quality === 'low';
    const ink = this.adaptInk(frame, w, size, textWidth);
    const fillColor = ink?.fill ?? w.fill;
    const g = this.glyph(w.text, def, size);
    const k = size / g.sizeB; // glyph textures are made at a bucketed size
    const gw = g.w * k;
    const gh = g.h * k;
    const span: [number, number] = [g.pad / g.w, (g.pad + g.textW) / g.w];
    const vh = (size * 0.5) / gh;
    const vspan: [number, number] = [0.5 - vh, 0.5 + vh];

    const local = (dx = 0, dy = 0): Affine => mul(mul(mul(mul(translate(W / 2 + w.x + dx, H / 2 + w.y + dy), rotate((w.rotationDeg * Math.PI) / 180)), skewX(w.skewX)), scale(w.scaleX, w.scaleY)), IDENTITY);
    const glyphDraw = (tex: Glyph, color: string, alpha: number, extra: { dx?: number; dy?: number; vclip?: [number, number]; progress?: boolean; grad?: boolean; mode?: 0 | 1 | 2 | 3; lod?: number; glowR?: number } = {}) => {
      const gg = tex === g ? { w: gw, h: gh } : { w: tex.w * (size / tex.sizeB), h: tex.h * (size / tex.sizeB) };
      let grad: SpriteOpts['grad'];
      if (extra.grad) {
        if (style.id === 'y2k') grad = { kind: 1, colors: ['#ffffff', w.fill, '#1b1030', w.fill], pos: [0, 0.48, 0.52, 1], vspan };
        else if (w.gradient === 'sunset') grad = { kind: 2, colors: ['#ffe66d', '#ff5ea8', '#46e3ff'], pos: [0, 0.5, 1, 1], vspan };
      }
      this.drawSprite({
        tex: tex.tex,
        m: local(extra.dx ?? 0, extra.dy ?? 0),
        w: gg.w,
        h: gg.h,
        alpha,
        mode: extra.mode ?? 1,
        color,
        lod: extra.lod,
        glowR: extra.glowR,
        vclip: extra.vclip,
        grad,
        progress: extra.progress && w.progress !== undefined && w.lit ? { v: w.progress, lit: w.lit, span } : undefined,
        maskScale: size * 2.4,
      });
    };

    const base = Math.min(1, w.alpha);
    const drawAll = (alpha: number, dy = 0, clip?: [number, number]) => {
      const a = Math.min(1, base * alpha);
      if (w.chip && !clip) {
        const px = size * 0.16;
        const cw = textWidth + px * 2;
        const ch = size * 0.86;
        const m0 = mul(local(0, dy), translate(0, -size * 0.46 + ch / 2));
        this.drawShape({ kind: 0, m: mul(m0, translate(0, size * 0.05)), w: cw, h: ch, color: [20 / 255, 10 / 255, 30 / 255, 0.22], alpha: a, radius: size * 0.24, soft: size * 0.04 });
        this.drawShape({ kind: 0, m: m0, w: cw, h: ch, color: w.chip, alpha: a, radius: size * 0.24, soft: 0.5 });
      }
      if (!clip && !low) {
        if (w.focus && w.focus > 0.03) {
          const s = 1 + 0.08 * w.focus;
          this.drawSprite({ tex: g.tex, m: mul(local(0, dy), scale(s, s)), w: gw, h: gh, alpha: a * 0.34 * w.focus, mode: 1, color: fillColor });
        }
        if (w.highlight) {
          const pad = size * 0.08;
          this.drawShape({ kind: 0, m: mul(local(0, dy), translate(0, size * 0.01)), w: textWidth + pad * 2, h: size * 0.62, color: w.highlight, alpha: a * 0.8, radius: size * 0.1, soft: 0.5 });
        }
        if (w.shadow) {
          if (w.strokeWidth) glyphDraw(this.glyph(w.text, def, size, w.strokeWidth), '#111018', a, { dx: w.shadow, dy: dy + w.shadow });
          glyphDraw(g, '#111018', a, { dx: w.shadow, dy: dy + w.shadow });
        }
        if (w.glow) {
          const gl2 = this.glyph(w.text, def, size);
          glyphDraw(gl2, w.gradient ? '#ff5ea8' : fillColor, Math.min(1, a * (0.35 + w.glow * 0.7)), { dy, mode: 2, lod: 1.5, glowR: Math.max(2, size * 0.13 * Math.max(0.4, w.glow) * (this.dpr > 1 ? 1 : 1) * (g.tex.w / g.w)) });
        }
        if (w.aberration) {
          glyphDraw(g, '#ff2a55', a * 0.7, { dx: -w.aberration, dy });
          glyphDraw(g, '#19e3ff', a * 0.7, { dx: w.aberration, dy });
        }
      }
      if (w.stroke) glyphDraw(this.glyph(w.text, def, size, w.strokeWidth ?? 2), w.stroke, a, { dy, vclip: clip });
      if (ink && ink.edgeK > 0 && !clip) glyphDraw(this.glyph(w.text, def, size, Math.max(2.5, size * ink.edgeK)), ink.edge, a, { dy });
      const masked = w.mask && this.artTex && this.options.artworkPolicy === 'full' && !clip;
      glyphDraw(g, fillColor, a, { dy, vclip: clip, progress: true, grad: !masked && (style.id === 'y2k' || w.gradient === 'sunset'), mode: masked ? 3 : 1 });
    };

    for (let i = Math.min(w.echo, maxEcho); i >= 1; i--) {
      // echo trails: offset copies, fading
      const a = 0.22 / i;
      this.drawSprite({ tex: g.tex, m: mul(translate(-i * size * 0.035, i * size * 0.02), local()), w: gw, h: gh, alpha: Math.min(1, base * a), mode: 1, color: fillColor });
    }
    if (w.split > 0.5 && !low) {
      drawAll(1, -w.split, [0, 0.5]);
      drawAll(1, w.split, [0.5, 1]);
    } else drawAll(1);
  }



  /**
   * The glow of the backdrop, cover and light show: bright parts blurred at quarter resolution. It is made BEFORE the words are drawn,
   * so the type itself never gets a halo and stays crisp; the finishing pass adds this on top.
   */
  private bloomPass(plan: ReturnType<typeof planStage>, lightGround: boolean) {
    const gl = this.gl;
    const scene = this.sceneRT!;
    const bloomOn = this.options.quality !== 'low' && !this.options.reducedMotion;
    if (!bloomOn) return;
    gl.disable(gl.BLEND);
    const A = this.bloomA!;
    const B = this.bloomB!;
    gl.viewport(0, 0, A.w, A.h);
    const br = this.programs.bright;
    br.use();
    gl.bindFramebuffer(gl.FRAMEBUFFER, A.fbo);
    this.bindTex(0, scene.tex);
    br.i('u_tex', 0);
    br.f('u_thr', lightGround ? 0.95 : 0.62);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const bl = this.programs.blur;
    bl.use();
    bl.i('u_tex', 0);
    for (let i = 0; i < 2; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, B.fbo);
      this.bindTex(0, A.tex);
      bl.v2('u_dir', (1.6 + i) / A.w, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, A.fbo);
      this.bindTex(0, B.tex);
      bl.v2('u_dir', 0, (1.6 + i) / A.h);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fbo);
    gl.viewport(0, 0, scene.w, scene.h);
    gl.enable(gl.BLEND);
    void plan;
    void lightGround;
  }

  // ---- finishing -------------------------------------------------------------------------------------------------------------------------
  private finish(frame: Frame, plan: ReturnType<typeof planStage>, lightGround: boolean) {
    const gl = this.gl;
    const scene = this.sceneRT!;
    const bloomOn = this.options.quality !== 'low' && !this.options.reducedMotion;
    const bloomAmt = bloomOn ? plan.bloom * (lightGround ? 0.25 : 1) : 0;
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    const p = this.programs.post;
    p.use();
    this.bindTex(0, scene.tex);
    this.bindTex(1, this.bloomA!.tex);
    p.i('u_scene', 0);
    p.i('u_bloom', 1);
    p.v2('u_res', this.canvas.width, this.canvas.height);
    p.f('u_dpr', this.dpr);
    p.f('u_time', frame.tMs / 1000);
    const calm = this.options.reducedMotion;
    p.f('u_aber', calm ? 0 : plan.aberration * (0.7 + frame.beat.pulse * 1.2));
    p.f('u_bloomAmt', bloomAmt * (0.85 + frame.beat.pulse * 0.4));
    const ov = frame.overlays;
    const prof = QUALITY_PROFILE[this.options.quality];
    p.f('u_vignette', Math.min(1, ov.vignette));
    p.f('u_scrim', ov.scrim);
    p.f('u_scrimDark', ov.scrimDark ? 1 : 0);
    p.f('u_grain', prof.grain && this.options.texture ? ov.grain * 0.8 : 0);
    p.f('u_scan', prof.scanlines && this.options.texture ? ov.scanlines : 0);
    p.f('u_halftone', prof.halftone && this.options.texture ? ov.halftone : 0);
    p.col3('u_dotColor', parseColor(frame.bg.invert ? '#000000' : (frame.palette[0] ?? frame.accent)));
    p.f('u_flash', ov.flash);
    p.f('u_pulse', frame.beat.pulse);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.enable(gl.BLEND);
  }
}

let supportedCache: boolean | null = null;

/** a stable hash in 0..1 for a small integer */
function hash01(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b1, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}
