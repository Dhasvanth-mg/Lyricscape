# Asset review summary

Phase 2 planning. Generated from the manifests by `docs.py`.

## What "reviewed" means here

Every entry in the manifests was specified and evaluated in Phase 2: it has all 23 fields, a family-level design language and quality bar, and a member-level description written for that asset. Each family was reviewed as a set: near-duplicates were merged, weak or risky candidates were rejected with a reason, and existing assets were marked as reused or reworked. The generator then checked every family for near-duplicate descriptions, unused families, empty fields and reconciliation.

What did **not** happen: no asset was drawn, photographed, rendered or built. "Approved" means approved for production as specified, not produced. Review against rendered output happens in Phase 3 (asset-production-pipeline.md).

## Results by style

| Style | Live entries | Families | Revised (existing reworked) | Deferred (gated) | Rejected | Merged |
|---|---|---|---|---|---|---|
| Screenlife | 219 | 17 | 0 | 0 | 7 | 2 |
| Glyph Cinema | 159 | 13 | 15 | 0 | 6 | 1 |
| Paper Theatre | 241 | 24 | 0 | 0 | 9 | 0 |
| Konstrukt | 131 | 19 | 0 | 0 | 4 | 1 |
| Celluloid | 120 | 15 | 0 | 0 | 6 | 0 |
| Folio | 127 | 12 | 0 | 0 | 7 | 1 |
| Nocturne | 81 | 11 | 0 | 0 | 6 | 1 |
| Liquid Light Show | 107 | 10 | 0 | 0 | 4 | 0 |
| Sketch Cards | 228 | 17 | 60 | 0 | 9 | 1 |
| Signage | 157 | 13 | 0 | 0 | 9 | 2 |
| Ink | 188 | 18 | 0 | 7 | 9 | 4 |
| Panels | 286 | 23 | 0 | 0 | 9 | 3 |
| Phosphor | 131 | 12 | 0 | 9 | 6 | 1 |
| Cover Pop | 172 | 15 | 26 | 0 | 6 | 1 |
| Monument | 92 | 14 | 0 | 92 | 6 | 0 |
| Shared | 57 | 3 | 6 | 0 | 3 | 0 |

## Why candidates were refused

| Reason group | Candidates |
|---|---|
| other design reasons | 47 |
| likeness (brand, character, real place) | 27 |
| duplicate or variation | 14 |
| cliché or cultural costume | 11 |
| territory of another style | 10 |
| tone or honesty | 7 |
| motion safety or flash | 4 |
| readability | 4 |

Grouping is by keywords in each recorded reason; the reason text itself is in each `review-register.md`.

## Corrections to Phase 1 found during review

- The "346-drawing art library" is 14 seeded generator functions on the PR #5 branch (`ART_FAMILIES`), so it is counted as 14 generator entries with a seed blocklist, not 346 originals (decisions.md D-02).

- The "480 icons" are 45 icons in `lib/kinetic/icons.ts` with 10 rendering treatments; Phase 1 also said 48 icons. Phase 2 counts the 45 icons (D-02).

- Phase 1 per-style estimates counted arrangements and register treatments (Panels about 700, Ink about 500). Phase 2 counts each drawing once (D-03).
