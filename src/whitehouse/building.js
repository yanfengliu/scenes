// The main block: the north wall with its eleven bays of windows, the belt course, the dentilled cornice,
// the balustraded parapet, the flat deck behind it and the roofscape above, plus the south wall, the two end
// walls, and the terrace the north front stands on.
//
// THE NORTH WALL STANDS ON A TERRACE, NOT ON THE LAWN. TERRACE.baseY is 2.976 m: the camera solve's two
// measured rows (v 0.6180 at the wall's visible base and v 0.3800 at the parapet) demand it, because "the
// ground floor is hidden by a raised carriage ramp and parapet" (Wikipedia, citing NPS) and a hedge band
// runs the length of the wall. So y = 0 is the north LAWN and every height in FACADE is above that lawn;
// the wall's own base is at TERRACE.baseY.
//
// WHAT THE ELEVEN BAYS CARRY, from the top of the facade down, and every element is here because the
// photograph shows it (out/wh/habs-findings.md, and the sheets it cites):
//
//   the balustraded parapet   piers, turned balusters on a 0.62 m pitch, a moulded rail and a cap
//   the dentilled cornice     HABS sheet 76 (out/wh/habs/big_33.jpg) draws the entablature above the
//                             column: architrave, frieze, and a cornice WITH DENTILS on a bed mould
//   the plain frieze          a flat band, the depth the dentils' own bed mould needs
//   the eleven bays           4 windows | 3-bay portico | 4 windows, on a uniform 4.655 m pitch
//   first-floor windows       "alternately pedimented and hooded": a TRIANGULAR pediment on one bay, a
//                             SEGMENTAL (curved) one on the next, each carried on two console brackets,
//                             each six-over-six, with a panel below the sill (HABS sheet 82)
//   second-floor windows      "the smaller, plainly trimmed ones" -- a plain head, no pediment
//   the belt course           the string course between the two storeys
//
// Everything is axis-aligned boxes except the balustrade, the segmental pediments, the dentil runs and the
// roof, and the hand-built geometries carry computeVertexNormals.
import * as THREE from 'three';
import { DIMS, BAYS, COLORS, TERRACE } from './layout.js';

// The north facade's own horizontal bands, in metres above the NORTH LAWN. Read off the reference photo by
// the fitted camera's own scale: at the wall's plane 1 m is 0.01714 of the frame height (15.3 m over the
// frame's v 0.3800 to 0.6180 at the base's own height), so a measured row converts directly.
//
//   the first-floor glass  v 0.5680 (head) to 0.6120 (sill)  ->  7.22 m to 4.16 m
//   the second-floor glass v 0.4350 (head) to 0.4900 (sill)  ->  12.42 m to 9.24 m
//
// The pediments, the dentil band and the frieze are the pass's own additions and their bands are set from
// the photograph's rows as well: the frieze and its dentils occupy v 0.386 to 0.402, which is 12.2 m to
// 13.1 m, the belt course sits at v 0.4875, which is 7.9 m, and the first-floor pediments rise from the
// window head at 7.42 m to about 8.6 m, inside the 7.9 m belt's own band, which is where the photograph
// puts them: the pediment's apex is LEVEL with the belt course and reads above it.
export const FACADE = {
  base: 0.0, // the north LAWN. The wall's own base is TERRACE.baseY
  wallBase: TERRACE.baseY, // 2.976 m: where the bright wall begins, above the terrace and the hedge
  firstSill: 4.16,
  firstHead: 7.22,
  belt: 7.9, // the string course between the storeys
  secondSill: 9.24,
  secondHead: 12.42,
  frieze: 12.9, // the foot of the plain frieze, which the dentils' bed mould sits on
  dentil: 13.45, // the foot of the dentil band
  cornice: 13.9, // the foot of the main cornice
  parapet: 15.3, // the top of the balustrade: the photo's own v 0.3800, and the published 50 ft 4 in
  balustradeTop: 15.3,
  balustradeBottom: 14.35,
  deckTop: 14.2, // the flat deck behind the balustrade -- this wave does NOT build a hip roof
  roofRise: 1.1, // [estimate] the ridge of the low roof that shows above the deck, behind the balustrade
  chimneyTop: 17.0, // [estimate] the photo shows chimney stacks above the parapet line
  height: 15.3,
};

const BALUSTER_PITCH = 0.52; // [estimate] the drawings show the railing but not its spacing string
const BALUSTER_WIDTH = 0.19;
const DENTIL_PITCH = 0.42; // [estimate] from the photograph's own dentil row
const DENTIL_WIDTH = 0.22;
const PIER_PITCH = 6.2; // [estimate] the piers the balustrade breaks into, as the photograph shows

