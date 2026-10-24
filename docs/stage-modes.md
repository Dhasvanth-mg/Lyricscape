# Stage modes, GPU rendering, and songs in other languages

Scope of this round: (1) the art-direction philosophy saved as **Clean** mode; (2) **Turbo**, a hyper-visual mode drawn entirely on the GPU;
(3) Hindi, Tamil and nine more languages; (4) the richer transitions from the earlier customisation work, ported into the new Studio;
(5) the song's sync offset applied to exports; (6) the next-line preview removed. Lyric timing, playback and the lyric clock were not touched
(cue times are asserted identical across modes and transitions).

## 1. Clean mode (`lib/kinetic/modes.ts`)

Clean is what the app already was after the art-direction work, now a named mode with its rules written down (they are shown in the Studio
under **What Clean holds itself to**):

* One art direction per song, chosen from what the song is (genre, pace, mood, cover) and explained.
* Type pairings and negative space over decoration. No clutter: no duplicate lyric text, no decoration crossing a word.
* Readability is a guarantee: ink 4.5:1 against both ends of the ground, whatever the cover or the adjustments.
* Motion has a personality per direction; calm directions never cut, burst, drop or shake.
* Timing is never touched by styling.

Renderer: Canvas 2D (`lib/kinetic/render.ts`). Default mode.

## 2. Turbo mode (`lib/kinetic/gl/*`, `lib/kinetic/turbo.ts`)

Turbo keeps the direction language (its palette, its type pairing, its cover treatment) and turns the dials up. Both renderers draw the same
pure `Frame` from `computeFrame`, so seeking and export are exact in both.

**What the GPU does (WebGL2, every layer):**

| Layer | How |
|---|---|
| Backdrop | one fragment shader at reduced resolution: liquid light, god rays, bokeh or a horizon grid (chosen from the mood and the direction's scenery), tinted by the cover, with a shockwave on every beat; effects back off where the words sit |
| Cover | uploaded once; its soft versions (160, 56, 14 px) are blurred **on the GPU** (box down-scale + separable blurs); all treatments (wash, defocus, tonal, cinema, bleed, card, split, collage, hero) |
| Type | each word is rasterised once into a texture (1.5-2x supersampled, LRU under a 192 MB budget) and drawn as a quad: fill, stroke, glow, echo, chip, highlight, shadow, aberration, gradient, held-word illumination, art-filled words, split halves |
| Icons, doodles | rasterised once into sprites, drawn as quads |
| Interlude | aurora pools, rings (shader shapes), ribbons (triangle strips), particles (`gl.POINTS`) |
| Line effects | wipe, iris, bars as shader shapes; zoom punch, pan, tilt move the camera |
| Finishing pass | bloom of the backdrop (before the type is drawn, so type never gets a halo), lens fringing (zero in the middle, only toward the edges), scrim, vignette, halftone, scanlines, grain, flash |

The CPU decides what to draw; it does not touch pixels. Measured here (Edge, Intel Iris Xe via ANGLE/D3D11, headless): 1-2 ms per frame at 1440x810.
**Not measured:** the RTX 5050 (the browser here was on the integrated GPU; Settings -> Graphics explains how to move it), 120/144 Hz displays, sustained thermals.
The browser, not the page, chooses the GPU; Turbo asks for `high-performance`, `lib/gpu.ts` reports what it got.

**What Turbo changes about a Look** (`turboLook`): intensity x1.3, emphasis x1.4, beat response x1.7, glow up, held-word illumination on. Colours, type, layout
and artwork treatment are untouched (a test asserts it for every direction).

**Fallbacks:** no WebGL2, a shader that fails, or a lost context that does not come back -> the stage drops to Clean on a fresh canvas and says why.
Export falls back to Clean the same way.

### Bugs found and fixed in Turbo while testing

1. **Dead context after a React remount.** `dispose()` called `loseContext()`; React strict mode / fast refresh / reopening the stage reuse the same
   canvas, and a context that was deliberately lost never works again (its shaders fail to compile), so Turbo silently fell back to Clean. Now `dispose()` frees every GPU object and leaves the context alone.
2. **Leaked WebGL contexts.** The capability check made a new context on every render of the export dialog and never released it; at ~16 the browser kills the *oldest*,
   which was the stage's own. The check is cached and releases its probe; exports and stills dispose their renderer. (24 mode toggles + an export now raise no warning.)
3. **Smeared text.** Lens fringing was strongest across the whole text area, bloom haloed every glyph, and glyph textures were not supersampled.
   Fringing now starts only near the edges, bloom is taken before the type is drawn, glyphs are 1.5-2x.

## 3. Customisation ported from the earlier Look system

The Studio's **Motion** group now has: *Words enter with* (17), *Words leave with* (11), *Transition speed* (0.5-2x), *When a line begins* (zoom punch, pan, tilt, colour wipe,
iris ring, venetian bars, soft flash) and *Use it on* (every line / hooks only). Stored with the other adjustments, per song, resettable one by one. Reduced motion turns the line effects off;
the flash obeys the 12% limit. The standalone Look panel from the earlier branch (`wip/customize-panel`) is superseded by the Studio; its presets and saved looks map to directions and saved themes.

