# Folio: design specification

Style 6 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


> The lyric as a living magazine and book page.

Origin: Merges Broadsheet, Art Book, Ether (directions) and Monochrome editorial (classic). Phase 1 rank: 10 of 15 (Phase 1 score 7.8).

Companion files: [typography](typography.md), [composition](composition.md), [motion](motion.md), [scene families](scene-families.md), [asset strategy](asset-strategy.md), [manifest](asset-manifest.json), [compatibility](compatibility.json), [review register](review-register.md).

## 1. Creative identity

**Artistic philosophy.** The dignity of the printed word. A song deserves to be set like literature.

**Core visual concept.** The song is published: as a literary quarterly, a newspaper, a theatre programme, an art book, a letters page. The current line is the pull quote; the song's earlier lines become the article body in quiet columns; the chorus is the headline; the page re-lays itself at sections and turns at the end of a section.

**Emotional character.** Calm, intelligent, elegant; dense and urgent in the newspaper; playful in the loud issue.

**Influences and references.** Literary magazines, newspapers, art book typography, theatre programmes, loud 90s editorial design (as one issue only).

**Distinguishing characteristics.** The only style built on editorial hierarchy and reading conventions; the natural home for translations and romanisation.

**Recurring motifs.** Pull quotes, drop caps, rules, folios and running heads, page turns, columns, plates with captions, footnotes.

**Intended density.** Medium-high texture (columns of dim text), but one clear focal quote.

**Material and compositional language.** Paper (cream, newsprint, coated, programme card), ink, halftone plates.

**Musical contexts.** Singer-songwriter, folk, ballads, story rap, literary pop, songs in Hindi and Tamil with romanisation or translation; anyone who wants to read.

**Constant across every variation.** A baseline grid; real typographic rules (no widows, balanced rag); the lyric is the largest text on the page except a headline that is itself the hook; secondary text is the song itself.

**Why it is recognisable on any song.** A frame looks like a designed page with a pull quote.

**It must never look like:**

- Filler text (lorem ipsum, invented articles).
- A static slideshow of pages.
- Real newspaper or magazine mastheads.
- Loud-issue collisions over the lyric itself.
- Cramped type: margins are generous except the newspaper.

## 2. Colour, lighting and materials

**Palette system.** Per publication: quarterly (cream L 95, warm black ink, one spot colour from the cover), newspaper (newsprint grey L 88, black), programme (card colour from the cover, dark ink), art book (bright white coated, black and cover plates in full colour), letters (laid paper, blue-black ink), loud (cover duotone, high saturation).

**Accent behaviour.** One spot colour per issue for rules, drop caps and the masthead.

**Contrast requirements.** Pull quote 7:1; body 3:1 to 4.5:1 deliberately dim (it is texture and memory, not the focal text).

**Lighting.** A gentle page light (top-left soft gradient 4%) and a page curl shadow on turns.

**Shadows.** Page shadow on the desk when the camera pulls back; none on the page itself.

**Surface materials.** Uncoated, newsprint, coated, card, laid paper.

**Texture system.** Paper fibre generator (shared) at 5%; newsprint gets halftone on plates.

**Atmosphere.** None.

**Colour transitions.** Colour changes with publication sections (a new spot colour per section in the quarterly).

**Song-specific adaptation.** Cover provides spot colour and plates; identity perspective selects publications (narrative: newspaper or art book; addressed: letters page; inward: quarterly or chapbook).

**Material and colour variation rules.** Ink is always near-black or the publication's ink; spot colour limited to 10% of page area.

## 3. Musical responsiveness

**Measured signals used.** Line and word times, gaps, hooks; beat grid used only for a rule tick.

**Estimates used (never treated as measured).** Estimated words, identity perspective, mood.

| Case | Behaviour |
|---|---|
| 1. Word-synchronised lyrics (authored word times) | Authored words darken from 40% to full ink on their start (ink darkening), 150 ms each. |
| 2. Line-synchronised lyrics | The pull quote slides into its slot on the line start (300 ms); no per-word claims. |
| 3. Estimated word timing | Whole-line quote; no ink darkening per word. |
| 4. No reliable timestamps | The whole lyric is typeset as a poem on pages; the page turns every 8 lines at reading pace; no pull-quote motion. |
| 5. Instrumental sections | The page turns; a plate fills the spread; a caption shows the section label; or the contents page lists the song so far. |
| 6. Missing audio analysis (no beat grid, no energy) | No rule ticks. Fully complete without beats. |

