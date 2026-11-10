# Signage: design specification

Style 10 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


> The lyric on public display hardware: flaps, bulbs, neon, dots and LEDs.

Origin: New style from Phase 1 research; absorbs Neon noir's tubes and the split-flap idea. Phase 1 rank: 10 of 15.

Companion files: [typography](typography.md), [composition](composition.md), [motion](motion.md), [scene families](scene-families.md), [asset strategy](asset-strategy.md), [manifest](asset-manifest.json), [compatibility](compatibility.json), [review register](review-register.md).

## 1. Creative identity

**Artistic philosophy.** Lyrics as public announcements, with mechanical suspense: you watch the letters arrive.

**Core visual concept.** Each section puts the lyric on one piece of public display hardware in a place at night: a split-flap board in a station hall, a marquee on a theatre front, a neon sign in a diner window, a flip-dot sign on a bus, an LED ticker on an overpass. Characters land on their cues.

**Emotional character.** Nocturnal, urban, nostalgic, suspenseful, sometimes lonely, sometimes showy.

**Influences and references.** Split-flap boards, theatre marquees, neon signs, flip-dot and LED signs (research B.32-B.34).

**Distinguishing characteristics.** Mechanical, character-level motion with implied sound; the only style where hardware sets the type.

**Recurring motifs.** Flaps cycling, bulb chases, neon buzzing on, wet reflections, signs switching off at the end.

**Intended density.** Low to medium: one sign, one setting, weather.

**Material and compositional language.** Metal housings, glass, enamel, tube glass, LEDs, flaps, wet asphalt.

**Musical contexts.** Synth-pop, city pop, indie, R&B, electronic, travel songs, night songs, film-music style ballads; marquee for showy pop.

**Constant across every variation.** The lyric always lives on hardware; one hero sign; the place is at night or dusk; letters land on time.

**Why it is recognisable on any song.** A frame shows a lit sign in a dark place with the lyric in its panel and a reflection beneath.

**It must never look like:**

- Real brand, station, airline or transit authority names or liveries.
- Floating text outside a sign.
- Daytime flat lighting.
- Two hero signs competing.
- Neon that wobbles like a glow line (that is Phosphor).

## 2. Colour, lighting and materials

**Palette system.** Dark ambient (near-black blue or warm brown) plus the sign's light: neon colours (8 tube colours), LED amber, green, white, RGB matrix tinted from the song's cover colours.

**Accent behaviour.** The sign light is the only saturated colour; the reflection repeats it.

**Contrast requirements.** Panel text at least 4.5:1 against the unlit cells (lit cells usually 10:1).

**Lighting.** Signs are the light sources; spill on housing and ground; rim light on wet surfaces.

**Shadows.** Soft ambient; signs cast coloured spill.

**Surface materials.** Metal, glass, enamel.

**Texture system.** Glass grime, flap wear, bulb filaments.

**Atmosphere.** Rain, fog, haze shared generators.

**Colour transitions.** Light palette changes per section (a new sign).

**Song-specific adaptation.** Light palette chosen from identity (warm, cool, showy) and cover hues for RGB matrices.

**Material and colour variation rules.** One light family per sign; neon max 2 tube colours per sign.

## 3. Musical responsiveness

**Measured signals used.** Line and word times, gaps, hooks, beat grid.

**Estimates used (never treated as measured).** Estimated words, identity mood.

| Case | Behaviour |
|---|---|
| 1. Word-synchronised lyrics (authored word times) | Authored words: each character settles exactly on the word's time (flaps start cycling before so they land on the cue; neon letters buzz on at the cue). |
| 2. Line-synchronised lyrics | Whole line updates on the line start (all flaps cycle and settle within 400-700 ms). |
| 3. Estimated word timing | Characters settle sequentially left to right across the first 50% of the line; no per-word claims. |
| 4. No reliable timestamps | Board updates every 4 s with lyric chunks sized to the panel. |
| 5. Instrumental sections | Board shows break information as a departure: the song title, "next" and a countdown to the next line; marquee bulbs chase; neon idles with a flicker. |
| 6. Missing audio analysis (no beat grid, no energy) | Bulb chases at a fixed slow rate; complete without beats. |

**Beat (only when present).** Beat grid: bulb chases step on beats; flip-dot refresh pulses on downbeats.

**Energy and mood.** Energy chooses the hardware register (marquee for high, single neon for low).

