# Regression results

Run on 2026-11-11 in the cloud container, after the Sketch Cards work.

| Check | Result |
| --- | --- |
| `pnpm typecheck` | pass |
| `pnpm lint` | pass |
| `pnpm test` | 918 passed, 1 skipped, 2 failed. Both failures also fail on the commit before Phase 3 (checked in a separate worktree at `9af0998`): `tests/social.test.ts` "recommendations are direct" and `tests/recap-render.test.ts` (this container's FFmpeg has no `drawtext` filter). Phase 3 tests: 28 + 8 passed |
| `pnpm build` | pass |
| `pnpm test:e2e` | The config uses the system Edge, which this container lacks. Run with Playwright's Chromium (a local config override, not committed): 15 passed, 1 failed: `e2e/spotify-library.spec.ts` expects one track to start and receives the whole collection queue. That test covers the Spotify queue hand-off, which Phase 3 did not touch; not checked against the pre-Phase-3 commit |
