// Every scene's camera controls, in one place: the OrbitControls each entry module used to configure for
// itself, with the owner's mouse mapping, and WASD movement on the ground plane.
//
// WHY THIS IS A MODULE AND NOT TWO COPIES OF THE SAME EIGHT LINES. Both entry modules already wrote the
// same enableDamping / touches / enablePan block out separately, and the owner asked for the same three
// mouse controls in every scene: left orbits, the MIDDLE BUTTON ZOOMS on a press-and-drag, right pans. A
// mapping written twice is a mapping that drifts the first time one scene is tuned, and a third scene then
// has to guess which copy is current. The construction lives here; a scene passes only what is genuinely
// its own -- the distances and the polar limit its own geometry needs -- and gets back the controls plus
// the one function its frame loop calls.
//
// NO TOP-LEVEL SIDE EFFECTS. Importing this module constructs nothing and attaches no listener: the
// factory does that when a scene calls it, and what it attaches is the WASD keyboard, not a global on the
// module. That is what keeps a scene module importable by a tool that only wants to read its data.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// WASD SPEED, as a fraction of the camera-to-target distance per second, so it needs no per-scene number.
// That distance is the one length that means the same thing in a 30 m street and a 200 m lawn: the frame's
// own height at the target is 1.15 x the distance in scene 1 and 1.08 x it in the White House, so 0.5 is
// about half a screen-height a second in both. Held as metres per second instead, one number would either
// crawl when the camera is zoomed out or cross the whole scene in three frames when it is zoomed in.
export const MOVE_PER_SECOND = 0.5;
// Shift is the faster step: one key for a long traverse without changing what an unmodified W does.
export const FAST_MULTIPLIER = 3;
// No single step may be longer than this, so a frame the browser held back -- a backgrounded tab, or a long
// first frame after a resize -- moves the camera by one step instead of by everything that was missed.
const MAX_STEP_SECONDS = 0.1;

// The movement keys, by PHYSICAL position (event.code) rather than by event.key. With Shift down -- the
// faster step below -- event.key for the same key is 'W' and not 'w', so a handler keyed on event.key
// would quietly stop walking the moment the user ran.
const MOVE_CODES = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
const SHIFT_CODES = ['ShiftLeft', 'ShiftRight'];
const TRACKED_CODES = new Set([...MOVE_CODES, ...SHIFT_CODES]);

