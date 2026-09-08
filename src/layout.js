// Photo landmarks, the camera model, and the projection math that maps photo positions into the world.
// Pure data and functions with no three.js import, so the Node tools (compare, shot) can use it too.
//
// Photo space: u to the right and v downward, both as fractions of the frame (0..1).
// World space: y up, the photo camera looks along -z from x = 0, +x is the right side of the street.

export const PHOTO = { width: 600, height: 550 };
export const SHOT = { width: 1200, height: 1100 };
export const ASPECT = PHOTO.width / PHOTO.height;

// ---- Camera ------------------------------------------------------------------------------------
// The photo's perspective puts the eye about 4.8 m above the stair line directly below it: with a
// 60 degree vertical FOV, the 13 shallow steps (0.46 m treads at an 18 degree pitch) visible between
// v = 0.85 and the bottom of the frame fit only from that height. The photographer therefore stands
// EYE_HEIGHT above a raised top landing (PLATFORM_Y) at the head of the stairs.
export const CAMERA = {
  eye: { x: 0, y: 4.8, z: 0 },
  pitchDeg: 13, // eye level (the horizon) at v = 0.30 for a 60 degree vertical FOV
  fovDeg: 60,
  targetDepth: 18, // orbit target on the optical axis at the cherry trunk's depth
};
export const EYE_HEIGHT = 1.65;
export const PLATFORM_Y = CAMERA.eye.y - EYE_HEIGHT;

// Photo landmarks from docs/work/0_japan-street-scene/historical/PLAN.md.
export const HORIZON_V = 0.3;
export const SUN = { u: 0.62, v: 0.12 };
export const HILL_RIDGE = [
  [0.36, 0.28],
  [0.6, 0.16],
  [0.72, 0.1],
  [0.82, 0.08],
];
export const MOUNTAINS = { u0: 0.18, u1: 0.42, v0: 0.25, v1: 0.3 };
export const NEAR_RIDGE = { u0: 0.18, u1: 0.42, v0: 0.28, v1: 0.32 };
export const CHERRY = {
  u0: 0.34,
  u1: 0.78,
  v0: 0.17,
  v1: 0.6,
  dense: { u: 0.58, v: 0.35 },
  strands: { u0: 0.4, u1: 0.48, v0: 0.45, v1: 0.62 },
  trunk: { u: 0.61, v: 0.66 },
};
export const EVERGREEN = { u0: 0.29, u1: 0.5, v0: 0.22, v1: 0.47 };
export const RIGHT_HOUSE = {
  u0: 0.68,
  u1: 1.0,
  v0: 0.0,
  v1: 0.55,
  upper: { v0: 0.0, v1: 0.32 },
  eave: { v0: 0.33, v1: 0.4 },
  noren: { u0: 0.86, u1: 1.0, v0: 0.4, v1: 0.55 },
};
export const LOW_ROOF = { u0: 0.6, u1: 0.78, v0: 0.6, v1: 0.7 };
export const POT = { u: 0.85, v: 0.75 };
export const SHRUB = { u: 0.75, v: 0.62 };
export const RIGHT_STEPS = { u0: 0.58, u1: 0.72, v0: 0.72, v1: 0.88 };
export const LEFT_HOUSES = [
  { name: 'left house 1', u0: 0.0, u1: 0.18, v0: 0.0, v1: 0.6, roof: { v0: 0.3, v1: 0.36 } },
  { name: 'left house 2 roof', u0: 0.05, u1: 0.27, v0: 0.36, v1: 0.5 },
  { name: 'left house 3 roof', u0: 0.1, u1: 0.33, v0: 0.5, v1: 0.62 },
];
export const AWNING = { u0: 0.13, u1: 0.2, v0: 0.5, v1: 0.57 };
export const SIGN = { u: 0.33, v: 0.58 };
export const LEFT_WALL = { u0: 0.0, u1: 0.27, v0: 0.68, v1: 1.0 };
export const LEFT_POT = { u: 0.22, v: 0.85 };
export const STEPS = { bottom: { u: 0.22, v: 1.0 }, top: { u: 0.55, v: 0.85 } };
export const FAR_STREET = { u0: 0.35, u1: 0.55, v0: 0.7, v1: 0.78 };
export const PERSON = { u: 0.52, v: 0.76, height: 0.06 };
export const LAMP = { u: 0.5, v0: 0.6, v1: 0.75 };

