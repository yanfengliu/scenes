// House fronts and street furniture: wood-board walls, plaster panels, koshi lattices and shoji grids
// as geometry, the balcony rail, doors, the small awning, the blue sign, paper lanterns, the sudare,
// the fence boards, the lamp post, and the noren cloth. Wall colors are the photo means; where a lighter
// or darker element sits in front of a wall, the wall's color is balanced so the region still averages
// to the sampled mean. Accents with no clean photo region (slats, shoji paper, grid bars) are set by eye.
import * as THREE from 'three';
import * as L from './layout.js';
import { mulberry32, jitter } from './random.js';
import { instanced, surface } from './instancing.js';
import { balancedMean } from './paving.js';
import { roofOuterY } from './primitives.js';

const C = L.COLORS;
const SLAT = 0x2e2724;
const SHOJI = 0xd4cdbf;
const GRID = 0x3a322c;

export function buildFacades(b) {
  const rand = mulberry32(5);
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const H = L.LEFT_HOUSE_1;
  const M = L.RIGHT_MACHIYA;
  const [t1, t2, t3] = L.LEFT_TERRACES;

  // ---- left house 1 --------------------------------------------------------------------------------
  // Light wood boards on the near ground floor up to the eave's outer edge, a backing strip up to the
  // mezzanine behind the eave's inner edge, dark boards on the mezzanine, the sudare hanging in front.
  b.box('left house 1 ground', { x0: H.back, x1: H.front, y0: t1.y - 2, y1: H.eaveY, z0: H.groundZ0, z1: H.z1 }, surface('wood', C.woodLight, { seed: 71 }), { metric: true });
  b.box('left house 1 eave backing', { x0: H.front - 0.3, x1: H.front - 0.01, y0: H.eaveY, y1: H.eaveTop, z0: H.groundZ0, z1: H.z1 }, surface('wood', C.woodLight, { seed: 71 }), { metric: true });
  b.box('left house 1 upper', { x0: H.back, x1: H.front, y0: H.eaveTop, y1: H.upperTop, z0: H.upperZ0, z1: H.z1 }, surface('woodWide', C.house1Upper, { seed: 72 }), { metric: true });
  b.box('sudare', { x0: H.front - 0.15, x1: H.front + 0.02, y0: 4.9, y1: 5.7, z0: -7.6, z1: -5.3 }, surface('sudare', C.sudare, { seed: 73 }), { metric: true });
  // A pair of paper lanterns on brackets flanking the entrance, behind the photo's left edge.
  hangLantern(b, 'lantern 1', H.front, H.front + 0.3, 4.45, -2.0, 0.38, 0.5);
  hangLantern(b, 'lantern 2', H.front, H.front + 0.3, 4.45, -4.0, 0.34, 0.46);

  // ---- the annex: dark board wall, two sliding doors, plaster band under the lean-to roof --------------
  const AR = L.LEFT_ANNEX_ROOF;
  const K = L.LEFT_CANOPY;
  const annexEave = (z) => roofOuterY(AR, z);
  // Upper boards up to the annex roof's eave or the door canopy, whichever is lower (the canopy rises
  // behind the wall face, so the view over the wall top meets its tiles), darker lower boards with the
  // doors, deep shadow at the far end, and a plaster band under the far end of the lean-to roof (photo:
  // light only at u 0.25-0.29, v 0.50-0.545), where the wall reaches the eave through the canopy.
  const canopyAtWall = (z) => L.canopyOuterY(z) + K.rise * ((H.front - K.xOuter) / (K.xInner - K.xOuter)) - 0.06;
  const plasterZ = -10.2;
  // The annex ends at its terrace (z -11.5) while its lean-to roof and door canopy run on 1.9 to 2.2 m
  // over house 3's near part: the photo shows house 3's roof and plaster below the canopy's far tiles at
  // u 0.27 to 0.31, and carrying the wall on to the roofs' end costs 0.0005 of cell distance there.
  const annexEnd = t2.z1;
  b.bandSolid('left annex', -6.0, plasterZ, (z) => Math.min(annexEave(z), canopyAtWall(z)) - 0.06, () => 0.9, H.back, H.front, surface('wood', C.annex, { seed: 74 }), 8);
  b.bandSolid('left annex far', plasterZ, t2.z1, (z) => annexEave(z) - 0.06, () => 0.9, H.back, H.front, surface('wood', C.annex, { seed: 74 }), 4);
  b.box('left annex lower', { x0: H.back, x1: H.front, y0: t2.y - 2, y1: 0.9, z0: -9.5, z1: -6.0 }, surface('wood', C.annexLower, { seed: 98 }), { metric: true });
  b.box('left annex lower far', { x0: H.back, x1: H.front, y0: t2.y - 2, y1: -0.7, z0: annexEnd, z1: -9.5 }, surface('wood', C.annexFarLower, { seed: 99 }), { metric: true });
  b.bandSolid('left annex far upper', -9.5, annexEnd, (z) => Math.min(0.9, canopyAtWall(z)), () => -0.7, H.back, H.front, surface('plaster', C.annexFarUpper, { seed: 100 }), 6);
  b.bandSolid('left annex plaster', plasterZ, t2.z1, (z) => annexEave(z), (z) => annexEave(z) - 0.55, H.front - 0.08, H.front + 0.04, surface('plaster', C.plaster, { seed: 75 }), 4);
  // Where the wall rises through the canopy, a tile-colored ledge, flush with the plaster's top, covers
  // the wall top between the annex roof's eave (behind the wall face) and the face.
  b.quadSlab('annex eave ledge', [{ x: AR.xOuter, y: annexEave(plasterZ), z: plasterZ }, { x: H.front + 0.02, y: annexEave(plasterZ), z: plasterZ }, { x: H.front + 0.02, y: annexEave(t2.z1), z: t2.z1 }, { x: AR.xOuter, y: annexEave(t2.z1), z: t2.z1 }], 0.08, C.tileLeft);
  // A koshi lattice window under the awning, where the photo shows dark slats (u 0.08-0.16, v 0.58-0.66);
  // its top rail stays under the canopy, which meets the wall at 2.6 m at the window's far end.
  lattice(b, rand, unit, 'annex window', H.front, 1.75, 2.4, -7.6, -6.2, 0.07, 0.03, SLAT, 1);
  // The doors stand on the annex's terrace; from the photo camera their upper halves show above the low
  // wall (v 0.72 to 0.85 at u 0.14 to 0.24): a wide pair and a narrow one beside it on the near board wall.
  slidingDoor(b, rand, unit, 'annex door 1', H.front, 1, t2.y, -7.0, 1.9, 2.0);
  slidingDoor(b, rand, unit, 'annex door 2', H.front, 1, t2.y, -8.95, 1.0, 1.7);
  // The small white awning: a light sheet over the canopy's lower rows by the near door, clear of the
  // tile crests, with an edge board. Two-sided, since the sheet is seen from above and from the street.
  const A = L.LEFT_AWNING;
  const awningY = (z, d) => L.canopyOuterY(z) + A.lift + K.rise * (d / (K.xOuter - K.xInner));
  b.quadSlab('awning', [{ x: K.xOuter, y: awningY(A.zNear, 0), z: A.zNear }, { x: K.xOuter - A.depth, y: awningY(A.zNear, A.depth), z: A.zNear }, { x: K.xOuter - A.depth, y: awningY(A.zFar, A.depth), z: A.zFar }, { x: K.xOuter, y: awningY(A.zFar, 0), z: A.zFar }], 0.04, surface('plaster', C.awning, { seed: 76, side: THREE.DoubleSide }));
  // The edge board hangs just in front of the canopy's eave caps (their rims reach 6 cm past the eave).
  b.quadSlab('awning edge', [{ x: K.xOuter + 0.04, y: awningY(A.zNear, 0) + 0.02, z: A.zNear }, { x: K.xOuter + 0.08, y: awningY(A.zNear, 0) + 0.02, z: A.zNear }, { x: K.xOuter + 0.08, y: awningY(A.zFar, 0) + 0.02, z: A.zFar }, { x: K.xOuter + 0.04, y: awningY(A.zFar, 0) + 0.02, z: A.zFar }], 0.12, C.eaveEdge);

  // ---- house 3: dark boards below, plaster above up to its roof, the blue sign on a post at its far corner ----
  // Its wall face stands 0.7 m behind the annex's, under the roof's eave (the eave line is the photo fit).
  const h3Front = H.front - 0.7;
  b.box('left house 3 body', { x0: H.back, x1: h3Front, y0: -5.5, y1: -2.6, z0: t3.z1, z1: t3.z0 }, surface('wood', C.house3Lower, { seed: 77 }), { metric: true });
  b.box('left house 3 upper', { x0: H.back, x1: h3Front, y0: -2.6, y1: -0.9, z0: t3.z1, z1: t3.z0 }, surface('plaster', C.house3Wall, { seed: 78 }), { metric: true });
  // The sign keeps its photo point on the ray through (0.33, 0.58), 0.8 m in front of the set-back wall:
  // it hangs from a bracket arm off a post that rises from inside the wall through the roof's edge.
  const signX = H.front + 0.1;
  const sign = L.uvToWorld(L.SIGN.u, L.SIGN.v, L.depthForU(L.SIGN.u, signX));
  b.box('sign', { x0: signX - 0.11, x1: signX + 0.11, y0: sign.y - 0.4, y1: sign.y + 0.4, z0: sign.z - 0.3, z1: sign.z + 0.3 }, surface('sign', C.sign, { seed: 79 }));
  b.box('sign post', { x0: h3Front - 0.1, x1: h3Front - 0.02, y0: -1.0, y1: sign.y + 0.48, z0: sign.z - 0.04, z1: sign.z + 0.04 }, C.woodDark);
  b.box('sign arm', { x0: h3Front - 0.1, x1: signX + 0.11, y0: sign.y + 0.4, y1: sign.y + 0.48, z0: sign.z - 0.04, z1: sign.z + 0.04 }, C.woodDark);

  // ---- right machiya -------------------------------------------------------------------------------
  // Ground floor: a koshi lattice of dark slats in front of a wall balanced so the band averages to the
  // sampled mean; a stone plinth and near-black boards below; a lattice band on the far part too.
  // Seen from the photo camera the near lattice shows about half slats, the far one (at a grazing angle)
  // mostly slats, so each wall is balanced against its own visible slat fraction.
  const SLAT_NEAR = 0x3a3330;
  const SLAT_FAR = 0x4a4744;
  const groundBack = balancedMean(C.rightGround, SLAT_NEAR, 0.5);
  const groundBackFar = balancedMean(C.rightGroundFar, SLAT_FAR, 0.7);
  b.box('right house ground', { x0: M.front, x1: M.back, y0: -3.5, y1: M.eaveTop - 0.22, z0: M.baseSplitZ, z1: M.z1 }, surface('plaster', groundBack, { seed: 80 }), { metric: true });
  b.box('right house ground far', { x0: M.front, x1: M.back, y0: -3.5, y1: M.eaveTop - 0.22, z0: M.z0, z1: M.baseSplitZ }, surface('plaster', groundBackFar, { seed: 81 }), { metric: true });
  b.box('right house plinth', { x0: M.front - 0.06, x1: M.front + 0.3, y0: -3.5, y1: M.plinthTop, z0: M.z0, z1: M.z1 }, surface('stone', C.plinth, { seed: 82 }), { metric: true });
  b.box('right house base', { x0: M.front - 0.05, x1: M.front + 0.3, y0: M.plinthTop, y1: M.baseTop, z0: M.baseSplitZ, z1: M.z1 }, surface('wood', C.woodBase, { seed: 83 }), { metric: true });
  b.box('right house base far', { x0: M.front - 0.05, x1: M.front + 0.3, y0: M.plinthTop, y1: M.baseTopFar, z0: M.z0, z1: M.baseSplitZ }, surface('wood', C.woodBase, { seed: 84 }), { metric: true });
  lattice(b, rand, unit, 'right lattice near', M.front - 0.01, M.baseTop + 0.03, M.eaveTop - 0.7, M.baseSplitZ + 0.15, M.z1 - 0.15, 0.07, 0.03, SLAT_NEAR);
  lattice(b, rand, unit, 'right lattice far', M.front - 0.01, M.baseTopFar + 0.03, M.eaveTop - 0.7, M.z0 + 0.2, M.baseSplitZ - 0.15, 0.07, 0.03, SLAT_FAR);
  // Upper floor: dark boards balanced against the shoji windows, and the balcony rail in front.
  const shojiFraction = 0.15;
  const upperWall = balancedMean(C.woodUpperRight, SHOJI, shojiFraction);
  b.box('right house upper', { x0: M.front, x1: M.back, y0: M.eaveTop, y1: M.roofY, z0: M.upperZ0, z1: M.z1 }, surface('woodWide', upperWall, { seed: 85 }), { metric: true });
  for (const zc of [-5.0, -8.4]) {
    shoji(b, rand, unit, `shoji ${zc}`, M.front - 0.005, 5.05, 6.35, zc - 0.7, zc + 0.7);
  }
  balconyRail(b, rand, unit, M.front, 4.9, M.upperZ0 + 0.2, M.z1 - 0.2);

  // ---- the fence: vertical boards with dark posts on the planter's stone core, jogging back at the steps ----
  const F = L.RIGHT_FENCE;
  const B = L.RIGHT_BED;
  const bw = F.thickness - 0.1;
  const posts = [];
  for (let i = 0; i < F.path.length - 1; i++) {
    const [xa, za] = F.path[i];
    const [xb, zb] = F.path[i + 1];
    if (xa === xb) {
      b.bandSolid(`fence ${i}`, za, zb, (z) => L.rightBedY(z) + B.fenceHeight, (z) => L.rightBedY(z) - 0.1, xa - bw / 2, xa + bw / 2, surface('wood', C.fence, { seed: 86 + i }), 6);
      for (let z = za - 0.6; z > zb + 0.3; z -= 1.2) {
        posts.push({ position: [xa - bw / 2 - 0.04, L.rightBedY(z) + B.fenceHeight / 2 - 0.05, z], scale: [0.08, B.fenceHeight + 0.1, 0.1], tint: 1 + jitter(rand, 0.05), uv: [rand(), 0] });
      }
    } else {
      const x0 = Math.min(xa, xb) - F.thickness / 2;
      const x1 = Math.max(xa, xb) + F.thickness / 2;
      b.box(`fence ${i}`, { x0, x1, y0: L.rightBedY(za) - 0.1, y1: L.rightBedY(za) + B.fenceHeight, z0: za - bw / 2, z1: za + bw / 2 }, surface('wood', C.fence, { seed: 86 + i }), { metric: true });
    }
  }
  b.add(instanced('fence posts', unit, surface('wood', C.woodDark, { seed: 60, instancedUv: true }), posts), 'fence posts');

  // ---- the lamp post: a square wooden post with a four-panel lantern head -----------------------------
  const lampBase = L.rayHitGround(L.LAMP.u, L.LAMP.v1, L.streetY);
  const lampDepth = L.worldToUV(lampBase).depth;
  const lampTop = L.uvToWorld(L.LAMP.u, L.LAMP.v0, lampDepth);
  b.box('lamp post', { x0: lampBase.x - 0.07, x1: lampBase.x + 0.07, y0: lampBase.y - 0.2, y1: lampTop.y - 0.5, z0: lampBase.z - 0.07, z1: lampBase.z + 0.07 }, surface('wood', C.lamp, { seed: 87 }), { metric: true });
  const headPanel = balancedMean(C.lantern, C.lamp, 0.5);
  b.box('lamp lantern', { x0: lampBase.x - 0.2, x1: lampBase.x + 0.2, y0: lampTop.y - 0.48, y1: lampTop.y - 0.04, z0: lampBase.z - 0.2, z1: lampBase.z + 0.2 }, surface('plaster', headPanel, { seed: 88 }));
  const frame = [];
  for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2]]) {
    frame.push({ position: [lampBase.x + dx, lampTop.y - 0.26, lampBase.z + dz], scale: [0.04, 0.46, 0.04], uv: [0, 0] });
  }
  frame.push({ position: [lampBase.x, lampTop.y - 0.02, lampBase.z], scale: [0.5, 0.05, 0.5], uv: [0, 0] });
  frame.push({ position: [lampBase.x, lampTop.y + 0.03, lampBase.z], scale: [0.3, 0.06, 0.3], uv: [0, 0] });
  frame.push({ position: [lampBase.x, lampTop.y - 0.5, lampBase.z], scale: [0.46, 0.04, 0.46], uv: [0, 0] });
  b.add(instanced('lamp frame', unit, surface('wood', C.lamp, { seed: 89, instancedUv: true }), frame), 'lamp frame');

  // ---- the noren under the right eave ---------------------------------------------------------------
  noren(b, M);
}

