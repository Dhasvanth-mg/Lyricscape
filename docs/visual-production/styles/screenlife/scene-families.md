# Screenlife: scene families and composition grammar

Style 1 of 15. Phase 2 planning (generated from planning data).

## Scene families (12)

| ID | Scene family | What it is | Roles | Chosen by (signals) | Compositions | Required families | Optional families |
|---|---|---|---|---|---|---|---|
| SCR-SCN-01 | Late-night messages | A dark-theme messenger in a dark bedroom; the thread grows; the lyric is what you are about to send. | verse, chorus | perspective addressed; subjects romance, night and city; dark or late-night moods | C1, C4, C2, C5 | SCR-UIK-APP, SCR-UIK-STA, SCR-FRM-DEV, SCR-ENV-ROM | SCR-PRP-NTF, SCR-PRP-STK, SCR-REV-CAR, SCR-TEX-GLS |
| SCR-SCN-02 | Notes to self | A light-theme notes app, cream surface, morning light; lines are written as a list or a paragraph and occasionally struck through. | verse, quiet | perspective inward; subjects memory, self; calm moods | C2, C1, C4 | SCR-UIK-APP, SCR-UIK-STA, SCR-FRM-DEV | SCR-ENV-ROM, SCR-REV-CAR, SCR-TEX-GLS |
| SCR-SCN-03 | Search at 3 a.m. | A search field; while typing, suggestions appear underneath; the top suggestion is the song's next line (only already-timed lines, never invented). | bridge, verse | questions in the lyric (how, why, what, who, where; and equivalents in Hindi and Tamil lexicons); anxious or longing moods | C2, C1 | SCR-UIK-APP, SCR-UIK-STA | SCR-FRM-DEV, SCR-ENV-ROM |
| SCR-SCN-04 | The draft document | A word processor page in serif; the song is written as a letter or story; edits and deletions visible. | verse, bridge | perspective narrative; long lines; storytelling rap; letters | C3, C1, C2 | SCR-UIK-APP, SCR-UIK-STA, SCR-FRM-DEV | SCR-ENV-ROM, SCR-TEX-GLS |
| SCR-SCN-05 | Post and caption | A photo post composer where the photo is the album cover (unmodified) and the lyric is the caption; reactions arrive on hooks. | chorus, high | energetic moods; party, confidence, celebration subjects; hooks | C1, C2, C4 | SCR-UIK-APP, SCR-UIK-STA, SCR-FRM-DEV | SCR-PRP-STK, SCR-PRP-NTF, SCR-ENV-ROM |
| SCR-SCN-06 | Terminal session | A green or amber CRT terminal; the lyric is typed as a command or a message to another user; output lines are song metadata (time, line number). | verse, chorus, break | electronic, industrial, techno, hacker-themed tags; cold moods | C7, C3 | SCR-UIK-APP, SCR-UIK-STA, SCR-TEX-GLS | SCR-FRM-DEV |
| SCR-SCN-07 | Code editor | An editor where the lyric is typed as a comment or a string; syntax colours from the cover accent; no real languages' error messages as decoration. | verse | only when the song is about code or the user picks it; explicitly not the default for electronic music | C3, C2 | SCR-UIK-APP, SCR-UIK-STA, SCR-FRM-DEV | SCR-ENV-ROM |
| SCR-SCN-08 | Lock screen and notifications | The phone's lock screen: clock is song time; notifications are sung lines and metadata. | intro, break, outro, quiet | always available; preferred for intros and outros | C6 | SCR-UIK-APP, SCR-PRC-WAL | SCR-PRP-NTF, SCR-FRM-DEV, SCR-ENV-ROM |
| SCR-SCN-09 | Voice memo | A recorder app: a waveform scrolls, the transcript of the lyric appears word by word (authored) or line by line; no typing at all. | verse, quiet | acoustic, spoken word, singer-songwriter; sparse lines | C1, C2, C4 | SCR-UIK-APP, SCR-UIK-STA, SCR-FRM-DEV | SCR-ENV-ROM |
| SCR-SCN-10 | Plans and lists | A to-do list or calendar: each line becomes an item that gets ticked when sung; the chorus becomes a recurring event. | verse, chorus | upbeat, routine, determination subjects; list-like lyrics (repeated structures) | C1, C4, C2 | SCR-UIK-APP, SCR-UIK-STA, SCR-FRM-DEV | SCR-PRP-NTF, SCR-PRP-STK |
| SCR-SCN-11 | Night drive display | A car's centre display at night; the lyric arrives as the navigation instruction banner; streetlights sweep across the cabin. | verse, bridge | night and city, driving, travel subjects | C1 | SCR-UIK-APP, SCR-UIK-STA, SCR-FRM-DEV | SCR-REV-CAR |
| SCR-SCN-12 | Old desktop | An invented late-1990s desktop on a CRT monitor: chunky windows, a chat window and a notepad; original design language, not an imitation of a real OS. | verse, chorus, bridge | nostalgia, memory subjects; older songs (release year before 2005 if metadata has it) | C3, C1 | SCR-UIK-APP, SCR-UIK-STA, SCR-FRM-DEV | SCR-TEX-GLS, SCR-PRC-WAL |

