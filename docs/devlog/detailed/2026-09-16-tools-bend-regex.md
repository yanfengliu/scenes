# 2026-09-16 — Tools: the bend exemption is narrowed, and a mesh name becomes a checked interface

Base revision: main at `a78ba8f`. Worktree: `.claude/worktrees/agent-ae83517ae44f11597`. Scope: `tools/`, `package.json`, AGENTS.md's Gates section, `docs/learning/`, this file. `src/` was not changed — every mutation below was applied to it temporarily and reverted with its digest checked.

Two items, both handed over by `docs/devlog/detailed/2026-09-16-iteration-4.md`.

## 1. The clearance exemption past the bend was five times the region it guarded

`tools/clearance.js` does not assert anything about the paved rows past `STREET_TO_Z = -33.5`, and pins that hole from both sides so it cannot quietly grow: no more than `BEYOND_ROWS_MAX` rows, and no structure over them but the names in `BEYOND_BLOCKERS`.

Those were written on 2026-09-10 at **40 rows and three names**, when `far street slabs` ran to z -42 and 7.5 m of paved road lay under three buildings: 34 rows, 27 of them blocked, by `corner house body`, `corner house roof` and `bend roof`. Iteration 4 ended the paving at the corner house's own front face and left **3 rows (z -33.75, -34.00, -34.25), 1 of them blocked, by `corner house roof` alone**.

So the pin was guarding a region five times smaller than itself. Now `BEYOND_ROWS_MAX = 6` and `BEYOND_BLOCKERS = ['corner house roof']`.

**Where the 6 comes from, since a number chosen after seeing the answer is how the 40 was chosen too.** 3 plus a margin of 3 rows, which is 0.75 m of paving at the sweep's 0.25 m step. The last row is where the paved band runs out, and the grid decides which side of the end it falls on: `FAR_STREET_END` is -34.4 and the last sampled row is -34.25, so a 0.15 m move of the street's end, or a slab grid rounding the other way, moves the count by one with nothing built. Three rows covers that. A metre of new paving does not, which is the direction the pin is for.

`corner house body` and `bend roof` were dropped with the 40: neither stands over paving any more, and leaving them would exempt two named buildings from a region they are not in.

### What was believed and is now a measurement

The iteration-4 devlog says the old pin "would go red again the moment anything else is built over the bend's paving". Half of that was true. The NAME half was already red — `far row base far` run past the bound (`FAR_ROW.zFar` -30.5 → -36.0, the recorded C2 mutation) fails under both pins, because that name was never in either list. The ROW half was not: **relaying the paving to z -42 gives 34 rows under three buildings, three of those rows already too narrow to walk down, and the old pin exits 0 on it.** That control was run on this tree with only the two constants changed, and it is the whole of the case for the narrowing. Under the new pin the same mutation fails twice, on the row count and on `corner house body` and `bend roof` no longer being exempt.

The row floor had never been made to go red at all — the 2026-09-10 entry lists it among the floors "NOT made to go red, in either check". It has been now.

### A number that moved for a reason that is not this work

Re-running check 2's own B1 proof (`farRowFrontX` unfloored) against the narrowed exemption gives 24 rows at z -30.00 and 32 at z -26.25, where the re-run recorded earlier the same day reads 24 at z -29.75 and 33 at z -26.00. That is iteration 4 moving the far street between the two runs, not the exemption: this work's entire diff to the tool is `BEYOND_ROWS_MAX`, `BEYOND_BLOCKERS` and comments, and both constants are read in **two** places, both after all measurement is finished: the `if (beyond.length)` report block, and the `limits` object written to `out/clearance.json`. Nothing in either can move a run inside the asserted range. (This paragraph said "exactly one place" until a critic counted; the conclusion survives, but the sentence was the whole of the isolation argument and it was wrong about the code.) The shipped `clearance street` line now reads **166 of 169** paved z positions where 2026-09-10 recorded 166 of 200, for the same reason.

## 2. A mesh name is load-bearing in rules that do not know about each other

The lesson retired here (read it back with `git show a78ba8f:docs/learning/lessons.md`): iteration 4 renamed `far roof ridges` to `far house ridges` to stop it widening `PLACEMENT_CHECKS`'s `far roof` prefix check, and that rename moved it across `NO_CAST` in `src/lighting.js` — a regex in a file that neither imports nor is imported by `layout.js` — putting 37 instances into the shadow pass. **364 to 366 draw calls, every gate green.** The only signal was a two-call move in a printed number, and it was explained away as frustum culling in writing before a second critic round decomposed the frame.

The new gate is `npm run namerules`, in `npm test` after `placement`, with the marker `name rules:`. It pins **53 rules** against `tools/name-manifest.json` (17 KiB):

