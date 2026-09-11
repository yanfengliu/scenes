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
  // middle is in shadow, and it runs on behind the corner house.
  const farStreet = [];
  const farStreetLit = [];
  gridSlabsAlongStreet(farStreet, -22, -42, 5.2, onStreet, 0.9, 0.6, (cx, cz) => cx > L.streetCenterX(cz) - 1.2);
  gridSlabsAlongStreet(farStreetLit, -22, -42, 5.2, onStreet, 0.9, 0.6, (cx, cz) => cx <= L.streetCenterX(cz) - 1.2);
  const landingMean = balancedMean(C.landingSlab, mortarOf(C.landingSlab), 0.05);
  const farLitMean = balancedMean(C.landing, mortarOf(C.landing), 0.05);
  const farMean = balancedMean(C.farStreet, mortarOf(C.farStreet), 0.05);
  b.add(instanced('landing slabs', slab, surface('stone', landingMean, { seed: 15, instancedUv: true }), landing), 'landing slabs');
  b.add(instanced('far street slabs', slab, surface('stone', farMean, { seed: 16, instancedUv: true }), farStreet), 'far street slabs');
  b.add(instanced('far street lit slabs', slab, surface('stone', farLitMean, { seed: 21, instancedUv: true }), farStreetLit), 'far street lit slabs');
  ribbon(b, 'landing', S.stairsEndZ, -22, 7.0, mortarOf(C.landingSlab));
  ribbon(b, 'far street', -22, -42, 5.2, mortarOf(C.farStreet));

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
      const shade = 1 - (i / (sideSteps - 1)) * 0.38;
      sideTreads.push({ position: [x0 + sideTread / 2 + JOINT / 2, y, zc], scale: [sideTread + JOINT, 1, zw - JOINT], tint: shade + jitter(rand, 0.04), uv: [rand() * 4, rand() * 4] });
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
