// The Sketch Cards song plan: which scene family each section uses (shared planner + this style's rules), and for every line
// the card it is lettered on: card type, paper and colour set, print process, border, drawing, hand and placement. Everything
// is decided once per song, in line order, as a pure function of the timeline, so a frame at time t only looks things up
// (AGENTS.md rule 3: the same song renders the same picture live and in export).

import { hashString } from '../../kinetic/util';
import type { VisualTimeline } from '../../kinetic/types';
import { sceneData } from '../scene/data';
import { planScenes, type PlannedSection, type ScenePlan, type StyleRules } from '../scene/planner';
import { songSections } from '../scene/sections';
import { songSignals, type SongSignals } from '../scene/signals';
import { fillSlots, type Candidate } from '../scene/slots';
import { BORDER_IDS, CARDS, type BorderId, type CardTypeId, type ProcessId } from './cards';
import { colourSet, PAPERS, type ColourSet } from './colour';
import { DARK } from './drawings/dark';
import { DOODLES } from './drawings/doodles';
import { EVERYDAY } from './drawings/everyday';
import type { Drawing } from './drawings/types';
import type { GroundId } from './grounds';
import { BIG_KINDS, handFor, PILL_KINDS, scriptOf, type BigKind, type Hand, type PillKind, type Script } from './letter';
import { rng } from './pen';

export type SceneId = `SKC-SCN-${string}`;

/** per scene family: the ground it is on, the card types it may use, and which drawing register (if any) */
const SCENES: Record<string, { ground: GroundId; cards: CardTypeId[]; drawings: 'cute' | 'everyday' | 'dark' | null; night?: boolean }> = {
  'SKC-SCN-01': { ground: 'SKC-SRF-GRD-001', cards: ['SKC-FRM-CRD-001', 'SKC-FRM-CRD-002', 'SKC-FRM-CRD-007', 'SKC-FRM-CRD-008', 'SKC-FRM-CRD-013'], drawings: 'cute', night: true },
  'SKC-SCN-02': { ground: 'SKC-SRF-GRD-002', cards: ['SKC-FRM-CRD-003', 'SKC-FRM-CRD-004', 'SKC-FRM-CRD-007', 'SKC-FRM-CRD-001'], drawings: 'everyday' },
  'SKC-SCN-03': { ground: 'SKC-SRF-GRD-003', cards: ['SKC-FRM-CRD-006', 'SKC-FRM-CRD-002', 'SKC-FRM-CRD-005'], drawings: 'cute' },
  'SKC-SCN-04': { ground: 'SKC-SRF-GRD-004', cards: ['SKC-FRM-CRD-011', 'SKC-FRM-CRD-006'], drawings: null },
  'SKC-SCN-05': { ground: 'SKC-SRF-GRD-005', cards: ['SKC-FRM-CRD-009', 'SKC-FRM-CRD-008', 'SKC-FRM-CRD-005'], drawings: 'cute' },
  'SKC-SCN-06': { ground: 'SKC-SRF-GRD-011', cards: ['SKC-FRM-CRD-012'], drawings: 'everyday' },
  'SKC-SCN-07': { ground: 'SKC-SRF-GRD-006', cards: ['SKC-FRM-CRD-001', 'SKC-FRM-CRD-013', 'SKC-FRM-CRD-004', 'SKC-FRM-CRD-007', 'SKC-FRM-CRD-002'], drawings: 'everyday' },
  'SKC-SCN-08': { ground: 'SKC-SRF-GRD-007', cards: ['SKC-FRM-CRD-005'], drawings: null },
  'SKC-SCN-09': { ground: 'SKC-SRF-GRD-008', cards: ['SKC-FRM-CRD-010'], drawings: 'everyday' },
  'SKC-SCN-10': { ground: 'SKC-SRF-GRD-001', cards: ['SKC-FRM-CRD-002'], drawings: 'cute' },
  'SKC-SCN-11': { ground: 'SKC-SRF-GRD-009', cards: ['SKC-FRM-CRD-002', 'SKC-FRM-CRD-008', 'SKC-FRM-CRD-013', 'SKC-FRM-CRD-004', 'SKC-FRM-CRD-001'], drawings: 'everyday' },
  'SKC-SCN-12': { ground: 'SKC-SRF-GRD-010', cards: ['SKC-FRM-CRD-014', 'SKC-FRM-CRD-008'], drawings: 'dark' },
};
export const sceneSpec = (id: string) => SCENES[id] ?? SCENES['SKC-SCN-01']!;

/** Sketch Cards' invalid-combination table, as planner rules */
export const SKETCH_RULES: StyleRules = {
  allowScene(scene, { song }) {
    // the dark register only for dark songs; cute scenes (doodle registers, the bedroom wall, the creature break) never with it
    if (scene.id === 'SKC-SCN-12') return song.dark;
    if (song.dark && (sceneSpec(scene.id).drawings === 'cute' || scene.id === 'SKC-SCN-03')) return false;
    return true;
  },
  maxScenePerSong: 3,
};

