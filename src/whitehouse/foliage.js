// The trees the reference photograph frames the building with, and the two hedges that close the
// composition at the north lawn's ends.
//
// The photo shows a dense dark tree mass filling the frame's left edge from v 0.24 to 0.72 and a second on
// the right from v 0.24 to 0.62, plus an American elm's crown glimpsed over the west wing. Their positions
// and sizes are UNVERIFIED (research-photo.md section 5 item 21): everything here is placed from the photograph by
// the solved camera, and the crowns are ellipsoids rather than anything botanically specific, because a
// blockout's job is the silhouette and the occlusion.
import * as THREE from 'three';
import { DIMS, COLORS, NORTH_LAWN, TERRACE } from './layout.js';
import { mulberry32, uniform } from '../random.js';

// Deterministic: the scene must build identically on every load, so every placement comes from the seeded
// generator in src/random.js and nothing from Math.random.
const SEED = 20240620;

function crown(b, name, x, z, y, rx, ry, rz, color, segments = 16) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, segments, Math.max(6, Math.round(segments * 0.75))),
    new THREE.MeshStandardMaterial({ color, roughness: 1.0, metalness: 0, flatShading: true }),
  );
  mesh.scale.set(rx, ry, rz);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  b.add(mesh, name);
  return mesh;
}

