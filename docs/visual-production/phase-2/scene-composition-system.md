# Scene composition system

Phase 2 planning. This is the shared model every style uses to build scenes from assets. It extends the existing director (`lib/kinetic/director.ts`: `sectionsOf`, `planDirector`, `snapToBeat`, MIN_SECTION_MS 8000, MIN_BREAK_MS 6000) from "cut between Turbo styles" to "cut between scene families inside one style". Code below is pseudocode for planning; it is not implementation.

## 1. The hierarchy

```
style
 └─ scene families (a world: subject, environment, rules)        <STY>-SCN-NN
     └─ composition families (structural layout of a frame)      <STY>-CMP-Cn
         └─ slots filled by assets from families                 <STY>-<CAT>-<FAM>-NNN
 transitions between scene families and sections                 <STY>-TRN-<id>
```

- A **scene family** declares its roles (intro, verse, chorus, bridge, break, quiet, high, outro), song signals, the composition families it may use, its required and optional asset families, and six structural attributes used by the similarity check.
- A **composition family** declares its focal element, placement, background, foreground, negative space, hierarchy, layer order, depth, camera, safe area and its rules for landscape, portrait, square and small screens.
- Each style's **grammar** (in `scene-families.md`) gives the layer order, required and optional elements, scale and safe-area rules, colour, motion, material and complexity limits, and a table of invalid combinations.

## 2. Schema (planning form)

```jsonc
// scene family
{
  "id": "PAN-SCN-04", "name": "Action splash",
  "roles": ["chorus", "high"],
  "signals": "energetic hooks, rock, rap",          // matched against identity and lexicon
  "compositions": ["PAN-CMP-C2"],
  "requires": ["PAN-TYP-SFX", "PAN-PRC-SPD", "PAN-OBJ-VEH"],
  "optional": ["PAN-PRP-OBJ"],
  "attributes": { "register": "halftone pop", "subject": "impact", "layout": "splash",
                  "balloons": "shout", "pace": "fast", "mood": "explosive" }
}
// composition family
{
  "id": "PAN-CMP-C2", "name": "Splash page",
  "layers": ["art", "tone", "SFX", "balloon"],
  "focal": "One large panel and SFX", "safe": "SFX and balloon central 88%",
  "responsive": { "landscape": "...", "portrait": "...", "square": "...", "small": "..." },
  "slots": [ { "role": "art", "from": ["PAN-ENV-PLC", "PAN-OBJ-VEH"], "count": 1 },
             { "role": "sfx", "from": ["PAN-TYP-SFX"], "count": [0, 1] } ]
}
```

## 3. Deterministic selection

Every choice is a pure function of the track, the settings and the line or section index, using the existing `hash01` seeding. No state carries over between frames except what can be recomputed from time.

```
plan(track, style):
  sections = sectionsOf(timeline)                    // existing; roles: verse, chorus, break (+ intro, outro, bridge derived)
  seed = hash(track.id, style.code)
  history = []
  for s in sections:
     candidates = style.scenes where s.role in scene.roles
     score(scene) = match(scene.signals, identity, lexiconTags(s))   // 0..1
                  + 0.3 * (s.isChorusRecall and scene == firstChorusScene)
                  - repetitionPenalty(scene, history)                // section 4
     ranked = sort candidates by (score desc, hash01(seed, s.index, scene.id))
     scene = first ranked scene that passes the invalid-combination table
     comp  = choose from scene.compositions by line length, orientation and energy, tie broken by hash01
     history.push(scene, comp)
  return list of (section, scene, comp, transitionIn)

fill(slot, line):
  pool = assets in slot.from that are compatible (scene_compatibility, exclusion rules, script support)
  pick = pool sorted by (lexicon match desc, uses in window asc, hash01(seed, line.index, slot.role))[0]
```

Ties are always broken by `hash01`, never by array order, so adding an asset does not shift unrelated choices more than necessary. Export and playback call the same functions, so they produce the same scenes.

## 4. Repetition control

Repetition windows apply on three levels. Each style's `scene-families.md` gives its own numbers; the defaults are:

| Level | Rule (default) |
|---|---|
| Scene family | Not used for two consecutive sections unless it is a chorus recall; at most 3 times per song |
| Composition family | Not used for two consecutive sections unless it is a chorus recall |
| Asset in a slot | At most once per section and twice per song (hook assets may return by design, with wear or a new crop) |
| Layout template | Not identical on consecutive lines |
| Transition | The same transition not three times in a row |

The penalty is `repetitionPenalty = 1.0` for a hard rule and `0.2 x uses in the last N` for soft rules, with N = 4 sections.

## 5. Diversity measurement

Phase 2 checks structural diversity on the specifications: each pair of scene families in a style must differ in at least 3 of their 6 attributes (`gen.py` reports pairs that do not; see `reviews/visual-differentiation.md`).

Phase 3 measures perceptual diversity on rendered frames. For a test set of 10 songs per style, the golden-frame runner captures one frame per section, then computes for each pair of frames:

1. **Colour distance**: Earth Mover's distance between 16-bin CIELAB histograms of the 64x36 downscaled frame.
2. **Layout distance**: 1 minus SSIM between 64x36 grayscale downscales (captures where mass sits).
3. **Edge distance**: L1 distance between 8x8 grids of Sobel edge density (captures texture and detail).
4. **Text position**: distance between the active-text bounding box centres, normalised to the frame diagonal.

The **diversity score** of a pair is the mean of the four normalised distances. Targets for Phase 3 (to tune on the first two styles, then fix):

- Within one song: no two sections of different roles below 0.25.
- Across 10 songs of one style: median pairwise score at least 0.35, and the 10 nearest pairs reviewed by eye.
- Across styles: the nearest frames of two different styles are reviewed by eye; any pair a reviewer cannot tell apart at a glance is logged in the risk register.

A low score triggers a review, not an automatic fix: some styles (Nocturne, Phosphor) are calm by design, and their targets may be lowered with a written reason in `decisions.md`.

## 6. Invalid combinations

Every style lists invalid combinations (for example "per-letter rotation with complex scripts", "cute drawings with a grief identity", "neon flicker above 3 Hz"). Selection treats them as hard filters. Phase 3 adds a unit test per row of every style's table.