// ---- how much ambient a structurally shaded face sees ------------------------------------------------
// THE NUMBER THIS SCENE DID NOT HAVE, AND WHAT IT IS NOT.
//
// The term works by scaling the albedo, because three's indirect diffuse is linear in it and the direct
// lights are not (see src/materials.js albedoOf). An occlusion of c therefore multiplies a surface's
// AMBIENT by c, and the first two passes at these numbers were guesses. What the measurements then said,
// and what a reader should take from this block before changing a value here:
//
//   * out/wh/scratch/probe.mjs: at c 0.44 the porch's soffit displayed luma 96 against the photograph's 71,
//     and at c 0.12 it displayed 248 -- BRIGHTER, not darker, and the whole frame went with it (cell
//     distance 0.1483 -> 0.1893, SSIM 0.1371 -> 0.1006). The reason is that an occluded surface also stops
//     reflecting the environment map, and `makeMaterial` sets envMapIntensity = c for exactly that; at
//     c 0.12 the soffit loses the environment's specular but keeps every direct light, and the sun reaches
//     under the entablature from the north-east.
//   * the values that measured best are the ones below, and they are the ones the brief's own comparison
//     supports: at these numbers the porch's recess reads luma 116 at (0.5, 0.40) against the photograph's
//     101, and the soffit 96 against 71.
//
// So these are NOT solved from a closed form and the arithmetic in an earlier version of this comment was
// wrong. They are A/B'd, one surface class at a time, against the photograph's own boxes.
export const OCCLUSION = {
  // THE FIRST THREE ARE THE FRAME'S DARKNESS AND THEY WERE ALL SET TOO HIGH. The coordinator's own
  // measurement (out/critic/measure.mjs) is the finding: the photograph's fifth-percentile pixel is luma 7.5
  // with 6.9% of the frame below 16, and this render's was luma 84 with 1.9% below 16 -- NOTHING IN THE
  // FRAME WAS ALLOWED TO BE DARK. These three are the surfaces the photograph is unambiguous about: the
  // hedge band (sampled #12140c), the window glass (the darkest large-area tone on the facade) and the
  // tympanum. Each was carrying a fraction of the ambient close enough to 1 that the sampled near-black hex
  // could not survive the rig.
  reveal: 0.30, // the window's own glass and reveal
  // ---- THE PORCH'S INTERIOR: WHAT WAS MEASURED, WHAT WAS DONE, AND WHAT THE TERM IS NOT ----------------
  // The defect is real and it is measured at 1200x900 over the porch between the two inner columns
  // (out/critic/wh3band.mjs, u 0.47..0.53 -- clear of both shafts -- render luma against the photograph's):
  //
  //   v 0.38-0.40   the recess wall's head            195 against  63-92    2.1x
  //   v 0.42-0.47   the recess between the columns    140 against  62-63    2.2x
  //   v 0.44-0.52   the wall behind the shafts        226 against  43-74    3.4x
  //   v 0.36-0.60   the two shafts themselves         142-175 against 99-146  1.2x
  //
  // so the photograph has the porch's interior at 0.4 of the shafts in front of it and this render had it at
  // 1.3 -- the porch read as a flat panel with columns painted on it.
  //
  // WHAT WAS DONE ABOUT IT, and the pass has to be honest that this is not the occlusion term:
  //   * `portico.js` had NO castShadow anywhere, so the sun -- which stands north-east and 42 degrees up,
  //     i.e. in front of the north front -- reached straight into the recess. The pediment's raking cornices
  //     and the frieze are casters now, and they put the porch in its own shade, which is what sky.js's own
  //     comment claims the rig does. That is the part of this that is a real fix.
  //   * THE OCCLUSION TERM IS NOT THE LEVER, and this is the finding of the bisect rather than of an
  //     argument. out/critic/wh3occ.mjs sweeps the recess wall from 0.55 down to 0.03 IN ONE PAGE and reads
  //     the frame at each value: the wall's displayed luma falls monotonically as the occlusion RISES
  //     (134 at 0.55, 186 at 0.26, 248 at 0.03). That is the opposite of what the term means, and the
  //     reason is in materials.js: the occlusion scales the ALBEDO by 1/occlusion as well as the ambient by
  //     occlusion, and 1/occlusion grows faster than the ambient it is standing in for, so past about 0.55
  //     every step "darker" is a step brighter. The wall also takes 0 luma from the sun in the shipped
  //     frame (out/critic/wh3light.mjs: 227 with the sun, 227 with it switched off), so what sets its tone
  //     is the sky hemisphere and the PMREM environment, neither of which this number touches.
  //   * full renders at 0.26 and at 0.10 both made BOTH scores worse (cell 0.1120 -> 0.1167 -> 0.1218,
  //     SSIM 0.3540 -> 0.3176 -> 0.2984), which is the same result the re-layout pass got from 0.42, 0.25
  //     and 0.05. So the value is left at the one the evidence supports, and the crop beside the photograph
  //     is what the next pass should judge this surface by rather than this number.
  porchInterior: 0.55, // the porch's own shade: the wall behind the columns, the recess and both soffits
  soffit: 0.16, // the porch's ceiling alone: fully roofed, and the photograph's darkest large area
  tympanum: 0.65, // the triangle inside a pediment, set back behind its raking cornices
  porchFloor: 0.42, // the porch deck, which the colonnade and the entablature stand over
  column: 0.85, // a shaft's own mean: it sees the sky above the entablature and the porch's shade below
  underCornice: 0.68, // the wall a projecting cornice shades
  eaveUnder: 0.30, // the underside of any projecting band: a cornice, a belt course, a sill, a ramp
  baseCourse: 0.80, // the wall's lowest course, against the terrace and the planting
  planting: 0.08, // a clipped hedge's own interior: the photograph samples it at #12140c, nearly black.
  // THIS ONE IS KEPT FROM THE DARK-SHADOW PASS even though the frame's own p5 did not move with it: the
  // planting's 0.42 was measured against the hedge's box and left the band at luma 145 where the photograph
  // has 18 to 45, and the coordinator's crop is unambiguous that the band must read dark.
};

