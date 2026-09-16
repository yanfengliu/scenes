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
// The lamp post, re-read off the photo in iteration 2: its black shaft runs from the top of the lantern
// head at v 0.695 down to its plinth at v 0.83, at u 0.498 (crop u 0.44-0.60, v 0.60-0.92 at 9x). The
// plan's v 0.60-0.75 put its base 0.1 of the frame too high, which drops it onto the street at z = -20
// instead of z = -14: 6 m too far away, and 2 m inside the machiya row the photo shows there.
// Two other things read LAMP and both move with it: `LANDMARK_MARKS` below draws its line on the
// overlay, and `src/vegetation.js` clears blossom in front of the lamp, which takes that box's own
// extent and its clip depth from here (22.1 m before, 15.6 m now).
export const LAMP = { u: 0.498, v0: 0.695, v1: 0.83 };

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
// `wallSkirt` is how far the fence's boarded wall runs BELOW the planter bed's top, over the stone core.
// The photo's garden wall is a dark earth-plastered panel with timber posts standing on a light stone
// plinth, and the render had the stone running all the way up to a 0.6 m board.
//
// The ladder that shows it, each cell's ray met at the wall plane x = 2.10, **as metres below the SHIPPED
// bed top** (the first version of this comment quoted the same ladder against the bed as it was before
// `raise` moved 1.5 to 1.05 in the same edit, so its depths were 0.45 m out and a critic caught it):
// -0.52 and -0.36 #515d68 (above the bed: the tiled cap), -0.19 #33231b, -0.14 #494445, 0.04 #523b34,
// 0.13 #554d3b, 0.35 #6a534e, 0.43 #756563, 0.44 #697062, 0.76 #798288, 0.83 #7a7d7e, 0.84 #768186. So
// the dark panel runs from about 0.2 m ABOVE the bed top to 0.43 below it and the light stone starts
// between 0.44 and 0.76, where one colour, `stoneWallRight`, used to cover the lot.
//
// 0.38 is swept and not read off that ladder, because the panel's lower edge also decides how much stone
// shows and the two do not have the same boundary. On the shipped tree, everything else held: 0.20 gives
// 0.05993 / 0.57065, 0.30 gives 0.05969 / 0.57093, **0.38 gives 0.05958 / 0.57134**, 0.45 gives 0.05961 /
// 0.57110. (An earlier sweep on an earlier arm agreed: 0.60 was 0.0599 / 0.5678 and 0.34 was 0.05960 /
// 0.57081.)
export const RIGHT_BED = { z0: -14.8, z1: -5.6, raise: 1.05, fenceHeight: 0.6, wallSkirt: 0.38 };
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
// The step across the near end of the right terrace, and the stone coping along the retaining wall's top.
//
// The step is what the photo's bottom-right corner is, and it is geometry rather than a colour. Read the
// photo across the two bottom cell rows: on the terrace the ray at v = 0.932 lands at z = -5.27 and the
// ray at v = 0.977 at z = -4.86, and every cell on that terrace flips from lit stone to near black
// between them — the walkway at x 2.41 (#5a6570 to #14191d) and x 2.73 (#56616a to #181e22), and the
// wall-top strip at x 2.09 (#6d7986 to #272d31). One boundary at one z, right across the terrace's width,
// which is a step and not a shadow: the surface in front of it is a riser turned back at the camera and
// away from a sun that is behind the scene. A horizontal line at z = -5.05 projects to v = 0.955 at EVERY
// x, which is exactly the cell boundary the photo flips on, and a 0.40 m drop puts the riser's foot at
// v = 1.005, just past the frame's bottom edge, so the whole bottom cell row is the riser's own face and
// nothing has to be painted on a horizontal surface. Iteration 3 proved no colour on the slab row can do
// it (the same row fills (0.813, 0.932), which the render already matches to 0.018) and removed a painted
// corner term; this is the geometry that term was standing in for.
//
// Measured depth, and why the rig cannot supply it. The photo's riser is #14191d against #5a6570 on the
// slab above it: a linear ratio of 0.068, 0.075, 0.076 per channel — about 93% of the light gone. What
// this rig can do, evaluated from `RIG` and `sunDirection()` in src/lighting.js rather than by eye (the
// sun's own L is (0.136, 0.216, -0.967) and the fill's (0.159, 0.398, 0.903), and three's hemisphere
// weight is 0.5 * dot(n, up) + 0.5): an UP-facing surface receives 0.780 ambient + 0.039 sun + 0.140
// hemisphere + 0.024 fill = 0.983, and a +z-facing one 0.780 + 0.000 + 0.120 + 0.054 = 0.954. Turning a
// surface back at the camera and away from this sun therefore removes **2.9%**, a -x-facing wall 8.4%,
// and iteration 3's critic measured the deepest CAST shadow at 14%. (The environment map at
// `envIntensity` 0.12 is not in that sum and varies with the normal too, so these are the analytic lights
// only.) The riser is therefore a SURFACE carrying its own sampled colour, the way `stair risers` and
// `sideStepFoot` do, and not a shadow painted on the walkway — the rig is three decimal places short of
// being able to paint it.
//
// The step jogs 0.27 m nearer past x = 2.95, which is the photo again and not a flourish. Across the
// bottom cell row the photo reads #272d31, #14191d, #181e22 at u 0.771 to 0.854 and then #35424d, #343d48,
// #394146 at u 0.896 to 0.979 — near black over the inner half and a mid slate over the outer half. One
// step line at z = -5.05 across the whole terrace puts the riser's face over the whole row and renders the
// outer three at #18191e, #141519 and #15161a, which is 0.157, 0.157 and 0.163 against the photo where
// leaving them alone cost 0.096, 0.095 and 0.085 (measured, both ways). At z = -4.78 the riser's top edge
// projects to v = 0.986 instead of 0.955, so those cells are about a third riser and two thirds lit deck,
// which is what the photo has. `zOuter` is that line and `xSplit` is where the step turns. 2.78 is where
// the cell boundary at u 0.875 lands on the INNER step line, at z = -5.05; it projects to u 0.892 at the
// outer line, so the return face between the two runs covers u 0.875 to 0.892 and a critic measured that
// as 41% of cell (0.896, 0.977)'s width. That cell is the one the jog leaves worst of the four, and 2.95
// (the first value) put the whole deep riser in it instead, at 0.132.
export const RIGHT_STEP = { z: -5.05, zOuter: -4.78, xSplit: 2.78, drop: 0.4 };
// The z of the step at a given x across the terrace.
export function rightStepZ(x) {
  return x < RIGHT_STEP.xSplit ? RIGHT_STEP.z : RIGHT_STEP.zOuter;
}
// The walking surface of the right terrace: the terrace line, dropped by the step in front of it. `x`
// picks which of the step's two lines applies and is REQUIRED — an earlier version defaulted it to 0 and
// nothing ever called it that way, which is a branch that cannot be red-proved.
export function rightWalkY(z, x) {
  return rightTerraceY(z) - (z > rightStepZ(x) ? RIGHT_STEP.drop : 0);
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
  // The photo's noren is hitched up over its LAST panel and the render's hung straight on: box
  // (0.835,0.505)-(0.875,0.545) reads #423930, the shopfront's timber, against a rendered cell of #767274
  // at (0.854, 0.523), which is white cloth over dark wood. Two whole-cloth fixes were measured and both
  // cost more than they paid, because the hem is linear in z and every change to one end moves the other:
  // raising `norenHemFar` 2.03 to 2.35 took that cell 0.187 to 0.040 and pushed (0.938, 0.523) 0.030 to
  // 0.206 and (0.979, 0.523) 0.011 to 0.092, and ending the cloth at z = -10.9 scored 0.0613 / 0.5630
  // against 0.0604 / 0.5672. `NOREN_HITCH` in src/facades.js lifts only the far panel.
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
  // 0.27, not 0.65. The top eave's edge is the line between the photo's sky and its dark eave, and the
  // render's ran 0.033 of frame too high along it. Read off `npm run inspect -- pair 0.78 0.0 1.0 0.14`,
  // the photo's line passes (0.804, 0.091), (0.851, 0.060), (0.899, 0.031) and (0.947, 0.005); projecting
  // the edge at x = 3.92 gives (0.841, 0.027) at y = 7.60 and (0.836, 0.089) at 7.00, so the photo's line
  // is between them and 7.60 is where it was. 7.30 was the first value here and a critic measured it as
  // still uniformly high, by 0.010, 0.013, 0.018 and 0.027 of frame across those four points and growing
  // toward u 1.0; 7.00 overshoots the other way by 0.018, 0.020, 0.018 and 0.014. 7.22 (this thickness)
  // is between them, and over the eight cells the eave's edge is in -- (0.854, 0.023) through (0.813,
  // 0.114) -- it sums 0.700 against 0.722 at 7.30 and 0.781 at 7.60. The whole-frame scores cannot see
  // the difference (0.05958 / 0.57134 against 0.05960 / 0.57145), so this one is decided by the eave's
  // own region and by the photo's line, not by the total.
  //
  // Dropping the whole roof instead (roofY 6.95 to 6.55) was measured and is much worse, 0.0643 against
  // 0.0605: the tiles below the edge fill v 0.07 to 0.30 correctly already, so only the EDGE moves. And
  // this constant is read by THREE things, not one: the fascia and the eave block in architecture.js, the
  // tile plane in roofs.js, and `topRoofY` in vegetation.js, which is the surface the canopy is held out
  // of -- it drops with the plane, so blossom cards now survive 0.26 m lower at x = 4.6 than they did.
  roofThickness: 0.27,
  // The top roof's ridge, held where it was while the eave dropped: the plane is steeper (30.6 degrees
  // rather than 28) rather than lower. src/roofs.js and src/vegetation.js both read these.
  topRidgeX: 9.0,
  // 7.62 + (9.0 - 3.9) * tan(28 degrees), which is where the ridge stood when the eave was at 7.62 and the
  // pitch was written as a constant: held to the millimetre so "steeper, not lower" is exactly true.
  topRidgeY: 10.3317,
  fasciaZ0: -11.0, // only the near part of the top eave's tile ends catches the light (photo u > 0.80)
};
// Left house 1 is a low-mezzanine machiya: its top roof sits at about 6.4 m with sky above it.
// The eave roof runs to photo u 0.18, the top roof overhangs the far end of the shorter mezzanine wall.
// The top roof's eave line was 17 cm high: its trace crossed (u 0.144, v 0.114) where the photo has cloud
// (#cfbfb5) and (u 0.057, v 0.071) where the photo has sky (#949ca3). At 6.43 the same line passes through
// (u 0.103, v 0.114), which is where the photo's roof edge is. upperTop and roofUnder drop with it so the
// slab keeps its thickness and the mezzanine wall stays under it.
export const LEFT_HOUSE_1 = { front: -3.4, back: -10, groundZ0: -6.0, upperZ0: -7.5, roofZ0: -12.0, eaveZ0: -9.6, eaveSplitZ: -7.6, z1: 3.0, eaveY: 4.2, eaveTop: 4.9, upperTop: 6.08, roofUnder: 6.08, roofEave: 6.43 };
// Roofs along the left house fronts step down with the terraces. Each is a slab given by its outer
// edge (near and far ends along z) and the rise of its inner edge, sloping up away from the street.
// Where the annex wall's light stretch starts. The near stretch of the same wall is the dark one: the rays
// through (0.104, 0.705) and (0.104, 0.659) meet the wall plane at z = -6.28 and -6.36, where the photo is
// the near door's rust red (#773019, #884a2e), while the rays that wanted the light colour meet it at
// z = -8.07 and -9.41. Lighting the whole stretch cost 0.087 of cell distance at (0.104, 0.705) alone.
export const LEFT_ANNEX_LIT_Z = -7.3;
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

