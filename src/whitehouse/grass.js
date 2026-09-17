// BLADE-SCALE SPECKLE FOR THE NORTH LAWN, and the reason it exists is a measurement.
//
// The photograph's near lawn is not a smooth surface. out/wh/scratch/whlawnstat.mjs reads it over the box the
// high-pass crops use (u 0.20-0.80, v 0.90-0.98, 720x72 px of whitehouse.webp): mean luma 106.4, sd 29.5,
// mean |gradient| 23.5 levels/px, p1 54 / p99 192, and the sd of luma minus a local box mean at radii 1, 2,
// 3, 6 and 12 px reads 21.6, 25.4, 26.7, 28.0, 28.9 -- a broadband speckle with no scale of its own. The
// SAME BOX of the render reads mean 109.7, sd 2.8, gradient 0.124 levels/px and the same high-pass sd 0.12
// to 0.24. out/wh/scratch/whhp.mjs at a 6 px radius draws the two side by side and the photograph is dense
// blade speckle while the render is flat grey. out/critic/measure.mjs reads the whole frame at detail
// (high-pass luma sd) 0.580 of the photograph and edge energy 0.396, and the lawn is the largest flat area
// in the frame -- rows v 0.78 to 1.00, about a quarter of it.
//
// So this file is that speckle, as a modulation tiled over the lawn's own (x, z).
//
// ---- WHAT IT IS, AND WHY IT IS A MODULATION AND NOT GEOMETRY ----
// The photograph's speckle cannot be resolved into blades: at the near lawn the ground is about 20 m away
// and one pixel is 1.9 cm of it (dn = 9.086/(1.08184 (v - 0.5)) in layout.js; at v 0.94 that is 19.7 m, and
// 1200 px spans 2 * tanV * 4/3 * dn = 22.7 m, so 1.89 cm/px, with the ground tilted so the vertical scale is
// about 1.14x that). A blade is millimetres, so what the photograph's 2 to 6 px grain IS, is the aliased
// sum of a canopy far finer than a pixel. What has to be reproduced is therefore not blades but the
// STATISTICS of their sum: reflectance variation at the 4 to 12 cm scale, with a broad spectrum and no
// preferred direction. A per-texel noise field at the right pitch does exactly that, and it is the repo's own
// pattern for every other surface (src/textures.js).
//
// ---- THE PITCHES, DERIVED FROM THE PHOTOGRAPH RATHER THAN CHOSEN ----
// The map is TILE x TILE texels over GRASS.metres metres of lawn, so one texel is 1.56 mm -- a twelfth of
// the near lawn's own pixel. Both octaves divide the tile into a WHOLE number of wavelengths and each of
// those into a whole number of lattice cells, so the bi-quintic interpolation wraps exactly and the tile has
// no seam in either axis:
//
//   octave   wavelength   texels/wave   waves per tile   lattice cells
//   fine     8.0 cm       51.2          40               51
//   mid      40.0 cm      256           8                256
//
// The two octaves are MULTIPLIED, (1 + a1 d1)(1 + a2 d2), so the speckle is contrast at both scales instead
// of only at the finest one, and each amplitude is a relative reflectance. The 8 cm octave carries most of
// it: the lawn is seen at about 24 degrees, so the mip level a sampler picks is set by the footprint's
// longer axis and a coarser octave is the first thing the chain averages away -- measured, moving amplitude
// from the fine octave into the mid one at the same total spread costs a third of the render's own gradient
// (0.24/0.12 gives 20.4 levels/px, 0.155/0.155 gives 13.6 and 0.10/0.20 gives 10.6).
//
// ---- THE MEAN, AND HOW IT IS HELD EXACTLY ----
// The lawn's own tone is not this file's to change: the photograph's lawn rows read luma 101 to 114
// (out/wh/scratch/meanbox.mjs, and 105.7 over the whole v 0.74-1.00 strip), and every scored cell that
// covers the lawn is compared against it. So the field is a PURE MODULATION -- applied to whatever albedo the
// surface already has -- and its stored value is solved to a stated mean before it is encoded.
//
// PASS C'S NORMALISATION, AND WHY THE SHAPE WAS THE DEFECT. Pass C divided the field by its own mean and
// encoded it as-is, so the mean was 1.0 before clamping and 0.663 after: an 8-bit sRGB value cannot exceed
// 1.0, ~43 % of texels clamped to byte 255, and the material carried a FITTED 5.87 to put the level back.
// The cost was not the level. A unit-mean 8-bit modulation with a maximum of 1.0 has no room for variance
// ABOVE its mean, so what it stored was a one-sided, darkening-only hash; and the material's compensation
// was a single SCALAR laid on three unequal per-channel tone-curve ratios, which moved the lawn's hue.
//
// This file stores a TWO-SIDED field instead: a stated mean (0.45) and a stated sd (0.34) inside the whole
// legal range [0, 1], with the clamp catching only the tails (measured: 7.9 % at the top, 0.0 % at the
// bottom). `mode: 'flat'` is the zero-variance control that made the hue question answerable -- same slot,
// same uv1, same compensation, same mip chain, with the map held at its own mean -- and `grounds.js` records
// what that control measured and what the residual correction is.
//
// ---- WHY THIS IS BOUND AS `aoMap` ON A SECOND UV SET AND NOT AS THE MATERIAL'S `map` ----
// Three composes every bound texture multiplicatively, so a map that averages its own base drags the lawn's
// tone down with it, and three multiplies the material's colour by the map as well as by the vertex colours
// -- which is what puts the albedo in twice. Measured, over the near-lawn box (u 0.20-0.80, v 0.90-0.98)
// against the flat lawn's own 110.03, with the modulation in the albedo slot and a white material colour:
//
//   map = albedoOf(BASE), linear mean 0.174 in green   ->  28.77
//   map = the plain sRGB decode of BASE                ->  32.29
//   map = constant 1.0                                 -> 110.03
//
// `aoMap` is used instead. It is a documented three material slot that multiplies `diffuseColor` exactly
// once (`aomap_fragment`: `diffuseColor.rgb *= ambientOcclusion`), and -- this is the part that makes it
// usable here -- the material's own `map` stays null, so it samples uv1 and three binds the geometry's
// second UV attribute to it (`aoMapUv: HAS_AOMAP && getChannel( material.aoMap.channel, 'uv1' )`, whose
// documented fallback is `uv`). That gives the speckle its own texture unit and its own coordinate without
// touching the albedo path at all: the mesh keeps its vertex colours, its base and its mowing field exactly
// as they shipped. Verified on a card before it was wired in: a 1x1 `#f0f0f0` texture on uv1 through the
// aoMap slot renders 240, and an sRGB 50 percent grey on it renders 128.
import * as THREE from 'three';

