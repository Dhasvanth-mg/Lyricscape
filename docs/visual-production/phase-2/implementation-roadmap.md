# Implementation roadmap

Phase 2 planning. This is the plan for Phase 3, which has **not** started and needs the owner's explicit authorisation. Tables are generated from `manifests/production-batches.json` and `manifests/cross-style-dependencies.json`.

## 1. Shape of Phase 3

1. **Shared infrastructure first** (INF items). Golden frames, the flash guard, the soft timing mode and the unified registry must exist before hundreds of assets are produced (Phase 1 J.2).
2. **Prototype spikes early, in parallel** with infrastructure (gates). Monument's spike runs first because it decides the 15th slot.
3. **Styles in order**, each in batches: B1 core (renderable end to end), B2 breadth, B3 completion, BG gated families. A style's B1 starts after the previous style's B1, so pipelines overlap: drawing for one style can run while the next style's core is built.
4. **Migration** of stored picks happens with the registry (INF-01), before old looks are removed.

## 2. Milestones and gates

| Milestone | Contents | Exit condition |
|---|---|---|
| M0 Authorisation | Owner approves Phase 2 and authorises Phase 3 | Written go-ahead |
| M1 Foundations | INF-01 to INF-06, SHR-B1, SHR-B2 | Golden frames, flash guard and soft timing running in CI; registry behind a flag |
| M2 Spikes decided | MON-G1, INK-G1, GLY-G1, PHO-G1, LLS-G1 | Each gate decided and recorded in decisions.md; Monument or Riso Riot confirmed |
| M3 First three styles | Sketch Cards, Cover Pop, Screenlife (B1-B3) | Owner review; diversity check on 10 songs each; old Sketch, Cover Pop and Code screens picks migrated |
| M4 Replacements complete | Glyph Cinema, Konstrukt, Folio, Nocturne, Celluloid | Every look slated for removal (Phase 1 Section D) has a replacement shipped |
| M5 New media | Signage, Paper Theatre, Panels | Owner review |
| M6 Gated styles | Liquid Light Show, Ink, Phosphor, Monument or Riso Riot | Gates passed or fallbacks applied |
| M7 Collection review | All 15 | Cross-style differentiation review; performance on the baseline GPU; QA matrix green |

## 3. Style production order

| Position | Style | Why here |
|---|---|---|
| 1 | Sketch Cards | Mostly existing assets; refining it proves the manifest pipeline, golden frames and the registry on a working style. |
| 2 | Cover Pop | Exists in Canvas; the GPU port and saliency are small and keep a familiar look alive during migration. |
| 3 | Screenlife | Replaces Code screens (most used Turbo look); builds app kits and the camera grammar many styles reuse. |
| 4 | Glyph Cinema | Replaces ASCII eye; builds the character-cell pass shared with Signage. |
| 5 | Konstrukt | Replaces Type as Rhythm and Graphic; low asset cost, mostly configuration; builds the beat choreography system. |
| 6 | Folio | Replaces Broadsheet and Art Book; typographic, builds the layout solver used by Panels and Cover Pop. |
| 7 | Nocturne | Replaces Velvet, Nocturne (direction) and Stillness; small asset set; builds bokeh and weather layers reused by Signage. |
| 8 | Celluloid | Replaces Analog Cinema; builds the film stock and grain profiles. |
| 9 | Signage | Needs the character-cell pass (Glyph Cinema) and weather (Nocturne). |
| 10 | Paper Theatre | Large handcrafted set; needs the parallax layer system. |
| 11 | Panels | Largest illustration family; needs the layout and balloon solvers. |
| 12 | Liquid Light Show | After its fluid spike (LLS-G1). |
| 13 | Ink | After its stroke-reveal spike (INK-G1); owner paints elements. |
| 14 | Phosphor | After its stroke-font gate (PHO-G1). |
| 15 | Monument | Last; only if MON-G1 passes. Otherwise the reserve Riso Riot is specified and produced in this slot. |

## 4. Shared infrastructure

