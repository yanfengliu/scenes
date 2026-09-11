// Kawara roofs: instanced pan tiles in rows with a wave section, round eave-end caps along the eave,
// half-round ridge tiles along the top of a gable, a fascia board and exposed rafter ends under the
// eave. A roof is four corners: outer-near (eave, near end), inner-near, inner-far, outer-far.
import * as THREE from 'three';
import * as L from './layout.js';
import { mulberry32, jitter } from './random.js';
import { instanced, surface, panTileGeometry, ridgeTileGeometry, eaveCapGeometry, basisAlong } from './instancing.js';
import { steppedRoofCorners } from './primitives.js';
import { darker } from './paving.js';
import { makeMaterial } from './materials.js';

const C = L.COLORS;
const TILE_W = 0.3;
const TILE_L = 0.33;
const COL = 0.29;
const ROW = 0.27;

export function buildRoofs(b) {
  const rand = mulberry32(99);
  const geos = { tile: panTileGeometry(TILE_W, TILE_L), ridge: ridgeTileGeometry(0.09, 0.3), cap: eaveCapGeometry(0.075, 0.03), rafter: new THREE.BoxGeometry(1, 1, 1) };

  const H = L.LEFT_HOUSE_1;
  const M = L.RIGHT_MACHIYA;
  const [, , t3] = L.LEFT_TERRACES;

  // Left house 1: the hisashi eave roof at eye level, and the low top roof (both slopes) above the mezzanine.
  // The eave band is split at H.eaveSplitZ. Only its far 3 m is in frame, and along that stretch the photo
  // goes from #ba9674 at (0.06, 0.341) through #6c4e3a at (0.10, 0.341) to #38241c at (0.15, 0.341): one
  // colour across the whole band read 60 levels dark at the near end and 60 light at the far one, which is
  // also why the note this replaces recorded that "a darker underside scored worse". Measured with the
  // split geometry in both arms so its reseed of every later roof cancels: the far half's own colours are
  // worth 0.0005 of cell distance and 0.0055 of SSIM against the same two pieces painted alike.
  // Two seams this leaves, both invisible from the photo view but real from close up: the tile rows stop
  // 0.075 m short of the split on one side and start 0.125 m past it on the other, leaving about 0.20 m of
  // bare board, and the eave-cap row skips one cap across it.
  const eaveCorners = (za, zb) => [v(H.front - 0.95, 4.25, za), v(H.front, 4.8, za), v(H.front, 4.8, zb), v(H.front - 0.95, 4.25, zb)];
  tileRoof(b, rand, geos, 'house 1 eave', eaveCorners(H.z1, H.eaveSplitZ), {
    color: C.tileLeft,
    fasciaColor: C.leftRoofEdge,
    fasciaHeight: 0.2,
    boardColor: C.leftRoofEdge,
    rafterColor: C.eaveNearRafter,
  });
  tileRoof(b, rand, geos, 'house 1 eave far', eaveCorners(H.eaveSplitZ, H.eaveZ0), {
    color: C.tileLeft,
    fasciaColor: C.eaveFar,
    fasciaHeight: 0.2,
    boardColor: C.eaveFar,
    rafterColor: C.eaveFar,
  });
  const ridgeX = -7.0;
  const ridgeY = H.roofEave + (ridgeX - (H.front - 0.5)) * -Math.tan((28 * Math.PI) / 180);
  tileRoof(b, rand, geos, 'house 1 roof front', [v(H.front - 0.5, H.roofEave, H.z1), v(ridgeX, ridgeY, H.z1), v(ridgeX, ridgeY, H.roofZ0), v(H.front - 0.5, H.roofEave, H.roofZ0)], {
    color: C.tileLeft,
    fasciaColor: C.roofUnderDark,
    boardColor: C.roofUnderDark,
    rafterColor: C.roofUnderDark,
    ridge: true,
  });
  tileRoof(b, rand, geos, 'house 1 roof back', [v(H.back - 0.5, H.roofEave, H.roofZ0), v(ridgeX, ridgeY, H.roofZ0), v(ridgeX, ridgeY, H.z1), v(H.back - 0.5, H.roofEave, H.z1)], {
    color: C.tileLeft,
    fasciaColor: C.roofUnderDark,
    boardColor: C.roofUnderDark,
    rafters: false,
    caps: false,
  });

  tileRoof(b, rand, geos, 'dormer roof', [v(H.front + 0.15, H.roofEave + 0.62, -2.85), v(H.front - 1.15, H.roofEave + 1.02, -2.85), v(H.front - 1.15, H.roofEave + 1.02, -6.55), v(H.front + 0.15, H.roofEave + 0.62, -6.55)], {
    color: C.tileLeft,
    fasciaColor: C.roofUnderDark,
    boardColor: C.roofUnderDark,
    rafterColor: C.roofUnderDark,
    ridge: true,
  });

  // The annex lean-to and its door canopy, both stepping down the street. The small white awning lies
  // over the canopy's lower rows near the door (built with the facades).
  tileRoof(b, rand, geos, 'annex roof', steppedRoofCorners(L.LEFT_ANNEX_ROOF), { color: C.tileAnnex, fasciaColor: C.eaveEdge, boardColor: C.house1Wall, rafterColor: C.house1Wall });
  tileRoof(b, rand, geos, 'door canopy', steppedRoofCorners(L.LEFT_CANOPY), { color: C.canopy, fasciaColor: darker(C.canopy, 0.75), boardColor: C.annex, rafterColor: C.annex });

  // House 3's short roof on the photo's eave line; its wall stands 0.1 m behind the eave and the roof
  // overhangs the far end by 0.3 m.
  tileRoof(b, rand, geos, 'house 3 roof', [v(H.front - 0.6, -0.9, t3.z0), v(H.front - 2.6, -0.3, t3.z0), v(H.front - 2.6, -0.3, t3.z1 - 0.3), v(H.front - 0.6, -0.9, t3.z1 - 0.3)], {
    color: C.tileLeftLight,
    fasciaColor: darker(C.tileLeftLight, 0.7),
    boardColor: C.house3Lower,
    rafterColor: C.house3Lower,
  });

  // Right machiya: the deep ground-floor eave seen from above, and the top roof over the upper floor.
  // The same surface the block-out slab had (its top ran from 4.15 at the edge to 4.8 at the wall).
  const eaveTop0 = M.eaveTop - 0.35;
  const drop = M.eaveDrop;
  tileRoof(b, rand, geos, 'right eave', [v(M.eaveEdge, eaveTop0, M.z1), v(M.front + 0.2, M.eaveTop + 0.3, M.z1), v(M.front + 0.2, M.eaveTop + 0.3 - drop, M.eaveZ0), v(M.eaveEdge, eaveTop0 - drop, M.eaveZ0)], {
    color: C.tileRight,
    fasciaColor: C.eaveUnder,
    boardColor: C.eaveUnder,
    rafterColor: C.woodDark,
    capColor: darker(C.tileRight, 0.85),
    soffit: { offset: 0.32, thickness: 0.22, color: C.eaveUnder },
  });
  const topEave = M.roofY + M.roofThickness + 0.02;
  const topRidgeX = 9.0;
  const topRidgeY = topEave + (topRidgeX - M.topEaveEdge) * Math.tan((28 * Math.PI) / 180);
  tileRoof(b, rand, geos, 'right roof front', [v(M.topEaveEdge, topEave, M.z1), v(topRidgeX, topRidgeY, M.z1), v(topRidgeX, topRidgeY, M.roofZ0), v(M.topEaveEdge, topEave, M.roofZ0)], {
    color: C.tileRight,
    fasciaColor: C.topEaveUnder,
    boardColor: C.topEaveUnder,
    rafterColor: C.topEaveUnder,
    capColor: C.topRoofRight,
    ridge: true,
    fascia: false,
  });
  tileRoof(b, rand, geos, 'right roof back', [v(M.back + 0.5, topEave, M.roofZ0), v(topRidgeX, topRidgeY, M.roofZ0), v(topRidgeX, topRidgeY, M.z1), v(M.back + 0.5, topEave, M.z1)], {
    color: C.tileRight,
    boardColor: C.topEaveUnder,
    rafters: false,
    caps: false,
    fascia: false,
  });

  fenceRoof(b, rand, geos);
}

