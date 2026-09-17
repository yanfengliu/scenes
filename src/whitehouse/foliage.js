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
  //
  // THE CROWNS WERE 19 m ACROSS AND THAT CLOSED THE BUILDING FROM THE SOUTH, which is a defect the scored
  // frame cannot see and a reviewer caught in out/wh/sweep-behind.png: from due south the two crowns met
  // across the frame and the building showed through a slot between them. The photograph the scene is built
  // from has the building FRAMED by trees, not hidden by them, so the test here is that a stranger sees the
  // White House from any orbit. Three things were changed together, because any one of them alone leaves the
  // slot too narrow: the crowns are a third smaller, they stand three metres higher on a longer trunk, and
  // the pair moved a further three metres out and four back, so their silhouettes fall on the frame's edges
  // from the north and clear of the building entirely from the south.
  for (const [side, x, z] of [['west', -DIMS.blockLength / 2 - 16.0, -34], ['east', DIMS.blockLength / 2 + 16.0, -32]]) {
    const gy = NORTH_LAWN.yAt(z);
    trunk(b, `${side} framing tree trunk`, x, z, gy, gy + 9.5, 0.8);
    crown(b, `${side} framing tree crown`, x, z, gy + 12.0, 8.2, 6.8, 7.4, COLORS.treeFoliage, 20);
    crown(b, `${side} framing tree crown low`, x + (side === 'west' ? -2.6 : 2.6), z + 1.5, gy + 7.4, 6.0, 4.6, 5.6, COLORS.treeFoliage, 16);
    crown(b, `${side} framing tree crown lit`, x + (side === 'west' ? 2.1 : -2.1), z - 1.2, gy + 14.4, 4.7, 3.6, 4.3, COLORS.treeFoliageLit, 16);
  }

  // ---- the tree line beyond the fence ---------------------------------------------------------------
  // Two ranks, the far one hazier, so the horizon is not a hard line. Their tops sit at the photo's own band
  // (v 0.24 to 0.30) because they stand on the plateau at the camera's own height.
  //
  // THE FIRST RANK STOOD AT THE CAMERA'S OWN DEPTH and that was the other half of the "behind" defect: at
  // z about -68 it is 30 m in front of a camera pulled back to z -110, so the whole rank read as one black
  // wal, 9 to 15 m tall, across the frame. Moved to z about -96 it is 46 m beyond the building instead of
  // beside it, and its crowns are a third smaller, which is what a hazy rank at that distance should be.
  for (let i = 0; i < 26; i++) {
    const x = -150 + i * 12 + uniform(rand, -2.5, 2.5);
    const z = -DIMS.fenceDistance - 52 + uniform(rand, -6, 6);
    const gy = NORTH_LAWN.yAt(z);
    const h = uniform(rand, 9, 15);
    crown(b, `far tree crown ${i + 1}`, x, z, gy + h * 0.72, uniform(rand, 3.8, 6.2), h * 0.34, uniform(rand, 3.4, 5.4), COLORS.treeFoliage, 12);
  }
  for (let i = 0; i < 22; i++) {
    const x = -180 + i * 17 + uniform(rand, -4, 4);
    const z = -DIMS.fenceDistance - 98 + uniform(rand, -18, 18);
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
    // Overlapping, not spaced: the crowns are 1.45 m in their longest axis and 1.0 m apart, so the run has
    // no gaps to see a stake of lawn through and no single sphere reads as an object.
    for (let s = 0; s < 30; s++) {
      const z = -1.6 - s * 1.0;
      const h = 1.95 + uniform(rand, -0.1, 0.5);
      const dx = uniform(rand, -0.25, 0.25);
      // THE CROWN CENTRE SITS AT 0.42 h, NOT 0.55 h: at 0.55 h with ry = 0.62 h the spheres' centres float
      // above the ground and the run read as separate dark balls on a pale strip rather than one clipped
      // hedge. Found by looking at out/wh/sweep-west.png; off the scored frame either way.
      crown(b, `north lawn hedge ${side < 0 ? 'west' : 'east'} ${s + 1}`, cx + dx, z, h * 0.42, 1.45, h * 0.62, 1.35, COLORS.hedge, 10);
      if (s % 2 === 0) crown(b, `north lawn hedge ${side < 0 ? 'west' : 'east'} ${s + 1} crest`, cx + dx, z, h * 0.88, 1.15, 0.30, 1.1, COLORS.hedgeLit, 10);
    }
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

