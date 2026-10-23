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
  album?: string;
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

export type TimedWord = { text: string; startMs: number; endMs: number };
export type TimedLine = { startMs: number; endMs: number; words: TimedWord[] };
export type LyricDocument = {
  language?: string;
  source: 'lrc' | 'enhanced-lrc' | 'vtt' | 'json' | 'plain' | 'manual';
  /** Rights / provenance, e.g. "user-supplied" or "CC0 demo". */
  licenseSource: string;
  lines: TimedLine[];
  meta?: Record<string, string>;
};

export const DEFAULT_PALETTE = ['#ff2e63', '#ffd23f', '#08d9d6', '#14121f'];
