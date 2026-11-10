# Glyph Cinema: design specification

Style 2 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


> Pictures made of characters, built from the lyric's own letters.

Origin: ASCII eye (Turbo), redesigned: room furniture dropped, teletext, typewriter and 1-bit registers added, calligram behaviour new. Phase 1 rank: 9 of 15 (Phase 1 score 7.8).

Companion files: [typography](typography.md), [composition](composition.md), [motion](motion.md), [scene families](scene-families.md), [asset strategy](asset-strategy.md), [manifest](asset-manifest.json), [compatibility](compatibility.json), [review register](review-register.md).

## 1. Creative identity

**Artistic philosophy.** The song's words are its paint. Text and image are the same material, so reading and looking become one act.

**Core visual concept.** A full-frame character grid shows a picture chosen from the song (a highway, rain, a lighthouse). The sung line types into a clean band of the grid; on hooks its letters migrate into the picture and become its brightest cells. Four registers change the medium: ASCII on a phosphor screen, teletext mosaic pages, typewriter overstrikes on paper and 1-bit dithered print.

**Emotional character.** Nostalgic, quietly magical, a little melancholy; precise rather than chaotic.

**Influences and references.** Concrete poetry and calligrams, typewriter art, broadcast teletext pages, 1-bit dithered game art, the existing ASCII subject shader.

**Distinguishing characteristics.** The only style where the lyric's letters literally build the picture. Motion is cell change, never sliding pixels.

**Recurring motifs.** The grid; brightness ramps; a picture developing from noise; letters raining into cells in place; teletext page numbers; carriage returns.

**Intended density.** High texture, low clutter: the grid is full of characters, but one subject and one band of text.

**Material and compositional language.** Light-emitting cells (phosphor), coloured mosaic blocks (teletext), ink on paper (typewriter), black and white print (1-bit).

**Musical contexts.** Electronic, lo-fi, indie, hip-hop, ambient, retro pop; any song with a strong concrete image in its title or lyric.

**Constant across every variation.** The grid is sacred: everything aligns to cells, camera moves are cell-snapped, one glyph ramp per scene, the lyric band is always clean and readable.

**Why it is recognisable on any song.** Every frame is a character grid; the lyric is in the same grid as the picture.

**It must never look like:**

- A falling-code rain effect of green streams (a famous film look): characters change in place, they never stream down columns.
- Noise: a grid so fine or busy that the picture cannot be named in one second.
- Off-grid motion: sliding, rotating or scaled glyphs.
- A generic trippy vortex or retro sun grid (rejected subjects).
- A room or monitor bezel around the grid (old ASCII eye furniture, dropped).

## 2. Colour, lighting and materials

