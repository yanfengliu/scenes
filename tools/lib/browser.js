// Shared Playwright helpers for the gates.
import { chromium } from 'playwright';

// Headless chromium refuses WebGL on its software renderer (SwiftShader) unless this flag is set.
export const WEBGL_ARGS = ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
// Try the real GPU through ANGLE/D3D11; falls back to SwiftShader when no GPU is usable.
export const GPU_ARGS = [...WEBGL_ARGS, '--use-angle=d3d11', '--enable-gpu-rasterization'];

export function launch({ gpu = false } = {}) {
  return chromium.launch({ args: gpu ? GPU_ARGS : WEBGL_ARGS });
}

// WHICH RENDERER A GATE ASKS FOR, and the switch that forces the other one.
//
// Only two gates' verdicts depend on the CPU rasterizer: `shot` produces the scored render and `compare`
// scores it, and the numbers in `docs/PLAN-scores.md` must match CI digit for digit, which they do
// because SwiftShader is deterministic across machines while GPU drivers are not. Every other gate
// inherited SwiftShader without its verdict depending on it, and paid for it on a machine with a GPU: a
// 1200x1100 frame there is about 5.0 s and a round-trip to the scene page about 14 s, against about 5 ms
// a frame on this machine's GPU. They ask for the GPU now; each one's header says so and says why.
//
// `<NAME>_GPU=0` forces one gate onto SwiftShader and `GATES_GPU=0` forces all of them, which is how the
// two renderers are measured against each other on one machine without editing anything -- and how the
// CI path is exercised locally. Asking for the GPU is a REQUEST: chromium falls back to SwiftShader
// where there is no usable GPU (every CI runner), which is why nothing here asserts that it got one and
// why every gate prints what it actually got.
//
// The GATE'S OWN variable wins over `GATES_GPU`, in both directions, and `ci.yml` depends on that: it
// sets `GATES_GPU=0` so the renderer every gate uses there is a stated decision rather than a property of
// the runner, and `BLACKFRAME_GPU=1` so the one gate whose defect IS a GPU driver behaviour keeps asking
// for a GPU wherever it runs. Without this precedence those two lines contradict each other and the
// broader one silently wins.
export function wantsGpu(name) {
  const own = process.env[`${name}_GPU`];
  if (own === '0') return false;
  if (own === '1') return true;
  return process.env.GATES_GPU !== '0';
}

// True when the string `describe().renderer` returned names a software rasterizer rather than a GPU.
// Matched on the renderer string because that is the only thing the page can actually report: chromium
// answers `--use-angle=d3d11` with ANGLE over D3D11 on a GPU ("ANGLE (NVIDIA, NVIDIA GeForce RTX 4090
// … D3D11)") and with ANGLE over Vulkan/SwiftShader where there is none ("ANGLE (Google, Vulkan 1.3.0
// (SwiftShader Device (Subzero) …), SwiftShader driver)"). `llvmpipe` and `softpipe` are Mesa's software
// rasterizers, which a Linux runner without SwiftShader can land on instead.
//
// WARP is the one an independent review added, and it is the dangerous one: on a Windows box with no
// usable GPU, `--use-angle=d3d11` lands on Microsoft's own software D3D11 device, which reports "ANGLE
// (Microsoft, Microsoft Basic Render Driver Direct3D11 …, D3D11)". Nothing in that string says software
// and the earlier pattern classified it as a GPU, which would have handed `nudge` limits measured on an
// RTX 4090 to a CPU rasterizer and reddened a healthy scene with nothing in the log to explain it.
const SOFTWARE_RENDERERS = /swiftshader|llvmpipe|softpipe|software|basic render driver|\bwarp\b/i;
export function isSoftwareRenderer(name) {
  return SOFTWARE_RENDERERS.test(String(name));
}

// Chromium's MASKED renderer string, which names no device at all: `src/main.js`'s `rendererName()` falls
// back to `gl.getParameter(gl.RENDERER)` when `WEBGL_debug_renderer_info` is unavailable, and that
// returns "WebGL 2.0 (OpenGL ES 3.0 Chromium)" whatever is underneath. It is neither a GPU nor a software
// rasterizer as far as any caller can tell, and guessing is worse than stopping: the two limit sets in
// `tools/nudge.js` differ by more than a factor of two. Also covers the initial 'unknown' a tool carries
// before `openScene` has answered.
const MASKED_RENDERER = /^webgl \d+\.\d+ \(opengl es [\d.]+ chromium\)$/i;
export function isUnrecognisedRenderer(name) {
  const s = String(name ?? '').trim();
  return s === '' || s === 'unknown' || MASKED_RENDERER.test(s);
}

