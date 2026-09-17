// The distant layers: the mountains as planes fading with distance, the forested hill as a surface with
// a tree-clump texture, the roofs of farther houses below the hill as gabled houses, the ground they
// stand on, the machiya row that lines the far street, and the corner house at the bend (still
// block-out). The sky dome is src/sky.js.
import * as THREE from 'three';
import * as L from './layout.js';
import { instanced, surface, panTileGeometry, eaveCapGeometry, ridgeTileGeometry } from './instancing.js';
import { makeMaterial, albedoOf } from './materials.js';
import { makeHillTexture, noise2D } from './textures.js';
import { buildSky } from './sky.js';
import { mulberry32, jitter } from './random.js';
import { tileRoof } from './roofs.js';
import { darker, scaleHex } from './paving.js';

const C = L.COLORS;

// The photo's own skyline, re-read column by column in iteration 4 (out/scratch/skyline.mjs: the first
// row in each column that falls 28 levels of luma below the sky above it, which is the top of the
// tallest tree there). It reads v 0.158 at u 0.630, 0.116 at 0.716, 0.104 at 0.745 and 0.089 at 0.774,
// where the old polyline gave 0.145, 0.102, 0.095 and 0.089 -- about 0.013 of frame too high over
// u 0.60 to 0.75. Columns at u <= 0.60 read the cherry and the evergreens rather than the hill and are
// carried smoothly; columns at u >= 0.80 read the right house's roof (their sky reference drops to
// luma 177 there) and are left where they were.
// `mountains` reads it too: every card's top edge is tucked under it, so none of them ends in mid-sky.
//
// PAST u 1.05 THE POLYLINE IS NOT THE PHOTO'S, because the photo does not have one there: the frame stops
// at u 1.0 and the right machiya covers the hill from u 0.85. It ran straight from (0.95, 0.075) to
// (1.6, 0.07), which is 0.6 of a frame width — about 380 m of skyline — as one ruled line, and that is the
// hard straight silhouette every sweep review since iteration 2 has named. The four points added beyond
// 1.05 are secondary summits. They only ever RAISE the line (smaller v), which widens the gap the mountain
// cards are hidden in rather than narrowing it, and the lowest of them is v 0.042 against `vTop` 0.03, so
// the texture's top row still sits above the mesh.
const HILL_RIDGE_LINE = [[-3.0, 0.94], [-1.4, 0.47], [-0.5, 0.375], [0.05, 0.345], [0.27, 0.305], [0.36, 0.285], [0.48, 0.225], [0.6, 0.172], [0.72, 0.115], [0.78, 0.092], [0.82, 0.08], [0.95, 0.075], [1.05, 0.070], [1.18, 0.045], [1.30, 0.064], [1.42, 0.042], [1.6, 0.058]];

function ridgeVAt(u) {
  const ridge = HILL_RIDGE_LINE;
  if (u <= ridge[0][0]) return ridge[0][1];
  for (let i = 1; i < ridge.length; i++) {
    if (u <= ridge[i][0]) {
      const [u0, v0] = ridge[i - 1];
      const [u1, v1] = ridge[i];
      return v0 + ((v1 - v0) * (u - u0)) / (u1 - u0);
    }
  }
  return ridge[ridge.length - 1][1];
}

export function buildBackground(b) {
  buildSky(b);
  mountains(b);
  hill(b);
  farGround(b);
  farHouses(b);
  farMachiyaRow(b);
  bend(b);
}

// Hazy mountains as three planes facing the photo camera, farther ones paler: a pale far ridge whose
// tops sit at v 0.25, the blue range below it from v 0.27, and the dull-green near ridge in front.
//
// Their left ends run out to u = -2.4 rather than -0.6. Nothing there is inside the photo frame (u runs
// 0 to 1), so the scored view cannot see the difference; `npm run views` pose 3 can, and what it showed
// was the three cards' left edges stacked in the sky as a green, blue and white band with hard straight
// ends, which reads as a mistake rather than as a mountain.
//
// Their RIGHT ends used to stop dead at u 0.5-0.6 with a vertical cut, for the same reason and with the
// same result: pose 3 showed three flat strips ending in mid-sky, and iteration 2's note that "a card
// carried further right would put mountain into that sky" is only true of a card carried STRAIGHT. Each
// one now runs on to u 1.55 with its top edge well under the hill's own skyline, so from the photo camera
// the hill covers every metre of it and from an orbit the ranges carry on behind the hill instead of
// stopping. 1.55 and not further: the HILL stops at u 1.6, and a card carried past that is a card with
// nothing in front of it — pose 2 showed exactly that as a pale mint slab standing in the sky, and
// out/scratch/posefind.mjs named it `near ridge` at 1.6 km.
//
// WHAT ACTUALLY KEEPS THEM HIDDEN IS THE GAP, NOT THE `margin` BELOW, and `out/scratch/cardgap.mjs` is the
// probe that says so without a browser. The `Math.max` clamp fires ZERO times on all 24 shipped points:
// each card's own sinking line is always the larger value, so the margins are a guard for a ridge line
// somebody later lowers and nothing shipped depends on them. They are ordered so the farthest card, which
// needs the most, gets the most; an earlier version had that exactly backwards.
//
// THE HILL'S OPAQUE LINE IS NOT ITS POLYLINE, and that is the whole difficulty. The polyline is the top of
// the TALLEST trees and `makeHillTexture` cuts the strip below it into crowns and gaps, so a card edge
// inside the strip shows through: a column is opaque only from `ridgeVAt + TREE_RISE * (1 - canopyAt)`
// down. At u 0.68, the tightest of the 24, that is v 0.13959 against the polyline's 0.13400, and the gap
// to `mountains farthest`'s own 0.27433 is **0.1347 of frame** — against the 0.045 to 0.085 the clamp
// names. `mountains blue` clears by 0.1531 there and `near ridge` by 0.1924. Two probes, one per party,
// each measured a different wrong line (0.140 off the polyline, 0.125 off the whole strip) and disagreed
// by 0.015 because of it; `cardgap.mjs` evaluates `canopyAt` and settles it.
//
// The bound is the CAMERA's height, and it is NOT a guarantee for every camera a user can reach. A rise of
// dy shifts the hill by dy/d_hill radians and a card by dy/d_card, and the frame spans 60 degrees over its
// height, so 0.955 of frame per radian; `d_hill` is the depth of the opaque row, 481 m, not the ridge's
// 500. The worst sweep pose is 6, 21.2 m above the photo camera: 0.030 of frame against a 0.1347 gap. But
// `controls.maxDistance` is 120 m FROM THE ORBIT TARGET and that target sits at y 0.751, so a drag can put
// the eye 115.95 m above the photo camera — and the gaps are used up at **89.3 m** for `mountains
// farthest`, **113.5 m** for `mountains blue` and 208.1 m for `near ridge`. TWO of the three are
// reachable, the second by 2.4 m. Closing that would mean pushing the ranges below the hill's own foot.
//
// The bottoms run to v 0.9 rather than v 0.4. At v 0.4 they are horizontal edges sitting in the sky, and
// pose 6 showed exactly that: hard straight lines across the background under each band.
//
// Each card takes a gradient rather than one colour, because that is what "receding in haze" is: the
// range's own tone at its top, fading toward the horizon's warm pale at its foot.
function mountains(b) {
  // The right-hand continuation of a card's top edge: the range carries on, sinking gently toward the
  // horizon with a low wobble over it, and is held at or below the hill's own skyline (`ridgeVAt` plus a
  // margin, v downward, so "below" is the larger number) wherever the hill would otherwise not cover it.
  // The hill climbs steeply to the right, so the clamp never fires on the shipped polylines — it is a
  // guard, and the header above says what the real clearance is.
  const carryRight = (fromU, fromV, margin, seed) => {
    const out = [];
    for (let u = fromU + 0.12; u <= 1.5501; u += 0.12) {
      const own = fromV + 0.013 * (u - fromU) + 0.006 * Math.sin(u * 5.3 + seed) + 0.004 * Math.sin(u * 11.7 + seed * 2);
      out.push([u, Math.max(own, ridgeVAt(u) + margin)]);
    }
    return out;
  };
  // The LEFT-hand continuation, and it exists for the same reason `carryRight` does. Iteration 2 pushed
  // these ends out from u -0.6 to -2.4 because pose 3 showed them stacked in the sky as a green, blue and
  // white band with hard straight ends — but pushing a hard end further left only moves it, and the band
  // was still there at -2.4 with the hill's top 0.27 of frame below the card. Iteration 4's fix for the
  // hill's own left cut made that worse before this: dropping the hill's ridge to v 0.94 at u -3.0 widened
  // the open sky above it at u -2.4 from 0.271 to 0.484 of frame. So each card's top edge now SINKS to
  // meet its own bottom instead of stopping: quadratic, so it holds its line over most of the run and
  // dives at the end, which is a range going down behind the valley rather than a card being cut off.
  const carryLeft = (toU, toV, seed) => {
    const out = [];
    for (let u = -2.4; u < toU - 0.001; u += 0.18) {
      const t = (toU - u) / (toU + 2.4);
      out.push([u, Math.min(0.885, toV + (0.88 - toV) * t * t + 0.008 * Math.sin(u * 3.1 + seed))]);
    }
    return out;
  };
  // A card's colour at a photo position: its own tone at `vTop`, hazing toward the horizon by `vHaze`.
  const haze = (hex, hazeHex, vTop, vHaze) => (u, v) => {
    const t = Math.max(0, Math.min(1, (v - vTop) / (vHaze - vTop)));
    const a = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
    const c = [(hazeHex >> 16) & 255, (hazeHex >> 8) & 255, hazeHex & 255];
    const m = a.map((x, i) => Math.round(x + (c[i] - x) * t));
    return (m[0] << 16) | (m[1] << 8) | m[2];
  };
  b.frontalCard(
    'mountains farthest',
    [...carryLeft(-0.6, 0.27, 0.7), [-0.6, 0.27], [0.08, 0.262], [0.18, 0.248], [0.26, 0.243], [0.33, 0.25], [0.4, 0.258], [0.47, 0.27], [0.56, 0.278], ...carryRight(0.56, 0.278, 0.085, 0.7), [1.55, 0.9], [-2.4, 0.9]],
    L.DEPTHS.mountains[1],
    haze(C.mountainFarthest, C.fog, 0.25, 0.44),
  );
  b.frontalCard(
    'mountains blue',
    [...carryLeft(-0.6, 0.29, 2.1), [-0.6, 0.29], [0.1, 0.283], [0.17, 0.272], [0.23, 0.268], [0.29, 0.276], [0.35, 0.27], [0.41, 0.278], [0.48, 0.29], [0.56, 0.296], ...carryRight(0.56, 0.296, 0.065, 2.1), [1.55, 0.9], [-2.4, 0.9]],
    L.DEPTHS.mountains[0],
    haze(C.mountainBlue, C.fog, 0.27, 0.46),
  );
  b.frontalCard(
    'near ridge',
    [...carryLeft(-0.6, 0.325, 3.9), [-0.6, 0.325], [0.1, 0.32], [0.18, 0.305], [0.24, 0.285], [0.3, 0.295], [0.36, 0.283], [0.42, 0.29], [0.5, 0.32], [0.56, 0.325], ...carryRight(0.56, 0.325, 0.045, 3.9), [1.55, 0.9], [-2.4, 0.9]],
    L.DEPTHS.nearRidge,
    haze(C.nearRidge, C.fog, 0.30, 0.48),
  );
}

