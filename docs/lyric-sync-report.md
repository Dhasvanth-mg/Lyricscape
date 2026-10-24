# Lyric sync: measured results

Branch `feat/lyric-sync-rebuild`. Everything here was measured; where something was **not** measured it says so.
Nothing in this document, or in the app, calls any of this "accurate" beyond the numbers below.

## 1. What was measured, and against what

**Independent ground truth.** JamendoLyrics, English subset: 20 complete songs (Creative Commons audio from Jamendo) with
word-level start/end times annotated by people (Durand et al., ICASSP 2023). 5,693 annotated words, 868 lines.
The audio and annotations were downloaded by `tools/aligner/evaluate.py fetch`; they are not committed.
None of these songs, and none of the numbers below, was used to tune anything: the one threshold (low-confidence
below 0.35) was written into the code before the first run and has not changed.

**Error** = predicted word start − annotated word start, in ms. "within X" = the share of words whose absolute error is ≤ X.

| Source being measured | What it represents |
|---|---|
| **Aligner on separated vocals** | optional local aligner (wav2vec2 CTC forced alignment of the known text, after Demucs vocal separation) |
| **Aligner on the full mix** | the same, with no separation |
| **Line-level source → estimated words** | what the app used to do (and now only does if you opt in): a line-synced LRC with its words spread by the syllable heuristic. Given the *annotators'* line starts, so this is the best case for line-level data; variants below |
| **Plain text, spread over the song** | lyrics with no timing at all |

Authored word-level sources (an enhanced-LRC or Lyricsfile written by a person) are the definition of word timing, so there
is nothing to compare them with here; **no real word-synced LRCLIB record was found** (0 of ~500 search results had
`hasWordSync`), so the Lyricsfile reader is tested against spec-shaped files only.

## 2. Word-onset error (n = 5,693 words, 20 songs)

| Source | median | mean | p90 | p95 | ≤ 100 ms | ≤ 200 ms | ≤ 500 ms | bias (median, signed) |
|---|---|---|---|---|---|---|---|---|
| **Aligner, separated vocals** | **61 ms** | 382 | 238 | 724 | **71.5 %** | **88.6 %** | 93.5 % | −32 ms |
| Aligner, full mix | 94 ms | 3,795 | 11,581 | 21,213 | 51.9 % | 63.6 % | 69.6 % | −34 ms |
| Line-level → estimated words, exact line starts **and ends** | 167 ms | 292 | 682 | 952 | 37.3 % | 55.6 % | 82.9 % | +97 ms (late) |
| Line-level → estimated words, exact starts, no end cue (typical LRC) | 252 ms | 599 | 1,619 | 2,508 | 30.4 % | 43.6 % | 67.6 % | +222 ms (late) |
| Line-level → estimated words, starts jittered ±150 ms (sensitivity) | 279 ms | 627 | 1,629 | 2,512 | 22.4 % | 40.4 % | 66.3 % | +237 ms (late) |
| Plain text spread over the song | 8,090 ms | 10,956 | 24,628 | 31,853 | 0.7 % | 1.2 % | 3.0 % | −694 ms |

### Line-start error (868 lines)

| Source | median | p90 | ≤ 100 ms | ≤ 200 ms | ≤ 500 ms |
|---|---|---|---|---|---|
| Aligner, separated vocals | 73 ms | 690 | 62.7 % | 80.1 % | 86.6 % |
| Aligner, full mix | 133 ms | 14,461 | 43.4 % | 53.9 % | 61.2 % |
| Line-level source, exact starts | 3 ms | 5 | 100 % | 100 % | 100 % |
| Line-level source, starts jittered ±150 ms | 90 ms | 229 | 53.8 % | 85.0 % | 100 % |
| Plain text spread | 8,734 ms | 24,014 | 0.7 % | 1.2 % | 2.9 % |

