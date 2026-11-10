# Panels: motion language

Style 12 of 15. Phase 2 planning (generated from planning data).

**Philosophy.** Comics move between frames, not inside them: the camera moves panel to panel; inside, only limited animation.

**Lyric entrances.** Panel border draws, art fades in, balloon pops.

**Word progression.** Words fill the balloon.

**Line transitions.** Camera moves to the next panel.

**Lyric exits.** Panel dims; page turns at sections.

**Background movement.** Static art; one looped element.

**Foreground animation.** Speed lines, SFX.

**Object transformations.** Limited loops (rain, steam, flicker).

**Camera.** Panel-to-panel moves across the page (ease in-out 400-600 ms); splash pages get a slow push.

**Parallax.** Within splash pages, line and fill layers offset 1-2%.

**Material animation.** Dot screen fixed to the page (does not swim).

**Scene transitions.** Page turn, splash reveal, gutter wipe.

**Instrumental sections.** Pan across wordless panels.

**End of song.** Last panel, white gutter.

**Timing.** Panel move 400-600 ms; balloon pop 150 ms; page turn 700 ms.

**Easing.** Ease in-out for camera; overshoot for balloon pop (small).

**Intensity tiers.** Calm: wide panels, slow moves. Normal: grid. Energetic: diagonals, shakes, speed lines.

**Motion hierarchy.** Balloon > active panel > page.

**Response to pacing and energy.** Fast lines: camera cuts instead of moving; very fast: two lines per panel.

**Reduced motion.** Reduced motion: camera cuts between panels (no moves), no shakes, no speed-line pulses, balloons appear without pop, page turns are cuts.

## Transition families

| ID | Transition | Purpose | Entry / exit | Timing | Compatible scenes | Layers | Lyric continuity | Reduced motion | Performance |
|---|---|---|---|---|---|---|---|---|---|
| PAN-TRN-PAGE-TURN | Page turn | Section change. | The page curls and turns. / New page. | 700 ms. | all | Page | Between lines. | Cut. | Mesh curl or sprite sequence. |
| PAN-TRN-SPLASH | Splash reveal | Chorus entry. | Panels slide away; one big panel fills the page. / Splash page. | 600 ms. | all | Page | Line start. | Cut. | Free. |
| PAN-TRN-GUTTER-WIPE | Gutter wipe | Register change at the bridge. | A white gutter sweeps across; the new register lies beyond. / New register page. | 800 ms. | all | Page | Gaps. | Cross-fade. | Free. |
| PAN-TRN-ZOOM-INTO-PANEL | Zoom into a panel | Quiet focus. | The camera zooms into one panel until it fills the frame. / Full-frame panel. | 900 ms. | quiet scenes | Camera | Line start. | Cut. | Free. |
| PAN-TRN-LAST-PANEL | Last panel | Outro. | Final panel, then white. / White gutter with closing caption. | 2-3 s. | all | Page | After the last line. | Same (cuts). | Free. |

Shared motion rules (flash limits, determinism, frame-rate independence) are in `phase-2/motion-and-transitions.md`.