// A koshi lattice: vertical slats of `size` at `pitch` spacing along z, standing on the face at x and
// extending `facing` (-1 toward -x, the right house; +1 toward +x, the left row).
function lattice(b, rand, unit, name, x, y0, y1, z0, z1, pitch, size, color = SLAT, facing = -1) {
  const items = [];
  const n = Math.floor((z1 - z0) / pitch);
  const start = z0 + ((z1 - z0) - n * pitch) / 2 + pitch / 2;
  const xc = x + (facing * size) / 2;
  for (let i = 0; i < n; i++) {
    items.push({ position: [xc, (y0 + y1) / 2, start + i * pitch], scale: [size, y1 - y0, size], tint: 1 + jitter(rand, 0.05), uv: [rand(), 0] });
  }
  // Top and bottom rails.
  items.push({ position: [xc, y1 + 0.03, (z0 + z1) / 2], scale: [size + 0.02, 0.06, z1 - z0], uv: [0, 0] });
  items.push({ position: [xc, y0 - 0.03, (z0 + z1) / 2], scale: [size + 0.02, 0.06, z1 - z0], uv: [0, 0] });
  b.add(instanced(name, unit, surface('wood', color, { seed: 90, instancedUv: true }), items), name);
}

// A shoji window: a light paper panel on the face at x with a grid of thin dark bars in front (toward -x).
function shoji(b, rand, unit, name, x, y0, y1, z0, z1) {
  b.box(`${name} paper`, { x0: x - 0.03, x1: x, y0, y1, z0, z1 }, surface('plaster', SHOJI, { seed: 91 }), { metric: true });
  const bars = [];
  const cols = Math.round((z1 - z0) / 0.28);
  const rows = Math.round((y1 - y0) / 0.28);
  for (let i = 0; i <= cols; i++) {
    bars.push({ position: [x - 0.02, (y0 + y1) / 2, z0 + ((z1 - z0) * i) / cols], scale: [0.04, y1 - y0, 0.025], uv: [0, 0] });
  }
  for (let j = 0; j <= rows; j++) {
    bars.push({ position: [x - 0.02, y0 + ((y1 - y0) * j) / rows, (z0 + z1) / 2], scale: [0.04, 0.025, z1 - z0], uv: [0, 0] });
  }
  bars.push({ position: [x - 0.04, (y0 + y1) / 2, z0 - 0.04], scale: [0.08, y1 - y0 + 0.1, 0.08], uv: [0, 0] });
  bars.push({ position: [x - 0.04, (y0 + y1) / 2, z1 + 0.04], scale: [0.08, y1 - y0 + 0.1, 0.08], uv: [0, 0] });
  b.add(instanced(`${name} bars`, unit, surface('wood', GRID, { seed: 92, instancedUv: true }), bars), `${name} bars`);
}

