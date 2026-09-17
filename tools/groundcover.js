// Ground cover gate (run by npm test): is there ground under every downward ray over the world this scene
// builds?
//
// ---- CLAIM ------------------------------------------------------------------------------------------
// Over the box x +-640 m, z +-900 m, a ray dropped from 400 m straight down meets something other than the
// sky in EVERY cell. A cell whose only hit is the sky dome is a VOID -- the frame shows a hole with the sky
// behind it -- and no scored gate in this repo can see one.
//
// ---- ORIGIN, and why no score can stand in for this ------------------------------------------------
// Two voids have been found in this scene by looking at frames the scored view cannot see, and the first is
// why the second is being gated at all.
//
//   * The blue band across the grounds. The north lawn ran from z = 0 northwards and the south lawn began
//     at z = -40.6, so a 40.6 m by 1040 m trench ran the width of the scene with only the building's own
//     51.2 m footprint in it. `out/wh/scratch/whvoid.mjs` -- this gate's own detector, on a 20 m grid --
//     found 718 of 1995 cells with no ground. It is fixed: `src/whitehouse/grounds.js` fills it with the
//     apron between the lawns.
//   * The dark slab-like object floating beside the building's west end, seen from the west orbit and
//     reported as an object. It was the frame's left edge looking PAST the ground's west edge, and the
//     boundary wall's own lit top edge cutting across the hole is what made it read as a fallen beam. It
//     is THIS gate's defect: every ground surface this scene builds stopped at |x| = 520 m
//     (`TERRAIN_HALF`), and outside that rectangle the downward ray fell 2386 m to the sky dome.
//
// The scored frame cannot see either one, and that is the whole reason this file exists. `compare` scores
// 528 mean cell colours and a 64 px grayscale image; sky seen through a hole is just another colour, and
// the scene's own scores file (`docs/work/2_white-house-scene/scores.md`) records the measured version of
// that: the pass that CLOSED the trench moved both scores the right way "for unrelated reasons", because
// the trench lies behind the building from the photo view. A metric can improve while the scene is broken
// somewhere the metric does not look, and that is a class no threshold in this repo can close.
//
// WHAT THIS PASS DID ABOUT THEM. The gate was run first and went red on the real defect -- 4,166 of its
// 5,915 cells, the whole rim of the ground plus everything past its two z ends -- and the fix widens the
// ground to `TERRAIN_HALF` 680, the far ground 850 m deep and the south lawn to z -940.6. The x and north
// widening leaves the scored frame byte-identical (sha256 f1d1475a... on two different scene trees); the
// south one cannot, because the south lawn's far edge is where the frame draws its horizon, so it moves
// 2,185 pixels of that frame and improves both scored numbers (cell 0.09493 -> 0.09490, SSIM 0.42070 ->
// 0.42077). Proofs, with the mutations and the before/after digits, are in docs/learning/gate-proofs.md,
// and the class is recorded in docs/learning/defect-register.md.
//
// ---- RENDERER --------------------------------------------------------------------------------------
// THE GPU, because no pixel enters the verdict. Every cell is one `THREE.Raycaster` hit against the scene
// graph on the CPU -- the same shape as `clearance`'s and `placement`'s checks -- and nothing here looks at
// a frame or takes a screenshot. `openScene` is asked for no settling frames for the same reason: those
// exist to give the compositor a canvas to capture, and this gate captures nothing. `GROUNDCOVER_GPU=0` (or
// `GATES_GPU=0`) forces SwiftShader, which is what CI gets anyway, so CI's verdict is unchanged; the
// summary line names the renderer the run actually got.
//
// ---- HOW IT IS MEASURED ----------------------------------------------------------------------------
// From the BUILT SCENE, never from the constants the scene was built with. `src/whitehouse/grounds.js` is
// not imported and neither is anything else under `src/`: the rays are cast at the meshes three actually
// draws, so a slab that is short, moved, renamed or never added is measured as it is rather than as it was
// written. That matters here for the same reason it does in `clearance` -- the defect and its fix are both
// edits to a constant a source-derived check would have read.
//
// A cell is BLANK when the first thing the ray meets that is not the sky dome is nothing at all. Any other
// mesh counts as cover, and the census of what covered what is printed on every run, so the log says which
// surface holds each cell up rather than only how many cells there were.
//
// ---- BOUND: EXTENT ----------------------------------------------------------------------------------
// A BOX x +-640 m, z +-900 m, CENTRED ON THE BUILDING, AND NEITHER NUMBER IS A TASTE.
//
// X IS +-640 m. The frame's own half-width is `tan(28.41 deg) x (1200/900) = 0.7213` of the distance to
// whatever it is showing (CAMERA.fovDeg is 56.82 on a 4:3 frame), the orbit clamp caps the camera's own
// distance from its target at 260 m (`src/whitehouse/main.js`), and this scene's ground claimed to end at
// |x| = 520. A camera at the clamp's own extreme, showing ground at that 520 m edge, therefore reaches
// 260 + 0.72 x 520 = 634.6 m. 640 is that rounded up, and it is 120 m -- six cells -- past the claim, so
// this gate reads the claim rather than the edge of the fix.
//
// Z IS +-900 m. Along the view axis a ray meets the ground at any distance, so what bounds it is where
// ground stops being ground: `fogFor` in src/whitehouse/lighting.js fogs this scene from 140 m to 900 m,
// and past the far distance the fog is total, so a hole out there and the sky are the same pale blue and
// no camera can show one. The camera's own station is z +47.9 looking south, so the ground the photo view
// can show runs to z -852; +-900 covers that and the mirrored case for a camera orbited to the other side.
// The 640 in x and the 900 in z are different reaches because they answer different questions: 520 is a
// length ACROSS the frame, 900 a length ALONG it.
//
// WHAT THIS BOUND IS NOT. The camera's clamp bounds y and the building's own footprint and nothing else --
// `clampCamera` in src/whitehouse/main.js never reads x or z -- so a user who pans far enough can put the
// camera over ground this box does not contain, and NO finite box covers every camera position. This box
// is the region a camera looking at this scene can see ground in, which is the thing it asserts.
//
// ---- BOUND: RESOLUTION, AND WHAT A RAY CANNOT SEE ---------------------------------------------------
// 20 m in both axes, the grid `out/wh/scratch/whvoid.mjs` uses: 65 x 91 = 5,915 cells. A void NARROWER
// THAN ONE CELL CAN FALL BETWEEN TWO RAYS AND BE MISSED, however visible it is -- at 100 m from the camera
// a 2 m hole subtends 1.1 deg, about 9 px of the 1200x900 frame, and this grid steps past it. The other
// side of the same coin is that a void is not silently reported as its own edge: the blank cells are
// printed in full, row by row and as runs, on every red run.
//
// A void HIDDEN UNDER ANOTHER MESH is not blank by this definition, because the ray stops at the first
// non-sky hit. The building, the framing trees, the hedge and the fence all cover cells this gate then does
// not check for ground beneath, and the census of covering meshes printed each run is what makes that
// auditable rather than silent -- a mesh covering thousands of cells is a mesh a hole could hide under.
//
// The sweep is one clock instant, t = 0. Nothing in the grounds animates, so that costs nothing here; it is
// stated because it is stated everywhere else.
//
// ---- THE FLOORS, and why each one exists ------------------------------------------------------------
// BLANK_MAX is 0 and is the assertion. MIN_CELLS is 5,000 against the 5,915 this grid sweeps: a sweep whose
// grid collapsed -- a step larger than the extent, a sign flipped in a loop bound -- would find no blanks
// at all and report that as a pass, which is the one way this check can lie. The sky dome has a floor of
// its own, because the blank test is written against its name: with no mesh called `sky` in the scene every
// cell would be covered by whatever the dome is called instead, and this gate would report a pass over a
// world it had not looked under.
//
// `isMainModule` comes from serve.js and is never hand-built here: the hand-built form is how four tools
// came to skip their whole main block on every CI run for three days (docs/learning/gate-proofs.md).
import { mkdirSync, writeFileSync } from 'node:fs';
import { isMainModule, startServer } from './serve.js';
import { launch, collectErrors, openScene, rendererTag, wantsGpu, ACTION_TIMEOUT_MS } from './lib/browser.js';
import { scene, sceneUrl } from './lib/scene.js';