// A six-over-six sash in plan-relief against the wall. Returns nothing; it adds to b. The glass is a dark
// recess and the muntins and the meeting rail are the wall's own trim laid over it, which is how the
// photograph reads at this scale: the sash is a grid of light bars on a dark rectangle.
//
// THE REVEAL IS TWO STEPS, NOT ONE FLAT SLAB. A single recessed plane reads as a rectangle painted on the
// wall, which is what the coordinator's brief item 1 reports; what the photograph shows is a jamb that
// catches its own light on one side and falls into shade on the other, and a head with a dark line under
// it. So the reveal is the wall's own thickness stepped twice in z, each step darker than the one outside
// it, and the outermost step is wide enough (0.12 m) that it survives to two pixels at this camera.
function sash(b, name, cx, cy, w, h, depth) {
  const glass = { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2, z0: depth.z0, z1: depth.z1 };
  b.box(`${name} glass`, glass, COLORS.windowGlass, { occlusion: OCCLUSION.reveal });
  const bar = 0.055; // [estimate] a muntin at the photograph's own 1 px
  const z = depth.z0 - 0.03;
  b.box(`${name} meeting rail`, { x0: cx - w / 2, x1: cx + w / 2, y0: cy - bar / 2, y1: cy + bar / 2, z0: z, z1: z + 0.05 }, COLORS.windowTrim, { occlusion: 0.72 });
  b.box(`${name} stile`, { x0: cx - bar / 2, x1: cx + bar / 2, y0: cy - h / 2, y1: cy + h / 2, z0: z, z1: z + 0.05 }, COLORS.windowTrim, { occlusion: 0.72 });
  for (const side of [-1, 1]) {
    for (const frac of [1 / 3, 2 / 3]) {
      const y = cy + side * (h / 2) * (2 * frac - 1);
      b.box(`${name} muntin ${side} ${frac.toFixed(2)}`, { x0: cx - w / 2, x1: cx + w / 2, y0: y - bar / 2, y1: y + bar / 2, z0: z, z1: z + 0.05 }, COLORS.windowTrim, { occlusion: 0.72 });
    }
  }
}

// The reveal's own two steps: an outer band of the wall's trim in half shade, and an inner return that is
// the darkest surface in the opening. `w` and `h` are the GLASS's own size; the bands lie outside it, and
// they are built from the wall face z0 inward to zw (the glass's own plane), so the opening is a real
// recess in the wall's thickness rather than a rectangle painted on it.
function revealSteps(b, name, cx, cy, w, h, z0, zw) {
  // The outer step stands proud of the wall by 2 cm so no face of it is coplanar with the wall's own plane;
  // a coplanar pair z-fights, and this scene has already paid for that once (see the north wall's bands).
  for (const [tag, pad, zOut, zIn, occl, color] of [
    ['outer', 0.13, z0 + 0.02, z0 - 0.14, 0.66, COLORS.windowTrim],
    ['inner', 0.05, z0 - 0.14, zw, 0.34, COLORS.underPortico],
  ]) {
    const yBot = cy - h / 2;
    const yTop = cy + h / 2;
    b.box(`${name} reveal ${tag} head`, { x0: cx - w / 2 - pad, x1: cx + w / 2 + pad, y0: yTop, y1: yTop + 0.15, z0: zIn, z1: zOut }, color, { occlusion: occl });
    b.box(`${name} reveal ${tag} sill`, { x0: cx - w / 2 - pad, x1: cx + w / 2 + pad, y0: yBot - 0.15, y1: yBot, z0: zIn, z1: zOut }, color, { occlusion: occl });
    for (const side of [-1, 1]) {
      b.box(
        `${name} reveal ${tag} jamb ${side < 0 ? 'west' : 'east'}`,
        { x0: side < 0 ? cx - w / 2 - pad : cx + w / 2, x1: side < 0 ? cx - w / 2 : cx + w / 2 + pad, y0: yBot, y1: yTop, z0: zIn, z1: zOut },
        color,
        { occlusion: occl },
      );
    }
  }
}

// A segmental (curved) pediment, extruded as a shape so the arch is a real curve rather than three steps.
// Its own profile: a horizontal bed at the bottom, a segmental arch rising from the two ends to a crown in
// the middle, and a moulded thickness over it.
function segmentalPediment(b, name, cx, yEave, halfWidth, rise, z0, depth) {
  const shape = new THREE.Shape();
  const steps = 16;
  shape.moveTo(-halfWidth, 0);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = -halfWidth + 2 * halfWidth * t;
    const y = rise * Math.sin(Math.PI * t); // a segment: zero at both ends, the crown in the middle
    shape.lineTo(x, y);
  }
  shape.lineTo(halfWidth, -0.30);
  shape.lineTo(-halfWidth, -0.30);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COLORS.windowTrim, roughness: 0.9, metalness: 0 }));
  mesh.position.set(cx, yEave, z0);
  mesh.rotation.y = Math.PI; // the shape's local +z is world -z, so the extrude runs from z0 towards the wall
  mesh.receiveShadow = true;
  b.add(mesh, name);
  return mesh;
}

