# Implementation log

Local-first build, no Supabase / Vercel / R2 / Inngest. Everything runs on one machine with `pnpm dev`.

## Verification at the time of writing

| Check | Result |
|---|---|
| `pnpm lint` | clean |
| `pnpm typecheck` | clean |
| `pnpm test` (Vitest) | 198 tests, 11 files |
| `pnpm build` | succeeds |
| `pnpm test:e2e` (Playwright, Edge) | 4 smoke tests against the production build |
| `pnpm smoke` (`scripts/smoke-party.mjs`) | 39 HTTP checks (party flow, signed URLs, SSE, CSRF) |
| `npx tsx scripts/smoke-recap.ts` (needs web + worker) | 30+ checks: plan -> edit -> render -> download -> ffprobe |

**Not verified:** real Spotify playback. It needs your Client ID and a Spotify account, which this build does not have.
The OAuth/PKCE flow, token refresh, error mapping (401/403/404/429) and track mapping are unit-tested with mocked
HTTP; the Web Playback SDK and Connect polling have not been exercised against Spotify itself.

## Milestones

### Follow-up: saved sync offsets and direction labels

- Song-offset reads now carry revisions so an older asynchronous read cannot overwrite a correction made since that read began. Editing the value also updates the lyric clock's correction immediately. Invalid stored or entered nonfinite values are ignored.
- The stepper's earlier/later descriptions now match the clock equation: plus advances the lyrics, minus delays them. The numerical offset convention is unchanged. The song-offset hint states that zero is the default and saved values are corrections, not measured Spotify latency.
- Edge regression check: save 209 ms, confirm it reached IndexedDB, release deliberately delayed reads containing 3000 ms, and verify that 209 remains. The same test checks that Earlier changes it to 259 and Later returns it to 209. This test passes at desktop/phone widths. It establishes the race fix, not the origin of the owner's particular saved value.
- Typecheck, lint and production build pass, with the existing filesystem-tracing build warning. Full unit run: 802 passed, 1 skipped and the existing social notification sort flake failed. Live account offset storage was not inspected or modified by this check.

### Follow-up: automatic browser clock selection and current documentation

- Browser playback detected through the active Spotify device now uses local SDK position in follow mode as well as explicit browser-output mode. It does not first apply an aged API position and then snap back to the SDK position. When that automatically followed browser playback moves elsewhere, the backend returns to remote-device reports.
- The Sync panel shows the actual clock source and explains why estimated word motion on line-synced files can lead or lag, then reset at the next line. No lyric estimates, source timestamps or saved offsets were changed. The owner's report on a line-synced song is evidence of a symptom, not a measured diagnosis of its cause.
- README now documents the implemented local build. The original cloud-oriented specification is preserved in `docs/original-product-spec.md`. Architecture now covers browser/server storage, processes, clock selection, lyric provenance, scene/export boundaries and known audit gaps.
- Verification: 46 focused clock/playback/regression tests pass. Full suite: 802 passed, 1 skipped and the documented social notification-ordering flake failed. Typecheck, lint and production build pass (the build retains its existing filesystem-tracing warning). The Spotify Edge e2e test passes, including the actual-clock label and line-timing explanation. Sync panel screenshots were inspected at 1280x900 and 390x844. All 23 local links in README, architecture and the archived spec resolve, and a comparison confirms that the original specification text was preserved apart from its relocated links. Live audible sync remains unmeasured in this review.

### Spotify browser playback and sync position