**Palette system.** Per register: ASCII uses one phosphor colour on near-black (green #33FF66, amber #FFB000, white #E8F0FF, or a cover hue clamped to high luminance); teletext uses the eight broadcast colours (black, red, green, yellow, blue, magenta, cyan, white) with no other hues; typewriter uses ink black or red-black ribbon on paper; 1-bit uses two colours: paper and one ink (cover-derived duotone allowed).

**Accent behaviour.** The lyric band can be inverted (background in the phosphor colour, text dark) for emphasis; teletext uses a contrasting background colour row.

**Contrast requirements.** Lyric band text 7:1 against its band in ASCII and teletext, 4.5:1 on paper. The picture is allowed to be low contrast; the band never is.

**Lighting.** Self-luminous in ASCII (phosphor bloom at low strength), flat in teletext and paper.

**Shadows.** None, except paper registers: a soft sheet shadow at the frame edge.

**Surface materials.** CRT glass with faint scanlines (ASCII), TV raster (teletext, double-height rows), paper fibre with ink spread (typewriter), clean print (1-bit).

**Texture system.** Scanlines and curvature from POST (scan, curve) for ASCII at low strength; paper fibre generator for typewriter; none for 1-bit.

**Atmosphere.** Persistence trails on phosphor when cells change (decay 180 ms).

**Colour transitions.** Register flips at sections change the palette family entirely; within a register only cover-hue adjustments are allowed.

**Song-specific adaptation.** Cover brightness chooses phosphor vs paper registers; cover hue may replace the phosphor colour; teletext ignores the cover except for picking which of the eight colours dominate.

**Material and colour variation rules.** Teletext colours are never interpolated; 1-bit is strictly two colours; ASCII may tint but keeps one hue per scene.

## 3. Musical responsiveness

**Measured signals used.** Line and word times, gaps, hooks (repetition), beat grid when present.

**Estimates used (never treated as measured).** Estimated word times, tempo from lyric timing, identity mood and subjects.

| Case | Behaviour |
|---|---|
| 1. Word-synchronised lyrics (authored word times) | Each word types into the band on its start time, one cell per grapheme per frame-step at a cadence that completes by the word's end; calligram migration of a hook word begins at its end time. |
| 2. Line-synchronised lyrics | The whole line types into the band across the first 40% of the line's duration at an even rate (no per-word claims); the band holds for the rest. |
| 3. Estimated word timing | As line-synced (soft mode); the calligram migration starts at the line end, not on any word. |
| 4. No reliable timestamps | The lyric appears as a static teletext-style page of the whole text, one page per 6 lines, flipping every 8 s; the picture animates on its own. |
| 5. Instrumental sections | The picture animates alone (rain falls in place, waves roll, the road moves); after 12 s the subject may develop a new detail (a grid-snapped zoom to a part). |
| 6. Missing audio analysis (no beat grid, no energy) | Without a beat grid the character density pulse is off; the picture's own loops carry motion. Complete without beats. |

**Beat (only when present).** With a beat grid: brightness ramp shifts one level on downbeats (character density pulse) in choruses; amplitude capped so no cell flips more than 3 times per second.

**Energy and mood.** Energy picks cell size (coarse grid for calm, finer for energetic) and loop speeds.

**Lyric density.** Dense lines: band grows to two rows; over two rows the band scrolls by rows (never smaller cells).

Styling never changes cue times: every behaviour above reads `lineAt()` and word times; nothing writes them.

## 4. Song-level progression

**Introduction.** Blank grid; the picture develops from noise over the intro length (max 6 s), like a slow print.

**Opening lines.** First line types into the band; the picture is at half development until the first line ends.

**Verses.** Picture fully developed; verses add details (secondary elements of the subject appear) one per two lines.

**Choruses.** Register flips (ASCII to teletext colour, or paper to 1-bit) or a grid-snapped zoom to a detail; the hook line's letters migrate into the picture (calligram).

**Bridge.** Subject changes to the lyric's later theme (second subject chosen from the bridge lines) or the scale changes (zoom out to a wide).

**Instrumental breaks.** Picture animates alone; at long breaks a teletext page update shows the song's metadata page.

**Repeated lines.** A repeated line re-uses the band position; on its third repeat its letters stay in the picture permanently (the image accumulates the hook).

**High-energy moments.** Finer grid, faster loops, register flips on chorus entries.

**Quiet moments.** Coarser grid, slower development, paper register.

**Ending.** The picture decays cell by cell to spaces, leaving the last line alone in the band, then the band clears.

**Fallback without structure.** No hooks: sections from gaps; register flips every second section. No title or lyric subject match: subject from mood (rain for sad and low, lights for lively, mountains for calm).

**How scenes change.** One persistent picture per section, developing and accumulating; never re-rolled per line.

**Long-term interest.** Over 50 subjects and 4 registers; subject choice is driven by the song's own words (title first), so different songs get different pictures by content, not chance.

## 5. Technical requirements

**Reuses.** The ASCII character pass (host.ascii), the subject picker, POST scan and curve, dither uniform, hash01 noise.

**New (proposed extensions, Phase 3).** Subject maps as baked R8 brightness plus R8 motion channel (replaces the eight-scenes-in-one-program shader, P5 compile risk); calligram router (CPU assigns letters to target cells; GPU draws); band strip renderer for complex scripts; teletext page compositor; typewriter overstrike renderer; multilingual subject lexicons.

**Performance targets (targets until measured).** Target (to measure): 2.5 ms GPU at 1280x720 (today 3.2-3.3 ms with the analytic eye shader; baked maps should be cheaper). CPU routing under 0.5 ms per frame.

**Memory target.** Target: subject maps 512x288 R8 x2 channels (0.3 MB each); up to 3 subjects resident; glyph atlas 2048x2048 R8 (4 MB).

**Fallbacks.** Canvas 2D tier: cells drawn with fillText from a luminance sample (slower: limit to coarse grid), teletext and typewriter fine in 2D.

**Export.** Cell updates quantised by t, not by frames rendered; routing is a pure function of (line, t).

## 6. Quality evaluation

Each subject is nameable by 4 of 5 viewers in a 1-second look at the medium grid (hallway test); band contrast checks; calligram review on every scene family; no streaming-column motion (review); complex-script strips reviewed by Hindi and Tamil readers; flash audit on Fire and Lights subjects.

## 7. Definition of finished (Phase 3)

- [ ] All approved subjects baked with motion channels and focal boxes
- [ ] Four registers implemented and reviewed side by side on the same subject
- [ ] Calligram routing reviewed on 10 hooks (magic, not noise)
- [ ] Hindi, Tamil, Arabic, Japanese bands reviewed
- [ ] Shader compile time under 50 ms (P5)
- [ ] Golden frames per scene family at four sizes
- [ ] Flash audit passed

## 8. The twenty planning questions

**1. What does the style look like?** A full-frame character grid shows a picture chosen from the song (a highway, rain, a lighthouse). The sung line types into a clean band of the grid; on hooks its letters migrate into the picture and become its brightest cells. Four registers change the medium: ASCII on a phosphor screen, teletext mosaic pages, typewriter overstrikes on paper and 1-bit dithered print.

**2. What makes it distinct?** The only style where the lyric's letters literally build the picture. Motion is cell change, never sliding pixels.

**3. What composition families does it contain?** C1 Picture with lyric band; C2 Calligram; C3 Teletext page; C4 Typewriter sheet; C5 Split field; C6 Macro cell zoom. Scene families: Night sky; Roads and travel; Weather; Sea and shore; City at night; Nature; Heart and hands; Machines and music; Fire and light; Creatures; Teletext service; Typed letter; Symbols and objects of fortune. Details in composition.md and scene-families.md.

**4. What are its typography rules?** Lyric band (bright or inverted) > picture highlights > picture midtones > background cells. Emphasis: Word level (authored only): the word inverts in the band; hook words migrate into the picture. Line level: band inversion, double-height teletext row. Spacing: One grapheme per cell for Latin, Cyrillic, Greek; two cells per CJK character; no extra tracking anywhere. Full rules in typography.md.

**5. How does it animate?** Characters change; they never slide. Time is shown by cells developing, decaying and being typed. Cell updates quantised to 30 fps steps (an honest medium cadence) even when rendering at 60 or 120 fps; dissolves 600-1200 ms.

**6. How does it respond to lyrics and music?** Authored words: Each word types into the band on its start time, one cell per grapheme per frame-step at a cadence that completes by the word's end; calligram migration of a hook word begins at its end time. Lines: The whole line types into the band across the first 40% of the line's duration at an even rate (no per-word claims); the band holds for the rest. No beat grid: Without a beat grid the character density pulse is off; the picture's own loops carry motion. Complete without beats.

**7. What exact assets must be produced?** 159 entries in asset-manifest.json across 10 asset families plus composition, scene and transition specs: Subject pictures (62); Subject motion loops (11); Glyph ramps (14); Registers (5); Teletext page templates (9); Typewriter papers (6); Register palettes (8); Band layouts (7); Calligram routing rules (6); Grid-snapped camera moves (5).

**8. Why does each asset exist?** Each family's purpose: Subject pictures: The subject is the picture: the main variation axis and the reason a song gets its own image. Subject motion loops: Make the picture alive in breaks without leaving the grid. Glyph ramps: The ramp is the texture of the picture; different ramps give different materials. Registers: Changing the medium is the style's chorus move. Teletext page templates: The teletext register needs pages whose content is the song itself, not invented news. Typewriter papers: The material of the typewriter register. The rest in asset-strategy.md; each manifest entry carries its own purpose.

**9. Which assets are redundant?** 7 candidates were rejected or merged during review: Vortex (rejected: Generic trippy shader look the style must never be.); Sun grid (rejected: Synthwave cliché; Vaporwave was removed in Phase 1.); Equalizer bars (merged: Generic; merged into the speaker cone subject.); Skull with roses (rejected: Cliché; dark songs are served by storm, cracked mirror and fog.); Real landmark skylines (rejected: Rights and specificity; skylines stay generic.); Hacker room (rejected: Dropped in Phase 1 (furniture competes with the grid; overlaps Screenlife).); Falling code (rejected: Strong likeness to a famous film look.)

**10. How do assets combine?** Layer order: grid background (register ground: black, page black, or paper) > subject cells (character pass over a subject map) > subject motion channel > routed calligram letters > band mask > band text and cursor > persistence / ink spread > post: scan and curve (ASCII), raster (teletext), paper fibre (typewriter). Required: One register; one subject (except Typed letter and Teletext service, where it is optional); one glyph ramp; one band layout.

**11. Which combinations are invalid?** Teletext register with cover-derived hues (Breaks the eight-colour medium.); Fine grid with outputs under 600 px tall (Unreadable on phones.); Devanagari, Tamil, Arabic with per-cell migration (Clusters cannot be split.); Fire subject with density pulse (Two flicker sources exceed the flash budget.); Calligram with estimated word timing (Hook migration would claim a timing that is a guess (it starts at line end instead).); Typewriter register with phosphor bloom (Paper does not glow.)

**12. How do scenes vary meaningfully?** Major dimensions: Subject (over 50 pictures across 13 worlds); Register (ASCII, teletext, typewriter, 1-bit); Composition (band, calligram, page, sheet, split, macro); Detail crop of a subject (zoom-step targets). Not counted as variation: Phosphor recolours; ramp swaps on the same subject; portrait crops of a subject (metadata of the same asset).

**13. How is repetition prevented?** A subject is used at most twice per song (main and recall); a register at most for 3 sections in a row. Across songs, the lexicon decides most subjects; when only the mood fallback decides, a per-track hash picks among 3 mood subjects so fallback songs do not all show rain.

**14. How do scenes evolve throughout a song?** One persistent picture per section, developing and accumulating; never re-rolled per line. Register flips (ASCII to teletext colour, or paper to 1-bit) or a grid-snapped zoom to a detail; the hook line's letters migrate into the picture (calligram).

**15. How does the style adapt to different screen sizes?** Picture with lyric band: portrait Grid 40-56 columns; band in the bottom third; subjects use portrait crop. Calligram: portrait As C1 with portrait routing targets. Teletext page: portrait Page scaled to width with black above and below; or a rotated layout of 24 columns (proposed, test). All families in composition.md.

**16. How does it handle different languages?** Hindi: Devanagari conjuncts and matras cannot be split into cells. The band is a clean overlay text strip rendered with the shaped font at a size that spans 2 cell rows, aligned to the grid; no per-letter migration. On hooks, the whole word is routed as a unit into a rectangular region of the picture (the region's cells take the word's rendered pixels as their brightness source, so the word appears as picture texture). The picture itself uses the neutral Latin ramp. Tamil: As Hindi: shaped strip, whole-word routing. Mixed: Latin runs keep per-cell behaviour; complex-script runs use strip behaviour inside the same band. RTL: Arabic: joined script, so strip behaviour as Hindi; band flush right; typing order is logical (the browser shapes the strip progressively by grapheme). Hebrew: per-cell possible (no joining) but kept as strip for consistency; flush right. Fallback: If a band face lacks a glyph, the strip falls back through Noto faces; the picture never uses glyphs from the lyric's complex script as ramp characters.

**17. What technical infrastructure does it require?** Subject maps as baked R8 brightness plus R8 motion channel (replaces the eight-scenes-in-one-program shader, P5 compile risk); calligram router (CPU assigns letters to target cells; GPU draws); band strip renderer for complex scripts; teletext page compositor; typewriter overstrike renderer; multilingual subject lexicons. Reuses: The ASCII character pass (host.ascii), the subject picker, POST scan and curve, dither uniform, hash01 noise.

**18. What performance constraints apply?** Target (to measure): 2.5 ms GPU at 1280x720 (today 3.2-3.3 ms with the analytic eye shader; baked maps should be cheaper). CPU routing under 0.5 ms per frame. Target: subject maps 512x288 R8 x2 channels (0.3 MB each); up to 3 subjects resident; glyph atlas 2048x2048 R8 (4 MB).

**19. How will production quality be evaluated?** Each subject is nameable by 4 of 5 viewers in a 1-second look at the medium grid (hallway test); band contrast checks; calligram review on every scene family; no streaming-column motion (review); complex-script strips reviewed by Hindi and Tamil readers; flash audit on Fire and Lights subjects.

**20. What must be completed before the style is considered finished?** All approved subjects baked with motion channels and focal boxes; Four registers implemented and reviewed side by side on the same subject; Calligram routing reviewed on 10 hooks (magic, not noise); Hindi, Tamil, Arabic, Japanese bands reviewed; Shader compile time under 50 ms (P5); Golden frames per scene family at four sizes; Flash audit passed.