const v = (x, y, z) => new THREE.Vector3(x, y, z);

// Clip a planar polygon to the half-plane where f >= 0 (Sutherland-Hodgman; points stay on the plane).
function clipPolygon(points, f) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const c = points[(i + 1) % points.length];
    const da = f(a);
    const dc = f(c);
    if (da >= 0) out.push(a);
    if (da >= 0 !== dc >= 0) out.push(a.clone().lerp(c, da / (da - dc)));
  }
  return out;
}

// The small wall roof: a gabled kawara cap over the fence, following its jogged path, on dark boards.
// The pieces along the street follow the planter's slope; the two return pieces across the jog tilt so
// their eaves and ridges meet the along pieces' exactly at the corners. Every piece is extended into the
// corner square and clipped along the plan diagonal, a hip on the convex side (with its own ridge tiles)
// and a valley on the concave side. All tiles, caps and ridge tiles share three instanced meshes.
function fenceRoof(b, rand, geos) {
  const F = L.RIGHT_FENCE;
  const P = F.path;
  const hw = F.roofHalfWidth;
  const rise = F.roofRise;
  const eave = (z) => L.rightBedY(z) + L.RIGHT_BED.fenceHeight + 0.04;
  const collect = { tiles: [], caps: [], ridge: [] };
  const eps = 0.001;
  // One signed half-plane per corner, positive on the along piece's side of the hip or valley diagonal:
  // with sz the side of the corner the along piece lies on and sx the side the across piece lies on,
  // the along piece keeps sz * dz >= sx * dx and the across piece the rest. On the concave side that is
  // the valley (the higher plane wins), on the convex side the hip (the lower one), and each piece keeps
  // all of its own arm's quadrant and nothing of the other's.
  const cornerPlane = (i) => {
    const [cx, cz] = P[i];
    const alongSeg = P[i - 1][0] === cx ? i - 1 : i;
    const acrossSeg = alongSeg === i ? i - 1 : i;
    const sz = Math.sign((P[alongSeg][1] + P[alongSeg + 1][1]) / 2 - cz);
    const sx = Math.sign((P[acrossSeg][0] + P[acrossSeg + 1][0]) / 2 - cx);
    return (p) => sz * (p.z - cz) - sx * (p.x - cx);
  };
  for (let i = 0; i < P.length - 1; i++) {
    const [xa, za] = P[i];
    const [xb, zb] = P[i + 1];
    if (xa === xb) {
      // Along the street, extended by the half width into each corner square.
      const halfPlanes = [];
      if (i > 0) halfPlanes.push(cornerPlane(i));
      if (i < P.length - 2) halfPlanes.push(cornerPlane(i + 1));
      const z0 = i > 0 ? za + hw : za;
      const z1 = i < P.length - 2 ? zb - hw : zb;
      const ridgeKeep = (p) => p.z <= za + eps && p.z >= zb - eps;
      for (const side of [-1, 1]) {
        tileRoof(b, rand, geos, `fence roof ${i}${side < 0 ? 'a' : 'b'}`, [v(xa + side * hw, eave(z0), z0), v(xa, eave(z0) + rise, z0), v(xa, eave(z1) + rise, z1), v(xa + side * hw, eave(z1), z1)], { color: C.fenceTiles, ridge: side === -1, boardColor: C.woodDark, collect, halfPlanes, ridgeKeep });
      }
    } else {
      // Across the jog: level in x, tilted in z so each eave sits on the planter's line where the along
      // pieces' eaves arrive, and the ridge at the corner height.
      const x0 = Math.min(xa, xb) - hw;
      const x1 = Math.max(xa, xb) + hw;
      const halfPlanes = [i, i + 1].map((c) => { const f = cornerPlane(c); return (p) => -f(p); });
      const ridgeKeep = (p) => p.x >= Math.min(xa, xb) - eps && p.x <= Math.max(xa, xb) + eps;
      const ridgeY = eave(za) + rise;
      for (const side of [-1, 1]) {
        const ze = za + side * hw;
        tileRoof(b, rand, geos, `fence roof ${i}${side < 0 ? 'a' : 'b'}`, [v(x0, eave(ze), ze), v(x0, ridgeY, za), v(x1, ridgeY, za), v(x1, eave(ze), ze)], { color: C.fenceTiles, ridge: side === 1, boardColor: C.woodDark, collect, halfPlanes, ridgeKeep });
      }
    }
  }
  // Hip ridge tiles on the convex corners, from the eave corner up to the ridge junction.
  for (let i = 1; i < P.length - 1; i++) {
    const din = [Math.sign(P[i][0] - P[i - 1][0]), Math.sign(P[i][1] - P[i - 1][1])];
    const dout = [Math.sign(P[i + 1][0] - P[i][0]), Math.sign(P[i + 1][1] - P[i][1])];
    const ex = P[i][0] + hw * (din[0] - dout[0]);
    const ez = P[i][1] + hw * (din[1] - dout[1]);
    const E = v(ex, eave(ez), ez);
    const R = v(P[i][0], eave(P[i][1]) + rise, P[i][1]);
    const dir = R.clone().sub(E);
    const len = dir.length();
    dir.normalize();
    const n = Math.max(1, Math.floor(len / 0.3));
    for (let k = 0; k < n; k++) {
      const p = E.clone().addScaledVector(dir, 0.15 + k * 0.3).add(v(0, 0.06, 0));
      collect.ridge.push({ position: [p.x, p.y, p.z], basis: basisAlong(dir), tint: 1 + jitter(rand, 0.05), uv: [rand(), 0] });
    }
  }
  b.add(instanced('fence roof tiles', geos.tile, surface('kawara', C.fenceTiles, { seed: 61, instancedUv: true, side: THREE.DoubleSide }), collect.tiles), 'fence roof tiles');
  b.add(instanced('fence roof caps', geos.cap, surface('kawara', darker(C.fenceTiles, 0.8), { seed: 62, instancedUv: true }), collect.caps), 'fence roof caps');
  b.add(instanced('fence roof ridge', geos.ridge, surface('kawara', darker(C.fenceTiles, 0.9), { seed: 63, instancedUv: true }), collect.ridge), 'fence roof ridge');
}

