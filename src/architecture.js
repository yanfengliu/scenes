// The pieces around the houses that are still block-out (the boarded undersides of house 1's top roof,
// the right machiya's roof mass under its tiles, the paved bands of the right side) and house 1's
// dormer body. Positions and colors come from src/layout.js.
import * as THREE from 'three';
import * as L from './layout.js';
import { surface } from './instancing.js';
import { mortarOf } from './paving.js';

const C = L.COLORS;
const S = L.STREET;

export function buildArchitecture(b) {
  leftSide(b);
  rightSide(b);
}

function leftSide(b) {
  const H = L.LEFT_HOUSE_1;
  // The boarded underside of house 1's top roof (its tiles are built by roofs.js): black near the
  // camera and lit warm toward the far overhang (photo cells along v 0.11-0.16), so three boxes.
  b.box('left house 1 roof', { x0: H.back, x1: H.front - 0.5, y0: H.roofUnder, y1: H.roofEave - 0.02, z0: H.upperZ0, z1: H.z1 }, C.roofUnderDark);
  b.box('left house 1 roof mid', { x0: H.back, x1: H.front - 0.5, y0: H.roofUnder, y1: H.roofEave - 0.02, z0: -10.0, z1: H.upperZ0 }, C.roofUnderMid);
  b.box('left house 1 roof far', { x0: H.back, x1: H.front - 0.5, y0: H.roofUnder, y1: H.roofEave - 0.02, z0: H.roofZ0, z1: -10.0 }, C.roofUnderFar);
  // A dormer rising from the mezzanine's top through the roof's lower edge near the camera: its dark
  // boarded front fills the photo's top-left corner (dark at u < 0.06, v < 0.09). A wedge whose top
  // follows its shed roof (tiled by roofs.js: from roofEave + 0.62 at the front to + 1.02 at the back).
  const wedge = new THREE.Shape([
    new THREE.Vector2(H.front - 1.0, H.upperTop),
    new THREE.Vector2(H.front, H.upperTop),
    new THREE.Vector2(H.front, H.roofEave + 0.61),
    new THREE.Vector2(H.front - 1.0, H.roofEave + 0.92),
  ]);
  const dormer = new THREE.Mesh(new THREE.ExtrudeGeometry(wedge, { depth: 3.4, bevelEnabled: false }), surface('woodWide', C.house1Upper, { seed: 70 }));
  dormer.position.z = -6.4;
  b.add(dormer, 'left house 1 dormer');
}

function rightSide(b) {
  const T = L.RIGHT_TERRACE;
  const M = L.RIGHT_MACHIYA;
  // The walkway in front of the machiya on the terrace line, and the paving beyond the planter where
  // the landing widens to the right.
  b.bandSolid('right paving', -15.3, -40, (z) => L.rightTerraceY(z), (z) => L.rightTerraceY(z) - 6, S.x1, T.xInner, C.landing, 12);
  // The walkway band starts 5 cm behind the fence core's stone line so the stones stand proud of it.
  // Since iteration 3 it is the mortar BODY under `right walkway slabs` (src/paving.js), which pave it
  // from the fence's foot to the machiya plinth; past the plinth the band is all there is, and nothing
  // there is ever seen. Its colour is the flagstones' own mean darkened, so the joints read as joints.
  // It steps where the slabs step, so the 0.40 m drop at `RIGHT_STEP.z` is UNDER them rather than a band
  // standing 0.40 m proud of them at the frame's bottom edge. It does not call `L.rightWalkY`: that one
  // takes the step's jog at `xSplit` into account and this band is one profile across the whole width, so
  // it uses the inner line for all of it.
  //
  // Two numbers here are load-bearing and the first version had both wrong. `bandSolid` SAMPLES its height
  // function and joins the samples, so a discontinuity comes out as a slant one sample long: at 40 samples
  // that is 0.3825 m, and the slant crossed the step and stood up to 0.076 m proud of the lower flagstones
  // over x 2.15 to 2.78 — a dark ridge at the foot of the step from any pose but the photo's. And the
  // 0.15 m the drop was taken "behind" the step did nothing at all, because -5.05 and -5.20 fell inside
  // the SAME sample gap (-5.3550 to -4.9725): the profile was identical with the offset and without it, at
  // 10 samples and at 40, which a critic proved by evaluating it. So: 160 samples, a gap of 0.0956 m, and
  // the drop taken a whole riser depth behind the step, which puts the slant inside the riser slab's own
  // body (z -5.05 to -5.17) where nothing can see it.
  const walkBandY = (z) => L.rightTerraceY(z) - (z > L.RIGHT_STEP.z - 0.12 ? L.RIGHT_STEP.drop : 0);
  b.bandSolid('right walkway', 0, -15.3, walkBandY, (z) => L.rightTerraceY(z) - 8, T.xInner + 0.05, T.xOuter, mortarOf(C.walkwayLit), 160);
  b.bandSolid('right walkway far', -15.3, -40, (z) => L.rightTerraceY(z), (z) => L.rightTerraceY(z) - 8, T.xInner, T.xOuter, C.landing, 12);

  // The right machiya's roof mass under its tiles: the dark eave block whose tile ends catch the light
  // only near the camera, its cap over the upper floor's far end, and the lit fascia.
  // Its top was M.roofY + 0.5 = 7.45 while the tiles started at 7.62; with the eave edge dropped to 7.32
  // (RIGHT_MACHIYA.roofThickness) a 7.45 block would stand through its own roof at the eave.
  b.box('right house roof', { x0: M.topEaveEdge, x1: M.back, y0: M.roofY, y1: M.roofY + M.roofThickness - 0.05, z0: M.roofZ0, z1: M.z1 }, { sides: C.eaveDark, top: C.eaveDark, bottom: C.topEaveUnder });
  b.box('right house roof cap', { x0: M.front - 0.3, x1: M.back, y0: M.roofY, y1: M.roofY + M.roofThickness - 0.05, z0: M.upperZ0, z1: M.roofZ0 }, C.eaveDark);
  b.box('right house fascia', { x0: M.topEaveEdge - 0.08, x1: M.topEaveEdge + 0.02, y0: M.roofY, y1: M.roofY + M.roofThickness, z0: M.fasciaZ0, z1: M.z1 }, C.topRoofRight);
}
