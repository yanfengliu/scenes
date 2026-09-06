// The scene registry: one entry per scene in this repo, in the order the picker lists them.
//
//   id     what names the scene in the URL (?scene=<id>)
//   title  what the picker shows and what the tab is called
//   entry  the module that builds it, resolved from this file, so paths are relative to src/
//
// index.html boots whatever ?scene= names, so adding an entry here is what puts a scene in the dropdown.
// Scene 1's modules sit directly in src/, from when it was the only scene; a second scene gets its own
// folder under src/ and points `entry` at it.
export const SCENES = [
  {
    id: 'japan',
    title: 'Kyoto stepped street at sunset',
    entry: './main.js',
  },
];

// What a bare URL loads, and what an unknown ?scene= falls back to.
export const DEFAULT_SCENE = SCENES[0];

export function findScene(id) {
  return SCENES.find((scene) => scene.id === id) ?? null;
}

// The scene the current URL asks for.
export function requestedScene(search = window.location.search) {
  return findScene(new URLSearchParams(search).get('scene')) ?? DEFAULT_SCENE;
}
