# Lessons (queue)

Read at session start. A lesson is prose only until it is a gate: each entry names the gate that will retire it (a test, a check in a tool, a lint rule, a fixed command) and is deleted in the commit landing that gate, once the gate has been made to go red by reintroducing the defect. The proof of each retirement lives in `gate-proofs.md`.

An entry that can name no gate is not a lesson: repo-only knowledge goes to `docs/policies/local-rules.md`, and the rest is dropped.

Entry shape: date, claim, evidence (measurement, commit, or test id), the gate that retires it.

*Empty. The last entry — a mesh name being load-bearing in two regexes that do not know about each other — was retired on 2026-09-16 by `npm run namerules` (`tools/namerules.js`, in `npm test`). Its proof, including the mutation that reproduces the 98 → 100 shadow-caster move the original defect made as 364 → 366 draw calls, is under `name rules: a mesh name is an interface between rules that do not import each other` in `gate-proofs.md`. The entry itself reads back out of `git show a78ba8f:docs/learning/lessons.md`.*
