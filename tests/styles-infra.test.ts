import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { STYLE15_IDS, STYLES15, STYLES15_IN_ORDER, isOffered } from '@/lib/styles/registry';
import { FROM_STYLE, FROM_TURBO, migrateId, migratePick } from '@/lib/styles/migrate';
import { STYLE_IDS } from '@/lib/kinetic/types';
import { TURBO_STYLE_IDS } from '@/lib/kinetic/turbo';
import { sceneData } from '@/lib/styles/scene/data';
import { songSections } from '@/lib/styles/scene/sections';
import { planScenes, plannedAt } from '@/lib/styles/scene/planner';
import { songSignals, signalMatch } from '@/lib/styles/scene/signals';
import { fillSlots } from '@/lib/styles/scene/slots';
import { lineTiming, revealAt } from '@/lib/styles/timing';
import { flashViolations, guardFx, MAX_FLASH } from '@/lib/styles/flash';
import { BudgetCache, textureBytes } from '@/lib/styles/assets/cache';
import { resolveFallback } from '@/lib/styles/assets/runtime';
import { compileTimeline } from '@/lib/kinetic/compile';
import { parseLrc } from '@/lib/lyrics/parse';

const demo = (name: string) => {
  const doc = parseLrc(readFileSync(join(process.cwd(), 'public', 'demo', `${name}.lrc`), 'utf8'));
  const cat = JSON.parse(readFileSync(join(process.cwd(), 'public', 'demo', 'catalog.json'), 'utf8')) as { id: string; durationMs: number; bpm: number; beatTimesMs: number[] }[];
  const t = cat.find((c) => c.id === name)!;
  return compileTimeline(doc, { trackId: `demo:${name}`, durationMs: t.durationMs, palette: ['#111111', '#eeeeee'], bpm: t.bpm, beatTimesMs: t.beatTimesMs });
};

/** a long synthetic song: intro, verse, chorus, verse, chorus, verse (bridge), chorus, outro */
function longSong() {
  const lines: string[] = [];
  const ms = (t: number) => `[${String(Math.floor(t / 60000)).padStart(2, '0')}:${((t % 60000) / 1000).toFixed(2).padStart(5, '0')}]`;
  let t = 9000;
  const verse = (k: number) => {
    for (let i = 0; i < 6; i++) {
      lines.push(`${ms(t)}walking down the night street number ${k} line ${i}`);
      t += 3200;
    }
  };
  const chorus = () => {
    for (const l of ['hold the light', 'hold the light for me', 'we burn we burn', 'hold the light']) {
      lines.push(`${ms(t)}${l}`);
      t += 3000;
    }
    for (const l of ['hold the light', 'hold the light for me']) {
      lines.push(`${ms(t)}${l}`);
      t += 3000;
    }
  };
  verse(1);
  chorus();
  verse(2);
  chorus();
  verse(3);
  chorus();
  const end = t;
  const doc = parseLrc(lines.join('\n'));
  return compileTimeline(doc, { trackId: 'test:long', durationMs: end + 12000, palette: ['#111111', '#eeeeee'] });
}

describe('fifteen-style registry', () => {
  it('has exactly the fifteen Phase 1 styles, in the Phase 2 production order', () => {
    expect(STYLE15_IDS).toHaveLength(15);
    expect(STYLES15_IN_ORDER.map((s) => s.code)).toEqual(['SKC', 'CVP', 'SCR', 'GLY', 'KON', 'FOL', 'NOC', 'CEL', 'SIG', 'PTR', 'PAN', 'LLS', 'INK', 'PHO', 'MON']);
    expect(new Set(Object.values(STYLES15).map((s) => s.code)).size).toBe(15);
  });
  it('only offers styles that have a renderer and are not blocked', () => {
    for (const s of STYLES15_IN_ORDER) expect(isOffered(s)).toBe(s.scene !== null && s.stage !== 'blocked');
    expect(isOffered(STYLES15.monument)).toBe(false);
  });
  it('has scene data for every style that matches its code', () => {
    for (const id of STYLE15_IDS) {
      const d = sceneData(id);
      expect(d.code).toBe(STYLES15[id].code);
      for (const s of d.scenes) for (const c of s.compositions) expect(d.compositions.some((x) => x.id === c)).toBe(true);
    }
  });
  it('runtime scene data matches the Phase 2 planning manifests (no drift)', () => {
    const root = join(process.cwd(), 'docs', 'visual-production', 'styles');
    for (const slug of readdirSync(root).filter((s) => !s.startsWith('_'))) {
      const m = JSON.parse(readFileSync(join(root, slug, 'asset-manifest.json'), 'utf8')) as { assets: { id: string; status: string }[] };
      const ids = new Map(m.assets.map((a) => [a.id, a.status]));
      const d = sceneData(slug as never);
      for (const s of d.scenes) expect(ids.has(s.id)).toBe(true);
      for (const c of d.compositions) expect(ids.has(c.id)).toBe(true);
      for (const t of d.transitions) expect(['approved', 'revised', 'deferred']).toContain(ids.get(t.id));
    }
  });
});

