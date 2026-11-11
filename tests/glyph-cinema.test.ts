// Glyph Cinema (Phase 3): subject selection, the song plan's rules, typing reveal times, wrapping, palettes and asset ids.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileTimeline } from '@/lib/kinetic/compile';
import { parseLrc } from '@/lib/lyrics/parse';
import type { VisualTimeline } from '@/lib/kinetic/types';
import { contrastRatio } from '@/lib/kinetic/util';
import { glyPlan, quantise, revealLine, STEP_MS } from '@/lib/styles/glyph-cinema/plan';
import { SUBJECTS, subjectHits, pickSubjectFor, familySubjects } from '@/lib/styles/glyph-cinema/subjects';
import { RAMPS, PHOSPHOR, coverPhosphor, duotone, blockColours } from '@/lib/styles/glyph-cinema/ramps';
import { wrapCells, wrapStrip } from '@/lib/styles/glyph-cinema/paint';
import { SUBJECT_COUNT, GLY_FS } from '@/lib/styles/glyph-cinema/shader';
import { gridFor } from '@/lib/styles/glyph-cinema/scene';

const manifest = JSON.parse(readFileSync(join(process.cwd(), 'docs/visual-production/styles/glyph-cinema/asset-manifest.json'), 'utf8')) as { assets: { id: string; status: string }[] };
const live = new Set(manifest.assets.filter((a) => a.status !== 'rejected' && a.status !== 'merged').map((a) => a.id));

const demo = (name: string, label = 'Song • Artist'): VisualTimeline => {
  const doc = parseLrc(readFileSync(join(process.cwd(), 'public', 'demo', `${name}.lrc`), 'utf8'));
  const cat = JSON.parse(readFileSync(join(process.cwd(), 'public', 'demo', 'catalog.json'), 'utf8')) as { id: string; durationMs: number; bpm: number; beatTimesMs: number[] }[];
  const t = cat.find((c) => c.id === name)!;
  return { ...compileTimeline(doc, { trackId: `demo:${name}`, durationMs: t.durationMs, palette: ['#e0574a', '#2f7fe0'], bpm: t.bpm, beatTimesMs: t.beatTimesMs }), label };
};
const demos = () => (JSON.parse(readFileSync(join(process.cwd(), 'public', 'demo', 'catalog.json'), 'utf8')) as { id: string }[]).map((c) => c.id);

describe('subjects', () => {
  it('covers every live subject id once, each in a live scene family, and the shader draws them all', () => {
    expect(SUBJECTS.length).toBe(SUBJECT_COUNT);
    const ids = new Set(SUBJECTS.map((s) => s.id));
    expect(ids.size).toBe(SUBJECTS.length);
    for (const s of SUBJECTS) {
      expect(live.has(s.id)).toBe(true);
      expect(live.has(s.family)).toBe(true);
      expect(live.has(s.motion)).toBe(true);
    }
    for (const id of live) if (id.startsWith('GLY-ENV-SUB-')) expect(ids.has(id)).toBe(true);
    expect(GLY_FS).toContain(`case ${SUBJECT_COUNT - 2}:`);
  });
  it('a title word decides the subject; lyrics need repetition', () => {
    const title = subjectHits('E85');
    const pick = pickSubjectFor('GLY-SCN-02', title, new Map(), new Map(), 0.9, new Set());
    expect(SUBJECTS[pick]!.name).toBe('Highway at night');
    const lyr = subjectHits('the ocean the waves the tide, the sea');
    expect(SUBJECTS[pickSubjectFor('GLY-SCN-04', new Map(), lyr, new Map(), 0.5, new Set())]!.name).toBe('Ocean waves');
  });
  it('a seeded pick stays inside the family and avoids subjects already used', () => {
    const pool = familySubjects('GLY-SCN-08');
    const used = new Set(pool.slice(0, pool.length - 1));
    expect(pickSubjectFor('GLY-SCN-08', new Map(), new Map(), new Map(), 0.1, used)).toBe(pool[pool.length - 1]);
  });
});

describe('the song plan', () => {
  it('is deterministic and every chosen id is a live asset', () => {
    for (const id of demos()) {
      const tl = demo(id);
      const a = glyPlan(tl, false, tl.palette);
      const b = glyPlan({ ...tl }, false, [...tl.palette]);
      expect(b.sections.map((s) => [s.subject, s.register, s.ramp, s.comp])).toEqual(a.sections.map((s) => [s.subject, s.register, s.ramp, s.comp]));
      for (const s of a.sections) {
        for (const x of [s.register, s.palette, s.ramp, s.band, s.camera, s.page, s.paper, s.ps.scene.id, s.transition]) if (x) expect(live.has(x)).toBe(true);
        expect(s.comp).not.toBe('C2'); // calligram gated (B-05)
        if (s.comp === 'C3') expect(s.register).toBe('GLY-PRC-REG-002');
        if (s.comp === 'C4') expect(s.register).toBe('GLY-PRC-REG-003');
        if (s.register === 'GLY-PRC-REG-005') expect(s.ps.section.role).toBe('chorus');
        if (s.ps.scene.id === 'GLY-SCN-13') expect(s.register).toBe('GLY-PRC-REG-004');
      }
      expect(a.sections.filter((s) => s.register === 'GLY-PRC-REG-005').length).toBeLessThanOrEqual(2);
    }
  });
  it('the title subject leads the choruses', () => {
    const tl = demo(demos()[0]!, 'Ocean Drive • Someone');
    const p = glyPlan(tl, false, tl.palette);
    expect(p.songSubject).not.toBeNull();
    for (const s of p.sections) if (s.ps.section.role === 'chorus') expect(s.subject).toBe(p.songSubject);
  });
  it('reduced motion: the camera holds and there are no noise fronts or zoom steps', () => {
    const tl = demo(demos()[0]!);
    const p = glyPlan(tl, true, tl.palette);
    for (const s of p.sections) {
      expect(s.camera).toBe('GLY-CAM-CAM-004');
      expect(['GLY-TRN-NOISE-FRONT', 'GLY-TRN-ZOOM-STEP', 'GLY-TRN-DEVELOP']).not.toContain(s.transition);
    }
  });
});

