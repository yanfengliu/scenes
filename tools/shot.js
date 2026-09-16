// npm run shot: render the photo view at 1200x1100 in headless chromium and save out/render.png.
// Fails on any console error, uncaught page error, or failed request.
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
// `compare`'s same-tree light check, and the verdict recorded here is what makes it diagnosable; no
// ABSOLUTE figure for the light is asserted anywhere, because the light in this scene is a property of
// the scene, an iteration lane moves it every iteration, and a pinned figure here is one someone has to
// raise and would eventually raise past the defect.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { startServer } from './serve.js';
import { launch, collectErrors, openScene, isSoftwareRenderer, rendererTag, postWarnings, ACTION_TIMEOUT_MS, HIDE_UI_CSS } from './lib/browser.js';
import { SHOT } from '../src/layout.js';
import { sourceTree, shortHash, diffTrees } from './lib/treehash.js';
import { isMainModule } from './serve.js';
// An import must never start a gate. Everything below runs only when node was asked to run THIS file;
// `node -e "import('./tools/x.js')"` loads it and does nothing. The block is not re-indented so that
// the diff that added it is three lines rather than the whole tool. Proved inert, per tool, by
// out/scratch/import-inert.mjs; the bound is in docs/learning/gate-proofs.md.
if (isMainModule(import.meta.url)) {

const OUT = 'out/render.png';
// Written beside the render, naming the tree it came from. `compare` refuses to score a render whose
// sidecar does not match the tree on disk, and `treecheck` is what compares this to a views sweep.
// See tools/lib/treehash.js for why the old binding (1-photo.png byte-identical to render.png) is gone.
const OUT_TREE = 'out/render.tree.json';
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
// Read BEFORE the page is opened, so it is the tree the browser is about to load and not whatever is on
// disk when the screenshot lands. Read again at the end and compared: an edit that arrives mid-run makes
// the frame a mixture, and a mixture must not be recorded as either tree.
const treeAtStart = sourceTree();
const server = await startServer({ port: 0, quiet: true });
const browser = await launch();
let errors = [];
let failure = null;
try {
  const page = await browser.newPage({ viewport: { width: SHOT.width, height: SHOT.height }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(ACTION_TIMEOUT_MS);
  errors = collectErrors(page);
  const readyStarted = Date.now();
  const info = await openScene(page, `${server.url}/`);
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
  // It returns `describe().post` as its LAST act, after both settle frames, so the post state recorded
  // beside the render is the one the shot frame was drawn with rather than the one readiness reported.
  // Free: this evaluate was already being made and already waiting out those frames.
  const postAtShot = await page.evaluate(async (css) => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    window.__scene.setTime(0);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    return window.__scene.describe().post;
  }, HIDE_UI_CSS);
  mkdirSync('out', { recursive: true });
  await page.screenshot({ path: OUT, type: 'png' });
  // The frame is on disk; now refuse it if it was not drawn by the full chain. Thrown, like the renderer
  // check above, so the `rmSync` in the failure path takes the render and its sidecar with it: a frame
  // drawn at a lesser rung must not be left for `compare` to score as the contract.
  checkPostState(postAtShot, info.post, postWarnings(page));
  // The tree must not have moved under the run. If it did, this frame is a mixture of two trees and
  // neither hash describes it, so there is nothing honest to record: fail, and let the `rmSync` below
  // take the render with it.
  const treeAtEnd = sourceTree();
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
    wroteAt: new Date().toISOString(),
  }, null, 1)}\n`);
  console.log(`wrote ${OUT} (${SHOT.width}x${SHOT.height})`);
  console.log(`renderer: ${rendererTag(info.renderer, false)}; draw calls: ${info.drawCalls}; triangles: ${info.triangles}`);
  console.log(
    `post chain: ${describeRung(postAtShot)}; the chain's own check measured ${postAtShot.verdict.badTaps}% `
    + `non-finite, mean luma ${postAtShot.verdict.meanLuma} against a plain-render reference of `
    + `${postAtShot.verdict.referenceLuma} (${postAtShot.verdict.lightKept} of it kept)`,
  );
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