describe('stored-pick migration (D-05)', () => {
  it('maps every old Turbo style and every classic style or direction', () => {
    for (const id of TURBO_STYLE_IDS) expect(STYLE15_IDS).toContain(FROM_TURBO[id]);
    for (const id of STYLE_IDS) if (id !== 'custom') expect(STYLE15_IDS).toContain(FROM_STYLE[id]);
    expect(FROM_STYLE.custom).toBeNull();
  });
  it('follows the Phase 2 table for the decisions the owner was asked to confirm', () => {
    expect(migrateId('nebula')).toBe('nocturne');
    expect(migrateId('y2k')).toBe('cover-pop');
    expect(migrateId('terminal')).toBe('screenlife');
    expect(migrateId('acid')).toBe('sketch-cards');
    expect(migrateId('vaporwave')).toBe('signage');
    expect(migrateId('nonsense')).toBeNull();
  });
  it('uses the Turbo style in Turbo mode and the classic style in Clean mode', () => {
    expect(migratePick({ mode: 'turbo', turboStyle: 'ascii', style: 'film' })).toBe('glyph-cinema');
    expect(migratePick({ mode: 'clean', turboStyle: 'ascii', style: 'film' })).toBe('celluloid');
    expect(migratePick({ mode: 'clean', style: 'custom' })).toBeNull();
  });
});

describe('song sections with derived roles', () => {
  it('finds intro, verses, choruses, a bridge and an outro in a long song', () => {
    const s = songSections(longSong());
    expect(s[0]!.role).toBe('intro');
    expect(s.map((x) => x.role)).toContain('chorus');
    expect(s.map((x) => x.role)).toContain('bridge');
    expect(s[s.length - 1]!.role).toBe('outro');
    for (let i = 1; i < s.length; i++) expect(s[i]!.startMs).toBeGreaterThanOrEqual(s[i - 1]!.startMs);
    expect(s.filter((x) => x.role === 'chorus').map((x) => x.chorusOrdinal)).toEqual([1, 2, 3]);
  });
  it('gives a song without lyrics instrumental sections', () => {
    const s = songSections({ scenes: [], gaps: [], durationMs: 95_000 });
    expect(s.length).toBeGreaterThanOrEqual(3);
    expect(s.every((x) => x.role === 'intro' || x.role === 'break')).toBe(true);
  });
});

