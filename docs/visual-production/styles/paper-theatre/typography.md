# Paper Theatre: typography

Style 3 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


## Typefaces

| Role | Face | Weights / axes | Scripts | Status |
|---|---|---|---|---|
| Cut letters (display) | DM Serif Display (bundled) or Archivo Variable 800 (bundled) | single weight; letter shapes cut as masks | Latin | bundled |
| Printed card | DM Serif Display, Instrument Serif (bundled) | 400 | Latin | bundled |
| Stamped caption | Special Elite (bundled) | 400 with stamp texture | Latin | bundled |
| Hindi and Tamil cards | Noto Serif Devanagari, Noto Serif Tamil (new) | 500-700 | Devanagari, Tamil | new dependency |
| Hindi and Tamil cut letters | Noto Sans Devanagari, Noto Sans Tamil (bundled) at 700 | 700 | Devanagari, Tamil | bundled |
| Arabic, Hebrew | Noto Naskh Arabic, Frank Ruhl Libre (new) | 500-700 | Arabic, Hebrew | new dependency |

**Sizes and responsive scaling.** Banner and card text cap height 5-7% of frame height (landscape), 4-5% (portrait, more lines); cut letters larger, 8-12%, max 3 words per cut line.

**Hierarchy.** Lyric on the brightest layer > focal figure > mid set > far set > frame.

**Word and line emphasis.** Word level (authored): a word is cut larger or its light brightens; line level: banner swing, a bird carries the card.

**Alignment and positioning.** Centred on the stage axis for banners and cards; cut letters follow the composition's light band (centred or lower third).

**Letter and line spacing.** Latin cut letters get +2% tracking (cut paper needs bridges); complex scripts: no added tracking.

**Wrapping and line breaking.** Max 2 lines per banner, 3 per card; break at phrase boundaries using a balanced-line algorithm; complex scripts only at word boundaries (Intl.Segmenter).

**Upcoming, active and completed states.** Upcoming: not shown. Active: card or banner lit. Completed: the card is pulled up on its strings (or the cut letters' light fades) at the next line start.

**Masking and compositing.** Cut letters are holes in a paper layer: the lyric is a mask through which the ground glow shows (the signature treatment).

**Typography-driven motion.** Cards drop on strings with a damped swing (2-3 oscillations, settles in 900 ms); cut letters brighten from behind; stamps land with a 60 ms squash (paper flexing, no rubbery bounce).

**Long lines.** Long lines: printed card (3 lines max) instead of cut letters; over 3 lines, split into two cards at a phrase boundary (second card replaces the first at the midpoint of the line's duration).

**Short lines.** Short lines: cut letters across the whole stage width.

**Multiline compositions.** The second line (translation or romanisation) is printed on a small card hung below the main banner.

**Instrumental and no-lyric states.** No card; the set and figures perform; a stamped caption can show the song title at a long break.

**Portrait and landscape.** Portrait: taller proscenium, cards stack vertically, set compositions use vertical arrangements (trees, towers, waves stacked). Landscape: wide stage.

## Scripts

| Script | Behaviour |
|---|---|
| English | All three treatments. |
| Hindi | Cut letters allowed as whole-word masks rendered from the shaped font (the headline bar of Devanagari makes cut paper look natural; bridges are not needed because the bar connects letters); no per-letter animation; printed card in Noto Serif Devanagari. |
| Tamil | Cut letters as whole-word masks; printed card in Noto Serif Tamil; long Tamil words get the card treatment more often (cut width limit). |
| Mixed | Each run in its own face on the same card; cut letters only when the whole line is one script. |
| RTL | Arabic and Hebrew on printed cards (right-aligned, banner strings mirrored); cut letters allowed for Hebrew; Arabic cut letters as whole-word masks with connected strokes. |
| CJK | Printed card with system CJK serif; cut letters allowed for short lines. |

**Fallback when a face lacks a script.** No serif face for the script: card falls back to the Noto Sans face for the script; cut letters always use a bold sans for unsupported scripts.

Shared rules (all styles) are in `phase-2/typography-system.md`: grapheme segmentation, no Latin tracking on complex scripts, no per-character transforms on Indic or Arabic, bidi by the browser text engine.
