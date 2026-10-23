import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  formatTimestamp,
  fromPlainText,
  parseLrc,
  parseLyrics,
  parseTimestamp,
  parseVtt,
  toEnhancedLrc,
  validateDocument,
} from '@/lib/lyrics/parse';

const demo = (name: string) => readFileSync(join(process.cwd(), 'public', 'demo', name), 'utf8');

describe('timestamps', () => {
  it('parses mm:ss.xx, mm:ss and hh:mm:ss.mmm', () => {
    expect(parseTimestamp('01:02.50')).toBe(62500);
    expect(parseTimestamp('1:02')).toBe(62000);
    expect(parseTimestamp('01:02:03.004')).toBe(3723004);
    expect(parseTimestamp('nope')).toBeNaN();
  });
  it('formats and round-trips at 10ms resolution', () => {
    expect(formatTimestamp(62500)).toBe('01:02.50');
    expect(formatTimestamp(59999)).toBe('01:00.00');
    expect(parseTimestamp(formatTimestamp(123450))).toBe(123450);
  });
});

describe('LRC', () => {
  it('parses plain LRC lines and metadata', () => {
    const doc = parseLrc('[ti:Song]\n[ar:Someone]\n[00:01.00] hello big world\n[00:05.00] second line\n');
    expect(doc.source).toBe('lrc');
    expect(doc.meta).toMatchObject({ ti: 'Song', ar: 'Someone' });
    expect(doc.lines).toHaveLength(2);
    expect(doc.lines[0]!.words.map((w) => w.text)).toEqual(['hello', 'big', 'world']);
    expect(doc.lines[0]!.startMs).toBe(1000);
    expect(doc.lines[0]!.endMs).toBeLessThanOrEqual(doc.lines[1]!.startMs);
  });

  it('supports repeated timestamps on one line', () => {
    const doc = parseLrc('[00:10.00][00:30.00] chorus words\n[00:20.00] verse\n');
    expect(doc.lines.map((l) => l.startMs)).toEqual([10000, 20000, 30000]);
  });

  it('parses enhanced LRC word stamps from the demo track', () => {
    const doc = parseLrc(demo('neon-static.lrc'), 'CC0 demo');
    expect(doc.source).toBe('enhanced-lrc');
    expect(doc.lines.length).toBeGreaterThan(10);
    expect(validateDocument(doc)).toEqual([]);
    const first = doc.lines[0]!;
    expect(first.words[0]!.text).toBe('City');
    expect(first.words[0]!.startMs).toBe(4290);
    // words are strictly ordered
    for (const l of doc.lines) for (let i = 1; i < l.words.length; i++) expect(l.words[i]!.startMs).toBeGreaterThanOrEqual(l.words[i - 1]!.startMs);
  });

  it('round-trips through enhanced LRC', () => {
    const doc = parseLrc(demo('glass-hours.lrc'));
    const again = parseLrc(toEnhancedLrc(doc));
    expect(again.lines.length).toBe(doc.lines.length);
    again.lines.forEach((l, i) => {
      expect(l.words.map((w) => w.text)).toEqual(doc.lines[i]!.words.map((w) => w.text));
      l.words.forEach((w, j) => expect(Math.abs(w.startMs - doc.lines[i]!.words[j]!.startMs)).toBeLessThanOrEqual(10));
    });
  });
});

describe('VTT / plain / detection', () => {
  it('parses WebVTT cues', () => {
    const doc = parseVtt('WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nhello there friend\n\n00:00:04.000 --> 00:00:06.000\nsecond cue\n');
    expect(doc.lines).toHaveLength(2);
    expect(doc.lines[0]!.startMs).toBe(1000);
    expect(doc.lines[0]!.endMs).toBe(3000);
  });

  it('parses WebVTT inline word timestamps', () => {
    const doc = parseVtt('WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n<00:00:01.000>one <00:00:01.500>two <00:00:02.200>three\n');
    expect(doc.lines[0]!.words.map((w) => [w.text, w.startMs])).toEqual([
      ['one', 1000],
      ['two', 1500],
      ['three', 2200],
    ]);
  });

  it('spreads plain text across the track duration', () => {
    const doc = fromPlainText('one two\nthree four\nfive six', 60000);
    expect(doc.source).toBe('plain');
    expect(doc.lines).toHaveLength(3);
    expect(doc.lines[2]!.endMs).toBeLessThan(60000);
    expect(validateDocument(doc)).toEqual([]);
  });

  it('auto-detects formats', () => {
    expect(parseLyrics('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nhi').source).toBe('vtt');
    expect(parseLyrics('[00:01.00] hi there').source).toBe('lrc');
    expect(parseLyrics('just some words\nanother line', { durationMs: 30000 }).source).toBe('plain');
    expect(
      parseLyrics(JSON.stringify([{ words: [{ text: 'a', startMs: 0, endMs: 100 }] }])).source,
    ).toBe('json');
  });

  it('flags invalid timing', () => {
    const problems = validateDocument({
      source: 'manual',
      licenseSource: 'x',
      lines: [{ startMs: 100, endMs: 50, words: [{ text: 'a', startMs: 100, endMs: 50 }] }],
    });
    expect(problems.length).toBeGreaterThan(0);
  });
});
