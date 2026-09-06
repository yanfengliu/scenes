# AGENTS.md — scenes

## What this is

Browser 3D sandbox scenes that test what a model can build from a single photo. Scene 1 (`index.html`) recreates `japan.webp`, a Kyoto Sannenzaka-style stepped street at sunset with a weeping cherry, in Three.js. The page loads framed exactly like the photo; drag orbits, the wheel zooms, and `R` or the on-screen button resets the photo view.
There is one page for every scene: the dropdown in the corner picks one, `?scene=<id>` names it in the URL, and the registry that lists them is `src/scenes.js`.

Goal: a render that scores as close as possible to the photo on the compare gate while staying a real 3D scene from any angle. Non-goals: photogrammetry, downloaded assets, a build step.

Stack: Three.js 0.185.1 as ES modules through a pinned jsdelivr import map (`three`, `three/addons/`), plain `index.html` plus `src/*.js`, no bundler. Node 24 (`.nvmrc`) runs the gates; Playwright 1.61.1 (chromium) is the only dev dependency. Every asset is procedural.

The phased plan is `docs/PLAN.md` (manager-owned). Scores and their thresholds are in `docs/PLAN-scores.md`. Repo-only rules: `docs/policies/local-rules.md`.

<!-- FLEET-CANON:BEGIN -->
<!-- FLEET-CANON:END -->

## Gates

