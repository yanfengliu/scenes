// npm run views: render a fixed orbit sweep to out/views/<pose>.png at 1200x1100, and list what it wrote
// in out/views/index.txt. The integration owner looks at these every iteration, because the compare gate
// sees one framing and a scene can be right there and wrong from every other angle.
//
// It is a DIAGNOSTIC, not a gate: it fails only when the page errors, never on what the pixels show. It
// does WARN when a frame comes back black, when two poses come back byte-identical, or when the frame
// clamp corrected nothing, because none of those is a page error and all three look exactly like a run
// that worked. Bound on the duplicate check: it is byte-exact, so two poses a millimetre apart still read
// as distinct — it catches a pose that was never applied, not a pose that barely moved.
//
// There is no contact sheet. There was one, a labelled 400 px index.png, and it went because an aggregate
// view answers "is there one of each" and never "is each one right": the poses are reviewed one at a time
// at their own 1200x1100, which is what both recorded sweep reviews did and what this file's own header
// already told them to do. What replaces it is the manifest — each pose's path, sha256 and mean luminance
// — so a review is bound to the bytes it looked at and re-running this tool strands that review instead
// of the review silently inheriting new pixels.
//
// EVERY IMAGE OPERATION IN PAGE JAVASCRIPT RUNS ON A SECOND, BLANK PAGE, and that is not tidiness. (The
// screenshots themselves stay on the scene page, obviously — that is where the scene is. What moved is
// everything that decodes, resamples or composes a file AFTERWARDS.)
// The scene page holds a requestAnimationFrame loop that renders 1200x1100 through the post chain, which
// under SwiftShader takes about five seconds a frame; every `await` inside a page.evaluate there queues
// behind a whole frame. Measured on this machine (out/scratch/views-stall.log): a no-op evaluate on the
// scene page costs 4.96 s, one 120 px decodeImage of a pose costs 80.71 s, and the seven of them that the
// black-frame check needs cost 792 s — thirteen minutes, after the last pose had been written, with
// nothing printed. The argument size is not the cause: the same no-op carrying a 1.4 MB data URL costs
// 4.74 s. On a blank page there is no loop to queue behind. Anything added here that decodes, resamples
// or composes an image belongs on `inspector`, not on `page`.
//
// Bound: it POSES THE CAMERA DIRECTLY (position and orbit target through window.__scene) and never
// touches the mouse, so it is blind to everything that lives in the input path — damping, the wheel, a
// drag that runs the camera into a wall. `npm run record` is the one that drives real mouse events and
// checks every frame. What this tool does borrow from the live path is the frame loop's own camera
// clamp (window.__scene.clampCamera), applied after each pose exactly as the loop applies it after the
// controls, so a pose that would be corrected for a user is corrected here too. Each pose's printed
// position is read back from the camera after the frames that were actually rendered, so it is the pose
// in the file, not the pose that was asked for.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { startServer } from './serve.js';
import { launch, collectErrors, openScene, ACTION_TIMEOUT_MS, HIDE_UI_CSS } from './lib/browser.js';
import { decodeImage } from './lib/image.js';
import * as L from '../src/layout.js';

const OUT_DIR = 'out/views';
// The clock is pinned so two runs of this tool are comparable frame for frame.
const CLOCK = 0;

// The orbit target for every pose that is not the photo view: the photo camera's optical axis at the
// cherry trunk's depth, which is what OrbitControls uses for the photo view itself.
const AXIS = L.uvToWorld(0.5, 0.5, L.CAMERA.targetDepth);

