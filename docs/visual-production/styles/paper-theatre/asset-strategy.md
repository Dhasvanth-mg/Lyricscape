# Paper Theatre: asset strategy

Style 3 of 15. Phase 2 planning (generated from planning data). Manifest status: **complete for Phase 2** (every planned asset is an entry; nothing in this style is a placeholder).

## Counts (kept separate by kind; variations and frames are never counted)

| Kind | Entries | Meaning |
|---|---|---|
| component | 7 | Reusable design component: a part that many scenes assemble (a widget, a balloon, a frame, a rule set) |
| composition | 20 | Composition or scene family: a rule set that arranges assets into a scene (not a rendered image) |
| configuration | 33 | Generator configuration or preset: an approved, tuned parameter set for a generator, choreography, camera or grade |
| source | 181 | Original source asset: a designed drawing, plate, texture, lettering set or kit made by hand or authored by a person |

Live entries: **241** (approved 241, revised 0, deferred 0). Rejected 9, merged 0 (kept in the manifest and the review register).

Production methods: authored-data 53, handcrafted-vector 173, photographed 8, procedural-code 7. Priority: essential 115, high 67, medium 59. Complexity: L 24, M 174, S 43.

## Why this scale

Phase 1 estimated 500-700 originals; this plan approves about 250, because Phase 1 counted arrangements and recolours. Variety comes from 13 worlds x 7 compositions x lighting, with every piece a distinct cut. If the first two sets prove that pieces recombine well, Phase 3 can add sets (each about 10-14 pieces) without changing the system.

## Families

### PTR-SIL-CTY City pieces (14 sources)

