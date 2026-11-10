# Phosphor: asset strategy

Style 13 of 15. Phase 2 planning (generated from planning data). Manifest status: **complete for Phase 2** (every planned asset is an entry; nothing in this style is a placeholder).

## Counts (kept separate by kind; variations and frames are never counted)

| Kind | Entries | Meaning |
|---|---|---|
| composition | 15 | Composition or scene family: a rule set that arranges assets into a scene (not a rendered image) |
| configuration | 46 | Generator configuration or preset: an approved, tuned parameter set for a generator, choreography, camera or grade |
| generator | 12 | Procedural generator: code or shader that draws a family of outputs from parameters |
| source | 58 | Original source asset: a designed drawing, plate, texture, lettering set or kit made by hand or authored by a person |

Live entries: **131** (approved 122, revised 0, deferred 9). Rejected 6, merged 1 (kept in the manifest and the review register).

Production methods: authored-data 61, handcrafted-vector 50, hybrid 8, procedural-code 12. Priority: high 85, essential 32, medium 14. Complexity: M 42, S 89.

## Why this scale

Phase 1 estimated about 160 assets. Phase 2 approves 131 live entries. This is a narrow medium by design: its variety comes from 12 curve generators and 50 single-line figures. The stroke-font family is deferred behind the PHO-G1 licence and readability gate.

## Families

### PHO-PTH-PTH Single-line figures (50 sources)

- **Purpose:** Figures the beam draws between words, picked from the lexicon.
- **Design language:** A single continuous line drawing (one path, no lifts, or lifts marked as visible beam jumps) that a beam can trace in 0.6-2 s; simple enough to read as glowing line, clear silhouette.
- **Production:** handcrafted-vector; Single SVG path (centreline), resampled to 512-2048 points at build; metadata: entry point, exit point, natural draw duration, lift markers.
- **Dimensions:** Normalised to a unit square, centred.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Morph rules (entry and exit points near the left and right so words connect). **Exclusions:** Max one figure on screen; never during a word being written.
- **Quality bar:** Recognisable as one line at 40% of the short side; draws in 0.6-2 s; entry and exit points allow a smooth morph; no likeness of logos or characters.

### PHO-GEO-CRV Curve generators (12 generators)

- **Purpose:** Hooks and breaks: the style's abstract voice.
- **Design language:** Mathematical curve families parameterised by seed, tempo and energy.
- **Production:** procedural-code; TypeScript generators producing point arrays.
- **Dimensions:** Unit square.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Symmetry rules. **Exclusions:** Max one curve on screen.
- **Quality bar:** Each family visually distinct at three seeds; deterministic.

### PHO-TYP-SFN Stroke font configurations (9 configurations)

- **Purpose:** The beam writes words.
- **Design language:** Single-stroke and outline-trace lettering setups.
- **Production:** authored-data; Font loader configs (Hershey JHF, Relief SVG font, outline trace settings).
- **Dimensions:** Em.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Scripts per member. **Exclusions:** Outline trace only where gate passed.
- **Quality bar:** Readable at 5% cap height.
- **Gate:** PHO-G1: Hershey licence verification and outline-trace readability (native readers) before approval of each member.

### PHO-FRM-FUR Scope furniture and rooms (8 sources)

- **Purpose:** Register context with minimal clutter.
- **Design language:** Graticules, bezels, curved glass and dark room plates.
- **Production:** hybrid; SVG graticules; KTX2 room plates (very dark, photographed long exposures without trails).
- **Dimensions:** Screen.
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Registers listed. **Exclusions:** Graticule only in scope register.
- **Quality bar:** Never above 15% luminance.

### PHO-PAL-BCL Beam colours (9 configurations)

- **Purpose:** Colour per register and section.
- **Design language:** Phosphor and light colours with decay ramps.
- **Production:** authored-data; JSON ramps.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Registers. **Exclusions:** One at a time.
- **Quality bar:** Contrast target.

### PHO-MOT-PER Persistence profiles (5 configurations)

- **Purpose:** Memory of the line.
- **Design language:** Trail decay curves.
- **Production:** authored-data; JSON.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All. **Exclusions:** Off in reduced motion.
- **Quality bar:** Deterministic in export.

### PHO-MOT-BMB Beam behaviours (7 configurations)

- **Purpose:** Natural drawing feel.
- **Design language:** How the beam travels.
- **Production:** authored-data; JSON.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** All. **Exclusions:** No jitter in reduced motion.
- **Quality bar:** Reviewed.

### PHO-TRN-MRP Morph rules (6 configurations)

- **Purpose:** Continuity: the style's core.
- **Design language:** Rules that turn a word into a figure and back.
- **Production:** authored-data; JSON rules with path resampling settings.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Figures with entry and exit points. **Exclusions:** No morph shorter than 300 ms.
- **Quality bar:** Morphs read as one line changing.

### PHO-GEO-SYM Symmetry rules (6 configurations)

- **Purpose:** Choruses gain complexity without new assets.
- **Design language:** Mirror and rotational repeats of the beam path.
- **Production:** authored-data; JSON.
- **Dimensions:** n/a
- **Variation dimensions inside the family:** member identity only (each member is a different design)
- **Compatibility:** Curves and figures (not words). **Exclusions:** Never applied to words.
- **Quality bar:** Words stay unmirrored and readable.

## Shared assets this style depends on

- none
