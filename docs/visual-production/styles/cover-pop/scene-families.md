# Cover Pop: scene families and composition grammar

Style 14 of 15. Phase 2 planning (generated from planning data).

## Scene families (8)

| ID | Scene family | What it is | Roles | Chosen by (signals) | Compositions | Required families | Optional families |
|---|---|---|---|---|---|---|---|
| CVP-SCN-01 | Full stage | The full cover with hot phrases and the chip. | chorus, intro | default for choruses | C1, C3 | CVP-TYP-VOI, CVP-LAY-PHL, CVP-TYP-CHP | CVP-GEO-BST, CVP-PRP-STK |
| CVP-SCN-02 | Detail tour | The camera tours details of the cover; phrases sit in each crop's empty space. | verse | default for verses | C2 | CVP-CAM-CRP, CVP-PRC-SAL, CVP-LAY-PHL | CVP-PRP-STK |
| CVP-SCN-03 | Burst hook | Giant hook words with bursts on downbeats. | chorus, high | energetic hooks | C1, C3 | CVP-GEO-BST, CVP-TYP-VOI | CVP-PRP-STK |
| CVP-SCN-04 | Side field | The cover beside a colour field holding the phrases. | verse, quiet | busy covers, long lines | C4 | CVP-PAL-COL, CVP-LAY-PHL | CVP-PRP-STK |
| CVP-SCN-05 | Collage | Cut-out stickers made from the cover around the phrase. | bridge, verse | playful, fan energy | C5 | CVP-PRC-CUT, CVP-PRP-STK, CVP-LAY-PHL | none |
| CVP-SCN-06 | Slow breathe | Slow push over the cover, single words. | quiet, break | ballads, breaks | C1, C2 | CVP-CAM-CRP | CVP-LAY-PHL |
| CVP-SCN-07 | No-cover stage | A generated stage from the palette when the cover cannot carry the style. | verse, chorus | missing or text-only covers | C3, C1 | CVP-ENV-FBK, CVP-TYP-VOI, CVP-LAY-PHL | CVP-GEO-BST, CVP-PRP-STK |
| CVP-SCN-08 | Framed ending | The cover recedes to a framed square on its own colour. | outro | endings | C4 | CVP-PAL-COL | none |

### Structural attributes (used for the similarity check)

| ID | Scene | cover | voice | layout | stickers | motion | mood |
|---|---|---|---|---|---|---|---|
| 01 | Full stage | full | rounded | saliency | few | pop | bright |
| 02 | Detail tour | crop | as section | crop region | one | pan | exploring |
| 03 | Burst hook | full | condensed | giant word | none | punch | explosive |
| 04 | Side field | inset | serif | field column | one | slide | calm |
| 05 | Collage | full and cut-outs | script | centre | many | pop | playful |
| 06 | Slow breathe | slow push | serif | single word | none | fade | tender |
| 07 | No-cover stage | generated | wide | giant word | few | pop | bright |
| 08 | Framed ending | framed | as section | none | none | recede | ending |

**Similarity check.** Pairs of scene families that differ in fewer than 3 of the 6 structural attributes: none. Palette is deliberately not an attribute (a recolour is not a different scene).

## Composition grammar

**Layer order (back to front):**

1. colour field (where the cover does not fill)
2. cover (unmodified, cropped and scaled only)
3. burst
4. cut-out stickers
5. phrase
6. chip
7. annotation stickers

**Required.** Cover or fallback stage, phrase, voice.

**Optional.** Chip, stickers, burst.

**Scale and position constraints.** Phrase cap height 7-14%.

**Typography-safe regions.** Phrase central 84%; never over detected high-detail regions where an empty one exists.

**Colour compatibility.** Per word from the pixels behind (existing).

**Motion compatibility.** One phrase at a time.

**Material compatibility.** Cover untouched.

**Complexity limits.** Max two stickers plus one burst.

**Invalid combinations.**

| This | never with | Because |
|---|---|---|
| Cover blur or dim | any | Artwork rule. |
| Italic | complex scripts | Shaping. |
| Playful stickers | grief identity | Tone. |
| Burst | reduced motion | Motion rule. |
| Phrase over 4 words | any | Readability: split. |
| Cut-out stickers | covers under 600 px | Quality. |

## Meaningful variation

**Major (change the scene):**
- The cover itself
- Composition (full, crop, giant, field, collage)
- Type voice
- Crop path
- Phrase layout

**Minor (parameters, not new scenes):**
- Chip style
- Stickers
- Burst
- Colour picker

**Not counted as assets or as variety:** The 10 existing icon treatments (renderer variations of the 45 icons); recoloured stickers; mirrored layouts.

## Deterministic selection

Composition from cover analysis (saliency and busy-ness) and section role; voice from genre and identity; crop path from saliency regions; layout from line length and region shape. Pure functions of track, cover hash and line index.

## Repetition control

Crop paths not repeated within a song; layouts not identical on consecutive phrases; stickers at most once per section.

## Rejected and merged scene families

| Candidate | Decision | Reason |
|---|---|---|
| Mirror tiles | rejected | Modifies the artwork (not allowed). |
| Blurred cover backdrop | rejected | Modifies the artwork; Nocturne and others use blur, this style must not. |
