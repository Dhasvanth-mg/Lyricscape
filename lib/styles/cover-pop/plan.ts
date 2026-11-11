// The Cover Pop song plan. Scene families come from the shared planner with this style's rules (the no-cover stage only when
// there is no usable cover, and then only it; the framed ending only for outros). Per section: crop path (never repeated in a
// song), colour rule and hot family, voice, chip style, burst. Per phrase: layout (never the same on consecutive phrases),
// motion and at most one sticker (stickers at most once per section; playful ones never with a grief identity). Pure.

import { hashString } from '../../kinetic/util';
import type { VisualTimeline } from '../../kinetic/types';
import { sceneData } from '../scene/data';
import { h01, planScenes, type PlannedSection, type ScenePlan, type StyleRules } from '../scene/planner';
import { songSignals, type SongSignals } from '../scene/signals';
import { lineTiming } from '../timing';
import { scriptOf } from '../sketch-cards/letter';
import type { ColourRule } from './analysis';
import { CROP_PATHS, type CropPathId } from './crops';
import { FALLBACK_IDS, type FallbackId } from './fallback';
import { BURST_IDS, CHIP_IDS, CUT_IDS, PLAYFUL, STICKER_IDS, type BurstId, type ChipId, type CutId, type StickerId } from './marks';
import { LATIN_VOICES, LAYOUT_IDS, splitPhrases, type LayoutId, type Phrase, type Script, type VoiceId } from './type';

export type MotionId = `CVP-MOT-PHM-00${1 | 2 | 3 | 4 | 5 | 6 | 7}`;

export type SectionLook = {
  ps: PlannedSection;
  crop: CropPathId;
  colour: ColourRule;
  hotK: number;
  voice: VoiceId;
  chip: ChipId;
  burst: BurstId | null;
  fallback: FallbackId;
  cuts: CutId[];
};
export type PhrasePlan = Phrase & { layout: LayoutId; motion: MotionId; sticker: StickerId | null; chipWord: number | null };
export type LinePlan = { line: number; section: number; script: Script; phrases: PhrasePlan[] };
export type CoverPlan = { plan: ScenePlan; song: SongSignals; sections: SectionLook[]; lines: LinePlan[]; hasCover: boolean };

export const coverRules = (hasCover: boolean): StyleRules => ({
  allowScene(scene, { section }) {
    if (scene.id === 'CVP-SCN-08') return section.role === 'outro' && hasCover;
    if (!hasCover) return scene.id === 'CVP-SCN-07';
    return scene.id !== 'CVP-SCN-07';
  },
  maxScenePerSong: hasCover ? 3 : 99,
});

const cache = new WeakMap<object, Map<string, CoverPlan>>();

