# Performance, memory and caching

Phase 2 planning. **Every number in this document is a target for Phase 3 to measure, not a measurement.** Nothing has been built or benchmarked in Phase 2.

## 1. Frame budget

- Target device classes: an integrated laptop GPU (the baseline) and the owner's discrete GPU (RTX 5050, when the owner can run the bench).
- Playback target: 60 fps at 1280x720 on the baseline with the style's full quality step, and at 1080p with at most one quality step down.
- Each style's GPU frame target is below. The existing governor (`lib/kinetic/governor.ts`) steps quality down when frames run long; every style declares its quality steps (V7, batch INF-09).
- Main-thread work per frame: target under 4 ms (layout, selection and timing). Heavy per-line work (Sketch Cards card painting, Ink reveal masks, Cover Pop saliency) runs one line ahead on a worker or in idle time.

## 2. Per-style targets

| Style | GPU frame target | Memory target | Canvas 2D tier |
|---|---|---|---|
| Screenlife | Target (to measure): 2.5 ms GPU per frame at 1280x720 on the integrated GPU (today's shots measured 1.6-1.8 ms); CPU typing and layout under 1 ms per frame; sheet repaints only on line change (under 6 ms each, during the gap or the previous line). | Target: under 48 MB of textures resident (current kit state sheet 2048x2048, thread sheet up to 1024x4096, room plate 1024x576, device frame 1024x2048). | Canvas 2D tier: C4 and C6 face-on compositions without camera tilt or depth blur, typing kept; terminal without CRT curvature. Missing room plate: neutral gradient by theme. |
| Glyph Cinema | Target (to measure): 2.5 ms GPU at 1280x720 (today 3.2-3.3 ms with the analytic eye shader; baked maps should be cheaper). CPU routing under 0.5 ms per frame. | Target: subject maps 512x288 R8 x2 channels (0.3 MB each); up to 3 subjects resident; glyph atlas 2048x2048 R8 (4 MB). | Canvas 2D tier: cells drawn with fillText from a luminance sample (slower: limit to coarse grid), teletext and typewriter fine in 2D. |
| Paper Theatre | Target (to measure): 1.5 ms GPU at 1280x720 (sprite quads only); CPU layout under 0.5 ms. | Target: one set atlas (4 MB) plus figures atlas (4 MB) plus frames (2 MB) plus ground; under 16 MB. | Canvas 2D tier: same layers drawn with drawImage of masks filled by colour; no fog; simple. |
| Konstrukt | Target: 1 ms GPU at 1280x720; CPU layout under 0.3 ms per frame (layouts solved at section start). | Target: under 12 MB (type sheets at 3 weight steps per line, textures). | Canvas 2D tier: the whole style is drawable in 2D (rects, arcs, text); overprint via multiply composite. |
| Celluloid | Target: 2 ms GPU at 1280x720; plates decoded once. | Target: under 40 MB (3 plates, one animated strip, title sheets). | Canvas 2D tier: subtitle and card registers with a grain overlay image; no weave. |
| Folio | Target: 1.2 ms GPU; page layout 4-12 ms once per section (done in the gap or a frame budgeted idle callback, P5 warm-up). | Target: two page textures 2048x2896 (24 MB each at RGBA8; use 1448x2048 on low tier) plus plates; under 64 MB high tier, 32 MB low tier. | Canvas 2D tier: full parity (pages are 2D); page curl becomes a slide. |
| Nocturne | Target: 1.5 ms GPU at 1280x720; rain refraction at half resolution. | Target: under 16 MB. | Canvas 2D tier: lamp room, candle, column and halo fully; rain as static droplet image. |
| Liquid Light Show | Target: 2.5 ms per dish at half resolution; 5 ms worst case with two dishes on the integrated GPU (to measure; tier down to one dish if over). | Target: flow textures 512x512 RG16F x4 (8 MB), dye textures 1024 (8 MB); under 24 MB. | Canvas 2D tier: band slide over a slowly crossfading pre-rendered set of fluid stills (from the same presets, rendered at build or first run). |
| Sketch Cards | Target: GPU 1.2 ms; card paint under 8 ms done one line ahead (V9 measured in Phase 3). | Target: under 32 MB (card sheets, pile texture, grounds). | Canvas 2D tier: full parity (cards are canvas paintings). |
| Signage | Target: GPU 1.5 ms at 1080p (board, bloom, reflection). | Target: under 40 MB (plates, signs, atlases). | Canvas 2D tier: cell hardware drawn in 2D without bloom (glow via shadowBlur). |
| Ink | Target: GPU 0.9 ms; reveal masks computed per line on a worker (target under 6 ms per line, measured in the spike). | Target: under 36 MB. | Canvas 2D tier: reveal by clip-path wipe in reading direction; static spread. |
| Panels | Target: GPU 1.0 ms; page composed into a texture once per page (panels re-rendered only when active changes). | Target: under 48 MB (one page of illustrations plus the next). | Canvas 2D tier: full parity without page curl (cut). |
| Phosphor | Target: GPU 0.5 ms (persistence buffer plus thick line). | Target: under 12 MB. | Canvas 2D tier: full parity (2D lines with shadowBlur glow; persistence via an offscreen canvas fade). |
| Cover Pop | Target: GPU 0.6 ms; saliency computed once per cover (under 30 ms on a worker). | Target: under 20 MB. | Canvas 2D tier: full parity (exists). |
| Monument | Target (unproven, gate MON-G1): 60 fps at 1080p on an integrated GPU with a 40-line city; under 6 ms GPU. | Target: under 64 MB. | Canvas 2D tier: none (style unavailable); the picker hides Monument where WebGL2 is missing. |

## 3. Memory and caching

- **Per-style residency.** Only the active style's assets are resident. Switching styles releases the previous style's textures after a short grace period.
- **Texture cache.** The existing LRU caches in the WebGL renderer (glyph and sprite textures) are extended with per-style budgets (the memory targets above) and with priorities: the current scene family's assets, then the next scene family's, then everything else.
- **Prefetch.** The scene plan is known for the whole song (scene-composition-system.md), so the next section's assets are fetched during the current section (P5, batch INF-08). Target: no first-use stall over 50 ms.
- **Warm-up.** Shaders compile, fonts load and the first sheets paint before playback starts or during the intro.
- **Baking.** Accumulating scenes bake older content into one texture: Sketch Cards pile, Panels completed panels, Monument older façades into a city layer, Paper Theatre completed lines.
- **Compressed textures.** KTX2 (BasisU) for GPU textures; PNG fallback for the Canvas 2D tier.

## 4. Mobile GPUs, resolution scaling and context loss

- **Mobile and small screens.** Phones and tablets get the style's first quality step by default: render scale 0.75 of device pixels, half-resolution post effects, and no more than one full-screen blur pass. Monument is hidden on devices without WebGL2 and on devices the governor marks as low tier.
- **Resolution scaling.** Every style renders type at full device resolution and may render heavy layers (fluid, fog, bloom, persistence) at reduced resolution. Each style's quality steps say which layers scale.
- **Draw calls.** Target under 150 draw calls per frame (instancing for repeated sprites: bulbs, cells, city façades, pile cards).
- **Shader complexity.** Full-screen passes target under 0.5 ms each on the baseline GPU; loops have fixed bounds.
- **Asset decoding.** KTX2 transcoding runs on a worker; decoding of the next section's assets is spread across idle frames.
- **Context loss and recovery.** On WebGL context loss, the renderer stops drawing, keeps the scene plan and the asset list, and on restore re-uploads the current section's textures from the HTTP cache and recompiles shaders before resuming. Until restore, styles with a Canvas 2D tier render on it. Persistence and fluid state are recomputed from time, so nothing visible depends on GPU memory that was lost.

## 5. Export

Export (`lib/export/video.ts`) steps `t` frame by frame. Because every style is a pure function of `t`, export does not need real-time speed, but it does need the same assets: export waits for the prefetch of each section before rendering it. Accumulating effects (persistence, fluid, piles) are computed from a bounded history or from line index so the exported frame equals playback. Export sizes are those in `lib/export/video.ts`: 1080p, 720p, vertical 9:16 (1080x1920), portrait 4:5 (1080x1350) and square.

## 6. Measurement plan (Phase 3)

Both renderers already have `bench(tMs, n)`, which times n renders of one moment. Phase 3 extends it into a run that samples each style across whole test songs at 1280x720 and 1920x1080 and records frame time percentiles (p50, p95, p99), memory peak and first-use stalls, and writes them into the style's folder. A style cannot finish its B1 batch until its p95 is within its target or a written exception is in `decisions.md`.
