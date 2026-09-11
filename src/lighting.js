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

  scene.environment = skyEnvironment(renderer);
  scene.environmentIntensity = RIG.envIntensity;
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
const NO_CAST = /^(far row|sky|hill|mountains|near ridge|ground base|far plots|hillside|cherry blossoms|cherry strands|petals|evergreen|shrub|left plant|weeds|moss|sun|fill|far roof|corner house|bend|noren)/;
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