export const GRASS = {
  // THE WORLD PITCH IS SET BY WHAT SURVIVES THE GRAZING ANGLE, NOT BY WHAT LOOKS FINE UP CLOSE, and that is
  // the measurement that moved it from the 12.8 m this file first shipped. The lawn is seen at about 24
  // degrees, so one screen pixel covers far more ground down the view than across it -- at the near lawn the
  // footprint is roughly 0.3 px across and 2.6 px down -- and the mip level a sampler picks is set by the
  // LONGER axis. At 12.8 m the 8 cm octave was averaged away into soft mottle and the render's own high-pass
  // came back as blurred 20 to 40 px blobs, sd 4.0 at a 1 px radius against the photograph's 21.6. At 3.2 m
  // the same octave is four times finer in world terms, survives that averaging, and comes back as grain.
  tile: 2048,
  metres: 3.2,
  base: 0.08, // the finest octave's wavelength in metres -- 51.2 texels, 40 waves across the tile
  scales: [1, 5], // 8 cm and 40 cm; the mip chain carries everything coarser
  // ---- THE STORED RANGE, AND WHY PASS C's IS THE WRONG SHAPE -----------------------------------------
  // Pass C shipped `mode: 'onesided'`: the field is divided by its own mean and encoded as-is, so ~43 % of
  // texels sit above 1.0, clamp to byte 255, and the map's own LINEAR mean lands at 0.663 instead of 1.0.
  // The material then multiplied the lawn's albedo by a FITTED 5.87, applied as a single scalar to three
  // unequal per-channel tone-curve ratios, and that is what moved the lawn's hue -- see grounds.js.
  //
  // `mode: 'symmetric'` stores a two-sided field instead: a stated mean, a stated sd, and a clamp whose tail
  // is derived from the two. The compensating factor is then exactly 1 / the map's measured linear mean.
  // `mode: 'flat'` is the zero-variance control (a constant at `mean`), and it is a first-class mode because
  // the hue question -- did the TEXTURE move the tone, or the material path? -- can only be answered by
  // rendering the same material with the variance removed. out/wh/scratch/whflat.mjs and whcorr.mjs do it.
  mode: 'symmetric',
  mean: 0.45, // the stored modulation's LINEAR mean -- the number the material's compensation divides by
  // THE CONTRAST IS A STATED SD, and the stored clamp is derived from it, so the two cannot fight. Pass C's
  // `range: [0.6, 1.0]` was a hard cap on the variance AND the thing that made the mean unreachable: with the
  // field's mean forced onto one end of the range the clamp took 43 % of the texels at one end and 57 % at
  // the other -- a one-sided hash again, only upside down, and its measured sd was 0.05.
  //
  // `range: [0, 1]` is the whole legal range of an 8-bit modulation, so nothing is lost above it. Going wider
  // was measured and rejected: byte 255 decodes to 1.0 while everything stored above 1.0 is invisible, so a
  // range reaching 1.6 biased the map's own measured linear mean 3.5 % below the config value for no visible
  // contrast -- and that measured mean is the number the material has to divide by.
  //
  // 0.34 is tuned against the photograph's own high-pass sd at r1/r2/r3: it is what puts the render's 14.39 /
  // 21.58 / 24.64 against the photograph's 21.55 / 25.39 / 26.66 while holding the scored cell distance.
  sd: 0.34,
  range: [0.0, 1.0],
  // The relative reflectance each octave carries, in LINEAR space. Their product's own spread is the
  // speckle's amplitude and `gain` scales them at once, so the contrast is tuned in one place. The 8 cm
  // octave carries most of it, because that is the grain the frame shows.
  amps: [0.24, 0.12],
  gain: 7.0,
  seed: 20240621,
};

