# Panels: scene families and composition grammar

Style 12 of 15. Phase 2 planning (generated from planning data).

## Scene families (12)

| ID | Scene family | What it is | Roles | Chosen by (signals) | Compositions | Required families | Optional families |
|---|---|---|---|---|---|---|---|
| PAN-SCN-01 | City night noir | Rainy streets, hands, a lit window, captions in noir ink. | verse, bridge | dark, crime-tinged, rain, regret | C1, C5 | PAN-ENV-PLC, PAN-OBJ-CLU, PAN-TYP-BAL | PAN-ATM-WTH |
| PAN-SCN-02 | Bright pop page | Phones, hearts, close-ups and pop objects in Ben-Day dots. | chorus, verse | pop, love, fun | C1, C2 | PAN-PRP-OBJ, PAN-OBJ-CLU, PAN-TYP-BAL, PAN-TYP-SFX | PAN-PRC-SPD |
| PAN-SCN-03 | Screentone evening | Trains, power lines, sunsets and sky in screentone. | verse, quiet | anime-adjacent, longing, school, summer | C1, C3 | PAN-ENV-PLC, PAN-ENV-NAT, PAN-TYP-BAL | PAN-ATM-WTH |
| PAN-SCN-04 | Action splash | Splash page with speed lines, impact and SFX lettering. | chorus, high | energetic hooks, rock, rap | C2 | PAN-TYP-SFX, PAN-PRC-SPD, PAN-OBJ-VEH | PAN-PRP-OBJ |
| PAN-SCN-05 | Road trip | Cars, roads, petrol stops and skies in flat colour. | verse, chorus | travel, freedom, cars | C1, C4 | PAN-OBJ-VEH, PAN-ENV-PLC, PAN-TYP-BAL | PAN-ENV-NAT |
| PAN-SCN-06 | Rooms | Kitchens, beds, doors, cups and hands in quiet panels. | verse, quiet | home, love, breakup, inward | C3, C5 | PAN-ENV-INT, PAN-OBJ-CLU, PAN-TYP-BAL | PAN-PRP-OBJ |
| PAN-SCN-07 | Crowd and stage | Crowds as silhouettes, raised hands and stage lights. | chorus, high | anthems, concerts, celebration | C2, C1 | PAN-SIL-CRW, PAN-TYP-SFX | PAN-PRC-SPD |
| PAN-SCN-08 | Storm | Lightning, waves and wind in diagonal panels. | bridge, high | conflict, drama | C2, C1 | PAN-ATM-WTH, PAN-ENV-PLC | PAN-PRC-SPD, PAN-TYP-SFX |
| PAN-SCN-09 | Newsprint memory | Yellowed newsprint pages with muted dots and captions. | verse, bridge | nostalgia, old songs, memory | C5, C1 | PAN-ENV-PLC, PAN-PRP-OBJ, PAN-TYP-BAL | PAN-ENV-INT |
| PAN-SCN-10 | Wordless break | Wide wordless panels the camera pans across. | break, intro | instrumental breaks | C4, C6 | PAN-ENV-PLC, PAN-ENV-NAT | PAN-ATM-WTH |
| PAN-SCN-11 | Bazaar and monsoon | Auto-rickshaws, monsoon streets, chai stalls and rooftops. | verse, chorus | Hindi and Tamil songs, city India, rain | C1, C2 | PAN-ENV-PLC, PAN-OBJ-VEH, PAN-ATM-WTH, PAN-TYP-BAL | PAN-SIL-CRW |
| PAN-SCN-12 | Last page | The last panel and a white gutter with a closing caption. | outro | endings | C1, C5 | PAN-ENV-PLC, PAN-TYP-BAL | PAN-ENV-NAT |

### Structural attributes (used for the similarity check)

| ID | Scene | register | subject | layout | balloons | pace | mood |
|---|---|---|---|---|---|---|---|
| 01 | City night noir | ink noir | city | grid | captions | slow | noir |
| 02 | Bright pop page | halftone pop | objects | grid | speech | normal | bright |
| 03 | Screentone evening | screentone | seasons | tall panels | thought | slow | wistful |
| 04 | Action splash | halftone pop | impact | splash | shout | fast | explosive |
| 05 | Road trip | flat colour | road | wide tiers | speech | normal | free |
| 06 | Rooms | flat colour | interiors | strip | thought | slow | intimate |
| 07 | Crowd and stage | flat colour | crowd | inset over splash | song | fast | euphoric |
| 08 | Storm | ink noir | weather | diagonal | caption | fast | dramatic |
| 09 | Newsprint memory | newsprint | memory | grid | captions | slow | nostalgic |
| 10 | Wordless break | as section | establishing | wide | none | slow | open |
| 11 | Bazaar and monsoon | flat colour | monsoon city | grid | speech | normal | lively |
| 12 | Last page | as section | closing | last panel | caption | slow | ending |

**Similarity check.** Pairs of scene families that differ in fewer than 3 of the 6 structural attributes: none. Palette is deliberately not an attribute (a recolour is not a different scene).

## Composition grammar

**Layer order (back to front):**

1. paper
2. page layout
3. panel art (line, fill, shadow)
4. register treatment (tone, dots)
5. panel borders
6. speed lines
7. SFX lettering
8. balloons and captions
9. active-panel highlight
10. post: paper grain

**Required.** Layout, at least one illustration, balloons or captions, register.

**Optional.** SFX, speed lines, limited animation.

**Scale and position constraints.** Active panel at least 35% of frame after camera framing.

**Typography-safe regions.** Active balloon central 84%.

**Colour compatibility.** One register per page.

**Motion compatibility.** Camera moves between panels only.

**Material compatibility.** Dots fixed to page.

**Complexity limits.** Max 6 panels; one active.

**Invalid combinations.**

| This | never with | Because |
|---|---|---|
| SFX distortion | complex scripts | Shaping. |
| Speed lines | quiet identity | Tone. |
| Faces | any | No characters (likeness). |
| Halftone pop | grief identity | Tone: use ink noir or screentone. |
| Shakes | reduced motion | Motion rule. |
| Two active panels | any | Hierarchy. |

## Meaningful variation

**Major (change the scene):**
- Art register
- Page layout
- Illustration subject family
- Balloon kind
- Composition

**Minor (parameters, not new scenes):**
- Panel border
- Tone pattern
- Palette
- Limited animation

**Not counted as assets or as variety:** Register treatments of one drawing (one drawing x 5 registers is one asset); the three crops of one drawing; recolours.

## Deterministic selection

Register from identity; layout from section role and energy; illustrations from lexicon tags (rain, car, phone, hand) and scene subject; balloon kind from identity perspective (addressed: speech; narrative: caption; inward: thought). Pure functions of track, section and line index.

## Repetition control

An illustration at most once per page and twice per song (hook splash returns with a different crop); layouts not identical on consecutive pages; registers max 2 per song.

## Rejected and merged scene families

| Candidate | Decision | Reason |
|---|---|---|
| Superhero rooftop | rejected | Character and genre likeness. |
| Manga school classroom | rejected | Characters and stereotype; screentone evening covers the mood without people. |
