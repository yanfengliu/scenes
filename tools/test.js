// npm test: shot -> compare -> placement checks -> the animation's own frames -> the frame's stability
// under a small camera move -> the frame is actually there, at several window sizes and device pixel
// ratios -> assert the scores against the thresholds in docs/PLAN-scores.md.
//
// `nudge` and `blackframe` are the two halves of one question and neither can answer the other's. Nudge
// scores how much the frame *changes*, so a frame that is entirely black is the most stable frame there
// is and passes it perfectly; blackframe scores whether the frame is *there*.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function run(script) {
  console.log(`\n== ${script} ==`);
  const result = spawnSync(process.execPath, [script], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`FAIL: ${script} exited with ${result.status ?? result.signal}`);
    process.exit(result.status || 1);
  }
}

run('tools/shot.js');
run('tools/compare.js');
run('tools/placement.js');
run('tools/animation.js');
run('tools/nudge.js');
run('tools/blackframe.js');
run('tools/record.js');

const scores = JSON.parse(readFileSync('out/scores.json', 'utf8'));
const doc = readFileSync('docs/PLAN-scores.md', 'utf8');
const block = doc.match(/```json\s*([\s\S]*?)```/);
if (!block) {
  console.error('FAIL: docs/PLAN-scores.md has no ```json thresholds block');
  process.exit(1);
}
const thresholds = JSON.parse(block[1]);
const checks = [
  ['cell color distance', scores.cellDistance, '<=', thresholds.cellDistanceMax],
  ['grayscale SSIM', scores.ssim, '>=', thresholds.ssimMin],
];
let failed = false;
console.log('\n== thresholds (docs/PLAN-scores.md) ==');
for (const [name, value, op, limit] of checks) {
  const ok = op === '<=' ? value <= limit : value >= limit;
  if (!ok) failed = true;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${value.toFixed(4)} ${op} ${limit}`);
}
if (failed) {
  console.error('FAIL: scores are worse than the recorded thresholds');
  process.exit(1);
}
console.log('PASS');