// THE TUNING HOOK. `makeSpeckleBytes` and `speckleTexture` both default to `GRASS`, and every measurement in
// out/wh/scratch changes one number and re-renders. Reading the config through this function instead of the
// constant directly lets a calibration page set `window.__GRASS = { amps: [...] }` (before the module loads,
// with a Playwright init script) and measure a swept value on the SHIPPING code path rather than on a copy of
// it. Nothing in the scene sets it, so the shipped build is exactly `GRASS`; `out/wh/scratch/whsweep.mjs` is
// the only caller that does, and the handoff records the numbers it produced.
export function grassConfig(overrides = null) {
  // ONE merge, so an explicit argument and the page's own override hook cannot disagree. A caller passing
  // `{ mode: 'flat' }` gets `mode` replaced and everything else from the page hook, then from `GRASS`.
  const page = (typeof window !== 'undefined' && window.__GRASS) || null;
  if (overrides || page) return { ...GRASS, ...page, ...overrides };
  return GRASS;
}

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// sRGB <-> linear, the exact piecewise pair the GPU applies for SRGBColorSpace.
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

// Deterministic PRNG, the same one every other generator in this repo uses.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Smooth bilinear value noise on an integer lattice of `period` cells, tiling exactly in both axes.
// `t*t*t*(t*(t*6-15)+10)` (Perlin's quintic) rather than src/textures.js noise2D's cubic: this texture's
// whole contribution is its variance, and the cubic leaves C1 discontinuities on every lattice line, which
// at an 8 cm octave is a faint square grid -- exactly the tiling artefact the brief asks to be checked for.
function sampleLattice(g, period, u, v) {
  const x = u * period;
  const y = v * period;
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const sx = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
  const sy = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
  const i0 = ((xi % period) + period) % period;
  const j0 = ((yi % period) + period) % period;
  const i1 = (i0 + 1) % period;
  const j1 = (j0 + 1) % period;
  const a = g[j0 * period + i0];
  const b = g[j0 * period + i1];
  const c = g[j1 * period + i0];
  const d = g[j1 * period + i1];
  const top = a + (b - a) * sx;
  const bot = c + (d - c) * sx;
  return top + (bot - top) * sy;
}

