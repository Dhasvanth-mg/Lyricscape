# Monument: typography

Style 15 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


## Typefaces

| Role | Face | Weights / axes | Scripts | Status |
|---|---|---|---|---|
| Façade | Archivo Black, Anton (bundled) | 900 | Latin | bundled |
| Slab façade | Bebas Neue (bundled) on slab blocks | 400 | Latin | bundled |
| Devanagari façade | Noto Sans Devanagari 900 via sprite stack | 900 | Devanagari | bundled |
| Tamil façade | Noto Sans Tamil 900 via sprite stack | 900 | Tamil | bundled |
| Arabic, Hebrew façade | Noto Sans Arabic, Hebrew 800 via sprite stack | 800 | Arabic, Hebrew | new dependency |

**Sizes and responsive scaling.** Active façade cap height at least 8% of frame height at its viewing distance.

**Hierarchy.** Active façade > previous façade > city.

**Word and line emphasis.** Hooks: monumental scale and the lit face.

**Alignment and positioning.** Façade faces the camera within 15 degrees at its reading moment.

**Letter and line spacing.** Block spacing per word.

**Wrapping and line breaking.** Long lines become a wall the camera walks along.

**Upcoming, active and completed states.** Upcoming: below ground. Active: risen and lit. Completed: part of the city, unlit.

**Masking and compositing.** None.

**Typography-driven motion.** Rise from the ground.

**Long lines.** Wall walk.

**Short lines.** Single monumental word.

**Multiline compositions.** Two-storey façade.

**Instrumental and no-lyric states.** Flythrough.

**Portrait and landscape.** Portrait: taller façades, words stacked as storeys.

## Scripts

| Script | Behaviour |
|---|---|
| English | Mesh extrusion or sprite stack. |
| Hindi | Sprite stack only (shaped text rendered by the browser into layers): correct shaping, no mesh extrusion. |
| Tamil | Sprite stack only. |
| Mixed | Sprite stack for the whole line when any complex run exists. |
| RTL | Sprite stack; reading order right to left along walls. |
| CJK | Sprite stack. |

**Fallback when a face lacks a script.** Sprite stack for any script; mesh extrusion is a Latin-only enhancement.

Shared rules (all styles) are in `phase-2/typography-system.md`: grapheme segmentation, no Latin tracking on complex scripts, no per-character transforms on Indic or Arabic, bidi by the browser text engine.
