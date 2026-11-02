# Playback and visuals: improvement game plan

Written 2026-11-02 from a read of the code (not a rewrite of the spec). Scope: the playback chain (Spotify and local), the lyric clock, the stage render loop, Clean and Turbo, the
five Turbo scenes, the Studio, and export. It lists **32 numbered improvement points**, ranks them, and turns them into a phased plan with exit criteria.
Companion docs: `docs/turbo-styles.md` (how each style is built), `docs/stage-modes.md` (what exists), `docs/lyric-sync-*.md` (sync work so far), `AGENTS.md` (rules).

**How to use this file.** Work the plan top to bottom by phase. Every item has an ID (P = playback and sync, V = visuals, T = tooling and tests); reference the ID in commits and in
`docs/feature-tracker.md`. When an item ships, tick its box in section 8 and write the measured result next to it. Numbers must be measured; "not measured" is an acceptable entry.
Nothing here is implemented yet. Where a claim comes from the code, the file is named so you can check it.

---

## 1. Where we are today

```
position source -> PlaybackClock (epoch, slew <=4%, snap >250 ms) -> lyricTime = position - outputLatency + deviceAdvance + trackOffset
   Spotify: SDK events + API polling      local: AudioContext (base + output latency, automatic)
lyricTime -> computeFrame(timeline, t) (pure) -> renderer.render(t)
   Clean (Canvas 2D)  |  Turbo liquid (WebGL2)  |  Turbo scenes: code screens, sketch cards, lyrics app, acid grain, ASCII (WebGL2)
rAF loop in LyricStage.tsx: renders every animation frame while the tab is visible; FrameGovernor steps quality high/medium/low on frame intervals
Export: fixed-fps stepping of the same pure function, WebCodecs MP4/WebM, no audio
```

**Strong already (do not redo):** the clock's epoch and slew design (`lib/player/clock.ts`), the two separate corrections (device delay shared, song offset per version), opt-in sync diagnostics
(`lib/player/syncDiag.ts`), deterministic rendering (so export equals the stage), the adaptive governor, the demo-song browser loop, 790+ unit tests, measured scene cost of 1.5-3.3 ms per frame at 1280x720 on an
integrated GPU (docs/turbo-styles.md).

**Known soft spots this plan targets:** beat-driven visuals have no beat on Spotify; latency is manual on Spotify; scenes look the same for every song; strobing is not rate-limited; nothing guards visuals against regressions;
first use of a style hitches; scenes mishandle complex scripts.

---

## 2. The 32 points (summary, ranked)

Priority: **P0** do first (safety, trust, measurement), **P1** high value, **P2** worthwhile, **P3** later. Effort: **S** under half a day, **M** 1-2 days, **L** 3-5 days of focused agent work.

| ID | Point | Prio | Effort |
|---|---|---|---|
| V5 | No flash-rate or photosensitivity guard in the Turbo scenes | **P0** | M |
| T1 | No visual regression tests: scenes are only checked by hand | **P0** | L |
| T3 | No in-app performance overlay, hitch log or soak test | **P0** | M |
| T2 | Browser suite is flaky (14 of 16 passed in a full run, both failures passed on rerun) | **P0** | M |
| P1 | No beat grid on Spotify: beat-driven visuals sit idle on the main source | P1 | L |
| P2 | Output latency is unknown on Spotify and calibration is manual | P1 | L |
| P3 | No per-device latency memory and no device-change handling | P1 | M |
| V1 | Scenes ignore the song's own palette, mood and direction | P1 | L |
| V2 | Turbo style is one global setting: not per song, no auto-pick | P1 | M |
| V4 | Complex scripts break inside the scenes (typing, per-letter drawing, RTL) | P1 | L |
| P5 | Track change and first use hitch: lazy shader compile, lazy textures, no prefetch | P1 | M |
| V8 | One shared texture cache; permanent sheets can be evicted mid-song | P1 | M |
| V7 | Scenes do not step down with the quality governor | P1 | M |
| V6 | Reduced motion only half-applies in the scenes | P1 | S |
| P6 | Render loop ignores refresh rate, idleness and absolute 24 ms threshold | P1 | M |
| V3 | ASCII picture picker: artist names can decide, English only, no override | P2 | M |
| V9 | Sketch cards paint on the CPU at line start (cost not measured) | P2 | M |
| V10 | Scene loops and typing are not tied to the song's tempo or line length | P2 | M |
| V11 | Weak visuals in intros, breaks and outros | P2 | M |
| V12 | No per-style controls in the Studio | P2 | L |
| V13 | Only 16:9 and 9:16 were tuned; no safe areas | P2 | M |
| V14 | Fonts: wrong-face first frame risk and a large font payload | P2 | S |
| V15 | Accessibility of the stage (canvas only) | P2 | M |
| P4 | Estimated word timing is only ~53% within 200 ms and the scenes trust it | P2 | M |
| P7 | Timing confidence is hidden; no quick per-line fix on the stage | P2 | M |
| V16 | Hard pop between a line and the idle state | P2 | S |
| V18 | WebGL context loss drops to Clean for good | P2 | S |
| V17 | `renderer.ts` (1,460 lines) and `frame.ts` (1,333) are too big | P3 | L |
| V19 | Export runs on the main thread; no safe-area presets | P3 | L |
| V20 | Styles are code, not data: no shareable style packs | P3 | L |
| P8 | Seek and buffering states are not reflected on the stage (to verify) | P3 | S |
| T4 | Real hardware and real ears are untested (RTX 5050, 120/144 Hz, Bluetooth, native readers) | P1 (owner) | owner |

