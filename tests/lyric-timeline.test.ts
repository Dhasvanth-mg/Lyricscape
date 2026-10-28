// The canonical lyric document: parsing, provenance, serialization, gaps, repeated sections, offsets, edited timing,
// Lyricsfile ingestion, version matching and how the visualizer treats lines whose word times are not real.
import { describe, expect, it } from 'vitest';
import { formatTimestamp, fromPlainText, parseLrc, parseLyrics, parseTimestamp, parseVtt, timingSummary, toEnhancedLrc, validateDocument } from '@/lib/lyrics/parse';
import { parseLyricsfile } from '@/lib/lyrics/lyricsfile';
import { MAX_SYNCED_DURATION_DELTA_SEC, matchInfoFor, rankCandidates, scoreCandidate, type LrclibRecord } from '@/lib/lyrics/match';
import { isUserOwned, originOf } from '@/lib/lyrics/service';
import { compileTimeline } from '@/lib/kinetic/compile';
import { computeFrame } from '@/lib/kinetic/frame';
import type { FrameEnv } from '@/lib/kinetic/types';
import type { LyricDocument } from '@/lib/types';

const env: FrameEnv = { width: 1280, height: 720, reducedMotion: false };
const PALETTE = ['#ff2e63', '#ffd23f', '#08d9d6', '#1a1a2e'];
const compile = (doc: LyricDocument, extra: Partial<Parameters<typeof compileTimeline>[1]> = {}) => compileTimeline(doc, { trackId: 't', durationMs: 200_000, palette: PALETTE, bpm: 120, ...extra });

describe('timestamps', () => {
  it('accepts the forms found in the wild and rejects the rest', () => {
    expect(parseTimestamp('1:05')).toBe(65_000);
    expect(parseTimestamp('01:05.5')).toBe(65_500);
    expect(parseTimestamp('01:05,250')).toBe(65_250);
    expect(parseTimestamp('1:01:05.123')).toBe(3_665_123);
    expect(parseTimestamp('00:61.00')).toBe(61_000); // seconds field is not range-checked, like real players
    for (const bad of ['', 'abc', '12', '1:2:3:4', '-1:00', '00:xx']) expect(parseTimestamp(bad)).toBeNaN();
  });
  it('formats at 10 ms or 1 ms', () => {
    expect(formatTimestamp(65_501)).toBe('01:05.50');
    expect(formatTimestamp(65_501, 3)).toBe('01:05.501');
    expect(formatTimestamp(-40)).toBe('00:00.00');
  });
});

describe('LRC parsing and provenance', () => {
  it('line-level lines are marked estimated, never authored', () => {
    const doc = parseLrc('[00:10.00] hello big world\n[00:14.00] again');
    expect(doc.lines.map((l) => l.wordTiming)).toEqual(['estimated', 'estimated']);
    expect(timingSummary(doc)).toMatchObject({ lines: 'synced', words: 'estimated', label: 'Line-synced' });
  });

  it('word stamps are authored; several words under one stamp are not', () => {
    const doc = parseLrc('[00:10.00] <00:10.00>hello <00:10.50>big <00:11.20>world\n[00:14.00] <00:14.00>two words <00:14.80>here');
    expect(doc.lines[0]!.wordTiming).toBe('authored');
    expect(doc.lines[1]!.wordTiming).toBe('estimated'); // "two words" share one stamp: the inner one is interpolated
    expect(doc.lines[0]!.words.map((w) => w.startMs)).toEqual([10_000, 10_500, 11_200]);
    expect(timingSummary(doc).words).toBe('mixed');
  });

  it('tolerates unsorted cues, malformed stamps, CRLF and metadata', () => {
    const doc = parseLrc('[ti:X]\r\n[00:20.00] second\r\n[xx:yy] junk\r\n[00:05.00] first\r\nno stamp here\r\n');
    expect(doc.lines.map((l) => l.words.map((w) => w.text).join(' '))).toEqual(['first', 'second']);
    expect(doc.meta).toMatchObject({ ti: 'X' });
    expect(validateDocument(doc)).toEqual([]);
  });

  it('repeated sections: one line with several stamps appears at each of them', () => {
    const doc = parseLrc('[00:10.00][01:30.00][02:50.00] sing it again\n[00:20.00] verse one\n[01:40.00] verse two');
    expect(doc.lines.map((l) => l.startMs)).toEqual([10_000, 20_000, 90_000, 100_000, 170_000]);
    const tl = compile(doc);
    expect(tl.scenes.filter((s) => s.hook)).toHaveLength(3); // the repeated line is a hook each time
  });

  it('an empty file or one with only metadata yields no lines, not a crash', () => {
    expect(parseLrc('').lines).toEqual([]);
    expect(parseLrc('[ti:x]\n[ar:y]\n').lines).toEqual([]);
  });
});

