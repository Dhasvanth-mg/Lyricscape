# Signage: asset strategy

Style 10 of 15. Phase 2 planning (generated from planning data). Manifest status: **complete for Phase 2** (every planned asset is an entry; nothing in this style is a placeholder).

## Counts (kept separate by kind; variations and frames are never counted)

| Kind | Entries | Meaning |
|---|---|---|
| component | 5 | Reusable design component: a part that many scenes assemble (a widget, a balloon, a frame, a rule set) |
| composition | 18 | Composition or scene family: a rule set that arranges assets into a scene (not a rendered image) |
| configuration | 43 | Generator configuration or preset: an approved, tuned parameter set for a generator, choreography, camera or grade |
| generator | 9 | Procedural generator: code or shader that draws a family of outputs from parameters |
| source | 82 | Original source asset: a designed drawing, plate, texture, lettering set or kit made by hand or authored by a person |

Live entries: **157** (approved 157, revised 0, deferred 0). Rejected 9, merged 2 (kept in the manifest and the review register).

Production methods: authored-data 57, handcrafted-vector 62, photographed 20, procedural-code 9, shader 9. Priority: essential 28, high 115, medium 14. Complexity: L 9, M 93, S 48, XL 7.

## Why this scale

Phase 1 estimated about 250 assets. Phase 2 approves 157 live entries: 9 hardware generators, 50 sign designs, 20 settings, 7 neon alphabets and supporting families.

## Families

### SIG-PRC-HWR Hardware renderers (9 generators)

- **Purpose:** Display technology is the main variety axis; one renderer per technology on a shared cell framework.
- **Design language:** Procedural renderer of a display technology, drawn cell by cell with its real mechanical or electrical behaviour.
- **Production:** procedural-code; TypeScript renderer plus shader (character-cell pass from SHR-GEN), sprite atlas of cell states.
- **Dimensions:** Cell grid sized to the sign panel.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Signs that declare it. **Exclusions:** One hardware per sign.
- **Quality bar:** Motion matches the real hardware (reviewed against reference footage the owner gathers); readable at 720p; deterministic per frame.

### SIG-OBJ-SGN Sign designs (50 sources)

- **Purpose:** Original signs give each section an object and a place; the largest handcrafted family.
- **Design language:** An original invented sign: its shape, lettering panel, frame, mounting and light, designed as one object; the lyric appears in its lettering panel, the sign's own fixed text is generic (no names).
- **Production:** handcrafted-vector; SVG frame and panel geometry plus emissive mask (KTX2 R8) and a lit/unlit pair; lettering panel rect metadata (cells or free area).
- **Dimensions:** Authored at 2048 on the long side; panel rect in sign space.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Hardware listed per sign (a split-flap sign only holds flaps). **Exclusions:** A sign appears once per section; only one hero sign per frame.
- **Quality bar:** Invented and generic (no readable brand or place names); panel holds a 20-character line at 4.5:1 contrast; distinct silhouette from every other sign in the family.

### SIG-ENV-SET Settings (20 sources)

- **Purpose:** Places at night where signs live.
- **Design language:** Night or dusk places where signs live, painted or photographed and reworked into plates with wet ground, at street-level eye height.
- **Production:** photographed; KTX2 RGB 2048x1152 plate, depth hint map R8, reflection mask R8, portrait crop rect.
- **Dimensions:** 2048x1152.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Sign mounts listed per setting. **Exclusions:** One setting per section.
- **Quality bar:** No identifiable real place, brand or person; mount point leaves the panel inside the safe area; reads as a real place at night.

### SIG-TYP-NEO Neon tube alphabets (7 sources)

- **Purpose:** Neon lettering in four scripts.
- **Design language:** Tube letters drawn as single paths with bends, electrodes and back-painted gaps (black-out between letters).
- **Production:** handcrafted-vector; Path data per glyph (centreline), tube width param, electrode positions.
- **Dimensions:** Em 1000.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Neon hardware. **Exclusions:** No per-letter jitter.
- **Quality bar:** Every glyph of the script covered; joins read correctly (Devanagari headline, Arabic joining forms); a native reader reviews Devanagari, Tamil and Arabic.
- **Gate:** Neon Devanagari and Tamil alphabets need a native-reader review before approval.

### SIG-TYP-BLB Bulb and marquee letters (5 sources)

- **Purpose:** Marquee and arch signs.
- **Design language:** Bulb letters on plates and changeable marquee letters.
- **Production:** handcrafted-vector; Bulb position data per glyph; letter tile SVGs.
- **Dimensions:** Em 1000.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Marquee hardware. **Exclusions:** Latin only (others route to LED).
- **Quality bar:** Readable at 720p; bulbs evenly spaced.

### SIG-TYP-DOT Dot and cell font atlases (6 configurations)

- **Purpose:** Cell hardware type.
- **Design language:** Bitmap fonts baked to atlases per hardware cell.
- **Production:** authored-data; Atlas PNG plus JSON metrics.
- **Dimensions:** Cell sizes 5x7, 7x9, 16x16.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Per hardware. **Exclusions:** Devanagari and Tamil excluded (fallback).
- **Quality bar:** Glyph coverage tested per script.

### SIG-PAL-LPL Light palettes (11 configurations)

- **Purpose:** Colour variety tied to identity.
- **Design language:** Sign light colour sets with ambient grade.
- **Production:** authored-data; JSON.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Hardware listed. **Exclusions:** Neon max 2 tubes per sign.
- **Quality bar:** Contrast targets met.

### SIG-MOT-RHY Hardware rhythms (12 configurations)

- **Purpose:** Each hardware's behaviour varies by section.
- **Design language:** Patterns for chases, flicker and cycling.
- **Production:** authored-data; JSON patterns.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Per hardware. **Exclusions:** No pattern above 3 Hz full-panel flashing.
- **Quality bar:** Flash guard passes.

### SIG-ATM-WEA Weather and street light layers (9 configurations)

- **Purpose:** Atmosphere and mood variety.
- **Design language:** Weather and passing light over the setting.
- **Production:** shader; Configs of SHR generators (rain on glass, depth fog, wet reflection) plus streaks.
- **Dimensions:** Screen.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Settings flagged outdoor. **Exclusions:** Rain never indoors (station hall, airport).
- **Quality bar:** Never reduces panel contrast below target.

### SIG-UIK-BRK Break boards (5 components)

- **Purpose:** Instrumental breaks read naturally on signs.
- **Design language:** Break information laid out as the hardware's own notices.
- **Production:** authored-data; Layout JSON per hardware.
- **Dimensions:** Panel.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Cell hardware. **Exclusions:** Only song title and timing information (no invented data).
- **Quality bar:** Shows only real song metadata.

## Shared assets this style depends on

- none
