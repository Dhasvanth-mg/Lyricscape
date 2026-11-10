# Nocturne: motion language

Style 7 of 15. Phase 2 planning (generated from planning data).

**Philosophy.** Slow. Fades, focus pulls, breathing light, drifting dust. Nothing cuts except at true sections, and then as a slow dissolve.

**Lyric entrances.** Focus resolve 500 ms; or fade in 600 ms.

**Word progression.** Light catch per authored word.

**Line transitions.** Old line fades 600 ms as new resolves (overlap 300 ms).

**Lyric exits.** Fade or drift up (column).

**Background movement.** Light breathing, weather layers.

**Foreground animation.** Room silhouettes static; curtains sway rarely.

**Object transformations.** None.

**Camera.** Very slow push (0.3% per second) and focus pulls; never pans.

**Parallax.** Rain plane vs bokeh plane: 0.5% offset drift.

**Material animation.** Rain runs down glass; dust drifts.

**Scene transitions.** Slow dissolve, light off/on, light move.

**Instrumental sections.** Light and weather.

**End of song.** Light off.

**Timing.** Fades 400-800 ms; dissolves 2-4 s; light changes 4-6 s.

**Easing.** Ease-in-out sine throughout.

**Intensity tiers.** One tier only for motion (calm); intensity changes weather amount and light breathing depth.

**Motion hierarchy.** Text focus > light > weather.

**Response to pacing and energy.** Fast songs: fades shorten to 250 ms; nothing else speeds up.

**Reduced motion.** Reduced motion: no drift, no rain motion (static droplets), focus resolve replaced by a 300 ms fade, light breathing off.

## Transition families

| ID | Transition | Purpose | Entry / exit | Timing | Compatible scenes | Layers | Lyric continuity | Reduced motion | Performance |
|---|---|---|---|---|---|---|---|---|---|
| NOC-TRN-DISSOLVE | Slow dissolve | Scene change at the bridge or a long break. | Cross-fade of whole scenes. / New scene. | 2-4 s inside a gap. | all | All except text | Text hidden or the last line holds. | 1 s fade. | Two scenes resident. |
| NOC-TRN-LIGHT-ON | Light on | Intro. | Lamp warms up from 0 with a slight filament delay. / Full light. | 1.5-3 s. | all | Light | Before the first line. | 1 s fade. | Free. |
| NOC-TRN-LIGHT-MOVE | Light moves | Bridge: a car passes, a cloud crosses the moon. | Light pool travels across the frame and back. / Light returns. | 4-6 s. | Window rain, Night street, Moonlight, Car | Light and shadow | Text contrast checked along the path; text stays inside the lit region or the move waits for a gap. | Light dims and returns in place. | Free. |
| NOC-TRN-LIGHT-OFF | Light off | Outro. | Light dims to off. / Darkness. | 3 s. | all | Light | Last line fades last. | Same. | Free. |
| NOC-TRN-FOCUS-SHIFT | Focus shift | Section change without a new scene (verse to chorus). | Focus moves from the rain plane to the bokeh plane and back. / Text plane sharp. | 1.2 s. | Window rain, Train window, Car | Planes | Between lines. | Off. | Blur passes exist. |

Shared motion rules (flash limits, determinism, frame-rate independence) are in `phase-2/motion-and-transitions.md`.
