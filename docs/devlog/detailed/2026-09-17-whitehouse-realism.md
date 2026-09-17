# 2026-09-17 — the White House realism session: what was believed, and what the measurement killed

Six commits in this session's range, `4d7cdbf` to `2f1de21`, took the White House scene's scored pair from
0.1040 / 0.4136 to 0.0949 / 0.4207 and its realism readings from detail 0.561 and edge 0.385 to 0.893 and
0.860. This is the
session's record for a later session: the five hypotheses that were believed and disproved with the
measurement that killed each one, what a reviewer caught that the worker missed, the numbers that moved and
from what, and the two extensions this scene made to the repo's shared surface. Paragraphs are one line
each and the handoffs carry the full tables; `out/wh/` holds the evidence.

## Believed and proved false

**1. That `RIG.shadowNormalBias` (0.6 m against rakes 0.42 m thick) was why the porch could not be shaded.**
The closing handoff had left this as its own first thing for a critic, with the value as a one-number
experiment, and the brief for pass A opened on it. It was bisected over three renders — 0.30, 0.15, 0.05 —
and **no porch surface moved**: the column shafts read 159 / 159 / 159, the tympanum 125 / 125 / 124, the
recess wall 79 / 79 / 79, across a 6x sweep. `src/whitehouse/lighting.js` was reverted byte-clean. The
mechanism that makes the lever irrelevant is a per-surface light decomposition with one light pulled at a
time (`out/wh/scratch/wh3shaftlight.txt`): the porch is lit about 97% by the two hemisphere lights plus the
PMREM environment map, and **the sun carries 2-8 luma of a surface standing near 100**, so any shadow lever
moves at most that. What does move those tones is `occlusion` in `src/materials.js` — and it is
name-inverted, `albedoOf` dividing by `irradiance * occlusion`, so RAISING the value DARKENS the surface.
Tympanum 0.44 -> 0.65 lands its mean exactly on the photograph's 98 (0.70 overshoots to 93) and the column
shafts 0.55 -> 0.85 take the shafts ratio from 1.41 to 1.12 with no other surface moving. Evidence:
`out/wh/pass-a-handoff.md` §1-§3.

**2. That the photograph's mowing passes run parallel to the building, so the lawn wanted stripes.**
Row autocorrelation at five rows found **no periodic wiggle at all**, and high-passes of the photograph's
lawn at 6 px and 24 px show blade speckle with **no stripe edges in any direction**. The mowing field that
had been built (19 m pitch, four tints) was not what the photograph shows at any scale this frame resolves;
the lawn's own sd was 2.77 against the photograph's 29.50 and its mean |gradient| 0.124 against 23.47, i.e.
a flat field, and the thing that closed that gap was a blade-scale texture, not a stripe field. The mown
mask stayed untouched. Evidence: `out/wh/pass-c-handoff.md` §"what this brief got wrong" and
`out/wh/pass-c2-handoff.md` §5.

**3. That the rooftop blocks were merging tonally with the pediment.** The colours were plausible on paper —
`COLORS.roofBlock` `0x818d9a` against the trim's `0x8a94a2` — and measurably not the cause: the render's own
block face reads `#76818b` against the photograph's `#818d9a`, comfortably separate in the same frame. The
blocks were **OCCLUDED**, by the portico's raking cornices, whose `pediment()` seating put each rake's
upper-inner corner at `yApex + rake / 2` = 18.11 m over a 1.90 m gable so that **the two rakes crossed
0.35 m above the apex and their crossed tips were the pediment's top edge**. The ray listing named them:
at (u 0.44, v 0.312) the first hit was `north portico pediment rake west` at (-3.6, 17.5, 6.5) and at
(u 0.48, v 0.302) the same rake at (-1.2, 17.9, 6.5); the pediment's silhouette read flat at v 0.3044-0.3122
where the photograph descends. Seating the rakes on the apex and measuring the rake's outer end
(`RAKE_HALF_WIDTH = 9.0`) closes the spike and the silhouette descends 0.3189 -> 0.3044. Evidence:
`out/wh/pass-g-handoff.md` §3b, §6, §7.

