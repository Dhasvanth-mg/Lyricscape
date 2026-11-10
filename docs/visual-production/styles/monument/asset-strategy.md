# Monument: asset strategy

Style 15 of 15. Phase 2 planning (generated from planning data). Manifest status: **complete for Phase 2** (every planned asset is an entry; nothing in this style is a placeholder).

## Counts (kept separate by kind; variations and frames are never counted)

| Kind | Entries | Meaning |
|---|---|---|
| composition | 13 | Composition or scene family: a rule set that arranges assets into a scene (not a rendered image) |
| configuration | 74 | Generator configuration or preset: an approved, tuned parameter set for a generator, choreography, camera or grade |
| generator | 5 | Procedural generator: code or shader that draws a family of outputs from parameters |

Live entries: **92** (approved 0, revised 0, deferred 92). Rejected 6, merged 0 (kept in the manifest and the review register).

Production methods: authored-data 77, procedural-code 5, shader 10. Priority: essential 9, high 83. Complexity: M 13, S 74, XL 5.

## Why this scale

Phase 1 estimated about 120 assets. Phase 2 specifies 92 entries. All are deferred behind the MON-G1 prototype gate, so none are approved for production yet. If the gate fails, the reserve Riso Riot replaces Monument and gets its own full specification.

## Families

### MON-PRC-EXT Extrusion methods (5 generators)

- **Purpose:** The core: words become architecture; the method decides readability and script support.
- **Design language:** Ways to turn words into solid blocks.
- **Production:** procedural-code; TypeScript and shaders in the 3D host.
- **Dimensions:** World units.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Per script (see typography). **Exclusions:** Mesh extrusion Latin only.
- **Quality bar:** Passes MON-G1.
- **Gate:** MON-G1 prototype spike: readable façade text while moving (phone and 1080p), 60 fps target on an integrated GPU at 1080p with a 40-line city, and a complex-script path (sprite stack) that renders Devanagari and Tamil correctly. If it fails, Monument is replaced by the reserve style Riso Riot (decisions.md).

### MON-ENV-ARC Architectural templates (14 configurations)

- **Purpose:** Place and camera variety.
- **Design language:** Layouts that place line façades in space.
- **Production:** authored-data; JSON configuration.
- **Dimensions:** World units (1 unit = cap height of a façade word).
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All templates. **Exclusions:** See grammar.
- **Quality bar:** Reviewed in the prototype.
- **Gate:** MON-G1 prototype spike: readable façade text while moving (phone and 1080p), 60 fps target on an integrated GPU at 1080p with a 40-line city, and a complex-script path (sprite stack) that renders Devanagari and Tamil correctly. If it fails, Monument is replaced by the reserve style Riso Riot (decisions.md).

### MON-SRF-MAT Materials (10 configurations)

- **Purpose:** Material per section.
- **Design language:** Procedural surface materials.
- **Production:** shader; Shader configs.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All templates. **Exclusions:** Light only in tunnel.
- **Quality bar:** Readability contract holds on each.
- **Gate:** MON-G1 prototype spike: readable façade text while moving (phone and 1080p), 60 fps target on an integrated GPU at 1080p with a 40-line city, and a complex-script path (sprite stack) that renders Devanagari and Tamil correctly. If it fails, Monument is replaced by the reserve style Riso Riot (decisions.md).

### MON-LGT-LGT Lighting rigs (8 configurations)

- **Purpose:** Mood per section.
- **Design language:** Key light, fill and sky setups.
- **Production:** authored-data; JSON configuration.
- **Dimensions:** World units (1 unit = cap height of a façade word).
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All templates. **Exclusions:** See grammar.
- **Quality bar:** Reviewed in the prototype.
- **Gate:** MON-G1 prototype spike: readable façade text while moving (phone and 1080p), 60 fps target on an integrated GPU at 1080p with a 40-line city, and a complex-script path (sprite stack) that renders Devanagari and Tamil correctly. If it fails, Monument is replaced by the reserve style Riso Riot (decisions.md).

### MON-MOT-PRJ Projection sweeps (6 configurations)

- **Purpose:** Beat-tied light on the architecture.
- **Design language:** Light projected across forms.
- **Production:** authored-data; JSON configuration.
- **Dimensions:** World units (1 unit = cap height of a façade word).
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All templates. **Exclusions:** See grammar.
- **Quality bar:** Reviewed in the prototype.
- **Gate:** MON-G1 prototype spike: readable façade text while moving (phone and 1080p), 60 fps target on an integrated GPU at 1080p with a 40-line city, and a complex-script path (sprite stack) that renders Devanagari and Tamil correctly. If it fails, Monument is replaced by the reserve style Riso Riot (decisions.md).

### MON-CAM-CAM Camera paths (9 configurations)

