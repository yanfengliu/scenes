# 2026-09-16 — the two tools follow-ups from iteration 3, and a third the sweep turned up

Base revision: main at 95b295e (iteration 3 merged). Scope: `tools/` only. `src/` was not changed — it was mutated and restored four times for red proofs, and `git status src/` is clean at the end, with `src/vegetation.js` back to sha256 `ee8e89dc73ea929e…` and `src/layout.js` back to `861fffbb03e0b469…`.

The allowed paths were `tools/`, the clearance and views lines of AGENTS.md's Gates section, `docs/learning/gate-proofs.md` and this file. **It was widened by one line during the task, on the integration owner's instruction**: AGENTS.md's `npm run compare` line said compare refuses only a render older than the source, which this work made false — it now also refuses a missing `out/render.tree.json`, a sidecar whose recorded render digest is not the file on disk, and a recorded tree that is not the tree on disk. The scope had named the clearance and views lines because those were the two items, not to leave a now-false sentence standing, and a Gates line that understates what a gate refuses is the kind of documentation this repo treats as a defect.

Three things landed. Two were handed over by the scene lane because `tools/` was outside its scope, and the third arrived mid-task from the integration owner and turned out to be the largest of them.

## Read this first: the new checker shipped the exact defect it was written to prevent

`npm run treecheck` exists because a run that compared nothing must not read as a pass. An independent critic found that it **printed `FAIL` and exited 0**.

Two of its three records guarded the hash they parse and pushed a problem when it was missing. The third did not: it took `hash: j.sourceTree` unconditionally, so a sidecar that is valid JSON without that field gave `hash: undefined`. That printed a `FAIL` line, and was then dropped by the `filter((r) => r.hash)` that builds the pairing list — so nothing was pushed to `problems` and the process exited 0. **Printing and exiting are two different code paths and only one of them is the verdict.**

This repo keeps finding that defect in new clothes: `blackframe` and `record` exiting 0 on every CI run for three days, seven tools running a whole gate on import, a gate whose floors could not tell a fragment from a street. Finding it inside the tool built to prevent it is the strongest argument available for running an independent critic over every unit. Every green run this session passed. Reading is what caught it.

Reproduced before the fix, fixed, and re-proved red — the full record is under `the sweep and the score are of one tree` in `docs/learning/gate-proofs.md`, F6.

## 1. `clearance` classified terrace paving and foliage as buildings

Iteration 3 added `right walkway slabs` (the flagstones on the right terrace) and `fence spill leaves` (foliage over the near fence). `tools/clearance.js` builds its building set by EXCLUSION — anything `WALK`, `TERRACE`, `TERRAIN`, `LIVING` and `CANOPY` do not match is a building — and all of those lists are whole-name anchored regexes, so a new mesh is never near a match. Both new meshes landed in the building set. A reviewer found it; the tool did not.

`right walkway slabs` is now in `TERRACE` and `fence spill leaves` is in `LIVING`.

### The handover said the terrace headroom reads 5 mm long. Both halves of that are wrong.

**The headline figure does not move at all.** Before and after, the lowest canopy geometry over the right terrace is `2.5255109556019306` m — bit-identical, same mesh, same coordinates, over `side stair treads` at y `-1.1694293022155762`. It does not move because the deepest canopy sample over the terrace grounds on the side stair, which was always in `TERRACE`, and not on the walkway at all.

**And what does move is much larger than 5 mm.** Dropping `clearance`'s own ray on `clearance`'s own 0.25 m grid over the terrace, against the old set and the new one (`out/scratch/terrace-ground.mjs`): 542 cells find a higher surface, 4,240 are unchanged, and none gains ground it did not have. The distribution is the finding:

| rise | cells |
|---|---|
| 0.005 m | 454 |
| 0.020 to 0.145 m | 55 |
| 0.319 to 0.673 m | 23 |
| **1.021 m** | 11 |

454 cells rise by exactly the flagstone thickness, 5.000 mm, which is the number the handover had. The other 88 are at the terrace's far end, where the slab ROWS are laid flat across a band that is dropping steeply (`RIGHT_TERRACE.line` falls from `[-14.8, -2.7]` to `[-15.3, -5.0]`). The worst is a whole row at z -14.5, x 2.25 to 4.00, where the walking surface stands **1.0207 m** above the band the rays were landing on. So the terrace headroom was overstated by up to a metre at that end, not by 5 mm. Nothing was actually hanging there, which is why no assertion moved.

