# 2026-09-17 — the White House facade phase: what was believed, and what the measurement killed

Nine commits in this phase's range, `7160e73` to `f6686a4` plus the deploy fix `00b645e`, took the White
House scene's scored pair from **0.0952 / 0.4199** to **0.0916 / 0.4494** and its realism readings from
detail 0.893 and edge 0.861 to **0.910** and **0.885**. This is the phase's record for a later session: the
four hypotheses that were believed and disproved with the measurement that killed each one, the two places
the coordinator's own briefs were wrong and who caught them, the circularity that was found and fixed in
the calibration, the storey chain that is left open, and the deploy defect with its gate. Paragraphs are one
line each and the handoffs carry the full tables; `out/wh/` holds the evidence.

## The shape of the phase, and the two changes that moved the score

The phase's work is nine commits, and only two of them moved the scored pair in the right direction in a way
anything can see: **the wall had no apertures** (`634ecd5`) and **the eleven bays were not evenly spaced**
(`f6686a4`). Everything between them either corrected a record nobody had checked — a projection comment, a
band table, an index table, a storey chain — or removed a member that was standing in front of something the
photograph shows.

The rest of the facade work is one member at a time, because that is what the frame actually contains: the
pediment's rakes (`7160e73`), the frieze that was occluding the roof band (`7f0730e`), then the openings,
then the spacing of the openings. The pattern is the same in every one of them: a small, measured, boring
defect in the geometry was doing all the damage, and the tone of the render was the symptom rather than the
disease. The phase's own best evidence for that is the paint test in `out/wh/scratch/pass-j-paint.mjs`,
which is also the phase's one instrument correction — see below.

## Believed and proved false

**1. That the "raking cornices" were raking cornices (`7160e73`).** They were **two coincident horizontal
slabs**. `pediment()` handed the near and far passes the same `y`, `rise * (1 - rakeOuter / halfWidth)`, so
the slope term vanished and both `side` iterations of the loop placed the identical box: `roofline-bbox.mjs`
returned `rake west box -9.08,15.73,0.10 .. 9.08,16.15,6.50` and the **byte-identical** box for `rake east`,
18.16 m wide and 0.42 m tall. The frame showed it before the code did: the render's top edge dipped to v
0.3367 at u 0.4850 and then jumped to 0.3044 at u 0.4975, which is a tympanum triangle crossed by a flat bar
and not a gable. Each rake is now a box laid on the segment from its measured foot on the eave to the apex,
with its upper-outer face exactly on that segment, so both calibrated rows are untouched and the mitre closes
on the apex block. Evidence: `out/wh/pass-i-handoff.md` §1, §2.6, §7.1.

**2. That the photograph's rakes are 60 % steeper than the model's, and that the pediment wanted a 3.05 m
rise (`7f0730e`).** The brief carried `-0.512` as the rake's image slope, i.e. 0.384 world over the measured
7.9 m foot, i.e. 3.05 m of rise, and sent the pass to build it. It was a **CLOUD EDGE**. The 0.512 was fitted
over a 0.0575 u window (u 0.4375-0.4950) in which the first non-sky pixel is cloud, and the tool's own
residuals there are **rms 14.36 px** with a systematic S-shape. Fitted over the whole cloud-free band (u
0.4250-0.4975 west and 0.5075-0.5750 east) the dark band's own centre line gives image slopes -0.268446 and
+0.265341, i.e. **0.267**, and the residuals collapse. Through `A/B = AY/AX = 0.7502` that is a **world
slope of 0.20** — **shallower** than the model's 0.24, not steeper. Nothing was changed: the apex stays
17.90 m and the eave 16.00 m, and the residual at u 0.44 is 6 px and at u 0.48 is 3 px, inside this
photograph's own noise. **Had the brief's 3.05 m been built, the eave would have dropped to 14.85 m, below
the architrave's own top at 14.40 m plus the frieze, and the pediment would have swallowed the
entablature.** Evidence: `out/wh/pass-i2-handoff.md` §1, §8.2.