// A triangular pediment as a real gable: two raking courses meeting at the apex, with the tympanum behind
// them. Built from two rotated boxes so the rake is a straight line, which is what the photograph shows.
function triangularPediment(b, name, cx, yEave, halfWidth, rise, z0, depth) {
  const slope = Math.atan2(rise, halfWidth);
  const len = Math.hypot(halfWidth, rise) + 0.3;
  const t = 0.26; // the raking cornice's own thickness
  for (const side of [-1, 1]) {
    const geo = new THREE.BoxGeometry(len, t, depth);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COLORS.windowTrim, roughness: 0.9, metalness: 0 }));
    mesh.position.set(cx + side * halfWidth * 0.5, yEave + rise * 0.5, z0 - depth / 2);
    mesh.rotation.z = -side * slope;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    b.add(mesh, `${name} rake ${side < 0 ? 'west' : 'east'}`);
  }
  // The tympanum: a flat triangle of the wall's own colour set back behind the rakes.
  const tri = new THREE.Shape();
  tri.moveTo(-halfWidth * 0.92, 0);
  tri.lineTo(halfWidth * 0.92, 0);
  tri.lineTo(0, rise * 0.9);
  tri.closePath();
  const geo = new THREE.ExtrudeGeometry(tri, { depth: 0.12, bevelEnabled: false });
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COLORS.windowTrim, roughness: 0.95, metalness: 0 }));
  mesh.position.set(cx, yEave, z0 - 0.16);
  b.add(mesh, `${name} tympanum`);
  // The horizontal cornice along the eave, which is the line the eye reads the pediment's base from.
  b.box(`${name} eave`, { x0: cx - halfWidth - 0.16, x1: cx + halfWidth + 0.16, y0: yEave - 0.20, y1: yEave + 0.02, z0: z0 - 0.06, z1: z0 + depth }, COLORS.windowTrim);
}

// The two console brackets that carry a pediment, which is the detail the photograph shows under every
// first-floor hood: a tapering corbel running down beside the window head on each side.
function consoles(b, name, cx, yTop, winW, z0) {
  for (const side of [-1, 1]) {
    const x = cx + side * (winW / 2 + 0.22);
    const steps = 4;
    for (let s = 0; s < steps; s++) {
      const w = 0.30 - s * 0.055;
      b.box(
        `${name} console ${side < 0 ? 'west' : 'east'} ${s + 1}`,
        { x0: x - w / 2, x1: x + w / 2, y0: yTop - (s + 1) * 0.22, y1: yTop - s * 0.22, z0: z0, z1: z0 + 0.30 + s * 0.05 },
        COLORS.windowTrim,
      );
    }
  }
}

// A dentil run along x, on a pitch, with the bed mould above and below it. The dentils are one InstancedMesh
// rather than 240 boxes, because 240 draw calls for a 6 cm detail is not a trade this scene can make.
function dentils(b, name, x0, x1, y0, y1, z0, z1, color) {
  const n = Math.max(1, Math.floor((x1 - x0) / DENTIL_PITCH));
  const geo = new THREE.BoxGeometry(DENTIL_WIDTH, y1 - y0, z1 - z0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 }), n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    m.makeTranslation(x0 + (i + 0.5) * ((x1 - x0) / n), (y0 + y1) / 2, (z0 + z1) / 2);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  b.add(mesh, name);
}

