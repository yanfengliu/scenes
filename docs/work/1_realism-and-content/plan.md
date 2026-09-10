# Realism and content: a standing improvement loop on the Japan street scene

Status: active
Owner: Manager session (integration owner)
Created: 2026-09-10
Updated: 2026-09-10

## Problem and outcome

The user's direction on 2026-09-10: "Keep iterating to make the scene look better. More realistic, and more content." The scene at e725914 scores 0.0812 cell distance and 0.4401 SSIM against the photo and reads, beside it, as paler and flatter: the photo's darks (timber, eave undersides, the bend, the ground floor under the right eave) are near black where the render is mid grey, and the photo's lit stone and plaster are lighter than the render's. From other angles, what the photo hides is still block-out: the corner house at the bend, the far houses, the roof undersides and the right roof mass.

Outcome: a scene that scores closer to the photo on the compare gate at every iteration, never worse, and that holds up when orbited, with the block-out retired and the street carrying the life the photo shows. This is a loop, not a fixed list: each iteration's target comes from looking at the rendered scene and the compare sheet, not from reading code for something to improve.

## Scope

Included: materials and colors resampled from the photo, geometry the photo pins down, content the photo shows or implies, the sky and atmosphere, the cherry's depth, close-up material detail for orbit views, and one instrument the loop needs, `tools/views.js`, which renders a fixed orbit sweep to `out/views/` so every iteration is inspected from the same angles.

Excluded: the camera contract in `src/layout.js`, any loosening of the thresholds in `docs/PLAN-scores.md`, downloaded assets, a build step, and any file the concurrent CI-gates worker owns (`tools/test.js`, `tools/lib/browser.js`, `tools/blackframe.js`, `tools/record.js`, `tools/paintcheck.js`, `tools/shimmer.js`, `.github/workflows/ci.yml`) until that work is integrated. Workers do not edit `AGENTS.md` or `docs/devlog/summary.md`; the integration owner carries those at integration to avoid merge conflicts.

## Approach

One worker per iteration, in its own worktree from main, with a brief that names the measured cells and the visual gaps it must close, the files it may touch, and the numbers it must report. The integration owner inspects the handoff, runs the full suite in the primary checkout, looks at the photo view and the orbit sweep at native resolution, integrates, pushes, and watches CI to a conclusion. The next iteration's target is chosen after that look, from the compare heat map and the sweep.

The measured gap at the start, the twenty worst of 528 cells, groups into four causes. Contrast: the photo's near-black timber and undersides render as mid brown or grey (u 0.15 v 0.34: photo #38241c, render #766554; u 0.69 v 0.57: photo #22201e, render #5e5a5a; u 0.85 v 0.52: photo #4e453c, render #7c797b; u 0.98 v 0.25: photo #56432f, render #87786e), and the photo's lit stone and plaster render too dark (u 0.35 v 0.75: photo #a7abb2, render #696a6d; u 0.06 v 0.57: photo #c5b8aa, render #866f5d; u 0.77 v 0.89: photo #798288, render #44484c). Placement: the nearest left house reaches into cells the photo shows as sky and cloud (u 0.15 v 0.11: photo #cfbfb5, render #716c71; u 0.06 v 0.07: photo #949ca3, render #5e6067), and the annex canopy renders grey tile where the photo has dark wood (u 0.23 v 0.48: photo #66543e, render #8a8c90). The bend: the far street darkens into the bend in the photo and stays light in the render (u 0.44 v 0.75: photo #323840, render #6d6d73; u 0.56 v 0.75: photo #454446, render #757a85). Color: the shrub is greener (u 0.77 v 0.66: photo #7c958b, render #5c544e), the noren carries the sky's blue (u 0.98 v 0.43: photo #91a9c9, render #6f737f), and the sky at the top right eave is brighter (u 0.85 v 0.02: photo #ecedec, render #b9b4b2). The bottom half of the frame carries more error than the top (12.1 and 12.3 against 9.7 and 8.8 per quarter).

A global grade was tried in phase 4 and made the scores worse, so the contrast is fixed per material, by resampling from cleaner photo regions and by checking what the rig's ambient share does to a dark albedo, never by a frame-wide curve.

## Acceptance criteria

Per iteration, all of them, before the integration owner pushes:

- [ ] Cell distance and SSIM not worse than the thresholds; thresholds tightened to the achieved values minus the recorded margin.
- [ ] `npm test` green in the primary checkout: shot, compare, placement, animation, nudge, blackframe, record.
- [ ] The photo view and the orbit sweep from `tools/views.js` inspected at native resolution by the integration owner, looking for what is wrong rather than for what changed.
- [ ] One independent critic on the worker's diff and claim, findings resolved, recorded in the worker's detailed devlog section.
- [ ] Committed to main by pathspec, pushed, and the remote gate watched to a conclusion.

## Implementation steps

- [x] Iteration 1, contrast and placement (merged cb9a17c): close the measured cells above and build `tools/views.js`. Target: cell distance at or below 0.077, SSIM at or above 0.45, or the measured ceiling reported with what stops it.
- [ ] Iteration 2, content: retire the block-out the orbit sweep shows. The corner house at the bend, the far houses as machiya with tiles and lattices, roof undersides with rafters, the right roof mass as tiles, the dormer body, the paved bands.
- [ ] Iteration 3, sky and atmosphere: the photo's banded cirrus and its orange undersides, the glare's shape, cloud contrast, and haze with depth.
- [ ] Iteration 4, the cherry's depth: dark limbs visible through the canopy, a shadowed magenta interior against backlit edges, strand structure, card variety.
- [ ] Iteration 5, street life: stone variation and wetness, the drain, moss, two or three more figures, shop goods under the noren, signs, pots, a bicycle, only where the photo view does not regress.
- [ ] Iteration 6, close-up realism: materials at orbit distance, tile and board edges, wood grain, foliage cards that hold up close.
- [ ] Then the loop again, from the heat map and the sweep.

## Outcome

Iteration 1, merged as cb9a17c. Cell distance 0.0812 to 0.0768 and SSIM 0.4401 to 0.4559, both targets met; thresholds tightened to 0.0783 and 0.4509. The twenty worst cells fall 26% in summed distance. `tools/views.js` now renders seven poses to `out/views/`.

Two findings shape iteration 2. The brief's reading of cells (0.44,0.75) and (0.56,0.75) was wrong: they are landing slabs, and at z -21 the paving's right edge sits at x 2.5 where the photo's street edge is at x -2.0, so about 4.5 m of paving stands where the photo has the machiya row. Four attempts on the paving all lost, because the fix is the row itself. And the views found the top platform's face standing as a bare grey slab across the head of the stairs, invisible from the photo view and glaring from the landing.

`tileRight` is a measured dead end for colour work: it is the pan tiles' S-section, so lifting its hex moves nothing. The cross-machine SSIM noise floor is 0.0010, measured on identical code.