| rule | names |
|---|---|
| `src/lighting.js NO_CAST` | 55 |
| `clearance` WALK / TERRACE / TERRAIN / LIVING / CANOPY | 14 / 7 / 11 / 23 / 2 |
| `clearance` SURFACE_WORDS / PLANT_WORDS / BEYOND_BLOCKERS | 12 / 8 / 1 |
| `clearance`'s inline `o.name === 'cherry trunk'` lookup | 1 |
| `PLACEMENT_CHECKS`, one per entry | 23 rules |
| `GROUNDING_CHECKS`, object name and ground prefix per entry | 20 rules |

plus the scene's own totals — 255 meshes, 255 distinct names, **98 shadow casters** — and the 17 string-matching sites across 28 scanned files. (52 rules and 14 sites on the first writing; the trunk lookup and three sites were added by the critic round below.)

### Three decisions worth arguing with

**The rules are evaluated out of their own files, not re-implemented.** `NO_CAST` is a `const`, not an export, and clearance's five lists are locals inside the function it hands to `page.evaluate`; neither can be imported, and a regex does not survive `page.evaluate`'s JSON argument either. So the tool finds the single-line `const NAME = <expr>;` declaration, takes the expression's text and builds it with `new Function`. A copy written into the gate would be the gate agreeing with itself and would go on passing after the rule changed. The text goes into the manifest too, so an edit that happens to move no population is still red. Cost: the declaration's SHAPE is now part of the contract, and a `g` or `y` regex is refused outright rather than silently measured in an order-dependent way.

**The one number asserted about the shadow pass is `shadowCasters`, not draw calls.** Draw calls move with frustum culling and canvas size; `applyShadowFlags`'s own return value is a pure function of names, box sizes and centres. It reads 98 here, where the iteration-4 devlog decomposed the shot's shadow pass at 105 draw calls — two different numbers of two different things.

**The instrument checks itself at the place the defect lived.** Reading a rule as text is only as good as the text being the rule that ran, so every mesh `NO_CAST` matches must have `castShadow === false` in the built scene. Inlining a different regex at the application site — leaving `NO_CAST` declared and unused — names 23 meshes and exits 1.

### What this gate does NOT do, stated plainly

**One command rewrites the manifest.** `node tools/namerules.js --update "<why>"`; the reason is required and must differ from the recorded one, and that is the whole ceremony. Nothing here can tell a considered update from a rubber stamp. What it buys is that a rename becomes a visible diff in a tracked file naming every population it moved, instead of two draw calls in a log — impossible to miss, not impossible to wave through.

It pins populations, not correctness. The site scan does not cover itself, other tools, or `tools/lib/`. And that one command clears **every** class of finding at once — a new unregistered site and a changed rule text as well as a moved population — so an update whose reason mentions only a rename also launders a rule nobody registered.

The softest joint is that how `tools/placement.js` matches (`startsWith` for a check's `mesh`, `===` for a grounding entry's name) is written again in the gate; nothing measures that the two still agree, and what covers it is the site scan carrying placement.js's matching lines verbatim.

Four floors and a duplicate-id floor were **not** proved red — no scene was built that would trip them. They are calibrated from the shipped figures and nothing else, exactly as check 2's floors were.

### The gate separates the two problems, which is worth more than catching either

The iteration-4 story has two defects in it, one before the rename and one after, and they are different defects. Run against the **pre-rename** tree (`far roof ridges`/`far roof lips` under their original names, `NO_CAST` without `far house`), the gate holds `shadowCasters` at 98 — correctly, because in that state both sets were excluded through the `far roof` token and there was no shadow defect — and reds instead on `PLACEMENT_CHECKS[far roof]` going from 16 names to 18. That is the widening a critic found by reading the file, stated as a number. Run against the **post-rename** tree, it reds on 98 → 100, the shadow move that shipped. Neither state is green, and the failure text says which of the two it is.

### The renderer decision, measured

`GATES_GPU=0 node tools/namerules.js` on SwiftShader prints the same 53 rules, the same 255 meshes under 255 names, the same 98 shadow casters, and even the same 370 draw calls and 745,206 triangles as the GPU run. So the manifest is a property of the scene and not of the driver, and CI — which sets `GATES_GPU=0` — is held to the numbers recorded here. Had any of them differed, a manifest recorded on this machine would have reddened CI for nothing, and that is the sort of thing that is one command away from being caught and usually is not.

### What the critic caught, and both of them were the gate lying about itself

An independent read-only critic reviewed both items and returned two blockers. Neither was a wrong number; both were the gate's own header making a claim the code did not keep, which is the exact failure `gate-proofs.md` exists to prevent.

