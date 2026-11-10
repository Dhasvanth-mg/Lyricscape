# Asset production standards

Phase 2 planning. These standards apply to every asset in Phase 3. A family's manifest entry can tighten a standard, but it cannot loosen one.

## 1. Universal rules

1. **Originality.** Every asset is made for Lyricscape. No tracing, no stock clip-art, no AI-generated imagery presented as hand-made, and nothing that looks like a real brand, logo, interface, sign, character, building, landmark, title sequence or named artist's style. Reference images are for method and stay out of the repo (`AGENTS.md`: do not copy references).
2. **No text baked into art.** Art contains no readable words except generic labels that the family allows (for example Signage column headers). Lyrics are always set live.
3. **Rights record.** Each produced asset's sidecar JSON records who made it, when and how (drawn, photographed, generated from which generator and seed), plus the licence for any dependency.
4. **Determinism.** Generators and configurations produce the same output for the same seed and time. No `Math.random`, no wall-clock time.
5. **Accessibility.** Assets behind text keep the contrast contract of their style. Animated assets obey the flash rules (motion-and-transitions.md).
6. **Naming.** Files are named by asset ID (asset-taxonomy.md). Nothing is named by date or person.

## 2. Standards by production method

| Method | Source format | Shipped format | Rules |
|---|---|---|---|
| handcrafted-vector | SVG (single file per asset; named layers matching `layer_structure`) | Path data (JSON or binary) built at compile time; SVG never parsed at runtime | No embedded rasters, filters or fonts; strokes expanded only where the family says so; coordinates normalised as the family specifies (unit square or radius r); max 2,000 path points unless the family allows more |
| handcrafted-raster | PSD or layered PNG at 2x the shipped size | KTX2 (BasisU UASTC for colour, ETC1S for masks) with a PNG fallback for the Canvas tier | sRGB; premultiplied alpha; padding of 8 px around cut-outs; no visible compression banding at 1080p |
| photographed | RAW plus an edited TIFF | KTX2 RGB at the family's size | Owner photographs only; no people, brands or legible real text; colour neutral, graded in the shader; tileable where the family says so (checked at 2x2) |
| hybrid (scanned and vectorised) | 600 dpi scan plus vector or stroke records | As the family specifies (Ink stroke records plus density map) | Scan kept in the source archive, not in the repo |
| procedural-code | TypeScript module | Bundled code | Pure functions of parameters and seed; unit test with a fixed seed snapshot; documented parameter ranges |
| shader | GLSL ES 3.0 | Compiled at warm-up | Uses the scene host uniforms; precision mediump unless the family needs highp; no derivatives in loops; must compile on the integrated GPU target |
| authored-data | JSON | JSON (validated against a schema) | One schema per family type (layout, choreography, palette, camera, scene family) |
| licensed-font | Upstream font files | WOFF2 subsets | OFL or equivalent recorded; subsets by script; load through the font loader with its payload budget |

## 3. Visual consistency standards ("art bible" per style)

Before the first asset of a style is produced, Phase 3 writes a one-page art bible for that style (Phase 1 J.4). It is derived from the style's `design-spec.md` and fixes:

- line weight range (in px at 1080p) and edge quality (clean, rough, dry-brush, cut paper);
- detail level (how many elements a silhouette may carry, for example Ink "reads in under 12 strokes");
- palette rules and the colour budget;
- the lighting direction and shadow treatment;
- texture rules (where grain, fibre and dot screens apply);
- the readability contract (what sits behind text).

Every asset review checks the asset against its style's art bible as well as its manifest acceptance criteria.

## 3.1 Visual quality checklist (every asset)

| Aspect | Standard |
|---|---|
| Artistic consistency | Matches the family's design language and the style's art bible |
| Edge quality | As the family specifies (clean vector, rough brush, cut paper, dry brush); no unintended jaggies or halos at 1x and 2x |
| Texture detail | Visible at 1080p without moiré at 720p; no texture that competes with text at the active-text position |
| Colour precision | sRGB; palette-driven assets use the palette slots, not baked colours |
| Layer separation | Layers named and separable as `layer_structure` says |
| Transparency | Premultiplied alpha, no fringe, 8 px padding |
| Material coherence | Materials in one frame obey the style's material rules |
| Lighting consistency | Light direction and shadow treatment per the art bible |
| Visual density | Within the composition family's complexity limit |
| Typography integration | Never obstructs a text-safe region; declares where text may sit |

## 4. Review standard

Each asset goes through three checks before its status becomes "produced" in Phase 3:

1. **Self-check** against the manifest entry's acceptance criteria.
2. **Family review**: the asset is viewed next to every other member of its family at the same size to catch near-duplicates and drift. Near-duplicates are merged, as in Phase 2.
3. **In-scene review**: the asset is rendered in every scene family it lists, at 1280x720 and 720x1280, in golden frames.

Cultural and script reviews (native readers for Devanagari, Tamil and Arabic) are required for any asset that renders those scripts in a special way (Signage neon alphabets, Ink stroke reveal, Phosphor outline trace, Monument sprite stacks).

## 5. Size budgets (targets)

| Asset type | Target |
|---|---|
| Path drawing | under 20-50 KB |
| Sign, card, illustration with masks | under 3 MB |
| Plate or ground | under 4 MB |
| Baked sequence (Liquid Light Show, Ink water) | under 16 MB |
| Per-style resident memory | 12-64 MB depending on style (performance-and-caching.md) |

These are targets for Phase 3 to measure, not measurements.
