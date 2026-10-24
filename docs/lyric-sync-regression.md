# Regression: ~1 s of lyric drift after the sync rebuild

Reported: *Mine* (Bazzi) was in sync at Device 0 ms before the rebuild and about 1000 ms off after it; several other songs
seemed to need 1000-1500 ms. This note says what changed, shows the evidence, and records the fix. Nothing here applies an
offset to hide the problem.

## Answer

The rebuild changed **two things that each move lyrics by about a second**, on top of identical lyric timestamps. Both are now
back to their pre-rebuild behaviour. A third, smaller one (word spread) is also restored. Four candidates were checked and ruled out.

| Candidate | Verdict | Size | Evidence |
|---|---|---|---|
| **Playback-position estimation** (telemetry age) | **cause** | −1960 / +1000 ms on this PC, ±1000 ms even on an accurate clock | §2 |
| **Presentation of line-synced lyrics** (shown as a unit instead of word by word) | **cause** | later words appear a median 1.7 s (last words 3.6 s) earlier than before | §3 |
| Estimated word spread (parser change) | contributing, small | p90 error 1620 ms vs 1025 ms before | §3 |
| Device / output latency calculation | ruled out | Spotify reports none (0), formula unchanged | §4 |
| Offset sign / composition | ruled out | `position + device` is exactly `position + offset` | §4 |
| Preference migration | ruled out | nothing stored here; migration test passes | §4 |
| Lyric source | ruled out for *Mine* | same LRCLIB record, 26/26 identical lines | §4 |

## 1. A fact about this machine that decides most of it

This PC's clock is **60.4 s ahead of Spotify's** (Spotify's own `Date` response header against the local clock;
`w32tm` against NTP independently says about 59 s). The old code computed the telemetry age as

    age = clamp(Date.now() − state.timestamp, 0, 2000)

With a 60 s error that is the clamp: **a constant +2000 ms added to every Spotify position**. Real use (your "Mine was in
sync at Device 0") was therefore calibrated against `progress_ms + 2000`, whatever the cause of the lag it was compensating.

The rebuild replaced that with a skew-removing estimator. Its premise, that staleness is small and clock error large, can't be
checked from a browser: Spotify's `Date` header is not exposed to page scripts (CORS shows only `content-length` and
`content-type`; verified in the app's browser pane). My earlier validation only used staleness values I had assumed.

## 2. Playback clock: old vs rebuilt on identical telemetry

`tools/sync-report/ab/clock_ab.ts` feeds the same scripted `/me/player` responses to three implementations and prints each
one's position **minus the pre-rebuild position** (0 = unchanged). Spotify's `timestamp` is either (F) the time the response was
produced, or (L) the time playback state last changed; a browser can't tell which, so both are run.

| Scenario | Rebuilt estimator vs old | Shipped now vs old |
|---|---|---|
| **This PC** (clock +60.4 s), F, state 1.0 s stale | **−1960 ms** (lyrics ~2 s later) | 0 |
| **This PC** (clock +60.4 s), L | **+1000 ms** (lyrics 1 s earlier) | 0 |
| Accurate clock, F, 1.0 s stale | −1000 ms | 0 |
| Accurate clock, F, 0.1 s stale | 0 | 0 |
| Accurate clock, L | +1000 ms | 0 |
| Clock 5 s behind, F, 1.0 s stale | +40 ms | 0 |

Under (L) the rebuilt estimator's age also runs to its 3000 ms cap, 1000 ms beyond the old 2000 ms cap (a regression test,
`tests/sync-regression.test.ts`, reproduces exactly that). Under (F) it throws away any systematic reporting lag, because a
constant lag looks like clock skew. Either way the position moved by about the size you saw. **The direction depends on
Spotify's undocumented `timestamp` meaning, which this session could not observe**; the diagnostics below record it.

Constant or changing? Under (F) the shift is **constant** for the whole song. Under (L) it **steps**: about −1.9 s for the first
poll after a track starts or you seek, then +1.0 s from the second poll on.

## 3. What the lyric screen does with the same timestamps

The lyric *timestamps* are unchanged: old and new parsers give identical line starts for *Mine* (max difference 0 ms over
26 lines). What changed is when each **word** appears. The rebuild's default showed line-synced lyrics as a unit (the whole line at
its start) instead of spreading the words, so `tools/sync-report/ab/visual_ab.ts` on *Mine*'s real lyrics gives, NEW minus OLD:

| Words | median shift |
|---|---|
| first word of a line | 0 ms |
| middle words | **−1698 ms** (appear that much earlier) |
| last word | **−3593 ms** |
| all words | −1582 ms |

