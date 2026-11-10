# Nocturne: design specification

Style 7 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


> One light in the dark; intimate type and negative space.

Origin: Merges Nocturne, Velvet, Stillness (directions), Minimal (classic) and the Lyrics app rolling column. Phase 1 rank: 13 of 15 (Phase 1 score 7.45).

Companion files: [typography](typography.md), [composition](composition.md), [motion](motion.md), [scene families](scene-families.md), [asset strategy](asset-strategy.md), [manifest](asset-manifest.json), [compatibility](compatibility.json), [review register](review-register.md).

## 1. Creative identity

**Artistic philosophy.** Intimacy and silence. One source of light and a few words; everything else is shadow.

**Core visual concept.** A dark frame with a single light: a lamp, a streetlight through rain on glass, a candle, a window at dawn, moonlight on water. The lyric sits where the light falls, set in a quiet serif or thin sans, arriving as focus resolves.

**Emotional character.** Tender, lonely, calm, private.

**Influences and references.** Night photography and cinema colour temperature; minimal typographic lyric design; the existing calm directions.

**Distinguishing characteristics.** The collection's quiet room: the most negative space, the least motion, and the reading mode of the app.

**Recurring motifs.** A light pool; rain on glass; bokeh; dust in a beam; focus pulls; breathing light.

**Intended density.** Very low: 70-90% negative space.

**Material and compositional language.** Darkness, glass, light; a whisper of grain.

**Musical contexts.** Ballads, ambient, lo-fi, piano, acoustic, slow R&B, late-night songs; and anyone who wants calm reading.

**Constant across every variation.** One light source; one or two lines; slow motion only; no bursts; text lit by the light.

**Why it is recognisable on any song.** Darkness with one light and a few lit words.

**It must never look like:**