- **Purpose:** How the song is walked.
- **Design language:** Walking camera behaviours.
- **Production:** authored-data; JSON configuration.
- **Dimensions:** World units (1 unit = cap height of a façade word).
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All templates. **Exclusions:** See grammar.
- **Quality bar:** Reviewed in the prototype.
- **Gate:** MON-G1 prototype spike: readable façade text while moving (phone and 1080p), 60 fps target on an integrated GPU at 1080p with a 40-line city, and a complex-script path (sprite stack) that renders Devanagari and Tamil correctly. If it fails, Monument is replaced by the reserve style Riso Riot (decisions.md).

### MON-ATM-FOG Fog and sky (7 configurations)

- **Purpose:** Depth and cover colour.
- **Design language:** Depth fog colours and sky gradients.
- **Production:** authored-data; JSON configuration.
- **Dimensions:** World units (1 unit = cap height of a façade word).
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All templates. **Exclusions:** See grammar.
- **Quality bar:** Reviewed in the prototype.
- **Gate:** MON-G1 prototype spike: readable façade text while moving (phone and 1080p), 60 fps target on an integrated GPU at 1080p with a 40-line city, and a complex-script path (sprite stack) that renders Devanagari and Tamil correctly. If it fails, Monument is replaced by the reserve style Riso Riot (decisions.md).

### MON-PLT-GRD Ground planes (5 configurations)

- **Purpose:** Grounding the forms.
- **Design language:** Ground surfaces.
- **Production:** authored-data; JSON configuration.
- **Dimensions:** World units (1 unit = cap height of a façade word).
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All templates. **Exclusions:** See grammar.
- **Quality bar:** Reviewed in the prototype.
- **Gate:** MON-G1 prototype spike: readable façade text while moving (phone and 1080p), 60 fps target on an integrated GPU at 1080p with a 40-line city, and a complex-script path (sprite stack) that renders Devanagari and Tamil correctly. If it fails, Monument is replaced by the reserve style Riso Riot (decisions.md).

### MON-CMP-CTY City layout rules (5 configurations)

- **Purpose:** The per-song ending image.
- **Design language:** How past lines arrange into the final city.
- **Production:** authored-data; JSON configuration.
- **Dimensions:** World units (1 unit = cap height of a façade word).
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All templates. **Exclusions:** See grammar.
- **Quality bar:** Reviewed in the prototype.
- **Gate:** MON-G1 prototype spike: readable façade text while moving (phone and 1080p), 60 fps target on an integrated GPU at 1080p with a 40-line city, and a complex-script path (sprite stack) that renders Devanagari and Tamil correctly. If it fails, Monument is replaced by the reserve style Riso Riot (decisions.md).

### MON-TYP-TYF Façade type settings (5 configurations)

- **Purpose:** Readable façades.
- **Design language:** Face and block settings per script.
- **Production:** authored-data; JSON configuration.
- **Dimensions:** World units (1 unit = cap height of a façade word).
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All templates. **Exclusions:** See grammar.
- **Quality bar:** Reviewed in the prototype.
- **Gate:** MON-G1 prototype spike: readable façade text while moving (phone and 1080p), 60 fps target on an integrated GPU at 1080p with a 40-line city, and a complex-script path (sprite stack) that renders Devanagari and Tamil correctly. If it fails, Monument is replaced by the reserve style Riso Riot (decisions.md).

### MON-CMP-RIS Reserve: Riso Riot outline (1 configuration)

- **Purpose:** Keeps 15 styles if Monument is cut; specified in outline only, full Phase 2 depth would follow only if triggered.
- **Design language:** Reserve style if MON-G1 fails: animated riso print with overprinted inks, drawn creatures and grain (Acid redesigned).
- **Production:** authored-data; JSON configuration.
- **Dimensions:** World units (1 unit = cap height of a façade word).
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All templates. **Exclusions:** See grammar.
- **Quality bar:** Reviewed in the prototype.
- **Gate:** Triggered only if MON-G1 fails; the owner approves the swap.

## Shared assets this style depends on

10 shared entries (counted once in the shared manifest, not in this style's total):

- `SHR-PRC-GEN-001` Film grain (generator)
- `SHR-PRC-GEN-009` Seeded noise fields (generator)
- `SHR-PRC-GEN-012` Depth fog and haze (generator)
- `SHR-PRC-GEN-013` Wet ground reflection (generator)
- `SHR-TYP-FNT-003` Archivo Variable (dependency)
- `SHR-TYP-FNT-005` Anton (dependency)
- `SHR-TYP-FNT-016` Noto Sans Devanagari Variable (dependency)
- `SHR-TYP-FNT-017` Noto Sans Tamil Variable (dependency)
- `SHR-TYP-FNT-020` Noto Sans Arabic (dependency)
- `SHR-TYP-FNT-022` Noto Sans Hebrew (dependency)