// The grid. See BOUND above for where each number comes from; none of them is read out of `src/`.
export const GRID_STEP_M = 20;
export const X_HALF_M = 640;
export const Z_HALF_M = 900;
// How many cells may have no ground under them. Zero: one is a hole to the sky.
export const BLANK_MAX = 0;
// What this grid sweeps, and the floor under it. A run that measured nothing prints the same "0 blank" as
// a run that measured the world, and that is the failure this floor exists to make impossible.
export const MIN_CELLS = 5000;
// Where the rays start. Above everything this scene builds -- the roofline is about 22 m -- and below the
// sky dome's own top, so every ray starts inside the dome and a blank cell means it fell all the way
// through to it.
const RAY_Y = 400;
// The dome's radius is 2,386 m, so the longest possible ray here is about 2,790 m. `far` shorter than that
// would stop the ray in mid-air and read as a blank cell that is not one.
const RAY_FAR = 4000;

export async function measureGroundCover({ quiet = false, gpu = wantsGpu('GROUNDCOVER') } = {}) {
  let server = null;
  let browser = null;
  let errors = [];
  let failure = null;
  let result = null;
  try {
    server = await startServer({ port: 0, quiet: true });
    browser = await launch({ gpu });
    const page = await browser.newPage({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(ACTION_TIMEOUT_MS);
    errors = collectErrors(page);
    // No settling frames: this gate screenshots nothing and no pixel enters its verdict.
    const info = await openScene(page, sceneUrl(server), { settleFrames: 0 });
    if (!quiet) {
      console.log(`renderer: ${rendererTag(info.renderer, gpu)}`);
      // Printed so the log says which scene this verdict is about without a reader having to know what
      // SCENE was set to. The scene list in tools/test.js is what pins the gate to this scene.
      console.log(`scene: ${scene.id}`);
    }
    result = await page.evaluate(measureInPage, { X_HALF_M, Z_HALF_M, GRID_STEP_M, RAY_Y, RAY_FAR });
    result.renderer = rendererTag(info.renderer, gpu);
    result.scene = scene.id;
  } catch (err) {
    failure = err;
  } finally {
    for (const close of [() => browser?.close(), () => server?.close()]) {
      try {
        await close();
      } catch (err) {
        failure ??= err;
      }
    }
  }
  return { result, errors, failure };
}

// Everything below runs inside the page, against the scene three actually built.
function measureInPage({ X_HALF_M, Z_HALF_M, GRID_STEP_M, RAY_Y, RAY_FAR }) {
  const { THREE, scene } = window.__scene;
  // Pinned here rather than in an evaluate of its own: an evaluate on this page waits for the frame in
  // flight, and the scene page is always mid-frame. Same clock, one round-trip fewer.
  window.__scene.setTime(0);
  scene.updateMatrixWorld(true);

  const rc = new THREE.Raycaster();
  rc.far = RAY_FAR;
  const DOWN = new THREE.Vector3(0, -1, 0);
  const from = new THREE.Vector3();

  // The dome, by name, and it is the only mesh that is not cover. Every other mesh -- lawn, apron, far
  // ground, south lawn, and also the building, the trees, the hedge and the fence -- holds a cell up.
  let skyMeshes = 0;
  scene.traverse((o) => { if (o.isMesh && /^sky$/.test(o.name || '')) skyMeshes++; });

  const nx = Math.round((2 * X_HALF_M) / GRID_STEP_M) + 1;
  const nz = Math.round((2 * Z_HALF_M) / GRID_STEP_M) + 1;
  const census = new Map();
  const blanks = [];
  const blankRows = new Map();
  let cells = 0;
  for (let j = 0; j < nz; j++) {
    const z = -Z_HALF_M + j * GRID_STEP_M;
    for (let i = 0; i < nx; i++) {
      const x = -X_HALF_M + i * GRID_STEP_M;
      cells++;
      from.set(x, RAY_Y, z);
      rc.set(from, DOWN);
      const hits = rc.intersectObject(scene, true);
      let cover = null;
      // Hits come back sorted by distance, so the first one that is not the dome is what holds this cell
      // up. The dome is skipped rather than excluded from the ray, because a ray that reaches it is the
      // measurement: it is how a blank cell is told apart from a cell the ray never got to.
      for (const h of hits) {
        if (!h.object.visible) continue;
        if (/^sky$/.test(h.object.name || '')) continue;
        cover = h.object.name || '(unnamed)';
        break;
      }
      if (cover === null) {
        blanks.push([x, z]);
        const row = blankRows.get(z) ?? [];
        row.push(x);
        blankRows.set(z, row);
      } else {
        census.set(cover, (census.get(cover) ?? 0) + 1);
      }
    }
  }
  return {
    xHalf: X_HALF_M,
    zHalf: Z_HALF_M,
    step: GRID_STEP_M,
    rayY: RAY_Y,
    nx,
    nz,
    cells,
    skyMeshes,
    covered: cells - blanks.length,
    blanks: blanks.length,
    // Capped: a failing run in a scene with no ground at all would otherwise carry 2,000 points into the
    // log. The rows below carry the whole shape, which is what a reader needs.
    blankSample: blanks.filter((_, i) => i % 37 === 0).slice(0, 40),
    // Rows, with the blank x's grouped into runs, so the log shows the SHAPE of what was found: the rim
    // defect is two runs at the ends of every row, and the trench was one run in the middle of a few.
    rows: [...blankRows.entries()].map(([z, xs]) => {
      const runs = [];
      for (const x of xs) {
        const last = runs[runs.length - 1];
        if (last && x - last.xTo === GRID_STEP_M) last.xTo = x;
        else runs.push({ xFrom: x, xTo: x });
      }
      return { z, n: xs.length, runs };
    }),
    census: [...census.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, cells: n })),
  };
}