**Lyric density.** Dense lines: wraps to more rows or switches to ticker scroll.

Styling never changes cue times: every behaviour above reads `lineAt()` and word times; nothing writes them.

## 4. Song-level progression

**Introduction.** Signs off in the dark; they switch on through the intro.

**Opening lines.** First board fills.

**Verses.** One sign and setting per verse.

**Choruses.** Brighter hardware (marquee, full neon, RGB matrix); bulbs all on.

**Bridge.** A different street or place, a different hardware.

**Instrumental breaks.** Departure-board break information.

**Repeated lines.** The hook reappears on its first sign with wear (a dead bulb, a flickering tube).

**High-energy moments.** Bulb chases, ticker speed, flap cascades.

**Quiet moments.** A single neon word in a window, rain.

**Ending.** Signs switch off one by one; the last light is the reflection.

**Fallback without structure.** No hooks: hardware changes at gap sections.

**How scenes change.** Night deepens across the song (dusk to late night to pre-dawn).

**Long-term interest.** Hardware x signs x settings x light palettes x weather; 9 hardware and 50 signs keep songs apart.

## 5. Technical requirements

**Reuses.** Character-cell pass (SHR-GEN), glow and bloom, rain on glass, wet reflection, depth fog, bundled fonts.

**New (proposed extensions, Phase 3).** Nine hardware renderers (shared cell framework), sign geometry and emissive masks, neon alphabets as tube paths, bulb letter set, departure-break board, sign lit/unlit pipeline, dot font atlases.

**Performance targets (targets until measured).** Target: GPU 1.5 ms at 1080p (board, bloom, reflection).

**Memory target.** Target: under 40 MB (plates, signs, atlases).

**Fallbacks.** Canvas 2D tier: cell hardware drawn in 2D without bloom (glow via shadowBlur).

**Export.** Flap cycling and flicker seeded per frame from track time.

## 6. Quality evaluation

Hardware motion review against owner-gathered reference footage; flash guard test on neon and bulbs; script coverage test (Devanagari, Tamil, Arabic, Hebrew, CJK lines routed to supported hardware); long-line wrap and ticker test; brand check on every sign (no real names).

## 7. Definition of finished (Phase 3)

- [ ] Nine hardware renderers
- [ ] Sign designs approved with brand check
- [ ] Neon alphabets for 4 scripts
- [ ] Flash guard verified
- [ ] Golden frames

## 8. The twenty planning questions

**1. What does the style look like?** Each section puts the lyric on one piece of public display hardware in a place at night: a split-flap board in a station hall, a marquee on a theatre front, a neon sign in a diner window, a flip-dot sign on a bus, an LED ticker on an overpass. Characters land on their cues.

**2. What makes it distinct?** Mechanical, character-level motion with implied sound; the only style where hardware sets the type.

**3. What composition families does it contain?** C1 Hero sign in a place; C2 The board; C3 Window sign; C4 Marquee front; C5 Ticker on a structure; C6 Wall of signs. Scene families: Station hall; Roadside motel; Theatre front; Diner window; Night bus; Overpass ticker; Stadium board; Bazaar lane; Airport gate; Harbour; Arcade alley; Last lights. Details in composition.md and scene-families.md.

**4. What are its typography rules?** Panel lyric > sign's own fixed text > setting. Emphasis: Hooks get the brighter register; emphasised words light in the accent tube colour (neon) or invert (dot matrix). Spacing: Cell-locked for flap, dot and LED; neon tube spacing authored. Full rules in typography.md.

**5. How does it animate?** Each hardware has its own honest rhythm: nothing floats, everything clicks, buzzes or steps. Flap cycle 40-60 ms per flap step; neon flicker-on 200-600 ms; bulb chase 80-160 ms per step; dot refresh 30 ms per column.

**6. How does it respond to lyrics and music?** Authored words: Authored words: each character settles exactly on the word's time (flaps start cycling before so they land on the cue; neon letters buzz on at the cue). Lines: Whole line updates on the line start (all flaps cycle and settle within 400-700 ms). No beat grid: Bulb chases at a fixed slow rate; complete without beats.

**7. What exact assets must be produced?** 157 entries in asset-manifest.json across 10 asset families plus composition, scene and transition specs: Hardware renderers (9); Sign designs (50); Settings (20); Neon tube alphabets (7); Bulb and marquee letters (5); Dot and cell font atlases (6); Light palettes (11); Hardware rhythms (12); Weather and street light layers (9); Break boards (5).