// Boxes and points drawn on out/overlay.png so each landmark can be checked against its photo position.
export const LANDMARK_MARKS = [
  { name: 'horizon', kind: 'hline', v: HORIZON_V },
  { name: 'sun', kind: 'point', ...SUN },
  { name: 'hill ridge', kind: 'polyline', points: HILL_RIDGE },
  { name: 'mountains', kind: 'box', ...MOUNTAINS },
  { name: 'near ridge', kind: 'box', ...NEAR_RIDGE },
  { name: 'cherry', kind: 'box', u0: CHERRY.u0, u1: CHERRY.u1, v0: CHERRY.v0, v1: CHERRY.v1 },
  { name: 'cherry dense', kind: 'point', ...CHERRY.dense },
  { name: 'strands', kind: 'box', ...CHERRY.strands },
  { name: 'evergreen', kind: 'box', ...EVERGREEN },
  { name: 'right house', kind: 'box', u0: RIGHT_HOUSE.u0, u1: RIGHT_HOUSE.u1, v0: RIGHT_HOUSE.v0, v1: RIGHT_HOUSE.v1 },
  { name: 'right eave', kind: 'box', u0: RIGHT_HOUSE.u0, u1: RIGHT_HOUSE.u1, ...RIGHT_HOUSE.eave },
  { name: 'noren', kind: 'box', ...RIGHT_HOUSE.noren },
  { name: 'low roof', kind: 'box', ...LOW_ROOF },
  { name: 'pot', kind: 'point', ...POT },
  { name: 'shrub', kind: 'point', ...SHRUB },
  { name: 'right steps', kind: 'box', ...RIGHT_STEPS },
  ...LEFT_HOUSES.map((h) => ({ name: h.name, kind: 'box', u0: h.u0, u1: h.u1, v0: h.v0, v1: h.v1 })),
  { name: 'left roof 1 edge', kind: 'box', u0: 0.0, u1: 0.18, ...LEFT_HOUSES[0].roof },
  { name: 'awning', kind: 'box', ...AWNING },
  { name: 'sign', kind: 'point', ...SIGN },
  { name: 'left wall', kind: 'box', ...LEFT_WALL },
  { name: 'left pot', kind: 'point', ...LEFT_POT },
  { name: 'steps top', kind: 'point', ...STEPS.top },
  { name: 'far street', kind: 'box', ...FAR_STREET },
  { name: 'person', kind: 'point', u: PERSON.u, v: PERSON.v },
  { name: 'lamp', kind: 'vline', u: LAMP.u, v0: LAMP.v0, v1: LAMP.v1 },
];

// ---- Projection math ---------------------------------------------------------------------------
const DEG = Math.PI / 180;

export function cameraBasis(cam = CAMERA) {
  const p = cam.pitchDeg * DEG;
  const tanV = Math.tan((cam.fovDeg / 2) * DEG);
  return {
    eye: [cam.eye.x, cam.eye.y, cam.eye.z],
    forward: [0, -Math.sin(p), -Math.cos(p)],
    right: [1, 0, 0],
    up: [0, Math.cos(p), -Math.sin(p)],
    tanV,
    tanH: tanV * ASPECT,
  };
}

// The point that lands on photo position (u, v) at `depth` metres along the optical axis.
export function uvToWorld(u, v, depth, cam = CAMERA) {
  const b = cameraBasis(cam);
  const sx = (u - 0.5) * 2 * b.tanH * depth;
  const sy = (0.5 - v) * 2 * b.tanV * depth;
  return {
    x: b.eye[0] + b.forward[0] * depth + b.right[0] * sx + b.up[0] * sy,
    y: b.eye[1] + b.forward[1] * depth + b.right[1] * sx + b.up[1] * sy,
    z: b.eye[2] + b.forward[2] * depth + b.right[2] * sx + b.up[2] * sy,
  };
}

