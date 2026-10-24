// Song Visual Identity: what we know, what we infer, and how sure we are.
//
// Every dimension is its own 0..1 axis with a confidence and the sources that moved it. A dimension nobody has evidence
// for stays UNKNOWN (v = null) instead of defaulting to "middle": an unknown signal must never be dressed up as a measurement.

import type { MotifId } from '../kinetic/emotion';

/** Where a piece of evidence came from. 'genre' = tags reported by Spotify / MusicBrainz / the track itself. */
export type Source = 'genre' | 'lyrics' | 'pace' | 'cover' | 'tempo' | 'metadata' | 'ai' | 'user';

export type Dim = {
  /** 0..1, or null = unknown */
  v: number | null;
  /** 0..1: how much independent, agreeing evidence stands behind v */
  conf: number;
  src: Source[];
};

export const DIM_KEYS = ['valence', 'energy', 'intimacy', 'tension', 'warmth', 'nostalgia', 'melancholy', 'urgency', 'dreaminess'] as const;
export type DimKey = (typeof DIM_KEYS)[number];

/** Poles for display: [low end, high end]. */
export const DIM_POLES: Record<DimKey, [string, string]> = {
  valence: ['dark', 'uplifting'],
  energy: ['calm', 'intense'],
  intimacy: ['expansive', 'intimate'],
  tension: ['relaxed', 'anxious'],
  warmth: ['cold', 'warm'],
  nostalgia: ['present', 'nostalgic'],
  melancholy: ['light', 'melancholic'],
  urgency: ['patient', 'urgent'],
  dreaminess: ['grounded', 'dreamy'],
};

/** The genre families the art directions are organised around. */
export const GENRE_FAMILIES = ['hiphop', 'rnb', 'pop', 'rock', 'indie', 'atmospheric', 'experimental', 'electronic', 'folk'] as const;
export type GenreFamily = (typeof GENRE_FAMILIES)[number];

export const GENRE_LABEL: Record<GenreFamily, string> = {
  hiphop: 'Hip-hop',
  rnb: 'R&B',
  pop: 'Pop',
  rock: 'Rock',
  indie: 'Indie',
  atmospheric: 'Atmospheric',
  experimental: 'Experimental',
  electronic: 'Electronic',
  folk: 'Folk',
};

export type TagSource = 'spotify' | 'musicbrainz' | 'track' | 'user';
/** One genre tag with how strongly its source stands behind it (0..1). */
export type GenreTag = { tag: string; weight: number; source: TagSource };

export type Delivery = 'rapped' | 'sung' | 'mixed' | 'unknown';
export type Perspective = 'inward' | 'addressed' | 'collective' | 'narrative' | 'unknown';

export type LyricStats = {
  lines: number;
  words: number;
  /** words per second while lines are on screen (undefined without timing) */
  pace?: number;
  /** share of lines that repeat an earlier line */
  repetition: number;
  avgWordsPerLine: number;
  firstPerson: number;
  secondPerson: number;
  plural: number;
  thirdPerson: number;
  pastTense: number;
  questions: number;
  exclaims: number;
  /** 0..1: long, non-repeating, past-tense lines read as storytelling */
  narrativity: number;
  perspective: Perspective;
};

export type CoverCues = { light: number; vibrance: number; /** 0 cold .. 1 warm, from the dominant colours */ warmth?: number };

export type ProvenanceRow = { source: Source; used: boolean; detail: string };

export type SongIdentity = {
  version: 2;
  trackId: string;
  /** hash of every input that fed this profile: equal key = equal profile */
  key: string;
  musical: {
    primaryGenre: GenreFamily | null;
    secondaryGenre: GenreFamily | null;
    /** family -> normalised share (0..1) of the genre evidence */
    familyShare: Partial<Record<GenreFamily, number>>;
    subgenre: string | null;
    /** every subgenre label the tags support, strongest first (the headline uses the primary one) */
    subgenres: string[];
    tags: GenreTag[];
    delivery: { kind: Delivery; conf: number };
    rhythm: Dim;
    pacing: { label: 'slow' | 'moderate' | 'fast' | 'unknown'; wordsPerSecond?: number };
    /** only what the tags themselves say (piano, acoustic, synth...). Never guessed from text. */
    instrumental: string[];
  };
  emotional: Record<DimKey, Dim> & {
    /** mixed or contradictory evidence (0 = clear, 1 = genuinely ambiguous). null = too little evidence to say. */
    ambiguity: Dim;
  };
  lyrical: {
    stats: LyricStats | null;
    subjects: string[];
    motifs: MotifId[];
  };
  cultural: {
    /** release decade, from the track's metadata when the source gave one */
    era: number | null;
    album: string | null;
    /** aesthetic labels the tags themselves carry (lo-fi, synthwave, shoegaze...) */
    aesthetics: string[];
    /** Artist influences and intentions are NEVER inferred. Always empty unless a verified source supplies them. */
    influences: { name: string; source: string }[];
  };
  /** the listener's own steer for this song (see corrections.ts) */
  taste: { cinematic: number; experimental: number; minimal: number };
  provenance: {
    rows: ProvenanceRow[];
    /** reported by a third party (tags, release metadata) */
    reported: string[];
    /** inferred by this app from text / cover / pace */
    inferred: string[];
    /** things this app cannot know without audio analysis */
    unknown: string[];
  };
  /** overall: how much real evidence there is at all (0 = nothing, 1 = plenty) */
  evidence: number;
  /** did a cached AI interpretation take part */
  ai: boolean;
};

export type IdentityInputs = {
  trackId: string;
  title?: string;
  album?: string;
  releaseYear?: number;
  tags: GenreTag[];
  lyrics: import('../types').LyricDocument | null;
  bpm?: number;
  cover?: CoverCues | null;
  /** validated AI interpretation, when the listener allowed one and it came back */
  ai?: import('./ai').AiProfile | null;
  corrections?: import('./corrections').Corrections | null;
};

export const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * The value of a dimension ONLY when it is trustworthy enough to act on or to say out loud: enough confidence, and not supported by
 * the cover alone (a colour palette cannot name the mood of a song). Everything that explains or chooses uses this one rule, so the
 * headline, the reasons and the art direction can never disagree about what is known.
 */
export function knownDim(id: SongIdentity | null | undefined, k: DimKey | 'ambiguity', minConf = 0.3): number | null {
  const d = id?.emotional[k];
  if (!d || d.v === null || d.conf < minConf) return null;
  if (d.src.length > 0 && d.src.every((s) => s === 'cover')) return null;
  return d.v;
}
