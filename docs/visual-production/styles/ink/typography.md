# Ink: typography

Style 11 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


## Typefaces

| Role | Face | Weights / axes | Scripts | Status |
|---|---|---|---|---|
| Display (Latin) | Cormorant Garamond, Instrument Serif (bundled), Newsreader (new) | 400-600 | Latin | bundled and new |
| Text (Latin) | Newsreader (new) | 400 | Latin | new dependency |
| Devanagari | Noto Serif Devanagari (new) | 400-700 | Devanagari | new dependency |
| Tamil | Noto Serif Tamil (new) | 400-700 | Tamil | new dependency |
| Arabic | Noto Naskh Arabic (new) | 400-700 | Arabic | new dependency |
| Hebrew | Frank Ruhl Libre (new) | 400-700 | Hebrew | new dependency |

**Sizes and responsive scaling.** One or two words large (cap height 8-14% of frame height), the rest small (3-4%) in a column.

**Hierarchy.** Large brushed word > small column > element > paper.

**Word and line emphasis.** The line's longest-held word (authored) or longest word becomes the large word; the accent colour goes on one word per section.

**Alignment and positioning.** Column beside the element; large word on the column's top.

**Letter and line spacing.** Generous tracking for small text (+20); none for complex scripts.

**Wrapping and line breaking.** Column wraps at word boundaries, 14-22 characters per row (Latin).

**Upcoming, active and completed states.** Upcoming: blank paper. Active: brushing then wet. Completed: dries to pale wash and fades.

**Masking and compositing.** Stroke-reveal masks (distance along stroke) with a brush-texture edge.

**Typography-driven motion.** Brush reveal per word.

**Long lines.** Small column only (no large word).

**Short lines.** One large word.

**Multiline compositions.** Column rows.

**Instrumental and no-lyric states.** Growth, no text.

**Portrait and landscape.** Portrait: element above, column below; landscape: element left or right, column opposite.

## Scripts

| Script | Behaviour |
|---|---|
| English | Stroke-reveal along the glyph's stroke order (computed from the skeleton). |
| Hindi | Reveal along the headline and strokes computed from the skeleton, then the shirorekha drawn last as one stroke; Noto Serif Devanagari. |
| Tamil | Skeleton-based reveal; Noto Serif Tamil. |
| Mixed | Per-run faces; reveal per run in reading order. |
| RTL | Arabic reveal right to left along the baseline joins (Naskh); Hebrew right to left. |
| CJK | Stroke order from open stroke-order data where licensed; otherwise left-to-right wipe. |

**Fallback when a face lacks a script.** Any script without reliable skeleton data: generic reading-direction wipe with a brush-textured edge (no fake stroke order).

Shared rules (all styles) are in `phase-2/typography-system.md`: grapheme segmentation, no Latin tracking on complex scripts, no per-character transforms on Indic or Arabic, bidi by the browser text engine.