// The balcony: a floor slab projecting from the wall, posts, two rails and a bottom board.
function balconyRail(b, rand, unit, wallX, floorY, z0, z1) {
  const depth = 0.35;
  const items = [];
  const posts = Math.floor((z1 - z0) / 0.36);
  const start = z0 + ((z1 - z0) - posts * 0.36) / 2 + 0.18;
  for (let i = 0; i < posts; i++) {
    items.push({ position: [wallX - depth + 0.03, floorY + 0.5, start + i * 0.36], scale: [0.06, 1.0, 0.06], tint: 1 + jitter(rand, 0.04), uv: [rand(), 0] });
  }
  items.push({ position: [wallX - depth + 0.03, floorY + 1.0, (z0 + z1) / 2], scale: [0.09, 0.07, z1 - z0], uv: [0, 0] });
  items.push({ position: [wallX - depth + 0.03, floorY + 0.62, (z0 + z1) / 2], scale: [0.06, 0.05, z1 - z0], uv: [0, 0] });
  items.push({ position: [wallX - depth + 0.03, floorY + 0.12, (z0 + z1) / 2], scale: [0.06, 0.2, z1 - z0], uv: [0, 0] });
  items.push({ position: [wallX - depth / 2, floorY - 0.05, (z0 + z1) / 2], scale: [depth, 0.1, z1 - z0], uv: [0, 0] });
  b.add(instanced('balcony rail', unit, surface('wood', C.balcony, { seed: 93, instancedUv: true }), items), 'balcony rail');
}