**3. That the photograph's window columns were 13 % finer than the code's bay pitch (`634ecd5`).** They were
**sash panes**. A 2.10 m sash is **45 px** at this camera and the runs the previous pass measured were
**24-25 px** at a 0.013-0.016 u pitch — one column of panes of a six-over-six sash, because a muntin is
0.055 m = **1.2 px**. The error was reproduced before it was corrected: this pass's own first scan
(`out/wh/scratch/pass-j-cols.mjs`) made the same mistake and returned the same 24-px runs, which is what had
made the "13 % finer pitch" look solid. `out/wh/scratch/pass-j-winscan.mjs` smooths a whole glass band with a
13-px box filter (13x the muntin) and takes the dark runs of the smoothed row: **eight whole windows**, west
0.1708 / 0.2300 / 0.2892 / 0.3488 and east 0.6538 / 0.7137 / 0.7725 / 0.8325, a pooled pitch of **4.1045 m**
(4.0964 west, 4.1125 east), mirror-symmetric about u 0.5015 to 0.0003 u. The instrument was checked on the
render it is applied to: the render's eight windows come back at pitch 0.0673 u against the code's 0.0674, so
it reads a known pitch to 0.1 %. **Eleven bays was confirmed by the LAYOUT and not by the pitch**: the eight
visible windows sit at half-integer multiples of the pitch from the portico's axis, so the frame's central
axis is a PIER between two windows, which is what a portico over three bays does. Evidence:
`out/wh/pass-j-handoff.md` §3, §6.2.

**4. That the wall ends were ~12 % too wide, and that the residual was a pitch error (`f6686a4`).** It was a
**LAYOUT** error, and the ends were right. Pass J's eight windows on a 4.1045 m pitch against the code's
uniform 4.6545 m (51.2 / 11) put the block's ends at ±22.575 m — 11.8 % narrower — and its own three
candidates were the wall ends, `DIMS.blockLength` and uneven bay spacing. All three were tested. The wall
ends were **measured off the photograph for the first time** by `out/wh/scratch/pass-k-corner.mjs`, which
scans each row between the parapet and the hedge crown for the first x of a 6-px run that is uniformly pale
and is preceded by a 25-level step — the sky-to-wall transition: the step sits at x 155-157 west (**u
0.1292-0.1308**) and x 1045-1048 east (**u 0.8708-0.8725**), so the photograph's own corner pier is
**2.76-2.89 m** against the calibrated ends' 2.87 m west and 2.77 m east and the plan's 2.74 m. The 51.2 m
block stands. Re-spacing the eleven bays onto the photograph's own centres — the outer four on its pitch, the
two half-bays beside the axis compressed to 1.1638 m, and the corner piers absorbing the difference at
2.7415 m — took the eight-window residual measured on the frames from **0.5556 m rms (9.66 px) to 0.0945 m
(1.64 px), -83 %, on the first floor** and 0.5547 m to 0.2229 m on the second. Evidence:
`out/wh/pass-k-handoff.md` §2, §3, §4.1.

**And the hypothesis the previous pass explained wrongly, which is the phase's central finding: that the
window tone was a tone problem.** Pass I4 measured the symptom correctly — mean luma inside the opening
over the wall beside it, render **1.02 / 1.01** where the photograph is **0.86 / 0.91** — and concluded the
glass was catching light it should not. **The wall had no apertures at all.** Every one of the north wall's
bands was a single box from -25.6 m to +25.6 m, 0.7 m thick, and the entire window — glass at z -0.60, the
reveal's returns, the sash, the architrave — was built **BEHIND** it, the trim's front face at z -0.40
against the wall's front at z -0.70. The surface in the measured box *was the wall*, and there was nothing
else there to see. What proved it is a paint test, and it is also the phase's instrument lesson: a live page
was loaded once, five material classes were repainted saturated colours through a patch of the scene graph,
and the frame was read back with `ctx.drawImage(renderer.domElement)` inside the same `page.evaluate` —
**every arm came back byte-for-byte identical**, including for surfaces that cannot be in the box. The
WebGL canvas read back inside the evaluate that rendered it is stale. `out/wh/scratch/pass-j-paint.mjs` now
screenshots by `page.screenshot` (the same path `shot` uses) and decodes on a separate inspector page, and
the first run of that version found the truth in one line: painting the glass, either reveal step and the
sash bars moved the opening by **0.0 luma**, while painting the wall's own middle band moved it **156 ->
223**. Evidence: `out/wh/pass-j-handoff.md` §1, §6.1.

## What the coordinator's own briefs got wrong

