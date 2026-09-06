// Instancing helpers: one InstancedMesh per material for the repeated pieces (stone slabs, wall stones,
// kawara tiles, lattice slats), each instance with its own transform, a small color jitter around the
// material's mean, and a UV offset so shared geometry does not repeat the same texel pattern.
import * as THREE from 'three';
import { texturesFor } from './textures.js';
import { makeMaterial } from './materials.js';

// A material carrying the albedo for `kind` at `mean`, through the material factory (unlit until
// phase 4 flips MATERIALS.lit), with the phase 4 maps kept aside as well.
export function surface(kind, mean, { seed = 1, side, transparent = false, instancedUv = false } = {}) {
  const t = texturesFor(kind, mean, { seed });
  const mat = makeMaterial({ map: t.map, mean, transparent, side, normalMap: t.normalMap, roughnessMap: t.roughnessMap, roughness: t.roughness });
  mat.userData.pbr = { normalMap: t.normalMap ?? null, roughnessMap: t.roughnessMap ?? null, kind, mean };
  if (instancedUv) withInstanceUvOffset(mat);
  return mat;
}

// Patch a material so each instance shifts its map UVs by the geometry's `instanceUvOffset` attribute.
export function withInstanceUvOffset(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 instanceUvOffset;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n\tvMapUv += instanceUvOffset;\n#endif');
  };
  material.customProgramCacheKey = () => 'instanceUvOffset';
  return material;
}

const tmpM = new THREE.Matrix4();
const tmpP = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpE = new THREE.Euler();
const tmpC = new THREE.Color();

// Build an InstancedMesh. items: [{ position: [x, y, z], euler?: [x, y, z], quaternion?, basis?: Matrix4,
// scale?: [sx, sy, sz], tint?: number (multiplier around 1), color?: hex (an sRGB color the tint then
// scales), uv?: [du, dv] }]. Geometry is cloned when UV offsets are used so the attribute belongs to
// this mesh.
export function instanced(name, geometry, material, items, { uvOffsets = true } = {}) {
  const geo = uvOffsets ? geometry.clone() : geometry;
  const mesh = new THREE.InstancedMesh(geo, material, items.length);
  const uvs = uvOffsets ? new Float32Array(items.length * 2) : null;
  let anyTint = false;
  items.forEach((it, i) => {
    tmpP.set(it.position[0], it.position[1], it.position[2]);
    if (it.quaternion) tmpQ.copy(it.quaternion);
    else if (it.basis) tmpQ.setFromRotationMatrix(it.basis);
    else if (it.euler) tmpQ.setFromEuler(tmpE.set(it.euler[0], it.euler[1], it.euler[2]));
    else tmpQ.identity();
    if (it.scale) tmpS.set(it.scale[0], it.scale[1], it.scale[2]);
    else tmpS.set(1, 1, 1);
    tmpM.compose(tmpP, tmpQ, tmpS);
    mesh.setMatrixAt(i, tmpM);
    if (it.tint !== undefined || it.color !== undefined) {
      anyTint = true;
      if (it.color !== undefined) tmpC.set(it.color);
      else tmpC.setRGB(1, 1, 1, THREE.LinearSRGBColorSpace);
      if (it.tint !== undefined) tmpC.multiplyScalar(it.tint);
      mesh.setColorAt(i, tmpC);
    }
    if (uvs) {
      uvs[i * 2] = it.uv ? it.uv[0] : 0;
      uvs[i * 2 + 1] = it.uv ? it.uv[1] : 0;
    }
  });
  if (uvs) geo.setAttribute('instanceUvOffset', new THREE.InstancedBufferAttribute(uvs, 2));
  if (anyTint) mesh.instanceColor.needsUpdate = true;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  mesh.name = name;
  return mesh;
}

// A paving slab: a rectangle extruded to `thickness` with a small bevel (worn edges) cut inward, so the
// footprint stays exactly 1 x 1 and neighbouring slabs keep their joint. Lies flat with its top face at
// y = 0 and centred in x and z; instances scale it.
export function slabGeometry(thickness = 0.08, bevel = 0.015) {
  const shape = new THREE.Shape([new THREE.Vector2(-0.5, -0.5), new THREE.Vector2(0.5, -0.5), new THREE.Vector2(0.5, 0.5), new THREE.Vector2(-0.5, 0.5)]);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness - bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 1, steps: 1 });
  // ExtrudeGeometry extrudes along +z from z = 0 to depth, with the bevel going outside that range: lay
  // it flat (shape x -> x, shape y -> -z, extrusion -> +y) with the top face at y = 0.
  geo.rotateX(-Math.PI / 2);
  geo.computeBoundingBox();
  geo.translate(0, -geo.boundingBox.max.y, 0);
  return geo;
}

// A wall stone: a box with its corners softened by scaling a low-poly sphere, or a plain box for ashlar.
export function stoneBlockGeometry(rounded) {
  if (!rounded) return new THREE.BoxGeometry(1, 1, 1);
  const geo = new THREE.SphereGeometry(0.5, 8, 6);
  const pos = geo.getAttribute('position');
  // Push the sphere toward a box: normalise by the max coordinate so faces flatten while edges stay round.
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const m = Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) / 0.5;
    const k = 0.72 / m + 0.28;
    pos.setXYZ(i, x * k, y * k, z * k);
  }
  pos.needsUpdate = true;
  return geo;
}

// A kawara pan tile: a plane with an S-shaped section across its width (sangawara), lying in the xz
// plane with the profile in y, x across the tile and -z up the slope. Width 0.3, length 0.33.
export function panTileGeometry(width = 0.3, length = 0.33, amplitude = 0.028) {
  const geo = new THREE.PlaneGeometry(width, length, 10, 2);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) / width; // -0.5..0.5 across
    const z = pos.getZ(i) / length; // -0.5..0.5 along
    const s = Math.sin(x * Math.PI * 2) * amplitude; // one S wave across the tile
    const lift = (z + 0.5) * 0.012; // the lower (eave, +z) end rides up on the row below it
    pos.setY(i, s + lift);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

// A ridge or cap tile: a half cylinder lying along x, open side down, radius 0.09, length 0.32.
export function ridgeTileGeometry(radius = 0.09, length = 0.32) {
  const geo = new THREE.CylinderGeometry(radius, radius, length, 10, 1, true, 0, Math.PI);
  geo.rotateZ(Math.PI / 2);
  return geo;
}

// A rotation matrix whose local x runs along `along` and whose local y is `up` made orthogonal to it.
export function basisAlong(along, up = new THREE.Vector3(0, 1, 0)) {
  const x = along.clone().normalize();
  const y = up.clone().sub(x.clone().multiplyScalar(up.dot(x))).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  return new THREE.Matrix4().makeBasis(x, y, z);
}

// A round eave-end cap (gatou): a short cylinder whose flat face points along -z.
export function eaveCapGeometry(radius = 0.075, depth = 0.03) {
  const geo = new THREE.CylinderGeometry(radius, radius, depth, 14);
  geo.rotateX(Math.PI / 2);
  return geo;
}