// A pose is a camera position and an orbit target in world metres (y up, the photo camera at x = 0
// looking along -z, +x the right side of the street). The six cover what the photo view cannot show:
// both flanks, the street at eye level, the view back up the stairs, and the two roof rows from above.
export const POSES = [
  {
    name: '1-photo',
    what: 'the photo view, the scored framing',
    position: [L.CAMERA.eye.x, L.CAMERA.eye.y, L.CAMERA.eye.z],
    target: [AXIS.x, AXIS.y, AXIS.z],
  },
  {
    name: '2-orbit-left-up',
    what: 'orbited left and raised, over the left house row',
    position: [AXIS.x - 19.0, AXIS.y + 13.0, AXIS.z + 17.0],
    target: [AXIS.x, AXIS.y, AXIS.z],
  },
  {
    name: '3-orbit-right-up',
    what: 'orbited right and raised, over the right machiya',
    position: [AXIS.x + 21.0, AXIS.y + 14.0, AXIS.z + 18.0],
    target: [AXIS.x, AXIS.y, AXIS.z],
  },
  {
    name: '4-paving-down-steps',
    what: 'standing on the top landing, looking down the steps',
    position: [-0.6, L.PLATFORM_Y + 1.6, 1.2],
    target: [-0.9, L.streetY(-12) + 0.6, -12.0],
  },
  {
    // The target sits only about 14 degrees above the eye. OrbitControls caps the polar angle at
    // 0.58 PI, so a steeper look-up is not a pose a user can hold: asked for one, update() swings the
    // camera back and up, and the first version of this pose ended up inside the cherry's canopy.
    name: '5-landing-look-back',
    what: 'from the landing at the foot of the stairs, looking back up',
    position: [-0.6, L.streetY(-16.0) + 1.7, -16.0],
    target: [-0.4, L.streetY(-16.0) + 6.0, 2.0],
  },
  {
    name: '6-high-over-roofs',
    what: 'high over both roof rows, down the street',
    position: [0.5, 26.0, 15.0],
    target: [-1.5, 0.0, -20.0],
  },
  {
    // The pose that proves the clamp ran. The five above are all reachable, so `clampCamera` is a no-op
    // for every one of them and deleting the call would produce byte-identical files: a check that cannot
    // tell "passed" from "did not run". This one asks for a camera 1 m under the street and 4.4 m inside
    // the right machiya's ground floor, and the frame loop's clamp pushes it back to the street's right
    // edge and up to the floor clearance, which is what a user's drag gets. `expectClamp` makes the tool
    // say so when it does not happen.
    name: '7-clamped-out-of-the-wall',
    what: 'asked for a pose inside the right machiya and below the street; the frame clamp corrects it',
    position: [6.0, L.streetY(-8.0) - 1.0, -8.0],
    target: [AXIS.x, AXIS.y, AXIS.z],
    expectClamp: true,
  },
];

