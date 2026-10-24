import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLrc } from '@/lib/lyrics/parse';
import { compileTimeline } from '@/lib/kinetic/compile';
import { computeFrame } from '@/lib/kinetic/frame';
import { EXPORT_SIZES, frameCount, safeFilename } from '@/lib/export/video';
import type { FrameEnv } from '@/lib/kinetic/types';

const catalog = JSON.parse(readFileSync(join(process.cwd(), 'public/demo/catalog.json'), 'utf8')) as { id: string; durationMs: number; bpm: number; beatTimesMs: number[]; palette: string[] }[];
const entry = catalog.find((c) => c.id === 'neon-static')!;
const tl = compileTimeline(parseLrc(readFileSync(join(process.cwd(), 'public/demo/neon-static.lrc'), 'utf8'), 'CC0 demo'), { trackId: 'demo:neon-static', durationMs: entry.durationMs, palette: entry.palette, bpm: entry.bpm, beatTimesMs: entry.beatTimesMs, style: 'maximalist' });
const env: FrameEnv = { width: 1920, height: 1080, reducedMotion: false };

describe('video export helpers', () => {
  it('counts frames from range and fps, never fewer than one', () => {
    expect(frameCount(0, 6000, 30)).toBe(180);
    expect(frameCount(2000, 4000, 60)).toBe(120);
    expect(frameCount(1000, 1000, 30)).toBe(1);
  });

  it('only offers sizes with even dimensions (H.264 requires it)', () => {
    for (const s of EXPORT_SIZES) {
      expect(s.width % 2).toBe(0);
      expect(s.height % 2).toBe(0);
    }
  });

  it('makes filesystem-safe names', () => {
    expect(safeFilename('AC/DC: Back In Black?')).toBe('ACDC-Back-In-Black');
    expect(safeFilename('日本語')).toBe('lyricscape');
    expect(safeFilename('a'.repeat(200)).length).toBeLessThanOrEqual(80);
  });
});

describe('export content toggles reach the frame', () => {
  const gap = tl.gaps[0]!;
  const mid = (gap.startMs + gap.endMs) / 2;
  it('the breaks show can be switched off', () => {
    expect(computeFrame(tl, mid, env).interlude.amount).toBeGreaterThan(0.5);
    const off = computeFrame(tl, mid, { ...env, interlude: false });
    expect(off.interlude.amount).toBe(0);
  });

  it('lyrics-only (no emoji, doodles, cover, show) draws nothing but words and the background', () => {
    const lyricsOnly: FrameEnv = { ...env, emojis: false, doodles: false, artwork: 'off', interlude: false };
    for (let t = 0; t < tl.durationMs; t += 500) {
      const f = computeFrame(tl, t, lyricsOnly);
      expect(f.doodles).toHaveLength(0);
      expect(f.icons).toHaveLength(0);
      expect(f.artwork.alpha).toBe(0);
    }
  });

  it('frames depend only on time, so stepping at a fixed fps equals jumping straight there', () => {
    const t = 17_300;
    const direct = JSON.stringify(computeFrame(tl, t, env));
    for (let f = 0; f * (1000 / 30) < t; f++) computeFrame(tl, f * (1000 / 30), env);
    expect(JSON.stringify(computeFrame(tl, t, env))).toBe(direct);
  });
});
