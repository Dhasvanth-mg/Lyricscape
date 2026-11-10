# Konstrukt: composition families

Style 4 of 15. Phase 2 planning (generated from planning data).


7 structurally distinct composition families. Each changes the focal type, depth structure or the lyric's relationship to the environment, not only colour. Scene families (scene-families.md) choose among them.

## KON-CMP-C1 Block on grid

- **Focal point:** The type block in the lower-left modules.
- **Lyric placement:** Flush-left block spanning 4-8 columns in the lower half (upper in some templates).
- **Background structure:** Paper.
- **Foreground:** One dominant form in the opposite quadrant.
- **Negative space:** Large empty modules (40-60% of the poster).
- **Visual hierarchy:** Block > dominant form > rules.
- **Layering (back to front):** paper, grid rules, forms, type, numerals
- **Depth and perspective:** Flat.
- **Camera:** None.
- **Safe areas:** Block within grid margins (6% outer margin) and out of the bottom 14% in the app stage.
- **Compatible asset categories:** GRD, LAY block templates, SHP any family
- **Musical and lyrical conditions:** Default.
- **Responsive:**
  - 1280x720 landscape: 12-column grid.
  - 720x1280 portrait: 6-column grid; block spans the width.
  - 1080x1080 square: 8-column.
  - 390x844 small mobile: 4-column; block full width.

## KON-CMP-C2 Column stack

- **Focal point:** A vertical stack of words, one per row.
- **Lyric placement:** A stack aligned to one grid column edge.
- **Background structure:** Paper.
- **Foreground:** Forms in the remaining columns stepping alongside each word.
- **Negative space:** Columns not used by forms.
- **Visual hierarchy:** Current word row > stack > forms.
- **Layering (back to front):** paper, grid, forms, stack
- **Depth and perspective:** Flat.
- **Camera:** None.
- **Safe areas:** Stack within margins.
- **Compatible asset categories:** LAY stack templates, SHP bars and dots
- **Musical and lyrical conditions:** Rap, short words, word-synced lyrics.
- **Responsive:**
  - 1280x720 landscape: Stack in columns 1-3.
  - 720x1280 portrait: Stack full height on the left half.
  - 1080x1080 square: As landscape.
  - 390x844 small mobile: Stack only.

## KON-CMP-C3 Rotated edge

- **Focal point:** A line set 90 degrees along the long edge.
- **Lyric placement:** Rotated line on the left edge (bottom to top).
- **Background structure:** Paper; second ink field in the centre.
- **Foreground:** Dominant form centred.
- **Negative space:** Edges.
- **Visual hierarchy:** Form > rotated line > rules.
- **Layering (back to front):** paper, field, form, rotated type
- **Depth and perspective:** Flat.
- **Camera:** None.
- **Safe areas:** Rotated line inside the edge margin band.
- **Compatible asset categories:** LAY rotated templates, SHP circles and rings
- **Musical and lyrical conditions:** Bridges, instrumental-heavy sections, Latin and Hebrew only.
- **Responsive:**
  - 1280x720 landscape: Line on the left short edge (fits fewer words; long lines switch to C1).
  - 720x1280 portrait: Line on the long left edge.
  - 1080x1080 square: Left edge.
  - 390x844 small mobile: Not used under 400 px width.

## KON-CMP-C4 Split field

- **Focal point:** The division between two colour fields and the type crossing it.
- **Lyric placement:** Type crossing the split, knocking out where it crosses the second ink.
- **Background structure:** Two flat fields.
- **Foreground:** Forms on one side only.
- **Negative space:** The emptier field.
- **Visual hierarchy:** Type > split > forms.
- **Layering (back to front):** field A, field B, forms, type
- **Depth and perspective:** Flat.
- **Camera:** None.
- **Safe areas:** Type centred on the split within margins.
- **Compatible asset categories:** LAY split templates, PAL duotone
- **Musical and lyrical conditions:** Choruses, call-and-response, energetic verses.
- **Responsive:**
  - 1280x720 landscape: Vertical split at a grid column.
  - 720x1280 portrait: Horizontal split.
  - 1080x1080 square: Diagonal split allowed.
  - 390x844 small mobile: Horizontal split.

## KON-CMP-C5 Concentric

- **Focal point:** The centre of a ring system.
- **Lyric placement:** Line on the horizontal through the centre, or on an arc (Latin only, short lines).
- **Background structure:** Paper.
- **Foreground:** Rings and arcs around the centre.
- **Negative space:** Corners.
- **Visual hierarchy:** Type > rings.
- **Layering (back to front):** paper, rings, arcs, type
- **Depth and perspective:** Flat.
- **Camera:** None.
- **Safe areas:** Type inside the central 70%.
- **Compatible asset categories:** SHP rings, arcs, circles; LAY concentric templates
- **Musical and lyrical conditions:** Hooks, electronic songs, loops.
- **Responsive:**
  - 1280x720 landscape: Ring system centred, radius to 45% of height.
  - 720x1280 portrait: Radius to 45% of width.
  - 1080x1080 square: Native.
  - 390x844 small mobile: Native.

## KON-CMP-C6 Scatter on grid

- **Focal point:** The current word's module.
- **Lyric placement:** Each word of the line in its own module across the poster.
- **Background structure:** Paper.
- **Foreground:** Forms fill unused modules.
- **Negative space:** Unused modules.
- **Visual hierarchy:** Current word > other words > forms.
- **Layering (back to front):** paper, grid, forms, words
- **Depth and perspective:** Flat.
- **Camera:** None.
- **Safe areas:** All modules inside margins.
- **Compatible asset categories:** LAY scatter templates, SHP squares and dots
- **Musical and lyrical conditions:** Word-synced lyrics with authored timing only; disabled for complex scripts with long words.
- **Responsive:**
  - 1280x720 landscape: Up to 8 word modules.
  - 720x1280 portrait: Up to 6.
  - 1080x1080 square: Up to 6.
  - 390x844 small mobile: Up to 4; longer lines fall back to C1.

## KON-CMP-C7 Giant form

- **Focal point:** One huge cropped form (a circle at 130% of the frame height).
- **Lyric placement:** Type small in a corner module set flush left.
- **Background structure:** Paper.
- **Foreground:** The giant form.
- **Negative space:** Paper around the form.
- **Visual hierarchy:** Form > type.
- **Layering (back to front):** paper, giant form, type
- **Depth and perspective:** Flat.
- **Camera:** None.
- **Safe areas:** Type corner within margins.
- **Compatible asset categories:** SHP giant forms
- **Musical and lyrical conditions:** Intros, outros, quiet sections, breaks.
- **Responsive:**
  - 1280x720 landscape: Form crops right.
  - 720x1280 portrait: Form crops bottom.
  - 1080x1080 square: Form crops corner.
  - 390x844 small mobile: Form crops bottom; type at top.

## Evolving through a song without chaos

Layout persists within a section and accumulates active modules; reflows between sections. Composition families change only at section boundaries (8-26 s, the director constants) or at a transition listed in motion.md; within a section only the lyric, accumulating elements and the camera move. A composition family is never used for two consecutive sections unless it is a chorus recall.