**The rake slope, and it was caught by the pass it was sent to.** The brief for the frieze pass carried
"an image slope of -0.512, which is 0.384 in world terms: 3.05 m of rise over 7.9 m" as a fact to build
from. It is a cloud edge (§2 above), the real slope is 0.20 world, and the pass it was sent to
(`out/wh/pass-i2-handoff.md` §8.2) measured the tool's own rms residual of 14.36 px over exactly the window
the figure came from. **The brief was wrong, the worker caught it, and the fix it prescribed would have put
the eave below the architrave.** The same brief's second claim — that narrowing the frieze would drag the
architrave (±9.38 m) and the inner soffit (±8.58 m) with it — is also not borne out: neither is ever the
first hit in front of the roof band, and narrowing the architrave was tried and measured as worse (local
mean |delta luma| 46.06 -> 46.43 and SSIM 0.4199 -> 0.4195), so it was reverted. What shipped is one number,
the frieze from ±9.43 m to the photograph's own **±8.13 m**, and it put the band on its own row: photo v
0.3711 `#090d1e` luma 14 against render v 0.3711-0.3778 `#0c0f19` luma 15, where the frieze used to read
`#929aa5` luma **153**.

**The five hypotheses the coordinator's briefs carried and the measurements killed.** Recorded together
because each one is a brief written from a render or a document rather than from the frame: the rake slope
above; the claim that `building.js` held "one more" wrong-sign projection form when it holds none (caught in
`615cb9d`, whose own commit message carries the false claim — `out/wh/pass-i3-handoff.md` §6.6); the claim
that the facade's heights were placed with the 11 %-small conversion when no code reads the table at all
(`4be0800`, `out/wh/pass-i4-handoff.md` §2); the claim that the outer windows "land exactly on the block's
corners (5.5 x 4.6545 = 25.6 m)", which has dropped a half bay — the uniform layout puts bay 1 at -23.273 m
and the measured corner pier is 2.74 m, i.e. 0.59 of a pitch against the code's 0.50 (`f6686a4`,
`out/wh/pass-k-handoff.md` §5.1); and pass J's own explanation of the window tone as a tone problem, which
is item 4 above. The pattern is worth keeping: in every case the measurement was cheap and the brief was
expensive.

## The circularity that was found and fixed

**`u 0.1292` — one of the two "calibrated" wall ends — had never been read off the photograph.** It is the
camera solve's own projection of the model's `-25.6 m` corner, so a residual against it is a residual against
the model. The anchor probe had never measured it: `out/wh/scratch/pass-j-anchors.txt` shows the tool reading
photo u **0.0765** and render u **0.1117** for the west end, both of which are **framing trees**, exactly as
pass I3 §4.1 said; its east reading is a tree or the terrace's return, and it fires on **cloud** for the
parapet and the pediment apex (photo and render both 0.3006 and 0.2406, which is the tool's own signature).
So of the eight calibrated rows, the probe resolves **four**, and the two that the whole calibration rests on
for the u axis were not among them. The circularity was found by pass J `634ecd5` and closed by pass K
`f6686a4`, which replaced the instrument rather than the number: `pass-k-corner.mjs`'s sky-to-wall step test
is a different measurement of the same landmark, it agrees with the calibration to about a pixel, and the
"ends 12 % too wide" hypothesis died on it. **The anchor tool was NOT fixed** and its wall-end and
cloud-reading rows are still worthless — a tool that reads the calibrated rows as `layout.js` defines them
is still unwritten, and that is an open item, not a closed one.

## The four record corrections, and the code that was already right

**`615cb9d` — the projection comment.** `portico.js`'s header stated `v = 0.5 - (y - 9.086) / (2 * 0.54092 *
(47.863 + z))`. The depth is `47.863 - z`: the sign was wrong and the form was missing nothing else, but the
consequence is not small. At the **wall plane (z 0) the two forms are algebraically identical**, which is
exactly why the calibrated wall-base and parapet rows never caught it: the error is zero there and grows in
both directions — 76.1 % of the right height at the portico's front plane (z 6.5), 152.8 % at z -10, 202.1 %
at the roof ridge — **+42.4 px at the pediment's apex**. **Two passes had reasoned from it.** The same sweep
found the wall plane's 1 m scale quoted as 0.01714 where **0.019312** is right (the comment implied a frame
58.34 m tall, 12.7 % too tall) and a horizontal factor of `1.5` in the frieze-end arithmetic where this
camera's `tanH / tanV` is **4/3** (`1.44246 = 2 * 0.54092 * 4/3`). **The CODE was always correct** and was
verified against the photograph's own landmarks rather than against the comment: the calibrated wall end u
0.1292 at z 0 is x -25.60 m under 4/3 — the published 51.2 m block — against -28.80 m under 1.5. The edit is
comment-only and the frame is **byte-identical** (`95dfb3f75068adc8`), proved by stripping every `//` from
both revisions and diffing. Evidence: `out/wh/pass-i3-handoff.md` §2, §3, §6.

