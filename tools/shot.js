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
import { mkdirSync, rmSync } from 'node:fs';
import { startServer } from './serve.js';
import { launch, collectErrors, openScene, ACTION_TIMEOUT_MS, HIDE_UI_CSS } from './lib/browser.js';
import { SHOT } from '../src/layout.js';

const OUT = 'out/render.png';
const started = Date.now();
const server = await startServer({ port: 0, quiet: true });
const browser = await launch();
let errors = [];
let failure = null;
try {
  const page = await browser.newPage({ viewport: { width: SHOT.width, height: SHOT.height }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(ACTION_TIMEOUT_MS);
  errors = collectErrors(page);
  const info = await openScene(page, `${server.url}/`);
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
  console.log(`wrote ${OUT} (${SHOT.width}x${SHOT.height})`);
  console.log(`renderer: ${info.renderer}; draw calls: ${info.drawCalls}; triangles: ${info.triangles}`);
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
  // A render from a page with errors is not evidence: remove it so compare cannot score it.
  rmSync(OUT, { force: true });
  process.exit(1);
}
