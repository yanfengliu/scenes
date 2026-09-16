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
// RENDERER: THE GPU, because nothing here is a verdict. This tool fails only on a page error; its whole
// output is frames for a person to look at, and a person looking at a pose from the left flank is looking
// for a wall standing in the road, not for a driver's antialiasing. On SwiftShader the seven poses cost
// about five and a half minutes, which is what the diagnostic that is meant to be run every iteration
// could least afford. `VIEWS_GPU=0` (or `GATES_GPU=0`) puts it back on SwiftShader.
//
// A SWEEP DIGEST IS A DIGEST OF THAT RENDERER'S PIXELS. The manifest exists so a review is bound to the
// bytes it looked at, and the renderer is part of what produced those bytes: the same tree renders
// different frames on ANGLE/D3D11 and on SwiftShader, so a digest from one never matches the other and a
// review that quotes one is a review of that renderer's sweep. Every digest quoted in a review before
// 2026-09-15 is a SwiftShader digest. The manifest names the renderer on its own line for exactly this
// reason, and a review comparing digests across a renderer change is comparing nothing.
//
// AND A DIGEST ONLY BINDS ANYTHING IF IT REPRODUCES. Until 2026-09-16 pose 7's did not: it is the pose
// the frame clamp corrects, and the clamp and the controls' polar limit take three (update, clamp) pairs
// to agree, while the two rAF settle frames give the page's loop an unfixed number of turns. So the
// camera landed on the second or the third of those states run to run and the bytes moved with it —
// which silently made the SWEEP digest, taken over all seven, unquotable too. Each pose is now settled to
// a fixed point before it is shot; the block that does it is in the pose evaluate below.
//
// WHAT BINDS THIS SWEEP TO THE SCORE. `out/views/1-photo.png` was byte-identical to `out/render.png`
// until 2026-09-15, which is how a review holding a sweep and a score could see they were of one tree.
// That went when this tool moved to the GPU (11 s against 291 s) and `shot` stayed on SwiftShader (the
// scored contract), and what replaced it was an inference: that nobody edited `src/` in between. So the
// manifest now records the sha256 of the tree these frames were rendered from — `index.html` and every
// file under `src/` — beside each pose digest, `shot` records the same hash in `out/render.tree.json`,
// and `npm run treecheck` refuses to call a sweep and a score the same tree when the two disagree. The
// hash is read from disk before the first pose and again before the manifest is written, so "the tree
// held still during the run" is checked here rather than assumed. See tools/lib/treehash.js.
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
// `isMainModule` comes from serve.js and is never hand-built here: the hand-built form is how four tools
// came to skip their whole main block on every CI run for three days (docs/learning/gate-proofs.md).
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isMainModule, startServer } from './serve.js';
import { launch, collectErrors, openScene, openInspector, rendererTag, wantsGpu, ACTION_TIMEOUT_MS, HIDE_UI_CSS } from './lib/browser.js';
import { decodeImage } from './lib/image.js';
import { sourceTree, shortHash, diffTrees } from './lib/treehash.js';
import * as L from '../src/layout.js';

const OUT_DIR = 'out/views';
// The clock is pinned so two runs of this tool are comparable frame for frame.
const CLOCK = 0;
// How many (controls.update, clampCamera) pairs a pose may take to stop moving before this tool says it
// never will. Measured on this tree, pairs that MOVE the camera, pose 1 to 7: 0, 0, 1, 10, 0, 2, 6. So
// the observed maximum is TEN, at pose 4, and 32 is 3.2x over it. A pair is arithmetic, not a frame, so
// the budget is cheap.
//
// Do not read "three" here from `out/scratch/pose7.mjs`: that probe watched camera Y converge in three
// pairs, and the loop below tests bit-equality over all six components of position AND target, which
// takes pose 7 six. A budget justified by the wrong measurement is a budget nobody can defend, and this
// comment said "pose 7 takes three; the rest take one" until an independent critic checked it against the
// tool's own printed counts (2026-09-16).
const MAX_SETTLE = 32;

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

