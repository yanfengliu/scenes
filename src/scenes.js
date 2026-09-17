// The scene registry: one entry per scene in this repo, in the order the picker lists them.
//
//   id          what names the scene in the URL (?scene=<id>) and in SCENE for the tools
//   title       what the picker shows and what the tab is called
//   entry       the module that builds it, resolved from this file, so paths are relative to src/
//   photo       the reference photo it is scored against, relative to the repo root
//   photoSize   that photo's pixel size: what `compare` decodes and scores at
//   shot        the scored frame's size: the viewport `shot` renders at and writes down
//   out         the directory this scene's artifacts are written to (render, sidecar, scores, sheets, views)
//   thresholds  the file holding this scene's ```json thresholds block, asserted by `npm test`
//   sourcePaths what `tools/lib/treehash.js` hashes to identify THIS scene's source: what the browser loads
//               to draw it, and nothing else. Two scenes share the flat `src/*.js` modules and each has its
//               own folder, and a scene's artifacts must not be invalidated by another scene's edit.
//
// index.html boots whatever ?scene= names, so adding an entry here is what puts a scene in the dropdown.
// Scene 1's modules sit directly in src/, from when it was the only scene; a second scene gets its own
// folder under src/ and points `entry` at it.
//
// The five fields after `entry` are what the Node tools read, through tools/lib/scene.js: this file is the
// one place a scene's sizes, photo and paths are named, so no tool has to know which scene it is looking
// at. THIS FILE IS IMPORTED BY NODE, so it must not import anything that touches `window` or three.js --
// it imports nothing at all, which is also why scene 1's sizes are repeated here as literals instead of
// being imported from src/layout.js. Those literals are the same numbers as src/layout.js's PHOTO and
// SHOT, and they are what `shot` and `compare` now use; keep the two in step.
export const SCENES = [
  {
    id: 'japan',
    title: 'Kyoto stepped street at sunset',
    entry: './main.js',
    photo: 'japan.webp',
    photoSize: { width: 600, height: 550 },
    shot: { width: 1200, height: 1100 },
    out: 'out',
    thresholds: 'docs/PLAN-scores.md',
    sourcePaths: ['index.html', 'src'],
  },
  {
    id: 'whitehouse',
    title: 'The White House, north front',
    entry: './whitehouse/main.js',
    photo: 'whitehouse.webp',
    photoSize: { width: 1200, height: 900 },
    shot: { width: 1200, height: 900 },
    out: 'out/wh',
    thresholds: 'docs/work/2_white-house-scene/scores.md',
    sourcePaths: ['index.html', 'src', 'src/whitehouse'],
  },
];

// What a bare URL loads, and what an unknown ?scene= falls back to. The TOOLS default to 'japan' by id
// rather than to this entry, so a scene inserted above scene 1 cannot move a gate's input.
export const DEFAULT_SCENE = SCENES[0];

export function findScene(id) {
  return SCENES.find((scene) => scene.id === id) ?? null;
}

// The scene the current URL asks for.
export function requestedScene(search = window.location.search) {
  return findScene(new URLSearchParams(search).get('scene')) ?? DEFAULT_SCENE;
}