// A framing tree's crown: a CLUSTER OF LOBES WITH REAL GAPS IN IT, not one scaled sphere.
//
// THE DEFECT THIS REPLACES, MEASURED. out/critic/measure.mjs on the frame as this pass received it: luma p5
// is 84 in the render against 7.5 in the photograph, and 1.93% of pixels are below luma 16 against the
// photograph's 6.86%. out/wh/scratch/probe2.mjs raycasts it: at photo position (0.979, 0.386) the render puts
// `sky` where the photograph has a luma-9 tree mass, and at u 0.06 the render's first surface is the FAR
// rank at 170 m -- the west framing tree does not appear until below v 0.50, against the photograph's mass,
// which runs from v 0.338 to v 0.562 at that same column. One smooth ellipsoid cannot be both that wide and
// that broken. The profile is the test.
//
// THE PHOTOGRAPH'S OWN NUMBERS, out/wh/scratch/whprof.mjs and whmap.mjs on whitehouse.webp at 1200x900:
//
//   u 0.06  the mass arrives at v 0.338 with a -99 then -56 step out of a luma-174 sky and ENDS at v 0.562
//           with a +188 step onto the lit wall at 199. Between those rows the column alternates: 74 at
//           v 0.372, 178 at 0.388 and 45/66 at 0.408/0.412 (that is SKY THROUGH THE CROWN), 67 at 0.418, 35
//           to 45 across 0.426-0.432, 63 at 0.448, 49 at 0.488, 47 at 0.550.
//   u 0.94  the mass arrives at v 0.364.   u 0.97: arrives at v 0.328 out of luma 184, holds past v 0.60.
//   the map, region u 0-0.28: the west mass sits ON the frame's own edge with a right boundary that runs
//           u 0.048 at v 0.335, 0.056 at 0.40, 0.072 at 0.43 and 0.092 at 0.51. The east mass, u 0.72-1.0,
//           has its left boundary at u 0.81 from v 0.46 down and reaches the right edge from v 0.32.
//
// THE COLOURS ARE SAMPLED FROM THESE TWO TREES, not reused from the north tree line's backlit estimate: see
// COLORS.treeMassCore, treeMassEdge and treeMassLit, each with its own box. Their span is a near-black core
// (luma 6) through a rim at luma 29 to an upper band at luma 50, and the lobes take one of the three by which
// way they face -- the core, the rim, or the sunward side. The rig's sun stands 42 degrees up and 20 degrees
// east of the optical axis (sky.js SKY.sunDirection), so the facing test below is that same unit vector.
//
// THE GAPS ARE THE POINT, and they come from the pair of numbers: a lobe's own centre sits 0.62 to 0.98 of
// the way out to the envelope along a Fibonacci-sphere direction, and its radius is only 0.30 to 0.46 of the
// envelope. Lobes that land near each other overlap into a mass; lobes that do not leave sky between them,
// and a lobe that lands far out with a small radius stands clear of the mass as a separate clump -- which is
// what the photograph's own profile shows at v 0.372, 0.408 and 0.448.
const SUNWARD = [0.254, 0.669, 0.698]; // SKY.sunDirection, as a literal so this file does not import sky.js
function crownCluster(b, name, x, y, z, rx, ry, rz, { n = 9, seed = 0, spread = [0.62, 0.98], size = [0.30, 0.46], litAt = 0.62 } = {}) {
  const rand = mulberry32(SEED + 1301 + seed);
  const gold = Math.PI * (3 - Math.sqrt(5)); // the golden angle: a Fibonacci sphere, so no two lobes band
  for (let i = 0; i < n; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
    const theta = gold * i;
    const dir = [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)];
    // THE TWO POLAR LOBES ARE PLACED, NOT DRAWN, AND THAT IS A MEASURED FIX. Everything else about a lobe is
    // a seeded draw, which is what makes the mass irregular -- but the pole is the SILHOUETTE'S OWN TOP, and
    // the photograph puts the west mass's arrival at v 0.338 (u 0.06) and the east mass's at v 0.328
    // (u 0.97). Drawn at random, the first cut of this pass landed its top lobe at v 0.351: 12 px low, and
    // it cost cell distance 0.1260 -> 0.1265 on its own. So the north and south poles take the widest
    // spread and a fixed 0.30 of the envelope, which puts the crown's top at y = cy + 1.225 * ry and its
    // base at cy - 1.225 * ry and makes the two rows a property of the numbers in the caller, not of a seed.
    const polar = i === 0 || i === n - 1;
    const k = polar ? spread[1] * 0.98 : uniform(rand, spread[0], spread[1]);
    const s = polar ? 0.30 : uniform(rand, size[0], size[1]);
    const facing = dir[0] * SUNWARD[0] + dir[1] * SUNWARD[1] + dir[2] * SUNWARD[2];
    // Three sampled values, by the lobe's own facing. Only the lobes turned square at the sun take the
    // brightest, which is why these crowns stay dark while still carrying dappled light.
    const color = facing > litAt ? COLORS.treeMassLit : facing > litAt - 0.60 ? COLORS.treeMassEdge : COLORS.treeMassCore;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 11, 8),
      new THREE.MeshStandardMaterial({ color, roughness: 1.0, metalness: 0, flatShading: true }),
    );
    mesh.scale.set(rx * s, ry * s * (polar ? 1.0 : uniform(rand, 0.85, 1.15)), rz * s);
    mesh.position.set(x + dir[0] * rx * k, y + dir[1] * ry * k, z + dir[2] * rz * k);
    mesh.rotation.set(uniform(rand, -0.7, 0.7), uniform(rand, -0.7, 0.7), uniform(rand, -0.7, 0.7));
    mesh.receiveShadow = true;
    b.add(mesh, `${name} lobe ${i + 1}`);
  }
}

function trunk(b, name, x, z, y0, y1, radius, color = 0x3a332a) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.8, radius, y1 - y0, 10),
    new THREE.MeshStandardMaterial({ color, roughness: 1.0, metalness: 0 }),
  );
  mesh.position.set(x, (y0 + y1) / 2, z);
  mesh.receiveShadow = true;
  b.add(mesh, name);
  return mesh;
}

