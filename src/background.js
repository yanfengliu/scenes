// The distant layers: the mountains as planes fading with distance, the forested hill as a surface with
// a tree-clump texture, the roofs of farther houses below the hill as gabled houses, the ground they
// stand on, the machiya row that lines the far street, and the corner house at the bend (still
// block-out). The sky dome is src/sky.js.
import * as THREE from 'three';
import * as L from './layout.js';
import { instanced, surface, panTileGeometry, eaveCapGeometry } from './instancing.js';
import { makeMaterial } from './materials.js';
import { makeHillTexture } from './textures.js';
import { buildSky } from './sky.js';
import { mulberry32 } from './random.js';
import { tileRoof } from './roofs.js';
import { darker } from './paving.js';

const C = L.COLORS;

export function buildBackground(b) {
  buildSky(b);
  mountains(b);
  hill(b);
  farGround(b);
  farHouses(b);
  farMachiyaRow(b);
  bend(b);
  // Base slab so orbiting never looks into the void.
  b.box('ground base', { x0: -80, x1: 80, y0: -30, y1: -24, z0: -120, z1: 40 }, C.groundBase);
}

// Hazy mountains as three planes facing the photo camera, farther ones paler: a pale far ridge whose
// tops sit at v 0.25, the blue range below it from v 0.27, and the dull-green near ridge in front.
// Each card runs below the horizon so nothing shows beneath.
//
// Their left ends run out to u = -2.4 rather than -0.6. Nothing there is inside the photo frame (u runs
// 0 to 1), so the scored view cannot see the difference; `npm run views` pose 3 can, and what it showed
// was the three cards' left edges stacked in the sky as a green, blue and white band with hard straight
// ends, which reads as a mistake rather than as a mountain. Their right ends stay where they are: past
// u 0.6 the photo has the forested hill and open sky above it, and a card carried further right would
// put mountain into that sky.
function mountains(b) {
  b.frontalCard(
    'mountains farthest',
    [[-2.4, 0.28], [-0.6, 0.27], [0.08, 0.262], [0.18, 0.248], [0.26, 0.243], [0.33, 0.25], [0.4, 0.258], [0.47, 0.27], [0.6, 0.28], [0.6, 0.4], [-2.4, 0.4]],
    L.DEPTHS.mountains[1],
    C.mountainFarthest,
  );
  b.frontalCard(
    'mountains blue',
    [[-2.4, 0.3], [-0.6, 0.29], [0.1, 0.283], [0.17, 0.272], [0.23, 0.268], [0.29, 0.276], [0.35, 0.27], [0.41, 0.278], [0.48, 0.29], [0.6, 0.295], [0.6, 0.4], [-2.4, 0.4]],
    L.DEPTHS.mountains[0],
    C.mountainBlue,
  );
  b.frontalCard(
    'near ridge',
    [[-2.4, 0.335], [-0.6, 0.325], [0.1, 0.32], [0.18, 0.305], [0.24, 0.285], [0.3, 0.295], [0.36, 0.283], [0.42, 0.29], [0.5, 0.32], [0.5, 0.42], [-2.4, 0.42]],
    L.DEPTHS.nearRidge,
    C.nearRidge,
  );
}

