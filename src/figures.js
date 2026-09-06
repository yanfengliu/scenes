// The person in blue at the landing: a simple low-poly figure with no face, sized from the frame fraction
// the plan gives at their depth (about 1.28 m), standing on the street's height field.
import * as THREE from 'three';
import * as L from './layout.js';
import { material } from './primitives.js';
import { darker } from './paving.js';

const C = L.COLORS;

export function buildFigures(b) {
  const feet = L.rayHitGround(L.PERSON.u, L.PERSON.v + L.PERSON.height / 2, L.streetY);
  const h = L.PERSON.height * L.frameSizeAtDepth(L.worldToUV(feet).depth).height;
  person(b, feet, h);
}

// Proportions in fractions of the height: legs to 0.47, torso 0.45 to 0.82, head centre at 0.91.
// The jacket is the sampled blue; the trousers a darker blue (by eye), the head the sampled skin, the
// hair near-black. They face down the street, so the photo camera sees their back.
function person(b, feet, h) {
  const legs = darker(C.person, 0.55);
  const hair = 0x2a2320;
  const part = (name, sx, y0, y1, sz, color, dx = 0, dz = 0) => b.box(name, { x0: feet.x + dx - sx / 2, x1: feet.x + dx + sx / 2, y0: feet.y + y0 * h, y1: feet.y + y1 * h, z0: feet.z + dz - sz / 2, z1: feet.z + dz + sz / 2 }, color);
  part('person leg left', 0.11 * h, 0.0, 0.47, 0.13 * h, legs, -0.06 * h);
  part('person leg right', 0.11 * h, 0.0, 0.47, 0.13 * h, legs, 0.06 * h);
  part('person torso', 0.3 * h, 0.45, 0.82, 0.17 * h, C.person);
  part('person arm left', 0.075 * h, 0.5, 0.8, 0.09 * h, C.person, -0.19 * h);
  part('person arm right', 0.075 * h, 0.5, 0.8, 0.09 * h, C.person, 0.19 * h);
  part('person collar', 0.12 * h, 0.82, 0.86, 0.12 * h, C.skin);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.085 * h, 10, 8), material(C.skin));
  head.position.set(feet.x, feet.y + 0.91 * h, feet.z);
  b.add(head, 'person head');
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09 * h, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), material(hair));
  cap.position.set(feet.x, feet.y + 0.915 * h, feet.z);
  b.add(cap, 'person hair');
}
