// Shared Playwright helpers for the gates.
import { chromium } from 'playwright';

// Headless chromium refuses WebGL on its software renderer (SwiftShader) unless this flag is set.
export const WEBGL_ARGS = ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
// Try the real GPU through ANGLE/D3D11; falls back to SwiftShader when no GPU is usable.
export const GPU_ARGS = [...WEBGL_ARGS, '--use-angle=d3d11', '--enable-gpu-rasterization'];

export function launch({ gpu = false } = {}) {
  return chromium.launch({ args: gpu ? GPU_ARGS : WEBGL_ARGS });
}

// Playwright's default action timeout is 30 s. One frame of this scene at 1200x1100 through SwiftShader
// takes minutes on a machine without a GPU (a CI runner), so every gate gives its page far longer before
// it calls a screenshot a failure.
export const ACTION_TIMEOUT_MS = 300_000;


// Every console error, uncaught page error, and failed request lands in the returned array.
export function collectErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => errors.push(`requestfailed: ${req.url()} (${req.failure()?.errorText ?? 'unknown'})`));
  return errors;
}

// Load the page and wait for the scene's handshake (index.html sets window.__sceneState).
// Resolves with the scene's self-description once the first frames are rendered at the photo view.
// A failed script request (the CDN, a source file) fails the wait at once instead of at the timeout.
export async function openScene(page, url, { timeoutMs = 90_000 } = {}) {
  let failedRequest = null;
  const onFailed = (req) => {
    if (!failedRequest && /\.(m?js)(\?|$)/.test(req.url())) failedRequest = `${req.url()} (${req.failure()?.errorText ?? 'unknown'})`;
  };
  page.on('requestfailed', onFailed);
  try {
    await page.goto(url, { waitUntil: 'load', timeout: timeoutMs });
    const deadline = Date.now() + timeoutMs;
    while (true) {
      const state = await page.evaluate(() => window.__sceneState);
      if (state && state !== 'loading') {
        if (state !== 'ready') throw new Error(`scene state is "${state}", expected "ready"`);
        break;
      }
      if (failedRequest) throw new Error(`a script failed to load: ${failedRequest}`);
      if (Date.now() > deadline) throw new Error(`scene did not become ready within ${timeoutMs} ms`);
      await page.waitForTimeout(100);
    }
  } finally {
    page.off('requestfailed', onFailed);
  }
  // Two more animation frames so the compositor has presented the rendered canvas.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  return page.evaluate(() => window.__scene.describe());
}
