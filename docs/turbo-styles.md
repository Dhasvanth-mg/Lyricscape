# Turbo styles: what each one is, how it is built, how to change it

For agents and developers. The user-facing summary is in `docs/stage-modes.md` section 8; the rules for working on this code are in `AGENTS.md`.
Values quoted below are the ones in the code at the time of writing; the constant or function that owns each is named so you can check it.

## 0. The model in one page

Turbo (WebGL2) has six **styles**, picked in the Studio (Mode -> Turbo -> chips) or the export dialog, stored in `useUi().turboStyle`:

| id | Label | What it is | Code |
|---|---|---|---|
| `liquid` | Liquid light | the default: the song's own art direction at full intensity (flowing light, god rays, bokeh, beat shockwaves, cover treatments) | `lib/kinetic/gl/renderer.ts` `draw()` (the long path), `turbo.ts` |
| `terminal` | Code screens | each lyric is typed into a different screen the camera flies through | `gl/scenes/terminal.ts` |
| `sketch` | Sketch cards | hand-lettered, dithered poster cards | `gl/scenes/sketch.ts` |
| `nebula` | Lyrics app | Apple-style rolling lyric column over a colour mesh or a nebula with neon streaks | `gl/scenes/nebula.ts` |
| `acid` | Acid grain | rolling colour blobs, grain, looping RGB-split eyeballs, yellow subtitle | `gl/scenes/acid.ts` |
| `ascii` | ASCII eye | a window of characters; the picture comes from the song | `gl/scenes/ascii.ts`, `subject.ts` |

(The ids kept their first names; the labels are in `TURBO_STYLES` in `lib/kinetic/turbo.ts`.)

`liquid` uses the normal pipeline: `computeFrame` -> `Frame` -> backdrop shader, cover artwork, words, icons, doodles, bloom, finishing pass. The other five are **scenes**:
`isSceneStyle(style)` is true, `TurboRenderer.draw()` hands over to `drawSceneFrame()` and **ignores `frame.words`, doodles, icons and the direction's layout**. A scene draws everything itself.
`computeFrame` still runs (its `beat`, `tMs`, `mood` are used), so cue timing is untouched.

### How a scene runs

```
TurboRenderer.render(tMs)
  -> computeFrame(...)                       // the pure Frame (beat pulse, time)
  -> drawSceneFrame(frame)
       -> drawScene(style, host)             // gl/scenes/index.ts: one function per style, returns SceneFx
            host = makeHost(frame)           // in gl/renderer.ts
       -> bloomPass(plan with fx.bloom)      // glow of what the scene drew (bright parts, blurred at 1/4 res)
       -> finish(frame, plan, false, fx)     // the post shader: all SceneFx settings, to the canvas
```

