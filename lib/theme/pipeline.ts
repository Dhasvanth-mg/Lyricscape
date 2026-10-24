// The whole path from evidence to a drawable song, as one pure function: identity -> art direction -> look -> compiled timeline.
// The stage composes the same pieces with React state (useSongLook); this is the plain version used by the look gallery,
// the report scripts and the tests, so what is verified is what the stage runs.

import { buildIdentity, describeIdentity } from '../identity/build';
import type { Corrections } from '../identity/corrections';
import type { AiProfile } from '../identity/ai';
import type { GenreTag, SongIdentity } from '../identity/types';
import { compileTimeline } from '../kinetic/compile';
import { analyzeEmotion } from '../kinetic/emotion';
import { paletteForTrack } from '../kinetic/palette';
import type { VisualTimeline } from '../kinetic/types';
import type { LyricDocument, Track } from '../types';
import { resolveLook, type Resolved } from './resolve';
import type { CoverInfo, SavedTheme, SongLook } from './types';

export type SongVisualInput = {
  track: Track;
  doc: LyricDocument | null;
  tags: GenreTag[];
  cover: CoverInfo | null;
  corrections?: Corrections | null;
  ai?: AiProfile | null;
  song?: SongLook | null;
  saved?: SavedTheme[];
  familyDefaults?: Parameters<typeof resolveLook>[0]['familyDefaults'];
  autoTheme?: boolean;
  fallback?: Parameters<typeof resolveLook>[0]['fallback'];
  estimateWords?: boolean;
};

export type SongVisual = { identity: SongIdentity; described: ReturnType<typeof describeIdentity>; resolved: Resolved; timeline: VisualTimeline };

export function songVisual(i: SongVisualInput): SongVisual {
  const { track, doc } = i;
  const identity = buildIdentity({ trackId: track.id, title: track.title, album: track.album, releaseYear: track.releaseYear, tags: i.tags, lyrics: doc, bpm: track.bpm, cover: i.cover ? { light: i.cover.light, vibrance: i.cover.vibrance, warmth: i.cover.warmth } : null, ai: i.ai ?? null, corrections: i.corrections ?? null });
  const resolved = resolveLook({ identity, cover: i.cover, song: i.song ?? null, saved: i.saved ?? [], familyDefaults: i.familyDefaults ?? {}, autoTheme: i.autoTheme ?? true, fallback: i.fallback ?? 'maximalist' });
  const mood = analyzeEmotion(doc, { bpm: track.bpm });
  const timeline = compileTimeline(doc ?? { source: 'manual', licenseSource: 'none', lines: [] }, {
    trackId: track.id,
    durationMs: track.durationMs || 180000,
    palette: i.cover?.palette && i.cover.vibrance > 0.12 ? i.cover.palette : paletteForTrack(track),
    style: resolved.direction,
    bpm: track.bpm,
    beatTimesMs: track.beatTimesMs,
    mood,
    cover: i.cover ? { light: i.cover.light, vibrance: i.cover.vibrance, focal: { x: 0.5, y: 0.5 } } : undefined,
    label: `${track.title} • ${track.artists.join(', ')}`,
    estimateWords: i.estimateWords ?? true,
  });
  return { identity, described: describeIdentity(identity), resolved, timeline };
}
