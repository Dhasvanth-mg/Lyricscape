# Artistic Direction V3: a music-informed visual identity

Scope: turn "genre → one of 14 effects" into an art director. Each song gets an interpretable **Song Visual Identity**; the identity
picks one of ten composed **art directions**; the listener can correct the interpretation, adjust every part of the look, and save
their own themes. Synchronisation, playback and the lyric clock were not touched (verified below). Nothing is committed.

Legend used throughout: **Implemented & tested** (automated tests), **Implemented, checked by eye** (screenshots reviewed),
**Not verified live** (code path exists, could not be exercised here), **Not built**.

---

## 1. Audit of what existed (Phase 1)

| Area | What was there | Why it was shallow |
|---|---|---|
| Theme choice | `chooseTheme`: five families, additive scores, then `styleFor()` with 1–2 `if`s | A family mapped to a style almost directly. **R&B + love/nostalgia mood → Vaporwave**, every other R&B → Aurora. |
| Mood | `analyzeEmotion`: one label from a word list, plus a BPM → emotion table | Single label. The list was tuned on the demo songs (it contained `planet`, `paper`, `tape`, `wall`, `wings`, `fold`) and counted everyday words (`night`, `city`, `beat`, `drop`, `baby`, `good`, `yeah`, `fall`, `break`, `run`, `blue`) as feelings. BPM < 76 meant "sadness". A chorus repeated ten times counted ten times. Valence/arousal were fixed constants per label, not measurements. |
| Colour | A binary light/ink text colour, one accent; only 3 styles dimmed sung words; "multicolour" styles gave words palette colours by index | No hierarchy; colour changed for activity, not meaning. |
| Artwork | One blurred wash (56 px bitmap), a hero card in ≥4 s breaks, art-filled words | Same treatment for every song and style; the wash banded on striped covers. |
| Styles | 14 parameter sets on one engine, 7 typefaces (3 of them novelty) | No type pairing, no left-aligned/asymmetric composition, no negative space, nothing refined for R&B. |
| UI | A flat list of 14 style buttons + a settings strip (colour source, emoji, doodles, a mood *emoji* select) | Felt like a settings dashboard; mood override was one emoji. |
| Clutter | Hook marquee repeating the lyric 5× at 9 %, interlude ribbons/rings/doodles/emoji in every look, a permanent mood-emoji label | Duplicate lyric text and decoration crossing important words. |

Kept because it was good: the pure `computeFrame` architecture (seek-safe), the pace-aware word estimator, the cover palette
extraction, the per-song offset store, and the classic styles (now an explicit, opt-in "Classic looks" shelf).

---

## 2. Song Visual Identity (Phase 2) · `lib/identity/`

Every dimension is its own axis with a **confidence** and the **sources** that moved it. A dimension with no evidence is `null`
("unknown"), never "medium". **Implemented & tested** (`tests/identity.test.ts`, 23 tests).

* **Musical:** primary / secondary genre family and share (from tags), subgenre labels, delivery (`rapped / sung / mixed / unknown`,
  from line-synced pace + tags), rhythmic intensity, pacing, instrumental character (only what the *tags* say: piano, acoustic, …).
* **Emotional (independent):** valence, energy, intimacy, tension, warmth, nostalgia, melancholy, urgency, dreaminess, plus
  **ambiguity** (mixed words *or* sources that disagree).
* **Lyrical:** perspective (inward / addressed / collective / narrative), a narrativity score (long, non-repeating, past-tense
  lines), subjects (romance, heartbreak, night & city, ambition, struggle, reflection, memory, nature, escape, faith, celebration,
  defiance) and the visual motifs they suggest.
* **Cultural:** release decade and album when the source reports them; aesthetics the *tags* carry (lo-fi, shoegaze, retro-futurist…).
  **Influences are always empty.** The schema has no field an AI reply could use to add them, and a test asserts it.
* **Provenance:** which sources were used, what is *reported* (tags, release year), what is *inferred* (words, pace, cover), and a
  standing list of what this app **cannot know** without audio analysis (timbre, harmony, production, section dynamics, influences).

