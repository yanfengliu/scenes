# 2026-09-11 — what `npm test` was spending its time on

The suite cost about 35 minutes locally and 80 on CI, and that tax was paid on every iteration. This session cut it to 12 minutes locally without changing what any gate renders, measures or asserts. No file under `src/` was touched, `out/render.png` came back byte-identical, and the two scored numbers `npm test` asserts are the same.

## The one cause behind most of it

**A `page.evaluate` on the scene page waits for the frame in flight.** The page holds a `requestAnimationFrame` loop that renders the whole post chain every frame, and on SwiftShader that frame is seconds long — about 14 s at 1200x1100 on this machine, and a minute or more on a shared CI runner. Nothing in the gates said so out loud, so round-trips to the page were written as if they were free, and they cost a frame each.

`tools/views.js` had already found this and written it in its own header: a no-op evaluate on the scene page cost 4.96 s, one 120 px `decodeImage` cost 80.71 s, and seven of them cost 792 s with nothing printed. That header ends "Anything added here that decodes, resamples or composes an image belongs on `inspector`, not on `page`." It was a note in one tool rather than a rule with a home, and `tools/animation.js` — the most expensive gate in the repo, two thirds of the local suite — was decoding **eight** images on the scene page the whole time.

The rule now lives in `AGENTS.md`'s Gates section and the helper it names, `openInspector`, lives in `tools/lib/browser.js`.

## Measured

Local, sequential, nothing else running, same machine and same tree, `npm test`'s own per-gate elapsed lines. Baseline `out/scratch/baseline-test.log`, after `out/scratch/after-test.log`.

**How much to trust these numbers.** This machine varies by about 20% between runs of the same code: three `npm test` runs on the changed tree came to 733 s, 607 s and the figure in `out/scratch/final2-test.log`, with `animation` at 307 s and 236 s in the first two. So the per-gate columns below are single samples and the last digit means nothing. What the claim actually rests on is narrower and better controlled: **back-to-back pairs on an unchanged tree, old tool then new tool, through one harness** — recorded under "controlled pairs" below — and the per-frame instrumentation, which shows a decode going from about 80 s to 0.2 s directly rather than by subtraction.

| gate | before | after | |
| --- | ---: | ---: | --- |
| shot | 152 s | 69 s | three evaluates before the screenshot became one |
| compare | 4 s | 1 s | untouched |
| placement | 72 s | 36 s | three evaluates became one |
| clearance | 43 s | 28 s | the clock is pinned inside the measuring call |
| animation | 1454 s | 307 s | eight decodes moved off the scene page; pose and settle merged |
| nudge | 279 s | 231 s | `openScene` only |
| blackframe | 44 s | 30 s | the post-resize settle moved inside the measuring call |
| record | 31 s | 31 s | `openScene` only |
| **suite** | **2079 s** | **733 s** | **-65%** |

Two numbers carry the claim that nothing moved: `out/render.png` is sha256 `d29b76dd027263314e3b5436063f4d9d068c887e3ca8fb2d72589b47fb5ac203` before and after, and every one of `animation`'s seven rows — including the motion figures, which are computed from the decoded pixel buffers — came back identical:

```
t = 0.0 s   cell 0.0749   ssim 0.4733
t = 1.4 s   cell 0.0749   ssim 0.4734   moved 0.17 levels
...
motion between neighbouring frames: 0.11 to 0.17 levels, mean 0.14
```

That equality is also the evidence that the page a decode runs on does not enter the result, and the repo had it all along without noticing: `tools/compare.js` has always decoded `out/render.png` on a blank page while `tools/animation.js` decoded the byte-identical frame at t = 0 on the scene page, and both printed 0.0749 / 0.4733.

## What changed, gate by gate

- **`tools/lib/browser.js`, `openScene`** — awaits `index.html`'s own `window.__sceneReady` in one evaluate instead of polling `window.__sceneState` every 100 ms. A poll is an evaluate, so the polls came back about one frame apart however short the sleep was, and readiness was detected up to a whole frame after it happened, once per page and the suite opens about a dozen. Same `shot` page: ready at 21.2 s against 33.5 s. All four ways the wait can end were re-proved (below).
- **`tools/lib/browser.js`, `openInspector`** — new: the blank page image work runs on.
- **`tools/shot.js`** — hiding the chrome, pinning the clock and waiting two frames for the compositor were three round-trips and are now one. The output is byte-identical.
- **`tools/animation.js`** — the eight decodes moved to the inspector page (80 s each → 0.2 s), and `setTime` plus the two-frame settle became one evaluate. Each frame now prints what it cost, split three ways.
- **`tools/placement.js`** — pinning the clock, the 21 forward rays and the 10 grounding rays were three evaluates and are now one, in the same order.
- **`tools/clearance.js`** — the clock is pinned inside `measureInPage` rather than in an evaluate of its own.
- **`tools/blackframe.js`** — the two frames a resized view settles for are waited inside the measuring call. Same frames, one round-trip fewer. It prints its own elapsed seconds now, as `nudge` does.
- **`tools/nudge.js`, `tools/record.js`, `tools/compare.js`, `tools/test.js`** — no change beyond what they inherit from `openScene`. `nudge` and `record` already made one evaluate per page; `compare` never opens the scene page at all.

