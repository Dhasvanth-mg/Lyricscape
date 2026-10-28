# Spotify compliance notes

Lyricscape follows the README's rules. This is engineering guidance, not legal advice; check the current
[Spotify Developer Policy](https://developer.spotify.com/policy) before any public release.

## What the Spotify integration does

- Official OAuth (Authorization Code + PKCE), minimal scopes, tokens refreshed and revocable (Disconnect).
- Search and metadata via the Web API; play/pause/seek/volume on **your own** Spotify Connect devices (including this tab via the Web Playback SDK, Premium).
- Follow mode: reads your playback state to show lyrics next to whatever you are playing.
- Honest failure states: no Premium, no active device, 401 (reconnect), 403 (dev-mode allow-list), 404, 429 (`Retry-After`, global backoff).

## What it deliberately does not do

| Not done | Why |
|---|---|
| Read, record, analyse or process Spotify audio | Not available and not permitted; beat analysis uses imported/CC0 audio only |
| Mix/overlap Spotify recordings, or render them into video | Policy; the recap engine refuses `spotify` soundtracks (HTTP 422) |
| Alter Spotify artwork (masks, tilt, recolour, blur) | Policy. **Waived in this personal-use build**: the cover is blurred/tinted as a background for every track. Restore an unmodified-art mode before any public deployment. |
| Scrape Spotify or lyrics websites | Spec rule. Lyrics come from the user, bundled CC0 files, or the optional LRCLIB and development Musixmatch APIs |
| Ingest Spotify content into AI | Policy; no AI features touch Spotify data |

## Lyrics next to Spotify playback

Spotify provides no lyrics API. Lyrics shown beside a Spotify track come from the user (paste/import/`.lrc`) or from an opt-in
LRCLIB lookup (title, artist, length only). Whether showing synchronized lyrics beside Spotify playback is acceptable for a
**public** product is a licensing question (Spotify permission plus a lyrics licensor). For personal use in Development Mode it is a
local display feature; keep it that way unless you obtain the rights.

## Development Mode limits

Owner-requested development exception: the optional unofficial Musixmatch mobile JSON API now precedes LRCLIB. It sends title, artist, album and duration, preserves provenance and word timestamps, and falls back on rejection. It does not fetch website pages or establish licensed access. Replace it with licensed access before beta/production. It is disabled by default in production.

Library browsing adds read-only playlist and saved-library scopes. Collection playback uses Lyricscape's app queue. Local smart library mix is distinct from Spotify Smart Shuffle.

Up to five authorized users, listed under *User Management* in your Spotify app dashboard. Redirect URIs must use `127.0.0.1` (not `localhost`) for HTTP loopback; the Settings page shows the exact URI to register.

## Album colors and mood (visualizer)

- **Palette from cover art:** the visualizer reads a few dominant colors from a 48 px thumbnail of the cover to theme the stage. The cover is also shown blurred as the stage background (personal-use build, see the table above). If Spotify's image host does not allow reading pixels (CORS), extraction fails quietly and a derived palette is used instead. If you want zero pixel reads of Spotify art, choose **Mood** as the color source: that mode never uses the cover colors.
- **Mood detection:** a lexicon + tempo heuristic over lyrics (no ML, no Spotify audio features). For Spotify tracks only the lyrics are used. Moods only pick colors, emoji and doodles.
