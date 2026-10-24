// What the stage and the exporter need from a renderer, and a factory that picks one by mode.
// Both renderers draw the same pure `Frame`; only the machinery differs (Canvas 2D for Clean, WebGL2 for Turbo).

import type { Look } from './look';
import type { QualityLevel } from './governor';
import type { RendererOptions } from './render';
import { KineticRenderer } from './render';
import type { StageMode } from './modes';
import type { Frame, VisualTimeline } from './types';
import { TurboRenderer } from './gl/renderer';

export interface StageRenderer {
  readonly kind: 'canvas2d' | 'webgl2';
  width: number;
  height: number;
  /** exporter: draw at exactly the pixel size asked for */
  exact: boolean;
  options: RendererOptions;
  readonly density: number;
  loadFonts(): Promise<void>;
  loadLookFonts(): Promise<void>;
  setLook(look: Look | null): void;
  setTimeline(tl: VisualTimeline | null): void;
  setArtwork(source: CanvasImageSource | null): void;
  resize(cssWidth: number, cssHeight: number, dpr?: number): void;
  setQuality(q: QualityLevel): void;
  render(tMs: number): Frame | null;
  bench(tMs: number, n?: number): number;
  dispose?(): void;
}

export const turboSupported = (): boolean => typeof document !== 'undefined' && TurboRenderer.supported();

/**
 * Build the renderer for a mode. Turbo throws if WebGL2 is missing or a shader fails: the caller falls back to Clean on a FRESH canvas
 * (a canvas that has been given a WebGL context can never give a 2D one).
 */
export function createStageRenderer(mode: StageMode, canvas: HTMLCanvasElement, opts: { preserveDrawingBuffer?: boolean } = {}): StageRenderer {
  if (mode === 'turbo') return new TurboRenderer(canvas, opts);
  return new KineticRenderer(canvas);
}
