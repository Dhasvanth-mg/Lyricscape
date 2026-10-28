# Feature tracker

## Publication request (2026-10-27)

- Start: owner requested commit and push of the completed local changes on `feat/turbo`.
- Outcome: reviewed the change set and whitespace checks, confirmed configured author `Dhasvanth-mg`, and prepared the implementation, tests, documentation and tracker for publication. Local `.ref/`, `.claude/` and credentials are excluded. The final response records the verified commit and push result.

Updated: 2026-10-27. Status distinguishes implementation from verification. This file tracks requests from the current session onward. It is not a claim that every historical feature has been audited.

| Request | Status | Acceptance criteria | Evidence and remaining work |
| --- | --- | --- | --- |
| Spotify playback inside Lyricscape, volume and mute | Built, mocked browser verification complete | Explicit browser output, transport and volume controls, Premium errors shown | Commit `7a91a1c`; real Premium account audio remains owner-only verification |
| Improve Spotify lyric clock and prevent saved offset rollback | Built, automated verification complete | Follow SDK when active locally, avoid stale timing reads, preserve a new 209 ms edit over delayed 3000 ms reads | Playback tests and Edge regression pass; audible account sync still needs owner testing |
| Update README and architecture | Complete locally | Describe implemented local-first behavior and limits, preserve historical spec | Current guides include provider and library changes, original spec archived, 24 local documentation links resolve |
| Compare suggested lyrics repositories | Research complete | Inspect implementation and word timing, avoid assuming advertised sync is accurate | Myzel plugin flattens richsync to lines, LibreLyrics Spotify plugin uses line timestamps and session cookie; no copied plugin code |
| Use unofficial Musixmatch during development | Built, live retrieval verified | Preserve actual word stamps, validate recording identity, LRCLIB fallback, no tokens in browser/logs, disabled by default in production | Six focused tests and three route tests pass. Live Flashing Lights lookup returned word-synced lyrics (50 line cues, 702 word/end tags). Initial 401 rejection confirms fallback is needed. Audible timing is unverified. No website scraping |
| Existing Spotify playlists and saved content | Built, mocked browser verification complete | Read playlists, liked songs and saved albums, paginate, queue collection, show scope/access failures | Pagination, complete collection queues across unloaded pages, liked songs, saved albums, desktop and phone layouts passed Edge checks. Existing accounts must reconnect. Live account access remains unverified. Episodes/audiobooks are outside the music library scope |
| Auto queue, loop, shuffle and Smart Shuffle | App features verified; Spotify Smart Shuffle unavailable through Web API | Queue selected collection, loop off/all/one, shuffle, optional liked-song autofill | Edge verified next-track progression through collection and liked-song autofill, loop and shuffle controls. Local smart library mix is distinct from Spotify's recommendation-based Smart Shuffle, which the Web API shuffle endpoint does not expose. Local mix uniqueness and artist separation have unit coverage |
| Replace unofficial provider with licensed access before beta/production | Planned for beta preparation | Licensed provider and production verification | Deferred as requested; no paid credentials or purchase needed during current development |
| Track every future feature request and save instructions | Complete | Separate tracker, start/end updates for every request, repository and persistent instructions | This file created; repository AGENTS.md and C:/Users/dhasv/.codex/AGENTS.md both contain the standing rule |

## Request log

- 2026-10-27, start: received refreshed AGENTS.md instructions. Keep the feature tracking rule active and continue the pending provider/library implementation under those instructions.

- 2026-10-27, start: add persistent feature tracking at request start and end. Created this tracker while lyrics and library work remain active. No pending request was dropped.

- 2026-10-27, outcome: feature tracker and start/end rule saved in both instruction files. Refreshed AGENTS.md instructions acknowledged. Pending feature requests retained and verification results recorded above.

## Final verification (2026-10-27)

Typecheck, lint and production build passed. The build retains the existing dynamic-filesystem tracing warning. One full unit run passed 817 tests with one skipped. A subsequent run passed 816 and timed out in an FFmpeg video-render test during a multi-hour execution stall; the isolated recap rerun result is recorded below. The complete browser suite passed 14 of 16, with demo playback elapsed-time and Settings timeout failures; both passed unchanged on a focused rerun. Final Spotify playback and library tests passed together, including the Musixmatch alternate-version control, 209 ms offset race, complete collection pagination, autofill, shuffle and repeat. Desktop and phone screenshots were inspected. The running owner-requested app returned HTTP 200 from /api/health and remains running. No new commit or push was performed.

- Outcome: feature tracking instructions saved persistently and in repository AGENTS.md. Library and development provider implementation complete within the documented API limits. Live Spotify library access and audible word sync still require owner account testing. The paid provider migration remains planned for beta/production.

Isolated recap rerun: all eight tests passed, including the real FFmpeg video/photo case, in 42.18 seconds. No test expectations or timeouts were changed.
