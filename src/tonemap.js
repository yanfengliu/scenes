// The tone curve, and its inverse.
//
// Every color in src/layout.js is a mean sampled from the photo, so it is already a *displayed* color:
// what the frame buffer should show. Phase 4 renders through ACES filmic tone mapping, which compresses
// what it is given, so a material whose albedo is the sampled mean would come out darker and duller than
// the photo. The fix is to ask the inverse question: what radiance, after exposure and the tone curve,
// displays as this sampled color? `sceneRadiance` answers it, and every phase 4 color goes through it.
//
// The ACES fit is the one three.js uses (ACESFilmicToneMapping in tonemapping_pars_fragment.glsl.js,
// the Stephen Hill fit of the RRT and ODT), ported here so the inverse is of the same curve the GPU
// applies. The inverse is a fixed point iteration: the curve is monotone per channel, so scaling the
// input by the ratio of wanted to obtained converges in a few steps.

const ACES_INPUT = [
  [0.59719, 0.35458, 0.04823],
  [0.076, 0.90834, 0.01566],
  [0.0284, 0.13383, 0.83777],
];
const ACES_OUTPUT = [
  [1.60475, -0.53108, -0.07367],
  [-0.10208, 1.10813, -0.00605],
  [-0.00327, -0.07276, 1.07602],
];

const mul = (m, v) => [
  m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
  m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
  m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
];
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

function rrtAndOdtFit(v) {
  return v.map((x) => {
    const a = x * (x + 0.0245786) - 0.000090537;
    const b = x * (0.983729 * x + 0.432951) + 0.238081;
    return a / b;
  });
}

// The displayed linear color for a linear scene radiance, at `exposure` (three divides by 0.6 before the fit,
// as its shader does).
export function acesFilmic(rgb, exposure = 1) {
  const scaled = rgb.map((c) => (c * exposure) / 0.6);
  return mul(ACES_OUTPUT, rrtAndOdtFit(mul(ACES_INPUT, scaled))).map(clamp01);
}

// The linear scene radiance that displays as `target` (a linear color) at `exposure`. Above the curve's
// ceiling the answer is unbounded, so the iteration is capped; a target at 1.0 is white however bright.
export function inverseAces(target, exposure = 1, iterations = 24) {
  const out = target.map((c) => Math.max(c, 0));
  for (let i = 0; i < iterations; i++) {
    const got = acesFilmic(out, exposure);
    for (let c = 0; c < 3; c++) {
      if (target[c] <= 0) {
        out[c] = 0;
        continue;
      }
      const ratio = got[c] > 1e-6 ? target[c] / got[c] : 4;
      out[c] = Math.min(64, out[c] * Math.min(4, Math.max(0.25, ratio)));
    }
  }
  return out;
}

export const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const linearToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

export const hexToLinear = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255].map(srgbToLinear);
export const linearToHex = (rgb) => {
  const ch = (c) => Math.round(clamp01(linearToSrgb(c)) * 255);
  return (ch(rgb[0]) << 16) | (ch(rgb[1]) << 8) | ch(rgb[2]);
};

// The scene radiance whose displayed color is the sampled mean `hex`, divided by the irradiance the
// surface will receive (1 for something that is not lit at all, like the sky and the distant layers).
// This is the one place the phase 4 pipeline undoes what the tone curve is about to do.
export function sceneRadiance(hex, { exposure = 1, irradiance = 1 } = {}) {
  const radiance = inverseAces(hexToLinear(hex), exposure);
  return radiance.map((c) => c / irradiance);
}
