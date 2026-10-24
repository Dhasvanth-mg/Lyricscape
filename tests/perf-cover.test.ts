import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLrc } from '@/lib/lyrics/parse';
import { analyzeEmotion } from '@/lib/kinetic/emotion';
import { compileTimeline } from '@/lib/kinetic/compile';
import { computeFrame } from '@/lib/kinetic/frame';
import { paletteFromPixels } from '@/lib/kinetic/extractPalette';
import { FrameGovernor, LEVELS, PIXEL_BUDGET, QUALITY_PROFILE } from '@/lib/kinetic/governor';
import { visualTimelineSchema, type FrameEnv } from '@/lib/kinetic/types';
import { contrastRatio } from '@/lib/kinetic/util';

const env: FrameEnv = { width: 1280, height: 720, reducedMotion: false };
const catalog = JSON.parse(readFileSync(join(process.cwd(), 'public/demo/catalog.json'), 'utf8')) as { id: string; bpm: number; durationMs: number; beatTimesMs: number[]; palette: string[] }[];
const t = catalog[0]!;
const doc = parseLrc(readFileSync(join(process.cwd(), 'public/demo/neon-static.lrc'), 'utf8'));
const mood = analyzeEmotion(doc, { bpm: t.bpm });
const build = (cover?: { light: number; focal: { x: number; y: number }; vibrance: number }, d = doc) =>
  compileTimeline(d, { trackId: 'x', durationMs: t.durationMs, palette: t.palette, bpm: t.bpm, beatTimesMs: t.beatTimesMs, mood, cover });

