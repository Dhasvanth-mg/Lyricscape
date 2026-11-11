// The Konstrukt song plan (scene-families.md, design-spec.md sections 3-4). Scene families come from the shared planner with
// this style's rules; per song the colour systems; per section the composition, layout template, shape family and
// choreography, grid, colour system, energy tier and step list, and the transition in; per line its words with their scripts,
// how many times it has been heard and whether it is a hook. Frame-size choices (which grid, which split, whether a rotated line
// fits) are made by the scene from these. Pure and cached per timeline.

import { hashString } from '../../kinetic/util';
import type { VisualTimeline } from '../../kinetic/types';
import { sceneData } from '../scene/data';
import { h01, planScenes, type PlannedSection, type ScenePlan, type StyleRules } from '../scene/planner';
import { songSignals, type SongSignals } from '../scene/signals';
import { scriptOf, type Script } from '../sketch-cards/letter';
import { lineTiming, type LineTiming } from '../timing';
import { familyChoreos } from './forms';
import type { LayId } from './grid';
import { coverHues, inksOf, texturesOf, type Inks, type PalId, type TexId } from './palette';
import { stepsFor, type Steps, type Tier } from './steps';

export type Comp = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7';
export type TrnId = 'KON-TRN-REFLOW' | 'KON-TRN-MODULE-WIPE' | 'KON-TRN-FIELD-SWAP' | 'KON-TRN-REMOVE' | 'KON-TRN-GRID-DRAW';

/** the shape family each scene family plays */
export const SCENE_FAMILY: Record<string, string> = {
  'KON-SCN-01': 'KON-GEO-CIR',
  'KON-SCN-02': 'KON-GEO-BAR',
  'KON-SCN-03': 'KON-GEO-ARC',
  'KON-SCN-04': 'KON-GEO-DIA',
  'KON-SCN-05': 'KON-GEO-DOT',
  'KON-SCN-06': 'KON-GEO-RNG',
  'KON-SCN-07': 'KON-GEO-SQR',
  'KON-SCN-08': 'KON-GEO-WAV',
  'KON-SCN-09': 'KON-GEO-RUL',
  'KON-SCN-10': 'KON-GEO-MIX',
  'KON-SCN-11': 'KON-GEO-RNG',
};

export type SectionLook = {
  ps: PlannedSection;
  comp: Comp;
  /** the composition the planner chose (before this style's script and timing rules) */
  planned: Comp;
  /** template choice within the composition, 0..1 (the template itself depends on the frame shape) */
  pick: number;
  family: string;
  choreo: string;
  palette: PalId;
  inks: Inks;
  textures: TexId[];
  gridVisible: boolean;
  tier: Tier;
  steps: Steps;
  transition: TrnId | null;
  label: string;
};
export type WordLook = { text: string; startMs: number; endMs: number; script: Script };
export type LineLook = { line: number; section: number; text: string; words: WordLook[]; script: Script; rtl: boolean; timing: LineTiming; repeat: number; hook: boolean };
export type KonPlan = { plan: ScenePlan; song: SongSignals; seed: number; untimed: boolean; main: PalId; sections: SectionLook[]; lines: LineLook[] };

const COMPLEX: Script[] = ['devanagari', 'tamil', 'arabic'];
const has = (song: SongSignals, ...ws: string[]) => ws.some((w) => song.tags.has(w));

export const konstruktRules = (): StyleRules => ({
  allowScene(scene, { section }) {
    // the type-only poster is for quiet sections, intros and outros; the negative print for bridges and breaks
    if (scene.id === 'KON-SCN-09') return section.role === 'quiet' || section.role === 'intro' || section.role === 'outro' || section.tags.includes('quiet');
    return true;
  },
  maxScenePerSong: 3,
});

/** lyrics with only an even spread of line times and no word times (a plain, unsynced text) */
export function isUntimed(tl: Pick<VisualTimeline, 'scenes'>): boolean {
  const ls = tl.scenes;
  if (ls.length < 4) return false;
  if (ls.some((s) => lineTiming(s) !== 'line')) return false;
  const iv = ls.slice(1).map((s, i) => s.startMs - ls[i]!.startMs);
  const mean = iv.reduce((a, b) => a + b, 0) / iv.length;
  return mean > 0 && iv.every((d) => Math.abs(d - mean) <= mean * 0.02);
}

