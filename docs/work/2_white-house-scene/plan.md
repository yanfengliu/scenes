# Work 2 — the White House scene

Status: open. Coordinator: the session that opened this entry. Implementation is delegated; the coordinator inspects renders and accepts handoffs.

## Outcome

A second scene in this repo: the White House (1600 Pennsylvania Avenue) and its grounds, built procedurally in Three.js in `src/whitehouse/`, registered in `src/scenes.js`, reachable as `?scene=whitehouse` and from the picker.

The scene's **photo view** reproduces a researched public-domain photograph of the building. The building is a real 3D model of real dimensions — its measured length, depth, storey heights, column order and count, window bays and portico geometry — not a painted backdrop, and it holds up from any orbit angle.

"Looks as realistic as possible" is the acceptance criterion, and it is judged the way this repo judges every scene: a render of the photo view scored against the reference photo (cell colour distance, grayscale SSIM), plus a multi-angle sweep that a person looks at, one frame at a time.

## Non-goals

- Photogrammetry, downloaded models, downloaded textures, any asset that is not procedural.
- A build step, a bundler, or a new runtime dependency.
- Touching scene 1. Its contract frame, its recorded digests, its thresholds and its modules stay exactly as they are. A second thread is working in scene 1 while this entry is open.
- Changing any shared module's behaviour for scene 1's benefit or this scene's.

## Acceptance criteria

1. `?scene=whitehouse` loads, renders, orbits, zooms, and resets to the photo view; `R` and the on-screen button both return to it.
2. The building's proportions are the researched real ones, cited in `src/whitehouse/layout.js` beside the figures, and a multi-angle sweep shows a coherent building from behind, above and to both sides — no missing face, no floating part, no inside-out surface.
3. `npm run shot` and `npm run compare` for the whitehouse scene produce a scored frame and sheets; the numbers are recorded in `docs/PLAN-scores.md` and asserted by `npm test`, with the thresholds set from the achieved scores minus a margin and never loosened afterwards.
4. Every gate in `npm test` still passes for scene 1, unchanged, with scene 1's scores unmoved.
5. The page reports no console error, no page error and no failed request at the photo view or in the sweep.
6. Every file this entry adds or edits is committed, and nothing else is. Verified with `git show --stat` on each commit.

## Reference photo

Chosen from the research report now at `docs/work/2_white-house-scene/research-photo.md`:

**`File:The White House June 2024.jpg`** — Wikimedia Commons, by DJTechYT, **CC BY-SA 4.0**, 3296x2472, a frontal view of the North Front from across Pennsylvania Avenue at the edge of Lafayette Square, taken at 13:08 on 20 June 2024.

Why it is the one: it is the only candidate that is simultaneously a full **frontal North Front** (not oblique), with the **North Lawn, the North Lawn fountain and the flower beds in frame** so the reference is a scene and not an elevation, shot at **midday in high summer** so the north facade is lit flat by sky alone with no harsh self-shadow to fight, and supplied with **complete EXIF** (GPS position and a 24 mm-equivalent focal length) so the camera can be reconstructed by arithmetic instead of by eye. It is also large enough to read the window pediments, the balustrade and the fence.

It is committed as `whitehouse.webp` (1200x900, 206 KiB, sha256 `6d10f85c2100…`), cropped to 4:3 and resampled from the original. The attribution and the share-alike term are recorded in `LICENSE`, beside the existing carve-out for `japan.webp`.

Three sources back it up and are cited where the model uses them: `File:Lado Norte de la Casa Blanca-2023 01.jpg` (CC BY 3.0, 7147x4541, 50 mm-equivalent) for facade detail, `File:North Façade White House.JPG` (public domain) as a licence-clean cross-check, and the HABS measured sheets for geometry.

The camera was calibrated against the photograph rather than taken from the EXIF, because the two disagree: a luminance profile down the frame puts the north wall's base at v = 0.617 and its parapet at v = 0.377, and the wall's left and right ends at u = 0.132 and u = 0.871, which fits a camera about 75 m north of the north facade at 1.6 m above grade with a vertical field of view near 52 degrees and a pitch of about +4.6 degrees up. The photograph's own EXIF compass heading disagrees with its coordinates by 19 degrees and was not used; the coordinates and the measured framing agree with each other.

