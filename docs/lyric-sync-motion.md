# Lyric timing, motion, themes and UI — what was measured, what was inferred, what is still imperfect

Scope: the "Sync + UI + Genre themes" pass on top of the sync rebuild (`lyric-sync-report.md`) and the regression fix
(`lyric-sync-regression.md`). Nothing here is committed. **No claim of "perfect sync" is made**: no audio was heard,
and the one thing that decides how a song *feels* on Spotify (the real playback clock) can only be measured on the
user's machine with the diagnostics described below.

Timing hierarchy the code respects (best source wins, never overwritten by a worse one):
verified word-level → verified line-level → authorized local-audio alignment → line-based word estimate → untimed.

## 1. Measured facts

All numbers come from reruns of the scripts in `tools/sync-report/ab/` on the 20 human-annotated songs
(JamendoLyrics, 5,693 words, English only). Parameters were fitted leave-one-song-out, so every figure is on a song the
fit never saw.

### 1.1 Word onsets inside a line-synced LRC (exact line starts, nothing else)

| estimator | median abs error | within 200 ms | words >300 ms early | words >300 ms late | signed median |
|---|---|---|---|---|---|
| E0 old: `min(gap, max(1.2 s, 650 ms × words))` | 223 ms | 46.5 % | 5.3 % | 36.5 % | +169 ms |
| E6 pace-aware, fitted on onset error | 166 ms | 54.6 % | 17.0 % | 17.0 % | 0 |
| **E8 deployed**: pace-aware, early errors ×2 | 180 ms | 52.6 % | 11.9 % | 24.4 % | +54 ms |

* The old estimator's bias depended on tempo. On "normal" songs (350–700 ms/word) its *last* word landed a median
  **528 ms late**, and on slow songs (≥700 ms/word) **343 ms early** — the opposite sign, which is why one global offset
  cannot fix both. (From `estimator_study.ts`; the per-class table is printed there.)
* E8 is deliberately biased slightly late (a word appearing early reads as wrong; a word appearing 50 ms late reads as
  "on the beat"). Its table (share of the gap/words that is actually sung, at 200/425/600/850/1250/2200 ms per word) is
  1.00 / 0.85 / 0.85 / 0.70 / 0.55 / 0.50, interpolated in `sungShareOfGap` (`lib/lyrics/words.ts`).
* Adding a per-song cadence term (E7) did **not** help held-out (53.5 % vs 54.6 %); it was not shipped.
* Still an estimate: ~1 word in 8 is more than 300 ms off, and the slow class remains the weakest.

### 1.2 Where the animation lands relative to the cue (renderer, `preset_landing.ts`)

| preset | first visible | landed (within 1 % of rest) |
|---|---|---|
| ticker | −60 ms | +130 ms |
| stack | −60 ms | +100 ms |
| burst | −60 ms | +150 ms |
| drop | −60 ms | +180 ms (was ≈ +350 ms before `DROP_MS` 220) |
| wave | −60 ms | continuous wobble by design (the 1 s figure is the wobble, not a late entrance) |

Words start appearing ~60 ms *before* their cue (`LEAD_MS` 70) and settle within ~100–180 ms after it, so the
renderer is not a source of a ~1 s offset. The animation phase also was measured separately (`animation_phase.ts`).

### 1.3 Real-world hazards that were measured, not assumed

* Spotify's telemetry age is capped at 2 s (`TELEMETRY_AGE_CAP_MS`). If the app sees larger real lag it will be under-corrected.
* The PC clock was ~60 s fast on the test machine, which is why browser-side `Date` cannot be used to age the telemetry;
  the Spotify `Date` header is not readable from the browser (CORS). `/api/diag/clock` measures it server-side.
* Version outliers: a community LRC that disagrees with the consensus of other versions by more than 1.5 s is penalised
  (`timingOutlierIds`, test `lyrics-match.test.ts`). Different recordings of the same song are a real source of ~1 s errors.
* The earlier clock rebuild moved positions by 1–3 s on real use and was reverted to the original age formula. Only the
  diagnostic estimator remains (diagnostics only).

### 1.4 Verification run for this pass

* `pnpm typecheck`, `pnpm lint`: clean.
* `pnpm vitest run`: **25 files, 418 tests pass** (includes new `theme-select`, `layout-overlap`, `motion-landing`,
  `word-estimator`, `artwork`, `sync-*` suites). `tests/social.test.ts` has a known ~50 % tie-break flake unrelated to this work.
