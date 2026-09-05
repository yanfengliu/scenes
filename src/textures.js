// Procedural textures drawn per pixel into a canvas. Every albedo is corrected to a target mean color
// (the photo-sampled sRGB mean from src/layout.js), so a texture adds variation around the mean and
// never a new color. Height fields also produce tangent-space normal maps and roughness maps, which
// phase 4 will wire into lit materials.
import * as THREE from 'three';
import { mulberry32, hash2 } from './random.js';

// ---- noise ---------------------------------------------------------------------------------------

// Smooth value noise on a 256x256 lattice, tiling with period 256 lattice units.
export function noise2D(seed) {
  const rand = mulberry32(seed);
  const grid = new Float32Array(256 * 256);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const g = (i, j) => grid[((j & 255) << 8) | (i & 255)];
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const sx = xf * xf * (3 - 2 * xf);
    const sy = yf * yf * (3 - 2 * yf);
    const a = g(xi, yi);
    const b = g(xi + 1, yi);
    const c = g(xi, yi + 1);
    const d = g(xi + 1, yi + 1);
    const top = a + (b - a) * sx;
    const bottom = c + (d - c) * sx;
    return top + (bottom - top) * sy;
  };
}

// Fractal sum of `octaves` noise layers, normalised to about 0..1. `freq` is in cycles per texture
// tile, so the result tiles when freq is an integer.
export function fbm(noise, u, v, freq, octaves = 4, gain = 0.5) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = freq;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(u * f, v * f);
    norm += amp;
    amp *= gain;
    f *= 2;
  }
  return sum / norm;
}

// ---- texture factory -----------------------------------------------------------------------------

const rgbOf = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const clamp255 = (x) => (x < 0 ? 0 : x > 255 ? 255 : x);

// Build an albedo texture: `pixel(u, v, env)` returns [r, g, b] (0..255, before correction) for the
// texel at (u, v) in 0..1; env carries two noise functions and the texel coordinates. The result is
// shifted so its mean equals `mean` exactly (two passes, because clamping after the first shift can
// move the mean a little). Returns { texture, height } where `height` is the optional height field
// (a Float32Array of size*size in 0..1) the pixel function filled in through env.height.
export function makeAlbedo({ size = 256, seed = 1, mean, pixel, repeatMetres = 1, height = false }) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const env = { noise: noise2D(seed), noiseB: noise2D(seed + 101), noiseC: noise2D(seed + 202), size, x: 0, y: 0, height: null };
  const heights = height ? new Float32Array(size * size) : null;
  const target = rgbOf(mean);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      env.x = x;
      env.y = y;
      env.height = 0.5;
      const [r, g, b] = pixel(x / size, y / size, env);
      const i = (y * size + x) * 4;
      d[i] = clamp255(r);
      d[i + 1] = clamp255(g);
      d[i + 2] = clamp255(b);
      d[i + 3] = 255;
      if (heights) heights[y * size + x] = env.height;
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    const sum = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4) {
      sum[0] += d[i];
      sum[1] += d[i + 1];
      sum[2] += d[i + 2];
    }
    const n = size * size;
    const shift = [target[0] - sum[0] / n, target[1] - sum[1] / n, target[2] - sum[2] / n];
    for (let i = 0; i < d.length; i += 4) {
      d[i] = clamp255(Math.round(d[i] + shift[0]));
      d[i + 1] = clamp255(Math.round(d[i + 1] + shift[1]));
      d[i + 2] = clamp255(Math.round(d[i + 2] + shift[2]));
    }
  }
  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / repeatMetres, 1 / repeatMetres);
  texture.anisotropy = 4;
  return { texture, heights, size };
}

// Tangent-space normal map from a height field (0..1), tiling. `strength` scales the slopes.
export function normalMapFromHeights(heights, size, strength = 2.0, repeatMetres = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const h = (x, y) => heights[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      d[i] = Math.round((-dx / len) * 127.5 + 127.5);
      d[i + 1] = Math.round((dy / len) * 127.5 + 127.5);
      d[i + 2] = Math.round((1 / len) * 127.5 + 127.5);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / repeatMetres, 1 / repeatMetres);
  return texture;
}

// Grayscale roughness map: base roughness plus a term from the height field (pits are rougher).
export function roughnessMapFromHeights(heights, size, base = 0.85, variation = 0.12, repeatMetres = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let i = 0; i < size * size; i++) {
    const r = clamp255(Math.round((base + (0.5 - heights[i]) * 2 * variation) * 255));
    d[i * 4] = r;
    d[i * 4 + 1] = r;
    d[i * 4 + 2] = r;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / repeatMetres, 1 / repeatMetres);
  return texture;
}

// ---- pixel functions -----------------------------------------------------------------------------
// Each returns [r, g, b] around a base color `c` = [r, g, b] with multiplicative variation, and may set
// env.height (0..1) for the normal and roughness maps.

