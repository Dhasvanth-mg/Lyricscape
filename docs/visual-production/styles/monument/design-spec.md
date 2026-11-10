# Monument: design specification

Style 15 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


> Words become architecture; the camera walks through the song.

Origin: New style from Phase 1 research; the only true 3D style. Gated on a prototype. Phase 1 rank: 9 of 15 (gated; reserve Riso Riot).

Companion files: [typography](typography.md), [composition](composition.md), [motion](motion.md), [scene families](scene-families.md), [asset strategy](asset-strategy.md), [manifest](asset-manifest.json), [compatibility](compatibility.json), [review register](review-register.md).

## 1. Creative identity

**Artistic philosophy.** Monumental space and scale: a song is something you can walk through.

**Core visual concept.** Each line is extruded into architecture: a wall, a stair, a bridge, a tunnel of letters. The sung word is the façade facing the camera, readable flat-on; earlier lines recede behind as buildings. The camera walks through the song, light sweeps the forms, and the ending is an aerial view of the city the song built.

**Emotional character.** Awe, scale, solitude, triumph.

**Influences and references.** Typographic architecture and projection mapping as methods (research B.45, B.29).

**Distinguishing characteristics.** Depth and scale no other style has; the per-song city ending is unique by construction.

**Recurring motifs.** Façades rising on cue, the walking camera, light sweeps, fog, the aerial city.

**Intended density.** Low near, high far: one façade near, the city behind.

**Material and compositional language.** Concrete, glass, paper, plaster, light.

**Musical contexts.** Anthems, cinematic pop, post-rock, epic film songs, electronic builds.

**Constant across every variation.** The current line is a readable façade facing the camera; architecture is made of the song's words; the camera walks.

**Why it is recognisable on any song.** A frame shows a word as a monumental façade in deep perspective with fog and earlier words as buildings.

**It must never look like:**

- Generic flying 3D text.
- Text unreadable because of perspective.
- Real buildings or landmarks.
- Fast swooping cameras.
- Glossy chrome logo look.

## 2. Colour, lighting and materials

**Palette system.** Material colours (concrete greys, warm plaster, glass blue-green) under a lighting rig; fog colour from the cover's dominant hue; projection light in the cover's hot hue.

**Accent behaviour.** The active façade is lit (sweep or spotlight).

**Contrast requirements.** Active façade text at least 4.5:1 against its own surface via a lighting and edge shading contract (face lit, sides darker).

**Lighting.** Lighting rigs (day, golden hour, night projection, fog); one key light.

**Shadows.** Soft shadow from the key light (baked per façade on rise).

**Surface materials.** Procedural materials.

**Texture system.** Material noise.

**Atmosphere.** Depth fog (shared generator).

**Colour transitions.** Lighting rig change per section.

**Song-specific adaptation.** Fog and projection from the cover; rig from identity.

**Material and colour variation rules.** One material family per section.

## 3. Musical responsiveness

**Measured signals used.** Line and word times, gaps, hooks, beat grid, section boundaries.

**Estimates used (never treated as measured).** Estimated words.

| Case | Behaviour |
|---|---|
| 1. Word-synchronised lyrics (authored word times) | Authored words: each word's block rises from the ground on its cue. |
| 2. Line-synchronised lyrics | Line-synced: the whole façade rises at the line start (600 ms). |
| 3. Estimated word timing | Whole façade rises; no per-word claims. |
| 4. No reliable timestamps | A façade every 4 s. |
| 5. Instrumental sections | The camera travels through the city built so far. |
| 6. Missing audio analysis (no beat grid, no energy) | Light sweeps on a fixed slow period; complete without beats. |

**Beat (only when present).** Beat grid: light sweeps on bars.

**Energy and mood.** Energy sets walking speed and façade scale.

**Lyric density.** Dense lines: longer façades along a wall; the camera walks beside them.

Styling never changes cue times: every behaviour above reads `lineAt()` and word times; nothing writes them.

## 4. Song-level progression

**Introduction.** An empty plane in fog.

**Opening lines.** The first façade rises.

**Verses.** Walls along a path, walking pace.

**Choruses.** A monumental version: bigger, lit, the camera stops to look up.

**Bridge.** The camera turns a corner into a different template (a stair, a tunnel).

**Instrumental breaks.** Flythrough of the built city.

**Repeated lines.** The hook façade returns as the same building seen from a new angle.

**High-energy moments.** Faster walk, bigger façades, sweeps.

**Quiet moments.** Slow walk in fog, small façades.

**Ending.** Aerial pull-back over the whole city of the song: a unique image per song.

**Fallback without structure.** No hooks: corner turns at gap sections.

**How scenes change.** The city grows line by line.

**Long-term interest.** Templates x materials x rigs x city layouts; the city is unique per song.

## 5. Technical requirements

**Reuses.** Depth fog (SHR-GEN), film grain, bundled fonts, scene host uniforms.

**New (proposed extensions, Phase 3).** 3D path in the host (perspective camera, depth buffer), sprite-stack extrusion (any script), optional Latin mesh extrusion from font outlines, procedural materials, shadow pass, instanced city, camera planner.

**Performance targets (targets until measured).** Target (unproven, gate MON-G1): 60 fps at 1080p on an integrated GPU with a 40-line city; under 6 ms GPU.

**Memory target.** Target: under 64 MB.

**Fallbacks.** Canvas 2D tier: none (style unavailable); the picker hides Monument where WebGL2 is missing.

