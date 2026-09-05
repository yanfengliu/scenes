// The figure in blue at the landing (a block-out until phase 3).
import * as L from './layout.js';

const C = L.COLORS;

export function buildFigures(b) {
  // Person in blue at the landing, sized from the frame fraction at their depth.
  const feet = L.rayHitGround(L.PERSON.u, L.PERSON.v + L.PERSON.height / 2, L.streetY);
  const height = L.PERSON.height * L.frameSizeAtDepth(L.worldToUV(feet).depth).height;
  b.box('person body', { x0: feet.x - 0.28, x1: feet.x + 0.28, y0: feet.y, y1: feet.y + height * 0.82, z0: feet.z - 0.18, z1: feet.z + 0.18 }, C.person);
  b.ellipsoid('person head', { x: feet.x, y: feet.y + height * 0.9, z: feet.z }, { x: height * 0.1, y: height * 0.1, z: height * 0.1 }, C.skin);
}