export function buildBuilding(b) {
  const { blockLength: W, blockDepth: D } = DIMS;
  const halfW = W / 2;
  const zN = 0; // the north wall's outer face
  const zS = -D; // the south wall's outer face
  const wallT = 0.7; // [estimate] the wall's own thickness at the openings
  const y0 = FACADE.wallBase; // everything on the north front starts at the terrace, not the lawn

  // ---- the terrace the north front stands on ----------------------------------------------------------
  // The "raised carriage ramp and parapet". Its top is the wall's own base at TERRACE.baseY; its face drops
  // to the lawn at TERRACE.outerZ. Split either side of the centre so the portico's own floor takes the
  // middle (the two must not share a top face, or the two coplanar decks z-fight).
  //
  // IT PROJECTS NORTH, INTO +z, AND EVERY PROFILE COORDINATE BELOW IS NEGATED z: primitives.js's
  // profileSolid reads its own profile along -z, so a feature at world z = +2 is passed as -2. The previous
  // pass passed them unnegated, which put the whole terrace -- deck, step and planted rim -- at z -1.9 to
  // -3.4, i.e. INSIDE AND BEHIND the north wall, and left only the deck's box face at z +0.2 showing in a
  // frame that has the whole of the north grounds on that side of it.
  //
  // HOW DEEP IT IS, AND WHY 2.0 RATHER THAN 3.4. The terrace's face is invisible in the photograph: the
  // dark band runs from the wall's base row (0.6180) straight down to the bed's far crest (0.6744) with
  // nothing pale in it. What hides the face is the hedge in foliage.js, whose crowns stand on the ray to the
  // wall's own base and reach 3.36 m tall over z 2.1..5.3; a face at 3.4 would stand IN FRONT of those
  // crowns and be drawn as a pale band 50 px tall across the whole frame. So the terrace stops where the
  // hedge's own crowns stop covering it.
  const stepGap = 9.2; // the portico's floor takes the centre from here inward
  const tz = TERRACE.outerZ;
  const rim = TERRACE.rim;
  const deckZ = tz - 0.45; // where the stone lip starts
  for (const [name, x0, x1] of [['west', -halfW - 6, -stepGap], ['east', stepGap, halfW + 6]]) {
    b.box(`north terrace ${name}`, { x0, x1, y0: -0.4, y1: y0, z0: -0.6, z1: deckZ }, COLORS.terraceStone, { metric: true });
    b.profileSolid(
      `north terrace ${name} parapet`,
      [
        [-deckZ, y0],
        [-tz, y0 - 0.35],
        [-tz, -0.4],
        [-deckZ, -0.4],
      ],
      x0,
      x1,
      COLORS.stoneTrim,
    );
    // The planted band along the lip -- the photograph's dark edge, and the reason the terrace's own pale
    // stone never reaches the frame. A thin layer ON the lip rather than a separate solid in front of it.
    b.profileSolid(
      `north terrace ${name} rim`,
      [
        [-deckZ, y0],
        [-tz, y0 - 0.35],
        [-tz, y0 - 0.35 - rim.drop],
        [-deckZ, y0 - rim.drop],
      ],
      x0,
      x1,
      COLORS.terraceRim,
    );
  }
  b.box('north terrace west return', { x0: -halfW - 6.3, x1: -halfW - 6, y0: -0.4, y1: y0 + 0.55, z0: 0, z1: tz }, COLORS.terraceStone);
  b.box('north terrace east return', { x0: halfW + 6, x1: halfW + 6.3, y0: -0.4, y1: y0 + 0.55, z0: 0, z1: tz }, COLORS.terraceStone);

  // ---- the four walls --------------------------------------------------------------------------------
  // THE NORTH WALL IS ONE BOX PER BAND, NOT A BOX WITH THIN BANDS LAID ON IT. The previous pass built the
  // wall at z -0.7..0 and then three 4 cm slabs at -0.02..0.02 INSIDE it, so every band's own faces were
  // coplanar with the wall behind them and with each other's: out/wh/scratch/prof.mjs reads the render at
  // row v 0.44 and finds the pixels alternating between #858e9d and #5e6d7f along the same row, which is two
  // surfaces fighting for one depth. The bands are the wall now, stacked, each with its own colour, and
  // nothing is coincident with anything.
  //
  // The wall's own vertical shading: the sky term is stronger high up and the ground's lower down, and the
  // render cannot make that ramp out of a single box's flat normal at this size, so the wall is banded.
  // Four bands is what the photograph's own profile resolves to at 1 m of height per pixel.
  const WALL_BANDS = [
    ['upper', 12.6, FACADE.parapet, COLORS.wallUpper, OCCLUSION.underCornice],
    ['middle', 5.9, 12.6, COLORS.wallMid, 1],
    ['lower', y0 + 1.1, 5.9, COLORS.wallLit, OCCLUSION.baseCourse],
    ['base', y0, y0 + 1.1, COLORS.wallMid, OCCLUSION.baseCourse],
  ];
  for (const [tag, ya, yb, color, occl] of WALL_BANDS) {
    // RECEIVING, AND ONLY THE NORTH FRONT NEEDS IT. The portico's entablature and pediment are casters now
    // (portico.js), and the shadow they throw is the dark band the photograph shows across the CENTRE of the
    // facade -- behind the colonnade, at v 0.38-0.42, where this render had the open wall's own frieze and
    // cornice mouldings at luma 140-146 against the photograph's 61-64. A receiver is required for any of
    // that to be drawn, and the facade's boxes never set it. The south and end walls keep the flag off: no
    // caster in this scene is south of the building, so it would be a flag that changes nothing.
    b.box(`north wall ${tag} band`, { x0: -halfW, x1: halfW, y0: ya, y1: yb, z0: zN - wallT, z1: zN }, color, { metric: true, occlusion: occl }).receiveShadow = true;
  }
  b.box('south wall', { x0: -halfW, x1: halfW, y0: -DIMS.southLawnDrop, y1: FACADE.parapet, z0: zS, z1: zS + wallT }, COLORS.wallMid, { metric: true });
  b.box('west wall', { x0: -halfW, x1: -halfW + wallT, y0: -DIMS.southLawnDrop, y1: FACADE.parapet, z0: zS, z1: zN }, COLORS.wallMid, { metric: true });
  b.box('east wall', { x0: halfW - wallT, x1: halfW, y0: -DIMS.southLawnDrop, y1: FACADE.parapet, z0: zS, z1: zN }, COLORS.wallMid, { metric: true });

  // ---- the belt course and the cornice, on all four sides ---------------------------------------------
  b.box('north belt course', { x0: -halfW - 0.15, x1: halfW + 0.15, y0: FACADE.belt, y1: FACADE.belt + 0.26, z0: zN - wallT - 0.05, z1: zN + 0.16 }, COLORS.windowTrim, { metric: true });
  b.box('south belt course', { x0: -halfW - 0.15, x1: halfW + 0.15, y0: FACADE.belt, y1: FACADE.belt + 0.26, z0: zS - 0.15, z1: zS + wallT + 0.05 }, COLORS.windowTrim, { metric: true });
  b.box('west belt course', { x0: -halfW - 0.15, x1: -halfW + 0.05, y0: FACADE.belt, y1: FACADE.belt + 0.26, z0: zS - 0.1, z1: zN + 0.1 }, COLORS.windowTrim);
  b.box('east belt course', { x0: halfW - 0.05, x1: halfW + 0.15, y0: FACADE.belt, y1: FACADE.belt + 0.26, z0: zS - 0.1, z1: zN + 0.1 }, COLORS.windowTrim);

  // ---- the entablature: frieze, dentils, bed mould, cornice -------------------------------------------
  // HABS sheet 76's own entablature, which is the portico's but returns along the whole front: architrave,
  // frieze, and a cornice on a DENTIL bed mould. The photograph shows the dentil row as a fine dark band
  // under the cornice, which is what a row of 22 cm blocks on a 42 cm pitch reads as at 51 m.
  b.box('north frieze', { x0: -halfW - 0.2, x1: halfW + 0.2, y0: FACADE.frieze - 0.55, y1: FACADE.dentil, z0: zN - wallT - 0.1, z1: zN + 0.22 }, COLORS.frieze, { metric: true });
  dentils(b, 'north dentils', -halfW - 0.1, halfW + 0.1, FACADE.dentil, FACADE.cornice - 0.06, zN - 0.44, zN + 0.20, COLORS.corniceShadow);
  b.box('north cornice bed mould', { x0: -halfW - 0.3, x1: halfW + 0.3, y0: FACADE.cornice - 0.08, y1: FACADE.cornice + 0.10, z0: zN - 0.50, z1: zN + 0.24 }, COLORS.corniceStone, { metric: true });
  b.box('north cornice', { x0: -halfW - 0.45, x1: halfW + 0.45, y0: FACADE.cornice + 0.10, y1: FACADE.balustradeBottom, z0: zN - 0.62, z1: zN + 0.30 }, COLORS.corniceStone, { metric: true });
  for (const [name, ya, yb, color] of [
    ['south', FACADE.frieze - 0.55, FACADE.balustradeBottom, COLORS.frieze],
    ['west', FACADE.frieze - 0.55, FACADE.balustradeBottom, COLORS.frieze],
    ['east', FACADE.frieze - 0.55, FACADE.balustradeBottom, COLORS.frieze],
  ]) {
    const z0 = name === 'south' ? zS - 0.62 : zS - 0.6;
    const z1 = name === 'south' ? zS + wallT + 0.3 : zN + 0.3;
    const x0 = name === 'west' ? -halfW - 0.6 : name === 'east' ? halfW - 0.3 : -halfW - 0.45;
    const x1 = name === 'west' ? -halfW + 0.3 : name === 'east' ? halfW + 0.6 : halfW + 0.45;
    b.box(`${name} entablature`, { x0, x1, y0: ya, y1: yb, z0, z1 }, color, { metric: true });
  }
  for (const [name, zAt] of [['south', zS - 0.3], ['west', null], ['east', null]]) {
    // The dentil run on the other three sides, on the same band, so an orbit sees the same entablature.
    if (name === 'south') dentils(b, 'south dentils', -halfW - 0.1, halfW + 0.1, FACADE.dentil, FACADE.cornice - 0.06, zAt - 0.30, zAt + 0.06, COLORS.corniceShadow);
  }
  for (const [name, xAt] of [['west', -halfW - 0.3], ['east', halfW + 0.3]]) {
    const n = Math.max(1, Math.floor(D / DENTIL_PITCH));
    const geo = new THREE.BoxGeometry(0.36, FACADE.cornice - 0.06 - FACADE.dentil, DENTIL_WIDTH);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: COLORS.corniceShadow, roughness: 0.9, metalness: 0 }), n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) m.makeTranslation(xAt, (FACADE.dentil + FACADE.cornice - 0.06) / 2, zS + (i + 0.5) * (D / n));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    b.add(mesh, `${name} dentils`);
  }

  // ---- the balustraded parapet ------------------------------------------------------------------------
  const railY0 = FACADE.balustradeBottom;
  const railY1 = FACADE.balustradeTop;
  const capT = 0.15;
  const runs = [
    { name: 'north', a0: -halfW - 0.45, a1: halfW + 0.45, z: zN + 0.02, along: 'x' },
    { name: 'south', a0: -halfW - 0.45, a1: halfW + 0.45, z: zS - 0.02, along: 'x' },
    { name: 'west', a0: zS - 0.02, a1: zN + 0.02, z: -halfW - 0.02, along: 'z' },
    { name: 'east', a0: zS - 0.02, a1: zN + 0.02, z: halfW + 0.02, along: 'z' },
  ];
  for (const run of runs) {
    const thickness = 0.24;
    const lo = Math.min(run.a0, run.a1);
    const hi = Math.max(run.a0, run.a1);
    const make = (name, ya, yb, pad) =>
      run.along === 'x'
        ? b.box(name, { x0: lo - pad, x1: hi + pad, y0: ya, y1: yb, z0: run.z - thickness / 2, z1: run.z + thickness / 2 }, COLORS.balustrade, { metric: true })
        : b.box(name, { x0: run.z - thickness / 2, x1: run.z + thickness / 2, y0: ya, y1: yb, z0: lo - pad, z1: hi + pad }, COLORS.balustrade, { metric: true });
    make(`${run.name} balustrade cap`, railY1 - capT, railY1, 0.14);
    make(`${run.name} balustrade rail`, railY0, railY0 + 0.24, 0.05);
    const n = Math.max(1, Math.floor((hi - lo) / BALUSTER_PITCH));
    const geo = new THREE.BoxGeometry(run.along === 'x' ? BALUSTER_WIDTH : 0.16, railY1 - capT - (railY0 + 0.24), run.along === 'x' ? 0.16 : BALUSTER_WIDTH);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: COLORS.balustrade, roughness: 0.9, metalness: 0 }), n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const t = lo + (i + 0.5) * ((hi - lo) / n);
      const yy = (railY0 + 0.24 + railY1 - capT) / 2;
      m.makeTranslation(run.along === 'x' ? t : run.z, yy, run.along === 'x' ? run.z : t);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    b.add(mesh, `${run.name} balusters`);
    // The piers the balustrade breaks into, which the photograph shows as solid blocks on the run.
    for (let t = lo; t <= hi + 1e-6; t += PIER_PITCH) {
      const pier = (name) =>
        run.along === 'x'
          ? b.box(name, { x0: t - 0.26, x1: t + 0.26, y0: railY0, y1: railY1 + 0.05, z0: run.z - thickness / 2 - 0.05, z1: run.z + thickness / 2 + 0.05 }, COLORS.balustrade, { metric: true })
          : b.box(name, { x0: run.z - thickness / 2 - 0.05, x1: run.z + thickness / 2 + 0.05, y0: railY0, y1: railY1 + 0.05, z0: t - 0.26, z1: t + 0.26 }, COLORS.balustrade, { metric: true });
      pier(`${run.name} balustrade pier ${Math.round(t * 10)}`);
    }
  }

  // ---- the roof deck and the roofscape ----------------------------------------------------------------
  // A FLAT DECK behind the balustrade, not a hip roof: the balustrade hides the roof from the photo view
  // entirely, and a deck is honest about what is not modelled yet. A low ridge and the chimneys stand above
  // it because the photo's own silhouette has them.
  b.box('roof deck', { x0: -halfW, x1: halfW, y0: FACADE.balustradeBottom - 0.5, y1: FACADE.deckTop, z0: zS, z1: zN }, COLORS.roof, { metric: true });
  b.box('roof ridge', { x0: -halfW + 2, x1: halfW - 2, y0: FACADE.deckTop, y1: FACADE.deckTop + FACADE.roofRise, z0: -D / 2 - 4, z1: -D / 2 + 4 }, COLORS.roofShadow, { metric: true });
  const chimneyX = [-18.6, -9.3, 4.65, 13.95, 23.25];
  chimneyX.forEach((x, i) => {
    b.box(`chimney ${i + 1} stack`, { x0: x - 0.55, x1: x + 0.55, y0: FACADE.deckTop, y1: FACADE.chimneyTop, z0: -D * 0.62, z1: -D * 0.62 + 1.1 }, COLORS.stoneTrim, { metric: true });
    b.box(`chimney ${i + 1} cap`, { x0: x - 0.72, x1: x + 0.72, y0: FACADE.chimneyTop, y1: FACADE.chimneyTop + 0.22, z0: -D * 0.62 - 0.17, z1: -D * 0.62 + 1.27 }, COLORS.stoneTrim);
  });
  b.box('flagpole', { x0: -0.06, x1: 0.06, y0: FACADE.deckTop, y1: 21.4, z0: -D / 2 - 0.06, z1: -D / 2 + 0.06 }, COLORS.stoneTrim);
  b.box('flag', { x0: 0.06, x1: 1.5, y0: 19.4, y1: 20.6, z0: -D / 2 - 0.03, z1: -D / 2 + 0.03 }, COLORS.corniceShadow);

  // ---- the north front's eleven bays ------------------------------------------------------------------
  const winW = DIMS.windowWidth;
  // The opening's own depth in the wall: the face at z = -0.20, the glass at z = -0.64, so the reveal is
  // 0.44 m of real recess and the glass is about a third of the way through the 0.7 m wall.
  const REVEAL_FACE = zN - 0.20;
  const firstGlass = { z0: zN - 0.64, z1: zN - 0.50 };
  const secondGlass = { z0: zN - 0.56, z1: zN - 0.44 };
  for (let i = 1; i <= BAYS.count; i++) {
    const cx = BAYS.centreX(i);
    const behindPortico = BAYS.porticoBays.includes(i);
    // The first floor: a reveal, the sash, the sill on blocks, the architrave head, and the pediment on its
    // console brackets. The photograph alternates the triangle and the segment, bay by bay, and the bay
    // nearest the portico on each side carries the triangle.
    const firstH = FACADE.firstHead - FACADE.firstSill;
    revealSteps(b, `bay ${i} first floor`, cx, (FACADE.firstSill + FACADE.firstHead) / 2, winW, firstH, REVEAL_FACE, firstGlass.z0);
    sash(b, `bay ${i} first floor sash`, cx, (FACADE.firstSill + FACADE.firstHead) / 2, winW, firstH, firstGlass);
    b.box(`bay ${i} first floor surround sill`, { x0: cx - winW / 2 - 0.22, x1: cx + winW / 2 + 0.22, y0: FACADE.firstSill - 0.22, y1: FACADE.firstSill, z0: zN - 0.40, z1: zN + 0.04 }, COLORS.windowTrim, { occlusion: OCCLUSION.eaveUnder });
    // The two small blocks the sill sits on (HABS sheet 82's own note).
    for (const side of [-1, 1]) {
      b.box(`bay ${i} first floor sill block ${side < 0 ? 'west' : 'east'}`, { x0: cx + side * (winW / 2 - 0.1) - 0.14, x1: cx + side * (winW / 2 - 0.1) + 0.14, y0: FACADE.firstSill - 0.44, y1: FACADE.firstSill - 0.22, z0: zN - 0.38, z1: zN + 0.04 }, COLORS.windowTrim, { occlusion: OCCLUSION.eaveUnder });
    }
    b.box(`bay ${i} first floor surround head`, { x0: cx - winW / 2 - 0.22, x1: cx + winW / 2 + 0.22, y0: FACADE.firstHead, y1: FACADE.firstHead + 0.22, z0: zN - 0.42, z1: zN + 0.04 }, COLORS.windowTrim, { occlusion: OCCLUSION.eaveUnder });
    b.box(`bay ${i} first floor surround west`, { x0: cx - winW / 2 - 0.22, x1: cx - winW / 2, y0: FACADE.firstSill, y1: FACADE.firstHead, z0: zN - 0.40, z1: zN + 0.04 }, COLORS.windowTrim);
    b.box(`bay ${i} first floor surround east`, { x0: cx + winW / 2, x1: cx + winW / 2 + 0.22, y0: FACADE.firstSill, y1: FACADE.firstHead, z0: zN - 0.40, z1: zN + 0.04 }, COLORS.windowTrim);
    // The panel with a moulded border under the sill, which sheet 82 draws below every window.
    b.box(`bay ${i} first floor apron`, { x0: cx - winW / 2 - 0.1, x1: cx + winW / 2 + 0.1, y0: FACADE.firstSill - 1.05, y1: FACADE.firstSill - 0.44, z0: zN - 0.12, z1: zN + 0.03 }, COLORS.windowTrim, { occlusion: 0.82 });

    if (!behindPortico) {
      const kind = BAYS.firstFloorPediment(i);
      const yEave = FACADE.firstHead + 0.22;
      // The hood is narrower than the bay: the photograph's own apex spans u 0.1505 to 0.1775, which at the
      // wall's plane is 3.2 m against the bay's 4.655 m, and its rake rises 0.72 m, which is 13 px of the
      // frame against the measured 14.
      const halfW2 = 1.6;
      if (kind === 'triangle') {
        triangularPediment(b, `bay ${i} first floor pediment`, cx, yEave, halfW2, 0.72, zN - 0.42, 0.34);
      } else {
        segmentalPediment(b, `bay ${i} first floor pediment`, cx, yEave, halfW2, 0.52, zN - 0.42, 0.34);
      }
      consoles(b, `bay ${i} first floor`, cx, yEave, winW + 0.44, zN - 0.40);
    }

    // The second floor: a plain head, taller than it is wide, with no pediment ("the smaller, plainly
    // trimmed ones"). Six-over-six like the first floor's, but shorter.
    const secondH = FACADE.secondHead - FACADE.secondSill;
    revealSteps(b, `bay ${i} second floor`, cx, (FACADE.secondSill + FACADE.secondHead) / 2, winW, secondH, REVEAL_FACE, secondGlass.z0);
    sash(b, `bay ${i} second floor sash`, cx, (FACADE.secondSill + FACADE.secondHead) / 2, winW, secondH, secondGlass);
    b.box(`bay ${i} second floor sill`, { x0: cx - winW / 2 - 0.20, x1: cx + winW / 2 + 0.20, y0: FACADE.secondSill - 0.20, y1: FACADE.secondSill, z0: zN - 0.34, z1: zN + 0.04 }, COLORS.windowTrim, { occlusion: OCCLUSION.eaveUnder });
    b.box(`bay ${i} second floor head`, { x0: cx - winW / 2 - 0.20, x1: cx + winW / 2 + 0.20, y0: FACADE.secondHead, y1: FACADE.secondHead + 0.22, z0: zN - 0.36, z1: zN + 0.04 }, COLORS.windowTrim, { occlusion: OCCLUSION.eaveUnder });
    b.box(`bay ${i} second floor surround west`, { x0: cx - winW / 2 - 0.20, x1: cx - winW / 2, y0: FACADE.secondSill, y1: FACADE.secondHead, z0: zN - 0.32, z1: zN + 0.04 }, COLORS.windowTrim);
    b.box(`bay ${i} second floor surround east`, { x0: cx + winW / 2, x1: cx + winW / 2 + 0.20, y0: FACADE.secondSill, y1: FACADE.secondHead, z0: zN - 0.32, z1: zN + 0.04 }, COLORS.windowTrim);
  }

  // ---- the south front's thirteen bays ----------------------------------------------------------------
  // 5 + 3 + 5, the centre three behind the bowed South Portico, which portico.js builds.
  const southBays = 13;
  const southPitch = W / southBays;
  for (let i = 1; i <= southBays; i++) {
    if (i >= 6 && i <= 8) continue;
    const cx = -W / 2 + (i - 0.5) * southPitch;
    const gy = -DIMS.southLawnDrop;
    b.box(`south bay ${i} second floor glass`, { x0: cx - winW / 2 + 0.12, x1: cx + winW / 2 - 0.12, y0: FACADE.secondSill + 0.12, y1: FACADE.secondHead - 0.12, z0: zS + 0.12, z1: zS + 0.28 }, COLORS.windowGlass);
    b.box(`south bay ${i} first floor glass`, { x0: cx - winW / 2 + 0.12, x1: cx + winW / 2 - 0.12, y0: FACADE.firstSill + 0.12, y1: FACADE.firstHead - 0.12, z0: zS + 0.12, z1: zS + 0.28 }, COLORS.windowGlass);
    b.box(`south bay ${i} ground floor glass`, { x0: cx - winW / 2 + 0.12, x1: cx + winW / 2 - 0.12, y0: gy + 1.2, y1: gy + 3.4, z0: zS + 0.12, z1: zS + 0.28 }, COLORS.windowGlass);
  }

  return b.group;
}
