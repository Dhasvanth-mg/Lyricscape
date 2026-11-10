# Sketch Cards: design specification

Style 9 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


> One hand-made card per line, dropped like cue cards.

Origin: Sketch cards (Turbo) kept and refined; absorbs Notebook (classic) and Acid grain's creature cast. Phase 1 rank: 4 of 15 (Phase 1 score 8.05).

Companion files: [typography](typography.md), [composition](composition.md), [motion](motion.md), [scene families](scene-families.md), [asset strategy](asset-strategy.md), [manifest](asset-manifest.json), [compatibility](compatibility.json), [review register](review-register.md).

## 1. Creative identity

**Artistic philosophy.** DIY charm with real typographic hierarchy. Each line is a small poster made by hand, fast.

**Core visual concept.** Every line is a hand-made card: one huge word, one boxed word, the rest in thin hand lettering, plus a doodle, in a paint-program or print process. Cards drop onto a ground (a desk, a wall, a floor, a hand), pile up across the song, and the pile is the ending.

**Emotional character.** Playful, personal, warm, cheeky; capable of rawness in the dark register.

**Influences and references.** Cue cards, zines, riso prints, notebooks, the existing Sketch cards and art library.

**Distinguishing characteristics.** Per-line poster composition and hard cuts: the only "cut" style, the most personable.

**Recurring motifs.** Big/mid/thin hierarchy; doodles; tape and pins; the pile; the hand holding a card; marker texture.

**Intended density.** Medium: one card with 3-6 elements.

**Material and compositional language.** Card stock, napkins, sticky notes, receipts, notebook pages, marker, crayon, riso ink, photocopy toner.

**Musical contexts.** Pop, indie, hip-hop, K-pop, Bollywood pop, comedic songs, singer-songwriter; dark register for emo, grief, angry songs.

**Constant across every variation.** One card per line; the big/mid/thin hierarchy; hand-made print processes; cards stay rigid objects.

**Why it is recognisable on any song.** A frame shows a hand-made card with a big word and a doodle on a surface.

**It must never look like:**

- Clip-art or emoji stickers.
- Panels-style sequences of frames (that is Panels).
- Uniform vector perfection.
- Cute drawings on grief songs.
- The same card frame repeated every line.

## 2. Colour, lighting and materials

**Palette system.** Card colour sets from the song (existing paperSet and song hues): paper, ink, accent, pill colour; print processes impose limits (riso: two inks; photocopy: black on grey-white; paint dither: 16-colour palette quantised from the song set).

**Accent behaviour.** The boxed (pill) word carries the accent; doodle accent matches.

**Contrast requirements.** Big word 7:1 against the card; thin lettering 4.5:1.

**Lighting.** Ground lighting soft from top-left; cards cast soft shadows (4-8 px) on the ground.

**Shadows.** Card drop shadow; tape shadow.

**Surface materials.** Card, paper, tape, pins.

**Texture system.** Print process textures (riso grain, toner speckle, marker streaks, crayon tooth).

**Atmosphere.** None.

**Colour transitions.** Colour set changes per section (new card stack).

**Song-specific adaptation.** Existing song hues and paper sets; identity selects cute or dark register.

**Material and colour variation rules.** Max 3 colours per card plus paper (riso max 2).

## 3. Musical responsiveness

**Measured signals used.** Line and word times, gaps, hooks, beat grid.

**Estimates used (never treated as measured).** Estimated words, identity mood.

| Case | Behaviour |
|---|---|
| 1. Word-synchronised lyrics (authored word times) | Authored words scribble in on cue (marker stroke reveal per word, 120-250 ms). |
| 2. Line-synchronised lyrics | The card drops on the line start with all words present, or words scribble in evenly across the first 40% of the line. |
| 3. Estimated word timing | Left-to-right scribble across the first 40% of the line, no per-word timing claims. |
| 4. No reliable timestamps | Cards change every 4 s with the lyric split into card-sized phrases; the pile grows. |
| 5. Instrumental sections | Drawings animate: creatures dance on the desk (Acid choreography absorbed), tied to line rate or beat; after 10 s a "break card" with the song title. |
| 6. Missing audio analysis (no beat grid, no energy) | Creatures dance on a fixed slow tempo-free loop; complete without beats. |