The White House's real dimensions come from the White House Historical Association's published set, recorded with their sources in `src/whitehouse/layout.js`: 168 ft (51.2 m) long, 85 ft 6 in (26.1 m) deep without porticoes and 152 ft (46.3 m) with them, 60 ft 4 in (18.4 m) to the top of the roof on the north side and a north facade of 50 ft 4 in (15.3 m) from grade to parapet.

## Architecture

- **One folder per scene.** `src/whitehouse/` holds everything this scene needs: `layout.js` (camera model, photo landmarks, real dimensions, sampled colours, placement and grounding checks), `main.js` (the entry module: renderer, controls, camera, the `window.__scene` API), and one module per group of geometry.
- **The photo space and world space conventions are scene 1's**, because the tools and the gates already read them: `u` right and `v` down as fractions of the frame; world space `y` up with the photo camera at the origin looking along `-z`. The projection helpers are re-implemented in this scene's `layout.js` rather than imported, because the shared ones take the frame's aspect ratio from scene 1's photo; the divergence and the reason are recorded where they happen.
- **Shared modules are imported, not copied**, where they are scene-agnostic: `primitives.js` (the mesh builder and its normal computation), `materials.js` and `tonemap.js` (albedo inversion), `lighting.js`, `post.js`, `sky.js`, `instancing.js`, `textures.js`, `random.js`. The contract report at `out/wh/contract.md` records which of these are genuinely scene-agnostic and which are not.
- **`window.__scene` is the scene's contract with the tools**, and it is the same shape scene 1 exposes. Importing a scene must render nothing and start nothing; the entry module builds the scene, renders frames, and resolves `window.__sceneReady` (already set up by `index.html`) after the first frames.
- **Nothing about the scene is decided by taste where a photograph or a published dimension can decide it.** Colours are sampled from the reference photo; dimensions carry their source.

## Scoping the render and score path

`shot`, `compare` and `test` read scene 1's `src/layout.js` for the reference photo path, the frame size and the landmark marks. This entry makes those tools scene-scoped: a scene id selects the photo, the viewport, the output paths and the thresholds, and the default is scene 1 so its behaviour and its recorded digests do not move. The tool edits are deliberately narrow and are listed here rather than left implicit:

| File | Change |
| ---- | ------ |
| `src/scenes.js` | one entry per scene carrying the facts the tools need (id, title, entry, photo path, photo and shot size, output directory) |
| `tools/lib/scene.js` (new) | resolves the active scene from `SCENE`, defaulting to scene 1 |
| `tools/shot.js` | viewport and output paths from the active scene |
| `tools/compare.js` | photo path and output paths from the active scene; the same three scores and the same sheets |
| `tools/test.js` | asserts each scene's thresholds; scene 1's assertions are unchanged; a gate that reads scene 1's own landmark lists is **skipped with its reason printed** when `SCENE` names another scene, and the verdict line names what was skipped |

Not touched: `src/layout.js`, `src/main.js`, `src/background.js`, `src/post.js`, `src/lighting.js`, `src/animation.js`, `src/scene.js`, `tools/placement.js`, `tools/namerules.js`, `tools/clearance.js`, `tools/animation.js`, `tools/views.js`, `tools/treecheck.js`, `docs/PLAN-scores.md`.

## What the model is built from

Three sources, in this order of authority.

**1. The measured drawings, read directly.** The Historic American Buildings Survey (HABS DC-37, LOC digital id `dc0402`) has 41 surviving measured sheets, all public domain ("No known restrictions on images made by the U.S. Government"), and they are at predictable URLs: `https://cdn.loc.gov/service/pnp/habshaer/dc/dc0400/dc0402/sheet/000NN{r,v}.jpg`, where `NN` is the sheet's position in the index, not its sheet number. The sheets this scene uses, with the URL that reaches each one:

