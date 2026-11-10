# Shared: asset strategy

Style 0 of 15. Phase 2 planning (generated from planning data). Manifest status: **complete for Phase 2** (every planned asset is an entry; nothing in this style is a placeholder).

## Counts (kept separate by kind; variations and frames are never counted)

| Kind | Entries | Meaning |
|---|---|---|
| dependency | 35 | Licensed dependency: an open-licence typeface or data set that is selected and verified, not produced |
| generator | 16 | Procedural generator: code or shader that draws a family of outputs from parameters |
| source | 6 | Original source asset: a designed drawing, plate, texture, lettering set or kit made by hand or authored by a person |

Live entries: **57** (approved 51, revised 6, deferred 0). Rejected 3, merged 0 (kept in the manifest and the review register).

Production methods: licensed-font 35, procedural-code 6, shader 16. Priority: essential 57. Complexity: L 16, S 41.

## Why this scale

The count is what the scene families need, not a target. See the review register for what was cut.

## Families

### SHR-PRC-GEN Shared procedural generators (16 generators)

- **Purpose:** One tested implementation instead of one per style; each style owns only its configurations.
- **Design language:** Deterministic code or shader functions of (seed, t, parameters); each produces a family of outputs that several styles configure differently.
- **Production:** shader; GLSL ES 3.0 fragment function in the scene host (GPU tier) plus a Canvas 2D or CPU equivalent where the style has a Clean tier.
- **Dimensions:** Resolution independent; evaluated at the render target or a reduced buffer as stated per member.
- **Variation dimensions inside the family:** Every output of a generator is a variation, not an asset; only approved configurations (listed in each style) are counted.
- **Compatibility:** See each style's grammar. **Exclusions:** None globally; styles exclude per grammar.
- **Quality bar:** Same output for the same inputs on two GPUs within 1/255 per channel on golden frames; no Math.random or Date.now; documented parameter ranges.

### SHR-TEX-NOI Shared noise and utility textures (6 sources)

- **Purpose:** Inputs to the shared generators (cheaper than computing noise per pixel).
- **Design language:** Small technical textures with no visible imagery.
- **Production:** procedural-code; PNG generated at build from a seeded script; uploaded as R8 or RGBA8.
- **Dimensions:** Members state their size; all tileable.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Generators above. **Exclusions:** None.
- **Quality bar:** Tileable without seams; spectrum check for blue noise; byte-identical rebuild from the seed.

### SHR-TYP-FNT Typefaces (open licence) (35 dependencys)

- **Purpose:** Script coverage and each style's voice; listed so the font payload and licences are planned (V14).
- **Design language:** Open-licence fonts selected per style; not produced, only verified.
- **Production:** licensed-font; WOFF2 via @fontsource packages (existing pattern in app/layout.tsx); subset per script where the package allows.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** typography-system.md fallback stacks. **Exclusions:** Only fonts with OFL, Apache 2.0, public domain or an equally permissive licence; licence file kept with the build.
- **Quality bar:** Licence verified and recorded; covers the scripts claimed (checked with a coverage script); renders the test strings of typography-system.md without tofu.

## Shared assets this style depends on

Not applicable: this is the shared library. Each style lists the shared entries it uses in its own strategy file.