describe('scene planner', () => {
  const tl = longSong();
  it('is deterministic: the same song and seed give the same plan', () => {
    for (const id of STYLE15_IDS) {
      const data = sceneData(id);
      const a = planScenes({ tl, data, song: songSignals(tl) });
      const b = planScenes({ tl, data, song: songSignals(tl) });
      expect(a.sections.map((x) => [x.scene.id, x.composition.id, x.transition?.id])).toEqual(b.sections.map((x) => [x.scene.id, x.composition.id, x.transition?.id]));
    }
  });
  it('never repeats a scene family in consecutive sections except a chorus recall, and caps uses per song', () => {
    for (const id of STYLE15_IDS) {
      const p = planScenes({ tl, data: sceneData(id), song: songSignals(tl) });
      const counts = new Map<string, number>();
      p.sections.forEach((x, i) => {
        counts.set(x.scene.id, (counts.get(x.scene.id) ?? 0) + 1);
        if (i > 0 && p.sections[i - 1]!.scene.id === x.scene.id) expect(x.recall).toBe(true);
        if (i > 0 && p.sections[i - 1]!.composition.id === x.composition.id && !x.recall) expect(p.sections[i - 1]!.scene.compositions.length + x.scene.compositions.length).toBeGreaterThan(0);
      });
      for (const [sc, n] of counts) {
        const recalls = p.sections.filter((x) => x.scene.id === sc && x.recall).length;
        expect(n - recalls).toBeLessThanOrEqual(3);
      }
    }
  });
  it('brings the first chorus scene back on later choruses when the style allows it', () => {
    const p = planScenes({ tl, data: sceneData('sketch-cards'), song: songSignals(tl) });
    const ch = p.sections.filter((x) => x.section.role === 'chorus');
    expect(ch.length).toBe(3);
    expect(ch[1]!.scene.id).toBe(ch[0]!.scene.id);
    expect(ch[1]!.recall).toBe(true);
  });
  it('different songs can get different scene families in the same style', () => {
    const data = sceneData('sketch-cards');
    const a = planScenes({ tl, data, song: songSignals(tl), seed: 1 }).sections.map((x) => x.scene.id).join();
    const seen = new Set([a]);
    for (let s = 2; s < 12; s++) seen.add(planScenes({ tl, data, song: songSignals(tl), seed: s }).sections.map((x) => x.scene.id).join());
    expect(seen.size).toBeGreaterThan(3);
  });
  it('applies a style rule as a hard filter', () => {
    const p = planScenes({ tl, data: sceneData('sketch-cards'), song: songSignals(tl), rules: { allowScene: (sc) => sc.id !== 'SKC-SCN-01' } });
    expect(p.sections.some((x) => x.scene.id === 'SKC-SCN-01')).toBe(false);
  });
  it('looks the section up by time, the first section covering anything before it', () => {
    const p = planScenes({ tl, data: sceneData('nocturne'), song: songSignals(tl) });
    expect(plannedAt(p, -100)).toBe(p.sections[0]);
    const mid = p.sections[2]!;
    expect(plannedAt(p, mid.section.startMs + 1)).toBe(mid);
  });
  it('plans the demo songs for every style without throwing', () => {
    for (const name of ['neon-static', 'glass-hours', 'paper-planets']) {
      const d = demo(name);
      for (const id of STYLE15_IDS) expect(planScenes({ tl: d, data: sceneData(id), song: songSignals(d) }).sections.length).toBeGreaterThan(0);
    }
  });
});

describe('song signals', () => {
  it('turns repeated lyric themes into tags and matches scene signals', () => {
    const s = songSignals(longSong());
    expect(s.tags.has('night')).toBe(true);
    expect(s.tags.has('city')).toBe(true);
    expect(signalMatch(['night', 'calm'], s)).toBeGreaterThan(0);
    expect(signalMatch([], s)).toBe(0);
  });
});

describe('slot filling with repetition windows', () => {
  const pool = ['a', 'b', 'c', 'd'].map((id) => ({ id, value: id }));
  it('never repeats on adjacent lines and caps per section and per song', () => {
    const req = Array.from({ length: 8 }, (_, i) => ({ line: i, section: Math.floor(i / 4), pool }));
    const picks = fillSlots('art', 7, req).map((p) => p!.id);
    for (let i = 1; i < picks.length; i++) expect(picks[i]).not.toBe(picks[i - 1]);
    for (const id of ['a', 'b', 'c', 'd']) expect(picks.filter((p) => p === id).length).toBeLessThanOrEqual(2);
    for (const sec of [0, 1]) expect(new Set(picks.slice(sec * 4, sec * 4 + 4)).size).toBe(4);
  });
  it('returns the same asset for a recalled hook and relaxes rules instead of leaving a slot empty', () => {
    const req = [
      { line: 0, section: 0, pool, recallKey: 'hook' },
      { line: 1, section: 0, pool },
      { line: 2, section: 1, pool, recallKey: 'hook' },
    ];
    const p = fillSlots('art', 3, req);
    expect(p[2]!.id).toBe(p[0]!.id);
    const one = [{ id: 'x', value: 1 }];
    expect(fillSlots('s', 1, Array.from({ length: 5 }, (_, i) => ({ line: i, section: 0, pool: one }))).every((c) => c?.id === 'x')).toBe(true);
  });
  it('is deterministic and prefers matching assets', () => {
    const req = [{ line: 0, section: 0, pool: [...pool, { id: 'm', value: 'm', match: 0.9 }] }];
    expect(fillSlots('art', 1, req)[0]!.id).toBe('m');
    expect(fillSlots('art', 5, req)[0]!.id).toBe('m');
  });
});

