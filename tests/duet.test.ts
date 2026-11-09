import { describe, expect, it } from 'vitest';
import { parseLrc, takeVoice, toEnhancedLrc } from '@/lib/lyrics/parse';
import { adlibMarks, compileTimeline } from '@/lib/kinetic/compile';
import { computeFrame } from '@/lib/kinetic/frame';

const LRC = `[00:01.00]v1: I keep on running
[00:04.00]v2: <00:04.00>I'm <00:04.30>right <00:04.60>behind <00:05.00>you <00:05.60>
[00:07.00]v3: Together now
[00:10.00]Never stop (no no) tonight
[00:13.00](ooh ooh)
`;

describe('duets and background vocals', () => {
  it('reads singer tags and drops them from the words', () => {
    expect(takeVoice('v2: hey')).toEqual({ voice: 'feat', text: 'hey' });
    expect(takeVoice('<00:01.00>v1: hey').voice).toBe('lead');
    expect(takeVoice('v1000: all').voice).toBe('both');
    expect(takeVoice('no tag here').voice).toBeUndefined();
    const doc = parseLrc(LRC);
    expect(doc.lines.map((l) => l.voice)).toEqual(['lead', 'feat', 'both', undefined, undefined]);
    expect(doc.lines[1]!.words.map((w) => w.text)).toEqual(["I'm", 'right', 'behind', 'you']);
    expect(doc.lines[1]!.wordTiming).toBe('authored');
    // saving keeps the tags
    expect(parseLrc(toEnhancedLrc(doc)).lines.map((l) => l.voice)).toEqual(['lead', 'feat', 'both', undefined, undefined]);
  });

  it('marks words in parentheses as background vocals, but not a line that is all parentheses', () => {
    const marks = adlibMarks(parseLrc(LRC).lines);
    expect(marks[3]).toEqual([false, false, true, true, false]);
    expect(marks[4]).toBeNull();
    expect(marks[0]).toBeNull();
  });

  it('lays the featured voice to the right of the lead, and ad-libs small under the line, without moving any times', () => {
    const doc = parseLrc(LRC);
    const tl = compileTimeline(doc, { trackId: 't', durationMs: 20000, palette: ['#ff2e63', '#14121f'] });
    const before = doc.lines.flatMap((l) => l.words.map((w) => w.startMs));
    expect(tl.cues.filter((c) => c.timing !== 'none').map((c) => c.startMs).every((t) => before.includes(t))).toBe(true);
    const env = { width: 1280, height: 720, reducedMotion: true };
    const meanX = (t: number) => {
      const ws = computeFrame(tl, t, env).words;
      return ws.reduce((a, w) => a + w.x, 0) / Math.max(1, ws.length);
    };
    expect(meanX(2500)).toBeLessThan(-10);
    expect(meanX(5600)).toBeGreaterThan(10);
    const f = computeFrame(tl, 12000, env).words;
    const adlib = f.filter((w) => /^no$/i.test(w.text));
    const main = f.filter((w) => /never|stop|tonight/i.test(w.text));
    expect(adlib.length).toBe(2);
    expect(Math.max(...adlib.map((w) => w.sizePx))).toBeLessThan(Math.min(...main.map((w) => w.sizePx)));
    expect(Math.min(...adlib.map((w) => w.y))).toBeGreaterThan(Math.max(...main.map((w) => w.y)));
    expect(adlib.every((w) => !w.text.includes('('))).toBe(true);
  });
});
