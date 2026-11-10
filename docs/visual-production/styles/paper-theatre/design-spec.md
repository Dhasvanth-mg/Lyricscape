# Paper Theatre: design specification

Style 3 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


> Layered cut-paper and silhouette stages lit from behind.

Origin: New style (Phase 1). Phase 1 rank: 3 of 15 (Phase 1 score 8.25).

Companion files: [typography](typography.md), [composition](composition.md), [motion](motion.md), [scene families](scene-families.md), [asset strategy](asset-strategy.md), [manifest](asset-manifest.json), [compatibility](compatibility.json), [review register](review-register.md).

## 1. Creative identity

**Artistic philosophy.** Handmade storytelling with depth. A small world built from rigid pieces of paper and light, where nothing morphs and everything moves on a pin or a rail.

**Core visual concept.** A toy theatre or pop-up stage of 4-7 silhouette layers in front of a backlit tinted ground. Each song gets a set (a city, a harbour, a forest); lines bring pieces on stage, figures move on hinges, and the lyric appears as light cut through paper, a printed card or a hung banner.

**Emotional character.** Warm, wistful, storybook; capable of melancholy (blue night sets) and joy (fairground, garden).

**Influences and references.** Silhouette animation, cut-paper title sequences, toy theatres and pop-up books, shadow puppetry (as a general tradition, not a specific national form).

**Distinguishing characteristics.** The only style that builds small worlds with narrative and parallax depth while staying flat and graphic; the only one where motion is rigid pieces on pivots and rails.

**Recurring motifs.** Proscenium arch; backlight gradient; hinged figures; rails; paper birds; light through cut letters; curtains; page fold.

**Intended density.** Medium: 4-7 layers, 6-20 pieces on stage, one focal action.

**Material and compositional language.** Black card, tinted tissue, kraft, layered grey papers; light from behind; occasional front light for printed cards.

**Musical contexts.** Folk, indie, acoustic, ballads, children-friendly pop, cinematic songs, story songs. Weak for very fast rap (it moves slowly by design; uses rails and cuts to keep up).

**Constant across every variation.** Everything is a rigid piece; light is always behind; type sits on the brightest layer; one set per stage; cut quality uniform.

**Why it is recognisable on any song.** Any frame shows silhouettes in layers against a glowing ground inside a frame.

**It must never look like:**

- Fairy-tale kitsch: ornament for its own sake, glitter, castles with flags everywhere.
- Pastiche of a specific film's silhouettes or title sequence.
- Morphing or soft deformation of pieces (only pivots and rails).
- Vector clip-art: uniform strokes, gradients on pieces, outlines.
- Photographic backgrounds.

## 2. Colour, lighting and materials

