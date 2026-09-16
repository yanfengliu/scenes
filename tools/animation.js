// npm run animation (and part of npm test): score the photo view at several points across the animation
// cycle, not just at t = 0.
//
// The shot gate pins the clock at t = 0 so its render is reproducible, which means it cannot see a drift
// that only shows when the canopy has swung or the petals have fallen halfway. This walks the clock over
// a full period of the wind (the slowest term is 2*pi/0.72, about 8.7 s) and scores every frame against
// the photo, then asserts three things: the worst frame's scores, the spread between frames, and the
// motion itself.
//
// The spread and the motion matter as much as the scores. An allowance loose enough to pass any frame
// also passes an animation fourteen times too violent, which is exactly what the first version of this
// gate did (see the phase 5 devlog); and an animation that quietly stops moving would pass a score check
// perfectly. So the gate bounds the mean per-pixel change between neighbouring frames from both sides:
// too little and the scene has died, too much and it is thrashing.
//
// ---- RENDERER ---------------------------------------------------------------------------------------
// THE GPU, AND THE SCORED THRESHOLDS ARE THE SAME THRESHOLDS ON BOTH RENDERERS.
//
// This gate is mostly a comparison of frames with each other -- the spread between them and the motion
// between them -- and neither of those cares which rasterizer drew them, as long as ALL of them came from
// the same one, which they do: one page, one browser, one run. What looked like it cared is the other
// half, the worst frame held to `docs/PLAN-scores.md`, because those thresholds were measured on
// SwiftShader. It turned out not to: on this machine's GPU the same frame scores BETTER on both metrics,
// so the unwidened thresholds hold there with more room than they hold on software. See the note above
// `OUT_DIR` for the margin that was briefly here and why it was removed; a widened limit is a limit
// nobody can red-prove.
//
// So CI, a software rasterizer, returns exactly the verdict it returned before any of this, and so does a
// GPU run. `ANIMATION_GPU=0` (or `GATES_GPU=0`) is the software run locally, and it is how a scored red on
// a GPU is checked before the scene is blamed.
//
// What it cost before: 277 s of a 12-minute suite, almost all of it seven 1200x1100 SwiftShader frames
// and the round-trips that wait on them, on a machine with an RTX 4090 sitting idle.
//
// WHAT IS RENDERED AND WHAT IS MEASURED HAS NOT CHANGED SINCE cd50b5c, and must not: every frame is the
// same 1200x1100 screenshot of the same photo view, resampled to 600x550 by the same decoder, scored by
// the same two metrics against the same thresholds. Rendering these frames smaller is the obvious saving
// and it is not available, because this gate does not only compare its frames with each other: it holds
// the worst of them to `docs/PLAN-scores.md` plus 0.0006 of cell distance and minus 0.0025 of SSIM, on
// either renderer, which are the SHIPPED FRAME's thresholds and belong to the 1200x1100 contract. On
// SwiftShader the frame at t = 0 is in fact
// byte-identical to `out/render.png` (sha256 d29b76dd0272… at cd50b5c on SwiftShader), and this scene is
// full of geometry thinner than a pixel, so alpha-test coverage moves with the render size while those
// allowances are six times the 0.0001 the animation itself moves the score. At another size the gate
// would still separate a healthy animation from a fourteen-fold sway, but it would no longer be checking
// the scored view. What changed on 2026-09-11 is only WHERE two kinds of work run and how many
// round-trips it takes:
//   - the eight image decodes moved to a blank page (`openInspector`). They were running on the scene
//     page, where every `await` queues behind a whole 1200x1100 post-chain frame: the same decode of the
//     same file in the same process cost 96.1 s there and 0.1 s on the blank page, and this gate was
//     paying that eight times. It returns the same 1,320,000 bytes either way, measured byte for byte
//     (out/scratch/decode-purity.mjs).
//   - hiding the page's chrome, `setTime` and the two-frame wait for the compositor became one evaluate
//     per sampled time instead of three, which renders exactly the same frames in the same order.
// Both are timed and printed per frame below, so the next person to ask where the minutes go reads it off
// the log instead of guessing.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { isMainModule, startServer } from './serve.js';
import { launch, collectErrors, openScene, openInspector, isSoftwareRenderer, isUnrecognisedRenderer, rendererTag, wantsGpu, ACTION_TIMEOUT_MS, HIDE_UI_CSS } from './lib/browser.js';
import { decodeImage } from './lib/image.js';
import { cellDistance, ssimGray } from './lib/metrics.js';
import { PHOTO, SHOT } from '../src/layout.js';
// An import must never start a gate. Everything below runs only when node was asked to run THIS file;
// `node -e "import('./tools/x.js')"` loads it and does nothing. The block is not re-indented so that
// the diff that added it is three lines rather than the whole tool. Proved inert, per tool, by
// out/scratch/import-inert.mjs; the bound is in docs/learning/gate-proofs.md.
if (isMainModule(import.meta.url)) {

// Seven frames across the wind's slowest period. ANIMATION_FRAMES trims the list where a run has to be
// quick (CI): the first, the last and evenly spaced frames between.
const ALL_TIMES = [0, 1.45, 2.9, 4.35, 5.8, 7.25, 8.7];
// The floor of two is what stops a one-frame run, which has no interval to measure motion over and would
// put NaN through every check. It is NOT a floor of three, and an earlier draft of this line made it one
// on the argument that t = 0 and t = 8.7 are one full period of the wind apart and so nearly the same
// frame. THAT ARGUMENT IS WRONG and was withdrawn after being measured. Only the slowest of the three
// wind terms returns to phase at 8.7 s (2*pi/0.72 = 8.727): the 0.85 term is 1.11 rad short of a whole
// number of cycles there and the 1.63 term 1.62 rad, and the petals wrap on a 7.5 s fall of their own. A
// two-frame run measures 0.22 levels of motion and passes every check, which is what the tree actually
// does -- see the measured spacing series in the animation section of docs/learning/gate-proofs.md.
const wanted = Math.max(2, Math.min(ALL_TIMES.length, Number(process.env.ANIMATION_FRAMES) || ALL_TIMES.length));
const TIMES = wanted === ALL_TIMES.length ? ALL_TIMES : Array.from({ length: wanted }, (_, i) => ALL_TIMES[Math.round((i * (ALL_TIMES.length - 1)) / (wanted - 1))]);
// What the animation is allowed to do to the scores. The measured spread at the shipped amplitudes is
// 0.0001 of cell distance and 0.0005 of SSIM, so these leave about five times that for driver noise and
// no more: an animation that moves the photo view further than this is not subtle, whatever it looks like.
const ALLOWANCE = { cellDistance: 0.0006, ssim: 0.0025 };
// And what it must do: the mean per-pixel change between neighbouring frames, in levels of 255. This is
// the bound that actually constrains the amplitude: the scores barely move when the canopy sways, because
// its mean color is much the same wherever it is, but the motion between frames rises with the amplitude
// almost proportionally. At the shipped amplitude it is 0.18 levels; at fourteen times it, 0.65.
const MOTION = { min: 0.06, max: 0.4 };
// THERE IS NO RENDERER MARGIN ON THE SCORED PAIR, and the short-lived one that was here is worth
// recording because it was wrong in a way that read as caution.
//
// The thresholds in `docs/PLAN-scores.md` were measured on SwiftShader, so the first version of this
// gate's move to the GPU widened them there by 0.0005 of cell distance and 0.0020 of SSIM, on the
// argument that a GPU does not produce SwiftShader's last digits. An independent review measured what
// that bought and what it cost, and it bought nothing: the renderer crossing runs in the direction that
// FLATTERS the GPU -- the same frame scores 0.074947 / 0.473324 on SwiftShader and 0.074844 / 0.474234
// on this machine's ANGLE/D3D11 RTX 4090 -- so the GPU run already sat inside the unwidened thresholds
// with MORE room than the software run has (0.0082 of SSIM against 0.0055). The margin was pure slack on
// the renderer this gate now runs on by default, and this gate would have proved strictly less than it
// did before the move. It is gone. Both renderers are held to `docs/PLAN-scores.md` plus ALLOWANCE.
//
// What happens on a driver that crosses the OTHER way is a red, and that is deliberate: the failure block
// below names the renderer and says to re-run with `ANIMATION_GPU=0` before believing the scene moved. A
// red that asks for a measurement is the safe direction; a limit pre-widened for a driver nobody has seen
// is a limit nobody can red-prove, which is exactly what the review caught.
const OUT_DIR = 'out/animation';

const doc = readFileSync('docs/PLAN-scores.md', 'utf8');
const block = doc.match(/```json\s*([\s\S]*?)```/);
if (!block) {
  console.error('FAIL: docs/PLAN-scores.md has no ```json thresholds block');
  process.exit(1);
}
const thresholds = JSON.parse(block[1]);

// A stale frame from an earlier grid beside a fresh one is a trap for whoever reads the failure.
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });
const started = Date.now();
const gpu = wantsGpu('ANIMATION');
const server = await startServer({ port: 0, quiet: true });
const browser = await launch({ gpu });
let failure = null;
let errors = [];
let renderer = 'unknown';
const rows = [];
let previous = null;
try {
  const page = await browser.newPage({ viewport: { width: SHOT.width, height: SHOT.height }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(ACTION_TIMEOUT_MS);
  errors = collectErrors(page);
  renderer = (await openScene(page, `${server.url}/`)).renderer;
  // The blank page every decode runs on; see openInspector's comment for what it costs not to. Its
  // console errors, page errors and failed requests go into the SAME array as the scene page's, because
  // a decode that reports a problem without throwing would otherwise be watched by nothing.
  const inspector = await openInspector(browser, errors);
  const photo = await decodeImage(inspector, 'japan.webp', { width: PHOTO.width, height: PHOTO.height });
  let hideUi = HIDE_UI_CSS;
  for (const t of TIMES) {
    const frameStarted = Date.now();
    // One evaluate per sampled time, not three. Hiding the page's own chrome was `page.addStyleTag`, a
    // round-trip of its own, and it is folded into the first time's evaluate here -- `addStyleTag` appends
    // exactly this element. Then `setTime` pins the clock and renders (src/main.js), and the frame loop
    // re-renders that same pinned frame twice so the compositor has presented the canvas that
    // `page.screenshot` is about to capture. Every round-trip to this page waits out a whole 1200x1100
    // frame, so each one removed is seconds here and a minute on a runner.
    await page.evaluate(async ({ time, css }) => {
      if (css) {
        const style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
      }
      window.__scene.setTime(time);
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    }, { time: t, css: hideUi });
    hideUi = null;
    const posed = Date.now();
    const path = `${OUT_DIR}/t${t.toFixed(1)}.png`;
    await page.screenshot({ path, type: 'png' });
    const shot = Date.now();
    const render = await decodeImage(inspector, path, { width: PHOTO.width, height: PHOTO.height });
    const decoded = Date.now();
    const cells = cellDistance(photo.data, render.data, PHOTO.width, PHOTO.height, 24, 22);
    const ssim = ssimGray(photo.data, render.data, PHOTO.width, PHOTO.height, 64);
    // Where this gate's minutes go, per frame, so a change to it is argued from the log.
    console.log(
      `  t = ${t.toFixed(1)} s rendered in ${((decoded - frameStarted) / 1000).toFixed(1)} s `
      + `(pose and two frames ${((posed - frameStarted) / 1000).toFixed(1)} s, screenshot ${((shot - posed) / 1000).toFixed(1)} s, `
      + `decode on the blank page ${((decoded - shot) / 1000).toFixed(1)} s)`,
    );
    // How much this frame differs from the one before it, averaged over every channel of every pixel.
    let motion = null;
    if (previous) {
      let sum = 0;
      for (let i = 0; i < render.data.length; i += 4) {
        sum += Math.abs(render.data[i] - previous[i]) + Math.abs(render.data[i + 1] - previous[i + 1]) + Math.abs(render.data[i + 2] - previous[i + 2]);
      }
      motion = sum / ((render.data.length / 4) * 3);
    }
    previous = render.data;
    rows.push({ t, cellDistance: cells.mean, ssim: ssim.value, motion });
  }
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

const cellValues = rows.map((r) => r.cellDistance);
const ssimValues = rows.map((r) => r.ssim);
const worstCell = Math.max(...cellValues);
const bestCell = Math.min(...cellValues);
const worstSsim = Math.min(...ssimValues);
const bestSsim = Math.max(...ssimValues);
for (const r of rows) console.log(`t = ${r.t.toFixed(1)} s   cell ${r.cellDistance.toFixed(4)}   ssim ${r.ssim.toFixed(4)}${r.motion === null ? '' : `   moved ${r.motion.toFixed(2)} levels`}`);
console.log(`spread over ${rows.length} frames on ${rendererTag(renderer, gpu)}: cell ${bestCell.toFixed(4)} to ${worstCell.toFixed(4)} (${(worstCell - bestCell).toFixed(4)}), ssim ${worstSsim.toFixed(4)} to ${bestSsim.toFixed(4)} (${(bestSsim - worstSsim).toFixed(4)})`);
console.log(`scored ${rows.length} frames in ${((Date.now() - started) / 1000).toFixed(0)} s`);
const motions = rows.map((r) => r.motion).filter((m) => m !== null);
const meanMotion = motions.reduce((a, b) => a + b, 0) / Math.max(1, motions.length);
console.log(`motion between neighbouring frames: ${Math.min(...motions).toFixed(2)} to ${Math.max(...motions).toFixed(2)} levels, mean ${meanMotion.toFixed(2)}`);
writeFileSync(`${OUT_DIR}/scores.json`, `${JSON.stringify({ renderer, askedForGpu: gpu, frames: rows, spread: { cellDistance: worstCell - bestCell, ssim: bestSsim - worstSsim }, motion: { mean: meanMotion, min: Math.min(...motions), max: Math.max(...motions) } }, null, 2)}\n`);

// The two scored checks, held two ways, because the thresholds belong to one renderer and this gate no
// longer always runs on it.
//
// ABSOLUTE, against `docs/PLAN-scores.md`: the same limits on both renderers, so CI's verdict is exactly
// what it was and a GPU run is held to the same numbers. **This pair has no red proof and never had one**
// -- the fourteen-fold sway that reds this gate reds the MOTION bound, and the scores barely move when
// the canopy swings, which is the finding the motion bound was added for in the first place (2026-09-05).
// It is here to tie the set to the contract, not to catch an animation defect.
//
// RELATIVE, against THIS RUN'S OWN t = 0 frame, on the renderer this run got: the frame at t = 0 is the
// scored framing with the clock pinned where `shot` pins it, so it is the one frame in the set whose
// score has a meaning outside this gate. Hold plainly: this check cannot fail while the spread check
// below passes, because the best frame is at least as good as the t = 0 frame, so worst - t0 <= worst -
// best. It is a restatement of the spread bound anchored somewhere meaningful, not a second bound, and
// the reason the absolute pair above is still here rather than replaced by it. The spread check is what
// does the work between frames; the absolute pair is what ties the set to the contract.
// The scored limits no longer depend on the renderer, so nothing here has to classify one. What the
// renderer still decides is what the run SAYS when the scored pair fails, and a run that recorded no
// renderer cannot say it -- so it stops, rather than printing advice it cannot support. This also catches
// chromium's masked renderer string, which names no device at all.
if (isUnrecognisedRenderer(renderer)) {
  console.error(`FAIL: this run never recorded which renderer it used. openScene returned ${JSON.stringify(renderer)}, which names no device; it should return the string window.__scene.describe().renderer reports, and that falls back to a masked value when WEBGL_debug_renderer_info is unavailable. Without it this gate cannot tell you whether a scored failure is the scene or the driver. Fix tools/animation.js or the page's rendererName(), not the thresholds.`);
  process.exit(1);
}
const software = isSoftwareRenderer(renderer);
const cellLimit = thresholds.cellDistanceMax + ALLOWANCE.cellDistance;
const ssimLimit = thresholds.ssimMin - ALLOWANCE.ssim;
const base = rows[0];
let failed = false;
const failures = [];
const check = (name, value, op, limit) => {
  const ok = op === '<=' ? value <= limit : value >= limit;
  if (!ok) { failed = true; failures.push(name); }
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${value.toFixed(4)} ${op} ${limit.toFixed(4)}`);
};
console.log(
  `scored against docs/PLAN-scores.md with no renderer margin, on ${software ? 'the software rasterizer those thresholds were measured on' : 'a GPU, which on this machine scores the same frame 0.0001 BETTER on cell distance and 0.0009 better on SSIM'}`,
);
check("worst frame's cell color distance", worstCell, '<=', cellLimit);
check("worst frame's grayscale SSIM", worstSsim, '>=', ssimLimit);
check("worst frame's cell distance, against this run's own t = 0 frame", worstCell, '<=', base.cellDistance + ALLOWANCE.cellDistance);
check("worst frame's SSIM, against this run's own t = 0 frame", worstSsim, '>=', base.ssim - ALLOWANCE.ssim);
check('spread of cell distance', worstCell - bestCell, '<=', ALLOWANCE.cellDistance);
check('spread of SSIM', bestSsim - worstSsim, '<=', ALLOWANCE.ssim);
check('motion between frames', meanMotion, '<=', MOTION.max);
check('motion between frames', meanMotion, '>=', MOTION.min);
if (failed) {
  console.error(`FAIL: the animation is outside what the photo view allows; see out/animation/. Failed: ${failures.join('; ')}.`);
  console.error(`  rendered on ${rendererTag(renderer, gpu)}, ${TIMES.length} frames at ${SHOT.width}x${SHOT.height}, clock pinned per frame.`);
  const absoluteOnly = failures.every((f) => f === "worst frame's cell color distance" || f === "worst frame's grayscale SSIM");
  if (!software && absoluteOnly) {
    console.error(
      `  Only the ABSOLUTE pair failed and this run was not on the software rasterizer docs/PLAN-scores.md was`
      + ` measured on. Re-run it on that rasterizer before believing the scene moved: ANIMATION_GPU=0 npm run animation.`
      + ` If the software run is green, this driver crosses the scored numbers further than the one they were`
      + ` measured against -- on an RTX 4090 the crossing is 0.0001 of cell distance and 0.0009 of SSIM, and it runs`
      + ` the other way, so a red here is a driver worth recording in docs/devlog/detailed/2026-09-15-gpu-gates.md`
      + ` rather than a threshold worth widening.`,
    );
  }
  process.exit(1);
}

}
