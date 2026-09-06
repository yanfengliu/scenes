# Lessons (queue)

Read at session start. A lesson is prose only until it is a gate: each entry names the gate that will retire it (a test, a check in a tool, a lint rule, a fixed command) and is deleted in the commit landing that gate, once the gate has been made to go red by reintroducing the defect. The proof of each retirement lives in `gate-proofs.md`.

An entry that can name no gate is not a lesson: repo-only knowledge goes to `docs/policies/local-rules.md`, and the rest is dropped.

Entry shape: date, claim, evidence (measurement, commit, or test id), the gate that retires it.

No open lessons.
