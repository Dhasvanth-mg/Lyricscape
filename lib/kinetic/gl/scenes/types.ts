// What a Turbo "scene" (one of the reference-faithful worlds) is allowed to ask of the renderer.
// A scene is a pure function of time: it receives a host that draws, and hands back the finishing-pass settings for this frame.

import type { Affine, Program, Tex } from '../gpu';
import type { Frame, VisualTimeline } from '../../types';
import type { SpriteOpts, ShapeOpts } from '../renderer';

export type TexEntry = { tex: Tex; w: number; h: number };

/** Finishing-pass settings a scene sets per frame (everything optional; 0 = off). */
export type SceneFx = Partial<{
  /** chromatic fringing: strength, and 1 = across the whole frame instead of only toward the edges */
  aber: number;
  aberFull: 0 | 1;
  /** horizontal glitch slices 0..1, and displaced coloured macroblocks 0..1 */
  glitch: number;
  blocks: number;
  /** directional blur in uv units, and radial (zoom) blur */
  mblur: [number, number];
  zblur: number;
  /** film grain (mono), coarse colour grain, grain cell in css px */
  grain: number;
  chroma: number;
  grainCell: number;
  scan: number;
  curve: number;
  dither: number;
  vignette: number;
  flash: number;
  /** multiplier on the bloom the plan asks for, and on the final exposure */
  bloom: number;
  exposure: number;
}>;

export type SceneHost = {
  W: number;
  H: number;
  dpr: number;
  frame: Frame;
  tl: VisualTimeline;
  reduced: boolean;
  /** quality 0..1 (1 = high) so a scene can use fewer elements on a struggling machine */
  density: number;
  /** a canvas painted once and kept as a texture (cached by key) */
  tex(key: string, w: number, h: number, paint: (cx: CanvasRenderingContext2D) => void, opts?: { nearest?: boolean }): TexEntry;
  measure(font: string, text: string): number;
  /** draw a sprite / shape in stage px (origin top-left) with NO extra camera: the scene composes its own */
  sprite(o: SpriteOpts): void;
  shape(o: ShapeOpts): void;
  rect(x: number, y: number, w: number, h: number, color: string | [number, number, number, number], alpha: number): void;
  pool(x: number, y: number, r: number, color: string, alpha: number): void;
  points(pts: { x: number; y: number; size: number; alpha: number; color: string }[]): void;
  /** fill the whole scene target with a colour */
  clear(color: string): void;
  /** a full-screen fragment shader; `scale` is the fraction of the scene resolution it runs at (it is stretched up) */
  fullscreen(key: string, fs: string, scale: number, set: (p: Program, size: { w: number; h: number }) => void): void;
  /** turn what has been drawn so far into characters (ASCII pass) */
  ascii(o: { cell: number; mix: number; ramp?: string; boost?: number }): void;
  /** additive (true) or normal premultiplied blending (false) */
  additive(on: boolean): void;
  /** the scene target as a texture is not available to scenes; blur is done with mip levels (`lod`) on sprites */
  mul: (a: Affine, b: Affine) => Affine;
};
