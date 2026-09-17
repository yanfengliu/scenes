// npm test: shot -> compare -> placement checks -> the populations of every rule that selects meshes by
// name -> what the street keeps clear, overhead and at ground level -> the animation's own frames -> the
// frame's stability under a small camera move -> the frame is actually there, at several window sizes and
// device pixel ratios -> the frame while the camera is driven by real input -> assert the scores against
// the thresholds in the scene's own thresholds file.
//
// `SCENE=<id>` names the scene this run is for and is inherited by every gate it spawns; unset is scene 1,
// whose score file and thresholds file are the ones every recorded number in this repo belongs to.
//
// WHICH GATES RUN IS DECIDED BY THE SCENE, because a gate that reads scene 1's landmark lists and raycasts
// scene 1's street cannot report a verdict about another scene: it would fail on a scene that is fine, and
// a run that skipped it silently would report as though it had been checked. So every entry below carries
// the scenes it applies to, an entry that does not apply is SKIPPED with its reason printed, and a run
// whose gates all applied to nothing is not a pass. `shot` and `compare` are scene-scoped through
// tools/lib/scene.js; `placement`, `clearance`, `namerules` and `animation` import scene 1's own
// `src/layout.js` and pose its street, and `record` drives scene 1's camera through its own clamp, so
// those five are scene 1's and are skipped for any other scene.
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
import { existsSync, readFileSync } from 'node:fs';
import { isMainModule } from './serve.js';
// An import must never start a gate. Everything below runs only when node was asked to run THIS file;
// `node -e "import('./tools/x.js')"` loads it and does nothing. The block is not re-indented so that
// the diff that added it is three lines rather than the whole tool. Proved inert, per tool, by
// out/scratch/import-inert.mjs; the bound is in docs/learning/gate-proofs.md.
if (isMainModule(import.meta.url)) {

// Which scene this run asserts, and where its scores live. Resolved before the first gate is spawned, so
// a mistyped SCENE fails in a second instead of after three minutes of gates, as one FAIL line naming the
// ids that exist rather than a stack trace out of this module's own imports. The gates below inherit
// SCENE, so `SCENE=<id> npm test` runs and asserts that scene with no other change.
let active;
try {
  active = await import('./lib/scene.js');
} catch (err) {
  console.error(`FAIL: ${err.message}`);
  process.exit(1);
}
const { scene, scoresPath } = active;
// Every gate that was skipped, so the summary can say what this run did NOT establish. A run whose whole
// gate list applied to nothing must not read as a pass.
const skipped = [];

// Each gate, and the text it prints when its checks have actually completed. Every marker is printed
// after that tool's work, so it cannot come from a tool that skipped its main block or died early.
// `shot` and `animation` print theirs before their own verdict rather than after it, so those two lines
// also appear in a run that then fails; that is harmless only because the exit status is checked first,
// below, and a marker moved any earlier than the work would hollow this check out. `record` prints
// `record: skipped ...` where it is switched off, which is a decision in the log rather than silence,
// and still satisfies the check.
//
// The third element is the scenes the gate applies to, and the fourth is why it does not apply to the
// others, printed when it is skipped so the reason is in the log rather than in a reader's memory.
const GATES = [
  // First, and it opens no browser: every tool must load and do nothing when imported. It runs before
  // the rest because it is the cheapest gate here (about 7 s) and because a tool that runs itself on
  // import is a tool whose every other result is suspect. It reads no scene data at all.
  ['tools/import-inert.js', ['import-inert:'], null, ''],
  // Scene-scoped through tools/lib/scene.js: it renders whichever scene SCENE names, at that scene's own
  // frame size, and refuses anything but a SwiftShader frame drawn by the full post chain.
  ['tools/shot.js', ['renderer:'], null, ''],
  // Scene-scoped the same way: it scores that scene's render against that scene's reference photo.
  ['tools/compare.js', ['cell color distance', 'grayscale SSIM'], null, ''],
  // Scene 1's: its check list is `PLACEMENT_CHECKS` in src/layout.js, photo positions in scene 1's frame
  // and world coordinates in scene 1's street. Another scene would be asked where scene 1's lamp post is.
  ['tools/placement.js', ['placement:'], ['japan'], "its check list is scene 1's PLACEMENT_CHECKS and GROUNDING_CHECKS, cast in scene 1's world coordinates"],
  // Its marker is printed only on the verdict path. An `--update` run prints "manifest written:" instead,
  // deliberately: writing the manifest is not checking it, and a marker shared between the two would let
  // a rewrite satisfy this table. The populations it pins are the built scene's, so it pins whichever
  // scene it loads, but the lists it reads them from are scene 1's.
  ['tools/namerules.js', ['name rules:'], ['japan'], "the rules whose populations it pins are scene 1's own name rules, read out of scene 1's modules"],
  // Two markers, one per check, because this tool runs two independent checks off one page load and a
  // single marker would let a run that did half the work report as a pass. Neither string can be matched
  // by an earlier call: the tool's own set listing prints "walkable street:", not "clearance street:".
  // It measures the built scene rather than importing anything from src/, but every name it classifies and
  // every surface it sweeps is scene 1's street, so it has no verdict to give about another scene.
  ['tools/clearance.js', ['clearance headroom:', 'clearance street:'], ['japan'], "it sweeps scene 1's paving for headroom under scene 1's cherry and clear run along scene 1's street"],
  // Scene 1's: it scores frames against scene 1's reference photo at PHOTO/PHOTO's size, off scene 1's
  // module. The clamp it walks is scene 1's camera clamp.
  ['tools/animation.js', ['spread over '], ['japan'], "it pins the clock and scores frame by frame against scene 1's reference photo, at scene 1's photo size"],
  // Scene-neutral: it moves the camera the page was posed at by 2 mm and scores how much the frame
  // changes, so it needs no landmark, no photo and no name -- only a posed photo view, which every scene
  // has. Its limits are keyed on the renderer the run got, not on the scene.
  ['tools/nudge.js', ['nudge:'], null, ''],
  // Scene-neutral for the same reason: it asks whether the frame is there at all, at six window sizes and
  // device pixel ratios, and a black frame is a black frame in any scene.
  ['tools/blackframe.js', ['blackframe:'], null, ''],
  // Scene 1's: it drives real mouse events through scene 1's camera clamp and asserts every frame of the
  // recording. The clamp is the thing under test and it is scene 1's.
  ['tools/record.js', ['record:'], ['japan'], "it drives scene 1's camera through scene 1's clamp and asserts every frame of the recording"],
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

for (const [script, markers, scenes, why] of GATES) {
  // `null` means the gate reads no scene data and applies to every scene. A list means it applies to those
  // scenes only, and a skip says which gate was skipped and why, so the log cannot be read as a pass.
  if (scenes && !scenes.includes(scene.id)) {
    console.log(`\n== ${script} ==`);
    console.log(`-- ${script}: SKIPPED for scene "${scene.id}" -- ${why}.`);
    console.log('   It still runs for its own scene: `npm test`, or `SCENE=<its id> npm test`.');
    skipped.push(script);
    continue;
  }
  await run(script, markers);
}

// ---- thresholds, one file per scene -------------------------------------------------------------
// Each scene is asserted against its own numbers: its registry entry names the file, and the ```json block
// in it holds the two limits. Scene 1's is docs/PLAN-scores.md, unchanged. A scene whose file does not
// exist yet is SKIPPED with the reason printed -- never asserted against another scene's numbers, and
// never reported as though it had been asserted, because a check that cannot tell "passed" from "did not
// run" reports the second as the first.
//
// ONE VERDICT LINE, printed once, whatever combination of gates and thresholds this run had. The skipped
// gates are named on it, because it is the line a reader quotes: "PASS" alone would say the whole suite
// spoke about this scene when part of it did not.
// The score file has to exist before it can be read: a missing one is the ordinary state of a scene whose
// `compare` has not run yet, so it is one FAIL line naming what to run rather than an ENOENT stack trace
// out of this module.
if (!existsSync(scoresPath)) {
  console.error(
    `FAIL: ${scoresPath} is missing, so there are no scores to assert for scene ${scene.id}. Every gate `
    + 'above ran and passed; `npm run compare` writes that file, so run it (or npm run shot first, if it '
    + 'reports the render is missing or stale).',
  );
  process.exit(1);
}
const scores = JSON.parse(readFileSync(scoresPath, 'utf8'));
const thresholdsPath = scene.thresholds ?? null;
console.log(`\n== thresholds (${thresholdsPath ?? `none named for scene ${scene.id}`}) ==`);
if (skipped.length) {
  console.log(`skipped for scene ${scene.id}: ${skipped.join(', ')} (each said why above; they are another scene's gates)`);
}let asserted = false;
if (!thresholdsPath || !existsSync(thresholdsPath)) {
  console.log(
    `skip ${thresholdsPath ? `${thresholdsPath} does not exist` : `src/scenes.js names no thresholds file for scene ${scene.id}`}, `
    + `so the scores in ${scoresPath} are NOT asserted: cell color distance ${scores.cellDistance.toFixed(4)}, `
    + `grayscale SSIM ${scores.ssim.toFixed(4)}. A scene is asserted `
    + 'once its own ```json thresholds block exists, at the path its `thresholds:` field names.',
  );
} else {
  const doc = readFileSync(thresholdsPath, 'utf8');
  const block = doc.match(/```json\s*([\s\S]*?)```/);
  if (!block) {
    console.error(`FAIL: ${thresholdsPath} has no \`\`\`json thresholds block`);
    process.exit(1);
  }
  const thresholds = JSON.parse(block[1]);
  const checks = [
    ['cell color distance', scores.cellDistance, '<=', thresholds.cellDistanceMax],
    ['grayscale SSIM', scores.ssim, '>=', thresholds.ssimMin],
  ];
  let failed = false;
  for (const [name, value, op, limit] of checks) {
    const ok = op === '<=' ? value <= limit : value >= limit;
    if (!ok) failed = true;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${value.toFixed(4)} ${op} ${limit}`);
  }
  if (failed) {
    console.error('FAIL: scores are worse than the recorded thresholds');
    process.exit(1);
  }
  asserted = true;
}
const note = [];
if (skipped.length) note.push(`${skipped.length} gate(s) skipped: ${skipped.map((s) => s.replace('tools/', '').replace('.js', '')).join(', ')}`);
if (!asserted) note.push(`the scores of scene ${scene.id} are not asserted yet`);
console.log(`PASS${note.length ? ` (${note.join('; ')})` : ''}`);
// A run that established nothing must not read as a pass. Reachable only by a scene whose every gate is
// another scene's -- which is a registry mistake, not a scene, and it says so instead of printing PASS.
if (!asserted && skipped.length === GATES.length) {
  console.error(`FAIL: every gate in this list is another scene's, so this run established nothing about scene ${scene.id}`);
  process.exit(1);
}

}