### `fence spill leaves` is a plant, not canopy

The brief said "foliage is canopy". It was tried, and the measurement settled it: with `fence spill leaves` in `CANOPY` the gate goes red at once —

```
FAIL lowest canopy geometry over the right terrace: 1.437 m (limit 1.90 m) — fence spill leaves at (2.12, 1.87, -6.08) over "right walkway"
```

That foliage hangs at 1.44 m over the terrace by construction: it is a plant spilling over the near fence at the terrace's inner edge, and `placement` pins it to the photo at (0.771, 0.659). Holding it to the 1.90 m a STREET owes would red the gate for something the scene builds on purpose. So it is classed the way every other leaf mesh in this scene is classed — `LIVING`, printed by name every run in the "plants NOT measured for headroom" line. **The 1.437 m is now written into the gate's own header as a known, deliberate hole**, which it was not before, in either direction: nobody had measured it.

### The classification is now checkable

Two things were added, because "both lists are whole-name anchored" is exactly the property that makes a miss silent.

- **The terrace set is printed**, like the walkable street already was. That set decides which surface the terrace rays land on, so a mesh missing from it is a mesh whose top is not the top.
- **A name-shape cross-check.** A mesh in the building set whose own name contains a paving word (`slab`, `walkway`, `tread`, `riser`, `paving`, …) or a plant word (`leaves`, `shrub`, `blossom`, `moss`, …) fails the gate. The two facts are independent — the name is written in `src/`, the set comes from the regexes in `measureInPage` — so this is a cross-check and not the code agreeing with itself.

Its bound is real, is in the header and in `out/clearance.json`, and was MEASURED rather than described. Sixteen plausible mesh names through `nameSaysNotABuilding`: seven caught, **nine missed** — `right terrace flagging`, `stone step`, `boardwalk`, `kerb stones`, `duckboards`, `stepping stones`, `wisteria`, `creeper`, `hedge`. Each of those would land in the building set in silence, exactly as the two meshes that created this check did. `boardwalk` misses because the word is `walkway` and not `walk`, `duckboards` because it is `board` and not `slab`. Both were left alone on purpose: a word added for a mesh nobody has written is a word nobody can red-prove, and the header says so. It also only looks one way — a BUILDING misfiled as terrain or a plant is caught by nothing, which is why every set is still printed by name.

### What moving the two meshes out of the building set cost

Nothing measurable, and this was checked rather than argued. Comparing every row of `out/clearance.json` before and after: **the worst numeric change across all 200 z positions and all four measured runs is 0.0**. The only difference anywhere is that `right walkway slabs` disappears from the `farBlockers` NAME list at two z positions, -14.25 and -14.50. It was being named as a far-half blocker there and never narrowed the widest clear run in that half. `fence spill leaves` was never a blocker at any z.

**And the reason it was harmless is not the one first written here.** The first version of this section said "coincidence of their x positions — both sit at x ≥ 1.82 and the paved band ends at x ≈ 1.26", which the gate's own output contradicts: `right walkway slabs` could only be NAMED in `farBlockers` at those two z if a WALK ray found paving in that column. The real reason is that `right walkway` — the solid directly beneath those flagstones — was **already** in `TERRACE`, so that raised edge was already exempt and the slabs were a 5 mm lid on an exempt solid. An independent critic caught the contradiction between the claim and the measurement sitting two sentences apart. The going-forward cost, stated honestly, is that paving laid over the street's own columns from the terrace side can no longer narrow a clear run.

## 2. The sweep lost its binding to the scored frame

Until 2026-09-15, `out/views/1-photo.png` was byte-identical to `out/render.png`. That was the binding: one digest, two tools, so a review holding a sweep and a score could see they came from one tree. The GPU move ended it on purpose — `views` renders on the GPU (11 s against 291 s), `shot` renders the scored contract on SwiftShader — and what replaced it was an INFERENCE that nobody edited `src/` in between. The iteration 3 devlog says so in as many words and copies out nine file hashes by hand to make the point.

That inference is now a check.

