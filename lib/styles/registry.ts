// The fifteen lyric styles chosen in Phase 1 and specified in Phase 2 (docs/visual-production). One list replaces the split
// between Clean styles, art directions and Turbo styles (decision D-04). Each entry says how far its production has got, so
// the app never offers a style as finished when it is not: `stage` is the honest production state, and `scene` names the
// renderer that draws it today (null = not built yet, nothing to show).
//
// The registry is behind the `styles15` flag in the UI store until enough styles are accepted to replace the old pickers
// (implementation-roadmap.md INF-01); the old ids keep working through `migrate.ts`.

import type { TurboStyleId } from '../kinetic/turbo';

export const STYLE15_IDS = [
  'screenlife',
  'glyph-cinema',
  'paper-theatre',
  'konstrukt',
  'celluloid',
  'folio',
  'nocturne',
  'liquid-light-show',
  'sketch-cards',
  'signage',
  'ink',
  'panels',
  'phosphor',
  'cover-pop',
  'monument',
] as const;
export type Style15Id = (typeof STYLE15_IDS)[number];
export const isStyle15 = (v: unknown): v is Style15Id => (STYLE15_IDS as readonly unknown[]).includes(v);

/** Production stages, in order (docs/visual-production/phase-3/production-status.md uses the same words). */
export const STAGES = [
  'not-started',
  'infrastructure-ready',
  'foundation',
  'representative-assets',
  'library-in-production',
  'library-complete',
  'composition',
  'motion',
  'integrated',
  'technically-verified',
  'visually-reviewed',
  'accepted',
] as const;
export type Stage = (typeof STAGES)[number] | 'blocked';

export type StyleDef = {
  id: Style15Id;
  /** three-letter code used by every asset id of the style (SKC-...) */
  code: string;
  name: string;
  /** the one-line identity from the Phase 2 specification */
  tagline: string;
  /** 'gpu+canvas' = has a Canvas 2D rendition too; 'gpu-only' = WebGL2 only (Monument) */
  tier: 'gpu+canvas' | 'gpu-only';
  /** position in the Phase 2 production order (decisions.md D-15) */
  order: number;
  stage: Stage;
  /** which renderer draws this style today; null = not built, so it is not offered */
  scene: TurboStyleId | null;
  /** a prototype gate that must pass before the style or some of its families ship */
  gate?: string;
};

export const STYLES15: Record<Style15Id, StyleDef> = {
  'sketch-cards': { id: 'sketch-cards', code: 'SKC', name: 'Sketch Cards', tagline: 'One hand-made card per line, dropped like cue cards.', tier: 'gpu+canvas', order: 1, stage: 'foundation', scene: 'sketch' },
  'cover-pop': { id: 'cover-pop', code: 'CVP', name: 'Cover Pop', tagline: 'The album cover is the stage: full-bleed, undimmed, with hot phrases taken from its colours.', tier: 'gpu+canvas', order: 2, stage: 'infrastructure-ready', scene: null },
  screenlife: { id: 'screenlife', code: 'SCR', name: 'Screenlife', tagline: "The song is typed, deleted and sent across the screens of one person's life.", tier: 'gpu+canvas', order: 3, stage: 'infrastructure-ready', scene: null },
  'glyph-cinema': { id: 'glyph-cinema', code: 'GLY', name: 'Glyph Cinema', tagline: "Pictures made of characters, built from the lyric's own letters.", tier: 'gpu+canvas', order: 4, stage: 'infrastructure-ready', scene: null, gate: 'GLY-G1' },
  konstrukt: { id: 'konstrukt', code: 'KON', name: 'Konstrukt', tagline: 'A Swiss music poster whose shapes play the rhythm.', tier: 'gpu+canvas', order: 5, stage: 'infrastructure-ready', scene: null },
  folio: { id: 'folio', code: 'FOL', name: 'Folio', tagline: 'The lyric as a living magazine and book page.', tier: 'gpu+canvas', order: 6, stage: 'infrastructure-ready', scene: null },
  nocturne: { id: 'nocturne', code: 'NOC', name: 'Nocturne', tagline: 'One light in the dark; intimate type and negative space.', tier: 'gpu+canvas', order: 7, stage: 'infrastructure-ready', scene: null },
  celluloid: { id: 'celluloid', code: 'CEL', name: 'Celluloid', tagline: 'Film title-sequence craft: scratched, backlit, step-printed.', tier: 'gpu+canvas', order: 8, stage: 'infrastructure-ready', scene: null },
  signage: { id: 'signage', code: 'SIG', name: 'Signage', tagline: 'The lyric on public display hardware: flaps, bulbs, neon, dots and LEDs.', tier: 'gpu+canvas', order: 9, stage: 'infrastructure-ready', scene: null },
  'paper-theatre': { id: 'paper-theatre', code: 'PTR', name: 'Paper Theatre', tagline: 'Layered cut-paper and silhouette stages lit from behind.', tier: 'gpu+canvas', order: 10, stage: 'infrastructure-ready', scene: null },
  panels: { id: 'panels', code: 'PAN', name: 'Panels', tagline: 'The song as sequential art: each line a panel, the page building as the song plays.', tier: 'gpu+canvas', order: 11, stage: 'infrastructure-ready', scene: null },
  'liquid-light-show': { id: 'liquid-light-show', code: 'LLS', name: 'Liquid Light Show', tagline: 'Hand-pushed oil, water and dye on a projector.', tier: 'gpu+canvas', order: 12, stage: 'infrastructure-ready', scene: null, gate: 'LLS-G1' },
  ink: { id: 'ink', code: 'INK', name: 'Ink', tagline: 'Words written with a wet brush: ink pools, bleeds and blooms in water.', tier: 'gpu+canvas', order: 13, stage: 'infrastructure-ready', scene: null, gate: 'INK-G1' },
  phosphor: { id: 'phosphor', code: 'PHO', name: 'Phosphor', tagline: 'A single beam of light writes the words, then becomes the world.', tier: 'gpu+canvas', order: 14, stage: 'infrastructure-ready', scene: null, gate: 'PHO-G1' },
  monument: { id: 'monument', code: 'MON', name: 'Monument', tagline: 'Words become architecture; the camera walks through the song.', tier: 'gpu-only', order: 15, stage: 'blocked', scene: null, gate: 'MON-G1' },
};

/** The styles in production order. */
export const STYLES15_IN_ORDER: StyleDef[] = Object.values(STYLES15).sort((a, b) => a.order - b.order);

/** A style can be offered to people only when it has a renderer. */
export const isOffered = (s: StyleDef) => s.scene !== null && s.stage !== 'blocked';

export const styleByCode = (code: string): StyleDef | undefined => STYLES15_IN_ORDER.find((s) => s.code === code);