describe('line ends', () => {
  it('a blank cue is an explicit end, exact to the millisecond', () => {
    const doc = parseLrc('[00:10.00] a long slow line that goes on\n[00:19.37]\n[00:30.00] next');
    expect(doc.lines[0]).toMatchObject({ endMs: 19_370, endSource: 'explicit' });
  });
  it('without a blank cue the next line is the bound; far away is a labelled guess', () => {
    const doc = parseLrc('[00:10.00] close one\n[00:13.00] far one\n[01:30.00] last');
    expect(doc.lines[0]).toMatchObject({ endMs: 13_000, endSource: 'next-line' });
    expect(doc.lines[1]!.endSource).toBe('estimated');
    expect(doc.lines[1]!.endMs).toBeLessThan(90_000);
    expect(doc.lines[2]!.endSource).toBe('estimated'); // nothing follows
  });
  it('a long sung line is not cut short just because a guess says it should be shorter', () => {
    // 9 s between cues for a 3-word line and no blank cue: a held note is plausible, so it stays up until the next cue
    const doc = parseLrc('[00:10.00] oh oh oh\n[00:19.00] next');
    expect(doc.lines[0]).toMatchObject({ endMs: 19_000, endSource: 'next-line' });
  });
  it('instrumental gaps are found from explicit ends, so the interlude starts when the singing really stops', () => {
    const doc = parseLrc('[00:10.00] one two three\n[00:14.00]\n[01:00.00] back again\n[01:04.00]');
    const tl = compile(doc, { durationMs: 70_000 });
    expect(tl.gaps.some((g) => g.startMs === 14_000 && g.endMs === 60_000)).toBe(true);
  });
});

describe('[offset:] tag', () => {
  it('shifts every cue once, in the LRC direction (positive = sooner), never below zero', () => {
    expect(parseLrc('[offset:+500]\n[00:10.00] a b').lines[0]!.startMs).toBe(9_500);
    expect(parseLrc('[offset:-250]\n[00:10.00] a b').lines[0]!.startMs).toBe(10_250);
    expect(parseLrc('[offset:5000]\n[00:02.00] a b').lines[0]!.startMs).toBe(0);
    const doc = parseLrc('[offset:300]\n[00:10.00] <00:10.00>a <00:10.50>b');
    expect(doc.lines[0]!.words.map((w) => w.startMs)).toEqual([9_700, 10_200]);
    expect(doc.timing?.offsetAppliedMs).toBe(300);
  });
  it('is applied exactly once across save and reload', () => {
    const doc = parseLrc('[offset:400]\n[00:10.00] a b\n[00:14.00] c d');
    const again = parseLyrics(toEnhancedLrc(doc));
    expect(again.lines.map((l) => l.startMs)).toEqual(doc.lines.map((l) => l.startMs));
    expect(toEnhancedLrc(doc)).not.toMatch(/offset/);
  });
});

