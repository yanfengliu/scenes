# Lessons (queue)

Read at session start. A lesson is prose only until it is a gate: each entry names the gate that will retire it (a test, a check in a tool, a lint rule, a fixed command) and is deleted in the commit landing that gate, once the gate has been made to go red by reintroducing the defect. The proof of each retirement lives in `gate-proofs.md`.

An entry that can name no gate is not a lesson: repo-only knowledge goes to `docs/policies/local-rules.md`, and the rest is dropped.

Entry shape: date, claim, evidence (measurement, commit, or test id), the gate that retires it.

## 2026-09-16 — A mesh name is load-bearing in two regexes that do not know about each other

**Claim.** Renaming a mesh to satisfy one name-matching rule silently changes the population of every other one, and nothing in the suite says so. `src/layout.js`'s `PLACEMENT_CHECKS` matches by name prefix and `src/lighting.js`'s `NO_CAST` is a name regex over the same meshes; a rename made for the first changed what the second excludes from the shadow pass.

**Evidence.** Iteration 4 added two shared instanced sets called `far roof ridges` and `far roof lips`. A critic found they widened the `far roof` placement check, which is satisfied by any mesh whose name starts with that, so a lip anywhere in the row could answer a check about one photo position. They were renamed to `far house ridges` and `far house lips` — and `NO_CAST` already excluded `far roof`, so the rename put 37 instances at 22 to 34 m into the shadow map. The shot went **364 to 366 draw calls** and every gate stayed green; I attributed the move to frustum culling in writing before a second critic round decomposed the frame (366 calls, of which the shadow pass is 105) and measured it both ways: 366 with them casting, 364 without. Adding `far house` to `NO_CAST` recovered it exactly, with `out/render.png`'s scores unchanged at 0.0640 / 0.5403. `src/lighting.js`'s own comment records the same trade for `far row`, made deliberately, at 7 draw calls.

**Why no gate saw it.** `placement` asserts the check still passes and it did. `shot` prints the draw-call count and asserts nothing about it. `perf` has a 400 budget and 366 is inside it. The only signal was a two-call move in a printed number, and a number that is only printed is a number that gets explained away.

**Gate that retires this.** A check in `tools/` that builds the scene, applies every name-matching rule in `src/` (at minimum `NO_CAST` in `lighting.js` and the `mesh` prefixes in `PLACEMENT_CHECKS` and `GROUNDING_CHECKS`), and asserts each rule's matched set against a checked-in list of names — so a rename that changes any population goes red until the list is updated in the same commit. It should print the shadow-pass draw count beside the scene's, because that is the term a name edit moves. Proved red by renaming one `far house` mesh back to `far roof` and by dropping one name from the list.
