# Panels: design specification

Style 12 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


> The song as sequential art: each line a panel, the page building as the song plays.

Origin: New style from Phase 1 research; absorbs Pop art's halftone and the screentone idea. Phase 1 rank: 5 of 15.

Companion files: [typography](typography.md), [composition](composition.md), [motion](motion.md), [scene families](scene-families.md), [asset strategy](asset-strategy.md), [manifest](asset-manifest.json), [compatibility](compatibility.json), [review register](review-register.md).

## 1. Creative identity

**Artistic philosophy.** Comics' grammar of time: the gutter is the pause between lines.

**Core visual concept.** Each line is a panel on a page of 2-6 panels. Balloons and captions hold the words; places, objects, hands and weather fill the panels; the current panel is lit and in focus while earlier panels stay on the page. Choruses become splash pages; sections turn the page.

**Emotional character.** Narrative, dramatic, witty, nostalgic; noir in the dark register.

**Influences and references.** Sequential art grammar, Ben-Day dots, screentone, noir ink (research B.22).

**Distinguishing characteristics.** The only style with a page of sequential frames and sound-effect lettering.

**Recurring motifs.** Gutters, balloons with tails, SFX lettering on hooks, speed lines, the splash page, the page turn.

**Intended density.** Medium to high: a page of panels, but only one active.

**Material and compositional language.** Newsprint, ink line, flat colour, dot tones, screentone.

**Musical contexts.** Pop-punk, rock, K-pop, anime-adjacent pop, storytelling songs, rap (narrative verses), film songs.

**Constant across every variation.** A page of panels; one panel per line; balloons or captions hold the words; registers are treatments of the same drawings.

**Why it is recognisable on any song.** A frame shows a comic page with one lit panel holding the sung line in a balloon.

**It must never look like:**

- Recurring characters or faces (likeness and cost).
- Copies of existing comics, characters or artist styles.
- More than one active panel.
- Text outside balloons, captions or SFX.
- Sketch-card hand-made cards (that is Sketch Cards).

## 2. Colour, lighting and materials

**Palette system.** Register palettes: halftone pop (CMY plus black), screentone (black and white with grey tones), ink noir (black, white, one spot colour), flat colour (4-6 flat hues from the cover), newsprint vintage (yellowed paper, muted CMY).

**Accent behaviour.** SFX and the active panel border take the accent.

**Contrast requirements.** Balloon text black on white at least 12:1; captions at least 7:1.

**Lighting.** Drawn in the shadow layer; noir register uses hard shadows.

**Shadows.** Shadow layer per illustration.

**Surface materials.** Paper, ink, dot screen.

**Texture system.** Dot screen (shared halftone), screentone patterns, newsprint paper.

**Atmosphere.** Tone gradients, speed lines.

**Colour transitions.** Register changes at the bridge.

**Song-specific adaptation.** Flat colour from the cover; register from identity (noir for dark, pop for bright, screentone for anime-adjacent).

**Material and colour variation rules.** One register per page.

## 3. Musical responsiveness

**Measured signals used.** Line and word times, gaps, hooks, beat grid.

**Estimates used (never treated as measured).** Estimated words, identity perspective (addressed, narrative, inward).