/** the song's colour systems: main (verses), chorus and negative */
export function songSystems(song: SongSignals, colours: string[], seed: number): { main: PalId; chorus: PalId; negative: PalId } {
  const hues = coverHues(colours);
  let main: PalId = 'KON-PAL-PAL-001';
  const r = h01(seed, 'pal');
  if (hues.length >= 2 && r < 0.5) main = h01(seed, 'coat') < 0.5 ? 'KON-PAL-PAL-002' : 'KON-PAL-PAL-003';
  else if (hues.length >= 1 && (song.dark || r < 0.65)) main = 'KON-PAL-PAL-004';
  else if (has(song, 'dance', 'electronic', 'city') && !song.dark) main = h01(seed, 'riso') < 0.5 ? 'KON-PAL-PAL-006' : 'KON-PAL-PAL-007';
  else if ((song.arousal ?? 0.5) > 0.65 && !song.dark) main = 'KON-PAL-PAL-005';
  else if ((song.arousal ?? 0.5) < 0.3) main = 'KON-PAL-PAL-008';
  // choruses keep the main system or move to a partner (a module wipe at the reflow)
  const partner: Record<PalId, PalId> = {
    'KON-PAL-PAL-001': 'KON-PAL-PAL-005',
    'KON-PAL-PAL-002': 'KON-PAL-PAL-004',
    'KON-PAL-PAL-003': 'KON-PAL-PAL-002',
    'KON-PAL-PAL-004': 'KON-PAL-PAL-001',
    'KON-PAL-PAL-005': 'KON-PAL-PAL-001',
    'KON-PAL-PAL-006': 'KON-PAL-PAL-007',
    'KON-PAL-PAL-007': 'KON-PAL-PAL-006',
    'KON-PAL-PAL-008': 'KON-PAL-PAL-001',
    'KON-PAL-PAL-009': 'KON-PAL-PAL-001',
    'KON-PAL-PAL-010': 'KON-PAL-PAL-004',
  };
  let chorus = h01(seed, 'chorusPal') < 0.5 ? main : partner[main];
  if (!inksOf(chorus, colours)) chorus = main;
  return { main, chorus, negative: hues.length >= 1 && h01(seed, 'neg') < 0.6 ? 'KON-PAL-PAL-010' : 'KON-PAL-PAL-009' };
}

const cache = new WeakMap<object, Map<string, KonPlan>>();

