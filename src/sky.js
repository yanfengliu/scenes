// The sky dome: a gradient from deep blue at the top left through pale cyan to the warm yellow-white
// around the sun at (0.62, 0.12), the sun's disc and glare partly behind the ridge, procedural cirrus
// with orange undersides at the top left, and pink cumulus puffs near the sun.
//
// The shader writes linear radiance, not display colors: the composer's OutputPass applies exposure and
// the ACES curve at the end of the frame, so every color here comes through `sceneRadiance` and displays
// as the value sampled from the photo. Nothing in the dome is lit by the rig.
//
// Both shaders below are JS template literals, so NO BACKTICK may appear anywhere inside them, comments
// included: one ends the string and the page dies with a JavaScript parse error naming the next GLSL
// identifier ("Unexpected identifier 'uTopBlue'"), which reads like a shader fault and is not one.
import * as THREE from 'three';
import * as L from './layout.js';
import { sceneRadiance } from './tonemap.js';
import { MATERIALS } from './materials.js';
import { registerTimeUniform, WIND } from './animation.js';

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
      uTime: { value: 0 },
      uDrift: { value: WIND.cloud },
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
      uniform float uTime;
      uniform float uDrift;
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
        // 45 rather than 25 above the sun: the glare has to be strong enough at the sun's own height to
        // carry cells (0.479, 0.114) and (0.521, 0.114), and every widening of it leaked into the photo's
        // blue top row, six degrees higher, until this squashed it vertically.
        float elevWeight = dEl > 0.0 ? 45.0 : 12.0;
        float theta2 = az * az + dEl * dEl * elevWeight;
        float theta = sqrt(theta2);
        vec3 top = mix(uTopWhite, uTopBlue, smoothstep(4.0, 20.0, azEff));
        // The deeper blue away from the sun. The frame's own left edge sits at about 40 degrees of
        // azimuth, so this ramp is nearly all of it outside the photo: measured, starting it at 18 rather
        // than 30 cost +0.035, +0.026 and +0.013 at cells (0.063, 0.023), (0.104, 0.023) and
        // (0.146, 0.068) to gain 0.030 at (0.188, 0.023), which is one darker patch in the photo and not
        // a trend. The photo's top row is flat at u 0.06 to 0.15 (#99bedc, #9bc4e4, #9bc3e5, all within
        // two levels of uTopBlue) and lightens toward the sun, so the ramp's job is the orbit sky.
        top = mix(top, uTopGrey, smoothstep(30.0, 44.0, azEff));
        // (x * x, not pow(x, 2.0): pow is undefined for a negative base in GLSL, and the NaN it
        // returns below the band spreads through the bloom blur and blanks the frame.)
        // The band's width is fixed. Widening it toward the sun was tried, to reach cells (0.479, 0.114)
        // #edcaac and (0.521, 0.114) #f9dfbe, which render with the right red and 30 to 50 levels too much
        // green and blue; at 4.5 + 6.0 * exp(-az / 18.0) it carried orange into the photo's blue top row
        // and cost +0.025 each at (0.229, 0.023), (0.271, 0.023), (0.313, 0.023) and (0.354, 0.023)
        // against a gain of about the same over two cells. The glare below reaches those two instead.
        float bandT = (elev - 6.5) / 4.5;
        float band = exp(-bandT * bandT);
        vec3 warm = mix(uWarmNear, uWarmFar, smoothstep(12.0, 35.0, az));
        vec3 col = mix(top, warm, band * 0.8);
        col = mix(col, uHorizon, 1.0 - smoothstep(-3.0, 4.0, elev));

        // How much of the low sun's own light reaches this direction: the warm band it lays across the
        // sky plus its glare. Every cloud colour below is mixed by it, because a cloud is lit by the sun
        // and not by the streak it was drawn from. The photo says so plainly -- its clouds are blue-white
        // at u 0.30 (box (0.30,0.05)-(0.37,0.075) reads #cbdcea, two levels off the clear sky beside it
        // at (0.40,0.035)-(0.50,0.055) #cfe0ed) and orange at u 0.28-0.40, v 0.135-0.165 (#ebc3a3).
        // 16 and not 25: at 25 a cloud at theta = 35, which is the photo's top row at u 0.40, still took a
        // quarter of the orange and the cell rendered #cbd3e2 against a photo of #b5d3eb -- 22 levels of
        // red on a clean blue sky.
        float warmth = clamp(band * 0.8 + exp(-theta / 16.0), 0.0, 1.0);

        // Cirrus: stretched fBm streaks high in the sky, thickest away from the sun (the photo's top
        // left), lit warm from below only where the low sun reaches their undersides.
        // The clouds drift across the sky; the gradient, the glare and the sun's disc do not move.
        vec2 cp = vec2(atan(d.z, d.x) * 2.4 + uTime * uDrift, elev * 0.055);
        float streak = fbm(vec2(cp.x * 1.6, cp.y * 7.0), 5);
        // The thresholds decide whether any of this is visible in the photo view, where the sky is only
        // the top of the frame: the first set fired so rarely that the scored cells were a bare gradient.
        float cirrus = smoothstep(0.42, 0.62, streak) * smoothstep(2.0, 12.0, elev) * smoothstep(6.0, 30.0, azEff);
        // The warm mix was smoothstep(0.46, 0.64, streak) * 0.85, a function of the noise and not of where
        // the sun is, so the thickest streaks went orange wherever they fell. With uCirrus itself a
        // pink-grey, the photo's blue top-left rendered lavender.
        vec3 cirrusCol = mix(uCirrus, uCirrusLit, clamp(warmth * 0.9 + smoothstep(0.52, 0.68, streak) * 0.2, 0.0, 1.0));
        col = mix(col, cirrusCol, cirrus * 0.8);

        // Cumulus puffs near the sun: rounder fBm, pink where the glare catches them. The falloff is
        // tight on purpose. At exp(-theta / 30.0) a puff still carried 24% of its pink at theta = 43,
        // which is the photo's own top-left at v 0.068, where cells (0.229, 0.068) and (0.313, 0.068) read
        // #c5d6e4 and #cddde9 -- plain blue -- against a render of #d1c3cd and #d3c3cf.
        float puff = fbm(vec2(cp.x * 3.1 + 4.0, cp.y * 9.0 - 2.0), 4);
        float near = exp(-theta / 18.0);
        float puffs = smoothstep(0.5, 0.72, puff) * near * smoothstep(1.0, 8.0, elev);
        col = mix(col, mix(uPuff, uCirrus, 1.0 - warmth), puffs * 0.75);

        // The glare and the disc go over the clouds: the sun is behind them.
        col = mix(col, uHalo, exp(-theta / 10.0) * 0.9);
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
  const material = skyMaterial();
  registerTimeUniform(material.uniforms.uTime);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(L.DEPTHS.sky, 64, 32), material);
  mesh.position.copy(b.eye);
  mesh.renderOrder = -10;
  b.add(mesh, 'sky');
  return mesh;
}
