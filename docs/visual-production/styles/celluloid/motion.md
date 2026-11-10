# Celluloid: motion language

Style 5 of 15. Phase 2 planning (generated from planning data).

**Philosophy.** Film physics: the frame weaves, damage runs at the projection rate, cuts are the punctuation.

**Lyric entrances.** Title cards cut in on line start (with a 2-frame fade from black for calm songs); subtitles cut in; backlit words assemble.

**Word progression.** Words light up or scratch in on authored starts.

**Line transitions.** Cut, optical dissolve (calm, 12 frames), or splice (sections).

**Lyric exits.** Cut or 4-frame fade.

**Background movement.** Grain, dust and flicker at 24 fps quantisation; light leaks drift from the edges.

**Foreground animation.** Hair in the gate (rare), scratches running vertically.

**Object transformations.** Countdown sweep, film strip moving.

**Camera.** Gate weave (0.15% horizontal, 0.25% vertical, 24 fps), occasional push (optical zoom) on held words.

**Parallax.** None, except projection-room composition.

**Material animation.** Emulsion burns spread outward (radial reveal), tape dropouts as horizontal lines.

**Scene transitions.** Splice cut, burn-through, optical dissolve, flash frame (limited), reel change.

**Instrumental sections.** Leader, countdown, light leaks.

**End of song.** Reel runs out.

**Timing.** Damage and weave stepped at 24 fps (or 18, 12 for Super 8 feel); titles at full render rate for smoothness of fades.

**Easing.** Linear for optical dissolves (film printers are linear); ease-out for backlit drift.

**Intensity tiers.** Calm: weave and grain only, dissolves. Normal: damage plates, cuts. Energetic: burst and step-print smears.

**Motion hierarchy.** Title > cut > damage > weave.

**Response to pacing and energy.** Cut rate never exceeds one per 4 frames (167 ms).

**Reduced motion.** Reduced motion: gate weave off, no flicker, no step-print smear, dust static, burst register replaced by whole-line cards; cuts become 6-frame fades; light leaks static.

## Transition families

| ID | Transition | Purpose | Entry / exit | Timing | Compatible scenes | Layers | Lyric continuity | Reduced motion | Performance |
|---|---|---|---|---|---|---|---|---|---|
| CEL-TRN-SPLICE | Splice cut | Section and stock change. | A splice line (tape edge) passes through the gate in 2 frames with a frame jump. / New stock. | 2 frames at 24 fps. | all | Whole frame | Between lines. | 6-frame fade. | Free. |
| CEL-TRN-BURN | Burn-through | Bridge entries and the end of a reel. | An emulsion burn spreads radially to white over 18 frames. / White holds 4 frames, then the new image. | 900 ms; flash rule: luminance rise over 18 frames is not a flash. | all | Burn plate | Lyric hidden during white; scheduled in a gap. | Fade to white and back. | One plate. |
| CEL-TRN-DISSOLVE | Optical dissolve | Calm line changes. | Linear cross-fade. / New title. | 12 frames. | calm stocks | Titles only | Lines overlap 500 ms only if both fit the safe area. | Same. | Free. |
| CEL-TRN-FLASH | Flash frame | Punctuation at chorus entries. | One frame of over-exposure (luminance change under the flash threshold area rule: at most 25% of the frame area or under 10% luminance change). / Next frame normal. | 1 frame, max once per 3 s. | burst and energetic stocks | Exposure | Never on a line start inside the subtitle box. | Removed. | Free. |
| CEL-TRN-REEL-CHANGE | Reel change | Instrumental breaks: a change cue and a new reel. | Two original cue marks blink in the corner (1 Hz, low area). / Splice to the next stock. | 2 s cue then splice. | all | Cue overlay | Only in gaps. | Cue static. | Free. |
| CEL-TRN-RUN-OUT | Film runs out | Outro. | Tail leader, the image slips and flaps (frame jumps), white light. / Black. | 3 s. | all | Whole frame | After the last line. | Fade to white then black. | Free. |
| CEL-TRN-STEP-PRINT | Step-print smear | Energetic movement between words. | Frames repeat 3 times each with blended trails. / Normal rate. | 300-600 ms. | burst, warm reversal | Titles and image | Words remain readable (smear only on motion). | Removed. | Needs 3-frame history buffer (deterministic: recomputed from t). |

Shared motion rules (flash limits, determinism, frame-rate independence) are in `phase-2/motion-and-transitions.md`.
