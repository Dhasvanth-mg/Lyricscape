# Cover Pop: design specification

Style 14 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


> The album cover is the stage: full-bleed, undimmed, with hot phrases taken from its colours.

Origin: Cover Pop (existing) kept and widened; absorbs Maximalist's burst. Phase 1 rank: 14 of 15 (song-specific).

Companion files: [typography](typography.md), [composition](composition.md), [motion](motion.md), [scene families](scene-families.md), [asset strategy](asset-strategy.md), [manifest](asset-manifest.json), [compatibility](compatibility.json), [review register](review-register.md).

## 1. Creative identity

**Artistic philosophy.** The song's own image, celebrated.

**Core visual concept.** The cover fills the frame without dimming. Lyrics arrive in short phrases in a hot colour taken from what is behind each word, with a chip on the heaviest word and annotation stickers. The camera crops and pans across the cover so one image becomes many compositions; choruses return to the full cover with a burst.

**Emotional character.** Bright, confident, fan-like, celebratory.

**Influences and references.** The existing Cover Pop direction; fan edits and lyric posters (method only).

**Distinguishing characteristics.** The only style that puts the song's own artwork first; per-song identity comes from the cover itself.

**Recurring motifs.** Full-bleed cover, hot phrase colour, white chip, stickers, the chorus burst, crop and pan.

**Intended density.** Medium: cover plus 1-4 words.

**Material and compositional language.** The cover art itself; flat vector stickers.

**Musical contexts.** Pop, K-pop, hip-hop, dance, any song with a strong cover.

**Constant across every variation.** The cover is shown undimmed and unmodified (only cropped and scaled); phrases are short; colours come from the art.

**Why it is recognisable on any song.** A frame shows the song's cover full-bleed with a hot phrase and a chip.

**It must never look like:**

- Darkening, blurring, recolouring or distorting the cover (artwork rules: unmodified).
- Long lines in one phrase.
- More than two stickers.
- Copying a specific music app's lyric view.
- Text over faces in the cover (saliency avoids them where detectable; no face recognition).

## 2. Colour, lighting and materials

**Palette system.** Taken from the cover: per-word colour chosen from what is behind the word (existing) with a hot colour family; chips white or inverted.

**Accent behaviour.** The chip word.

**Contrast requirements.** Every word at least 4.5:1 against the pixels behind it (existing per-word choice, tested); fallback is a white word with a thin dark outline.

**Lighting.** None added (cover unmodified).

**Shadows.** Soft word shadow only where contrast needs it.

**Surface materials.** Cover pixels.

**Texture system.** None added.

**Atmosphere.** None.

**Colour transitions.** Colour follows the crop.

**Song-specific adaptation.** Fully cover-driven; fallback covers generated from the palette when the cover is missing or text-only.

**Material and colour variation rules.** One hot family per section.

## 3. Musical responsiveness

**Measured signals used.** Word times, line times, gaps, hooks.

**Estimates used (never treated as measured).** Estimated words.

| Case | Behaviour |
|---|---|
| 1. Word-synchronised lyrics (authored word times) | Authored words: phrases split at word times (existing, honest), each phrase pops on its first word. |
| 2. Line-synchronised lyrics | Line-synced: one phrase per line (no split), pops on the line start. |
| 3. Estimated word timing | No phrase splits (whole line as one phrase). |
| 4. No reliable timestamps | Lines every 4 s. |
| 5. Instrumental sections | The cover breathes (slow push), pans across, a sticker drifts. |
| 6. Missing audio analysis (no beat grid, no energy) | Pan speed fixed; complete without beats. |

**Beat (only when present).** Beat grid: chorus bursts on downbeats; phrase pops land on beats when within 80 ms.

**Energy and mood.** Energy picks the type voice and motion (punch for high, slide for low).

**Lyric density.** Dense lines: phrases of 2-3 words, more hand-offs.

Styling never changes cue times: every behaviour above reads `lineAt()` and word times; nothing writes them.

## 4. Song-level progression

**Introduction.** The full cover, still.

**Opening lines.** First phrase.

**Verses.** Crops of the cover; phrases placed in the emptiest regions.

**Choruses.** The full cover again with a burst and the chip on the hook.

**Bridge.** A different type voice and a deep crop (detail of the cover).

**Instrumental breaks.** Pan and breathe.

**Repeated lines.** Each chorus uses a different crop path.

**High-energy moments.** Bursts, punches.

**Quiet moments.** Slow drift, single words.

**Ending.** The cover recedes to a framed square on its own colour.

**Fallback without structure.** No hooks: crops change at gap sections.

**How scenes change.** Crop path explores the whole cover across the song.

**Long-term interest.** The cover makes each song different; voices, crops and layouts keep one cover varied.

## 5. Technical requirements

**Reuses.** Existing Cover Pop renderer (Canvas), per-word colour choice, phrase hand-offs, icons, extractPalette, mono background.

**New (proposed extensions, Phase 3).** GPU port, saliency regions beyond the 48x48 sample (edge density and colour variance), crop path planner, cut-out sticker generator, type voice switch, burst shapes, fallback stage generator.

**Performance targets (targets until measured).** Target: GPU 0.6 ms; saliency computed once per cover (under 30 ms on a worker).

**Memory target.** Target: under 20 MB.

**Fallbacks.** Canvas 2D tier: full parity (exists).

**Export.** Crop path a function of time; cover pixels unchanged.

## 6. Quality evaluation

Contrast test of per-word colour on 50 covers (light, dark, busy, flat, text-only); artwork rule check (no pixel modification); saliency placement review; fallback stage test for missing covers; script tests.

## 7. Definition of finished (Phase 3)

