// npm run blackframe (and part of npm test): the frame the post chain puts on the canvas has to contain
// the scene, at every window size and device pixel ratio, not only at the one the other gates use.
//
// This gate exists because a user reported "giant rectangular blackouts" that persisted after the camera
// stopped and cleared on a view reset, and every gate in the repo passed the whole time. The camera was
// incidental. What decided it was the size: at a drawing buffer of 1920x1080 (a 1280x720 window at a
// device pixel ratio of 1.5) the composer's target is 2304x1296, and on a desktop GPU a multisampled
// target at exactly that size resolved to black. The same target with multisampling off was correct, and
// the same multisampling at 1920x1080 and at 2880x1620 was correct, so it was neither a memory limit nor
// a size ceiling. `gl.getError()` stayed 0, the context was never lost and the framebuffer reported
// complete: nothing in the API said anything was wrong. The only way to know is to look at the pixels.
//
// Two things kept the existing gates blind:
//   - they all run at deviceScaleFactor 1 in a 1200x1100 viewport, which makes a 1440x1320 composer and
//     never visits the sizes that fail;
//   - `tools/nudge.js`, the gate that was written for the previous user report, scores the *fraction of
//     pixels that change* between two renders of almost the same view. A frame that is entirely black is
//     perfectly stable, so it scores this catastrophe as a flawless pass. A stability metric cannot tell
//     "rendered correctly" from "rendered nothing"; this gate is the one that can.
//
// What is asserted for every size, with the camera stationary at the photo view:
//   - `darkPct`, the share of near-black pixels, stays under a ceiling. The scene is a back-lit sunset
//     with deep shadow but almost no true black, and measures about 2%.
//   - `worstBlock`, the darkest tile of a 12x12 grid over the frame, stays under 98% near-black. A
//     "giant rectangle" is contiguous, and a frame-wide mean can stay small while one region is
//     entirely black. The tile is a fraction of the frame rather than a fixed 32x32 because this scene
//     genuinely has 32x32 patches that are all shadow -- under the eaves, inside the doorways -- and at
//     a 1920x1080 buffer a correct frame reaches 99.9% on the darkest of them. A twelfth of the frame
//     in each direction is the scale the user's word "giant" is about.
//   - `lumaStd`, the spread of luminance over the frame, stays above a floor. A frame that rendered
//     nothing is flat; a frame that rendered the scene is not. This is what separates a correct render
//     from a uniform fill of any colour, black or otherwise.
//   - `vsDirect`, the composer frame's mean luminance as a fraction of the same view rendered straight
//     through `renderer.render(scene, camera)` with no post chain at all. This is the differential that
//     needs no absolute brightness: if the plain renderer sees a lit scene and the composer hands back
//     the dark, the post chain destroyed the frame, wherever the camera happens to be pointing.
//
// Every size is measured twice: once on the page as it loaded, which proves the startup path, and once
// after the window has been resized, which proves the resize path (`resizeComposer` in `src/post.js`
// re-picks the configuration on every size change, and that decision has to be right too).
//
// Bounds. It runs on whatever renderer chromium gives it: with `--use-angle=d3d11` that is the real GPU,
// and the driver bug above is a property of that driver, so a machine without a usable GPU falls back to
// SwiftShader and this gate then proves only that the chain is sound there. The renderer it got is
// printed with every run, so a green run on SwiftShader is never mistaken for a green run on a GPU. It
// looks for frames that are too dark or too flat, so a defect that paints a bright uniform rectangle
// over part of the frame is invisible to it, and it visits the sizes listed below rather than all of
// them: the fix it guards is a runtime probe precisely because no list of sizes can be complete.
import { mkdirSync, writeFileSync } from 'node:fs';
import { startServer } from './serve.js';
import { launch, collectErrors, openScene, ACTION_TIMEOUT_MS } from './lib/browser.js';

// Window size and device pixel ratio, chosen so the drawing buffers differ and the ratios are not all
// whole numbers. The first entry is the case the user hit: 1280x720 at 1.5 is a drawing buffer of
// 1920x1080 and a composer of 2304x1296. The second is what every other gate in the repo sees.
export const VIEWS = [
  { width: 1280, height: 720, ratio: 1.5, resize: { width: 1180, height: 700 } },
  { width: 1200, height: 1100, ratio: 1, resize: { width: 1440, height: 900 } },
  { width: 1024, height: 768, ratio: 1.25, resize: { width: 1153, height: 641 } },
  { width: 900, height: 820, ratio: 1.75, resize: { width: 1097, height: 733 } },
  { width: 800, height: 600, ratio: 2, resize: { width: 960, height: 540 } },
  { width: 1366, height: 768, ratio: 1, resize: { width: 1367, height: 769 } },
];

