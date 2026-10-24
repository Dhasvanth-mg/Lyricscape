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
import { parseLrc } from './parse';
import { soundsAlike } from './translit';

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
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ') // marks are kept: Devanagari / Tamil vowel signs are \p{M}
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
    // the same name in another script or spelling (Kesariya / केसरिया / Kesaria): compare by sound
    const snd = qt && rt ? soundsAlike(qt, rt) : 0;
    if (j >= 0.5) title = j * 20;
    else if (snd >= 0.78 && Math.min(qt.length, rt.length) >= 3) title = 14 + snd * 12;
    else return null;
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
    const snd = soundsAlike(qa, ra);
    if (j >= 0.34) artist = j * 20;
    else if (snd >= 0.75) artist = 12 + snd * 10;
    else return null;
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

/** A version this far from where independent versions agree is a different edit or a mis-timed copy (seen: 3.7-3.8 s on "Mine"). */
export const OUTLIER_OFFSET_MS = 1500;
const OUTLIER_PENALTY = 60;
const AGREE_MS = 300;

/**
 * Ids of synced records whose timing disagrees with the rest. Most LRCLIB entries of a song are copies of one timing, so only
 * DISTINCT timings count as opinions; a record is an outlier when at least two other distinct timings agree with each other
 * (within 300 ms) and this one is more than 1.5 s from them. With fewer opinions nothing is called an outlier.
 */
export function timingOutlierIds(records: LrclibRecord[]): Set<number> {
  const rows = records.filter((r) => r.syncedLyrics).map((r) => ({ id: r.id, starts: parseLrc(r.syncedLyrics!).lines.map((l) => l.startMs) })).filter((r) => r.starts.length > 0);
  const lens = new Map<number, number>();
  for (const r of rows) lens.set(r.starts.length, (lens.get(r.starts.length) ?? 0) + 1);
  const modal = [...lens.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const out = new Set<number>();
  if (modal === undefined) return out;
  const group = rows.filter((r) => r.starts.length === modal);
  const distinct = new Map<string, number[]>();
  for (const r of group) distinct.set(r.starts.join(','), r.starts);
  if (distinct.size < 3) return out;
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1]!;
  const ref = Array.from({ length: modal }, (_, i) => med([...distinct.values()].map((s) => s[i]!)));
  const offset = (s: number[]) => med(s.map((x, i) => x - ref[i]!));
  const agreeing = [...distinct.values()].filter((s) => Math.abs(offset(s)) <= AGREE_MS);
  if (agreeing.length < 2) return out;
  for (const r of group) if (Math.abs(offset(r.starts)) > OUTLIER_OFFSET_MS) out.add(r.id);
  return out;
}

export function rankCandidates(records: LrclibRecord[], q: Query, exclude: ReadonlySet<number> = new Set()): Ranked[] {
  const seen = new Set<number>();
  const out: Ranked[] = [];
  const outliers = timingOutlierIds(records);
  for (const record of records) {
    if (seen.has(record.id) || exclude.has(record.id)) continue;
    seen.add(record.id);
    const score = scoreCandidate(record, q);
    if (score !== null) out.push({ record, score: score - (outliers.has(record.id) ? OUTLIER_PENALTY : 0), synced: !!record.syncedLyrics });
  }
  return out.sort((a, b) => b.score - a.score);
}
