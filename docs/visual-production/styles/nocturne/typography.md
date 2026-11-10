# Nocturne: typography

Style 7 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


## Typefaces

| Role | Face | Weights / axes | Scripts | Status |
|---|---|---|---|---|
| Quiet serif | Cormorant Garamond 300-500 and italic (bundled) | 300, 400, 500 | Latin, Cyrillic | bundled |
| Condensed serif | Instrument Serif (bundled) | 400 roman and italic | Latin | bundled |
| Thin sans | Inter Variable 300 (bundled) | 200-400 | Latin, Cyrillic, Greek | bundled |
| Hindi | Noto Serif Devanagari 300-500 (new); Noto Sans Devanagari 300 (bundled) | light weights | Devanagari | new and bundled |
| Tamil | Noto Serif Tamil (new); Noto Sans Tamil 300 (bundled) | light weights | Tamil | new and bundled |
| Arabic, Hebrew | Noto Naskh Arabic, Frank Ruhl Libre (new) | 400 | Arabic, Hebrew | new dependency |

**Sizes and responsive scaling.** Cap height 4.5-6% of frame height (landscape), 3.6-4.5% (portrait); single-word compositions up to 10%.

**Hierarchy.** Active line > light source > completed line > room.

**Word and line emphasis.** Word (authored): catches the light; line: focus resolve.

**Alignment and positioning.** Text placed where the light falls: left-aligned low, centred in a halo, or in the column; mirrored in RTL.

**Letter and line spacing.** Latin serif +1%; thin sans +2%; leading 1.5; complex scripts default spacing, leading 1.7 (taller scripts).

**Wrapping and line breaking.** Max 2 lines in light-pool compositions (balanced), unlimited in the column; word-boundary breaks for complex scripts.

**Upcoming, active and completed states.** Upcoming: only in the column (dim 25%). Active: lit. Completed: dims to 35% and drifts up 1% (column) or fades (pool).

**Masking and compositing.** Rain on glass never runs over the text box (refraction masked out around text).

**Typography-driven motion.** Focus pulls and light catches; no letter animation.

**Long lines.** Long lines: column composition or two balanced lines at smaller size (min cap height 3.6%).

**Short lines.** Short lines: single-word halo composition.

**Multiline compositions.** The second line sits under the lyric in italic at 60% size and 50% opacity.

**Instrumental and no-lyric states.** No text; the light performs.

**Portrait and landscape.** Portrait: light high, text low; the column fits naturally. Landscape: light on one side, text on the other.

## Scripts

| Script | Behaviour |
|---|---|
| English | All. |
| Hindi | Light weights of Noto Serif Devanagari; no italics (second line uses lower opacity instead); no tracking. |
| Tamil | As Hindi. |
| Mixed | Per run faces. |
| RTL | Mirrored placement; right-aligned. |
| CJK | System serif light weights. |

**Fallback when a face lacks a script.** Noto Sans light weights of the script.

Shared rules (all styles) are in `phase-2/typography-system.md`: grapheme segmentation, no Latin tracking on complex scripts, no per-character transforms on Indic or Arabic, bidi by the browser text engine.
