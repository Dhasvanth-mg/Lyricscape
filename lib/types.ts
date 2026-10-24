// Canonical identifiers and contracts shared by every module.
// Mirrors the README "MusicProvider" contract.

export type ProviderId = 'spotify' | 'licensed' | 'demo';

export type Track = {
  /** Canonical, provider-qualified id: `${provider}:${providerTrackId}` */
  id: string;
  provider: ProviderId;
  providerTrackId?: string;
  title: string;
  artists: string[];
  /** Spotify artist ids, used only to look up genre tags for the theme */
  artistIds?: string[];
  /** genre tags when known (Spotify artist genres) */
  genres?: string[];
  album?: string;
  /** release year of the album, when the source reports one (Spotify) */
  releaseYear?: number;
  artworkUrl?: string;
  durationMs: number;
  externalUrl?: string;
  /** Playable URL for providers that expose raw audio (demo / licensed). Never set for Spotify. */
  audioUrl?: string;
  /** Optional timed lyrics location (demo/licensed only). */
  lyricsUrl?: string;
  /** Cover palette (hex) used by the visualizer. */
  palette?: string[];
  /** Precomputed beat grid in ms (ground truth for demo, analysed for licensed). */
  beatTimesMs?: number[];
  bpm?: number;
  /** Provenance / rights note. */
  license?: string;
};

export type PlaybackCapabilities = {
  play: boolean;
  seek: boolean;
  queueRead: boolean;
  queueWrite: boolean;
  deviceTransfer: boolean;
  synchronizedVisuals: boolean;
  audioAnalysis: boolean;
  djMixing: boolean;
  videoExport: boolean;
  artworkCompositing: boolean;
};

export type CapabilityKey = keyof PlaybackCapabilities;

export type PlayerStatus =
  | 'disconnected'
  | 'connecting'
  | 'ready'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'unavailable'
  | 'error';

export type RepeatMode = 'off' | 'all' | 'one';

export interface MusicProvider {
  readonly id: ProviderId;
  readonly label: string;
  capabilities(): PlaybackCapabilities;
  /** Human reasons why a capability is disabled. */
  explain(cap: CapabilityKey): string | null;
  search(query: string): Promise<Track[]>;
  currentTrack(): Promise<Track | null>;
  play(track: Track): Promise<void>;
  pause(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  queue(): Promise<Track[]>;
}

// ---- Lyrics / visuals ------------------------------------------------------

/** `confidence` (0..1) is only set by an aligner; human and file timing carry none. Not persisted in LRC. */
export type TimedWord = { text: string; startMs: number; endMs: number; confidence?: number };

/**
 * How trustworthy a line's word times are.
 *  authored  = stamped by a person, a word-synced file (enhanced LRC / Lyricsfile) or an aligner
 *  estimated = spread over the line by a heuristic: a guess, never to be shown as real karaoke timing
 *  none      = no word times at all
 * A line without the field is read as 'authored' (every document saved before this field existed carried real stamps).
 */
export type WordTiming = 'authored' | 'estimated' | 'none';
/** Where a line's endMs came from: the file said so, the next cue is the best bound, or it is a guess. */
export type EndSource = 'explicit' | 'next-line' | 'estimated';
export type TimedLine = { startMs: number; endMs: number; words: TimedWord[]; wordTiming?: WordTiming; endSource?: EndSource };

export type TimingSource = 'lyricsfile' | 'enhanced-lrc' | 'lrc' | 'vtt' | 'json' | 'plain' | 'edited' | 'auto-aligned';
/** How well the chosen recording matches the track that is playing (set by retrieval; absent for user files). */
export type MatchInfo = {
  provider: 'lrclib';
  recordId?: number;
  titleExact: boolean;
  artistExact: boolean;
  albumMatch: boolean;
  /** |recording length - track length| in seconds, when both are known */
  durationDeltaSec: number | null;
  /** 'exact' <= 2 s, 'close' <= 5 s, 'unknown' when a length is missing */
  verdict: 'exact' | 'close' | 'unknown';
};
export type LyricDocument = {
  language?: string;
  source: 'lrc' | 'enhanced-lrc' | 'vtt' | 'json' | 'plain' | 'manual';
  /** Rights / provenance, e.g. "user-supplied" or "CC0 demo". */
  licenseSource: string;
  lines: TimedLine[];
  meta?: Record<string, string>;
  /** Where the timestamps came from and how much to trust them. Optional: older documents lack it. */
  timing?: {
    source: TimingSource;
    /** an [offset:] tag that was already applied to every timestamp (never applied twice) */
    offsetAppliedMs?: number;
    match?: MatchInfo;
    /** 0..1, set by an aligner; absent for human/file timing */
    confidence?: number;
    notes?: string[];
  };
};

export const DEFAULT_PALETTE = ['#ff2e63', '#ffd23f', '#08d9d6', '#14121f'];
