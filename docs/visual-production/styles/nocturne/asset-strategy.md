# Nocturne: asset strategy

Style 7 of 15. Phase 2 planning (generated from planning data). Manifest status: **complete for Phase 2** (every planned asset is an entry; nothing in this style is a placeholder).

## Counts (kept separate by kind; variations and frames are never counted)

| Kind | Entries | Meaning |
|---|---|---|
| component | 7 | Reusable design component: a part that many scenes assemble (a widget, a balloon, a frame, a rule set) |
| composition | 17 | Composition or scene family: a rule set that arranges assets into a scene (not a rendered image) |
| configuration | 45 | Generator configuration or preset: an approved, tuned parameter set for a generator, choreography, camera or grade |
| source | 12 | Original source asset: a designed drawing, plate, texture, lettering set or kit made by hand or authored by a person |

Live entries: **81** (approved 81, revised 0, deferred 0). Rejected 1, merged 1 (kept in the manifest and the review register).

Production methods: authored-data 45, handcrafted-vector 12, shader 24. Priority: essential 36, high 42, medium 3. Complexity: M 17, S 64.

## Why this scale

Phase 1 estimated about 120 originals and flagged monotony as the risk. This plan approves about 100: Nocturne's value is restraint, and more assets would push it toward other styles. Monotony is handled by scene rotation at song halves and by the light moving rather than by adding elements.

## Families

### NOC-LGT-LIT Light sources (10 configurations)

- **Purpose:** The light is the style.
- **Design language:** Single practical lights with physical falloff.
- **Production:** shader; Config of a light-pool shader function (position, radius, falloff, colour source, breathing, flicker).
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Silhouettes and weather of the scene. **Exclusions:** One per scene.
- **Quality bar:** Reads as the named source in a still.

### NOC-ATM-WEA Weather and air layers (7 configurations)

- **Purpose:** Life in the dark without action.
- **Design language:** Slow atmospheric layers.
- **Production:** shader; Configs of shared generators (rain on glass, noise fields, fog).
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Scenes listed. **Exclusions:** One per scene.
- **Quality bar:** Never draws attention from text.

### NOC-ATM-BOK Bokeh arrangements (7 configurations)

- **Purpose:** Distance and place without detail.
- **Design language:** Out-of-focus light fields.
- **Production:** shader; Config of the shared bokeh generator.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Window and street scenes. **Exclusions:** Never in Candle or Lamp room.
- **Quality bar:** No recognisable signs or shapes.

### NOC-SIL-SIL Room and place silhouettes (12 sources)

- **Purpose:** Place the light in a space.
- **Design language:** Soft dark silhouettes at frame edges, slightly out of focus.
- **Production:** handcrafted-vector; SVG to alpha masks, blurred at runtime.
- **Dimensions:** Up to 1024 px.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Scenes listed. **Exclusions:** Max 2 per frame; edges only.
- **Quality bar:** Reads as the object at the edge; never competes with text.

### NOC-PAL-GRN Grain profiles (3 configurations)

- **Purpose:** Keeps darkness alive without texture.
- **Design language:** Whisper grain.
- **Production:** authored-data; Shared grain config.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All. **Exclusions:** Strength 0.02-0.04 only.
- **Quality bar:** Not visible as grain at arm's length.

### NOC-PAL-PAL Light palettes (7 configurations)

- **Purpose:** Song adaptation by temperature.
- **Design language:** Light and darkness pairs.
- **Production:** authored-data; JSON.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Lights. **Exclusions:** No saturated hues beyond 30% chroma.
- **Quality bar:** Text contrast 7:1.

### NOC-LAY-LAY Layouts (7 components)

- **Purpose:** Where text sits in the dark.
- **Design language:** Quiet layouts.
- **Production:** authored-data; JSON.
- **Dimensions:** Normalised.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Compositions. **Exclusions:** Text always inside the pool.
- **Quality bar:** Readable at all sizes.

### NOC-TYP-PAIR Type pairings (6 configurations)

- **Purpose:** Intimate type.
- **Design language:** Quiet type voices.
- **Production:** authored-data; JSON.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All. **Exclusions:** No display or heavy weights.
- **Quality bar:** Reviewed.

## Shared assets this style depends on

- none
