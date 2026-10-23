// PlaybackClock: a monotonic, continuous estimate of "where is the song right now", corrected against whatever the
// provider reports. Used for Spotify (position arrives as sparse, late telemetry). Deterministic: time comes from the
// injected `now`, so a scripted telemetry sequence always yields the same positions.
//
// What it guarantees
//  - Continuity: a small disagreement is absorbed by running slightly fast or slow (<= 4%) for a few seconds, so the
//    position never jumps. It only jumps when the disagreement is large (a real seek / another device) or playback paused.
//  - Staleness: every command that changes the position (seek, load, pause, resume) starts a new `epoch`. A report that
//    was requested in an older epoch describes a moment that no longer exists and is dropped, never applied.
//  - Telemetry age: a report says WHEN its position was true (`validAt`); the clock moves it forward to now first.

type NowFn = () => number;

export type Observation = {
  positionMs: number;
  playing: boolean;
  /** local clock time (same base as `now`) at which `positionMs` was true. Default: now. */
  validAt?: number;
  /** the clock's epoch when the report was REQUESTED. A mismatch means it is stale. Default: current. */
  epoch?: number;
  rate?: number;
  /** pushed by the provider unprompted (SDK event) rather than answering a request */
  pushed?: boolean;
};

export type ObserveResult = 'snapped' | 'slewed' | 'stale';

/** Disagreement beyond this is a real jump (seek, another device), not drift. */
const SNAP_MS = 250;
/** A slew spreads its correction over this long. */
const SLEW_WINDOW_MS = 4000;
/** Largest speed-up / slow-down used to absorb a disagreement. */
const MAX_TRIM = 0.04;
/** Share of the measured disagreement corrected per report (the rest is measurement noise). */
const GAIN = 0.8;
/** After a command, a pushed report this far from the clock is the old position arriving late. */
const PUSH_GRACE_MS = 1200;
const PUSH_GRACE_TOLERANCE_MS = 1500;

export class PlaybackClock {
  private anchorPos = 0; // ms, at anchorAt
  private anchorAt = 0; // `now()` timestamp
  private playing = false;
  private rate = 1;
  private trim = 0; // fractional speed adjustment while slewing
  private slewEnd = 0;
  private commandAt = -Infinity;
  /** Bumped by every command that invalidates in-flight telemetry. */
  epoch = 0;
  /** Max disagreement tolerated before snapping instead of slewing. */
  snapThresholdMs = SNAP_MS;

  constructor(private now: NowFn = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())) {
    this.anchorAt = this.now();
  }

  /** Current estimated position in ms. */
  position(): number {
    if (!this.playing) return this.anchorPos;
    return this.at(this.now());
  }

  private at(t: number): number {
    const dt = t - this.anchorAt;
    const slewing = Math.max(0, Math.min(t, this.slewEnd) - this.anchorAt);
    return this.anchorPos + (dt + this.trim * slewing) * this.rate;
  }

  /**
   * A report from the provider. Returns what happened to it.
   * 'stale' means it was requested before the latest seek/pause/load and was ignored.
   */
  observe(o: Observation): ObserveResult {
    const t = this.now();
    if (o.epoch !== undefined && o.epoch !== this.epoch) return 'stale';
    const rate = o.rate ?? 1;
    // the position was true at validAt: move it to now
    const measured = o.positionMs + (o.playing ? Math.max(0, t - (o.validAt ?? t)) * rate : 0);
    const est = this.position();
    const err = measured - est;
    if (o.pushed && t - this.commandAt < PUSH_GRACE_MS && Math.abs(err) > PUSH_GRACE_TOLERANCE_MS) return 'stale';

    if (!this.playing || !o.playing || Math.abs(err) > this.snapThresholdMs) {
      this.anchorPos = measured;
      this.anchorAt = t;
      this.trim = 0;
      this.slewEnd = t;
      this.playing = o.playing;
      this.rate = rate;
      return 'snapped';
    }
    // small disagreement: keep the position continuous and run a little fast/slow until it is absorbed
    this.anchorPos = est;
    this.anchorAt = t;
    this.trim = Math.max(-MAX_TRIM, Math.min(MAX_TRIM, (err * GAIN) / SLEW_WINDOW_MS));
    this.slewEnd = t + SLEW_WINDOW_MS;
    this.rate = rate;
    return 'slewed';
  }

  /** Authoritative report that is already current (kept for callers without timing information). */
  sync(positionMs: number, playing: boolean, rate = 1): void {
    this.observe({ positionMs, playing, rate });
  }

  /** Start a new epoch: reports requested before this moment will be ignored. Returns the new epoch. */
  bump(): number {
    this.commandAt = this.now();
    return ++this.epoch;
  }

  /** Hard set (seek / track change). Invalidates in-flight telemetry. */
  reset(positionMs = 0, playing = false): void {
    this.bump();
    this.anchorPos = positionMs;
    this.anchorAt = this.now();
    this.playing = playing;
    this.trim = 0;
    this.slewEnd = this.anchorAt;
  }

  setPlaying(playing: boolean): void {
    this.bump();
    this.anchorPos = this.position();
    this.anchorAt = this.now();
    this.trim = 0;
    this.slewEnd = this.anchorAt;
    this.playing = playing;
  }

  isPlaying(): boolean {
    return this.playing;
  }
}
