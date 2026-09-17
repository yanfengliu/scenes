// The light rig: the low sun behind the ridge, the sky's own light, and the environment the sky provides
// for reflections and the rim through the blossoms.
//
// The rig is normalised against MATERIALS.irradiance (0.95, swept): a surface at a typical orientation
// receives about that much, so a material whose albedo came from `albedoOf` displays as its sampled photo
// mean again (see src/materials.js). The shares below sum to more, because no surface faces every light
// at once. The
// sun carries a minority of that energy, because the photo's means already contain the photo's own
// directional light; what the sun adds is the difference between surfaces that turn toward it and away
// from it, the rim through the canopy, the sheen on the tiles and the shadows.
//
// Shadow casting is capped: the buildings, walls and the cherry's wood cast, the 30,000 blossom cards do
// not. Casting from the cards costs more than the whole rest of the frame and the photo's canopy shadow
// is already in the paving's sampled means.
import * as THREE from 'three';
import * as L from './layout.js';
import { skyMaterial } from './sky.js';
import { sceneRadiance } from './tonemap.js';
import { MATERIALS, BACKLIGHT } from './materials.js';

const C = L.COLORS;

// Shares of the normalised irradiance, and why they are split this way. The photo's means already carry
// the photo's own directional light, so most of the rig's energy is `ambient`: neutral, orientation-flat,
// and it leaves those means where phase 3 put them. What the rest buys is what a flat color cannot have.
// `sky` is the hemisphere's tint (blue from above, warm from the ground) kept small, because a strong one
// turns every up-facing surface blue and every wall dark; `sun` drives the shading difference, the
// specular sheen, the rim and the shadows; `fill` opens the faces turned away from it. The numbers were
// swept against the per-cell ranking, not chosen by eye (see the phase 4 devlog).
export const RIG = {
  ambient: 0.78,
  sun: 0.18,
  sky: 0.14,
  ground: 0.1,
  fill: 0.06,
  shadowRadius: 3.5,
  shadowBias: -0.0009,
  shadowNormalBias: 0.05,
  shadowMapSize: 2048,
  envIntensity: 0.12,
};

const radiance = (hex, scale = 1) => {
  const [r, g, b] = sceneRadiance(hex, { exposure: MATERIALS.exposure });
  const max = Math.max(r, g, b, 1e-6);
  return { color: new THREE.Color().setRGB(r / max, g / max, b / max, THREE.LinearSRGBColorSpace), intensity: max * scale };
};

export function sunDirection() {
  const p = L.uvToWorld(L.SUN.u, L.SUN.v, 100);
  const eye = new THREE.Vector3(L.CAMERA.eye.x, L.CAMERA.eye.y, L.CAMERA.eye.z);
  return new THREE.Vector3(p.x, p.y, p.z).sub(eye).normalize();
}