### What song information is actually available

| Source | When | Status |
|---|---|---|
| Genre tags | Spotify artist genres (when connected); tags on the track; else **MusicBrainz** community tags by artist name (votes → weight; opt-out in Settings) | Spotify path unchanged from before, **not run here (no Spotify session)**. MusicBrainz path **tested with a mocked upstream and probed live** (tags exist for Frank Ocean, Drake, SZA, Arctic Monkeys; **none** for Seedhe Maut). |
| Lyrics | LRCLIB / pasted / local | Real. Mood words are read with damping and negation handling. |
| Delivery pace | Only with line-synced lyrics (plain pasted text has no pace; that used to be an artefact of spreading lines evenly) | Real. |
| Cover | Dominant colours, brightness, vibrance, **colour temperature** | Real (weak evidence; a cover-only dimension is never named in the headline or used to pick a direction). |
| Tempo / beat grid | Demo & imported audio only | Spotify exposes none; nothing is faked. |
| Release year / album | Spotify | New (`Track.releaseYear`). |
| AI reading | Opt-in | See §3. **Not verified live.** |

### Mood detection changes

1. Everyday ambiguous words are no longer evidence; strong and weak stems are weighted differently.
2. A repeated hook counts once at full weight, then at a third.
3. Negation weakens a hit instead of flipping it into another feeling.
4. Nine independent dimensions + ambiguity, each blended from several sources by weight; **disagreement lowers confidence and raises
   ambiguity** (e.g. sad words over a bright, fast, colourful setting).
5. Genre tags only nudge (they describe a catalogue, not this song): one `trap` tag alone decides nothing.
6. One shared rule (`knownDim`) decides what is "known" for the headline, the reasons and the choice, so they cannot contradict.
7. The listener's corrections (More intimate / energetic / darker / warmer / cinematic / experimental / minimal) are explicit, bounded
   numeric steps stored per song. There is no hidden learning.

The old `analyzeEmotion` still exists: it only tints classic styles per line. The art directions ignore it.

### Sections

Where lyrics repeat (hook detection), the chorus lifts the ground slightly and emphasised words take the accent colour. This is
**inferred from lyric repetition, not from audio**. Without repetition the song keeps one consistent treatment. True
intro/verse/chorus detection from audio is **Not built**.

---

## 3. Optional AI interpretation · `lib/identity/ai.ts`, `/api/identity/interpret`

* The model is asked for *structured evidence* (dimension values with its own confidence, perspective, subjects, imagery, arc,
  one summary sentence). **It never drives animation.** It is one more source (`ai`) in the same blend, confidence capped at 0.7,
  validated against a schema (an out-of-range reply is discarded whole).
* The prompt tells it to judge only the words shown and **not** to state facts about the artist, influences, intentions or the
  recording. The schema has no field for them.
* Off by default (Settings → AI reading). Needs `OMNIROUTE_API_KEY` (any OpenAI-compatible gateway; OmniRoute is the default target).
  One call per song and lyric text, cached in IndexedDB; the app is fully functional without it. It sends title, artist, tags and a
  ≤2.4k-character lyric excerpt to the gateway; Settings says so.
* **Tested** with a mocked gateway (request shape, cap on excerpt, schema validation, 501 when unconfigured, upstream failure).
  **Not verified live:** no provider is connected in the local OmniRoute here, so no real model has been asked.

---

## 4. Art directions (Phase 3) · `lib/theme/`, `lib/kinetic/directionStyles.ts`

A direction fixes, *together*: palette (and how far the cover may pull it), type pairing, artwork treatment, scenery, texture,
motion personality. The identity then **picks** one (each direction scores itself and reports reasons) and **tunes** it (calmer when
intimate, harder when urgent). Selection is deterministic; a direction that needs genre evidence is not eligible without it; with too little
evidence the answer is the calm default and says so. **Implemented & tested** (`tests/directions.test.ts`, `tests/look-frame.test.ts`).