// The machiya row that lines the right side of the far street, from the foot of the stairs into the
// bend. `frontLine` is the row's street-facing base as [z, x] pairs: the boundary between the photo's
// paving and the row's dark base, found by sampling across it at six rows with
// `npm run inspect -- sample` and dropping each crossing onto the street's height field with
// `rayHitGround` (the boxes are in the 2026-09-10 iteration 2 devlog). The landing's slabs run about
// 4.5 m past this line at z = -21 and the row stands on them.
// Everything behind the front line is a block-out estimate. The photo sees the row nearly end-on, so it
// pins the front line, the eave line and the colours, and nothing else.
// The far end of `frontLine` is the photo's measurement and the render's street disagreeing, and it is
// `farRowFrontX` below, not this table, that resolves them: the table stays the photo's reading and the
// function floors it, so the row cannot walk into the road. Read that comment before changing either.
export const FAR_ROW = {
  frontLine: [
    [-15.0, -1.26],
    [-16.83, -1.6],
    [-20.11, -2.09],
    [-23.15, -3.19],
    [-27.24, -4.68],
    [-30.84, -5.83],
    [-34.0, -6.9],
  ],
  // The near end stops 1.4 m short of the person on the landing (whose feet are at z = -15.17), so the row
  // stands behind both the person and the lamp post that the photo shows in front of it. Its half-hip
  // reaches 1.1 m further forward still, to z = -15.5.
  zNear: -16.6,
  zFar: -30.5,
  hipRun: 1.1, // the near end is half-hipped, not a flat gable
  hipDrop: 1.0,
  hipStart: 1.5, // only the roof behind this drops: in front of it the photo has dark shopfront, not tile
  // One bay's frontage. The eave is level along a bay and steps down at its far end, so the row's eave
  // line follows the street in steps rather than one ramp. Short bays on purpose: the street drops 0.35 m
  // for every metre along it, so a 3 m bay leaves its far end 1 m higher over the street than its near
  // end, which lifted the row into the photo's canopy cells at v 0.59.
  unit: 1.6,
  litEnd: -21.0, // beyond this the tiles take the shaded colour, as the photo's own band does
  base: 0.55, // the darker band where the fronts meet the paving (photo v 0.775-0.80 at u 0.43-0.505)
  eave: 2.5, // the eave line above the street at the bay's near end; its outer lip hangs 0.1 m under it
  eaveOut: 0.4, // how far that lip oversails the wall line, out over the street
  // The row is modelled as the single street-facing slope the photo shows, not as a whole machiya with a
  // ridge: the photo's canopy hangs in front of everything above v 0.63 here, and a first pass with a
  // ridge 3.4 m over the eave put dark roof into cells (0.604, 0.523) and (0.604, 0.568) where the photo
  // has blossom, costing 0.26 and 0.23 of cell distance in those two alone.
  roofRise: 0.75, // how much the slope rises from the lip to the back of the row
  depth: 2.6, // how far the row reaches back from the street
  litRun: 1.5, // the slope's lit band, from the lip back; beyond it the tiles take the shaded colour
  sink: 0.5, // how far its base runs below the street, so no gap opens on the slope
  // How near the street's own centre line the row's front may come. See `farRowFrontX` below.
  keepOff: 1.5,
};
// The row's street-facing base at depth z: the photo's measured boundary, with a floor under it.
// The floor is there because `frontLine` is the PHOTO's street edge dropped onto the RENDER's street and
// the two bend at different rates -- at z = -27 the photo's far street is off at about x = -5.0 while
// `streetCenterX` is at -2.29 -- so the measured line walks off the left side of the render's paving.
// Measured against the paved band's left edge (paving.js lays 7.0 m of it down to z = -22 and 5.2 m past
// that), the strip of street left visible beside the row ran 2.69 m at z = -16.6, 2.02 at -21.2, 0.91 at
// -22.8, 0.25 at -27.4 and -0.06 at -30.5: the eave lip hung past the paving from z = -26 and the base
// itself from z = -29.9. From the photo view the row occludes itself there and none of it costs a point;
// from an orbit it is a building standing in the road, which is what `npm run views` exists to catch.
// The floor is written against `streetCenterX` and NOT against the paving's own edge, because the centre
// line is continuous while the paved band steps 0.9 m at z = -22, and a step there would put a kink in
// the row's front. It starts biting at z = -21.409.
// It is NOT invisible to the photo view, and the measured cost is small rather than zero. Projected
// through `worldToUV`, the eave lip moves right by 0.005 of frame at z = -22.5, 0.011 at -24, 0.019 at
// -26 and 0.028 at -30.5 -- 34 px of a 1200 px frame, all at v about 0.65. It also bites inside the
// landing's own z range, and `landingColor` in paving.js reads this function, so one row of scored slabs
// changes colour with it. On its own the floor scores 0.0748 / 0.4746 against the base's 0.0748 / 0.4753
// and moves 12 of 528 cells, worst -0.0170 at (0.396, 0.705).
// Bound, and read this one before quoting the fix. What the floor removes is the row CROSSING the paving:
// before it, the eave lip hung past the band's left edge from z = -26 and the base itself from -29.9, so
// there was no road left on the photo's side at all. It does NOT make the row front onto the street. The
// paved band is 5.2 m wide and the row is 2.6 m deep, so the row stands as an island with paving on both
// sides, and it did before too. Like for like at z = -25.9, wall line first and clear of the eave in
// brackets: before, 0.46 m (0.06) of paving in front of it and 2.14 m behind; now 1.10 m (0.70) in front
// and 1.50 m behind. The island is there because the render's band is wider than the photo's street and
// the row was put on it to hide the excess. Only re-cutting STREET.bendRate to the photo's fixes that,
// and when it is re-cut this floor stops biting on its own and the measurement takes over again.
export function farRowFrontX(z) {
  return Math.max(interpolateZ(FAR_ROW.frontLine, z), streetCenterX(z) - FAR_ROW.keepOff);
}

