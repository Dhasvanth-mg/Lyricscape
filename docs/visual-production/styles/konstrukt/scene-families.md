# Konstrukt: scene families and composition grammar

Style 4 of 15. Phase 2 planning (generated from planning data).

## Scene families (11)

| ID | Scene family | What it is | Roles | Chosen by (signals) | Compositions | Required families | Optional families |
|---|---|---|---|---|---|---|---|
| KON-SCN-01 | Circles | Circles scaling in sequence on module centres. | verse, chorus | default for pop and electronic | C1, C5, C7 | KON-GEO-CIR, KON-LAY-GRD, KON-PAL-PAL | KON-TEX-TEX |
| KON-SCN-02 | Bars | Vertical and horizontal bars extending module by module. | verse, chorus | hip-hop, rock; strong beat | C1, C2, C4 | KON-GEO-BAR, KON-LAY-GRD, KON-PAL-PAL | KON-TEX-TEX |
| KON-SCN-03 | Arcs | Quarter and half arcs rotating in 15-degree steps. | verse, bridge | flowing songs, R&B | C5, C3, C1 | KON-GEO-ARC, KON-LAY-GRD, KON-PAL-PAL | KON-TEX-TEX |
| KON-SCN-04 | Diagonals | Diagonal slashes stepping across a 30 or 45 degree grid. | chorus, high | energetic, aggressive | C4, C1 | KON-GEO-DIA, KON-LAY-GRD, KON-PAL-PAL | KON-TEX-TEX |
| KON-SCN-05 | Dot matrix | A grid of dots filling in patterns. | verse, break | electronic, minimal | C6, C1, C2 | KON-GEO-DOT, KON-LAY-GRD, KON-PAL-PAL | KON-TEX-TEX |
| KON-SCN-06 | Rings | Concentric rings adding and removing in steps. | chorus, break | loops, house, techno | C5, C7 | KON-GEO-RNG, KON-LAY-GRD, KON-PAL-PAL | KON-TEX-TEX |
| KON-SCN-07 | Squares | Squares flipping and rotating on modules. | verse | math rock, jazz, indie | C6, C1, C2 | KON-GEO-SQR, KON-LAY-GRD, KON-PAL-PAL | KON-TEX-TEX |
| KON-SCN-08 | Waves | Parallel sine lines stepping their phase (low contrast, op-art limits). | verse, quiet | calm, ambient, water subjects | C1, C7, C3 | KON-GEO-WAV, KON-LAY-GRD, KON-PAL-PAL | KON-TEX-TEX |
| KON-SCN-09 | Rules | A type-only poster with rules and numerals. | quiet, intro, outro | quiet, ballads; typographic songs | C1, C2, C7 | KON-GEO-RUL, KON-LAY-GRD, KON-PAL-PAL | KON-TEX-TEX |
| KON-SCN-10 | Constructivist mix | Circle, bar and diagonal together: the chorus family. | chorus, high | hooks of energetic songs | C4, C1, C5 | KON-GEO-MIX, KON-LAY-GRD, KON-PAL-PAL | KON-TEX-TEX |
| KON-SCN-11 | Negative print | Light forms on near-black, the bridge register. | bridge, break | bridge or dark moods | C3, C5, C7 | KON-GEO-RNG, KON-LAY-GRD, KON-PAL-PAL | KON-GEO-ARC |

### Structural attributes (used for the similarity check)

| ID | Scene | form | motion | layout | density | axis | register |
|---|---|---|---|---|---|---|---|
| 01 | Circles | circles | scale sequence | block or concentric | medium | centre | positive |
| 02 | Bars | bars | extend and stack | block or column | medium | vertical | positive |
| 03 | Arcs | arcs | rotate sweep in steps | concentric or rotated | low | centre | positive |
| 04 | Diagonals | diagonals | slash steps | split or block | medium-high | diagonal | positive |
| 05 | Dot matrix | dots | fill patterns | scatter or block | medium | grid | positive |
| 06 | Rings | rings | concentric pulse steps | concentric | medium | centre | positive or negative |
| 07 | Squares | squares | module flips | scatter | medium | grid | positive |
| 08 | Waves | wave lines | phase steps | block | low | horizontal | positive |
| 09 | Rules | rules only | rule draws | block | very low | horizontal | positive |
| 10 | Constructivist mix | circle bar diagonal | layered steps | split | high | diagonal | positive |
| 11 | Negative print | rings and arcs | slow rotation | rotated | low | centre | negative |

**Similarity check.** Pairs of scene families that differ in fewer than 3 of the 6 structural attributes: none. Palette is deliberately not an attribute (a recolour is not a different scene).

## Composition grammar

**Layer order (back to front):**

1. paper or dark ground
2. colour fields (split layouts)
3. grid rules (visible or hidden)
4. shape choreography (second ink, overprint)
5. shape choreography (first ink)
6. numerals and labels
7. lyric type
8. print texture (tooth, riso grain, misregistration)

**Required.** Grid; layout template; colour system; one shape family (except Rules); lyric type.

**Optional.** Second shape family (only Constructivist mix), numerals, print texture, visible grid.

**Scale and position constraints.** Forms snap to module multiples; dominant form 2-8 modules; type from the modular scale.

**Typography-safe regions.** Type block in its layout slot, which forms may never enter (hard exclusion mask); 6% outer margin.

**Colour compatibility.** Max 3 inks; type always the darkest ink (or paper on negative).

**Motion compatibility.** Max 4 steps per second per form; all steps share the trigger source.

**Material compatibility.** Riso grain only on uncoated paper systems; negative print has no paper texture.

**Complexity limits.** Max 2 shape families; max 120 forms.

**Invalid combinations.**

| This | never with | Because |
|---|---|---|
| Rotated edge | Devanagari, Tamil, Arabic | Not a convention for these scripts here; poor reading. |
| Scatter on grid | estimated words | Word modules would claim timing. |
| Waves | high contrast inks while moving | Op-art flicker. |
| Negative print | riso grain | Light on dark is not paper ink. |
| Any form | the type slot | Hard exclusion. |
| Beat hits | beat grid under 0.5 confidence | Would mark wrong downbeats. |

## Meaningful variation

**Major (change the scene):**
- Layout template (structure)
- Shape family (11)
- Grid system
- Register (positive or negative)

**Minor (parameters, not new scenes):**
- Colour system
- Paper stock
- Step trigger source

**Not counted as assets or as variety:** Recolours by cover; mirrored layouts.

## Deterministic selection

Grid by output aspect and energy; layout per section from the composition families allowed by the scene family, in a seeded order; shape family by genre and energy, rotated per section; colour system by cover and mood. All pure functions of track, lyric version and settings.

## Repetition control

No layout template twice in a row except chorus recall; a shape family at most 3 sections per song; across songs the layout order is seeded by track id.
