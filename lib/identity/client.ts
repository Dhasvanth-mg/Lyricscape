'use client';

// Browser-side gathering of identity evidence that is not already on the track: genre tags and the optional AI reading.
// Everything is best effort and cached; a failure just means that signal stays unknown.

import type { LyricDocument, Track } from '../types';
import { kvGet, kvSet } from '../library/db';
import { genresForTrack } from '../spotify/genres';
import { aiCacheKey, AI_MAX_LYRIC_CHARS, type AiProfile } from './ai';
import type { GenreTag } from './types';

const DAY = 24 * 3600 * 1000;
const mem = new Map<string, GenreTag[]>();

type MbTags = { at: number; tags: { name: string; count: number }[] };

async function musicBrainzTags(artist: string): Promise<GenreTag[]> {
  const k = artist.toLowerCase();
  if (mem.has(k)) return mem.get(k)!;
  let rec = await kvGet<MbTags>(`mb:${k}`);
  if (!rec || Date.now() - rec.at > 30 * DAY) {
    try {
      const res = await fetch(`/api/meta/genres?artist=${encodeURIComponent(artist)}`);
      if (res.ok) {
        const data = (await res.json()) as { tags?: { name: string; count: number }[] };
        rec = { at: Date.now(), tags: data.tags ?? [] };
        await kvSet(`mb:${k}`, rec);
      }
    } catch {
      /* offline: no tags */
    }
  }
  const tags = rec?.tags ?? [];
  const max = Math.max(1, ...tags.map((t) => t.count));
  // votes -> weight: a tag with a single vote is a weak hint, the top tag is strong
  const out: GenreTag[] = tags.filter((t) => t.count >= 1).map((t) => ({ tag: t.name, weight: Math.round((0.25 + 0.6 * (t.count / max)) * 100) / 100, source: 'musicbrainz' }));
  mem.set(k, out);
  return out;
}

/**
 * The genre evidence for a track, strongest source first: tags on the track itself, then Spotify's artist genres, and only when
 * neither exists (and the listener allows online lookups) MusicBrainz's community tags for the first artist.
 */
export async function tagsForTrack(track: Track, opts: { online: boolean }): Promise<GenreTag[]> {
  const own = (track.genres ?? []).map((tag) => ({ tag, weight: 0.9, source: 'track' as const }));
  if (own.length) return own;
  const spotify = (await genresForTrack(track).catch(() => [])).map((tag) => ({ tag, weight: 0.8, source: 'spotify' as const }));
  if (spotify.length) return spotify;
  if (!opts.online || track.provider === 'demo') return [];
  const artist = track.artists[0];
  return artist ? musicBrainzTags(artist) : [];
}

let aiUnavailable = false;

/** The AI reading of the lyric text, from the cache or (once) from the gateway. null = not available. */
export async function interpretSong(track: Track, doc: LyricDocument, tags: GenreTag[]): Promise<AiProfile | null> {
  const text = doc.lines.map((l) => l.words.map((w) => w.text).join(' ')).join('\n').slice(0, AI_MAX_LYRIC_CHARS);
  if (text.length < 80) return null;
  const key = aiCacheKey(track.id, text, 'v1');
  const cached = await kvGet<AiProfile>(key);
  if (cached) return cached;
  if (aiUnavailable) return null;
  try {
    const res = await fetch('/api/identity/interpret', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: track.title, artist: track.artists.join(', '), tags: tags.map((t) => t.tag).slice(0, 10), lyrics: text }) });
    if (res.status === 501) {
      aiUnavailable = true;
      return null;
    }
    if (!res.ok) return null;
    const { profile } = (await res.json()) as { profile?: AiProfile };
    if (!profile) return null;
    await kvSet(key, profile);
    return profile;
  } catch {
    return null;
  }
}
