# Gate proofs

Each retired lesson's gate is listed with the mutation that made it go red, the failure it produced, and where the evidence lived before retirement. A gate that was never seen red proves nothing.

## animation: the scene moves, and not too much (2026-09-05)

- Claim (in the gate's own header, `tools/animation.js`): the scored shot is one frame, so it cannot see what the animation does at t = 3 s. The gate scores seven frames across the wind's slowest period and asserts the worst frame's scores, the spread between frames, and the mean per-pixel change between neighbouring frames from both sides: too little and the scene has stopped moving, too much and it is thrashing.
- Origin: the phase 5 plan requires the photo view to hold "at any moment", and the manager asked for the spread to be a number rather than a claim.
- Mutation: `WIND.canopy` in `src/animation.js` raised from 0.085 m to 1.2 m, a fourteen-fold canopy sway that is grotesque by eye, then `ANIMATION_FRAMES=3 npm run animation`.
- Failure produced: `FAIL motion between frames: 0.6522 <= 0.4000`, then `FAIL: the animation is outside what the photo view allows`, exit status 1. Restored, the same run printed `ok motion between frames: 0.2073 <= 0.4000`.
- The first version of this gate asserted only the worst frame's scores against a loose allowance, and the critic showed it passing that same fourteen-fold sway without blinking: the scores barely move when the canopy sways, because its mean color is much the same wherever it is. The motion bound is what actually constrains the amplitude, and it was added because of that.
- Bound: the motion figure depends on the spacing of the sampled times, so `ANIMATION_FRAMES` changes it (0.18 at seven frames, 0.21 at three); the ceiling of 0.4 is set for the wider spacing. It measures the whole frame, so a violent animation in a small part of the scene could stay under it.

## grounding: what each object stands on (2026-09-05)

- Claim (in the gate's own header, `tools/placement.js`, and in `GROUNDING_CHECKS` in `src/layout.js`): the scores and the placement gate both look along the camera's ray, so nothing sees what is underneath an object. The grounding half finds each listed object, takes the bottom of its own bounding box, drops a ray from above it, and fails when the mesh it should stand on is more than `tolerance` below it (floating) or more than `sink` above it (buried).
- Origin: the phase 3 lesson. Two critics found the far houses' bodies 20 m over nothing, the pines' feet in mid-air, the planter shrub with its base inside the fence roof and the small shrub under the walkway, every time with `npm test` green; recorded in `docs/devlog/detailed/2026-09-05-phase-3.md` and queued in `lessons.md` from commit 61ada57 until this one.
- Mutation: in `src/background.js`, the far houses' base raised by 3.6 m (`yBase = Math.min(...) + 3.0` in place of `- 0.6`), then `npm run placement`.
- Failure produced: `FAIL far roof c house lower stands on far plots left: it floats 1.41 m over "far plots left", past the 0.8 m allowed`, exit status 1. Restored, the run printed `placement: 19 in front, 8 grounded, all ok`.
- A first version checked a fixed point from `src/layout.js` rather than the object, and stayed green when the object floated away, because the ground under the recorded point had not moved. The check now measures the object's own base every run.
- Bound: it covers the eight objects listed, one ray each, and an object whose footprint is not under its bounding box's centre needs an `x`/`z` override (the cherry's wood is one mesh whose box is centred in the canopy). It says nothing about objects that intersect each other sideways.

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
