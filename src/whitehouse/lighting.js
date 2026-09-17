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

// The shares are set so that the NORTH FACADE CARRIES A LUMINANCE RAMP, which is what the reference
// photograph shows and what a flat ambient light cannot produce. The photo's own wall at column u = 0.25
// climbs from about luma 90 just under the cornice to about 180 at its base -- the lower courses see more of
// the bright lawn, the upper ones see more sky and are shaded by their own cornice. `hemi` is what does that
// work: it is the only light here whose contribution depends on a surface's own orientation, and its ground
// colour is the LAWN, so a wall point low down (which sees more ground) is lifted. `ambient` is therefore
// SMALL -- it was 0.72 in the first pass, which flattened the wall to a single value.
export const RIG = {
  ambient: 0.34,
  sun: 0.72,
  sky: 0.26,
  ground: 0.26,
  fill: 0.20,
  shadowRadius: 2.2,
  shadowBias: -0.0007,
  shadowNormalBias: 0.6,
  shadowMapSize: 2048,
  envIntensity: 0.55,
  // The shadow camera's own box. The building is 51.2 m along x and reaches z = +13 (the terrace), so the
  // ortho box is sized for the whole composition plus the near lawn, and `far` has to reach the sun's own
  // position 200 m out.
  shadowBox: { left: -95, right: 95, top: 55, bottom: -70, near: 1, far: 460 },
  shadowCentre: { x: 0, y: 4, z: 6 },
};

const radiance = (hex, scale = 1) => {
  const [r, g, b] = sceneRadiance(hex, { exposure: MATERIALS.exposure });
  const max = Math.max(r, g, b, 1e-6);
  return { color: new THREE.Color().setRGB(r / max, g / max, b / max, THREE.LinearSRGBColorSpace), intensity: max * scale };
};

export function buildLighting(scene, renderer) {
  const dir = new THREE.Vector3(SKY.sunDirection.x, SKY.sunDirection.y, SKY.sunDirection.z).normalize();

  // The sun: high, to the south, behind the building, so it never touches the wall the camera reads.
  const sun = new THREE.DirectionalLight(0xffffff, Math.PI * RIG.sun);
  const sunTint = radiance(COLORS.skyHorizon);
  sun.color.copy(sunTint.color);
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

  // The bulk of the light. Every sampled colour in this scene is a SKY-LIT value, so the rig has to leave a
  // surface facing open sky at about MATERIALS.irradiance or those colours display wrong.
  const ambient = new THREE.AmbientLight(0xffffff, Math.PI * RIG.ambient);
  ambient.name = 'ambient';
  scene.add(ambient);

  // The sky's own tint from above and the lawn's bounce from below. This is what gives the north wall its
  // cool cast and the wall's lower courses their greenish lift, both of which the photo shows.
  const skyTint = radiance(COLORS.skyZenith);
  const groundTint = radiance(COLORS.lawnMid);
  const hemi = new THREE.HemisphereLight(skyTint.color, groundTint.color, Math.PI * RIG.sky);
  hemi.groundColor.copy(groundTint.color).multiplyScalar(RIG.ground / RIG.sky);
  hemi.name = 'sky light';
  scene.add(hemi);

  // A weak fill from the camera's side, so the faces turned away from the sky keep the photo's open shadow
  // instead of going flat.
  const fill = new THREE.DirectionalLight(0xffffff, Math.PI * RIG.fill);
  fill.color.copy(radiance(COLORS.skyHorizon).color);
  fill.position.set(0, 26, 140);
  fill.target.position.set(0, 6, 0);
  scene.add(fill.target);
  fill.name = 'fill';
  scene.add(fill);

  scene.environment = skyEnvironment(renderer);
  scene.environmentIntensity = RIG.envIntensity;
  return { sun, ambient, hemi, fill };
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
