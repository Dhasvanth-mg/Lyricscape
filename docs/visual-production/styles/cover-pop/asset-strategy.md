# Cover Pop: asset strategy

Style 14 of 15. Phase 2 planning (generated from planning data). Manifest status: **complete for Phase 2** (every planned asset is an entry; nothing in this style is a placeholder).

## Counts (kept separate by kind; variations and frames are never counted)

| Kind | Entries | Meaning |
|---|---|---|
| component | 14 | Reusable design component: a part that many scenes assemble (a widget, a balloon, a frame, a rule set) |
| composition | 13 | Composition or scene family: a rule set that arranges assets into a scene (not a rendered image) |
| configuration | 51 | Generator configuration or preset: an approved, tuned parameter set for a generator, choreography, camera or grade |
| generator | 13 | Procedural generator: code or shader that draws a family of outputs from parameters |
| source | 81 | Original source asset: a designed drawing, plate, texture, lettering set or kit made by hand or authored by a person |

Live entries: **172** (approved 146, revised 26, deferred 0). Rejected 6, merged 1 (kept in the manifest and the review register).

Production methods: authored-data 64, handcrafted-vector 81, procedural-code 27. Priority: essential 55, high 77, medium 40. Complexity: M 21, S 151.

## Why this scale

Phase 1 listed 480 existing icons. That count is 45 icons times 10 rendering treatments, so Phase 2 counts the 45 icons. It approves 172 live entries. The main variety comes from the cover itself, which differs for every song.

## Families

### CVP-TYP-VOI Type voices (9 configurations)

- **Purpose:** One cover, several voices: Phase 1 asked for two or three more than Nunito.
- **Design language:** Display type voices chosen by genre and identity.
- **Production:** authored-data; JSON font roles.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All. **Exclusions:** Italic only for Latin.
- **Quality bar:** Each voice distinct; readable at 7% cap height.

### CVP-OBJ-ICN Icons (existing) (45 sources)

- **Purpose:** Word-linked marks (WORD_ICON lexicon).
- **Design language:** Existing flat vector icons placed beside words that have them.
- **Production:** handcrafted-vector; Existing icons.ts path data.
- **Dimensions:** Icon box.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All voices. **Exclusions:** Max one per phrase.
- **Quality bar:** Existing; reviewed for clutter.

### CVP-PRP-STK Annotation stickers (36 sources)

- **Purpose:** Hand-placed marks that point at, circle and celebrate words (new; the icons are nouns, these are gestures).
- **Design language:** Flat vector annotation sticker with a white die-cut border and a soft drop shadow, drawn to sit beside a word like a hand-placed mark on the cover.
- **Production:** handcrafted-vector; SVG (fill, line, border) converted to path data; sticker anchor point and word-side preference.
- **Dimensions:** Normalised 0-1 box, placed at 6-14% of frame height.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All type voices; max two stickers per phrase. **Exclusions:** Never over a word; never more than two on screen; never on grief identity with playful stickers.
- **Quality bar:** Reads as an annotation, not an emoji; distinct from every existing icon; works on light and dark covers.

### CVP-PRC-CUT Cover cut-out generator (4 generators)

- **Purpose:** Stickers that belong to the cover's world, made from it (no pixel modification beyond cropping).
- **Design language:** Stickers cut from the cover itself with a white die-cut border.
- **Production:** procedural-code; Generator: picks salient regions, cuts a rounded shape, adds a border and shadow.
- **Dimensions:** 8-18% of frame height.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Covers 600 px or larger. **Exclusions:** Max three cut-outs.
- **Quality bar:** Cuts never mid-face where detectable by saliency heuristics; borders clean.

### CVP-CAM-CRP Crop and pan paths (12 configurations)

- **Purpose:** One cover becomes many compositions.
- **Design language:** Ken Burns style paths over the cover.
- **Production:** authored-data; JSON path templates resolved against saliency regions.
- **Dimensions:** Normalised.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Covers 600 px or larger for deep crops. **Exclusions:** Max zoom so cover pixels never upscale beyond 2x.
- **Quality bar:** No pixelation at 1080p from 640 px covers within the zoom limit.

### CVP-GEO-BST Burst shapes (8 components)

- **Purpose:** Chorus energy.
- **Design language:** Flat shapes behind the hook (absorbed from Maximalist).
- **Production:** procedural-code; Burst renderer.
- **Dimensions:** Behind the word.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All. **Exclusions:** Off in reduced motion.
- **Quality bar:** Never reduces word contrast.

### CVP-LAY-PHL Phrase layouts (14 configurations)

- **Purpose:** Composition variety for phrases.
- **Design language:** Arrangements of 1-4 words in a region.
- **Production:** authored-data; JSON.
- **Dimensions:** Region-relative.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Voices. **Exclusions:** Mirrors are parameters.
- **Quality bar:** Readable order.

### CVP-TYP-CHP Chip styles (6 components)

- **Purpose:** Word emphasis.
- **Design language:** Emphasis chips on the heaviest word.
- **Production:** procedural-code; Chip renderer.
- **Dimensions:** Word box.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All voices. **Exclusions:** One per phrase.
- **Quality bar:** Contrast.

### CVP-PAL-COL Colour pickers (5 configurations)

- **Purpose:** Readable hot colour.
- **Design language:** Rules for choosing word colour from the cover.
- **Production:** authored-data; JSON rules over the existing picker.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All. **Exclusions:** n/a
- **Quality bar:** 4.5:1 on 50 test covers.

### CVP-PRC-SAL Cover analysis (4 generators)

- **Purpose:** Where phrases and crops go.
- **Design language:** Saliency maps from the cover.
- **Production:** procedural-code; Worker computation (no ML).
- **Dimensions:** 64x64 maps.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All covers. **Exclusions:** No face recognition; detail density only.
- **Quality bar:** Placement review on 50 covers.

### CVP-ENV-FBK Fallback stages (5 generators)

- **Purpose:** The style still works without a strong cover.
- **Design language:** Generated stages from the palette when the cover is missing or text-only.
- **Production:** procedural-code; Shader generators.
- **Dimensions:** Screen.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All. **Exclusions:** Only when the cover is missing, under 300 px or text-only (busy-ness and colour checks).
- **Quality bar:** Looks intentional, not like an error.

### CVP-MOT-PHM Phrase motions (7 configurations)

- **Purpose:** Motion per energy.
- **Design language:** Pop and hand-off timings.
- **Production:** authored-data; JSON.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All. **Exclusions:** Reduced motion: fade only.
- **Quality bar:** Readable.

## Shared assets this style depends on

12 shared entries (counted once in the shared manifest, not in this style's total):

- `SHR-PRC-GEN-001` Film grain (generator)
- `SHR-PRC-GEN-003` Halftone and screentone (generator)
- `SHR-PRC-GEN-009` Seeded noise fields (generator)
- `SHR-PRC-GEN-014` Cover derivation (generator)
- `SHR-TYP-FNT-001` Inter Variable (dependency)
- `SHR-TYP-FNT-005` Anton (dependency)
- `SHR-TYP-FNT-010` DM Serif Display (dependency)
- `SHR-TYP-FNT-014` Nunito 900 and 900 italic (dependency)
- `SHR-TYP-FNT-016` Noto Sans Devanagari Variable (dependency)
- `SHR-TYP-FNT-017` Noto Sans Tamil Variable (dependency)
- `SHR-TYP-FNT-020` Noto Sans Arabic (dependency)
- `SHR-TYP-FNT-022` Noto Sans Hebrew (dependency)
