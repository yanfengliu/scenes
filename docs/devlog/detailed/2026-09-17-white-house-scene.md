# 2026-09-17 — the White House scene, and what it cost to add a second scene

A second scene was asked for: research photographs of the White House and build the most realistic 3D model
of it this repo can, with the coordinator managing subagents, inspecting renders visually, and iterating.
This is what happened, what was believed and proved false, and what a later session should not have to
rediscover. It is written while the scene was still being improved, so the score rows are the ones measured
at the time each claim was made.

## The shape of the work

The repo had one scene and every tool was built around it. Every gate opened the bare URL, which loads
`SCENES[0]`; `shot` and `compare` hardcoded `japan.webp`, a 1200x1100 frame and `out/render.png`; and
`placement`, `clearance`, `namerules`, `animation` and `record` import scene 1's `src/layout.js` and pose
scene 1's street. So the first thing built was not the scene: it was the **scene-scoped render and score
path**, landed and proved before a line of scene code existed, because a second scene that could move scene
1's contract frame would have been a regression in the one thing this repo holds most tightly.

That decision is the reason scene 1's contract frame is byte-identical at the end of the session
(`e95a53185ee3`, 0.0596 / 0.5713) while a second scene now renders and scores beside it.

## What the research changed

Three read-only research handoffs, then the modelling. The photograph dossier and a separate dimension
dossier between them corrected **four things the task brief had wrong**, and every one of them would have
produced a building that is not the White House:

| The brief said | The record says |
| --- | --- |
| a low-pitched roof, largely hidden behind the balustrade | the roof was hipped **historically** and is **flat today** (NPS: "the roof has subsequently been altered and is now flat") |
| the south portico is a semicircular bow | it is semicircular **and flat-roofed with no pediment at all** |
| four columns on the north portico | four (tetrastyle) is right, but the **south is hexastyle** — six Ionic columns, single tier, two storeys tall, on a rusticated podium with seven arched openings |
| 11 bays north, 13 south | **11 on both**; Wikipedia's "the bow is flanked by five bays" is an error against the NPS page Wikipedia itself cites |

Two more corrections that were nearly modelled in: the *Genius of America* pediment sculpture is on the
**Capitol**, not the White House, and "Dipping Balcony" is not a name any source uses.

## The measured drawings, which are the real find

HABS **DC-37** (LOC digital id `dc0402`) has **41 surviving measured sheets**, public domain, at a
predictable URL: `https://cdn.loc.gov/service/pnp/habshaer/dc/dc0400/dc0402/sheet/000NN{v,r}.jpg`. The
trap is that **`NN` is the sheet's position in the index, not its sheet number**, and the offset changes
partway through the list (sheet 31 is index 10; sheet 51 is index 24; sheet 76 is index 33). A URL built
from the sheet number silently returns a **different drawing**, which reads as "the sheet does not show
what the index says" rather than as a wrong URL. The mapping that was verified by reading the title block
of each file is in `docs/work/2_white-house-scene/plan.md`.

What they gave, that no published source does:

* the **level datums**, off the dimensioned South elevation: ground floor -6'-8", first floor +10'-0",
  second floor +30'-0", cornice +64'-6";
* the **three window types** at 1/4" = 1'-0", on "typical first floor windows": a plain-headed window, a
  window under a **triangular** pediment carried on console brackets, and one under a **segmental**
  pediment, all **six-over-six**;
* the north portico's **column and entablature** in section, elevation and plan, with dimension strings —
  the single biggest gap in every published source.

## What was believed and proved false

* **"A camera 72 m out at eye height reproduces the photograph."** It does not. The photograph's four
  measured landmarks fix the products `tanH * d` and `tanV * d`, not `d`, so the distance and the lens are
  one free pair; fixing the lens from the file's own EXIF (24 mm equivalent) then forces an eye **9.1 m**
  above the north lawn. The first pass modelled that honestly as terrain — a lawn sloping down 7.5 m from
  the building toward the camera — and the record does **not** support it: the photograph's own GPS
  altitude (19.351 m ASL) is within centimetres of the derived north grade (19.4 m). So the 7.5 m drop is
  the *frame's* reading and not the survey's. It is left in the model, because removing it moves the wall
  base off the row the photograph puts it on, and it is named as the scene's largest judgement call.
* **"The overlay proves the calibration."** It nearly concealed the opposite. The previous pass reported
  four landmarks at 0.0 px, and its own `LANDMARK_MARKS` overlay draws **scene 1's** landmark boxes —
  `tools/compare.js` still imports them from `src/layout.js` for every scene. Reading the overlay as this
  scene's landmarks is reading scene 1's. It is annotation only and moves no score; it is now reported as
  a known bound rather than left to be discovered.
* **"The blockout's geometry is wrong."** It is not. A first 50% overlay read as though the render's
  building sat lower and larger than the photograph's; a second, unannotated overlay showed the silhouette
  within a few pixels. The cause of the first reading was the annotated overlay's own grid and boxes, not
  the render.
* **"A non-ASCII character in a source file is cosmetic."** It is not: `src/whitehouse/layout.js` was
  written with `§` as a single 0xA7 byte and the read tool refused the whole file as invalid UTF-8, so a
  reviewer could not open the file that holds every dimension. Every scene file is now pure ASCII and the
  check is a byte scan.

## Score rows, so the next session can see the slope

