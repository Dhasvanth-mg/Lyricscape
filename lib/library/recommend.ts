// Home-page recommendations: a pure, deterministic ranking of songs the person can already play
// (demo songs, their files, playlist songs, Spotify saved songs) against what they played on this
// device. No server, no account data leaves the browser. Every pick carries the reason it was made.

import type { Track } from '../types';

export type PlayRecord = { track: Track; plays: number; lastPlayedAt: number };

export type Recommendation = { track: Track; reason: string; score: number };

const DAY = 24 * 60 * 60 * 1000;
const MAX_HISTORY = 50;

/** Add one play to the history, newest first, capped. Returns a new array. */
export function addPlay(history: PlayRecord[], track: Track, at: number, max = MAX_HISTORY): PlayRecord[] {
  const prev = history.find((r) => r.track.id === track.id);
  const rest = history.filter((r) => r.track.id !== track.id);
  return [{ track, plays: (prev?.plays ?? 0) + 1, lastPlayedAt: at }, ...rest].slice(0, max);
}

/** Recent plays count more: weight halves every three days. */
const recency = (r: PlayRecord, now: number) => r.plays * 0.5 ** (Math.max(0, now - r.lastPlayedAt) / (3 * DAY));

const norm = (s: string) => s.trim().toLowerCase();

type Signal = { score: number; reason: string };

export function recommend(pool: Track[], history: PlayRecord[], opts: { now: number; withLyrics?: ReadonlySet<string>; limit?: number }): Recommendation[] {
  const { now, withLyrics = new Set<string>(), limit = 12 } = opts;
  const unique = [...new Map(pool.map((t) => [t.id, t])).values()];
  const played = new Map(history.map((r) => [r.track.id, r]));
  const lastFew = new Set(history.slice(0, 3).map((r) => r.track.id));

  // What the person has been listening to, weighted by recency.
  const artistWeight = new Map<string, { w: number; from: string }>();
  const genreWeight = new Map<string, number>();
  let bpmSum = 0;
  let bpmW = 0;
  let anchor: PlayRecord | undefined;
  for (const r of history) {
    const w = recency(r, now);
    if (!anchor || w > recency(anchor, now)) anchor = r;
    for (const a of r.track.artists) {
      const k = norm(a);
      const cur = artistWeight.get(k);
      if (!cur || w > cur.w) artistWeight.set(k, { w: (cur?.w ?? 0) + w, from: r.track.title });
      else cur.w += w;
    }
    for (const g of r.track.genres ?? []) genreWeight.set(norm(g), (genreWeight.get(norm(g)) ?? 0) + w);
    if (r.track.bpm) {
      bpmSum += r.track.bpm * w;
      bpmW += w;
    }
  }
  const avgBpm = bpmW > 0 ? bpmSum / bpmW : null;
  const maxArtist = Math.max(0, ...[...artistWeight.values()].map((v) => v.w));
  const maxGenre = Math.max(0, ...genreWeight.values());

  const scored = unique.map((track): Recommendation => {
    const signals: Signal[] = [];
    if (history.length === 0) {
      signals.push({ score: 0.3, reason: track.provider === 'demo' ? 'A good first song' : track.provider === 'licensed' ? 'From your files' : 'From your library' });
    } else {
      const artist = track.artists.map((a) => artistWeight.get(norm(a))).find(Boolean);
      if (artist && maxArtist > 0) signals.push({ score: 3 * (artist.w / maxArtist), reason: `Same artist as ${artist.from}` });
      const genre = (track.genres ?? []).map((g) => [g, genreWeight.get(norm(g)) ?? 0] as const).sort((a, b) => b[1] - a[1])[0];
      if (genre && genre[1] > 0 && maxGenre > 0) signals.push({ score: 2 * (genre[1] / maxGenre), reason: `More ${genre[0]}` });
      if (avgBpm && track.bpm) {
        const close = 1 - Math.min(1, Math.abs(track.bpm - avgBpm) / 30);
        if (close > 0) signals.push({ score: 1.5 * close, reason: `Close to your ${Math.round(avgBpm)} BPM pace` });
      }
      const rec = played.get(track.id);
      if (!rec) signals.push({ score: 1, reason: 'New to you' });
      else if (now - rec.lastPlayedAt > 7 * DAY) signals.push({ score: 0.8, reason: 'Not played in a while' });
      if (lastFew.has(track.id)) signals.push({ score: -5, reason: '' });
    }
    if (withLyrics.has(track.id) || track.lyricsUrl) signals.push({ score: 0.5, reason: 'Lyrics ready' });
    const score = signals.reduce((s, x) => s + x.score, 0);
    const best = signals.filter((s) => s.reason).sort((a, b) => b.score - a.score)[0];
    return { track, score, reason: best?.reason ?? 'From your library' };
  });

  return scored.sort((a, b) => b.score - a.score || a.track.id.localeCompare(b.track.id)).slice(0, limit);
}

/** Tiles for the top of the home page: most-played recent songs first, then songs to start with. */
export function quickPicks(history: PlayRecord[], pool: Track[], now: number, count = 8): Track[] {
  const recent = [...history].sort((a, b) => recency(b, now) - recency(a, now)).map((r) => r.track);
  const seen = new Set(recent.map((t) => t.id));
  return [...recent, ...pool.filter((t) => !seen.has(t.id))].filter((t, i, all) => all.findIndex((x) => x.id === t.id) === i).slice(0, count);
}
