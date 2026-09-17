// npm run compare: score the active scene's render against its reference photo and write its sheets.
// `SCENE=<id>` names the scene; unset is scene 1, which scores out/render.png against japan.webp.
//
// Prints two scores (see tools/lib/metrics.js for their bounds):
//   cell color distance  mean over a 24x22 grid of the per-cell mean-color distance, 0..1, lower is better
//   ssim                 grayscale SSIM at 64 px wide, -1..1, higher is better
// Writes the active scene's out/compare.png  photo | render | 50% overlay | heat-map, four panels the
//                         size of its reference photo, side by side
//                         out/overlay.png  render at 50% over the photo at the scene's shot size with a
//                         0.1 grid and the plan's landmark boxes, for checking each landmark's position
//                         out/scores.json  the scores plus the per-cell distances, read by npm test
// Those three, the render and its sidecar are all the scene's own; for scene 1 they are the out/ paths
// above, which is what this tool wrote before it knew about scenes.
//
// ---- RENDERER ---------------------------------------------------------------------------------------
// SWIFTSHADER, AND IT TAKES NO GPU SWITCH EITHER, for a reason that is NOT the one `shot` has. This tool
// never opens the scene page and renders no 3D at all; what it does is DECODE two files and RESAMPLE them
// to 600x550 through chromium's 2D canvas, and the two scored numbers are computed from those resampled
// bytes. Give chromium a GPU and the 2D canvas can be accelerated, so the resample -- and with it the
// last digits of the score -- becomes a property of the graphics driver. The scored numbers must not
// move for that reason, so the decode browser stays on the CPU path, permanently and without a lever.
//
// ---- WHAT THE PROVENANCE CHECKS COVER, AND WHAT THEY DO NOT ----------------------------------------
// Since 2026-09-16 this tool refuses four things, not one: a render older than any source file (the
// mtime rule), a missing `out/render.tree.json`, a sidecar whose recorded render digest is not the
// `out/render.png` on disk, and a recorded scene source tree that is not the tree on disk. Together they
// bind the score to a named scene, which is what replaced `out/views/1-photo.png` being byte-identical
// to `out/render.png` (tools/lib/treehash.js says why that went).
//
// Since 2026-09-17 it refuses four more GROUPS, all of them about WHAT THE FRAME WAS DRAWN WITH rather
// than which tree it came from: a sidecar with no post-chain state or no verdict inside it; one whose
// rung src/post.js does not mark as the chain as designed; a sidecar with no environment state, or one of
// a shape this tool does not know; and one whose environment map src/lighting.js could not prove or had
// to build twice. The first pair and the second pair cover the two
// halves of the same day's finding -- a frame drawn by a lesser post chain, and a frame drawn without the
// light the scene is supposed to have -- and the second pair is the one aimed at the flake itself.
//
// **The reference photo is half of what this tool scores and is bound by NONE of them.** It is not in the
// mtime list below — `['index.html', ...readdirSync('src')]` — and `sourceTree()` excludes it deliberately,
// so a changed reference photo moves every score with no guard anywhere in this repo. That is the largest
// hole in the score's provenance and it is named here rather than left to be discovered. (The mtime list
// is also non-recursive while the tree hash is recursive, so a scene added in a subdirectory of `src/` is
// invisible to the mtime rule and caught by the hash.)
//
// Measured rather than assumed, on 2026-09-15: the same three files decoded by the same `decodeImage`
// call in a software-launched browser and in a `--use-angle=d3d11 --enable-gpu-rasterization` one come
// back byte-identical, and the scores off them are equal to eight decimals (out/scratch/
// decode-renderer.mjs, recorded in docs/devlog/detailed/2026-09-15-gpu-gates.md). So the risk did not
// materialise on THIS driver -- which is exactly why the lever is absent rather than defaulted: the
// measurement covers one machine and the contract covers every machine.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { launch } from './lib/browser.js';
import { decodeImage, fileToDataUrl, pngDataUrlToBuffer } from './lib/image.js';
import { cellDistance, ssimGray } from './lib/metrics.js';
import { LANDMARK_MARKS } from '../src/layout.js';
import { sourceTree, shortHash, diffTrees, SOURCE_PATHS } from './lib/treehash.js';
import { isMainModule } from './serve.js';
// An import must never start a gate. Everything below runs only when node was asked to run THIS file;
// `node -e "import('./tools/x.js')"` loads it and does nothing. The block is not re-indented so that
// the diff that added it is three lines rather than the whole tool. Proved inert, per tool, by
// out/scratch/import-inert.mjs; the bound is in docs/learning/gate-proofs.md.
if (isMainModule(import.meta.url)) {

// Which scene this run is for, and its photo and paths. A dynamic import inside the guard, so
// `node -e "import('./tools/compare.js')"` does not even load the registry, and so a mistyped SCENE
// prints one FAIL line naming the ids that exist instead of a stack trace out of this module's imports.
let active;
try {
  active = await import('./lib/scene.js');
} catch (err) {
  console.error(`FAIL: ${err.message}`);
  process.exit(1);
}
const { scene, isDefaultScene, renderPath: RENDER_PATH, treePath: RENDER_TREE_PATH, scoresPath: SCORES_PATH, comparePath: COMPARE_PATH, overlayPath: OVERLAY_PATH, lightAnchorPath: ANCHOR_PATH, sourcePaths: SCENE_SOURCE_PATHS } = active;
const PHOTO_PATH = scene.photo;
const COLS = 24;
const ROWS = 22;
// The photo's own size: both images are decoded and resampled to it, so it is the resolution the two
// scores are read at. For scene 1 that is 600x550, which is what this line did before it asked the scene.
const W = scene.photoSize.width;
const H = scene.photoSize.height;

function meansToHex(means) {
  const out = [];
  for (let i = 0; i < means.length; i += 3) {
    out.push('#' + [means[i], means[i + 1], means[i + 2]].map((c) => Math.round(c).toString(16).padStart(2, '0')).join(''));
  }
  return out;
}

if (!existsSync(RENDER_PATH)) {
  console.error(`FAIL: ${RENDER_PATH} is missing; run npm run shot first`);
  process.exit(1);
}

// A score is a claim about the current scene: refuse a render older than any source file, so a failed
// or skipped shot can never be scored as if it had succeeded. THIS SCENE'S source files, enumerated by the
// same walk that hashes them (the registry entry names the paths), rather than `readdirSync('src')`: that
// list was non-recursive and so was already blind to a scene in a subdirectory, while this one names the
// files this scene actually loads. It hashes the tree an extra time to get them, which is a filesystem walk
// and no browser. `japan.webp` is still outside it -- the header says what that costs.
const sources = (SCENE_SOURCE_PATHS ? sourceTree({ paths: SCENE_SOURCE_PATHS }) : sourceTree()).files.map((f) => f.path);
const newest = sources.map((f) => ({ f, mtime: statSync(f).mtimeMs })).sort((a, b) => b.mtime - a.mtime)[0];
const renderMtime = statSync(RENDER_PATH).mtimeMs;
if (renderMtime < newest.mtime) {
  const age = ((newest.mtime - renderMtime) / 1000).toFixed(1);
  console.error(`FAIL: ${RENDER_PATH} is ${age} s older than ${newest.f}; run npm run shot so the score is of the current scene`);
  process.exit(1);
}

// And the same claim made by CONTENT rather than by clock. The mtime rule above catches a source edited
// after the render; it does not catch a source reverted to an older copy, a checkout that rewrote mtimes,
// or a render carried in from another tree. `shot` records the tree it rendered from beside the render,
// so this can check the render really is of the tree being scored — and it is the record `treecheck`
// compares against a views sweep. See tools/lib/treehash.js.
if (!existsSync(RENDER_TREE_PATH)) {
  console.error(
    `FAIL: ${RENDER_TREE_PATH} is missing, so there is no record of which scene source ${RENDER_PATH} was `
    + 'rendered from and this score cannot be bound to a tree. npm run shot writes it beside the render; '
    + 'a render from before 2026-09-16 has none. Run npm run shot again.',
  );
  process.exit(1);
}
let recorded;
try {
  recorded = JSON.parse(readFileSync(RENDER_TREE_PATH, 'utf8'));
} catch (err) {
  // A raw JSON stack trace here would name the file and nothing else. This is a gate's failure surface.
  console.error(
    `FAIL: ${RENDER_TREE_PATH} could not be read as JSON (${err.message}), so the tree ${RENDER_PATH} was `
    + 'rendered from is unknown and this score cannot be bound to a scene. It is written whole by '
    + 'npm run shot; a truncated one means that run was interrupted. Run npm run shot again.',
  );
  process.exit(1);
}
if (!recorded.sourceTree) {
  console.error(
    `FAIL: ${RENDER_TREE_PATH} carries no scene source tree, so there is no record of which scene `
    + `${RENDER_PATH} was rendered from and this score cannot be bound to one. npm run shot writes that `
    + 'field; a sidecar without it was written by an older tool or by a run that was interrupted. Run '
    + 'npm run shot again.',
  );
  process.exit(1);
}
const renderSha = createHash('sha256').update(readFileSync(RENDER_PATH)).digest('hex');
if (recorded.renderSha256 !== renderSha) {
  console.error(
    `FAIL: ${RENDER_TREE_PATH} describes a render with sha256 ${shortHash(recorded.renderSha256)} and `
    + `${RENDER_PATH} is ${shortHash(renderSha)}, so the tree record belongs to a different frame than the `
    + 'one about to be scored. Run npm run shot, which writes both together.',
  );
  process.exit(1);
}
// And the same claim made about the POST CHAIN. The three checks above bind the score to a scene; this
// one binds it to the configuration that scene was drawn with. `docs/PLAN-scores.md` records what the
// FULL chain scores -- rung 0, the 1.2 supersample, every multisample the driver gives -- and a frame
// drawn at a lesser rung scores differently while looking, in every other field of this sidecar, exactly
// like the contract. `shot` refuses to leave such a frame on disk; this refuses to score one that
// reached the disk another way, which is the case a sidecar carried in from another machine or written
// by an older tool.
//
// Bound: this reads a NUMBER THE PAGE REPORTED about itself, so it proves the chain said it was at the
// top rung and never that the frame is right. It is also blind to the flake it was written for: the
// 2026-09-17 frame was drawn at rung 0 (docs/devlog/detailed/2026-09-17-shot-rung.md). The verdict
// numbers that DO separate that frame travel in the sidecar and are copied into out/scores.json below,
// where a later run can compare them; nothing asserts them, because the light in this scene moves every
// iteration and a pinned figure here would be one an iteration lane has to raise.
// `verdict` is checked here and not where it is first read, so a sidecar that carries a `post` without
// one fails with a sentence instead of a TypeError three hundred lines further down.
if (!recorded.post || !recorded.post.verdict) {
  console.error(
    `FAIL: ${RENDER_TREE_PATH} carries no ${recorded.post ? 'post-chain verdict' : 'post-chain state'}, so `
    + `there is no record of the configuration ${RENDER_PATH} was drawn at and this score cannot be bound `
    + 'to one. npm run shot writes that field from window.__scene.describe().post; a sidecar without it '
    + 'was written by a tool from before 2026-09-17, by a run that was interrupted, or by hand. Run '
    + 'npm run shot again.',
  );
  process.exit(1);
}
if (recorded.post.rung !== 0 || recorded.post.fallback || recorded.post.designed !== true) {
  console.error(
    `FAIL: ${RENDER_PATH} was drawn at post-chain rung ${recorded.post.rung} (${recorded.post.cost}), a `
    + `${recorded.post.width}x${recorded.post.height} target at scale ${recorded.post.scale} with `
    + `${recorded.post.samples} samples${recorded.post.designed === true ? '' : ', which src/post.js does not mark as the chain as designed'}`
    + ', and the thresholds in docs/PLAN-scores.md are the FULL chain\'s. Scoring this frame would compare '
    + 'a lesser configuration against numbers it cannot make. The step-down means the top rung did not '
    + 'survive on this driver at this size; src/post.js prints what it measured. Run npm run shot, which '
    + 'refuses to leave such a frame on disk.',
  );
  process.exit(1);
}
// ---- AND THE FRAME MUST HAVE GOT THE LIGHT THE SCENE IS SUPPOSED TO HAVE -----------------------------
// The half of the 2026-09-17 class the rung refusal above states it cannot see. `src/lighting.js` builds
// the sky's environment map, proves it carries light and reaches the materials, and reports what it
// measured; `npm run shot` refuses a frame that fails that proof and records the numbers here. This
// refuses a sidecar that reached the disk another way -- carried in from another machine, or written by a
// tool from before this existed -- exactly as the rung refusal does.
//
// Bounds, the same two the rung refusal has and one more: it reads numbers the page reported about
// itself; it proves the map carries light and not that the map is RIGHT; and `builds` and the map's own
// radiance were measured when the rig was built, so a map that went black afterwards is not in them.
//
// ONE SCENE IS REQUIRED TO CARRY THIS, not every scene, for the reason `tools/shot.js` states at its own
// `checkEnvState`: the proof lives in `src/lighting.js`, which is scene 1's rig, and a second scene has
// its own rig and its own `describe()`. Demanding it of every scene made `SCENE=whitehouse npm test` an
// unconditional red, which an independent review caught before it shipped. A scene that HAS a block is
// checked whatever scene it is.
//
// Every field the messages below read is required here, not just `contribution`: a sidecar carrying a
// `contribution` and no `map` would otherwise reach the summary print and throw a bare TypeError. That is
// the same shape a review caught on `recorded.post.verdict`, and it was still here after that fix.
const ENV_FIELDS = ['map', 'shape', 'contribution', 'binding'];
const envMissing = recorded.env ? ENV_FIELDS.filter((f) => !recorded.env[f]) : null;
if (isDefaultScene && !recorded.env) {
  console.error(
    `FAIL: ${RENDER_TREE_PATH} carries no environment state, so there is no record of the light `
    + `${RENDER_PATH} was drawn with. That is exactly the gap the 2026-09-17 flake fell through: the `
    + 'scored frame was 6.5% dark on every lit surface and not one number about the light existed to say '
    + 'so. npm run shot writes this field from window.__scene.describe().env; a sidecar without it was '
    + 'written by a tool from before 2026-09-17, by an interrupted run, or by hand. Run npm run shot again.',
  );
  process.exit(1);
}
if (recorded.env && (envMissing.length || typeof recorded.env.builds !== 'number')) {
  console.error(
    `FAIL: ${RENDER_TREE_PATH} carries an environment state this tool does not know the shape of: it is `
    + `missing ${[...envMissing, ...(typeof recorded.env.builds === 'number' ? [] : ['builds'])].join(', ')}. `
    + 'npm run shot writes the whole block out of window.__scene.describe().env, so a partial one was '
    + 'written by hand or by an older tool. Run npm run shot again.',
  );
  process.exit(1);
}
if (recorded.env && (recorded.env.ok !== true || recorded.env.builds > 1)) {
  // Two different faults, and the reasons say which happened. A message that blamed a dark frame for a
  // rebuild that then worked would send a reader looking for something that is not there.
  // `why` is read defensively: a hand-edited sidecar that drops it must produce a sentence, not a bare
  // TypeError out of this line. A review caught the same shape on `recorded.post.verdict` on 2026-09-17.
  const why = [];
  if (recorded.env.ok !== true) {
    why.push(...(Array.isArray(recorded.env.why) && recorded.env.why.length
      ? recorded.env.why
      : ['the sidecar records the proof as not passing and carries no reason, which npm run shot never writes']));
  }
  if (recorded.env.builds > 1) {
    why.push(
      `the map had to be built ${recorded.env.builds} times before it carried light, so the first build of `
      + 'it on that run was black or the wrong shape -- which is the unexplained 2026-09-17 flake happening '
      + 'on the machine that drew this frame, whatever the frame itself looks like',
    );
  }
  console.error(
    `FAIL: ${RENDER_PATH} was drawn with an environment map this repo cannot accept for the contract:\n`
    + `  ${why.join('\n  ')}\n`
    + `  It measured mean luma ${recorded.env.map?.meanLuma} in the map itself and a contribution of `
    + `${recorded.env.contribution.delta} of a luma level to the photo view, against a floor of `
    + `${recorded.env.floor}. The thresholds in docs/PLAN-scores.md are the fully lit scene's: the frame `
    + 'this scene draws without that map scored 0.0632 against 0.05958 on 2026-09-17, which fails them. '
    + 'Run npm run shot, which refuses to leave such a frame on disk.',
  );
  process.exit(1);
}
const treeNow = sourceTree({ paths: SCENE_SOURCE_PATHS ?? SOURCE_PATHS });
if (recorded.sourceTree !== treeNow.hash) {
  const changed = diffTrees({ files: recorded.sourceFiles }, treeNow, 'the render', 'the tree on disk');
  console.error(
    `FAIL: ${RENDER_PATH} was rendered from scene source ${shortHash(recorded.sourceTree)} and the tree on `
    + `disk is ${shortHash(treeNow.hash)}, so this score would be of a scene that no longer exists.\n`
    + `  ${changed.join('\n  ')}\n`
    + '  Run npm run shot so the render and the score come from one tree.',
  );
  process.exit(1);
}

// ---- AND THE SAME TREE MUST DRAW THE SAME AMOUNT OF LIGHT -------------------------------------------
// This is the one check here aimed at the 2026-09-17 flake itself rather than at its neighbour. That run
// drew a frame every lit surface of which was about 6.5% darker than the three other runs of the same
// tree, at the same rung, the same size and the same sample count, and the score went 0.05958 -> 0.0632.
// What separates the two is `verifyComposer`'s own reference render: the scene at 64x64 with no post
// chain at all, at a clock pinned to 0 because the composer is built before the frame loop starts. It
// read 57.5 in every good run and would have read 54.6 in that one (measured by removing
// `scene.environment` from the same scene, out/scratch/reflight.mjs).
//
// So: if the last scored run was of THIS tree, its reference luma is the anchor, and a run of the same
// tree that disagrees is red. No figure is pinned anywhere — the anchor is whatever the previous run of
// the same source measured, so an iteration lane that changes the scene changes the tree and resets it,
// and nothing here has to be maintained.
//
// THE ANCHOR IS ITS OWN FILE, and that is not tidiness. Putting it in `out/scores.json` wedges the gate:
// a flaked run with no anchor passes and writes ITS figure, then every correct run after it is red
// against that stale figure and `process.exit(1)` happens before a new score is written, so the anchor
// never moves and only a human deleting the file clears it. One flake would red every later run, and the
// red would always land on the good one. `out/light-anchor.json` is written on the way past whatever the
// verdict is, so a disagreement is reported ONCE, against the run before it, and the next run compares
// against this one. (Found by an independent review, 2026-09-17, before it could happen to anyone.)
//
// BOUNDS, and they are large enough to state plainly:
//   - It needs a previous anchor OF THE SAME TREE. A fresh clone has none and CI never has one, so on CI
//     this check NEVER RUNS. Which case this run took is printed, because a check that cannot tell
//     "passed" from "did not run" reports the second as the first.
//   - It would NOT have caught the 2026-09-17 flake, which was the first `npm test` on a freshly merged
//     main: the previous score was of a different tree, so there would have been no anchor. It catches
//     the second and later run of a tree, which is every repeat of that flake.
//   - It says the two runs disagree; it cannot say which of them is right. The message says so.
//   - The tolerance is 0.15 of a luma level. The measured run-to-run jitter of this figure on the shot
//     path is ZERO -- 57.5 in all 54 logged `npm run shot` runs that recorded it, across three loops on
//     this machine, because `shot` never re-tunes and the composer is built before the clock starts, and
//     the other two runs of the 56 were refused before they wrote one -- so the only floor is the one decimal
//     the figure is rounded to. 0.15 is that plus a hair, and a twentieth of the 2.9 the defect moved.
//     A wider limit here would be slack nobody can red-prove.
//   - It is blind to a change that moves no light: a geometry shift, a colour swap that keeps the mean.
const LIGHT_TOLERANCE = 0.15;
// ANCHOR_PATH is the active scene's own (out/light-anchor.json for scene 1, named at the top of this file).
let anchor = null;
if (existsSync(ANCHOR_PATH)) {
  try {
    const previous = JSON.parse(readFileSync(ANCHOR_PATH, 'utf8'));
    if (previous && previous.sourceTree === recorded.sourceTree && typeof previous.referenceLuma === 'number') {
      anchor = previous;
    }
  } catch {
    anchor = null; // a truncated anchor is not evidence about anything; the "did not run" line says so.
  }
}
// Written before the comparison decides anything, so a disagreement cannot repeat against a stale figure.
mkdirSync(scene.out, { recursive: true });
writeFileSync(ANCHOR_PATH, `${JSON.stringify({
  sourceTree: recorded.sourceTree,
  renderSha256: recorded.renderSha256,
  referenceLuma: recorded.post.verdict.referenceLuma,
  meanLuma: recorded.post.verdict.meanLuma,
  wroteAt: new Date().toISOString(),
}, null, 1)}\n`);
if (!anchor) {
  console.log(
    `no previous ${ANCHOR_PATH} for scene source tree ${shortHash(recorded.sourceTree)}, so the same-tree `
    + 'light check did not run this time; this run is now the anchor for the next one',
  );
} else {
  const drift = Math.abs(anchor.referenceLuma - recorded.post.verdict.referenceLuma);
  if (drift > LIGHT_TOLERANCE) {
    console.error(
      `FAIL: two runs of scene source tree ${shortHash(recorded.sourceTree)} disagree about how much light `
      + 'is in the scene. The previous run of this tree measured a plain-render reference luma of '
      + `${anchor.referenceLuma} (chain ${anchor.meanLuma}); this render measured `
      + `${recorded.post.verdict.referenceLuma} (chain ${recorded.post.verdict.meanLuma}), a difference of `
      + `${drift.toFixed(1)} against a tolerance of ${LIGHT_TOLERANCE}. That figure is src/post.js's own `
      + '64x64 render of the scene with no post chain and the clock at 0, so the same source must give the '
      + 'same number: the scene was lit differently in one of these two runs and the scored frame moves '
      + 'with it (2026-09-17: 0.05958 -> 0.0632 for 2.9 of this figure). Which of the two is right is NOT '
      + `established by this check, and ${ANCHOR_PATH} has already been moved to THIS run's figure, so the `
      + 'anchor follows the last run instead of sticking. Note that one flaked run therefore produces TWO '
      + 'reds and the second lands on a correct render: the flake reds against the run before it, and the '
      + 'next correct run reds against the flake. The third run is green. Run npm run shot twice more and '
      + 'see which number comes back twice; '
      + 'docs/devlog/detailed/2026-09-17-shot-rung.md says how that flake was taken apart.',
    );
    process.exit(1);
  }
  console.log(
    `same-tree light check: reference luma ${recorded.post.verdict.referenceLuma} against the previous run `
    + `of tree ${shortHash(recorded.sourceTree)} at ${anchor.referenceLuma} (tolerance ${LIGHT_TOLERANCE})`,
  );
}

const browser = await launch();
let failure = null;
try {
  const page = await browser.newPage();
  const photo = await decodeImage(page, PHOTO_PATH, { width: W, height: H });
  const render = await decodeImage(page, RENDER_PATH, { width: W, height: H });
  if (photo.srcWidth !== W || photo.srcHeight !== H) throw new Error(`${PHOTO_PATH} is ${photo.srcWidth}x${photo.srcHeight}, expected ${W}x${H}`);
  if (render.srcWidth !== scene.shot.width || render.srcHeight !== scene.shot.height) {
    throw new Error(`${RENDER_PATH} is ${render.srcWidth}x${render.srcHeight}, expected ${scene.shot.width}x${scene.shot.height}`);
  }

  const cells = cellDistance(photo.data, render.data, W, H, COLS, ROWS);
  const ssim = ssimGray(photo.data, render.data, W, H, 64);

  const sheets = await page.evaluate(
    async ({ photoUrl, renderUrl, W, H, cols, rows, cellValues, marks, shotW, shotH }) => {
      const load = async (url) => createImageBitmap(await (await fetch(url)).blob());
      const photoBmp = await load(photoUrl);
      const renderBmp = await load(renderUrl);

      // compare.png: photo | render | overlay | heat-map
      const sheet = document.createElement('canvas');
      sheet.width = W * 4;
      sheet.height = H;
      const ctx = sheet.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(photoBmp, 0, 0, W, H);
      ctx.drawImage(renderBmp, W, 0, W, H);
      ctx.drawImage(photoBmp, W * 2, 0, W, H);
      ctx.globalAlpha = 0.5;
      ctx.drawImage(renderBmp, W * 2, 0, W, H);
      ctx.globalAlpha = 1;
      const stops = [
        [0.0, [16, 16, 48]],
        [0.1, [40, 60, 160]],
        [0.2, [180, 40, 90]],
        [0.32, [240, 140, 40]],
        [0.45, [255, 240, 120]],
        [0.6, [255, 255, 255]],
      ];
      const colormap = (d) => {
        for (let i = 1; i < stops.length; i++) {
          if (d <= stops[i][0]) {
            const t = (d - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
            const a = stops[i - 1][1];
            const b = stops[i][1];
            return `rgb(${a.map((c, k) => Math.round(c + (b[k] - c) * t)).join(',')})`;
          }
        }
        return 'rgb(255,255,255)';
      };
      const cw = W / cols;
      const ch = H / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillStyle = colormap(cellValues[r * cols + c]);
          ctx.fillRect(W * 3 + Math.floor(c * cw), Math.floor(r * ch), Math.ceil(cw), Math.ceil(ch));
        }
      }

      // overlay.png: render at 50% over the photo at shot size, with a grid and the landmark marks.
      const ov = document.createElement('canvas');
      ov.width = shotW;
      ov.height = shotH;
      const o = ov.getContext('2d');
      o.imageSmoothingEnabled = true;
      o.imageSmoothingQuality = 'high';
      o.drawImage(photoBmp, 0, 0, shotW, shotH);
      o.globalAlpha = 0.5;
      o.drawImage(renderBmp, 0, 0, shotW, shotH);
      o.globalAlpha = 1;
      o.font = '14px sans-serif';
      o.lineWidth = 1;
      for (let i = 1; i < 10; i++) {
        o.strokeStyle = 'rgba(255,255,255,0.35)';
        o.beginPath();
        o.moveTo((i / 10) * shotW, 0);
        o.lineTo((i / 10) * shotW, shotH);
        o.moveTo(0, (i / 10) * shotH);
        o.lineTo(shotW, (i / 10) * shotH);
        o.stroke();
        o.fillStyle = 'rgba(255,255,255,0.9)';
        o.fillText(`${i / 10}`, (i / 10) * shotW + 3, 14);
        o.fillText(`${i / 10}`, 3, (i / 10) * shotH - 3);
      }
      const X = (u) => u * shotW;
      const Y = (v) => v * shotH;
      o.lineWidth = 2;
      for (const m of marks) {
        o.strokeStyle = 'rgba(255,230,0,0.95)';
        o.fillStyle = 'rgba(255,230,0,0.95)';
        if (m.kind === 'box') {
          o.strokeRect(X(m.u0), Y(m.v0), X(m.u1) - X(m.u0), Y(m.v1) - Y(m.v0));
          o.fillText(m.name, X(m.u0) + 4, Y(m.v0) + 16);
        } else if (m.kind === 'point') {
          o.beginPath();
          o.arc(X(m.u), Y(m.v), 6, 0, Math.PI * 2);
          o.stroke();
          o.fillText(m.name, X(m.u) + 9, Y(m.v) + 5);
        } else if (m.kind === 'hline') {
          o.strokeStyle = 'rgba(0,255,255,0.95)';
          o.fillStyle = 'rgba(0,255,255,0.95)';
          o.beginPath();
          o.moveTo(0, Y(m.v));
          o.lineTo(shotW, Y(m.v));
          o.stroke();
          o.fillText(m.name, shotW - 70, Y(m.v) - 4);
        } else if (m.kind === 'vline') {
          o.beginPath();
          o.moveTo(X(m.u), Y(m.v0));
          o.lineTo(X(m.u), Y(m.v1));
          o.stroke();
          o.fillText(m.name, X(m.u) + 6, Y(m.v0) + 14);
        } else if (m.kind === 'polyline') {
          o.strokeStyle = 'rgba(0,255,255,0.95)';
          o.fillStyle = 'rgba(0,255,255,0.95)';
          o.beginPath();
          m.points.forEach(([u, v], i) => (i ? o.lineTo(X(u), Y(v)) : o.moveTo(X(u), Y(v))));
          o.stroke();
          o.fillText(m.name, X(m.points[0][0]) + 6, Y(m.points[0][1]) + 16);
        }
      }
      return { compare: sheet.toDataURL('image/png'), overlay: ov.toDataURL('image/png') };
    },
    {
      photoUrl: fileToDataUrl(PHOTO_PATH),
      renderUrl: fileToDataUrl(RENDER_PATH),
      W,
      H,
      cols: COLS,
      rows: ROWS,
      cellValues: Array.from(cells.cells),
      // The landmark marks are SCENE 1's, imported from src/layout.js, and they are the one thing in this
      // tool that is still scene 1 by construction: an overlay drawn for another scene carries scene 1's
      // boxes and names. They are annotation only -- they move no score -- and the registry has no field
      // for another scene's list yet. Named here so the next scene's overlay is not read as its own.
      marks: LANDMARK_MARKS,
      shotW: scene.shot.width,
      shotH: scene.shot.height,
    },
  );

  mkdirSync(scene.out, { recursive: true });
  writeFileSync(COMPARE_PATH, pngDataUrlToBuffer(sheets.compare));
  writeFileSync(OVERLAY_PATH, pngDataUrlToBuffer(sheets.overlay));
  const scores = {
    cellDistance: cells.mean,
    ssim: ssim.value,
    grid: { cols: COLS, rows: ROWS },
    ssimSize: { width: ssim.width, height: ssim.height },
    cells: Array.from(cells.cells, (d) => Number(d.toFixed(4))),
    cellsPhoto: meansToHex(cells.meansA),
    cellsRender: meansToHex(cells.meansB),
    // Which scene these numbers describe, carried over from the render's own sidecar rather than read
    // again here: the score belongs to the frame, and the frame belongs to that tree.
    sourceTree: recorded.sourceTree,
    sourceFileCount: recorded.sourceFileCount,
    // The per-file list travels with the hash, so `treecheck` can tell a reviewer WHICH file differs
    // between a sweep and a score rather than handing back two hashes. Without it the sweep-to-score
    // pairing — the pairing that tool exists for — could only ever report bare digests.
    sourceFiles: recorded.sourceFiles,
    // And the configuration the frame was drawn at, carried over for the same reason: a score belongs to
    // a frame, and a frame belongs to a post-chain rung and to the light the chain measured making it.
    // Two runs of one tree that score differently are told apart here and nowhere else.
    post: recorded.post,
    // And the light that chain was fed: what src/lighting.js measured of the sky's environment map.
    // Copied for the same reason as `post` -- two runs of one tree that score differently are told apart
    // here and nowhere else, and on 2026-09-17 this was the block that did not exist.
    env: recorded.env,
    renderSha256: renderSha,
    renderedAt: new Date().toISOString(),
  };
  writeFileSync(SCORES_PATH, JSON.stringify(scores, null, 2));
  console.log(`cell color distance (24x22 grid, lower is better): ${cells.mean.toFixed(4)}`);
  console.log(`grayscale SSIM at 64 px (higher is better): ${ssim.value.toFixed(4)}`);
  console.log(`scored ${RENDER_PATH} (sha256 ${shortHash(renderSha)}) from scene source tree ${shortHash(recorded.sourceTree)} over ${recorded.sourceFileCount} files`);
  console.log(
    `drawn at post-chain rung ${recorded.post.rung}, a ${recorded.post.width}x${recorded.post.height} target `
    + `with ${recorded.post.samples} samples; the chain measured mean luma ${recorded.post.verdict.meanLuma} `
    + `against a plain-render reference of ${recorded.post.verdict.referenceLuma}`,
  );
  if (recorded.env) {
    console.log(
      `the sky's environment map carried mean luma ${recorded.env.map.meanLuma} and added `
      + `${recorded.env.contribution.delta} of a luma level to that reference (floor ${recorded.env.floor}), `
      + `with ${recorded.env.binding.mismatched} of ${recorded.env.binding.compiled} lit programs disagreeing `
      + 'about which environment they were compiled for',
    );
  }
  console.log(`wrote ${COMPARE_PATH}, ${OVERLAY_PATH}, ${SCORES_PATH}`);
} catch (err) {
  failure = err;
} finally {
  await browser.close();
}
if (failure) {
  console.error(`FAIL: ${failure.message}`);
  process.exit(1);
}

}
