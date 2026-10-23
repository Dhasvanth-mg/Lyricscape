# Lyric sync audit and rebuild plan

Branch: `feat/lyric-sync-rebuild`. Status of each item is updated at the bottom as stages land.

## What was traced

lookup (`app/api/lyrics/lookup`, `lib/lyrics/match.ts`) → storage (`lib/library/db.ts`, IndexedDB, LRC text) → parse (`lib/lyrics/parse.ts`) →
compile (`lib/kinetic/compile.ts`) → frame/render (`computeFrame`, `KineticRenderer`) ← position (`PlayerController.getPositionMs` →
`SpotifyBackend` + `PlaybackClock`, or `LocalBackend` → `HTMLAudioElement.currentTime`) + offset (`LyricStage`).

## Causes found

Items marked **repro** are covered by a failing test in `tests/sync-audit.test.ts` (numbers from the run before any fix).

### A. Lyric data

| # | Cause | Effect |
|---|---|---|
| A1 **repro** | `[offset:±ms]` is parsed into `meta` and never applied. | Files that rely on it play 100s of ms off (test: expected 9500, got 10000). |
| A2 **repro** | A blank cue (`[00:18.00]`) is the author's explicit end of the previous line, but line ends are `min(next cue, start + heuristic cap)`. The cap (`expectedSungMs × 1.5`, earlier `words × 650`) beats the real end. | A line that is sung for 8 s disappears after ~1.9 s and the "instrumental" interlude starts while the singer is still singing (test: ends at 11875, true end 18000). |
| A3 | Words inside a line-level LRC line are placed by syllable/length heuristics and stored in the same `TimedWord` as measured stamps. Nothing records which is which. | Karaoke highlighting and the `cut` preset (single-word flashes) present guesses as real timing. |
| A4 **repro** | `toEnhancedLrc` writes a `<mm:ss.xx>` stamp for every word of every doc. Saving from the timing editor (or any save path) turns a line-synced file into "enhanced LRC". | Estimated times are laundered into stored data that later looks authored, indistinguishable from a real word-synced file (test: output contains invented stamps). |
| A5 | LRCLIB returns `hasWordSync` and a `lyricsfile` (YAML, per-word `start_ms`/`end_ms`) on every record. We only read `syncedLyrics`/`plainLyrics`. In 500 sampled search results, 0 had word sync, so it is rare today. | Real word timing is ignored whenever it does exist. |
| A6 | LRCLIB's own derived `end_ms` is the next line's start (and can even overlap it). It is inferred, not measured. | Must not be treated as an authoritative end. |
| A7 | Version choice accepted candidates up to 10 s off in length. Timing drifts by roughly the difference at the far end of a different edit. | A "close enough" edit is silently wrong by seconds late in the song. |
| A8 | Stored records carry no provenance (`user` / `lrclib` / `edited` / `auto`). "Try another version" replaces whatever is saved. | A user-edited document can be overwritten by one click. |

### B. Playback position

| # | Cause | Effect |
|---|---|---|
| B1 **repro** | Telemetry age = `clamp(Date.now() − state.timestamp, 0, 2000)`. `timestamp` is Spotify's server clock, `Date.now()` is yours; the difference is clock skew plus real age. | A PC whose clock is 3 s ahead reads 2 s of "age" on fresh data: lyrics 2 s early (test: 1970 ms error). A clock behind reads 0 and ignores real network delay. Request round-trip is never measured. |
| B2 | SDK `state` events use `position` as-is; their `timestamp` is not read. | Late-delivered events are treated as current. |
| B3 | `PlaybackClock.sync` slews 25% toward each report and snaps beyond 120 ms; there is no rate model. | OK short-term, but the estimate can only ever be as good as B1/B4's inputs. |
| B4 **repro** | A poll already in flight when the user seeks (or pauses, or the track changes) is applied when it returns, with no epoch check. | The clock snaps back to the pre-seek position: a 60 s backwards jump (test: 59 900 ms error). Same flaw flips play/pause state. |
| B5 | One `syncGlobal[family]` slider mixes two different things: device/output latency (same for every song) and per-song lyric correction (a property of that lyric version). With "same for all songs" on (default) the second cannot be expressed at all. | Fixing one song moves every song; a Bluetooth delay gets baked into per-song fixes. |
| B6 | `TimingEditor.stampNow` records raw `player.getPositionMs()`; the stage renders `getPositionMs() + offset`. | With a non-zero offset, a stamped word is shown `offset` ms early/late: saved timestamps absorb the display offset (not unit-tested, evident from the two call sites). |
| B7 | `LocalBackend.positionMs()` is `audio.currentTime`, with no output latency. | Audible sound lags the displayed position by the device's output latency (tens of ms wired, 100–300 ms Bluetooth). |