**Palette system.** Ground: a vertical gradient of one hue (from the cover's dominant swatch, shifted to a light-transmitting lightness L 70-90 at the glow centre, falling to L 25-40 at the edges). Pieces: black card (L 8) or the set's paper tint (for layered grey sets: L 15, 30, 45 by depth).

**Accent behaviour.** A single coloured tissue element per stage (a sun, a lantern, a window) in the cover's accent; cut letters take the ground colour.

**Contrast requirements.** Cut letters: ground glow vs black card is always above 10:1; printed cards: ink on paper 7:1; the lyric always sits over the brightest ground region (contrast check against the local ground luminance).

**Lighting.** Backlight only by default: a glow centre placed per composition; optional front spot for printed cards (warm, 20%). Light rigs animate the glow centre and hue.

**Shadows.** No cast shadows from backlit pieces; layered sets show depth by lightening far layers (atmospheric paper) rather than shadows. Front-lit cards cast a soft 4 px shadow.

**Surface materials.** Black card, kraft, tissue (translucent, lets coloured light through), tracing paper (diffuse far layers), handmade paper with fibres (ground).

**Texture system.** Paper fibre generator on the ground at 6%; tissue grain on translucent pieces; slight edge fuzz on tissue only.

**Atmosphere.** Depth fog of the ground colour on far layers (shared fog generator at low density); falling paper props (snow, leaves) in some sets.

**Colour transitions.** Colour changes are light changes: the ground hue cross-fades over 1-2 s at sections (colour-coded transitions).

**Song-specific adaptation.** Ground hue from the cover; set from identity subjects; time of day from mood and cover brightness (bright, warm covers: dusk and day; dark: night).

**Material and colour variation rules.** Pieces are never recoloured individually; variation comes from set, composition, light and paper type.

## 3. Musical responsiveness

**Measured signals used.** Line and word times, gaps, hooks, beat grid when present.

**Estimates used (never treated as measured).** Estimated words, identity subjects and mood, energy guesses.

| Case | Behaviour |
|---|---|
| 1. Word-synchronised lyrics (authored word times) | A word can be cut open: cut letters reveal word by word on authored start times (the cut light brightens behind each word in 120 ms). |
| 2. Line-synchronised lyrics | A piece enters per line (a bird crosses, a boat slides); the lyric card or banner appears whole at the line start (300 ms drop on strings). |
| 3. Estimated word timing | Whole banner or card per line; no word cuts. |
| 4. No reliable timestamps | The lyric is printed as a scroll that unrolls slowly (reading pace) on a fixed set; pieces move on their idle loops. |
| 5. Instrumental sections | Set change on stage: stagehand rails slide pieces off and on, or the light cycles through the set's times of day; figures continue small loops. |
| 6. Missing audio analysis (no beat grid, no energy) | Figures move on line starts instead of beats; idle loops at fixed fixed periods (7-11 s). Complete without beats. |

**Beat (only when present).** With a beat grid: small figures bob on beats (2% of their height), bunting sways on bars; never the lyric.

**Energy and mood.** Energy decides rail speed (slow glide vs brisk slide) and how many pieces enter per section.

**Lyric density.** Dense lines: banners hold two lines; pieces enter every second line instead of every line.

Styling never changes cue times: every behaviour above reads `lineAt()` and word times; nothing writes them.

## 4. Song-level progression

**Introduction.** Curtain closed and lit from behind; it opens on the first line's lead-in (1.2 s before), revealing an empty lit stage with only the far layer.

**Opening lines.** The first lines bring the mid layer in on rails.

**Verses.** One set; the cast accumulates (each line can add a piece, up to the complexity limit, then pieces start leaving).

**Choruses.** Full stage lit: brighter glow, all layers, the proscenium opens wider (frame scales out 6%); later choruses recall the same set arrangement with one added element.

**Bridge.** Scale change: a tiny stage in a big dark space, or a close-up cut (one large silhouette with the lyric cut through it).

**Instrumental breaks.** Set changes on stage with rails; light cycles; figures loop.

**Repeated lines.** Repeated lines reuse the same banner, which swings in again on the same strings.

**High-energy moments.** Brisk rails, more pieces, colour-coded light changes on section starts.

**Quiet moments.** Fewer layers (far plus one), slow glide, low warm light.

**Ending.** The light fades behind the last silhouette; the curtain closes; the last line remains printed on the curtain's front card.

**Fallback without structure.** No hooks: sets change every second gap section; no gaps: light changes every 26 s and one set change per song at the halfway line.

**How scenes change.** Accumulating stage per section; the set persists across 1-3 sections; pieces arrive and leave on rails.

**Long-term interest.** 12 sets, 4 paper types, 8 lights and 7 compositions; two songs share the medium and rarely a set because the set follows the lyric's subjects.

## 5. Technical requirements

**Reuses.** Scene host sprites with alpha (host.sprite), shared fog and paper fibre generators, LRU texture cache, director sections.

**New (proposed extensions, Phase 3).** Layer system with per-layer parallax factors, hinge transforms (parent-child pivots), rail paths, string pendulum for cards, cut-letter mask renderer (lyric rendered into a mask that subtracts from a paper layer), set composition loader.

**Performance targets (targets until measured).** Target (to measure): 1.5 ms GPU at 1280x720 (sprite quads only); CPU layout under 0.5 ms.

**Memory target.** Target: one set atlas (4 MB) plus figures atlas (4 MB) plus frames (2 MB) plus ground; under 16 MB.

**Fallbacks.** Canvas 2D tier: same layers drawn with drawImage of masks filled by colour; no fog; simple.

**Export.** Choreographies are pure functions of t and the line index; pendulum swings computed analytically from the drop time.

## 6. Quality evaluation

Silhouette readability at 10% height; edge quality review across each set (consistent cut); cut-letter legibility review for Latin, Hindi, Tamil, Hebrew; kitsch review (a second reviewer flags ornament); pastiche check against the reference list; motion review for weight (no rubbery motion).

## 7. Definition of finished (Phase 3)

- [ ] 13 sets with approved pieces and two set compositions each
- [ ] Hinged figures animate correctly
- [ ] Cut-letter masks pass legibility in 4 scripts
- [ ] All 7 compositions reviewed at 4 sizes
- [ ] Golden frames and a full-song review on three songs (folk, pop, ballad)
- [ ] Performance measured

## 8. The twenty planning questions

**1. What does the style look like?** A toy theatre or pop-up stage of 4-7 silhouette layers in front of a backlit tinted ground. Each song gets a set (a city, a harbour, a forest); lines bring pieces on stage, figures move on hinges, and the lyric appears as light cut through paper, a printed card or a hung banner.

**2. What makes it distinct?** The only style that builds small worlds with narrative and parallax depth while staying flat and graphic; the only one where motion is rigid pieces on pivots and rails.

**3. What composition families does it contain?** C1 Proscenium stage; C2 Window stage; C3 Pop-up book; C4 Lantern; C5 Panorama scroll; C6 Close-up cut; C7 Tiny stage in the dark. Scene families: City at night; Harbour and sea; Forest; Desert crossing; Mountains; Rooms; Sky and birds; Fairground; Garden; Train journey; Snow village; Night road; Sea depths. Details in composition.md and scene-families.md.

**4. What are its typography rules?** Lyric on the brightest layer > focal figure > mid set > far set > frame. Emphasis: Word level (authored): a word is cut larger or its light brightens; line level: banner swing, a bird carries the card. Spacing: Latin cut letters get +2% tracking (cut paper needs bridges); complex scripts: no added tracking. Full rules in typography.md.

**5. How does it animate?** Rigid pieces on pins and rails, moved by an invisible puppeteer. Nothing stretches; everything has weight and a slight wobble. Rail slides 700-1600 ms; card drops 900 ms settle; hinge cycles 0.8-1.6 s; curtain 1.4 s.

**6. How does it respond to lyrics and music?** Authored words: A word can be cut open: cut letters reveal word by word on authored start times (the cut light brightens behind each word in 120 ms). Lines: A piece enters per line (a bird crosses, a boat slides); the lyric card or banner appears whole at the line start (300 ms drop on strings). No beat grid: Figures move on line starts instead of beats; idle loops at fixed fixed periods (7-11 s). Complete without beats.

**7. What exact assets must be produced?** 241 entries in asset-manifest.json across 21 asset families plus composition, scene and transition specs: City pieces (14); Harbour and sea pieces (12); Forest pieces (12); Desert pieces (10); Mountain pieces (10); Room pieces (12); Sky pieces (10); Fairground pieces (10); Garden pieces (10); Railway panorama pieces (7); Snow village pieces (8); Night road pieces (6); Sea depth pieces (8); Hinged figures and animals (24); Frames (10); Paper surfaces (8); Light rigs (10); Lyric treatments (7); Choreographies (11); Camera moves (5); Props and large pieces (10).

**8. Why does each asset exist?** Each family's purpose: City pieces: Builds the city pieces so the stage has a believable world with 4-7 depth layers. Harbour and sea pieces: Builds the harbour and sea pieces so the stage has a believable world with 4-7 depth layers. Forest pieces: Builds the forest pieces so the stage has a believable world with 4-7 depth layers. Desert pieces: Builds the desert pieces so the stage has a believable world with 4-7 depth layers. Mountain pieces: Builds the mountain pieces so the stage has a believable world with 4-7 depth layers. Room pieces: Builds the room pieces so the stage has a believable world with 4-7 depth layers. The rest in asset-strategy.md; each manifest entry carries its own purpose.

**9. Which assets are redundant?** 9 candidates were rejected or merged during review: Famous tower (rejected: Real place likeness.); Puppet of a famous character (rejected: Character likeness.); Realistic human with a face (rejected: Paper theatre figures stay silhouettes; faces add likeness risk and break the material language.); Glossy photo paper (rejected: Glossy reflections fight the matte cut-paper look.); Strobe rig (rejected: Flash guard (V5); a candle-scale theatre never strobes.); Smartphone prop (rejected: Screenlife territory; breaks the toy-theatre period feel.); Flag of a country (rejected: Political meaning outside the song.); Castle and dragon (rejected: Kitsch risk named in Phase 1; the style is storybook, not fairy-tale cliché.) ...see review-register.md.

**10. How do assets combine?** Layer order: ground gradient (light rig) > far layer (tracing paper, lightest) > middle set > near set > figures and moving pieces > props (strings, bunting, falling paper) > lyric (card, banner or cut layer) > frame (arch, window, book, lantern, rollers) > post: paper fibre on ground, fog on far layers. Required: Ground light; at least 3 layers from one set (far, middle, near); one frame (except C6); one lyric treatment.

**11. Which combinations are invalid?** Two sets with same stage (Breaks the world (only panorama seams join sets).); Cut letters with long lines over 3 words (Becomes unreadable; use a printed card.); Lantern composition with more than 2 figures (Too small to read.); Fairground light cycle with quiet or sad identity (Wrong mood.); Snow village with religious symbols (Excluded everywhere.); Tissue accent with behind the lyric (Coloured light lowers contrast unpredictably.)

**12. How do scenes vary meaningfully?** Major dimensions: Set (13 worlds); Composition (proscenium, window, pop-up, lantern, panorama, close-up, tiny stage); Time of day and light rig; Cast (figures and their choreography); Paper type (black card, layered greys, kraft, tissue). Not counted as variation: Mirrored pieces, hue changes, arrangement seeds.

**13. How is repetition prevented?** A set lasts 1-3 sections; at most 2 sets per song (3 for songs over 5 minutes); figures used at most twice per song; no composition twice in a row except chorus recall.

**14. How do scenes evolve throughout a song?** Accumulating stage per section; the set persists across 1-3 sections; pieces arrive and leave on rails. Full stage lit: brighter glow, all layers, the proscenium opens wider (frame scales out 6%); later choruses recall the same set arrangement with one added element.

**15. How does the style adapt to different screen sizes?** Proscenium stage: portrait Tall arch; set stacked (tall trees, towers); card higher. Window stage: portrait Window upper half, card on sill below. Pop-up book: portrait Single page view (one page visible) with pieces rising toward the viewer. All families in composition.md.

**16. How does it handle different languages?** Hindi: Cut letters allowed as whole-word masks rendered from the shaped font (the headline bar of Devanagari makes cut paper look natural; bridges are not needed because the bar connects letters); no per-letter animation; printed card in Noto Serif Devanagari. Tamil: Cut letters as whole-word masks; printed card in Noto Serif Tamil; long Tamil words get the card treatment more often (cut width limit). Mixed: Each run in its own face on the same card; cut letters only when the whole line is one script. RTL: Arabic and Hebrew on printed cards (right-aligned, banner strings mirrored); cut letters allowed for Hebrew; Arabic cut letters as whole-word masks with connected strokes. Fallback: No serif face for the script: card falls back to the Noto Sans face for the script; cut letters always use a bold sans for unsupported scripts.

**17. What technical infrastructure does it require?** Layer system with per-layer parallax factors, hinge transforms (parent-child pivots), rail paths, string pendulum for cards, cut-letter mask renderer (lyric rendered into a mask that subtracts from a paper layer), set composition loader. Reuses: Scene host sprites with alpha (host.sprite), shared fog and paper fibre generators, LRU texture cache, director sections.

**18. What performance constraints apply?** Target (to measure): 1.5 ms GPU at 1280x720 (sprite quads only); CPU layout under 0.5 ms. Target: one set atlas (4 MB) plus figures atlas (4 MB) plus frames (2 MB) plus ground; under 16 MB.

**19. How will production quality be evaluated?** Silhouette readability at 10% height; edge quality review across each set (consistent cut); cut-letter legibility review for Latin, Hindi, Tamil, Hebrew; kitsch review (a second reviewer flags ornament); pastiche check against the reference list; motion review for weight (no rubbery motion).

**20. What must be completed before the style is considered finished?** 13 sets with approved pieces and two set compositions each; Hinged figures animate correctly; Cut-letter masks pass legibility in 4 scripts; All 7 compositions reviewed at 4 sizes; Golden frames and a full-song review on three songs (folk, pop, ballad); Performance measured.