- A moody stock video (people, faces, cityscapes in focus).
- More than one competing light.
- Fast motion, shakes, bursts or flashes.
- Heavy film grain (Celluloid's territory).
- UI elements (Screenlife's territory) in the screen-glow scene.

## 2. Colour, lighting and materials

**Palette system.** Darkness at L 4-10 tinted by the light's complement (warm light: blue-black; cool light: brown-black). Light colour from cover temperature: warm (2700-3200 K equivalent: amber, candle), neutral (4000 K: lamp white), cool (6500 K and moonlight: blue-silver), or one cover hue at low saturation for streetlight sodium.

**Accent behaviour.** The lit word takes the light's colour at full lightness; other words dim to 60%.

**Contrast requirements.** Active line 7:1 against its local background (the light pool); completed lines 3:1 (they recede).

**Lighting.** One practical source with a soft falloff; the text sits where the light falls; light breathes 3-5% over 6-10 s.

**Shadows.** Room silhouettes in shadow (L under 12) only at frame edges.

**Surface materials.** Glass (rain), air (dust, fog), darkness.

**Texture system.** Grain at 0.03 (whisper), never heavier.

**Atmosphere.** Dust motes in beams, fog, rain on glass, snow.

**Colour transitions.** Light colour changes only at the bridge (the light moves or warms); 4-6 s cross-fades.

**Song-specific adaptation.** Cover temperature and brightness pick the light; subjects pick the scene (rain, city, water, room).

**Material and colour variation rules.** Never two light colours; palette changes never faster than 4 s.

## 3. Musical responsiveness

**Measured signals used.** Line and word times, gaps, hooks.

**Estimates used (never treated as measured).** Estimated words, mood, energy (used only to choose calmer or less calm scenes).

| Case | Behaviour |
|---|---|
| 1. Word-synchronised lyrics (authored word times) | Authored words catch the light: each word brightens from 60% to 100% over 200 ms on its start. |
| 2. Line-synchronised lyrics | Whole line resolves from soft focus (blur 6 px to 0 over 500 ms) at the line start. |
| 3. Estimated word timing | Whole-line focus only. |
| 4. No reliable timestamps | Rolling column of the full lyric at reading pace (one line per 4 s), the current line lit. |
| 5. Instrumental sections | Only the light and the weather move: rain runs, dust drifts, the light breathes; after 12 s the light slowly moves (a car passing outside). |
| 6. Missing audio analysis (no beat grid, no energy) | Nothing changes: the style ignores beats by design. |

**Beat (only when present).** Ignored, except an optional breathing at very low gain (1%) on bars when a grid exists and intensity is normal.

**Energy and mood.** Energy chooses scene families (energetic songs get the night street and car; calm songs get candle and lamp).

**Lyric density.** Dense lyrics: the rolling column composition (lines visible above and below).

Styling never changes cue times: every behaviour above reads `lineAt()` and word times; nothing writes them.

## 4. Song-level progression

**Introduction.** Darkness, then the light turns on (1.5-3 s warm-up of the lamp or streetlight).

**Opening lines.** The first line resolves into focus in the light pool.

**Verses.** One scene; weather builds slowly (rain thickens across a verse).

**Choruses.** The light warms and widens (radius +15%, lightness +6%).

**Bridge.** The light moves: a car passes, a cloud covers the moon, a curtain moves; scene can change by a slow dissolve.

**Instrumental breaks.** Light and weather only.

**Repeated lines.** Repeated lines appear in the same place, slightly brighter each time.

**High-energy moments.** Night street or car scene with passing lights (still slow).

**Quiet moments.** Candle or lamp; single word compositions.

**Ending.** The light dims to off over 3 s after the last line; the last line holds and fades last.

**Fallback without structure.** No hooks: scene dissolves at gap sections only.

**How scenes change.** One persistent scene per song half; the light evolves rather than the scene changing.

**Long-term interest.** 11 scene families with different lights and weather; restraint is the identity, so the count is small by design.

## 5. Technical requirements

**Reuses.** Calm directions in the Clean renderer (Canvas 2D), shared bokeh, rain on glass, grain, focus blur (mip), LRU.

**New (proposed extensions, Phase 3).** Light pool renderer with falloff and breathing; rain refraction masked by the text box; focus resolve per line.

**Performance targets (targets until measured).** Target: 1.5 ms GPU at 1280x720; rain refraction at half resolution.

**Memory target.** Target: under 16 MB.

**Fallbacks.** Canvas 2D tier: lamp room, candle, column and halo fully; rain as static droplet image.

**Export.** Pure functions of t.

## 6. Quality evaluation

Readability is the main check (7:1 active line); monotony review over a full 5-minute song; calm review (no motion faster than the motion language allows); rain mask check.

## 7. Definition of finished (Phase 3)

- [ ] 11 scene families reviewed
- [ ] Column mode as the reading mode tested with untimed lyrics
- [ ] Full-song monotony review on 3 ballads
- [ ] Golden frames

## 8. The twenty planning questions

**1. What does the style look like?** A dark frame with a single light: a lamp, a streetlight through rain on glass, a candle, a window at dawn, moonlight on water. The lyric sits where the light falls, set in a quiet serif or thin sans, arriving as focus resolves.

**2. What makes it distinct?** The collection's quiet room: the most negative space, the least motion, and the reading mode of the app.

**3. What composition families does it contain?** C1 Light and text opposite; C2 Centred halo; C3 Rolling column; C4 Window rain; C5 Low horizon; C6 Screen glow. Scene families: Lamp room; Window rain; Night street; Candle; Dawn window; Moonlight on water; Car at night; Train window; Snow under a streetlight; Screen glow; Reading room. Details in composition.md and scene-families.md.

**4. What are its typography rules?** Active line > light source > completed line > room. Emphasis: Word (authored): catches the light; line: focus resolve. Spacing: Latin serif +1%; thin sans +2%; leading 1.5; complex scripts default spacing, leading 1.7 (taller scripts). Full rules in typography.md.

**5. How does it animate?** Slow. Fades, focus pulls, breathing light, drifting dust. Nothing cuts except at true sections, and then as a slow dissolve. Fades 400-800 ms; dissolves 2-4 s; light changes 4-6 s.

**6. How does it respond to lyrics and music?** Authored words: Authored words catch the light: each word brightens from 60% to 100% over 200 ms on its start. Lines: Whole line resolves from soft focus (blur 6 px to 0 over 500 ms) at the line start. No beat grid: Nothing changes: the style ignores beats by design.

**7. What exact assets must be produced?** 81 entries in asset-manifest.json across 8 asset families plus composition, scene and transition specs: Light sources (10); Weather and air layers (7); Bokeh arrangements (7); Room and place silhouettes (12); Grain profiles (3); Light palettes (7); Layouts (7); Type pairings (6).

**8. Why does each asset exist?** Each family's purpose: Light sources: The light is the style. Weather and air layers: Life in the dark without action. Bokeh arrangements: Distance and place without detail. Room and place silhouettes: Place the light in a space. Grain profiles: Keeps darkness alive without texture. Light palettes: Song adaptation by temperature. The rest in asset-strategy.md; each manifest entry carries its own purpose.

**9. Which assets are redundant?** 2 candidates were rejected or merged during review: Fireplace (merged: Too close to Candle and to Glyph Cinema's fire; a second flame scene adds no new structure.); Neon reflection street (rejected: Signage territory.)

**10. How do assets combine?** Layer order: darkness ground (tinted) > far plane (bokeh, horizon) > room or window silhouettes > light source and pool > weather (rain plane, dust, snow, fog) > text > grain whisper. Required: One light; darkness; text.

**11. Which combinations are invalid?** Two light sources with any (Identity rule.); Rain plane with over the text box (Readability.); Heavy grain (over 0.05) with any (Celluloid territory.); Beat-driven motion with any above 1% gain (Calm rule.); Interface elements with screen glow (Screenlife territory.); Candle flicker with over 1 Hz (Flash and calm rule.)

**12. How do scenes vary meaningfully?** Major dimensions: Scene family (light and place); Composition (opposite, halo, column, window, horizon, glow); Weather. Not counted as variation: Light hue shifts and bokeh seeds.

**13. How is repetition prevented?** Max 2 scenes per song; within a scene, the composition alternates between at most 2 families. Across songs repetition is accepted by design (restraint), but ties are seeded by track id.

**14. How do scenes evolve throughout a song?** One persistent scene per song half; the light evolves rather than the scene changing. The light warms and widens (radius +15%, lightness +6%).

**15. How does the style adapt to different screen sizes?** Light and text opposite: portrait Light top, text lower third. Centred halo: portrait Centre. Rolling column: portrait Column full width. All families in composition.md.

**16. How does it handle different languages?** Hindi: Light weights of Noto Serif Devanagari; no italics (second line uses lower opacity instead); no tracking. Tamil: As Hindi. Mixed: Per run faces. RTL: Mirrored placement; right-aligned. Fallback: Noto Sans light weights of the script.

**17. What technical infrastructure does it require?** Light pool renderer with falloff and breathing; rain refraction masked by the text box; focus resolve per line. Reuses: Calm directions in the Clean renderer (Canvas 2D), shared bokeh, rain on glass, grain, focus blur (mip), LRU.

**18. What performance constraints apply?** Target: 1.5 ms GPU at 1280x720; rain refraction at half resolution. Target: under 16 MB.

**19. How will production quality be evaluated?** Readability is the main check (7:1 active line); monotony review over a full 5-minute song; calm review (no motion faster than the motion language allows); rain mask check.

**20. What must be completed before the style is considered finished?** 11 scene families reviewed; Column mode as the reading mode tested with untimed lyrics; Full-song monotony review on 3 ballads; Golden frames.
