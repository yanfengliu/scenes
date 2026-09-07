// Record every frame while the camera is driven by real mouse input, and say which frame went wrong.
//
// Everything before this looked at single moments: a frame on load, a frame after a resize, a frame at a
// chosen pose. A user kept seeing a dark rectangle that none of those caught, and their in-page capture
// showed a configuration verified as working and the whole canvas black a tenth of a second later. That
// gap is invisible to a tool that samples occasionally, so this samples continuously.
//
// It registers its probe with requestAnimationFrame AFTER the page has registered its own, so each
// sample is taken after that frame's render, in the same frame, and the trace lines up with what was on
// screen. The probe is a small grid of single-pixel reads, cheap enough to afford every frame.
//
// Drives real mouse events through the page's own controls: no camera is positioned directly, so the
// damping and the per-frame clamp behave as they do for a person.
//
// BOUNDS: the probe is a grid, so a dark region smaller than its spacing is missed; it records luminance,
// so a bright fault is invisible; and it drives one scripted gesture sequence, which is not every gesture.
import { mkdirSync, writeFileSync } from 'node:fs';
import { startServer } from './serve.js';
import { launch, collectErrors, openScene } from './lib/browser.js';

export const DARK_LUMA = 24;
export const GRID = 5; // GRID x GRID single-pixel probes per frame

// No frame may have this many of its probes dark. Measured, broken against fixed, over the gesture
// sequence below at 2005x1305 on a GPU: with the bloom overflowing, the worst frame was 25 of 25 and 89
// frames were at 15 or more; with the ceiling in place the worst frame is 3 of 25 and nothing exceeds it.
// 12 sits between them with room on both sides, and it is a per-FRAME limit rather than an average
// because the fault is a flicker: averaged over a recording it disappears into the good frames.
export const WORST_FRAME_LIMIT = 12;

