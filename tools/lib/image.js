// Image decoding through the browser (chromium's libwebp/libpng), returned as raw RGBA bytes.
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const MIME = { '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

export function fileToDataUrl(filePath) {
  const mime = MIME[extname(filePath).toLowerCase()];
  if (!mime) throw new Error(`unsupported image extension on ${filePath}; expected one of ${Object.keys(MIME).join(', ')}`);
  return `data:${mime};base64,${readFileSync(filePath).toString('base64')}`;
}

// Decode filePath and resample it to width x height (area-quality filter). Returns { data: Uint8Array RGBA, width, height, srcWidth, srcHeight }.
export async function decodeImage(page, filePath, { width, height }) {
  const out = await page.evaluate(async ({ dataUrl, width, height }) => {
    const blob = await (await fetch(dataUrl)).blob();
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, width, height);
    const data = ctx.getImageData(0, 0, width, height).data;
    let s = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < data.length; i += CHUNK) s += String.fromCharCode.apply(null, data.subarray(i, i + CHUNK));
    return { b64: btoa(s), srcWidth: bmp.width, srcHeight: bmp.height };
  }, { dataUrl: fileToDataUrl(filePath), width, height });
  return { data: new Uint8Array(Buffer.from(out.b64, 'base64')), width, height, srcWidth: out.srcWidth, srcHeight: out.srcHeight };
}

export function pngDataUrlToBuffer(dataUrl) {
  const prefix = 'data:image/png;base64,';
  if (!dataUrl.startsWith(prefix)) throw new Error('expected a PNG data URL from canvas.toDataURL');
  return Buffer.from(dataUrl.slice(prefix.length), 'base64');
}