export async function renderViews({ outDir = OUT_DIR, quiet = false, gpu = wantsGpu('VIEWS') } = {}) {
  let server = null;
  let browser = null;
  let errors = [];
  let failure = null;
  const rendered = [];
  // The tree these frames are rendered from, read before the page is opened and again before the
  // manifest is written. Recording it is what binds a sweep to a compare score now that `1-photo.png` is
  // no longer byte-identical to `out/render.png`: see tools/lib/treehash.js, and `npm run treecheck`.
  const treeAtStart = sourceTree();
  try {
    server = await startServer({ port: 0, quiet: true });
    // launch() throws when chromium is not cached (`npx playwright install chromium` once). Inside the
    // try, that comes out as this tool's own FAIL line with the server already closed, instead of an
    // unhandled rejection with an HTTP listener left behind.
    browser = await launch({ gpu });
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
    if (!quiet) console.log(`renderer: ${rendererTag(info.renderer, gpu)}; clock pinned at t = ${CLOCK}`);

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
        ({ position, target, clock, maxSettle }) => {
          const s = window.__scene;
          const damping = s.controls.enableDamping;
          s.controls.enableDamping = false;
          s.camera.position.set(position[0], position[1], position[2]);
          s.controls.target.set(target[0], target[1], target[2]);
          s.controls.update();
          const afterControls = s.camera.position.toArray();
          if (typeof s.clampCamera === 'function') s.clampCamera();
          const afterClamp = s.camera.position.toArray();
          s.controls.enableDamping = damping;
          s.setTime(clock);
          // ---- SETTLE THE POSE TO A FIXED POINT OF THE FRAME LOOP'S OWN PAIR ----------------------
          // Poses 1, 2 and 5 already are one: the clamp is a no-op for them and `enableDamping = false;
          // update()` above zeroed the controls' deltas, so every later (update, clamp) rewrites the
          // same position. POSES 3, 4, 6 AND 7 ARE NOT — 1, 10, 2 and 6 moving pairs respectively, and
          // pose 4 is the worst of them, not pose 7. Pose 7 is simply the one that was NOTICED, because
          // it is the only one where the disagreement crosses a pixel boundary: the clamp pushes its
          // camera out of the machiya's wall to a place the controls' own polar limit then pulls back.
          // Its camera y over successive pairs (out/scratch/pose7.mjs) is -2.030806 at the clamp, then
          // -1.840034, -1.839704, -1.839703, and bit-identical for the next seventeen — three pairs to
          // settle Y, six to settle all six components of position and target, which is what is tested.
          //
          // The two settle frames below are rAF frames, and how many of the PAGE's own loop frames the
          // compositor fits inside them is not fixed. So the pose that was actually rendered landed on
          // the second or the third of those states run to run, the frame differed, and pose 7's
          // digest was never reproducible — which makes it unquotable, and a sweep digest taken over
          // all seven unquotable with it. That is the whole point of the manifest.
          //
          // So iterate the loop's pair here, with damping restored exactly as the loop has it, until
          // the camera and the target stop moving at all. Bit equality, not a tolerance: the probe
          // shows a true fixed point, and a tolerance would hide the day it stops being one.
          const state = () => s.camera.position.toArray().concat(s.controls.target.toArray());
          let settle = 0;
          for (; settle < maxSettle; settle++) {
            const before = state();
            s.controls.update();
            if (typeof s.clampCamera === 'function') s.clampCamera();
            if (state().every((v, i) => v === before[i])) break;
          }
          return { afterControls, afterClamp, afterSettle: s.camera.position.toArray(), settle, settled: settle < maxSettle };
        },
        { position: pose.position, target: pose.target, clock: CLOCK, maxSettle: MAX_SETTLE },
      );
      if (!placed.settled) {
        // Not a page error, so nothing else here would catch it, and it is the exact condition that made
        // pose 7 unreviewable. Said out loud rather than left in the bytes.
        console.warn(
          `WARNING: ${pose.name} did not reach a fixed point of (controls.update, clampCamera) in `
          + `${MAX_SETTLE} iterations, so the frame the compositor happens to catch is not reproducible `
          + 'and this pose\'s digest cannot be quoted in a review. See the settle block in tools/views.js.',
        );
      }
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
      // Four corrections, reported apart: the controls' own limits (polar angle, distance), the frame
      // loop's clamp (the floor, the street corridor, the roof zone), the settle that runs the two of them
      // against each other until they agree, and anything the two rendered frames then did on top of all
      // three. The last one is measured from the SETTLED position, not from the clamp: measuring it from
      // the clamp reported the settle's own movement as drift, which is how this line read on the run that
      // introduced the settle.
      const notes = [];
      if (differs(pose.position, placed.afterControls)) notes.push('controls limit');
      if (differs(placed.afterControls, placed.afterClamp)) notes.push('frame clamp');
      // How many (update, clamp) pairs actually MOVED the camera. Zero is the floor and the normal case:
      // the loop always applies one more pair than it counts, and that last one is what proves the pose
      // does not move. So any number here is a pose the clamp and the controls argued about, and used to
      // be rendered at whichever of those intermediate states the compositor happened to catch.
      if (placed.settle > 0) notes.push(`${placed.settle} settle pairs`);
      if (differs(placed.afterSettle, shot.position)) notes.push('drift over the two rendered frames');
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
    // 792 s on the scene page and print nothing while they do it. `openInspector` in lib/browser.js is
    // where that page is made now, so there is one of it; it also watches this page for errors, which a
    // page opened by hand here did not.
    const inspector = await openInspector(browser, errors);
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
    // Same tree at the end as at the beginning, or these seven frames are not one sweep of one scene and
    // the hash below would name a tree that only half of them came from. A warning rather than a throw:
    // this tool fails only on a page error, and the honest thing is to write the frames and say loudly
    // that they are a mixture.
    const treeAtEnd = sourceTree();
    const treeMoved = treeAtEnd.hash !== treeAtStart.hash;
    if (treeMoved) {
      console.warn(
        `WARNING: the scene source changed while this sweep was being rendered — ${shortHash(treeAtStart.hash)} `
        + `at the first pose, ${shortHash(treeAtEnd.hash)} at the last. These frames are a mixture of two trees, `
        + `so the sweep digest binds to neither: ${diffTrees(treeAtStart, treeAtEnd, 'the first pose', 'the last').join('; ')}. `
        + 'Re-run npm run views on a tree that is holding still.',
      );
    }
    const manifest = [
      `# npm run views — sweep ${sweepDigest}`,
      `# ${new Date().toISOString()}; renderer: ${rendererTag(info.renderer, gpu)}; clock pinned at t = ${CLOCK}; ${L.SHOT.width}x${L.SHOT.height}`,
      `# scene source tree ${treeAtEnd.hash} over ${treeAtEnd.count} files (index.html + src/**)`
      + `${treeMoved ? ` -- MIXTURE: it was ${treeAtStart.hash} at the first pose, so these frames are not one tree` : ''}`,
      '# That line is the binding. `out/views/1-photo.png` was byte-identical to `out/render.png` until',
      '# 2026-09-15, which is how a sweep used to be tied to the score; since the GPU move views renders on',
      '# the GPU and shot on SwiftShader by design, so the two differ whatever the tree is. What ties them',
      '# instead, since 2026-09-16, is this hash against the one shot records in out/render.tree.json.',
      '# `npm run treecheck` compares them and fails when a sweep and a score are being quoted as if they',
      '# were the same tree and are not.',
      '# Every pose below is a fixed point of the frame loop\'s own (controls.update, clampCamera) pair, so',
      '# two runs of an unchanged tree on the same renderer produce the same digests. Before 2026-09-16',
      '# pose 7 was not, and its digest moved run to run.',
      ...treeAtEnd.files.map((f) => `#   ${f.path.padEnd(24)} ${f.sha256.slice(0, 16)}`),
      '# The digests below belong to THAT RENDERER: the same tree renders different frames on a GPU and on',
      '# SwiftShader, so a digest from one never matches the other, and a review quoting one is a review of',
      '# that one sweep. Every digest quoted in a review before 2026-09-15 came from SwiftShader.',
      '# Review each frame at its own resolution and quote the sweep digest above, or a frame\'s own sha256;',
      '# re-running this tool replaces the bytes and strands that review rather than letting it inherit new',
      '# pixels. The sweep digest is over the seven frame digests, so it moves when any frame moves and is',
      '# the only line here that does not change between two runs of an unchanged tree.',
      // A pose that never reached a fixed point is marked HERE and not only warned about on stdout. The
      // warning scrolls past; the manifest is what a review quotes, and a digest that will not come back
      // has to say so beside itself. This is the same hole the MIXTURE marker closes one level up, and it
      // was left open in the first version of this work until an independent critic named it.
      ...rendered.map((r) => `${r.name.padEnd(26)} ${r.digest}  luma ${r.meanLuma.toFixed(1).padStart(5)}  eye ${r.position.map((v) => v.toFixed(2)).join(', ')}  ${resolve(r.file)}`
        + (r.settled === false ? `  -- NOT A FIXED POINT after ${MAX_SETTLE} (update, clamp) pairs: this digest is not reproducible and must not be quoted` : '')),
    ].join('\n');
    writeFileSync(`${outDir}/index.txt`, `${manifest}\n`);
    if (!quiet) console.log(`\nwrote ${rendered.length} views to ${outDir}/ at ${L.SHOT.width}x${L.SHOT.height}, sweep digest ${sweepDigest}, from scene source tree ${shortHash(treeAtEnd.hash)} over ${treeAtEnd.count} files, listed in ${outDir}/index.txt:`);
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

if (isMainModule(import.meta.url)) {
  const { errors, failure } = await renderViews();
  if (errors.length) {
    console.error(`FAIL: ${errors.length} page error(s):`);
    for (const e of errors) console.error(`  ${e}`);
  }
  if (failure) console.error(`FAIL: ${failure.message}`);
  if (errors.length || failure) process.exit(1);
}