export const DARK_LUMA = 24; // out of 255; below this is "near black"
export const GRID = 12; // the frame is cut into GRID x GRID tiles to look for a contiguous blackout
export const LIMIT = {
  // Measured, correct against broken, over the twelve rows of the sweep below on an ANGLE/D3D11 GPU:
  //   near-black share   0.56 to 1.70%   against 95.7 to 100%
  //   worst tile         7.6 to 16.1%    against 100%
  //   luminance spread   57 to 59        against 0 to 41
  //   light kept         1.009 to 1.022  against 0 to 0.069
  darkPct: 20, // the scene measures about 2
  worstBlock: 98, // no tile of the grid may be essentially all black
  lumaStd: 8, // a frame with content is not flat
  vsDirect: 0.35, // the composer may not lose most of the light the plain renderer sees
};

// Measure the current page: the composer's frame, and the same view with no post chain at all.
async function measure(page, { darkLuma = DARK_LUMA, grid = GRID } = {}) {
  return await page.evaluate(({ darkLuma, grid }) => {
    const s = window.__scene;
    const gl = s.renderer.getContext();
    const W = s.renderer.domElement.width;
    const H = s.renderer.domElement.height;
    const buf = new Uint8Array(W * H * 4);

    const stats = () => {
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      // Tiles are a fixed fraction of the frame, not a fixed pixel count, so the same question is asked
      // of every drawing buffer size and a small patch of honest shadow is never mistaken for a hole.
      const bw = Math.max(1, Math.floor(W / grid));
      const bh = Math.max(1, Math.floor(H / grid));
      const tiles = new Int32Array(grid * grid);
      let dark = 0;
      let sum = 0;
      let sumSq = 0;
      const n = W * H;
      for (let i = 0; i < n; i++) {
        const o = i * 4;
        const luma = 0.2126 * buf[o] + 0.7152 * buf[o + 1] + 0.0722 * buf[o + 2];
        sum += luma;
        sumSq += luma * luma;
        if (luma < darkLuma) {
          dark++;
          const bx = Math.min(grid - 1, ((i % W) / bw) | 0);
          const by = Math.min(grid - 1, (((i / W) | 0) / bh) | 0);
          tiles[by * grid + bx]++;
        }
      }
      // Only whole tiles are scored: the rightmost and bottom tiles collect the remainder pixels too,
      // so they would read as more than full.
      let worst = 0;
      for (let by = 0; by < grid - 1; by++) {
        for (let bx = 0; bx < grid - 1; bx++) worst = Math.max(worst, tiles[by * grid + bx]);
      }
      const mean = sum / n;
      return {
        darkPct: (100 * dark) / n,
        worstBlock: (100 * worst) / (bw * bh),
        meanLuma: mean,
        lumaStd: Math.sqrt(Math.max(0, sumSq / n - mean * mean)),
        tile: `${bw}x${bh}`,
      };
    };

    // The camera does not move: this reproduces from the size alone. The clock is pinned so the
    // animation is not the variable under test.
    s.resetView();
    s.setTime(1000);

    // The shipped path: the whole post chain onto the canvas.
    s.render();
    const composer = stats();

    // The same view with no composer, as the reference the differential is taken against.
    s.renderer.setRenderTarget(null);
    s.renderer.render(s.scene, s.camera);
    const direct = stats();

    // Leave the page rendering the real chain again.
    s.render();

    const info = s.describe();
    return {
      width: W,
      height: H,
      pixelRatio: info.pixelRatio,
      post: info.post ?? null,
      glError: gl.getError(),
      contextLost: gl.isContextLost(),
      composer,
      direct,
      vsDirect: direct.meanLuma > 0 ? composer.meanLuma / direct.meanLuma : 0,
    };
  }, { darkLuma, grid });
}

function round(row) {
  const r = (v, d = 2) => +v.toFixed(d);
  return {
    ...row,
    composer: { darkPct: r(row.composer.darkPct), worstBlock: r(row.composer.worstBlock, 1), meanLuma: r(row.composer.meanLuma, 1), lumaStd: r(row.composer.lumaStd, 1), tile: row.composer.tile },
    direct: { darkPct: r(row.direct.darkPct), worstBlock: r(row.direct.worstBlock, 1), meanLuma: r(row.direct.meanLuma, 1), lumaStd: r(row.direct.lumaStd, 1), tile: row.direct.tile },
    vsDirect: r(row.vsDirect, 3),
  };
}

