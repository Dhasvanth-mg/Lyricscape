# Liquid Light Show: typography

Style 8 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


## Typefaces

| Role | Face | Weights / axes | Scripts | Status |
|---|---|---|---|---|
| Slide display | Shrikhand (new, OFL) and Bebas Neue (bundled) | 400 | Latin | new and bundled |
| Plain contrast | Archivo Variable 800 (bundled) | 800 | Latin | bundled |
| Hindi | Noto Sans Devanagari 700-800 (bundled) | 700-800 | Devanagari | bundled |
| Tamil | Noto Sans Tamil 700-800 (bundled) | 700-800 | Tamil | bundled |
| Arabic, Hebrew | Noto Sans Arabic, Noto Sans Hebrew 800 (new) | 800 | Arabic, Hebrew | new dependency |

**Sizes and responsive scaling.** Letter-mask slides: cap height 10-16% (letters must be big enough to show fluid inside); band slides: 5-7%.

**Hierarchy.** Slide > dye bloom near the slide > fluid field.

**Word and line emphasis.** Word (authored): the word's letters brighten (exposure +15%); line: slide change.

**Alignment and positioning.** Centred slides; band slides across the middle or lower third.

**Letter and line spacing.** Letter-mask Latin +3% tracking (thin gaps between letters block fluid less); complex scripts default.

**Wrapping and line breaking.** Letter masks max 2 lines of 1-3 words; longer lines use the band slide.

**Upcoming, active and completed states.** Upcoming: not shown. Active: slide projected. Completed: slide pulled (slides out sideways 250 ms like a carousel).

**Masking and compositing.** Letter-mask slide: the lyric is a clear window in black film; band slide: dark band with light type.

**Typography-driven motion.** Slides change with a carousel click (shift and settle); letters do not animate individually.

**Long lines.** Band slide, two lines max; longer lines split into two slides at the phrase midpoint.

**Short lines.** Letter-mask slide large.

**Multiline compositions.** Second line under the band in smaller type.

**Instrumental and no-lyric states.** No slide; or the song title slide at a long break.

**Portrait and landscape.** Portrait: dish fills width, slides stacked; landscape: dish centred or full bleed.

## Scripts

| Script | Behaviour |
|---|---|
| English | Both slide types. |
| Hindi | Letter masks allowed (bold Devanagari, whole words); band slide for lines over 2 words. |
| Tamil | Band slide preferred (long words); letter masks for one-word lines. |
| Mixed | Band slide. |
| RTL | Both, right-aligned bands. |
| CJK | Letter masks for short lines. |

**Fallback when a face lacks a script.** Noto Sans bold of the script.

Shared rules (all styles) are in `phase-2/typography-system.md`: grapheme segmentation, no Latin tracking on complex scripts, no per-character transforms on Indic or Arabic, bidi by the browser text engine.