| Family | Direction | Idea | Type | Palette | Artwork | Scenery / motion |
|---|---|---|---|---|---|---|
| R&B | **Velvet** | late-night, warm shadow | Cormorant Garamond + italic | espresso, oxblood, plum, muted gold, ivory | re-toned wash or cinematic crop, reflection | diffused light pools; line reveals, light travels through held words; blur-in focus pull |
| R&B | **Ether** | alt R&B, art book | Instrument Serif (+ Syne caps) | bone & sage (or charcoal & lavender), earth | paper-collage cover | light leaks; left-aligned, drifting entrances |
| R&B | **Nocturne** | dark atmospheric | Inter Light + serif italic | ink, navy, smoke, desaturated violet, one amber/red accent | defocused city light | bokeh at the edges only; fades, low beat pulse |
| Hip-hop | **Type as Rhythm** | structure, contrast | Anton + serif italic | black, signal colour pulled from the cover | split panel | corner brackets, beat ticks only with a real beat grid |
| Hip-hop | **Broadsheet** | reflective / story-led | Playfair Display | newsprint & ink red/blue | framed cover card | paper, hairlines; restrained |
| Pop | **Graphic** | contemporary graphic | Space Grotesk + Archivo | flat field from the cover; type white or near-black by contrast | framed card | flat shapes kept *away* from the ink |
| Rock | **Analog Cinema** | grain, warm monochrome | Bebas Neue + Special Elite | warm mono / B&W | full-bleed | poster keyline, heavy grain |
| Indie | **Art Book** | paper, imperfection | Instrument Serif | paper & terracotta / lamplight | card / collage | line reveal |
| Atmospheric | **Stillness** | negative space, one light | Cormorant Light | night / morning | very soft defocus | one breathing halo |
| Experimental | **Controlled Disorder** | mixed faces, brief slices | Syne + typewriter + serif | acid signal | split panel | colour slices *behind* the words at some line starts |

### R&B redesign (no default vaporwave)

* R&B has three directions of its own, chosen by the specific atmosphere: warm + intimate + low-energy → Velvet; dreamy + ambiguous + cool
  / alt-R&B tags → Ether; dark + tense + cold / dark-R&B tags → Nocturne.
* A property test runs R&B tags × lyric moods × six covers × tempo and asserts the choice is never Vaporwave, Neon, VHS, Y2K,
  Maximalist, Pop Art or Psychedelic, and that all three R&B directions do get used.
* Vaporwave stays available: explicitly, or automatically only when the tags say synthwave / vaporwave.
* A soft, romantic-sounding song with **no** genre evidence is *not* dressed as R&B (tested).
* Blending: when the runner-up is close it lends ≤ 35 % of its motion and texture (never its type or ground), and says so.

### Fixtures and what the gallery proves (and does not)

`/looks` renders ten **original** songs (invented titles/artists, lyrics written for the page, generated covers, stand-in genre tags)
through the real pipeline. They exist so choices can be inspected; they are not real recordings and say so on the page. Real
songs by the artists you named could not be shown (lyrics are copyrighted and Spotify tags need your session); the behaviour you
asked about is covered by *kinds* of song: soft alt-R&B vs dark R&B vs fast hard rap vs story-led rap, etc. To see your own songs, play
them with Spotify connected and open the Studio.

---

## 5. Artwork, colour, motion (Phases 4–5)

**Artwork treatments** (all deterministic, chosen per direction and song): soft wash, defocus, re-toned ("tonal"), full-bleed cinematic
with the ground closing toward the words, framed card (optional reflection), split panel, paper collage, off.
Card / split / collage reserve room beside the words (the layout, caption and no-overlap tests know about it) and fall back to a
wash on narrow or portrait stages. Cover colours never fill words in the new directions. The cover's strength under text is capped
so its worst colour still leaves the ink at 4.5:1. The cover is rasterised once (an SVG cover had cost ~25 ms/frame per `drawImage`).

**Colour hierarchy** (primary ink, dim ink, active word, accent, support): sung words rest in ink; in line-reveal looks upcoming words are
dim and the word being sung lights (with a wipe through words held ≥ 450 ms); in a repeated-lyric chorus emphasised words take the accent.
Lines without word times are **not** lit word by word (that would claim timing nobody has). Colour never changes per word for activity (tested).

