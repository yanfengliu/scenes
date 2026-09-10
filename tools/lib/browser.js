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

// How long `openScene` allows for each of its two phases. Both are CEILINGS, not waits: the goto returns
// the moment the page has loaded and the poll below breaks the moment the scene says it is ready, so a
// fast machine pays nothing for a generous number and a slow one is not failed for being slow.
//
// Why 300 s, when this was 90 s for both. A CI runner renders through SwiftShader, and runners differ
// enough that the same commit measured 28 minutes of `animation` on one and 37 on another, about 1.3x;
// the 2026-09-06 devlog measured a contended runner at roughly 7x local speed against 4.75x for a free
// one. Ninety seconds left no room for any of that: the readiness deadline fired inside `nudge` on the
// slow runner -- attempt 1 of run 34309378871 on e725914, job 102332670039, `FAIL: scene did not become
// ready within 90000 ms` after animation had passed -- while the same code had passed an hour earlier on
// a faster one. Look in that attempt's log, not the run's: the run reads green because attempt 2, a
// re-run of the same commit, passed. 300 s is the ceiling `ACTION_TIMEOUT_MS` already gives
// a single screenshot, and it clears the slowest readiness this repo has measured several times over.
// Every open prints what it actually took against the ceiling, so the margin is in every log from now on
// and the next change to these numbers can be argued from data rather than guessed.
//
// Raising a ceiling would normally make a broken page slow to fail. It does not here: a script that fails
// to load and an uncaught page error both end the wait at once, below.
export const GOTO_TIMEOUT_MS = 300_000;
export const READY_TIMEOUT_MS = 300_000;

// The page's own chrome is UI, not scene: every gate that screenshots hides it with this, so a control
// added to index.html's #hud never lands in a scored image.
export const HIDE_UI_CSS = '#hud { display: none !important; } #loading { display: none !important; }';

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
// A failed script request (the CDN, a source file) or an uncaught page error fails the wait at once
// instead of at the timeout.
//
// The two phases cost quite different things and are timed separately, because knowing which one is slow
// is the whole use of the printed line. `load` fires when the module scripts have finished evaluating,
// which is the scene GRAPH built and nothing drawn yet; `window.__sceneState` turns "ready" two rendered
// frames later (src/main.js), and those two frames are what SwiftShader makes expensive.
export async function openScene(page, url, { gotoTimeoutMs = GOTO_TIMEOUT_MS, readyTimeoutMs = READY_TIMEOUT_MS } = {}) {
  let failedRequest = null;
  let pageError = null;
  const onFailed = (req) => {
    if (!failedRequest && /\.(m?js)(\?|$)/.test(req.url())) failedRequest = `${req.url()} (${req.failure()?.errorText ?? 'unknown'})`;
  };
  const onPageError = (err) => { if (!pageError) pageError = err.message; };
  page.on('requestfailed', onFailed);
  page.on('pageerror', onPageError);
  const started = Date.now();
  let loaded = started;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: gotoTimeoutMs });
    loaded = Date.now();
    const deadline = loaded + readyTimeoutMs;
    while (true) {
      const state = await page.evaluate(() => window.__sceneState);
      if (state && state !== 'loading') {
        if (state !== 'ready') throw new Error(`scene state is "${state}", expected "ready"`);
        break;
      }
      if (failedRequest) throw new Error(`a script failed to load: ${failedRequest}`);
      if (pageError) throw new Error(`the page threw before the scene was ready: ${pageError}`);
      if (Date.now() > deadline) {
        throw new Error(
          `the scene did not become ready within ${(readyTimeoutMs / 1000).toFixed(0)} s of ${url} loading `
          + `(the page loaded in ${((loaded - started) / 1000).toFixed(1)} s, then window.__sceneState stayed `
          + `"${state ?? 'undefined'}" instead of turning "ready"). src/main.js resolves after two rendered `
          + 'frames, so either those frames are slower than the ceiling or the render loop is stuck; raise '
          + 'readyTimeoutMs in tools/lib/browser.js if the machine is simply slow.',
        );
      }
      await page.waitForTimeout(100);
    }
  } finally {
    page.off('requestfailed', onFailed);
    page.off('pageerror', onPageError);
  }
  const ready = Date.now();
  console.log(
    `scene ready in ${((ready - started) / 1000).toFixed(1)} s `
    + `(page load ${((loaded - started) / 1000).toFixed(1)} s, first frames ${((ready - loaded) / 1000).toFixed(1)} s; `
    + `ceilings ${(gotoTimeoutMs / 1000).toFixed(0)} s and ${(readyTimeoutMs / 1000).toFixed(0)} s)`,
  );
  // Two more animation frames so the compositor has presented the rendered canvas.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  return page.evaluate(() => window.__scene.describe());
}
