# Gate proofs

Each retired lesson's gate is listed with the mutation that made it go red, the failure it produced, and where the evidence lived before retirement. A gate that was never seen red proves nothing.

## npm test: every gate proves it ran (2026-09-10)

- Claim (in the gate's own header, `tools/test.js`): a tool that exits 0 having done nothing is indistinguishable here from a tool that passed, so the `GATES` table pairs each of the seven gates with a line that only its finished success path prints. `npm test` captures each tool's output and fails, naming the tool and the missing text, when that line is absent — whatever the exit status says.
- Origin: `blackframe`, `record`, `paintcheck` and `shimmer` guarded their main block with ``import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` ``. That is true on Windows and false on every POSIX `argv[1]`: `file:///` joined to `/home/runner/work/scenes/scenes/tools/blackframe.js` gives `file:////home/...` with four slashes, against node's `file:///home/...`. So on CI each tool imported its own module, ran nothing and exited 0. `blackframe` and `record` are in `npm test`, and CI reported them green from the day each landed, 2026-09-06, until 2026-09-09. In run 34306122575, job 102323064914: `== tools/blackframe.js ==` at 03:57:12.599, `== tools/record.js ==` at 03:57:12.893, `== thresholds ==` at 03:57:13.191, `PASS` on the same millisecond. The two gates together took 0.6 s of a 45m38s run, printing nothing; on this machine's GPU they take 19 s and 18 s, and on the runner's SwiftShader they take minutes.
- Mutation: the pre-fix guard put back in `tools/blackframe.js`. The old expression is true on Windows, so reproducing the defect here meant feeding it the `argv[1]` a Linux runner has — `isMainModule` became `const runnerArgv1 = process.argv[1].replace(/^[A-Za-z]:/, '').replace(/\\/g, '/');` followed by the old comparison against `` `file:///${runnerArgv1}` ``. Run on its own, `node tools/blackframe.js` then printed nothing and exited 0 — the CI defect exactly. Then `node tools/test.js` from a clean `out/`.
- Failure produced: exit 1 at the sixth gate, after shot (58 s), compare (1 s), placement (35 s), animation (998 s) and nudge (164 s) had passed and printed their markers:

```
== tools/blackframe.js ==

FAIL: tools/blackframe.js exited 0 after 0 s without producing evidence that it ran.
  expected its summary line to contain: "blackframe:"
  it printed 0 character(s) of output (nothing at all)
  A gate that exits 0 having run nothing is reported here as a pass, so the marker is
  the evidence. Check the main-module guard at the bottom of the tool first: the form
  `import.meta.url === `file:///${process.argv[1]...}`` is false on every POSIX argv[1]
  and silently skips the whole main block. Fix the tool, or, if it now prints a
  different summary line, update GATES in tools/test.js.
```

- Restored, the same suite from a clean `out/` printed `blackframe: 12 size/ratio combinations from 6 of 6 views all rendered the scene on ANGLE (NVIDIA, NVIDIA GeForce RTX 4090 ...)`, then `-- tools/blackframe.js: ok in 19 s`, then `record: 847 frames driven by real input over 12 s ..., worst frame 5 of 25 probes dark (limit 12)` and `PASS`. Seven gates, exit 0: shot 63 s, compare 1 s, placement 30 s, animation 811 s, nudge 163 s, blackframe 19 s, record 18 s.
- The guard itself is checked separately, because a truth table is not a gate: evaluating both forms against a Windows-shaped and a POSIX-shaped `argv[1]` with node's own `path.win32`/`path.posix` and `fileURLToPath(url, { windows })` gives old true/false and new true/true. That is what the fix rests on; the marker check is what notices when a future guard, or anything else, silences a tool again.
- Bound: **it proves a marker was printed, not that the gate's checks are right.** A tool that printed its summary line and skipped half its work passes this, and the marker is a plain substring, so a tool that renames its summary line goes red until `GATES` is updated. It covers the seven tools in `GATES` and nothing else — `paintcheck` and `shimmer` are not in `npm test`, so their identical guards are covered by the same fix and by nothing that runs. `record` under `RECORD=0` prints `record: skipped by RECORD=0 ...`, which satisfies the marker on purpose: the check separates a decision in the log from silence, not a run from a skip.

## blackframe: the frame is there, at every window size (2026-09-06)

- Claim (in the gate's own header, `tools/blackframe.js`): every gate in the repo runs at one viewport and device pixel ratio, and the post chain can hand back a black frame from the *size* alone. For six window size and ratio combinations, including non-round ratios, measured once on load and once after a resize, the gate fails when the frame is more than 20% near black, when one tile of a 12x12 grid over it is essentially all black, when its luminance is flat, or when the composer has kept less than 35% of the light the same view shows through `renderer.render(scene, camera)` with no post chain at all.
- Origin: the user's report, "when I move the camera around there are even giant rectangular blackouts on screen... Only clicking the reset review button made it go away", recorded in `defect-register.md` with the investigation that found the camera incidental and the frame full of NaN.
- Mutation: `src/post.js` and `src/main.js` reverted to their state at 0c828d7, which is the post chain with no verification of its own output, then `npm run blackframe`.
- Failure produced: 4 of 12 rows, exit status 1. At the size the report came from, a 1280x720 window at a device pixel ratio of 1.5 and so a 1920x1080 drawing buffer: `96.61% of the frame is near black, over the 20% allowed`, `a 160x90 tile (one of a 12x12 grid over the frame) is 100% near black`, and `the composer keeps only 3.1% of the light the plain renderer sees (3.6 against 116.1)`. Also 1441x801 at ratio 1.25, reached by a resize, at 100% near black with a luminance spread of 0 and none of the light kept; 1575x1435 at ratio 1.75 at 95.68%; and a resize back onto a 1920x1080 buffer at ratio 2, again 96.61%. Restored, the same run printed `blackframe: 12 size/ratio combinations all rendered the scene`, with the frames 0.56% to 1.70% near black, the worst tile 7.6% to 16.1%, and 1.009 to 1.022 of the plain renderer's light kept.
- The limits sit far from both states on every one of the four measures, which is what a gate for "rendered nothing" should look like: 1.7% against 96.6% of near-black pixels, 16% against 100% on the worst tile, a luminance spread of 57 against 0, and 1.01 against 0.03 of the light kept. The differential against the plain renderer is the one that needs no absolute brightness and so holds wherever the camera is pointing when a window is resized.
- A first version used a fixed 32x32 tile, copied from `tools/blackout.js`, and went red against the *fixed* scene: at a 1920x1080 buffer the darkest 32x32 patch of this back-lit sunset is 99.9% near black all on its own, under the eaves. The tile is a twelfth of the frame in each direction now, which is the scale the user's word "giant" is about, and a correct frame reaches 16% of it. `tools/blackout.js` still uses the 32x32 form and would false-positive the same way outside its own viewport.
- Bound: it runs on whatever renderer chromium gives it. With `--use-angle=d3d11` that is the real GPU, and the defect is a property of that driver, so a machine with no usable GPU falls back to SwiftShader and a green run there proves only that the chain is sound there; the renderer is printed with every run so the two are never confused. `BLACKFRAME_VIEWS` trims the sweep for CI, which has no GPU and no time. It looks for frames that are too dark or too flat, so a defect that paints a bright uniform rectangle over part of the frame is invisible to it. And it visits six sizes rather than all of them, which is exactly why the fix it guards is a runtime check rather than a list: no list of sizes can be complete.

## nudge: the frame is stable under a small camera move (2026-09-06)

- Claim (in the gate's own header, `tools/nudge.js`): a still camera renders the same frame byte for byte, so no scored gate can see a frame that is unstable while the camera moves. For three poses at two device pixel ratios the gate renders the same pose twice and requires identical output, then nudges the camera 2 mm and requires the fraction of pixels changing by more than 90 levels to stay under its per-ratio limits (0.4% per pose and 0.2% on the mean at ratio 1; 0.6% and 0.3% at ratio 2).
- Origin: the user's report, "As I move the camera around it flickers a lot", recorded in `defect-register.md` with the investigation that traced it to geometry thinner than a pixel rather than to depth fighting.
- Mutation: `POST.renderScale` set back to 1.0 and `POST.samples` to 4 in `src/post.js`, which is the state the user saw, then `npm run nudge`.
- Failure produced: four failures, exit status 1. `FAIL close to the paving, ratio 1: 0.57% ... over the 0.4% allowed`, the same pose at ratio 2 with 0.70% over 0.6%, and both means (0.298 over 0.2 at ratio 1, 0.369 over 0.3 at ratio 2). Restored, the same run printed `nudge: 6 poses stable across device pixel ratios 1 and 2`.
- The limits sit between the two measured states at each ratio, roughly 1.3x above the fixed scene and 1.3x below the broken one. The mean does the separating and the per-pose ceiling catches a single bad view that a mean would dilute.
- The first version of the gate ran only at ratio 1, and it passed a fix that was switched off at ratio 2 and rendering the scene at a quarter of the canvas there. That is why the gate runs both.
- Bound: three poses, one nudge direction, one viewport (900x820) and one renderer. It measures the whole frame, so a small patch of violent instability can hide under the fraction. It counts only pixels that change *drastically*, so it says nothing about the ordinary resampling a moving camera always produces. And it has about one bit of resolution on the supersample: 1.2, 1.35, 1.5 and 2.0 all pass alike, and only turning it off fails, so it proves the class rather than the setting.
- The bound that mattered, found on 2026-09-06: this gate scores how much the frame *changes*, so a frame that is entirely black is the most stable frame there is and passes it perfectly. It rated the next defect the same user reported, a post chain handing back 96.6% black at a size this gate never visits, as a flawless pass for its whole life. A stability metric cannot tell "rendered correctly" from "rendered nothing", and `npm run blackframe` is the gate that can.

## animation: the scene moves, and not too much (2026-09-05)

- Claim (in the gate's own header, `tools/animation.js`): the scored shot is one frame, so it cannot see what the animation does at t = 3 s. The gate scores seven frames across the wind's slowest period and asserts the worst frame's scores, the spread between frames, and the mean per-pixel change between neighbouring frames from both sides: too little and the scene has stopped moving, too much and it is thrashing.
- Origin: the phase 5 plan requires the photo view to hold "at any moment", and the manager asked for the spread to be a number rather than a claim.
- Mutation: `WIND.canopy` in `src/animation.js` raised from 0.085 m to 1.2 m, a fourteen-fold canopy sway that is grotesque by eye, then `ANIMATION_FRAMES=3 npm run animation`.
- Failure produced: `FAIL motion between frames: 0.6522 <= 0.4000`, then `FAIL: the animation is outside what the photo view allows`, exit status 1. Restored, the same run printed `ok motion between frames: 0.2073 <= 0.4000`.
- The first version of this gate asserted only the worst frame's scores against a loose allowance, and the critic showed it passing that same fourteen-fold sway without blinking: the scores barely move when the canopy sways, because its mean color is much the same wherever it is. The motion bound is what actually constrains the amplitude, and it was added because of that.
- Bound: the motion figure depends on the spacing of the sampled times, so `ANIMATION_FRAMES` changes it (0.18 at seven frames, 0.21 at three); the ceiling of 0.4 is set for the wider spacing. It measures the whole frame, so a violent animation in a small part of the scene could stay under it.

## grounding: what each object stands on (2026-09-05)

- Claim (in the gate's own header, `tools/placement.js`, and in `GROUNDING_CHECKS` in `src/layout.js`): the scores and the placement gate both look along the camera's ray, so nothing sees what is underneath an object. The grounding half finds each listed object, takes the bottom of its own bounding box, drops a ray from above it, and fails when the mesh it should stand on is more than `tolerance` below it (floating) or more than `sink` above it (buried).
- Origin: the phase 3 lesson. Two critics found the far houses' bodies 20 m over nothing, the pines' feet in mid-air, the planter shrub with its base inside the fence roof and the small shrub under the walkway, every time with `npm test` green; recorded in `docs/devlog/detailed/2026-09-05-phase-3.md` and queued in `lessons.md` from commit 61ada57 until this one.
- Mutation: in `src/background.js`, the far houses' base raised by 3.6 m (`yBase = Math.min(...) + 3.0` in place of `- 0.6`), then `npm run placement`.
- Failure produced: `FAIL far roof c house lower stands on far plots left: it floats 1.41 m over "far plots left", past the 0.8 m allowed`, exit status 1. Restored, the run printed `placement: 19 in front, 8 grounded, all ok`.
- A first version checked a fixed point from `src/layout.js` rather than the object, and stayed green when the object floated away, because the ground under the recorded point had not moved. The check now measures the object's own base every run.
- Bound: it covers the eight objects listed, one ray each, and an object whose footprint is not under its bounding box's centre needs an `x`/`z` override (the cherry's wood is one mesh whose box is centred in the canopy). It says nothing about objects that intersect each other sideways.

## placement: the first mesh under each landmark (2026-09-05)

- Claim (in the gate's own header, `tools/placement.js`): the compare scores cannot see a piece built inside another, so `npm test` casts the photo camera's ray through each entry of `PLACEMENT_CHECKS` in `src/layout.js` and fails unless the first mesh hit starts with the named mesh.
- Origin: the phase 2 lesson (both sliding doors, a lantern and the awning sat inside their wall boxes and the sign floated while the score was the phase's best), recorded in `docs/devlog/detailed/2026-09-05-phase-2.md` and queued in `lessons.md` from the phase 2 commit (407d653) until this one.
- Mutation: in `src/vegetation.js`, the cherry's trunk mesh built but not added to the scene (`mergeGeometries(wood);` in place of `b.add(new THREE.Mesh(mergeGeometries(wood), bark), 'cherry trunk');`), then `npm run placement`.
- Failure produced: `FAIL cherry trunk at (0.635, 0.585): expected "cherry trunk", first hit "ground base"`, then `FAIL: 1 placement check(s) hit another mesh first; see src/layout.js PLACEMENT_CHECKS`, exit status 1. Restored, the run printed `placement: 18 checks ok`.
- A first attempt set the trunk mesh's `visible` to false and did not go red: `Raycaster` ignores visibility, so the gate sees geometry, not what is drawn.
- Bound: the gate checks one ray per listed position, so it catches a landmark hidden or missing at that pixel and nothing else; an attachment built inside its wall but still the first hit somewhere on its body passes, and positions must sit on the object's body, not its edge (the trunk's check moved twice before it was reliable).

## compare refuses a stale render (2026-09-05)

- Claim (in the gate's own header, `tools/compare.js`): a score is a claim about the current scene, so `compare` fails when `out/render.png` is older than any of `index.html` and `src/*`.
- Origin: a `npm run shot` that failed with `slopedSlab is not defined` was followed by `compare`, which scored the previous render as if the shot had succeeded, because `npm run shot | tail` reported tail's exit status. Recorded the same session in `docs/devlog/detailed/2026-09-05-phase-1.md`; the lesson never entered `lessons.md` because the gate landed in the same commit, so there is no pre-retirement evidence file to read back.
- Mutation: `touch src/layout.js` after a successful shot, then `npm run compare`.
- Failure produced: `FAIL: out/render.png is 392.0 s older than src/layout.js; run npm run shot so the score is of the current scene`, exit status 1. A fresh `npm run shot` followed by `compare` passed again with the same scores (0.0940 / 0.2929).
- Bound: the check compares file modification times, so it cannot see an edit that preserves the mtime, and it does not cover `tools/` (a tool change does not change the scene).

## `npm run record` — a frame that goes dark while the camera is driven

Claim in the gate's header: no single frame may have 12 or more of its 25 probes dark during a scripted
gesture sequence driven by real mouse events at 2005x1305 on a GPU.

Mutation: remove `composer.addPass(sanitize)` from `buildComposer` in `src/post.js`, which is exactly the
state before the ceiling was added, with the bloom fed straight from the scene.

Failure produced: `FAIL: 171 of 1022 frames had 12 or more of 25 probes dark while the camera was being
driven`, exit code 1, first failures at frames 21, 26, 36, 42, 51 and 55 with 12 to 16 probes dark.
Restored, the same sequence reports a worst frame of 3 of 25 and passes.

Bound: it drives one gesture sequence at one window size and one device pixel ratio, on a GPU. Under the
software renderer the driver fault this exists for does not occur, so a green run there proves only that
the page renders through a camera move. It measures darkness, so a bright fault is invisible to it, and
its probe is a 5x5 grid, so a dark region smaller than that spacing is missed.
