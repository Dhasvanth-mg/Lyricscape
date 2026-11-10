# Signage: typography

Style 10 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


## Typefaces

| Role | Face | Weights / axes | Scripts | Status |
|---|---|---|---|---|
| Flap | Bebas Neue, Archivo Narrow cut (bundled) | 400-600 | Latin | bundled |
| Dot matrix | Bitmap dot fonts: Bedstead, GNU Unifont, Silkscreen (new) | bitmap | Latin, Greek, Cyrillic, Arabic, Hebrew, CJK (Unifont) | new dependency |
| Terminal | VT323 (new) | 400 | Latin | new dependency |
| Neon | Neon tube alphabets (handcrafted path data, this style) | tube | Latin script and block, Devanagari, Tamil, Arabic | new asset |
| Marquee | Bulb letter set (handcrafted, this style) and Anton for changeable letters | 400 | Latin | new asset and bundled |
| Indic flap | Noto Sans Devanagari / Tamil 600 (bundled) | 600 | Devanagari, Tamil | bundled |

**Sizes and responsive scaling.** Panel text cap height at least 4% of frame height; flap boards up to 4 rows of 24 characters.

**Hierarchy.** Panel lyric > sign's own fixed text > setting.

**Word and line emphasis.** Hooks get the brighter register; emphasised words light in the accent tube colour (neon) or invert (dot matrix).

**Alignment and positioning.** Hardware alignment: flap and dot rows left or centred; neon follows the sign design.

**Letter and line spacing.** Cell-locked for flap, dot and LED; neon tube spacing authored.

**Wrapping and line breaking.** Row-based wrap at word boundaries; overflow switches to ticker.

**Upcoming, active and completed states.** Upcoming: blank cells. Active: lit and settled. Completed: stays until the next update (boards hold).

**Masking and compositing.** Cells and tube masks.

**Typography-driven motion.** Flap cycling, bulb chase, neon flicker-on, dot refresh, ticker scroll.

**Long lines.** Ticker scroll or a taller board.

**Short lines.** One neon word or a marquee title.

**Multiline compositions.** Board rows.

**Instrumental and no-lyric states.** Departure break board.

**Portrait and landscape.** Portrait: vertical hotel blade signs and tall flap columns; landscape: wide boards and marquees.

## Scripts

| Script | Behaviour |
|---|---|
| English | All hardware. |
| Hindi | Flap cells hold whole aksharas (one cluster per flap); neon Devanagari alphabet; dot matrix not used (no open Devanagari dot font of quality): falls back to LED sign with Noto Sans. |
| Tamil | Flap cells per cluster; neon Tamil alphabet; dot matrix falls back to LED sign. |
| Mixed | Hardware chosen to support all scripts in the line (flap or LED sign); otherwise the line moves to an LED sign. |
| RTL | Flap and LED rows fill right to left; neon Arabic alphabet; Hebrew via Unifont dots. |
| CJK | Unifont 16x16 dots; flaps per character. |

**Fallback when a face lacks a script.** Any unsupported script: LED sign hardware with Noto Sans of the script.

Shared rules (all styles) are in `phase-2/typography-system.md`: grapheme segmentation, no Latin tracking on complex scripts, no per-character transforms on Indic or Arabic, bidi by the browser text engine.
