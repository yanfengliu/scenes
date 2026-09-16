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
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { startServer } from './serve.js';
import { launch, collectErrors, openScene, isSoftwareRenderer, rendererTag, ACTION_TIMEOUT_MS, HIDE_UI_CSS } from './lib/browser.js';
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
  const info = await openScene(page, `${server.url}/`);
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
  await page.evaluate(async (css) => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    window.__scene.setTime(0);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, HIDE_UI_CSS);
  mkdirSync('out', { recursive: true });
  await page.screenshot({ path: OUT, type: 'png' });
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
    wroteAt: new Date().toISOString(),
  }, null, 1)}\n`);
  console.log(`wrote ${OUT} (${SHOT.width}x${SHOT.height})`);
  console.log(`renderer: ${rendererTag(info.renderer, false)}; draw calls: ${info.drawCalls}; triangles: ${info.triangles}`);
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
