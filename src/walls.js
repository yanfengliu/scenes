// Stone walls of stacked blocks (instanced), the low plaster wall with its tiled cap, the platform's
// front wall, the fence's stone-faced core, the pot and the potted plant's pot. Each wall is a line
// segment in the xz plane with an outward normal; blocks are laid in courses between two height lines
// with staggered joints, their outer faces on the line.
import * as THREE from 'three';
import * as L from './layout.js';
import { mulberry32, jitter, uniform } from './random.js';
import { instanced, surface, stoneBlockGeometry, panTileGeometry, ridgeTileGeometry, basisAlong } from './instancing.js';
import { mortarOf, balancedMean } from './paving.js';

const C = L.COLORS;
const S = L.STREET;
const MORTAR_SETBACK = 0.05;

// Lay stacked stones along a segment. `from`/`to` are [x, z]; `outward` is the unit normal the faces
// point along; top(t)/bottom(t) give the wall's height range at fraction t along the segment. The
// blocks' outer faces lie on the segment (a few sit up to 3 cm back) and they extend `depth` behind it.
// The mortar body behind them is set MORTAR_SETBACK behind the line so the blocks stand proud of it.
// style: 'ashlar' (regular courses, square blocks, tight joints) or 'rubble' (irregular sizes,
// slight rotations, rounded blocks).
export function stackedStones(rand, { from, to, outward, top, bottom, course = 0.32, depth = 0.45, style = 'rubble', tintAmount = 0.08 }) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  const ax = dx / length;
  const az = dz / length;
  const yaw = Math.atan2(-az, ax); // rotation about y that maps local +x onto the segment direction
  const items = [];
  // Courses from the lowest bottom up to the highest top; each course is a row of blocks along the wall.
  let minBottom = Infinity;
  let maxTop = -Infinity;
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    minBottom = Math.min(minBottom, bottom(t));
    maxTop = Math.max(maxTop, top(t));
  }
  const rows = Math.max(1, Math.ceil((maxTop - minBottom) / course));
  for (let r = 0; r < rows; r++) {
    const h = style === 'rubble' ? course * uniform(rand, 0.75, 1.2) : course;
    const y0 = minBottom + r * course;
    let s = r % 2 ? -uniform(rand, 0.2, 0.5) : 0;
    while (s < length) {
      const w = style === 'rubble' ? uniform(rand, 0.35, 0.9) : uniform(rand, 0.55, 1.0);
      const s0 = Math.max(0, s);
      const s1 = Math.min(length, s + w);
      s += w + 0.015;
      if (s1 - s0 < 0.12) continue;
      const mid = (s0 + s1) / 2;
      const tc = mid / length;
      const yTop = top(tc);
      const yBot = bottom(tc);
      // Skip blocks entirely outside this column's height range; clip the top course to the top line.
      if (y0 >= yTop || y0 + h <= yBot) continue;
      const bh = Math.min(h, yTop - y0);
      const cy = y0 + bh / 2;
      const inset = depth / 2 + uniform(rand, 0.0, 0.03);
      const roll = style === 'rubble' ? jitter(rand, 0.04) : 0;
      items.push({
        position: [from[0] + ax * mid - outward[0] * inset, cy, from[1] + az * mid - outward[1] * inset],
        euler: [0, yaw, roll],
        scale: [s1 - s0 - 0.012, bh - 0.012, depth],
        tint: 1 + jitter(rand, tintAmount),
        uv: [rand() * 3, rand() * 3],
      });
    }
  }
  return items;
}

// Stones plus their visible mortar joints must still average to the sampled mean: rubble shows about
// 15% mortar between its rounded blocks, ashlar about 3%.
const rubbleMean = (mean) => balancedMean(mean, mortarOf(mean), 0.15);
const ashlarMean = (mean) => balancedMean(mean, mortarOf(mean), 0.03);

