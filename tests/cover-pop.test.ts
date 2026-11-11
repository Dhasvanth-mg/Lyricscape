// Cover Pop (Phase 3): cover reading, crop paths, phrase splitting and layouts, the song plan's rules, and asset ids.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileTimeline } from '@/lib/kinetic/compile';
import { parseLrc } from '@/lib/lyrics/parse';
import type { VisualTimeline } from '@/lib/kinetic/types';
import { contrastRatio } from '@/lib/kinetic/util';
import { readCover, wordColour, worstContrast, emptiestBox, N } from '@/lib/styles/cover-pop/analysis';
import { CROP_PATHS, clampCrop, cropAt, visibleBox } from '@/lib/styles/cover-pop/crops';
import { BURST_IDS, CHIP_IDS, CUT_IDS, STICKER_IDS, PLAYFUL } from '@/lib/styles/cover-pop/marks';
import { FALLBACK_IDS } from '@/lib/styles/cover-pop/fallback';
import { LAYOUT_IDS, VOICES, placePhrase, splitPhrases } from '@/lib/styles/cover-pop/type';
import { coverPlan, coverRules } from '@/lib/styles/cover-pop/plan';
import { sceneData } from '@/lib/styles/scene/data';

const manifest = JSON.parse(readFileSync(join(process.cwd(), 'docs/visual-production/styles/cover-pop/asset-manifest.json'), 'utf8')) as { assets: { id: string; status: string }[] };
const live = new Set(manifest.assets.filter((a) => a.status !== 'rejected' && a.status !== 'merged').map((a) => a.id));

const demo = (name: string): VisualTimeline => {
  const doc = parseLrc(readFileSync(join(process.cwd(), 'public', 'demo', `${name}.lrc`), 'utf8'));
  const cat = JSON.parse(readFileSync(join(process.cwd(), 'public', 'demo', 'catalog.json'), 'utf8')) as { id: string; durationMs: number; bpm: number; beatTimesMs: number[] }[];
  const t = cat.find((c) => c.id === name)!;
  return compileTimeline(doc, { trackId: `demo:${name}`, durationMs: t.durationMs, palette: ['#e0574a', '#2f7fe0'], bpm: t.bpm, beatTimesMs: t.beatTimesMs });
};

/** a synthetic cover: a flat dark top half (empty) and a busy checkered bottom half */
function cover(): Uint8ClampedArray {
  const g = new Uint8ClampedArray(N * N * 4);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      const v = y < N / 2 ? 30 : (x + y) % 2 ? 250 : 10;
      g[i] = v;
      g[i + 1] = y < N / 2 ? 40 : v;
      g[i + 2] = y < N / 2 ? 80 : v;
      g[i + 3] = 255;
    }
  return g;
}

describe('Cover Pop asset ids', () => {
  it('every produced id is a live manifest entry, and the families are complete', () => {
    const ids = [...STICKER_IDS, ...BURST_IDS, ...CUT_IDS, ...CHIP_IDS, ...CROP_PATHS, ...FALLBACK_IDS, ...LAYOUT_IDS, ...Object.keys(VOICES)];
    for (const id of ids) expect(live.has(id), id).toBe(true);
    expect([STICKER_IDS.length, BURST_IDS.length, CUT_IDS.length, CHIP_IDS.length, CROP_PATHS.length, FALLBACK_IDS.length, LAYOUT_IDS.length, Object.keys(VOICES).length]).toEqual([36, 8, 4, 6, 12, 5, 14, 9]);
  });
});

describe('cover reading', () => {
  it('finds the empty half and puts type there', () => {
    const r = readCover(cover());
    expect(r.busy).toBeGreaterThan(0.3);
    const b = emptiestBox(r, { x: 0, y: 0, w: 1, h: 1 }, 0.6, 0.3);
    expect(b.y + b.h).toBeLessThanOrEqual(0.55);
  });
  it('picks a word colour that reaches 4.5:1 against every cell behind it, or falls back to white with an outline', () => {
    const g = cover();
    for (const rule of ['CVP-PAL-COL-001', 'CVP-PAL-COL-002', 'CVP-PAL-COL-003', 'CVP-PAL-COL-005'] as const)
      for (const box of [{ x: 0.1, y: 0.1, w: 0.5, h: 0.1 }, { x: 0.1, y: 0.7, w: 0.5, h: 0.1 }]) {
        const c = wordColour(rule, g, box, ['#ff3d6e', '#ffd23f'], ['#ff3d6e', '#ffffff']);
        if (c.outline) expect(c.fill).toBe('#ffffff');
        else expect(worstContrast(g, box, c.fill)).toBeGreaterThanOrEqual(4.5);
      }
  });
});