- Explicit browser output selection in Settings, Listen's Spotify tab and Now Playing. Transfers to the Lyricscape SDK device, keeps subsequent track starts and transport commands on that device, and offers a return to following the active Spotify device. A failed transfer does not change the output choice.
- Volume, percentage and mute controls work at phone widths as well as desktop widths. The browser remembers the volume supplied before SDK initialization and reapplies the selected level after transfer or starting a track.
- While browser output is selected, the playback clock reads local SDK state every second in the foreground, without using the Web API's server timestamp or changing the remote-device age formula. Missing local playback freezes the clock. Epoch guards reject requests that predate commands, including empty responses. No lyric timestamps, estimates or stored sync offsets changed.
- Confirming live playback after a session restore clears the pending saved track, so Play resumes the live position. The seek slider updates immediately on player commands instead of restoring its old value and sending a second seek backward.
- Verification: typecheck and lint pass; production build succeeds with the existing dynamic-filesystem tracing warning in `lib/server/config.ts`. Eleven new unit tests cover routing, transfer failure, volume/mute, local position under clock skew, delayed SDK responses after seeking, empty remote responses, session restore and missing browser playback. Final full unit run: 800 passed, 1 skipped, 1 failed (the already-documented same-millisecond social notification sort flake). All 15 Edge e2e tests pass, including browser output selection, volume/mute, pause/resume and seeking. Settings and Now Playing screenshots were inspected at desktop and phone widths with mocked Spotify state; no page errors or horizontal phone overflow. The disconnected setup test now explicitly clears the public Client ID field instead of assuming `.env.local` is unconfigured.
- Real Spotify playback, Bluetooth output delay and audible lyric sync: not measured. Browser output selection resets on reload. Lyric source/version errors and estimated word timing still need song-specific review through the Sync panel.

### M0 Foundation
- Next.js 16 App Router, TypeScript (strict), Tailwind 4, Zod, Zustand. Dark app shell, six-route nav, persistent mini-player.
- Provider abstraction (`lib/types.ts`, `lib/player/providers.ts`) with a capability registry that *explains* disabled features.
- Local data layer behind repositories (`lib/server/db.ts`, JSON file, atomic writes) instead of Supabase. See `architecture.md`.
- Original CC0 demo audio, timed lyrics and artwork are generated by `scripts/generate-demo-audio.mjs`.

### M1 Player + Spotify
- `PlayerController` state machine, app-level queue (`lib/player/queue.ts`), `PlaybackClock`, Media Session, keyboard shortcuts, multi-tab guard, session restore.
- Local files: tags via `music-metadata`, SHA-256, cover extraction, IndexedDB storage, drag-and-drop import, `.lrc` sidecars.
- Spotify (`lib/spotify/*`): PKCE in the browser (no client secret), refresh, Web API wrapper with `Retry-After` handling, Web Playback SDK device, and **follow mode** (lyrics track whatever is playing on any device; no Premium needed to read playback).
- Lyrics for any track (including Spotify): saved locally, optional LRCLIB lookup (API, not scraping), paste/import, timing editor with undo/redo and tap-to-stamp.

### M2 Kinetic visualizer
- `lib/kinetic`: compile lyrics to a deterministic timeline, `computeFrame(timeline, t, viewport)` is a **pure function**, so seeking to any timestamp reproduces the exact frame. Six styles, rule-based motion director (hooks -> burst + inverted background, fast passages -> single-word cuts, sustained words -> elastic stretch, instrumental gaps -> a generative "interlude" show), reduced-motion and readable-lyrics modes, flash limiter.
- Canvas 2D renderer. Album art is used only as a blurred, palette-matched background (Spotify art-modification policy waived for personal use).

- Mood-aware look: lexicon+tempo emotion detection per line, album palette extraction, color modes (Blend / Album / Mood), emoji stickers keyed to lyric words, 18 original vector doodles, one shared sync delay across songs (per Spotify / local) with a per-song option.

### M3 Party core
- Roles (host / cohost / member / guest), hashed + expiring + revocable invites, passcodes (scrypt), event-bound guest tokens, fair queue ordering, duplicate detection, voting, moderation, bans, reports, audit log.
- Direct uploads via short-lived signed URLs, magic-number sniffing, size/count/storage limits, abandoned-upload sweeper, retention sweeper.
- Realtime via Server-Sent Events with sequence numbers, snapshot-on-reconnect, presence.
- Big-screen mode with a signed display token (approved media only) and a QR invite.