**4. That the lawn's cell-distance cost was the speckle map's one-sidedness, and that a symmetric map would
fix it.** Pass C's map clamped 43% of its texels at byte 255, so its distribution was darkening-only, and
the brief's prescription was a symmetric map with mean 0.85 in [0.6, 1.0]. Built and rendered, **the
symmetric candidate scored WORSE: 0.1101 against pass C's 0.1055.** The attribution tool
(`out/wh/scratch/whattr.mjs`, the metrics' own 24x22 cells partitioned by region) had already said the cost
was not local-mean jitter, which is 1-3 luma levels per cell: it put **85% of the whole regression on the
120 lawn cells** as a per-channel offset at a nearly constant luma (a 0.05 cell distance at constant luma is
22 levels of channel offset against 1.5 of luma). The five-state hue probe found the cause: one fitted
scalar (5.87) on top of **three unequal per-channel tone-curve ratios, 0.780 / 1.153 / 0.160**, which lands
red, green and blue in three different places on the tone curve — the lawn lost 34 of its 47 blue levels
(`#56750d` against the flat lawn's `#6f762f`). The fix is derived rather than fitted,
`albedoScaleOf(LAWN_BASE) / mean x [1.06653 x 0.91, 1.05874, 1.03092 x 0.60]`, and with the hue back the
texture could be free: 0.0975 / 0.4138, detail held at 0.905 and edge at 0.863. Evidence:
`out/wh/pass-c2-handoff.md` §1-§4.

**5. That a post-handoff tidy-up was harmless.** Pass B shipped `leafSpread` at 1.75 and, after the handoff,
"tidied" it to **1.50** with the comment rewritten. That single unverified change tripped `blackframe` on
**five of the twelve views** — a 160x90 tile 98.8% near-black against the gate's 98% limit, 7,120 of 7,200
pixels solid black. What proved the limit right rather than mis-calibrated is the photograph read through
the gate's OWN statistic (the luma weights, grid, dark threshold and denominators imported from
`tools/blackframe.js` rather than retyped): `whitehouse.webp`'s own darkest tile is **64.0%** near-black and
its next darkest are 88.3 / 86.8 / 59.7 / 57.5, so 98% is 34 points above anything the subject produces.
`leafSpread` is **2.10**, which clears the worst of the twelve rows at 95.2% instead of 1.75's 0.2-point
margin, for 1.6e-5 of cell distance and 4.0e-5 of SSIM — under the repo's own 0.0010 noise floor — and it
moves the frame's below-16 toward the photograph rather than away. Evidence: `out/wh/pass-h-handoff.md`
§1-§3.

## What a reviewer or coordinator caught that the worker missed

**The coordinator's doubt about the missing blocks.** Pass G's brief came from a coordinator who looked at a
crop and did not believe the two white rooftop blocks were rendering, and asked for the question to be
settled with a tool instead of an argument. The worker's first instinct — the tonal-merge explanation, which
the code's own colours supported — was wrong, and it was the ray listing the coordinator's question forced
that turned it into the occlusion finding (item 3 above). This is the session's clearest instance of a
question asked from a render being worth more than a hypothesis defended from the source.

**The south-rim void that a "must not move a pixel" instruction wrongly forbade.** Pass F/E's brief said the
ground-void fix lay outside the photo view, so both scores must be unmoved. That is true of the x and north
rims — the widening is byte-identical on the scored frame — and **false for the south one**: the south
lawn's far edge IS where the frame draws its horizon, so the band of sky the frame showed below its own true
horizon was this same defect in the scored view, and closing it changed 2,185 pixels of 1,080,000 (rows
460-516, cols 54-154 and 1045-1083 either side of the building) while improving both scores. The
coordinator authorized closing it on a measured condition rather than leaving it, which is the correction:
an instruction that a change lies outside the frame is a claim to be measured, not a boundary to obey.

## The numbers that moved, and from what

Scores, each a real `npm run shot` + `compare`: **0.1040 / 0.4136 -> 0.1019 / 0.4151** (pass A, the porch's
tones) -> **0.1009 / 0.4198** (pass G, the measured roofscape and the rake seating) -> **0.1055 / 0.4151**
(pass C, the speckle, a regression) -> **0.0975 / 0.4138** (pass C2, the per-channel colour) ->
**0.0949 / 0.4207** (pass B, the crowns) -> **0.0949 / 0.4207** (pass F/E and H, the terrain and the
crowns). The thresholds tightened twice in the day, 0.1066 / 0.3877 -> 0.1061 / 0.4086 -> **0.0968 / 0.4157**,
both times toward the achieved score and never away from it.

The realism numbers, by `node out/critic/measure.mjs whitehouse.webp out/wh/render.png`: detail 0.561 ->
**0.893**, edge energy 0.385 -> **0.860**, luma p5 ratio 1.91 -> **1.07** (the tree pass landed it exactly,
1.0026, the groundcover pass moved it to 1.06, and the crown correction blackframe required settled it at
1.07), pixels below luma 16 5.71% -> **6.94%** against the photograph's 6.86%, and luma p1 ratio 1.07 ->
**2.64**, the one line that moved away. The two instruments are not interchangeable: `measure.mjs` compares
at the photograph's own 600x550 and reads the shipped frame 0.893 / 0.860, while `out/wh/scratch/real.mjs`,
the arm checker used inside the passes, compares at 600x450 and reads the same frame 0.88 / 0.78.

## The two shared-surface extensions this scene made

**`tools/groundcover.js`'s GATES entry, with its scene list.** It is registered scene-scoped to
`whitehouse` — `['tools/groundcover.js', ['groundcover:'], ['whitehouse'], "<reason>"]` — so it runs in
`npm test` for this scene and is skipped for every other scene with its reason printed, the same generic
skip path scene 1's four gates already take here and this gate takes in a scene 1 run. Its reason is that
the slabs it sweeps and the camera clamp its extent comes from are this scene's own, and scene 1's world is
a 30 m street whose ground is not a ground-cover question. The `skippable` count in `tools/test.js`'s
"established nothing" guard went 5 -> 6. No scored metric can see this class of defect — `compare` reads sky
through a hole as just another colour — which is why the gate counts rays instead, and why the pass that
first closed a 40.6 m by 1040 m trench moved both scores the right way for unrelated reasons.

**The `package.json` script line.** One line, `"groundcover": "node tools/groundcover.js"`, because every
other tool in `tools/` has one and a gate nobody can run by hand is a gate whose failure text nobody reads.
It is the whole of this scene's change to `package.json`; the other shared-file edits are one entry and one
header sentence in `tools/test.js`.

## What a later session should not have to rediscover

`docs/work/2_white-house-scene/scores.md` holds the score history, the thresholds and the realism table;
`docs/work/2_white-house-scene/plan.md` holds the status log and the open list, whose first item — the
pediment's eave cornice drawn at the portico's full width where the photograph's gable base is narrower —
is the one measurement this session deliberately left open because both arms move the photograph's own eave
row. The instruments named here are scratch under `out/wh/scratch/` except `out/critic/measure.mjs`, and
`out/` is git-ignored.
