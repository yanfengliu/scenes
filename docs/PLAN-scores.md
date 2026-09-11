# PLAN scores (implementer-owned)

`npm test` reads the thresholds from the JSON block below and fails when a score is worse. At the end of each phase the implementer sets the thresholds to the achieved values minus a small margin and records the phase's numbers in the history table. Thresholds only tighten; a worse score is a regression to fix, not a threshold to loosen.

Scores are printed by `npm run compare` (see `tools/lib/metrics.js` for what each one can and cannot see):

- `cellDistanceMax`: mean color distance over a 24x22 grid of cells between `japan.webp` and `out/render.png`, 0 to 1, lower is better.
- `ssimMin`: grayscale SSIM at 64 px wide, -1 to 1, higher is better.

The margin covers rasterization differences between machines (anti-aliasing, SwiftShader versions); the same machine reproduces the numbers exactly. From phase 4 the frame also goes through a tone curve and a bloom pass, so a driver that rounds differently moves the scores a little more than before; the margin is 0.0015 on the cell distance and 0.005 on SSIM.

```json
{
  "cellDistanceMax": 0.0763,
  "ssimMin": 0.4703
}
```

Two questions the thresholds cannot answer are asked elsewhere. `npm run nudge` moves the camera 2 mm from three poses at two device pixel ratios and bounds how much of the frame may change drastically, because a still camera renders the same frame every time and the user's flicker lived entirely in the movement.

A third, added 2026-09-06: every scored gate here shoots one viewport at one device pixel ratio, and the post chain can hand back a black frame from the *size* alone. `npm run blackframe` loads the scene at six window size and ratio combinations, including non-round ratios, measures each on load and after a resize, and fails when the frame is too dark, has a blacked-out tile, is flat, or has lost most of the light the plain renderer sees. Nudge could not see it and never could: it scores how much the frame *changes*, and a black frame is the most stable frame there is.

The animation adds a third: the shot is one frame, and the scene moves. `npm run animation` scores seven frames across the wind's period and asserts the worst of them against these same thresholds plus 0.002 of cell distance and 0.006 of SSIM. The spread it measures is in the phase 5 devlog.

## History