### M4 DJ + recaps
- `lib/recap`: FFT/STFT, onset strength, tempo (autocorrelation + prior), Ellis DP beat tracking, downbeat phase (bass accents + harmonic change), sections (self-similarity novelty), highlight windows. Verified against the synthesized songs: tempo within 0.01 BPM, beats within 3 ms.
- Media scoring (Laplacian blur, exposure, dHash dedupe), beat-aware planner, editable versioned timeline, FFmpeg command builder.
- Separate worker process (`pnpm worker`) over HTTP with a shared secret: claim, heartbeat/lease, retries with exponential backoff, cancel, idempotent renders.

### M5 Music map
- Opt-in, foreground-only capture, coordinates snapped to a grid cell (the exact point is never stored), privacy zones, retention, export, delete (spot / place / everything), memories with time capsules, trips -> soundtracks. MapLibre with an offline Natural Earth basemap.

### M6 Social
- Friends, blocks, Song of the Day (once per day), direct recommendations, reactions, notifications, chronological feed, profiles. One `canView()` function guards every read.

### M7 Lyric sync, themes and artwork
- **Sync for Spotify is metadata-based, on purpose.** Spotify exposes no audio (DRM stream, audio-analysis API closed to new apps, and `spotify-compliance.md` forbids processing it), so lyrics are matched by title / artist / length against LRCLIB and follow the playback position. `lib/lyrics/match.ts` ranks every candidate (title, lead artist, length within a few seconds, synced over plain); `/api/lyrics/lookup` gathers exact + fuzzy results, survives a flaky secondary search, and takes `exclude` so the stage can offer **Try another version** when a recorded timing drifts. Auto-lookup now defaults to on (Settings -> Lyrics turns it off; only title, artist and length are sent).
- Word timing inside line-synced LRC uses syllables (`lib/lyrics/words.ts`) and stops a line from stretching across an instrumental gap; pasted lyric sheets drop `[Chorus]` headers and `(x2)` markers and give longer lines more time.
- Tried and dropped: aligning lyrics to the audio with a vocal-activity detector. It cannot tell a loud band from a voice, so its confidence was misleading. Real forced alignment would need a speech model and audio we are allowed to read (local files only).
- Six new visual styles (Neon noir, Vaporwave, Retro VHS, Notebook, Aurora, Pop art): new background kinds, glow / colour-split / hard-shadow / highlighter / gradient text treatments, per-style cover-wash strength, and a quiet **next-line preview** under the lyrics in every style.
- `lib/artwork/generate.ts`: original deterministic cover art in six styles (sunset, bauhaus, contour, waves, orbit, mesh). Regenerates the demo covers and is the fallback cover (library, player, stage backdrop, palette) for any track without one.

### M8 Sync accuracy, motion, auto themes, stage panel
- Pace-aware word estimator for line-synced lyrics (held-out within-200 ms 52.6 % vs 46.5 % before; words >300 ms late 24.4 % vs 36.5 %), animation landing tuned (`drop` +350 -> +180 ms), version-outlier guard, opt-in sync diagnostics. Evidence, numbers and limits: `docs/lyric-sync-motion.md`.
- Genre / pace / mood / cover based auto theme with per-song pin (`lib/kinetic/themeSelect.ts`), Gloss and Film styles, per-style decoration level, layout-overlap guarantees, a Look/Sync stage panel (tap-to-anchor, nudge, per-song offset), generated cover fallback.
- Not claimed: "perfect sync". Not measured: real Spotify playback lag, the source offset of real LRC files, audible feel.

