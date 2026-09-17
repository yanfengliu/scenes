// This scene's own light rig and its own shadow-flag pass.
//
// WHY NOT src/lighting.js. That module is mechanically reusable -- it takes a scene and a renderer -- but
// every number in it is the Japan street's: its sun direction comes from L.SUN in src/layout.js (a sunset
// behind a ridge), its four colours from that scene's sky, its shadow camera is +-26 m by +-22 m around a
// point 18 m down a 30 m street, and its applyShadowFlags' CAST_BOX is the street corridor from z = +6 to
// z = -34 with a 1.6 m median-size test. A 51 m building at 61 m from the camera sits outside all of them:
// its shadows would be clipped and most of it would not cast at all. src/lighting.js's own header says so.
//
// WHAT IS REUSED: RIG's idea of shares (they are the shape of the rig, not the street), the radiance()
// helper, the four light types, and MATERIALS.irradiance as the constant the shares are normalised against.
//
// THE LIGHT THIS SCENE NEEDS, and it is unusual: the reference is a NORTH facade at midday, so there is NO
// direct sun on the face the camera sees. Every sampled wall colour is a sky-lit value. The rig is therefore
// dominated by ambient and hemisphere light and the sun exists mainly to cast the building's shadow away
// from the camera and to light the roofs. That is not a shortcoming of the rig; it is the photograph.
import * as THREE from 'three';
import { COLORS, DIMS } from './layout.js';
import { sceneRadiance } from '../tonemap.js';
import { MATERIALS, BACKLIGHT } from '../materials.js';
import { skyMaterial, SKY } from './sky.js';

// The shares are set so that the NORTH FACADE CARRIES THE PHOTOGRAPH'S OWN LUMINANCE RAMP, which is the
// thing the previous pass could not produce. Measured off whitehouse.webp at the east end of the wall
// (u 0.860-0.868, sixteen 13-px rows from v 0.382 to v 0.604) the wall climbs from #515d6f -- luma 94 --
// immediately under the cornice to #a5b4c6 -- luma 178 -- at its base. That is 0.116 to 0.428 in linear
// radiance, a factor of 3.7, and it is the largest single feature of the facade.
//
// WHAT MAKES IT, and what could not: `hemi` is the only light whose contribution depends on a surface's own
// orientation, and its two colours are a sky above and a lawn below. A wall point low down looks out over
// more lawn, a point under the cornice over more sky, so the same light produces the whole ramp through
// `ground` and `sky` alone. The rig has to keep every OTHER share small enough that the ramp survives:
// `ambient`, the environment map and the `fill` from the camera all light every surface the same whatever
// way it faces, and they flatten the wall. In the previous pass those three carried 2.2 of the wall's 2.4
// irradiance and the ramp came out inside 3% -- a flat plate, which is what the render showed.
//
// THE SHARES ARE MEASURED, NOT DERIVED. Three's own shader sums the lights in a way that is easy to get
// wrong on paper, and the first three attempts at this rig all did: the analytic model said one thing and
// the frame showed another. So out/wh/scratch/card.mjs hangs three cards of THIS SCENE'S OWN wall albedo in
// front of the camera -- one facing the camera, one up, one down -- toggles one light at a time, and reads
// the median of each card off the drawing buffer. The response of an albedo to a light is then measured
// directly, and the intensities below are the solve of
//
//   scale(sun) * sun + scale(sky) * sky + scale(up) * up   ==   the photograph's own wall and lawn tones
//
// at three orientations. Its own numbers, with the old rig, in linear luminance of the card:
//
//                 front(+z)   up(+y)   down(-y)        the frame, for one light alone
//   sun             0.0076     0.0063   0.0089
//   sky light       0.0154     0.0125   0.0235
//   up light        0.0185     0.0154   0.0089
//   fill            0.0108     0.0089   0.0089
//
// and the targets those had to reach were 0.389 at the wall's base, 0.192 under its cornice and 0.148 on
// the lawn. Solving that system gives the scales this pass applied: sun x2.06, sky light x9.6, up x3.2.
export const RIG = {
  ambient: 0.0, // nothing: it is the one term with no orientation at all, and the ramp is the point
  sun: 1.80, // the raking north-east light: the porch's shadow, the columns' relief
  fill: 0.03, // a weak light from the camera's side, for the faces the sky cannot reach
  skyLight: 2.22, // the hemisphere that carries the sky and the ground's bounce
  skyToGround: 0.547, // its sky half against its ground half
  upLight: 0.36, // the hemisphere that biases upward: what makes the lawn as bright as the photograph
  upToGround: 0.075, // its sky half against its near-black ground half
  shadowRadius: 2.2,
  shadowBias: -0.0007,
  shadowNormalBias: 0.6,
  shadowMapSize: 2048,
  // THE ENVIRONMENT WAS NOT CARRYING THE FRAME, AND SAYING SO IS PART OF THE FINDING.
  // out/wh/scratch/card.mjs hangs a card of the scene's own wall albedo in front of this camera and reads
  // the drawing buffer with one light hidden at a time. Shipped, it reported: all lights #9198a8 (152),
  // without the sky light #27346a (53), without the sun #90969f (149), with EVERY light hidden but the
  // environment left in #00134e (19). A card carrying the ENVIRONMENT ALONE displays at luma 19 where its
  // own albedo would display at 143, so the PMREM is about 13% of the frame and the SKY HEMISPHERE is 76%
  // -- out/wh/scratch/probe.mjs confirms it on the real frame: removing scene.environment entirely moves
  // the wall's upper band by 1 luma level. So the flat term here is the hemisphere, not the environment,
  // and a first attempt at this pass that cut the hemisphere to 1.00 and left the environment at 0.06 put
  // the wall 35 levels UNDER the photograph (out/wh/scratch/probe.mjs, wall mid 95.9 against 129). The
  // hemisphere's own level was right; what was wrong is that every surface was lit as if it were open to
  // the whole sky, including the ones that are roofed, revealed or planted. That is the occlusion term in
  // materials.js and the numbers in building.js's OCCLUSION, and it is where this pass's contrast comes
  // from. The environment stays low because it is measured low, not because it was the suspect.
  envIntensity: 0.06,
  // The shadow camera's own box. The building is 51.2 m along x and reaches z = +13 (the terrace), so the
  // ortho box is sized for the whole composition plus the near lawn, and `far` has to reach the sun's own
  // position 200 m out.
  shadowBox: { left: -95, right: 95, top: 55, bottom: -70, near: 1, far: 460 },
  shadowCentre: { x: 0, y: 4, z: 6 },
};

