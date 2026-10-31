# AGENTS.md — scenes

## What this is

Browser 3D sandbox scenes that test what a model can build from a single photo. Scene 1 (`index.html`) recreates `japan.webp`, a Kyoto Sannenzaka-style stepped street at sunset with a weeping cherry, in Three.js. The page loads framed exactly like the photo; drag orbits, the wheel zooms, and `R` or the on-screen button resets the photo view.
There is one page for every scene: the dropdown in the corner picks one, `?scene=<id>` names it in the URL, and the registry that lists them is `src/scenes.js`.

Goal: a render that scores as close as possible to the photo on the compare gate while staying a real 3D scene from any angle. Non-goals: photogrammetry, downloaded assets, a build step.

Stack: Three.js 0.185.1 as ES modules through a pinned jsdelivr import map (`three`, `three/addons/`), plain `index.html` plus `src/*.js`, no bundler. Node 24 (`.nvmrc`) runs the gates; Playwright 1.61.1 (chromium) is the only dev dependency. Every asset is procedural.

The current work entry is `docs/work/0_japan-street-scene/plan.md`; it links to the preserved manager-authored phased plan. Scores and their thresholds are in `docs/PLAN-scores.md`. Repo-only rules: `docs/policies/local-rules.md`.

<!-- FLEET-CANON:BEGIN sha=e54f2a9ae007 generated from ../fleet/FLEET.md by `npm run sync-canon` — do not edit inside this block; this repo's own rules go in docs/policies/local-rules.md -->
## Fleet constitution

Reasons and evidence per `[Rn]`: `../fleet/docs/canon-rationale.md`. `../fleet/` is fleet's checkout beside the repo's primary checkout, also from a worktree. The designated coordinator reads `../fleet/docs/skills/coordinator.md` before planning and after each compaction, and any agent reads that file's "Delegate" section before delegating. Before these kinds of work, read the matching section of `../fleet/docs/work-rules.md`: visual and interactive work; games, simulations and research; measuring, debugging and slow steps; writing error messages; toolchains, dependencies and model calls; standing loops and unattended runs; pushing executable changes; a user-reported defect; editing skills, agent instructions or rules; run output and files over 256 KiB; handing off or stopping mid-task.

### Fleet Orchestration Policy

Deliver the requested outcome with verified correctness, coherent architecture and minimal necessary complexity. Optimize useful progress, not agent count, code volume or maximum reasoning. Adapt rigor to risk. This policy grants no new permissions or capabilities. [R1]

**Roles.** Only an explicitly designated agent coordinates; each scope has one accountable integration owner. [R2]

Workers own bounded outcomes and local implementation decisions. [R3]

Inspect instructions, code, docs, tree state and active tasks; set outcome, non-goals, acceptance criteria, dependencies and verification; settle ambiguity with evidence and reversible defaults. [R4]

**Session size** (owner directives, 2026-09-23 and 2026-10-22). Sessions run long: take new requests as separate assignments in the same session, and never hand off to a successor session to shed context; auto-compaction carries the session. Split tasks expected to exceed about 200k context tokens into milestones within that budget, each committed and merged to main once green. Milestones are task boundaries; a compaction never justifies wrapping up or handing off. [R6]

**Coordinate safely.** Beyond a trivial read, each session or agent defaults to its own worktree; serialize overlapping writes only when none is available, and say why. Finish each bounded increment in its session: merge to main, push, then `git worktree remove`, remove completed task-owned branches and unneeded temporary files, and explicitly transfer the ownership and location of still-needed resources. Report any merged worktree left and its location as a defect. Never overwrite or discard another participant's work. On resumption, first inspect surviving worktrees, artifacts and task status, assuming nothing survived until checked; recover what exists and preserve unfinished work. [R7]

