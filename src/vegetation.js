// Vegetation: the weeping cherry (trunk and limbs as tapered tubes along splines, several hundred hanging
// strands, tens of thousands of instanced blossom cards colored from the photo's canopy field), the
// evergreens as layered needle-cluster cards, and the shrubs, the potted plants, the moss and the weeds
// at the wall bases as leaf, grass and moss cards. Everything is seeded, one InstancedMesh per card
// texture and plant, and every material comes from the factory so phase 4 can light it with a flag.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as L from './layout.js';
import { mulberry32, jitter } from './random.js';
import { instanced, surface } from './instancing.js';
import { foliageMaterial } from './materials.js';
import { cardTexture } from './textures.js';
import { canopyColorAt, canopyMaskAt } from './photofield.js';

const C = L.COLORS;
const S = L.STREET;
const EYE = new THREE.Vector3(L.CAMERA.eye.x, L.CAMERA.eye.y, L.CAMERA.eye.z);
const UP = new THREE.Vector3(0, 1, 0);
const cardGeometry = new THREE.PlaneGeometry(1, 1);
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpE = new THREE.Euler();
const tmpColor = new THREE.Color();
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const v3 = (p) => new THREE.Vector3(p.x, p.y, p.z);

export function buildVegetation(b) {
  cherry(b, mulberry32(3));
  evergreens(b, mulberry32(4));
  groundPlants(b, mulberry32(6));
}

// ---- helpers -------------------------------------------------------------------------------------

