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
import { albedoOf, albedoScaleOf, makeMaterial } from '../materials.js';
import { speckleTexture } from './grass.js';

// A smooth 0..1 ramp, 0 at or below `a` and 1 at or above `b`. Used for every edge the mowing modulation
// has, because a stepped edge is the defect this file was rewritten for.
function smoothstep(a, b, v) {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

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
  // made it read as a fallen beam.
  //
  // +-520 m WAS STILL NOT ENOUGH, AND THAT IS NOW A GATE RATHER THAN A PARAGRAPH. `npm run groundcover`
  // drops a ray straight down on a 20 m grid over x +-640 m, z +-900 m and asks whether any of them reaches
  // the sky dome. Neither of the gate's numbers is a taste either: 640 m is 260 m of the camera clamp's own
  // orbit distance (main.js) plus 0.7213 x 520 of the frame's half-width at this scene's old ground edge,
  // and 900 m is the fog's own far distance, past which ground and sky cannot be told apart. On the +-520
  // tree **4,166 of its 5,915 cells reached the sky**: 12 cells in each of 32 rows, six at each end
  // (x +-540 to +-640), plus every row past z -320 and past z +320, where the ground simply stopped. 680 is
  // the gate's 640 plus two of its cells, so the gate reads ground here rather than the edge of this fix.
  const TERRAIN_HALF = 680;

  // ---- the north lawn, with its own rise, as ONE SMOOTH MOWN SURFACE -----------------------------------
  // Level at y = 0 from the wall out to NORTH_LAWN.flatTo, then a straight slope up to the camera's own
  // station at +47.863, then the plateau the camera stands on. Built from the same constants the camera
  // solve produced, so the ground under the camera is exactly the height the solve puts there.
  //
  // THE RISE STARTS AT 30 m, WHICH IS BEYOND EVERY FEATURE THE PHOTOGRAPH CALIBRATES: the bed's near edge is
  // at +14.1 and the hedge at +3.7, so the whole of the calibrated foreground stands on the flat lawn and
  // the row arithmetic in layout.js holds.
  //
  // WHY THIS IS ONE VERTEX-COLOURED MESH AND NOT 300 BOXES, and it is a measured defect, not a tidy-up. The
  // lawn used to be a prism per (6 m band, 19 m mowing pass) cell, each with its own flat colour: 303 draw
  // calls tiling the ground like a checkerboard, and every cell boundary a HARD straight edge. Two things
  // were wrong with that and the second was the bad one:
  //
  //   * Amplitude. out/wh/scratch/whband.mjs scans the near lawn (v 0.78 to 1.00) as a row of 41 px box
  //     means, detrends with a moving average and reports peak-to-trough. whitehouse.webp reads 13.0 luma
  //     down the lawn and 18.3 across it; the render read 20.2 down and 6.5 across. So the render's banding
  //     was 1.6x the photograph's down the frame -- and only 0.36x of it across, which is the part of the
  //     brief's own claim that does not hold (see the pass note below).
  //   * Edge. out/wh/scratch/whhp.mjs high-passes the same strip at a 3.3 m radius: the photograph's lawn
  //     comes back as blade speckle with no structure at all, and the render's as a stack of ruled
  //     horizontal bars. A stepped 6 m band is a bar; a mown lawn is not.
  //
  // So the mowing is ONE smooth field now, sampled per vertex, and it carries three properties:
  //   * passes at a 19 m pitch, the width this file has always claimed for them;
  //   * a slower change with depth at the four sampled bands' own 4 x 6 m = 24 m cycle, so the lawn still
  //     varies the way the sampled palette did, without a 6 m sawtooth's hard edge;
  //   * both are cosines, so every edge is a gradient and there is no boundary to see.
  //
  // WHICH OF THE TWO IS THE REAL ONE IS THE MEASUREMENT BELOW, AND IT SAYS THE PASSES RUN PARALLEL TO THE
  // BUILDING. The old note here had it the other way, and the two readings disagree because they are read
  // off different lattices; the 1200 px scan settles it at 4.5 luma across the frame against 13.0 down it.
  //
  // THE AMPLITUDES ARE THE PHOTOGRAPH'S OWN MEASUREMENT, and the instrument is out/wh/scratch/whband.mjs:
  // the near lawn (v 0.78 to 1.00) scanned as a row of 41 px box means, detrended with a moving average of
  // 0.12 of the frame, peak-to-trough over the scan. whitehouse.webp reads, per column of the scan:
  //
  //   mean luma across the frame   101.9 104.2 106.4 103.0 104.3 105.8 103.7   -- a 4.5 luma spread
  //   peak-to-trough down it         9.4   6.5  16.2   8.0  16.2  13.5  21.4   -- mean 13.0
  //
  // THE 4.5 IS THE ONE THAT MEASURES A MOWING PASS, because a pass runs the full depth of the lawn: every
  // column of the scan crosses the same passes, so a pass shows up as a difference between the columns'
  // own MEANS, and the down-column figure is the change with distance. The photograph's lawn is very nearly
  // flat across the frame (4.5 luma over 1200 px) and varies 13.0 with depth, which says the passes run
  // PARALLEL TO THE BUILDING, not across the frame as this file's original note had it. That note was read
  // off a 10x20 lattice whose u step was 3.5 m, which aliases a fine across-frame structure into a coarse
  // one; the two figures above are from 1200 px of it.
  //
  // MOW_X IS SET BY THE ACROSS-FRAME FIGURE AND IT IS THE BRIEF'S AMPLITUDE DEFECT, MEASURED. That figure
  // is the spread of the seven columns' own MEANS, which is the only across-frame reading that isolates
  // structure running the lawn's full depth -- a mowing pass -- from the grass texture the row scan picks
  // up. The photograph's seven means span 4.5 luma over 1200 px; the shipped render's span 2.5; the first
  // cut of this field, at MOW_X 0.080, spanned 11.8; at 0.020 it spans 6.2 on the same scan. MOW_Z is the
  // down-column 13.0, which the shipped field read as 20.2 and this one reads as 12.3. Both are
  // reflectances on the mean, exactly as the old `passTint` was.
  //
  // WHAT THE SHIPPED FIELD GOT WRONG IS THEREFORE NOT SIMPLY "TOO STRONG". Down the lawn it was 20.2 against
  // the photograph's 13.0, 1.55x -- but the brief's own words are "hard, straight edges", and that is the
  // part the number cannot carry: the high-pass below is what it looks like. It was a 6 m sawtooth whose
  // four colours stepped by up to 14 luma at once, and out/wh/scratch/whhp.mjs at a 3.3 m radius turns the
  // photograph's near lawn into blade speckle and the shipped render's into a stack of ruled bars.
  //
  // WHAT IS *NOT* MATCHED, AND IT IS THE PART OF THE BRIEF THAT DOES NOT HOLD. The render's across-frame
  // row reading is 6.7 against the photograph's 18.3, and no mowing field can close that: out/wh/scratch/
  // whhp.mjs high-passes both near lawns at a 3.3 m radius and the photograph comes back as blade speckle
  // with no structure in it, while the render's comes back as flat colour. The photograph's 18.3 is grass
  // texture at a 1 to 3 m scale, which the column scan averages away (its own means are flat) and which a
  // flat-shaded lawn has no counterpart for. Matching it would mean adding a grass texture, not a pass.
  //
  // THE BASE IS THE FOUR SAMPLED HEXES' OWN MEAN -- #647828, from lawnNear/lawnMid/lawnFar/lawnBand --
  // carrying the 1.01375 the four pass tints used to average to and the measured LAWN_LIFT, so replacing
  // the stepped field with a smooth one does not move the lawn's level. THE NORTH LAWN'S OWN GREENS DISPLAY
  // LOW, AND THE LIFT IS THAT MEASUREMENT: out/critic/wh-relayout-rows.mjs reads the render against the
  // photograph row by row, and at v 0.75 to 0.98 the photograph's lawn is luma 101 to 114 where this
  // scene's bands displayed 88 to 98. The four sampled hexes are the photograph's own; what was out was
  // their response to the rig. THE LIFT IS NOW CARRIED BY EVERY GROUND SURFACE AND NOT BY THE NORTH LAWN
  // ALONE: unlifted, the far ground and the south lawn displayed 90 and 94 against the lawn's 112, which
  // is a hard 20 luma line across the ground at z 0, at z 91.9 and at z -40.6 -- three more straight edges,
  // in the one place a camera flying the grounds looks first. out/wh/scratch/whtop.mjs reads the top-down
  // at 112 luma from z -90 to z +60 since.
  const rise = NORTH_LAWN.riseHeight;
  const LAWN_LIFT = 1.15;
  const LAWN_BASE = tintHex(0x647828, 1.01375 * LAWN_LIFT);
  const lawnBase = albedoOf(LAWN_BASE);
  // ---- BLADE-SCALE SPECKLE, which the flat lawn had no counterpart for and which is the whole of this pass
  // The photograph's near lawn is dense blade speckle: measured over u 0.20-0.80, v 0.90-0.98 it has sd 29.5
  // luma and a mean |gradient| of 23.5 levels/px, and the render's same box had sd 2.8 and 0.124. That
  // measurement is out/wh/scratch/whlawnstat.mjs, and the generator, its pitches, its mean and why it is a
  // modulation rather than geometry are in src/whitehouse/grass.js. WHAT IS HERE IS THE PART THAT IS THIS
  // FILE'S: the mesh's own UVs and the decision not to touch the mowing field.
  //
  // THE UVs ARE PLANAR FROM (x, z) AT THE TEXTURE'S OWN WORLD PITCH, so the speckle is continuous across
  // every cell of the 2 m grid -- a grid whose own edges would show as straight lines in a high-pass if each
  // cell carried its own copy. A 1.5 m vertex spacing cannot carry an 8 cm grain, and does not have to: the
  // grain is per-TEXEL, and all the mesh has to do is give the texture a world-locked coordinate.
  //
  // IT IS BOUND TO `aoMap` AND THE SECOND UV SET, NOT TO `map`, and the reason is in grass.js's header: a
  // modulation that averages one cannot be an 8-bit map in the albedo slot, because that slot's map is
  // multiplied by the material's colour as well, and the lawn's albedo is already in the vertex colours.
  // `aoMap` multiplies `diffuseColor` once, on its own texture unit, and leaves the albedo path alone.
  //
  // THE MOWING FIELD IS UNTOUCHED. MOW_X and MOW_Z are still 0.020 and 0.072 and the vertex colours still
  // carry them. What changed is the variance around them and the material's own colour, which is
  // `albedoScaleOf(LAWN_BASE)` divided by the map's measured mean and then corrected per channel -- see the
  // long note at the material. The photograph's lawn rows read luma 101 to 114
  // (out/wh/scratch/meanbox.mjs), and the near-lawn box is measured against the zero-variance control after
  // every change to either number.
  const speckle = speckleTexture();
  // The texture's own world pitch, read off the texture rather than from a second import of the config, so
  // the UVs and the map cannot disagree about how many metres one tile covers.
  const UV_PER_METRE = 1 / speckle.userData.metres;
  const PASS = 19.0; // the mowing passes' own width, across the frame
  const PASS_Z = 24.0; // and the slower change with depth
  const MOW_X = 0.020; // each pass's own reflectance against the mean
  const MOW_Z = 0.072;
  // THE MOWING COVERS THE NORTH LAWN'S OWN FOOTPRINT AND STOPS AT THE FENCE, AND THE MASK IS THE MEASURED
  // PART OF THIS FIX. It used to run x = -218.5 to +218.5 over every z from 0 to 91.9, which is 437 m of
  // mown ground: from the west and from above the passes tiled the whole visible world and ran on past the
  // fence to the horizon. The north lawn is the panel between the building and the fence, and its own
  // lateral edges are the drive's -- the sourced semicircular drive's chord IS the fence line at z +90.8 and
  // its own ends are at x +-DIMS.fenceDistance - driveCentreZ (CLR p.384, "a semicircular paved access drive
  // ... within the drive is a predominantly open, semicircular lawn"). So the panel is z 0 to the fence,
  // |x| out to the drive's ends, and every edge of it is a 12 m smoothstep rather than a line. Beyond it the
  // ground is still lawn; it is grass nobody cuts in this pattern, which is what the rest of the 1040 m is.
  const PANEL_R = DIMS.fenceDistance - DIMS.driveCentreZ; // 50.3: the drive's own radius, and its ends
  const mown = (x, z) => {
    const across = 1 - smoothstep(PANEL_R - 6, PANEL_R + 6, Math.abs(x));
    const toFence = 1 - smoothstep(DIMS.fenceDistance - 6, DIMS.fenceDistance - 1, z);
    const fromWall = smoothstep(-4, 1, z);
    return across * toFence * fromWall;
  };
  const lawnColour = (x, z) => {
    const m = mown(x, z) * (MOW_X * Math.cos((x / PASS) * Math.PI * 2) + MOW_Z * Math.cos((z / PASS_Z) * Math.PI * 2));
    return [lawnBase.r * (1 + m), lawnBase.g * (1 + m), lawnBase.b * (1 + m)];
  };
  // THE SURFACE IS SAMPLED FINELY WHERE THE MOWING IS AND COARSELY WHERE IT IS NOT, because the fog owns
  // everything past about 250 m and a 2 m grid over 1040 m would be 260,000 cells to draw a gradient nobody
  // can see. The 2 m grid spans +-80 m, which is four full mowing passes either side of the axis.
  const Z_STEP = 1.5;
  const Z_END = NORTH_LAWN.riseTo + 44; // the plateau's own far edge, a metre past the fence
  // ---- the ground behind and beside the building, which did not exist ----------------------------------
  // THE BLUE BAND ACROSS THE GROUNDS WAS A HOLE WITH THE SKY BEHIND IT, and this grid is what closes it.
  // The north lawn ran from z = 0 northwards and the south lawn began at z = -40.6, so a 40.6 m trench
  // across the full 1040 m width -- plugged only by the building's own 51.2 m footprint -- had no mesh in it
  // at all. out/wh/scratch/whvoid.mjs drops a downward ray on a 20 m grid over the whole world: at (60, -10)
  // and (-60, -10) the first thing the ray met was the sky dome 2386 m BELOW, and out/critic/wh-topdown.mjs
  // drew the same band as a black bar. From above it was the broad blue rectangle behind the building with
  // hard straight edges running under both framing trees; from the west it was the pale wedge across the
  // lawn. So the grid's own z range starts at the south lawn's edge, not at the wall.
  //
  // THE APRON'S GRADE IS WHY THIS IS ONE SURFACE AND NOT A SECOND SLAB. It falls from the north grade at the
  // wall (y 0 at z 0) to the south lawn's own level over 40.6 m -- a 3.1 degree grade, which is what a lawn
  // falling away to the south looks like -- so it meets the lawn at one end and the south lawn's top at the
  // other with no step at either and no seam anywhere for the eye to find.
  const SOUTH_LAWN_EDGE = -40.6; // the south portico's own bow, where the south lawn's box begins
  const APRON_FALL = DIMS.southLawnDrop / -SOUTH_LAWN_EDGE; // 0.0739 m of fall per metre going south
  const groundY = (z) => (z >= 0 ? NORTH_LAWN.yAt(z) : APRON_FALL * z);
  const xs = [-TERRAIN_HALF, -400, -300, -220, -160, -120, -100, -80];
  for (let x = -78; x <= 78; x += 2) xs.push(x);
  xs.push(80, 100, 120, 160, 220, 300, 400, TERRAIN_HALF);
  // The apron is a straight ramp with nothing on it, so it needs a fifth of the rows the mowing does.
  const APRON_STEP = 5;
  const zs = [SOUTH_LAWN_EDGE];
  for (let i = 1; SOUTH_LAWN_EDGE + i * APRON_STEP < 0; i++) zs.push(SOUTH_LAWN_EDGE + i * APRON_STEP);
  zs.push(0);
  // The two creases are exact rows: the slope's toe at flatTo and its crest at riseTo. A grid that
  // interpolated across them would round the building's own horizon line by a metre.
  for (let i = 1; i * Z_STEP < NORTH_LAWN.riseTo; i++) zs.push(i * Z_STEP);
  zs.push(NORTH_LAWN.riseTo);
  for (let i = 1; NORTH_LAWN.riseTo + i * Z_STEP < Z_END; i++) zs.push(NORTH_LAWN.riseTo + i * Z_STEP);
  zs.push(Z_END);
  {
    const pos = [];
    const col = [];
    const uv = [];
    const idx = [];
    for (let j = 0; j < zs.length; j++) {
      for (let i = 0; i < xs.length; i++) {
        pos.push(xs[i], groundY(zs[j]), zs[j]);
        const c = lawnColour(xs[i], zs[j]);
        col.push(c[0], c[1], c[2]);
        // The speckle's own planar coordinate, in world metres over the texture's world pitch. RepeatWrapping
        // takes the integer part; the field is built to tile on both axes, so the wrap is invisible.
        uv.push(xs[i] * UV_PER_METRE, zs[j] * UV_PER_METRE);
      }
    }
    for (let j = 0; j < zs.length - 1; j++) {
      for (let i = 0; i < xs.length - 1; i++) {
        const a = j * xs.length + i;
        const b = a + 1;
        const c = a + xs.length;
        const d = c + 1;
        // Wound so the face normal is +y: the ground is seen from above from every camera the clamp allows.
        idx.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    // THE SPECKLE'S OWN COORDINATE IS uv1, AND IT IS THE ONLY REASON THE MESH HAS TWO UV SETS. three binds
    // `aoMap` to uv1 when the material has no `map` and the geometry carries the attribute, so the speckle
    // gets its own texture unit and its own coordinate while the vertex colours keep the albedo and the
    // mowing field untouched. Same planar (x, z) coordinate in world metres over the texture's world pitch;
    // RepeatWrapping takes the integer part, and the field is built to tile on both axes, so the wrap is
    // invisible. `uv` is also written because three falls back to it for any pass that still wants one.
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('uv1', new THREE.Float32BufferAttribute(uv.slice(), 2));
    geo.setIndex(idx);
    // EVERY VERTEX NORMAL IS +y, AND THAT IS THE SURFACE, NOT AN APPROXIMATION. `computeVertexNormals` was
    // here and every interior normal it produced was already (0, 1, 0) to within float error, because the
    // slab's own triangles are and the rise is linear; what it did NOT produce was exactness, and a normal a
    // few ULP off +y is a shading term that changes when nothing moved -- the one thing `npm run nudge`
    // measures. The mowing field is in the vertex colours and stays there; the normal is a constant.
    const nrm = new Float32Array(pos.length);
    for (let i = 1; i < nrm.length; i += 3) nrm[i] = 1;
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    // ---- THE MATERIAL'S COLOUR: PER CHANNEL, BECAUSE THE SCALAR WAS THE BUG ----------------------------
    // `lawnColour` puts the LAWN'S OWN ALBEDO times the mowing field into the vertex colours, so the colour
    // path is the one the flat lawn already had. What is built here is `albedoScaleOf(LAWN_BASE)` -- exactly
    // the scalar `makeMaterial({ mean: LAWN_BASE })` used to compute -- divided by the map's own measured
    // linear mean:
    //
    //     colour = albedoScaleOf(LAWN_BASE) / speckle.userData.mean
    //
    // Pass C instead wrote `albedoOf(LAWN_BASE) * albedoScaleOf(LAWN_BASE) * (1/mean) * LEVEL` with a single
    // fitted scalar LEVEL = 5.87, on the stated argument that "the scalar is uniform across the three
    // channels, so it changes the level and not the hue". THAT ARGUMENT IS FALSE and it cost the lawn its
    // colour. `albedoOf` and `albedoScaleOf` are PER-CHANNEL inverse tone-curve ratios -- measured,
    // `albedoOf(LAWN_BASE)*albedoScaleOf(LAWN_BASE)` gives a material colour whose ratio to the flat
    // material's own is 0.780, 1.153, 0.160 in R, G and B -- so any uniform scalar laid on top of them
    // lands the three channels in three different places on the tone curve, and blue is the one that moves
    // furthest. Measured on the near-lawn box (u 0.20-0.80, v 0.90-0.98), pass C's material rendered
    // `#56750d` (85.5, 117.2, 12.9) against the flat lawn's own `#6f762f` (110.6, 118.2, 46.7): the blue
    // channel lost 34 of its 47 levels, which is ~6.25x, and 85 % of the whole frame's cell-distance
    // regression sat on the 120 lawn cells with exactly this signature (a per-channel offset at a nearly
    // constant luma). Out of `out/wh/scratch/whhue.mjs`, and attributed by `whattr.mjs`/`whattrmap.mjs`.
    //
    // The `1/mean` alone is exact and is what makes the map a pure modulation; the texture's own residual is
    // the second factor below, and it is the only fitted-looking number in this file.
    //
    // The same texture in the ALBEDO slot instead, which is where this started, reads 28.77 on that box --
    // the albedo counted a second time, because three multiplies the material's colour by the map as well as
    // by the vertex colours. That number is why the speckle is in the `aoMap` slot, whose `aomap_fragment`
    // multiplication is the only one that leaves the albedo path alone.
    //
    // DoubleSide because the camera clamp's floor is the wall's own grade, not the lawn's, so a user flying
    // north at 1 m can put the eye under the rise; a one-sided surface there is a hole to the sky.
    const scale = albedoScaleOf(LAWN_BASE);
    const compensation = speckle.userData.factor;
    // ---- THE RESIDUAL CORRECTION, IN TWO MEASURED PARTS ------------------------------------------------
    // PART 1, the texture's own variance: a modulation with variance does not display the same tone as a
    // constant at the same mean, because the rig's tone curve is not linear -- the mean of T(m) over a
    // distribution of m is not T(mean m). Measured on the near-lawn box, textured against the SAME material
    // with the map flattened to its own mean (same albedo, same slot, same uv1, same compensation, same mip
    // chain, only the variance differing): rgb(102.88, 116.19, 53.09) against rgb(109.73, 123.02, 54.74),
    // i.e. the variance alone costs 6.2 luma and pulls red and blue about 6.5 % and 3 % further than green.
    // The ratio between those two states, per channel, is 1.06653 / 1.05874 / 1.03092 -- re-measurable in one
    // page load by `node out/wh/scratch/whcorr.mjs <mean> <sd>`, with both states named.
    //
    // PART 2, the lawn's chroma against the PHOTOGRAPH, which is not the same question and is measured
    // separately. With part 1 alone the near-lawn box reads rgb(107.1, 120.2, 40.3) against the photograph's
    // own lawn cells at rgb(98.2, 120.7, 43.1) and against `COLORS.lawnNear` 0x647b2c = (100, 123, 44): the
    // texture had removed pass C's blue loss, but the render's own lawn colour still carried red 7 to 9 levels
    // high and blue a few high, which is what makes the crop read yellow-olive beside the photograph's green.
    // Cutting red to 0.91 and blue to 0.60 of part 1 lands the box at rgb(100.6, 119.3, 40.3), within 2.4 of
    // the photograph in every channel, and it is what moved the scored cell distance 0.0992 -> 0.0975.
    //
    // BOTH PARTS ARE MEASURED, and the two chroma factors are the only place in this file where a number was
    // found by moving it and watching the score. The blue factor has an optimum: 0.60 scores 0.0975, 0.30
    // scores 0.1029, and 0.85 scores 0.0995, so it is a real minimum and not the edge of a cliff. They are
    // recorded here as tuning, not as derivation, and they belong to this scene's rig and its photograph:
    // re-measure both parts if the map's mean, its sd, or the rig's tone curve changes.
    const VARIANCE_FIX = [1.06653 * 0.91, 1.05874, 1.03092 * 0.60];
    const lawn = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      aoMap: speckle,
      color: new THREE.Color().setRGB(
        scale.r * compensation * VARIANCE_FIX[0],
        scale.g * compensation * VARIANCE_FIX[1],
        scale.b * compensation * VARIANCE_FIX[2],
        THREE.LinearSRGBColorSpace,
      ),
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.9,
      metalness: 0,
    }));
    lawn.receiveShadow = true;
    b.add(lawn, 'north lawn');
  }
  // The far ground beyond the drive and the fence, so the horizon has something under it from any angle.
  // ITS TOP IS THE LAWN'S OWN HEIGHT AND ITS COLOUR IS THE LAWN'S OWN COLOUR: at rise - 0.1 and in
  // COLORS.lawnFar it was 0.1 m and 22 luma below the lifted lawn beside it, which is a hard straight edge
  // across the north horizon from any camera behind the fence.
  //
  // ITS DEPTH IS THE GATE'S OWN NORTH EDGE PLUS A MARGIN. It was 216 m, ending at z +307.9, and
  // `groundcover`'s box ends at z +900: every cell past +307.9 reached the sky. 850 m puts the edge at
  // +941.9, two of the gate's 20 m cells past its own edge. Nothing behind the camera can move the scored
  // frame, and it does not: measured, `out/wh/render.png` is byte-identical (sha256 f1d1475a...) across
  // this widening and the TERRAIN_HALF one above it.
  b.box('far ground', { x0: -TERRAIN_HALF, x1: TERRAIN_HALF, y0: -0.9, y1: rise, z0: Z_END, z1: Z_END + 850 }, LAWN_BASE, { metric: true });
  // The south lawn, three metres lower than the north: the reason the south facade shows a third storey.
  // IT IS BEHIND THE BUILDING AND NOWHERE ELSE: it runs from the south portico's own bow outward, at z < -40,
  // so it can never be the camera's foreground. It used to run to z +300 and cover the whole photo view.
  //
  // ITS FAR EDGE WAS THE ONE RIM THAT COULD NOT BE MENDED WITHOUT MOVING THE SCORED FRAME, AND THIS PASS
  // PAID THAT PRICE ON MEASUREMENT RATHER THAN ASSUMING IT. The slab used to stop at z -340.6, and that
  // line is where the frame's own horizon was drawn -- which is why the band of sky BELOW the frame's true
  // horizon at its left and right edges was this same defect seen from the photo view, and why it is
  // measurable. Extending the slab to -940.6 changes 2,185 pixels of the 1,080,000 in the 1200x900 frame,
  // in rows 460 to 516: two bands either side of the building, columns 54-154 (1,630 px) and 1045-1083
  // (508 px), plus about ten stray pixels in six isolated columns up to 1109, with a maximum channel delta
  // of 93 -- sky below the horizon before, fogged ground after. The frame's sha256 goes f1d1475a -> ea77c0d6
  // and the numbers move with it: cell distance 0.09492570 -> 0.09490477, SSIM 0.42069753 -> 0.42077211,
  // detail 0.891 -> 0.892, edge energy 0.854 -> 0.856, luma p5 1.00 -> 1.00 and pixels below luma 16
  // 7.25% -> 7.25%. Cell distance and SSIM both improve, which is what the coordinator's condition for
  // allowing the frame to move asked for (cell <= 0.0951, SSIM >= 0.4207, detail >= 0.887, edge >= 0.851,
  // p5 <= 1.01, below-16 <= 7.30%), and 900 m is the gate's own south edge plus two of its cells. The
  // extension is 100% fogged where it ends, so what the frame gains is ground-coloured haze where it used
  // to show the sky dome through the gap.
  b.box('south lawn', { x0: -TERRAIN_HALF, x1: TERRAIN_HALF, y0: -0.8 - DIMS.southLawnDrop, y1: -DIMS.southLawnDrop, z0: SOUTH_LAWN_EDGE - 900, z1: SOUTH_LAWN_EDGE }, LAWN_BASE, { metric: true });

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
