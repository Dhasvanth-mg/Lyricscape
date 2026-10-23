import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLrc } from '@/lib/lyrics/parse';
import { compileTimeline, gridFromBpm, sceneAt } from '@/lib/kinetic/compile';
import { computeFrame, beatStateAt, LEAD_MS } from '@/lib/kinetic/frame';
import { STYLE_IDS, visualTimelineSchema, type FrameEnv } from '@/lib/kinetic/types';
import { contrastRatio, mulberry32 } from '@/lib/kinetic/util';

const catalog = JSON.parse(readFileSync(join(process.cwd(), 'public/demo/catalog.json'), 'utf8')) as {
  id: string;
  durationMs: number;
  bpm: number;
  beatTimesMs: number[];
  palette: string[];
}[];
const lrc = (id: string) => readFileSync(join(process.cwd(), `public/demo/${id}.lrc`), 'utf8');

const env: FrameEnv = { width: 1280, height: 720, reducedMotion: false };

function build(id = 'neon-static', style: (typeof STYLE_IDS)[number] = 'maximalist') {
  const t = catalog.find((c) => c.id === id)!;
  const doc = parseLrc(lrc(id), 'CC0 demo');
  return compileTimeline(doc, { trackId: `demo:${id}`, durationMs: t.durationMs, palette: t.palette, bpm: t.bpm, beatTimesMs: t.beatTimesMs, style });
}

describe('compileTimeline', () => {
  it('produces a schema-valid timeline for every style', () => {
    for (const style of STYLE_IDS) {
      const tl = build('paper-planets', style);
      expect(visualTimelineSchema.safeParse(tl).success).toBe(true);
      expect(tl.scenes.length).toBeGreaterThan(5);
    }
  });

  it('is deterministic: same input => byte-identical timeline', () => {
    expect(JSON.stringify(build())).toBe(JSON.stringify(build()));
  });

  it('marks repeated lines as hooks and long pauses/outros as instrumental gaps', () => {
    const tl = build('neon-static');
    const hooks = tl.scenes.filter((s) => s.hook);
    expect(hooks.length).toBeGreaterThanOrEqual(4);
    expect(tl.gaps.length).toBeGreaterThanOrEqual(2);
    expect(tl.gaps[0]!.startMs).toBe(0); // intro
    expect(tl.effects.some((e) => e.preset === 'chorusInvert')).toBe(true);
  });

  it('falls back to a BPM grid when no beats are supplied', () => {
    const doc = parseLrc('[00:01.00] a b c');
    const tl = compileTimeline(doc, { trackId: 'x', durationMs: 10000, palette: ['#fff', '#000'], bpm: 120 });
    expect(tl.beatTimesMs.slice(0, 3)).toEqual([0, 500, 1000]);
    expect(gridFromBpm(60, 3000)).toEqual([0, 1000, 2000]);
  });
});

describe('beatStateAt', () => {
  const beats = [0, 500, 1000, 1500, 2000];
  it('pulses right after a beat and decays', () => {
    const on = beatStateAt(beats, 1000);
    const later = beatStateAt(beats, 1400);
    expect(on.pulse).toBeGreaterThan(later.pulse);
    expect(on.index).toBe(2);
    expect(beatStateAt(beats, -5).index).toBe(-1);
  });
});