**`4be0800` — the facade band table.** Its metres follow from **no scale**, and no code used it: every
facade height in `building.js` is a literal, and the four that are also printed in the header table are what
made the table look like the source of the geometry. The table is internally impossible: its first-floor
row pair 0.5680 -> 0.6120 spans **2.28 m** at the corrected scale against the **3.06 m** beside it, and its
second-floor pair 0.4350 -> 0.4900 spans 2.85 m against 3.18 m. The live camera inverts the four rows to
12.42 / 8.03 / 5.57 / 3.29 m against the literals 12.42 / 7.9 / 7.22 / 4.16 — offsets of 0 %, 2 %, **23 %**
and **21 %**, two different signs and no ratio, which is not an 11 % conversion. The same pass found the real
defect underneath: the photograph's glass bands invert to first floor **3.49-5.63 m** and second floor
**8.05-10.93 m** where the code builds 4.16-7.22 and 9.24-12.42, i.e. **the windows are 1.0-1.6 m too high
and 0.4-1.0 m too tall**. It was scored rather than argued, and the arm that moves the code onto the
measured rows **loses both numbers**: cell 0.0952 -> **0.0955** and SSIM 0.4199 -> **0.4169** (0.0012 above
its floor). The geometry therefore stays and the discrepancy is a named open item. The arm was re-run after
the apertures were cut (`634ecd5` §4) and **still loses the cell metric** (0.0952 against the shipped
0.0923) while gaining 0.0019 of SSIM, so pass I4's loss was not an artifact of an invisible window. Evidence:
`out/wh/pass-i4-handoff.md` §2, §3, §5; `out/wh/pass-j-handoff.md` §4.

**`9c86d2d`, `c6d7fee` — the HABS index table.** The URL suffix is the **LOC INDEX**, not the sheet number:
`000NN{r,v}.jpg` is the sheet's position in the index, and from index 12 onward the index runs ahead of the
sheet number because 44 of the 85 drawings were withdrawn. **Twelve of the fifteen rows the plan cited
reached the wrong drawing** (the plan's "north elevation, full" URL suffix `00010v` reaches the East
elevation; `00031v` reaches the east elevation south half, not the ground-floor axonometric; and the plan's
sheet-number labels for 32 and 34 are swapped — 32 is West and 34 is East). The disagreement between the two
research files was settled **by the drawings themselves**, not by either document: 26 sheets were identified
from their own content and **12 have their printed `SHEET n OF 85` read off the native-resolution TIFF title
block**, and every one of those matches `research-dims.md`, whose index table is the correct one.
`habs-findings.md`'s index mapping is wrong while its *reading of sheet 82's window types* is right, and the
plan's "what each sheet is" column is right for every row even where its URL is wrong. Two traps were
recorded with it: a node `fetch` is required for these TIFFs and each body must be checked against its
declared `content-length`, because a truncated CCITT-G4 stream decodes as **blank paper** rather than as an
error, and Pillow is required because the repo's own `tiff.mjs` takes the blank-paper path. Evidence:
`out/wh/habs-index-verify.md` §1-§3.

