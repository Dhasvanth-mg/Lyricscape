// Stored picks that name an old look (a Turbo style, an art direction or a classic style) map to one of the fifteen styles
// (decision D-05, table in docs/visual-production/phase-2/architecture-plan.md section 3). The map is pure data and runs on
// read: nothing stored is rewritten or deleted until the fifteen-style registry is the default, so turning the flag off gives
// every old pick back exactly as it was.
//
// D-05 is an owner decision that has not been confirmed yet; Phase 3 uses the Phase 2 recommendation as the default and records
// that in docs/visual-production/phase-3/design-deviations.md (A-03). Changing a row here is the whole change.

import type { TurboStyleId } from '../kinetic/turbo';
import type { StyleId } from '../kinetic/types';
import type { Style15Id } from './registry';

export const MIGRATION_VERSION = 1;

/** Turbo styles (lib/kinetic/turbo.ts) */
export const FROM_TURBO: Record<TurboStyleId, Style15Id> = {
  terminal: 'screenlife',
  sketch: 'sketch-cards',
  ascii: 'glyph-cinema',
  liquid: 'liquid-light-show',
  acid: 'sketch-cards', // its creatures moved into Sketch Cards' creature break
  nebula: 'nocturne', // "Lyrics app": its rolling column layout moves to Nocturne
};

/** Classic styles and art directions (lib/kinetic/types.ts STYLE_IDS). `custom` is Studio customisation, not a style: null. */
export const FROM_STYLE: Record<StyleId, Style15Id | null> = {
  velvet: 'nocturne',
  nocturne: 'nocturne',
  stillness: 'nocturne',
  broadsheet: 'folio',
  artbook: 'folio',
  ether: 'folio',
  rhythm: 'konstrukt',
  graphic: 'konstrukt',
  disorder: 'konstrukt',
  analog: 'celluloid',
  film: 'celluloid',
  vhs: 'celluloid',
  coverpop: 'cover-pop',
  gloss: 'cover-pop',
  editorial: 'folio',
  minimal: 'nocturne',
  notebook: 'sketch-cards',
  popart: 'panels',
  neon: 'signage',
  aurora: 'liquid-light-show',
  psychedelic: 'liquid-light-show',
  maximalist: 'cover-pop', // Maximalist's burst lives in Cover Pop
  y2k: 'cover-pop', // no successor; the nearest bright style
  vaporwave: 'signage', // synthwave and vaporwave tags
  custom: null,
};

export type StoredPick = { mode?: 'clean' | 'turbo'; turboStyle?: TurboStyleId; style?: StyleId };

/**
 * The fifteen-style pick for an old stored pick. In Turbo the Turbo style decides (it was what the person saw); in Clean the
 * classic style or direction decides. Returns null when the old pick has no style successor (Custom), so the caller keeps its
 * own default instead of inventing one.
 */
export function migratePick(p: StoredPick): Style15Id | null {
  if (p.mode === 'turbo' && p.turboStyle && p.turboStyle in FROM_TURBO) return FROM_TURBO[p.turboStyle];
  if (p.style && p.style in FROM_STYLE) return FROM_STYLE[p.style];
  if (p.turboStyle && p.turboStyle in FROM_TURBO) return FROM_TURBO[p.turboStyle];
  return null;
}

/** Any single old id (a per-song look, a saved theme's style, a URL parameter) to its successor. Unknown ids give null. */
export function migrateId(id: string): Style15Id | null {
  if (id in FROM_TURBO) return FROM_TURBO[id as TurboStyleId];
  if (id in FROM_STYLE) return FROM_STYLE[id as StyleId];
  return null;
}
