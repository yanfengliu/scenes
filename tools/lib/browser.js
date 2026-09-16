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

// A second, BLANK page in the same browser, for image work.
//
// EVERY IMAGE OPERATION IN PAGE JAVASCRIPT BELONGS HERE, NOT ON THE SCENE PAGE, and that is not tidiness.
// The scene page holds a requestAnimationFrame loop that renders the whole post chain, which under
// SwiftShader is seconds a frame, so every `page.evaluate` there waits for the frame in flight before it
// runs. Measured on this machine, the SAME `decodeImage` call on the same file in the same process:
// `out/render.png` to 600x550 cost **96.1 s on the scene page and 0.1 s here**, and `japan.webp` 33.3 s
// against 3.0 s. (`tools/views.js`'s header quotes 80.71 s for a 120 px decode; that is its own
// measurement, not this one, and the argument size is not what costs -- a no-op evaluate on the scene page
// cost it 4.96 s and the same no-op carrying a 1.4 MB data URL 4.74 s.) `tools/animation.js` was doing
// eight of these on the scene page.
//
// The decode is a pure function of the file's bytes -- chromium's own decoder, then a canvas resample at
// `imageSmoothingQuality: 'high'` on a context asked for `willReadFrequently` (tools/lib/image.js), which
// is what keeps both pages on the same raster path. That is measured rather than argued, at full
// precision: the two 1,320,000-byte arrays are byte-identical, sha256 equal and no differing byte, and
// the scores off them are equal as doubles -- 0.07494746503602544 and 0.47332415481740603 on both pages
// (out/scratch/decode-purity.mjs). The falsifier, if this is ever doubted again, is that same script.
// `errors` is the caller's own error array, so this page is watched by the same check the scene page is.
// Moving work off the scene page moves it out from under `collectErrors` unless it is passed here.
export async function openInspector(browser, errors) {
  const page = await browser.newPage({ viewport: { width: 200, height: 200 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(ACTION_TIMEOUT_MS);
  if (errors) collectErrors(page, errors);
  return page;
}

// Every console error, uncaught page error, and failed request lands in the returned array.
//
// Pass `sink` to collect several pages into ONE array, and never write
// `errors = errors.concat(collectErrors(page))`: that copies the array as it is at that instant, which is
// always empty, and every later push goes into the orphan. `tools/nudge.js` did exactly that from the day
// it landed, so its `if (errors.length)` block was dead and the gate could not report a page error at all
// (found by review on 2026-09-11, fixed in the same commit, proved red by injecting a `console.error`).
export function collectErrors(page, sink) {
  const errors = sink ?? [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => errors.push(`requestfailed: ${req.url()} (${req.failure()?.errorText ?? 'unknown'})`));
  return errors;
}

// Load the page and wait for the scene's handshake (index.html sets window.__sceneReady/__sceneState).
// Resolves with the scene's self-description once the first frames are rendered at the photo view.
// A failed script request (the CDN, a source file) or an uncaught page error fails the wait at once
// instead of at the timeout.
//
// The two phases cost quite different things and are timed separately, because knowing which one is slow
// is the whole use of the printed line. `load` fires when the module scripts have finished evaluating,
// which is the scene GRAPH built and nothing drawn yet; `window.__sceneState` turns "ready" two rendered
// frames later (src/main.js), and those two frames are what SwiftShader makes expensive.
//
// The wait AWAITS index.html's own handshake promise in one evaluate rather than polling
// `window.__sceneState` every 100 ms, and that is a speed fix, not a tidy-up. A poll is a
// `page.evaluate`, and an evaluate on this page waits for the frame in flight, so on SwiftShader the polls
// came back about one frame apart however short the sleep between them was: readiness was detected up to a
// whole 1200x1100 frame after it happened, once per page opened, and `npm test` opens about a dozen.
// `window.__sceneReady` settles exactly when `src/main.js` calls `__sceneResolve`, so the number printed
// below is now when the scene was ready rather than when a poll next got a turn -- measured at 21.2 s
// against 33.5 s for the same `shot` page.
//
// Five of the six ways this wait can end are exercised by out/scratch/openscene-proof/run.mjs, with the
// results in docs/learning/gate-proofs.md. The sixth is the `state !== 'ready'` branch below, which no
// page shaped like index.html can reach.
export async function openScene(page, url, { gotoTimeoutMs = GOTO_TIMEOUT_MS, readyTimeoutMs = READY_TIMEOUT_MS } = {}) {
  // A rejection channel for the two things that must not wait out the ceiling. Raising the ceiling would
  // otherwise make a broken page slow to fail; these keep it fast.
  //
  // `armed` is what keeps this from being STRICTER than the loop it replaced, which is a direction the
  // change did not intend. The old loop read `window.__sceneState` and broke out the moment it said
  // "ready", and only checked these two while it still said "loading"; these listeners stay attached
  // until the `finally` below, so without the flag an error arriving after the handshake resolved would
  // fail a page that is already up.
  let armed = true;
  let failEarly = () => {};
  const earlyFailure = new Promise((_, reject) => { failEarly = reject; });
  earlyFailure.catch(() => {}); // it may never be consumed, and an unconsumed rejection would kill node
  const onFailed = (req) => {
    if (armed && /\.(m?js)(\?|$)/.test(req.url())) failEarly(new Error(`a script failed to load: ${req.url()} (${req.failure()?.errorText ?? 'unknown'})`));
  };
  const onPageError = (err) => { if (armed) failEarly(new Error(`the page threw before the scene was ready: ${err.message}`)); };
  page.on('requestfailed', onFailed);
  page.on('pageerror', onPageError);
  const started = Date.now();
  let loaded = started;
  let timer = null;
  try {
    await page.goto(url, { waitUntil: 'load', timeout: gotoTimeoutMs });
    loaded = Date.now();
    const ceiling = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(
        `the scene did not become ready within ${(readyTimeoutMs / 1000).toFixed(0)} s of ${url} loading `
        + `(the page loaded in ${((loaded - started) / 1000).toFixed(1)} s, then index.html's window.__sceneReady `
        + 'never settled). src/main.js resolves it after two rendered frames, so either those frames are '
        + 'slower than the ceiling or the render loop is stuck; raise readyTimeoutMs in '
        + 'tools/lib/browser.js if the machine is simply slow.',
      )), readyTimeoutMs);
    });
    ceiling.catch(() => {});
    // One evaluate, resolving the instant the handshake does. It never returns the api object itself:
    // that holds the renderer and the scene graph and cannot cross the CDP boundary.
    const ready = page.evaluate(() => {
      if (!window.__sceneReady) {
        throw new Error('window.__sceneReady is missing, so this page is not the scene page; index.html sets the handshake in an inline script before boot.js runs');
      }
      return window.__sceneReady.then(
        () => window.__sceneState ?? 'ready',
        (err) => { throw new Error(`the scene handshake rejected: ${err && err.message ? err.message : String(err)}`); },
      );
    }).then((s) => { armed = false; return s; });
    // Promise.race attaches a handler to each of the three, so whichever loses can still reject later
    // without becoming an unhandled rejection.
    const state = await Promise.race([ready, earlyFailure, ceiling]);
    // Unreachable through index.html, which sets __sceneState = 'ready' before it resolves the handshake
    // and reaches its 'error' state through the rejection branch above. It is here for a future page that
    // resolves the promise from somewhere else, and it is NOT covered by the proof harness.
    if (state !== 'ready') throw new Error(`scene state is "${state}", expected "ready"`);
  } finally {
    armed = false;
    if (timer) clearTimeout(timer);
    page.off('requestfailed', onFailed);
    page.off('pageerror', onPageError);
  }
  const readyAt = Date.now();
  console.log(
    `scene ready in ${((readyAt - started) / 1000).toFixed(1)} s `
    + `(page load ${((loaded - started) / 1000).toFixed(1)} s, first frames ${((readyAt - loaded) / 1000).toFixed(1)} s; `
    + `ceilings ${(gotoTimeoutMs / 1000).toFixed(0)} s and ${(readyTimeoutMs / 1000).toFixed(0)} s)`,
  );
  // Two more animation frames so the compositor has presented the rendered canvas, then the scene's own
  // description -- in ONE evaluate, because this function is called once per page and `npm test` opens
  // about a dozen, and a second round-trip here costs a whole frame on every one of them. `describe()`
  // reads `renderer.info.render.*`, which `render()` repopulates each frame and `autoReset = false`
  // keeps, so reading it in the microtask after the second rAF gives the same numbers as reading it a
  // frame later.
  return page.evaluate(async () => {
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    return window.__scene.describe();
  });
}
