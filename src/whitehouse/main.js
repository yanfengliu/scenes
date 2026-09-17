// The White House and its grounds -- entry point: renderer, the photo camera, orbit controls with reset,
// the scene group, this scene's own light rig, the post chain, and the hooks the test tools use
// (window.__scene, window.__sceneResolve from index.html).
//
// A sibling of src/main.js and deliberately the same order of operations, because contract section 10's sequence is
// what every tool assumes: renderer first with the exact flags, then the scene group, then the lights, then
// the shadow flags, then POSE THE CAMERA (before the composer, whose construction renders and inspects a
// real frame), then buildComposer, then the frame loop, then window.__scene and __sceneResolve at frame 2.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERA, DIMS, uvToWorld } from './layout.js';
import { buildScene } from './scene.js';
import { buildLighting, applyShadowFlags, fogFor } from './lighting.js';
import { buildComposer, resizeComposer, postState, composerSize, watchPostChain } from '../post.js';
import { MATERIALS } from '../materials.js';
import * as anim from '../animation.js';
import { mountDebug } from '../debug.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
// A device-pixel-ratio cap of 2: past that the cost grows with no visible gain, and phones report 3.
const PIXEL_RATIO_CAP = 2;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, PIXEL_RATIO_CAP));
renderer.setSize(window.innerWidth, window.innerHeight, false);
// One tone curve for the frame, applied by the post chain's OutputPass; every colour in the scene is the
// radiance that displays as its photo-sampled mean through it (see src/tonemap.js).
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = MATERIALS.exposure;
renderer.shadowMap.enabled = true;
// PCFSoftShadowMap is deprecated in three 0.185; PCFShadowMap with a shadow radius is the soft PCF.
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
fogFor(scene);

const camera = new THREE.PerspectiveCamera(CAMERA.fovDeg, window.innerWidth / window.innerHeight, CAMERA.near, CAMERA.far);
scene.add(camera);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 4;
// The scene is 200 m across, so the camera may pull a long way back without leaving it.
controls.maxDistance = 260;
// A little past the horizontal, so the roofs and the balustrade can be seen from below without the camera
// rolling under the lawn. The floor clamp below does the rest.
controls.maxPolarAngle = Math.PI * 0.6;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
controls.enablePan = true;
controls.keyPanSpeed = 24;

// Keep the camera above the ground and out of the building without caging it. Two rules: never below a
// metre over whichever lawn the camera is above, and never inside the main block's own footprint.
const FLOOR_CLEARANCE = 1.0;
const BLOCK = {
  x0: -DIMS.blockLength / 2 - 1,
  x1: DIMS.blockLength / 2 + 1,
  z0: -DIMS.blockDepth - DIMS.southBowProjection - 1,
  z1: 13.5,
  top: DIMS.northFacade + 7,
};
function clampCamera() {
  const p = camera.position;
  // The lawn the camera is over: the north side is y = 0, the south side is 3 m lower.
  const ground = p.z < -DIMS.blockDepth ? -DIMS.southLawnDrop : 0;
  const floor = ground + FLOOR_CLEARANCE;
  if (p.y < floor) p.y = floor;
  // Inside the block, below its roofline: push the camera out of the nearest face rather than let it see
  // the inside of a wall. Applied after the controls have had their say, so a drag that would push through
  // simply stops at the face.
  if (p.x > BLOCK.x0 && p.x < BLOCK.x1 && p.z > BLOCK.z0 && p.z < BLOCK.z1 && p.y < BLOCK.top) {
    const dx = Math.min(p.x - BLOCK.x0, BLOCK.x1 - p.x);
    const dz = Math.min(p.z - BLOCK.z0, BLOCK.z1 - p.z);
    if (dx < dz) p.x = p.x - BLOCK.x0 < BLOCK.x1 - p.x ? BLOCK.x0 : BLOCK.x1;
    else p.z = p.z - BLOCK.z0 < BLOCK.z1 - p.z ? BLOCK.z0 : BLOCK.z1;
  }
  // The target stays in the scene, so the camera cannot be levered out of the world by dragging it away.
  controls.target.y = Math.max(controls.target.y, ground + 1);
}

// The photo view. The camera's own basis in layout.js has no yaw and no roll and a pitch of 0.000, so the
// optical axis runs due south from the eye; the orbit target sits on it at the wall plane's depth, which is
// what makes OrbitControls reproduce the pitch exactly after a reset.
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
const resetButton = document.getElementById('reset');
if (resetButton) resetButton.addEventListener('click', resetView);

const { group } = buildScene();
scene.add(group);
const lights = buildLighting(scene, renderer);
const shadowCasters = applyShadowFlags(group);
// The photo view is set before the composer is built, because building it renders and inspects a real frame
// to prove the post chain survives on this driver at this size (see src/post.js), and that frame should be
// the scene as it is meant to be seen rather than whatever the default camera happens to face.
applyPhotoView();
const { composer, bloom, grade } = buildComposer(renderer, scene, camera);

// The composer renders several passes per frame and three resets its counters on every one of them, so the
// counters are reset once here instead: what `describe` reports is the whole frame, post included.
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
  // The same clamp the frame loop applies after the controls have run. Exposed so a tool that poses the
  // camera directly gets the correction a user's drag would get, instead of a view from inside a wall.
  clampCamera,
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
      post: postState(),
    };
  },
  // True per-frame cost: render the whole chain, then read one pixel so the call blocks until the frame is
  // finished.
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
  // The composer's own target resolution, not the canvas: post.js may render above the drawing buffer, and
  // that is the resolution sub-pixel geometry actually rasterizes at.
  anim.updateScreenScale(composerSize(renderer).y, camera.fov);
  render();
  // Keep watching the post chain rather than approving it once; see src/main.js's own note.
  watchPostChain(renderer, composer, now ?? performance.now());
  frames++;
  if (frames === 2) window.__sceneResolve(api);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
