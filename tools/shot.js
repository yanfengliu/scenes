// npm run shot: render the active scene's photo view in headless chromium and save its scored frame.
// Fails on any console error, uncaught page error, or failed request.
//
// Scene 1 is the default and its frame is 1200x1100 at out/render.png; `SCENE=<id>` names another scene
// and the viewport and every output path come from that scene's entry in src/scenes.js (through
// tools/lib/scene.js). The page is opened at the repo root for scene 1, whose id is what a bare URL
// already loads; another scene asks for itself with `?scene=<id>`.
//
// THE RENDER IS THE CONTRACT: 1200x1100, the photo view, the clock pinned at t = 0, the page's own chrome
// hidden, the whole post chain. `docs/PLAN-scores.md` records what that frame scores and `npm test`
// asserts it, so nothing here may change the pixels. What changed on 2026-09-11 changes only the number
// of round-trips: hiding the chrome, pinning the clock and waiting for the compositor were three
// `page.evaluate` calls and are now one. Each of those waits for the frame in flight, which on SwiftShader
// is seconds and on a shared CI runner is a minute, and the same frames are rendered in the same order
// either way. Proved rather than argued: `out/render.png` came back byte-identical, sha256
// d29b76dd027263314e3b5436063f4d9d068c887e3ca8fb2d72589b47fb5ac203 on SwiftShader before and after the
// change, and `npm run compare` read the same 0.0749 / 0.4733 off it.
//
// ---- RENDERER ---------------------------------------------------------------------------------------
// SWIFTSHADER, AND THIS IS THE ONE GATE THAT TAKES NO GPU SWITCH. On 2026-09-15 every other gate moved to
// the GPU, because none of their verdicts depended on the CPU rasterizer. This one's does, and it is the
// reason the switch exists at all: the number `docs/PLAN-scores.md` records has to be the same number on
// this machine and on a CI runner, and a CPU rasterizer is deterministic across machines while a GPU
// driver is not. So there is deliberately no `SHOT_GPU`, and `GATES_GPU` does not reach here: a flag that
// could move these pixels is a flag that could move them by accident.
//
// The GPU frame was measured rather than assumed, and it is CLOSE: the same code with the launch flag as
// the only variable renders 0.074947 / 0.473324 on SwiftShader and 0.074844 / 0.474234 on this machine's
// RTX 4090, byte-identical across three GPU runs. Close is not the same. 348,221 of 1,320,000 channel
// values differ at the scoring resolution, the worst by 189 levels, and 0.0009 of SSIM is most of the
// 0.0010 this repo calls its cross-machine noise floor. The full measurement and what it would take to
// move the scored path onto the GPU are in docs/devlog/detailed/2026-09-15-gpu-gates.md.
//
// And the renderer it ACTUALLY got is CHECKED, not just printed. A machine where the software rasterizer
// was unavailable and chromium quietly handed back a GPU would write a different `out/render.png` and
// `compare` would pass it: the GPU frame scores 0.0748 / 0.4742 against thresholds of 0.0763 / 0.4703.
// The contract would be silently rewritten by a green run. So this tool fails instead, which is the only
// place in the repo that can tell the difference. Added 2026-09-15 after an independent review pointed
// out it was the cheapest gate left unwritten.
//
// ---- WHAT THE FRAME WAS DRAWN WITH, AND WHY IT IS RECORDED AND REFUSED ------------------------------
// On 2026-09-17 this gate drew a DIFFERENT frame from the same tree: sha256 0e56fc677faf against the
// e95a53185ee3 that three other runs of the same commit produced, scoring 0.0632 / 0.5718 against
// 0.05958 / 0.57134 and failing the cell-distance threshold. Nothing in this tool's output said what had
// changed. It printed the renderer, the draw calls, the triangles and the tree hash, and all four were
// identical in the good runs and the bad one; what differed was the light in the scene, and no gate in
// this repo recorded a single number about that.
//
// So the sidecar now carries `post`: the rung the post chain settled on, its scale, target size and
// sample count, the numbers `verifyComposer` measured getting there (badTaps, meanLuma, referenceLuma,
// lightKept) and the watchdog's counters. Those numbers cost nothing -- `describe().post` is already
// carried back by the evaluate this tool already makes -- and they are the difference between a flake
// that can be diagnosed from its artifacts and one that cannot. In the bad run they would have read
// referenceLuma 54.6 and meanLuma 72.7 against the 57.5 and 76.8 every good run prints, measured
// against the same scene with `scene.environment` removed (out/scratch/reflight.mjs, 2026-09-17).
//
// And the configuration is REFUSED, not just recorded. The contract frame is the chain AS DESIGNED, with
// no watchdog ratchet and the same configuration at the shot as at readiness. A frame drawn at a lesser
// rung is a different frame and would be written to `out/render.png` for `compare` to score as if it
// were the contract: the five rungs available at 1200x1100 on SwiftShader produce five different files,
// e95a53185ee3 (the designed one), 1f74009907c0, 1825c9dd2e0f, d1d5527ad529 and e11e4d5135b8. And this
// is not hypothetical -- 1 of 25 fresh runs of this tool on this machine ratcheted its watchdog on a
// healthy frame and drew 1f74009907c0 (out/scratch/shot-loop2.log run 18, 2026-09-17). That cause is
// fixed in src/post.js; this refusal is what makes the next one of its kind red instead of scored.
//
// THE PREDICATE IS `designed`, NOT `rung === 0`, and that was measured rather than chosen. The rung is an
// index into the rungs that FIT the memory budget at this size, and `ladder()` drops any whose targets
// would exceed 512 MiB, so on a large high-density window index 0 of what survives is already a lesser
// chain. Red-proved with `TARGET_BYTE_BUDGET = 1`: the chain reports rung 0, a 1200x1100 target with 0
// samples, and a gate that asked only for index 0 would have written it to the contract. (`designed`
// means the top of the ladder for this drawing buffer; on a high-density display `renderScale()` can cap
// the supersample to 1.0 and that is still the designed chain. The recorded `scale` is what says which.)
//
// Bounds, and they are real. This refuses a configuration and it does not refuse a dim frame: the rung
// was NOT the mechanism of the 0e56fc677faf frame, which was drawn at the designed rung with the right
// size and samples (see docs/devlog/detailed/2026-09-17-shot-rung.md). What is aimed at that class is
// `compare`'s same-tree light check, the ENVIRONMENT refusal below, and the verdict recorded here that
// makes both diagnosable; no ABSOLUTE figure for the light is asserted anywhere, because the light in
// this scene is a property of the scene, an iteration lane moves it every iteration, and a pinned figure
// here is one someone has to raise and would eventually raise past the defect.
//
// ---- AND THE LIGHT THE FRAME WAS DRAWN WITH ---------------------------------------------------------
// The signature of that unexplained frame is the loss of the sky's environment map: removing it puts 416
// of 528 cells on the bad frame exactly, against 63 for the good one, with a residual below the rounding
// of the recorded means over 86% of the frame. `src/lighting.js` now proves that map instead of building
// it and walking away -- it measures the radiance the map carries, the image height three compiles its
// cube-UV lookup from, which environment each lit program was built against, and what the map actually
// adds to the photo view -- and reports all of it through `describe().env`. `checkEnvState` below refuses
// the frame on that state, and the numbers go into the sidecar beside the post block. It costs no
// round-trip: it rides the evaluate this tool already makes, and `describe()` builds the block without
// rendering anything. Proved not to move a pixel: out/render.png is byte-identical across the change
// (sha256 ef7a32617aa6f91f on SwiftShader, both before and after).
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { startServer } from './serve.js';
import { launch, collectErrors, openScene, isSoftwareRenderer, rendererTag, postWarnings, ACTION_TIMEOUT_MS, HIDE_UI_CSS } from './lib/browser.js';
import { sourceTree, shortHash, diffTrees, SOURCE_PATHS } from './lib/treehash.js';
import { isMainModule } from './serve.js';
// An import must never start a gate. Everything below runs only when node was asked to run THIS file;
// `node -e "import('./tools/x.js')"` loads it and does nothing. The block is not re-indented so that
// the diff that added it is three lines rather than the whole tool. Proved inert, per tool, by
// out/scratch/import-inert.mjs; the bound is in docs/learning/gate-proofs.md.
if (isMainModule(import.meta.url)) {

// Which scene this run is for, and where its artifacts live. A dynamic import inside the guard, so
// `node -e "import('./tools/shot.js')"` does not even load the registry, and so a mistyped SCENE prints
// one FAIL line naming the ids that exist instead of a stack trace out of this module's own imports.
let active;
try {
  active = await import('./lib/scene.js');
} catch (err) {
  console.error(`FAIL: ${err.message}`);
  process.exit(1);
}
const { scene, isDefaultScene, renderPath: OUT, treePath: OUT_TREE, sourcePaths: SCENE_SOURCE_PATHS } = active;
// The viewport, under the name the rest of this file already uses for it.
const SHOT = scene.shot;
// Written beside the render, naming the tree it came from. `compare` refuses to score a render whose
// sidecar does not match the tree on disk, and `treecheck` is what compares this to a views sweep.
// See tools/lib/treehash.js for why the old binding (1-photo.png byte-identical to render.png) is gone.
const started = Date.now();

// The contract frame is the full chain. This throws unless it was.
//
// `atShot` is `describe().post` read after the two settle frames and before the screenshot; `atReady` is
// the same object as `openScene` reported it, one frame earlier; `warned` is every `post:` warning the
// page printed (tools/lib/browser.js). Three different ways of asking the same question, because each
// one is blind somewhere: the rung is a number the page could report while lying about the frame, the
// warning is a string src/post.js could stop printing, and the pair only differ if something re-tuned
// inside this tool's own window.
function describeRung(post) {
  return `rung ${post.rung} (${post.cost}), a ${post.width}x${post.height} target at scale ${post.scale} with ${post.samples} samples`;
}
// The CONFIGURATION half of the post state, with the watchdog's running counters dropped. Those counters
// move on their own -- a contradicted black reading bumps `falseAlarms` without touching a single pixel --
// so comparing the whole object between readiness and the shot would red a healthy run for an event that
// changed nothing. `ratchets` is asked about separately below, where it means something.
function configOf(post) {
  const { watch, ...config } = post;
  return JSON.stringify(config);
}
function checkPostState(atShot, atReady, warned) {
  if (!atShot) {
    throw new Error(
      'the page reported no post-chain state at all (window.__scene.describe().post was null), so there is '
      + 'no record of what this frame was drawn with and it cannot be accepted as the contract. '
      + 'src/post.js sets it in tuneComposer, which src/main.js calls through buildComposer before the '
      + 'first frame, so a null here means the composer was never built or the page is not this scene.',
    );
  }
  // Every reason is collected and every one is reported, rather than stopping at the first. Three of the
  // four are reachable together and only together on this machine at this size -- a step-down warns AND
  // moves the rung, a watchdog ratchet does all three -- so a report that named one of them would hide
  // which of the checks actually did the work, and a reader would have to guess. Each is kept because
  // each is the only one that survives a different future change: the rung is a number the page reports
  // about itself, the warning is a string src/post.js could stop printing, the ratchet is the only one
  // that says WHY, and the pair only differ if something re-tuned inside this tool's own window.
  if (!atShot.verdict) {
    throw new Error(
      'the page reported a post-chain state with no verdict in it, so there is no record of what the '
      + `chain measured when it accepted this configuration: ${JSON.stringify(atShot)}. tuneComposer in `
      + 'src/post.js puts one there on every rung it tries, so a state without one is a shape this tool '
      + 'does not know and must not record as the contract.',
    );
  }
  const why = [];
  // `designed`, not `rung === 0`. The rung is an index into the rungs that FIT the memory budget at this
  // size, so on a window where the budget drops the top of the ladder, index 0 is already a lesser chain.
  // Both are named, because a reader who sees "rung 0" in the printed line needs to know why it failed.
  if (!atShot.designed) {
    why.push(
      `it was drawn at ${describeRung(atShot)}, which is not the chain as designed. (src/post.js marks the `
      + 'designed rung; the rung NUMBER is an index into the rungs that fit the memory budget at this size, '
      + `so index 0 is not by itself the full chain, and this frame's index is ${atShot.rung} with fallback `
      + `${atShot.fallback}.)`,
    );
  }
  const ratchets = atShot.watch ? atShot.watch.ratchets : 0;
  if (ratchets > 0) {
    why.push(
      `the post chain's watchdog stepped down ${ratchets} time(s) while this frame was being made, leaving `
      + `the chain at ${describeRung(atShot)}. watchPostChain in src/post.js fires when all nine of its `
      + 'probe pixels read below luma 24, which means the frame went black after the chain had already '
      + 'been verified at this size.',
    );
  }
  if (warned.length) {
    // The first two and a count. A ratcheting watchdog produces one pair every 500 ms, so the whole list
    // is dozens of lines of the same two sentences; every one of them is already above, echoed as it
    // arrived (tools/lib/browser.js), and a failure surface that buries its other reasons under them is
    // worse than one that points at them.
    why.push(
      `the page announced ${warned.length} post-chain step-down(s), the first being: ${warned.slice(0, 2).join(' | ')}`
      + `${warned.length > 2 ? ` (and ${warned.length - 2} more, each echoed above as a "page: post:" line)` : ''}`,
    );
  }
  if (atReady && configOf(atReady) !== configOf(atShot)) {
    why.push(
      'the post chain was re-tuned between the scene becoming ready and the screenshot, so the frame on '
      + `disk was not drawn with the configuration this run verified. At readiness: ${configOf(atReady)}. `
      + `At the shot: ${configOf(atShot)}.`,
    );
  }
  if (!why.length) return;
  throw new Error(
    `this frame was not drawn by the full post chain, so it is not the contract docs/PLAN-scores.md `
    + `records:\n  ${why.join('\n  ')}\n`
    + '  The frame drawn at any other configuration is a different frame -- the five rungs available at '
    + '1200x1100 on SwiftShader produce five different files -- so it has NOT been left at out/render.png. '
    + 'A step-down means the top rung did not survive on this driver at this size; src/post.js says what '
    + 'it measured, and any "page: post:" line above carries the numbers.',
  );
}
// The contract frame is also the frame the environment map actually reached. This throws unless it was.
//
// `src/lighting.js` builds an image-based light out of the sky dome, proves it, and reports what it
// measured through `describe().env`; this is the half that refuses. It exists because of the one frame
// this gate has drawn that nothing here could explain: on 2026-09-17 `out/render.png` came back
// 0e56fc677faf scoring 0.0632 / 0.5718 from a tree that scored 0.05958 / 0.57134 in three other runs, and
// the difference between those two frames is exactly this map's contribution -- 416 of 528 cells land on
// the bad frame when the environment is removed, against 63 for the good one. The post-chain refusals
// added the same day cover a DIFFERENT member of that class and are stated as not covering this one.
// This is the check aimed at it.
//
// Three reasons, and each is the only one that survives a different future fault:
//   - `ok` false is the proof itself failing: a black map, a map whose image height is 0 (which makes
//     three's cube-UV lookup return black however much radiance the texture holds), lit materials
//     compiled against a different environment, a swapped or cleared `scene.environment`, an intensity
//     that is not the rig's, or a map that adds less light to the frame than the floor in ENV_PROBE.
//     The reasons come up in `why` and every one of them is printed.
//   - `builds` above 1 is the rig having had to make the map a second time. That frame may well be
//     byte-identical to the contract -- the sky dome is deterministic, so a good rebuild is the same map
//     -- and it is refused anyway, because the first build carrying no light is the 2026-09-17 event
//     happening in front of us and a green run would bury it in a log nobody reads. This is the one
//     refusal here that is about the machine rather than about the pixels.
//   - No state at all means the page is not reporting it, and a frame with no record of its light is
//     exactly what 2026-09-17 was.
//
// Its bound: the map and the contribution are measured ONCE, when the rig is built. A map that goes black
// after that is invisible to this, and only the cheap half -- the identity of the texture, its height,
// the intensity and the per-material binding -- is re-read at the shot. There is no watchdog for the
// light the way there is one for the post chain.
// ONE SCENE IS REQUIRED TO CARRY THIS, NOT EVERY SCENE, and that is the whole reason `required` exists.
// The proof is in `src/lighting.js`, which is scene 1's rig; a second scene has its own folder under
// `src/` and its own rig -- `src/whitehouse/lighting.js` assigns `scene.environment` with no proof around
// it and `src/whitehouse/main.js`'s `describe()` returns no `env` at all. `tools/test.js` runs this tool
// for every scene, so demanding the block unconditionally would have made `SCENE=whitehouse npm test` an
// unconditional red on a scene this lane never touched. Caught by an independent review before it shipped.
// A scene that reports a block is CHECKED whatever scene it is; only the default scene must have one.
function checkEnvState(env, required) {
  if (!env) {
    if (!required) {
      console.log(
        "this scene's rig does not prove its environment map, so there is no light record beside this "
        + 'frame. src/lighting.js does it for scene 1; a scene with its own rig under src/ carries its own '
        + 'or carries none.',
      );
      return;
    }
    throw new Error(
      'the page reported no environment state at all (window.__scene.describe().env was null), so there is '
      + 'no record of the light this frame was drawn with and it cannot be accepted as the contract. '
      + 'src/lighting.js sets it in installEnvironment, which buildLighting calls before src/main.js '
      + 'builds the composer, so a null here means the rig was never built or the page is not this scene.',
    );
  }
  const why = [];
  if (env.ok !== true) why.push(...env.why);
  if (env.builds > 1) {
    // The second half of this sentence branches on whether the rebuild actually worked, because it did
    // not in two of the four mutations that reach here and a message promising "the frame may be
    // identical to the contract" about a frame drawn with a dead map would send a reader looking for
    // something that is not there. Caught by an independent review after the headline had already been
    // fixed for the same reason.
    why.push(
      `the sky's environment map had to be built ${env.builds} times, so the first build of it on this run `
      + 'was black or the wrong shape'
      + (env.ok === true
        ? '. The frame may well be identical to the contract -- the dome is deterministic, so a rebuild '
          + 'that works is the same map -- and it is refused anyway: a first build that carries no light is '
          + 'the unexplained 2026-09-17 flake happening on this machine, and it must not be scored as if '
          + 'nothing had happened. Run npm run shot again'
        : ', and the rebuild did not fix it either, for the reason(s) above')
      + '. docs/devlog/detailed/2026-09-17-env-proof.md says what to read next.',
    );
  }
  if (!why.length) return;
  // The headline says which of the two happened, because they are different faults and a message that
  // said "did not get the light" about a frame that got all of it -- a rebuild that then worked -- would
  // send a reader looking for a dark frame that does not exist.
  const lead = env.ok !== true
    ? 'this frame did not get the light the scene is supposed to have, so it is not the contract docs/PLAN-scores.md records:'
    : 'this frame got the light it should have, and the map behind it did not build cleanly, so it is not the contract docs/PLAN-scores.md records:';
  throw new Error(
    `${lead}\n  ${why.join('\n  ')}\n`
    + `  The map measured mean luma ${env.map.meanLuma} over its own texels and added `
    + `${env.contribution.delta} of a luma level to the photo view (${env.contribution.withEnv} against `
    + `${env.contribution.without} with the environment turned off), against a floor of ${env.floor}; `
    + `${env.binding.mismatched} of ${env.binding.compiled} lit materials with a program disagree about `
    + `which environment they were compiled for. The frame has NOT been left at ${OUT}. `
    + 'src/lighting.js says what each of those numbers is and what a healthy one looks like.',
  );
}
// Read BEFORE the page is opened, so it is the tree the browser is about to load and not whatever is on
// disk when the screenshot lands. Read again at the end and compared: an edit that arrives mid-run makes
// the frame a mixture, and a mixture must not be recorded as either tree.
// THIS SCENE'S source, not every scene's: the registry entry names the paths, so another scene's folder
// moving cannot invalidate this scene's render. It could before -- the walk was recursive over all of
// src/ -- and the failure was not theoretical: a second scene's edit landing mid-run made this tool delete
// its own render and sidecar as "a mixture of two trees".
const treeAtStart = sourceTree({ paths: SCENE_SOURCE_PATHS ?? SOURCE_PATHS });
const server = await startServer({ port: 0, quiet: true });
const browser = await launch();
let errors = [];
let failure = null;
try {
  const page = await browser.newPage({ viewport: { width: SHOT.width, height: SHOT.height }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(ACTION_TIMEOUT_MS);
  errors = collectErrors(page);
  const readyStarted = Date.now();
  // A bare URL is what index.html already resolves to scene 1, which is the default; any other scene asks
  // the page for itself by id. Scene 1's URL, and so the provenance of its contract frame, is unchanged.
  const sceneUrl = isDefaultScene ? `${server.url}/` : `${server.url}/?scene=${encodeURIComponent(scene.id)}`;
  const info = await openScene(page, sceneUrl);
  // How long the scene took to become ready, recorded beside the frame. It is not asserted and it is not
  // a performance number: it is the one field that both known bad frames share. The 2026-09-17 flake read
  // 13.7 s and the watchdog ratchet this loop caught read 14.5 s, against 18.1 s or more in every one of
  // about eighty good runs on this machine, so a sidecar that carries it lets the next investigation sort
  // runs by it instead of waiting for a wrong digest. What it is NOT is a cause: the forced reproduction
  // of the ratchet is SLOWER than its control (33.0 s against 25.2 s), so this is a correlation seen
  // twice in the field and not a mechanism.
  const readySeconds = +((Date.now() - readyStarted) / 1000).toFixed(1);
  // Before anything is rendered to disk: this frame is the contract, and the contract is a SwiftShader
  // frame. Thrown rather than returned so it lands in the same `catch` as every other failure here and
  // the render is removed by the `rmSync` below, instead of leaving a GPU frame at out/render.png for
  // `compare` to score.
  if (!isSoftwareRenderer(info.renderer)) {
    throw new Error(
      `this render must come from a software rasterizer and this chromium gave "${info.renderer}". `
      + 'out/render.png is the byte-for-byte contract docs/PLAN-scores.md records, and a GPU renders it '
      + 'differently while still scoring inside the thresholds -- 0.0748 / 0.4742 on an RTX 4090 against '
      + '0.0749 / 0.4733 on SwiftShader -- so a GPU frame here would rewrite the contract and pass. '
      + 'Nothing in this tool asks for a GPU, so this means the software rasterizer was unavailable: '
      + 'check that chromium still accepts --enable-unsafe-swiftshader (tools/lib/browser.js, WEBGL_ARGS). '
      + 'If this renderer IS a CPU rasterizer under a name this repo has not met, add it to '
      + 'isSoftwareRenderer in tools/lib/browser.js.',
    );
  }
  // One evaluate for the three things that have to happen before the shot, in the same order they
  // happened in when they were three: hide the page's own chrome (`addStyleTag` appends exactly this
  // element), pin the clock at t = 0 -- the scene animates, and the scored frame is that one every run --
  // and let the frame loop present two more frames so the compositor has the canvas the screenshot
  // captures.
  //
  // It returns `describe()`'s post-chain and environment state as its LAST act, after both settle frames,
  // so what is recorded beside the render is what the shot frame was drawn with rather than what readiness
  // reported. Free: this evaluate was already being made and already waiting out those frames, and
  // `describe()` builds both blocks without rendering anything.
  const { post: postAtShot, env: envAtShot } = await page.evaluate(async (css) => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    window.__scene.setTime(0);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const described = window.__scene.describe();
    return { post: described.post, env: described.env };
  }, HIDE_UI_CSS);
  mkdirSync(scene.out, { recursive: true });
  await page.screenshot({ path: OUT, type: 'png' });
  // The frame is on disk; now refuse it if it was not drawn by the full chain. Thrown, like the renderer
  // check above, so the `rmSync` in the failure path takes the render and its sidecar with it: a frame
  // drawn at a lesser rung must not be left for `compare` to score as the contract.
  checkPostState(postAtShot, info.post, postWarnings(page));
  checkEnvState(envAtShot, isDefaultScene);
  // The tree must not have moved under the run. If it did, this frame is a mixture of two trees and
  // neither hash describes it, so there is nothing honest to record: fail, and let the `rmSync` below
  // take the render with it.
  const treeAtEnd = sourceTree({ paths: SCENE_SOURCE_PATHS ?? SOURCE_PATHS });
  if (treeAtEnd.hash !== treeAtStart.hash) {
    throw new Error(
      `the scene source changed while this render was being made: ${shortHash(treeAtStart.hash)} when the `
      + `page was opened, ${shortHash(treeAtEnd.hash)} after the screenshot. The frame is a mixture of two `
      + 'trees and out/render.png is the contract docs/PLAN-scores.md records, so the frame this run took '
      + 'has been REMOVED rather than left for compare to score. '
      + `Changed: ${diffTrees(treeAtStart, treeAtEnd, 'the open', 'the screenshot').join('; ')}. `
      + 'Let the edit settle and run npm run shot again.',
    );
  }
  writeFileSync(OUT_TREE, `${JSON.stringify({
    render: OUT,
    renderSha256: createHash('sha256').update(readFileSync(OUT)).digest('hex'),
    renderer: rendererTag(info.renderer, false),
    width: SHOT.width,
    height: SHOT.height,
    sourceTree: treeAtEnd.hash,
    sourceFileCount: treeAtEnd.count,
    sourceFiles: treeAtEnd.files,
    readySeconds,
    // What the post chain was when this frame was drawn, read after the settle frames. `compare` refuses
    // a sidecar without it, without a verdict in it, or with a rung it does not mark as the chain as
    // designed; the verdict numbers inside it are the record that makes a flake diagnosable, and no
    // absolute figure for them is asserted anywhere (see the header).
    post: postAtShot,
    // And the light feeding that chain: what src/lighting.js measured of the environment map it built,
    // plus the cheap half re-read at the shot. `compare` refuses a sidecar without it or with a state
    // that is not ok. No absolute figure is asserted anywhere for the same reason the post verdict's
    // numbers are not: the light in this scene is a property of the scene and an iteration lane moves it.
    env: envAtShot,
    wroteAt: new Date().toISOString(),
  }, null, 1)}\n`);
  console.log(`wrote ${OUT} (${SHOT.width}x${SHOT.height})`);
  console.log(`renderer: ${rendererTag(info.renderer, false)}; draw calls: ${info.drawCalls}; triangles: ${info.triangles}`);
  console.log(
    `post chain: ${describeRung(postAtShot)}; the chain's own check measured ${postAtShot.verdict.badTaps}% `
    + `non-finite, mean luma ${postAtShot.verdict.meanLuma} against a plain-render reference of `
    + `${postAtShot.verdict.referenceLuma} (${postAtShot.verdict.lightKept} of it kept)`,
  );
  if (envAtShot) {
    console.log(
      `environment map: mean luma ${envAtShot.map.meanLuma} over ${envAtShot.shape.width}x${envAtShot.shape.height} `
      + `(${envAtShot.map.badTaps}% non-finite), adding ${envAtShot.contribution.delta} of a luma level to the `
      + `photo view (${envAtShot.contribution.withEnv} against ${envAtShot.contribution.without} with it off, `
      + `floor ${envAtShot.floor}); ${envAtShot.binding.compiled} of ${envAtShot.binding.lit} lit materials `
      + `have a program and ${envAtShot.binding.mismatched} disagree${envAtShot.builds > 1 ? `; the map was built ${envAtShot.builds} times` : ''}`,
    );
  }
  // The watchdog's counters, printed whenever they are not all zero. A contradicted black reading does
  // not fail this gate -- the frame it was about turned out to be fine -- but it is the event that made
  // this run's first frames different from every other run's, and a log that hid it would hide the one
  // trace of it. `blind` means the watchdog gave up on this page because the reads were noise.
  const w = postAtShot.watch ?? {};
  if (w.falseAlarms || w.ratchets || w.blind || w.floor) {
    console.log(
      `post watchdog: ${w.ratchets ?? 0} ratchet(s), ${w.falseAlarms ?? 0} contradicted black reading(s), `
      + `floor ${w.floor ?? 0}${w.blind ? ', and it has switched itself off for this page' : ''}`,
    );
  }
  console.log(`scene source tree ${shortHash(treeAtEnd.hash)} over ${treeAtEnd.count} files, recorded in ${OUT_TREE}`);
  console.log(`rendered the scored frame in ${((Date.now() - started) / 1000).toFixed(0)} s`);
} catch (err) {
  failure = err;
} finally {
  await browser.close();
  await server.close();
}
if (errors.length) {
  console.error(`FAIL: ${errors.length} page error(s):`);
  for (const e of errors) console.error(`  ${e}`);
}
if (failure) console.error(`FAIL: ${failure.message}`);
if (errors.length || failure) {
  // A render from a page with errors is not evidence: remove it so compare cannot score it. The sidecar
  // goes with it — a tree record left beside a deleted render would describe the PREVIOUS render, and
  // compare and treecheck both read it as if it described this one.
  rmSync(OUT, { force: true });
  rmSync(OUT_TREE, { force: true });
  process.exit(1);
}

}
