// npm run compare: score out/render.png against japan.webp and write the comparison sheets.
//
// Prints two scores (see tools/lib/metrics.js for their bounds):
//   cell color distance  mean over a 24x22 grid of the per-cell mean-color distance, 0..1, lower is better
//   ssim                 grayscale SSIM at 64 px wide, -1..1, higher is better
// Writes out/compare.png  photo | render | 50% overlay | heat-map, four 600x550 panels side by side
//        out/overlay.png  render at 50% over the photo at 1200x1100 with a 0.1 grid and the plan's
//                         landmark boxes, for checking each landmark's position
//        out/scores.json  the scores plus the per-cell distances, read by npm test
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { launch } from './lib/browser.js';
import { decodeImage, fileToDataUrl, pngDataUrlToBuffer } from './lib/image.js';
import { cellDistance, ssimGray } from './lib/metrics.js';
import { LANDMARK_MARKS, PHOTO, SHOT } from '../src/layout.js';

const PHOTO_PATH = 'japan.webp';
const RENDER_PATH = 'out/render.png';
const COLS = 24;
const ROWS = 22;
const W = PHOTO.width;
const H = PHOTO.height;

function meansToHex(means) {
  const out = [];
  for (let i = 0; i < means.length; i += 3) {
    out.push('#' + [means[i], means[i + 1], means[i + 2]].map((c) => Math.round(c).toString(16).padStart(2, '0')).join(''));
  }
  return out;
}

if (!existsSync(RENDER_PATH)) {
  console.error(`FAIL: ${RENDER_PATH} is missing; run npm run shot first`);
  process.exit(1);
}

// A score is a claim about the current scene: refuse a render older than any source file, so a failed
// or skipped shot can never be scored as if it had succeeded.
const sources = ['index.html', ...readdirSync('src').map((f) => `src/${f}`)];
const newest = sources.map((f) => ({ f, mtime: statSync(f).mtimeMs })).sort((a, b) => b.mtime - a.mtime)[0];
const renderMtime = statSync(RENDER_PATH).mtimeMs;
if (renderMtime < newest.mtime) {
  const age = ((newest.mtime - renderMtime) / 1000).toFixed(1);
  console.error(`FAIL: ${RENDER_PATH} is ${age} s older than ${newest.f}; run npm run shot so the score is of the current scene`);
  process.exit(1);
}

