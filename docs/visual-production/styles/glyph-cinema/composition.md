# Glyph Cinema: composition families

Style 2 of 15. Phase 2 planning (generated from planning data).


6 structurally distinct composition families. Each changes the focal type, depth structure or the lyric's relationship to the environment, not only colour. Scene families (scene-families.md) choose among them.

## GLY-CMP-C1 Picture with lyric band

- **Focal point:** The subject's focal area (declared per subject).
- **Lyric placement:** A clean band of 1-3 rows in the top or bottom third, whichever does not cross the focal area.
- **Background structure:** Background cells of the picture (lowest ramp levels).
- **Foreground:** None.
- **Negative space:** Dark or empty cells around the subject (subjects keep 30% breathing space).
- **Visual hierarchy:** Band > subject focal > rest.
- **Layering (back to front):** background cells, subject cells, band mask, band text, persistence, post (scan or paper)
- **Depth and perspective:** Flat grid; depth only implied by the picture.
- **Camera:** Grid-snapped zoom and cell pans.
- **Safe areas:** Band fully inside 4-cell margins and above the bottom 14% player zone.
- **Compatible asset categories:** SUB, RMP, REG, PAL, LAY band layouts
- **Musical and lyrical conditions:** Default for verses.
- **Responsive:**
  - 1280x720 landscape: Grid 96-128 columns; band at chosen third.
  - 720x1280 portrait: Grid 40-56 columns; band in the bottom third; subjects use portrait crop.
  - 1080x1080 square: 64-80 columns.
  - 390x844 small mobile: 40 columns minimum cell size rule; fine grid off.

## GLY-CMP-C2 Calligram

- **Focal point:** The hook words inside the picture.
- **Lyric placement:** Hook letters routed into the subject's highlight cells; the same line also stays in the band for reading.
- **Background structure:** Subject at reduced brightness (60%) so routed letters stand out.
- **Foreground:** Routed letters at full brightness.
- **Negative space:** As C1.
- **Visual hierarchy:** Band (reading) > routed letters (image) > subject.
- **Layering (back to front):** background, subject dimmed, routed letters, band
- **Depth and perspective:** Flat.
- **Camera:** Locked; slow zoom-step only after migration completes.
- **Safe areas:** As C1.
- **Compatible asset categories:** SUB with routing targets, CAL rules
- **Musical and lyrical conditions:** Hooks and chorus lines (authored or line timing), never estimated words.
- **Responsive:**
  - 1280x720 landscape: As C1.
  - 720x1280 portrait: As C1 with portrait routing targets.
  - 1080x1080 square: As C1.
  - 390x844 small mobile: Routing allowed only if the subject region is at least 20x10 cells; otherwise invert the word in the band.

## GLY-CMP-C3 Teletext page

- **Focal point:** Double-height lyric rows.
- **Lyric placement:** Rows 18-21 of the 24-row page, double height, on a coloured background row.
- **Background structure:** Page header (page number, song title, clock = song time), mosaic picture in rows 2-16.
- **Foreground:** Fastext-style colour bar at row 24 holding section labels (original layout).
- **Negative space:** Black page background.
- **Visual hierarchy:** Lyric rows > mosaic picture > header > footer bar.
- **Layering (back to front):** page background, mosaic picture, header, lyric rows, footer
- **Depth and perspective:** Flat; raster post.
- **Camera:** Static; page updates only.
- **Safe areas:** Page fitted inside the frame with 4% margins; 40x24 cells fixed (letterboxed in portrait).
- **Compatible asset categories:** PAG templates, teletext REG, subject mosaics
- **Musical and lyrical conditions:** Chorus flips, breaks (metadata pages), retro and electronic identity.
- **Responsive:**
  - 1280x720 landscape: Page 4:3 centred with side margins in black.
  - 720x1280 portrait: Page scaled to width with black above and below; or a rotated layout of 24 columns (proposed, test).
  - 1080x1080 square: Page centred.
  - 390x844 small mobile: Page scaled to width; double-height rows required.

## GLY-CMP-C4 Typewriter sheet

- **Focal point:** The line being typed.
- **Lyric placement:** The current line typed at the carriage position near the lower middle of the sheet; previous lines above.
- **Background structure:** Paper sheet filling 80% of the frame on a dark ground; the picture made of overstrikes on the upper half.
- **Foreground:** Carriage position marker (implied).
- **Negative space:** Paper margins.
- **Visual hierarchy:** Typed line > overstrike picture > earlier lines.
- **Layering (back to front):** ground, paper sheet, overstrike picture, typed lines, ink spread, sheet shadow
- **Depth and perspective:** Slight perspective tilt of the sheet (3 degrees), flat otherwise.
- **Camera:** Sheet advances per line; slow drift.
- **Safe areas:** Typed line inside the sheet margins and the frame's central 80%.
- **Compatible asset categories:** PAP papers, typewriter REG, SUB as overstrike maps
- **Musical and lyrical conditions:** Ballads, singer-songwriter, letters, quiet sections.
- **Responsive:**
  - 1280x720 landscape: Sheet portrait-oriented centred, 70% height.
  - 720x1280 portrait: Sheet fills width.
  - 1080x1080 square: Sheet 85% height.
  - 390x844 small mobile: Sheet fills width; 34 characters per line.

## GLY-CMP-C5 Split field

- **Focal point:** The subject on one side, the lyric column on the other.
- **Lyric placement:** Lyric column of clean grid text occupying 40% of the width (landscape) or the lower 40% (portrait).
- **Background structure:** Subject in its 60% region; the column has its own darker background.
- **Foreground:** A divider column of box-drawing characters.
- **Negative space:** Column background.
- **Visual hierarchy:** Column current line > subject > earlier column lines.
- **Layering (back to front):** subject region, divider, column background, column text
- **Depth and perspective:** Flat.
- **Camera:** Static; zoom-step inside the subject region only.
- **Safe areas:** Column text inside 4-cell margins.
- **Compatible asset categories:** SUB, LAY column, RMP
- **Musical and lyrical conditions:** Dense lyric passages (the column holds 4-6 lines), rap verses.
- **Responsive:**
  - 1280x720 landscape: Side by side, subject left (right in RTL).
  - 720x1280 portrait: Stacked: subject top, column bottom.
  - 1080x1080 square: Stacked 55/45.
  - 390x844 small mobile: Stacked.

## GLY-CMP-C6 Macro cell zoom

- **Focal point:** A detail of the subject at very coarse cells (each cell readable as a letter).
- **Lyric placement:** The lyric is formed by the cells themselves: the band runs through the zoomed picture at the same coarse cell size.
- **Background structure:** Giant cells of the detail.
- **Foreground:** None.
- **Negative space:** Few cells, lots of space.
- **Visual hierarchy:** Lyric cells > detail.
- **Layering (back to front):** detail cells, band
- **Depth and perspective:** Flat.
- **Camera:** Arrived at by zoom-step.
- **Safe areas:** Band inside 2-cell margins.
- **Compatible asset categories:** SUB detail crops, RMP coarse
- **Musical and lyrical conditions:** Quiet moments, short lines, outros.
- **Responsive:**
  - 1280x720 landscape: 16-24 columns.
  - 720x1280 portrait: 10-14 columns.
  - 1080x1080 square: 14-18 columns.
  - 390x844 small mobile: 10 columns.

## Evolving through a song without chaos

One persistent picture per section, developing and accumulating; never re-rolled per line. Composition families change only at section boundaries (8-26 s, the director constants) or at a transition listed in motion.md; within a section only the lyric, accumulating elements and the camera move. A composition family is never used for two consecutive sections unless it is a chorus recall.