// Where the far street's paving stops, which is the corner house's own front face at the bend. It ran to
// z = -42 until iteration 4, 7.5 m THROUGH the corner house and the bend's block-out; `npm run clearance`
// reports that region every run as the scene's open defect. src/background.js widens the corner house to
// cover the paved band's whole width here, so the street ends at a building rather than under one.
export const FAR_STREET_END = -34.4;

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
// paperLantern, awning, evergreen (only a sliver shows), platform, valleyWood, valleyField, fog.
export const COLORS = {
  skyTopWhite: 0xe8e9ea,
  skyTopBlue: 0x9bc4e4, // the photo's own top row (cells 0.06-0.30 at v 0.02); the paler sample it replaced left the sky washed
  // The sky at the far end of the azimuth ramp, away from the sun. It was a desaturated slate, 0x7d8c98,
  // and the photo has no slate in it: its top row is blue all the way to the frame's left edge (cells
  // (0.063, 0.023) #99bedc and (0.104, 0.023) #9bc4e4, which is skyTopBlue itself). The ramp reaches
  // about a third of the way in at the frame's edge and runs on past it, so most of what this colour
  // paints is the orbit sky; it is a deeper blue than skyTopBlue rather than a grey. Set by eye as
  // skyTopBlue darkened toward the photo's own darkest top-row cell, (0.188, 0.023) #8faecf: no box in
  // the photo holds this part of the sky, because it is not in the frame.
  skyTopGrey: 0x8fb6da,
  skyWarmNear: 0xf8dbaf,
  // The warm band away from the sun. NOT its box: the box is (0.20,0.13)-(0.45,0.19) #e7bfa2 and this is
  // set by eye between that and the old 0xecd3bc, because the band's own rows disagree — at v 0.159 the
  // photo wants the box (cells (0.271, 0.159) #e1b498 and (0.313, 0.159) #ecc09d, against a render of
  // #e9d1ca and #ebd3ca) and at v 0.205 it wants lighter than the box ((0.229, 0.205) #f3d9ba). The old
  // value was 26 levels light on blue and made the whole band read pale pink beside the photo's orange.
  skyWarmFar: 0xe9c5ab,
  skyHorizon: 0xeed5b4,
  skySun: 0xfdf7e1,
  // The glare around the sun, which the shader now spreads further (exp(-theta / 10.0)) and squashes
  // vertically (elevWeight 45). The old 0xf6e4cf is a pale cream and the photo's own glow is orange:
  // cells (0.479, 0.114) #edcaac, (0.521, 0.114) #f9dfbe, (0.479, 0.159) #fadfaa. Set by eye against those
  // three rather than sampled: no box in the photo holds glare with no cloud in it, and the glare is what
  // this colour is for -- the clouds have `cirrus` and `cloudPuff` of their own.
  skyHalo: 0xf7dcb2,
  // The cloud where the sun does not reach it. The old 0xd8cfd2 was read off cells (0.10, 0.05) and
  // (0.15, 0.09), which are cloud mixed with the sky behind it, and it is pink: painted over the whole
  // cirrus field it turned the photo's blue top-left lavender. This is a cloud's own body in the blue,
  // box (0.30,0.05)-(0.37,0.075) #cbdcea, and `src/sky.js` now mixes it toward `cirrusLit` by how much of
  // the sun reaches that direction rather than by how thick the streak is.
  cirrus: 0xcbdcea,
  cirrusLit: 0xe8b98e, // their orange undersides, cell (0.19, 0.07)
  cloudPuff: 0xf3cfc4, // the pink puffs near the sun, cells (0.45, 0.10) and (0.52, 0.07)
  // The forested hill, as four stops down the photo rows (src/background.js passes them to
  // makeHillTexture). The photo's hill is a grey-green mass with the sun's glare washing over it near
  // u 0.62, and the old values were a warm orange ramp: over the six cells the hill is first under, the
  // render read #9f8a6c, #64523f, #c7af7b and #7b654b against a photo of #9f9d96, #5e6663, #dcb698 and
  // #625e55 -- the right luminance and 30 to 40 levels of missing blue. Boxes: (0.72,0.085)-(0.80,0.13)
  // #7d827d just under the skyline, (0.64,0.14)-(0.71,0.185) #a1806b where the glare crosses it.
  // These four are the hill's own colour by row AWAY from the sun; the texture mixes each row toward the
  // deepest stop by how far the column is from the sun's, so the glare is what the warm values are for.
  //
  // NONE of the four is a box and none is set by eye either: they are FITTED, which is a third provenance
  // this repo's rule does not name, and the fit did not land. Two measured points of the surface's own
  // transfer (texture value in, rendered cell out) gave a per-channel affine map, and the stops were
  // solved from it against the photo's (0.646, 0.159) #dcb698, (0.729, 0.159) #625e55 and (0.771, 0.159)
  // #575653. Only the third improved. Over the six cells `hill` is first under, the summed distance went
  // 0.474 to 0.499, WORSE by 0.025, and the iteration's SSIM gain here is the tree line and not these.
  // The reason the fit is unreliable is written down rather than worked around: the material's own `mean`
  // is now computed from the drawn texels, so changing a stop rescales the texture and moves the transfer
  // the stop was solved against. A next attempt should iterate the fit to a fixed point, or hold `mean`
  // constant while solving.
  hillRidge: 0x91816f,
  hillHaze: 0x776d61,
  hillMid: 0x5e5a54,
  // The hill's deepest stop, and the one the glare mixes every other row toward away from the sun's own
  // column. It replaces `hill`, which was this AND the far ground's colour at once, so tuning the hill's
  // skyline moved the ground beside the far street; the ground carries its own vertex colours now.
  // Fitted with the three above and no box of its own: the photo's hill away from the sun is (0.771,
  // 0.159) #575653 and (0.813, 0.159) #363124, and one value cannot be both.
  hillDeep: 0x3c3c40,
  nearRidge: 0x6b7a5f,
  mountainFar: 0xb9c0c8,
  mountainMid: 0xacb5bf,
  // The palest range, at the top of the stack. Its four scored cells at v 0.250 read #dcd0ca to #e4d1bf in
  // the photo against #cec6cd to #d8cbce in the render -- warm against cool -- and this is set by eye from
  // them rather than from a box: every box over that band holds two ranges and the sky between them.
  mountainFarthest: 0xdfd0c2,
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
  // The machiya's dark base band, near and far. Eighteen cells carry it: the eleven near ones average
  // #322c26 in the photo against #211a15 in the render, the seven far ones #3d3430 against #2d2622, and
  // fifteen of the eighteen ask for lighter. Box (0.95,0.72)-(1.00,0.79) #4f4e51, (0.66,0.55)-(0.95,0.63)
  // #3a352e. The three that ask for darker sit at u 0.979, where the photo runs near black (#080908).
  woodBase: 0x2b2721,
  woodMid: 0x706763,
  // The machiya's upper boarded wall. The old 0x5c5046 came from box (0.90,0.17)-(1.00,0.24), the band's
  // LOWEST and lightest strip; over the whole band the wall fills, (0.84,0.095)-(1.00,0.235) reads #47403a
  // and the eight cells it is in front of average #362f29 in the photo against #504136 in the render.
  // Iteration 1's three causes: this is the sample box across a lit and a dark region, again.
  woodUpperRight: 0x3e3a35,
  rightGround: 0x5a5250,
  topRoofRight: 0xb9b6b3,
  topEaveUnder: 0x161616,
  tileLeftLight: 0x8f9093,
  stoneBlocks: 0x8a7b6f,
  stoneBlocksTop: 0xd8cabb, // the left stone wall's top course, box (0.00,0.50)-(0.05,0.55) #ccbdb0; cell (0.021,0.523) is #d1c2b6 against #a38f80
  // The low plaster wall and its tiled cap. Over the band the wall fills, (0.085,0.815)-(0.34,0.905) reads
  // #635946 in the photo; the nine cells it is in front of average #776b5e against #8d867f in the render.
  // Only its far end (0.354, 0.841) wants lighter; every cell from u 0.10 to 0.32 wants darker and warmer.
  lowWall: 0x7e7568,
  // The low wall's near stretch, z > -6.5. Its four cells read #745644, #574d34, #685e51 and #5e5d51 in
  // the photo: the wall runs into the shopfronts' own shade there, and the far stretch (z -6.5 to -13.85,
  // which is where its cap's light band shows) is 40 levels lighter. The cap keeps `lowWall`.
  lowWallNear: 0x645a48,
  gutter: 0x7d7772,
  woodWarm: 0x7b6b5c,
  woodLight: 0x9a7a5c,
  sudare: 0xb09070,
  tileLeft: 0x7a8088,
  tileAnnex: 0x947d63, // the annex lean-to's tiles are warm brown in the photo, not the blue-grey of house 1's roofs: cells (0.10,0.432) #8f6946, (0.15,0.477) #937d6a, (0.19,0.477) #a1846b over the band the roof fills (u 0.06-0.23, v 0.42-0.50)
  tileRight: 0x7e97ba, // its band reads #8499b5 in the photo against #72798b in the render, but lifting it to 0x87a3c8 or 0x8fb0dc moved both scores by less than 0.0001: the roof spans cells that want +30% and cells that want -13%, so this is a shading gradient across the slope, not a wrong sample
  eaveUnder: 0x71747b,
  // The ground-floor eave's fascia and the shallow soffit behind it. The photo's band under the tile
  // edge is a thin dark line, not the grey slab `eaveUnder` painted: sampled straight under the tile
  // edge it reads #505153 at (0.762,0.412)-(0.78,0.428), #474541 at (0.842,0.432)-(0.86,0.448) and
  // #4b4846 at (0.965,0.462)-(0.995,0.478).
  rightEaveFascia: 0x4b4846,
  noren: 0xbfc3ca,
  // The balcony rail. In the photo it is DARK timber standing in front of a lit band, box
  // (0.87,0.205)-(1.00,0.255) #4a413d; the render had it the other way round, a light rail over a dark
  // wall, because `rightUpperBand` did not exist and the rail's cells were being asked to carry the band's
  // own light. It was measured at 0x887b6e (worth 0.142 against 0x6b5a52 while the band was missing) and
  // goes back dark now that the band is there.
  balcony: 0x5a514c,
  house1Upper: 0x1f1e1e, // mezzanine boards and the dormer, cells (0.02,0.023) #23252b, (0.02,0.114) #0f0d0d, (0.06,0.114) #25201c; the old 0x393737 was sampled over the sudare's lit band below them, and the rig lifts a dark albedo another 30%
  house1Hip: 0x5b4e45,
  eaveEdge: 0x6e5f52,
  // House 1's eave band, split at LEFT_HOUSE_1.eaveSplitZ. The eave is seen nearly edge-on, so that split
  // is a diagonal in photo space and not a vertical line: it crosses the fascia (the outer edge, x = -4.35)
  // at u 0.041 and the rafter line (x = -3.9) at u 0.087. Cell (0.02,0.341) #ad8a6b is the near half;
  // (0.06,0.341) #ba9674 straddles the two, which is why it is the band's worst cell either way. Moving
  // the split to -8.7 to put the fascia boundary at u 0.10 was measured and cost 0.0001 cell and 0.0007 SSIM.
  leftRoofEdge: 0xa07c5e, // the near half's eave edge and underside
  // The near half's exposed rafters: the photo's eave underside at u 0.02-0.09 is a lit warm band with the
  // rafters barely readable against it, and dark bars there pulled cell (0.063, 0.341) to #816653.
  eaveNearRafter: 0x9a8770,
  eaveFar: 0x604a3a, // the far half, where the photo runs into shadow: cells (0.10,0.341) #6c4e3a, (0.15,0.341) #38241c, (0.15,0.386) #583d2d
  house3Lower: 0x6f5a49,
  rightGroundFar: 0x63605f,
  // The far koshi lattice, split at y = 2.1 m. Its six cells are two populations, not one: at y 2.23 to
  // 2.63 the photo reads #7a7c87, #5a5c5f and #7e838a and at y 1.62 to 1.99 it reads #564039, #1e1916 and
  // #4e453c. One colour over the whole band was 40 levels wrong at both ends: (0.729, 0.432) rendered
  // #524a46 against #7a7c87 and (0.854, 0.523) #7c797b against #4e453c.
  // These two are NOT those means (which are #71747b and #41352e) and not any one box. They are fitted:
  // each cell mixes slats with the wall behind them and with the noren beside them, so the value that
  // scores best is darker than the photo reads. 0x7a7e8a was tried for the upper band and is worse
  // (0.600 against 0.564 over the six cells), which is how these were chosen. An independent critic
  // caught the earlier version of this comment calling them the arithmetic mean.
  latticeFarUpper: 0x6b6e78,
  latticeFarLower: 0x3a332e,
  // The lit band running along under the balcony's floor. Its old value, 0x9a8369, came from box
  // (0.85,0.255)-(1.00,0.300), which is 0.045 of frame tall where the band itself is 0.020: it spans the
  // band AND the dark timber above and below it, so it is the brief's first cause again. Laddered in
  // 0.015-wide steps, u 0.885-0.915 reads #685e5d at v 0.23, #7d6b5a at 0.25, #d8c4a1 at 0.27-0.285,
  // #89776b at 0.29 and #534b49 at 0.31; u 0.955-0.985 reads #17110f at 0.23, #674d32 at 0.25, #a78f6b at
  // 0.27-0.285 and #443b39 at 0.29. So the band is at v 0.268-0.288 and nowhere else, and over just that
  // strip it reads #bca27f (#c5ae8d over the left half, #b29670 over the right). On the wall plane x = 5.0
  // that strip is y 4.90..5.18, where the band was built 4.85..5.30 and so ran 0.014 of frame too high.
  rightUpperBand: 0xbca27f,
  shrubDeep: 0x1e2416,
  shrubLit: 0x7c958b, // the planter shrub's lit top, cell (0.771, 0.659)
  // The top of the foliage spilling over the fence, which is in the shrub's own shade in the photo while
  // its lower edge catches the light: box (0.670,0.598)-(0.750,0.632) #3d5048 against (0.752,0.645)-
  // (0.792,0.678) #839d95 one cell below it. The cluster took `shrubLit` at both ends and read as one pale
  // sage lump; cell (0.729, 0.614) was #728680 against a photo of #385341.
  spillTop: 0x3d5048,
  doorRed: 0x6f3219, // the annex's near door, cells (0.104, 0.75) and (0.104, 0.795)
  // The annex's koshi window. Its slats were the scene's generic near-black `SLAT`, and the photo has a
  // lit warm lattice there: the two cells it fills read #917655 at (0.104, 0.614) and #884a2e at
  // (0.104, 0.659) against #574a40 and #4a3c34, wanting 1.7x and 1.8x on red. Set by eye off those two
  // cells rather than sampled, because the window is 40 px wide in the photo and no box holds only slats.
  annexLattice: 0x5a3f26,
  house1Wall: 0x39241c,
  house3Wall: 0xbcae9c,
  plant: 0x4a5230,
  shrubDark: 0x2a3320,
  plaster: 0xcfc6b8,
  stoneWallLeft: 0x8e8983, // box (0.13,0.88)-(0.24,0.98) #8b8580; its seven cells average #837d79 against #7c7269
  // The right retaining wall and the ribbon skirts. It was the fence's stone core as well until iteration
  // 5 gave that its own `fenceCoreStone`: the two walls are different stone in the photo. The old 0x4d5559 came from box
  // (0.60,0.80)-(0.70,0.95), which is mostly the main stairs in their own shadow, not the wall. The wall's
  // own face reads #677277 at (0.65,0.815)-(0.70,0.87), #65737a at (0.70,0.845)-(0.75,0.90) and #6f7b83 at
  // (0.73,0.88)-(0.775,0.935), and the fence's core above it #778086 at (0.755,0.865)-(0.79,0.905).
  // Its base and its near end are darker (#3a4549 over (0.66,0.90)-(0.72,0.96)), so this is one colour on a
  // ramp and the value here is the mean the twenty-five cells of the four meshes ask for, not the face's.
  stoneWallRight: 0x5c6465,
  // The retaining wall's mortar BODY, which from the photo camera shows its top strip (x 1.35 to 2.1, at
  // terrace height) and its own shaded face at x = 1.35 -- not the stone faces that catch the light.
  // Lifting it with the stones cost +0.086 over its eleven cells while the stones and the fence cores
  // gained 0.17, so the two are split and this one keeps the darker value they shared before.
  stoneWallRightShade: 0x4d5559,
  // The side steps' treads, top of the flight and bottom. The photo's flight is LIGHT and blue-grey at
  // its head and warm and dark at its foot -- boxes (0.62,0.64)-(0.67,0.68) #777f8b, (0.59,0.69)-(0.66,0.77)
  // #5a584c and (0.58,0.78)-(0.63,0.81) #504e4a -- and `paving.js` ramped its tint the other way, 1.0 at
  // the lowest step down to 0.62 at the highest. That is why one flat warm mean fixed four cells in
  // iteration 3's inherited work and cost the fifth: (0.646, 0.659), the head of the flight, went to
  // #595853 against a photo of #78818d.
  sideStepTop: 0x7a828e,
  sideStepMid: 0x66665c, // the middle stop, its box's #5a584c lifted by eye until the flight's middle cells stopped over-darkening (0x6f6f63 scored 0.436 over the six, 0x66665c 0.420)
  sideStepFoot: 0x55534e,

  annex: 0x7a6650,
  // The annex's near stretch (z -6.0 to -10.2) only. The photo there is a light plaster shopfront panel,
  // not board: its three cells read #887d76, #a19892 and #978c87 against #7a6552, #766659 and #755b49.
  // `annex` itself stays where it is, because `left annex far` and the door canopy's boards share it and
  // the far stretch's own cells sit within 0.06 of the photo already.
  annexLit: 0x989183,
  // The annex lean-to roof's far end. `tileAnnex` was sampled over u 0.06 to 0.23 at v 0.42 to 0.50 and
  // fits seven of its eight cells within 0.093; the eighth, (0.229, 0.477), is the roof's last two metres
  // and reads #66543e in the photo against #988a7b. The ray at u 0.229 meets the roof's outer edge at
  // z = -11.49 and the one at u 0.188, which is right, at z = -9.98.
  tileAnnexFar: 0x60503f,
  annexLower: 0x55483f,
  annexFarLower: 0x201a15, // all three of its cells ask for the same 0.55x: (0.271,0.750) #29221e, (0.271,0.795) #291e18, (0.271,0.841) #382c22 against #514137, #45362d, #5f4e44
  annexFarUpper: 0xa08b72,
  canopy: 0x979899,
  steps: 0x96959a,
  // Since iteration 2 this is no longer the landing's own slabs: those carry `landingSlab`, `landingShade`
  // and `landingLeft` below. What is left on it is the lit far-street slabs, the right terrace's paved
  // bands, and the hemisphere light's ground tint in src/lighting.js, so changing it still moves the rig
  // under every material in the scene. It fits the far street: the photo reads #788592 over
  // (0.34,0.70)-(0.40,0.74), a box the render now fills mostly with the machiya row, so that is a check
  // of the photo and not of the render.
  landing: 0x76818d,
  // The far machiya row. Every one is `npm run inspect -- sample` over the band that part of the row
  // fills in the photo; the boxes are in the 2026-09-10 iteration 2 devlog.
  farRowTile: 0xafaedb, // the row's roof where the sun still reaches it, box (0.425,0.635)-(0.500,0.680)
  farRowTileFar: 0x7d8ca3, // the same roof further back and further into the bend, box (0.500,0.675)-(0.560,0.712)
  // The far row's shopfronts. Sampled from the photo's own row, which is what `npm run views` says the
  // render did not have: boxes (0.437,0.700)-(0.447,0.760) #1b1417 for the near-black corner posts,
  // (0.458,0.705)-(0.487,0.755) #4f3a33 for the warm boards between them, and (0.440,0.723)-(0.452,0.742)
  // #241818 for the dark doorways. The lattice is set by eye between the post and the board, because at
  // 20 m a slat is 4 px in the photo and no box holds only slats.
  farRowPost: 0x1b1417,
  farRowRail: 0x4f3a33,
  farRowLatticeSlat: 0x35292a,
  farRowDoor: 0x241818,
  farRowFront: 0x40393c, // the dark timber shopfronts, box (0.430,0.728)-(0.500,0.775)
  farRowFrontFar: 0x464147, // their continuation into the bend, box (0.393,0.700)-(0.428,0.738)
  farRowBase: 0x48535e, // the base band where the fronts meet the paving, box (0.430,0.775)-(0.505,0.800)
  // The landing's own three colours, new in iteration 2. Every slab is a mix of them by where it lies
  // across the street (src/paving.js), and `landingSlab` is the lightest, because a per-instance colour
  // in three can only darken. Iteration 1 measured a lift like this and lost 0.004 of SSIM, because the
  // same slabs then had to answer for the machiya row's dark timber at (0.438, 0.75) as well; the row
  // answers for that now.
  landingSlab: 0xaeaeb3, // the lit slabs: (0.335,0.755)-(0.38,0.795) #a5a9b5, (0.35,0.80)-(0.43,0.855) #b1b2ba, (0.33,0.86)-(0.47,0.90) #b3aaa5
  landingShade: 0x687888, // the band against the row: (0.39,0.73)-(0.425,0.775) #5a6d7e, (0.415,0.78)-(0.47,0.825) #758292
  landingLeft: 0x6f5c4f, // the warm dark in the left retaining wall's own shadow: (0.29,0.775)-(0.33,0.82) #5e4535, (0.30,0.825)-(0.34,0.87) #716359, (0.275,0.87)-(0.32,0.91) #756a60, (0.30,0.735)-(0.335,0.775) #7a5e4e
  farStreet: 0x4a4950,
  sideSteps: 0x4a4e4f,
  terrace: 0x3e4448,
  // The right walkway's flagstones. `architecture.js` had one flat band here in `terrace`, and over the
  // twenty cells that band is the first mesh under, the photo's mean and the render's agreed to five
  // levels (#3f464b against #393e45) while the mean cell distance was still 0.0969: all of the error was
  // the structure a flat plane has none of. These three are the photo's own cell means grouped by the
  // depth each cell's ray meets the terrace at, which is why the ramp runs along z and not across x:
  //   z -4.86  #293138   the near end, under the step and in its shadow (see `walkwayNear` for why the
  //                       colour there is not this dark: only a sliver of one slab row is in frame here)
  //   z -5.27  #53606a   the lit band
  //   z -5.91  #535759
  //   z -7.06  #2b2f32   into the machiya's own shade
  //   z -8.75  #302c2a
  // Within a row the photo's spread is the kerb and the planting bed at about 0.35 m of x per cell, which
  // no colour on this mesh can carry; across rows it is a 40-level ramp, which is what these fit.
  // The three below are the STONE's own colours, not those cell means: the walkway is seen at 35 degrees, so
  // each slab's front edge and the joint in front of it cover about a tenth of what the cell sees and they
  // are unlit (the sun is behind the scene), which is why the cell reads darker than the stone. A first
  // pass used 0.08 m slabs with 0.02 m joints, where that share is a quarter, and its cells came back
  // 25 to 50 percent dark with the stone itself measured on target (`npm run probe` at (0.877, 0.896)
  // read #556271 against a target of #53606a while the cell around it read #444e5b).
  walkwayLit: 0x5a6773,
  // The near stretch, which is the one part of this surface the photo cannot see: the frame's bottom edge
  // reaches only z = -4.665 on this terrace, inside the row centred at -4.45, and `near` is zero from the
  // next row back. So this colour moves no scored cell and is answerable only to the sweep and to physics.
  // It was 0x262c34 for one round -- a linear ratio of 0.19 against `walkwayLit`, removing 81% of the
  // light -- and an independent critic measured what this rig can actually do: with the shares at
  // ambient 0.78, sun 0.18, sky 0.14, ground 0.10 and fill 0.06, the deepest CAST shadow here removes
  // 14%. Painting five times that reads as paint, and pose 4 showed it stepping 80 levels of luma at one
  // slab joint. 0x47525d is a linear 0.60: deeper than a cast shadow, because the near end of this
  // walkway is the recess under a 1.34 m eave and this scene has no ambient occlusion, and shallow enough
  // to belong to the same lighting as everything beside it.
  walkwayNear: 0x47525d,
  walkwayFar: 0x2d3036,
  // The step's riser at the near end of the terrace (see RIGHT_STEP above), box (0.79,0.960)-(0.88,1.00)
  // #181d22, with (0.755,0.955)-(0.795,0.995) reading #212527 at its inner end. It is the face of a stone
  // step turned back at the camera, not a shadow: the sun is behind the scene, so this face never sees it.
  // The value is NOT the mean of those two boxes, which is #1c2124 -- it is set two levels above it so the
  // riser carries the inner end's reading as well as the outer, and the difference is worth one line
  // rather than letting the comment imply an average it is not.
  walkwayStep: 0x1d2227,
  // The coping along the top of the right retaining wall, box (0.74,0.90)-(0.78,0.945) #76828d. The first
  // value here was #5f6a71 from (0.70,0.90)-(0.78,0.945) — a box that straddles the very two populations
  // this coping exists to separate, which is the mistake this whole iteration is about, committed by the
  // fix for it. That box's left half reads #485255 and its right half #76828d, and at v 0.9225 it spans
  // x 1.565 to 2.191 while the coping is built over 1.86 to 2.15, so only the right half is the surface.
  // The photo
  // has a light kerb stone running the length of that wall and the render had the wall's own dark mortar
  // body showing its top strip: the three cells that land on the strip between x 1.35 and 2.15 read
  // #6d7986, #637075 and #66747a in the photo against #444e5b, #414952 and #464f57, all asking for about
  // 1.5x. `stoneWallRightShade`'s comment already says the body shows "its top strip and its own shaded
  // face" and that lifting the two together cost 0.086 over its cells — they are two populations and this
  // is the lit one, given its own surface.
  wallCoping: 0x76828d,
  // `fence` (0x64605a), the fence boards' generic warm grey, was removed in iteration 5: the whole panel
  // is `fenceWall` now and nothing read it any more.
  // The fence's own wall panel, now that it runs down over the stone core (see RIGHT_BED.wallSkirt): box
  // (0.700,0.735)-(0.780,0.775) #523c34, the dark earth plaster between its timber posts.
  fenceWall: 0x523c34,
  // The stone core under that panel. It was `stoneWallRight`, which is the retaining wall's colour and is
  // a full stop darker: box (0.690,0.835)-(0.780,0.895) #6c777d, with (0.650,0.800)-(0.690,0.845) #6b7577
  // one bay along it. The two walls are different stone in the photo and were one hex here.
  fenceCoreStone: 0x6c777d,
  plinth: 0x4c4f53, // the near half of the machiya's base band, boxes (0.87,0.71)-(0.95,0.79) #515457 and (0.92,0.76)-(1.0,0.84) #3e4348
  // Its far half runs into the shade of the bend: (0.66,0.555)-(0.78,0.60) #2f2b28, (0.83,0.63)-(0.90,0.70)
  // #3c4243. The old 0x363432 rendered #4c4743, 45 percent light, because the rig lifts a dark albedo --
  // the same thing `house1Upper` records. Two of its three cells ask for 0.45x and the third, (0.813,
  // 0.659), for 1.25x, so this is the mean of a ramp and the near cell pays for it.
  plinthFar: 0x241f1c,
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
  // `far roof d`, the block immediately past the left row, which closes the hole those two cells were
  // (see src/background.js). Its roofs stand in the left row's own shade in the photo where `farRoof`
  // is the sunlit grey-green of the blocks beyond: cells (0.146, 0.386) #583d2d and (0.104, 0.386)
  // #654631 against the render's #7b8275 and #6a5f50. Set by eye off those two cells, because the
  // region is 40 px across in the photo and every box over it holds roof, wall and gap together.
  farRoofNear: 0x5a4838,
  farWall: 0xacafac,
  farWallLow: 0x776f5f, // below the far roofs; over the band the walls actually fill the photo reads #aaa18d at (0.313,0.659), #b18962 at (0.313,0.705) and #8b8e92 at (0.354,0.705), so the old 0x4e4a3f (taken at (0.354,0.659), the one dark cell there) was 55 levels low
  // The valley beyond the town (src/background.js, outerGround). Set by eye, and marked as such: the
  // photo shows this land only as a pale hazed glimpse past the far houses at u 0.19 to 0.28, v 0.33 to
  // 0.40, and every metre of what the sweep sees of it lies outside the photo frame. Woods and open
  // ground, mixed by a slow noise and hazed toward `fog` with distance.
  valleyWood: 0x414838,
  valleyField: 0x5d5f4b,
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
  // The far street's own paving. It was checked at (0.47, 0.72) from phase 3, when the street was modelled
  // 7 m wide; the photo's paving there ends at u 0.375 and everything right of it is the machiya row, so
  // that point asked for paving where the photo has buildings. Sampled: (0.355-0.37, 0.715-0.725) reads
  // #899fb2, lit stone, and (0.38-0.395, 0.715-0.725) reads #364351, already the row's shadow side.
  // Bound: this point is on a narrow strip and it is a check of the ROW as much as of the street, which is
  // on purpose — the row's front line, the bend rate and the street width are the three things that would
  // silently close the far street off again. Re-measured after `farRowFrontX` gained its floor: the ray
  // lands at x = -3.673, z = -23.155, the paved band's left edge there is x = -4.044 (u 0.3734) and the
  // row's eave lip is now at x = -3.344 (u 0.3953), so the strip is 0.700 m wide and the point sits
  // 12.3 px of a 1200 px frame from the row and 14 px from the band's edge. Before the floor the lip was
  // at x = -3.592 (u 0.3875) and that margin was 3.0 px, not the 9 px this comment used to claim.
  { name: 'far street', u: 0.385, v: 0.735, mesh: 'far street' },
  { name: 'evergreen', u: 0.3, v: 0.29, mesh: 'evergreen' },
  { name: 'far roof', u: 0.2, v: 0.33, mesh: 'far roof' },
  { name: 'hill', u: 0.72, v: 0.13, mesh: 'hill' },
  { name: 'mountains', u: 0.25, v: 0.27, mesh: 'mountains' },
  { name: 'person', u: 0.52, v: 0.76, mesh: 'person' },
  { name: 'lamp post', u: 0.498, v: 0.79, mesh: 'lamp post' },
  { name: 'pot', u: 0.85, v: 0.75, mesh: 'pot' },
  { name: 'shrub', u: 0.755, v: 0.575, mesh: 'shrub' },
  { name: 'left plant', u: 0.21, v: 0.84, mesh: 'left plant' },
  { name: 'sign', u: 0.33, v: 0.58, mesh: 'sign' },
  { name: 'noren', u: 0.93, v: 0.5, mesh: 'noren' },
  { name: 'right eave', u: 0.85, v: 0.365, mesh: 'right eave tiles' },
  { name: 'awning', u: 0.14, v: 0.545, mesh: 'awning' },
  { name: 'annex door 1', u: 0.11, v: 0.77, mesh: 'annex door 1' },
  { name: 'stairs', u: 0.4, v: 0.93, mesh: 'stair treads' },
  // The right walkway's flagstones. The ray lands at x = 3.38, z = -5.27 on the terrace, which is inside
  // the paved range (x 2.15 to 4.94) with 1.2 m of margin on the near side and 1.5 m on the far. Bound:
  // `placement.js` matches on a name PREFIX, so this is satisfied by any slab in the set, and the band
  // under them is named `right walkway`, which this prefix does not match. There is no useful grounding
  // check to pair with it -- the only thing under the slabs is that band, and a prefix of `right walkway`
  // matches the slabs themselves, so the gap it measured would be zero by construction.
  { name: 'right walkway', u: 0.938, v: 0.932, mesh: 'right walkway slabs' },
  // The foliage over the near fence. The ray meets the fence's own face at x = 2.25, y = 2.13, z = -6.16,
  // and the leaves stand 0.1 to 0.4 m in front of it, so this fails if they move behind the boards again
  // (which is where the first pass put them) or if the fence grows toward the street. Bound: `Raycaster`
  // hits the card QUAD and the leaf texture is alpha-tested, so a transparent corner satisfies it.
  { name: 'fence spill', u: 0.771, v: 0.659, mesh: 'fence spill leaves' },
  // The far machiya row, at two of the photo positions the compare gate ranked worst before it existed.
  // Bound of both: `placement.js` matches on a name PREFIX, and the row's tiles are two shared instanced
  // meshes rather than one per roof, so `far row tiles far` is satisfied by any shaded tile anywhere on
  // the row and `far row front` by either half's body. They catch the row disappearing, being occluded,
  // or moving off these positions; they cannot tell one part of it from another.
  { name: 'far row front', u: 0.465, v: 0.755, mesh: 'far row front' },
  { name: 'far row hip', u: 0.52, v: 0.697, mesh: 'far row tiles far' },
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
  // The far machiya row's two base bands. Read the bound before trusting these two.
  // Each band is one mesh spanning a slope, so `box.min.y` is its FAR end and only that end can be asked
  // about; `x`/`z` put the ray there, at a fixed point rather than under the mesh. Both the band's base
  // and the paving under it are built from `streetY`, so the gap they measure is `FAR_ROW.sink` plus a
  // fraction of a step of slope, by construction — about 0.51 and 0.54 m against a window of
  // [-0.4, 0.9]. What they catch is the row losing its ground entirely, or the paving under it moving;
  // what they do NOT catch is the row shifting sideways (the ray's x is fixed and the landing is 7.5 m
  // wide), or every ring but the lowest being lifted or tilted (`min.y` is a whole-mesh minimum), or a
  // wrong `sink` anywhere in [0, 0.9]. They are weak checks and they are named after what they are.
  // The ground named is the paved ribbon's own name, which by prefix also matches the slabs above it.
  // `far row base far`'s ray moved from x = -4.39 to -3.24 when `farRowFrontX` gained its floor. At
  // z = -30.4 the row's footprint went from -5.689..-3.089 to -4.538..-1.938, and -4.39 sat 0.148 m inside
  // its near edge — close enough that a further nudge to `keepOff` would have walked the ray out from
  // under the mesh it is asking about, with nothing going red. -3.24 is the footprint's middle, 1.3 m from
  // either edge, which is the margin the check had before. The paved band there runs -5.638 to -0.438, so
  // the ray still lands on `far street`.
  // Bound both of these share with the placement checks: the ground is matched by name PREFIX, so
  // `far street` is satisfied by the ribbon, by `far street slabs` and by `far street lit slabs` alike,
  // and `landing` by the ribbon or its slabs. They cannot tell which of those the ray hit.
  { name: 'far row base', mesh: 'landing', tolerance: 0.4, sink: 0.9, x: -0.95, z: -21.2 },
  { name: 'far row base far', mesh: 'far street', tolerance: 0.4, sink: 0.9, x: -3.24, z: -30.4 },
];
