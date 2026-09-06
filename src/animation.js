// The scene's life: the canopy swaying on a wind field, petals drifting down through it, the clouds
// drifting, the lanterns swinging.
//
// Everything that moves in quantity moves in the vertex shader. The canopy is 30,000 instanced cards and
// 758 strand tubes; touching their matrices on the CPU every frame would cost more than the whole rest of
// the frame, so instead each material's `project_vertex` is patched with a wind offset computed from the
// vertex's own world position and one time uniform. The petals are a second instanced mesh whose whole
// trajectory is a function of the instance's seed and the time, so 400 of them are one draw call and no
// per-frame work at all. Only the lanterns move on the CPU, because there are two of them.
//
// The clock is deterministic and can be frozen: `setTime(t)` pins the animation so a gate can shoot the
// same frame every run, and `tools/animation.js` shoots several times across the cycle to prove the photo
// view stays inside tolerance at any moment, not just at t = 0.
import * as THREE from 'three';
import * as L from './layout.js';
import { mulberry32, jitter } from './random.js';
import { cardTexture } from './textures.js';
import { foliageMaterial, albedoOf } from './materials.js';
import { instanced } from './instancing.js';
import { canopyColorAt } from './photofield.js';

// Amplitudes in metres. They are small on purpose: the photo view is scored at several points in the
// cycle, and a canopy that swings visibly moves its own cell means. See the phase 5 devlog for the spread.
export const WIND = {
  canopy: 0.085, // the blossom cards and the strand tubes, at the bottom of a strand
  reach: 3.6, // metres below the crown over which the sway grows to full
  crownY: 0.4, // the canopy's own top, where the sway is zero
  noren: 0.02,
  cloud: 0.004, // radians per second of cloud drift
  lantern: 0.035, // radians of lantern swing
  petals: 420,
};

const clock = { time: 0, frozen: false, last: 0 };
const timeUniforms = [];
const swayObjects = [];
const screenScaleUniforms = [];

// The shared wind: two sine waves crossing the street, so the canopy breathes rather than ticks.
const WIND_GLSL = `
  uniform float uTime;
  uniform float uWindAmp;
  uniform float uWindReach;
  uniform float uWindTop;
  vec3 windOffset(vec3 wp) {
    float weight = clamp((uWindTop - wp.y) / uWindReach, 0.0, 1.0);
    float phase = wp.x * 0.35 + wp.z * 0.22;
    float s = sin(uTime * 0.85 + phase) * 0.65 + sin(uTime * 1.63 + phase * 1.9) * 0.35;
    float c = cos(uTime * 0.72 + phase * 1.3);
    return vec3(s, 0.0, c * 0.4) * (uWindAmp * weight * weight);
  }`;

// Patch a material so its vertices sway. The offset is applied in object space after the instance matrix,
// which for this scene is world space (the scene group sits at the origin), so a card and the strand it
// hangs from move together even though one is instanced and the other is merged geometry.
export function applyWind(material, { amplitude = WIND.canopy, reach = WIND.reach, top = WIND.crownY } = {}) {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (previous) previous(shader, renderer);
    shader.uniforms.uTime = { value: clock.time };
    shader.uniforms.uWindAmp = { value: amplitude };
    shader.uniforms.uWindReach = { value: reach };
    shader.uniforms.uWindTop = { value: top };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>${WIND_GLSL}`)
      .replace(
        '#include <project_vertex>',
        [
          'vec4 mvPosition = vec4( transformed, 1.0 );',
          '#ifdef USE_INSTANCING',
          '  mvPosition = instanceMatrix * mvPosition;',
          '#endif',
          'mvPosition.xyz += windOffset( mvPosition.xyz );',
          'mvPosition = modelViewMatrix * mvPosition;',
          'gl_Position = projectionMatrix * mvPosition;',
        ].join('\n'),
      );
    registerTimeUniform(shader.uniforms.uTime);
  };
  // three's default cache key reads `this.onBeforeCompile`, so it has to be called on the material.
  const previousKey = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${previousKey()}|wind${amplitude}`;
  return material;
}

