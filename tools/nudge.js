// npm run nudge (and part of npm test): move the camera two millimetres and require the frame to barely
// change.
//
// This gate exists because a user reported that the scene "flickers a lot" as the camera moves, and no
// gate could see it: the photo view is scored from a still camera, and a still camera renders the same
// frame byte for byte. What flickers is every piece of geometry thinner than a pixel: the cherry's
// strand tubes, the tile ridges, the lattice slats, the edges of thirty thousand blossom cards. A
// triangle that lands between the samples either covers one or covers none, so a fraction-of-a-pixel
// camera move switches whole pixels on and off.
//
// Two things are asserted for each pose. The same pose rendered twice must be identical, which catches
// per-frame nondeterminism. And after a 2 mm nudge, only a small fraction of pixels may change
// drastically: `bigPct` counts pixels whose channels move by more than 90 levels in total, which is what
// a pixel does when a sliver of geometry appears or disappears in it, not what it does when an edge
// resamples. The limits are set from what the fixed scene measures, with the margins recorded in
// docs/learning/gate-proofs.md.
//
// Every pose runs at two device pixel ratios, because the first version of the fix was switched off at
// ratio 2 by its own cap and sized its target from CSS pixels rather than device pixels: the scene on a
// dense display was then worse than the one the user complained about, while a gate at ratio 1 saw
// nothing wrong.
//
// ---- RENDERER ---------------------------------------------------------------------------------------
// THE GPU, WITH ITS OWN LIMITS, and that pairing is the whole point: this is the gate where the renderer
// was never neutral, and moving it without re-deriving the limits would have left it green on the defect
// it exists for.
//
// The user who reported the flicker had a GPU. On a GPU the shipped chain gets EIGHT multisamples; on
// SwiftShader `clampSamples` cuts it to four. So a SwiftShader run of this gate was comparing a 1.2x
// supersample at 4 samples against the broken 1.0x at 4 samples -- it was testing the supersample alone,
// with the multisampling held at the broken value in BOTH arms. On a GPU it compares what ships (1.2x,
// 8) against what the user saw (1.0x, 4), which is the comparison the gate was written to make.
//
// Measured on 2026-09-15, one tree, both renderers, same mutation (`POST.renderScale` 1.0 and
// `POST.samples` 4), mean drastic change, fixed against broken:
//   SwiftShader   ratio 1  0.095 -> 0.211  (2.2x)      ratio 2  0.246 -> 0.372  (1.5x)
//   GPU           ratio 1  0.036 -> 0.182  (5.1x)      ratio 2  0.205 -> 0.327  (1.6x)
// The SwiftShader broken arm reproduced the numbers recorded on 2026-09-11 to the digit, so the tree had
// not moved and the difference is the renderer.
//
// Two things follow. The GPU separates ratio 1 more than twice as well as SwiftShader does -- the entry
// in docs/learning/gate-proofs.md that warned "if this ever reads under about 0.45% broken the limit
// needs re-deriving" was reading 0.44 there, one hundredth off passing. And the OLD limits on the GPU
// would have let ratio 1 pass the broken scene outright (0.182 under 0.2, and the worst pose 0.39 under
// 0.4). Hence LIMIT below is keyed on the renderer this run actually got, not on the one it asked for: a
// run that falls back to software gets the software numbers and returns the software verdict.
// Before: 170-231 s. After: 11 s.
//
// BOUND, and it is the one to read before trusting a red here. **The GPU set is measured on exactly one
// driver**, an RTX 4090 through ANGLE/D3D11, and ratio 2 has only 1.24x of room per pose (fixed 0.41
// against a 0.51 limit) and 1.27x on the mean (0.205 against 0.26). A slower GPU that shimmers more than
// this one reds a healthy scene, and the right response is to re-derive the pair on that machine, not to
// widen the limit. The keying itself is by renderer STRING, so a software rasterizer this repo has not
// met would be handed the GPU set: `isSoftwareRenderer` knows SwiftShader, llvmpipe, softpipe and WARP,
// and a run whose renderer string names no device at all stops rather than guessing.
import { mkdirSync, writeFileSync } from 'node:fs';
import { isMainModule, startServer } from './serve.js';
import { launch, collectErrors, openScene, isSoftwareRenderer, isUnrecognisedRenderer, rendererTag, wantsGpu, ACTION_TIMEOUT_MS } from './lib/browser.js';
// An import must never start a gate. Everything below runs only when node was asked to run THIS file;
// `node -e "import('./tools/x.js')"` loads it and does nothing. The block is not re-indented so that
// the diff that added it is three lines rather than the whole tool. Proved inert, per tool, by
// out/scratch/import-inert.mjs; the bound is in docs/learning/gate-proofs.md.
if (isMainModule(import.meta.url)) {

const VIEWPORT = { width: 900, height: 820 };
const PIXEL_RATIOS = [1, 2];
const NUDGE_METRES = 0.002;
// Ceilings on the fraction of pixels that change drastically: one per pose, to catch a single bad view,
// and one on the mean, which is what separates the fixed scene from the broken one. They are per pixel
// ratio, because the fractions are not comparable between them: a ratio 2 pixel covers a quarter of the
// screen area of a ratio 1 pixel, so the same physical shimmer counts more pixels there.
//
// And they are per RENDERER, keyed on the one this run actually got, because a GPU and a CPU rasterizer
// do not shimmer alike and this gate's whole reading is shimmer. See the renderer section in the header
// for why; these are the measurements, fixed against broken (`POST.renderScale` 1.0 with `POST.samples`
// 4, which is what the user saw).
//
// SOFTWARE, the limits themselves unchanged since 2026-09-06 and still what CI asserts. The pair they
// were SET from, on the tree of that day:
//   ratio 1   photo 0.15 / 0.32, orbit 0.00 / 0.01, close 0.28 / 0.57, mean 0.14 / 0.30
//   ratio 2   photo 0.26 / 0.40, orbit 0.00 / 0.00, close 0.50 / 0.70, mean 0.25 / 0.37
// And what the SAME renderer reads on TODAY'S tree (2026-09-15), which is not the same thing and is why
// both are here: the broken arm reproduces 2026-09-11 to the digit, but the fixed arm has improved by
// about a third since 2026-09-06 and nothing re-recorded it.
//   ratio 1   photo 0.08 / 0.19, orbit 0.00 / 0.00, close 0.20 / 0.44, mean 0.095 / 0.211
//   ratio 2   photo 0.23 / 0.39, orbit 0.00 / 0.00, close 0.51 / 0.73, mean 0.246 / 0.372
//
// GPU, measured 2026-09-15 on ANGLE/D3D11 (RTX 4090), two healthy runs identical to two decimals:
//   ratio 1   photo 0.03 / 0.15, orbit 0.00 / 0.00, close 0.07 / 0.39, mean 0.036 / 0.182
//   ratio 2   photo 0.20 / 0.34, orbit 0.00 / 0.00, close 0.41 / 0.64, mean 0.205 / 0.327
// Each GPU limit is placed at the geometric middle of its own fixed/broken pair, rounded, which is the
// rule the software pair was set by (about 1.3x each way at ratio 2).
//
// Separation on today's tree, broken over fixed: software 2.2x at ratio 1 and 1.5x at ratio 2; GPU 5.1x
// and 1.6x. Ratio 2 is thin on both and always was -- on software the fixed scene reads 0.51 against a
// 0.6 per-pose limit, which is 1.18x of room and is NOT this work's doing. Ratio 1 is where the GPU wins,
// and it wins by more than double.
const LIMITS = {
  software: {
    1: { perPose: 0.4, mean: 0.2 },
    2: { perPose: 0.6, mean: 0.3 },
  },
  gpu: {
    1: { perPose: 0.18, mean: 0.09 },
    2: { perPose: 0.51, mean: 0.26 },
  },
};
let active;
try {
  active = await import('./lib/scene.js');
} catch (err) {
  console.error(`FAIL: ${err.message}`);
  process.exit(1);
}
const { scene, sceneUrl } = active;
// WHICH SCENE. This gate declared itself scene-neutral in tools/test.js and then opened the BARE url, which
// loads DEFAULT_SCENE -- scene 1 -- so `SCENE=whitehouse npm test` reported a shimmer verdict about scene 1
// under the whitehouse's name. The URL comes from the registry now.
const OUT = `${scene.out ?? 'out'}/nudge.json`;
const SCENE_ID = scene.id;

const started = Date.now();
const gpu = wantsGpu('NUDGE');
const server = await startServer({ port: 0, quiet: true });
const browser = await launch({ gpu });
let failure = null;
let errors = [];
let renderer = 'unknown';
const rows = [];
try {
  for (const ratio of PIXEL_RATIOS) {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: ratio });
  page.setDefaultTimeout(ACTION_TIMEOUT_MS);
  // Both pages collect into THIS array. It was `errors = errors.concat(collectErrors(page))`, which
  // copies the array `collectErrors` has just returned -- empty, every time, because the listeners have
  // not fired yet -- and leaves the real one orphaned. `errors` therefore never grew, the check below was
  // dead, and this gate could not report a console error, a page error or a failed request from the day
  // it landed until 2026-09-11. Found by review of the suite-cost change, not by a run.
  collectErrors(page, errors);
  renderer = (await openScene(page, sceneUrl(server))).renderer;
  const measured = await page.evaluate((nudge) => {
    const s = window.__scene;
    const gl = s.renderer.getContext();
    const grab = () => {
      s.render();
      const w = s.renderer.domElement.width;
      const h = s.renderer.domElement.height;
      const buf = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return { buf, w, h };
    };
    const diff = (A, B) => {
      let changed = 0;
      let big = 0;
      const n = A.w * A.h;
      for (let i = 0; i < n; i++) {
        const o = i * 4;
        const d = Math.abs(A.buf[o] - B.buf[o]) + Math.abs(A.buf[o + 1] - B.buf[o + 1]) + Math.abs(A.buf[o + 2] - B.buf[o + 2]);
        if (d > 8) changed++;
        if (d > 90) big++;
      }
      return { changedPct: (100 * changed) / n, bigPct: (100 * big) / n };
    };
    // The photo view, and two poses it cannot speak for: one orbited off the street's axis, one down
    // among the paving where the stone and the tiles are nearest.
    const poses = {
      'photo view': () => {},
      'orbited left and up': () => {
        s.camera.position.x -= 6;
        s.camera.position.y += 2.5;
        s.camera.lookAt(s.controls.target);
      },
      'close to the paving': () => {
        s.camera.position.y -= 2.2;
        s.camera.position.z -= 4;
        s.camera.lookAt(s.controls.target);
      },
    };
    const out = [];
    for (const [name, apply] of Object.entries(poses)) {
      s.resetView();
      apply();
      // The animation is pinned so it is not the variable under test.
      s.setTime(1000);
      const a = grab();
      const b = grab();
      const still = diff(a, b);
      s.camera.position.x += nudge;
      const c = grab();
      out.push({ name, still, nudged: diff(b, c) });
    }
    return out;
  }, NUDGE_METRES);
  for (const m of measured) rows.push({ ...m, ratio, name: `${m.name}, ratio ${ratio}` });
  await page.close();
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

// Keyed on what this run GOT, never on what it asked for: a GPU request that fell back to software (any
// CI runner) is a software run and is held to the software numbers.
//
// And a run whose renderer string names no device picks neither set, because the two differ by more than
// a factor of two and guessing between them is not a verdict. That covers the initial 'unknown' and
// chromium's MASKED string, "WebGL 2.0 (OpenGL ES 3.0 Chromium)", which is what the page reports when
// `WEBGL_debug_renderer_info` is unavailable -- it is not a GPU name, and reading it as one would hand a
// CPU rasterizer limits measured on an RTX 4090 and red a healthy scene with nothing in the log to say
// why. An independent review found that path; nothing had ever exercised it.
if (isUnrecognisedRenderer(renderer)) {
  console.error(`FAIL: this run's renderer string names no device, so it cannot choose between the software limits (${JSON.stringify(LIMITS.software)}) and the GPU ones (${JSON.stringify(LIMITS.gpu)}), which differ by more than a factor of two. openScene returned ${JSON.stringify(renderer)}. That is either the initial placeholder or chromium's masked value, which the page falls back to when WEBGL_debug_renderer_info is unavailable. Launch chromium so that extension is present, or add this renderer to isSoftwareRenderer in tools/lib/browser.js if it is a CPU rasterizer. Do not pick a limit set by hand.`);
  process.exit(1);
}
const LIMIT = isSoftwareRenderer(renderer) ? LIMITS.software : LIMITS.gpu;
const limitSet = isSoftwareRenderer(renderer) ? 'software' : 'GPU';
console.log(`limits: the ${limitSet} set, because this run rendered on ${rendererTag(renderer, gpu)}`);

let failed = false;
for (const r of rows) {
  console.log(`${r.name.padEnd(32)} still ${r.still.changedPct.toFixed(2)}%   after ${NUDGE_METRES * 1000} mm: ${r.nudged.changedPct.toFixed(2)}% changed, ${r.nudged.bigPct.toFixed(2)}% drastically`);
  if (r.still.changedPct > 0) {
    failed = true;
    console.log(`FAIL ${r.name}: the same pose rendered twice is not identical (${r.still.changedPct.toFixed(2)}% of pixels differ)`);
  }
  const limit = LIMIT[r.ratio].perPose;
  if (r.nudged.bigPct > limit) {
    failed = true;
    console.log(`FAIL ${r.name}: ${r.nudged.bigPct.toFixed(2)}% of pixels changed drastically, over the ${limit}% allowed at that pixel ratio on the ${limitSet} limits`);
  }
}
const means = {};
for (const ratio of PIXEL_RATIOS) {
  const at = rows.filter((r) => r.ratio === ratio);
  const mean = at.reduce((sum, r) => sum + r.nudged.bigPct, 0) / at.length;
  means[ratio] = mean;
  const ok = mean <= LIMIT[ratio].mean;
  if (!ok) failed = true;
  console.log(`${ok ? 'ok  ' : 'FAIL'} mean drastic change over ${at.length} poses at ratio ${ratio}: ${mean.toFixed(3)}% <= ${LIMIT[ratio].mean}%`);
}
mkdirSync(scene.out ?? 'out', { recursive: true });
writeFileSync(OUT, `${JSON.stringify({ scene: SCENE_ID, renderer, askedForGpu: gpu, limitSet, nudgeMetres: NUDGE_METRES, viewport: VIEWPORT, limit: LIMIT, allLimits: LIMITS, means, poses: rows }, null, 2)}\n`);

if (failed) {
  console.error(`FAIL: the frame is unstable under a small camera move; see out/nudge.json. Rendered on ${rendererTag(renderer, gpu)} and held to the ${limitSet} limits in tools/nudge.js.`);
  console.error('  The fix this guards is POST.renderScale and POST.samples in src/post.js; check those first.');
  console.error(`  To see the other renderer's reading of the same tree: ${limitSet === 'GPU' ? 'NUDGE_GPU=0 npm run nudge' : 'npm run nudge on a machine with a GPU'}.`);
  process.exit(1);
}
console.log(`nudge: ${rows.length} poses stable across device pixel ratios ${PIXEL_RATIOS.join(' and ')} on ${rendererTag(renderer, gpu)}, in ${((Date.now() - started) / 1000).toFixed(0)} s`);
// WHICH SCENE the verdict is about, on a line of its own, because tools/test.js requires it: a gate that
// opened the wrong page would otherwise report its green as this scene's, which is what this gate did.
console.log(`scene: ${SCENE_ID}`);

}
