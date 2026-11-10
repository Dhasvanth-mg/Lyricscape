# Konstrukt: design specification

Style 4 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


> A Swiss music poster whose shapes play the rhythm.

Origin: Merges Type as Rhythm, Graphic and Controlled Disorder (directions), redesigned around the International Typographic Style. Phase 1 rank: 2 of 15 (Phase 1 score 8.35).

Companion files: [typography](typography.md), [composition](composition.md), [motion](motion.md), [scene families](scene-families.md), [asset strategy](asset-strategy.md), [manifest](asset-manifest.json), [compatibility](compatibility.json), [review register](review-register.md).

## 1. Creative identity

**Artistic philosophy.** Rhythm made visible with the discipline of the grid. Structure is the subject; nothing is decoration.

**Core visual concept.** A poster on a modular grid: grotesk type flush left, circles, bars, arcs and lines as instruments that enter, multiply, rotate and step in time. The layout itself reflows at sections, so composition changes are the main event.

**Emotional character.** Confident, energetic, cool-headed; joyful when colour is warm, severe when it is black and red.

**Influences and references.** Mid-century Swiss concert posters, visual music films, generative identity systems, constructivist composition.

**Distinguishing characteristics.** The most beat-literate style and the only one where the layout grid is visible as structure.

**Recurring motifs.** The grid; one dominant form per section; overprint; numbers as type; rules; quantised steps.

**Intended density.** Low to medium: half the poster is often empty by design.

**Material and compositional language.** Flat ink on paper (coated or uncoated), overprint, slight misregistration; or flat light on dark (negative print).

**Musical contexts.** Electronic, hip-hop, rock, math rock, jazz, pop with strong rhythm; anything with a beat. Calm songs get slow, sparse versions.

**Constant across every variation.** Everything on the grid; one grotesk family; flat colour; no glow, no blur, no gradients; type never animated by effects (only weight, size, position).

**Why it is recognisable on any song.** A frame looks like a poster: grid, flush-left grotesk, a big geometric form, flat ink.

**It must never look like:**

- A corporate motion template (bouncy icons, gradient blobs, logo stings).
- Floating, drifting or glowing shapes.
- Op-art strobing: high-contrast stripes moving fast.
- Decoration unrelated to rhythm.
- Type distorted, skewed or effect-treated.

## 2. Colour, lighting and materials

**Palette system.** Colour systems of 2-3 flat inks plus paper: classic (red, black, cream), cover duotone (two cover swatches pushed to print-like saturation), black and one cover colour, three-colour primaries, negative (paper colour as light on near-black).

**Accent behaviour.** The second ink marks the dominant form; type stays in the darkest ink (or paper colour on dark).

**Contrast requirements.** Type 7:1 against its ground; forms may sit under type only at under 1.5:1 difference to the ground (they become texture) or not at all.

**Lighting.** None: flat print.

**Shadows.** None.

**Surface materials.** Uncoated paper, coated paper, newsprint; ink overprint (multiply).

**Texture system.** Paper tooth at 4%, riso grain on second ink at low strength, 1-2 px misregistration on overprint.

**Atmosphere.** None.

**Colour transitions.** Colour systems change only at section reflows; inks swap by module wipe, never by fades.

**Song-specific adaptation.** Cover gives the duotone and the paper temperature; genre and mood choose between classic, duotone and negative systems.

**Material and colour variation rules.** Never more than 3 inks; no gradients; ink lightness fixed per system for contrast.

## 3. Musical responsiveness

**Measured signals used.** Beat grid with confidence (when present), line and word times, gaps, hooks.

**Estimates used (never treated as measured).** Tempo from lyric timing, estimated words, energy and mood.

| Case | Behaviour |
|---|---|
| 1. Word-synchronised lyrics (authored word times) | Forms step on authored word starts (one step per word) when no beat grid; with a grid, words still change type weight on their start. |
| 2. Line-synchronised lyrics | Forms step on line starts, and on even subdivisions of the line (line duration / words count, or every 500 ms, whichever is longer) with no accent claims. |
| 3. Estimated word timing | Even subdivisions only; type weight changes on line start only. |
| 4. No reliable timestamps | Static poster per 6 lines, laid out as a programme listing; forms run a slow metronome rotation (one step every 2 s). |
| 5. Instrumental sections | Forms continue a slow pattern (metronome rotation or a sequence that cycles through modules); a numeral counts bars when a beat grid exists, or seconds otherwise. |
| 6. Missing audio analysis (no beat grid, no energy) | Steps come from lines and subdivisions; the tempo source label (shown in the corner as type: "tempo from lyrics", "no tempo") stays honest. Looks complete without beats. |

**Beat (only when present).** Beat grid with confidence 0.5 or more: steps on beats, a larger step (a hit) on downbeats; confidence under 0.5: steps on bars only.

