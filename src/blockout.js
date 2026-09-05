// Phase 1 block-out: every landmark from docs/PLAN.md as a simple mesh with a flat color sampled from
// the photo. Positions come from src/layout.js: photo (u, v) landmarks projected into the world at a
// chosen depth, or dropped onto the street and terrace height fields.
import * as THREE from 'three';
import * as L from './layout.js';

const C = L.COLORS;
const S = L.STREET;

function material(color, extra = {}) {
  return new THREE.MeshBasicMaterial({ color, ...extra });
}

function hexToVec3(hex) {
  return new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
}

export function buildBlockout() {
  const group = new THREE.Group();
  group.name = 'blockout';
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

  // ---- primitives ------------------------------------------------------------------------------

  // Axis-aligned box from bounds. `color` may be a hex or { sides, top, bottom } for per-face colors.
  function box(name, b, color) {
    const geo = new THREE.BoxGeometry(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0);
    let mat;
    if (typeof color === 'object') {
      const sides = material(color.sides);
      mat = [sides, sides, material(color.top ?? color.sides), material(color.bottom ?? color.sides), sides, sides];
    } else {
      mat = material(color);
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2);
    return add(mesh, name);
  }

  // A solid whose profile is a polygon in the (s, y) plane, s being metres along -z, extruded from x0 to x1.
  function profileSolid(name, points, x0, x1, color) {
    const shape = new THREE.Shape(points.map(([s, y]) => new THREE.Vector2(s, y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false });
    const mesh = new THREE.Mesh(geo, material(color));
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

  // A slab sloping in the x direction: from (x0, y0) to (x1, y1), spanning z0..z1, `thickness` thick.
  function slopedSlab(name, { x0, y0, x1, y1 }, z0, z1, thickness, color) {
    const length = Math.hypot(x1 - x0, y1 - y0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, thickness, z1 - z0), material(color));
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2 + thickness / 2, (z0 + z1) / 2);
    mesh.rotation.z = Math.atan2(y1 - y0, x1 - x0);
    return add(mesh, name);
  }

  // A single double-sided quadrilateral through four corners, in order around the quad.
  function quad(name, corners, color) {
    const p = corners.map((c) => new THREE.Vector3(c.x, c.y, c.z));
    const verts = [];
    const tri = (a, b, c) => verts.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    tri(p[0], p[1], p[2]);
    tri(p[0], p[2], p[3]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return add(new THREE.Mesh(geo, material(color, { side: THREE.DoubleSide })), name);
  }

  // A slab of `thickness` whose top face is the quadrilateral through four corners (any orientation),
  // extruded straight down. Corners go around the quad in order.
  function quadSlab(name, corners, thickness, color) {
    const top = corners.map((c) => new THREE.Vector3(c.x, c.y, c.z));
    const bottom = top.map((p) => p.clone().setY(p.y - thickness));
    const verts = [];
    const tri = (a, b, c) => verts.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    tri(top[0], top[1], top[2]);
    tri(top[0], top[2], top[3]);
    tri(bottom[0], bottom[2], bottom[1]);
    tri(bottom[0], bottom[3], bottom[2]);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      tri(top[i], bottom[i], bottom[j]);
      tri(top[i], bottom[j], top[j]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    return add(new THREE.Mesh(geo, material(color, { side: THREE.DoubleSide })), name);
  }

  // A roof slab along the street whose outer edge runs from (zNear, yNear) to (zFar, yFar) at xOuter and
  // whose inner edge at xInner sits `rise` higher: it slopes both along the street and away from it.
  function steppedRoof(name, R, thickness, color) {
    return quadSlab(
      name,
      [
        { x: R.xOuter, y: R.yNear, z: R.zNear },
        { x: R.xInner, y: R.yNear + R.rise, z: R.zNear },
        { x: R.xInner, y: R.yFar + R.rise, z: R.zFar },
        { x: R.xOuter, y: R.yFar, z: R.zFar },
      ],
      thickness,
      color,
    );
  }

  // Height of a stepped roof's outer edge at z, and of the roof surface at (x, z).
  function roofOuterY(R, z) {
    const t = THREE.MathUtils.clamp((z - R.zNear) / (R.zFar - R.zNear), 0, 1);
    return R.yNear + (R.yFar - R.yNear) * t;
  }
  function roofSurfaceY(R, x, z) {
    const t = THREE.MathUtils.clamp((x - R.xOuter) / (R.xInner - R.xOuter), 0, 1);
    return roofOuterY(R, z) + R.rise * t;
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

  // Color at photo row v from [[v, color], ...] stops (linear between stops, clamped at the ends).
  function colorAtRow(stops, v, out) {
    let k = 1;
    while (k < stops.length - 1 && v > stops[k][0]) k++;
    const [v0, col0] = stops[k - 1];
    const [v1, col1] = stops[k];
    const t = THREE.MathUtils.clamp((v - v0) / (v1 - v0), 0, 1);
    return out.set(col0).lerp(new THREE.Color(col1), t);
  }

  // A card facing the photo camera bounded above by a ridge polyline in photo (u, v) and below by row
  // vBottom, filled with a vertical color gradient. Built as a grid so every stop row is a vertex row
  // and the gradient is exact, unlike vertex colors on an outline-only shape.
  function ridgeCard(name, ridge, vBottom, depth, stops, columns = 60, rows = 8) {
    const ridgeV = (u) => {
      if (u <= ridge[0][0]) return ridge[0][1];
      for (let i = 1; i < ridge.length; i++) {
        if (u <= ridge[i][0]) {
          const [u0, v0] = ridge[i - 1];
          const [u1, v1] = ridge[i];
          return v0 + ((v1 - v0) * (u - u0)) / (u1 - u0);
        }
      }
      return ridge[ridge.length - 1][1];
    };
    const positions = [];
    const colors = [];
    const c = new THREE.Color();
    const u0 = ridge[0][0];
    const u1 = ridge[ridge.length - 1][0];
    for (let i = 0; i <= columns; i++) {
      const u = u0 + ((u1 - u0) * i) / columns;
      const top = ridgeV(u);
      for (let j = 0; j <= rows; j++) {
        const v = top + ((vBottom - top) * j) / rows;
        positions.push((u - 0.5) * 2 * basis.tanH * depth, (0.5 - v) * 2 * basis.tanV * depth, 0);
        colorAtRow(stops, v, c);
        colors.push(c.r, c.g, c.b);
      }
    }
    const index = [];
    for (let i = 0; i < columns; i++) {
      for (let j = 0; j < rows; j++) {
        const a = i * (rows + 1) + j;
        const b = a + rows + 1;
        index.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(index);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }));
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
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, y1 - y0, 12), material(color));
    mesh.position.set(x, (y0 + y1) / 2, z);
    return add(mesh, name);
  }

  // ---- sky, sun glow, distant layers -------------------------------------------------------------

  function sky() {
    const sunPoint = L.uvToWorld(L.SUN.u, L.SUN.v, 100);
    const sunDir = new THREE.Vector3(sunPoint.x, sunPoint.y, sunPoint.z).sub(eye).normalize();
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uSunDir: { value: sunDir },
        uTopWhite: { value: hexToVec3(C.skyTopWhite) },
        uTopBlue: { value: hexToVec3(C.skyTopBlue) },
        uTopGrey: { value: hexToVec3(C.skyTopGrey) },
        uWarmNear: { value: hexToVec3(C.skyWarmNear) },
        uWarmFar: { value: hexToVec3(C.skyWarmFar) },
        uHorizon: { value: hexToVec3(C.skyHorizon) },
        uSun: { value: hexToVec3(C.skySun) },
        uHalo: { value: hexToVec3(C.skyHalo) },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      // Colors are sRGB values written straight to the sRGB framebuffer (no colorspace_fragment), so the
      // sampled photo colors come back unchanged.
      fragmentShader: `
        uniform vec3 uSunDir, uTopWhite, uTopBlue, uTopGrey, uWarmNear, uWarmFar, uHorizon, uSun, uHalo;
        varying vec3 vDir;
        const float DEG = 57.29578;
        void main() {
          vec3 d = normalize(vDir);
          float elev = asin(clamp(d.y, -1.0, 1.0)) * DEG;
          vec2 h = normalize(d.xz);
          vec2 hs = normalize(uSunDir.xz);
          float az = acos(clamp(dot(h, hs), -1.0, 1.0)) * DEG;
          // The sky is blue to the left of the sun and stays white to its right (haze over the hill).
          float leftOfSun = step(0.0, h.x * hs.y - h.y * hs.x);
          float azEff = az * mix(0.55, 1.0, leftOfSun);
          // The sun sits behind the ridge, so the glare fades quickly upward and lingers sideways.
          float sunElev = asin(clamp(uSunDir.y, -1.0, 1.0)) * DEG;
          float dEl = elev - sunElev;
          float elevWeight = dEl > 0.0 ? 25.0 : 12.0;
          float theta2 = az * az + dEl * dEl * elevWeight;
          vec3 top = mix(uTopWhite, uTopBlue, smoothstep(4.0, 20.0, azEff));
          top = mix(top, uTopGrey, smoothstep(30.0, 42.0, azEff));
          float band = exp(-pow((elev - 6.5) / 4.5, 2.0));
          vec3 warm = mix(uWarmNear, uWarmFar, smoothstep(12.0, 35.0, az));
          vec3 col = mix(top, warm, band * 0.8);
          col = mix(col, uHorizon, 1.0 - smoothstep(-3.0, 4.0, elev));
          col = mix(col, uHalo, exp(-sqrt(theta2) / 8.0) * 0.8);
          col = mix(col, uSun, exp(-theta2 / 50.0));
          gl_FragColor = vec4(col, 1.0);
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(L.DEPTHS.sky, 48, 24), mat);
    mesh.position.copy(eye);
    mesh.renderOrder = -10;
    return add(mesh, 'sky');
  }

  function distantLayers() {
    // Hazy mountains: two layered cards, the farther one paler. Base below the horizon so nothing shows beneath.
    frontalCard(
      'mountains far',
      [[-0.6, 0.31], [0.08, 0.28], [0.18, 0.258], [0.26, 0.25], [0.33, 0.255], [0.4, 0.268], [0.47, 0.29], [0.6, 0.31], [0.6, 0.4], [-0.6, 0.4]],
      L.DEPTHS.mountains[1],
      C.mountainFar,
    );
    frontalCard(
      'mountains mid',
      [[-0.6, 0.31], [0.12, 0.29], [0.2, 0.27], [0.27, 0.275], [0.34, 0.265], [0.4, 0.28], [0.46, 0.3], [0.6, 0.31], [0.6, 0.4], [-0.6, 0.4]],
      L.DEPTHS.mountains[0],
      C.mountainMid,
    );
    // Nearer dull-green ridge in front of the mountains.
    frontalCard(
      'near ridge',
      [[-0.6, 0.325], [0.1, 0.32], [0.18, 0.305], [0.24, 0.285], [0.3, 0.295], [0.36, 0.283], [0.42, 0.29], [0.5, 0.32], [0.5, 0.42], [-0.6, 0.42]],
      L.DEPTHS.nearRidge,
      C.nearRidge,
    );
    // Forested hill filling the upper right: the ridge follows the plan's points and dips to the horizon
    // at the left. The sun glare washes it to a warm haze near the ridge; it darkens lower down.
    ridgeCard(
      'hill',
      [[0.27, 0.305], [0.36, 0.28], [0.48, 0.215], [0.6, 0.16], [0.72, 0.1], [0.82, 0.08], [0.95, 0.075], [1.6, 0.07]],
      0.8,
      L.DEPTHS.hill,
      [[0.075, C.hillRidge], [0.14, C.hillHaze], [0.2, C.hillMid], [0.32, C.hill]],
    );
    // Roofs of farther houses below the hill, behind the cherry.
    frontalBox('far roof a', { u0: 0.2, u1: 0.34, v0: 0.3, v1: 0.36 }, L.DEPTHS.farHouses, 6, C.farRoof);
    frontalBox('far wall a', { u0: 0.21, u1: 0.33, v0: 0.36, v1: 0.44 }, L.DEPTHS.farHouses, 6, C.farWall);
    frontalBox('far roof b', { u0: 0.3, u1: 0.42, v0: 0.33, v1: 0.4 }, L.DEPTHS.farHouses - 4, 6, C.farRoof);
    frontalBox('far roof c', { u0: 0.14, u1: 0.24, v0: 0.4, v1: 0.47 }, L.DEPTHS.farHouses - 6, 6, C.farRoof);
  }

  // ---- street ------------------------------------------------------------------------------------

  function street() {
    // Raised top landing the photographer stands on.
    box('platform', { x0: S.x0, x1: S.x1, y0: L.PLATFORM_Y - 5, y1: L.PLATFORM_Y, z0: 0, z1: 8 }, C.platform);

    // Main stairs: a zigzag profile from the head of the stairs down to the ramp.
    const stepCount = Math.round(-S.stairsEndZ / L.STEP_TREAD);
    const profile = [[0, 0]];
    for (let i = 0; i < stepCount; i++) {
      const s0 = i * L.STEP_TREAD;
      const s1 = (i + 1) * L.STEP_TREAD;
      const y = -(i + 1) * S.stepRise;
      profile.push([s0, y], [s1, y]);
    }
    const sEnd = stepCount * L.STEP_TREAD;
    profile.push([sEnd, -stepCount * S.stepRise - 8], [0, -8]);
    profileSolid('stairs', profile, S.x0 + 0.4, S.x1, C.steps);
    // Drainage strip along the left edge of the stairs.
    bandSolid('gutter', 0, S.stairsEndZ, (z) => L.streetY(z) - 0.05, (z) => L.streetY(z) - 8, S.x0, S.x0 + 0.4, C.gutter, 6);

    // Paved ramp continuing at the street pitch (the landing widens where the side alleys join), then
    // the bend to the left, as ribbons on the height field.
    ribbon('landing', S.stairsEndZ, -22, 7.0, C.landing);
    ribbon('far street', -22, -34, 5.2, C.farStreet);

    // Base slab so orbiting never looks into the void.
    box('ground base', { x0: -80, x1: 80, y0: -30, y1: -24, z0: -120, z1: 40 }, C.groundBase);
  }

  function ribbon(name, z0, z1, width, color) {
    const positions = [];
    const steps = Math.max(2, Math.ceil((z0 - z1) / 1.5));
    for (let i = 0; i <= steps; i++) {
      const z = z0 + ((z1 - z0) * i) / steps;
      const cx = L.streetCenterX(z);
      const y = L.streetY(z);
      positions.push(cx - width / 2, y, z, cx + width / 2, y, z);
    }
    const index = [];
    for (let i = 0; i < steps; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(index);
    add(new THREE.Mesh(geo, material(color, { side: THREE.DoubleSide })), name);
    // Side skirts so the ribbon has a body when seen from the side.
    const skirt = [];
    for (let i = 0; i <= steps; i++) {
      const z = z0 + ((z1 - z0) * i) / steps;
      const cx = L.streetCenterX(z);
      const y = L.streetY(z);
      skirt.push(cx - width / 2, y - 3, z, cx - width / 2, y, z, cx + width / 2, y - 3, z, cx + width / 2, y, z);
    }
    const skirtIndex = [];
    for (let i = 0; i < steps; i++) {
      const a = i * 4;
      skirtIndex.push(a, a + 1, a + 4, a + 1, a + 5, a + 4, a + 2, a + 6, a + 3, a + 3, a + 6, a + 7);
    }
    const sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute('position', new THREE.Float32BufferAttribute(skirt, 3));
    sgeo.setIndex(skirtIndex);
    add(new THREE.Mesh(sgeo, material(C.stoneWallRight, { side: THREE.DoubleSide })), `${name} skirt`);
  }

  // ---- left side ---------------------------------------------------------------------------------

  function leftSide() {
    const W = L.LEFT_STONE_WALL;
    // Tall wall of light stone blocks nearest the camera, with a lighter sunlit top course.
    box('left stone wall', { x0: W.x0, x1: W.x1, y0: L.streetY(W.z0) - 1, y1: W.top - 0.25, z0: W.z0, z1: W.z1 }, C.stoneBlocks);
    box('left stone wall top', { x0: W.x0, x1: W.x1, y0: W.top - 0.25, y1: W.top, z0: W.z0, z1: W.z1 }, C.stoneBlocksTop);

    // Low plaster wall with a dark tile cap running downhill in front of the house fronts, and the
    // stacked-stone retaining wall beneath it down to the stairs.
    const capZ0 = L.LEFT_CAP_LINE[0][0];
    const capZ1 = S.stairsEndZ;
    const wallH = L.LEFT_LOW_WALL_HEIGHT;
    bandSolid('left retaining wall', capZ0, capZ1, (z) => L.leftCapY(z) - wallH, (z) => L.streetY(z) - 0.6, S.x0 - 0.7, S.x0, C.stoneWallLeft);
    bandSolid('left low wall', capZ0, capZ1, (z) => L.leftCapY(z), (z) => L.leftCapY(z) - wallH, S.x0 - 0.75, S.x0 + 0.05, C.lowWall);
    bandSolid('left wall tile cap', capZ0, capZ1, (z) => L.leftCapY(z) + 0.12, (z) => L.leftCapY(z), S.x0 - 0.9, S.x0 + 0.18, C.tileLeft);

    // Potted plant on the low wall, on the ray through its photo position.
    const potX = S.x0 - 0.35;
    const potPoint = L.uvToWorld(L.LEFT_POT.u - 0.025, L.LEFT_POT.v, L.depthForU(L.LEFT_POT.u - 0.025, potX));
    const potY = L.leftCapY(potPoint.z) + 0.12;
    box('left pot', { x0: S.x0 - 0.7, x1: S.x0, y0: potY, y1: potY + 0.25, z0: potPoint.z - 0.35, z1: potPoint.z + 0.35 }, C.pot);
    ellipsoid('left plant', { x: potX, y: potY + 0.45, z: potPoint.z }, { x: 0.6, y: 0.45, z: 1.4 }, C.plant);

    // Left house row: boxes plus roof slabs, stepping down the terraces.
    const H = L.LEFT_HOUSE_1;
    const [t1, t2, t3] = L.LEFT_TERRACES;
    // House 1: a low-mezzanine machiya. Its ground-floor front is light wood near the camera (photo
    // u < 0.12) and dark wood under the eave beyond; the eave roof sits near eye level, the mezzanine
    // with the hanging sudare above it, and a low top roof with a dark underside and a hip at the far
    // end, with sky visible above and beyond it.
    box('left house 1 ground', { x0: H.back, x1: H.front, y0: t1.y - 2, y1: H.eaveY + 0.2, z0: H.groundZ0, z1: H.z1 }, C.woodLight);
    box('left house 1 eave', { x0: H.back, x1: H.front - 0.6, y0: H.eaveY, y1: H.eaveTop, z0: H.eaveZ0, z1: H.z1 }, { sides: C.eaveEdge, top: C.tileLeft, bottom: C.house1Wall });
    box('left house 1 upper', { x0: H.back, x1: H.front, y0: H.eaveTop, y1: H.upperTop, z0: H.upperZ0, z1: H.z1 }, C.house1Upper);
    box('left house 1 roof', { x0: H.back, x1: H.front - 0.5, y0: H.roofUnder, y1: H.roofTop, z0: H.roofZ0, z1: H.z1 }, { sides: C.roofUnderDark, top: C.tileLeft, bottom: C.roofUnderDark });
    // The roof's near corner rises into the top-left of the frame (photo: dark at u < 0.04).
    box('left house 1 roof corner', { x0: H.front - 1.0, x1: H.front, y0: H.roofTop, y1: H.roofTop + 0.95, z0: -6.4, z1: -3.0 }, C.roofUnderDark);
    box('sudare', { x0: H.front - 0.15, x1: H.front + 0.02, y0: 4.9, y1: 5.7, z0: -7.6, z1: -5.3 }, C.sudare);
    box('lantern 1', { x0: H.front - 0.55, x1: H.front - 0.2, y0: 3.6, y1: 4.1, z0: -6.3, z1: -5.9 }, C.paperLantern);
    // Annex under house 1's eave: dark wood doors below the door canopy, white plaster above it up to
    // the lean-to roof; both roofs step down along the street (the plan's "left house 2 roof" and
    // "left house 3 roof").
    const AR = L.LEFT_ANNEX_ROOF;
    const K = L.LEFT_CANOPY;
    box('left annex', { x0: H.back, x1: H.front, y0: t2.y - 2, y1: 2.4, z0: t2.z1, z1: -6.0 }, C.annex);
    bandSolid('left annex plaster', -10.2, t2.z1, (z) => roofOuterY(AR, z), (z) => roofSurfaceY(K, H.front, z), H.front - 0.08, H.front + 0.04, C.plaster, 4);
    steppedRoof('left annex roof', AR, 0.3, C.tileLeft);
    steppedRoof('left door canopy', K, 0.25, C.canopy);
    box('awning', { x0: H.front - 0.7, x1: H.front, y0: 2.5, y1: 2.9, z0: -8.3, z1: -7.3 }, C.awning);
    box('lantern 2', { x0: H.front - 0.55, x1: H.front - 0.2, y0: 1.5, y1: 2.0, z0: -10.4, z1: -10.0 }, C.paperLantern);
    // House 3: lower again, at the head of the landing.
    box('left house 3 body', { x0: H.back, x1: H.front, y0: -5.5, y1: -2.6, z0: t3.z1, z1: t3.z0 }, C.house3Lower);
    box('left house 3 upper', { x0: H.back, x1: H.front, y0: -2.6, y1: -0.9, z0: t3.z1, z1: t3.z0 }, C.house3Wall);
    quadSlab(
      'left house 3 roof',
      [
        { x: H.front - 0.6, y: -0.9, z: t3.z0 },
        { x: H.front - 2.6, y: -0.3, z: t3.z0 },
        { x: H.front - 2.6, y: -0.3, z: t3.z1 - 0.3 },
        { x: H.front - 0.6, y: -0.9, z: t3.z1 - 0.3 },
      ],
      0.3,
      C.tileLeftLight,
    );
    box('sign', { x0: H.front - 0.12, x1: H.front + 0.1, y0: -0.6, y1: 0.2, z0: -16.2, z1: -15.6 }, C.sign);

    // Corner house facing the camera beyond the bend (behind the far street), and one more roof to its left.
    const d4 = 36;
    const c4 = L.uvToWorld(0.43, 0.7, d4);
    const eave4 = L.uvToWorld(0.43, 0.66, d4).y;
    const ridge4 = L.uvToWorld(0.43, 0.58, d4).y;
    const xl = L.uvToWorld(0.36, 0.66, d4).x - 1.5;
    const xr = L.uvToWorld(0.5, 0.66, d4).x + 0.6;
    box('corner house body', { x0: xl, x1: xr, y0: c4.y - 6, y1: eave4, z0: c4.z - 7, z1: c4.z + 0.4 }, C.woodDark);
    profileSolid(
      'corner house roof',
      [[-c4.z - 0.8, eave4], [-c4.z + 3.2, ridge4], [-c4.z + 7.2, eave4], [-c4.z + 7.2, eave4 - 0.35], [-c4.z + 3.2, ridge4 - 0.35], [-c4.z - 0.8, eave4 - 0.35]],
      xl - 0.4,
      xr + 0.4,
      C.tileLeft,
    );
    frontalBox('bend roof', { u0: 0.2, u1: 0.36, v0: 0.6, v1: 0.68 }, 38, 6, C.tileLeft);
    frontalBox('bend wall', { u0: 0.22, u1: 0.33, v0: 0.68, v1: 0.74 }, 38, 6, C.woodMid);
  }

  // ---- right side --------------------------------------------------------------------------------

  function rightSide() {
    const T = L.RIGHT_TERRACE;
    const B = L.RIGHT_BED;
    const M = L.RIGHT_MACHIYA;
    const Z = L.RIGHT_STEPS_Z;
    // The retaining wall rises to the walkway level; the raised planter strip with the fence stands
    // behind it, so the side steps climbing the wall face stay visible in front of the fence.
    const N = L.RIGHT_WALL_NOTCH;
    const wallTop = (z) => (z <= N.z1 && z >= N.z0 ? L.streetY(z) + 0.5 : L.rightTerraceY(z));
    bandSolid('right retaining wall', 0, -15.3, wallTop, (z) => L.streetY(z) - 0.6, S.x1, T.xInner, C.stoneWallRight, 60);
    bandSolid('right paving', -15.3, -40, (z) => L.rightTerraceY(z), (z) => L.rightTerraceY(z) - 6, S.x1, T.xInner, C.landing, 12);
    bandSolid('right planter bed', B.z1, B.z0, (z) => L.rightBedY(z), (z) => L.rightTerraceY(z) - 2, T.xInner, T.xBed, C.stoneWallRight, 8);
    bandSolid('right walkway', 0, -15.3, (z) => L.rightTerraceY(z), (z) => L.rightTerraceY(z) - 8, T.xInner, T.xOuter, C.terrace, 10);
    bandSolid('right walkway far', -15.3, -40, (z) => L.rightTerraceY(z), (z) => L.rightTerraceY(z) - 8, T.xInner, T.xOuter, C.landing, 12);

    // Side steps rising to the right from the main stairs through the wall, up to the fence line.
    for (let i = 0; i < 4; i++) {
      box(`right step ${i}`, { x0: 1.0 + 0.45 * i, x1: 2.9, y0: -3.2, y1: -1.65 + 0.45 * i, z0: Z.z0, z1: Z.z1 }, { sides: C.sideSteps, top: C.sideStepTop });
    }
    box('right steps back', { x0: 2.35, x1: 2.9, y0: -0.3, y1: L.rightBedY((Z.z0 + Z.z1) / 2), z0: Z.z0, z1: Z.z1 }, C.stoneWallRight);

    // Wooden fence with a kawara tile cap on the planter strip's street edge (the plan's low tiled roof).
    bandSolid('fence', B.z1, B.z0, (z) => L.rightBedY(z) + B.fenceHeight, (z) => L.rightBedY(z) - 0.1, T.xInner - 0.1, T.xBed, C.fence, 8);
    bandSolid('fence tile cap', B.z1, B.z0, (z) => L.rightBedY(z) + B.fenceHeight + 0.28, (z) => L.rightBedY(z) + B.fenceHeight, T.xInner - 0.35, T.xBed + 0.25, C.fenceTiles, 8);

    // Right machiya: a long dark ground floor under a deep eave seen from above (the tiles slope down to
    // the outer edge), a shorter upper floor with a balcony rail under a deep near-black top eave whose
    // tile ends catch the light only near the camera, and the noren hanging under the lower eave.
    box('right house ground', { x0: M.front, x1: M.back, y0: -3.5, y1: M.eaveTop, z0: M.baseSplitZ, z1: M.z1 }, C.rightGround);
    box('right house ground far', { x0: M.front, x1: M.back, y0: -3.5, y1: M.eaveTop, z0: M.z0, z1: M.baseSplitZ }, C.rightGroundFar);
    box('right house plinth', { x0: M.front - 0.06, x1: M.front + 0.3, y0: -3.5, y1: M.plinthTop, z0: M.z0, z1: M.z1 }, C.plinth);
    box('right house base', { x0: M.front - 0.05, x1: M.front + 0.3, y0: M.plinthTop, y1: M.baseTop, z0: M.baseSplitZ, z1: M.z1 }, C.woodBase);
    box('right house base far', { x0: M.front - 0.05, x1: M.front + 0.3, y0: M.plinthTop, y1: M.baseTopFar, z0: M.z0, z1: M.baseSplitZ }, C.woodBase);
    slopedSlab('right house eave', { x0: M.eaveEdge, y0: M.eaveTop - 0.65, x1: M.front + 0.2, y1: M.eaveTop }, M.eaveZ0, M.z1, 0.3, C.tileRight);
    box('right house eave underside', { x0: M.eaveEdge, x1: M.front, y0: M.eaveTop - 0.95, y1: M.eaveTop - 0.7, z0: M.eaveZ0, z1: M.z1 }, C.eaveUnder);
    box('right house upper', { x0: M.front, x1: M.back, y0: M.eaveTop, y1: M.roofY, z0: M.upperZ0, z1: M.z1 }, C.woodUpperRight);
    box('balcony rail', { x0: M.front - 0.15, x1: M.front, y0: 5.0, y1: 5.9, z0: M.upperZ0, z1: M.z1 }, C.balcony);
    box('right house roof', { x0: M.topEaveEdge, x1: M.back, y0: M.roofY, y1: M.roofY + M.roofThickness, z0: M.roofZ0, z1: M.z1 }, { sides: C.eaveDark, top: C.topRoofRight, bottom: C.topEaveUnder });
    box('right house roof cap', { x0: M.front - 0.3, x1: M.back, y0: M.roofY, y1: M.roofY + 0.35, z0: M.upperZ0, z1: M.roofZ0 }, C.eaveDark);
    box('right house fascia', { x0: M.topEaveEdge - 0.08, x1: M.topEaveEdge + 0.02, y0: M.roofY, y1: M.roofY + M.roofThickness, z0: M.fasciaZ0, z1: M.z1 }, C.topRoofRight);
    const nx = M.front - 0.1;
    quad(
      'noren',
      [
        { x: nx, y: M.norenTop, z: M.z1 },
        { x: nx, y: M.norenTop, z: M.norenZ0 },
        { x: nx, y: M.norenHemFar, z: M.norenZ0 },
        { x: nx, y: M.norenHemNear, z: M.z1 },
      ],
      C.noren,
    );

    // Round pot on the walkway by the house wall (its ray must clear the planter strip and the shrubs),
    // the shrub on the planter behind the fence at its photo position, and the small dark shrub by the pot.
    const potHit = L.rayHitGround(L.POT.u, L.POT.v, (z) => L.rightTerraceY(z) + 0.5);
    ellipsoid('pot', potHit, { x: 0.55, y: 0.5, z: 0.55 }, C.pot);
    // The shrub grows on the planter strip and spills forward over the fence boards (photo: green below the cap at u 0.72-0.78).
    ellipsoid('shrub', L.uvToWorld(L.SHRUB.u, L.SHRUB.v + 0.03, 6.2), { x: 0.7, y: 0.35, z: 0.8 }, C.shrub);
    ellipsoid('shrub 2', L.uvToWorld(0.805, 0.83, 8), { x: 0.35, y: 0.5, z: 0.35 }, C.shrubDeep);
  }

  // ---- vegetation and figures ----------------------------------------------------------------------

  function cherry() {
    const d = L.DEPTHS.cherry;
    const base = L.uvToWorld(L.CHERRY.trunk.u, L.CHERRY.trunk.v, d);
    cylinder('cherry trunk', base.x, base.z, base.y - 0.6, base.y + 3.0, 0.35, C.trunk);
    // The main canopy stays behind the right machiya's far end (a shallow depth radius, set back a
    // little), while the upper-right lobes are branches reaching forward in front of the balcony.
    uvEllipsoid('cherry canopy', { u0: 0.4, u1: 0.68, v0: 0.17, v1: 0.55 }, d + 1.5, C.cherryDense, 1.8);
    uvEllipsoid('cherry lobe left', { u0: 0.35, u1: 0.5, v0: 0.19, v1: 0.36 }, d - 1, C.cherryEdge, 2.4);
    uvEllipsoid('cherry lobe left mid', { u0: 0.35, u1: 0.5, v0: 0.33, v1: 0.57 }, d - 1.2, C.cherryLeft, 2.6);
    uvEllipsoid('cherry lobe far left', { u0: 0.28, u1: 0.4, v0: 0.32, v1: 0.56 }, d - 0.5, C.cherryFarLeft, 2.0);
    uvEllipsoid('cherry lobe top', { u0: 0.56, u1: 0.78, v0: 0.17, v1: 0.3 }, 12, C.cherryEdge, 1.6);
    uvEllipsoid('cherry lobe right', { u0: 0.72, u1: 0.83, v0: 0.18, v1: 0.32 }, 11, C.cherryEdge, 1.0);
    uvEllipsoid('cherry lobe lower', { u0: 0.42, u1: 0.62, v0: 0.4, v1: 0.6 }, d - 1, C.cherryShadow, 2.8);
    uvEllipsoid('cherry lobe low', { u0: 0.48, u1: 0.6, v0: 0.5, v1: 0.63 }, d - 1.3, C.cherryLow, 1.6);
    uvEllipsoid('cherry lobe lower right', { u0: 0.6, u1: 0.66, v0: 0.4, v1: 0.55 }, d + 2, C.cherryShade, 1.4);
    // Pendulous strands at the lower left of the canopy.
    const strandBoxes = [
      { u0: 0.4, u1: 0.43, v0: 0.44, v1: 0.64 },
      { u0: 0.43, u1: 0.46, v0: 0.46, v1: 0.62 },
      { u0: 0.455, u1: 0.485, v0: 0.45, v1: 0.64 },
      { u0: 0.49, u1: 0.52, v0: 0.5, v1: 0.6 },
      { u0: 0.53, u1: 0.56, v0: 0.52, v1: 0.61 },
    ];
    strandBoxes.forEach((uv, i) => uvEllipsoid(`cherry strand ${i}`, uv, d - 1.5, C.cherryStrand, 0.4));
  }

  function evergreen() {
    const d = L.DEPTHS.evergreen;
    const size = L.frameSizeAtDepth(d);
    const radius = ((L.EVERGREEN.u1 - L.EVERGREEN.u0) / 2) * size.width;
    const height = (L.EVERGREEN.v1 - L.EVERGREEN.v0) * size.height;
    const c = L.uvToWorld((L.EVERGREEN.u0 + L.EVERGREEN.u1) / 2, (L.EVERGREEN.v0 + L.EVERGREEN.v1) / 2, d);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 20), material(C.evergreen));
    cone.position.set(c.x, c.y, c.z);
    add(cone, 'evergreen');
    cylinder('evergreen trunk', c.x, c.z, -12, c.y - height / 2 + 0.2, 0.45, C.trunk);
  }

  function figures() {
    // Lamp post on the ramp; the lantern at the top of the plan's vertical extent.
    const lampBase = L.rayHitGround(L.LAMP.u, L.LAMP.v1, L.streetY);
    const lampDepth = L.worldToUV(lampBase).depth;
    const lampTop = L.uvToWorld(L.LAMP.u, L.LAMP.v0, lampDepth);
    cylinder('lamp post', lampBase.x, lampBase.z, lampBase.y, lampTop.y - 0.25, 0.08, C.lamp);
    box('lamp lantern', { x0: lampBase.x - 0.22, x1: lampBase.x + 0.22, y0: lampTop.y - 0.5, y1: lampTop.y, z0: lampBase.z - 0.22, z1: lampBase.z + 0.22 }, C.lantern);

    // Person in blue at the landing, sized from the frame fraction at their depth.
    const feet = L.rayHitGround(L.PERSON.u, L.PERSON.v + L.PERSON.height / 2, L.streetY);
    const height = L.PERSON.height * L.frameSizeAtDepth(L.worldToUV(feet).depth).height;
    box('person body', { x0: feet.x - 0.28, x1: feet.x + 0.28, y0: feet.y, y1: feet.y + height * 0.82, z0: feet.z - 0.18, z1: feet.z + 0.18 }, C.person);
    ellipsoid('person head', { x: feet.x, y: feet.y + height * 0.9, z: feet.z }, { x: height * 0.1, y: height * 0.1, z: height * 0.1 }, C.skin);
  }

  sky();
  distantLayers();
  street();
  leftSide();
  rightSide();
  cherry();
  evergreen();
  figures();

  return { group };
}
