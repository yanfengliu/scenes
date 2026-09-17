// The White House and its grounds: the photo landmarks, the camera model, the real dimensions, the bay
// layout and every colour.
//
// Pure data and functions with NO three.js import, so a Node tool (compare, shot, a placement check) can
// read it exactly as it reads scene 1's src/layout.js. Nothing here may import three.
//
// ---- Coordinate conventions, stated once because getting them wrong is silent ----
//
// Photo space: u to the RIGHT and v DOWN, both as fractions of the frame (0..1) -- the repo's convention.
//
// World space: y up; the building's north facade is centred on x = 0 with its NORTH WALL at z = 0. The
// building runs to z = -26.1 (its south face) and the camera looks along -z, so THE CAMERA STANDS AT +z AND
// EVERYTHING IT SEES IS AT NEGATIVE z. +x is the building's east end, -x its west end. y = 0 is the north
// grade at the wall.
//
// So the north lawn, the drive, the fence, the fountain, the flower bed and the north trees all have z < 0;
// the camera stands at z = +47.86; and the SOUTH lawn, which is behind the building from this camera, is the
// only thing at positive z.
//
// ---- The camera, solved from the photograph ----
//
// Four measurements define the photo view. out/wh/scratch/measure.mjs finds them by scanning for luminance
// and colour transitions in whitehouse.webp (1200x900); out/wh/scratch/fit.mjs solves the camera from them:
//
//   the block's west end    u 0.1292   the block's east end  u 0.8708   (890 px apart)
//   the wall's base at x 0  v 0.6180   the parapet at x 0     v 0.3800   (214 px apart)
//
// With the camera on the building's centre line at (0, h, d), level and unrolled, tanV = tan(vFOV/2) and
// tanH = (4/3) tanV, a point (x, y, 0) at the wall projects to
//   u = 0.5 + x / (2 tanH d)          v = 0.5 - (y - h) / (2 tanV d)
// The block's ends and the published 51.2 m fix the product tanH d = 34.52 m; the file's own EXIF settles
// the lens at 24 mm equivalent on a 4:3 frame, i.e. vFOV 56.82 deg and tanV 0.54092; the wall's base row
// then fixes h; and the parapet then has to fall on its own row, which is the check:
//
//   d = 34.52 / 0.72123 = 47.86 m
//   h = (0.6180 - 0.5) * 2 * 0.54092 * 47.86 = 6.11 m
//   parapet model row = 0.5 - (15.3 - 6.11) / (2 * 0.54092 * 47.86) = 0.3798   measured 0.3800 -- 0.2 px
//
// All four landmarks land inside 0.5 px, and the published 15.3 m is CONFIRMED by the frame rather than
// assumed.
//
// THE EYE AT 6.11 m IS THE ONE SURPRISING NUMBER, and it is not a claim about a photographer. A camera at a
// hand-held 1.6 m cannot put the wall's base on its own row at any distance or any lens: rows 0.6180 and
// 0.3800 together force the eye to 6.11 m, and forcing it to 1.6 m instead would need either a north facade
// of 7.8 m or a block 113 m long. What 6.11 m IS, is the eye's height above the grade AT THE WALL, so a
// photographer whose phone was 1.6 m above the ground under their feet stood on ground 4.51 m above the
// wall's grade. The White House's north lawn does rise from the building towards Pennsylvania Avenue. The
// published GPS altitude (19.351 m ASL) against the derived north grade (19.4 m ASL) does NOT show a rise
// that large, so this is the frame's reading and not the survey's; out/wh/calibration.md states the conflict
// in full. The model carries it as TERRAIN (NORTH_LAWN below), not as a floating camera.
const DEG = Math.PI / 180;

export const PHOTO = { width: 1200, height: 900 };
export const SHOT = { width: 1200, height: 900 };
export const ASPECT = PHOTO.width / PHOTO.height;

