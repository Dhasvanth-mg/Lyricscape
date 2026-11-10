# Folio: scene families and composition grammar

Style 6 of 15. Phase 2 planning (generated from planning data).

## Scene families (9)

| ID | Scene family | What it is | Roles | Chosen by (signals) | Compositions | Required families | Optional families |
|---|---|---|---|---|---|---|---|
| FOL-SCN-01 | Literary quarterly | Cream pages, two columns, generous margins, one spot colour. | verse, quiet | inward, literary, folk, ballad | C1, C3, C4 | FOL-LAY-LAY, FOL-TYP-PAIR, FOL-SRF-PAPR | FOL-PRP-RUL, FOL-PRC-PLT, FOL-LAY-MARG |
| FOL-SCN-02 | Newspaper | Newsprint, narrow columns, halftone plates, the hook as the headline. | verse, chorus, high | narrative, story rap, urgent | C1, C2, C4 | FOL-LAY-LAY, FOL-TYP-PAIR, FOL-SRF-PAPR, FOL-TYP-MST | FOL-PRC-PLT, FOL-PRP-RUL |
| FOL-SCN-03 | Theatre programme | A centred programme with acts (sections) and the cast list (title, artist). | verse, chorus | theatrical, musical, dramatic | C1, C6, C2 | FOL-LAY-LAY, FOL-TYP-PAIR, FOL-SRF-PAPR, FOL-TYP-MST | FOL-PRP-RUL |
| FOL-SCN-04 | Art book | Large plates, short captions, white coated paper. | verse, break, quiet | art, visual, ambient, instrumental-heavy | C4, C1 | FOL-LAY-LAY, FOL-TYP-PAIR, FOL-SRF-PAPR, FOL-PRC-PLT | FOL-FRM-FRM |
| FOL-SCN-05 | Letters page | The song as a letter; salutation and signature from title and artist. | verse, bridge | addressed perspective; you and I | C8, C1 | FOL-LAY-LAY, FOL-TYP-PAIR, FOL-SRF-PAPR | FOL-PRP-RUL |
| FOL-SCN-06 | Loud issue | Colliding secondary type around a clean lyric. | chorus, high | energetic, alternative, punk, experimental | C7, C2 | FOL-LAY-LAY, FOL-TYP-PAIR, FOL-SRF-PAPR | FOL-PRC-PLT |
| FOL-SCN-07 | Poetry chapbook | Tiny pages with one line each and a lot of white. | quiet, verse, outro | sparse lyrics, ballads, ambient | C1, C3 | FOL-LAY-LAY, FOL-TYP-PAIR, FOL-SRF-PAPR | FOL-PRP-RUL |
| FOL-SCN-08 | Bilingual edition | Facing-page or parallel-column edition with the translation or romanisation. | verse, chorus | second line enabled; Hindi, Tamil and other non-English songs | C5, C1 | FOL-LAY-LAY, FOL-TYP-PAIR, FOL-SRF-PAPR | FOL-PRP-RUL, FOL-LAY-MARG |
| FOL-SCN-09 | Almanac | Tables and contents: the song's structure as an almanac page (times, sections, lines). | break, intro, outro | breaks and structure pages | C6, C4 | FOL-LAY-LAY, FOL-TYP-PAIR, FOL-SRF-PAPR | FOL-PRC-PLT, FOL-PRP-RUL |

### Structural attributes (used for the similarity check)

| ID | Scene | publication | grid | plate | density | paper | motion |
|---|---|---|---|---|---|---|---|
| 01 | Literary quarterly | quarterly | 2 columns wide margins | small | medium | cream uncoated | slow |
| 02 | Newspaper | newspaper | 6 narrow columns | halftone | high | newsprint | brisk |
| 03 | Theatre programme | programme | centred single column | none | low | coloured card | slow |
| 04 | Art book | art book | plate-led | full | low | white coated | drift |
| 05 | Letters page | letters | letter | none | medium | laid | drift down |
| 06 | Loud issue | loud | broken | fragments | high | duotone | snap |
| 07 | Poetry chapbook | chapbook | one line per page | none | very low | cream small page | page turns |
| 08 | Bilingual edition | bilingual | parallel columns | none | medium | cream | slow |
| 09 | Almanac | almanac | tables | diagram | structured | cream | static |

**Similarity check.** Pairs of scene families that differ in fewer than 3 of the 6 structural attributes: none. Palette is deliberately not an attribute (a recolour is not a different scene).

## Composition grammar

**Layer order (back to front):**

1. desk (when pulled back)
2. page paper
3. body columns (earlier lines, dim)
4. plates and frames
5. rules and ornaments
6. masthead, running heads, folios
7. pull quote or headline (lyric)
8. marginalia (second line, repeat marks)
9. post: paper fibre, page light

**Required.** Publication template, pairing, paper, lyric slot.

**Optional.** Plate, masthead, rules, marginalia.

**Scale and position constraints.** Pull quote and headline from the template's size table; body 1.4-1.8% of frame.

**Typography-safe regions.** Lyric slot inside central 80% after framing; collision type never enters the lyric clear zone.

**Colour compatibility.** Ink plus one spot colour; plates full colour only in the art book.

**Motion compatibility.** One camera move per line at most.

**Material compatibility.** Halftone plates only on newsprint; coated paper only in the art book.

**Complexity limits.** Max 3 columns of body visible at once in the frame.

**Invalid combinations.**

| This | never with | Because |
|---|---|---|
| Body text | invented copy | Secondary text must be the song itself. |
| Drop caps | Devanagari, Tamil, Arabic | Convention and shaping. |
| Italic emphasis | scripts without italics | Use ink darkening. |
| Loud collisions | over the lyric | Readability rule. |
| Real mastheads | any | Rights. |
| Plates | altered cover art when shown as the cover | Artwork policy; derived plates must not pose as the cover. |

## Meaningful variation

**Major (change the scene):**
- Publication (9)
- Template (structure of the page)
- Composition (pull quote, headline, drop cap, plate, parallel, index, collision, letter)
- Plate treatment

**Minor (parameters, not new scenes):**
- Pairing
- Paper
- Spot colour

**Not counted as assets or as variety:** Spot colours, plate crops, mirrored templates.

## Deterministic selection

Publication by perspective, genre, energy and whether the second line is on; templates per section in a seeded order; plates from the cover; masthead name derived from the song title (rule-based, original). Pure functions.

## Repetition control

No template twice in a row except chorus recall; one publication per song plus one section change (bridge); plates at most 2 per song.

## Rejected and merged scene families

| Candidate | Decision | Reason |
|---|---|---|
| Fashion magazine | rejected | Needs photography of people; trivialises the lyric. |
| Zine photocopy | rejected | Overlaps Sketch Cards' photocopy print process. |
