// npm run shot: render the photo view at 1200x1100 in headless chromium and save out/render.png.
// Fails on any console error, uncaught page error, or failed request.
import { mkdirSync, rmSync } from 'node:fs';
import { startServer } from './serve.js';
import { launch, collectErrors, openScene, ACTION_TIMEOUT_MS, HIDE_UI_CSS } from './lib/browser.js';
import { SHOT } from '../src/layout.js';

const OUT = 'out/render.png';
const server = await startServer({ port: 0, quiet: true });
const browser = await launch();
let errors = [];
let failure = null;
try {
  const page = await browser.newPage({ viewport: { width: SHOT.width, height: SHOT.height }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(ACTION_TIMEOUT_MS);
  errors = collectErrors(page);
  const info = await openScene(page, `${server.url}/`);
  // The on-screen reset button is UI, not scene: keep it out of the scored image.
  await page.addStyleTag({ content: HIDE_UI_CSS });
  // The scene animates; the scored frame is the one at t = 0, every run.
  await page.evaluate(() => window.__scene.setTime(0));
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  mkdirSync('out', { recursive: true });
  await page.screenshot({ path: OUT, type: 'png' });
  console.log(`wrote ${OUT} (${SHOT.width}x${SHOT.height})`);
  console.log(`renderer: ${info.renderer}; draw calls: ${info.drawCalls}; triangles: ${info.triangles}`);
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
  // A render from a page with errors is not evidence: remove it so compare cannot score it.
  rmSync(OUT, { force: true });
  process.exit(1);
}
