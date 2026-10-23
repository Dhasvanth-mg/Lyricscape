import type { ProviderId, Track } from '../types';

export type BackendErrorKind = 'auth' | 'premium' | 'device' | 'rate' | 'unavailable' | 'network' | 'autoplay' | 'decode' | 'generic';

export type BackendState = {
  playing: boolean;
  buffering: boolean;
  positionMs: number;
  durationMs: number;
};

export type BackendEvents = {
  state(s: BackendState): void;
  ended(): void;
  error(message: string, kind: BackendErrorKind): void;
  /** Backend discovered a track the app did not start (Spotify followed from another device). */
  external?(track: Track | null): void;
};

export type LoadOptions = { autoplay: boolean; startMs?: number };

/** What the PlayerController drives. One instance per audio source family. */
export interface PlaybackBackend {
  readonly kind: 'local' | 'spotify';
  attach(events: BackendEvents): void;
  load(track: Track, opts: LoadOptions): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(positionMs: number): Promise<void>;
  setVolume(volume: number, muted: boolean): void;
  /** Authoritative-estimate position, cheap enough to call every animation frame. */
  positionMs(): number;
  dispose(): void;
}

export const backendKindFor = (p: ProviderId): 'local' | 'spotify' => (p === 'spotify' ? 'spotify' : 'local');
