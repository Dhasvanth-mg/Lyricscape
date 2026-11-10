# Screenlife: design specification

Style 1 of 15. Phase 2 planning document (no production code or assets). Generated from the planning data; edit the data, not this file.


> The song is typed, deleted and sent across the screens of one person's life.

Origin: Code screens (Turbo), kept and redesigned; widened from developer screens to every kind of private writing. Phase 1 rank: 1 of 15 (Phase 1 score 8.6).

Companion files: [typography](typography.md), [composition](composition.md), [motion](motion.md), [scene families](scene-families.md), [asset strategy](asset-strategy.md), [manifest](asset-manifest.json), [compatibility](compatibility.json), [review register](review-register.md).

## 1. Creative identity

**Artistic philosophy.** Intimacy through the interfaces we confess to. A lyric is something a person is writing to someone, or to themselves; hesitation and correction are part of the performance.

**Core visual concept.** One invented device world per song. Each line is typed into a fictional interface (a message, a note, a search, a document, a caption, a terminal) at a human cadence, then sent, saved, deleted or left as a draft. The thread or document is the song's memory: earlier lines stay on screen above the current one.

**Emotional character.** Private, close, a little voyeuristic; tender in ballads, restless in fast songs, funny when typos and autocorrect argue with the lyric.

**Influences and references.** Screenlife cinema (Phase 1 B.39) for over-the-shoulder framing and typing as acting; the existing Code screens scene (rack focus, whip pans, dolly, sheets painted once into textures).

**Distinguishing characteristics.** The only style where the lyric has an author with intent and doubt inside the picture. No other style shows text being composed character by character with mistakes.

**Recurring motifs.** The blinking caret; the typing indicator; the send gesture moving a bubble up; delivered and read marks; the lock screen clock; a draft restored; a search that autocompletes with the song's next line.

**Intended density.** Medium. One interface in focus; the rest of the UI dims and blurs by depth. Never more than one active text field.

**Material and compositional language.** Glass and light: backlit screens, soft room bokeh, fingerprints and reflections at low strength. Composition is a camera looking at a device, slightly off-axis.

**Musical contexts.** Pop, R&B, indie, bedroom pop, hip-hop with addressed lyrics, singer-songwriter; any song written to "you". Weak for purely instrumental or chant-heavy music (falls back to lock screen and voice memo families).

**Constant across every variation.** The lyric is always the largest text in its UI; the caret is always visible while typing; exactly one invented OS design language per song; all chrome is fictional; non-lyric UI text comes only from song metadata.

**Why it is recognisable on any song.** A viewer recognises Screenlife from any frame because the lyric sits inside a working interface with a caret or a send state, seen through a camera with focus falloff.

**It must never look like:**

