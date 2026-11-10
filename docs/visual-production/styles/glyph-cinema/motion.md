# Glyph Cinema: motion language

Style 2 of 15. Phase 2 planning (generated from planning data).

**Philosophy.** Characters change; they never slide. Time is shown by cells developing, decaying and being typed.

**Lyric entrances.** Band row clears to band colour (one row per 33 ms), cursor appears, text types.

**Word progression.** One grapheme per cell at the line's cadence; block cursor.

**Line transitions.** Decay front: old band text turns to spaces from left to right over 200 ms while the new line starts typing behind it.

**Lyric exits.** Decay, or migration into the picture for hooks.

**Background movement.** The subject's motion channel: rain cells cycle downward in place (brightness bands moving), waves roll, road lines advance, flames flicker within flash limits.

**Foreground animation.** Calligram migration letters; persistence trails.

**Object transformations.** Subject parts animate via their motion mask only.

**Camera.** Grid-snapped zoom (cell size changes in discrete steps of one ramp level, 4 steps over 1 s) and pans in whole cells. No continuous zoom.

**Parallax.** None (flat medium by design).

**Material animation.** Phosphor persistence; paper ink spread on typewriter strikes (80 ms bloom).

**Scene transitions.** Noise-front dissolve, page update, carriage return, register flip, decay to blank.

**Instrumental sections.** Subject loops; detail zoom after 12 s.

**End of song.** Full decay to spaces, last line alone.

**Timing.** Cell updates quantised to 30 fps steps (an honest medium cadence) even when rendering at 60 or 120 fps; dissolves 600-1200 ms.

**Easing.** None in the medium itself (cells are discrete); development fronts use a smoothstep on the noise threshold.

**Intensity tiers.** Calm: coarse grid, development only. Normal: loops and migrations. Energetic: finer grid, density pulse on beats.

**Motion hierarchy.** Band typing > migration > subject loop > persistence.

**Response to pacing and energy.** Slow songs develop slowly (intro development length scales with the first gap).

**Reduced motion.** Reduced motion: no migration (hooks invert in place), no density pulse, subject loops at 30% speed, dissolves become 300 ms cross-fades of the whole grid.

## Transition families

| ID | Transition | Purpose | Entry / exit | Timing | Compatible scenes | Layers | Lyric continuity | Reduced motion | Performance |
|---|---|---|---|---|---|---|---|---|---|
| GLY-TRN-NOISE-FRONT | Noise-front dissolve | Change subject at a section boundary. | A noise threshold sweeps the grid; cells past it switch to the new subject. / Old subject gone when the front passes. | 800 ms; starts at the boundary. | all ASCII and 1-bit scenes | Picture cells only; band untouched | Band keeps the current line readable. | 300 ms cross-fade. | One extra subject map resident. |
| GLY-TRN-PAGE-UPDATE | Teletext page update | Change page or subject in the teletext register. | Rows rewrite top to bottom, 24 rows at 25 ms each. / Header page number increments. | 600 ms. | teletext scenes | Whole page | Band row rewritten last. | Instant swap. | Free. |
| GLY-TRN-CARRIAGE-RETURN | Carriage return | Line change in the typewriter register. | Paper advances one line (whole-row step), carriage slides back (implied by the typing start position). / Old line moves up one row. | 180 ms. | typewriter scenes | Paper and text | Old lines remain visible above (the sheet is the song so far). | Instant. | Free. |
| GLY-TRN-REGISTER-FLIP | Register flip | Chorus entry: the medium itself changes. | Cells re-render in the new register row by row (top to bottom) using the same subject. / New register. | 500 ms, on the chorus boundary. | any two registers | Whole grid and palette | Band re-typed instantly in the new register. | Cut. | Both register pipelines are the same pass with different parameters. |
| GLY-TRN-DECAY-BLANK | Decay to blank | Outro and long breaks. | Cells thin to lower ramp levels then spaces, brightest last. / Empty grid. | 2-4 s. | all | Picture then band | Last line decays last. | 2 s fade. | Free. |
| GLY-TRN-ZOOM-STEP | Zoom step | Detail change within a subject (chorus or break). | Cell size steps 4 times over 1 s toward the target detail. / Settles on the detail. | 1 s. | all | Picture sampling | Band unaffected (its cell size stays constant). | Cut to the detail. | Subject maps need 2x resolution for detail crops. |
| GLY-TRN-DEVELOP | Develop from noise | Intro and first appearance of a subject. | Cells appear in order of brightness, brightest first, with noise. / Full picture. | Intro length up to 6 s; 2 s otherwise. | all | Picture | No band until the first line. | Fade in. | Free. |

Shared motion rules (flash limits, determinism, frame-rate independence) are in `phase-2/motion-and-transitions.md`.