describe('typing into cells', () => {
  it('authored words appear at their own times; letters at most one a frame, all before the next word', () => {
    const ws = [
      { text: 'city', startMs: 1000, endMs: 1400, timing: 'authored' },
      { text: 'hums', startMs: 1500, endMs: 1900, timing: 'authored' },
    ];
    const r = revealLine(ws, 1000, 2000, 'authored', false);
    expect(r.graphemes.join('')).toBe('city hums');
    expect(r.revealMs[0]).toBe(quantise(1000));
    expect(r.revealMs[5]).toBe(quantise(1500));
    for (let i = 1; i < 4; i++) expect(r.revealMs[i]! - r.revealMs[i - 1]!).toBeGreaterThanOrEqual(STEP_MS - 0.01);
    expect(r.revealMs[3]!).toBeLessThan(1500);
  });
  it('estimated and line timing sweep over the first 40% of the line', () => {
    const ws = 'every sign is calling you'.split(' ').map((w, i) => ({ text: w, startMs: i * 300, endMs: i * 300 + 250, timing: 'none' }));
    const r = revealLine(ws, 0, 5000, 'line', false);
    expect(Math.max(...r.revealMs)).toBeLessThanOrEqual(0.4 * 5000 + 600);
  });
  it('reduced motion types whole words', () => {
    const r = revealLine([{ text: 'hello', startMs: 0, endMs: 500, timing: 'authored' }], 0, 1000, 'authored', true);
    expect(new Set(r.revealMs).size).toBe(1);
  });
  it('keeps grapheme clusters whole', () => {
    const r = revealLine([{ text: 'नमस्ते', startMs: 0, endMs: 500, timing: 'authored' }], 0, 1000, 'authored', false);
    expect(r.graphemes.length).toBeLessThan([...'नमस्ते'].length);
  });
});

describe('wrapping', () => {
  it('wraps at spaces and splits only words longer than a row', () => {
    const gs = [...'every sign is calling you tonight'];
    const rows = wrapCells(gs, 12);
    for (const r of rows) expect(r.to - r.from).toBeLessThanOrEqual(12);
    expect(rows.map((r) => gs.slice(r.from, r.to).join('').trim())).toEqual(['every sign', 'is calling', 'you tonight']);
    expect(wrapCells([...'supercalifragilistic'], 8).length).toBe(3);
  });
  it('wraps strips by width', () => {
    const gs = [...'aa bb cc dd'];
    const rows = wrapStrip(gs, (a, b) => (b - a) * 10, 55);
    expect(rows.map((r) => gs.slice(r.from, r.to).join(''))).toEqual(['aa bb', 'cc dd']);
  });
});

describe('grid', () => {
  it('uses H/40, H/56 and H/72 cells, never fine under 600 px, and covers the frame', () => {
    expect(gridFor(1280, 720, 'coarse').cell).toBeCloseTo(18);
    expect(gridFor(1280, 720, 'medium').cell).toBeCloseTo(720 / 56);
    expect(gridFor(1280, 720, 'fine').cell).toBeCloseTo(10);
    expect(gridFor(800, 450, 'fine').cell).toBeCloseTo(450 / 56);
    for (const [w, h] of [[1280, 720], [720, 1280], [1080, 1080], [390, 844]] as const) {
      const g = gridFor(w, h, 'medium');
      expect(g.cols * g.cell).toBeGreaterThanOrEqual(w);
      expect(g.rows * g.cell).toBeGreaterThanOrEqual(h);
      expect(g.cols).toBeGreaterThanOrEqual(24);
    }
  });
});

describe('colour', () => {
  it('band text reads at 7:1 on its band in every phosphor', () => {
    for (const c of Object.values(PHOSPHOR)) expect(contrastRatio(c.text, c.bandBg)).toBeGreaterThanOrEqual(7);
    const cv = coverPhosphor(['#1d4ed8', '#f0f0f0'])!;
    expect(contrastRatio(cv.text, cv.bandBg)).toBeGreaterThanOrEqual(7);
    expect(coverPhosphor(['#808080', '#777777'])).toBeNull();
  });
  it('the 1-bit duotone keeps ink and paper 7:1 apart', () => {
    for (const cs of [['#e0574a', '#2f7fe0'], ['#101010', '#fafafa'], ['#ffcc00', '#003366', '#cc3366']]) {
      const d = duotone(cs);
      expect(contrastRatio(d.ink, d.paper)).toBeGreaterThanOrEqual(7);
    }
  });
  it('block shade needs two real hues', () => {
    const fb = PHOSPHOR['GLY-PAL-PAL-001'];
    expect(blockColours(['#888888'], fb).c1).toBe(fb.c1);
    expect(blockColours(['#e0574a', '#2f7fe0'], fb).c1).not.toBe(fb.c1);
  });
  it('every ramp id is live', () => {
    for (const id of Object.keys(RAMPS)) expect(live.has(id)).toBe(true);
  });
});
