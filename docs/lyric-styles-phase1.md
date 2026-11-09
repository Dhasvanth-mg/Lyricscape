# Lyric visual styles, Phase 1: research, audit and the final 15

Written 2026-11-09. Phase 1 only: research, evaluation and selection. **No production code, shaders or assets were changed or created.**
Phase 2 (design and production planning) must not start until the owner authorises it.

Base: `origin/main` at `2810998` (after the history rewrite), plus the Turbo variant work on branch `claude/project-thread-cna8v0` (the commits that were PR #5:
346-drawing art library, 18 ASCII pictures, 12 app screens for Code screens, 7 layouts and 4 grounds for Lyrics app, per-line Sketch card designs,
Acid variants, the auto director). PR #5 was closed while this research ran; its branch still holds that work and is what was audited.

## How to read this report

Three kinds of statement are kept apart throughout:

- **Observed**: something I saw in the code, in a frame I rendered, or in a source I actually read. Where a source is cited as *read*, I fetched and read the page.
- **Interpretation**: my design judgement built on what was observed.
- **Speculative**: an idea that needs testing before anyone relies on it.

**What I could and could not inspect.** I rendered every current Lyricscape style in a headless browser (software WebGL2) from the demo songs and looked at the frames
(contact sheets in `docs/assets/phase1/`). For external references, my tools can fetch web pages and read their text; **they cannot play video.** So for title sequences,
music videos and installations I relied on written production analyses (Art of the Title interviews, museum and archive pages, artists' own pages) that describe
motion, timing and technique, and on my existing knowledge of widely documented works. I did not watch footage during this research and I do not claim to have.
Every link in this report came from a search result or a page I fetched; links marked *(read)* were fetched and read for this report, the others were found but not read in full.

## What the styles can rely on (the data that exists)

Observed in the code; this bounds every "musical relationship" section below. Nothing here invents data the app does not have.

| Signal | Where | Reliability |
|---|---|---|
| Line start and end times | LRC from LRCLIB, user files, the timing editor | Good when the lyrics are synced; the main signal everywhere |
| Word times | `Scene.words[].timing` = `authored` (enhanced LRC), `estimated` (the pace-aware estimator), `none` | Authored is good; estimated is ~53% within 200 ms (`lib/lyrics/words.ts`): **styles must have a soft mode for estimated words** |
| Hooks / chorus guess | `scene.hook` (a line that repeats) | A lyric-repetition guess, not audio structure |
| Breaks and intros | `timeline.gaps` (no line on screen) | Good |
| Beat grid and tempo | analysis of local files, opt-in tab listening on Spotify, tap tempo, a tempo estimate from lyric timing, an online lookup; each labelled with its source | Varies: often absent or low confidence on Spotify. **A style must look complete with no beat at all** |
| Song identity | `lib/identity`: genre family (tags), nine mood dimensions with confidence, perspective, subjects (romance, night & city, memory...), pace, delivery | Useful for choosing and tuning, explicitly approximate |
| Cover | palette, brightness, temperature; the image itself | Real, weak as evidence of mood |
| Title, artist, language, script | track metadata, `lib/lyrics/script.ts` | Real |

Not available: audio sections (verse/chorus from audio), timbre, harmony, loudness curve for Spotify without opt-in listening, lyric meaning beyond word lists (an opt-in AI reading exists, unverified live).

---

# Section A: Existing Lyricscape style audit

## A.1 Inventory: every style-like thing in the app

Observed. I separated real artistic styles from things that only look like styles.

**Artistic styles (35):**

| Group | Members | Where |
|---|---|---|
| Classic looks (Clean, opt-in shelf) | Maximalist, Monochrome editorial, Psychedelic, Minimal, Y2K, Neon noir, Vaporwave, Retro VHS, Notebook, Aurora, Pop art, Gloss, Film (13) | `lib/kinetic/styles.ts` |
| Art directions (Clean, chosen by Auto) | Velvet, Ether, Nocturne, Type as Rhythm, Broadsheet, Graphic, Analog Cinema, Art Book, Stillness, Controlled Disorder, Cover Pop (11) | `lib/kinetic/directionStyles.ts`, `lib/theme/directions.ts` |
| Turbo styles (WebGL2) | Liquid light, Code screens, Sketch cards, Lyrics app, Acid grain, ASCII eye (6) | `lib/kinetic/turbo.ts`, `gl/scenes/*` |

**Not independent styles (and treated as such in this audit):**

- **Clean vs Turbo** are rendering modes. Today they also split the style list in two, which is a structural problem (see A.5).
- **Liquid light** is, in the code, "the song's art direction at full intensity" (`turboLook`) over one of four backdrop shaders (liquid light, god rays, bokeh, horizon grid). It is a mode applied to the eleven directions, not a style with its own idea. Audited anyway, because users see it as one.
- **Custom** (classic) is a starting point for tuning, not a style.
- **Customisation**: 17 entrances, 11 exits, 7 line effects, transition speed, palettes (17 named ground/ink sets), 13 type pairings, artwork treatments (wash, defocus, tonal, cinema, bleed, card, split, collage, hero). These are dials, not styles.
- **Auto director** (`director.ts`, on the branch): cuts between all six Turbo styles at sections. A sequencing feature (see A.5 for why it conflicts with the new collection).
- **Floating lyrics, OBS overlay, wallpaper and see-through desktop window**: presentation surfaces with their own small look options (colour, cover, minimal, four fonts). Not lyric visual styles; they should later inherit the chosen style's type and colour.
- **Duet and ad-lib layout**: a layout feature that every style must support.
- **Asset systems** feeding styles: 48 icons x 10 treatments (480), 18 doodle motifs x 10 treatments x 6 ornaments (1080), the 346-drawing art library in 14 families. Counted in Section E as reusable inputs, not styles.

## A.2 How I judged them

Each style was rendered at several moments of the demo songs: Turbo styles at 9, 21, 33 and 47 s at 1280x720; Clean looks through `/looks` with each direction or classic style forced
(see `docs/assets/phase1/turbo-a.jpg`, `turbo-b.jpg`, `classic-words.jpg`, `classic-grounds.jpg`, `classic-grounds-2.jpg`, and the existing `docs/assets/v3/gallery-auto.png`).
Scores use the brief's weights: artistic quality 20%, originality 20%, asset diversity 20%, motion and musical expressiveness 15%, readability and composition 10%, versatility 10%, technical feasibility 5%.
Scores are 1-10; the weighted total is out of 10. **Development effort already spent did not count.**

Render notes (observed): headless Chromium with software WebGL2 (SwiftShader), demo songs, director off. `turbo-a.jpg` rows are Liquid light, Code screens, Sketch cards; `turbo-b.jpg` rows are
Lyrics app, Acid grain, ASCII eye; columns are 9, 21, 33 and 47 s. `classic-words.jpg` shows two demo songs each for Maximalist, Neon noir, Vaporwave, Notebook, Pop art, Gloss, Film, Y2K
(left to right, top to bottom, in pairs). `classic-grounds*.jpg` show all 13 classic looks plus Cover Pop at a moment with no words on screen. Software rendering means colours and blur match the GPU path but timings do not; no timings were taken.

### What the renders showed (observed)

- **The 13 classic looks share one engine and one composition.** With words on screen, Maximalist, Neon noir, Vaporwave, Notebook, Pop art, Gloss, Film and Y2K all put the same centred, all-caps,
  two-line block in the middle of a blurred cover wash; they differ in font, colour and one decoration (a halftone, a sun, ruled lines). Without words, nine of them are nearly the same
  blurred brown or grey wash. In several frames an icon sticker (a star) sits **on top of a word** ("MY"), which breaks the app's own "no decoration crossing a word" rule. Maximalist renders
  dim brown text on a brown wash.
- **The 11 directions are much better designed but are still one composition engine.** Type pairing, palette and artwork treatment change; the motion vocabulary and the spatial idea (a lyric block
  with a small caption under it) stay the same. Velvet, Nocturne and Stillness are hard to tell apart without reading the labels.
- **Turbo scenes have real identities.** Code screens, Sketch cards and ASCII are each unmistakable. Lyrics app is a soft gradient with a chip on the active word. Acid is loud and memorable.
  Liquid light at 9 s rendered **solid black** (intro with no line), then a cover card on a blurred ground, then one huge word ("up") with a key icon on a blue starburst.

## A.3 Per-style verdicts

Format: scores in the order quality / originality / assets / motion / readability / versatility / feasibility, then the weighted total.

### Turbo styles

**Code screens** (`terminal.ts` + `screens.ts`) · 8 / 8 / 9 / 8 / 7 / 7 / 8 · **8.0** · **KEEP, then REDESIGN into "Screenlife"**
- Observed: six classic shots (code editor, error list, big words over blurred code, login form, error banners, console) plus 12 app screens on the branch (chat, search, notes, spreadsheet, phone,
  email, git, sticky notes, post, alert, code review, calendar) x light/dark x 12 accents x 6 camera moves. Typing is tied to word times; whip cuts with directional blur and glitch.
- Strengths: the strongest idea in the app. The lyric becomes an act (someone types it into their life), the camera grammar is cinematic, and fictional interfaces are an almost endless subject.
- Weaknesses: the original six shots are developer-centric (promise libraries, TypeScript errors), which narrows who the style speaks to; on light screens bloom blew out the frame
  (the email shot in my render is washed to white around the field); with estimated word timing the typing claims precision it does not have; the "big words" shot over code is the weakest.
- Action: keep the concept and the camera; widen the world from "a programmer's screen" to "the screens of a life" (Section C.1).

**Sketch cards** (`sketch.ts`) · 8 / 8 / 8 / 6 / 8 / 7 / 8 · **7.6** · **KEEP (refine)**
- Observed: one 4:3 card on black; words laid out as a poster (one huge outlined word, one on a coloured blob, the rest in thin lettering), a drawing in a corner, paint-program dither from a
  per-card-pixel noise snap. On the branch: per-line generated designs (12 frames, 24 drawings + the art library, 12 font sets, 4 key-word boxes, 4 inking styles).
- Strengths: the composition is genuinely typographic (hierarchy changes per line), the dither trick is distinctive, and it reads well.
- Weaknesses: it is always one card centred on black, so the frame never changes scale; hard cuts every line with no progression across a song; the intro shows an empty card; the
  doodles skew cute, which limits darker songs.
- Action: keep; absorb Notebook and Acid's best parts (C.9).

**ASCII eye** (`ascii.ts`, `subject.ts`, `EYE_FS`) · 7 / 7 / 8 / 6 / 5 / 7 / 7 · **6.85** · **REDESIGN into "Glyph Cinema"**
- Observed: a shader picture (18 subjects on the branch: eye, highway, lights, ocean, fire, city, space, rain, tunnel, heart, flower, mountains, equalizer, vortex, globe, sungrid, helix, butterfly)
  turned into characters inside a small window in a dark room (code strip, taskbar, keyboard), the lyric typed below in small amber mono.
- Strengths: song-driven subject choice is the right idea; the character pass is a real medium.
- Weaknesses: in my renders the picture occupies about a third of the frame and the lyric is small and low-contrast; the "room" furniture repeats in every frame; the lyric never takes part in the image.
- Action: make the characters the whole frame and let the lyric's own letters build the picture (C.2).

**Acid grain** (`acid.ts`) · 6 / 7 / 6 / 6 / 5 / 5 / 8 · **6.1** · **MERGE** (creatures and print grain into Sketch cards; hue-rolling colour field into Liquid Light Show)
- Observed: hue-rolling blobs under coarse colour grain, full-frame fringing, a crowd of outlined creatures (eyes, flowers, cats...) looping a 7 s choreography, the line as a condensed subtitle.
- Strengths: loud, joyful, memorable on first sight.
- Weaknesses: the choreography loops on a fixed 7 s cycle regardless of the song; the subtitle is small and its yellow-on-rainbow contrast varies (my frames show "HOLD THE LIGHT" on green
  with heavy scan moire); after a minute it is the same dance. As a whole style it overlaps Sketch cards (drawn characters, grain, cute) and the psychedelic colour field of a liquid show.

**Lyrics app** (`nebula.ts`) · 5 / 3 / 4 / 6 / 8 / 6 / 9 · **5.15** · **REMOVE** (keep the rolling column as a layout inside Nocturne)
- Observed: the active word large in a column, neighbours small and dim, a chip on key words; grounds: colour mesh, nebula with neon streaks and a tiny ship, stickers, glow blobs; 7 layouts.
- Strengths: the rolling column is the most readable word-by-word layout in the app.
- Weaknesses: it reproduces a well-known music app's lyrics view, which the brief rules out as a direction to imitate; the mesh is a generic gradient; the space ground is decoration unrelated to the song.

**Liquid light** (`gl/renderer.ts` long path) · 5 / 3 / 4 / 6 / 6 / 7 / 8 · **5.0** · **REDESIGN into "Liquid Light Show"**
- Observed: the direction's look turned up, over a soft shader backdrop with beat shockwaves; a black first frame in the intro of the demo song.
- Weakness: it is not a style but an intensity setting, so it inherits the directions' sameness; the backdrops are the generic "glowing gradient" the brief warns against.
- Action: replace with a real medium, the 1960s liquid light projection (C.8).

### Clean art directions

| Direction | Scores | Total | Action | Why (observed, then judgement) |
|---|---|---|---|---|
| **Cover Pop** | 7/6/6/7/7/8/8 | **6.75** | **KEEP, redesign** | The only look where the cover itself is the stage, phrases of 1-3 words with a chip, colour chosen by what is behind each word. Strong and song-specific; motion is still limited to phrase hand-offs (C.14). |
| **Type as Rhythm** | 7/6/5/6/9/6/9 | 6.45 | MERGE into Konstrukt | Anton + serif italic, split panel with flat geometric shapes; the best structural idea in the directions, but the shapes are static decoration. |
| **Broadsheet** | 7/6/5/4/9/5/9 | 6.05 | MERGE into Folio | Newsprint serif, framed cover card; elegant, nearly still. |
| **Ether** | 7/6/5/4/8/5/9 | 5.95 | MERGE into Folio | Left-aligned Instrument Serif, paper collage cover; an art-book page. |
| **Controlled Disorder** | 6/6/5/6/6/5/8 | 5.8 | MERGE (Konstrukt's slices, Folio's loud issue) | Mixed faces and colour slices; the idea of disruption is good, the execution is a split panel with bars. |
| **Graphic** | 6/5/5/5/8/6/8 | 5.75 | MERGE into Konstrukt | Flat colour field and shapes kept away from ink; generic contemporary. |
| **Art Book** | 7/5/5/4/8/5/9 | 5.75 | MERGE into Folio | Paper and terracotta, card cover, line reveals; overlaps Ether and Broadsheet. |
| **Velvet** | 7/5/4/4/9/5/9 | 5.65 | MERGE into Nocturne | Cormorant on oxblood, warm light pool; beautiful, but a palette of Nocturne. |
| **Nocturne** | 7/5/4/4/8/6/9 | 5.65 | MERGE (becomes the core of Nocturne) | Thin sans + serif italic on ink blue, bokeh at the edges. |
| **Analog Cinema** | 6/4/4/4/8/6/8 | 5.2 | MERGE into Celluloid | Bebas + typewriter, grain, warm mono; a texture, not a film language. |
| **Stillness** | 7/4/3/3/9/5/9 | 5.1 | MERGE into Nocturne | One halo, Cormorant Light; the right restraint but no ecosystem at all. |

### Classic looks

All 13 share one composition (centred caps block on a cover wash, stickers, the same entrances). Scores are low on originality and assets for that reason, not on craft alone.

| Look | Scores | Total | Action | Where its one good idea goes |
|---|---|---|---|---|
| Notebook | 5/4/4/4/7/5/9 | 4.85 | MERGE | Ruled paper and highlighter swipe → Sketch cards (a "paper" family) |
| Pop art | 5/3/4/5/6/5/9 | 4.7 | MERGE | Halftone, thick outlines, hard shadows → Panels |
| Film | 5/3/3/4/7/5/9 | 4.45 | MERGE | Warm grain and serif titles → Celluloid |
| Retro VHS | 4/3/4/5/5/5/9 | 4.4 | MERGE | Tape artefacts → one "stock" inside Celluloid |
| Monochrome editorial | 4/3/3/4/7/5/9 | 4.25 | MERGE | Serif/grotesk contrast → Folio |
| Gloss | 4/2/3/4/8/6/9 | 4.25 | MERGE | Cover-colour gradients → Cover Pop |
| Neon noir | 4/3/3/4/6/5/9 | 4.15 | MERGE | Tube-light type → the neon family in Signage |
| Aurora | 4/2/3/4/7/5/9 | 4.05 | MERGE | Slow colour → Liquid Light Show's calm end |
| Minimal | 4/2/2/3/8/6/9 | 3.9 | MERGE | Its restraint → Nocturne |
| Psychedelic | 3/3/3/5/4/4/9 | 3.8 | MERGE | Hue cycling, echo trails → Liquid Light Show |
| Y2K | 3/3/3/4/5/4/9 | 3.75 | **REMOVE** | Chrome type is a fashion effect; nothing kept |
| Vaporwave | 4/2/3/4/5/3/9 | 3.65 | **REMOVE** | Sunset grid is the most clichéd image in lyric video; the app already worked to stop R&B defaulting to it |
| Maximalist | 3/2/3/5/4/4/9 | 3.6 | **REMOVE** | Low contrast in my render; the hook "burst" survives as a Cover Pop chorus behaviour |

## A.4 Summary of the audit

- **Keep (1):** Sketch cards. **Keep and redesign (2):** Code screens (becomes Screenlife), Cover Pop.
- **Redesign completely (2):** ASCII eye → Glyph Cinema; Liquid light → Liquid Light Show.
- **Merge (21):** 10 directions and 10 classic looks fold into Nocturne, Folio, Konstrukt and Celluloid, or donate one idea to another style; Acid grain splits between Sketch cards and Liquid Light Show.
- **Remove (4):** Y2K, Vaporwave, Maximalist, and Lyrics app as a standalone style (its rolling column becomes a Nocturne layout).

## A.5 Structural findings (they matter as much as the per-style verdicts)

1. **Rendering mode is doing the job of style.** Today a person picks Clean or Turbo first and sees two unrelated menus. The 15 styles should be the only artistic axis; Clean and Turbo should become
   a quality tier (Canvas 2D fallback, GPU full) under each style. Phase 2 must confirm every style has an honest Canvas 2D fallback or say it is GPU-only.
2. **Variety today comes from shuffling parameters, not from scenes.** The branch's variety work multiplies counts (Code screens: `12 x 2 x 12 x 6` = 1,728 "looks"; Lyrics app `7 x 4 x 8` = 224; doodles 1,080).
   Those are combinations of a few real ideas. Recolouring a chat window is not a new scene. Section E counts *meaningful* compositions instead.
3. **The auto director mixes all six styles in one song.** It cuts from code screens to acid eyes to a nebula at section changes. That gives energy but no artistic coherence: a song stops having a look.
   For the new collection the director should cut between **scene families inside one style** (Section J), with a cross-style "VJ mix" as an explicit opt-in.
4. **Scenes ignore the song.** Five of six Turbo scenes used fixed palettes (on the branch some now take song hues). Every new style must take colour, subject and pacing from the song identity.
5. **Estimated word timing is treated as exact.** Typing, chips and per-word hits fire on estimated words. Every style below defines a soft behaviour for estimated words.
6. **Complex scripts are unchecked inside scenes** (AGENTS.md section 10). Per-letter effects (Sketch cards' per-letter rotation, typing) are the risky ones; Section C rates each style on this.

---

# Section B: External research catalog

48 directions were considered. Each entry gives: the idea; references; type and composition; motion; materials and colour; strengths (+) and weaknesses (−) for synced lyrics;
originality and quality; room for variation; feasibility in Lyricscape's architecture (pure `computeFrame`-driven scenes on a WebGL2 host with sprites, shapes, full-screen shaders and an ASCII pass);
and the verdict with a weighted score (same weights as Section A). The score is for the direction *as a standalone lyric style*.

"Absorbed" means the idea lives on inside a selected style. Close relatives are grouped so the catalog is not padded: where two references are one idea, they share an entry.

## B.1 Film titles and cinematic craft

**1. Cut-paper title design** — Saul Bass, *Anatomy of a Murder* (1959), and his body of title work.
- Idea: a whole film reduced to flat, cut shapes on a plain ground; the credits sit beside the pieces of a figure that is taken apart like a puzzle.
- Refs: [Art of the Title, Anatomy of a Murder](https://www.artofthetitle.com/title/anatomy-of-a-murder) *(read: "cutouts of paper on a uniform grey background"; the body is shown whole, then "each piece of the body is disassembled and presented like it is part of a puzzle")*; [Saul Bass titles](https://www.artofthetitle.com/designer/saul-bass/titles); [BFI, 10 essential Bass sequences](https://www.bfi.org.uk/news-opinion/news-bfi/lists/saul-bass-10-essential-title-sequences).
- Type/composition: lettering placed in relation to a shape, lots of flat ground. Motion: shapes slide in, assemble and break apart. Materials: paper, one or two flat colours.
- + Very readable, strong composition, cheap to render. − On its own it is a 1950s pastiche risk.
- Originality high as a lineage, variation high (subjects are endless), feasibility high (sprites and masks). **Absorbed into Paper Theatre.** 7.6

**2. Stamped silhouettes and the jet-set chase** — Kuntzel + Deygas, *Catch Me If You Can* (2002).
- Refs: [Art of the Title](https://www.artofthetitle.com/title/catch-me-if-you-can/) *(read: hand-carved stamps animated "in a traditional manner on paper by hand", then placed into a computer-built décor; "the colours signal geographical and temporal transitions"; type is "flowing" and travels with the figures)*.
- Type: flowing script and sans that move along paths with the figures. Motion: a fast, playful pursuit across changing colour fields. Materials: rubber-stamp texture, flat period colour.
- + Proves a cut-paper world can move fast and stay legible; colour change as a scene change. − Characters (people) are expensive to draw well.
- **Absorbed into Paper Theatre** (stamp textures, colour-field changes as section changes). 7.4

**3. Scratchboard and optical-printer distress** — Kyle Cooper, *Se7en* (1995).
- Refs: [Art of the Title, Se7en](https://www.artofthetitle.com/title/se7en/) *(read: type "hand-etched into black-surface scratchboard and manipulated during the film transfer process to further smear and jitter it"; a "staccato edit"; optical-printer accidents kept in)*; [Kyle Cooper](https://www.artofthetitle.com/designer/kyle-cooper).
- Type: scratched, jittering, mixed with a clean grotesk. Motion: staccato cuts, jitter, smear, flash frames. Materials: scratchboard, leader, backlit paper, film damage.
- + The richest vocabulary of film texture for type; a dark song gets a real language. − Its source is a horror film; the darkness must be one register of a broader style, not the whole of it.
- **Absorbed into Celluloid.** 7.7

**4. Optical glow titles** — Imaginary Forces, *Stranger Things* (2016).
- Refs: [Art of the Title](https://www.artofthetitle.com/title/stranger-things) *(read: "large, hollow" letters that "drift through a void, slowly assembling" with glowing red edges; an early "locking in" version was rejected as too rigid; Kodalith backlight tests studied for grain on letters, imperfect edges and colour shifts)*.
- Type: large hollow serif glowing at the edges. Motion: slow drift and assembly. Materials: backlit film, grain, red fringing.
- + A model for slow, cinematic word assembly; shows restraint beats polish. − Its look (red glowing ITC Benguiat) is tied to one show; take the method, not the look.
- **Absorbed into Celluloid** (the backlit-title register). 7.0

**5. Strobing typographic onslaught** — Tom Kan, *Enter the Void* (2009).
- Refs: [Art of the Title](https://www.artofthetitle.com/title/enter-the-void) *(read: names as "bright little deaths fired to a machine gun beat"; every credit a different face; transitions built "image-by-image"; Kan explored "retinal persistence and the limits of readability")*; [Fonts in Use](https://www.fontsinuse.com/uses/61211/enter-the-void-title-sequence).
- Type: a new face per word, full frame. Motion: frame-rate strobing. Materials: neon, flyers, electrophotography.
- + The most musically charged type idea found. − Designed to be felt, not read, and it strobes: it fails the app's 12% flash rule and readability guarantee.
- **Rejected as a style**; a tamed "title burst" (one face per word, no strobe, flash-limited) is absorbed into Celluloid's chorus behaviour. 5.5

**6. Double-exposure portraits** — Patrick Clair / Elastic, *True Detective* (2014).
- Refs: [Art of the Title](https://www.artofthetitle.com/title/true-detective) *(read: "human figures as windows into partial landscapes"; footage slowed to "10% or 20%"; "Very slow" virtual camera moves; palette of "pale yellows, greens, dark blues, and light flares")*; [Patrick Clair](https://en.wikipedia.org/wiki/Patrick_Clair).
- + Haunting, emotional, slow; great for ballads. − It needs photographs and figures; Lyricscape cannot ship third-party photos, and generating a convincing original photo library is the most expensive asset type there is.
- **Rejected** (Section H); its silhouette-as-window idea is absorbed into Paper Theatre. 6.4

**7. Step-printing and smeared time** — Wong Kar-wai and Christopher Doyle, *Chungking Express* (1994).
- Refs: [Step printing explained](https://melies.co/cinematic-techniques/time-and-motion/step-printing); [cinematography.net, step-printing examples](https://cinematography.net/edited-pages/StepPrinting-ExamplesInformation.htm); [In Depth Cine](https://indepthcine.com/videos/chungking-express).
- Motion: low shutter, frames repeated so movement smears while a still subject stays sharp. Materials: neon colour, film.
- + A motion technique that is very lyrical and cheap on a GPU (accumulation). − A technique, not a style.
- **Absorbed into Celluloid** (and Nocturne for the night city register). n/a

**8. Hand-scratched abstract film** — Len Lye, *Free Radicals* (1958/79); Shynola, *Scott Pilgrim vs. the World* titles (2010).
- Refs: [Len Lye](https://www.Wikipedia.org/wiki/Len_Lye); [Free Radicals, Harvard Film Archive](https://harvardfilmarchive.org/programs/free-radical-the-films-of-len-lye); [Art of the Title, Scott Pilgrim](https://www.artofthetitle.com/title/scott-pilgrim-vs-the-world/) *(read: scratched onto acetate "about one second of footage per sheet", sheets "kicked across the floor" for dust and hairs, plotted on computer first so "every graphic and symbol" lands in time with the track; influences Lye, Fischinger, Brakhage, McLaren)*.
- Motion: frame-by-frame boil, lines that hit on beats. Materials: black emulsion, scratched white and dyed lines.
- + Hits are graphic and readable; the Scott Pilgrim method (plan on computer, texture by hand) is exactly how Lyricscape can work. − Relentless boil tires the eye.
- **Absorbed into Celluloid** (scratched transitions) and Phosphor (line energy). 7.2

## B.2 Visual music and abstract animation

**9. Visual music** — Oskar Fischinger, *An Optical Poem* (1938).
- Refs: [An Optical Poem, Il Cinema Ritrovato](https://festival.ilcinemaritrovato.it/?p=24707); [MUBI](https://mubi.com/films/an-optical-poem); [Oskar Fischinger](https://wikipedia.com/wiki/Oscar_Fischinger).
- Idea: paper circles and shapes move in depth and on the beat of Liszt; the shapes *are* the music. Composition: flat field, few shapes, deep space implied by scale.
- + The purest relationship between motion and music; timeless. − No words; needs a typographic partner.
- **Absorbed into Konstrukt** (shapes as the score). 7.6

**10. Drawn sound** — Norman McLaren, *Synchromy* (1971).
- Refs: [NFB, Synchromy](https://collection.nfb.ca/film/synchromy); [Animafest](https://animafest.hr/en/2014/film/read/synchromy).
- Idea: the bars that make the soundtrack are the picture, multiplied across the screen in colour. Composition: columns of repeated rectangles.
- + Shows rhythm as stacked bars; a natural fit for a beat grid. − Literal (it shows the waveform); we cannot draw our audio's waveform on Spotify songs.
- **Absorbed into Konstrukt** (columns and bars driven by the beat grid, not audio). 6.8

**11. Oscilloscope music** — Jerobeam Fenderson and Hansi Raber.
- Refs: [Creative Applications](https://www.creativeapplications.net/project/oscilloscope-music-jerobeam-fenderson-and-hansi-raber/); [IEEE Spectrum](https://spectrum.ieee.org/jerobeam-fendersons-trippy-oscilloscope-music); [IMA archive](https://archiv.ima.or.at/en/oscilloscope-music/).
- Idea: one beam of light draws figures that morph; green phosphor, persistence trails.
- + A single continuous line is a fresh lyric medium (words drawn by the beam, then the beam becomes a picture). − In their work the audio *is* the drawing; we only borrow the look and the morphing.
- **Selected, as the core of Phosphor.** 7.5

**12. Light drawing** — Gjon Mili's 1949 photographs of Picasso drawing with light.
- Refs: [LIFE, Behind the Picture](https://www.life.com/arts-entertainment/behind-the-picture-picasso-draws-with-light/); [Google Arts & Culture](https://artsandculture.google.com/story/PgXRm8J028B8KQ).
- Idea: a gesture in the dark leaves a line of light. + Handwriting in light is a lyric-native gesture. − Static in the original medium.
- **Absorbed into Phosphor** (a warm, hand-drawn register next to the cold oscilloscope one). 7.0

**13. Early lyric video as graphic music** — Prince, *Sign o' the Times* (1987).
- Refs: [Wikipedia, Sign o' the Times (song)](https://en.wikipedia.org/wiki/Sign_o%27_the_Times_(song)); [Prince Vault, the video](https://princevault.com/index.php/Video:_Sign_O'_The_Times); [People's Graphic Design Archive](https://peoplesgdarchive.org/item/8843/prince-sign-o-the-times-music-video).
- Idea (from my knowledge of this widely documented video, not re-watched): words and abstract shapes pulse in flat colour, with no performer. Historically the reference point for the lyric video.
- + Proves typography plus pulse can carry a whole song. − Dated as a look.
- **Absorbed into Konstrukt.** 6.5

## B.3 Graphic design and typography

**14. Swiss constructivist music posters** — Josef Müller-Brockmann, *musica viva* for the Zurich Tonhalle (1950s-70s).
- Refs: [Socks Studio](https://socks-studio.com/2016/11/30/joseph-muller-brockmann-musica-viva-posters-for-the-zurich-tonhalle/) *(read: worked "within the rigid system of the grid", sought "a visual linkage between the language of Constructivism and musical harmonic structures"; Paul Rand: they "evoke the very sounds of music by visual equivalents")*; [V&A](https://collections.vam.ac.uk/item/O110243); [People's GD Archive](https://peoplesgdarchive.org/item/17122/musica-viva-posters-for-the-zurich-tonhalle).
- Type: grotesk, flush left, on a modular grid. Composition: geometric forms in rhythmic progression. Motion (ours): forms advance on the beat.
- + The best lineage for "music made visible" with real typography. − Easy to make cold; needs warmth from colour and pace.
- **Selected, core of Konstrukt.** 8.3

**15. Responsive identity** — Experimental Jetset, Whitney "responsive W" (2013).
- Refs: [Designboom](https://www.designboom.com/design/new-whitney-museum-identity-by-experimental-jetset/); [Dezeen](https://www.dezeen.com/2013/05/21/whitney-graphic-identity-by-experimental-jetset/).
- Idea: one zig-zag line that scales to whatever space a layout gives it. + A model for a rule-based system that stays one identity across infinite layouts. − A system idea, not a look.
- **Absorbed into Konstrukt** (one structural line that reshapes per lyric line). n/a

**16. Deconstructed magazine type** — David Carson, *Ray Gun* (1992-95).
- Refs: [Ray Gun cover, People's GD Archive](https://peoplesgdarchive.org/item/5365/ray-gun-magazine-cover); [EBSCO, David Carson](https://ebsco.com/research-starters/communication-and-mass-media/david-carson-graphic-designer).
- Type: overlapping, cropped, mixed faces, columns colliding. + Energy and attitude for loud rock and rap. − Deliberately hard to read; must be capped.
- **Absorbed into Folio** (its "loud issue" register, readable lyric always kept clean). 6.0

**17. Editorial page: newspaper and art book** — existing Broadsheet, Art Book, Ether.
- Refs: the repo's own `docs/artistic-direction-v3.md` and `gallery-auto.png`.
- + Serif typography, real hierarchy, image plates; superb readability. − Static; today it is three palettes of one page.
- **Selected, core of Folio.** 7.8

**18. Op art** — Bridget Riley, *Movement in Squares* (1961).
- Refs: [The Art Story](https://www.theartstory.org/artist/riley-bridget/artworks/); [Artchive](https://www.artchive.com/artwork/movement-in-squares-bridget-riley-1961/).
- + Pure rhythm from pattern; strong on beats. − Moiré and high-contrast stripes in motion are a photosensitivity hazard and fight type.
- **Absorbed into Konstrukt** as a low-contrast, slow pattern family only. 5.4

**19. Concrete poetry, calligrams and typewriter art** — Apollinaire's calligrams; Dom Sylvester Houédard's typestracts.
- Refs: [V&A, Houédard](https://api.vam.ac.uk/v2/object/O155042); [Kingston, Houédard](https://eprints.kingston.ac.uk/id/eprint/38184); [Notes from the Cosmic Typewriter](https://occasionalpapers.org/product/notes-from-the-cosmic-typewriter-the-life-and-work-of-dom-sylvester-houedard/).
- Idea: the poem's letters form the picture of what it says. + The most lyric-native idea in the catalog: the image is made of the song's own words. − Needs care for long lines and non-Latin scripts.
- **Absorbed into Glyph Cinema** (its signature behaviour). 8.0 as an idea

**20. Hand-held cue cards** — D. A. Pennebaker's *Subterranean Homesick Blues* opening of *Dont Look Back* (1967).
- Refs: [Wikipedia, Dont Look Back](https://en.wikipedia.org/wiki/Dont_Look_Back); [Sound & Vision interview](https://www.soundandvision.com/content/da-pennebaker-50-years-bob-dylan-dont-look-back-part-ii).
- Idea: hand-lettered cards dropped one by one, on the words. + Proves one card per phrase, hard cuts, is a complete lyric language. − A single famous image.
- **Absorbed into Sketch Cards** (card-drop grammar). 6.6

## B.4 Print, paper and handmade media

**21. Risograph and spot-ink print** — misregistration, overprint, coarse grain.
- Refs: [Oxford Green Print, design for Riso](https://oxfordgreenprint.com/home/design-for-riso/); [MICA Riso studio](https://www.mica.edu/maker-spaces-studios/2d-prototyping-studio/riso-image-making-and-printing/); [Moniker Press guide](https://monikerpress.ca/printing).
- + Warm, contemporary, already half-present in Acid grain (split outlines, coarse grain). − As a full style it overlaps Sketch cards and Panels.
- **Rejected as a separate style** (Section H); absorbed as a print process in Sketch Cards and an overprint mode in Konstrukt. 6.65

**22. Halftone comics and manga screentone** — Ben-Day process and its descendants.
- Refs: [Ben Day process](https://en.wikipedia.org/wiki/Ben_Day_process); [Legion of Andy, Ben-Day history series](https://legionofandy.com/2015/09/09/ben-day-dots-part-4-pre-history-origins/); [The Nib colour archive](https://thenib.com/color-archive/).
- Type: hand lettering in balloons and captions, SFX lettering. Composition: panels. Motion: panel to panel, speed lines.
- + Sequential art is how lyrics already read (one beat per panel); an enormous grammar. − Characters are costly; must work with objects, places and abstract panels.
- **Selected as Panels.** 7.95

**23. Moving cut-out collage** — Terry Gilliam's animation method.
- Refs: [Make, Gilliam cut-out how-to](https://makezine.com/article/craft/how-to_cut-out_animation_with/); [Laughing Squid, 1974 TV demonstration](https://laughingsquid.com/terry-gilliam-explains-monty-python-cutout-animation/).
- + Hinged cut-outs give a lot of motion for little art. − Gilliam's look depends on Victorian photo engravings, which we cannot copy.
- **Absorbed into Paper Theatre** (hinged cut-outs, no borrowed imagery). 6.8

**24. Silhouette shadow theatre** — Lotte Reiniger, *The Adventures of Prince Achmed* (1926).
- Refs: [Wikipedia](https://en.wikipedia.org/wiki/The_Adventures_of_Prince_Achmed); [Daily Art Magazine](https://www.dailyartmagazine.com/through-scissors-and-shadows-the-art-and-films-of-lotte-reiniger/); [Deutsche Kinemathek](https://www.deutsche-kinemathek.de/en/collections-archives/digital-collection/personal-papers-and-company-archives/lotte-reiniger).
- Composition: black silhouettes against tinted, layered grounds; depth from layers. Motion: articulated cut figures, slow and graceful.
- + Gorgeous, timeless, readable (type sits on the light ground), parallax gives depth, layers give endless scenes. − Ornamental silhouettes take skill to draw.
- **Selected, core of Paper Theatre.** 8.25

**25. Ink brush** — East Asian ink-wash painting (sumi-e), brush calligraphy.
- Refs: [Sumi-e, Fiveable](https://fiveable.me/history-japan/key-terms/sumi-e.md); [What is Sumi-e](https://sites.google.com/sdceonline.com/sumi-e/resources/what-is-sumi-e).
- Idea: few strokes, wet edges, empty paper as space. + A brush stroke has a start, a speed and an end, exactly like a sung word. − Cultural pastiche risk; must be ink as a material, not "Japan" as a costume.
- **Selected as Ink.** 7.9

**26. Ink in water** — Alberto Seveso's photographs.
- Refs: [My Modern Met](https://mymodernmet.com/alberto-seveso-colorful-musician-album-covers); [Design Milk](https://design-milk.com/alberto-seveso/).
- + Billowing clouds that bloom from a point: a perfect "word lands" image. − A photograph; we can only simulate it.
- **Absorbed into Ink** (black ink blooming in water) **and Liquid Light Show** (coloured dyes). 7.0

**27. Notebook handwriting** — existing Notebook look.
- **Absorbed into Sketch Cards** (paper family). 4.85

## B.5 Light, projection and fluid

**28. Liquid light show** — The Joshua Light Show (1967-), overhead projectors, oil, water and dyes.
- Refs: [Wikipedia, Liquid light show](https://en.wikipedia.org/wiki/Liquid_light_show); [Wikipedia, The Joshua Light Show](https://en.wikipedia.org/wiki/The_Joshua_Light_Show); [MoMA, Liquid Loops](https://www.moma.org/collection/works/200467); [VICE, grandfathers of VJing](https://noisey.vice.com/en/article/ezaezk/experimental-imagery-meet-the-grandfathers-of-vjing-joshua-light-show).
- Idea: live hands push coloured oil and water in glass dishes on overhead projectors; colour wheels, bubbles, hard-edged blobs that split and merge.
- + A real, physical medium for the "psychedelic" slot, made by hand and performed to music, so its motion is musical. − Readability over moving colour needs a type treatment of its own (a projected slide).
- **Selected as Liquid Light Show.** 7.75

**29. Projection onto structure** — Joanie Lemercier (AntiVJ).
- Refs: [Joanie Lemercier, light sculpture](https://joanielemercier.com/light_sculpture); [CDM, AntiVJ](https://cdm.link/plays-of-shadow-and-light-into-digital-topography-new-antivj-work/).
- + Light revealing geometry; strong for depth. − Needs a structure to project on.
- **Absorbed into Monument** (lyrics as light on architecture) **and Phosphor** (vector light). n/a

**30. Audio-reactive particles** — Robert Hodgin, Magnetosphere (became the iTunes visualizer, 2008).
- Refs: [CDM](https://cdm.link/2008/09/04/flight404s-magnetosphere-the-new-visualizer-in-itunes-8/) *(read: only says "hypnotic pulsing orb" and that it was built with Processing)*; [Make](https://makezine.com/article/maker-news/apples-new-itunes-visuali).
- + Beautiful, the reference of the genre. − The genre itself is what the brief calls generic; nothing in it relates to words.
- **Rejected.** 5.3

**31. Machine-learning data painting** — Refik Anadol.
- Refs: [NVIDIA artist page](https://images.nvidia.com/artists/refik-anadol/); [MoMA essay](https://medium.com/towards-data-science/free-from-limitations-the-validation-of-machine-hallucinations-at-moma-7d56a38c335a).
- − Needs trained models and large datasets; local-first and deterministic rendering rule it out; the look has become a fashionable cliché. **Rejected.** 4.6

**32. Neon and night signage** — existing Neon noir, plus real sign craft.
- **Absorbed into Signage** (neon as one display family). 6.0

## B.6 Display technology and screens

**33. Split-flap boards** — Solari di Udine and the railway/airport departure board.
- Refs: [Split-flap display](https://en.wikipedia.org/wiki/Split-flap_display); [Solari di Udine](https://en.wikipedia.org/wiki/Solari_di_Udine); [Core77, Cifra 3](https://www.core77.com/posts/138912/An-Industrial-Design-Classic-Gino-Valles-Cifra-3-Flip-Clock).
- Motion: every character cycles through flaps until it lands, with a sound people remember. + A lyric arriving letter by letter with mechanical suspense; strong rhythm. − Alone it is one gimmick.
- **Absorbed as the anchor family of Signage.** 7.2 alone, 7.95 as Signage

**34. Low-resolution LED** — Jim Campbell.
- Refs: [Fundación Telefónica, Rhythms of Light](https://espacio.fundaciontelefonica.com/en/evento/jim-campbell-rhythms-of-light/); [LEDinside, the LED art of Jim Campbell](https://www.ledinside.com/lighting/2014/4/philips_the_led_art_of_jim_campbell).
- Idea: a few hundred LEDs, and you still recognise a walking figure. + Readable pictures from almost nothing; poetic. − Type on a coarse grid needs a pixel font per script.
- **Absorbed into Signage** (LED boards) **and Glyph Cinema** (coarse grids). n/a

**35. Teletext art** — International Teletext Art Festival.
- Refs: [Rhizome](https://rhizome.org/editorial/2013/aug/21/selections-international-teletext-art-festival-201/) *(read: "a grid of 24 rows and 40 columns"; each colour change or blink costs a control character that "uses up one space in the grid, which then appears black")*; [teletextart.com](https://www.teletextart.com/information/itaf-archive-2014-2012/); [Hyperallergic](https://hyperallergic.com/the-retro-aesthetics-of-teletext-art).
- + A strict grid with eight colours is a beautiful constraint for pictures and type together. − Very coarse for long lines.
- **Absorbed into Glyph Cinema** (a mosaic register). 6.5

**36. ASCII picture** — existing ASCII eye. **Redesigned as Glyph Cinema.** 6.85

**37. 1-bit dithering** — Lucas Pope, *Return of the Obra Dinn*.
- Refs: [PlayStation Blog, how Pope made the 1-bit style](https://blog.playstation.com/archive/2019/10/17/lucas-pope-on-return-of-the-obra-dinns-art-style); [PC Gamer](https://www.pcgamer.com/lucas-pope-on-the-challenge-of-creating-obra-dinns-1-bit-aesthetic); [Game Developer](https://gamedeveloper.com/design/lucas-pope-and-the-rise-of-the-1-bit-dither-punk-aesthetic).
- + Proof that stable dithering in motion is solvable and striking. − A rendering finish, not a style.
- **Absorbed** into Glyph Cinema (1-bit register) and Sketch Cards (their dither already exists). n/a

**38. Glitch** — Rosa Menkman, *The Glitch Moment(um)*.
- Refs: [Furtherfield](https://www.furtherfield.org/the-glitch-momentum); [Sonic Field](https://sonicfield.org/wiki/rosa-menkman).
- + A small vocabulary of breakage is useful for cuts. − As a whole style it is the most overused lyric-video effect.
- **Rejected as a style**; small, rule-bound glitch cuts stay in Screenlife and Celluloid. 4.8

**39. Screen-based storytelling** — "screenlife" films (Timur Bekmambetov's *Searching*, *Unfriended*, *Profile*).
- Refs: [Screenlife](https://en.wikipedia.org/wiki/Screenlife); [Engadget on Searching](https://www.engadget.com/2018/08/27/searching-john-cho/); [ScreenAnarchy interview](https://screenanarchy.com/2021/05/interview-timur-bekmambetov-talks-profile-and-screenlife-filmmaking-1.html).
- Idea: a whole story told through one person's screens: typing, deleting, searching, a cursor hesitating. + Typing and deleting are the most human lyric gestures there are. − Real apps and brands must never appear.
- **Selected, the frame for Screenlife** (with the existing Code screens as its origin). 8.6

**40. VHS, CRT and broadcast** — existing Retro VHS.
- **Absorbed into Celluloid** as one "stock" (tape) among film stocks. 4.4

## B.7 Generative and computational

**41. Data aesthetics** — Ryoji Ikeda, *datamatics* and *test pattern*.
- Refs: [YCAM, test pattern](https://special.ycam.jp/datamatics/en/testpattern.html); [Creative Applications profile](https://www.creativeapplications.net/project/ryoji-ikeda-profile/); [e-flux](https://www.e-flux.com/announcements/39634/ryoji-ikeda-datamatics).
- + Austere, powerful, rhythmic. − Built on strobing black-and-white at audio rate (photosensitivity), and its look is a single artist's signature; little room for song-to-song difference.
- **Rejected** (Section H); barcode and data-field textures absorbed into Konstrukt and Glyph Cinema. 5.9

**42. Flow fields** — Tyler Hobbs, *Fidenza*.
- Refs: [LACMA Unframed](https://unframed.lacma.org/node/3685); [flow fields explainer](https://marcinklimek.github.io/posts/2024-01-03-flow-fields).
- + Endless, coherent variation from a few parameters. − A generative-art look, not a lyric language. **Absorbed** into Ink (brush paths) and Liquid Light Show. n/a

**43. Reaction-diffusion growth** — Karl Sims' explorations.
- Refs: [Karl Sims, Reaction-Diffusion](https://karlsims.com/rd.html); [RD tool](https://karlsims.com/rdtool-help.html).
- + Organic growth that can be seeded from text. − Simulation needs persistent state, which conflicts with the "pure function of time" rule unless precomputed. **Absorbed** as baked textures in Ink and Liquid. n/a

**44. Creative-coding typography** — Zach Lieberman's daily sketches.
- Refs: [M+, Atlas of Blobs](https://www.mplus.org.hk/en/exhibitions/zachary-lieberman-atlas-of-blobs/); [Layer interview](https://layer.com/artists/zach-lieberman/interview).
- + Proof that simple rules on letterforms make delight. − A practice, not a style. **Absorbed** into Konstrukt and Phosphor. n/a

**45. Spatial typographic architecture** — Universal Everything; Peter Cho's typographic research at the MIT Media Lab.
- Refs: [Universal Everything](https://en.wikipedia.org/wiki/Universal_Everything); [Inspiration Grid, hybrid typographic architecture](https://theinspirationgrid.com/hybrid-typographic-architecture-prototypes-by-universal-everything/); [Peter Cho, MIT thesis (PDF)](https://acg.media.mit.edu/projects/thesis/pchothesis.pdf); [Universal Everything, Lifecycles video](https://www.stashmedia.tv/universal-everything-merges-ai-and-typography-for-freefarm-lifecycles-music-video/).
- Idea: letters as buildings and spaces you travel through. + The only direction with true depth. − "3D text flythrough" is a cliché if done generically; readability while moving.
- **Selected as Monument.** 7.3

## B.8 Other formats

**46. Karaoke laserdisc films** — narrative backdrops for karaoke.
- Refs: [99% Invisible, Karaoke Videos](https://99percentinvisible.org/episode/670-karaoke-videos/) *(read: original short films on budgets of "$3,600 to $10,000", rules of no original artist footage and ideally "a beginning, middle, and end"; scenes "not always in the same room, tune, or key" as the song)*.
- + Lyric-native format (two-line sweep), charming absurdity. − Needs filmed footage; procedural stand-ins would be bland. **Rejected.** 5.6

**47. Synthwave / vaporwave** — existing Vaporwave. **Removed.** 3.65

**48. Rolling lyric column** — existing Lyrics app, modelled on a music app's lyrics view. **Removed as a style**; the column survives as one layout in Nocturne. 5.15

Also considered and dropped early without full entries, because each is either a surface finish or a single image rather than a style: stained glass, embroidery/cross-stitch,
pixel-art game screens, constellation maps, cymatics, rain-on-glass (kept as a Nocturne scene family), polaroid scrapbook, brutalist web pages, clay stop-motion.

---

# Section C: The final 15

The collection, in one line each:

| # | Style | One line | Origin |
|---|---|---|---|
| 1 | **Screenlife** | The song is typed, deleted and sent across the screens of one person's life | Code screens, redesigned |
| 2 | **Glyph Cinema** | Pictures made of characters, built from the lyric's own letters | ASCII eye, redesigned; teletext, calligram |
| 3 | **Paper Theatre** | Layered cut-paper and silhouette stages lit from behind | New |
| 4 | **Konstrukt** | A Swiss music poster whose shapes play the rhythm | Type as Rhythm + Graphic + Controlled Disorder, redesigned |
| 5 | **Celluloid** | Film title-sequence craft: scratched, backlit, step-printed | Analog Cinema + Film + Retro VHS, redesigned |
| 6 | **Folio** | The lyric as a living magazine and book page | Broadsheet + Art Book + Ether + Monochrome editorial |
| 7 | **Nocturne** | One light in the dark; intimate type and negative space | Nocturne + Velvet + Stillness + Minimal, plus Lyrics app's column |
| 8 | **Liquid Light Show** | Hand-pushed oil, water and dye on a projector | Liquid light, redesigned; Psychedelic, Aurora, Acid's colour field |
| 9 | **Sketch Cards** | One hand-made card per line, dropped like cue cards | Sketch cards; Notebook and Acid's creatures absorbed |
| 10 | **Signage** | The lyric on public display hardware: flaps, bulbs, neon, LEDs | New; Neon noir absorbed |
| 11 | **Ink** | Brush and ink on paper and in water | New |
| 12 | **Panels** | Sequential art: panels, captions, balloons, halftone | New; Pop art absorbed |
| 13 | **Phosphor** | One beam of light writes the words and draws the world | New |
| 14 | **Cover Pop** | The album cover is the stage | Cover Pop, redesigned; Gloss absorbed |
| 15 | **Monument** | Words as architecture you travel through | New |

Each dossier: A identity, B research, C typography, D composition, E motion, F musical relationship, G diversity, H asset ecosystem (detail in Section E),
I technical suitability, J risks, K why it earns its place. "Across a song" is folded into F. Unless marked otherwise, everything in these dossiers is **interpretation** (design proposal), grounded in the observed facts cited.

---

## C.1 Screenlife

**A. Identity.** The song is something a person is writing. Every line is typed, hesitated over, deleted, retyped and sent somewhere: a message, a search, a note at 3 a.m., a caption,
a form field, a terminal, a document. The camera is a second person looking over their shoulder. What makes it unique: lyrics become *acts* with intent and doubt (a deleted word says as much as a sung one),
and the world of fictional interfaces is close to infinite. Philosophy: intimacy through the interfaces we confess to.

**B. Research.** Screenlife films (Section B.39); the existing Code screens' camera grammar (rack focus, whip, dolly; observed in `terminal.ts`). Typing as character work (hesitation, correction) comes from those films.

**C. Typography.** The type of the interface itself: system sans for chat and notes, monospace for terminals and code, serif for a document, handwriting for a stylus note. The lyric is always the largest text in its UI and is pushed to legible size by the camera, not by enlarging the UI.
Emphasis: a word gets **selected** (highlight), **bolded**, **autocorrected**, or **mistyped then fixed**. Multilingual: interfaces naturally host any script; IME composition (kana to kanji, Hangul jamo assembly) is a beautiful native "typing" animation for CJK and Korean (speculative, needs work).

**D. Composition.** One interface fills the frame, framed by the camera at a slight angle; depth from focus (the rest of the UI blurs by mip level, as today). Negative space is the UI's own empty space (an empty chat, a blank note).
Families: messaging thread, notes app, search box with suggestions, terminal, document editor, form, photo caption, calendar invite, voice-memo transcript, lock-screen notification stack, code editor, spreadsheet cell.

**E. Motion.** Typing at a human cadence that fits the line's duration; the caret blinks in rests; backspace bursts; the "send" whoosh moves the message up the thread (the thread is the song's memory: earlier lines stay above).
Camera: settled handheld in verses; whip pans to a new app at a section change; slow push on held words. Exits: sent, archived, deleted, scrolled away.

**F. Musical relationship.** Line timing paces typing so the last character lands at the line's sung end (authored word times: each word appears on its cue; estimated words: typing is smoothed across the line with no per-word claims).
Hooks: the chorus becomes the same message **sent again** (a repeated bubble, "edited", a draft restored), which makes repetition meaningful. Breaks: typing indicator dots, a cursor blinking, notifications arriving, the screen dimming and locking.
Beat (only when present): notification haptics and camera micro-pushes on downbeats. Identity: perspective "addressed" (you/I) selects messaging; "inward" selects notes and drafts; "narrative" selects documents and captions.
Across a song: intro = a lock screen with time and nothing; verses = one app; chorus = switch to a louder app (a caption, a status) or the same message resent; bridge = a different device or a search ("how to ..."); outro = the phone locks, the thread remains.

**G. Diversity.** Between songs: the app family, light/dark, device (phone portrait, laptop, tablet, old terminal), language of the UI chrome (all fictional), wallpaper and accent from the cover, and whose screen it is (tidy vs chaotic).
Within a song: three to five app families visited along the structure, with the thread accumulating.

**H. Assets.** UI kits per fictional app (12-20 apps, each with 3-6 states), device frames, wallpapers (procedural from cover), notification and sticker sets, cursor/caret families, typing behaviour library (rhythms, typo models), camera move library. Estimate in Section E.

**I. Technical.** Sheets painted once per state into textures (existing approach), camera paths and typing as pure functions. Readability: high when the camera frames the line. Performance: low (1.6-1.8 ms measured for today's shots). Multilingual: good; RTL needs mirrored UI kits; IME composition is extra work.

**J. Risks.** Brand likeness (UIs must be clearly original, no real logos or recognisable app chrome); bloom blowing out light UIs (observed); developer-only subject matter (today's error lists and promise code); typing that looks fake with estimated timing; becoming a UI mock-up gallery rather than a story.

**K. Why it earns a place.** It is the one style where lyrics have authorship and doubt inside the image. Nothing else in the collection is about a person's private voice. Highest asset ceiling of all 15.

---

## C.2 Glyph Cinema

**A. Identity.** The picture is made of characters, and the characters are the song. A ringed planet, a highway, a face, rain: each is drawn in glyphs, and when a line is sung its letters run into the image and become part of it (the calligram idea).
Registers: ASCII brightness ramps, teletext mosaics (40x24, eight colours), typewriter overstrikes, 1-bit dither. What makes it unique: the boundary between lyric and image disappears.

**B. Research.** Calligrams and typewriter art (B.19); teletext art (B.35); Obra Dinn's stable 1-bit dithering (B.37); the existing ASCII subject engine (18 song-chosen subjects, observed).

**C. Typography.** One monospace grid per scene (the cell size is the style's "resolution"). The sung line is set in the same grid but brighter or inverted, then its letters migrate into the picture's brightness map. For long lines, the line holds as a clean band of text first, and only then dissolves.
Non-Latin: CJK and Hangul are full-width cells (two columns), which fits a grid well; Devanagari and Tamil conjuncts cannot be split into cells, so those scripts keep the lyric as a clean band and draw the picture from a neutral glyph set (stated limit).

**D. Composition.** Full-frame grid, no room furniture. The picture occupies the grid with breathing space; the lyric band sits on a fixed text row (top or bottom third, chosen per subject so it never crosses the subject's focal area). Teletext register uses blocky graphics with hard colour fields; typewriter register is ink on paper with overstrikes.

**E. Motion.** Characters change, they never slide: images develop like a slow print, dissolve through noise fronts (exists), and words "rain" into place cell by cell. Camera moves are grid-snapped (zoom in by cell size steps), which keeps the medium honest.

**F. Musical relationship.** Line start: the lyric types into its band (or, in teletext, appears as a page update). Hooks: the chorus line is written into the image itself (its letters become the subject's brightest areas). Breaks: the picture animates alone (rain falls, the highway moves). Beat: character density pulses; flicker is capped by the flash rule.
Subject from the song (exists, `subject.ts`): title word, then lyric themes, then mood. Across a song: intro develops the picture from blank; verses add detail; chorus flips register (ASCII to teletext colour) or zooms to a detail; outro the image decays to the last line alone.

**G. Diversity.** Subjects (18 today, room for 60+), registers (4), glyph sets per language and mood, palettes (phosphor green, amber, paper, teletext eight), grid resolution (coarse to fine). Within a song, the subject can change at sections, chosen from the lyric's later themes.

**H. Assets.** Subject shaders or baked brightness maps (the biggest family), glyph ramps (by script and mood), teletext page templates, paper/ink textures, transition patterns (wipe, rain, decay, page flip). Estimate in Section E.

**I. Technical.** Existing ASCII pass and subject shader. Calligram behaviour: route lyric glyphs into the image's cell grid (CPU decides which cell gets which letter; GPU draws). Performance moderate (3.2-3.3 ms today). Readability: a guarantee requires the clean band; the image is secondary.

**J. Risks.** Becoming a novelty ("it's ASCII"); readability when the grid is fine and the screen is a phone; the eye shader compiles slowly (eight scenes in one program, `docs/visuals.md` P5); Indic and Arabic letters can't be cell-split.

**K. Why.** It is the collection's most lyric-native idea: the song's words are its paint. No other style makes the text and the picture the same material.

---

## C.3 Paper Theatre

**A. Identity.** A stage of cut paper lit from behind. Layers of silhouettes (a city, a forest, waves, birds, two figures) stand at different depths in front of a tinted ground; the lyric is cut out of a banner, printed on a title card, or appears as light through a cut-out.
Philosophy: handmade storytelling with depth. Unique: the only style that builds small *worlds* with narrative and parallax depth, while staying flat and graphic.

**B. Research.** Reiniger (B.24), Saul Bass cut paper (B.1), Kuntzel + Deygas stamps and colour-coded transitions (B.2), Gilliam's hinged cut-outs (B.23), and the True Detective silhouette-as-window idea (B.6).

**C. Typography.** Three treatments: (1) cut letters (the lyric as a cut-out, shown as light through paper: high contrast, sharp edges); (2) a printed card or banner hung in the scene (serif or wood-type sans); (3) a stamped caption (rubber-stamp texture). Scale: lyric always on the brightest layer; key words cut larger.

**D. Composition.** Four to seven depth layers: backlit ground (gradient of one hue from the cover), far silhouettes, middle set, near frame (proscenium arch, branches, curtains), occasional foreground pieces sliding past. Type lives on a clean light band between layers. Frames: proscenium, a window, a book's pop-up spread, a lantern (a round stage).

**E. Motion.** Layers parallax with a slow dolly; hinged figures move on pivots (Gilliam/Reiniger style); scenery slides in on rails like a toy theatre; transitions are curtains, paper falling, a page turning, or the light colour changing (Catch Me If You Can's colour-coded transitions). Nothing morphs; everything is a rigid piece that moves.

**F. Musical relationship.** Line timing triggers pieces entering (a bird crosses during a line); word timing (authored) can cut a word open; estimated timing reveals the whole banner. Hooks: the chorus gets the full stage lit and the proscenium opens wider. Breaks: the set changes on stage (stagehands, sliding rails). Beat: small figures bob on beats when a grid exists, otherwise they move on line starts.
Subjects (identity): night and city, nature, sea, love, escape, memory map to set families. Across a song: intro = curtain, empty lit stage; verse 1 = one set; chorus = set with more layers and brighter light; bridge = scale change (a tiny stage in a big dark space, or a close-up); outro = the light fades behind the last silhouette.

**G. Diversity.** Set families (city, sea, forest, desert, mountains, rooms, sky, fairground...), light colours from the cover, paper types (black card, coloured tissue, kraft, layered greys), frame types, figure casts, time of day. Two songs share the medium and rarely a set.

**H. Assets.** Silhouette pieces (the largest family; vector art, handcrafted), hinged figures, frames and arches, paper textures, light gradients (procedural), set compositions (handcrafted arrangements), transition rigs. Estimate in Section E.

**I. Technical.** Sprites with alpha in layers, parallax camera, hinge transforms: all within the current host. Low GPU cost; the asset production (vector drawing) is the work. Readability excellent. Multilingual excellent (type sits on clean light).

**J. Risks.** Kitsch (fairy-tale ornament); pastiche of Reiniger or Bass if pieces copy known films; figure drawing quality; too slow for rap.

**K. Why.** Depth, narrative and handmade warmth together, with near-perfect readability. It gives Lyricscape the storybook register nothing else has.

---

## C.4 Konstrukt

**A. Identity.** A Swiss music poster that performs. Grotesk type on a strict grid; circles, bars, arcs and lines are the instruments: they enter, multiply, rotate and step in time.
Philosophy: rhythm made visible with the discipline of the International Typographic Style. Unique: the only style where **structure** is the subject, and the most beat-literate style.

**B. Research.** Müller-Brockmann's *musica viva* (B.14), Fischinger (B.9), McLaren (B.10), Experimental Jetset's responsive line (B.15), Prince's early lyric video (B.13), Riley's patterns kept low-contrast (B.18), Lieberman's rule-based sketches (B.44). In-app ancestors: Type as Rhythm, Graphic, Controlled Disorder.

**C. Typography.** One grotesk family in two or three weights (bundled Archivo, Space Grotesk, Inter, or an OFL grotesk chosen in Phase 2), flush left on a modular grid; a line can be set as one block, as a stacked column (one word per row), or rotated 90 degrees along a grid edge.
Emphasis by weight and scale, never by effect. Numbers (time, bpm, line index) can be set as typographic elements. Multilingual: grids accommodate any script; complex scripts get no letter spacing (existing rule).

**D. Composition.** A 6-, 8- or 12-column grid with visible or implied modules; shapes align to the grid; one dominant form per section (a circle, a stack of bars, a diagonal). Negative space is structural (half the poster empty is common). Overprint (riso-like multiply) for colour depth.

**E. Motion.** Snap and settle: forms move on the grid in quantised steps with crisp ease-out; bars extend, circles scale in sequence, a line sweeps. No floating, no glow. Transitions: the grid itself reflows to a new layout.

**F. Musical relationship.** With a beat grid: forms step on beats and bars, a hit on downbeats. Without: forms step on line starts and word starts (authored), or every N hundred milliseconds of the line's own pace (estimated: evenly spaced, no accent claims). Hooks: the chorus fills the grid (more modules active).
Breaks: forms continue a slow pattern (a metronome-like rotation). Tempo source label stays honest. Across a song: intro draws the grid; verses one shape family; chorus a denser family; bridge rotates the grid or switches to negative (dark) print; outro removes modules one by one.

**G. Diversity.** Shape families (circles, bars, arcs, diagonals, dots, rings, squares, waves), grid systems, colour systems (two-colour overprint, three-colour, black and one), type arrangements (block, column, rotated, scattered on grid), paper vs dark. Combinatorics are genuinely compositional, because layout changes the picture.

**H. Assets.** Mostly procedural: shape choreographies (handcrafted motion patterns), grid systems, layout templates, colour systems, paper and print textures. Estimate in Section E.

**I. Technical.** Shapes and type quads; very low cost; deterministic by construction. Canvas 2D fallback easy. Readability excellent.

**J. Risks.** Coldness; looking like a corporate motion template; beat dependence (must look complete without a grid); op-art patterns triggering flicker (keep contrast and frequency low).

**K. Why.** The collection's typographic backbone and its best musical responder. It gives hip-hop, electronic and rock a rigorous, non-gimmicky identity.

---

## C.5 Celluloid

**A. Identity.** The craft of the film title sequence applied to a whole song. Words are etched, backlit, printed on film, scratched and projected; the frame weaves in the gate; splices, flash frames, leader and light leaks punctuate sections.
Philosophy: cinema as material. Unique: the only style whose texture is time-based media itself (frames, gates, stocks).

**B. Research.** Se7en's scratchboard and optical-printer distress (B.3), Stranger Things' backlit drift (B.4), Enter the Void tamed (B.5), Wong Kar-wai's step printing (B.7), Lye and Shynola's scratch film (B.8). In-app ancestors: Analog Cinema, Film, Retro VHS.

**C. Typography.** Registers: backlit hollow serif (slow assembly), scratched handwriting on black (jitter), clean subtitle sans in a letterbox (cinema subtitle), typewriter title cards, and a burst register (one face per word, chorus only, no strobe). Readability: the subtitle register guarantees it; others hold each word long enough.

**D. Composition.** Letterboxed 2.39:1 frame inside the stage (or full frame), a single word or short line centred or lower third; layers: film base, grain, dust, scratches, gate weave, light leak, then type. Variants by stock: 35 mm colour negative, black-and-white reversal, Super 8, tape (VHS), Kodalith high-contrast.

**E. Motion.** Gate weave and flicker at a believable 24 fps feel (render at full rate, quantise selected layers to 24/12 fps), step-printed smears on motion, staccato cuts with flash frames at sections (flash-limited), slow optical dissolves in ballads, burn-through to white at the end of a reel.

**F. Musical relationship.** Line timing drives title cards; authored word timing drives per-word scratch-ins; estimated: whole-line cards. Hooks: a different stock or a burst of the title register. Breaks: leader, countdown (original design, no studio marks), projector light. Beat: cut rate quantised to beats when present.
Mood: dark/tense songs get scratchboard; warm/nostalgic get Super 8; dreamy get backlit optical; energetic get the burst. Across a song: intro = leader and a countdown; verses one stock; chorus a stock change or burst; bridge = negative or a burn; outro = reel runs out, white light.

**G. Diversity.** Stock (5+), title register (5), damage profile, colour grading (cover-derived), frame aspect, type faces (from bundled faces and OFL). Distinct songs feel like different films.

**H. Assets.** Scanned-look textures (grain plates, dust, scratches, hair, leader, burns, light leaks: produced originally, procedurally or photographed by the owner), title-card layouts, countdown designs, gate/projector behaviours, colour grades. Estimate in Section E.

**I. Technical.** Mostly post-processing (grain, weave, flicker exist in `POST_FS`), texture sprites, deterministic noise. Low to moderate cost. Multilingual: subtitle register works for all scripts; scratched handwriting needs script-specific stroke reveal or a fallback.

**J. Risks.** Becoming "a grain filter"; nostalgia cliché; Se7en and Stranger Things look-alikes if colours and faces are copied; flash frames and flicker (photosensitivity).

**K. Why.** The cinematic register for any genre, with a real craft lineage and a big texture ecosystem; it replaces three weak looks with one deep one.

---

## C.6 Folio

**A. Identity.** The lyric set as a living page: a literary magazine, a newspaper, an art book, a programme. Pull quotes, drop caps, columns, footnotes, captions and image plates; the page re-lays itself as the song moves.
Philosophy: the dignity of the printed word. Unique: the only style built on editorial hierarchy and reading conventions.

**B. Research.** The repo's Broadsheet, Art Book, Ether (observed, gallery); Carson's Ray Gun for the loud issue (B.16). Additional editorial references for Phase 2 to gather: literary quarterlies, Swiss and Dutch book design.

**C. Typography.** Serif text and display pairings (Cormorant, Instrument Serif, Playfair, DM Serif are bundled), a grotesk for captions. The sung line is a pull quote; held words can become a drop cap; ad-libs become footnotes or marginalia; the second line (translation/romanisation) becomes a parallel column, which is a natural home for it.
Multilingual: the best of all 15 (book typography conventions exist for most scripts; RTL pages mirror).

**D. Composition.** Spreads with gutters, columns and a baseline grid; plates (the cover, cover crops, or procedural images) in frames; folios and running heads (song title, page numbers as time). Issues: Quarterly (quiet, cream), Newspaper (dense, newsprint), Programme (theatre bill), Loud issue (Carson-like collisions, lyric kept clean).

**E. Motion.** Editorial motion: text flows into columns, a pull quote slides into place, rules draw, plates crop and recrop, page turns at sections. Restraint is the rule; the loud issue allows overlap and rotation, never on the lyric itself.

**F. Musical relationship.** Lines become pull quotes on time; authored word timing lights words as ink darkening (no per-word claims when estimated). Hooks: the chorus becomes the headline (largest size, repeated as a running head). Breaks: the page turns, a plate fills the spread, a caption appears. Beat: a light rule tick when a grid exists.
Perspective "narrative" favours newspaper and book registers; "addressed" favours letters (an epistolary page); story-led rap gets the newspaper. Across a song: intro = cover/masthead; verses = article pages; chorus = headline spread; bridge = a different section of the publication (letters page, index); outro = colophon.

**G. Diversity.** Publication types, grids, type pairings, paper stocks, plate treatments, ink colours, and the second-line column. Within a song: pages change layout every section.

**H. Assets.** Layout templates (handcrafted grids), type pairings, paper textures, rules and ornaments, plate frames, masthead systems (original names generated per song), procedural illustrations for plates. Estimate in Section E.

**I. Technical.** Canvas-friendly (text layout is CPU work; cache per line), quads on GPU. Cost low. Readability excellent.

**J. Risks.** Too static; reading-heavy pages competing with the lyric (secondary text must be dim and non-lyric: fabricated lorem-like copy would be clutter, so secondary text should be the song's own metadata, the second line, or nothing).

**K. Why.** Lyricscape needs one style that treats words as literature. Folio is the most readable style in the collection and the natural home for translations.

---

## C.7 Nocturne

**A. Identity.** One light in the dark. A single source (a lamp, a streetlight through rain on glass, a candle, a window, a phone screen) and a few words. Everything else is shadow and grain.
Philosophy: intimacy and silence. Unique: the minimal, typography-led style; the default for quiet songs and the reading mode of the collection.

**B. Research.** The repo's Velvet, Nocturne, Stillness (observed); Wong Kar-wai's night colour and step printing (B.7); the "light pools" idea in V3. Rain-on-glass and city bokeh scenes (design idea, no external reference gathered).

**C. Typography.** Light serif and thin sans pairings, sentence case, generous leading; one or two lines at most; layouts: centred, left-aligned low, or the rolling column (from Lyrics app) for word-by-word songs. Emphasis by light (a word catches the lamp) rather than weight.

**D. Composition.** 70-90% negative space. The light source is placed opposite the text (the text sits where the light falls). Scene families: lamp room, window rain, night street bokeh, candle, dawn window, screen glow, moonlight on water.

**E. Motion.** Slow: fades, focus pulls, light breathing, drifting dust, rain running down glass. Words arrive as focus resolves. Nothing cuts except at true section changes, and then as a slow dissolve.

**F. Musical relationship.** Calm directions' rule stays: no bursts, no shakes. Line timing drives focus; word timing (authored) lights words; estimated: whole-line focus. Hooks: the light grows slightly. Breaks: only the light and the weather move. Beat: ignored except a faint breathing at very low gain.
Across a song: intro = darkness, the light turns on; verses = one room; chorus = the light warms and widens; bridge = the light moves (a car passing, a cloud); outro = the light dims.

**G. Diversity.** Scene family, light colour (from cover temperature), weather, time of night, type pairing, layout. Fewer meaningful assets than others, by design.

**H. Assets.** Light sources (procedural), weather layers (rain on glass, fog, dust, snow), bokeh plates, room silhouettes, grain profiles. Estimate in Section E.

**I. Technical.** Cheap shaders; Canvas fallback already exists (the current directions). Readability: the best guarantee (contrast is easy).

**J. Risks.** Monotony (the brief's "hundreds of uses" test is hardest here); becoming a moody stock video.

**K. Why.** A collection needs silence. Nocturne is where ballads, ambient songs and anyone who just wants to read the lyrics will live, and it absorbs eight weaker looks into one disciplined one.

---

## C.8 Liquid Light Show

**A. Identity.** A 1967 light show rebuilt: coloured oil and water pushed by hand in glass dishes on projectors, bubbles splitting, a colour wheel turning, dyes blooming. The lyric is projected as a slide onto the moving colour.
Philosophy: hand-performed psychedelia, not a gradient. Unique: physical fluid behaviour and performed motion.

**B. Research.** Joshua Light Show and liquid light shows (B.28), Seveso's ink in water (B.26), flow fields and reaction-diffusion as baked textures (B.42, B.43). Replaces Liquid light, Psychedelic, Aurora, Acid's colour field.

**C. Typography.** A projected slide: type in a hard-edged slide mask (black slide with clear letters), so the colour shows *through* the letters, or a dark slide band with light type. Faces: condensed display and rounded psychedelic-era display (OFL), or plain grotesk for contrast. Readability: the slide mask isolates the type from the fluid.

**D. Composition.** Two or three overlapping projections (dish layers) with additive colour; a circular dish edge sometimes visible; the slide sits on top. Families: oil dish, water and dye, bubbles, colour wheel, wet-on-wet bloom, dripping, oil on glass at the edge.

**E. Motion.** The "hand": dishes rock, swirl, get squeezed; bubbles split and merge; dye blooms from a point when a word lands. Transitions: a dish is pulled away, a colour wheel turns, a fresh drop.

**F. Musical relationship.** Line start: a new drop of dye or a slide change. Words (authored): small blooms. Hooks: two projectors at once, colour wheel spinning faster. Breaks: pure fluid. Beat: dish pulses (the classic "squeeze on the beat"), subject to the flash rule.
Mood drives palette and viscosity (slow honey for calm, splashy for energy). Across a song: intro = an empty lit dish; verse = one oil; chorus = layered projections; bridge = colour wheel or a dark dish; outro = the projector lamp fades.

**G. Diversity.** Fluid families (6-8), palettes (from cover and mood), viscosity, dish shapes, slide designs, layering. Fluid simulation-like looks from precomputed flow fields and noise, deterministic in time.

**H. Assets.** Flow-field presets, dye palettes, bubble/oil shaders, dish masks, slide typography templates, colour wheels. Estimate in Section E.

**I. Technical.** Full-screen shaders at reduced resolution (as today's backdrops), deterministic (no stateful simulation; use time-parameterised noise and baked flow textures). Moderate cost. Readability depends on the slide; must keep 4.5:1 in the slide.

**J. Risks.** Generic "trippy shader" (the exact failure of today's liquid); muddy colour when projections add; flashing; similarity with Ink's water register (Ink is monochrome brush; this is coloured light).

**K. Why.** The colour-and-energy style of the collection, with a real medium behind it instead of a gradient.

---

## C.9 Sketch Cards

**A. Identity.** One hand-made card per line, dropped like cue cards. Words are laid out as a mini poster (one huge, one boxed, the rest in thin hand lettering), with a doodle, in a paint-program dither. Cards come from a stack; lines cut hard.
Philosophy: DIY charm with real typographic hierarchy. Unique: per-line poster composition, the only "cut" style.

**B. Research.** Existing Sketch cards (observed: strongest typographic layouts in the app); Pennebaker's cue cards (B.20); riso and spot-ink print processes (B.21); Notebook's paper; Acid's creature cast.

**C. Typography.** Big/mid/thin roles per card (exists), hand-lettered faces (Permanent Marker, Bangers, Special Elite...), per-letter rotation. Complex scripts: no per-letter rotation (whole word), on the branch Tamil/Hindi no longer break (observed in commit message, not re-verified).

**D. Composition.** Today always one 4:3 card on black. Redesign: the card on varied grounds (a desk, a floor, a wall, a hand holding it), multiple cards stacking as the song progresses, cards of different shapes (index card, napkin, sticky note, poster, receipt). Print processes: paint-program dither, riso two-colour, photocopy, marker on cardboard.

**E. Motion.** Hard cut or a card drop (the next card falls on top; the old one slides off); words scribble in on cue; the hand holding a card sways slightly; at the chorus, cards flip faster.

**F. Musical relationship.** One card per line (existing); authored words scribble in on cue; estimated words appear left to right across the line. Hooks: the same card returns (with wear), or a bigger poster. Breaks: drawings animate (the creatures dance, Acid's loop absorbed, tied to the line rate or beat). Across a song: cards pile up; the pile becomes the outro image.

**G. Diversity.** Card types, print processes, ground surfaces, font sets, doodle library, colour sets from the cover (exists). Already high; redesign adds spatial variety.

**H. Assets.** Doodles and drawings (art library: 346 exists), card shapes, borders (12 exist), print-process filters, hand-lettering sets, ground photographs-free surfaces (procedural desk, wall, floor). Estimate in Section E.

**I. Technical.** CPU card paint at line start (cost not measured, V9 in visuals.md); move to warm-up. Low GPU cost. Readability good.

**J. Risks.** Cuteness ceiling for dark songs (needs a darker drawing register), repetition of the same card frame, overlap with Panels (cards are single posters; Panels are sequences).

**K. Why.** The most personable style and the strongest existing composition engine; it carries the handmade, playful slot.

---

## C.10 Signage

**A. Identity.** The lyric on public display hardware. A split-flap board flips through letters; a theatre marquee chases bulbs; a neon sign buzzes on letter by letter; a flip-dot bus sign clicks; an LED ticker scrolls; a pharmacy cross or motel sign glows (all invented signs).
Philosophy: lyrics as public announcements, mechanical suspense. Unique: mechanical, character-level motion with physical sound implied.

**B. Research.** Split-flap (B.33), Jim Campbell's LEDs (B.34), Neon noir's tubes (B.32). Phase 2 should gather sign-painting and marquee references.

**C. Typography.** The hardware's own type: flap characters (condensed sans in tiles), bulb letters (dot letters), neon script and block tubes, 5x7 and 7x9 dot-matrix pixel fonts, LED segment. Non-Latin: flaps can hold any glyph (a flap per character cell); dot-matrix needs bitmap fonts per script (Latin, Cyrillic, Greek, Arabic, Hebrew, CJK at 16x16 exist under open licences; Indic dot fonts are rare: fall back to neon or LED sign).

**D. Composition.** One sign in a setting (a station hall, a roadside at night, a theatre front, a diner window, a stadium) or a wall of signs. Camera at street level; reflections on wet ground.

**E. Motion.** Flaps cycle and land; bulbs chase and blink; neon flickers on; dot-matrix columns refresh; LED tickers scroll. Each hardware has a specific rhythm.

**F. Musical relationship.** Line start triggers the board update; each word lands on its cue (flaps settle exactly on the authored time; estimated: settle sequentially across the line). Hooks: marquee or neon register, all bulbs on. Breaks: the board shows the song's metadata (as a departure: title, artist, "next: line 12" style), signs idle-flicker. Beat: bulb chases on beats when present.
Across a song: intro = signs off, turning on; verses = one board; chorus = a brighter sign; bridge = a different street; outro = signs switch off one by one.

**G. Diversity.** Hardware (8 families), settings, colour of light (neon colours, LED amber/green/white), weather, signage design (each sign an original design). High.

**H. Assets.** Hardware renderers (procedural), sign designs (handcrafted), settings (painted or procedural backdrops), pixel fonts (open-licence), reflections and weather layers. Estimate in Section E.

**I. Technical.** Character-cell sprites, shaders for glow and bulbs; deterministic; moderate cost. Readability high (signs are made to be read).

**J. Risks.** Novelty after a few songs; long lines on a board (wrap rules); neon overlapping Phosphor's glowing line (different: neon is static tubes in an environment).

**K. Why.** Gives the collection mechanical motion and a public, urban register. Characters landing on time is a satisfying, honest use of word timing.

---

## C.11 Ink

**A. Identity.** Brush and ink. Words are written with a wet brush stroke; ink pools, bleeds into paper fibres, blooms in water. Landscapes and objects are suggested in a few strokes.
Philosophy: gesture, breath and emptiness. Unique: the stroke (start, speed, pressure, end) as the unit of motion.

**B. Research.** Ink-wash painting (B.25), ink in water (B.26), flow fields for brush paths (B.42).

**C. Typography.** Brush calligraphy as a rendering of any font: glyph masks revealed along their stroke direction with a brush-texture edge (speculative; Phase 2 must prototype). Scripts with real brush traditions (Han, Kana, Hangul, Arabic, Devanagari) may get native brush faces (OFL) where available. Display: one or two words large, the rest small in a quiet column.

**D. Composition.** Paper (rice, cotton, kraft, wet paper), a single painted element (a mountain, a branch, a wave, a figure, a moon), the text placed in the empty part; a red seal-like stamp is avoided as a cliché unless designed originally; in water register, black ink clouds bloom behind clean type.

**E. Motion.** A stroke draws with acceleration and a trailing dry-brush end; ink spreads after landing; washes fade; water register billows slowly. Transitions: paper is wetted and the old ink dissolves; a new sheet slides.

**F. Musical relationship.** Authored words: one stroke per word with stroke speed matching word duration. Estimated: the whole line brushed at a steady pace. Hooks: a heavier brush, a bigger element. Breaks: the painting grows (a branch extends). Beat: dry-brush flicks at downbeats in energetic songs.
Across a song: intro = blank paper and water; verses = text and one element; chorus = bold strokes; bridge = water register; outro = the paper is full and dries.

**G. Diversity.** Subjects (landscape, botany, weather, figures, abstract strokes), paper, ink colour (black, sepia, indigo, cover tint), brush types, register (paper vs water). High.

**H. Assets.** Brush stroke library (handcrafted strokes, digitised), paper textures, painted elements (handcrafted), ink bloom textures (procedural), stroke-reveal data per font. Estimate in Section E.

**I. Technical.** Stroke reveal masks (precomputed distance-along-stroke textures per glyph), paper shader, bloom textures. Moderate-high complexity; low runtime cost. Multilingual: reveal-along-stroke needs per-script data or a generic left-to-right fallback.

**J. Risks.** Cultural costume; brush on Latin type can look kitsch; doing calligraphy badly is worse than not doing it.

**K. Why.** The only style built on gesture; it is emotional, quiet and fast at once, and very different from every screen- or print-based style.

---

## C.12 Panels

**A. Identity.** The song as sequential art. Each line is a panel: caption boxes, speech and thought balloons, sound-effect lettering, speed lines, halftone and screentone. The page builds panel by panel.
Philosophy: comics' grammar of time. Unique: the only style with a page of sequential frames, and sound-effect typography.

**B. Research.** Ben-Day and screentone (B.22), Pop art absorbed. Phase 2 must gather lettering and panel-layout references from public-domain comics and original drawing.

**C. Typography.** Comic lettering faces (OFL), balloons for addressed lines ("you"), captions for narrative lines, thought balloons for inward lines (identity perspective decides), SFX for short loud words (on hooks). Multilingual: vertical balloons for Japanese (speculative), RTL page order for Arabic/Hebrew.

**D. Composition.** A page grid of 2-6 panels; the current panel is lit and in focus, earlier panels remain; panels contain objects, places, symbols (no recurring characters needed), close-ups of hands, eyes, phones, rain, cars.

**E. Motion.** Camera moves panel to panel; inside a panel, limited animation (speed lines, a blink, falling rain); panel borders draw; a splash page at the chorus; page turn at sections.

**F. Musical relationship.** Line = panel; words fill balloons on cue (authored) or as a whole (estimated). Hooks: splash page, SFX lettering. Breaks: wordless panels (establishing shots). Beat: speed lines and panel shakes on hits.
Across a song: intro = cover page; verses = 4-6 panel pages; chorus = splash; bridge = a different art register (screentone night, flat colour day); outro = the last panel and a white gutter.

**G. Diversity.** Panel layouts, art registers (halftone pop, screentone manga, ink noir, flat colour), subjects, balloon styles, colour. Very high.

**H. Assets.** Panel layouts, panel illustrations (the expensive family), balloons and captions, SFX lettering sets, tone patterns, speed-line generators. Estimate in Section E.

**I. Technical.** Sprites and masks; halftone and tone shaders exist (halftone in POST). Low runtime cost; illustration is the work. Readability high (balloons are made for reading).

**J. Risks.** Without characters it can feel empty; with characters it is expensive and risky (likeness); halftone overlapping Sketch Cards' print look.

**K. Why.** Sequential art is the natural format for line-by-line lyrics, with an enormous asset space and a clear difference from single-image styles.

---

## C.13 Phosphor

**A. Identity.** A single beam of light writes the words, then becomes the world: the line of a word unwinds into a spinning figure, a horizon, a heart, a wave, and back into the next word. Cold oscilloscope green or a warm hand-drawn light trail.
Philosophy: continuity; everything is one line. Unique: the only style made of a single continuous stroke.

**B. Research.** Oscilloscope music (B.11), Picasso's light drawings (B.12), vector projection (B.29), scratch-film line energy (B.8).

**C. Typography.** Single-line (stroke) lettering: Hershey-like single-stroke fonts for Latin, Greek, Cyrillic (open licences exist; Phase 2 to verify); other scripts traced from glyph outlines (outline glow). The word is drawn by the beam in writing order.

**D. Composition.** Black field, one figure at a time, persistence trails fading; optional graticule (oscilloscope grid) or a dark room with a light-painter's ghost.

**E. Motion.** Continuous: the beam never jumps (or jumps visibly, with a faint line, like a real scope); figures morph by interpolating paths; persistence blooms on fast motion.

**F. Musical relationship.** Line start: the beam begins writing; the beam's speed fits the line's duration (or word cues when authored). Hooks: Lissajous figures and symmetry (procedural, beat-locked when a grid exists). Breaks: the beam draws abstract figures from the song's subjects.
Across a song: intro = a dot; verses = words and simple figures; chorus = complex figures; bridge = colour change (green to amber to white); outro = the dot fades.

**G. Diversity.** Figure library (from subjects), line colour, persistence, register (scope vs light painting), symmetry rules. Moderate (it is a narrow medium by design).

**H. Assets.** Path library (handcrafted line drawings and procedural curves), stroke fonts, morph pairings, scope furniture. Estimate in Section E.

**I. Technical.** Line rendering (thick lines with glow) on the GPU, path morphing on the CPU; very cheap. Multilingual: outline tracing fallback.

**J. Risks.** Narrowness (it can run out of surprise sooner than others); similarity to neon in Signage; readability of thin lines on phones.

**K. Why.** The collection's most minimal electronic voice: pure light and line, very different from the mass and texture of all other styles.

---

## C.14 Cover Pop

**A. Identity.** The album cover is the stage. Full-bleed, undimmed art; the lyric arrives in short phrases in a hot colour taken from the cover, with a chip on the heaviest word and stickers that belong to the cover's world.
Philosophy: the song's own image, celebrated. Unique: the only style that puts the song's own artwork first.

**B. Research.** Existing Cover Pop (observed; built from a reference recording of a music app's full-screen lyrics, but now its own system: colour chosen by what is behind each word).

**C. Typography.** Rounded heavy italic (Nunito Black) today; Phase 2 should add two or three alternative voices (a condensed grotesk, a serif display) chosen by genre. Colour per word from what is behind it (exists).

**D. Composition.** The cover fills the frame; phrases placed in the cover's emptiest regions (saliency from the 48x48 sample; speculative extension); the cover can be cropped and panned across (a "Ken Burns" over the artwork) to create different compositions within a song.

**E. Motion.** Phrase hand-offs (exists), pops and settles, a slow pan across the cover; chorus bursts (from Maximalist's burst) for energetic songs.

**F. Musical relationship.** Phrases split only with word timing (exists, honest). Hooks: a different crop and the burst. Breaks: the cover breathes, pans, a sticker drifts. Across a song: intro = full cover; verses = crops; chorus = the full cover again with burst; outro = the cover recedes.

**G. Diversity.** Comes mostly from the cover itself (every song differs), plus crops, type voices and sticker sets.

**H. Assets.** Type voices, sticker sets (icons exist: 480), crop/pan paths, burst shapes. Estimate in Section E.

**I. Technical.** Exists in Canvas; GPU port easy. Readability via per-word colour choice (exists, tested). Rights: Spotify's "unmodified artwork" policy is honoured by the renderer (V3 note); full-bleed undimmed use fits it.

**J. Risks.** Depends on covers (a plain text cover gives little); stickers cluttering; similarity to the music app it came from.

**K. Why.** Every song already has one great image. A collection that never shows it fully would be missing the most personal asset of all. It ranks last on originality but earns its place on song-specificity.

---

## C.15 Monument

**A. Identity.** Words become architecture. A line is extruded into a wall, a stair, a bridge, a tunnel of letters; the camera walks through the song; light sweeps across the forms like projection on buildings.
Philosophy: monumental space and scale. Unique: the only true 3D style.

**B. Research.** Universal Everything's typographic architecture and Peter Cho's research (B.45), Lemercier's projected light on geometry (B.29).

**C. Typography.** Heavy grotesk or slab, extruded; the sung word is the façade facing the camera, readable flat-on; later words recede. Materials: concrete, glass, paper, light.

**D. Composition.** Deep perspective, horizon, fog for depth; buildings of past lines behind; the current line in front. Families: canyon of walls, spiral stair, bridge, plaza, tunnel, skyline.

**E. Motion.** A steady dolly (walking pace in verses, faster in chorus); light sweeps; words rise from the ground on their cue; at sections, the camera turns a corner.

**F. Musical relationship.** Line start: a new façade rises; authored words rise one by one; estimated: the whole façade. Hooks: a monumental version (bigger, lit). Breaks: the camera travels through the built city of the song so far. Beat: light sweeps on bars.
Across a song: intro = an empty plane; the song builds a city line by line; outro = an aerial view of everything the song built (a unique image per song).

**G. Diversity.** Architectural families, materials, lighting (day, night, projection), camera paths, fog colour from the cover. The per-song city is unique by construction.

**H. Assets.** Extrusion system, materials (procedural), architectural templates, lighting rigs, camera paths. Estimate in Section E.

**I. Technical.** The hardest of all: needs a 3D path the current host does not have (extruded glyph meshes, or an SDF/raymarch of text textures, or layered sprite stacks that fake extrusion). Performance must be proven on integrated GPUs. Complex scripts: extrusion of OS fonts needs outlines (not available from Canvas); a sprite-stack fake works for any script.

**J. Risks.** Generic "3D text flythrough"; readability while moving; cost.

**K. Why.** Depth and scale no other style offers, and the song-as-city ending is an image only Lyricscape could make. It is the riskiest pick and the one most worth a prototype before full production.

---

# Section D: Consolidation and replacement map

From 35 named looks (13 classic, 11 directions, 6 Turbo) to 15 styles. Interpretation, based on the audit in Section A.

| Existing | Action | Goes to | What survives |
|---|---|---|---|
| Code screens | KEEP → REDESIGN | **Screenlife** | Camera grammar, typing, sheet textures, app screens (widened beyond developer screens) |
| Sketch cards | KEEP (refine) | **Sketch Cards** | Everything; gains spatial variety and card types |
| ASCII eye | REDESIGN | **Glyph Cinema** | Character pass, 18 subjects, subject picker; room furniture dropped |
| Liquid light | REDESIGN | **Liquid Light Show** | The intensity idea becomes a quality tier for all styles; the look is replaced |
| Acid grain | MERGE | Sketch Cards (creatures, print grain), Liquid Light Show (hue-rolling field) | Creature cast and choreography; coarse colour grain |
| Lyrics app | REMOVE | Nocturne (rolling column layout), Cover Pop (stickers ground) | The rolling column |
| Cover Pop | KEEP → REDESIGN | **Cover Pop** | All; gains crops, pans, type voices, chorus burst |
| Type as Rhythm | MERGE | **Konstrukt** | Anton/grotesk contrast, split panel geometry |
| Graphic | MERGE | Konstrukt | Flat colour fields |
| Controlled Disorder | MERGE | Konstrukt (slices), Folio (loud issue) | Disruption as a register |
| Broadsheet | MERGE | **Folio** | Newsprint register |
| Art Book | MERGE | Folio | Book register, paper |
| Ether | MERGE | Folio | Left-aligned art page, collage plate |
| Velvet | MERGE | **Nocturne** | Warm lamp palette |
| Nocturne (direction) | MERGE | Nocturne | Core of the style |
| Stillness | MERGE | Nocturne | Restraint, one halo |
| Analog Cinema | MERGE | **Celluloid** | Warm mono stock, keylines |
| Classic: Film | MERGE | Celluloid | Grain, serif titles |
| Classic: Retro VHS | MERGE | Celluloid | Tape as a stock |
| Classic: Monochrome editorial | MERGE | Folio | Serif/grotesk contrast |
| Classic: Minimal | MERGE | Nocturne | Restraint |
| Classic: Notebook | MERGE | Sketch Cards | Ruled paper, highlighter swipe |
| Classic: Pop art | MERGE | **Panels** | Halftone, outlines, hard shadows |
| Classic: Neon noir | MERGE | **Signage** | Neon tubes |
| Classic: Gloss | MERGE | Cover Pop | Cover gradients |
| Classic: Aurora | MERGE | Liquid Light Show | Slow colour (calm end) |
| Classic: Psychedelic | MERGE | Liquid Light Show | Hue cycling, echo |
| Classic: Maximalist | REMOVE | (Cover Pop chorus burst) | The hook burst only |
| Classic: Y2K | REMOVE | | nothing |
| Classic: Vaporwave | REMOVE | | nothing (today Auto picks it when tags say synthwave or vaporwave; recommend those songs go to Liquid Light Show or Signage) |
| Classic: Custom | not a style | Studio customisation | |
| — | NEW | **Paper Theatre** | |
| — | NEW | **Ink** | |
| — | NEW | **Phosphor** | |
| — | NEW | **Monument** | |

Result: 1 kept as is (Sketch Cards), 2 kept and redesigned (Screenlife, Cover Pop), 2 redesigned from the ground up (Glyph Cinema, Liquid Light Show), 4 consolidations (Konstrukt, Folio, Nocturne, Celluloid) and 6 new (Paper Theatre, Signage, Ink, Panels, Phosphor, Monument; Signage and Panels also absorb old looks). 1 + 2 + 2 + 4 + 6 = 15.
Removing styles is a Phase 3 action; nothing was removed in this phase.

**User-facing consequence to decide in Phase 2:** people who pinned a removed look (per-song picks are stored) need a migration: each old id maps to its new home in the table above.

---

# Section E: Preliminary asset ecosystem research

All numbers are **estimates of meaningful originals**, not approved production counts. "Originals" = designed assets a person (or a carefully authored generator) makes on purpose.
"Compositions" = visibly different scenes a viewer would describe differently, after removing mere recolours. Generated variations, animation frames and recolours are not counted.

## E.1 Per style

**Screenlife**
- Families: fictional app kits (14-18 apps x 4-6 states), device frames (phone, laptop, tablet, old CRT terminal, car display, watch...), wallpapers and lock screens, notification and sticker sets, caret and typing-behaviour profiles (confident, hesitant, drunk, angry, autocorrecting), camera-move library, transition cuts.
- Biggest change to a scene: the app family and the device. Combinations: app x device x theme x camera give hundreds of real compositions, because each app has its own layout.
- Handcrafted: app kits, device frames, typing profiles. Procedural: message contents around the lyric (from song metadata only, never invented chat text that reads as real), wallpapers from cover.
- Consistency rules: one invented OS design language per "device world"; the lyric field is always the focal point; no real brands.
- Distinct scenes differ by: what kind of writing it is (confession, search, note, post), not by colour.
- Estimate: **250-350 originals; 300+ compositions.** Hundreds of uses: yes.

**Glyph Cinema**
- Families: subjects (shader pictures or baked brightness maps; 18 exist, target 50-70), registers (ASCII, teletext mosaic, typewriter overstrike, 1-bit), glyph ramps by script and mood, teletext page templates, transition patterns (rain, decay, page update, scan).
- Biggest change: subject and register. Combinations: subject x register x palette.
- Handcrafted: subjects (each is a small artwork), page templates. Procedural: glyph assignment, calligram routing.
- Consistency: the grid is sacred (no off-grid motion); one glyph ramp per scene.
- Estimate: **150-200 originals; ~250 compositions.** Hundreds of uses: yes, subjects carry it.

**Paper Theatre**
- Families: silhouette pieces grouped into sets (city, sea, forest, desert, mountains, rooms, sky, fairground, garden, harbour, train, snow...), hinged figures (people, animals, vehicles: kept anonymous), frames (proscenium, window, book spread, lantern, curtain), paper textures, light gradients, transition rigs (curtain, page, fall, slide).
- Biggest change: set and frame. Combinations: sets x frames x light colour x time of day; pieces recombine into new sets.
- Handcrafted: every silhouette piece (vector). Procedural: arrangement within a set from a seed, light.
- Consistency: one cut quality (edge style, detail level), always backlit.
- Estimate: **500-700 originals; 400+ compositions.** Hundreds of uses: yes.

**Konstrukt**
- Families: shape choreographies (motion patterns for circles, bars, arcs, diagonals, dots, rings, waves), grid systems, layout templates (block, column, rotated, scatter), colour systems, print textures (overprint, paper).
- Biggest change: shape family and layout template. Combinations are compositional (layout changes the picture).
- Handcrafted: choreographies and layouts. Procedural: everything else.
- Consistency: grid alignment, one type family, flat colour.
- Estimate: **~150 originals; very many compositions (500+), because layouts recombine meaningfully.** Hundreds of uses: yes.

**Celluloid**
- Families: texture plates (grain, dust, scratches, hair, leader, burns, light leaks), stock profiles (35 mm, B&W reversal, Super 8, tape, Kodalith), title registers and layouts, countdown designs (original), projector and gate behaviours, colour grades.
- Biggest change: stock and title register. Combinations: stock x register x grade.
- Handcrafted: title layouts, countdowns, some plates (owner could shoot real textures: dust on glass, light leaks with a phone). Procedural: grain, weave, flicker, many scratches.
- Consistency: a believable film physics; one stock per section.
- Estimate: **~250 originals; ~150 compositions.** Hundreds of uses: yes, if registers stay distinct; textures alone would not suffice.

**Folio**
- Families: layout templates per publication type (quarterly, newspaper, programme, letters page, index, loud issue), type pairings, paper stocks, rules and ornaments, plate frames and crops, masthead system, procedural plate images (abstract, typographic, cover-derived).
- Biggest change: publication type and layout. Combinations: type x layout x pairing x paper.
- Handcrafted: layouts and pairings. Procedural: plates, mastheads.
- Consistency: baseline grid, real typographic rules (widows, rag).
- Estimate: **~220 originals; ~200 compositions.** Hundreds of uses: yes.

**Nocturne**
- Families: scene families (lamp room, window rain, street bokeh, candle, dawn window, screen glow, moonlight water, car interior at night, train window), weather layers, light rigs, bokeh plates, grain profiles, layouts (centred, low-left, column).
- Biggest change: scene family and light. Combinations limited by design.
- Handcrafted: scene silhouettes, light rigs. Procedural: weather, bokeh, grain.
- Estimate: **~120 originals; ~80 compositions.** Hundreds of uses: acceptable because the style's value is restraint; the risk is noted.

**Liquid Light Show**
- Families: fluid families (oil blobs, water and dye, bubbles, wet-on-wet bloom, drips, oil on glass edge, marbling, colour wheel), presets per family, dish masks, slide templates, palettes.
- Biggest change: fluid family and slide design.
- Handcrafted: presets (each tuned like an instrument), slides. Procedural: palettes, flow.
- Estimate: **~140 originals; ~100 compositions.** Hundreds of uses: yes if presets are tuned with care; colour alone would fail.

**Sketch Cards**
- Families: drawings (346 exist in 14 families; add a darker register of ~150), card types (index card, napkin, sticky note, poster, receipt, envelope, torn page), borders (12 exist), print processes (paint dither, riso two-colour, photocopy, marker on cardboard), lettering sets (12 exist), grounds (desk, wall, floor, hand), creature choreographies (from Acid).
- Biggest change: card type, ground and print process.
- Estimate: **~550 originals (≈350 exist); 400+ compositions.** Hundreds of uses: yes.

**Signage**
- Families: hardware renderers (split-flap, flip-dot, marquee bulbs, neon tube, LED ticker, dot-matrix bus sign, segment display, lightbox), sign designs (invented businesses and boards), settings (station hall, roadside, theatre front, diner, stadium, rooftop, pharmacy corner), pixel fonts (open licence), weather and reflection layers.
- Biggest change: hardware and setting.
- Handcrafted: sign designs, settings. Procedural: hardware behaviour.
- Estimate: **~180 originals; ~200 compositions.** Hundreds of uses: yes.

**Ink**
- Families: brush strokes (digitised hand strokes: dry, wet, flat, round), painted elements (landscape, botany, weather, figures, objects), papers, ink blooms and water clouds, stroke-reveal data for fonts.
- Biggest change: painted element and register (paper vs water).
- Handcrafted: strokes and elements (by a person with a brush, scanned; or vector brushwork). Procedural: blooms, paper fibre.
- Estimate: **~500 originals; ~300 compositions.** Hundreds of uses: yes.

**Panels**
- Families: page layouts, panel illustrations (places, objects, hands, weather, close-ups, abstract), balloon and caption styles, SFX lettering sets, tone patterns, speed-line generators, art registers.
- Biggest change: panel illustrations and art register.
- Handcrafted: illustrations (the largest single production cost in the whole collection). Procedural: tones, speed lines, layouts.
- Estimate: **~700 originals; 500+ compositions.** Hundreds of uses: yes; cost is the issue.

**Phosphor**
- Families: path drawings (subjects as single lines), procedural curve families (Lissajous, roses, spirals, harmonographs), stroke fonts, morph pairings, scope and room furniture.
- Biggest change: figure and register (scope vs light painting).
- Estimate: **~230 originals; ~120 compositions.** Hundreds of uses: borderline; the narrowest medium, flagged in Section J.

**Cover Pop**
- Families: type voices, sticker sets (480 icons exist), crop and pan paths, burst shapes, phrase layouts.
- Diversity comes from the cover. Estimate: **~60 new originals; compositions bounded by the cover.** Hundreds of uses: yes, because every song brings a new image.

**Monument**
- Families: architectural templates (canyon, stair, bridge, plaza, tunnel, tower, skyline), materials, lighting rigs (day, dusk, night, projection), camera paths.
- The per-song city is unique by construction (the lyrics are the buildings).
- Estimate: **~100 originals; compositions per song unique.** Hundreds of uses: likely, unproven until prototyped.

**Collection total (estimate): about 3,700-4,500 meaningful originals**, of which roughly 400 exist today (art library, icons, doodles, ASCII subjects, app screens, card parts).

## E.2 What keeps a library from becoming repetitive (applies to all styles)

1. **Structure before surface.** Count a new asset only if it changes layout, subject, depth, material or motion. A recolour is a parameter, not an asset.
2. **Scene families with roles.** Every style groups compositions into families tagged by role (intro, verse, chorus, bridge, break, outro) and by song signals (subject, mood, perspective, energy). The song picks families; the seed picks within them.
3. **Accumulation within a section.** Inside a section the scene evolves (the thread grows, the city builds, the stage fills); it does not re-roll every line.
4. **Recall.** The second chorus returns to the first chorus's composition, slightly escalated, so a song has a shape and the viewer recognises its hook.
5. **Per-song memory.** The same song always gets the same plan (determinism rule), and different songs avoid reusing the same family in the same role when the library allows it (seeded by track id).

## E.3 How styles evolve through a song (collection-level)

What the app knows (Section "What the styles can rely on"): line times, word times with a confidence, hooks from repetition, gaps, sometimes a beat grid, identity. What it does not know: audio sections.

Proposed model for every style (interpretation; Phase 2 to specify):

| Song part | How it is detected today | What every style does |
|---|---|---|
| Intro | time before the first line | Build the world from nothing (stage lights up, board switches on, grid draws, paper is blank). Never a black frame (observed bug in Liquid light). |
| Verse | non-hook lines between gaps | One scene family; the scene accumulates line by line. |
| Chorus | runs of hook lines | Switch to the style's chorus family; first chorus defines it, later choruses recall and escalate. |
| Bridge | the first long non-hook run after the second chorus (heuristic, speculative) | A change of register (negative print, different device, scale change). |
| Instrumental / break | gaps ≥ 6 s (`MIN_BREAK_MS`) | The world moves without words; a "breather" family. |
| Quiet moment | low-energy identity or sparse lines | Fewer elements, slower motion, more space. |
| Outro | after the last line | A closing image unique to the song (the pile of cards, the built city, the full page, the lights going off). |
| Transition | section boundaries, snapped to a beat when one exists (existing `snapToBeat`) | Each style owns its transitions (curtain, page turn, flap cascade, whip pan, dissolve). |

This keeps composition changes at a section rate (every 8-26 s, today's director constants) rather than every line, while lines still animate within the scene.

---

# Section F: Visual differentiation matrix

| Style | Medium | Typography philosophy | Spatial composition | Motion character | Colour treatment | Scene structure | Density | Musical responsiveness | Asset variety | Tech complexity |
|---|---|---|---|---|---|---|---|---|---|---|
| Screenlife | fictional UI on devices | the interface's own type; lyric as user input | one screen, camera over it | typing, whip pans, handheld | UI themes + cover accent | apps along the song; a growing thread | medium | line pacing, typing; beat optional | very high | low-medium |
| Glyph Cinema | characters in a grid | lyric letters become the image | full-frame grid | cell changes, no sliding | phosphor, teletext 8, paper | subject develops, decays | high texture | character density on beats | high | medium |
| Paper Theatre | cut paper, backlight | cut and printed letters on light | 4-7 parallax layers | rigid pieces on pivots and rails | one backlight hue per scene | stage sets; accumulating cast | medium | line-triggered entrances | very high | low (art-heavy) |
| Konstrukt | flat geometry, print | grotesk on grid, structural | modular grid, half empty | quantised snap and step | 2-3 flat colours, overprint | layout reflows per section | low-medium | strongest beat use | high (compositional) | low |
| Celluloid | film stock and titles | title-card registers | letterbox, centred/lower third | gate weave, step-print, cuts | grades per stock | reels and stocks | low | cut rate, stock change | high | low-medium |
| Folio | printed page | editorial hierarchy, serif | spreads, columns, plates | reflow, turn, slide | paper and ink | publication sections | medium-high | headline on hooks; gentle | high | low |
| Nocturne | light in darkness | quiet serif/thin sans | 70-90% negative space | slow focus and light | one warm or cool light | rooms and weather | very low | almost none (by design) | moderate | low |
| Liquid Light Show | coloured fluid light | projected slide | overlapping projections | fluid, hand-pushed | saturated additive | dishes and slides | high | squeeze on beats, drops on lines | moderate-high | medium |
| Sketch Cards | hand-made card | per-line poster hierarchy | single object on a ground | hard cuts, card drops | song-hued paper sets | a pile of cards | medium | one card per line | very high | low |
| Signage | display hardware | hardware type (flaps, bulbs, dots) | sign in an environment | mechanical, character-level | light colours of hardware | streets and halls | medium | characters land on cues | high | medium |
| Ink | brush and water | brushed strokes | empty paper, one element | stroke speed, bloom | black/sepia/indigo + tint | a painting that grows | low | stroke per word | high | medium-high |
| Panels | sequential art | lettering in balloons and captions | page of panels | panel to panel, limited animation | halftone/tones/flat | pages, splash on chorus | medium-high | panel per line, SFX on hooks | very high | low (art-heavy) |
| Phosphor | one beam of light | single-stroke lettering | black field, one figure | continuous, morphing | mono phosphor or warm light | figures morphing | very low | beam speed, figures on beats | moderate | low |
| Cover Pop | the cover image | hot phrases, chips | cover full-bleed | phrase hand-offs, pans | from the cover | crops of one image | medium | phrase splits on cues | from covers | low |
| Monument | 3D architecture | extruded façades | deep perspective | walking dolly | materials + light | a city built by the song | medium | façades rise on cues | moderate (unique per song) | high |

## Overlaps an ordinary viewer might notice, and why they are acceptable

- **Sketch Cards vs Panels** (both drawn, both print-like): Cards are *one object at a time* that cuts; Panels are *a page of frames read in sequence*. Keep Cards' drawings cute and personal, Panels' cinematic (places, close-ups). Do not share the art library between them.
- **Signage neon vs Phosphor** (both glowing lines): Signage is hardware in a place, static tubes that switch on; Phosphor is one moving beam on black that never stops drawing. Keep neon out of Phosphor and oscilloscope looks out of Signage.
- **Liquid Light Show vs Ink (water register)**: colour light projected vs black ink suspended in water. Keep Ink's water monochrome.
- **Nocturne vs Celluloid** (both dark and cinematic): Nocturne is still and private (one light, no film artefacts); Celluloid is the film medium itself (gates, stocks, cuts). Nocturne never shows grain heavier than a whisper.
- **Folio vs Konstrukt** (both graphic design): Folio is reading (serif, columns, quotes); Konstrukt is rhythm (grotesk, geometry). Folio barely responds to the beat; Konstrukt is built on it.
- **Glyph Cinema vs Screenlife** (both screens and monospace): Screenlife is a *person's* interface with a story; Glyph Cinema is an *image* made of text with no interface. Glyph Cinema drops the old room furniture for this reason.
- **Paper Theatre vs Sketch Cards** (both paper): depth and narrative sets vs a single flat card. Paper Theatre has no handwriting.

No two styles share medium and motion character at once. That was the test used to merge.

---

# Section G: Ranked quality assessment

Expected overall quality and creative potential, by weighted score (quality / originality / assets / motion / readability / versatility / feasibility), then judgement.

| Rank | Style | Scores | Weighted |
|---|---|---|---|
| 1 | Screenlife | 9/8/10/8/8/8/8 | **8.6** |
| 2 | Konstrukt | 8/8/9/9/8/8/8 | **8.35** |
| 3 | Paper Theatre | 9/8/9/7/8/9/6 | **8.25** |
| 4 | Sketch Cards | 8/8/9/7/8/8/8 | **8.05** |
| 5 | Signage | 8/8/8/8/8/8/7 | 7.95 |
| 6 | Panels | 8/7/9/8/8/8/7 | 7.95 |
| 7 | Ink | 9/8/8/8/7/7/6 | 7.9 |
| 8 | Celluloid | 8/7/8/8/8/9/7 | 7.85 |
| 9 | Glyph Cinema | 8/8/9/7/6/8/7 | 7.8 |
| 10 | Folio | 9/7/8/6/9/8/8 | 7.8 |
| 11 | Liquid Light Show | 8/8/8/8/6/8/7 | 7.75 |
| 12 | Phosphor | 8/9/6/9/6/6/7 | 7.5 |
| 13 | Nocturne | 8/6/7/6/10/9/9 | 7.45 |
| 14 | Monument | 8/8/7/8/6/7/4 | 7.3 |
| 15 | Cover Pop | 7/6/7/7/8/9/9 | 7.2 |

**Signature Lyricscape experiences** (judgement): **Screenlife** (the lyric as an act of writing), **Glyph Cinema** (the picture made of the song's own words; ranked 9th on the formula because of readability, but it is the most *Lyricscape-only* idea), 
**Paper Theatre** (storybook depth), and **Konstrukt** (the music made visible). These four should get the most design attention in Phase 2.

Exceptions to the formula, stated plainly:
- **Nocturne** ranks low on the weights (low asset diversity) but is essential: it is the reading mode and the home for quiet songs.
- **Cover Pop** ranks last but is the only style that shows the song's own artwork; its diversity comes free with every cover.
- **Monument** carries the most technical risk; it is in on depth and uniqueness and should be prototyped first (Section J). If the prototype fails the readability or performance bar, the replacement is **Riso Riot** (Section H).

---

# Section H: Rejected alternatives

| Candidate | Score | Why it did not make it | Absorbed into |
|---|---|---|---|
| **Riso Riot** (Acid redesigned as a print-animation style) | 6.65 | Overlaps Sketch Cards (drawn creatures, grain) and Panels (print); a 16th slot would dilute the paper/print group | Sketch Cards (print processes), Konstrukt (overprint). **First reserve** if Monument fails |
| **Double exposure** (True Detective) | 6.4 | Needs a library of original photographs and figures, the costliest asset type and a rights risk | Paper Theatre (silhouette as a window onto a scene) |
| **Datamatic** (Ikeda) | 5.9 | Strobing black-and-white data at audio rate is a photosensitivity hazard; one artist's signature; low song-to-song variation | Konstrukt (barcodes, data fields), Glyph Cinema |
| **Karaoke laserdisc** | 5.6 | Requires filmed narrative footage; procedural stand-ins are bland | The two-line sweep could be a Folio or Cover Pop option (speculative) |
| **Strobe typography** (Enter the Void) | 5.5 | Built to be felt, not read; fails the flash rule | Celluloid's capped chorus burst |
| **Op art** (Riley) | 5.4 | Moiré and stripes in motion hurt and fight type | Konstrukt (low-contrast pattern family) |
| **Audio-reactive particles** (Magnetosphere) | 5.3 | The generic visualizer look the brief asks to avoid; no relation to words | none |
| **Lyrics app column** (existing) | 5.15 | Imitates a known app; generic gradient | Nocturne (column layout) |
| **Glitch** (Menkman) | 4.8 | Most overused lyric effect | Small cut vocabulary in Screenlife and Celluloid |
| **ML data painting** (Anadol) | 4.6 | Needs trained models; non-deterministic; fashionable cliché | none |
| **Vaporwave / synthwave** (existing) | 3.65 | Cliché | none |
| Rain on glass (as a standalone style) | n/a | One scene, not an ecosystem | Nocturne scene family |
| Reaction-diffusion, flow fields (standalone) | n/a | A generative technique, not a lyric language | Ink and Liquid Light Show textures |
| Light painting (standalone) | 7.0 | Strong but narrow | Phosphor's warm register |

---

# Section I: Visual reference library

Organised by style. *(read)* = fetched and read for this report. All others were found through search and not read in full. No footage was watched.

**Screenlife**: [Screenlife (Wikipedia)](https://en.wikipedia.org/wiki/Screenlife) · [Engadget on Searching](https://www.engadget.com/2018/08/27/searching-john-cho/) · [ScreenAnarchy, Bekmambetov on screenlife](https://screenanarchy.com/2021/05/interview-timur-bekmambetov-talks-profile-and-screenlife-filmmaking-1.html) · in repo: `docs/turbo-styles.md` §1, `lib/kinetic/gl/scenes/terminal.ts`, `screens.ts`.

**Glyph Cinema**: [Rhizome, teletext art](https://rhizome.org/editorial/2013/aug/21/selections-international-teletext-art-festival-201/) *(read)* · [ITAF archive](https://www.teletextart.com/information/itaf-archive-2014-2012/) · [Hyperallergic, teletext](https://hyperallergic.com/the-retro-aesthetics-of-teletext-art) · [V&A, Houédard typestract](https://api.vam.ac.uk/v2/object/O155042) · [Notes from the Cosmic Typewriter](https://occasionalpapers.org/product/notes-from-the-cosmic-typewriter-the-life-and-work-of-dom-sylvester-houedard/) · [Obra Dinn 1-bit, PlayStation Blog](https://blog.playstation.com/archive/2019/10/17/lucas-pope-on-return-of-the-obra-dinns-art-style) · [Game Developer, dither-punk](https://gamedeveloper.com/design/lucas-pope-and-the-rise-of-the-1-bit-dither-punk-aesthetic) · in repo: `docs/turbo-styles.md` §5, `subject.ts`.

**Paper Theatre**: [Art of the Title, Anatomy of a Murder](https://www.artofthetitle.com/title/anatomy-of-a-murder) *(read)* · [Saul Bass titles](https://www.artofthetitle.com/designer/saul-bass/titles) · [BFI, Bass top 10](https://www.bfi.org.uk/news-opinion/news-bfi/lists/saul-bass-10-essential-title-sequences) · [Art of the Title, Catch Me If You Can](https://www.artofthetitle.com/title/catch-me-if-you-can/) *(read)* · [Prince Achmed](https://en.wikipedia.org/wiki/The_Adventures_of_Prince_Achmed) · [Daily Art Magazine, Reiniger](https://www.dailyartmagazine.com/through-scissors-and-shadows-the-art-and-films-of-lotte-reiniger/) · [Gilliam cut-out how-to](https://makezine.com/article/craft/how-to_cut-out_animation_with/) · [Gilliam 1974 demonstration](https://laughingsquid.com/terry-gilliam-explains-monty-python-cutout-animation/).

**Konstrukt**: [Socks Studio, musica viva](https://socks-studio.com/2016/11/30/joseph-muller-brockmann-musica-viva-posters-for-the-zurich-tonhalle/) *(read)* · [V&A, Müller-Brockmann](https://collections.vam.ac.uk/item/O110243) · [PGDA, musica viva](https://peoplesgdarchive.org/item/17122/musica-viva-posters-for-the-zurich-tonhalle) · [An Optical Poem](https://festival.ilcinemaritrovato.it/?p=24707) · [NFB, Synchromy](https://collection.nfb.ca/film/synchromy) · [Designboom, responsive W](https://www.designboom.com/design/new-whitney-museum-identity-by-experimental-jetset/) · [Prince Vault, Sign o' the Times video](https://princevault.com/index.php/Video:_Sign_O'_The_Times) · [The Art Story, Riley](https://www.theartstory.org/artist/riley-bridget/artworks/) · [M+, Lieberman](https://www.mplus.org.hk/en/exhibitions/zachary-lieberman-atlas-of-blobs/).

**Celluloid**: [Art of the Title, Se7en](https://www.artofthetitle.com/title/se7en/) *(read)* · [Art of the Title, Stranger Things](https://www.artofthetitle.com/title/stranger-things) *(read)* · [Art of the Title, Enter the Void](https://www.artofthetitle.com/title/enter-the-void) *(read)* · [Art of the Title, Scott Pilgrim](https://www.artofthetitle.com/title/scott-pilgrim-vs-the-world/) *(read)* · [Step printing](https://melies.co/cinematic-techniques/time-and-motion/step-printing) · [cinematography.net step printing](https://cinematography.net/edited-pages/StepPrinting-ExamplesInformation.htm) · [Len Lye, Harvard Film Archive](https://harvardfilmarchive.org/programs/free-radical-the-films-of-len-lye) · [Imaginary Forces, Stranger Things](https://imaginaryforces.com/project/stranger-things).

**Folio**: in repo `docs/artistic-direction-v3.md`, `docs/assets/v3/gallery-auto.png` · [PGDA, Ray Gun cover](https://peoplesgdarchive.org/item/5365/ray-gun-magazine-cover) · [EBSCO, David Carson](https://ebsco.com/research-starters/communication-and-mass-media/david-carson-graphic-designer). Phase 2 should add editorial references (literary quarterlies, newspaper design).

**Nocturne**: [In Depth Cine, Chungking Express](https://indepthcine.com/videos/chungking-express) · in repo: Velvet/Nocturne/Stillness in `gallery-auto.png`. Phase 2 should gather night photography and lighting references (own or licensed for study only).

**Liquid Light Show**: [Liquid light show](https://en.wikipedia.org/wiki/Liquid_light_show) · [Joshua Light Show](https://en.wikipedia.org/wiki/The_Joshua_Light_Show) · [MoMA, Liquid Loops](https://www.moma.org/collection/works/200467) · [joshualightshow.com, 1969](https://www.joshualightshow.com/about-classic/joshua-light-show-1967-68) · [VICE, grandfathers of VJing](https://noisey.vice.com/en/article/ezaezk/experimental-imagery-meet-the-grandfathers-of-vjing-joshua-light-show) · [Instructables, old-school light show](https://www.instructables.com/Old-School-Psychedelic-Light-Show) · [Seveso, My Modern Met](https://mymodernmet.com/alberto-seveso-colorful-musician-album-covers).

**Sketch Cards**: in repo `docs/turbo-styles.md` §2, `sketch.ts`, `/looks/art` · [Dont Look Back](https://en.wikipedia.org/wiki/Dont_Look_Back) · [Design for Riso](https://oxfordgreenprint.com/home/design-for-riso/) · [Moniker Press riso guide](https://monikerpress.ca/printing).

**Signage**: [Split-flap display](https://en.wikipedia.org/wiki/Split-flap_display) · [Solari di Udine](https://en.wikipedia.org/wiki/Solari_di_Udine) · [Core77, Cifra 3](https://www.core77.com/posts/138912/An-Industrial-Design-Classic-Gino-Valles-Cifra-3-Flip-Clock) · [Jim Campbell, Rhythms of Light](https://espacio.fundaciontelefonica.com/en/evento/jim-campbell-rhythms-of-light/) · [LEDinside, Jim Campbell](https://www.ledinside.com/lighting/2014/4/philips_the_led_art_of_jim_campbell).

**Ink**: [Sumi-e (Fiveable)](https://fiveable.me/history-japan/key-terms/sumi-e.md) · [What is Sumi-e](https://sites.google.com/sdceonline.com/sumi-e/resources/what-is-sumi-e) · [Seveso, Design Milk](https://design-milk.com/alberto-seveso/) · [Karl Sims, reaction-diffusion](https://karlsims.com/rd.html) · [flow fields explainer](https://marcinklimek.github.io/posts/2024-01-03-flow-fields).

**Panels**: [Ben Day process](https://en.wikipedia.org/wiki/Ben_Day_process) · [Legion of Andy, Ben-Day series](https://legionofandy.com/2015/09/09/ben-day-dots-part-4-pre-history-origins/) · [The Nib, colour archive](https://thenib.com/color-archive/).

**Phosphor**: [Creative Applications, oscilloscope music](https://www.creativeapplications.net/project/oscilloscope-music-jerobeam-fenderson-and-hansi-raber/) · [IEEE Spectrum](https://spectrum.ieee.org/jerobeam-fendersons-trippy-oscilloscope-music) · [IMA archive](https://archiv.ima.or.at/en/oscilloscope-music/) · [LIFE, Picasso draws with light](https://www.life.com/arts-entertainment/behind-the-picture-picasso-draws-with-light/) · [Joanie Lemercier](https://joanielemercier.com/light_sculpture).

**Cover Pop**: in repo `docs/artistic-direction-v3.md` §11, `docs/assets/v3/coverpop-frame.png`.

**Monument**: [Universal Everything](https://en.wikipedia.org/wiki/Universal_Everything) · [Inspiration Grid, hybrid typographic architecture](https://theinspirationgrid.com/hybrid-typographic-architecture-prototypes-by-universal-everything/) · [Peter Cho, MIT thesis](https://acg.media.mit.edu/projects/thesis/pchothesis.pdf) · [CDM, AntiVJ](https://cdm.link/plays-of-shadow-and-light-into-digital-topography-new-antivj-work/).

**Also read for this report**: [99% Invisible, Karaoke Videos](https://99percentinvisible.org/episode/670-karaoke-videos/) *(read)* · [Art of the Title, True Detective](https://www.artofthetitle.com/title/true-detective) *(read)* · [CDM, Magnetosphere](https://cdm.link/2008/09/04/flight404s-magnetosphere-the-new-visualizer-in-itunes-8/) *(read)*.

---

# Section J: Phase 2 handoff

## J.1 Decisions Phase 2 must make before any asset is drawn

1. **Approve the 15** (or swap Monument for Riso Riot after its prototype).
2. **Registry shape.** Replace "Clean styles vs Turbo styles" with one list of 15 styles, each with a GPU tier and a Canvas 2D fallback (or an explicit "GPU only"). Decide what happens to Clean's readability tests per style.
3. **Scene-family model.** One shared schema for every style: style → scene families (tagged by role and song signals) → compositions → assets; the director cuts between families inside one style. Decide whether the cross-style auto director survives as an opt-in "VJ mix".
4. **Auto choice of style.** How identity picks one of the 15 per song (extends today's direction picker), with reasons shown and a sticky manual pick.
5. **Asset formats and pipeline**: vector paths (SVG subset) for silhouettes, drawings, line paths; texture atlases for plates; GLSL for procedural families; JSON for layouts and choreographies. Where assets live (in repo vs generated at build), size budget per style, lazy loading.
6. **Fonts.** One curated, open-licence type list per style, with script coverage (Latin, Cyrillic, Greek, Devanagari, Tamil, Arabic, Hebrew, CJK, Hangul, Thai). Payload budget (V14 in `docs/visuals.md`).
7. **Migration of stored picks** for the 20 looks that disappear (Section D).
8. **Floating lyrics, overlay and wallpaper** inherit the chosen style's type and colour (a simplified 2D rendition), or keep their own small looks.

## J.2 Technical dependencies (most exist; several do not)

| Need | Status |
|---|---|
| Deterministic scene host (sprites, shapes, full-screen shaders, ASCII pass) | Exists |
| Song identity, cover palette, subjects, hooks, gaps, beat grid with confidence | Exists |
| Timing-confidence soft mode for estimated words | **Not built** (P4 in `docs/visuals.md`) |
| Flash and photosensitivity guard for all styles | **Not built** (V5, P0) |
| Visual regression (golden frames) | **Not built** (T1, P0); needed before producing hundreds of assets |
| Warm-up and prefetch (compile, paint sheets) | **Not built** (P5) |
| Per-style quality steps with the governor | **Not built** (V7) |
| Complex-script handling inside scenes | Partial (V4); every style lists its fallback in Section C |
| Line rendering with glow (Phosphor), stroke-reveal masks (Ink), glyph routing (Glyph Cinema calligram) | **New** |
| 3D path: extrusion or sprite stacks, depth, fog (Monument) | **New**, biggest unknown |
| Parallax layer system with hinged sprites (Paper Theatre) | Small extension of the host |
| Bitmap/pixel fonts per script (Signage) | **New**, licence check needed |

## J.3 Prototype spikes before full production (recommended order)

1. **Monument**: can readable extruded type run at 60 fps on the integrated GPU, for Latin and one complex script? Go/no-go for the 15th slot.
2. **Ink stroke reveal**: is a brushed reveal of arbitrary fonts convincing, or does Ink need hand-drawn lettering?
3. **Glyph Cinema calligram**: does routing a line's letters into a picture read as magic or as noise?
4. **Phosphor single-stroke type**: open-licence stroke fonts and an outline fallback for other scripts.
5. **Liquid Light Show**: deterministic fluid that does not look like a generic shader.

## J.4 Likely production challenges

- **Illustration volume**: Panels (~700), Paper Theatre (500-700) and Ink (~500) need real drawing. Decide who draws: the owner, commissioned artists, or carefully authored generators with human review. Generated imagery must still be original and reviewed frame by frame.
- **Consistency at scale**: each style needs a one-page art bible (edge quality, line weight, palette rules, detail level) before asset 1.
- **Readability rules** for every style at 390x844 (phone) and 1280x720 and 720x1280, with the 4.5:1 floor where text sits on a flat field.
- **Rights**: no real logos, interfaces, signs, title-sequence look-alikes, characters or photographs. Each reference above is for method, never for copying.
- **Performance**: each style's budget measured with `bench()` on the integrated GPU (and the RTX 5050 when the owner can run it).

## J.5 Areas needing deeper visual exploration in Phase 2

Editorial references for Folio; lighting references for Nocturne; sign craft for Signage; lettering and panel grammar for Panels; brush work for Ink; and watching the motion references themselves
(this phase read about them but did not watch them). Phase 2 should run the frame-by-frame study AGENTS.md section 8 asks for, on footage the owner can supply locally.

## J.6 What Phase 2 does not need to redo

The audit, the 48-direction catalog, the selection and the per-style asset families are settled here unless the owner disagrees. Phase 2 starts from Section C and Section E and writes the per-asset manifests.
