// Clearance gate (run by npm test): what the walkable street keeps clear, overhead and at ground level.
//
// Two checks, one page load, because both ask the same question of the same surface — what occupies the
// air a person on this street stands in — and the page load is the expensive part.
//
// ---- CLAIM 1, headroom ------------------------------------------------------------------------------
// Nothing the cherry hangs comes lower than MIN_HEADROOM over the walkable street or over the right
// terrace, and its low wood is all within TRUNK_SPREAD_M of its own deepest point over either surface
// rather than being a limb at head height.
//
// Every other bound on how low a blossom may hang is the photo's blossom MASK, and a mask is a 2D
// silhouette: a strand falling straight down the photo camera's own ray stays inside that silhouette the
// whole way to the paving, so no scored gate can see the difference between a blossom four metres over
// the street and one at head height. The canopy reached 1.71 m over the landing where a standing eye is
// 1.70 m, and `npm run views` pose 5 looked into a single card 0.26 m away that filled the left third of
// the frame. compare scores 528 cell means and a 64 px grayscale image; placement asks for blossom to BE
// somewhere; nudge scores how much the frame changes; record and blackframe look for darkness. None of
// them can see this, and none of them ever went red for it.
//
// ---- CLAIM 2, the street stays open -----------------------------------------------------------------
// Along the walkable street, from the top of the paving down to STREET_TO_Z, BOTH halves of the paved
// band keep a clear run of at least MIN_STRIP metres, and the near half keeps MIN_SKY_STRIP clear of
// eaves as well: nothing built occupying the air over the paving between KERB_M and HEAD_M.
//
// The far machiya row's front line is the photo's own measurement of the street edge dropped onto a
// street that bends more slowly than the photo's, so by its last bay the row stood 0.46 m past the paved
// band's left edge — the building was in the road. From the photo view the row occludes itself there and
// no score moves, which is why this needs a gate of its own.
//
// ---- HOW BOTH ARE MEASURED --------------------------------------------------------------------------
// From the BUILT SCENE, never from the constants the scene was built with. The paving surface is found by
// dropping a ray onto the paving meshes themselves; the canopy's height is read from the instance
// matrices and vertex positions that three actually draws; the band's edges are where the paving stops.
// `src/layout.js` is not imported. A check built from the same symbol as the thing it checks proves only
// that the code agrees with itself, and both defects here were introduced by editing exactly the
// constants such a check would have read (`HEADROOM`, `FAR_ROW.keepOff`, `farRowFrontX`).
//
// ---- BOUND, check 1 ---------------------------------------------------------------------------------
// - It samples the canopy meshes' own geometry: every instance of every `cherry *` mesh except the trunk,
//   and every vertex of the merged strand mesh. Nothing is interpolated, so a low card cannot fall
//   between samples.
// - `cherry trunk` is not held to the headroom, because it is the trunk AND the limbs merged into one
//   mesh and the trunk stands on the street by design (33 of its vertices over the street and 45 over the
//   terrace sit below MIN_HEADROOM, all at its base). What it IS held to is that its low wood is one
//   clump: the spread of those low vertices about the deepest of them, 0.87 m over the street and 0.86 m
//   over the terrace as shipped, against a 2.00 m limit, measured over each surface separately. A limb
//   dipping to head height anywhere else moves that spread. Low wood 1.9 m from the foot does not.
// - It excludes `petals`, and that exclusion is not a convenience. A petal's drawn height is
//   `instanceY - mod(uTime * speed, 7.5)` computed in the vertex shader (src/animation.js), so the
//   instance matrix this gate can read is NOT where a petal is drawn; and petals are built to fall
//   through the street and below it — 182 of the 420 sit over the walkable street at t = 0, 68 of those
//   below 1.7 m and the lowest 1.86 m UNDER the paving. A matrix-read check on petals would be measuring
//   the wrong number and would fail on a correct scene. If the drift is ever bounded, it has to be
//   bounded in the shader where it is computed.
// - The canopy's height is read from CPU matrices. That is where the cards are drawn in Y only because
//   the wind's offset has no y term (`vec3(s, 0.0, c * 0.4)` in src/animation.js). Add a y term to the
//   wind and this gate goes on reporting the still positions. `applyMinWidth` also widens a strand tube
//   in view space by up to 4x of its 0.008-0.016 m radius, which this gate does not model.
// - "Over the walkable street" is the through route's own paving: the top platform, the stairs and their
//   gutter, the landing, and the far street. The right walkway and the side stair are the TERRACE, which
//   is walked on too — the pots, the fence and the side stair stand on it — and is held to the same
//   MIN_HEADROOM, because without an assertion there the fringe could simply move sideways off the street
//   and out of this gate, and a limit set at EYE_M exactly would have let the 1.71 m blossom that created
//   this gate through by 0.01 m. Shipped, the lowest over it is 2.526 m.
// - A hanging plant whose mesh name does not start with `cherry ` is measured by nothing here. Every
//   plant this check does not measure is printed by name on every run, which is a weak defence: it prints
//   the list a reader skims.
// - The ground under a card is found on a 0.25 m grid, so a card within 0.125 m of the paving's edge can
//   be tested against a neighbouring cell — or, if all five of its points quantize off the paving, not
//   tested at all. Five points are tried per card (its centre and its four horizontal corners) and the
//   HIGHEST walkable paving found under any of them is used, which understates clearance rather than
//   overstating it: the shipped lowest reads against ground at y -4.50 where the card's own z is -15.69.
// - It is one clock instant, t = 0. That costs nothing for the canopy (the wind moves no vertex in y) and
//   is the reason petals cannot be covered here.
//
// ---- BOUND, check 2 ---------------------------------------------------------------------------------
// - It samples z every Z_STEP m and x every X_STEP m, so an obstruction narrower than X_STEP or shorter
//   than Z_STEP along the street can fall between rays. The defect it exists for is 0.46 m wide and 8 m
//   long.
// - "Structure" is defined by exclusion — anything that is not paving, terrain, sky, vegetation or the
//   person — so a NEW building mesh is a structure without anyone remembering to list it. The cost of
//   that choice is that mislabelling something as terrain hides it: every set is printed every run.
// - A structure blocks where the air it occupies over the paving overlaps the band from KERB_M to the
//   rule's ceiling. Under KERB_M it is a kerb, a coping or a slab edge — the street's own masonry,
//   stepped over; the platform's front coping stands 0.17 m over the platform slabs and is excluded by
//   this, the low wall's cap tiles oversail the gutter by 0.69 m and are not, and a 0.34 m plinth laid
//   across the road would be missed. The MIN_STRIP rules use a ceiling of HEAD_M, so they measure the far
//   row's WALL line; the MIN_SKY_STRIP rule uses SKY_M and measures its EAVE line, which is what stops
//   the row being walked back into the street by less than MIN_STRIP. With nothing built overhead allowed
//   at all the narrowest near-half run is 0.50 m, and that figure is printed and not asserted, because
//   the street runs under eaves by design.
// - Plants are never blockers, and the three pots are classed as plants. A pot moved into the road would
//   not be reported.
// - "Near" and "far" are the halves either side of the band's own measured centre. Near is the half at
//   more negative x — the LEFT of the street, which is where the photo shows open road beside the far
//   row. It is not the half nearest the photo camera: the camera stands at x = 0, and past the bend the
//   band has drifted far enough left that x = 0 is not on it at all.
// - Neither half is measured beyond the paved band, so a structure standing on ground that is not paving
//   is invisible. And the run is the widest CLEAR run in that half, so street furniture that splits it —
//   the lamp post does, at z -13.75 — costs whichever side is narrower.
// - Nothing past STREET_TO_Z is asserted. See that constant for why it is a literal and not a rule; the
//   rows past it are printed with their blockers every run so the exclusion is a line in the log.
// - The band's edges and centre are measured per z from the paving itself, so a change to the street's
//   width or bend moves them with it. The run is a width, so it stops at 0: a row that hangs past the
//   band's left edge reads 0.00 m here, not the negative overhang the iteration 2 devlog quotes.
// - Every material is forced double-sided for the sweep and restored after, and the air a structure
//   occupies is read per INSTANCE. Without the first, a downward ray returns only top faces and a wall
//   running from under the paving to above head height is invisible; without the second, one instanced
//   tile set's high and low pieces would merge into one span and report the air between them as solid.
//   Nothing is rendered while the materials are changed.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.js';
import { launch, collectErrors, openScene, ACTION_TIMEOUT_MS } from './lib/browser.js';

