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
import { mkdirSync, writeFileSync } from 'node:fs';
import { startServer } from './serve.js';
import { launch, collectErrors, openScene, ACTION_TIMEOUT_MS } from './lib/browser.js';

const VIEWPORT = { width: 900, height: 820 };
const PIXEL_RATIOS = [1, 2];
const NUDGE_METRES = 0.002;
// Ceilings on the fraction of pixels that change drastically: one per pose, to catch a single bad view,
// and one on the mean, which is what separates the fixed scene from the broken one. They are per pixel
// ratio, because the fractions are not comparable between them: a ratio 2 pixel covers a quarter of the
// screen area of a ratio 1 pixel, so the same physical shimmer counts more pixels there. Measured, fixed
// against broken (renderScale 1.0 with 4 samples, which is what the user saw):
//   ratio 1   photo 0.15 / 0.32, orbit 0.00 / 0.01, close 0.28 / 0.57, mean 0.14 / 0.30
//   ratio 2   photo 0.26 / 0.40, orbit 0.00 / 0.00, close 0.50 / 0.70, mean 0.25 / 0.37
const LIMIT = {
  1: { perPose: 0.4, mean: 0.2 },
  2: { perPose: 0.6, mean: 0.3 },
};
const OUT = 'out/nudge.json';

const server = await startServer({ port: 0, quiet: true });
const browser = await launch();
let failure = null;
let errors = [];
const rows = [];
try {
  for (const ratio of PIXEL_RATIOS) {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: ratio });
  page.setDefaultTimeout(ACTION_TIMEOUT_MS);
  errors = errors.concat(collectErrors(page));
  await openScene(page, `${server.url}/`);
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
    console.log(`FAIL ${r.name}: ${r.nudged.bigPct.toFixed(2)}% of pixels changed drastically, over the ${limit}% allowed at that pixel ratio`);
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
mkdirSync('out', { recursive: true });
writeFileSync(OUT, `${JSON.stringify({ nudgeMetres: NUDGE_METRES, viewport: VIEWPORT, limit: LIMIT, means, poses: rows }, null, 2)}\n`);

if (failed) {
  console.error('FAIL: the frame is unstable under a small camera move; see out/nudge.json');
  process.exit(1);
}
console.log(`nudge: ${rows.length} poses stable across device pixel ratios ${PIXEL_RATIOS.join(' and ')}`);