## What was considered and rejected

**Rendering the animation frames smaller.** The obvious saving, and the first thing to ask: `compare` sees 528 cell means and a 64 px grayscale image, so why render 1200x1100 seven times? Because `tools/animation.js` does not only compare its frames with each other. It holds the worst of them to `docs/PLAN-scores.md` plus 0.0006 of cell distance and minus 0.0025 of SSIM — the **shipped frame's** thresholds, which belong to the 1200x1100 contract; the frame at t = 0 is in fact byte-identical to `out/render.png`. This scene is full of geometry thinner than a pixel (30,000 blossom cards, the strand tubes, the tile ridges — that is what `nudge` exists for), so alpha-test coverage and antialiasing move with the render size, while those allowances are six times the 0.0001 the animation itself moves the score. At another size the gate would still separate a healthy animation from a fourteen-fold sway, but it would no longer be checking that the scored view holds across the cycle; it would be checking that a different image does. The size stayed, and the saving came from the round-trips instead.

**Fewer frames.** `ANIMATION_FRAMES` already trims CI to three, and the saving above made the question moot. What is worth recording is the guard that was added and then withdrawn, because it is the exact failure this repo has a rule about. A floor of three was written on the argument that t = 0 and t = 8.7 are one full period of the wind apart and so nearly the same frame, which would make a two-frame run measure no motion and red the `>= 0.06` floor on a healthy scene. It read plausibly, it was written before it was measured, and measuring it killed it twice over: only the slowest of the three wind terms returns to phase at 8.7 s (`2*pi/0.72 = 8.727`) — the `0.85` term is 1.11 rad short there and the `1.63` term 1.62 rad, and the petals wrap on a 7.5 s fall of their own — and `ANIMATION_FRAMES=2` in fact reads `mean 0.22` with every check green. The floor went back to two. What the measurement left behind is better than what it removed: a fresh spacing series for the gate's own bound, **0.14 levels over seven frames, 0.18 over three, 0.22 over two**, against a ceiling of 0.4 that does not move with the spacing.

**One `requestAnimationFrame` instead of two before a screenshot.** Worth about a frame per shot. Not taken: the second frame is what gives the compositor the canvas the screenshot captures, a race that fires occasionally looks exactly like a pass, and this repo has twice shipped a gate that could not tell "rendered" from "rendered nothing".

**A smaller viewport for `placement`.** Its rays depend on the camera's *aspect*, not its pixel count, so 240x220 would cast identical rays and make every frame on that page about twenty-five times cheaper — `openScene` on a 320x240 page reaches ready in 7.8 s against 21-31 s at 1200x1100. Not taken, because `placement` would then stop being a page that renders the scene at the size the scene ships at, and the saving after the round-trip fix is around 15 s. Worth revisiting if the gate ever grows.

**Running gates concurrently — measured, and not adopted.** Four independent gates, solo against all four started at once on this 32-thread machine (`out/scratch/contention-par.log`):

| | solo | together |
| --- | ---: | ---: |
| animation | 307 s | 385 s |
| placement | 36 s | 62 s |
| clearance | 28 s | 51 s |
| nudge | 231 s | 300 s |
| wall clock | 602 s | **385 s** |

So concurrency is real: 36% off those four, and the whole suite would come to roughly 516 s. It costs 33% more CPU-seconds, and it costs something worth more than 217 s here: **every gate's own printed seconds become load-dependent** — `clearance` reads 51 s under lanes against 28 s alone — and this repo reasons from those numbers in `AGENTS.md`, in `ci.yml`'s comments, in this devlog and in `gate-proofs.md`. `record` is the other objection: its assertions are about frames captured during 12 s of real mouse input on a GPU, with a floor of 30 frames, so it is the one gate whose verdict could move with machine load, and it would need an exception. The numbers are recorded here so adopting lanes later is a decision, not a re-measurement. The shape it would take: `[shot → compare]`, `[animation]`, `[placement → clearance]`, `[nudge → blackframe]` in parallel, then `record` alone, off by default on any machine with few cores.

## What the review changed

One independent lane ran. The Codex lane was down — `ERROR: You've hit your usage limit … try again at Sep 15th, 2026 9:39 AM`, which is the exact outage `fleet/docs/skills/multi-cli-review.md` already records — so it **abstained**, and everything below came from the Claude lane. It found eighteen things; these are the ones that changed the code.

