// One factory for every material, so phase 4 can switch the scene to lit materials with a flag instead
// of a rewrite. Unlit today (MeshBasicMaterial): the photo-sampled colors are already lit. With
// MATERIALS.lit set, the same maps go onto MeshStandardMaterial, with the normal and roughness maps the
// texture generators already produce.
import * as THREE from 'three';

export const MATERIALS = { lit: false };

// params: map, color, alphaTest, side, transparent, vertexColors, plus normalMap, roughnessMap and
// roughness for the lit variant. Undefined entries are dropped so three.js never sees them.
export function makeMaterial(params = {}) {
  const { normalMap, roughnessMap, roughness, ...rest } = params;
  const clean = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  if (!MATERIALS.lit) return new THREE.MeshBasicMaterial(clean);
  return new THREE.MeshStandardMaterial({ ...clean, normalMap: normalMap ?? null, roughnessMap: roughnessMap ?? null, roughness: roughness ?? 1 });
}

// A foliage card material: an alpha-tested, two-sided card texture whose color comes from the instance
// (or vertex) colors, so one texture serves every blossom or leaf tint.
export function foliageMaterial(map, { alphaTest = 0.5, side = THREE.DoubleSide, vertexColors = false } = {}) {
  return makeMaterial({ map, alphaTest, side, transparent: false, vertexColors });
}
