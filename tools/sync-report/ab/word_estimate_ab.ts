// OLD vs NEW treatment of LINE-synced lyrics, scored against the human word annotations (JamendoLyrics, 20 songs).
//   pnpm exec tsx tools/sync-report/ab/word_estimate_ab.ts      (needs tools/aligner/data, see tools/aligner/README.md)
//
// For each song an LRC is built the way LRCLIB delivers one (exact line starts, no end cue = typical). Each treatment
// then decides when every WORD appears:
//   OLD  main's parseLrc: words spread by syllable weight across min(next line, start + max(1.2 s, 650 ms/word))
//   NEW  current parseLrc + the default presentation: the whole line at once (40 ms stagger), no word timing
//   NEW+ current parseLrc with word-by-word motion on (the opt-in)

import { readFileSync, readdirSync } from 'node:fs';
import { parseLrc as parseOld } from './parse_main';
import { parseLrc as parseNew, formatTimestamp } from '../../../lib/lyrics/parse';
import { compileTimeline } from '../../../lib/kinetic/compile';

const DATA = new URL('../../aligner/data/words/', import.meta.url);
const names = readdirSync(DATA).filter((f) => f.endsWith('.words.txt')).map((f) => f.slice(0, -10));
const errs: Record<string, number[]> = { OLD: [], NEW: [], 'NEW+': [] };

for (const name of names) {
  const words = readFileSync(new URL(`${name}.words.txt`, DATA), 'utf8').split(/\r?\n/).filter(Boolean);
  const rows = readFileSync(new URL(`${name}.csv`, DATA), 'utf8').trim().split(/\r?\n/).slice(1).map((r) => {
    const [s, , le] = r.split(',');
    return { start: Number(s), lineEnd: le !== '' && le !== 'nan' };
  });
  if (rows.length !== words.length) continue;
  const lines: { first: number; last: number }[] = [];
  let first = 0;
  rows.forEach((r, i) => {
    if (r.lineEnd || i === rows.length - 1) {
      lines.push({ first, last: i });
      first = i + 1;
    }
  });
  const lrc = lines.map((l) => `[${formatTimestamp(Math.round(rows[l.first]!.start * 1000))}] ${words.slice(l.first, l.last + 1).join(' ')}`).join('\n');
  const opts = { trackId: name, durationMs: 400_000, palette: ['#fff', '#000'], bpm: 100 };

  const old = parseOld(lrc).lines.flatMap((l) => l.words.map((w) => w.startMs));
  const nw = compileTimeline(parseNew(lrc), opts).scenes.flatMap((s) => s.words.map((w) => w.startMs));
  const nwPlus = compileTimeline(parseNew(lrc), { ...opts, estimateWords: true }).scenes.flatMap((s) => s.words.map((w) => w.startMs));
  if (old.length !== words.length || nw.length !== words.length) continue;
  words.forEach((_, i) => {
    const truth = rows[i]!.start * 1000;
    errs.OLD!.push(old[i]! - truth);
    errs.NEW!.push(nw[i]! - truth);
    errs['NEW+']!.push(nwPlus[i]! - truth);
  });
}

const abs = (a: number[]) => a.map(Math.abs).sort((x, y) => x - y);
const pct = (a: number[], p: number) => a[Math.min(a.length - 1, Math.floor(p * a.length))]!;
console.log(`${names.length} songs, ${errs.OLD!.length} words.  error = when the word appears minus when it is sung (negative = too early)\n`);
console.log('treatment                          median |err|   p90 |err|   within 200ms   signed median   p10 signed');
for (const [label, key] of [['OLD  (old code, word-by-word estimate)', 'OLD'], ['NEW  (new default: line as a unit)', 'NEW'], ['NEW+ (new code, estimate switched on)', 'NEW+']] as const) {
  const e = errs[key]!;
  const a = abs(e);
  const sorted = [...e].sort((x, y) => x - y);
  console.log(
    label.padEnd(36),
    String(Math.round(pct(a, 0.5))).padStart(7),
    ' ms',
    String(Math.round(pct(a, 0.9))).padStart(8),
    ' ms',
    ((a.filter((x) => x <= 200).length / a.length) * 100).toFixed(1).padStart(8) + ' %',
    String(Math.round(pct(sorted, 0.5))).padStart(10),
    ' ms',
    String(Math.round(pct(sorted, 0.1))).padStart(9),
    ' ms',
  );
}