- `npm test` runs `shot`, `compare`, `placement`, `animation` and `nudge`, then asserts the scores against the thresholds in `docs/PLAN-scores.md`. Needs network for the Three.js CDN and a cached Playwright chromium (`npx playwright install chromium` once).
- `npm run placement` runs two checks the scores cannot make. `PLACEMENT_CHECKS` casts the photo camera's ray through each listed position and fails unless the first mesh hit is the named one (a piece built inside another, a canopy hiding a missing trunk). `GROUNDING_CHECKS` takes each listed object's own base, drops a ray, and fails when the mesh it should stand on is too far below it (floating) or too far above it (buried). Both lists are in `src/layout.js`.
- `npm run animation` scores the photo view at seven points across the animation cycle and fails if the worst of them leaves tolerance. The shot gate pins the clock at t = 0, so it alone cannot see a drift that only shows once the canopy has swung.
- `npm run nudge` renders three poses twice each (identical output required), then moves the camera 2 mm and fails when too many pixels change drastically. It exists because a user saw the scene flicker while orbiting and no scored gate could see it: a still camera renders the same frame every time. The scene is rendered above canvas resolution (`POST.renderScale`) for the same reason.
- `npm run webp` encodes `out/render.png` as `docs/render.webp` (under 256 KiB) through chromium's own encoder.
- `npm run shot` renders the photo view at 1200x1100 in headless chromium to `out/render.png` and fails on any console error, page error, or failed request.
- `npm run compare` scores `out/render.png` against `japan.webp`: mean color distance over a 24x22 grid of cells (lower is better) and grayscale SSIM at 64 px (higher is better). It refuses a render older than the source. It writes `out/compare.png` (photo | render | 50% overlay | heat-map), `out/overlay.png` (the plan's landmark boxes over a 50% blend at 1200x1100), and `out/scores.json` (scores plus per-cell means).
- `npm run perf` prints the median frame time and draw calls over 5 s at 1920x1080. Budget: under 16 ms and under 400 draw calls. It launches chromium with the GPU (ANGLE/D3D11) and prints the renderer it got; `PERF_GPU=0` forces SwiftShader. `shot` always uses SwiftShader so renders are deterministic.
- `npm run dev` serves the repo root on http://localhost:8080.
- `npm run probe -- u,v ...` names the mesh under each photo position and its pixel; `npm run inspect -- pair u0 v0 u1 v1` writes photo-versus-render crops. Both are diagnostics, not gates.

Bound of the compare scores: they see 528 mean colors and a 64 px grayscale image, so a landmark 10 px off in the photo is invisible to them. `out/overlay.png` is the check for placement.

## Invariants and boundaries

- The photo view is the contract. `src/layout.js` holds the camera model and every landmark's photo position, and the tools import it; changing the camera moves every placement and invalidates the thresholds.
- The frame is lit and tone mapped from phase 4: `src/main.js` builds the rig (`lighting.js`) and the post chain (`post.js`), and every color in `src/layout.js` is a *displayed* target, not an albedo. `src/tonemap.js` inverts the ACES curve three applies, and `materials.js` turns each sampled mean into the albedo that displays as that mean again through the rig and the curve. Add a color the same way: sample it from the photo, hand it to `material()` or `surface()`, and let the factory do the inversion.
- `index.html` is the only page. `src/boot.js` reads `?scene=<id>`, sets the tab title, mounts the picker (`src/picker.js`) and imports that scene's entry module named by the registry (`src/scenes.js`); an unknown or missing id loads the first entry. Scene 1's entry is `src/main.js` and its modules sit flat in `src/`, from when it was the only scene; a new scene is a registry entry plus its own folder under `src/`. Switching scenes reloads the page rather than swapping in place, so no scene has to know how to tear itself down.
- The page's chrome lives in one `#hud` box, because the gates that screenshot hide it wholesale (`HIDE_UI_CSS` in `tools/lib/browser.js`): a control added outside that box would land in the scored image.
- The scene is assembled by `src/scene.js` from modules: `paving.js` (instanced slabs: stairs, gutter, landing, street, side stair, platform), `walls.js` (stacked stones, the low plaster wall and its tiled cap, the fence's stone core, the pots), `roofs.js` (kawara pan tiles, caps, ridges, rafters, boards, the fence's small roof), `facades.js` (board walls, lattices, shoji, balcony, doors, awning, sign, lanterns, fence boards, lamp post, noren), `architecture.js` (what is still block-out: roof undersides, the right roof mass, the paved bands; plus the dormer's body), `vegetation.js` (the cherry: spline limbs, strands, blossom cards colored from the photo field; pines; shrubs, potted plants, moss, weeds), `figures.js` (the person), `animation.js` (the wind, the petals, the drift and the sway, and the clock the gates pin), `background.js` (mountain layers, the hill surface, the far houses and their ground, the bend's block-out). `boot.js` resolves the scene and `scenes.js`/`picker.js` list and switch them, `primitives.js` holds the mesh helpers, `instancing.js` the InstancedMesh and geometry helpers, `textures.js` the canvas albedo and card generators, `materials.js` the material factory (lit since phase 4; `MATERIALS.lit` selects the material class, not a whole unlit pipeline), `tonemap.js` the tone curve and its inverse, `lighting.js` the rig, `sky.js` the dome, `post.js` the composer, `photofield.js` the baked canopy field and mask, `random.js` the seeded PRNG.
- Repeated pieces are instanced geometry (one InstancedMesh per material): tiles, slats, slabs and stones are never painted on. The scene builds deterministically from fixed seeds, so the shot is reproducible.
- Every hand-built geometry must compute its normals. A missing normal attribute is invisible under an unlit material and produces NaN under a lit one, and one NaN texel spreads through the bloom blur to the whole frame.
- Photo space is (u right, v down) as fractions of the frame. World space is y up with the photo camera at x = 0 looking along -z; +x is the right side of the street.
- Nothing binary enters Git except `japan.webp` (the reference) and, in phase 5, `docs/render.webp` under 256 KiB. `out/` is ignored and regenerated by the gates.
- No runtime downloads except the pinned Three.js modules. No bundler, no build step.
- The manager session owns `docs/PLAN.md`; the implementer never edits it.

## Conventions

- Colors in `src/layout.js` are sRGB hex values sampled from the photo. Materials are unlit until phase 4; every procedural texture is corrected to its material's mean (`textures.js`), so textures add variation around the sampled color and never a new color. Where a lighter or darker element sits in front of a wall (joints, slats, shoji, mortar between stones), the wall's color is balanced (`balancedMean`) so the region still averages to the sampled mean. A few accents with no clean photo region (lattice slats, shoji paper, grid bars, the mortar and cap darkening factors) are set by eye and say so where they are defined. Normal and roughness maps are generated alongside each albedo and kept in `material.userData.pbr` for the lit materials of phase 4. Foliage is alpha-tested cards: the card textures are white shapes, and each instance's color is a sampled mean divided by the card's opaque-texel mean, so the visible mean lands on the sample. The cherry's blossoms take their colors from `src/photofield.js`, the photo's own cell means over the canopy, at their photo position; regenerate that field only if the photo changes.
- Anything the photo pins down is placed through the helpers: `uvToWorld` (a photo position at a depth), `rayHitGround` (drop a point onto a height field), `depthForU` (depth for a known side offset). Dimensions the photo cannot pin down (house depths, terrace lines, wall thicknesses) are block-out estimates typed into `src/layout.js`, or into the module that builds them, with the photo landmark they serve named nearby.
- Every mesh has a `name`; the probe tool maps a wrong pixel to its mesh.
- Devlog: one dated line per session in `docs/devlog/summary.md`, and a file under `docs/devlog/detailed/` for anything a later session could trip over. Lessons queue: `docs/learning/lessons.md`, each naming the gate that retires it; retired ones are proved in `docs/learning/gate-proofs.md`. User-reported defects: `docs/learning/defect-register.md`.
- Prose is one line per paragraph.
- Anything that moves is animated in the vertex shader when there is more than a handful of it: `src/animation.js` patches a material's `project_vertex` with a wind offset and advances one time uniform, so 30,000 blossom cards and 420 petals cost no per-frame CPU. The clock is deterministic and `window.__scene.setTime(t)` pins it, which is how the gates stay reproducible.