The two line-level rows are exact / jittered **by construction** (I fed the annotators' starts, optionally perturbed). How
accurate real LRCLIB timestamps are against a recording was **not measured**; that needs LRC files for annotated songs.

### What these numbers mean for the app

* Even with perfect line starts *and* ends, estimated word times are within 200 ms for 55.6 % of words, and for typical line-only data 43.6 %,
  and they are **late by ~100–220 ms on average** (singers land the first word of a line right at the line start). The rebuild
  made the whole-line-at-once display the default; that turned out to place later words seconds early (a worse match for what is heard than the
  estimate: 22 % vs 46 % of words within 200 ms), so word-by-word motion is on again by default, still labelled "estimated"
  (lyric-sync-regression.md).
* Plain, unsynced lyrics are essentially never right (1.2 % within 200 ms; median 8 s off). They are labelled "Not synced".
* The aligner is much better than any estimate **when it has separated vocals** (88.6 % within 200 ms), and unusable without
  them on some songs (below).

## 3. Aligner detail

**Per song.** On separated vocals every song had a median error under 1 s; per-song share within 200 ms ranged from
**58.7 % to 99.4 %** (median 88.4 %); worst: *Avercage – Embers* 58.7 %, *Pure Mids – The Leader* 61.4 %, *Color Out – Falling Star* 79.5 %.
On the full mix **6 of 20 songs had a median error above 1 s**; per-song within-200 ms ranged **2.6 % to 99.0 %** (median 62.7 %).
Without separation the result is a coin flip per song, so the service refuses to hide that: it warns on every full-mix run.

**Confidence is informative.** Mean posterior of a word's characters on the aligned path, on separated vocals:

| confidence | words | median error | within 200 ms |
|---|---|---|---|
| < 0.20 | 1,283 | 98 ms | 67.7 % |
| 0.20–0.35 | 794 | 69 ms | 84.8 % |
| 0.35–0.50 | 767 | 60 ms | 92.7 % |
| 0.50–0.70 | 832 | 53 ms | 96.8 % |
| ≥ 0.70 | 2,017 | 50 ms | 98.4 % |

Flagging words below 0.35 for review marks **36.5 % of words** and catches **82.2 % of the errors over 200 ms**; the words *not*
flagged are within 200 ms **96.8 %** of the time. (On the full mix: 69.8 % flagged, 94.5 % of large errors caught, and the
flagged share shows how badly it hears.) So the intended workflow, align → review the amber words → save, is supported by the
data. **It is not a way to skip review:** 17.8 % of large errors were not flagged, and p95 on vocals is still 724 ms.

**Speed (RTX 5050 laptop GPU, CUDA torch 2.11):** full mix median 1.2 s per song; with Demucs separation median 9.1 s
(the same on CPU took ~157 s). The first four songs were run on CPU before switching to the GPU; same weights and code.

**Choice of aligner.** WhisperX was evaluated on paper and not run: its alignment stage is the same wav2vec2 CTC forced-alignment
used here (it adds Whisper transcription we do not need because the lyrics are known) and it pulls heavy dependencies.
A transcription-first approach would also reintroduce the risk of dropping or reordering lyrics. The multilingual MMS aligner
was not tried (very large); **this build is English only** and refuses other languages.

## 4. Playback clock (CORRECTED)

**This section originally claimed the rebuilt skew-removing estimator cut position error from ~1900 ms to ~10 ms. That claim is withdrawn.**
It came from a simulation whose staleness values I had assumed. When the rebuild was run on real use, positions moved by 1-3 s
relative to the behaviour you had calibrated against (see [lyric-sync-regression.md](lyric-sync-regression.md)), because a browser cannot tell
a wrong local clock from Spotify's own reporting lag (its `Date` header is hidden from page scripts).

What is true now:

* The position uses the pre-rebuild telemetry age, `clamp(Date.now() − timestamp, 0, 2000)`.
* Kept from the rebuild, still verified by tests: an epoch guard (a poll requested before a seek/pause/load is dropped, so a seek
  during an in-flight poll no longer throws the clock back 60 s), an in-flight command guard, and continuous slewing (no jump for small drift).
* The skew-removing estimator survives only inside the opt-in diagnostics (`lyricscapeSync`) so real telemetry can judge it.
* Not verified: a real Spotify session, real Bluetooth latency. `LocalBackend` uses the audio stack's reported output latency.

## 5. Tests and regressions

* New: `tests/sync-audit.test.ts` (5 reproductions of audited defects), `tests/lyric-timeline.test.ts` (parsing, provenance, serialization,
  gaps, repeated sections, offsets, edited timing, Lyricsfile, version matching, ownership, backward compatibility, renderer determinism),
  `tests/playback-clock.test.ts` (clock, telemetry, Spotify polling, local playback, buffering), `tests/autoalign.test.ts` (aligner
  integration and the loopback-only proxy). All pass.
* Existing suite: all previously passing tests still pass, with **one test changed on purpose**: `PlaybackClock` "slews on small
  drift" asserted an instant nudge; the clock now never jumps for small drift, so the test asserts continuity and convergence instead.
* **Pre-existing flake, not a regression:** `tests/social.test.ts` "recommendations are direct…" fails about half the time (3 of 6 runs
  today) because two notifications created in the same millisecond tie in a `createdAt` sort. `lib/server/` and that test are
  untouched on this branch.
* `pnpm build` and `pnpm test:e2e` (4 Playwright tests against the production build) pass. The build briefly failed during this work: an over-broad
  find-and-replace of mine had flipped three unrelated `useState(false)` defaults on the settings page to `true` (a false "you opened localhost" alert that
  crashed prerendering). It was caught by the build, fixed, and the page diff now contains only the intended change.
* Preference migration: `syncShared` was removed from the UI (device delay and song offset replace it). Stored prefs from before
  carry no `splitV`; people who had "same for all songs" **off** start with device delay 0 so what they hear does not change.
  `tests/mood.test.ts` persistence test passes unchanged.

## 6. What this does not show

* English indie music only; commercial productions may behave differently. 20 songs is enough to see the shape, not to
  claim a tight confidence interval per genre.
* Human annotations are themselves imprecise by tens of milliseconds.
* Singing with overlapping voices, choirs, rap, or lyrics that differ from the recording will do worse.
* No claim is made about languages other than English, about Spotify audio (never accessible), or about real LRCLIB line
  timestamps (not measured).
