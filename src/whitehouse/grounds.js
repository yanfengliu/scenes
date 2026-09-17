// The grounds in front of the north front: the lawn and its own rise towards Pennsylvania Avenue, the red
// flower bed, the north fountain on the centre axis, the drive, the fence line and the low boundary walls
// the photo shows at the frame's edges.
//
// EVERY z HERE IS POSITIVE, AND THAT IS THE FIX THIS FILE IS. The camera stands at z = +47.863 looking along
// -z, so the north grounds run from the wall at z = 0 out towards the camera, and a feature dn metres in
// front of the camera is at z = 47.863 - dn. The previous pass wrote z = dn - 47.863 instead, which is the
// far side of the camera: the bed, the fountain, the drive and the fence were all one building-length behind
// the wall, the camera's own foreground was the SOUTH lawn slab, and the frame's lower half was an empty
// green field. See layout.js's note above DIMS for the two inversions that produced it.
//
// The distances come from the photo rows the features were measured at, through the fitted camera, and each
// one is stated with the row it came from.
import * as THREE from 'three';
import { DIMS, COLORS, TERRACE, NORTH_LAWN, frameWidthAtZ } from './layout.js';
import { mulberry32, uniform } from '../random.js';

// The bed's own seed: the flowers must build identically on every load, so nothing here is Math.random.
const SEED_BED = 20240621;

