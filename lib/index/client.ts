// Browser side of the song index. One request per song reads everything known (cached in memory for the session); saves are
// batched, so several features learned within half a second go up as one write. If the index is unavailable (an old Node, a failed
// request) every call quietly does nothing: the index is a cache, never something the app waits on.

import { audioFeaturesSchema, type AudioFeatures } from '../analysis/types';
import type { Track } from '../types';
import type { IndexEntry, IndexStats, LyricsFeature, PaletteFeature, PutBody, SongMeta, TempoFeature } from './types';

/** fired on window when the indexer has learned something new about a song (detail: { trackId }) */
export const INDEX_EVENT = 'lyricscape:index';

const entries = new Map<string, Promise<IndexEntry | null>>();
let unavailable = false;

const urlFor = (key: string) => `/api/index/${encodeURIComponent(key)}`;

export const metaOf = (t: Track): SongMeta => ({ provider: t.provider, title: t.title, artists: t.artists.length ? t.artists : ['Unknown'], durationMs: Math.max(1000, Math.round(t.durationMs || 0)) });

/** Everything known about this song (or null). Repeated calls for the same song share one request. */
export function entryFor(track: Track): Promise<IndexEntry | null> {
  if (unavailable || typeof fetch === 'undefined') return Promise.resolve(null);
  const hit = entries.get(track.id);
  if (hit) return hit;
  const m = metaOf(track);
  const qs = new URLSearchParams({ title: m.title, artists: m.artists.join('\n'), duration: String(m.durationMs) });
  const p = fetch(`${urlFor(track.id)}?${qs}`)
    .then(async (r) => {
      if (!r.ok) return null;
      const j = (await r.json()) as { available: boolean; entry: IndexEntry | null };
      if (!j.available) unavailable = true;
      return j.entry;
    })
    .catch(() => null);
  entries.set(track.id, p);
  return p;
}

type Pending = { track: Track; features: PutBody['features']; timer: ReturnType<typeof setTimeout> };
const pending = new Map<string, Pending>();

/** Remember something about a song. Updates the in-memory copy at once and writes soon. */
export function saveFeature<K extends keyof PutBody['features']>(track: Track, kind: K, data: NonNullable<PutBody['features'][K]>): void {
  if (unavailable || typeof fetch === 'undefined') return;
  const prev = entries.get(track.id);
  entries.set(
    track.id,
    (prev ?? Promise.resolve(null)).then((e) => {
      const base: IndexEntry = e ?? { key: track.id, song: { ...metaOf(track), plays: 0, firstSeen: Date.now(), lastSeen: Date.now() }, features: {} };
      return { ...base, features: { ...base.features, [kind]: data }, ...(kind === 'audio' ? { audioVia: undefined } : {}) };
    }),
  );
  let p = pending.get(track.id);
  if (!p) {
    p = { track, features: {}, timer: setTimeout(() => void flush(track.id), 500) };
    pending.set(track.id, p);
  }
  (p.features as Record<string, unknown>)[kind] = data;
}

async function flush(key: string) {
  const p = pending.get(key);
  if (!p) return;
  pending.delete(key);
  try {
    const res = await fetch(urlFor(key), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ song: metaOf(p.track), features: p.features } satisfies PutBody) });
    if (res.status === 503) unavailable = true;
  } catch {
    /* offline or restarting: it will be written the next time the song is learned */
  }
}

/** Write anything still waiting (call when the page is going away or a song ends). */
export async function flushAll(): Promise<void> {
  for (const [k, p] of [...pending]) {
    clearTimeout(p.timer);
    await flush(k);
  }
}

export function countPlay(track: Track): void {
  if (unavailable || typeof fetch === 'undefined') return;
  void fetch(urlFor(track.id), { method: 'POST' }).catch(() => undefined);
}

export async function removeSong(track: Track): Promise<void> {
  entries.delete(track.id);
  if (!unavailable) await fetch(urlFor(track.id), { method: 'DELETE' }).catch(() => undefined);
}

/** Forget one kind of data about a song (the user removed its lyrics, say). */
export async function removeFeature(track: Track, kind: 'audio' | 'palette' | 'lyrics' | 'tempo' | 'tap'): Promise<void> {
  entries.delete(track.id);
  if (!unavailable) await fetch(`${urlFor(track.id)}?kind=${kind}`, { method: 'DELETE' }).catch(() => undefined);
}

export async function fetchStats(): Promise<IndexStats | null> {
  try {
    const r = await fetch('/api/index');
    return r.ok ? ((await r.json()) as IndexStats) : null;
  } catch {
    return null;
  }
}

export async function clearIndex(): Promise<number> {
  entries.clear();
  try {
    const r = await fetch('/api/index?all=1', { method: 'DELETE' });
    return r.ok ? ((await r.json()) as { cleared: number }).cleared : 0;
  } catch {
    return 0;
  }
}

/** Typed helpers over the entry */
export const audioOf = (e: IndexEntry | null): AudioFeatures | null => {
  const a = e?.features.audio;
  return a && audioFeaturesSchema.safeParse(a).success ? a : null;
};
export const paletteOf = (e: IndexEntry | null, artworkUrl: string | null): PaletteFeature | null => {
  const p = e?.features.palette;
  return p && artworkUrl && p.artworkUrl === artworkUrl ? p : null;
};
export const lyricsOf = (e: IndexEntry | null): LyricsFeature | null => e?.features.lyrics ?? null;
export const tempoOf = (e: IndexEntry | null): TempoFeature | null => e?.features.tempo ?? null;