### M9 Artistic direction V3: song identity, art directions, Visual Studio
- Song Visual Identity (`lib/identity`): independent emotional dimensions with confidence and sources, ambiguity, delivery, lyric stats, tag-derived genre/subgenre, provenance and an explicit list of what cannot be known. Optional, schema-validated, cached AI reading (confidence capped); MusicBrainz tag fallback.
- Ten composed art directions (`lib/theme`, `lib/kinetic/directionStyles.ts`) incl. three R&B ones (Velvet, Ether, Nocturne): deterministic choice with reasons, contrast floors enforced at composition time, artwork treatments, per-direction motion personality, colour hierarchy, held-word illumination.
- Studio panel: identity card with corrections, direction cards, full customisation with per-control reset, saved themes, per-family defaults. `/looks` gallery and bench. Measured draw cost <= 13.7 ms at 1080p on integrated graphics. Details: `docs/artistic-direction-v3.md`.

### M10 Custom icons, Cover Pop mode, dedicated-GPU awareness
- 48 original vector icons replace every emoji (canvas sprites + React `<Icon/>` from one path table); a test forbids emoji in app source.
- Cover Pop: full-bleed undimmed cover, rounded italic phrase-by-phrase type, per-word colour chosen against the pixels behind it, white chips, icons. A choice, never automatic.
- Settings/Studio show which GPU draws the lyrics; `pnpm open:gpu` launches the browser on the dedicated one (a page cannot choose). Details and numbers: `docs/artistic-direction-v3.md` section 11.

### M11 Integration: lyric-video export and unbounded sync merged with the V3 looks
- Merged `feat/local-first-build` (lyric-video export, sync stepper, interlude/texture options, shared `compileForTrack`) into the art-direction work. The exporter renders with the song's own Look (Cover Pop included; the dialog defaults to the stage's direction and can switch), waits for the look's typefaces before the first frame, and compiles with the stage's estimated-words switch so video and screen agree. The Studio Sync tab uses the unbounded stepper (no +/- 3 s cap; the nudge, anchor and keys are uncapped too).
- No separate "clean graphics" branch existed on the remote when this was merged; Clean / Turbo modes are still to do.

## Deliberate deviations from the README

See `architecture.md`. In short: JSON store instead of Postgres, SSE instead of Supabase Realtime, local signed storage instead of R2,
Node worker instead of Python (no Python on this machine), Canvas 2D deterministic engine instead of GSAP timelines, dip/flash transitions instead of xfade.

## Known gaps / next steps

- Real Spotify run-through (needs credentials).
- Cloud adapters: Supabase (Auth + Postgres RLS), R2, Inngest. The repository boundaries (`lib/server/*.ts`) are where they plug in.
- No React Three Fiber/shader layer yet; the Canvas engine covers grain, halftone, masks, echo, split and parallax.
- Crossfades between clips (xfade), face-free "activity" scoring for video, Demucs/WhisperX are not implemented.
- Multi-user listening rooms and concert memories (P2/P3) are not implemented.
- Accessibility pass is partial (keyboard + reduced motion + ARIA on custom controls); no screen-reader audit yet.

## Performance notes (visualizer)

Measured with `renderer.bench()` (forces a GPU flush) on a software-rendered browser, hook scenes, maximalist: **253 ms -> 17 ms per frame**.
The cost was never the doodles; it was colour-emoji glyphs re-rasterised at a new size every frame (~180 ms), a blend-mode film-grain overlay (~20 ms),
per-word blur filters and shadowBlur, and a giant repeated marquee string. Fixes: cached emoji sprites, cached marquee strips, grain/halftone baked with alpha
and painted with plain source-over, one-call scanline/grid strokes, cached text measurements, and a device-pixel budget (DPR is capped, so 4K fullscreen is bounded).
`FrameGovernor` (lib/kinetic/governor.ts) lowers quality automatically when the median frame interval exceeds ~24 ms (high -> medium -> low: fewer doodles/emoji, no grain/halftone/marquee, lower DPR)
and only recovers after 25 s of smooth frames. Settings -> Performance: auto / high / balanced / light. The timing editor's lyric rows are memoised so only the active word re-renders.