**Readability guarantees (tested over every direction × 6 covers × 3 identities × 6 adjustment sets):** ink ≥ 4.5:1 (5 by design, 7
for urgent hip-hop/rock) against **both ends** of the ground; dim ink ≥ 4.4; active ≥ 4.5; accent ≥ 3.5, even for a listener's grey-on-grey.
If no ink can reach the floor the *ground* is moved. Sliders cannot take a look below readable.

**Musical motion:** each direction has a motion personality (intensity, smoothness, emphasis, beat response, complexity, transition,
reveal mode); intimacy, energy and urgency tune it; calm directions never use cuts, bursts, drops, shakes, doodles, emoji or
art-filled words. A cut hands over to the next word within ~40 ms instead of lingering under it. Motion never changes *when* a word is
shown: the cue times are identical across all directions (tested), the entrance starts ≤ 70 ms before the cue and is solid within
250 ms. "Beat response" only does anything when a real beat grid exists; no beat is detected or invented.

---

## 6. Visual Studio (Phase 6) · stage → **Studio** tab

Always visible: *This song, as understood* (headline like "Intimate · Warm · Alt R&B", why Auto chose its direction, correction chips,
"what this is based on" including what is unknown), Auto + the direction cards grouped by family (+ a per-family default),
Your themes. Under **Customize** (progressive disclosure, live preview, ↺ per control): palette (all palettes or four colour pickers),
typography (13 pairings), background, artwork treatment & softness, motion (intensity, smoothness, word emphasis, beat response, visual
complexity, transitions), appearance (text size & position, alignment, contrast, grain, glow, brightness, density).
Saving: name a theme, apply it to any song, return to Auto, reset one adjustment or all. Stored locally (localStorage themes;
IndexedDB per-song picks and corrections; the legacy per-song style pin is migrated). The first frame waits for the stored look, so a
song never flashes the wrong look.

---

## 7. UI polish (Phase 7)

New stage chrome and panel, a designed identity card instead of an emoji select, the permanent mood-emoji label replaced by the
identity headline, the hook-repeat marquee and interlude decoration removed from the new directions, `/looks` gallery with `?song=&w=&h=&t=&dir=&tw=&anim=&quality=&bench=`.
Phone width checked (Studio and renders at 390 × 844).

---

## 8. Performance (measured)

`/looks?…&bench=1` → `KineticRenderer.bench()` (90 frames, **GPU flush included**), Edge on **Intel integrated graphics (ANGLE / D3D11)**, one static
frame per song, so this is draw cost, not full-session frame pacing.

| Direction | 1280×720 high | 1920×1080 high | 1920×1080 light |
|---|---|---|---|
| Velvet | 5.2 ms | 9.2 | 8.2 |
| Ether | 6.6 | 7.9 | 7.0 |
| Nocturne | 8.7 | 7.4 | 5.5 |
| Type as Rhythm | 4.9 | 6.4 | 4.8 |
| Broadsheet | 5.6 | 8.5 | 6.5 |
| Graphic | 12.1 | 8.1 | 7.2 |
| Analog Cinema | 8.3 | 7.8 | 6.0 |
| Art Book | 5.8 | 6.4 | 5.6 |
| Stillness | 5.1 | 8.9 | 6.1 |
| Controlled Disorder | 8.0 | 13.7 | 7.8 |

All within the 16.7 ms budget for 60 fps; the worst is 13.7 ms. What it took: first measurement found Broadsheet at **34 ms** (cover re-rasterised
each frame → drawn once into a canvas, now 9 ms) and Nocturne/Stillness at **17–25 ms** (three wide `strokeText` glow passes per word →
baked once into a sprite per word, now 5–9 ms). Identity, palette extraction, tags, AI and look composition are cached or memoised and run off the
render path; the frame function never recomputes mood. **Not measured:** a 120/144 Hz display, a weaker GPU than this one, or sustained
thermal behaviour. The existing quality governor still lowers effects automatically if frames run long.

---

## 9. Verification

