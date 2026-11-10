# Ink: design specification

Style 11 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


> Words written with a wet brush: ink pools, bleeds and blooms in water.

Origin: New style from Phase 1 research; absorbs the ink-in-water idea from Fluid directions. Phase 1 rank: 7 of 15.

Companion files: [typography](typography.md), [composition](composition.md), [motion](motion.md), [scene families](scene-families.md), [asset strategy](asset-strategy.md), [manifest](asset-manifest.json), [compatibility](compatibility.json), [review register](review-register.md).

## 1. Creative identity

**Artistic philosophy.** Gesture, breath and emptiness: as little ink as the song needs.

**Core visual concept.** Each line is brushed onto paper with a wet stroke that carries the word's timing; one painted element (a mountain, a branch, a wave, a streetlamp) sits in the empty part of the sheet; in the water register, black ink clouds bloom behind clean type.

**Emotional character.** Quiet, reflective, tender, sometimes fierce (heavy brush on hooks).

**Influences and references.** Ink-wash painting as a method of economy, ink in water, flow fields (research B.25, B.26, B.42).

**Distinguishing characteristics.** The stroke (start, speed, pressure, dry end) is the unit of motion; the only gesture-based style.

**Recurring motifs.** One element, a lot of paper; the dry-brush tail; the bloom; the wetted sheet dissolving.

**Intended density.** Very low: one element, one line, paper.

**Material and compositional language.** Rice paper, cotton rag, kraft, wet paper, water, ink.

**Musical contexts.** Ballads, ambient, folk, film score style songs, lo-fi, devotional and classical-influenced songs in many languages; heavy register for intense hooks.

**Constant across every variation.** Paper and ink only; one painted element; brushed reveal; emptiness at least half the frame.

**Why it is recognisable on any song.** A frame shows wet ink strokes and a lyric on a pale sheet with lots of empty space.

**It must never look like:**

- Fake chops, seals or signatures.
- Pseudo-Asian "brush" fonts for Latin text (kitsch).
- Faked calligraphy of scripts with real brush traditions.
- Cluttered sheets with several elements.
- Colour photographs.

## 2. Colour, lighting and materials

