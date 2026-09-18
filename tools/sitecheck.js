// Does the collected site carry every scene the registry advertises?
//
//   node tools/sitecheck.js [_site]
//
// WHY THIS EXISTS, AND THE DEFECT IT WAS WRITTEN FOR. On 2026-09-17 the deployed site failed for anyone who
// chose the White House scene, and every workflow run reported success. `src/boot.js` imports the selected
// scene's own entry module DYNAMICALLY (`await import(scene.entry)`), so the page asks for
// `src/whitehouse/main.js` only once someone picks that scene -- and `.github/workflows/pages.yml` collected
// `src/*.js`, which is scene 1's shape alone. The artifact was missing ten source files and one photograph
// that `src/scenes.js` advertised, and nothing looked. A deploy is not a verdict that the site works: this
// is the check that makes it one for that class.
//
// WHAT IT CHECKS, and it is the registry's own list rather than a second copy of it: for every entry in
// `SCENES`, the scene's `entry` (resolved from `src/`, the way index.html resolves it) and its `photo` (repo
// root, which is where the page fetches it from) must exist in the collected directory, and `index.html`
// must be there. A scene added to the registry tomorrow is checked the moment its entry is added, which is
// the property the old collection step did not have and could not have.
//
// BOUND, because a green check here proves less than it looks like. It reads the registry and the file
// list, so it proves THE ARTIFACT CARRIES WHAT THE REGISTRY NAMES; it does not load the page, run any
// scene, fetch the CDN, or follow a module's own imports. A file that exists and is broken passes, and a
// scene whose entry imports something the collection missed (an asset, a data file) passes too -- the
// collection copies `src/.` whole and every `*.webp`, which is the shape that makes this bound small, not
// zero. The browser gates are what prove a scene runs; this one proves it was shipped.
import { existsSync } from 'node:fs';
import { join, resolve, posix } from 'node:path';
import { isMainModule } from './serve.js';
import { SCENES } from '../src/scenes.js';

// `entry` is written the way an importer writes it (`./whitehouse/main.js`), and the page resolves it
// against `src/`, so that is where it is looked for. `photo` is fetched from the site root.
export function siteCheck(dir) {
  const root = resolve(dir);
  const wanted = [{ scene: '(page)', what: 'index.html', path: 'index.html' }];
  for (const scene of SCENES) {
    if (!scene.entry || !scene.photo) {
      throw new Error(`the registry entry for "${scene.id}" names no entry or no photo: got entry=${JSON.stringify(scene.entry)} photo=${JSON.stringify(scene.photo)}. Every scene has both (src/scenes.js), and a check that cannot find them here would pass on an artifact that cannot load the scene.`);
    }
    wanted.push({ scene: scene.id, what: 'entry', path: posix.join('src', scene.entry.replace(/^\.\//, '')) });
    wanted.push({ scene: scene.id, what: 'photo', path: scene.photo });
  }
  const missing = wanted.filter((w) => !existsSync(join(root, w.path)));
  return { root, wanted, missing };
}

if (isMainModule(import.meta.url)) {
  const dir = process.argv[2] ?? '_site';
  let result;
  try {
    result = siteCheck(dir);
  } catch (err) {
    console.error(`\nFAIL: ${err.message}`);
    process.exit(2);
  }
  const { wanted, missing } = result;
  if (missing.length) {
    console.error(`\nFAIL: ${missing.length} of ${wanted.length} files the registry names are not in ${dir}:`);
    for (const m of missing) console.error(`  ${m.path}  (${m.scene} ${m.what})`);
    console.error('\n  A scene the registry advertises has to be in the artifact: src/boot.js imports the');
    console.error('  selected scene entry dynamically, so a missing file is a 404 and a page that never');
    console.error('  loads, which no workflow step reported as a failure until this check existed.');
    console.error(`  Collect the site first (see .github/workflows/pages.yml), then: node tools/sitecheck.js ${dir}`);
    process.exit(1);
  }
  const scenes = new Set(wanted.map((w) => w.scene)).size - 1;
  console.log(`sitecheck: ${dir} carries all ${wanted.length} files the registry names (${scenes} scene(s) plus index.html), ${SCENES.length} in src/scenes.js`);
  console.log('  bound: it reads the registry and the file list -- the artifact is complete, the scene is not loaded or run');
}
