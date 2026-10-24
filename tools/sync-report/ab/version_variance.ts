// How much do the LRCLIB versions of the SAME song disagree about timing? (real data, songs in the genres this app is used for)
//   pnpm exec tsx tools/sync-report/ab/version_variance.ts
//
// For each song: every synced LRCLIB record whose line count matches the most common line count (so lines can be paired
// by index). Per record: the median difference of its line starts from the group's per-line median, in ms.
// Records that are byte-identical copies are counted once (copies are not independent opinions).

import { parseLrc } from '../../../lib/lyrics/parse';

const songs: [string, string][] = [
  ['Mine', 'Bazzi'], ['HUMBLE.', 'Kendrick Lamar'], ['Money Trees', 'Kendrick Lamar'], ['Alright', 'Kendrick Lamar'], ['Swimming Pools (Drank)', 'Kendrick Lamar'],
  ["God's Plan", 'Drake'], ['Hotline Bling', 'Drake'], ['One Dance', 'Drake'], ['Marvins Room', 'Drake'],
  ['Thinkin Bout You', 'Frank Ocean'], ['Nights', 'Frank Ocean'], ['Self Control', 'Frank Ocean'], ['Pink + White', 'Frank Ocean'], ['Ivy', 'Frank Ocean'],
  ['Do I Wanna Know?', 'Arctic Monkeys'], ['505', 'Arctic Monkeys'], ['R U Mine?', 'Arctic Monkeys'], ['Fluorescent Adolescent', 'Arctic Monkeys'], ['Why’d You Only Call Me When You’re High?', 'Arctic Monkeys'],
  ['Nanchaku', 'Seedhe Maut'], ['Namastute', 'Seedhe Maut'], ['Khatta Flow', 'Seedhe Maut'],
  ['Blinding Lights', 'The Weeknd'], ['Redbone', 'Childish Gambino'], ['Location', 'Khalid'], ['Ocean Eyes', 'Billie Eilish'],
];

type Rec = { id: number; trackName: string; artistName: string; duration: number | null; syncedLyrics: string | null };
const med = (a: number[]) => [...a].sort((x, y) => x - y)[a.length >> 1]!;
const all: { song: string; records: number; independent: number; spreadMs: number; withinMs200: number; first: number[] }[] = [];

for (const [title, artist] of songs) {
  let recs: Rec[] = [];
  try {
    const u = new URL('https://lrclib.net/api/search');
    u.searchParams.set('track_name', title);
    u.searchParams.set('artist_name', artist);
    const r = await fetch(u, { headers: { 'User-Agent': 'Lyricscape-diag' } });
    recs = r.ok ? ((await r.json()) as Rec[]) : [];
  } catch {
    /* network */
  }
  const synced = recs.filter((r) => r.syncedLyrics && r.artistName.toLowerCase().includes(artist.split(' ')[0]!.toLowerCase()) && r.trackName.toLowerCase().replace(/[^a-z0-9]/g, '').startsWith(title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5)));
  if (synced.length < 2) {
    console.log(title.padEnd(40), `${synced.length} synced records: skipped`);
    continue;
  }
  const parsed = synced.map((r) => ({ id: r.id, text: r.syncedLyrics!, starts: parseLrc(r.syncedLyrics!).lines.map((l) => l.startMs) }));
  // collapse byte-identical timing (copies)
  const uniq = new Map<string, (typeof parsed)[number]>();
  for (const p of parsed) uniq.set(p.starts.join(','), p);
  const counts = new Map<number, number>();
  for (const p of uniq.values()) counts.set(p.starts.length, (counts.get(p.starts.length) ?? 0) + 1);
  const modeLen = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  const group = [...uniq.values()].filter((p) => p.starts.length === modeLen);
  if (group.length < 2) {
    console.log(title.padEnd(40), `${synced.length} records, ${uniq.size} distinct timings, none comparable by line index`);
    continue;
  }
  const perLine = Array.from({ length: modeLen }, (_, i) => med(group.map((g) => g.starts[i]!)));
  const offsets = group.map((g) => med(g.starts.map((s, i) => s - perLine[i]!)));
  const spread = Math.max(...offsets) - Math.min(...offsets);
  const within = offsets.filter((o) => Math.abs(o) <= 200).length;
  all.push({ song: `${artist} - ${title}`, records: synced.length, independent: group.length, spreadMs: spread, withinMs200: within, first: group.map((g) => g.starts[0]!) });
  console.log(`${(artist + ' - ' + title).padEnd(52)} records ${String(synced.length).padStart(2)} | distinct timings ${String(uniq.size).padStart(2)} | comparable ${String(group.length).padStart(2)} | version offsets ${offsets.map((o) => Math.round(o)).sort((a, b) => a - b).join(', ')} ms`);
}
const spreads = all.map((a) => a.spreadMs).sort((a, b) => a - b);
console.log(`\nsongs compared: ${all.length}`);
if (spreads.length) console.log(`spread between the earliest and latest distinct version of the same song: median ${spreads[spreads.length >> 1]} ms, max ${spreads.at(-1)} ms; songs where versions disagree by >500 ms: ${spreads.filter((s) => s > 500).length}, by >1000 ms: ${spreads.filter((s) => s > 1000).length}`);