| Case | Behaviour |
|---|---|
| 1. Word-synchronised lyrics (authored word times) | Authored words: words appear in the balloon on cue (letterer's order). |
| 2. Line-synchronised lyrics | Line-synced: the balloon appears whole on the line start. |
| 3. Estimated word timing | Balloon appears whole; no per-word claims. |
| 4. No reliable timestamps | Panels change every 4 s with lyric chunks. |
| 5. Instrumental sections | Wordless establishing panels; the camera travels across the page; tones animate. |
| 6. Missing audio analysis (no beat grid, no energy) | Panel shakes off; complete without beats. |

**Beat (only when present).** Beat grid: speed lines pulse and the active panel shakes on hits (energetic songs only).

**Energy and mood.** Energy chooses layout density (calm: 2-3 panels; high: 5-6 and diagonals).

**Lyric density.** Dense lines: caption plus balloon split, or two balloons in one panel.

Styling never changes cue times: every behaviour above reads `lineAt()` and word times; nothing writes them.

## 4. Song-level progression

**Introduction.** Cover page with the song title.

**Opening lines.** First page, first panel.

**Verses.** 4-6 panel pages.

**Choruses.** Splash page: one big panel, SFX lettering on the hook word.

**Bridge.** A different register (screentone night after flat colour day).

**Instrumental breaks.** Wordless panels.

**Repeated lines.** The hook splash returns with a different illustration crop.

**High-energy moments.** Diagonal layouts, speed lines, SFX.

**Quiet moments.** Two wide panels, captions only.

**Ending.** The last panel, then a white gutter and the closing caption.

**Fallback without structure.** No hooks: page turns at gap sections.

**How scenes change.** The page fills panel by panel; each section is a new page.

**Long-term interest.** Layouts x illustrations x registers x balloon kinds; each song's pages differ.

## 5. Technical requirements

**Reuses.** Halftone and screentone (SHR-GEN), overprint, paper fibre, bundled fonts, sprite and mask host.

**New (proposed extensions, Phase 3).** Page layout solver and camera, balloon solver (shape fitted to text, tails toward the art focal point), SFX lettering renderer, register treatment shader (line, fill, shadow masks to register), speed-line generators, page curl.

**Performance targets (targets until measured).** Target: GPU 1.0 ms; page composed into a texture once per page (panels re-rendered only when active changes).

**Memory target.** Target: under 48 MB (one page of illustrations plus the next).

**Fallbacks.** Canvas 2D tier: full parity without page curl (cut).

**Export.** Camera path a function of line index and time.

## 6. Quality evaluation

Register review (every illustration in 5 registers); balloon fit test on 300 lines (short to 20 words) in 4 scripts; likeness review (no characters, no copies); RTL page order test; phone readability at 720x1280.

## 7. Definition of finished (Phase 3)

- [ ] Illustrations produced and register-reviewed
- [ ] Balloon solver fits test lines
- [ ] SFX lettering approved
- [ ] RTL page order works
- [ ] Golden frames

## 8. The twenty planning questions

**1. What does the style look like?** Each line is a panel on a page of 2-6 panels. Balloons and captions hold the words; places, objects, hands and weather fill the panels; the current panel is lit and in focus while earlier panels stay on the page. Choruses become splash pages; sections turn the page.

**2. What makes it distinct?** The only style with a page of sequential frames and sound-effect lettering.

**3. What composition families does it contain?** C1 Grid page; C2 Splash page; C3 Close-up strip; C4 Wordless establishing; C5 Caption narrative; C6 Cover page. Scene families: City night noir; Bright pop page; Screentone evening; Action splash; Road trip; Rooms; Crowd and stage; Storm; Newsprint memory; Wordless break; Bazaar and monsoon; Last page. Details in composition.md and scene-families.md.

**4. What are its typography rules?** Active balloon > SFX > caption > panel art > other panels. Emphasis: Bold lettering for stressed words (authored long words); SFX on the hook's shortest loud word. Spacing: Lettering tight leading (1.1). Full rules in typography.md.

**5. How does it animate?** Comics move between frames, not inside them: the camera moves panel to panel; inside, only limited animation. Panel move 400-600 ms; balloon pop 150 ms; page turn 700 ms.

**6. How does it respond to lyrics and music?** Authored words: Authored words: words appear in the balloon on cue (letterer's order). Lines: Line-synced: the balloon appears whole on the line start. No beat grid: Panel shakes off; complete without beats.

**7. What exact assets must be produced?** 286 entries in asset-manifest.json across 20 asset families plus composition, scene and transition specs: Place panels (30); Close-up panels (40); Object panels (30); Weather panels (12); Vehicle panels (10); Crowd and silhouette panels (12); Nature panels (12); Interior panels (16); Page layouts (20); Balloons and captions (12); SFX lettering treatments (12); Speed lines and focus lines (6); Art registers (5); Tone patterns (8); Register palettes (8); Lettering configurations (6); Panel borders (6); Cover page templates (5); Limited animation loops (8); Page transitions (5).

**8. Why does each asset exist?** Each family's purpose: Place panels: Establishing shots: where the song is. Close-up panels: The comic close-up: hands, eyes, objects; carries emotion without characters. Object panels: Symbolic objects for pop pages and memory. Weather panels: Weather as emotion; good for splash pages. Vehicle panels: Motion and travel. Crowd and silhouette panels: People without characters. The rest in asset-strategy.md; each manifest entry carries its own purpose.

**9. Which assets are redundant?** 12 candidates were rejected or merged during review: Famous landmark skyline (rejected: Real place likeness.); Second rainy street (merged: Same subject; crops cover angles.); Full face close-up (rejected: Faces create characters and likeness risk.); Hand holding hands variant (merged: Duplicate subject.); Branded soda can (rejected: Brand likeness.); Sports car of a real make (rejected: Brand likeness.); Mirrored big top (rejected: Already present as its own layout with different pacing; mirror rule otherwise.); Nine grid (rejected: Panels too small on phones.) ...see review-register.md.

**10. How do assets combine?** Layer order: paper > page layout > panel art (line, fill, shadow) > register treatment (tone, dots) > panel borders > speed lines > SFX lettering > balloons and captions > active-panel highlight > post: paper grain. Required: Layout, at least one illustration, balloons or captions, register.

**11. Which combinations are invalid?** SFX distortion with complex scripts (Shaping.); Speed lines with quiet identity (Tone.); Faces with any (No characters (likeness).); Halftone pop with grief identity (Tone: use ink noir or screentone.); Shakes with reduced motion (Motion rule.); Two active panels with any (Hierarchy.)

**12. How do scenes vary meaningfully?** Major dimensions: Art register; Page layout; Illustration subject family; Balloon kind; Composition. Not counted as variation: Register treatments of one drawing (one drawing x 5 registers is one asset); the three crops of one drawing; recolours.

**13. How is repetition prevented?** An illustration at most once per page and twice per song (hook splash returns with a different crop); layouts not identical on consecutive pages; registers max 2 per song.

**14. How do scenes evolve throughout a song?** The page fills panel by panel; each section is a new page. Splash page: one big panel, SFX lettering on the hook word.

**15. How does the style adapt to different screen sizes?** Grid page: portrait Vertical strip, one panel per screen. Splash page: portrait Tall splash. Close-up strip: portrait Column of 3. All families in composition.md.

**16. How does it handle different languages?** Hindi: Kalam lettering in balloons; SFX in Noto Sans Devanagari Black without distortion (no letter stretch). Tamil: Kavivanar lettering; SFX in Noto Sans Tamil Black without distortion. Mixed: Per-run faces in one balloon. RTL: Page reads right to left: panel order and balloon tails mirror; Arabic and Hebrew lettering. Fallback: Script without a lettering face: Noto Sans of the script in balloons; no SFX distortion.

**17. What technical infrastructure does it require?** Page layout solver and camera, balloon solver (shape fitted to text, tails toward the art focal point), SFX lettering renderer, register treatment shader (line, fill, shadow masks to register), speed-line generators, page curl. Reuses: Halftone and screentone (SHR-GEN), overprint, paper fibre, bundled fonts, sprite and mask host.

**18. What performance constraints apply?** Target: GPU 1.0 ms; page composed into a texture once per page (panels re-rendered only when active changes). Target: under 48 MB (one page of illustrations plus the next).

**19. How will production quality be evaluated?** Register review (every illustration in 5 registers); balloon fit test on 300 lines (short to 20 words) in 4 scripts; likeness review (no characters, no copies); RTL page order test; phone readability at 720x1280.

**20. What must be completed before the style is considered finished?** Illustrations produced and register-reviewed; Balloon solver fits test lines; SFX lettering approved; RTL page order works; Golden frames.