### What is already right (kept)

`computeFrame` is a pure function of `(timeline, tMs, env)`, so seeking reproduces frames exactly; global offset is applied at render time and never written into lyric data; the lyric compile step is deterministic.

## Staged plan

1. **Canonical document** (`lib/lyrics/*`): every line carries `endSource` (`explicit | next-line | estimated`) and `wordTiming` (`authored | estimated | none`); the document carries `timing.source`, `timing.quality` and match metadata. `[offset:]` applied once, at parse. Line-level data never gets word stamps on save. Old saved lyrics load unchanged (word-stamped text = authored).
2. **Rendering honesty**: lines without authored word times appear as a unit (small fixed stagger, no word-by-word claim, no `cut` preset). Estimated word timing is an opt-in pref, labelled as estimated.
3. **Retrieval**: parse Lyricsfile (YAML) when `hasWordSync`; rank by title, artist, album, duration (tight), version; return match quality; never overwrite user-owned lyrics.
4. **Clock**: one `PositionEstimator` (epoch-guarded, RTT- and skew-aware, rate-trimmed, injectable time) behind both backends; display latency and per-song correction are separate, per-song correction is stored beside, not inside, the lyric data.
5. **Aligner (optional)**: Python tool for local audio using known lyric text; evaluated on independently annotated music (JamendoLyrics); reports per-word confidence; always marked for review.
6. **Verification**: unit + integration tests; measured onset-error report for line-level and word-level sources; existing suite.

## Not claimed

Nothing here is called accurate until stage 6 prints measured numbers; see the results section once it exists.

## Status of each cause (this branch)

| # | Fixed by | Verified by |
|---|---|---|
| A1 offset tag | `parseLrc` applies it once and records `timing.offsetAppliedMs`; serialization drops the tag | `tests/sync-audit.test.ts` A1, `tests/lyric-timeline.test.ts` ([offset:]) |
| A2 blank cue / line ends | `resolveEnd`: explicit (blank cue) > next cue > labelled guess; `endSource` on every line | A2 repro, `line ends` tests |
| A3 invented word times | `wordTiming: authored / estimated / none` on every line; compile shows untimed lines as a unit; estimated word motion is an opt-in (Settings → Lyrics) | `what the visualizer does with unreal word times` |
| A4 laundering on save | `toEnhancedLrc` writes word stamps only for authored lines; plain documents save as text | A8 repro, `serialization` tests |
| A5 word sync ignored | `lib/lyrics/lyricsfile.ts` + route returns `hasWordSync`/`lyricsfile` | `Lyricsfile` tests (spec-shaped YAML; **no real word-synced LRCLIB record was found in 500 sampled results**) |
| A6 LRCLIB `end_ms` | not trusted for lines without words; blank entries are explicit ends | real-record-shape test |
| A7 version tolerance | synced lyrics refused beyond 5 s length difference; `MatchInfo` stored and shown; word sync only a tie-breaker | `choosing the recording` |
| A8 provenance | `StoredLyrics.origin`; lookups never replace user-owned lyrics | `who owns the lyrics` |
| B1 skew-blind age | `TelemetryAgeEstimator` (RTT + skew min-filter, trust band ±250 ms) | B1 repro, estimator tests, `tools/sync-report/clock_report.ts` |
| B2 SDK timestamp | pushed reports go through `observe({ pushed })` with a post-command grace window | `PlaybackClock` tests |
| B3 clock model | `PlaybackClock` keeps position continuous (≤ 4% rate trim), snaps only for real jumps | continuity tests |
| B4 stale poll | epoch guard + commands-in-flight guard + epoch bump when Spotify confirms a command | B4 repro, `SpotifyBackend polling` tests |
| B5 one slider | `lyricTimeMs` = position − output latency + **device** advance + **song** offset; song offset stored beside the lyrics | `lyricTimeMs` tests, UI |
| B6 stamp vs display | the timing editor uses the same `useLyricClock().now()` as the stage | by construction (one function) |
| B7 local output latency | `LocalBackend.outputLatencyMs()` from the audio graph | `LocalBackend` tests |

A lyric edit makes a line "authored" the moment a word is stamped or nudged (the person took responsibility for that
line's word times); shifting a whole line does not.
