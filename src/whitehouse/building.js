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

// A six-over-six sash in plan-relief against the wall. Returns nothing; it adds to b. The glass is a dark
// recess and the muntins and the meeting rail are the wall's own trim laid over it, which is how the
// photograph reads at this scale: the sash is a grid of light bars on a dark rectangle.
function sash(b, name, cx, cy, w, h, depth) {
  const glass = { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2, z0: depth.z0, z1: depth.z1 };
  b.box(`${name} glass`, glass, COLORS.windowGlass);
  const bar = 0.055; // [estimate] a muntin at the photograph's own 1 px
  const z = depth.z0 - 0.03;
  b.box(`${name} meeting rail`, { x0: cx - w / 2, x1: cx + w / 2, y0: cy - bar / 2, y1: cy + bar / 2, z0: z, z1: z + 0.05 }, COLORS.windowTrim);
  b.box(`${name} stile`, { x0: cx - bar / 2, x1: cx + bar / 2, y0: cy - h / 2, y1: cy + h / 2, z0: z, z1: z + 0.05 }, COLORS.windowTrim);
  for (const side of [-1, 1]) {
    for (const frac of [1 / 3, 2 / 3]) {
      const y = cy + side * (h / 2) * (2 * frac - 1);
      b.box(`${name} muntin ${side} ${frac.toFixed(2)}`, { x0: cx - w / 2, x1: cx + w / 2, y0: y - bar / 2, y1: y + bar / 2, z0: z, z1: z + 0.05 }, COLORS.windowTrim);
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
  // to the lawn at TERRACE.outerZ. Split either side of the centre so the portico's steps get the middle.
  //
  // THE BAND THE PHOTOGRAPH SHOWS BELOW THE WALL'S BASE IS THIS TERRACE'S OUTER RIM, PLANTED. The terrace is
  // 2.976 m tall because the wall's base is, and the camera is 9.086 m up at 47.863 m, so everything the
  // frame shows between the wall's base row and the lawn is the terrace's own outer face. A separate hedge
  // standing behind that face is not in the frame at any height that would not also hide the wall, which is
  // why grounds.js no longer builds one. The face is therefore built as one prism with two parts: a shallow
  // step of the terrace's own stone at the top -- the "parapet" of the raised ramp, which is the pale line
  // the photograph shows just under the wall -- and the planted slope below it, which is the photograph's
  // dark band. One prism, so nothing coincides with anything and nothing is hidden behind anything.
  const stepGap = 13.5;
  const tz = TERRACE.outerZ;
  const rim = TERRACE.rim; // how much of the outer edge is stone step, and how far it steps
  for (const [name, x0, x1] of [['west', -halfW - 6, -stepGap], ['east', stepGap, halfW + 6]]) {
    b.box(`north terrace ${name}`, { x0, x1, y0: -0.4, y1: y0, z0: -tz + rim.depth, z1: 0.2 }, COLORS.terraceStone, { metric: true });
    const stepZ = tz - 0.35;
    b.profileSolid(
      `north terrace ${name} parapet`,
      [
        [stepZ, y0],
        [tz, y0 - 0.35],
        [tz, -0.4],
        [stepZ, -0.4],
      ],
      x0,
      x1,
      COLORS.stoneTrim,
    );
    b.profileSolid(
      `north terrace ${name} rim`,
      [
        [stepZ - rim.depth, y0 - 0.35],
        [stepZ, y0 - 0.35 - rim.drop],
        [stepZ, -0.4],
        [stepZ - rim.depth, -0.4],
      ],
      x0,
      x1,
      COLORS.terraceRim,
    );
  }
  b.box('north terrace west return', { x0: -halfW - 6.3, x1: -halfW - 6, y0: -0.4, y1: y0 + 0.55, z0: -tz, z1: 0.2 }, COLORS.terraceStone);
  b.box('north terrace east return', { x0: halfW + 6, x1: halfW + 6.3, y0: -0.4, y1: y0 + 0.55, z0: -tz, z1: 0.2 }, COLORS.terraceStone);

  // ---- the four walls --------------------------------------------------------------------------------
  b.box('north wall', { x0: -halfW, x1: halfW, y0, y1: FACADE.parapet, z0: zN - wallT, z1: zN }, COLORS.wallMid, { metric: true });
  b.box('south wall', { x0: -halfW, x1: halfW, y0: -DIMS.southLawnDrop, y1: FACADE.parapet, z0: zS, z1: zS + wallT }, COLORS.wallMid, { metric: true });
  b.box('west wall', { x0: -halfW, x1: -halfW + wallT, y0: -DIMS.southLawnDrop, y1: FACADE.parapet, z0: zS, z1: zN }, COLORS.wallMid, { metric: true });
  b.box('east wall', { x0: halfW - wallT, x1: halfW, y0: -DIMS.southLawnDrop, y1: FACADE.parapet, z0: zS, z1: zN }, COLORS.wallMid, { metric: true });
  // The wall's own vertical shading: the sky term is stronger high up and the ground's lower down, and the
  // render cannot make that ramp out of a single box's flat normal at this size, so the wall is banded.
  // Three bands is what the photograph's own profile resolves to at 1 m of height per pixel.
  for (const [name, ya, yb, color] of [
    ['upper', 12.6, FACADE.parapet, COLORS.wallUpper],
    ['lower', y0, 5.9, COLORS.wallLit],
  ]) {
    b.box(`north wall ${name} band`, { x0: -halfW, x1: halfW, y0: ya, y1: yb, z0: zN - 0.02, z1: zN + 0.02 }, color);
  }

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
  const glassZ = { z0: zN - 0.34, z1: zN - 0.20 };
  for (let i = 1; i <= BAYS.count; i++) {
    const cx = BAYS.centreX(i);
    const behindPortico = BAYS.porticoBays.includes(i);
    // The first floor: a reveal, the sash, the sill on blocks, the architrave head, and the pediment on its
    // console brackets. The photograph alternates the triangle and the segment, bay by bay, and the bay
    // nearest the portico on each side carries the triangle.
    const firstH = FACADE.firstHead - FACADE.firstSill;
    b.box(`bay ${i} first floor reveal`, { x0: cx - winW / 2 - 0.06, x1: cx + winW / 2 + 0.06, y0: FACADE.firstSill - 0.06, y1: FACADE.firstHead + 0.06, z0: zN - 0.36, z1: zN - 0.04 }, COLORS.underPortico);
    sash(b, `bay ${i} first floor sash`, cx, (FACADE.firstSill + FACADE.firstHead) / 2, winW, firstH, glassZ);
    b.box(`bay ${i} first floor surround sill`, { x0: cx - winW / 2 - 0.22, x1: cx + winW / 2 + 0.22, y0: FACADE.firstSill - 0.22, y1: FACADE.firstSill, z0: zN - 0.40, z1: zN + 0.04 }, COLORS.windowTrim);
    // The two small blocks the sill sits on (HABS sheet 82's own note).
    for (const side of [-1, 1]) {
      b.box(`bay ${i} first floor sill block ${side < 0 ? 'west' : 'east'}`, { x0: cx + side * (winW / 2 - 0.1) - 0.14, x1: cx + side * (winW / 2 - 0.1) + 0.14, y0: FACADE.firstSill - 0.44, y1: FACADE.firstSill - 0.22, z0: zN - 0.38, z1: zN + 0.04 }, COLORS.windowTrim);
    }
    b.box(`bay ${i} first floor surround head`, { x0: cx - winW / 2 - 0.22, x1: cx + winW / 2 + 0.22, y0: FACADE.firstHead, y1: FACADE.firstHead + 0.22, z0: zN - 0.42, z1: zN + 0.04 }, COLORS.windowTrim);
    b.box(`bay ${i} first floor surround west`, { x0: cx - winW / 2 - 0.22, x1: cx - winW / 2, y0: FACADE.firstSill, y1: FACADE.firstHead, z0: zN - 0.40, z1: zN + 0.04 }, COLORS.windowTrim);
    b.box(`bay ${i} first floor surround east`, { x0: cx + winW / 2, x1: cx + winW / 2 + 0.22, y0: FACADE.firstSill, y1: FACADE.firstHead, z0: zN - 0.40, z1: zN + 0.04 }, COLORS.windowTrim);
    // The panel with a moulded border under the sill, which sheet 82 draws below every window.
    b.box(`bay ${i} first floor apron`, { x0: cx - winW / 2 - 0.1, x1: cx + winW / 2 + 0.1, y0: FACADE.firstSill - 1.05, y1: FACADE.firstSill - 0.44, z0: zN - 0.12, z1: zN + 0.03 }, COLORS.windowTrim);

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
    b.box(`bay ${i} second floor reveal`, { x0: cx - winW / 2 - 0.05, x1: cx + winW / 2 + 0.05, y0: FACADE.secondSill - 0.05, y1: FACADE.secondHead + 0.05, z0: zN - 0.30, z1: zN - 0.04 }, COLORS.underPortico);
    sash(b, `bay ${i} second floor sash`, cx, (FACADE.secondSill + FACADE.secondHead) / 2, winW, secondH, { z0: zN - 0.28, z1: zN - 0.16 });
    b.box(`bay ${i} second floor sill`, { x0: cx - winW / 2 - 0.20, x1: cx + winW / 2 + 0.20, y0: FACADE.secondSill - 0.20, y1: FACADE.secondSill, z0: zN - 0.34, z1: zN + 0.04 }, COLORS.windowTrim);
    b.box(`bay ${i} second floor head`, { x0: cx - winW / 2 - 0.20, x1: cx + winW / 2 + 0.20, y0: FACADE.secondHead, y1: FACADE.secondHead + 0.22, z0: zN - 0.36, z1: zN + 0.04 }, COLORS.windowTrim);
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
