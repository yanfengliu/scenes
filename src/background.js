// The sky dome with the sun glare (a placeholder until phase 4), and the distant layers: the mountains
// as planes fading with distance, the forested hill as a surface with a tree-clump texture, the roofs of
// farther houses below the hill as gabled houses, and the corner house at the bend (still block-out).
import * as THREE from 'three';
import * as L from './layout.js';
import { hexToVec3 } from './primitives.js';
import { surface } from './instancing.js';
import { makeMaterial } from './materials.js';
import { makeHillTexture } from './textures.js';

const C = L.COLORS;

export function buildBackground(b) {
  sky(b);
  mountains(b);
  hill(b);
  farGround(b);
  farHouses(b);
  bend(b);
  // Base slab so orbiting never looks into the void.
  b.box('ground base', { x0: -80, x1: 80, y0: -30, y1: -24, z0: -120, z1: 40 }, C.groundBase);
}

function sky(b) {
  const sunPoint = L.uvToWorld(L.SUN.u, L.SUN.v, 100);
  const sunDir = new THREE.Vector3(sunPoint.x, sunPoint.y, sunPoint.z).sub(b.eye).normalize();
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
  mesh.position.copy(b.eye);
  mesh.renderOrder = -10;
  b.add(mesh, 'sky');
}

// Hazy mountains as three planes facing the photo camera, farther ones paler: a pale far ridge whose
// tops sit at v 0.25, the blue range below it from v 0.27, and the dull-green near ridge in front.
// Each card runs below the horizon so nothing shows beneath.
function mountains(b) {
  b.frontalCard(
    'mountains farthest',
    [[-0.6, 0.27], [0.08, 0.262], [0.18, 0.248], [0.26, 0.243], [0.33, 0.25], [0.4, 0.258], [0.47, 0.27], [0.6, 0.28], [0.6, 0.4], [-0.6, 0.4]],
    L.DEPTHS.mountains[1],
    C.mountainFarthest,
  );
  b.frontalCard(
    'mountains blue',
    [[-0.6, 0.29], [0.1, 0.283], [0.17, 0.272], [0.23, 0.268], [0.29, 0.276], [0.35, 0.27], [0.41, 0.278], [0.48, 0.29], [0.6, 0.295], [0.6, 0.4], [-0.6, 0.4]],
    L.DEPTHS.mountains[0],
    C.mountainBlue,
  );
  b.frontalCard(
    'near ridge',
    [[-0.6, 0.325], [0.1, 0.32], [0.18, 0.305], [0.24, 0.285], [0.3, 0.295], [0.36, 0.283], [0.42, 0.29], [0.5, 0.32], [0.5, 0.42], [-0.6, 0.42]],
    L.DEPTHS.nearRidge,
    C.nearRidge,
  );
}