// A tint as a THREE.Color in the working (linear-sRGB) space, normalised to a unit maximum so that ALL of a
// light's level lives in its intensity. That separation is not cosmetic: three computes a hemisphere light's
// irradiance as intensity * sqrt(ground^2 + (sky^2 - ground^2) * n.y), which is not linear in the colour, so
// folding a level into the colours would change the SHAPE of the wall's ramp as well as its brightness. The
// unit-maximum colour is the hue and the intensity is the level, so the two can be read separately.
const tintOf = (hex) => {
  const [r, g, b] = sceneRadiance(hex, { exposure: MATERIALS.exposure });
  const max = Math.max(r, g, b, 1e-6);
  return new THREE.Color().setRGB(r / max, g / max, b / max, THREE.LinearSRGBColorSpace);
};
// The same tint's own level, which is what an intensity has to be multiplied by to reproduce the sampled
// colour's absolute radiance.
const levelOf = (hex) => {
  const [r, g, b] = sceneRadiance(hex, { exposure: MATERIALS.exposure });
  return Math.max(r, g, b, 1e-6);
};

export function buildLighting(scene, renderer) {
  const dir = new THREE.Vector3(SKY.sunDirection.x, SKY.sunDirection.y, SKY.sunDirection.z).normalize();

  // The sun: a raking light from the north-east, so the facade is lit at a glancing angle, the porch
  // casts the shadow the photograph shows under it, and the wall's own relief reads. See sky.js's
  // SKY.sunDirection for why it is not the photograph's own midday sun.
  const sun = new THREE.DirectionalLight(0xffffff, RIG.sun * levelOf(COLORS.skyTop));
  sun.color.copy(tintOf(COLORS.skyTop));
  sun.position.copy(dir).multiplyScalar(220).add(new THREE.Vector3(RIG.shadowCentre.x, RIG.shadowCentre.y, RIG.shadowCentre.z));
  sun.target.position.set(RIG.shadowCentre.x, RIG.shadowCentre.y, RIG.shadowCentre.z);
  scene.add(sun.target);
  sun.castShadow = true;
  const cam = sun.shadow.camera;
  cam.left = RIG.shadowBox.left;
  cam.right = RIG.shadowBox.right;
  cam.top = RIG.shadowBox.top;
  cam.bottom = RIG.shadowBox.bottom;
  cam.near = RIG.shadowBox.near;
  cam.far = RIG.shadowBox.far;
  cam.updateProjectionMatrix();
  sun.shadow.mapSize.set(RIG.shadowMapSize, RIG.shadowMapSize);
  sun.shadow.radius = RIG.shadowRadius;
  sun.shadow.bias = RIG.shadowBias;
  sun.shadow.normalBias = RIG.shadowNormalBias;
  sun.name = 'sun';
  scene.add(sun);
  // Foliage translucency, if a later wave uses foliageMaterial({ backlit }).
  BACKLIGHT.direction.copy(dir);
  BACKLIGHT.color.copy(sun.color).multiplyScalar(RIG.sun);

  // The scene's own smallest light, and there is no ambient at all: the one term with no orientation
  // dependence whatsoever is the one term the ramp cannot survive, and out/wh/scratch/solve.mjs puts it at
  // zero. What the porch's ceiling and the wall's shaded reveals do get is the fill below.
  const ambient = null;
  void ambient;

  // The bulk of the light, and the only share that produces the facade's own ramp: its two colours are a
  // sky above and a lawn below, so the same light makes the wall climb from the cornice to its base.
  const skyTint = tintOf(COLORS.skyLight);
  const groundTint = tintOf(COLORS.groundLight);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
  hemi.color.copy(skyTint).multiplyScalar(RIG.skyLight * RIG.skyToGround * levelOf(COLORS.skyLight));
  hemi.groundColor.copy(groundTint).multiplyScalar(RIG.skyLight * levelOf(COLORS.groundLight));
  hemi.name = 'sky light';
  scene.add(hemi);

  // The upward bias. Its ground half is a sixth of its sky half, so an upright face -- which sees only the
  // ground colour -- gets almost nothing from it while the lawn gets all of it. That is what lifts the lawn
  // to the photograph's own luma without lifting the wall off its ramp.
  const upTint = tintOf(COLORS.upLight);
  const upGround = tintOf(COLORS.upGround);
  const up = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
  up.color.copy(upTint).multiplyScalar(RIG.upLight * levelOf(COLORS.upLight));
  up.groundColor.copy(upGround).multiplyScalar(RIG.upLight * RIG.upToGround * levelOf(COLORS.upGround));
  up.name = 'up light';
  scene.add(up);

  // A weak fill from the camera's side, so the faces turned away from the sky keep the photo's open shadow
  // instead of going flat. It is the one light that lights the wall and the lawn alike, so it is small.
  const fill = new THREE.DirectionalLight(0xffffff, RIG.fill * levelOf(COLORS.fillLight));
  fill.color.copy(tintOf(COLORS.fillLight));
  fill.position.set(0, 26, 140);
  fill.target.position.set(0, 6, 0);
  scene.add(fill.target);
  fill.name = 'fill';
  scene.add(fill);

  scene.environment = skyEnvironment(renderer);
  scene.environmentIntensity = RIG.envIntensity;
  return { sun, ambient, hemi, up, fill };
}