// The modulation field, top-down rows, in one of THREE shapes:
//
//   mode 'symmetric' (shipped here)  a two-sided field with a STATED mean and a STATED sd inside a STATED
//     range. The octave product is normalised to zero mean and unit sd, scaled to `cfg.sd`, centred on
//     `cfg.mean` and clamped to `cfg.range`; the clamp is the only thing that can move the mean, and with the
//     shipped numbers it is one-sided and small (measured: 7.9 % of texels at the top, 0.0 % at the bottom).
//     The compensating factor is then EXACTLY 1 / the measured linear mean, with nothing fitted.
//   mode 'flat'  the zero-variance control: a constant at `cfg.mean`, so the map multiplies by one number
//     everywhere. It exists to separate the material path's tone and hue from the texture's, and it is what
//     out/wh/scratch/whflat.mjs and whcorr.mjs render.
//   mode 'onesided' (pass C)  the field divided by its own mean and encoded as-is: a mean of 1.0 before
//     clamping and 0.663 after, ~43 % of texels at byte 255, and a fitted scalar in the material.
//
// Returns the bytes AND the statistics measured on them, so a caller can check the mean rather than trust
// it. `mean`, `sd`, `min` and `max` are of the LINEAR decode of the encoded bytes -- what the shader
// actually multiplies by -- `storedMean`/`storedMin`/`storedMax` are of the pre-encode field, and
// `clipHigh` / `clipLow` are the fractions of texels the range clamp caught.
export function makeSpeckleBytes(cfg = grassConfig()) {
  const T = cfg.tile;
  const octaves = cfg.scales.map((scale, k) => {
    const waves = cfg.metres / (cfg.base * scale);
    const period = Math.max(2, Math.round(T / waves));
    const rand = mulberry32(cfg.seed + 1013 * k);
    const g = new Float32Array(period * period);
    for (let i = 0; i < g.length; i++) g[i] = rand();
    return { g, period, amp: cfg.amps[k] * cfg.gain };
  });
  const n = T * T;
  const field = new Float32Array(n);
  let sum = 0;
  for (let y = 0; y < T; y++) {
    const v = (y + 0.5) / T;
    for (let x = 0; x < T; x++) {
      const u = (x + 0.5) / T;
      let k = 1;
      for (const o of octaves) k *= 1 + o.amp * (sampleLattice(o.g, o.period, u, v) * 2 - 1);
      // A negative reflectance is not a dark lawn, it is an unphysical one.
      field[y * T + x] = k < 0 ? 0 : k;
      sum += field[y * T + x];
    }
  }
  const centre = sum / n;
  const data = new Uint8Array(n * 4);
  let clipHigh = 0;
  let clipLow = 0;
  // What each texel's STORED value is, and the statistics of the byte encoding, filled by whichever mode.
  const value = new Float32Array(n);
  if ((cfg.mode ?? 'onesided') === 'flat') {
    // The zero-variance control: a constant at `cfg.mean`, so the map multiplies the diffuse colour by one
    // number everywhere and every measurement of tone and hue is of the MATERIAL PATH alone.
    for (let i = 0; i < n; i++) value[i] = cfg.mean;
  } else if ((cfg.mode ?? 'onesided') === 'symmetric') {
    // A TWO-SIDED FIELD WITH A STATED MEAN AND A STATED SD. The octave product is normalised to zero mean and
    // unit sd, scaled to `cfg.sd`, centred on `cfg.mean` and clamped to `cfg.range`. The clamp is the only
    // thing that can move the mean, so with the shipped numbers it is symmetric and tiny and the mean lands
    // where the config says; both clip fractions are measured and reported per end.
    let fsum = 0;
    for (let i = 0; i < n; i++) fsum += field[i];
    const fmean = fsum / n;
    let fsd = 0;
    for (let i = 0; i < n; i++) fsd += (field[i] - fmean) ** 2;
    fsd = Math.sqrt(fsd / n);
    const lo = cfg.range[0];
    const hi = cfg.range[1];
    for (let i = 0; i < n; i++) {
      const z = cfg.mean + (cfg.sd * (field[i] - fmean)) / fsd;
      if (z > hi) clipHigh++;
      else if (z < lo) clipLow++;
      value[i] = z < lo ? lo : z > hi ? hi : z;
    }
  } else {
    for (let i = 0; i < n; i++) {
      const z = field[i] / centre;
      if (z > 1) clipHigh++;
      value[i] = z > 1 ? 1 : z;
    }
  }
  for (let i = 0; i < n; i++) {
    const byte = Math.round(clamp01(toSrgb(value[i])) * 255);
    data[i * 4] = byte;
    data[i * 4 + 1] = byte;
    data[i * 4 + 2] = byte;
    data[i * 4 + 3] = 255;
  }
  let mean = 0;
  let meanSq = 0;
  let min = 1;
  let max = 0;
  let storedMean = 0;
  let storedMin = Infinity;
  let storedMax = 0;
  for (let i = 0; i < n; i++) {
    const decoded = toLinear(data[i * 4] / 255);
    mean += decoded;
    meanSq += decoded * decoded;
    min = Math.min(min, decoded);
    max = Math.max(max, decoded);
    storedMean += value[i];
    storedMin = Math.min(storedMin, value[i]);
    storedMax = Math.max(storedMax, value[i]);
  }
  mean /= n;
  storedMean /= n;
  const sd = Math.sqrt(Math.max(0, meanSq / n - mean * mean));
  return {
    data, mean, sd, min, max,
    clipped: clipHigh / n,
    clipHigh: clipHigh / n,
    clipLow: clipLow / n,
    centre,
    storedMean,
    storedMin,
    storedMax,
    mode: cfg.mode ?? 'onesided',
    range: cfg.range,
    sdConfig: cfg.sd,
  };
}

