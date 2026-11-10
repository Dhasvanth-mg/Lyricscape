# Sketch Cards: motion language

Style 9 of 15. Phase 2 planning (generated from planning data).

**Philosophy.** Hard cuts and card drops: a new card lands on top, the old one slides under.

**Lyric entrances.** Card drops from above with a small rotation (3-8 degrees) and a settle; or a hard cut.

**Word progression.** Scribble reveal per word.

**Line transitions.** Drop on top; old card nudged.

**Lyric exits.** Buried in the pile.

**Background movement.** Static ground; light shifts rarely.

**Foreground animation.** Tape flaps, pins.

**Object transformations.** Creatures dance (Acid choreography).

**Camera.** Mostly locked; slow pull-back over a section to show the pile; held-card scenes sway.

**Parallax.** Pile layers 1-3% offset with camera.

**Material animation.** Paper flex on landing (tiny).

**Scene transitions.** Sweep the pile, flip the card, new ground cut.

**Instrumental sections.** Creature dance.

**End of song.** Pull back to the pile.

**Timing.** Drops 280-420 ms; scribble 120-250 ms per word; cuts on line starts.

**Easing.** Ease-in drop with a short damped settle.

**Intensity tiers.** Calm: placement without drop. Normal: drop. Energetic: fast drop, sway, creatures active.

**Motion hierarchy.** New card > scribble > creature > pile.

**Response to pacing and energy.** Fast lines: drop shortens to 180 ms; very fast: hard cuts.

**Reduced motion.** Reduced motion: hard cuts only, no sway, no creature dance (static), scribble becomes word fades.

## Transition families

| ID | Transition | Purpose | Entry / exit | Timing | Compatible scenes | Layers | Lyric continuity | Reduced motion | Performance |
|---|---|---|---|---|---|---|---|---|---|
| SKC-TRN-SWEEP | Sweep the pile | Section change on the same ground. | The pile slides off-frame. / Empty ground. | 600 ms. | all | Pile | Between lines. | Cut. | Free. |
| SKC-TRN-FLIP | Card flip | Hook returns: the card flips to show its worn back. | Card flips on its vertical axis. / Back side. | 400 ms. | all | Top card | Line start. | Cut. | Free. |
| SKC-TRN-GROUND-CUT | New ground | Bridge. | Hard cut to a new surface. / Empty surface. | Instant. | all | All | Between lines. | Same. | Free. |
| SKC-TRN-PULL-BACK | Pull back to the pile | Outro and section ends. | Camera zooms out to show all cards. / Hold. | 2-3 s. | all | All | After the last line. | Cut to the wide. | Pile sheets resident (up to 40 cards; older cards baked into a ground texture). |
| SKC-TRN-HAND-SWAP | Hand swap | Cue-card scenes: the hand drops the card and lifts the next. | Card drops out of frame. / Next card raised. | 350 ms. | Cue cards in hand | Hand and card | Line start. | Cut. | Free. |

Shared motion rules (flash limits, determinism, frame-rate independence) are in `phase-2/motion-and-transitions.md`.