export function buildLighting(scene, renderer) {
  const dir = sunDirection();

  // The sun. Its color is the sampled glare, normalised so the rig's share is what sets the level; three
  // divides the diffuse BRDF by PI, so a share of 1 needs an intensity of PI.
  const sun = new THREE.DirectionalLight(0xffffff, Math.PI * RIG.sun);
  const sunTint = radiance(C.skySun);
  sun.color.copy(sunTint.color);
  sun.position.copy(dir).multiplyScalar(60).add(new THREE.Vector3(0, 0, -18));
  sun.target.position.set(0, -2, -18);
  scene.add(sun.target);
  sun.castShadow = true;
  const cam = sun.shadow.camera;
  cam.left = -26;
  cam.right = 26;
  cam.top = 22;
  cam.bottom = -22;
  cam.near = 1;
  cam.far = 140;
  sun.shadow.mapSize.set(RIG.shadowMapSize, RIG.shadowMapSize);
  sun.shadow.radius = RIG.shadowRadius;
  sun.shadow.bias = RIG.shadowBias;
  sun.shadow.normalBias = RIG.shadowNormalBias;
  sun.name = 'sun';
  scene.add(sun);
  // The foliage's translucency term uses the same direction and color as the sun itself.
  BACKLIGHT.direction.copy(dir);
  BACKLIGHT.color.copy(sun.color).multiplyScalar(RIG.sun);

  // The bulk of the light: neutral and orientation-flat, so the sampled means stay where they are.
  const ambient = new THREE.AmbientLight(0xffffff, Math.PI * RIG.ambient);
  ambient.name = 'ambient';
  scene.add(ambient);

  // The sky's own tint on top of it: blue from above, warm from the ground below.
  const skyTint = radiance(C.skyTopBlue);
  const groundTint = radiance(C.landing);
  const hemi = new THREE.HemisphereLight(skyTint.color, groundTint.color, Math.PI * RIG.sky);
  hemi.groundColor.copy(groundTint.color).multiplyScalar(RIG.ground / RIG.sky);
  hemi.name = 'sky light';
  scene.add(hemi);

  // A weak fill from the camera side, so the street's faces keep the photo's open shadows.
  const fill = new THREE.DirectionalLight(0xffffff, Math.PI * RIG.fill);
  fill.color.copy(radiance(C.skyHorizon).color);
  fill.position.set(6, 12, 20);
  fill.target.position.set(0, -3, -14);
  scene.add(fill.target);
  fill.name = 'fill';
  scene.add(fill);

  installEnvironment(renderer, scene);
  return { sun, ambient, hemi, fill };
}

// The environment map, generated from the sky dome itself so reflections and the rim light on the
// blossoms carry the same glare the sky shows.
function skyEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const skyScene = new THREE.Scene();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMaterial());
  skyScene.add(dome);
  const target = pmrem.fromScene(skyScene, 0, 0.1, 200);
  dome.geometry.dispose();
  dome.material.dispose();
  pmrem.dispose();
  return target.texture;
}