**The host** (`gl/scenes/types.ts` `SceneHost`), all in stage CSS px, origin top-left, y down, premultiplied alpha:
`W,H,dpr,frame,tl,reduced,density` and
`tex(key,w,h,paint,{nearest})` (a canvas painted **once** and cached as a texture, LRU, keys are prefixed `s|`), `measure(font,text)`, `sprite(o)`, `shape(o)`, `rect`, `pool`, `points`, `clear(color)`,
`fullscreen(key, fragmentShader, scale, setUniforms)` (a full-screen shader; `scale` < 1 renders at the stage target's reduced resolution and stretches; `>= 1` draws straight into the scene target),
`ascii({cell,mix,boost})` (turns what is drawn so far into characters), `additive(on)`.
Scenes pass their own matrices (`camera:false` is forced); `gl/scenes/common.ts` has `camera()` (sheet -> screen: translate, rotate, skew, zoom about a focus point) and text helpers.

**SceneFx** (what a scene returns each frame; all optional, 0 = off): `aber` (+`aberFull` 1 = fringing over the whole frame, 0 = only toward the edges), `glitch` (horizontal slices), `blocks` (displaced tinted macroblocks),
`mblur:[x,y]` (directional blur, uv units), `zblur` (radial blur), `grain` (mono) / `chroma` (coarse colour grain) / `grainCell` (css px), `scan`, `curve` (CRT), `dither`, `vignette`, `flash`, `bloom` (multiplier), `exposure`.
These map to uniforms in `POST_FS` (`gl/shaders.ts`).

**Which line is on** (`common.ts` `lineAt(tl, tMs)`): the last scene (lyric line) with `startMs - 30 <= t` and `t <= min(nextStart - 30, endMs + 900)`; otherwise `null`.
Returns `{ i, scene, text, words, startMs, untilMs, age, p, dur }` (`age` ms since the line began, `p` 0..1 through its time on screen, `dur` its total time on screen, at least 500 ms).
Word cues have `startMs/endMs` and `timing` (`authored`, `estimated`, `none`); `none` means the word has no time of its own and scenes spread words evenly instead.
**Every scene must still look alive when `lineAt` is null** (intro, break, instrumental, song without lyrics) and must be a pure function of `tMs`.

**Fonts and textures:** scene text is painted with `textTex()` (painted at 2-3x then drawn at any size; keys include font, colour, stroke, text). Fonts must be loaded before first use (`SCENE_FONT_LOADS` in `scenes/fonts.ts`, loaded by `TurboRenderer.loadFonts`, which then clears sprites painted with a fallback face).

**Performance** measured (Intel Iris Xe, headless Edge, 1280x720, `renderer.bench`): code screens 1.6-1.8 ms, sketch cards 1.5, lyrics app 2.0-3.0, acid 2.4-3.1, ASCII 3.2-3.3, liquid 2.1-6.7. Not measured: RTX 5050, high refresh rates.

**Checked at:** 1280x720 and 720x1280, English lyrics. Not checked: Hindi/Tamil/right-to-left lines inside the five scenes.

---

## 1. Code screens (`terminal`) — `gl/scenes/terminal.ts`

**Reference:** a clip of lyrics typed into things on screens, with a handheld camera. Each lyric appears in a different "screen" and the camera whips between them.
**Not copied:** the creator watermark, the sign-off brand card, the real logos (a ministry's login logo; a law-enforcement seizure page with real seals, which was left out entirely). The login page is our own ("PORTAL", green arc, our wording).

**Look:** near-black navy (`#04060d`) with syntax-coloured code (JetBrains Mono, keywords `#52c7ff`, `return`/`void` `#c692f2`, strings and numbers `#ffb27a`, function names `#f4e3b8`, rest `#d7e3fb`); light-grey screens for the form and banners; green `#43ff3c` console. Strong vignette, bloom (the lyric glows), light grain, a touch of CRT curve.

**Shots.** `SHOT_ORDER = ['code','code','errors','big','form','banner','console','big']`; line `i` uses `SHOT_ORDER[i % 8]` (`shotFor`). A line longer than 30 characters never uses `big`; it falls back to `console`.
Each shot is a camera path over a texture "sheet" painted once at 2x (`sheet()`, keys `sheet|...`); blur is the texture's mip level (`lod`). Times below are fractions of the line's `dur`; `a` = `line.age`.

| Shot | Sheet | What happens |
|---|---|---|
| `code` | `codeSheet`: 40 rows of pseudo-JS (a promise library), row `LYRIC_ROW` (11) is empty and prefixed `throw new TypeError(` | the lyric is an orange string literal `('lyric');` typed into that row (`typedChars` from 12% to 66% of the line) with a blinking white caret; the camera frames the whole literal (`zoom = 0.92 W / literal width`, clamped 0.7-3.4), approaches with rack focus (blur 3.2 -> 0 over the first 20%), pushes in 5%, then dollies 1.7x over the last 18% with blur; slight handheld shake (`noise1`) |
| `errors` | `errorSheet`: an IDE error list ("Entire Solution", "0 Errors" button, TS6387/TS6385 warning rows) with one blank row (`ERR_ROW` 8) | the lyric is typed into that row in larger white text; the camera zooms from 0.62 to 3.0 over the first 35% and then follows the caret along the row |
| `big` | the code sheet blurred and dimmed behind | huge pale-yellow monospace words (`#f3e5a6`, fit to ~88% of the width); each word appears at its own `startMs` with a short jitter and **glitch blocks** (`fx.blocks`); the camera dollies from 2.4x to 1x over the first 35% |
| `form` | `formSheet`: a light login page (our own brand), three fields, two green buttons | the lyric is typed into the username field on a grey selection with an **underscore caret**; the camera enters at a 34 degree angle, settles to 14 degrees, then spins away (-78 degrees) over the last 26% with directional blur |
| `banner` | `bannerSheet`: pink error rows with a red bar and a circled x, on grey | the lyric repeats in three rows (red `#c32f3a`), typed in the first third; the camera tilts about -22 to -12 degrees and pans along the rows; zoom is chosen so the text width fits |
| `console` | none (black) | green bold mono text with a glow. Lyrics of 34 characters or fewer: big, left aligned, **the view scrolls** to follow the typed end. Longer: wrapped to up to several centred lines at a smaller size. Block cursor |

**Common to all shots:** a "whip" for the first ~190 ms of every line (blur LOD up to 2.6, directional blur, glitch slices, exposure +50%), and an "out" in the last ~130 ms (exposure fades to 15%): that is the cut. With no line: the code sheet drifts out of focus at 55% alpha.
**Reduced motion** removes shake, directional blur and glitch.
**Tunables:** `CODE_LINES`, `CODE_FS`, `LYRIC_ROW`, typing windows (the `typedChars(text, age, startMs, doneMs)` calls), per-shot `fx` at the end of each branch.
**Tests:** `tests/turbo-styles.test.ts` (shot order, long-line fallback, typing).

## 2. Sketch cards (`sketch`) — `gl/scenes/sketch.ts`

**Reference:** a clip of pixel-scribble poster cards, each lyric line a hand-lettered card in a paint program. **Not copied:** the artist's drawings, handles, the "follow" card.

**Look:** a 4:3 card (`CW x CH` = 360x270 card pixels) centred on black, scaled to `min(0.97 W / 360, 0.92 H / 270)`, shown with **nearest-neighbour** filtering so card pixels are chunky. A window bezel of diagonal hatching, an inner border, paper grain.
**How the "drawn in a paint program" look is made** (this is the important trick): the card is painted normally with Canvas 2D, blurred ~1px, then every pixel gets random noise added and is **snapped to the nearest colour of a small palette** (`snap()`); alpha is thresholded with noise too. Edges between two palette colours therefore stipple and speckle. Do not replace this with a post-process dither: the noise must be per card pixel, not per screen pixel.

**Themes** (`THEMES`, 8, chosen by `line.i % 8`): each has paper, ink, three accents, frame colour, border style (`hatch`, `dots`, `scribble`, `stripe`), a corner `doodle` and three faces (big / mid / thin). Faces used: Anton, Permanent Marker, Special Elite, Cormorant Garamond, Instrument Serif, Bebas Neue.
Doodles (`doodle()`, drawn procedurally with seeded wobble): braided `face`, `eyes` with lashes and little flowers, `chibi`, `flower`, `cat`, `stars`; a theme with doodle `none` uses the whole card for words. A card with more than 7 words drops the doodle.

**Layout** (`layout()`), a poster, not a flow of equal text: score words (longer and not a stop word, the last word gets a bonus, a little seeded noise); the top word is `big` (Anton, 1.75x, accent fill with a thick dark outline), the second `pill` (on a wobbly coloured blob, ink or paper text chosen by luminance), a third `big` from 6 words, others alternate `mid` and `thin`. Words flow into rows inside the zone (full card, or left 66% when a doodle is there), the base size is the largest (from 78 down) that fits 90% of the height and the width, rows are spread vertically, alternate rows are pushed right, each word gets a little rotation and y jitter. Each letter is drawn separately with its own rotation and scale (`paintWord`) for the hand-lettered look. Layout results are cached per line (`layoutCache`, 12 entries).

**Timing:** the card base and each word are separate textures (`card|<line>|<theme>|base` and `|w<idx>`). A word is revealed at its cue `startMs` (or `idx * 120 ms` when it has no timing) by a left-to-right clip over 170 ms (`SpriteOpts.clip`). Cards cut hard from line to line. With no line: an empty card of theme 7 (the dotted one).
**Fx:** light grain, tiny vignette, no bloom.
**Tunables:** `THEMES`, role multipliers `mul()`, row factors `rowK()`, `snap` noise amounts (46 for the base, 40 for words), blur radii.

## 3. Lyrics app (`nebula`) — `gl/scenes/nebula.ts`

**Reference:** footage of a desktop lyrics player on a monitor and a laptop: rolling lyrics in big rounded type, once on an orange-pink-blue gradient and once on a purple nebula with neon streaks. **Not copied:** the room, the desk, the screens' chrome, the artist and song text.

**Two worlds**, switching every three lines (`Math.floor(line.i / 3) % 2`); the first world is the colour mesh:
- **Mesh** (`MESH_FS`): four soft colour blobs (`#ff7a3d`, `#ff3d7a`, `#5560f0`, `#ff9a4d`) drifting over each other, weights `exp(-d^2 k)`, normalised. Light, chroma grain.
- **Nebula** (`NEBULA_FS`): fbm gas in violet, magenta and blue over indigo, ridged filaments; plus CPU-drawn furniture (`spaceFurniture`): ~170 twinkling stars (`points`), five drifting rocks (a painted polygon sprite each), and **two neon streaks** (magenta and lime), each a `kind: 5` shape (bright core, fading ends) with a tiny paper-plane ship sprite at its head, racing from the lower left to the upper right (`q = fract(t * speed)` along a fixed line).

**The column** (`drawColumn`): words are Nunito 900 (rounded, bold), base size `clamp(0.2 H, 60, 220)`. The **active word** is the last whose start time has passed (`starts[]`: cue `startMs - line.startMs`, or spread over the first 78% of the line when untimed). A continuous cursor glides from the previous word to the active one over 220 ms (`easeOut`), and every word's size, opacity and vertical pitch is interpolated by its distance `d` from the cursor: size `[1, .42, .3, .22]`, alpha `[1, .55, .28, .08]`, pitch `[0, .78, 1.28, 1.6] x base` (words before are above, after are below). Every word is shrunk to fit 84% of the width (74% in space). The active word pops from 0.9x to 1x over 160 ms.
**Chip:** on the active word when its cue `emphasis > 0.5` or it has 7+ letters: a rounded rectangle (`#6a5cf0` in space, translucent `#7aa6ff` on the mesh).
**In space** the whole column is rotated -7 degrees (along the streaks) and each word steps right by 8.5% of the width per position, so it descends to the right. Words are tinted lavender when not active.
**Fx:** mesh: chroma grain 0.035, cell 1.5, little bloom; space: grain 0.05, bloom 1.2, edge fringing 0.35.
**Tunables:** `MESH`/`NEBULA` palettes, `SIZE/ALPHA/PITCH`, the 3-line switch, streak speeds and thickness (`120 * k` px).

## 4. Acid grain (`acid`) — `gl/scenes/acid.ts`

**Reference:** a clip of saturated, grainy, hue-cycling colour fields with hand-drawn eyeballs that loop through a choreography, and a yellow subtitle. **Not copied:** the artwork's exact drawings, the creator mark.

**Background** (`ACID_FS`): five blobs whose positions wander and whose hues roll (`hue = base + t * 0.075`), warped, saturation 0.7, value 0.8, then multiplied by a low-frequency mottling (`fbm`). Post: **coarse colour grain** (`chroma 0.3`, cell 2 css px), full-frame fringing (`aberFull: 1`, `aber 0.55`), tiny bloom.

**Eyes:** 13 entities, each drawn as: a fill sprite (wobbly pale sclera in one of six tints, plus iris rings and a pupil for "eyes"; plain for "balls"), a **black outline sprite**, and three additive copies of the outline in red, blue and green slipped a few px apart (`dpx`), which gives the rainbow edges. Sprites are 256 px canvases (`fillTex`, `lineTex`, six variants).
**The loop** (`CYCLE` = 7000 ms, phases `PH` = 0 / 950 / 1900 / 2900 ms): A: five big eyes in a row under a pyramid of six small ones and one tiny falling dot; B: a cluster of blank pale balls; C: everything scatters along a horizontal band with one huge ball at the bottom; D: scattered and bobbing. Between phases, positions/radius/"eye-ness" are interpolated over the last 420 ms (`easeInOut`); each entity's target in each phase is `layoutOf(phase, i)` (positions in units of a portrait-width playfield `PW = min(W, 0.78 H)`). In C and D entities sway and tilt.
**Subtitle:** the **whole line at once** (not word by word) in Anton `#ffc21a` with a dark-brown outline and a soft glow, at 27% of the height in portrait (20% in landscape), shrunk to fit 90% of the width, a small pop on entry.
**With no line:** the eyes and background keep going.
**Tunables:** `CYCLE/PH`, `layoutOf`, `SCLERA/IRIS` colours, size factor (`e.r * PW * 2.7`), outline widths, `ACID_FS` blob count and hue speed.

## 5. ASCII (`ascii`) — `gl/scenes/ascii.ts`, `subject.ts`, `EYE_FS` in `scenes/shaders.ts`

**Reference:** a filmed screen recording: a huge eye drawn in characters on a code editor in a dark room, blinking, then dissolving into a ringed planet. **Not copied:** the room, the Windows UI, the creator mark.

**What it draws is chosen from the song** (`subject.ts`, pure and tested; memoised per timeline in `subjectOf`): a word in the **title** decides (`LOOKUP` word lists per subject; "E85" -> highway); else the most frequent theme in the lyrics with **at least 3 hits**; else the mood (`arousal >= 0.78` -> `lights`; `arousal <= 0.28 && valence < -0.2` -> `rain`); else `eye`. Ties go to the more specific subject (`highway, lights, rain, fire, ocean, space, city`).
Subjects (index = position in `SUBJECTS`, passed as `u_subject`), all inside `EYE_FS`:
- `eye` (0): procedural eye: lids (`u_open`, blinks at `blinkAt` seconds), amber iris with fibres and limbal ring, pupil (`u_dil`, breathes and flares), glints, brown skin texture; the look jumps every 1.5 s; the first 2.4 s zoom out from the iris. **It morphs to the planet and back** (`u_morph` ramps 0 -> 1 over 11.2-14.6 s and back over 22-25.2 s, through a noise-front dissolve with falling flecks). Loop `LOOP` = 26 s.
- `highway` (1): dusk sky, skyline, perspective road (road-space `xr = x / (y - horizon)`), dashed lanes and edges scrolling toward you, lamp posts, 3 cars ahead (body, cabin, glowing tail lights, receding) and 3 oncoming headlight pairs; speed grows with `u_energy` (the song's arousal).
- `lights` (2): sweeping coloured beams, a grid of lamps flicking on/off in changing colours (rate from `u_energy`), a strobe pulse on the beat (`u_beat`) and a rhythmic one for lively songs.
- `ocean` (3): moon, waves with perspective, a reflection column; `fire` (4): fbm flames rising, colour ramp red-orange-yellow, beat flare; `city` (5): night skyline, lit windows that twinkle; `space` (6): the banded ringed planet alone; `rain` (7): layered rain streaks and lightning flashes.

**Pipeline:** the shader draws the picture into a square window (`S = min(0.62 W, 0.62 H)`, portrait: 0.86 W) straight into the scene target (black outside); then `host.ascii({cell: max(6, S/70), mix: 1, boost: 2.1})` replaces every cell with a glyph from a brightness ramp (`' .:;i1tfLCG08@'`, atlas in `ensureAtlas`), keeping the colour; **then** the room is drawn over it (so it is not turned into characters): a dim code-editor strip at the left, a taskbar under the window, a blue backlit keyboard at the bottom (all sprites painted once), a faint green haze at the top.
**Lyric:** typed on the screen below the window in amber mono (`#ffd28a`) with a block caret, wrapped to the width; with no line only the caret blinks.
**Fx:** scanlines 0.05, CRT curve 0.04, vignette 0.55, grain 0.05, bloom 1.3.
**Adding a subject:** add a word list in `subject.ts` (and the name to `SUBJECTS`), add a `vec3 yourScene(vec2 p)` in `EYE_FS` and a branch in `main()` keyed on `u_subject`, add a test in `tests/turbo-styles.test.ts`, add it to the lists here and in `docs/stage-modes.md`. Keep it pure in `u_time`.

## 6. Liquid light (`liquid`)

Not a scene. The art direction's palette and treatment at full intensity (`turboLook`: intensity x1.3, emphasis x1.4, beat response x1.7, more glow, held-word illumination), over a reduced-resolution backdrop shader (variants: liquid light, god rays, bokeh, horizon grid, chosen by mood/scenery by `planStage`), cover treatments (wash, defocus, tonal, cinema, bleed, card, split, collage, hero), all words with their per-direction treatments, always-on sparks, bloom, fringing toward the edges, scrim, vignette, halftone, scanlines, grain. See `docs/stage-modes.md` sections 2 and 3.

## 7. Adding a new Turbo style

1. Study the reference frame by frame (see `AGENTS.md` section 8). Write down layout, type, colour, motion, timing; decide what you will **not** copy.
2. Add the id to `TURBO_STYLE_IDS` and an entry to `TURBO_STYLES` (label + honest one-line tagline) in `lib/kinetic/turbo.ts`.
3. Add `gl/scenes/<name>.ts` exporting `draw<Name>Scene(host): SceneFx` and a case in `gl/scenes/index.ts`. Put anything testable (choosing, layout, typing) in pure exported functions.
4. If you need a new post effect, add the uniform to `POST_FS` and set it in `TurboRenderer.finish()` from `SceneFx`; if you need fonts, add them to `SCENE_FONT_LOADS`.
5. Verify in the browser at 1280x720 and 720x1280, with a line and without, mid-typing and at line end; `bench()` it; export a short clip from the dialog.
6. Update this file, `docs/stage-modes.md`, and the count/list in `README.md` and `AGENTS.md`. Update `tests/turbo-styles.test.ts` (it asserts six styles; the label set must stay unique).
