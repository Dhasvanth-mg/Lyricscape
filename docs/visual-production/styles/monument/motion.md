# Monument: motion language

Style 15 of 15. Phase 2 planning (generated from planning data).

**Philosophy.** A steady walk: weight, not swoops.

**Lyric entrances.** Blocks rise from the ground.

**Word progression.** Words rise on cue.

**Line transitions.** The camera walks to the next façade.

**Lyric exits.** Façades stay as the city.

**Background movement.** Distant city in fog.

**Foreground animation.** Dust in light shafts.

**Object transformations.** Light sweeps.

**Camera.** Dolly at walking pace (verses), faster in choruses; corner turns at sections; final aerial pull-back.

**Parallax.** True 3D.

**Material animation.** Shadows on rise.

**Scene transitions.** Corner turn, rise above, fog-out.

**Instrumental sections.** Flythrough.

**End of song.** Aerial city.

**Timing.** Rise 400-700 ms; walk 1.2-2.5 m/s equivalent; corner 2 s; aerial 6-8 s.

**Easing.** Rise ease-out with a heavy settle; camera ease in-out.

**Intensity tiers.** Calm: slow walk, fog. Normal. Energetic: faster walk, sweeps.

**Motion hierarchy.** Active façade > sweep > city.

**Response to pacing and energy.** Fast lines: façades rise along a single wall without camera stops.

**Reduced motion.** Reduced motion: no camera travel (static viewpoint per section, cuts between viewpoints), façades appear without rise, no sweeps; the ending is a static aerial still.

## Transition families

| ID | Transition | Purpose | Entry / exit | Timing | Compatible scenes | Layers | Lyric continuity | Reduced motion | Performance |
|---|---|---|---|---|---|---|---|---|---|
| MON-TRN-CORNER | Corner turn | Section change. | The camera turns a corner. / New street. | 2 s. | all | Camera | Between lines. | Cut. | Free. |
| MON-TRN-RISE-ABOVE | Rise above | Chorus to bridge. | The camera rises above the walls. / High view. | 2.5 s. | all | Camera | Gaps. | Cut. | Free. |
| MON-TRN-FOG-OUT | Fog out | Quiet change. | Fog thickens to white or the cover hue. / Clears on a new template. | 1.5 s. | all | Post | Gaps. | Cross-fade. | Free. |
| MON-TRN-AERIAL | Aerial city | Outro. | Pull back and up over the city. / Aerial hold. | 6-8 s. | all | All | After the last line. | Static aerial still. | City instanced (up to 120 façades). |

Shared motion rules (flash limits, determinism, frame-rate independence) are in `phase-2/motion-and-transitions.md`.
