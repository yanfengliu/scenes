// npm run treecheck: do the sweep, the score and the render all describe the SAME scene source tree?
//
// ---- WHY --------------------------------------------------------------------------------------------
// A review of this scene holds two things: a `npm run compare` score, and a `npm run views` sweep looked
// at pose by pose. Saying anything useful needs them to be of one tree. Until 2026-09-15 that was a fact
// anyone could check, because `out/views/1-photo.png` came out byte-identical to `out/render.png`: one
// digest, two tools, same pixels, same tree. The GPU move ended it on purpose — `views` renders on the
// GPU (11 s against 291 s) and `shot` renders the scored contract on SwiftShader — so the two files now
// differ however identical the tree is, and the binding became an INFERENCE that nobody edited `src/` in
// between. The iteration 3 devlog states it in those words and copies out nine file hashes by hand.
//
// This is that inference turned back into a check. `shot` records the tree it rendered from in
// `out/render.tree.json`, `compare` copies it into `out/scores.json`, `views` writes it into
// `out/views/index.txt`, and this refuses to call them the same tree when they are not — naming the files
// that differ, which is the only form of the answer anyone can act on.
//
// ---- WHAT IT COMPARES -------------------------------------------------------------------------------
// Every artifact present, against the tree on disk RIGHT NOW and against each other. A missing artifact
// is reported as missing and its pairings are skipped; the run prints which pairings it actually made, so
// a run that compared nothing cannot read like a run that compared everything.
//
// ---- RENDERER ---------------------------------------------------------------------------------------
// None. It opens no browser and renders nothing; it reads four files and hashes a directory.
//
// ---- BOUND ------------------------------------------------------------------------------------------
// - It hashes `index.html` and `src/**` and nothing else (tools/lib/treehash.js says why). A `tools/`
//   edit that moved a frame, or a CDN serving different three.js bytes, changes no hash here.
// - It proves the artifacts AGREE about the tree. It does not prove either was produced correctly: a
//   sweep whose frames are black agrees with a score perfectly well. `views` warns on black frames and
//   on byte-identical poses; `compare` asserts the scores.
// - A sweep and a score of one tree can still be hours apart. Time is not what it checks, and does not
//   need to be: the tree is the thing the two claims are about.
// - Recording the tree does not make a sweep reproducible. That is a separate property and it belongs to
//   `views` (each pose settled to a fixed point of the frame loop's clamp); this tool would happily bind
//   a score to a sweep whose digests move.
import { existsSync, readFileSync } from 'node:fs';
import { sourceTree, shortHash, diffTrees } from './lib/treehash.js';
import { isMainModule } from './serve.js';

export const SCORES_PATH = 'out/scores.json';
export const RENDER_TREE_PATH = 'out/render.tree.json';
export const VIEWS_INDEX_PATH = 'out/views/index.txt';

// The manifest is plain text on purpose (tools/views.js says why), so the hash is read back out of it
// with the same line this tool's own sibling writes.
const VIEWS_TREE_RE = /^#\s*scene source tree\s+([0-9a-f]{64})\s+over\s+(\d+)\s+files/m;
// The whole line, so the `-- MIXTURE:` suffix views appends when the tree moved under its run can be
// seen. The line above stops at "files" because the suffix is optional.
const VIEWS_TREE_RE_LINE = /^#\s*scene source tree\s+[0-9a-f]{64}.*$/m;

// A truncated artifact throws a bare SyntaxError naming neither the file nor the fix. This is a gate's
// failure surface, so it names both.
function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    throw new Error(
      `${path} could not be read as JSON (${err.message}), so ${label} cannot be bound to a scene. It is `
      + 'written whole by the tool that produces it (npm run shot for out/render.tree.json, npm run compare '
      + 'for out/scores.json); a truncated one means that run was interrupted. Re-run it.',
    );
  }
}

