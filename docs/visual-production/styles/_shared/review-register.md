# Shared: asset review register

Style 0 of 15. Every entry of asset-manifest.json with its decision. Generated from planning data.

**How entries were reviewed.** Each entry was written and evaluated individually during Phase 2 against: artistic quality and fit with the family's design language, originality and rights safety, distinctness from its siblings (an automated near-duplicate check on the descriptions also ran; see below), contribution to a scene family's needs, compatibility, readability impact, performance cost and production complexity. Where a family shares production rules, the family assessment applies to every member and the member's own line records what makes it distinct. **No asset has been produced yet**, so the visual review of the produced artwork is a Phase 3 gate (quality-assurance.md).

**Decisions:** approved (goes to Phase 3), revised (an existing asset kept with rework), deferred (waits on a named gate), merged (folded into another entry), rejected (not produced; reason given).

| ID | Asset | Decision | Rationale |
|---|---|---|---|
| SHR-PRC-GEN-001 | Film grain | revised | Distinct: Luminance-weighted animated grain, cell size and strength parameters (exists in POST_FS; to be exposed per style) |
| SHR-PRC-GEN-002 | Ordered and blue-noise dither | revised | Distinct: 1-bit and n-level dither with a stable pattern per frame (exists as the dither uniform; blue-noise mode new) |
| SHR-PRC-GEN-003 | Halftone and screentone | revised | Distinct: Dot, line and stochastic screens at a chosen angle and frequency (halftone exists in POST; screentone patterns new) |
| SHR-PRC-GEN-004 | Paper fibre and tooth | approved | Distinct: Procedural fibre field and tooth height map, used as multiply and as a mask for ink absorption |
| SHR-PRC-GEN-005 | Overprint multiply | approved | Distinct: Ink layers combined subtractively with misregistration offsets (riso-like) |
| SHR-PRC-GEN-006 | Bokeh discs | approved | Distinct: Out-of-focus light discs placed from a seed, with aperture shape and cat-eye falloff |
| SHR-PRC-GEN-007 | Rain on glass | approved | Distinct: Droplets and runnels as a refraction offset map, deterministic in t |
| SHR-PRC-GEN-008 | Glow and bloom | revised | Distinct: Thresholded multi-scale blur (exists as bloom; per-style thresholds and a light-UI guard new) |
| SHR-PRC-GEN-009 | Seeded noise fields | approved | Distinct: Value, gradient and curl noise from hash01, tileable in space and periodic in t when asked |
| SHR-PRC-GEN-010 | Baked flow-field sampler | approved | Distinct: Advects texture coordinates along precomputed flow textures, time-periodic |
| SHR-PRC-GEN-011 | Distance-along-stroke reveal | approved | Distinct: Reveals a mask in order of a stored distance channel, with a brush or pen edge profile |
| SHR-PRC-GEN-012 | Depth fog and haze | approved | Distinct: Exponential fog by layer depth with a coloured horizon |
| SHR-PRC-GEN-013 | Wet ground reflection | approved | Distinct: Flipped, blurred, rippled copy of bright layers below a horizon line |
| SHR-PRC-GEN-014 | Cover derivation | revised | Distinct: Palette (exists in extractPalette.ts), dominant swatches, a 48x48 saliency and emptiness map, cover blur and crop helpers |
| SHR-PRC-GEN-015 | Character-cell pass | revised | Distinct: Maps a luminance image to glyph cells (exists as the ASCII pass; per-cell glyph routing new) |
| SHR-PRC-GEN-016 | Thick line renderer | approved | Distinct: Anti-aliased polylines with width, caps, joins and a glow falloff, batched on the GPU |
| SHR-TEX-NOI-001 | Blue noise 64 | approved | Distinct: 64x64 R8 void-and-cluster tile for dithering |
| SHR-TEX-NOI-002 | Blue noise 128 RGBA | approved | Distinct: Four independent channels for animated dither |
| SHR-TEX-NOI-003 | Value noise 256 | approved | Distinct: Tileable R8 |
| SHR-TEX-NOI-004 | Curl noise 256 | approved | Distinct: RG8 flow vectors for small drift |
| SHR-TEX-NOI-005 | Paper tooth 512 | approved | Distinct: R8 height field used by the paper fibre generator |
| SHR-TEX-NOI-006 | Fibre direction 512 | approved | Distinct: RG8 fibre orientation field |
| SHR-TYP-FNT-001 | Inter Variable | approved | Distinct: UI sans; Screenlife, Folio captions, Celluloid subtitles, Cover Pop alt |
| SHR-TYP-FNT-002 | JetBrains Mono Variable | approved | Distinct: Monospace; Screenlife terminal, Glyph Cinema ASCII |
| SHR-TYP-FNT-003 | Archivo Variable | approved | Distinct: Wide and black grotesk; Konstrukt, Monument, Signage lightbox |
| SHR-TYP-FNT-004 | Space Grotesk Variable | approved | Distinct: Grotesk; Konstrukt secondary |
| SHR-TYP-FNT-005 | Anton | approved | Distinct: Condensed display; Monument, Konstrukt, Cover Pop alt |
| SHR-TYP-FNT-006 | Bebas Neue | approved | Distinct: Condensed caps; Signage flaps, Liquid Light Show slides |
| SHR-TYP-FNT-007 | Cormorant Garamond | approved | Distinct: Light serif; Nocturne, Celluloid titles, Folio |
| SHR-TYP-FNT-008 | Instrument Serif | approved | Distinct: Condensed serif; Folio, Screenlife documents, Nocturne |
| SHR-TYP-FNT-009 | Playfair Display Variable | approved | Distinct: High-contrast serif; Folio headlines |
| SHR-TYP-FNT-010 | DM Serif Display | approved | Distinct: Display serif; Paper Theatre printed cards, Cover Pop serif voice |
| SHR-TYP-FNT-011 | Special Elite | approved | Distinct: Typewriter; Celluloid title cards, Glyph Cinema typewriter register, Paper Theatre stamps |
| SHR-TYP-FNT-012 | Permanent Marker | approved | Distinct: Marker hand; Sketch Cards, Celluloid scratch register |
| SHR-TYP-FNT-013 | Bangers | approved | Distinct: Comic display; Panels SFX, Sketch Cards |
| SHR-TYP-FNT-014 | Nunito 900 and 900 italic | approved | Distinct: Rounded heavy; Cover Pop main voice |
| SHR-TYP-FNT-015 | Syne Variable | approved | Distinct: Extended experimental; Folio loud issue |
| SHR-TYP-FNT-016 | Noto Sans Devanagari Variable | approved | Distinct: Hindi in every sans role |
| SHR-TYP-FNT-017 | Noto Sans Tamil Variable | approved | Distinct: Tamil in every sans role |
| SHR-TYP-FNT-018 | Noto Serif Devanagari | approved | Distinct: Hindi in serif roles (Folio, Nocturne, Celluloid titles, Paper Theatre cards) |
| SHR-TYP-FNT-019 | Noto Serif Tamil | approved | Distinct: Tamil in serif roles (same styles) |
| SHR-TYP-FNT-020 | Noto Sans Arabic | approved | Distinct: Arabic UI and sans roles |
| SHR-TYP-FNT-021 | Noto Naskh Arabic | approved | Distinct: Arabic serif and book roles |
| SHR-TYP-FNT-022 | Noto Sans Hebrew | approved | Distinct: Hebrew sans roles |
| SHR-TYP-FNT-023 | Frank Ruhl Libre | approved | Distinct: Hebrew serif roles |
| SHR-TYP-FNT-024 | Caveat | approved | Distinct: Handwriting; Screenlife stylus notes, Sketch Cards thin hand |
| SHR-TYP-FNT-025 | Kalam | approved | Distinct: Devanagari and Latin handwriting; Sketch Cards, Ink, Panels for Hindi hand lettering |
| SHR-TYP-FNT-026 | Kavivanar | approved | Distinct: Tamil handwriting; Sketch Cards, Ink, Panels for Tamil hand lettering |
| SHR-TYP-FNT-027 | Comic Neue | approved | Distinct: Comic lettering for balloons and captions |
| SHR-TYP-FNT-028 | Newsreader | approved | Distinct: Newspaper text serif; Folio newspaper issue |
| SHR-TYP-FNT-029 | Shrikhand | approved | Distinct: Rounded heavy display; Liquid Light Show slide voice |
| SHR-TYP-FNT-030 | Relief SingleLine | approved | Distinct: Single-stroke Latin font for the beam; Phosphor (licence OFL, verify) |
| SHR-TYP-FNT-031 | Hershey vector fonts | approved | Distinct: Single-stroke Latin, Greek, Cyrillic; Phosphor (permissive historic licence, verify wording) |
| SHR-TYP-FNT-032 | VT323 | approved | Distinct: Terminal pixel face; Glyph Cinema, Signage LED |
| SHR-TYP-FNT-033 | Bedstead | approved | Distinct: Teletext character set (public domain); Glyph Cinema teletext register |
| SHR-TYP-FNT-034 | GNU Unifont | approved | Distinct: 16 px bitmap covering Devanagari, Tamil, Arabic, Hebrew and CJK; Signage dot-matrix fallback (dual GPL with font exception / OFL, verify) |
| SHR-TYP-FNT-035 | Silkscreen | approved | Distinct: Latin pixel face; Signage flip-dot and LED |
| SHR-TYP-FNT-036 | Monoton | rejected | Neon in Signage is drawn as tube paths (SIG assets), not a font; a neon font would make every sign look the same. |
| SHR-TYP-FNT-037 | Comic Sans-like system fallback | rejected | Not open licence and not consistent across platforms; Comic Neue covers the role. |
| SHR-TYP-FNT-038 | Lobster | rejected | Overused; no style needs a generic script. |
