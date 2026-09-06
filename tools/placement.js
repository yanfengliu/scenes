// Placement gate (run by npm test): for each entry of PLACEMENT_CHECKS in src/layout.js, cast the photo
// camera's ray through the photo position and require the first mesh hit to be the named one. The
// compare scores cannot see this: a door built inside its wall, or a canopy hiding a missing trunk,
// scores exactly like the right scene. Fails (exit 1) on the first mismatch list; prints every check.
import { startServer } from './serve.js';
import { launch, collectErrors, openScene } from './lib/browser.js';
import { PLACEMENT_CHECKS, SHOT } from '../src/layout.js';

const server = await startServer({ port: 0, quiet: true });
const browser = await launch();
try {
  const page = await browser.newPage({ viewport: { width: SHOT.width, height: SHOT.height }, deviceScaleFactor: 1 });
  const errors = collectErrors(page);
  await openScene(page, `${server.url}/`);
  const rows = await page.evaluate((checks) => {
    const { THREE, camera, scene } = window.__scene;
    const raycaster = new THREE.Raycaster();
    raycaster.far = 10000;
    return checks.map((c) => {
      raycaster.setFromCamera(new THREE.Vector2(c.u * 2 - 1, 1 - c.v * 2), camera);
      const hits = raycaster.intersectObjects(scene.children, true);
      const first = hits.length ? hits[0].object.name || '(unnamed)' : '(nothing)';
      return { ...c, first, ok: first.startsWith(c.mesh) };
    });
  }, PLACEMENT_CHECKS);
  let failed = 0;
  for (const r of rows) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name} at (${r.u}, ${r.v}): ${r.ok ? r.first : `expected "${r.mesh}", first hit "${r.first}"`}`);
  }
  if (errors.length) {
    console.error(`${errors.length} page error(s):`);
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }
  if (failed) {
    console.error(`FAIL: ${failed} placement check(s) hit another mesh first; see src/layout.js PLACEMENT_CHECKS`);
    process.exit(1);
  }
  console.log(`placement: ${rows.length} checks ok`);
} finally {
  await browser.close();
  await server.close();
}
