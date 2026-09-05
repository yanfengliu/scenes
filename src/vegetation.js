// Vegetation block-out: the weeping cherry as a cluster of ellipsoids, the evergreen as a cone, the
// shrubs and the potted plant as blobs. Phase 3 replaces all of it; positions come from the photo.
import * as THREE from 'three';
import * as L from './layout.js';
import { material } from './primitives.js';

const C = L.COLORS;

export function buildVegetation(b) {
  cherry(b);
  evergreen(b);
  shrubs(b);
}

function cherry(b) {
  const d = L.DEPTHS.cherry;
  const base = L.uvToWorld(L.CHERRY.trunk.u, L.CHERRY.trunk.v, d);
  b.cylinder('cherry trunk', base.x, base.z, base.y - 0.6, base.y + 3.0, 0.35, C.trunk);
  // The main canopy stays behind the right machiya's far end (a shallow depth radius, set back a
  // little), while the upper-right lobes are branches reaching forward in front of the balcony.
  b.uvEllipsoid('cherry canopy', { u0: 0.4, u1: 0.68, v0: 0.17, v1: 0.55 }, d + 1.5, C.cherryDense, 1.8);
  b.uvEllipsoid('cherry lobe left', { u0: 0.35, u1: 0.5, v0: 0.19, v1: 0.36 }, d - 1, C.cherryEdge, 2.4);
  b.uvEllipsoid('cherry lobe left mid', { u0: 0.35, u1: 0.5, v0: 0.33, v1: 0.57 }, d - 1.2, C.cherryLeft, 2.6);
  b.uvEllipsoid('cherry lobe far left', { u0: 0.28, u1: 0.4, v0: 0.32, v1: 0.56 }, d - 0.5, C.cherryFarLeft, 2.0);
  b.uvEllipsoid('cherry lobe top', { u0: 0.56, u1: 0.78, v0: 0.17, v1: 0.3 }, 12, C.cherryEdge, 1.6);
  b.uvEllipsoid('cherry lobe right', { u0: 0.72, u1: 0.83, v0: 0.18, v1: 0.32 }, 11, C.cherryEdge, 1.0);
  b.uvEllipsoid('cherry lobe lower', { u0: 0.42, u1: 0.62, v0: 0.4, v1: 0.6 }, d - 1, C.cherryShadow, 2.8);
  b.uvEllipsoid('cherry lobe low', { u0: 0.48, u1: 0.6, v0: 0.5, v1: 0.63 }, d - 1.3, C.cherryLow, 1.6);
  b.uvEllipsoid('cherry lobe lower right', { u0: 0.6, u1: 0.66, v0: 0.4, v1: 0.55 }, d + 2, C.cherryShade, 1.4);
  // Pendulous strands at the lower left of the canopy.
  const strandBoxes = [
    { u0: 0.4, u1: 0.43, v0: 0.44, v1: 0.64 },
    { u0: 0.43, u1: 0.46, v0: 0.46, v1: 0.62 },
    { u0: 0.455, u1: 0.485, v0: 0.45, v1: 0.64 },
    { u0: 0.49, u1: 0.52, v0: 0.5, v1: 0.6 },
    { u0: 0.53, u1: 0.56, v0: 0.52, v1: 0.61 },
  ];
  strandBoxes.forEach((uv, i) => b.uvEllipsoid(`cherry strand ${i}`, uv, d - 1.5, C.cherryStrand, 0.4));
}

function evergreen(b) {
  const d = L.DEPTHS.evergreen;
  const size = L.frameSizeAtDepth(d);
  const radius = ((L.EVERGREEN.u1 - L.EVERGREEN.u0) / 2) * size.width;
  const height = (L.EVERGREEN.v1 - L.EVERGREEN.v0) * size.height;
  const c = L.uvToWorld((L.EVERGREEN.u0 + L.EVERGREEN.u1) / 2, (L.EVERGREEN.v0 + L.EVERGREEN.v1) / 2, d);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 20), material(C.evergreen));
  cone.position.set(c.x, c.y, c.z);
  b.add(cone, 'evergreen');
  b.cylinder('evergreen trunk', c.x, c.z, -12, c.y - height / 2 + 0.2, 0.45, C.trunk);
}

function shrubs(b) {
  // The shrub grows on the planter strip and spills forward over the fence boards (photo: green below
  // the cap at u 0.72-0.78), and a small dark shrub stands by the pot.
  b.ellipsoid('shrub', L.uvToWorld(L.SHRUB.u, L.SHRUB.v + 0.03, 6.2), { x: 0.7, y: 0.35, z: 0.8 }, C.shrub);
  b.ellipsoid('shrub 2', L.uvToWorld(0.805, 0.83, 8), { x: 0.35, y: 0.5, z: 0.35 }, C.shrubDeep);
  // The potted plant on the left low wall (its pot is built with the walls).
  const p = L.leftPotPlacement();
  b.ellipsoid('left plant', { x: p.x, y: p.potY + 0.45, z: p.z }, { x: 0.6, y: 0.45, z: 1.4 }, C.plant);
}