// Tile one roof plane. Options: color (tiles), capColor, ridgeColor, fasciaColor, fasciaHeight,
// boardColor, rafterColor, soffit; toggles rafters, caps, fascia; `ridge` (off by default: only a gable's
// top edge gets ridge tiles, a lean-to meets its wall without them). With `collect` the tile, cap and
// ridge items are pushed into collect.tiles/caps/ridge for the caller to instance instead of being added.
// `halfPlanes` is a list of signed functions of a plane position (a Vector3, before the lift off the
// plane): tiles and caps are kept only where every one is >= 0, and the board polygon is clipped to the
// same half-planes, which is how pieces meet along a hip or valley. `ridgeKeep(p)` limits the ridge tiles.
export function tileRoof(b, rand, geos, name, corners, opts) {
  let [oN, iN, iF, oF] = corners.map((c) => (c.isVector3 ? c : new THREE.Vector3(c.x, c.y, c.z)));
  // Orient the roof so its normal points up: if the eave-to-ridge edge would give a downward normal,
  // walk the eave the other way (keeps the basis right-handed).
  if (new THREE.Vector3().crossVectors(oF.clone().sub(oN), iN.clone().sub(oN)).y < 0) [oN, iN, iF, oF] = [oF, iF, iN, oN];
  const along = oF.clone().sub(oN);
  const length = along.length();
  along.normalize();
  // Rows run parallel to the eave; the up-slope axis is the eave-to-ridge edge made perpendicular to it
  // (the stepped roofs are parallelograms whose eaves are inclined).
  const edge = iN.clone().sub(oN);
  const upslope = edge.clone().sub(along.clone().multiplyScalar(edge.dot(along)));
  const depth = upslope.length();
  upslope.normalize();
  const shear = edge.dot(along) / edge.dot(upslope); // along-offset of the end edges per metre up the slope
  const normal = new THREE.Vector3().crossVectors(along, upslope).normalize();
  const basis = new THREE.Matrix4().makeBasis(along, normal, upslope.clone().negate());
  // A tile counts as inside when its whole width lies within the roof, so nothing overhangs the ends.
  const inside = (a, s, margin = TILE_W / 2 - 0.02) => a - s * shear >= margin && a - s * shear <= length - margin;
  const color = opts.color;
  const seed = 40 + Math.floor(rand() * 1000);
  const halfPlanes = opts.halfPlanes ?? [];
  const keeps = (p) => halfPlanes.every((f) => f(p) >= 0);

  // Pan tiles in rows from the eave up, aligned columns, each row overlapping the one below.
  const tiles = opts.collect ? opts.collect.tiles : [];
  const caps = opts.collect ? opts.collect.caps : [];
  const cols = Math.max(1, Math.floor((length + 0.02) / COL));
  const colStart = (length - cols * COL) / 2 + COL / 2;
  for (let r = 0; r * ROW + 0.12 < depth; r++) {
    const s = Math.min(r * ROW + TILE_L / 2, depth - TILE_L / 2 + 0.02);
    const extra = Math.ceil(Math.abs(shear * depth) / COL) + 1;
    for (let c = -extra; c < cols + extra; c++) {
      const a = colStart + c * COL;
      if (!inside(a, s)) continue;
      const onPlane = oN.clone().addScaledVector(along, a).addScaledVector(upslope, s);
      if (!keeps(onPlane)) continue;
      const p = onPlane.clone().addScaledVector(normal, 0.02 + r * 0.004);
      tiles.push({ position: [p.x, p.y, p.z], basis, tint: 1 + jitter(rand, 0.06), uv: [rand(), rand()] });
      if (r === 0 && opts.caps !== false && inside(a, 0, 0.05)) {
        const onEave = oN.clone().addScaledVector(along, a);
        if (!keeps(onEave)) continue;
        const q = onEave.addScaledVector(normal, 0.045);
        caps.push({ position: [q.x, q.y, q.z], basis, tint: 1 + jitter(rand, 0.05), uv: [rand(), 0] });
      }
    }
  }
  if (!opts.collect) {
    b.add(instanced(`${name} tiles`, geos.tile, surface('kawara', color, { seed, instancedUv: true, side: THREE.DoubleSide }), tiles), `${name} tiles`);
    if (caps.length) b.add(instanced(`${name} caps`, geos.cap, surface('kawara', opts.capColor ?? darker(color, 0.8), { seed: seed + 1, instancedUv: true }), caps), `${name} caps`);
  }

  // Ridge tiles along the inner (upper) edge of a gable slope.
  if (opts.ridge) {
    const ridge = opts.collect ? opts.collect.ridge : [];
    const n = Math.max(1, Math.floor(length / 0.3));
    const start = (length - n * 0.3) / 2 + 0.15;
    for (let c = 0; c < n; c++) {
      const onEdge = iN.clone().addScaledVector(along, start + c * 0.3);
      if (opts.ridgeKeep && !opts.ridgeKeep(onEdge)) continue;
      const p = onEdge.addScaledVector(normal, 0.06);
      ridge.push({ position: [p.x, p.y, p.z], basis: basisAlong(along, normal), tint: 1 + jitter(rand, 0.05), uv: [rand(), 0] });
    }
    if (!opts.collect) b.add(instanced(`${name} ridge`, geos.ridge, surface('kawara', opts.ridgeColor ?? darker(color, 0.9), { seed: seed + 2, instancedUv: true }), ridge), `${name} ridge`);
  }

  // Roof board under the tiles, the fascia along the eave, and rafters below the board.
  if (opts.boardColor !== undefined) {
    const t = 0.05;
    const down = normal.clone().multiplyScalar(-t);
    let poly = [oN, iN, iF, oF];
    for (const f of halfPlanes) poly = clipPolygon(poly, f);
    if (poly.length >= 3) {
      const q = poly.map((p) => p.clone().add(down));
      b.quadSlab(`${name} board`, q.map((p) => ({ x: p.x, y: p.y, z: p.z })), t, opts.boardColor);
    }
  }
  if (opts.soffit) {
    const o = opts.soffit;
    const down = normal.clone().multiplyScalar(-o.offset);
    const q = [oN, iN, iF, oF].map((p) => p.clone().add(down));
    b.quadSlab(`${name} soffit`, q.map((p) => ({ x: p.x, y: p.y, z: p.z })), o.thickness, o.color);
  }
  if (opts.fascia !== false && opts.fasciaColor !== undefined) {
    const fasciaGeo = new THREE.BoxGeometry(length, opts.fasciaHeight ?? 0.14, 0.04);
    const mesh = new THREE.Mesh(fasciaGeo, makeMaterial({ color: opts.fasciaColor }));
    const mid = oN.clone().add(oF).multiplyScalar(0.5).addScaledVector(normal, -0.02 - (opts.fasciaHeight ?? 0.14) / 2).addScaledVector(upslope, -0.01);
    mesh.position.copy(mid);
    mesh.quaternion.setFromRotationMatrix(basis);
    b.add(mesh, `${name} fascia`);
  }
  if (opts.rafters !== false && opts.rafterColor !== undefined) {
    const rafters = [];
    const n = Math.max(2, Math.floor(length / 0.45));
    const start = (length - (n - 1) * 0.45) / 2;
    const reach = Math.min(depth, 1.2);
    for (let i = 0; i < n; i++) {
      const a = start + i * 0.45;
      if (!inside(a, reach / 2, 0.05)) continue;
      const p = oN.clone().addScaledVector(along, a).addScaledVector(upslope, reach / 2 - 0.02).addScaledVector(normal, -0.1);
      rafters.push({ position: [p.x, p.y, p.z], basis, scale: [0.07, 0.09, reach], tint: 1 + jitter(rand, 0.05), uv: [rand(), 0] });
    }
    b.add(instanced(`${name} rafters`, geos.rafter, surface('wood', opts.rafterColor, { seed: seed + 3, instancedUv: true }), rafters), `${name} rafters`);
  }
}