export async function run({ views = VIEWS, gpu = true } = {}) {
  const server = await startServer({ port: 0, quiet: true });
  const browser = await launch({ gpu });
  const rows = [];
  let renderer = 'unknown';
  try {
    for (const view of views) {
      const page = await browser.newPage({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: view.ratio });
      page.setDefaultTimeout(ACTION_TIMEOUT_MS);
      const errors = collectErrors(page);
      const info = await openScene(page, `${server.url}/`);
      renderer = info.renderer;
      const label = `${view.width}x${view.height} @ ${view.ratio}`;
      rows.push({ ...round(await measure(page)), view: label, when: 'on load' });
      if (view.resize) {
        await page.setViewportSize({ width: view.resize.width, height: view.resize.height });
        await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
        rows.push({ ...round(await measure(page)), view: `${view.resize.width}x${view.resize.height} @ ${view.ratio}`, when: `resized from ${label}` });
      }
      if (errors.length) throw new Error(`the page reported errors at ${label}:\n${errors.join('\n')}`);
      await page.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
  return { rows, renderer };
}

// Every reason a row can fail, as sentences, so a red run says which property broke and by how much.
export function faults(row, limit = LIMIT) {
  const out = [];
  if (row.composer.darkPct > limit.darkPct) out.push(`${row.composer.darkPct}% of the frame is near black, over the ${limit.darkPct}% allowed`);
  if (row.composer.worstBlock >= limit.worstBlock) out.push(`a ${row.composer.tile} tile (one of a ${GRID}x${GRID} grid over the frame) is ${row.composer.worstBlock}% near black, at or over the ${limit.worstBlock}% allowed`);
  if (row.composer.lumaStd < limit.lumaStd) out.push(`the frame is flat: luminance spread ${row.composer.lumaStd}, under the ${limit.lumaStd} a rendered scene has`);
  if (row.vsDirect < limit.vsDirect) out.push(`the composer keeps only ${(100 * row.vsDirect).toFixed(1)}% of the light the plain renderer sees (${row.composer.meanLuma} against ${row.direct.meanLuma}), under the ${100 * limit.vsDirect}% allowed`);
  if (row.contextLost) out.push('the WebGL context was lost');
  return out;
}

function isMainModule() {
  return import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`;
}

if (isMainModule()) {
  // BLACKFRAME_VIEWS trims the sweep to its first N entries, the way ANIMATION_FRAMES trims that gate.
  // It exists for CI, where every render goes through SwiftShader at minutes per frame and the suite
  // already sits close to its ceiling. The first entry is the size the user's report came from, so a
  // trimmed run still covers the case this gate was written for.
  const count = Number(process.env.BLACKFRAME_VIEWS || VIEWS.length);
  const { rows, renderer } = await run({ views: VIEWS.slice(0, Math.max(1, count)), gpu: process.env.BLACKFRAME_GPU !== '0' });
  console.log(`renderer: ${renderer}`);
  console.log('\nview                    when                          buffer       samples  dark%  worstBlk  lumaStd  vsDirect');
  for (const r of rows) {
    const samples = r.post ? `${r.post.samples}@${r.post.width}x${r.post.height}` : '-';
    console.log(
      `${r.view.padEnd(22)}  ${r.when.padEnd(28)}  ${`${r.width}x${r.height}`.padEnd(11)}  ${samples.padEnd(7)}  ${String(r.composer.darkPct).padStart(5)}  ${String(r.composer.worstBlock).padStart(8)}  ${String(r.composer.lumaStd).padStart(7)}  ${String(r.vsDirect).padStart(8)}`,
    );
  }
  const bad = rows.map((r) => ({ row: r, why: faults(r) })).filter((x) => x.why.length);
  mkdirSync('out', { recursive: true });
  writeFileSync('out/blackframe.json', `${JSON.stringify({ renderer, limit: LIMIT, darkLuma: DARK_LUMA, grid: GRID, rows, measuredAt: new Date().toISOString() }, null, 2)}\n`);
  console.log('\nwrote out/blackframe.json');
  if (bad.length) {
    console.error(`\nFAIL: the post chain produced a black or near-black frame at ${bad.length} of ${rows.length} size(s):`);
    for (const { row, why } of bad) {
      console.error(`  ${row.view} (${row.when}), drawing buffer ${row.width}x${row.height}:`);
      for (const w of why) console.error(`    ${w}`);
    }
    process.exit(1);
  }
  console.log(`blackframe: ${rows.length} size/ratio combinations all rendered the scene on ${renderer}`);
}
