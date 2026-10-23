import type { Track } from '../types';
import type { TrackRef } from './schemas';

/** Spotify track id from an open.spotify.com URL / URI. */
export function parseSpotifyTrackId(input: string): string | null {
  const m = /(?:open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/|spotify:track:)([A-Za-z0-9]{22})/.exec(input.trim());
  return m?.[1] ?? null;
}

export function refFromTrack(t: Track): TrackRef {
  return {
    provider: t.provider === 'licensed' ? 'demo' : t.provider, // imported files never leave the host's device
    providerTrackId: t.providerTrackId,
    title: t.title,
    artists: t.artists,
    album: t.album,
    artworkUrl: t.artworkUrl && /^(https:\/\/|\/demo\/)/.test(t.artworkUrl) ? t.artworkUrl : undefined,
    durationMs: t.durationMs,
    externalUrl: t.externalUrl && /^https:\/\/open\.spotify\.com\//.test(t.externalUrl) ? t.externalUrl : undefined,
  };
}

/** A request is playable on the host's player only when it points at a real source. */
export function playerTrackFromRef(ref: TrackRef, demoCatalog: Track[]): Track | null {
  if (ref.provider === 'demo' && ref.providerTrackId) return demoCatalog.find((t) => t.providerTrackId === ref.providerTrackId) ?? null;
  if (ref.provider === 'spotify' && ref.providerTrackId) {
    return {
      id: `spotify:${ref.providerTrackId}`,
      provider: 'spotify',
      providerTrackId: ref.providerTrackId,
      title: ref.title,
      artists: ref.artists,
      album: ref.album,
      artworkUrl: ref.artworkUrl,
      durationMs: ref.durationMs ?? 0,
      externalUrl: ref.externalUrl,
    };
  }
  return null;
}

export const trackKeyOfRef = (t: TrackRef): string => {
  if (t.providerTrackId) return `${t.provider}:${t.providerTrackId}`;
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return `text:${norm(t.title)}|${norm(t.artists[0] ?? '')}`;
};