// A sliding door pair standing on the wall face at wallX, its parts extending `facing` (+1 toward +x)
// from the wall: a dark backing, two lattice panels in a frame, thin bars on each panel.
function slidingDoor(b, rand, unit, name, wallX, facing, floorY, zc, width, height) {
  const at = (a, w) => ({ x0: Math.min(wallX + facing * a, wallX + facing * (a + w)), x1: Math.max(wallX + facing * a, wallX + facing * (a + w)) });
  b.box(`${name} backing`, { ...at(0.005, 0.025), y0: floorY, y1: floorY + height, z0: zc - width / 2, z1: zc + width / 2 }, surface('wood', C.woodDark, { seed: 94 }), { metric: true });
  const parts = [];
  for (const side of [-1, 1]) {
    const pz = zc + (side * width) / 4;
    parts.push({ position: [wallX + facing * 0.05, floorY + height / 2, pz], scale: [0.04, height, width / 2 - 0.06], tint: 1, uv: [rand(), 0] });
  }
  // Frame posts and head.
  parts.push({ position: [wallX + facing * 0.045, floorY + height / 2, zc - width / 2 - 0.04], scale: [0.09, height, 0.08], uv: [0, 0] });
  parts.push({ position: [wallX + facing * 0.045, floorY + height / 2, zc + width / 2 + 0.04], scale: [0.09, height, 0.08], uv: [0, 0] });
  parts.push({ position: [wallX + facing * 0.045, floorY + height + 0.04, zc], scale: [0.09, 0.08, width + 0.16], uv: [0, 0] });
  b.add(instanced(`${name}`, unit, surface('wood', C.annex, { seed: 95, instancedUv: true }), parts), `${name}`);
  // Vertical lattice bars on each panel.
  lattice(b, rand, unit, `${name} lattice`, wallX + facing * 0.07, floorY + 0.1, floorY + height - 0.1, zc - width / 2 + 0.05, zc + width / 2 - 0.05, 0.09, 0.025, SLAT, facing);
}

