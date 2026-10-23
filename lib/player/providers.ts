// Capability-gated provider architecture (README §2). Providers describe what they can do and
// explain precisely why something is unavailable, instead of pretending.

import type { CapabilityKey, MusicProvider, PlaybackCapabilities, ProviderId, Track } from '../types';
import { listLocalTracks } from '../library/db';
import { searchTracks } from '../spotify/api';

export type DemoCatalogEntry = {
  id: string;
  title: string;
  artists: string[];
  album: string;
  durationMs: number;
  bpm: number;
  beatTimesMs: number[];
  palette: string[];
  audio: string;
  artwork: string;
  lyrics: string;
  license: string;
};

let catalogPromise: Promise<Track[]> | null = null;

export function loadDemoCatalog(): Promise<Track[]> {
  catalogPromise ??= fetch('/demo/catalog.json')
    .then((r) => {
      if (!r.ok) throw new Error('Demo catalog missing. Run `pnpm demo:generate`.');
      return r.json() as Promise<DemoCatalogEntry[]>;
    })
    .then((entries) =>
      entries.map(
        (e): Track => ({
          id: `demo:${e.id}`,
          provider: 'demo',
          providerTrackId: e.id,
          title: e.title,
          artists: e.artists,
          album: e.album,
          artworkUrl: e.artwork,
          durationMs: e.durationMs,
          audioUrl: e.audio,
          lyricsUrl: e.lyrics,
          palette: e.palette,
          beatTimesMs: e.beatTimesMs,
          bpm: e.bpm,
          license: e.license,
        }),
      ),
    )
    .catch((e) => {
      catalogPromise = null;
      throw e;
    });
  return catalogPromise;
}

const ALL_ON: PlaybackCapabilities = {
  play: true,
  seek: true,
  queueRead: true,
  queueWrite: true,
  deviceTransfer: false,
  synchronizedVisuals: true,
  audioAnalysis: true,
  djMixing: true,
  videoExport: true,
  artworkCompositing: true,
};

export function spotifyCapabilities(connected: boolean, premium: boolean | null): PlaybackCapabilities {
  return {
    play: connected,
    seek: connected,
    queueRead: false,
    queueWrite: false,
    deviceTransfer: connected,
    // Lyrics shown alongside Spotify playback use lyrics YOU supply; no Spotify audio/data is analysed.
    synchronizedVisuals: connected,
    audioAnalysis: false,
    djMixing: false,
    videoExport: false,
    artworkCompositing: false,
  };
}

const SPOTIFY_WHY: Partial<Record<CapabilityKey, string>> = {
  queueRead: "Spotify's queue endpoint is limited in Development Mode; Lyricscape keeps its own app queue.",
  queueWrite: 'Playback is driven from the Lyricscape queue, one track at a time.',
  audioAnalysis: 'Spotify does not expose raw audio. Beat-sync uses tempo only when available; use an imported file for full analysis.',
  djMixing: 'Mixing/overlapping Spotify recordings is not permitted by Spotify policy. Use imported, licensed audio.',
  videoExport: 'Rendering Spotify recordings into video is not permitted. Use imported, licensed audio.',
  artworkCompositing: 'Spotify artwork is shown unmodified (no masks, crops or recolouring).',
  play: 'Connect Spotify in Settings to play.',
  seek: 'Connect Spotify in Settings to play.',
  deviceTransfer: 'Connect Spotify in Settings to pick a device.',
  synchronizedVisuals: 'Connect Spotify in Settings.',
};

export class DemoProvider implements MusicProvider {
  readonly id: ProviderId = 'demo';
  readonly label = 'Demo (cleared audio)';
  capabilities() {
    return { ...ALL_ON };
  }
  explain(cap: CapabilityKey) {
    return cap === 'deviceTransfer' ? 'Plays in this browser tab.' : null;
  }
  async search(query: string) {
    const all = await loadDemoCatalog();
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((t) => `${t.title} ${t.artists.join(' ')} ${t.album ?? ''}`.toLowerCase().includes(q));
  }
  async currentTrack() {
    return getController()?.currentTrack() ?? null;
  }
  async play(track: Track) {
    await getController()?.playTrack(track);
  }
  async pause() {
    await getController()?.pause();
  }
  async seek(ms: number) {
    await getController()?.seek(ms);
  }
  async queue() {
    return getController()?.queueTracks() ?? [];
  }
}

export class LocalProvider implements MusicProvider {
  readonly id: ProviderId = 'licensed';
  readonly label = 'My files (imported)';
  capabilities() {
    return { ...ALL_ON };
  }
  explain(cap: CapabilityKey) {
    return cap === 'deviceTransfer'
      ? 'Plays in this browser tab.'
      : cap === 'videoExport' || cap === 'djMixing'
        ? 'You are responsible for having the rights to mix/export imported audio.'
        : null;
  }
  async search(query: string) {
    const all = (await listLocalTracks()).map((s) => s.track);
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((t) => `${t.title} ${t.artists.join(' ')} ${t.album ?? ''}`.toLowerCase().includes(q));
  }
  async currentTrack() {
    return getController()?.currentTrack() ?? null;
  }
  async play(track: Track) {
    await getController()?.playTrack(track);
  }
  async pause() {
    await getController()?.pause();
  }
  async seek(ms: number) {
    await getController()?.seek(ms);
  }
  async queue() {
    return getController()?.queueTracks() ?? [];
  }
}

export class SpotifyProvider implements MusicProvider {
  readonly id: ProviderId = 'spotify';
  readonly label = 'Spotify';
  capabilities() {
    return spotifyCapabilities(true, null);
  }
  explain(cap: CapabilityKey) {
    return SPOTIFY_WHY[cap] ?? null;
  }
  search(query: string) {
    return searchTracks(query);
  }
  async currentTrack() {
    return getController()?.currentTrack() ?? null;
  }
  async play(track: Track) {
    await getController()?.playTrack(track);
  }
  async pause() {
    await getController()?.pause();
  }
  async seek(ms: number) {
    await getController()?.seek(ms);
  }
  async queue() {
    return getController()?.queueTracks() ?? [];
  }
}

export function explainSpotifyCapability(cap: CapabilityKey): string | null {
  return SPOTIFY_WHY[cap] ?? null;
}

// ---- tiny late-bound controller reference (avoids an import cycle) -----------------------
type ControllerLike = {
  currentTrack(): Track | null;
  playTrack(t: Track): Promise<void>;
  pause(): Promise<void>;
  seek(ms: number): Promise<void>;
  queueTracks(): Track[];
};
let controllerRef: ControllerLike | null = null;
export const bindController = (c: ControllerLike) => {
  controllerRef = c;
};
const getController = () => controllerRef;

export const providers: Record<ProviderId, MusicProvider> = {
  demo: new DemoProvider(),
  licensed: new LocalProvider(),
  spotify: new SpotifyProvider(),
};
