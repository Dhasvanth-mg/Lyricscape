# Monument: scene families and composition grammar

Style 15 of 15. Phase 2 planning (generated from planning data).

## Scene families (9)

| ID | Scene family | What it is | Roles | Chosen by (signals) | Compositions | Required families | Optional families |
|---|---|---|---|---|---|---|---|
| MON-SCN-01 | Canyon of walls | Walking between walls of words. | verse | default verses | C2, C1 | MON-ENV-ARC, MON-PRC-EXT, MON-SRF-MAT | MON-ATM-FOG |
| MON-SCN-02 | Spiral stair | Words as steps of a spiral stair the camera climbs. | bridge, chorus | rising songs, builds | C1, C3 | MON-ENV-ARC, MON-PRC-EXT, MON-SRF-MAT | MON-MOT-PRJ |
| MON-SCN-03 | Bridge | A bridge made of the line over water. | verse, chorus | journeys, connection | C1, C2 | MON-ENV-ARC, MON-PRC-EXT | MON-PLT-GRD, MON-ATM-FOG |
| MON-SCN-04 | Plaza | A monumental hook in an open plaza with projection sweeps. | chorus, high | anthems | C3 | MON-ENV-ARC, MON-PRC-EXT, MON-LGT-LGT | MON-MOT-PRJ |
| MON-SCN-05 | Tunnel | A tunnel whose ribs are words of light. | bridge, high | intensity, electronic builds | C1 | MON-ENV-ARC, MON-PRC-EXT, MON-LGT-LGT | MON-MOT-PRJ |
| MON-SCN-06 | Glass city night | Glass façades of words in a night city. | verse, quiet | city, night, solitude | C1, C2 | MON-ENV-ARC, MON-SRF-MAT | MON-ATM-FOG |
| MON-SCN-07 | Paper town | Small paper buildings of words in soft light. | verse, quiet | tender, acoustic | C1 | MON-ENV-ARC, MON-SRF-MAT | MON-LGT-LGT |
| MON-SCN-08 | Pier into the sea | Words as a pier walking out to sea. | outro, quiet | endings, sea | C1, C4 | MON-ENV-ARC, MON-PLT-GRD | MON-ATM-FOG |
| MON-SCN-09 | The song city | The aerial view of everything the song built. | outro, break | endings and breaks | C4 | MON-CMP-CTY | MON-ATM-FOG, MON-LGT-LGT |

### Structural attributes (used for the similarity check)

| ID | Scene | template | material | light | camera | fog | mood |
|---|---|---|---|---|---|---|---|
| 01 | Canyon of walls | canyon | concrete | overcast | walk | grey | steady |
| 02 | Spiral stair | stair | plaster | golden hour | climb | warm | rising |
| 03 | Bridge | bridge | steel and concrete | dawn | walk across | blue | crossing |
| 04 | Plaza | plaza | stone | night projection | stop and look up | cover hue | triumphant |
| 05 | Tunnel | tunnel | light | emissive | fly through | dark | rushing |
| 06 | Glass city night | skyline | glass | night | slow walk | blue-black | alone |
| 07 | Paper town | village | paper | soft day | walk | white | gentle |
| 08 | Pier into the sea | pier | wood | dusk | walk out | sea mist | letting go |
| 09 | The song city | city | as built | as section | aerial | cover hue | summary |

**Similarity check.** Pairs of scene families that differ in fewer than 3 of the 6 structural attributes: none. Palette is deliberately not an attribute (a recolour is not a different scene).

## Composition grammar

**Layer order (back to front):**

1. sky gradient
2. distant fog
3. ground plane
4. city (instanced past façades)
5. active façade
6. lighting and shadow
7. projection sweep
8. dust
9. post: fog, grain

**Required.** Ground, active façade, lighting rig, fog.

**Optional.** Projection, dust, city.

**Scale and position constraints.** Active façade text cap height at least 8% at reading moment.

**Typography-safe regions.** Façade within 15 degrees of camera-facing when read.

**Colour compatibility.** One material family per section.

**Motion compatibility.** One camera move at a time.

**Material compatibility.** Light material only in tunnel template.

**Complexity limits.** Max 120 façades; older lines merge into a baked city layer.

**Invalid combinations.**

| This | never with | Because |
|---|---|---|
| Mesh extrusion | complex scripts | Shaping: use sprite stack. |
| Camera travel | reduced motion | Motion rule. |
| Façade angle over 15 degrees | reading moment | Readability. |
| Glossy chrome | any | Cliché. |
| Fast swoop | any | Motion language. |
| Real buildings | any | Likeness. |

## Meaningful variation

**Major (change the scene):**
- Architectural template
- Material
- Lighting rig
- Camera path
- City layout

**Minor (parameters, not new scenes):**
- Fog colour
- Projection sweep
- Ground

**Not counted as assets or as variety:** Material colour variants; camera speed variants; the per-song city (emergent, not an asset).

## Deterministic selection

Template from section role and lexicon (sea picks pier); material and rig from identity; city layout from song structure. Pure functions of track, section and line index.

## Repetition control

Templates max 4 per song; consecutive sections differ in template; hook façade reused as the same building.

## Rejected and merged scene families

| Candidate | Decision | Reason |
|---|---|---|
| Famous skyline | rejected | Real place likeness. |
| Space station | rejected | Generic flythrough; no ground, no walk. |