// A paper lantern: a ribbed ellipsoid on a short rod with dark caps.
function paperLantern(b, name, x, yTop, z, diameter, height) {
  const profile = [];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const r = (diameter / 2) * Math.sin(t * Math.PI) * 0.98 + 0.01;
    profile.push(new THREE.Vector2(r, -t * height));
  }
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 20), surface('lantern', C.paperLantern, { seed: 96 }));
  body.position.set(x, yTop - 0.1, z);
  b.add(body, name);
  b.box(`${name} cap`, { x0: x - 0.07, x1: x + 0.07, y0: yTop - 0.12, y1: yTop - 0.06, z0: z - 0.07, z1: z + 0.07 }, C.woodDark);
  b.box(`${name} foot`, { x0: x - 0.06, x1: x + 0.06, y0: yTop - 0.1 - height - 0.05, y1: yTop - 0.1 - height + 0.01, z0: z - 0.06, z1: z + 0.06 }, C.woodDark);
  b.box(`${name} rod`, { x0: x - 0.012, x1: x + 0.012, y0: yTop - 0.06, y1: yTop + 0.25, z0: z - 0.012, z1: z + 0.012 }, C.woodDark);
}

// A paper lantern hung in front of the wall at wallX from a bracket, its body centred at x.
function hangLantern(b, name, wallX, x, yTop, z, diameter, height) {
  paperLantern(b, name, x, yTop, z, diameter, height);
  b.box(`${name} bracket`, { x0: Math.min(wallX, x + 0.03), x1: Math.max(wallX, x + 0.03), y0: yTop + 0.2, y1: yTop + 0.25, z0: z - 0.025, z1: z + 0.025 }, C.woodDark);
}

