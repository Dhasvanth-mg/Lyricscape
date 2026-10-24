// LRCLIB "Lyricsfile" (YAML): lines with start_ms / end_ms and, when the recording is word-synced, per-word times.
// https://lrclib.net returns it as `lyricsfile` on every record, with `hasWordSync` telling whether any line has words.
//
// Trust rules (learned from real records):
//  - `words[]` present  -> those are authored word times.
//  - `end_ms` on a line WITHOUT words is derived by LRCLIB (next line start +/- 100 ms, and it ignores blank cues), so
//    it is not a measurement. A line with empty `text` is a blank cue and ends the line before it.

import { parse } from 'yaml';
import type { EndSource, LyricDocument, TimedLine, TimedWord } from '../types';
import { MIN_GUESSED_SPAN_MS, distributeWords, estimatedSpreadEnd, fixOverlaps } from './parse';
import { expectedSungMs } from './words';

type RawWord = { text?: unknown; start_ms?: unknown; end_ms?: unknown };
type RawLine = { text?: unknown; start_ms?: unknown; end_ms?: unknown; words?: unknown };

const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : undefined);

export function parseLyricsfile(yaml: string, licenseSource = 'LRCLIB (community)'): LyricDocument {
  const data = parse(yaml) as { lines?: RawLine[]; metadata?: Record<string, unknown> } | null;
  const raw = Array.isArray(data?.lines) ? data!.lines! : [];
  const cues = raw
    .map((l) => ({ text: typeof l.text === 'string' ? l.text.trim() : '', start: num(l.start_ms), end: num(l.end_ms), words: Array.isArray(l.words) ? (l.words as RawWord[]) : [] }))
    .filter((l) => l.start !== undefined)
    .sort((a, b) => a.start! - b.start!);

  const lines: TimedLine[] = [];
  for (let i = 0; i < cues.length; i++) {
    const cur = cues[i]!;
    if (!cur.text && !cur.words.length) continue; // blank cue: only ends the line before it
    const start = cur.start!;
    const next = cues[i + 1];
    const blankNext = next && !next.text && !next.words.length ? next.start! : undefined;
    const nextText = cues.slice(i + 1).find((c) => c.text || c.words.length)?.start;

    const timed: TimedWord[] = [];
    for (let k = 0; k < cur.words.length; k++) {
      const w = cur.words[k]!;
      const text = typeof w.text === 'string' ? w.text.trim() : '';
      const ws = num(w.start_ms);
      if (!text || ws === undefined) continue;
      timed.push({ text, startMs: ws, endMs: num(w.end_ms) ?? ws });
    }
    let endMs: number;
    let endSource: EndSource;
    if (timed.length) {
      // authored words: a word with no end_ms ends where the next begins; the last one at the line's end
      const last = timed[timed.length - 1]!;
      const rawLast = cur.words[cur.words.length - 1] as RawWord;
      const lastEnd = num(rawLast?.end_ms);
      if (lastEnd !== undefined) {
        endMs = lastEnd;
        endSource = 'explicit';
      } else if (blankNext !== undefined) {
        endMs = blankNext;
        endSource = 'explicit';
      } else if (nextText !== undefined && nextText - last.startMs < 8000) {
        endMs = nextText;
        endSource = 'next-line';
      } else {
        endMs = last.startMs + 600;
        endSource = 'estimated';
      }
      for (let k = 0; k < timed.length; k++) {
        const w = timed[k]!;
        const rawEnd = num((cur.words[k] as RawWord | undefined)?.end_ms);
        const nextWord = timed[k + 1];
        w.endMs = Math.max(w.startMs, rawEnd ?? nextWord?.startMs ?? endMs);
      }
      lines.push({ startMs: start, endMs: Math.max(endMs, timed[timed.length - 1]!.endMs), words: timed, wordTiming: 'authored', endSource });
      continue;
    }
    const tokens = cur.text.split(/\s+/).filter(Boolean);
    if (!tokens.length) continue;
    const cap = Math.max(MIN_GUESSED_SPAN_MS, Math.round(expectedSungMs(tokens) * 2.5));
    if (blankNext !== undefined && blankNext >= start) {
      endMs = blankNext;
      endSource = 'explicit';
    } else if (nextText !== undefined && nextText - start <= cap) {
      endMs = nextText;
      endSource = 'next-line';
    } else {
      endMs = start + cap;
      endSource = 'estimated';
    }
    lines.push({ ...distributeWords(tokens, start, estimatedSpreadEnd(tokens.length, start, endMs, endSource, nextText)), endMs, wordTiming: 'estimated', endSource });
  }

  const wordSynced = lines.some((l) => l.wordTiming === 'authored');
  return {
    source: wordSynced ? 'enhanced-lrc' : 'lrc',
    licenseSource,
    lines: fixOverlaps(lines),
    timing: { source: 'lyricsfile' },
  };
}