// The forested hill filling the upper right: a surface whose top edge follows the plan's ridge points and
// which leans back with depth (nearer at its foot), textured with tree clumps over the photo's gradient
// (warm haze near the ridge under the sun glare, darker green lower down). UV v is the photo row, which
// the texture's rows follow, so every row's mean is the sampled color at that row.
function hill(b) {
  const ridge = HILL_RIDGE_LINE;
  const stops = [[0.075, C.hillRidge], [0.14, C.hillHaze], [0.2, C.hillMid], [0.32, C.hillDeep]];
  const vBottom = 0.95;
  // vTop is the texture's own top row and has to sit above the highest point of the MESH, which is the
  // ridge's own highest point (v 0.07 at u 1.6).
  const vTop = 0.03;
  // The crown strip: the ridge polyline is the top of the TALLEST trees, and the texture's alpha cuts
  // this much of frame below it into crowns and gaps (see makeHillTexture). 0.015 of frame at 500 m is
  // about 8 m of tree.
  const TREE_RISE = 0.015;
  const columns = 420;
  // The rows the mesh has always had, as fractions of each column's own ridge-to-foot height.
  const BASE_ROWS = 12;
  // How many sub-rows each band from `SUBDIVIDE_FROM` down is cut into, and where that starts.
  //
  // WHY NOT JUST 30 EVEN ROWS. The relief below needs rows to carry it — at 12 a band is 0.073 of frame,
  // 46 m at this depth, and a spur 100 m across came out as two facets. But `rows` is not free in the
  // scored frame even where the geometry does not move: UV interpolation inside a triangle is
  // perspective-correct, and this surface's depth changes 200 m from ridge to foot, so a coarser row makes
  // the rendered texture row drift from the photo row it is meant to be. 30 EVEN rows measured
  // **+0.0343 at the hill cell (0.771, 0.159) and +0.029 over the four blossom cells at v 0.205**, on a
  // tree where every one of those cells has relief ramp exactly 0 — the tessellation alone. So the
  // original twelve row positions are kept to the bit and the extra rows are inserted only BELOW them:
  // the deepest scored cell at v <= 0.25 is t = 0.165 (a blossom cell at (0.729, 0.250)) and this starts
  // at t = 0.25. That is NOT the deepest cell the hill reaches — see `reliefRamp` below and `hillBody` in
  // src/layout.js — so this boundary protects the rows near the ridge and nothing further down.
  const SUBDIVIDE_FROM = 3; // band index, so t >= 0.25
  const SUBDIVIDE = 3;
  const rowV = [];
  for (let j = 0; j < BASE_ROWS; j++) {
    const k = j >= SUBDIVIDE_FROM ? SUBDIVIDE : 1;
    for (let s = 0; s < k; s++) rowV.push((j + s / k) / BASE_ROWS);
  }
  rowV.push(1);
  const rows = rowV.length - 1;
  const ridgeV = ridgeVAt;
  const depthAt = (v) => L.DEPTHS.hill - ((v - 0.07) / 0.73) * 200;
  // THE ONE AXIS THE PHOTO CANNOT SEE. Every vertex of this mesh is placed by `uvToWorld(u, v, depth)`,
  // so moving a vertex in DEPTH slides it along its own ray through the photo camera and leaves its photo
  // position exactly where it was. That is what lets the hill get spurs and gullies without touching the
  // scored frame: the silhouette, the skyline and the texture mapping are all functions of (u, v).
  // (Not bit-identical: UV interpolation inside a triangle is perspective-correct, so a vertex that moves
  // in depth shifts the texture inside its own triangle. WHAT PROTECTS THE CELLS NEAR THE RIDGE IS NOT
  // THAT THE SHIFT IS SMALL — it is that the relief is exactly 0 at BOTH vertices of every triangle they
  // fall in, so there is no shift at all there. An earlier version of this comment bounded the shift by a
  // COLUMN's 0.011 of frame; the depth changes along the ROW edge, not the column edge, and a row near the
  // ridge is about five times wider in frame than a column, so that bound was taken from the wrong edge.
  // Lower down the shift is real and is not separated from the two direct terms — see `hillBody` in
  // src/layout.js for the eleven cells that see this mesh displaced.)
  //
  // The ramp is 0 at the ridge line and 0 again at the foot, and both ends are load-bearing. At the ridge
  // the polyline IS the photo's own skyline (re-read column by column in iteration 4) and must not move
  // for an orbit either. At the foot the hill meets `outer ground`: the hill's own foot at v 0.95 sits at
  // y -184 m and that surface is at about -177 m there, so pulling the foot 80 m NEARER would raise it
  // through the valley floor.
  //
  // `t` is the column's OWN height, ridge to foot, not a distance in frame. A fixed 0.09 of frame was the
  // first version and it cost **+0.0519 over the seven cells at v 0.205**: the hill's skyline is at v 0.10
  // where the photo frame is and at v 0.94 at the left end, so one frame-distance ramp is a third of the
  // way down the hill in the photo and past its foot in the sweep. Normalised, relief starts a quarter of
  // the way down every column, which is v 0.31 at u 0.77 and v 0.59 at u -1.4.
  //
  // THAT DOES NOT KEEP THE SCORED CELLS OUT OF IT, and this comment claimed it did. The cherry's cards are
  // alpha-tested: 391 of the 528 cell rays reach this mesh and 33 have nothing OPAQUE in front, of which
  // **11 land on a face this ramp has displaced**. The deepest is (0.688, 0.432) at t = 0.368, where the
  // ramp is 0.88 — past the 0.25 gate, not the t = 0.165 an earlier version quoted (that is the deepest
  // cell whose FIRST hit is hill-or-blossom-over-hill at v <= 0.25, which is a different question).
  // See the note on `hillBody` in src/layout.js for the measurement and for what it means for `RELIEF`.
  const reliefNoise = noise2D(9137);
  const RELIEF = 46; // metres of depth at the largest octave; the sum reaches about 1.8x it
  const smooth = (t) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c); };
  const reliefRamp = (u, v) => {
    const t = (v - ridgeV(u)) / Math.max(0.05, vBottom - ridgeV(u));
    return smooth((t - 0.25) / 0.15) * (1 - smooth((t - 0.80) / 0.18));
  };
  const reliefAt = (u, v) =>
    reliefRamp(u, v) *
    RELIEF *
    ((reliefNoise(u * 3.1 + 11, v * 2.2) - 0.5) +
      (reliefNoise(u * 9.4 + 3, v * 5.1 + 7) - 0.5) * 0.55 +
      (reliefNoise(u * 23 + 5, v * 11 + 2) - 0.5) * 0.25);
  const positions = [];
  // The same surface with the relief taken out, built only so `hillShading` can subtract its normals.
  const flat = [];
  // How far down its own column each vertex is, 0 until a quarter of the way and 1 by 55%: the same gate
  // the relief uses, so the body tone below cannot reach a scored cell either.
  const down = [];
  const uvs = [];
  const u0 = ridge[0][0];
  const u1 = ridge[ridge.length - 1][0];
  for (let i = 0; i <= columns; i++) {
    const u = u0 + ((u1 - u0) * i) / columns;
    const top = ridgeV(u);
    for (let j = 0; j <= rows; j++) {
      const v = top + (vBottom - top) * rowV[j];
      const base = depthAt(v);
      const p = L.uvToWorld(u, v, base + reliefAt(u, v));
      const q = L.uvToWorld(u, v, base);
      positions.push(p.x, p.y, p.z);
      flat.push(q.x, q.y, q.z);
      down.push(smooth(((v - top) / Math.max(0.05, vBottom - top) - 0.25) / 0.30));
      uvs.push(i / columns, 1 - (v - vTop) / (vBottom - vTop));
    }
  }
  const index = [];
  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < rows; j++) {
      const a = i * (rows + 1) + j;
      const c = a + rows + 1;
      index.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const flatGeo = new THREE.BufferGeometry();
  flatGeo.setAttribute('position', new THREE.Float32BufferAttribute(flat, 3));
  flatGeo.setIndex(index);
  flatGeo.computeVertexNormals();
  geo.setAttribute('color', new THREE.Float32BufferAttribute(hillShading(geo.attributes.normal.array, flatGeo.attributes.normal.array, positions, down), 3));
  flatGeo.dispose();
  // The glare's centre and width are in the texture's own u, which spans photo u0 to u1.
  const map = makeHillTexture({
    size: 4096,
    seed: 7,
    stops,
    vTop,
    vBottom,
    sunU: (L.SUN.u - u0) / (u1 - u0),
    // 0.055 of frame, not 0.085. Measured on the shipped tree the old width left g = 0.19 at photo
    // u 0.729 and 0.10 at 0.771, which is where the photo's hill is a grey-green #5b5f60: those cells
    // rendered #d2c3ac and #7d6f61 against #9f9d96 and #5e6663, too warm and too light. At 0.055 the
    // glare is 0.02 by u 0.729 and still 0.80 at u 0.646, which is the photo's own warm band.
    glareWidth: 0.055 / (u1 - u0),
    ridgeAt: ridgeV,
    treeRise: TREE_RISE,
    u0,
    u1,
  });
  // alphaTest, not transparent: the crowns above the ridge are a cut-out, and a transparent material here
  // would sort against the sky dome and the mountain cards instead of writing depth like the hill it is.
  b.add(new THREE.Mesh(geo, makeMaterial({ map, mean: map.userData.mean, side: THREE.DoubleSide, fog: false, unlit: true, alphaTest: 0.5, vertexColors: true })), 'hill');
}

