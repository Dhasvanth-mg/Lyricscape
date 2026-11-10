# Decisions

Phase 2 planning. Decisions taken while writing the plan, including corrections to Phase 1 (`docs/lyric-styles-phase1.md`). Each decision says what was decided, why, and what Phase 3 must do. The owner can overturn any of them; decisions marked **owner** need the owner's confirmation before Phase 3 acts on them.

## D-01 The 15 styles stand; Monument is gated (owner)

**Decision.** Phase 2 specifies the 15 styles Phase 1 chose. Monument is fully specified but every entry is `deferred` behind the prototype gate MON-G1 (readable façades while moving, 60 fps at 1080p on an integrated GPU with a 40-line city, and Devanagari and Tamil through sprite stacks). If MON-G1 fails, **Riso Riot** (Acid grain redesigned as a print-animation style, Phase 1 Section H) replaces it and gets its own full specification at that point.
**Why.** Phase 1 ranked Monument as the riskiest pick and asked for a prototype first (J.3).
**Phase 3.** Run MON-G1 first. The reserve is recorded as `MON-CMP-RIS-001` in the Monument manifest so it is visible in the plan.

## D-02 Existing asset counts corrected

**Decision.** Phase 1's counts of existing assets are corrected:

| Phase 1 said | Actually (checked in code) | Counted in Phase 2 as |
|---|---|---|
| "346-drawing art library" in 14 families | 14 seeded generator functions on the PR #5 branch (`ART_FAMILIES` counts are seed ranges) | 14 generator entries (`SKC-PRC-ART`), with a seed blocklist to remove weak outputs |
| 480 icons (48 x 10 treatments) | 45 icons in `lib/kinetic/icons.ts`; the 10 treatments are rendering variations | 45 icons (`CVP-OBJ-ICN`) |
| 18 ASCII subjects | 18 subjects in the ASCII engine | 15 reworked into Glyph Cinema subjects; vortex and sungrid rejected (abstract, not pictures); equalizer merged into Speaker cone |
| 24 doodle kinds, 12 borders, font sets, pill and big kinds | As stated (Sketch cards scene) | Kept as existing reuse or rework in Sketch Cards |

**Why.** The brief forbids counting variations as assets, and generator seeds are variations.

## D-03 Counting rules, and a total below the target range (owner)

**Decision.** An asset is a designed thing someone must make, tune or select on purpose (asset-taxonomy.md). Recolours, mirrors, crops, scales, animation frames, lit and unlit states, register treatments and generator seeds are not counted. Kinds (source, component, generator, configuration, composition, dependency) are reported separately.
**Result.** 2,496 live entries, against the brief's planning target of roughly 3,000-7,500 and Phase 1's estimate of 3,700-4,500. Several styles are below 200.
**Why.** Phase 1's estimates counted arrangements and treatments (Panels about 700 counted each drawing in several registers; Ink about 500 counted elements per paper and ink; Sketch Cards counted 346 seeds). The brief calls the range a target, not a quota, and forbids padding. Each style's `asset-strategy.md` explains its scale.
**Phase 3.** The heaviest families (Panels illustrations, Paper Theatre pieces, Ink elements, Sketch Cards drawings, Signage signs) can grow in later batches without changing any system. If the owner wants a larger library, those families are where to add.

## D-04 One style registry

**Decision.** Replace "Clean styles vs Turbo styles" with one registry of 15 styles. Each declares a GPU tier and a Canvas 2D rendition, or GPU only (Monument). Clean's readability tests become per-style tests on both tiers (architecture-plan.md 2.1).

## D-05 Migration of stored picks (owner)

**Decision.** A one-time, versioned migration maps every old look id (Turbo styles, art directions, classic styles) to its new style, following Phase 1 Section D (table in architecture-plan.md section 3). Old keys stay until the new registry is the default; a one-line notice appears the first time a migrated pick is used. Turbo `nebula` (labelled "Lyrics app") maps to Nocturne; classic Y2K, which has no successor, maps to Cover Pop.

## D-06 Auto choice of style and the director

**Decision.** Auto picks one of the 15 per song from identity, genre tags and cover analysis, shows its reasons, and keeps a manual pick sticky. Inside a song, the director changes scene families within the chosen style. Cutting between styles in one song survives only as an opt-in "mix" mode.

