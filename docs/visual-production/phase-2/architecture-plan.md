# Technical architecture plan

Phase 2 planning. How the 15 styles fit the existing app. Nothing here is implemented; pseudocode is for planning only. File references describe the code as it is on the main branch and the PR #5 branch today.

## 1. Where we start

| Area | Today |
|---|---|
| Renderers | Canvas 2D "Clean" renderer (`lib/kinetic/render.ts`) and WebGL2 "Turbo" renderer (`lib/kinetic/gl/renderer.ts`), behind `stageRenderer.ts` |
| Modes and styles | `StageMode` 'clean' or 'turbo' (`lib/kinetic/modes.ts`); `TurboStyleId` (liquid, terminal, sketch, nebula, acid, ascii in `lib/kinetic/turbo.ts`); classic `StyleId` (`lib/kinetic/types.ts`); art directions (`lib/kinetic/directionStyles.ts`, `lib/theme/directions.ts`) |
| Frame model | `computeFrame` is pure and deterministic (`hash01`, seeded helpers); the scene host provides tex, sprite, shape, rect, fullscreen and ascii passes plus POST uniforms (grain, scan, curve, dither, halftone, bloom, motion blur, flash) |
| Timeline | `lineAt()` with word timing that is authored, estimated or none; director (`lib/kinetic/director.ts`) plans cuts between Turbo styles |
| Caches | LRU glyph and sprite caches in the WebGL renderer |
| Preferences | `lib/ui-store.ts` stores `mode`, `turboStyle`, `style` (and a legacy `lyricscape.style` key); `lib/theme/store.ts` stores saved themes and family defaults |
| Export | `lib/export/video.ts` steps `t` frame by frame (mediabunny); sizes 1080p, 720p, vertical 9:16, portrait 4:5, square |

## 2. Target architecture

```
StyleRegistry (15 entries)
  id, name, tier: 'gpu+canvas' | 'gpu-only', qualitySteps, fonts, manifestUrl
      │
SongContext ── timeline (lines, words, confidence), identity, lexicon tags, cover, structure, beats
      │
ScenePlanner (pure)          → per section: scene family, composition family, transition   (scene-composition-system.md)
      │
SlotFiller (pure)            → per line: assets for each slot, layout, emphasis
      │
StyleModule.computeFrame(t)  → draw list (pure function of plan, line, t)
      │
Renderer tier                → WebGL2 scene host (+ 3D path for Monument)  |  Canvas 2D host
      │
Post (shared)                → grain, bloom, halftone, ... → FlashGuard (V5) → screen / export encoder
```

### 2.1 One registry (decision D-04)

The split between Clean styles and Turbo styles goes away. A single `StyleRegistry` lists the 15 styles. Each declares:

- `tier`: whether it has a Canvas 2D rendition (14 styles, several reduced: for example Liquid Light Show cross-fades pre-rendered fluid stills) or is GPU only (Monument);
- `qualitySteps` for the governor (V7);
- its fonts per script, its manifest, its scene families and its reduced-motion rendition.

Clean's readability tests become per-style tests that run on both tiers.

### 2.2 Style module interface (pseudocode)

```ts
interface StyleModule {
  id: StyleId15
  plan(song: SongContext): ScenePlan            // pure; cached per song
  prepare(plan: ScenePlan, line: number): Prep   // worker-safe per-line work (layout, masks, card paint)
  frame(plan: ScenePlan, prep: Prep, t: number, view: Viewport, opts: { reducedMotion: boolean, quality: number }): DrawList
}
```

`frame` must be pure: same inputs, same draw list. `prepare` may be asynchronous but its output is a pure function of its inputs, so export can call it ahead of time.

### 2.3 Scene host extensions

| Extension | Needed by | Notes |
|---|---|---|
| Parallax layer system with hinged sprites | Paper Theatre, Nocturne, Panels | Small extension of sprite pass (Phase 1 J.2) |
| Thick lines with glow and a persistence buffer | Phosphor, Glyph Cinema, Liquid Light Show | Ping-pong texture with decay, computed from a bounded time window |
| Stroke-reveal masks | Ink, Sketch Cards | Distance-along-skeleton masks per glyph; worker-built |
| Character-cell pass with hardware cell sprites | Glyph Cinema, Signage, Screenlife | Extends the existing ascii pass |
| Fluid simulation (deterministic, baked flow textures) | Liquid Light Show | Gate LLS-G1 |
| Perspective camera, depth buffer, sprite stacks, instancing | Monument | Gate MON-G1; the only 3D path |
| Page composition into a texture | Panels, Folio | Re-render only when the active panel or page changes |

### 2.4 Asset management

- Planning manifests (`docs/visual-production/styles/*/asset-manifest.json`) stay as the specification. Phase 3 adds a **runtime manifest** per style with produced files, hashes and sizes; the build fails if a referenced file is missing or over budget.
- Assets load per style on demand, by scene family, with prefetch of the next section (performance-and-caching.md).
- Path data, KTX2 textures and JSON configurations are the only runtime formats (asset-standards.md).

### 2.4.1 Directory structure, versioning and loading (planned)

