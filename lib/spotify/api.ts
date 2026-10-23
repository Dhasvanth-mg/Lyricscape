// Thin, defensive wrapper over the official Spotify Web API.
// Handles token refresh on 401, honors 429 Retry-After, and turns Spotify's
// error shapes into precise, user-readable states (no fake success).

import type { Track } from '../types';
import { SpotifyAuthError, getAccessToken } from './auth';

const BASE = 'https://api.spotify.com/v1';

export type SpotifyErrorKind =
  | 'auth' // 401 after refresh / not connected
  | 'premium' // 403 PREMIUM_REQUIRED
  | 'forbidden' // other 403 (scope, dev-mode user not allow-listed, restricted endpoint)
  | 'no-device' // 404 NO_ACTIVE_DEVICE
  | 'rate-limit' // 429
  | 'not-found'
  | 'network'
  | 'server'
  | 'unknown';

export class SpotifyApiError extends Error {
  constructor(
    message: string,
    public kind: SpotifyErrorKind,
    public status = 0,
    public retryAfterMs?: number,
    public reason?: string,
  ) {
    super(message);
  }
}

type FetchOpts = { method?: string; query?: Record<string, string | number | undefined>; body?: unknown; allow404?: boolean };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Global backoff so concurrent pollers all respect a 429. */
let blockedUntil = 0;
export const rateLimitedUntil = () => blockedUntil;

