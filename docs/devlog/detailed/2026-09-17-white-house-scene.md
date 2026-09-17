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

Scene 1, for scale: 0.0596 / 0.5713, after five iterations of its own realism loop. The two are not
comparable subjects — a white building under a bright sky is a far harder thing to match on a grid of mean
colours than a dark stepped street — but the gap is the work that is left.

## Files a later session should know about

* `docs/work/2_white-house-scene/plan.md` — the work entry: outcome, acceptance, what the model is built
  from, the HABS sheet table, and the status log.
* `out/wh/` — the scratch: `contract.md` (a 945-line audit of what a second scene must provide),
  `research-photo.md` and `research-dims.md` (the two sourced dossiers), `habs-findings.md` (the drawings,
  read), `calibration.md` (the camera solve and its residuals), and `scratch/*.mjs` — `peek.mjs` (open a
  scene and report), `pixel.mjs` (a colour at a photo position), `profile.mjs` and `landmarks.mjs` (scan
  the photograph and the render), `calibrate.mjs`, `fetch.mjs`, `ref-webp.mjs`.
