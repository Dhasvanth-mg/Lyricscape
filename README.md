# Lyricscape

Lyricscape is a local-first music player with kinetic lyrics, a private listening map, collaborative parties and automatic media recaps. It runs on one machine. Supabase, Vercel, R2 and cloud job orchestration are future adapters, not requirements for the current app.

The app uses Next.js 16, React 19, TypeScript 6, Tailwind 4, Zustand and Zod. Browser playback uses Spotify's official SDK or local audio. The visual stage has Canvas 2D and WebGL2 renderers. A separate Node worker uses FFmpeg for party recaps.

## Run locally

Install Node.js 20.9 or newer and pnpm. On Windows, double-click **start.bat**, or run:

```bash
pnpm go
```

Open **http://127.0.0.1:3000**. Use this address rather than localhost so the origin matches the Spotify redirect. The launcher installs missing dependencies, starts the web app and opens the browser. It does not start the recap worker.

For manual startup, run pnpm install followed by pnpm dev. Run pnpm dev:all to start the web app and media worker together, or pnpm worker in a second terminal if the web app is already running.

Click **Try the demo songs** to listen without configuring Spotify. The bundled audio, lyrics and artwork are original CC0 fixtures. You can also import audio and lyric files into the local library.

## Spotify playback

1. Create a Spotify developer app with Web API and Web Playback SDK access. For a development app, authorize the account you intend to use.
2. Register http://127.0.0.1:3000/spotify/callback as its redirect URI. If you use another port, register the exact URI displayed in Settings.
3. Enter the public Client ID in Settings and select **Connect Spotify**. The browser uses PKCE. No client secret is needed.
4. For playback inside Lyricscape, use Premium, wait for **Browser device ready**, and select **Play on this browser** in Settings, Listen's Spotify tab or Now Playing.
5. Search for a song in Listen and press Play. Volume, percentage and mute controls are available on desktop and phone layouts.

Browser selection targets Lyricscape for subsequent tracks and controls. **Follow Spotify device** follows the device selected in Spotify instead. The explicit output choice resets on a page reload. The clock also detects when the active device is the browser and uses its local SDK position automatically, rather than mixing it with aged remote API reports.

Automated Spotify checks use mocked SDK and API responses. Live audible sync remains under investigation. Premium and successful authentication do not by themselves verify every device or browser combination. See [Spotify integration notes](docs/spotify-compliance.md) for provider restrictions.

## Lyrics and sync

Press **L** or select **Lyrics stage**, then open **Sync**. The panel identifies the playback clock and the timing supplied by the lyric file.

Spotify provides playback position, not lyric timestamps. Lyrics come from saved/imported files, bundled demos, the unofficial Musixmatch API during development, or LRCLIB. Online lookup can be disabled in Settings. User-owned lyrics are protected from automatic replacement. Musixmatch preserves actual word offsets when available and otherwise returns line timing. Rejections fall back to LRCLIB. Set `LYRICSCAPE_UNOFFICIAL_MUSIXMATCH=false` to disable it. It is off by default in production and must be replaced with licensed access before beta/production. Live lookup of Flashing Lights returned word-synced lyrics through the app: 50 line cues and 702 word/end timestamp tags. Initial token probes also returned internal 401 responses, so fallback remains necessary. Audible accuracy has not been verified.

The Spotify tab in Listen includes playlists, liked songs and saved albums with pagination. Reconnect Spotify in Settings to grant the new library scopes. Use Play collection to fetch all remaining pages and create an app queue, then use shuffle and loop (off/all/one). Smart library mix removes duplicate songs and separates lead artists where possible. Optional auto queue appends up to 50 liked songs when starting a collection with Play collection or Smart library mix. These controls manage Lyricscape's queue. They do not enable Spotify's recommendation-based Smart Shuffle. Development Mode can restrict access to playlist contents. Podcast episodes, audiobooks and Spotify local-file entries are skipped.

**Word-synced** files supply individual word times. **Line-synced** files supply line starts, with word times estimated by the app when estimated word motion is enabled. Those estimates can run ahead or behind and reset at the next line. A correct Spotify clock cannot recover missing vocal word timestamps. Turn estimated word motion off in Sync to display lines from their supplied timestamps, or load a word-synced version for actual word cues. Plain text has no reliable sync.

