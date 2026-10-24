// A/B: which LRCLIB record does the OLD lookup (main) pick vs the NEW one, and do their timestamps differ?
//   pnpm exec tsx tools/sync-report/lyric_source_ab.ts "Mine" "Bazzi" "COSMIC" 131
//
// OLD = transcription of app/api/lyrics/lookup/route.ts on `main`: exact /get signature first; otherwise a fuzzy search
//       preferring synced and the closest length, refusing anything more than 8 s away.
// NEW = lib/lyrics/match.ts ranking over /get + searches (what the route does today).

import { parseLrc } from '../../lib/lyrics/parse';
import { rankCandidates, type LrclibRecord } from '../../lib/lyrics/match';

const [title = 'Mine', artist = 'Bazzi', album = 'COSMIC', durStr = '131'] = process.argv.slice(2);
const duration = Number(durStr);
const UA = { 'User-Agent': 'Lyricscape-diag' };
const get = async (path: string, p: Record<string, string>) => {
  const u = new URL('https://lrclib.net/api' + path);
  for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: UA });
  return r.ok ? ((await r.json()) as LrclibRecord | LrclibRecord[]) : null;
};

const exact = (await get('/get', { track_name: title, artist_name: artist, album_name: album, duration: String(duration) })) as LrclibRecord | null;
const search = ((await get('/search', { track_name: title, artist_name: artist })) as LrclibRecord[]) ?? [];

// OLD
let oldPick: LrclibRecord | null = exact;
if (!oldPick) {
  const scored = search
    .filter((r) => r.syncedLyrics || r.plainLyrics)
    .map((r) => ({ r, score: (r.syncedLyrics ? 0 : 1000) + (duration && r.duration ? Math.abs(r.duration - duration) : 50) }))
    .sort((a, b) => a.score - b.score);
  const best = scored[0];
  if (best && (!best.r.duration || Math.abs(best.r.duration - duration) <= 8)) oldPick = best.r;
}
// NEW
const newPick = rankCandidates([...(exact ? [exact] : []), ...search], { title, artist, album, duration })[0]?.record ?? null;

const starts = (r: LrclibRecord | null) => (r?.syncedLyrics ? parseLrc(r.syncedLyrics).lines.map((l) => l.startMs) : []);
const describe = (name: string, r: LrclibRecord | null) =>
  console.log(name.padEnd(4), r ? `id ${r.id} | album ${r.albumName} | ${r.duration}s | ${starts(r).length} lines | first cue ${starts(r)[0]} ms | last cue ${starts(r).at(-1)} ms` : 'none');
console.log(`track: ${title} / ${artist} / ${album} / ${duration}s   (exact /get ${exact ? 'hit id ' + exact.id : 'miss'})`);
describe('OLD', oldPick);
describe('NEW', newPick);
const a = starts(oldPick);
const b = starts(newPick);
if (a.length && a.length === b.length) {
  const d = a.map((x, i) => b[i]! - x);
  console.log('per-line difference NEW - OLD (ms): min', Math.min(...d), 'max', Math.max(...d), 'identical lines', d.filter((x) => x === 0).length + '/' + d.length);
} else console.log('different line counts', a.length, b.length);
