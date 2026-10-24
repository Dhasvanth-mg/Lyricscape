// One place that turns "a track + its lyrics + the viewer's look choices" into a timeline,
// shared by the live stage and the video exporter so both always agree.

import type { LyricDocument, Track } from '../types';
import { compileTimeline } from './compile';
import { analyzeEmotion, overrideMood, type EmotionId, type MoodAnalysis } from './emotion';
import { paletteForTrack } from './palette';
import type { StyleId, VisualTimeline } from './types';

export type CoverCues = NonNullable<VisualTimeline['cover']>;

/** Mood detected from lyrics + tempo, or the one the user picked. */
export function moodFor(track: Track, doc: LyricDocument | null, pick: EmotionId | 'auto'): MoodAnalysis {
  const detected = analyzeEmotion(doc, { bpm: track.bpm });
  return pick === 'auto' ? detected : overrideMood(detected, pick);
}

export function compileForTrack(a: {
  track: Track;
  doc: LyricDocument | null;
  style: StyleId;
  albumPalette: string[] | null;
  cover: CoverCues | null;
  mood: MoodAnalysis | null;
  /** animate word by word on line-synced lyrics from estimated word times (the stage's "estimated words" switch) */
  estimateWords?: boolean;
}): VisualTimeline {
  const { track } = a;
  const doc = a.doc ?? { source: 'manual' as const, licenseSource: 'none', lines: [] };
  return compileTimeline(doc, {
    trackId: track.id,
    durationMs: track.durationMs || 180000,
    palette: a.albumPalette ?? paletteForTrack(track),
    style: a.style,
    bpm: track.bpm,
    beatTimesMs: track.beatTimesMs,
    mood: a.mood ?? undefined,
    cover: a.cover ?? undefined,
    label: `${track.title} • ${track.artists.join(', ')}`,
    estimateWords: a.estimateWords,
  });
}
