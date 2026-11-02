// The song index: what is remembered about each song so it is never worked out twice. Shared by the server (SQLite) and the browser.
// Only derived data lives here: numbers, colours, lyric text the user already holds. Never audio.

import { z } from 'zod';
import { audioFeaturesSchema } from '../analysis/types';

export const FEATURE_KINDS = ['audio', 'palette', 'lyrics'] as const;
export type FeatureKind = (typeof FEATURE_KINDS)[number];

export const songMetaSchema = z.object({
  provider: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(300),
  artists: z.array(z.string().trim().min(1).max(200)).max(20),
  durationMs: z.number().int().min(1000).max(3 * 3600_000),
});
export type SongMeta = z.infer<typeof songMetaSchema>;

/** the cover's colours, as the stage reads them (see lib/kinetic/extractPalette.ts); `artworkUrl` says which cover they were read from */
export const paletteFeatureSchema = z.object({
  artworkUrl: z.string().max(2000),
  palette: z.tuple([z.string().max(9), z.string().max(9), z.string().max(9), z.string().max(9)]),
  vibrance: z.number().min(0).max(1),
  light: z.number().min(0).max(1),
  focal: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
});
export type PaletteFeature = z.infer<typeof paletteFeatureSchema>;

/** a copy of the lyrics the user's browser holds, so they survive a cleared browser and are shared between browsers */
export const lyricsFeatureSchema = z.object({
  lrc: z.string().max(300_000),
  source: z.string().max(200),
  synced: z.boolean(),
  versionId: z.number().int().optional(),
  origin: z.enum(['lrclib', 'musixmatch', 'lyricsfile', 'user', 'edited', 'auto-aligned']).optional(),
  savedAt: z.number().int().nonnegative(),
});
export type LyricsFeature = z.infer<typeof lyricsFeatureSchema>;

export const featureSchemas = { audio: audioFeaturesSchema, palette: paletteFeatureSchema, lyrics: lyricsFeatureSchema } as const;

export const putBodySchema = z.object({
  song: songMetaSchema,
  features: z.object({ audio: audioFeaturesSchema.optional(), palette: paletteFeatureSchema.optional(), lyrics: lyricsFeatureSchema.optional() }).strict(),
});
export type PutBody = z.infer<typeof putBodySchema>;

export type IndexEntry = {
  key: string;
  song: SongMeta & { plays: number; firstSeen: number; lastSeen: number };
  features: { audio?: z.infer<typeof audioFeaturesSchema>; palette?: PaletteFeature; lyrics?: LyricsFeature };
  /** the audio features came from another copy of the same recording (matched by title, artist and length), not from this exact id */
  audioVia?: 'fingerprint';
};

export type IndexStats = {
  available: boolean;
  songs: number;
  bytes: number;
  byKind: Record<FeatureKind, { count: number; bytes: number }>;
  withTempo: number;
  file: string | null;
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/\b(feat|ft|featuring|remaster(ed)?|version|live|radio edit)\b.*$/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/**
 * Fingerprints of a recording by what a person would say identifies it: title, first artist, length to the nearest two seconds.
 * Three are returned (this bucket and its neighbours) so a recording that is 1.9 s longer on another service still matches.
 */
export function fingerprints(meta: Pick<SongMeta, 'title' | 'artists' | 'durationMs'>): string[] {
  const base = `${norm(meta.title)}|${norm(meta.artists[0] ?? '')}`;
  const b = Math.round(meta.durationMs / 2000);
  return [b, b - 1, b + 1].map((x) => `${base}|${x}`);
}
export const fingerprint = (meta: Pick<SongMeta, 'title' | 'artists' | 'durationMs'>): string => fingerprints(meta)[0]!;