const tint = (c, k, warm = 0) => [c[0] * (k + warm), c[1] * k, c[2] * (k - warm)];

// Cut stone: low-frequency mottling, fine speckle, a few darker pits and a hint of veining.
export function stonePixel(c) {
  return (u, v, env) => {
    const mottle = fbm(env.noise, u, v, 3, 3) - 0.5;
    const speckle = env.noiseB(u * 64, v * 64) - 0.5;
    const pits = fbm(env.noiseC, u, v, 9, 2);
    const vein = Math.abs(Math.sin((u * 2.3 + v * 1.1) * Math.PI * 2 + fbm(env.noise, u, v, 2, 2) * 4)) < 0.03 ? -0.08 : 0;
    const pit = pits > 0.68 ? -(pits - 0.68) * 0.9 : 0;
    env.height = 0.5 + mottle * 0.5 + pit * 1.2 + speckle * 0.15;
    const k = 1 + mottle * 0.16 + speckle * 0.1 + pit + vein;
    return tint(c, k, mottle * 0.02);
  };
}

// Rubble wall stone: coarser mottling and stronger speckle than a cut slab.
export function rubblePixel(c) {
  return (u, v, env) => {
    const mottle = fbm(env.noise, u, v, 4, 4) - 0.5;
    const speckle = env.noiseB(u * 90, v * 90) - 0.5;
    const grain = env.noiseC(u * 20, v * 20) - 0.5;
    env.height = 0.5 + mottle * 0.6 + grain * 0.3;
    const k = 1 + mottle * 0.22 + speckle * 0.12 + grain * 0.08;
    return tint(c, k, mottle * 0.03);
  };
}

// Wood boards running along v: per-board tint, grain lines with a slow wobble, dark seams, rare knots.
export function woodPixel(c, boards = 6, seamWidth = 0.035) {
  return (u, v, env) => {
    const bu = u * boards;
    const board = Math.floor(bu);
    const f = bu - board;
    const boardTint = (hash2(board, 7, 3) - 0.5) * 0.16;
    const wobble = (env.noise(v * 6, board * 13.7) - 0.5) * 2.5;
    const grain = Math.sin((f * 11 + wobble + v * 0.7) * Math.PI * 2) * 0.05 + (env.noiseB(u * 40, v * 220) - 0.5) * 0.08;
    const seam = f < seamWidth || f > 1 - seamWidth ? -0.3 : 0;
    const knotN = env.noiseC(u * 5, v * 5);
    const knot = knotN > 0.86 ? -(knotN - 0.86) * 2.5 : 0;
    env.height = 0.5 + grain * 1.5 + seam * 0.6;
    return tint(c, 1 + boardTint + grain + seam + knot, grain * 0.2);
  };
}

// Plaster: fine noise and faint blotches.
export function plasterPixel(c) {
  return (u, v, env) => {
    const fine = env.noiseB(u * 120, v * 120) - 0.5;
    const blotch = fbm(env.noise, u, v, 3, 3) - 0.5;
    env.height = 0.5 + fine * 0.2;
    return tint(c, 1 + fine * 0.07 + blotch * 0.08);
  };
}

// A kawara tile face: a gentle shade gradient along the tile's length and a fired-clay speckle.
export function kawaraPixel(c) {
  return (u, v, env) => {
    const speckle = env.noiseB(u * 48, v * 48) - 0.5;
    const grade = (v - 0.5) * 0.08;
    const mottle = fbm(env.noise, u, v, 2, 2) - 0.5;
    env.height = 0.5 + speckle * 0.1;
    return tint(c, 1 + speckle * 0.07 + grade + mottle * 0.06, -0.01);
  };
}

// Noren cloth: three panels with dark seams, a large crest in the middle panel and a row of small
// marks above the hem. The mean correction lifts the cloth so the whole sheet averages to the mean.
// The whole noren maps to one texture: three panels with a seam between them, a round crest on each
// panel, and a row of small marks above the hem. The crest is drawn in metres (panel width 3.27 m,
// cloth height about 1 m) so it stays round on the cloth.
export function norenPixel(c) {
  const panelWidth = 9.8 / 3;
  return (u, v, env) => {
    const weave = (env.noiseB(u * 600, v * 200) - 0.5) * 0.05;
    let k = 1.18 + weave;
    const seam = Math.abs(u - 1 / 3) < 0.002 || Math.abs(u - 2 / 3) < 0.002;
    const panel = Math.min(2, Math.floor(u * 3));
    const pu = (u * 3 - panel) * panelWidth;
    const pv = v * 1.0;
    const r = Math.hypot(pu - panelWidth / 2, pv - 0.45);
    const ring = r > 0.2 && r < 0.25;
    const inner = r < 0.14 && Math.abs(Math.sin(pu * 40) * Math.cos(pv * 26)) > 0.5;
    const marks = v > 0.8 && v < 0.86 && ((u * 27) % 1) < 0.4 && ((u * 27) % 1) > 0.15;
    if (seam || ring || inner || marks) k = 0.28;
    env.height = 0.5;
    return tint(c, k);
  };
}