// ---------------------------------------------------------------------------------------------------
// Proving the environment map
//
// This rig builds an image-based light out of the sky dome and hands it to every lit material through
// `scene.environment`. Until 2026-09-17 it built that map and never looked at it, and that is the hole
// the unexplained flake of that day fell through. `npm run shot` drew a frame scoring 0.0632 / 0.5718
// from a tree that scored 0.05958 / 0.57134 in three other runs, and what separates those two frames is,
// to the precision the recorded cell means carry, exactly this map's contribution: removing the
// environment puts 416 of 528 cells on the bad frame EXACTLY, against 63 for the good frame and 68 for
// the next best of twelve scene knobs, and over rows 3-21 -- 86% of the frame -- the residual is mean
// 0.002 of a luma level (docs/devlog/detailed/2026-09-17-shot-rung.md). It is an identity, not a
// correlation. Not one number about it was recorded by the page or by any gate.
//
// So the map is proved the way src/post.js proves the post chain: it is built, then measured, and what
// was measured travels in `window.__scene.describe().env` for a gate to record, print and refuse.
//
// THREE MEASUREMENTS, BECAUSE THERE ARE THREE WAYS FOR THE LIGHT TO GO MISSING, and a proof that says
// only "no light" cannot tell them apart:
//   1. A BLACK PMREM. The texture is the right shape and carries no radiance. `inspectEnvMap` renders it
//      through a detector shader and reads back its mean luminance and any texel that is not a finite
//      number. Measured 2026-09-17: 115.6 on an RTX 4090 and 117.6 on SwiftShader; a black map reads 0.
//   2. A TEXTURE WHOSE `image.height` IS 0. three compiles the cube-UV lookup's texel size and mip count
//      into each program from `scene.environment.image.height` (`envMapCubeUVHeight`), so a map full of
//      radiance still reads back black through a lookup built from a height of 0. That is a field, not a
//      render: `describeEnvTexture` reads the height, the mapping and the type, free.
//   3. MATERIALS COMPILED AGAINST A DIFFERENT ENVIRONMENT than the one in place. three records, per
//      material, the environment its program was built for; `envBinding` counts the lit ones whose record
//      is not the map installed here. Measured: 239 of 256 standard materials have a program at the photo
//      view and all 239 agree; the other 17 have never been drawn and have no program to ask about, which
//      is why the check is "none disagrees" and not "all 256 agree".
//
// AND ONE END-TO-END MEASUREMENT, because those three are mechanisms and a fourth is possible -- the
// whole reason this lane exists is that the mechanism of the 2026-09-17 frame is still unknown:
//   4. WHAT THE MAP ACTUALLY ADDS TO THE FRAME. `envContribution` renders the photo view at 64x64 with no
//      post chain, once with the map's intensity at its rig value and once at zero, and reports the
//      difference in mean luminance. Measured 2.768 levels on the GPU and 2.812 on SwiftShader, which is
//      the same size as the 2.9 that separates the flake's frame from the contract's (referenceLuma 54.6
//      against 57.5). THE INTENSITY IS THE KNOB AND `scene.environment` IS NOT, measured rather than
//      assumed: setting the intensity to 0 moves a uniform and costs 9 ms on the GPU and 428 ms on
//      SwiftShader, while setting `scene.environment` to null recompiles 18 programs and costs 1.2 s and
//      1.7 s. The two answers differ by 0.02 of a luma level (out/scratch/env-probe.mjs, 2026-09-17).
//
// WHAT HAPPENS WHEN THE PROOF FAILS, and it is deliberately not one answer for all of it:
//   - The MAP is bad: BUILD IT AGAIN, once, before it is installed. The sky dome is deterministic and the
//     generator is fresh, so a second build is a real remedy for a transient and costs nothing at all on
//     a machine where the first one worked. A rejected map is NOT disposed: three may already hold a
//     reference, and this repo has been bitten by disposing something three still had (see the
//     "Invalid value used as weak map key" note in AGENTS.md). One 768x1024 half-float texture is the
//     cheaper mistake, and only on a machine that is already faulting.
//   - The map is fine and the FRAME does not receive it: report, and do NOT rebuild. Rebuilding a map
//     that already carries light cannot fix a lookup, a binding or an unknown fourth mechanism, and it
//     would hide the fault behind a second identical map.
//   - NOTHING THROWS AND NOTHING IS SWITCHED OFF. The page is a sandbox a person opens, and a scene that
//     is 5% dark is still a scene; the frame that must not be wrong is the SCORED one. `tools/shot.js`
//     refuses it on this state and `tools/compare.js` refuses the sidecar. That is the same split
//     src/post.js settled on for its watchdog: announce, record, and let the gate whose frame is a
//     contract be the one that fails.
//
// THE BOUNDS, and they are real:
//   - The map and the contribution are measured ONCE, at build. A map that goes black after the scene is
//     built is invisible here; what is re-read on every `envState()` is the cheap half -- that
//     `scene.environment` is still this map, that the intensity is still the rig's, that the height is
//     still non-zero, and the per-material binding. There is no per-frame watchdog for the light.
//   - `console.warn('env: ...')` below is for a person with the page open. `tools/lib/browser.js` echoes
//     `post:` and `watchdog:` lines and nothing else, so no gate sees this one; what a gate sees is the
//     state. Echoing `env:` there is a one-line change this lane's file boundary did not include.
//   - It proves the map carries light and reaches the materials. It does not prove the map is RIGHT: a
//     sky rebuilt in the wrong colour passes every check here.
// ---------------------------------------------------------------------------------------------------