| Frame | Cell distance | SSIM | What it was |
| --- | --- | --- | --- |
| Blockout, unwritten scene | — | — | `src/whitehouse/` did not exist; `?scene=whitehouse` failed to load its entry module |
| Blockout, first render | — | — | grounds built on the wrong side of the building, camera inside its own fence |
| Blockout, after the sign fix and calibration | 0.1981 | 0.1398 | geometry placed, tonality and facade detail missing |
| Tonality pass, sky and rig | 0.1681 | 0.1398 | the rig solved by measuring the scene's own response to each light |
| Facade detail | 0.1436 | 0.1273 | pediments, consoles, six-over-six sash, dentils, piers, apron panels |
| **The committed frame** | **0.1450** | **0.1269** | plus the two `nudge` geometry fixes and the tree line |

Scene 1, for scale: 0.0596 / 0.5713, after five iterations of its own realism loop. The two are not
comparable subjects — a white building under a bright sky is a far harder thing to match on a grid of mean
colours than a dark stepped street — but the gap is the work that is left. `scores.md` in the same folder
says what the numbers do and do not mean here, and the thresholds the suite asserts live in it.

## What the review found, and what fixing it cost

An independent read-only review of the tooling half found two defects, and both were reproduced before
either was fixed. They matter beyond this session because both are the same mistake in different clothes:
**a check that reports a verdict about something it never looked at.**

* `nudge` and `blackframe` were listed in `tools/test.js` as reading no scene data, and both opened the bare
  URL — which loads `SCENES[0]`. Under `SCENE=whitehouse` they measured scene 1 and their green was reported
  as the whitehouse's. The two gates that exist for exactly the defects nobody else can see were the two
  measuring the wrong building. Both now open the registry's scene, write under that scene's `out`, and print
  `scene: <id>`; `tools/test.js` requires that line and checks the id against the run, so the claim is now
  evidence rather than a list entry.
* `sourceTree()` hashed `index.html` and all of `src/` **recursively**, so every scene's files were part of
  every other scene's tree hash. The cost was not hypothetical: scene 1's `shot` deleted its own render and
  sidecar, the contract frame at `e95a53185ee3`, because it saw `src/whitehouse/*.js` change while the frame
  was being made. Each registry entry now names `sourcePaths`; scene 1 hashes the flat `src/*.js` set and a
  scene in a subdirectory names its own folder too. Proved by measuring both directions: a comment appended
  to `src/whitehouse/sky.js` moves the whitehouse hash and leaves scene 1's at `9b1f2b5fdc399afc`.

Two more things the same review caught, both kept as prose rather than fixed: `compare` annotates every
scene's overlay with scene 1's landmark boxes (so `out/wh/overlay.png` labels the White House "cherry"), and
the `views`, `probe`, `inspect`, `perf` and `try` diagnostics are still scene 1's. Both are now named in the
README and in the work entry.

## Three defects only the orbit frames could see

None of these is visible in the scored frame, and each was found by rendering a pose and looking at it.

1. **From due south the building was invisible.** Two framing trees with 19 m crowns met across the frame
   and left a slot of building between two near-black masses. Fixed by shrinking the crowns, raising them on
   longer trunks and moving the pair out and back — and the fix has a measured price, 0.004 of SSIM, because
   the photograph really does show those trees as large dark masses at the frame's edges. The pair is 16 m
   and not 19 m for that reason.
2. **A near-black slab lay beside the west end.** It was never a mesh: it was the **void past the lawn's own
   edge**, which stopped at ±180 m, with a 34 m hedge and a 30 m boundary wall running away from the camera
   end-on. Widening the terrain and breaking both into rounded segments closed it. The lesson is worth
   keeping: a dark rectangle in a render is as likely to be nothing as something, and the cheapest way to
   tell is to move the camera until its edge is in frame.
3. **The north lawn's end hedges read as separate balls on a pale strip**, because their crown centres sat at
   0.55 of their height with a radius of 0.62 of it — floating. Dropping the centre to 0.42 and tightening the
   stagger merged them. This one was the coordinator's own edit after the handoff, which is the whole reason
   the coordinator looks at the frames instead of only reading the report.

## What the camera cost, and why it was accepted

The photograph's four measured landmarks — the wall's two ends, its base and its parapet — fix the products
`tanH * d` and `tanV * d`, not the distance. The file's own EXIF lens then settles the distance, and the eye
height follows with no freedom left: **9.1 m above the north lawn**. It is not a camera anybody held. The
scene builds it as terrain instead — the lawn falls 7.5 m from the building to the camera's station — which
reproduces the photograph's framing to under 2 px on all four landmarks and is what a photographer standing
below a terrace would in fact see. Three lenses were tried against a plausible eye height and none closes:
at 24 mm equivalent the eye must be 9.1 m, at 30 mm 6.5 m, at 39 mm 4.1 m. The record does not support a
7.5 m drop over that run, so this is the frame's reading and not the survey's, and it is the largest
judgement call in the scene.


## Files a later session should know about

* `docs/work/2_white-house-scene/plan.md` — the work entry: outcome, acceptance, what the model is built
  from, the HABS sheet table, and the status log.
* `out/wh/` — the scratch: `contract.md` (a 945-line audit of what a second scene must provide),
  `research-photo.md` and `research-dims.md` (the two sourced dossiers), `habs-findings.md` (the drawings,
  read), `calibration.md` (the camera solve and its residuals), and `scratch/*.mjs` — `peek.mjs` (open a
  scene and report), `pixel.mjs` (a colour at a photo position), `profile.mjs` and `landmarks.mjs` (scan
  the photograph and the render), `calibrate.mjs`, `fetch.mjs`, `ref-webp.mjs`.