// What the relief above is FOR. The hill is unlit and its texture is a function of (u, v) alone, so
// displacing vertices in depth alone would change nothing but the silhouette: a bumpy unlit surface reads
// exactly as flat as a flat one. This bakes two multipliers into the vertex colours.
//
// SHADE. The sun sits at photo (0.62, 0.12), which from the photo camera is direction
// (0.137, 0.184, -0.973): the hill is backlit, every camera-facing facet has n . sun near -0.95, and a
// spur that turns away catches more. The term is the facet's dot MINUS the same vertex's dot on the
// un-displaced surface, so the hill stays as dark as the photo says it is while the spurs and gullies
// model themselves, and a vertex with no relief is left alone to the bit. A second, smaller term does the
// same for the sky: a facet lying back catches more of it than one standing up.
//
// HAZE, and this is the one that changes pose 2. The hill runs from photo u -3.0 to 1.6, which is 4.6
// frame widths: the part the SCORED frame sees is 490 to 642 m away, and the left end the orbit sweep
// sees is 1200 m. One flat `hillDeep` covered the lot, which is why every sweep review since iteration 2
// has called it a dark speckled slab. The mix toward the fog colour is a function of the point's distance
// from the PHOTO CAMERA, not from the pose being rendered: the hill is half a kilometre out and the
// orbit's own `controls.maxDistance` is 120 m, so that distance is the same to within a tenth of the ramp
// from every pose a user can reach.
//
// ITS GATE IS DISTANCE ALONE — it does NOT take `down[]`, and a devlog line saying haze and the body tone
// were "both gated on the same quarter-of-a-column line" was wrong about this half. What keeps it out of
// the scored frame is the 700 m start against a measured maximum of **642.4 m** over any vertex of any
// hill triangle that overlaps the photo frame (638.7 m for vertices strictly inside it), at u 0.998,
// v 0.073 — 58 m of margin. An earlier version of this line said 620 m at u 1.0, v 0.114, which is 19 m
// low and at the wrong point. Measured by an independent critic, out/scratch/critic/hillreach.mjs.
//
// The multiplier is computed as (the displayed colour wanted) / hillDeep per channel, which is exact
// where the texel IS hillDeep — the whole hill away from the sun's own column — and close elsewhere.
function hillShading(normal, flatNormal, positions, down) {
  const n = positions.length / 3;
  const sunPoint = L.uvToWorld(L.SUN.u, L.SUN.v, 100);
  const eye = L.CAMERA.eye;
  const sun = [sunPoint.x - eye.x, sunPoint.y - eye.y, sunPoint.z - eye.z];
  const sunLen = Math.hypot(...sun);
  sun.forEach((_, i) => { sun[i] /= sunLen; });
  // THE BASELINE IS THE SAME SURFACE WITH THE RELIEF TAKEN OUT, vertex by vertex, and it has to be:
  // the shade is a DIFFERENCE from it, so where the relief ramp is zero the difference is exactly zero
  // and the scored cells cannot move. Two weaker baselines were measured first. A mesh-wide mean shifts
  // every row near the ridge, which is the only part the photo frame sees. A PER-ROW mean is not zero
  // either, because a row of this mesh is not a line of constant v — it runs at a fixed fraction of each
  // column's own ridge-to-foot height and so follows the skyline's shape — and it left the hill cell
  // (0.771, 0.159) 0.0343 worse and the four blossom cells at v 0.205 0.029 worse with the relief ramp
  // at 0 under every one of them.
  const dots = new Float32Array(n);
  const ups = new Float32Array(n);
  const dot = (a, i) => {
    const nz = a[i * 3 + 2];
    // The mesh is DoubleSide and `computeVertexNormals` can hand back either face, so take the side that
    // points at the camera: the hill is a surface, not a solid, and a flipped normal would invert a spur.
    const flip = nz < 0 ? -1 : 1;
    return [flip * (a[i * 3] * sun[0] + a[i * 3 + 1] * sun[1] + nz * sun[2]), flip * a[i * 3 + 1]];
  };
  for (let i = 0; i < n; i++) {
    const [d, up] = dot(normal, i);
    const [d0, up0] = dot(flatNormal, i);
    dots[i] = d - d0;
    ups[i] = up - up0;
  }
  const deep = [(C.hillDeep >> 16) & 255, (C.hillDeep >> 8) & 255, C.hillDeep & 255];
  const body = [(C.hillBody >> 16) & 255, (C.hillBody >> 8) & 255, C.hillBody & 255];
  const fog = [(C.fog >> 16) & 255, (C.fog >> 8) & 255, C.fog & 255];
  const colors = new Array(n * 3);
  for (let i = 0; i < n; i++) {
    const shade = Math.max(0.45, Math.min(2.1, 1 + 1.15 * dots[i] + 0.5 * ups[i]));
    const d = Math.hypot(positions[i * 3] - eye.x, positions[i * 3 + 1] - eye.y, positions[i * 3 + 2] - eye.z);
    const t = Math.max(0, Math.min(1, (d - 700) / 1000));
    const haze = t * t * (3 - 2 * t) * 0.62;
    const bodyMix = down[i];
    for (let c = 0; c < 3; c++) {
      const tone = deep[c] + (body[c] - deep[c]) * bodyMix;
      const want = (tone * shade + (fog[c] - tone * shade) * haze) / 255;
      // sRGB in, sRGB out: both the wanted colour and hillDeep are display values, and their ratio is
      // what the map (decoded to linear) has to be scaled by. Taking the ratio in sRGB and applying it in
      // linear is not the same number, so convert both ends.
      const lin = (x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
      colors[i * 3 + c] = lin(want) / Math.max(1e-4, lin(deep[c] / 255));
    }
  }
  return colors;
}

// The ground the far houses and the pines stand on (see farGroundY): plots on both sides of the far
// street beyond the bend, and a short hillside past the paving's end. Every strip starts outside the
// paving and a little below it, so from the photo view none of it shows: the sweep at 0.01 of the frame
// finds only paving, houses and the bend where the street is.
// The `hillside` strip is the one `npm run views` pose 6 was showing as a flat pale band across the middle
// of the frame -- out/scratch/posefind.mjs puts the first hit at (0.10, 0.33) and (0.10, 0.45) on it, 82
// and 92 m away. It was a two-column ruled surface, flat across 160 m of x, on one flat colour and with
// `THREE.Fog` mixing about 45% of the fog colour into it at that distance. `far plots left` and
// `far plots right` are the same shape nearer the street.
//
// Their geometry near the street is untouched, because `evergreen trunks stands on hillside` and
// `far roof c house lower stands on far plots left` are grounding checks with tolerances of 0.8 m: the
// height field is still `farGroundY` exactly, and the relief only starts 18 m out from the street's own
// centre line, which is well past both. What changed is that they are now grids rather than two columns,
// they carry the valley's own vertex colours and distance haze, and they opt out of the fog for the same
// reason `outer ground` does -- a linear far plane at 150 m draws a line across the land.
//
// FOUR of `hillside`'s cells are inside the photo frame, seen through the canopy, and the whole step costs
// 0.0004 of SSIM: (0.604, 0.614) +0.0063, (0.604, 0.659) +0.0062, (0.563, 0.659) -0.0103 and
// (0.646, 0.568) -0.0203 — the two that gain are the two larger movers. Rendering them UNLIT, as the
// valley floor beyond them is, cost four times that, which is why these three keep the rig.
function farGround(b) {
  const relief = noise2D(4243);
  const strip = (name, zNear, zFar, xOf, xFar, samples, cols = 14) => {
    const positions = [];
    const colors = [];
    for (let i = 0; i <= samples; i++) {
      const z = zNear + ((zFar - zNear) * i) / samples;
      const base = L.farGroundY(z);
      const x0 = xOf(z);
      for (let c = 0; c <= cols; c++) {
        const x = x0 + ((xFar - x0) * c) / cols;
        const out = Math.max(0, Math.abs(x - L.streetCenterX(z)) - 18);
        const amp = Math.min(3.0, out * 0.10);
        const y = base + (relief(x * 0.05 + 60, z * 0.05 + 60) - 0.5) * 2 * amp;
        positions.push(x, y, z);
        const col = groundColor(x, y, z);
        colors.push(col.r, col.g, col.b);
      }
    }
    const index = [];
    for (let i = 0; i < samples; i++) {
      for (let c = 0; c < cols; c++) {
        const a = i * (cols + 1) + c;
        const d = a + cols + 1;
        index.push(a, d, a + 1, a + 1, d, d + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    // LIT, unlike the valley floor beyond it. These three are near enough to take the rig's own sun and
    // shadows, and four of their cells are inside the photo frame (see the header): rendering them unlit
    // cost 0.0016 of SSIM against the 0.0004 they cost lit. They still opt out of the fog, and haze in
    // their own vertex colours instead.
    b.add(new THREE.Mesh(geo, makeMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false })), name);
  };
  strip('far plots left', -24, -42, (z) => L.streetCenterX(z) - 3.4, -60, 12);
  strip('far plots right', -24, -42, (z) => L.streetCenterX(z) + 3.4, 60, 12);
  strip('hillside', -42, -58, () => -80, 80, 10);
  outerGround(b);
}

// Woods and open ground mixed by a slow noise at two scales, then hazed toward the fog colour by distance.
// Shared by the plots, the hillside and the valley floor so the three meet without a seam in tone.
const groundClump = noise2D(4242);
function groundColor(x, y, z, irradiance) {
  const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
  const mixRgb = (a, c, t) => a.map((v, i) => v + (c[i] - v) * t);
  const cover = Math.max(
    0,
    Math.min(1, (groundClump(x * 0.035 + 3, z * 0.035 + 3) - 0.35) * 2.2 + (groundClump(x * 0.17 + 21, z * 0.17 + 21) - 0.5) * 0.9),
  );
  // Haze that never quite arrives, and never reaches the fog colour outright. A linear ramp saturating at
  // 255 m turned everything past it into one flat pale band, which is what `THREE.Fog`'s own 150 m far
  // plane was already doing: pose 6 showed a wall of it across the middle of the frame.
  const d = Math.hypot(x, y - L.CAMERA.eye.y, z);
  const t = Math.min(0.9, 1 - Math.exp(-Math.max(0, d - 40) / 230));
  const m = mixRgb(mixRgb(rgb(C.valleyWood), rgb(C.valleyField), cover), rgb(C.fog), t);
  return albedoOf((Math.round(m[0]) << 16) | (Math.round(m[1]) << 8) | Math.round(m[2]), irradiance === undefined ? {} : { irradiance });
}

// Everything beyond the plots and the hillside: the valley this town stands over, and the ground under and
// behind the camera. It replaces `ground base`, which was a BOX from y = -30 to -24 spanning x +-80 and
// z +40 to -120 -- a flat slab, fogged to nearly the fog colour over most of its area, and it is what
// filled most of `npm run views` poses 2 and 6 as "one flat plane with hard fog bands". Measured with
// out/scratch/posefind.mjs, the pale mass across pose 6's whole background was `ground base` at 82 to
// 163 m, and the band above it was the same slab further away.
//
// THE CEILING IS WHAT MAKES THIS SAFE. v depends only on a point's y and z (never on x), so the height at
// which any (x, z) crosses a given photo row is exact: y = 4.8 + z * 0.5989 puts it at v = 0.78, and this
// surface is held a metre below that everywhere. At v > 0.78 the photo frame is the near stairs, walls and
// paving from u 0 to 1, all of them a few metres away, so nothing here can win a depth test in the scored
// frame however the terrain is shaped. Measured: `npm run compare` moves by less than the PRNG noise floor.
//
// It carries no fog and hazes by distance in its own vertex colours instead. `THREE.Fog` is linear from
// 38 m to 150 m, so on a surface that runs to 400 m every metre past 150 is exactly the fog colour and the
// 150 m line is a hard band across the land -- which is the other half of what the sweep was showing.
function outerGround(b) {
  const COLS = 120;
  const ROWS = 64;
  const X = 320;
  const zNear = 80;
  const zFar = -420;
  const relief = noise2D(4241);
  // v = 0.78 at this height, for a point at depth z. Derived from worldToUV with x eliminated:
  // Y = z * (m cos p + sin p) / (cos p - m sin p) with m = (v - 0.5) * 2 tanV, which is 0.598885 at
  // v = 0.78, and y = eye.y + Y. Checked by substitution: (0, -55.09, -100) projects to v = 0.7800.
  // For z >= 0 it returns no ceiling at all, and that is deliberate rather than an oversight: the shelf
  // there sits at least 1.85 m BELOW the line this formula gives, so the clamp would never bite, and a
  // point at z > 0 low enough to have a positive depth at all lands far outside u in [0, 1] (at z = +1
  // it needs y < 0.47, which this surface only reaches past |x| = 20, where u comes out above 9).
  const ceilingY = (z) => (z < 0 ? L.CAMERA.eye.y + z * 0.5989 - 1.0 : 1e6);
  // The land's own shape: a shelf a little UNDER the street out to |x| = 16, falling away to the sides
  // and, past the hillside's crest at z = -58, into the valley.
  // The 1.2 m is not slack. A first pass put the shelf at streetY + 0.4, matching `far plots`' own kerb,
  // and `npm run clearance` went red: this surface spans the whole width including the street itself, so
  // at z = -0.25 it stood 0.4 m proud of the paving across the entire road, 0.00 m of clear run in both
  // halves. Everything within 16 m of the centre line already has its own ground -- the paving, the
  // terraces, the plots -- and this one's job there is only to close the void under them.
  const shelf = (x, z) => {
    const zc = Math.max(-46, Math.min(2, z));
    return L.streetY(zc) - 1.2 - 0.45 * Math.max(0, Math.abs(x) - 16) - 0.85 * Math.max(0, -z - 60);
  };
  const heightAt = (x, z) => {
    const amp = 2.0 + 0.055 * Math.hypot(x, z);
    const r = (relief(x * 0.022 + 40, z * 0.022 + 40) - 0.5) * 2 * amp + (relief(x * 0.09 + 7, z * 0.09 + 7) - 0.5) * amp * 0.35;
    return Math.min(shelf(x, z) + r, ceilingY(z) - 2.5);
  };
  const positions = [];
  const colors = [];
  for (let j = 0; j <= ROWS; j++) {
    const z = zNear + ((zFar - zNear) * j) / ROWS;
    for (let i = 0; i <= COLS; i++) {
      const x = -X + (2 * X * i) / COLS;
      const y = heightAt(x, z);
      positions.push(x, y, z);
      const c = groundColor(x, y, z, 1);
      colors.push(c.r, c.g, c.b);
    }
  }
  const index = [];
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < COLS; i++) {
      const a = j * (COLS + 1) + i;
      const c = a + COLS + 1;
      index.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  b.add(new THREE.Mesh(geo, makeMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false, unlit: true })), 'outer ground');
}