**8. Why does each asset exist?** Each family's purpose: Hardware renderers: Display technology is the main variety axis; one renderer per technology on a shared cell framework. Sign designs: Original signs give each section an object and a place; the largest handcrafted family. Settings: Places at night where signs live. Neon tube alphabets: Neon lettering in four scripts. Bulb and marquee letters: Marquee and arch signs. Dot and cell font atlases: Cell hardware type. The rest in asset-strategy.md; each manifest entry carries its own purpose.

**9. Which assets are redundant?** 11 candidates were rejected or merged during review: CRT monitor sign (rejected: Screen territory (Screenlife and Phosphor).); Nixie tubes (merged: Digits only; folded into seven-segment for numbers.); Projection on a wall (rejected: Not hardware; overlaps Celluloid.); Fast food chain style sign (rejected: Brand likeness.); Real station name board (rejected: Real place and transit authority likeness.); Generic "OPEN 24H" duplicate (merged: Duplicate of Open sign.); Famous skyline (rejected: Real place likeness.); Cyrillic and Greek tubes (rejected: Deferred: routed to LED sign until demand.) ...see review-register.md.

**10. How do assets combine?** Layer order: setting plate > depth fog > secondary unlit signs > hero sign housing > hardware panel (cells) > trim lights > glass > wet reflection > weather > post: bloom, grain. Required: Setting, hero sign, hardware.

**11. Which combinations are invalid?** Dot matrix with Devanagari or Tamil lines (No quality open dot font: falls back to LED sign.); Bulb chase with reduced motion (Motion rule.); Neon flicker faster than 3 Hz with any (Flash guard.); Daylight with any (Identity.); Two hero signs with any (Hierarchy.); Split-flap with lines over 4 rows of 24 at chosen size (Switch to ticker.)

**12. How do scenes vary meaningfully?** Major dimensions: Hardware; Sign design; Setting; Composition; Light palette; Weather. Not counted as variation: Recolours of a sign (light palettes are a separate family); lit and unlit states; mirrored signs.

**13. How is repetition prevented?** A sign at most once per section, three times per song (hook sign returns); hardware not the same for more than two consecutive sections; settings max 4 per song.

**14. How do scenes evolve throughout a song?** Night deepens across the song (dusk to late night to pre-dawn). Brighter hardware (marquee, full neon, RGB matrix); bulbs all on.

**15. How does the style adapt to different screen sizes?** Hero sign in a place: portrait Vertical sign or close crop. The board: portrait Board tilted to a tall column of rows. Window sign: portrait Tall window. All families in composition.md.

**16. How does it handle different languages?** Hindi: Flap cells hold whole aksharas (one cluster per flap); neon Devanagari alphabet; dot matrix not used (no open Devanagari dot font of quality): falls back to LED sign with Noto Sans. Tamil: Flap cells per cluster; neon Tamil alphabet; dot matrix falls back to LED sign. Mixed: Hardware chosen to support all scripts in the line (flap or LED sign); otherwise the line moves to an LED sign. RTL: Flap and LED rows fill right to left; neon Arabic alphabet; Hebrew via Unifont dots. Fallback: Any unsupported script: LED sign hardware with Noto Sans of the script.

**17. What technical infrastructure does it require?** Nine hardware renderers (shared cell framework), sign geometry and emissive masks, neon alphabets as tube paths, bulb letter set, departure-break board, sign lit/unlit pipeline, dot font atlases. Reuses: Character-cell pass (SHR-GEN), glow and bloom, rain on glass, wet reflection, depth fog, bundled fonts.

**18. What performance constraints apply?** Target: GPU 1.5 ms at 1080p (board, bloom, reflection). Target: under 40 MB (plates, signs, atlases).

**19. How will production quality be evaluated?** Hardware motion review against owner-gathered reference footage; flash guard test on neon and bulbs; script coverage test (Devanagari, Tamil, Arabic, Hebrew, CJK lines routed to supported hardware); long-line wrap and ticker test; brand check on every sign (no real names).

**20. What must be completed before the style is considered finished?** Nine hardware renderers; Sign designs approved with brand check; Neon alphabets for 4 scripts; Flash guard verified; Golden frames.
