// Turbo gives every song full motion: line-synced lyrics move word by word and calm directions still get the full mix of presets.
import { describe, expect, it } from 'vitest';
import { parseLyrics } from '@/lib/lyrics/parse';
import { compileTimeline } from '@/lib/kinetic/compile';

const LRC = Array.from({ length: 12 }, (_, i) => `[00:${String(2 + i * 4).padStart(2, '0')}.00]line number ${i} has a few words in it`).join('\n');
const opts = { trackId: 't', durationMs: 60_000, palette: ['#ff0000', '#00ff00', '#0000ff'], style: 'stillness' as const };

describe('Turbo is lively for every song', () => {
  it('a calm direction alone shows line-synced lines as units with one preset', () => {
    const tl = compileTimeline(parseLyrics(LRC), { ...opts, estimateWords: false });
    expect(tl.cues.every((c) => c.timing === 'none')).toBe(true);
    expect(new Set(tl.scenes.map((s) => s.preset)).size).toBe(1);
  });
  it('with lively on, words get times and the presets vary', () => {
    const tl = compileTimeline(parseLyrics(LRC), { ...opts, estimateWords: false, lively: true });
    expect(tl.cues.some((c) => c.timing === 'none')).toBe(false);
    expect(new Set(tl.scenes.map((s) => s.preset)).size).toBeGreaterThan(2);
  });
});
