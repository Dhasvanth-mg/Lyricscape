# Lyric styles, Phase 2: production blueprint

Phase 2 of the lyric-styles project: the complete design, asset and implementation plan for the 15 styles chosen in Phase 1 (`docs/lyric-styles-phase1.md`). **Planning only.** No asset was produced, no style was implemented, no production code was changed. Phase 3 needs the owner's explicit authorisation.

**Status: planning deliverables complete, awaiting owner review.** Open items before Phase 3 are listed in [reviews/phase-2-readiness.md](../reviews/phase-2-readiness.md).

## Numbers at a glance

- 15 styles, 164 scene families, 90 composition families, 80 transitions.
- 2,496 live manifest entries (1067 source, 299 component, 92 generator, 749 configuration, 254 composition, 35 dependency). These are kept apart and never summed with variations.
- 106 rejected and 18 merged candidates kept in the review registers.
- 108 entries deferred behind prototype gates (all of Monument, Ink stroke reveal, Phosphor stroke fonts).
- 46 production batches; every live asset is in exactly one.

## Where things are

The brief suggested putting style folders under `phase-2/`. They live one level up, beside `manifests/` and `reviews/`, so that later phases can keep using them without a `phase-2` path.

```
docs/visual-production/
  phase-2/                  shared plan (this folder)
  styles/<slug>/            one folder per style (15) plus _shared/
  manifests/                master index, counts, inventory, batches, dependencies
  reviews/                  review summary, differentiation, readiness
```

### Shared plan (this folder)

| Deliverable | File |
|---|---|
| A. Master creative direction | [creative-direction.md](creative-direction.md) |
| H. Technical architecture | [architecture-plan.md](architecture-plan.md), [performance-and-caching.md](performance-and-caching.md) |
| I. Production standards | [asset-standards.md](asset-standards.md), [asset-production-pipeline.md](asset-production-pipeline.md) |
| Taxonomy, schema, naming | [asset-taxonomy.md](asset-taxonomy.md) |
| F. Scene composition | [scene-composition-system.md](scene-composition-system.md) |
| G. Motion and transitions | [motion-and-transitions.md](motion-and-transitions.md) |
| Typography infrastructure | [typography-system.md](typography-system.md) |
| J. Quality assurance | [quality-assurance.md](quality-assurance.md) |
| K. Roadmap | [implementation-roadmap.md](implementation-roadmap.md) |
| Risks | [risk-register.md](risk-register.md) |
| Decisions and Phase 1 corrections | [decisions.md](decisions.md) |

### Per style (B, C, D, E, F, G)

Each `styles/<slug>/` folder holds `design-spec.md` (identity, colour and materials, musical behaviour, song progression, technical needs, QA, "done means", and answers to the 20 planning questions), `typography.md`, `composition.md`, `motion.md`, `scene-families.md`, `asset-strategy.md`, `asset-manifest.json`, `compatibility.json` and `review-register.md`.