**Beat (only when present).** Beat grid: creatures dance on beats; the held card sways on bars.

**Energy and mood.** Energy chooses card drop speed and creature activity.

**Lyric density.** Dense lines: two cards for one line (split at a phrase) or a receipt card (long narrow).

Styling never changes cue times: every behaviour above reads `lineAt()` and word times; nothing writes them.

## 4. Song-level progression

**Introduction.** An empty ground (desk, wall) with tools (marker, tape); the first card is placed at the lead-in.

**Opening lines.** First card dropped.

**Verses.** One ground; cards pile up line by line (each new card on top, older cards offset beneath).

**Choruses.** Bigger poster cards; the hook card returns with wear on repeats.

**Bridge.** Ground changes (desk to wall or floor) or print process changes (marker to riso).

**Instrumental breaks.** Creatures dance; title card.

**Repeated lines.** The same card returns (worn: creases, coffee ring) rather than a new design.

**High-energy moments.** Fast drops, held-card sway on beats, sticky notes cluster.

**Quiet moments.** Slow placement, one card on an empty desk.

**Ending.** The camera pulls back to show the whole pile (or the wall of pinned cards): the song's cards as one image.

**Fallback without structure.** No hooks: grounds change at gap sections.

**How scenes change.** Accumulating pile per ground; the pile is the song's memory.

**Long-term interest.** Card types x grounds x print processes x 230 drawings; song hues make each song's pile different.

## 5. Technical requirements

**Reuses.** sketch.ts card layout solver and roles, art library generators, doodles, border kinds, font sets, paperSet, Acid creature choreography.

**New (proposed extensions, Phase 3).** Card types as card-shape masks and paper textures, grounds as plates, pile baking (older cards into one texture), hand holder rig, print process passes (riso, photocopy, dither), dark register drawings, warm-up painting (V9: paint the next card during the current line).

**Performance targets (targets until measured).** Target: GPU 1.2 ms; card paint under 8 ms done one line ahead (V9 measured in Phase 3).

**Memory target.** Target: under 32 MB (card sheets, pile texture, grounds).

**Fallbacks.** Canvas 2D tier: full parity (cards are canvas paintings).

**Export.** Card painting is deterministic per line; pile computed from line index.

## 6. Quality evaluation

Card hierarchy review on 50 random lines; dark register review on 5 dark songs; card variety test (no identical card type and border on consecutive lines); script review for Hindi and Tamil cards (Kalam, Kavivanar).

## 7. Definition of finished (Phase 3)

- [ ] Card types, grounds and processes produced
- [ ] Dark register drawings complete
- [ ] Pile and pull-back ending work
- [ ] V9 card warm-up measured
- [ ] Golden frames

## 8. The twenty planning questions

**1. What does the style look like?** Every line is a hand-made card: one huge word, one boxed word, the rest in thin hand lettering, plus a doodle, in a paint-program or print process. Cards drop onto a ground (a desk, a wall, a floor, a hand), pile up across the song, and the pile is the ending.

**2. What makes it distinct?** Per-line poster composition and hard cuts: the only "cut" style, the most personable.

**3. What composition families does it contain?** C1 Card on a surface; C2 Held cue card; C3 The pile; C4 Pinned wall; C5 Full-bleed poster; C6 Sticky notes cluster. Scene families: Desk at night; Kitchen table; Bedroom wall; Street wall; Notebook pages; Cue cards in hand; Corkboard; Sticky note wall; Riso studio; Creature break; Floor scatter; Dark sketchbook. Details in composition.md and scene-families.md.

**4. What are its typography rules?** Big word > pill word > thin lettering > doodle > ground. Emphasis: Word (authored): the big word is chosen as the line's longest held word when authored timing exists, otherwise the longest word; pill box on the second most important word. Spacing: Latin per-letter jitter and rotation (big words); complex scripts none. Full rules in typography.md.

**5. How does it animate?** Hard cuts and card drops: a new card lands on top, the old one slides under. Drops 280-420 ms; scribble 120-250 ms per word; cuts on line starts.

**6. How does it respond to lyrics and music?** Authored words: Authored words scribble in on cue (marker stroke reveal per word, 120-250 ms). Lines: The card drops on the line start with all words present, or words scribble in evenly across the first 40% of the line. No beat grid: Creatures dance on a fixed slow tempo-free loop; complete without beats.