| ID | Item | Objective | Depends on | Done when |
|---|---|---|---|---|
| INF-01 | Unified style registry | One list of 15 styles with GPU tier and Canvas 2D fallback (or GPU only), replacing Clean vs Turbo; stored-pick migration map (decisions.md). | - | Registry merged behind a flag; old picks map to new styles; tests pass. |
| INF-02 | Golden frames (T1) | Visual regression on fixed frames per style and per test-matrix row. | - | Golden frame runner in CI with a tolerance; first goldens for Sketch Cards. |
| INF-03 | Flash guard (V5) | Photosensitivity guard applied to every style's output (luminance change and red flash limits). | - | Guard on by default; test with synthetic strobe input. |
| INF-04 | Estimated-timing soft mode (P4) | Styles receive timing confidence and switch to line-level reveals when words are estimated. | - | All styles read confidence; tests for authored, estimated and none. |
| INF-05 | Scene-family runtime | Shared schema: style > scene families > composition families > assets; deterministic selection and repetition windows (scene-composition-system.md). | INF-01 | Selection is pure and tested for determinism and repetition limits. |
| INF-06 | Asset pipeline and manifest loader | Build step that validates manifests, converts SVG to path data and textures to KTX2, and lazy-loads per style. | - | Pipeline validates the JSON schema and fails on missing assets. |
| INF-07 | Typography infrastructure | Per-style font loading with script coverage, fallback chain and payload budget (V14). | INF-06 | Font loader with budgets; script detection routes runs to faces. |
| INF-08 | Warm-up and prefetch (P5) | Compile shaders and paint sheets ahead of need. | INF-05 | No first-use hitch above 50 ms in the bench. |
| INF-09 | Per-style quality steps (V7) | Governor steps per style (resolution, effects off). | INF-01 | Every style declares its steps; bench shows recovery. |
| INF-10 | Reduced-motion contract | Every style implements its reduced-motion rules from motion.md. | INF-05 | Reduced-motion golden frames for each style. |

## 5. Prototype gates

| Gate | Style | Question | If it fails | When | Applies to |
|---|---|---|---|---|---|
| MON-G1 | Monument | Readable façade text while moving; 60 fps at 1080p on an integrated GPU with a 40-line city; Devanagari and Tamil via sprite stack. | Replace Monument with Riso Riot (owner approves). | First spike, before any Monument asset. | All MON- entries (status deferred). |
| INK-G1 | Ink | Skeleton-based stroke reveal looks intentional on 4 scripts and costs under 6 ms per line. | Keep only the generic reading-direction wipe. | Second spike. | INK-TYP-SRV family (status deferred). |
| GLY-G1 | Glyph Cinema | Calligram routing reads as intended, not noise. | Drop calligram compositions; keep subject passes. | Third spike. | GLY-CMP-C2 Calligram and the scene families that list it; they ship only after the gate (GLY-B1 acceptance). |
| PHO-G1 | Phosphor | Hershey licence verified; outline-trace readability for Devanagari, Tamil and Arabic by native readers. | Declared fallback (underline sweep with Noto Sans glow) for failing scripts. | Fourth spike. | PHO-TYP-SFN family (status deferred). |
| LLS-G1 | Liquid Light Show | Deterministic fluid that does not look like a generic shader. | Use baked flow sequences only. | Fifth spike. | LLS fluid presets (LLS-B1 acceptance includes the gate). |

## 6. Systems built once and reused

| System | Built by | Reused by | Note |
|---|---|---|---|
| Character-cell pass | Glyph Cinema | Signage, Screenlife | Signage cell hardware and Screenlife terminals render through it. |
| Layout solver (roles in a box) | Sketch Cards (existing card solver) | Folio, Cover Pop, Panels | Folio page templates, Cover Pop phrase layouts and Panels balloons extend the same role solver. |
| Balloon solver | Panels | Screenlife | Screenlife chat bubbles can reuse balloon fitting. |
| Camera grammar (cuts, pushes, handheld) | Screenlife | Celluloid, Panels, Signage, Monument | One camera module with per-style limits. |
| Beat choreography steps | Konstrukt | Phosphor, Signage, Sketch Cards | Bar and beat stepping with confidence fallback. |
| Parallax layer system with hinged sprites | Paper Theatre | Nocturne, Panels | Nocturne silhouettes and Panels splash parallax. |
| Weather and air layers | Nocturne | Signage, Ink, Panels | Rain, fog and haze configurations over shared generators. |
| Persistence buffer | Phosphor | Glyph Cinema, Liquid Light Show | Trails for glyph persistence and fluid afterglow. |
| Stroke reveal | Ink (gated) | Sketch Cards, Phosphor | Sketch Cards scribble reveal uses the generic wipe until INK-G1; Phosphor writes along paths with the same timing model. |
| Cover analysis (saliency) | Cover Pop | Folio, Nocturne, Monument | Folio plate crops, Nocturne colour, Monument fog. |
| Film stock and grain profiles | Celluloid | Nocturne, Paper Theatre | Shared grain profiles over SHR film grain. |
| Print processes (riso, photocopy, dither) | Sketch Cards | Panels, Konstrukt, Riso Riot (reserve) | Over shared halftone, dither and overprint generators. |

