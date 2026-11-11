# Visual review log

Renders were taken from the running app in headless Chromium (software WebGL) with the demo songs.

## Sketch Cards drawings (contact sheets)
- Doodles: accepted as drawn.
- Dark: shattered glass, phone off the hook and wolf were unclear; redrawn.
- Everyday: sneakers, keys and auto-rickshaw were unclear; redrawn.
- Hands read as mittens; redrawn with fingers, thumbs and sleeve cuffs. Paper clip turned the wrong way; redrawn as one wire path.

## Sketch Cards scene, Neon Static, 1280x720 and 720x1280
- Intro (desk at night, tools, doodles, title card), sticky-note verse (C6), street-wall chorus with pinned cards (C4), creature break, outro: all drawn, words lettered in as sung.
- Street-wall poster remnants first rendered as soft blobs that read as camouflage; repainted as torn rectangles with faded print.
- Portrait: pinned cards at the top were cut off by the frame; corner positions and sizes changed for portrait.
- The capture script let the live loop redraw between render and read-back, which produced one black and two wrong frames; the script now renders and reads in one task. Not a renderer fault.

## Sketch Cards, mixed languages (English, Hindi, Tamil, Arabic, Hebrew on alternate lines), 1280x720
- All five scripts letter correctly: Devanagari and Tamil conjuncts intact, Arabic joined, Hebrew and Arabic laid out right to left.
- One Tamil pill word was measured before its font had loaded and overflowed its pill in the test harness. In the app the script fonts load before the first frame (`SCENE_SCRIPT_LOADS`); not seen there.

Not yet reviewed in real renders: the held cue card (C2) with hands, the pile (C3), the full-bleed poster (C5), the dark sketchbook, kitchen, notebook, riso studio and corkboard grounds, square and small-mobile sizes.

## Cover Pop, demo covers, 1280x720, 720x1280, mixed scripts, cover off

- Full stage, crop tour, collage with cut-outs, giant-word chorus with a halftone burst, side field, framed ending and the no-cover stages all drawn; Arabic and Hebrew lines laid out right to left in their voice.
- The chip word's icon covered the next word; moved above the chip word's corner.
- In landscape the full-cover phrase was squeezed into the cover's empty patch; it may now run across the side fields at that height.
- A portrait collage phrase ran past the frame edge; phrases are now scaled to stay inside the frame.
- Not reviewed: the brief's 50-cover saliency review (only the three demo covers exist here), square and small-mobile sizes.

## Screenlife, all 11 kits, 1280x720, 720x1280, 1080x1080, 390x844, five scripts

- All kits drawn and legible: messenger (phone and tablet), notes, search with suggestions, documents on a monitor, post composer with the cover, full-frame terminal, lock screen with the stack, voice memo, checklist, car display, Plaid desktop on a CRT.
- Captures taken while the page was still loading showed an empty intro state and, once, the composer without its cover; the kit cache key now includes whether a cover is present, and the capture script waits for the timeline.
- The voice memo transcript scrolled under the waveform; the recorder now masks it.
- The car display showed an empty map between lines; the last instruction now stays on the banner, dimmed.
- In portrait, the composer and messenger over the shoulder were small; portrait C1 now fills the height. Wide screens (laptop, car display, CRT) in a tall frame now crop to the part that holds the field.
- The post composer on a landscape tablet overflowed the screen; the composer is always a phone.
- A chorus sticker covered the checklist title; stickers now sit at the trailing edge of the newest item.
- Arabic and Hebrew: bubbles on the left, text right-aligned, the caret at the left end. Devanagari and Tamil typed by whole clusters (no half-built conjuncts seen).
- Small mobile (390x844) meets the 2.6% x-height floor, which makes the messenger text very large on that screen; listed for the owner's review.
- Not reviewed: reduced motion as frames (covered by tests only), the section transitions watched as motion, real-device performance (B-06).

## Glyph Cinema, 62 subjects, five registers, five compositions, 1280x720, 720x1280, 1080x1080, 390x844, five scripts

- All 62 subjects rendered through the character pass in phosphor at 1280x720 on one contact sheet. Most read at a glance; rose, hands, dancer, crowd and slow lights are weak and listed for redrawing.
- The picture shader first drew upside down (wrong uv flip); fixed. Landscape grids were too coarse; fixed. Pictures were dim through the ramp; a gain was added.
- Square-celled band text looked letterspaced; band cells now use a 0.72 aspect (D3-GLY-01).
- 1-bit: dither speckled the paper; thresholds changed. Teletext mosaic read as a blob; sixels now light on the brightest channel.
- Typewriter: the picture printed inverted and faint; it is printed by brightness now, still lighter than the type (D3-GLY-03). Wrapped lines overlapped; rows now stack with the current row on the carriage. The heading overflowed on small screens; it is now fitted.
- Hindi, Tamil and Arabic lines in teletext pages broke in the cell grid; they are now drawn as clipped strips (right-aligned for Arabic). Mixed lines become strips (D3-GLY-06).
- Default (unforced) frames at four sizes: the split field, the band with the sung word inverted, block shade in a chorus. Small mobile meets the 2.6% x-height floor; the inverted band in portrait is small but over the floor.
- Not reviewed: motion watched as motion, reduced motion as frames (tests only), kana and hangul ramps (they depend on system CJK fonts), real-GPU timings (B-06).
