// Real LRC timestamps (LRCLIB) vs human-annotated vocal onsets, for annotated songs that also exist in LRCLIB.
//   pnpm exec tsx tools/sync-report/ab/lrc_vs_annotation.ts
import { readFileSync } from 'node:fs';
import { parseLrc } from '../../../lib/lyrics/parse';

const meta = readFileSync(new URL('../../aligner/data/en_metadata.jsonl', import.meta.url), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as { artist: string; title: string; file_name: string });
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
let found = 0;
const allOffsets: number[] = [];
for (const m of meta) {
  const name = m.file_name.replace(/^.*\//, '').replace(/\.mp3$/, '');
  let hit: { id: number; syncedLyrics: string | null; duration: number | null } | null = null;
  for (const q of [{ track_name: m.title, artist_name: m.artist }, { q: `${m.artist} ${m.title}` }]) {
    const u = new URL('https://lrclib.net/api/search');
    for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'Lyricscape-diag' } });
      const arr = r.ok ? ((await r.json()) as { id: number; trackName: string; artistName: string; syncedLyrics: string | null; duration: number | null }[]) : [];
      hit = arr.find((x) => x.syncedLyrics && norm(x.trackName).includes(norm(m.title).slice(0, 8)) && norm(x.artistName).includes(norm(m.artist).slice(0, 5))) ?? null;
    } catch {
      /* ignore */
    }
    if (hit) break;
  }
  console.log(`${(m.artist + ' - ' + m.title).slice(0, 52).padEnd(52)} ${hit ? 'LRCLIB synced record ' + hit.id : 'not in LRCLIB'}`);
  if (!hit) continue;
  found++;
  // pair LRC lines with annotated lines by order
  const rows = readFileSync(new URL(`../../aligner/data/words/${name}.csv`, import.meta.url), 'utf8').trim().split(/\r?\n/).slice(1).map((r) => {
    const [s, , le] = r.split(',');
    return { s: Number(s) * 1000, lineEnd: le !== '' && le !== 'nan' };
  });
  const annotated: number[] = [];
  let first = true;
  rows.forEach((r) => {
    if (first) annotated.push(r.s);
    first = r.lineEnd;
  });
  const lrc = parseLrc(hit.syncedLyrics!).lines.map((l) => l.startMs);
  if (lrc.length !== annotated.length) {
    console.log(`   line counts differ (LRC ${lrc.length}, annotated ${annotated.length}): not comparable by index`);
    continue;
  }
  const d = lrc.map((x, i) => x - annotated[i]!).sort((a, b) => a - b);
  allOffsets.push(...d);
  console.log(`   LRC minus annotation (ms): median ${d[d.length >> 1]}, p10 ${d[Math.floor(d.length * 0.1)]}, p90 ${d[Math.floor(d.length * 0.9)]}  (n=${d.length})`);
}
console.log(`\n${found} of ${meta.length} annotated songs exist in LRCLIB with synced lyrics; comparable lines: ${allOffsets.length}`);