export function buildWalls(b) {
  const rand = mulberry32(7);
  const rubble = stoneBlockGeometry(true);
  const ashlar = stoneBlockGeometry(false);

  // ---- left: the tall wall of light stone blocks nearest the camera --------------------------------
  const W = L.LEFT_STONE_WALL;
  // The ashlar faces stand 2 cm proud of the rubble wall's line beyond them, so the two never share a plane.
  const leftBlocks = stackedStones(rand, {
    from: [W.x1 + 0.02, W.z1],
    to: [W.x1 + 0.02, W.z0],
    outward: [1, 0],
    top: () => W.top - 0.25,
    bottom: (t) => L.streetY(W.z1 + (W.z0 - W.z1) * t) - 1,
    course: 0.36,
    depth: 0.5,
    style: 'ashlar',
    tintAmount: 0.07,
  });
  b.add(instanced('left stone wall blocks', ashlar, surface('stone', ashlarMean(C.stoneBlocks), { seed: 31, instancedUv: true }), leftBlocks), 'left stone wall blocks');
  const leftTop = stackedStones(rand, { from: [W.x1 + 0.02, W.z1], to: [W.x1 + 0.02, W.z0], outward: [1, 0], top: () => W.top, bottom: () => W.top - 0.25, course: 0.25, depth: 0.55, style: 'ashlar', tintAmount: 0.05 });
  b.add(instanced('left stone wall top blocks', ashlar, surface('stone', ashlarMean(C.stoneBlocksTop), { seed: 32, instancedUv: true }), leftTop), 'left stone wall top blocks');
  b.box('left stone wall', { x0: W.x0, x1: W.x1 - 0.02, y0: L.streetY(W.z0) - 1, y1: W.top, z0: W.z0, z1: W.z1 }, mortarOf(C.stoneBlocks));

  // ---- left: the rubble retaining wall under the low plaster wall ----------------------------------
  const capZ0 = L.LEFT_CAP_LINE[0][0];
  const capZ1 = S.stairsEndZ;
  const wallH = L.LEFT_LOW_WALL_HEIGHT;
  const zAt = (t) => capZ0 + (capZ1 - capZ0) * t;
  const leftRubble = stackedStones(rand, {
    from: [S.x0, capZ0],
    to: [S.x0, capZ1],
    outward: [1, 0],
    top: (t) => L.leftCapY(zAt(t)) - wallH,
    bottom: (t) => L.streetY(zAt(t)) - 0.6,
    course: 0.28,
    depth: 0.45,
    style: 'rubble',
  });
  b.add(instanced('left retaining wall stones', rubble, surface('rubble', rubbleMean(C.stoneWallLeft), { seed: 33, instancedUv: true }), leftRubble), 'left retaining wall stones');
  b.bandSolid('left retaining wall', capZ0, capZ1, (z) => L.leftCapY(z) - wallH, (z) => L.streetY(z) - 0.6, S.x0 - 0.7, S.x0 - MORTAR_SETBACK, mortarOf(C.stoneWallLeft));

  // Low plaster wall with a gabled kawara cap: one row of pan tiles on each slope, ridge tiles along
  // the top and round caps at both eaves, in the wall's own light mean (the photo's cap is a light band).
  const T = L.LEFT_LOW_WALL_THICKNESS;
  const wallX1 = S.x0 + 0.05;
  const wallX0 = wallX1 - T;
  b.bandSolid('left low wall', capZ0, capZ1, (z) => L.leftCapY(z), (z) => L.leftCapY(z) - wallH, wallX0, wallX1, surface('plaster', C.lowWall, { seed: 34 }));
  tiledCap(b, rand, 'left wall cap', { zNear: capZ0, zFar: capZ1, xRidge: (wallX0 + wallX1) / 2, halfWidth: T / 2 + 0.05, rise: 0.05, topY: (z) => L.leftCapY(z) + 0.02, color: C.lowWall, seed: 35 });

  // The potted plant's pot: a small flower pot seated on the cap's ridge.
  const p = L.leftPotPlacement();
  const potGeo = new THREE.LatheGeometry(
    [new THREE.Vector2(0.0, 0), new THREE.Vector2(0.22, 0), new THREE.Vector2(0.27, 0.3), new THREE.Vector2(0.3, 0.36), new THREE.Vector2(0.26, 0.36), new THREE.Vector2(0.24, 0.05), new THREE.Vector2(0.0, 0.05)],
    18,
  );
  const leftPot = new THREE.Mesh(potGeo, surface('glaze', C.pot, { seed: 36 }));
  leftPot.position.set(p.x, p.potY + 0.02, p.z);
  b.add(leftPot, 'left pot');

  // ---- platform: the front wall at the head of the stairs and the sides -----------------------------
  const platFront = stackedStones(rand, {
    from: [S.x1, 0],
    to: [S.x0, 0],
    outward: [0, -1],
    top: () => L.PLATFORM_Y - 0.02,
    bottom: () => -0.4,
    course: 0.36,
    depth: 0.5,
    style: 'ashlar',
    tintAmount: 0.07,
  });
  b.add(instanced('platform front wall', ashlar, surface('stone', ashlarMean(C.stoneBlocks), { seed: 37, instancedUv: true }), platFront), 'platform front wall');

  // ---- right: the retaining wall along the stairs (dark blue-grey stone) ----------------------------
  const RT = L.RIGHT_TERRACE;
  const N = L.RIGHT_WALL_NOTCH;
  const wallTop = (z) => (z <= N.z1 && z >= N.z0 ? L.streetY(z) + 0.5 : L.rightTerraceY(z));
  const rz = (t) => 0 + (-15.3 - 0) * t;
  const rightStones = stackedStones(rand, {
    from: [S.x1, 0],
    to: [S.x1, -15.3],
    outward: [-1, 0],
    top: (t) => wallTop(rz(t)),
    bottom: (t) => L.streetY(rz(t)) - 0.6,
    course: 0.3,
    depth: 0.5,
    style: 'rubble',
  });
  b.add(instanced('right retaining wall stones', rubble, surface('rubble', rubbleMean(C.stoneWallRight), { seed: 38, instancedUv: true }), rightStones), 'right retaining wall stones');
  b.bandSolid('right retaining wall', 0, -15.3, wallTop, (z) => L.streetY(z) - 0.6, S.x1 + MORTAR_SETBACK, RT.xInner, mortarOf(C.stoneWallRight), 60);

  // ---- the fence's core: a stone-faced wall on the planter strip, jogging back around the side steps ----
  const F = L.RIGHT_FENCE;
  const half = F.thickness / 2;
  const coreStones = [];
  for (let i = 0; i < F.path.length - 1; i++) {
    const [xa, za] = F.path[i];
    const [xb, zb] = F.path[i + 1];
    if (xa === xb) {
      // Along the street: the core follows the planter's height line, stones on the street face. At a
      // convex corner (the street-side face turns away) the stones wrap the across piece's end; at a
      // concave one (the pocket behind the stair head) they stop at the across piece's face.
      const prevAcross = i > 0 && F.path[i - 1][0] !== xa;
      const nextAcross = i < F.path.length - 2 && F.path[i + 2][0] !== xa;
      const convexStart = prevAcross && F.path[i - 1][0] > xa;
      const convexEnd = nextAcross && F.path[i + 2][0] > xa;
      const sa = prevAcross ? za + (convexStart ? half : -half) : za;
      const sb = nextAcross ? zb - (convexEnd ? half : -half) : zb;
      const tz = (t) => sa + (sb - sa) * t;
      b.bandSolid(`fence core ${i}`, za, zb, (z) => L.rightBedY(z), (z) => L.rightTerraceY(z) - 2, xa - half + MORTAR_SETBACK, xa + half, mortarOf(C.stoneWallRight), 6);
      // Inside the wall's notch the stones run down to the lowered wall top, so the face above the notch
      // is stone all the way (the photo's tall stone wall under the fence).
      coreStones.push(...stackedStones(rand, { from: [xa - half, sa], to: [xa - half, sb], outward: [-1, 0], top: (t) => L.rightBedY(tz(t)), bottom: (t) => Math.min(L.rightTerraceY(tz(t)) - 0.2, wallTop(tz(t)) + 0.1), course: 0.3, depth: F.thickness, style: 'rubble' }));
    } else {
      // Across the jog: a level piece closing the corner, its street-side end set behind the stone line,
      // stones on the face toward the steps.
      const x0 = Math.min(xa, xb) - half + MORTAR_SETBACK;
      const x1 = Math.max(xa, xb) + half;
      const toward = xb > xa ? -1 : 1;
      const zf = za + toward * half;
      b.box(`fence core ${i}`, { x0, x1, y0: L.rightTerraceY(za) - 2, y1: L.rightBedY(za), z0: za - half + (toward < 0 ? MORTAR_SETBACK : 0), z1: za + half - (toward > 0 ? MORTAR_SETBACK : 0) }, mortarOf(C.stoneWallRight));
      coreStones.push(...stackedStones(rand, { from: [x0 - MORTAR_SETBACK, zf], to: [x1, zf], outward: [0, toward], top: () => L.rightBedY(za), bottom: () => L.rightTerraceY(za) - 0.2, course: 0.3, depth: F.thickness, style: 'rubble' }));
    }
  }
  b.add(instanced('fence core stones', rubble, surface('rubble', rubbleMean(C.stoneWallRight), { seed: 39, instancedUv: true }), coreStones), 'fence core stones');

  // ---- the round pot on the right walkway ---------------------------------------------------------
  const potHit = L.rayHitGround(L.POT.u, L.POT.v, (z) => L.rightTerraceY(z) + 0.5);
  const jar = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.28, 0),
      new THREE.Vector2(0.42, 0.12),
      new THREE.Vector2(0.55, 0.4),
      new THREE.Vector2(0.53, 0.7),
      new THREE.Vector2(0.4, 0.92),
      new THREE.Vector2(0.3, 1.0),
      new THREE.Vector2(0.34, 1.05),
      new THREE.Vector2(0.24, 1.05),
      new THREE.Vector2(0.22, 0.9),
      new THREE.Vector2(0, 0.9),
    ],
    24,
  );
  const pot = new THREE.Mesh(jar, surface('glaze', C.pot, { seed: 40 }));
  pot.position.set(potHit.x, potHit.y - 0.5, potHit.z);
  b.add(pot, 'pot');
}