describe('album art is always a background; the interlude show handles "nobody is singing"', () => {
  // a song whose first lyric starts at 10s: a long instrumental intro
  const longGap = parseLrc('[00:10.00] <00:10.00>hello <00:10.50>there <00:11.00>friend');
  const tlGap = compileTimeline(longGap, { trackId: 'g', durationMs: 30000, palette: t.palette, mood: analyzeEmotion(longGap), label: 'Test Song • Someone' });
  const noLyrics = compileTimeline({ source: 'manual', licenseSource: 'none', lines: [] }, { trackId: 'n', durationMs: 120000, palette: t.palette, bpm: 120, label: 'No Lyrics • Band' });

  // Product decision (changed with the visual redesign): the cover is atmosphere behind the words, and steps forward as a card
  // ONLY during a long instrumental break (4 s or more) when nobody is singing. Never over sung words, never when switched off.
  it('the cover is a faint backdrop while words are sung and steps forward as a card only in a long break', () => {
    const longBreaks = tlGap.gaps.filter((g) => g.endMs - g.startMs >= 4000);
    let sawCard = false;
    for (let ms = 0; ms < 30000; ms += 250) {
      const f = computeFrame(tlGap, ms, env);
      const inLongBreak = longBreaks.some((g) => ms >= g.startMs && ms <= g.endMs);
      if (f.artwork.mode === 'hero') {
        sawCard = true;
        expect(inLongBreak).toBe(true);
        expect(f.words).toHaveLength(0);
      } else {
        expect(f.artwork.alpha).toBeLessThanOrEqual(0.56);
      }
    }
    expect(sawCard).toBe(true);
    expect(computeFrame(tlGap, 5000, { ...env, artwork: 'off' }).artwork.alpha).toBe(0);
    expect(computeFrame(tlGap, 5000, { ...env, artwork: 'off' }).artwork.mode).toBe('backdrop');
    expect(computeFrame(tlGap, 5000, { ...env, reducedMotion: true }).artwork.mode).toBe('backdrop');
  });

  it('the backdrop swells (but stays a wash) when nobody is singing', () => {
    const singing = computeFrame(build(), 20000, env).artwork.alpha;
    const idle = computeFrame(tlGap, 5000, env).artwork.alpha;
    expect(idle).toBeGreaterThan(singing);
    expect(idle).toBeLessThan(0.6);
  });

  it('an intro gap runs the show: aurora, rings, ribbons, particles, orbiting doodles and a mood emoji', () => {
    const f = computeFrame(tlGap, 5000, env);
    expect(f.words).toHaveLength(0);
    expect(f.interlude.amount).toBeGreaterThan(0.9);
    expect(f.interlude.aurora.length).toBeGreaterThanOrEqual(2);
    expect(f.interlude.ribbons).toHaveLength(2);
    expect(f.interlude.particles.length).toBeGreaterThan(20);
    expect(f.doodles.filter((d) => d.id.startsWith('int:')).length).toBeGreaterThanOrEqual(3);
    expect(f.icons.some((e) => e.id === 'int:mood' && e.sizePx > 10)).toBe(true);
    expect(f.marquee.length).toBeGreaterThan(0); // the song title scrolls behind it
  });

  it('the show is silent while lyrics are on screen and fades in/out smoothly around breaks', () => {
    const tl = build();
    const inLine = tl.scenes[3]!;
    expect(computeFrame(tl, inLine.startMs + 400, env).interlude.amount).toBe(0);
    const g = tl.gaps.find((x) => x.endMs - x.startMs > 3000)!;
    const samples = [g.startMs + 100, g.startMs + 500, g.startMs + 1500, g.endMs - 300, g.endMs + 50].map((ms) => computeFrame(tl, ms, env).interlude.amount);
    expect(samples[0]).toBeLessThan(samples[2]!);
    expect(samples[2]).toBeGreaterThan(0.95);
    expect(samples[4]).toBe(0);
    for (const v of samples) expect(v).toBeGreaterThanOrEqual(0);
  });

  it('a song with NO lyrics gets the show the whole time, pulsing on its beat grid', () => {
    for (let ms = 1500; ms < 120000; ms += 4000) expect(computeFrame(noLyrics, ms, env).interlude.amount).toBeGreaterThan(0.9);
    // rings are born on beats: right after a beat there is a young ring, with growing radius as it ages
    const beat = noLyrics.beatTimesMs[20]!;
    const young = computeFrame(noLyrics, beat + 100, env).interlude.rings;
    const older = computeFrame(noLyrics, beat + 900, env).interlude.rings;
    expect(young.length).toBeGreaterThan(0);
    expect(Math.max(...older.map((r) => r.r))).toBeGreaterThan(Math.max(...young.map((r) => r.r)));
  });

  it('works without a beat grid (e.g. Spotify) using a steady pseudo-beat, deterministically', () => {
    const noBeats = compileTimeline({ source: 'manual', licenseSource: 'none', lines: [] }, { trackId: 's', durationMs: 90000, palette: t.palette });
    const f = computeFrame(noBeats, 12345, env);
    expect(f.interlude.rings.length).toBeGreaterThan(0);
    expect(JSON.stringify(computeFrame(noBeats, 12345, env))).toBe(JSON.stringify(f));
  });

  it('is seek-safe: any time gives the same frame regardless of what was rendered before', () => {
    const a = JSON.stringify(computeFrame(noLyrics, 61234, env));
    for (let ms = 0; ms < 61234; ms += 700) computeFrame(noLyrics, ms, env);
    expect(JSON.stringify(computeFrame(JSON.parse(JSON.stringify(noLyrics)), 61234, env))).toBe(a);
  });

  it('density, toggles and reduced motion scale it down: calm static aurora only, nothing moving', () => {
    const full = computeFrame(noLyrics, 20000, env);
    const low = computeFrame(noLyrics, 20000, { ...env, density: 0.35 });
    expect(low.interlude.particles.length).toBeLessThan(full.interlude.particles.length * 0.5);
    expect(low.doodles.length).toBeLessThanOrEqual(full.doodles.length);
    expect(computeFrame(noLyrics, 20000, { ...env, doodles: false }).doodles).toHaveLength(0);
    expect(computeFrame(noLyrics, 20000, { ...env, emojis: false }).icons).toHaveLength(0);
    const calm = computeFrame(noLyrics, 20000, { ...env, reducedMotion: true });
    expect(calm.interlude.aurora.length).toBeGreaterThan(0);
    expect(calm.interlude.rings).toHaveLength(0);
    expect(calm.interlude.ribbons).toHaveLength(0);
    expect(calm.interlude.particles).toHaveLength(0);
    expect(calm.doodles).toHaveLength(0);
    // and the calm version does not animate with time
    expect(JSON.stringify(computeFrame(noLyrics, 20000, { ...env, reducedMotion: true }).interlude.aurora)).toBe(JSON.stringify(computeFrame(noLyrics, 33000, { ...env, reducedMotion: true }).interlude.aurora));
  });

  it('keeps text readable and every number finite during the show', () => {
    for (let ms = 0; ms < 120000; ms += 2500) {
      const f = computeFrame(noLyrics, ms, env);
      expect(contrastRatio(f.textColor, f.bg.c0)).toBeGreaterThan(3);
      for (const r of f.interlude.rings) expect(Number.isFinite(r.r) && Number.isFinite(r.alpha)).toBe(true);
      for (const p of f.interlude.particles) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      for (const d of f.doodles) expect(Number.isFinite(d.x) && Number.isFinite(d.y) && Number.isFinite(d.size)).toBe(true);
    }
  });
});

