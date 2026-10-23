// Adaptive quality: watches real frame intervals and steps visual quality down when the stage can't keep up
// (and, much more cautiously, back up when it has been smooth for a long time). Pure logic so it can be tested.

export type QualityLevel = 'high' | 'medium' | 'low';
export const LEVELS: QualityLevel[] = ['high', 'medium', 'low'];

export type GovernorOptions = {
  /** median frame interval above this (ms) counts as "struggling" (24 ms ~ 41 fps) */
  downMs?: number;
  /** median must stay below this (ms) for `upAfterMs` before stepping back up */
  upMs?: number;
  windowFrames?: number;
  cooldownMs?: number;
  upAfterMs?: number;
};

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s[s.length >> 1] ?? 0;
};

export class FrameGovernor {
  private samples: number[] = [];
  private idx: number;
  private lastChange = 0;
  private goodSince: number | null = null;
  private o: Required<GovernorOptions>;

  constructor(start: QualityLevel = 'high', opts: GovernorOptions = {}) {
    this.idx = LEVELS.indexOf(start);
    this.o = { downMs: 24, upMs: 19, windowFrames: 40, cooldownMs: 2000, upAfterMs: 25_000, ...opts };
  }

  get level(): QualityLevel {
    return LEVELS[this.idx]!;
  }

  /** Force a level (user choice) and forget history. */
  reset(level: QualityLevel, nowMs = 0) {
    this.idx = LEVELS.indexOf(level);
    this.samples = [];
    this.lastChange = nowMs;
    this.goodSince = null;
  }

  /**
   * Feed one frame interval. Returns the new level when it changed, else null.
   * Ignores paused/hidden-tab gaps (> 250 ms) so switching tabs never looks like lag.
   */
  push(dtMs: number, nowMs: number): QualityLevel | null {
    if (!(dtMs > 0) || dtMs > 250) {
      this.samples = [];
      this.goodSince = null;
      return null;
    }
    this.samples.push(dtMs);
    if (this.samples.length > this.o.windowFrames) this.samples.shift();
    if (this.samples.length < this.o.windowFrames) return null;
    if (nowMs - this.lastChange < this.o.cooldownMs) return null;
    const m = median(this.samples);

    if (m > this.o.downMs && this.idx < LEVELS.length - 1) {
      this.idx++;
      return this.changed(nowMs);
    }
    if (m < this.o.upMs) {
      this.goodSince ??= nowMs;
      if (nowMs - this.goodSince >= this.o.upAfterMs && this.idx > 0) {
        this.idx--;
        return this.changed(nowMs);
      }
    } else this.goodSince = null;
    return null;
  }

  private changed(nowMs: number): QualityLevel {
    this.lastChange = nowMs;
    this.samples = [];
    this.goodSince = null;
    return this.level;
  }
}

/** Visual budget per level, shared by the engine (density) and the renderer (everything else). */
export const QUALITY_PROFILE: Record<QualityLevel, { density: number; dprCap: number; grain: boolean; halftone: boolean; marqueeRows: number; echo: number; scanlines: boolean }> = {
  high: { density: 1, dprCap: 1.5, grain: true, halftone: true, marqueeRows: 4, echo: 3, scanlines: true },
  medium: { density: 0.65, dprCap: 1.25, grain: false, halftone: true, marqueeRows: 2, echo: 1, scanlines: false },
  low: { density: 0.35, dprCap: 1, grain: false, halftone: false, marqueeRows: 0, echo: 0, scanlines: false },
};

/** Never push more than this many device pixels per frame (4K fullscreen would otherwise be ~8M). */
export const PIXEL_BUDGET = 2_300_000;
