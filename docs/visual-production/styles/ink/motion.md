# Ink: motion language

Style 11 of 15. Phase 2 planning (generated from planning data).

**Philosophy.** One stroke at a time, with acceleration and a dry tail; ink keeps moving after the hand stops (spread, bleed).

**Lyric entrances.** Brush reveal.

**Word progression.** Stroke speed follows word duration.

**Line transitions.** The previous line dries to pale wash and fades as the next is brushed.

**Lyric exits.** Dries and fades; sheet change at sections.

**Background movement.** Paper fibre static; wet sheen moves subtly.

**Foreground animation.** None.

**Object transformations.** The element grows on breaks.

**Camera.** Locked; a slow push of 3% over a verse.

**Parallax.** None (flat sheet); water register has depth in the bloom.

**Material animation.** Wet spread 300-1200 ms after landing; granulation.

**Scene transitions.** Wet sheet dissolve, new sheet slide, water drop.

**Instrumental sections.** Growth strokes.

**End of song.** Drying sheen fades.

**Timing.** Stroke 150-900 ms by word duration; spread 300-1200 ms; dry 2-4 s.

**Easing.** Stroke: fast start, slow pool at end (pressure profile).

**Intensity tiers.** Calm: light brush. Normal: medium brush. Energetic: heavy brush and flicks.

**Motion hierarchy.** Active stroke > large word > column > element.

**Response to pacing and energy.** Fast lines: strokes compress to 120 ms; under 250 ms per word: line-level wipe.

**Reduced motion.** Reduced motion: words fade in with no stroke travel, no spread animation (final state shown), no flicks, no camera push; sheet changes are cross-fades.

## Transition families

| ID | Transition | Purpose | Entry / exit | Timing | Compatible scenes | Layers | Lyric continuity | Reduced motion | Performance |
|---|---|---|---|---|---|---|---|---|---|
| INK-TRN-WET-DISSOLVE | Wet sheet dissolve | Section change. | Water washes over the sheet; ink lifts and dissolves. / Clean wet paper. | 1.2-1.8 s. | all paper scenes | Ink layer | Between lines. | Cross-fade 300 ms. | Bloom generator. |
| INK-TRN-SHEET-SLIDE | New sheet | Verse to chorus. | A fresh sheet slides over from the right. / New sheet. | 700 ms. | all paper scenes | Paper | Line start. | Cut. | Free. |
| INK-TRN-DROP | Ink drop | Into the water register. | A drop falls and blooms to fill the frame. / Water register. | 1.5 s. | Water scenes | All | Gaps. | Cross-fade. | Baked bloom sequence. |
| INK-TRN-DRY-OUT | Dry out | Outro. | Wet sheen fades; all ink settles to its dry tone. / Finished sheet. | 3-5 s. | all | Ink | After the last line. | Same (static fade). | Free. |

Shared motion rules (flash limits, determinism, frame-rate independence) are in `phase-2/motion-and-transitions.md`.
