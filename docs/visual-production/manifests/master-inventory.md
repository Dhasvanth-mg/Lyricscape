# Master asset inventory

Phase 2 planning. Generated from the manifests by `docs.py`; every number here reconciles with `manifests/asset-counts.json` and `manifests/master-asset-index.json`.

**Live entries: 2496** (approved 2281, revised 107, deferred 108). Review outcomes kept in the manifests: rejected 106, merged 18. Total manifest entries 2620.

Reconciliation: the per-style live counts below add up to 2496, the master total is 2496 (match). Shared entries 57, style-exclusive 2439.

## Per style, by kind

Kinds are kept apart: sources are designed by hand, components are reusable parts, generators draw families of outputs, configurations are tuned presets, compositions are scene and layout rules. Recolours, mirrors, crops, animation frames and generator seed variations are never counted.

| # | Style | Code | Phase 1 estimate (originals) | Live | Source | Component | Generator | Configuration | Composition | Deferred (in live) | Rejected | Merged |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Screenlife | SCR | 250-350 | 219 | 61 | 87 | 0 | 52 | 19 | 0 | 7 | 2 |
| 2 | Glyph Cinema | GLY | 150-200 | 159 | 68 | 16 | 0 | 56 | 19 | 0 | 6 | 1 |
| 3 | Paper Theatre | PTR | 500-700 | 241 | 181 | 7 | 0 | 33 | 20 | 0 | 9 | 0 |
| 4 | Konstrukt | KON | ~150 | 131 | 6 | 37 | 0 | 70 | 18 | 0 | 4 | 1 |
| 5 | Celluloid | CEL | ~250 | 120 | 55 | 12 | 0 | 35 | 18 | 0 | 6 | 0 |
| 6 | Folio | FOL | ~220 | 127 | 22 | 56 | 0 | 32 | 17 | 0 | 7 | 1 |
| 7 | Nocturne | NOC | ~120 | 81 | 12 | 7 | 0 | 45 | 17 | 0 | 6 | 1 |
| 8 | Liquid Light Show | LLS | ~140 | 107 | 21 | 6 | 0 | 65 | 15 | 0 | 4 | 0 |
| 9 | Sketch Cards | SKC | ~550 (~350 existing) | 228 | 140 | 22 | 14 | 34 | 18 | 0 | 9 | 1 |
| 10 | Signage | SIG | ~180 | 157 | 82 | 5 | 9 | 43 | 18 | 0 | 9 | 2 |
| 11 | Ink | INK | ~500 | 188 | 112 | 0 | 17 | 43 | 16 | 7 | 9 | 4 |
| 12 | Panels | PAN | ~700 | 286 | 162 | 30 | 6 | 70 | 18 | 0 | 9 | 3 |
| 13 | Phosphor | PHO | ~230 | 131 | 58 | 0 | 12 | 46 | 15 | 9 | 6 | 1 |
| 14 | Cover Pop | CVP | ~60 new | 172 | 81 | 14 | 13 | 51 | 13 | 0 | 6 | 1 |
| 15 | Monument | MON | ~100 | 92 | 0 | 0 | 5 | 74 | 13 | 92 | 6 | 0 |
| - | Shared library | SHR | - | 57 | 6 | 0 | 16 | 0 | 0 | 0 | 3 | 0 |

Shared library: 35 typeface dependencies, 16 shared generators and 6 noise textures, counted once.

## Totals by kind

| Kind | Live | Meaning |
|---|---|---|
| source | 1067 | Original source asset: a designed drawing, plate, texture, lettering set or kit made by hand or authored by a person |
| component | 299 | Reusable design component: a part that many scenes assemble (a widget, a balloon, a frame, a rule set) |
| generator | 92 | Procedural generator: code or shader that draws a family of outputs from parameters |
| configuration | 749 | Generator configuration or preset: an approved, tuned parameter set for a generator, choreography, camera or grade |
| composition | 254 | Composition or scene family: a rule set that arranges assets into a scene (not a rendered image) |
| dependency | 35 | Licensed dependency: an open-licence typeface or data set that is selected and verified, not produced |

## Totals by origin

| Origin | Live |
|---|---|
| existing-reuse | 99 |
| existing-rework | 92 |
| new | 2305 |

## Totals by production method

| Method | Live |
|---|---|
| authored-data | 1107 |
| handcrafted-vector | 718 |
| procedural-code | 240 |
| hybrid | 140 |
| photographed | 102 |
| shader | 84 |
| handcrafted-raster | 70 |
| licensed-font | 35 |

## Against the planning target

The brief's planning target was roughly 200-500 meaningful assets per style (3,000-7,500 in total), explicitly a target and not a quota, with padding forbidden. Phase 1 estimated 3,700-4,500 originals. The live total is 2496: **below the target range**. The shortfall is deliberate and explained in `decisions.md` (D-03): Phase 1 counted arrangements, recolours, register treatments and generator seed variations (for example the 346-drawing art library is 14 seeded generators, and the 480 icons are 45 icons times 10 treatments). Phase 2 counts each designed thing once. Styles below 200 live entries are below because their medium is narrow by design (Nocturne, Phosphor, Monument, Liquid Light Show, Konstrukt, Folio, Celluloid, Glyph Cinema, Signage, Ink, Cover Pop); each style's `asset-strategy.md` says why. The heaviest families (Panels illustrations, Paper Theatre pieces, Ink elements) can grow in later batches without changing any system.

## Where the detail is

- Per-asset manifests: `styles/<slug>/asset-manifest.json` (all 23 fields per entry, plus origin, gate and variation notes).
- Review registers (approved, revised, deferred, merged, rejected): `styles/<slug>/review-register.md`.
- Master index (one row per entry): `manifests/master-asset-index.json`.
- Counts by family: `manifests/asset-counts.json`.
- Production batches: `manifests/production-batches.json`.
- Cross-style dependencies: `manifests/cross-style-dependencies.json`.
