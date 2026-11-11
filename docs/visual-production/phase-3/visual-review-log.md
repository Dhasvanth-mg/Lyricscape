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
