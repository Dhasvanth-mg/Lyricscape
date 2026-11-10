# Phosphor: scene families and composition grammar

Style 13 of 15. Phase 2 planning (generated from planning data).

## Scene families (10)

| ID | Scene family | What it is | Roles | Chosen by (signals) | Compositions | Required families | Optional families |
|---|---|---|---|---|---|---|---|
| PHO-SCN-01 | Green scope | Green phosphor writing on a graticule screen. | verse | electronic, minimal | C1, C3 | PHO-TYP-SFN, PHO-FRM-FUR, PHO-PTH-PTH | PHO-GEO-CRV |
| PHO-SCN-02 | Lissajous chorus | Beat-locked Lissajous and rose curves around the hook. | chorus, high | hooks, synth, energy | C4 | PHO-GEO-CRV, PHO-GEO-SYM | PHO-FRM-FUR |
| PHO-SCN-03 | Amber terminal | Amber phosphor on curved glass with a soft bezel. | verse, bridge | retro, warm electronic | C1, C2 | PHO-TYP-SFN, PHO-FRM-FUR | PHO-PTH-PTH |
| PHO-SCN-04 | Light painting | A warm long-exposure trail in a dark room writes and draws. | verse, chorus | love, warm, acoustic-electronic | C5, C3 | PHO-FRM-FUR, PHO-PTH-PTH, PHO-TYP-SFN | PHO-GEO-CRV |
| PHO-SCN-05 | Sparkler night | Sparkler-like writing with sparks in a night yard. | chorus, high | celebration, festive, Diwali, new year | C5, C4 | PHO-FRM-FUR, PHO-GEO-CRV | PHO-PTH-PTH |
| PHO-SCN-06 | Vector horizon | A white vector horizon and mountains in single lines. | bridge, break | space, synthwave, travel | C2 | PHO-PTH-PTH, PHO-GEO-CRV | PHO-FRM-FUR |
| PHO-SCN-07 | Heartline | A red pulse line that becomes a heart and the words. | quiet, verse | love, health, longing | C3, C1 | PHO-PTH-PTH, PHO-TYP-SFN | none |
| PHO-SCN-08 | Harmonograph | Slowly decaying harmonograph curves with long persistence. | break, bridge | instrumental breaks, ambient | C2, C4 | PHO-GEO-CRV | PHO-GEO-SYM |
| PHO-SCN-09 | City line | A skyline drawn in one line over a rooftop at night. | verse, chorus | city, night, urban | C3, C2 | PHO-PTH-PTH, PHO-TYP-SFN | PHO-FRM-FUR |
| PHO-SCN-10 | Last dot | Everything returns to a dot that fades. | outro | endings | C2, C1 | PHO-TYP-SFN | PHO-FRM-FUR |

### Structural attributes (used for the similarity check)

| ID | Scene | register | phosphor | furniture | curves | symmetry | mood |
|---|---|---|---|---|---|---|---|
| 01 | Green scope | scope | green | graticule | simple | none | cool |
| 02 | Lissajous chorus | scope | blue-white | bezel | Lissajous | rotational | hypnotic |
| 03 | Amber terminal | scope | amber | curved glass | figures | none | warm retro |
| 04 | Light painting | light painting | gold | dark room | figures | none | tender |
| 05 | Sparkler night | light painting | sparkler | night yard | spirals | mirror | festive |
| 06 | Vector horizon | vector display | white | none | perspective grid lines | mirror | vast |
| 07 | Heartline | scope | red | none | pulse line | none | intimate |
| 08 | Harmonograph | scope | P7 decay | none | harmonograph | decaying | meditative |
| 09 | City line | light painting | white torch | rooftop | skyline | none | urban |
| 10 | Last dot | as section | as section | as section | collapse | none | ending |

**Similarity check.** Pairs of scene families that differ in fewer than 3 of the 6 structural attributes: none. Palette is deliberately not an attribute (a recolour is not a different scene).

## Composition grammar

**Layer order (back to front):**

1. field (black)
2. furniture (graticule, bezel, room plate)
3. trail (persistence buffer)
4. beam line
5. beam head
6. bloom
7. post: grain, curvature

**Required.** Field, beam, stroke font.

**Optional.** Furniture, figure, curve, symmetry.

**Scale and position constraints.** Writing cap height at least 5% of frame height; figures 40-60% of short side.

**Typography-safe regions.** Writing central 84%.

**Colour compatibility.** One beam colour.

**Motion compatibility.** One beam.

**Material compatibility.** Graticule only in scope register; room plates only in light painting.

**Complexity limits.** One figure or curve at a time.

**Invalid combinations.**

| This | never with | Because |
|---|---|---|
| Two beams | any | Identity. |
| Symmetry spin | reduced motion | Motion rule. |
| Fast flicker of the whole trace | any | Flash guard. |
| Outline trace | scripts failing the readability gate | Use declared fallback. |
| Figures | while a word is being written | Hierarchy. |
| Sparkler sparks | grief identity | Tone. |

## Meaningful variation

**Major (change the scene):**
- Register (scope, light painting, vector display)
- Phosphor colour
- Figure
- Curve family
- Symmetry

**Minor (parameters, not new scenes):**
- Persistence profile
- Furniture
- Beam behaviour

**Not counted as assets or as variety:** Parameter sweeps of one curve family (each family is one generator); recoloured figures; scaled figures.

## Deterministic selection

Register from identity; phosphor from genre; figures from lexicon tags; curve family and parameters from line seed and beat grid. Pure functions of track, section and line index.

## Repetition control

A figure at most once per section and twice per song; curve family not the same for consecutive breaks; phosphor max 3 per song.

## Rejected and merged scene families

| Candidate | Decision | Reason |
|---|---|---|
| Laser show | rejected | More than one beam; overlaps concert imagery in Panels and Signage. |
| Radar sweep | rejected | Military imagery; not a writing surface. |