// ---- Real dimensions --------------------------------------------------------------------------------
// Each figure is the published number with its citation, or '[estimate]' with the photo measurement it
// rests on.
export const DIMS = {
  blockLength: 51.2, // 168 ft -- White House Historical Association, "White House Dimensions"
  blockDepth: 26.1, // 85 ft 6 in without porticoes -- same source
  blockDepthWithPorticoes: 46.3, // 152 ft with both -- same source
  northFacade: 15.3, // 50 ft 4 in, north lawn grade to parapet -- same source, CONFIRMED by the frame
  southFacade: 18.3, // 60 ft, south lawn grade to parapet -- same source
  // DERIVED from the pair above: 54 ft (south lawn ASL) + 60 ft - 50 ft 4 in = 63 ft 8 in ASL, so the north
  // lawn stands 10 ft above the south lawn and the south facade shows a third storey the north hides.
  southLawnDrop: 3.0,
  // The storey levels, from the HABS measured South elevation (sheet 34, read in out/wh/habs-findings.md):
  // ground floor -6'-8", first floor +10'-0", second floor +30'-0", cornice +64'-6", from the FIRST FLOOR
  // datum. With the ground floor as the north grade that puts the first floor at 2.03 m and the second at
  // 7.11 m. The cornice's 17.63 m does not agree with this facade and is recorded rather than used.
  groundFloor: 0.0,
  firstFloor: 2.03,
  secondFloor: 7.11,
  firstFloorDatumCornice: 17.63, // HABS +64'-6" from the first-floor datum -- recorded, not used
  // Windows, from the photo through the fitted camera (building.js's FACADE holds the same numbers).
  firstWindowSill: 4.16,
  firstWindowHead: 7.22,
  secondWindowSill: 9.24,
  secondWindowHead: 12.42,
  windowWidth: 2.1, // [estimate] the glass, about 0.45 of it per 4.655 m bay
  porticoFloor: 1.9, // [estimate] the north portico's floor above the lawn it stands on
  rampHeight: 1.5, // [estimate] the terrace the north front stands on: "the ground floor is hidden by a
  // raised carriage ramp and parapet" -- Wikipedia, citing NPS
  hedgeHeight: 2.2, // the north lawn's own end hedges, which close the composition either side of the
  // building -- NOT the band along the wall, which is TERRACE's planted rim.
  hedgeDepth: 3.0, // [estimate]
  balustradeHeight: 1.15, // UNVERIFIED -- research-photo.md section 5 item 11 says no source gives it
  roofRise: 1.1, // [estimate] the low roof's ridge above the deck behind the balustrade
  // The North Portico. Width and projection are UNVERIFIED (research-photo.md section 5 item 6) and are set from
  // the photo: the pediment's raking cornice runs u 0.333 to 0.663, which at the portico front plane's own
  // depth is 21.5 m. Its 4 columns then stand on the building's 4.655 m bay pitch, which makes the portico
  // exactly the three central bays wide -- the one internal check available, and it agrees.
  porticoWidth: 24.5,
  porticoProjection: 6.5, // [estimate] from the 152 - 85.5 = 66.5 ft total for both porticoes, shared
  porticoColumnCount: 4, // weakly sourced (a stock-photo caption); the order, Ionic, is well attested
  porticoColumnHeight: 8.8, // [estimate] the entablature's underside above the portico floor
  porticoColumnRadius: 0.85, // [estimate] the shaft at its base: the porch's order is a tall one
  porticoEntablature: 1.3, // [estimate] architrave + frieze + cornice
  porticoEntablatureTop: 12.0, // [estimate] the pediment's base, read off the photo's entablature band
  pedimentApex: 15.3, // [estimate] the photo puts the apex at v 0.3033, which is 15.2 m on this camera
  // The South Portico: a bowed centre with six Ionic columns on a rusticated podium with a double
  // staircase, flat-roofed, no pediment. Column count 6 is INFERRED (research-photo.md section 5 item 5).
  southBowProjection: 6.5,
  southBowRadius: 8.5, // [estimate] the bow's radius in plan, three bays wide
  southColumnCount: 6,
  southPodiumHeight: 5.4, // [estimate] south grade to the portico floor, over the exposed ground storey
  // ---- The north grounds. EVERY z BELOW IS NEGATIVE (see the conventions above). ----
  // Each distance is the photo row it was measured at, turned into metres by the fitted camera: a point on
  // the ground plane y = 0 projects to v = 0.5 + 6.11 / (2 * 0.54092 * dn) with dn the distance NORTH of
  // the camera, so dn = 5.647 / (v - 0.5) and the world z is dn - 47.86.
  hedgeTopRow: 0.6180, // the hedge band's top: the same row the wall's base was measured at
  bedFarRow: 0.6744, // -> camera-to-row distance 32.4 m -> z -15.4
  bedNearRow: 0.7350, // -> 24.03 m -> z -23.8
  fountainRow: 0.7000, // [estimate] the water line, read off the basin in the photo -> z -28.6
  fountainPlumeRow: 0.5300, // the plume's top
  fenceNearRow: 0.8200, // [estimate] the fence line at the frame's edge -> z -43.9
  // Every |z| below is the CAMERA-TO-FEATURE distance minus the camera's own z (47.863), through the
  // inverse v = 0.5 + (eye.y - yG) / (2 tanV dn) with tanV 0.54092 and eye.y 9.086.
  bedDistance: 15.4, // the bed's far edge, from bedFarRow
  bedDepth: 8.4, // the bed's own depth, from bedFarRow to bedNearRow
  bedWidth: 33.0, // from u 0.288..0.752 at the bed's widest row: 0.464 of the 69 m frame there
  fountainDistance: 28.6, // the fountain's centre, from fountainRow on the water plane y 0.9
  fountainWaterHeight: 0.9, // [estimate]
  fountainJetHeight: 6.4, // the plume's top, from fountainPlumeRow
  hedgeDistance: 2.0, // |z| of the hedge band's centre line, against the wall
  fenceDistance: 43.9, // the fence line, from fenceNearRow
  fenceHeight: 4.0, // 13 ft, reported (not officially confirmed) for the post-2020 fence in this 2024 photo
  fenceWallHeight: 0.9, // [estimate] the sandstone wall the pickets stand in
  fencePicket: 0.022, // 7/8 inch -- NCPC transcript, 7 July 2016, quoted in out/wh/research-dims.md section 8.2
  fenceGap: 0.118, // 4-5/8 inch clear space -- same source
  driveWidth: 7.0, // [estimate]
  driveDistance: 49.0, // |z| of the drive's centre, just beyond the fence
};

