# Celluloid: design specification

Style 5 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


> Film title-sequence craft: scratched, backlit, step-printed.

Origin: Merges Analog Cinema (direction), Film and Retro VHS (classic looks); redesigned around the film medium. Phase 1 rank: 8 of 15 (Phase 1 score 7.85).

Companion files: [typography](typography.md), [composition](composition.md), [motion](motion.md), [scene families](scene-families.md), [asset strategy](asset-strategy.md), [manifest](asset-manifest.json), [compatibility](compatibility.json), [review register](review-register.md).

## 1. Creative identity

**Artistic philosophy.** Cinema as material: the frame, the gate, the stock and the splice are the visual language.

**Core visual concept.** The lyric is presented as a film title sequence for the whole song. Words are etched, backlit, printed on stock, scratched into black leader and projected; the frame weaves in the gate; splices, leader and light leaks punctuate sections; each section is a stock.

**Emotional character.** Cinematic, nostalgic, sometimes tense (scratchboard), sometimes dreamy (backlit optical), sometimes warm (Super 8).

**Influences and references.** Title design for film, optical printing, direct-on-film animation, home movies, analogue tape.

**Distinguishing characteristics.** The only style whose texture is time-based media itself: frames, gates, stocks, cuts.

**Recurring motifs.** Letterbox; gate weave; leader and countdown; splice tape; light leaks; step-printed smears; subtitle box; intertitle borders.

**Intended density.** Low: one word or one line at a time; texture is the richness.

**Material and compositional language.** Film base, emulsion, grain, dust, scratches; projection light; magnetic tape for the tape stock.

**Musical contexts.** Any genre; cinematic songs, soundtracks, rock, indie, dark pop, ballads (backlit optical), nostalgic songs (Super 8).

**Constant across every variation.** Believable film physics: frame-quantised motion of damage, consistent stock per section, gate weave always present (subtle), one title register per section.

**Why it is recognisable on any song.** Every frame is clearly a film frame: grain, gate, a title-card composition.

**It must never look like:**

- A grain filter over a modern layout.
- Look-alikes of famous title sequences (specific type, colours, scratch styles).
- Studio logos or countdown leaders copied from real studios.
- Strobing flash frames: flash frames are limited by the flash rule.
- Nostalgia clichés stacked (every effect at once).

## 2. Colour, lighting and materials

**Palette system.** Per stock profile: colour negative (cool shadows, warm highlights), black-and-white reversal (neutral to slightly warm), warm reversal (saturated warm, home-movie), tape (lifted blacks, chroma bleed), high-contrast lith (pure black and white with one tint), toned (amber or blue monochrome).

**Accent behaviour.** Titles are white, cream or the stock's highlight colour; never coloured text except the toned stock's tint.

**Contrast requirements.** Subtitle register: text 7:1 against a darkened subtitle area (letterbox bar or a soft shadow box); title cards: white on black 15:1 minus grain.

**Lighting.** Projected light: hot centre falloff (vignette), flicker 1-3% luminance variation at 24 fps, light leaks from frame edges.

**Shadows.** None (flat film frames), except projection-room composition (beam and room).

**Surface materials.** Film base, emulsion scratches, splice tape, black leader, magnetic tape dropout.

**Texture system.** Grain per stock (shared grain generator with per-stock size and strength), dust, hair, scratches as plates.

**Atmosphere.** Projector beam haze in the projection room; light leaks.

**Colour transitions.** Stock changes at sections with a splice; grades change only with stocks.

**Song-specific adaptation.** Mood selects stocks (dark and tense: lith and scratch; warm and nostalgic: warm reversal; dreamy: backlit optical; energetic: burst at choruses); cover tints the grade within stock limits.

**Material and colour variation rules.** One stock per section; damage profile per stock; grades never leave the stock's character.

## 3. Musical responsiveness

**Measured signals used.** Line and word times, gaps, hooks, beat grid.

**Estimates used (never treated as measured).** Estimated words, mood, energy.

| Case | Behaviour |
|---|---|
| 1. Word-synchronised lyrics (authored word times) | Per-word scratch-ins or backlit assembly on authored word starts; burst register (chorus) cuts word by word on authored starts, minimum 4 frames (167 ms) per word. |
| 2. Line-synchronised lyrics | Whole-line title cards; subtitles appear on line start, leave on line end. |
| 3. Estimated word timing | Whole-line cards only; no burst register (it would claim word cuts). |
| 4. No reliable timestamps | Subtitles of the whole lyric scroll as a credit roll at reading pace over the stock's plates. |
| 5. Instrumental sections | Leader, countdown (original), projector light on empty frames, light leaks; after 10 s a reel change cue (original design dots) and a stock change. |
| 6. Missing audio analysis (no beat grid, no energy) | Cut rate follows lines; gate and flicker are constant. Complete without beats. |

