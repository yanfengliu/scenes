# The White House scene's scores

`SCENE=whitehouse npm test` asserts the two numbers below against this file's single json block, the way
`npm test` asserts scene 1's against `docs/PLAN-scores.md`. The thresholds follow the same rule scene 1's do:
they move toward the achieved scores at the end of an iteration, they are never loosened to make a red gate
green, and a worse score is a regression to fix rather than a reason to raise a limit.

THIS FILE HOLDS EXACTLY ONE FENCED JSON BLOCK, and it is the thresholds: tools/test.js takes the FIRST block
it finds, so a second one above it is read as the thresholds and fails with a JSON parse error naming a word
from the prose — which is how this file failed the first time it was run. A table or an example belongs in an
indented block, not a fenced one.

Both metrics are computed by `SCENE=whitehouse npm run compare`, which scores `out/wh/render.png` against
`whitehouse.webp`. See `tools/lib/metrics.js` for what each can and cannot see.

| | Cell distance | SSIM |
| --- | --- | --- |
| Blockout, first frame | 0.1981 | 0.1398 |
| Tonality and facade pass | 0.1428 | 0.1223 |
| Tree line reworked for the orbit views | 0.1448 | 0.1262 |
| Occlusion term, pediment, hedge, trees | 0.1240 | 0.2845 |
| World layout corrected: the north grounds were behind the wall | 0.1138 | 0.3519 |
| Porch interior, capitals, pediment rise | 0.1045 | 0.3927 |
| Grounds: a hole to the sky closed, and the mowing passes re-measured | 0.1040 | 0.4136 |

## A hole to the sky, which no scored number could see

The blue band that appeared across the grounds in the orbit views was not a mesh with the wrong colour. NO
ground existed between the north lawn's south edge at z 0 and the south lawn's north edge at z -40.6, so a
40.6 m by 1040 m trench ran the width of the scene with only the building's own footprint in it, and the blue
was the sky dome seen through the gap. Downward rays on a 20 m grid found 718 of 1995 cells with no ground.

Two things about that are worth keeping. The scored frame could not see it: the trench lies behind the
building from the photo view, so neither score moved for it, and the pass that closed it moved both scores the
right way for unrelated reasons -- a metric can improve while the scene is broken somewhere the metric does
not look. And the instrument that caught it was not a photograph comparison at all: it was a top-down
orthographic render (`out/critic/topdown.mjs`) plus a raycast grid, the same two that had found the
inverted-row layout error an hour earlier.

## The layout fix, the largest single correction in this scene's history

Every feature of the north grounds was authored from an inverted photograph row, by two compounding errors:
the row-to-distance constant was the one for the terrace's plane rather than the lawn's, and the world z was
written as `dn - 47.863` instead of `47.863 - dn`. The bed, the fountain, the drive and the fence were built
one building-length BEHIND the north wall, the portico's columns sat INSIDE the wall, and the south lawn slab
-- the only ground on the camera's side -- was the whole foreground of the photo view.

Two more defects that hid behind the same symptom: the mowing passes west of centre were painted pure black
(`passTint` indexed `[-1]`, and a hex multiplied by `undefined` becomes `NaN`, whose `<< 16` is 0), and the
drive was 40 flat boxes floating 1.9 m clear at their near ends. Both were in the frame's bottom third.

The lesson is worth keeping: a calibration landmark can be exact while the world around it is wrong. Four
landmarks landed on their photograph rows to 0.00 px for three passes while the grounds were on the wrong side
of the building, because all four are on the wall's own plane. What caught it was rendering the scene from
directly above (`out/critic/topdown.mjs`) and probing the objects' own bounding boxes — not any scored
number, and not any of the crops taken from the photograph's own viewpoint.

## What the numbers mean here, and what they do not

Scene 1 reads 0.0571 / 0.5856 after its own iteration 6. The two are not comparable subjects and the gap is
not a like-for-like measure of quality: scene 1 is a dark, cluttered, high-frequency frame, and this one is a
white building under a bright sky where a single exposure error moves every cell at once and where more than a
third of the frame is lawn and sky at flat tones. A white building is the hardest subject this pair of
metrics can be given.

The scores are also blind to the thing the owner asked for. `out/critic/measure.mjs` measures it instead, on
the render against the photograph: detail as a high-pass luma standard deviation, edge energy, and the
near-black coverage. Across this session those moved detail to 0.53 of the photograph's, edge energy to 0.36,
luma p5 from 84.0 to 12.6 against the photograph's 7.5, and pixels below luma 16 from 1.9% to 5.9% against
the photograph's 6.9%. A render whose fifth-percentile pixel is a mid grey has no shadows, and no
cell-distance score can say so.

```json
{
  "cellDistanceMax": 0.1061,
  "ssimMin": 0.4086
}
```

The margins are scene 1's: 2% on cell distance and 0.005 on SSIM, below the 0.0010 cross-machine SSIM noise
floor the repo measured on scene 1 and well above the run-to-run spread this scene has shown. They have moved
from 0.1477 / 0.1212 to here across this session's passes, which is the rule working as intended: thresholds
follow the achieved scores down, and are never raised to make a red gate green.