// Where a world point lands in the photo, plus its depth along the optical axis.
export function worldToUV(p, cam = CAMERA) {
  const b = cameraBasis(cam);
  const d = [p.x - b.eye[0], p.y - b.eye[1], p.z - b.eye[2]];
  const dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
  const depth = dot(d, b.forward);
  return {
    u: 0.5 + dot(d, b.right) / (2 * b.tanH * depth),
    v: 0.5 - dot(d, b.up) / (2 * b.tanV * depth),
    depth,
  };
}

// Depth at which a point with world x = xWorld lands on photo column u.
export function depthForU(u, xWorld, cam = CAMERA) {
  const b = cameraBasis(cam);
  return (xWorld - b.eye[0]) / ((u - 0.5) * 2 * b.tanH);
}

// Width and height of the frame, in metres, at a given depth.
export function frameSizeAtDepth(depth, cam = CAMERA) {
  const b = cameraBasis(cam);
  return { width: 2 * b.tanH * depth, height: 2 * b.tanV * depth };
}

// Where the ray through (u, v) meets a height field y = yOfZ(z, x), by bisection on depth.
export function rayHitGround(u, v, yOfZ, cam = CAMERA, { minDepth = 0.5, maxDepth = 400 } = {}) {
  const above = (depth) => {
    const p = uvToWorld(u, v, depth, cam);
    return p.y - yOfZ(p.z, p.x);
  };
  let lo = minDepth;
  let hi = maxDepth;
  if (above(lo) < 0) return uvToWorld(u, v, lo, cam);
  if (above(hi) > 0) return uvToWorld(u, v, hi, cam);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (above(mid) > 0) lo = mid;
    else hi = mid;
  }
  return uvToWorld(u, v, (lo + hi) / 2, cam);
}

// Linear interpolation along a polyline of [z, y] pairs ordered from high z to low z.
export function interpolateZ(line, z) {
  if (z >= line[0][0]) return line[0][1];
  for (let i = 1; i < line.length; i++) {
    const [z0, y0] = line[i - 1];
    const [z1, y1] = line[i];
    if (z >= z1) return y0 + ((y1 - y0) * (z - z0)) / (z1 - z0);
  }
  return line[line.length - 1][1];
}

// ---- World layout ------------------------------------------------------------------------------
// Street: the main stairs run along -z from the head of the stairs (z = 0, y = 0) at an 18 degree
// pitch, then a paved ramp continues at the same pitch and bends left beyond bendStartZ.
export const STREET = {
  slope: Math.tan(18 * DEG), // metres of drop per metre along -z
  x0: -2.8, // left edge of the stairs (the left retaining wall's face)
  x1: 1.3, // right edge of the stairs (the right retaining wall's face)
  stepRise: 0.15,
  stairsEndZ: -13.85, // foot of the stairs, where the flat landing begins (photo v = 0.85)
  landingLength: 1.5, // flat landing before the paved street continues downhill
  lowerSlope: Math.tan(21.7 * DEG), // the street beyond the landing is a little steeper, so it rejoins the same line by z = -22
  bendStartZ: -20,
  bendRate: 0.22, // metres of leftward shift per metre beyond bendStartZ (photo: the far street is centred near u 0.45)
};
export const STEP_TREAD = STREET.stepRise / STREET.slope;

export function streetY(z) {
  if (z >= 0) return PLATFORM_Y;
  const landingY = STREET.slope * STREET.stairsEndZ;
  if (z >= STREET.stairsEndZ) return -STREET.slope * -z;
  const landingEnd = STREET.stairsEndZ - STREET.landingLength;
  if (z >= landingEnd) return landingY;
  return landingY - STREET.lowerSlope * (landingEnd - z);
}

