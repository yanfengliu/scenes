// Name-rule gate (run by npm test): a mesh NAME is load-bearing in several rules that do not know about
// each other, so every one of those rules' populations is pinned to a manifest and a rename that moves
// any of them goes red.
//
// ---- CLAIM ------------------------------------------------------------------------------------------
// Every rule in this repo that SELECTS MESHES BY NAME is registered here; each one's population — the
// sorted list of names it matches in the BUILT scene — equals the list recorded in tools/name-manifest.json;
// the shadow pass is the size recorded there; and no new string-matching site has appeared in the files
// those rules live in. Any of those changing fails the gate until the manifest is updated with a reason,
// in the same change.
//
// ---- WHY --------------------------------------------------------------------------------------------
// Iteration 4 added two shared instanced sets called `far roof ridges` and `far roof lips`. A critic
// found they widened `PLACEMENT_CHECKS`'s `far roof` check, which is satisfied by any mesh whose name
// STARTS WITH that, so a lip anywhere in the row could answer a check about one photo position. They were
// renamed to `far house ridges` and `far house lips` — and `NO_CAST` in src/lighting.js, a different rule
// in a different file, already excluded `far roof` from the shadow pass. The rename put 37 instances at
// 22 to 34 m into the shadow map. The shot went 364 to 366 draw calls and EVERY GATE STAYED GREEN.
//
// Nothing could have caught it. `placement` asserts the check still passes, and it did. `shot` prints the
// draw-call count and asserts nothing about it. `perf` has a 400 budget and 366 is inside it. The only
// signal was a two-call move in a printed number, and a number that is only printed is a number that gets
// explained away — it was attributed to frustum culling in writing before a second critic round
// decomposed the frame and measured it both ways.
//
// So the defect is not "a wrong name". It is that a name is an INTERFACE between rules that were written
// years apart in files that do not import each other, and changing it is a change to all of them at once.
// This gate makes that change visible.
//
// ---- RENDERER ---------------------------------------------------------------------------------------
// THE GPU, and no settling frames, for `placement`'s reason: no pixel enters the verdict. Everything here
// is names and flags read off the scene graph after three built it. `NAMERULES_GPU=0` (or `GATES_GPU=0`)
// forces SwiftShader, which is what CI gets; the summary line names the renderer it got either way. The
// page is 640x480 because its size cannot matter — see the draw-call note under BOUNDS.
//
// ---- HOW --------------------------------------------------------------------------------------------
// Two halves, and they are deliberately different kinds of check.
//
// 1. THE RULES THEMSELVES are read out of the files they live in, as text, and EVALUATED — not
//    re-implemented here. `NO_CAST` in src/lighting.js is a `const`, not an export, and clearance's five
//    lists are locals inside the function it hands to `page.evaluate`; neither can be imported. So this
//    tool finds the single-line `const NAME = <expression>;` declaration, takes the expression's text,
//    and builds it with `new Function`. A re-implementation would be this gate agreeing with a copy of
//    the rule rather than with the rule, and would go on passing after the rule changed. The expression's
//    text is recorded in the manifest too, so an edit to a rule that happens to move no population is
//    still red.
//
//    `PLACEMENT_CHECKS` and `GROUNDING_CHECKS` ARE exported, so those are imported from src/layout.js.
//    What is re-implemented for those two is how tools/placement.js matches — `startsWith` for a check's
//    `mesh`, `===` for a grounding entry's own `name` — and that re-implementation is pinned from the
//    other side by the site scan below, which carries placement.js's two matching lines verbatim.
//
// 2. THE POPULATIONS come from the BUILT SCENE, never from a list of names typed here. One `page.evaluate`
//    returns every mesh's name, its `castShadow` flag and its instance count; the rules are applied to
//    those names in node.
//
// The two halves cross-check each other in one place, and it is the place the defect lived: every mesh
// `NO_CAST` matches must have `castShadow === false` in the built scene. If the expression this tool
// evaluated is not the one `applyShadowFlags` applied, that assertion parts.
//
// ---- THE SITE SCAN ----------------------------------------------------------------------------------
// A rule this tool does not know about is a rule it cannot pin, and "grep for it once" is not a check. So
// every `.test(`, `.startsWith(`, `.includes(`, `.endsWith(` and `.match(` site in src/*.js and in the
// two tools that carry mesh-name rules is collected, by its own line text, and compared with the
// manifest's list. A new one is red with a message asking whether it selects meshes: if it does, register
// it in RULES; if it does not, record it with `--update` and say so.
//
// It is line TEXT and not line numbers, so an edit above a site does not red this; and it is a sorted
// unique list, so moving a site within its file does not either.
//
// ---- UPDATING THE MANIFEST --------------------------------------------------------------------------
//     node tools/namerules.js --update "why the populations moved"
//
// The reason is required and must differ from the recorded one. That is the whole of the ceremony, and
// its honest description is below under BOUNDS.
//
// ---- BOUNDS, and several of them are real ------------------------------------------------------------
// - **The manifest can be rewritten by one command.** Nothing here can tell a considered update from a
//   rubber stamp; what it can do is make the update a visible diff in a tracked file that names what
//   moved, and refuse a silent one. The value is that a rename now cannot be invisible, not that it
//   cannot be waved through. **And that one command clears EVERY class of finding at once** — not only a
//   moved population, but a new unregistered site, a changed rule text and all three scene totals. So an
//   update whose reason mentions only a rename also launders a rule nobody registered. A critic asked for
//   that sentence and it belongs here rather than in a review nobody will read again.
// - **It pins populations, not correctness.** A rename that is right and a rename that is wrong move a
//   population identically. This gate asks "did anything move"; deciding is the reviewer's.
// - **The site scan covers src/*.js, tools/clearance.js and tools/placement.js, and NOT this file.** A
//   checker that scanned itself would red on its own patterns. A rule added anywhere else — a new tool, a
//   module under tools/lib/ — is outside it. It also cannot tell a name rule from any other string match:
//   it reports 17 sites today, of which 14 select meshes. The three that do not are `src/debug.js`'s
//   `rgba(…)` test on a CSS colour and `src/animation.js`'s two `uniforms.includes(uniform)` guards, which
//   match objects rather than names. Counted by hand from the manifest's own `sites` list on 2026-09-16;
//   the tool cannot count it, which is the bound. It was written as 9 of 14 first, in three places.
// - **The scan is blind to some matching IDIOMS, not only to some files**, and that is the bound that made
//   this gate's CLAIM false when it was written. It matched five method names, so `o.name === 'cherry
//   trunk'` — a whole-name mesh rule in `tools/clearance.js`, a file it already read — was invisible, and
//   so were `NAMES.has(o.name)`, `RE.exec(o.name)`, `o.name.indexOf(…)`, `o.name.search(…)`,
//   `(o.name || '').split(' ')[0]`, `getObjectByName` and a `switch` on the name. Found by an independent
//   critic. All of those are covered now and that lookup is registered, but the shape of the bound stands:
//   a rule holding the name in a variable spelled something other than `name`, using none of the five
//   matchers, is still invisible.
// - **It reads the rules' TEXT, and the earlier claim about that was wrong.** This once said a rule split
//   across lines "fails rather than passing — which is the right direction". It did not. The declaration
//   scan counted only SINGLE-LINE declarations, so a real rule reformatted across lines was not counted at
//   all, and an old one-liner left behind in a `/* … */` block or a template literal then matched "exactly
//   once" — the tool evaluated the DEAD copy and reported its population, green. The `castShadow`
//   cross-check does not catch it either: a stale copy is normally a subset of the live rule, and a subset
//   passes. Found by an independent critic, who built it. Every `const <ident>` binding in the file is now
//   counted first and must be 1, whatever line it is on; the single-line form is read only after that.
//   The cost is that a comment writing the words `const NO_CAST` reds this gate, which is the safe
//   direction, and that the shape of the declaration is still part of the contract.
// - **The draw-call count is printed and NOT asserted.** `renderer.info.render.calls` is what the last
//   completed frame drew, so it moves with frustum culling, the canvas size and which frame the page was
//   on. What IS asserted is `shadowCasters`, the count `applyShadowFlags` returns, which is a pure
//   function of the names, box sizes and centres and has no camera in it — and that is the term the 2026
//   rename moved, cleanly, without the culling.
// - **Instance counts are printed and not asserted.** They move when the canopy re-rolls its PRNG, which
//   is content and not naming, and asserting them would make this gate red on every vegetation edit.
// - **`NO_CAST` matches two light names too** (`sun` and `fill`). Lights are not meshes, so they are not
//   in the population here; `applyShadowFlags` returns before the test for the same reason.
// - **`SURFACE_WORDS` and `PLANT_WORDS` are applied here to EVERY mesh**, while clearance applies them to
//   the building set alone. So these two populations are a superset of the ones that gate reads, on
//   purpose: the rule is about names, and a new `… slabs` mesh anywhere should be visible here whichever
//   set clearance happens to have put it in. Their counts here cannot be compared with clearance's own
//   printed classification figures.
// - **EVERY clearance rule is applied here independently, and clearance applies them as a FIRST-MATCH-WINS
//   chain** (`WALK → TERRACE → CANOPY → TERRAIN || LIVING`). So the same superset caveat covers all of
//   them, not just the two word lists: `CANOPY` and `LIVING` overlap on exactly `cherry blossoms` and
//   `cherry strands`, so the `LIVING` population pinned here is 23 where the set clearance actually builds
//   is 21. Consequence, and it is a real hole: REORDERING that chain moves clearance's real sets and this
//   gate stays green, because the site scan is a sorted unique set of line texts and is deliberately blind
//   to order. Found by an independent critic.
// - **WHAT IS RE-IMPLEMENTED, and it is the softest joint in this gate.** `PLACEMENT_CHECKS` and
//   `GROUNDING_CHECKS` are imported, but how `tools/placement.js` MATCHES them — `startsWith` for a
//   check's `mesh`, `===` for a grounding entry's own `name` — is written again in `importedRules()`.
//   Nothing measures that the two still agree, the way the `castShadow` cross-check measures it for
//   `NO_CAST`. What covers it is the site scan carrying placement.js's two matching lines verbatim, so
//   changing either one is red — a weaker guard, and it is weaker on purpose only because there is no
//   flag on the scene graph that records how a raycast hit was matched.
// - **NOT PROVED RED: the floors.** The four below — 100 meshes (255 shipped), 30 rules (52), 10 sites
//   (14) and a non-zero shadow-caster count (98) — plus the duplicate-id floor, which fires only if two
//   `PLACEMENT_CHECKS` share a `name`. No scene was built that would trip any of them, exactly as
//   `clearance`'s floors were never tripped. They are calibrated from the shipped figures and nothing
//   else, and that is the whole of the argument under them.
// - **The renderer does not enter the verdict, and that is measured rather than argued.**
//   `GATES_GPU=0` on SwiftShader prints the same 52 rules, the same 255 meshes under 255 names, the same
//   98 shadow casters, and even the same 370 draw calls and 745,206 triangles. So the manifest is a
//   property of the scene and not of the driver, and CI is held to the numbers recorded here.
// `isMainModule` comes from serve.js and is never hand-built here: the hand-built form is how four tools
// came to skip their whole main block on every CI run for three days (docs/learning/gate-proofs.md).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isMainModule, startServer } from './serve.js';
import { launch, collectErrors, openScene, rendererTag, wantsGpu, ACTION_TIMEOUT_MS } from './lib/browser.js';
import { PLACEMENT_CHECKS, GROUNDING_CHECKS } from '../src/layout.js';

