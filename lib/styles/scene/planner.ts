// The scene planner (docs/visual-production/phase-2/scene-composition-system.md section 3): for each section of a song, which
// scene family, which composition family and which transition in. Pure: the plan is a function of the timeline, the style's
// scene data, the song's signals and a seed, so playback, seeking and export all see the same scenes (AGENTS.md rule 3).
//
// Ties are broken by a hash of (seed, section, scene id), never by array order, so adding a scene family to a style moves other
// choices as little as possible. Repetition windows are hard rules (consecutive scene or composition, per-song caps) and soft
// penalties (recent uses), as in section 4 of that document.

import { hashString } from '../../kinetic/util';
import type { VisualTimeline } from '../../kinetic/types';
import type { CompositionFamily, SceneData, SceneFamily, SectionRole, TransitionSpec } from './data';
import { songSections, type Section } from './sections';
import { signalMatch, type SongSignals } from './signals';

export type Orientation = 'landscape' | 'portrait' | 'square' | 'small';
export const orientationOf = (w: number, h: number): Orientation => (Math.min(w, h) < 480 ? 'small' : w / h > 1.15 ? 'landscape' : h / w > 1.15 ? 'portrait' : 'square');

export type PlannedSection = {
  section: Section;
  scene: SceneFamily;
  composition: CompositionFamily;
  /** the transition into this section (null for the first) */
  transition: TransitionSpec | null;
  /** true when this section brings back the first chorus's scene on purpose */
  recall: boolean;
  /** why the scene family was chosen, for the Studio and the visual-review log */
  reasons: string[];
};
export type ScenePlan = { style: string; seed: number; sections: PlannedSection[] };

/** Style-specific hard rules on top of the shared ones (each style's invalid-combination table). */
export type StyleRules = {
  /** false = the scene family may not be used for this song or section at all */
  allowScene?(scene: SceneFamily, ctx: { song: SongSignals; section: Section }): boolean;
  /** pick a transition for a change between two planned sections; null = use the shared default */
  transition?(prev: PlannedSection, next: Omit<PlannedSection, 'transition'>, specs: TransitionSpec[]): TransitionSpec | null;
  /** max uses of one scene family per song (default 3) */
  maxScenePerSong?: number;
};

export type PlanInput = {
  tl: Pick<VisualTimeline, 'scenes' | 'gaps' | 'durationMs' | 'trackId'>;
  data: SceneData;
  song: SongSignals;
  rules?: StyleRules;
  /** a stable per-song seed; defaults to a hash of the track id */
  seed?: number;
};

/** 0..1 stable hash of any parts */
export const h01 = (...parts: (string | number)[]) => hashString(parts.join('|')) / 4294967296;

const LIVE = (s: { status: string }) => s.status === 'approved' || s.status === 'revised';
const RECENT = 4;

function roleScore(scene: SceneFamily, s: Section): number {
  if (scene.roles.includes(s.role)) return 1;
  const tagHit = s.tags.some((t) => scene.roles.includes(t));
  return tagHit ? 0.55 : 0;
}