* `pnpm typecheck`, `pnpm lint`: clean.
* `pnpm vitest run`: **635 pass**; `tests/social.test.ts › recommendations…` is the known ~50 % flake (same-millisecond sort tie), unrelated.
  New: `identity` (23), `directions` (22), `look-frame` (183: overlap/off-canvas/artwork-clearance for 10 directions × 4 line lengths × 4
  viewports, landing, hierarchy, held-word illumination, calm directions, reduced motion, adjustments), `identity-routes` (6).
* `pnpm build` succeeds. `pnpm test:e2e`: **10 pass** (new `looks.spec.ts`: all 11 fixtures render non-blank, all different, ≥ 9 distinct
  directions at phone / laptop / desktop, no page errors; the Studio flow: correct, pin, adjust, save, return to Auto).
* Screenshots were reviewed critically in several rounds; this caught and fixed: a stray doodle in a "decoration-free" look, outgoing and
  incoming lines ghosting, wide stack rows with tiny type, a card/shape contrast inversion, banding of the cover wash, three words piling
  in fast cuts, an over-large type size in calm looks, contradictory headline vs reasons.
* Sync/playback code unchanged: the cue times are asserted identical across looks; `lib/player/*`, `lib/lyrics/*` were not edited.

## 10. Remaining limitations (honest list)

* **No audio understanding.** Timbre, harmony, production, true sections and tempo (on Spotify) are unknown; the identity says so.
  "Delivery" and "intensity" come from lyric density and tags; fast words ≠ fast music.
* Genre tags are catalogue-level and sometimes absent (none for Seedhe Maut in MusicBrainz); then Auto uses words and cover only and says so.
* Lexicon mood reading is crude: irony, metaphor and non-English lyrics (Hindi/Hinglish) are largely invisible to it; the AI reading would
  help but is **unverified live**. There is no language detection.
* Cover colour temperature is weak evidence; it cannot name a mood by itself.
* Looks use cover art as the user's personal-use build already did; Spotify's "unmodified artwork" policy mode is still honoured by the renderer but not re-audited.
* The Studio has not been usability-tested with a person; slider ranges and wording are my judgement.
* A look can still change a second or so into a song when slow online tags arrive after the grace period (700 ms).
* Not built: audio-based sections, a beat-grid for Spotify, a multilingual lexicon, per-section direction changes, sharing themes between devices.

---

## 11. Follow-up: custom icons instead of emoji, Cover Pop mode, dedicated GPU

Reference for this round: a screen recording of Apple Music's full-screen lyrics on a Mac (cover as the whole stage, big hot-pink
rounded italic words one or two at a time, a white chip on the emphasised word, small icons beside matching words).

### Every emoji is now custom (`lib/kinetic/icons.ts`, `components/ui/Icon.tsx`)

* **48 original vector icons** (heart, heartbreak, flame, sun, moon, star, sparkle, cloud, rain, wave, bolt, eye, wing, crown, diamond, car,
  road, clock, note, mic, flower, ghost, skull, cash, glass, city, signal, snowflake, wind, storm, hand, house, planet, link, tear, three
  faces, cassette, camera, leaf, key, rocket, party, bulb, tv, page, burst). One consistent family: flat rounded shapes, three tones
  (main / dark / light) plus a white highlight, drawn on a 24 grid as plain SVG path data. The *same data* renders on the canvas
  (`Path2D`, cached sprites) and in the React UI (`<Icon/>`), so the interface and the stage match.
* Tones come from each icon's own hue pulled 18 % toward the current accent, so a heart stays red and a sun yellow but both belong to the
  look; the sticker edge is white on dark stages and dark on light ones. (First pull was 30 % and turned flames pink: reviewed and reduced.)
* Replaced: the word stickers, the ambient icon showers in hooks, the interlude mood icon, the mood select labels, the 👋 on the guest page,
  and the ★ ✓ ✕ marks in the interface (now icons / Lucide). `tests/icons-coverpop.test.ts` scans the app's source for emoji and pictographic
  dingbats and fails if any return (plain arrows are typography and stay). The old word→emoji table and `emojiForWord` are gone.
