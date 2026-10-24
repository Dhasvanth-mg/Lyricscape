// From "what is stored" to "what is drawn": the pick (auto / a direction / a saved theme), the song's adjustments and the identity
// become one Look. Kept separate from the React hook so it can be tested without a browser.

import type { GenreFamily, SongIdentity } from '../identity/types';
import type { Look } from '../kinetic/look';
import type { StyleId } from '../kinetic/types';
import { chooseDirection, DEFAULT_DIRECTION, type Choice } from './choose';
import { composeLook } from './compose';
import { directionOf, DIRECTIONS } from './directions';
import type { CoverInfo, SavedTheme, SongLook, Tweaks } from './types';

export type Resolved = {
  look: Look;
  direction: StyleId;
  /** auto = followed the song; pinned = the listener chose a direction; saved = one of their own themes; fixed = auto is off */
  basis: 'auto' | 'pinned' | 'saved' | 'fixed';
  savedName?: string;
  /** what Auto would pick right now (shown even when something else is applied, so it can be returned to) */
  choice: Choice;
  notes: string[];
  tweaks: Tweaks;
};

/** Merge two sets of adjustments; `b` wins, nested groups merge. */
export function mergeTweaks(a: Tweaks | undefined, b: Tweaks | undefined): Tweaks {
  const out: Tweaks = { ...(a ?? {}), ...(b ?? {}) };
  out.colors = { ...(a?.colors ?? {}), ...(b?.colors ?? {}) };
  out.motion = { ...(a?.motion ?? {}), ...(b?.motion ?? {}) };
  out.appearance = { ...(a?.appearance ?? {}), ...(b?.appearance ?? {}) };
  for (const k of ['colors', 'motion', 'appearance'] as const) if (Object.keys(out[k] ?? {}).length === 0) delete out[k];
  return out;
}

export function resolveLook(a: {
  identity: SongIdentity | null;
  cover: CoverInfo | null;
  song: SongLook | null;
  saved: SavedTheme[];
  familyDefaults: Partial<Record<GenreFamily, StyleId>>;
  /** the global "pick the look from the song" switch */
  autoTheme: boolean;
  /** used when auto is off */
  fallback: StyleId;
}): Resolved {
  const ctx = { identity: a.identity, cover: a.cover };
  const choice = chooseDirection(ctx, { familyDefaults: a.familyDefaults });
  const song = a.song;
  let direction: StyleId = choice.direction;
  let basis: Resolved['basis'] = 'auto';
  let tweaks = song?.tweaks ?? {};
  let savedName: string | undefined;
  let secondary = choice.secondary;

  const pick = song?.pick;
  if (pick?.kind === 'saved') {
    const theme = a.saved.find((t) => t.id === pick.id);
    if (theme && DIRECTIONS[theme.base]) {
      direction = theme.base;
      basis = 'saved';
      savedName = theme.name;
      tweaks = mergeTweaks(theme.tweaks, song?.tweaks);
      secondary = null;
    }
  } else if (pick?.kind === 'direction' && DIRECTIONS[pick.id]) {
    direction = pick.id;
    basis = 'pinned';
    secondary = null;
  } else if (!a.autoTheme) {
    direction = DIRECTIONS[a.fallback] ? a.fallback : DEFAULT_DIRECTION;
    basis = 'fixed';
    secondary = null;
  }

  const sec = secondary && DIRECTIONS[secondary.id] ? { direction: directionOf(secondary.id), weight: secondary.weight } : null;
  const { look, notes } = composeLook({ direction: directionOf(direction), secondary: sec, identity: a.identity, cover: a.cover, tweaks });
  return { look, direction, basis, savedName, choice, notes, tweaks };
}
