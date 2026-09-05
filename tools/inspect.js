// npm run inspect -- <mode> ...: look at the photo and the render up close. Diagnostic, not a gate.
//   crop u0 v0 u1 v1 [scale] [name]    crop a region of the photo (or IMG=path) scaled up -> out/<name>.png
//   pair u0 v0 u1 v1 [scale] [name]    the same region from the photo and out/render.png side by side
//   sample name:u0,v0,u1,v1 ...        mean sRGB color of each box in the photo (or IMG=path)
// Coordinates are fractions of the frame, u right and v down, as in src/layout.js.
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './lib/browser.js';
import { decodeImage, fileToDataUrl, pngDataUrlToBuffer } from './lib/image.js';
import { PHOTO } from '../src/layout.js';

const PHOTO_PATH = 'japan.webp';
const RENDER_PATH = 'out/render.png';
const IMG = process.env.IMG || PHOTO_PATH;
const [mode, ...rest] = process.argv.slice(2);

function usage() {
  console.error('usage: npm run inspect -- crop|pair u0 v0 u1 v1 [scale] [name]  |  sample name:u0,v0,u1,v1 ...');
  process.exit(1);
}
if (!['crop', 'pair', 'sample'].includes(mode)) usage();

const browser = await launch();
const page = await browser.newPage();
try {
  if (mode === 'crop' || mode === 'pair') {
    const box = rest.slice(0, 4).map(Number);
    if (box.length !== 4 || box.some(Number.isNaN)) usage();
    const [u0, v0, u1, v1] = box;
    const scale = Number(rest[4] || 3);
    const name = rest[5] || `${mode}_${u0}_${v0}_${u1}_${v1}`;
    const sources = mode === 'pair' ? [IMG, RENDER_PATH] : [IMG];
    const dataUrl = await page.evaluate(
      async ({ srcs, u0, v0, u1, v1, scale, W, H }) => {
        const bitmaps = [];
        for (const s of srcs) bitmaps.push(await createImageBitmap(await (await fetch(s)).blob()));
        const outW = Math.round((u1 - u0) * W * scale);
        const outH = Math.round((v1 - v0) * H * scale);
        const gap = srcs.length > 1 ? 6 : 0;
        const canvas = document.createElement('canvas');
        canvas.width = outW * srcs.length + gap * (srcs.length - 1);
        canvas.height = outH;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        bitmaps.forEach((bmp, i) => {
          ctx.drawImage(bmp, u0 * bmp.width, v0 * bmp.height, (u1 - u0) * bmp.width, (v1 - v0) * bmp.height, i * (outW + gap), 0, outW, outH);
        });
        return canvas.toDataURL('image/png');
      },
      { srcs: sources.map(fileToDataUrl), u0, v0, u1, v1, scale, W: PHOTO.width, H: PHOTO.height },
    );
    mkdirSync('out', { recursive: true });
    const out = `out/${name}.png`;
    writeFileSync(out, pngDataUrlToBuffer(dataUrl));
    console.log(`wrote ${out}`);
  } else {
    if (!rest.length) usage();
    const img = await decodeImage(page, IMG, { width: PHOTO.width, height: PHOTO.height });
    for (const spec of rest) {
      const [name, coords] = spec.split(':');
      const box = (coords || '').split(',').map(Number);
      if (box.length !== 4 || box.some(Number.isNaN)) usage();
      const [u0, v0, u1, v1] = box;
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      const x0 = Math.round(u0 * PHOTO.width);
      const x1 = Math.round(u1 * PHOTO.width);
      const y0 = Math.round(v0 * PHOTO.height);
      const y1 = Math.round(v1 * PHOTO.height);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * PHOTO.width + x) * 4;
          r += img.data[i];
          g += img.data[i + 1];
          b += img.data[i + 2];
          n++;
        }
      }
      const hex = (v) => Math.round(v / n).toString(16).padStart(2, '0');
      console.log(`${name.padEnd(16)} #${hex(r)}${hex(g)}${hex(b)}  rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})  [${u0},${v0}-${u1},${v1}]`);
    }
  }
} finally {
  await browser.close();
}
