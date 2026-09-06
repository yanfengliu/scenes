// The sky dome: a gradient from deep blue at the top left through pale cyan to the warm yellow-white
// around the sun at (0.62, 0.12), the sun's disc and glare partly behind the ridge, procedural cirrus
// with orange undersides at the top left, and pink cumulus puffs near the sun.
//
// The shader writes linear radiance, not display colors: the composer's OutputPass applies exposure and
// the ACES curve at the end of the frame, so every color here comes through `sceneRadiance` and displays
// as the value sampled from the photo. Nothing in the dome is lit by the rig.
import * as THREE from 'three';
import * as L from './layout.js';
import { sceneRadiance } from './tonemap.js';
import { MATERIALS } from './materials.js';

const C = L.COLORS;

const radianceUniform = (hex) => ({ value: new THREE.Vector3(...sceneRadiance(hex, { exposure: MATERIALS.exposure })) });

export function skyMaterial() {
  const sunPoint = L.uvToWorld(L.SUN.u, L.SUN.v, 100);
  const eye = new THREE.Vector3(L.CAMERA.eye.x, L.CAMERA.eye.y, L.CAMERA.eye.z);
  const sunDir = new THREE.Vector3(sunPoint.x, sunPoint.y, sunPoint.z).sub(eye).normalize();
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: sunDir },
      uTopWhite: radianceUniform(C.skyTopWhite),
      uTopBlue: radianceUniform(C.skyTopBlue),
      uTopGrey: radianceUniform(C.skyTopGrey),
      uWarmNear: radianceUniform(C.skyWarmNear),
      uWarmFar: radianceUniform(C.skyWarmFar),
      uHorizon: radianceUniform(C.skyHorizon),
      uSun: radianceUniform(C.skySun),
      uHalo: radianceUniform(C.skyHalo),
      uCirrus: radianceUniform(C.cirrus),
      uCirrusLit: radianceUniform(C.cirrusLit),
      uPuff: radianceUniform(C.cloudPuff),
      uSunDisc: { value: 3.2 },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uSunDir, uTopWhite, uTopBlue, uTopGrey, uWarmNear, uWarmFar, uHorizon, uSun, uHalo;
      uniform vec3 uCirrus, uCirrusLit, uPuff;
      uniform float uSunDisc;
      varying vec3 vDir;
      const float DEG = 57.29578;

      // Value noise and an fBm over it, for the cloud fields.
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p, int octaves) {
        float sum = 0.0;
        float amp = 0.5;
        for (int i = 0; i < 6; i++) {
          if (i >= octaves) break;
          sum += amp * noise(p);
          p *= 2.03;
          amp *= 0.5;
        }
        return sum;
      }

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
        float theta = sqrt(theta2);
        vec3 top = mix(uTopWhite, uTopBlue, smoothstep(4.0, 20.0, azEff));
        top = mix(top, uTopGrey, smoothstep(30.0, 42.0, azEff));
        // (x * x, not pow(x, 2.0): pow is undefined for a negative base in GLSL, and the NaN it
        // returns below the band spreads through the bloom blur and blanks the frame.)
        float bandT = (elev - 6.5) / 4.5;
        float band = exp(-bandT * bandT);
        vec3 warm = mix(uWarmNear, uWarmFar, smoothstep(12.0, 35.0, az));
        vec3 col = mix(top, warm, band * 0.8);
        col = mix(col, uHorizon, 1.0 - smoothstep(-3.0, 4.0, elev));

        // Cirrus: stretched fBm streaks high in the sky, thickest away from the sun (the photo's top
        // left), lit warm from below where the low sun reaches their undersides.
        vec2 cp = vec2(atan(d.z, d.x) * 2.4, elev * 0.055);
        float streak = fbm(vec2(cp.x * 1.6, cp.y * 7.0), 5);
        // The thresholds decide whether any of this is visible in the photo view, where the sky is only
        // the top of the frame: the first set fired so rarely that the scored cells were a bare gradient.
        float cirrus = smoothstep(0.42, 0.62, streak) * smoothstep(2.0, 12.0, elev) * smoothstep(6.0, 30.0, azEff);
        vec3 cirrusCol = mix(uCirrus, uCirrusLit, smoothstep(0.46, 0.64, streak) * 0.85);
        col = mix(col, cirrusCol, cirrus * 0.8);

        // Cumulus puffs near the sun: rounder fBm, pink where the glare catches them.
        float puff = fbm(vec2(cp.x * 3.1 + 4.0, cp.y * 9.0 - 2.0), 4);
        float near = exp(-theta / 30.0);
        float puffs = smoothstep(0.5, 0.72, puff) * near * smoothstep(1.0, 8.0, elev);
        col = mix(col, uPuff, puffs * 0.75);

        // The glare and the disc go over the clouds: the sun is behind them.
        col = mix(col, uHalo, exp(-theta / 8.0) * 0.8);
        col = mix(col, uSun, exp(-theta2 / 50.0));
        col += uSun * uSunDisc * exp(-theta2 / 3.5);
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
}

export function buildSky(b) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(L.DEPTHS.sky, 64, 32), skyMaterial());
  mesh.position.copy(b.eye);
  mesh.renderOrder = -10;
  b.add(mesh, 'sky');
  return mesh;
}
