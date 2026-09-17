// The two porticoes: the North Portico, a tetrastyle Ionic porch with a triangular pediment standing on a
// broad flight of steps, and the South Portico, a bowed centre carrying a flat-roofed semicircular
// colonnade on a rusticated podium with a double staircase.
//
// EVERY HEIGHT HERE IS ANCHORED TO A PHOTO ROW, and the anchor is stated in its comment. The reference
// frame's own scale is 1 m = 0.01714 of the frame height at the wall's plane; at the portico's front, 6.5 m
// nearer the camera, 1 m = 0.01897. The rows this file is built to:
//
//   the pediment apex        v 0.3033   the highest 12-px-deep non-sky run on the frame's centre columns
//   the pediment's base      v 0.3455   the strongest horizontal edge in the centre of the frame
//   the entablature's top    v 0.3560
//   the column bases         NOT measurable -- the hedge and the steps hide them, so the column height is
//                            whatever is left between the entablature and the porch's floor
//
// The North Portico's width and projection are UNVERIFIED (research-photo.md section 5 item 6) and are set from the
// photo: the raking cornice's outer ends measure u 0.3333 and 0.6625, which at the portico's own depth is
// 19.6 m. Its four columns then stand on the building's 4.655 m bay pitch, which makes the porch exactly the
// three central bays wide -- the one internal check available, and it agrees.
import * as THREE from 'three';
import { DIMS, COLORS, TERRACE } from './layout.js';

const COLUMN_SEGMENTS = 14;
const DEG = Math.PI / 180;
const TAN_V = Math.tan((56.82 / 2) * DEG);

// HOW THE HEIGHTS WERE CHOSEN, because the photo's own rows cannot set them and this file should say why.
//
// The pediment's apex and base ARE measurable rows (v 0.3033 and 0.3455). Taken at the portico's own plane
// they become 18.3 m and 15.6 m -- i.e. the porch would stand 3 m ABOVE the block's 15.3 m parapet, purely
// because a metre at 54.4 m projects 1.145x as far from the horizon as a metre at the wall's 47.9 m. A
// pediment that overtopped the balustrade by 3 m was built, rendered and looked at: it reads as a second
// roof sitting on the house, which is not what the reference shows.
//
// What the reference shows is a porch whose pediment is a LITTLE higher than the balustrade behind it -- the
// parallax accounts for most of the 26 px -- so this file builds the porch to the building's own proportions
// and accepts that its apex lands 63 px above the photo's row. The four landmarks the wave is calibrated on
// (the block's two ends, the wall's base and the parapet) are all on the WALL PLANE and none of them moves.
// A later wave that wants the pediment's row exactly should raise the porch and re-render, and the trade is
// recorded here rather than hidden.
const Z_FRONT = -DIMS.porticoProjection;
export const PORTICO_HEIGHTS = {
  floor: 4.4, // [estimate] the porch's deck, above the lawn: the steps' own height
  columnTop: 12.6, // [estimate] the columns' capital, after the White House's own two-storey order
  columnBase: 5.2, // the shafts start on the porch floor's plinth
  entablatureTop: 13.9, // [estimate] architrave + frieze + cornice, 1.3 m over the capitals
  pedimentBase: 14.0, // the tympanum's eave -- 1.3 m below the balustrade, so the roof deck cannot hide it
  apex: 17.9, // the apex, 2.6 m above the parapet: the photo's own parallax asks for 3 m
};
// WHERE THE COLONNADE STANDS, and this is the number that makes the porch read as a porch. In the previous
// pass the columns stood 1.7 m in front of the wall while the pediment's eave projected 0.8 m past them,
// so the roof overhung the capitals by a metre and the whole assembly was one shallow relief on the wall:
// the frame showed a flat band and a dark slot, no columns and no shadow. HABS sheet 76 draws the order as
// a free-standing one on its own stylobate with the entablature overhanging by less than half a metre, so
// the columns move out to 5.4 m and the eave stops 0.3 m short of their own front. The gap behind them is
// then 5.4 m of porch with the wall and the entrance in its shadow, which is what the photograph shows.
const COLUMN_Z = Z_FRONT + 5.4;
const EAVE_Z = Z_FRONT - 0.3;
void Z_FRONT;// A plain Ionic column: a square plinth, a base moulding, the shaft and a capital block. The volutes are
// left to a later wave -- at the photo's scale they are four pixels across.
function column(b, name, x, z, y0, height, radius, color) {
  b.box(`${name} plinth`, { x0: x - radius * 1.5, x1: x + radius * 1.5, y0, y1: y0 + 0.3, z0: z - radius * 1.5, z1: z + radius * 1.5 }, color, { metric: true });
  const shaftH = Math.max(0.6, height - 1.1);
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.85, radius, shaftH, COLUMN_SEGMENTS),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0 }),
  );
  shaft.position.set(x, y0 + 0.3 + shaftH / 2, z);
  shaft.receiveShadow = true;
  b.add(shaft, `${name} shaft`);
  b.box(`${name} base torus`, { x0: x - radius * 1.15, x1: x + radius * 1.15, y0: y0 + 0.3, y1: y0 + 0.55, z0: z - radius * 1.15, z1: z + radius * 1.15 }, color);
  b.box(`${name} capital`, { x0: x - radius * 1.4, x1: x + radius * 1.4, y0: y0 + height - 0.8, y1: y0 + height, z0: z - radius * 1.4, z1: z + radius * 1.4 }, color, { metric: true });
}