// Roofs of farther houses below the hill, seen from above: gabled houses whose front slope covers the
// photo's roof box at the house's depth, with a plaster body and gable ends, kawara on the slopes, the
// body reaching down to the ground beside the far street.
function farHouses(b) {
  const wall = surface('plaster', C.farWall, { seed: 52 });
  const low = surface('plaster', C.farWallLow, { seed: 53 });
  // The roofs the photo shows below the hill. Each house's walls are kept clear of the far street
  // (whose slabs run to x = streetCenterX(z) + 2.6): b's box would otherwise cross it.
  //
  // `far roof d` is new in iteration 4 and it closes a hole. Between the left row's own eave and the top
  // of `far roof c` there was a band of NOTHING at u 0.10 to 0.17, v 0.36 to 0.41, and what the render put
  // in it was the `near ridge` mountain card 1004 m away: cells (0.146, 0.386) and (0.104, 0.386) read
  // #583d2d and #654631 in the photo -- dark timber and tile -- against #7b8275 and #6a5f50, and the
  // "greenish" reported there since iteration 1 is `nearRidge` 0x6b7a5f itself. No colour on any timber
  // reaches those two cells, because no timber is in front of them.
  // Raising `far roof c` into the gap instead was measured and is worse: its ridge is horizontal, so
  // lifting its left end lifts its right end too, and cell (0.229, 0.386) went 0.0212 to 0.0855 -- a cell
  // that was nearly exact, against a photo of #9fa697 that wants the pale gable behind it.
  // Its tiles are their own colour, `farRoofNear`: the photo's roofs here are in the left row's shade and
  // `farRoof` is the sunlit grey-green of the ones two blocks further on.
  const houses = [
    { name: 'far roof a', u0: 0.2, u1: 0.34, v0: 0.3, v1: 0.36, depth: L.DEPTHS.farHouses },
    { name: 'far roof b', u0: 0.3, u1: 0.42, v0: 0.33, v1: 0.4, depth: L.DEPTHS.farHouses - 4 },
    { name: 'far roof c', u0: 0.14, u1: 0.24, v0: 0.4, v1: 0.47, depth: L.DEPTHS.farHouses - 6 },
    { name: 'far roof d', u0: 0.085, u1: 0.155, v0: 0.352, v1: 0.408, depth: L.DEPTHS.farHouses - 9, tile: C.farRoofNear, run: 1.6, backRun: 0.8 },
  ];
  // Ridge caps and eave lips for all of them, in two shared instanced sets: from above they were bare
  // slabs meeting at a line, which is what `npm run views` poses 2, 3 and 6 have called "pale boxes"
  // since iteration 2. A ridge and a lip are what makes a roof read as a roof at this distance.
  const ridgeGeo = ridgeTileGeometry(0.16, 0.5);
  const lipGeo = new THREE.BoxGeometry(1, 1, 1);
  const lipBase = darker(C.farRoof, 0.88);
  const ridges = [];
  const lips = [];
  // One material per distinct tile colour, built on first use. The first entry's seed is the 51 this had
  // when every house shared one material, so no tile texture in the scene is regenerated.
  // Bound: the seed comes from INSERTION ORDER, not from the hex. `far roof a` inserts `C.farRoof` first
  // and keeps 51 today, but adding a house with a new tile colour ABOVE it would shift every later seed by
  // 7 and regenerate those textures — the same reseed class the rest of this module is careful about.
  // Keying the seed off the hex would remove the ordering dependence and reseed `C.farRoof` doing it.
  const tiles = new Map();
  const tileFor = (hex) => {
    if (!tiles.has(hex)) tiles.set(hex, surface('kawara', hex, { seed: 51 + tiles.size * 7 }));
    return tiles.get(hex);
  };
  for (const h of houses) {
    const tile = tileFor(h.tile ?? C.farRoof);
    const run = h.run ?? 3.0;
    const backRun = h.backRun ?? run;
    // The house's own ground: below the street's surface at its depth, so no wall shows over the paving.
    const ridgeL = L.uvToWorld(h.u0, h.v0, h.depth);
    const ridgeR = L.uvToWorld(h.u1, h.v0, h.depth);
    const eave = L.uvToWorld(h.u1, h.v1, h.depth - run);
    const x0 = ridgeL.x;
    const x1 = Math.min(ridgeR.x, L.streetCenterX(ridgeL.z) - 3.2);
    const zRidge = ridgeL.z;
    const yRidge = ridgeL.y;
    const yEave = Math.min(eave.y, yRidge - 1.0);
    const zFront = zRidge + run;
    const zBack = zRidge - backRun;
    const yBase = Math.min(L.streetY(zFront), L.streetY(zBack)) - 0.6;
    // The gable in plaster under the roof; below it the wall is the dark the photo shows there (these
    // houses stand on the valley side, so their walls run a long way down before they meet their ground).
    const yBand = yEave - 1.4;
    b.profileSolid(`${h.name} house`, [[-zFront, yBand], [-zFront, yEave], [-zRidge, yRidge], [-zBack, yEave], [-zBack, yBand]], x0, x1, wall);
    b.box(`${h.name} house lower`, { x0, x1, y0: yBase, y1: yBand, z0: zBack, z1: zFront }, low);
    const o = 0.35;
    b.quadSlab(h.name, [{ x: x0 - o, y: yEave - 0.15, z: zFront + o }, { x: x1 + o, y: yEave - 0.15, z: zFront + o }, { x: x1 + o, y: yRidge + 0.05, z: zRidge }, { x: x0 - o, y: yRidge + 0.05, z: zRidge }], 0.14, tile);
    b.quadSlab(`${h.name} back`, [{ x: x1 + o, y: yEave - 0.15, z: zBack - o }, { x: x0 - o, y: yEave - 0.15, z: zBack - o }, { x: x0 - o, y: yRidge + 0.05, z: zRidge }, { x: x1 + o, y: yRidge + 0.05, z: zRidge }], 0.14, tile);
    // A half-round cap along the ridge, and a lip along each eave.
    const span = x1 + o - (x0 - o);
    for (let t = 0.25; t < span; t += 0.5) {
      ridges.push({ position: [x0 - o + t, yRidge + 0.13, zRidge], uv: [t, 0] });
    }
    for (const zEave of [zFront + o, zBack - o]) {
      lips.push({ position: [(x0 + x1) / 2, yEave - 0.19, zEave], scale: [span + 0.1, 0.1, 0.14], uv: [0, 0] });
    }
    // WHAT THESE HOUSES ARE FROM THE SIDE. `house lower` is one blank box from the gable's band down to
    // 0.6 m under the street, and these houses stand on the valley's edge, so that box is four to eight
    // metres of nothing: `npm run views` pose 2 has called it "a plain tan box" since iteration 4 and
    // out/scratch/posefind.mjs names `far roof d house lower` and `far roof c house lower` as the tall
    // tower at its left edge. A floor band, a stone plinth and shuttered openings on both long faces are
    // what a machiya on a slope has, and all of them go into the SHARED `far house lips` set — one unit
    // box per instance, its own scale and its own colour — so the four houses cost no draw call between
    // them. Their colours are per-instance, which is why `lipStone` and `lipShutter` are darker than the
    // set's own mean: `scaleHex` can only darken.
    // WHICH TWO FACES, and it is measured rather than chosen for tidiness. The photo camera stands at
    // (0, 4.8, 0) looking along -z and these houses sit at x -6 to -12, z -29 to -36, so it is IN FRONT OF
    // their +z face and their +x flank and BEHIND the other two; pose 2's eye is at x -19 and sees the -x
    // flank, which is the face the sweep has been calling a plain tan box. Trim on all four faces was
    // measured first and cost 0.0014 of SSIM on the GPU arm (0.58067 to 0.57932, against a margin of
    // 0.0001), split about evenly between the bands and the openings. On the two the camera is behind it
    // measured 0.058438 / 0.580678 against a control of 0.058440 / 0.580672 — inside the margin, and see
    // the note below for the sliver that is left.
    const wallH = yBand - yBase;
    const xFace = x0; // the flank the photo camera is BEHIND (it sees the +x one, which carries no trim)
    const zFace = zBack; // and the back
    // HOW FAR PROUD, and it is not free. These bands stand OUTBOARD of a back-facing plane, and every
    // house's x0 silhouette edge is inside the photo frame (u 0.055 / 0.094 / 0.170 / 0.277), so a band
    // shows as a sliver past that edge. At the first version's 0.13 m proud an independent critic measured
    // 4.3 to 5.8 px of sliver at 1200 px wide, and the whole trim cost 0.000002 of cell distance and
    // 0.000006 of SSIM on the GPU arm — inside that tool's margin, but not the zero an earlier comment
    // here claimed. Everything below is that geometry roughly halved: it still reads from the flank.
    const band = (y, h, out, hex) => {
      lips.push({ position: [xFace - out, y, (zBack + zFront) / 2], scale: [0.07, h, zFront - zBack], uv: [0, 0], color: scaleHex(hex, lipBase) });
      lips.push({ position: [(x0 + x1) / 2, y, zFace - out], scale: [x1 - x0, h, 0.07], uv: [0, 0], color: scaleHex(hex, lipBase) });
    };
    if (wallH > 1.6) {
      band(yBand - 0.35, 0.22, 0.04, C.farLipBand);
      band(yBase + Math.min(1.2, wallH * 0.3), 0.9, 0.05, C.farLipStone);
      // Shuttered openings on the storey between the band and the plinth, on the same two faces.
      const openY = yBand - 1.25;
      const w = Math.min(1.1, (x1 - x0) / 3.2);
      for (const k of [-1, 1]) {
        lips.push({ position: [xFace - 0.03, openY, (zBack + zFront) / 2 + k * (zFront - zBack) * 0.24], scale: [0.04, 0.95, Math.min(1.1, (zFront - zBack) / 3.2)], uv: [0, 0], color: scaleHex(C.farLipShutter, lipBase) });
        lips.push({ position: [(x0 + x1) / 2 + k * (x1 - x0) * 0.24, openY, zFace - 0.03], scale: [w, 0.95, 0.04], uv: [0, 0], color: scaleHex(C.farLipShutter, lipBase) });
      }
    }
  }
  b.add(instanced('far house ridges', ridgeGeo, surface('kawara', darker(C.farRoof, 0.82), { seed: 54, instancedUv: true }), ridges), 'far house ridges');
  b.add(instanced('far house lips', lipGeo, surface('kawara', lipBase, { seed: 55, instancedUv: true }), lips), 'far house lips');
}

