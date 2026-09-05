# Local rules (scenes)

These bind alongside the fleet constitution and win where they overlap. They may make a canon rule stricter, never weaker.

- The photo view is the contract. Every landmark in `src/layout.js` is placed from its photo position through the projection helpers, and a change to the camera (eye, pitch, FOV) re-tunes every placement and re-baselines `docs/PLAN-scores.md`.
- Thresholds in `docs/PLAN-scores.md` only move toward the achieved scores (minus a small margin) at the end of a phase. They are never loosened to make a red gate green; a worse score is a regression to fix.
- Work proceeds one phase of `docs/PLAN.md` at a time. The implementer reports to the manager session at the end of a phase and waits; it does not start the next phase on its own and does not edit `docs/PLAN.md`.
- Same checkout as the manager: stage by pathspec (`git add <files>`), never `git add -A`, `git commit -a`, `git stash`, `git reset`, or `git checkout -- .`.
- `out/` holds gate outputs only (screenshots, sheets, scores) and is never committed. Task-run evidence stays there or in the scratchpad.
- Colors come from the photo, not from taste: a color with a clean region in the photo is its sampled mean (`npm run inspect -- sample name:u0,v0,u1,v1`), and the box is recorded in the devlog when the color is added or changed. A color set by eye because no clean region exists is marked as such in `src/layout.js`.
- A placement is verified by what the render shows, not by the 50% overlay alone: the overlay shows the photo through the blend, so a missing object still looks present. `npm run probe -- u,v` names the mesh at a photo position; run it over the plan's landmarks before claiming them met.
