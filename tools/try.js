// npm run try: WHAT DOES THIS TREE SCORE? -- the fast arm for an iteration lane's A/B loop.
//
// A scene lane decides everything by A/B: move a constant, render the photo view, score it against
// japan.webp, keep the arm or discard it. Until this tool existed the only way to ask that question was
// `npm run shot && npm run compare`, which is a CPU rasterizer by design and cost 93 s a turn when it was
// timed here (58 s is the figure this repo quoted for a quieter machine; see the load note below). Iteration 5's devlog quotes more than thirty scored arms that survived into the writeup
// and says nothing about the ones that did not, so an iteration was spending on the order of an hour of
// wall clock waiting on SwiftShader while an RTX 4090 sat idle.
//
// This renders the same view at the same size with the same clock, scores it with the same two functions
// out of tools/lib/metrics.js, and does it on the GPU.
//
// ---- WHAT AN ARM COSTS ------------------------------------------------------------------------------
// MEASURED INTERLEAVED, because absolute seconds on this machine are worthless. The box this was measured
// on was at 100% across 32 logical cores with other repos' work on it, so a GPU arm timed at 10:05 and a
// software arm timed at 10:12 differ by the load as well as by the renderer -- which is this repo's own
// rule about an A/B needing the tree to hold still, with load as the confound instead of the tree. So the
// two arms were run BACK TO BACK, three times, on scene source tree dceabc6abdf61e7c (2026-09-17):
//     pair 1: GPU 14 s, software 85 s, ratio 6.1
//     pair 2: GPU 14 s, software 90 s, ratio 6.4
//     pair 3: GPU 15 s, software 88 s, ratio 5.9
// Median 6.1x. Against the real baseline, `npm run shot && npm run compare` in the same block, 93 s: 6.6x.
// THE SECONDS ARE UPPER BOUNDS UNDER A NAMED LOAD; the ratio is the claim.
//
// Where they go, which moves far less with load than the total does and is the reusable number:
//     GPU       launch and scene build 12.1   pose and two frames  0.0   screenshot  0.4   decodes 0.2
//     software  launch and scene build 36.9   pose and two frames 12.7   screenshot 29.8   decodes 4.4
// The frame work is 42.5 s of 85 on software and 0.4 s of 14 on the GPU -- that is the whole saving. What
// is left on the GPU is the scene BUILD, which every gate that opens this page pays and which is not this
// tool's to shorten. On a quiet machine both columns fall and the ratio is what survives.
//
// ---- WHAT THIS IS NOT -------------------------------------------------------------------------------
// NOT A GATE. It is in no suite, `npm test` does not run it, and it asserts nothing about the scene: there
// is no threshold here and there must never be one. `docs/PLAN-scores.md` is the contract and
// `shot` + `compare` are the only two tools that may speak for it.
//
// NOT THE CONTRACT, AND IT CANNOT BECOME ONE. It writes `out/try/render.png` and `out/try/score.json` and
// deliberately writes NEITHER `out/render.png` NOR `out/render.tree.json`. That is the whole reason for
// the separate directory: `compare` scores whatever PNG is at `out/render.png` and binds it to the
// sidecar beside it, so a GPU frame left at either path would be scored as the contract by the next green
// run, and the thresholds would quietly move onto a driver. A frame this tool drew can only ever reach
// `compare` if somebody copies it there by hand.
//
// ---- RENDERER ---------------------------------------------------------------------------------------
// THE GPU, and that is the point of the tool. `TRY_GPU=0` (or `GATES_GPU=0`) forces SwiftShader, which is
// how the two renderers are compared on one machine and how an arm that lands inside the margin below is
// re-measured without leaving this tool. The renderer it ACTUALLY got is printed on every run and the
// margin is keyed on it, never on what was asked for -- a fallback to software on a machine with no GPU is
// held to the software numbers.
//
// ---- THE MARGIN, WHICH IS THE WHOLE POINT ------------------------------------------------------------
// A lane deciding an arm on the GPU has to know WHEN THE GPU CANNOT DECIDE IT. Three quantities go into
// that and they are not the same quantity. All three were measured on 2026-09-17; the whole table is in
// docs/devlog/detailed/2026-09-17-fast-arm.md.
//
// 1. RUN-TO-RUN SPREAD, per renderer, one tree. ZERO on both. ELEVEN GPU runs of tree dceabc6abdf61e7c
//    produced one sha256 (a26790b44e18bfa0) and one pair of doubles; three software runs produced one
//    sha256 (e95a53185ee3595e) and one pair. Neither renderer's noise contributes anything to the margin,
//    which is worth saying rather than assuming -- `shot`'s own 54-run loop found the same thing from the
//    other side. So the margin is entirely about the renderer crossing, below.
//
// 2. THE GPU-MINUS-SOFTWARE OFFSET, measured on THREE trees rather than one, by moving `RIG.ambient` in
//    src/lighting.js and putting it back:
//        base   (ambient 0.78, tree dceabc6abdf61e7c)  cell -0.0000036   ssim +0.000894
//        small  (ambient 0.76, tree f415aab806651a9d)  cell -0.0000032   ssim +0.000852
//        large  (ambient 0.68, tree 073016e0d839fe32)  cell +0.0000692   ssim +0.000796
//    **THE CELL-DISTANCE OFFSET IS NOT A FIXED RENDERER BIAS. IT CHANGES SIGN WITH THE SCENE.** That
//    contradicts the way AGENTS.md's own figure is usually read: its recorded pair for the iteration-2
//    tree (0.074947 software against 0.074844 GPU) is an offset of -0.000103, twenty-eight times today's
//    and the other way round from the large arm's. It is a fact about one tree, not a constant. SSIM's
//    offset IS the stable one, 0.00080 to 0.00091 across all four trees.
//
// 3. WHAT ACTUALLY BOUNDS AN A/B: how far the GPU's DELTA between two arms can sit from the software
//    delta between the same two arms. A shared offset cancels; only its variation survives.
//        base -> small arm:  cell  gpu +0.00020761  sw +0.00020718   disagree 0.00000043  (0.2% of the move)
//                            ssim  gpu -0.00016817  sw -0.00012586   disagree 0.00004231  (34% of the move)
//        base -> large arm:  cell  gpu +0.0042582   sw +0.0041854    disagree 0.00007277  (1.7% of the move)
//                            ssim  gpu -0.0021082   sw -0.0020100    disagree 0.00009814  (4.9% of the move)
//    Note the SSIM row: on the small arm the GPU and the software rasterizer disagree about a THIRD of the
//    move. The delta is still the right sign, but its size is not transferable.
//
// THE MARGIN IS 0.0001 ON EACH SCORE, and that is chosen as just over the largest disagreement measured
// (cell 0.000073, ssim 0.000098) and large enough to cover the 0.000103 the cell offset itself moved
// between the 2026-09-15 tree and this one. Under it, an arm is too close to call on the GPU: re-measure
// with `npm run shot && npm run compare`. Above it, the sign is safe on this evidence and the size is
// good to a few percent on cell distance and to a few tens of percent on SSIM.
// On SwiftShader the margin is ZERO, because there the tool is not near the contract's path, it IS the
// contract's path (below).
//
// AND A USE THIS MARGIN DOES NOT COVER: **never compare a number from this tool with the thresholds in
// docs/PLAN-scores.md.** Those are the software frame's, and a single GPU score carries the WHOLE offset,
// not its variation -- +0.0009 of SSIM on every tree measured, which is a fifth of the margin that file
// leaves. This tool answers "is arm B better than arm A", never "does this tree pass".
//
// ---- WHAT IT CHECKS, AND THAT IS NOT THE SCENE ------------------------------------------------------
// It fails on a page error, on a frame not drawn by the post chain AS DESIGNED (a step-down, a watchdog
// ratchet, a `post:` warning), and on the scene source changing under the run. None of those is a
// threshold: they are instrument checks, and they are here because a lane's A/B is void if the two arms
// were drawn by different chains or if the tree moved between them. `shot` refuses the same things for
// the contract's sake; this refuses them for the comparison's sake.
//
// ---- BOUNDS -----------------------------------------------------------------------------------------
// - It is ONE frame at ONE clock (t = 0) at ONE size, like `shot`. It says nothing about the animation
//   (`npm run animation`), about any other camera (`npm run views`), or about anything the two metrics
//   cannot see: 528 cell means and a 64 px grayscale image, so a landmark 10 px out is invisible to it.
// - **THE MARGIN IS SCENE 1'S ONLY, AND THAT IS ITS LARGEST BOUND.** One machine, one driver
//   (ANGLE/D3D11, RTX 4090), and four trees that are all SCENE 1 (`japan`, 1200x1100 against a 600x550
//   photograph) varied by ONE CONSTANT in one file. A second scene has a different photograph, a
//   different frame size and its own rig, and NOTHING here transfers to it: the crossing is a property of
//   what is being rendered, which is the finding above. When this tool becomes scene-scoped it must print
//   the margin as UNCALIBRATED for any scene but `japan`, name it as a guess carried over from scene 1,
//   and give the method -- rather than carrying 0.0001 silently to another photograph. The same goes for
//   anyone moving it to another GPU, and the run-to-run spread being zero is a property of this driver,
//   not a law. THE METHOD, which is what makes the figure re-measurable instead of a number to be
//   trusted: take three trees of that scene, one the shipped one and two the shipped one with a single
//   light constant moved, and run the GPU arm and the software arm BACK TO BACK on each; the margin is
//   just over the largest disagreement between the GPU delta and the software delta across those pairs.
//   The full working is in the devlog.
// - WHEN AN ARM FALLS INSIDE THE MARGIN, GO BACK TO `shot`. That is the whole reason for keeping the slow
//   path: this tool narrows the set of arms that need 93 s down to the close ones, and it never replaces
//   them. An arm decided inside the margin is an arm decided by the driver.
// - It scores against `japan.webp` off the working directory, which nothing in this repo binds (see
//   tools/lib/treehash.js): a changed reference photo moves this number with no guard, exactly as it moves
//   `compare`'s.
// - The tree hash it prints covers `index.html` and `src/**`. An edit to `tools/` moves no hash, so two
//   arms compared across a change to THIS file are not bound by it.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { isMainModule, startServer } from './serve.js';
import { launch, collectErrors, openScene, openInspector, isUnrecognisedRenderer, isSoftwareRenderer, rendererTag, wantsGpu, postWarnings, ACTION_TIMEOUT_MS, HIDE_UI_CSS } from './lib/browser.js';
import { decodeImage } from './lib/image.js';
import { cellDistance, ssimGray } from './lib/metrics.js';
import { PHOTO, SHOT } from '../src/layout.js';
import { sourceTree, shortHash, diffTrees } from './lib/treehash.js';
// An import must never start a tool. Everything below runs only when node was asked to run THIS file;
// `node -e "import('./tools/try.js')"` loads it and does nothing. The block is not re-indented so that
// the diff that added it is three lines rather than the whole tool. Checked by npm run import-inert.
if (isMainModule(import.meta.url)) {

// Its own directory, and NOT out/render.png. See "NOT THE CONTRACT" above: this is the only thing
// standing between a GPU frame and the scored record.
const OUT_DIR = 'out/try';
const OUT = `${OUT_DIR}/render.png`;
const OUT_JSON = `${OUT_DIR}/score.json`;
const PHOTO_PATH = 'japan.webp';
const COLS = 24;
const ROWS = 22;

// Under this, an arm is too close to call on the GPU. Keyed on the renderer the run ACTUALLY got, the way
// tools/nudge.js keys its limits, because a fallback to software must not be told the GPU's number.
// The measurement behind both rows is in the header and in
// docs/devlog/detailed/2026-09-17-fast-arm.md.
const MARGIN = {
  gpu: {
    cellDistance: 0.0001,
    ssim: 0.0001,
    why: 'just over the largest GPU-versus-software disagreement measured over four trees (cell 0.000073, ssim 0.000098) and over the 0.000103 the cell offset itself moved between the 2026-09-15 tree and this one. Run-to-run spread on this renderer is zero: eleven runs of one tree, one sha256',
  },
  software: {
    cellDistance: 0,
    ssim: 0,
    why: 'this is not near the contract path, it IS the contract path: the frame is byte-identical to npm run shot\'s and the scores are equal to npm run compare\'s as doubles, and three runs gave one sha256',
  },
};

function describeRung(post) {
  return `rung ${post.rung} (${post.cost}), a ${post.width}x${post.height} target at scale ${post.scale} with ${post.samples} samples`;
}
// Why this frame cannot be compared with another arm's. NOT a threshold on the scene: every one of these
// says the two frames were made by different machinery, which is the one thing an A/B may not tolerate.
function postProblems(post, warned) {
  if (!post) {
    return ['the page reported no post-chain state at all (window.__scene.describe().post was null), so there is no record of what this frame was drawn with'];
  }
  // Checked here rather than where it is printed, so a state of a shape this tool does not know fails
  // with a sentence instead of a TypeError after the browser has closed. `tools/shot.js` does the same.
  if (!post.verdict) {
    return [`the page reported a post-chain state with no verdict in it, so there is no record of what the chain measured when it accepted this configuration: ${JSON.stringify(post)}`];
  }
  const why = [];
  // `designed`, not `rung === 0`: the rung is an index into the rungs that fit the memory budget at this
  // size, so index 0 can already be a lesser chain (src/post.js, `ladder`).
  if (!post.designed) why.push(`it was drawn at ${describeRung(post)}, which src/post.js does not mark as the chain as designed`);
  const ratchets = post.watch ? post.watch.ratchets : 0;
  if (ratchets > 0) why.push(`the post chain's watchdog stepped down ${ratchets} time(s) while this frame was being made, leaving the chain at ${describeRung(post)}`);
  if (warned.length) why.push(`the page announced ${warned.length} post-chain step-down(s), the first being: ${warned.slice(0, 2).join(' | ')}`);
  return why;
}

const started = Date.now();
const gpu = wantsGpu('TRY');
// Read BEFORE the page opens, so it is the tree the browser is about to load, and again after the
// screenshot. An A/B whose tree moved between the arms compares more than the variable under test.
const treeAtStart = sourceTree();
mkdirSync(OUT_DIR, { recursive: true });
// Both outputs are cleared BEFORE anything runs, so a failed run can never leave last run's score sitting
// beside this run's frame. A lane comparing arms reads these two files minutes apart; a stale pair that
// looks current is the worst thing this tool could hand one. After a failure, whatever is in out/try is
// from this run and is there to be looked at.
rmSync(OUT, { force: true });
rmSync(OUT_JSON, { force: true });
const server = await startServer({ port: 0, quiet: true });
const browser = await launch({ gpu });
let errors = [];
let failure = null;
let renderer = 'unknown';
let result = null;
let timing = null;
try {
  const page = await browser.newPage({ viewport: { width: SHOT.width, height: SHOT.height }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(ACTION_TIMEOUT_MS);
  errors = collectErrors(page);
  const info = await openScene(page, `${server.url}/`);
  renderer = info.renderer;
  const ready = Date.now();
  // ONE evaluate for the three things that must happen before the shot, in the order `shot` does them:
  // hide the page's own chrome, pin the clock at t = 0, and let the frame loop present two more frames so
  // the compositor has the canvas page.screenshot captures. It returns describe().post as its last act,
  // after both settle frames, so the state recorded is the one this frame was drawn with. Keeping this
  // identical to tools/shot.js is what makes the software frames byte-identical.
  const post = await page.evaluate(async (css) => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    window.__scene.setTime(0);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    return window.__scene.describe().post;
  }, HIDE_UI_CSS);
  const posed = Date.now();
  await page.screenshot({ path: OUT, type: 'png' });
  const rendered = Date.now();
  const why = postProblems(post, postWarnings(page));
  if (why.length) {
    throw new Error(
      `this frame was not drawn by the full post chain, so its score cannot be compared with another arm's:\n  ${why.join('\n  ')}\n`
      + '  Two arms drawn at different rungs differ by the rung as well as by the scene. Re-run; if it '
      + 'persists, the top rung does not survive on this driver at this size and src/post.js says what it '
      + 'measured.',
    );
  }
  const treeAtEnd = sourceTree();
  if (treeAtEnd.hash !== treeAtStart.hash) {
    throw new Error(
      `the scene source changed while this frame was being made: ${shortHash(treeAtStart.hash)} when the page `
      + `was opened, ${shortHash(treeAtEnd.hash)} after the screenshot, so this score belongs to neither tree `
      + `and cannot be used as an arm. Changed: ${diffTrees(treeAtStart, treeAtEnd, 'the open', 'the screenshot').join('; ')}. `
      + 'Let the edit settle and run npm run try again.',
    );
  }
  // Every image operation on the BLANK page, never on the scene page: the scene page's render loop makes
  // each evaluate wait out a whole post-chain frame, which on SwiftShader turned one decode into 96 s
  // (tools/lib/browser.js, openInspector). Its errors go into the same array as the scene page's.
  const inspector = await openInspector(browser, errors);
  const photo = await decodeImage(inspector, PHOTO_PATH, { width: PHOTO.width, height: PHOTO.height });
  const render = await decodeImage(inspector, OUT, { width: PHOTO.width, height: PHOTO.height });
  if (photo.srcWidth !== PHOTO.width || photo.srcHeight !== PHOTO.height) {
    throw new Error(`${PHOTO_PATH} is ${photo.srcWidth}x${photo.srcHeight}, expected ${PHOTO.width}x${PHOTO.height}`);
  }
  if (render.srcWidth !== SHOT.width || render.srcHeight !== SHOT.height) {
    throw new Error(`${OUT} is ${render.srcWidth}x${render.srcHeight}, expected ${SHOT.width}x${SHOT.height}`);
  }
  const decoded = Date.now();
  const cells = cellDistance(photo.data, render.data, PHOTO.width, PHOTO.height, COLS, ROWS);
  const ssim = ssimGray(photo.data, render.data, PHOTO.width, PHOTO.height, 64);
  const scored = Date.now();
  // Where an arm's seconds went, so the next person to say this tool is slow reads it off the log. The
  // scene BUILD is nearly all of it on a GPU (the frame itself is about 5 ms there), and it is not this
  // tool's to shorten: every gate that opens the page pays it.
  timing = {
    launchAndBuild: +((ready - started) / 1000).toFixed(1),
    poseAndTwoFrames: +((posed - ready) / 1000).toFixed(1),
    screenshot: +((rendered - posed) / 1000).toFixed(1),
    checksAndDecodes: +((decoded - rendered) / 1000).toFixed(1),
    score: +((scored - decoded) / 1000).toFixed(1),
  };
  result = {
    cellDistance: cells.mean,
    ssim: ssim.value,
    renderSha256: createHash('sha256').update(readFileSync(OUT)).digest('hex'),
    sourceTree: treeAtEnd.hash,
    sourceFileCount: treeAtEnd.count,
    post,
    drawCalls: info.drawCalls,
    triangles: info.triangles,
  };
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
if (errors.length || failure) process.exit(1);

// A run that cannot name its renderer cannot choose a margin, and the margin is most of what this tool is
// for. Same stop tools/animation.js makes, for the same reason: chromium's masked renderer string names
// no device at all, and guessing between the two rows of MARGIN is worse than stopping.
if (isUnrecognisedRenderer(renderer)) {
  console.error(
    `FAIL: this run never recorded which renderer it used. openScene returned ${JSON.stringify(renderer)}, which `
    + 'names no device, so the margin this tool exists to print cannot be chosen and a lane would be deciding '
    + 'arms against a number nobody measured. The scores this run took are '
    + `${result.cellDistance.toFixed(4)} / ${result.ssim.toFixed(4)} and no ${OUT_JSON} has been written. `
    + 'src/main.js falls back to a masked string when WEBGL_debug_renderer_info is unavailable; if this IS a '
    + 'renderer under a name this repo has not met, add it to isSoftwareRenderer in tools/lib/browser.js.',
  );
  process.exit(1);
}
const software = isSoftwareRenderer(renderer);
const margin = software ? MARGIN.software : MARGIN.gpu;
writeFileSync(OUT_JSON, `${JSON.stringify({
  ...result,
  renderer: rendererTag(renderer, gpu),
  askedForGpu: gpu,
  margin: { cellDistance: margin.cellDistance, ssim: margin.ssim },
  seconds: { total: +((Date.now() - started) / 1000).toFixed(1), ...timing },
  // Said in the file as well as in the log: this is not the scored record, and nothing may read it as one.
  notTheContract: 'npm run try is a diagnostic. The scored record is out/scores.json, written by npm run compare from out/render.png. This frame was not drawn on the contract path.',
  wroteAt: new Date().toISOString(),
}, null, 1)}\n`);

console.log(`cell color distance (24x22 grid, lower is better): ${result.cellDistance.toFixed(4)}`);
console.log(`grayscale SSIM at 64 px (higher is better): ${result.ssim.toFixed(4)}`);
console.log(`  at full precision: ${result.cellDistance} / ${result.ssim}`);
console.log(`renderer: ${rendererTag(renderer, gpu)}; draw calls: ${result.drawCalls}; triangles: ${result.triangles}`);
console.log(`post chain: ${describeRung(result.post)}; mean luma ${result.post.verdict.meanLuma} against a plain-render reference of ${result.post.verdict.referenceLuma}`);
console.log(`scene source tree ${shortHash(result.sourceTree)} over ${result.sourceFileCount} files; frame sha256 ${shortHash(result.renderSha256)}`);
// The margin, EVERY RUN, because a lane that has to remember it will size one from the last number it saw.
if (margin.cellDistance === 0 && margin.ssim === 0) {
  console.log(`MARGIN on this renderer: none. An arm is decided here exactly as npm run compare decides it -- ${margin.why}.`);
} else {
  console.log(
    `MARGIN on this renderer: compare this with ANOTHER ARM's number from this tool, and treat a move of less than `
    + `${margin.cellDistance} of cell distance or ${margin.ssim} of SSIM as TOO CLOSE TO CALL -- go back to `
    + `npm run shot && npm run compare for that arm. The figure is ${margin.why}. It is calibrated for `
    + 'SCENE 1 (japan, 1200x1100 against a 600x550 photograph) on this machine\'s ANGLE/D3D11 GPU, and for '
    + 'no other scene and no other GPU.',
  );
}
// And the use the margin does not cover, said every run rather than left in the header.
if (!software) {
  console.log(
    '  NOT against docs/PLAN-scores.md: those thresholds are the software frame\'s, and a single GPU score carries '
    + 'the whole renderer offset rather than its variation (+0.0009 of SSIM on every tree measured). This tool '
    + 'answers "is arm B better than arm A", never "does this tree pass".',
  );
}
console.log(`wrote ${OUT} and ${OUT_JSON}; this is a diagnostic and NOT the scored record (out/render.png is untouched)`);
console.log(
  `  seconds: launch and scene build ${timing.launchAndBuild}, pose and two frames ${timing.poseAndTwoFrames}, `
  + `screenshot ${timing.screenshot}, instrument checks and two decodes ${timing.checksAndDecodes}, scoring ${timing.score}`,
);
console.log(`try: scored this tree in ${((Date.now() - started) / 1000).toFixed(1)} s`);

}