// The machiya row that lines the right side of the far street, from the foot of the stairs into the
// bend. Before it, the landing's slabs ran straight past the photo's street edge: at z = -21 the paving
// reached x = 2.5 where the photo's edge is at x = -2.1, so about 4.5 m of lit stone stood where the
// photo has dark timber fronts under tiled eaves, and one set of slabs had to answer both for lit stone
// at (0.354, 0.75) and for dark buildings at (0.438, 0.75). No single colour can serve both, which is
// why iteration 1's four attempts on the paving all lost. The slabs still run underneath; the row hides
// them.
//
// It is one machiya cross-section swept along the photo's own street edge (L.farRowFrontX), stepped down
// at every party wall: a base band, the shopfront wall, a hisashi that oversails the street, the upper
// storey, and the main roof's two slopes. The body is four meshes (a base and a body for each of the near
// and far halves, so each half's own bounding box can carry a grounding check) and every kawara tile,
// eave cap and ridge tile on it goes into one of two shared instanced sets, lit and shaded.
function farMachiyaRow(b) {
  const R = L.FAR_ROW;
  const rand = mulberry32(311);
  const geos = { tile: panTileGeometry(0.3, 0.33), cap: eaveCapGeometry(0.075, 0.03) };
  // Two sets, lit and shaded. Neither carries `ridge`: the row is modelled as a single street-facing
  // slope with no ridge line, so no `tileRoof` call here passes `ridge: true` and no ridge array exists.
  const lit = { tiles: [], caps: [] };
  const shade = { tiles: [], caps: [] };
  const groundY = (z) => L.streetY(z);
  const baseTop = (z) => groundY(z) + R.base;

  // Bays of one frontage each: the eave is level along a bay and steps down at the party wall, which is
  // the stepped eave line the photo shows rather than one long ramp.
  const count = Math.max(1, Math.round((R.zNear - R.zFar) / R.unit));
  const stepZ = (R.zNear - R.zFar) / count;
  // Bays before this one are the near half: they carry the lit tiles and their own body mesh, so each
  // half's bounding box can answer a grounding check on its own.
  const SPLIT = Math.min(count - 1, Math.max(1, Math.round((R.zNear - R.litEnd) / stepZ)));
  const units = [];
  for (let i = 0; i < count; i++) {
    const zNear = R.zNear - i * stepZ;
    units.push({ zNear, zFar: zNear - stepZ, eaveY: groundY(zNear) + R.eave, far: i >= SPLIT });
  }

  // A point on the roof slope, `d` back from the wall line.
  const slope = R.roofRise / (R.depth + R.eaveOut);
  const onSlope = (d, eaveY) => eaveY - 0.1 + slope * (d + R.eaveOut);
  // The cross-section above the base band, as (d, y) with d measured back from the street edge: the
  // shopfront wall, the eave's outer lip out over the street, the point the hip starts from, the slope's
  // back edge, and the back foot. The hip point is on the slope, so it changes nothing except at the
  // near end, where it is the corner the half-hip turns around.
  const section = (z, eaveY) => [
    [0, baseTop(z)],
    [0, eaveY - 0.3],
    [-R.eaveOut, eaveY - 0.1],
    [R.hipStart, onSlope(R.hipStart, eaveY)],
    [R.depth, onSlope(R.depth, eaveY)],
    [R.depth, baseTop(z)],
  ];
  const baseBand = (z) => [
    [0, groundY(z) - R.sink],
    [0, baseTop(z)],
    [R.depth, baseTop(z)],
    [R.depth, groundY(z) - R.sink],
  ];

  // Rings along the row. Each unit contributes its own end rings, so the two rings at a party wall share
  // a z and differ in eave height: the sweep turns that into the step itself.
  const ringsFor = (from, to, profile) => {
    const out = [];
    for (let i = from; i < to; i++) {
      const u = units[i];
      const n = Math.max(2, Math.ceil((u.zNear - u.zFar) / 0.8));
      for (let k = 0; k <= n; k++) {
        const z = u.zNear - ((u.zNear - u.zFar) * k) / n;
        out.push({ z, x0: L.farRowFrontX(z), pts: profile(z, u.eaveY) });
      }
    }
    return out;
  };

  // The near end is hipped, not cut off square. A flat gable there is a dark timber wall facing the camera
  // across u 0.42-0.56 at v 0.64-0.77, and the photo has lit panels and tile: with the wall, cells
  // (0.521, 0.705) and (0.563, 0.705) went from 0.10 and 0.12 to 0.21 and 0.25, the worst two in the frame.
  // The hip is one extra ring in front of the row, its roof line dropped and its feet on the same ground.
  const zHip = R.zNear + R.hipRun;
  // Only the back of the roof drops: the eave over the street stays where it is, because the photo has
  // the dark shopfront under it right up to the row's near end (cells (0.438, 0.705) and (0.479, 0.705)
  // are #594144 and #48424c). A full hip across the whole width put lit tile there and cost 0.39 and 0.33.
  const hipRing = {
    z: zHip,
    x0: L.farRowFrontX(zHip),
    pts: section(zHip, units[0].eaveY).map(([d, y], i) => [d, i === 3 || i === 4 ? y - R.hipDrop : y]),
  };
  // The near half ends on the far half's own first ring, so the 0.6 m eave step where the two meshes meet
  // is a face of the near half and not a hole. Without it the near half's far cap is backfacing under a
  // FrontSide material and the far half's near cap is a metre lower, and you can see through the join
  // from any pose below the eave; the photo camera happens not to be one, so no score would ever say so.
  const bodyNear = ringsFor(0, SPLIT, section);
  bodyNear.unshift(hipRing);
  bodyNear.push({ z: units[SPLIT].zNear, x0: L.farRowFrontX(units[SPLIT].zNear), pts: section(units[SPLIT].zNear, units[SPLIT].eaveY) });
  const baseNear = ringsFor(0, SPLIT, baseBand);
  baseNear.unshift({ z: zHip, x0: L.farRowFrontX(zHip), pts: baseBand(zHip) });

  b.add(sweptSolid(bodyNear, surface('wood', C.farRowFront, { seed: 71 })), 'far row front');
  b.add(sweptSolid(ringsFor(SPLIT, count, section), surface('wood', C.farRowFrontFar, { seed: 72 })), 'far row front far');
  b.add(sweptSolid(baseNear, surface('stone', C.farRowBase, { seed: 73 })), 'far row base');
  b.add(sweptSolid(ringsFor(SPLIT, count, baseBand), surface('stone', C.farRowBase, { seed: 74 })), 'far row base far');

  // The slope is tiled in two bands: a lit one from the lip back to R.litRun, and a shaded one behind it.
  // The photo's own band runs from #afaedb at u 0.43-0.50 to #7d8ca3 by u 0.56, and one colour across the
  // whole slope reads 40 levels dark at the street end or 40 light at the back.
  for (const u of units) {
    const corner = (z, d) => new THREE.Vector3(L.farRowFrontX(z) + d, onSlope(d, u.eaveY), z);
    const zN = u.zNear;
    const zF = u.zFar;
    const band = (name, d0, d1, collect, color) =>
      tileRoof(b, rand, geos, name, [corner(zN, d0), corner(zN, d1), corner(zF, d1), corner(zF, d0)], { color, collect });
    if (u.far) {
      band('far row roof', -R.eaveOut, R.depth, shade, C.farRowTileFar);
    } else {
      band('far row roof', -R.eaveOut, R.litRun, lit, C.farRowTile);
      band('far row roof back', R.litRun, R.depth, shade, C.farRowTileFar);
    }
  }

  // Kawara on the half-hip's own slope, in the shaded colour: the photo's band there reads #6a7182 to
  // #869aab, between the two tile colours and nearer the shaded one.
  {
    const eaveY = units[0].eaveY;
    const top = (d) => new THREE.Vector3(L.farRowFrontX(R.zNear) + d, onSlope(d, eaveY), R.zNear);
    const low = (d) => new THREE.Vector3(L.farRowFrontX(zHip) + d, onSlope(d, eaveY) - R.hipDrop, zHip);
    tileRoof(b, rand, geos, 'far row hip', [low(R.hipStart), top(R.hipStart), top(R.depth), low(R.depth)], { color: C.farRowTileFar, collect: shade });
  }

  b.add(instanced('far row tiles', geos.tile, surface('kawara', C.farRowTile, { seed: 75, instancedUv: true, side: THREE.DoubleSide }), lit.tiles), 'far row tiles');
  b.add(instanced('far row eave caps', geos.cap, surface('kawara', darker(C.farRowTile, 0.85), { seed: 76, instancedUv: true }), lit.caps), 'far row eave caps');
  b.add(instanced('far row tiles far', geos.tile, surface('kawara', C.farRowTileFar, { seed: 77, instancedUv: true, side: THREE.DoubleSide }), shade.tiles), 'far row tiles far');
  b.add(instanced('far row eave caps far', geos.cap, surface('kawara', darker(C.farRowTileFar, 0.85), { seed: 78, instancedUv: true }), shade.caps), 'far row eave caps far');

  farRowFronts(b, R, units, baseTop);
}

