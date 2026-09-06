# Gate proofs

Each retired lesson's gate is listed with the mutation that made it go red, the failure it produced, and where the evidence lived before retirement. A gate that was never seen red proves nothing.

## placement: the first mesh under each landmark (2026-09-05)

- Claim (in the gate's own header, `tools/placement.js`): the compare scores cannot see a piece built inside another, so `npm test` casts the photo camera's ray through each entry of `PLACEMENT_CHECKS` in `src/layout.js` and fails unless the first mesh hit starts with the named mesh.
- Origin: the phase 2 lesson (both sliding doors, a lantern and the awning sat inside their wall boxes and the sign floated while the score was the phase's best), recorded in `docs/devlog/detailed/2026-09-05-phase-2.md` and queued in `lessons.md` from the phase 2 commit (407d653) until this one.
- Mutation: in `src/vegetation.js`, the cherry's trunk mesh built but not added to the scene (`mergeGeometries(wood);` in place of `b.add(new THREE.Mesh(mergeGeometries(wood), bark), 'cherry trunk');`), then `npm run placement`.
- Failure produced: `FAIL cherry trunk at (0.635, 0.585): expected "cherry trunk", first hit "ground base"`, then `FAIL: 1 placement check(s) hit another mesh first; see src/layout.js PLACEMENT_CHECKS`, exit status 1. Restored, the run printed `placement: 18 checks ok`.
- A first attempt set the trunk mesh's `visible` to false and did not go red: `Raycaster` ignores visibility, so the gate sees geometry, not what is drawn.
- Bound: the gate checks one ray per listed position, so it catches a landmark hidden or missing at that pixel and nothing else; an attachment built inside its wall but still the first hit somewhere on its body passes, and positions must sit on the object's body, not its edge (the trunk's check moved twice before it was reliable).

## compare refuses a stale render (2026-09-05)

- Claim (in the gate's own header, `tools/compare.js`): a score is a claim about the current scene, so `compare` fails when `out/render.png` is older than any of `index.html` and `src/*`.
- Origin: a `npm run shot` that failed with `slopedSlab is not defined` was followed by `compare`, which scored the previous render as if the shot had succeeded, because `npm run shot | tail` reported tail's exit status. Recorded the same session in `docs/devlog/detailed/2026-09-05-phase-1.md`; the lesson never entered `lessons.md` because the gate landed in the same commit, so there is no pre-retirement evidence file to read back.
- Mutation: `touch src/layout.js` after a successful shot, then `npm run compare`.
- Failure produced: `FAIL: out/render.png is 392.0 s older than src/layout.js; run npm run shot so the score is of the current scene`, exit status 1. A fresh `npm run shot` followed by `compare` passed again with the same scores (0.0940 / 0.2929).
- Bound: the check compares file modification times, so it cannot see an edit that preserves the mtime, and it does not cover `tools/` (a tool change does not change the scene).