// Ground beside and beyond the far street: the plots on both sides sit a kerb above the street, and past
// the paving's end (z = -42) the hillside rises toward the forested hill at 19 degrees.
export function farGroundY(z) {
  if (z >= -42) return streetY(z) + 0.4;
  return streetY(-42) + 0.4 + Math.min(16, -42 - z) * 0.35;
}

export function streetCenterX(z) {
  const center = (STREET.x0 + STREET.x1) / 2;
  if (z >= STREET.bendStartZ) return center;
  return center - STREET.bendRate * (STREET.bendStartZ - z);
}

// Left plots: terraces stepping down with the houses; the retaining wall's plaster cap runs above.
export const LEFT_TERRACES = [
  { z0: -1.0, z1: -8.0, y: 1.6 },
  { z0: -8.0, z1: -11.5, y: -0.6 },
  { z0: -11.5, z1: -15.5, y: -3.5 },
];
// Nearest thing on the left: a tall wall of light stone blocks (photo u 0 to 0.12, v 0.55 to 1.0).
export const LEFT_STONE_WALL = { x0: -3.6, x1: -2.8, z0: -4.8, z1: 3.0, top: 3.7 }; // its far end at photo u 0.09, where the annex's red door begins
// Top of the low plaster wall that runs downhill in front of the house fronts, as [z, y] pairs
// (photo: from about (0.10, 0.84) to (0.28, 0.88), then fading out at the landing).
export const LEFT_CAP_LINE = [
  [-4.8, 1.56],
  [-5.54, 1.0],
  [-7.87, -0.78],
  [-9.97, -2.63],
  [-13.85, -4.3],
];
export const LEFT_LOW_WALL_HEIGHT = 0.6;
export const LEFT_LOW_WALL_THICKNESS = 0.4; // the photo's cap is a narrow band (u 0.10-0.27 at v 0.84-0.88)
export function leftCapY(z) {
  return interpolateZ(LEFT_CAP_LINE, z);
}
// The potted plant on the low wall: on the ray through its photo position, on top of the cap.
export function leftPotPlacement() {
  const x = STREET.x0 + 0.05 - LEFT_LOW_WALL_THICKNESS / 2; // the wall's centre line
  const u = LEFT_POT.u - 0.025;
  const p = uvToWorld(u, LEFT_POT.v, depthForU(u, x));
  return { x, z: p.z, potY: leftCapY(p.z) + 0.12 };
}