// The shopfronts on the row's street face. Until iteration 3 the row was one unbroken plank wall with a
// tiled edge -- `npm run views` called it a plank fence from the photo view and a long low shed from above,
// and the compare gate cannot tell the difference, because at 20 m a whole frontage is four cells wide.
// The photo has, at every bay: a near-black corner post, a warm rail across the head of the frontage, a
// dark doorway in every other bay and a koshi lattice in the rest. Three instanced sets, one per colour.
//
// Every piece's street-facing FACE stands exactly 2 cm proud of the row's wall line, which is what `faceX`
// below is for: a first pass offset each piece's CENTRE and the posts, 0.12 m deep, ended up 5 cm proud
// while the comment claimed 2. `npm run clearance` measures the row's
// WALL line for its 0.60 m clear-run rule (the eave, which already hangs 0.40 m further out, is measured
// against the separate 0.55 m eave rule), so anything built on this face spends that margin directly.
// Measured both ways against a 0.60 m floor: without these, the narrowest near-half run is 1.10 m at
// z = -22.25, blocked by `far row base far`; with them it is 0.95 m at z = -29.25, blocked by
// `far row lattice`. Read that as the minimum MOVING rather than as 0.15 m spent -- no piece here is more
// than 2 cm proud at any z, and what the 2 cm did was expose a z where the base band's own run was
// already about 0.97 m. The far-half run and the eave run do not move at all.
//
// Bound of that measurement, which the gate's own header does not spell out for this case: the sweep steps
// z every 0.25 m and a corner post is 0.13 m deep, so five of the ten posts fall between samples and the
// reported minimum was taken on the five that did not. It is a verdict about the row, not about each post.
// Nothing here is near the 0.60 m floor, so the bound costs nothing today.
//
// Its PRNG is its own. `tileRoof` above draws from this module's `rand` for every tile and cap on the row,
// so a draw taken here would renumber nothing (it runs last) but a draw taken BEFORE the tile loop would
// renumber every tile on the row; the private stream removes the question.
function farRowFronts(b, R, units, baseTop) {
  const rand = mulberry32(5521);
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const PROUD = 0.02;
  // The x of a piece's CENTRE such that its street-facing face lands PROUD in front of the wall line.
  const faceX = (fx, thickness) => fx - PROUD + thickness / 2;
  const posts = [];
  const rails = [];
  const slats = [];
  const doors = [];
  const at = (z) => L.farRowFrontX(z);
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const zc = (u.zNear + u.zFar) / 2;
    const frontX = at(zc);
    const baseY = baseTop(zc);
    const headY = u.eaveY - 0.34;
    const height = headY - baseY;
    if (height < 0.6) continue;
    // A corner post at the bay's near edge, and one more past the last bay so no frontage is left open.
    for (const pz of i === units.length - 1 ? [u.zNear, u.zFar] : [u.zNear]) {
      posts.push({ position: [faceX(at(pz), 0.12), (baseY + headY) / 2, pz], scale: [0.12, height, 0.13], tint: 1 + jitter(rand, 0.05), uv: [rand(), 0] });
    }
    // The rail across the head of the frontage, under the eave.
    rails.push({ position: [faceX(frontX, 0.1), headY - 0.09, zc], scale: [0.1, 0.18, u.zNear - u.zFar - 0.14], tint: 1 + jitter(rand, 0.04), uv: [rand(), 0] });
    // Alternating doorway and lattice. The doorway is a dark panel the height of a door; the lattice is
    // vertical slats over the rest of the frontage, stopping short of the rail.
    const span = u.zNear - u.zFar - 0.2;
    if (i % 2 === 1) {
      const doorH = Math.min(1.85, height - 0.25);
      doors.push({ position: [faceX(frontX, 0.03), baseY + doorH / 2, zc], scale: [0.03, doorH, span * 0.72], tint: 1 + jitter(rand, 0.03), uv: [rand(), 0] });
    } else {
      const y0 = baseY + 0.12;
      const y1 = Math.min(headY - 0.22, baseY + 1.7);
      const pitch = 0.12;
      const n = Math.max(1, Math.floor(span / pitch));
      const start = zc + (span - n * pitch) / 2 + pitch / 2 - span / 2;
      for (let k = 0; k < n && y1 > y0; k++) {
        slats.push({ position: [faceX(frontX, 0.045), (y0 + y1) / 2, start + k * pitch], scale: [0.045, y1 - y0, 0.045], tint: 1 + jitter(rand, 0.06), uv: [rand(), 0] });
      }
    }
  }
  b.add(instanced('far row posts', unit, surface('wood', C.farRowPost, { seed: 79, instancedUv: true }), posts), 'far row posts');
  b.add(instanced('far row rails', unit, surface('wood', C.farRowRail, { seed: 80, instancedUv: true }), rails), 'far row rails');
  b.add(instanced('far row lattice', unit, surface('wood', C.farRowLatticeSlat, { seed: 81, instancedUv: true }), slats), 'far row lattice');
  b.add(instanced('far row doors', unit, surface('wood', C.farRowDoor, { seed: 82, instancedUv: true }), doors), 'far row doors');
}

