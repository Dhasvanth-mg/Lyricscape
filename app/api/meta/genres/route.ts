// Genre tags for an artist from MusicBrainz (https://musicbrainz.org), an open music encyclopedia with a public API.
// Used only as a fallback when the track carries no genre tags (no Spotify, or an artist Spotify has no genres for).
// Only the artist NAME is sent. The tags are community-voted: the vote count travels with them so the app can treat a tag with
// 21 votes differently from one with 1. Results are cached; requests are spaced to respect MusicBrainz's 1 request / second.

import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const query = z.object({ artist: z.string().trim().min(1).max(120) });
const UA = 'Lyricscape/0.1.0 (local-first dev build; https://github.com/Dhasvanth-mg/Lyricscape)';
const TTL = 7 * 24 * 3600 * 1000;
const cache = new Map<string, { at: number; body: { artist: string; tags: { name: string; count: number }[] } }>();
let chain: Promise<unknown> = Promise.resolve();
let lastAt = 0;

/** One request at a time, at least 1.1 s apart. */
function spaced<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = Math.max(0, lastAt + 1100 - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastAt = Date.now();
    return fn();
  });
  chain = run.catch(() => undefined);
  return run;
}

export async function GET(req: Request) {
  const parsed = query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ code: 'bad_request', message: 'artist is required' }, { status: 400 });
  const artist = parsed.data.artist;
  const key = artist.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return NextResponse.json(hit.body);
  try {
    const body = await spaced(async () => {
      const url = new URL('https://musicbrainz.org/ws/2/artist/');
      url.searchParams.set('query', `artist:"${artist.replace(/"/g, '')}"`);
      url.searchParams.set('fmt', 'json');
      url.searchParams.set('limit', '3');
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 7000);
      try {
        const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctl.signal, cache: 'no-store' });
        if (!res.ok) throw new Error(`MusicBrainz responded ${res.status}`);
        const data = (await res.json()) as { artists?: { name: string; score?: number; tags?: { name: string; count: number }[] }[] };
        const found = (data.artists ?? []).find((a) => a.name.toLowerCase() === key && (a.score ?? 0) >= 90) ?? (data.artists ?? []).find((a) => (a.score ?? 0) >= 98);
        return { artist, tags: (found?.tags ?? []).sort((a, b) => b.count - a.count).slice(0, 12).map((t) => ({ name: t.name, count: t.count })) };
      } finally {
        clearTimeout(timer);
      }
    });
    cache.set(key, { at: Date.now(), body });
    if (cache.size > 500) cache.delete(cache.keys().next().value as string);
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json({ code: 'upstream', message: e instanceof Error ? e.message : 'lookup failed' }, { status: 502 });
  }
}