// The forested hill filling the upper right: a surface whose top edge follows the plan's ridge points and
// which leans back with depth (nearer at its foot), textured with tree clumps over the photo's gradient
// (warm haze near the ridge under the sun glare, darker green lower down). UV v is the photo row, which
// the texture's rows follow, so every row's mean is the sampled color at that row.
function hill(b) {
  const ridge = [[0.27, 0.305], [0.36, 0.28], [0.48, 0.215], [0.6, 0.16], [0.72, 0.1], [0.82, 0.08], [0.95, 0.075], [1.6, 0.07]];
  const stops = [[0.075, C.hillRidge], [0.14, C.hillHaze], [0.2, C.hillMid], [0.32, C.hill]];
  const vBottom = 0.8;
  const vTop = 0.05;
  const columns = 60;
  const rows = 10;
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
  const depthAt = (v) => L.DEPTHS.hill - ((v - 0.07) / (vBottom - 0.07)) * 200;
  const positions = [];
  const uvs = [];
  const u0 = ridge[0][0];
  const u1 = ridge[ridge.length - 1][0];
  for (let i = 0; i <= columns; i++) {
    const u = u0 + ((u1 - u0) * i) / columns;
    const top = ridgeV(u);
    for (let j = 0; j <= rows; j++) {
      const v = top + ((vBottom - top) * j) / rows;
      const p = L.uvToWorld(u, v, depthAt(v));
      positions.push(p.x, p.y, p.z);
      uvs.push(i / columns, 1 - (v - vTop) / (vBottom - vTop));
    }
  }
  const index = [];
  for (let i = 0; i < columns; i++) {
    for (let j = 0; j < rows; j++) {
      const a = i * (rows + 1) + j;
      const c = a + rows + 1;
      index.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  const map = makeHillTexture({ size: 1024, seed: 7, stops, vTop, vBottom });
  b.add(new THREE.Mesh(geo, makeMaterial({ map, side: THREE.DoubleSide, fog: false })), 'hill');
}

// The ground the far houses and the pines stand on (see farGroundY): plots on both sides of the far
// street beyond the bend, and a short hillside past the paving's end. Every strip starts outside the
// paving and a little below it, so from the photo view none of it shows: the sweep at 0.01 of the frame
// finds only paving, houses and the bend where the street is.
function farGround(b) {
  const strip = (name, zNear, zFar, xOf, xFar, samples) => {
    const positions = [];
    for (let i = 0; i <= samples; i++) {
      const z = zNear + ((zFar - zNear) * i) / samples;
      const y = L.farGroundY(z);
      positions.push(xOf(z), y, z, xFar, y, z);
    }
    const index = [];
    for (let i = 0; i < samples; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(index);
    b.add(new THREE.Mesh(geo, makeMaterial({ color: C.hill, side: THREE.DoubleSide })), name);
  };
  strip('far plots left', -24, -42, (z) => L.streetCenterX(z) - 3.4, -60, 12);
  strip('far plots right', -24, -42, (z) => L.streetCenterX(z) + 3.4, 60, 12);
  strip('hillside', -42, -58, () => -80, 80, 8);
}

// Roofs of farther houses below the hill, seen from above: gabled houses whose front slope covers the
// photo's roof box at the house's depth, with a plaster body and gable ends, kawara on the slopes, the
// body reaching down to the ground beside the far street.
function farHouses(b) {
  const tile = surface('kawara', C.farRoof, { seed: 51 });
  const wall = surface('plaster', C.farWall, { seed: 52 });
  const low = surface('plaster', C.farWallLow, { seed: 53 });
  // The three roofs the photo shows below the hill. Each house's walls are kept clear of the far street
  // (whose slabs run to x = streetCenterX(z) + 2.6): b's box would otherwise cross it.
  const houses = [
    { name: 'far roof a', u0: 0.2, u1: 0.34, v0: 0.3, v1: 0.36, depth: L.DEPTHS.farHouses },
    { name: 'far roof b', u0: 0.3, u1: 0.42, v0: 0.33, v1: 0.4, depth: L.DEPTHS.farHouses - 4 },
    { name: 'far roof c', u0: 0.14, u1: 0.24, v0: 0.4, v1: 0.47, depth: L.DEPTHS.farHouses - 6 },
  ];
  for (const h of houses) {
    const run = 3.0;
    // The house's own ground: below the street's surface at its depth, so no wall shows over the paving.
    const ridgeL = L.uvToWorld(h.u0, h.v0, h.depth);
    const ridgeR = L.uvToWorld(h.u1, h.v0, h.depth);
    const eave = L.uvToWorld(h.u1, h.v1, h.depth - run);
    const x0 = ridgeL.x;
    const x1 = Math.min(ridgeR.x, L.streetCenterX(ridgeL.z) - 3.2);
    const zRidge = ridgeL.z;
    const yRidge = ridgeL.y;
    const yEave = Math.min(eave.y, yRidge - 1.0);
    const zFront = zRidge + run;
    const zBack = zRidge - run;
    const yBase = Math.min(L.streetY(zFront), L.streetY(zBack)) - 0.6;
    // The gable in plaster under the roof; below it the wall is the dark the photo shows there (these
    // houses stand on the valley side, so their walls run a long way down before they meet their ground).
    const yBand = yEave - 1.4;
    b.profileSolid(`${h.name} house`, [[-zFront, yBand], [-zFront, yEave], [-zRidge, yRidge], [-zBack, yEave], [-zBack, yBand]], x0, x1, wall);
    b.box(`${h.name} house lower`, { x0, x1, y0: yBase, y1: yBand, z0: zBack, z1: zFront }, low);
    const o = 0.35;
    b.quadSlab(h.name, [{ x: x0 - o, y: yEave - 0.15, z: zFront + o }, { x: x1 + o, y: yEave - 0.15, z: zFront + o }, { x: x1 + o, y: yRidge + 0.05, z: zRidge }, { x: x0 - o, y: yRidge + 0.05, z: zRidge }], 0.14, tile);
    b.quadSlab(`${h.name} back`, [{ x: x1 + o, y: yEave - 0.15, z: zBack - o }, { x: x0 - o, y: yEave - 0.15, z: zBack - o }, { x: x0 - o, y: yRidge + 0.05, z: zRidge }, { x: x1 + o, y: yRidge + 0.05, z: zRidge }], 0.14, tile);
  }
}

// The corner house facing the camera beyond the bend, and one more roof to its left (block-out).
function bend(b) {
  const d4 = 36;
  const c4 = L.uvToWorld(0.43, 0.7, d4);
  const eave4 = L.uvToWorld(0.43, 0.66, d4).y;
  const ridge4 = L.uvToWorld(0.43, 0.58, d4).y;
  const xl = L.uvToWorld(0.36, 0.66, d4).x - 0.3;
  const xr = L.uvToWorld(0.5, 0.66, d4).x + 0.6;
  // The house stands behind the far street's end (z = -34) so the paving is never inside its front face.
  b.box('corner house body', { x0: xl, x1: xr, y0: c4.y - 6, y1: eave4, z0: c4.z - 8.3, z1: c4.z - 1.3 }, C.woodDark);
  b.profileSolid(
    'corner house roof',
    [[-c4.z + 0.5, eave4], [-c4.z + 4.5, ridge4], [-c4.z + 8.5, eave4], [-c4.z + 8.5, eave4 - 0.35], [-c4.z + 4.5, ridge4 - 0.35], [-c4.z + 0.5, eave4 - 0.35]],
    xl - 0.4,
    xr + 0.4,
    C.tileLeft,
  );
  b.frontalBox('bend roof', { u0: 0.2, u1: 0.36, v0: 0.6, v1: 0.68 }, 38, 6, C.tileLeft);
  b.frontalBox('bend wall', { u0: 0.22, u1: 0.33, v0: 0.68, v1: 0.74 }, 38, 6, C.woodMid);
}