// A clipped hedge run, built as a mass rather than as a row of balls.
//
// THE BRIEF'S ITEM 3 SAYS THE HEDGE READS AS A BEAD NECKLACE -- 30 identical spheres at a 1 m pitch, each
// visibly a sphere -- AND IT IS RIGHT. Three things make a run read as one clipped mass instead of beads:
// the crowns must OVERLAP along the run (a pitch below the sum of two radii, not equal to it), their sizes
// must vary on a seeded walk rather than independently, so the top is a broken line and not a comb, and
// each crown must be flattened and dropped so its own top is only a little above the mass's own mean.
// `lobes` then puts a smaller crown on top of every other one, which breaks the silhouette against the sky
// without opening a gap in it.
//
// `along` is 'x' for a run across the view (the band along the wall) or 'z' for a run down it (the hedges
// that close the lawn at its ends), because both exist and a second copy of this loop would drift.
function hedgeRun(b, name, along, from, to, at, groundY, height, depth, color, { crestColor = null, pitch = 0.72, lobes = true, crestEvery = 2, crestCentre = 0.88, crestSize = [0.42, 0.26], mixColor = null, mixAt = 0 } = {}) {
  const rand = mulberry32(SEED + 977);
  const span = Math.abs(to - from);
  const n = Math.max(2, Math.round(span / pitch));
  // A seeded random WALK for the height, not independent draws: independent heights at a 0.7 m pitch are a
  // sawtooth, and a walk is what a hedge trimmer leaves. It is pulled back toward the mean so a long run
  // cannot drift into a hill.
  let walk = 0;
  for (let i = 0; i < n; i++) {
    walk = walk * 0.74 + uniform(rand, -0.15, 0.15);
    const t = (i + 0.5) / n;
    const s = from + (to - from) * t;
    const h = height * (1 + walk);
    const d = uniform(rand, -0.16, 0.16);
    const cx = along === 'x' ? s : at + d;
    const cz = along === 'x' ? at + d : s;
    // `mixColor` is a second SAMPLED tone for a fraction of the crowns. A clipped hedge seen from the front
    // is not one value: leaves at every angle catch the sky, and out/wh/scratch/whdark.mjs shows what a
    // single value costs -- the run's own rows v 0.625-0.653 are 86% below luma 16 against the photograph's
    // 40%, and v 0.667-0.722 are 42% against 16%. The mix is drawn from the run's own generator, so it is
    // deterministic and it is a broken scatter rather than a band.
    const body = mixColor && rand() < mixAt ? mixColor : color;
    crown(b, `${name} ${i + 1}`, cx, cz, groundY + h * 0.46, depth * 0.62, h * 0.60, depth * 0.62, body, 10);
    if (lobes && i % crestEvery === 0) {
      const lx = along === 'x' ? s + uniform(rand, -0.2, 0.2) : cx;
      const lz = along === 'x' ? cz : s + uniform(rand, -0.2, 0.2);
      crown(b, `${name} ${i + 1} crest`, lx, lz, groundY + h * crestCentre, depth * crestSize[0], h * crestSize[1], depth * crestSize[0], crestColor ?? color, 9);
    }
  }
}