**`63e56e0` — the storey chain, recorded as residual 1 and left OPEN.** The sheets print the chain on LOC
indices 07, 08 and 10 (sheets 31 North, 32 West, 34 East) and it is identical to the inch on all three:
**GROUND FLOOR -12'-8 1/2", FIRST FLOOR 0'-0", SECOND FLOOR +20'-11 1/2", THIRD FLOOR +38'-10", PROMENADE
+42'-0", TOP OF ROOF +55'-2 1/2"**, and it is absent from sheets 30 and 33. Both chains are quoted from
**FIRST FLOOR = 0'-0"**, so this is **not a datum shift** and no offset converts one into the other: the
intervals themselves disagree, ground-to-first 12'-8 1/2" against 6'-8", first-to-roof **55'-2 1/2" against
38'-0"**, and the ratios run 1.05 to 1.91. The model's own four figures **sum to 55'-6"** — the HABS number
to 3 1/2 inches — so **its stated 38'-0" is the error and its intervals are the surviving HABS numbers**;
its +30'-0" is a real sheet figure put on the wrong floor (the sheets' *third*-floor value +38'-10" and
promenade +42'-0" are displaced into it), its -6'-8" is the sheets' -12'-8 1/2" **halved**, and it has **no
row at all for the third floor or the promenade**, which is why the cornice zone had to absorb 34'-6" of
unexplained height. What the sheets describe is a three-storey building above the first floor and the model
carries two. It is **OPEN**, and it is residual **1** in the work entry because it gates all facade work: the
implied row shifts (+26/+27 px down, new rows at v 0.4469 and 0.4282) rest on whether the chain's ground
floor is the north grade or the areaway level, and the sheets carry no spot elevation and no grade symbol to
settle it. The one thing that does hold is the frame's own zero: the published 50'-4" parapet projects to v
0.3792 against the photographed 0.3800, 0.2 px, so the parapet and the wall base do not move and the
question is confined to the rows between them. The same verification found `layout.js`'s citation is wrong
twice over — "the HABS measured South elevation (sheet 34, read in `out/wh/habs-findings.md`)" — because
sheet 34 is the **East** elevation, the South is sheet 33 at index `00009v`, and index 34 is sheet 76.
Evidence: `out/wh/datum-reconcile.md` §1-§4, §6.

## The deploy defect, and its gate

**`00b645e`, from the user's report: the deployed site never carried the second scene.** The deploy job was
not the failing part — `gh run list` showed the newest run anywhere at `ce3f335` with success for both
`pages` and `test`, and **no run existed for any later commit**. The ARTIFACT was incomplete: `pages.yml`'s
"Collect the site" step copied `index.html`, `japan.webp`, `README.md` and `src/*.js` — **one flat glob** —
so the site carried scene 1 and nothing else while the copied `src/scenes.js` advertised a second scene.
`src/boot.js` imports the selected scene's entry **DYNAMICALLY** (`await import(scene.entry)`), so the
missing files are a **404 that only a visitor who picks that scene ever triggers**, which is why a green
deploy over a working default scene hid it for as long as the scene has existed. That is the whole class:
**the artifact and the registry could disagree with every run green.**

The step's own shell was run (`bash -e`) rather than reasoned about: the old shape leaves out
`src/whitehouse/main.js` and `whitehouse.webp`, the new one collects 42 files. The collection now copies
`src/.` whole, because `src/*.js` cannot descend into a scene's own folder — the layout `AGENTS.md`
prescribes for every scene after the first — and every `*.webp` the registry can name, with each optional
copy guarded. It is **gated** by the new `tools/sitecheck.js`, which reads `SCENES` out of `src/scenes.js`
and requires `index.html` plus every scene's `entry` (resolved from `src/`, the way the page resolves it)
and `photo` in the collected directory, running between the collection and the upload so an incomplete
artifact fails the deploy. Its red proof is on the **real artifact shape** rather than on a mutation: the
old collection exits **1** naming exactly `src/whitehouse/main.js (whitehouse entry)` and
`whitehouse.webp (whitehouse photo)`, and the fixed one exits 0 at 5 of 5 files. Its bound is printed with
every run — it proves the artifact is complete, not that a scene loads, because it follows no imports and
loads no page — and `import-inert` passes over it (23 tools). The class went into
`docs/learning/defect-register.md` and `_site/` into `.gitignore` so a local run of the step leaves the tree
clean.

## The phase's instrument faults, recorded so the next pass does not repeat them

**The stale canvas read (`pass-j-paint.mjs`).** Reading the WebGL canvas back with
`ctx.drawImage(renderer.domElement)` inside the same `page.evaluate` that rendered it returns the previous
frame: five repainted material classes all came back byte-identical, which looks like evidence that the
surfaces do not matter. Screenshot and decode on a separate page; nothing measured with the old path is
used anywhere in this phase.

**A score-reproduction tool that decodes at the wrong size (`f6686a4`).** `tools/compare.js` scores the
whitehouse at its own `src/scenes.js` `photoSize` **1200x900**; several scratch tools carried scene 1's
600x550 and scoring the same bytes there **moves SSIM by 0.013 on both arms** — this pass's own first scorer
produced 0.4228 for the before frame where the gate recorded **0.4363 for the same bytes**. At 1200x900 it
reproduces the gate exactly, which is the check that it is right. `out/critic/measure.mjs` is **not**
affected: it decodes the photograph at 600x550 by design and says so in its header.