**Export.** Camera and rise are functions of time; city layout deterministic.

## 6. Quality evaluation

Prototype spike MON-G1 (readability while moving on phone and 1080p, integrated GPU performance, Devanagari and Tamil sprite stack); façade angle test; motion comfort review (no swoops); determinism in export.

## 7. Definition of finished (Phase 3)

- [ ] MON-G1 passed and owner approved
- [ ] Templates and materials produced
- [ ] Aerial ending works
- [ ] Golden frames

## 8. The twenty planning questions

**1. What does the style look like?** Each line is extruded into architecture: a wall, a stair, a bridge, a tunnel of letters. The sung word is the façade facing the camera, readable flat-on; earlier lines recede behind as buildings. The camera walks through the song, light sweeps the forms, and the ending is an aerial view of the city the song built.

**2. What makes it distinct?** Depth and scale no other style has; the per-song city ending is unique by construction.

**3. What composition families does it contain?** C1 Façade ahead; C2 Wall walk; C3 Look up; C4 Aerial. Scene families: Canyon of walls; Spiral stair; Bridge; Plaza; Tunnel; Glass city night; Paper town; Pier into the sea; The song city. Details in composition.md and scene-families.md.

**4. What are its typography rules?** Active façade > previous façade > city. Emphasis: Hooks: monumental scale and the lit face. Spacing: Block spacing per word. Full rules in typography.md.

**5. How does it animate?** A steady walk: weight, not swoops. Rise 400-700 ms; walk 1.2-2.5 m/s equivalent; corner 2 s; aerial 6-8 s.

**6. How does it respond to lyrics and music?** Authored words: Authored words: each word's block rises from the ground on its cue. Lines: Line-synced: the whole façade rises at the line start (600 ms). No beat grid: Light sweeps on a fixed slow period; complete without beats.

**7. What exact assets must be produced?** 92 entries in asset-manifest.json across 11 asset families plus composition, scene and transition specs: Extrusion methods (5); Architectural templates (14); Materials (10); Lighting rigs (8); Projection sweeps (6); Camera paths (9); Fog and sky (7); Ground planes (5); City layout rules (5); Façade type settings (5); Reserve: Riso Riot outline (1).

**8. Why does each asset exist?** Each family's purpose: Extrusion methods: The core: words become architecture; the method decides readability and script support. Architectural templates: Place and camera variety. Materials: Material per section. Lighting rigs: Mood per section. Projection sweeps: Beat-tied light on the architecture. Camera paths: How the song is walked. The rest in asset-strategy.md; each manifest entry carries its own purpose.

**9. Which assets are redundant?** 6 candidates were rejected or merged during review: Maze (rejected: Camera would hide words; readability.); Pyramid (rejected: Monument cliché, reads as a logo.); Chrome (rejected: Cliché logo look.); Orbit swoop (rejected: Motion language: no swoops.); Famous skyline (rejected: Real place likeness.); Space station (rejected: Generic flythrough; no ground, no walk.)

**10. How do assets combine?** Layer order: sky gradient > distant fog > ground plane > city (instanced past façades) > active façade > lighting and shadow > projection sweep > dust > post: fog, grain. Required: Ground, active façade, lighting rig, fog.

**11. Which combinations are invalid?** Mesh extrusion with complex scripts (Shaping: use sprite stack.); Camera travel with reduced motion (Motion rule.); Façade angle over 15 degrees with reading moment (Readability.); Glossy chrome with any (Cliché.); Fast swoop with any (Motion language.); Real buildings with any (Likeness.)

**12. How do scenes vary meaningfully?** Major dimensions: Architectural template; Material; Lighting rig; Camera path; City layout. Not counted as variation: Material colour variants; camera speed variants; the per-song city (emergent, not an asset).

**13. How is repetition prevented?** Templates max 4 per song; consecutive sections differ in template; hook façade reused as the same building.

**14. How do scenes evolve throughout a song?** The city grows line by line. A monumental version: bigger, lit, the camera stops to look up.

**15. How does the style adapt to different screen sizes?** Façade ahead: portrait Façade stacked storeys. Wall walk: portrait Wall more frontal. Look up: portrait Natural. All families in composition.md.

**16. How does it handle different languages?** Hindi: Sprite stack only (shaped text rendered by the browser into layers): correct shaping, no mesh extrusion. Tamil: Sprite stack only. Mixed: Sprite stack for the whole line when any complex run exists. RTL: Sprite stack; reading order right to left along walls. Fallback: Sprite stack for any script; mesh extrusion is a Latin-only enhancement.

**17. What technical infrastructure does it require?** 3D path in the host (perspective camera, depth buffer), sprite-stack extrusion (any script), optional Latin mesh extrusion from font outlines, procedural materials, shadow pass, instanced city, camera planner. Reuses: Depth fog (SHR-GEN), film grain, bundled fonts, scene host uniforms.

**18. What performance constraints apply?** Target (unproven, gate MON-G1): 60 fps at 1080p on an integrated GPU with a 40-line city; under 6 ms GPU. Target: under 64 MB.

**19. How will production quality be evaluated?** Prototype spike MON-G1 (readability while moving on phone and 1080p, integrated GPU performance, Devanagari and Tamil sprite stack); façade angle test; motion comfort review (no swoops); determinism in export.

**20. What must be completed before the style is considered finished?** MON-G1 passed and owner approved; Templates and materials produced; Aerial ending works; Golden frames.