export function planScenes(input: PlanInput): ScenePlan {
  const { tl, data, song, rules = {} } = input;
  const seed = input.seed ?? hashString(`${tl.trackId}|${data.code}`);
  // a gated style (every entry deferred until its prototype gate passes) is planned from its deferred entries, so the
  // prototype can be built and judged; the registry keeps it unoffered until the gate is recorded as passed
  const live = <T extends { status: string }>(xs: T[]) => (xs.some(LIVE) ? xs.filter(LIVE) : xs.filter((x) => x.status === 'deferred'));
  const scenes = live(data.scenes);
  const comps = new Map(live(data.compositions).map((c) => [c.id, c]));
  const specs = live(data.transitions);
  const maxUses = rules.maxScenePerSong ?? 3;
  const sections = songSections(tl);
  const out: PlannedSection[] = [];
  const uses = new Map<string, number>();
  let firstChorus: SceneFamily | null = null as SceneFamily | null;

  for (const s of sections) {
    const prev = out[out.length - 1];
    const allowed = scenes.filter((sc) => sc.compositions.some((c) => comps.has(c)) && (rules.allowScene?.(sc, { song, section: s }) ?? true));
    const recallOk: boolean = s.role === 'chorus' && s.chorusOrdinal > 1 && firstChorus !== null && allowed.includes(firstChorus);
    type Scored = { sc: SceneFamily; score: number; recall: boolean; reasons: string[]; tie: number };
    const scored: Scored[] = allowed
      .map((sc): Scored | null => {
        const reasons: string[] = [];
        const r = roleScore(sc, s);
        if (r === 0) return null;
        reasons.push(r === 1 ? `written for ${s.role}` : `fits a ${s.tags.filter((t) => sc.roles.includes(t)).join('/')} section`);
        let score = r;
        const m = signalMatch(sc.signals, song);
        if (m > 0) {
          score += 0.8 * m;
          reasons.push(`song signals: ${sc.signals.filter((x) => song.tags.has(x)).join(', ')}`);
        }
        if (sc.isDefault) score += 0.15;
        const recall: boolean = recallOk && sc === firstChorus;
        if (recall) {
          score += 1.2;
          reasons.push('chorus recall');
        }
        const n = uses.get(sc.id) ?? 0;
        // hard rules: not twice in a row (unless a chorus recall), not more than maxUses per song
        if (prev && prev.scene.id === sc.id && !recall) return null;
        if (n >= maxUses && !recall) return null;
        const recent = out.slice(-RECENT).filter((p) => p.scene.id === sc.id).length;
        score -= 0.2 * recent + 0.08 * n;
        return { sc, score, recall, reasons, tie: h01(seed, s.index, sc.id) };
      })
      .filter((x): x is Scored => x !== null)
      .sort((a, b) => b.score - a.score || b.tie - a.tie);
    // nothing written for this role (a style without break scenes, say): the least used live scene that is not the previous one
    const pick: Scored =
      scored[0] ??
      allowed
        .filter((sc) => !prev || sc.id !== prev.scene.id)
        .map((sc) => ({ sc, score: -(uses.get(sc.id) ?? 0), recall: false, reasons: [`no scene family is written for ${s.role}; least used`], tie: h01(seed, s.index, sc.id) }))
        .sort((a, b) => b.score - a.score || b.tie - a.tie)[0] ??
      { sc: allowed[0] ?? scenes[0]!, score: 0, recall: false, reasons: ['only scene family available'], tie: 0 };
    const scene: SceneFamily = pick.sc;
    uses.set(scene.id, (uses.get(scene.id) ?? 0) + 1);
    if (s.role === 'chorus' && s.chorusOrdinal === 1) firstChorus = scene;
    const composition = chooseComposition(scene, comps, s, prev, pick.recall, seed, song);
    const next = { section: s, scene, composition, recall: pick.recall, reasons: pick.reasons };
    const transition = prev ? (rules.transition?.(prev, next, specs) ?? defaultTransition(prev, next, specs, out, seed)) : null;
    out.push({ ...next, transition });
  }
  return { style: data.code, seed, sections: out };
}

function chooseComposition(scene: SceneFamily, comps: Map<string, CompositionFamily>, s: Section, prev: PlannedSection | undefined, recall: boolean, seed: number, song: SongSignals): CompositionFamily {
  const options = scene.compositions.map((id) => comps.get(id)).filter((c): c is CompositionFamily => !!c);
  if (recall && prev === undefined) return options[0]!;
  const ranked = options
    .map((c, i) => {
      let score = 1 - i * 0.12; // the scene family lists its main composition first
      if (prev && prev.composition.id === c.id && !recall) score -= 2; // hard: not twice in a row
      if (song.density >= 9 && /notes|cluster|receipt|column|list|ticker/i.test(c.name)) score += 0.3;
      if (s.tags.includes('high') && /poster|splash|full|bleed|big/i.test(c.name)) score += 0.25;
      return { c, score, tie: h01(seed, 'cmp', s.index, c.id) };
    })
    .sort((a, b) => b.score - a.score || b.tie - a.tie);
  return ranked[0]!.c;
}

/** Shared default: a transition whose use names the role being entered, else any, never the same one three times running. */
function defaultTransition(prev: PlannedSection, next: Omit<PlannedSection, 'transition'>, specs: TransitionSpec[], done: PlannedSection[], seed: number): TransitionSpec | null {
  if (!specs.length) return null;
  const role: SectionRole = next.section.role;
  const words: Record<SectionRole, RegExp> = {
    intro: /intro|open/i,
    verse: /verse|section|scene change|line/i,
    chorus: /chorus|hook/i,
    bridge: /bridge/i,
    break: /break|instrumental/i,
    quiet: /quiet|calm/i,
    high: /energ|high|drop/i,
    outro: /outro|end|final/i,
  };
  const lastTwo = done.slice(-2).map((p) => p.transition?.id);
  const ok = (t: TransitionSpec) => !(lastTwo.length === 2 && lastTwo[0] === t.id && lastTwo[1] === t.id);
  const named = specs.filter((t) => words[role].test(t.use) && ok(t));
  const pool = named.length ? named : specs.filter(ok);
  const sameScene = prev.scene.id === next.scene.id;
  const ranked = (pool.length ? pool : specs).map((t) => ({ t, tie: h01(seed, 'trn', next.section.index, t.id) + (sameScene && /same/i.test(t.use) ? 1 : 0) })).sort((a, b) => b.tie - a.tie);
  return ranked[0]!.t;
}

/** The planned section at time t. */
export function plannedAt(plan: ScenePlan, t: number): PlannedSection | null {
  const s = plan.sections;
  if (!s.length) return null;
  let lo = 0;
  let hi = s.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (s[mid]!.section.startMs <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return s[ans]!;
}
