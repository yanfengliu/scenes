// Entry point: renderer, the photo camera, orbit controls with reset, the scene, the light rig, the post
// chain, and the hooks the test tools use (window.__scene, window.__sceneResolve from index.html).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as L from './layout.js';
import { CAMERA, COLORS, uvToWorld } from './layout.js';
import { buildScene } from './scene.js';
import { buildLighting, applyShadowFlags } from './lighting.js';
import { buildComposer } from './post.js';
import { MATERIALS } from './materials.js';
import { sceneRadiance } from './tonemap.js';
import * as anim from './animation.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
// A device-pixel-ratio cap of 2: past that the cost grows with no visible gain, and phones report 3.
const PIXEL_RATIO_CAP = 2;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, PIXEL_RATIO_CAP));
renderer.setSize(window.innerWidth, window.innerHeight, false);
// One tone curve for the frame, applied by the post chain's OutputPass; every color in the scene is the
// radiance that displays as its photo-sampled mean through it (see src/tonemap.js).
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = MATERIALS.exposure;
renderer.shadowMap.enabled = true;
// PCFSoftShadowMap is deprecated in three 0.185; PCFShadowMap with a shadow radius is the soft PCF.
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
// Distance haze toward the warm pale the photo fades to. The distant layers set their own colors and opt
// out (fog: false), so the fog works on the street, the houses and the canopy. Its color is a photo mean
// like any other, so it is the radiance that displays as that mean, not the mean itself: three mixes it
// in linear space before the tone curve.
scene.fog = new THREE.Fog(new THREE.Color().setRGB(...sceneRadiance(COLORS.fog, { exposure: MATERIALS.exposure }), THREE.LinearSRGBColorSpace), 38, 150);

const camera = new THREE.PerspectiveCamera(CAMERA.fovDeg, window.innerWidth / window.innerHeight, 0.2, 6000);
scene.add(camera);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1;
controls.maxDistance = 120;
// A little past the horizontal, so the roofs can be seen from below without the camera rolling under the
// street. The floor clamp below does the rest of the work, and it lets the view stay low and close.
controls.maxPolarAngle = Math.PI * 0.58;
// Touch: one finger orbits, two pinch and pan, which is what a phone user expects of a scene like this.
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
controls.enablePan = true;
controls.keyPanSpeed = 12;

// Keep the camera above the ground and out of the buildings without caging it. The street's own height
// field gives the floor; the two house rows are a corridor the eye should not pass through. Both are
// applied after the controls have had their say, so a drag that would push through simply stops there.
const FLOOR_CLEARANCE = 0.45;
const CORRIDOR = { x0: L.STREET.x0 - 0.35, x1: L.STREET.x1 + 0.35, z0: 4.0, z1: -15.0, top: 3.2 };
function clampCamera() {
  const p = camera.position;
  const ground = Math.min(L.streetY(p.z), L.farGroundY(p.z));
  const floor = ground + FLOOR_CLEARANCE;
  if (p.y < floor) p.y = floor;
  // Inside the street's corridor and below the eaves, hold the camera between the two walls.
  if (p.z < CORRIDOR.z0 && p.z > CORRIDOR.z1 && p.y < L.streetY(p.z) + CORRIDOR.top) {
    p.x = Math.min(Math.max(p.x, CORRIDOR.x0), CORRIDOR.x1);
  }
  // The target stays in the scene, so the camera cannot be levered out of the world by dragging it away.
  controls.target.y = Math.max(controls.target.y, L.streetY(controls.target.z) - 2);
}

// The photo view: eye at CAMERA.eye looking down the optical axis; the orbit target sits on that axis
// at the cherry trunk's depth so OrbitControls reproduces the pitch exactly.
const target = uvToWorld(0.5, 0.5, CAMERA.targetDepth);
function applyPhotoView() {
  camera.fov = CAMERA.fovDeg;
  camera.position.set(CAMERA.eye.x, CAMERA.eye.y, CAMERA.eye.z);
  camera.updateProjectionMatrix();
  controls.target.set(target.x, target.y, target.z);
  controls.update();
  controls.saveState();
}

function resetView() {
  // Flush any damping residue before restoring the saved photo view, otherwise it nudges the reset.
  controls.enableDamping = false;
  controls.update();
  controls.reset();
  controls.enableDamping = true;
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'r' || event.key === 'R') resetView();
});
document.getElementById('reset').addEventListener('click', resetView);

const { group } = buildScene();
scene.add(group);
const lights = buildLighting(scene, renderer);
const shadowCasters = applyShadowFlags(group);
const { composer, bloom, grade } = buildComposer(renderer, scene, camera);

// The composer renders several passes per frame and three resets its counters on every one of them, so
// the counters are reset once here instead: what `describe` reports is the whole frame, post included.
renderer.info.autoReset = false;
function render() {
  renderer.info.reset();
  composer.render();
}

function onResize() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, PIXEL_RATIO_CAP));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  composer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
// Moving the window to a screen with a different pixel ratio fires this, not resize.
window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener?.('change', onResize);

function rendererName() {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
}

const api = {
  THREE,
  scene,
  camera,
  controls,
  renderer,
  composer,
  bloom,
  grade,
  lights,
  render,
  resetView,
  // The animation clock. `setTime` pins it so a gate shoots the same frame every run; tools/animation.js
  // walks it across the cycle to prove the photo view holds at any moment.
  setTime(t) {
    anim.setTime(t);
    render();
  },
  resumeAnimation: anim.resume,
  animationTime: anim.time,
  describe() {
    return {
      renderer: rendererName(),
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      shadowCasters,
      pixelRatio: renderer.getPixelRatio(),
      animationTime: anim.time(),
      width: renderer.domElement.width,
      height: renderer.domElement.height,
    };
  },
  // True per-frame cost: render the whole chain, then read one pixel so the call blocks until the frame
  // is finished.
  async benchmark(seconds = 5) {
    const gl = renderer.getContext();
    const pixel = new Uint8Array(4);
    const times = [];
    const end = performance.now() + seconds * 1000;
    while (performance.now() < end) {
      const t0 = performance.now();
      render();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      times.push(performance.now() - t0);
      if (times.length % 10 === 0) await new Promise((done) => setTimeout(done, 0));
    }
    times.sort((a, b) => a - b);
    return {
      frames: times.length,
      medianMs: times[times.length >> 1],
      p95Ms: times[Math.min(times.length - 1, Math.floor(times.length * 0.95))],
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      renderer: rendererName(),
    };
  },
};
window.__scene = api;

applyPhotoView();
let frames = 0;
function frame(now) {
  controls.update();
  clampCamera();
  anim.advance(now ?? performance.now());
  anim.apply();
  render();
  frames++;
  if (frames === 2) window.__sceneResolve(api);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