// A standing eye on this street, 1.70 m over the paving. That is the eye `npm run views` pose 5 puts on
// the landing, and the eye the pose-5 blossom was seen from.
export const EYE_M = 1.7;
// What a person needs over their head not to walk face-first into a flower. The limit below is these two
// added, and it is written from the person rather than from the scene: THIS GATE'S OWN MEASUREMENTS are
// 2.073 m as shipped and 1.329 m with the scene's headroom rule switched off, so it sits 0.173 m under
// one state and 0.571 m over the other, and the scene's own `HEADROOM` turned down to 2.25 reads 1.799 m
// and is caught.
//
// That 0.173 m is NOT a comfortable margin, and calling it an envelope for design change would be wrong.
// The canopy draws every card's size and rotation from one shared PRNG stream, so ANY edit that changes
// how many `rand()` calls precede it re-rolls all 31,368 cards: six mutations aimed at the limbs and
// sub-branches, none of which touched `HEADROOM`, the mask, `streetY` or `streetCenterX`, moved this
// reading across 2.045 to 2.206 m — a 0.161 m spread, comparable to the margin. The figure reproduces
// exactly between runs and does not hold still across edits. When an unrelated canopy edit reds this
// gate, the answer is to look at the frame, not to lower the limit.
export const MIN_EYE_GAP = 0.2;
export const MIN_HEADROOM = EYE_M + MIN_EYE_GAP;
// The road left beside the far row. As shipped the narrowest near-half run is 1.10 m and the narrowest
// far-half run is also 1.10 m; with the row's front line unfloored the near half reaches 0 and the row's
// base crosses the band's left edge entirely.
export const MIN_STRIP = 0.6;
// The same road measured clear of an eave as well. Shipped 0.65 m. This is the rule that stops the row
// being walked back into the street by amounts the 0.60 m rule allows: the near-half run and the eave
// run both move 1:1 with `FAR_ROW.keepOff`, so a 0.40 m floor here would have let `keepOff` reach 1.75
// with 0.45 m of road left clear of the eave against 0.65 m shipped. At 0.55 it bites at about 1.60.
export const MIN_SKY_STRIP = 0.55;
// How far the cherry's low wood may reach from its own foot before it is a limb at head height rather
// than a trunk meeting the ground. Measured from the LOWEST such point — the trunk's deepest vertex —
// so the limit is literally the distance it names; an earlier version measured from the centroid of the
// low points, which an intruding limb drags toward itself, and permitted about 2.7 m. Shipped 0.87 m over
// the street and 0.86 m over the terrace.
export const TRUNK_SPREAD_M = 2.0;
// The air a person occupies over the paving: a standing eye plus 0.30 m. This is the ceiling of the
// blocker window for the MIN_STRIP rules, not a headroom.
export const HEAD_M = 2.0;
// Above this, a structure is a wall or a building; below it, it is masonry you step over.
export const KERB_M = 0.35;
// The height at which an eave stops being something you walk under.
export const SKY_M = 3.2;
// Where the walkable street ends. Past here the scene's bend block-out stands across the paving, and
// `far street slabs` go on to z -42 underneath it — the far houses standing on the far street's own
// paving, which iteration 2 named as open and did not fix.
//
// Be clear about where this number came from: it was CHOSEN AFTER SEEING WHERE THE GATE WENT RED, and on
// this tree it exempts exactly the same 34 rows that an earlier rule (end the street at the first z built
// over from edge to edge) exempted. What makes it better is not the answer, which is identical, but that
// it cannot be widened by building more: that rule got more forgiving the more completely a building
// blocked the road, and a single 0.25 m row of block-out silenced the 8 m behind it. Everything above
// this z is asserted, including any z that a building closes from edge to edge — a full closure gives a
// near-half run of 0 and fails like any other intrusion.
//
// So the exempt region is pinned from both sides, below: no more rows than it has today, and no blockers
// in it but the three that are there. A NEW building past the bend is red; the known one is not.
export const STREET_TO_Z = -33.5;
export const BEYOND_ROWS_MAX = 40; // shipped 34
export const BEYOND_BLOCKERS = ['corner house body', 'corner house roof', 'bend roof'];
const Z_STEP = 0.25;
const X_STEP = 0.05;

