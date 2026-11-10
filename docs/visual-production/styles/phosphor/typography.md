# Phosphor: typography

Style 13 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


## Typefaces

| Role | Face | Weights / axes | Scripts | Status |
|---|---|---|---|---|
| Stroke Latin | Hershey simplex and duplex (new, licence to verify), Relief SingleLine (new, OFL) | single stroke | Latin, Greek, Cyrillic (Hershey) | new dependency |
| Outline trace | Any bundled face traced as an outline path (Noto Sans Devanagari, Tamil, Arabic, Hebrew) | outline | All scripts | bundled |

**Sizes and responsive scaling.** Written words at least 5% of frame height (cap height).

**Hierarchy.** Writing beam > written word > trail > figure.

**Word and line emphasis.** Held words get a flourish (an underline loop) drawn after them.

**Alignment and positioning.** Writes left to right on a baseline at the frame centre; scrolls left when longer than 80% width.

**Letter and line spacing.** Stroke font metrics.

**Wrapping and line breaking.** No wrap: the line scrolls; very long lines split into two passes.

**Upcoming, active and completed states.** Upcoming: not drawn. Active: being written. Completed: fades with persistence.

**Masking and compositing.** None (lines only).

**Typography-driven motion.** Beam writing.

**Long lines.** Scrolling write.

**Short lines.** Big word with flourish.

**Multiline compositions.** Two passes.

**Instrumental and no-lyric states.** Figures.

**Portrait and landscape.** Portrait: writing larger, scroll sooner; figures centred.

## Scripts

| Script | Behaviour |
|---|---|
| English | Single-stroke Hershey or Relief. |
| Hindi | Outline trace of Noto Sans Devanagari: the beam follows the glyph outline (double line), headline drawn last; readability gate. |
| Tamil | Outline trace of Noto Sans Tamil; readability gate. |
| Mixed | Per-run faces; one beam travels through all runs in reading order. |
| RTL | Beam writes right to left; Arabic outline trace follows joins. |
| CJK | Outline trace; per-character. |

**Fallback when a face lacks a script.** Any script fails the trace readability gate: the beam draws an underline sweep while the words appear in Noto Sans with a glow (declared fallback, not hidden).

Shared rules (all styles) are in `phase-2/typography-system.md`: grapheme segmentation, no Latin tracking on complex scripts, no per-character transforms on Indic or Arabic, bidi by the browser text engine.
