# Sketch Cards: asset strategy

Style 9 of 15. Phase 2 planning (generated from planning data). Manifest status: **complete for Phase 2** (every planned asset is an entry; nothing in this style is a placeholder).

## Counts (kept separate by kind; variations and frames are never counted)

| Kind | Entries | Meaning |
|---|---|---|
| component | 22 | Reusable design component: a part that many scenes assemble (a widget, a balloon, a frame, a rule set) |
| composition | 18 | Composition or scene family: a rule set that arranges assets into a scene (not a rendered image) |
| configuration | 34 | Generator configuration or preset: an approved, tuned parameter set for a generator, choreography, camera or grade |
| generator | 14 | Procedural generator: code or shader that draws a family of outputs from parameters |
| source | 140 | Original source asset: a designed drawing, plate, texture, lettering set or kit made by hand or authored by a person |

Live entries: **228** (approved 168, revised 60, deferred 0). Rejected 9, merged 1 (kept in the manifest and the review register).

Production methods: authored-data 45, handcrafted-vector 115, hybrid 14, photographed 11, procedural-code 36, shader 7. Priority: essential 53, high 147, medium 22, optional 6. Complexity: M 48, S 180.

## Why this scale

Phase 1 estimated about 550 originals with about 350 existing. Phase 2 corrects that: the 346 art library drawings are seed variations of 14 generators, so they count as 14 generator entries. The plan approves 228 live entries, including 80 new hand-designed drawings (40 dark, 40 everyday) and the 24 existing sketch doodles.

## Families

### SKC-FRM-CRD Card types (14 sources)

- **Purpose:** The card type changes the object and the layout space.
- **Design language:** Real paper objects with distinct shapes and edges.
- **Production:** hybrid; SVG outline plus photographed paper texture (KTX2) and edge mask.
- **Dimensions:** Shape at its real proportion, textures 1024.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Print processes listed. **Exclusions:** Receipts only with photocopy or ballpoint.
- **Quality bar:** Reads as the object; layout solver fits roles.

### SKC-SRF-GRD Grounds (11 sources)

- **Purpose:** Place and the pile's home.
- **Design language:** Surfaces seen from above or straight on, photographed or painted, slightly out of focus at edges.
- **Production:** photographed; KTX2 RGB 2048x1152 plus portrait crop.
- **Dimensions:** 2048x1152.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Card types per scene. **Exclusions:** One ground per section.
- **Quality bar:** No identifiable objects, brands or text.

### SKC-OBJ-DOD Sketch doodles (existing) (24 sources)

- **Purpose:** The existing hand-made sketch drawings kept as the cute register.
- **Design language:** Hand-drawn doodle in the art library's language: round line caps, one fill, one stroke, one accent colour; drawn so it reads at 12% of card height; the dark register uses heavier ink, fewer colours and more empty space.
- **Production:** handcrafted-vector; Canvas path drawing in the art library format (code path data, the existing pattern) or SVG converted to path data at build; one drawing per entry.
- **Dimensions:** Centred on (0,0) inside radius r (library convention).
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Card types and print processes; the dark register only with dark-allowed colour sets. **Exclusions:** Dark-register drawings never with cute colour sets; cute drawings never on dark or grief identity.
- **Quality bar:** Distinct subject from all other drawings; matches the library line language; reads at 12% of card height; no likeness of known characters or logos.

### SKC-PRC-ART Art library generators (existing) (14 generators)

- **Purpose:** Variety of small drawings; reclassified in Phase 2 as 14 generators, not 346 originals.
- **Design language:** Seeded code drawings: one generator per family; each id is a seed variation (not a separate design).
- **Production:** procedural-code; Existing TypeScript generators (art/library.ts).
- **Dimensions:** Radius r convention.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All card types. **Exclusions:** Not in the dark register.
- **Quality bar:** Each generator's approved seeds reviewed (a seed blocklist removes weak outputs).

### SKC-OBJ-DRK Dark register drawings (40 sources)

- **Purpose:** Lets the style serve grief, anger and rawness (Phase 1 risk: cuteness ceiling).
- **Design language:** Hand-drawn doodle in the art library's language: round line caps, one fill, one stroke, one accent colour; drawn so it reads at 12% of card height; the dark register uses heavier ink, fewer colours and more empty space.
- **Production:** handcrafted-vector; Canvas path drawing in the art library format (code path data, the existing pattern) or SVG converted to path data at build; one drawing per entry.
- **Dimensions:** Centred on (0,0) inside radius r (library convention).
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Card types and print processes; the dark register only with dark-allowed colour sets. **Exclusions:** Dark-register drawings never with cute colour sets; cute drawings never on dark or grief identity.
- **Quality bar:** Distinct subject from all other drawings; matches the library line language; reads at 12% of card height; no likeness of known characters or logos.

### SKC-OBJ-EVD Everyday object drawings (40 sources)