// A tube of `radial` sides along `curve`, its radius tapering from r0 to r1, with metric UVs.
function taperedTube(curve, r0, r1, segments = 12, radial = 7) {
  const pts = curve.getSpacedPoints(segments);
  const frames = curve.computeFrenetFrames(segments, false);
  const positions = [];
  const uvs = [];
  const index = [];
  let along = 0;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const r = r0 + (r1 - r0) * t;
    if (i > 0) along += pts[i].distanceTo(pts[i - 1]);
    const N = frames.normals[i];
    const B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      positions.push(pts[i].x + (ca * N.x + sa * B.x) * r, pts[i].y + (ca * N.y + sa * B.y) * r, pts[i].z + (ca * N.z + sa * B.z) * r);
      uvs.push((j / radial) * 2 * Math.PI * r, along);
    }
  }
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const c = a + radial + 1;
      index.push(a, a + 1, c, a + 1, c + 1, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

// A curve cut where its projection leaves the photo's blossom mask (with a margin of cells), less one
// step so the wood ends inside the blossom rather than at its edge; null when too little is inside.
function clipToMask(points, margin) {
  const kept = [];
  for (const p of points) {
    const uv = L.worldToUV(p);
    if (kept.length > 1 && !canopyMaskAt(uv.u, uv.v, margin)) {
      kept.pop();
      break;
    }
    kept.push(p);
  }
  return kept.length >= 3 ? kept : null;
}

// A card instance at `position`: facing `faceTarget` with an angular jitter when given, otherwise an
// upright card at a random heading. `color` is a linear THREE.Color.
function cardItem(rand, position, size, color, faceTarget = null, wobble = 0.45) {
  if (faceTarget) {
    tmpM.lookAt(faceTarget, position, UP);
    tmpQ.setFromRotationMatrix(tmpM);
    tmpQ.multiply(new THREE.Quaternion().setFromEuler(tmpE.set(jitter(rand, wobble), jitter(rand, wobble), rand() * Math.PI * 2)));
  } else {
    tmpQ.setFromEuler(tmpE.set(jitter(rand, 0.6), rand() * Math.PI * 2, jitter(rand, 0.6)));
  }
  return { position: [position.x, position.y, position.z], quaternion: tmpQ.clone(), scale: [size, size, 1], color: color.clone() };
}

// A sampled color as a linear Color, divided by the card's mean brightness so the visible mean lands on
// the sample, with hue, saturation and lightness jitter. With `pinkOnly`, a sample whose hue is outside
// the pink to magenta range (the canopy's top takes the sun glare's warm hue in the photo) is pulled to
// pale pink at the same lightness, so every blossom stays pale pink to light magenta.
function cardColor(rand, hex, cardMean, { hue = 0.01, sat = 0.06, light = 0.05, scale = 1, pinkOnly = false } = {}) {
  tmpColor.set(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  tmpColor.getHSL(hsl);
  if (pinkOnly && hsl.h > 0.03 && hsl.h < 0.83) {
    hsl.h = 0.94;
    hsl.s *= 0.5;
  }
  tmpColor.setHSL(hsl.h + jitter(rand, hue), clamp01(hsl.s + jitter(rand, sat)), clamp01(hsl.l + jitter(rand, light)));
  tmpColor.multiplyScalar(scale / cardMean);
  return tmpColor;
}

// Leaf cards filling an ellipsoid around `centre`, shaded from `hex` at the bottom to `topHex` at the top.
function cluster(rand, items, centre, radii, count, size, hex, cardMean, topHex = hex) {
  for (let i = 0; i < count; i++) {
    let p;
    do {
      p = new THREE.Vector3(jitter(rand, 1), jitter(rand, 1), jitter(rand, 1));
    } while (p.lengthSq() > 1);
    p.multiply(new THREE.Vector3(radii.x, radii.y, radii.z)).add(centre);
    const f = clamp01(((p.y - centre.y) / radii.y) * 0.5 + 0.5);
    tmpColor.set(hex).lerp(new THREE.Color(topHex), f);
    const shade = 0.85 + 0.2 * f;
    items.push(cardItem(rand, p, size * (0.8 + rand() * 0.5), cardColor(rand, tmpColor.getHex(), cardMean, { scale: shade }), rand() < 0.5 ? EYE : null));
  }
}

// ---- the weeping cherry ---------------------------------------------------------------------------

function cherry(b, rand) {
  // The tree stands on the right walkway beyond the fence's far end; its trunk shows above the roofed
  // wall at photo (0.62-0.66, 0.55-0.66), leaning a little toward the street, and the limbs leave the
  // crown just above that. Limb ends are photo positions at chosen depths, so the canopy's shell projects
  // onto the photo's blossom mask: far left, top, over the machiya's far end, in front, behind, and low.
  const baseZ = -16.8;
  const base = new THREE.Vector3(2.6, L.rightTerraceY(baseZ) - 0.3, baseZ);
  const crown = new THREE.Vector3(2.6, -0.3, -16.6);
  const trunk = new THREE.CatmullRomCurve3([base, new THREE.Vector3(2.85, -3.2, -16.8), new THREE.Vector3(2.95, -1.6, -16.7), crown]);
  const wood = [taperedTube(trunk, 0.44, 0.3, 10, 9)];
  // Where the photo shows something in front of the canopy, no blossom nearer than it is kept: the
  // trunk bare between the roofed wall and the crown (u 0.615 to 0.665, v 0.53 to 0.66), and the lamp
  // post standing in front of the lowest strands (u 0.487 to 0.515, v 0.58 to 0.76).
  const lampDepth = L.worldToUV(L.rayHitGround(L.LAMP.u, L.LAMP.v1, L.streetY)).depth;
  const clearBoxes = [
    { u0: 0.615, u1: 0.665, v0: 0.53, v1: 0.66, depth: 18.5 },
    { u0: 0.487, u1: 0.515, v0: 0.58, v1: 0.76, depth: lampDepth + 0.3 },
  ];
  // Solid things the canopy must stay out of, in world space: the right machiya (its wall, the balcony
  // and the top roof), the band of its ground-floor eave, and the fence's roofed wall.
  const M = L.RIGHT_MACHIYA;
  const solid = (p) =>
    (p.x > M.front - 0.4 && p.z > M.z0 - 0.5 && p.z < M.z1 + 0.5 && p.y < M.roofY + 3.5) ||
    (p.x > M.eaveEdge - 0.2 && p.x < M.front && p.y > 3.6 && p.y < 5.2 && p.z > M.eaveZ0 - 0.3 && p.z < M.z1) ||
    (p.x > 1.6 && p.x < 3.7 && p.y > 0.2 && p.y < 2.9 && p.z > -15.2 && p.z < -5.4);
  const branches = [];
  const ends = [
    [0.36, 0.3, 15.0],
    [0.56, 0.21, 16.0],
    [0.78, 0.24, 12.5],
    [0.45, 0.33, 13.0],
    [0.4, 0.27, 18.5],
    [0.66, 0.36, 12.0],
    [0.32, 0.42, 15.5],
  ];
  for (const [u, v, depth] of ends) {
    const end = v3(L.uvToWorld(u, v, depth));
    const dir = end.clone().sub(crown);
    const m1 = crown.clone().addScaledVector(dir, 0.35).add(new THREE.Vector3(jitter(rand, 0.3), 1.0 + rand() * 0.6, jitter(rand, 0.3)));
    const m2 = crown.clone().addScaledVector(dir, 0.72).add(new THREE.Vector3(jitter(rand, 0.3), 0.6 + rand() * 0.5, jitter(rand, 0.3)));
    const full = new THREE.CatmullRomCurve3([crown, m1, m2, end]);
    const limbPts = clipToMask(full.getSpacedPoints(16), 1) ?? full.getSpacedPoints(16).slice(0, 8);
    const limb = new THREE.CatmullRomCurve3(limbPts);
    wood.push(taperedTube(limb, 0.26, 0.07, 14, 7));
    branches.push({ curve: limb, weight: 1.0 });
    // Three sub-branches off each limb's outer half, veering sideways and a little up, each clipped to the
    // mask like the limb.
    for (let k = 0; k < 3; k++) {
      const t = 0.45 + k * 0.2 + rand() * 0.1;
      const p = limb.getPointAt(t);
      const tangent = limb.getTangentAt(t);
      const side = new THREE.Vector3().crossVectors(tangent, UP).normalize();
      const sdir = tangent.clone().addScaledVector(side, jitter(rand, 1.2)).add(new THREE.Vector3(0, 0.15 + rand() * 0.3, 0)).normalize();
      const len = 1.4 + rand() * 1.8;
      const subFull = new THREE.CatmullRomCurve3([p, p.clone().addScaledVector(sdir, len * 0.5).add(new THREE.Vector3(0, 0.2, 0)), p.clone().addScaledVector(sdir, len)]);
      const subPts = clipToMask(subFull.getSpacedPoints(8), 1);
      if (!subPts) continue;
      const sub = new THREE.CatmullRomCurve3(subPts);
      wood.push(taperedTube(sub, 0.08, 0.025, 8, 5));
      branches.push({ curve: sub, weight: 1.4 });
    }
  }
  const bark = surface('bark', C.trunk, { seed: 41 });
  b.add(new THREE.Mesh(mergeGeometries(wood), bark), 'cherry trunk');

  // Blossom cards: colored from the photo's canopy field at their photo position (so the canopy's cell
  // means match the photo's), kept only inside the photo's blossom mask with a soft margin, half of them
  // facing the photo camera and half upright at random headings so the canopy reads from any angle.
  const bloss = cardTexture('blossom', { seed: 42 });
  const cards = [];
  const cleared = (uv) => clearBoxes.some((c) => uv.u > c.u0 && uv.u < c.u1 && uv.v > c.v0 && uv.v < c.v1 && uv.depth < c.depth);
  const pushBlossom = (p, size) => {
    const uv = L.worldToUV(p);
    if (uv.depth < 1 || solid(p)) return false;
    if (!canopyMaskAt(uv.u, uv.v, 0) && !(canopyMaskAt(uv.u, uv.v, 1) && rand() < 0.35)) return false;
    if (cleared(uv)) return false;
    cards.push(cardItem(rand, p, size, cardColor(rand, canopyColorAt(uv.u, uv.v), bloss.mean, { hue: 0.012, sat: 0.08, light: 0.05, scale: 1.05, pinkOnly: true }), rand() < 0.5 ? EYE : null));
    return true;
  };

  // Pendulous strands: hung from the limbs and sub-branches, arcing out then falling, longest at the
  // photo's lower left, each ending where the photo's blossom ends, carrying blossoms every 0.11 m.
  const stems = [];
  for (let i = 0; i < 760; i++) {
    // The last 160 hang from the far-left limbs, the long ones that fall to v 0.66 in the photo.
    const br = i < 600 ? branches[Math.floor(rand() * branches.length)] : branches[[0, 12, 24][Math.floor(rand() * 3)]];
    const p = br.curve.getPointAt(0.2 + rand() * 0.8);
    const pu = L.worldToUV(p);
    const length = 1.0 + 3.4 * clamp01((0.78 - pu.u) / 0.45) + rand() * 1.2 + (i >= 600 ? 1.2 : 0);
    const out = new THREE.Vector3(p.x - crown.x + jitter(rand, 0.4), 0, p.z - crown.z + jitter(rand, 0.4)).normalize();
    const n = Math.max(3, Math.round(length / 0.3));
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const f = k / n;
      const drift = 0.35 * length * f * (1 - 0.45 * f);
      const q = new THREE.Vector3(p.x + out.x * drift, p.y - f * length, p.z + out.z * drift);
      const quv = L.worldToUV(q);
      if (k > 1 && (!canopyMaskAt(quv.u, quv.v, 1) || cleared(quv) || solid(q))) break;
      pts.push(q);
    }
    if (pts.length < 3) continue;
    // Blossoms every 0.10 m along the strand, larger toward its end; the stem then ends at its last one.
    const full = new THREE.CatmullRomCurve3(pts);
    const count = Math.floor(full.getLength() / 0.1);
    let lastKept = 0;
    for (let k = 0; k < count; k++) {
      const f = (k + 0.5) / count;
      const q = full.getPointAt(f).add(new THREE.Vector3(jitter(rand, 0.09), jitter(rand, 0.05), jitter(rand, 0.09)));
      if (pushBlossom(q, 0.17 + rand() * 0.13 + 0.1 * f)) lastKept = f;
    }
    if (lastKept < 0.2) continue;
    const stemPts = [];
    const m = Math.max(3, Math.round((lastKept * full.getLength()) / 0.3));
    for (let k = 0; k <= m; k++) stemPts.push(full.getPointAt((lastKept * k) / m));
    stems.push(taperedTube(new THREE.CatmullRomCurve3(stemPts), 0.016, 0.008, stemPts.length, 3));
  }
  b.add(new THREE.Mesh(mergeGeometries(stems), bark), 'cherry strands');

  // The canopy mass around the limbs and sub-branches, denser toward their ends.
  for (const br of branches) {
    const steps = Math.max(4, Math.round(br.curve.getLength() / 0.2));
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      const p = br.curve.getPointAt(t);
      const radius = 0.45 + 0.95 * t * br.weight;
      const n = 18 + Math.floor(rand() * 12);
      for (let m = 0; m < n; m++) {
        const q = p.clone().add(new THREE.Vector3(jitter(rand, radius), jitter(rand, radius * 0.8), jitter(rand, radius)));
        pushBlossom(q, 0.24 + rand() * 0.2);
      }
    }
  }
  b.add(instanced('cherry blossoms', cardGeometry, foliageMaterial(bloss.texture), cards, { uvOffsets: false }), 'cherry blossoms');
}