describe('serialization keeps what is known and invents nothing', () => {
  it('authored word times round-trip to the centisecond', () => {
    const doc = parseLrc('[00:10.00] <00:10.00>hello <00:10.53>big <00:11.27>world <00:12.00>\n[00:14.00] <00:14.00>again <00:14.40>now <00:15.00>');
    const again = parseLyrics(toEnhancedLrc(doc));
    expect(again.lines.map((l) => l.wordTiming)).toEqual(['authored', 'authored']);
    doc.lines.forEach((l, i) => {
      l.words.forEach((w, j) => expect(Math.abs(again.lines[i]!.words[j]!.startMs - w.startMs)).toBeLessThanOrEqual(10));
    });
  });
  it('line-level documents stay line-level: no word stamps appear, line starts and explicit ends survive', () => {
    const doc = parseLrc('[00:10.00] hello big world\n[00:17.40]\n[00:20.00] second line\n[00:23.00] third');
    const text = toEnhancedLrc(doc);
    expect(text).not.toMatch(/<\d/);
    const again = parseLyrics(text);
    expect(again.lines.map((l) => l.startMs)).toEqual([10_000, 20_000, 23_000]);
    expect(again.lines[0]).toMatchObject({ endMs: 17_400, endSource: 'explicit', wordTiming: 'estimated' });
  });
  it('plain lyrics are saved as the text they are, not as made-up timestamps', () => {
    const doc = fromPlainText('first line\nsecond line\n', 180_000);
    expect(doc.source).toBe('plain');
    expect(timingSummary(doc)).toMatchObject({ lines: 'unsynced', label: 'Not synced (spread evenly)' });
    expect(toEnhancedLrc(doc)).toBe('first line\nsecond line\n');
    expect(parseLyrics(toEnhancedLrc(doc), { durationMs: 180_000 }).source).toBe('plain');
  });
  it('hand-timing one line of a plain document keeps that line and does not promote the rest to measurements', () => {
    const doc = fromPlainText('first line\nsecond line\nthird line\n', 180_000);
    doc.lines[1]!.wordTiming = 'authored';
    doc.lines[1]!.startMs = 41_230;
    doc.lines[1]!.words.forEach((w, i) => {
      w.startMs = 41_230 + i * 400;
      w.endMs = w.startMs + 400;
    });
    const again = parseLyrics(toEnhancedLrc(doc));
    expect(again.lines[1]!.wordTiming).toBe('authored');
    expect(again.lines[1]!.words[0]!.startMs).toBe(41_230);
    expect(again.lines[0]!.wordTiming).toBe('estimated');
  });
  it('VTT: a cue end is explicit', () => {
    const doc = parseVtt('WEBVTT\n\n00:00:01.000 --> 00:00:03.500\nhello there\n');
    expect(doc.lines[0]).toMatchObject({ endMs: 3_500, endSource: 'explicit', wordTiming: 'estimated' });
  });
});

describe('what the visualizer does with unreal word times', () => {
  const lineLevel = () => parseLrc('[00:10.00] one two three four five six\n[00:14.00] second line here\n[00:19.00] third line');
  const authored = () => parseLrc('[00:10.00] <00:10.00>one <00:10.30>two <00:10.60>three <00:10.90>four <00:11.20>five <00:11.50>six <00:12.00>\n[00:14.00] <00:14.00>b');

  it('line-level lines appear as a unit: staggered by a fixed beat, all lit until the line ends, no fabricated word timing', () => {
    const tl = compile(lineLevel());
    const scene = tl.scenes[0]!;
    expect(scene.words.every((w) => w.timing === 'none')).toBe(true);
    const starts = scene.words.map((w) => w.startMs - 10_000);
    expect(starts).toEqual([0, 40, 80, 120, 160, 200]); // presentation stagger, not timing
    expect(new Set(scene.words.map((w) => w.endMs)).size).toBe(1);
    expect(scene.preset).not.toBe('cut'); // single-word flashes need real word times
    expect(scene.words.every((w) => w.effect !== 'stretch')).toBe(true);
  });

  it('the same lines animate word by word only when the user opts in, and they are labelled estimated', () => {
    const tl = compile(lineLevel(), { estimateWords: true });
    expect(tl.scenes[0]!.words.every((w) => w.timing === 'estimated')).toBe(true);
    const starts = tl.scenes[0]!.words.map((w) => w.startMs);
    expect(new Set(starts).size).toBeGreaterThan(3);
  });

  it('authored word times always drive word-level motion, whatever the preference', () => {
    for (const estimateWords of [false, true]) {
      const tl = compile(authored(), { estimateWords });
      expect(tl.scenes[0]!.words.map((w) => w.startMs)).toEqual([10_000, 10_300, 10_600, 10_900, 11_200, 11_500]);
      expect(tl.scenes[0]!.words.every((w) => w.timing === 'authored')).toBe(true);
    }
  });

  it('frames are a pure function of the supplied time: same time, same frame, in any order, with either kind of line', () => {
    const docs = [lineLevel(), authored()];
    for (const doc of docs) {
      const tl = compile(doc);
      const times = [9_000, 10_050, 10_500, 12_100, 14_300, 21_000, 10_050, 9_000];
      const first = times.map((t) => JSON.stringify(computeFrame(tl, t, env)));
      const reversed = [...times].reverse().map((t) => JSON.stringify(computeFrame(compile(doc), t, env))).reverse();
      expect(reversed).toEqual(first);
    }
  });

  it('a seek lands on exactly the frame playback would show at that time (no memory of where it came from)', () => {
    const tl = compile(authored());
    const direct = JSON.stringify(computeFrame(tl, 11_300, env));
    for (let t = 0; t < 11_300; t += 700) computeFrame(tl, t, env); // "play" up to it
    expect(JSON.stringify(computeFrame(tl, 11_300, env))).toBe(direct);
    computeFrame(tl, 90_000, env); // jump away and back
    expect(JSON.stringify(computeFrame(tl, 11_300, env))).toBe(direct);
  });

  it('all words of a line-level line are on screen together while it is sung', () => {
    const tl = compile(lineLevel());
    const f = computeFrame(tl, 10_900, env);
    expect(f.visibleWordIds.filter((id) => id.startsWith('0:'))).toHaveLength(6);
    expect(f.lineIndex).toBe(0);
  });
});