**B1. The CLAIM was false, and the scan structurally could not see the counter-example.** The header said "every rule in this repo that selects meshes BY NAME is registered here". `tools/clearance.js`'s trunk lookup is `o.name === 'cherry trunk'` — a whole-name mesh rule, load-bearing, **in a file the scan already read** — and the scan matched five method names, none of which is `===`. The critic listed eight invisible idioms and measured each. The stated bound named the FILE boundary and never the IDIOM boundary, which is the one that bit. Fixed both ways: the scan now also matches any line mentioning a name that compares, splits or looks it up (17 sites, was 14), and that lookup is a registered rule (53, was 52). A first attempt that simply took every string method reached 41 sites, 20 of them `.replace()` on GLSL source in the shader modules — a list that would have gone unread within a week, so the widening is aimed at names rather than at strings.

**B2. `declarationOf` could read a rule that does not run, and the bound said the opposite.** It claimed a rule split across lines "fails rather than passing — which is the right direction". It did not: only single-line declarations were counted, so a real rule reformatted across lines was not counted at all and a stale one-liner left in a `/* … */` block or a template literal matched "exactly once". The tool then evaluated the dead copy and reported its population, green. `NO_CAST` is a 200-character line, exactly the thing someone reformats, and the `castShadow` cross-check does not save it because a stale copy is normally a SUBSET of the live rule and a subset passes. The critic built the construction rather than describing it. Every `const <ident>` binding in the file is now counted first, in any shape, and must be 1.

Four smaller findings, all fixed: the `NO_CAST` cross-check had no floor of its own and would pass having compared zero meshes; `describe().shadowCasters` and the traversed mesh list are two different traversals with nothing checking they agree; `--update` swallowed a corrupt manifest as a first write because `catch {}` cannot tell `ENOENT` from a `SyntaxError`; and a rule closing over module scope threw only when called, escaping the named error for a bare `PREFIX is not defined`.

One finding was recorded rather than closed: clearance classifies with a first-match-wins `else if` chain and this gate applies every rule independently, so `LIVING` is pinned at 23 where that gate builds 21, and **reordering the chain moves clearance's real sets with this gate green**. Closing it would mean re-implementing clearance's classification here, which is the thing the whole design avoids.

The critic also corrected the isolation argument for item 1 — the clearance constants are read in two places, not one — and independently reproduced the corrected site count below before being told it. Everything else it checked (52 rules, 255 meshes, 98 shadow casters, `far roof` satisfiable by 16, the 3-row exemption, the margin arithmetic, the manifest size) it verified as right.

### A number in the gate's own header that was wrong

The header and the AGENTS.md line both said the site scan reports "14 sites, of which 9 select meshes". It was **11**: the three that do not are `src/debug.js`'s `rgba(…)` test on a CSS colour and `src/animation.js`'s two `uniforms.includes(uniform)` guards. Found by counting the manifest's own `sites` list by hand during a self-review, before the critic reached it; the critic then counted independently and got 11 too. After the B1 widening the figures are **17 sites, 14 of them mesh rules** — the same three non-mesh lines. The tool cannot compute that number, because telling a name rule from any other string match is exactly what the scan cannot do, so it is a hand count in three documents and it was wrong in all three on the first writing.

### One thing the gate found on its first green run

`PLACEMENT_CHECKS`'s `far roof` check is satisfiable by **16 meshes**: `far roof a`, `far roof a back`, `far roof a house`, `far roof a house lower`, and the same four for b, c and d. The critic's fix stopped the ridges and lips widening it; it was already sixteen wide. The check asks for a roof at (0.2, 0.33) and any of the four houses' four parts answers it. That is a `src/` matter and was left alone by this lane's brief, but it is now a number in a tracked file rather than something nobody had counted.

## Red proofs

All in `docs/learning/gate-proofs.md`, under `clearance, check 2: the exemption past the bend is the size of the region it guards` and `name rules: a mesh name is an interface between rules that do not import each other`. Thirteen mutations: D1/D2/D3 plus the old-pin control for the exemption, and E1–E9 for the name gate, including E8 (the true pre-iteration-4 tree) and E9 (the rule the scan could not see, renamed).

**E1 and E2 were re-run twice**, once after the hardening pass and once after the critic's blockers were fixed. A gate edited after its red proof and still passing looks exactly like a gate that still catches its defect, and the second of those edits rewrote `declarationOf` and widened the scan, so the earlier proofs were of a different tool. The B2 fix has its own proof against the critic's three constructions plus five controls (`out/scratch/tools-bend-regex/b2probe.mjs`).

Every `src/` file used came back to its own digest — `src/layout.js` `fae90a623b246f99…`, `src/lighting.js` `417c0400272d0716…`, `src/background.js` `09d3fdc561bcab36…`, `src/figures.js` `9b1341aa2b3eff64…` — and `git status` shows no `src/` change.