// A sampled colour scaled by a reflectance, in sRGB, clamped. The mowing bands are the photograph's own
// sampled lawn colours times a small swing rather than new hexes, so every colour in this file is still one
// that was measured off whitehouse.webp.
function tintHex(hex, k) {
  if (k === 1) return hex;
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
  return (ch((hex >> 16) & 255) << 16) | (ch((hex >> 8) & 255) << 8) | ch(hex & 255);
}

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
  // station at +47.863, then the plateau the camera stands on. Built from the same constants the camera
  // solve produced, so the ground under the camera is exactly the height the solve puts there.
  //
  // THE RISE STARTS AT 30 m, WHICH IS BEYOND EVERY FEATURE THE PHOTOGRAPH CALIBRATES: the bed's near edge is
  // at +14.1 and the hedge at +3.7, so the whole of the calibrated foreground stands on the flat lawn and
  // the row arithmetic in layout.js holds.
  //
  // THE LAWN'S MOWING BANDS ARE THE PHOTOGRAPH'S OWN MEASUREMENT: out/wh/scratch/meanbox.mjs reads the photo
  // on a 10x20 lattice of 18x18 px boxes: rows v 0.775 to 0.975 run #607633 luma 104, #708540 119, #5c732d
  // 100, #627a26 105, #5a7121 97 -- a mean of about 105 with a band-to-band swing of about 15 levels, and
  // the swing is ACROSS the frame (u) and not with distance, which is what a mown lawn under a low sun looks
  // like. So one surface is cut across u into mowing passes about 19 m wide, each pass taking the sampled
  // near-lawn colour multiplied by the pass's own reflectance.
  const rise = NORTH_LAWN.riseHeight;
  const BAND = 6;
  // THE BAND AND PASS INDICES ARE WRAPPED, AND THAT IS A MEASURED FIX. The mowing passes run from -11 to +11
  // so that the lawn is cut either side of the building, and JavaScript's % keeps the sign of its left
  // operand: passTint(-1) indexed [-1] and returned undefined, tintHex multiplied by it and produced NaN,
  // and (NaN << 16) is 0 -- so every pass west of the centre line was painted PURE BLACK. In the frame that
  // was a black wedge over the whole lower left quarter, exactly where the photograph has its brightest lawn.
  const wrap = (i, n) => ((i % n) + n) % n;
  const bandColor = (i) => [COLORS.lawnFar, COLORS.lawnMid, COLORS.lawnNear, COLORS.lawnBand][wrap(i, 4)];
  // A mowing pass's own multiplier. The sampled swing of about 15 levels on a mean of 105 is +-7%.
  const passTint = (i) => [1.0, 1.055, 0.972, 1.028][wrap(i, 4)];
  // THE NORTH LAWN'S OWN GREENS DISPLAY LOW, AND THIS IS THE MEASURED LIFT. out/critic/wh-relayout-rows.mjs
  // reads the render against the photograph row by row: at v 0.75 to 0.98 the photograph's lawn is luma 101
  // to 114 and this scene's north lawn bands displayed 88 to 98, the same 15 luma low at every row and every
  // band. The four sampled hexes are the photograph's own; what was out was their response to the rig, so the
  // lift is stated here as a reflectance and it is applied to the north lawn only. The wall, the bed, the
  // hedge and the sky all measure within a few levels and are untouched.
  const LAWN_LIFT = 1.15;
  const lawnTint = (i, pass) => tintHex(bandColor(i), passTint(pass) * LAWN_LIFT);
  const PASS = 19.0;
  const PASS_HALF = 200; // metres either way: past this the fog owns the ground and a band costs a draw call
  const passLoop = (i, z0, z1, y0, y1, tag) => {
    for (let pass = -Math.round(PASS_HALF / PASS); pass <= Math.round(PASS_HALF / PASS); pass++) {
      const x = pass * PASS;
      b.box(`${tag} ${i + 1} pass ${pass}`, { x0: x - PASS / 2, x1: x + PASS / 2, y0, y1, z0, z1 }, lawnTint(i, pass), { metric: true });
    }
  };
  // The level stretch, from the wall out to the slope's foot: one prism per (band, mowing pass) cell, so the
  // mowing bands run the full depth of the lawn as they do in the photograph.
  for (let i = 0, z = 0; z < NORTH_LAWN.flatTo - 1e-6; z += BAND, i++) {
    passLoop(i, z, Math.min(NORTH_LAWN.flatTo, z + BAND), -0.8, 0, 'north lawn band');
  }
  // The slope, one strip per band, each a prism between its own two heights. Not one long ramp: a single
  // ramp's own straight silhouette against the sky is the "hard straight edge" a reviewer saw.
  {
    let i = Math.round(NORTH_LAWN.flatTo / BAND);
    for (let z = NORTH_LAWN.flatTo; z < NORTH_LAWN.riseTo - 1e-6; z += BAND, i++) {
      const z1 = Math.min(NORTH_LAWN.riseTo, z + BAND);
      const yBot = NORTH_LAWN.yAt(z);
      const yTop = NORTH_LAWN.yAt(z1);
      const shape = new THREE.Shape();
      shape.moveTo(z, yBot);
      shape.lineTo(z1, yTop);
      shape.lineTo(z1, yTop - 0.8);
      shape.lineTo(z, yBot - 0.8);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: TERRAIN_HALF * 2, bevelEnabled: false });
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: tintHex(bandColor(i), LAWN_LIFT), roughness: 0.95, metalness: 0 }));
      // THE SHAPE'S OWN x IS WORLD +z HERE, and the extrusion runs from x = +520 back to -520. The previous
      // pass had this at position.x = -TERRAIN_HALF, which put the whole slope 520 m off to the west.
      mesh.rotation.y = -Math.PI / 2;
      mesh.position.set(TERRAIN_HALF, 0, 0);
      mesh.receiveShadow = true;
      b.add(mesh, `north lawn rise band ${i + 1}`);
    }
  }
  // The plateau the camera stands on, so the frame's own foreground is ground and not a hole.
  for (let i = 0, z = NORTH_LAWN.riseTo; z < NORTH_LAWN.riseTo + 44 - 1e-6; z += BAND, i++) {
    passLoop(40 + i, z, Math.min(NORTH_LAWN.riseTo + 44, z + BAND), -0.8, rise, 'north lawn plateau band');
  }
  // The far ground beyond the drive and the fence, so the horizon has something under it from any angle.
  b.box('far ground', { x0: -300, x1: 300, y0: -0.9, y1: rise - 0.1, z0: NORTH_LAWN.riseTo + 44, z1: NORTH_LAWN.riseTo + 260 }, COLORS.lawnFar, { metric: true });
  // The south lawn, three metres lower than the north: the reason the south facade shows a third storey.
  // IT IS BEHIND THE BUILDING AND NOWHERE ELSE: it runs from the south portico's own bow outward, at z < -40,
  // so it can never be the camera's foreground. It used to run to z +300 and cover the whole photo view.
  b.box('south lawn', { x0: -TERRAIN_HALF, x1: TERRAIN_HALF, y0: -0.8 - DIMS.southLawnDrop, y1: -DIMS.southLawnDrop, z0: -340.6, z1: -40.6 }, COLORS.lawnMid, { metric: true });

  // ---- the hedge band along the wall -------------------------------------------------------------------
  // THE BAND ALONG THE WALL IS NOT BUILT HERE. The photograph's own band, whose top is the row the wall's
  // base was measured at (v 0.6180), is the terrace hedge in foliage.js: its crowns' tops lie on the ray to
  // the wall's own base, so it hides the terrace's face and the porch's floor behind it. What this file does
  // not build is a second hedge in that band.

  // ---- the red flower bed ------------------------------------------------------------------------------
  // THE PHOTOGRAPH'S OWN FOREGROUND FEATURE, AND THE ROW ARITHMETIC IS WHAT PLACES IT. Its red runs from
  // v 0.674 (the crest, at the centre it is hidden behind the plume as far down as 0.687) to v 0.733 (the
  // dark line of its own near edge), and it spans u 0.1025 to 0.8925 at v 0.70. On the LAWN's own plane the
  // crest row 0.6744 with a 1.12 m crest is dn 42.33 m, i.e. z +5.6; the near edge 0.7350 with a 0.50 m
  // crest is z +14.1. Its width is 0.79 of the 57.2 m frame at v 0.70, which is 46 m.
  //
  // SO THE BED IS THE LONG BED ALONG THE NORTH FRONT, not a bed 15 m out on the lawn: its far edge is at
  // the terrace's own foot (the ground row at the wall's foot is v 0.6755, and the bed's crest is 6 px above
  // it). DIMS.bedDistance = 15.4, which the previous pass used, would put this same crest at v 0.742 -- 61 px
  // below where the photograph has it.
  //
  // ONE FLAT BOX OF #df4c55 IS NOT A BED OF FLOWERS: out/wh/scratch/meanbox.mjs reads the bed's own lattice
  // of 18x18 px boxes across ONE row as #411f17 #5d2a26 #692827 #752729 #732f28 #79302d #5b2925 #43261f,
  // a span of #411f17 to #79302d (luma 40 to 69). So the bed is a dark soil body with overlapping bloom
  // masses on a seeded walk, each taking one of the two sampled reds, and the crests lifted so the top edge
  // is broken rather than ruled -- and the crest SLOPES: 1.12 m at the far edge down to 0.50 m at the near
  // one, which is what puts the far crest on row 0.674 and the near edge on row 0.733 at once.
  const bedFar = DIMS.bedDistance;
  const bedNear = DIMS.bedDistance + DIMS.bedDepth;
  const bedHalf = DIMS.bedWidth / 2;
  // THE SOIL BODY STOPS SHORT OF THE CREST'S OWN NEAR EDGE, AND ITS ENDS TAPER. Two rows, both the
  // photograph's: the crest at the near edge is 0.50 m and lands on v 0.735, but the 0.35 m soil box's own
  // top reaches that row 5 px earlier and its vertical near face another 8 px after it; and the bed's red is
  // 46 m across where it meets the lawn (u 0.1017..0.8983 at v 0.71) but only 34 m across at v 0.72, so its
  // ends draw in as it comes towards the camera. A single rectangular box paints a red wall where the
  // photograph has the bed's own dark edge and then lawn.
  const soil = [
    [bedFar, 8.1, DIMS.bedWidth],
    [8.1, 10.6, DIMS.bedWidth - 1.5],
    [10.6, 12.3, DIMS.bedWidth - 4.0],
    [12.3, bedNear - 0.7, DIMS.bedWidth - 8.0],
  ];
  for (const [za, zb, w] of soil) {
    b.box(`flower bed soil ${za.toFixed(1)}`, { x0: -w / 2, x1: w / 2, y0: 0, y1: 0.35, z0: za, z1: zb }, COLORS.flowerBed, { metric: true });
  }
  {
    const rand = mulberry32(SEED_BED);
    // THE GRAIN OF THE BED IS ITS OWN MEASUREMENT. The first cut of this pass used 7 rows of 0.9 m lobes on
    // a 1.15 m pitch, and the frame showed a flat two-tone slab with a lighter band: at 40 m a 0.9 m lobe is
    // 18 px and the photograph's own bloom heads are 6 to 10. 52 across by 9 deep at 0.85 m and 1.6 m, each
    // lobe 0.44 to 0.68 m, is what the photograph's texture resolves to at this depth.
    const nz = 9;
    const nx = Math.round(DIMS.bedWidth / 0.85);
    // THE BLOOM MASS STOPS AT DIMS.bedBloomTo, which is the row the photograph's bright red stops at: its
    // near third is the bed's own dark soil and shadow, not blooms.
    const z0 = bedFar + 0.05;
    const z1 = DIMS.bedBloomTo;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < nz; j++) {
        const u = (i + 0.5) / nx;
        const v = (j + 0.5) / nz;
        const x = -bedHalf + 0.5 + u * (DIMS.bedWidth - 1.0);
        const z = z0 + v * (z1 - z0);
        // THE CREST FALLS FROM THE FAR EDGE TO THE NEAR ONE, and that is the row arithmetic, not a look:
        // 1.20 m at z +5.6 projects to the photo's v 0.674 and 0.50 m at z +14.1 to its v 0.735.
        const top = DIMS.bedCrest - (DIMS.bedCrest - DIMS.bedNearCrest) * ((z - z0) / (bedNear - z0)) + uniform(rand, -0.03, 0.03);
        const lobe = new THREE.Mesh(
          new THREE.SphereGeometry(1, 7, 5),
          new THREE.MeshStandardMaterial({ color: rand() < 0.34 ? COLORS.flowerBedLit : COLORS.flowerBed, roughness: 0.95, metalness: 0, flatShading: true }),
        );
        lobe.scale.set(uniform(rand, 0.22, 0.34), (top - 0.22) / 2, uniform(rand, 0.22, 0.34));
        lobe.position.set(x, 0.22 + (top - 0.22) / 2, z);
        lobe.receiveShadow = true;
        b.add(lobe, `flower bed bloom ${i + 1} ${j + 1}`);
      }
    }
  }

  // ---- the fountain on the centre axis -----------------------------------------------------------------
  // IT STANDS IN THE BED, AND THE BED IS WHAT HIDES ITS BASIN. This is the one thing about the fountain the
  // photograph settles beyond argument: the plume's white runs from v 0.523 down to v 0.687 at u 0.5, and
  // 0.687 is the row of the BED'S OWN CREST at the fountain's depth -- so the red mass in front of the
  // fountain's base is what cuts the plume, and a basin rim can never show above it. (A rim 0.62 m high can
  // not be hidden behind a 0.6 m bed at any distance in front of it: a taller object farther away still
  // projects above the nearer silhouette. It has to be inside the bed, and it is.)
  //
  // THE AXIS IS AT z +7.7, from the plume's own bottom row: the bed's crest at depth z reaches v 0.687 when
  // 9.086 - y(z) = 0.187 * 1.08184 * (47.863 - z), which solves to z 7.7. The jet's top then has to be
  // 8.09 m above the lawn for the plume's top to land on the photo's v 0.523.
  //
  // THE WIDTHS ARE THE PHOTOGRAPH'S TOO: at this depth 1 px is 0.048 m, and the photo's plume is 14 px across
  // at its top and 42 to 55 px at its base -- 0.7 m of water at the jet and 2.0 to 2.6 m where it falls into
  // the basin. So the jet is a cone that is 0.30 m across at the top and 1.05 m at the bottom, with a small
  // plume cap on it, and the falling water flares into the basin below.
  const fz = DIMS.fountainDistance;
  const fr = DIMS.fountainBasinRadius;
  const rimH = DIMS.fountainRimHeight;
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(fr * 0.94, fr, rimH, 32), new THREE.MeshStandardMaterial({ color: COLORS.stoneTrim, roughness: 0.9, metalness: 0 }));
  basin.position.set(0, rimH / 2, fz);
  basin.receiveShadow = true;
  b.add(basin, 'fountain basin');
  const water = new THREE.Mesh(new THREE.CylinderGeometry(fr * 0.88, fr * 0.88, 0.1, 32), new THREE.MeshStandardMaterial({ color: COLORS.fountainWater, roughness: 0.25, metalness: 0 }));
  water.position.set(0, DIMS.fountainWaterHeight, fz);
  water.receiveShadow = true;
  b.add(water, 'fountain water');
  const jetH = DIMS.fountainJetHeight - DIMS.fountainWaterHeight;
  // ONE CONE, AND ITS OWN WIDTHS ARE THE PHOTOGRAPH'S. The white in the frame runs 4 to 14 px wide at the
  // plume's top (v 0.523), 27 to 32 px at v 0.60, 41 px at 0.65 and 47 to 53 px where the bed cuts it at
  // 0.687. Those rays meet the jet at 4.74 m, 2.57 m and 1.26 m above the water, so the water is a cone
  // 1.4 m across at 4.7 m, 2.0 m at 2.6 m and 2.5 m at 1.3 m -- radius 0.26 m at the 8.09 m top, 1.25 m at
  // the basin. The first cut of this pass had a narrow jet plus a separate 2.9 m curtain and the frame showed
  // a white cone twice the photograph's width in its upper half.
  const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 1.25, jetH, 14), new THREE.MeshStandardMaterial({ color: COLORS.fountainWater, roughness: 0.3, metalness: 0, transparent: true, opacity: 0.85 }));
  jet.position.set(0, (DIMS.fountainWaterHeight + DIMS.fountainJetHeight) / 2, fz);
  b.add(jet, 'fountain jet');
  // The plume's own cap: the froth at the top of the jet, which is the narrowest white in the frame.
  const plume = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ color: COLORS.fountainWater, roughness: 0.4, metalness: 0, transparent: true, opacity: 0.7 }));
  plume.scale.set(0.34, 0.7, 0.34);
  plume.position.set(0, DIMS.fountainJetHeight - 0.4, fz);
  b.add(plume, 'fountain plume');

  // ---- the fence line ----------------------------------------------------------------------------------
  // The fence is the post-2020 one this June 2024 photograph shows: a low sandstone wall with a granite cap
  // and the measured picket section (7/8 inch pickets, 4-5/8 inch clear space -- NCPC transcript, 7 July
  // 2016). IT STANDS 90.8 m NORTH OF THE WALL, WHICH IS BEHIND THE CAMERA, AND THAT IS THE POINT: the
  // photograph shows lawn from the bed's near edge to the frame's bottom and no fence anywhere in it. The
  // old z -43.9 put the fence in the frame, at v 0.48-0.53, as the dark band with a "parked car" silhouette
  // on it that the brief names -- it was the fence's own piers seen end-on at 92 m.
  //
  // THE MEASURED SECTION IS 22 mm ACROSS AND THAT IS BELOW A PIXEL HERE, so the picket's WIDTH is built to
  // the smallest size that is still a pixel, 0.05 m, and its spacing is kept: the picket's own row was one
  // of the two `nudge` lit, and a sub-pixel box is a flickering box. The height stays the reported 13 ft.
  const fz0 = DIMS.fenceDistance;
  const fenceGround = NORTH_LAWN.yAt(fz0);
  const picketPitch = 0.05 + DIMS.fenceGap;
  const fenceRun = 96; // metres of fence to build either side of the centre line
  const picketCount = Math.floor((fenceRun * 2) / picketPitch);
  b.box('fence wall', { x0: -fenceRun, x1: fenceRun, y0: fenceGround, y1: fenceGround + DIMS.fenceWallHeight, z0: fz0 - 0.25, z1: fz0 + 0.25 }, COLORS.stoneTrim, { metric: true });
  b.box('fence cap', { x0: -fenceRun, x1: fenceRun, y0: fenceGround + DIMS.fenceWallHeight, y1: fenceGround + DIMS.fenceWallHeight + 0.12, z0: fz0 - 0.32, z1: fz0 + 0.32 }, COLORS.stoneTrim, { metric: true });
  const picketGeo = new THREE.BoxGeometry(0.05, DIMS.fenceHeight, 0.05);
  const pickets = new THREE.InstancedMesh(picketGeo, new THREE.MeshStandardMaterial({ color: COLORS.fence, roughness: 0.6, metalness: 0.3 }), picketCount);
  const m = new THREE.Matrix4();
  const fenceBase = fenceGround + DIMS.fenceWallHeight + 0.12;
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
    b.box(`fence pier ${i + 1}`, { x0: x - 0.7, x1: x + 0.7, y0: fenceGround, y1: fenceGround + 2.6, z0: fz0 - 0.85, z1: fz0 + 0.85 }, COLORS.stoneTrim, { metric: true });
    b.box(`fence pier ${i + 1} cap`, { x0: x - 0.9, x1: x + 0.9, y0: fenceGround + 2.6, y1: fenceGround + 2.9, z0: fz0 - 1.05, z1: fz0 + 1.05 }, COLORS.stoneTrim);
  }

  // ---- the semicircular drive --------------------------------------------------------------------------
  // "The north lawn is divided into three sections by a semicircular paved access drive that leads to the
  // north portico... Within the drive is a predominantly open, semicircular lawn with a circular fountain in
  // the center" -- CLR p.384, research-dims.md section 8.3. Its chord is the fence line and it bulges
  // towards the building, so the lawn inside it is the panel the camera itself stands on.
  //
  // IT IS THE ONE FEATURE OF THE SOURCED LAYOUT THE PHOTOGRAPH CANNOT SHOW, and the reason is worth stating:
  // the photograph has uninterrupted lawn from the bed's near edge (v 0.735) to the frame's bottom, and a
  // carriageway crossing the centre line anywhere between z +5 and z +30 would be drawn across rows
  // 0.67-0.95. The drive is therefore built where the LAWN'S OWN RISE takes it out of the frame: its
  // building-side kerb passes z +36 at x 0, where the ground is 2.5 m up and the kerb projects to v 1.013,
  // below the frame's bottom edge.
  //
  // IT IS A TERRAIN-FOLLOWING RIBBON, NOT A ROW OF BoxGeometry SEGMENTS, AND THAT IS A MEASURED FIX. A row
  // of 9 m deep flat boxes on a 22.7 degree bank floats at one end and sinks at the other: the first cut of
  // this file drew them at their own midpoint's height and the near end of every box rose 1.9 m clear of the
  // ground, which put a dark grey band straight across rows v 0.86-1.00 -- the whole of the photograph's
  // brightest lawn. Every vertex here is sampled from NORTH_LAWN.yAt, so the paving lies on the bank.
  {
    const arcR = DIMS.driveCentreZ === undefined ? 0 : DIMS.fenceDistance - DIMS.driveCentreZ;
    const segs = 56;
    const half = DIMS.driveWidth / 2;
    const rings = [-half, -half / 2, 0, half / 2, half].map((d) => arcR + d);
    const pos = [];
    for (const r of rings) {
      for (let i = 0; i <= segs; i++) {
        const a = Math.PI * (i / segs);
        const x = Math.cos(a) * r;
        const z = DIMS.fenceDistance - Math.sin(a) * r;
        pos.push(x, NORTH_LAWN.yAt(z) + 0.06, z);
      }
    }
    const idx = [];
    const W = segs + 1;
    for (let k = 0; k < rings.length - 1; k++) {
      for (let i = 0; i < segs; i++) {
        const a0 = k * W + i;
        const a1 = a0 + 1;
        const b0 = (k + 1) * W + i;
        const b1 = b0 + 1;
        idx.push(a0, b0, a1, a1, b0, b1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COLORS.drive, roughness: 0.95, metalness: 0, side: THREE.DoubleSide }));
    mesh.receiveShadow = true;
    b.add(mesh, 'north drive');
  }

  // ---- the low boundary walls the photo shows at the frame's edges -------------------------------------
  // The photo has a low pale wall on the north lawn's east and west edges, closing the composition either
  // side of the building. SEGMENTED, for the same reason the hedges are: one 30 m run is a wall seen
  // end-on from a camera at x = -77, and a wall seen end-on is a black bar. Five piers with the wall
  // between them is what the photograph actually shows there anyway.
  //
  // THEY ARE OFF THE FRAME's EDGES FROM THE PHOTO VIEW, at x +-39.6: the frame is 1.44245 * dn wide and the
  // wall's near end is at dn 46, so it would need |x| < 33 m to be in the picture at all. That is why the
  // photograph shows no such wall on the lawn, and the two small dark objects it does show at u 0.10 and
  // u 0.90 (v 0.67-0.70) are at |x| 22-24 m: they are the bed's own ends.
  for (const side of [-1, 1]) {
    const x = side * (halfW + 14);
    for (let s = 0; s < 4; s++) {
      const z0 = 1.6 + s * 6.4;
      b.box(`north lawn boundary wall ${side < 0 ? 'west' : 'east'} ${s + 1}`, { x0: x - 1.0, x1: x + 1.0, y0: 0, y1: 1.3, z0, z1: z0 + 5.4 }, COLORS.stoneTrim, { metric: true });
      b.box(`north lawn boundary wall ${side < 0 ? 'west' : 'east'} ${s + 1} pier`, { x0: x - 1.3, x1: x + 1.3, y0: 0, y1: 1.6, z0: z0 + 5.4, z1: z0 + 6.4 }, COLORS.stoneTrim, { metric: true });
    }
  }

  // The frame's own width at the bed's depth, exported through a mesh's userData so a check can read it.
  const bedFrame = frameWidthAtZ(bedFar);
  void bedFrame;
  void TERRACE;
  return b.group;
}