// A small gabled tile cap along a wall running in z: one low-profile pan tile on each slope per 0.29 m
// and small ridge tiles along the top, all in one mean, so the cap reads as the photo's flat light band
// from above and as tiles up close. topY(z) is the eave height; the ridge sits `rise` higher.
function tiledCap(b, rand, name, { zNear, zFar, xRidge, halfWidth, rise, topY, color, seed }) {
  const pitch = Math.atan(rise / halfWidth);
  const slopeLength = Math.hypot(halfWidth, rise);
  const tiles = [];
  const ridge = [];
  // Tiles every 0.29 m of wall length, so the spacing follows the cap's slope, not its z projection.
  let z = zNear - 0.15;
  while (z > zFar) {
    const slope = (topY(z + 0.05) - topY(z - 0.05)) / 0.1; // dy/dz of the wall top
    const along = new THREE.Vector3(0, -slope, -1).normalize(); // down the street along the wall
    for (const side of [1, -1]) {
      // Local x runs across the tile (along the wall), local +z down the slope, y up. Flipping the
      // along direction with the side keeps the frame right-handed on both slopes.
      const xAxis = along.clone().multiplyScalar(side);
      const zAxis = new THREE.Vector3(side * Math.cos(pitch), -Math.sin(pitch), 0);
      zAxis.sub(xAxis.clone().multiplyScalar(zAxis.dot(xAxis))).normalize();
      const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis);
      const basis = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
      const mid = slopeLength / 2;
      const p = new THREE.Vector3(xRidge + side * mid * Math.cos(pitch), topY(z) + rise - mid * Math.sin(pitch), z).addScaledVector(yAxis, 0.02);
      tiles.push({ position: [p.x, p.y, p.z], basis, tint: 1 + jitter(rand, 0.06), uv: [rand(), rand()] });
    }
    ridge.push({ position: [xRidge, topY(z) + rise + 0.03, z], basis: basisAlong(along), tint: 1 + jitter(rand, 0.05), uv: [rand(), 0] });
    z -= 0.29 / Math.hypot(1, slope);
  }
  b.add(instanced(`${name} tiles`, panTileGeometry(0.3, slopeLength + 0.02, 0.012), surface('kawara', color, { seed, instancedUv: true, side: THREE.DoubleSide }), tiles), `${name} tiles`);
  b.add(instanced(`${name} ridge`, ridgeTileGeometry(0.06, 0.3), surface('kawara', color, { seed: seed + 2, instancedUv: true }), ridge), `${name} ridge`);
}
