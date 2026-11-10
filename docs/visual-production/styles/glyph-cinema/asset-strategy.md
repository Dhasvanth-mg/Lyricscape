# Glyph Cinema: asset strategy

Style 2 of 15. Phase 2 planning (generated from planning data). Manifest status: **complete for Phase 2** (every planned asset is an entry; nothing in this style is a placeholder).

## Counts (kept separate by kind; variations and frames are never counted)

| Kind | Entries | Meaning |
|---|---|---|
| component | 16 | Reusable design component: a part that many scenes assemble (a widget, a balloon, a frame, a rule set) |
| composition | 19 | Composition or scene family: a rule set that arranges assets into a scene (not a rendered image) |
| configuration | 56 | Generator configuration or preset: an approved, tuned parameter set for a generator, choreography, camera or grade |
| source | 68 | Original source asset: a designed drawing, plate, texture, lettering set or kit made by hand or authored by a person |

Live entries: **159** (approved 144, revised 15, deferred 0). Rejected 6, merged 1 (kept in the manifest and the review register).

Production methods: authored-data 80, handcrafted-raster 62, photographed 6, procedural-code 6, shader 5. Priority: essential 102, high 57. Complexity: M 98, S 61.

## Why this scale

About 70 subjects were considered; 61 approved (15 existing reworked). Subjects carry the style, so the count is set by the number of concrete images lyrics commonly name (the lexicon audit in Phase 3 should confirm coverage). Registers, ramps and palettes are few by design: the medium must stay recognisable.

## Families

### GLY-ENV-SUB Subject pictures (62 sources)

- **Purpose:** The subject is the picture: the main variation axis and the reason a song gets its own image.
- **Design language:** A greyscale brightness map designed for character rendering: bold silhouettes, clear tonal separation in 6-8 levels, a declared focal box, a portrait crop and a motion channel marking the parts that animate.
- **Production:** handcrafted-raster; Layered source (SVG shapes + painted tones) exported to two R8 PNG channels (brightness, motion) plus JSON (focal box, crops, routing targets, motion loop id, keywords).
- **Dimensions:** Master 1024x576 (16:9) with a portrait crop rect; exported at 512x288 per channel; detail crops at 1024 for zoom-step targets.
- **Variation dimensions inside the family:** Registers, ramps, palettes and crops are not separate assets.
- **Compatibility:** All registers; ramps; calligram rules. **Exclusions:** Fire and light subjects never with density pulse; sky subjects never with the 1-bit register at fine grid (stars vanish).
- **Quality bar:** Nameable in 1 s at the medium grid in all four registers; focal box clear of both band positions it allows; motion channel animates only the intended parts; no likeness of a real person, logo or artwork.

### GLY-MOT-ANI Subject motion loops (11 configurations)

- **Purpose:** Make the picture alive in breaks without leaving the grid.
- **Design language:** Periodic motions applied through a subject's motion channel, at cell resolution.
- **Production:** authored-data; JSON: loop type, period, direction, amplitude in ramp levels.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Subjects that declare the loop id. **Exclusions:** Max one loop group animated at full amplitude at once.
- **Quality bar:** Seamless at the loop period; no cell flips more than 3 times per second.

### GLY-TYP-RMP Glyph ramps (14 configurations)

- **Purpose:** The ramp is the texture of the picture; different ramps give different materials.
- **Design language:** Ordered character sets from empty to full.
- **Production:** authored-data; JSON ordered glyph list with measured coverage per glyph (computed at build).
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Registers state allowed ramps. **Exclusions:** No ramp uses letters of a complex script.
- **Quality bar:** Coverage strictly increasing; at least 6 distinguishable levels at the coarse grid.

### GLY-PRC-REG Registers (5 configurations)

- **Purpose:** Changing the medium is the style's chorus move.
- **Design language:** Medium presets of the shared character-cell pass.
- **Production:** shader; Configuration of SHR character-cell pass and POST uniforms.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Ramps and palettes per register. **Exclusions:** See grammar.
- **Quality bar:** Each register recognisable from a single frame; band contrast passes.

### GLY-LAY-PAG Teletext page templates (9 components)

- **Purpose:** The teletext register needs pages whose content is the song itself, not invented news.
- **Design language:** Original 40x24 page layouts with header, body and footer rows.
- **Production:** authored-data; JSON 40x24 cell layout with slots.
- **Dimensions:** 40x24 cells.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Teletext register only. **Exclusions:** No real broadcaster names or page designs.
- **Quality bar:** Every slot filled from song data; no invented headlines.

### GLY-SRF-PAP Typewriter papers (6 sources)

- **Purpose:** The material of the typewriter register.
- **Design language:** Paper sheets with real fibre and edge character.
- **Production:** photographed; RGB JPEG or KTX2 1024x1448 (A-series ratio) plus an R8 fibre map.
- **Dimensions:** 1024x1448.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Typewriter and 1-bit registers. **Exclusions:** Never with phosphor.
- **Quality bar:** No visible tiling; ink spread plausible on the fibre map.

### GLY-PAL-PAL Register palettes (8 configurations)

- **Purpose:** Keeps each register honest while allowing cover adaptation where permitted.
- **Design language:** Fixed colour sets per register.
- **Production:** authored-data; JSON colour sets (OKLCH) with contrast pairs.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Per register. **Exclusions:** Teletext palette fixed.
- **Quality bar:** Band contrast pairs pass 7:1 (screen) or 4.5:1 (paper).

### GLY-LAY-LAY Band layouts (7 components)

- **Purpose:** Guarantees readability independent of the picture.
- **Design language:** Where the lyric sits in the grid.
- **Production:** authored-data; JSON band spec.
- **Dimensions:** Cells.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All compositions. **Exclusions:** Band never inside the subject focal box.
- **Quality bar:** Band readable at all sizes; never overlaps focal box.

### GLY-MOT-CAL Calligram routing rules (6 configurations)

- **Purpose:** Makes the hook become the picture in a way that reads as intentional.
- **Design language:** Rules that pick target cells for migrating letters.
- **Production:** procedural-code; JSON rule plus code in the router.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Subjects with routing target masks. **Exclusions:** Latin and CJK only (per-cell scripts).
- **Quality bar:** Routed letters read as part of the picture in review on 10 hooks.

### GLY-CAM-CAM Grid-snapped camera moves (5 configurations)

- **Purpose:** Detail and scale changes without breaking the medium.
- **Design language:** Discrete camera moves in cell units.
- **Production:** authored-data; JSON move spec.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All. **Exclusions:** Never during migration.
- **Quality bar:** No sub-cell motion visible in frame-by-frame review.

## Shared assets this style depends on

- none
