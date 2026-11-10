# Phosphor: design specification

Style 13 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


> A single beam of light writes the words, then becomes the world.

Origin: New style from Phase 1 research (oscilloscope and light drawing). Phase 1 rank: 12 of 15.

Companion files: [typography](typography.md), [composition](composition.md), [motion](motion.md), [scene families](scene-families.md), [asset strategy](asset-strategy.md), [manifest](asset-manifest.json), [compatibility](compatibility.json), [review register](review-register.md).

## 1. Creative identity

**Artistic philosophy.** Continuity: everything is one line.

**Core visual concept.** A single beam writes each word in single-stroke lettering; between lines the line unwinds into a figure (a heart, a horizon, a wave, a spinning curve) and back into the next word. Two registers: the cold oscilloscope (green on black with a graticule) and the warm light painting (a long-exposure trail in a dark room).

**Emotional character.** Minimal, electronic, hypnotic, tender in the light-painting register.

**Influences and references.** Oscilloscope music, light drawings, vector projection (research B.11, B.12, B.29).

**Distinguishing characteristics.** The only style made of a single continuous stroke.

**Recurring motifs.** The dot at the start and end, persistence trails, Lissajous figures on hooks, the visible beam jump.

**Intended density.** Extremely low: one line.

**Material and compositional language.** Phosphor glow, glass screen, dark room air.

**Musical contexts.** Electronic, synth, ambient, minimal techno, IDM, lo-fi, love songs in the warm register.

**Constant across every variation.** One beam, one line, black field; words drawn in writing order.

**Why it is recognisable on any song.** A frame shows a glowing line writing a word or drawing a figure on black.

**It must never look like:**

- More than one beam.
- Filled shapes.
- Static text appearing without being drawn.
- Neon tubes in an environment (that is Signage).
- Busy backgrounds.

## 2. Colour, lighting and materials

**Palette system.** Black field; beam colour from the phosphor family (P1 green, P7 blue-white with yellow-green decay, P3 amber, white) or warm light painting (sparkler gold, torch white, red); cover tint optional for the warm register.

**Accent behaviour.** The beam head is brighter; hooks may switch the phosphor (green to amber).

**Contrast requirements.** Beam core at least 10:1 against the field; trail decays to 3:1 (not text).

**Lighting.** The beam is the only light; bloom halo.

**Shadows.** None.

**Surface materials.** Glass and phosphor (scope), air and dust (light painting).

**Texture system.** Faint screen grain, graticule.

**Atmosphere.** Dust motes in light painting.

**Colour transitions.** Phosphor change at the bridge.

**Song-specific adaptation.** Register from identity (cold vs warm); phosphor from genre tags.

**Material and colour variation rules.** One beam colour at a time.

## 3. Musical responsiveness

**Measured signals used.** Line and word times, word durations, gaps, beat grid.

**Estimates used (never treated as measured).** Estimated words.

| Case | Behaviour |
|---|---|
| 1. Word-synchronised lyrics (authored word times) | Authored words: the beam writes each word so the word completes at its cue plus its duration share; held words get flourish loops. |
| 2. Line-synchronised lyrics | Line-synced: the beam writes the line at a constant speed fitted to the first 70% of the line. |
| 3. Estimated word timing | Constant speed fit; no per-word claims. |
| 4. No reliable timestamps | Beam writes chunks every 4 s. |
| 5. Instrumental sections | The beam draws figures from the song's lexicon and curve families; beat-locked Lissajous when a grid exists. |
| 6. Missing audio analysis (no beat grid, no energy) | Curves evolve slowly without beat locking; complete without beats. |

**Beat (only when present).** Beat grid: Lissajous frequency ratios step on bars; figure morphs land on downbeats.

**Energy and mood.** Energy chooses beam speed, curve complexity and symmetry order.

**Lyric density.** Dense lines: smaller writing, faster beam; the line scrolls left as it writes.

Styling never changes cue times: every behaviour above reads `lineAt()` and word times; nothing writes them.

## 4. Song-level progression

**Introduction.** A dot in the centre, breathing.

**Opening lines.** The dot begins writing.

**Verses.** Words and simple figures.

**Choruses.** Complex figures and symmetry.

**Bridge.** Phosphor change (green to amber to white) or register change.

**Instrumental breaks.** Figures from the lexicon.

**Repeated lines.** The hook redraws with the same path but a symmetry added.

**High-energy moments.** Fast beam, high-order Lissajous.

**Quiet moments.** Slow beam, long persistence, simple figures.

**Ending.** The line returns to a dot, which fades.

**Fallback without structure.** No hooks: phosphor changes at gap sections.

**How scenes change.** Persistence lengthens across the song (the screen remembers more).

**Long-term interest.** Figures x curves x phosphors x registers; narrow by design, so repetition control is strict.

## 5. Technical requirements

**Reuses.** Thick lines and glow (SHR-GEN), bloom, film grain, bundled fonts for outline trace.

**New (proposed extensions, Phase 3).** Persistence buffer (ping-pong texture with decay), path morph (resample and interpolate on CPU), stroke font loader (Hershey format), outline-to-path tracer for scripts, curve generators, beat-locked parameter stepping.

**Performance targets (targets until measured).** Target: GPU 0.5 ms (persistence buffer plus thick line).

**Memory target.** Target: under 12 MB.

**Fallbacks.** Canvas 2D tier: full parity (2D lines with shadowBlur glow; persistence via an offscreen canvas fade).

**Export.** Persistence must be computed from time, not frame accumulation: export renders a fixed-length history window per frame so results match playback.

## 6. Quality evaluation

Stroke-font spike (gate PHO-G1): Hershey licence confirmed and outline-trace readability for Devanagari, Tamil and Arabic judged by native readers on a phone; persistence determinism test (export vs playback); flash guard; repetition test over 10 songs (narrow style).

