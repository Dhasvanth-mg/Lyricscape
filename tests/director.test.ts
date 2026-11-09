import { describe, expect, it } from 'vitest';
import { CHORUS_PARTNER, MIN_SECTION_MS, planDirector, sectionsOf, snapToBeat, styleAt } from '@/lib/kinetic/director';

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
  it('cuts verse -> partner scene -> back, every section at least the minimum length', () => {
    const plan = planDirector(tl(song), 'terminal');
    expect(plan.cuts.map((c) => c.style)).toEqual(['terminal', CHORUS_PARTNER.terminal, 'terminal', CHORUS_PARTNER.terminal]);
    for (let i = 1; i < plan.cuts.length; i++) expect(plan.cuts[i]!.atMs - plan.cuts[i - 1]!.atMs).toBeGreaterThanOrEqual(MIN_SECTION_MS);
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
    expect(styleAt(plan, 30_000)).toBe(CHORUS_PARTNER.liquid);
    expect(styleAt(plan, 50_000)).toBe('liquid');
    expect(styleAt(plan, 30_000)).toBe(styleAt(plan, 30_000));
  });
  it('keeps one scene for a song with no repeated lines or no lyrics', () => {
    expect(planDirector(tl(run(0, 20, false)), 'acid').cuts).toEqual([{ atMs: 0, style: 'acid', role: 'verse' }]);
    expect(planDirector(tl([]), 'acid').cuts).toEqual([{ atMs: 0, style: 'acid', role: 'verse' }]);
  });
  it('every home scene has a different chorus partner', () => {
    for (const [home, partner] of Object.entries(CHORUS_PARTNER)) expect(partner).not.toBe(home);
  });
});