**Energy and mood.** Energy chooses how many forms step per beat (1-4) and the grid density.

**Lyric density.** Dense lines: column stack becomes block; forms simplify to one family.

Styling never changes cue times: every behaviour above reads `lineAt()` and word times; nothing writes them.

## 4. Song-level progression

**Introduction.** The grid draws itself (rules extend module by module), then the first form appears.

**Opening lines.** First lines set in the block layout with one form family.

**Verses.** One shape family per verse; forms accumulate modules line by line.

**Choruses.** The grid fills: more modules active, a denser family (mixed constructivist), the hook set larger; later choruses recall the first chorus layout.

**Bridge.** The grid rotates 90 degrees (rotated edge layout) or switches to negative print.

**Instrumental breaks.** Metronome pattern; numerals count.

**Repeated lines.** Repeated lines reuse the same layout position; their form step pattern intensifies by one level per repeat (capped).

**High-energy moments.** All forms active, steps on every beat.

**Quiet moments.** Type-only poster with rules; one form, slow.

**Ending.** Modules are removed one by one until only the last line and the grid remain; then the grid rules retract.

**Fallback without structure.** No hooks: layouts change at gap sections; otherwise every 16 bars (beat grid) or 26 s.

**How scenes change.** Layout persists within a section and accumulates active modules; reflows between sections.

**Long-term interest.** Grids x layouts x shape families x colour systems recombine compositionally (layout changes the picture), so posters differ by structure, not colour.

## 5. Technical requirements

**Reuses.** host.rect and host.shape quads, text measurement, beat grid and confidence, snapToBeat, director sections.

**New (proposed extensions, Phase 3).** Grid and layout solver (modules, slots, exclusion masks), choreography stepper (pure function of t and trigger list), weight-axis type rendering (variable font weight per word, cached per weight step), overprint blend mode, misregistration offsets.

**Performance targets (targets until measured).** Target: 1 ms GPU at 1280x720; CPU layout under 0.3 ms per frame (layouts solved at section start).

**Memory target.** Target: under 12 MB (type sheets at 3 weight steps per line, textures).

**Fallbacks.** Canvas 2D tier: the whole style is drawable in 2D (rects, arcs, text); overprint via multiply composite.

**Export.** Pure functions of t; beat steps from the stored grid.

## 6. Quality evaluation

Poster test: a still frame from any section must look like a designed poster (review by two people); flicker check on waves and rings; beat-free review on 3 songs with no grid; script review for Hindi and Tamil weight emphasis; layout solver unit tests (no form in the type slot at all sizes).

## 7. Definition of finished (Phase 3)

- [ ] 11 shape families with approved choreographies
- [ ] All layout templates solved at 4 sizes without collisions
- [ ] Beat and no-beat versions reviewed side by side
- [ ] Flicker audit
- [ ] Canvas 2D parity check on 5 scenes
- [ ] Golden frames

## 8. The twenty planning questions

**1. What does the style look like?** A poster on a modular grid: grotesk type flush left, circles, bars, arcs and lines as instruments that enter, multiply, rotate and step in time. The layout itself reflows at sections, so composition changes are the main event.

**2. What makes it distinct?** The most beat-literate style and the only one where the layout grid is visible as structure.

**3. What composition families does it contain?** C1 Block on grid; C2 Column stack; C3 Rotated edge; C4 Split field; C5 Concentric; C6 Scatter on grid; C7 Giant form. Scene families: Circles; Bars; Arcs; Diagonals; Dot matrix; Rings; Squares; Waves; Rules; Constructivist mix; Negative print. Details in composition.md and scene-families.md.

**4. What are its typography rules?** Lyric block > dominant form > secondary forms > numerals and rules > grid. Emphasis: Word level (authored): weight step (400 to 800) and width change on the word's start; line level: size step and module position. Never colour flashes or effects. Spacing: Latin tight tracking at display sizes (-1% to -2%); complex scripts default spacing; line spacing = module subdivision (1.0-1.1 of size). Full rules in typography.md.

**5. How does it animate?** Snap and settle. Forms move in quantised steps on the grid, with crisp ease-out; no floating. Steps last 90-160 ms (ease-out quart); between steps, stillness.

**6. How does it respond to lyrics and music?** Authored words: Forms step on authored word starts (one step per word) when no beat grid; with a grid, words still change type weight on their start. Lines: Forms step on line starts, and on even subdivisions of the line (line duration / words count, or every 500 ms, whichever is longer) with no accent claims. No beat grid: Steps come from lines and subdivisions; the tempo source label (shown in the corner as type: "tempo from lyrics", "no tempo") stays honest. Looks complete without beats.

