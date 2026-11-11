// The Glyph Cinema song plan (scene-families.md "Deterministic selection" and "Repetition control"). Scene families come from
// the shared planner with this style's rules; per song a phosphor colour and a subject that the title or lyrics call; per
// section the composition, subject, register, palette, ramp, cell density, band layout, camera, teletext page and paper; per
// line the reveal time of every grapheme (authored per word, otherwise a sweep over the first 40% of the line). Pure and
// cached per timeline, so playback, seeking and export agree.

import { hashString } from '../../kinetic/util';
import type { VisualTimeline } from '../../kinetic/types';
import { sceneData } from '../scene/data';
import { h01, planScenes, type PlannedSection, type ScenePlan, type StyleRules } from '../scene/planner';
import { songSignals, type SongSignals } from '../scene/signals';
import { scriptOf, type Script } from '../sketch-cards/letter';
import { lineTiming, revealAt, type LineTiming } from '../timing';
import { blockColours, coverPhosphor, duotone, PHOSPHOR, RIBBON, type Colours, type PaletteId, type RampId, type RegisterId } from './ramps';
import { pickSubjectFor, SUBJECTS, subjectHits } from './subjects';

export type Comp = 'C1' | 'C3' | 'C4' | 'C5' | 'C6';
export type Density = 'coarse' | 'medium' | 'fine' | 'macro';
export type BandLayout = 'GLY-LAY-LAY-001' | 'GLY-LAY-LAY-002' | 'GLY-LAY-LAY-003' | 'GLY-LAY-LAY-004' | 'GLY-LAY-LAY-005' | 'GLY-LAY-LAY-006' | 'GLY-LAY-LAY-007';
export type Camera = 'GLY-CAM-CAM-001' | 'GLY-CAM-CAM-002' | 'GLY-CAM-CAM-003' | 'GLY-CAM-CAM-004' | 'GLY-CAM-CAM-005';
export type PageId = 'GLY-LAY-PAG-001' | 'GLY-LAY-PAG-002' | 'GLY-LAY-PAG-003' | 'GLY-LAY-PAG-004' | 'GLY-LAY-PAG-005' | 'GLY-LAY-PAG-006' | 'GLY-LAY-PAG-007' | 'GLY-LAY-PAG-009';
export type PaperId = 'GLY-SRF-PAP-001' | 'GLY-SRF-PAP-002' | 'GLY-SRF-PAP-003' | 'GLY-SRF-PAP-004' | 'GLY-SRF-PAP-005' | 'GLY-SRF-PAP-006';
export type TransitionId = 'GLY-TRN-NOISE-FRONT' | 'GLY-TRN-PAGE-UPDATE' | 'GLY-TRN-DEVELOP' | 'GLY-TRN-ZOOM-STEP' | 'GLY-TRN-DECAY-BLANK' | 'GLY-TRN-CARRIAGE-RETURN' | null;

export type SectionLook = {
  ps: PlannedSection;
  /** the composition drawn (the planned one when it is built; C2 calligram is gated, see blockers B-05) */
  comp: Comp;
  planned: string;
  subject: number;
  register: RegisterId;
  palette: PaletteId;
  colours: Colours;
  ramp: RampId;
  density: Density;
  band: BandLayout;
  camera: Camera;
  page: PageId | null;
  paper: PaperId | null;
  /** typewriter: the red half of the ribbon is used for hook lines */
  redRibbon: boolean;
  transition: TransitionId;
};
export type LineLook = {
  line: number;
  section: number;
  text: string;
  script: Script;
  /** complex scripts are set as one shaped strip (no per-cell letters, typography.md "Scripts") */
  strip: boolean;
  timing: LineTiming;
  /** graphemes of `text`, and when each appears (absolute ms) */
  graphemes: string[];
  revealMs: number[];
  /** grapheme ranges of each word, and when it is sung (authored timing only) */
  words: { from: number; to: number; startMs: number; endMs: number }[];
  /** how many times this line has been heard so far (1 = first) */
  repeat: number;
  /** sung more than once in the song: a hook */
  hook: boolean;
};
export type GlyPlan = { plan: ScenePlan; song: SongSignals; seed: number; songSubject: number | null; phosphor: PaletteId; phosColours: Colours; colours: string[]; sections: SectionLook[]; lines: LineLook[] };

