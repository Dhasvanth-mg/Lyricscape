// Runtime asset manifests (architecture-plan.md 2.4): which planned assets (Phase 2 ids) have actually been produced, how,
// where their implementation lives, and how far each has got through the checks. A planned asset with no runtime entry is not
// produced; a runtime entry is not "accepted" until every check below says so. tests/style-assets.test.ts validates each
// runtime manifest against the planning manifest (ids exist, are live, gates respected) and that every accepted asset is
// reachable from a scene family.

import { z } from 'zod';

export const PRODUCTION = ['not-started', 'in-progress', 'produced', 'rejected', 'replaced', 'blocked'] as const;
export const CHECK = ['pending', 'pass', 'fail', 'n/a'] as const;

export const runtimeAssetSchema = z.object({
  /** the Phase 2 id, unchanged */
  id: z.string().regex(/^[A-Z]{3}-[A-Z]{3}(-[A-Z0-9]+)*(-\d{3})?$/),
  /** how it was made in Phase 3 (may differ from the planned method; differences are recorded in design-deviations.md) */
  method: z.enum(['procedural-code', 'handcrafted-vector', 'authored-data', 'shader', 'hybrid', 'existing-code']),
  /** file and symbol that implements it, e.g. lib/styles/sketch-cards/grounds.ts#desk */
  impl: z.string().min(3),
  version: z.number().int().positive(),
  production: z.enum(PRODUCTION),
  /** reachable from rendering logic (a scene family can select it) */
  integrated: z.boolean(),
  checks: z.object({ technical: z.enum(CHECK), visual: z.enum(CHECK), integration: z.enum(CHECK), performance: z.enum(CHECK), diversity: z.enum(CHECK) }),
  accepted: z.boolean(),
  notes: z.string().optional(),
  /** when an entry replaces or is replaced by another */
  replaces: z.string().optional(),
});
export type RuntimeAsset = z.infer<typeof runtimeAssetSchema>;

export const runtimeManifestSchema = z.object({
  schema: z.literal('lyricscape.runtime-assets/1'),
  style: z.string(),
  assets: z.array(runtimeAssetSchema),
});
export type RuntimeManifest = z.infer<typeof runtimeManifestSchema>;

/** An asset counts as accepted only when every check passed (or does not apply) and it is integrated. */
export function isAcceptable(a: RuntimeAsset): boolean {
  const c = a.checks;
  const ok = (v: (typeof CHECK)[number]) => v === 'pass' || v === 'n/a';
  return a.production === 'produced' && a.integrated && ok(c.technical) && ok(c.visual) && ok(c.integration) && ok(c.performance) && ok(c.diversity);
}

/**
 * Missing-asset fallback: the first id in `chain` that the registry can draw. A frame never waits for, or fails on, an asset;
 * the slot renders the fallback and the miss is counted once so the QA log can name it.
 */
export function resolveFallback(chain: string[], available: (id: string) => boolean, misses?: Set<string>): string | null {
  for (const id of chain) {
    if (available(id)) return id;
    misses?.add(id);
  }
  return null;
}
