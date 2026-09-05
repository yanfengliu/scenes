// Entry point: renderer, the photo camera, orbit controls with reset, the block-out, and the hooks the
// test tools use (window.__scene, window.__sceneResolve from index.html).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERA, COLORS, uvToWorld } from './layout.js';
import { buildScene } from './scene.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(COLORS.fog, 40, 220);

const camera = new THREE.PerspectiveCamera(CAMERA.fovDeg, window.innerWidth / window.innerHeight, 0.2, 6000);
scene.add(camera);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1;
controls.maxDistance = 120;
controls.maxPolarAngle = Math.PI * 0.55;

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

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

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
  resetView,
  describe() {
    return {
      renderer: rendererName(),
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      width: renderer.domElement.width,
      height: renderer.domElement.height,
    };
  },
  // True per-frame cost: render, then read one pixel so the call blocks until the frame is finished.
  async benchmark(seconds = 5) {
    const gl = renderer.getContext();
    const pixel = new Uint8Array(4);
    const times = [];
    const end = performance.now() + seconds * 1000;
    while (performance.now() < end) {
      const t0 = performance.now();
      renderer.render(scene, camera);
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
function frame() {
  controls.update();
  renderer.render(scene, camera);
  frames++;
  if (frames === 2) window.__sceneResolve(api);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
