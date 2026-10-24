// The word-timing estimate for line-synced lyrics (lib/lyrics/parse.ts estimatedSpreadEnd + lib/lyrics/words.ts sungShareOfGap).
// This is an ESTIMATE: it is labelled as one, and these tests pin what it is allowed to do, not that it is "right".
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { estimatedSpreadEnd, formatTimestamp, parseLrc } from '@/lib/lyrics/parse';
import { sungShareOfGap } from '@/lib/lyrics/words';
import { compileTimeline } from '@/lib/kinetic/compile';

describe('sungShareOfGap: how much of the gap before the next line is singing', () => {
  it('is nearly all of it for fast lines, about half for very slow ones, and never rises as lines get slower', () => {
    expect(sungShareOfGap(150)).toBe(1);
    expect(sungShareOfGap(10_000)).toBe(0.5);
    let prev = 2;
    for (let g = 100; g <= 4000; g += 50) {
      const s = sungShareOfGap(g);
      expect(s).toBeLessThanOrEqual(prev + 1e-9);
      expect(s).toBeGreaterThanOrEqual(0.5);
      expect(s).toBeLessThanOrEqual(1);
      prev = s;
    }
  });
});

describe('estimatedSpreadEnd', () => {
  it('a line whose end the file states is spread to exactly that end', () => {
    expect(estimatedSpreadEnd(6, 10_000, 18_000, 'explicit', 30_000)).toBe(18_000);
  });
  it('a fast line fills its gap; a slow one leaves room for the pause after it', () => {
    expect(estimatedSpreadEnd(8, 0, 2400, 'next-line', 2400)).toBeGreaterThan(2160); // 300 ms per word: over 90 % of it
    expect(estimatedSpreadEnd(8, 0, 1600, 'next-line', 1600)).toBe(1600); // 200 ms per word: all of it
    const slow = estimatedSpreadEnd(4, 0, 6000, 'next-line', 6000); // 1500 ms per word: about half
    expect(slow).toBeGreaterThan(2800);
    expect(slow).toBeLessThan(3600);
  });
  it('never beyond the display end, and a huge gap is bounded by a sung-line length', () => {
    expect(estimatedSpreadEnd(5, 0, 3000, 'next-line', 9000)).toBeLessThanOrEqual(3000);
    expect(estimatedSpreadEnd(5, 0, 10_000, 'estimated', 60_000)).toBeLessThanOrEqual(7500); // <= 1.5 s per word
  });
  it('the last line (no next cue) takes about 450 ms per word, at least 1.2 s', () => {
    expect(estimatedSpreadEnd(2, 0, 10_000)).toBe(1200);
    expect(estimatedSpreadEnd(10, 0, 10_000)).toBe(4500);
  });
});

describe('what it does to a real-shaped song', () => {
  const lrc = [
    ['00:10.00', 'fast fast fast fast fast fast fast fast'], // 8 words, next in 2.4 s
    ['00:12.40', 'slow line here'], // 3 words, next in 6 s
    ['00:18.40', 'another one right here now'],
  ]
    .map(([t, s]) => `[${t}] ${s}`)
    .join('\n');

  it('keeps words in order inside their line, starting exactly at the line start, and inside the display end', () => {
    const doc = parseLrc(lrc);
    for (const l of doc.lines) {
      expect(l.words[0]!.startMs).toBe(l.startMs);
      for (let i = 1; i < l.words.length; i++) expect(l.words[i]!.startMs).toBeGreaterThanOrEqual(l.words[i - 1]!.startMs);
      expect(l.words.at(-1)!.endMs).toBeLessThanOrEqual(l.endMs + 1);
      expect(l.wordTiming).toBe('estimated');
    }
  });

  it('the slow line is not squashed into a fixed few hundred ms and the fast one is not stretched over a pause', () => {
    const doc = parseLrc(lrc);
    const fast = doc.lines[0]!;
    const slow = doc.lines[1]!;
    expect(fast.words.at(-1)!.startMs - fast.startMs).toBeGreaterThan(1800); // reaches towards the next line
    expect(slow.words.at(-1)!.startMs - slow.startMs).toBeGreaterThan(1500); // 3 words over about half of 6 s
    expect(slow.words.at(-1)!.startMs - slow.startMs).toBeLessThan(3300);
  });

  it('is still labelled estimated everywhere it reaches the visualiser', () => {
    const tl = compileTimeline(parseLrc(lrc), { trackId: 't', durationMs: 60_000, palette: ['#fff', '#000'], bpm: 100, estimateWords: true });
    expect(tl.scenes.flatMap((s) => s.words).every((w) => w.timing === 'estimated')).toBe(true);
  });
});

// ---- accuracy on the human annotations (JamendoLyrics, 20 songs), when they have been downloaded ------------------------------
const DATA = join(process.cwd(), 'tools/aligner/data/words');
const haveData = existsSync(DATA) && readdirSync(DATA).filter((f) => f.endsWith('.words.txt')).length >= 20;

describe.skipIf(!haveData)('accuracy against human word annotations (needs `python tools/aligner/evaluate.py fetch`)', () => {
  function errors() {
    const out: number[] = [];
    for (const f of readdirSync(DATA).filter((x) => x.endsWith('.words.txt'))) {
      const name = f.slice(0, -10);
      const words = readFileSync(join(DATA, f), 'utf8').split(/\r?\n/).filter(Boolean);
      const rows = readFileSync(join(DATA, `${name}.csv`), 'utf8').trim().split(/\r?\n/).slice(1).map((r) => {
        const [s, , le] = r.split(',');
        return { start: Number(s) * 1000, lineEnd: le !== '' && le !== 'nan' };
      });
      if (rows.length !== words.length) continue;
      const lines: [number, number][] = [];
      let a = 0;
      rows.forEach((r, i) => {
        if (r.lineEnd || i === rows.length - 1) {
          lines.push([a, i]);
          a = i + 1;
        }
      });
      const lrc = lines.map(([x, y]) => `[${formatTimestamp(Math.round(rows[x]!.start))}] ${words.slice(x, y + 1).join(' ')}`).join('\n');
      const est = parseLrc(lrc).lines.flatMap((l) => l.words.map((w) => w.startMs));
      if (est.length !== words.length) continue;
      est.forEach((e, i) => out.push(e - rows[i]!.start));
    }
    return out;
  }

  it('beats the previous estimator and does not trade lateness for earliness', () => {
    const e = errors();
    expect(e.length).toBeGreaterThan(5000);
    const within200 = e.filter((x) => Math.abs(x) <= 200).length / e.length;
    const late300 = e.filter((x) => x > 300).length / e.length;
    const early300 = e.filter((x) => x < -300).length / e.length;
    // previous estimator (measured the same way): 46.3 % within 200 ms, 36.5 % more than 300 ms late, 5.3 % more than 300 ms early.
    // These gates are IN-SAMPLE (the table was fitted on these songs); the held-out numbers are in docs/lyric-sync-motion.md.
    expect(within200).toBeGreaterThan(0.5);
    expect(late300).toBeLessThan(0.3);
    expect(early300).toBeLessThan(0.15);
  });
});
