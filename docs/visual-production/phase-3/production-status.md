# Production status

As of 2026-11-11. Counts are live manifest entries (approved, revised, deferred); see `reports/asset-coverage.json`.

| # | Style | Stage | Live entries | Produced | Blocked | Not started |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Sketch Cards | In review: renderer built and wired in place of the Turbo sketch scene; frames reviewed in landscape, portrait, five scripts | 228 | 214 | 14 (SKC-PRC-ART, B-01) | 0 |
| 2 | Cover Pop | In review: GPU scene built (`lib/styles/cover-pop/`), drawn when the stage asks for the style; frames reviewed in landscape, portrait, mixed scripts and without a cover | 172 | 172 (45 icons are the existing set, reused) | 0 | 0 |
| 3 | Screenlife | Not started | 219 | 0 | 0 | 219 |
| 4 | Glyph Cinema | Not started | 159 | 0 | 0 | 159 |
| 5 | Konstrukt | Not started | 131 | 0 | 0 | 131 |
| 6 | Folio | Not started | 127 | 0 | 0 | 127 |
| 7 | Nocturne | Not started | 81 | 0 | 0 | 81 |
| 8 | Celluloid | Not started | 120 | 0 | 0 | 120 |
| 9 | Signage | Not started | 157 | 0 | 0 | 157 |
| 10 | Paper Theatre | Not started | 241 | 0 | 0 | 241 |
| 11 | Panels | Not started | 286 | 0 | 0 | 286 |
| 12 | Liquid Light Show | Not started | 107 | 0 | 0 | 107 |
| 13 | Ink | Not started | 188 | 0 | 0 | 188 |
| 14 | Phosphor | Not started | 131 | 0 | 0 | 131 |
| 15 | Monument | Blocked on gate MON-G1 (A-02) | 92 | 0 | 92 | 0 |
| - | Shared | Infrastructure built (registry, migration, sections, planner, slots, timing, flash guard, cache, runtime manifest schema); shared asset entries not yet produced | 57 | 0 | 0 | 57 |
| | **Total** | | **2,496** | **386** | **106** | **2,004** |

"Produced" means the asset exists in code under its Phase 2 id and is drawn by the renderer. It does not mean every check passed:
see `styles/sketch-cards/README.md` for which Sketch Cards families have been looked at in real renders.