describe('timing soft mode (INF-04)', () => {
  const w = (timing: 'authored' | 'estimated' | 'none', startMs: number) => ({ id: String(startMs), text: 'x', startMs, endMs: startMs + 100, timing });
  it('classifies lines by their weakest word timing', () => {
    expect(lineTiming({ words: [w('authored', 0), w('authored', 100)] })).toBe('authored');
    expect(lineTiming({ words: [w('authored', 0), w('estimated', 100)] })).toBe('estimated');
    expect(lineTiming({ words: [w('none', 0), w('none', 0)] })).toBe('line');
  });
  it('uses authored times as they are and sweeps the rest across the first 40% of the line', () => {
    const words = [w('authored', 1000), w('authored', 1600)];
    expect(revealAt(words, 1, 1000, 3000, 'authored')).toBe(600);
    expect(revealAt(words, 1, 1000, 3000, 'estimated')).toBeCloseTo(600);
    expect(revealAt(words, 0, 1000, 3000, 'line')).toBe(0);
  });
});

describe('flash guard (INF-03)', () => {
  it('caps flashes at 12% and removes them, and bright punches, with reduced motion', () => {
    expect(guardFx({ flash: 0.6 }, { reducedMotion: false }).flash).toBe(MAX_FLASH);
    expect(guardFx({ flash: 0.6, exposure: 1.4, glitch: 1 }, { reducedMotion: true })).toMatchObject({ flash: 0, exposure: 1, glitch: 0 });
    expect(guardFx({ exposure: 9 }, { reducedMotion: false }).exposure).toBe(1.5);
  });
  it('detects a synthetic 10 Hz strobe and passes a 1 Hz pulse', () => {
    const fps = 60;
    const strobe = Array.from({ length: fps * 3 }, (_, i) => (Math.floor(i / 3) % 2 ? 0.9 : 0.05));
    expect(flashViolations(strobe, fps).failing).toBe(true);
    const pulse = Array.from({ length: fps * 3 }, (_, i) => (Math.floor(i / 30) % 2 ? 0.6 : 0.1));
    expect(flashViolations(pulse, fps).failing).toBe(false);
    const subtle = Array.from({ length: fps * 3 }, (_, i) => (Math.floor(i / 3) % 2 ? 0.25 : 0.2));
    expect(flashViolations(subtle, fps).flashes).toBe(0);
  });
});

describe('asset cache (INF-06)', () => {
  it('evicts least recently used entries past the byte budget and disposes them', () => {
    const gone: string[] = [];
    const c = new BudgetCache<number>(100, (_v, k) => gone.push(k));
    c.set('a', 1, 40);
    c.set('b', 2, 40);
    c.get('a');
    c.set('c', 3, 40);
    expect(gone).toEqual(['b']);
    expect(c.stats().bytes).toBe(80);
  });
  it('keeps pinned groups and releases a whole group', () => {
    const gone: string[] = [];
    const c = new BudgetCache<number>(100, (_v, k) => gone.push(k));
    c.set('ground', 1, 60, 'SCN-01');
    c.pin(['SCN-01']);
    c.set('x', 2, 30);
    c.set('y', 3, 30);
    expect(gone).toEqual(['x']);
    c.release('SCN-01');
    expect(gone).toEqual(['x', 'ground']);
  });
  it('counts texture memory with mips', () => {
    expect(textureBytes(256, 256)).toBe(Math.ceil(256 * 256 * 4 * (4 / 3)));
  });
  it('falls back along a chain and records misses', () => {
    const misses = new Set<string>();
    expect(resolveFallback(['A', 'B', 'C'], (id) => id === 'C', misses)).toBe('C');
    expect([...misses]).toEqual(['A', 'B']);
    expect(resolveFallback(['A'], () => false)).toBeNull();
  });
});
