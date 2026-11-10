# Screenlife: motion language

Style 1 of 15. Phase 2 planning (generated from planning data).

**Philosophy.** Human, not mechanical: motion comes from a person writing and a camera operator watching. Everything has a cause (a key press, a send, a scroll).

**Lyric entrances.** A line enters by being typed: the field gains focus (caret appears 250 ms before the line), characters appear per the typing profile.

**Word progression.** Grapheme by grapheme with profile rhythm; words complete by their end time when authored.

**Line transitions.** Send: the bubble lifts 12 px, the thread scrolls up with a 280 ms ease-out (cubic 0.2, 0.8, 0.2, 1); the field clears.

**Lyric exits.** Sent and scrolled away, saved, archived (slides to an edge), or deleted (backspace burst in the last 20% of the line's time, used at most once per section, for lines followed by a repeat).

**Background movement.** Room plate drifts 0.5-1% per 10 s; bokeh breathes slowly; screen spill flickers with the UI's brightness.

**Foreground animation.** Typing indicator, notifications, reactions; at most one non-lyric UI animation at a time.

**Object transformations.** Bubbles scale 0.96 to 1 on send; stickers pop in with overshoot 1.08.

**Camera.** Settled handheld (noise amplitude 0.25% of frame, 0.3 Hz) in verses; slow push on held words (2% per second, max 8%); rack focus from earlier bubble to field (400 ms); whip pan 220 ms at app changes; orbit only in desktop compositions.

**Parallax.** Device vs room: room moves at 30% of the device's camera motion.

**Material animation.** Glass glare slides with camera angle; CRT terminals keep phosphor persistence.

**Scene transitions.** App switch (card stack), whip pan, lock and wake, device swap (phone set down, laptop raised), scroll back.

**Instrumental sections.** Typing indicator, dim, lock; the camera relaxes to a wide.

**End of song.** Last send, dim, lock, final notification, off.

**Timing.** Typing 6-14 graphemes per second depending on profile and line pace; bursts of 3-8 graphemes; pauses 120-600 ms. Camera moves 220 ms (whip) to 6 s (push).

**Easing.** UI: standard ease-out 0.2,0.8,0.2,1; camera: critically damped spring (no overshoot) except whip pans (ease-in-out quint with motion blur 0.4).

**Intensity tiers.** Three tiers (calm, normal, energetic) from identity energy and user intensity: they change camera noise amplitude (0.15/0.25/0.4%), whip pan use (none/sections/sections and hooks) and typing profile.

**Motion hierarchy.** Typing > send > camera > notifications > room.

**Response to pacing and energy.** The line's duration decides typing speed; the profile only shapes rhythm inside it. Faster songs get fewer camera moves, not faster ones.

**Reduced motion.** Reduced motion: no handheld, no whip pans (cuts with 200 ms fade), no scroll animation (thread updates in place), typing replaced by whole-word appearance on word cues (or the whole line on line cues), caret still blinks at 1 Hz (non-flashing, opacity 0.35 to 1).

## Transition families

| ID | Transition | Purpose | Entry / exit | Timing | Compatible scenes | Layers | Lyric continuity | Reduced motion | Performance |
|---|---|---|---|---|---|---|---|---|---|
| SCR-TRN-APP-SWITCH | App switcher card stack | Change app family at a section boundary while staying on the same device. | Current app shrinks to a card (240 ms), cards slide sideways, new app card grows to full screen. / Old card slides off left (right in RTL). | 600 ms total, starts on the section boundary (snapped to beat when present). | all phone and tablet scenes | UI layer only; room plate unchanged | No lyric is active during the 600 ms; scheduled in the gap before the next line (needs 700 ms lead; otherwise the cut is instant). | Instant cut with 200 ms cross-fade. | Two UI sheets resident; one extra quad. |
| SCR-TRN-WHIP-PAN | Whip pan to a new device | Energetic change of device world inside a song (high-energy chorus entries). | Camera yaws 70 degrees in 220 ms with directional motion blur. / Lands on the new device settled. | 220 ms; only on section boundaries with energy tier normal or energetic. | any to any device change | Whole frame; mblur post uniform | Between lines only. | Cut with 200 ms fade. | Motion blur post pass already exists (mblur). |
| SCR-TRN-SEND-SCROLL | Send and scroll | The line-to-line transition inside messaging and notes. | Bubble lifts, thread scrolls by the bubble height. / Old bubbles move up and dim. | 280 ms ease-out after the send act. | SCR-SCN-01, 02, 05, 09 | UI sheet scroll offset only | Earlier lines stay readable above. | Thread updates in place without scroll animation. | Re-paint of the thread sheet only when a bubble is added (cached per line). |
| SCR-TRN-LOCK-WAKE | Lock and wake | Instrumental breaks and the outro: the person puts the phone down. | Screen dims to 30% over 1 s, then lock screen fades in. / Wake: lock screen brightens and slides up 400 ms into the app. | Dim after 8 s of gap, lock after 16 s; wake 800 ms before the next line. | any phone scene to SCR-SCN-08 | UI and brightness | Next line waits for wake to finish (wake starts early). | Cross-fade. | Lock screen sheet cached. |
| SCR-TRN-DEVICE-SWAP | Device swap | Move from phone to laptop or desktop at a bridge. | Phone tilts down out of frame (500 ms), camera tilts up to a laptop. / Laptop settles. | 900 ms in a gap of at least 1.2 s. | phone families to SCR-SCN-04, 06, 07, 12 | Device frames and room plate both change | Between sections only. | Cut with fade. | Two device frames and two room plates resident for 1 s. |
| SCR-TRN-SCROLL-BACK | Scroll back through the song | Break and outro: show the thread of everything sent so far. | Thread scrolls up through earlier bubbles at reading speed (8 lines per second max). / Scrolls back down to the field. | Fills the gap length minus 1 s. | SCR-SCN-01, 02, 04 | Thread sheet | Shows only lines already sung. | Static view of the last 6 lines. | Thread sheet up to 4096 px tall; tiles if longer. |
| SCR-TRN-SCREEN-DIM | Screen dim | Quiet moments between lines without a full lock. | Brightness to 55% over 1.2 s. / Back to 100% on the next caret. | Gaps of 3-6 s. | all | Exposure uniform | Lyric already completed stays legible (contrast checked at 55%). | Same (non-motion). | Free. |
| SCR-TRN-NOTIFICATION-PULL | Notification pull-down | Change from lock or home to an app via a notification (opening lines of a verse). | Notification banner drops 300 ms, tapped, expands into the app 400 ms. / App full screen. | 700 ms before a line. | SCR-SCN-08 to messaging, notes, voice memo | Overlay then UI | Banner text is metadata (title or artist), never invented text. | Cut. | One overlay sheet. |

Shared motion rules (flash limits, determinism, frame-rate independence) are in `phase-2/motion-and-transitions.md`.
