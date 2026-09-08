# Japan street scene

Status: complete
Owner: Historical manager session, named in the preserved original plan; current document integration owner: Fleet documentation coordinator
Created: Unknown (historical record; creation date not recorded)
Updated: 2026-09-08

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

No separate authored historical review report was available to import. The original plan preserves the manager's verification and references to critics; those references are not presented as recoverable individual critic reports. Migration verification and independent review are separate from the preserved scene acceptance.
