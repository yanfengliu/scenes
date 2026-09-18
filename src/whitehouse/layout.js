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
// building runs to z = -26.1 (its south face) and the camera looks along -z from z = +47.863, so THE CAMERA
// STANDS AT +z AND EVERYTHING IT SEES IS IN FRONT OF IT, i.e. at a z BELOW ITS OWN. +x is the building's
// east end, -x its west end. y = 0 is the north grade at the wall.
//
// SO THE NORTH GROUNDS HAVE POSITIVE z AND THE SOUTH LAWN HAS NEGATIVE z, and this is the one convention in
// the file that has already been got wrong once. The north front's face is at z = 0; the camera is 47.863 m
// north of it at z = +47.863; and the north lawn, the flower bed, the fountain, the drive and the fence all
// stand BETWEEN the camera and the wall, i.e. at 0 < z < 47.863 for everything the frame shows, with the
// fence and the drive beyond the camera (see fenceDistance). The depth of a point is
//
//   dn = eye.z - z
//
// and the previous pass authored every north-ground z from z = dn - eye.z, which put the bed, the fountain,
// the drive and the fence one building-length on the far side of the wall, behind the camera's subject.
// The south lawn, which is behind the building from this camera, is the only ground at negative z.
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
  // The North Portico. Width and projection are UNVERIFIED (research-photo.md section 5 item 6) and are set
  // from the photo -- AND THE WIDTH WAS SET 43% TOO WIDE UNTIL THIS PASS, against the file's own comment.
  // The photo's own column centres are u 0.383 and 0.617 (this line has said so all along) which at the
  // portico's depth is +-6.98 m; portico.js places its outer columns at +-(W - 3.2)/2, so W = 17.16. The
  // pediment's base is then 2 * (W/2 + 1.2) = 19.56 m, and the raking cornice's own measured ends are
  // u 0.3333 and 0.6625, which at that depth is 19.6 m -- the internal check the old 24.5 m failed by 7 m
  // (26.9 m of base against the photo's 19.6). The four columns also come out on the building's 4.655 m bay
  // pitch spanning exactly the three central bays, 13.97 m, which is the check the comment claims.
  porticoWidth: 17.16,
  porticoProjection: 6.5, // [estimate] from the 152 - 85.5 = 66.5 ft total for both porticoes, shared
  porticoColumnCount: 4, // weakly sourced (a stock-photo caption); the order, Ionic, is well attested
  porticoColumnHeight: 11.04, // the clear order from the porch floor (2.976 m) to the capital's top at
  // 14.02 m, which is the architrave's own underside. IT IS NOT SIMPLY WHATEVER IS LEFT UNDER THE
  // ENTABLATURE, which is what an earlier note here said: the entablature's underside has its own measured
  // row (the photograph's strongest horizontal edge in the centre of the frame, v 0.4100 = y 13.11 m at the
  // porch's depth) and the capital is set to the value that lands the render's own step nearest it --
  // 14.02, eight pixels off, against thirty-three for the 14.72 this pass first tried. See portico.js
  // PORTICO_HEIGHTS.
  porticoColumnRadius: 0.62, // the shaft at its base. The photograph's own column reads about 0.016 of the
  // frame across at the colonnade's depth, which is 1.2 m, and 9.0 m over 1.24 m is the 7.3-diameter order
  // sheet 76 draws; the previous 0.85 m made a column 5.3 diameters tall, which is a pier.
  porticoEntablature: 1.3, // [estimate] architrave + frieze + cornice
  porticoEntablatureTop: 16.0, // the pediment's base, i.e. the top of the porch's own entablature. SOLVED,
  // not estimated: the photograph's eave row (v 0.3455 at the portico's depth) inverts to 16.00 m. It is
  // carried here as well as in portico.js PORTICO_HEIGHTS because MODEL_LANDMARKS below must project the
  // scene's OWN apex, and layout.js may not import three. The two are the same number and are checked
  // against each other by out/critic/wh3probe.mjs.
  pedimentApex: 17.9, // SOLVED the same way, from the photograph's apex row v 0.3030: 17.90 m at 41.36 m.
  // The previous 15.3 was an [estimate] that read the apex row at the WALL's plane instead of the porch's;
  // this pass first shipped 18.09 from a row read at v 0.2973 and then corrected it to 17.90 when the
  // file's own apex test was applied to both frames (out/critic/wh3defs.mjs). See portico.js
  // PORTICO_HEIGHTS for the arithmetic and for why the rise, not the depth, was what was wrong.
  // The South Portico: a bowed centre with six Ionic columns on a rusticated podium with a double
  // staircase, flat-roofed, no pediment. Column count 6 is INFERRED (research-photo.md section 5 item 5).
  southBowProjection: 6.5,
  southBowRadius: 8.5, // [estimate] the bow's radius in plan, three bays wide
  southColumnCount: 6,
  southPodiumHeight: 5.4, // [estimate] south grade to the portico floor, over the exposed ground storey
  // ---- The north grounds. EVERY z BELOW IS POSITIVE: north of the wall, between the wall and the camera. ----
  // Each distance is the photo row it was measured at, turned into metres by the fitted camera. A point at
  // height y projects to v = 0.5 - (y - eye.y) / (2 tanV dn), dn = eye.z - z being the distance in front of
  // the camera, so the inverse on the LAWN (y = 0) is
  //
  //   dn = 9.086 / (1.08184 (v - 0.5))        z = 47.863 - dn
  //
  // THE PREVIOUS PASS INVERTED THIS TWICE AND BOTH ARE CORRECTED HERE, because the two errors together put
  // every north-ground feature 60 m behind the wall:
  //   * it used the constant 5.647 = (eye.y - TERRACE.baseY) / 1.08184, which is the inverse on the
  //     TERRACE's plane (y = 2.976) and not on the lawn's (y = 0). Every distance came out 1.49x too long.
  //   * it then wrote z = dn - 47.863, which is the far side of the camera. The camera looks along -z from
  //     z = +47.863, so a feature dn metres in front of it is at z = 47.863 - dn.
  // The four row measurements themselves are the photograph's and are unchanged; only their inversion is.
  hedgeTopRow: 0.6180, // the hedge band's top: the same row the wall's base was measured at
  bedFarRow: 0.6744, // the bed's far crest. The ground row at the WALL's foot (z 0, y 0) is v 0.6755, so
  // this row is the terrace's own foot: the bed stands immediately north of the raised ramp, not 15 m out.
  bedNearRow: 0.7350, // the bed's near edge, where the lawn takes over
  fountainRow: 0.6870, // where the bed's own crest cuts the foot of the plume, measured at u 0.5
  fountainPlumeRow: 0.5300, // the plume's top
  // ---- the terrace hedge, the bed and the fountain, from those rows ----
  // A row fixes a PRODUCT of height and depth, so each feature needs its own height stated. The heights are
  // the photograph's own reading of the bed (a mass of red blooms about a metre tall, seen at 40 m from a
  // camera 9 m up) and the bed's near edge is its slope down to 0.50 m.
  hedgeDistance: 3.7, // the planting band's centres, in front of the terrace's face (outerZ below)
  hedgeTopHeight: 3.36, // the hedge's own top, which the row 0.6180 demands at this depth: a crown's top is
  // 1.06 of the run's height in foliage.js, so the run is 3.17 m -- see the note there.
  bedDistance: 5.6, // the bed's FAR edge, from bedFarRow with the bed's 1.20 m crest
  bedDepth: 8.5, // to the near edge, from bedNearRow with the bed's 0.50 m near crest
  bedBloomTo: 10.2, // the BLOOMS' OWN near edge: the photograph's bright red runs from v 0.674 to 0.705 and
  // its rows 0.705-0.733 are the bed's own dark soil and shadow (red covers 0.16 of the row at 0.72 against
  // 0.73 at 0.70). So the bloom mass stops at z +10.2, where its crest of 0.76 m projects to v 0.7045, and
  // the soil body below it carries the dark band to the near edge.
  bedWidth: 46.0, // the red band's own width in the frame: it spans u 0.1025..0.8925 at v 0.70, which is
  // 0.79 of the 57.2 m frame at that row. The bed is nearly as wide as the building and runs past its ends.
  bedCrest: 1.20, // the bloom crest at the far edge, above the lawn
  bedNearCrest: 0.50, // and at the near edge: the bed's own downward slope, as the photograph shows
  fountainDistance: 7.7, // the fountain's axis, from fountainRow: at this z the bed's crest cuts the plume
  fountainBasinRadius: 3.65, // 24 ft across, research-dims.md section 8.4's own [estimate]
  fountainRimHeight: 0.62, // the basin's rounded coping, above the lawn
  fountainWaterHeight: 0.50, // the water in it, below the coping
  fountainJetHeight: 8.09, // the plume's top, from fountainPlumeRow: the jet alone is 7.5 m of water
  // ---- the fence and the drive, both beyond the camera ----
  // THE FENCE IS NOT IN THE PHOTOGRAPH AND MUST NOT BE IN THE FRAME. The photograph shows lawn from the
  // bed's near edge (v 0.735) to the frame's bottom with no fence anywhere, so the fence line has to be
  // BEHIND the camera. Its distance is the sourced one: the derived map measurement is 276 ft (84.3 m) from
  // the north portico's face to the Pennsylvania Avenue fence (research-dims.md section 8.1), which with the
  // portico's face at z +6.5 puts the fence at z +90.8 -- 43 m behind the camera.
  fenceDistance: 90.8, // from the portico's face plus the 84.3 m fence-to-portico measurement
  fenceHeight: 4.0, // 13 ft, reported (not officially confirmed) for the post-2020 fence in this 2024 photo
  fenceWallHeight: 0.9, // [estimate] the sandstone wall the pickets stand in
  fencePicket: 0.022, // 7/8 inch -- NCPC transcript, 7 July 2016, quoted in out/wh/research-dims.md section 8.2
  fenceGap: 0.118, // 4-5/8 inch clear space -- same source
  // The drive: the sourced semicircular access drive that divides the north lawn into three (CLR p.384,
  // quoted in research-dims.md section 8.3). Its chord is the fence line and it bulges towards the building.
  // IT IS PLACED WHERE THE PHOTOGRAPH CANNOT SEE IT, and that is not a convenience: the drive's closest
  // point to the building is the portico apron, and a carriageway crossing the centre line at z +12 would be
  // drawn at v 0.73-0.77, straight across the lawn the photograph shows from v 0.738 to the frame's bottom.
  // At z +40.5 the drive is on the lawn's own rise and projects BELOW the frame's bottom edge (v 1.01 at its
  // inner kerb), which is the only place it can be without contradicting the frame.
  driveCentreZ: 40.5, // the arc's centre line at x = 0, on the north lawn's rise
  driveWidth: 9.0, // [estimate] carriageway, scaled from the sourced ~30 ft
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
//
// IT PROJECTS NORTH, INTO +z, AND ONLY AS FAR AS THE HEDGE ALLOWS. Every z here is the distance north of
// the wall, positive. The terrace's face is INVISIBLE in the frame and must stay so: the photograph's dark
// band runs from the wall's base row (0.6180) down to the bed's far crest (0.6744) and nothing pale is in it.
// Two things hide the terrace: the hedge in front of it, whose crowns reach 4.4 m tall over z 2.1..5.3 (see
// foliage.js), and the bed beyond that. So outerZ is set where the hedge's own crowns stop: at 3.4 -- the
// value the previous pass used -- the crowns' back halves would be buried inside the terrace's stone and the
// terrace's face would stand IN FRONT of the hedge, in the frame, as a pale band 50 px tall.
export const TERRACE = {
  baseY: 2.976, // the wall's own visible base, solved
  outerZ: 2.0, // metres NORTH of the wall: the terrace's face, clear behind the hedge's crowns
  // The old comment here claimed the terrace's outer edge "projects to v 0.6180 -- the row the photograph
  // measures the band's top at -- when the edge stands 3.4 m north of the wall". THE ARITHMETIC WAS WRONG:
  // the terrace's deck is at baseY, i.e. the same height as the wall's base, so its outer edge is ALWAYS
  // below the base's row -- at z 3.4 it projects to v 0.6270, 8 px low, and at z 0 it would be the base row
  // itself. The row 0.6180 is the ray to the wall's own base, and what puts the dark band's top on it is a
  // HEDGE whose top stands on that ray at its own depth: 2.976 + hedge height at the wall, 3.36 m at z 3.7.
  rim: { depth: 0.5, drop: 0.35 }, // the planted slope along the terrace's outer edge: how far it runs back
  // from the edge and how far it drops over that run. Both are [estimate]s, and both are seen at a glance
  // only when the hedge in front of them is missing.
  hedgeZ: 3.7, // the planting band's own centre line, in front of the terrace's face -- see DIMS.hedgeDistance
  hedgeDepth: 0.7, // [estimate]
};

