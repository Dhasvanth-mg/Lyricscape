# Liquid Light Show: motion language

Style 8 of 15. Phase 2 planning (generated from planning data).

**Philosophy.** The hand: dishes rock, swirl, get squeezed; bubbles split and merge; dye blooms from a point. Motion has a performer's intention.

**Lyric entrances.** Slides click in (shift 4% and settle 200 ms).

**Word progression.** Dye blooms on authored words.

**Line transitions.** Slide carousel advance.

**Lyric exits.** Slide out.

**Background movement.** Fluid advection along baked flow fields (periodic).

**Foreground animation.** Bubbles and oil cells.

**Object transformations.** Colour wheel rotates.

**Camera.** None (it is a projection); the dish may drift slightly.

**Parallax.** Two dish layers shift relative to each other when rocked.

**Material animation.** Oil refraction, dye diffusion.

**Scene transitions.** Dish pulled away, fresh drop, wheel turn, lamp fade.

**Instrumental sections.** Hand gestures.

**End of song.** Lamp fade and stillness.

**Timing.** Rock period 4-9 s; squeeze 180 ms on beats; blooms 1-2 s spread.

**Easing.** Gestures use smooth sine envelopes; squeezes ease-out.

**Intensity tiers.** Calm: honey presets, slow rock. Normal: swirl and blooms. Energetic: squeezes on beats and two dishes.

**Motion hierarchy.** Slide > squeeze > blooms > drift.

**Response to pacing and energy.** Viscosity and gesture amplitude follow energy, never the per-frame audio.

**Reduced motion.** Reduced motion: advection speed 25%, no squeezes, no wheel rotation (static tint), slides cut with fade.

## Transition families

| ID | Transition | Purpose | Entry / exit | Timing | Compatible scenes | Layers | Lyric continuity | Reduced motion | Performance |
|---|---|---|---|---|---|---|---|---|---|
| LLS-TRN-PULL-DISH | Dish pulled away | Section change. | The current dish slides out of the projection (600 ms). / A new dish slides in. | 1.2 s. | all | Fluid layer | Slide stays projected. | Cross-fade 600 ms. | Two presets for 1.2 s. |
| LLS-TRN-FRESH-DROP | Fresh drop | Palette change within a dish. | A large drop of a new dye lands and spreads. / The new dye dominates. | 2 s. | all | Fluid | Slide contrast floor maintained. | Slow fade. | Free. |
| LLS-TRN-WHEEL-TURN | Colour wheel turn | Chorus entry or bridge. | Wheel rotates one segment. / New tint. | 800 ms. | C5 and any with a wheel | Tint | Slide unaffected. | Tint fade. | Free. |
| LLS-TRN-LAMP-FADE | Lamp fade | Outro. | Lamp dims; fluid slows. / Darkness. | 3 s. | all | All | Last slide fades last. | Same. | Free. |
| LLS-TRN-CAROUSEL | Slide carousel advance | Line change. | Slide shifts out, next shifts in. / Settles. | 250 ms. | all | Slide | Line-to-line. | Cut. | Free. |

Shared motion rules (flash limits, determinism, frame-rate independence) are in `phase-2/motion-and-transitions.md`.