Album art is a soft, blurred background wash (never a card). When there is no singing (intros, breaks, instrumentals, or songs with no lyrics) the stage runs an interlude show instead: aurora lights, beat rings, ribbons, particles, orbiting doodles, a mood emoji and a title marquee, all in the cover palette and cheaper than a lyric frame (~6 ms vs ~6 ms in headless Edge).
Cover cues used: dominant colors, brightness (bright covers get a bright ground), focal point (glow + doodle gathering).

## Lyric-video export (no audio)

`lib/export/video.ts` + `components/visualizer/ExportDialog.tsx`. Because `computeFrame(timeline, t)` is pure, export steps `t` at a fixed fps (not real time), draws each frame on an off-screen canvas at the exact output size, and encodes with WebCodecs through `mediabunny` (MP4/H.264 or WebM/VP9; Chromium browsers only). Options: size (16:9, 9:16, 4:5, 1:1), 30/60 fps, quality, song-time range (with "trim to lyrics"), style, color source, mood, and toggles for emoji, doodles, album background, the breaks show, grain/texture and calm motion. PNG stills use the same path. The cover is re-loaded with CORS for export (a tainted canvas can't be encoded); if the host refuses, the file is produced without the album background. The timeline for both the live stage and the exporter is built by `lib/kinetic/forTrack.ts`.

The sync control is now − / + buttons (50 ms per step, hold to repeat) around an editable millisecond value, with no range limit.

## Stage modes, Turbo, other languages (see docs/stage-modes.md)

Clean (Canvas 2D, the art-direction philosophy) and Turbo (WebGL2, every layer on the GPU) share one pure `Frame`; Hindi, Tamil and nine more languages
(script faces, no letter spacing, word segmentation, RTL mirroring, transliteration for matching, mood word lists, honest limits); 17 entrances,
11 exits, speed and line-start effects in the Studio; export applies the song's sync offset; the next-line preview is gone.

## Song index and audio analysis (2026-11-02)

- **Analysis** (`lib/analysis/*`, tests/audio-analysis.test.ts, 13 tests): radix-2 FFT; spectral-flux onset strength weighted toward the bass; tempo by comb-style self-similarity with a preference for 80-160 BPM and a regression refinement; beats by dynamic programming (Ellis) that keeps the pulse through gaps; a streaming `FeatureTrack` that accepts pieces tagged with their song position, tolerates gaps and merges later plays; a gain stage for quiet captures. Recovers 90, 120, 128 and 140 BPM synthetic pulses within 1.2 BPM and 35 ms median phase, at 44.1 and 48 kHz, and invents no tempo from noise or silence.
- **Index** (`lib/server/songIndex.ts`, `app/api/index/*`, tests/song-index.test.ts, 12 tests): SQLite via `node:sqlite` in `~/.lyricscape`; round trip, restart, fingerprint sharing, schema and size rejections, cross-site rejection.
- **Use:** cover colours read from the index (no re-extraction), lyrics mirrored in and restored from the index when the browser has none, the learned beat grid feeds the stage and export; `AudioIndexer` learns songs in the background; Settings -> Song index shows stats, the local-import switch, the listening control and clearing.
- **Measured in Edge:** analysing the 53 s demo song took 2.7 s; the stored record is 4.4 KB; a second play reads "Already indexed" and writes nothing; the stage timeline carried the learned grid (111.91 BPM, 98 beats); palette and lyrics round-tripped through the index.
- **Found the hard way:** a SQLite file inside the project folder made `next dev` rebuild and reload the page in a loop, hence `~/.lyricscape`. `process.getBuiltinModule` is needed to load `node:sqlite` inside the Next server bundle.
- **Tried on real recorded music (2026-11-02):** the audio of the owner's five reference clips, extracted locally (never committed or stored; only numbers). Offline analysis: Flashing Lights reel **90.4 BPM** (known 90), Let It Happen reel **125.0** (known 125), We Are The People reel **123.1** (known 126; the clip may be speed-edited), all confidence 1.0, 65-200 ms per clip. **Listening through tab capture** (the same audio played in the browser and heard through `getDisplayMedia`, the route a Spotify song would use): **124.9, 90.0 and 123.1 BPM at confidence 1.0, the same as the file analysis.** The captured beats ran 140-145 ms behind the beats found in the file (the capture pipeline's latency); shifting each block back by `CAPTURE_LATENCY_MS` = 140 ms puts them within 18-22 ms of the file's beats (100% within 50 ms). That constant was measured on one machine (Edge on Windows, tab capture). **A first test of this reported the capture as too quiet and degraded: that was a test-harness mistake** (`--use-fake-ui-for-media-stream` makes `getDisplayMedia` return a fake stream; a 440 Hz tone at 0.5 came back as noise until the flag was removed). **System-audio capture** (Settings -> Listen to the computer's sound) could not be tried here: Chrome's picker needs a person to tick "Also share system audio", and without it the app shows its instruction message. **Still not tried: a real Spotify session** (needs the owner's Premium login).
- **Not verified / known gaps:** listening to real Spotify audio (see `docs/visuals.md` P1); the learned grid is not shifted by the per-song lyric offset; index lyrics copies do not keep the match info; no tap tempo yet; no background indexing of the whole local library in one go (songs are learned when played). `tests/social.test.ts` (recommendations visibility) failed in 2 of 4 isolated runs and passed in the full suite: it looks like a pre-existing ordering flake, unrelated to this work, not investigated.