- **Purpose:** Personal, specific objects that make cards feel like a life (new; the art library is mostly generic).
- **Design language:** Hand-drawn doodle in the art library's language: round line caps, one fill, one stroke, one accent colour; drawn so it reads at 12% of card height; the dark register uses heavier ink, fewer colours and more empty space.
- **Production:** handcrafted-vector; Canvas path drawing in the art library format (code path data, the existing pattern) or SVG converted to path data at build; one drawing per entry.
- **Dimensions:** Centred on (0,0) inside radius r (library convention).
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Card types and print processes; the dark register only with dark-allowed colour sets. **Exclusions:** Dark-register drawings never with cute colour sets; cute drawings never on dark or grief identity.
- **Quality bar:** Distinct subject from all other drawings; matches the library line language; reads at 12% of card height; no likeness of known characters or logos.

### SKC-MOT-CRE Creature choreographies (from Acid) (10 configurations)

- **Purpose:** Breaks feel alive and playful.
- **Design language:** Doodle creatures (existing Acid cast and critters) dancing on the ground.
- **Production:** authored-data; JSON choreography (absorbed from acid.ts).
- **Dimensions:** Ground space.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Critter and creature drawings. **Exclusions:** Not in dark register; off in reduced motion.
- **Quality bar:** Dance reads as character motion.

### SKC-OBJ-HND Hands (5 sources)

- **Purpose:** Cue card scenes.
- **Design language:** Simple drawn or silhouetted hands holding cards.
- **Production:** handcrafted-vector; SVG.
- **Dimensions:** 1024.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Large cue cards. **Exclusions:** No skin-tone realism (ink style).
- **Quality bar:** Reads as a hand holding; neutral.

### SKC-PRC-PRT Print processes (7 configurations)

- **Purpose:** Changes the material of the card.
- **Design language:** Hand print methods as post passes on the card.
- **Production:** shader; Configs of shared halftone, dither and overprint generators.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Card types. **Exclusions:** See grammar.
- **Quality bar:** Each process distinct in a side-by-side review.

### SKC-TYP-FNT Font sets (existing) (12 configurations)

- **Purpose:** Lettering variety per card.
- **Design language:** Big, mid and thin face sets.
- **Production:** authored-data; Existing FONT_SETS plus script sets.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All. **Exclusions:** Script sets for complex scripts.
- **Quality bar:** Hierarchy clear.

### SKC-TYP-PIL Pill kinds (existing) (5 components)

- **Purpose:** Mid-level emphasis.
- **Design language:** Boxes around the second word.
- **Production:** procedural-code; Existing code.
- **Dimensions:** Word box.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All. **Exclusions:** n/a
- **Quality bar:** Readable.

### SKC-TYP-BIG Big word treatments (existing) (5 components)

- **Purpose:** Top-level emphasis.
- **Design language:** Big word styles.
- **Production:** procedural-code; Existing code.
- **Dimensions:** Word.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All. **Exclusions:** n/a
- **Quality bar:** Readable.

### SKC-PRP-COL Borders (existing) (12 components)

- **Purpose:** Card edge variety.
- **Design language:** Card borders.
- **Production:** procedural-code; Existing BORDER_KINDS.
- **Dimensions:** Card edge.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Card types without their own edge. **Exclusions:** None on receipts and sticky notes.
- **Quality bar:** Consistent.

### SKC-PRP-TOL Desk tools (6 sources)

- **Purpose:** Makes the ground a workplace.
- **Design language:** Drawn or photographed tools at frame edges.
- **Production:** handcrafted-vector; SVG.
- **Dimensions:** 512.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Top-down grounds. **Exclusions:** Max 2 per frame.
- **Quality bar:** Never overlaps the card text.

## Shared assets this style depends on

21 shared entries (counted once in the shared manifest, not in this style's total):

- `SHR-PRC-GEN-001` Film grain (generator)
- `SHR-PRC-GEN-002` Ordered and blue-noise dither (generator)
- `SHR-PRC-GEN-003` Halftone and screentone (generator)
- `SHR-PRC-GEN-004` Paper fibre and tooth (generator)
- `SHR-PRC-GEN-005` Overprint multiply (generator)
- `SHR-PRC-GEN-009` Seeded noise fields (generator)
- `SHR-PRC-GEN-011` Distance-along-stroke reveal (generator)
- `SHR-TYP-FNT-005` Anton (dependency)
- `SHR-TYP-FNT-006` Bebas Neue (dependency)
- `SHR-TYP-FNT-007` Cormorant Garamond (dependency)
- `SHR-TYP-FNT-008` Instrument Serif (dependency)
- `SHR-TYP-FNT-011` Special Elite (dependency)
- `SHR-TYP-FNT-012` Permanent Marker (dependency)
- `SHR-TYP-FNT-013` Bangers (dependency)
- `SHR-TYP-FNT-016` Noto Sans Devanagari Variable (dependency)
- `SHR-TYP-FNT-017` Noto Sans Tamil Variable (dependency)
- `SHR-TYP-FNT-020` Noto Sans Arabic (dependency)
- `SHR-TYP-FNT-022` Noto Sans Hebrew (dependency)
- `SHR-TYP-FNT-024` Caveat (dependency)
- `SHR-TYP-FNT-025` Kalam (dependency)
- `SHR-TYP-FNT-026` Kavivanar (dependency)