export async function measureClearance({ quiet = false } = {}) {
  let server = null;
  let browser = null;
  let errors = [];
  let failure = null;
  let result = null;
  try {
    server = await startServer({ port: 0, quiet: true });
    browser = await launch();
    const page = await browser.newPage({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(ACTION_TIMEOUT_MS);
    errors = collectErrors(page);
    const info = await openScene(page, `${server.url}/`);
    await page.evaluate(() => window.__scene.setTime(0));
    if (!quiet) console.log(`renderer: ${info.renderer}; clock pinned at t = 0`);
    result = await page.evaluate(measureInPage, { MIN_HEADROOM, HEAD_M, KERB_M, SKY_M, Z_STEP, X_STEP });
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
function measureInPage({ MIN_HEADROOM, HEAD_M, KERB_M, SKY_M, Z_STEP, X_STEP }) {
  const { THREE, scene } = window.__scene;
  scene.updateMatrixWorld(true);

  // The through route a person walks down the street: the top platform, the stairs and their gutter, the
  // landing, and the far street. Each is a set of instanced slabs over a continuous ribbon of the same
  // name, and both are walking surface.
  const WALK = /^(platform|platform slabs|platform coping|stairs|stair treads|stair risers|gutter|gutter floor|gutter curb|landing|landing slabs|far street|far street slabs|far street lit slabs)$/;
  // The right terrace: walkable, but not the street, and measured separately so the gap is a number.
  const TERRACE = /^(right paving|right walkway|right walkway far|side stair treads|side stair risers|side stair body)$/;
  // Terrain and backdrop. Not walking surface and not structure. Whole names, not prefixes, so a mesh
  // called "hillside cottage" does not quietly become terrain; every name that lands here is printed.
  const TERRAIN = /^(sky|mountains (blue|farthest)|near ridge|hill|hillside|far plots (left|right)|ground base|left house 1 ground|right house ground( far)?)$/;
  // Growing things and the person: neither is a building standing in the road.
  const LIVING = /^(cherry .*|evergreen (trunks|cards)|shrub leaves|shrub 2 leaves|left plant leaves|weeds|moss|petals|pot|small pot|left pot|person .*)$/;
  // The canopy, for check 1: every cherry mesh except the trunk, which stands on the street by design and
  // carries the limbs in the same merged geometry.
  const CANOPY = (n) => n.startsWith('cherry ') && n !== 'cherry trunk';

  const walk = [];
  const terrace = [];
  const structure = [];
  const canopy = [];
  const other = [];
  // Plants that check 1 does NOT measure, listed every run so the hole is a printed line rather than a
  // paragraph in a header. Check 1 covers the cherry's hanging geometry, which is the one thing in this
  // scene that hangs; a new hanging plant under another name would land here and be measured by nothing.
  const plantsUnmeasured = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const n = o.name || '';
    if (WALK.test(n)) walk.push(o);
    else if (TERRACE.test(n)) terrace.push(o);
    else if (CANOPY(n)) canopy.push(o);
    else if (TERRAIN.test(n) || LIVING.test(n)) {
      other.push(o);
      if (LIVING.test(n)) plantsUnmeasured.push(n);
    } else structure.push(o);
  });

  const rc = new THREE.Raycaster();
  rc.far = 400;
  const DOWN = new THREE.Vector3(0, -1, 0);
  const from = new THREE.Vector3();
  const RAY_Y = 80;

  // ---- check 1: headroom over the walkable street ----------------------------------------------
  // One raycast per 0.25 m cell, cached, because 31k cards over a 10 m square is 1.7k cells.
  const cache = new Map();
  const pavingAt = (set, tag, x, z) => {
    const qx = Math.round(x * 4) / 4;
    const qz = Math.round(z * 4) / 4;
    const key = `${tag}|${qx}|${qz}`;
    if (!cache.has(key)) {
      from.set(qx, RAY_Y, qz);
      rc.set(from, DOWN);
      const hits = rc.intersectObjects(set, true);
      cache.set(key, hits.length ? { y: hits[0].point.y, name: hits[0].object.name } : null);
    }
    return cache.get(key);
  };

  const headroomOver = (set, tag, meshes = canopy) => {
    const out = { meshes: [], samples: 0, over: 0, lowest: null, below: [], lowPoints: [] };
    const m = new THREE.Matrix4();
    const box = new THREE.Box3();
    const c = new THREE.Vector3();
    const v = new THREE.Vector3();
    for (const o of meshes) {
      const rows = o.isInstancedMesh ? o.count : o.geometry.attributes.position.count;
      out.meshes.push(`${o.name} (${o.isInstancedMesh ? `${rows} instances` : `${rows} vertices`})`);
      const pos = o.isInstancedMesh ? null : o.geometry.attributes.position;
      if (o.isInstancedMesh) o.geometry.computeBoundingBox();
      const gb = o.isInstancedMesh ? o.geometry.boundingBox : null;
      for (let i = 0; i < rows; i++) {
        let lowY;
        let cx;
        let cy;
        let cz;
        let corners;
        if (o.isInstancedMesh) {
          o.getMatrixAt(i, m);
          m.premultiply(o.matrixWorld);
          box.copy(gb).applyMatrix4(m);
          c.setFromMatrixPosition(m);
          lowY = box.min.y;
          cx = c.x; cy = c.y; cz = c.z;
          corners = [[cx, cz], [box.min.x, box.min.z], [box.min.x, box.max.z], [box.max.x, box.min.z], [box.max.x, box.max.z]];
        } else {
          v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
          lowY = v.y; cx = v.x; cy = v.y; cz = v.z;
          corners = [[cx, cz]];
        }
        out.samples++;
        // The highest walkable paving under the card's own footprint. A card that overhangs the paving's
        // edge is measured against the paving, not let off because its centre is past it.
        let ground = null;
        for (const [px, pz] of corners) {
          const g = pavingAt(set, tag, px, pz);
          if (g && (!ground || g.y > ground.y)) ground = g;
        }
        if (!ground) continue;
        out.over++;
        const clear = lowY - ground.y;
        if (!out.lowest || clear < out.lowest.clear) out.lowest = { clear, mesh: o.name, x: cx, y: cy, z: cz, ground: ground.name, groundY: ground.y };
        if (clear < MIN_HEADROOM && out.below.length < 12) out.below.push({ clear, mesh: o.name, x: cx, y: cy, z: cz, ground: ground.name });
        if (o.isInstancedMesh) out.maxDrop = Math.max(out.maxDrop ?? 0, cy - lowY);
        if (clear < MIN_HEADROOM) {
          out.belowCount = (out.belowCount ?? 0) + 1;
          out.lowPoints.push([cx, cz, lowY]);
        }
      }
    }
    out.belowCount ??= 0;
    return out;
  };

  const t1 = Date.now();
  const street = headroomOver(walk, 'walk');
  const terraceHead = headroomOver(terrace, 'terrace');
  // The trunk mesh carries the LIMBS as well as the trunk, and cannot be held to a headroom because the
  // trunk stands on the street. What CAN be held is that its low wood is all one clump — its own foot —
  // so a limb dipping to head height somewhere else shows up as a low point far from it. Measured over
  // the terrace as well as the street, because a sub-branch diving onto the side stair is the same defect
  // one step sideways.
  const trunkMesh = [];
  scene.traverse((o) => { if (o.isMesh && o.name === 'cherry trunk') trunkMesh.push(o); });
  const spreadOf = (r) => {
    // Anchored on the LOWEST low point, which is the trunk's own deepest vertex, not on the centroid of
    // the low points: a centroid is dragged toward an intruding limb and the limit stops meaning the
    // distance it names.
    if (!r.lowPoints.length) { r.foot = null; r.spread = 0; return r; }
    let foot = r.lowPoints[0];
    for (const p of r.lowPoints) if (p[2] < foot[2]) foot = p;
    r.foot = [foot[0], foot[1]];
    r.spread = Math.max(...r.lowPoints.map(([x, z]) => Math.hypot(x - foot[0], z - foot[1])));
    return r;
  };
  const trunk = spreadOf(headroomOver(walk, 'walk', trunkMesh));
  const trunkTerrace = spreadOf(headroomOver(terrace, 'terrace', trunkMesh));
  // The vertical drop from a card's centre to its lowest corner, which is what the headroom margin is
  // actually spent on when cards grow. The horizontal extent is not that number and must not stand in
  // for it.
  street.cardDrop = street.maxDrop ?? 0;
  for (const r of [trunk, trunkTerrace, street, terraceHead]) delete r.lowPoints;
  const headSeconds = (Date.now() - t1) / 1000;

  // ---- check 2: the near half of the paved band, swept along the street --------------------------
  const t2 = Date.now();
  // The swept window is the walkable paving's own bounding box, padded by a step, so no constant here
  // decides where the street is: widen the street and the sweep widens with it.
  const span = new THREE.Box3();
  for (const o of walk) span.union(new THREE.Box3().setFromObject(o));
  const xFrom = span.min.x - X_STEP;
  const xTo = span.max.x + X_STEP;
  const zFrom = span.max.z + Z_STEP;
  const zTo = span.min.z - Z_STEP;
  // Every material is made double-sided for the length of this sweep, and put back afterwards. It is not
  // cosmetic and nothing is rendered while it is on. A downward ray through a FRONT-FACING solid returns
  // only its top face, so a wall running from under the paving to above head height would present no
  // surface in the window this check looks at and would be invisible — the far row is caught today only
  // because its base band's top happens to sit 0.45 m up. Double-sided, the ray returns each solid's
  // entry AND exit, so the check can ask what it actually means to ask: does a structure OCCUPY the air
  // over this patch of paving, between the height a kerb stops and the height a person does.
  const sides = new Map();
  const rows = [];
  try {
    // Inside the try, so a material that refuses to be written is restored like any other failure.
    scene.traverse((m) => {
      if (!m.isMesh) return;
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        if (mat && !sides.has(mat)) { sides.set(mat, mat.side); mat.side = THREE.DoubleSide; }
      }
    });
    for (let z = zFrom; z >= zTo; z -= Z_STEP) {
    const cells = [];
    for (let x = xFrom; x <= xTo + 1e-6; x += X_STEP) {
      from.set(x, RAY_Y, z);
      rc.set(from, DOWN);
      const wh = rc.intersectObjects(walk, true);
      if (!wh.length) { cells.push({ x, pav: null }); continue; }
      const pav = wh[0].point.y;
      rc.set(from, DOWN);
      const sh = rc.intersectObjects(structure, true);
      // Per mesh, the span of air its hits cover in this column: highest hit to lowest. A structure
      // blocks where that span overlaps the band from KERB_M to the rule's ceiling. Under KERB_M it is a
      // coping, a kerb or a slab edge — the street's own masonry, stepped over. Over the ceiling it is a
      // roof or an eave, walked under. Measuring each mesh's span rather than the column's surfaces is
      // what keeps a 0.17 m coping from being reported because a roof sits eight metres above it, and is
      // also what catches a solid whose only faces are below the paving and above head height.
      // Keyed per INSTANCE, not per mesh: a tile set or a course of stones is one mesh with many pieces,
      // and merging their hits would report the air between a high piece and a low one as occupied.
      const span = new Map();
      for (const h of sh) {
        const key = `${h.object.id}|${h.instanceId ?? ''}`;
        const s = span.get(key);
        if (s) { s.lo = Math.min(s.lo, h.point.y); s.hi = Math.max(s.hi, h.point.y); }
        else span.set(key, { lo: h.point.y, hi: h.point.y, name: h.object.name });
      }
      let blockHead = false;
      let blockSky = false;
      let blockAny = false;
      let name = null;
      for (const s of span.values()) {
        if (s.hi < pav + KERB_M) continue; // entirely below the kerb line: masonry, not a building
        blockAny = true;
        if (s.lo < pav + SKY_M) blockSky = true;
        if (s.lo < pav + HEAD_M) { blockHead = true; name = s.name; }
        if (!name) name = s.name;
      }
      cells.push({ x, pav, name, blockHead, blockSky, blockAny });
    }
    const paved = cells.filter((c) => c.pav !== null);
    if (!paved.length) continue;
    const x0 = paved[0].x;
    const x1 = paved[paved.length - 1].x;
    const centre = (x0 + x1) / 2;
    const runIn = (key, limit = centre, from = -Infinity) => {
      let best = { len: 0, a: null, b: null };
      let run = null;
      for (const c of cells) {
        const ok = c.pav !== null && !c[key] && c.x <= limit + 1e-6 && c.x >= from - 1e-6;
        if (ok) run = run ? { a: run.a, b: c.x } : { a: c.x, b: c.x };
        else if (run) {
          // Rounded to the sampling grid. `x` is accumulated by repeated addition, so a run that is
          // exactly the limit comes out a few ulps under it and fails a `>=` that should pass; measured,
          // a 0.55 m run read 0.5499999999999999 against a 0.55 limit.
          const len = +((run.b - run.a + X_STEP).toFixed(4));
          if (len > best.len) best = { len, ...run };
          run = null;
        }
      }
      if (run) {
        const len = run.b - run.a + X_STEP;
        if (len > best.len) best = { len, ...run };
      }
      return best;
    };
    const head = runIn('blockHead');
    const far = runIn('blockHead', x1, centre);
    const names = [...new Set(cells.filter((c) => c.blockHead && c.x <= centre).map((c) => c.name))];
    rows.push({
      z, x0, x1, centre,
      near: head.len, a: head.a, b: head.b,
      far: far.len,
      sky: runIn('blockSky').len,
      any: runIn('blockAny').len,
      blockers: names,
      farBlockers: [...new Set(cells.filter((c) => c.blockHead && c.x > centre).map((c) => c.name))],
    });
    }
  } finally {
    for (const [mat, side] of sides) mat.side = side;
  }
  const sweepSeconds = (Date.now() - t2) / 1000;

  return {
    counts: { walk: walk.length, terrace: terrace.length, structure: structure.length, canopy: canopy.length, other: other.length },
    names: {
      walk: walk.map((o) => o.name),
      terrace: terrace.map((o) => o.name),
      canopy: canopy.map((o) => o.name),
      // Every name that was NOT treated as a building, so the exclusion list is auditable from the log
      // rather than from this file. Anything wrongly here is a building this check cannot see.
      other: other.map((o) => o.name),
      structure: structure.map((o) => o.name),
      plantsUnmeasured,
    },
    window: { xFrom, xTo, zFrom, zTo },
    street,
    terraceHead,
    trunk,
    trunkTerrace,
    rows,
    headSeconds,
    sweepSeconds,
  };
}

export function report(result) {
  const problems = [];
  const { street, terraceHead, rows, counts, names } = result;

  console.log(
    `sets from the built scene: ${counts.walk} walkable street meshes, ${counts.terrace} terrace, `
    + `${counts.canopy} canopy, ${counts.structure} structure, ${counts.other} terrain/living/person`,
  );
  console.log(`  walkable street: ${names.walk.join(', ')}`);
  console.log(`  canopy measured: ${street.meshes.join(', ')}`);
  console.log(`  plants NOT measured for headroom: ${names.plantsUnmeasured.join(', ') || '(none)'}`);
  console.log(`  not a building (terrain, plants, the person): ${names.other.join(', ')}`);

  // ---- check 1 -----------------------------------------------------------------------------------
  // Three "did this actually measure the canopy" guards, because a partial rename is what happens in
  // practice and a check with half its subject missing prints the same "ok" as one with all of it. The
  // floors are under the shipped figures by a wide margin (66,284 samples and 60,265 of them over the
  // street) but over what is left if either canopy mesh disappears (34,916 or 31,368).
  if (!street.meshes.length || !street.samples) {
    problems.push('found no canopy geometry to measure; the headroom check did not run');
  } else if (!counts.walk) {
    problems.push('found no walkable street paving; the headroom check had nothing to measure against');
  } else if (street.samples < 40000) {
    problems.push(
      `only ${street.samples} canopy samples were found in ${counts.canopy} mesh(es) (${street.meshes.join(', ')}), `
      + 'under the 40000 that mean the whole canopy is being measured (this scene has 66284 in two meshes, '
      + '31368 blossom instances and 34916 strand vertices). A canopy mesh has been renamed, split or '
      + 'removed: CANOPY in tools/clearance.js takes every "cherry *" mesh except the trunk.',
    );
  } else if (street.over < 1000) {
    problems.push(
      `only ${street.over} of ${street.samples} canopy samples sit over walkable street paving, under the `
      + '1000 that make this a measurement of the street rather than of a corner of it (this scene has '
      + '60265). Either the canopy moved off the street or the paving mesh names changed; see WALK '
      + `in tools/clearance.js, which matched ${counts.walk} meshes (${names.walk.join(', ')}).`,
    );
  }
  const low = street.lowest;
  if (low) {
    const ok = low.clear >= MIN_HEADROOM;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} lowest canopy geometry over the walkable street: ${low.clear.toFixed(3)} m `
      + `(limit ${MIN_HEADROOM.toFixed(2)} m) — ${low.mesh} at (${low.x.toFixed(2)}, ${low.y.toFixed(2)}, ${low.z.toFixed(2)}) `
      + `over "${low.ground}" at y ${low.groundY.toFixed(2)}`,
    );
    if (!ok) {
      problems.push(
        `${street.belowCount} of ${street.over} canopy samples over the walkable street hang below `
        + `${MIN_HEADROOM.toFixed(2)} m, the lowest at ${low.clear.toFixed(3)} m. A standing eye on this `
        + 'street is 1.70 m over the paving, so the canopy is at head height. The photo\'s blossom mask '
        + 'cannot bound this — it is a 2D silhouette — so the clearance has to be enforced in world space '
        + 'where the canopy is built (src/vegetation.js).',
      );
      for (const b of street.below.slice(0, 6)) {
        console.log(`     ${b.mesh} at (${b.x.toFixed(2)}, ${b.y.toFixed(2)}, ${b.z.toFixed(2)}): ${b.clear.toFixed(3)} m over "${b.ground}"`);
      }
    }
  }
  console.log(
    `     ${street.over} of ${street.samples} canopy samples sit over the walkable street; `
    + `${street.belowCount} below the limit. The largest vertical drop from a card's centre to its lowest `
    + `corner is ${(street.maxDrop ?? 0).toFixed(3)} m, which is what this margin is spent on if the cards grow.`,
  );

  // The right terrace is walked on too — the pots, the fence and the side stair stand on it — so it gets
  // the eye height without the gap. It is not the street and does not owe the street's clearance, but
  // "nothing hangs into a person's head there" is worth asserting rather than printing, or the fringe can
  // simply move sideways off the street and out of this gate.
  // Both of the assertions below sit behind an `if`, so each needs a floor of its own or it reports
  // "did not run" as "passed" — the exact failure the whole gate exists to avoid.
  if (!counts.terrace) {
    problems.push('no right-terrace paving was found, so the terrace headroom assertion did not run; TERRACE in tools/clearance.js is the list, and this scene has 6 meshes in it');
  }
  const tl = terraceHead.lowest;
  if (counts.terrace && !tl) {
    problems.push(`no canopy sample sits over the ${counts.terrace} terrace meshes, so the terrace headroom assertion did not run`);
  }
  if (tl) {
    const ok = tl.clear >= MIN_HEADROOM;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} lowest canopy geometry over the right terrace: ${tl.clear.toFixed(3)} m `
      + `(limit ${MIN_HEADROOM.toFixed(2)} m) — ${tl.mesh} at (${tl.x.toFixed(2)}, ${tl.y.toFixed(2)}, ${tl.z.toFixed(2)}) over "${tl.ground}"`,
    );
    if (!ok) {
      problems.push(
        `${terraceHead.belowCount} canopy samples over the right terrace hang below ${MIN_HEADROOM.toFixed(2)} m, `
        + `the lowest at ${tl.clear.toFixed(3)} m. The terrace is walked on — the pots, the fence and the `
        + 'side stair stand on it — and the headroom rule in src/vegetation.js is a floor over the STREET '
        + 'that does not reach it, so the canopy can hang into a person there with the street rule green.',
      );
    }
  }

  // The trunk mesh carries the limbs, so it cannot be held to a headroom — but its low wood can be held
  // to one place. If a limb dips to head height anywhere else, the low points stop being one clump around
  // the trunk's foot. Measured over the street and over the terrace, separately.
  for (const [where, tr] of [['street', result.trunk], ['terrace', result.trunkTerrace]]) {
    if (!tr || !tr.samples) {
      problems.push(`no mesh named "cherry trunk" was found, so the low-wood assertion over the ${where} did not run — it has been renamed, and CANOPY in tools/clearance.js would not have measured it either`);
      continue;
    }
    if (!tr.foot) {
      console.log(`ok   the cherry's low wood over the ${where}: none of its ${tr.over} vertices there sits below ${MIN_HEADROOM.toFixed(2)} m`);
      continue;
    }
    const ok = tr.spread <= TRUNK_SPREAD_M;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} the cherry's low wood over the ${where} is its own foot: ${tr.belowCount} of `
      + `${tr.over} vertices of "cherry trunk" sit below ${MIN_HEADROOM.toFixed(2)} m, spread ${tr.spread.toFixed(2)} m `
      + `(limit ${TRUNK_SPREAD_M.toFixed(2)} m) from its deepest point at (${tr.foot[0].toFixed(2)}, ${tr.foot[1].toFixed(2)})`,
    );
    if (!ok) {
      problems.push(
        `"cherry trunk" has low wood ${tr.spread.toFixed(2)} m from its own foot over the ${where}, past the `
        + `${TRUNK_SPREAD_M.toFixed(2)} m allowed. That mesh carries the LIMBS as well as the trunk, and a `
        + 'limb is a 0.08 to 0.26 m tube: this is a branch at head height. The headroom rule in '
        + 'src/vegetation.js is applied inside pushBlossom and never tests the limb splines, so nothing in '
        + 'the scene prevents it.',
      );
    }
  }
  // The marker tools/test.js looks for. Printed after the check's own work, and worded so it cannot be
  // matched by any earlier line here (the set listing prints "walkable street:", which contains
  // "street:" but not "clearance street:").
  console.log(`clearance headroom: lowest canopy geometry ${low ? low.clear.toFixed(3) : 'n/a'} m over the walkable street, limit ${MIN_HEADROOM.toFixed(2)} m, ${street.over} samples over ${counts.walk} paving meshes`);

  // ---- check 2 -----------------------------------------------------------------------------------
  // A run that measured a couple of metres of paving and passed would look exactly like a run that
  // measured the street, so check 2 asserts it found a street at all before asserting anything about it:
  // paving under 90% of the sampled z positions between the top of the SWEPT WINDOW and STREET_TO_Z
  // (shipped 166 of 166), at least 50 structure meshes (176), and a structure reaching the paving at a
  // fifth of those z positions (131).
  if (!rows.length) {
    problems.push('the street sweep found no walkable paving at all; check 2 did not run');
  }
  const asserted = rows.filter((r) => r.z > STREET_TO_Z);
  const beyond = rows.filter((r) => r.z <= STREET_TO_Z);
  // Every sampled z inside the street must have paving under it. If the walkable set loses a mesh the
  // rows over it vanish, and a check with nothing to measure reports the same "ok" as one that measured.
  // The denominator is the SWEPT window, which comes from the paving's own bounding box, not the topmost
  // row that happens to have paving: taking it from the data would let the whole top of the street vanish
  // with the ratio still reading 100%.
  const expected = Math.round((result.window.zFrom - STREET_TO_Z) / Z_STEP);
  if (expected > 0 && asserted.length < expected * 0.9) {
    problems.push(
      `only ${asserted.length} of the ${expected} sampled z positions between the top of the swept window `
      + `(z ${result.window.zFrom.toFixed(2)}, the paving's own bounding box) and z ${STREET_TO_Z} have any `
      + 'walkable paving under them, so the street has holes in it or the paving mesh names in WALK no '
      + `longer match the scene — this run matched ${counts.walk} (${names.walk.join(', ')}).`,
    );
  }
  // A gate whose structure set emptied would find every cell unblocked and print the widest possible run.
  if (counts.structure < 50) {
    problems.push(
      `only ${counts.structure} meshes were treated as buildings (this scene has 176), so almost nothing `
      + 'could block the street and this check would pass whatever stood in the road. The sets are built '
      + 'by exclusion in tools/clearance.js; something is being classified as terrain, paving or a plant.',
    );
  }
  // A fifth of the street, not one row: the case this guards is the structures BESIDE the biting bays
  // going missing, and one blocker in 41 metres would clear a `some()`.
  const blocked = asserted.filter((r) => r.blockers.length || r.farBlockers.length).length;
  if (asserted.length && blocked < asserted.length * 0.2) {
    problems.push(
      `a structure reaches the paving at only ${blocked} of ${asserted.length} z positions along the `
      + 'street (this scene, 131), so almost nothing is being measured against. Either the buildings '
      + 'beside the street have moved off it or they are no longer classified as structures.',
    );
  }

  const checks = [
    ['near half', 'near', MIN_STRIP, (r) => r.blockers],
    ['far half', 'far', MIN_STRIP, (r) => r.farBlockers],
    ['near half clear of eaves too', 'sky', MIN_SKY_STRIP, (r) => r.blockers],
  ];
  let worst = null;
  for (const [label, key, limit, blockersOf] of checks) {
    let w = null;
    for (const r of asserted) if (!w || r[key] < w[key]) w = r;
    if (!w) continue;
    if (key === 'near') worst = w;
    const bad = asserted.filter((r) => r[key] < limit);
    const ok = w[key] >= limit;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} narrowest clear run, ${label}: ${w[key].toFixed(2)} m (limit `
      + `${limit.toFixed(2)} m) at z ${w.z.toFixed(2)}, band ${w.x0.toFixed(2)} to ${w.x1.toFixed(2)}, `
      + `centre ${w.centre.toFixed(2)}${blockersOf(w).length ? `, blocked by ${blockersOf(w).join(', ')}` : ''}`,
    );
    if (ok) continue;
    problems.push(
      `${bad.length} of ${asserted.length} z positions along the street leave less than `
      + `${limit.toFixed(2)} m of clear paving in the ${label}, the narrowest ${w[key].toFixed(2)} m at z `
      + `${w.z.toFixed(2)}. Something built is standing in the road: `
      + `${[...new Set(bad.flatMap(blockersOf))].join(', ') || '(nothing named — the paving itself ends there)'}.`,
    );
    for (const r of bad.slice(0, 8)) {
      console.log(`     z ${r.z.toFixed(2)}: ${r[key].toFixed(2)} m clear, band ${r.x0.toFixed(2)}..${r.x1.toFixed(2)}, blockers ${blockersOf(r).join(', ') || '-'}`);
    }
    if (bad.length > 8) console.log(`     ... and ${bad.length - 8} more`);
  }
  const at = (key) => {
    const r = asserted.reduce((a, q) => (a === null || q[key] < a[key] ? q : a), null);
    return r ? `${r[key].toFixed(2)} m at z ${r.z.toFixed(2)}` : 'n/a';
  };
  console.log(
    `     swept z ${rows[0]?.z.toFixed(2)} to ${rows[rows.length - 1]?.z.toFixed(2)} every ${Z_STEP} m, `
    + `x every ${X_STEP} m, over the walkable paving's own box `
    + `(x ${result.window.xFrom.toFixed(2)} to ${result.window.xTo.toFixed(2)}); asserted over the `
    + `${asserted.length} of them above z ${STREET_TO_Z}.`,
  );
  console.log(
    `     printed and NOT asserted: with nothing built overhead allowed at all, the narrowest near-half `
    + `run is ${at('any')} — the street runs under eaves by design.`,
  );
  // The exempt region is pinned from both sides so it cannot quietly grow: no more rows than it has, and
  // no blockers in it but the bend block-out that is the known defect. A NEW building past the bend, or
  // paving laid further down-street, goes red here.
  if (beyond.length) {
    const bad = beyond.filter((r) => r.near < MIN_STRIP);
    const blockers = [...new Set(beyond.flatMap((r) => [...r.blockers, ...r.farBlockers]))];
    const unexpected = blockers.filter((b) => !BEYOND_BLOCKERS.includes(b));
    console.log(
      `     past z ${STREET_TO_Z}, ${beyond.length} more paved z positions run to z `
      + `${beyond[beyond.length - 1].z.toFixed(2)} and are NOT asserted (limit ${BEYOND_ROWS_MAX}): `
      + `${bad.length} of them leave under ${MIN_STRIP.toFixed(2)} m in the near half, `
      + `${beyond.length - bad.length} are open road, and the structures over them are `
      + `${blockers.join(', ') || 'none'}. That is the bend's block-out standing on the far street's own `
      + 'paving, which is the scene\'s open defect and not this check\'s.',
    );
    if (beyond.length > BEYOND_ROWS_MAX) {
      problems.push(
        `${beyond.length} paved z positions now sit past z ${STREET_TO_Z}, over the ${BEYOND_ROWS_MAX} `
        + 'this exemption was sized for. The unasserted region has grown; either paving was laid further '
        + 'down-street or a mesh joined WALK, and either way more street is going unchecked.',
      );
    }
    if (unexpected.length) {
      problems.push(
        `something new is built over the paving past z ${STREET_TO_Z}: ${unexpected.join(', ')}. The `
        + `exemption there covers ${BEYOND_BLOCKERS.join(', ')} and nothing else, because it exists for one `
        + 'named defect — the bend block-out standing on the far street\'s paving — and not for the z range.',
      );
    }
  }
  console.log(`clearance street: narrowest near-half clear run ${worst ? worst.near.toFixed(2) : 'n/a'} m over ${asserted.length} of ${rows.length} paved z positions, limit ${MIN_STRIP.toFixed(2)} m`);
  console.log(`     (headroom check ${result.headSeconds.toFixed(1)} s, street sweep ${result.sweepSeconds.toFixed(1)} s in the page)`);
  return problems;
}

