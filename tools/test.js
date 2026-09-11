// npm test: shot -> compare -> placement checks -> what the street keeps clear, overhead and at ground
// level -> the animation's own frames -> the frame's stability under a small camera move -> the frame is
// actually there, at several window sizes and device pixel ratios -> the frame while the camera is driven
// by real input -> assert the scores against the thresholds in docs/PLAN-scores.md.
//
// `nudge` and `blackframe` are the two halves of one question and neither can answer the other's. Nudge
// scores how much the frame *changes*, so a frame that is entirely black is the most stable frame there
// is and passes it perfectly; blackframe scores whether the frame is *there*.
//
// Every tool must also prove it RAN. A tool that exits 0 having done nothing is indistinguishable here
// from a tool that passed, and that is not a hypothetical: `blackframe`, `record`, `paintcheck` and
// `shimmer` all guarded their main block with
// `import.meta.url === \`file:///${process.argv[1].replace(/\\/g, '/')}\``, which is true on Windows and
// false on every POSIX argv[1], so on Linux they imported their own module, ran nothing and exited 0. CI
// reported them green from the day each landed until 2026-09-09; in run 34306122575, job 102323064914,
// the `blackframe` banner is at 03:57:12.599 and the `record` banner at 03:57:12.893, 0.294 s later with
// nothing between them, against minutes each locally. So this file captures each tool's output and
// requires the summary line that tool prints only when it has finished its checks. No marker, no pass,
// whatever the exit status says.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';

// Each gate, and the text it prints when its checks have actually completed. Every marker is printed
// after that tool's work, so it cannot come from a tool that skipped its main block or died early.
// `shot` and `animation` print theirs before their own verdict rather than after it, so those two lines
// also appear in a run that then fails; that is harmless only because the exit status is checked first,
// below, and a marker moved any earlier than the work would hollow this check out. `record` prints
// `record: skipped ...` where it is switched off, which is a decision in the log rather than silence,
// and still satisfies the check.
const GATES = [
  ['tools/shot.js', ['renderer:']],
  ['tools/compare.js', ['cell color distance', 'grayscale SSIM']],
  ['tools/placement.js', ['placement:']],
  // Two markers, one per check, because this tool runs two independent checks off one page load and a
  // single marker would let a run that did half the work report as a pass. Neither string can be matched
  // by an earlier line: the tool's own set listing prints "walkable street:", not "clearance street:".
  ['tools/clearance.js', ['clearance headroom:', 'clearance street:']],
  ['tools/animation.js', ['spread over ']],
  ['tools/nudge.js', ['nudge:']],
  ['tools/blackframe.js', ['blackframe:']],
  ['tools/record.js', ['record:']],
];

async function run(script, markers) {
  console.log(`\n== ${script} ==`);
  const started = Date.now();
  // Piped rather than inherited so the output can be checked, and echoed as it arrives so the log reads
  // exactly as it did before: a gate that takes forty minutes must not go silent for forty minutes.
  const child = spawn(process.execPath, [script], { stdio: ['inherit', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (d) => { output += d; process.stdout.write(d); });
  child.stderr.on('data', (d) => { output += d; process.stderr.write(d); });
  const [status, signal] = await once(child, 'close');
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  if (status !== 0) {
    console.error(`FAIL: ${script} exited with ${status ?? signal} after ${secs} s`);
    process.exit(status || 1);
  }
  const missing = markers.filter((m) => !output.includes(m));
  if (missing.length) {
    console.error(`\nFAIL: ${script} exited 0 after ${secs} s without producing evidence that it ran.`);
    console.error(`  expected its summary line to contain: ${missing.map((m) => JSON.stringify(m)).join(', ')}`);
    console.error(`  it printed ${output.length} character(s) of output${output.trim() ? `, ending: ${JSON.stringify(output.trim().slice(-160))}` : ' (nothing at all)'}`);
    console.error('  A gate that exits 0 having run nothing is reported here as a pass, so the marker is');
    console.error('  the evidence. Check the main-module guard at the bottom of the tool first: the form');
    console.error('  `import.meta.url === `file:///${process.argv[1]...}`` is false on every POSIX argv[1]');
    console.error('  and silently skips the whole main block. Fix the tool, or, if it now prints a');
    console.error('  different summary line, update GATES in tools/test.js.');
    process.exit(1);
  }
  console.log(`-- ${script}: ok in ${secs} s`);
}

for (const [script, markers] of GATES) await run(script, markers);

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
