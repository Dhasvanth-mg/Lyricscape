// "Now playing" as other surfaces see it: the floating lyrics window, the OBS overlay, a desktop wallpaper, and later the
// light and presence bridges. Only what those need: the track's names, its lyric lines and a clock sample. No audio, no tokens.

import { z } from 'zod';

const word = z.object({ text: z.string().max(200), startMs: z.number(), endMs: z.number() });
const line = z.object({
  startMs: z.number(),
  endMs: z.number(),
  words: z.array(word).max(400),
  /** authored word times may be shown as karaoke; estimated or missing ones only as whole lines */
  wordTiming: z.enum(['authored', 'estimated', 'none']).optional(),
});
export type LiveLine = z.infer<typeof line>;

export const liveTrack = z.object({
  id: z.string().max(300),
  title: z.string().max(500),
  artists: z.array(z.string().max(300)).max(20),
  durationMs: z.number().nonnegative(),
  /** cover image URL, when it is a plain http(s) URL (generated covers are not sent) */
  artworkUrl: z.string().max(2000).regex(/^https?:\/\//).nullable(),
});
export type LiveTrack = z.infer<typeof liveTrack>;

export const liveClock = z.object({
  playing: z.boolean(),
  /** lyric time (ms) at `at`: playback position with every sync correction already applied */
  lyricMs: z.number(),
  /** Date.now() of the publisher when `lyricMs` was true. Publisher and readers run on the same computer. */
  at: z.number(),
  /** the song's own lyric offset inside `lyricMs`: beat time = lyric time - trackOffsetMs (beats follow the audio, not the lyric file) */
  trackOffsetMs: z.number().default(0),
});
export type LiveClock = z.infer<typeof liveClock>;

export const liveSong = z.object({
  track: liveTrack.nullable(),
  /** changes when the lyric version changes, so readers know when to redraw everything */
  docKey: z.string().max(200).nullable(),
  lines: z.array(line).max(2000).nullable(),
  palette: z.array(z.string().max(32)).max(8).nullable(),
  /** beat times (ms of lyric time), when a beat grid is known */
  beatsMs: z.array(z.number()).max(5000).nullable(),
});
export type LiveSong = z.infer<typeof liveSong>;

export const livePost = z.discriminatedUnion('kind', [z.object({ kind: z.literal('song'), song: liveSong, clock: liveClock }), z.object({ kind: z.literal('clock'), clock: liveClock })]);
export type LivePost = z.infer<typeof livePost>;

export type LiveState = { song: LiveSong; clock: LiveClock; seq: number };

export const EMPTY_SONG: LiveSong = { track: null, docKey: null, lines: null, palette: null, beatsMs: null };

/** lyric time now, from a clock sample */
export function liveNow(c: LiveClock, nowMs: number): number {
  return c.playing ? c.lyricMs + Math.max(0, nowMs - c.at) : c.lyricMs;
}
