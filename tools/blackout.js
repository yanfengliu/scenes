// Blackout: large dark regions that appear while the camera is moved, persist after it stops, and clear
// when the view is reset.
//
// Reported by the user: "when I move the camera around there are even giant rectangular blackouts on
// screen. It continues even after the camera stops moving. Only clicking the reset review button made it
// go away." Persisting after motion stops is the important half: this is not a per-frame artifact but
// state that goes wrong and stays wrong, and a reset repairs it.
//
// What is measured, at each step of an orbit and then again after the camera has stopped:
// - `darkPct`: the share of pixels below a near-black luminance. A back-lit sunset scene has deep
//   shadow but very little true black, so a large figure is the symptom itself.
// - `worstBlock`: the darkest 32x32 block's share of near-black pixels. A "giant rectangle" is contiguous,
//   and a frame-wide mean can stay small while one region is entirely black.
// - `stuck`: whether the dark area is still there after the camera has stopped and further frames render.
//
// Bounds: it looks for dark regions, so a defect that paints a bright rectangle is invisible to it. It
// walks one orbit at one elevation from three poses, so a blackout that needs a different path is out of
// its reach. The threshold is a luminance, not a shape test, so a legitimately dark frame (the camera
// inside a building) would read as a blackout; the poses are chosen to stay outside.
import { mkdirSync, writeFileSync } from 'node:fs';
import { startServer } from './serve.js';
import { launch, collectErrors, openScene } from './lib/browser.js';

export const DARK_LUMA = 24; // out of 255; below this is "near black"
export const PATH = { degreesPerStep: 4, steps: 10, settleFrames: 5, animationTime: 1000 };

export const POSES = [
  { name: 'photo view', apply: 'reset' },
  { name: 'close to the paving', apply: 'close' },
  { name: 'orbited left and up', apply: 'orbited' },
];

export async function measure(page, { path = PATH, darkLuma = DARK_LUMA } = {}) {
  return await page.evaluate(async ({ path, poses, darkLuma }) => {
    const s = window.__scene;
    const gl = s.renderer.getContext();

    const stats = () => {
      s.render();
      const w = s.renderer.domElement.width, h = s.renderer.domElement.height;
      const buf = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      const B = 32, cols = Math.floor(w / B), rows = Math.floor(h / B);
      const grid = new Int32Array(cols * rows);
      let dark = 0;
      for (let i = 0; i < w * h; i++) {
        const o = i * 4;
        const luma = 0.2126 * buf[o] + 0.7152 * buf[o + 1] + 0.0722 * buf[o + 2];
        if (luma < darkLuma) {
          dark++;
          const bx = ((i % w) / B) | 0, by = (((i / w) | 0) / B) | 0;
          if (bx < cols && by < rows) grid[by * cols + bx]++;
        }
      }
      let worst = 0;
      for (let i = 0; i < grid.length; i++) worst = Math.max(worst, grid[i] / (B * B));
      return { darkPct: (100 * dark) / (w * h), worstBlock: 100 * worst };
    };

    const pose = (which) => {
      s.resetView();
      const c = s.camera, t = s.controls.target;
      if (which === 'close') { c.position.y -= 2.2; c.position.z -= 4; c.lookAt(t); }
      if (which === 'orbited') { c.position.x -= 6; c.position.y += 2.5; c.lookAt(t); }
    };

    const orbit = (deg) => {
      const c = s.camera, t = s.controls.target;
      const v = c.position.clone().sub(t);
      const a = (deg * Math.PI) / 180;
      const x = v.x * Math.cos(a) - v.z * Math.sin(a);
      const z = v.x * Math.sin(a) + v.z * Math.cos(a);
      c.position.set(t.x + x, c.position.y, t.z + z);
      c.lookAt(t);
    };

    const out = [];
    for (const p of poses) {
      pose(p.apply); s.setTime(path.animationTime);
      const start = stats();
      let peak = { darkPct: 0, worstBlock: 0, step: -1 };
      for (let i = 0; i < path.steps; i++) {
        orbit(path.degreesPerStep);
        s.setTime(path.animationTime);
        const r = stats();
        if (r.worstBlock > peak.worstBlock) peak = { ...r, step: i };
      }
      // The camera has stopped. Render more frames without moving it: does the dark area persist?
      let settled = null;
      for (let i = 0; i < path.settleFrames; i++) { s.setTime(path.animationTime); settled = stats(); }
      // Now reset, as the user did, and see whether that clears it.
      pose('reset'); s.setTime(path.animationTime);
      const afterReset = stats();
      out.push({
        pose: p.name,
        startDark: +start.darkPct.toFixed(2),
        startWorstBlock: +start.worstBlock.toFixed(1),
        peakWorstBlock: +peak.worstBlock.toFixed(1),
        peakAtStep: peak.step,
        settledDark: +settled.darkPct.toFixed(2),
        settledWorstBlock: +settled.worstBlock.toFixed(1),
        afterResetWorstBlock: +afterReset.worstBlock.toFixed(1),
      });
    }
    return out;
  }, { path, poses: POSES, darkLuma });
}

// A block is "blacked out" when essentially all of it is near-black. A real scene corner can be dark;
// 98% of a 32x32 block below the threshold is a hole, not shading.
export const BLOCK_LIMIT = 98;

export async function run({ ratios = [1, 2] } = {}) {
  const server = await startServer({ port: 0, quiet: true });
  const browser = await launch();
  const rows = [];
  try {
    for (const ratio of ratios) {
      const page = await browser.newPage({ viewport: { width: 900, height: 820 }, deviceScaleFactor: ratio });
      const errors = collectErrors(page);
      await openScene(page, `${server.url}/`);
      if (errors.length) throw new Error(`the page reported errors before measuring at ratio ${ratio}:\n${errors.join('\n')}`);
      const measured = await measure(page);
      if (errors.length) throw new Error(`the page reported errors while measuring at ratio ${ratio}:\n${errors.join('\n')}`);
      for (const m of measured) rows.push({ ...m, ratio });
      await page.close();
    }
    return rows;
  } finally {
    await browser.close();
    await server.close();
  }
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const rows = await run();
  console.log('pose                      ratio  startBlk  peakBlk@step  settledBlk  settledDark%  afterReset');
  for (const r of rows) {
    console.log(
      `${r.pose.padEnd(24)}  ${String(r.ratio).padStart(5)}  ${String(r.startWorstBlock).padStart(8)}  ${String(r.peakWorstBlock).padStart(7)}@${String(r.peakAtStep).padStart(2)}  ${String(r.settledWorstBlock).padStart(10)}  ${String(r.settledDark).padStart(12)}  ${String(r.afterResetWorstBlock).padStart(10)}`,
    );
  }
  const bad = rows.filter((r) => r.peakWorstBlock >= BLOCK_LIMIT || r.settledWorstBlock >= BLOCK_LIMIT);
  mkdirSync('out', { recursive: true });
  writeFileSync('out/blackout.json', JSON.stringify({ rows, blockLimit: BLOCK_LIMIT, measuredAt: new Date().toISOString() }, null, 2));
  console.log('\nwrote out/blackout.json');
  if (bad.length) {
    console.log(`FAIL: ${bad.length} pose/ratio combination(s) went fully black over a 32x32 block during or after the orbit (limit ${BLOCK_LIMIT}%).`);
    for (const r of bad) console.log(`  ${r.pose}, ratio ${r.ratio}: peak ${r.peakWorstBlock}% at step ${r.peakAtStep}, still ${r.settledWorstBlock}% after the camera stopped`);
    process.exit(1);
  }
  console.log('blackout: no fully dark block during or after the orbit');
}