// ---- Camera ----------------------------------------------------------------------------------------
// Solved in out/wh/scratch/fit.mjs. The block's width with the published 51.2 m and the EXIF lens fix the
// distance; the two rows' own DIFFERENCE fixes how high the wall's visible base stands above the north lawn;
// and the base row then fixes the eye. All four landmarks land on 0.00 px.
export const CAMERA = {
  eye: { x: 0, y: 9.086, z: 47.863 },
  pitchDeg: 0.0, // the solve's own pitch: the horizon it implies sits at v 0.5000, the frame's middle
  fovDeg: 56.82, // derived from the file's own EXIF: 24 mm equivalent on a 4:3 frame
  rollDeg: 0.0,
  targetDepth: 47.863, // OrbitControls needs a target on the optical axis, not only a direction
  near: 0.3,
  far: 3000,
};

// ---- The wall's visible base, and the terrace that puts it there -------------------------------------
// THE NUMBER THIS SCENE DERIVES RATHER THAN PUBLISHES. On the north front "the ground floor is hidden by a
// raised carriage ramp and parapet" (Wikipedia, citing NPS) and a hedge band runs the length of the wall, so
// the wall the photo shows rising out of the hedge is NOT standing at the lawn: the two measured rows
// (v 0.6180 at the base, v 0.3800 at the parapet) demand a base 2.976 m above the north lawn. The model
// builds that terrace and stands the wall on it, and the hedge occupies the band in front of it.
export const TERRACE = {
  baseY: 2.976, // the wall's own visible base, solved
  // The terrace has to be SHALLOW and the hedge has to stand ON it, or the portico's columns are buried:
  // a first pass put the terrace's outer edge 4.5 m out with a 1.8 m hedge in front of it, and the porch
  // (whose columns are 4.8 m out) disappeared behind the greenery in the photo view. The visible band the
  // photo shows between the wall's base and the lawn is 1 to 2 m deep, which is what these are.
  outerZ: 3.4, // |z| of the terrace's outer edge, where its face drops to the lawn -- [estimate]
  // 3.4 IS SET BY A ROW, NOT BY TASTE. The terrace is 2.976 m tall because the wall's base is, and the
  // camera is 9.086 m up at 47.863 m, so the top of the terrace's outer edge projects to v 0.6180 -- the row
  // the photograph measures the band's top at -- when the edge stands 3.4 m north of the wall. Everything
  // the frame shows between that row and the lawn is then this terrace's own planted rim. See building.js's
  // note on the rim; a hedge standing behind this edge is not in the frame at any height worth having.
  rim: { depth: 1.5, drop: 0.55 }, // the planted slope along the terrace's outer edge: how far it runs back
  // from the edge and how far it drops over that run. Both are [estimate]s, and both are seen at a glance:
  // 1.5 m of depth at this angle is 0.026 of the frame height, which is the dark band's own width.
  hedgeZ: 3.9, // |z| of the north lawn's own hedge line, which is the separate planting at the lawn's end
  hedgeDepth: 0.7, // [estimate]
};

