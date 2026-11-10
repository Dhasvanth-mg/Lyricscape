# Liquid Light Show: design specification

Style 8 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


> Hand-pushed oil, water and dye on a projector.

Origin: Liquid light (Turbo) redesigned from the ground up; absorbs Psychedelic, Aurora and Acid's colour field. Phase 1 rank: 11 of 15 (Phase 1 score 7.75).

Companion files: [typography](typography.md), [composition](composition.md), [motion](motion.md), [scene families](scene-families.md), [asset strategy](asset-strategy.md), [manifest](asset-manifest.json), [compatibility](compatibility.json), [review register](review-register.md).

## 1. Creative identity

**Artistic philosophy.** Hand-performed psychedelia, not a gradient. A person is playing the light with glass dishes, oil and dye.

**Core visual concept.** Coloured oil and water pushed by hand in glass dishes on projectors: bubbles split, dye blooms, a colour wheel turns. The lyric is a projected slide: black slide with clear letters (colour shows through the type) or a dark band with light type.

**Emotional character.** Euphoric, warm, hypnotic; tender when slow and honeyed.

**Influences and references.** Live liquid light shows, ink in water, marbling, overhead projectors.

**Distinguishing characteristics.** Physical fluid behaviour and performed motion (rocking, squeezing, dropping) instead of abstract shader noise.

**Recurring motifs.** The dish edge; bubbles splitting; dye drops blooming; the colour wheel; the slide; the squeeze on the beat.

**Intended density.** High colour, one text element.

**Material and compositional language.** Oil, water, dye, glass, projected light (additive).

**Musical contexts.** Psychedelic rock, neo-psychedelia, dream pop, electronic, synth-pop, disco, Bollywood dance numbers, festival songs; slow presets for calm songs.

**Constant across every variation.** The slide always isolates the type; fluid motion comes from hand gestures; colour is additive projected light; deterministic in t.

**Why it is recognisable on any song.** Coloured liquid cells and blooms with a hard-edged slide.

**It must never look like:**