export function readRecords({ root = '.' } = {}) {
  const at = (p) => (root === '.' ? p : `${root}/${p}`);
  const records = [];

  // Each of the three is read the same way, and the `hash` guard is not optional on any of them. A record
  // read without it yields `hash: undefined`, which prints a FAIL line and is then dropped by the
  // `filter((r) => r.hash)` below — so it produces no problem and the tool EXITS 0 having printed FAIL.
  // That is this tool's own stated failure class arriving inside the tool, and it was here, on the render
  // record only, until an independent critic traced it (2026-09-16).
  if (existsSync(at(RENDER_TREE_PATH))) {
    const j = readJson(at(RENDER_TREE_PATH), 'the render');
    if (j.sourceTree) records.push({ label: 'the render', what: `${RENDER_TREE_PATH} (npm run shot)`, hash: j.sourceTree, count: j.sourceFileCount, files: j.sourceFiles, extra: `render sha256 ${shortHash(j.renderSha256 ?? '')}, ${j.renderer ?? 'renderer unrecorded'}` });
    else records.push({ label: 'the render', what: `${RENDER_TREE_PATH} (npm run shot)`, stale: true });
  } else records.push({ label: 'the render', what: `${RENDER_TREE_PATH} (npm run shot)`, missing: true });

  if (existsSync(at(SCORES_PATH))) {
    const j = readJson(at(SCORES_PATH), 'the score');
    // `sourceFiles` is carried through by compare so the sweep-to-score pairing — the one this tool exists
    // for — can name the files that differ, and not just two hashes.
    if (j.sourceTree) records.push({ label: 'the score', what: `${SCORES_PATH} (npm run compare)`, hash: j.sourceTree, count: j.sourceFileCount, files: j.sourceFiles, extra: `cell ${j.cellDistance?.toFixed?.(4)}, ssim ${j.ssim?.toFixed?.(4)}` });
    else records.push({ label: 'the score', what: `${SCORES_PATH} (npm run compare)`, stale: true });
  } else records.push({ label: 'the score', what: `${SCORES_PATH} (npm run compare)`, missing: true });

  if (existsSync(at(VIEWS_INDEX_PATH))) {
    const text = readFileSync(at(VIEWS_INDEX_PATH), 'utf8');
    const m = text.match(VIEWS_TREE_RE);
    const sweep = text.match(/^#\s*npm run views\s+—\s+sweep\s+([0-9a-f]+)/m);
    // `views` marks its own line when the tree moved under the run, and writes the END hash. Without
    // this, a sweep whose frames are a mixture of two trees reads here as a clean sweep of the second
    // one — which is the exact failure the mixture warning exists to prevent, arriving one file later.
    // The manifest's own per-file lines, so the SWEEP-to-SCORE pairing — the pairing this tool exists
    // for — can name the file that differs instead of handing back two bare hashes. They carry 16-hex
    // prefixes, which is why `diffTrees` compares on the shorter of the two lengths.
    const files = [...text.matchAll(/^#\s{3}(\S+)\s+([0-9a-f]{16})\s*$/gm)].map(([, path, sha256]) => ({ path, sha256 }));
    if (m) records.push({ label: 'the sweep', what: `${VIEWS_INDEX_PATH} (npm run views)`, hash: m[1], count: Number(m[2]), files: files.length ? files : undefined, mixture: /MIXTURE/.test(text.match(VIEWS_TREE_RE_LINE)?.[0] ?? ''), extra: `sweep digest ${sweep ? sweep[1] : 'unrecorded'}` });
    else records.push({ label: 'the sweep', what: `${VIEWS_INDEX_PATH} (npm run views)`, stale: true });
  } else records.push({ label: 'the sweep', what: `${VIEWS_INDEX_PATH} (npm run views)`, missing: true });

  return records;
}

export function report(records, now) {
  const problems = [];
  console.log(`scene source tree on disk: ${now.hash} over ${now.count} files (index.html + src/**)`);
  for (const r of records) {
    if (r.missing) { console.log(`--   ${r.label.padEnd(10)} no record: ${r.what} is not there`); continue; }
    if (r.stale) {
      console.log(`FAIL ${r.label.padEnd(10)} ${r.what} records no scene source tree`);
      problems.push(
        `${r.what} carries no scene source tree, so ${r.label} cannot be bound to anything. It was written `
        + 'by a tool from before 2026-09-16, or by one that failed before it got there. Re-run that tool.',
      );
      continue;
    }
    const ok = r.hash === now.hash && !r.mixture;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${r.label.padEnd(10)} ${shortHash(r.hash)} over ${r.count} files — ${r.what}${r.extra ? `; ${r.extra}` : ''}${r.mixture ? '; MIXTURE' : ''}`);
    if (r.mixture) {
      problems.push(
        `${r.what} says the scene source CHANGED while it was being written, so ${r.label} is a mixture of `
        + `two trees and the ${shortHash(r.hash)} it records describes only the frames made after the edit. `
        + 'Binding anything to it would bind to a tree half of it never saw. Re-run that tool on a tree '
        + 'that is holding still.',
      );
    }
  }

  // Every present record against the tree on disk. Disagreeing with the CURRENT tree is the common case
  // and the useful one: it is what "you edited src/ after this was made" looks like.
  const present = records.filter((r) => r.hash);
  for (const r of present) {
    if (r.hash === now.hash) continue;
    const changed = r.files ? diffTrees({ files: r.files }, now, r.label, 'the tree on disk') : [];
    problems.push(
      `${r.what} was made from scene source ${shortHash(r.hash)} and the tree on disk is `
      + `${shortHash(now.hash)}, so ${r.label} describes a scene that is no longer here.`
      + (changed.length ? `\n    ${changed.join('\n    ')}` : '')
      + `\n    Re-run the tool that writes it, or check out the tree ${r.label} was made from.`,
    );
  }

  // And against each other, which is the question this tool exists for: the sweep and the score being
  // quoted side by side in a review.
  for (let i = 0; i < present.length; i++) {
    for (let j = i + 1; j < present.length; j++) {
      const a = present[i];
      const b = present[j];
      if (a.hash === b.hash) { console.log(`ok   ${a.label} and ${b.label} are of one tree`); continue; }
      const changed = a.files && b.files ? diffTrees({ files: a.files }, { files: b.files }, a.label, b.label) : [];
      problems.push(
        `${a.label} and ${b.label} are NOT of the same scene: ${a.what} records ${shortHash(a.hash)} and `
        + `${b.what} records ${shortHash(b.hash)}. Quoting them together claims something neither one says.`
        + (changed.length ? `\n    ${changed.join('\n    ')}` : '')
        + '\n    Re-run whichever is older so both come from one tree.',
      );
    }
  }

  // A run that found one artifact and a run that found all three both print "ok" lines, so say which
  // pairings were actually made. Nothing here is a pass if nothing was compared.
  const pairs = (present.length * (present.length - 1)) / 2;
  console.log(
    `treecheck: ${present.length} of ${records.length} records present (${present.map((r) => r.label).join(', ') || 'none'}), `
    + `${present.length} checked against the tree on disk and ${pairs} pairing(s) checked against each other`,
  );
  if (!present.length) {
    problems.push(
      `none of ${[RENDER_TREE_PATH, SCORES_PATH, VIEWS_INDEX_PATH].join(', ')} carries a scene source tree, `
      + 'so this run compared nothing and proves nothing. Run npm run shot and npm run compare (and '
      + 'npm run views for a sweep) and then this again.',
    );
  }
  return problems;
}

if (isMainModule(import.meta.url)) {
  const now = sourceTree();
  const problems = report(readRecords(), now);
  if (problems.length) {
    console.error(`\nFAIL: ${problems.length} tree-binding problem(s):`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
}