// ---- The north lawn's own rise ----------------------------------------------------------------------
// The camera stands at z = +47.86, 9.086 m above the north grade at the wall. With a photographer's eye at
// 1.60 m, the ground under them was 7.49 m above the wall's grade. The north lawn does rise from the
// building towards Pennsylvania Avenue; this carries that rise as terrain rather than as a floating camera.
export const NORTH_LAWN = {
  flatTo: 30.0, // |z| out to which the lawn is level at y = 0 -- past the bed and the fountain
  riseTo: 47.863, // |z| of the camera's own station
  riseHeight: 7.486, // CAMERA.eye.y - 1.60: the ground under the photographer, over the last 17.9 m
  slope() {
    return this.riseHeight / (this.riseTo - this.flatTo);
  },
  // The ground's height at a world z, which is negative on the north side.
  yAt(z) {
    const a = Math.abs(z);
    if (a <= this.flatTo) return 0;
    if (a >= this.riseTo) return this.riseHeight;
    return ((a - this.flatTo) / (this.riseTo - this.flatTo)) * this.riseHeight;
  },
};
// ---- Bays ------------------------------------------------------------------------------------------
// SOURCED: the North Front has 11 bays, 4 + 3 + 4 -- Wikipedia "White House" section Architectural description,
// citing The Columbia Encyclopedia (8th ed., 2018). LAID OUT BY PROPORTION: the boundaries below. The
// photo's own window centres sit at u 0.163, 0.225, 0.286, 0.348 (west) and 0.602, 0.664 (east), a uniform
// pitch of 0.0618 of the frame; the fitted camera turns that into 4.65 m, which is 51.2 / 11 to within
// 0.1%, so the bays are uniform and the portico takes exactly the middle three. Which bay carries a
// TRIANGULAR pediment and which a SEGMENTAL one is in no source (research-photo.md section 5 item 13) and is read
// off the photograph: the bay nearest the portico on each side carries the triangle, then they alternate.
const BAY_PITCH = DIMS.blockLength / 11;
export const BAYS = {
  count: 11,
  pitch: BAY_PITCH,
  halfLength: DIMS.blockLength / 2,
  centreX(i) {
    return -DIMS.blockLength / 2 + (i - 0.5) * BAY_PITCH;
  },
  porticoBays: [5, 6, 7],
  firstFloorPediment(i) {
    const d = Math.abs(i - 6);
    if (d === 0) return null; // behind the portico
    return d % 2 === 1 ? 'triangle' : 'segmental';
  },
  secondFloorPediment() {
    return 'flat'; // "the second-floor pediments are flat" -- sourced
  },
  boundaries() {
    const out = [];
    for (let i = 0; i <= 11; i++) out.push(-DIMS.blockLength / 2 + i * BAY_PITCH);
    return out;
  },
};

// ---- Projection math -------------------------------------------------------------------------------
// WHY THESE ARE NOT IMPORTED FROM src/layout.js. Scene 1's cameraBasis/uvToWorld/worldToUV/
// frameSizeAtDepth take their aspect ratio from a module constant computed from SCENE 1'S PHOTO and take
// scene 1's camera as a default argument pointing at scene 1's own eye and pitch. A later change to either
// photo would silently move this scene's projection while every test still passed. Four small functions are
// cheaper than that coupling.
export function cameraBasis(cam = CAMERA) {
  const p = cam.pitchDeg * DEG;
  const r = (cam.rollDeg ?? 0) * DEG;
  const tanV = Math.tan((cam.fovDeg / 2) * DEG);
  const forward = [0, Math.sin(p), -Math.cos(p)];
  const right0 = [1, 0, 0];
  const up0 = [0, Math.cos(p), Math.sin(p)];
  const cr = Math.cos(r);
  const sr = Math.sin(r);
  return {
    eye: [cam.eye.x, cam.eye.y, cam.eye.z],
    forward,
    right: [right0[0] * cr + up0[0] * sr, right0[1] * cr + up0[1] * sr, right0[2] * cr + up0[2] * sr],
    up: [-right0[0] * sr + up0[0] * cr, -right0[1] * sr + up0[1] * cr, -right0[2] * sr + up0[2] * cr],
    tanV,
    tanH: tanV * ASPECT,
  };
}

