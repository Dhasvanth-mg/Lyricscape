// Optional, user-triggered lyrics lookup against LRCLIB (https://lrclib.net), an open,
// community-maintained lyrics API intended for programmatic use. This is NOT page scraping.
// Only title / artist / album / duration are sent. Responses are cached in memory.
//
// LRCLIB can hold several entries per song. We gather candidates (exact signature + fuzzy searches), rank them by
// title / artist / length / synced (lib/lyrics/match.ts) and return the best. `exclude` lets the player ask for
// "another version" when the first one drifts against the listener's copy of the song.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { matchInfoFor, normalizeTitle, primaryArtist, rankCandidates, type LrclibRecord } from '@/lib/lyrics/match';

export const dynamic = 'force-dynamic';

const query = z.object({
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().min(1).max(200),
  album: z.string().trim().max(200).optional(),
  duration: z.coerce.number().int().min(1).max(7200).optional(), // seconds
  exclude: z
    .string()
    .max(200)
    .regex(/^\d+(,\d+)*$/)
    .optional(),
});

const BASE = 'https://lrclib.net/api';
const UA = 'Lyricscape/0.1.0 (local-first dev build; https://github.com/Dhasvanth-mg/Lyricscape)';
const cache = new Map<string, { at: number; body: unknown }>();
const TTL = 24 * 3600 * 1000;

async function lrclib(path: string, params: Record<string, string>): Promise<Response> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    return await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctl.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

async function search(params: Record<string, string>): Promise<LrclibRecord[]> {
  const res = await lrclib('/search', params);
  if (!res.ok) throw new Error(`LRCLIB responded ${res.status}`);
  const body = (await res.json()) as unknown;
  return Array.isArray(body) ? (body as LrclibRecord[]) : [];
}

export async function GET(req: Request) {
  const parsed = query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) {
    return NextResponse.json({ code: 'bad_request', message: 'title and artist are required' }, { status: 400 });
  }
  const { title, artist, album, duration } = parsed.data;
  const exclude = new Set((parsed.data.exclude ?? '').split(',').filter(Boolean).map(Number));
  const key = `${title}|${artist}|${album ?? ''}|${duration ?? ''}|${[...exclude].sort().join(',')}`.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.body);

  const q = { title, artist, album, duration };
  try {
    const records: LrclibRecord[] = [];
    let upstreamFailures = 0;
    // a flaky secondary search must not sink a lookup that already has candidates
    const more = async (params: Record<string, string>) => {
      try {
        records.push(...(await search(params)));
      } catch {
        upstreamFailures++;
      }
    };

    // 1) exact signature lookup (cheapest, usually right)
    const exactParams: Record<string, string> = { track_name: title, artist_name: artist };
    if (album) exactParams.album_name = album;
    if (duration) exactParams.duration = String(duration);
    const exact = await lrclib('/get', exactParams).catch(() => null);
    if (exact?.ok) records.push((await exact.json()) as LrclibRecord);

    // 2) fuzzy searches: cleaned title + artist, then the primary artist alone, then a free-text query
    const cleanTitle = normalizeTitle(title) || title;
    const lead = primaryArtist(artist) || artist;
    const hasSynced = () => rankCandidates(records, q, exclude).some((c) => c.synced);
    await more({ track_name: cleanTitle, artist_name: artist });
    if (!hasSynced()) await more({ track_name: cleanTitle, artist_name: lead });
    if (!hasSynced()) await more({ q: `${lead} ${cleanTitle}` });

    const ranked = rankCandidates(records, q, exclude);
    const best = ranked[0];
    if (!best) {
      if (upstreamFailures && !records.length) throw new Error('LRCLIB unavailable');
      const none = { found: false as const, source: 'LRCLIB (community)' };
      if (!upstreamFailures) cache.set(key, { at: Date.now(), body: none }); // never cache a "not found" caused by an outage
      return NextResponse.json(none);
    }
    const r = best.record;
    const body = {
      found: true as const,
      id: r.id,
      source: 'LRCLIB (community)',
      synced: r.syncedLyrics ?? null,
      plain: r.plainLyrics ?? null,
      /** per-word timing (Lyricsfile YAML), only sent when the record really has it */
      hasWordSync: !!r.hasWordSync,
      lyricsfile: r.hasWordSync ? (r.lyricsfile ?? null) : null,
      match: matchInfoFor(r, q),
      instrumental: false,
      /** how many other synced versions exist (drives the "try another version" button) */
      otherVersions: ranked.slice(1).filter((c) => c.synced).length,
      matched: { title: r.trackName, artist: r.artistName, album: r.albumName ?? null, duration: r.duration ?? null },
    };
    cache.set(key, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (e) {
    console.error('[lyrics/lookup]', e);
    const aborted = (e as Error).name === 'AbortError';
    return NextResponse.json(
      { code: aborted ? 'timeout' : 'upstream_error', message: aborted ? 'Lyrics service timed out.' : 'Lyrics service is unreachable right now.' },
      { status: 502 },
    );
  }
}