- **The merge the change forgot.** `openScene` still ended with two separate evaluates on the scene page — the two-frame compositor wait, then `describe()` — which is the exact merge the work had made in three other tools, left unmade on the one function every gate calls, about a dozen times a suite. Merged. `renderer.info.autoReset` is `false` (`src/main.js:129`) and `render()` resets then renders, so reading the counters in the microtask after the second rAF gives that frame's numbers, and `shot` still prints `draw calls: 326; triangles: 620482`.
- **`animation` still paid for `addStyleTag`.** One more round-trip on the scene page, in the gate the whole exercise was about. Folded into the first sampled time's evaluate.
- **`blackframe`'s claim was false.** "Same frames, same order, one round-trip fewer" — the two evaluates it replaced actually gave the measurement three settled frames, not two, because the second one also waited out the frame in flight. It is three now, the settling identical to before, and the gate's saving comes from `openScene` instead.
- **The new wait was stricter than the old one**, in a direction nothing intended: the old loop stopped watching for errors the moment a poll read "ready", while the new listeners stayed armed until the `finally`. An `armed` flag restores the old semantics.
- **The ceiling message asserted something it never read** ("window.__sceneState is still \"loading\"") where the old one printed the state it had actually polled. The clause is gone.
- **The proof harness covered four of six exits and claimed to cover them all.** A fifth page now rejects the handshake directly with nothing thrown, which is the only way to reach that branch; the sixth is unreachable through a page shaped like `index.html` and the code says so where it is written.
- **Moving the decodes moved them out from under `collectErrors`.** `openInspector` now takes the caller's error array.
- **And, in the file it was reviewing, a gate that could not fail.** `tools/nudge.js` held `errors = errors.concat(collectErrors(page))` — which copies the array `collectErrors` has just returned, always empty, and orphans the one the listeners push into. `nudge`'s `if (errors.length)` block was dead from the day it landed: that gate had never been able to report a console error, a page error or a failed request. Fixed, and made to go red both ways (`docs/learning/gate-proofs.md`). The same misuse is still in `tools/paintcheck.js`, which is a diagnostic, was not touched here, and is named there rather than fixed.
- **Two figures were transferred rather than measured**: the 80.71 s decode is `views`' 120 px measurement, not `animation`'s, and "identical" was at printed precision. Both are now `animation`'s own, at full precision — the same `decodeImage` call on the same file in the same process cost **96.1 s on the scene page and 0.1 s on the blank one**, and returns the same 1,320,000 bytes, sha256 equal with no differing byte, with the scores equal as doubles (0.07494746503602544 and 0.47332415481740603). `out/scratch/decode-purity.mjs`.

## Every red proof was re-run

Each gate's mutation from `docs/learning/gate-proofs.md`, on the new tools. Every one still fails; the failure texts and the three discrepancies with the recorded entries (none of them caused by this work) are in that file. `openScene`'s four failure paths — a page that is not the scene page, a module script that 404s, a page that throws, a scene that never becomes ready — have no gate and never had one, so they were proved with `out/scratch/openscene-proof/run.mjs` and recorded there too.

## What CI should see

CI is the same structural saving against a much slower frame, so the savings scale with it. The one number measured directly is the gate that dominates: **`ANIMATION_FRAMES=3`, the CI configuration, timed locally back to back on an unchanged tree — 464.3 s before, 108.8 s after, a factor of 4.3.** Applying each gate's measured local ratio to its recorded CI time:

| gate | CI before | ratio | CI estimate |
| --- | ---: | ---: | ---: |
| shot | 326 s | 0.45 | ~150 s |
| placement | 185 s | 0.50 | ~95 s |
| animation (3 frames) | 2360 s | 0.23 | ~550 s |
| nudge | 950 s | 0.83 | ~790 s |
| blackframe (1 view) | 400 s | 0.68 | ~270 s |
| clearance | not yet measured on CI | 0.65 | ~70 s |
| **suite** | **~4220 s (70 min)** | | **~1930 s (32 min)** |

The ratios are the local before/after per gate, and they transfer because what was removed is frame-waits, which scale with the frame. The estimate is an estimate: nothing here was run on a runner, and CI timings on this repo have varied 1.3x between runners on the same commit. `nudge` barely moves because it already made one evaluate per page — it is now the second largest CI cost after `animation`, and the next place to look.

A second CI lever exists and was not taken: splitting `npm test` across two parallel jobs would roughly halve CI wall-clock again, but it consumes the same Actions minutes for less certainty, it cannot be verified from here, and a job matrix is exactly the shape in which a gate goes quiet — which is the defect this repo spent 2026-09-09 fixing.