const browser = await launch();
let failure = null;
try {
  const page = await browser.newPage();
  const photo = await decodeImage(page, PHOTO_PATH, { width: W, height: H });
  const render = await decodeImage(page, RENDER_PATH, { width: W, height: H });
  if (photo.srcWidth !== W || photo.srcHeight !== H) throw new Error(`${PHOTO_PATH} is ${photo.srcWidth}x${photo.srcHeight}, expected ${W}x${H}`);
  if (render.srcWidth !== SHOT.width || render.srcHeight !== SHOT.height) {
    throw new Error(`${RENDER_PATH} is ${render.srcWidth}x${render.srcHeight}, expected ${SHOT.width}x${SHOT.height}`);
  }

  const cells = cellDistance(photo.data, render.data, W, H, COLS, ROWS);
  const ssim = ssimGray(photo.data, render.data, W, H, 64);

  const sheets = await page.evaluate(
    async ({ photoUrl, renderUrl, W, H, cols, rows, cellValues, marks, shotW, shotH }) => {
      const load = async (url) => createImageBitmap(await (await fetch(url)).blob());
      const photoBmp = await load(photoUrl);
      const renderBmp = await load(renderUrl);

      // compare.png: photo | render | overlay | heat-map
      const sheet = document.createElement('canvas');
      sheet.width = W * 4;
      sheet.height = H;
      const ctx = sheet.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(photoBmp, 0, 0, W, H);
      ctx.drawImage(renderBmp, W, 0, W, H);
      ctx.drawImage(photoBmp, W * 2, 0, W, H);
      ctx.globalAlpha = 0.5;
      ctx.drawImage(renderBmp, W * 2, 0, W, H);
      ctx.globalAlpha = 1;
      const stops = [
        [0.0, [16, 16, 48]],
        [0.1, [40, 60, 160]],
        [0.2, [180, 40, 90]],
        [0.32, [240, 140, 40]],
        [0.45, [255, 240, 120]],
        [0.6, [255, 255, 255]],
      ];
      const colormap = (d) => {
        for (let i = 1; i < stops.length; i++) {
          if (d <= stops[i][0]) {
            const t = (d - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
            const a = stops[i - 1][1];
            const b = stops[i][1];
            return `rgb(${a.map((c, k) => Math.round(c + (b[k] - c) * t)).join(',')})`;
          }
        }
        return 'rgb(255,255,255)';
      };
      const cw = W / cols;
      const ch = H / rows;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.fillStyle = colormap(cellValues[r * cols + c]);
          ctx.fillRect(W * 3 + Math.floor(c * cw), Math.floor(r * ch), Math.ceil(cw), Math.ceil(ch));
        }
      }

      // overlay.png: render at 50% over the photo at shot size, with a grid and the landmark marks.
      const ov = document.createElement('canvas');
      ov.width = shotW;
      ov.height = shotH;
      const o = ov.getContext('2d');
      o.imageSmoothingEnabled = true;
      o.imageSmoothingQuality = 'high';
      o.drawImage(photoBmp, 0, 0, shotW, shotH);
      o.globalAlpha = 0.5;
      o.drawImage(renderBmp, 0, 0, shotW, shotH);
      o.globalAlpha = 1;
      o.font = '14px sans-serif';
      o.lineWidth = 1;
      for (let i = 1; i < 10; i++) {
        o.strokeStyle = 'rgba(255,255,255,0.35)';
        o.beginPath();
        o.moveTo((i / 10) * shotW, 0);
        o.lineTo((i / 10) * shotW, shotH);
        o.moveTo(0, (i / 10) * shotH);
        o.lineTo(shotW, (i / 10) * shotH);
        o.stroke();
        o.fillStyle = 'rgba(255,255,255,0.9)';
        o.fillText(`${i / 10}`, (i / 10) * shotW + 3, 14);
        o.fillText(`${i / 10}`, 3, (i / 10) * shotH - 3);
      }
      const X = (u) => u * shotW;
      const Y = (v) => v * shotH;
      o.lineWidth = 2;
      for (const m of marks) {
        o.strokeStyle = 'rgba(255,230,0,0.95)';
        o.fillStyle = 'rgba(255,230,0,0.95)';
        if (m.kind === 'box') {
          o.strokeRect(X(m.u0), Y(m.v0), X(m.u1) - X(m.u0), Y(m.v1) - Y(m.v0));
          o.fillText(m.name, X(m.u0) + 4, Y(m.v0) + 16);
        } else if (m.kind === 'point') {
          o.beginPath();
          o.arc(X(m.u), Y(m.v), 6, 0, Math.PI * 2);
          o.stroke();
          o.fillText(m.name, X(m.u) + 9, Y(m.v) + 5);
        } else if (m.kind === 'hline') {
          o.strokeStyle = 'rgba(0,255,255,0.95)';
          o.fillStyle = 'rgba(0,255,255,0.95)';
          o.beginPath();
          o.moveTo(0, Y(m.v));
          o.lineTo(shotW, Y(m.v));
          o.stroke();
          o.fillText(m.name, shotW - 70, Y(m.v) - 4);
        } else if (m.kind === 'vline') {
          o.beginPath();
          o.moveTo(X(m.u), Y(m.v0));
          o.lineTo(X(m.u), Y(m.v1));
          o.stroke();
          o.fillText(m.name, X(m.u) + 6, Y(m.v0) + 14);
        } else if (m.kind === 'polyline') {
          o.strokeStyle = 'rgba(0,255,255,0.95)';
          o.fillStyle = 'rgba(0,255,255,0.95)';
          o.beginPath();
          m.points.forEach(([u, v], i) => (i ? o.lineTo(X(u), Y(v)) : o.moveTo(X(u), Y(v))));
          o.stroke();
          o.fillText(m.name, X(m.points[0][0]) + 6, Y(m.points[0][1]) + 16);
        }
      }
      return { compare: sheet.toDataURL('image/png'), overlay: ov.toDataURL('image/png') };
    },
    {
      photoUrl: fileToDataUrl(PHOTO_PATH),
      renderUrl: fileToDataUrl(RENDER_PATH),
      W,
      H,
      cols: COLS,
      rows: ROWS,
      cellValues: Array.from(cells.cells),
      marks: LANDMARK_MARKS,
      shotW: SHOT.width,
      shotH: SHOT.height,
    },
  );

  mkdirSync('out', { recursive: true });
  writeFileSync('out/compare.png', pngDataUrlToBuffer(sheets.compare));
  writeFileSync('out/overlay.png', pngDataUrlToBuffer(sheets.overlay));
  const scores = {
    cellDistance: cells.mean,
    ssim: ssim.value,
    grid: { cols: COLS, rows: ROWS },
    ssimSize: { width: ssim.width, height: ssim.height },
    cells: Array.from(cells.cells, (d) => Number(d.toFixed(4))),
    cellsPhoto: meansToHex(cells.meansA),
    cellsRender: meansToHex(cells.meansB),
    renderedAt: new Date().toISOString(),
  };
  writeFileSync('out/scores.json', JSON.stringify(scores, null, 2));
  console.log(`cell color distance (24x22 grid, lower is better): ${cells.mean.toFixed(4)}`);
  console.log(`grayscale SSIM at 64 px (higher is better): ${ssim.value.toFixed(4)}`);
  console.log('wrote out/compare.png, out/overlay.png, out/scores.json');
} catch (err) {
  failure = err;
} finally {
  await browser.close();
}
if (failure) {
  console.error(`FAIL: ${failure.message}`);
  process.exit(1);
}