**Beat (only when present).** Beat grid: a thin rule under the pull quote extends one step per bar (optional, low key).

**Energy and mood.** Energy chooses publication (high energy: newspaper and loud issue) and motion speed.

**Lyric density.** Dense lyrics: newspaper layouts with narrow columns; pull quotes hold two lines.

Styling never changes cue times: every behaviour above reads `lineAt()` and word times; nothing writes them.

## 4. Song-level progression

**Introduction.** The cover or masthead page (masthead built from the song title, issue number from the release year if known, date from song duration).

**Opening lines.** First article page; the first line becomes the opening paragraph with a drop cap.

**Verses.** Article pages: earlier lines accumulate in the body columns; the current line is the pull quote.

**Choruses.** Headline spread: the hook at headline size; later choruses recall it as a running head across pages.

**Bridge.** A different section of the publication: letters page, index, or plate spread.

**Instrumental breaks.** Page turn; plate spread with caption; contents page.

**Repeated lines.** Repeated lines are set once and then marked in the margin (a repeat sign and count), not reset.

**High-energy moments.** Loud issue collisions around (never over) the lyric; faster page turns.

**Quiet moments.** Chapbook pages: one line per page, lots of white.

**Ending.** Colophon page: title, artist, the typefaces used, and the song length as the page count.

**Fallback without structure.** No hooks: page turns at gap sections or every 8 lines.

**How scenes change.** Accumulative within a page; page turns between sections.

**Long-term interest.** 9 publications x 40 templates x pairings; perspective and genre choose publications, so songs read differently.

## 5. Technical requirements

**Reuses.** Canvas text measurement, existing TYPE_PAIRS ideas, Clean renderer paper looks, LRU cache.

**New (proposed extensions, Phase 3).** Page layout engine (baseline grid, columns, slots, balanced breaks), page painting cache per section, camera framing between slots, page curl shader, masthead generator rules.

**Performance targets (targets until measured).** Target: 1.2 ms GPU; page layout 4-12 ms once per section (done in the gap or a frame budgeted idle callback, P5 warm-up).

**Memory target.** Target: two page textures 2048x2896 (24 MB each at RGBA8; use 1448x2048 on low tier) plus plates; under 64 MB high tier, 32 MB low tier.

**Fallbacks.** Canvas 2D tier: full parity (pages are 2D); page curl becomes a slide.

**Export.** Layout is deterministic; page textures keyed by section.

## 6. Quality evaluation

Typographic review by a designer (widows, rag, hierarchy) for every template; no filler text test; bilingual review with Hindi and Tamil readers; page curl at 60 fps measured.

## 7. Definition of finished (Phase 3)

- [ ] All templates set with real lyrics from 5 test songs
- [ ] Bilingual edition reviewed
- [ ] Page turn smooth and deterministic
- [ ] Masthead rules reviewed (original names)
- [ ] Golden frames

## 8. The twenty planning questions

**1. What does the style look like?** The song is published: as a literary quarterly, a newspaper, a theatre programme, an art book, a letters page. The current line is the pull quote; the song's earlier lines become the article body in quiet columns; the chorus is the headline; the page re-lays itself at sections and turns at the end of a section.

**2. What makes it distinct?** The only style built on editorial hierarchy and reading conventions; the natural home for translations and romanisation.

**3. What composition families does it contain?** C1 Pull-quote page; C2 Headline spread; C3 Drop-cap opening; C4 Plate and caption; C5 Parallel text; C6 Contents and index; C7 Loud collision; C8 Letter. Scene families: Literary quarterly; Newspaper; Theatre programme; Art book; Letters page; Loud issue; Poetry chapbook; Bilingual edition; Almanac. Details in composition.md and scene-families.md.

**4. What are its typography rules?** Headline (hooks) or pull quote > drop cap > plate > body > captions and folios. Emphasis: Word level (authored): ink darkening, italic switch on held words (Latin); line level: pull quote placement, headline. Spacing: Text tracking 0; small caps +5% (Latin); headlines -1%; complex scripts default spacing. Full rules in typography.md.

**5. How does it animate?** Editorial restraint: text flows, rules draw, pages turn; nothing bounces. Slides 300 ms, reflow 500 ms, page turn 1.2 s, camera reframing 800 ms.

**6. How does it respond to lyrics and music?** Authored words: Authored words darken from 40% to full ink on their start (ink darkening), 150 ms each. Lines: The pull quote slides into its slot on the line start (300 ms); no per-word claims. No beat grid: No rule ticks. Fully complete without beats.

