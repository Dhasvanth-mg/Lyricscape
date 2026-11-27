'use client';

// Genre tags for the theme picker. Spotify has no audio features for apps like this one, but artist objects carry genre
// tags. Best effort: any failure (offline, rate limit, endpoint changed) just means "no genre", never an error.

import type { Track } from '../types';
import { kvGet, kvSet } from '../library/db';
import { spFetch } from './api';

const mem = new Map<string, string[]>();

export async function genresForTrack(track: Track): Promise<string[]> {
  if (track.genres?.length) return track.genres;
  if (track.provider !== 'spotify') return [];
  const ids = (track.artistIds ?? []).slice(0, 3);
  if (!ids.length) return [];
  const missing: string[] = [];
  for (const id of ids) {
    if (mem.has(id)) continue;
    const stored = await kvGet<string[]>(`genres:${id}`).catch(() => undefined);
    if (stored) mem.set(id, stored);
    else missing.push(id);
  }
  if (missing.length) {
    // One request per artist: Spotify removed the batch GET /artists?ids= for Development Mode apps in Feb 2026.
    await Promise.all(
      missing.map(async (id) => {
        try {
          const a = await spFetch<{ id: string; genres?: string[] }>(`/artists/${encodeURIComponent(id)}`);
          if (!a) return;
          mem.set(id, a.genres ?? []);
          void kvSet(`genres:${id}`, a.genres ?? []);
        } catch {
          /* no genres: the theme falls back to the other signals */
        }
      }),
    );
  }
  return [...new Set(ids.flatMap((id) => mem.get(id) ?? []))];
}
