# Sketch Cards: typography

Style 9 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


## Typefaces

| Role | Face | Weights / axes | Scripts | Status |
|---|---|---|---|---|
| Big | Anton (bundled), Bebas Neue (bundled), Bangers (bundled) | 400 | Latin | bundled |
| Mid | Permanent Marker (bundled), Special Elite (bundled) | 400 | Latin | bundled |
| Thin hand | Caveat (new), Cormorant Garamond, Instrument Serif (bundled) | 400-600 | Latin | new and bundled |
| Hindi hand | Kalam (new, OFL) | 300-700 | Devanagari, Latin | new dependency |
| Tamil hand | Kavivanar (new, OFL) | 400 | Tamil | new dependency |
| Hindi and Tamil big | Noto Sans Devanagari / Tamil 800-900 (bundled) | 800-900 | Devanagari, Tamil | bundled |
| Arabic, Hebrew | Noto Sans Arabic, Noto Sans Hebrew 700 (new) | 700 | Arabic, Hebrew | new dependency |

**Sizes and responsive scaling.** Card occupies 60-80% of frame height; big word cap height 25-35% of card height; thin lettering at least 3% of frame height.

**Hierarchy.** Big word > pill word > thin lettering > doodle > ground.

**Word and line emphasis.** Word (authored): the big word is chosen as the line's longest held word when authored timing exists, otherwise the longest word; pill box on the second most important word.

**Alignment and positioning.** Card layouts (existing) with corners, tilts and rotations per letter (Latin only).

**Letter and line spacing.** Latin per-letter jitter and rotation (big words); complex scripts none.

**Wrapping and line breaking.** Card layout solver (existing) with roles; complex scripts break at word boundaries only.

**Upcoming, active and completed states.** Upcoming: not shown. Active: the top card. Completed: buried in the pile (visible edge).

**Masking and compositing.** Riso misregistration offsets; marker texture fills.

**Typography-driven motion.** Scribble reveal by stroke, card drop.

**Long lines.** Receipt card (narrow, long) or two cards.

**Short lines.** One giant word poster card.

**Multiline compositions.** The second line in thin lettering at the card bottom.

**Instrumental and no-lyric states.** Creature break cards, title card.

**Portrait and landscape.** Portrait: tall cards (index card vertical, poster); landscape: card centred with ground visible.

## Scripts

| Script | Behaviour |
|---|---|
| English | Full: per-letter rotation and jitter, scribble reveal. |
| Hindi | No per-letter rotation (whole words); scribble reveal as whole-word wipe along the headline bar direction (left to right); Kalam for hand roles. |
| Tamil | Whole-word wipe; Kavivanar for hand roles; long words get the receipt card. |
| Mixed | Per-run faces; per-letter effects only on Latin runs. |
| RTL | Card layouts mirror; wipe right to left; no per-letter rotation for Arabic. |
| CJK | Per-character rotation allowed (small, 3 degrees). |

**Fallback when a face lacks a script.** No hand face for a script: Noto Sans of the script, regular weight, as the thin role.

Shared rules (all styles) are in `phase-2/typography-system.md`: grapheme segmentation, no Latin tracking on complex scripts, no per-character transforms on Indic or Arabic, bidi by the browser text engine.