---

## 3. Playback and sync (P)

### P1. No beat grid on Spotify
- **Status 2026-11-02 (partly built; the owner allowed analysing Spotify audio):** `lib/analysis/*` analyses audio (onset strength, tempo, beat tracking) and the song index stores the result; songs the app holds the audio of are analysed once; a Spotify song can be learned by **listening to the tab** (opt-in, Settings -> Song index). The stage uses the learned grid. Measured: on the demo song the analyser found 111.91 BPM against a ground truth of 112, with beats a median 6 ms from the true grid (99% within 70 ms), in 2.7 s for a 53 s file. **Not verified: a real Spotify session.** **Tried on real recorded music (2026-11-02):** the audio of the owner's five reference clips, extracted locally (never committed or stored; only numbers). Offline analysis: Flashing Lights reel **90.4 BPM** (known 90), Let It Happen reel **125.0** (known 125), We Are The People reel **123.1** (known 126; the clip may be speed-edited), all confidence 1.0, 65-200 ms per clip. **Listening through tab capture** (the same audio played in the browser and heard through `getDisplayMedia`, the route a Spotify song would use): **124.9, 90.0 and 123.1 BPM at confidence 1.0, the same as the file analysis.** The captured beats ran 140-145 ms behind the beats found in the file (the capture pipeline's latency); shifting each block back by `CAPTURE_LATENCY_MS` = 140 ms puts them within 18-22 ms of the file's beats (100% within 50 ms). That constant was measured on one machine (Edge on Windows, tab capture). **A first test of this reported the capture as too quiet and degraded: that was a test-harness mistake** (`--use-fake-ui-for-media-stream` makes `getDisplayMedia` return a fake stream; a 440 Hz tone at 0.5 came back as noise until the flag was removed). **System-audio capture** (Settings -> Listen to the computer's sound) could not be tried here: Chrome's picker needs a person to tick "Also share system audio", and without it the app shows its instruction message. **Still not tried: a real Spotify session** (needs the owner's Premium login). The Settings status line reports the captured sound level (very low / low / fine).  Built since: tap tempo, the lyric-timing estimate, the online tempo lookup and a "where did this beat come from" label (see the implementation log). Still open: aligning the learned grid with the per-song lyric offset.
- **Evidence:** `docs/lyric-sync-motion.md` ("No beat grid for Spotify (the audio-analysis API is closed to new apps)"); `track.bpm`/`beatTimesMs` only come from the local provider (`lib/player/providers.ts`); `compileTimeline` builds the grid from them (`lib/kinetic/compile.ts`). `frame.beat.pulse` feeds Turbo's beat response, the stage shockwave, bloom, the ASCII strobe and pulse, the acid size pulse.
- **Impact:** on the main source (Spotify) the energy of the visuals is flat. Turbo multiplies beat response by 1.7 and there is nothing to multiply.
- **Fix:** three sources, in order of trust, each labelled in the UI ("tempo: tapped / estimated / from file"): (1) **tap tempo** saved per song (also lets the owner lock phase); (2) **estimate from the synced lyrics**: cluster line and word starts, autocorrelate to a dominant period (60-200 BPM, folding half/double), pick phase from the strongest alignment, return a confidence and only use it above a threshold; (3) local files keep real analysis. Never process Spotify audio (rights rule). Feed the grid into the existing `beatTimesMs`.
- **Verify:** unit tests on synthetic and real fixture line starts (recover known BPM within 3%); a visual check that the pulse lands on tapped beats; the grid is off, not wrong, when confidence is low.

