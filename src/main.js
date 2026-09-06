// Entry point: renderer, the photo camera, orbit controls with reset, the scene, the light rig, the post
// chain, and the hooks the test tools use (window.__scene, window.__sceneResolve from index.html).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as L from './layout.js';
import { CAMERA, COLORS, uvToWorld } from './layout.js';
import { buildScene } from './scene.js';
import { buildLighting, applyShadowFlags } from './lighting.js';
import { buildComposer, resizeComposer, postState, composerSize } from './post.js';
import { MATERIALS } from './materials.js';
import { sceneRadiance } from './tonemap.js';
import * as anim from './animation.js';
import { mountDebug } from './debug.js';

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
// The corridor above only reaches the near stairway pinch: its `top` is measured above the LOCAL street
// surface, which is right for the low retaining walls built along that same slope. The two house rows'
// roof mass sits at a roughly fixed absolute height instead, and runs deeper than the corridor's z1 (the
// right machiya's back is at RIGHT_MACHIYA.z0 = -21, six metres past the old z1 = -15). Past either
// boundary the clamp was a no-op, and ordinary orbiting, helped along by the controls' own damping which
// keeps rotating for dozens of frames after the mouse is released, could carry the camera to within
// centimetres of that roof mass. Its outside faces carry the photo's own near-black eave shadow
// (C.eaveDark, C.topEaveUnder), so a surface meant to be seen from 18 m away filled the frame with a
// black rectangle that nothing pulled the camera back out of: the second half of the "giant rectangular
// blackouts" a user reported. Measured at radius 18, the photo view's own distance with no zoom, an
// exhaustive sweep of 2580 poses within half a metre of a roof box left 2580 of them unclamped; with
// this zone, none. A live mouse drag that settled at 100% of a 32x32 block near-black now settles at
// 14.5%. The 0.5 m margins match FLOOR_CLEARANCE's scale and are measured, not guessed: a first pass at
// 0.3 m still left 162 poses just above the roof unclamped.
const ROOF_ZONE = { z0: 4.0, z1: L.RIGHT_MACHIYA.z0 - 0.5, top: L.RIGHT_MACHIYA.roofY + 0.5 + 0.5 };
function clampCamera() {
  const p = camera.position;
  const ground = Math.min(L.streetY(p.z), L.farGroundY(p.z));
  const floor = ground + FLOOR_CLEARANCE;
  if (p.y < floor) p.y = floor;
  // Inside the street's corridor and below the eaves, or within the house rows' own height and depth
  // whatever the street is doing beneath them, hold the camera between the two walls.
  const inCorridor = p.z < CORRIDOR.z0 && p.z > CORRIDOR.z1 && p.y < L.streetY(p.z) + CORRIDOR.top;
  const inRoofZone = p.z < ROOF_ZONE.z0 && p.z > ROOF_ZONE.z1 && p.y < ROOF_ZONE.top;
  if (inCorridor || inRoofZone) {
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
  // Not while a form control has the keyboard: R in the scene picker means "jump to the scene starting
  // with R", and the browser's own Ctrl+R and Cmd+R are not ours to take either.
  if (event.target instanceof Element && event.target.closest('select, input, textarea')) return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === 'r' || event.key === 'R') resetView();
});
document.getElementById('reset').addEventListener('click', resetView);

const { group } = buildScene();
scene.add(group);
const lights = buildLighting(scene, renderer);
const shadowCasters = applyShadowFlags(group);
// The photo view is set before the composer is built, because building it renders and inspects a real
// frame to prove the post chain survives on this driver at this size (see src/post.js), and that frame
// should be the scene as it is meant to be seen rather than whatever the default camera happens to face.
applyPhotoView();
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
  // The camera is updated before the composer, because resizing the composer renders and inspects a real
  // frame at the new size and that frame should be framed the way the next one will be.
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  resizeComposer(composer, renderer);
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
      // What the post chain settled on for this size, and what the verification measured getting there.
      post: postState(),
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
// The debug harness: off unless ?debug=1 or the D key. It watches for canvas nobody painted, which is a
// different fault from a dark render and cannot be told apart in a screenshot.
mountDebug(api);

let frames = 0;
function frame(now) {
  controls.update();
  clampCamera();
  anim.advance(now ?? performance.now());
  anim.apply();
  // The composer's own target resolution, not the canvas: post.js may render above the drawing buffer,
  // and that is the resolution sub-pixel geometry actually rasterizes at, which is what decides how far
  // a strand has to be widened to still cover a sample. Cheap enough to redo every frame, so a resize or
  // a first-frame shader compile is never stale for more than one.
  anim.updateScreenScale(composerSize(renderer).y, camera.fov);
  render();
  frames++;
  if (frames === 2) window.__sceneResolve(api);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
