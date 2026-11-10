# Cover Pop: motion language

Style 14 of 15. Phase 2 planning (generated from planning data).

**Philosophy.** Bouncy and readable: things pop and settle; the cover moves slowly underneath.

**Lyric entrances.** Phrase pop (scale 0.9 to 1 with small overshoot).

**Word progression.** Phrase hand-offs.

**Line transitions.** Hand-off.

**Lyric exits.** Phrase slides out as the next pops.

**Background movement.** Cover crop and pan.

**Foreground animation.** Stickers.

**Object transformations.** Burst.

**Camera.** Crop paths (Ken Burns style) across the cover.

**Parallax.** None (cover is flat).

**Material animation.** None.

**Scene transitions.** Crop jump, zoom out to full, burst.

**Instrumental sections.** Breathe and pan.

**End of song.** Recede to a framed square.

**Timing.** Pop 140-200 ms; hand-off 220 ms; crop move 6-12 s.

**Easing.** Overshoot for pops; ease in-out for crops.

**Intensity tiers.** Calm: slide, slow crops. Normal: pop. Energetic: punch and burst.

**Motion hierarchy.** Phrase > sticker > cover motion.

**Response to pacing and energy.** Fast phrases: pops shorten to 100 ms.

**Reduced motion.** Reduced motion: phrases fade in (no pop), no bursts, no crop motion (static crops with cuts), no sticker drift.

## Transition families

| ID | Transition | Purpose | Entry / exit | Timing | Compatible scenes | Layers | Lyric continuity | Reduced motion | Performance |
|---|---|---|---|---|---|---|---|---|---|
| CVP-TRN-CROP-JUMP | Crop jump | Line groups change. | Cut to a new crop region. / New crop. | Instant. | all | Cover | Line start. | Same. | Free. |
| CVP-TRN-FULL-OUT | Zoom out to full | Chorus entry. | Crop zooms out to the full cover. / Full cover. | 700 ms. | all | Cover | Line start. | Cut. | Free. |
| CVP-TRN-BURST | Burst | Hook hit. | Burst shape behind the hook. / Burst fades. | 500 ms. | Chorus scenes | Over cover, under type | Hook word. | Off. | Free. |
| CVP-TRN-RECEDE | Recede | Outro. | Cover shrinks to a framed square on its own colour. / Framed cover. | 2.5 s. | all | All | After the last line. | Cut. | Free. |

Shared motion rules (flash limits, determinism, frame-rate independence) are in `phase-2/motion-and-transitions.md`.