// The forested hill filling the upper right: a surface whose top edge follows the plan's ridge points and
// which leans back with depth (nearer at its foot), textured with tree clumps over the photo's gradient
// (warm haze near the ridge under the sun glare, darker green lower down). UV v is the photo row, which
// the texture's rows follow, so every row's mean is the sampled color at that row.
function hill(b) {
  const ridge = [[0.27, 0.305], [0.36, 0.28], [0.48, 0.215], [0.6, 0.16], [0.72, 0.1], [0.82, 0.08], [0.95, 0.075], [1.6, 0.07]];
  const stops = [[0.075, C.hillRidge], [0.14, C.hillHaze], [0.2, C.hillMid], [0.32, C.hill]];
  const vBottom = 0.8;
  const vTop = 0.05;
  const columns = 60;
  const rows = 10;
  const ridgeV = (u) => {
    if (u <= ridge[0][0]) return ridge[0][1];
    for (let i = 1; i < ridge.length; i++) {
      if (u <= ridge[i][0]) {
        const [u0, v0] = ridge[i - 1];
        const [u1, v1] = ridge[i];
        return v0 + ((v1 - v0) * (u - u0)) / (u1 - u0);
      }
    }
    return ridge[ridge.length - 1][1];
  };
  const depthAt = (v) => L.DEPTHS.hill - ((v - 0.07) / (vBottom - 0.07)) * 200;
  const positions = [];
  const uvs = [];
  const u0 = ridge[0][0];
  const u1 = ridge[ridge.length - 1][0];
  for (let i = 0; i <= columns; i++) {
    const u = u0 + ((u1 - u0) * i) / columns;
    const top = ridgeV(u);
    for (let j = 0; j <= rows; j++) {
      const v = top + ((vBottom - top) * j) / rows;
      const p = L.uvToWorld(u, v, depthAt(v));
      positions.push(p.x, p.y, p.z);
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
  const map = makeHillTexture({ size: 1536, seed: 7, stops, vTop, vBottom });
  b.add(new THREE.Mesh(geo, makeMaterial({ map, mean: C.hillMid, side: THREE.DoubleSide, fog: false, unlit: true })), 'hill');
}

// The ground the far houses and the pines stand on (see farGroundY): plots on both sides of the far
// street beyond the bend, and a short hillside past the paving's end. Every strip starts outside the
// paving and a little below it, so from the photo view none of it shows: the sweep at 0.01 of the frame
// finds only paving, houses and the bend where the street is.
function farGround(b) {
  const strip = (name, zNear, zFar, xOf, xFar, samples) => {
    const positions = [];
    for (let i = 0; i <= samples; i++) {
      const z = zNear + ((zFar - zNear) * i) / samples;
      const y = L.farGroundY(z);
      positions.push(xOf(z), y, z, xFar, y, z);
    }
    const index = [];
    for (let i = 0; i < samples; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    b.add(new THREE.Mesh(geo, makeMaterial({ color: C.hill, side: THREE.DoubleSide })), name);
  };
  strip('far plots left', -24, -42, (z) => L.streetCenterX(z) - 3.4, -60, 12);
  strip('far plots right', -24, -42, (z) => L.streetCenterX(z) + 3.4, 60, 12);
  strip('hillside', -42, -58, () => -80, 80, 8);
}

// Roofs of farther houses below the hill, seen from above: gabled houses whose front slope covers the
// photo's roof box at the house's depth, with a plaster body and gable ends, kawara on the slopes, the
// body reaching down to the ground beside the far street.
function farHouses(b) {
  const tile = surface('kawara', C.farRoof, { seed: 51 });
  const wall = surface('plaster', C.farWall, { seed: 52 });
  const low = surface('plaster', C.farWallLow, { seed: 53 });
  // The three roofs the photo shows below the hill. Each house's walls are kept clear of the far street
  // (whose slabs run to x = streetCenterX(z) + 2.6): b's box would otherwise cross it.
  const houses = [
    { name: 'far roof a', u0: 0.2, u1: 0.34, v0: 0.3, v1: 0.36, depth: L.DEPTHS.farHouses },
    { name: 'far roof b', u0: 0.3, u1: 0.42, v0: 0.33, v1: 0.4, depth: L.DEPTHS.farHouses - 4 },
    { name: 'far roof c', u0: 0.14, u1: 0.24, v0: 0.4, v1: 0.47, depth: L.DEPTHS.farHouses - 6 },
  ];
  for (const h of houses) {
    const run = 3.0;
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
    const zBack = zRidge - run;
    const yBase = Math.min(L.streetY(zFront), L.streetY(zBack)) - 0.6;
    // The gable in plaster under the roof; below it the wall is the dark the photo shows there (these
    // houses stand on the valley side, so their walls run a long way down before they meet their ground).
    const yBand = yEave - 1.4;
    b.profileSolid(`${h.name} house`, [[-zFront, yBand], [-zFront, yEave], [-zRidge, yRidge], [-zBack, yEave], [-zBack, yBand]], x0, x1, wall);
    b.box(`${h.name} house lower`, { x0, x1, y0: yBase, y1: yBand, z0: zBack, z1: zFront }, low);
    const o = 0.35;
    b.quadSlab(h.name, [{ x: x0 - o, y: yEave - 0.15, z: zFront + o }, { x: x1 + o, y: yEave - 0.15, z: zFront + o }, { x: x1 + o, y: yRidge + 0.05, z: zRidge }, { x: x0 - o, y: yRidge + 0.05, z: zRidge }], 0.14, tile);
    b.quadSlab(`${h.name} back`, [{ x: x1 + o, y: yEave - 0.15, z: zBack - o }, { x: x0 - o, y: yEave - 0.15, z: zBack - o }, { x: x0 - o, y: yRidge + 0.05, z: zRidge }, { x: x1 + o, y: yRidge + 0.05, z: zRidge }], 0.14, tile);
  }
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
  const xl = L.uvToWorld(0.36, 0.66, d4).x - 0.3;
  const xr = L.uvToWorld(0.5, 0.66, d4).x + 0.6;
  // The house stands behind the far street's end (z = -34) so the paving is never inside its front face.
  b.box('corner house body', { x0: xl, x1: xr, y0: c4.y - 6, y1: eave4, z0: c4.z - 8.3, z1: c4.z - 1.3 }, C.woodDark);
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
