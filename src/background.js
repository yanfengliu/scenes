// Sky dome with the sun glare, and the distant layers (mountains, near ridge, hill, far roofs) as cards
// facing the photo camera. Block-out placeholders until phase 4 (sky, light) and phase 3 (far houses).
import * as THREE from 'three';
import * as L from './layout.js';
import { hexToVec3 } from './primitives.js';

const C = L.COLORS;

export function buildBackground(b) {
  sky(b);
  distantLayers(b);
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

function distantLayers(b) {
  // Hazy mountains: two layered cards, the farther one paler. Base below the horizon so nothing shows beneath.
  b.frontalCard(
    'mountains far',
    [[-0.6, 0.31], [0.08, 0.28], [0.18, 0.258], [0.26, 0.25], [0.33, 0.255], [0.4, 0.268], [0.47, 0.29], [0.6, 0.31], [0.6, 0.4], [-0.6, 0.4]],
    L.DEPTHS.mountains[1],
    C.mountainFar,
  );
  b.frontalCard(
    'mountains mid',
    [[-0.6, 0.31], [0.12, 0.29], [0.2, 0.27], [0.27, 0.275], [0.34, 0.265], [0.4, 0.28], [0.46, 0.3], [0.6, 0.31], [0.6, 0.4], [-0.6, 0.4]],
    L.DEPTHS.mountains[0],
    C.mountainMid,
  );
  // Nearer dull-green ridge in front of the mountains.
  b.frontalCard(
    'near ridge',
    [[-0.6, 0.325], [0.1, 0.32], [0.18, 0.305], [0.24, 0.285], [0.3, 0.295], [0.36, 0.283], [0.42, 0.29], [0.5, 0.32], [0.5, 0.42], [-0.6, 0.42]],
    L.DEPTHS.nearRidge,
    C.nearRidge,
  );
  // Forested hill filling the upper right: the ridge follows the plan's points and dips to the horizon
  // at the left. The sun glare washes it to a warm haze near the ridge; it darkens lower down.
  b.ridgeCard(
    'hill',
    [[0.27, 0.305], [0.36, 0.28], [0.48, 0.215], [0.6, 0.16], [0.72, 0.1], [0.82, 0.08], [0.95, 0.075], [1.6, 0.07]],
    0.8,
    L.DEPTHS.hill,
    [[0.075, C.hillRidge], [0.14, C.hillHaze], [0.2, C.hillMid], [0.32, C.hill]],
  );
  // Roofs of farther houses below the hill, behind the cherry (phase 3 replaces them).
  b.frontalBox('far roof a', { u0: 0.2, u1: 0.34, v0: 0.3, v1: 0.36 }, L.DEPTHS.farHouses, 6, C.farRoof);
  b.frontalBox('far wall a', { u0: 0.21, u1: 0.33, v0: 0.36, v1: 0.44 }, L.DEPTHS.farHouses, 6, C.farWall);
  b.frontalBox('far roof b', { u0: 0.3, u1: 0.42, v0: 0.33, v1: 0.4 }, L.DEPTHS.farHouses - 4, 6, C.farRoof);
  b.frontalBox('far roof c', { u0: 0.14, u1: 0.24, v0: 0.4, v1: 0.47 }, L.DEPTHS.farHouses - 6, 6, C.farRoof);
  // The corner house facing the camera beyond the bend, and one more roof to its left (phase 3 detail).
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
  // Base slab so orbiting never looks into the void.
  b.box('ground base', { x0: -80, x1: 80, y0: -30, y1: -24, z0: -120, z1: 40 }, C.groundBase);
}
