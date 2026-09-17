// The two porticoes: the North Portico, a tetrastyle Ionic porch with a triangular pediment standing on a
// broad flight of steps, and the South Portico, a bowed centre carrying a flat-roofed semicircular
// colonnade on a rusticated podium with a double staircase.
//
// EVERY HEIGHT HERE IS ANCHORED TO A PHOTO ROW, and the anchor is stated in its comment. The reference
// frame's own scale is 1 m = 0.01714 of the frame height at the wall's plane; at the portico's front, 6.5 m
// nearer the camera, 1 m = 0.01897. The rows this file is built to:
//
//   the pediment apex        v 0.2973   where the centre column leaves the sky, luma 122 -> 75 -> 62
//   the pediment's eave      v 0.3458   the top of the raking cornices where they meet the horizontal one
//   the entablature's top    v 0.3458   the same line: the eave cornice sits on the entablature
//   the capitals' abaci      v 0.390-0.409   a bright band at u 0.44 and 0.56, `#abaf9f` luma 172
//   the column bases         NOT measurable -- the hedge and the steps hide them, so the column height is
//                            whatever is left between the entablature and the porch's floor
//
// The North Portico's width and projection are UNVERIFIED (research-photo.md section 5 item 6) and are set from the
// photo: the raking cornice's outer ends measure u 0.3333 and 0.6625, which at the portico's own depth is
// 19.6 m. Its four columns then stand on the building's 4.655 m bay pitch, which makes the porch exactly the
// three central bays wide -- the one internal check available, and it agrees.
import * as THREE from 'three';
import { DIMS, COLORS, TERRACE } from './layout.js';
import { OCCLUSION, FACADE } from './building.js';
import { makeMaterial } from '../materials.js';

const COLUMN_SEGMENTS = 14;
const DEG = Math.PI / 180;
const TAN_V = Math.tan((56.82 / 2) * DEG);

