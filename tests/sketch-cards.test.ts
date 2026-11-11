// Sketch Cards (Phase 3): the song plan is deterministic, follows the style's invalid-combination table and the manifest ids,
// and lettering picks the right script and hand.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { compileTimeline } from '@/lib/kinetic/compile';
import { parseLrc } from '@/lib/lyrics/parse';
import type { VisualTimeline } from '@/lib/kinetic/types';
import { sketchPlan, SKETCH_RULES, sceneSpec } from '@/lib/styles/sketch-cards/plan';
import { CARDS, BORDER_IDS } from '@/lib/styles/sketch-cards/cards';
import { GROUNDS } from '@/lib/styles/sketch-cards/grounds';
import { handFor, isRtl, scriptOf, LATIN_HANDS } from '@/lib/styles/sketch-cards/letter';
import { colourSet, onPill, PAPERS } from '@/lib/styles/sketch-cards/colour';
import { contrastRatio } from '@/lib/kinetic/util';
import { DOODLES } from '@/lib/styles/sketch-cards/drawings/doodles';
import { DARK } from '@/lib/styles/sketch-cards/drawings/dark';
import { EVERYDAY } from '@/lib/styles/sketch-cards/drawings/everyday';
import { HANDS, TOOLS } from '@/lib/styles/sketch-cards/drawings/props';
import { sceneData } from '@/lib/styles/scene/data';

const manifest = JSON.parse(readFileSync(join(process.cwd(), 'docs/visual-production/styles/sketch-cards/asset-manifest.json'), 'utf8')) as { assets: { id: string; status: string }[] };
const live = new Set(manifest.assets.filter((a) => a.status !== 'rejected' && a.status !== 'merged').map((a) => a.id));

const demo = (name: string): VisualTimeline => {
  const doc = parseLrc(readFileSync(join(process.cwd(), 'public', 'demo', `${name}.lrc`), 'utf8'));
  const cat = JSON.parse(readFileSync(join(process.cwd(), 'public', 'demo', 'catalog.json'), 'utf8')) as { id: string; durationMs: number; bpm: number; beatTimesMs: number[] }[];
  const t = cat.find((c) => c.id === name)!;
  return compileTimeline(doc, { trackId: `demo:${name}`, durationMs: t.durationMs, palette: ['#e0574a', '#2f7fe0'], bpm: t.bpm, beatTimesMs: t.beatTimesMs });
};

describe('Sketch Cards assets carry their Phase 2 ids', () => {
  it('every produced id is a live manifest entry', () => {
    const ids = [...Object.keys(CARDS), ...BORDER_IDS, ...Object.keys(GROUNDS), ...Object.keys(DOODLES), ...Object.keys(DARK), ...Object.keys(EVERYDAY), ...Object.keys(HANDS), ...Object.keys(TOOLS), ...LATIN_HANDS.map((h) => h.id)];
    for (const id of ids) expect(live.has(id), id).toBe(true);
    expect(Object.keys(CARDS)).toHaveLength(14);
    expect(Object.keys(GROUNDS)).toHaveLength(11);
    expect(Object.keys(DOODLES).length + Object.keys(DARK).length + Object.keys(EVERYDAY).length).toBe(104);
  });
  it('every scene family has a spec', () => {
    for (const s of sceneData('sketch-cards').scenes) expect(sceneSpec(s.id).ground in GROUNDS).toBe(true);
  });
});