| Sheet | What it is | URL suffix |
| ----- | ---------- | ---------- |
| 31 | North elevation, full | `00010v` |
| 32 | East elevation, full and dimensioned | `00011v` |
| 34 | South elevation, full and dimensioned | `00012v` |
| 35 | South portico elevations | `00014v` |
| 51 | South portico | `00024v` |
| 76 | **North portico details: column and entablature** | `00034v` |
| 78 | Typical ground-floor windows and doors | `00036v` |
| 79 | **North portico entrance and steps** | `00037v` |
| 82 | **Typical first-floor windows — all three window types** | `00040v` |
| 70, 71 | Ground- and first-floor axonometrics | `00031v`, `00032v` |
| 2, 3 | Site plan and landscape plan | `00007v`, `00008v` |
| 4, 5 | Ground- and first-floor plans | `00006v`, `00009v` |

Sheet 40 (drawn as `00040v`, "typical first-floor windows") is the one that settles the facade: it draws an unpedimented window, a **triangular**-pedimented window on console brackets, and a **segmental**-pedimented window, at `1/4" = 1'-0"`, and its windows read **six-over-six**. Sheets 34 and 32 carry the level datums.

**2. The vertical levels, off the South and East elevations.** The South elevation's datum chain gives: ground floor at **-6'-8"**, first floor at **+10'-0"**, second floor at **+30'-0"**, cornice at **+64'-6"**, roof at **~+65'-6"**, with a dimension of **38'-0"** from the first floor to the roof. That is the storey structure the model uses, and it is the only measured storey data found anywhere: no published source gives floor levels.

**3. The reference photograph, for everything the drawings cannot say.** Where the drawings are silent — the projection of each portico, the portico and column dimensions, the coursing, the fence, the grounds, the trees — the model follows the photograph, and the code says so at the point it does.

**What is deliberately NOT modelled.** Several figures the brief originally carried are wrong or unsupported and are not in the model: the roof is a **flat deck** behind the balustrade, not a low hip; the **South Portico has no pediment** (it is flat-roofed, hexastyle, six Ionic columns on a rusticated podium with seven arched openings, reached by a double staircase of 21 risers per flight); the **North Portico is tetrastyle** with a triangular pediment and Ionic columns carrying a swag of roses between the volutes; there is no pediment sculpture (that is the Capitol's); the window pediments alternate but **which end starts with the triangle is not recorded anywhere** and is read off the photograph. The building is modelled in its **pre-October-2025** configuration, because the reference photograph is June 2024 and the East Wing was demolished later that year.

## What the gates can and cannot see here

- `shot` and `compare` see a 24x22 grid of mean colours and a 64 px grayscale image, so a window a few pixels off is invisible to them. The sweep and the overlay are the placement checks.
- Scene-scoped gates that are scene 1's by construction — `placement`, `clearance`, `namerules`, `animation` — are **not** extended to this scene in this entry. They read scene 1's landmark lists and its street, and running them against a second scene would report scene 1's expectations about a scene that is not scene 1. This scene gets its own placement and grounding checks in its own `layout.js` and its own tool; that bound is stated here rather than left to be discovered.

## Status log

Newest first. One line per event, with the evidence it rests on.

- Tool integration landed and proved: `src/scenes.js` carries one entry per scene (`photo`, `photoSize`, `shot`, `out`, `thresholds`), `tools/lib/scene.js` resolves the active one from `SCENE`, `shot` and `compare` are scene-scoped, and `test.js` runs each scene's own gates and thresholds. Scene 1 unmoved: `out/render.png` still `e95a53185ee3…`, scores still 0.0596 / 0.5713, `import-inert` green over all 20 tools.
- The reference photo was chosen, encoded to `whitehouse.webp` (1200x900, 206 KiB) and attributed in `LICENSE`; the camera was calibrated against the photograph's own measured edges rather than its EXIF, which disagrees with itself by 19 degrees.
- Three read-only research handoffs landed: the shared-module contract (`out/wh/contract.md`), the photograph and dimensions dossier (`out/wh/research-photo.md`), and a second sourced dimension dossier (`out/wh/research-dims.md`). Between them they corrected four things the brief had wrong (flat roof, no South Portico pediment, tetrastyle north against hexastyle south, 11 bays on both fronts) and located the HABS measured drawings.
- (open) Entry created. Research into the reference photograph and the shared-module contract dispatched as two read-only subagents.
