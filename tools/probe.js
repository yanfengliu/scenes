// npm run probe -- u,v u,v ...: raycast the live scene at photo positions and print the mesh hit (up to
// three, nearest first, with distances) and the rendered pixel there. Diagnostic, not a gate: it maps a
// wrong pixel in out/compare.png to the mesh that put it there.
import { startServer } from './serve.js';
import { launch, collectErrors, openScene } from './lib/browser.js';
import { SHOT } from '../src/layout.js';

const points = process.argv.slice(2).map((s) => s.split(',').map(Number));
if (!points.length || points.some((p) => p.length !== 2 || p.some(Number.isNaN))) {
  console.error('usage: npm run probe -- u,v [u,v ...]   (fractions of the frame, u right, v down)');
  process.exit(1);
}

const server = await startServer({ port: 0, quiet: true });
const browser = await launch();
try {
  const page = await browser.newPage({ viewport: { width: SHOT.width, height: SHOT.height }, deviceScaleFactor: 1 });
  const errors = collectErrors(page);
  await openScene(page, `${server.url}/`);
  const rows = await page.evaluate((pts) => {
    const { THREE, camera, scene, renderer, render } = window.__scene;
    const raycaster = new THREE.Raycaster();
    raycaster.far = 10000;
    const gl = renderer.getContext();
    render();
    const px = new Uint8Array(4);
    return pts.map(([u, v]) => {
      raycaster.setFromCamera(new THREE.Vector2(u * 2 - 1, 1 - v * 2), camera);
      const hits = raycaster.intersectObjects(scene.children, true);
      gl.readPixels(Math.round(u * gl.drawingBufferWidth), Math.round((1 - v) * gl.drawingBufferHeight), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      const pixel = '#' + [px[0], px[1], px[2]].map((c) => c.toString(16).padStart(2, '0')).join('');
      return { u, v, pixel, hits: hits.slice(0, 3).map((h) => `${h.object.name || '(unnamed)'}@${h.distance.toFixed(1)}`) };
    });
  }, points);
  for (const r of rows) console.log(`(${r.u}, ${r.v})  ${r.pixel}  ${r.hits.join('  >  ') || '(nothing)'}`);
  if (errors.length) {
    console.error(`${errors.length} page error(s):`);
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }
} finally {
  await browser.close();
  await server.close();
}
