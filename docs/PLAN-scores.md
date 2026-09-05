# PLAN scores (implementer-owned)

`npm test` reads the thresholds from the JSON block below and fails when a score is worse. At the end of each phase the implementer sets the thresholds to the achieved values minus a small margin and records the phase's numbers in the history table. Thresholds only tighten; a worse score is a regression to fix, not a threshold to loosen.

Scores are printed by `npm run compare` (see `tools/lib/metrics.js` for what each one can and cannot see):

- `cellDistanceMax`: mean color distance over a 24x22 grid of cells between `japan.webp` and `out/render.png`, 0 to 1, lower is better.
- `ssimMin`: grayscale SSIM at 64 px wide, -1 to 1, higher is better.

The margin covers rasterization differences between machines (anti-aliasing, SwiftShader versions); the same machine reproduces the numbers exactly.

```json
{
  "cellDistanceMax": 0.099,
  "ssimMin": 0.29
}
```

## History

| Phase | Date | Cell distance | SSIM | Notes |
| ----- | ---- | ------------- | ---- | ----- |
| 1 (first block-out) | 2026-09-05 | 0.1438 | 0.1368 | first render of the block-out, before any tuning |
| 1 (before critic) | 2026-09-05 | 0.0940 | 0.2929 | camera and every landmark tuned with the overlay and the per-cell ranking |
| 1 (done) | 2026-09-05 | 0.0941 | 0.2950 | after the critic's fixes (pot and side steps unhidden, shrubs and strands to plan, flat landing, hill gradient grid); 128 draw calls |
