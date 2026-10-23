// Optional, user-triggered lyrics lookup against LRCLIB (https://lrclib.net), an open,
// community-maintained lyrics API intended for programmatic use. This is NOT page scraping.
// Only title / artist / album / duration are sent. Responses are cached in memory.

import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const query = z.object({
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().min(1).max(200),
  album: z.string().trim().max(200).optional(),
  duration: z.coerce.number().int().min(1).max(7200).optional(), // seconds
});

type Lrclib = {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
};

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

function cleanTitle(t: string) {
  return t
    .replace(/\s*[\(\[][^)\]]*(remaster|live|version|mono|stereo|feat\.?|ft\.?|edit|mix)[^)\]]*[\)\]]/gi, '')
    .replace(/\s+-\s+(remaster(ed)?|live|single version|radio edit).*$/i, '')
    .trim();
}

export async function GET(req: Request) {
  const parsed = query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) {
    return NextResponse.json({ code: 'bad_request', message: 'title and artist are required' }, { status: 400 });
  }
  const { title, artist, album, duration } = parsed.data;
  const key = `${title}|${artist}|${album ?? ''}|${duration ?? ''}`.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.body);

  const shape = (r: Lrclib) => ({
    found: true as const,
    source: 'LRCLIB (community)',
    synced: r.syncedLyrics ?? null,
    plain: r.plainLyrics ?? null,
    instrumental: !!r.instrumental,
    matched: { title: r.trackName, artist: r.artistName, album: r.albumName ?? null, duration: r.duration ?? null },
  });

  try {
    // 1) exact signature lookup
    const exactParams: Record<string, string> = { track_name: title, artist_name: artist };
    if (album) exactParams.album_name = album;
    if (duration) exactParams.duration = String(duration);
    let res = await lrclib('/get', exactParams);
    if (res.ok) {
      const body = shape((await res.json()) as Lrclib);
      cache.set(key, { at: Date.now(), body });
      return NextResponse.json(body);
    }
    // 404 (and transient 5xx on the exact endpoint) fall through to the fuzzy search below.

    // 2) fuzzy search with a cleaned title, prefer synced + closest duration
    res = await lrclib('/search', { track_name: cleanTitle(title), artist_name: artist });
    if (!res.ok) throw new Error(`LRCLIB responded ${res.status}`);
    const results = (await res.json()) as Lrclib[];
    const scored = results
      .filter((r) => r.syncedLyrics || r.plainLyrics)
      .map((r) => ({
        r,
        score: (r.syncedLyrics ? 0 : 1000) + (duration && r.duration ? Math.abs(r.duration - duration) : 50),
      }))
      .sort((a, b) => a.score - b.score);
    const best = scored[0];
    // refuse wildly different recordings (e.g. a 4-minute track matched to a 9-minute live cut)
    if (best && (!duration || !best.r.duration || Math.abs(best.r.duration - duration) <= 8)) {
      const body = shape(best.r);
      cache.set(key, { at: Date.now(), body });
      return NextResponse.json(body);
    }
    const none = { found: false as const, source: 'LRCLIB (community)' };
    cache.set(key, { at: Date.now(), body: none });
    return NextResponse.json(none);
  } catch (e) {
    console.error("[lyrics/lookup]", e);
    const aborted = (e as Error).name === "AbortError";
    return NextResponse.json(
      { code: aborted ? 'timeout' : 'upstream_error', message: aborted ? 'Lyrics service timed out.' : 'Lyrics service is unreachable right now.' },
      { status: 502 },
    );
  }
}