| # | Style | In one line | Live entries | Scene families | Composition families | Phase 1 rank |
|---|---|---|---|---|---|---|
| 1 | [Screenlife](../styles/screenlife/design-spec.md) | The song is typed, deleted and sent across the screens of one person's life. | 219 | 12 | 7 | 1 of 15 (Phase 1 score 8.6) |
| 2 | [Glyph Cinema](../styles/glyph-cinema/design-spec.md) | Pictures made of characters, built from the lyric's own letters. | 159 | 13 | 6 | 9 of 15 (Phase 1 score 7.8) |
| 3 | [Paper Theatre](../styles/paper-theatre/design-spec.md) | Layered cut-paper and silhouette stages lit from behind. | 241 | 13 | 7 | 3 of 15 (Phase 1 score 8.25) |
| 4 | [Konstrukt](../styles/konstrukt/design-spec.md) | A Swiss music poster whose shapes play the rhythm. | 131 | 11 | 7 | 2 of 15 (Phase 1 score 8.35) |
| 5 | [Celluloid](../styles/celluloid/design-spec.md) | Film title-sequence craft: scratched, backlit, step-printed. | 120 | 11 | 7 | 8 of 15 (Phase 1 score 7.85) |
| 6 | [Folio](../styles/folio/design-spec.md) | The lyric as a living magazine and book page. | 127 | 9 | 8 | 10 of 15 (Phase 1 score 7.8) |
| 7 | [Nocturne](../styles/nocturne/design-spec.md) | One light in the dark; intimate type and negative space. | 81 | 11 | 6 | 13 of 15 (Phase 1 score 7.45) |
| 8 | [Liquid Light Show](../styles/liquid-light-show/design-spec.md) | Hand-pushed oil, water and dye on a projector. | 107 | 10 | 5 | 11 of 15 (Phase 1 score 7.75) |
| 9 | [Sketch Cards](../styles/sketch-cards/design-spec.md) | One hand-made card per line, dropped like cue cards. | 228 | 12 | 6 | 4 of 15 (Phase 1 score 8.05) |
| 10 | [Signage](../styles/signage/design-spec.md) | The lyric on public display hardware: flaps, bulbs, neon, dots and LEDs. | 157 | 12 | 6 | 10 of 15 |
| 11 | [Ink](../styles/ink/design-spec.md) | Words written with a wet brush: ink pools, bleeds and blooms in water. | 188 | 11 | 5 | 7 of 15 |
| 12 | [Panels](../styles/panels/design-spec.md) | The song as sequential art: each line a panel, the page building as the song plays. | 286 | 12 | 6 | 5 of 15 |
| 13 | [Phosphor](../styles/phosphor/design-spec.md) | A single beam of light writes the words, then becomes the world. | 131 | 10 | 5 | 12 of 15 |
| 14 | [Cover Pop](../styles/cover-pop/design-spec.md) | The album cover is the stage: full-bleed, undimmed, with hot phrases taken from its colours. | 172 | 8 | 5 | 14 of 15 (song-specific) |
| 15 | [Monument](../styles/monument/design-spec.md) | Words become architecture; the camera walks through the song. | 92 | 9 | 4 | 9 of 15 (gated; reserve Riso Riot) |

### Manifests and reviews (L, M)

- [manifests/master-inventory.md](../manifests/master-inventory.md): the reconciled inventory.
- `manifests/master-asset-index.json`, `asset-counts.json`, `production-batches.json`, `cross-style-dependencies.json`.
- [reviews/asset-review-summary.md](../reviews/asset-review-summary.md), [reviews/visual-differentiation.md](../reviews/visual-differentiation.md), [reviews/phase-2-readiness.md](../reviews/phase-2-readiness.md).

## How these files are made

The style folders, manifests and the data tables in some documents are generated from planning data by a small planning script kept outside the repository (it is tooling, not app code, per AGENTS.md). The script checks: unique IDs and names, no empty required fields, no near-duplicate descriptions inside a family, every family used by a scene family, every live asset in exactly one batch, and that the per-style counts add up to the master total. Edit the planning data and regenerate rather than hand-editing generated files.

## Completion checklist

- [x] Phase 1 reviewed; 15 styles confirmed; contradictions recorded (decisions.md D-02, D-03)
- [x] 15 style specifications with composition families, typography, motion, colour, materials and progression
- [x] Asset taxonomy, schema, naming and standards
- [x] Asset families and individual members for every style (no partial manifests)
- [x] Review of every family; rejected and merged candidates recorded
- [x] Scene composition grammar, selection, repetition and diversity method
- [x] Technical architecture, performance targets, export plan
- [x] Production pipeline and QA plan with test matrix
- [x] Roadmap with infrastructure, gates, style order and batches
- [x] Master inventory reconciled
- [x] Readiness report
- [ ] Owner review and decisions (readiness report section 4)
- [ ] Owner authorisation for Phase 3