## D-07 Floating lyrics, overlay and wallpaper

**Decision.** These keep their own small looks and inherit the chosen style's type pairing and colour family through a simplified 2D rendition. No surface runs a full style.

## D-08 One scene-family schema

**Decision.** Every style uses the shared model: style, scene families, composition families, slots filled by assets, transitions (scene-composition-system.md). Selection is pure and deterministic; repetition windows and invalid-combination tables are hard rules.

## D-09 Asset formats and where assets live

**Decision.** Shipped formats are path data (from SVG), KTX2 textures with PNG fallback, WOFF2 font subsets and validated JSON. Sources live outside the shipped bundle (a source folder or archive the owner controls). Planning manifests stay in `docs/visual-production/`; Phase 3 adds runtime manifests with hashes and sizes (asset-standards.md, asset-production-pipeline.md).

## D-10 Typefaces

**Decision.** 35 typefaces are shared dependencies: the bundled faces plus new ones for scripts and voices (Noto Serif Devanagari and Tamil, Noto Sans Arabic and Hebrew, Noto Naskh Arabic, Frank Ruhl Libre, Caveat, Kalam, Kavivanar, Comic Neue, Newsreader, Shrikhand, Relief SingleLine, Hershey vector fonts, VT323, Bedstead, GNU Unifont, Silkscreen). Faces whose licence is not yet confirmed are marked "verify" and checked in batch SHR-B1. Monoton, a Comic Sans lookalike and Lobster were rejected.

## D-11 Screenlife's code editor is not the default

**Decision.** The *Code editor* scene family is used only when the lyric is about code or the user picks it, and is explicitly not the default for electronic music. Screenlife's default worlds are messages, notes, search, documents, posts and voice memos.
**Why.** Phase 1 found that Code screens read as developer-only; Screenlife widens it to everyday screens.

## D-12 No characters in Panels; registers are treatments

**Decision.** Panels uses places, objects, hands, silhouettes and weather, never recurring characters or faces. Each illustration is drawn once as line, fill and shadow layers; the five art registers are treatments of the same drawing and are not counted separately.
**Why.** Characters bring likeness risk and multiply cost; registers as treatments keep variety high without multiplying drawings.

## D-13 Cover Pop never modifies the artwork

**Decision.** Cover Pop crops and scales the cover but never blurs, dims, recolours, mirrors or rotates it. Missing, tiny or text-only covers get a generated fallback stage instead. Mirror-tile and blurred-backdrop scene ideas were rejected.
**Why.** The artwork rule in the app (unmodified artwork) and the style's purpose.

## D-14 Prototype gates and their fallbacks

**Decision.** Five gates, in this order: MON-G1 (Monument), INK-G1 (Ink stroke reveal), GLY-G1 (Glyph Cinema calligram), PHO-G1 (Phosphor stroke fonts and outline trace), LLS-G1 (Liquid Light Show fluid). Each has a declared fallback (implementation-roadmap.md section 5). Gated entries are `deferred` and sit in gated batches.

## D-15 Production order

**Decision.** Sketch Cards first (mostly existing assets; proves the pipeline), then Cover Pop, Screenlife, Glyph Cinema, Konstrukt, Folio, Nocturne, Celluloid, Signage, Paper Theatre, Panels, Liquid Light Show, Ink, Phosphor, Monument (or Riso Riot). Styles that replace existing looks come first so old looks can be retired; gated styles come last. Reasons per style are in implementation-roadmap.md.

## D-16 No generated imagery as finished art

**Decision.** Finished art is drawn, painted, photographed or produced by reviewed generators in the codebase. Images from image models are not used as finished assets; if used for drafts, the result is reworked by hand and must pass the originality rule.
**Why.** Originality and rights (asset-standards.md).

## D-17 Nocturne's Candle and Screen glow kept under watch

**Decision.** The only scene-family pair under the structural threshold (2 of 6 attributes differ) is kept because different song signals choose them and the light source changes the frame. Phase 3 merges them if their rendered diversity score is under 0.25 (reviews/visual-differentiation.md).

## D-18 Planning numbers are targets

**Decision.** Performance, memory and size numbers in Phase 2 are targets, and effort hours are relative planning estimates from complexity. None are measurements. Phase 3 measures and re-estimates after the first batch of each production method.
