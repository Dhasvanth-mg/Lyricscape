# Sketch Cards: production notes

Code: `lib/styles/sketch-cards/`. Wired as the Turbo `sketch` scene (`lib/kinetic/gl/scenes/index.ts`).

| Family | Produced | Seen in real renders |
| --- | --- | --- |
| Card types (14) | 14 | index-like pages, sticky notes, wheatpaste, poster sheet, envelope, ruled and torn notebook pages |
| Grounds (11) | 11 | wooden desk, plain wall, street wall, wooden floor |
| Drawings (104) + hands (5) + tools (6) | all | all on contact sheets; in scene: tools, doodles, a few card drawings |
| Compositions (6) | 6 | C1, C4, C6 |
| Transitions (5) | 5 | sweep, flip (frame captures only, not watched as motion) |
| Art generators (14) | 0 | blocked, B-01 |

Rules implemented: dark register only for dark songs and never with cute scenes; riso only on riso sheets; photocopy only on wheatpaste and receipts; no identical card type on consecutive new lines; a drawing at most twice a song (hooks bring their card back on purpose); contrast 7:1 for ink and 4.5:1 for pill text, tested on every paper.