// The environment map, from this scene's own sky dome, so reflections and the sheen on the water carry the
// same sky the background shows.
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

// Which meshes are not allowed to cast, by name. This is this scene's own list and has nothing in common
// with scene 1's: a name here is an interface, and a later wave that renames a mesh moves it in or out.
// The reasons, in the order the pattern lists them:
//   sky            the dome, obviously
//   far tree       the two ranks beyond the fence: they are haze layers whose own colour already contains
//                  the light, and casting from them costs a second pass over 48 crowns for nothing
//   lawn / ground  the ground planes
//   fence pickets  240 instances of a 6 cm bar: they cannot put a visible shadow anywhere the photo looks
//   window         the glass, which is recessed and whose shadow would be a line on its own reveal
const NO_CAST = /^(sky|far tree|far tree line|north lawn|south lawn|far ground|fence pickets|bay \d+ (first|second) floor (glass|reveal)|south bay \d+ (ground|first|second) floor glass)/;
// A caster must be at least this across in its median dimension. 1.2 m: the balusters (0.24 m) and the
// window trims are excluded by it, the walls, the cornices, the columns and the trees are not.
const CAST_SIZE = 1.2;
// And it must stand inside this box, which is the whole built scene: x +-90 (the block and its terrace),
// y -4 to 24 (the south lawn to the flag), z -60 (past the south portico) to +60 (the drive and the lawn
// the building's shadow falls on).
const CAST_BOX = { x0: -90, x1: 90, y0: -4, y1: 24, z0: 60, z1: -60 };

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

// The scene's fog: distance haze towards the pale blue the frame's far trees fade into. Near and far are
// this scene's own scale -- the building is 61 m away, so the fog cannot start at scene 1's 38 m.
export function fogFor(scene) {
  const [r, g, b] = sceneRadiance(COLORS.fog, { exposure: MATERIALS.exposure });
  scene.fog = new THREE.Fog(
    new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace),
    140,
    900,
  );
  return scene.fog;
}

// The extent the rig's numbers above were chosen for, exported so a check can assert the scene still fits.
export const EXTENT = {
  x: DIMS.blockLength + 24,
  z: DIMS.blockDepthWithPorticoes + 60,
  top: 22,
};