## Tempo without audio: tap, lyrics, lookup, system audio (2026-11-02)

One resolver (`lib/analysis/tempoSources.ts` `resolveBeatGrid`) picks the beat grid for a song with none of its own: **tapped** (kept in its own `tap` index record so forgetting the taps restores the rest) > **learned** from audio > **looked up + lyrics** > **lyrics alone**. The stage panel's Sync tab has a Beat section that says which and lets you tap.

- **Tap tempo** (`tapEstimate`, 5 tests): at least four taps; a pause of more than 2.5 beats starts over; taps far off the fitted grid are dropped; least-squares fit of tempo and phase. From simulated 120 BPM taps with 30 ms jitter it recovers the tempo within 0.8 BPM and the phase within 25 ms. The panel offers x2, /2, a 20 ms nudge either way, and "Forget my taps".
- **Tempo and phase from lyric timing** (`lib/analysis/lyricTempo.ts`, 4 tests): onsets are line starts and authored word starts scored against a quarter-beat grid, each candidate by how far it beats chance on that grid; the confidence is how far the best candidate stands above the best of the same onsets slid at random. **Measured on real lyrics, honestly:** with a known tempo the *phase* of word-synced Flashing Lights (Musixmatch, 349 onsets) was found at confidence 0.76; on the demo song (lines on bars) 1.0. With the tempo unknown it found Flashing Lights' tempo (90.55, known 90.47) but with too low a confidence to trust; Let It Happen word-synced gave nothing usable; **crowd-timed line-synced lyrics (LRCLIB) carry no usable beat information** (flat histograms, confidence 0 even with the right tempo given). So lyric timing is only a phase finder for a known tempo, and a weak one.
- **Online tempo lookup** (`lib/server/tempoLookup.ts`, `app/api/tempo/lookup`, 3 tests): Deezer's public search and track data (`bpm`, 0 means unknown). Matches title, primary artist and length to 4 s, and refuses remixes, live takes and tributes unless the title says so. Real answers: Flashing Lights 90.47, Let It Happen 124.91, Superman 130; We Are The People and the demo song: none. Behind Settings -> "Look up a song's tempo online" (sends title, artist and length). A tempo without a phase makes no grid.
- **Verified in Edge** (stand-in song "Flashing Lights / Kanye West / 237 s" with its Musixmatch word-synced lyrics held in the index, no audio learning): the lookup was sent once with only title, artist and duration; the stored tempo was `lookup+lyrics`, 90.52 BPM, phase 647 ms, confidence 0.76; the stage timeline used it (357 beats); the Beat section read "90.5 BPM, looked up, aligned by the lyrics"; 12 taps gave 116.3 BPM "tapped by you" and the stage followed; "Forget my taps" restored the looked-up grid.
- **System-audio listening**: `AudioCapture.start('system')` asks for the screen with its sound (Chromium on Windows); Settings has a second button. Not verifiable here (a person has to tick the checkbox).
- Limits: the lyric estimate cannot help songs with only loose line timing; the lookup covers only songs Deezer has a tempo for; the capture latency compensation is one machine's measurement.