/** `cover`: null = no usable cover; otherwise its natural size (cut-out stickers need 600 px) */
export function coverPlan(tl: VisualTimeline, cover: { natural: number } | null): CoverPlan {
  const key = cover ? `c${cover.natural >= 600 ? 1 : 0}` : 'none';
  let byKey = cache.get(tl);
  if (!byKey) cache.set(tl, (byKey = new Map()));
  const hit = byKey.get(key);
  if (hit) return hit;
  const hasCover = !!cover;
  const data = sceneData('cover-pop');
  const song = songSignals(tl);
  const plan = planScenes({ tl, data, song, rules: coverRules(hasCover) });
  const seed = hashString(`${tl.trackId}|CVP`);
  const usedCrops = new Set<CropPathId>();
  const grief = song.dark;
  const sections: SectionLook[] = plan.sections.map((ps, i) => {
    const role = ps.section.role;
    // a crop path not used before in the song (12 paths; a longer song starts the cycle again)
    let crop = CROP_PATHS[Math.floor(h01(seed, 'crop', i) * CROP_PATHS.length)]!;
    for (let k = 0; usedCrops.has(crop) && k < CROP_PATHS.length; k++) crop = CROP_PATHS[(CROP_PATHS.indexOf(crop) + 1) % CROP_PATHS.length]!;
    if (usedCrops.size >= CROP_PATHS.length) usedCrops.clear();
    usedCrops.add(crop);
    if (ps.scene.id === 'CVP-SCN-06') crop = 'CVP-CAM-CRP-001';
    // the voice follows the section: choruses a loud voice, bridges a different one, quiet a serif; grief never the script
    const loud: VoiceId[] = ['CVP-TYP-VOI-001', 'CVP-TYP-VOI-002', 'CVP-TYP-VOI-003', 'CVP-TYP-VOI-005'];
    const calm: VoiceId[] = grief ? ['CVP-TYP-VOI-004', 'CVP-TYP-VOI-003'] : ['CVP-TYP-VOI-004', 'CVP-TYP-VOI-001', 'CVP-TYP-VOI-006'];
    const pool = role === 'chorus' || ps.section.tags.includes('high') ? loud : role === 'bridge' ? (grief ? ['CVP-TYP-VOI-004'] as VoiceId[] : ['CVP-TYP-VOI-006', 'CVP-TYP-VOI-004', 'CVP-TYP-VOI-005'] as VoiceId[]) : calm;
    const voice = ps.scene.id === 'CVP-SCN-03' ? 'CVP-TYP-VOI-002' : pool[Math.floor(h01(seed, 'voice', i) * pool.length)]!;
    const colourRules: ColourRule[] = ['CVP-PAL-COL-001', 'CVP-PAL-COL-002', 'CVP-PAL-COL-003', 'CVP-PAL-COL-005'];
    const chorusish = role === 'chorus' || ps.scene.id === 'CVP-SCN-03';
    const cuts = [...CUT_IDS].sort((a, b) => h01(seed, 'cut', i, a) - h01(seed, 'cut', i, b)).slice(0, 3);
    return {
      ps,
      crop,
      colour: colourRules[Math.floor(h01(seed, 'col', i) * colourRules.length)]!,
      hotK: Math.floor(h01(seed, 'hot', i) * 8),
      voice: LATIN_VOICES.includes(voice) ? voice : 'CVP-TYP-VOI-001',
      chip: CHIP_IDS[Math.floor(h01(seed, 'chip', i) * CHIP_IDS.length)]!,
      burst: chorusish ? BURST_IDS[Math.floor(h01(seed, 'burst', i) * BURST_IDS.length)]! : null,
      fallback: FALLBACK_IDS[Math.floor(h01(seed, 'fbk', i) * FALLBACK_IDS.length)]!,
      cuts: cover && cover.natural >= 600 ? cuts : [],
    };
  });
  const sectionOf = (li: number) => {
    const i = plan.sections.findIndex((ps) => ps.section.lines && li >= ps.section.lines[0] && li <= ps.section.lines[1]);
    return Math.max(0, i);
  };
  let prevLayout: LayoutId | null = null;
  const stickersUsed = new Map<number, Set<string>>();
  const lines: LinePlan[] = tl.scenes.map((sc, li) => {
    const si = sectionOf(li);
    const look = sections[si]!;
    const timing = lineTiming(sc);
    const script = scriptOf(sc.words.map((w) => w.text).join(' ')) as Script;
    // a quiet breathe takes one word at a time when the words are timed
    let phrases = splitPhrases(sc.words, sc.startMs - 30, timing);
    if (look.ps.scene.id === 'CVP-SCN-06' && timing === 'authored') phrases = sc.words.map((w, i) => ({ words: [i], at: Math.max(0, w.startMs - sc.startMs + 30), rows: [[i]] }));
    const used = stickersUsed.get(si) ?? new Set<string>();
    stickersUsed.set(si, used);
    const out: PhrasePlan[] = phrases.map((ph, pi) => {
      const giant = look.ps.composition.id === 'CVP-CMP-C3' || look.ps.scene.id === 'CVP-SCN-03';
      const field = look.ps.composition.id === 'CVP-CMP-C4';
      const n = ph.words.length;
      // layouts that suit the phrase and the composition, never the same twice in a row
      let pool: LayoutId[] = field ? ['CVP-LAY-PHL-013', 'CVP-LAY-PHL-002', 'CVP-LAY-PHL-014'] : giant ? ['CVP-LAY-PHL-005', 'CVP-LAY-PHL-011', 'CVP-LAY-PHL-007'] : LAYOUT_IDS.filter((id) => id !== 'CVP-LAY-PHL-013');
      if (n === 1) pool = ['CVP-LAY-PHL-001', 'CVP-LAY-PHL-008', 'CVP-LAY-PHL-009'];
      if (ph.rows.length > 1) pool = ['CVP-LAY-PHL-001', 'CVP-LAY-PHL-008', 'CVP-LAY-PHL-009', 'CVP-LAY-PHL-014'];
      if (script !== 'latin') pool = pool.filter((id) => id !== 'CVP-LAY-PHL-014'); // no justified stretching of complex scripts
      const choices = pool.filter((id) => id !== prevLayout);
      const layout = (choices.length ? choices : pool)[Math.floor(h01(seed, 'lay', li, pi) * (choices.length || pool.length))]!;
      prevLayout = layout;
      const energy = look.ps.section.energy;
      const motion: MotionId = giant ? 'CVP-MOT-PHM-004' : timing === 'authored' && n >= 3 && h01(seed, 'build', li, pi) < 0.3 ? 'CVP-MOT-PHM-006' : energy < -0.2 ? 'CVP-MOT-PHM-003' : energy > 0.25 ? 'CVP-MOT-PHM-005' : 'CVP-MOT-PHM-001';
      // the chip goes on the heaviest word (the existing emphasis)
      let chipWord: number | null = null;
      let best = -1;
      for (const w of ph.words) {
        const e = sc.words[w]!.emphasis ?? 0;
        if (e > best) (best = e), (chipWord = w);
      }
      if (n < 2) chipWord = look.ps.scene.id === 'CVP-SCN-03' ? chipWord : null;
      // at most one sticker a phrase, each at most once a section, about every third phrase
      let sticker: StickerId | null = null;
      if (look.ps.scene.id !== 'CVP-SCN-03' && look.ps.scene.id !== 'CVP-SCN-06' && h01(seed, 'stk', li, pi) < 0.38) {
        const options = STICKER_IDS.filter((s) => !used.has(s) && !(grief && PLAYFUL.has(s)));
        if (options.length) {
          sticker = options[Math.floor(h01(seed, 'stkid', li, pi) * options.length)]!;
          used.add(sticker);
        }
      }
      return { ...ph, layout, motion, sticker, chipWord };
    });
    return { line: li, section: si, script, phrases: out };
  });
  const result = { plan, song, sections, lines, hasCover };
  byKey.set(key, result);
  return result;
}