* Review pages: `/looks/icons` (every icon as SVG and as canvas sprite, on dark and light, three accents). Two icons were redrawn after
  review (Road read as the letter "A"; Wing read as a flower).

### Cover Pop (`lib/kinetic/directionStyles.ts`, the Studio's "Cover-forward" group, or Settings → Default look)

A separate mode, chosen by you; Auto never switches to it by itself.

* **The cover is the stage:** full-bleed, undimmed, a hair of drift (new `bleed` artwork treatment); almost no scrim, no vignette to speak of.
* **Type:** Nunito Black, rounded italic; words arrive as **short phrases of 1 to 3 words** (up to 4 when tiny), one phrase handing the stage to the
  next *before* the next lands. Only lines with word times are split; a line without them stays one unit (splitting would invent timing).
* **Colour by what is behind each word.** The hot colour is the cover's own most vivid colour pushed bright and saturated. The renderer reads a
  48 × 48 copy of the cover, averages the pixels under each word and picks, from `[hot, white, near-black]`, the first that reads at ≥ 3.4:1 (the word being
  sung prefers white); a sticker edge in the opposite tone is drawn only when needed (none ≥ 7:1, thin ≥ 4.5:1, full below that). If the browser will not let the app read the
  cover (cross-origin without CORS), words fall back to white with an edge. **Not verified:** a real Spotify cover (none available here); the CORS-first load with fallback is
  implemented and the generated covers exercise the sampling path.
* **One white chip per phrase** on the heaviest word (its text is the hot colour darkened by scaling channels, so it stays rich, ≥ 4.5:1 on white); custom icons beside
  the words that have one; no doodles; no next-line caption.
* Verified by 10 new unit tests (splitting rules, hand-over, no phrase overlap at 390 / 1280 / 1920, chips and candidates, icons, determinism, cue times
  unchanged) and e2e (every sample draws at phone and laptop size). Frame cost measured below.

### Dedicated GPU

* **What was measured:** this laptop has Intel graphics and an RTX 5050. A page cannot choose: Edge stays on the Intel GPU even when a WebGL context asks for
  `high-performance`; launching the browser with `--force_high_performance_gpu` moves it to the RTX. So the app does what it honestly can: **Settings → Graphics**
  and a line in the Studio name the GPU in use and warn (with the fix) when it is integrated or software; `pnpm open:gpu` starts Edge/Chrome with the flag (and refuses
  with an explanation if that browser is already running, because it would ignore the flag); the Playwright config and my own measurements launch with the flag.
  **I did not change any Windows setting.** The one-time permanent fix (Windows Settings → System → Display → Graphics → your browser → High performance) is yours to make.
* The Python aligner already prefers CUDA when available and reports its device.
* **Frame cost, ms (1280×720 / 1920×1080, high quality), Intel → RTX 5050:** Velvet 4.8/8.9 → 3.1/2.6 · Ether 6.0/7.8 → 2.5/0.6 · Nocturne 9.2/7.2 → 6.4/1.4 · Rhythm 4.7/5.8 → 5.0/6.4 ·
  Broadsheet 5.6/8.3 → 4.7/7.1 · Graphic 12.3/7.6 → 9.3/1.2 · Analog 8.1/7.7 → 6.0/6.1 · Art Book 5.3/6.5 → 4.9/4.8 · Stillness 4.4/9.1 → 2.0/3.5 · Disorder 9.1/13.2 → 7.7/13.2 ·
  **Cover Pop 6.1/6.1 → 3.8/1.6.** Fill-bound looks gain a lot on the dedicated GPU; the CPU-bound ones (heavy canvas text and path work: Rhythm, Broadsheet, Analog, Disorder)
  barely change, because that work is not on the GPU. All are inside the 16.7 ms budget on either GPU. One static frame per song, not sustained playback.

### Verification of this round

`pnpm typecheck`, `pnpm lint` clean; **667 unit tests pass** (the flaky social test passed this run); `pnpm build` succeeds; **13 e2e tests pass** (run on the dedicated GPU).
Screenshots: `docs/assets/v3/icon-set.png`, `gallery-coverpop.png`, `coverpop-frame.png`.