## Turbo scenes, launcher, agent rules

- The five non-default Turbo styles were rebuilt as **scenes** (`lib/kinetic/gl/scenes/*`) from a frame-by-frame study of the owner's reference clips: code screens, sketch cards,
  lyrics app, acid grain, ASCII. The ASCII scene chooses its picture from the song (`subject.ts`: title word, then lyric theme, then mood, then the eye). Details, measurements (1.5-3.3 ms per frame at 1280x720 on an Intel Iris Xe, headless Edge) and limits: `docs/stage-modes.md` section 8.
- One-click launcher: `start.bat` / `pnpm go` (`scripts/launch.mjs`).
- `AGENTS.md` holds the rules for AI agents (hard rules, conventions, how to verify visual work, architecture map); `README.md` quick start and "what is built" were updated.
- Known gaps: the scenes were checked with English lyrics only; the RTX 5050 and high-refresh displays are not measured.


## Development lyrics, Spotify library and feature tracking (2026-10-27)

Added an owner-requested unofficial Musixmatch mobile API adapter with real richsync word offsets, explicit line ends, recording identity checks, in-memory anonymous tokens, request timeouts and failure backoff. It falls back to LRCLIB and defaults off in production. No plugin code, website scraper or analytics was imported. The paid/licensed provider migration remains required before beta/production. Live Flashing Lights lookup through the running app returned 50 line cues and 702 word/end timestamp tags. Initial token probes also returned internal 401 responses. Audible accuracy is not measured.

Added read-only Spotify playlist and saved-library scopes, paginated playlists, liked songs and saved albums, and collection queues. Existing accounts must reconnect. Collection playback exposes existing app shuffle/repeat, optional autofill from up to 50 liked songs, and a local unique-song artist-spaced mix. Spotify recommendation-based Smart Shuffle is not exposed by this Web API shuffle endpoint. Development Mode can restrict playlist contents; local-file entries, unavailable tracks and episodes are skipped.

Created docs/feature-tracker.md and added start/end request updates to repository and persistent owner instructions. Current and future work keeps built and verified statuses separate.

Validation: a full unit run passed 817 tests with one skipped. Typecheck, lint and build passed. A later full run had one FFmpeg timeout during a multi-hour execution stall, with 816 tests passing; the tracker records the isolated rerun result. Production build passed with the existing dynamic-filesystem trace warning. The Spotify playback/209 ms offset browser regression passed. The library browser test passed pagination, collection playback, next-track progression through liked-song autofill, shuffle, repeat, saved albums and mobile layout. Desktop and phone screenshots were inspected. The first browser failure was a test text selector that included row numbering; the accessible play-button selector fixed it. Final validation results are recorded in the feature tracker.

Final browser regression: both Spotify tests passed together after the final provider-switch control change. Complete collection playback also fetches pages the user has not loaded manually. Musixmatch results retain their origin in the lyric hook so Try another version remains available without inventing a provider record ID. Broader browser checks passed 14 of 16 initially; both failures (demo elapsed-time assertion and Settings timeout) passed unchanged when rerun. No claim of live Spotify account playback or audible sync is made.

## Lyric styles Phase 3: Sketch Cards (2026-11-11)

The Turbo `sketch` scene now draws the Phase 3 Sketch Cards style (`lib/styles/sketch-cards/`): lines lettered on fourteen kinds of paper landing on eleven painted places, six compositions, drawings from three registers, print processes, five scripts with right-to-left layout. The production record is in `docs/visual-production/phase-3/`.
