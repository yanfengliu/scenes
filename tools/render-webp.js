// npm run webp: encode out/render.png as docs/render.webp, under the 256 KiB the repo allows for it.
//
// The encoder is chromium's own (canvas.toDataURL('image/webp')), so no dependency is added. It walks the
// quality down until the file fits, and refuses to write anything over the limit.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { launch } from './lib/browser.js';
import { fileToDataUrl } from './lib/image.js';

const SOURCE = 'out/render.png';
const OUT = 'docs/render.webp';
const LIMIT = 256 * 1024;
const WIDTH = 1200;

if (!existsSync(SOURCE)) {
  console.error(`FAIL: ${SOURCE} is missing; run npm run shot first`);
  process.exit(1);
}

const browser = await launch();
let failure = null;
try {
  const page = await browser.newPage();
  const dataUrl = fileToDataUrl(SOURCE);
  const result = await page.evaluate(
    async ({ url, width, limit }) => {
      const bmp = await createImageBitmap(await (await fetch(url)).blob());
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = Math.round((bmp.height / bmp.width) * width);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const tries = [];
      for (const quality of [0.92, 0.88, 0.84, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5]) {
        const encoded = canvas.toDataURL('image/webp', quality);
        const bytes = Math.floor((encoded.length - encoded.indexOf(',') - 1) * 0.75);
        tries.push({ quality, bytes });
        if (bytes <= limit) return { encoded, quality, bytes, tries, width: canvas.width, height: canvas.height };
      }
      return { tries, width: canvas.width, height: canvas.height };
    },
    { url: dataUrl, width: WIDTH, limit: LIMIT },
  );
  if (!result.encoded) {
    throw new Error(`could not get under ${LIMIT} bytes; smallest was ${Math.min(...result.tries.map((t) => t.bytes))}`);
  }
  const buffer = Buffer.from(result.encoded.slice(result.encoded.indexOf(',') + 1), 'base64');
  if (buffer.length > LIMIT) throw new Error(`encoded file is ${buffer.length} bytes, over the ${LIMIT} limit`);
  mkdirSync('docs', { recursive: true });
  writeFileSync(OUT, buffer);
  console.log(`wrote ${OUT} (${result.width}x${result.height}, quality ${result.quality}, ${(buffer.length / 1024).toFixed(1)} KiB of ${LIMIT / 1024} KiB)`);
} catch (err) {
  failure = err;
} finally {
  await browser.close();
}
if (failure) {
  console.error(`FAIL: ${failure.message}`);
  process.exit(1);
}