// ---- The north lawn's own rise ----------------------------------------------------------------------
// The camera stands at z = +47.86, 9.086 m above the north grade at the wall. With a photographer's eye at
// 1.60 m, the ground under them was 7.49 m above the wall's grade. The north lawn does rise from the
// building towards Pennsylvania Avenue; this carries that rise as terrain rather than as a floating camera.
//
// THE RISE STARTS AT 30 m, WHICH IS BEYOND EVERY CALIBRATED FEATURE, and that is why the row arithmetic
// above may use the flat plane: the bed ends at z +14.1. The three things the rise therefore does NOT do are
// lift the bed, lift the fountain or hide the frame's foreground -- it puts the camera 7.49 m above the
// grade at the wall, which is what the two facade rows demand.
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
  // ---- the roofscape the photograph shows ABOVE the parapet, sampled for the roofline pass --------------
  // (out/wh/scratch/roofline-probe2.mjs box means; the silhouettes these colours belong to are measured in
  // roofline-probe.mjs and inverted through this file's camera in building.js's roofscape block).
  roofSlope: 0x0b0f16, // the dark roof band over the parapet: box u 0.346-0.364 v 0.372-0.377 mean #0b0f16
  // (98% dark), east box u 0.642-0.657 v 0.372-0.377 mean #080c11 (100% dark) -- the hip's north slope
  // standing in the parapet's own shade, not the roof's material in light
  roofBlock: 0x818d9a, // box u 0.380-0.400 v 0.332-0.350 mean -- the west rooftop block's white face
  blockRecess: 0x586373, // box u 0.3721-0.3775 v 0.343-0.360 mean (54% dark) -- the dark panel in the west
  // block's annex, a recessed door or vent on its north face
  chimneyStack: 0x727b89, // box u 0.330-0.340 v 0.340-0.370 mean -- the west chimney's white stack
  chimneyCap: 0x2f3a4a, // [estimate] the dark equipment on the stacks' tops: the cores read #384268
  // (pixel u 0.3350 v 0.332) and #414b53 (u 0.6700 v 0.334), sky-blended to #445b86/#6a737d at 2-4 px
  flagDark: 0x1d2844, // box u 0.490-0.498 v 0.229-0.242 mean, 77% dark -- the flag is BACKLIT: its own
  // pixels run to #000207 at the core (column u 0.4995, v 0.229-0.241), a near-black navy
  poleDark: 0x25427d, // pixel u 0.4995 v 0.180, the pole's own core -- sky-blended at 2 px; its column
  // runs #25427d..#1c3a80 from v 0.180 to the flag's top at v 0.228
  porchReturn: 0x4a5353, // box u 0.398-0.410 v 0.50-0.53, mean
  underPortico: 0x373932, // box u 0.470-0.530 v 0.44-0.47, mean -- the photo's darkest large area
  porchRecessPigment: 0x313740, // THE WALL BEHIND THE COLONNADE, AND IT IS A PIGMENT AND NOT A SAMPLED HEX.
  // The recess wall was built at `wallUpper` (0x5d6775), which is the north wall's own SHADED band as the
  // photograph samples it where the wall is open to the sky -- and through a colonnade, under an entablature
  // and behind a pediment, it is not: measured at 1200x900 over the photograph's own box for that wall
  // (u 0.470-0.530, v 0.440-0.470, photograph luma 72-77), the render displayed 133.5 after the porch was
  // put in its own shadow. out/critic/wh3pig.mjs then sweeps the pigment in one page and reads the frame at
  // each value: 0x5d6775 -> 133.5, 0x414852 -> 98.4, 0x333940 -> 80.2, 0x292d33 -> 65.0. This hex is the
  // interpolation that lands on 75, the middle of the photograph's own band, and it is stated as an
  // [estimate] in the sense every other hex in this table is not: it is derived from the render, not
  // sampled from the frame, because the frame's own value at that box is what it is being made to match.
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
  hedgeTop: 0x303928, // box u 0.300-0.700 v 0.616-0.632 -- the terrace hedge's own TOP ROW across the
  // facade: mean #3f4b3f, median #303928 (luma 52), p25 #1a220b. A clipped hedge is lit on its top face and
  // near-black in its body, and the two are 20 luma apart in the photograph: the same hedge's band rows
  // (box u 0.300-0.700 v 0.636-0.652) read mean #252b26 and median #0c1006, and its lower band left and
  // right of the fountain (boxes u 0.050-0.280 and u 0.720-0.950 v 0.648-0.680) read mean #191710 and
  // #181812 with median #010400 and #020403. hedge is the body, this is the top.
  flowerBed: 0x8f1c23, // box u 0.30-0.36 v 0.69-0.71, mean
  flowerBedLit: 0xdf4c55, // pixel u 0.260 v 0.680 -- a single bloom catching the light
  // ---- THE BED'S OWN PALETTE, AND THE FACTOR THAT IS IN EVERY ANCHOR -----------------------------------
  // The bed's lattice across ONE row reads `#411f17 #5d2a26 #692827 #752729 #732f28 #79302d #5b2925 #43261f`
  // (out/wh/scratch/meanbox.mjs, 18x18 px boxes -- quoted in grounds.js), a span of #411f17 to #79302d at
  // luma 40 to 69, and those two hexes above are the middle of it and its top. The anchors below are that
  // lattice plus the bed box's own bright quartile, and EVERY ONE OF THEM IS THE LATTICE RAISED BY THE SAME
  // ~1.3x: a bloom head is a nearly-vertical surface facing away from a sun that stands 42 degrees up, so a
  // colour that displays at luma 60 on a horizontal lawn displays about 45 there, and the palette has to be
  // stated in the terms the rig will actually multiply. The factor is measured on the render and the whole
  // palette is scaled once by `BED_GAIN` in grounds.js -- see out/wh/pass-l-handoff.md section 3.
  flowerBedDeep: 0x471b22, // the shadow between the heads: the lattice's #411f17..#5d2a26 pair
  flowerBedShade: 0x6b262b, // the lattice's own dark quartile, #5d2a26
  flowerBedMid: 0x802327, // and its #752729/#732f28 pair
  // THE THREE TONES ABOVE `flowerBed`, and why the photograph's own samples are not enough on their own. The
  // sampled span DISPLAYS at luma 40 to 69 -- but the photograph's own bed box has 36.5% of its area at luma
  // 75 and above, so a bloom head catching the sun is where the frame's brightness comes from. These are that
  // end, read off the bed box's own bright quartile rather than off a single pixel: `flowerBedLit` is already
  // the one sampled lit bloom.
  flowerBedAlt: 0x9b2c31, // the bed box's own p75, luma 94
  flowerBedMidLit: 0xb23a41, // and its p85
  flowerBedLitHigh: 0xdc5560, // and its p95, luma 140
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
  // ---- The two trees that FRAME the frame, sampled from the trees themselves ---------------------------------
  // The previous pass built them at treeFoliage, which is the north tree line's backlit value estimated from
  // two pixels. The framing trees are the largest objects at the frame's edges and they have their own
  // measurements, taken with out/wh/scratch/whbox.mjs on whitehouse.webp (1200x900), box given for each:
  treeMassCore: 0x060806, // box u 0.940-1.000 v 0.44-0.54 -- the EAST framing tree's own core: mean #060806,
  // median #060806, p90 #111211. The photograph's framing trees are very nearly black where the crown is
  // thick, which is what a backlit crown is; this is the darkest large area anywhere in the frame.
  treeMassEdge: 0x1a2017, // box u 0.000-0.100 v 0.34-0.40 -- the WEST tree's crown top band: mean #2f3f59
  // (that mean carries the sky in the box), median #1a2017, p25 #050805. The rim of a crown, where the
  // leaves are thin enough to pass light, is 4 to 8 times the core's own value.
  treeMassLit: 0x2d3628, // box u 0.920-0.960 v 0.34-0.40 -- the EAST tree's upper band: mean #4c586b (sky in
  // the box again), median #2d3628, p25 #0b0e0b. This is the brightest large area either framing tree has,
  // and it is still only luma 50: the sun stands BEHIND these trees, so their light is transmitted, not
  // reflected, and nothing on them is bright.
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
// EVERY z HERE IS POSITIVE ON THE NORTH SIDE. The terrace hedge, the bed, the fountain and the fence are the
// new layout's own numbers, and this table is how they are checked against the photograph's rows.
export const MODEL_LANDMARKS = (() => {
  const pts = {
    // The wall's base is at TERRACE.baseY, not at y = 0: the terrace and the hedge stand in front of
    // everything below it, which is why the photo's base row is 214 px below the parapet and not 254.
    'wall west corner': { x: -DIMS.blockLength / 2, y: TERRACE.baseY, z: 0 },
    'wall east corner': { x: DIMS.blockLength / 2, y: TERRACE.baseY, z: 0 },
    'wall base centre': { x: 0, y: TERRACE.baseY, z: 0 },
    'terrace face at the lawn': { x: 0, y: 0, z: TERRACE.outerZ },
    'terrace hedge top': { x: 0, y: DIMS.hedgeTopHeight, z: TERRACE.hedgeZ },
    'parapet centre': { x: 0, y: DIMS.northFacade, z: 0 },
    'parapet west wing': { x: -19.2, y: DIMS.northFacade, z: 0 },
    'parapet east wing': { x: 19.2, y: DIMS.northFacade, z: 0 },
    'portico west column': { x: -DIMS.porticoWidth / 2 + 1.55, y: TERRACE.baseY + 0.32, z: DIMS.porticoProjection - 1.1 },
    'portico east column': { x: DIMS.porticoWidth / 2 - 1.55, y: TERRACE.baseY + 0.32, z: DIMS.porticoProjection - 1.1 },
    'pediment apex': { x: 0, y: DIMS.pedimentApex, z: DIMS.porticoProjection },
    'bed far edge': { x: 0, y: DIMS.bedCrest, z: DIMS.bedDistance },
    'bed near edge': { x: 0, y: DIMS.bedNearCrest, z: DIMS.bedDistance + DIMS.bedDepth },
    'fountain water': { x: 0, y: DIMS.fountainWaterHeight, z: DIMS.fountainDistance },
    'fountain jet top': { x: 0, y: DIMS.fountainJetHeight, z: DIMS.fountainDistance },
    'fence top': { x: 0, y: DIMS.fenceHeight, z: DIMS.fenceDistance },
  };
  const out = {};
  for (const [name, p] of Object.entries(pts)) {
    const { u, v, depth } = worldToUV(p);
    out[name] = { u: Math.round(u * 10000) / 10000, v: Math.round(v * 10000) / 10000, depth: Math.round(depth * 100) / 100 };
  }
  return out;
})();
