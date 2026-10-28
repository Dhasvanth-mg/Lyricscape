# AGENTS.md: rules for AI agents working on Lyricscape

Read this before changing anything. It applies to every coding agent (Claude Code, Codex, Cursor, Copilot, others). Where it conflicts with the long
product spec in `docs/original-product-spec.md` (sections 14 and P), **this file wins**: the spec was written before the app was built local-first.

## 1. What this project is

Lyricscape is a music player with expressive kinetic lyrics, a listening map, and collaborative parties with auto-made recaps. It is **local-first**:
it runs on one machine with no Supabase, Vercel or cloud service. Data lives in `.data/`. Those cloud pieces are planned, not wired; the repository
boundaries in `lib/server/*.ts` are where they plug in. Do not add cloud dependencies unless the owner asks.

Run it: `pnpm go` (installs if needed, starts, opens the browser) or `start.bat` on Windows. Open **http://127.0.0.1:3000** (not `localhost`: the Spotify redirect is registered against `127.0.0.1`).

## 2. Hard rules (never break these)

1. **Never claim something works unless you ran it.** Typecheck, lint and tests prove code compiles; they do not prove a visual works. For anything visible, run the app and look at it (see section 6). Report failures and anything you skipped plainly.
2. **Timing is never touched by styling.** Lyric timing, the lyric clock (`lib/player`, `useLyricClock`, `lyricTime`) and sync offsets are not changed by visual work. Cue times must stay identical across modes, styles and transitions (tests assert it).
3. **Rendering is deterministic.** `computeFrame(timeline, t, env)` in `lib/kinetic/frame.ts` is a pure function of time; every renderer (Canvas2D Clean, WebGL2 Turbo, every Turbo scene) must give the same picture for the same `t`. No `Math.random()`, `Date.now()` or `performance.now()` while drawing: use `hash01` and the frame time. Export steps time at a fixed fps and relies on this.
3b. **Readability is a guarantee in Clean mode:** ink keeps 4.5:1 contrast against the ground whatever the cover or adjustments (tests assert it). Reduced-motion turns line effects and flashes off; flashes obey the 12% limit.
4. **No secrets in the repo or in chat.** Spotify uses PKCE (a public client id, no secret). `.env.local` is never committed. If a secret is pasted into a conversation, say it should be rotated; do not store it.
5. **Rights and honesty.**
   - Spotify provides no lyrics. Lyrics come from LRCLIB (an open API) or the user's own files. **Never scrape lyrics sites.**
   - Never download, record, mix or re-encode Spotify audio. Exports are **lyric videos with no audio**.
   - Reference clips and screenshots from the owner are inspiration for layout, type, colour, effects and pacing. **Do not copy their footage, artwork, lyrics, watermarks, creator handles, brand cards, or real logos and official seals.** Draw things from scratch.
   - Limits of a feature (a language, a lexicon, a mood guess) are stated in the UI or docs, never hidden. Do not present guesses as facts.
6. **Privacy and permissions are engineering requirements** (listening map is opt-in, guests only see what their role allows, media access is signed). Follow `docs/architecture.md`, `docs/spotify-compliance.md`, `docs/media-rights.md`.
7. **Do not delete or rewrite what you do not understand.** Look at a file before overwriting it. Never run destructive commands (`rm -rf`, `git reset --hard`, force-push, `git clean`) unless the owner asked for exactly that.

## 3. Working agreements with the owner

- **Feature tracking:** maintain `docs/feature-tracker.md` as the separate record of requested features. At the start of every user request, before implementation, add or update its scope, status, acceptance criteria and remaining work. Before the final response, update it again with what was built, verification results, limitations and outstanding work. Preserve unfinished requests when new messages arrive. Do not mark implementation as verified without evidence. A message received during ongoing work also requires a start update and an outcome update when handled.

- **Commits:** write clear messages describing what changed and why. **No attribution or "Co-authored-by" or "Generated with" lines** in commit messages or PR descriptions.
- **Do not push** (or open PRs, or enable auto-merge) unless the owner asks. They sometimes say "commit and push"; that approval covers that moment only.
- **Stay in scope.** Do the task asked. Mention adjacent problems instead of silently fixing them, unless trivial and in the same file.
- **Plain language** in your replies: say what was done and what was verified. Lead with the result.
- The owner's reference materials (clips, links) are in their own folders, not in the repo. `.ref/` and `.claude/` are local scratch folders and are untracked: never commit them.
- If a request is ambiguous in a way that changes what you build, ask one short question; otherwise pick the sensible default and say which you chose.

## 4. Commands