export const ENV_PROBE = {
  // Taps across the cube-UV atlas: 1024 of them, the same grid src/post.js puts on the composer's
  // buffers. The atlas has unused padding in it, so this is a mean over the whole texture and not over
  // the sky; what it has to separate is "light" from "none", and 115 from 0 does not need precision.
  grid: 32,
  // Any texel that is not a finite number is a broken map. A correct PMREM has none, ever.
  maxBadTaps: 0,
  // The map must carry light. Healthy is 115.6 on a GPU and 117.6 on SwiftShader (2026-09-17), so this
  // floor is about a tenth of it: far below anything a resampled sky can drift to, far above black. The
  // two renderers do not agree to the decimal, which is why nothing near the measured value is pinned.
  minMapLuma: 12,
  // The end-to-end render, the same size and shape as src/post.js's own reference render.
  referenceSize: 64,
  // The floor on measurement 4, in luma levels per unit of RIG.envIntensity, so a rig that legitimately
  // turns the environment down moves the floor with it and nobody has to maintain a figure. Measured
  // 23.1 per unit on the GPU and 23.4 on SwiftShader at RIG.envIntensity 0.12; this is a sixth of that.
  contributionPerIntensity: 4,
  // And the second half of that floor, which exists because the first half is built out of the very
  // constant it checks: at RIG.envIntensity 0 the proportional floor is 0 and a dead map would pass
  // vacuously. This is the absolute minimum contribution whatever the rig says, so turning the
  // environment down far enough to matter is a decision someone makes here in the open.
  minContribution: 0.25,
  // How many further builds the map gets before the rig stops and reports. One.
  rebuilds: 1,
};

// The floor measurement 4 is held to. Both halves are in ENV_PROBE, above, with what they were measured
// against.
export function contributionFloor() {
  return Math.max(ENV_PROBE.minContribution, ENV_PROBE.contributionPerIntensity * RIG.envIntensity);
}

let envRig = null;
function envProbeRig() {
  if (envRig) return envRig;
  const detector = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: { tMap: { value: null } },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    // The same detector src/post.js puts on the composer's buffers: red flags a value that is not a
    // finite number, green carries the tap's linear luminance. A NaN fails both of "greater or equal to
    // zero" and "less or equal to zero", which no real number does.
    fragmentShader: `
      uniform sampler2D tMap;
      varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tMap, vUv).rgb;
        bool finite = (c.r >= 0.0 || c.r <= 0.0) && (c.g >= 0.0 || c.g <= 0.0) && (c.b >= 0.0 || c.b <= 0.0);
        finite = finite && max(max(abs(c.r), abs(c.g)), abs(c.b)) <= 65504.0;
        float l = clamp(dot(max(c, vec3(0.0)), vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
        gl_FragColor = vec4(finite ? 0.0 : 1.0, l, 0.0, 1.0);
      }`,
  });
  // The photo view, rebuilt here from the same camera model src/layout.js gives src/main.js, because
  // `buildLighting` runs before main.js poses its camera and the contribution has to be measured where
  // the scored frame looks. Square, because the reference render is square; a differential does not care
  // about the aspect and the absolute figure is not compared to anything.
  const camera = new THREE.PerspectiveCamera(L.CAMERA.fovDeg, 1, 0.2, 6000);
  camera.position.set(L.CAMERA.eye.x, L.CAMERA.eye.y, L.CAMERA.eye.z);
  const at = L.uvToWorld(0.5, 0.5, L.CAMERA.targetDepth);
  camera.lookAt(at.x, at.y, at.z);
  camera.updateMatrixWorld();
  envRig = {
    detector,
    detectorScene: new THREE.Scene().add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), detector)),
    quadCamera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    camera,
    // Eight bits is all a verdict needs, and every driver can read this format back.
    readback: new THREE.WebGLRenderTarget(ENV_PROBE.grid, ENV_PROBE.grid, { depthBuffer: false, stencilBuffer: false }),
    pixels: new Uint8Array(ENV_PROBE.grid * ENV_PROBE.grid * 4),
    reference: new THREE.WebGLRenderTarget(ENV_PROBE.referenceSize, ENV_PROBE.referenceSize, { depthBuffer: true, stencilBuffer: false }),
    referencePixels: new Uint8Array(ENV_PROBE.referenceSize * ENV_PROBE.referenceSize * 4),
  };
  return envRig;
}

// Measurement 2, and it costs nothing: the fields three itself compiles the cube-UV lookup from.
function describeEnvTexture(texture) {
  const image = texture ? texture.image : null;
  const height = image ? image.height : 0;
  return {
    present: !!texture,
    cubeUV: !!texture && texture.mapping === THREE.CubeUVReflectionMapping,
    mapping: texture ? texture.mapping : null,
    type: texture ? texture.type : null,
    width: image ? image.width : 0,
    height,
    // What three's `envmap_physical_pars_fragment` derives from the height. A height of 0 makes this
    // -Infinity and the lookup returns black with the texture full of radiance.
    maxMip: height > 0 ? Math.log2(height) - 2 : null,
  };
}

