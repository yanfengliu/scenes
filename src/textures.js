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
//
// A steepness-proportional roughness boost (raise roughness where the normal map's slope is highest, the
// textbook remedy for specular sparkle from a bump map) was tried here and measured out at three
// strengths, from a per-texel term capped at +0.35 to a near-uniform +1.2 saturating almost every non-flat
// texel: mean shimmer moved by less than 0.3% each time (3.158 to 3.155 to 3.150 to 3.147, on the same
// path that separately went to 3.031, a real 4.5% drop, when the normal map was removed outright). That
// gap says the earlier drop was not a roughness effect: these materials are non-metallic (metalness 0) and
// diffuse-dominant, and roughness only narrows or widens the specular lobe, while a bumpy normal feeding
// straight into the Lambert term (N.L) aliases the diffuse shading regardless of roughness. The standard
// remedy for specular sparkle does not reach that, and removing the normal map to chase the 4.5% would be
// the "no normal maps" false fix this family warns against, so this is left as it shipped, with the finding
// recorded rather than a change that measurably does nothing.
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
// Bark: vertical fissures and streaks, darker in the furrows.
export function barkPixel(c) {
  return (u, v, env) => {
    const streak = env.noise(u * 40, v * 4);
    const fissure = env.noiseB(u * 18 + v * 0.5, v * 2.5);
    const fine = (env.noiseC(u * 120, v * 60) - 0.5) * 0.12;
    let k = 0.85 + (streak - 0.5) * 0.5 + fine;
    if (fissure < 0.32) k -= 0.3 * (1 - fissure / 0.32);
    env.height = 0.5 + (streak - 0.5) * 0.4 - (fissure < 0.32 ? 0.3 : 0);
    return tint(c, k);
  };
}

