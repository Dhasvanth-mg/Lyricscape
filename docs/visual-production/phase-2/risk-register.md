# Risk register

Phase 2 planning. Likelihood and impact are judgements (High, Medium, Low), not measurements.

| ID | Risk | Styles | Likelihood | Impact | Mitigation | Owner of the call |
|---|---|---|---|---|---|---|
| R-01 | Illustration volume is larger than one person can draw in a reasonable time | Panels (162 illustrations), Paper Theatre (181 sources), Ink (82 painted elements), Sketch Cards (80 new drawings), Signage (50 signs) | High | High | Batches let each style ship with its core first; families can grow later; decide early who draws (owner or commissioned) | Owner |
| R-02 | Monument fails its prototype (readability while moving, integrated GPU performance, complex scripts) | Monument | Medium | Medium | MON-G1 runs first; reserve style Riso Riot is ready to specify; Monument entries are all deferred | Owner after the spike |
| R-03 | Timing soft mode (P4) slips, and styles fake word timing on estimated lyrics | All | Medium | High | INF-04 is in M1 and blocks every style's B1 | Developer |
| R-04 | Flash guard (V5) is missing when bright styles ship | Signage, Liquid Light Show, Celluloid, Konstrukt, Phosphor | Medium | High (safety) | INF-03 in M1; styles avoid flashes by design; reviews rejected strobe candidates | Developer |
| R-05 | Without golden frames, hundreds of assets regress silently | All | High without T1 | High | INF-02 before Sketch Cards B1 | Developer |
| R-06 | Ink stroke reveal looks fake or kitsch on Latin and complex scripts | Ink | Medium | Medium | INK-G1; generic wipe fallback keeps the style usable | Owner after the spike |
| R-07 | Cultural costume or stereotype in Ink, Paper Theatre, Panels or Signage | Ink, Paper Theatre, Panels, Signage | Medium | High | Rejected-candidate rules (no temples, dragons, geishas, monks); cultural review per family; native readers for scripts | Owner |
| R-08 | Brand, character or place likeness slips into signs, panels or stickers | Signage, Panels, Screenlife, Cover Pop | Medium | High (legal) | Brand check in acceptance criteria; family reviews; generic text only | Owner |
| R-09 | Narrow styles feel repetitive across many songs | Phosphor, Nocturne, Konstrukt, Liquid Light Show | Medium | Medium | Strict repetition windows; diversity measurement in Phase 3; Nocturne Candle and Screen glow pair under watch | Owner |
| R-10 | Two styles read as the same at a glance | Signage and Phosphor; Sketch Cards and Panels; Nocturne and Celluloid | Low | Medium | Differentiation axes (reviews/visual-differentiation.md); blind recognition test | Owner |
| R-11 | Font payload grows too large with 35 typefaces and several scripts | All | Medium | Medium | Per-style, per-script subsets on demand (V14 budget) | Developer |
| R-12 | Some fonts have licences still to confirm (Hershey vector fonts, Relief SingleLine, GNU Unifont, marked "verify" in the shared manifest) | Phosphor, Signage, Glyph Cinema | Medium | Medium | Licence check in SHR-B1 before use; Phosphor stroke fonts gated (PHO-G1); fallbacks named | Developer |
| R-13 | Determinism breaks in effects that accumulate (persistence, fluid, piles) and export stops matching playback | Phosphor, Liquid Light Show, Sketch Cards, Monument | Medium | Medium | Bounded history windows and line-index computation; determinism tests | Developer |
| R-14 | Integrated GPU cannot hold 60 fps for heavy styles | Monument, Liquid Light Show, Signage, Screenlife | Medium | Medium | Per-style targets and quality steps; governor; Canvas tier | Developer |
| R-15 | Migration loses users' picks or surprises them | All migrated looks | Low | Medium | One-time versioned migration, old keys kept until the registry is default, one-line notice | Developer |
| R-16 | Cover Pop depends on covers: plain or missing covers give weak results | Cover Pop | Medium | Low | Fallback stages; Auto choice avoids Cover Pop for weak covers | Developer |
| R-17 | The planned asset total (2,496 live) is below the brief's target range (3,000-7,500) and the owner may expect more | All | Medium | Low | Explained in decisions.md D-03; families can grow in later batches; no padding | Owner |
| R-18 | Planning estimates (about 9,000 hours by complexity) are unreliable | All | High | Medium | Re-estimate after the first batch of each method; treat as relative only | Owner |
| R-19 | Phase 2 specifications were written without watching the motion references frame by frame (Phase 1 J.5) | All motion specs | Medium | Medium | Phase 3 runs the frame-by-frame study (AGENTS.md section 8) on footage the owner supplies before each style's B1 | Owner |
