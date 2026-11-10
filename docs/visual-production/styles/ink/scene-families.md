# Ink: scene families and composition grammar

Style 11 of 15. Phase 2 planning (generated from planning data).

## Scene families (11)

| ID | Scene family | What it is | Roles | Chosen by (signals) | Compositions | Required families | Optional families |
|---|---|---|---|---|---|---|---|
| INK-SCN-01 | Mountains | Pale mountains in layered wash with the lyric in the sky. | verse, chorus | nature, distance, longing | C4, C1 | INK-ENV-LND, INK-SRF-PAP | INK-ATM-SKY |
| INK-SCN-02 | Branch | One branch with blossoms entering from the frame edge. | verse, quiet | love, seasons, blossom | C1 | INK-OBJ-BOT, INK-SRF-PAP | INK-ATM-SKY |
| INK-SCN-03 | Rain | Rain strokes and a small umbrella or figure. | verse, quiet | rain, sadness, waiting | C1, C2 | INK-ATM-SKY, INK-SRF-PAP | INK-PRP-OBJ |
| INK-SCN-04 | Sea | A wave painted in heavy strokes with a small boat. | chorus, bridge | sea, journey, waves | C4, C1 | INK-ENV-LND, INK-SRF-PAP | INK-PRP-OBJ |
| INK-SCN-05 | Ink in water | Ink clouds bloom in clear water behind clean type. | bridge, break | dreams, ambient, bridges | C3 | INK-PRC-BLM, INK-MOT-WTR | none |
| INK-SCN-06 | Night sheet | White ink moon and a figure on black paper. | verse, quiet | night, moon, dark identity | C1, C2 | INK-ATM-SKY, INK-SRF-PAP | INK-SIL-FIG |
| INK-SCN-07 | City in ink | Streetlamps, power lines and a tram suggested in a few strokes. | verse, chorus | city, modern life, travel | C1, C4 | INK-PRP-OBJ, INK-SRF-PAP | INK-SIL-FIG |
| INK-SCN-08 | Heavy brush | Huge dry-brush strokes and flicks with one brushed word. | chorus, high | intense hooks, anger, rock | C5, C2 | INK-TEX-BRS, INK-SRF-PAP | none |
| INK-SCN-09 | Garden | Grasses, a pot and a small bird. | verse | home, family, peace | C1 | INK-OBJ-BOT, INK-SRF-PAP | INK-SIL-FIG, INK-PRP-OBJ |
| INK-SCN-10 | Figure | A single small figure walking in a lot of paper. | verse, bridge | solitude, addressed lines | C1, C2 | INK-SIL-FIG, INK-SRF-PAP | INK-ATM-SKY |
| INK-SCN-11 | Drying sheet | The full sheet dries as the camera pulls back. | outro | endings | C4, C1 | INK-SRF-PAP | INK-ENV-LND, INK-OBJ-BOT |

### Structural attributes (used for the similarity check)

| ID | Scene | subject | paper | ink | register | brush | mood |
|---|---|---|---|---|---|---|---|
| 01 | Mountains | landscape | rice | black | paper | light | still |
| 02 | Branch | botany | cotton | black and accent | paper | light | tender |
| 03 | Rain | weather | grey-blue | indigo | paper | light | melancholy |
| 04 | Sea | water | rice | indigo | paper | heavy | surging |
| 05 | Ink in water | abstract | water | black | water | none | dreamlike |
| 06 | Night sheet | moon | black | white | paper | light | nocturnal |
| 07 | City in ink | urban | kraft | sepia | paper | medium | modern |
| 08 | Heavy brush | gesture | cotton | black and accent | paper | heavy | fierce |
| 09 | Garden | botany | cream | sepia | paper | medium | warm |
| 10 | Figure | figure | cotton | sepia | paper | light | alone |
| 11 | Drying sheet | accumulated | as section | as section | paper | none | ending |

**Similarity check.** Pairs of scene families that differ in fewer than 3 of the 6 structural attributes: none. Palette is deliberately not an attribute (a recolour is not a different scene).

## Composition grammar

**Layer order (back to front):**

1. paper
2. paper fibre and granulation
3. pale wash layer
4. painted element strokes
5. dried previous lines (pale)
6. active line stroke reveal
7. wet spread
8. post: grain

**Required.** Paper, ink colour, lettering with reveal.

**Optional.** Element, accent word, flicks.

**Scale and position constraints.** Element 25-50% of frame; large word 8-14% cap height.

**Typography-safe regions.** Type central 84%; element never under the active line.

**Colour compatibility.** One ink plus one accent.

**Motion compatibility.** One stroke moving at a time.

**Material compatibility.** White ink only on black paper; water register replaces paper.

**Complexity limits.** One element plus one small accent element.

**Invalid combinations.**

| This | never with | Because |
|---|---|---|
| Brush-style fake calligraphy font | any Latin line | Kitsch. |
| Stroke-order reveal | scripts without skeleton data | Fake stroke order. |
| Flicks | reduced motion | Motion rule. |
| Two large elements | any | Emptiness rule. |
| Accent colour | more than one word per section | Accent rule. |
| Dry-brush heavy | devotional identity | Tone. |

## Meaningful variation

**Major (change the scene):**
- Element family (landscape, botany, sky, figure, object, abstract)
- Paper
- Ink colour
- Register (paper or water)
- Brush weight
- Composition

**Minor (parameters, not new scenes):**
- Accent colour
- Bloom style
- Stroke dynamics profile

**Not counted as assets or as variety:** Recoloured elements; mirrored elements; scaled elements; growth stages of one element.

## Deterministic selection

Element from lexicon and identity (rain words pick rain); paper and ink from identity; register by section role; brush by energy. Pure functions of track, section and line index.

## Repetition control

An element at most once per section and twice per song; papers max 3 per song; water register max once per song.

## Rejected and merged scene families

| Candidate | Decision | Reason |
|---|---|---|
| Temple and pagoda | rejected | Cultural costume; the mountains scene covers distance without it. |
| Calligraphy hall | rejected | Implies calligraphy the style cannot honestly do. |
| Bamboo grove with panda | rejected | Cliché. |
