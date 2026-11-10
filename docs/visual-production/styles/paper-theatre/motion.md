# Paper Theatre: motion language

Style 3 of 15. Phase 2 planning (generated from planning data).

**Philosophy.** Rigid pieces on pins and rails, moved by an invisible puppeteer. Nothing stretches; everything has weight and a slight wobble.

**Lyric entrances.** Pieces slide in on rails (horizontal or vertical) with ease-in-out and a 1-2% overshoot settle; cards drop on strings; pop-up pieces rise from the fold.

**Word progression.** Words cut open by light (authored) or whole card.

**Line transitions.** Old card pulled up while the new one drops (overlap 150 ms); pieces may cross.

**Lyric exits.** Rail slide off, pulled up, fold down (pop-up), light fades behind.

**Background movement.** Ground glow breathes slowly (5% over 8 s); far layer drifts 0.2% per second.

**Foreground animation.** Figures on hinges (walk cycles, waves); props swing.

**Object transformations.** Hinge rotations max 25 degrees; rails linear; pins rotate (sun, wheel).

**Camera.** Slow dolly in or out (max 6% over a section), slight lateral track for parallax; pull back to the tiny stage in bridges.

**Parallax.** Layer depth factors 0.2 (far) to 1.0 (near frame); camera track shows layered depth.

**Material animation.** Tissue glows warmer when the light passes behind it; paper flex on stamps.

**Scene transitions.** Curtain, page turn, fly-up, rail swap, light change, iris.

**Instrumental sections.** Set change, light cycle, figure loops.

**End of song.** Light fade and curtain close.

**Timing.** Rail slides 700-1600 ms; card drops 900 ms settle; hinge cycles 0.8-1.6 s; curtain 1.4 s.

**Easing.** Ease-in-out sine on rails with a small critically damped settle; pendulum (damped cosine) for strings; linear for pins.

**Intensity tiers.** Calm: one piece moves at a time, slow rails. Normal: two. Energetic: three plus bobbing on beats.

**Motion hierarchy.** Lyric card > focal figure > entering piece > loops > ground.

**Response to pacing and energy.** Line duration sets how many pieces may enter (one per 2 s of line time at most).

**Reduced motion.** Reduced motion: no swings (cards fade in place), rails replaced by 300 ms fades, no camera track (static), hinge loops off; light changes kept (non-motion).

## Transition families

| ID | Transition | Purpose | Entry / exit | Timing | Compatible scenes | Layers | Lyric continuity | Reduced motion | Performance |
|---|---|---|---|---|---|---|---|---|---|
| PTR-TRN-CURTAIN | Curtain | Intro, outro and big set changes. | Paper curtains draw closed from both sides (1.4 s). / Draw open on the new set. | 2.8 s total; needs a gap of 3 s. | all | Curtain layer above set, below frame | The last line stays on the curtain's front card. | Fade through the curtain colour. | Two curtain masks. |
| PTR-TRN-PAGE-TURN | Pop-up page turn | Set change in the book composition. | Page lifts and turns; pieces fold flat. / New spread opens; pieces rise. | 1.6 s. | C3 book spread | Whole stage | Between lines. | Fade. | Two sets resident. |
| PTR-TRN-FLY-UP | Fly the set | Change sets vertically like a theatre fly loft. | Set rises out of frame. / New set descends. | 1.2 s. | C1, C7 | Set layers; frame stays | Card stays hung in front. | Fade. | Two sets resident. |
| PTR-TRN-RAIL-SWAP | Rail swap | Change mid layer pieces during a verse. | Pieces slide off one side. / New ones slide in from the other. | 1.0 s. | all | Mid layer only | Lyric unaffected. | Fade. | Free. |
| PTR-TRN-LIGHT-CHANGE | Colour-coded light change | Section change without moving pieces. | Ground hue and glow cross-fade. / New light. | 1-2 s. | all | Ground and tissue | Lyric contrast re-checked during the fade. | Same (non-motion). | Free. |
| PTR-TRN-IRIS | Lantern iris | Into and out of the lantern composition. | A circular mask closes to the lantern disc. / Opens. | 900 ms. | C4 | Mask | Between lines. | Fade. | Free. |
| PTR-TRN-PAPER-FALL | Paper fall | Ending a sad section: pieces drop like falling paper. | Pieces detach and fall with rotation (rigid). / Empty stage. | 1.5 s. | all | Mid and near layers | After the line ends. | Fade. | Free. |

Shared motion rules (flash limits, determinism, frame-rate independence) are in `phase-2/motion-and-transitions.md`.