- [ ] GPU port matches Canvas
- [ ] Saliency placement reviewed on 50 covers
- [ ] Type voices approved
- [ ] Fallback stage works
- [ ] Golden frames

## 8. The twenty planning questions

**1. What does the style look like?** The cover fills the frame without dimming. Lyrics arrive in short phrases in a hot colour taken from what is behind each word, with a chip on the heaviest word and annotation stickers. The camera crops and pans across the cover so one image becomes many compositions; choruses return to the full cover with a burst.

**2. What makes it distinct?** The only style that puts the song's own artwork first; per-song identity comes from the cover itself.

**3. What composition families does it contain?** C1 Full cover phrase; C2 Crop detail; C3 Giant word; C4 Colour field and cover; C5 Sticker collage. Scene families: Full stage; Detail tour; Burst hook; Side field; Collage; Slow breathe; No-cover stage; Framed ending. Details in composition.md and scene-families.md.

**4. What are its typography rules?** Chip word > phrase > stickers > cover. Emphasis: Chip on the heaviest word (existing emphasis). Spacing: Tight (-0.02 em) Latin; normal for complex scripts. Full rules in typography.md.

**5. How does it animate?** Bouncy and readable: things pop and settle; the cover moves slowly underneath. Pop 140-200 ms; hand-off 220 ms; crop move 6-12 s.

**6. How does it respond to lyrics and music?** Authored words: Authored words: phrases split at word times (existing, honest), each phrase pops on its first word. Lines: Line-synced: one phrase per line (no split), pops on the line start. No beat grid: Pan speed fixed; complete without beats.

**7. What exact assets must be produced?** 172 entries in asset-manifest.json across 12 asset families plus composition, scene and transition specs: Type voices (9); Icons (existing) (45); Annotation stickers (36); Cover cut-out generator (4); Crop and pan paths (12); Burst shapes (8); Phrase layouts (14); Chip styles (6); Colour pickers (5); Cover analysis (4); Fallback stages (5); Phrase motions (7).

**8. Why does each asset exist?** Each family's purpose: Type voices: One cover, several voices: Phase 1 asked for two or three more than Nunito. Icons (existing): Word-linked marks (WORD_ICON lexicon). Annotation stickers: Hand-placed marks that point at, circle and celebrate words (new; the icons are nouns, these are gestures). Cover cut-out generator: Stickers that belong to the cover's world, made from it (no pixel modification beyond cropping). Crop and pan paths: One cover becomes many compositions. Burst shapes: Chorus energy. The rest in asset-strategy.md; each manifest entry carries its own purpose.

**9. Which assets are redundant?** 7 candidates were rejected or merged during review: Graffiti voice (rejected: Overlaps Sketch Cards' street register and hurts readability.); Emoji faces (rejected: Emoji clip-art is excluded.); Second heart (merged: Duplicate of the heart icon.); Rotation (rejected: Modifies the artwork presentation beyond crop and scale.); Words on an arc (rejected: Readability on phones; Folio covers display type.); Mirror tiles (rejected: Modifies the artwork (not allowed).); Blurred cover backdrop (rejected: Modifies the artwork; Nocturne and others use blur, this style must not.)

**10. How do assets combine?** Layer order: colour field (where the cover does not fill) > cover (unmodified, cropped and scaled only) > burst > cut-out stickers > phrase > chip > annotation stickers. Required: Cover or fallback stage, phrase, voice.

**11. Which combinations are invalid?** Cover blur or dim with any (Artwork rule.); Italic with complex scripts (Shaping.); Playful stickers with grief identity (Tone.); Burst with reduced motion (Motion rule.); Phrase over 4 words with any (Readability: split.); Cut-out stickers with covers under 600 px (Quality.)

**12. How do scenes vary meaningfully?** Major dimensions: The cover itself; Composition (full, crop, giant, field, collage); Type voice; Crop path; Phrase layout. Not counted as variation: The 10 existing icon treatments (renderer variations of the 45 icons); recoloured stickers; mirrored layouts.

**13. How is repetition prevented?** Crop paths not repeated within a song; layouts not identical on consecutive phrases; stickers at most once per section.

**14. How do scenes evolve throughout a song?** Crop path explores the whole cover across the song. The full cover again with a burst and the chip on the hook.

**15. How does the style adapt to different screen sizes?** Full cover phrase: portrait Cover fit to width, colour field above and below with phrases in the field. Crop detail: portrait Tall crop. Giant word: portrait Word 90% width. All families in composition.md.

**16. How does it handle different languages?** Hindi: Devanagari voice; no italic slant. Tamil: Tamil voice; no italic. Mixed: Per-run voice matching. RTL: Phrase layouts mirror; Arabic voice. Fallback: Noto Sans of the script at 900.

**17. What technical infrastructure does it require?** GPU port, saliency regions beyond the 48x48 sample (edge density and colour variance), crop path planner, cut-out sticker generator, type voice switch, burst shapes, fallback stage generator. Reuses: Existing Cover Pop renderer (Canvas), per-word colour choice, phrase hand-offs, icons, extractPalette, mono background.

**18. What performance constraints apply?** Target: GPU 0.6 ms; saliency computed once per cover (under 30 ms on a worker). Target: under 20 MB.

**19. How will production quality be evaluated?** Contrast test of per-word colour on 50 covers (light, dark, busy, flat, text-only); artwork rule check (no pixel modification); saliency placement review; fallback stage test for missing covers; script tests.

**20. What must be completed before the style is considered finished?** GPU port matches Canvas; Saliency placement reviewed on 50 covers; Type voices approved; Fallback stage works; Golden frames.