describe('Lyricsfile (LRCLIB word-sync format)', () => {
  const wordSynced = `version: "1.0"
metadata:
  title: T
  artist: A
  duration_ms: 200000
lines:
  - text: hello big world
    start_ms: 10000
    end_ms: 12400
    words:
      - text: hello
        start_ms: 10000
        end_ms: 10500
      - text: big
        start_ms: 10600
        end_ms: 11000
      - text: world
        start_ms: 11200
        end_ms: 12400
  - text: ""
    start_ms: 12900
  - text: line only
    start_ms: 20000
    end_ms: 23000
    words: []
  - text: tail line
    start_ms: 24000
    end_ms: 26000
    words: []
`;
  it('keeps the authored word times exactly', () => {
    const doc = parseLyricsfile(wordSynced);
    expect(doc.lines[0]!.words).toEqual([
      { text: 'hello', startMs: 10_000, endMs: 10_500 },
      { text: 'big', startMs: 10_600, endMs: 11_000 },
      { text: 'world', startMs: 11_200, endMs: 12_400 },
    ]);
    expect(doc.lines[0]).toMatchObject({ wordTiming: 'authored', endMs: 12_400, endSource: 'explicit' });
    expect(doc.timing?.source).toBe('lyricsfile');
  });
  it('line-only entries are estimated, and their end_ms is not trusted (a blank cue is)', () => {
    const doc = parseLyricsfile(`version: "1.0"
lines:
  - text: line one
    start_ms: 10000
    end_ms: 55760
    words: []
  - text: ""
    start_ms: 14000
  - text: line two
    start_ms: 20000
    end_ms: 20100
    words: []
`);
    expect(doc.lines[0]).toMatchObject({ wordTiming: 'estimated', endMs: 14_000, endSource: 'explicit' });
    expect(doc.lines[1]!.wordTiming).toBe('estimated');
    expect(doc.lines[1]!.endMs).toBeGreaterThan(20_100);
  });
  it('a real LRCLIB record shape (inferred, overlapping end_ms) does not make lines overlap or vanish', () => {
    const doc = parseLyricsfile(`version: "1.0"
metadata:
  title: Hotel California
lines:
  - text: On a dark desert highway
    words: []
    start_ms: 52580
    end_ms: 55760
  - text: Cool wind in my hair
    words: []
    start_ms: 55660
    end_ms: 58920
  - text: ""
    words: []
    start_ms: 64125
  - text: Up ahead in the distance
    words: []
    start_ms: 65420
    end_ms: 68460
`);
    expect(validateDocument(doc)).toEqual([]);
    expect(doc.lines).toHaveLength(3);
    expect(doc.lines[0]!.endMs).toBeLessThanOrEqual(doc.lines[1]!.startMs);
    expect(doc.lines[1]).toMatchObject({ endMs: 64_125, endSource: 'explicit' });
  });
  it('survives words without end_ms and rejects garbage cleanly', () => {
    const doc = parseLyricsfile(`lines:
  - text: a b
    start_ms: 1000
    words:
      - text: a
        start_ms: 1000
      - text: b
        start_ms: 1500
  - text: c
    start_ms: 3000
`);
    expect(doc.lines[0]!.words[0]!.endMs).toBe(1500);
    expect(() => parseLyricsfile('not: [valid')).toThrow(); // the caller catches this and falls back to the plain LRC
  });
});

