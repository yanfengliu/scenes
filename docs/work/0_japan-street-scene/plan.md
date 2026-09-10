# Japan street scene

Status: active
Owner: Historical manager session, named in the preserved original plan; current document integration owner: Fleet documentation coordinator; integration owner for the open item: the manager session
Created: Unknown (historical record; creation date not recorded)
Updated: 2026-09-09

## Problem and outcome

Reconstruct the Japan street reference as a procedural browser 3D scene while preserving a usable view from other angles. The [original manager-authored plan](historical/PLAN.md) records all five phases as verified. This status preserves that recorded phase outcome; the document migration makes no new visual acceptance claim.

## Scope

The original plan covers the camera and block-out, architecture and stone, vegetation and background, sky and lighting, and animation, interaction, performance and delivery. Its ownership instructions and carried limitations remain unchanged in the historical source. The current work entry records their provenance and routes readers to the original requirements. Scores and thresholds remain in [PLAN-scores.md](../../PLAN-scores.md); the migration does not change them, scene behavior or deployment settings.

## Approach

Preserve all 19,615 original bytes at historical/PLAN.md. Source: scenes at a7111cca410059fe6a60793fc28b4ec547a9ae8a, path docs/PLAN.md, Git blob ea7a082580845efe0b4c7ec311fc59b37ddde070, SHA-256 5cf4b02eea7c26f2704119752df3f0be95ed3b4ab9c06a652eabba856f6d4798. The registry binds that exact file to its source revision. Bare paths and ownership claims inside it retain their original historical meaning; current document entry points use this plan.

## Acceptance criteria

- The original manager record reports five verified phases, pushed commits, gate results and visual inspections, with its limitations preserved.
- Retain the original source bytes and provenance, and resolve the live document pointers after relocation.
- Keep the score contract, product logic and historical devlog statements unchanged.
- Keep GitHub Pages deployment outside this migration; the original record explicitly says it was not deployed.

## Implementation steps

The original plan contains the five-phase implementation sequence and the manager's verification notes. The migration imports that plan through the repository's common allocation authority, adds this status and provenance wrapper, and updates live consumers. It does not repeat the historical phase work or invent separate reviewer reports.

## Outcome

Historical phase outcome: all five phases verified by the manager, with the final verification dated 2026-09-06 and naming b58d1bb, bebc068, 8a7e81d and 15692d1 on origin/main. The source reports cell distance 0.0811, SSIM 0.4411, 316 draw calls and 3.2 ms median at 1920x1080, along with visual inspection and CI evidence. These are the source's measurements and acceptance, not a fresh measurement of the current scene.

The source retains a GPU shader-precision warning with no warning gate, a corridor clamp allowing 0.35 m past the wall faces, petals falling in a box rather than a true wind field, an 8.7-second animation window shorter than the petal wrap period, a whole-frame motion bound that can miss local motion, and residual instability near the paving at device pixel ratio 2. It explicitly leaves Pages undeployed because publishing the third-party reference photograph requires the user's decision.

Deployment, 2026-09-09: the user enabled GitHub Pages after the migration; the `pages` workflow succeeds on every push since a7111cc and the site answers at https://yanfengliu.github.io/scenes/ (HTTP 200, title "Scenes"). The historical record's "not deployed" is history, not status.

## Open item, 2026-09-09: the remote gate

The `test` workflow is red on e725914 (run 34309378871) and the scene code is byte-identical to the green run one hour earlier on c18673e. `tools/nudge.js` failed with "scene did not become ready within 90000 ms" on a runner that took 37 minutes for the animation gate against 28 on the green run; the readiness deadline in `tools/lib/browser.js` has no margin for a slow runner. A rerun was started to test flakiness.

Reading the green run's log found a second defect: `== tools/blackframe.js ==` and `== tools/record.js ==` are 0.3 seconds apart with no output between them. Both tools, plus `paintcheck` and `shimmer`, guard their main block with a template that yields `file:////home/...` on Linux and never matches, so on CI they load, print nothing and exit 0. Neither gate has ever run in CI. Assigned to a worker at e725914: fix the guard in all four tools, give `openScene` a measured readiness margin that prints how long readiness took, make `tools/test.js` fail any tool that produces no evidence of running (proved red), and set CI trims so the suite fits its 90-minute ceiling. The manager integrates, runs the suite, pushes, and treats CI on that push, with blackframe and record visibly running, as the proof.

No separate authored historical review report was available to import. The original plan preserves the manager's verification and references to critics; those references are not presented as recoverable individual critic reports. Migration verification and independent review are separate from the preserved scene acceptance.