// Measurement 1: render the map through the detector and read back what it carries.
function inspectEnvMap(renderer, texture) {
  const r = envProbeRig();
  r.detector.uniforms.tMap.value = texture;
  const wasTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(r.readback);
  renderer.render(r.detectorScene, r.quadCamera);
  renderer.setRenderTarget(wasTarget);
  renderer.readRenderTargetPixels(r.readback, 0, 0, ENV_PROBE.grid, ENV_PROBE.grid, r.pixels);
  const n = ENV_PROBE.grid * ENV_PROBE.grid;
  let bad = 0;
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    if (r.pixels[i * 4] > 127) bad++;
    sum += r.pixels[i * 4 + 1];
    peak = Math.max(peak, r.pixels[i * 4 + 1]);
  }
  return { badTaps: +((100 * bad) / n).toFixed(1), meanLuma: +(sum / n).toFixed(1), peakLuma: peak };
}

// The photo view at 64x64 with no post chain, as src/post.js's reference render does it: three applies
// the tone curve only when drawing to the canvas, so this is linear radiance in an 8-bit target.
function sceneLuma(renderer, scene) {
  const r = envProbeRig();
  const size = ENV_PROBE.referenceSize;
  const wasTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(r.reference);
  renderer.clear();
  renderer.render(scene, r.camera);
  renderer.setRenderTarget(wasTarget);
  renderer.readRenderTargetPixels(r.reference, 0, 0, size, size, r.referencePixels);
  let sum = 0;
  const n = size * size;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    sum += 0.2126 * r.referencePixels[o] + 0.7152 * r.referencePixels[o + 1] + 0.0722 * r.referencePixels[o + 2];
  }
  return sum / n;
}

// Measurement 4: the difference the map makes to the frame, through the intensity uniform rather than
// through `scene.environment`, which would recompile every lit program (see the header).
function envContribution(renderer, scene) {
  const kept = scene.environmentIntensity;
  // Dark arm first, so the LAST render of this measurement is the one with the rig's own intensity in
  // place. That is tidiness and not correctness: three writes `envMapIntensity` into the uniform from
  // `scene.environmentIntensity` on every single draw, so nothing is left carrying a zero either way. An
  // earlier version of this comment claimed the opposite and a review corrected it; the same fact is why
  // measurement 4 has to move the SCENE's intensity and why moving each material's own does nothing.
  scene.environmentIntensity = 0;
  const without = sceneLuma(renderer, scene);
  scene.environmentIntensity = kept;
  const withEnv = sceneLuma(renderer, scene);
  return { withEnv: +withEnv.toFixed(2), without: +without.toFixed(2), delta: +(withEnv - without).toFixed(2) };
}

// Measurement 3: what each lit material's program was compiled against. No render and no upload, so
// `envState()` can ask it on every call; `renderer.properties.get` does create an empty record for a
// material three has not drawn yet, which is what three itself does and costs a WeakMap entry.
//
// ITS POWER IS NARROWER THAN IT LOOKS, and an independent review established why by reading three rather
// than by arguing. `materialProperties.environment` is written in exactly one place, the program-build
// path, and it is NOT one of the fields three's own `needsProgramChange` chain tests -- that chain tests
// `materialProperties.envMap`. So three never repairs a stale value on its own (measured: a record forced
// stale stayed stale for the rest of the page), and equally, every NATURAL way `scene.environment` can
// change also changes `envMap`, which forces a rebuild and resyncs this field. What that leaves is a
// cheap direct read of what each program was compiled against, whose only demonstrated firing is from a
// write into three's own record; the natural case it was meant to catch is caught by the identity check
// in `envState` instead. It is kept because it is free and because it is the only thing here that looks
// at the programs rather than at the scene.
function envBinding(renderer, scene) {
  const props = renderer.properties;
  let lit = 0;
  let compiled = 0;
  let mismatched = 0;
  scene.traverse((object) => {
    if (!object.isMesh) return;
    for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
      if (!material || !material.isMeshStandardMaterial) continue;
      lit++;
      const record = props ? props.get(material) : null;
      // `environment` is undefined until three has built a program for this material. A material that
      // has never been drawn -- 17 of them at the photo view -- has nothing to disagree with.
      if (!record || record.environment === undefined) continue;
      compiled++;
      if (record.environment !== scene.environment) mismatched++;
    }
  });
  return { lit, compiled, mismatched };
}

