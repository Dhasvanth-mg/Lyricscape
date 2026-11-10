# Celluloid: asset strategy

Style 5 of 15. Phase 2 planning (generated from planning data). Manifest status: **complete for Phase 2** (every planned asset is an entry; nothing in this style is a placeholder).

## Counts (kept separate by kind; variations and frames are never counted)

| Kind | Entries | Meaning |
|---|---|---|
| component | 12 | Reusable design component: a part that many scenes assemble (a widget, a balloon, a frame, a rule set) |
| composition | 18 | Composition or scene family: a rule set that arranges assets into a scene (not a rendered image) |
| configuration | 35 | Generator configuration or preset: an approved, tuned parameter set for a generator, choreography, camera or grade |
| source | 55 | Original source asset: a designed drawing, plate, texture, lettering set or kit made by hand or authored by a person |

Live entries: **120** (approved 120, revised 0, deferred 0). Rejected 1, merged 0 (kept in the manifest and the review register).

Production methods: authored-data 59, handcrafted-raster 8, handcrafted-vector 10, hybrid 5, photographed 27, procedural-code 11. Priority: high 55, essential 41, medium 24. Complexity: M 82, S 38.

## Why this scale

Phase 1 estimated about 250 originals. This plan approves about 130: film damage is best served by fewer, excellent plates and well-tuned stocks; the style's variety is the stock x register x composition matrix. More plates can be shot later without changing the system.

## Families

### CEL-TEX-PLT Film damage plates (19 sources)

- **Purpose:** Physical texture of film, the style's richness.
- **Design language:** Real film damage captured or authored at film scale.
- **Production:** photographed; Greyscale or RGB plates as KTX2 (BC4/BC7, ETC2 fallback) or WebP; animated plates as a short sprite strip (frames counted as one asset).
- **Dimensions:** 2048x1152 base (16:9), animated strips 1024x576 x 24 frames.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Stocks that list it; title registers. **Exclusions:** Never two plates of the same kind at once; dust and hair never over the subtitle box at more than 20% opacity.
- **Quality bar:** Reads as physical film damage, not a filter; no visible loop seam; no identifiable source footage; flash rule respected for any bright plate.

### CEL-TEX-LEK Light leaks (8 sources)

- **Purpose:** Warmth and section punctuation.
- **Design language:** Soft coloured light entering from the frame edges, captured with a phone or a camera through coloured gels (owner shoots), or authored as gradients.
- **Production:** photographed; Greyscale or RGB plates as KTX2 (BC4/BC7, ETC2 fallback) or WebP; animated plates as a short sprite strip (frames counted as one asset).
- **Dimensions:** 1024x576 animated strips (12-24 frames) or static.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Stocks that list it; title registers. **Exclusions:** Never two plates of the same kind at once; dust and hair never over the subtitle box at more than 20% opacity.
- **Quality bar:** Reads as physical film damage, not a filter; no visible loop seam; no identifiable source footage; flash rule respected for any bright plate.

### CEL-TEX-TAP Tape plates (5 sources)

- **Purpose:** The tape stock's texture (replaces Retro VHS).
- **Design language:** Magnetic tape artefacts.
- **Production:** procedural-code; Procedural generator configuration plus small baked noise strips (PNG).
- **Dimensions:** 1024x576 strips.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Stocks that list it; title registers. **Exclusions:** Never two plates of the same kind at once; dust and hair never over the subtitle box at more than 20% opacity.
- **Quality bar:** Reads as physical film damage, not a filter; no visible loop seam; no identifiable source footage; flash rule respected for any bright plate.

### CEL-PAL-STK Stock profiles (8 configurations)

- **Purpose:** Each section is a stock: the main variation axis.
- **Design language:** Complete film stock emulations as post parameter sets (grade curves, grain size, halation, flicker, frame rate).
- **Production:** authored-data; JSON post uniform preset plus a 33^3 LUT (PNG strip) per stock.
- **Dimensions:** LUT 33^3.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Plates listed per stock. **Exclusions:** See grammar.
- **Quality bar:** Recognisable as distinct stocks in a side-by-side still review; titles keep contrast.

### CEL-PAL-GRD Grades (6 configurations)

- **Purpose:** Song adaptation without leaving the stock's character.
- **Design language:** Cover-aware tints within each stock.
- **Production:** authored-data; JSON tint and split-tone rules.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Stocks. **Exclusions:** No grade on lith beyond its single tint.
- **Quality bar:** Stock still recognisable after grading.

### CEL-MOT-GAT Gate and projector behaviours (8 configurations)

- **Purpose:** Film physics.
- **Design language:** Mechanical film transport behaviours.
- **Production:** authored-data; JSON.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All stocks. **Exclusions:** Off in reduced motion (weave, flicker).
- **Quality bar:** Weave subtle enough not to disturb reading (review at 390x844).

### CEL-LAY-TTL Title layouts (12 components)

- **Purpose:** Readable title placement per register.
- **Design language:** Cinema title conventions.
- **Production:** authored-data; JSON layout.
- **Dimensions:** Relative to the image area.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Registers. **Exclusions:** Subtitle box not under heavy damage.
- **Quality bar:** Cinema subtitle rules; centred cards optically balanced.

### CEL-TYP-REG Title registers (6 configurations)

- **Purpose:** The lyric's voice in film.
- **Design language:** Typographic treatments.
- **Production:** procedural-code; Renderer modes.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Layouts. **Exclusions:** Burst needs authored words; scratched hand Latin only.
- **Quality bar:** Distinct voices in review.

### CEL-OBJ-CNT Countdown designs (5 sources)

- **Purpose:** Intros and breaks with a cinematic ritual fitted to the song's timing.
- **Design language:** Original countdown leaders: geometric, not copies of real studio leaders.
- **Production:** handcrafted-vector; SVG parts animated by code.
- **Dimensions:** Vector.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Leader plates. **Exclusions:** No real leader markings or studio names.
- **Quality bar:** Original (reviewed against common real leaders); ends exactly on the first line lead-in.

### CEL-FRM-BRD Intertitle borders (5 sources)

- **Purpose:** The silent intertitle scene.
- **Design language:** Original decorative borders for intertitle cards.
- **Production:** handcrafted-vector; SVG.
- **Dimensions:** Vector, 4:3 and 4:5 layouts.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Intertitle layout. **Exclusions:** Not copied from real films.
- **Quality bar:** Original and legible.

### CEL-PTH-SCR Scratch animation loops (8 sources)

- **Purpose:** Companions for scratched words; the handmade film energy.
- **Design language:** Hand-scratched doodles drawn frame by frame (12 fps), white on black.
- **Production:** handcrafted-raster; Sprite strips (frames belong to one asset).
- **Dimensions:** 512x512 x 6-12 frames.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Scratch register. **Exclusions:** Max 2 loops at once.
- **Quality bar:** Boiling line quality consistent; reads as hand-scratched.

### CEL-ENV-PRJ Projection room assets (5 sources)

- **Purpose:** The projection room composition.
- **Design language:** A dark room in silhouette with a beam.
- **Production:** hybrid; SVG silhouettes plus procedural beam haze.
- **Dimensions:** 2048x1152.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All stocks. **Exclusions:** No recognisable cinema interiors.
- **Quality bar:** Reads as a room in 1 s; text legible in the projected rect.

## Shared assets this style depends on

- none