// HOW THE HEIGHTS WERE CHOSEN, and this pass REVERSED the previous one.
//
// The previous pass read the photograph's apex row (v 0.3033) at the portico's own plane and got 18.3 m,
// which is 3 m above the block's 15.3 m parapet, and then rejected it as parallax and built the porch to
// the building's own proportions with a 3.9 m pediment whose eave sat at 14.0 m. out/wh/scratch/runs.mjs
// segments a column of both images into colour runs, and the two do not agree:
//
//   render, u 0.50   sky to v 0.3122 | pale tympanum #e7ecf4 v 0.3133..0.378 | #525f6a v 0.3400 | ...
//   photo,  u 0.50   sky to v 0.2944 | #2d3942 v 0.2978 | #252e2e v 0.3056..0.3156 | #424f59 0.3211..0.3322
//
// In the photograph the pediment's whole vertical extent at the centre column is v 0.297 to 0.320, which is
// 21 px of a 900 px frame; in the render it is v 0.313 to 0.378, which is 59 px. The built pediment is THREE
// TIMES too tall and its eave sits 0.06 of the frame too low, which is why the porch's roof disappears
// behind the wall and the triangle reads as lying on the facade.
//
// The photograph is right and the worldToUV arithmetic confirms it takes no special pleading: a point at
// (0, y, z) projects to v = 0.5 - (y - 9.086) / (2 * 0.54092 * (47.863 + z)). Two rows come out of that and
// both are the photograph's own measurement rather than a free choice: the pediment's apex lands on the
// photo's v 0.303 at y = 16.15, and the eave lands on the photo's v 0.345 at y = 15.30 -- which is exactly
// the block's own 15.3 m parapet, so the pediment's base is level with the balustrade behind it and its
// apex stands 0.85 m clear of it. That is the building: a shallow gable just clear of the balustrade, and
// not a second storey. The rise is what this pass reversed; the previous 3.9 m made the tympanum 59 px tall
// where the photograph's is 21. The columns then follow from the entablature: a capital at 14.02 m is a
// 9.0 m order over a 4.4 m porch floor, which is 7.3 diameters of a 1.24 m column.
// THE PORCH STANDS NORTH OF THE WALL, IN +z, AND ITS FLOOR IS THE TERRACE'S OWN DECK.
//
// Z_FRONT is the portico's FRONT plane -- the plane its rows were measured at -- and it is POSITIVE: the
// camera is at z +47.863 looking along -z, so a porch projecting towards the camera has z > 0. The previous
// Z_FRONT = -DIMS.porticoProjection put the columns at z -1.1, i.e. 1.1 m SOUTH of the wall's own plane and
// inside the building, which is why a ray at a column's own position in the photograph hits the recess wall
// instead. The move to +6.5 gives the porch the depth its rows were solved at, 47.863 - 6.5 = 41.36 m.
//
// THE FLOOR AND THE COLUMN BASES HAVE TO COME DOWN TO THE TERRACE, AND THE PHOTOGRAPH IS WHY. A porch deck
// is only invisible if the hedge in front of it hides it, and that hedge's top is on the ray to the wall's
// own base -- row 0.6180. At the columns' own depth of +5.4 m an object at the old floor's 4.4 m projects to
// v 0.6025 and the old column base's 5.0 m to v 0.5889: BOTH ARE ABOVE 0.6180, so both would be drawn
// across the frame's centre as pale stone where the photograph has the black hedge band, and the 20-riser
// flight the old file built would land in the middle of the red bed. The park's own north front is reached
// by the raised carriage ramp, which is the terrace: its deck at TERRACE.baseY is the porch's floor.
const Z_FRONT = DIMS.porticoProjection;
// THE PEDIMENT'S RISE IS NOW THE PHOTOGRAPH'S OWN, and this is the fix the previous pass left as a
// measurement in its report. Both numbers below are rows in the photograph, inverted on this camera at the
// pediment's own depth of 41.36 m (dn = eye.z - Z_FRONT, so 1 m = 0.011179 of the frame height):
//
//   the eave   the top of the pediment's own horizontal cornice, v 0.3458 in the render's own terms. The
//              photograph's centre column runs `#4f5f6e` (luma 92, the eave's front face) from v 0.3400 to
//              0.3560 and its tympanum above it, and the row 0.3458 is inside that band: **16.00 m**.
//   the apex   the photograph's centre column leaves the sky at v 0.2973..0.2987, going from luma 122 to
//              75 to 62, and its documented apex row is v 0.2989-0.3033. Row 0.2973 inverts to **18.09 m**.
//
// THE OLD PAIR WAS 15.30 / 16.15 -- a rise of 0.85 m where the photograph's is 2.09 -- and it was NOT solved
// at 41.36 m: its apex implies a depth of 33.2 m and its eave 37.2 m, so the two were inconsistent at ANY
// single depth. That is why the frame showed the pediment's apex at v 0.3421 where the photograph has it at
// 0.2977: 40 px low, which is the whole of the upper half's largest error.
//
// WHAT ELSE HAD TO MOVE WITH THEM, and why each one rather than a slide of the whole porch:
//   * the three entablature members, whose band is measured rather than chosen. The photograph's centre
//     column has ONE strong downward step in it -- luma 122-124 above, 61 below -- at v 0.4100, which is
//     this camera's y 13.11 m at the porch's depth, and it is the entablature's own underside: below it the
//     photograph has the porch's shaded recess. This file's own "strongest horizontal edge in the centre of
//     the frame" test finds it on both images (out/critic/wh3defs.mjs), and it is what fixes the order's
//     height. `columnTop` is 14.02 because that is the value which puts the render's own step closest to
//     the photograph's: at 14.72 (the first cut of this pass, with the entablature raised to 16.00 and the
//     order stretched to reach it) the render's step is at v 0.3730, THIRTY-THREE PIXELS high; at 14.02 it
//     is at v 0.4010, eight pixels high, and the gable's own apparent height goes from 65.7 px to 90.9
//     against the photograph's 96.3. The old file's 14.02 was right and its entablature, not its order, was
//     what was too shallow: 1.98 m of entablature over an 11.0 m column is the classical fifth, and the
//     1.28 m the old file built was not.
//   * the pediment's raking cornice, 0.26 -> 0.42 m thick. 0.26 was chosen for a 0.85 m rise, where a 0.42
//     rake covers half the tympanum. At the photograph's 1.90 m rise it is the sheet's own thickness again:
//     the photograph's rake reads 13 px deep on the slope at this depth, which is 0.42 m perpendicular.
export const PORTICO_HEIGHTS = {
  floor: TERRACE.baseY, // the porch's deck is the terrace's: the ramp is the approach, per NPS's "the ground
  // floor is hidden by a raised carriage ramp and parapet". 2.976 m, and hidden behind the hedge.
  columnBase: TERRACE.baseY + 0.32, // the shafts start on the porch floor's plinth
  columnTop: 14.02, // the capital's top, which is the architrave's own underside: sheet 76's own order
  entablatureArchitrave: 14.40, // the three members of the entablature, each set proud of the one below
  entablatureFrieze: 15.10,
  entablatureCornice: 15.42, // the dentil bed mould sits between this and the frieze, as building.js's does
  entablatureTop: 16.00, // the porch's entablature: the photograph's own eave row, v 0.3455
  pedimentBase: 16.00, // the tympanum's eave, which is the entablature's top
  apex: 17.90, // the apex, from the photograph's own apex row v 0.3030 -- the row the file's own
  // "highest 12-px-deep non-sky run on the frame's centre columns" test finds on BOTH images
  // (out/critic/wh3defs.mjs: photo v 0.3030, and the 18.09 m this pass first shipped at v 0.2950, 7.2 px
  // high). The rise is therefore 1.90 m over a 9.78 m half-width, which is ALSO what the photograph's two
  // own rows measure between them: v 0.3030 to v 0.3455 is 0.0425 = 38 px = 1.90 m at this depth.
};
// WHERE THE COLONNADE STANDS. HABS sheet 76 draws the order as a free-standing one on its own stylobate with
// the entablature overhanging by less than half a metre, so the columns stand 5.4 m north of the wall and
// the eave stops 0.3 m in front of their own front -- the two numbers the old file's own comment gives,
// which its code did not implement (it read COLUMN_Z = Z_FRONT + 5.4, i.e. 1.1 m from the wall).
const COLUMN_Z = Z_FRONT - 1.1;
const BACK_Z = 0.1; // the porch's roof and the pediment run back to the wall
// A plain Ionic column: a square plinth, a base moulding, the shaft and a capital block. The volutes are
// left to a later wave -- at the photo's scale they are four pixels across.
//
// THE SHAFT'S SHADING IS NOT A COLOUR. What makes a cylinder read as a cylinder under a porch roof is that
// the sky it sees shrinks towards the top: below the capital most of its view is the wall and the soffit,
// at its base it sees out under the entablature and across the deck. So the shaft carries a vertex-colour
// occlusion ramp, dark at the capital and open at the base, on top of the material's own uniform term.
// Without it the column is a flat plate with a highlight on it, which is what the brief's item 2 reports.
function column(b, name, x, z, y0, height, radius, color, occlusion = 1) {
  b.box(`${name} plinth`, { x0: x - radius * 1.5, x1: x + radius * 1.5, y0, y1: y0 + 0.3, z0: z - radius * 1.5, z1: z + radius * 1.5 }, color, { metric: true, occlusion: occlusion * 1.18 });
  const shaftH = Math.max(0.6, height - 1.1);
  const geo = new THREE.CylinderGeometry(radius * 0.85, radius, shaftH, COLUMN_SEGMENTS, 8);
  // The ramp runs over the shaft's own height: 0.62 of the ambient at the capital, 1.0 at the base, and the
  // material's uniform term sits between them so the column's mean stays where the palette put it.
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  // Normalised so the ramp's own mean over the shaft is 1.0, so the column's mean stays where the palette
  // put it and only its distribution over the height changes.
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) + shaftH / 2) / shaftH; // 0 at the base, 1 at the capital
    const f = (0.60 + 0.40 * (1 - t)) / 0.80;
    colors[i * 3] = f;
    colors[i * 3 + 1] = f;
    colors[i * 3 + 2] = f;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const shaft = new THREE.Mesh(
    geo,
    makeMaterial({ color, roughness: 0.9, vertexColors: true, occlusion: occlusion * 0.82 }),
  );
  shaft.position.set(x, y0 + 0.3 + shaftH / 2, z);
  shaft.receiveShadow = true;
  b.add(shaft, `${name} shaft`);
  b.box(`${name} base torus`, { x0: x - radius * 1.15, x1: x + radius * 1.15, y0: y0 + 0.3, y1: y0 + 0.55, z0: z - radius * 1.15, z1: z + radius * 1.15 }, color, { occlusion: occlusion * 1.1 });
  b.box(`${name} capital`, { x0: x - radius * 1.4, x1: x + radius * 1.4, y0: y0 + height - 0.8, y1: y0 + height, z0: z - radius * 1.4, z1: z + radius * 1.4 }, color, { metric: true, occlusion: occlusion * 0.66 });
}