### Structural attributes (used for the similarity check)

| ID | Scene | structure | subject | env | depth | motion | light | density |
|---|---|---|---|---|---|---|---|---|
| 01 | Late-night messages | thread | conversation | bedroom at night | device in room | typing and send | screen glow in dark | medium |
| 02 | Notes to self | document | private note | morning kitchen or desk | device in room | slow typing and edits | daylight | low |
| 03 | Search at 3 a.m. | single field with suggestions | a question | none (macro) | macro | typing with suggestions | screen glow in dark | low |
| 04 | The draft document | page | a letter or story | desk at night | window stack | typing and paragraph flow | lamp and screen | medium-high |
| 05 | Post and caption | photo composer | a public post | outdoors or event lights | device in room | caption typing, reactions | colourful event bokeh | medium-high |
| 06 | Terminal session | terminal | commands and output | none or dark room | flat CRT | typing and scrolling output | phosphor | medium |
| 07 | Code editor | editor with gutter | comments and strings | desk | window stack | typing in a line of code | screen glow | medium |
| 08 | Lock screen and notifications | notification stack | time and arrivals | wallpaper | flat | notifications drop, clock ticks | wallpaper glow | very low |
| 09 | Voice memo | waveform with transcript | a recording | bedroom or car | device in room | transcript words appear, waveform scrolls | low warm | low |
| 10 | Plans and lists | checklist or calendar | plans | daytime desk | device in room | items added and ticked | daylight | medium |
| 11 | Night drive display | dashboard | directions | car interior with passing lights | dashboard in car | nav banner updates, passing streetlights | sodium streetlight sweeps | low |
| 12 | Old desktop | retro windows | old chat and documents | bedroom with CRT monitor | window stack on CRT | typing, window pops | CRT glow | medium |

**Similarity check.** Pairs of scene families that differ in fewer than 3 of the 7 structural attributes: none. Palette is deliberately not an attribute (a recolour is not a different scene).

## Composition grammar

**Layer order (back to front):**

1. room or environment plate (ENV)
2. device shadow
3. device frame (FRM)
4. wallpaper (PRC wallpaper, only lock and desktop)
5. UI sheet: kit state (UIK) with earlier lines
6. active field with lyric and caret (REV)
7. overlays: notifications, stickers, reactions (PRP)
8. glass reflection and smudge (TEX)
9. post: grain, focus blur, motion blur, CRT scan for terminals

**Required.** One app kit state with an active field; one device frame (or none in C2, C6 portrait, C7); one camera configuration; one typing profile (or transcript reveal in Voice memo).