// The noren: a cloth sheet hung under the right eave, in three panels that sag a little between their
// hangers, bow out toward the street, and end in a scalloped hem that rises toward the far end.
function noren(b, M) {
  const cols = 60;
  const rows = 10;
  const zN = M.z1;
  const zF = M.norenZ0;
  const length = zN - zF;
  const positions = [];
  const uvs = [];
  const hem = (z) => M.norenHemNear + ((M.norenHemFar - M.norenHemNear) * (zN - z)) / length;
  for (let i = 0; i <= cols; i++) {
    const t = i / cols;
    const z = zN - t * length;
    const panel = (t * 3) % 1; // three panels, each sagging between its hangers
    const sag = 0.03 * Math.sin(panel * Math.PI);
    const scallop = 0.035 * Math.abs(Math.sin(((t * length) / 0.32) * Math.PI)); // lobes hanging down, cusps up
    const top = M.norenTop;
    const bottom = hem(z) - sag - scallop;
    for (let j = 0; j <= rows; j++) {
      const s = j / rows; // 0 at the top, 1 at the hem
      const y = top + (bottom - top) * s;
      const bow = -0.05 * Math.sin(s * Math.PI * 0.85) - 0.02 * s;
      positions.push(M.front - 0.1 + bow, y, z);
      uvs.push(t, 1 - s); // the whole cloth maps to one texture with its three panels
    }
  }
  const index = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const a = i * (rows + 1) + j;
      const c = a + rows + 1;
      index.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  const mat = surface('noren', C.noren, { seed: 97, side: THREE.DoubleSide });
  mat.map.repeat.set(1, 1);
  b.add(new THREE.Mesh(geo, mat), 'noren');
  // The hanging rod.
  b.box('noren rod', { x0: M.front - 0.13, x1: M.front - 0.07, y0: M.norenTop, y1: M.norenTop + 0.05, z0: zF - 0.1, z1: zN + 0.1 }, C.woodDark);
}