**Beat (only when present).** With a beat grid: cut rate quantised to beats in bursts; flicker modulated at low depth on downbeats (flash-limited).

**Energy and mood.** Energy chooses register and cut rate (dreamy assembly vs burst).

**Lyric density.** Dense lines: subtitle register (two-line subtitles) instead of title cards.

Styling never changes cue times: every behaviour above reads `lineAt()` and word times; nothing writes them.

## 4. Song-level progression

**Introduction.** Leader and an original countdown, ending exactly at the first line's lead-in (countdown length fitted to the intro, 3-8 s; shorter intros start mid-countdown).

**Opening lines.** First line as an opening title card (centred register).

**Verses.** One stock and one title register; damage accumulates slowly (more dust and scratches as the reel plays).

**Choruses.** Stock change or the burst register; later choruses recall the first chorus stock.

**Bridge.** Negative image or a burn-through to white then a new stock.

**Instrumental breaks.** Leader, countdown, light leaks, projector light.

**Repeated lines.** Repeated lines are reprinted with more damage each time (the same title card, older).

**High-energy moments.** Burst register with beat-quantised cuts; step-printed smears.

**Quiet moments.** Backlit optical dissolves; minimal damage.

**Ending.** The reel runs out: tail leader, the film flaps, white light, then black.

**Fallback without structure.** No hooks: stocks change on gap sections; otherwise every 26 s.

**How scenes change.** Reel metaphor: damage accumulates within a stock; stocks change at sections like reels.

**Long-term interest.** Six stocks x six registers x damage profiles; mood chooses stocks so different songs are different films.

## 5. Technical requirements

**Reuses.** POST_FS grain, flicker and vignette uniforms (grain, chroma, scan, curve, vignette, exposure, flash), mblur for step print, LRU cache, director sections.

**New (proposed extensions, Phase 3).** Gate weave and frame-rate quantiser (t to frame index), plate player (frame-stepped sprite strips), stock profiles as post uniform presets, subtitle layout (cinema rules), backlit assembly, scratch jitter, flash guard integration.

**Performance targets (targets until measured).** Target: 2 ms GPU at 1280x720; plates decoded once.

**Memory target.** Target: under 40 MB (3 plates, one animated strip, title sheets).

**Fallbacks.** Canvas 2D tier: subtitle and card registers with a grain overlay image; no weave.

**Export.** Frame-stepping by t; animated plates indexed by floor(t*24) (or 18, 12).

## 6. Quality evaluation

Plate review (no source footage, no seams); flash audit with the shared flash guard; cinema subtitle rules check (42 characters, 2 lines); look-alike review against famous title sequences; stock side-by-side review on one passage.

## 7. Definition of finished (Phase 3)

- [ ] Six stocks tuned and reviewed
- [ ] All plates produced and reviewed
- [ ] Countdown designs original and approved
- [ ] Flash audit passed
- [ ] Subtitle register in 4 scripts
- [ ] Golden frames per scene

## 8. The twenty planning questions

**1. What does the style look like?** The lyric is presented as a film title sequence for the whole song. Words are etched, backlit, printed on stock, scratched into black leader and projected; the frame weaves in the gate; splices, leader and light leaks punctuate sections; each section is a stock.

**2. What makes it distinct?** The only style whose texture is time-based media itself: frames, gates, stocks, cuts.

**3. What composition families does it contain?** C1 Letterbox subtitle; C2 Centred title card; C3 Scratchboard; C4 Projection room; C5 Film strip; C6 Title burst; C7 Leader and countdown. Scene families: Colour negative night; Black-and-white reversal; Home movie; Tape; High-contrast lith; Scratch on leader; Backlit optical; Projection room; Silent intertitles; Title burst; Leader and countdown. Details in composition.md and scene-families.md.

**4. What are its typography rules?** Title or subtitle > image texture > damage. Emphasis: Word level (authored): backlit glow of the word, a scratch underline, a burst cut. Line level: title card vs subtitle. Spacing: Backlit serif: +4% tracking for Latin titles (cinematic credit spacing); complex scripts none. Full rules in typography.md.

