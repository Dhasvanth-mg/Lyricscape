# Glyph Cinema: scene families and composition grammar

Style 2 of 15. Phase 2 planning (generated from planning data).

## Scene families (13)

| ID | Scene family | What it is | Roles | Chosen by (signals) | Compositions | Required families | Optional families |
|---|---|---|---|---|---|---|---|
| GLY-SCN-01 | Night sky | Ringed planet, moon, comets and constellations in phosphor cells. | verse, chorus, intro | space, stars, moon, night, heaven words; dreamy moods | C1, C2, C6 | GLY-ENV-SUB, GLY-TYP-RMP, GLY-PRC-REG | GLY-MOT-ANI, GLY-PAL-PAL |
| GLY-SCN-02 | Roads and travel | Highways, viaducts and empty roads with moving lane markings. | verse, chorus | car, road, drive, train, leave words; energetic or restless | C1, C2, C5 | GLY-ENV-SUB, GLY-TYP-RMP, GLY-PRC-REG | GLY-MOT-ANI |
| GLY-SCN-03 | Weather | Rain, snow, fog and storms as whole-field textures with one anchoring object (a streetlight, a tree). | verse, break, quiet | rain, storm, snow, cloud, tears words; sad or calm | C1, C4, C6 | GLY-ENV-SUB, GLY-TYP-RMP, GLY-PRC-REG | GLY-MOT-ANI, GLY-SRF-PAP |
| GLY-SCN-04 | Sea and shore | Waves, lighthouse, boats and still lakes with reflections. | verse, chorus | sea, ocean, wave, boat, shore, drown words | C1, C2, C5 | GLY-ENV-SUB, GLY-TYP-RMP, GLY-PRC-REG | GLY-MOT-ANI |
| GLY-SCN-05 | City at night | Skylines, lit window grids, bridges and streetlights. | verse, chorus | city, street, building, window, lights words; night and city subject | C1, C5, C3 | GLY-ENV-SUB, GLY-TYP-RMP, GLY-PRC-REG | GLY-MOT-ANI, GLY-LAY-PAG |
| GLY-SCN-06 | Nature | Single trees, roses, sunflower fields, mountains and waterfalls; favours the typewriter register. | verse, quiet | flower, tree, mountain, garden, grass words; calm or warm | C1, C4, C6 | GLY-ENV-SUB, GLY-TYP-RMP, GLY-PRC-REG | GLY-MOT-ANI, GLY-SRF-PAP |
| GLY-SCN-07 | Heart and hands | Hearts, hands almost touching, an eye; the calligram family par excellence. | chorus, verse | love, heart, hold, touch, kiss words; romance subject | C2, C1, C6 | GLY-ENV-SUB, GLY-TYP-RMP, GLY-PRC-REG | GLY-MOT-ANI |
| GLY-SCN-08 | Machines and music | Cassette, vinyl, telephone, speaker cone, clock: objects with one moving part. | verse, chorus, break | radio, record, tape, phone, speaker, song, music words; electronic | C1, C5, C3 | GLY-ENV-SUB, GLY-TYP-RMP, GLY-PRC-REG | GLY-MOT-ANI, GLY-LAY-PAG |
| GLY-SCN-09 | Fire and light | Fire, candle, match, sunrise; the brightest family, flash-limited. | chorus, high | fire, burn, flame, sun, light words; intense moods | C1, C2, C6 | GLY-ENV-SUB, GLY-TYP-RMP, GLY-PRC-REG | GLY-MOT-ANI |
| GLY-SCN-10 | Creatures | Birds on a wire, a butterfly, a whale under the surface, a cat on a sill. | verse, bridge | bird, butterfly, cat, whale, fly, wing words | C1, C4, C6 | GLY-ENV-SUB, GLY-TYP-RMP, GLY-PRC-REG | GLY-MOT-ANI, GLY-SRF-PAP |
| GLY-SCN-11 | Teletext service | Original information pages (index, clock, chart, programme guide) whose content is the song's own lines and metadata. | break, intro, outro, chorus | always available as a register; preferred for breaks and retro identity | C3 | GLY-LAY-PAG, GLY-PRC-REG | GLY-ENV-SUB |
| GLY-SCN-12 | Typed letter | A typed letter on paper, with a small overstrike picture in the corner from the song's subject. | verse, quiet, outro | letters, writing, memory words; ballads; perspective addressed | C4 | GLY-SRF-PAP, GLY-PRC-REG | GLY-ENV-SUB |
| GLY-SCN-13 | Symbols and objects of fortune | Crown, diamond, key and lock, hourglass in hard 1-bit print. | chorus, high | crown, diamond, money, key, gold words; boastful rap | C1, C2, C6 | GLY-ENV-SUB, GLY-TYP-RMP, GLY-PRC-REG | GLY-MOT-ANI |