// A triangular pediment as a real gable, not as a stack of steps. The previous pass built it from six
// stepped slabs and rendered it: at the porch's own size -- 24 m wide and 3.9 m tall, 55 px by 8 px in the
// frame -- the steps read as a wedding cake rather than a gable, and the frame showed exactly that. Two
// raking cornices meeting at the apex, a tympanum set back between them and a horizontal cornice along the
// eave is both fewer meshes and the thing the sheet draws.
//
// `zFront` IS THE BACK PLANE HERE AND `depth` IS POSITIVE TOWARDS THE CAMERA, because the porch is now in
// +z: the pediment's mass runs from the wall (BACK_Z) forward to the eave plane. The tympanum is placed by
// its front face, 0.3 m behind the rakes, so the triangle is never an open frame with sky through it.
function pediment(b, name, cx, zFront, depth, halfWidth, yEave, yApex, rakeThickness = 0.42) {
  const rise = yApex - yEave;
  const slope = Math.atan2(rise, halfWidth);
  // THE RAKE'S OWN LENGTH, AND WHY IT IS ITS THICKNESS AND NOT A HALF METRE. Two boxes of thickness t
  // rotated to the slope and run to `hypot + e` past the corner cross each other above the apex and stand
  // `e * rise / hypot + t / cos(slope)` clear of it, which at the old +0.5 over a 0.85 m rise was a 0.5 m
  // spike -- the wedding cake in miniature. `e` is the thickness, which is the least overhang that closes
  // the mitre, and the apex block covers what is left.
  const len = Math.hypot(halfWidth, rise) + rakeThickness;
  // THE RAKE'S THICKNESS IS NOT A TASTE AND IT IS NOT THE SHEET'S 0.42 m EITHER -- IT WAS, AND NOW IT IS
  // AGAIN. It is passed in so the caller states it with the rise it belongs to: 0.26 was right for the old
  // 0.85 m rise, where a 0.42 m rake covers half the tympanum and leaves a wedge instead of a gable, and
  // 0.42 is right for the photograph's 2.09 m, where 0.26 is a pencil line under a 12 px-deep shadow.
  const rake = rakeThickness;
  const zc = zFront + depth / 2;
  for (const side of [-1, 1]) {
    const geo = new THREE.BoxGeometry(len, rake, depth);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COLORS.stoneTrim, roughness: 0.9, metalness: 0 }));
    mesh.position.set(cx + side * halfWidth * 0.5, yEave + rise * 0.5 + rake * 0.25, zc);
    mesh.rotation.z = -side * slope;
    // THE RAKE CASTS, AND THAT IS THE WHOLE OF WHY THE PORCH' INTERIOR WAS LIT. Nothing in this file set
    // `castShadow`, so the sun -- which stands north-east, 42 degrees up, i.e. IN FRONT of the north front --
    // reached straight into the recess and under the entablature. Measured: the recess wall displayed luma
    // 185 where the photograph has 63, and NO value of OCCLUSION can fix that on its own, because the
    // occlusion term scales the AMBIENT and the sun is direct. The pediment is 8.5 m above the recess wall's
    // head and 6.5 m north of it, so its shadow covers the wall -- which is exactly what the photograph
    // shows and what the sun's own comment in sky.js claims ("the porch casts the shadow the photograph
    // shows under it"). The rakes are the casters and not the eave cornice: the eave stands at z +6.95,
    // where its own shadow lands 8 m north of the wall on the terrace and never reaches it.
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    b.add(mesh, `${name} rake ${side < 0 ? 'west' : 'east'}`);
    // THE RAKE'S OWN MOULDING, WHICH IS WHAT MAKES THE GABLE READ AS STONE AND NOT AS A ROOF. A pediment's
    // raking cornice is not one flat band: it has a moulded face, and the photograph shows that face as a
    // pale line running down each slope with the tympanum set back behind it. Without it the pediment is a
    // grey triangle with two grey bands on its edges, which is exactly how a reviewer described this one
    // ("a plain grey triangle with a flat top"). This is a second, thinner box lying ON the rake's inner
    // edge and standing 0.14 m proud of it, so the run catches the sky above the tympanum's own shade.
    const mgeo = new THREE.BoxGeometry(len * 0.995, 0.16, depth + 0.14);
    const mmesh = new THREE.Mesh(mgeo, new THREE.MeshStandardMaterial({ color: COLORS.stoneTrim, roughness: 0.85, metalness: 0 }));
    mmesh.position.set(cx + side * (halfWidth * 0.5 - 0.20), yEave + rise * 0.5 - 0.16 + 0.08, zc + 0.04);
    mmesh.rotation.z = -side * slope;
    mmesh.receiveShadow = true;
    b.add(mmesh, `${name} rake moulding ${side < 0 ? 'west' : 'east'}`);
  }
  // The tympanum: the recessed triangle behind the rakes. THE BRIEF'S ITEM 2 SAYS THIS READS AS A DARK VOID
  // and it is right, but the void was the rig, not the colour: the photo's own box (u 0.45-0.55, v 0.325-0.342)
  // reads luma 80 against this render's 158 -- twice its value, the same 2x the porch soffit was out by.
  // It is the OCCLUSION.tympanum term that puts it back, and the sampled tone stays where it was sampled.
  //
  // AND IT KEEPS THE SAMPLED TONE, WHICH WAS PUT TO THE TEST AND WON. A reviewer's objection to this
  // pediment is that its face is "a plain grey triangle", and the first answer tried was to paint it the
  // wall's own stone (`wallUpper`), on the reasoning that a pediment's tympanum IS the wall's stone in
  // shade. It is, and the photograph still measures it darker: the photograph's own box for this face
  // (u 0.45-0.55, v 0.325-0.342) reads luma 81 with the pedimentFace hex and **157** with `wallUpper`,
  // against a photograph of 81-102 -- 1.94x, where the sampled hex was 1.28x. So the tone goes back to the
  // sample and the "plain" complaint is answered by the MOULDING and the CAP below rather than by the
  // colour, which is what was actually wrong with it: it had no edge and no point.
  const tymp = new THREE.Shape();
  tymp.moveTo(-halfWidth * 0.94, 0);
  tymp.lineTo(halfWidth * 0.94, 0);
  tymp.lineTo(0, rise * 0.9);
  tymp.closePath();
  const geo = new THREE.ExtrudeGeometry(tymp, { depth: depth * 0.62, bevelEnabled: false });
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, makeMaterial({ color: COLORS.pedimentFace, roughness: 0.95, occlusion: OCCLUSION.tympanum }));
  // The solid's +z end is its FRONT face, at the eave plane less 0.3 m, and it extrudes back towards the
  // wall: rotation.y = PI takes the shape's own +z to world -z.
  mesh.position.set(cx, yEave, zFront + depth - 0.3);
  mesh.rotation.y = Math.PI;
  mesh.receiveShadow = true;
  b.add(mesh, `${name} tympanum`);
  // The horizontal cornice along the eave, which is the line the eye reads the pediment's base from.
  //
  // ITS REAR IS DEEPER THAN ITS FRONT, AND THAT IS A MEASURED FIX RATHER THAN A MOULDING. Between the
  // entablature's top and the portico's own recess wall there is a gap the facade shows through: the
  // building's own frieze (building.js `north frieze`, y 12.35..13.45, its front face at z 0.22, i.e. 0.17 m
  // in FRONT of the recess wall's at 0.05), its cornice bed mould (z 0.24) and the second-floor window heads
  // (z 0.04) all stand between the recess wall and the camera, so the wall cannot occlude them however tall
  // it is. Measured at u 0.50: they draw luma 140-141 across v 0.4156..0.4356 where the photograph has 62-64
  // -- a 0.02-of-the-frame bright bar straight across the porch's centre, and the largest error left in the
  // porch. The eave cornice is the one member of the portico that reaches back to the wall, so its rear drops
  // to 15.15 m: at z 0.22 the underside then projects to v 0.4436 and at the wall's plane to 0.4022, which
  // covers the whole band from the front of the porch to the wall. Its FRONT face is untouched -- it is still
  // the 0.55 m band whose top row is the eave the photograph measures.
  b.box(`${name} eave cornice`, { x0: cx - halfWidth - 0.5, x1: cx + halfWidth + 0.5, y0: yEave - 0.85, y1: yEave, z0: zFront - 0.35, z1: zFront + depth + 0.45 }, COLORS.stoneTrim, { metric: true });
  // The apex's own cap. IT IS SMALLER THAN IT WAS, AND THAT IS THE REVIEWER'S "FLAT TOP". At 1.1 m wide and
  // 0.8 m tall over a gable whose whole rise is 1.90 m this block WAS the top of the pediment: it drew a
  // 13-px-wide flat rectangle across the apex where the photograph has a point. 0.6 m by 0.47 m is a cap on
  // a mitre rather than a block sitting on it, and the mitre itself is what the eye then reads.
  b.box(`${name} apex block`, { x0: cx - 0.30, x1: cx + 0.30, y0: yApex - 0.47, y1: yApex + 0.08, z0: zFront - 0.3, z1: zFront + depth + 0.4 }, COLORS.stoneTrim);
}
export function buildPortico(b) {
  const W = DIMS.porticoWidth;
  const floorY = PORTICO_HEIGHTS.floor;
  const colTop = PORTICO_HEIGHTS.columnTop;
  const r = DIMS.porticoColumnRadius;
  const colBase = PORTICO_HEIGHTS.columnBase;
  const entTop = PORTICO_HEIGHTS.entablatureTop;
  const yEave = PORTICO_HEIGHTS.pedimentBase;
  const yApex = PORTICO_HEIGHTS.apex;

  // ---- the North Portico --------------------------------------------------------------------------
  const columnX = [];
  for (let i = 0; i < DIMS.porticoColumnCount; i++) {
    const t = i / (DIMS.porticoColumnCount - 1) - 0.5;
    columnX.push(t * (W - 3.2)); // the outer columns' centres, which the photo puts at u 0.383 and 0.617
  }
  for (let i = 0; i < columnX.length; i++) {
    column(b, `north portico column ${i + 1}`, columnX[i], COLUMN_Z, colBase, colTop - colBase, r, COLORS.porticoColumn, OCCLUSION.column);
  }
  // The porch's own floor, from the colonnade back to the wall, so there is a deck for the columns to stand
  // on and a soffit over the recess. It is a deck under a roof: the colonnade and the entablature stand over
  // it and it sees a fraction of the sky the lawn outside does.
  //
  // IT IS AT THE TERRACE'S OWN LEVEL AND IT HAS NO STEPS, and both are the photograph's ruling rather than a
  // preference. The deck's north lip is at z +5.6 and the hedge's dark band covers rows 0.620 to 0.696 in
  // front of it, so a deck at the terrace's 2.976 m projects to v 0.6336 and is hidden; at the old 4.4 m it
  // projects to v 0.6025 and is NOT. The ramp that reaches this floor is the terrace itself (building.js),
  // so there is no flight to build at the north front -- and a 20-riser flight from 4.4 m would have run
  // down into the middle of the flower bed, which starts 5.6 m out.
  // ... AND ITS OWN NORTH FACE IS DARK, because the photograph's band there is. Looking down from 9.086 m the
  // camera sees three surfaces of this slab: the deck (rows 0.618 to 0.6336 at the centre) and the 0.7 m
  // face below its lip (0.6336 to 0.649). In the photograph those rows are the black hedge band -- luma 39 to
  // 73 at the wings, 27 to 46 across the middle -- and in the first cut of this pass they were pale stone and
  // read as a bright line straight across the porch's width. Under a north portico's floor is the ground
  // floor's areaway, and it is in shadow: the slab's sides take the porch's own dark tone and its deck keeps
  // the stone. Nothing about its size or its level moves.
  b.box('north portico floor', { x0: -W / 2 - 0.6, x1: W / 2 + 0.6, y0: floorY - 0.7, y1: floorY, z0: Z_FRONT - 0.9, z1: 0.3 }, { sides: COLORS.underPortico, top: COLORS.stoneTrim }, { metric: true, occlusion: OCCLUSION.porchFloor });
  // The entablature: architrave and frieze over the capitals, then the cornice, which overhangs. HABS sheet
  // 76's own entablature, and its cornice carries the dentil bed mould the photograph shows as a fine dark
  // band under the raking cornice.
  //
  // THREE MEMBERS, NOT ONE BOX. The brief's item 2 asks for the architrave, the frieze and the dentilled
  // cornice to be expressed separately so the porch's front carries three horizontal lines instead of one.
  // Each is set a little proud of the one below it, which is what makes a line read at 47 m: the shadow
  // under a 12 cm projection is a whole pixel here. They now run from the wall FORWARD to the eave plane,
  // since the porch is in +z.
  const arch = PORTICO_HEIGHTS.entablatureArchitrave;
  const friezeTop = PORTICO_HEIGHTS.entablatureFrieze;
  const corniceTop = PORTICO_HEIGHTS.entablatureCornice;
  b.box('north portico architrave', { x0: -W / 2 - 0.8, x1: W / 2 + 0.8, y0: colTop, y1: arch, z0: BACK_Z, z1: Z_FRONT }, COLORS.stoneTrim, { metric: true });
  // ITS FRIEZE CASTS TOO, and it is the second caster because the entablature is what the photograph shows
  // the shadow coming from at the recess wall's own head: the frieze is 1.3 m below the pediment and runs
  // the porch's whole depth, so between them the two cover the recess from its head down past the hedge.
  b.box('north portico frieze', { x0: -W / 2 - 0.85, x1: W / 2 + 0.85, y0: arch, y1: friezeTop, z0: BACK_Z - 0.05, z1: Z_FRONT + 0.05 }, COLORS.stoneTrim, { metric: true, occlusion: 0.86 }).castShadow = true;
  const dentilN = Math.max(1, Math.floor((W + 1.7) / 0.42));
  {
    // THE DENTIL'S OWN HEIGHT IS NOT THE ENTABLATURE'S, and it was allowed to become so: the block below is
    // 0.22 m tall on sheet 76's own scale, where the band from the frieze to the cornice was 0.30 m. When the
    // entablature grew to 1.28 m the dentil would have been stretched to 0.34 and read as a second frieze;
    // it is the sheet's size again, 0.14 of the band, and the bed mould below it takes the rest.
    //
    // AND IT STANDS ON THE FRIEZE'S OWN FACE, IN FRONT OF IT, WHICH IT DID NOT. The eave cornice's rear now
    // drops to 15.15 m (see the note on it), and its FRONT face at z +6.83 is 0.28 m proud of the frieze's
    // at +6.55, so at the old y 15.20..15.42 and z +6.38 the dentil row was inside the eave cornice's own
    // box: it was built, counted in the draw calls and never drawn. It is now below the eave's foot
    // (14.86..15.08 against 15.15) and proud of the frieze (z +6.60..+6.84), which is where the photograph
    // shows it -- the fine dark toothed band under the eave that the file's own header calls for.
    const geo = new THREE.BoxGeometry(0.22, 0.22, 0.24);
    const mesh = new THREE.InstancedMesh(geo, makeMaterial({ color: COLORS.corniceShadow, roughness: 0.9, occlusion: OCCLUSION.eaveUnder }), dentilN);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < dentilN; i++) {
      m4.makeTranslation(-W / 2 - 0.85 + (i + 0.5) * ((W + 1.7) / dentilN), 14.97, Z_FRONT + 0.22);
      mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    b.add(mesh, 'north portico dentils');
  }
  b.box('north portico cornice', { x0: -W / 2 - 1.2, x1: W / 2 + 1.2, y0: corniceTop - 0.20, y1: entTop, z0: BACK_Z - 0.2, z1: Z_FRONT + 0.33 }, COLORS.stoneTrim, { metric: true });
  // The porch's ceiling: the soffit between the wall and the entablature's back, which is what a camera
  // looking up into the recess sees, and the darkest surface the photograph has. Measured against the
  // photograph's own box (u 0.470-0.530, v 0.440-0.470, luma 71) this was displaying 139, exactly twice its
  // own value: it is the OCCLUSION term, not a colour, that puts it there.
  //
  // BOTH SOFFITS NOW HANG FROM THE ARCHITRAVE, i.e. from `arch`, because that is where the entablature's
  // underside is: at the old 14.04 they would sit 0.7 m below the entablature they belong to and read as a
  // second ceiling floating in the porch. Only the inner one is ever seen from the photo view -- the
  // colonnade soffit hides the other -- and both are kept because an orbit under the porch sees the pair.
  b.box('north portico soffit', { x0: -W / 2, x1: W / 2, y0: arch - 0.35, y1: arch, z0: BACK_Z, z1: COLUMN_Z + 0.6 }, COLORS.underPortico, { occlusion: OCCLUSION.porchInterior }).receiveShadow = true;
  // The wood soffit between the columns, at the entablature's underside: the plane the photograph shows as
  // the porch's own ceiling when the camera is low enough to see under the architrave. It is the surface
  // HABS sheet 76's own "soffit plan" draws, and without it the recess has no lid.
  b.box('north portico colonnade soffit', { x0: -W / 2, x1: W / 2, y0: entTop - 0.22, y1: entTop, z0: COLUMN_Z - 0.5, z1: Z_FRONT + 0.1 }, COLORS.underPortico, { occlusion: OCCLUSION.porchInterior }).receiveShadow = true;
  // THE PORCH'S OWN INTERIOR: the wall the colonnade stands in front of, which is the single change that
  // turns the porch from a flat panel into a porch. It is the same wall the open facade uses, at the same
  // plane, but the sun cannot reach it past the entablature and the sky sees it through a colonnade, so it
  // carries OCCLUSION.porchRecess and its own material rather than the open facade's. It stands 3 cm proud
  // of the wall behind it so no face is coplanar with anything.
  // ITS HEAD IS THE ENTABLATURE'S OWN TOP AND ITS FACE IS THE FACADE'S OWN FRONT PLANE, and both are the
  // answer to the same measurement. Between the entablature and the colonnade the photograph shows DARK
  // SHADE across the porch's centre, and this render showed three members of the open facade lit at 140-141
  // where the photograph has 56-64: the building's frieze (`north frieze`, y 12.35..13.45), its cornice bed
  // mould (y 13.82..14.00) and the second-floor window heads (y 12.42..12.64). All three stand at z +0.04
  // to +0.24, i.e. IN FRONT of a wall at z 0.02..0.05, so a wall of any height is behind them and cannot
  // occlude them -- measured, not argued: at u 0.50 v 0.4244 the ray enters the frieze at 47.80 m and
  // reaches the recess wall only at 47.97, and hiding the frieze moves that pixel from 140 to 77.
  //
  // So the wall's face is the facade's own front plane, z 0.30, which stands 0.08 m proud of the deepest of
  // the three (the cornice bed mould at 0.24) and closes the porch the way the building does.
  //
  // AND IT IS ONE SLAB, WHICH IS THE SECOND ANSWER TO THE SAME QUESTION AND THE ONE THE MEASUREMENT WANTS.
  // The photograph's recess is not blank -- it shows the second-floor windows and their heads in shade --
  // so a piers-and-lintel version of this wall was built with an opening on each of the portico's three bays
  // and rendered. IT IS WORSE ON BOTH COUNTS AND IT IS REVERTED:
  //
  //   the recess's own tone, u 0.47..0.53    photograph 50-74   this slab 79   the openings 128-190
  //   cell distance / SSIM                   this slab 0.1031 / 0.3918   the openings 0.1083 / 0.3725
  //
  // and the reason is a lighting fact rather than a modelling one: THE FACADE BEHIND THE PORTICO IS NOT IN
  // SHADOW IN THIS RIG. The sun stands north-east and in front of the north front, and the shadow map's
  // normalBias is 0.6 m against raking cornices 0.42 m thick, so the rakes throw almost no shadow onto the
  // wall behind them (measured: out/critic/wh3light.mjs finds 0 luma of the sun on the recess wall, but the
  // wall 0.3 m behind it is lit). Opening the wall therefore shows a BRIGHT wall with dark window holes,
  // where the photograph shows a dark recess with faintly lit windows. The slab's own tone is 79 against
  // the photograph's 50-74, which is the closest of the three, and the windows behind it are a defect this
  // pass names rather than one it can fix without a shadowing change to the rig, which is out of scope.
  b.box('north portico recess wall', { x0: -W / 2 + 1.0, x1: W / 2 - 1.0, y0: FACADE.wallBase, y1: entTop, z0: 0.02, z1: 0.30 }, COLORS.porchRecessPigment, { occlusion: OCCLUSION.porchInterior }).receiveShadow = true;
  // The entrance, rebuilt to stand INSIDE the recess and to be SMALL ENOUGH NOT TO BE THE PORCH. The previous
  // pass put the door at z -0.6..-0.15, which is behind the recess wall and inside the main wall's own
  // thickness, so it could not be seen at all. The first attempt at fixing that then put a 4.8 m wide trim
  // panel at z 0.02..0.12, which stood in FRONT of the recess wall across the porch's centre and turned the
  // whole bay pale (measured: u 0.42 and 0.50 at v 0.44 read luma 217 and 248 against the photograph's 65).
  // THE ARCHITRAVE IS NOW THE SIZE OF THE DOOR IT FRAMES AND NO BIGGER, and the door is the darkest thing in
  // the porch, which is what the photograph shows: a dark opening with a pale frame a few centimetres wide.
  //
  // AND ITS FRAME IS NOT THE OPEN FACADE'S TRIM. `windowTrim` (0x798592) is the photograph's own value for a
  // window head on a wall in the open sky; behind a colonnade the same moulding is in the porch's shade, and
  // measured against the photograph's own box for it (u 0.470-0.530 v 0.44-0.47 is the wall, and the frame
  // is the pale pair of lines beside the door) it displayed 203 where the photograph has 112. It takes the
  // recess's own pigment, which is the same correction and the same measurement as the wall's.
  b.box('north entrance doorway', { x0: -1.9, x1: 1.9, y0: floorY, y1: floorY + 4.6, z0: 0.06, z1: 0.10 }, COLORS.underPortico, { occlusion: 0.10 });
  b.box('north entrance fanlight', { x0: -1.4, x1: 1.4, y0: floorY + 3.5, y1: floorY + 4.4, z0: 0.05, z1: 0.07 }, COLORS.windowGlass, { occlusion: 0.16 });
  for (const side of [-1, 1]) {
    b.box(`north entrance surround ${side < 0 ? 'west' : 'east'}`, { x0: side < 0 ? -2.15 : 1.9, x1: side < 0 ? -1.9 : 2.15, y0: floorY - 0.3, y1: floorY + 4.9, z0: 0.04, z1: 0.11 }, COLORS.porchRecessPigment, { occlusion: 0.28 });
  }
  b.box('north entrance surround head', { x0: -2.15, x1: 2.15, y0: floorY + 4.6, y1: floorY + 4.95, z0: 0.04, z1: 0.11 }, COLORS.porchRecessPigment, { occlusion: 0.28 });
  pediment(b, 'north portico pediment', 0, BACK_Z, Z_FRONT - BACK_Z, W / 2 + 1.2, yEave, yApex, 0.42);

  // ---- the South Portico --------------------------------------------------------------------------
  // A bowed centre with a flat-roofed semicircular colonnade on a rusticated podium. NO pediment: the
  // sources agree the south portico is flat-roofed (out/wh/habs-findings.md, sheet 34).
  const bowR = DIMS.southBowRadius;
  const bowProj = DIMS.southBowProjection;
  const southGrade = -DIMS.southLawnDrop;
  const podiumTop = southGrade + DIMS.southPodiumHeight;
  const zSouth = -DIMS.blockDepth;
  const bowCentreZ = zSouth + 1.0;
  const bow = new THREE.Mesh(
    new THREE.CylinderGeometry(bowR, bowR, DIMS.southFacade, 32, 1, false, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: COLORS.wallLit, roughness: 0.9, metalness: 0 }),
  );
  bow.rotation.y = Math.PI; // the flat half against the wall, the round half facing south
  bow.position.set(0, southGrade + DIMS.southFacade / 2, bowCentreZ);
  bow.receiveShadow = true;
  b.add(bow, 'south bow');
  b.box('south portico podium', { x0: -bowR - 1.6, x1: bowR + 1.6, y0: southGrade - 0.1, y1: podiumTop, z0: bowCentreZ - bowR - 1.2, z1: bowCentreZ - bowR + bowProj + 1.2 }, COLORS.stoneTrim, { metric: true });
  const southColTop = podiumTop + 9.0;
  for (let i = 0; i < DIMS.southColumnCount; i++) {
    const a = DEG * (25 + (130 * i) / (DIMS.southColumnCount - 1));
    const x = Math.cos(a) * (bowR - 1.0);
    const z = bowCentreZ - Math.sin(a) * (bowR - 1.0);
    column(b, `south portico column ${i + 1}`, x, z, podiumTop, southColTop - podiumTop, 0.55, COLORS.stoneTrim);
  }
  b.box('south portico entablature', { x0: -bowR - 0.4, x1: bowR + 0.4, y0: southColTop, y1: southColTop + 1.1, z0: bowCentreZ - bowR - 0.4, z1: bowCentreZ - bowR + bowProj + 0.9 }, COLORS.stoneTrim, { metric: true });
  b.box('south portico roof', { x0: -bowR - 0.6, x1: bowR + 0.6, y0: southColTop + 1.1, y1: southColTop + 1.6, z0: bowCentreZ - bowR - 0.6, z1: bowCentreZ - bowR + bowProj + 1.1 }, COLORS.roof, { metric: true });
  const stairRisers = 20;
  for (const side of [-1, 1]) {
    for (let i = 0; i < stairRisers; i++) {
      const y = podiumTop - ((i + 1) * (podiumTop - southGrade)) / stairRisers;
      const z = bowCentreZ - bowR + bowProj + 1.1 + i * 0.34;
      b.box(
        `south staircase ${side < 0 ? 'west' : 'east'} step ${i + 1}`,
        { x0: side * 2.0 + (side < 0 ? -4.6 : 0), x1: side * 2.0 + (side < 0 ? 0 : 4.6), y0: y - 0.3, y1: y, z0: z, z1: z + 0.38 },
        COLORS.stoneTrim,
        { metric: true },
      );
    }
  }
  void TERRACE;
  return b.group;
}