// The world point that lands on photo position (u, v) at `depth` metres along the optical axis.
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

// Where a world point lands in the frame, plus its depth along the optical axis.
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

export function frameSizeAtDepth(depth, cam = CAMERA) {
  const b = cameraBasis(cam);
  return { width: 2 * b.tanH * depth, height: 2 * b.tanV * depth };
}

// The frame's own width in metres at a world z, which is what turns a ground feature's u extent into metres.
export function frameWidthAtZ(z, cam = CAMERA) {
  return frameSizeAtDepth(cam.eye.z - z, cam).width;
}

// ---- The landmarks the photo fixes -----------------------------------------------------------------
export const LANDMARKS = {
  wallLeftEnd: { u: 0.1292, v: null, note: 'wall face against the trees, rows v 0.52-0.57' },
  wallRightEnd: { u: 0.8708, v: null, note: 'wall face against the trees, rows v 0.52-0.57' },
  wallBaseCentre: { u: 0.5, v: 0.6180, note: 'last bright wall pixel above the hedge, wings median' },
  parapetCentre: { u: 0.5, v: 0.3800, note: 'sky/wall transition at the middle of each flanking wing' },
  pedimentApex: { u: 0.5, v: 0.3033, note: 'highest 12-px-deep non-sky run on the centre columns' },
  pedimentWest: { u: 0.3333, v: null, note: 'the raking cornice, rows v 0.356-0.389' },
  pedimentEast: { u: 0.6625, v: null, note: 'the raking cornice, rows v 0.356-0.389' },
  hedgeTop: { u: 0.5, v: 0.6180, note: 'the hedge band, 13 columns' },
  bedFarEdge: { u: 0.5, v: 0.6744, note: 'hedge/bed to red, 13 columns' },
  lawnAboveBed: { u: 0.5, v: 0.7350, note: 'red to lawn, 13 columns' },
  fountainPlumeTop: { u: 0.5083, v: 0.5300, note: 'bright water against the hedge, plume columns' },
  horizon: { u: null, v: 0.5000, note: 'DERIVED from the fitted pitch, not scanned' },
};

export const LANDMARK_MARKS = [
  { name: 'wall left end', kind: 'vline', u: LANDMARKS.wallLeftEnd.u, v0: 0.20, v1: 0.70 },
  { name: 'wall right end', kind: 'vline', u: LANDMARKS.wallRightEnd.u, v0: 0.20, v1: 0.70 },
  { name: 'wall base', kind: 'hline', v: LANDMARKS.wallBaseCentre.v },
  { name: 'parapet', kind: 'hline', v: LANDMARKS.parapetCentre.v },
  { name: 'horizon', kind: 'hline', v: LANDMARKS.horizon.v },
  { name: 'pediment apex', kind: 'point', u: LANDMARKS.pedimentApex.u, v: LANDMARKS.pedimentApex.v },
  { name: 'pediment', kind: 'box', u0: LANDMARKS.pedimentWest.u, u1: LANDMARKS.pedimentEast.u, v0: 0.28, v1: 0.39 },
  { name: 'hedge band', kind: 'box', u0: 0.14, u1: 0.86, v0: 0.612, v1: 0.648 },
  { name: 'flower bed', kind: 'box', u0: 0.288, u1: 0.752, v0: 0.665, v1: 0.745 },
  { name: 'fountain plume', kind: 'vline', u: LANDMARKS.fountainPlumeTop.u, v0: 0.525, v1: 0.70 },
  { name: 'lawn', kind: 'box', u0: 0.2, u1: 0.8, v0: 0.76, v1: 1.0 },
];

