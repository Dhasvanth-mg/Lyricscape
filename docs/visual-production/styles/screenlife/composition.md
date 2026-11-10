# Screenlife: composition families

Style 1 of 15. Phase 2 planning (generated from planning data).


7 structurally distinct composition families. Each changes the focal type, depth structure or the lyric's relationship to the environment, not only colour. Scene families (scene-families.md) choose among them.

## SCR-CMP-C1 Over the shoulder

- **Focal point:** The active text field or newest bubble, placed at the frame's optical centre (golden-section horizontal, 45% vertical).
- **Lyric placement:** Inside the UI field; camera frames it so the lyric is never within 8% of a frame edge.
- **Background structure:** Room plate in deep blur (bokeh), one practical light.
- **Foreground:** Device bezel edge, optional hand silhouette at the lower edge (soft, 40% opacity).
- **Negative space:** The UI's empty space (empty thread, blank note) above or below the field.
- **Visual hierarchy:** Field > earlier bubbles > chrome > room.
- **Layering (back to front):** room plate, device shadow, device frame, UI sheet, glass reflection, caret and selection overlay
- **Depth and perspective:** Device yawed 6-12 degrees, tilted 4-8 degrees; focus plane on the field; UI outside the field blurred by distance (mip blur).
- **Camera:** Settled handheld, slow pushes, rack focus.
- **Safe areas:** Lyric bounding box inside the central 84% x 80% of the frame (title-safe), plus the player-chrome-safe zone (bottom 14% in the app stage).
- **Compatible asset categories:** UIK, FRM device, ENV room, TEX glass, REV caret, CAM handheld and push
- **Musical and lyrical conditions:** Default for verses in every app family; addressed and narrative lyrics.
- **Responsive:**
  - 1280x720 landscape: Phone shown tilted in a room, occupying 55-65% of the height; or laptop at 80% width.
  - 720x1280 portrait: Phone face-on filling 92% of height; room visible only at edges; yaw reduced to 3 degrees.
  - 1080x1080 square: Phone at 75% height, room visible on both sides.
  - 390x844 small mobile: Same as portrait; camera crops closer so lyric x-height reaches 2.6% of height.

## SCR-CMP-C2 Macro on the field

- **Focal point:** The lyric text itself at large size; caret visible.
- **Lyric placement:** Lyric fills 60-75% of the frame width, centred on the field line.
- **Background structure:** The UI's own surface out of focus; no room.
- **Foreground:** None.
- **Negative space:** Huge: the blurred UI around the field.
- **Visual hierarchy:** Lyric > caret > nothing else.
- **Layering (back to front):** UI sheet (blurred), field crop sharp, caret overlay
- **Depth and perspective:** Very shallow depth of field; field plane only.
- **Camera:** Slow push, very slight drift; no handheld in calm tier.
- **Safe areas:** Lyric inside central 80% x 60%.
- **Compatible asset categories:** UIK states with large fields, REV caret and selection, CAM push
- **Musical and lyrical conditions:** Held words, short lines, quiet moments, the first chorus's hook word.
- **Responsive:**
  - 1280x720 landscape: Field runs horizontally across the frame.
  - 720x1280 portrait: Field wraps to 2-3 lines at the same x-height; camera tilts to follow the caret line.
  - 1080x1080 square: As portrait with 2 lines.
  - 390x844 small mobile: As portrait.

## SCR-CMP-C3 Desktop windows

- **Focal point:** The frontmost window's field.
- **Lyric placement:** Field in the frontmost window, which sits right of centre (left in RTL).
- **Background structure:** Desktop wallpaper (from cover) and older windows holding earlier lines.
- **Foreground:** Cursor pointer, a dragged window.
- **Negative space:** Wallpaper areas between windows.
- **Visual hierarchy:** Front window > previous window (dim) > wallpaper.
- **Layering (back to front):** wallpaper, back windows (2-4), front window, cursor, glass
- **Depth and perspective:** Window stack with 2-3% scale steps and soft shadows; monitor bezel when the camera pulls back.
- **Camera:** Orbit of 4-6 degrees around the monitor, slow pushes to the front window.
- **Safe areas:** Front window field inside central 80% x 70%.
- **Compatible asset categories:** UIK desktop kits (documents, code editor, retro desktop, mail), FRM laptop and monitor, PRC wallpaper
- **Musical and lyrical conditions:** Narrative lyrics, bridge sections, nostalgia identity (retro desktop).
- **Responsive:**
  - 1280x720 landscape: Native: monitor or laptop at 80-90% width.
  - 720x1280 portrait: Monitor cropped to the front window, back windows peek at the top; or switch to C1 phone.
  - 1080x1080 square: Front window centred, back windows behind at 92% scale.
  - 390x844 small mobile: Front window only.

## SCR-CMP-C4 Thread scroll

