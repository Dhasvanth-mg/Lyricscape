# Panels: typography

Style 12 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


## Typefaces

| Role | Face | Weights / axes | Scripts | Status |
|---|---|---|---|---|
| Lettering | Comic Neue (new, OFL) | 400-700 | Latin | new dependency |
| SFX | Bangers (bundled), Anton (bundled) | 400 | Latin | bundled |
| Caption | Special Elite (bundled), Archivo (bundled) | 400-600 | Latin | bundled |
| Devanagari lettering | Kalam (new) | 400-700 | Devanagari | new dependency |
| Tamil lettering | Kavivanar (new) | 400 | Tamil | new dependency |
| Arabic, Hebrew | Noto Sans Arabic, Noto Sans Hebrew (new) | 500-700 | Arabic, Hebrew | new dependency |

**Sizes and responsive scaling.** Balloon text at least 3.2% of frame height; SFX 12-25% of panel height.

**Hierarchy.** Active balloon > SFX > caption > panel art > other panels.

**Word and line emphasis.** Bold lettering for stressed words (authored long words); SFX on the hook's shortest loud word.

**Alignment and positioning.** Centred in balloons; captions left.

**Letter and line spacing.** Lettering tight leading (1.1).

**Wrapping and line breaking.** Balloon shape fitted to the text (balloon solver).

**Upcoming, active and completed states.** Upcoming: empty balloon zone. Active: balloon and lit panel. Completed: panel dims to 70%, balloon stays.

**Masking and compositing.** Panel frames clip art.

**Typography-driven motion.** Balloon pop-in, word-by-word fill.

**Long lines.** Two balloons with a connector, or caption plus balloon.

**Short lines.** SFX lettering alone.

**Multiline compositions.** Stacked balloons.

**Instrumental and no-lyric states.** Wordless panels.

**Portrait and landscape.** Portrait: vertical page (webtoon-like strip scroll); landscape: two-page spread with the active page centred.

## Scripts

| Script | Behaviour |
|---|---|
| English | Full lettering and SFX. |
| Hindi | Kalam lettering in balloons; SFX in Noto Sans Devanagari Black without distortion (no letter stretch). |
| Tamil | Kavivanar lettering; SFX in Noto Sans Tamil Black without distortion. |
| Mixed | Per-run faces in one balloon. |
| RTL | Page reads right to left: panel order and balloon tails mirror; Arabic and Hebrew lettering. |
| CJK | Vertical balloons for Japanese (speculative, Phase 3 review). |

**Fallback when a face lacks a script.** Script without a lettering face: Noto Sans of the script in balloons; no SFX distortion.

Shared rules (all styles) are in `phase-2/typography-system.md`: grapheme segmentation, no Latin tracking on complex scripts, no per-character transforms on Indic or Arabic, bidi by the browser text engine.
