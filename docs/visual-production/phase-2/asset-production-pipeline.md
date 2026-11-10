# Asset production pipeline

Phase 2 planning. How an asset moves from a manifest entry to a reviewed, shipped file in Phase 3. Nothing here is built yet.

## 1. Stages

| Stage | Input | Output | Who | Gate to the next stage |
|---|---|---|---|---|
| 1. Brief | Manifest entry (23 fields), the style's art bible | A short brief per family (not per asset) with 2-3 thumbnail sketches | Producer (owner or commissioned artist) | Owner approves the family direction |
| 2. Make | Brief | Source file in the source archive (SVG, PSD, scan, RAW, code, JSON) | Producer | Self-check against acceptance criteria |
| 3. Build | Source file | Shipped file (path data, KTX2, WOFF2, compiled JSON) plus sidecar JSON | Build script (INF-06) | Schema validation and size budget pass |
| 4. Family review | All members of the family built | Review notes; merges and rejections recorded in the review register | Owner | No near-duplicates; consistent with the art bible |
| 5. In-scene | Approved family | Golden frames for every listed scene family at 1280x720 and 720x1280 | Golden frame runner (INF-02) | Readability and contrast checks; flash guard |
| 6. Ship | Golden frames approved | Asset referenced by the style's runtime manifest | Developer | Batch completion condition met |

## 2. Who makes what

Phase 1 J.4 asked who draws. The plan, by production method (counts in `manifests/asset-counts.json`):

- **Handcrafted vector and raster** (Paper Theatre silhouettes, Panels illustrations, Sketch Cards drawings, Signage signs, Phosphor figures, Cover Pop stickers): the owner, or a commissioned illustrator working from the briefs. This is the largest cost. Panels and Paper Theatre are the heaviest families.
- **Photographed** (Sketch Cards grounds, Signage settings, Ink papers, Celluloid plates): the owner photographs real surfaces and places with no people, brands or legible text.
- **Hybrid** (Ink painted elements): the owner paints with brush and ink, scans at 600 dpi, and the pipeline vectorises the scans into stroke records.
- **Procedural, shader and authored data**: developers, with owner review of the output in golden frames.
- **Dependencies** (fonts): developers verify licences and subset.

Generated imagery from image models is not part of this plan. If the owner chooses to use any generator for drafts, the result must still pass the originality rule (asset-standards.md) and be reworked by hand before review.

## 3. Build tooling (planned, INF-06)

- `assets/` holds shipped files by style; `assets-src/` (or an external archive) holds sources.
- A build script converts SVG to path data, rasters to KTX2, fonts to WOFF2 subsets, and validates every JSON against its schema.
- The manifest JSON in `docs/visual-production/styles/*/asset-manifest.json` is the planning record. Phase 3 adds a runtime manifest per style that lists only produced, approved files with hashes; the build fails if a runtime manifest names a file that is missing or over budget.
- Lazy loading per style: nothing from a style loads until the style is chosen (performance-and-caching.md).

## 4. Batches

Production runs in the batches in `manifests/production-batches.json`. Each batch has an objective, its asset IDs, dependencies (other batches and infrastructure items), acceptance criteria and a completion condition. Batch order follows the style order in `implementation-roadmap.md`. Gated families sit in their own batch and start only after the gate passes.

## 5. Tracking

Phase 3 tracks each asset's status in the runtime manifest (proposed, in progress, produced, reviewed, shipped) and records family reviews in each style's `review-register.md`. `docs/feature-tracker.md` gets an entry per completed batch, as `AGENTS.md` requires.