### Structural attributes (used for the similarity check)

| ID | Scene | structure | subject | register | motion | density | focal |
|---|---|---|---|---|---|---|---|
| 01 | Night sky | band | sky objects | phosphor | twinkle and orbit | sparse | upper centre |
| 02 | Roads and travel | band | vehicles and roads | phosphor | forward scroll | medium | vanishing point |
| 03 | Weather | band | weather | paper or phosphor | falling in place | full field | whole field |
| 04 | Sea and shore | band | sea | phosphor | rolling waves | lower half | horizon |
| 05 | City at night | band | architecture | phosphor or teletext | windows lighting | dense lower | skyline |
| 06 | Nature | band | plants and land | paper | wind sway | medium | single specimen |
| 07 | Heart and hands | calligram | body symbols | phosphor | slow beat | centred | centre |
| 08 | Machines and music | band or split | objects | teletext or phosphor | spinning parts | centred | object centre |
| 09 | Fire and light | band | light sources | phosphor | flicker within limits | bright centre | flame |
| 10 | Creatures | band | animals | paper or 1-bit | wing and tail loops | sparse | creature |
| 11 | Teletext service | page | information pages | teletext | page updates | structured | lyric rows |
| 12 | Typed letter | sheet | a letter | typewriter | typing and carriage | low | typed line |
| 13 | Symbols and objects of fortune | calligram | symbolic objects | 1-bit | glint | centred | object |

**Similarity check.** Pairs of scene families that differ in fewer than 3 of the 6 structural attributes: none. Palette is deliberately not an attribute (a recolour is not a different scene).

## Composition grammar

**Layer order (back to front):**

1. grid background (register ground: black, page black, or paper)
2. subject cells (character pass over a subject map)
3. subject motion channel
4. routed calligram letters
5. band mask
6. band text and cursor
7. persistence / ink spread
8. post: scan and curve (ASCII), raster (teletext), paper fibre (typewriter)

**Required.** One register; one subject (except Typed letter and Teletext service, where it is optional); one glyph ramp; one band layout.

**Optional.** Subject motion channel, calligram routing (hooks), page template (teletext), paper (typewriter).

**Scale and position constraints.** Cell size from the three grid resolutions only; band rows 1-3; subject occupies 50-80% of the grid area.

**Typography-safe regions.** Band inside 4-cell margins and out of the subject's declared focal box; bottom 14% kept clear in the app stage.

**Colour compatibility.** One palette per register; teletext only the eight colours; 1-bit only two.

**Motion compatibility.** One moving subject part at a time; migration and density pulse never in the same second.

**Material compatibility.** Paper only with typewriter and 1-bit; scanlines only with ASCII; raster only with teletext.

**Complexity limits.** One subject per scene; max 24 routed letters at once.

**Invalid combinations.**

| This | never with | Because |
|---|---|---|
| Teletext register | cover-derived hues | Breaks the eight-colour medium. |
| Fine grid | outputs under 600 px tall | Unreadable on phones. |
| Devanagari, Tamil, Arabic | per-cell migration | Clusters cannot be split. |
| Fire subject | density pulse | Two flicker sources exceed the flash budget. |
| Calligram | estimated word timing | Hook migration would claim a timing that is a guess (it starts at line end instead). |
| Typewriter register | phosphor bloom | Paper does not glow. |

## Meaningful variation

**Major (change the scene):**
- Subject (over 50 pictures across 13 worlds)
- Register (ASCII, teletext, typewriter, 1-bit)
- Composition (band, calligram, page, sheet, split, macro)
- Detail crop of a subject (zoom-step targets)

**Minor (parameters, not new scenes):**
- Glyph ramp
- Phosphor colour or ink colour
- Grid resolution
- Band row

**Not counted as assets or as variety:** Phosphor recolours; ramp swaps on the same subject; portrait crops of a subject (metadata of the same asset).

## Deterministic selection

Subject = pickSubject(title, lyrics, mood) extended to the new subject list and to Hindi and Tamil lexicons (V3); ties broken by hash(trackId). Register = cover brightness and identity (dark cover: phosphor; light cover: paper; retro tags: teletext), then rotated at chorus flips in a fixed order per song (hash). Second subject for the bridge from the bridge lines' words. All pure functions of track, lyric version and settings.

## Repetition control

A subject is used at most twice per song (main and recall); a register at most for 3 sections in a row. Across songs, the lexicon decides most subjects; when only the mood fallback decides, a per-track hash picks among 3 mood subjects so fallback songs do not all show rain.

## Rejected and merged scene families

| Candidate | Decision | Reason |
|---|---|---|
| Hacker room | rejected | Dropped in Phase 1 (furniture competes with the grid; overlaps Screenlife). |
| Falling code | rejected | Strong likeness to a famous film look. |
