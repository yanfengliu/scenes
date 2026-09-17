// The grounds in front of the north front: the lawn and its own rise towards Pennsylvania Avenue, the drive,
// the fence line, the north fountain on the centre axis, the red flower bed, the hedge band along the wall
// and the low boundary walls the photo shows at the frame's edges.
//
// EVERY z HERE IS NEGATIVE. The camera stands at z = +47.863 looking along -z, so the north grounds run from
// the wall at z = 0 out to the fence at z = -79 and the drive beyond it. The distances come from the photo
// rows the features were measured at, through the fitted camera (see layout.js's DIMS comments).
import * as THREE from 'three';
import { DIMS, COLORS, TERRACE, NORTH_LAWN, frameWidthAtZ } from './layout.js';

export function buildGrounds(b) {
  const W = DIMS.blockLength;
  const halfW = W / 2;

  // ---- the north lawn, with its own rise ---------------------------------------------------------------
  // Level at y = 0 from the wall out to NORTH_LAWN.flatTo, then a straight slope up to the camera's own
  // station. Built as two slabs and a ramp, all from the same constants the camera solve produced, so the
  // ground under the camera is exactly the height the solve puts there.
  b.box('north lawn', { x0: -180, x1: 180, y0: -0.8, y1: 0, z0: -NORTH_LAWN.flatTo, z1: 0.2 }, COLORS.lawnNear, { metric: true });
  const rise = NORTH_LAWN.riseHeight;
  const zA = -NORTH_LAWN.flatTo;
  const zB = -NORTH_LAWN.riseTo;
  // The ramp: a prism with its top face from (zA, 0) to (zB, rise).
  {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(NORTH_LAWN.riseTo - NORTH_LAWN.flatTo, rise);
    shape.lineTo(NORTH_LAWN.riseTo - NORTH_LAWN.flatTo, rise - 0.8);
    shape.lineTo(0, -0.8);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 360, bevelEnabled: false });
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COLORS.lawnMid, roughness: 0.95, metalness: 0 }));
    // The shape's local +x is world -z, so rotate it into place and slide it to the lawn's own edge.
    mesh.rotation.y = -Math.PI / 2;
    mesh.position.set(-180, 0, zA);
    mesh.receiveShadow = true;
    b.add(mesh, 'north lawn rise');
  }
  // The plateau the camera stands on, so the frame's own foreground is ground and not a hole.
  b.box('north lawn plateau', { x0: -180, x1: 180, y0: -0.8, y1: rise, z0: zB, z1: zB - 40 }, COLORS.lawnMid, { metric: true });
  // The far ground beyond the drive and the fence, so the horizon has something under it from any angle.
  b.box('far ground', { x0: -300, x1: 300, y0: -0.9, y1: rise - 0.1, z0: zB - 40, z1: zB - 260 }, COLORS.lawnFar, { metric: true });
  // The south lawn, three metres lower than the north: the reason the south facade shows a third storey.
  b.box('south lawn', { x0: -180, x1: 180, y0: -0.8 - DIMS.southLawnDrop, y1: -DIMS.southLawnDrop, z0: -DIMS.blockDepth - DIMS.southBowProjection - 8, z1: 300 }, COLORS.lawnMid, { metric: true });

  // ---- the hedge band along the wall -------------------------------------------------------------------
  // In FRONT of the terrace's parapet, on the lawn, running the whole length of the wall. The photo's own
  // band: its top is the row the wall's base was measured at, v 0.6180.
  const hedgeZ0 = -TERRACE.hedgeZ - TERRACE.hedgeDepth / 2;
  const hedgeZ1 = -TERRACE.hedgeZ + TERRACE.hedgeDepth / 2;
  // The hedge must NOT stand in front of the porch: the portico's columns are 4.8 m out and the steps reach
  // 6.4 m, so the gap either side of the centre is wider than the porch's own 21.5 m.
  const gap = DIMS.porticoWidth / 2 + 2.5;
  for (const [name, x0, x1] of [['west', -halfW - 6.0, -gap], ['east', gap, halfW + 6.0]]) {
    b.box(`hedge ${name}`, { x0, x1, y0: 0, y1: DIMS.hedgeHeight, z0: hedgeZ0, z1: hedgeZ1 }, COLORS.hedge, { metric: true });
    b.box(`hedge ${name} top`, { x0, x1, y0: DIMS.hedgeHeight, y1: DIMS.hedgeHeight + 0.2, z0: hedgeZ0 + 0.2, z1: hedgeZ1 - 0.2 }, COLORS.hedgeLit);
  }

  // ---- the red flower bed ------------------------------------------------------------------------------
  // The photo's own foreground feature, out on the lawn: far edge at row 0.6744 (z -46.1), near edge at row
  // 0.7350 (z -58.5). Its 66 m width is 0.464 of the frame at that depth -- a bed this size is what the
  // photograph actually shows, and its flowers read as a band, not as individual plants.
  const bedFar = -DIMS.bedDistance;
  const bedNear = -(DIMS.bedDistance + DIMS.bedDepth);
  const bedHalf = DIMS.bedWidth / 2;
  b.box('flower bed soil', { x0: -bedHalf, x1: bedHalf, y0: 0, y1: 0.35, z0: bedNear, z1: bedFar }, COLORS.flowerBed, { metric: true });
  b.box('flower bed blooms', { x0: -bedHalf + 0.4, x1: bedHalf - 0.4, y0: 0.35, y1: 0.62, z0: bedNear + 0.4, z1: bedFar - 0.4 }, COLORS.flowerBedLit, { metric: true });

  // ---- the fountain on the centre axis -----------------------------------------------------------------
  const fz = -DIMS.fountainDistance;
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.0, 0.75, 32), new THREE.MeshStandardMaterial({ color: COLORS.stoneTrim, roughness: 0.9, metalness: 0 }));
  basin.position.set(0, 0.375, fz);
  basin.receiveShadow = true;
  b.add(basin, 'fountain basin');
  const water = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, 0.12, 32), new THREE.MeshStandardMaterial({ color: COLORS.fountainWater, roughness: 0.25, metalness: 0 }));
  water.position.set(0, DIMS.fountainWaterHeight, fz);
  water.receiveShadow = true;
  b.add(water, 'fountain water');
  const jetH = DIMS.fountainJetHeight - DIMS.fountainWaterHeight;
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.55, jetH, 12), new THREE.MeshStandardMaterial({ color: COLORS.fountainWater, roughness: 0.3, metalness: 0, transparent: true, opacity: 0.85 }));
  jet.position.set(0, (DIMS.fountainWaterHeight + DIMS.fountainJetHeight) / 2, fz);
  b.add(jet, 'fountain jet');
  const plume = new THREE.Mesh(new THREE.SphereGeometry(1.6, 16, 12), new THREE.MeshStandardMaterial({ color: COLORS.fountainWater, roughness: 0.4, metalness: 0, transparent: true, opacity: 0.7 }));
  plume.scale.set(1.0, 1.5, 1.0);
  plume.position.set(0, DIMS.fountainJetHeight - 0.8, fz);
  b.add(plume, 'fountain plume');

  // ---- the fence line and the drive --------------------------------------------------------------------
  // The fence is the post-2020 one this June 2024 photograph shows: a low sandstone wall with a granite cap
  // and the measured picket section (7/8 inch pickets, 4-5/8 inch clear space -- NCPC transcript, 7 July
  // 2016). Instance them across the run the frame can actually see rather than across 200 m.
  const fz0 = -DIMS.fenceDistance;
  const picketPitch = DIMS.fencePicket + DIMS.fenceGap;
  const fenceRun = 96; // metres of fence to build either side of the centre line
  const picketCount = Math.floor((fenceRun * 2) / picketPitch);
  b.box('fence wall', { x0: -fenceRun, x1: fenceRun, y0: NORTH_LAWN.yAt(fz0), y1: NORTH_LAWN.yAt(fz0) + DIMS.fenceWallHeight, z0: fz0 - 0.25, z1: fz0 + 0.25 }, COLORS.stoneTrim, { metric: true });
  b.box('fence cap', { x0: -fenceRun, x1: fenceRun, y0: NORTH_LAWN.yAt(fz0) + DIMS.fenceWallHeight, y1: NORTH_LAWN.yAt(fz0) + DIMS.fenceWallHeight + 0.12, z0: fz0 - 0.32, z1: fz0 + 0.32 }, COLORS.stoneTrim, { metric: true });
  const picketGeo = new THREE.BoxGeometry(DIMS.fencePicket, DIMS.fenceHeight, DIMS.fencePicket);
  const pickets = new THREE.InstancedMesh(picketGeo, new THREE.MeshStandardMaterial({ color: COLORS.fence, roughness: 0.6, metalness: 0.3 }), picketCount);
  const m = new THREE.Matrix4();
  const fenceBase = NORTH_LAWN.yAt(fz0) + DIMS.fenceWallHeight + 0.12;
  for (let i = 0; i < picketCount; i++) {
    m.makeTranslation(-fenceRun + (i + 0.5) * picketPitch, fenceBase + DIMS.fenceHeight / 2, fz0);
    pickets.setMatrixAt(i, m);
  }
  pickets.instanceMatrix.needsUpdate = true;
  pickets.computeBoundingSphere();
  b.add(pickets, 'fence pickets');
  // The rails the pickets hang on, and the eight stone piers of the 1818-1819 drive.
  for (const y of [fenceBase + 0.25, fenceBase + DIMS.fenceHeight - 0.3]) {
    b.box(`fence rail ${y.toFixed(1)}`, { x0: -fenceRun, x1: fenceRun, y0: y, y1: y + 0.1, z0: fz0 - 0.06, z1: fz0 + 0.06 }, COLORS.fence);
  }
  for (let i = 0; i < 8; i++) {
    const x = -84 + i * 24;
    const gy = NORTH_LAWN.yAt(fz0);
    b.box(`fence pier ${i + 1}`, { x0: x - 0.7, x1: x + 0.7, y0: gy, y1: gy + 2.6, z0: fz0 - 0.85, z1: fz0 + 0.85 }, COLORS.stoneTrim, { metric: true });
    b.box(`fence pier ${i + 1} cap`, { x0: x - 0.9, x1: x + 0.9, y0: gy + 2.6, y1: gy + 2.9, z0: fz0 - 1.05, z1: fz0 + 1.05 }, COLORS.stoneTrim);
  }
  // The drive, just beyond the fence, on the plateau.
  const dz = -DIMS.driveDistance;
  const dgy = NORTH_LAWN.yAt(dz);
  b.box('north drive', { x0: -160, x1: 160, y0: dgy - 0.05, y1: dgy + 0.04, z0: dz - DIMS.driveWidth / 2, z1: dz + DIMS.driveWidth / 2 }, COLORS.drive, { metric: true });

  // ---- the low boundary walls the photo shows at the frame's edges -------------------------------------
  // The photo has a low pale wall on the north lawn's east and west edges, closing the composition either
  // side of the building.
  for (const side of [-1, 1]) {
    const x = side * (halfW + 14);
    b.box(`north lawn boundary wall ${side < 0 ? 'west' : 'east'}`, { x0: x - 1.0, x1: x + 1.0, y0: 0, y1: 1.3, z0: -30, z1: 0 }, COLORS.stoneTrim, { metric: true });
  }

  // The frame's own width at the bed's depth, exported through a mesh's userData so a check can read it.
  const bedFrame = frameWidthAtZ(bedFar);
  void bedFrame;
  return b.group;
}