// Right side: a paved walkway in front of the right machiya sloping with the street, with a raised
// planter bed along its street edge (shrubs behind the wooden fence) and the pot on the walkway.
// Beyond the planter the walkway drops to the street level, where the landing widens to the right.
export const RIGHT_TERRACE = { xInner: 2.1, xBed: 2.4, xOuter: 9.0, line: [[0, 0.45], [-5.6, 0.45], [-14.8, -2.7], [-15.3, -5.0], [-40, -13.0]] };
export const RIGHT_BED = { z0: -14.8, z1: -5.6, raise: 1.5, fenceHeight: 0.6 };
// The wooden fence with its small tiled roof stands on the planter strip's street edge and jogs back
// around the head of the side steps (photo: the low roof's ridge kinks near u 0.68). `path` is the
// fence's centre line as [x, z] points; the roof overhangs the fence by roofHalfWidth on each side.
export const RIGHT_FENCE = { thickness: 0.3, roofHalfWidth: 0.4, roofRise: 0.18, path: [[2.25, -5.6], [2.25, -8.85], [3.0, -8.85], [3.0, -12.15], [2.25, -12.15], [2.25, -14.8]] };
// The side steps cut through the retaining wall; the wall is low over a slightly wider span so the
// steps stay visible from the photo view.
export const RIGHT_STEPS_Z = { z0: -12.0, z1: -9.0 };
export const RIGHT_WALL_NOTCH = { z0: -12.5, z1: -8.0 };
export function rightTerraceY(z) {
  return interpolateZ(RIGHT_TERRACE.line, z);
}
export function rightBedY(z) {
  return rightTerraceY(z) + RIGHT_BED.raise;
}
// Right machiya footprint: the front wall, the ground-floor eave edge, and the extents along z.
export const RIGHT_MACHIYA = {
  front: 5.0,
  back: 13.0,
  eaveEdge: 3.6,
  topEaveEdge: 3.9,
  z0: -21.0, // the dark ground floor runs on past the eave's far end (photo u 0.68 at v 0.40 to 0.55)
  eaveZ0: -16.9,
  z1: -2.0,
  upperZ0: -13.5,
  roofZ0: -12.2,
  norenZ0: -11.8,
  norenTop: 3.8,
  norenHemNear: 3.2, // at z1; the hem slopes to photo v 0.55 at u 1.0 and v 0.50 at u 0.86
  norenHemFar: 2.03,
  baseTop: 2.3,
  baseTopFar: 1.5,
  baseSplitZ: -10.0,
  plinthTop: 0.3,
  eaveTop: 4.5,
  eaveDrop: 0.5, // the ground-floor eave steps down along the street (photo: its edge stays at v 0.40 from u 1.0 to 0.75)
  roofY: 6.95,
  roofThickness: 0.65,
  fasciaZ0: -11.0, // only the near part of the top eave's tile ends catches the light (photo u > 0.80)
};
// Left house 1 is a low-mezzanine machiya: its top roof sits at about 6.4 m with sky above it.
// The eave roof runs to photo u 0.18, the top roof overhangs the far end of the shorter mezzanine wall.
export const LEFT_HOUSE_1 = { front: -3.4, back: -10, groundZ0: -6.0, upperZ0: -7.5, roofZ0: -12.0, eaveZ0: -9.6, z1: 3.0, eaveY: 4.2, eaveTop: 4.9, upperTop: 6.25, roofUnder: 6.25, roofEave: 6.6 };
// Roofs along the left house fronts step down with the terraces. Each is a slab given by its outer
// edge (near and far ends along z) and the rise of its inner edge, sloping up away from the street.
export const LEFT_ANNEX_ROOF = { xOuter: -4.0, xInner: -7.5, zNear: -6.0, yNear: 3.4, zFar: -13.4, yFar: 1.7, rise: 2.2 };
export const LEFT_CANOPY = { xOuter: -2.9, xInner: -6.5, zNear: -5.5, yNear: 3.3, zFar: -13.7, yFar: -0.6, rise: 2.2 };
// Height of the canopy's outer edge at z, its line continued past both ends.
export function canopyOuterY(z) {
  const K = LEFT_CANOPY;
  return K.yNear + ((K.yFar - K.yNear) * (z - K.zNear)) / (K.zFar - K.zNear);
}
// The small white awning is a light sheet laid over the canopy's lower rows near the door (photo
// u 0.13-0.20, v 0.50-0.57): its extent along the street and how far up the slope it reaches.
export const LEFT_AWNING = { zNear: -6.0, zFar: -7.5, depth: 0.7, lift: 0.1 };

// Depths (metres along the optical axis) chosen for frontal elements.
export const DEPTHS = {
  cherry: 18,
  evergreen: 28,
  farHouses: 32,
  hill: 500,
  nearRidge: 900,
  mountains: [1500, 2000],
  sky: 2800,
};