describe('visual cues from the cover', () => {
  const dim = { light: 0.25, focal: { x: 0.8, y: 0.2 }, vibrance: 0.7 };
  const bright = { light: 0.8, focal: { x: 0.3, y: 0.7 }, vibrance: 0.7 };

  it('timeline accepts and stores the cues', () => {
    const tl = build(dim);
    expect(visualTimelineSchema.safeParse(tl).success).toBe(true);
    expect(tl.cover).toEqual(dim);
  });

  it('a glow sits at the cover\'s focal point, in the album color, and is off without cues or in pure-mood mode', () => {
    const f = computeFrame(build(dim), 20000, env);
    expect(f.bg.glow).toMatchObject({ x: 0.8, y: 0.2 });
    expect(f.bg.glow!.alpha).toBeGreaterThan(0.1);
    expect(computeFrame(build(), 20000, env).bg.glow).toBeNull();
    expect(computeFrame(build(dim), 20000, { ...env, colorMode: 'emotion' }).bg.glow).toBeNull();
  });

  it('a bright cover gets a bright ground with dark, readable text; a dark cover keeps the dark ground', () => {
    const dark = computeFrame(build(dim), 12000, env);
    const light = computeFrame(build(bright), 12000, env);
    const lum = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
    expect(lum(light.bg.c0)).toBeGreaterThan(lum(dark.bg.c0) + 150);
    expect(contrastRatio(light.textColor, light.bg.c0)).toBeGreaterThan(3);
    expect(contrastRatio(light.textColor, light.bg.c1)).toBeGreaterThan(3);
  });

  it('doodles gather toward the cover\'s focal point (compared with no cues)', () => {
    const avgX = (tl: ReturnType<typeof build>) => {
      const xs: number[] = [];
      for (let ms = 4000; ms < 44000; ms += 400) for (const d of computeFrame(tl, ms, env).doodles) xs.push(d.x);
      return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    };
    const right = avgX(build({ light: 0.3, focal: { x: 0.95, y: 0.5 }, vibrance: 0.8 }));
    const left = avgX(build({ light: 0.3, focal: { x: 0.05, y: 0.5 }, vibrance: 0.8 }));
    expect(right).toBeGreaterThan(left + 40);
  });

  it('text stays readable with cover cues in every color mode', () => {
    for (const cover of [dim, bright]) {
      const tl = build(cover);
      for (const colorMode of ['blend', 'album', 'emotion'] as const) {
        for (let ms = 3000; ms < 44000; ms += 3500) {
          const f = computeFrame(tl, ms, { ...env, colorMode });
          expect(contrastRatio(f.textColor, f.bg.c0)).toBeGreaterThan(3);
          expect(contrastRatio(f.textColor, f.bg.c1)).toBeGreaterThan(3);
        }
      }
    }
  });

  it('blend mode leans on the album: its first accent is closer to the cover color than to pure mood color', () => {
    const tl = build(dim);
    const ms = 20000;
    const album = computeFrame(tl, ms, { ...env, colorMode: 'album' }).palette[0]!;
    const blend = computeFrame(tl, ms, { ...env, colorMode: 'blend' }).palette[0]!;
    const emo = computeFrame(tl, ms, { ...env, colorMode: 'emotion' }).palette[0]!;
    const d = (a: string, b: string) => [1, 3, 5].reduce((s, i) => s + Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)), 0);
    expect(d(blend, album)).toBeLessThan(d(blend, emo));
  });
});

describe('palette extraction reports brightness and focal point', () => {
  const img = (f: (x: number, y: number) => [number, number, number], n = 48) => {
    const d = new Uint8ClampedArray(n * n * 4);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) d.set([...f(x, y), 255], (y * n + x) * 4);
    return d;
  };

  it('finds the focal point where the vivid, bright color is', () => {
    const p = paletteFromPixels(img((x, y) => (x > 34 && y < 14 ? [255, 120, 0] : [30, 30, 40])))!;
    expect(p.focal.x).toBeGreaterThan(0.65);
    expect(p.focal.y).toBeLessThan(0.35);
    const q = paletteFromPixels(img((x, y) => (x < 12 && y > 34 ? [0, 200, 255] : [30, 30, 40])))!;
    expect(q.focal.x).toBeLessThan(0.35);
    expect(q.focal.y).toBeGreaterThan(0.65);
  });

  it('reports light vs dark covers', () => {
    expect(paletteFromPixels(img(() => [240, 220, 200]))!.light).toBeGreaterThan(0.7);
    expect(paletteFromPixels(img(() => [20, 10, 40]))!.light).toBeLessThan(0.2);
  });
});