- **Focal point:** The newest bubble at 62% of the frame height.
- **Lyric placement:** Bubbles stacked vertically; newest just above the input field.
- **Background structure:** Thread background (theme) and wallpaper tint.
- **Foreground:** Input bar and keyboard (keyboard as abstract key grid, no real layout branding).
- **Negative space:** Thread space above, filled only by earlier sung lines.
- **Visual hierarchy:** Newest bubble > field > previous bubbles > header.
- **Layering (back to front):** thread background, bubbles, input bar, keyboard, overlay
- **Depth and perspective:** Flat, face-on; depth only from the device frame edge.
- **Camera:** Tilt-follow upward as the thread grows; no handheld.
- **Safe areas:** Newest bubble inside central 86% width.
- **Compatible asset categories:** UIK messaging, notes and voice memo states, PRP notifications and stickers
- **Musical and lyrical conditions:** Addressed lyrics, repeated choruses (resent bubbles stack visibly), portrait export.
- **Responsive:**
  - 1280x720 landscape: Device centred face-on at 90% height, room visible left and right with soft vignette; or tablet in landscape.
  - 720x1280 portrait: Native; device fills frame edge to edge.
  - 1080x1080 square: Device at 92% height.
  - 390x844 small mobile: Native.

## SCR-CMP-C5 Two screens

- **Focal point:** The sending screen's field; the receiving screen shows the same line arriving.
- **Lyric placement:** Lyric on the left device (sender), echo on the right (receiver) at 70% scale.
- **Background structure:** Two rooms split by a soft vertical seam (different light temperatures).
- **Foreground:** Device frames.
- **Negative space:** The seam.
- **Visual hierarchy:** Sender field > receiver bubble > rooms.
- **Layering (back to front):** room A, room B, device A, device B, UI sheets, glass
- **Depth and perspective:** Both devices face-on with opposite yaw (inward 6 degrees).
- **Camera:** Locked off; slow push to whichever side is active.
- **Safe areas:** Each device's field in its half's central 80%.
- **Compatible asset categories:** UIK messaging and notes, FRM two device types, ENV two rooms
- **Musical and lyrical conditions:** Duets, call-and-response lines, songs with "you" and "I" alternating (identity perspective addressed).
- **Responsive:**
  - 1280x720 landscape: Native side by side.
  - 720x1280 portrait: Stacked: sender bottom, receiver top.
  - 1080x1080 square: Stacked at 48% each.
  - 390x844 small mobile: Stacked, receiver reduced to a notification banner.

## SCR-CMP-C6 Lock screen

- **Focal point:** The clock (song elapsed time) or the newest notification.
- **Lyric placement:** Lyric as a notification card in the lower half; clock at top third.
- **Background structure:** Wallpaper from cover (blurred or cropped).
- **Foreground:** Notification stack (only metadata and sung lines).
- **Negative space:** Wallpaper.
- **Visual hierarchy:** Notification with lyric > clock > other notifications.
- **Layering (back to front):** wallpaper, clock, notification stack, glass
- **Depth and perspective:** Flat; device frame optional.
- **Camera:** Very slow push; settles.
- **Safe areas:** Notification card inside central 86% width.
- **Compatible asset categories:** UIK lock screen kit, PRC wallpaper, PRP notifications
- **Musical and lyrical conditions:** Intro, instrumental breaks, outro, very sparse lyrics.
- **Responsive:**
  - 1280x720 landscape: Phone face-on centred at 90% height in a dim room, or the lock screen of a laptop (centred clock).
  - 720x1280 portrait: Native.
  - 1080x1080 square: Phone at 92% height.
  - 390x844 small mobile: Native.

## SCR-CMP-C7 Full-frame terminal

- **Focal point:** The prompt line.
- **Lyric placement:** Lyric typed after a prompt at the lower third; earlier lines scroll up as output.
- **Background structure:** Terminal background with scanlines when CRT.
- **Foreground:** None.
- **Negative space:** Empty terminal above.
- **Visual hierarchy:** Prompt line > earlier lines > status bar.
- **Layering (back to front):** terminal background, text sheet, CRT curvature and scan post
- **Depth and perspective:** Flat or CRT curved.
- **Camera:** Static, slow push; rack focus disabled.
- **Safe areas:** Prompt line inside central 90% width; never on the bottom 14% (player chrome).
- **Compatible asset categories:** UIK terminal kit, TEX CRT plates, MOT typing
- **Musical and lyrical conditions:** Electronic, industrial, hacker-themed or cold songs; replaces today's Code screens look honestly.
- **Responsive:**
  - 1280x720 landscape: 80 columns visible.
  - 720x1280 portrait: 40 columns; lines wrap at words.
  - 1080x1080 square: 60 columns.
  - 390x844 small mobile: 34 columns.

## Evolving through a song without chaos

Accumulative: the thread, document or note grows across a section; the device world persists across the song; only apps change. Composition families change only at section boundaries (8-26 s, the director constants) or at a transition listed in motion.md; within a section only the lyric, accumulating elements and the camera move. A composition family is never used for two consecutive sections unless it is a chorus recall.
