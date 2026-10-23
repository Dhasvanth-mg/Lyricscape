// Picking the right lyrics record for a track. LRCLIB often holds several entries per song (remasters, live cuts,
// different edits, wrong metadata); the right one has the same title + artist, a near-identical length (that is
// what keeps the timing in step with YOUR copy of the song), and synced timestamps.

export type LrclibRecord = {
  id: number;
  trackName: string;
  artistName: string;
  albumName?: string | null;
  duration?: number | null;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
  /** LRCLIB: true when any line of the Lyricsfile carries per-word times */
  hasWordSync?: boolean;
  lyricsfile?: string | null;
};

/** Synced lyrics from a recording this far off in length would drift by about as much by the end: not the same edit. */
export const MAX_SYNCED_DURATION_DELTA_SEC = 5;
/** Plain text carries no timing, so a looser length match is harmless. */
export const MAX_PLAIN_DURATION_DELTA_SEC = 10;

import type { MatchInfo } from '../types';

export type Query = { title: string; artist: string; album?: string; duration?: number };

const DIACRITICS = /[̀-ͯ]/g;
const NOISE =
  /\s*[([][^)\]]*\b(remaster(ed)?|live|version|mono|stereo|feat\.?|ft\.?|featuring|edit|mix|deluxe|bonus|acoustic|radio|single|explicit|from\b)[^)\]]*[)\]]/gi;

/** "Blinding Lights - Remastered 2019 (feat. X)" -> "blinding lights" */
export function normalizeTitle(t: string): string {
  return t
    .normalize('NFKD')
    .replace(DIACRITICS, '')
    .replace(NOISE, '')
    .replace(/\s+[-–—]\s+(remaster(ed)?|live|single|radio|mono|stereo|acoustic|from)\b.*$/i, '')
    .replace(/\b(feat\.?|ft\.?|featuring)\s.*$/i, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "Drake, Future" / "A & B" / "A feat. B" / "A x B" -> "drake" */
export function primaryArtist(a: string): string {
  const first = a.split(/\s*(?:,|&|\band\b|\bfeat\.?\b|\bft\.?\b|\bfeaturing\b|\bx\b|;|\/)\s*/i)[0] ?? a;
  return normalizeTitle(first);
}

const tokens = (s: string) => new Set(s.split(' ').filter(Boolean));
function jaccard(a: string, b: string): number {
  const x = tokens(a);
  const y = tokens(b);
  if (!x.size || !y.size) return 0;
  let inter = 0;
  for (const t of x) if (y.has(t)) inter++;
  return inter / (x.size + y.size - inter);
}

export type Ranked = { record: LrclibRecord; score: number; synced: boolean };

/** null = not the same recording at all. */
export function scoreCandidate(r: LrclibRecord, q: Query): number | null {
  if (r.instrumental) return null;
  if (!r.syncedLyrics && !r.plainLyrics) return null;

  const qt = normalizeTitle(q.title);
  const rt = normalizeTitle(r.trackName);
  let title: number;
  if (qt === rt) title = 40;
  else if (qt && rt && (qt.includes(rt) || rt.includes(qt)) && Math.min(qt.length, rt.length) >= 4) title = 24;
  else {
    const j = jaccard(qt, rt);
    if (j < 0.5) return null;
    title = j * 20;
  }

  const qa = primaryArtist(q.artist);
  const ra = primaryArtist(r.artistName);
  const qaFull = normalizeTitle(q.artist);
  const raFull = normalizeTitle(r.artistName);
  let artist: number;
  if (!qa || !ra) artist = 8;
  else if (qa === ra) artist = 30;
  else if (qaFull.includes(ra) || raFull.includes(qa) || qa.includes(ra) || ra.includes(qa)) artist = 22;
  else {
    const j = jaccard(qaFull, raFull);
    if (j < 0.34) return null;
    artist = j * 20;
  }

  let duration = 6; // unknown length on either side: neutral
  if (q.duration && r.duration) {
    const d = Math.abs(q.duration - r.duration);
    if (d > (r.syncedLyrics ? MAX_SYNCED_DURATION_DELTA_SEC : MAX_PLAIN_DURATION_DELTA_SEC)) return null; // a different edit / live cut: timing would drift
    duration = d <= 1 ? 20 : d <= 3 ? 14 : d <= 6 ? 6 : 0;
  }

  const album = q.album && r.albumName && normalizeTitle(q.album) === normalizeTitle(r.albumName) ? 4 : 0;
  // word timing is a tie-breaker between equally good recordings, never a reason to accept a worse match
  return title + artist + duration + album + (r.syncedLyrics ? 25 : 0) + (r.hasWordSync ? 5 : 0);
}

/** How good the chosen recording is, stored with the lyrics so the UI can say so honestly. */
export function matchInfoFor(r: LrclibRecord, q: Query): MatchInfo {
  const delta = q.duration && r.duration ? Math.abs(q.duration - r.duration) : null;
  return {
    provider: 'lrclib',
    recordId: r.id,
    titleExact: normalizeTitle(q.title) === normalizeTitle(r.trackName),
    artistExact: primaryArtist(q.artist) === primaryArtist(r.artistName),
    albumMatch: !!q.album && !!r.albumName && normalizeTitle(q.album) === normalizeTitle(r.albumName),
    durationDeltaSec: delta === null ? null : Math.round(delta * 10) / 10,
    verdict: delta === null ? 'unknown' : delta <= 2 ? 'exact' : 'close',
  };
}

export function rankCandidates(records: LrclibRecord[], q: Query, exclude: ReadonlySet<number> = new Set()): Ranked[] {
  const seen = new Set<number>();
  const out: Ranked[] = [];
  for (const record of records) {
    if (seen.has(record.id) || exclude.has(record.id)) continue;
    seen.add(record.id);
    const score = scoreCandidate(record, q);
    if (score !== null) out.push({ record, score, synced: !!record.syncedLyrics });
  }
  return out.sort((a, b) => b.score - a.score);
}
