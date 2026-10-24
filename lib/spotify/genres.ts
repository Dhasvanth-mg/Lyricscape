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
    try {
      const data = await spFetch<{ artists?: ({ id: string; genres?: string[] } | null)[] }>('/artists', { query: { ids: missing.join(',') } });
      for (const a of data?.artists ?? []) {
        if (!a) continue;
        mem.set(a.id, a.genres ?? []);
        void kvSet(`genres:${a.id}`, a.genres ?? []);
      }
    } catch {
      /* no genres: the theme falls back to the other signals */
    }
  }
  return [...new Set(ids.flatMap((id) => mem.get(id) ?? []))];
}
