# Konstrukt: motion language

Style 4 of 15. Phase 2 planning (generated from planning data).

**Philosophy.** Snap and settle. Forms move in quantised steps on the grid, with crisp ease-out; no floating.

**Lyric entrances.** Forms enter by growing from a module edge (bars extend, circles scale from 0 on their centre) in one step.

**Word progression.** Type weight steps per word; forms step per beat or subdivision.

**Line transitions.** Old line slides one module up and lightens; new line sets in its place in one step.

**Lyric exits.** Forms retract along their axis; type leaves at reflow.

**Background movement.** Static paper; grid lines static.

**Foreground animation.** Shape choreographies.

**Object transformations.** Rotation in 15-degree steps; scale in module steps; translation in module steps.

**Camera.** None (a poster does not have a camera); reflows act as cuts.

**Parallax.** None.

**Material animation.** Misregistration jitters by 1 px on downbeats (subtle).

**Scene transitions.** Grid reflow, module wipe, colour field swap, remove modules.

**Instrumental sections.** Metronome patterns.

**End of song.** Module removal.

**Timing.** Steps last 90-160 ms (ease-out quart); between steps, stillness.

**Easing.** Ease-out quart for steps; linear for rule draws.

**Intensity tiers.** Calm: steps on lines only. Normal: beats or subdivisions. Energetic: beats with downbeat hits and more forms.

**Motion hierarchy.** Type step > dominant form > secondary forms.

**Response to pacing and energy.** Step rate never exceeds 4 per second for any single form.

**Reduced motion.** Reduced motion: steps become instant state changes at a quarter of the rate (on bars or lines only); no rotations; reflows become cuts.

## Transition families

| ID | Transition | Purpose | Entry / exit | Timing | Compatible scenes | Layers | Lyric continuity | Reduced motion | Performance |
|---|---|---|---|---|---|---|---|---|---|
| KON-TRN-REFLOW | Grid reflow | Section change: the layout re-composes. | Type and forms move along module paths to new positions (each element one step, staggered by 40 ms). / New layout. | 500 ms on the section boundary (snapped to downbeat when present). | all | All | Current line moves with the layout and stays readable. | Cut. | Free. |
| KON-TRN-MODULE-WIPE | Module wipe | Colour system change. | Modules flip to the new ink in a grid order (row by row). / New colours. | 400 ms. | all | Paper and inks | Type re-inked in the same pass. | Cut. | Free. |
| KON-TRN-FIELD-SWAP | Colour field swap | Split-field layouts swap their two fields. | The divider steps across the frame. / Fields swapped. | 300 ms. | C4 | Fields | Type knocks out correctly during the swap. | Cut. | Free. |
| KON-TRN-REMOVE | Remove modules | Outro and quiet sections. | Active modules switch off one per step. / Grid only. | One per beat or 250 ms. | all | Forms | Last line stays. | Fade. | Free. |
| KON-TRN-GRID-DRAW | Grid draw | Intro. | Rules extend module by module. / Full grid. | 1.2 s or the intro length. | all | Grid | Before the first line. | Grid appears. | Free. |

Shared motion rules (flash limits, determinism, frame-rate independence) are in `phase-2/motion-and-transitions.md`.