For a consistent offset, use the device advance or per-song offset, or tap to anchor a line you can hear. Corrections never alter the saved timestamps. Playback time, automatic local output latency, device advance and song offset are separate terms. A constant offset cannot fix changing errors inside a line or a different recording/edit. See [sync measurements and limits](docs/lyric-sync-motion.md).

## What is implemented

- Persistent player, queue, shuffle/repeat, keyboard controls, session restore, local file import and Spotify playback/following.
- Deterministic kinetic lyrics with per-song identities, art directions, Studio adjustments and saved themes. Clean uses Canvas 2D. Turbo uses WebGL2 with Liquid light, Code screens, Sketch cards, Lyrics app, Acid grain and ASCII scenes.
- Script-aware lyric layout and matching, bundled Hindi/Tamil fonts, word segmentation and limited multilingual mood lexicons. Language support has documented limits.
- Browser lyric-video and PNG export using the stage's timeline and look. Videos contain no audio. MP4/WebM encoding requires a compatible WebCodecs browser.
- Local parties with profiles, guest invites, roles, song suggestions, votes, moderation, signed uploads, SSE updates and a big-screen display.
- Recap analysis, planning, versioned timeline editing and FFmpeg rendering in a separate worker, using eligible local/demo soundtracks.
- Opt-in foreground listening locations, coarse cells, privacy zones, retention, memories and trips. Local social profiles, friends, recommendations, posts, reactions and blocking.

See [stage modes](docs/stage-modes.md), [Turbo scene implementation](docs/turbo-styles.md) and the [implementation log](docs/implementation-log.md) for details and verification history.

## Data and configuration

Server profiles, parties, map history, social data and recap jobs live in .data/db.json. Uploaded party media and recap outputs live in .data/uploads. Server signing material is generated locally under .data unless configured through the environment.

Imported library files, saved lyrics, per-song looks and offsets live in browser IndexedDB. Player session data, Spotify tokens, saved themes and UI preferences also use browser storage. Different browser profiles or origins therefore have separate libraries and Spotify sessions. Local-first does not mean that these browser stores are included in a backup of .data.

See [.env.example](.env.example) for optional settings. Do not commit .env.local, tokens or server signing material. The app can use Spotify, development Musixmatch, LRCLIB and MusicBrainz over the network. Optional AI interpretation sends an excerpt and metadata to the configured gateway only when enabled. The normal player and visualizer work without that gateway.

## Development and verification

| Command | Purpose |
|---|---|
| pnpm go / start.bat | Install if needed, start the web app and open the browser |
| pnpm dev | Web app only |
| pnpm dev:all / pnpm worker | Web app plus worker / worker only |
| pnpm typecheck | TypeScript checks |
| pnpm lint | ESLint and React Compiler rules |
| pnpm test | Unit/integration suite, including real FFmpeg tests |
| pnpm build | Production build |
| pnpm test:e2e | Edge browser tests against a production build on port 3100 |
| pnpm smoke | Party HTTP checks against a running app |
| pnpm demo:generate | Regenerate the original CC0 demo assets |
| pnpm aligner | Optional local English lyric-alignment service |

The social notification-ordering test has a documented intermittent same-millisecond failure. A passing typecheck or unit suite does not verify canvas appearance or real Spotify audio. Visual changes need browser inspection. Read [AGENTS.md](AGENTS.md) before changing code.

## Current limits and future work

Local profiles have no password authentication. This build is intended for a trusted local machine and is not hardened for public internet hosting. Cloud authentication, database adapters, multi-user listening rooms, concert memories and a full screen-reader audit are not implemented.

The optional Python aligner is English-only and its output needs review. Spotify audio is never captured, downloaded or fed into local audio analysis. Lyric-video exports are silent. Party recap media and soundtracks have separate consent and rights checks, with known enforcement gaps documented in the architecture.

The five reference Turbo scenes have not been comprehensively checked with Hindi, Tamil or mixed right-to-left lyrics. Performance figures are hardware-specific measurements, not a guarantee for every device.

## Documentation

[Feature tracker](docs/feature-tracker.md) records requested work, status, verification and remaining gaps. [Current architecture](docs/architecture.md) explains the actual storage, playback, rendering and worker boundaries. [Implementation history](docs/implementation-log.md) records measurements and gaps. [Media rights](docs/media-rights.md) describes provenance and consent. The [original product specification](docs/original-product-spec.md) is preserved separately as historical design context and a list of proposed future capabilities.