// Widen geometry that is thinner than `minPx` on screen, fading it so width times opacity stays roughly
// constant (a strand twice as wide as it should be is drawn at half the coverage). This is the sub-pixel
// remedy for the cherry's strand tubes: at their radius (0.008 to 0.016 m) and distance they measure about
// 0.35 px wide, so a fraction-of-a-pixel camera move switches a whole run of pixels on and off no matter
// how many spatial samples resolve each one. Widening happens per vertex in view space, so it tracks the
// live camera distance every frame rather than a fixed worst case.
//
// Needs a `vec4 aWiden` attribute per vertex: xyz the unit outward direction from the tube's centreline
// (so the centreline itself is `position - aWiden.xyz * aWiden.w`), w the original radius in metres. Only
// `taperedTube(..., { widen: true })` in src/vegetation.js writes it.
//
// The fade is coverage, not blending: it lands in `diffuseColor.a` and leaves through the same
// `SAMPLE_ALPHA_TO_COVERAGE` state `foliageMaterial` uses (see materials.js), which needs no alphaTest to
// do something useful here (the coverage value is already a smooth per-vertex scalar, not a texture edge
// that needs the `alphatest_fragment` chunk's own sharpening), and keeps the strands opaque and
// depth-sorted rather than turning them into blended, draw-order-sensitive geometry.
const MIN_WIDTH_GLSL = `
  attribute vec4 aWiden;
  uniform float uPxPerMetre1m;
  uniform float uMinPxRadius;
  uniform float uMaxGrowth;
  varying float vCoverageAlpha;`;

