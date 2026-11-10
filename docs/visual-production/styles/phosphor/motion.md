# Phosphor: motion language

Style 13 of 15. Phase 2 planning (generated from planning data).

**Philosophy.** The beam never jumps silently: it travels, or it jumps with a faint visible line like a real scope.

**Lyric entrances.** The beam writes.

**Word progression.** Writing speed fitted to timing.

**Line transitions.** The finished word unwinds into a figure or into the next word.

**Lyric exits.** Persistence fade.

**Background movement.** Graticule static (scope register).

**Foreground animation.** None.

**Object transformations.** Figures.

**Camera.** Locked; slight drift in light painting.

**Parallax.** None.

**Material animation.** Persistence and bloom proportional to beam speed (fast moves bloom more).

**Scene transitions.** Collapse to a dot, phosphor change, sweep.

**Instrumental sections.** Curves.

**End of song.** Back to a dot.

**Timing.** Beam speed 0.6-3 screen widths per second; figure draw 0.6-2 s; morph 300-800 ms.

**Easing.** Constant beam speed with slowdowns at corners (natural drawing).

**Intensity tiers.** Calm: slow, long persistence. Normal. Energetic: fast, symmetry, beat-locked.

**Motion hierarchy.** Beam head > word > trail.

**Response to pacing and energy.** Fast lines: writing compresses to 0.3 s per word; under 0.2 s: words appear with a quick sweep.

**Reduced motion.** Reduced motion: words appear whole with a single gentle fade (no beam travel), figures are static drawings, no symmetry spin, persistence trails off.

## Transition families

| ID | Transition | Purpose | Entry / exit | Timing | Compatible scenes | Layers | Lyric continuity | Reduced motion | Performance |
|---|---|---|---|---|---|---|---|---|---|
| PHO-TRN-DOT | Collapse to a dot | Section change. | The whole drawing collapses to the centre dot. / Dot, then new writing. | 600-900 ms. | all | Beam | Between lines. | Fade. | Free. |
| PHO-TRN-PHOSPHOR | Phosphor change | Bridge. | The trail decays to the new phosphor's colours. / New colour. | 1.5 s. | all | Beam | Gaps. | Instant colour change. | Free. |
| PHO-TRN-SWEEP | Sweep | Into curves. | The beam sweeps a horizontal line that becomes a sine. / Curve. | 800 ms. | Scope scenes | Beam | Gaps. | Cut. | Free. |
| PHO-TRN-FADE-OUT | Last dot | Outro. | Back to the dot. / Dot fades. | 3-4 s. | all | Beam | After the last line. | Fade. | Free. |

Shared motion rules (flash limits, determinism, frame-rate independence) are in `phase-2/motion-and-transitions.md`.