## 7. Production batches

46 batches. Every live asset is in exactly one batch (checked by `gen.py`). Estimates come from each asset's complexity (S 2 h, M 4 h, L 16 h, XL 40 h) and add up to about **9,180 hours**. That is a planning number to compare batches with each other, not a schedule. Real effort depends on who draws (asset-production-pipeline.md) and will be re-estimated after the first batch.

| Batch | Style | Name | Assets | By kind | Estimate (h) | Depends on | Gate |
|---|---|---|---|---|---|---|---|
| SHR-B1 | Shared | Typeface dependencies | 35 | dependency 35 | 70 | INF-07 |  |
| SHR-B2 | Shared | Shared generators and noise | 22 | generator 16, source 6 | 268 | INF-06 |  |
| SKC-B1 | Sketch Cards | Core | 65 | component 10, composition 18, configuration 12, source 25 | 216 | INF-01, INF-02, INF-05, INF-06, SHR-B1, SHR-B2 |  |
| SKC-B2 | Sketch Cards | Breadth | 135 | configuration 12, generator 14, source 109 | 280 | SKC-B1 |  |
| SKC-B3 | Sketch Cards | Completion | 28 | component 12, configuration 10, source 6 | 56 | SKC-B2 |  |
| CVP-B1 | Cover Pop | Core | 63 | component 6, composition 13, configuration 40, generator 4 | 160 | INF-05, INF-07, SHR-B1, SHR-B2, SKC-B1 |  |
| CVP-B2 | Cover Pop | Breadth | 69 | component 8, configuration 11, generator 5, source 45 | 138 | CVP-B1 |  |
| CVP-B3 | Cover Pop | Completion | 40 | generator 4, source 36 | 88 | CVP-B2 |  |
| SCR-B1 | Screenlife | Core | 148 | component 73, composition 19, configuration 30, source 26 | 704 | INF-05, INF-07, SHR-B1, SHR-B2, CVP-B1 |  |
| SCR-B2 | Screenlife | Breadth | 41 | component 14, configuration 16, source 11 | 104 | SCR-B1 |  |
| SCR-B3 | Screenlife | Completion | 30 | configuration 6, source 24 | 72 | SCR-B2 |  |
| GLY-B1 | Glyph Cinema | Core | 115 | component 7, composition 19, configuration 27, source 62 | 402 | INF-05, INF-07, SHR-B1, SHR-B2, SCR-B1 |  |
| GLY-B2 | Glyph Cinema | Breadth | 44 | component 9, configuration 29, source 6 | 112 | GLY-B1 |  |
| KON-B1 | Konstrukt | Core | 71 | component 37, composition 18, configuration 16 | 178 | INF-05, INF-04, SHR-B1, SHR-B2, GLY-B1 |  |
| KON-B2 | Konstrukt | Breadth | 54 | configuration 54 | 108 | KON-B1 |  |
| KON-B3 | Konstrukt | Completion | 6 | source 6 | 24 | KON-B2 |  |
| FOL-B1 | Folio | Core | 80 | component 36, composition 17, configuration 19, source 8 | 282 | INF-07, SHR-B1, SHR-B2, KON-B1 |  |
| FOL-B2 | Folio | Breadth | 19 | component 6, configuration 13 | 38 | FOL-B1 |  |
| FOL-B3 | Folio | Completion | 28 | component 14, source 14 | 56 | FOL-B2 |  |
| NOC-B1 | Nocturne | Core | 47 | component 7, composition 17, configuration 23 | 128 | INF-05, SHR-B1, SHR-B2, FOL-B1 |  |
| NOC-B2 | Nocturne | Breadth | 31 | configuration 19, source 12 | 62 | NOC-B1 |  |
| NOC-B3 | Nocturne | Completion | 3 | configuration 3 | 6 | NOC-B2 |  |
| CEL-B1 | Celluloid | Core | 52 | component 12, composition 18, configuration 22 | 168 | INF-05, INF-03, SHR-B1, SHR-B2, NOC-B1 |  |
| CEL-B2 | Celluloid | Breadth | 44 | configuration 7, source 37 | 162 | CEL-B1 |  |
| CEL-B3 | Celluloid | Completion | 24 | configuration 6, source 18 | 74 | CEL-B2 |  |
| SIG-B1 | Signage | Core | 40 | composition 18, configuration 6, generator 9, source 7 | 508 | INF-03, INF-07, SHR-B1, SHR-B2, CEL-B1 |  |
| SIG-B2 | Signage | Breadth | 103 | configuration 28, source 75 | 356 | SIG-B1 |  |
| SIG-B3 | Signage | Completion | 14 | component 5, configuration 9 | 28 | SIG-B2 |  |
| PTR-B1 | Paper Theatre | Core | 128 | component 7, composition 20, configuration 21, source 80 | 758 | INF-05, INF-08, SHR-B1, SHR-B2, SIG-B1 |  |
| PTR-B2 | Paper Theatre | Breadth | 54 | configuration 12, source 42 | 192 | PTR-B1 |  |
| PTR-B3 | Paper Theatre | Completion | 59 | source 59 | 216 | PTR-B2 |  |
| PAN-B1 | Panels | Core | 61 | component 12, composition 18, configuration 31 | 336 | INF-07, INF-08, SHR-B1, SHR-B2, PTR-B1 |  |
| PAN-B2 | Panels | Breadth | 201 | component 12, configuration 21, generator 6, source 162 | 750 | PAN-B1 |  |
| PAN-B3 | Panels | Completion | 24 | component 6, configuration 18 | 48 | PAN-B2 |  |
| LLS-B1 | Liquid Light Show | Core | 51 | component 6, composition 15, configuration 20, source 10 | 152 | INF-03, SHR-B1, SHR-B2, PAN-B1 |  |
| LLS-B2 | Liquid Light Show | Breadth | 45 | configuration 45 | 170 | LLS-B1 |  |
| LLS-B3 | Liquid Light Show | Completion | 11 | source 11 | 22 | LLS-B2 |  |
| INK-B1 | Ink | Core | 26 | composition 16, source 10 | 84 | INF-07, SHR-B1, SHR-B2, LLS-B1 |  |
| INK-B2 | Ink | Breadth | 145 | configuration 33, generator 10, source 102 | 474 | INK-B1 |  |
| INK-B3 | Ink | Completion | 10 | configuration 10 | 104 | INK-B2 |  |
| INK-BG | Ink | Gated families | 7 | generator 7 | 280 | INK-B1 | Spike INK-G1: skeleton reveal on 4 scripts must look intentional and run under 6 ms per line; failure keeps only the generic wipe. |
| PHO-B1 | Phosphor | Core | 33 | composition 15, configuration 6, generator 12 | 132 | INF-07, SHR-B1, SHR-B2, INK-B1 |  |
| PHO-B2 | Phosphor | Breadth | 75 | configuration 25, source 50 | 150 | PHO-B1 |  |
| PHO-B3 | Phosphor | Completion | 14 | configuration 6, source 8 | 28 | PHO-B2 |  |
| PHO-BG | Phosphor | Gated families | 9 | configuration 9 | 36 | PHO-B1 | PHO-G1: Hershey licence verification and outline-trace readability (native readers) before approval of each member. |
| MON-BG | Monument | Gated families | 92 | composition 13, configuration 74, generator 5 | 400 | INF-09, SHR-B1, SHR-B2 | MON-G1 prototype spike: readable façade text while moving (phone and 1080p), 60 fps target on an integrated GPU at 1080p with a 40-line city, and a complex-script path (sprite stack) that renders Devanagari and Tamil correctly. If it fails, Monument is replaced by the reserve style Riso Riot (decisions.md). |

Each batch's objective, asset IDs, acceptance criteria and completion condition are in `manifests/production-batches.json`.

## 8. Risks to the schedule

See `risk-register.md`. The largest are illustration volume (Panels, Paper Theatre, Ink, Sketch Cards drawings), the Monument spike, and the soft timing mode that every style depends on.