| Command | Use |
|---|---|
| `pnpm go` / `start.bat` | one-click: install if missing, start, open the browser |
| `pnpm dev` | web app only (`pnpm dev:all` adds the media worker) |
| `pnpm typecheck` | `tsc --noEmit` (strict) |
| `pnpm lint` | ESLint incl. the React Compiler rules (see section 5) |
| `pnpm test` | Vitest, about 790 tests, about 40 s (includes real FFmpeg renders) |
| `pnpm build && pnpm test:e2e` | production build + Playwright smoke tests |
| `pnpm smoke` | HTTP-level party smoke test against a running app |
| `pnpm demo:generate` | regenerate the CC0 demo songs, lyrics and artwork |

**Before you say a change is done:** `pnpm typecheck && pnpm lint && pnpm test` all pass, and for visible changes you looked at it in a browser. Note: `pnpm typecheck` can trigger a pnpm install on this machine; `npx tsc --noEmit` is equivalent.

## 5. Code conventions

- **Stack:** Next.js 16 (App Router, Turbopack), React 19 with the **React Compiler lint rules**, TypeScript 6 (strict), Tailwind 4, Zod 4, Zustand 5, Vitest, Playwright, mediabunny (WebCodecs) for export. Package manager: **pnpm** only. Pin TypeScript at 6 (typescript-eslint does not support 7).
- **Match the surrounding code:** naming, comment density, idiom. Comments explain why, in plain sentences; do not narrate what the code obviously does. Follow the file's existing style.
- **React Compiler rules (lint fails otherwise):** no impure calls (`Math.random`, `Date.now`) or ref reads/writes during render; do that in effects or handlers. Do not add `onBlur` handlers that cancel hold-to-repeat buttons (the sync stepper broke that way).
- **Zod at the edges:** validate every API input and stored document with a Zod schema; keep types derived from schemas.
- **Server code** lives in `lib/server/*` behind repository boundaries (so cloud adapters can replace the local store). Route handlers in `app/api/**` authorize first, validate second, act third.
- **Line endings:** the Windows working copy uses CRLF for many files (`core.autocrlf=true`). When you edit with scripts, detect and preserve the file's endings; do not convert whole files. Avoid heredocs with nested quotes in the Windows shell: write helper scripts to a file instead.
- **Fonts** are bundled through `@fontsource*` (see `app/layout.tsx`). A scene that paints with a font must load it first (`SCENE_FONT_LOADS`, `loadFonts`) or the first frame draws in a fallback face.
- **No dead code or leftover experiments.** Delete what a change makes unused; keep temp scripts in the scratchpad or `.ref/`, never in the repo.

## 6. Verifying visual work

The stage is a canvas; screenshots of the page are not enough. The reliable loop:

1. `pnpm go` (or the dev server), then drive Edge with Playwright (`channel: 'msedge'`, headless, args `--use-angle=d3d11 --ignore-gpu-blocklist`).
2. Open the demo: click "Try the demo songs", wait for the player (`Neon Static`), press **L** for the stage.
3. In development the stage exposes `window.__ls = { r, ui }` (`r` = the renderer, `ui` = the UI store). Set the mode with `__ls.ui.getState().set({ mode: 'turbo', turboStyle: 'sketch' })`, then `__ls.r.render(tMs)` and read the canvas with `canvas.toDataURL()` **in the same task** (the buffer is cleared after compositing). `__ls.r.bench(tMs, n)` times a frame including the GPU flush.
4. Look at the PNGs. Check several moments (start of a line, mid-typing, end) and more than one aspect ratio (1280x720 and 720x1280). Check the console for errors.
5. For export, run it from the dialog (Mode, Turbo style, a short range) and check the downloaded MP4 with ffmpeg (`ffmpeg-static` is installed).

Do not leave a dev server or headless browser running when you finish, unless the owner asked you to launch the app.

## 7. Architecture map (where things live)

- `lib/lyrics/*` finding, parsing, matching lyrics and word timing; language and script handling (`script.ts`, `translit.ts`, lexicons, `words.ts`).
- `lib/identity/*` and `lib/theme/*` what a song *is* (genre, pace, mood, cover) and which **art direction** it gets; produces the resolved `Look` (colours, type, artwork treatment, layout, motion, appearance). Per-song adjustments are stored with the song.
- `lib/kinetic/*` the visual engine:
  - `frame.ts` pure `computeFrame` -> `Frame`. Entrances, exits, line effects, layout (including right-to-left mirroring) live here.
  - `render.ts` the **Clean** renderer (Canvas 2D). `gl/renderer.ts` the **Turbo** renderer (WebGL2). Both draw the same `Frame`. `stageRenderer.ts` is the interface and factory (Turbo falls back to Clean on a fresh canvas when WebGL2 is missing or the context is lost).
  - `turbo.ts` the Turbo styles registry (`liquid` plus five scenes) and `turboLook`. **`docs/turbo-styles.md` explains every style in detail (what it looks like, how it is built, its timings and tunables, how to add one): read it before touching a scene.**
  - `gl/scenes/*` the five reference scenes: `terminal.ts` (code screens), `sketch.ts` (sketch cards), `nebula.ts` (lyrics app), `acid.ts` (acid grain), `ascii.ts` (ASCII window; picture chosen from the song by `subject.ts`). A scene is a pure function `(host) -> SceneFx`; the host (built in `gl/renderer.ts`) offers sprites, shapes, full-screen shader passes and the ASCII pass.
  - `gl/shaders.ts` and `gl/scenes/shaders.ts` GLSL ES 3.00 sources. `modes.ts` Clean/Turbo definitions and principles.