**5. How does it animate?** Film physics: the frame weaves, damage runs at the projection rate, cuts are the punctuation. Damage and weave stepped at 24 fps (or 18, 12 for Super 8 feel); titles at full render rate for smoothness of fades.

**6. How does it respond to lyrics and music?** Authored words: Per-word scratch-ins or backlit assembly on authored word starts; burst register (chorus) cuts word by word on authored starts, minimum 4 frames (167 ms) per word. Lines: Whole-line title cards; subtitles appear on line start, leave on line end. No beat grid: Cut rate follows lines; gate and flicker are constant. Complete without beats.

**7. What exact assets must be produced?** 120 entries in asset-manifest.json across 12 asset families plus composition, scene and transition specs: Film damage plates (19); Light leaks (8); Tape plates (5); Stock profiles (8); Grades (6); Gate and projector behaviours (8); Title layouts (12); Title registers (6); Countdown designs (5); Intertitle borders (5); Scratch animation loops (8); Projection room assets (5).

**8. Why does each asset exist?** Each family's purpose: Film damage plates: Physical texture of film, the style's richness. Light leaks: Warmth and section punctuation. Tape plates: The tape stock's texture (replaces Retro VHS). Stock profiles: Each section is a stock: the main variation axis. Grades: Song adaptation without leaving the stock's character. Gate and projector behaviours: Film physics. The rest in asset-strategy.md; each manifest entry carries its own purpose.

**9. Which assets are redundant?** 1 candidates were rejected or merged during review: Silent comedy pastiche (rejected: Pastiche risk; intertitles keep only the card format.)

**10. How do assets combine?** Layer order: stock base (colour, exposure) > image plates (light falloff, light leaks) > environment (projection room only) > title (register) > damage plates (dust, hair, scratches) > gate (frame edges, sprockets, letterbox bars) > post: grain, flicker, weave, vignette. Required: One stock; one title register (except leader); grain; gate weave.

**11. Which combinations are invalid?** Tape stock with film scratches or sprockets (Different medium.); Burst register with estimated word timing (Claims word cuts.); Scratched hand register with complex scripts (No stroke data; falls back.); Flash frames with reduced motion or under 3 s apart (Flash rule.); Light leaks with over the subtitle box above 30% (Readability.); Projection room with burst register (Too fast for the room metaphor.)

**12. How do scenes vary meaningfully?** Major dimensions: Stock (6 plus leader); Title register (6); Composition (7); Damage profile. Not counted as variation: Grain seeds, plate offsets, grade tints.

**13. How is repetition prevented?** No stock for more than 2 consecutive sections (except chorus recall); a light-leak plate at most once per section; countdown design fixed per song.

**14. How do scenes evolve throughout a song?** Reel metaphor: damage accumulates within a stock; stocks change at sections like reels. Stock change or the burst register; later choruses recall the first chorus stock.

**15. How does the style adapt to different screen sizes?** Letterbox subtitle: portrait 4:5 frame centred in 9:16 with bars. Centred title card: portrait Native (title wraps to 2-3 lines). Scratchboard: portrait Native. All families in composition.md.

**16. How does it handle different languages?** Hindi: Subtitle and centred card registers; backlit assembly as whole-word fade; scratched hand register not available (falls back to typewriter-like card with the serif face); no tracking. Tamil: As Hindi. Mixed: Subtitles with mixed runs; title cards prefer the line's dominant script face. RTL: Subtitles right-to-left with mirrored alignment (still centred); cards fine; scratched hand not available. Fallback: Missing serif for a script: Noto Sans of the script with the same register styling.

**17. What technical infrastructure does it require?** Gate weave and frame-rate quantiser (t to frame index), plate player (frame-stepped sprite strips), stock profiles as post uniform presets, subtitle layout (cinema rules), backlit assembly, scratch jitter, flash guard integration. Reuses: POST_FS grain, flicker and vignette uniforms (grain, chroma, scan, curve, vignette, exposure, flash), mblur for step print, LRU cache, director sections.

**18. What performance constraints apply?** Target: 2 ms GPU at 1280x720; plates decoded once. Target: under 40 MB (3 plates, one animated strip, title sheets).

**19. How will production quality be evaluated?** Plate review (no source footage, no seams); flash audit with the shared flash guard; cinema subtitle rules check (42 characters, 2 lines); look-alike review against famous title sequences; stock side-by-side review on one passage.

**20. What must be completed before the style is considered finished?** Six stocks tuned and reviewed; All plates produced and reviewed; Countdown designs original and approved; Flash audit passed; Subtitle register in 4 scripts; Golden frames per scene.
