# Konstrukt: typography

Style 4 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


## Typefaces

| Role | Face | Weights / axes | Scripts | Status |
|---|---|---|---|---|
| Grotesk | Archivo Variable (bundled): weight 400-900, width 75-125 | weight and width axes | Latin, Cyrillic, Greek? (Latin, Vietnamese confirmed) | bundled |
| Grotesk alternative | Space Grotesk Variable (bundled) | 300-700 | Latin | bundled |
| Condensed accent | Anton (bundled) | 400 | Latin | bundled |
| Hindi | Noto Sans Devanagari Variable (bundled) | 400-900 weight axis | Devanagari | bundled |
| Tamil | Noto Sans Tamil Variable (bundled) | 400-900 | Tamil | bundled |
| Arabic, Hebrew | Noto Sans Arabic, Noto Sans Hebrew (new) | 400-900 | Arabic, Hebrew | new dependency |

**Sizes and responsive scaling.** Type sizes from a modular scale tied to the grid module height (1, 1.5, 2, 3, 4 modules); smallest lyric size cap height 4% of frame height; hook up to 18%.

**Hierarchy.** Lyric block > dominant form > secondary forms > numerals and rules > grid.

**Word and line emphasis.** Word level (authored): weight step (400 to 800) and width change on the word's start; line level: size step and module position. Never colour flashes or effects.

**Alignment and positioning.** Flush left, ragged right, on grid columns (flush right in RTL); rotated layouts read bottom to top on the left edge.

**Letter and line spacing.** Latin tight tracking at display sizes (-1% to -2%); complex scripts default spacing; line spacing = module subdivision (1.0-1.1 of size).

**Wrapping and line breaking.** Breaks by a balanced-rag algorithm on word boundaries within the column span; no hyphenation.

**Upcoming, active and completed states.** Upcoming: not shown. Active: full weight. Completed: drops to weight 300 and 40% ink, or leaves at the reflow.

**Masking and compositing.** Overprint: type may knock out of the second ink when crossing it (paper shows through), never crossed by forms.

**Typography-driven motion.** Weight and width interpolation over 120 ms on word starts; position steps snap to modules.

**Long lines.** Long lines: block over 2-3 columns with smaller size step; over 4 lines, the layout switches to the column-text template.

**Short lines.** Short lines: one word set across the full width (scale up to the hook size).

**Multiline compositions.** The second line is set in the secondary grotesk at half size in the adjacent column.

**Instrumental and no-lyric states.** Numerals and labels (section names, bar count) set as typographic elements.

**Portrait and landscape.** Portrait: 4- or 6-column grids with tall modules; rotated edge layout uses the long edge. Landscape: 8- or 12-column.

## Scripts

| Script | Behaviour |
|---|---|
| English | All layouts including rotated and column stack. |
| Hindi | Weight axis emphasis works (Noto Sans Devanagari variable); no width changes; no negative tracking; rotated layout not allowed (Devanagari is not set rotated in poster convention here; use block). |
| Tamil | As Hindi; long words get the block layout. |
| Mixed | Runs share the block; weight emphasis per word. |
| RTL | Grid mirrors; flush right; column stack reads right to left by row; rotated layout reads top to bottom on the right edge (Hebrew only; Arabic stays horizontal). |
| CJK | Column stack can be true vertical text (canvas vertical layout by character), proposed for Japanese; otherwise horizontal. |

**Fallback when a face lacks a script.** No Archivo glyph: falls back to Noto Sans of the script at the nearest weight.

Shared rules (all styles) are in `phase-2/typography-system.md`: grapheme segmentation, no Latin tracking on complex scripts, no per-character transforms on Indic or Arabic, bidi by the browser text engine.
