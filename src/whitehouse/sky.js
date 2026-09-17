// This scene's own daytime sky: a June midday, high blue with cumulus, over Washington.
//
// Scene 1's src/sky.js is not reusable: it reads eleven of scene 1's colours and its sun position out of
// src/layout.js, and its shader's whole structure is a sunset -- an azimuth ramp towards a low sun at photo
// position (0.62, 0.12), a 6.5 degree elevation band and three glare falloffs around it. None of that is
// this sky. What IS reused is the pattern: one ShaderMaterial, its time uniform registered with
// src/animation.js so one setTime reaches it, and the same no-backtick rule inside the GLSL (both shaders
// are JS template literals).
//
// The reference photograph's own sky, sampled left of the building where no cloud and no tree is in the
// way, at the boxes in layout.js's COLORS: #4970cf (luma 111) at the frame's top rows, #5779d3 (119) at
// v 0.06-0.10, #7592e3 (146) at v 0.18-0.26 and #6a8fe9 (139) at v 0.30-0.34, with blown cumulus above
// luma 190 on the right from v 0.16 to v 0.33.
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
  // THE SUN'S DIRECTION IS THE ONE THING THIS PASS MOVED IN THE RIG, and the move is the reason the facade
  // can hold the photograph's tone at all.
  //
  // The reference is a north facade at midday, so the sun stood BEHIND the building and the face the camera
  // reads had no direct sun on it -- which is why the previous pass put the sun to the south and made the
  // rig almost entirely ambient. That is faithful and it does not render: measured with
  // out/wh/scratch/rig.mjs, the wall then needed 2.2 of its 2.4 irradiance from lights that do not depend
  // on orientation, and a wall lit that way is a flat plate. It measured a 1.03 ratio from the cornice to
  // the base where the photograph has 3.7.
  //
  // So the sun is NORTH-EAST: 20 degrees east of the optical axis and 42 degrees up, so it stands over the
  // camera's own right shoulder and rakes across the facade from the building's east end. The wall takes
  // most of its light from a direction that changes along the facade, the porch casts the shadow the
  // photograph shows under it, and the ramp comes out of the geometry rather than out of a gradient map.
  // This is the largest deliberate departure from physical accuracy in the scene, and lighting.js's RIG
  // carries the same note.
  sunDirection: (() => {
    const elevation = (42 * Math.PI) / 180;
    // Bearing 20 degrees EAST of the optical axis: x = +sin(20) is the building's own east, +z is towards
    // the camera. The light therefore comes from the camera's right and above, at 42 degrees.
    const bearing = (20 * Math.PI) / 180;
    return {
      x: Math.sin(bearing) * Math.cos(elevation),
      y: Math.sin(elevation),
      z: Math.cos(bearing) * Math.cos(elevation),
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
      // The vertical ramp: the zenith at the top, the pale hazy band at the horizon. The stops are wide
      // because the photograph's own sky is far flatter than a clear-day gradient: it reads #4970cf at the
      // frame's top row, #7592e3 at v 0.22 and #6a8fe9 at v 0.32 -- luma 111, 146, 139 over the whole
      // visible sky, which is a 15% swing in the blue against a shading term that more than doubles it.
      '  float h = clamp(d.y, 0.0, 1.0);',
      '  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.34, h));',
      '  col = mix(col, uZenith, smoothstep(0.30, 0.90, h));',
      // Below the horizon the dome fades to the horizon colour so an orbit under the ground is not black.
      '  col = mix(uHorizon, col, smoothstep(-0.08, 0.02, d.y));',
      // The cumulus: projected onto a plane above the eye, drifting with the clock. The scale is set so the
      // frame's own 28-degree half angle holds the two or three masses the photograph has rather than a
      // field of them, and the coverage threshold is high so most of the sky stays clear blue.
      '  float up = max(d.y, 0.055);',
      '  vec2 uv = d.xz / up * 0.55 + vec2(uTime * uDrift, uTime * uDrift * 0.35);',
      '  float base = fbm(uv * 1.15);',
      '  float detail = fbm(uv * 3.1 + 4.0);',
      '  float cover = smoothstep(0.56, 0.84, base * 0.72 + detail * 0.34);',
      // Clouds thin out towards the horizon as they do in the photograph, but they do not vanish: the
      // frame's brightest cloud is at v 0.25, close to the building's own roofline.
      '  cover *= smoothstep(0.03, 0.16, d.y);',
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
