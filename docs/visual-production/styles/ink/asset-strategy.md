# Ink: asset strategy

Style 11 of 15. Phase 2 planning (generated from planning data). Manifest status: **complete for Phase 2** (every planned asset is an entry; nothing in this style is a placeholder).

## Counts (kept separate by kind; variations and frames are never counted)

| Kind | Entries | Meaning |
|---|---|---|
| composition | 16 | Composition or scene family: a rule set that arranges assets into a scene (not a rendered image) |
| configuration | 43 | Generator configuration or preset: an approved, tuned parameter set for a generator, choreography, camera or grade |
| generator | 17 | Procedural generator: code or shader that draws a family of outputs from parameters |
| source | 112 | Original source asset: a designed drawing, plate, texture, lettering set or kit made by hand or authored by a person |

Live entries: **188** (approved 181, revised 0, deferred 7). Rejected 9, merged 4 (kept in the manifest and the review register).

Production methods: authored-data 53, hybrid 102, photographed 10, procedural-code 23. Priority: high 156, essential 22, medium 10. Complexity: L 6, M 108, S 67, XL 7.

## Why this scale

Phase 1 estimated about 250 assets. Phase 2 approves 188 live entries: about 80 hand-painted elements (the owner paints and scans them), 20 brush strokes and supporting generators. The stroke-reveal family is deferred behind a spike; the style still works with the generic wipe if the spike fails.

## Families

### INK-ENV-LND Landscape elements (16 sources)

- **Purpose:** Distance and openness.
- **Design language:** A painted element in a few wet strokes: tonal range from dense black to pale wash, dry-brush edges, generous empty paper around it; the brush order is part of the asset.
- **Production:** hybrid; Scanned ink painting (owner paints on paper; scanned 600 dpi) vectorised into stroke records: per stroke a centreline, width profile and wash mask; plus the flattened KTX2 R8 ink density map.
- **Dimensions:** Density map 2048 on the long side; stroke records in element space.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All papers; water register only for elements flagged water-safe. **Exclusions:** One painted element per frame (plus one small accent element); never behind the active line.
- **Quality bar:** Reads in under 12 strokes; distinct silhouette from other members; tonal range present; empty space at least 55% of the element zone; no seal, signature or poem text.

### INK-OBJ-BOT Botanical elements (20 sources)

- **Purpose:** Seasons, love and growth (best for breaks: growth strokes).
- **Design language:** A painted element in a few wet strokes: tonal range from dense black to pale wash, dry-brush edges, generous empty paper around it; the brush order is part of the asset.
- **Production:** hybrid; Scanned ink painting (owner paints on paper; scanned 600 dpi) vectorised into stroke records: per stroke a centreline, width profile and wash mask; plus the flattened KTX2 R8 ink density map.
- **Dimensions:** Density map 2048 on the long side; stroke records in element space.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All papers; water register only for elements flagged water-safe. **Exclusions:** One painted element per frame (plus one small accent element); never behind the active line.
- **Quality bar:** Reads in under 12 strokes; distinct silhouette from other members; tonal range present; empty space at least 55% of the element zone; no seal, signature or poem text.

### INK-ATM-SKY Sky and weather elements (12 sources)

- **Purpose:** Mood and time.
- **Design language:** A painted element in a few wet strokes: tonal range from dense black to pale wash, dry-brush edges, generous empty paper around it; the brush order is part of the asset.
- **Production:** hybrid; Scanned ink painting (owner paints on paper; scanned 600 dpi) vectorised into stroke records: per stroke a centreline, width profile and wash mask; plus the flattened KTX2 R8 ink density map.
- **Dimensions:** Density map 2048 on the long side; stroke records in element space.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All papers; water register only for elements flagged water-safe. **Exclusions:** One painted element per frame (plus one small accent element); never behind the active line.
- **Quality bar:** Reads in under 12 strokes; distinct silhouette from other members; tonal range present; empty space at least 55% of the element zone; no seal, signature or poem text.

### INK-SIL-FIG Figures and creatures (16 sources)

- **Purpose:** A small human or animal presence; always small, always anonymous.
- **Design language:** A painted element in a few wet strokes: tonal range from dense black to pale wash, dry-brush edges, generous empty paper around it; the brush order is part of the asset.
- **Production:** hybrid; Scanned ink painting (owner paints on paper; scanned 600 dpi) vectorised into stroke records: per stroke a centreline, width profile and wash mask; plus the flattened KTX2 R8 ink density map.
- **Dimensions:** Density map 2048 on the long side; stroke records in element space.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All papers; water register only for elements flagged water-safe. **Exclusions:** One painted element per frame (plus one small accent element); never behind the active line.
- **Quality bar:** Reads in under 12 strokes; distinct silhouette from other members; tonal range present; empty space at least 55% of the element zone; no seal, signature or poem text.

### INK-PRP-OBJ Objects (18 sources)