**7. What exact assets must be produced?** 131 entries in asset-manifest.json across 16 asset families plus composition, scene and transition specs: Circle choreographies (6); Bar choreographies (6); Arc choreographies (5); Diagonal choreographies (5); Dot matrix choreographies (5); Ring choreographies (5); Square choreographies (5); Wave line choreographies (4); Rule choreographies (4); Constructivist mix choreographies (4); Grid systems (11); Layout templates (19); Colour systems (10); Print textures (6); Type arrangement rules (7); Step trigger sources (6).

**8. Why does each asset exist?** Each family's purpose: Circle choreographies: Circle sequences: the most versatile family. Bar choreographies: Bars extend and stack: strongest for hip-hop and rock. Arc choreographies: Arcs rotate and sweep for flowing songs. Diagonal choreographies: Diagonals give energy and direction. Dot matrix choreographies: Matrix fills for electronic and minimal songs. Ring choreographies: Concentric pulses for loops and techno. The rest in asset-strategy.md; each manifest entry carries its own purpose.

**9. Which assets are redundant?** 5 candidates were rejected or merged during review: Bouncing circles (rejected: Floating and rubbery motion is excluded by the motion language.); Spectrum bars (rejected: Implies audio analysis the app often lacks; would fake data.); Block high-left, form low-right (merged: A mirror is a variation of the same structure (mirroring is a layout parameter).); Centred symmetric block (rejected: Not the style: centred symmetry reads as a corporate title card.); Gradient duotone (rejected: Gradients are excluded (flat ink only).)

**10. How do assets combine?** Layer order: paper or dark ground > colour fields (split layouts) > grid rules (visible or hidden) > shape choreography (second ink, overprint) > shape choreography (first ink) > numerals and labels > lyric type > print texture (tooth, riso grain, misregistration). Required: Grid; layout template; colour system; one shape family (except Rules); lyric type.

**11. Which combinations are invalid?** Rotated edge with Devanagari, Tamil, Arabic (Not a convention for these scripts here; poor reading.); Scatter on grid with estimated words (Word modules would claim timing.); Waves with high contrast inks while moving (Op-art flicker.); Negative print with riso grain (Light on dark is not paper ink.); Any form with the type slot (Hard exclusion.); Beat hits with beat grid under 0.5 confidence (Would mark wrong downbeats.)

**12. How do scenes vary meaningfully?** Major dimensions: Layout template (structure); Shape family (11); Grid system; Register (positive or negative). Not counted as variation: Recolours by cover; mirrored layouts.

**13. How is repetition prevented?** No layout template twice in a row except chorus recall; a shape family at most 3 sections per song; across songs the layout order is seeded by track id.

**14. How do scenes evolve throughout a song?** Layout persists within a section and accumulates active modules; reflows between sections. The grid fills: more modules active, a denser family (mixed constructivist), the hook set larger; later choruses recall the first chorus layout.

**15. How does the style adapt to different screen sizes?** Block on grid: portrait 6-column grid; block spans the width. Column stack: portrait Stack full height on the left half. Rotated edge: portrait Line on the long left edge. All families in composition.md.

**16. How does it handle different languages?** Hindi: Weight axis emphasis works (Noto Sans Devanagari variable); no width changes; no negative tracking; rotated layout not allowed (Devanagari is not set rotated in poster convention here; use block). Tamil: As Hindi; long words get the block layout. Mixed: Runs share the block; weight emphasis per word. RTL: Grid mirrors; flush right; column stack reads right to left by row; rotated layout reads top to bottom on the right edge (Hebrew only; Arabic stays horizontal). Fallback: No Archivo glyph: falls back to Noto Sans of the script at the nearest weight.

**17. What technical infrastructure does it require?** Grid and layout solver (modules, slots, exclusion masks), choreography stepper (pure function of t and trigger list), weight-axis type rendering (variable font weight per word, cached per weight step), overprint blend mode, misregistration offsets. Reuses: host.rect and host.shape quads, text measurement, beat grid and confidence, snapToBeat, director sections.

**18. What performance constraints apply?** Target: 1 ms GPU at 1280x720; CPU layout under 0.3 ms per frame (layouts solved at section start). Target: under 12 MB (type sheets at 3 weight steps per line, textures).

**19. How will production quality be evaluated?** Poster test: a still frame from any section must look like a designed poster (review by two people); flicker check on waves and rings; beat-free review on 3 songs with no grid; script review for Hindi and Tamil weight emphasis; layout solver unit tests (no form in the type slot at all sizes).

**20. What must be completed before the style is considered finished?** 11 shape families with approved choreographies; All layout templates solved at 4 sizes without collisions; Beat and no-beat versions reviewed side by side; Flicker audit; Canvas 2D parity check on 5 scenes; Golden frames.
