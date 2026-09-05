# Lessons (queue)

Read at session start. A lesson is prose only until it is a gate: each entry names the gate that will retire it (a test, a check in a tool, a lint rule, a fixed command) and is deleted in the commit landing that gate, once the gate has been made to go red by reintroducing the defect. The proof of each retirement lives in `gate-proofs.md`.

An entry that can name no gate is not a lesson: repo-only knowledge goes to `docs/policies/local-rules.md`, and the rest is dropped.

Entry shape: date, claim, evidence (measurement, commit, or test id), the gate that retires it.

- 2026-09-05. Claim: the compare scores cannot see a piece built inside another (both sliding doors, a lantern and the awning sat inside their wall boxes and the sign floated in air while `npm test` scored 0.0899, its best of the phase). Evidence: the phase 2 critic's raycasts from the street hit `left annex lower` before `annex door 1 lattice`, and the probe at (0.33, 0.58) hit `sign` then `ground base` with no wall behind; recorded in `docs/devlog/detailed/2026-09-05-phase-2.md`. Gate: a placement check in `tools/probe.js` (run by `npm test`) that reads a list of landmarks from `src/layout.js` with the mesh name expected as the first hit under each photo position, and fails when the first hit is another mesh or when a named attachment (door, lantern, sign, awning) is not the first hit from a ray cast toward its wall.
