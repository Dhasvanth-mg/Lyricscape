// Filling a slot with an asset (scene-composition-system.md section 3, `fill`). Picks are made for every line of the song in
// order, once, so the repetition windows can see what came before and the result is still a pure function of the song: the
// frame at time t looks up its line's picks instead of keeping state between frames.

import { h01 } from './planner';

export type Candidate<T> = {
  id: string;
  value: T;
  /** 0..1 how well the asset matches the line (lexicon, mood); 0 = neutral */
  match?: number;
  /** a hook asset may return by design (the hook card, worn) */
  hook?: boolean;
};

export type SlotRules = {
  /** most uses of one asset inside a section (default 1) */
  perSection?: number;
  /** most uses of one asset in the song (default 2) */
  perSong?: number;
  /** never the same asset on two consecutive lines (default true) */
  noRepeatAdjacent?: boolean;
};

export type SlotRequest<T> = {
  /** the line index (into the timeline's lines) */
  line: number;
  /** the section index the line is in */
  section: number;
  pool: Candidate<T>[];
  /** the same key on a repeated line (a hook) returns the same asset on purpose */
  recallKey?: string;
};

/**
 * Picks one asset per request, in order. Hard rules are relaxed in a fixed order when a pool is too small (adjacency last), so a
 * slot is never left empty: a frame always has something to draw, and the relaxation is the same every time.
 */
export function fillSlots<T>(slot: string, seed: number, requests: SlotRequest<T>[], rules: SlotRules = {}): (Candidate<T> | null)[] {
  const perSection = rules.perSection ?? 1;
  const perSong = rules.perSong ?? 2;
  const adjacent = rules.noRepeatAdjacent ?? true;
  const song = new Map<string, number>();
  const bySection = new Map<string, number>();
  const recalls = new Map<string, Candidate<T>>();
  let prev: string | null = null;
  return requests.map((r) => {
    if (!r.pool.length) return null;
    const recalled = r.recallKey ? recalls.get(r.recallKey) : undefined;
    if (recalled && r.pool.some((c) => c.id === recalled.id)) {
      prev = recalled.id;
      return recalled;
    }
    const secKey = (id: string) => `${r.section}|${id}`;
    const tiers = [
      (c: Candidate<T>) => (song.get(c.id) ?? 0) < perSong && (bySection.get(secKey(c.id)) ?? 0) < perSection && (!adjacent || c.id !== prev),
      (c: Candidate<T>) => (bySection.get(secKey(c.id)) ?? 0) < perSection && (!adjacent || c.id !== prev),
      (c: Candidate<T>) => !adjacent || c.id !== prev,
      () => true,
    ];
    let pick: Candidate<T> | undefined;
    for (const ok of tiers) {
      const pool = r.pool.filter(ok);
      if (!pool.length) continue;
      pick = pool
        .map((c) => ({ c, score: (c.match ?? 0) - 0.15 * (song.get(c.id) ?? 0), tie: h01(seed, slot, r.line, c.id) }))
        .sort((a, b) => b.score - a.score || b.tie - a.tie)[0]!.c;
      break;
    }
    const c = pick!;
    song.set(c.id, (song.get(c.id) ?? 0) + 1);
    bySection.set(secKey(c.id), (bySection.get(secKey(c.id)) ?? 0) + 1);
    if (r.recallKey) recalls.set(r.recallKey, c);
    prev = c.id;
    return c;
  });
}