export function report(result) {
  const problems = [];
  const { cells, blanks, covered, census, rows, skyMeshes } = result;
  const box = `x ${-result.xHalf}..${result.xHalf} m, z ${-result.zHalf}..${result.zHalf} m, every ${result.step} m`;

  // The census first, because it is what makes the blank test auditable: a cell is blank when the ray
  // reaches the dome, so every mesh listed here is a mesh that stopped a ray before it got there. A mesh
  // covering thousands of cells is a place a hole could hide.
  console.log(`covering meshes over the sweep (${census.length} of them, by cell count):`);
  for (const c of census) console.log(`  ${String(c.cells).padStart(5)}  ${c.name}`);

  // The instrument, before the measurement. The blank test is written against the name `sky`, so a scene
  // that renamed or removed the dome would have every cell covered by whatever it is called instead, and
  // this gate would report a full pass over a world with a hole in it.
  if (skyMeshes !== 1) {
    problems.push(
      `found ${skyMeshes} mesh(es) named exactly "sky" in the built scene, and the blank test is written `
      + 'against that name. With no dome to reach, every ray meets whatever the dome is called instead and '
      + 'this gate reports cover where there is none. Either the dome was renamed in src/whitehouse/sky.js '
      + "(its name is set by the `b.add(mesh, 'sky')` at the end of buildSky, and NOT by the assignment "
      + 'above it, which the builder overwrites) or it was not added to the scene.',
    );
  }

  const many = blanks > BLANK_MAX;
  console.log(
    `${many ? 'FAIL' : 'ok  '} blank cells over ${box}: ${blanks} of ${cells} (limit ${BLANK_MAX})`
    + `${many ? ' -- the first ray to reach the sky is listed below' : ''}`,
  );
  if (many) {
    problems.push(
      `${blanks} of ${cells} downward rays over ${box} meet nothing but the sky dome, so the ground has a `
      + `hole in it ${blanks === cells ? 'everywhere' : 'somewhere'}: the frame shows the sky through it, and `
      + 'no scored gate can see one -- `compare` scores cell colours and a blurred structure, so sky through '
      + 'a hole is just another colour. The ground this scene builds is a set of slabs in '
      + 'src/whitehouse/grounds.js: the north lawn grid and the apron are one surface from z -40.6 to '
      + 'z +91.9, the far ground is a box north of that, and the south lawn is a box south of it. Find the '
      + 'slab whose own extent stops short of the blank rows below and widen it, rather than lowering this '
      + 'limit: the limit is zero because a single cell is a hole.',
    );
    for (const r of rows) {
      const where = r.runs.map((q) => (q.xFrom === q.xTo ? `x ${q.xFrom}` : `x ${q.xFrom}..${q.xTo}`)).join(', ');
      console.log(`     z ${String(r.z).padStart(6)}: ${where}, ${r.n} blank cell(s)`);
    }
    if (result.blankSample.length) {
      console.log(`     a sample of the blank cells: ${JSON.stringify(result.blankSample)}`);
    }
  }

  // A sweep that found no blanks because it swept nothing is the one way this check can lie. The floor is
  // under the 5,915 this grid sweeps, so it fires on a collapsed grid and not on a coarse one.
  if (cells < MIN_CELLS) {
    problems.push(
      `the sweep covered ${cells} cells, under the ${MIN_CELLS} that mean it swept the world rather than a `
      + `corner of it (this run swept ${result.nx} x ${result.nz}; as shipped the grid is 65 x 91 = 5,915 `
      + 'cells). Either the extent or the step '
      + 'collapsed, or the loops that build the grid are wrong, and a run that measured nothing reports the '
      + 'same "0 blank" as a run that measured the world.',
    );
  }

  console.log(
    `     swept ${result.nx} x ${result.nz} cells at ${result.step} m; ${covered} covered, ${blanks} blank; `
    + `${skyMeshes} mesh named "sky" in the scene.`,
  );

  // The marker tools/test.js reads as the evidence this gate ran. Printed after the measuring and after
  // every check above, and worded so no earlier line in this file can match it.
  console.log(
    `groundcover: ${blanks} of ${cells} downward rays reach the sky over ${box} `
    + `(limit ${BLANK_MAX}), ${covered} cells held up by ${census.length} mesh(es), `
    + `on ${result.renderer ?? 'an unrecorded renderer'}`,
  );
  return problems;
}