const has = (song: SongSignals, ...ws: string[]) => ws.some((w) => song.tags.has(w));

export const glyphRules = (seed: number, symbolsCalled: boolean): StyleRules => {
  return {
    allowScene(scene, { section }) {
      switch (scene.id) {
        case 'GLY-SCN-13':
          return symbolsCalled || h01(seed, 'symbols') < 0.2;
        case 'GLY-SCN-12':
          return section.role !== 'chorus' && section.role !== 'high';
        default:
          return true;
      }
    },
    maxScenePerSong: 3,
  };
};

const cache = new WeakMap<object, Map<string, GlyPlan>>();

/** a register's colours for the song (phosphor: the song's phosphor; block shade and one-bit: from the cover or palette) */
export function coloursOf(register: RegisterId, phos: Colours, colours: string[]): Colours {
  if (register === 'GLY-PRC-REG-005') return blockColours(colours, phos);
  if (register === 'GLY-PRC-REG-004') {
    const duo = duotone(colours);
    return { c0: '#000000', c1: '#808080', c2: '#ffffff', text: duo.ink, bandBg: duo.paper, accent: duo.ink, bg: duo.paper, ink: duo.ink, paper: duo.paper };
  }
  if (register === 'GLY-PRC-REG-003') return { c0: '#000000', c1: '#808080', c2: '#ffffff', text: RIBBON['GLY-PAL-PAL-006'].ink, bandBg: '#00000000', accent: RIBBON['GLY-PAL-PAL-007'].red!, bg: '#2a2622', ink: RIBBON['GLY-PAL-PAL-006'].ink };
  if (register === 'GLY-PRC-REG-002') return { c0: '#000000', c1: '#0000ff', c2: '#00ffff', text: '#ffff00', bandBg: '#0000ff', accent: '#ffff00', bg: '#000000' };
  return phos;
}

let segmenter: Intl.Segmenter | null = null;
export function graphemes(s: string): string[] {
  try {
    segmenter ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return [...segmenter.segment(s)].map((x) => x.segment);
  } catch {
    return [...s];
  }
}

/** the step the screen updates in: cells change at 30 fps at most (motion.md) */
export const STEP_MS = 1000 / 30;
export const quantise = (t: number) => Math.floor(t / STEP_MS) * STEP_MS;

/** reveal times for every grapheme of a line (absolute ms) */
export function revealLine(words: { text: string; startMs: number; endMs: number; timing?: string }[], startMs: number, durMs: number, timing: LineTiming, reduced: boolean) {
  const gs: string[] = [];
  const times: number[] = [];
  const spans: LineLook['words'] = [];
  words.forEach((w, i) => {
    if (i > 0) {
      gs.push(' ');
      times.push(times[times.length - 1] ?? startMs);
    }
    const at = startMs + revealAt(words as never, i, startMs, durMs, timing);
    const g = graphemes(w.text);
    const nextAt = i + 1 < words.length ? startMs + revealAt(words as never, i + 1, startMs, durMs, timing) : at + Math.min(600, durMs * 0.2);
    // within a word, letters type at most one a frame and finish before the next word starts
    const per = reduced ? 0 : Math.max(STEP_MS, Math.min(70, (Math.max(STEP_MS, nextAt - at) * 0.8) / Math.max(1, g.length)));
    const from = gs.length;
    g.forEach((c, k) => {
      gs.push(c);
      times.push(quantise(at + k * per));
    });
    spans.push({ from, to: gs.length, startMs: w.startMs, endMs: w.endMs });
  });
  return { graphemes: gs, revealMs: times, words: spans };
}

