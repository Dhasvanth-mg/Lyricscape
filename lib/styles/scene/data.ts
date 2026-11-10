// The runtime scene data of each style: scene families, composition families, transitions and asset families, copied from the
// Phase 2 planning files by scripts/visual-production/extract-scene-data.mjs. Validated with Zod on first use so a broken
// extraction fails loudly instead of planning from half a file.

import { z } from 'zod';
import type { Style15Id } from '../registry';
import celluloid from '../data/celluloid.json';
import coverPop from '../data/cover-pop.json';
import folio from '../data/folio.json';
import glyphCinema from '../data/glyph-cinema.json';
import ink from '../data/ink.json';
import konstrukt from '../data/konstrukt.json';
import liquidLightShow from '../data/liquid-light-show.json';
import monument from '../data/monument.json';
import nocturne from '../data/nocturne.json';
import panels from '../data/panels.json';
import paperTheatre from '../data/paper-theatre.json';
import phosphor from '../data/phosphor.json';
import screenlife from '../data/screenlife.json';
import signage from '../data/signage.json';
import sketchCards from '../data/sketch-cards.json';

export const SECTION_ROLES = ['intro', 'verse', 'chorus', 'bridge', 'break', 'quiet', 'high', 'outro'] as const;
export type SectionRole = (typeof SECTION_ROLES)[number];

const status = z.enum(['approved', 'revised', 'deferred', 'merged', 'rejected']);

export const sceneFamilySchema = z.object({
  id: z.string().regex(/^[A-Z]{3}-SCN-\d{2}$/),
  name: z.string().min(1),
  status,
  roles: z.array(z.enum(SECTION_ROLES)).min(1),
  signalsText: z.string(),
  signals: z.array(z.string()),
  isDefault: z.boolean(),
  compositions: z.array(z.string()).min(1),
  required: z.array(z.string()),
  optional: z.array(z.string()),
  attributes: z.record(z.string(), z.string()),
});
export type SceneFamily = z.infer<typeof sceneFamilySchema>;

export const compositionSchema = z.object({
  id: z.string().regex(/^[A-Z]{3}-CMP-/),
  name: z.string().min(1),
  status,
  layers: z.array(z.string()),
  safe: z.string(),
  responsive: z.object({ landscape: z.string().optional(), portrait: z.string().optional(), square: z.string().optional(), small: z.string().optional() }),
});
export type CompositionFamily = z.infer<typeof compositionSchema>;

export const transitionSchema = z.object({ id: z.string().regex(/^[A-Z]{3}-TRN-/), name: z.string(), status, durationMs: z.number().nullable(), use: z.string(), reducedMotion: z.string() });
export type TransitionSpec = z.infer<typeof transitionSchema>;

export const sceneDataSchema = z.object({
  schema: z.literal('lyricscape.scene-data/1'),
  style: z.string(),
  slug: z.string(),
  code: z.string().length(3),
  layerOrder: z.array(z.string()),
  limits: z.record(z.string(), z.string()),
  invalid: z.array(z.object({ this: z.string(), never_with: z.string(), because: z.string() })),
  scenes: z.array(sceneFamilySchema).min(1),
  compositions: z.array(compositionSchema).min(1),
  transitions: z.array(transitionSchema),
  families: z.array(z.object({ id: z.string(), name: z.string(), kind: z.string(), members: z.array(z.string()), scenes: z.array(z.string()) })),
});
export type SceneData = z.infer<typeof sceneDataSchema>;

const RAW: Record<Style15Id, unknown> = {
  celluloid,
  'cover-pop': coverPop,
  folio,
  'glyph-cinema': glyphCinema,
  ink,
  konstrukt,
  'liquid-light-show': liquidLightShow,
  monument,
  nocturne,
  panels,
  'paper-theatre': paperTheatre,
  phosphor,
  screenlife,
  signage,
  'sketch-cards': sketchCards,
};

const cache = new Map<Style15Id, SceneData>();
export function sceneData(id: Style15Id): SceneData {
  let d = cache.get(id);
  if (!d) {
    d = sceneDataSchema.parse(RAW[id]);
    cache.set(id, d);
  }
  return d;
}