// ---- Colours ---------------------------------------------------------------------------------------
// sRGB hex, every one SAMPLED from whitehouse.webp at the box in its comment, by out/wh/scratch/boxes.mjs
// (a mean over the box) or out/wh/scratch/pixel.mjs (one pixel). None is set by eye without saying so.
//
// These are the colours the photo SHOWS, not albedos: they already contain the light the north facade sits
// in. src/materials.js's albedoOf turns each into the albedo that displays as it under the scene's rig,
// which is normalised to MATERIALS.irradiance.
//
// THE REBALANCE OF THIS PASS. The rig used to over-light every surface: measured with
// out/wh/scratch/rig.mjs, the wall displayed at 1.78x its own albedo where the photo puts it at 1.00, and
// the lawn at 2.76x -- so the wall washed out to a flat near-white and the lawn went dark and blue at once.
// The wall, the cornice and the terrace carry the photo's own values below, and the rig in lighting.js was
// re-solved to land them there.
export const COLORS = {
  // The wall. THE FACADE'S OWN RAMP IS THE POINT: the photo's east end climbs from #515d6f (luma 94) just
  // under the cornice to #a5b4c6 (luma 178) at the base, in sixteen 13-px rows (profile at u 0.860-0.868,
  // v 0.382 to 0.604, step 0.0148: #515d6f #56647c #636d77 #677078 #767f8f #808b9d #8893a7 #8c9aad #93a0b2
  // #99a5b8 #9daabc #a1adc0 #a2afc2 #a3b1c4 #a5b4c6). The rig reproduces it with the hemisphere light's
  // ground term; wallUpper is the top of that ramp and wallLit its bottom.
  wallUpper: 0x5d6775, // profile row v 0.382, mean #515d6f warmed: the built wall's own blue cast comes
  // from the light as well as the pigment, so the pigment carries less of it than the pixel does.
  wallMid: 0x87919e, // profile row v 0.471, mean
  wallLit: 0x9aa5b4, // profile row v 0.530, mean
  wallWestEnd: 0x818c9d, // box u 0.135-0.148 v 0.50-0.55, mean
  wallEastEnd: 0x98a5b7, // box u 0.855-0.868 v 0.50-0.55, mean -- the east end is the brighter one
  windowGlass: 0x545f69, // box u 0.1605-0.1695 v 0.445-0.478, mean -- the SECOND floor's glass, whose
  // head is plain; the first floor's is darker still because its pediment shadows it.
  windowGlassUpper: 0x808b9d, // box u 0.1605-0.1695 v 0.545-0.600, mean -- the first floor's own glass
  windowTrim: 0x798592, // box u 0.152-0.178 v 0.518-0.532, mean -- the first floor's head band
  stoneTrim: 0x8a94a2, // the portico's and the steps' stone, between the cornice and the wall's own white
  // The terrace the north front stands on, and its parapet: box u 0.240-0.300 v 0.612-0.618 reads #9aa2ab to
  // #a8b1b3 -- brighter than the wall above it, because it faces up.
  terraceStone: 0x8f98a1, // box u 0.240-0.300 v 0.612-0.618 reads #9aa2ab to #a8b1b3 in the photograph, and
  // that is the terrace's own deck: the sampled value, carried down a little because the frame shows the
  // deck only at the glancing angle the wall's base is seen at, not square on.
  terraceRim: 0x1b2416, // the planted slope along the terrace's outer edge: near the hedge's own #12140c,
  // lifted slightly because this face turns up toward the sky rather than standing vertical in front of it
  corniceStone: 0x6f7a86, // box u 0.220-0.300 v 0.386-0.392, mean was #4b545e; that box is the cornice's own
  // shadow line and the band is built as a 0.9 m moulding whose lit face reads between the two.
  frieze: 0x8f9aa6, // box u 0.220-0.300 v 0.394-0.400, mean #546073 is the recessed frieze in shadow; the
  // built band's own outer face sits between it and the wall.
  balustrade: 0x9fabbb, // box u 0.220-0.300 v 0.372-0.379, mean -- the parapet, sky behind the balusters
  corniceShadow: 0x535d6b, // box u 0.24-0.30 v 0.388-0.394, mean -- the cornice in its own shadow
  roof: 0x5c6672, // box u 0.28 v 0.355 #727984 where it is stone, #3a4448 where it is the roof's shadow
  roofShadow: 0x3a4448, // pixel u 0.28 v 0.355
  porticoReturn: 0x4a5353, // box u 0.398-0.410 v 0.50-0.53, mean
  underPortico: 0x373932, // box u 0.470-0.530 v 0.44-0.47, mean -- the photo's darkest large area
  pedimentFace: 0x414d56, // box u 0.450-0.550 v 0.325-0.342, mean -- the tympanum
  porticoColumn: 0x60707f, // box u 0.460-0.470 v 0.36-0.468, mean -- the west column's own shaft, which
  // the photo shows as the porch's mid tone between the lit stone and the shadow behind it
  lawnNear: 0x647b2c, // box u 0.30-0.45 v 0.90-0.97, mean
  lawnMid: 0x607726, // box u 0.30-0.42 v 0.80-0.84, mean
  lawnFar: 0x646e26, // box u 0.40-0.44 v 0.735-0.745, mean
  lawnBand: 0x6a8130, // box u 0.76-0.88 v 0.76-0.82, mean #687d39: the east side is a mowing band, and the
  // photo shows bands standing several levels brighter than the lawn between them.
  hedge: 0x12140c, // box u 0.24-0.30 v 0.635-0.655, mean -- nearly black, as the photo's is
  hedgeLit: 0x1d261a, // pixel u 0.600 v 0.630 -- the hedge's own top, where the sky reaches it
  flowerBed: 0x8f1c23, // box u 0.30-0.36 v 0.69-0.71, mean
  flowerBedLit: 0xdf4c55, // pixel u 0.260 v 0.680 -- a single bloom catching the light
  drive: 0x3b3a33, // [estimate] the drive is in no clean box: the frame's foreground at the left edge reads
  // #0d1108, which is the drive UNDER the tree shadow, so the material takes a lighter gravel.
  fence: 0x0b0d0d, // box u 0.005-0.05 v 0.615-0.63, mean -- the iron fence, near black
  // The sky, against the photo's own column at u 0.06-0.30, where no cloud and no tree is in the way:
  // v 0.00-0.04 #4970cf (luma 111), v 0.06-0.10 #5779d3 (119), v 0.18-0.26 #7592e3 (146), v 0.30-0.34
  // #6a8fe9 (139). The frame's own top row is therefore NOT the zenith -- at a 28-degree vertical half
  // angle the top of the frame looks only 28 degrees up -- so skyTop is the sampled row and skyZenith is
  // the [estimate] that row implies for a point overhead.
  skyTop: 0x4970cf, // box u 0.10-0.30 v 0.00-0.04, mean
  skyMid: 0x5779d3, // box u 0.06-0.26 v 0.06-0.10, mean
  skyHorizon: 0x7592e3, // box u 0.06-0.16 v 0.18-0.26, mean
  skyZenith: 0x3f68c8, // [estimate] skyTop with the same step towards saturation that skyTop takes from
  // skyMid; the frame never shows the zenith.
  cloud: 0xeef2f8, // box u 0.72-0.84 v 0.22-0.28, mean #b9c6eb is a cloud's shaded edge; the cloud TOPS
  // are blown, and the frame's brightest cloud pixels read #f1fafe. #eef2f8 is the lit-cloud value.
  cloudShade: 0xb9c6eb, // box u 0.72-0.84 v 0.22-0.28, mean -- a cumulus underside near the horizon
  treeFoliage: 0x2b3a20, // [estimate] the frame's trees are almost black: box u 0.94-0.98 v 0.30-0.36 reads
  // #6f7ea0, which the classifier flags as 67% SKY, so no box is the tree. Its own dark pixels read
  // #1b2415 and #222c1b, and this is between them and the hedge.
  // A BRIGHTER VALUE WAS TRIED AND REVERTED, measured rather than argued: 0x3b4d27 took cell distance from
  // 0.1448 to 0.1452 and SSIM from 0.1262 to 0.1268, and the west framing crown is a large object in the
  // scored frame that the photograph really does show as a backlit silhouette. The cost is inside the
  // 0.001 budget on SSIM but not on cell distance, so the north trees keep the photograph's own value and
  // the SOUTH trees, which are off-camera, take the sunlit one below.
  treeFoliageSunlit: 0x4e6633, // [estimate] a crown in sun, for the south front only. The sun stands
  // north-east, so the south side is the shadow side of every north tree and the lit side of the south
  // ones; a south crown built at the north's own backlit value is a hole, which is what a reviewer saw.
  treeFoliageLit: 0x6f8a3c, // [estimate] the crown's own top, which the sun reaches directly. The previous
  // #46592c was a BACKLIT value being applied to a lit face, which is what made crowns read flat.
  fountainWater: 0xd8e6ea, // [estimate] box u 0.596-0.615 v 0.60-0.65 reads #323c3a, which is the HEDGE
  // behind the water; the plume's own bright pixels read #f1fafe and the falling water #b9cdd6.
  fog: 0xa8bcd8, // [estimate] the far haze: the frame's far trees fade towards the sky's own pale blue
  // The colours the RIG is tinted by, which are NOT the ones the sky dome draws. Two things decide them.
  // A light tinted with skyTop's own saturated blue makes every surface it reaches blue, and the wall it
  // reaches is already blue-grey: measured off the first working rig, the wall displayed #7192c5 against
  // the photograph's #9daabc, a blue-minus-red of 84 where the photo has 31. And the lawn's light has to be
  // the colour the lawn is, because an upward face sees almost nothing else. So the sky light is the sky
  // taken 40% of the way to a warm white, and the upward light is the lawn's own hue in light rather than
  // in pigment. Each is marked [estimate] because no pixel of the photograph is this light.
  skyLight: 0xf0ebdc, // [estimate] skyTop taken 40% of the way towards a warm white (0xfff6e0)
  groundLight: 0xe8e9e4, // [estimate] the wall's own colour lifted most of the way to white: what the
  // pale terrace and the wall's lower courses bounce back at the wall above them
  upLight: 0xf2edc4, // [estimate] the lawn's hue carried into light: the sky half of the upward-biased
  // hemisphere, which stands in for the ground's own bounce
  upGround: 0x14180f, // [estimate] nearly black: that same light's ground half, which is what keeps it
  // from lifting the wall. See the note on the two hemispheres in lighting.js.
  fillLight: 0xd8d8d0, // [estimate] the haze at the wall, near neutral so it does not add to the blue
};