// ---- the evergreens --------------------------------------------------------------------------------

// Pines behind and left of the cherry: three whose crowns show between the far roofs and the mountains
// (photo u 0.29 to 0.42, from v 0.26 down; the plan's box starts higher, where the photo's cells are pale
// haze) and one behind the canopy. They stand on the hillside beyond the bend, their trunks hidden by
// the far houses, the bend and the canopy, and their crowns (about 7 m tall at 40 to 50 m) are layered
// whorls of needle cards around a thin trunk, darker toward the bottom.
function evergreens(b, rand) {
  const needle = cardTexture('needles', { seed: 43 });
  const cards = [];
  const trunks = [];
  const trees = [
    [0.31, 0.285, 40, 6.0],
    [0.35, 0.28, 46, 7.2],
    [0.4, 0.29, 50, 6.8],
    [0.47, 0.33, 48, 8.0],
  ];
  for (const [u, v, depth, height] of trees) {
    const top = v3(L.uvToWorld(u, v, depth));
    const ground = L.farGroundY(top.z) - 0.3;
    trunks.push(taperedTube(new THREE.CatmullRomCurve3([new THREE.Vector3(top.x, ground, top.z), new THREE.Vector3(top.x + jitter(rand, 0.3), (ground + top.y) / 2, top.z), top]), 0.3, 0.08, 6, 6));
    const layers = 14;
    for (let l = 0; l < layers; l++) {
      const f = l / (layers - 1);
      const y = top.y - f * (top.y - ground);
      const radius = 0.3 + Math.min(f, 0.55) * height * 0.24;
      const n = 6 + l * 3;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + rand();
        const r = radius * (0.45 + rand() * 0.55);
        const p = new THREE.Vector3(top.x + Math.cos(a) * r, y + jitter(rand, 0.4), top.z + Math.sin(a) * r);
        const size = 0.9 + rand() * 0.8;
        cards.push(cardItem(rand, p, size, cardColor(rand, C.evergreen, needle.mean, { hue: 0.01, sat: 0.05, light: 0.04, scale: 1.05 - f * 0.3 }), rand() < 0.5 ? EYE : null, 0.6));
      }
    }
    cards.push(cardItem(rand, top.clone().add(new THREE.Vector3(0, 0.1, 0)), 0.8, cardColor(rand, C.evergreen, needle.mean, { scale: 1.05 }), EYE, 0.3));
  }
  b.add(new THREE.Mesh(mergeGeometries(trunks), surface('bark', C.trunk, { seed: 46 })), 'evergreen trunks');
  b.add(instanced('evergreen cards', cardGeometry, foliageMaterial(needle.texture), cards, { uvOffsets: false }), 'evergreen cards');
}