- **Purpose:** Builds the city pieces so the stage has a believable world with 4-7 depth layers.
- **Design language:** Cut black card (or the set's paper) with a consistent cut quality: clean scalpel edges, small deliberate nicks, no outlines, detail level "readable at 10% of frame height"; every piece declares its depth layer and its pivot points if hinged.
- **Production:** handcrafted-vector; SVG source (single filled path per part, no strokes) rasterised at build to an alpha mask atlas; JSON with depth layer, anchor, pivots and footprint.
- **Dimensions:** Authored in a 2048-unit square artboard; masks exported at the size the piece occupies at its largest planned scale (512-2048 px wide).
- **Variation dimensions inside the family:** Paper colour and light colour are parameters; mirrored use is allowed and not counted.
- **Compatibility:** Other pieces of the same set; figures; frames; props of the same season. **Exclusions:** Never two sets in one stage (except the panorama, which joins neighbouring sets at a declared seam piece); no piece larger than 40% of the frame except near-frame pieces.
- **Quality bar:** Reads as cut paper (not vector clip-art); silhouette readable at 10% frame height; no recognisable real landmark or character; consistent edge quality with the family's approved first piece.

### PTR-SIL-HRB Harbour and sea pieces (12 sources)

- **Purpose:** Builds the harbour and sea pieces so the stage has a believable world with 4-7 depth layers.
- **Design language:** Cut black card (or the set's paper) with a consistent cut quality: clean scalpel edges, small deliberate nicks, no outlines, detail level "readable at 10% of frame height"; every piece declares its depth layer and its pivot points if hinged.
- **Production:** handcrafted-vector; SVG source (single filled path per part, no strokes) rasterised at build to an alpha mask atlas; JSON with depth layer, anchor, pivots and footprint.
- **Dimensions:** Authored in a 2048-unit square artboard; masks exported at the size the piece occupies at its largest planned scale (512-2048 px wide).
- **Variation dimensions inside the family:** Paper colour and light colour are parameters; mirrored use is allowed and not counted.
- **Compatibility:** Other pieces of the same set; figures; frames; props of the same season. **Exclusions:** Never two sets in one stage (except the panorama, which joins neighbouring sets at a declared seam piece); no piece larger than 40% of the frame except near-frame pieces.
- **Quality bar:** Reads as cut paper (not vector clip-art); silhouette readable at 10% frame height; no recognisable real landmark or character; consistent edge quality with the family's approved first piece.

### PTR-SIL-FOR Forest pieces (12 sources)

- **Purpose:** Builds the forest pieces so the stage has a believable world with 4-7 depth layers.
- **Design language:** Cut black card (or the set's paper) with a consistent cut quality: clean scalpel edges, small deliberate nicks, no outlines, detail level "readable at 10% of frame height"; every piece declares its depth layer and its pivot points if hinged.
- **Production:** handcrafted-vector; SVG source (single filled path per part, no strokes) rasterised at build to an alpha mask atlas; JSON with depth layer, anchor, pivots and footprint.
- **Dimensions:** Authored in a 2048-unit square artboard; masks exported at the size the piece occupies at its largest planned scale (512-2048 px wide).
- **Variation dimensions inside the family:** Paper colour and light colour are parameters; mirrored use is allowed and not counted.
- **Compatibility:** Other pieces of the same set; figures; frames; props of the same season. **Exclusions:** Never two sets in one stage (except the panorama, which joins neighbouring sets at a declared seam piece); no piece larger than 40% of the frame except near-frame pieces.
- **Quality bar:** Reads as cut paper (not vector clip-art); silhouette readable at 10% frame height; no recognisable real landmark or character; consistent edge quality with the family's approved first piece.

### PTR-SIL-DES Desert pieces (10 sources)

- **Purpose:** Builds the desert pieces so the stage has a believable world with 4-7 depth layers.
- **Design language:** Cut black card (or the set's paper) with a consistent cut quality: clean scalpel edges, small deliberate nicks, no outlines, detail level "readable at 10% of frame height"; every piece declares its depth layer and its pivot points if hinged.
- **Production:** handcrafted-vector; SVG source (single filled path per part, no strokes) rasterised at build to an alpha mask atlas; JSON with depth layer, anchor, pivots and footprint.
- **Dimensions:** Authored in a 2048-unit square artboard; masks exported at the size the piece occupies at its largest planned scale (512-2048 px wide).
- **Variation dimensions inside the family:** Paper colour and light colour are parameters; mirrored use is allowed and not counted.
- **Compatibility:** Other pieces of the same set; figures; frames; props of the same season. **Exclusions:** Never two sets in one stage (except the panorama, which joins neighbouring sets at a declared seam piece); no piece larger than 40% of the frame except near-frame pieces.
- **Quality bar:** Reads as cut paper (not vector clip-art); silhouette readable at 10% frame height; no recognisable real landmark or character; consistent edge quality with the family's approved first piece.

### PTR-SIL-MTN Mountain pieces (10 sources)

- **Purpose:** Builds the mountain pieces so the stage has a believable world with 4-7 depth layers.
- **Design language:** Cut black card (or the set's paper) with a consistent cut quality: clean scalpel edges, small deliberate nicks, no outlines, detail level "readable at 10% of frame height"; every piece declares its depth layer and its pivot points if hinged.
- **Production:** handcrafted-vector; SVG source (single filled path per part, no strokes) rasterised at build to an alpha mask atlas; JSON with depth layer, anchor, pivots and footprint.
- **Dimensions:** Authored in a 2048-unit square artboard; masks exported at the size the piece occupies at its largest planned scale (512-2048 px wide).
- **Variation dimensions inside the family:** Paper colour and light colour are parameters; mirrored use is allowed and not counted.
- **Compatibility:** Other pieces of the same set; figures; frames; props of the same season. **Exclusions:** Never two sets in one stage (except the panorama, which joins neighbouring sets at a declared seam piece); no piece larger than 40% of the frame except near-frame pieces.
- **Quality bar:** Reads as cut paper (not vector clip-art); silhouette readable at 10% frame height; no recognisable real landmark or character; consistent edge quality with the family's approved first piece.

### PTR-SIL-ROM Room pieces (12 sources)

- **Purpose:** Builds the room pieces so the stage has a believable world with 4-7 depth layers.
- **Design language:** Cut black card (or the set's paper) with a consistent cut quality: clean scalpel edges, small deliberate nicks, no outlines, detail level "readable at 10% of frame height"; every piece declares its depth layer and its pivot points if hinged.
- **Production:** handcrafted-vector; SVG source (single filled path per part, no strokes) rasterised at build to an alpha mask atlas; JSON with depth layer, anchor, pivots and footprint.
- **Dimensions:** Authored in a 2048-unit square artboard; masks exported at the size the piece occupies at its largest planned scale (512-2048 px wide).
- **Variation dimensions inside the family:** Paper colour and light colour are parameters; mirrored use is allowed and not counted.
- **Compatibility:** Other pieces of the same set; figures; frames; props of the same season. **Exclusions:** Never two sets in one stage (except the panorama, which joins neighbouring sets at a declared seam piece); no piece larger than 40% of the frame except near-frame pieces.
- **Quality bar:** Reads as cut paper (not vector clip-art); silhouette readable at 10% frame height; no recognisable real landmark or character; consistent edge quality with the family's approved first piece.

### PTR-SIL-SKY Sky pieces (10 sources)

- **Purpose:** Builds the sky pieces so the stage has a believable world with 4-7 depth layers.
- **Design language:** Cut black card (or the set's paper) with a consistent cut quality: clean scalpel edges, small deliberate nicks, no outlines, detail level "readable at 10% of frame height"; every piece declares its depth layer and its pivot points if hinged.
- **Production:** handcrafted-vector; SVG source (single filled path per part, no strokes) rasterised at build to an alpha mask atlas; JSON with depth layer, anchor, pivots and footprint.
- **Dimensions:** Authored in a 2048-unit square artboard; masks exported at the size the piece occupies at its largest planned scale (512-2048 px wide).
- **Variation dimensions inside the family:** Paper colour and light colour are parameters; mirrored use is allowed and not counted.
- **Compatibility:** Other pieces of the same set; figures; frames; props of the same season. **Exclusions:** Never two sets in one stage (except the panorama, which joins neighbouring sets at a declared seam piece); no piece larger than 40% of the frame except near-frame pieces.
- **Quality bar:** Reads as cut paper (not vector clip-art); silhouette readable at 10% frame height; no recognisable real landmark or character; consistent edge quality with the family's approved first piece.

### PTR-SIL-FAR Fairground pieces (10 sources)

- **Purpose:** Builds the fairground pieces so the stage has a believable world with 4-7 depth layers.
- **Design language:** Cut black card (or the set's paper) with a consistent cut quality: clean scalpel edges, small deliberate nicks, no outlines, detail level "readable at 10% of frame height"; every piece declares its depth layer and its pivot points if hinged.
- **Production:** handcrafted-vector; SVG source (single filled path per part, no strokes) rasterised at build to an alpha mask atlas; JSON with depth layer, anchor, pivots and footprint.
- **Dimensions:** Authored in a 2048-unit square artboard; masks exported at the size the piece occupies at its largest planned scale (512-2048 px wide).
- **Variation dimensions inside the family:** Paper colour and light colour are parameters; mirrored use is allowed and not counted.
- **Compatibility:** Other pieces of the same set; figures; frames; props of the same season. **Exclusions:** Never two sets in one stage (except the panorama, which joins neighbouring sets at a declared seam piece); no piece larger than 40% of the frame except near-frame pieces.
- **Quality bar:** Reads as cut paper (not vector clip-art); silhouette readable at 10% frame height; no recognisable real landmark or character; consistent edge quality with the family's approved first piece.

### PTR-SIL-GAR Garden pieces (10 sources)

- **Purpose:** Builds the garden pieces so the stage has a believable world with 4-7 depth layers.
- **Design language:** Cut black card (or the set's paper) with a consistent cut quality: clean scalpel edges, small deliberate nicks, no outlines, detail level "readable at 10% of frame height"; every piece declares its depth layer and its pivot points if hinged.
- **Production:** handcrafted-vector; SVG source (single filled path per part, no strokes) rasterised at build to an alpha mask atlas; JSON with depth layer, anchor, pivots and footprint.
- **Dimensions:** Authored in a 2048-unit square artboard; masks exported at the size the piece occupies at its largest planned scale (512-2048 px wide).
- **Variation dimensions inside the family:** Paper colour and light colour are parameters; mirrored use is allowed and not counted.
- **Compatibility:** Other pieces of the same set; figures; frames; props of the same season. **Exclusions:** Never two sets in one stage (except the panorama, which joins neighbouring sets at a declared seam piece); no piece larger than 40% of the frame except near-frame pieces.
- **Quality bar:** Reads as cut paper (not vector clip-art); silhouette readable at 10% frame height; no recognisable real landmark or character; consistent edge quality with the family's approved first piece.

### PTR-SIL-TRV Railway panorama pieces (7 sources)

- **Purpose:** Builds the railway panorama pieces so the stage has a believable world with 4-7 depth layers.
- **Design language:** Cut black card (or the set's paper) with a consistent cut quality: clean scalpel edges, small deliberate nicks, no outlines, detail level "readable at 10% of frame height"; every piece declares its depth layer and its pivot points if hinged.
- **Production:** handcrafted-vector; SVG source (single filled path per part, no strokes) rasterised at build to an alpha mask atlas; JSON with depth layer, anchor, pivots and footprint.
- **Dimensions:** Authored in a 2048-unit square artboard; masks exported at the size the piece occupies at its largest planned scale (512-2048 px wide).
- **Variation dimensions inside the family:** Paper colour and light colour are parameters; mirrored use is allowed and not counted.
- **Compatibility:** Other pieces of the same set; figures; frames; props of the same season. **Exclusions:** Never two sets in one stage (except the panorama, which joins neighbouring sets at a declared seam piece); no piece larger than 40% of the frame except near-frame pieces.
- **Quality bar:** Reads as cut paper (not vector clip-art); silhouette readable at 10% frame height; no recognisable real landmark or character; consistent edge quality with the family's approved first piece.

### PTR-SIL-SNW Snow village pieces (8 sources)

- **Purpose:** Builds the snow village pieces so the stage has a believable world with 4-7 depth layers.
- **Design language:** Cut black card (or the set's paper) with a consistent cut quality: clean scalpel edges, small deliberate nicks, no outlines, detail level "readable at 10% of frame height"; every piece declares its depth layer and its pivot points if hinged.
- **Production:** handcrafted-vector; SVG source (single filled path per part, no strokes) rasterised at build to an alpha mask atlas; JSON with depth layer, anchor, pivots and footprint.
- **Dimensions:** Authored in a 2048-unit square artboard; masks exported at the size the piece occupies at its largest planned scale (512-2048 px wide).
- **Variation dimensions inside the family:** Paper colour and light colour are parameters; mirrored use is allowed and not counted.
- **Compatibility:** Other pieces of the same set; figures; frames; props of the same season. **Exclusions:** Never two sets in one stage (except the panorama, which joins neighbouring sets at a declared seam piece); no piece larger than 40% of the frame except near-frame pieces.
- **Quality bar:** Reads as cut paper (not vector clip-art); silhouette readable at 10% frame height; no recognisable real landmark or character; consistent edge quality with the family's approved first piece.

### PTR-SIL-RDS Night road pieces (6 sources)

- **Purpose:** Builds the night road pieces so the stage has a believable world with 4-7 depth layers.
- **Design language:** Cut black card (or the set's paper) with a consistent cut quality: clean scalpel edges, small deliberate nicks, no outlines, detail level "readable at 10% of frame height"; every piece declares its depth layer and its pivot points if hinged.
- **Production:** handcrafted-vector; SVG source (single filled path per part, no strokes) rasterised at build to an alpha mask atlas; JSON with depth layer, anchor, pivots and footprint.
- **Dimensions:** Authored in a 2048-unit square artboard; masks exported at the size the piece occupies at its largest planned scale (512-2048 px wide).
- **Variation dimensions inside the family:** Paper colour and light colour are parameters; mirrored use is allowed and not counted.
- **Compatibility:** Other pieces of the same set; figures; frames; props of the same season. **Exclusions:** Never two sets in one stage (except the panorama, which joins neighbouring sets at a declared seam piece); no piece larger than 40% of the frame except near-frame pieces.
- **Quality bar:** Reads as cut paper (not vector clip-art); silhouette readable at 10% frame height; no recognisable real landmark or character; consistent edge quality with the family's approved first piece.

### PTR-SIL-DEP Sea depth pieces (8 sources)

- **Purpose:** Builds the sea depth pieces so the stage has a believable world with 4-7 depth layers.
- **Design language:** Cut black card (or the set's paper) with a consistent cut quality: clean scalpel edges, small deliberate nicks, no outlines, detail level "readable at 10% of frame height"; every piece declares its depth layer and its pivot points if hinged.
- **Production:** handcrafted-vector; SVG source (single filled path per part, no strokes) rasterised at build to an alpha mask atlas; JSON with depth layer, anchor, pivots and footprint.
- **Dimensions:** Authored in a 2048-unit square artboard; masks exported at the size the piece occupies at its largest planned scale (512-2048 px wide).
- **Variation dimensions inside the family:** Paper colour and light colour are parameters; mirrored use is allowed and not counted.
- **Compatibility:** Other pieces of the same set; figures; frames; props of the same season. **Exclusions:** Never two sets in one stage (except the panorama, which joins neighbouring sets at a declared seam piece); no piece larger than 40% of the frame except near-frame pieces.
- **Quality bar:** Reads as cut paper (not vector clip-art); silhouette readable at 10% frame height; no recognisable real landmark or character; consistent edge quality with the family's approved first piece.

### PTR-OBJ-FIG Hinged figures and animals (24 sources)

- **Purpose:** Gives the stage life and narrative; moves on lines and beats.
- **Design language:** Anonymous silhouettes with 2-6 pivot points; proportions slightly stylised (large heads not allowed: adult proportions), no faces or identifiable people.
- **Production:** handcrafted-vector; SVG parts with pivots in JSON (parent-child hierarchy).
- **Dimensions:** Authored at 1024 units tall; masks up to 1024 px.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Rails and choreographies. **Exclusions:** Max 4 on stage; never a figure larger than 25% of height except C6.
- **Quality bar:** Joints read correctly in motion; anonymous; consistent cut quality.

### PTR-FRM-FRM Frames (10 sources)

- **Purpose:** Defines the composition family and the safe opening.
- **Design language:** Frames cut from card with the same edge quality; front-lit slightly (they are nearest the viewer).
- **Production:** handcrafted-vector; SVG with opening rect metadata.
- **Dimensions:** Authored at 16:9 and 9:16 variants (one asset with two layouts).
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All sets. **Exclusions:** One frame per stage.
- **Quality bar:** Opening rect exact; reads in a thumbnail; layouts for both aspects designed.

### PTR-SRF-PAP Paper surfaces (8 sources)

- **Purpose:** Material identity of the stage.
- **Design language:** Photographed real papers under even light.
- **Production:** photographed; KTX2 or JPEG RGB 1024x1024 tileable plus a fibre height map.
- **Dimensions:** 1024x1024 tileable.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All sets. **Exclusions:** Kraft and black card never on the same layer.
- **Quality bar:** No visible tiling; edges consistent with the cut quality.

### PTR-LGT-LGT Light rigs (10 configurations)

- **Purpose:** Light is the colour of the style and its section marker.
- **Design language:** Backlight gradients with a glow centre, hue and animation.
- **Production:** authored-data; JSON: glow centre, radius, hue source, lightness ramp, animation.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All sets. **Exclusions:** Gel cycle only fairground and high energy.
- **Quality bar:** Lyric region keeps contrast during every animation.

### PTR-TYP-TYP Lyric treatments (7 components)

- **Purpose:** How words exist in a paper world.
- **Design language:** The three type treatments of the style.
- **Production:** procedural-code; Renderer modes with parameters.
- **Dimensions:** Relative to stage.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All compositions. **Exclusions:** Cut letters only for lines of 3 words or fewer (Latin) or one word (complex scripts, per width rule).
- **Quality bar:** Legibility at all sizes; cut letters look cut (sharp, slight nicks).

### PTR-MOT-MOT Choreographies (11 configurations)

- **Purpose:** Consistent puppetry vocabulary.
- **Design language:** Rigid-piece motion patterns.
- **Production:** authored-data; JSON: path type, pivot curves, timing.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Figures and pieces with pivots or rails. **Exclusions:** No choreography crosses the lyric box during a reveal.
- **Quality bar:** Weight and wobble feel physical in review; no stretching.

### PTR-CAM-CAM Camera moves (5 configurations)

- **Purpose:** Parallax depth and scale changes.
- **Design language:** Gentle stage camera.
- **Production:** authored-data; JSON.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All. **Exclusions:** No track in C6.
- **Quality bar:** Lyric stays in safe area.

### PTR-PRP-PRP Props and large pieces (10 sources)

- **Purpose:** Season and atmosphere, and the large pieces for close-up cuts.
- **Design language:** Same cut language; props hang on strings or sticks.
- **Production:** handcrafted-vector; SVG masks.
- **Dimensions:** As pieces.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Seasonal matching (snow with winter sets only). **Exclusions:** Max 2 prop kinds per stage.
- **Quality bar:** Consistent cut; reads at small size.

## Shared assets this style depends on

12 shared entries (counted once in the shared manifest, not in this style's total):

- `SHR-PRC-GEN-001` Film grain (generator)
- `SHR-PRC-GEN-004` Paper fibre and tooth (generator)
- `SHR-PRC-GEN-009` Seeded noise fields (generator)
- `SHR-PRC-GEN-012` Depth fog and haze (generator)
- `SHR-TYP-FNT-010` DM Serif Display (dependency)
- `SHR-TYP-FNT-011` Special Elite (dependency)
- `SHR-TYP-FNT-016` Noto Sans Devanagari Variable (dependency)
- `SHR-TYP-FNT-017` Noto Sans Tamil Variable (dependency)
- `SHR-TYP-FNT-018` Noto Serif Devanagari (dependency)
- `SHR-TYP-FNT-019` Noto Serif Tamil (dependency)
- `SHR-TYP-FNT-021` Noto Naskh Arabic (dependency)
- `SHR-TYP-FNT-023` Frank Ruhl Libre (dependency)