// What the rig built and what it measured, for `window.__scene.describe().env`. `installed` is the map
// this module put on the scene; `envState` compares it by identity with whatever is on the scene now,
// which is how a swapped or cleared environment is caught without carrying a texture across CDP.
let envInfo = null;
let installed = null;
let envSubject = null;

// Build the map, prove it, and install it. See the header for why a bad MAP is rebuilt and a map that
// the frame does not receive is not.
function installEnvironment(renderer, scene) {
  // three resets these on every frame and src/main.js reads them back through `describe()`, but this
  // runs before the first frame and before `renderer.info.autoReset` is turned off, so save and restore
  // them anyway: a future caller that runs this later should not see the frame's counters move.
  //
  // FOUR COUNTERS, AND DELIBERATELY NOT `frame`. `info.render.frame` is not a statistic, it is three's
  // "once per frame" memo key -- `WebGLObjects.update`, `updateVideoTexture` and the UBO cache all store
  // it in a WeakMap and skip an upload whose memo already holds the current number. `PMREMGenerator`
  // renders about two dozen times, so restoring the saved value would roll the counter back and let the
  // next couple of dozen real frames skip a geometry or instance-matrix upload in silence. Nothing in
  // this scene would notice today, because every `needsUpdate` in src/ fires at build; a future one
  // would, and it would be invisible. Found by an independent review.
  const { frame, ...counters } = renderer.info.render;
  let builds = 0;
  let texture = null;
  let shape = null;
  let map = null;
  const why = [];
  while (builds <= ENV_PROBE.rebuilds) {
    builds++;
    texture = skyEnvironment(renderer);
    shape = describeEnvTexture(texture);
    map = inspectEnvMap(renderer, texture);
    const faults = mapFaults(shape, map);
    if (!faults.length) break;
    if (builds > ENV_PROBE.rebuilds) {
      why.push(...faults);
      break;
    }
    console.warn(
      `env: the environment map this rig built out of the sky dome ${faults.join('; ')}. Building it again `
      + `(attempt ${builds + 1} of ${ENV_PROBE.rebuilds + 1}); the dome is deterministic, so a second build `
      + 'is only a remedy for something transient.',
    );
  }
  installed = texture;
  scene.environment = texture;
  scene.environmentIntensity = RIG.envIntensity;
  envSubject = { renderer, scene };
  const contribution = envContribution(renderer, scene);
  const floor = contributionFloor();
  if (contribution.delta < floor) {
    why.push(
      `it adds ${contribution.delta} of a luma level to the photo view at 64x64 (${contribution.withEnv} `
      + `with scene.environmentIntensity at ${RIG.envIntensity}, ${contribution.without} at 0), under the `
      + `${+floor.toFixed(2)} this scene requires. The map itself reads mean luma ${map.meanLuma} over `
      + `${ENV_PROBE.grid * ENV_PROBE.grid} taps and its image is ${shape.width}x${shape.height}, so if `
      + 'both of those look healthy the light is being lost between the map and the materials rather than '
      + 'in the map'
    );
  }
  envInfo = { builds, shape, map, contribution, floor: +floor.toFixed(2), buildWhy: why };
  if (why.length) {
    console.warn(
      `env: the environment map is not proved on this machine -- ${why.join('; ')}. The scene will render `
      + 'without the light this map should add, which is about 5% of it. Nothing is switched off; '
      + 'window.__scene.describe().env carries the numbers and npm run shot refuses a frame drawn like '
      + 'this.',
    );
  }
  Object.assign(renderer.info.render, counters);
}

