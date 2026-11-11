# Design deviations and assumptions

## Owner decisions taken as assumptions (Phase 2 recommendations used as defaults)

The owner had four open decisions at the end of Phase 2. Phase 3 started on the Phase 2 recommendation for each; any of them can be
reversed without throwing work away.

| Id | Decision | Assumption used | Effect if the owner decides otherwise |
| --- | --- | --- | --- |
| A-01 (D-03) | Asset scale | The 2,496 live manifest entries are the target; each designed thing is counted once | A larger target adds entries; nothing built is wasted |
| A-02 (D-01) | Monument | Monument stays gated behind its prototype (MON-G1); Riso Riot is the reserve. The registry keeps Monument unoffered (`stage: 'blocked'`) | If Monument is dropped now, swap in Riso Riot's slot |
| A-03 (D-05) | Stored-pick migration | The Phase 2 map, in `lib/styles/migrate.ts` (`MIGRATION_VERSION = 1`) | Change the two tables; tests pin every old id |
| A-04 (R-01) | Who draws the ~1,030 handcrafted and photographed assets | Only what can be made to spec in code here is made; the rest is recorded as blocked in `blockers.md` | A named illustrator or photographer unblocks those families |

## Method deviations

| Id | Asset or family | Planned | Done | Why |
| --- | --- | --- | --- | --- |
| D3-SKC-01 | SKC-SRF-GRD-001..011 grounds | Photographed or painted surfaces | Painted in code (value noise, planks, cork, plaster, notebook, poster remnants) | No photographs may be taken or sourced here; painted was an allowed method in the spec |
| D3-SKC-02 | SKC-FRM-CRD-001..014 card types | Hybrid: photographed paper texture under a drawn shape | Paper painted in code (tooth, fibre, rules, folds, tears, perforations) | No photographs; the drawn shapes are as specified |
| D3-SKC-03 | SKC-OBJ-* drawings, SKC-OBJ-HND, SKC-PRP-TOL | Hand-drawn by an illustrator | Drawn as code through a seeded hand pen (`lib/styles/sketch-cards/pen.ts`): wobble, overshoot, offset fills | Spec allowed "drawn"; each drawing was reviewed on a contact sheet and weak ones redrawn |
| D3-SKC-04 | SKC-MOT-CRE choreographies | Danced by the existing Acid cast and critters | Danced by the SKC doodles (SKC-OBJ-DOD) | The Acid cast lives in the Acid scene and is not exported; the doodles are this style's own cast |
| D3-SKC-05 | Right-to-left lettering reveal | Wipe in reading direction | Words fade in (in right-to-left order) | The sprite clip only wipes left to right; a fade never runs against reading order |
| D3-SKC-06 | SKC-TYP-FNT-009/010 big word | Noto Devanagari / Tamil Black | Noto Sans Devanagari / Tamil variable at weight 900 | The variable fonts carry the black weight; same family |
