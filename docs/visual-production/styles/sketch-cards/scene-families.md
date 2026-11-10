# Sketch Cards: scene families and composition grammar

Style 9 of 15. Phase 2 planning (generated from planning data).

## Scene families (12)

| ID | Scene family | What it is | Roles | Chosen by (signals) | Compositions | Required families | Optional families |
|---|---|---|---|---|---|---|---|
| SKC-SCN-01 | Desk at night | Index cards on a wooden desk under a lamp. | verse, quiet | default for calm and night songs | C1, C3 | SKC-FRM-CRD, SKC-SRF-GRD, SKC-OBJ-DOD, SKC-PRC-ART | SKC-OBJ-DRK, SKC-PRP-TOL |
| SKC-SCN-02 | Kitchen table | Napkins, receipts and envelopes on a kitchen table. | verse | everyday, love, home | C1, C3 | SKC-FRM-CRD, SKC-SRF-GRD, SKC-OBJ-EVD | SKC-OBJ-DOD, SKC-PRC-ART, SKC-PRP-TOL |
| SKC-SCN-03 | Bedroom wall | Posters and cards pinned to a painted bedroom wall. | chorus, verse | teen, pop, love | C4, C5 | SKC-FRM-CRD, SKC-SRF-GRD, SKC-OBJ-DOD, SKC-PRC-ART | SKC-PRC-PRT |
| SKC-SCN-04 | Street wall | Photocopied posters pasted on a street wall. | chorus, high | hip-hop, punk, protest, energy | C4, C5 | SKC-FRM-CRD, SKC-SRF-GRD, SKC-PRC-PRT | SKC-OBJ-DRK, SKC-PRC-ART |
| SKC-SCN-05 | Notebook pages | Ruled notebook pages with highlighter swipes. | verse, quiet | school, memory, diary (absorbs Notebook) | C1, C5 | SKC-FRM-CRD, SKC-SRF-GRD, SKC-OBJ-DOD | SKC-PRC-ART |
| SKC-SCN-06 | Cue cards in hand | Big cards held up and dropped, one per line. | chorus, verse | addressed lyrics, confessions | C2 | SKC-FRM-CRD, SKC-OBJ-HND | SKC-OBJ-DOD, SKC-PRC-ART |
| SKC-SCN-07 | Corkboard | A corkboard filling with pinned cards, tickets and notes. | verse, bridge | plans, lists, memories | C4 | SKC-FRM-CRD, SKC-SRF-GRD | SKC-OBJ-EVD, SKC-OBJ-DOD |
| SKC-SCN-08 | Sticky note wall | Sticky notes slapped on a wall phrase by phrase. | verse, high | rap, dense lyrics, word-synced | C6 | SKC-FRM-CRD, SKC-SRF-GRD | SKC-OBJ-DOD |
| SKC-SCN-09 | Riso studio | Two-colour riso prints hung on a drying line. | chorus, bridge | indie, art pop | C5, C1 | SKC-FRM-CRD, SKC-PRC-PRT, SKC-SRF-GRD | SKC-PRC-ART |
| SKC-SCN-10 | Creature break | Doodle creatures dance on the desk between lines (absorbs Acid choreography). | break, intro | instrumental breaks | C1 | SKC-MOT-CRE, SKC-SRF-GRD | SKC-PRC-ART, SKC-OBJ-DOD |
| SKC-SCN-11 | Floor scatter | Cards fallen on a floor, seen from above. | outro, bridge | outros; endings of breakup songs | C3, C1 | SKC-FRM-CRD, SKC-SRF-GRD | SKC-OBJ-DRK |
| SKC-SCN-12 | Dark sketchbook | Charcoal and white-pen pages on black paper: the dark register. | verse, chorus | grief, anger, emo, dark identity | C1, C5, C3 | SKC-FRM-CRD, SKC-SRF-GRD, SKC-OBJ-DRK | SKC-PRC-PRT |

### Structural attributes (used for the similarity check)

| ID | Scene | ground | card | process | depth | motion | mood |
|---|---|---|---|---|---|---|---|
| 01 | Desk at night | desk | index card | marker | top-down | drop | calm |
| 02 | Kitchen table | table | napkin and receipt | ballpoint and marker | top-down | drop | warm |
| 03 | Bedroom wall | wall | poster | paint dither | flat | pin | bright |
| 04 | Street wall | street wall | wheatpaste poster | photocopy | flat | paste slap | raw |
| 05 | Notebook pages | notebook | ruled page | pen and highlighter | top-down | page flip | personal |
| 06 | Cue cards in hand | street blur | large card | marker | card near | hand swap | direct |
| 07 | Corkboard | cork | mixed | mixed | flat | pin | busy |
| 08 | Sticky note wall | wall | sticky notes | marker | flat | slap | urgent |
| 09 | Riso studio | drying line | riso print | riso two-colour | hanging | clip on line | crafty |
| 10 | Creature break | desk | none | marker | top-down | dance | playful |
| 11 | Floor scatter | floor | scattered cards | mixed | top-down wide | fall | aftermath |
| 12 | Dark sketchbook | black paper | torn page | charcoal and white pen | top-down | tear | dark |

**Similarity check.** Pairs of scene families that differ in fewer than 3 of the 6 structural attributes: none. Palette is deliberately not an attribute (a recolour is not a different scene).

## Composition grammar

**Layer order (back to front):**

1. ground surface
2. tools and props at the edges
3. pile (baked)
4. top card paper (card type)
5. print process texture
6. doodle drawing
7. lettering (big, pill, thin)
8. tape and pins
9. hand (held scenes)
10. post: soft shadow, light gradient

**Required.** Ground, card type, print process, lettering roles.

**Optional.** Doodle, tools, hand, pile.

**Scale and position constraints.** Card 60-80% of frame height; doodle 12-30% of card.

**Typography-safe regions.** Card text central 84%; doodles never over the big word.

**Colour compatibility.** Song colour set; process limits.

**Motion compatibility.** One card moving at a time.

**Material compatibility.** Riso only on riso cards; photocopy only on wheatpaste and receipts.

**Complexity limits.** Max 6 elements on a card.

**Invalid combinations.**

| This | never with | Because |
|---|---|---|
| Cute drawings | grief or dark identity | Tone. |
| Dark register | cute colour sets | Tone. |
| Per-letter rotation | complex scripts | Shaping. |
| Sticky notes | long lines over 8 words without splitting | Unreadable. |
| Creature dance | reduced motion | Motion rule. |
| Panel sequences | any | Panels territory. |

## Meaningful variation

**Major (change the scene):**
- Ground (scene family)
- Card type
- Print process
- Composition (surface, held, pile, wall, poster, notes)
- Drawing register (cute, everyday, dark)

**Minor (parameters, not new scenes):**
- Font set
- Border kind
- Pill kind
- Colour set

**Not counted as assets or as variety:** The 346 art library ids are seed variations of 14 generators (counted as 14 generators plus their approved new drawings); recolours.

## Deterministic selection

Ground from identity and lyric words; card type from line length and scene; drawings from tags (existing pickArt) plus lexicon; font set and border from the line seed (existing). Pure functions of track and line index.

## Repetition control

Card type not identical on consecutive lines (layout seed changes per line, existing); a drawing at most twice per song except hook cards; grounds max 3 per song.

## Rejected and merged scene families

| Candidate | Decision | Reason |
|---|---|---|
| Chalkboard | rejected | School cliché; overlaps the dark sketchbook register. |
| Phone notes app | rejected | Screenlife territory. |