function mapFaults(shape, map) {
  const faults = [];
  if (!shape.present) {
    faults.push('came back as nothing at all (PMREMGenerator.fromScene returned a target with no texture)');
    return faults;
  }
  if (!shape.cubeUV) {
    faults.push(
      `has mapping ${shape.mapping} rather than THREE.CubeUVReflectionMapping (${THREE.CubeUVReflectionMapping}), `
      + 'which is the only mapping three will read an image-based light out of',
    );
  }
  if (!(shape.height > 0)) {
    faults.push(
      `has an image height of ${shape.height}, and three compiles the cube-UV lookup's texel size and mip `
      + 'count into every lit program from that height (envMapCubeUVHeight), so the lookup returns black '
      + 'however much radiance the texture holds',
    );
  }
  if (map.badTaps > ENV_PROBE.maxBadTaps) {
    faults.push(`has ${map.badTaps}% of its texels not a finite number, over ${ENV_PROBE.grid * ENV_PROBE.grid} taps`);
  }
  if (map.meanLuma < ENV_PROBE.minMapLuma) {
    faults.push(
      `carries mean luma ${map.meanLuma} over ${ENV_PROBE.grid * ENV_PROBE.grid} taps, under the `
      + `${ENV_PROBE.minMapLuma} a map with light in it has to reach (a healthy build reads about 116, a `
      + 'black one reads 0)',
    );
  }
  return faults;
}

// The whole environment state, for `window.__scene.describe().env`: what the build measured, plus the
// cheap half re-read now. `ok` is decided here rather than at build, because three of the five things
// that can be wrong -- the map swapped out, the intensity moved, a material bound to something else --
// can only become true after the build.
export function envState() {
  if (envInfo === null) return null;
  const { renderer, scene } = envSubject;
  const live = describeEnvTexture(scene.environment);
  const binding = envBinding(renderer, scene);
  const why = [...envInfo.buildWhy];
  if (!live.present) {
    why.push('scene.environment is empty now, though this rig installed a map on it at build');
  } else if (scene.environment !== installed) {
    why.push('scene.environment is not the map this rig built and measured, so nothing here describes the light the frame is actually getting');
  }
  if (!(live.height > 0)) {
    why.push(`scene.environment's image height is ${live.height} now, so three's cube-UV lookup returns black whatever the texture holds`);
  } else if (live.height !== envInfo.shape.height || live.width !== envInfo.shape.width) {
    // No absolute size is asserted -- a PMREM's atlas is whatever the generator chose -- but it may not
    // CHANGE after the build, and a height that is wrong while still being a positive power of two is the
    // silent half of the cube-UV fault: three writes `CUBEUV_MAX_MIP` into every lit program as
    // `${Math.log2(height) - 2}.0`, so a height of 0 makes that `-Infinity.0` and fails to compile loudly,
    // while a height of 4 compiles and reads the wrong texels in silence. Measured 2026-09-17.
    why.push(
      `scene.environment's image was ${envInfo.shape.width}x${envInfo.shape.height} when this rig measured `
      + `it and is ${live.width}x${live.height} now, so every lit program's cube-UV lookup was compiled for `
      + 'a texture of a different shape than the one it is reading',
    );
  }
  if (scene.environmentIntensity !== RIG.envIntensity) {
    why.push(`scene.environmentIntensity is ${scene.environmentIntensity}, not the ${RIG.envIntensity} this rig set`);
  }
  if (binding.mismatched > 0) {
    why.push(
      `${binding.mismatched} of ${binding.compiled} lit materials with a program were compiled against a `
      + 'different environment than the one on the scene, so they are reading an image-based light that is '
      + 'no longer there',
    );
  } else if (binding.lit > 0 && binding.compiled === 0) {
    // A run that measured nothing prints the same "0 disagree" as a run that measured 239 of them, which
    // is the failure `tools/clearance.js` asserts against all over itself. Guarded on `lit` so that a
    // scene with no standard materials is not red for having none; caught by an independent review.
    why.push(
      `none of the ${binding.lit} lit materials in this scene has a program yet, so the check on which `
      + 'environment they were compiled against measured nothing at all and its "0 disagree" says nothing. '
      + 'That is what it looks like when this is read before the scene has drawn a frame',
    );
  }
  const { buildWhy, ...rest } = envInfo;
  return { ok: why.length === 0, why, ...rest, live, binding };
}