// A 2x2 box filter in LINEAR space, one level down. Averaging the encoded bytes would average a gamma curve,
// which is the fault this manual chain exists to avoid.
function downsampleLinear(data, w, h) {
  const nw = Math.max(1, w >> 1);
  const nh = Math.max(1, h >> 1);
  const out = new Uint8Array(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const x0 = x * 2;
      const y0 = y * 2;
      const x1 = Math.min(w - 1, x0 + 1);
      const y1 = Math.min(h - 1, y0 + 1);
      const o = (y * nw + x) * 4;
      const lin = 0.25 * (
        toLinear(data[(y0 * w + x0) * 4] / 255)
        + toLinear(data[(y0 * w + x1) * 4] / 255)
        + toLinear(data[(y1 * w + x0) * 4] / 255)
        + toLinear(data[(y1 * w + x1) * 4] / 255)
      );
      const byte = Math.round(clamp01(toSrgb(clamp01(lin))) * 255);
      out[o] = byte;
      out[o + 1] = byte;
      out[o + 2] = byte;
      out[o + 3] = 255;
    }
  }
  return { data: out, width: nw, height: nh };
}

// The lawn's speckle, ready to bind to a material's `aoMap` with the mesh's second UV set: an sRGB
// modulation with a known LINEAR mean in a stated range, carrying its own linear-space mip chain, with
// anisotropy taken from the renderer that will draw it. `userData` carries the measured statistics and the
// exact compensating factor, so the material never has to fit one from a render.
export function speckleTexture({ renderer = null, cfg = grassConfig() } = {}) {
  const stats = makeSpeckleBytes(cfg);
  const { data } = stats;
  const T = cfg.tile;
  const levels = [{ data, width: T, height: T }];
  let level = levels[0];
  while (level.width > 1 || level.height > 1) {
    level = downsampleLinear(level.data, level.width, level.height);
    levels.push(level);
  }
  const texture = new THREE.DataTexture(data, T, T, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.mipmaps = levels;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  // DataTexture assumes a GL-native (bottom-up) buffer and defaults flipY to false, which is what the row
  // order built above is: row 0 of `data` is the bottom of the image. grounds.js's UVs run v up the world's
  // +z, so the field is laid on the lawn unmirrored; it is isotropic, so nothing about the look depends on
  // it, but the tiling check looks at the wrap and a sign flip there would be a thing to explain rather than
  // a thing that is right. (three's own src/textures.js flips a CanvasTexture the other way because a card
  // is drawn top-down; this is a DataTexture and a field, not a card.)
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // The lawn is seen at a grazing angle -- 24 degrees at v 0.92, where the footprint is about 16 percent
  // longer down the view than across it, and far worse towards the horizon. Without anisotropy the one
  // isotropic level the derivatives pick is chosen by the longer axis and the across-frame grain is thrown
  // away, which is the half of the speckle that is left in this view. The renderer's own maximum.
  texture.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 8;
  texture.needsUpdate = true;
  const { data: _bytes, ...report } = stats;
  texture.userData = {
    ...report,
    // The compensating factor the material must apply, EXACTLY: the stored mean is known before the texture
    // is bound, so the material divides by it rather than by a scalar read off a render.
    factor: 1 / stats.mean,
    metres: cfg.metres,
    tile: T,
  };
  return texture;
}