// Sudare bamboo blind: horizontal slats with dark gaps and a slight per-slat tint.
export function sudarePixel(c) {
  return (u, v, env) => {
    const slats = 28;
    const f = (v * slats) % 1;
    const slat = Math.floor(v * slats);
    const gap = f < 0.14 ? -0.35 : 0;
    const shade = (hash2(slat, 3, 9) - 0.5) * 0.1 + (env.noiseB(u * 60, slat * 3) - 0.5) * 0.06;
    env.height = 0.5 + gap;
    return tint(c, 1 + gap + shade, 0.02);
  };
}

// Shop sign: a colored board with a few pale brush strokes.
export function signPixel(c) {
  return (u, v, env) => {
    const s1 = Math.abs(v - 0.28 - Math.sin(u * 9) * 0.03) < 0.035 && u > 0.15 && u < 0.85;
    const s2 = Math.abs(v - 0.5 - Math.cos(u * 7) * 0.03) < 0.03 && u > 0.25 && u < 0.8;
    const s3 = Math.abs(v - 0.72) < 0.035 && u > 0.2 && u < 0.7;
    const border = u < 0.05 || u > 0.95 || v < 0.05 || v > 0.95;
    const fine = (env.noiseB(u * 80, v * 80) - 0.5) * 0.06;
    let k = 1 + fine;
    if (s1 || s2 || s3) k = 1.9;
    if (border) k = 1.5;
    env.height = 0.5;
    return tint(c, k);
  };
}

// Paper lantern: warm paper with horizontal ribs.
export function lanternPixel(c) {
  return (u, v, env) => {
    const rib = Math.abs(Math.sin(v * Math.PI * 14)) > 0.93 ? -0.12 : 0;
    const fine = (env.noiseB(u * 60, v * 60) - 0.5) * 0.05;
    env.height = 0.5 + rib;
    return tint(c, 1 + rib + fine, 0.01);
  };
}

// Glazed ceramic: dark mottled glaze with a few lighter drips.
export function glazePixel(c) {
  return (u, v, env) => {
    const mottle = fbm(env.noise, u, v, 3, 3) - 0.5;
    const drip = env.noiseB(u * 14, v * 3) > 0.8 ? 0.25 : 0;
    const fine = (env.noiseC(u * 100, v * 100) - 0.5) * 0.06;
    env.height = 0.5 + mottle * 0.2;
    return tint(c, 1 + mottle * 0.25 + drip + fine, mottle * 0.04);
  };
}

// Registry of named albedo kinds: pixel function factory, tile size in metres, and whether the kind
// carries a height field for the normal and roughness maps.
export const KINDS = {
  stone: { pixel: stonePixel, metres: 1.4, height: true, size: 256 },
  rubble: { pixel: rubblePixel, metres: 1.0, height: true, size: 256 },
  wood: { pixel: (c) => woodPixel(c, 6), metres: 1.0, height: true, size: 256 },
  woodWide: { pixel: (c) => woodPixel(c, 3), metres: 1.0, height: true, size: 256 },
  plaster: { pixel: plasterPixel, metres: 2.0, height: true, size: 256 },
  kawara: { pixel: kawaraPixel, metres: 0.33, height: false, size: 64 },
  noren: { pixel: norenPixel, metres: 1, height: false, size: 2048 },
  sudare: { pixel: sudarePixel, metres: 1, height: false, size: 128 },
  sign: { pixel: signPixel, metres: 1, height: false, size: 128 },
  lantern: { pixel: lanternPixel, metres: 1, height: false, size: 128 },
  glaze: { pixel: glazePixel, metres: 1, height: true, size: 128 },
};

const cache = new Map();

// Textures for a kind at a mean color, cached: { map, normalMap?, roughnessMap? }.
export function texturesFor(kind, mean, { seed = 1 } = {}) {
  const key = `${kind}:${mean}:${seed}`;
  if (cache.has(key)) return cache.get(key);
  const spec = KINDS[kind];
  if (!spec) throw new Error(`unknown texture kind "${kind}"; known: ${Object.keys(KINDS).join(', ')}`);
  const c = rgbOf(mean);
  const { texture, heights, size } = makeAlbedo({ size: spec.size, seed, mean, pixel: spec.pixel(c), repeatMetres: spec.metres, height: spec.height });
  const out = { map: texture, metres: spec.metres };
  if (heights) {
    out.normalMap = normalMapFromHeights(heights, size, 2.0, spec.metres);
    out.roughnessMap = roughnessMapFromHeights(heights, size, 0.85, 0.12, spec.metres);
  }
  cache.set(key, out);
  return out;
}
