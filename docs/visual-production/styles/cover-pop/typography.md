# Cover Pop: typography

Style 14 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


## Typefaces

| Role | Face | Weights / axes | Scripts | Status |
|---|---|---|---|---|
| Rounded voice | Nunito 900 italic (bundled, existing) | 900 | Latin | bundled |
| Condensed voice | Bebas Neue, Archivo Black (bundled) | 400-900 | Latin | bundled |
| Serif voice | DM Serif Display, Playfair (bundled) | 400-900 | Latin | bundled |
| Wide voice | Syne 800 (bundled) | 800 | Latin | bundled |
| Script voice | Shrikhand (new, OFL) | 400 | Latin | new dependency |
| Devanagari voice | Noto Sans Devanagari 900 (bundled) | 900 | Devanagari | bundled |
| Tamil voice | Noto Sans Tamil 900 (bundled) | 900 | Tamil | bundled |
| Arabic, Hebrew voice | Noto Sans Arabic, Noto Sans Hebrew 800 (new) | 800 | Arabic, Hebrew | new dependency |

**Sizes and responsive scaling.** Phrase cap height 7-14% of frame height.

**Hierarchy.** Chip word > phrase > stickers > cover.

**Word and line emphasis.** Chip on the heaviest word (existing emphasis).

**Alignment and positioning.** Phrase layouts placed in the emptiest region.

**Letter and line spacing.** Tight (-0.02 em) Latin; normal for complex scripts.

**Wrapping and line breaking.** Phrases of 1-4 words; wraps inside the region.

**Upcoming, active and completed states.** Upcoming: hidden. Active: popped. Completed: hands off to the next phrase (existing).

**Masking and compositing.** None.

**Typography-driven motion.** Pop, hand-off, punch.

**Long lines.** More phrases.

**Short lines.** One giant word.

**Multiline compositions.** Stacked phrase rows.

**Instrumental and no-lyric states.** Cover pan.

**Portrait and landscape.** Portrait: tall crops, phrases stacked; landscape: wide crops.

## Scripts

| Script | Behaviour |
|---|---|
| English | All voices. |
| Hindi | Devanagari voice; no italic slant. |
| Tamil | Tamil voice; no italic. |
| Mixed | Per-run voice matching. |
| RTL | Phrase layouts mirror; Arabic voice. |
| CJK | Noto Sans CJK if added later; else system fallback (declared). |

**Fallback when a face lacks a script.** Noto Sans of the script at 900.

Shared rules (all styles) are in `phase-2/typography-system.md`: grapheme segmentation, no Latin tracking on complex scripts, no per-character transforms on Indic or Arabic, bidi by the browser text engine.
