# Glyph Cinema: typography

Style 2 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


## Typefaces

| Role | Face | Weights / axes | Scripts | Status |
|---|---|---|---|---|
| Grid face | JetBrains Mono Variable (bundled) | 500, 700 for bands | Latin, Cyrillic, Greek | bundled |
| Terminal pixel face (coarse grids) | VT323 (new, OFL) | 400 | Latin | new dependency |
| Teletext face | Bedstead (new, public domain) | normal and double height | Latin plus teletext mosaics | new dependency |
| Typewriter face | Special Elite (bundled) | 400 | Latin | bundled |
| Hindi band | Noto Sans Devanagari (bundled) | 500 | Devanagari | bundled |
| Tamil band | Noto Sans Tamil (bundled) | 500 | Tamil | bundled |
| Arabic and Hebrew band | Noto Sans Arabic, Noto Sans Hebrew (new) | 500 | Arabic, Hebrew | new dependency |
| CJK band | system CJK in full-width (two-cell) cells | system | Han, Kana, Hangul | system |

**Sizes and responsive scaling.** Cell size is the style's resolution: coarse 1/40 of the output height, medium 1/56, fine 1/72; band text uses the same cell size (never smaller than 1/56 of height on phones, so the fine grid is disabled under 600 px output height).

**Hierarchy.** Lyric band (bright or inverted) > picture highlights > picture midtones > background cells.

**Word and line emphasis.** Word level (authored only): the word inverts in the band; hook words migrate into the picture. Line level: band inversion, double-height teletext row.

**Alignment and positioning.** Band on a fixed row: top third or bottom third depending on the subject's declared focal area; text flush left with a two-cell margin (flush right in RTL); centred in teletext double-height rows.

**Letter and line spacing.** One grapheme per cell for Latin, Cyrillic, Greek; two cells per CJK character; no extra tracking anywhere.

**Wrapping and line breaking.** Wrap at word boundaries to the band width (band width = grid width minus 4 cells); never hyphenate.

**Upcoming, active and completed states.** Upcoming: not shown. Active: typing into the band with a block cursor. Completed: band clears by a decay front when the next line starts, or migrates (hooks).

**Masking and compositing.** The band is a hard mask: picture cells under the band are replaced by band background.

**Typography-driven motion.** Cells type, invert, decay and migrate. Migration moves a letter from its band cell to a target picture cell through intermediate cells along a stepped path (one cell per 33 ms), never sub-cell.

**Long lines.** Long lines: two-row band, then row scrolling; band never exceeds 3 rows (the picture must remain).

**Short lines.** Short lines: the word is set in double-height or double-width cells (2x2) in the band.

**Multiline compositions.** The second line (translation or romanisation) occupies the row under the band in a dimmer colour.

**Instrumental and no-lyric states.** No band; the picture occupies the full grid; teletext shows the page header with song time.

**Portrait and landscape.** Portrait: grid has more rows than columns; band at bottom third; subjects declare portrait crops. Landscape: band top or bottom third per subject.

## Scripts

| Script | Behaviour |
|---|---|
| English | Full calligram behaviour. |
| Hindi | Devanagari conjuncts and matras cannot be split into cells. The band is a clean overlay text strip rendered with the shaped font at a size that spans 2 cell rows, aligned to the grid; no per-letter migration. On hooks, the whole word is routed as a unit into a rectangular region of the picture (the region's cells take the word's rendered pixels as their brightness source, so the word appears as picture texture). The picture itself uses the neutral Latin ramp. |
| Tamil | As Hindi: shaped strip, whole-word routing. |
| Mixed | Latin runs keep per-cell behaviour; complex-script runs use strip behaviour inside the same band. |
| RTL | Arabic: joined script, so strip behaviour as Hindi; band flush right; typing order is logical (the browser shapes the strip progressively by grapheme). Hebrew: per-cell possible (no joining) but kept as strip for consistency; flush right. |
| CJK | Full-width two-cell characters, per-character typing and migration allowed. |

**Fallback when a face lacks a script.** If a band face lacks a glyph, the strip falls back through Noto faces; the picture never uses glyphs from the lyric's complex script as ramp characters.

Shared rules (all styles) are in `phase-2/typography-system.md`: grapheme segmentation, no Latin tracking on complex scripts, no per-character transforms on Indic or Arabic, bidi by the browser text engine.