/** `colours`: the cover's colours (or the timeline palette) for cover-hue phosphor, block shade and the 1-bit duotone */
export function glyPlan(tl: VisualTimeline, reduced: boolean, colours: string[]): GlyPlan {
  const key = `${reduced ? 1 : 0}|${colours.join(',')}`;
  let byKey = cache.get(tl);
  if (!byKey) cache.set(tl, (byKey = new Map()));
  const hit = byKey.get(key);
  if (hit) return hit;
  const seed = hashString(`${tl.trackId}|GLY`);
  const data = sceneData('glyph-cinema');
  const song = songSignals(tl);
  const title = subjectHits((tl.label ?? '').split('•')[0] ?? '');
  const allText = tl.scenes.map((s) => s.words.map((w) => w.text).join(' ')).join(' ');
  const lyrics = subjectHits(allText);
  const symbolsCalled = [...title.keys(), ...[...lyrics.entries()].filter((e) => e[1] >= 2).map((e) => e[0])].some((i) => SUBJECTS[i]!.family === 'GLY-SCN-13');
  const plan = planScenes({ tl, data, song, rules: glyphRules(seed, symbolsCalled) });

  // the song's own subject: a title hit decides; otherwise a lyric subject heard three times or more
  let songSubject: number | null = null;
  for (const [i] of [...title.entries()].sort((a, b) => b[1] - a[1])) {
    songSubject = i;
    break;
  }
  if (songSubject === null) {
    const top = [...lyrics.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 3) songSubject = top[0];
  }

  // phosphor colour for the song: the cover's hue when it has one (and the seed agrees), else by mood
  const coverHue = coverPhosphor(colours);
  const warm = has(song, 'fire', 'love', 'dance') || (song.valence ?? 0) > 0.35;
  let phosphor: PaletteId = song.dark ? 'GLY-PAL-PAL-003' : warm ? 'GLY-PAL-PAL-002' : 'GLY-PAL-PAL-001';
  if (coverHue && h01(seed, 'coverHue') < 0.45) phosphor = 'GLY-PAL-PAL-004';
  else if (!song.dark && h01(seed, 'phos') < 0.25) phosphor = phosphor === 'GLY-PAL-PAL-001' ? 'GLY-PAL-PAL-002' : 'GLY-PAL-PAL-001';
  const phosColours: Colours = phosphor === 'GLY-PAL-PAL-004' ? coverHue! : PHOSPHOR[phosphor as 'GLY-PAL-PAL-001'];
  const blocks = blockColours(colours, phosColours);
  const paperPool: PaperId[] = ['GLY-SRF-PAP-001', 'GLY-SRF-PAP-002', 'GLY-SRF-PAP-003', 'GLY-SRF-PAP-004', 'GLY-SRF-PAP-005'];
  if (tl.durationMs < 150000) paperPool.push('GLY-SRF-PAP-006');
  const songPaper = song.dark ? 'GLY-SRF-PAP-003' : paperPool[Math.floor(h01(seed, 'paper') * paperPool.length)]!;
  const redRibbonSong = has(song, 'love') || h01(seed, 'ribbon') < 0.3;
  // CJK, Greek and Cyrillic songs get a ramp in their own letters (never complex scripts: typography.md "Fallback")
  const scriptRamp: RampId | null = /[぀-ヿ]/.test(allText) ? 'GLY-TYP-RMP-010' : /[가-힯]/.test(allText) ? 'GLY-TYP-RMP-011' : /[Ͱ-Ͽ]/.test(allText) ? 'GLY-TYP-RMP-008' : /[Ѐ-ӿ]/.test(allText) ? 'GLY-TYP-RMP-009' : null;

  const avoid = new Set<number>();
  const famSubject = new Map<string, number>();
  let blockUsed = 0;
  const sections: SectionLook[] = plan.sections.map((ps, i) => {
    const role = ps.section.role;
    const fam = ps.scene.id;
    const planned = ps.composition.id.replace('GLY-CMP-', '');
    // the subject: the song's own subject for choruses and the first verse; otherwise one per family, stable within the song
    const secText = ps.section.lines ? tl.scenes.slice(ps.section.lines[0], ps.section.lines[1] + 1).map((s) => s.words.map((w) => w.text).join(' ')).join(' ') : '';
    const pictureFam = fam === 'GLY-SCN-11' || fam === 'GLY-SCN-12' ? null : fam;
    let subject: number;
    const firstVerse = role === 'verse' && !plan.sections.slice(0, i).some((p) => p.section.role === 'verse');
    if (songSubject !== null && (role === 'chorus' || firstVerse || role === 'intro')) subject = songSubject;
    else if (pictureFam && famSubject.has(pictureFam)) subject = famSubject.get(pictureFam)!;
    else {
      const f = pictureFam ?? (songSubject !== null ? SUBJECTS[songSubject]!.family : 'GLY-SCN-01');
      subject = pickSubjectFor(f, title, lyrics, subjectHits(secText), h01(seed, 'subject', i), avoid);
    }
    if (pictureFam) famSubject.set(pictureFam, subject);
    avoid.add(subject);

    // composition: the calligram is gated (B-05), drawn as the picture with the band (hooks invert); teletext pages for the
    // teletext family, the typewriter sheet for the letter family and for C4
    let comp: Comp = planned === 'C2' ? 'C1' : (planned as Comp);
    if (fam === 'GLY-SCN-11') comp = 'C3';
    if (fam === 'GLY-SCN-12') comp = 'C4';

    // register
    let register: RegisterId = 'GLY-PRC-REG-001';
    if (comp === 'C3') register = 'GLY-PRC-REG-002';
    else if (comp === 'C4') register = 'GLY-PRC-REG-003';
    else if (fam === 'GLY-SCN-13') register = 'GLY-PRC-REG-004';
    else if (role === 'chorus' && comp !== 'C6' && blockUsed < 2 && blocks.c1 !== phosColours.c1 && h01(seed, 'block', i) < 0.5) {
      register = 'GLY-PRC-REG-005';
      blockUsed++;
    }
    const palette: PaletteId = register === 'GLY-PRC-REG-002' ? 'GLY-PAL-PAL-005' : register === 'GLY-PRC-REG-003' ? (redRibbonSong ? 'GLY-PAL-PAL-007' : 'GLY-PAL-PAL-006') : register === 'GLY-PRC-REG-004' ? 'GLY-PAL-PAL-008' : phosphor;
    const col = coloursOf(register, phosColours, colours);

    // ramp
    const sub = SUBJECTS[subject]!;
    let ramp: RampId = 'GLY-TYP-RMP-001';
    if (register === 'GLY-PRC-REG-005') ramp = 'GLY-TYP-RMP-003';
    else if (register === 'GLY-PRC-REG-002') ramp = 'GLY-TYP-RMP-013';
    else if (register === 'GLY-PRC-REG-003') ramp = h01(seed, 'tw', i) < 0.5 ? 'GLY-TYP-RMP-012' : 'GLY-TYP-RMP-006';
    else if (register === 'GLY-PRC-REG-004') ramp = h01(seed, 'bit', i) < 0.5 ? 'GLY-TYP-RMP-003' : 'GLY-TYP-RMP-004';
    else if (scriptRamp) ramp = scriptRamp;
    else if (sub.family === 'GLY-SCN-05') ramp = 'GLY-TYP-RMP-005';
    else if (sub.family === 'GLY-SCN-08') ramp = 'GLY-TYP-RMP-007';
    else {
      const pool: RampId[] = ['GLY-TYP-RMP-001', 'GLY-TYP-RMP-002', 'GLY-TYP-RMP-002', 'GLY-TYP-RMP-004'];
      ramp = pool[Math.floor(h01(seed, 'ramp', i) * pool.length)]!;
    }

    // resolution: quiet sections fine, verses medium, choruses coarse; macro composition its own
    const density: Density = comp === 'C6' ? 'macro' : role === 'chorus' || role === 'high' ? 'coarse' : role === 'intro' || role === 'quiet' || role === 'outro' || ramp === 'GLY-TYP-RMP-004' ? 'fine' : 'medium';

    // band
    let band: BandLayout = sub.focal === 'low' ? 'GLY-LAY-LAY-001' : 'GLY-LAY-LAY-002';
    if (comp === 'C3') band = 'GLY-LAY-LAY-004';
    else if (comp === 'C4') band = 'GLY-LAY-LAY-005';
    else if (comp === 'C5') band = 'GLY-LAY-LAY-006';
    else if (comp === 'C6') band = 'GLY-LAY-LAY-007';
    else if (role === 'chorus' && register === 'GLY-PRC-REG-001') band = 'GLY-LAY-LAY-003';

    // camera, in cell units
    let camera: Camera = 'GLY-CAM-CAM-004';
    if (comp === 'C1' || comp === 'C5') {
      if (role === 'chorus') camera = 'GLY-CAM-CAM-001';
      else if (role === 'bridge' || role === 'outro') camera = 'GLY-CAM-CAM-002';
      else if (role === 'verse') camera = h01(seed, 'cam', i) < 0.5 ? 'GLY-CAM-CAM-003' : 'GLY-CAM-CAM-005';
    }
    if (reduced) camera = 'GLY-CAM-CAM-004';

    // teletext page
    let page: PageId | null = null;
    if (comp === 'C3') {
      const choices: Record<string, PageId[]> = {
        intro: ['GLY-LAY-PAG-007', 'GLY-LAY-PAG-001'],
        outro: ['GLY-LAY-PAG-009'],
        break: ['GLY-LAY-PAG-002', 'GLY-LAY-PAG-001', 'GLY-LAY-PAG-003'],
        chorus: ['GLY-LAY-PAG-005', 'GLY-LAY-PAG-003'],
        verse: ['GLY-LAY-PAG-006', 'GLY-LAY-PAG-004'],
      };
      const pool = choices[role] ?? ['GLY-LAY-PAG-006', 'GLY-LAY-PAG-004', 'GLY-LAY-PAG-002'];
      page = pool[Math.floor(h01(seed, 'page', i) * pool.length)]!;
    }
    const paper: PaperId | null = comp === 'C4' ? songPaper : null;

    // the transition into this section
    const prev = i > 0 ? plan.sections[i - 1] : null;
    let transition: TransitionId = null;
    if (i === 0) transition = 'GLY-TRN-DEVELOP';
    else if (comp === 'C3') transition = 'GLY-TRN-PAGE-UPDATE';
    else if (comp === 'C4') transition = null;
    else if (prev && role === 'chorus' && camera === 'GLY-CAM-CAM-001') transition = 'GLY-TRN-ZOOM-STEP';
    else transition = 'GLY-TRN-NOISE-FRONT';
    if (reduced && transition !== 'GLY-TRN-PAGE-UPDATE') transition = null;

    return { ps, comp, planned, subject, register, palette, colours: col, ramp, density, band, camera, page, paper, redRibbon: redRibbonSong, transition };
  });

  const sectionOf = (li: number) => Math.max(0, plan.sections.findIndex((ps) => ps.section.lines && li >= ps.section.lines[0] && li <= ps.section.lines[1]));
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').trim();
  const counts = new Map<string, number>();
  for (const sc of tl.scenes) {
    const k = norm(sc.words.map((w) => w.text).join(' '));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  const lines: LineLook[] = tl.scenes.map((sc, li) => {
    const text = sc.words.map((w) => w.text).join(' ');
    const script = scriptOf(text) as Script;
    const timing = lineTiming(sc);
    const r = revealLine(sc.words, sc.startMs, Math.max(1, sc.endMs - sc.startMs), timing, reduced);
    const k = norm(text);
    const repeat = (seen.get(k) ?? 0) + 1;
    seen.set(k, repeat);
    return { line: li, section: sectionOf(li), text, script, strip: script === 'devanagari' || script === 'tamil' || script === 'arabic' || script === 'hebrew', timing, ...r, repeat, hook: (counts.get(k) ?? 0) > 1 };
  });
  const out: GlyPlan = { plan, song, seed, songSubject, phosphor, phosColours, colours, sections, lines };
  byKey.set(key, out);
  return out;
}
