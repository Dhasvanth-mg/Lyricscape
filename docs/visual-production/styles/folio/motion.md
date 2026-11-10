# Folio: motion language

Style 6 of 15. Phase 2 planning (generated from planning data).

**Philosophy.** Editorial restraint: text flows, rules draw, pages turn; nothing bounces.

**Lyric entrances.** Pull quote slides 2% into its slot with fade (300 ms ease-out).

**Word progression.** Ink darkening per authored word.

**Line transitions.** Completed quote shrinks into the body column (500 ms), new quote slides in.

**Lyric exits.** Flow into body; page turn takes everything away.

**Background movement.** Static page; slow camera drift over the spread (0.2% per second).

**Foreground animation.** Rules draw; plates crop and recrop slowly (Ken Burns at 1% per second max on plates).

**Object transformations.** Plates reframe at sections.

**Camera.** Framing moves between slots (800 ms ease-in-out); pull back to the spread at section starts.

**Parallax.** None (paper), except page curl during turns.

**Material animation.** Ink spread on darkening (tiny).

**Scene transitions.** Page turn, spread slide, reflow, section tab.

**Instrumental sections.** Plate spreads, captions, contents.

**End of song.** Colophon, close the publication.

**Timing.** Slides 300 ms, reflow 500 ms, page turn 1.2 s, camera reframing 800 ms.

**Easing.** Ease-out cubic for slides; ease-in-out for camera; page curl physical curve.

**Intensity tiers.** Calm: slides only. Normal: camera moves between slots. Energetic: loud issue motion around the quote (rotations of secondary type, never the quote).

**Motion hierarchy.** Quote > camera > rules > plates.

**Response to pacing and energy.** Fast songs: camera holds and quotes update in place.

**Reduced motion.** Reduced motion: no camera moves (static page view per section), no page curl (cut with 200 ms fade), quotes appear in place.

## Transition families

| ID | Transition | Purpose | Entry / exit | Timing | Compatible scenes | Layers | Lyric continuity | Reduced motion | Performance |
|---|---|---|---|---|---|---|---|---|---|
| FOL-TRN-PAGE-TURN | Page turn | Section change. | Page curls from the outer corner and turns. / Next spread lies flat. | 1.2 s. | all | Page and contents | Between lines; the last quote stays on the turned page. | 200 ms fade. | Curl shader on one page texture. |
| FOL-TRN-SPREAD-SLIDE | Spread slide | Change of publication section (newspaper sections). | Spread slides left. / New spread slides in. | 700 ms. | Newspaper, Programme | Pages | Between lines. | Cut. | Two page textures. |
| FOL-TRN-REFLOW | Column reflow | Within-section layout change (template switch on the same paper). | Body text reflows to new columns. / New template. | 600 ms. | all | Body and slots | Quote stays. | Cut. | Re-layout CPU 8 ms at section start. |
| FOL-TRN-SECTION-TAB | Section tab | Jump to letters page, index or plates. | A tab slides out from the page edge and the page flips to it. / Section page. | 900 ms. | all | Page | Between lines. | Cut. | Free. |
| FOL-TRN-CLOSE | Close the publication | Outro. | Pages close to the back cover with the colophon. / Back cover. | 1.6 s. | all | All | After the last line. | Fade. | Free. |

Shared motion rules (flash limits, determinism, frame-rate independence) are in `phase-2/motion-and-transitions.md`.
