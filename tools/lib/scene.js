// Which scene the Node tools work on, and where that scene's artifacts live.
//
// `SCENE=<id>` names one; unset runs scene 1, because every recorded number in this repo is scene 1's and
// a gate run must not move because a second scene was added. The registry in src/scenes.js is the single
// source of the facts -- the photo, the photo size, the shot size, the output directory and the thresholds
// file -- so a tool reads them here instead of knowing which scene it is looking at.
//
// The resolution happens AT IMPORT, so every tool gets the same answer and none of them can disagree with
// another about which scene this run is for. An unknown id throws here rather than falling back to the
// default: `SCENE=whitehose` (a typo) would otherwise score one scene's render against another scene's
// photo and thresholds and report the numbers as that scene's. The tools load this module inside a
// try/catch, so what an operator sees is one `FAIL:` line naming the ids that exist rather than a node
// stack trace thrown while the tool's own imports were still being evaluated.
import { SCENES, findScene } from '../../src/scenes.js';

// A literal, not DEFAULT_SCENE.id: DEFAULT_SCENE is what the PAGE falls back to, and it is the registry's
// first entry, so a second scene inserted above scene 1 would silently move every gate's input.
export const DEFAULT_SCENE_ID = 'japan';

const requested = (process.env.SCENE ?? '').trim() || DEFAULT_SCENE_ID;
const resolved = findScene(requested);
if (!resolved) {
  throw new Error(
    `SCENE=${requested} names no scene in src/scenes.js, whose ids are: ${SCENES.map((s) => s.id).join(', ')}. `
    + `Set SCENE to one of those ids, leave it unset to run the default scene (${DEFAULT_SCENE_ID}), or add the `
    + 'scene you meant to SCENES in src/scenes.js -- the registry is where this file reads the ids, the photo, '
    + 'the sizes and the output paths from.',
  );
}

export const scene = resolved;

// True when this run is for the scene a bare URL loads. A browser tool opens `${server.url}/` in that
// case and `${server.url}/?scene=${id}` otherwise, so scene 1's page URL -- and the provenance of its
// contract frame -- is exactly what it was before the tools were scene-scoped.
export const isDefaultScene = scene.id === DEFAULT_SCENE_ID;

// This scene's artifacts, derived from its own `out` rather than typed out in each tool. Forward slashes
// and not path.join: these strings are printed, are written into out/render.tree.json's `render` field and
// are compared against recorded paths, so they must read the same on every platform.
export const renderPath = `${scene.out}/render.png`;
export const treePath = `${scene.out}/render.tree.json`;
export const scoresPath = `${scene.out}/scores.json`;
export const comparePath = `${scene.out}/compare.png`;
export const overlayPath = `${scene.out}/overlay.png`;
export const lightAnchorPath = `${scene.out}/light-anchor.json`;
export const viewsDir = `${scene.out}/views`;