- `lib/export/video.ts` lyric-video export (no audio) via WebCodecs; uses the song's own sync offset, not the device delay.
- `lib/player`, `components/player`, `lib/spotify` playback (local audio and Spotify Web Playback SDK), lyric clock.
- `components/visualizer/*` the stage, Studio panel, mode picker, export dialog, sync stepper.
- `lib/party`, `lib/recap`, `workers/media`, `lib/map` parties, recap rendering (FFmpeg), the listening map.
- `docs/*` the written record (see section 9).

### Rendering rules that cost us bugs before

- **WebGL context hygiene.** Browsers keep about 16 live contexts and silently kill the oldest. `TurboRenderer.supported()` is cached and releases its probe. Exports and stills **dispose** their renderer. `dispose()` frees GPU objects but **must not call `loseContext()`**: React remounts reuse the same canvas, and a deliberately lost context never works again.
- **Textures:** text and sprites are rasterised once into textures (cached by key, LRU) and drawn as quads; the CPU decides *what* to draw, not pixels. Never rasterise per frame. Sprites painted with a face that later loads must be cleared (`clearSprites`).
- **FBO orientation:** `v_uv` is y-down (stage/canvas textures), `v_tc` is y-up (framebuffer textures). Mixing them flips pictures.
- **Blending is premultiplied alpha** (`ONE, ONE_MINUS_SRC_ALPHA`); additive passes must restore it.
- **Glyph fringing and bloom** must not smear type: fringing only toward the edges (except the Acid scene), bloom taken before words are drawn.
- A new Turbo scene must: draw only from time and the frame, fall back safely when there is no line (intro, break, instrumental), work at 1280x720 and 720x1280, cost a few ms per frame (`bench`), and appear in `TURBO_STYLES` with an honest one-line description.

## 8. Adding or changing things: checklists

**A visual or Turbo scene:** read the reference first, frame by frame (extract frames with `ffmpeg-static`, look at key moments at full size, not only a contact sheet), write down layout, type, colour, motion and timing, then build and compare against the same frames. Add pure logic (picking, layout, typing speed) as testable functions and test them. Update `docs/stage-modes.md`.

**A language:** script detection, fonts (script faces first), spacing (no italics or letter spacing for complex scripts), word segmentation (`Intl.Segmenter`), syllable estimate, mood lexicon with words that are also common English words excluded, identity honesty notes. Add tests in `tests/world-lang.test.ts` or `tests/indic.test.ts`. State limits.

**An API route or stored document:** Zod schema, authorization, error shape, tests (including the unauthorized case), update `docs/architecture.md` if a boundary moves.

**A setting or per-song adjustment:** stored with the song, resettable one by one, reduced-motion respected, covered by a test.

## 9. Tests and docs

- Add tests with the change; put them in `tests/` next to similar ones (names describe behaviour). Test pure functions directly; keep GPU-dependent checks to the browser loop in section 6. Do not weaken or delete a test to make it pass; fix the cause, or say why the expectation was wrong.
- **Docs to keep current:** `README.md` (quick start, what is built), `docs/implementation-log.md` (a section per milestone: what, measured numbers, known gaps), `docs/stage-modes.md` (modes, Turbo scenes, languages, export), `docs/turbo-styles.md` (each Turbo style in detail), `.env.example` for any new variable.
- Numbers in docs must be measured. If you did not measure something, write "not measured".

## 10. Known gaps (do not pretend these exist)

Cloud adapters (Supabase Auth and Postgres RLS, R2, Inngest); a real Spotify run-through is owner-only (needs their credentials); multi-user listening rooms and concert memories; Demucs and WhisperX; a screen-reader audit; the five Turbo reference scenes were checked with English lyrics only (Hindi, Tamil and right-to-left lines in them are unchecked); the RTX 5050 and high-refresh displays have not been measured.