// Flat colors sampled from the photo (sRGB hex); the sampling boxes are listed in the devlog. A few
// small things have no clean region in the photo and are set by eye: skin, sign, lamp, lantern,
// paperLantern, awning, evergreen (only a sliver shows), platform, groundBase, fog.
export const COLORS = {
  skyTopWhite: 0xe8e9ea,
  skyTopBlue: 0x9bc4e4, // the photo's own top row (cells 0.06-0.30 at v 0.02); the paler sample it replaced left the sky washed
  skyTopGrey: 0x7d8c98,
  skyWarmNear: 0xf8dbaf,
  skyWarmFar: 0xecd3bc,
  skyHorizon: 0xeed5b4,
  skySun: 0xfdf7e1,
  skyHalo: 0xf6e4cf,
  cirrus: 0xd8cfd2, // the cirrus at the top left, cells (0.10, 0.05) and (0.15, 0.09)
  cirrusLit: 0xe8b98e, // their orange undersides, cell (0.19, 0.07)
  cloudPuff: 0xf3cfc4, // the pink puffs near the sun, cells (0.45, 0.10) and (0.52, 0.07)
  hillRidge: 0xdda586,
  hillHaze: 0x928171,
  hillMid: 0x615d52,
  hill: 0x4a4139,
  nearRidge: 0x6b7a5f,
  mountainFar: 0xb9c0c8,
  mountainMid: 0xacb5bf,
  mountainFarthest: 0xcdc8cc,
  mountainBlue: 0x6ca8c4,
  cherryDense: 0xbca2ae,
  cherryEdge: 0xd8c4c5,
  cherryShadow: 0xc5a7bd,
  cherryStrand: 0xcfafc4,
  cherryLeft: 0xd2b1cc,
  cherryFarLeft: 0xc4b0bf,
  cherryLow: 0xa58a9a,
  cherryShade: 0xa68b9f,
  roofUnderDark: 0x151515,
  roofUnderMid: 0x3a2f28,
  roofUnderFar: 0x8b7568,
  trunk: 0x4e4546,
  eaveDark: 0x3a3330,
  evergreen: 0x3d4b3e,
  woodDark: 0x352d24,
  woodBase: 0x1c1814,
  woodMid: 0x706763,
  woodUpperRight: 0x5c5046,
  rightGround: 0x5a5250,
  topRoofRight: 0xb9b6b3,
  topEaveUnder: 0x161616,
  tileLeftLight: 0x8f9093,
  stoneBlocks: 0x8a7b6f,
  stoneBlocksTop: 0xb19d8b,
  lowWall: 0x8f8c84,
  gutter: 0x7d7772,
  woodWarm: 0x7b6b5c,
  woodLight: 0x9a7a5c,
  sudare: 0xb09070,
  tileLeft: 0x7a8088,
  tileRight: 0x7e97ba,
  eaveUnder: 0x71747b,
  noren: 0xbfc3ca,
  balcony: 0x6b5a52,
  house1Upper: 0x393737,
  house1Hip: 0x5b4e45,
  eaveEdge: 0x6e5f52,
  leftRoofEdge: 0x8b6c54,
  house3Lower: 0x6f5a49,
  rightGroundFar: 0x63605f,
  shrubDeep: 0x1e2416,
  shrubLit: 0x7c958b, // the planter shrub's lit top, cell (0.771, 0.659)
  doorRed: 0x6f3219, // the annex's near door, cells (0.104, 0.75) and (0.104, 0.795)
  house1Wall: 0x39241c,
  house3Wall: 0xbcae9c,
  plant: 0x4a5230,
  shrubDark: 0x2a3320,
  plaster: 0xcfc6b8,
  stoneWallLeft: 0x857c72,
  stoneWallRight: 0x4d5559,
  sideStepTop: 0x76818e,
  annex: 0x7a6650,
  annexLower: 0x55483f,
  annexFarLower: 0x3a2f28,
  annexFarUpper: 0xa08b72,
  canopy: 0x979899,
  steps: 0x96959a,
  landing: 0x76818d,
  farStreet: 0x4a4950,
  sideSteps: 0x4a4e4f,
  terrace: 0x3e4448,
  fence: 0x64605a,
  plinth: 0x57595b,
  fenceTiles: 0x6c7a7c,
  pot: 0x36302e,
  shrub: 0x465746,
  person: 0x4b687a,
  skin: 0xd9b9a0,
  lamp: 0x2e2c30,
  lantern: 0x4a4a58,
  paperLantern: 0xe8dcc0,
  awning: 0xcfc8bd,
  sign: 0x3f6fb0,
  platform: 0x8a8d92,
  farRoof: 0x87887b,
  farWall: 0xacafac,
  farWallLow: 0x4e4a3f, // below the far roofs the photo is dark, cells (0.354, 0.659) and (0.313, 0.682)
  groundBase: 0x3a3a36,
  fog: 0xdccfc4,
};

