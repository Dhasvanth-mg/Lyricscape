// The photosensitivity guard (Phase 2 INF-03, V5). Two parts:
//
//  1. `guardFx` caps what any scene may ask of the finishing pass in one frame: a white flash of at most 12% (the limit the
//     Clean renderer already keeps) and an exposure inside a band, and nothing at all with reduced motion. It is stateless, so
//     it cannot break determinism: the same frame time always gets the same guarded settings.
//  2. `flashViolations` measures a sequence of frame luminances the way WCAG 2.3.1's general flash rule counts them (a flash is
//     a pair of opposing changes of at least 10% of the maximum relative luminance where the darker state is below 0.80; more
//     than three flashes in any one second fails). The QA runner feeds it real captured frames; the tests feed it synthetic
//     strobes. A frequency limit cannot be enforced statelessly inside a frame, so it is measured instead and failures are
//     fixed in the scene that caused them.

import type { SceneFx } from '../kinetic/gl/scenes/types';

export const MAX_FLASH = 0.12;
export const EXPOSURE_BAND: [number, number] = [0.15, 1.5];

export function guardFx(fx: SceneFx, opts: { reducedMotion: boolean }): SceneFx {
  const out: SceneFx = { ...fx };
  if (out.flash !== undefined) out.flash = opts.reducedMotion ? 0 : Math.min(MAX_FLASH, Math.max(0, out.flash));
  if (out.exposure !== undefined) {
    const [lo, hi] = EXPOSURE_BAND;
    // reduced motion keeps cuts but not bright punches: exposure may only fall (a fade), never rise above normal
    out.exposure = Math.min(opts.reducedMotion ? 1 : hi, Math.max(lo, out.exposure));
  }
  if (opts.reducedMotion) {
    out.glitch = 0;
    out.blocks = 0;
    out.mblur = undefined;
    out.zblur = 0;
  }
  return out;
}

/** sRGB 0..255 to relative luminance 0..1 */
export function relLum(r: number, g: number, b: number): number {
  const f = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/**
 * Seconds in which more than three general flashes happen. `lum` is one relative luminance per frame (mean over the frame, or
 * over the brightest quarter for a localised flash), sampled at `fps`.
 */
export function flashViolations(lum: number[], fps: number): { flashes: number; worstPerSecond: number; failing: boolean } {
  // turning points: keep the extremes of each monotonic run
  const ext: { i: number; v: number }[] = [];
  for (let i = 0; i < lum.length; i++) {
    const v = lum[i]!;
    const last = ext[ext.length - 1];
    const prev = ext[ext.length - 2];
    if (!last) ext.push({ i, v });
    else if (!prev) {
      if (v !== last.v) ext.push({ i, v });
    } else {
      const rising = last.v > prev.v;
      if ((rising && v >= last.v) || (!rising && v <= last.v)) ext[ext.length - 1] = { i, v };
      else ext.push({ i, v });
    }
  }
  // a transition counts when it changes by >= 0.1 and its darker end is below 0.8
  const trans: number[] = [];
  for (let k = 1; k < ext.length; k++) {
    const a = ext[k - 1]!;
    const b = ext[k]!;
    if (Math.abs(b.v - a.v) >= 0.1 && Math.min(a.v, b.v) < 0.8) trans.push(b.i);
  }
  // a flash is a pair of opposing transitions
  const flashes: number[] = [];
  for (let k = 1; k < trans.length; k += 2) flashes.push(trans[k]!);
  let worst = 0;
  for (let a = 0, b = 0; b < flashes.length; b++) {
    while (flashes[b]! - flashes[a]! >= fps) a++;
    worst = Math.max(worst, b - a + 1);
  }
  return { flashes: flashes.length, worstPerSecond: worst, failing: worst > 3 };
}