if (isMainModule(import.meta.url)) {
  const { result, errors, failure } = await measureGroundCover();
  if (failure) {
    console.error(`FAIL: ${failure.message}`);
    process.exit(1);
  }
  // Page errors first: a scene that threw while it was being built is not a scene worth measuring, and a
  // grid of cells taken off it would look exactly like a valid measurement.
  if (errors.length) {
    console.error(`FAIL: ${errors.length} page error(s):`);
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }
  mkdirSync(scene.out ?? 'out', { recursive: true });
  writeFileSync(`${scene.out ?? 'out'}/groundcover.json`, `${JSON.stringify({
    scene: result.scene,
    renderer: result.renderer,
    limits: { BLANK_MAX, MIN_CELLS, GRID_STEP_M, X_HALF_M, Z_HALF_M, RAY_Y, RAY_FAR },
    extent: { xHalf: result.xHalf, zHalf: result.zHalf, step: result.step, nx: result.nx, nz: result.nz, cells: result.cells },
    skyMeshes: result.skyMeshes,
    covered: result.covered,
    blanks: result.blanks,
    blankRows: result.rows,
    blankSample: result.blankSample,
    census: result.census,
  }, null, 1)}\n`);
  const problems = report(result);
  if (problems.length) {
    console.error(`\nFAIL: ${problems.length} ground cover problem(s):`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  // What was asserted, not what would be nice to have said. Outside the box, a void narrower than one cell
  // and a void hidden under another mesh are all outside this check, and the bounds at the top of this file
  // say why.
  console.log(
    `groundcover: over x +-${X_HALF_M} m and z +-${Z_HALF_M} m every downward ray meets ground. A hole `
    + 'outside that box, one narrower than a cell, or one hidden under another mesh is not covered -- see '
    + 'the bounds in tools/groundcover.js.',
  );
}
