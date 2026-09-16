// Paving: instanced cut-stone slabs on every walking surface. Treads and risers on the main stairs,
// the drainage strip along the left edge, the landing and the street on the height field, the
// right-side stair, and the raised top landing with a coping edge. A darker mortar body sits under
// each surface so the joints between slabs read as joints.
import * as THREE from 'three';
import * as L from './layout.js';
import { mulberry32, jitter } from './random.js';
import { instanced, surface, slabGeometry } from './instancing.js';
import { material } from './primitives.js';

const C = L.COLORS;
const S = L.STREET;
const JOINT = 0.02;

// The color a slab must average to so that slabs plus a `fraction` of joints at `jointHex` average
// to `mean` (the photo-sampled mean of the whole surface).
export function balancedMean(mean, otherHex, fraction) {
  const ch = (shift) => {
    const m = (mean >> shift) & 255;
    const o = (otherHex >> shift) & 255;
    return Math.max(0, Math.min(255, Math.round((m - fraction * o) / (1 - fraction))));
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

export function darker(hex, k) {
  const ch = (shift) => Math.round(((hex >> shift) & 255) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

// The mortar under a paved surface: the surface's mean darkened by a factor set by eye.
export function mortarOf(mean) {
  return darker(mean, 0.82);
}

// Two sRGB hexes blended per channel, t = 0 giving `a` and t = 1 giving `b`.
export function mixHex(a, b, t) {
  const ch = (shift) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

// The sRGB hex that, used as an InstancedMesh per-instance color, makes an instance of a material whose
// map averages to `base` display as `target` instead. three reads the per-instance color as sRGB and
// multiplies the material's diffuse by it in linear space, so this is the linear ratio re-encoded to
// sRGB. It can only darken: a target above the base clamps to no change, so `base` must be the lightest
// colour the set carries.
export function scaleHex(target, base) {
  const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
  const ch = (shift) => {
    const b = toLinear(((base >> shift) & 255) / 255);
    const ratio = b > 1e-6 ? Math.min(1, toLinear(((target >> shift) & 255) / 255) / b) : 1;
    return Math.round(toSrgb(ratio) * 255);
  };
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

export function buildPaving(b) {
  const rand = mulberry32(2024);
  const slab = slabGeometry(0.08, 0.015);
  const riserGeo = new THREE.BoxGeometry(1, 1, 1);

  // Slab items for a rectangular area on a plane: columns across `axisAcross`, rows along the other
  // axis; every other row staggered by half a slab. `place(cx, cz)` returns { y, euler } for a centre.
  function gridSlabs(items, { x0, x1, z0, z1, colWidth, rowDepth, place, tintAmount = 0.05 }) {
    const width = x1 - x0;
    const cols = Math.max(1, Math.round(width / colWidth));
    const w = width / cols;
    const rows = Math.max(1, Math.round((z1 - z0) / rowDepth));
    const d = (z1 - z0) / rows;
    for (let r = 0; r < rows; r++) {
      const cz = z0 + (r + 0.5) * d;
      const stagger = r % 2 ? w / 2 : 0;
      for (let c = -1; c <= cols; c++) {
        let sx0 = x0 + c * w + stagger;
        let sx1 = sx0 + w;
        if (sx1 <= x0 || sx0 >= x1) continue;
        sx0 = Math.max(sx0, x0);
        sx1 = Math.min(sx1, x1);
        if (sx1 - sx0 < JOINT + 0.06) continue; // no slivers from float rounding at the last column
        const cx = (sx0 + sx1) / 2;
        const { y, euler } = place(cx, cz);
        items.push({
          position: [cx, y, cz],
          euler,
          scale: [sx1 - sx0 - JOINT, 1, d - JOINT],
          tint: 1 + jitter(rand, tintAmount),
          uv: [rand() * 4, rand() * 4],
        });
      }
    }
  }

  // ---- main stairs: treads and risers ------------------------------------------------------------
  const stepCount = Math.round(-S.stairsEndZ / L.STEP_TREAD);
  const tread = L.STEP_TREAD;
  const xa = S.x0 + 0.4; // the gutter takes the first 0.4 m on the left
  const xb = S.x1;
  const treads = [];
  const risers = [];
  const treadCols = 4;
  const treadW = (xb - xa) / treadCols;
  for (let i = 0; i < stepCount; i++) {
    const y = -(i + 1) * S.stepRise;
    const zFar = -(i + 1) * tread;
    const zNear = -i * tread;
    const stagger = i % 2 ? treadW / 2 : 0;
    for (let c = -1; c <= treadCols; c++) {
      let sx0 = xa + c * treadW + stagger;
      let sx1 = sx0 + treadW;
      if (sx1 <= xa || sx0 >= xb) continue;
      sx0 = Math.max(sx0, xa);
      sx1 = Math.min(sx1, xb);
      if (sx1 - sx0 < JOINT + 0.06) continue;
      treads.push({
        position: [(sx0 + sx1) / 2, y, (zFar - JOINT + zNear) / 2],
        scale: [sx1 - sx0 - JOINT, 1, tread],
        tint: 1 + jitter(rand, 0.05),
        uv: [rand() * 4, rand() * 4],
      });
    }
    // The riser below this tread stands at zFar, from this tread's level down to the next, 1 cm behind
    // the tread's nosing and 3 cm proud of the mortar body.
    risers.push({
      position: [(xa + xb) / 2, y - S.stepRise / 2, zFar + 0.03],
      scale: [xb - xa, S.stepRise - 0.01, 0.06],
      tint: 1 + jitter(rand, 0.04),
      uv: [rand() * 4, 0],
    });
  }
  const treadMean = balancedMean(C.steps, mortarOf(C.steps), 0.065);
  b.add(instanced('stair treads', slab, surface('stone', treadMean, { seed: 11, instancedUv: true }), treads), 'stair treads');
  b.add(instanced('stair risers', riserGeo, surface('stone', mortarOf(C.steps) + 0x0a0a0a, { seed: 12, instancedUv: true }), risers), 'stair risers');
  // Mortar body under the stairs: the stepped profile 3 cm below the tread tops and 3 cm behind the
  // riser faces, so joints show mortar and the risers stand proud of it.
  const profile = [[-0.03, -0.03]];
  for (let i = 0; i < stepCount; i++) {
    const s0 = i * tread;
    const s1 = (i + 1) * tread;
    const y = -(i + 1) * S.stepRise;
    profile.push([s0 - 0.03, y - 0.03], [s1 - 0.03, y - 0.03]);
  }
  const sEnd = stepCount * tread - 0.03;
  profile.push([sEnd, -stepCount * S.stepRise - 8], [-0.03, -8]);
  b.profileSolid('stairs', profile, xa, xb, mortarOf(C.steps));

  // ---- drainage strip along the left edge ---------------------------------------------------------
  // A stone channel stepping down with the stairs: a sunken floor slab per step and a raised curb
  // stone against the wall.
  const gutterFloor = [];
  const curbs = [];
  for (let i = 0; i < stepCount; i++) {
    const y = -(i + 1) * S.stepRise;
    const zFar = -(i + 1) * tread;
    const zNear = -i * tread;
    gutterFloor.push({
      position: [(S.x0 + 0.08 + xa) / 2, y - 0.06, (zFar + zNear) / 2],
      scale: [xa - S.x0 - 0.08 - JOINT, 1, tread - JOINT],
      tint: 1 + jitter(rand, 0.05),
      uv: [rand() * 4, rand() * 4],
    });
    curbs.push({
      position: [S.x0 + 0.05, y - 0.04, (zFar + zNear) / 2],
      scale: [0.1, 0.1, tread - JOINT],
      tint: 1 + jitter(rand, 0.05),
      uv: [rand() * 4, 0],
    });
  }
  b.add(instanced('gutter floor', slab, surface('stone', C.gutter, { seed: 13, instancedUv: true }), gutterFloor), 'gutter floor');
  b.add(instanced('gutter curb', riserGeo, surface('stone', C.gutter, { seed: 14, instancedUv: true }), curbs), 'gutter curb');
  // The channel's mortar body steps with its floor slabs, 3 cm below their tops.
  const gutterProfile = [[-0.03, -0.09]];
  for (let i = 0; i < stepCount; i++) {
    const y = -(i + 1) * S.stepRise - 0.06;
    gutterProfile.push([i * tread - 0.03, y - 0.03], [(i + 1) * tread - 0.03, y - 0.03]);
  }
  gutterProfile.push([stepCount * tread - 0.03, -stepCount * S.stepRise - 8], [-0.03, -8]);
  b.profileSolid('gutter', gutterProfile, S.x0, xa, mortarOf(C.gutter));

  // ---- landing, lower street and the far street on the height field ------------------------------
  const slopeAt = (z) => (L.streetY(z + 0.05) - L.streetY(z - 0.05)) / 0.1;
  const onStreet = (cx, cz) => ({ y: L.streetY(cz) + 0.005, euler: [-Math.atan(slopeAt(cz)), 0, 0] });
  // The landing's shading runs ACROSS the street, not along it. The photo has lit stone in the middle
  // (#b1b2ba over (0.35,0.80)-(0.43,0.855)), a bluer band where it meets the machiya row (#5a6d7e over
  // (0.39,0.73)-(0.425,0.775)) and a warm dark band in the left retaining wall's own shadow (#5e4535 over
  // (0.29,0.775)-(0.33,0.82), #716359 over (0.30,0.825)-(0.34,0.87)). Neither band is a tint of the lit
  // stone, so each slab carries its own colour and the set's material holds the lightest of the three.
  // A hard split into two sets of slabs was tried first and read as a ragged sawtooth tear across the
  // paving at u 0.33-0.45: at 0.9 m to a slab a boundary is a staircase, and only a ramp is a gradient.
  // Both ramps are measured off the photo. At v 0.795 it runs from #b1b1b7 at x = -3.07 to #6b7a8b at
  // x = -1.29, which is the row's own front line, so the blue band is 1.8 m wide; and from #684f40 at
  // x = -3.93 to that same #b1b1b7, with the landing's left edge at x = -4.25, so the wall's shadow is
  // 0.9 m wide. A first pass at 2.6 m and 1.1 m carried the blue over cells the photo has as lit stone
  // and cost 0.14 at (0.354, 0.750) alone.
  const ROW_RAMP = 1.8; // metres out from the row's front line over which the blue band fades
  const LEFT_RAMP = 0.9; // metres in from the landing's left edge over which the wall's shadow fades
  const landingColor = (cx, cz) => {
    const toRow = Math.min(1, Math.max(0, (L.farRowFrontX(cz) - cx) / ROW_RAMP));
    const fromLeft = Math.min(1, Math.max(0, (cx - (L.streetCenterX(cz) - 3.5)) / LEFT_RAMP));
    return scaleHex(mixHex(C.landingLeft, mixHex(C.landingShade, C.landingSlab, toRow), fromLeft), C.landingSlab);
  };
  const landing = [];
  gridSlabsAlongStreet(landing, S.stairsEndZ, -22, 7.0, onStreet, 0.9, 0.6, () => true, () => 1, landingColor);
  // Beyond the bend the street's left third stays in the light (photo u 0.33-0.38 at v 0.68-0.73) while its
  // middle is in shadow, and it ends at the corner house's own front face.
  //
  // FAR_STREET_END was -42 until iteration 4, and the corner house and the bend's block-out stand from
  // z = -34.5 back, so 7.5 m of paved road ran THROUGH three buildings. `npm run clearance` prints that
  // every run as the scene's own open defect, exempting up to 40 rows past z = -33.5; on the base tree it
  // was reporting 34 rows of which 27 leave under 0.60 m of clear run. Ending the paving where the street
  // is actually closed off is the fix for the paving's half of it: the road now stops at a building, which
  // is what the photo shows, and `bend()` widens the corner house so it covers the band's whole width.
  // What this does NOT do is retire the exemption itself, which lives in tools/ and is the integration
  // owner's to move.
  const farStreet = [];
  const farStreetLit = [];
  gridSlabsAlongStreet(farStreet, -22, L.FAR_STREET_END, 5.2, onStreet, 0.9, 0.6, (cx, cz) => cx > L.streetCenterX(cz) - 1.2);
  gridSlabsAlongStreet(farStreetLit, -22, L.FAR_STREET_END, 5.2, onStreet, 0.9, 0.6, (cx, cz) => cx <= L.streetCenterX(cz) - 1.2);
  const landingMean = balancedMean(C.landingSlab, mortarOf(C.landingSlab), 0.05);
  const farLitMean = balancedMean(C.landing, mortarOf(C.landing), 0.05);
  const farMean = balancedMean(C.farStreet, mortarOf(C.farStreet), 0.05);
  b.add(instanced('landing slabs', slab, surface('stone', landingMean, { seed: 15, instancedUv: true }), landing), 'landing slabs');
  b.add(instanced('far street slabs', slab, surface('stone', farMean, { seed: 16, instancedUv: true }), farStreet), 'far street slabs');
  b.add(instanced('far street lit slabs', slab, surface('stone', farLitMean, { seed: 21, instancedUv: true }), farStreetLit), 'far street lit slabs');
  ribbon(b, 'landing', S.stairsEndZ, -22, 7.0, mortarOf(C.landingSlab));
  ribbon(b, 'far street', -22, L.FAR_STREET_END, 5.2, mortarOf(C.farStreet));

  function gridSlabsAlongStreet(items, zNear, zFar, width, place, colWidth, rowDepth, keep = () => true, shadeOf = null, colorOf = null) {
    // Rows follow the street's centre line, which shifts left through the bend.
    const rows = Math.max(1, Math.round((zNear - zFar) / rowDepth));
    const d = (zNear - zFar) / rows;
    const cols = Math.max(1, Math.round(width / colWidth));
    const w = width / cols;
    for (let r = 0; r < rows; r++) {
      const cz = zNear - (r + 0.5) * d;
      const cx0 = L.streetCenterX(cz) - width / 2;
      const stagger = r % 2 ? w / 2 : 0;
      for (let c = -1; c <= cols; c++) {
        let sx0 = cx0 + c * w + stagger;
        let sx1 = sx0 + w;
        if (sx1 <= cx0 || sx0 >= cx0 + width) continue;
        sx0 = Math.max(sx0, cx0);
        sx1 = Math.min(sx1, cx0 + width);
        if (sx1 - sx0 < JOINT + 0.06) continue;
        const cx = (sx0 + sx1) / 2;
        if (!keep(cx, cz)) continue;
        const { y, euler } = place(cx, cz);
        // The far street darkens toward the bend (cells at v 0.75 read #323840 against #4a4950 at v 0.70).
        // The landing passes its own `shadeOf` and a `colorOf`: since iteration 2 its shading runs across
        // the street rather than along it, and it is carried per slab rather than by a scalar tint.
        const shade = shadeOf ? shadeOf(cx, cz) : 1 - 0.32 * Math.min(1, Math.max(0, (-cz - 14.5) / 7));
        const item = { position: [cx, y, cz], euler, scale: [sx1 - sx0 - JOINT, 1, d - JOINT], tint: shade + jitter(rand, 0.05), uv: [rand() * 4, rand() * 4] };
        if (colorOf) item.color = colorOf(cx, cz);
        items.push(item);
      }
    }
  }

  // ---- right-side stair: eight real steps up from the main stairs to the fence line ----------------
  const Z = L.RIGHT_STEPS_Z;
  // Eight steps from the flight's foot up to the planter strip's top, in front of the fence's jog.
  const sideSteps = 8;
  const sideRise = (L.rightBedY((Z.z0 + Z.z1) / 2) + 1.65) / sideSteps;
  const sideTread = 1.8 / sideSteps;
  const sideTreads = [];
  const sideRisers = [];
  const zCols = 3;
  const zw = (Z.z1 - Z.z0) / zCols;
  for (let i = 0; i < sideSteps; i++) {
    const x0 = 1.0 + i * sideTread;
    const y = -1.65 + (i + 1) * sideRise;
    for (let c = 0; c < zCols; c++) {
      const zc = Z.z0 + (c + 0.5) * zw;
      // The photo's flight is light and blue-grey at its head and warm and dark at its foot, which is the
      // opposite of the tint ramp this used to carry (1.0 at the lowest step down to 0.62 at the highest).
      // Three stops, per slab rather than as a scalar tint, because the middle is warm and neither end is.
      // See `sideStepTop` in src/layout.js. The draws are unchanged, so no slab after this is renumbered.
      const t = i / (sideSteps - 1);
      const target = t < 0.5 ? mixHex(C.sideStepFoot, C.sideStepMid, t * 2) : mixHex(C.sideStepMid, C.sideStepTop, (t - 0.5) * 2);
      sideTreads.push({ position: [x0 + sideTread / 2 + JOINT / 2, y, zc], scale: [sideTread + JOINT, 1, zw - JOINT], tint: 1 + jitter(rand, 0.04), color: scaleHex(target, C.sideStepTop), uv: [rand() * 4, rand() * 4] });
    }
    // The riser 1 cm behind the tread's nosing and 2 cm proud of the body below.
    sideRisers.push({ position: [x0 + 0.035, y - sideRise / 2, (Z.z0 + Z.z1) / 2], scale: [0.05, sideRise - 0.01, Z.z1 - Z.z0], tint: 1 + jitter(rand, 0.04), uv: [rand() * 4, 0] });
  }
  b.add(instanced('side stair treads', slab, surface('stone', C.sideStepTop, { seed: 17, instancedUv: true }), sideTreads), 'side stair treads');
  b.add(instanced('side stair risers', riserGeo, surface('stone', C.sideSteps, { seed: 18, instancedUv: true }), sideRisers), 'side stair risers');
  // Body under the flight: one stepped solid whose faces sit 3 cm behind the tread nosings, running
  // into the stairs' mortar below and up to the fence's stone core behind the top tread.
  const body = new THREE.Shape();
  body.moveTo(1.03, -4.0);
  for (let i = 0; i < sideSteps; i++) {
    const x0 = 1.03 + i * sideTread;
    const y = -1.65 + (i + 1) * sideRise - 0.02;
    body.lineTo(x0, y);
    body.lineTo(x0 + sideTread, y);
  }
  body.lineTo(L.RIGHT_FENCE.path[2][0] - L.RIGHT_FENCE.thickness / 2 + 0.06, -4.0);
  const bodyMesh = new THREE.Mesh(new THREE.ExtrudeGeometry(body, { depth: Z.z1 - Z.z0, bevelEnabled: false }), surface('rubble', mortarOf(C.sideSteps), { seed: 22 }));
  bodyMesh.position.z = Z.z0;
  b.add(bodyMesh, 'side stair body');

  // ---- raised top landing: paved, with a coping edge at the head of the stairs --------------------
  const platformTop = [];
  gridSlabs(platformTop, {
    x0: S.x0,
    x1: S.x1,
    z0: 0.15,
    z1: 8,
    colWidth: 0.9,
    rowDepth: 0.6,
    place: () => ({ y: L.PLATFORM_Y, euler: [0, 0, 0] }),
  });
  const coping = [];
  const copingCols = 5;
  const cw = (S.x1 - S.x0) / copingCols;
  for (let c = 0; c < copingCols; c++) {
    coping.push({ position: [S.x0 + (c + 0.5) * cw, L.PLATFORM_Y + 0.02, 0.08], scale: [cw - JOINT, 1, 0.34], tint: 1 + jitter(rand, 0.04), uv: [rand() * 4, rand() * 4] });
  }
  b.add(instanced('platform slabs', slab, surface('stone', C.platform, { seed: 19, instancedUv: true }), platformTop), 'platform slabs');
  b.add(instanced('platform coping', slab, surface('stone', C.platform, { seed: 20, instancedUv: true }), coping), 'platform coping');
  // The mortar body under the top landing. Its near face is held 6 cm behind z = 0, where walls.js lays
  // the ashlar of `platform front wall`: at z0 = 0 the two were coplanar and this flat slab won the depth
  // test over every stone, which is the bare grey wall `npm run views` pose 5 shows across the head of
  // the stairs. Nothing here is in the photo view, which is why no score ever moved for it.
  b.box('platform', { x0: S.x0, x1: S.x1, y0: L.PLATFORM_Y - 5, y1: L.PLATFORM_Y - 0.01, z0: 0.06, z1: 8 }, mortarOf(C.platform));

  rightWalkway(b);
}

// ---- the right walkway: flagstones on the terrace in front of the machiya -------------------------
// `src/architecture.js` still lays the band this stands on; that band is now the mortar body under these
// slabs. The photo has a field of cut flagstones with joints running from the fence's foot to the
// machiya's plinth, and the render had one flat plane: see `walkwayLit` in src/layout.js for the measured
// ramp and for why a flat plane at the right mean still cost 0.0969 a cell.
//
// The slabs stop at x = 4.94, the machiya plinth's own front face, because nothing past it is ever seen:
// the band runs on to x = 9.0 under the house and stays the mortar body there.
//
// Its PRNG is its own and it is built last, so adding it renumbers no slab, stone or tile before it --
// `stackedStones`, `tileRoof` and the slab builders all draw from a module-level stream, and iteration 2
// measured a bare reseed of two walls at 0.0004 of cell distance and 0.0054 of SSIM.
function rightWalkway(b) {
  const T = L.RIGHT_TERRACE;
  const rand = mulberry32(3117);
  // Thin, and with a narrower joint than the rest of the paving: these are flagstones bedded flush, and
  // at 35 degrees a slab's own front edge is the widest dark thing in the cell. See `walkwayLit`.
  const slab = slabGeometry(0.03, 0.008);
  const joint = 0.015;
  const x0 = T.xInner + 0.05;
  const x1 = L.RIGHT_MACHIYA.front - 0.06;
  const zNear = 0.2;
  const zFar = -15.3;
  const colWidth = 0.95;
  const rowDepth = 0.62;
  const slopeAt = (z) => (L.rightTerraceY(z + 0.05) - L.rightTerraceY(z - 0.05)) / 0.1;
  const clamp01 = (t) => Math.min(1, Math.max(0, t));
  // Along z, not across x: the ramp is the photo's, and the photo's spread within a row is the kerb and
  // the bed, which are 0.35 m of x per cell and cannot be a colour on this mesh. The one exception is the
  // near inner corner, which is two cells wide and 40 levels darker than the row it is in.
  //
  // `near` is a BAND with a sharp far edge and a softer near one, and the two are set by different things.
  // The FAR edge sits at the joint between the row centred at z = -4.45 and the one at -5.07, which is the
  // edge of what the photo sees rather than a line the photo located: the frame's bottom edge reaches only
  // z = -4.665 here, inside the first of those rows, so every row from -5.07 back is lit and the cells say
  // nothing about the rows in front of them. 0.45 m is narrower than the 0.62 m row pitch on purpose --
  // those two rows carry cells that want opposite colours (see `walkwayLit`) and a wider ramp puts an
  // intermediate value on one of them; three positions of it were measured and are in the devlog.
  // The NEAR edge exists only to stop the far one being a half-plane: the first version had none, and
  // painted 4.96 m of the walkway, 32% of it, in one step at a slab joint, which no scored gate can see
  // and `npm run views` pose 4 can. It is a staircase and not a gradient -- its 1.0 m falls on a single
  // row centre, so the band goes 0, 0.53, 1.0 over the rows at z = -3.21, -3.83 and -4.45 -- and it is
  // now 1.24 m of walkway rather than 2.48 or 4.96. Only the last of those three rows is in the photo
  // frame at all, and only its far 0.095 m, so widening or narrowing this edge moves no scored cell:
  // measured, the cells are identical either side of it.
  //
  // There is no corner term. One was written for cells (0.813, 0.977) and (0.854, 0.977), where the photo
  // is #14191d and #181e22 against #35424d one cell to their right, and it never reached them: `near` is
  // zero on the row those cells are filled by, so the term fired only on rows in front of the frame. It
  // painted a black wedge into the sweep for no scored gain and it is gone. What those two cells actually
  // are is `L.RIGHT_STEP`: the terrace steps down 0.40 m at z = -5.05 and the bottom cell row is the
  // riser's own face. Read that comment in src/layout.js before touching `near` again.
  const walkColor = (cz) => {
    const near = Math.min(clamp01((cz + 5.05) / 0.45), clamp01((-cz - 3.3) / 1.0));
    const far = clamp01((-cz - 6.0) / 1.1);
    return scaleHex(mixHex(mixHex(C.walkwayLit, C.walkwayNear, near), C.walkwayFar, far), C.walkwayLit);
  };
  const items = [];
  const cols = Math.max(1, Math.round((x1 - x0) / colWidth));
  const w = (x1 - x0) / cols;
  const rows = Math.max(1, Math.round((zNear - zFar) / rowDepth));
  const d = (zNear - zFar) / rows;
  for (let r = 0; r < rows; r++) {
    const cz = zNear - (r + 0.5) * d;
    // The terrace falls 2.3 m between z = -14.8 and -15.3, and a row centred in that drop is laid at 78
    // degrees with a 0.27 m hole in front of it. Rows are skipped rather than `zFar` moved, so every other
    // row keeps its exact z and the ramp above stays aligned to them.
    if (Math.abs(slopeAt(cz)) > 1.0) continue;
    // The near row is clipped to the band under it, which starts at z = 0: unclipped it overhangs by
    // 0.19 m into nothing. It is behind the photo camera, so no score has ever moved for it.
    const zA = Math.min(0, cz + d / 2);
    const zB = cz - d / 2;
    if (zA - zB < 0.1) continue;
    const stagger = r % 2 ? w / 2 : 0;
    // The row that STRADDLES the step is cut at it, into a piece on each level. Without this cut the row
    // takes whichever level its centre is on and the step lands at a row boundary instead: the row centred
    // at z = -5.07 spans -4.76 to -5.38, so a step at -5.05 sat behind that row's own slab and the riser
    // was never seen at all (measured: the probe at (0.813, 0.977) returned the same #57667a it did before
    // the step existed, on a slab at y = 0.45).
    const R = L.RIGHT_STEP;
    const inBand = zA > R.zOuter && zB < R.z; // only this row meets the step, and only it is cut at xSplit
    for (let c = -1; c <= cols; c++) {
      let sx0 = x0 + c * w + stagger;
      let sx1 = sx0 + w;
      if (sx1 <= x0 || sx0 >= x1) continue;
      sx0 = Math.max(sx0, x0);
      sx1 = Math.min(sx1, x1);
      if (sx1 - sx0 < joint + 0.06) continue;
      for (const [px0, px1] of inBand && sx0 < R.xSplit && sx1 > R.xSplit ? [[sx0, R.xSplit], [R.xSplit, sx1]] : [[sx0, sx1]]) {
        if (px1 - px0 < joint + 0.06) continue;
        const cx = (px0 + px1) / 2;
        const stepZ = L.rightStepZ(cx);
        for (const [sA, sB] of zA > stepZ && zB < stepZ ? [[zA, stepZ], [stepZ, zB]] : [[zA, zB]]) {
          if (sA - sB < 0.06) continue;
          const rowZ = (sA + sB) / 2;
          items.push({
            position: [cx, L.rightWalkY(rowZ, cx) + 0.005, rowZ],
            euler: [-Math.atan(slopeAt(rowZ)), 0, 0],
            scale: [px1 - px0 - joint, 1, sA - sB - joint],
            tint: 1 + jitter(rand, 0.05),
            color: walkColor(rowZ),
            uv: [rand() * 4, rand() * 4],
          });
        }
      }
    }
  }
  // The step's riser and the wall's coping, both after the loop above and drawing from the same stream,
  // so no slab laid above is renumbered by either of them. They are instances of this same set because
  // they are the same cut stone on the same terrace and a second InstancedMesh is a second draw call; the
  // brief for this iteration is cost-neutral, so the census attributes their cells to `right walkway
  // slabs` and this comment is where that is written down.
  stepRiser(items, rand, slab, x0, x1);
  wallCoping(items, rand);
  const mean = balancedMean(C.walkwayLit, mortarOf(C.walkwayLit), 0.05);
  b.add(instanced('right walkway slabs', slab, surface('stone', mean, { seed: 23, instancedUv: true }), items), 'right walkway slabs');
}

// The riser of `L.RIGHT_STEP`, standing across the walkway at its z and facing the camera, in two runs
// with a short return face where the step jogs at `xSplit`. A slab lies flat with its top face at y = 0,
// so an euler of +PI/2 about x turns that face to +z and the body behind it: local x stays width, local y
// becomes thickness along -z, local z becomes height downward. The return face is the same slab turned
// about Z instead, so its face looks back along -x at the camera; see the comment on it below.
//
// `yScale` is why this takes the geometry: local y is NOT metres here. `slabGeometry(0.03, 0.008)` spans
// 0.038 m in y (0.022 of extrusion plus a 0.008 bevel each side), so the scale component MULTIPLIES that
// span -- every other slab in this file passes 1 for it, and passing 0.12 here, as the first version did,
// gave a body **0.0046 m** deep. The other risers in this file use `riserGeo`, a unit box, where the
// component IS metres; this set has to share the slab geometry to stay on one draw call. A critic
// measured the 0.0046 and the `right walkway` band standing 0.076 m proud of the lower flagstones through
// it.
const RIGHT_STEP_DEPTH = 0.12;
function stepRiser(items, rand, slab, x0, x1) {
  const R = L.RIGHT_STEP;
  const face = scaleHex(C.walkwayStep, C.walkwayLit);
  slab.computeBoundingBox();
  const yScale = RIGHT_STEP_DEPTH / (slab.boundingBox.max.y - slab.boundingBox.min.y);
  for (const [ra, rb] of [[x0, R.xSplit], [R.xSplit, x1]]) {
    const z = L.rightStepZ((ra + rb) / 2);
    const top = L.rightTerraceY(z);
    const cols = Math.max(1, Math.round((rb - ra) / 0.95));
    const w = (rb - ra) / cols;
    for (let c = 0; c < cols; c++) {
      items.push({
        position: [ra + (c + 0.5) * w, top - R.drop / 2, z],
        euler: [Math.PI / 2, 0, 0],
        scale: [w - 0.015, yScale, R.drop],
        tint: 1 + jitter(rand, 0.04),
        color: face,
        uv: [rand() * 4, rand() * 4],
      });
    }
  }
  // The return between the two runs: 0.27 m of z at x = xSplit, closing the side of the deeper inner step.
  // An euler of +PI/2 about z turns the slab's top face to -x (local x becomes world y, local z stays z),
  // so this one is scaled [height, thickness, length].
  items.push({
    position: [R.xSplit, L.rightTerraceY(R.z) - R.drop / 2, (R.z + R.zOuter) / 2],
    euler: [0, 0, Math.PI / 2],
    scale: [R.drop, yScale, Math.abs(R.z - R.zOuter)],
    tint: 1 + jitter(rand, 0.04),
    color: face,
    uv: [rand() * 4, rand() * 4],
  });
}

// The coping along the top of the right retaining wall: a kerb stone every 0.9 m over the strip between
// the wall's face and the walkway's inner edge, from the step back to the terrace's steep end. It stops
// at the step because in front of it the photo is as dark as the riser (#272d31 at (0.771, 0.977)) and
// the band's own mortar body already reads #3a424c there; a light kerb carried across the step would be
// the one thing on this terrace that does not step. The three cells it is FOR land at x 1.89, 1.95 and
// 2.09 on the terrace plane, not across the whole 1.35-to-2.15 strip, which is what an earlier draft of
// this comment said.
//
// It is 0.33 m wide and NOT the whole 0.80 m strip, and the photo is what sets that. Dropping each cell
// that lands on this strip onto the terrace plane and sorting by the x it lands at gives one clean ramp:
// x 1.13 #364146, 1.24 #4c5354, 1.28 #4b4843, 1.35 #303c44, 1.45 #354145, 1.47 #474d4e, 1.60 #566469,
// 1.76 #464f52, 1.79 #3f4345 — all dark — and then x 1.89 #66747a, 1.95 #637075, 2.09 #6d7986, 2.30
// #768186, 2.31 #798288 — all light. The ramp turns between 1.79 and 1.89, so the light stone starts at
// 1.82 and not at 1.78, which is where the first version put it: at 1.78 the coping reached the last dark
// sample and cell (0.646, 0.795), whose photo IS the #3f4345 at x 1.79, went 0.0725 to 0.1316. 1.86 was
// measured too and is worse at both ends (0.05963 / 0.57129 against 0.05960 / 0.57145 at 1.78 and
// 0.05960 / 0.57145 at 1.82), because a CELL spans x and an edge at 1.86 uncovers half of the two light
// cells it is there for. 1.82 clears the dark sample and keeps them.
// A coping over the WHOLE strip was measured before either and moved four cells the right way by 0.10,
// 0.089, 0.081 and 0.023 while moving five the wrong way by 0.106, 0.050, 0.050, 0.048 and 0.013, for a
// net of nothing. Inside 1.86 what the camera sees over that strip is the wall's own face and the stones'
// tops at a grazing angle, which the photo has in shade.
//
// The rows are laid in two spans so that none of them straddles the terrace line's kink at z = -5.6. The
// first version laid one span from -5.05 back, and its nearest stone was centred at -5.493, above the
// kink, where `slopeAt` reads 0: the whole 0.87 m stone came out horizontal, its far end standing 0.142 m
// proud of the wall top with a 0.119 m drop to the next stone — a 15 px jog in the scored frame inside
// cell (0.729, 0.886). `rightWalkway` guards the same case with a slope test; this guards it by cutting.
function wallCoping(items, rand) {
  const T = L.RIGHT_TERRACE;
  const x1 = T.xInner + 0.05;
  const x0 = x1 - 0.33;
  const slopeAt = (z) => (L.rightTerraceY(z + 0.05) - L.rightTerraceY(z - 0.05)) / 0.1;
  const color = scaleHex(C.wallCoping, C.walkwayLit);
  for (const [zNear, zFar] of [[L.RIGHT_STEP.z, L.RIGHT_BED.z1], [L.RIGHT_BED.z1, L.RIGHT_BED.z0]]) {
    const rows = Math.max(1, Math.round((zNear - zFar) / 0.9));
    const d = (zNear - zFar) / rows;
    for (let r = 0; r < rows; r++) {
      const cz = zNear - (r + 0.5) * d;
      items.push({
        position: [(x0 + x1) / 2, L.rightTerraceY(cz) + 0.03, cz],
        euler: [-Math.atan(slopeAt(cz)), 0, 0],
        scale: [x1 - x0, 1, d - 0.02],
        tint: 1 + jitter(rand, 0.04),
        color,
        uv: [rand() * 4, rand() * 4],
      });
    }
  }
}

// The mortar body under a paved ribbon on the height field, with side skirts.
function ribbon(b, name, z0, z1, width, color) {
  const positions = [];
  const steps = Math.max(2, Math.ceil((z0 - z1) / 1.5));
  for (let i = 0; i <= steps; i++) {
    const z = z0 + ((z1 - z0) * i) / steps;
    const cx = L.streetCenterX(z);
    const y = L.streetY(z);
    positions.push(cx - width / 2, y - 0.01, z, cx + width / 2, y - 0.01, z);
  }
  const index = [];
  for (let i = 0; i < steps; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  b.add(new THREE.Mesh(geo, material(color, { side: THREE.DoubleSide })), name);
  const skirt = [];
  for (let i = 0; i <= steps; i++) {
    const z = z0 + ((z1 - z0) * i) / steps;
    const cx = L.streetCenterX(z);
    const y = L.streetY(z);
    skirt.push(cx - width / 2, y - 3, z, cx - width / 2, y, z, cx + width / 2, y - 3, z, cx + width / 2, y, z);
  }
  const skirtIndex = [];
  for (let i = 0; i < steps; i++) {
    const a = i * 4;
    skirtIndex.push(a, a + 1, a + 4, a + 1, a + 5, a + 4, a + 2, a + 6, a + 3, a + 3, a + 6, a + 7);
  }
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute('position', new THREE.Float32BufferAttribute(skirt, 3));
  sgeo.setIndex(skirtIndex);
  sgeo.computeVertexNormals();
  b.add(new THREE.Mesh(sgeo, material(C.stoneWallRight, { side: THREE.DoubleSide })), `${name} skirt`);
}