- A generic trippy shader (smooth noise gradients, kaleidoscopes, tunnels): the failure of the old liquid look.
- Muddy brown colour from too many dyes.
- Strobing colour: hue cycling faster than 1 cycle per 4 s.
- Black frames in intros (observed bug).
- Monochrome ink in water (Ink's territory).

## 2. Colour, lighting and materials

**Palette system.** Dye palettes of 3-4 saturated transparent colours (magenta, amber, cyan, violet, green) plus clear oil; cover-derived palette option takes the cover's three most saturated swatches pushed to transparent dye lightness.

**Accent behaviour.** The slide letters are the brightest element (letters show the fluid at +20% exposure through clear film).

**Contrast requirements.** Slide band: light type 7:1 against the dark band; letter-mask slides: letters are colour through black, so contrast is between the letter fill (average luminance at least 0.45) and the black slide (L 3); a minimum-luminance floor is applied inside letters.

**Lighting.** Projector lamp: hot centre, falloff at the dish edge; colour wheel tints the whole projection.

**Shadows.** None.

**Surface materials.** Oil (refractive, sharp-edged cells), water (soft dye), glass (dish edge, meniscus).

**Texture system.** Lamp grain at low strength; dust on the projector glass (rare).

**Atmosphere.** A faint haze halo around the projection.

**Colour transitions.** Palettes change with a fresh drop or a colour wheel turn, never a global hue shift.

**Song-specific adaptation.** Cover palette or mood palette; viscosity from tempo and energy (honey for calm, splashy for energetic).

**Material and colour variation rules.** Max 4 dyes per dish; two dishes share at most 2 dyes (avoid mud).

## 3. Musical responsiveness

**Measured signals used.** Line and word times, gaps, hooks, beat grid.

**Estimates used (never treated as measured).** Tempo from lyric timing, energy, mood.

| Case | Behaviour |
|---|---|
| 1. Word-synchronised lyrics (authored word times) | Authored words: a small bloom of dye at a position near the slide for each word start (max 4 per second). |
| 2. Line-synchronised lyrics | A new drop of dye or a slide change per line. |
| 3. Estimated word timing | Line-level drops only. |
| 4. No reliable timestamps | Slides change every 8 s with the lyric set as a sequence of slides; the fluid performs freely. |
| 5. Instrumental sections | Pure fluid: the hand rocks and swirls; colour wheel turns slowly; after 12 s a second dish slides in. |
| 6. Missing audio analysis (no beat grid, no energy) | Gestures on line starts and at fixed slow periods (rock every 6-9 s). Complete without beats. |

**Beat (only when present).** Beat grid: the squeeze on the beat (dish pinch, 2-4% displacement), flash-limited; bars: rock direction changes.

**Energy and mood.** Energy picks viscosity and gesture amplitude.

**Lyric density.** Dense lines: slide band composition (more text fits) instead of letter masks.

Styling never changes cue times: every behaviour above reads `lineAt()` and word times; nothing writes them.

## 4. Song-level progression

**Introduction.** An empty lit dish (clear oil, lamp warming); the first dye drops at the first line's lead-in. Never black.

**Opening lines.** First line projected on a slide over one dye.

**Verses.** One dish with one preset; dyes accumulate (one more dye per 2 lines, up to 4).

**Choruses.** Two projectors at once (second dish additive), colour wheel spinning faster (still under 1 rev per 4 s).

**Bridge.** Colour wheel composition or a dark dish (low dye, slow).

**Instrumental breaks.** Pure fluid, hand gestures.

**Repeated lines.** The same slide returns; the dish is pinched on its start.

**High-energy moments.** Splashy presets, squeeze on beats, two dishes.

**Quiet moments.** Honey presets, single dish, slow rock.

**Ending.** The projector lamp fades; the fluid slows to stillness (advection speed to 0 over 3 s) as the light goes.

**Fallback without structure.** No hooks: dish changes at gap sections.

**How scenes change.** Accumulating dyes within a dish; dishes swap at sections.

**Long-term interest.** 10 fluid families x 4 presets x palettes; presets are tuned like instruments so they feel different, not recoloured.

## 5. Technical requirements

**Reuses.** Full-screen backdrop path at reduced resolution (host.fullscreen), bloom, shared flow-field sampler and noise.

**New (proposed extensions, Phase 3).** Fluid shader: multi-step advection of dye textures along baked periodic flow fields with oil-cell thresholding and refraction; letter-mask slide compositing; additive dish layering with luminance cap.

**Performance targets (targets until measured).** Target: 2.5 ms per dish at half resolution; 5 ms worst case with two dishes on the integrated GPU (to measure; tier down to one dish if over).

**Memory target.** Target: flow textures 512x512 RG16F x4 (8 MB), dye textures 1024 (8 MB); under 24 MB.

**Fallbacks.** Canvas 2D tier: band slide over a slowly crossfading pre-rendered set of fluid stills (from the same presets, rendered at build or first run).

**Export.** Time-parameterised: same t, same frame.

## 6. Quality evaluation

Physical-liquid review (does it look like oil and dye?) for every preset; no mud; flash audit on squeezes and wheel; slide contrast floor test; generic-shader review against the old liquid look.

## 7. Definition of finished (Phase 3)

- [ ] 40 presets tuned and reviewed
- [ ] Flow textures baked and periodic
- [ ] Two-dish budget measured
- [ ] Flash audit
- [ ] Golden frames

## 8. The twenty planning questions

**1. What does the style look like?** Coloured oil and water pushed by hand in glass dishes on projectors: bubbles split, dye blooms, a colour wheel turns. The lyric is a projected slide: black slide with clear letters (colour shows through the type) or a dark band with light type.

**2. What makes it distinct?** Physical fluid behaviour and performed motion (rocking, squeezing, dropping) instead of abstract shader noise.

**3. What composition families does it contain?** C1 Full-bleed dish with band slide; C2 Letter-mask slide; C3 Visible dish; C4 Double projection; C5 Colour wheel. Scene families: Oil blobs; Water and dye; Bubbles; Wet-on-wet bloom; Drips; Meniscus edge; Marbling; Colour wheel show; Slow aurora; Swirled dish. Details in composition.md and scene-families.md.

**4. What are its typography rules?** Slide > dye bloom near the slide > fluid field. Emphasis: Word (authored): the word's letters brighten (exposure +15%); line: slide change. Spacing: Letter-mask Latin +3% tracking (thin gaps between letters block fluid less); complex scripts default. Full rules in typography.md.

**5. How does it animate?** The hand: dishes rock, swirl, get squeezed; bubbles split and merge; dye blooms from a point. Motion has a performer's intention. Rock period 4-9 s; squeeze 180 ms on beats; blooms 1-2 s spread.

**6. How does it respond to lyrics and music?** Authored words: Authored words: a small bloom of dye at a position near the slide for each word start (max 4 per second). Lines: A new drop of dye or a slide change per line. No beat grid: Gestures on line starts and at fixed slow periods (rock every 6-9 s). Complete without beats.

**7. What exact assets must be produced?** 107 entries in asset-manifest.json across 7 asset families plus composition, scene and transition specs: Fluid presets (40); Baked flow fields (10); Dish masks (6); Slide treatments (6); Dye palettes (12); Colour wheels (5); Hand gestures (8).

**8. Why does each asset exist?** Each family's purpose: Fluid presets: Each preset is an instrument; fluid family named first. Baked flow fields: The hand's gestures as data, so the fluid is deterministic and cheap. Dish masks: Shows the physical dish. Slide treatments: Isolates the type from the fluid. Dye palettes: Colour per song. Colour wheels: The rotating colour wheel of light shows. The rest in asset-strategy.md; each manifest entry carries its own purpose.

**9. Which assets are redundant?** 4 candidates were rejected or merged during review: Noise gradient (rejected: The old generic look.); Lava lamp (rejected: A different object; reads as kitsch.); Kaleidoscope (rejected: Generic trippy shader, explicitly excluded.); Tunnel zoom (rejected: Generic shader look.)

**10. How do assets combine?** Layer order: darkness (outside the dish) > dish layer A fluid > dish layer B fluid (additive, optional) > colour wheel tint > dish rim and meniscus > slide (letter mask or band) and text > halo and lamp grain. Required: One fluid preset, one palette, one slide treatment.

**11. Which combinations are invalid?** Two dishes with 4 dyes each (Mud and white-out.); Hue cycling with faster than 1 cycle per 4 s (Flash and cliché.); Letter masks with lines over 3 words (Letters too small to show fluid.); Monochrome palette with water and dye (Ink's territory.); Squeeze on beat with beat grid under 0.5 confidence (Would misfire.); Black intro with any (Observed bug; intro starts lit.)

**12. How do scenes vary meaningfully?** Major dimensions: Fluid family (10); Composition (band, letter mask, dish, double, wheel); Preset character (viscosity, scale). Not counted as variation: Palette recolours; flow-field phase offsets.

**13. How is repetition prevented?** A fluid family at most 2 sections in a row; presets never repeat within a song except chorus recall.

**14. How do scenes evolve throughout a song?** Accumulating dyes within a dish; dishes swap at sections. Two projectors at once (second dish additive), colour wheel spinning faster (still under 1 rev per 4 s).

**15. How does the style adapt to different screen sizes?** Full-bleed dish with band slide: portrait Band in the lower third. Letter-mask slide: portrait 2-3 lines stacked. Visible dish: portrait Dish 90% width. All families in composition.md.

**16. How does it handle different languages?** Hindi: Letter masks allowed (bold Devanagari, whole words); band slide for lines over 2 words. Tamil: Band slide preferred (long words); letter masks for one-word lines. Mixed: Band slide. RTL: Both, right-aligned bands. Fallback: Noto Sans bold of the script.

**17. What technical infrastructure does it require?** Fluid shader: multi-step advection of dye textures along baked periodic flow fields with oil-cell thresholding and refraction; letter-mask slide compositing; additive dish layering with luminance cap. Reuses: Full-screen backdrop path at reduced resolution (host.fullscreen), bloom, shared flow-field sampler and noise.

**18. What performance constraints apply?** Target: 2.5 ms per dish at half resolution; 5 ms worst case with two dishes on the integrated GPU (to measure; tier down to one dish if over). Target: flow textures 512x512 RG16F x4 (8 MB), dye textures 1024 (8 MB); under 24 MB.

**19. How will production quality be evaluated?** Physical-liquid review (does it look like oil and dye?) for every preset; no mud; flash audit on squeezes and wheel; slide contrast floor test; generic-shader review against the old liquid look.

**20. What must be completed before the style is considered finished?** 40 presets tuned and reviewed; Flow textures baked and periodic; Two-dish budget measured; Flash audit; Golden frames.