export const KINDS = {
  bark: { pixel: barkPixel, metres: 1.2, height: true, size: 256 },
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

// ---- foliage cards -------------------------------------------------------------------------------
// Card textures are drawn with canvas calls: white-ish shapes with alpha on a transparent ground, so the
// instance color carries the mean and one texture serves every tint. `makeCard` returns the texture and
// the linear-space mean brightness of its opaque texels (alpha over 0.5, the alpha test), so callers
// divide their colors by it and the visible mean lands on the intended color.

function drawSoftDisc(ctx, x, y, r, shade, alphaCentre = 1, alphaEdge = 0, rim = null) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  const c = Math.round(255 * shade);
  g.addColorStop(0, `rgba(255,255,255,${alphaCentre})`);
  g.addColorStop(0.6, `rgba(${c},${c},${c},${(alphaCentre + alphaEdge) / 2})`);
  if (rim) g.addColorStop(0.82, `rgba(${rim[0]},${rim[1]},${rim[2]},${(alphaCentre + alphaEdge) / 2})`);
  g.addColorStop(1, `rgba(${c},${c},${c},${alphaEdge})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

const grey = (shade, alpha = 1) => `rgba(${Math.round(255 * shade)},${Math.round(255 * shade)},${Math.round(255 * shade)},${alpha})`;

// A blossom cluster: soft petal discs around the centre, a little darker toward their middles with a
// warm light rim where the low sun comes through the petals (the back-lit rim tint), and three faint
// stamen dots. Its opaque area is about 55% of the card; the instance color carries the mean.
function blossomCard(ctx, s, rand) {
  const n = 5 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.6;
    const d = s * (0.1 + rand() * 0.15);
    drawSoftDisc(ctx, s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d, s * (0.15 + rand() * 0.08), 0.84, 1, 0, [255, 248, 236]);
  }
  drawSoftDisc(ctx, s / 2, s / 2, s * 0.18, 1.0);
  ctx.fillStyle = 'rgba(120,70,95,0.5)';
  for (let i = 0; i < 3; i++) {
    const a = rand() * Math.PI * 2;
    const d = s * 0.08 * rand();
    ctx.beginPath();
    ctx.arc(s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d, s * 0.008, 0, Math.PI * 2);
    ctx.fill();
  }
}

// A needle cluster: a dense core so the card survives minification, with needles fanning out of it.
function needleCard(ctx, s, rand) {
  drawSoftDisc(ctx, s / 2, s * 0.58, s * 0.3, 0.7, 1, 0);
  ctx.lineCap = 'round';
  for (let i = 0; i < 60; i++) {
    const a = -Math.PI / 2 + (rand() - 0.5) * 3.0;
    const len = s * (0.18 + rand() * 0.28);
    const x0 = s / 2 + (rand() - 0.5) * s * 0.4;
    const y0 = s * (0.5 + rand() * 0.4);
    ctx.strokeStyle = grey(0.7 + rand() * 0.3);
    ctx.lineWidth = s * 0.03;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + Math.cos(a) * len, y0 + Math.sin(a) * len);
    ctx.stroke();
  }
}

// A leaf cluster: oval leaves around a soft core.
function leafCard(ctx, s, rand) {
  drawSoftDisc(ctx, s / 2, s / 2, s * 0.26, 0.75, 1, 0);
  for (let i = 0; i < 11; i++) {
    const a = rand() * Math.PI * 2;
    const d = s * (0.12 + rand() * 0.22);
    const x = s / 2 + Math.cos(a) * d;
    const y = s / 2 + Math.sin(a) * d;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a + Math.PI / 2 + (rand() - 0.5) * 0.6);
    ctx.fillStyle = grey(0.75 + rand() * 0.3);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * (0.1 + rand() * 0.05), s * (0.055 + rand() * 0.03), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// A tuft of grass blades fanning up from the bottom centre.
function grassCard(ctx, s, rand) {
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (rand() - 0.5) * 1.5;
    const len = s * (0.55 + rand() * 0.4);
    const x0 = s / 2 + (rand() - 0.5) * s * 0.2;
    const tipX = x0 + Math.cos(a) * len;
    const tipY = s - Math.sin(-a) * len;
    ctx.fillStyle = grey(0.7 + rand() * 0.3);
    ctx.beginPath();
    ctx.moveTo(x0 - s * 0.03, s);
    ctx.lineTo(x0 + s * 0.03, s);
    ctx.lineTo(tipX, tipY);
    ctx.closePath();
    ctx.fill();
  }
}

// A moss patch: an irregular soft blob with darker pits and lighter speckles.
function mossCard(ctx, s, rand) {
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2;
    const d = s * 0.22 * rand();
    drawSoftDisc(ctx, s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d * 0.6, s * (0.14 + rand() * 0.12), 0.7 + rand() * 0.35, 1, 0);
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = grey(rand() < 0.5 ? 0.55 : 1.0);
    ctx.beginPath();
    ctx.arc(s / 2 + jitterS(rand, s * 0.3), s / 2 + jitterS(rand, s * 0.2), s * 0.012, 0, Math.PI * 2);
    ctx.fill();
  }
}
const jitterS = (rand, amount) => (rand() - 0.5) * 2 * amount;

const CARDS = { blossom: blossomCard, needles: needleCard, leaves: leafCard, grass: grassCard, moss: mossCard };
const cardCache = new Map();

// ---- coverage-preserving mipmaps -----------------------------------------------------------------
// A card is alpha-tested at 0.5 (0.4 for moss), and its coverage - the fraction of its texels that pass -
// is exact at the base level (a blossom cluster is drawn to be about 55% opaque). Plain box-filtered
// mipmapping (gl.generateMipmap, what a CanvasTexture gets by default) does not preserve that fraction: a
// bright disc averaged toward a transparent ground loses alpha faster than it loses area, so a distant,
// minified card can fall under the test almost everywhere well before its silhouette should vanish - and
// since the mip level sampled drifts continuously with camera distance, a card near that crossover flickers
// whole and gone as the camera moves by fractions of a pixel. Rescaling each mip's alpha so its own
// coverage fraction matches the base level's, at every size down to 1x1, is the standard fix (mipmapping
// with alpha test coverage). It needs the mips supplied by hand: three only takes manual mip data for a
// DataTexture, not a CanvasTexture, which is why `cardTexture` builds one below instead of letting the GPU
// generate mips on its own.

// A 2x2 box filter, one level smaller (each dimension halved, rounding up on an odd size though every
// card here is a power of two so this always halves exactly).
function downsample2x(data, w, h) {
  const nw = Math.max(1, w >> 1);
  const nh = Math.max(1, h >> 1);
  const out = new Uint8Array(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const x0 = x * 2;
      const y0 = y * 2;
      const x1 = Math.min(w - 1, x0 + 1);
      const y1 = Math.min(h - 1, y0 + 1);
      const samples = [y0 * w + x0, y0 * w + x1, y1 * w + x0, y1 * w + x1];
      const o = (y * nw + x) * 4;
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (const s of samples) sum += data[s * 4 + c];
        out[o + c] = Math.round(sum / samples.length);
      }
    }
  }
  return { data: out, width: nw, height: nh };
}

// The fraction of `n` texels whose alpha, scaled by `scale`, reaches `thresholdByte` (0..255).
function coverageFraction(data, n, thresholdByte, scale = 1) {
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (Math.min(255, data[i * 4 + 3] * scale) >= thresholdByte) count++;
  }
  return count / n;
}

// The alpha multiplier that brings this level's coverage up to `target` (bisection: coverage is
// monotonic non-decreasing in scale, since raising every texel's alpha can only add texels to the count,
// never remove one). Capped at `maxScale`, so a mip with almost no content left (a stray bright corner)
// is not blown out chasing a fraction it no longer has enough texels to reach.
function solveCoverageScale(data, n, thresholdByte, target, maxScale = 48) {
  if (coverageFraction(data, n, thresholdByte) >= target) return 1;
  let lo = 1;
  let hi = maxScale;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (coverageFraction(data, n, thresholdByte, mid) < target) lo = mid;
    else hi = mid;
  }
  return hi;
}

// Level 0 is `baseData` untouched (cloned); every level after is a box-filtered downsample with its alpha
// rescaled to match the base level's own coverage fraction at `alphaTest`, down to 1x1. Colors are left to
// average plainly: card art never puts pure black behind a transparent edge (see the fringe fix below),
// so a plain box filter does not pull dark halos in around a shrinking disc.
function buildCoverageMips(baseData, size, alphaTest) {
  const thresholdByte = Math.round(alphaTest * 255);
  const baseCoverage = coverageFraction(baseData, size * size, thresholdByte);
  const levels = [{ data: new Uint8Array(baseData), width: size, height: size }];
  let level = levels[0];
  while (level.width > 1 || level.height > 1) {
    const next = downsample2x(level.data, level.width, level.height);
    const n = next.width * next.height;
    const scale = solveCoverageScale(next.data, n, thresholdByte, baseCoverage);
    if (scale !== 1) {
      for (let i = 0; i < n; i++) {
        const o = i * 4 + 3;
        next.data[o] = Math.min(255, Math.round(next.data[o] * scale));
      }
    }
    levels.push(next);
    level = next;
  }
  return levels;
}

// The card texture for a kind: { texture, mean } with `mean` the linear-space mean of its opaque texels.
// `alphaTest` must match what the material tests against (foliageMaterial defaults to 0.5; moss uses 0.4),
// since it is also the coverage fraction the mip chain preserves.
export function cardTexture(kind, { seed = 1, size = 128, alphaTest = 0.5 } = {}) {
  const key = `${kind}:${seed}:${size}:${alphaTest}`;
  if (cardCache.has(key)) return cardCache.get(key);
  const draw = CARDS[kind];
  if (!draw) throw new Error(`unknown card kind "${kind}"; known: ${Object.keys(CARDS).join(', ')}`);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  draw(ctx, size, mulberry32(seed));
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  // A texel that survives the alpha test carries the card's shape, and the instance color carries the
  // hue, so a petal must never be black: compositing soft discs over a transparent ground leaves dark
  // fringes where the coverage was partial, and those fringes render as black specks in the canopy.
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] <= 127) continue;
    const lift = Math.max(d[i], d[i + 1], d[i + 2]);
    if (lift >= 90) continue;
    const k = lift > 4 ? 90 / lift : 0;
    for (let c = 0; c < 3; c++) d[i + c] = lift > 4 ? Math.round(d[i + c] * k) : 90;
  }
  ctx.putImageData(img, 0, 0);
  let sum = 0;
  let n = 0;
  const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] <= 127) continue;
    sum += (toLinear(d[i] / 255) + toLinear(d[i + 1] / 255) + toLinear(d[i + 2] / 255)) / 3;
    n++;
  }
  const mipLevels = buildCoverageMips(d, size, alphaTest);
  const texture = new THREE.DataTexture(mipLevels[0].data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.mipmaps = mipLevels;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  // DataTexture defaults flipY to false (raw buffers are assumed GL-native already); CanvasTexture, which
  // this replaces, defaults it to true, and every card's UVs and instancing were built against that.
  texture.flipY = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  const out = { texture, mean: n ? sum / n : 1, coverage: n / (size * size) };
  cardCache.set(key, out);
  return out;
}

// ---- the hill ------------------------------------------------------------------------------------
// A texture whose rows follow the photo's rows between vTop and vBottom: each row's mean is the color the
// gradient stops give at that photo row (exact, corrected per row), modulated by a tree-clump pattern
// (rounded crowns lighter on their sun side, dark between). Not tiled; the hill mesh maps photo v to it.
export function makeHillTexture({ size = 256, seed = 7, stops, vTop, vBottom, sunU = 0.62, glareWidth = 0.16 }) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const noiseB = noise2D(seed + 11);
  // Tree crowns: one jittered point per cell of a 760x420 grid (about 1 m on the hill, which is what the
  // photo's grain shows at this distance); each texel belongs to its nearest point.
  // Inside a crown the sun side (toward +u, up) is light and the far side dark; between crowns, dark gaps.
  const CW = 760;
  const CH = 420;
  const rand = mulberry32(seed);
  const px = new Float32Array(CW * CH);
  const py = new Float32Array(CW * CH);
  const pr = new Float32Array(CW * CH);
  for (let i = 0; i < CW * CH; i++) {
    px[i] = rand();
    py[i] = rand();
    pr[i] = 0.45 + rand() * 0.3;
  }
  const crown = (u, v) => {
    const cx = u * CW;
    const cy = v * CH;
    const ci = Math.floor(cx);
    const cj = Math.floor(cy);
    let best = Infinity;
    let bx = 0;
    let by = 0;
    let br = 0.5;
    for (let j = cj - 1; j <= cj + 1; j++) {
      for (let i = ci - 1; i <= ci + 1; i++) {
        const ii = ((i % CW) + CW) % CW;
        const jj = ((j % CH) + CH) % CH;
        const k = jj * CW + ii;
        const dx = cx - (i + px[k]);
        const dy = cy - (j + py[k]);
        const d = dx * dx + dy * dy;
        if (d < best) {
          best = d;
          bx = dx;
          by = dy;
          br = pr[k];
        }
      }
    }
    const d = Math.sqrt(best);
    if (d > br) return 0.55;
    const lit = (bx * 0.6 - by * 0.8) / br; // -1 on the shaded side, +1 on the lit side
    return 0.85 + 0.3 * lit + 0.15 * (1 - d / br);
  };
  const colorAt = (v) => {
    let k = 1;
    while (k < stops.length - 1 && v > stops[k][0]) k++;
    const [v0, c0] = stops[k - 1];
    const [v1, c1] = stops[k];
    const t = Math.max(0, Math.min(1, (v - v0) / (v1 - v0)));
    const a = rgbOf(c0);
    const b = rgbOf(c1);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  };
  // The warm band under the ridge is the sun's glare washing over it, so it belongs near the sun's own
  // column and nowhere else: away from it the hill is its dark green at every row. Before this the band
  // ran the whole width and the hill beside the sun read 0.10 too bright in the cells at u 0.72 to 0.80.
  const glareAt = (u) => Math.exp(-(((u - sunU) / glareWidth) ** 2));
  for (let y = 0; y < size; y++) {
    const v = vTop + ((vBottom - vTop) * (y + 0.5)) / size;
    const target = colorAt(v);
    const deep = colorAt(vBottom);
    const row = new Float32Array(size);
    let mean = 0;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const vv = y / size;
      // Crowns about 5 m across on the hill, over slower undulations of the slope beneath.
      const big = noiseB(u * 9, vv * 6);
      let k = crown(u, vv) + (big - 0.5) * 0.3;
      row[x] = k;
      mean += k;
    }
    mean /= size;
    for (let x = 0; x < size; x++) {
      const k = row[x] / mean;
      const g = glareAt(x / size);
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) d[i + c] = clamp255(Math.round((deep[c] + (target[c] - deep[c]) * g) * k));
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  return texture;
}
