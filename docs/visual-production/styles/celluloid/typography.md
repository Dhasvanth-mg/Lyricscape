# Celluloid: typography

Style 5 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


## Typefaces

| Role | Face | Weights / axes | Scripts | Status |
|---|---|---|---|---|
| Backlit serif | Cormorant Garamond 500-600 (bundled), Instrument Serif (bundled) | roman and italic | Latin | bundled |
| Subtitle sans | Inter Variable 500 (bundled) | 500 with 0.06 em outline shadow | Latin, Cyrillic, Greek | bundled |
| Typewriter card | Special Elite (bundled) | 400 | Latin | bundled |
| Scratched hand | Permanent Marker (bundled) via stroke reveal and jitter | 400 | Latin | bundled |
| Hindi, Tamil serif | Noto Serif Devanagari, Noto Serif Tamil (new) | 500 | Devanagari, Tamil | new dependency |
| Hindi, Tamil subtitle | Noto Sans Devanagari, Noto Sans Tamil (bundled) | 500 | Devanagari, Tamil | bundled |
| Arabic, Hebrew | Noto Naskh Arabic, Frank Ruhl Libre (serif); Noto Sans Arabic and Hebrew (subtitle) (new) | 500 | Arabic, Hebrew | new dependency |

**Sizes and responsive scaling.** Subtitle cap height 3.8% of frame height (landscape), 3.2% (portrait), min 18 px at 390x844; title cards 8-14%; burst words up to 20%.

**Hierarchy.** Title or subtitle > image texture > damage.

**Word and line emphasis.** Word level (authored): backlit glow of the word, a scratch underline, a burst cut. Line level: title card vs subtitle.

**Alignment and positioning.** Subtitles centred lower third; title cards centred or optical-centre; scratch register freeform within the frame centre 70%.

**Letter and line spacing.** Backlit serif: +4% tracking for Latin titles (cinematic credit spacing); complex scripts none.

**Wrapping and line breaking.** Subtitle max 42 characters per line, 2 lines (cinema convention); split at phrase boundaries; complex scripts at word boundaries.

**Upcoming, active and completed states.** Upcoming: not shown. Active: lit. Completed: fades over 4 frames or cuts on the next line.

**Masking and compositing.** Backlit register: text as holes in a black card with light bleed (blur halo); scratch register: text scratched through black (white emulsion lines).

**Typography-driven motion.** Backlit assembly (letters drift into place over 1-2 s, Latin only; complex scripts fade as whole words), scratch jitter (per-frame offset 1-2 px at 12 fps), step-print smear on moves.

**Long lines.** Long lines: subtitle register; over 84 characters: two subtitle events split at the line's middle phrase.

**Short lines.** Short lines: centred title card, large.

**Multiline compositions.** The second line is a second subtitle line in italic (cinema translation convention).

**Instrumental and no-lyric states.** Leader, countdown, empty frames; no text.

**Portrait and landscape.** Portrait: letterbox becomes a centred 4:5 frame inside the 9:16 output with bars top and bottom (a film frame on a phone); subtitles inside the frame.

## Scripts

| Script | Behaviour |
|---|---|
| English | All registers. |
| Hindi | Subtitle and centred card registers; backlit assembly as whole-word fade; scratched hand register not available (falls back to typewriter-like card with the serif face); no tracking. |
| Tamil | As Hindi. |
| Mixed | Subtitles with mixed runs; title cards prefer the line's dominant script face. |
| RTL | Subtitles right-to-left with mirrored alignment (still centred); cards fine; scratched hand not available. |
| CJK | Subtitles and cards; vertical subtitles not used. |

**Fallback when a face lacks a script.** Missing serif for a script: Noto Sans of the script with the same register styling.

Shared rules (all styles) are in `phase-2/typography-system.md`: grapheme segmentation, no Latin tracking on complex scripts, no per-character transforms on Indic or Arabic, bidi by the browser text engine.