describe('crop paths', () => {
  it('keep the cover covering the frame at every point, in every orientation', () => {
    const r = readCover(cover());
    for (const id of CROP_PATHS)
      for (const [W, H] of [[1280, 720], [720, 1280], [1080, 1080], [390, 844]])
        for (let p = 0; p <= 1; p += 0.25) {
          const v = visibleBox(clampCrop(cropAt(id, r, p, false), W!, H!), W!, H!);
          expect(v.x).toBeGreaterThanOrEqual(-1e-9);
          expect(v.y).toBeGreaterThanOrEqual(-1e-9);
          expect(v.x + v.w).toBeLessThanOrEqual(1 + 1e-9);
          expect(v.y + v.h).toBeLessThanOrEqual(1 + 1e-9);
        }
  });
  it('do not move with reduced motion', () => {
    for (const id of CROP_PATHS) expect(cropAt(id, null, 0.1, true)).toEqual(cropAt(id, null, 0.9, true));
  });
});

describe('phrases and layouts', () => {
  const words = (n: number, gapAt = -1) => Array.from({ length: n }, (_, i) => ({ text: `w${i}`, startMs: i * 300 + (i > gapAt && gapAt >= 0 ? 400 : 0), endMs: i * 300 + 250 + (i > gapAt && gapAt >= 0 ? 400 : 0) }));
  it('splits authored lines into phrases of at most four words, and never splits estimated ones by time', () => {
    for (const n of [1, 3, 5, 8, 11]) {
      const ps = splitPhrases(words(n), 0, 'authored');
      expect(ps.flatMap((p) => p.words)).toEqual([...Array(n).keys()]);
      for (const p of ps) expect(p.words.length).toBeLessThanOrEqual(4);
    }
    const est = splitPhrases(words(9), 0, 'estimated');
    expect(est).toHaveLength(1);
    for (const row of est[0]!.rows) expect(row.length).toBeLessThanOrEqual(4);
  });
  it('every layout keeps its words inside the region', () => {
    const region = { x: 100, y: 50, w: 600, h: 300 };
    const ph = splitPhrases(words(4), 0, 'authored')[0]!;
    for (const id of LAYOUT_IDS) {
      const placed = placePhrase(id, ph, 1, region, (i, s) => s * (2 + i * 0.3), 1.1, 200, false);
      expect(placed).toHaveLength(ph.words.length);
      for (const p of placed) {
        expect(p.x).toBeGreaterThanOrEqual(region.x - 0.5);
        expect(p.x + p.w).toBeLessThanOrEqual(region.x + region.w + 0.5);
      }
    }
  });
});

describe('Cover Pop song plan', () => {
  it('uses only the no-cover stage without a cover, never with one', () => {
    const tl = demo('glass-hours');
    expect(coverPlan(tl, null).plan.sections.every((s) => s.scene.id === 'CVP-SCN-07')).toBe(true);
    expect(coverPlan(tl, { natural: 1000 }).plan.sections.some((s) => s.scene.id === 'CVP-SCN-07')).toBe(false);
  });
  it('never repeats a crop path or a layout on consecutive phrases, keeps one sticker per section, no playful sticker with grief', () => {
    for (const name of ['neon-static', 'glass-hours', 'paper-planets']) {
      const cp = coverPlan(demo(name), { natural: 1000 });
      const crops = cp.sections.filter((s) => s.ps.scene.id !== 'CVP-SCN-06').map((s) => s.crop);
      expect(new Set(crops).size).toBe(crops.length);
      const all = cp.lines.flatMap((l) => l.phrases);
      for (let i = 1; i < all.length; i++) if (all[i]!.layout === all[i - 1]!.layout) expect(all.length).toBeLessThan(0);
      const bySection = new Map<number, string[]>();
      for (const l of cp.lines) for (const p of l.phrases) if (p.sticker) bySection.set(l.section, [...(bySection.get(l.section) ?? []), p.sticker]);
      for (const list of bySection.values()) expect(new Set(list).size).toBe(list.length);
      if (cp.song.dark) for (const p of all) expect(p.sticker && PLAYFUL.has(p.sticker)).toBeFalsy();
    }
  });
  it('keeps the framed ending for outros', () => {
    const scenes = sceneData('cover-pop').scenes;
    const end = scenes.find((s) => s.id === 'CVP-SCN-08')!;
    const sec = (role: 'outro' | 'verse') => ({ index: 0, startMs: 0, endMs: 1, role, tags: [], chorusOrdinal: 0, lines: null, energy: 0 });
    const song = { tags: new Set<string>(), valence: null, arousal: null, dark: false, density: 5, lineWords: [] };
    expect(coverRules(true).allowScene!(end, { song, section: sec('outro') })).toBe(true);
    expect(coverRules(true).allowScene!(end, { song, section: sec('verse') })).toBe(false);
  });
});

describe('contrast helper sanity', () => {
  it('white on the dark half passes', () => expect(contrastRatio('#ffffff', '#1e2850')).toBeGreaterThan(4.5));
});
