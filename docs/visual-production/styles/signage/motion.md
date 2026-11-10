# Signage: motion language

Style 10 of 15. Phase 2 planning (generated from planning data).

**Philosophy.** Each hardware has its own honest rhythm: nothing floats, everything clicks, buzzes or steps.

**Lyric entrances.** Sign switches on (neon buzz, bulbs warm up, flaps cycle).

**Word progression.** Characters settle on cues.

**Line transitions.** Board update (flaps cycle to the new line).

**Lyric exits.** Board blanks or switches off.

**Background movement.** Static plate; passing headlights sweep (SHR depth fog light).

**Foreground animation.** Rain streaks, fog.

**Object transformations.** Wires sway slightly in wind.

**Camera.** Locked or a slow dolly at street level; small handheld in rain.

**Parallax.** Plate depth hint, 2-4% on dolly.

**Material animation.** Wet reflection under the sign.

**Scene transitions.** Switch off and on, street cut, rain wipe.

**Instrumental sections.** Departure board break; bulb chase.

**End of song.** Switch off one by one.

**Timing.** Flap cycle 40-60 ms per flap step; neon flicker-on 200-600 ms; bulb chase 80-160 ms per step; dot refresh 30 ms per column.

**Easing.** Mechanical (stepped); neon flicker random but seeded.

**Intensity tiers.** Calm: one neon word. Normal: board updates. Energetic: marquee chases, ticker speed.

**Motion hierarchy.** Panel > trim lights > setting.

**Response to pacing and energy.** Fast lines: flaps start earlier so they settle on time; under 300 ms per line: LED sign instant update.

**Reduced motion.** Reduced motion: no flap cycling (instant settle), no bulb chase (all on), no flicker (neon on steady), no camera moves; no strobe-like blinking above 3 Hz ever (flash guard V5).

## Transition families

| ID | Transition | Purpose | Entry / exit | Timing | Compatible scenes | Layers | Lyric continuity | Reduced motion | Performance |
|---|---|---|---|---|---|---|---|---|---|
| SIG-TRN-SWITCH | Switch off and on | Section change on the same street. | Sign powers down (neon fade with afterglow, flaps blank). / New sign powers up. | 800-1200 ms. | all | Sign | Between lines. | Cross-fade 300 ms. | Free. |
| SIG-TRN-STREET-CUT | Street cut | Bridge: a new place. | Hard cut on a line start. / New setting. | Instant. | all | All | Line start. | Same. | Plate load ahead. |
| SIG-TRN-FLAP-CASCADE | Flap cascade | Chorus entry on boards. | Every flap cycles at once, wave left to right. / Settles on the hook. | 900 ms. | Station hall, Airport gate | Board | Line start. | Instant settle. | Free. |
| SIG-TRN-RAIN-WIPE | Rain wipe | Quiet changes. | Rain on the lens thickens and blurs the frame. / Clears on the new sign. | 1.2 s. | Rain scenes | Post | Gaps. | Cross-fade. | SHR rain on glass. |
| SIG-TRN-BLACKOUT | Blackout | Outro. | Signs switch off one by one. / Darkness with a fading reflection. | 3-6 s. | all | All | After the last line. | Single fade. | Free. |

Shared motion rules (flash limits, determinism, frame-rate independence) are in `phase-2/motion-and-transitions.md`.