export const MANIFEST_PATH = 'tools/name-manifest.json';

// The files the site scan reads: every scene module, plus the two tools that carry mesh-name rules of
// their own. `tools/namerules.js` is excluded because a checker that scanned itself would red on its own
// patterns; that exclusion is a bound and is stated in the header.
export function scanFiles() {
  let src;
  try {
    src = readdirSync('src').filter((f) => f.endsWith('.js')).sort().map((f) => `src/${f}`);
  } catch (err) {
    throw new Error(
      `the scene's modules could not be listed: ${err.message}. This gate reads src/*.js relative to the `
      + 'working directory, so run it from the repository root (`npm run namerules`). A scan that found no '
      + 'files would report "no new rules" for a directory it never opened.',
    );
  }
  return [...src, 'tools/clearance.js', 'tools/placement.js'];
}

// Anything that picks a string apart or compares one. Deliberately wider than "name rule": the point is
// that a NEW one is noticed, and this tool cannot decide what a new one selects.
//
// It was five method names until a critic found the counter-example that made this gate's own CLAIM
// false: `tools/clearance.js`'s trunk lookup is `o.name === 'cherry trunk'`, a whole-name mesh rule, in a
// file this scan already reads, matched by none of the five. The critic's full list of idioms that were
// invisible — `o.name === '…'`, `NAMES.has(o.name)`, `RE.exec(o.name)`, `o.name.indexOf('far ') === 0`,
// `(o.name || '').split(' ')[0]`, `o.name.search(RE)`, `scene.getObjectByName('…')` and a `switch` on the
// name — is now covered except for `switch`, which is below.
//
// `split`/`slice`/`indexOf` are here for a reason that is not obvious: changing the INPUT is as good as
// changing the rule. `const n = (o.name || '').split(' ')[0]` moves clearance's whole classification while
// every declaration and every population this tool computes stays put, so without that token the gate
// would be green on it.
// Three conditions, ORed, and the split is what keeps the list reviewable. Taking every string method
// unconditionally took the scan from 14 sites to 41, and 20 of the new ones were `.replace()` on GLSL
// source in `src/animation.js`, `src/materials.js` and `src/instancing.js` — shader edits that have
// nothing to do with names and would red this gate on every vegetation change until someone stopped
// reading the list.
//
// 1. The five matchers a rule is usually written with, unconditionally. `first.startsWith(c.mesh)` in
//    placement.js mentions no `name` at all and is one of the two lines that pin this gate's own
//    re-implementation, so this condition cannot be made conditional on the word.
// 2. Any line that MENTIONS a name and does something to it — a comparison, a split, a lookup, a switch.
//    This is what catches the idioms the five methods miss.
// 3. `getObjectByName`, which names no variable at all.
const SITE_METHODS = /\.(?:test|startsWith|includes|endsWith|match)\s*\(/;
const SITE_NAME = /\bname\b/i;
const SITE_NAME_OP = /===|!==|[^=!<>]==[^=]|!=[^=]|\.(?:exec|indexOf|lastIndexOf|search|split|slice|substring|substr|has|get|replace|trim|toLowerCase|toUpperCase|localeCompare)\s*\(|\bswitch\s*\(/;
const SITE_BY_NAME = /getObjectByName\s*\(/;
export function isSite(line) {
  return SITE_METHODS.test(line) || SITE_BY_NAME.test(line) || (SITE_NAME.test(line) && SITE_NAME_OP.test(line));
}
// NOT covered, and stated rather than left to be discovered: a rule that holds the name in a variable
// spelled something other than `name` AND uses none of the five matchers; and any rule in a file this
// scan does not read. The scan is a net with a stated mesh size, not a proof.

// CRLF is normalised before anything is read, because this repo has `core.autocrlf = true` and no
// `.gitattributes`: the same commit is CRLF here and LF on a runner, and without this the manifest would
// be a property of the checkout rather than of the commit. `treecheck` hit exactly this
// (docs/learning/gate-proofs.md) and the fix is the same one.
function readSource(file) {
  return readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

// Every rule that selects meshes by name. `kind: 'declared'` is read out of its file and evaluated;
// `kind: 'imported'` comes from src/layout.js, which exports it.
export const RULES = [
  { id: 'src/lighting.js NO_CAST', kind: 'declared', file: 'src/lighting.js', ident: 'NO_CAST', what: 'excluded from the shadow pass' },
  { id: 'tools/clearance.js WALK', kind: 'declared', file: 'tools/clearance.js', ident: 'WALK', what: 'the walkable street' },
  { id: 'tools/clearance.js TERRACE', kind: 'declared', file: 'tools/clearance.js', ident: 'TERRACE', what: 'the right terrace' },
  { id: 'tools/clearance.js TERRAIN', kind: 'declared', file: 'tools/clearance.js', ident: 'TERRAIN', what: 'terrain and backdrop' },
  { id: 'tools/clearance.js LIVING', kind: 'declared', file: 'tools/clearance.js', ident: 'LIVING', what: 'plants and the person' },
  { id: 'tools/clearance.js CANOPY', kind: 'declared', file: 'tools/clearance.js', ident: 'CANOPY', what: 'measured for headroom' },
  { id: 'tools/clearance.js SURFACE_WORDS', kind: 'declared', file: 'tools/clearance.js', ident: 'SURFACE_WORDS', what: 'names that say "walking surface"', list: true },
  { id: 'tools/clearance.js PLANT_WORDS', kind: 'declared', file: 'tools/clearance.js', ident: 'PLANT_WORDS', what: 'names that say "growing thing"', list: true },
  { id: 'tools/clearance.js BEYOND_BLOCKERS', kind: 'declared', file: 'tools/clearance.js', ident: 'BEYOND_BLOCKERS', what: 'exempt past the bend', exact: true },
  // Not a `const` at all: a whole name written inline at the point of use. An independent critic found it
  // by asking what the site scan could not see, and it is the reason this gate's CLAIM was false when it
  // was first written. It is load-bearing — clearance's low-wood assertion runs only if this lookup hits,
  // and that gate's own failure text says so.
  { id: 'tools/clearance.js trunk lookup', kind: 'inline', file: 'tools/clearance.js', anchor: 'trunkMesh.push(o)', what: 'the trunk whose low wood is measured', exactLiteral: true },
];

// The single-line `const NAME = <expression>;` declaration, and the expression's own text.
//
// TWO counts, not one, and the first is the one that matters. An independent critic broke the earlier
// version of this function with a mutation worth stating in full: reformat a long regex across several
// lines — `NO_CAST` is a 200-character line, exactly the thing someone reformats — and leave the old
// one-liner behind inside a `/* … */` block or a template literal. The old code counted only SINGLE-LINE
// declarations, so the real multi-line one was not counted at all and the dead copy matched "exactly
// once". The tool then evaluated the copy that does not run and reported its population with full
// confidence, green. The `castShadow` cross-check does not save it either: a stale copy is normally a
// SUBSET of the live rule, and a subset passes that check.
//
// So: every `const <ident>` BINDING anywhere in the file is counted first, in any shape, comments and
// strings included. That count must be 1. Only then is the single-line form read, and it must be the same
// line. A comment that merely writes the words `const NO_CAST` reds this gate, which is the safe
// direction and is the cost of the check.
export function declarationOf(text, file, ident) {
  const lines = text.split('\n');
  const bind = new RegExp(`\\bconst\\s+${ident}\\b`);
  const mentions = [];
  lines.forEach((line, i) => { if (bind.test(line)) mentions.push(i + 1); });
  // A trailing line comment is allowed: `export const BEYOND_ROWS_MAX = 6; // shipped 3` is this repo's
  // own house style, and the first version of this regex reddened on it with a message naming four
  // causes, none of which was the real one.
  const re = new RegExp(`^\\s*(?:export\\s+)?const\\s+${ident}\\s*=\\s*(.+?);\\s*(?://.*)?$`);
  const hits = [];
  lines.forEach((line, i) => {
    const m = line.match(re);
    if (m) hits.push({ line: i + 1, source: m[1] });
  });
  const where = (ls) => (ls.length ? ` (line${ls.length > 1 ? 's' : ''} ${ls.join(', ')})` : '');
  if (mentions.length !== 1) {
    throw new Error(
      `the rule "${ident}" is registered in tools/namerules.js as living in ${file}, and that file binds `
      + `\`const ${ident}\` ${mentions.length} time(s)${where(mentions)}. This gate reads a rule out of its `
      + 'own file rather than re-implementing it, so it needs exactly one — with two, it would pick one and '
      + 'report its population as if that were the rule that runs. A second one is usually an old copy left '
      + 'in a comment or a template literal after the real rule was reformatted across lines. Delete the '
      + `copy, or update the RULES table in tools/namerules.js. If ${ident} is gone, remove its entry there.`,
    );
  }
  if (hits.length !== 1 || hits[0].line !== mentions[0]) {
    throw new Error(
      `the rule "${ident}" is bound once in ${file}, at line ${mentions[0]}, and this gate cannot read it: `
      + `it found ${hits.length} single-line \`const ${ident} = …;\` declaration(s)${where(hits.map((h) => h.line))}. `
      + 'It reads a rule as the text of a one-line declaration, so the rule must be written on one line, '
      + 'ending in `;` with at most a `//` comment after it, and must be `const` rather than `let`. Put it '
      + 'back on one line, or register it differently in tools/namerules.js.',
    );
  }
  return hits[0];
}

// A whole name written inline at the point of use, rather than declared. Found by its own line — the
// `anchor` must identify exactly one line — and read as the quoted literal compared against a `name`
// there. The literal goes into the manifest as the rule's source, so changing which name that line looks
// for is red even though the population would move with it anyway.
export function inlineLiteralOf(text, file, rule) {
  const lines = text.split('\n');
  const found = [];
  lines.forEach((line, i) => { if (line.includes(rule.anchor)) found.push({ line: i + 1, text: line }); });
  if (found.length !== 1) {
    throw new Error(
      `the inline rule "${rule.id}" is anchored on the text \`${rule.anchor}\` in ${file}, and that appears `
      + `${found.length} time(s)${found.length ? ` (line${found.length > 1 ? 's' : ''} ${found.map((f) => f.line).join(', ')})` : ''}. `
      + 'The anchor has to pick out exactly one line, because this gate reads the name that line compares '
      + 'against. Give it a more specific anchor in the RULES table in tools/namerules.js, or remove the '
      + 'entry if the rule is gone.',
    );
  }
  const m = found[0].text.match(/\bname\b[^=!]*(?:===|==)\s*(['"])(.*?)\1|(['"])(.*?)\3\s*(?:===|==)[^=]*\bname\b/);
  if (!m) {
    throw new Error(
      `the inline rule "${rule.id}" was found at ${file}:${found[0].line}, and this gate could not read a `
      + `quoted mesh name being compared against a \`name\` on it: \`${found[0].text.trim()}\`. It reads the `
      + 'shape `o.name === \'some mesh\'`. If that line now selects meshes another way, register it '
      + 'differently in tools/namerules.js; if it no longer selects meshes, remove its entry.',
    );
  }
  return { line: found[0].line, source: JSON.stringify(m[2] ?? m[4]) };
}

// Build the rule from its own text. `new Function` rather than a copy of the rule written here: a copy is
// this gate agreeing with itself, and it would go on passing after the rule changed.
export function matcherFor(rule, source) {
  let value;
  try {
    value = new Function(`"use strict"; return (${source});`)();
  } catch (err) {
    throw new Error(
      `the rule "${rule.ident}" in ${rule.file} could not be evaluated on its own: ${err.message}. Its `
      + `text is \`${source}\`. This gate builds each rule from the expression in its declaration, so a `
      + 'rule that refers to anything outside itself cannot be read this way; give it a self-contained '
      + 'expression, or register it differently in tools/namerules.js.',
    );
  }
  if (value instanceof RegExp) {
    // A `g` or `y` regex carries `lastIndex` between calls, so the same name would match or not depending
    // on what was tested before it. No rule here has one; a rule that grew one would silently measure a
    // different population, so it is refused rather than worked around.
    if (value.flags.includes('g') || value.flags.includes('y')) {
      throw new Error(
        `the rule "${rule.ident}" in ${rule.file} is a regex with the \`${value.flags}\` flag. A sticky or `
        + 'global regex keeps `lastIndex` between calls, so testing a list of names against it gives a '
        + 'different answer depending on the order. Drop the flag, or test it with `.test` on a fresh copy.',
      );
    }
    return (name) => value.test(name);
  }
  if (rule.list || rule.exact) {
    if (!Array.isArray(value)) {
      throw new Error(`the rule "${rule.ident}" in ${rule.file} is registered as a list and evaluated to ${typeof value}: \`${source}\`.`);
    }
    // `exact` is a list of whole names (BEYOND_BLOCKERS); `list` is a list of substrings (the word lists).
    return rule.exact
      ? (name) => value.includes(name)
      : (name) => value.some((w) => String(name).toLowerCase().includes(w));
  }
  if (typeof value === 'function') {
    // Smoke-tested before it is handed back. An arrow that closes over module scope — `(n) =>
    // n.startsWith(PREFIX)` — builds without complaint and throws only when CALLED, so without this the
    // failure escapes the named handler above and surfaces as a bare `FAIL: PREFIX is not defined`, which
    // names no rule, no file and nothing that would satisfy the gate.
    try {
      value('a probe name that matches nothing');
    } catch (err) {
      throw new Error(
        `the rule "${rule.ident}" in ${rule.file} built as a function but threw the moment it was given a `
        + `name: ${err.message}. Its text is \`${source}\`. This gate builds each rule from the expression `
        + 'in its declaration, so a rule that refers to anything outside itself cannot be read this way — '
        + 'a captured constant is the usual cause. Inline what it refers to, or register it differently in '
        + 'tools/namerules.js.',
      );
    }
    return (name) => Boolean(value(name));
  }
  throw new Error(
    `the rule "${rule.ident}" in ${rule.file} evaluated to ${typeof value}, which is neither a regex, a `
    + `function nor a list: \`${source}\`. Register what it is in the RULES table in tools/namerules.js.`,
  );
}

// The rules that come from src/layout.js, expanded one population per check, because a check is what the
// placement gate asserts and a widened single check is the defect this exists for. The matching mirrors
// tools/placement.js: `startsWith` for a check's `mesh`, `===` for a grounding entry's own object name.
export function importedRules() {
  const out = [];
  for (const c of PLACEMENT_CHECKS) {
    out.push({
      id: `src/layout.js PLACEMENT_CHECKS[${c.name}] first-hit prefix`,
      source: JSON.stringify(c.mesh),
      what: `may satisfy the check at (${c.u}, ${c.v})`,
      match: (n) => n.startsWith(c.mesh),
    });
  }
  for (const c of GROUNDING_CHECKS) {
    out.push({
      id: `src/layout.js GROUNDING_CHECKS[${c.name}] object name`,
      source: JSON.stringify(c.name),
      what: 'the object whose base is dropped',
      match: (n) => n === c.name,
    });
    out.push({
      id: `src/layout.js GROUNDING_CHECKS[${c.name}] ground prefix`,
      source: JSON.stringify(c.mesh),
      what: 'may answer as its ground',
      match: (n) => n.startsWith(c.mesh),
    });
  }
  return out;
}

// Every string-matching site in the scanned files, by its own line text.
export function scanSites(files = scanFiles()) {
  const sites = new Set();
  for (const file of files) {
    for (const line of readSource(file).split('\n')) {
      if (isSite(line)) sites.add(`${file}  ${line.trim()}`);
    }
  }
  return [...sites].sort();
}

// Everything that has to come off the page, in ONE evaluate. An evaluate on the scene page waits for the
// frame in flight, so the count of them is the cost of this gate.
function readNamesInPage() {
  const { scene } = window.__scene;
  const meshes = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    meshes.push({ name: o.name || '', castShadow: Boolean(o.castShadow), instances: o.isInstancedMesh ? o.count : 1 });
  });
  return { meshes, describe: window.__scene.describe() };
}

export async function measureNames({ quiet = false, gpu = wantsGpu('NAMERULES') } = {}) {
  let server = null;
  let browser = null;
  let errors = [];
  let failure = null;
  let page = null;
  try {
    server = await startServer({ port: 0, quiet: true });
    browser = await launch({ gpu });
    const p = await browser.newPage({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1 });
    p.setDefaultTimeout(ACTION_TIMEOUT_MS);
    errors = collectErrors(p);
    // No settling frames: nothing here looks at a pixel.
    const info = await openScene(p, `${server.url}/`, { settleFrames: 0 });
    if (!quiet) console.log(`renderer: ${rendererTag(info.renderer, gpu)}`);
    page = await p.evaluate(readNamesInPage);
    page.renderer = rendererTag(info.renderer, gpu);
  } catch (err) {
    failure = err;
  } finally {
    for (const close of [() => browser?.close(), () => server?.close()]) {
      try {
        await close();
      } catch (err) {
        failure ??= err;
      }
    }
  }
  return { page, errors, failure };
}

// Apply every rule to the built scene's names. Returns one row per rule.
export function populations(meshes) {
  const rows = [];
  for (const rule of RULES) {
    const text = readSource(rule.file);
    if (rule.kind === 'inline') {
      const lit = inlineLiteralOf(text, rule.file, rule);
      const wanted = JSON.parse(lit.source);
      rows.push({ ...rule, source: lit.source, line: lit.line, match: (n) => n === wanted });
      continue;
    }
    const decl = declarationOf(text, rule.file, rule.ident);
    const match = matcherFor(rule, decl.source);
    rows.push({ ...rule, source: decl.source, line: decl.line, match });
  }
  for (const rule of importedRules()) rows.push(rule);
  return rows.map((rule) => {
    const hit = meshes.filter((m) => rule.match(m.name));
    return {
      id: rule.id,
      what: rule.what,
      source: rule.source,
      line: rule.line ?? null,
      names: [...new Set(hit.map((m) => m.name))].sort(),
      meshes: hit.length,
      instances: hit.reduce((a, m) => a + m.instances, 0),
    };
  });
}

// What a green run pins. Everything in here is compared against the manifest, name by name.
export function buildManifest({ meshes, describe }, rows, reason) {
  const rules = {};
  for (const r of rows) rules[r.id] = { what: r.what, source: r.source, meshes: r.meshes, names: r.names };
  return {
    reason,
    updated: new Date().toISOString().slice(0, 10),
    scene: {
      meshes: meshes.length,
      names: [...new Set(meshes.map((m) => m.name))].sort().length,
      shadowCasters: describe.shadowCasters,
    },
    sites: scanSites(),
    rules,
  };
}

function listDiff(was, now) {
  const added = now.filter((n) => !was.includes(n));
  const removed = was.filter((n) => !now.includes(n));
  return { added, removed };
}

const SAY = 'Run `node tools/namerules.js --update "<why>"` in the SAME change, and say in the reason which rename or new mesh moved it.';

export function compare(recorded, fresh) {
  const problems = [];
  // The scene's own totals first: a rename moves a population, a new mesh moves the shadow pass.
  for (const [key, label] of [['meshes', 'meshes in the scene'], ['names', 'distinct mesh names'], ['shadowCasters', 'meshes casting shadows']]) {
    if (recorded.scene?.[key] !== fresh.scene[key]) {
      problems.push(
        `${label}: the manifest records ${recorded.scene?.[key] ?? '(nothing)'} and this scene has ${fresh.scene[key]}. `
        + (key === 'shadowCasters'
          ? 'That is the term a rename moves through `NO_CAST` in src/lighting.js, and it is the number that moved by 2 when `far roof ridges` became `far house ridges` with every gate green. '
          : '')
        + SAY,
      );
    }
  }
  const sites = listDiff(recorded.sites ?? [], fresh.sites);
  if (sites.added.length || sites.removed.length) {
    problems.push(
      `the string-matching sites in src/ and in clearance/placement have changed: `
      + `${sites.added.length} new, ${sites.removed.length} gone.\n`
      + sites.added.map((s) => `       + ${s}`).join('\n')
      + (sites.added.length && sites.removed.length ? '\n' : '')
      + sites.removed.map((s) => `       - ${s}`).join('\n')
      + `\n     If a new one SELECTS MESHES BY NAME, add it to the RULES table in tools/namerules.js so its `
      + `population is pinned too — that is the whole point of this gate. If it does not, record it: ${SAY}`,
    );
  }
  const was = recorded.rules ?? {};
  const now = fresh.rules;
  const gone = Object.keys(was).filter((k) => !(k in now));
  const fresher = Object.keys(now).filter((k) => !(k in was));
  if (gone.length) problems.push(`${gone.length} rule(s) in the manifest no longer exist: ${gone.join('; ')}. ${SAY}`);
  if (fresher.length) problems.push(`${fresher.length} rule(s) are not in the manifest: ${fresher.join('; ')}. ${SAY}`);
  for (const id of Object.keys(now)) {
    if (!(id in was)) continue;
    const a = was[id];
    const b = now[id];
    if (a.source !== b.source) {
      problems.push(
        `the rule "${id}" has been edited. The manifest records \`${a.source}\` and the file now has `
        + `\`${b.source}\`. Its population may or may not have moved with it; either way the other rules `
        + `that share these names have not been looked at. ${SAY}`,
      );
    }
    // `a.names ?? []` in BOTH places. A manifest entry without a `names` key is a malformed record, not a
    // green run, and reading `.length` off it here would throw from inside the code that builds the
    // failure message — a stack trace in place of the sentence that says what moved.
    const was2 = a.names ?? [];
    const d = listDiff(was2, b.names);
    if (d.added.length || d.removed.length) {
      problems.push(
        `the rule "${id}" (${b.what ?? 'selects meshes by name'}) matched ${was2.length} name(s) `
        + `and now matches ${b.names.length}:\n`
        + d.added.map((n) => `       + ${n}`).join('\n')
        + (d.added.length && d.removed.length ? '\n' : '')
        + d.removed.map((n) => `       - ${n}`).join('\n')
        + `\n     A name is load-bearing in more than one rule. Check what ELSE this rename moved before `
        + `updating. ${SAY}`,
      );
    } else if (a.meshes !== b.meshes) {
      problems.push(
        `the rule "${id}" matches the same names but a different number of meshes: ${a.meshes} recorded, `
        + `${b.meshes} now. A mesh was added or removed under a name that already existed. ${SAY}`,
      );
    }
  }
  return problems;
}

if (isMainModule(import.meta.url)) {
  const update = process.argv.includes('--update');
  const reason = update ? (process.argv[process.argv.indexOf('--update') + 1] ?? '').trim() : '';
  if (update && !reason) {
    console.error('FAIL: `--update` needs a reason: node tools/namerules.js --update "why the populations moved".');
    console.error('  The manifest is the record of which renames were looked at by a person, so an update with no');
    console.error('  reason records nothing. Name the rename or the new mesh, and what else it moved.');
    process.exit(1);
  }

  const { page, errors, failure } = await measureNames();
  if (failure) {
    console.error(`FAIL: ${failure.message}`);
    process.exit(1);
  }
  // A scene that threw while it was being built is not a scene worth reading names off: a half-built
  // scene has a smaller population and would look exactly like a rename.
  if (errors.length) {
    console.error(`FAIL: ${errors.length} page error(s):`);
    for (const e of errors) console.error(`  ${e}`);
    process.exit(1);
  }

  // Both of these read files, and both fail with a sentence naming the rule or the directory. They are in
  // one `try` so a throw is a FAIL line rather than a stack trace: a stack trace is a non-zero exit with
  // nothing in it that says what would satisfy the gate.
  let rows;
  let fresh;
  try {
    rows = populations(page.meshes);
    fresh = buildManifest(page, rows, reason);
  } catch (err) {
    console.error(`FAIL: ${err.message}`);
    process.exit(1);
  }

  // FLOORS. A run that read a fragment of the scene, or found no rules, prints the same words as a run
  // that read all of it — and an empty population set matches an empty manifest perfectly.
  const floors = [
    [page.meshes.length >= 100, `found only ${page.meshes.length} mesh(es) in the built scene, under the 100 this scene has had since phase 3. Either the scene failed to build or this read the wrong page; a short scene would look exactly like a rename that removed everything.`],
    [rows.length >= 30, `applied only ${rows.length} rule(s), under the 30 this repo has. A run that checked nothing prints the same word as a run that checked everything.`],
    [fresh.sites.length >= 10, `the site scan found only ${fresh.sites.length} string-matching site(s) in ${scanFiles().length} file(s), under the 10 there are. It reads src/*.js and two tools relative to the working directory, so this is what it looks like when it ran somewhere else.`],
    [page.describe.shadowCasters > 0, 'the scene reports 0 shadow casters, so `applyShadowFlags` either did not run or excluded everything. The one number this gate asserts about the shadow pass would then be pinned to nothing.'],
    // The manifest is keyed by rule id, so two rules sharing an id would collide and one would vanish
    // into a green run. Two `PLACEMENT_CHECKS` entries with the same `name` is how that happens.
    [Object.keys(fresh.rules).length === rows.length, `${rows.length} rules were applied but the manifest holds ${Object.keys(fresh.rules).length}, so two of them share an id and one was overwritten. Rule ids come from a check's own \`name\` in src/layout.js; two checks with the same name make one of them invisible here. Give them distinct names.`],
  ];
  for (const [ok, why] of floors) {
    if (!ok) {
      console.error(`FAIL: ${why}`);
      process.exit(1);
    }
  }

  // The cross-check between the two halves, at the place the defect lived. If the expression this tool
  // evaluated out of src/lighting.js is not the one `applyShadowFlags` applied, this parts.
  const noCast = rows.find((r) => r.id === 'src/lighting.js NO_CAST');
  if (!noCast) {
    console.error('FAIL: no rule with the id "src/lighting.js NO_CAST" was applied, so the one cross-check');
    console.error('  between the rule this gate READ and the rule that RAN did not happen. That check is what');
    console.error('  makes the text extraction trustworthy at all. Restore the NO_CAST entry in the RULES table');
    console.error('  in tools/namerules.js, or give the new entry a cross-check of its own.');
    process.exit(1);
  }
  // A FLOOR ON THE CROSS-CHECK ITSELF, found by an independent critic. `filter` over an empty list prints
  // nothing and passes, so a `NO_CAST` that matched no mesh would make this gate's single most important
  // assertion vacuous while printing an identical summary line. Today an emptied `NO_CAST` would also move
  // `shadowCasters` — but one `--update` re-pins both, and after that the vacuum is permanent.
  if (!noCast.names.length) {
    console.error('FAIL: `NO_CAST` in src/lighting.js matched no mesh in the built scene, so the cross-check');
    console.error('  between the rule this gate READ and the rule that RAN compared nothing and would pass.');
    console.error('  Either the scene lost every mesh that rule covers, or the regex read out of that file is');
    console.error(`  not the one applied there. It reads: ${noCast.source}`);
    process.exit(1);
  }
  const casting = noCast.names.filter((n) => page.meshes.some((m) => m.name === n && m.castShadow));
  if (casting.length) {
    console.error(
      `FAIL: ${casting.length} mesh(es) match \`NO_CAST\` in src/lighting.js and are casting shadows anyway: `
      + `${casting.join(', ')}. This gate evaluates that regex out of the file and applies it to the built `
      + "scene's names; `applyShadowFlags` applies the real one. They disagree, so one of the two is not "
      + 'the rule that ran, and every population this gate reports about that rule is suspect.',
    );
    process.exit(1);
  }

  // The number this gate ASSERTS and the meshes it reads are two different traversals: `shadowCasters` is
  // a value `src/main.js` captured once from `applyShadowFlags(group)`, and `page.meshes` comes from
  // `scene.traverse`. They cover the same meshes today only because `scene` holds nothing but the camera
  // and that group. A critic pointed out the check is free, and a denominator nobody checked is the thing
  // this repo keeps being caught by.
  const casters = page.meshes.filter((m) => m.castShadow);
  if (casters.length !== page.describe.shadowCasters) {
    console.error(
      `FAIL: the scene reports ${page.describe.shadowCasters} shadow casters and ${casters.length} of the `
      + `${page.meshes.length} meshes this gate can see have castShadow set. Those are two traversals — `
      + '`applyShadowFlags(group)` counted the first when the scene was built, `scene.traverse` found the '
      + 'second just now — and the asserted number is the first. Something is in the scene that the shadow '
      + 'rig never saw, or was added after it ran, so the pinned count is of a different population from '
      + 'the one drawn.',
    );
    process.exit(1);
  }
  const shadowInstances = casters.reduce((a, m) => a + m.instances, 0);
  for (const r of rows) {
    console.log(`rule ${r.id.padEnd(70)} ${String(r.names.length).padStart(3)} name(s), ${String(r.meshes).padStart(3)} mesh(es), ${String(r.instances).padStart(6)} instance(s)`);
  }
  console.log(
    `     the scene: ${page.meshes.length} meshes under ${fresh.scene.names} distinct names; `
    + `${page.describe.shadowCasters} of them cast shadows, ${shadowInstances} instances in all.`,
  );
  console.log(
    `     printed and NOT asserted: ${page.describe.drawCalls} draw calls and ${page.describe.triangles} `
    + `triangles in the last frame at 640x480. Draw calls move with frustum culling and the canvas size; `
    + 'the shadow-caster count above is the same term without a camera in it, and is the one asserted.',
  );

  if (update) {
    // ENOENT is a first write. A SyntaxError is a BROKEN manifest, and swallowing it here would silently
    // discard whatever is in that file and overwrite it at exit 0 — the non-update path fails on the same
    // file, so the two halves would disagree about what a corrupt manifest means. Found by a critic.
    let recorded = null;
    try {
      recorded = JSON.parse(readSource(MANIFEST_PATH));
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error(`FAIL: ${MANIFEST_PATH} exists and could not be parsed: ${err.message}`);
        console.error('  `--update` will not overwrite a manifest it cannot read: whatever populations that file');
        console.error('  recorded would be lost without anyone seeing what moved. Fix the JSON, or restore it from');
        console.error('  git and run the update again.');
        process.exit(1);
      }
    }
    if (recorded && recorded.reason === reason) {
      console.error(`FAIL: the manifest already records that reason, word for word: "${reason}".`);
      console.error('  A reason repeated is a reason nobody wrote. Say which rename or new mesh moved the');
      console.error('  populations this time, and what else it moved.');
      process.exit(1);
    }
    const problems = recorded ? compare(recorded, fresh) : ['(first write)'];
    writeFileSync(MANIFEST_PATH, `${JSON.stringify(fresh, null, 1)}\n`);
    // NOT the evidence marker `npm test` reads. A write is not a pass, and a marker printed here would let
    // an `--update` run satisfy the suite's proof that this gate checked anything.
    console.log(`\nmanifest written: ${MANIFEST_PATH} — ${rows.length} rules over ${page.meshes.length} meshes, ${problems.length} change(s) recorded, reason "${reason}".`);
    process.exit(0);
  }

  let recorded;
  try {
    recorded = JSON.parse(readSource(MANIFEST_PATH));
  } catch (err) {
    console.error(`FAIL: ${MANIFEST_PATH} could not be read: ${err.message}`);
    console.error('  It is the whole verdict of this gate — without it there is nothing to compare the scene');
    console.error('  against, and a missing manifest must not read as "nothing changed". Restore it from git,');
    console.error('  or, if the rules genuinely have no recorded state yet, write one with');
    console.error('  `node tools/namerules.js --update "<why>"` and review the diff.');
    process.exit(1);
  }
  if (!recorded.reason) {
    console.error(`FAIL: ${MANIFEST_PATH} carries no reason, so nobody recorded why these populations are what they are.`);
    process.exit(1);
  }

  const problems = compare(recorded, fresh);
  if (problems.length) {
    console.error(`\nFAIL: ${problems.length} name-rule problem(s), against ${MANIFEST_PATH} (last updated ${recorded.updated}, "${recorded.reason}"):`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(
    `name rules: ${rows.length} rules that select meshes by name hold the populations recorded in `
    + `${MANIFEST_PATH}, over ${page.meshes.length} meshes and ${page.describe.shadowCasters} shadow `
    + `casters, with ${fresh.sites.length} string-matching sites in ${scanFiles().length} scanned file(s) `
    + `unchanged, on ${page.renderer}.`,
  );
}
