# Motion and transitions

Phase 2 planning. Collection-wide motion rules. Each style's `motion.md` gives its own language, timing, easing, transitions table and reduced-motion behaviour within these rules.

## 1. Principles

1. **Motion follows the medium.** Cards drop, flaps cycle, brushes pool, beams travel, cameras walk. A style never borrows another style's motion idiom (no floating text in Signage, no rubbery bounce in Konstrukt).
2. **One thing moves at a time** in the focal layer. Ambient motion (rain, grain, drift) stays below the attention of the active lyric.
3. **Timing is honest.** Word-level motion uses authored word times only. Estimated timing gets line-level or reading-order motion. No timing gets a fixed cadence. Beat-locked motion runs only with a confident beat grid and every style is complete without beats.
4. **Readable before it settles.** Entrances complete within 200-700 ms depending on style, so a word is readable by the time it is sung.
5. **Sections change, lines flow.** Scene and composition changes happen at section boundaries (8-26 s, existing director constants) or at a declared transition; inside a section only the lyric, accumulating elements and the camera move.

## 2. Determinism

- All motion is a function of time `t` and seeds from the track and line index. No frame-to-frame accumulation that export cannot reproduce. Effects that look accumulative (Phosphor persistence, Liquid Light Show fluid, Sketch Cards pile) are computed from a bounded history window or from line index, so export frame `n` equals playback at the same `t`.
- Random-looking behaviour (neon flicker, hand tremor, flap order) uses `hash01(seed, t-quantised)`.

## 3. Flash and photosensitivity limits

These follow common photosensitive-epilepsy guidance (general flash and red flash thresholds) and are enforced by the flash guard (V5, batch INF-03):

| Rule | Limit |
|---|---|
| General flashes | No more than 3 flashes in any 1-second period where a flash is a luminance change of 10% or more of maximum relative luminance and the darker state is below 0.8 relative luminance |
| Area | A flash covering less than about 25% of the frame (a quarter of a 10-degree visual field at typical viewing distance, approximated as 25% of the frame) is exempt |
| Saturated red | No saturated red flashes (red channel dominance transitions) above 3 per second at any area |
| Patterns | No high-contrast stripes or grids that move or flicker over more than 25% of the frame (Konstrukt waves, Signage cell boards and Glyph Cinema dither keep contrast below the limit when they move) |

The guard measures the composited frame and dampens luminance changes that would exceed the limits. Every style also avoids generating flashes in the first place: strobe-like effects were rejected in review (Signage full-panel strobe, Nocturne police lights, Paper Theatre strobe rig, Nocturne lightning).

## 4. Reduced motion

When the system or app reduced-motion setting is on, every style switches to its reduced-motion rendition (each `motion.md` gives the details). The shared contract:

- no camera travel: static viewpoints with cuts;
- no shake, sway, chase, drift, symmetry spin or particle motion;
- entrances become short fades (at most 200 ms) or cuts;
- reveals that carry meaning (a brushed word, a typed word) become word or line fades with the same timing;
- persistence and trails off;
- transitions become cuts or cross-fades of at most 300 ms;
- the style must still look like itself in a still frame (golden frames include a reduced-motion set).

## 5. Transition types used across styles

| Type | Examples | Typical timing |
|---|---|---|
| Cut | Street cut (Signage), ground cut (Sketch Cards), crop jump (Cover Pop) | Instant, on a line start |
| Material transition | Wet sheet dissolve (Ink), page turn (Panels), switch off and on (Signage), reel change (Celluloid) | 600-1800 ms, between lines |
| Camera transition | Corner turn (Monument), pull back (Sketch Cards), zoom into a panel (Panels) | 900-3000 ms |
| Medium-native morph | Word unwinds into a figure (Phosphor), flap cascade (Signage) | 300-900 ms |
| Ending | Signs switch off, sheet dries, aerial city, last dot | 2-8 s after the last line |

Rules: a transition never hides the first word of a line; transitions that take longer than the gap before the next line are shortened or replaced by a cut; the same transition is not used three times in a row.

## 6. Motion standards for produced assets

- **Frame-rate independence.** Motion is defined in milliseconds and evaluated at `t`; nothing advances per frame. Playback at 30, 60 or 120 fps and export at any frame rate show the same positions at the same `t`.
- **Loops.** Looping assets (rain, steam, idle breathing, flicker) have an authored period and are seamless at the loop point (first and last frame match within the review tolerance); periods are not multiples of each other inside one scene, to avoid visible beating.
- **Easing.** Each style names its easing families in `motion.md`; produced assets use only those.
- **Continuity.** A transition never moves the active lyric's baseline mid-word; camera moves never cross a line start.
- **Seamless transitions.** Transition entry and exit states match the scenes on either side (no pop of layers).
- **Determinism** and **reduced motion** as in sections 2 and 4.

## 7. Pacing for fast lyrics

Every style declares what happens when lines are fast (rap, dense pop): entrances shorten (for example Sketch Cards drop 280 ms to 180 ms), then switch to cuts or line-level updates below a per-style threshold. No style queues animation behind the lyric.
