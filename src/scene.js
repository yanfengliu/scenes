// Assembles the scene from its modules. Everything is positioned from src/layout.js.
import * as THREE from 'three';
import { createBuilder } from './primitives.js';
import { buildBackground } from './background.js';
import { buildPaving } from './paving.js';
import { buildArchitecture } from './architecture.js';
import { buildWalls } from './walls.js';
import { buildRoofs } from './roofs.js';
import { buildFacades } from './facades.js';
import { buildVegetation } from './vegetation.js';
import { buildFigures } from './figures.js';

export function buildScene() {
  const group = new THREE.Group();
  group.name = 'scene';
  const b = createBuilder(group);
  b.THREE = THREE;
  buildBackground(b);
  buildPaving(b);
  buildWalls(b);
  buildArchitecture(b);
  buildRoofs(b);
  buildFacades(b);
  buildVegetation(b);
  buildFigures(b);
  return { group };
}
