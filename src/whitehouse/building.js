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

// The north facade's own horizontal bands, in metres above the NORTH LAWN. The scale at the wall's plane is
// 1 m = 0.0193123 of the frame height, i.e. 1 / (2 tanV d) with d 47.863 m and tanV 0.54092, and it reads
// the other way as 1 v of frame = 51.78 m at z = 0. THE 0.01714 THAT STOOD HERE UNTIL PASS I3 WAS 11 %
// SMALL: a row-to-metre conversion made with it understates every height by 1.127
// (0.019312 / 0.01714). The parenthetical it carried was wrong too: the frame's v 0.3800 to 0.6180 is the
// wall's base row to the parapet row, 0.238 of the frame, which is 12.32 m at this scale and NOT 15.3 --
// 15.3 is the parapet's own height and 2.976 m of it is the terrace the wall stands on.
//
// THE METRE COLUMN THAT STOOD HERE UNTIL PASS I4 DID NOT FOLLOW FROM THAT SCALE, OR FROM ANY ONE SCALE.
// Its four rows have been measured against the live camera (out/wh/scratch/pass-i4-bands.mjs, which
// inverts each row through THREE.Vector3.project() at z = 0 and re-derives the two rows the whole camera
// solve rests on): v 0.4350 inverts to 12.42 m, which is this file's secondHead exactly, and v 0.4875 to
// 8.03 m against its 7.9; but v 0.5680 inverts to 5.57 m against this file's 7.22 and v 0.6120 to 3.29 m
// against its 4.16. The row SPANS are wrong under every scale: 0.5680 - 0.6120 is 0.0440 of the frame,
// 2.28 m, against the 3.06 m the table claimed for the same pair, and 0.4350 - 0.4900 is 2.85 m against its
// 3.18 m. So the metre column was not derivable from the rows beside it, and the rows were not derived from
// the metres. FACADE's numbers are LITERALS chosen for the building; nothing computes them from a row.
//
// WHAT THE PHOTOGRAPH ACTUALLY SHOWS, measured rather than converted the same way (same tool, the dark-glass
// runs of each open bay's own window column):
//
//   the first-floor glass   v 0.5667 to 0.6056  ->  5.63 m to 3.49 m
//   the second-floor glass  v 0.4533 to 0.5200  ->  10.93 m to 8.05 m
//
// against this file's 4.16-7.22 and 9.24-12.42: both floors are placed 1.0 to 1.6 m ABOVE the photograph's
// own glass. `npm run shot` + `npm run compare` was run on the correction that moves them down to their
// measured rows (out/wh/scratch/pass-i4-compare-arm-windowrows.txt) and grew WORSE on both scored numbers,
// 0.0952 -> 0.0955 cell distance and 0.4199 -> 0.4169 SSIM, so the metres above stay as they are and this
// discrepancy is named rather than fixed. It is NOT the 11 % conversion: that factor would have moved these
// rows by 1.127, i.e. ~0.7 m at the head, and no single conversion reproduces them.
//
// The pediments, the dentil band and the frieze were later additions and their bands are set the same way:
// the frieze and its dentils occupy v 0.386 to 0.402, which is 13.1 m to 12.2 m, and the first-floor
// pediments rise from the window head at 7.42 m to about 8.6 m, inside the 7.9 m belt's own band.
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
  deckTop: 14.2, // the flat deck behind the balustrade; the hip, the blocks and the stacks above it are
  // measured per piece in the roofscape block below -- a single chimneyTop/roofRise constant was the old
  // blockout, and its 17.0 m hid every stack behind the parapet's 17.4 m sightline
  height: 15.3,
};