export function konPlan(tl: VisualTimeline, reduced: boolean, colours: string[]): KonPlan {
  const key = `${reduced ? 1 : 0}|${colours.join(',')}`;
  let byKey = cache.get(tl);
  if (!byKey) cache.set(tl, (byKey = new Map()));
  const hit = byKey.get(key);
  if (hit) return hit;
  const seed = hashString(`${tl.trackId}|KON`);
  const song = songSignals(tl);
  const plan = planScenes({ tl, data: sceneData('konstrukt'), song, rules: konstruktRules() });
  const untimed = isUntimed(tl);
  const systems = songSystems(song, colours, seed);

  // lines: words with scripts, repeats, hooks
  const seen = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const s of tl.scenes) {
    const k = s.words.map((w) => w.text.toLowerCase()).join(' ');
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const lineSection = new Map<number, number>();
  plan.sections.forEach((ps, i) => {
    if (ps.section.lines) for (let l = ps.section.lines[0]; l <= ps.section.lines[1]; l++) lineSection.set(l, i);
  });
  const lines: LineLook[] = tl.scenes.map((s, i) => {
    const k = s.words.map((w) => w.text.toLowerCase()).join(' ');
    const repeat = (seen.get(k) ?? 0) + 1;
    seen.set(k, repeat);
    const words = s.words.map((w) => ({ text: w.text, startMs: w.startMs, endMs: w.endMs, script: scriptOf(w.text) }));
    const scripts = words.map((w) => w.script).filter((x) => x !== 'latin' && x !== 'other');
    const script: Script = scripts.length ? scripts.sort((a, b) => scripts.filter((x) => x === b).length - scripts.filter((x) => x === a).length)[0]! : 'latin';
    return { line: i, section: lineSection.get(i) ?? 0, text: words.map((w) => w.text).join(' '), words, script, rtl: script === 'arabic' || script === 'hebrew', timing: lineTiming(s), repeat, hook: s.hook || (counts.get(k) ?? 0) > 1 };
  });

  const famUses = new Map<string, number>();
  const usedChoreo = new Set<string>();
  const sections: SectionLook[] = plan.sections.map((ps, i) => {
    const sec = ps.section;
    const role = sec.role;
    const planned = ps.composition.id.replace('KON-CMP-', '') as Comp;
    const secLines = sec.lines ? lines.slice(sec.lines[0], sec.lines[1] + 1) : [];
    const anyComplex = secLines.some((l) => l.words.some((w) => COMPLEX.includes(w.script)));
    const allAuthored = secLines.length > 0 && secLines.every((l) => l.timing === 'authored');
    const longWords = secLines.some((l) => l.words.some((w) => w.text.length > 12));
    const dense = song.density >= 9;
    let comp: Comp = planned;
    // invalid combinations: rotated edge never with Devanagari, Tamil or Arabic; scatter only with authored word times and
    // never for complex scripts with long words; dense lines turn the column stack into a block
    if (comp === 'C3' && anyComplex) comp = 'C1';
    if (comp === 'C6' && (!allAuthored || (anyComplex && longWords))) comp = 'C1';
    if (comp === 'C2' && dense) comp = 'C1';
    if (untimed) comp = 'C1';

    const family = SCENE_FAMILY[ps.scene.id] ?? 'KON-GEO-CIR';
    const n = famUses.get(family) ?? 0;
    famUses.set(family, n + 1);
    const pool = familyChoreos(family);
    const fresh = pool.filter((c) => !usedChoreo.has(c));
    const from = fresh.length ? fresh : pool;
    const choreo = from[Math.floor(h01(seed, 'choreo', i) * from.length)]!;
    usedChoreo.add(choreo);

    const palette: PalId = ps.scene.id === 'KON-SCN-11' ? systems.negative : role === 'chorus' || role === 'high' ? systems.chorus : systems.main;
    const inks = inksOf(palette, colours) ?? inksOf('KON-PAL-PAL-001', colours)!;
    const drag = h01(seed, 'drag') < 0.35;
    const energetic = role === 'chorus' || role === 'high' || sec.tags.includes('high') || sec.energy > 0.3;
    const calm = role === 'quiet' || sec.tags.includes('quiet') || sec.energy < -0.3 || ps.scene.id === 'KON-SCN-09' || ps.scene.id === 'KON-SCN-08';
    const tier: Tier = calm ? 'calm' : energetic ? 'energetic' : 'normal';
    const steps = untimed ? { src: 'KON-MOT-TIM-006' as const, times: metronome(sec.startMs, sec.endMs, reduced), hits: [] as boolean[] } : stepsFor(tl, sec, tier, reduced);
    if (untimed) steps.hits = steps.times.map(() => false);
    const verseN = plan.sections.slice(0, i + 1).filter((p) => p.section.role === role).length;
    const label = role === 'chorus' ? `Chorus ${sec.chorusOrdinal || verseN}` : role === 'verse' ? `Verse ${verseN}` : role[0]!.toUpperCase() + role.slice(1);
    return {
      ps,
      comp,
      planned,
      pick: h01(seed, 'lay', i),
      family,
      choreo,
      palette: inks.id,
      inks,
      textures: texturesOf(inks, drag),
      gridVisible: ps.scene.id === 'KON-SCN-09' || role === 'intro' || h01(seed, 'gridv', i) < 0.55,
      tier,
      steps,
      transition: null,
      label,
    };
  });

  // transitions in (motion.md "Transition families"): a colour system change is a module wipe; split into split swaps
  // fields; into an outro or a quiet section modules are removed; otherwise the grid reflows. The first section draws the grid.
  sections.forEach((s, i) => {
    if (i === 0) {
      s.transition = 'KON-TRN-GRID-DRAW';
      return;
    }
    const prev = sections[i - 1]!;
    const role = s.ps.section.role;
    s.transition = prev.palette !== s.palette ? 'KON-TRN-MODULE-WIPE' : prev.comp === 'C4' && s.comp === 'C4' ? 'KON-TRN-FIELD-SWAP' : role === 'outro' || role === 'quiet' ? 'KON-TRN-REMOVE' : 'KON-TRN-REFLOW';
  });

  const out: KonPlan = { plan, song, seed, untimed, main: systems.main, sections, lines };
  byKey.set(key, out);
  return out;
}

function metronome(a: number, b: number, reduced: boolean): number[] {
  const out: number[] = [];
  for (let t = a; t < b; t += reduced ? 4000 : 2000) out.push(t);
  return out;
}