## 4. Songs in other languages

| Area | What it does |
|---|---|
| Script and language | `lib/lyrics/script.ts`: exact script detection (Devanagari, Tamil, Hangul, Kana, Han, Arabic, Hebrew, Thai, Cyrillic, Latin); language by script, and for Latin letters by common-word lists (romanised Hindi and Tamil, Spanish, French, Portuguese, German, Italian) with a lead over English function words. The stage shows the language |
| Matching lyrics | `lib/lyrics/translit.ts`: loose romanisation of Devanagari and Tamil and a phonetic key, so "Kesariya" matches "केसरिया" and an artist in another script matches. Combining marks (vowel signs) are kept when normalising titles |
| Word units | scripts written without spaces (Japanese, Chinese, Thai) are cut into words with the browser's ICU segmenter (`tokenize`), so a line is not one giant word |
| Typography | script faces first (Noto Sans Devanagari/Tamil are bundled and fetched on demand; Malgun/Yu Gothic/YaHei/Segoe UI/Leelawadee come from the OS), **no italic, no letter spacing** for those scripts, taller rows for tall marks, width estimates by script |
| Right-to-left | Arabic/Hebrew lines are laid out mirrored: the first word sits at the right |
| Timing estimate | syllables counted as aksharas (Hindi/Tamil), kana moras, Hangul blocks, Han characters, Cyrillic vowels |
| Mood and subjects | word lists for Hindi, Tamil (native + romanised), Spanish, French, Portuguese, German, Italian, Korean, Japanese, Chinese, Russian, Arabic (`indicLexicon.ts`, `worldLexicon.ts`, merged in `lexicons.ts`); words that are also common English words are excluded (tested) |
| Song type | genre tags for Tamil/South Indian film music, Hindi/Punjabi, K-/J-pop, reggaeton/urbano, afrobeats, regional rap, flamenco/fado/bossa, Middle Eastern and Eastern European pop; pronoun sets for perspective; pace counted in syllables outside Latin text |
| Honesty | "no mood words found" counts as weak evidence in English only. For covered languages that weight is x0.45, for languages with no list (Thai, Hebrew, Turkish...) it is 0, and the identity card says so ("mood from the words is approximate for Spanish lyrics", "this app has no word list for Thai") |

**Limits, stated plainly:** the word lists are short and hand-picked (a few dozen words per language), not a language model; irony, slang and idiom are invisible; Urdu in Nastaliq,
Arabic dialect spellings and CJK vocal-line segmentation are approximate; Japanese kanji-only text is called Chinese; right-to-left is mirrored layout, not full bidi for mixed lines;
nothing here was reviewed by a native reader of every language (the Hindi and Tamil screenshots render correctly; the others were checked for correct shaping and order only).
Spotify gives no lyrics, so for those songs the language comes from lyrics you load or find.

## 5. Export

The video uses the **song's own sync offset** (lyric time = song time + offset), with a stepper in the dialog; the device delay is deliberately not included (it belongs to the speakers).
A Mode switch (Clean / Turbo) is in the dialog; Turbo exports render on the GPU with `preserveDrawingBuffer` so the encoder reads what was drawn.
Native-script titles are kept in file names.

## 6. The next-line preview

Removed: `Frame.caption` is always `null` and neither renderer draws it.

## 7. Verification

`pnpm typecheck`, `pnpm lint` clean. Unit tests added: `indic` (17), `world-lang` (27), `transitions` (46), `turbo` (18); updated: export file names.
Browser checks (Edge, headless): Turbo and Clean on Hindi, Tamil, Japanese, Korean, Arabic lyrics; persisted Turbo mode on a fresh stage mount; 24 mode toggles;
MP4 export in Turbo (H.264, 120 frames) with a decoded frame inspected; no console errors or warnings.
