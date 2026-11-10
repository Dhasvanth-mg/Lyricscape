# Nocturne: scene families and composition grammar

Style 7 of 15. Phase 2 planning (generated from planning data).

## Scene families (11)

| ID | Scene family | What it is | Roles | Chosen by (signals) | Compositions | Required families | Optional families |
|---|---|---|---|---|---|---|---|
| NOC-SCN-01 | Lamp room | A lamp in a dark room; dust in the light. | verse, quiet | home, room, alone, night | C1, C2, C3 | NOC-LGT-LIT, NOC-SIL-SIL | NOC-ATM-WEA |
| NOC-SCN-02 | Window rain | Rain on a window, city bokeh beyond. | verse, chorus | rain, tears, cold, city at night | C4, C1 | NOC-ATM-BOK, NOC-ATM-WEA, NOC-SIL-SIL | NOC-LGT-LIT |
| NOC-SCN-03 | Night street | A street of out-of-focus lights; a lamp post near. | verse, chorus, high | city, walking, night out, energetic slow jams | C5, C1 | NOC-ATM-BOK, NOC-LGT-LIT | NOC-ATM-WEA, NOC-SIL-SIL |
| NOC-SCN-04 | Candle | A single candle flame, flickering gently (under flash limits). | quiet, verse | love, prayer-free intimacy, very calm | C2, C1 | NOC-LGT-LIT | NOC-ATM-WEA |
| NOC-SCN-05 | Dawn window | Blue-grey dawn through a window, light growing. | outro, verse, quiet | morning, hope, new day, waking | C1, C5 | NOC-LGT-LIT, NOC-SIL-SIL | NOC-ATM-WEA |
| NOC-SCN-06 | Moonlight on water | A moon path on dark water. | verse, bridge | sea, moon, night, longing | C5, C2 | NOC-LGT-LIT, NOC-ATM-BOK | NOC-ATM-WEA |
| NOC-SCN-07 | Car at night | Inside a car; streetlights sweep across. | verse, bridge | drive, road, leave | C1, C4 | NOC-LGT-LIT, NOC-SIL-SIL, NOC-ATM-BOK | NOC-ATM-WEA |
| NOC-SCN-08 | Train window | Lights streak past a train window. | verse, bridge | travel, distance, leaving | C4, C1 | NOC-ATM-BOK, NOC-SIL-SIL | NOC-ATM-WEA, NOC-LGT-LIT |
| NOC-SCN-09 | Snow under a streetlight | Snow falling through a lamp's cone. | verse, quiet, outro | winter, cold, alone, quiet | C1, C2 | NOC-LGT-LIT, NOC-ATM-WEA | NOC-SIL-SIL |
| NOC-SCN-10 | Screen glow | A face-free glow from below in darkness (no interface). | verse, quiet | late night, messages, insomnia | C6 | NOC-LGT-LIT | NOC-ATM-WEA |
| NOC-SCN-11 | Reading room | The rolling column on darkness: the reading mode. | verse, chorus, break | untimed lyrics, dense lyrics, reading mode | C3 | NOC-LAY-LAY, NOC-LGT-LIT | none |

### Structural attributes (used for the similarity check)

| ID | Scene | light | weather | depth | place | horizon | glass |
|---|---|---|---|---|---|---|---|
| 01 | Lamp room | lamp | dust | room | interior | none | none |
| 02 | Window rain | streetlight beyond | rain on glass | two planes | window | city | yes |
| 03 | Night street | streetlights | mist | street depth | street | street end | none |
| 04 | Candle | candle | none | close | table | none | none |
| 05 | Dawn window | daylight | dust | room | window | sky | yes |
| 06 | Moonlight on water | moon | mist | far | water | sea | none |
| 07 | Car at night | passing streetlights | rain optional | interior | car | road | windscreen |
| 08 | Train window | passing lights | condensation | two planes | train | countryside lights | yes |
| 09 | Snow under a streetlight | streetlight cone | snow | street | outdoors | none | none |
| 10 | Screen glow | screen glow | none | close | bed | none | none |
| 11 | Reading room | soft strip | none | none | abstract | none | none |

**Similarity check.** Pairs of scene families that differ in fewer than 3 of the 6 structural attributes: Candle / Screen glow (2 of 6). Palette is deliberately not an attribute (a recolour is not a different scene).
 Every listed pair is justified in the style's variation notes or kept apart by the selection rules (they never serve the same role in one song).

## Composition grammar

**Layer order (back to front):**

1. darkness ground (tinted)
2. far plane (bokeh, horizon)
3. room or window silhouettes
4. light source and pool
5. weather (rain plane, dust, snow, fog)
6. text
7. grain whisper

**Required.** One light; darkness; text.

**Optional.** Bokeh, silhouettes, one weather layer.

**Scale and position constraints.** Silhouettes only at frame edges (max 25% of area).

**Typography-safe regions.** Text inside the light pool and central 80%; rain masked around text.

**Colour compatibility.** One light colour.

**Motion compatibility.** One moving layer at a time besides text.

**Material compatibility.** Glass layers only in window scenes.

**Complexity limits.** Max 3 layers besides darkness and text.

**Invalid combinations.**

| This | never with | Because |
|---|---|---|
| Two light sources | any | Identity rule. |
| Rain plane | over the text box | Readability. |
| Heavy grain (over 0.05) | any | Celluloid territory. |
| Beat-driven motion | any above 1% gain | Calm rule. |
| Interface elements | screen glow | Screenlife territory. |
| Candle flicker | over 1 Hz | Flash and calm rule. |

## Meaningful variation

**Major (change the scene):**
- Scene family (light and place)
- Composition (opposite, halo, column, window, horizon, glow)
- Weather

**Minor (parameters, not new scenes):**
- Light colour temperature
- Bokeh arrangement
- Type pairing

**Not counted as assets or as variety:** Light hue shifts and bokeh seeds.

## Deterministic selection

Scene from subjects and lyric words (rain, moon, drive, train, snow) and cover temperature; composition from line density. Pure functions; seeded by track id for ties.

## Repetition control

Max 2 scenes per song; within a scene, the composition alternates between at most 2 families. Across songs repetition is accepted by design (restraint), but ties are seeded by track id.

## Rejected and merged scene families

| Candidate | Decision | Reason |
|---|---|---|
| Fireplace | merged into NOC-SCN-04 | Too close to Candle and to Glyph Cinema's fire; a second flame scene adds no new structure. |
| Neon reflection street | rejected | Signage territory. |
