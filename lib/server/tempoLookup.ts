// Look a song's tempo up online by title and artist. Deezer's public track data carries a `bpm` for many (not all) songs; a missing or
// zero value means "not known", never "slow". Only the title, the artist and the length are sent. The answer is a tempo, not a beat
// grid: the phase still has to come from the lyrics or from a tap.

import { normalizeTitle, primaryArtist } from '../lyrics/match';

export type TempoLookup = { bpm: number; source: 'deezer'; matchedTitle: string; matchedArtist: string };

type DeezerTrack = { id: number; title: string; title_short?: string; duration: number; artist?: { name: string } };

const BASE = 'https://api.deezer.com';
const cache = new Map<string, { at: number; value: TempoLookup | null }>();
const TTL_MS = 24 * 3600_000;

const VERSIONY = /\b(remix|live|karaoke|tribute|cover|instrumental|made famous|sped up|slowed|reverb|8d|nightcore|acoustic)\b/i;

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Lyricscape/0.1 (local-first dev build)' }, signal: AbortSignal.timeout(6000) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Pick the search results that are plausibly the same recording (same title and artist, about the same length, not a remix or a live take unless ours is). */
export function candidatesFor(results: DeezerTrack[], title: string, artist: string, durationSec: number | null): DeezerTrack[] {
  const nt = normalizeTitle(title);
  const na = primaryArtist(artist);
  const wantsVersion = VERSIONY.test(title);
  return results
    .filter((r) => {
      const rt = normalizeTitle(r.title_short ?? r.title);
      const full = normalizeTitle(r.title);
      if (rt !== nt && full !== nt) return false;
      if (!wantsVersion && VERSIONY.test(r.title)) return false;
      const ra = primaryArtist(r.artist?.name ?? '');
      if (!ra || (ra !== na && !ra.includes(na) && !na.includes(ra))) return false;
      return durationSec === null || Math.abs(r.duration - durationSec) <= 4;
    })
    .sort((a, b) => (durationSec === null ? 0 : Math.abs(a.duration - durationSec) - Math.abs(b.duration - durationSec)))
    .slice(0, 3);
}

export async function lookupTempo(title: string, artist: string, durationSec: number | null): Promise<TempoLookup | null> {
  const key = `${normalizeTitle(title)}|${primaryArtist(artist)}|${durationSec === null ? '' : Math.round(durationSec / 2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  let value: TempoLookup | null = null;
  const q = encodeURIComponent(`${primaryArtist(artist)} ${normalizeTitle(title)}`);
  const found = await getJson<{ data?: DeezerTrack[] }>(`${BASE}/search?q=${q}&limit=10`);
  for (const c of candidatesFor(found?.data ?? [], title, artist, durationSec)) {
    const t = await getJson<{ bpm?: number }>(`${BASE}/track/${c.id}`);
    if (t && typeof t.bpm === 'number' && t.bpm >= 40 && t.bpm <= 260) {
      value = { bpm: Math.round(t.bpm * 100) / 100, source: 'deezer', matchedTitle: c.title, matchedArtist: c.artist?.name ?? '' };
      break;
    }
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), value });
  return value;
}
