// Paint check: does the renderer paint the WHOLE canvas?
//
// A user photographed a real browser window showing the scene rendered correctly across the top and down
// the left, and a hard-edged rectangle of flat #1a1c24 filling the rest. #1a1c24 is the page background
// from index.html, so that rectangle is canvas the renderer never wrote to, not a dark part of the scene.
// A dark render and an unpainted region look alike in a screenshot and are completely different faults,
// so this tool separates them by colour: it finds the bounding box of everything that is NOT exactly the
// page background, and compares that box with the drawing buffer.
//
// It drives real window resizes, because that is the operation that can leave the renderer's idea of its
// size disagreeing with the canvas, and the reported symptom appeared while the user was working in an
// ordinary resizable window.
//
// BOUNDS: it keys on one exact colour, so a fault that paints a region some other flat colour reads as
// painted. It resizes through the list below, so a size sequence not in that list is untested. It looks
// at one frame after each resize, plus one after a settle, so a fault that needs many frames is missed.
import { mkdirSync, writeFileSync } from 'node:fs';
import { startServer } from './serve.js';
import { launch, collectErrors, openScene } from './lib/browser.js';

// The page background from index.html. Unpainted canvas shows exactly this.
export const PAGE_BG = [0x1a, 0x1c, 0x24];
// How much of the canvas may be exactly the page background before it counts as unpainted. The scene
// itself effectively never lands on this precise triple.
export const BG_LIMIT = 2;

// Grow, shrink, change aspect hard, and change device pixel ratio. Real windows do all of these.
export const STEPS = [
  { w: 1280, h: 720, dpr: 1.5, note: 'start' },
  { w: 1600, h: 900, dpr: 1.5, note: 'grow' },
  { w: 1000, h: 1400, dpr: 1.5, note: 'tall, a hard aspect change' },
  { w: 1935, h: 1900, dpr: 1, note: 'large and nearly square, as the reported window was' },
  { w: 700, h: 500, dpr: 1, note: 'shrink hard' },
  { w: 1366, h: 768, dpr: 2, note: 'and a denser display' },
  { w: 1367, h: 769, dpr: 2, note: 'one pixel larger, an odd size' },
];

async function look(page) {
  return await page.evaluate(({ bg }) => {
    const s = window.__scene, r = s.renderer, gl = r.getContext(), c = r.domElement;
    s.render();
    const w = c.width, h = c.height;
    const b = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b);
    // readPixels is bottom-up; convert the box to top-down so it reads like the screenshot.
    let minX = w, minY = h, maxX = -1, maxY = -1, bgCount = 0;
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      const isBg = b[o] === bg[0] && b[o + 1] === bg[1] && b[o + 2] === bg[2];
      if (isBg) { bgCount++; continue; }
      const x = i % w, yUp = (i / w) | 0, y = h - 1 - yUp;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const vp = new s.THREE.Vector4();
    r.getViewport(vp);
    const db = r.getDrawingBufferSize(new s.THREE.Vector2());
    const sz = r.getSize(new s.THREE.Vector2());
    return {
      buffer: [w, h],
      paintedBox: maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
      bgPct: +((100 * bgCount) / (w * h)).toFixed(2),
      canvasCSS: [c.clientWidth, c.clientHeight],
      inner: [window.innerWidth, window.innerHeight],
      dpr: window.devicePixelRatio,
      rendererPixelRatio: r.getPixelRatio(),
      rendererSize: [sz.x, sz.y],
      drawingBuffer: [db.x, db.y],
      viewport: [vp.x, vp.y, vp.z, vp.w],
      composer: [s.composer._width, s.composer._height],
      rt: [s.composer.renderTarget1.width, s.composer.renderTarget1.height],
      samples: s.composer.renderTarget1.samples,
    };
  }, { bg: PAGE_BG });
}

function line(label, r) {
  const box = r.paintedBox ? `${r.paintedBox.w}x${r.paintedBox.h}@${r.paintedBox.x},${r.paintedBox.y}` : 'nothing painted';
  const covers = r.paintedBox && r.paintedBox.w === r.buffer[0] && r.paintedBox.h === r.buffer[1] ? 'full' : 'PARTIAL';
  return `${label.padEnd(34)} buffer ${r.buffer.join('x').padEnd(10)} painted ${box.padEnd(22)} ${covers.padEnd(8)} bg ${String(r.bgPct).padStart(6)}%  vp ${r.viewport.join(',')}  comp ${r.composer.join('x')}`;
}

export async function run({ gpu = true, steps = STEPS } = {}) {
  const server = await startServer({ port: 0, quiet: true });
  const browser = await launch({ gpu });
  const rows = [];
  try {
    const first = steps[0];
    let page = await browser.newPage({ viewport: { width: first.w, height: first.h }, deviceScaleFactor: first.dpr });
    let errors = collectErrors(page);
    await openScene(page, `${server.url}/`);
    let ratio = first.dpr;
    rows.push({ ...first, when: 'on load', ...(await look(page)) });
    for (const s of steps.slice(1)) {
      // A device pixel ratio is fixed when the page is created, so those steps need a fresh page. A plain
      // resize is the interesting case and stays in the page that is already open.
      if (s.dpr !== ratio) {
        if (errors.length) console.log(`page errors before the ratio change: ${errors.join(' | ')}`);
        await page.close();
        page = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: s.dpr });
        errors = collectErrors(page);
        await openScene(page, `${server.url}/`);
        ratio = s.dpr;
        rows.push({ ...s, when: `on load at ratio ${s.dpr} (${s.note})`, ...(await look(page)) });
        continue;
      }
      await page.setViewportSize({ width: s.w, height: s.h });
      await page.waitForTimeout(300);
      rows.push({ ...s, when: `resized (${s.note})`, ...(await look(page)) });
      await page.waitForTimeout(1200);
      rows.push({ ...s, when: `settled (${s.note})`, ...(await look(page)) });
    }
    if (errors.length) console.log(`page errors: ${errors.join(' | ')}`);
    return rows;
  } finally {
    await browser.close();
    await server.close();
  }
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const rows = await run({ gpu: !process.argv.includes('--software') });
  for (const r of rows) console.log(line(`${r.w}x${r.h}@${r.dpr} ${r.when}`, r));
  mkdirSync('out', { recursive: true });
  writeFileSync('out/paintcheck.json', JSON.stringify(rows, null, 2));
  console.log('\nwrote out/paintcheck.json');
  const partial = rows.filter((r) => !r.paintedBox || r.paintedBox.w !== r.buffer[0] || r.paintedBox.h !== r.buffer[1] || r.bgPct > BG_LIMIT);
  if (partial.length) {
    for (const r of partial) {
      console.log(`FAIL ${r.w}x${r.h}@${r.dpr} ${r.when}: painted ${r.paintedBox ? `${r.paintedBox.w}x${r.paintedBox.h} at ${r.paintedBox.x},${r.paintedBox.y}` : 'nothing'} of a ${r.buffer.join('x')} buffer, ${r.bgPct}% left as page background.`);
      console.log(`     renderer size ${r.rendererSize.join('x')} at ratio ${r.rendererPixelRatio}, drawing buffer ${r.drawingBuffer.join('x')}, viewport ${r.viewport.join(',')}, composer ${r.composer.join('x')}, canvas CSS ${r.canvasCSS.join('x')}, window ${r.inner.join('x')}.`);
    }
    process.exit(1);
  }
  console.log(`paintcheck: ${rows.length} states, every one painted the whole canvas`);
}