- **Purpose:** Modern and everyday subjects in ink so the style is not tied to tradition.
- **Design language:** A painted element in a few wet strokes: tonal range from dense black to pale wash, dry-brush edges, generous empty paper around it; the brush order is part of the asset.
- **Production:** hybrid; Scanned ink painting (owner paints on paper; scanned 600 dpi) vectorised into stroke records: per stroke a centreline, width profile and wash mask; plus the flattened KTX2 R8 ink density map.
- **Dimensions:** Density map 2048 on the long side; stroke records in element space.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All papers; water register only for elements flagged water-safe. **Exclusions:** One painted element per frame (plus one small accent element); never behind the active line.
- **Quality bar:** Reads in under 12 strokes; distinct silhouette from other members; tonal range present; empty space at least 55% of the element zone; no seal, signature or poem text.

### INK-TEX-BRS Brush stroke library (20 sources)

- **Purpose:** Strokes for the heavy register, flicks and lettering accents.
- **Design language:** Brush gesture sampled from real strokes.
- **Production:** hybrid; Scanned stroke (600 dpi) vectorised to a centreline, width profile and dry-brush mask (KTX2 R8).
- **Dimensions:** Stroke records normalised to unit length.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All elements and lettering accents. **Exclusions:** Dry-brush only on dry papers.
- **Quality bar:** Width profile and dry end read as a real brush; differs from other strokes in shape or texture.

### INK-PRC-BRT Brush types (7 configurations)

- **Purpose:** Brush weight and character per section.
- **Design language:** Brush models that shape stroke width and texture.
- **Production:** authored-data; JSON parameters for the stroke renderer.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All strokes. **Exclusions:** Hake only for washes.
- **Quality bar:** Side-by-side distinct.

### INK-SRF-PAP Papers (10 sources)

- **Purpose:** The ground of the style.
- **Design language:** Photographed papers with fibre and tone.
- **Production:** photographed; KTX2 RGB 2048 tileable plus fibre normal map.
- **Dimensions:** 2048 tile.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All inks (white only on black). **Exclusions:** One paper per section.
- **Quality bar:** Tileable without seams; fibre visible at 1080p.

### INK-PAL-INC Ink colours (8 configurations)

- **Purpose:** Ink variety per identity.
- **Design language:** Ink density mappings.
- **Production:** authored-data; JSON ramps.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Papers. **Exclusions:** White only on black paper.
- **Quality bar:** Contrast targets met on each paper.

### INK-PRC-BLM Bloom and bleed (10 generators)

- **Purpose:** The ink feels wet and alive.
- **Design language:** Ink behaviour after landing: spread, bleed, back-runs, granulation, water clouds.
- **Production:** procedural-code; Shader configs using shared noise fields and flow-field sampler; baked bloom sequences for water.
- **Dimensions:** Screen.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Papers (spread varies by paper absorbency). **Exclusions:** No water clouds on paper.
- **Quality bar:** Reads as wet ink; deterministic in export.

### INK-MOT-WTR Water register sequences (6 configurations)

- **Purpose:** The water register.
- **Design language:** Baked ink-in-water bloom sequences, black on white or white on black.
- **Production:** procedural-code; Baked flow sequences (KTX2 array, 8 s loops) from the flow-field sampler.
- **Dimensions:** 1024.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Water register. **Exclusions:** Max once per song.
- **Quality bar:** No visible loop seam; type halo clean.

### INK-TYP-SRV Stroke reveal data (7 generators)

- **Purpose:** Brushed lettering (the core and the main risk).
- **Design language:** Distance-along-skeleton masks per glyph so type can be brushed.
- **Production:** procedural-code; Skeleton extraction from glyph outlines at build, per-font cache of reveal masks (R16).
- **Dimensions:** Glyph em.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Fonts with outlines (bundled and new dependencies). **Exclusions:** Scripts without reliable skeleton: generic wipe.
- **Quality bar:** Reveal follows a plausible stroke order for Latin; Devanagari and Tamil reviewed by native readers.
- **Gate:** Spike INK-G1: skeleton reveal on 4 scripts must look intentional and run under 6 ms per line; failure keeps only the generic wipe.

### INK-MOT-DYN Stroke dynamics profiles (6 configurations)

- **Purpose:** Brush feel per word duration and energy.
- **Design language:** Pressure and speed curves.
- **Production:** authored-data; JSON curves.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All strokes. **Exclusions:** n/a
- **Quality bar:** Reviewed side by side.

### INK-LAY-LAY Sheet layouts (8 configurations)

- **Purpose:** Composition variety within the emptiness rule.
- **Design language:** Element and column placements on the sheet.
- **Production:** authored-data; JSON.
- **Dimensions:** Normalised.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Compositions. **Exclusions:** Mirrors are parameters, not entries.
- **Quality bar:** 55% empty rule.

### INK-TRN-PTR Paper transitions (4 configurations)

- **Purpose:** Section changes.
- **Design language:** Sheet-level transitions.
- **Production:** authored-data; JSON.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All. **Exclusions:** n/a
- **Quality bar:** See transitions table.

## Shared assets this style depends on

- none