// ---- Placement gate ----------------------------------------------------------------------------
// tools/placement.js (run by npm test) casts the photo camera's ray through each position and requires
// the first mesh hit to start with `mesh`. It catches what the compare scores cannot see: a door built
// inside its wall, a canopy hiding a missing trunk. Positions are on the object's photo body, not its edge.
export const PLACEMENT_CHECKS = [
  { name: 'cherry trunk', u: 0.635, v: 0.585, mesh: 'cherry trunk' },
  { name: 'cherry blossoms', u: 0.58, v: 0.35, mesh: 'cherry blossoms' },
  { name: 'cherry lower canopy', u: 0.44, v: 0.6, mesh: 'cherry blossoms' },
  { name: 'far street', u: 0.47, v: 0.72, mesh: 'far street' },
  { name: 'evergreen', u: 0.3, v: 0.29, mesh: 'evergreen' },
  { name: 'far roof', u: 0.2, v: 0.33, mesh: 'far roof' },
  { name: 'hill', u: 0.72, v: 0.13, mesh: 'hill' },
  { name: 'mountains', u: 0.25, v: 0.27, mesh: 'mountains' },
  { name: 'person', u: 0.52, v: 0.76, mesh: 'person' },
  { name: 'lamp post', u: 0.5, v: 0.7, mesh: 'lamp post' },
  { name: 'pot', u: 0.85, v: 0.75, mesh: 'pot' },
  { name: 'shrub', u: 0.755, v: 0.575, mesh: 'shrub' },
  { name: 'left plant', u: 0.21, v: 0.84, mesh: 'left plant' },
  { name: 'sign', u: 0.33, v: 0.58, mesh: 'sign' },
  { name: 'noren', u: 0.93, v: 0.5, mesh: 'noren' },
  { name: 'right eave', u: 0.85, v: 0.365, mesh: 'right eave tiles' },
  { name: 'awning', u: 0.14, v: 0.545, mesh: 'awning' },
  { name: 'annex door 1', u: 0.11, v: 0.77, mesh: 'annex door 1' },
  { name: 'stairs', u: 0.4, v: 0.93, mesh: 'stair treads' },
];

// ---- Grounding gate ----------------------------------------------------------------------------
// The placement gate checks what is in front; this checks what is underneath. Phase 3 shipped far houses
// floating 20 m over nothing, pines with their feet in mid-air and a shrub buried in a roof, and every
// gate stayed green, because a thing that stands on nothing looks exactly like a thing that stands on
// something from the photo camera. Each entry names an object and the mesh it must be standing on.
// tools/placement.js finds the object, takes the bottom of its own bounding box, drops a ray from there,
// and fails when that ground mesh is more than `tolerance` below it (floating) or more than `sink` above
// it (buried). The two are separate because a wall or a trunk is meant to run into the ground, while
// nothing is meant to hang over it. The base is measured from the object every run, so an object that
// drifts away from its ground is caught even though the ground itself never moved.
export const GROUNDING_CHECKS = [
  { name: 'cherry trunk', mesh: 'right walkway', tolerance: 0.6, sink: 1.6, x: 2.6, z: -16.8 },
  { name: 'lamp post', mesh: 'landing slabs', tolerance: 0.5, sink: 0.4 },
  { name: 'person leg left', mesh: 'landing slabs', tolerance: 0.4 },
  { name: 'pot', mesh: 'right walkway', tolerance: 0.7 },
  { name: 'small pot', mesh: 'right walkway', tolerance: 0.6 },
  { name: 'left pot', mesh: 'left low wall', tolerance: 0.4 },
  { name: 'far roof c house lower', mesh: 'far plots left', tolerance: 0.8, sink: 3.5 },
  { name: 'evergreen trunks', mesh: 'hillside', tolerance: 0.8, sink: 2.5 },
];
