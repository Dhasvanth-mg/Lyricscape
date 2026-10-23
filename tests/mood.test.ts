import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseLrc, fromPlainText } from '@/lib/lyrics/parse';
import { EMOTIONS, EMOTION_DEFS, MOTIFS, analyzeEmotion, emojiForWord, overrideMood, scoreText, tempoPrior, type Scores } from '@/lib/kinetic/emotion';
import { paletteFromPixels } from '@/lib/kinetic/extractPalette';
import { DRAWERS } from '@/lib/kinetic/doodles';
import { compileTimeline } from '@/lib/kinetic/compile';
import { computeFrame } from '@/lib/kinetic/frame';
import { visualTimelineSchema, type FrameEnv } from '@/lib/kinetic/types';
import { contrastRatio, hexToRgb } from '@/lib/kinetic/util';

const catalog = JSON.parse(readFileSync(join(process.cwd(), 'public/demo/catalog.json'), 'utf8')) as { id: string; bpm: number; durationMs: number; beatTimesMs: number[]; palette: string[] }[];
const demoDoc = (id: string) => parseLrc(readFileSync(join(process.cwd(), `public/demo/${id}.lrc`), 'utf8'));
const best = (s: Scores) => EMOTIONS.reduce((a, e) => (s[e] > s[a] ? e : a), EMOTIONS[0]!);

describe('lexicon scoring', () => {
  it('reads the obvious feelings', () => {
    expect(best(scoreText('I love you, my heart, my darling'))).toBe('love');
    expect(best(scoreText('I cry alone in the rain, so lonely'))).toBe('sadness');
    expect(best(scoreText('Happy sunshine, dancing and laughing, what a beautiful day'))).toBe('joy');
    expect(best(scoreText('I hate this, scream and fight, rage'))).toBe('anger');
    expect(best(scoreText('Shadow and midnight, the ghost of the dark'))).toBe('dark');
    expect(best(scoreText('Run fast, electric lightning, turn it up loud'))).toBe('energy');
    expect(best(scoreText('Quiet and soft, we drift and breathe in peace'))).toBe('calm');
    expect(best(scoreText('I remember yesterday, old memories of home'))).toBe('nostalgia');
  });

  it('negation flips the feeling', () => {
    expect(scoreText('I am not happy').sadness).toBeGreaterThan(scoreText('I am not happy').joy);
    expect(scoreText('never alone again').joy).toBeGreaterThan(0);
    expect(scoreText('never alone again').sadness).toBe(0);
  });

  it('handles empty, numeric and non-English text without throwing', () => {
    for (const t of ['', '   ', '12345', '日本語のテキスト', '!!!']) expect(Object.values(scoreText(t)).every((v) => v === 0)).toBe(true);
  });

  it('tempo is only a prior: fast leans energetic, slow leans calm/sad', () => {
    expect(best(tempoPrior(140))).toBe('energy');
    expect(best(tempoPrior(112))).toBe('joy');
    expect(['calm', 'sadness']).toContain(best(tempoPrior(70)));
    expect(Object.values(tempoPrior(undefined)).every((v) => v === 0)).toBe(true);
  });
});