## 7. Definition of finished (Phase 3)

- [ ] Stroke font licence verified
- [ ] Outline-trace gate passed or fallback declared per script
- [ ] Persistence deterministic in export
- [ ] Figures produced
- [ ] Golden frames

## 8. The twenty planning questions

**1. What does the style look like?** A single beam writes each word in single-stroke lettering; between lines the line unwinds into a figure (a heart, a horizon, a wave, a spinning curve) and back into the next word. Two registers: the cold oscilloscope (green on black with a graticule) and the warm light painting (a long-exposure trail in a dark room).

**2. What makes it distinct?** The only style made of a single continuous stroke.

**3. What composition families does it contain?** C1 Centre writing; C2 Figure; C3 Word and figure; C4 Symmetry; C5 Light painting room. Scene families: Green scope; Lissajous chorus; Amber terminal; Light painting; Sparkler night; Vector horizon; Heartline; Harmonograph; City line; Last dot. Details in composition.md and scene-families.md.

**4. What are its typography rules?** Writing beam > written word > trail > figure. Emphasis: Held words get a flourish (an underline loop) drawn after them. Spacing: Stroke font metrics. Full rules in typography.md.

**5. How does it animate?** The beam never jumps silently: it travels, or it jumps with a faint visible line like a real scope. Beam speed 0.6-3 screen widths per second; figure draw 0.6-2 s; morph 300-800 ms.

**6. How does it respond to lyrics and music?** Authored words: Authored words: the beam writes each word so the word completes at its cue plus its duration share; held words get flourish loops. Lines: Line-synced: the beam writes the line at a constant speed fitted to the first 70% of the line. No beat grid: Curves evolve slowly without beat locking; complete without beats.

**7. What exact assets must be produced?** 131 entries in asset-manifest.json across 9 asset families plus composition, scene and transition specs: Single-line figures (50); Curve generators (12); Stroke font configurations (9); Scope furniture and rooms (8); Beam colours (9); Persistence profiles (5); Beam behaviours (7); Morph rules (6); Symmetry rules (6).

**8. Why does each asset exist?** Each family's purpose: Single-line figures: Figures the beam draws between words, picked from the lexicon. Curve generators: Hooks and breaks: the style's abstract voice. Stroke font configurations: The beam writes words. Scope furniture and rooms: Register context with minimal clutter. Beam colours: Colour per register and section. Persistence profiles: Memory of the line. The rest in asset-strategy.md; each manifest entry carries its own purpose.

**9. Which assets are redundant?** 7 candidates were rejected or merged during review: Peace sign (rejected: Symbol too loaded and logo-like.); Second heart (merged: Duplicate subject.); Recognisable cartoon mouse ears (rejected: Character likeness.); Spectrum line (rejected: Implies audio analysis the app often lacks.); Random walk (rejected: Reads as noise, not drawing.); Laser show (rejected: More than one beam; overlaps concert imagery in Panels and Signage.); Radar sweep (rejected: Military imagery; not a writing surface.)

**10. How do assets combine?** Layer order: field (black) > furniture (graticule, bezel, room plate) > trail (persistence buffer) > beam line > beam head > bloom > post: grain, curvature. Required: Field, beam, stroke font.

**11. Which combinations are invalid?** Two beams with any (Identity.); Symmetry spin with reduced motion (Motion rule.); Fast flicker of the whole trace with any (Flash guard.); Outline trace with scripts failing the readability gate (Use declared fallback.); Figures with while a word is being written (Hierarchy.); Sparkler sparks with grief identity (Tone.)

**12. How do scenes vary meaningfully?** Major dimensions: Register (scope, light painting, vector display); Phosphor colour; Figure; Curve family; Symmetry. Not counted as variation: Parameter sweeps of one curve family (each family is one generator); recoloured figures; scaled figures.

**13. How is repetition prevented?** A figure at most once per section and twice per song; curve family not the same for consecutive breaks; phosphor max 3 per song.

**14. How do scenes evolve throughout a song?** Persistence lengthens across the song (the screen remembers more). Complex figures and symmetry.

**15. How does the style adapt to different screen sizes?** Centre writing: portrait Baseline width 90%, larger writing. Figure: portrait Centre. Word and figure: portrait Figure top. All families in composition.md.

**16. How does it handle different languages?** Hindi: Outline trace of Noto Sans Devanagari: the beam follows the glyph outline (double line), headline drawn last; readability gate. Tamil: Outline trace of Noto Sans Tamil; readability gate. Mixed: Per-run faces; one beam travels through all runs in reading order. RTL: Beam writes right to left; Arabic outline trace follows joins. Fallback: Any script fails the trace readability gate: the beam draws an underline sweep while the words appear in Noto Sans with a glow (declared fallback, not hidden).

**17. What technical infrastructure does it require?** Persistence buffer (ping-pong texture with decay), path morph (resample and interpolate on CPU), stroke font loader (Hershey format), outline-to-path tracer for scripts, curve generators, beat-locked parameter stepping. Reuses: Thick lines and glow (SHR-GEN), bloom, film grain, bundled fonts for outline trace.

**18. What performance constraints apply?** Target: GPU 0.5 ms (persistence buffer plus thick line). Target: under 12 MB.

**19. How will production quality be evaluated?** Stroke-font spike (gate PHO-G1): Hershey licence confirmed and outline-trace readability for Devanagari, Tamil and Arabic judged by native readers on a phone; persistence determinism test (export vs playback); flash guard; repetition test over 10 songs (narrow style).

**20. What must be completed before the style is considered finished?** Stroke font licence verified; Outline-trace gate passed or fallback declared per script; Persistence deterministic in export; Figures produced; Golden frames.
