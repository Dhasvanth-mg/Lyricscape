# Visual differentiation review

Phase 2 planning. This review checks that the 15 styles differ from each other, and that the scene families inside each style differ from each other, at the level of the specifications. Rendered-frame measurement is planned for Phase 3 (scene-composition-system.md section 5).

## 1. Inside each style: scene-family structure

Every scene family has six or seven structural attributes (for example for Signage: hardware, place, light, weather, camera, mood). `gen.py` compares every pair of scene families in a style and flags pairs that differ in fewer than 3 attributes.

| Style | Scene families | Composition families | Attributes per scene | Pairs checked | Fewest differing attributes | Mean differing attributes | Pairs under 3 |
|---|---|---|---|---|---|---|---|
| Screenlife | 12 | 7 | 7 | 66 | 5 | 6.55 | none |
| Glyph Cinema | 13 | 6 | 6 | 78 | 4 | 5.44 | none |
| Paper Theatre | 13 | 7 | 6 | 78 | 5 | 5.95 | none |
| Konstrukt | 11 | 7 | 6 | 55 | 3 | 4.93 | none |
| Celluloid | 11 | 7 | 6 | 55 | 4 | 5.65 | none |
| Folio | 9 | 8 | 6 | 36 | 4 | 5.58 | none |
| Nocturne | 11 | 6 | 6 | 55 | 2 | 5.22 | Candle / Screen glow (2 of 6) |
| Liquid Light Show | 10 | 5 | 6 | 45 | 3 | 4.93 | none |
| Sketch Cards | 12 | 6 | 6 | 66 | 3 | 5.59 | none |
| Signage | 12 | 6 | 6 | 66 | 4 | 5.82 | none |
| Ink | 11 | 5 | 6 | 55 | 3 | 4.75 | none |
| Panels | 12 | 6 | 6 | 66 | 3 | 5.36 | none |
| Phosphor | 10 | 5 | 6 | 45 | 4 | 5.27 | none |
| Cover Pop | 8 | 5 | 6 | 28 | 3 | 5.54 | none |
| Monument | 9 | 4 | 6 | 36 | 5 | 5.94 | none |

**The one flagged pair.** Nocturne's *Candle* and *Screen glow* differ in 2 of their 6 attributes: both are a single small warm source in a dark room, at the same density and camera. They were kept because they are chosen by different song signals (candle for devotional, tender and acoustic songs; screen glow for late-night, modern and lonely songs) and because the light source changes the whole frame's colour temperature and falloff. Phase 3 must check them in rendered frames. If the perceptual score between them is under 0.25, *Screen glow* is merged into *Candle* as a light-source option.

During Phase 2, the check caught and fixed three other pairs: Ink *Mountains* and *Figure*, Panels *Action splash* and *Crowd and stage*, and a Konstrukt layout pair (merged as a mirror).

## 2. Across styles: the axes

| Style | Medium | Motion language | Depth | Lyric's role | Colour source | Density |
|---|---|---|---|---|---|---|
| Screenlife | Personal screens and apps | Typing, cursor, scroll, handheld camera | Device in a room | Text you type and send | App themes, screen light | Medium |
| Glyph Cinema | Character cells | Cells typing, dithering, calligram migration | Flat grid | Characters that become pixels | Register palettes (phosphor, teletext, 1-bit) | High (texture), low (meaning) |
| Paper Theatre | Cut paper on a toy stage | Hinged puppets, sliding flats, light changes | Layered flats | Cut letters, cards on strings and banners in the set | Paper colours under stage light | Medium |
| Konstrukt | Swiss geometric poster | Stepped shape choreography on a grid | Flat | Type as the grid's anchor | Two to three flat inks | Low |
| Celluloid | Film stock | Gate weave, damage, splices, title cards | Projected frame | Subtitles and intertitles | Film stocks and grades | Medium |
| Folio | Editorial print | Page-turn layouts, rules drawing, reflow | Flat page | Headline and body copy | Paper and ink, cover plates | Medium |
| Nocturne | Lens light at night | Breathing light, rain, focus resolve | Shallow depth of field | Quiet text in light | Practical light sources | Very low |
| Liquid Light Show | Projected oil and water | Performed fluid gestures | Projected layers | Text isolated on a slide | Additive dyes | High (colour) |
| Sketch Cards | Hand-made cards | Drops, hard cuts, pile | Top-down surface | A small poster per line | Song colour sets, print processes | Medium |
| Signage | Public display hardware | Flaps, chases, neon flicker | Street depth | The sign's text | Sign light | Low |
| Ink | Brush on paper | Strokes with pooling and spread | Flat sheet | Brushed words | One ink plus one accent | Very low |
| Panels | Sequential art | Camera between panels | Page | Balloons and captions | Art registers | Medium-high |
| Phosphor | A single beam | Continuous writing and morphing | Black field | The beam's line | One phosphor | Extremely low |
| Cover Pop | The song's cover | Pops and crop pans | Flat image | Hot phrases on the cover | The cover itself | Medium |
| Monument | Architecture | A walking camera, rising façades | True 3D | Façades and walls | Materials, fog from cover | Low near, high far |

**Closest pairs and why they stay separate** (each pair differs on at least three axes):

- **Signage and Phosphor** (both glowing lines on dark): Signage is static tubes and cells in a place with a sign housing and street depth; Phosphor is one moving beam on an empty field with no environment. Medium, depth, motion and density differ.
- **Sketch Cards and Panels** (both print and drawing): one hand-made card per line on a surface vs a page of sequential frames with balloons; motion is drops and cuts vs a camera moving between panels; the lyric is a poster vs speech.
- **Nocturne and Celluloid** (both cinematic, dark): lens light and depth of field vs film material, damage and title cards; Nocturne is unpeopled and very low density, Celluloid frames the lyric as subtitles.
- **Folio and Konstrukt** (both print typography): editorial hierarchy, paper and photographic plates vs geometric shape choreography locked to beats with flat inks.
- **Liquid Light Show and Ink in its water register**: projected additive dye moved by hand gestures in saturated colour vs a single black ink cloud behind clean type, used at most once per song.
- **Cover Pop and Folio** (both can show the cover): Cover Pop shows the cover full-bleed and unmodified as the stage; Folio uses it as a framed plate inside an editorial page.

## 3. What Phase 3 adds

- Rendered-frame diversity scores within songs, across songs and across styles, using the method in scene-composition-system.md.
- A blind review: a reviewer is shown 30 random frames from 15 styles and names the style; any style recognised less than 80% of the time is reviewed.
