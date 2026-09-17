// This scene's own daytime sky: a June midday, high blue with cumulus, over Washington.
//
// Scene 1's src/sky.js is not reusable: it reads eleven of scene 1's colours and its sun position out of
// src/layout.js, and its shader's whole structure is a sunset -- an azimuth ramp towards a low sun at photo
// position (0.62, 0.12), a 6.5 degree elevation band and three glare falloffs around it. None of that is
// this sky. What IS reused is the pattern: one ShaderMaterial, its time uniform registered with
// src/animation.js so one setTime reaches it, and the same no-backtick rule inside the GLSL (both shaders
// are JS template literals).
//
// The reference photograph's own sky, sampled: #456ac9 at the zenith (u 0.02 v 0.03), #5577d1 at the top of
// the frame's middle, #8aa0d8 low towards the horizon, and blown white cumulus with shaded undersides.
import * as THREE from 'three';
import { COLORS } from './layout.js';
import { sceneRadiance } from '../tonemap.js';
import { MATERIALS } from '../materials.js';
import { registerTimeUniform } from '../animation.js';

export const SKY = {
  radius: 2400,
  // How fast the cumulus drift, in the shader's own units per second. Slower than scene 1's: this is a
  // still midday and the photo is a single frame, so the motion exists to prove the clock reaches the sky
  // and not to be watched.
  drift: 0.0016,
  // The sun's direction, in world xyz. THE REFERENCE IS A NORTH FACADE AT MIDDAY, so the sun stood behind
  // the building and the wall the camera reads had no direct sun on it -- which is why every sampled wall
  // colour is a cool blue-grey rather than white. This direction is therefore NOT the sun that lit the
  // subject: it is the light that makes the subject's own relief visible, placed behind and to the camera's
  // side so the portico casts the shadow the photograph shows under it and the wall keeps a soft gradient.
  // The rig's own comment in lighting.js carries the same note; a later lighting wave that wants physical
  // midday should set this to the real direction, which is (0.24, 0.94, -0.24)-ish, and expect a flat wall.
  sunDirection: (() => {
    const elevation = (34 * Math.PI) / 180;
    // From the north-west, i.e. over the camera's own right shoulder, so the facade is raked and the
    // porch's east side is the lit one.
    const bearing = (215 * Math.PI) / 180;
    return {
      x: Math.sin(bearing) * Math.cos(elevation),
      y: Math.sin(elevation),
      z: -Math.cos(bearing) * Math.cos(elevation),
    };
  })(),
};

// A radiance uniform from a sampled hex, the same helper shape scene 1 uses: three's tonemap expects linear
// radiance, so the hex goes through the ACES inverse rather than being divided by 255.
function radianceUniform(hex) {
  const [r, g, b] = sceneRadiance(hex, { exposure: MATERIALS.exposure });
  return new THREE.Vector3(r, g, b);
}

export function skyMaterial() {
  const sun = SKY.sunDirection;
  const len = Math.hypot(sun.x, sun.y, sun.z);
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: radianceUniform(COLORS.skyZenith) },
      uMid: { value: radianceUniform(COLORS.skyMid) },
      uHorizon: { value: radianceUniform(COLORS.skyHorizon) },
      uCloud: { value: radianceUniform(COLORS.cloud) },
      uCloudShade: { value: radianceUniform(COLORS.cloudShade) },
      uSunDir: { value: new THREE.Vector3(sun.x / len, sun.y / len, sun.z / len) },
      uSunDisc: { value: 2.4 },
      uTime: { value: 0 },
      uDrift: { value: SKY.drift },
    },
    // NO BACKTICK may appear inside these template literals (scene 1's src/sky.js records the same rule).
    vertexShader: [
      'varying vec3 vDir;',
      'void main() {',
      '  vDir = normalize(position);',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}',
    ].join('\n'),
    fragmentShader: [
      'uniform vec3 uZenith;',
      'uniform vec3 uMid;',
      'uniform vec3 uHorizon;',
      'uniform vec3 uCloud;',
      'uniform vec3 uCloudShade;',
      'uniform vec3 uSunDir;',
      'uniform float uSunDisc;',
      'uniform float uTime;',
      'uniform float uDrift;',
      'varying vec3 vDir;',
      // A cheap value noise, good enough for cumulus at this scale and deterministic in time.
      'float hash(vec2 p) {',
      '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);',
      '}',
      'float noise(vec2 p) {',
      '  vec2 i = floor(p);',
      '  vec2 f = fract(p);',
      '  vec2 u = f * f * (3.0 - 2.0 * f);',
      '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),',
      '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);',
      '}',
      'float fbm(vec2 p) {',
      '  float v = 0.0;',
      '  float a = 0.5;',
      '  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }',
      '  return v;',
      '}',
      'void main() {',
      '  vec3 d = normalize(vDir);',
      // The vertical ramp: zenith at the top, the horizon's pale band at the bottom.
      '  float h = clamp(d.y, 0.0, 1.0);',
      '  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.28, h));',
      '  col = mix(col, uZenith, smoothstep(0.22, 0.85, h));',
      // Below the horizon the dome fades to the horizon colour so an orbit under the ground is not black.
      '  col = mix(uHorizon, col, smoothstep(-0.08, 0.02, d.y));',
      // The cumulus: projected onto a plane above the eye, drifting with the clock.
      '  float up = max(d.y, 0.055);',
      '  vec2 uv = d.xz / up * 0.55 + vec2(uTime * uDrift, uTime * uDrift * 0.35);',
      '  float base = fbm(uv * 1.15);',
      '  float detail = fbm(uv * 3.1 + 4.0);',
      '  float cover = smoothstep(0.52, 0.78, base * 0.72 + detail * 0.34);',
      '  cover *= smoothstep(0.02, 0.22, d.y);',
      // The lit top and the shaded underside, which is what makes a cumulus read as a solid.
      '  float lit = smoothstep(0.45, 0.95, detail + 0.35 * base);',
      '  vec3 cloudCol = mix(uCloudShade, uCloud, lit);',
      '  col = mix(col, cloudCol, cover);',
      // The sun's own disc and a tight halo, small because it is behind the building and out of frame in
      // the photo view -- it is here so an orbit towards the south sees where the light comes from.
      '  float cosT = dot(d, normalize(uSunDir));',
      '  col += uCloud * 0.35 * pow(max(cosT, 0.0), 220.0);',
      '  col += uHorizon * 0.06 * pow(max(cosT, 0.0), 6.0);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}',
    ].join('\n'),
  });
}

export function buildSky(b) {
  const material = skyMaterial();
  registerTimeUniform(material.uniforms.uTime);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(SKY.radius, 48, 32), material);
  mesh.position.copy(b.eye);
  mesh.renderOrder = -10;
  mesh.name = 'sky';
  b.add(mesh, 'sky');
  return mesh;
}