**7. What exact assets must be produced?** 127 entries in asset-manifest.json across 9 asset families plus composition, scene and transition specs: Page templates (36); Type pairings (12); Paper stocks (8); Rules and ornaments (14); Plate treatments (8); Masthead systems (6); Plate frames (6); Marginalia (8); Editorial motions (7).

**8. Why does each asset exist?** Each family's purpose: Page templates: Templates are the style's compositions; each produces a different page. Type pairings: Voice of each issue. Paper stocks: Material identity of each publication. Rules and ornaments: Editorial structure and finish. Plate treatments: Visual relief and breaks. Masthead systems: Every publication has a name; it must be original and song-specific. The rest in asset-strategy.md; each manifest entry carries its own purpose.

**9. Which assets are redundant?** 8 candidates were rejected or merged during review: Newspaper: crossword page (rejected: Gimmick; unreadable.); Quarterly: three columns (merged: Too close to newspaper; quarterly identity is generosity.); Script plus slab (rejected: Clashes with the editorial restraint; script faces live in Cover Pop.); Art nouveau vine border (rejected: Period ornament overload; the style uses rules, not borders.); Real magazine masthead pastiche (rejected: Brand likeness.); Fake page numbers and citations (rejected: Invented data presented as fact.); Fashion magazine (rejected: Needs photography of people; trivialises the lyric.); Zine photocopy (rejected: Overlaps Sketch Cards' photocopy print process.)

**10. How do assets combine?** Layer order: desk (when pulled back) > page paper > body columns (earlier lines, dim) > plates and frames > rules and ornaments > masthead, running heads, folios > pull quote or headline (lyric) > marginalia (second line, repeat marks) > post: paper fibre, page light. Required: Publication template, pairing, paper, lyric slot.

**11. Which combinations are invalid?** Body text with invented copy (Secondary text must be the song itself.); Drop caps with Devanagari, Tamil, Arabic (Convention and shaping.); Italic emphasis with scripts without italics (Use ink darkening.); Loud collisions with over the lyric (Readability rule.); Real mastheads with any (Rights.); Plates with altered cover art when shown as the cover (Artwork policy; derived plates must not pose as the cover.)

**12. How do scenes vary meaningfully?** Major dimensions: Publication (9); Template (structure of the page); Composition (pull quote, headline, drop cap, plate, parallel, index, collision, letter); Plate treatment. Not counted as variation: Spot colours, plate crops, mirrored templates.

**13. How is repetition prevented?** No template twice in a row except chorus recall; one publication per song plus one section change (bridge); plates at most 2 per song.

**14. How do scenes evolve throughout a song?** Accumulative within a page; page turns between sections. Headline spread: the hook at headline size; later choruses recall it as a running head across pages.

**15. How does the style adapt to different screen sizes?** Pull-quote page: portrait Single page view. Headline spread: portrait Headline stacked on one page. Drop-cap opening: portrait Page. All families in composition.md.

**16. How does it handle different languages?** Hindi: Drop caps not used (Devanagari drop caps break the headline bar convention); pull quote in Noto Serif Devanagari; italic emphasis not available (no Devanagari italic): emphasis by ink darkening only; justified body avoided (ragged right). Tamil: As Hindi; drop caps not used; ragged body. Mixed: Pull quote runs in each script's serif; body ragged. RTL: Pages mirror (binding on the right), pull quotes flush right; drop caps allowed for Hebrew, not Arabic. Fallback: Missing serif: Noto Serif for the script, then Noto Sans.

**17. What technical infrastructure does it require?** Page layout engine (baseline grid, columns, slots, balanced breaks), page painting cache per section, camera framing between slots, page curl shader, masthead generator rules. Reuses: Canvas text measurement, existing TYPE_PAIRS ideas, Clean renderer paper looks, LRU cache.

**18. What performance constraints apply?** Target: 1.2 ms GPU; page layout 4-12 ms once per section (done in the gap or a frame budgeted idle callback, P5 warm-up). Target: two page textures 2048x2896 (24 MB each at RGBA8; use 1448x2048 on low tier) plus plates; under 64 MB high tier, 32 MB low tier.

**19. How will production quality be evaluated?** Typographic review by a designer (widows, rag, hierarchy) for every template; no filler text test; bilingual review with Hindi and Tamil readers; page curl at 60 fps measured.

**20. What must be completed before the style is considered finished?** All templates set with real lyrics from 5 test songs; Bilingual edition reviewed; Page turn smooth and deterministic; Masthead rules reviewed (original names); Golden frames.
