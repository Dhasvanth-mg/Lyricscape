import { describe, expect, it } from 'vitest';
import { MIN_SECTION_MS, planDirector, sceneOrder, sectionsOf, snapToBeat, styleAt } from '@/lib/kinetic/director';
import { TURBO_STYLE_IDS } from '@/lib/kinetic/turbo';

type Sc = { startMs: number; endMs: number; hook: boolean };
const run = (from: number, n: number, hook: boolean, len = 3000): Sc[] => Array.from({ length: n }, (_, i) => ({ startMs: from + i * len, endMs: from + (i + 1) * len - 200, hook }));
const tl = (scenes: Sc[], gaps: { startMs: number; endMs: number }[] = [], durationMs = 200_000, beatTimesMs: number[] = []) => ({ scenes: scenes as never, gaps, durationMs, beatTimesMs });
// verse 0-24 s, chorus 24-42 s, verse 42-66 s, chorus 66-84 s
const song = [...run(0, 8, false), ...run(24_000, 6, true), ...run(42_000, 8, false), ...run(66_000, 6, true)];

describe('auto director', () => {
  it('finds verse and chorus sections from runs of hook lines', () => {
    expect(sectionsOf(tl(song)).map((s) => [s.role, s.startMs])).toEqual([
      ['verse', 0],
      ['chorus', 24_000],
      ['verse', 42_000],
      ['chorus', 66_000],
    ]);
  });
  it('folds a lone repeated line inside a verse into the verse (no flicker)', () => {
    const scenes = [...run(0, 4, false), { startMs: 12_000, endMs: 14_800, hook: true }, ...run(15_000, 4, false)];
    expect(sectionsOf(tl(scenes)).map((s) => s.role)).toEqual(['verse']);
  });
  it('gives long instrumental gaps their own section', () => {
    const scenes = [...run(0, 4, false), ...run(30_000, 4, false)];
    const s = sectionsOf(tl(scenes, [{ startMs: 12_000, endMs: 30_000 }]));
    expect(s.map((x) => x.role)).toEqual(['verse', 'break', 'verse']);
  });
  it('cuts to a different scene each section, every section at least the minimum length', () => {
    const plan = planDirector(tl(song), 'terminal');
    const styles = plan.cuts.map((c) => c.style);
    expect(styles[0]).toBe('terminal');
    expect(new Set(styles).size).toBe(styles.length); // four sections, four different scenes
    for (let i = 1; i < plan.cuts.length; i++) expect(plan.cuts[i]!.atMs - plan.cuts[i - 1]!.atMs).toBeGreaterThanOrEqual(MIN_SECTION_MS);
  });
  it('goes through all six scenes before repeating, never the same twice running, in a per-song order', () => {
    const o = sceneOrder('sketch', 'song-a|1', 18);
    expect(o[0]).toBe('sketch');
    expect(new Set(o.slice(0, 6)).size).toBe(6);
    for (let i = 1; i < o.length; i++) expect(o[i]).not.toBe(o[i - 1]);
    expect(sceneOrder('sketch', 'song-a|1', 18)).toEqual(o);
    const firsts = new Set(Array.from({ length: 30 }, (_, i) => sceneOrder('sketch', `s${i}|0`, 2)[1]));
    expect(firsts.size).toBeGreaterThan(3);
    expect(TURBO_STYLE_IDS.length).toBe(6);
  });
  it('lands cuts on the nearest beat', () => {
    const beats = Array.from({ length: 200 }, (_, i) => 130 + i * 500);
    const plan = planDirector(tl(song, [], 200_000, beats), 'liquid');
    expect(plan.cuts[1]!.atMs).toBe(24_130);
    expect(snapToBeat(24_000, beats)).toBe(24_130);
    expect(snapToBeat(24_000, undefined)).toBe(24_000);
  });
  it('is a pure function of time: same scene for the same moment, whatever came before', () => {
    const plan = planDirector(tl(song), 'liquid');
    expect(styleAt(plan, 1000)).toBe('liquid');
    expect(styleAt(plan, 30_000)).toBe(plan.cuts[1]!.style);
    expect(styleAt(plan, 30_000)).not.toBe('liquid');
    expect(styleAt(plan, 30_000)).toBe(styleAt(plan, 30_000));
  });
  it('cuts a long stretch without a chorus into sections, and keeps one scene with no lyrics', () => {
    const plan = planDirector(tl(run(0, 20, false)), 'acid');
    expect(plan.cuts[0]).toEqual({ atMs: 0, style: 'acid', role: 'verse' });
    expect(plan.cuts.length).toBeGreaterThan(1);
    for (let i = 1; i < plan.cuts.length; i++) expect(plan.cuts[i]!.style).not.toBe(plan.cuts[i - 1]!.style);
    expect(planDirector(tl(run(0, 6, false)), 'acid').cuts).toHaveLength(1); // 18 s is too short to cut
    expect(planDirector(tl([]), 'acid').cuts).toEqual([{ atMs: 0, style: 'acid', role: 'verse' }]);
  });
});