describe('choosing the recording', () => {
  const rec = (id: number, duration: number, extra: Partial<LrclibRecord> = {}): LrclibRecord => ({ id, trackName: 'Song', artistName: 'Band', albumName: 'LP', duration, plainLyrics: 'x', syncedLyrics: '[00:01.00] x', ...extra });
  const q = { title: 'Song', artist: 'Band', album: 'LP', duration: 200 };

  it('refuses synced lyrics from a recording more than a few seconds different in length', () => {
    expect(scoreCandidate(rec(1, 200 + MAX_SYNCED_DURATION_DELTA_SEC), q)).not.toBeNull();
    expect(scoreCandidate(rec(2, 200 + MAX_SYNCED_DURATION_DELTA_SEC + 1), q)).toBeNull();
    expect(scoreCandidate(rec(3, 207, { syncedLyrics: null }), q)).not.toBeNull(); // plain text has no timing to drift
  });
  it('word sync only breaks ties: it never beats a better length match', () => {
    const exactLine = rec(1, 200);
    const wordButFurther = rec(2, 203, { hasWordSync: true });
    expect(rankCandidates([wordButFurther, exactLine], q)[0]!.record.id).toBe(1);
    const sameLen = rec(3, 200, { hasWordSync: true });
    expect(rankCandidates([exactLine, sameLen], q)[0]!.record.id).toBe(3);
  });
  it('reports how good the match is', () => {
    expect(matchInfoFor(rec(1, 201), q)).toMatchObject({ titleExact: true, artistExact: true, albumMatch: true, durationDeltaSec: 1, verdict: 'exact' });
    expect(matchInfoFor(rec(2, 204), q).verdict).toBe('close');
    expect(matchInfoFor(rec(3, 200), { title: 'Song', artist: 'Band' }).verdict).toBe('unknown');
  });
});

describe('who owns the lyrics', () => {
  it('lookups may replace looked-up lyrics, never the user\'s', () => {
    expect(isUserOwned({ origin: 'user' })).toBe(true);
    expect(isUserOwned({ origin: 'edited' })).toBe(true);
    expect(isUserOwned({ origin: 'auto-aligned' })).toBe(true);
    expect(isUserOwned({ origin: 'lrclib' })).toBe(false);
    expect(isUserOwned({ origin: 'musixmatch' })).toBe(false);
    expect(isUserOwned({ origin: 'lyricsfile' })).toBe(false);
  });
  it('records saved before provenance existed: a version id means they came from a lookup; otherwise they are the user\'s', () => {
    expect(originOf({ versionId: 123 })).toBe('lrclib');
    expect(originOf({})).toBe('user');
    expect(isUserOwned({})).toBe(true);
    expect(isUserOwned({ versionId: 5 })).toBe(false);
  });
});

describe('backward compatibility with lyrics saved by earlier versions', () => {
  // Written by the previous toEnhancedLrc: word stamps for EVERY line, whatever their origin.
  const legacy = ['[ti:Old]', '[00:04.29] <00:04.29>City <00:04.97>hums <00:05.40>in <00:05.60>electric <00:06.20>blue <00:06.80>', '[00:08.60] <00:08.60>Every <00:09.10>sign <00:09.50>is <00:09.70>calling <00:10.20>you <00:10.70>', ''].join('\n');

  it('loads with the same words and the same times, as authored (a person may have timed them)', () => {
    const doc = parseLyrics(legacy);
    expect(doc.source).toBe('enhanced-lrc');
    expect(doc.lines.map((l) => l.wordTiming)).toEqual(['authored', 'authored']);
    expect(doc.lines[0]!.words.map((w) => [w.text, w.startMs])).toEqual([['City', 4290], ['hums', 4970], ['in', 5400], ['electric', 5600], ['blue', 6200]]);
    expect(doc.lines[0]!.endMs).toBe(6800);
  });

  it('a document with none of the new fields (older code paths, JSON import) is read as authored and still compiles and renders', () => {
    const doc: LyricDocument = { source: 'manual', licenseSource: 'x', lines: [{ startMs: 1000, endMs: 3000, words: [{ text: 'a', startMs: 1000, endMs: 1500 }, { text: 'b', startMs: 1500, endMs: 3000 }] }] };
    expect(timingSummary(doc).words).toBe('authored');
    const tl = compile(doc);
    expect(tl.scenes[0]!.words.map((w) => [w.startMs, w.timing])).toEqual([[1000, 'authored'], [1500, 'authored']]);
    expect(() => computeFrame(tl, 1200, env)).not.toThrow();
  });

  it('the bundled word-synced demo lyrics are unchanged by the rebuild', async () => {
    const { readFileSync } = await import('node:fs');
    const doc = parseLrc(readFileSync('public/demo/neon-static.lrc', 'utf8'), 'CC0 demo');
    expect(doc.lines.every((l) => l.wordTiming === 'authored')).toBe(true);
    expect(doc.lines[0]!.words[0]).toMatchObject({ text: 'City', startMs: 4290 });
    expect(validateDocument(doc)).toEqual([]);
  });
});
