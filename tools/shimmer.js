// Shimmer: how much the image toggles rather than moves, along a smooth camera path.
//
// The user's report is "as I move the camera around it flickers a lot". Frame-to-frame difference does
// not measure that: during a real drag most pixels change because the image legitimately moves, and a
// scene that panned perfectly smoothly would still score large. What flicker is, is temporal change the
// motion does not explain: a pixel that switches on and off between consecutive frames while its
// neighbours slide steadily.
//
// So the metric is the temporal SECOND difference, |2*F(i) - F(i-1) - F(i+1)|, averaged over pixels and
// channels. Smooth motion is close to linear over three consecutive frames and cancels; aliasing that
// flips a pixel between frames does not. `motion` (the first difference) is reported beside it only as
// context, so a change in the path is visible rather than silent.
//
// Bounds, stated because a gate that hides them is worse than none:
// - It measures the frame as a whole, so violent shimmer confined to a few hundred pixels can hide
//   under a low mean. `worstBlockShimmer` bounds that: the worst 16x16 block, not the average.
// - Disocclusion at silhouettes is genuinely non-smooth and lands in the score as a floor. The number is
//   therefore comparative across builds on a fixed path, not an absolute measure of quality.
// - It says nothing about any pose off the path, and nothing about a device pixel ratio it did not run.
// - The static control (a path that does not move) must read 0. If it does not, the scene is
//   nondeterministic per frame and the shimmer figure means nothing until that is fixed.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.js';
import { launch, collectErrors, openScene } from './lib/browser.js';

// A slow drag: about 0.1 degrees of orbit per frame. Fast enough that the image really moves, slow
// enough that a smooth renderer would show almost no second difference.
export const PATH = { degreesPerFrame: 0.1, frames: 13, animationTime: 1000 };

export const POSES = [
  { name: 'photo view', apply: 'reset' },
  { name: 'close to the paving', apply: 'close' },
  { name: 'orbited left and up', apply: 'orbited' },
];

const RATIOS = [1, 2];

export async function measure(page, { path = PATH } = {}) {
  return await page.evaluate(async ({ path, poses }) => {
    const s = window.__scene;
    const gl = s.renderer.getContext();

    const grab = () => {
      s.render();
      const w = s.renderer.domElement.width, h = s.renderer.domElement.height;
      const buf = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return { buf, w, h };
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

    // |2*B - A - C| per pixel per channel: cancels linear (smooth) change, keeps toggling.
    const secondDiff = (A, B, C, blocks) => {
      const n = A.w * A.h;
      let sum = 0;
      const B16 = 16, cols = Math.floor(A.w / B16), rows = Math.floor(A.h / B16);
      const grid = blocks ? new Float64Array(cols * rows) : null;
      for (let i = 0; i < n; i++) {
        const o = i * 4;
        let d = 0;
        for (let k = 0; k < 3; k++) d += Math.abs(2 * B.buf[o + k] - A.buf[o + k] - C.buf[o + k]);
        d /= 3;
        sum += d;
        if (grid) {
          const px = i % A.w, py = (i / A.w) | 0;
          const bx = (px / B16) | 0, by = (py / B16) | 0;
          if (bx < cols && by < rows) grid[by * cols + bx] += d;
        }
      }
      let worst = 0;
      if (grid) for (let i = 0; i < grid.length; i++) worst = Math.max(worst, grid[i] / (B16 * B16));
      return { mean: sum / n, worstBlock: worst };
    };

    const firstDiff = (A, B) => {
      const n = A.w * A.h;
      let sum = 0;
      for (let i = 0; i < n; i++) {
        const o = i * 4;
        let d = 0;
        for (let k = 0; k < 3; k++) d += Math.abs(B.buf[o + k] - A.buf[o + k]);
        sum += d / 3;
      }
      return sum / n;
    };

    const out = [];
    {
      for (const p of poses) {
        // Static control first: the same pose rendered three times must have zero second difference.
        pose(p.apply); s.setTime(path.animationTime);
        const s0 = grab(), s1 = grab(), s2 = grab();
        const still = secondDiff(s0, s1, s2, false).mean;

        pose(p.apply); s.setTime(path.animationTime);
        const frames = [grab()];
        for (let i = 1; i < path.frames; i++) {
          orbit(path.degreesPerFrame);
          s.setTime(path.animationTime);
          frames.push(grab());
        }
        let shimmer = 0, worst = 0, motion = 0;
        for (let i = 1; i < frames.length - 1; i++) {
          const r = secondDiff(frames[i - 1], frames[i], frames[i + 1], true);
          shimmer += r.mean;
          worst = Math.max(worst, r.worstBlock);
        }
        for (let i = 1; i < frames.length; i++) motion += firstDiff(frames[i - 1], frames[i]);
        const nPairs = frames.length - 2;
        out.push({
          pose: p.name,
          still: +still.toFixed(4),
          shimmer: +(shimmer / nPairs).toFixed(3),
          worstBlockShimmer: +worst.toFixed(3),
          motion: +(motion / (frames.length - 1)).toFixed(3),
        });
      }
    }
    return out;
  }, { path, poses: POSES });
}

export async function run({ ratios = RATIOS } = {}) {
  const server = await startServer({ port: 0, quiet: true });
  const browser = await launch();
  const rows = [];
  try {
    // A page per device pixel ratio, as the nudge gate does: the composer sizes its targets when it is
    // built, so switching the ratio afterwards would measure a stale target rather than the real thing.
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

function report(rows) {
  console.log('pose                      ratio   still   shimmer  worstBlock   motion');
  for (const r of rows) {
    console.log(
      `${r.pose.padEnd(24)}  ${String(r.ratio).padStart(5)}  ${String(r.still).padStart(6)}  ${String(r.shimmer).padStart(7)}  ${String(r.worstBlockShimmer).padStart(10)}  ${String(r.motion).padStart(7)}`,
    );
  }
  const mean = (k) => rows.reduce((a, b) => a + b[k], 0) / rows.length;
  console.log(`\nmean shimmer ${mean('shimmer').toFixed(3)}   mean worst block ${mean('worstBlockShimmer').toFixed(3)}   mean motion ${mean('motion').toFixed(3)}`);
  return { meanShimmer: mean('shimmer'), meanWorstBlock: mean('worstBlockShimmer'), meanMotion: mean('motion') };
}

// True only when node was started with THIS file. The form that was here,
// `import.meta.url === \`file:///${process.argv[1].replace(/\\/g, '/')}\``, is wrong everywhere but
// Windows: a POSIX argv[1] of /home/runner/... builds file:////home/runner/... with four slashes, which
// never matches, so the tool loaded, printed nothing and exited 0. Same shape as tools/serve.js.
function isMainModule() {
  if (!process.argv[1]) return false;
  return resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
}

if (isMainModule()) {
  const rows = await run();
  const summary = report(rows);
  const nonZeroStill = rows.filter((r) => r.still > 0.001);
  if (nonZeroStill.length) {
    console.log(`\nFAIL: ${nonZeroStill.length} pose(s) changed while the camera and clock stood still; the scene is nondeterministic per frame and the shimmer figure cannot be trusted.`);
  }
  mkdirSync('out', { recursive: true });
  writeFileSync('out/shimmer.json', JSON.stringify({ rows, summary, measuredAt: new Date().toISOString() }, null, 2));
  console.log('wrote out/shimmer.json');
  if (nonZeroStill.length) process.exit(1);
}
