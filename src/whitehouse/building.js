// The main block: the north wall with its eleven bays of windows, the belt course, the cornice, the
// balustraded parapet, the flat deck behind it and the roofscape above, plus the south wall, the two end
// walls, and the terrace the north front stands on.
//
// THE NORTH WALL STANDS ON A TERRACE, NOT ON THE LAWN. TERRACE.baseY is 2.976 m: the camera solve's two
// measured rows (v 0.6180 at the wall's visible base and v 0.3800 at the parapet) demand it, because "the
// ground floor is hidden by a raised carriage ramp and parapet" (Wikipedia, citing NPS) and a hedge band
// runs the length of the wall. So y = 0 is the north LAWN and every height in FACADE is above that lawn;
// the wall's own base is at TERRACE.baseY.
//
// Everything is axis-aligned boxes except the balustrade, which is a cap, a rail and one box per baluster at
// a fixed pitch, and the two hand-built geometries carry computeVertexNormals.
import * as THREE from 'three';
import { DIMS, BAYS, COLORS, TERRACE } from './layout.js';

// The north facade's own horizontal bands, in metres above the NORTH LAWN. Read off the reference photo by
// the fitted camera's own scale: at the wall's plane 1 m is 0.01714 of the frame height (15.3 m over the
// frame's v 0.3800 to 0.6180 at the base's own height), so a measured row converts directly.
//
//   the first-floor glass  v 0.5680 (head) to 0.6120 (sill)  ->  7.22 m to 4.16 m
//   the second-floor glass v 0.4350 (head) to 0.4900 (sill)  ->  12.42 m to 9.24 m
export const FACADE = {
  base: 0.0, // the north LAWN. The wall's own base is TERRACE.baseY
  wallBase: TERRACE.baseY, // 2.976 m: where the bright wall begins, above the terrace and the hedge
  firstSill: 4.16,
  firstHead: 7.22,
  belt: 7.9, // the string course between the storeys -- [estimate]
  secondSill: 9.24,
  secondHead: 12.42,
  cornice: 13.9, // the main cornice under the balustrade -- [estimate]
  parapet: 15.3, // the top of the balustrade: the photo's own v 0.3800, and the published 50 ft 4 in
  balustradeTop: 15.3,
  balustradeBottom: 14.15,
  deckTop: 14.0, // the flat deck behind the balustrade -- this wave does NOT build a hip roof
  roofRise: 1.1, // [estimate] the ridge of the low roof that shows above the deck, behind the balustrade
  chimneyTop: 17.0, // [estimate] the photo shows chimney stacks above the parapet line
  height: 15.3,
};