function isMainModule() {
  if (!process.argv[1]) return false;
  const a = resolve(process.argv[1]).toLowerCase();
  const b = fileURLToPath(import.meta.url).toLowerCase();
  return a === b;
}

if (isMainModule()) {
  const { result, errors, failure } = await measureClearance();
  if (failure) {
    console.error(`FAIL: ${failure.message}`);
    process.exit(1);
  }
  // Page errors first: a scene that threw while it was being built is not a scene worth measuring, and a
  // file of numbers taken off it would look exactly like a valid measurement.
  if (errors.length) {
    console.error(`FAIL: ${errors.length} page error(s):`);
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }
  // Every measured z, so a failure can be read row by row rather than from the eight printed above.
  mkdirSync('out', { recursive: true });
  writeFileSync('out/clearance.json', JSON.stringify({
    limits: { EYE_M, MIN_EYE_GAP, MIN_HEADROOM, MIN_STRIP, MIN_SKY_STRIP, TRUNK_SPREAD_M, HEAD_M, KERB_M, SKY_M, STREET_TO_Z, BEYOND_ROWS_MAX, BEYOND_BLOCKERS },
    counts: result.counts,
    names: result.names,
    window: result.window,
    headroom: {
      lowest: result.street.lowest,
      samples: result.street.samples,
      over: result.street.over,
      below: result.street.below,
      belowCount: result.street.belowCount,
      cardDrop: result.street.maxDrop,
      terraceLowest: result.terraceHead.lowest,
    },
    trunk: result.trunk,
    trunkTerrace: result.trunkTerrace,
    rows: result.rows,
  }, null, 1));
  const problems = report(result);
  if (problems.length) {
    console.error(`\nFAIL: ${problems.length} clearance problem(s):`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  // What was asserted, not what would be nice to have said. The petals and the limb splines are outside
  // both checks, and so is the paving past the bend; the bounds at the top of this file say why.
  console.log(
    `clearance: over the walkable street the cherry's cards and strands clear ${MIN_HEADROOM.toFixed(2)} m, `
    + `and nothing built leaves the near or far half of the paved band under ${MIN_STRIP.toFixed(2)} m of `
    + `clear run down to z ${STREET_TO_Z}. Petals, the limb splines and the paving past the bend are not `
    + 'covered — see the bounds in tools/clearance.js.',
  );
}
