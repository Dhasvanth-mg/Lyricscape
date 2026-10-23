// What the app itself does with LINE-level lyrics, measured against the same human annotations as the aligner.
//
//   pnpm exec tsx tools/aligner/line_level_baseline.ts
//
// For every annotated song it builds an LRC the way LRCLIB would deliver one (line cues, with or without the blank
// "end" cue), feeds it through the real parser (`parseLrc`), and records where that parser would put each WORD.
// Those are estimated word times (syllable heuristic); the report compares them with the annotators' word onsets.
// Variants:
//   ideal-ends   line start AND end are exact (the best a line-level file can ever be)
//   starts-only  exact line starts, no end cue (typical LRC)
//   jitter-150   starts-only with N(0, 150 ms) noise on every line start (a human tapped them: sensitivity check)
//   plain-spread no timing at all: lyrics spread over the song (the "not synced" case)

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { formatTimestamp, fromPlainText, parseLrc } from '../../lib/lyrics/parse';

const HERE = import.meta.dirname;
const DATA = join(HERE, 'data');
const RESULTS = join(HERE, 'results');
mkdirSync(RESULTS, { recursive: true });

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

function csv(path: string): { start: number; end: number; lineEnd: boolean }[] {
  return readFileSync(path, 'utf8')
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((row) => {
      const [s, e, le] = row.split(',');
      return { start: Number(s), end: Number(e), lineEnd: le !== undefined && le !== '' && le !== 'nan' };
    });
}

const lrcTime = (sec: number) => `[${formatTimestamp(Math.max(0, Math.round(sec * 1000)))}]`;

const names = readdirSync(join(DATA, 'words'))
  .filter((f) => f.endsWith('.words.txt'))
  .map((f) => f.slice(0, -'.words.txt'.length));

for (const name of names) {
  const words = readFileSync(join(DATA, 'words', `${name}.words.txt`), 'utf8').split(/\r?\n/).filter((w) => w !== '');
  const rows = csv(join(DATA, 'words', `${name}.csv`));
  if (rows.length !== words.length) {
    console.warn(`skip ${name}: ${rows.length} annotated vs ${words.length} words`);
    continue;
  }
  // group words into annotated lines
  const lines: { first: number; last: number; start: number; end: number }[] = [];
  let first = 0;
  rows.forEach((r, i) => {
    if (r.lineEnd || i === rows.length - 1) {
      lines.push({ first, last: i, start: rows[first]!.start, end: r.end });
      first = i + 1;
    }
  });
  const text = (l: { first: number; last: number }) => words.slice(l.first, l.last + 1).join(' ');
  const onsetsFrom = (lrc: string): number[] => {
    const doc = parseLrc(lrc);
    const flat = doc.lines.flatMap((l) => l.words.map((w) => w.startMs / 1000));
    return flat.length === words.length ? flat : [];
  };

  const variants: Record<string, number[]> = {};
  variants['ideal-ends'] = onsetsFrom(lines.map((l) => `${lrcTime(l.start)} ${text(l)}\n${lrcTime(l.end)}`).join('\n'));
  variants['starts-only'] = onsetsFrom(lines.map((l) => `${lrcTime(l.start)} ${text(l)}`).join('\n'));
  const r = rng(name.length * 7919);
  variants['jitter-150'] = onsetsFrom(lines.map((l) => `${lrcTime(l.start + (gauss(r) * 150) / 1000)} ${text(l)}`).join('\n'));

  const alignedPath = join(RESULTS, `aligned_${name}.json`);
  const durationMs = existsSync(alignedPath) ? Math.round(JSON.parse(readFileSync(alignedPath, 'utf8')).duration_s * 1000) : Math.round((rows.at(-1)!.end + 8) * 1000);
  const plain = fromPlainText(lines.map((l) => text(l)).join('\n'), durationMs);
  const flat = plain.lines.flatMap((l) => l.words.map((w) => w.startMs / 1000));
  if (flat.length === words.length) variants['plain-spread'] = flat;

  for (const k of Object.keys(variants)) if (!variants[k]!.length) delete variants[k];
  writeFileSync(join(RESULTS, `heuristic_${name}.json`), JSON.stringify({ name, variants }));
  console.log(name, Object.keys(variants).join(', '));
}