### P2. Output latency is unknown on Spotify and calibration is manual
- **Evidence:** `outputLatencyMs()` exists on the local backend only (`lib/player/backends/local.ts`); the Spotify backend does not implement it, so `lyricTime` uses 0 (`lib/player/controller.ts` `getOutputLatencyMs`). The only correction is the manual device delay and song offset steppers.
- **Impact:** Bluetooth speakers and some DACs add 100-250 ms; every new setup needs hand tuning, and the owner already tunes it per song.
- **Fix:** a one-time guided calibration: play a short click track through the same output (a bundled CC0 click, played by the app's own audio, not Spotify) and have the user tap along; measure tap-to-click offset over 12 beats, discard outliers, store as the device delay for that output. Also show "calibrated for <device>" and a re-run button. Keep the manual stepper as the override.
- **Verify:** unit tests of the estimator with simulated noisy taps; a saved value changes `lyricTime` by exactly that amount; owner confirms audible sync on two outputs (needs hardware, see T4).

### P3. No per-device latency memory and no device-change handling
- **Evidence:** no `devicechange` listener anywhere in `lib`, `components` or `app`; the device delay is one global value per source (`syncGlobal` in `lib/ui-store.ts`); the Spotify backend tracks `activeDeviceId` but does not key the delay by it.
- **Impact:** plug in headphones mid-song and lyrics are suddenly early or late; moving between laptop speakers and Bluetooth needs a manual fix each time.
- **Fix:** key the device delay by output device (browser `audiooutput` label/id for the web player; Spotify device id and name for Connect); listen to `navigator.mediaDevices` `devicechange` and to the Spotify device switch; apply the stored delay when it changes; if unknown, offer the P2 calibration once. Persist next to the existing prefs.
- **Verify:** tests with a fake `mediaDevices`; manual run with a Bluetooth device (owner).

### P4. Estimated word timing is not good enough to drive per-word visuals
- **Evidence:** `lib/lyrics/words.ts` documents the estimator: within 200 ms 52.6% (vs 46.5% for the old rule), words more than 300 ms late 24.4%. "It is an estimate, not timing." The scenes use per-word times for typing, the active-word chip, the lyrics-app column, glitch bursts and sketch scribble-ins.
- **Impact:** on line-synced lyrics (most of LRCLIB) the visuals imply precision the data does not have; a word chip that is 300 ms late looks like a bug.
- **Fix:** make visuals **timing-confidence aware**: `Scene.words[].timing` already distinguishes `authored`, `estimated`, `none`; give each scene a soft mode for estimated words (wider easing, no hard per-word hits, chips and bursts only on authored words, line-level pacing otherwise). Add a **tap-along correction** for a line (tap each word once; store a per-song speed and offset that re-scales the estimator for the rest of the song). Longer term, per-language syllable pacing (already used for the lyrics pace) in the estimator.
- **Verify:** a test that renders the same line authored vs estimated and asserts the soft mode has no abrupt per-word events; the existing estimator study (`tools/sync-report/ab/estimator_study.ts`) re-run with the new rule and the numbers recorded.

### P5. Track change and first use hitch
- **Evidence:** shader programs compile lazily on first use (`host.fullscreen` creates `new Program` on first call in `gl/renderer.ts`); scene textures (sheets, text, cards) are painted on first draw; the next track's lyrics, palette, fonts and textures are not prepared before the change (`LyricStage.tsx` loads on track change). Per-frame cost of these first draws is **not measured**.
- **Impact:** a visible stutter on the first frames after switching style or track, worst on slower GPUs, where compiling a heavy shader (the eye shader has eight scenes in one program) can take 100 ms or more.
- **Fix:** (1) a **warm-up pass** when a style is selected or a song loads: compile programs (use `KHR_parallel_shader_compile` where available), paint the permanent sheets and one frame offscreen, then reveal with a short fade; (2) **prefetch the next queue item**: lyrics lookup, cover palette, identity, and the first line's textures during the last 20 s of the current track; (3) split the eye shader per subject so only the needed branch compiles.
- **Verify:** a hitch metric from T3 (longest frame in the first 3 s after a style switch) before and after; target no frame over 50 ms after warm-up on the integrated GPU.

### P6. Render loop ignores refresh rate and idleness
- **Evidence:** `LyricStage.tsx` renders on every `requestAnimationFrame` while visible; the governor's thresholds are absolute (`downMs: 24` ms median, `upMs: 19`) in `lib/kinetic/governor.ts`; nothing reads the display refresh rate; a paused song with a moving scene still re-renders every frame.
- **Impact:** on 120-144 Hz screens the scene cost is paid 2-2.4x more often than needed; a 24 ms threshold is far too loose at 144 Hz and a 60 Hz laptop on battery burns power while paused; the owner's RTX 5050 setup was never measured.
- **Fix:** measure the display interval at startup and after display changes; make the governor thresholds relative to it (down when the median exceeds ~1.5x the refresh interval); add a frame cap setting (Auto, 30, 60, uncapped); throttle to 30 when paused and the scene is not time-critical; render on demand for fully static states.
- **Verify:** frame-pacing histogram from T3 at 60 and 144 Hz (144 Hz needs the owner's display, T4); power draw while paused is lower (rough check with the browser task manager).

### P7. Timing confidence is hidden; no quick fix on the stage
- **Evidence:** `doc.timing.source`, `wordTiming` (`authored` or estimated) and the lyric version id exist and are used by the opt-in diagnostics (`syncDiag`), not by the UI. A "Try another version" control exists for Musixmatch alternates (feature tracker), and a timing editor exists (`TimingEditor.tsx`).
- **Impact:** the owner cannot tell at a glance whether a drift is the song's timing, the device, or an estimate.
- **Fix:** a small badge on the stage (source, authored words or estimated, offset applied) that opens the existing nudge and "another version" controls; a one-key "this line is early or late" nudge that adjusts only that line's start (feeds `TimingEditor` data).
- **Verify:** component test of the badge states; e2e opens it from the stage.

### P8. Seek and buffering states (to verify)
- **Evidence:** the Spotify backend emits `buffering` in its state (`emit(buffering)`); the stage does not obviously react. After a seek, a typed scene re-derives its state from `line.age`, which is correct, but a seek into the middle of a line starts the whole whip and typing from a mid-line state.
- **Impact:** possible odd frames on seek; possible "playing" look while the stream is buffering.
- **Fix:** verify first with a scripted seek and buffering test on the demo song and a Spotify mock; then add a calm "waiting" look and make whips conditional on a real line change, not a seek.
- **Verify:** the scripted test in the browser loop; golden frames (T1) at a seek target.

---

## 4. Visuals: engine, scenes, Studio, export (V)

### V1. Scenes ignore the song's own palette, mood and direction
- **Evidence:** the five scenes use fixed palettes (`terminal.ts` navy/orange/green, `nebula.ts` `MESH`/`NEBULA`, `sketch.ts` `THEMES`, `acid.ts` hue roll only, `ascii.ts` amber). Only `liquid` uses the resolved `Look` and the cover.
- **Impact:** in a scene every song looks the same; the "one art direction per song" idea is lost the moment Turbo styles are chosen.
- **Fix:** give each scene named colour **slots** and fill them from the song: cover palette first, then the mood palette, then the scene's reference defaults, always under a contrast check. Examples: code screens (keyword, string, function hues rotate to the palette; console green becomes the palette's brightest hue), sketch (pick the theme closest to the cover hue and mood, tint paper and accents), lyrics app (mesh blobs and nebula gas from the cover), acid (hue offset and saturation from the cover and mood), ASCII (iris and lamp colours). Keep an "original look" toggle that restores the reference defaults.
- **Verify:** golden frames across six sample covers (T1); contrast assertions per scene (ink against ground at least 4.5:1 where text sits on flat colour); a test that the same song yields the same slots.

### V2. Turbo style is one global setting
- **Evidence:** `turboStyle` is a global preference (`lib/ui-store.ts` `DEFAULTS`, persisted in `PREFS_KEY`), unlike the per-song theme pick; there is no automatic choice.
- **Impact:** the owner has to switch styles by hand for every song; the style does not follow what the song is.
- **Fix:** store the style **per song** next to the theme pick; add **Auto**, chosen from identity (genre, pace, mood, lyric features: code-like and tech words toward code screens; hip-hop and high energy toward acid; ballad and slow toward lyrics app; handwritten and diary words toward sketch; cars, lights and similar toward ASCII), showing the reason in the Studio in plain words (the existing identity card already does this for directions). Keep manual override sticky.
- **Verify:** picker unit tests over fixtures; the override survives reload; export uses the song's style.

### V3. ASCII picture picker
- **Evidence:** `forTrack.ts` and `pipeline.ts` set `label: title • artists`, and `subjectOf` (`gl/scenes/ascii.ts`) reads the whole label, so an artist name can decide ("Lil Flame" would pick fire); word lists in `subject.ts` are English and about a hundred words; there is no override.
- **Impact:** wrong pictures for some songs, none for other languages, and no way to correct it.
- **Fix:** pass title and artist separately (title decides, artist never does); add a Studio "Picture" control (Auto plus the eight); reuse the multilingual lexicons (`lib/lyrics/lexicons.ts`) for Hindi, Tamil, Spanish and the others; add more subjects (heart, desert, mountains, crowd) only if each gets a real shader; allow a different subject per section (verse vs chorus) later.
- **Verify:** tests for "artist is ignored" and a Hindi and a Spanish fixture; the override test.

### V4. Complex scripts break inside the scenes
- **Evidence:** typing and clipping measure `text.slice(0, n)` by UTF-16 index (`prefixPx` in `scenes/common.ts`), the sketch scene draws **letter by letter** with `for (const ch of label)` and per-letter rotation (`sketch.ts` `paintWord`), wrapping splits on spaces only, and right-to-left lines are not mirrored in the scenes (Clean mirrors them in `frame.ts`). The scenes were only checked with English (`docs/turbo-styles.md`).
- **Impact:** Hindi and Tamil conjuncts and vowel signs would split, cursive scripts would be broken apart, Arabic and Hebrew would read the wrong way round. These are languages the owner cares about.
- **Fix:** type by **grapheme cluster** (`Intl.Segmenter`, already used in `tokenize`); jitter per cluster, and **disable per-letter jitter for joining and complex scripts** (draw the word whole, jitter the word); script-first font stacks for scene fonts (`loadScriptFonts`); RTL anchors and reversed typing direction in each scene; word segmentation for Thai and CJK in wraps.
- **Verify:** fixtures in Hindi, Tamil, Arabic, Japanese in the golden harness (T1); a native reader checks them (owner, T4); unit tests for the grapheme prefix function.

### V5. No flash-rate or photosensitivity guard in the Turbo scenes (P0)
- **Evidence:** Clean caps flashes at 12% (`frame.ts` `flash`), but the scenes bypass that. The ASCII "lights" picture flashes the whole picture with `step(0.55, fract(t * (1.2 + 3.0 * u_energy)))` in `EYE_FS`, which is up to about 4.2 flashes a second; lamp grids toggle up to seven times a second; code screens add +50% exposure and a glitch burst at every line start; `SceneFx.flash`/`exposure` have no limiter. `reduced` does not gate the strobe in the shader.
- **Impact:** a real safety issue: WCAG 2.3.1 asks for no more than three flashes in any second (and below general flash thresholds). Strobing visuals can trigger seizures. This must be fixed before the app is shared with anyone else.
- **Fix:** a **FlashGovernor** in the finishing pass and on scene output: track a short luminance history, cap flashes per second (at most 3) and per-flash luminance change and area, and soften (not drop) the effect when the cap is hit; make the ASCII strobe use the same governor and replace the strobe with a slow pulse when `reduced`; add a Settings switch "Photosensitive-safe" (on by default, and always on with reduced motion); the whip exposure and glitch bursts go through it too.
- **Verify:** an automated analyser that renders a worst-case minute (lively song, lights subject, rapid line changes) frame by frame, counts luminance flashes per second and asserts at most 3; a unit test of the governor on synthetic sequences; the safe switch off stays possible but off-by-default is not allowed.

### V6. Reduced motion only half-applies in the scenes
- **Evidence:** only `terminal.ts` reads `h.reduced` (shake, directional blur, glitch); the post pass zeroes glitch, blocks, curve and fringing when `reduced` (`gl/renderer.ts` `finish`); the acid dance, the nebula streaks, the sketch scribble-in, the ASCII blinks and lights, and every shader's animation continue at full speed.
- **Impact:** people who ask the OS for less motion still get moving blobs, racing streaks and a strobing picture.
- **Fix:** define a **calm variant** per scene: halve speeds, hold backgrounds nearly still, no streak races, instant (not animated) reveals, slow pulses instead of flashes; share a `calm` factor in the host (`h.calm`) instead of each scene reading `h.reduced`.
- **Verify:** golden frames show calm frames at t and t + 200 ms differ by less than a threshold; unit test of `calm` plumbing.

### V7. Scenes do not step down with the quality governor
- **Evidence:** the governor lowers DPR, grain and the stage resolution (`QUALITY_PROFILE`, `allocTargets`); scenes ignore quality: only the nebula star count reads `h.density`. The eye picture runs at full resolution with fbm; the acid scene draws 13 entities with four sprites each.
- **Impact:** on a weak GPU the governor lowers DPR but the heavy parts of a scene stay heavy, so it may never recover to 60 fps.
- **Fix:** a **quality ladder per scene** driven by `h.quality`: run full-screen shaders at 1.0, 0.7 or 0.5 scale; fewer entities and copies; cheaper blur; cap text texture sizes. Document each ladder in `docs/turbo-styles.md`.
- **Verify:** bench at each level on the integrated GPU and under software rendering (SwiftShader) to simulate a weak GPU; the governor steps down and holds 30+ fps.

### V8. One shared texture cache; sheets can be evicted mid-song
- **Evidence:** every scene texture (screen sheets, text, cards, sprites) lives in one LRU capped at 160 entries (`sprite()` in `gl/renderer.ts`); the lyrics-app column paints a text texture per word at up to 2x of a large size; per-line card textures use new keys each line. Eviction deletes the oldest entry whether or not it is a large permanent sheet. Glyph textures have a separate 192 MB byte budget; sprites have no byte budget.
- **Impact:** after a few lines the code, error and form sheets can be evicted and must be repainted on next use (a visible hitch); memory is not bounded in bytes.
- **Fix:** two pools: **pinned** sheets (never evicted while the style is active) and **transient** text/cards with a byte budget; count hits and evictions; free per-line textures when the line is two lines old.
- **Verify:** T3 shows hit rate and bytes; a 30-minute soak with a looping demo keeps GPU memory flat (within 10%).

### V9. Sketch cards paint on the CPU at line start
- **Evidence:** a card is a 360x270 Canvas 2D paint, a blur, and a per-pixel palette snap with `getImageData` (`sketch.ts` `paintBase`, `snap`), plus one such pass per word; it happens the first time a line is shown. The time it takes is **not measured**.
- **Impact:** a possible frame drop on every line change in this style, worst on slow CPUs and long lines.
- **Fix:** measure first (T3). If it is over a few milliseconds: prefetch the next line's card during the previous line using `requestIdleCallback`, spread the words over several frames, or move the painting to an `OffscreenCanvas` worker.
- **Verify:** the longest frame at line starts, before and after.

### V10. Scene loops and typing are not tied to the song
- **Evidence:** the acid eye loop is a fixed 7 s (`CYCLE`), the ASCII eye loop a fixed 26 s (`LOOP`), blink times are constants, typing windows are fractions of the line (`typedChars` calls), and the streak speeds are constants.
- **Impact:** a fast song and a slow ballad move at the same pace; the dances never align with the bars.
- **Fix:** scale loop periods and speeds by tempo (from P1) and by the song's energy; lock loops to bar boundaries when a grid exists; derive typing speed from the line's duration and word count, with sensible bounds for very short and very long lines.
- **Verify:** unit tests of the scaling functions; golden frames at two tempos.

### V11. Weak visuals in intros, breaks and outros
- **Evidence:** with no line, code screens drift at 55% alpha, sketch shows an empty card, the lyrics app shows only the background and streaks; Liquid has a designed interlude show. Intro length in the demo is about 4.3 s, real songs have 10-60 s breaks.
- **Impact:** long instrumental sections look unfinished in the scenes; no title or artist card appears anywhere.
- **Fix:** design an idle state per scene: code (scrolling code with comments for the section, a progress bar), sketch (cards drawing themselves, title card), lyrics app (now-playing card with cover and title), acid and ASCII (title typed on the screen); a title card at the start and the credits at the end; keep each cheap.
- **Verify:** golden frames at an intro, a break and an outro (T1).

### V12. No per-style controls in the Studio
- **Evidence:** the Studio's Mode section offers only the style chips (`ModePicker.tsx`); every constant in `docs/turbo-styles.md` is fixed.
- **Impact:** the owner cannot make a style calmer, faster, grainier or pick which screens appear.
- **Fix:** a small **options schema per style** (Zod, persisted per song, resettable one by one, honoured by export): code screens (which shots, typing speed), sketch (theme set, doodles on/off, letter jitter), lyrics app (mesh, nebula, or both; column length), acid (grain, eye density, hue speed), ASCII (picture, cell size, character ramp), plus common (intensity, calm).
- **Verify:** schema tests; reset and persistence tests; export uses the same options.

### V13. Only 16:9 and 9:16 were tuned
- **Evidence:** scenes were checked at 1280x720 and 720x1280; export offers 1080p, 720p, vertical, 4:5 and 1:1; the stage can be any window shape; no safe areas for social app overlays.
- **Impact:** layouts may crowd or leave empty bands at 21:9, 1:1, 4:5 and tiny phone windows.
- **Fix:** layout tests at six aspect ratios, a `safe` rectangle in the host (bottom 12% and top 10% reserved for vertical exports), and per-scene min and max sizes.
- **Verify:** golden frames at 21:9, 16:9, 4:3, 1:1, 4:5, 9:16.

### V14. Fonts: first frame and payload
- **Evidence:** scene fonts are loaded in `loadFonts` before use and sprites painted with a fallback face are cleared (`clearSprites`); `app/layout.tsx` imports many families and weights (Anton, Archivo, Bangers, Bebas Neue, Cormorant, DM Serif, Inter, JetBrains Mono, Nunito, Permanent Marker, Playfair, Instrument Serif, Space Grotesk, Special Elite, Syne, Noto Devanagari and Tamil). The transfer size is **not measured**.
- **Impact:** a first frame in a fallback face if a font is slow; a heavy first load.
- **Fix:** a readiness gate (draw the first frame faded or hold the previous one until the scene's fonts are ready); preload only the faces the current style needs; subset or lazy-load the rest (script faces already load on demand).
- **Verify:** measured first-load transfer before and after; a test that no frame is drawn with a fallback face (compare fonts used with fonts loaded).

### V15. Accessibility of the stage
- **Evidence:** all lyric text is drawn on a canvas; there is no live text alternative, no text size control for the scenes and no high-contrast mode (Clean's contrast guarantee does not extend to the scenes).
- **Impact:** screen reader users get nothing; low-vision users cannot enlarge the text.
- **Fix:** a visually hidden `aria-live="polite"` region with the current line (throttled, off by default for speech spam, toggle in Settings); a text size multiplier honoured by every scene; a high-contrast variant (solid ground, large plain type); keyboard shortcuts for the stage listed and focusable; an optional dyslexia-friendly face for the plain-type modes.
- **Verify:** axe checks in the browser loop; a manual screen reader pass (owner, T4).

### V16. Hard pop between a line and the idle state
- **Evidence:** `lineAt` returns `null` after `endMs + 900` or at the next line's start minus 30 ms; scenes switch from the line to their idle look in one frame.
- **Impact:** a visible pop when a line ends with a gap before the next.
- **Fix:** an idle crossfade (200-300 ms) in each scene; shared helper `idleMix(line, t)` returning 0..1.
- **Verify:** golden frames around a line end; no frame-to-frame change above a threshold except at cuts that are designed (whips).

### V17. `renderer.ts` and `frame.ts` are too big
- **Evidence:** `lib/kinetic/gl/renderer.ts` 1,462 lines (liquid pipeline, scene host, artwork, text, post, bloom, ASCII in one class); `lib/kinetic/frame.ts` 1,333 lines.
- **Impact:** slower to understand and risky to change; every agent has to hold it all in mind.
- **Fix:** after T1 exists, split the renderer into modules (artwork, text and glyph cache, post and bloom, scene host, liquid) with no behaviour change; split `frame.ts` into layout, entrances and exits, and overlays. Move one piece per commit and run the golden tests each time.
- **Verify:** golden frames identical (zero diff) and all tests green after each move.

### V18. WebGL context loss drops to Clean for good
- **Evidence:** `LyricStage.tsx` falls back to Clean if the context is lost for more than 2.5 s; `TurboRenderer.onRestored` rebuilds resources and `sceneProgs` is cleared, but the stage does not go back to Turbo when the context returns.
- **Impact:** a GPU hiccup (driver reset, switching the GPU) permanently downgrades the session.
- **Fix:** keep trying to restore (listen for `webglcontextrestored`), return to Turbo automatically with a one-line notice; count losses and stop after three.
- **Verify:** an automated test using `WEBGL_lose_context` (lose then restore) in the browser loop.

### V19. Export runs on the main thread; no safe-area presets
- **Evidence:** `lib/export/video.ts` renders and encodes on the main thread and yields every sixth frame with `MessageChannel`; export sizes are fixed (`EXPORT_SIZES`). Short test exports of the sketch and ASCII styles worked (4 s at 1080p); their duration was not timed, and full-length songs at vertical 1080x1920 are **not measured**.
- **Impact:** the UI is sluggish during long exports; no guidance for social safe areas.
- **Fix:** measure a full-length export per style; if needed move rendering to a Worker with `OffscreenCanvas` (WebGL2 works in workers in Chromium), keeping the canvas fallback; add presets that apply the safe area from V13; show an honest time estimate; allow cancel and resume.
- **Verify:** export time and UI responsiveness (longest main-thread task) before and after; output frames identical to the stage (golden diff).

### V20. Styles are code, not data
- **Evidence:** every style is a TypeScript function plus constants (`gl/scenes/*`).
- **Impact:** nobody can share a look; adding a style needs a developer.
- **Fix:** after V12 defines per-style option schemas, export and import **look files** (JSON: style id, options, palette slots) so people can share; later a small declarative scene format for simple styles.
- **Verify:** round-trip tests; a malformed file is rejected by Zod with a readable message; no code is ever executed from a look file.

---

## 5. Tooling and tests (T)

### T1. Visual regression tests (P0)
- **Evidence:** the tests directory has logic tests only; the scenes were verified by hand with the browser loop in `AGENTS.md` section 6.
- **Impact:** any change to a shader, the host or the post pass can silently break a style; every later item in this plan depends on being able to see that nothing else changed.
- **Fix:** a **golden-frame harness**: a Playwright test renders a fixed set of moments (start of line, mid-typing, line end, an idle moment, an intro) for each style at 1280x720 and 720x1280 on the demo timeline plus fixtures in other scripts, reads the canvas, and compares with stored PNGs by perceptual hash and a mean-error threshold (tolerant to GPU differences; stored per backend if needed). Small PNGs under `tests/golden`, an `--update` command, and a diff image on failure. Add a determinism check (same `t` twice gives identical pixels).
- **Verify:** it fails when a colour constant is changed and passes on a clean run, on the integrated GPU and under SwiftShader.

### T2. Stabilise the browser suite (P0)
- **Evidence:** `docs/feature-tracker.md` final verification: the complete browser suite passed 14 of 16 with demo playback elapsed-time and Settings timeout failures; both passed on rerun; a full unit run once stalled for hours in an FFmpeg test.
- **Impact:** flaky gates teach people to ignore failures.
- **Fix:** find the cause (demo audio start timing under load, Settings page cold compile) and replace sleeps with condition waits; give the FFmpeg render test a proper timeout and an `it.concurrent` isolation; run e2e against a production build in CI.
- **Verify:** 20 consecutive full runs green.

### T3. In-app performance overlay, hitch log and soak test (P0)
- **Evidence:** the only timing tool is `renderer.bench()` via the dev hook; there is no frame-pacing view, no long-frame log, no memory counter (`syncDiag` covers sync only).
- **Impact:** performance claims (including every "should be faster" item above) cannot be checked in the owner's real environment.
- **Fix:** a `?perf=1` overlay: frame time (median, p95, worst), refresh interval, quality level, texture count and bytes, cache hit rate, current style, shot, subject, line; a ring buffer of frames over 33 ms with their cause (first use of a program, a texture paint, GC); a "copy report" button for the owner; a scripted 30-minute soak using the demo loop that records memory.
- **Verify:** the overlay matches `bench()` within 10%; a soak report with flat memory.

### T4. Real hardware and real ears (owner)
- **Evidence:** `AGENTS.md` section 10: the RTX 5050 and high-refresh displays have not been measured; audible Spotify sync and live library access need the owner's account; Hindi and Tamil need a native reader.
- **Needed from the owner:** run the T3 overlay on the RTX 5050 (Windows Graphics settings: set Edge to high performance) at 60 and 144 Hz and send the copied report; audible check of sync with two outputs including Bluetooth after P2 and P3; a Spotify Premium session; a native reader for Hindi and Tamil scene text after V4.

---

## 6. The game plan (phases)

Sequencing follows risk: protect people, make everything measurable, then improve smoothness, then make visuals song-aware, then widen reach, then calibrate and clean up.
Effort sums are guides, in focused working sessions: S = 0.5, M = 1.5, L = 4.

### Phase 0: safety and a way to see (about 9 sessions)
Items: **V5, T1, T3, T2**, with the calm plumbing of **V6**.
Order: T3 (so every later claim is measurable) -> V5 (safety, uses T3's frame readback for the analyser) -> T1 (golden harness; include the flash analyser as a test) -> V6 -> T2.
**Exit criteria:** the flash analyser proves at most 3 flashes a second on a worst-case minute in every style; golden frames exist for all six styles at two aspect ratios; the overlay reports frame time, memory and hitches; V6's calm frames pass; the browser suite is green 20 times in a row.

### Phase 1: smooth and honest playback (about 12 sessions)
Items: **P6, P5, V8, V7, V9 (measure and fix if needed), P4, P7, V18, P8**.
Order: P6 (frame budget relative to refresh) -> V8 (pools) -> P5 (warm-up and prefetch) -> V7 (ladders) -> V9 -> P4 and P7 together (confidence-aware visuals and the badge) -> V18 -> P8.
**Exit criteria:** no frame over 50 ms in the first 3 s after a style switch or track change on the integrated GPU; hit rate above 95% with flat memory in a 30-minute soak; the governor holds 30+ fps under software rendering; estimated-word lines use the soft mode; the badge and the seek state work.

### Phase 2: visuals that know the song (about 15 sessions)
Items: **P1, V1, V2, V10, V3, V11, V16**.
Order: P1 (tempo) -> V1 (palette slots; the biggest visible change) -> V2 (per-song style and Auto) -> V10 (tempo-aware loops) -> V3 -> V11 and V16 (idle states and crossfades).
**Exit criteria:** on Spotify a tempo estimate or a tap gives a visible, aligned pulse; six sample covers produce six distinct looks in every scene, all passing contrast checks; the style is remembered per song and Auto explains itself; long instrumental sections have a designed look; no pops at line ends.

### Phase 3: reach and control (about 12 sessions)
Items: **V4, V12, V13, V14, V15**.
Order: V4 (languages the owner cares about) -> V12 (controls and schemas; V20 builds on this) -> V13 -> V14 -> V15.
**Exit criteria:** Hindi, Tamil, Arabic and Japanese fixtures render correctly in every scene and are confirmed by a native reader; every style has options that persist per song and apply to export; six aspect ratios pass the golden suite; first-load font transfer is smaller and no frame uses a fallback face; the stage has a live text option and a text size control.

### Phase 4: calibration, export and structure (about 18 sessions)
Items: **P2, P3, T4, V19, V17, V20**.
Order: P2 and P3 (calibration and device memory) with the owner's hardware test (T4) -> V19 (export) -> V17 (refactor, only with golden tests green) -> V20 (look files).
**Exit criteria:** a first-run calibration produces a delay that the owner confirms by ear on two outputs; switching output devices applies the stored delay; a full-length export finishes without freezing the UI and matches the stage frame for frame; `renderer.ts` is split with zero golden-diff; look files round-trip.

**Total:** about 66 focused sessions if done in full (the sums of the item efforts above; an estimate, not a commitment). The first two phases (about 21 sessions) deliver most of the felt quality; the owner can stop after any phase and have a coherent app.

---

## 7. Success measures (what "better" means)

| Measure | Target | How measured |
|---|---|---|
| Flashes per second, worst case | at most 3 in every style | automated analyser (V5/T1) |
| Longest frame in the first 3 s after a style or track change | under 50 ms on the integrated GPU | T3 hitch log |
| Frame time p95, 1080p, integrated GPU, any style | under 16.7 ms; p95 on the RTX 5050 under 8.3 ms | T3 overlay; owner for the RTX 5050 |
| Frame pacing at 144 Hz | no more than 2% of frames over 1.5x interval | T3 histogram (owner display) |
| Texture cache hit rate and memory over 30 minutes | above 95% and flat within 10% | soak report |
| Median lyric sync error after calibration | under 60 ms | owner test with the sync diagnostics |
| Tempo estimate accuracy on fixture songs | within 3% and correct phase on 8 of 10 | unit tests (P1) |
| Estimated-word lines: abrupt per-word events | none | test (P4) |
| Golden suite | 6 styles x 6 aspects x 5 moments, green, zero unexplained diffs | T1 |
| Browser suite | 20 consecutive green runs | T2 |

---

## 8. Tracking (tick when shipped; write the measured result)

- [ ] V5 flash governor and safe switch: ___
- [ ] T3 performance overlay, hitch log, soak: ___
- [ ] T1 golden-frame harness: ___
- [ ] V6 calm variants: ___
- [ ] T2 stable browser suite: ___
- [ ] P6 refresh-relative governor and frame cap: ___
- [ ] V8 pinned and transient texture pools: ___
- [ ] P5 warm-up and prefetch: ___
- [ ] V7 per-scene quality ladders: ___
- [ ] V9 sketch card cost measured (and fixed if needed): ___
- [ ] P4 confidence-aware visuals and tap-along: ___
- [ ] P7 timing badge and per-line nudge: ___
- [ ] V18 automatic return to Turbo after context loss: ___
- [ ] P8 seek and buffering states: ___
- [ ] P1 tempo: tap, lyric-derived estimate: ___
- [ ] V1 palette slots from the song: ___
- [ ] V2 per-song style and Auto: ___
- [ ] V10 tempo-aware loops and typing: ___
- [ ] V3 ASCII picture picker and override: ___
- [ ] V11 idle, intro and outro designs: ___
- [ ] V16 idle crossfade: ___
- [ ] V4 complex scripts in scenes: ___
- [ ] V12 per-style Studio options: ___
- [ ] V13 aspect ratios and safe areas: ___
- [ ] V14 font readiness and payload: ___
- [ ] V15 stage accessibility: ___
- [ ] P2 latency calibration: ___
- [ ] P3 per-device delay and device-change handling: ___
- [ ] T4 owner hardware and ears pass: ___
- [ ] V19 export off the main thread and presets: ___
- [ ] V17 renderer and frame split: ___
- [ ] V20 look files: ___

---

## 9. Risks, rules and what we will not do

- **Rights:** no analysis of Spotify audio for tempo or anything else (P1 uses lyric timing and the user's taps only); no copying of reference clips beyond layout, type, colour, effects and pacing (`AGENTS.md`); look files carry data only, never code (V20).
- **Safety first:** V5 ships before any new effect is added; new strobing or flashing elements must go through the FlashGovernor.
- **Honesty:** estimated tempo and estimated words are labelled as estimates in the UI; low confidence turns the feature off rather than showing a wrong beat.
- **Determinism:** every new feature stays a pure function of time and the frame; calibration values change `lyricTime`, never the renderer.
- **Regression control:** from the moment T1 exists, any change to rendering code must keep the golden suite green or update the goldens with a written reason.
- **Scope control:** Phase 4 items (the refactor, the worker export, look files) are not started until Phases 0-2 exit criteria are met, unless the owner reorders them.
- **Not planned:** AI-generated imagery, scraping lyrics sites, mixing or recording Spotify audio, cloud features (still deferred), a native app.
- **Dependencies on the owner:** hardware measurements and ear tests (T4), a Spotify Premium session, native readers for Hindi and Tamil. The plan marks which items cannot be signed off without them.