Workers act autonomously in scope; escalate cross-task interfaces, persistent formats, security boundaries, major dependencies and scope changes to the coordinator for resolution within the approved mandate. Unapproved major architecture or product changes and consequential external actions need human authorization. Fleet rules (FLEET.md, the fleet's skills and runbooks, canon candidates, and agent memory) change only when the owner asks (owner directive, 2026-10-28). Agents propose changes instead of making them. The one exception: they may add a proposal to `../fleet/canon-candidates.md`, with the lesson, its evidence and the rule it would change (owner directive, 2026-10-29). They never change, promote or delete an entry: the owner decides each one, and the session the owner asks makes the change. Never reset consumed allowances. [R8]

**Implement and verify.** Inspect, implement a coherent increment, check, diagnose, fix, recheck. Preserve architecture; no unrelated rewrites, speculative abstractions or unnecessary dependencies. Implement when requested. Use task-appropriate evidence and baselines; prototype uncertain ideas before generalizing. Never weaken tests or conceal failures to claim success. Docs-only work uses content and version checks; skip runtime tests and CI waits. [R9]

During authorized work and within scope and budget, proactively improve products and the task's orchestration, learn from recorded outcomes and propose improvements to fleet rules. Read `../fleet/docs/skills/self-improvement/SKILL.md` when proposing a fleet-rule change or turning a mistake into a gate (owner directive, 2026-10-29). [R33]

Obtain independent, preferably read-only review for substantial or high-risk changes when available. Review the exact revision against acceptance criteria. Report unavailable review; fix justified findings, rerun affected checks, and obtain focused re-review when fixes invalidate earlier review. [R10]

**Integrate, report, and stop.** Reassess after two failures for one reason. Unless another budget is set or the user authorizes more, cap automatic repair at five substantive attempts, then report; explicit overrides hold for their stated scope without asking again. Keep updates brief and decision-relevant. Stop when acceptance criteria and material findings are resolved; invent no follow-up work. [R11]

**Final acceptance gate.** The integration owner integrates in dependency order and on the final integrated revision's actual changes and evidence, not worker summaries, checks every acceptance criterion, runs relevant automated checks and exercises affected end-to-end behavior and cross-task interactions. Substantial or high-risk work gets independent read-only review of the integrated changes, integration fixes included. Confirm the merge to main; report that revision, review status and every failed, skipped or unavailable check and unmet criterion. Nothing is fully verified with an open material finding or required check. [R12]

### Fleet conventions

- Repository rules add local constraints consistent with this policy; they cannot override its permissions, adaptive workflow or stopping limits. [R13]
- Gates pass before any commit touching code, a merge included: merge on a detached HEAD or its own branch and move main to it once its gate passes. The user's standing grant covers committing, merging to main and pushing in their repos; force-pushing, rewriting history, deploying and publishing still need authorization. Work is done only once merged to main, regardless of green branch or worktree gates; report unmerged work's location. [R14]
- For substantial or high-risk changes, use independent review when available. High-risk includes persistence and migrations, security and auth, concurrency, money, supply chain, and executable changes in sibling repos; `../fleet/docs/skills/multi-cli-review.md` provides the review mechanics. [R10]
- Reviewer model pins live only in `../fleet/docs/skills/multi-cli-review.md`; every model a product calls is pinned in its calling repo. No model IDs are hardcoded elsewhere. [R29]
- Read `docs/learning/lessons.md` at session start. Record the session's lessons there; each names its retiring gate and is deleted in the commit landing it. A gate counts only after going red with the defect reintroduced, following `../fleet/docs/lessons-template.md`. [R18]
- Gates prove nothing beyond their bounds: name the bound in the header and pin every reproducing input. Distinguish passed from did-not-run; a check built from its checked symbol proves only self-agreement. [R19]
- Verify outcomes beyond exit status, red or green, and return values: read the artifact that should have changed. Retest inherited blockers before repeating them. [R20]
- Keep plans and every authored review round in permanent `docs/work/<id>_<theme>/` folders (`../fleet/docs/work-docs.md`). Record history, not status: a dated devlog line per behaviour-changing session in `docs/devlog/summary.md` (`../fleet/docs/devlog-template.md`). [R24]
- Use common words with the same meaning in chat, docs, commits, PRs, comments and errors. One idea per sentence unless a rule needs more. Cut length, not facts: keep exact terms, numbers and evidence. Quotes and pastes are exempt; do not copy this canon's style. One line per paragraph, no hard wrapping. [R25]
- When blocked, immediately hand over the redacted artifact with the named blocker, before analysis; continue safe independent work. [R27]
- The owner's directions that outlive a task land that session in `../fleet/FLEET.md` if fleet-wide, otherwise the repo's `docs/policies/local-rules.md`; report where. [R31]
- When a hard problem blocks progress, run the search in `../fleet/docs/skills/hard-problem.md`. [R32]
<!-- FLEET-CANON:END -->

## Gates

Read a gate's entry in [docs/policies/gates.md](docs/policies/gates.md) before changing the gate or relying on it. That file continues each line here with the gate's renderer, red proofs, bounds and measurements, and holds the suite's cost; this section is the short list.

- `npm test` runs `import-inert`, `shot`, `compare`, `placement`, `namerules`, `clearance`, `animation`, `nudge`, `blackframe` and `record`, then asserts the scores against the thresholds in `docs/PLAN-scores.md`. Needs network for the Three.js CDN and a cached Playwright chromium (`npx playwright install chromium` once).
- `npm test` also requires each tool to prove it ran: it captures the tool's output and fails, naming the tool, if the summary line that tool prints at the end of its checks is missing.
- **Which renderer a gate uses is a decision each gate states, and every gate prints the renderer it actually got.**
- CI has no GPU. It sets `GATES_GPU=0` and `BLACKFRAME_GPU=1`, which gives every gate there exactly the chromium flags and exactly the limits it had before any of this, and makes the renderer a stated choice instead of a property of the runner.
- `npm run import-inert` imports every tool in `tools/` in its own child process and fails unless each one loads and does NOTHING: exits 0, prints nothing, finishes fast.
- Every gate prints `scene ready in <n> s` per page it opens, against a 300 s ceiling.
- **A `page.evaluate` on the scene page waits for the frame in flight**, and that frame is the whole post chain. The frame's cost on each renderer, the `Invalid value used as weak map key` fault that stopped two attempts to break it down, and what one decode costs on each page are in [its entry](docs/policies/gates.md#round-trips-to-the-scene-page).
- `npm run placement` runs two checks the scores cannot make.
- `npm run namerules` pins the population of every rule in this repo that selects meshes BY NAME, against `tools/name-manifest.json`, and fails when any of them moves.
- `npm run clearance` asks what the walkable street keeps clear, overhead and at ground level, in two checks off one page load.
- `npm run groundcover` asks whether the ground covers the world, in the one scene that has a world to cover.
- `npm run animation` scores the photo view at seven points across the animation cycle and fails if the worst of them leaves tolerance.
- `npm run nudge` renders three poses twice each (identical output required), then moves the camera 2 mm and fails when too many pixels change drastically.
- `npm run blackframe` loads the scene at six window size and device pixel ratio combinations (including non-round ratios), measures the frame on load and again after a resize, and fails when the post chain hands back a black, flat, or nearly lightless frame.
- `npm run webp` encodes `out/render.png` as `docs/render.webp` (under 256 KiB) through chromium's own encoder.
- `npm run shot` renders the photo view at 1200x1100 in headless chromium to `out/render.png` and fails on any console error, page error, or failed request.
- `npm run compare` scores `out/render.png` against `japan.webp`: mean color distance over a 24x22 grid of cells (lower is better) and grayscale SSIM at 64 px (higher is better).
- `npm run try` asks **what does this tree score** and answers in seconds instead of a minute and a half, so an iteration lane can decide an A/B arm without the CPU rasterizer. **It is a diagnostic, not a gate**.
- `npm run record` drives the camera with real mouse events and checks every frame, failing when any one frame goes dark.
- `npm run views` renders seven fixed poses to `out/views/` so an iteration is inspected from angles the scored frame cannot see; it is a diagnostic, not a gate.
- `npm run treecheck` asks whether `out/render.tree.json`, `out/scores.json` and `out/views/index.txt` describe the same scene source tree, and the tree on disk, and names the files that differ when they do not.
- `npm run perf` prints the median frame time and draw calls over 5 s at 1920x1080. Budget: under 16 ms and under 400 draw calls.
- `npm run dev` serves the repo root on http://localhost:8080.
- `npm run probe -- u,v ...` names the mesh under each photo position and its pixel; `npm run inspect -- pair u0 v0 u1 v1` writes photo-versus-render crops. Both are diagnostics, not gates.
- `npm run shimmer` orbits the camera 0.1 degrees a frame through three poses at device pixel ratios 1 and 2 and scores the temporal second difference, `|2*F(i) - F(i-1) - F(i+1)|` as a frame mean and a worst 16x16 block, which cancels smooth motion and keeps pixels that toggle. It is a diagnostic, not a gate.

## Invariants & boundaries

The post chain's and the environment map's proofs in full, and what each of scene 1's modules in `src/` builds, are in [docs/policies/invariants.md](docs/policies/invariants.md).

- The photo view is the contract. `src/layout.js` holds the camera model and every landmark's photo position, and the tools import it; changing the camera moves every placement and invalidates the thresholds.
- The post chain is proved, not assumed. `src/post.js` renders one real frame on build and on every size change and looks at it, because a multisampled half-float target of the wrong size turns the frame to NaN on some drivers with no error, no context loss and a complete framebuffer. If the frame is not there it steps down a ladder of configurations (fewer multisamples, a neighbouring size, no supersample, no multisampling) and says so in the console, and it starts again from the top at the next size so no machine is held to a lesser chain.
- **The environment map is proved, not assumed** — the same rule as the post chain, and it landed on 2026-09-17 for the same reason. `src/lighting.js` builds an image-based light out of the sky dome and hands it to every lit material, and until then it built that map and never looked at it.
- The frame is lit and tone mapped from phase 4: `src/main.js` builds the rig (`lighting.js`) and the post chain (`post.js`), and every color in `src/layout.js` is a *displayed* target, not an albedo. `src/tonemap.js` inverts the ACES curve three applies, and `materials.js` turns each sampled mean into the albedo that displays as that mean again through the rig and the curve. Add a color the same way: sample it from the photo, hand it to `material()` or `surface()`, and let the factory do the inversion.
- `index.html` is the only page. `src/boot.js` reads `?scene=<id>`, sets the tab title, mounts the picker (`src/picker.js`) and imports that scene's entry module named by the registry (`src/scenes.js`); an unknown or missing id loads the first entry. Scene 1's entry is `src/main.js` and its modules sit flat in `src/`, from when it was the only scene; a new scene is a registry entry plus its own folder under `src/`. Switching scenes reloads the page rather than swapping in place, so no scene has to know how to tear itself down.
- The page's chrome lives in one `#hud` box, because the gates that screenshot hide it wholesale (`HIDE_UI_CSS` in `tools/lib/browser.js`): a control added outside that box would land in the scored image.
- Repeated pieces are instanced geometry (one InstancedMesh per material): tiles, slats, slabs and stones are never painted on. The scene builds deterministically from fixed seeds, so the shot is reproducible.
- Every hand-built geometry must compute its normals. A missing normal attribute is invisible under an unlit material and produces NaN under a lit one, and one NaN texel spreads through the bloom blur to the whole frame.
- Photo space is (u right, v down) as fractions of the frame. World space is y up with the photo camera at x = 0 looking along -z; +x is the right side of the street.
- Nothing binary enters Git except `japan.webp` (the reference) and, in phase 5, `docs/render.webp` under 256 KiB. `out/` is ignored and regenerated by the gates.
- No runtime downloads except the pinned Three.js modules. No bundler, no build step.
- The integration owner maintains `docs/work/0_japan-street-scene/plan.md`. The original manager-authored plan at `docs/work/0_japan-street-scene/historical/PLAN.md` is preserved unchanged.

## Conventions

- Colors in `src/layout.js` are sRGB hex values sampled from the photo. Materials are unlit until phase 4; every procedural texture is corrected to its material's mean (`textures.js`), so textures add variation around the sampled color and never a new color. Where a lighter or darker element sits in front of a wall (joints, slats, shoji, mortar between stones), the wall's color is balanced (`balancedMean`) so the region still averages to the sampled mean. A few accents with no clean photo region (lattice slats, shoji paper, grid bars, the mortar and cap darkening factors) are set by eye and say so where they are defined. Normal and roughness maps are generated alongside each albedo and kept in `material.userData.pbr` for the lit materials of phase 4. Foliage is alpha-tested cards: the card textures are white shapes, and each instance's color is a sampled mean divided by the card's opaque-texel mean, so the visible mean lands on the sample. The cherry's blossoms take their colors from `src/photofield.js`, the photo's own cell means over the canopy, at their photo position; regenerate that field only if the photo changes.
- Anything the photo pins down is placed through the helpers: `uvToWorld` (a photo position at a depth), `rayHitGround` (drop a point onto a height field), `depthForU` (depth for a known side offset). Dimensions the photo cannot pin down (house depths, terrace lines, wall thicknesses) are block-out estimates typed into `src/layout.js`, or into the module that builds them, with the photo landmark they serve named nearby.
- Every mesh has a `name`; the probe tool maps a wrong pixel to its mesh.
- Anything that moves is animated in the vertex shader when there is more than a handful of it: `src/animation.js` patches a material's `project_vertex` with a wind offset and advances one time uniform, so 30,000 blossom cards and 420 petals cost no per-frame CPU. The clock is deterministic and `window.__scene.setTime(t)` pins it, which is how the gates stay reproducible.