// ---- shrubs, potted plants, moss and weeds -------------------------------------------------------

function groundPlants(b, rand) {
  const leaf = cardTexture('leaves', { seed: 44 });
  const grass = cardTexture('grass', { seed: 45 });
  const moss = cardTexture('moss', { seed: 47 });
  const leafMat = foliageMaterial(leaf.texture);

  // The shrub on the planter strip behind the fence (photo: green above the tiles at u 0.72-0.78), a
  // small dark shrub beside the pot, and the potted plant on the left low wall (its pot is built with
  // the walls). Each its own mesh so the placement gate can name it.
  // The planter shrub grows on the walkway behind the fence's jog, where the wall stands furthest from
  // the street, its top rising above the roof's ridge (photo: green above the tiles at u 0.72-0.78).
  const shrub = [];
  const shrubZ = -10.4;
  const shrubBase = L.rightTerraceY(shrubZ);
  cluster(rand, shrub, new THREE.Vector3(3.7, shrubBase + 1.45, shrubZ), { x: 0.6, y: 1.45, z: 0.85 }, 130, 0.28, C.shrub, leaf.mean, C.shrubLit);
  b.add(instanced('shrub leaves', cardGeometry, leafMat, shrub.filter((it) => it.position[1] > shrubBase + 0.1), { uvOffsets: false }), 'shrub leaves');
  // A small potted plant on the walkway beside the big pot, and the potted plant on the left low wall
  // (that pot is built with the walls).
  const potSpot = L.uvToWorld(0.805, 0.83, 8);
  const potBase = L.rightTerraceY(potSpot.z);
  const smallPot = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.14, 0), new THREE.Vector2(0.18, 0.2), new THREE.Vector2(0.2, 0.26), new THREE.Vector2(0.17, 0.26), new THREE.Vector2(0.16, 0.04), new THREE.Vector2(0, 0.04)], 14), surface('glaze', C.pot, { seed: 48 }));
  smallPot.position.set(potSpot.x, potBase, potSpot.z);
  b.add(smallPot, 'small pot');
  const shrub2 = [];
  cluster(rand, shrub2, new THREE.Vector3(potSpot.x, potBase + 0.5, potSpot.z), { x: 0.32, y: 0.3, z: 0.32 }, 36, 0.18, C.shrubDeep, leaf.mean);
  b.add(instanced('shrub 2 leaves', cardGeometry, leafMat, shrub2, { uvOffsets: false }), 'shrub 2 leaves');
  const p = L.leftPotPlacement();
  const plant = [];
  cluster(rand, plant, new THREE.Vector3(p.x, p.potY + 0.5, p.z + 0.2), { x: 0.42, y: 0.4, z: 0.75 }, 70, 0.24, C.plant, leaf.mean);
  b.add(instanced('left plant leaves', cardGeometry, leafMat, plant, { uvOffsets: false }), 'left plant leaves');

  // Weeds: grass tufts standing at the wall bases along the stairs, on the gutter's curb and against the
  // right wall, and along the fence's foot on the planter.
  const tufts = [];
  const tuft = (x, y, z, size, hex) => {
    tmpQ.setFromEuler(tmpE.set(jitter(rand, 0.15), rand() * Math.PI * 2, 0));
    tufts.push({ position: [x, y + size / 2, z], quaternion: tmpQ.clone(), scale: [size, size, 1], color: cardColor(rand, hex, grass.mean, { hue: 0.02, sat: 0.1, light: 0.08 }).clone() });
  };
  for (let z = -0.8; z > -13.6; z -= 0.42) {
    if (rand() < 0.35) continue;
    tuft(S.x0 + 0.06 + jitter(rand, 0.03), L.streetY(z) - 0.03, z + jitter(rand, 0.15), 0.12 + rand() * 0.12, rand() < 0.5 ? C.plant : C.shrubDark);
  }
  for (let z = -0.6; z > -13.6; z -= 0.55) {
    if (rand() < 0.5) continue;
    tuft(S.x1 - 0.06 + jitter(rand, 0.03), L.streetY(z) + 0.02, z + jitter(rand, 0.2), 0.1 + rand() * 0.12, C.shrubDark);
  }
  for (let z = -6.0; z > -14.6; z -= 0.6) {
    if (rand() < 0.4) continue;
    tuft(2.06 + jitter(rand, 0.03), L.rightBedY(z) - 0.05, z, 0.14 + rand() * 0.14, C.plant);
  }
  b.add(instanced('weeds', cardGeometry, foliageMaterial(grass.texture), tufts, { uvOffsets: false }), 'weeds');

  // Moss: dark green patches on the wall faces just above the gutter and the treads, where the walls stay damp.
  const patches = [];
  const patch = (x, y, z, w, h, yaw, hex) => {
    tmpQ.setFromEuler(tmpE.set(0, yaw, jitter(rand, 0.3)));
    patches.push({ position: [x, y, z], quaternion: tmpQ.clone(), scale: [w, h, 1], color: cardColor(rand, hex, moss.mean, { hue: 0.015, sat: 0.08, light: 0.08 }).clone() });
  };
  for (let z = -1.2; z > -13.6; z -= 0.5) {
    if (rand() < 0.3) continue;
    patch(S.x0 + 0.005, L.streetY(z) + 0.04 + rand() * 0.1, z + jitter(rand, 0.15), 0.3 + rand() * 0.3, 0.12 + rand() * 0.1, Math.PI / 2, C.shrubDark);
  }
  for (let z = -0.8; z > -13.6; z -= 0.6) {
    if (rand() < 0.45) continue;
    patch(S.x1 - 0.005, L.streetY(z) + 0.05 + rand() * 0.12, z + jitter(rand, 0.15), 0.25 + rand() * 0.3, 0.1 + rand() * 0.1, -Math.PI / 2, C.shrubDark);
  }
  b.add(instanced('moss', cardGeometry, foliageMaterial(moss.texture, { alphaTest: 0.4 }), patches, { uvOffsets: false }), 'moss');
}