* `pnpm build`: succeeds. `pnpm test:e2e`: **5 / 5 pass**, including the new stage-panel test (theme pill, pin, Sync tab, close).
* Visual checks in Edge (Playwright, 1280×720): Gloss, Film, Aurora, Maximalist, Neon, Minimal rendered at lyric time
  with a deliberately long first line; the final calm-theme shots show no art-filled words and no piling.

## 2. What is *not* proven (limitations)

* **Whether real LRC line starts are early or late versus the vocals.** None of the 20 annotated songs exist in LRCLIB,
  so source-offset bias could not be measured. If the user's ~1 s on slow/normal songs is a *shared* source offset or
  the 2 s age cap, only live diagnostics will show it. No blind offset was applied, by design.
* **Meaning of Spotify's `timestamp`** (when the state was taken vs. when it was sent) is unverified, as is the true
  reporting lag. The age formula is the original one that tested well in real use.
* **Subjective "feel"**: no audio was listened to. All motion claims are about *when pixels land vs. cue times*.
* **Aligner** is English-only (wav2vec2 CTC) and only for local audio; Hindi/Hinglish go through line-based estimation.
* **No beat grid** for Spotify (the audio-analysis API is closed to new apps), so words are not snapped to beats.
* Deferred: section/line-shift tools in the timing editor, a multilingual aligner.

## 3. How the user can measure their own ~1 s (no code changes needed)

1. Open the app with `?syncdebug=1` (or `localStorage['lyricscape.debug.sync']='1'`).
2. Play a slow/normal song for ~30 s, then in the console run `lyricscapeSync.summary()` and `lyricscapeSync.probeClock()`.
3. If the offset is constant across songs it is a source/age offset; if it grows with line length it is the estimator.
4. Remedy without guessing: open the stage → **Sync** tab → *tap to anchor* on a line you can hear, or nudge. The correction is
   stored per song (`offset:<trackId>`), never written into the lyrics.

## 4. Themes (genre / mood / vocal-style)

`lib/kinetic/themeSelect.ts` scores five *families* (rap, rnb, pop, indie, atmospheric) from, strongest first: genre tags
(Spotify artist genres, when connected; the regex rules include Hindi/Punjabi hip-hop and Bollywood/filmi), the delivery
pace of the lyrics (`lyricsPace`, words per sung second), tempo (demo/imported audio only), mood, and cover cues
(brightness, vibrance). The best family wins, maps to a style, and the reasons plus a `confidence` (margin over the runner-up)
are kept; low confidence means "a guess". It is a heuristic. There is no language detector: for Hindi/Hinglish songs without
genre tags only pace, mood and cover decide, which is weaker.

* **Auto** is the default (`autoTheme` pref). The theme pill shows the family; picking a style in the panel **pins** it for
  that song (`theme:<trackId>` in kv) and shows "PINNED". Settings → Auto theme turns auto off globally.
* Two new styles: **Gloss** (light, glassy; R&B/pop) and **Film** (grain, serif; indie/slow).
* Calm themes carry little decoration: per-style `decor` (0.2–0.7 for editorial/minimal/neon/vaporwave/vhs/notebook/aurora/gloss/film)
  scales doodles/emoji, and `maskWords:false` stops long words being filled with cover art on those themes.

## 5. Readability rules (enforced by tests)

* Landed words on a row never overlap (`tests/layout-overlap.test.ts`: 5 presets × 4 line lengths × 5 styles × word-level on/off).
  Fixed along the way: the stretch hold never relaxing, burst words measured at the wrong size, wave wobble beyond the free room.
* Words are never filled with art on calm themes; a dark scrim fades in behind lines in busy scenes; long gaps (≥ 4 s)
  show a hero card instead of dead air.
* Reduced motion removes entrances/wobble and decoration.

## 6. UI

* New stage chrome: theme pill, Sync pill, transport; one side panel (`StagePanel`) with **Look** and **Sync** tabs.
  Sync tab: tap-to-anchor, ±50/±250 ms nudges, per-song reset, word-by-word toggle, timing-source/confidence chips.
* The timing editor now uses the same lyric clock as the stage (so what you stamp is what you see), and stamping/nudging a
  line marks it *authored* (it outranks estimates and is the only thing written to enhanced LRC).
* Artwork: deterministic generated covers (sunset, bauhaus, contour, waves, orbit, mesh) are the fallback everywhere a
  track has no cover (library, player, stage backdrop, palette).

## 7. Reproduce

```
pnpm exec tsx tools/sync-report/ab/estimator_study.ts   # §1.1
pnpm exec tsx tools/sync-report/ab/preset_landing.ts    # §1.2
pnpm typecheck && pnpm lint && pnpm vitest run && pnpm build && pnpm test:e2e
```
