// npm run import-inert (and part of npm test): every tool in tools/ must LOAD and DO NOTHING when it is
// imported. Only the tool node was actually asked to run may run.
//
// This exists because the opposite happened, on main, on 2026-09-15: `node --input-type=module -e
// "import('./tools/animation.js')"` started a full animation run -- browser launched, frames printing --
// and was only stopped by someone killing it two minutes in. Seven tools had no main-module guard at all
// (`animation`, `compare`, `nudge`, `perf`, `placement`, `shot`, `test`, plus three diagnostics), so
// their whole bodies were module top-level code that ran on import. `tools/test.js` was the worst of
// them: importing it ran the entire suite.
//
// Nothing could have noticed. No gate imports a tool, so the defect lived in the one direction the gates
// never look, and it was found by accident. That is what this check is for: it is the only thing in the
// repo that loads a tool without running it.
//
// HOW: each tool is imported in its own child process, by the exact command that found the defect --
// `node --input-type=module -e "await import(<url>)"`. That form leaves `process.argv[1]` UNDEFINED,
// which is the case a hand-built guard gets wrong: `resolve(undefined)` throws rather than returning
// false, so a tool would crash on import instead of being inert. `isMainModule` in tools/serve.js checks
// for it first, and this is what exercises that line.
//
// A tool passes only if all three hold: it exits 0, it prints nothing at all, and it finishes before the
// timeout. A tool that starts a gate fails all three at once -- it prints, and it is still going when the
// clock runs out.
//
// RENDERER: none. Nothing here opens a browser, or should; a tool that opens one has already failed.
//
// BOUNDS. It proves a tool is inert on IMPORT, not that the tool works when run -- a guard whose
// condition is inverted would pass this and never run anything, which is the 2026-09-09 defect, and what
// catches that is the evidence marker in tools/test.js. It covers `tools/*.js` and nothing deeper, so a
// module under `tools/lib/` that did work at import is not seen (none does; they export functions). And
// the timeout is a ceiling, not a measurement: on a slow machine a tool that merely imports slowly could
// trip it, which is why the failure prints the seconds and the output beside each other.
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { isMainModule } from './serve.js';

// Generous: importing a tool is normally under a second (0.1 to 0.5 s on this machine), and the failure
// this exists for blows straight through any ceiling because it launches a browser.
export const TIMEOUT_MS = Number(process.env.IMPORT_INERT_TIMEOUT_MS) || 20_000;

export async function checkImportInert({ dir = 'tools' } = {}) {
  const tools = readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
  const rows = [];
  for (const file of tools) {
    const url = pathToFileURL(resolve(dir, file)).href;
    const started = Date.now();
    rows.push(await new Promise((done) => {
      const child = spawn(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(url)});`], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      child.stdout.on('data', (d) => { out += d; });
      child.stderr.on('data', (d) => { out += d; });
      const timer = setTimeout(() => child.kill('SIGKILL'), TIMEOUT_MS);
      child.on('close', (code, signal) => {
        clearTimeout(timer);
        done({ file, code, signal, seconds: (Date.now() - started) / 1000, out: out.trim() });
      });
    }));
  }
  return rows;
}

export function report(rows) {
  let bad = 0;
  for (const r of rows) {
    const problems = [];
    if (r.signal) problems.push(`still running after ${TIMEOUT_MS / 1000} s, killed`);
    else if (r.code !== 0) problems.push(`exited ${r.code}`);
    if (r.out) problems.push(`printed ${r.out.length} character(s): ${JSON.stringify(r.out.slice(0, 200))}`);
    if (problems.length) bad++;
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${`tools/${r.file}`.padEnd(26)} ${r.seconds.toFixed(1).padStart(5)} s  ${problems.join('; ') || 'inert on import'}`);
  }
  return bad;
}

if (isMainModule(import.meta.url)) {
  const rows = await checkImportInert();
  // A run that found no tools would print the same word as a run that checked them all, so the floor is
  // asserted before the verdict. Ten is under the seventeen there are and over any plausible pruning.
  if (rows.length < 10) {
    console.error(`FAIL: found only ${rows.length} tool(s) in tools/ to import, expected at least 10. Either the directory moved or this check ran somewhere it should not have; it reads tools/*.js relative to the working directory.`);
    process.exit(1);
  }
  const bad = report(rows);
  if (bad) {
    console.error('');
    console.error(`FAIL: ${bad} of ${rows.length} tool(s) do something when imported, and the worst case is that they run a whole gate.`);
    console.error("  Put the tool's main block inside `if (isMainModule(import.meta.url)) { … }`, with isMainModule");
    console.error('  imported from tools/serve.js. Do not hand-build the comparison: the form');
    console.error('  `import.meta.url === `file:///${process.argv[1]…}`` is false on every POSIX argv[1] and silently');
    console.error('  skipped four tools on CI for three days (docs/learning/gate-proofs.md).');
    process.exit(1);
  }
  console.log(`import-inert: all ${rows.length} tools in tools/ load and do nothing when imported, with no process.argv[1]`);
}
