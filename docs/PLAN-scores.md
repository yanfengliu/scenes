# PLAN scores (implementer-owned)

`npm test` reads the thresholds from the JSON block below and fails when a score is worse. At the end of each phase the implementer sets the thresholds to the achieved values minus a small margin and records the phase's numbers in the history table. Thresholds only tighten; a worse score is a regression to fix, not a threshold to loosen.

Scores are printed by `npm run compare` (see `tools/lib/metrics.js` for what each one can and cannot see):

- `cellDistanceMax`: mean color distance over a 24x22 grid of cells between `japan.webp` and `out/render.png`, 0 to 1, lower is better.
- `ssimMin`: grayscale SSIM at 64 px wide, -1 to 1, higher is better.

The margin covers rasterization differences between machines (anti-aliasing, SwiftShader versions); the same machine reproduces the numbers exactly.

```json
{
  "cellDistanceMax": 0.093,
  "ssimMin": 0.32
}
```

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