export async function spFetch<T = unknown>(path: string, opts: FetchOpts = {}, attempt = 0): Promise<T | null> {
  const wait = blockedUntil - Date.now();
  if (wait > 0) {
    throw new SpotifyApiError(`Spotify asked us to slow down. Retrying in ${Math.ceil(wait / 1000)}s.`, 'rate-limit', 429, wait);
  }
  let token: string;
  try {
    token = await getAccessToken();
  } catch (e) {
    if (e instanceof SpotifyAuthError) throw new SpotifyApiError(e.message, 'auth', 401);
    throw e;
  }
  const url = new URL(path.startsWith('http') ? path : BASE + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: { Authorization: `Bearer ${token}`, ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new SpotifyApiError('Cannot reach Spotify. Check your connection.', 'network');
  }

  if (res.status === 204 || (res.status === 202 && !(res.headers.get('content-type') ?? '').includes('json'))) return null;
  if (res.ok) {
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : null;
  }

  if (res.status === 401 && attempt === 0) {
    try {
      await getAccessToken(true);
    } catch (e) {
      throw new SpotifyApiError((e as Error).message, 'auth', 401);
    }
    return spFetch<T>(path, opts, attempt + 1);
  }

  if (res.status === 429) {
    const retry = Math.min(60_000, Math.max(1000, Number(res.headers.get('retry-after') ?? '2') * 1000));
    blockedUntil = Date.now() + retry;
    throw new SpotifyApiError(`Spotify rate limit hit. Pausing requests for ${Math.ceil(retry / 1000)}s.`, 'rate-limit', 429, retry);
  }

  const body = (await res.json().catch(() => ({}))) as { error?: { message?: string; reason?: string } };
  const message = body.error?.message ?? res.statusText;
  const reason = body.error?.reason;
  if (res.status === 404 && opts.allow404) return null;
  if (res.status === 404 && reason === 'NO_ACTIVE_DEVICE') {
    throw new SpotifyApiError('No active Spotify device. Open Spotify on a device, or use the "Lyricscape" browser device.', 'no-device', 404, undefined, reason);
  }
  if (res.status === 404) throw new SpotifyApiError(message || 'Not found', 'not-found', 404, undefined, reason);
  if (res.status === 403 && (reason === 'PREMIUM_REQUIRED' || /premium/i.test(message))) {
    throw new SpotifyApiError('Spotify Premium is required to control playback. Lyrics can still follow what you play elsewhere.', 'premium', 403, undefined, reason);
  }
  if (res.status === 403) {
    throw new SpotifyApiError(
      `Spotify refused this request (403): ${message || 'forbidden'}. In Development Mode only users added to your app's allow-list can use it.`,
      'forbidden',
      403,
      undefined,
      reason,
    );
  }
  if (res.status >= 500) throw new SpotifyApiError('Spotify is having trouble right now. Try again shortly.', 'server', res.status);
  throw new SpotifyApiError(message || `Spotify error ${res.status}`, 'unknown', res.status, undefined, reason);
}

// ---- mapping -----------------------------------------------------------------------
type ApiImage = { url: string; width?: number | null; height?: number | null };
export type ApiTrack = {
  id: string | null;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
  album?: { name: string; images?: ApiImage[] };
  external_urls?: { spotify?: string };
  is_local?: boolean;
  type?: string;
};

export function mapTrack(t: ApiTrack): Track | null {
  if (!t.id || t.is_local || (t.type && t.type !== 'track')) return null;
  const images = [...(t.album?.images ?? [])].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  const pick = images.find((i) => (i.width ?? 0) <= 700) ?? images[0];
  return {
    id: `spotify:${t.id}`,
    provider: 'spotify',
    providerTrackId: t.id,
    title: t.name,
    artists: t.artists.map((a) => a.name),
    album: t.album?.name,
    artworkUrl: pick?.url,
    durationMs: t.duration_ms,
    externalUrl: t.external_urls?.spotify,
  };
}

// ---- endpoints -------------------------------------------------------------------------
export type SpotifyMe = { id: string; display_name?: string; product?: string; email?: string };
export const getMe = () => spFetch<SpotifyMe>('/me');

export async function searchTracks(q: string, limit = 10): Promise<Track[]> {
  if (!q.trim()) return [];
  const data = await spFetch<{ tracks?: { items: ApiTrack[] } }>('/search', { query: { q, type: 'track', limit } });
  return (data?.tracks?.items ?? []).map(mapTrack).filter((t): t is Track => !!t);
}

export type SpotifyDevice = { id: string | null; name: string; type: string; is_active: boolean; volume_percent?: number | null; is_restricted?: boolean };
export type PlaybackState = {
  device?: SpotifyDevice;
  is_playing: boolean;
  progress_ms: number | null;
  timestamp: number;
  item: (ApiTrack & { type?: string }) | null;
  currently_playing_type?: string;
  repeat_state?: string;
  shuffle_state?: boolean;
};

export const getPlaybackState = () => spFetch<PlaybackState>('/me/player', { query: { additional_types: 'track' } });
export const getDevices = async () => (await spFetch<{ devices: SpotifyDevice[] }>('/me/player/devices'))?.devices ?? [];

export const playTrackUri = (trackId: string, deviceId?: string, positionMs = 0) =>
  spFetch('/me/player/play', {
    method: 'PUT',
    query: { device_id: deviceId },
    body: { uris: [`spotify:track:${trackId}`], position_ms: Math.max(0, Math.round(positionMs)) },
  });
export const resumePlayback = (deviceId?: string) => spFetch('/me/player/play', { method: 'PUT', query: { device_id: deviceId } });
export const pausePlayback = (deviceId?: string) => spFetch('/me/player/pause', { method: 'PUT', query: { device_id: deviceId } });
export const seekPlayback = (ms: number, deviceId?: string) =>
  spFetch('/me/player/seek', { method: 'PUT', query: { position_ms: Math.max(0, Math.round(ms)), device_id: deviceId } });
export const setPlaybackVolume = (percent: number, deviceId?: string) =>
  spFetch('/me/player/volume', { method: 'PUT', query: { volume_percent: Math.round(Math.min(100, Math.max(0, percent))), device_id: deviceId } });
export const transferPlayback = (deviceId: string, play = false) =>
  spFetch('/me/player', { method: 'PUT', body: { device_ids: [deviceId], play } });
