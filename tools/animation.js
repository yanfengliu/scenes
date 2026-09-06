// npm run animation (and part of npm test): score the photo view at several points across the animation
// cycle, not just at t = 0.
//
// The shot gate pins the clock at t = 0 so its render is reproducible, which means it cannot see a drift
// that only shows when the canopy has swung or the petals have fallen halfway. This walks the clock over
// a full period of the wind (the slowest term is 2*pi/0.72, about 8.7 s) and scores every frame against
// the photo, then asserts three things: the worst frame's scores, the spread between frames, and the
// motion itself.
//
// The spread and the motion matter as much as the scores. An allowance loose enough to pass any frame
// also passes an animation fourteen times too violent, which is exactly what the first version of this
// gate did (see the phase 5 devlog); and an animation that quietly stops moving would pass a score check
// perfectly. So the gate bounds the mean per-pixel change between neighbouring frames from both sides:
// too little and the scene has died, too much and it is thrashing.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { startServer } from './serve.js';
import { launch, collectErrors, openScene } from './lib/browser.js';
import { decodeImage } from './lib/image.js';
import { cellDistance, ssimGray } from './lib/metrics.js';
import { PHOTO, SHOT } from '../src/layout.js';

// Seven frames across the wind's slowest period. ANIMATION_FRAMES trims the list where a run has to be
// quick (CI): the first, the last and evenly spaced frames between.
const ALL_TIMES = [0, 1.45, 2.9, 4.35, 5.8, 7.25, 8.7];
const wanted = Math.max(2, Math.min(ALL_TIMES.length, Number(process.env.ANIMATION_FRAMES) || ALL_TIMES.length));
const TIMES = wanted === ALL_TIMES.length ? ALL_TIMES : Array.from({ length: wanted }, (_, i) => ALL_TIMES[Math.round((i * (ALL_TIMES.length - 1)) / (wanted - 1))]);
// What the animation is allowed to do to the scores. The measured spread at the shipped amplitudes is
// 0.0001 of cell distance and 0.0005 of SSIM, so these leave about five times that for driver noise and
// no more: an animation that moves the photo view further than this is not subtle, whatever it looks like.
const ALLOWANCE = { cellDistance: 0.0006, ssim: 0.0025 };
// And what it must do: the mean per-pixel change between neighbouring frames, in levels of 255. This is
// the bound that actually constrains the amplitude: the scores barely move when the canopy sways, because
// its mean color is much the same wherever it is, but the motion between frames rises with the amplitude
// almost proportionally. At the shipped amplitude it is 0.18 levels; at fourteen times it, 0.65.
const MOTION = { min: 0.06, max: 0.4 };
const OUT_DIR = 'out/animation';

const doc = readFileSync('docs/PLAN-scores.md', 'utf8');
const block = doc.match(/```json\s*([\s\S]*?)```/);
if (!block) {
  console.error('FAIL: docs/PLAN-scores.md has no ```json thresholds block');
  process.exit(1);
}
const thresholds = JSON.parse(block[1]);

