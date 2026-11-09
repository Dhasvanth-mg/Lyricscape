import { describe, expect, it, beforeEach } from 'vitest';
import { hasRealWordTimes, lastStarted, stripAt, wordProgress, type StripLine } from '@/lib/live/strip';
import { overlayUrl, parseOverlayParams } from '@/lib/live/overlayParams';
import { applyLive, liveState, onLive, resetLive } from '@/lib/server/live';
import { liveNow, livePost } from '@/lib/live/types';
import { wallpaperHtml } from '@/components/settings/LiveSection';

const L = (startMs: number, endMs: number, text: string, wordTiming?: StripLine['wordTiming']): StripLine => {
  const ws = text.split(' ');
  const step = (endMs - startMs) / ws.length;
  return { startMs, endMs, wordTiming, words: ws.map((t, i) => ({ text: t, startMs: startMs + i * step, endMs: startMs + (i + 1) * step })) };
};
const lines = [L(1000, 3000, 'one two'), L(3200, 5000, 'three four'), L(9000, 11000, 'five six')];

describe('lyric strip timing', () => {
  it('finds the last line that has started', () => {
    expect(lastStarted(lines, 0)).toBe(-1);
    expect(lastStarted(lines, 1000)).toBe(0);
    expect(lastStarted(lines, 3199)).toBe(0);
    expect(lastStarted(lines, 3200)).toBe(1);
    expect(lastStarted(lines, 99999)).toBe(2);
  });
  it('shows the first line as coming up before the vocals', () => {
    expect(stripAt(lines, 200)).toEqual({ current: -1, next: 0, lineProgress: 0 });
  });
  it('keeps a line up briefly after it ends, then shows the next as coming up', () => {
    expect(stripAt(lines, 5500).current).toBe(1);
    const gap = stripAt(lines, 7000);
    expect(gap.current).toBe(-1);
    expect(gap.next).toBe(2);
  });
  it('reports line and word progress', () => {
    expect(stripAt(lines, 2000).lineProgress).toBeCloseTo(0.5);
    expect(wordProgress({ startMs: 100, endMs: 200 }, 150)).toBeCloseTo(0.5);
    expect(wordProgress({ startMs: 100, endMs: 200 }, 50)).toBe(0);
    expect(wordProgress({ startMs: 100, endMs: 200 }, 250)).toBe(1);
  });
  it('never shows estimated word times as karaoke', () => {
    expect(hasRealWordTimes(L(0, 1000, 'a b'))).toBe(true);
    expect(hasRealWordTimes(L(0, 1000, 'a b', 'estimated'))).toBe(false);
    expect(hasRealWordTimes(L(0, 1000, 'a', 'authored'))).toBe(false);
  });
  it('handles no lyrics', () => {
    expect(stripAt([], 1000)).toEqual({ current: -1, next: -1, lineProgress: 0 });
  });
});

describe('overlay address', () => {
  it('round-trips its options and ignores junk', () => {
    const o = { bg: 'cover', size: 'xl', align: 'left', next: false, meta: true, font: 'serif' } as const;
    const u = overlayUrl('http://127.0.0.1:3000', o);
    expect(parseOverlayParams(new URL(u).search)).toEqual(o);
    expect(parseOverlayParams('?bg=evil&size=9')).toMatchObject({ bg: 'transparent', size: 'l' });
  });
  it('escapes the address inside the wallpaper file', () => {
    const html = wallpaperHtml('http://x/overlay?a=1&b="2"');
    expect(html).toContain('a=1&amp;b=&quot;2&quot;');
    expect(html).not.toContain('"2"');
  });
});

describe('live now-playing state', () => {
  beforeEach(() => resetLive());
  const clock = { playing: true, lyricMs: 1000, at: 50_000, trackOffsetMs: 0 };
  const song = { track: { id: 't', title: 'T', artists: ['A'], durationMs: 1000, artworkUrl: null }, docKey: 'k', lines: [], palette: null, beatsMs: null };

  it('extrapolates the clock only while playing', () => {
    expect(liveNow(clock, 50_500)).toBe(1500);
    expect(liveNow({ ...clock, playing: false }, 50_500)).toBe(1000);
  });
  it('keeps the song when only the clock changes, and tells subscribers which changed', () => {
    const seen: string[] = [];
    const off = onLive((k) => seen.push(k));
    applyLive(livePost.parse({ kind: 'song', song, clock }));
    applyLive(livePost.parse({ kind: 'clock', clock: { ...clock, lyricMs: 2000 } }));
    off();
    expect(seen).toEqual(['song', 'clock']);
    expect(liveState().song.track?.title).toBe('T');
    expect(liveState().clock.lyricMs).toBe(2000);
    expect(liveState().seq).toBe(2);
  });
  it('rejects malformed posts', () => {
    expect(() => livePost.parse({ kind: 'clock', clock: { playing: 'yes' } })).toThrow();
    expect(() => livePost.parse({ kind: 'song', song: { ...song, track: { ...song.track, artworkUrl: 'javascript:alert(1)' } }, clock })).toThrow();
  });
});
