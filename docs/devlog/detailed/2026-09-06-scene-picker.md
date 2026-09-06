# 2026-09-06 — The scene picker

## What was built

The repository is meant to hold many scenes, and it had one page hard-wired to the first one. It now has a registry, a boot seam and a dropdown.

- `src/scenes.js`: the registry. One entry per scene — `id` (what `?scene=` names), `title` (what the picker and the tab show), `entry` (the module that builds it, resolved from `src/`). `DEFAULT_SCENE` is the first entry, and `requestedScene()` falls back to it when `?scene=` is missing or names nothing.
- `src/boot.js`: what `index.html` loads now, instead of `src/main.js`. It resolves the scene from the URL, sets `document.title`, mounts the picker and `await import`s the scene's entry module. A failure in that import rejects the module's top-level await, which the `unhandledrejection` handler already in `index.html` turns into the on-screen error and the gates' `scene state is "error"` — so the failure path is the one that was already there.
- `src/picker.js`: builds the `<select>` from the registry and inserts it ahead of the reset button. Choosing a scene sets `?scene=` and calls `location.assign`, so the page loads again rather than swapping scenes in place; the default scene drops the query rather than pinning it.
- `index.html`: the chrome moved into one `#hud` box, the title became `Scenes` (boot sets the scene's own), and the script tag points at `src/boot.js`.

Adding scene 2 is a folder under `src/`, an entry in `SCENES`, and nothing else. Scene 1's modules stay flat in `src/` because moving them would rewrite every tool import and every path in the docs for no gain.

## The trap this leaves behind

The scored image is a screenshot of the page, so any chrome on the page is in it unless a gate hides it. `shot` and `animation` each carried their own copy of `#reset { display: none } #loading { display: none }`, which is exactly the kind of duplicate that goes stale the moment someone adds a control. Both now import `HIDE_UI_CSS` from `tools/lib/browser.js`, and it hides `#hud` wholesale.

So: **a control added outside `#hud` lands in the scored image.** The compare score would move and nobody would know why. Put chrome inside `#hud`.

Two smaller things the shape of the HUD depends on. It spans the window's width so a long scene name wraps rather than running off the side, which means it covers the bottom strip of the page — it is `pointer-events: none` with `auto` on its children, or it would swallow every drag that starts near the bottom edge. And `#scene-picker` sets `color-scheme: dark`, without which chromium opens the native option list as a white panel over a sunset.

## What it cost the scores

Nothing: 0.0811 and 0.4411, the same figures to four decimals, because the gate hides the picker and the scene it renders is unchanged.

## Checked by hand, since no gate can see it

Driven in a real browser at `npm run dev`: the picker lists the one scene and shows it selected; `?scene=does-not-exist` loads the default without an error; the change handler navigates to `?scene=<id>` and back to the bare URL for the default (proved by injecting a throwaway second option, since one scene can never fire a `change`); `document.elementFromPoint` on the bottom strip returns the canvas, not the HUD.

`R` with the dropdown focused no longer resets the camera, and neither does Ctrl+R — `src/main.js` returns early when the event target is inside a `select`, `input` or `textarea`, or when a modifier is down. Without that guard, typing in the picker to jump to a scene beginning with R also threw the view back to the photo.