| Phase | Date | Cell distance | SSIM | Draw calls | Median frame (GPU) | Notes |
| ----- | ---- | ------------- | ---- | ---------- | ------------------ | ----- |
| 1 (first block-out) | 2026-09-05 | 0.1438 | 0.1368 | 81 | | first render of the block-out, before any tuning |
| 1 (before critic) | 2026-09-05 | 0.0940 | 0.2929 | | | camera and every landmark tuned with the overlay and the per-cell ranking |
| 1 (done) | 2026-09-05 | 0.0941 | 0.2950 | 128 | 1.10 ms | after the critic's fixes (pot and side steps unhidden, shrubs and strands to plan, flat landing, hill gradient grid) |
| 2 (paving only) | 2026-09-05 | 0.0936 | 0.2969 | | | instanced slabs on stairs, gutter, landing, street, side stair, platform |
| 2 (all modules, before fixes) | 2026-09-05 | 0.0977 | 0.3083 | | | roofs whose slope runs toward +x had their tiles under the board (normal flipped) |
| 2 (before critic) | 2026-09-05 | 0.0899 | 0.3187 | 185 | 1.80 ms | stone, kawara, wood, lattices, noren; right eave stepping down the street; house 1 eave at 6.6 m |
| 2 (critic 1 fixes, first pass) | 2026-09-05 | 0.0942 | 0.2963 | 183 | | the placement fixes removed the canopy's light near section, raised the annex wall above the canopy, hung a lantern in a dark cell and dropped the corner block |
| 2 (after critic 1) | 2026-09-05 | 0.0903 | 0.3190 | 200 | 1.00 ms | canopy restored with the awning as a sheet on it, annex wall kept under the canopy, a dormer in the corner, low wall cap flattened, house 3 wall set back under its eave, stones proud of their mortar |
| 2 (after critic 2) | 2026-09-05 | 0.0901 | 0.3270 | 202 | 1.00 ms | sign on a bracket at house 3's corner, awning clear of the tile crests, dormer a wedge on the mezzanine, the wall notch faced in stone, gutter mortar stepped, a lattice window under the awning |
| 2 (done, after critic 3) | 2026-09-05 | 0.0899 | 0.3273 | 203 | 1.0 to 1.5 ms | fence roof corners clipped on one signed diagonal each (hips and valleys, boards cut the same way), walkway band behind the notch stones, window rail under the canopy, curbs on the mortar; a post under house 1's overhang was tried and cost 0.008 of SSIM, so it is not there |
| 3 (first cherry) | 2026-09-05 | 0.0921 | 0.3642 | 196 (shot) | | the block-out replaced: spline limbs, 640 strands, blossom cards colored from the photo's canopy field, pines, far houses, hill surface, mountain layers, person; the pines too tall and the canopy's sun-lit top missing from the mask |
| 3 (mask and pines fixed) | 2026-09-05 | 0.0853 | 0.4176 | | | sun-lit top and lavender strand ends counted as blossom, pines lowered, the annex's near door red and clear of the stone wall's end |
| 3 (before critic) | 2026-09-05 | 0.0855 | 0.4160 | 204 | 2.6 ms | the lamp post and trunk kept clear of blossoms and stems, the hill textured with cellular tree crowns; placement gate on 18 landmarks in npm test |
| 3 (critic fixes, first pass) | 2026-09-05 | 0.0908 | 0.3469 | | | the new hillside band rose into the mountains' rows; the pines moved to the hillside beyond the bend, limbs and stems clipped, ground under the far houses |
| 3 (after critic 1) | 2026-09-05 | 0.0854 | 0.4017 | 208 | 2.8 ms | hillside kept short, limb tubes ending inside the blossom, strand-end cells pink at their own lightness, blossom hues clamped to pink, tube winding outward, every material through the factory, a far-street check added (19 landmarks) |
| 3 (done, after critic 2) | 2026-09-05 | 0.0844 | 0.4159 | 211 | 1.3 ms | ground strips out of the frame, the far houses off the paving with dark walls below their gables, the shrub standing on the walkway behind the fence's jog, the pines' whorls down to the ground |
| 4 (lit, first pass) | 2026-09-05 | 0.4122 | 0.0287 | | | the tone curve inverted with the wrong constant (three divides by 0.6, the port multiplied), so every color came out washed |
| 4 (curve fixed) | 2026-09-05 | 0.1158 | 0.3719 | | | the rig's directionality overwriting the photo's baked shading: up-facing paving blue, camera-facing walls dark |
| 4 (rig rebalanced) | 2026-09-05 | 0.0976 | 0.3904 | | | most of the irradiance moved to a neutral ambient, the hemisphere's tint cut to 0.14 |
| 4 (glare tamed) | 2026-09-05 | 0.0841 | 0.4187 | 316 | 5.3 ms | bloom from 0.24/1.05/0.6 to 0.10/1.6/0.35: the first settings washed the hill beside the sun and cost 0.013 alone |
| 4 (before critic) | 2026-09-05 | 0.0825 | 0.4301 | 316 | 3.4 ms | backlit translucency through the blossoms, a limb over the machiya's eave filling the photo's canopy at u 0.75-0.83, finer hill crowns |
| 4 (done, after critic) | 2026-09-05 | 0.0820 | 0.4338 | 316 | 2.8 ms | the rim term's sign fixed so its main lobe fires, the ridge's glare confined to the sun's own column, the cirrus thresholds lowered until the clouds show in the scored view, the fog color inverted like every other mean, black fringes lifted off the alpha-tested cards |
| 5 (animated) | 2026-09-05 | 0.0820 | 0.4340 | 318 | 3.7 ms | wind through the canopy, petals, cloud drift, lantern sway, all in the vertex shaders |
| 5 (sky blue) | 2026-09-05 | 0.0816 | 0.4338 | | | `skyTopBlue` replaced by the photo's own top row (#9bc4e4) |
| 5 (before critic) | 2026-09-05 | 0.0812 | 0.4389 | 318 | 3.7 ms | the landing shading into the bend as the photo does |
| 5 (after critic) | 2026-09-06 | 0.0813 | 0.4385 | 316 | 2.6 ms | the animation gate given a motion bound that a fourteen-fold sway fails, the swaying strands and petals taken out of the shadow pass (they cast still shadows), CI trimmed to three frames; animation spread over 7 frames 0.0001 cell and 0.0005 SSIM, motion 0.18 levels |
| 5 (done, user's flicker fixed) | 2026-09-06 | 0.0811 | 0.4411 | 316 | 3.2 ms | eight requested multisamples and a 1.2x supersample resolved down, for the shimmer the user reported while orbiting; the scores moved because the same resolve runs in the scored shot, which is what the page does too |
| loop iteration 1 (before critic) | 2026-09-10 | 0.0769 | 0.4548 | 317 | | the machiya's plinth and house 1's eave split near/far, house 1's top roof lowered 17 cm off the photo's sky, the mezzanine and dormer darkened, the annex roof's tiles warm instead of blue-grey, the far houses' lower walls resampled, a plaster band added along the near house front |
| loop iteration 1 (done, after critic) | 2026-09-10 | 0.0768 | 0.4559 | 317 | 6.8 ms | the near eave's rafters lightened (the critic found the split's boundary is a diagonal in photo space, so the cell it was meant to fix was rafters, not fascia), the plaster band moved off the annex window's top rail and out of the awning check's 1.4 cm margin; thresholds tightened from 0.0825/0.436. Draw calls are the shot's 317; `npm run perf` reports 325 at 1920x1080 and 6.8 ms median, measured with about 40 other node and chromium processes on the machine, so that time is an upper bound and not comparable with the earlier rows |
| loop iteration 2 (before critic) | 2026-09-10 | 0.0754 | 0.4672 | 328 | | the machiya row that lines the right side of the far street, the landing repainted across the street, the lamp post re-read off the photo, and the platform's retaining wall unburied at the head of the stairs |
| loop iteration 2 (done, after critic) | 2026-09-10 | 0.0748 | 0.4753 | 326 | 6.1 ms | the critic found the landing's two slab sets reading as a sawtooth tear and an unmeasured PRNG reseed of two walls in the photo view: the landing became one set with a per-slab ramp across the street, and the platform wall went back to its original place with its new courses on a PRNG of their own. Thresholds tightened from 0.0783/0.4509. Draw calls are the shot's 326; `npm run perf` reports 336 at 1920x1080 |