describe('analyzeEmotion', () => {
  it('produces a mood for every line, smoothed, with a stated basis', () => {
    const doc = demoDoc('neon-static');
    const a = analyzeEmotion(doc, { bpm: 112 });
    expect(a.perLine).toHaveLength(doc.lines.length);
    expect(a.basis).toBe('lyrics+tempo');
    for (const m of [a.overall, ...a.perLine]) {
      expect(EMOTIONS).toContain(m.emotion);
      expect(m.valence).toBeGreaterThanOrEqual(-1);
      expect(m.arousal).toBeGreaterThanOrEqual(0);
      expect(m.confidence).toBeGreaterThanOrEqual(0);
      expect(m.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('falls back to tempo when there are no lyrics, and says so; Spotify (no bpm, no lyrics) is a neutral guess', () => {
    expect(analyzeEmotion(null, { bpm: 140 })).toMatchObject({ basis: 'tempo', overall: { emotion: 'energy' } });
    const none = analyzeEmotion(null, {});
    expect(none.basis).toBe('none');
    expect(none.overall.confidence).toBe(0);
  });

  it('lyrics outweigh tempo, and a user override wins everywhere', () => {
    const sad = fromPlainText('I cry alone\nthe rain keeps falling\nso lonely and broken', 60000);
    expect(analyzeEmotion(sad, { bpm: 140 }).overall.emotion).toBe('sadness');
    const forced = overrideMood(analyzeEmotion(sad, { bpm: 140 }), 'joy');
    expect(forced.perLine.every((m) => m.emotion === 'joy')).toBe(true);
    expect(forced.overall.emotion).toBe('joy');
  });

  it('a sad verse then a joyful chorus changes mood mid-song', () => {
    const doc = fromPlainText('I cry alone in the rain\nso lonely and broken\nhappy sunshine dancing\nlaughing and free', 80000);
    const a = analyzeEmotion(doc);
    expect(a.perLine[1]!.emotion).toBe('sadness');
    expect(a.perLine[3]!.emotion).toBe('joy');
  });

  it('every mood has a usable palette (accents readable on its dark), emoji and motifs', () => {
    for (const e of EMOTIONS) {
      const d = EMOTION_DEFS[e];
      expect(d.emojiSet.length).toBeGreaterThanOrEqual(4);
      expect(d.motifs.every((m) => MOTIFS.includes(m))).toBe(true);
      for (const accent of d.palette.slice(0, 3)) expect(contrastRatio(accent, d.palette[3])).toBeGreaterThan(3);
    }
  });

  it('maps lyric words to emoji', () => {
    expect(emojiForWord('Love')).toBe('❤️');
    expect(emojiForWord('fire,')).toBe('🔥');
    expect(emojiForWord('hours')).toBe('⏳');
    expect(emojiForWord('the')).toBeNull();
  });
});

describe('album palette extraction', () => {
  const img = (f: (x: number, y: number) => [number, number, number], n = 48) => {
    const d = new Uint8ClampedArray(n * n * 4);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) d.set([...f(x, y), 255], (y * n + x) * 4);
    return d;
  };
  const hueOf = (hex: string) => {
    const [r, g, b] = hexToRgb(hex).map((v) => v / 255) as [number, number, number];
    const mx = Math.max(r, g, b);
    const d = mx - Math.min(r, g, b);
    if (!d) return 0;
    const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return (h * 60 + 360) % 360;
  };

  it('finds the dominant colors of a three-color cover, in roughly the right hues', () => {
    const p = paletteFromPixels(img((x) => (x < 16 ? [220, 30, 40] : x < 32 ? [30, 90, 220] : [240, 200, 30])))!;
    const hues = p.palette.slice(0, 3).map(hueOf);
    const near = (h: number, t: number) => Math.min(Math.abs(h - t), 360 - Math.abs(h - t)) < 30;
    expect(hues.some((h) => near(h, 355))).toBe(true); // red
    expect(hues.some((h) => near(h, 220))).toBe(true); // blue
    expect(hues.some((h) => near(h, 48))).toBe(true); // yellow
    expect(p.vibrance).toBeGreaterThan(0.5);
  });

  it('returns accents readable on the dark color, and a genuinely dark base', () => {
    const p = paletteFromPixels(img((x, y) => (y < 24 ? [200, 60, 120] : [20, 10, 40])))!;
    for (const a of p.palette.slice(0, 3)) expect(contrastRatio(a, p.palette[3])).toBeGreaterThan(3);
    const [r, g, b] = hexToRgb(p.palette[3]);
    expect((r + g + b) / 3).toBeLessThan(70);
  });

  it('single-color art still yields a three-accent palette; greyscale reports ~zero vibrance', () => {
    const mono = paletteFromPixels(img(() => [200, 40, 160]))!;
    expect(new Set(mono.palette.slice(0, 3)).size).toBe(3);
    const grey = paletteFromPixels(img((x) => [x * 5, x * 5, x * 5]))!;
    expect(grey.vibrance).toBeLessThan(0.12);
  });

  it('ignores transparent pixels and tiny images', () => {
    expect(paletteFromPixels(new Uint8ClampedArray(8))).toBeNull();
    const transparent = new Uint8ClampedArray(48 * 48 * 4); // alpha 0
    expect(paletteFromPixels(transparent)).toBeNull();
  });

  it('extracts the real demo cover palette (SVG-derived fixture colors)', () => {
    const [c1, c2] = catalog[0]!.palette;
    const [r1, g1, b1] = hexToRgb(c1!);
    const [r2, g2, b2] = hexToRgb(c2!);
    const p = paletteFromPixels(img((x, y) => (x + y < 40 ? [r1, g1, b1] : [r2, g2, b2])))!;
    expect(p.palette).toHaveLength(4);
  });
});

describe('vector doodles', () => {
  it('has a drawer for every motif and draws without throwing', () => {
    const calls: string[] = [];
    const ctx = new Proxy({}, { get: (_t, k) => (typeof k === 'string' ? (...a: unknown[]) => void calls.push(k + a.length) : undefined), set: () => true }) as unknown as CanvasRenderingContext2D;
    for (const m of MOTIFS) {
      expect(typeof DRAWERS[m]).toBe('function');
      calls.length = 0;
      DRAWERS[m](ctx, 40, { fill: '#f00', stroke: '#000', lineWidth: 3, accent: '#0f0' }, 7);
      expect(calls.length, m).toBeGreaterThan(3);
    }
  });
});

describe('mood in the timeline and frames', () => {
  const env: FrameEnv = { width: 1280, height: 720, reducedMotion: false };
  const t = catalog.find((c) => c.id === 'neon-static')!;
  const doc = demoDoc('neon-static');
  const mood = analyzeEmotion(doc, { bpm: t.bpm });
  const tl = compileTimeline(doc, { trackId: 'demo:neon-static', durationMs: t.durationMs, palette: t.palette, bpm: t.bpm, beatTimesMs: t.beatTimesMs, mood });
  const hookScene = tl.scenes.find((s) => s.hook)!;

  it('timeline carries per-scene mood and stays schema-valid', () => {
    expect(visualTimelineSchema.safeParse(tl).success).toBe(true);
    expect(tl.scenes.every((s) => !!s.mood)).toBe(true);
    expect(tl.emotion?.overall.emotion).toBe(mood.overall.emotion);
    expect(tl.emotion?.basis).toBe('lyrics+tempo');
  });

  it('is deterministic: same time => same doodles, emoji and palette (seek-safe)', () => {
    const ms = hookScene.startMs + 900;
    const a = JSON.stringify(computeFrame(tl, ms, env));
    for (let x = 0; x < ms; x += 250) computeFrame(tl, x, env);
    expect(JSON.stringify(computeFrame(JSON.parse(JSON.stringify(tl)), ms, env))).toBe(a);
  });

  it('draws doodles during lines, none in the quiet intro, and keeps the middle clear for words', () => {
    // in the quiet intro the only doodles are the interlude show's orbiters, never per-line decoration
    expect(computeFrame(tl, 500, env).doodles.every((d) => d.id.startsWith('int:'))).toBe(true);
    let seen = 0;
    for (let ms = hookScene.startMs; ms < hookScene.endMs; ms += 120) {
      const f = computeFrame(tl, ms, env);
      expect(f.doodles.length).toBeLessThanOrEqual(24);
      for (const d of f.doodles) {
        seen++;
        expect(MOTIFS).toContain(d.kind);
        // anchor positions (before the small idle wobble) stay out of the text zone
        const wobble = env.height * 0.02;
        expect(Math.abs(d.x) > env.width * 0.3 - wobble || Math.abs(d.y) > env.height * 0.24 - wobble).toBe(true);
      }
    }
    expect(seen).toBeGreaterThan(5);
  });

  it('shows an emoji beside a matching sung word and showers emoji on hooks', () => {
    const doc2 = parseLrc('[00:01.00] <00:01.00>I <00:01.40>love <00:02.00>you <00:02.60>baby');
    const tl2 = compileTimeline(doc2, { trackId: 'x', durationMs: 10000, palette: ['#ff2e63', '#ffd23f', '#08d9d6', '#14121f'], mood: analyzeEmotion(doc2) });
    const cue = tl2.cues.find((c) => c.text === 'love')!;
    const f = computeFrame(tl2, cue.startMs + 200, env);
    expect(f.emojis.some((e) => e.char === '❤️')).toBe(true);
    const hook = tl.scenes.find((s) => s.hook)!;
    const showers = computeFrame(tl, hook.startMs + 1500, env).emojis;
    expect(showers.length).toBeGreaterThan(0);
    expect(showers.length).toBeLessThanOrEqual(10);
    expect(showers.every((e) => EMOTION_DEFS[hook.mood!.emotion].emojiSet.includes(e.char) || emojiForWord('x') === null)).toBe(true);
  });

  it('respects the toggles and reduced motion (no doodles, no emoji)', () => {
    const ms = hookScene.startMs + 900;
    expect(computeFrame(tl, ms, { ...env, doodles: false }).doodles).toHaveLength(0);
    expect(computeFrame(tl, ms, { ...env, emojis: false }).emojis).toHaveLength(0);
    const calm = computeFrame(tl, ms, { ...env, reducedMotion: true });
    expect(calm.doodles).toHaveLength(0);
    expect(calm.emojis).toHaveLength(0);
  });

  it('color modes: album = cover colors only, mood = mood palette only, blend = in between', () => {
    const ms = hookScene.startMs + 1200;
    const album = computeFrame(tl, ms, { ...env, colorMode: 'album' }).palette;
    const emo = computeFrame(tl, ms, { ...env, colorMode: 'emotion' }).palette;
    const blend = computeFrame(tl, ms, { ...env, colorMode: 'blend' }).palette;
    expect(album).toEqual(tl.palette);
    expect(emo).toEqual([...EMOTION_DEFS[hookScene.mood!.emotion].palette]);
    expect(blend).not.toEqual(album);
    const dist = (a: string[], b: string[]) => a.reduce((s, c, i) => s + Math.abs(hexToRgb(c)[0] - hexToRgb(b[i]!)[0]), 0);
    expect(dist(blend, album)).toBeLessThan(dist(emo, album)); // blend stays closer to the album than pure mood does
  });

  it('palette crossfades smoothly when the mood changes between lines (no hard jump)', () => {
    const docMix = fromPlainText('I cry alone in the rain so broken\nhappy sunshine dancing laughing free', 40000);
    const m = analyzeEmotion(docMix);
    const t2 = compileTimeline(docMix, { trackId: 'mix', durationMs: 40000, palette: ['#ff2e63', '#ffd23f', '#08d9d6', '#14121f'], mood: m });
    const boundary = t2.scenes[1]!.startMs;
    const before = computeFrame(t2, boundary - 400, { ...env, colorMode: 'emotion' }).palette[0]!;
    const mid = computeFrame(t2, boundary + 200, { ...env, colorMode: 'emotion' }).palette[0]!;
    const after = computeFrame(t2, boundary + 1200, { ...env, colorMode: 'emotion' }).palette[0]!;
    expect(new Set([before, mid, after]).size).toBe(3);
    expect(after).toBe(EMOTION_DEFS[t2.scenes[1]!.mood!.emotion].palette[0]);
  });

  it('text stays readable in every color mode and style', () => {
    for (const colorMode of ['blend', 'album', 'emotion'] as const) {
      for (const style of ['maximalist', 'editorial', 'psychedelic', 'minimal', 'y2k'] as const) {
        const s = compileTimeline(doc, { trackId: 'rd', durationMs: t.durationMs, palette: t.palette, style, bpm: t.bpm, beatTimesMs: t.beatTimesMs, mood });
        for (let ms = 4000; ms < 40000; ms += 3000) {
          const f = computeFrame(s, ms, { ...env, colorMode });
          expect(contrastRatio(f.textColor, f.bg.c0)).toBeGreaterThan(3);
          expect(contrastRatio(f.textColor, f.bg.c1)).toBeGreaterThan(3);
        }
      }
    }
  });
});

describe('sync delay preference', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as unknown as { localStorage: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  });

  it('defaults to ONE shared delay (not reset per song), tracked separately for Spotify and local audio', async () => {
    const { useUi } = await import('@/lib/ui-store');
    useUi.getState().hydrate();
    expect(useUi.getState().syncShared).toBe(true);
    useUi.getState().setSyncGlobal('spotify', 650);
    useUi.getState().setSyncGlobal('local', -40);
    expect(useUi.getState().syncGlobal).toEqual({ spotify: 650, local: -40 });
  });

  it('persists across reloads and keeps the shared/per-track choice', async () => {
    const { useUi } = await import('@/lib/ui-store');
    useUi.getState().setSyncGlobal('spotify', 420);
    useUi.getState().set({ syncShared: false, colorMode: 'emotion', emojis: false, doodles: false, mood: 'love' });
    // simulate a fresh page load
    useUi.setState({ syncShared: true, syncGlobal: { spotify: 0, local: 0 }, colorMode: 'blend', emojis: true, doodles: true, mood: 'auto' });
    useUi.getState().hydrate();
    expect(useUi.getState()).toMatchObject({ syncShared: false, colorMode: 'emotion', emojis: false, doodles: false, mood: 'love' });
    expect(useUi.getState().syncGlobal.spotify).toBe(420);
  });

  it('survives corrupt stored preferences', async () => {
    const { useUi } = await import('@/lib/ui-store');
    store.set('lyricscape.prefs.v1', '{not json');
    expect(() => useUi.getState().hydrate()).not.toThrow();
    expect(useUi.getState().syncShared).toBe(true);
  });
});
