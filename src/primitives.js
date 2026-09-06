// Mesh-building primitives shared by the scene modules. `createBuilder(group)` returns functions that
// add named meshes to `group`; every mesh gets a name so the probe tool can map a pixel to it.
import * as THREE from 'three';
import * as L from './layout.js';
import { makeMaterial } from './materials.js';

// A flat-colored material through the factory (unlit until phase 4 flips MATERIALS.lit).
export function material(color, extra = {}) {
  return makeMaterial({ color, ...extra });
}

export function hexToVec3(hex) {
  return new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
}

// Rescale BoxGeometry UVs from 0..1 per face to metres, so a repeating texture keeps its world scale.
export function metricBoxUVs(geometry, sx, sy, sz) {
  const uv = geometry.getAttribute('uv');
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z; each face has 4 vertices (2x2 grid).
  const dims = [
    [sz, sy],
    [sz, sy],
    [sx, sz],
    [sx, sz],
    [sx, sy],
    [sx, sy],
  ];
  for (let face = 0; face < 6; face++) {
    const [w, h] = dims[face];
    for (let k = 0; k < 4; k++) {
      const i = face * 4 + k;
      uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
    }
  }
  uv.needsUpdate = true;
  return geometry;
}

export function createBuilder(group) {
  const basis = L.cameraBasis();
  const forward = new THREE.Vector3(...basis.forward);
  const up = new THREE.Vector3(...basis.up);
  const right = new THREE.Vector3(...basis.right);
  const eye = new THREE.Vector3(...basis.eye);

  const add = (mesh, name) => {
    mesh.name = name;
    group.add(mesh);
    return mesh;
  };

  // Axis-aligned box from bounds. `color` may be a hex, a Material, or { sides, top, bottom } for
  // per-face colors or materials.
  function box(name, b, color, { metric = false } = {}) {
    const sx = b.x1 - b.x0;
    const sy = b.y1 - b.y0;
    const sz = b.z1 - b.z0;
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    if (metric) metricBoxUVs(geo, sx, sy, sz);
    const asMaterial = (c) => (c && c.isMaterial ? c : material(c));
    let mat;
    if (color && !color.isMaterial && typeof color === 'object') {
      const sides = asMaterial(color.sides);
      mat = [sides, sides, asMaterial(color.top ?? color.sides), asMaterial(color.bottom ?? color.sides), sides, sides];
    } else {
      mat = asMaterial(color);
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
    return add(mesh, name);
  }

  // A solid whose profile is a polygon in the (s, y) plane, s being metres along -z, extruded from x0 to x1.
  function profileSolid(name, points, x0, x1, color) {
    const shape = new THREE.Shape(points.map(([s, y]) => new THREE.Vector2(s, y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false });
    const mesh = new THREE.Mesh(geo, color && color.isMaterial ? color : material(color));
    mesh.rotation.y = Math.PI / 2; // shape x -> world -z, extrusion -> world +x
    mesh.position.x = x0;
    return add(mesh, name);
  }

  // A band between two height lines y = top(z) and y = bottom(z), sampled along z, extruded from x0 to x1.
  function bandSolid(name, zNear, zFar, top, bottom, x0, x1, color, samples = 12) {
    const upper = [];
    const lower = [];
    for (let i = 0; i <= samples; i++) {
      const z = zNear + ((zFar - zNear) * i) / samples;
      upper.push([-z, top(z)]);
      lower.push([-z, bottom(z)]);
    }
    return profileSolid(name, [...upper, ...lower.reverse()], x0, x1, color);
  }

  // A slab of `thickness` whose top face is the convex polygon through the corners (three or more, in
  // order around it, any orientation), extruded straight down. UVs are in metres: the top and bottom
  // faces measure from corner 0 along the first and last edges, each side from its top edge downward.
  function quadSlab(name, corners, thickness, color) {
    const top = corners.map((c) => new THREE.Vector3(c.x, c.y, c.z));
    const n = top.length;
    const bottom = top.map((p) => p.clone().setY(p.y - thickness));
    const verts = [];
    const uvs = [];
    const e1 = top[1].clone().sub(top[0]);
    const e2 = top[n - 1].clone().sub(top[0]);
    const l1 = e1.length() || 1;
    const l2 = e2.length() || 1;
    const faceUv = (p) => [p.clone().sub(top[0]).dot(e1) / l1, p.clone().sub(top[0]).dot(e2) / l2];
    const tri = (a, b, c, ua, ub, uc) => {
      verts.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      uvs.push(...ua, ...ub, ...uc);
    };
    for (let i = 1; i < n - 1; i++) {
      tri(top[0], top[i], top[i + 1], faceUv(top[0]), faceUv(top[i]), faceUv(top[i + 1]));
      tri(bottom[0], bottom[i + 1], bottom[i], faceUv(top[0]), faceUv(top[i + 1]), faceUv(top[i]));
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const w = top[j].clone().sub(top[i]).length();
      tri(top[i], bottom[i], bottom[j], [0, 0], [0, thickness], [w, thickness]);
      tri(top[i], bottom[j], top[j], [0, 0], [w, thickness], [w, 0]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    return add(new THREE.Mesh(geo, color && color.isMaterial ? color : material(color, { side: THREE.DoubleSide })), name);
  }

  function orientToCamera(mesh, depth) {
    mesh.position.copy(eye).addScaledVector(forward, depth);
    mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, forward.clone().negate()));
  }

  function uvShape(uvPoints, depth) {
    return new THREE.Shape(uvPoints.map(([u, v]) => new THREE.Vector2((u - 0.5) * 2 * basis.tanH * depth, (0.5 - v) * 2 * basis.tanV * depth)));
  }

  // A flat card facing the photo camera at `depth`, outlined in photo (u, v) coordinates.
  function frontalCard(name, uvPoints, depth, color) {
    const geo = new THREE.ShapeGeometry(uvShape(uvPoints, depth));
    const mesh = new THREE.Mesh(geo, material(color, { side: THREE.DoubleSide, fog: false }));
    orientToCamera(mesh, depth);
    return add(mesh, name);
  }

  // A box whose camera-facing front covers the uv box at `depth` and extends `thickness` away from the camera.
  function frontalBox(name, uv, depth, thickness, color) {
    const w = (uv.u1 - uv.u0) * 2 * basis.tanH * depth;
    const h = (uv.v1 - uv.v0) * 2 * basis.tanV * depth;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, thickness), material(color));
    orientToCamera(mesh, depth);
    const c = L.uvToWorld((uv.u0 + uv.u1) / 2, (uv.v0 + uv.v1) / 2, depth);
    mesh.position.set(c.x, c.y, c.z).addScaledVector(forward, thickness / 2);
    return add(mesh, name);
  }

  function ellipsoid(name, center, radii, color, segments = 24) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, segments, Math.round(segments * 0.75)), material(color));
    mesh.scale.set(radii.x, radii.y, radii.z);
    mesh.position.set(center.x, center.y, center.z);
    return add(mesh, name);
  }

  // An ellipsoid whose silhouette covers the uv box at `depth`.
  function uvEllipsoid(name, uv, depth, color, depthRadius) {
    const size = L.frameSizeAtDepth(depth);
    const rx = ((uv.u1 - uv.u0) / 2) * size.width;
    const ry = ((uv.v1 - uv.v0) / 2) * size.height;
    const c = L.uvToWorld((uv.u0 + uv.u1) / 2, (uv.v0 + uv.v1) / 2, depth);
    return ellipsoid(name, c, { x: rx, y: ry, z: depthRadius ?? Math.min(rx, ry) }, color);
  }

  function cylinder(name, x, z, y0, y1, radius, color) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, y1 - y0, 12), color && color.isMaterial ? color : material(color));
    mesh.position.set(x, (y0 + y1) / 2, z);
    return add(mesh, name);
  }

  return {
    group,
    add,
    basis,
    eye,
    forward,
    up,
    right,
    box,
    profileSolid,
    bandSolid,
    quadSlab,
    frontalCard,
    frontalBox,
    ellipsoid,
    uvEllipsoid,
    cylinder,
  };
}

// The four top corners of a stepped roof, in order: outer-near, inner-near, inner-far, outer-far.
export function steppedRoofCorners(R) {
  return [
    { x: R.xOuter, y: R.yNear, z: R.zNear },
    { x: R.xInner, y: R.yNear + R.rise, z: R.zNear },
    { x: R.xInner, y: R.yFar + R.rise, z: R.zFar },
    { x: R.xOuter, y: R.yFar, z: R.zFar },
  ];
}

// Height of a stepped roof's outer edge at z.
export function roofOuterY(R, z) {
  const t = THREE.MathUtils.clamp((z - R.zNear) / (R.zFar - R.zNear), 0, 1);
  return R.yNear + (R.yFar - R.yNear) * t;
}
