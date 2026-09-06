// npm run perf: median frame time and draw calls over 5 s at 1920x1080 in headless chromium.
// Budget: median under 16 ms on the dev machine, under 400 draw calls.
// Frame time is measured around renderer.render plus a 1x1 readPixels, which blocks until the GPU
// (or SwiftShader) has finished the frame, so it is the true cost of a frame and not the rAF interval.
import { startServer } from './serve.js';
import { launch, collectErrors, openScene, ACTION_TIMEOUT_MS } from './lib/browser.js';

const SECONDS = Number(process.env.PERF_SECONDS || 5);
const BUDGET_MS = 16;
const BUDGET_CALLS = 400;
const useGpu = process.env.PERF_GPU !== '0';

const server = await startServer({ port: 0, quiet: true });
const browser = await launch({ gpu: useGpu });
let errors = [];
let failure = null;
let result = null;
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(ACTION_TIMEOUT_MS);
  errors = collectErrors(page);
  await openScene(page, `${server.url}/`);
  result = await page.evaluate((seconds) => window.__scene.benchmark(seconds), SECONDS);
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
if (failure) {
  console.error(`FAIL: ${failure.message}`);
  process.exit(1);
}
const withinMs = result.medianMs < BUDGET_MS;
const withinCalls = result.drawCalls < BUDGET_CALLS;
console.log(`renderer: ${result.renderer}`);
console.log(`viewport: 1920x1080, frames timed: ${result.frames} over ${SECONDS} s`);
console.log(`median frame time: ${result.medianMs.toFixed(2)} ms (p95 ${result.p95Ms.toFixed(2)} ms) -> budget < ${BUDGET_MS} ms: ${withinMs ? 'ok' : 'OVER'}`);
console.log(`draw calls: ${result.drawCalls} (triangles ${result.triangles}) -> budget < ${BUDGET_CALLS}: ${withinCalls ? 'ok' : 'OVER'}`);
process.exit(withinMs && withinCalls && !errors.length ? 0 : 1);
