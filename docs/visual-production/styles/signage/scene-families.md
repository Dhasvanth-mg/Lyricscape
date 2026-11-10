# Signage: scene families and composition grammar

Style 10 of 15. Phase 2 planning (generated from planning data).

## Scene families (12)

| ID | Scene family | What it is | Roles | Chosen by (signals) | Compositions | Required families | Optional families |
|---|---|---|---|---|---|---|---|
| SIG-SCN-01 | Station hall | A split-flap departure board in an echoing station hall. | verse | travel, leaving, waiting | C2, C1 | SIG-PRC-HWR, SIG-OBJ-SGN, SIG-ENV-SET | SIG-ATM-WEA |
| SIG-SCN-02 | Roadside motel | An invented motel sign by an empty road, neon and arrow. | verse, quiet | road, loneliness, americana | C1 | SIG-OBJ-SGN, SIG-ENV-SET, SIG-TYP-NEO | SIG-ATM-WEA |
| SIG-SCN-03 | Theatre front | A marquee with changeable letters and chasing bulbs. | chorus, high | showy pop, celebration | C4 | SIG-OBJ-SGN, SIG-TYP-BLB, SIG-ENV-SET | SIG-ATM-WEA |
| SIG-SCN-04 | Diner window | A neon word in a rainy diner window. | verse, quiet | late night, love, coffee | C3 | SIG-OBJ-SGN, SIG-TYP-NEO, SIG-ENV-SET | SIG-ATM-WEA |
| SIG-SCN-05 | Night bus | A flip-dot destination sign on the front of a night bus. | verse | commute, city, rap | C1, C2 | SIG-PRC-HWR, SIG-OBJ-SGN | SIG-ATM-WEA |
| SIG-SCN-06 | Overpass ticker | An LED ticker on a highway overpass with light trails. | verse, high | dense lyrics, rap, electronic | C5 | SIG-PRC-HWR, SIG-ENV-SET | SIG-ATM-WEA |
| SIG-SCN-07 | Stadium board | A big RGB scoreboard in a dark stadium. | chorus, high | anthems, sport, energy | C2, C5 | SIG-PRC-HWR, SIG-OBJ-SGN, SIG-ENV-SET | none |
| SIG-SCN-08 | Bazaar lane | A lane of invented shop signs in Devanagari and Tamil neon and LED. | chorus, verse | Hindi and Tamil songs, festive, busy | C6, C1 | SIG-OBJ-SGN, SIG-ENV-SET, SIG-TYP-NEO | SIG-ATM-WEA |
| SIG-SCN-09 | Airport gate | A gate information board with a dark runway beyond. | verse, bridge | flight, distance, longing | C2 | SIG-PRC-HWR, SIG-OBJ-SGN, SIG-ENV-SET | none |
| SIG-SCN-10 | Harbour | A ferry terminal lightbox sign in harbour fog. | bridge, quiet | sea, parting, calm | C1 | SIG-OBJ-SGN, SIG-ENV-SET | SIG-ATM-WEA, SIG-TYP-NEO |
| SIG-SCN-11 | Arcade alley | An alley of arcade and karaoke signs (invented) in rain. | chorus, high | retro, games, synthwave | C6, C3 | SIG-OBJ-SGN, SIG-ENV-SET, SIG-PRC-HWR | SIG-ATM-WEA |
| SIG-SCN-12 | Last lights | The street's signs switch off one by one before dawn. | outro | endings | C1, C6 | SIG-OBJ-SGN, SIG-ENV-SET | SIG-ATM-WEA |

### Structural attributes (used for the similarity check)

| ID | Scene | hardware | place | light | weather | camera | mood |
|---|---|---|---|---|---|---|---|
| 01 | Station hall | split-flap | hall | white and amber | none | push | waiting |
| 02 | Roadside motel | neon | roadside | warm neon | dust | locked | lonely |
| 03 | Theatre front | marquee | theatre | warm bulbs | none | low angle | showy |
| 04 | Diner window | neon | window | pink and blue neon | rain | locked | intimate |
| 05 | Night bus | flip-dot | bus front | yellow dots | rain | handheld | moving |
| 06 | Overpass ticker | LED ticker | overpass | amber LED | haze | locked | fast |
| 07 | Stadium board | RGB matrix | stadium | full colour | floodlight haze | slow push | anthemic |
| 08 | Bazaar lane | LED sign and neon | bazaar | multicolour | heat haze | pan | busy |
| 09 | Airport gate | LCD dot board | gate | cool white | none | push | distant |
| 10 | Harbour | lightbox | harbour | cold white | fog | slow dolly | calm |
| 11 | Arcade alley | seven-segment and neon | alley | magenta and cyan | rain | pan | electric |
| 12 | Last lights | mixed | street | fading | pre-dawn mist | slow pull | ending |

**Similarity check.** Pairs of scene families that differ in fewer than 3 of the 6 structural attributes: none. Palette is deliberately not an attribute (a recolour is not a different scene).

## Composition grammar

**Layer order (back to front):**

1. setting plate
2. depth fog
3. secondary unlit signs
4. hero sign housing
5. hardware panel (cells)
6. trim lights
7. glass
8. wet reflection
9. weather
10. post: bloom, grain

**Required.** Setting, hero sign, hardware.

**Optional.** Secondary signs, weather, passing lights.

**Scale and position constraints.** Hero sign panel 30-70% of frame width.

**Typography-safe regions.** Panel inside central 84%.

**Colour compatibility.** One light family per sign.

**Motion compatibility.** Hardware motion only; camera slow.

**Material compatibility.** Rain only on rain-capable settings.

**Complexity limits.** Max 1 hero sign and 4 secondary signs.

**Invalid combinations.**

| This | never with | Because |
|---|---|---|
| Dot matrix | Devanagari or Tamil lines | No quality open dot font: falls back to LED sign. |
| Bulb chase | reduced motion | Motion rule. |
| Neon flicker faster than 3 Hz | any | Flash guard. |
| Daylight | any | Identity. |
| Two hero signs | any | Hierarchy. |
| Split-flap | lines over 4 rows of 24 at chosen size | Switch to ticker. |

## Meaningful variation

**Major (change the scene):**
- Hardware
- Sign design
- Setting
- Composition
- Light palette
- Weather

**Minor (parameters, not new scenes):**
- Camera move
- Wear (dead bulbs)
- Secondary signs

**Not counted as assets or as variety:** Recolours of a sign (light palettes are a separate family); lit and unlit states; mirrored signs.

## Deterministic selection

Hardware from line length, script support and energy; sign from hardware and identity tags; setting from lexicon (travel, sea, road) and identity; light palette from identity and cover. Pure functions of track, section and line index.

## Repetition control

A sign at most once per section, three times per song (hook sign returns); hardware not the same for more than two consecutive sections; settings max 4 per song.

## Rejected and merged scene families

| Candidate | Decision | Reason |
|---|---|---|
| Times Square style billboards | rejected | Ads and real landmarks; Screenlife territory for screens. |
| Casino strip | rejected | Gambling imagery and real-place likeness; showy needs are met by the marquee. |