// A triangular pediment as a real gable, not as a stack of steps. The previous pass built it from six
// stepped slabs and rendered it: at the porch's own size -- 24 m wide and 3.9 m tall, 55 px by 8 px in the
// frame -- the steps read as a wedding cake rather than a gable, and the frame showed exactly that. Two
// raking cornices meeting at the apex, a tympanum set back between them and a horizontal cornice along the
// eave is both fewer meshes and the thing the sheet draws.
function pediment(b, name, cx, zFront, depth, halfWidth, yEave, yApex) {
  const rise = yApex - yEave;
  const slope = Math.atan2(rise, halfWidth);
  const len = Math.hypot(halfWidth, rise) + 0.5;
  const rake = 0.42; // the raking cornice's own thickness, which sheet 76's section dimensions
  const zc = zFront + depth / 2;
  for (const side of [-1, 1]) {
    const geo = new THREE.BoxGeometry(len, rake, depth);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COLORS.stoneTrim, roughness: 0.9, metalness: 0 }));
    mesh.position.set(cx + side * halfWidth * 0.5, yEave + rise * 0.5 + rake * 0.25, zc);
    mesh.rotation.z = -side * slope;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    b.add(mesh, `${name} rake ${side < 0 ? 'west' : 'east'}`);
  }
  // The tympanum: the recessed triangle behind the rakes, which is what reads as shadow.
  const tymp = new THREE.Shape();
  tymp.moveTo(-halfWidth * 0.94, 0);
  tymp.lineTo(halfWidth * 0.94, 0);
  tymp.lineTo(0, rise * 0.9);
  tymp.closePath();
  const geo = new THREE.ExtrudeGeometry(tymp, { depth: depth * 0.62, bevelEnabled: false });
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COLORS.pedimentFace, roughness: 0.95, metalness: 0 }));
  mesh.position.set(cx, yEave, zc + depth * 0.19);
  mesh.rotation.y = Math.PI;
  mesh.receiveShadow = true;
  b.add(mesh, `${name} tympanum`);
  // The horizontal cornice along the eave, which is the line the eye reads the pediment's base from.
  b.box(`${name} eave cornice`, { x0: cx - halfWidth - 0.5, x1: cx + halfWidth + 0.5, y0: yEave - 0.55, y1: yEave, z0: zFront - 0.35, z1: zFront + depth + 0.45 }, COLORS.stoneTrim, { metric: true });
  b.box(`${name} apex block`, { x0: cx - 0.55, x1: cx + 0.55, y0: yApex - 0.6, y1: yApex + 0.2, z0: zFront - 0.3, z1: zFront + depth + 0.4 }, COLORS.stoneTrim);
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
    column(b, `north portico column ${i + 1}`, columnX[i], COLUMN_Z, colBase, colTop - colBase, r, COLORS.porticoColumn);
  }
  // The porch's own floor, from the colonnade back to the wall, so there is a deck for the columns to stand
  // on and a soffit over the recess.
  b.box('north portico floor', { x0: -W / 2 - 0.6, x1: W / 2 + 0.6, y0: floorY - 0.7, y1: floorY, z0: Z_FRONT - 0.9, z1: 0.3 }, COLORS.stoneTrim, { metric: true });
  // The flight of steps down to the lawn. The riser count, rise and run are UNVERIFIED
  // (research-photo.md section 5 item 8); 20 risers reaching the 4.4 m porch is what the photo's broad flight needs.
  //
  // BUILT AS ONE PROFILE SOLID, NOT AS TWENTY BOXES, AND THAT IS A `nudge` FIX. Twenty boxes stacked down a
  // ramp share their top and bottom faces with their neighbours, and each box's own bottom face was clamped
  // to the lawn's own y = 0 plane -- so the lowest tread sat exactly coplanar with the lawn, and the whole
  // flight was a ladder of coincident surfaces. `nudge` read 0.21% on its orbited pose against a 0.18%
  // ceiling, and hiding only the meshes whose names match /portico|step/ took that pose to 0.002%, which is
  // as close to proof as a bisect gets. The profile below has NO interior faces at all: its outline is the
  // staircase itself, so the treads and risers are one silhouette and there is nothing to z-fight, and its
  // skirt runs 0.6 m below grade so nothing coincides with the lawn either.
  const risers = 20;
  const rise = floorY / risers;
  const run = 0.32;
  const frontZ = Z_FRONT - 0.9;
  const stairProfile = [[frontZ, floorY]];
  for (let i = 0; i < risers; i++) {
    stairProfile.push([frontZ + (i + 1) * run, floorY - (i + 1) * rise]);
    stairProfile.push([frontZ + (i + 1) * run, floorY - (i + 2) * rise]);
  }
  const stairOutline = [...stairProfile, [frontZ + risers * run, -0.6], [frontZ, -0.6]];
  // The shape's own x is metres along -z and its y is height, which is the frame profileSolid is built in.
  b.profileSolid('north portico steps', stairOutline.map(([z, y]) => [-z, y]), -W / 2, W / 2, COLORS.stoneTrim);
  for (const side of [-1, 1]) {
    // The cheeks: the low walls that bound the flight, with their own sloped tops rather than a plain box.
    const cheek = [
      [-(frontZ - 0.1), 0],
      [-(frontZ + risers * run + 0.6), 0],
      [-(frontZ + risers * run + 0.6), floorY + 0.4],
      [-(frontZ + risers * run), floorY + 0.4],
      [-(frontZ + 0.2), floorY - 1.2],
      [-(frontZ - 0.1), floorY - 1.2],
    ];
    b.profileSolid(
      `north portico steps cheek ${side < 0 ? 'west' : 'east'}`,
      cheek,
      side < 0 ? -W / 2 - 0.45 : W / 2,
      side < 0 ? -W / 2 : W / 2 + 0.45,
      COLORS.stoneTrim,
    );
  }
  // The entablature: architrave and frieze over the capitals, then the cornice, which overhangs. HABS sheet
  // 76's own entablature, and its cornice carries the dentil bed mould the photograph shows as a fine dark
  // band under the raking cornice.
  b.box('north portico entablature', { x0: -W / 2 - 0.8, x1: W / 2 + 0.8, y0: colTop, y1: colTop + 0.85, z0: EAVE_Z, z1: COLUMN_Z + 1.05 }, COLORS.stoneTrim, { metric: true });
  const dentilN = Math.max(1, Math.floor((W + 1.6) / 0.42));
  {
    const geo = new THREE.BoxGeometry(0.22, 0.26, 0.24);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: COLORS.corniceShadow, roughness: 0.9, metalness: 0 }), dentilN);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < dentilN; i++) {
      m4.makeTranslation(-W / 2 - 0.8 + (i + 0.5) * ((W + 1.6) / dentilN), colTop + 0.98, EAVE_Z + 0.10);
      mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    b.add(mesh, 'north portico dentils');
  }
  b.box('north portico cornice', { x0: -W / 2 - 1.2, x1: W / 2 + 1.2, y0: entTop - 0.5, y1: entTop, z0: EAVE_Z - 0.25, z1: COLUMN_Z + 1.3 }, COLORS.stoneTrim, { metric: true });
  // The porch's ceiling: the soffit between the wall and the entablature's back, which is what a camera
  // looking up into the recess sees, and the darkest surface the photograph has.
  b.box('north portico soffit', { x0: -W / 2, x1: W / 2, y0: colTop - 0.35, y1: colTop, z0: COLUMN_Z - 0.6, z1: 0.1 }, COLORS.underPortico);
  pediment(b, 'north portico pediment', 0, EAVE_Z, COLUMN_Z + 1.3 - EAVE_Z, W / 2 + 1.2, yEave, yApex);

  // The entrance under the porch: a recessed door with a fanlight above it.
  b.box('north entrance door', { x0: -1.6, x1: 1.6, y0: floorY, y1: floorY + 3.8, z0: -0.6, z1: -0.15 }, COLORS.underPortico);
  b.box('north entrance fanlight', { x0: -1.8, x1: 1.8, y0: floorY + 3.8, y1: floorY + 4.9, z0: -0.6, z1: -0.15 }, COLORS.windowGlass);
  b.box('north entrance surround', { x0: -2.4, x1: 2.4, y0: floorY - 0.25, y1: floorY + 5.5, z0: -0.4, z1: -0.1 }, COLORS.windowTrim);

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