// The camera controls for one scene. `camera` and `domElement` are what `new OrbitControls` takes; the
// options are the per-scene numbers, each left at three's own default when a scene does not name one.
//
// `clampCamera` is the scene's own per-frame clamp -- the one its frame loop applies after the controls
// have had their say. It is passed in, not changed: the step applies it as well, so that it knows where
// the camera really ended up. See the note in the step for why that is the difference between a camera
// that slides along a wall and one whose view levers slowly round against it.
export function createCameraControls(camera, domElement, {
  minDistance,
  maxDistance,
  maxPolarAngle,
  movePerSecond = MOVE_PER_SECOND,
  clampCamera,
} = {}) {
  const controls = new OrbitControls(camera, domElement);
  // Both scenes have always run damped, at this factor; keeping it here is what stops one scene damping
  // and the other snapping when someone tunes one of them.
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  // THE OWNER'S MOUSE MAP: left orbits, the MIDDLE BUTTON zooms in and out on a press-and-drag, right
  // pans. three 0.185 happens to default to exactly this, and it is written out anyway because a default
  // is not a promise -- the mapping is the thing that was asked for, so it is stated here and nowhere
  // else, and a scene cannot drift from it by editing its own entry module.
  controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  // Touch is unchanged from what both scenes had: one finger orbits, two pinch (dolly) and pan.
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.enablePan = true;
  // ARROW-KEY PAN IS OFF, AND BOTH WAYS IT CAN BE REACHED ARE CLOSED.
  // three's OrbitControls pans on the ARROW KEYS (its own `keys` map), which is not what the owner asked
  // for and would move the camera a second way at once. That pan is unreachable today because neither
  // entry module calls listenToKeyEvents(), the call that attaches the handler at all -- but "unreachable
  // because nobody calls it" is one copied three.js example away from being back, so:
  //   - `keys` is UNBOUND, not deleted: three's key handler switches on event.code against these four
  //     strings, so '' can never match and the pan is dead without patching the update loop or the switch.
  //   - listenToKeyEvents is replaced with a no-op, so nothing can attach that handler in the first place.
  // The alternative on older three was `enableKeys`, which was removed in r150: setting it on 0.185 adds a
  // property nothing reads and reads exactly like a fix. `keyPanSpeed` (12 in scene 1, 24 in the White
  // House) went dead with the pan and is deliberately not set here or in either scene.
  controls.keys = { LEFT: '', UP: '', RIGHT: '', BOTTOM: '' };
  controls.listenToKeyEvents = () => {};
  // Per scene, because the geometry is per scene: scene 1's street is 30 m end to end and the White
  // House's grounds are 200 m across, so one shared distance would either put a camera inside a wall or
  // stop it a third of the way back.
  if (minDistance !== undefined) controls.minDistance = minDistance;
  if (maxDistance !== undefined) controls.maxDistance = maxDistance;
  if (maxPolarAngle !== undefined) controls.maxPolarAngle = maxPolarAngle;

  // ---- WASD ----------------------------------------------------------------------------------------
  // Keys are HELD, not repeated. The browser's key auto-repeat is ignored entirely: the camera moves once
  // per frame by however long that frame took, so the speed is a property of the scene and not of the
  // user's keyboard repeat delay.
  const pressed = new Set();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const step = new THREE.Vector3();
  // The camera-to-target offset a walk holds fixed, captured on the frame the walk starts; see the note
  // where it is used. `placed` is where the step last put the camera, which is how the next step knows
  // whether something else -- a drag, a wheel, their damping tails -- moved it in between.
  const offset = new THREE.Vector3();
  const placed = new THREE.Vector3();
  let walking = false;
  let lastTime = null;

  // The keyboard belongs to a form control while one has it: R in the scene picker means "jump to the
  // scene starting with R", and W in it is type-ahead for the scene list. Same guard the reset key uses in
  // both entry modules.
  const typing = (event) => event.target instanceof Element && event.target.closest('select, input, textarea') !== null;

  function onKeyDown(event) {
    if (!TRACKED_CODES.has(event.code)) return;
    // A key that is already down is still FORGOTTEN here rather than ignored, so holding W and then
    // clicking into the picker stops the camera instead of leaving it walking into the distance.
    if (typing(event)) { pressed.delete(event.code); return; }
    // Ctrl/Cmd/Alt combinations belong to the browser: Ctrl+W closes the tab, Cmd+W the window.
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    pressed.add(event.code);
  }
  const onKeyUp = (event) => { pressed.delete(event.code); };
  // A window that loses focus never delivers the keyup of a key that was down when it did.
  const onBlur = () => { pressed.clear(); };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  // The per-frame step, called by the scene's own frame loop AFTER controls.update() and BEFORE its
  // clampCamera(), so the clamp keeps the last word over a walk exactly as it does over a drag. `now` is
  // the frame's own timestamp (the rAF callback's argument) so this shares the loop's clock rather than
  // reading a second one.
  function moveCamera(now) {
    const time = typeof now === 'number' ? now : performance.now();
    const seconds = lastTime === null ? 0 : Math.min((time - lastTime) / 1000, MAX_STEP_SECONDS);
    lastTime = time;
    let along = 0;
    let across = 0;
    if (pressed.has('KeyW')) along += 1;
    if (pressed.has('KeyS')) along -= 1;
    if (pressed.has('KeyD')) across += 1;
    if (pressed.has('KeyA')) across -= 1;
    // NOTHING MOVES UNTIL A MOVEMENT KEY GOES DOWN. With none held this returns before it reads the
    // camera, so a page that is only loaded and shot is untouched -- not by a no-op write, not by a
    // lookAt, not by anything. Every screenshot gate in this repo rests on that.
    if (along === 0 && across === 0) { walking = false; return; }
    if (seconds <= 0) return;

    // The offset the camera keeps to the target, taken from the pose the walk starts in and held for as
    // long as the walk lasts -- except on a frame where something else moved the camera, when it is
    // re-read so that a drag or a zoom with a key held behaves exactly as it does without one. THE CLAMP
    // IS NOT "SOMETHING ELSE" HERE, because this function applies it itself, below: between two steps
    // the only thing that touches the camera is the controls' own update().
    //
    // WHY IT IS HELD AT ALL. A step the clamp refuses is applied to the camera and would otherwise be
    // applied to the target in full: scene 1's corridor pins the camera's x to the street's own walls,
    // and a target that keeps taking the step anyway walks away from a camera that cannot follow it. The
    // camera looks at its target, so the view levers round for as long as the key is held. Measured with
    // the step as it was first written: one second of strafing into the left wall left the target 1.35 m
    // past the camera and turned the next step 4.4 degrees off the heading, and it grows from there.
    if (!walking || camera.position.distanceToSquared(placed) > 1e-18) {
      offset.copy(camera.position).sub(controls.target);
      walking = true;
    }

    // The camera's own heading, flattened onto the ground plane. A user who has orbited 90 degrees
    // expects W to go the way they are looking, so this is the camera's forward and not the world's -Z.
    camera.getWorldDirection(forward);
    forward.y = 0;
    // Looking straight up or straight down: there is no heading on the ground plane to walk along, so the
    // key does nothing rather than moving the camera along a zero vector. Neither scene can reach this
    // (both cap the polar angle well short of the poles) and it costs nothing to be sure.
    if (forward.lengthSq() === 0) return;
    forward.normalize();
    // right = forward x up: with the camera facing -z that is +x, the same `right` the photo basis in
    // src/layout.js uses.
    right.crossVectors(forward, up);
    step.set(0, 0, 0).addScaledVector(forward, along).addScaledVector(right, across);
    // Normalised, so W+D is the same speed as W instead of 1.41x it.
    step.normalize();
    const fast = pressed.has('ShiftLeft') || pressed.has('ShiftRight');
    // Scaled by the DISTANCE TO THE ORBIT TARGET; see MOVE_PER_SECOND above for why that length.
    const speed = camera.position.distanceTo(controls.target) * movePerSecond * (fast ? FAST_MULTIPLIER : 1);
    step.multiplyScalar(speed * seconds);

    // BOTH the camera AND the orbit target move. OrbitControls' update() rebuilds camera.position from
    // the target plus a spherical offset it re-reads from the camera every frame, so a step that moved
    // only the camera is a step the next update() reverses; carrying the target with it leaves the
    // heading, the pitch and the distance exactly as they were, which is what makes this a walk rather
    // than a nudge that springs back.
    camera.position.add(step);
    // The scene's clamp, applied here as well as after this call in the frame loop. It keeps the last
    // word in both places -- it is a floor and a box, both projections onto a fixed region, so applying
    // it twice changes nothing (the probe measures that on every scene). What applying it HERE buys is
    // the truth about where the camera actually ended up, one frame earlier than the frame loop would
    // tell anyone: the clamp can refuse part of a step for the camera alone, and this is the line that
    // lets the target follow the camera to the wall instead of through it.
    if (clampCamera) clampCamera();
    controls.target.copy(camera.position).sub(offset);
    placed.copy(camera.position);
  }

  // `controls` is the OrbitControls itself, unchanged in shape, because the scenes expose it as
  // window.__scene.controls and the tools read its target; `moveCamera` is the frame loop's WASD step.
  return { controls, moveCamera };
}
