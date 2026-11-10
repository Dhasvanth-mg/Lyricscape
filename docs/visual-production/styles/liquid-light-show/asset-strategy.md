# Liquid Light Show: asset strategy

Style 8 of 15. Phase 2 planning (generated from planning data). Manifest status: **complete for Phase 2** (every planned asset is an entry; nothing in this style is a placeholder).

## Counts (kept separate by kind; variations and frames are never counted)

| Kind | Entries | Meaning |
|---|---|---|
| component | 6 | Reusable design component: a part that many scenes assemble (a widget, a balloon, a frame, a rule set) |
| composition | 15 | Composition or scene family: a rule set that arranges assets into a scene (not a rendered image) |
| configuration | 65 | Generator configuration or preset: an approved, tuned parameter set for a generator, choreography, camera or grade |
| source | 21 | Original source asset: a designed drawing, plate, texture, lettering set or kit made by hand or authored by a person |

Live entries: **107** (approved 107, revised 0, deferred 0). Rejected 4, merged 0 (kept in the manifest and the review register).

Production methods: authored-data 80, handcrafted-vector 11, procedural-code 16. Priority: high 55, essential 41, medium 11. Complexity: M 65, S 42.

## Why this scale

Phase 1 estimated about 140 originals. This plan approves about 110; the presets are the core (40, each tuned), with flow fields as baked source data. Adding presets beyond 4 per family would mostly add recolours.

## Families

### LLS-PRC-FLU Fluid presets (40 configurations)

- **Purpose:** Each preset is an instrument; fluid family named first.
- **Design language:** A tuned parameter set of the fluid shader: viscosity feel, blob scale, dye palette slots, flow-field mix, hand gesture set, layering; each preset is an instrument with its own character.
- **Production:** authored-data; JSON preset for the style's fluid shader (flow textures, advection steps, palette, edge sharpness, refraction).
- **Dimensions:** Rendered at 1/2 resolution (1/3 on low tier), upscaled.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Slides, dish masks, gestures. **Exclusions:** Two layers must not exceed the colour sum limit (no white-out: summed luminance capped at 0.85).
- **Quality bar:** Reads as physical liquid (oil, water or dye) in a still and in motion; distinct from every sibling preset in a side-by-side review; no white-out; slide contrast kept.

### LLS-TEX-FLW Baked flow fields (10 sources)

- **Purpose:** The hand's gestures as data, so the fluid is deterministic and cheap.
- **Design language:** Periodic 2D velocity fields baked offline from authored gesture simulations.
- **Production:** procedural-code; RG16F KTX2 512x512, periodic in time via two phase-offset fields.
- **Dimensions:** 512x512.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Fluid presets. **Exclusions:** n/a
- **Quality bar:** Seamless periodicity; plausible flow in review.

### LLS-MSK-DSH Dish masks (6 sources)

- **Purpose:** Shows the physical dish.
- **Design language:** Glass dish shapes with refractive rims.
- **Production:** handcrafted-vector; SVG plus a rim normal map (generated).
- **Dimensions:** 1024x1024.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Visible dish and double projection. **Exclusions:** One dish shape per song.
- **Quality bar:** Reads as glass.

### LLS-TYP-SLD Slide treatments (6 components)

- **Purpose:** Isolates the type from the fluid.
- **Design language:** Projected slide types.
- **Production:** procedural-code; Renderer modes.
- **Dimensions:** Frame.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All. **Exclusions:** Letter masks short lines only.
- **Quality bar:** Contrast rules met.

### LLS-PAL-PAL Dye palettes (12 configurations)

- **Purpose:** Colour per song.
- **Design language:** Transparent dye sets.
- **Production:** authored-data; JSON.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All presets. **Exclusions:** Max 4 dyes.
- **Quality bar:** No mud in review.

### LLS-OBJ-WHL Colour wheels (5 sources)

- **Purpose:** The rotating colour wheel of light shows.
- **Design language:** Segmented gel wheels.
- **Production:** handcrafted-vector; SVG segments.
- **Dimensions:** Vector.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Wheel composition. **Exclusions:** Not with reduced motion rotation.
- **Quality bar:** Reads as a wheel.

### LLS-MOT-MOT Hand gestures (8 configurations)

- **Purpose:** Motion with intention.
- **Design language:** Performer gestures as envelopes over flow fields.
- **Production:** authored-data; JSON envelopes.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All presets. **Exclusions:** Squeeze needs beat confidence 0.5.
- **Quality bar:** Each gesture readable as a hand action.

## Shared assets this style depends on

- none