```
assets/
  shared/                     SHR-* shipped files (fonts as WOFF2 subsets, noise KTX2)
  styles/<slug>/
    runtime-manifest.json     produced files: id, path, bytes, sha256, version, scene families
    <ID>.<ext>                one shipped file per asset (path data .json/.bin, .ktx2, .png fallback)
    <ID>.json                 sidecar: author, method, source reference, generator and seed, licence
assets-src/ (or external archive)   sources (SVG, PSD, scans, RAW), never shipped
```

- **Versioning.** Each runtime-manifest entry carries an integer `version` bumped on any change and a content hash. The manifest itself has a schema version (`lyricscape.asset/1.0.0`, as the planning manifests).
- **Bundles.** A style ships as one small core bundle (its B1 assets) plus one bundle per scene family. Bundles are requested by the planner one section ahead.
- **Cache invalidation.** File URLs include the content hash, so a changed asset gets a new URL; the browser and service-worker caches never serve a stale file. The in-memory LRU keys by ID and version.
- **Memory management.** Per-style budgets (performance-and-caching.md); textures of scene families no longer in the plan window are released first.
- **Fallback assets.** Every slot declares a fallback (a simpler member of the same family, or a generator output). A missing or failed file never blocks a frame: the slot renders its fallback and logs once.
- **Validation.** The build checks runtime manifests against the planning manifests (IDs exist, status approved or revised, gate passed for deferred entries), file sizes against budgets and formats against asset-standards.md.

### 2.5 Typography infrastructure

Font loading per style and per script, face routing per run, shaping by the browser, per-letter effects only for simple scripts, payload budgets (typography-system.md, batch INF-07).

### 2.6 Song inputs still missing

- **Timing-confidence soft mode (P4)**: every style needs it (INF-04).
- **Section roles beyond verse, chorus and break**: intro, bridge and outro are derived by the planner from gaps, repeats and position; no new analysis is assumed.
- **Beat grid confidence** is already available and is respected (no beat-locked motion without it).

## 3. Migration (decision D-05)

Stored preferences hold `mode`, `turboStyle` and `style` (and the legacy key). Phase 3 adds a one-time migration that maps every old id to its new style using Phase 1 Section D:

| Old | New |
|---|---|
| Turbo: terminal (Code screens) | Screenlife |
| Turbo: sketch | Sketch Cards |
| Turbo: ascii | Glyph Cinema |
| Turbo: liquid | Liquid Light Show |
| Turbo: acid | Sketch Cards (its creatures moved there) |
| Directions: Velvet, Nocturne, Stillness | Nocturne |
| Directions: Broadsheet, Art Book, Ether | Folio |
| Directions: Type as Rhythm, Graphic, Controlled Disorder | Konstrukt |
| Direction: Analog Cinema; classic Film, Retro VHS | Celluloid |
| Direction: Cover Pop; classic Gloss | Cover Pop |
| Classic: Monochrome editorial | Folio |
| Classic: Minimal | Nocturne |
| Classic: Notebook | Sketch Cards |
| Classic: Pop art | Panels |
| Classic: Neon noir | Signage |
| Classic: Aurora, Psychedelic | Liquid Light Show |
| Classic: Maximalist, Y2K | Cover Pop (Maximalist's burst lives there; Y2K has no successor, Cover Pop is the nearest bright style) |
| Classic: Vaporwave | Signage (synthwave and vaporwave tags) |
| Turbo: nebula (labelled Lyrics app) | Nocturne (its rolling column layout moves there) |
| Classic: Custom | Studio customisation (not a style) |

Rules: the migration runs once, records its version, never deletes the old keys until the new registry is the default, and shows a one-line notice the first time a migrated pick is used.

## 4. Auto choice of style (decision D-06)

The existing direction picker extends to the 15 styles: identity (mood, energy, perspective), genre tags and cover analysis score each style; the top style is chosen, its reasons are shown, and a manual pick is sticky per song and globally. The cross-style director (cutting between styles inside one song) survives only as an opt-in "mix" mode; the default is one style per song with scene families changing inside it.

## 5. Floating lyrics, overlay and wallpaper (decision D-07)

These surfaces keep their own small looks but inherit the chosen style's type pairing and colour family through a simplified 2D rendition. No surface runs a full style.

## 6. Export

Export uses the same `plan`, `prepare` and `frame` calls as playback, waits for each section's assets, and renders at the chosen export size. Persistence, fluid and piles are computed from time or line index, so exported frames match playback.

- **Fixed frame-rate stepping.** Export steps `t` at the export frame rate; no style reads wall-clock time or frame counts.
- **Scene selection** is the same plan as playback for the same song and settings; the export size changes only responsive composition rules (orientation), never which scene family a section uses.
- **Aspect ratios.** Every composition family defines landscape, portrait, square and small rules; export picks by the output size, not the window.
- **Missing assets.** Export waits for prefetch; if an asset still fails, the slot's fallback renders (the same as playback) and the export log names it.
- **GPU fallbacks.** If WebGL2 is unavailable or the context is lost during export, styles with a Canvas 2D tier continue on it; Monument export is unavailable without WebGL2.
- **Silent video and still images.** Silent export is the same frames without audio muxing. Still image export renders one frame at `t` through the same path.
- **Export-safe transitions.** Transitions are functions of time from their start; none depends on the previous rendered frame.
- **Stable typography.** Fonts are loaded and measured before export starts, so line layout is identical across frames.

