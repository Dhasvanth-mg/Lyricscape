# Implementation log

## 2026-11-10: shared infrastructure (committed locally)

- Scene data extracted from the Phase 2 compatibility files into `lib/styles/data/*.json` by `scripts/visual-production/extract-scene-data.mjs` (15 styles).
- `lib/styles/registry.ts` (the 15, their production order and stage), `migrate.ts` (stored-pick migration, A-03), `scene/` (sections, song signals, the scene planner, slot filling), `timing.ts` (authored / estimated / line-only reveal), `flash.ts` (flash and exposure guard, reduced motion), `assets/cache.ts` (byte-budget LRU with pinned groups), `assets/runtime.ts` (runtime asset manifest schema and fallback chains).
- 28 tests in `tests/styles-infra.test.ts`, including a check that the registry and scene data never drift from the manifests.
- Fonts added (all OFL 1.1, licences read): Caveat, Kalam, Kavivanar, Noto Sans Arabic, Noto Sans Hebrew.

## 2026-11-10 to 11: Sketch Cards

- Hand pen (`lib/styles/sketch-cards/pen.ts`): seeded wobble, overshoot and offset fills; every drawing is code in a 100-unit box.
- Drawings: 24 doodles, 40 dark, 40 everyday, 5 hands, 6 tools. Reviewed on contact sheets; 3 dark, 3 everyday, all hands and the paper clip were redrawn after review.
- Grounds (11), card types (14), borders (12), print processes (7), colour sets with contrast floors, script-aware lettering with the manifest's 12 type pairings, 5 pill and 5 big-word treatments.
- Song plan (`plan.ts`): the shared planner with Sketch Cards' rules (dark register only for dark songs, never with cute scenes), then per line a card type, paper, process (material rules kept), border, drawing (lexicon match, max twice per song, hooks recalled), hand and placement. Pure function of the timeline.
- Renderer (`scene.ts`), wired as the Turbo `sketch` scene: six compositions (surface, held with hands, pile, pinned wall, full-bleed poster, sticky-note cluster), transitions (sweep, flip, pull back, hand swap, hard ground cut), tools at the frame edges, doodle creatures dancing in breaks (ten choreographies on the beat), a title card in intros and breaks, word-by-word lettering from authored times or a reading-order sweep for estimated ones, fades for right-to-left words and for reduced motion.
- 8 tests in `tests/sketch-cards.test.ts`.
- The old sketch scene (`lib/kinetic/gl/scenes/sketch.ts`) is kept, unused, until Phase 3 is accepted.

## 2026-11-11: Cover Pop

- The renderer can now draw a Phase 3 style by id (`RendererOptions.style15`, `STYLE15_SCENES`), and a scene gets the cover (texture, 48x48 sample, canvas, natural size) through the scene host.
- `lib/styles/cover-pop/`: cover reading (emptiness, edges, colour variance, busy-ness, brightest point, colours) and word colours that must reach 4.5:1 against every cell behind the word (white with an outline otherwise); 12 crop paths that keep the cover covering the frame; 9 voices; phrase splitting (authored lines split at pauses, at most four words; estimated lines never split by time); 14 layouts; 6 chips; 36 annotation stickers with die-cut borders; 8 bursts on downbeats; 4 cut-out stickers from the cover (covers of 600 px and up); 5 no-cover stages; 7 phrase motions; the framed ending.
- Song plan: the shared planner with Cover Pop's rules (no-cover stage only without a usable cover; framed ending only for outros), crop paths never repeated, no identical layout on consecutive phrases, a sticker at most once a section and never a playful one with a grief identity.
- New font: Shrikhand (OFL 1.1, licence read). 11 tests in `tests/cover-pop.test.ts`.
