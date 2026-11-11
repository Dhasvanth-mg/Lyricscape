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
| D3-CVP-01 | CVP-TYP-VOI-003 heavy grotesk | Archivo Black | Archivo (variable) at weight 900 | Archivo is already bundled; Archivo Black is a separate family not in the project |
| D3-CVP-02 | Latin letter spacing -0.02 em | Tight tracking | Not applied | The shared text texture has no tracking control yet; to add with the typography work |
| D3-CVP-03 | Saliency placement review on 50 covers | 50 real covers | 3 demo covers and a synthetic test cover | No licensed cover set is available here (B-08) |
| D3-SCR-01 | SCR-ENV-ROM-001..011 room plates | Hybrid: photographed or painted, then blurred | Painted in code (gradient, practical light, bokeh discs, streaks, rain, tiles) and blurred by mip level | No photographs may be taken or sourced here; the spec allowed painted plates |
| D3-SCR-02 | SCR-TEX-GLS-001..005 glass | Photographed plates | Painted in code at 3-8% | No photographs; the effect asked for is soft and low-opacity, which code reproduces |
| D3-SCR-03 | SCR-FRM-DEV-* device frames | Handcrafted vector files | Vector drawing in code (`world.ts`), invented and generic | Same method in code; no file format adds anything here |
| D3-SCR-04 | Lyric legibility | The camera alone frames the field so the x-height meets its floor | The camera picks the scale, then the lyric size is raised (capped at 10% of the screen width) until the x-height floor is met | A phone at 55-65% of a 720 px frame cannot show a 17-unit chat font at 2.2% x-height; raising the UI's text size is what a phone's large-text setting does |
| D3-SCR-05 | C4 thread scroll in landscape | Device face-on at 90% height | A tablet in landscape (the spec's alternative) for the phone kits; the post composer stays on a phone | A phone face-on in landscape leaves the lyric under the x-height floor |
| D3-SCR-06 | C1 over the shoulder in landscape | Phone at 55-65% of the height | Phone at about the frame's height, tilted, the camera on the field | Same reason as D3-SCR-04; the room still shows on both sides |
| D3-SCR-07 | SCR-MOT-TYP-009 retype after delete | Types, deletes, retypes the line | Not built; a repeated line's second appearance uses an even, typo-free rhythm | Left as not started in the coverage report |
| D3-SCR-08 | Section transitions | Old and new scenes both visible (app switch card stack, device swap) | Entrance moves only: the new device whips, rises or grows in; the old one is not drawn during the move | One scene state is drawn per frame; drawing both needs a second kit layout per frame. Listed for review |
| D3-SCR-09 | Turbo "Code screens" (`terminal`) | Kept and redesigned as Screenlife | Screenlife is drawn in place of the Turbo terminal scene (as Sketch Cards replaced the sketch scene); `terminal.ts` is kept, unused, until Phase 3 is accepted | Matches the migration map (terminal -> screenlife) |