export type CardPick = {
  line: number;
  section: number;
  scene: string;
  card: CardTypeId;
  process: ProcessId;
  border: BorderId | null;
  set: ColourSet;
  drawing: { id: string; d: Drawing } | null;
  hand: Hand;
  pill: PillKind;
  big: BigKind;
  script: Script;
  /** degrees, and a resting offset as a fraction of the card size */
  rot: number;
  dx: number;
  dy: number;
  seed: number;
};

export type SketchPlan = { plan: ScenePlan; song: SongSignals; cards: CardPick[]; palette: string[] };

const POOLS = { cute: DOODLES, everyday: EVERYDAY, dark: DARK } as const;
const paperFor = (card: CardTypeId, r: () => number): string => {
  const list = PAPERS[CARDS[card].paper];
  return list[Math.floor(r() * list.length)]!;
};

const cache = new WeakMap<object, SketchPlan>();

export function sketchPlan(tl: VisualTimeline): SketchPlan {
  const hit = cache.get(tl);
  if (hit) return hit;
  const data = sceneData('sketch-cards');
  const song = songSignals(tl);
  const plan = planScenes({ tl, data, song, rules: SKETCH_RULES });
  const seed = hashString(`${tl.trackId}|SKC`);
  const sectionOfLine = new Map<number, PlannedSection>();
  for (const ps of plan.sections) if (ps.section.lines) for (let i = ps.section.lines[0]; i <= ps.section.lines[1]; i++) sectionOfLine.set(i, ps);
  const lines = tl.scenes.map((s, i) => ({ i, scene: s, ps: sectionOfLine.get(i) ?? plan.sections[0]! }));
  // a repeated line (a hook) keeps its card on purpose: recall key = the line's words
  const key = (i: number) => tl.scenes[i]!.words.map((w) => w.text.toLowerCase()).join(' ');
  const cardPicks = fillSlots<CardTypeId>(
    'card',
    seed,
    lines.map(({ i, ps }) => ({ line: i, section: ps.section.index, pool: sceneSpec(ps.scene.id).cards.map((c) => ({ id: c, value: c })), recallKey: key(i) })),
    { perSection: 99, perSong: 99, noRepeatAdjacent: true },
  );
  const drawPicks = fillSlots<Drawing>(
    'drawing',
    seed,
    lines.map(({ i, ps }) => {
      const reg = sceneSpec(ps.scene.id).drawings;
      const words = new Set(tl.scenes[i]!.words.map((w) => w.text.toLowerCase().replace(/[^\p{L}]/gu, '')));
      const pool: Candidate<Drawing>[] = reg ? Object.entries(POOLS[reg]).map(([id, d]) => ({ id, value: d, match: d.tags.some((t) => words.has(t)) ? 1 : 0 })) : [];
      return { line: i, section: ps.section.index, pool, recallKey: key(i) };
    }),
    { perSection: 1, perSong: 2, noRepeatAdjacent: true },
  );
  const palette = tl.palette;
  const cards: CardPick[] = lines.map(({ i, scene, ps }, n) => {
    const r = rng(seed ^ Math.imul(i + 1, 0x9e3779b1));
    const card = cardPicks[n]?.value ?? 'SKC-FRM-CRD-002';
    const spec = CARDS[card];
    const dark = card === 'SKC-FRM-CRD-014' || (song.dark && sceneSpec(ps.scene.id).drawings === 'dark');
    const paper = dark && card !== 'SKC-FRM-CRD-014' ? PAPERS.black[0] : paperFor(card, r);
    const set = colourSet(paper, palette, Math.floor(r() * 7), dark || spec.paper === 'black');
    const process = spec.processes[Math.floor(r() * spec.processes.length)]!;
    // a drawing on roughly two lines in three (and never on a sticky-note wall), so the words get cards of their own too
    const d = drawPicks[n];
    const withDrawing = d && scene.words.length <= 9 && r() < 0.68;
    const text = scene.words.map((w) => w.text).join(' ');
    const script = scriptOf(text);
    return {
      line: i,
      section: ps.section.index,
      scene: ps.scene.id,
      card,
      process,
      border: spec.border && r() < 0.7 ? BORDER_IDS[Math.floor(r() * BORDER_IDS.length)]! : null,
      set,
      drawing: withDrawing ? { id: d.id, d: d.value } : null,
      hand: handFor(script, Math.floor(r() * 8)),
      // highlighter swipes belong to notebook pages, stencils to wheatpaste (SKC-TYP-PIL-005, SKC-TYP-BIG-005 are marked new for those)
      pill: card === 'SKC-FRM-CRD-009' || card === 'SKC-FRM-CRD-008' ? 'highlight' : PILL_KINDS[Math.floor(r() * 4)]!,
      big: card === 'SKC-FRM-CRD-011' ? 'stencil' : BIG_KINDS[Math.floor(r() * 4)]!,
      script,
      rot: (r() - 0.5) * (ps.composition.id === 'SKC-CMP-C5' ? 2 : 9),
      dx: (r() - 0.5) * 0.06,
      dy: (r() - 0.5) * 0.05,
      seed: hashString(`${seed}|${i}|${text}`),
    };
  });
  const out = { plan, song, cards, palette };
  cache.set(tl, out);
  return out;
}