**Palette system.** Paper (warm white, cream, kraft, grey-blue, black) plus one ink (black, sepia, indigo, iron brown, white on black, cover tint) and an optional single accent (vermilion or the cover's hottest hue) used for one word per section.

**Accent behaviour.** At most one accent word per section.

**Contrast requirements.** Type ink at least 7:1 against paper; wash elements kept 30-70% density so they never compete.

**Lighting.** Flat diffuse; a faint raking light reveals paper fibres.

**Shadows.** None.

**Surface materials.** Paper fibre, wet edges, granulation.

**Texture system.** Paper fibre and granulation (shared paper fibre generator).

**Atmosphere.** Pale wash mist.

**Colour transitions.** Ink colour changes per section only on hard section breaks.

**Song-specific adaptation.** Ink and paper from identity (warm, cool, dark) and cover hue for the tint.

**Material and colour variation rules.** One ink plus at most one accent per frame.

## 3. Musical responsiveness

**Measured signals used.** Line and word times, word durations, gaps, hooks, beat grid.

**Estimates used (never treated as measured).** Estimated words, identity mood.

| Case | Behaviour |
|---|---|
| 1. Word-synchronised lyrics (authored word times) | Authored words: one stroke reveal per word whose speed fits the word's duration (long held notes brush slowly and pool at the end). |
| 2. Line-synchronised lyrics | Line-synced: the whole line brushed at a steady pace across the first 60% of the line. |
| 3. Estimated word timing | Steady pace across the first 60% of the line, no per-word claims. |
| 4. No reliable timestamps | Lines brushed every 4-5 s. |
| 5. Instrumental sections | The painted element grows (reserved growth strokes: a branch extends, rain falls, a wave rises); water register blooms. |
| 6. Missing audio analysis (no beat grid, no energy) | Growth on a fixed slow schedule; complete without beats. |

**Beat (only when present).** Beat grid in energetic songs: dry-brush flicks at downbeats near the element, never on the type.

**Energy and mood.** Energy chooses brush weight (light, normal, heavy) and stroke speed.

**Lyric density.** Dense lines: smaller type in a column, brushed at a faster pace; the element shrinks.

Styling never changes cue times: every behaviour above reads `lineAt()` and word times; nothing writes them.

## 4. Song-level progression

**Introduction.** Blank paper with water: a wet sheet, a first drop.

**Opening lines.** The first element is painted.

**Verses.** Light brush, one element per verse.

**Choruses.** Heavy brush, a bigger element, the accent word.

**Bridge.** Water register: ink clouds in water behind clean type.

**Instrumental breaks.** The element grows.

**Repeated lines.** The hook returns on the same sheet with the ink dried (darker, flatter) rather than wet.

**High-energy moments.** Heavy strokes, flicks, faster pace.

**Quiet moments.** Thin strokes, pale wash, one small element.

**Ending.** The sheet is full of the song's strokes and dries (wet sheen fades); a final pale wash.

**Fallback without structure.** No hooks: sheets change at gap sections.

**How scenes change.** The sheet accumulates within a section (earlier lines fade to pale wash); sections take a new sheet.

**Long-term interest.** Elements x papers x inks x register; each song's growth sequence differs.

## 5. Technical requirements

**Reuses.** Paper fibre (SHR-GEN), stroke reveal (SHR-GEN), noise fields and flow-field sampler for blooms, bundled serif fonts.

**New (proposed extensions, Phase 3).** Stroke reveal masks for glyphs (distance along skeleton), stroke records for elements, bloom sequences, wet spread shader, paper set, water register.

**Performance targets (targets until measured).** Target: GPU 0.9 ms; reveal masks computed per line on a worker (target under 6 ms per line, measured in the spike).

**Memory target.** Target: under 36 MB.

**Fallbacks.** Canvas 2D tier: reveal by clip-path wipe in reading direction; static spread.

**Export.** Reveal and spread are functions of time since the word start.

## 6. Quality evaluation

Stroke reveal spike (gate) on 4 scripts; cultural review (no costume) on all elements; empty-space measurement (55% rule) on golden frames; Hindi and Tamil reveal reviewed by native readers.

## 7. Definition of finished (Phase 3)

- [ ] Stroke reveal spike passed
- [ ] Elements produced and reviewed
- [ ] Water register works
- [ ] Native-reader review for Indic reveal
- [ ] Golden frames

## 8. The twenty planning questions

**1. What does the style look like?** Each line is brushed onto paper with a wet stroke that carries the word's timing; one painted element (a mountain, a branch, a wave, a streetlamp) sits in the empty part of the sheet; in the water register, black ink clouds bloom behind clean type.

**2. What makes it distinct?** The stroke (start, speed, pressure, dry end) is the unit of motion; the only gesture-based style.

**3. What composition families does it contain?** C1 Element and column; C2 Single word; C3 Water register; C4 Landscape scroll; C5 Fragment. Scene families: Mountains; Branch; Rain; Sea; Ink in water; Night sheet; City in ink; Heavy brush; Garden; Figure; Drying sheet. Details in composition.md and scene-families.md.

**4. What are its typography rules?** Large brushed word > small column > element > paper. Emphasis: The line's longest-held word (authored) or longest word becomes the large word; the accent colour goes on one word per section. Spacing: Generous tracking for small text (+20); none for complex scripts. Full rules in typography.md.

**5. How does it animate?** One stroke at a time, with acceleration and a dry tail; ink keeps moving after the hand stops (spread, bleed). Stroke 150-900 ms by word duration; spread 300-1200 ms; dry 2-4 s.

**6. How does it respond to lyrics and music?** Authored words: Authored words: one stroke reveal per word whose speed fits the word's duration (long held notes brush slowly and pool at the end). Lines: Line-synced: the whole line brushed at a steady pace across the first 60% of the line. No beat grid: Growth on a fixed slow schedule; complete without beats.

**7. What exact assets must be produced?** 188 entries in asset-manifest.json across 15 asset families plus composition, scene and transition specs: Landscape elements (16); Botanical elements (20); Sky and weather elements (12); Figures and creatures (16); Objects (18); Brush stroke library (20); Brush types (7); Papers (10); Ink colours (8); Bloom and bleed (10); Water register sequences (6); Stroke reveal data (7); Stroke dynamics profiles (6); Sheet layouts (8); Paper transitions (4).

**8. Why does each asset exist?** Each family's purpose: Landscape elements: Distance and openness. Botanical elements: Seasons, love and growth (best for breaks: growth strokes). Sky and weather elements: Mood and time. Figures and creatures: A small human or animal presence; always small, always anonymous. Objects: Modern and everyday subjects in ink so the style is not tied to tradition. Brush stroke library: Strokes for the heavy register, flicks and lettering accents. The rest in asset-strategy.md; each manifest entry carries its own purpose.

**9. Which assets are redundant?** 13 candidates were rejected or merged during review: Mountain range repeat (merged: Too close to Layered mountains.); Volcano (rejected: Too literal for the style.); Plum and bamboo pairing (rejected: Cliché pairing; each exists separately.); Cherry blossom tree (merged: A full tree breaks the emptiness rule; Blossom branch serves.); Dragon (rejected: Cultural costume.); Geisha (rejected: Cultural costume and stereotype.); Monk meditating (rejected: Cultural costume.); Closed circle gesture (merged: Reads as a specific Zen emblem; the open circle gesture is kept.) ...see review-register.md.

**10. How do assets combine?** Layer order: paper > paper fibre and granulation > pale wash layer > painted element strokes > dried previous lines (pale) > active line stroke reveal > wet spread > post: grain. Required: Paper, ink colour, lettering with reveal.

**11. Which combinations are invalid?** Brush-style fake calligraphy font with any Latin line (Kitsch.); Stroke-order reveal with scripts without skeleton data (Fake stroke order.); Flicks with reduced motion (Motion rule.); Two large elements with any (Emptiness rule.); Accent colour with more than one word per section (Accent rule.); Dry-brush heavy with devotional identity (Tone.)

**12. How do scenes vary meaningfully?** Major dimensions: Element family (landscape, botany, sky, figure, object, abstract); Paper; Ink colour; Register (paper or water); Brush weight; Composition. Not counted as variation: Recoloured elements; mirrored elements; scaled elements; growth stages of one element.

**13. How is repetition prevented?** An element at most once per section and twice per song; papers max 3 per song; water register max once per song.

**14. How do scenes evolve throughout a song?** The sheet accumulates within a section (earlier lines fade to pale wash); sections take a new sheet. Heavy brush, a bigger element, the accent word.

**15. How does the style adapt to different screen sizes?** Element and column: portrait Element top, column bottom. Single word: portrait Word 80% width. Water register: portrait Clouds rise. All families in composition.md.

**16. How does it handle different languages?** Hindi: Reveal along the strokes computed from the skeleton, with the headline bar (shirorekha) drawn last as one stroke; Noto Serif Devanagari. Tamil: Skeleton-based reveal; Noto Serif Tamil. Mixed: Per-run faces; reveal per run in reading order. RTL: Arabic reveal right to left along the baseline joins (Naskh); Hebrew right to left. Fallback: Any script without reliable skeleton data: generic reading-direction wipe with a brush-textured edge (no fake stroke order).

**17. What technical infrastructure does it require?** Stroke reveal masks for glyphs (distance along skeleton), stroke records for elements, bloom sequences, wet spread shader, paper set, water register. Reuses: Paper fibre (SHR-GEN), stroke reveal (SHR-GEN), noise fields and flow-field sampler for blooms, bundled serif fonts.

**18. What performance constraints apply?** Target: GPU 0.9 ms; reveal masks computed per line on a worker (target under 6 ms per line, measured in the spike). Target: under 36 MB.

**19. How will production quality be evaluated?** Stroke reveal spike (gate) on 4 scripts; cultural review (no costume) on all elements; empty-space measurement (55% rule) on golden frames; Hindi and Tamil reveal reviewed by native readers.

**20. What must be completed before the style is considered finished?** Stroke reveal spike passed; Elements produced and reviewed; Water register works; Native-reader review for Indic reveal; Golden frames.