export function applyMinWidth(material, { minPx = 1.0, maxGrowth = 4.0 } = {}) {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (previous) previous(shader, renderer);
    shader.uniforms.uPxPerMetre1m = { value: 500 };
    shader.uniforms.uMinPxRadius = { value: minPx };
    shader.uniforms.uMaxGrowth = { value: maxGrowth };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>${MIN_WIDTH_GLSL}`)
      .replace(
        '#include <begin_vertex>',
        [
          'vec3 transformed = vec3( position );',
          '{',
          '  vec3 wCentre = position - aWiden.xyz * aWiden.w;',
          '  vec4 wView = modelViewMatrix * vec4( wCentre, 1.0 );',
          '  float wDist = max( 0.0001, -wView.z );',
          '  float wApparentPx = ( aWiden.w * uPxPerMetre1m ) / wDist;',
          '  float wGrowth = clamp( uMinPxRadius / max( wApparentPx, 1e-5 ), 1.0, uMaxGrowth );',
          '  transformed = wCentre + aWiden.xyz * ( aWiden.w * wGrowth );',
          '  vCoverageAlpha = 1.0 / wGrowth;',
          '}',
        ].join('\n'),
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying float vCoverageAlpha;`)
      .replace('#include <opaque_fragment>', 'diffuseColor.a *= vCoverageAlpha;\n#include <opaque_fragment>');
    registerScreenScale(shader.uniforms.uPxPerMetre1m);
  };
  material.alphaToCoverage = true;
  const previousKey = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${previousKey()}|minwidth${minPx}/${maxGrowth}`;
  return material;
}

// Pixels of apparent size per metre of world size at one metre from the camera: apparent px radius of a
// feature of radius r at distance d is `r * uPxPerMetre1m / d`. Depends on the drawing buffer's height in
// device pixels and the camera's vertical FOV, so it is recomputed on build and on every resize (src/main.js).
export function registerScreenScale(uniform) {
  if (!screenScaleUniforms.includes(uniform)) screenScaleUniforms.push(uniform);
}

export function updateScreenScale(pixelHeight, fovYDeg) {
  const value = pixelHeight / (2 * Math.tan((fovYDeg * Math.PI) / 360));
  for (const u of screenScaleUniforms) u.value = value;
}

// A time uniform the frame loop should advance (the sky's cloud drift, and every patched material's).
// three re-runs onBeforeCompile whenever it recompiles a material, so the same uniform can arrive twice.
export function registerTimeUniform(uniform) {
  if (!timeUniforms.includes(uniform)) timeUniforms.push(uniform);
}

// An object that swings about its own origin: the lanterns, one pass per frame.
export function registerSway(object, { amplitude = WIND.lantern, phase = 0, rate = 1 } = {}) {
  swayObjects.push({ object, amplitude, phase, rate });
}

// Petals: instanced cards whose fall is a closed form of the instance's seed and the time, so the whole
// drift costs one draw call and nothing on the CPU. They fall through the canopy's own volume, take their
// color from the same photo field the blossoms use, and wrap round when they reach the street.
export function buildPetals(b) {
  const rand = mulberry32(21);
  const petal = cardTexture('blossom', { seed: 42 });
  const items = [];
  const seeds = [];
  const box = { x0: 0.4, x1: 5.2, z0: -20.5, z1: -11.5, yTop: 1.2, fall: 7.5 };
  for (let i = 0; i < WIND.petals; i++) {
    const x = box.x0 + rand() * (box.x1 - box.x0);
    const z = box.z0 + rand() * (box.z1 - box.z0);
    const y = box.yTop - rand() * box.fall;
    const uv = L.worldToUV({ x, y, z });
    items.push({
      position: [x, y, z],
      euler: [jitter(rand, 1.5), rand() * Math.PI * 2, jitter(rand, 1.5)],
      scale: [0.09 + rand() * 0.05, 0.09 + rand() * 0.05, 1],
      color: albedoOf(canopyColorAt(uv.u, Math.min(0.66, Math.max(0.2, uv.v)))).multiplyScalar(1 / petal.mean),
    });
    // seed: fall speed, sway radius, phase, spin rate.
    seeds.push(0.45 + rand() * 0.5, 0.25 + rand() * 0.45, rand() * Math.PI * 2, 0.6 + rand() * 1.4);
  }
  const material = foliageMaterial(petal.texture, { backlit: 0.8 });
  applyPetalDrift(material, box);
  const mesh = instanced('petals', new THREE.PlaneGeometry(1, 1), material, items, { uvOffsets: false });
  mesh.geometry.setAttribute('aPetal', new THREE.InstancedBufferAttribute(new Float32Array(seeds), 4));
  mesh.frustumCulled = false;
  b.add(mesh, 'petals');
  return mesh;
}

function applyPetalDrift(material, box) {
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (previous) previous(shader, renderer);
    shader.uniforms.uTime = { value: clock.time };
    shader.uniforms.uFall = { value: box.fall };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', [
        '#include <common>',
        'uniform float uTime;',
        'uniform float uFall;',
        'attribute vec4 aPetal;',
      ].join('\n'))
      .replace('#include <project_vertex>', [
        'vec4 mvPosition = vec4( transformed, 1.0 );',
        '#ifdef USE_INSTANCING',
        '  mvPosition = instanceMatrix * mvPosition;',
        '#endif',
        '// The fall wraps at uFall, so the field never empties and never needs refilling.',
        'float drop = mod( uTime * aPetal.x, uFall );',
        'float swing = uTime * aPetal.w + aPetal.z;',
        'mvPosition.y -= drop;',
        'mvPosition.x += sin( swing ) * aPetal.y;',
        'mvPosition.z += cos( swing * 0.7 ) * aPetal.y * 0.6;',
        'mvPosition = modelViewMatrix * mvPosition;',
        'gl_Position = projectionMatrix * mvPosition;',
      ].join('\n'));
    registerTimeUniform(shader.uniforms.uTime);
  };
  const previousKey = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `${previousKey()}|petals`;
  return material;
}

// ---- the clock -----------------------------------------------------------------------------------

export function advance(nowMs) {
  if (clock.frozen) return clock.time;
  const now = nowMs / 1000;
  if (clock.last === 0) clock.last = now;
  clock.time += Math.min(0.05, now - clock.last);
  clock.last = now;
  return clock.time;
}

// Pin the animation at `t` seconds. The gates use it so every run shoots the same frame, and
// tools/animation.js walks it across the cycle.
export function setTime(t) {
  clock.time = t;
  clock.frozen = true;
  apply();
}

export function resume() {
  clock.frozen = false;
  clock.last = 0;
}

export function isFrozen() {
  return clock.frozen;
}

export function apply() {
  for (const u of timeUniforms) u.value = clock.time;
  for (const s of swayObjects) {
    s.object.rotation.z = Math.sin(clock.time * 0.8 * s.rate + s.phase) * s.amplitude;
    s.object.rotation.x = Math.cos(clock.time * 0.63 * s.rate + s.phase) * s.amplitude * 0.6;
  }
}

export function time() {
  return clock.time;
}
