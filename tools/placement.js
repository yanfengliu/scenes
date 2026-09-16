// Placement gate (run by npm test), in two halves.
//
// PLACEMENT_CHECKS asks what is in front: cast the photo camera's ray through each photo position and
// require the first mesh hit to be the named one. The compare scores cannot see this, because a door
// built inside its wall scores exactly like the wall.
//
// GROUNDING_CHECKS asks what is underneath: drop a ray from above each listed base and require the mesh
// it should stand on to be within a tolerance of it. The scores cannot see that either, which is how
// phase 3 shipped far houses floating 20 m over nothing with every gate green.
//
// Fails (exit 1) listing every mismatch; prints every check.
//
// Both halves run in ONE `page.evaluate`, and that is a cost decision, not a style one: an evaluate on
// the scene page waits for the frame in flight, and on SwiftShader a 1200x1100 post-chain frame is about
// fourteen seconds. Three evaluates (pin the clock, cast forward, drop rays) cost three of those before
// any raycasting happened. Nothing about the measurement changes -- the clock is still pinned to t = 0
// first, and the two sets of rays are cast in the same order against the same scene.
//
// RENDERER: THE GPU, because NO PIXEL ENTERS THIS GATE'S VERDICT. Both halves are `THREE.Raycaster`
// against the scene graph, which is CPU JavaScript over geometry that three built before anything was
// drawn; the renderer decides what the frame looks like and this gate never looks at a frame. It
// rendered through SwiftShader until 2026-09-15 only because that is what `launch()` defaulted to. The
// claim is measured, not argued: the two renderers print the same 21 forward hits and the same 10
// grounding gaps, recorded in docs/devlog/detailed/2026-09-15-gpu-gates.md. `PLACEMENT_GPU=0` (or
// `GATES_GPU=0`) forces SwiftShader, which is what CI gets anyway because a runner has no GPU -- so CI's
// verdict is unchanged, and the summary line names the renderer it got either way.
//
// For the same reason it asks `openScene` for NO settling frames. The two extra rendered frames exist to
// give the compositor a canvas for `page.screenshot`, and this gate never screenshots.
import { startServer } from './serve.js';
import { launch, collectErrors, openScene, rendererTag, wantsGpu, ACTION_TIMEOUT_MS } from './lib/browser.js';
import { GROUNDING_CHECKS, PLACEMENT_CHECKS, SHOT } from '../src/layout.js';
import { isMainModule } from './serve.js';
// An import must never start a gate. Everything below runs only when node was asked to run THIS file;
// `node -e "import('./tools/x.js')"` loads it and does nothing. The block is not re-indented so that
// the diff that added it is three lines rather than the whole tool. Proved inert, per tool, by
// out/scratch/import-inert.mjs; the bound is in docs/learning/gate-proofs.md.
if (isMainModule(import.meta.url)) {

const started = Date.now();
const gpu = wantsGpu('PLACEMENT');
const server = await startServer({ port: 0, quiet: true });
const browser = await launch({ gpu });
try {
  const page = await browser.newPage({ viewport: { width: SHOT.width, height: SHOT.height }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(ACTION_TIMEOUT_MS);
  const errors = collectErrors(page);
  const info = await openScene(page, `${server.url}/`, { settleFrames: 0 });
  const castStarted = Date.now();
  const { rows, grounded } = await page.evaluate(({ placement, grounding }) => {
    const { THREE, camera, scene } = window.__scene;
    // Pinned before either sweep, exactly as the separate evaluate did, so the rays meet the same scene
    // every run.
    window.__scene.setTime(0);

    const forward = new THREE.Raycaster();
    forward.far = 10000;
    const rows = placement.map((c) => {
      forward.setFromCamera(new THREE.Vector2(c.u * 2 - 1, 1 - c.v * 2), camera);
      const hits = forward.intersectObjects(scene.children, true);
      const first = hits.length ? hits[0].object.name || '(unnamed)' : '(nothing)';
      return { ...c, first, ok: first.startsWith(c.mesh) };
    });

    const down = new THREE.Raycaster();
    down.far = 400;
    const downward = new THREE.Vector3(0, -1, 0);
    const box = new THREE.Box3();
    const centre = new THREE.Vector3();
    const grounded = grounding.map((c) => {
      let object = null;
      scene.traverse((o) => {
        if (!object && o.isMesh && (o.name || '') === c.name) object = o;
      });
      if (!object) return { ...c, missing: true, ok: false };
      box.setFromObject(object);
      box.getCenter(centre);
      const base = box.min.y;
      // Well above the base, because an object that runs into its ground starts below the surface, and
      // only hits on the named ground mesh count. `x`/`z` override the box centre for an object whose
      // footprint is not under it: the cherry's wood is one mesh whose box is centred in the canopy.
      const x = c.x ?? centre.x;
      const z = c.z ?? centre.z;
      down.set(new THREE.Vector3(x, base + 4, z), downward);
      const hits = down.intersectObjects(scene.children, true);
      const ground = hits.find((h) => (h.object.name || '').startsWith(c.mesh));
      if (!ground) return { ...c, base, groundY: null, ok: false };
      const gap = ground.point.y - base;
      return { ...c, base, groundY: ground.point.y, gap, ok: gap >= -c.tolerance && gap <= (c.sink ?? 0.3) };
    });
    return { rows, grounded };
  }, { placement: PLACEMENT_CHECKS, grounding: GROUNDING_CHECKS });
  const castSeconds = (Date.now() - castStarted) / 1000;
  let failed = 0;
  for (const r of rows) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name} at (${r.u}, ${r.v}): ${r.ok ? r.first : `expected "${r.mesh}", first hit "${r.first}"`}`);
  }
  for (const r of grounded) {
    if (!r.ok) failed++;
    const found = r.missing
      ? 'the object is not in the scene'
      : r.groundY === null
      ? `no "${r.mesh}" under it`
      : r.gap < 0
        ? `it floats ${(-r.gap).toFixed(2)} m over "${r.mesh}", past the ${r.tolerance} m allowed`
        : `it is buried ${r.gap.toFixed(2)} m in "${r.mesh}", past the ${r.sink ?? 0.3} m allowed`;
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name} stands on ${r.mesh}${r.ok ? '' : `: ${found}`}`);
  }
  if (errors.length) {
    console.error(`${errors.length} page error(s):`);
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }
  if (failed) {
    console.error(`FAIL: ${failed} check(s) failed; see PLACEMENT_CHECKS and GROUNDING_CHECKS in src/layout.js`);
    process.exit(1);
  }
  console.log(`placement: ${rows.length} in front, ${grounded.length} grounded, all ok on ${rendererTag(info.renderer, gpu)}`);
  console.log(`     (${castSeconds.toFixed(1)} s casting in the page, ${((Date.now() - started) / 1000).toFixed(0)} s in all)`);
} finally {
  await browser.close();
  await server.close();
}

}