// ---- THE APERTURE AND THE FRAME AROUND IT ------------------------------------------------------------
// THE NORTH WALL HAS HOLES IN IT, AND UNTIL PASS J IT DID NOT. Every band of the wall was one box from
// -25.6 to +25.6 m, 0.7 m thick, and the window -- glass, reveal, sash, trim -- was built BEHIND that box
// (the trim's front face at z -0.40 against the wall's at z -0.70). So the wall was drawn in front of every
// window and the bays were blank wall with a sill and an architrave laid on them: out/wh/scratch/
// pass-j-paint.mjs repaints each surface class a saturated colour in a live page and re-measures the
// opening by real screenshot, and painting the glass, the reveal's inner return, the reveal's outer trim and
// the sash bars moved the opening by 0.0 luma, while painting the wall's own middle band moved it 156 -> 223.
// A rendered frame and the handoff that reported "the window is exactly as bright as the wall" were both
// looking at the wall's own face through a window-shaped nothing.
//
// So the aperture is named here, the wall is built AROUND it, and the frame is built TO it. These are the
// numbers the photograph's own window measures: the reveal's outer pad is 0.13 m outside the glass on every
// side (revealSteps below), so a 2.10 m sash needs a 2.36 m hole, and the surround's sill and head bands
// (0.22 m thick, at the glass's own sill and head) hang on the hole's outer face rather than across it.
export const OPENING = {
  halfWidth: DIMS.windowWidth / 2 + 0.13, // the glass's own half plus the reveal's outer pad
  firstFoot: FACADE.firstSill - 0.22, // the first-floor surround's sill band is 0.22 thick, below the glass
  firstTop: FACADE.firstHead + 0.22, // and its head band sits above it, so the hole stops at its top
  secondFoot: FACADE.secondSill - 0.20, // the second-floor sill band is 0.20 thick
  secondTop: FACADE.secondHead + 0.22, // and its head band 0.22
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
  reveal: 1.10, // the window's own glass: THE ONE VALUE IN THIS BLOCK THAT IS A BRIGHTNESS AND NOT AN
  // OCCLUSION. Read this before changing it, because the sign is not the one the name suggests.
  //
  // A surface's albedo is derived by inverting the tone curve at `irradiance * occlusion` (src/materials.js
  // albedoOf), so a LOWER occlusion asks for a HIGHER albedo: the term is not a dimmer, it is a statement
  // about how much sky the surface sees, and the factory then undoes it. For a target as dark as this
  // glass (0x545f69, which displays as luma 93) the undoing is larger than any real dimming, so 0.30 was
  // making the glass 3.3x the sampled mean's radiance. Measured in a live page by repainting the class and
  // re-measuring the opening by real screenshot (out/wh/scratch/pass-j-sweep.mjs), against the photograph's
  // own 0.86 opening/wall ratio at the same bays:
  //
  //   occlusion   0.30   0.50   0.80   1.00   1.20   1.50   2.00
  //   glass luma  169    139    112    100     91     81     70
  //   opening     1.06   0.88   0.73   0.66   0.61   0.55   0.49
  //
  // The photograph's glass/opening pairs are 0.46/0.49 (first floor) and 0.51/0.56 (second), so the
  // albedo wants to be about a quarter of what 0.30 produced -- i.e. an occlusion of about 1.25. That is
  // the value here, and it is a brightness lever wearing the occlusion's name: the honest statement is
  // that this rig has no separate albedo multiplier, so the ONLY way a material factory that divides by the
  // occlusion can darken a surface is an occlusion above 1. The comment in OCCLUSION's own header above,
  // which says the term cannot brighten, is what pass I4 measured for the PORCH's wall at 0.55 down to
  // 0.03 -- a mid-tone target, where the curve is not yet saturated and the ambient really does fall faster
  // than the albedo rises. It does not hold for a near-black target, and this glass is one.
  //
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
  // The outer step stands PROUD of the wall's own face -- 0.03 m of it, since pass J -- because the wall now
  // has a real aperture at |x - cx| <= OPENING.halfWidth and the hole's edge would otherwise show as a
  // 4 cm sliver of wall between the trim and the opening. Standing proud is also what the photograph shows:
  // the architrave projects, the reveal steps back from it, and the glass is deepest.
  for (const [tag, pad, zOut, zIn, occl, color] of [
    ['outer', 0.13, z0 + 0.03, z0 - 0.14, 0.66, COLORS.windowTrim],
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

  // THE ELEVEN BAY CENTRES ARE MEASURED, NOT DERIVED FROM `BAYS.centreX` (the full argument is at the bay
  // loop below; the arithmetic is out/wh/scratch/pass-k-layout.mjs and its output pass-k-layout.txt).
  // They live here rather than at the bay loop because the WALL'S OWN BANDS need them FIRST: the bands
  // are cut into the apertures these centres define (see APERTURES below), so a band emitted against
  // `BAYS.centreX` would put the piers in one place and the windows in another.
  //
  // FACET_WEST is the six half-knots between the portico's axis and the north-west corner, x ASCENDING:
  // bay 1 is the corner, bays 5 and 6 are the two narrow PORTICO bays beside the axis. Bays 7..11 are
  // its mirror, so the north front is x-mirror-symmetric by construction and the photograph's own
  // mirror symmetry (its pairwise sums are constant to 0.0003 u) cannot be lost to a transcription
  // slip -- `facetCentre(7)` is +0.5819 and `facetCentre(11)` is +22.8585, the mirror of bays 6 and 1.
  const FACET_WEST = [-22.8585, -18.7454, -14.6409, -10.5365, -1.7456, -0.5819];
  const facetCentre = (i) => (i <= 6 ? FACET_WEST[i - 1] : -FACET_WEST[11 - i]);
  // The photograph's own eight visible window centres, as u (pass-j-winscan.mjs's whole-window scan,
  // re-measured this pass by pass-k-probe.mjs to 0.0001 u), and the bays that carry them.
  const PHOTO_WINDOW_U = [0.1708, 0.2300, 0.2892, 0.3488, 0.6538, 0.7137, 0.7725, 0.8325];
  const WINDOW_BAYS = [1, 2, 3, 4, 8, 9, 10, 11];
  // u -> x at the wall's plane is exact and needs no camera: this scene's camera has zero yaw and zero
  // roll, so a point at z 0 projects with u = 0.5 + x / (2 tanH d), d 47.863 m and tanH = tan(56.82/2)*4/3.
  // THE CHECK IS ON THE SOURCE, so a later pass that nudges a number in FACET_WEST sees the residual here
  // rather than having to re-run the whole scan to find it.
  const SCALE_AT_WALL = 2 * Math.tan((56.82 / 2) * (Math.PI / 180)) * (4 / 3) * 47.863; // 69.041 m/u
  const facetResiduals = WINDOW_BAYS.map((bay, k) => (PHOTO_WINDOW_U[k] - 0.5) * SCALE_AT_WALL - facetCentre(bay));
  const facetRms = Math.sqrt(facetResiduals.reduce((s, r) => s + r * r, 0) / facetResiduals.length);
  if (facetRms > 0.25) {
    throw new Error(`the eleven bays no longer put the photograph's eight visible windows on their measured `
      + `centres: ${facetRms.toFixed(3)} m rms against a 0.25 m budget. See out/wh/scratch/pass-k-layout.mjs.`);
  }
  console.log(`building: bays re-spaced -- the eight visible windows sit ${facetRms.toFixed(3)} m rms from the `
    + `photograph's own centres (the uniform 4.6545 m bays gave 0.742 m)`);

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
  // AND THE BANDS HAVE HOLES IN THEM AT THE ELEVEN BAYS, which is this pass's correction and the whole
  // reason the windows did not read: see OPENING's own block above. Within one band the wall is emitted as
  // the horizontal pieces BETWEEN the bay apertures, so the pier is wall, the aperture is air, and the
  // glass and the reveal are the surfaces a ray through the aperture actually meets. The piece edges are
  // the aperture's own edges (cx +- OPENING.halfWidth), so the trim's 0.13 m pad lands on the pier's face
  // and the seam falls where the reveal's outer step already stands proud of it.
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
  // The eleven bays' apertures, as the half-open x intervals [lo, hi) a band of the wall must not occupy
  // where that band is at an aperture's own height. A band is at an aperture's height when its own y span
  // contains that aperture's -- so the loop below passes only the bands that carry holes. The first version
  // of this filtered the APERTURES by comparing their x against the band's y, which is a category error that
  // matched exactly one aperture out of eleven and left the wall solid everywhere else; the mesh names it
  // emitted ("x -25.60..8.13") are what caught it, in out/wh/scratch/pass-j-walls.mjs.
  const APERTURES = [];
  for (let i = 1; i <= BAYS.count; i++) {
    const cx = facetCentre(i);
    APERTURES.push([cx - OPENING.halfWidth, cx + OPENING.halfWidth]);
  }
  // One band, as the solid pieces between the apertures it overlaps. RECEIVING, AND ONLY THE NORTH FRONT
  // NEEDS IT: the portico's entablature and pediment are casters (portico.js) and the shadow they throw is
  // the dark band the photograph shows across the centre of the facade, so every piece keeps the flag.
  const wallPiece = (tag, x0, x1, ya, yb, color, occl) => b
    .box(`north wall ${tag} band x ${x0.toFixed(2)}..${x1.toFixed(2)}`, { x0, x1, y0: ya, y1: yb, z0: zN - wallT, z1: zN }, color, { metric: true, occlusion: occl })
    .receiveShadow = true;
  const pieceOut = (tag, ya, yb, color, occl, holes) => {
    if (!holes) { wallPiece(tag, -halfW, halfW, ya, yb, color, occl); return; }
    let lo = -halfW;
    for (const [aLo, aHi] of holes) {
      if (aLo > lo + 1e-4) wallPiece(tag, lo, aLo, ya, yb, color, occl);
      lo = aHi;
    }
    if (lo < halfW - 1e-4) wallPiece(tag, lo, halfW, ya, yb, color, occl);
  };
  for (const [tag, ya, yb, color, occl] of WALL_BANDS) {
    pieceOut(tag, ya, yb, color, occl, ya < OPENING.firstTop && yb > OPENING.firstFoot ? APERTURES : null);
  }
  // The three spandrels the four bands do not cover for, plus the sliver between the second floor's head and
  // the upper band. Each one is at an aperture's height, so each is emitted between the apertures.
  for (const [tag, ya, yb, color, occl] of [
    ['first floor spandrel head', OPENING.firstTop, FACADE.belt + 0.26, COLORS.wallLit, OCCLUSION.baseCourse],
    ['second floor spandrel sill', FACADE.belt + 0.26, OPENING.secondFoot, COLORS.wallMid, 1],
    ['second floor spandrel head', OPENING.secondTop, 12.6, COLORS.wallMid, 1],
  ]) {
    pieceOut(tag, ya, yb, color, occl, APERTURES);
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
  // THE ROOFLINE THE PHOTOGRAPH ACTUALLY SHOWS, MEASURED PER-PIXEL. The blockout this replaces put five
  // stacks at x [-18.6..23.25] rising to 17.0 m at z -0.62*D (-16.18) and a flagpole to 21.4 m at z -D/2
  // (-13.05), and NONE of it was in the frame: over the parapet (15.3 m at z 0) the sightline to z -16.18
  // needs a top above 17.40 m, and over the pediment's apex (17.9 m at z +6.5) the sightline to z -13.05
  // needs 22.07 m. Every copy the blockout built hid behind the building.
  //
  // The measurements are out/wh/scratch/roofline-probe.mjs (per-pixel silhouette tops and class map) and
  // roofline-probe2.mjs (far stacks, box-mean colours) on whitehouse.webp at 1200x900. Each world figure
  // below is the photograph's own row inverted through the calibrated camera at the piece's ASSUMED z --
  // the photograph fixes u and v and cannot fix z; every z here is an assumption stated with its reason.
  // Inversion: y = 9.086 + (0.5 - v) * 1.08184 * dn, x = (u - 0.5) * 1.44246 * dn, dn = 47.863 - z.
  //
  //   SIX stacks above the parapet, not the blockout's five invented ones:
  //   * two big white BLOCKS flanking the pediment, flat tops at v 0.3267-0.3278. The west one spans
  //     u 0.3775-0.4092 with a lower annex at u 0.3708-0.3775 (top v 0.3378) carrying a dark recessed
  //     panel (u 0.3721-0.3775, v 0.3422-0.3622) and an antenna mast at u 0.3892 to v 0.3189; the east
  //     one spans u 0.5667-0.6275. ASSUMED z: their north faces at -13.5, straddling the ridge, big
  //     bulkhead masses rising through the roof -- at any z behind the parapet their u and v land the
  //     same within the frame's tolerance, and -13.5 keeps them on the roof's own structure.
  //   * two white chimney STACKS outside those: u 0.3250-0.3450 top v 0.333 (west), u 0.6583-0.6817 top
  //     v 0.336 (east), each with dark equipment on top to v 0.324/0.332. ASSUMED z -15.62 face, on the
  //     ridge line (-16.18), where the old blockout already put its stacks: tops 20.55/20.34 m.
  //   * two END chimneys the blockout never had: u 0.1525-0.1692 top v 0.366 (west), u 0.8400-0.8525 top
  //     v 0.3685 (east), each with a dark cap and a thin mast to v 0.3478/0.3489. These CANNOT stand on
  //     the roof at z -16.18: their u would put them at x +-31..32, 6 m PAST the end walls (+-25.6).
  //     ASSUMED z -3: they land at x ~+-25, chimneys rising from the end walls at their north corners,
  //     tops 16.5/16.3 m -- the end chimneys the HABS elevations draw at both ends of the block.
  //   * a DARK ROOF BAND between and behind the stacks, top edge v 0.3678-0.3711 in the open stretches
  //     (u 0.346-0.364, 0.642-0.657, 0.682-0.697), sampled #0b0f16: the hip's north slope standing in the
  //     parapet's own shade. Built as a hip: ridge 18.12 m at z -16.18 (the row's inversion; the published
  //     60 ft 4 in = 18.39 m to the roof's top is 2 px away at this depth), north slope from the deck's
  //     edge at z -1, south slope to z -24, end hips from x +-25 down to the deck corners.
  //   * the FLAG POLE on the centre line, u 0.4992-0.5017, top v 0.1778, emerging from behind the
  //     pediment's apex exactly at the apex row: at z -13.05 (ASSUMED: the roof's centre, where the
  //     building's own pole stands) the sightline over the apex is 22.07 m, v 0.3031 = the measured
  //     0.3033. Pole to 30.32 m, 0.15 m square -- 2 px of the frame, as the photograph's own pole is.
  //   * the FLAG, flying WEST at what the photograph shows as half-staff: u 0.4892-0.5017, v
  //     0.2278-0.244, sampled #1d2844 (77% dark, core #000207): a backlit near-black navy. At z -13.05
  //     that box is x -0.95..0, y 25.95..27.02 -- 3.3 m below the pole's top.
  b.box('roof deck', { x0: -halfW, x1: halfW, y0: FACADE.balustradeBottom - 0.5, y1: FACADE.deckTop, z0: zS, z1: zN }, COLORS.roof, { metric: true });

  // The hip. profileSolid reads its profile along -z with the coordinates NEGATED (see the terrace's own
  // note): s 1 is world z -1. The ridge is the measured band's own row; the north slope alone carries the
  // band's sampled near-black, the rest of the roof keeps the deck's own tone for the orbit views.
  const ridgeY = 18.12; // v 0.3696 at z -16.18; the band's open stretches measure v 0.3678-0.3711
  const ridgeS = 16.18; // -z of the ridge line, the old blockout's own chimney line -0.62*D
  b.profileSolid('roof north slope', [[1, FACADE.deckTop - 0.2], [1, FACADE.deckTop], [ridgeS, ridgeY], [ridgeS, FACADE.deckTop - 0.2]], -25, 25, COLORS.roofSlope);
  b.profileSolid('roof south slope', [[ridgeS, FACADE.deckTop - 0.2], [ridgeS, ridgeY], [24, FACADE.deckTop], [24, FACADE.deckTop - 0.2]], -25, 25, COLORS.roof);
  for (const side of [-1, 1]) {
    b.quadSlab(
      `roof ${side < 0 ? 'west' : 'east'} hip`,
      side < 0
        ? [{ x: -25, y: ridgeY, z: -ridgeS }, { x: -halfW, y: FACADE.deckTop, z: -24 }, { x: -halfW, y: FACADE.deckTop, z: -1 }]
        : [{ x: 25, y: ridgeY, z: -ridgeS }, { x: halfW, y: FACADE.deckTop, z: -1 }, { x: halfW, y: FACADE.deckTop, z: -24 }],
      0.3,
      COLORS.roof,
    );
  }

  // The two big white blocks flanking the pediment, and the west one's annex, recess and mast.
  for (const [name, x0, x1, top] of [
    ['west rooftop block', -10.84, -8.04, 20.57], // u 0.3775-0.4092, top v 0.327
    ['east rooftop block', 5.90, 11.29, 20.59], // u 0.5667-0.6275, top v 0.3267
  ]) {
    b.box(`${name} body`, { x0, x1, y0: FACADE.deckTop, y1: top - 0.18, z0: -18.5, z1: -13.5 }, COLORS.roofBlock, { metric: true });
    b.box(`${name} coping`, { x0: x0 - 0.14, x1: x1 + 0.14, y0: top - 0.18, y1: top, z0: -18.64, z1: -13.36 }, COLORS.roofBlock, { metric: true });
  }
  b.box('west rooftop block annex', { x0: -11.44, x1: -10.84, y0: FACADE.deckTop, y1: 19.85, z0: -18.5, z1: -13.5 }, COLORS.roofBlock, { metric: true });
  b.box('west rooftop block recess', { x0: -11.32, x1: -10.84, y0: 18.21, y1: 19.54, z0: -13.47, z1: -13.42 }, COLORS.blockRecess);
  b.box('west rooftop block mast', { x0: -9.84, x1: -9.78, y0: 20.52, y1: 21.10, z0: -16.1, z1: -15.95 }, COLORS.poleDark);
  b.box('west rooftop block roof box', { x0: -8.26, x1: -7.70, y0: 20.52, y1: 20.95, z0: -16.5, z1: -15.5 }, COLORS.roofBlock);
  b.box('east rooftop block roof box', { x0: 6.64, x1: 7.52, y0: 20.54, y1: 20.95, z0: -16.5, z1: -15.5 }, COLORS.roofBlock);

  // The four measured chimney stacks: white bodies with a brighter cap ledge and the photograph's own dark
  // equipment on top. The end chimneys stand at z -3 against the end walls' north corners (the assumption
  // above), the inner two on the ridge line.
  for (const [name, x0, x1, z0, z1, top, cap] of [
    ['west chimney', -16.02, -14.19, -16.72, -15.62, 20.55, [-15.62, -15.16, 21.17]], // u 0.3250-0.3450
    ['east chimney', 14.50, 16.63, -16.72, -15.62, 20.34, [15.27, 16.06, 20.62]], // u 0.6583-0.6817
    ['far west chimney', -25.50, -24.27, -3.55, -2.45, 16.46, [-25.14, -24.65, 16.72]], // u 0.1525-0.1692
    ['far east chimney', 24.95, 25.86, -3.55, -2.45, 16.32, [25.00, 25.37, 16.69]], // u 0.8400-0.8525
  ]) {
    b.box(`${name} stack`, { x0, x1, y0: FACADE.deckTop, y1: top - 0.18, z0, z1 }, COLORS.chimneyStack, { metric: true });
    b.box(`${name} cap ledge`, { x0: x0 - 0.12, x1: x1 + 0.12, y0: top - 0.18, y1: top, z0: z0 - 0.12, z1: z1 + 0.12 }, COLORS.chimneyStack, { metric: true });
    b.box(`${name} dark cap`, { x0: cap[0], x1: cap[1], y0: top - 0.05, y1: cap[2], z0: (z0 + z1) / 2 - 0.4, z1: (z0 + z1) / 2 + 0.4 }, COLORS.chimneyCap);
  }
  // The end chimneys' own thin masts (the photograph's u 0.1533-0.1558 to v 0.3478 and u 0.8467-0.8483 to
  // v 0.3489), beside the caps.
  b.box('far west chimney mast', { x0: -25.42, x1: -25.23, y0: 16.41, y1: 17.46, z0: -3.1, z1: -2.9 }, COLORS.chimneyCap);
  b.box('far east chimney mast', { x0: 25.42, x1: 25.53, y0: 16.27, y1: 17.38, z0: -3.1, z1: -2.9 }, COLORS.chimneyCap);

  // The flag pole and the flag. The pole's z is the roof's centre line (the assumption above); its top is
  // the photograph's own v 0.1778. The flag flies WEST at the measured rows, in its sampled backlit navy.
  b.box('flagpole', { x0: -0.075, x1: 0.075, y0: 18.0, y1: 30.10, z0: -D / 2 - 0.075, z1: -D / 2 + 0.075 }, COLORS.poleDark);
  b.box('flagpole finial', { x0: -0.11, x1: 0.11, y0: 30.10, y1: 30.32, z0: -D / 2 - 0.11, z1: -D / 2 + 0.11 }, COLORS.poleDark);
  b.box('flag', { x0: -0.95, x1: -0.06, y0: 25.95, y1: 27.02, z0: -D / 2 - 0.03, z1: -D / 2 + 0.03 }, COLORS.flagDark);

  // ---- the north front's eleven bays ------------------------------------------------------------------
  //
  // THE BAYS ARE NOT ON A UNIFORM PITCH, AND THAT IS THIS PASS'S WHOLE GEOMETRIC CHANGE.
  //
  // `layout.js` laid the eleven out uniformly across the calibrated 51.2 m: `BAYS.pitch` 4.6545 m and
  // `BAYS.centreX(i) = -25.6 + (i - 0.5) * 4.6545`. Pass J measured what that does to the facade
  // (out/wh/scratch/pass-j-bayfit.mjs): the photograph's eight whole windows sit on a pitch of 4.1045 m
  // (its own four-window group spans 12.29 m against the code's 13.96 m), and against the uniform bays
  // the outer windows of each group land -- bay 1 at -0.02 m, bay 11 at +0.32 m -- while the inner ones
  // are pulled 1.13 m and 0.79 m toward the portico. That is not a pitch error; a pitch error cannot
  // move the inner windows one way and leave the outer ones alone.
  //
  // WHAT IT ACTUALLY IS, and the arithmetic is out/wh/scratch/pass-k-layout.mjs:
  //
  //   * The photograph's own axis is a PIER, not a window: u 0.5015 carries no aperture, and the eight
  //     visible windows sit at +-2.5, +-3.5, +-4.5 and +-5.5 pitches from it. Eleven bays with bays
  //     1..11 has the axis between bays 5 and 6, and bays 5, 6, 7 are the three the portico covers.
  //   * The corner pier the photograph draws -- its outer window centre to the wall's own end -- is
  //     2.74 m, and THIS PASS MEASURED the wall's end off the photograph rather than inheriting it
  //     (out/wh/scratch/pass-k-corner.mjs: the sky->wall step sits at x 155-157 west, u 0.1292-0.1308,
  //     and x 1045-1048 east, u 0.8708-0.8733). So the calibrated wall ends and the calibrated 51.2 m
  //     are CONFIRMED by the frame to about a pixel, and the corner pier is real.
  //   * That pier and the 4.1045 m outer pitch are 0.668 and 1.0 pitches of a layout that has to close
  //     on 51.2 m. Combined: the OUTER FOUR BAYS on each side stand on the photograph's own 4.1045 m
  //     pitch, the photograph's own outer centres at +-22.8585 and +-10.5365 m, the two half-gaps
  //     between the axis and bay 4 come to 1.1638 m each, and every remaining metre of the 51.2 m falls
  //     in the piers. The visible windows land on the photograph's own centres to 0.099 m rms (1.7 px),
  //     against 0.742 m (12.9 px) for the uniform bays. The knots, from the axis outward:
  //
  //       0 (pier) | 0.5819 | 1.7456 | 10.5365 | 14.6409 | 18.7454 | 22.8585   and the mirror of each
  //
  //   * The portico's own geometry is NOT touched and still registers: its outer column pair is at
  //     +-5.38 m, which is inside the 1.75..5.70 m pier (it was inside the 0.67..5.33 m pier before),
  //     and its central pair at +-2.02 m is inside the 1.16..2.56 m pier. The portico's bays (5, 6, 7)
  //     and the pediment rule are unchanged.
  //
  // WHAT IS ODD ABOUT IT, stated rather than hidden: the two bays beside the axis (0.58 m and 1.75 m
  // from it) have to be narrow. They are PORTICO bays -- their own pier spacing is what the frame's
  // 22.86 m outer centres and its 2.74 m corner pier leave for them -- and they carry no aperture the
  // photograph can see, because the portico's 10.76 m column pair stands in front of them. They are
  // built anyway: an orbit's view of the facade would otherwise have a blank 4.5 m of wall under the
  // portico. What a reader should check before changing a number below is pass-k-layout.txt.
  const winW = DIMS.windowWidth;
  // The opening's own depth in the wall: the face at z -0.20, the glass at z -0.64, so the reveal is
  // 0.44 m of real recess and the glass is about a third of the way through the 0.7 m wall.
  const REVEAL_FACE = zN - 0.20;
  // THE GLASS SITS INSIDE THE APERTURE NOW. Its plane was at z -0.64..-0.50, which is 0.14 m BEHIND the
  // reveal's inner return and 0.44 m behind the reveal's face -- and, until this pass, behind the wall's own
  // front face too, because the wall had no aperture. With the wall cut (OPENING above) the sash is the
  // surface the opening shows, so it stands where a sash stands: just inside the reveal's inner step, with
  // the muntins and the meeting rail 3 cm proud of it, all of it still behind the architrave.
  const firstGlass = { z0: zN - 0.60, z1: zN - 0.46 };
  const secondGlass = { z0: zN - 0.56, z1: zN - 0.44 };
  for (let i = 1; i <= BAYS.count; i++) {
    const cx = facetCentre(i);
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
