// Which lyric line to show at a moment, and how far into each word the singer is. Pure: the floating window, the overlay
// and the wallpaper all use it, and tests pin it down.

export type StripLine = { startMs: number; endMs: number; words: { text: string; startMs: number; endMs: number }[]; wordTiming?: 'authored' | 'estimated' | 'none' };

/** A gap longer than this between one line's end and the next line's start shows the next line as "coming up". */
const HOLD_AFTER_END_MS = 1200;

export type StripState = {
  /** the line being sung, or -1 */
  current: number;
  /** the line after it (or the first line before the song's first vocal), or -1 */
  next: number;
  /** 0..1 progress of the current line, by time */
  lineProgress: number;
};

/** Index of the last line that has started by `t`, or -1. Lines are sorted by start (the parser guarantees it). */
export function lastStarted(lines: StripLine[], t: number): number {
  let lo = 0;
  let hi = lines.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid]!.startMs <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

export function stripAt(lines: StripLine[], t: number): StripState {
  if (!lines.length) return { current: -1, next: -1, lineProgress: 0 };
  const i = lastStarted(lines, t);
  if (i < 0) return { current: -1, next: 0, lineProgress: 0 };
  const l = lines[i]!;
  const next = i + 1 < lines.length ? i + 1 : -1;
  // a line stays up a little after its end (people read slower than they sing), unless the next one is about to start
  if (t > l.endMs + HOLD_AFTER_END_MS) return { current: -1, next, lineProgress: 1 };
  const span = Math.max(1, l.endMs - l.startMs);
  return { current: i, next, lineProgress: Math.min(1, Math.max(0, (t - l.startMs) / span)) };
}

/** 0..1 for a word: how much of it has been sung. */
export function wordProgress(w: { startMs: number; endMs: number }, t: number): number {
  if (t <= w.startMs) return 0;
  if (t >= w.endMs) return 1;
  return (t - w.startMs) / Math.max(1, w.endMs - w.startMs);
}

/** Karaoke-style word highlighting only for word times a person or an aligner stamped; estimates are never shown as real timing. */
export const hasRealWordTimes = (l: StripLine) => (l.wordTiming ?? 'authored') === 'authored' && l.words.length > 1;