- `tools/lib/treehash.js` hashes `index.html` and every file under `src/`, recursively, by bytes, paths normalised and sorted.
- `shot` writes `out/render.tree.json` beside the render: the tree hash, the per-file list, the render's own sha256 and the renderer.
- `compare` refuses to score when that sidecar is missing, when its `renderSha256` does not match the file on disk, or when its tree differs from the tree on disk — and copies the hash into `out/scores.json`.
- `views` writes the hash and the per-file list into `out/views/index.txt`, beside the pose digests.
- `npm run treecheck` compares all three records against each other and against the tree on disk, and names the files that differ.

**Where it runs, and what covers what.** `treecheck` is NOT in `npm test`'s `GATES`, deliberately: `views` is a diagnostic, a fresh clone's first `npm test` has never run it, and a suite gate that went red for a missing diagnostic would be a false red. It reports a missing artifact as missing, skips that artifact's pairings, and prints how many pairings it actually made, so a run that compared nothing cannot read like a run that compared everything — and it fails outright when NO record carries a tree, which is the "compared nothing" case. What protects the shot-to-compare half inside the suite is `compare`'s own hard failure, which runs on every `npm test`. `treecheck` is the reviewer's tool for the half the suite cannot have.

**`shot` and `views` each read the tree twice**, before opening the page and after the last frame, and fail (shot) or warn loudly (views) when it moved. A frame made while `src/` was being edited belongs to neither tree, and recording it as either would be worse than not recording it.

## 3. The sweep digest did not reproduce, and it was not only pose 7

This arrived from the integration owner mid-task: pose 7's digest differed on every run, so any review quoting a sweep digest was quoting a number that would not come back.

**It is not a limit cycle.** The frame loop runs `controls.update(); clampCamera();` every frame, and for pose 7 — the pose deliberately asked for inside the right machiya and below the street — the clamp pushes the camera out of the wall to a place the controls' own polar limit pulls back. The two converge, but not in one step. Read back per iteration (`out/scratch/pose7.mjs`), camera y:

```
-2.030806   at the clamp
-1.840034   after 1 (update, clamp) pair
-1.839704   after 2
-1.839703   after 3
-1.839703   for the next seventeen
```

`views` gave it two rAF settle frames, and how many of the PAGE's own loop frames the compositor fits inside those is not fixed. So the camera landed on whichever of those states the timing produced.

**The bytes follow.** Rendering pose 7 at each state (`out/scratch/pose7-bytes.mjs`) gives **three distinct files** across 0, 1, 2, 3, 4 and 8 pairs: `afcbdd84a749`, `2b375dfafa46`, and `b7834df3dad3` from 3 pairs onward. So the pre-fix path could emit any of three files for that pose, and the sweep digest taken over all seven moved with it.

**The fix is a fixed point, not another settle frame.** Each pose now iterates the loop's own `(update, clamp)` pair — with damping restored exactly as the loop has it — until the camera and the target stop moving bit-exactly, before the two settle frames. Then the loop's frames cannot move it. A pose that does not converge in 32 iterations is warned about by name, because a pose whose digest cannot be quoted cannot be reviewed against a record.

**Why no number of extra settle frames would have worked.** The loop's own frames are both what presents the canvas and what moves the camera, so you cannot pin a state and let the compositor present it. Only making the state a fixed point removes the choice.

**And it was not only pose 7.** Settle pairs per pose on the shipped tree:

| pose | pairs that moved the camera |
|---|---|
| 1-photo | 0 |
| 2-orbit-left-up | 0 |
| 3-orbit-right-up | 1 |
| **4-paving-down-steps** | **10** |
| 5-landing-look-back | 0 |
| 6-high-over-roofs | 2 |
| 7-clamped-out-of-the-wall | 6 |

The count is pairs that MOVED the camera; the loop always applies one more than it counts, and that last one is what proves the pose does not move. So zero is the healthy value and any number at all is a pose the clamp and the controls argued about.

**Four of seven poses were being rendered at an unconverged state.** Only pose 7 was ever reported, because only pose 7 sits where the disagreement is large enough to cross a pixel boundary. Pose 4 needing TEN pairs is the number that makes the point: the defect was structural and it was invisible in six poses.

