# Devlog summary

One short dated line per behaviour-changing session, newest first. History, not status. Anything a later session could trip over is in `detailed/`.

- **2026-09-05 — Phase 1 landed: harness, camera, block-out.** Gates `dev`, `shot`, `compare`, `perf`, `test` plus the `probe` and `inspect` diagnostics; the camera model in `src/layout.js`; a block-out of every landmark in `docs/PLAN.md`. Baseline cell distance and SSIM are recorded in `docs/PLAN-scores.md` (first block-out: 0.1438 / 0.1368). The eye sits 4.8 m above the stair line rather than 1.65 m, several plan landmarks turned out to be different objects than named, and the critic caught two landmarks that the 50% overlay had hidden; see `detailed/2026-09-05-phase-1.md`.