export async function renderViews({ outDir = OUT_DIR, quiet = false } = {}) {
  let server = null;
  let browser = null;
  let errors = [];
  let failure = null;
  const rendered = [];
  try {
    server = await startServer({ port: 0, quiet: true });
    // launch() throws when chromium is not cached (`npx playwright install chromium` once). Inside the
    // try, that comes out as this tool's own FAIL line with the server already closed, instead of an
    // unhandled rejection with an HTTP listener left behind.
    browser = await launch();
    const page = await browser.newPage({ viewport: { width: L.SHOT.width, height: L.SHOT.height }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(ACTION_TIMEOUT_MS);
    errors = collectErrors(page);
    const info = await openScene(page, `${server.url}/`);
    await page.addStyleTag({ content: HIDE_UI_CSS });
    const hasClamp = await page.evaluate(() => typeof window.__scene.clampCamera === 'function');
    if (!hasClamp && !quiet) {
      console.warn('note: window.__scene.clampCamera is not exposed; poses are rendered unclamped, so one may sit where a drag could not put it');
    }
    mkdirSync(outDir, { recursive: true });
    // The manifest is written last. Delete any older one first, so a run that dies partway leaves no
    // index rather than a previous run's index sitting beside new frames and describing a different
    // build. index.png is no longer written at all; this removes one an older build left behind.
    // What this does NOT do is delete the pose PNGs: a run that dies at pose 4 leaves three frames from
    // the run before it beside four new ones. The missing index.txt is the only thing that says so, so a
    // directory with no index.txt in it is a directory whose frames cannot be trusted to be one sweep.
    rmSync(`${outDir}/index.png`, { force: true });
    rmSync(`${outDir}/index.txt`, { force: true });
    if (!quiet) console.log(`renderer: ${info.renderer}; clock pinned at t = ${CLOCK}`);

    let clampFired = false;
    let n = 0;
    for (const pose of POSES) {
      const poseStarted = Date.now();
      n++;
      // The pose goes through the same objects the frame loop uses, in the loop's own order:
      // camera.position, controls.target, controls.update(), clampCamera(). Clamp LAST, as in main.js —
      // update() re-applies the polar and distance limits, so an update placed after the clamp can undo
      // part of it and then be reported as the clamp's doing. Damping is off for this update so a pose is
      // reproducible: with it on, update() would carry residue from the pose before this one.
      const placed = await page.evaluate(
        ({ position, target, clock }) => {
          const s = window.__scene;
          const damping = s.controls.enableDamping;
          s.controls.enableDamping = false;
          s.camera.position.set(position[0], position[1], position[2]);
          s.controls.target.set(target[0], target[1], target[2]);
          s.controls.update();
          const afterControls = s.camera.position.toArray();
          if (typeof s.clampCamera === 'function') s.clampCamera();
          s.controls.enableDamping = damping;
          s.setTime(clock);
          return { afterControls, afterClamp: s.camera.position.toArray() };
        },
        { position: pose.position, target: pose.target, clock: CLOCK },
      );
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
      // Read the camera back AFTER those two frames. Each of them ran controls.update() and clampCamera()
      // again, so the pose that was actually rendered is this one, not the one the evaluate above returned.
      const shot = await page.evaluate(() => ({
        position: window.__scene.camera.position.toArray(),
        target: window.__scene.controls.target.toArray(),
        distance: window.__scene.camera.position.distanceTo(window.__scene.controls.target),
      }));
      const file = `${outDir}/${pose.name}.png`;
      await page.screenshot({ path: file, type: 'png' });
      rendered.push({ ...pose, ...placed, ...shot, file });
      const fmt = (v) => v.map((n) => n.toFixed(2)).join(', ');
      const differs = (a, bb) => a.some((n, i) => Math.abs(n - bb[i]) > 0.005);
      // Three corrections, reported apart: the controls' own limits (polar angle, distance), the frame
      // loop's clamp (the floor, the street corridor, the roof zone), and anything the two rendered frames
      // then did on top of both.
      const notes = [];
      if (differs(pose.position, placed.afterControls)) notes.push('controls limit');
      if (differs(placed.afterControls, placed.afterClamp)) notes.push('frame clamp');
      if (differs(placed.afterClamp, shot.position)) notes.push('drift over the two rendered frames');
      if (differs(placed.afterControls, placed.afterClamp)) clampFired = true;
      if (pose.expectClamp && !differs(placed.afterControls, placed.afterClamp)) {
        console.warn(`WARNING: ${pose.name} exists to be corrected by the frame clamp and was not — either the clamp is not running or the pose has become reachable, and either way this run proves nothing about the clamp`);
      }
      if (!quiet) {
        // The elapsed seconds are the progress signal for the slow half of this tool: a pose that is
        // simply slow and a pose that has hung look the same without them.
        console.log(
          `[${n}/${POSES.length}] ${pose.name.padEnd(26)} ${((Date.now() - poseStarted) / 1000).toFixed(1)} s  `
          + `eye (${fmt(shot.position)})  target (${fmt(shot.target)})  ${shot.distance.toFixed(1)} m`
          + `${notes.length ? `  [moved by: ${notes.join(' + ')}]` : ''}  ${pose.what}`,
        );
      }
    }
    if (!clampFired) console.warn('WARNING: the frame clamp corrected no pose in this run, so nothing here exercised it');

    // A view that did not render looks exactly like one that rendered a black frame, and six poses that
    // all rendered the same frame look exactly like six poses that worked. Neither is a page error, so
    // neither would be caught above. Measure both, and print each file's digest so a review of these
    // images is bound to the bytes it actually looked at rather than to the filename.
    //
    // On `inspector`, the blank page, for the reason in this file's header: the same seven decodes cost
    // 792 s on the scene page and print nothing while they do it.
    const inspector = await browser.newPage({ viewport: { width: 200, height: 200 }, deviceScaleFactor: 1 });
    inspector.setDefaultTimeout(ACTION_TIMEOUT_MS);
    const seen = new Map();
    const inspectStarted = Date.now();
    for (const r of rendered) {
      const started = Date.now();
      const bytes = readFileSync(r.file);
      r.digest = createHash('sha256').update(bytes).digest('hex').slice(0, 12);
      const small = await decodeImage(inspector, r.file, { width: 120, height: Math.round((120 * L.SHOT.height) / L.SHOT.width) });
      let sum = 0;
      for (let i = 0; i < small.data.length; i += 4) sum += 0.299 * small.data[i] + 0.587 * small.data[i + 1] + 0.114 * small.data[i + 2];
      r.meanLuma = (sum / (small.data.length / 4));
      if (!quiet) {
        console.log(`${r.name.padEnd(26)} sha256 ${r.digest}  ${(bytes.length / 1e6).toFixed(2)} MB  mean luma ${r.meanLuma.toFixed(1)}  (${((Date.now() - started) / 1000).toFixed(1)} s)`);
      }
      if (r.meanLuma < 6) console.warn(`WARNING: ${r.name} has a mean luminance of ${r.meanLuma.toFixed(1)} — that frame is black, and this tool cannot tell a black render from a render that never happened`);
      const twin = seen.get(r.digest);
      if (twin) console.warn(`WARNING: ${r.name} is byte-identical to ${twin} — two poses produced the same frame, so at least one pose was not applied`);
      else seen.set(r.digest, r.name);
    }
    if (!quiet) console.log(`inspected ${rendered.length} frames in ${((Date.now() - inspectStarted) / 1000).toFixed(1)} s on a blank page`);

    // The manifest, which is what a review quotes. Plain text on purpose: it cannot be looked AT, so it
    // cannot become the thing that gets reviewed instead of the frames.
    // One digest over all seven, so a review can quote ONE value and re-running the tool strands it.
    // Comparing seven 12-character digests by eye is the check nobody actually performs.
    const sweepDigest = createHash('sha256').update(rendered.map((r) => `${r.name} ${r.digest}`).join('\n')).digest('hex').slice(0, 12);
    const manifest = [
      `# npm run views — sweep ${sweepDigest}`,
      `# ${new Date().toISOString()}; renderer: ${info.renderer}; clock pinned at t = ${CLOCK}; ${L.SHOT.width}x${L.SHOT.height}`,
      '# Review each frame at its own resolution and quote the sweep digest above, or a frame\'s own sha256;',
      '# re-running this tool replaces the bytes and strands that review rather than letting it inherit new',
      '# pixels. The sweep digest is over the seven frame digests, so it moves when any frame moves and is',
      '# the only line here that does not change between two runs of an unchanged tree.',
      ...rendered.map((r) => `${r.name.padEnd(26)} ${r.digest}  luma ${r.meanLuma.toFixed(1).padStart(5)}  eye ${r.position.map((v) => v.toFixed(2)).join(', ')}  ${resolve(r.file)}`),
    ].join('\n');
    writeFileSync(`${outDir}/index.txt`, `${manifest}\n`);
    if (!quiet) console.log(`\nwrote ${rendered.length} views to ${outDir}/ at ${L.SHOT.width}x${L.SHOT.height}, sweep digest ${sweepDigest}, listed in ${outDir}/index.txt:`);
    if (!quiet) for (const r of rendered) console.log(`  ${resolve(r.file)}  sha256 ${r.digest}`);
    if (!quiet) console.log('there is no contact sheet: look at each frame at its own size (see this file\'s header)');
    if (!quiet) console.log('these poses are set directly; npm run record is the one that drives the controls');
  } catch (err) {
    failure = err;
  } finally {
    // Both closes run even if the first throws, so a failing browser teardown never leaves the HTTP
    // listener behind. A close error is only reported when it is the only thing that went wrong.
    for (const close of [() => browser?.close(), () => server?.close()]) {
      try {
        await close();
      } catch (err) {
        failure ??= err;
      }
    }
  }
  return { rendered, errors, failure };
}

// Works on Linux as well as Windows. The sibling tools build the URL by hand as
// `file:///${process.argv[1].replace(/\\/g, '/')}`, which matches on Windows and NEVER on Linux, where
// argv[1] already starts with a slash and the template yields `file:////home/...` with four. That is why
// blackframe, record, shimmer and paintcheck have never run in CI (see
// docs/work/0_japan-street-scene/plan.md). pathToFileURL builds the same URL node's loader does, on both,
// and survives spaces and percent-encoding as well.
function isMainModule() {
  if (!process.argv[1]) return false;
  return pathToFileURL(resolve(process.argv[1])).href === new URL(import.meta.url).href;
}

if (isMainModule()) {
  const { errors, failure } = await renderViews();
  if (errors.length) {
    console.error(`FAIL: ${errors.length} page error(s):`);
    for (const e of errors) console.error(`  ${e}`);
  }
  if (failure) console.error(`FAIL: ${failure.message}`);
  if (errors.length || failure) process.exit(1);
}
