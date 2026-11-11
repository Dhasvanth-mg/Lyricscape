# Screenlife: production notes

Code: `lib/styles/screenlife/`. Drawn when the renderer's `style15` option is `screenlife`, and in place of the Turbo terminal scene.

161 of 219 live entries exist in code; 2 are blocked (B-09, B-10) and 56 are not started. The full lists are in
`reports/asset-coverage.json`. The main gaps:

- Kits not built: code editor (never chosen by default, by spec), calendar, mail, translator, sign-up form.
- Kit states not built: edited bubble, draft restored, reply-quote, strikethrough edit, pinned note, tracked changes, margin comment, tty two-user chat, code editor states, saved memos, all-done list, calendar states, arrival card, Plaid dialog, mail, translator and sign-up states.
- Two screens (C5) is not built; sections planned for it use the thread scroll.
- Carets and highlights beyond bar, block and underline (selection sweep, bold toggle, autocorrect bubble, spell squiggle, strikethrough, paste flash).
- Camera moves: rack focus, pull-back reveal, drift down, dashboard sway, settle after pick-up, top-down desk.
- The watch frame, alarm, unread badge, screenshot and Plaid dialog notifications, the phosphor persistence ramp.

Seen in real renders: every built kit in landscape and portrait, the messenger in square and small mobile, Hindi, Tamil, Arabic
and mixed-script lines. Not yet: the motion watched as motion, reduced motion as frames, real-GPU timings.