// A closed solid swept along z from a list of rings, each a section polygon in (d, y) offset by the
// ring's own x0. Triangles are built face by face with their own vertices, never shared between faces,
// so `computeVertexNormals` gives each face its true normal instead of smoothing a building's corners
// away; a triangle with no area is dropped rather than normalised, because normalising a zero cross
// product is the NaN that spreads through the bloom to the whole frame. UVs are in metres, along the row
// and around the section, so a wood or stone texture keeps its world scale.
function sweptSolid(rings, material) {
  const verts = [];
  const uvs = [];
  const cross = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const tri = (p, q, r, up, uq, ur) => {
    e1.set(q[0] - p[0], q[1] - p[1], q[2] - p[2]);
    e2.set(r[0] - p[0], r[1] - p[1], r[2] - p[2]);
    if (cross.crossVectors(e1, e2).lengthSq() < 1e-14) return;
    verts.push(p[0], p[1], p[2], q[0], q[1], q[2], r[0], r[1], r[2]);
    uvs.push(up[0], up[1], uq[0], uq[1], ur[0], ur[1]);
  };
  const perimeterOf = (pts) => {
    const s = [0];
    for (let k = 1; k < pts.length; k++) s.push(s[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
    return s;
  };
  const world = (r, k) => [r.x0 + r.pts[k][0], r.pts[k][1], r.z];
  let along = 0;
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i];
    const B = rings[i + 1];
    const pa = perimeterOf(A.pts);
    const pb = perimeterOf(B.pts);
    const alongA = along;
    along += Math.abs(B.z - A.z);
    const n = A.pts.length;
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n;
      const p0 = world(A, k);
      const p1 = world(A, k1);
      const p2 = world(B, k1);
      const p3 = world(B, k);
      tri(p0, p1, p2, [alongA, pa[k]], [alongA, pa[k1]], [along, pb[k1]]);
      tri(p0, p2, p3, [alongA, pa[k]], [along, pb[k1]], [along, pb[k]]);
    }
  }
  // The two ends. The section is concave where the eave's lip turns back out over the street, so a
  // triangle fan from one vertex would cut across the outside of the polygon; triangulate it properly.
  for (const [r, flip] of [[rings[0], false], [rings[rings.length - 1], true]]) {
    const contour = r.pts.map(([d, y]) => new THREE.Vector2(d, y));
    for (const [i0, i1, i2] of THREE.ShapeUtils.triangulateShape(contour, [])) {
      const [a, c, d] = flip ? [i0, i2, i1] : [i0, i1, i2];
      tri(world(r, a), world(r, c), world(r, d), r.pts[a], r.pts[c], r.pts[d]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

// The corner house facing the camera beyond the bend, and one more roof to its left (block-out).
function bend(b) {
  const d4 = 36;
  const c4 = L.uvToWorld(0.43, 0.7, d4);
  const eave4 = L.uvToWorld(0.43, 0.66, d4).y;
  const ridge4 = L.uvToWorld(0.43, 0.58, d4).y;
  // Its left edge is the photo's own, or the far edge of the paved band at the street's end, whichever is
  // further left. The paving stops at L.FAR_STREET_END (the front face below) and the band there runs
  // 2.6 m each side of the centre line, so without this the road ended in a 0.3 m slot of open paving
  // beside the house instead of at it.
  const xl = Math.min(L.uvToWorld(0.36, 0.66, d4).x - 0.3, L.streetCenterX(L.FAR_STREET_END) - 3.2);
  const xr = L.uvToWorld(0.5, 0.66, d4).x + 0.6;
  // The house's front face is the far street's end: nothing paved runs past it.
  b.box('corner house body', { x0: xl, x1: xr, y0: c4.y - 6, y1: eave4, z0: c4.z - 8.3, z1: L.FAR_STREET_END }, C.woodDark);
  b.profileSolid(
    'corner house roof',
    [[-c4.z + 0.5, eave4], [-c4.z + 4.5, ridge4], [-c4.z + 8.5, eave4], [-c4.z + 8.5, eave4 - 0.35], [-c4.z + 4.5, ridge4 - 0.35], [-c4.z + 0.5, eave4 - 0.35]],
    xl - 0.4,
    xr + 0.4,
    C.tileLeft,
  );
  b.frontalBox('bend roof', { u0: 0.2, u1: 0.36, v0: 0.6, v1: 0.68 }, 38, 6, C.tileLeft);
  b.frontalBox('bend wall', { u0: 0.22, u1: 0.33, v0: 0.68, v1: 0.74 }, 38, 6, C.woodMid);
}
