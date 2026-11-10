# Folio: asset strategy

Style 6 of 15. Phase 2 planning (generated from planning data). Manifest status: **complete for Phase 2** (every planned asset is an entry; nothing in this style is a placeholder).

## Counts (kept separate by kind; variations and frames are never counted)

| Kind | Entries | Meaning |
|---|---|---|
| component | 56 | Reusable design component: a part that many scenes assemble (a widget, a balloon, a frame, a rule set) |
| composition | 17 | Composition or scene family: a rule set that arranges assets into a scene (not a rendered image) |
| configuration | 32 | Generator configuration or preset: an approved, tuned parameter set for a generator, choreography, camera or grade |
| source | 22 | Original source asset: a designed drawing, plate, texture, lettering set or kit made by hand or authored by a person |

Live entries: **127** (approved 127, revised 0, deferred 0). Rejected 7, merged 1 (kept in the manifest and the review register).

Production methods: authored-data 91, handcrafted-vector 14, photographed 8, procedural-code 14. Priority: essential 71, medium 28, high 28. Complexity: M 61, S 66.

## Why this scale

Phase 1 estimated about 220 originals. This plan approves 127 live entries, with the 36 page templates as its core: each template is a different page. Folio's richness is typographic; adding more ornaments would not add variety.

## Families

### FOL-LAY-LAY Page templates (36 components)

- **Purpose:** Templates are the style's compositions; each produces a different page.
- **Design language:** Specific page designs, each a different editorial structure.
- **Production:** authored-data; JSON page template: page size class, columns, gutters, baseline, slots (pull quote, body, plate, caption, folio, running head, masthead), flow rules.
- **Dimensions:** Page in typographic points on a baseline grid; spreads 2:1.41 (two A-series pages), single pages 1:1.41; mapped into the frame by the camera.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Pairings and papers of the publication; plates. **Exclusions:** Body text is only the song's own earlier lines, the second line, or metadata: never filler copy.
- **Quality bar:** Looks like a professionally set page in a still (review); baseline grid respected; widows and orphans avoided; pull quote 7:1 contrast; dim body never competes (under 40% of pull-quote contrast).

### FOL-TYP-PAIR Type pairings (12 configurations)

- **Purpose:** Voice of each issue.
- **Design language:** Display and text pairings per publication.
- **Production:** authored-data; JSON pairing with script fallbacks.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Publications listed. **Exclusions:** Loud display faces only in the loud issue.
- **Quality bar:** Pairing reviewed for contrast and harmony.

### FOL-SRF-PAPR Paper stocks (8 sources)

- **Purpose:** Material identity of each publication.
- **Design language:** Photographed papers.
- **Production:** photographed; KTX2 RGB 1024 tileable plus fibre map.
- **Dimensions:** 1024x1024.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Publications. **Exclusions:** One paper per page.
- **Quality bar:** No tiling.

### FOL-PRP-RUL Rules and ornaments (14 sources)

- **Purpose:** Editorial structure and finish.
- **Design language:** Original typographic ornaments and rules.
- **Production:** handcrafted-vector; SVG.
- **Dimensions:** Vector.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All templates. **Exclusions:** Max 2 ornament kinds per page.
- **Quality bar:** Original designs; crisp at all sizes.

### FOL-PRC-PLT Plate treatments (8 configurations)

- **Purpose:** Visual relief and breaks.
- **Design language:** How images enter the page.
- **Production:** procedural-code; Configs of the shared cover derivation and halftone generators.
- **Dimensions:** Plate frame size.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Frames. **Exclusions:** The cover shown as the cover is unmodified; derived plates (duotone, halftone) are captioned as details, not as the cover.
- **Quality bar:** Plates never misrepresent the cover.

### FOL-TYP-MST Masthead systems (6 components)

- **Purpose:** Every publication has a name; it must be original and song-specific.
- **Design language:** Rules that build an original masthead from the song title.
- **Production:** procedural-code; JSON rules.
- **Dimensions:** Template slot.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Pairings. **Exclusions:** Never a real publication name (blocklist check).
- **Quality bar:** Generated names pass the blocklist and read as plausible.

### FOL-FRM-FRM Plate frames (6 components)

- **Purpose:** Plates sit like printed images.
- **Design language:** Editorial frames for plates.
- **Production:** authored-data; JSON frame spec.
- **Dimensions:** Template slots.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Plates. **Exclusions:** One frame style per page.
- **Quality bar:** Consistent.

### FOL-LAY-MARG Marginalia (8 components)

- **Purpose:** Reading conventions that carry the song's facts.
- **Design language:** Small editorial elements made from song data.
- **Production:** authored-data; JSON.
- **Dimensions:** Margins.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All templates. **Exclusions:** Only song data.
- **Quality bar:** Correct data.

### FOL-MOT-MOT Editorial motions (7 configurations)

- **Purpose:** Consistent editorial motion vocabulary.
- **Design language:** Restrained text and page motions.
- **Production:** authored-data; JSON.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All. **Exclusions:** Reduced-motion alternatives defined.
- **Quality bar:** Restrained in review.

## Shared assets this style depends on

17 shared entries (counted once in the shared manifest, not in this style's total):

- `SHR-PRC-GEN-001` Film grain (generator)
- `SHR-PRC-GEN-004` Paper fibre and tooth (generator)
- `SHR-PRC-GEN-005` Overprint multiply (generator)
- `SHR-PRC-GEN-009` Seeded noise fields (generator)
- `SHR-PRC-GEN-014` Cover derivation (generator)
- `SHR-TYP-FNT-001` Inter Variable (dependency)
- `SHR-TYP-FNT-007` Cormorant Garamond (dependency)
- `SHR-TYP-FNT-008` Instrument Serif (dependency)
- `SHR-TYP-FNT-009` Playfair Display Variable (dependency)
- `SHR-TYP-FNT-015` Syne Variable (dependency)
- `SHR-TYP-FNT-016` Noto Sans Devanagari Variable (dependency)
- `SHR-TYP-FNT-017` Noto Sans Tamil Variable (dependency)
- `SHR-TYP-FNT-018` Noto Serif Devanagari (dependency)
- `SHR-TYP-FNT-019` Noto Serif Tamil (dependency)
- `SHR-TYP-FNT-021` Noto Naskh Arabic (dependency)
- `SHR-TYP-FNT-023` Frank Ruhl Libre (dependency)
- `SHR-TYP-FNT-028` Newsreader (dependency)
