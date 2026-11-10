# Quality assurance plan

Phase 2 planning. How Phase 3 proves each style works. Nothing has been tested in Phase 2 because nothing has been built; `AGENTS.md` forbids claiming that anything works unless it was run.

## 1. Layers of testing

| Layer | What | Tooling (existing or planned) |
|---|---|---|
| Unit | Selection is deterministic; repetition windows hold; invalid combinations are filtered; generators are seed-stable; layout solvers fit test lines | Vitest (existing) |
| Golden frames | Fixed frames per style, scene family and test-matrix row compared with a tolerance | Planned (T1, batch INF-02), run with Playwright and the existing renderers |
| Determinism | Playback frame at `t` equals export frame at `t` (pixel tolerance) for every style | Export path (`lib/export/video.ts`) plus golden runner |
| Flash guard | Synthetic and real worst cases stay under the limits in motion-and-transitions.md | Planned (V5, INF-03) |
| Performance | Frame time percentiles, memory peak and first-use stalls per style | Extended `bench()` (performance-and-caching.md) |
| Readability | Contrast of active text against what is directly behind it, on golden frames | Contrast sampler on golden frames (planned) |
| Review | Owner review of each family and each style; native-reader reviews for special script renderings; cultural review | Manual, recorded in review registers |

## 2. Test matrix

Every style runs every row that applies to it. A row that does not apply (for example right-to-left in a style that routes right-to-left text to a fallback) still runs, to prove the fallback.

| Dimension | Values |
|---|---|
| Viewport | 1280x720 landscape; 720x1280 portrait; 1080x1080 square; 390x844 small phone; plus each export size (1920x1080, 1080x1920, 1080x1350) |
| Line length | 1 word; 3-6 words; 12-16 words; 25+ words |
| Lyric density | Sparse (lines 6+ s apart, long gaps); normal; dense (rap, under 1.5 s per line) |
| Timing | Word-synced (authored); line-synced; estimated words (soft mode); no timing (untimed lyrics) |
| Script | English; Hindi (Devanagari); Tamil; mixed Latin and Devanagari in one line; mixed Latin and Tamil; Arabic (right-to-left); Hebrew (right-to-left); Japanese (CJK, where declared) |
| Structure | Intro with no lyrics; instrumental break over 10 s; repeated hooks; long outro; song with no detected hooks |
| Intensity | Calm, normal, energetic identity; with and without a confident beat grid |
| Accessibility | Reduced motion on; flash guard on (always) |
| Cover | Light, dark, busy, flat, text-only and missing cover (most important for Cover Pop, Folio, Nocturne, Monument) |
| Tier | WebGL2; Canvas 2D (styles that have it); governor stepped down one and two quality steps |

A full cross product is not run. Each style runs: every scene family at 1280x720 and 720x1280 with a normal English line; then each other dimension varied one at a time from that baseline; then 10 fixed "stress songs" that combine dimensions (for example dense Hindi rap with estimated timing on a phone; a sparse Tamil ballad with a missing cover in reduced motion).

## 3. Test songs

Phase 3 assembles a set of test timelines (fixtures, not audio) covering the matrix: synthetic lines in each script, plus real lyric timelines the owner already has locally. Fixtures live in the repo; no copyrighted lyrics are committed beyond what the project already permits.

## 4. Per-style checks

Each style's `design-spec.md` lists its own QA notes and "Done means". The common checks are:

1. Every scene family renders with only its required families present.
2. Every invalid-combination row has a unit test.
3. Active text meets the contrast floor on all golden frames.
4. Reduced-motion golden frames exist and contain no camera travel.
5. Estimated timing never produces per-word reveals.
6. No style depends on beats: golden frames with no beat grid look complete.
7. Diversity check: the method in scene-composition-system.md section 5 on 10 test songs.
8. Performance within the style's targets on the baseline GPU, or a written exception.

## 5. Validation levels

**Asset level** (every produced asset, automated where possible): file opens and decodes; metadata sidecar complete and matching the manifest; dimensions and format as specified; alpha premultiplied and padded; size within budget; renders in each listed scene family; no near-duplicate in its family (perceptual hash distance against siblings, then eye review); responsive crops valid; art-bible check by the reviewer.

**Scene level** (golden frames per scene family): active lyric readable at the test sizes; contrast floor met; typography inside its safe area and never covered; layer order as the grammar says; one focal point; motion coherent in a 5-second capture; colour within the style's budget; no invalid combination present; overall quality judged by the owner.

**Style level** (after B2): recognisable identity in a blind test; distinct compositions across 10 songs (diversity method); compelling across a full song (one full-song capture reviewed end to end); dense and sparse lyrics both work; all aspect ratios; all supported scripts and declared fallbacks; performance within targets; export equals playback; reduced motion and flash guard respected.

**Cross-style** (at M3, M5 and M7): the same 8 lyric passages (a short hook, a long verse line, a dense rap passage, a Hindi line, a Tamil line, a mixed line, an instrumental gap, an ending) rendered in every finished style, shown side by side in a grid at the same frame times. Reviewers check that no two styles read as the same effect; any pair flagged is logged in the risk register (R-10).

## 6. How captures are reviewed

- **Stills**: golden frames at fixed times, viewed at 100% and at phone size; a contact sheet per style for overview, but decisions are made at full size.
- **Motion**: 5-10 second captures (WebM from the export path) around line starts, transitions and section changes; reviewed at full speed, then frame by frame at key moments (AGENTS.md section 8 method).
- **Full songs**: one complete render per style per milestone, watched end to end, with notes on monotony, repetition and the ending.
- **Records**: each review writes its notes and decision into the style's review register with the capture's file name and the commit it was made from.

## 7. Gate reviews

Prototype gates (MON-G1, INK-G1, GLY-G1, PHO-G1, LLS-G1) are decided with evidence: recordings, frame timings and reviewer notes, saved with the decision in `decisions.md`.

## 8. Acceptance of Phase 3 work

A batch is complete when its completion condition in `manifests/production-batches.json` is met, its tests and golden frames pass in CI, and the owner has reviewed it. `docs/feature-tracker.md` gets an entry for each.