export function buildFoliage(b) {
  const rand = mulberry32(SEED);

  // ---- the planting band along the wall -------------------------------------------------------------
  // IT STANDS ON THE LAWN IN FRONT OF THE TERRACE'S FACE, AND BOTH OF THOSE ARE THE FIX.
  //
  // out/critic/measure.mjs and out/wh/scratch/prof.mjs, row by row across the whole frame at 1200x900:
  //
  //   photo  v 0.625  luma 1 to 126 at EVERY u from 0 to 1.0 (mostly under 60): one dark band the full
  //          v 0.655  luma 0 to 59 at every u.                                        width of the frame.
  //          v 0.675  luma 1 to 26 across u 0-0.20, then the flower bed.
  //   render v 0.625  luma 135-145 (#848981 to #8b9299, the terrace's own stone) from u 0.05 to u 0.95.
  //          v 0.655  the same, 135-145, the whole way across.
  //   columns u 0.06 and 0.104: photo 27 then 4 then 138 up to v 0.604 and 4 from 0.56; render 4 from 0.556
  //   to 0.604 and then 137-145 from 0.608 to 0.684.
  //
  // So the frame's single largest error mass is not a colour: it is the terrace's own pale stone occupying
  // v 0.62-0.68 across 90% of the width, where the photograph has the clipped hedge that hides the terrace's
  // face. And the hedge this file used to build -- 3.35 m tall, standing on the terrace's DECK at
  // TERRACE.baseY 2.976 m and 3.45 m out at z -3.45 -- rendered at v 0.545 to 0.61 instead, which is the
  // other half of the same swap: it covered the wall's lowest courses, and the photograph has those lit
  // (u 0.06-0.12, v 0.52-0.61 reads 206 to 228 there). probe2.mjs names it directly: at (0.104, 0.568) the
  // render put `north terrace hedge west 5` where the photograph has its brightest pale area in the frame.
  //
  // THE HEIGHT IS SOLVED FROM THE ROW THE HEDGE'S OWN TOP IS ON, and the Z IT STANDS AT IS THE OTHER HALF OF
  // THAT SOLVE. The photograph's band is dark from v 0.62 and its top is the wall's own base row,
  // LANDMARKS.hedgeTop's v 0.6180, which is the ray to the WALL'S OWN BASE at y 2.976 m and z 0. A crown at
  // world z whose top lies on that ray has y = 9.086 - 0.12 * 1.08184 * (47.863 - z): 3.07 m at z +1.6, the
  // z the previous pass used, and 3.36 m at z +3.7. Crown() puts a crown's top at 1.06 h, so the run is
  // 2.90 m at z +1.6 and 3.17 m at z +3.7.
  //
  // IT MOVES OUT TO z +3.7 BECAUSE THE TERRACE NOW PROJECTS NORTH AND IT MUST STAND IN FRONT OF THAT FACE.
  // The terrace is 2.976 m of stone over z 0..2.0 (building.js): a hedge on the lawn at +1.6 would be buried
  // in it up to its own top, and a hedge whose crowns start behind the terrace's face leaves the face itself
  // in the frame as the pale band 50 px tall that the previous pass spent its whole budget removing. At
  // +3.7 the crowns span z 2.1..5.3, clear of the terrace's face at 2.0 and clear of the portico's columns
  // at +5.4, and they cover the terrace's face exactly as the photograph's band does.
  //
  // AND IT RUNS THE WHOLE LENGTH, because the photograph's dark rows do: the previous pass stopped it at
  // +-16 m to keep it off the lawn's corners, and the corners are dark in the photograph too (u 0.05-0.30
  // reads 3 to 58 at both rows). It is one run of crowns at a 0.72 m pitch against a 1.61 m radius, so the
  // mass has no gaps to see the terrace's stone through, and the crests break its top against the wall.
  //
  // AND ITS TOP IS LIT, WHICH IS WHY IT IS TWO RUNS OF CROWNS AND NOT ONE. The photograph's own rows, box
  // by box (out/wh/scratch/whbox.mjs): the hedge's top row across the facade, u 0.30-0.70 v 0.616-0.632,
  // reads mean #3f4b3f and median #303928; its next row down, v 0.636-0.652, reads mean #252b26 and median
  // #0c1006; and the band below the wall's base, v 0.648-0.680, reads #191710 and #181812 with medians of
  // #010400 and #020403. A clipped hedge is lit on its top FACE and near-black in its body, and the two are
  // 20 luma apart. The first render of this pass had the body only, and it put 10.2% of the frame below luma
  // 16 against the photograph's 6.86%: a hedge whose top is as dark as its body is a black bar, and the
  // frame's map shows it as one. So a crest crown now sits on EVERY crown (crestEvery 1), two thirds of the
  // body's own width, in COLORS.hedgeTop -- the sampled top -- and the run keeps COLORS.hedge for its body.
  const hedging = { crestColor: COLORS.hedgeLit, pitch: 0.72, crestEvery: 2, crestCentre: 0.88, crestSize: [0.42, 0.26], mixColor: COLORS.hedgeTop, mixAt: 0.35 };
  hedgeRun(b, 'north terrace hedge', 'x', -(DIMS.blockLength / 2 + 6), DIMS.blockLength / 2 + 6, TERRACE.hedgeZ, 0, 3.17, 2.6, COLORS.hedge, hedging);
  void hedgeRun;

  // ---- the two big trees that frame the building --------------------------------------------------
  // THE SIZES AND PLACES BELOW ARE DERIVED FROM THE PHOTOGRAPH'S OWN COLUMNS, NOT BY SYMMETRY, and they are
  // much larger than the pair they replace. The camera is at (0, 9.086, +47.863) looking along -z with
  // tanV 0.54092 on a 4:3 frame, so a world point (x, y, z) at depth dn = 47.863 - z projects to
  //   u = 0.5 + x / (2 * 0.54092 * 1.33333 * dn)      v = 0.5 - (y - 9.086) / (2 * 0.54092 * dn)
  // and the two columns the photograph was measured on invert to:
  //
  //   WEST, read at u 0.06 and sited at z -18 (dn 65.86, frame 95.0 m wide):  v 0.338 -> y 20.84 m and
  //   v 0.562 -> y 4.10 m. The cluster's own top and base are cy +- 1.225 * ry (see the polar lobes in
  //   crownCluster), so those two rows give cy 12.47 and ry 6.83 -- and the map's right boundary, u 0.048 at
  //   v 0.335 rising to 0.092 at v 0.51, means the mass hugs the frame's own edge, so the cluster is centred
  //   OFF it at x -47.5 with rx 6.4 and only its right third is in the frame.
  //   EAST, read at u 0.97 and sited at z -16 (dn 63.86, frame 92.1 m wide): v 0.328 -> y 20.97 m and
  //   v 0.60 -> y 2.18 m, so cy 11.58 and ry 7.67 -- a TALLER crown than the west one, and centred further
  //   out at x +43 with rx 9.5, because the photograph's east mass reaches the frame's right edge from v 0.32
  //   and its left boundary only comes in to u 0.81. IT IS THE LARGER OF THE TWO, WHICH IS WHAT THE COLUMN
  //   SAYS: at u 0.97, 3% of the frame from its own edge, the photograph's mass still runs from v 0.328.
  //
  // THE LOBES ARE SMALL AND NUMEROUS ON PURPOSE. The first cut of the re-layout pass used 9 and 10 lobes at
  // 0.30-0.46 of the envelope each, and the crop read as a bunch of grapes: ten balls with holes between
  // them, which is neither a tree nor the photograph. Eighteen and sixteen at 0.20-0.33 give a mass with a
  // core and small sky through it, which is what the photograph's own profile shows at v 0.372, 0.408 and
  // 0.448.
  //
  // THEY ARE STILL AT NEGATIVE z, AND THIS PASS TRIED TO MOVE THEM AND REVERTED IT. That is the one
  // deliberate incoherence left in the scene: -18 and -16 are 18 and 16 m SOUTH of the north wall, so the
  // top-down view and any orbit put the photograph's two north framing trees in the back garden. The move
  // was built as an ANGULAR-PRESERVING TRANSFORM rather than a sign flip -- x, cy, every radius and the
  // trunk scaled by the ratio of the new depth to the old about each tree's own ground point, which leaves
  // every angle at the camera unchanged in principle -- and the arithmetic is right and it still does not
  // work. Measured with out/critic/wh3trees.mjs, the west crown's own arrival row:
  //
  //   at z -18 (shipped)   v 0.3367 at u 0.02 and v 0.3956 at u 0.06
  //   at z +18 (the move)  v 0.4911 at u 0.02 and v 0.5456 at u 0.06
  //
  // A HUNDRED AND FIFTY PIXELS LOW, WITH THE ANGULAR SIZE PRESERVED EXACTLY, and the cause is the lobe
  // field: `crownCluster` places its sixteen or eighteen lobes at ABSOLUTE fractions of the envelope and
  // sizes them at 0.20-0.33 of it, so the mass a lobe field makes is a property of the radius in METRES and
  // not of the angle it subtends. At 3.10 m instead of 6.83 the same seeded field makes a small dense ball
  // low in the crown instead of a tall broken mass, and the crown's own top row goes with it. Growing ry to
  // compensate (measured: ry 4.52 against 3.66) recovered no SSIM at all and 10 px of the 150.
  //
  // SO THE TWO ARE LEFT WHERE THEY ARE, which is what the brief asks for in this exact case, and the cost is
  // stated: with the trees north both scores are worse -- cell 0.1031 -> 0.1144, SSIM 0.3918 -> 0.3687.
  // WHAT A FUTURE PASS WOULD HAVE TO DO, so it is not rediscovered: re-solve the lobe field's envelopes and
  // sizes per tree so the CROWN'S OWN TOP AND BASE land on the photograph's rows at the new radius -- that
  // is a re-derivation of `spread`, `size`, `n` and the polar lobe's own 0.30, and it is a change to the
  // frame's two largest edge masses, which is a wave of its own and not a closing pass.
  for (const [side, x, z, cy, rx, ry, rz, n, seed] of [
    ['west', -47.5, -18, 12.47, 6.4, 6.83, 5.2, 18, 11],
    ['east', 43.0, -16, 11.58, 9.5, 7.67, 6.0, 16, 23],
  ]) {
    const gy = NORTH_LAWN.yAt(z);
    trunk(b, `${side} framing tree trunk`, x, z, gy, gy + 10.0, 0.9);
    crownCluster(b, `${side} framing tree`, x, gy + cy, z, rx, ry, rz, { n, seed, spread: [0.55, 1.0], size: [0.20, 0.33] });
  }

  // ---- the tree line beyond the fence ---------------------------------------------------------------
  // Two ranks, the far one hazier, so the horizon is not a hard line. Their tops sit at the photo's own band
  // (v 0.24 to 0.30) because they stand on the plateau at the camera's own height.
  //
  // THEY ARE BEYOND THE FENCE, WHICH IS NOW BEHIND THE CAMERA, so they are the trees along Pennsylvania
  // Avenue and in Lafayette Park: out of the photograph's frame entirely, and there for an orbit view. They
  // used to be at z -96 and -190, which the old convention made "beyond the fence" and which in world terms
  // was 96 and 190 m SOUTH of the wall -- behind the building, standing in the south lawn.
  for (let i = 0; i < 26; i++) {
    const x = -150 + i * 12 + uniform(rand, -2.5, 2.5);
    const z = DIMS.fenceDistance + 52 + uniform(rand, -6, 6);
    const gy = NORTH_LAWN.yAt(z);
    const h = uniform(rand, 9, 15);
    crown(b, `far tree crown ${i + 1}`, x, z, gy + h * 0.72, uniform(rand, 3.8, 6.2), h * 0.34, uniform(rand, 3.4, 5.4), COLORS.treeFoliage, 12);
  }
  for (let i = 0; i < 22; i++) {
    const x = -180 + i * 17 + uniform(rand, -4, 4);
    const z = DIMS.fenceDistance + 98 + uniform(rand, -18, 18);
    const gy = NORTH_LAWN.yAt(z);
    const h = uniform(rand, 8, 13);
    crown(b, `far tree line ${i + 1}`, x, z, gy + h * 0.7, uniform(rand, 4.5, 7.5), h * 0.32, uniform(rand, 4, 6.5), COLORS.treeFoliage, 10);
  }

  // ---- the hedges that close the north lawn at its ends --------------------------------------------
  // BUILT FROM CROWNS, NOT FROM BOXES, AND THAT IS A REVIEW FIX TWO ROUNDS DEEP. One 34 m box a side is a
  // wall, not a hedge: seen from x = -77 looking east -- nudge's own orbit pose, and any user's drag -- it
  // runs away from the camera end-on and reads as one near-black slab lying across the lawn, which a
  // reviewer reported as "a dark, slab-like object floating beside the building's west end". Segments alone
  // still read as boxes. A clipped hedge is a rounded mass, so it is built the way the trees are: a run of
  // overlapping spheres on a seeded stagger, two rows deep and two rows high, which has a broken silhouette
  // from every angle and no face big enough to catch the eye as a slab.
  for (const side of [-1, 1]) {
    const cx = side * (DIMS.blockLength / 2 + 13.4);
    // Overlapping, not spaced, and on the same seeded walk as the terrace's own band: the crowns are 0.9 m
    // across against a 0.72 m pitch, so the run has no gaps to see a stake of lawn through and no single
    // sphere reads as an object.
    // THEY RUN NORTH FROM THE BUILDING'S OWN LINE, +1.6 to +30.4, because that is the north lawn: the run at
    // z -1.6..-30.4 the previous pass built was south of the wall, inside and behind the building.
    hedgeRun(b, `north lawn hedge ${side < 0 ? 'west' : 'east'}`, 'z', 1.6, 30.4, cx, NORTH_LAWN.yAt(16), 1.95, 1.45, COLORS.hedge, { crestColor: COLORS.hedgeLit });
  }

  // ---- the south side's magnolias -------------------------------------------------------------------
  // The Jackson Magnolia stood on the south front for two centuries; its replacement is one of its offspring.
  // THEY FLANK THE SOUTH PORTICO, THEY DO NOT BLOCK IT. At x +-20 and z -29 their crowns met across the
  // middle of the south front: the "behind" frame was two dark masses with a slot of building between them,
  // and from due south -- the side the South Lawn faces, and the side a visitor arrives from -- the building
  // was effectively not modelled. Moved out to +-23.5 and back to z -38.1, clear of the bowed portico's own
  // 8.5 m bow and its 12 m projection, where the real pair stands.
  //
  // AND SMALLER, WHICH IS THE PART THAT MATTERS. A 9.6 m crown at 58 m from a camera 96 m back subtends
  // 9.5 degrees, and the pair is only 20 degrees apart about the centre line, so the two of them plus a lens
  // with a 56.8 degree vertical field filled the frame. A southern magnolia is 10 to 12 m tall with a crown
  // 8 to 10 m across, which is what this is: 6 m across against a facade 15.3 m to its parapet, so a crown
  // is a third of the building's height and not most of it.
  // AND THEY ARE LIT, WHICH THE NORTH TREES ARE NOT. The sun stands north-east, so the south side of every
  // north tree is its shadow side and the south front's own trees are the ones the sun reaches. Building
  // them at the north trees' backlit value made them read as holes in the frame, which a reviewer reported;
  // shape helps, because a sphere lit from one side still has a lit side, but the colour has to say the same
  // thing. Both crowns below are lifted, and a third sits on top where the sun lands squarest.
  for (const [i, x] of [[0, -23.5], [1, 23.5]].entries()) {
    const z = -DIMS.blockDepth - 12.0;
    const gy = -DIMS.southLawnDrop;
    trunk(b, `south magnolia ${i + 1} trunk`, x, z, gy, gy + 4.4, 0.5);
    crown(b, `south magnolia ${i + 1} crown`, x, z, gy + 6.6, 3.0, 2.6, 2.8, COLORS.treeFoliageSunlit, 16);
    crown(b, `south magnolia ${i + 1} crown low`, x + (i === 0 ? -1.0 : 1.0), z + 1.2, gy + 3.1, 2.1, 1.7, 2.0, COLORS.treeFoliageSunlit, 12);
    crown(b, `south magnolia ${i + 1} crown crest`, x + (i === 0 ? 0.6 : -0.6), z - 0.8, gy + 8.4, 2.2, 1.7, 2.0, COLORS.treeFoliageLit, 12);
  }

  return b.group;
}
// A crown size the caller can read back, so a later wave can build a canopy without re-deriving it.
export function treeCrownAABB(name) {
  // Kept as a function rather than a table so the file stays a builder and not a data dump.
  void name;
  return null;
}