// The renderer, as a gate prints it in the line that proves it ran.
//
// A gate that ASKED for the GPU and got SwiftShader is measuring a different thing from the one it asked
// for -- that is the normal case on CI -- and it says so here rather than printing a renderer string that
// only a reader who knows the ANGLE spellings can classify. A gate that asked for software and got it
// says that too, so `GATES_GPU=0` is visible in the log it produced.
export function rendererTag(name, wantedGpu) {
  if (isUnrecognisedRenderer(name)) return `${name} [UNRECOGNISED: this names no device, so nothing here can tell a GPU from a CPU rasterizer]`;
  const software = isSoftwareRenderer(name);
  if (wantedGpu && software) return `${name} [SOFTWARE FALLBACK: the GPU was asked for and none was available]`;
  if (!wantedGpu && !software) return `${name} [GPU, though software was asked for]`;
  return `${name} [${software ? 'software' : 'GPU'}]`;
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

// Every `post:` warning a watched page prints, echoed to this process's output the moment it arrives and
// kept per page for a gate that wants to fail on one.
//
// WHY THIS IS NOT IN `errors`. src/post.js announces every ladder step-down and every watchdog ratchet
// with `console.warn`, and `collectErrors` below only ever looked at `console.error`, so NO GATE COULD
// SEE ONE. The scene could be drawn at a lesser configuration -- a smaller target, fewer multisamples,
// none at all -- and every gate in this repo would report a pass and print nothing about it. That is a
// step-down the machine decided on and said out loud into a log nobody was reading. It is not an error,
// though: the ladder exists because stepping down is the right answer on a driver where the top rung
// produces a NaN frame, and a gate whose verdict does not depend on the configuration (placement,
// clearance, namerules) should not go red for one. So it is echoed everywhere and fatal in exactly one
// place, `shot`, whose frame IS the configuration it was drawn at.
//
// Bound: this sees what the page PRINTED. A step-down that happens after the last console event has
// crossed the CDP connection is not in the array, and a future change to src/post.js that stops warning
// takes this with it. `shot` therefore also reads the post state itself out of the page and refuses
// anything but the top rung, which is the check that does not depend on a string.
const POST_WARNINGS = new WeakMap();
export function postWarnings(page) {
  return POST_WARNINGS.get(page) ?? [];
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
  // One console listener per page, whatever a caller does. Two calls on the same page would otherwise
  // push every `post:` warning twice and echo it twice, and `shot`'s failure text would report double the
  // step-downs -- a gate lying about the size of what it caught. No caller does this today
  // (`paintcheck.js` calls it twice but on two different pages), so this is latent, and latent is exactly
  // when it is cheap to close. Found by an independent review, 2026-09-17.
  const alreadyWatched = POST_WARNINGS.has(page);
  const posts = POST_WARNINGS.get(page) ?? [];
  POST_WARNINGS.set(page, posts);
  if (!alreadyWatched) {
    page.on('console', (msg) => {
      const text = msg.text();
      // ECHOED on any of the three prefixes and at any console level, so a gate's log carries everything
      // the post chain decided. COLLECTED, and therefore fatal in `shot`, only for a `post:` WARNING,
      // which src/post.js uses for a step-down and for nothing else: a contradicted black reading is a
      // `post:` LOG and the watchdog giving up is a `watchdog:` warning, and neither is a frame drawn at
      // a lesser configuration. Without the echo those two were visible in exactly one gate's output --
      // `shot`, from the sidecar -- which is the "announced and nobody was listening" defect in
      // miniature, and an independent review said so.
      if (!text.startsWith('post:') && !text.startsWith('watchdog:')) return;
      // Printed as it arrives, not gathered for a summary: a gate that dies before its summary would
      // otherwise take the one record of a step-down with it.
      console.log(`  page: ${text}`);
      if (msg.type() === 'warning' && text.startsWith('post:')) posts.push(text);
    });
  }
  // The error listeners are attached on EVERY call, unchanged: a caller that calls this twice with two
  // sinks means to collect into both, and that was the behaviour before the block above existed.
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
// `settleFrames` is how many further animation frames to wait for before reading the scene's
// description. TWO is the default and is what every gate that captures pixels needs: the second frame is
// what gives the compositor the canvas `page.screenshot` captures, and a race that fires occasionally
// looks exactly like a pass.
//
// ZERO is for a gate that never looks at a pixel. `placement` and `clearance` cast rays against the
// scene graph on the CPU; no frame enters their verdicts, and the scene has already rendered two frames
// by the time it calls itself ready, so `describe()` still reports a real frame's counters. It saves two
// whole frames per page plus the round-trip that waits on them -- nothing on a GPU, and on SwiftShader
// about 10 s of frames at `placement`'s 1200x1100 (measured at 5.0 s a frame) inside a round-trip nearer
// 14 s, less at `clearance`'s 640x480, and more than either on a shared runner, which is where it counts.
export async function openScene(page, url, { gotoTimeoutMs = GOTO_TIMEOUT_MS, readyTimeoutMs = READY_TIMEOUT_MS, settleFrames = 2 } = {}) {
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
  // `settleFrames` more animation frames so the compositor has presented the rendered canvas, then the
  // scene's own description -- in ONE evaluate, because this function is called once per page and
  // `npm test` opens about a dozen, and a second round-trip here costs a whole frame on every one of
  // them. `describe()` reads `renderer.info.render.*`, which `render()` repopulates each frame and
  // `autoReset = false` keeps, so reading it in the microtask after the last rAF gives the same numbers
  // as reading it a frame later.
  // The wait is CHAINED rather than a loop of separate awaits, so `settleFrames = 2` is the same
  // structure this was before it took a parameter -- `requestAnimationFrame(() =>
  // requestAnimationFrame(done))` -- and not something that has to be argued equivalent through when a
  // microtask gets its turn relative to the frame callback list. `shot`'s render is a byte-for-byte
  // contract and this function is on its path.
  return page.evaluate(async (frames) => {
    if (frames > 0) {
      await new Promise((done) => {
        let left = frames;
        const step = () => {
          left -= 1;
          if (left > 0) requestAnimationFrame(step);
          else done();
        };
        requestAnimationFrame(step);
      });
    }
    return window.__scene.describe();
  }, settleFrames);
}