**7. What exact assets must be produced?** 228 entries in asset-manifest.json across 14 asset families plus composition, scene and transition specs: Card types (14); Grounds (11); Sketch doodles (existing) (24); Art library generators (existing) (14); Dark register drawings (40); Everyday object drawings (40); Creature choreographies (from Acid) (10); Hands (5); Print processes (7); Font sets (existing) (12); Pill kinds (existing) (5); Big word treatments (existing) (5); Borders (existing) (12); Desk tools (6).

**8. Why does each asset exist?** Each family's purpose: Card types: The card type changes the object and the layout space. Grounds: Place and the pile's home. Sketch doodles (existing): The existing hand-made sketch drawings kept as the cute register. Art library generators (existing): Variety of small drawings; reclassified in Phase 2 as 14 generators, not 346 originals. Dark register drawings: Lets the style serve grief, anger and rawness (Phase 1 risk: cuteness ceiling). Everyday object drawings: Personal, specific objects that make cards feel like a life (new; the art library is mostly generic). The rest in asset-strategy.md; each manifest entry carries its own purpose.

**9. Which assets are redundant?** 2 candidates were rejected or merged during review: Chalkboard (rejected: School cliché; overlaps the dark sketchbook register.); Phone notes app (rejected: Screenlife territory.)

**10. How do assets combine?** Layer order: ground surface > tools and props at the edges > pile (baked) > top card paper (card type) > print process texture > doodle drawing > lettering (big, pill, thin) > tape and pins > hand (held scenes) > post: soft shadow, light gradient. Required: Ground, card type, print process, lettering roles.

**11. Which combinations are invalid?** Cute drawings with grief or dark identity (Tone.); Dark register with cute colour sets (Tone.); Per-letter rotation with complex scripts (Shaping.); Sticky notes with long lines over 8 words without splitting (Unreadable.); Creature dance with reduced motion (Motion rule.); Panel sequences with any (Panels territory.)

**12. How do scenes vary meaningfully?** Major dimensions: Ground (scene family); Card type; Print process; Composition (surface, held, pile, wall, poster, notes); Drawing register (cute, everyday, dark). Not counted as variation: The 346 art library ids are seed variations of 14 generators (counted as 14 generators plus their approved new drawings); recolours.

**13. How is repetition prevented?** Card type not identical on consecutive lines (layout seed changes per line, existing); a drawing at most twice per song except hook cards; grounds max 3 per song.

**14. How do scenes evolve throughout a song?** Accumulating pile per ground; the pile is the song's memory. Bigger poster cards; the hook card returns with wear on repeats.

**15. How does the style adapt to different screen sizes?** Card on a surface: portrait Vertical card 80% height. Held cue card: portrait Card 75% height. The pile: portrait Pile spreads down. All families in composition.md.

**16. How does it handle different languages?** Hindi: No per-letter rotation (whole words); scribble reveal as whole-word wipe along the headline bar direction (left to right); Kalam for hand roles. Tamil: Whole-word wipe; Kavivanar for hand roles; long words get the receipt card. Mixed: Per-run faces; per-letter effects only on Latin runs. RTL: Card layouts mirror; wipe right to left; no per-letter rotation for Arabic. Fallback: No hand face for a script: Noto Sans of the script, regular weight, as the thin role.

**17. What technical infrastructure does it require?** Card types as card-shape masks and paper textures, grounds as plates, pile baking (older cards into one texture), hand holder rig, print process passes (riso, photocopy, dither), dark register drawings, warm-up painting (V9: paint the next card during the current line). Reuses: sketch.ts card layout solver and roles, art library generators, doodles, border kinds, font sets, paperSet, Acid creature choreography.

**18. What performance constraints apply?** Target: GPU 1.2 ms; card paint under 8 ms done one line ahead (V9 measured in Phase 3). Target: under 32 MB (card sheets, pile texture, grounds).

**19. How will production quality be evaluated?** Card hierarchy review on 50 random lines; dark register review on 5 dark songs; card variety test (no identical card type and border on consecutive lines); script review for Hindi and Tamil cards (Kalam, Kavivanar).

**20. What must be completed before the style is considered finished?** Card types, grounds and processes produced; Dark register drawings complete; Pile and pull-back ending work; V9 card warm-up measured; Golden frames.