describe('adaptive quality governor', () => {
  const feed = (g: FrameGovernor, dt: number, frames: number, start = 0) => {
    let now = start;
    let changed: string | null = null;
    for (let i = 0; i < frames; i++) {
      now += dt;
      const r = g.push(dt, now);
      if (r) changed = r;
    }
    return { now, changed };
  };

  it('stays high on a smooth 60 fps stream', () => {
    const g = new FrameGovernor('high');
    feed(g, 16.7, 600);
    expect(g.level).toBe('high');
  });

  it('steps down when frames take ~100 ms, and keeps stepping until it reaches "low"', () => {
    const g = new FrameGovernor('high');
    let now = 0;
    const seen: string[] = [];
    for (let round = 0; round < 6; round++) {
      const r = feed(g, 100, 60, now);
      now = r.now;
      if (r.changed) seen.push(r.changed);
    }
    expect(seen).toEqual(['medium', 'low']);
    expect(g.level).toBe('low');
  });

  it('ignores a few slow frames (spikes) and hidden-tab gaps', () => {
    const g = new FrameGovernor('high');
    let now = 0;
    for (let i = 0; i < 300; i++) {
      const dt = i % 15 === 0 ? 90 : 16.7; // occasional hitch
      now += dt;
      g.push(dt, now);
    }
    expect(g.level).toBe('high');
    // a tab switched away for 5 s is not "lag"
    g.push(5000, now + 5000);
    expect(g.level).toBe('high');
  });

  it('recovers one level only after a long smooth stretch (no flapping)', () => {
    const g = new FrameGovernor('low', { upAfterMs: 5000 });
    let now = 0;
    now = feed(g, 16.7, 200, now).now; // ~3.3 s: not long enough
    expect(g.level).toBe('low');
    now = feed(g, 16.7, 400, now).now;
    expect(g.level).toBe('medium');
    expect(LEVELS.indexOf(g.level)).toBe(1);
  });

  it('a user-pinned level resets history', () => {
    const g = new FrameGovernor('high');
    g.reset('low', 0);
    expect(g.level).toBe('low');
  });

  it('profiles get strictly lighter, and the pixel budget bounds work on huge screens', () => {
    const d = LEVELS.map((l) => QUALITY_PROFILE[l].density);
    expect(d).toEqual([...d].sort((a, b) => b - a));
    expect(QUALITY_PROFILE.low.grain || QUALITY_PROFILE.low.halftone).toBe(false);
    expect(QUALITY_PROFILE.high.dprCap).toBeGreaterThan(QUALITY_PROFILE.low.dprCap - 0.01);
    // 4K fullscreen at DPR 1.5 would be 18.7M px; the budget caps the device pixels well below that
    const cssPx = 3840 * 2160;
    const dpr = Math.min(1.5, Math.sqrt(PIXEL_BUDGET / cssPx));
    expect(cssPx * dpr * dpr).toBeLessThanOrEqual(PIXEL_BUDGET * 1.01);
  });
});

describe('density scales the decoration (fewer doodles/emoji on slow machines)', () => {
  const tl = build();
  const count = (density: number) => {
    let d = 0;
    let e = 0;
    for (let ms = 2000; ms < 44000; ms += 200) {
      const f = computeFrame(tl, ms, { ...env, density });
      d += f.doodles.length;
      e += f.icons.length;
    }
    return { d, e };
  };

  it('low density draws far fewer doodles and emoji than full density', () => {
    const full = count(1);
    const low = count(0.35);
    expect(low.d).toBeLessThan(full.d * 0.7);
    expect(low.e).toBeLessThanOrEqual(full.e);
    expect(full.d).toBeGreaterThan(50);
  });

  it('is still deterministic at a given density', () => {
    expect(JSON.stringify(computeFrame(tl, 20000, { ...env, density: 0.5 }))).toBe(JSON.stringify(computeFrame(tl, 20000, { ...env, density: 0.5 })));
  });
});