// Everything receives; the shadow casters are capped. Each caster is a second draw call in the shadow
// pass, so casting is given only to what can put a shadow somewhere the photo view sees: a mesh at least
// CAST_SIZE across, inside the shadow camera's box, and not foliage or a distant layer. The 30,000
// blossom cards are the expensive case and the one this rules out: their shadow is already in the
// paving's sampled means, and casting from them costs more than the whole rest of the frame.
// The wind is patched into each material's own vertex shader, not into three's depth material, so a
// swaying mesh would cast a still shadow. The canopy's cards and strands and the petals are excluded for
// that reason as well as for their cost.
// `far row` is here for the same reason as `far roof` and `corner house`: its colours are photo means
// over the band it fills, so they already contain whatever the real row does to the light around it, and
// a cast shadow on top of that counts the same darkness twice. The photo's own paving beside it is lit
// stone (box (0.355,0.715)-(0.37,0.725) reads #899fb2); what the render puts in that box is the warm
// left plot, not paving, so that box is evidence about the photo and not about the render.
// The cost is that the row is a solid object that throws no shadow, which is wrong from any angle, and
// the photo's own darkening of the paving beside it is carried by `landingShade` in src/paving.js
// instead. Measured both ways on the same tree: casting, 0.0760 / 0.4632; not casting, 0.0758 / 0.4659,
// and 7 draw calls and 22k triangles cheaper. That cell delta is twice iteration 1's noise floor, so it
// is real but small, and this is a trade and not a free win.
// `far house` is here for the same reason as `far roof`, and it is here because renaming two meshes took
// them out of this list by accident. Iteration 4 called its new shared ridge-cap and eave-lip sets
// `far roof ridges` and `far roof lips`, which this pattern already excluded; renaming them to `far house`
// to stop them satisfying `PLACEMENT_CHECKS`'s `far roof` prefix put 37 instances at 22 to 34 m into the
// shadow pass and cost exactly 2 draw calls in the shot (366 with them casting, 364 without). A NAME is
// load-bearing here, which is the kind of coupling worth one line of comment.
// `ground base` no longer exists (iteration 4 replaced it with `outer ground`, which is matched below);
// the token is kept because the pattern costs nothing and an old branch may still build one.
const NO_CAST = /^(far row|sky|hill|mountains|near ridge|ground base|outer ground|far plots|hillside|cherry blossoms|cherry strands|petals|evergreen|shrub|left plant|weeds|moss|sun|fill|far roof|far house|corner house|bend|noren)/;
const CAST_SIZE = 1.6;
const CAST_BOX = { x0: -14, x1: 14, y0: -14, y1: 14, z0: 6, z1: -34 };

export function applyShadowFlags(root) {
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const centre = new THREE.Vector3();
  let casters = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.receiveShadow = true;
    o.castShadow = false;
    if (NO_CAST.test(o.name)) return;
    box.setFromObject(o);
    if (box.isEmpty()) return;
    box.getSize(size);
    box.getCenter(centre);
    const big = [size.x, size.y, size.z].sort((a, b) => b - a)[1] >= CAST_SIZE;
    const inside = centre.x > CAST_BOX.x0 && centre.x < CAST_BOX.x1 && centre.y > CAST_BOX.y0 && centre.y < CAST_BOX.y1 && centre.z < CAST_BOX.z0 && centre.z > CAST_BOX.z1;
    o.castShadow = big && inside;
    if (o.castShadow) casters++;
  });
  return casters;
}