describe('computeFrame determinism & seeking', () => {
  const tl = build('neon-static');

  it('returns identical frames for identical times, regardless of call order', () => {
    const rnd = mulberry32(42);
    const times = Array.from({ length: 60 }, () => Math.floor(rnd() * tl.durationMs));
    const first = times.map((t) => JSON.stringify(computeFrame(tl, t, env)));
    // visit in reverse and shuffled order, with a *fresh* timeline object to bypass the layout cache
    const tl2 = JSON.parse(JSON.stringify(tl));
    const reversed = [...times].reverse().map((t) => JSON.stringify(computeFrame(tl2, t, env))).reverse();
    expect(reversed).toEqual(first);
  });

  it('seeking directly to a timestamp equals playing up to it', () => {
    const target = tl.scenes[6]!.startMs + 600;
    const direct = JSON.stringify(computeFrame(tl, target, env));
    for (let t = 0; t < target; t += 33) computeFrame(tl, t, env); // "playback"
    expect(JSON.stringify(computeFrame(tl, target, env))).toBe(direct);
  });

  it('never shows a word outside its scene window (no wrong words after seeks)', () => {
    const byId = new Map(tl.scenes.flatMap((s) => s.words.map((w) => [w.id, { w, s }] as const)));
    for (let t = 0; t < tl.durationMs; t += 97) {
      const f = computeFrame(tl, t, env);
      for (const id of f.visibleWordIds) {
        const { w, s } = byId.get(id)!;
        expect(t).toBeGreaterThanOrEqual(w.startMs - LEAD_MS);
        expect(t).toBeLessThanOrEqual(s.endMs + 400);
      }
    }
  });

  it('shows the sung word as active and future words of the line as hidden', () => {
    const scene = tl.scenes.find((s) => s.words.length >= 4 && s.preset !== 'cut')!;
    const mid = scene.words[1]!;
    const f = computeFrame(tl, mid.startMs + 20, env);
    expect(f.sceneId).toBe(scene.id);
    expect(f.activeWordId).toBe(mid.id);
    expect(f.visibleWordIds).toContain(scene.words[0]!.id);
    expect(f.visibleWordIds).toContain(mid.id);
    expect(f.visibleWordIds).not.toContain(scene.words[scene.words.length - 1]!.id);
  });

  it('renders no words in the intro gap, and the cover stays in the background (never pops forward by default)', () => {
    const gap = tl.gaps[0]!;
    const f = computeFrame(tl, gap.startMs + Math.min(2000, (gap.endMs - gap.startMs) / 2), env);
    expect(f.words).toHaveLength(0);
    for (let t = 0; t < tl.durationMs; t += 400) expect(computeFrame(tl, t, env).artwork.mode).toBe('backdrop');
  });

  it('clears the screen after the last line has exited', () => {
    const f = computeFrame(tl, tl.durationMs, env);
    expect(f.words).toHaveLength(0);
  });

  it('inverts the background during chorus (hook) scenes', () => {
    const hook = tl.scenes.find((s) => s.hook)!;
    expect(computeFrame(tl, hook.startMs + 400, env).bg.invert).toBe(true);
    expect(computeFrame(tl, 100, env).bg.invert).toBe(false);
  });

  it('works on portrait viewports and keeps every word within the width budget', () => {
    const portrait: FrameEnv = { width: 390, height: 844, reducedMotion: false };
    for (let t = 0; t < tl.durationMs; t += 211) {
      const f = computeFrame(tl, t, portrait);
      for (const w of f.words) {
        expect(Number.isFinite(w.x) && Number.isFinite(w.y) && Number.isFinite(w.sizePx)).toBe(true);
        expect(w.sizePx).toBeGreaterThan(4);
        expect(w.maxWidthPx).toBeLessThanOrEqual(390);
      }
    }
  });
});

describe('reduced motion & accessibility', () => {
  const tl = build('glass-hours', 'psychedelic');
  it('removes rotation, skew, shake, camera motion and flashes', () => {
    const reduced: FrameEnv = { ...env, reducedMotion: true };
    for (let t = 0; t < tl.durationMs; t += 83) {
      const f = computeFrame(tl, t, reduced);
      expect(f.camera.zoom).toBe(1);
      expect(f.camera.rotationDeg).toBe(0);
      expect(f.overlays.flash).toBe(0);
      expect(f.marquee).toHaveLength(0);
      for (const w of f.words) {
        expect(w.rotationDeg).toBe(0);
        expect(w.skewX).toBe(0);
        expect(w.split).toBe(0);
        expect(w.scaleX).toBe(1);
        expect(w.echo).toBe(0);
      }
    }
  });

  it('limits flashing intensity (<= 12% white at any time)', () => {
    for (let t = 0; t < tl.durationMs; t += 20) expect(computeFrame(tl, t, env).overlays.flash).toBeLessThanOrEqual(0.12);
  });

  it('keeps text readable against the background for every style', () => {
    for (const style of STYLE_IDS) {
      const s = build('neon-static', style);
      for (let t = 4000; t < 30000; t += 1500) {
        const f = computeFrame(s, t, env);
        // worst case across both gradient stops
        expect(contrastRatio(f.textColor, f.bg.c0)).toBeGreaterThan(3);
        expect(contrastRatio(f.textColor, f.bg.c1)).toBeGreaterThan(3);
      }
    }
  });
});

describe('sceneAt', () => {
  it('finds the current scene by binary search', () => {
    const tl = build();
    const s = tl.scenes[3]!;
    expect(sceneAt(tl, s.startMs + 10)?.id).toBe(s.id);
    expect(sceneAt(tl, 0)).toBeNull();
  });
});
