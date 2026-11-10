# Folio: typography

Style 6 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


## Typefaces

| Role | Face | Weights / axes | Scripts | Status |
|---|---|---|---|---|
| Display serif | Playfair Display Variable (bundled), DM Serif Display (bundled), Instrument Serif (bundled) | Playfair 400-900 and italic | Latin, Cyrillic (Playfair) | bundled |
| Text serif | Cormorant Garamond (bundled), Newsreader (new, OFL) | 300-600 | Latin | bundled and new |
| Caption grotesk | Inter Variable (bundled) | 400-600 | Latin, Cyrillic, Greek | bundled |
| Loud display | Syne Variable (bundled), Archivo Variable (bundled) | 400-800 | Latin | bundled |
| Hindi | Noto Serif Devanagari (new) for text and quotes; Noto Sans Devanagari (bundled) for captions | 400-700 | Devanagari | new and bundled |
| Tamil | Noto Serif Tamil (new); Noto Sans Tamil (bundled) | 400-700 | Tamil | new and bundled |
| Arabic, Hebrew | Noto Naskh Arabic, Frank Ruhl Libre (new) | 400-700 | Arabic, Hebrew | new dependency |

**Sizes and responsive scaling.** Pull quote cap height 4.5-7% of frame height in page view (the camera frames the slot); headline up to 14%; body text 1.4-1.8% (texture, not for reading at phone size).

**Hierarchy.** Headline (hooks) or pull quote > drop cap > plate > body > captions and folios.

**Word and line emphasis.** Word level (authored): ink darkening, italic switch on held words (Latin); line level: pull quote placement, headline.

**Alignment and positioning.** Pull quotes flush left with hanging punctuation, or centred in programme; body justified with hyphenation off; RTL pages mirror.

**Letter and line spacing.** Text tracking 0; small caps +5% (Latin); headlines -1%; complex scripts default spacing.

**Wrapping and line breaking.** Knuth-Plass-like balanced breaks for pull quotes (proposed small implementation in the text layout primitive); body greedy with widow control.

**Upcoming, active and completed states.** Upcoming: not shown. Active: pull quote at full ink. Completed: line moves into the body columns at body size (the article grows).

**Masking and compositing.** None on lyric; plates masked by frames.

**Typography-driven motion.** Slide into slot, ink darkening, flow into columns.

**Long lines.** Long lines: pull quote over 2-3 lines; over 3 lines the line is set as an opening paragraph with a drop cap.

**Short lines.** Short lines: headline size or a drop-cap word.

**Multiline compositions.** The second line has its own column (parallel text) in the bilingual edition, or sits under the quote in italic.

**Instrumental and no-lyric states.** Plates, captions, contents.

**Portrait and landscape.** Portrait: single page view; the camera moves between slots on the page. Landscape: spread view.

## Scripts

| Script | Behaviour |
|---|---|
| English | All treatments including drop caps and small caps. |
| Hindi | Drop caps not used (Devanagari drop caps break the headline bar convention); pull quote in Noto Serif Devanagari; italic emphasis not available (no Devanagari italic): emphasis by ink darkening only; justified body avoided (ragged right). |
| Tamil | As Hindi; drop caps not used; ragged body. |
| Mixed | Pull quote runs in each script's serif; body ragged. |
| RTL | Pages mirror (binding on the right), pull quotes flush right; drop caps allowed for Hebrew, not Arabic. |
| CJK | Vertical setting is not used; horizontal with system serif. |

**Fallback when a face lacks a script.** Missing serif: Noto Serif for the script, then Noto Sans.

Shared rules (all styles) are in `phase-2/typography-system.md`: grapheme segmentation, no Latin tracking on complex scripts, no per-character transforms on Indic or Arabic, bidi by the browser text engine.