export async function record({
  width = 2005, height = 1305, ratio = 1.5, seconds = 12, gpu = true,
} = {}) {
  const server = await startServer({ port: 0, quiet: true });
  const browser = await launch({ gpu });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: ratio });
  const errors = collectErrors(page);
  try {
    const info = await openScene(page, `${server.url}/`);

    await page.evaluate(({ grid, darkLuma }) => {
      const s = window.__scene, gl = s.renderer.getContext(), c = s.renderer.domElement;
      const trace = [];
      window.__trace = trace;
      let n = 0;
      const sample = () => {
        const w = c.width, h = c.height;
        let dark = 0;
        const px = new Uint8Array(4);
        if (w && h) {
          for (let iy = 0; iy < grid; iy++) {
            for (let ix = 0; ix < grid; ix++) {
              const x = Math.min(w - 1, Math.round(((ix + 0.5) * w) / grid));
              const y = Math.min(h - 1, Math.round(((iy + 0.5) * h) / grid));
              gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
              if (0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2] < darkLuma) dark++;
            }
          }
        }
        // The same probe again, but after forcing a fresh render in this same callback. The drawing
        // buffer is not preserved, so once the browser has composited a frame, reading it back can
        // return cleared black through no fault of the scene. If `dark` swings while `darkForced`
        // stays at zero, the swinging is this tool reading at the wrong moment, not the app failing.
        let darkForced = 0;
        if (w && h) {
          s.render();
          for (let iy = 0; iy < grid; iy++) {
            for (let ix = 0; ix < grid; ix++) {
              const x = Math.min(w - 1, Math.round(((ix + 0.5) * w) / grid));
              const y = Math.min(h - 1, Math.round(((iy + 0.5) * h) / grid));
              gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
              if (0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2] < darkLuma) darkForced++;
            }
          }
        }
        const p = s.camera.position;
        const st = s.describe ? (s.describe().post ?? null) : null;
        trace.push({
          i: n++,
          t: +performance.now().toFixed(0),
          dark,
          darkForced,
          of: grid * grid,
          buffer: [w, h],
          composer: [s.composer._width, s.composer._height],
          samples: s.composer.renderTarget1.samples,
          rung: st ? st.rung : null,
          cam: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
        });
        // Registered fresh each frame, and always after the page's own callback, so the sample is taken
        // after that frame has been rendered rather than before it.
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }, { grid: GRID, darkLuma: DARK_LUMA });

    // A person's gestures: several drags in different directions, a couple of wheel zooms, pauses
    // between them so damping plays out, and a reset at the end.
    const cx = width / 2, cy = height / 2;
    const drag = async (dx, dy, steps = 20) => {
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      for (let i = 1; i <= steps; i++) await page.mouse.move(cx + (dx * i) / steps, cy + (dy * i) / steps);
      await page.mouse.up();
    };
    const gestures = [
      () => drag(300, 60), () => drag(-420, -120), () => drag(120, 260),
      () => page.mouse.wheel(0, -420), () => drag(-260, 180),
      () => page.mouse.wheel(0, 380), () => drag(520, -90),
      () => page.keyboard.press('r'),
    ];
    const per = Math.max(400, Math.floor((seconds * 1000) / gestures.length));
    for (const g of gestures) {
      await g();
      await page.waitForTimeout(per);
    }

    const trace = await page.evaluate(() => window.__trace);
    let shot = null;
    const firstBad = trace.find((f) => f.dark === f.of);
    if (firstBad) shot = await page.screenshot();
    return { trace, firstBad, shot, renderer: info.renderer, errors: errors.slice() };
  } finally {
    await page.close().catch(() => {});
    await browser.close();
    await server.close();
  }
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const arg = (name, fallback) => {
    const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? Number(hit.split('=')[1]) : fallback;
  };
  const opts = { width: arg('width', 2005), height: arg('height', 1305), ratio: arg('ratio', 1.5), seconds: arg('seconds', 12) };
  const { trace, firstBad, shot, renderer, errors } = await record(opts);
  mkdirSync('out', { recursive: true });
  writeFileSync('out/record.json', JSON.stringify({ opts, renderer, trace }, null, 2));
  if (shot) writeFileSync('out/record-firstbad.png', shot);

  console.log(`renderer ${renderer}`);
  console.log(`${opts.width}x${opts.height} @ ${opts.ratio}, ${trace.length} frames recorded`);
  if (errors.length) console.log(`page errors: ${errors.join(' | ')}`);

  // Every stretch where the frame was fully dark, with what the chain was doing at the time.
  const runs = [];
  for (const f of trace) {
    const bad = f.dark === f.of;
    const last = runs[runs.length - 1];
    if (bad && last && last.end === f.i - 1) { last.end = f.i; last.until = f.t; continue; }
    if (bad) runs.push({ start: f.i, end: f.i, from: f.t, until: f.t, at: f });
  }
  const worst = trace.reduce((a, b) => (b.dark > a.dark ? b : a), trace[0] ?? { dark: 0, of: GRID * GRID });
  console.log(`worst frame: ${worst.dark} of ${worst.of} probes dark at t=${worst.t}, composer ${worst.composer?.join('x')} samples ${worst.samples} rung ${worst.rung}`);
  if (!runs.length) {
    console.log('no frame was fully dark during the recording');
  } else {
    console.log(`${runs.length} fully dark stretch(es):`);
    for (const r of runs) {
      console.log(`  frames ${r.start}-${r.end} (${r.until - r.from} ms), composer ${r.at.composer.join('x')} samples ${r.at.samples} rung ${r.at.rung}, camera ${JSON.stringify(r.at.cam)}`);
    }
    console.log('wrote out/record-firstbad.png');
  }
  console.log('wrote out/record.json');

  // The gate. `darkForced` is the one to judge on: it is measured after a render forced in the same
  // callback, so a frame the browser happened to composite away cannot be mistaken for a black one.
  const over = trace.filter((f) => f.darkForced >= WORST_FRAME_LIMIT);
  if (over.length) {
    console.log(`\nFAIL: ${over.length} of ${trace.length} frames had ${WORST_FRAME_LIMIT} or more of ${GRID * GRID} probes dark while the camera was being driven.`);
    for (const f of over.slice(0, 6)) {
      console.log(`  frame ${f.i} at t=${f.t}: ${f.darkForced} of ${f.of} dark, composer ${f.composer.join('x')} samples ${f.samples}, camera ${JSON.stringify(f.cam)}`);
    }
    console.log('A frame that goes dark under ordinary camera movement is the defect a user reported as flickering and as rectangular blackouts.');
    process.exit(1);
  }
  const worstForced = trace.reduce((a, f) => Math.max(a, f.darkForced), 0);
  console.log(`record: ${trace.length} frames driven by real input, worst frame ${worstForced} of ${GRID * GRID} probes dark (limit ${WORST_FRAME_LIMIT})`);
}
