# Master creative direction

Phase 2 planning. This document sets the rules every one of the 15 styles follows. Each style's own `design-spec.md` adds its identity on top of these rules; where a style needs an exception, its spec says so and gives the reason.

## 1. What the collection is

Lyricscape turns a song's lyrics into a moving image that is different for every song and still unmistakably one of 15 styles. The collection should feel like 15 directors working on one festival, not one template in 15 colours. Every style must therefore:

- own a **medium** that no other style uses (a screen, a printed page, paper on sticks, film, light, ink, hardware, a beam, architecture);
- own a **motion language** that follows from that medium (a card drops, a flap cycles, a brush pools, a beam travels);
- give the **lyric** a role inside that medium (the lyric is the sign's text, the balloon's speech, the façade, the stroke), never a caption laid over a background;
- adapt to the **song** through data the app really has (timing, timing confidence, identity, cover, lexicon, structure, beat grid with confidence), and say what it does when that data is missing.

## 2. The 15 and how they divide the space

| Group | Styles | What separates them inside the group |
|---|---|---|
| Screens and devices | Screenlife, Signage | Personal screens vs public hardware |
| Print and paper | Folio, Sketch Cards, Panels, Paper Theatre | Editorial page vs hand-made card vs sequential page vs physical stage |
| Film and light | Celluloid, Nocturne, Liquid Light Show, Phosphor | Film material vs lens light vs projected fluid vs a single beam |
| Gesture and graphic | Ink, Konstrukt, Glyph Cinema | Brush gesture vs geometric rhythm vs characters as pixels |
| Song-specific and spatial | Cover Pop, Monument | The song's own artwork vs words as architecture |

Two styles in one group must differ on at least three of these axes: medium, motion language, depth structure, type role, colour source, and density. `reviews/visual-differentiation.md` checks this.

## 3. Principles every style follows

1. **The lyric is readable first.** Active lyric text meets 4.5:1 contrast against what is directly behind it (most styles target 7:1). No style may trade readability for effect. Styles that put text over images (Cover Pop, Nocturne, Celluloid) declare how they guarantee contrast.
2. **Honest timing.** Word-level effects run only on authored word timing. Estimated timing (about 53% of words within 200 ms) gets line-level or reading-order reveals with no per-word claims. No timing gets a fixed cadence. Every style states these three cases in its spec.
3. **Honest data.** Nothing pretends to analyse audio the app does not analyse. No spectrum bars, no fake waveforms, no invented metadata. Beat-locked behaviour runs only when the beat grid is present and confident, and every style is complete without beats.
4. **Determinism.** Every frame is a pure function of track, settings and time. Seeds come from the track and line index. Export must equal playback frame for frame.
5. **One focal point.** At any moment one thing is active: one card, one panel, one sign, one façade, one beam. Everything else supports it.
6. **Restraint in colour.** Each style sets its own colour budget (for example, Ink allows one ink plus one accent word per section; Signage allows one light family per sign). Colour from the cover is used where the style is about the song's image; it is never a substitute for design.
7. **Original work only.** References are for method. No real brands, logos, interfaces, signs, characters, title sequences, buildings, landmarks or recognisable artist styles. No traced artwork. This is checked in every family review.
8. **Cultural care.** Styles that touch traditions (Ink, Paper Theatre, Signage bazaar scenes, Panels monsoon city) avoid costume and cliché. Native readers review any script-specific rendering (Devanagari, Tamil, Arabic).
9. **Motion safety.** No full-frame flashing above 3 per second, no saturated red flashes, a global flash guard (V5), and a reduced-motion rendition for every style (motion-and-transitions.md).
10. **Multilingual by design.** Every style supports Latin, Devanagari and Tamil, and declares its right-to-left and CJK behaviour. Per-letter effects never apply to complex scripts: they apply to whole words or shaped runs (typography-system.md).
11. **Variety that is real.** Variety comes from structure (compositions, scene families, subjects, materials), not recolours. Recolours, mirrors, crops, animation frames and seed variations are never counted as assets.
12. **A song has an arc.** Every style describes its intro, verse, chorus, bridge, break, repeat and ending behaviour, and its ending is designed (the pile of cards, the signs switching off, the city from above, the sheet drying).

## 4. How a style adapts to a song

The same inputs feed every style (all exist today unless marked):

| Input | Source | Used for |
|---|---|---|
| Line and word timing with confidence | lyrics pipeline (`lineAt()`, timing sources) | reveal granularity, cue placement |
| Song identity (mood, energy, perspective) | `lib/kinetic/emotion.ts` lexicon and tempo heuristics | register, palette family, scene-family choice |
| Lexicon tags per line | `lib/lyrics/lexicons` | subject and object choice (rain, car, phone, sea) |
| Cover palette and pixels | `extractPalette.ts`, cover sample | colour where the style allows it; Cover Pop saliency |
| Structure: hooks, repeats, gaps, sections | director (MIN_SECTION_MS 8000, MAX 26000, MIN_BREAK_MS 6000) | scene changes, chorus recall, breaks |
| Beat grid with confidence | existing analysis | beat-locked motion only when confident |
| Script per run | `lib/lyrics/script.ts` | face routing, effect limits |
| Timing confidence soft mode | **not built** (P4) | required by every style; batch INF-04 |

## 5. What "complete" means for a style

A style is complete when its `design-spec.md` "Done means" list is met, its batches in `manifests/production-batches.json` pass their completion conditions, its golden frames cover every scene family in the QA matrix, and the owner has reviewed it. Phase 2 makes no claim that any style works: nothing has been built.