describe('Sketch Cards song plan', () => {
  it('is the same every time for the same song', () => {
    const a = sketchPlan(demo('neon-static'));
    const b = sketchPlan(demo('neon-static'));
    expect(JSON.stringify(a.cards.map((c) => [c.card, c.process, c.border, c.drawing?.id, c.hand.id]))).toBe(JSON.stringify(b.cards.map((c) => [c.card, c.process, c.border, c.drawing?.id, c.hand.id])));
  });
  it('keeps the material rules: riso only on riso sheets, photocopy only on wheatpaste and receipts', () => {
    for (const name of ['neon-static', 'glass-hours', 'paper-planets']) {
      for (const c of sketchPlan(demo(name)).cards) {
        if (c.process === 'SKC-PRC-PRT-002') expect(c.card).toBe('SKC-FRM-CRD-010');
        if (c.process === 'SKC-PRC-PRT-003') expect(['SKC-FRM-CRD-011', 'SKC-FRM-CRD-004']).toContain(c.card);
      }
    }
  });
  it('never puts two identical card types on consecutive lines of a section, nor a drawing more than twice', () => {
    for (const name of ['neon-static', 'glass-hours', 'paper-planets']) {
      const tl = demo(name);
      const { cards } = sketchPlan(tl);
      const uses = new Map<string, number>();
      const seenText = new Set<string>();
      cards.forEach((c, i) => {
        const prev = cards[i - 1];
        const scene = sceneSpec(c.scene);
        const repeat = seenText.has(tl.scenes[c.line]!.words.map((w) => w.text.toLowerCase()).join(' '));
        if (prev && !repeat && prev.section === c.section && scene.cards.length > 1) expect(c.card === prev.card && c.line !== prev.line ? `${name}:${i}` : 'ok').toBe('ok');
        // a repeated line (a hook) brings its card back on purpose, so it is counted once
        const text = tl.scenes[c.line]!.words.map((w) => w.text.toLowerCase()).join(' ');
        if (c.drawing && !seenText.has(text)) uses.set(c.drawing.id, (uses.get(c.drawing.id) ?? 0) + 1);
        seenText.add(text);
      });
      for (const n of uses.values()) expect(n).toBeLessThanOrEqual(2);
    }
  });
  it('keeps the dark register apart from cute scenes', () => {
    const scenes = sceneData('sketch-cards').scenes;
    const section = { index: 0, startMs: 0, endMs: 1, role: 'verse' as const, tags: [], chorusOrdinal: 0, lines: null, energy: 0 };
    const song = (dark: boolean) => ({ tags: new Set<string>(), valence: null, arousal: null, dark, density: 5, lineWords: [] });
    for (const s of scenes) {
      const dark = SKETCH_RULES.allowScene!(s, { song: song(true), section });
      const light = SKETCH_RULES.allowScene!(s, { song: song(false), section });
      if (s.id === 'SKC-SCN-12') expect([dark, light]).toEqual([true, false]);
      if (sceneSpec(s.id).drawings === 'cute') expect(dark).toBe(false);
    }
  });
});

describe('Sketch Cards lettering', () => {
  it('detects scripts and direction', () => {
    expect(scriptOf('City hums in electric blue')).toBe('latin');
    expect(scriptOf('शहर की रोशनी')).toBe('devanagari');
    expect(scriptOf('நகரத்தின் ஒளியில்')).toBe('tamil');
    expect(scriptOf('في ضوء المدينة')).toBe('arabic');
    expect(scriptOf('באור של העיר')).toBe('hebrew');
    expect(isRtl('arabic') && isRtl('hebrew') && !isRtl('tamil')).toBe(true);
    expect(handFor('devanagari', 3).id).toBe('SKC-TYP-FNT-009');
    expect(handFor('latin', 9).id).toBe('SKC-TYP-FNT-002');
  });
  it('meets the contrast floors on every paper: ink 7:1, pill text 4.5:1', () => {
    for (const [group, list] of Object.entries(PAPERS))
      for (const paper of list)
        for (let pick = 0; pick < 7; pick++) {
          const set = colourSet(paper, ['#f2d14a', '#2a2a2a', '#ff66aa'], pick, group === 'black');
          expect(contrastRatio(set.ink, paper)).toBeGreaterThanOrEqual(7);
          expect(contrastRatio(onPill(set.pill, set), set.pill)).toBeGreaterThanOrEqual(4.5);
        }
  });
});
