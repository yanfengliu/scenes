// The scene picker: the dropdown in the page's corner, filled from the registry in src/scenes.js.
// Choosing a scene sets ?scene= and lets the page load again rather than swapping scenes in place, so no
// scene has to know how to tear itself down and each one starts on a fresh WebGL context.
import { SCENES, DEFAULT_SCENE } from './scenes.js';

export function mountPicker(current, host = document.getElementById('hud')) {
  if (!host) return null;
  const select = document.createElement('select');
  select.id = 'scene-picker';
  select.title = 'Choose a scene';
  select.setAttribute('aria-label', 'Scene');
  for (const scene of SCENES) {
    const option = document.createElement('option');
    option.value = scene.id;
    option.textContent = scene.title;
    option.selected = scene.id === current.id;
    select.append(option);
  }
  select.addEventListener('change', () => {
    const url = new URL(window.location.href);
    // A bare URL already means the default scene, so it does not carry a query of its own.
    if (select.value === DEFAULT_SCENE.id) url.searchParams.delete('scene');
    else url.searchParams.set('scene', select.value);
    window.location.assign(url);
  });
  // Ahead of the reset button, which stays in the corner where it has always been.
  host.prepend(select);
  return select;
}