- A real app, OS or brand: no recognisable chat colours, icons, logos, notification sounds implied by branding, or app names that imitate real ones.
- A UI mock-up gallery: static screens with lyrics pasted in and no act of writing.
- Fabricated conversations: invented messages from other people that read as real chat logs. The other side of a thread is the song's own earlier lines or metadata, never made-up text.
- Developer-only clutter: error lists, stack traces and code as decoration (the weakness of today's Code screens).
- Bloom on light UI (observed in Phase 1 renders): light themes never get post-glow.

## 2. Colour, lighting and materials

**Palette system.** Two device themes, dark and light, each a fixed neutral ramp (dark: #0E1014 to #2A2F38 surfaces, #E9ECF1 text; light: #F6F5F2 to #DADDE2 surfaces, #15171B text). One accent per device world taken from the cover (most saturated cover swatch, clamped to L 45-60 in OKLCH) used for sent bubbles, caret, selection and the send control.

**Accent behaviour.** Accent marks acts, not decoration: the sent bubble, the selection highlight, the caret, an unread badge. A second accent (cover's complementary swatch) is allowed only for one sticker or reaction per section.

**Contrast requirements.** Lyric text inside UI keeps 4.5:1 against its bubble or field (WCAG AA) and 7:1 in the macro composition. Bubble colour is adjusted toward the theme neutral until contrast passes; the accent is never used behind the lyric if it fails.

**Lighting.** Screens are the light source. The room behind is lit by the screen colour (a weak spill matching the theme) plus one practical (a lamp, a window, streetlight) from the environment plate.

**Shadows.** Soft device shadow on the surface it rests on (when visible); no drop shadows inside the UI beyond the kit's own elevation spec.

**Surface materials.** Glass (screen), aluminium or plastic bezels, a desk or bed surface in deep blur. Fingerprint smudge and glare plates at 3-8% opacity.

**Texture system.** Almost none: glass reflections and a whisper of sensor noise (grain 0.03) for the camera. CRT terminals add scanlines and phosphor bloom (reuses POST scan/curve).

**Atmosphere.** Room bokeh discs from the environment plate; night scenes allow light rain on a window behind.

**Colour transitions.** Theme changes only at device changes (section boundaries). Accent eases between sections over 600 ms if the device world changes.

**Song-specific adaptation.** Cover palette sets accent and wallpaper; brightness and mood choose theme (night and dark moods choose dark; morning and light moods choose light); identity subjects choose the environment plate.

**Material and colour variation rules.** Neutral ramps are fixed per theme (identity); accent and wallpaper vary per song; per-scene variation never touches the neutral ramp.

## 3. Musical responsiveness

**Measured signals used.** Line start and end times (authored LRC), authored word times (enhanced LRC), gaps between lines, hook guesses from repetition, beat grid when present with its source and confidence.

**Estimates used (never treated as measured).** Estimated word times (about 53% within 200 ms), tempo from lyric timing, identity mood and perspective, energy guesses.

| Case | Behaviour |
|---|---|
| 1. Word-synchronised lyrics (authored word times) | Each word is typed so its last character lands on the word's authored end time; the caret waits between words. Selection or bold emphasis lands exactly on a word's start. Typos are allowed only inside words longer than four characters and are always corrected before the word's end time. |
| 2. Line-synchronised lyrics | Typing is spread across the line's duration with the typing profile's rhythm (bursts and pauses), finishing at 85% of the line; the remaining 15% is the send or save act. No per-word claims (no word-level emphasis timed to the voice). |
| 3. Estimated word timing | Treated as line-synced for typing and emphasis (soft mode, P4). Estimated times may only shape the cadence (where pauses fall) within ±30% of the even pace; no emphasis, selection or typo is timed to an estimated word. |
| 4. No reliable timestamps | Lyrics without reliable timestamps: Screenlife shows the whole lyric as a scrolling document or note at reading pace (Notes family, line every 3.5 s), labelled by the existing unsynced state; no typing performance is implied as sung. |
| 5. Instrumental sections | Gaps of 6 s or more: typing indicator dots, caret blink, notifications from metadata, screen dims after 8 s and locks after 16 s to the lock screen family; at the next line the phone wakes. |
| 6. Missing audio analysis (no beat grid, no energy) | No beat grid: camera micro-pushes and notification haptic pulses are removed; motion is driven only by lines and typing. The style looks complete without beats because typing is its rhythm. |

**Beat (only when present).** With a beat grid of confidence 0.6 or more: camera micro-push 1.5% on downbeats in choruses, typing bursts snap their start to the nearest eighth note within 60 ms. Never moves a cue time.

**Energy and mood.** Identity energy chooses the typing profile (calm: deliberate, hesitant; energetic: confident, angry bursts) and camera intensity tier.

**Lyric density.** Dense lines (over 14 characters per second): typing switches to dictation chunks (words appear in groups) so the line still finishes; very dense rap: paste profile (whole line appears with a quick selection sweep).

Styling never changes cue times: every behaviour above reads `lineAt()` and word times; nothing writes them.

## 4. Song-level progression

**Introduction.** Lock screen with the time (song elapsed time as the clock) and the wallpaper; the phone wakes on the first line's lead-in (800 ms before).

**Opening lines.** The first app opens empty; the first line is typed slowly (hesitant profile) to establish the act.

**Verses.** One app per verse; the thread or document accumulates line by line; camera stays settled handheld.

**Choruses.** First chorus: switch to the louder family (post and caption, or the same message sent again in the thread). Later choruses recall the first chorus's app and composition, escalated: a "sent again" bubble stack, reactions, larger macro push.

**Bridge.** A different device or a search: "how to" style search, the draft document, or a translator; a theme flip (dark to light) is allowed here.

**Instrumental breaks.** Typing indicators, metadata notifications, dimming and locking; the thread scrolls back to show the song so far.

**Repeated lines.** Repeated lines become the same bubble resent, marked "edited" or "sent again"; never retyped from scratch more than twice.

**High-energy moments.** High energy: faster typing profile, whip pans between apps on section changes, sticker reactions on hooks.

**Quiet moments.** Quiet: macro composition on the field, very slow push, caret blink at the song's rest.

**Ending.** The last message is sent, the screen dims, the phone locks; the lock screen shows one final notification with the song title; screen off to black over 2 s.

**Fallback without structure.** No hooks detected: sections are formed from gaps only; every third section changes app family. No gaps: change app every 26 s (MAX_SECTION_MS) at a line boundary.

**How scenes change.** Accumulative: the thread, document or note grows across a section; the device world persists across the song; only apps change.

**Long-term interest.** Across listens the same song always opens the same device world (seeded by track id). Across songs, the app family order is drawn from identity (perspective, subjects) and rotated by track id, so two addressed songs start in different apps more than half the time when the library allows.

## 5. Technical requirements

**Reuses.** terminal.ts and screens.ts camera grammar (rack focus via mip blur, whip with mblur, dolly), sheet painting into textures through host.tex with the LRU cache, POST scan/curve for CRT, lineAt() for timing, words[].timing for authored vs estimated.

**New (proposed extensions, Phase 3).** Kit layout engine (data-driven UIK states painted to canvas sheets), grapheme-aware typing function typingAt(line, t, profile) using Intl.Segmenter, typo model (Latin only), thread accumulation cache (one painted bubble per sung line), RTL mirroring of kits, metadata content rules.

**Performance targets (targets until measured).** Target (to measure): 2.5 ms GPU per frame at 1280x720 on the integrated GPU (today's shots measured 1.6-1.8 ms); CPU typing and layout under 1 ms per frame; sheet repaints only on line change (under 6 ms each, during the gap or the previous line).

**Memory target.** Target: under 48 MB of textures resident (current kit state sheet 2048x2048, thread sheet up to 1024x4096, room plate 1024x576, device frame 1024x2048).

**Fallbacks.** Canvas 2D tier: C4 and C6 face-on compositions without camera tilt or depth blur, typing kept; terminal without CRT curvature. Missing room plate: neutral gradient by theme.

**Export.** Pure functions of t; typing state computed from t (never accumulated per frame); sheets keyed by line index; fixed-step export works unchanged.

## 6. Quality evaluation

Readability at x-height floors on 1280x720, 720x1280, 1080x1080 and 390x844; typing finishes before each line's end in 100% of lines (automated: typingAt(line, line.untilMs) is complete); no estimated word gets a timed emphasis (unit test); brand review (no element resembles a real app; checked by a second reviewer against a list of major apps); light-theme frames have no bloom; RTL kit mirror screenshots reviewed by a reader; Hindi and Tamil typing never shows a broken cluster (frame-step test over every grapheme boundary).

## 7. Definition of finished (Phase 3)

- [ ] All 12 scene families render in both themes where allowed, at the four test sizes, with golden frames recorded
- [ ] Typing passes the timing tests for authored, line and estimated timing
- [ ] Hindi, Tamil, Arabic and Japanese sample songs reviewed frame by frame
- [ ] Brand-likeness review signed off
- [ ] GPU and memory targets measured on the owner's integrated GPU and the RTX 5050
- [ ] Export of a 3-minute song matches live frames (pixel diff under 1% at 10 sampled times)
- [ ] Reduced-motion variant reviewed

## 8. The twenty planning questions

**1. What does the style look like?** One invented device world per song. Each line is typed into a fictional interface (a message, a note, a search, a document, a caption, a terminal) at a human cadence, then sent, saved, deleted or left as a draft. The thread or document is the song's memory: earlier lines stay on screen above the current one.

**2. What makes it distinct?** The only style where the lyric has an author with intent and doubt inside the picture. No other style shows text being composed character by character with mistakes.

**3. What composition families does it contain?** C1 Over the shoulder; C2 Macro on the field; C3 Desktop windows; C4 Thread scroll; C5 Two screens; C6 Lock screen; C7 Full-frame terminal. Scene families: Late-night messages; Notes to self; Search at 3 a.m.; The draft document; Post and caption; Terminal session; Code editor; Lock screen and notifications; Voice memo; Plans and lists; Night drive display; Old desktop. Details in composition.md and scene-families.md.

**4. What are its typography rules?** Lyric (active field or newest bubble) > earlier lyric bubbles (60% opacity through depth blur) > UI chrome (labels, timestamps, 40%) > environment. Emphasis: Word level (authored timing only): selection highlight sweep, bold toggle, autocorrect bubble, or mistype-and-fix. Line level: the send act, a reaction on the bubble, "edited" tag. Spacing: No added letter spacing ever (UI text is set at the font's default); line spacing per kit (chat 1.25, notes 1.4, document 1.5). Full rules in typography.md.

**5. How does it animate?** Human, not mechanical: motion comes from a person writing and a camera operator watching. Everything has a cause (a key press, a send, a scroll). Typing 6-14 graphemes per second depending on profile and line pace; bursts of 3-8 graphemes; pauses 120-600 ms. Camera moves 220 ms (whip) to 6 s (push).

**6. How does it respond to lyrics and music?** Authored words: Each word is typed so its last character lands on the word's authored end time; the caret waits between words. Selection or bold emphasis lands exactly on a word's start. Typos are allowed only inside words longer than four characters and are always corrected before the word's end time. Lines: Typing is spread across the line's duration with the typing profile's rhythm (bursts and pauses), finishing at 85% of the line; the remaining 15% is the send or save act. No per-word claims (no word-level emphasis timed to the voice). No beat grid: No beat grid: camera micro-pushes and notification haptic pulses are removed; motion is driven only by lines and typing. The style looks complete without beats because typing is its rhythm.

**7. What exact assets must be produced?** 219 entries in asset-manifest.json across 14 asset families plus composition, scene and transition specs: Fictional app kits (16); Kit states (53); Device frames (10); Room plates (11); Wallpaper generators (8); Notifications and system overlays (14); Original reaction stickers (18); Caret, selection and correction overlays (10); Typing behaviour profiles (10); Typo models (6); Camera moves (12); Lyric field treatments (10); Metadata content rules (8); Glass and CRT surface plates (6).

**8. Why does each asset exist?** Each family's purpose: Fictional app kits: Each kit is a kind of writing, which is the main variation axis of the style (Phase 1 E.1). Kit states: States are what change within an app across a section, so a verse can evolve without changing app. Device frames: The device decides scale, framing and the world of the song (phone intimacy, laptop work, CRT memory). Room plates: Places the device in a life (bedroom, kitchen, train) and gives depth and light colour. Wallpaper generators: Lock screen and desktop backgrounds that carry the song's colour. Notifications and system overlays: Fill gaps meaningfully and mark acts (delivered, read, missed) using only song metadata. The rest in asset-strategy.md; each manifest entry carries its own purpose.

**9. Which assets are redundant?** 9 candidates were rejected or merged during review: Real-brand lookalike messenger (rejected: Brand likeness; Phase 1 J risk.); Social feed with comments (rejected: Fabricated third-party text.); Spreadsheet (rejected: Scene family rejected (see scene register).); Second messenger in a different style (merged: Redundant with Murmur; theme parameters already give variety.); Spreadsheet cell (rejected: Cold and joke-like; it reads as office satire rather than intimacy, and repeats the Konstrukt grid idea.); Video call grid (rejected: Needs faces and people; likeness and fabricated-person risks; the brief forbids invented conversations.); Dating app profile (rejected: Cliché and close to real-brand interfaces; trivialises lyrics.); Banking or payment screen (rejected: Would look like a payment flow; fabricated-record risk.) ...see review-register.md.

**10. How do assets combine?** Layer order: room or environment plate (ENV) > device shadow > device frame (FRM) > wallpaper (PRC wallpaper, only lock and desktop) > UI sheet: kit state (UIK) with earlier lines > active field with lyric and caret (REV) > overlays: notifications, stickers, reactions (PRP) > glass reflection and smudge (TEX) > post: grain, focus blur, motion blur, CRT scan for terminals. Required: One app kit state with an active field; one device frame (or none in C2, C6 portrait, C7); one camera configuration; one typing profile (or transcript reveal in Voice memo).

**11. Which combinations are invalid?** Light theme with bloom or glow post (Blows out white UI (observed).); Terminal kit with stickers or reactions (Different device worlds.); Post and caption with cover crop altered or recoloured (Cover must be shown unmodified (Spotify artwork policy).); Any kit with invented third-party messages (Fabricated conversation rule.); Two Screens (C5) with portrait small mobile with both full devices (Fields become too small; use the receiver banner instead.); Hindi, Tamil, Arabic text with typo model (No typos inside complex scripts.); Code editor with default for electronic songs (Only when chosen or the lyric is about code.)

**12. How do scenes vary meaningfully?** Major dimensions: App family (what kind of writing: message, note, search, document, post, terminal, memo, list, nav); Device (phone, tablet, laptop, CRT, car display); Composition family (over the shoulder, macro, desktop, thread, two screens, lock, terminal); Environment plate (bedroom, kitchen, train, car, desk, event); Typing profile (who is writing: hesitant, confident, angry, tired). Not counted as variation: Recolours of a kit by accent; the same kit in dark and light (one asset with a theme parameter); per-line thread content (runtime); typing timing per line (runtime).

**13. How is repetition prevented?** Within a song: no app family twice in a row except chorus recall; at most 4 app families per song (coherence); a sticker appears at most twice per song. Across songs: the first app family is chosen with a per-user rotation salt stored locally (lastFamilies ring of 5) only when the user turns on "vary between songs"; otherwise pure track hash. Export always uses the pure track hash (no local history) unless the user pins a scene family.

**14. How do scenes evolve throughout a song?** Accumulative: the thread, document or note grows across a section; the device world persists across the song; only apps change. First chorus: switch to the louder family (post and caption, or the same message sent again in the thread). Later choruses recall the first chorus's app and composition, escalated: a "sent again" bubble stack, reactions, larger macro push.

**15. How does the style adapt to different screen sizes?** Over the shoulder: portrait Phone face-on filling 92% of height; room visible only at edges; yaw reduced to 3 degrees. Macro on the field: portrait Field wraps to 2-3 lines at the same x-height; camera tilts to follow the caret line. Desktop windows: portrait Monitor cropped to the front window, back windows peek at the top; or switch to C1 phone. All families in composition.md.

**16. How does it handle different languages?** Hindi: Typing by grapheme cluster (Intl.Segmenter granularity grapheme), never by code point, so matras and conjuncts never appear half-built. No typos, no letter spacing. Optional Hindi keyboard transliteration composition (romanised input turning into Devanagari) is a proposed extension, deferred to after Phase 3 core. Tamil: Grapheme-cluster typing as for Hindi; Tamil words are long, so dictation chunking starts at 10 graphemes per second instead of 14 characters. Mixed: Each run is shaped in its own font by the browser font stack; typing proceeds by grapheme across runs; selection emphasis applies to whole words only. RTL: Arabic and Hebrew: kits mirror (outgoing bubbles on the left, caret at the left edge of the run); typing by grapheme in logical order; bidi handled by the browser text engine on the sheet canvas. Requires mirrored kit layouts (UIK states have an rtl flag). Fallback: If the kit's face lacks the script, the run falls back through the stack: Inter -> Noto Sans Devanagari / Tamil / Arabic / Hebrew -> system. The kit never changes its layout when falling back; only the glyph source changes.

**17. What technical infrastructure does it require?** Kit layout engine (data-driven UIK states painted to canvas sheets), grapheme-aware typing function typingAt(line, t, profile) using Intl.Segmenter, typo model (Latin only), thread accumulation cache (one painted bubble per sung line), RTL mirroring of kits, metadata content rules. Reuses: terminal.ts and screens.ts camera grammar (rack focus via mip blur, whip with mblur, dolly), sheet painting into textures through host.tex with the LRU cache, POST scan/curve for CRT, lineAt() for timing, words[].timing for authored vs estimated.

**18. What performance constraints apply?** Target (to measure): 2.5 ms GPU per frame at 1280x720 on the integrated GPU (today's shots measured 1.6-1.8 ms); CPU typing and layout under 1 ms per frame; sheet repaints only on line change (under 6 ms each, during the gap or the previous line). Target: under 48 MB of textures resident (current kit state sheet 2048x2048, thread sheet up to 1024x4096, room plate 1024x576, device frame 1024x2048).

**19. How will production quality be evaluated?** Readability at x-height floors on 1280x720, 720x1280, 1080x1080 and 390x844; typing finishes before each line's end in 100% of lines (automated: typingAt(line, line.untilMs) is complete); no estimated word gets a timed emphasis (unit test); brand review (no element resembles a real app; checked by a second reviewer against a list of major apps); light-theme frames have no bloom; RTL kit mirror screenshots reviewed by a reader; Hindi and Tamil typing never shows a broken cluster (frame-step test over every grapheme boundary).

**20. What must be completed before the style is considered finished?** All 12 scene families render in both themes where allowed, at the four test sizes, with golden frames recorded; Typing passes the timing tests for authored, line and estimated timing; Hindi, Tamil, Arabic and Japanese sample songs reviewed frame by frame; Brand-likeness review signed off; GPU and memory targets measured on the owner's integrated GPU and the RTX 5050; Export of a 3-minute song matches live frames (pixel diff under 1% at 10 sampled times); Reduced-motion variant reviewed.
