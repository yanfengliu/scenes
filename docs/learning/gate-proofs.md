# Gate proofs

Each retired lesson's gate is listed with the mutation that made it go red, the failure it produced, and where the evidence lived before retirement. A gate that was never seen red proves nothing.

## compare refuses a stale render (2026-09-05)

- Claim (in the gate's own header, `tools/compare.js`): a score is a claim about the current scene, so `compare` fails when `out/render.png` is older than any of `index.html` and `src/*`.
- Origin: a `npm run shot` that failed with `slopedSlab is not defined` was followed by `compare`, which scored the previous render as if the shot had succeeded, because `npm run shot | tail` reported tail's exit status. Recorded the same session in `docs/devlog/detailed/2026-09-05-phase-1.md`; the lesson never entered `lessons.md` because the gate landed in the same commit, so there is no pre-retirement evidence file to read back.
- Mutation: `touch src/layout.js` after a successful shot, then `npm run compare`.
- Failure produced: `FAIL: out/render.png is 392.0 s older than src/layout.js; run npm run shot so the score is of the current scene`, exit status 1. A fresh `npm run shot` followed by `compare` passed again with the same scores (0.0940 / 0.2929).
- Bound: the check compares file modification times, so it cannot see an edit that preserves the mtime, and it does not cover `tools/` (a tool change does not change the scene).
