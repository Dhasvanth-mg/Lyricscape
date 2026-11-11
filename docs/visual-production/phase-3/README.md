# Phase 3: production of the 15 lyric styles

Phase 3 builds what Phase 2 planned (`docs/visual-production/phase-2/README.md`). This folder is the production record: what was
built, which asset ids are produced, what was checked, what is blocked and where the work departs from the plan. Numbers here
are counted from the code and the manifests, never estimated. Where something was not measured, the file says "not measured".

| File | What it holds |
| --- | --- |
| `production-status.md` | one row per style: stage, families done, counts by status |
| `implementation-log.md` | dated entries of what was built and checked |
| `asset-production-log.md` | asset families produced, with ids and how they were made |
| `visual-review-log.md` | renders looked at, what was wrong, what changed |
| `performance-results.md` | measured timings (or "not measured") |
| `regression-results.md` | typecheck, lint, tests, build, e2e results as run |
| `blockers.md` | what cannot be done here and why |
| `design-deviations.md` | departures from the Phase 2 plan, and the four owner-decision assumptions |
| `final-acceptance.md` | the acceptance checklist and where Phase 3 stands against it |
| `styles/<slug>/` | per-style production notes |
| `reports/*.json` | machine-readable counts (asset coverage, style completion, batches, validation) |

Counting rule: asset counts are kept per status (`produced`, `blocked`, `not-started`) and per kind. They are not summed across
kinds to make completion look larger, and a family is not "produced" until every id in it is.
