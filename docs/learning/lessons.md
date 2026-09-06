# Lessons (queue)

Read at session start. A lesson is prose only until it is a gate: each entry names the gate that will retire it (a test, a check in a tool, a lint rule, a fixed command) and is deleted in the commit landing that gate, once the gate has been made to go red by reintroducing the defect. The proof of each retirement lives in `gate-proofs.md`.

An entry that can name no gate is not a lesson: repo-only knowledge goes to `docs/policies/local-rules.md`, and the rest is dropped.

Entry shape: date, claim, evidence (measurement, commit, or test id), the gate that retires it.

- 2026-09-05. Claim: a piece can float or be buried without any gate noticing. Evidence: the phase 3 critics found the far houses' bodies 20 m above the ground, the pines' feet in mid-air, the planter shrub with its base inside the fence roof and the small shrub under the walkway, all while `npm test` passed and the placement gate was green (it checks what is in front, not what is underneath); recorded in `docs/devlog/detailed/2026-09-05-phase-3.md`. Gate: a grounding check in `tools/placement.js` (run by `npm test`) that casts a downward ray from a list of bases in `src/layout.js` (each with the mesh it must land on and a tolerance) and fails when the first hit is farther than the tolerance or is another object.
