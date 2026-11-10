# Screenlife: typography

Style 1 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


## Typefaces

| Role | Face | Weights / axes | Scripts | Status |
|---|---|---|---|---|
| Interface sans (chat, notes, notifications, search) | Inter Variable (bundled) | 400 body, 500 UI, 600 lyric in macro | Latin, Cyrillic, Greek | bundled, OFL |
| Interface mono (terminal, code editor) | JetBrains Mono Variable (bundled) | 500, 600 | Latin, Cyrillic, Greek | bundled, OFL |
| Document serif (draft document, mail) | Instrument Serif (bundled) | 400 roman and italic | Latin | bundled, OFL |
| Stylus handwriting (note sketches) | Caveat (new dependency, OFL; to confirm in Phase 3) | 500-700 variable | Latin, Cyrillic | not bundled |
| Devanagari UI | Noto Sans Devanagari Variable (bundled) | 400-600 | Devanagari (Hindi, Marathi) | bundled, OFL |
| Tamil UI | Noto Sans Tamil Variable (bundled) | 400-600 | Tamil | bundled, OFL |
| Arabic and Hebrew UI | Noto Sans Arabic, Noto Sans Hebrew (new dependencies, OFL) | 400-600 | Arabic, Hebrew | not bundled |
| CJK and Hangul UI | System CJK fallback via the font stack (no bundle) | system | Han, Kana, Hangul | system |

**Sizes and responsive scaling.** The lyric is set at the UI's own size (chat 17 px at device scale) and made legible by the camera: the camera frames the field so the lyric x-height is at least 2.2% of the output height in landscape, 1.8% in portrait, 2.6% on small mobile (390x844). Macro composition: x-height 4-6% of height.

**Hierarchy.** Lyric (active field or newest bubble) > earlier lyric bubbles (60% opacity through depth blur) > UI chrome (labels, timestamps, 40%) > environment.

**Word and line emphasis.** Word level (authored timing only): selection highlight sweep, bold toggle, autocorrect bubble, or mistype-and-fix. Line level: the send act, a reaction on the bubble, "edited" tag.

**Alignment and positioning.** Each kit defines it: outgoing bubbles right-aligned (left in RTL), notes and documents flush to the reading start edge, search centred field. The camera, not the text, centres the focal field.

**Letter and line spacing.** No added letter spacing ever (UI text is set at the font's default); line spacing per kit (chat 1.25, notes 1.4, document 1.5).

**Wrapping and line breaking.** The kit's own wrapping: bubbles max 72% of the device width; Latin breaks at spaces, CJK at characters (Intl.Segmenter grapheme and word), Devanagari and Tamil only at spaces or Intl.Segmenter word boundaries, never inside a grapheme cluster.

**Upcoming, active and completed states.** Upcoming: not shown (the person has not written it yet), except search suggestions that display the next line in grey after the current line is sent (only for authored or line-synced timing). Active: being typed with caret. Completed: sent bubble or saved line, dimming as it scrolls up.

**Masking and compositing.** None on the lyric. The device glass reflection plate sits above the UI at 3-8% and never over the active field.

**Typography-driven motion.** Typing (grapheme by grapheme), backspace bursts, selection sweeps, bubble send, scroll.

**Long lines.** Long lines wrap inside the bubble (up to 4 lines); beyond 4 lines the camera pulls back and the field scrolls; over 120 characters the line is split at a phrase boundary (comma, dash or the middle space) into two sends.

**Short lines.** Short lines (one or two words) get the macro composition or a big single-word bubble; never stretched.

**Multiline compositions.** Two-line lyric groups (from the second-line feature): the second line is set as a reply-quote under the bubble, or as the translator app's target field.

**Instrumental and no-lyric states.** No lyric: typing indicator dots, caret blink, notifications from metadata, lock screen.

**Portrait and landscape.** Landscape: phone tilted in a room, laptop and desktop families favoured. Portrait: phone face-on filling 92% of height; thread scroll native.

## Scripts

| Script | Behaviour |
|---|---|
| English | Full typing with typos and autocorrect. |
| Hindi | Typing by grapheme cluster (Intl.Segmenter granularity grapheme), never by code point, so matras and conjuncts never appear half-built. No typos, no letter spacing. Optional Hindi keyboard transliteration composition (romanised input turning into Devanagari) is a proposed extension, deferred to after Phase 3 core. |
| Tamil | Grapheme-cluster typing as for Hindi; Tamil words are long, so dictation chunking starts at 10 graphemes per second instead of 14 characters. |
| Mixed | Each run is shaped in its own font by the browser font stack; typing proceeds by grapheme across runs; selection emphasis applies to whole words only. |
| RTL | Arabic and Hebrew: kits mirror (outgoing bubbles on the left, caret at the left edge of the run); typing by grapheme in logical order; bidi handled by the browser text engine on the sheet canvas. Requires mirrored kit layouts (UIK states have an rtl flag). |
| CJK | Chinese, Japanese, Korean: character typing; IME composition underline shown for Japanese and Korean (proposed extension, deferred). |

**Fallback when a face lacks a script.** If the kit's face lacks the script, the run falls back through the stack: Inter -> Noto Sans Devanagari / Tamil / Arabic / Hebrew -> system. The kit never changes its layout when falling back; only the glyph source changes.

Shared rules (all styles) are in `phase-2/typography-system.md`: grapheme segmentation, no Latin tracking on complex scripts, no per-character transforms on Indic or Arabic, bidi by the browser text engine.
