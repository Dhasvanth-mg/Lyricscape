# Liquid Light Show: scene families and composition grammar

Style 8 of 15. Phase 2 planning (generated from planning data).

## Scene families (10)

| ID | Scene family | What it is | Roles | Chosen by (signals) | Compositions | Required families | Optional families |
|---|---|---|---|---|---|---|---|
| LLS-SCN-01 | Oil blobs | Big oil cells in coloured water, splitting and merging. | verse, chorus | default; rock, psych | C1, C2, C3 | LLS-PRC-FLU, LLS-TYP-SLD, LLS-PAL-PAL | LLS-MSK-DSH |
| LLS-SCN-02 | Water and dye | Dye plumes blooming in clear water. | verse, quiet | dreamy, ambient | C1, C3 | LLS-PRC-FLU, LLS-TYP-SLD, LLS-PAL-PAL | LLS-MSK-DSH |
| LLS-SCN-03 | Bubbles | Fields of small bubbles with bright rims. | chorus, high | upbeat, pop, disco | C2, C1, C4 | LLS-PRC-FLU, LLS-TYP-SLD, LLS-PAL-PAL | LLS-MSK-DSH |
| LLS-SCN-04 | Wet-on-wet bloom | Colour blooms spreading into each other like wet paint on glass. | verse, chorus | romantic, warm | C1, C2 | LLS-PRC-FLU, LLS-TYP-SLD, LLS-PAL-PAL | none |
| LLS-SCN-05 | Drips | Thick colour drips running down glass. | bridge, break | heavy, slow, dark psych | C3, C1 | LLS-PRC-FLU, LLS-TYP-SLD, LLS-PAL-PAL | LLS-MSK-DSH |
| LLS-SCN-06 | Meniscus edge | The dish edge: oil climbing the glass, a meniscus of colour. | intro, quiet, outro | intros and quiet sections | C3 | LLS-PRC-FLU, LLS-MSK-DSH, LLS-PAL-PAL | LLS-TYP-SLD |
| LLS-SCN-07 | Marbling | Combed marbling patterns dragged slowly. | verse, bridge | intricate, folk psych | C1, C2 | LLS-PRC-FLU, LLS-TYP-SLD, LLS-PAL-PAL | none |
| LLS-SCN-08 | Colour wheel show | Colour wheel tinting a double projection. | chorus, bridge | chorus and bridge of energetic songs | C5, C4 | LLS-OBJ-WHL, LLS-PRC-FLU, LLS-TYP-SLD | LLS-PAL-PAL |
| LLS-SCN-09 | Slow aurora | Slow veils of colour (absorbs Aurora), honey-slow. | quiet, verse | calm, ambient, night | C1, C3 | LLS-PRC-FLU, LLS-TYP-SLD, LLS-PAL-PAL | none |
| LLS-SCN-10 | Swirled dish | A dish swirled by hand into spirals; hue cycling replaced by real swirling. | high, chorus | psychedelic peaks (absorbs Psychedelic) | C3, C4 | LLS-PRC-FLU, LLS-MSK-DSH, LLS-TYP-SLD | LLS-PAL-PAL |

### Structural attributes (used for the similarity check)

| ID | Scene | fluid | scale | edge | motion | layering | light |
|---|---|---|---|---|---|---|---|
| 01 | Oil blobs | oil cells | large | sharp | rock and split | one | lamp |
| 02 | Water and dye | dye plumes | medium | soft | bloom and drift | one | lamp |
| 03 | Bubbles | bubbles | small many | sharp rims | rise and pop | two | lamp |
| 04 | Wet-on-wet bloom | colour blooms | large | feathered | spread | one | warm |
| 05 | Drips | drips | medium | sharp | fall | one | lamp |
| 06 | Meniscus edge | oil edge | rim | refractive | slow swirl | one | lamp edge |
| 07 | Marbling | marbled lines | fine | combed | comb drag | one | flat |
| 08 | Colour wheel show | any | large | sharp | wheel rotation | two | tinted |
| 09 | Slow aurora | veils | huge | soft | very slow drift | one | cool |
| 10 | Swirled dish | spiral swirl | large | sharp | hand swirl | two | lamp |

**Similarity check.** Pairs of scene families that differ in fewer than 3 of the 6 structural attributes: none. Palette is deliberately not an attribute (a recolour is not a different scene).

## Composition grammar

**Layer order (back to front):**

1. darkness (outside the dish)
2. dish layer A fluid
3. dish layer B fluid (additive, optional)
4. colour wheel tint
5. dish rim and meniscus
6. slide (letter mask or band) and text
7. halo and lamp grain

**Required.** One fluid preset, one palette, one slide treatment.

**Optional.** Second dish, dish mask, colour wheel.

**Scale and position constraints.** Letter masks cap height 10-16%.

**Typography-safe regions.** Slide inside central 80-84%.

**Colour compatibility.** Max 4 dyes per dish; 2 shared across dishes; luminance sum capped.

**Motion compatibility.** One gesture at a time per dish.

**Material compatibility.** Oil presets never with marbling presets in the same projection.

**Complexity limits.** Max 2 dishes.

**Invalid combinations.**

| This | never with | Because |
|---|---|---|
| Two dishes | 4 dyes each | Mud and white-out. |
| Hue cycling | faster than 1 cycle per 4 s | Flash and cliché. |
| Letter masks | lines over 3 words | Letters too small to show fluid. |
| Monochrome palette | water and dye | Ink's territory. |
| Squeeze on beat | beat grid under 0.5 confidence | Would misfire. |
| Black intro | any | Observed bug; intro starts lit. |

## Meaningful variation

**Major (change the scene):**
- Fluid family (10)
- Composition (band, letter mask, dish, double, wheel)
- Preset character (viscosity, scale)

**Minor (parameters, not new scenes):**
- Dye palette
- Gesture choice

**Not counted as assets or as variety:** Palette recolours; flow-field phase offsets.

## Deterministic selection

Fluid family from genre and energy; presets by hash within the family; palette from cover or mood. Pure functions; the fluid is time-parameterised so any t renders directly.

## Repetition control

A fluid family at most 2 sections in a row; presets never repeat within a song except chorus recall.

## Rejected and merged scene families

| Candidate | Decision | Reason |
|---|---|---|
| Kaleidoscope | rejected | Generic trippy shader, explicitly excluded. |
| Tunnel zoom | rejected | Generic shader look. |