**Optional.** Room plate (required in C1 and C5), notifications (max 1 on screen besides the lock screen stack), stickers (max 1 per section, chorus only), glass reflection.

**Scale and position constraints.** Lyric x-height floors as in typography; device never smaller than 55% of the frame height in landscape; notifications never larger than the lyric field.

**Typography-safe regions.** Lyric box in the title-safe 84% x 80% and outside the bottom 14% player-chrome zone; overlays never intersect the lyric box (layout solver pushes them to the opposite half).

**Colour compatibility.** One theme per device world; accent from cover; stickers use accent or complementary only; room plate tinted by the theme spill.

**Motion compatibility.** Only one of camera push, whip pan or scroll per 600 ms window; no camera move during the last 300 ms of a line's typing.

**Material compatibility.** CRT plates only with terminal and old desktop kits; glass smudge never with CRT; hand silhouette never with desktop monitors.

**Complexity limits.** Max 6 visible UI widgets besides the lyric field; max 1 overlay; max 2 devices.

**Invalid combinations.**

| This | never with | Because |
|---|---|---|
| Light theme | bloom or glow post | Blows out white UI (observed). |
| Terminal kit | stickers or reactions | Different device worlds. |
| Post and caption | cover crop altered or recoloured | Cover must be shown unmodified (Spotify artwork policy). |
| Any kit | invented third-party messages | Fabricated conversation rule. |
| Two Screens (C5) | portrait small mobile with both full devices | Fields become too small; use the receiver banner instead. |
| Hindi, Tamil, Arabic text | typo model | No typos inside complex scripts. |
| Code editor | default for electronic songs | Only when chosen or the lyric is about code. |

## Meaningful variation

**Major (change the scene):**
- App family (what kind of writing: message, note, search, document, post, terminal, memo, list, nav)
- Device (phone, tablet, laptop, CRT, car display)
- Composition family (over the shoulder, macro, desktop, thread, two screens, lock, terminal)
- Environment plate (bedroom, kitchen, train, car, desk, event)
- Typing profile (who is writing: hesitant, confident, angry, tired)

**Minor (parameters, not new scenes):**
- Theme (dark or light) within a device world
- Accent colour from the cover
- Wallpaper generator configuration
- Sticker choice
- Camera noise seed

**Not counted as assets or as variety:** Recolours of a kit by accent; the same kit in dark and light (one asset with a theme parameter); per-line thread content (runtime); typing timing per line (runtime).

## Deterministic selection

Device world = hash(trackId, "scr-world") picks among devices allowed by identity (portrait export prefers phone). App family order per song: start with the family that best matches perspective and subjects (table in scene-families.md), then each new section takes the next family in a seeded order with role compatibility; first chorus fixes the chorus family; later choruses reuse it. Typing profile = energy tier then hash. Everything is a pure function of (trackId, lyric version, settings, section index), so live playback and export match.

## Repetition control

Within a song: no app family twice in a row except chorus recall; at most 4 app families per song (coherence); a sticker appears at most twice per song. Across songs: the first app family is chosen with a per-user rotation salt stored locally (lastFamilies ring of 5) only when the user turns on "vary between songs"; otherwise pure track hash. Export always uses the pure track hash (no local history) unless the user pins a scene family.

## Rejected and merged scene families

| Candidate | Decision | Reason |
|---|---|---|
| Spreadsheet cell | rejected | Cold and joke-like; it reads as office satire rather than intimacy, and repeats the Konstrukt grid idea. |
| Video call grid | rejected | Needs faces and people; likeness and fabricated-person risks; the brief forbids invented conversations. |
| Dating app profile | rejected | Cliché and close to real-brand interfaces; trivialises lyrics. |
| Banking or payment screen | rejected | Would look like a payment flow; fabricated-record risk. |
| Smartwatch glance | merged into SCR-SCN-08 | Merged into Lock screen and notifications as a device frame for very short lines only (SCR-FRM-DEV-009). |
