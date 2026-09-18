# The White House scene's scores

`SCENE=whitehouse npm test` asserts the two numbers below against this file's single json block, the way
`npm test` asserts scene 1's against `docs/PLAN-scores.md`. The thresholds started from scene 1's rule and
have followed this scene's own achieved scores since: they move toward the achieved scores at the end of an
iteration, they are never loosened to make a red gate green, and a worse score is a regression to fix rather
than a reason to raise a limit. They have tightened three times on 2026-09-17 alone, 0.1066 / 0.3877 to
0.1061 / 0.4086 to 0.0968 / 0.4157 to 0.0925 / 0.4399.

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
| Porch tones: the columns' and the tympanum's occlusion | 0.1019 | 0.4151 |
| Roofline: the measured roofscape, and the pediment's raking cornice | 0.1009 | 0.4198 |
| Lawn blade speckle, and the colour path that was eating its hue | 0.0975 | 0.4138 |
| Trees: 150 and 175 facet-toned lobes | 0.0949 | 0.4207 |
| Ground voids gated, the terrain mended, and the crowns corrected | 0.0949 | 0.4207 |
| The apron sourced: a step, not a ramp | 0.0950 | 0.4206 |
| Pediment rakes rebuilt, three parts at one width | 0.0954 | 0.4196 |
| The frieze narrowed to the photograph's 8.13 m | 0.0952 | 0.4199 |
| The north wall given real apertures | 0.0923 | 0.4363 |
| Eleven bays re-spaced to the photograph's own centres | 0.0916 | 0.4494 |
| The flower bed rebuilt as a mass | 0.0921 | 0.4316 |
| The bed's west-east gradient removed | 0.0907 | 0.4449 |

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
near-black coverage. A render whose fifth-percentile pixel is a mid grey has no shadows, and no cell-distance
score can say so — at the start of today's session the frame's detail was 0.561 of the photograph's, its edge
energy 0.385, and its fifth percentile 1.91x the photograph's, while both scored numbers were inside their
thresholds. The section below has the whole table.

## The session's realism numbers, which no scored metric can see

Both scored numbers are 24x22 cell means and a 64 px grayscale SSIM, so a frame can gain on them while
getting flatter. The instrument that watches the other thing is
`node out/critic/measure.mjs whitehouse.webp out/wh/render.png`, and these are its readings before the
session's realism passes and on the shipped frame. A ratio of 1.0 is the photograph; detail and edge move
toward it, the p1 and p5 ratios are the render's percentile over the photograph's, and below-16 is coverage.

| measurement, render over photograph | before | shipped frame | what it was |
| --- | --- | --- | --- |
| detail (high-pass luma sd) | 0.561 | **0.905** | a flat render reads 0.4; the lawn's blade speckle, the facet-toned crowns and the facade's real apertures are most of the gain |
| detail at 64 px wide | — | **0.897** | the same measure at the gate's own SSIM scale; it was 0.861 when the facade phase opened |
| edge energy (levels/px) | 0.385 | **0.896** | the same passes, measured as mean absolute gradient |
| luma p5 ratio | 1.91 | **1.12** | the tree pass landed it on the photograph's own row (1.0026) from 1.91 and the crown correction blackframe required settled it at 1.07; the bed rebuilt as a mass crossed it to 0.91, and the pass that removed the bed's west-east gradient brought it back to 1.12 |
| pixels below luma 16 | 5.71% | **6.98%** | the photograph's own coverage is 6.86%; the bed's two passes moved it 6.97 -> 7.26 -> 6.98, and the frame's dark end is now within 0.12 of it |
| luma p1 ratio | 1.07 | **2.57** | the one line that moved away, and the frame's remaining black-end residual: the darkest 1% is 2.57x the photograph's |
| luma p99 ratio | — | **1.009** | the bright end matches the photograph's to 0.9% |

Across the facade phase the shipped frame moved detail **0.893 -> 0.905** and edge **0.861 -> 0.896**, both
toward the photograph, and below-16 **6.97% -> 6.98%**; the p5 ratio crossed from 1.07 to **0.91** on the
pass that rebuilt the flower bed as a mass and back to **1.12** on the pass that removed its west-east
gradient, and the p1 ratio came 2.64 -> 2.57. The phase's two scored numbers moved 0.0952 / 0.4199 to
0.0907 / 0.4449, and the detail and edge gains are the wall's real apertures and the re-spaced bays showing
up in a metric the 24x22 cell grid cannot see.

The p1 line is the one to read with the p5 line: the frame's 5th percentile is 12% light of the photograph's
while its 1st is 2.57x it, so the shadow floor is right in mass and too light in its very darkest pixels --
and the pass that removed the bed's gradient measured where those pixels are: 53.5% of the 5% below p5 sit
in two cells at the frame's own edges, the framing trees, and not the bed. Note that the two instruments
disagree at the third digit on purpose and not by accident — `measure.mjs` compares at the photograph's own
600x550, and `out/wh/scratch/real.mjs`, the arm checker used inside the passes, compares at 600x450 and reads
the same frame as detail 0.88 and edge 0.78. A number quoted from one is not a number from the other.

```json
{
  "cellDistanceMax": 0.0925,
  "ssimMin": 0.4399
}
```

The margins are scene 1's: 2% on cell distance and 0.005 on SSIM, taken off this scene's own achieved
0.0907 / 0.4449 -- the best pair the scene has recorded, from the pass that removed the flower bed's
west-east gradient -- so the block above holds 0.0925 / 0.4399. Both lines are tighter than the
0.0968 / 0.4157 they replace, and they sit below the 0.0010 cross-machine SSIM noise floor the repo measured
on scene 1 and well above the run-to-run spread this scene has shown. They have tightened three times today
— 0.1066 / 0.3877 at the session's start to 0.1061 / 0.4086 once the porch, the roofline and the lawn had
moved the scores, then to 0.0968 / 0.4157 after the tree pass and the groundcover pass, and now to
0.0925 / 0.4399 after the facade passes and the bed's two — from 0.1477 / 0.1212 earlier in the scene's
history, which is the rule working as intended: thresholds follow the achieved scores down, and are never
raised to make a red gate green. Two earlier achieved pairs were left where they were rather than re-derived,
because re-deriving them would have been fractionally LOOSER on both lines: the apron pass's 0.0950 / 0.4206
(0.0950 x 1.02 = 0.0969 and 0.4206 - 0.005 = 0.4156) and the pediment-rakes pass's 0.0954 / 0.4196
(0.0954 x 1.02 = 0.0973 and 0.4196 - 0.005 = 0.4146). This repo never loosens a limit, which is why only the
best pair moves them.
