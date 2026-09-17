// The scene graph: a group named 'whitehouse' holding every module's meshes, in the order they are built.
// The sibling of scene 1's src/scene.js, and deliberately the same shape -- one place that says what the
// scene is made of, so a reader can see the whole composition at once.
import * as THREE from 'three';
import { createBuilder } from '../primitives.js';
import { buildSky } from './sky.js';
import { buildGrounds } from './grounds.js';
import { buildBuilding } from './building.js';
import { buildPortico } from './portico.js';
import { buildFoliage } from './foliage.js';

export function buildScene() {
  const group = new THREE.Group();
  group.name = 'whitehouse';
  // createBuilder is scene-agnostic EXCEPT for its basis/eye/forward/up/right, which come from scene 1's
  // photo camera (src/primitives.js's own header says so). This scene uses only box/add/material and
  // buildSky reads b.eye -- so b.eye is overwritten below with THIS scene's camera eye before the sky is
  // built, which is the one place the builder's Japan-derived state reaches anything.
  const b = createBuilder(group);
  b.THREE = THREE;
  b.eye.set(0, 9.086, 47.863); // CAMERA.eye, repeated here as a literal so the builder's Japan eye cannot leak

  // Order matters only for the eye: the sky dome is centred on the camera, so it is built after b.eye is set.
  buildSky(b);
  buildGrounds(b);
  buildBuilding(b);
  buildPortico(b);
  buildFoliage(b);
  return { group };
}
