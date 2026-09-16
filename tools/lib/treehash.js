// The sha256 of the scene's own source tree: `index.html` plus everything under `src/`, which is
// everything the browser loads and therefore everything that decides what a frame looks like.
//
// ---- WHY THIS EXISTS --------------------------------------------------------------------------------
// Until 2026-09-16 the sweep and the score were bound to each other by a DIGEST: `out/views/1-photo.png`
// was byte-identical to `out/render.png`, so a review holding both could see they came from one tree.
// The GPU move broke that by design — `views` renders on the GPU (11 s against 291 s) and `shot` stays on
// SwiftShader (the scored contract) — so the two files differ now however identical the tree is, and what
// replaced the binding was an INFERENCE: that nobody edited `src/` between the two runs. The iteration 3
// devlog says so in as many words, and lists nine file hashes copied out by hand to make the point.
// A claim nobody can check is a claim that is true until it is not.
//
// So each tool records the tree it rendered from, and `npm run treecheck` refuses to call a sweep and a
// score the same tree when those records differ. The renderers stay where they are.
//
// ---- WHAT IS HASHED ---------------------------------------------------------------------------------
// `index.html` and every file under `src/`, recursively. Recursively because a new scene is "a registry
// entry plus its own folder under src/" (AGENTS.md), so a scene in a subdirectory must not escape the
// binding. Paths are normalised to forward slashes and sorted.
//
// CRLF IS NORMALISED TO LF BEFORE HASHING, and that is not tidiness. This repo has `core.autocrlf = true`
// and no `.gitattributes`, so the SAME COMMIT is CRLF in a Windows checkout and LF on `ubuntu-latest`.
// Hashing raw bytes made the hash a property of the reviewer's git config rather than of the commit:
// measured on this tree, `src/layout.js` has 775 CRLF line endings on disk and the two hashes are
//     as on disk (CRLF): 3811005047643b3b7c6e06d5c7bf5cb6ec94fdcd531010cfdf405af7db1c860b
//     LF-normalised    : dda00820d3825d48b8e88f65a98e400b716ac391fe6591f42bd5c220037919da
// No gate broke on that — every record in one run is computed on one checkout — but a 64-hex hash quoted
// in a review would have meant nothing across machines, and anyone re-running `treecheck` on Linux
// against artifacts made here would have got a false red naming every file as changed. Normalising costs
// the ability to notice a pure line-ending change, which moves no pixel and which git is already hiding.
// Found by an independent critic (2026-09-16), which is also when this paragraph replaced a sentence
// claiming the hash was "the same on Windows and on a runner" when it was not.
//
// NOT hashed: `tools/`, `japan.webp`, `package.json`, `node_modules`. This hash answers "did the SCENE
// change", which is the question the sweep and the score disagree about. A tools edit that changed a
// frame would slip through it, which is the bound below and the reason `views` records the renderer too.
//
// ---- BOUND ------------------------------------------------------------------------------------------
// - It covers the scene's source, not the whole build. The three.js modules come from a pinned CDN and
//   are not hashed; a CDN that served different bytes would move the frame and not the hash.
// - It is read from DISK at the moment it is called, not from what the page loaded. `views` and `shot`
//   each call it twice, before and after their frames, and fail if the two differ — that is what turns
//   "the tree did not change under this run" from an assumption into a check.
// - A walk that finds nothing hashes to a constant, and a constant makes every artifact AGREE. So the
//   floor below is asserted rather than trusted: this is the "cannot tell passed from did not run" case,
//   and it is the one failure mode that would make the whole binding report green while proving nothing.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// index.html plus src/. Anything the page fetches from this repo is under one of these.
export const SOURCE_PATHS = ['index.html', 'src'];
// This repo has 27 (index.html + 26 files in src/). The floor is well under that and well over any
// plausible pruning; it exists because zero files is the value that makes every comparison pass.
export const MIN_FILES = 10;

// CRLF -> LF, so the hash names the commit and not the checkout. Everything hashed here is text by
// repository rule (AGENTS.md: nothing binary enters Git except japan.webp and docs/render.webp, neither
// of which is under src/), and a buffer with no CR is returned unchanged.
function toLf(buf) {
  if (!buf.includes(13)) return buf;
  const out = Buffer.allocUnsafe(buf.length);
  let n = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 13 && buf[i + 1] === 10) continue;
    out[n++] = buf[i];
  }
  return out.subarray(0, n);
}

function walk(root, p, out) {
  const abs = join(root, p);
  const st = statSync(abs);
  if (st.isDirectory()) {
    for (const entry of readdirSync(abs).sort()) walk(root, join(p, entry), out);
  } else if (st.isFile()) {
    out.push({
      path: p.split(sep).join('/'),
      sha256: createHash('sha256').update(toLf(readFileSync(abs))).digest('hex'),
    });
  }
}

// { hash, files: [{ path, sha256 }], count }. `hash` is over "path sha256" lines, so it moves when a file
// moves as well as when its bytes do.
export function sourceTree({ root = '.', paths = SOURCE_PATHS } = {}) {
  const files = [];
  for (const p of paths) {
    try {
      walk(root, p, files);
    } catch (err) {
      throw new Error(
        `cannot hash the scene source at "${relative('.', join(root, p)) || p}": ${err.message}. `
        + 'The source-tree hash binds a views sweep to a compare score (tools/lib/treehash.js); it is read '
        + `from disk relative to the working directory, so run this tool from the repo root. Expected `
        + `${paths.join(' and ')}.`,
      );
    }
  }
  files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  if (files.length < MIN_FILES) {
    throw new Error(
      `the scene source hash found only ${files.length} file(s) under ${paths.join(' and ')}, under the `
      + `${MIN_FILES} this repo has (27: index.html and 26 in src/). An empty or near-empty walk hashes to `
      + 'a constant, and a constant makes every sweep and every score AGREE about the tree — which is the '
      + 'one way this check could report green while proving nothing. Run from the repo root.',
    );
  }
  const hash = createHash('sha256').update(files.map((f) => `${f.path} ${f.sha256}`).join('\n')).digest('hex');
  return { hash, files, count: files.length };
}

// Short form for a log line or a manifest. Long enough that a collision is not the thing to worry about.
export function shortHash(hash) {
  return String(hash).slice(0, 16);
}

// Which files differ between two `sourceTree()` results, as readable lines. This is what turns "the
// hashes differ" into "src/layout.js changed", which is the only form of the message anyone can act on.
// One side may carry SHORTENED hashes: `out/views/index.txt` lists 16 hex characters per file, because it
// is a manifest a person reads. So two hashes match when the shorter is a prefix of the longer — which is
// what lets the sweep be diffed against the render and the score at all.
function sameHash(x, y) {
  const n = Math.min(x.length, y.length);
  return x.slice(0, n) === y.slice(0, n);
}

export function diffTrees(a, b, labelA = 'a', labelB = 'b') {
  const mapA = new Map((a?.files ?? []).map((f) => [f.path, f.sha256]));
  const mapB = new Map((b?.files ?? []).map((f) => [f.path, f.sha256]));
  const lines = [];
  for (const [path, sha] of mapA) {
    if (!mapB.has(path)) lines.push(`${path}: in ${labelA} only`);
    else if (!sameHash(mapB.get(path), sha)) lines.push(`${path}: ${shortHash(sha)} in ${labelA}, ${shortHash(mapB.get(path))} in ${labelB}`);
  }
  for (const path of mapB.keys()) if (!mapA.has(path)) lines.push(`${path}: in ${labelB} only`);
  return lines.sort();
}