**The anchor probe, which is still blind.** It reads framing trees for both wall ends and cloud for the
parapet and the pediment apex, and it resolves four of the eight calibrated rows. Its wall-end rows are not
evidence about the wall ends and were not used as any in this phase; `pass-k-corner.mjs`'s sky-to-wall step
test is what measured them.

## The numbers that moved, and from what

Scores, each a real `npm run shot` + `compare` and each committed in the order the phase landed:
**0.0952 / 0.4199** at the phase's start (recovered in `7f0730e`) -> **0.0954 / 0.4196** (`7160e73`, the real
rakes and the one width for all three parts, a small regression on both reported rather than hidden) ->
**0.0952 / 0.4199** (`7f0730e`, the frieze at ±8.13 m, 60 % of the regression recovered and not closed) ->
**0.0952 / 0.4199** (`615cb9d` and `4be0800`, comment-only, frames byte-identical at
`95dfb3f75068adc8`) -> **0.0923 / 0.4363** (`634ecd5`, the apertures and the reveal lever, the best pair this
scene had recorded) -> **0.0916 / 0.4494** (`f6686a4`, the bay layout). The thresholds **did not move** in
this phase: 0.0968 / 0.4157 both before and after, so the margins went from 0.0016 / 0.0042 to **0.0052 /
0.0337**, and they were left where they are rather than re-derived.

The realism numbers, by `node out/critic/measure.mjs whitehouse.webp out/wh/render.png`: **detail 0.893 ->
0.910** and **edge energy 0.861 -> 0.885**, both improving at both of the two geometry passes that moved the
frame (they were 0.893 / 0.861 before the openings, 0.909 / 0.883 after them, 0.910 / 0.885 after the
layout). The frame's dark tail did **not** move and is a separate open defect: luma p5 ratio 1.07, pixels
below luma 16 6.97 % against the photograph's 6.86 %, luma p1 ratio 2.64. Cost, measured rather than
explained away: draw calls 1690 -> 1777 for the wall's new pieces (each band is 12 boxes instead of 1) and
then 1765 after the apertures moved; the wall beside a window is still 4.3 % too dark in absolute terms
(photo 163.2, render 150.4) and the second floor's 5.8 %.

One number that did **not** win, and is stated rather than smoothed: matching the photograph's own
opening/pier ratio of 0.49 / 0.56 needs `OCCLUSION.reveal` about **1.70**, which costs 0.0004 of cell and
0.0036 of SSIM against the shipped **1.10** — so **the score prefers a lighter window than the photograph
shows**, and the shipped frame's windows are still 0.14-0.17 too light relative to their piers.

## What a later session should not have to rediscover

The storey chain is **open and first**, and it gates any pass that moves a row between the wall base and the
parapet: re-read sheets 31, 32 and 34 at native resolution (`out/wh/habs-verify/`,
`out/wh/datum-reconcile/`) and settle the chain's zero before moving anything. The window rows are 1.0-1.6 m
above the photograph's glass and moving them **loses both scored numbers**, so that arm needs a coordinated
facade revision — the belt course, the frieze, the dentil band and the cornice all sit between the two
floors and would have to move with them — not a change to four literals. The belt course has **no readable
row** at this resolution: the photograph's whole window between the floors is 42 px and its profile is a
monotone ramp with no step brighter or darker than 5 levels. The muntins are 1.2 px and the whole sash 45 px
at the scored frame's scale, so six-over-six sashes and the window pediments were **not built**, measured
rather than guessed. The `1.5` horizontal factor survives in three scratch tools (`pass-i2-fit.mjs`,
`pass-i2-centre.mjs`, `card.mjs`) and two report lines (`pass-i2-handoff.md` §101, §166) and makes the
figures that use it horizontally 12.5 % high. The anchor tool is still blind, the building's centre is still
u 0.5015-0.5023 unforced, `DIMS.porticoWidth` still does not describe the photograph's own column pair, and
`building.js`'s header table still says its rows convert to its metres by its scale, which three separate
checks say they do not — that sentence is a comment, the metres are the geometry, and the rows beside them
are stale.
