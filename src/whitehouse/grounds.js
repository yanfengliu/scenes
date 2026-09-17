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
  // HOW WIDE THE GROUND IS, AND WHY IT IS NOT A TASTE. It was +-180 m and that is not enough: the scene's
  // own camera can stand at x = -77 (nudge's own orbit pose, and any user's drag), from where the frame's
  // left edge looks PAST the lawn's west edge and the void behind it renders black. A reviewer saw exactly
  // that from the west and read it as "a dark slab-like object floating beside the building's west end";
  // it was the hole beyond the ground, and the boundary wall's own lit top edge cutting across it is what
  // made it read as a fallen beam. +-520 m covers the frustum from any camera the clamp allows.
  const TERRAIN_HALF = 520;

  // ---- the north lawn, with its own rise ---------------------------------------------------------------
  // Level at y = 0 from the wall out to NORTH_LAWN.flatTo, then a straight slope up to the camera's own
  // station. Built from the same constants the camera solve produced, so the ground under the camera is
  // exactly the height the solve puts there.
  //
  // THE LAWN IS BANDED, AND THE BANDS ARE THE PHOTOGRAPH'S. A single box of one colour is what the first
  // pass built, and a reviewer looking from the west called the whole lower half of the frame "one flat
  // green with a hard straight edge where the terrain step is". The photograph has neither: its lawn is
  // #646e26 far out, #607726 in the middle and #647b2c near, and those three are already sampled in
  // COLORS. So the ground is cut into 6 m strips across the view, each taking one of the three by its own
  // depth, with the slope's own strips stepped in height to follow NORTH_LAWN.yAt. The near and far edges
  // of the terrain now meet a strip of a different colour rather than a cliff face of the same one.
  const rise = NORTH_LAWN.riseHeight;
  const zA = -NORTH_LAWN.flatTo;
  const zB = -NORTH_LAWN.riseTo;
  const BAND = 6;
  const bandColor = (i) => [COLORS.lawnFar, COLORS.lawnMid, COLORS.lawnNear, COLORS.lawnBand][i % 4];
  // The level stretch, from the wall out to the slope's foot.
  for (let z = 0.2, i = 0; z > zA; z -= BAND, i++) {
    const z0 = Math.max(zA, z - BAND);
    b.box(`north lawn band ${i + 1}`, { x0: -TERRAIN_HALF, x1: TERRAIN_HALF, y0: -0.8, y1: 0, z0, z1: z }, bandColor(i), { metric: true });
  }
  // The slope, one strip per band, each a prism between its own two heights. Not one long ramp: a single
  // ramp's own straight silhouette against the sky is the "hard straight edge" a reviewer saw.
  {
    let i = Math.round(-zA / BAND);
    for (let z = zA; z > zB; z -= BAND, i++) {
      const z0 = Math.max(zB, z - BAND);
      const yTop = NORTH_LAWN.yAt(z0);
      const yBot = NORTH_LAWN.yAt(z);
      const shape = new THREE.Shape();
      shape.moveTo(-z, yBot);
      shape.lineTo(-z0, yTop);
      shape.lineTo(-z0, yTop - 0.8);
      shape.lineTo(-z, yBot - 0.8);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: TERRAIN_HALF * 2, bevelEnabled: false });
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: bandColor(i), roughness: 0.95, metalness: 0 }));
      mesh.rotation.y = -Math.PI / 2; // the shape's local +x is world -z
      mesh.position.set(-TERRAIN_HALF, 0, 0);
      mesh.receiveShadow = true;
      b.add(mesh, `north lawn rise band ${i + 1}`);
    }
  }
  // The plateau the camera stands on, so the frame's own foreground is ground and not a hole.
  for (let z = zB, i = 0; z > zB - 44; z -= BAND, i++) {
    const z0 = Math.max(zB - 44, z - BAND);
    b.box(`north lawn plateau band ${i + 1}`, { x0: -TERRAIN_HALF, x1: TERRAIN_HALF, y0: -0.8, y1: rise, z0, z1: z }, bandColor(40 + i), { metric: true });
  }
  // The far ground beyond the drive and the fence, so the horizon has something under it from any angle.
  b.box('far ground', { x0: -300, x1: 300, y0: -0.9, y1: rise - 0.1, z0: zB - 44, z1: zB - 260 }, COLORS.lawnFar, { metric: true });
  // The south lawn, three metres lower than the north: the reason the south facade shows a third storey.
  b.box('south lawn', { x0: -TERRAIN_HALF, x1: TERRAIN_HALF, y0: -0.8 - DIMS.southLawnDrop, y1: -DIMS.southLawnDrop, z0: -DIMS.blockDepth - DIMS.southBowProjection - 8, z1: 300 }, COLORS.lawnMid, { metric: true });

  // ---- the hedge band along the wall -------------------------------------------------------------------
  // THE BAND ALONG THE WALL IS NOT BUILT HERE. The photograph's own band, whose top is the row the wall's
  // base was measured at (v 0.6180), is the terrace's planted outer rim in building.js: the terrace is
  // 2.976 m tall because the wall's base is, so its own outer edge is what the camera sees on that row, and
  // a hedge built here and standing behind that edge is not in the frame at any height that would not also
  // hide the wall. What this file builds is the north lawn's own end hedges, which close the composition
  // either side of the building -- see foliage.js for the two that stand further out.
  const gap = DIMS.porticoWidth / 2 + 2.5;
  void gap;

  // ---- the red flower bed ------------------------------------------------------------------------------
  // The photo's own foreground feature, out on the lawn: far edge at row 0.6744 (z -46.1), near edge at row
  // 0.7350 (z -58.5). Its 66 m width is 0.464 of the frame at that depth -- a bed this size is what the
  // photograph actually shows, and its flowers read as a band, not as individual plants.
  const bedFar = -DIMS.bedDistance;
  const bedNear = -(DIMS.bedDistance + DIMS.bedDepth);
  const bedHalf = DIMS.bedWidth / 2;
  b.box('flower bed soil', { x0: -bedHalf, x1: bedHalf, y0: 0, y1: 0.35, z0: bedNear, z1: bedFar }, COLORS.flowerBed, { metric: true });
  // The blooms overlap their own soil rather than sitting exactly on it: two boxes that share a face are
  // two surfaces at one depth, which is the same coincidence `nudge` catches on the hedge.
  b.box('flower bed blooms', { x0: -bedHalf + 0.4, x1: bedHalf - 0.4, y0: 0.28, y1: 0.62, z0: bedNear + 0.4, z1: bedFar - 0.4 }, COLORS.flowerBedLit, { metric: true });

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
  //
  // THE MEASURED SECTION IS 22 mm ACROSS AND THAT IS BELOW A PIXEL HERE. The fence stands 91.7 m from the
  // camera, where the frame is 99 m wide over 1200 px, so a 7/8 inch picket is 0.44 px and a 2 mm camera
  // move flips every one of them: `nudge` read 0.21% on its orbited pose against a 0.18% ceiling, and the
  // pickets' own row was one of the two the difference map lit. The picket's WIDTH is therefore built to the
  // smallest size that is still a pixel, 0.05 m, and its spacing is kept: the fence reads as the fine dark
  // band the photograph shows and stops being a sub-pixel lottery. The height stays the reported 13 ft.
  const fz0 = -DIMS.fenceDistance;
  const picketPitch = 0.05 + DIMS.fenceGap;
  const fenceRun = 96; // metres of fence to build either side of the centre line
  const picketCount = Math.floor((fenceRun * 2) / picketPitch);
  b.box('fence wall', { x0: -fenceRun, x1: fenceRun, y0: NORTH_LAWN.yAt(fz0), y1: NORTH_LAWN.yAt(fz0) + DIMS.fenceWallHeight, z0: fz0 - 0.25, z1: fz0 + 0.25 }, COLORS.stoneTrim, { metric: true });
  b.box('fence cap', { x0: -fenceRun, x1: fenceRun, y0: NORTH_LAWN.yAt(fz0) + DIMS.fenceWallHeight, y1: NORTH_LAWN.yAt(fz0) + DIMS.fenceWallHeight + 0.12, z0: fz0 - 0.32, z1: fz0 + 0.32 }, COLORS.stoneTrim, { metric: true });
  const picketGeo = new THREE.BoxGeometry(0.05, DIMS.fenceHeight, 0.05);
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
  // The rails the pickets hang on, and the eight stone piers of the 1818-1819 drive. The rails are wider
  // than the pickets for the same reason the pickets are 0.05 m: a sub-pixel box is a flickering box.
  for (const y of [fenceBase + 0.25, fenceBase + DIMS.fenceHeight - 0.3]) {
    b.box(`fence rail ${y.toFixed(1)}`, { x0: -fenceRun, x1: fenceRun, y0: y, y1: y + 0.14, z0: fz0 - 0.07, z1: fz0 + 0.07 }, COLORS.fence);
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
  // side of the building. SEGMENTED, for the same reason the hedges are: one 30 m run is a wall seen
  // end-on from a camera at x = -77, and a wall seen end-on is a black bar. Five piers with the wall
  // between them is what the photograph actually shows there anyway.
  for (const side of [-1, 1]) {
    const x = side * (halfW + 14);
    for (let s = 0; s < 5; s++) {
      const z0 = -30 + s * 6.4;
      b.box(`north lawn boundary wall ${side < 0 ? 'west' : 'east'} ${s + 1}`, { x0: x - 1.0, x1: x + 1.0, y0: 0, y1: 1.3, z0, z1: z0 + 5.4 }, COLORS.stoneTrim, { metric: true });
      b.box(`north lawn boundary wall ${side < 0 ? 'west' : 'east'} ${s + 1} pier`, { x0: x - 1.3, x1: x + 1.3, y0: 0, y1: 1.6, z0: z0 + 5.4, z1: z0 + 6.4 }, COLORS.stoneTrim, { metric: true });
    }
  }

  // The frame's own width at the bed's depth, exported through a mesh's userData so a check can read it.
  const bedFrame = frameWidthAtZ(bedFar);
  void bedFrame;
  return b.group;
}
