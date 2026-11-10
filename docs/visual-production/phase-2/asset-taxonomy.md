# Asset taxonomy, metadata schema and naming

Phase 2 planning. Every manifest in `styles/*/asset-manifest.json` follows this schema. The manifests are generated from planning data, and the generator checks them (see "Validation" below).

## 1. What counts as an asset

An asset is a designed thing that someone must make, tune or select on purpose and that can be reviewed on its own. Six **kinds** are kept apart and are never summed without their kind:

| Kind | Meaning | Example |
|---|---|---|
| source | An original source asset, designed by a person: a drawing, plate, texture, lettering set or kit | `INK-ENV-LND-004` River bend (painted element) |
| component | A reusable design component that many scenes assemble | `PAN-TYP-BAL-005` Thought cloud |
| generator | Code or a shader that draws a family of outputs from parameters | `PHO-GEO-CRV-001` Lissajous |
| configuration | An approved, tuned parameter set for a generator, choreography, camera or grade | `SIG-MOT-RHY-001` Bulb chase forward |
| composition | A rule set that arranges assets into a scene: composition families, scene families and transitions (never a rendered image) | `PAN-SCN-04` Action splash |
| dependency | A licensed dependency (typeface or data) that is selected and verified, not produced | `SHR-TYP-FNT-…` Comic Neue |

**Never counted:** recolours, palette swaps, mirrors, flips, crops, scales, animation frames, lit and unlit states of one object, the seed variations a generator produces, register treatments of one drawing (Panels), and runtime combinations. Each family records what it does not count in `variations_not_counted` where relevant.

## 2. Categories

Categories group assets by role. The ID carries the category.

| Group | Code | Meaning |
|---|---|---|
| Background | ENV | Illustrated or constructed environment (a place) |
| | PLT | Scene plate or painted ground |
| | SRF | Material surface: paper, card, glass, wall, desk |
| | ATM | Atmosphere: fog, rain, dust, haze, bokeh |
| | GRD | Gradient, light field or colour-field system |
| Foreground | OBJ | Illustrated object or figure |
| | SIL | Silhouette or cut-out piece |
| | GEO | Geometric element or shape choreography subject |
| | FRM | Frame, border, container, device, proscenium |
| | PRP | Prop, sticker, ornament, accent |
| | UIK | Fictional interface kit |
| | PTH | Vector path drawing (single-line figures, brush paths) |
| Typography | TYP | Type treatment, lettering set, stroke font, hardware type |
| | LAY | Layout template |
| | REV | Text reveal or word-emphasis effect |
| Motion | MOT | Choreography, behaviour profile, object loop |
| | CAM | Camera move |
| | TRN | Transition |
| | PRT | Particle or element system |
| Effects | TEX | Raster texture plate |
| | PRC | Procedural generator |
| | PAL | Palette, grade or stock profile |
| | LGT | Lighting rig |
| | MSK | Mask or matte |
| Composition | CMP | Composition family |
| | SCN | Scene family |

## 3. IDs and names

- Asset: `<STY>-<CAT>-<FAM>-<NNN>`, for example `SKC-OBJ-DRK-017`. `STY` is the style code, `FAM` the family code, `NNN` the member number inside the family (stable; numbers are never reused after a rejection).
- Composition family: `<STY>-CMP-C<n>`. Scene family: `<STY>-SCN-<NN>`. Transition: `<STY>-TRN-<id>`.
- Shared assets: `SHR-<CAT>-<FAM>-<NNN>`, counted once in `styles/_shared/asset-manifest.json` and listed by every style that uses them.
- Style codes: SCR Screenlife, GLY Glyph Cinema, PTR Paper Theatre, KON Konstrukt, CEL Celluloid, FOL Folio, NOC Nocturne, LLS Liquid Light Show, SKC Sketch Cards, SIG Signage, INK Ink, PAN Panels, PHO Phosphor, CVP Cover Pop, MON Monument, SHR Shared.
- File names in Phase 3 follow the ID: `assets/styles/<slug>/<ID>.<ext>` (for example `assets/styles/ink/INK-ENV-LND-004.ktx2`), with sidecar `<ID>.json` holding build metadata.

## 4. Metadata schema

Every entry has the 23 required fields plus the planning fields.

| Field | Type | Meaning |
|---|---|---|
| id | string | Unique ID as above |
| name | string | Human name, unique inside its family |
| style | string[] | Styles that use it (Shared entries list all users) |
| category | enum | Category code |
| kind | enum | Kind (section 1) |
| family | string | Family ID and name |
| description | string | Creative description: what it looks like |
| purpose | string | Artistic purpose: why it exists, what it adds |
| references | string | Visual references (method only) |
| production_method | enum | handcrafted-vector, handcrafted-raster, photographed, procedural-code, shader, programmatic-geometry, hybrid, licensed-font, authored-data |
| format | string | Technical format |
| dimensions | string | Dimensions or resolution rules |
| layer_structure | string | Layers and their order |
| animation | string | Animation behaviour |
| colour_behaviour | string | Colour behaviour |
| scene_compatibility | string or string[] | Scene families it can appear in |
| asset_compatibility | string | Assets it combines with |
| exclusion_rules | string | Where it must not appear |
| responsive_behaviour | string | Portrait, landscape, square, small screens |
| performance | string | Performance considerations (targets) |
| priority | enum | essential, high, medium, optional |
| complexity | enum | S (under 2 h), M (half a day), L (1-3 days), XL (more); a Phase 3 estimate |
| acceptance_criteria | string | What must be true to approve the finished asset |
| status | enum | approved, revised, deferred, merged, rejected (proposed and reviewed exist for Phase 3 additions) |
| origin | enum | new, existing-reuse, existing-rework, candidate |
| variations_not_counted | string | What variation this entry covers without extra entries |
| gate | string or null | Prototype gate that must pass first |
| review_reason, merged_into | string | For rejected and merged candidates |
| attributes | object | Scene families only: the structural attributes used by the similarity check |

## 5. Statuses

- **approved**: planned for production as specified.
- **revised**: an existing asset kept but reworked (for example the Sketch Cards doodles, the art library generators with a seed blocklist).
- **deferred**: specified, but waits for a gate (Monument, Ink stroke reveal, Phosphor stroke fonts). Deferred entries are live: they count, and they sit in a gated batch.
- **merged**: a candidate folded into another entry (`merged_into` names it). Not counted.
- **rejected**: a candidate refused with a reason. Not counted. Rejected and merged entries stay in the manifest and the review register.

## 6. Validation the generator runs

`gen.py` stops with an error if any of these fail:

1. IDs and names are unique.
2. Every field is present and every enum value is valid.
3. Member descriptions inside a family are not near-duplicates (token Jaccard similarity of 0.7 or more is an error).
4. Every family is used by at least one scene family or declared global to the style.
5. Every live asset is in exactly one production batch.
6. Per-style counts add up to the master total.

It also reports scene-family pairs that differ in fewer than 3 of their structural attributes. The one remaining pair is explained in `reviews/visual-differentiation.md`.
