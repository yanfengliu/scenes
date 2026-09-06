// The page's entry point. index.html loads this rather than a scene directly: it resolves which scene
// the URL names, puts the picker on the page, and imports that scene's own entry module. Every scene is
// reached the same way, so the picker only ever has to change ?scene=.
import { requestedScene } from './scenes.js';
import { mountPicker } from './picker.js';

const scene = requestedScene();
document.title = scene.title;
mountPicker(scene);
// A failure in here rejects this module's top-level await, which index.html's unhandledrejection handler
// turns into the message on screen and the "scene state is error" the gates fail on.
await import(scene.entry);