Pose 3 is in that list because of a second correction to this same line. The note was first written to print only when the count was over one, on a wrong belief that the loop's floor was one — it is zero, because `break` skips the `for` increment. With the threshold corrected to "any movement at all", pose 3 turned out to move by one pair as well. A count whose floor is misunderstood by one hides exactly the cases nearest the floor.

(Pose 7 reads 6 pairs here against the probe's 3 because the probe applied pose 7 first on a fresh page while the tool reaches it from pose 6, so the two start from different camera states. The state they converge TO is the same, which is what the equal digests show.)

**A line that was lying, found by adding the settle.** `views` reported a pose "moved by: drift over the two rendered frames" by comparing the read-back against the position after the FIRST clamp. With a settle in between, that note reported the settle's own movement as drift. It now measures from the settled position. The first run with the settle showed pose 7 as drifting; the fixed line shows it does not.

## Verification

- `npm run clearance` — green, **12.7 s** (12 s before; within run-to-run noise on this machine).
- `npm run import-inert` — green, all **19** tools inert on import, including the new `tools/treecheck.js`. Two tools' hand-built `isMainModule()` were replaced by the `serve.js` import AGENTS.md requires (`clearance`, `views`); `import-inert` is what proves they are still inert, and running each tool is what proves the guard still fires.
- `npm run shot` — **72 s**, `out/render.png` sha256 `09a8825e072c84d7…`, which is the digest iteration 3 recorded. Nothing in this work moved a pixel.
- `npm run compare` — **0.0660 / 0.5286**, unchanged.
- `npm run views` — **11 s**, four runs, sweep digest `454bd56f49b6` every time, all seven pose digests equal to the ones iteration 3 recorded.
- `npm run treecheck` — new, under a second, green with all three records and red on a one-byte edit.

## Red proofs

Every one is in `docs/learning/gate-proofs.md` with its failure text. In summary:

- **The two inherited clearance proofs still fail.** A1 (`HEADROOM = 0.0`) gives `1.329 m (limit 1.90 m)` at the same coordinates as every previous re-run. B1 (the floor removed from `farRowFrontX`) gives two `0.00 m` FAIL lines. B1's numbers have SHIFTED since the proof was recorded, and not because of this work — iteration 3 built shopfronts onto the far row, so the near-half failure is now 24 rows at z -29.75 naming three meshes where it was 23 rows at z -30.00 naming one. The eave line is word for word unchanged.
- **The new classification check**, both halves, by putting each mesh back where iteration 3 left it.
- **The new tree binding**, by appending one space to `src/vegetation.js` between a `shot`/`compare` and a `views` run. `treecheck` exits 1 naming `src/vegetation.js`; `compare` exits 1 on the same edit with `out/render.png` touched first, so the OLD mtime rule passed and the new content check is what fired.

- **The two "did not run" guards**, in a directory holding only `index.html` and a copy of `src/`. With no `out/` at all, `treecheck` exits 1 saying it compared nothing rather than printing a pass; with twenty files deleted from that copy's `src/`, the `MIN_FILES` floor exits 1 saying a near-empty walk hashes to a constant and a constant makes every record agree. That second one is the failure mode the whole binding is most exposed to, and it is the reason the floor exists.
- **A mixture sweep**, found by the author reading the manifest regex against what `views` writes: `views` marks its line `-- MIXTURE` when the tree moves under a run and writes the END hash, and `treecheck` was reading the hash and ignoring the marker. Fixed before the suite ran and proved by planting a marker.

**One result from that proof is worth keeping.** The one-byte edit did not move the sweep digest — `454bd56f49b6` either side — because a trailing space renders identically. That is the bound of the binding it replaces: byte identity of two renders cannot see a source change that renders the same, and the tree hash can.

## Verification, again, after the last edits

`npm test` PASSES, exit 0: import-inert 4 s, shot 78 s, compare 1 s, placement 9 s, clearance 15 s, animation 11 s, nudge 12 s, blackframe 30 s, record 28 s. Thresholds `cell 0.0660 <= 0.0675` and `SSIM 0.5286 >= 0.5236`. `placement` incidentally re-confirms both reclassified meshes are still where the photo pins them: `right walkway at (0.938, 0.932): right walkway slabs` and `fence spill at (0.771, 0.659): fence spill leaves`. `npm run views` five times in all, sweep digest `454bd56f49b6` every time.

## Independent review

One read-only critic, given the working tree, the three claims and an instruction to say why the numbers do NOT support them. It ran no browser and no npm script (the slot was held elsewhere) and verified what it could with pure-Node checks, saying which claims it could not check without running something. It found **one blocker, six should-fixes and six notes**, and it was right about all of the ones acted on below. It also caught itself: it noted the tree had moved under it mid-review and pinned its findings to the exact file digests it read.

**BLOCKER — `treecheck` printed FAIL and exited 0.** The score and sweep records each guarded the hash they parse and pushed a problem when it was missing; the render record took `hash: j.sourceTree` unconditionally. A sidecar that is valid JSON without that field produced `hash: undefined`, which printed a FAIL line and was then dropped by the `filter((r) => r.hash)` that builds the pairing list — so no problem was pushed and the tool exited 0. Reproduced here before fixing (exit 0 with FAIL on screen), fixed by giving the render record the same shape as the other two, and re-proved (exit 1, `FAIL the render … records no scene source tree`). **This is the tool's own stated failure class arriving inside the tool**, in a tool written to catch exactly that, and it says something about how little a green run proves about the checker itself.

**The tree hash was not portable and its header claimed it was.** This repo has `core.autocrlf = true` and no `.gitattributes`, so the same commit is CRLF here and LF on `ubuntu-latest`. Hashing raw bytes made the hash a property of the reviewer's git config. Measured: `src/layout.js` has 775 CRLF endings on disk, and the tree hashes are `3811005047643b3b…` as on disk against `dda00820d3825d48…` normalised. No gate broke — every record in one run comes from one checkout — but a hash quoted in a review would have meant nothing across machines, and anyone re-running `treecheck` on Linux against artifacts made here would have got a false red naming every file. **Fixed by normalising CRLF to LF before hashing**, which costs only the ability to notice a pure line-ending change, something that moves no pixel and that git already hides. The new hash matches the critic's independently computed LF figure exactly, which is two implementations agreeing rather than one asserting.

**`plant` was removed from the word list.** It is the most obvious word on it, and `planter` is this repo's own word for the stone bed — `planter strip`, `the planter's stone core`, eight uses across six files — which is MASONRY and correctly a structure. A future `planter strip` mesh would have been a false positive whose failure text's first instruction is "put it in LIVING", taking a real obstruction out of the street sweep. `left plant leaves`, the only mesh the word caught, is caught by `leaves` anyway.

**The word list's stated bound was anecdote where a measurement was available.** It named two invented misses. Measured against the scene's own correctly-classified sets, it would catch **WALK 6 of 14, CANOPY 1 of 2, LIVING 7 of 33** — a minority — and is blind to `stairs`, `gutter`, `landing`, `far street`, `platform`, `cherry strands`, `cherry trunk`, `evergreen trunks`, `pot` and more. `landing 2` or a fourth pot would land in the building set in silence. Those numbers are now the bound in the header, replacing the anecdotes.

**"Every terrace clearance read 5 mm long" was wrong in the gate's own header** while AGENTS.md, written the same session, said up to 1.02 m. The header is the one that binds, and it was the wrong one. `right walkway` is a `bandSolid` of 10 segments whose top is a chord approximation of `rightTerraceY`, while each slab row sits on the true curve; the chord error reaches 1.3837 m at z -14.76. 5 mm is the slab's nominal offset, not the measured error.

**A non-converged pose was a stdout warning and nothing else.** The manifest is what a review quotes, and a digest that will not come back has to say so beside itself — exactly the hole the `-- MIXTURE` marker closes one level up. It now marks the pose line too.

**`MAX_SETTLE`'s justification cited the wrong measurement.** The comment said "pose 7 takes three; the rest take one", from the probe's convergence of camera **y**; the loop tests bit-equality over all six components of position and target, which takes pose 7 six and pose 4 ten. A budget defended by the wrong number is a budget nobody can defend.

**The pairing the tool exists for could not name a file.** `diffTrees` needs both sides to carry a file list; only the render sidecar did, so the sweep-to-score comparison always reported two bare hashes. Fixed on both sides: `compare` carries `sourceFiles` through into `out/scores.json`, and `treecheck` parses the manifest's own `#   <path> <16hex>` lines, with `diffTrees` comparing on the shorter of the two hash lengths. Re-proved: all three pairings now name `src/vegetation.js`.

**Also fixed:** a stale `1.10 m` in `clearance.js` (shipped is 0.95 m since iteration 3); the header's reason the reclassification was harmless, which was wrong — it was not the meshes' x positions (the gate's own `farBlockers` shows the slabs named at z -14.25 and -14.50) but that `right walkway`, the solid directly beneath them, was already in `TERRACE`; and two error-message papercuts where a truncated JSON artifact threw a bare `SyntaxError` naming neither the file nor the fix.

**Accepted and NOT fixed**, deliberately, both recorded as bounds instead:

- **`japan.webp` is half of what `compare` scores and is bound by nothing** — not in the mtime list, and excluded from the hash. A changed reference photo moves every score with no guard anywhere in this repo. It is now named in `compare.js`'s header as the largest remaining hole in the score's provenance. Accepted by the integration owner as a BOUND and not a task: the photo is the reference, and what binds it is its own bytes in git. Recorded here as the scene-lane fact it is.
- **`docs/render.webp` is outside the binding.** The one rendered artifact that enters Git is encoded from `out/render.png` without consulting the sidecar, so it can be encoded from a render whose tree has moved. `render-webp.js` was not in this task's scope and adding a refusal to it is a behaviour change to an untouched gate. Accepted as a bound; the integration owner will assign it separately if it earns its place.

## Traps for the next session

- **A gate's set membership is not visible in its verdict.** Both misclassified meshes passed every assertion in the gate for a whole iteration. What found them was a reviewer reading the regex, and what would have found them is the printed set — which the tool did print, for four of its six sets. The terrace was one of the two it did not.
- **"It reads 5 mm long" was the shape of the defect, not its size.** The flagstones are 5 mm thick, so 5 mm is what you get from the source. The ray found up to 1.02 m, because slab rows are laid flat and the band under them ramps. Measure the surface, do not subtract the thickness.
- **A reproducibility claim needs a control, and this one could not use a second run as its control.** The defect is load-dependent — it is about how many loop frames fit in a rAF pair — and this machine was idle, so four green runs would have proved nothing. The control had to be made load-independent by rendering each settle state on purpose.
- **`x | tail` reports tail's exit status.** `npm run treecheck | tail -22` printed a full red report and `$?` read 0. The real status needed `node tools/treecheck.js` with no pipe. This is in the canon and it still caught a run here.
- **A settle loop changes what "drift" means.** Any note computed as "the difference between step N and the final read-back" silently changes meaning when a step is inserted between them.
- **A counter whose floor you guessed hides the cases nearest the floor.** The settle note was gated at "more than one" on a belief that the loop's floor was one; it is zero, because `break` skips the `for` increment. Correcting it turned three unconverged poses into four. Print from zero and let the reader see the floor.
- **`mv out out.bak && node tool.js; echo $?` reports the `mv`.** The `mv` was refused, `&&` short-circuited, and the echo printed 1 — which read exactly like the tool failing as intended. A fresh-clone test has to run somewhere that is actually fresh; this one was redone in a directory holding only `index.html` and a copy of `src/`.
- **Word lists want measuring, not describing.** Writing "it is a word list and it will miss things" costs nothing and proves nothing. And measuring it against INVENTED names proves nearly as little: sixteen made-up names gave nine misses, and the scene's own name sets gave WALK 6 of 14, CANOPY 1 of 2, LIVING 7 of 33. Measure a filter against the population it will actually see.
- **A checker is not exempt from the failure class it checks for.** `treecheck` exists because a run that compared nothing must not read as a pass, and it shipped printing FAIL and exiting 0 on a sidecar missing one field — because the record was dropped from the list that decides the exit status *after* its FAIL line was printed. Printing and exiting are two different code paths and only one of them is the verdict.
- **A green run says nothing about the checker.** Every version of `treecheck` in this session passed its green run. The blocker, the non-portable hash, the un-nameable pairing and the unmarked non-convergence were all found by reading, three of them by someone who had not written it.
- **`core.autocrlf` makes a content hash a property of the machine.** Any digest this repo computes over tracked text — for a binding, a cache key, a review quote — is CRLF here and LF on CI unless it normalises. There is no `.gitattributes` to stop it.