Against the human annotations (20 songs, 5,693 words; `tools/sync-report/ab/word_estimate_ab.ts`), when each word appears minus when it is sung:

| Treatment | median \|error\| | p90 | within 200 ms | signed median |
|---|---|---|---|
| Old (word-by-word estimate) | 231 ms | 1025 ms | 46.3 % | +171 ms |
| Rebuild default (line as a unit) | **745 ms** | **2776 ms** | **22.1 %** | **−745 ms (early)** |
| Rebuild, estimate switched on (before the fix) | 252 ms | 1620 ms | 43.6 % | +222 ms |
| Estimate on, after the fix | 226 ms | 1061 ms | 46.2 % | +171 ms |

The pattern is **not constant**: it is 0 at the start of every line and grows to seconds by its end, then resets. If the first word
of each line lands on time and the later ones feel early, that is this. The parser change in the third row spread the words over
the whole gap to the next line (up to 10 s) instead of over a sung-line length, which pushed later words late.

My earlier report called the unit display "honest", which it is about *claims*; it ignored that it is a worse match for what
people hear (22 % vs 46 % of words within 200 ms). I had weighed labelling against accuracy and chose labelling.

## 4. Ruled out

* **Output latency.** `SpotifyBackend` defines no `outputLatencyMs`, so the automatic term is 0 (`player.getOutputLatencyMs()`).
* **Composition and sign.** `lyricTime = position − outputLatency + deviceAdvance + trackOffset`; for Spotify that is `position + device`,
  identical to the old `position + offset` for any value (test: `the formula … did not change meaning`).
* **Preferences.** This browser pane has no stored prefs (nothing to migrate). A saved shared offset (e.g. Spotify +300) hydrates
  unchanged as the device delay and the song offset starts at 0 (test). "Device 0 ms" was never touched.
* **Lyric source.** With Spotify's 131 s (or 130 s), LRCLIB's exact lookup hits record 9031800 and old and new lookups pick it:
  26/26 identical lines (`tools/sync-report/lyric_source_ab.ts`). Only if Spotify reported 132 s would the exact match miss and the
  two lookups pick different records (first cue 4730 ms vs 4490 ms). Your saved copy of the lyrics in your own browser would show which one you have.

## 5. The fix (smallest set that restores the old behaviour, each with a failing test first)

`tests/sync-regression.test.ts`; five of its tests failed on the rebuilt code (numbers in §2/§3), all pass now.

1. **Telemetry age** is `clamp(Date.now() − timestamp, 0, 2000)` again (`telemetryAgeMs`). Epoch guards, in-flight command guard and continuous
   slewing from the rebuild are kept: they change *when* a stale answer is applied, not what position it implies.
2. **Word-by-word motion on line-synced lyrics defaults to ON** (it was the pre-rebuild behaviour). The lyrics are still labelled "Line-synced" and
   Settings → Lyrics explains the words are estimated and can switch it off.
3. **Word spread** is bounded by a sung-line length again (`estimatedSpreadEnd`); the line's display end is unchanged.

The skew-removing estimator is no longer used for the position. It runs only inside the opt-in diagnostics, so real data can show whether it is ever better.

## 6. Diagnostics (opt-in, no UI)

    localStorage.setItem('lyricscape.debug.sync', '1')   // then reload; or open the app with ?syncdebug=1
    lyricscapeSync.summary()      // is Spotify's timestamp fresh or a last-change time? raw vs applied age, RTT
    lyricscapeSync.probeClock()   // your PC's clock vs Spotify's, to about ±150 ms (asked of the app server, because the browser cannot)
    lyricscapeSync.dump()         // every poll and SDK event

Play *Mine* with it on and run `summary()`: **`timestampBehaviour`** settles F vs L, and `rawAgeMedianMs` against `probeClock()`'s offset
gives Spotify's real reporting lag. That would justify (or reject) a smarter age formula with data instead of assumptions.

## 7. What is still not known

* Whether Spotify's `timestamp` is response time (F) or last-change time (L), and so the true size of its reporting lag.
* Whether this fully matches your ears. It restores the pre-rebuild computation exactly (0 ms difference on identical telemetry, and the same
  word timing within rounding), which is what you verified before; I could not listen to a real Spotify session.
* The earlier claim that the rebuild "fixed" clock-skew error rested on a staleness model I assumed. It is withdrawn: the A/B above shows the
  model changing positions by seconds on the one machine where it could be checked. Section 4 of `lyric-sync-report.md` has been corrected.