const BALUSTER_PITCH = 0.62;
const BALUSTER_WIDTH = 0.24;

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
  // The gap either side of the centre leaves the portico's steps and its flanking hedges clear: the porch
  // is 21.5 m wide and its steps 20 of them deep, so 13.5 m either side is the least that keeps the columns
  // out of the terrace's own face.
  const stepGap = 13.5;
  const tz = TERRACE.outerZ;
  for (const [name, x0, x1] of [['west', -halfW - 6, -stepGap], ['east', stepGap, halfW + 6]]) {
    b.box(`north terrace ${name}`, { x0, x1, y0: -0.4, y1: y0, z0: -tz, z1: 0.2 }, COLORS.terraceStone, { metric: true });
    // The terrace's own parapet, standing on its outer edge -- the "parapet" of the raised ramp.
    b.box(`north terrace ${name} parapet`, { x0, x1, y0: y0, y1: y0 + 0.6, z0: -tz, z1: -tz + 0.4 }, COLORS.stoneTrim, { metric: true });
  }
  b.box('north terrace west return', { x0: -halfW - 6.3, x1: -halfW - 6, y0: -0.4, y1: y0 + 0.6, z0: -tz, z1: 0.2 }, COLORS.terraceStone);
  b.box('north terrace east return', { x0: halfW + 6, x1: halfW + 6.3, y0: -0.4, y1: y0 + 0.6, z0: -tz, z1: 0.2 }, COLORS.terraceStone);

  // ---- the four walls --------------------------------------------------------------------------------
  b.box('north wall', { x0: -halfW, x1: halfW, y0, y1: FACADE.parapet, z0: zN - wallT, z1: zN }, COLORS.wallLit, { metric: true });
  b.box('south wall', { x0: -halfW, x1: halfW, y0: -DIMS.southLawnDrop, y1: FACADE.parapet, z0: zS, z1: zS + wallT }, COLORS.wallLit, { metric: true });
  b.box('west wall', { x0: -halfW, x1: -halfW + wallT, y0: -DIMS.southLawnDrop, y1: FACADE.parapet, z0: zS, z1: zN }, COLORS.wallUpper, { metric: true });
  b.box('east wall', { x0: halfW - wallT, x1: halfW, y0: -DIMS.southLawnDrop, y1: FACADE.parapet, z0: zS, z1: zN }, COLORS.wallUpper, { metric: true });

  // ---- the belt course and the cornice, on all four sides ---------------------------------------------
  b.box('north belt course', { x0: -halfW - 0.15, x1: halfW + 0.15, y0: FACADE.belt, y1: FACADE.belt + 0.22, z0: zN - wallT - 0.05, z1: zN + 0.15 }, COLORS.windowTrim, { metric: true });
  b.box('south belt course', { x0: -halfW - 0.15, x1: halfW + 0.15, y0: FACADE.belt, y1: FACADE.belt + 0.22, z0: zS - 0.15, z1: zS + wallT + 0.05 }, COLORS.windowTrim, { metric: true });
  b.box('west belt course', { x0: -halfW - 0.15, x1: -halfW + 0.05, y0: FACADE.belt, y1: FACADE.belt + 0.22, z0: zS - 0.1, z1: zN + 0.1 }, COLORS.windowTrim);
  b.box('east belt course', { x0: halfW - 0.05, x1: halfW + 0.15, y0: FACADE.belt, y1: FACADE.belt + 0.22, z0: zS - 0.1, z1: zN + 0.1 }, COLORS.windowTrim);

  b.box('north cornice', { x0: -halfW - 0.4, x1: halfW + 0.4, y0: FACADE.cornice, y1: FACADE.balustradeBottom, z0: zN - wallT - 0.15, z1: zN + 0.4 }, COLORS.stoneTrim, { metric: true });
  b.box('south cornice', { x0: -halfW - 0.4, x1: halfW + 0.4, y0: FACADE.cornice, y1: FACADE.balustradeBottom, z0: zS - 0.4, z1: zS + wallT + 0.15 }, COLORS.stoneTrim, { metric: true });
  b.box('west cornice', { x0: -halfW - 0.4, x1: -halfW + 0.15, y0: FACADE.cornice, y1: FACADE.balustradeBottom, z0: zS - 0.4, z1: zN + 0.4 }, COLORS.stoneTrim, { metric: true });
  b.box('east cornice', { x0: halfW - 0.15, x1: halfW + 0.4, y0: FACADE.cornice, y1: FACADE.balustradeBottom, z0: zS - 0.4, z1: zN + 0.4 }, COLORS.stoneTrim, { metric: true });

  // ---- the balustraded parapet ------------------------------------------------------------------------
  const railY0 = FACADE.balustradeBottom;
  const railY1 = FACADE.balustradeTop;
  const capT = 0.16;
  const runs = [
    { name: 'north', a0: -halfW - 0.4, a1: halfW + 0.4, z: zN + 0.05, along: 'x' },
    { name: 'south', a0: -halfW - 0.4, a1: halfW + 0.4, z: zS - 0.05, along: 'x' },
    { name: 'west', a0: zS - 0.05, a1: zN + 0.05, z: -halfW - 0.05, along: 'z' },
    { name: 'east', a0: zS - 0.05, a1: zN + 0.05, z: halfW + 0.05, along: 'z' },
  ];
  for (const run of runs) {
    const thickness = 0.22;
    const lo = Math.min(run.a0, run.a1);
    const hi = Math.max(run.a0, run.a1);
    const make = (name, ya, yb, pad) =>
      run.along === 'x'
        ? b.box(name, { x0: lo - pad, x1: hi + pad, y0: ya, y1: yb, z0: run.z - thickness / 2, z1: run.z + thickness / 2 }, COLORS.stoneTrim, { metric: true })
        : b.box(name, { x0: run.z - thickness / 2, x1: run.z + thickness / 2, y0: ya, y1: yb, z0: lo - pad, z1: hi + pad }, COLORS.stoneTrim, { metric: true });
    make(`${run.name} balustrade cap`, railY1 - capT, railY1, 0.12);
    make(`${run.name} balustrade rail`, railY0, railY0 + 0.22, 0.06);
    const n = Math.max(1, Math.floor((hi - lo) / BALUSTER_PITCH));
    const geo = new THREE.BoxGeometry(run.along === 'x' ? BALUSTER_WIDTH : 0.18, railY1 - capT - (railY0 + 0.22), run.along === 'x' ? 0.18 : BALUSTER_WIDTH);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: COLORS.stoneTrim, roughness: 0.9, metalness: 0 }), n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const t = lo + (i + 0.5) * ((hi - lo) / n);
      const yy = (railY0 + 0.22 + railY1 - capT) / 2;
      m.makeTranslation(run.along === 'x' ? t : run.z, yy, run.along === 'x' ? run.z : t);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    b.add(mesh, `${run.name} balusters`);
  }

  // ---- the roof deck and the roofscape ----------------------------------------------------------------
  // A FLAT DECK behind the balustrade, not a hip roof: the balustrade hides the roof from the photo view
  // entirely, and a deck is honest about what is not modelled yet. A low ridge and the chimneys stand above
  // it because the photo's own silhouette has them.
  b.box('roof deck', { x0: -halfW, x1: halfW, y0: FACADE.balustradeBottom - 0.5, y1: FACADE.deckTop, z0: zS, z1: zN }, COLORS.roof, { metric: true });
  b.box('roof ridge', { x0: -halfW + 2, x1: halfW - 2, y0: FACADE.deckTop, y1: FACADE.deckTop + FACADE.roofRise, z0: -D / 2 - 4, z1: -D / 2 + 4 }, COLORS.roofShadow, { metric: true });
  // Five chimneys on the bay boundaries either side of the portico. Positions are [estimate]; the count and
  // placement are UNVERIFIED (research-photo.md section 5 item 12).
  const chimneyX = [-18.6, -9.3, 4.65, 13.95, 23.25];
  chimneyX.forEach((x, i) => {
    b.box(`chimney ${i + 1} stack`, { x0: x - 0.55, x1: x + 0.55, y0: FACADE.deckTop, y1: FACADE.chimneyTop, z0: -D * 0.62, z1: -D * 0.62 + 1.1 }, COLORS.stoneTrim, { metric: true });
    b.box(`chimney ${i + 1} cap`, { x0: x - 0.72, x1: x + 0.72, y0: FACADE.chimneyTop, y1: FACADE.chimneyTop + 0.22, z0: -D * 0.62 - 0.17, z1: -D * 0.62 + 1.27 }, COLORS.stoneTrim);
  });
  b.box('flagpole', { x0: -0.06, x1: 0.06, y0: FACADE.deckTop, y1: 21.4, z0: -D / 2 - 0.06, z1: -D / 2 + 0.06 }, COLORS.stoneTrim);
  b.box('flag', { x0: 0.06, x1: 1.5, y0: 19.4, y1: 20.6, z0: -D / 2 - 0.03, z1: -D / 2 + 0.03 }, COLORS.corniceShadow);

  // ---- the north front's eleven bays ------------------------------------------------------------------
  const winW = DIMS.windowWidth;
  for (let i = 1; i <= BAYS.count; i++) {
    const cx = BAYS.centreX(i);
    const behindPortico = BAYS.porticoBays.includes(i);
    b.box(`bay ${i} first floor reveal`, { x0: cx - winW / 2, x1: cx + winW / 2, y0: FACADE.firstSill, y1: FACADE.firstHead, z0: zN - 0.32, z1: zN - 0.06 }, COLORS.windowGlass);
    b.box(`bay ${i} first floor glass`, { x0: cx - winW / 2 + 0.12, x1: cx + winW / 2 - 0.12, y0: FACADE.firstSill + 0.12, y1: FACADE.firstHead - 0.12, z0: zN - 0.28, z1: zN - 0.12 }, COLORS.windowGlass);
    b.box(`bay ${i} first floor surround sill`, { x0: cx - winW / 2 - 0.18, x1: cx + winW / 2 + 0.18, y0: FACADE.firstSill - 0.18, y1: FACADE.firstSill, z0: zN - 0.36, z1: zN + 0.03 }, COLORS.windowTrim);
    b.box(`bay ${i} first floor surround head`, { x0: cx - winW / 2 - 0.18, x1: cx + winW / 2 + 0.18, y0: FACADE.firstHead, y1: FACADE.firstHead + 0.2, z0: zN - 0.36, z1: zN + 0.03 }, COLORS.windowTrim);
    b.box(`bay ${i} first floor surround west`, { x0: cx - winW / 2 - 0.18, x1: cx - winW / 2, y0: FACADE.firstSill, y1: FACADE.firstHead, z0: zN - 0.36, z1: zN + 0.03 }, COLORS.windowTrim);
    b.box(`bay ${i} first floor surround east`, { x0: cx + winW / 2, x1: cx + winW / 2 + 0.18, y0: FACADE.firstSill, y1: FACADE.firstHead, z0: zN - 0.36, z1: zN + 0.03 }, COLORS.windowTrim);

    if (!behindPortico) {
      const kind = BAYS.firstFloorPediment(i);
      const py = FACADE.firstHead + 0.2;
      if (kind === 'triangle') {
        const steps = 5;
        for (let s = 0; s < steps; s++) {
          const frac = 1 - s / steps;
          const w = (winW + 0.9) * frac;
          b.box(`bay ${i} first floor triangular pediment ${s + 1}`, { x0: cx - w / 2, x1: cx + w / 2, y0: py + s * 0.14, y1: py + (s + 1) * 0.14, z0: zN - 0.42, z1: zN + 0.06 }, COLORS.windowTrim);
        }
      } else {
        b.box(`bay ${i} first floor segmental pediment base`, { x0: cx - (winW + 0.9) / 2, x1: cx + (winW + 0.9) / 2, y0: py, y1: py + 0.16, z0: zN - 0.42, z1: zN + 0.06 }, COLORS.windowTrim);
        b.box(`bay ${i} first floor segmental pediment arch`, { x0: cx - (winW + 0.5) / 2, x1: cx + (winW + 0.5) / 2, y0: py + 0.16, y1: py + 0.46, z0: zN - 0.40, z1: zN + 0.04 }, COLORS.windowTrim);
        b.box(`bay ${i} first floor segmental pediment cap`, { x0: cx - (winW + 0.1) / 2, x1: cx + (winW + 0.1) / 2, y0: py + 0.46, y1: py + 0.6, z0: zN - 0.38, z1: zN + 0.02 }, COLORS.windowTrim);
      }
    }

    b.box(`bay ${i} second floor reveal`, { x0: cx - winW / 2, x1: cx + winW / 2, y0: FACADE.secondSill, y1: FACADE.secondHead, z0: zN - 0.30, z1: zN - 0.06 }, COLORS.windowGlass);
    b.box(`bay ${i} second floor glass`, { x0: cx - winW / 2 + 0.12, x1: cx + winW / 2 - 0.12, y0: FACADE.secondSill + 0.12, y1: FACADE.secondHead - 0.12, z0: zN - 0.26, z1: zN - 0.12 }, COLORS.windowGlass);
    b.box(`bay ${i} second floor sill`, { x0: cx - winW / 2 - 0.16, x1: cx + winW / 2 + 0.16, y0: FACADE.secondSill - 0.16, y1: FACADE.secondSill, z0: zN - 0.34, z1: zN + 0.03 }, COLORS.windowTrim);
    b.box(`bay ${i} second floor head`, { x0: cx - winW / 2 - 0.16, x1: cx + winW / 2 + 0.16, y0: FACADE.secondHead, y1: FACADE.secondHead + 0.18, z0: zN - 0.34, z1: zN + 0.03 }, COLORS.windowTrim);
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
