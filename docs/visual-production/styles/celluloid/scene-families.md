# Celluloid: scene families and composition grammar

Style 5 of 15. Phase 2 planning (generated from planning data).

## Scene families (11)

| ID | Scene family | What it is | Roles | Chosen by (signals) | Compositions | Required families | Optional families |
|---|---|---|---|---|---|---|---|
| CEL-SCN-01 | Colour negative night | Cool shadows, warm highlights, light leaks at edges, subtitles. | verse, chorus | dark pop, cinematic, night and city | C1, C2, C4 | CEL-PAL-STK, CEL-TEX-PLT, CEL-LAY-TTL | CEL-TEX-LEK, CEL-MOT-GAT |
| CEL-SCN-02 | Black-and-white reversal | Silver tones, strong grain, backlit serif cards. | verse, bridge | classic, melancholy, older songs | C2, C1 | CEL-PAL-STK, CEL-TEX-PLT, CEL-LAY-TTL | CEL-MOT-GAT |
| CEL-SCN-03 | Home movie | Warm saturated reversal stock, rounded gate corners, big light leaks, 18 fps. | verse, chorus, quiet | nostalgic, warm, memory, family | C1, C2, C5 | CEL-PAL-STK, CEL-TEX-PLT, CEL-TEX-LEK, CEL-LAY-TTL | CEL-MOT-GAT |
| CEL-SCN-04 | Tape | Magnetic tape: chroma bleed, dropouts, tracking lines; absorbs Retro VHS. | verse, chorus | lo-fi, 90s, bedroom, VHS tags | C1, C2 | CEL-PAL-STK, CEL-TEX-TAP, CEL-LAY-TTL | none |
| CEL-SCN-05 | High-contrast lith | Pure black and white with one tint, hard scratches, bursts. | chorus, high | intense, aggressive, graphic | C2, C6, C3 | CEL-PAL-STK, CEL-TEX-PLT, CEL-LAY-TTL | CEL-PTH-SCR |
| CEL-SCN-06 | Scratch on leader | Words and doodles scratched into black leader, jittering at 12 fps. | verse, bridge, break | raw, punk, handmade, dark | C3 | CEL-PTH-SCR, CEL-TEX-PLT, CEL-TYP-REG | CEL-PAL-STK |
| CEL-SCN-07 | Backlit optical | Words assemble from drifting backlit letters with soft halos. | verse, quiet, chorus | dreamy, ambient, romantic | C2, C1 | CEL-PAL-STK, CEL-TEX-LEK, CEL-LAY-TTL | CEL-MOT-GAT |
| CEL-SCN-08 | Projection room | A projector throws the lyric onto a wall; dust drifts in the beam. | bridge, break | nostalgic, cinema, memory | C4 | CEL-ENV-PRJ, CEL-PAL-STK, CEL-LAY-TTL | CEL-TEX-PLT |
| CEL-SCN-09 | Silent intertitles | Bordered intertitle cards on toned stock (original borders), 18 fps flicker. | verse, chorus | old-time, storytelling, waltz, theatrical | C2 | CEL-FRM-BRD, CEL-PAL-STK, CEL-LAY-TTL | CEL-TEX-PLT, CEL-MOT-GAT |
| CEL-SCN-10 | Title burst | One face per word, cut on the word, stocks alternating. | chorus, high | energetic choruses with authored word timing | C6, C5 | CEL-TYP-REG, CEL-PAL-STK, CEL-LAY-TTL | CEL-TEX-PLT |
| CEL-SCN-11 | Leader and countdown | Original countdown designs on leader stock. | intro, break, outro | always | C7 | CEL-OBJ-CNT, CEL-TEX-PLT | CEL-PAL-STK |

### Structural attributes (used for the similarity check)

| ID | Scene | stock | register | damage | light | structure | density |
|---|---|---|---|---|---|---|---|
| 01 | Colour negative night | colour negative | subtitle and backlit | light | cool with warm leaks | letterbox | low |
| 02 | Black-and-white reversal | bw reversal | backlit serif | medium | neutral | card | low |
| 03 | Home movie | warm reversal | typewriter and subtitle | heavy leaks | warm sun | rounded gate | low |
| 04 | Tape | tape | subtitle | dropouts | lifted blacks | 4:3 frame | medium |
| 05 | High-contrast lith | lith | burst and scratch | scratches | hard | full frame | medium |
| 06 | Scratch on leader | black leader | scratched hand | scratch is the image | none | full frame | medium |
| 07 | Backlit optical | colour negative soft | backlit assembly | none | halo bleed | card | very low |
| 08 | Projection room | any | projected | beam dust | beam in the dark | room | low |
| 09 | Silent intertitles | toned | intertitle | medium | flicker | bordered card | low |
| 10 | Title burst | varies per cut | burst | light | hard | full frame word | high cut rate |
| 11 | Leader and countdown | leader | none | leader marks | flat | countdown | very low |

**Similarity check.** Pairs of scene families that differ in fewer than 3 of the 6 structural attributes: none. Palette is deliberately not an attribute (a recolour is not a different scene).

## Composition grammar

**Layer order (back to front):**

1. stock base (colour, exposure)
2. image plates (light falloff, light leaks)
3. environment (projection room only)
4. title (register)
5. damage plates (dust, hair, scratches)
6. gate (frame edges, sprockets, letterbox bars)
7. post: grain, flicker, weave, vignette

**Required.** One stock; one title register (except leader); grain; gate weave.

**Optional.** Light leaks, damage plates (max 2 kinds), projection room, intertitle border.

**Scale and position constraints.** Titles from the size table; plates cover the image area.

**Typography-safe regions.** Subtitle inside action-safe; damage under 20% opacity over text.

**Colour compatibility.** Stock grade only; titles white, cream or stock highlight.

**Motion compatibility.** Damage at 24/18/12 fps; one cut source at a time.

**Material compatibility.** Tape plates only with the tape stock; scratches never with tape.

**Complexity limits.** Max 3 texture plates at once.

**Invalid combinations.**

| This | never with | Because |
|---|---|---|
| Tape stock | film scratches or sprockets | Different medium. |
| Burst register | estimated word timing | Claims word cuts. |
| Scratched hand register | complex scripts | No stroke data; falls back. |
| Flash frames | reduced motion or under 3 s apart | Flash rule. |
| Light leaks | over the subtitle box above 30% | Readability. |
| Projection room | burst register | Too fast for the room metaphor. |

## Meaningful variation

**Major (change the scene):**
- Stock (6 plus leader)
- Title register (6)
- Composition (7)
- Damage profile

**Minor (parameters, not new scenes):**
- Grade within a stock
- Plate choice within a kind
- Frame rate feel (24/18/12)

**Not counted as assets or as variety:** Grain seeds, plate offsets, grade tints.

## Deterministic selection

Stock order per song from mood and genre (table in design-spec), seeded by track id among allowed stocks; registers from energy and timing quality (burst requires authored words); compositions per line density. Pure functions.

## Repetition control

No stock for more than 2 consecutive sections (except chorus recall); a light-leak plate at most once per section; countdown design fixed per song.

## Rejected and merged scene families

| Candidate | Decision | Reason |
|---|---|---|
| Silent comedy pastiche | rejected | Pastiche risk; intertitles keep only the card format. |