// A stale frame from an earlier grid beside a fresh one is a trap for whoever reads the failure.
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });
const server = await startServer({ port: 0, quiet: true });
const browser = await launch();
let failure = null;
let errors = [];
const rows = [];
let previous = null;
try {
  const page = await browser.newPage({ viewport: { width: SHOT.width, height: SHOT.height }, deviceScaleFactor: 1 });
  errors = collectErrors(page);
  await openScene(page, `${server.url}/`);
  await page.addStyleTag({ content: '#reset { display: none !important; } #loading { display: none !important; }' });
  const photo = await decodeImage(page, 'japan.webp', { width: PHOTO.width, height: PHOTO.height });
  for (const t of TIMES) {
    await page.evaluate((time) => window.__scene.setTime(time), t);
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    const path = `${OUT_DIR}/t${t.toFixed(1)}.png`;
    await page.screenshot({ path, type: 'png' });
    const render = await decodeImage(page, path, { width: PHOTO.width, height: PHOTO.height });
    const cells = cellDistance(photo.data, render.data, PHOTO.width, PHOTO.height, 24, 22);
    const ssim = ssimGray(photo.data, render.data, PHOTO.width, PHOTO.height, 64);
    // How much this frame differs from the one before it, averaged over every channel of every pixel.
    let motion = null;
    if (previous) {
      let sum = 0;
      for (let i = 0; i < render.data.length; i += 4) {
        sum += Math.abs(render.data[i] - previous[i]) + Math.abs(render.data[i + 1] - previous[i + 1]) + Math.abs(render.data[i + 2] - previous[i + 2]);
      }
      motion = sum / ((render.data.length / 4) * 3);
    }
    previous = render.data;
    rows.push({ t, cellDistance: cells.mean, ssim: ssim.value, motion });
  }
} catch (err) {
  failure = err;
} finally {
  await browser.close();
  await server.close();
}

if (errors.length) {
  console.error(`FAIL: ${errors.length} page error(s):`);
  for (const e of errors) console.error(`  ${e}`);
}
if (failure) console.error(`FAIL: ${failure.message}`);
if (errors.length || failure) process.exit(1);

const cellValues = rows.map((r) => r.cellDistance);
const ssimValues = rows.map((r) => r.ssim);
const worstCell = Math.max(...cellValues);
const bestCell = Math.min(...cellValues);
const worstSsim = Math.min(...ssimValues);
const bestSsim = Math.max(...ssimValues);
for (const r of rows) console.log(`t = ${r.t.toFixed(1)} s   cell ${r.cellDistance.toFixed(4)}   ssim ${r.ssim.toFixed(4)}${r.motion === null ? '' : `   moved ${r.motion.toFixed(2)} levels`}`);
console.log(`spread over ${rows.length} frames: cell ${bestCell.toFixed(4)} to ${worstCell.toFixed(4)} (${(worstCell - bestCell).toFixed(4)}), ssim ${worstSsim.toFixed(4)} to ${bestSsim.toFixed(4)} (${(bestSsim - worstSsim).toFixed(4)})`);
const motions = rows.map((r) => r.motion).filter((m) => m !== null);
const meanMotion = motions.reduce((a, b) => a + b, 0) / Math.max(1, motions.length);
console.log(`motion between neighbouring frames: ${Math.min(...motions).toFixed(2)} to ${Math.max(...motions).toFixed(2)} levels, mean ${meanMotion.toFixed(2)}`);
writeFileSync(`${OUT_DIR}/scores.json`, `${JSON.stringify({ frames: rows, spread: { cellDistance: worstCell - bestCell, ssim: bestSsim - worstSsim }, motion: { mean: meanMotion, min: Math.min(...motions), max: Math.max(...motions) } }, null, 2)}\n`);

const cellLimit = thresholds.cellDistanceMax + ALLOWANCE.cellDistance;
const ssimLimit = thresholds.ssimMin - ALLOWANCE.ssim;
let failed = false;
const check = (name, value, op, limit) => {
  const ok = op === '<=' ? value <= limit : value >= limit;
  if (!ok) failed = true;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${value.toFixed(4)} ${op} ${limit.toFixed(4)}`);
};
check("worst frame's cell color distance", worstCell, '<=', cellLimit);
check("worst frame's grayscale SSIM", worstSsim, '>=', ssimLimit);
check('spread of cell distance', worstCell - bestCell, '<=', ALLOWANCE.cellDistance);
check('spread of SSIM', bestSsim - worstSsim, '<=', ALLOWANCE.ssim);
check('motion between frames', meanMotion, '<=', MOTION.max);
check('motion between frames', meanMotion, '>=', MOTION.min);
if (failed) {
  console.error('FAIL: the animation is outside what the photo view allows; see out/animation/');
  process.exit(1);
}
