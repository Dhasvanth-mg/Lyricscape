// PlaybackClock: monotonic UI position estimate, corrected against the authoritative
// provider position. Never relies on setInterval accumulation for timing.

export type NowFn = () => number;

export class PlaybackClock {
  private anchorPos = 0; // ms, at anchorAt
  private anchorAt = 0; // `now()` timestamp
  private playing = false;
  private rate = 1;
  /** Max disagreement tolerated before snapping instead of slewing. */
  snapThresholdMs = 120;

  constructor(private now: NowFn = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    this.anchorAt = this.now();
  }

  /** Current estimated position in ms. */
  position(): number {
    if (!this.playing) return this.anchorPos;
    return this.anchorPos + (this.now() - this.anchorAt) * this.rate;
  }

  /** Authoritative report from the provider. */
  sync(positionMs: number, playing: boolean, rate = 1): void {
    const est = this.position();
    const t = this.now();
    if (!this.playing || !playing || Math.abs(est - positionMs) > this.snapThresholdMs) {
      this.anchorPos = positionMs;
    } else {
      // small drift: slew 25% toward authority to avoid visible jumps (visualizer stays smooth)
      this.anchorPos = est + (positionMs - est) * 0.25;
    }
    this.anchorAt = t;
    this.playing = playing;
    this.rate = rate;
  }

  /** Hard set (seek / track change). */
  reset(positionMs = 0, playing = false): void {
    this.anchorPos = positionMs;
    this.anchorAt = this.now();
    this.playing = playing;
  }

  setPlaying(playing: boolean): void {
    this.anchorPos = this.position();
    this.anchorAt = this.now();
    this.playing = playing;
  }

  isPlaying(): boolean {
    return this.playing;
  }
}
