// Similarity metrics between two RGBA images of equal size.
//
// cellDistance: mean over a cols x rows grid of the Euclidean RGB distance between the two images'
//   per-cell mean colors, normalised so 1.0 is black versus white. Lower is better. Bound: it sees
//   only average color per cell, so texture and edges inside a cell are invisible to it.
// ssim: structural similarity of the grayscale images resampled to `width` px wide (aspect kept),
//   uniform 7x7 windows, population statistics, C1=(0.01*255)^2, C2=(0.03*255)^2. Higher is better.
//   Bound: at 64 px wide a feature must be about 10 photo pixels across to register at all.

export function cellMeans(rgba, w, h, cols, rows) {
  const sums = new Float64Array(cols * rows * 3);
  const counts = new Float64Array(cols * rows);
  for (let y = 0; y < h; y++) {
    const cy = Math.min(rows - 1, Math.floor((y * rows) / h));
    for (let x = 0; x < w; x++) {
      const cx = Math.min(cols - 1, Math.floor((x * cols) / w));
      const c = cy * cols + cx;
      const i = (y * w + x) * 4;
      sums[c * 3] += rgba[i];
      sums[c * 3 + 1] += rgba[i + 1];
      sums[c * 3 + 2] += rgba[i + 2];
      counts[c]++;
    }
  }
  for (let c = 0; c < cols * rows; c++) {
    sums[c * 3] /= counts[c];
    sums[c * 3 + 1] /= counts[c];
    sums[c * 3 + 2] /= counts[c];
  }
  return sums;
}

export function cellDistance(a, b, w, h, cols, rows) {
  const ma = cellMeans(a, w, h, cols, rows);
  const mb = cellMeans(b, w, h, cols, rows);
  const cells = new Float64Array(cols * rows);
  const norm = 255 * Math.sqrt(3);
  let sum = 0;
  for (let c = 0; c < cols * rows; c++) {
    const d = Math.hypot(ma[c * 3] - mb[c * 3], ma[c * 3 + 1] - mb[c * 3 + 1], ma[c * 3 + 2] - mb[c * 3 + 2]) / norm;
    cells[c] = d;
    sum += d;
  }
  return { cells, mean: sum / (cols * rows), cols, rows, meansA: ma, meansB: mb };
}

export function toGray(rgba, w, h) {
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  return g;
}

function areaWeights(srcSize, dstSize) {
  const table = [];
  for (let d = 0; d < dstSize; d++) {
    const s0 = (d * srcSize) / dstSize;
    const s1 = ((d + 1) * srcSize) / dstSize;
    const entries = [];
    for (let s = Math.floor(s0); s < Math.ceil(s1); s++) {
      const overlap = Math.min(s + 1, s1) - Math.max(s, s0);
      if (overlap > 0) entries.push([s, overlap]);
    }
    table.push(entries);
  }
  return table;
}

// Area-average resample of a single-channel image.
export function resizeArea(src, w, h, W, H) {
  const wx = areaWeights(w, W);
  const wy = areaWeights(h, H);
  const out = new Float32Array(W * H);
  for (let Y = 0; Y < H; Y++) {
    for (let X = 0; X < W; X++) {
      let sum = 0;
      let wsum = 0;
      for (const [y, fy] of wy[Y]) {
        for (const [x, fx] of wx[X]) {
          sum += src[y * w + x] * fx * fy;
          wsum += fx * fy;
        }
      }
      out[Y * W + X] = sum / wsum;
    }
  }
  return out;
}

export function ssim(a, b, W, H, win = 7) {
  const C1 = (0.01 * 255) ** 2;
  const C2 = (0.03 * 255) ** 2;
  const n = win * win;
  let total = 0;
  let count = 0;
  for (let y = 0; y + win <= H; y++) {
    for (let x = 0; x + win <= W; x++) {
      let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
      for (let j = 0; j < win; j++) {
        for (let i = 0; i < win; i++) {
          const pa = a[(y + j) * W + x + i];
          const pb = b[(y + j) * W + x + i];
          sa += pa; sb += pb; saa += pa * pa; sbb += pb * pb; sab += pa * pb;
        }
      }
      const ma = sa / n;
      const mb = sb / n;
      const va = saa / n - ma * ma;
      const vb = sbb / n - mb * mb;
      const cov = sab / n - ma * mb;
      total += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      count++;
    }
  }
  return total / count;
}

export function ssimGray(rgbaA, rgbaB, w, h, width = 64) {
  const height = Math.round((width * h) / w);
  const ga = resizeArea(toGray(rgbaA, w, h), w, h, width, height);
  const gb = resizeArea(toGray(rgbaB, w, h), w, h, width, height);
  return { value: ssim(ga, gb, width, height), width, height };
}
