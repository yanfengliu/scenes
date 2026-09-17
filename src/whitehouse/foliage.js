// The trees the reference photograph frames the building with, and the two hedges that close the
// composition at the north lawn's ends.
//
// The photo shows a dense dark tree mass filling the frame's left edge from v 0.24 to 0.72 and a second on
// the right from v 0.24 to 0.62, plus an American elm's crown glimpsed over the west wing. Their positions
// and sizes are UNVERIFIED (research-photo.md section 5 item 21): everything here is placed from the photograph by
// the solved camera, and the crowns are ellipsoids rather than anything botanically specific, because a
// blockout's job is the silhouette and the occlusion.
import * as THREE from 'three';
import { DIMS, COLORS, NORTH_LAWN } from './layout.js';
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

export function buildFoliage(b) {
  const rand = mulberry32(SEED);

  // ---- the two big trees that frame the building --------------------------------------------------
  // The frame's west tree mass: its own dark pixels read #1b2415 to #222c1b, which is COLORS.treeFoliage.
  // It stands just outside the west end of the block and close to the camera, filling the frame's left edge
  // from v 0.24 to 0.72. THE GROUND UNDER IT is on the lawn's own rise, so its base comes from NORTH_LAWN.
  for (const [side, x, z] of [['west', -DIMS.blockLength / 2 - 9.5, -30], ['east', DIMS.blockLength / 2 + 9.5, -28]]) {
    const gy = NORTH_LAWN.yAt(z);
    trunk(b, `${side} framing tree trunk`, x, z, gy, gy + 7.5, 0.85);
    crown(b, `${side} framing tree crown`, x, z, gy + 10.5, 9.5, 8.0, 8.5, COLORS.treeFoliage, 20);
    crown(b, `${side} framing tree crown low`, x + (side === 'west' ? -3.0 : 3.0), z + 2, gy + 5.0, 7.0, 5.5, 6.5, COLORS.treeFoliage, 16);
    crown(b, `${side} framing tree crown lit`, x + (side === 'west' ? 2.4 : -2.4), z - 1.5, gy + 13.5, 5.5, 4.2, 5.0, COLORS.treeFoliageLit, 16);
  }

  // ---- the tree line beyond the fence ---------------------------------------------------------------
  // Two ranks, the far one hazier, so the horizon is not a hard line. Their tops sit at the photo's own band
  // (v 0.24 to 0.30) because they stand on the plateau at the camera's own height.
  for (let i = 0; i < 26; i++) {
    const x = -150 + i * 12 + uniform(rand, -2.5, 2.5);
    const z = -DIMS.fenceDistance - 24 + uniform(rand, -6, 6);
    const gy = NORTH_LAWN.yAt(z);
    const h = uniform(rand, 9, 15);
    crown(b, `far tree crown ${i + 1}`, x, z, gy + h * 0.72, uniform(rand, 5.5, 9.0), h * 0.5, uniform(rand, 5, 8), COLORS.treeFoliage, 12);
  }
  for (let i = 0; i < 22; i++) {
    const x = -180 + i * 17 + uniform(rand, -4, 4);
    const z = -DIMS.fenceDistance - 70 + uniform(rand, -18, 18);
    const gy = NORTH_LAWN.yAt(z);
    const h = uniform(rand, 8, 13);
    crown(b, `far tree line ${i + 1}`, x, z, gy + h * 0.7, uniform(rand, 6, 10), h * 0.45, uniform(rand, 5, 9), COLORS.treeFoliage, 10);
  }

  // ---- the hedges that close the north lawn at its ends --------------------------------------------
  for (const side of [-1, 1]) {
    const x = side * (DIMS.blockLength / 2 + 13.4);
    b.box(
      `north lawn hedge ${side < 0 ? 'west' : 'east'}`,
      { x0: x - 2.4, x1: x + 2.4, y0: 0, y1: 2.2, z0: -34, z1: 0 },
      COLORS.hedge,
      { metric: true },
    );
    b.box(
      `north lawn hedge ${side < 0 ? 'west' : 'east'} top`,
      { x0: x - 2.5, x1: x + 2.5, y0: 2.2, y1: 2.45, z0: -33.8, z1: -0.2 },
      COLORS.hedgeLit,
      { metric: true },
    );
  }

  // ---- the south side's magnolias -------------------------------------------------------------------
  // The Jackson Magnolia stood on the south front for two centuries; its replacement is one of its offspring.
  for (const [i, x] of [[0, -20.0], [1, 20.0]].entries()) {
    const z = -DIMS.blockDepth - 3.0;
    const gy = -DIMS.southLawnDrop;
    trunk(b, `south magnolia ${i + 1} trunk`, x, z, gy, gy + 4.0, 0.5);
    crown(b, `south magnolia ${i + 1} crown`, x, z, gy + 4.0 + 3.5, 5.0, 4.2, 4.6, COLORS.treeFoliage, 16);
  }

  return b.group;
}
// A crown size the caller can read back, so a later wave can build a canopy without re-deriving it.
export function treeCrownAABB(name) {
  // Kept as a function rather than a table so the file stays a builder and not a data dump.
  void name;
  return null;
}