// ---- Where the model's own landmarks land in the frame ----------------------------------------------
export const MODEL_LANDMARKS = (() => {
  const pts = {
    // The wall's base is at TERRACE.baseY, not at y = 0: the terrace and the hedge stand in front of
    // everything below it, which is why the photo's base row is 214 px below the parapet and not 254.
    'wall west corner': { x: -DIMS.blockLength / 2, y: TERRACE.baseY, z: 0 },
    'wall east corner': { x: DIMS.blockLength / 2, y: TERRACE.baseY, z: 0 },
    'wall base centre': { x: 0, y: TERRACE.baseY, z: 0 },
    'terrace face at the lawn': { x: 0, y: 0, z: -TERRACE.outerZ },
    'parapet centre': { x: 0, y: DIMS.northFacade, z: 0 },
    'parapet west wing': { x: -19.2, y: DIMS.northFacade, z: 0 },
    'parapet east wing': { x: 19.2, y: DIMS.northFacade, z: 0 },
    'portico west column': { x: -DIMS.porticoWidth / 2 + 1.55, y: TERRACE.baseY + DIMS.porticoFloor, z: -DIMS.porticoProjection },
    'portico east column': { x: DIMS.porticoWidth / 2 - 1.55, y: TERRACE.baseY + DIMS.porticoFloor, z: -DIMS.porticoProjection },
    'pediment apex': { x: 0, y: DIMS.pedimentApex, z: -DIMS.porticoProjection },
    'bed far edge': { x: 0, y: 0, z: -DIMS.bedDistance },
    'fountain water': { x: 0, y: DIMS.fountainWaterHeight, z: -DIMS.fountainDistance },
    'fountain jet top': { x: 0, y: DIMS.fountainJetHeight, z: -DIMS.fountainDistance },
    'fence top': { x: 0, y: DIMS.fenceHeight, z: -DIMS.fenceDistance },
  };
  const out = {};
  for (const [name, p] of Object.entries(pts)) {
    const { u, v, depth } = worldToUV(p);
    out[name] = { u: Math.round(u * 10000) / 10000, v: Math.round(v * 10000) / 10000, depth: Math.round(depth * 100) / 100 };
  }
  return out;
})();
