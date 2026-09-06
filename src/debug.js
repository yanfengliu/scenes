// A debug harness for faults that only appear in a real browser window, under real interaction.
//
// It exists because a user photographed a window in which the scene rendered correctly across the top
// and down the left while a hard-edged rectangle of flat #1a1c24 filled the rest, and none of the
// headless harnesses could reproduce it. Screenshots cannot tell a DARK RENDER from an UNPAINTED REGION,
// and the two are unrelated faults; a scripted resize is not a dragged window; and a tool that positions
// the camera itself never runs the controls or the per-frame clamp. So this runs inside the page, in the
// window where the fault actually happens, and records the state at the moment it happens.
//
// Turn it on with ?debug=1, or press D. It costs a readPixels of a small sample grid a few times a
// second, so it is opt-in and never on for an ordinary visitor.
//
// What it does:
//   - Shows the live size state that matters: window, device pixel ratio, canvas attribute size versus
//     its CSS box, the drawing buffer, the renderer's viewport, the composer's targets and samples. A
//     disagreement between any of these is the shape of this whole class of fault.
//   - Samples the framebuffer on a grid a few times a second and flags any point that is exactly the
//     page background, which is canvas nobody drew into.
//   - On the first such frame it captures a full record: every size above, the painted bounding box, the
//     camera, and the last resize events with their timings. `window.__debugDump()` returns the history
//     as JSON, and the overlay turns red so a person watching knows to grab it.
//   - Logs every resize event with the sizes before and after, because a fault that appears during a
//     drag needs the sequence, not the final state.
const BG = [0x1a, 0x1c, 0x24]; // index.html's page background: unpainted canvas reads exactly this
const SAMPLE = 7; // a SAMPLE x SAMPLE grid of probe points
const DARK_LUMA = 24; // out of 255. A back-lit sunset has deep shadow but very little true black.
// How many of the grid points may read near black before it counts as a fault. The photo view itself has
// one or two genuinely dark points under the eaves, so a single point is not news; a quarter of the grid
// going dark is the rectangle a user photographed.
const DARK_POINT_LIMIT = 8;
const PERIOD_MS = 400;
const HISTORY = 40;

export function mountDebug(api) {
  const { renderer, composer, camera, THREE } = api;
  const canvas = renderer.domElement;
  const gl = renderer.getContext();
  const events = [];
  const faults = [];
  let on = new URLSearchParams(location.search).get('debug') === '1';

  const el = document.createElement('div');
  el.id = 'debug-overlay';
  el.style.cssText = [
    'position:fixed', 'left:12px', 'top:12px', 'z-index:10', 'pointer-events:none',
    'font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace', 'color:#e8e3da',
    'background:rgba(0,0,0,0.72)', 'border:1px solid rgba(255,255,255,0.3)', 'border-radius:6px',
    'padding:8px 10px', 'white-space:pre', 'max-width:60vw',
  ].join(';');
  el.hidden = !on;
  document.body.append(el);

  const sizes = () => {
    const vp = new THREE.Vector4();
    renderer.getViewport(vp);
    const db = renderer.getDrawingBufferSize(new THREE.Vector2());
    const sz = renderer.getSize(new THREE.Vector2());
    return {
      window: [innerWidth, innerHeight],
      dpr: devicePixelRatio,
      rendererPixelRatio: renderer.getPixelRatio(),
      canvasAttr: [canvas.width, canvas.height],
      canvasCSS: [canvas.clientWidth, canvas.clientHeight],
      drawingBuffer: [db.x, db.y],
      rendererSize: [sz.x, sz.y],
      viewport: vp.toArray(),
      composer: [composer._width, composer._height],
      target: [composer.renderTarget1.width, composer.renderTarget1.height],
      samples: composer.renderTarget1.samples,
    };
  };

  // Probe a grid of single pixels. Cheap enough to run a few times a second, and it answers the only
  // question that matters here: is any part of the canvas still the page background?
  const probe = () => {
    const w = canvas.width, h = canvas.height;
    if (!w || !h) return { bgPoints: [], darkPoints: [], sampled: 0 };
    const px = new Uint8Array(4);
    const bgPoints = [];   // exactly the page background: canvas nobody drew into
    const darkPoints = []; // near black of ANY shade: a region that rendered as nothing
    for (let iy = 0; iy < SAMPLE; iy++) {
      for (let ix = 0; ix < SAMPLE; ix++) {
        const x = Math.min(w - 1, Math.round(((ix + 0.5) * w) / SAMPLE));
        const yUp = Math.min(h - 1, Math.round(((iy + 0.5) * h) / SAMPLE));
        gl.readPixels(x, yUp, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const at = { u: +(x / w).toFixed(3), v: +(1 - yUp / h).toFixed(3), rgb: [px[0], px[1], px[2]] };
        if (px[0] === BG[0] && px[1] === BG[1] && px[2] === BG[2]) bgPoints.push(at);
        // The first version of this only matched the page background exactly, so a dark rectangle of any
        // other shade — a black composite, a surface rendered unlit — kept it silent while a person was
        // looking straight at the fault. Luminance catches the whole class.
        else if (0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2] < DARK_LUMA) darkPoints.push(at);
      }
    }
    return { bgPoints, darkPoints, sampled: SAMPLE * SAMPLE };
  };

  // The full picture, only when something is already wrong: the exact painted rectangle.
  const paintedBox = () => {
    const w = canvas.width, h = canvas.height;
    const b = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b);
    let minX = w, minY = h, maxX = -1, maxY = -1, bg = 0;
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      if (b[o] === BG[0] && b[o + 1] === BG[1] && b[o + 2] === BG[2]) { bg++; continue; }
      const x = i % w, y = h - 1 - ((i / w) | 0);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return { box: maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }, bgPct: +((100 * bg) / (w * h)).toFixed(2) };
  };

  // The canvas is not the only thing that can put a dark rectangle on screen. An overlay that is still
  // up, or up at the wrong size, looks exactly like unpainted canvas in a screenshot while the canvas
  // underneath is perfect. So report anything covering a real share of the viewport with an opaque
  // background: the loading panel, the HUD, the debug overlay itself, or something unexpected.
  const covers = () => {
    const out = [];
    const vw = innerWidth * innerHeight;
    for (const node of document.body.querySelectorAll('*')) {
      if (node === el || !(node instanceof HTMLElement)) continue;
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const opacity = Number(style.opacity);
      const bg = style.backgroundColor;
      const transparent = bg === 'transparent' || /rgba\(.*,\s*0\)$/.test(bg);
      const r = node.getBoundingClientRect();
      const area = Math.max(0, r.width) * Math.max(0, r.height);
      if (area < vw * 0.05) continue;
      if (transparent && opacity > 0.01) continue;
      out.push({
        what: node.id ? `#${node.id}` : node.tagName.toLowerCase(),
        rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        background: bg, opacity, hidden: node.hasAttribute('hidden'),
        coversPct: +((100 * area) / vw).toFixed(1),
      });
    }
    return out;
  };

  const record = (what, extra) => {
    events.push({ t: +performance.now().toFixed(0), what, ...sizes(), ...extra });
    while (events.length > HISTORY) events.shift();
  };

  addEventListener('resize', () => record('resize event'), { passive: true });
  matchMedia(`(resolution: ${devicePixelRatio}dppx)`).addEventListener?.('change', () => record('pixel ratio change'));
  record('mounted');

  let last = 0;
  let faulted = false;
  function tick(now) {
    if (on && now - last > PERIOD_MS) {
      last = now;
      const { bgPoints, darkPoints, sampled } = probe();
      const s = sizes();
      const p = camera.position;
      const wrong = bgPoints.length > 0 || darkPoints.length >= DARK_POINT_LIMIT;
      if (wrong && !faulted) {
        faulted = true;
        const full = paintedBox();
        const fault = {
          t: +now.toFixed(0),
          note: bgPoints.length
            ? 'part of the canvas is exactly the page background: nothing drew there'
            : `${darkPoints.length} of ${sampled} probe points are near black: a large region rendered as nothing`,
          bgPoints, darkPoints, ...s, ...full, overlays: covers(),
          camera: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)],
          recentEvents: events.slice(-8),
        };
        faults.push(fault);
        // eslint-disable-next-line no-console
        console.error('DEBUG: unpainted canvas detected', fault);
        el.style.borderColor = '#ff6b6b';
        el.style.background = 'rgba(90,0,0,0.8)';
      }
      const mismatch = s.canvasAttr[0] !== Math.round(s.canvasCSS[0] * s.rendererPixelRatio)
        || s.canvasAttr[1] !== Math.round(s.canvasCSS[1] * s.rendererPixelRatio);
      el.textContent = [
        `window        ${s.window.join(' x ')}   dpr ${s.dpr}  (renderer ${s.rendererPixelRatio})`,
        `canvas attr   ${s.canvasAttr.join(' x ')}`,
        `canvas css    ${s.canvasCSS.join(' x ')}${mismatch ? '   <-- DISAGREES with attr/ratio' : ''}`,
        `draw buffer   ${s.drawingBuffer.join(' x ')}`,
        `viewport      ${s.viewport.join(', ')}`,
        `composer      ${s.composer.join(' x ')}   samples ${s.samples}`,
        `bg probes     ${bgPoints.length} of ${sampled}${bgPoints.length ? '   <-- UNPAINTED' : ''}`,
        `dark probes   ${darkPoints.length} of ${sampled}${darkPoints.length >= DARK_POINT_LIMIT ? '   <-- LARGE DARK REGION' : ''}`,
        `overlays      ${covers().map((c) => `${c.what} ${c.coversPct}%`).join(', ') || 'none'}`,
        `faults        ${faults.length}${faults.length ? '   window.__debugDump()' : ''}`,
      ].join('\n');
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  addEventListener('keydown', (e) => {
    if (e.target instanceof Element && e.target.closest('select, input, textarea')) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'd' || e.key === 'D') { on = !on; el.hidden = !on; }
  });

  window.__debugDump = () => JSON.stringify({ sizes: sizes(), overlays: covers(), faults, events }, null, 2);
  window.__debugProbe = () => ({ ...sizes(), ...probe(), ...paintedBox(), overlays: covers() });
  window.__debugReset = () => { faulted = false; faults.length = 0; el.style.borderColor = 'rgba(255,255,255,0.3)'; el.style.background = 'rgba(0,0,0,0.72)'; };
  return { dump: window.__debugDump, probe: window.__debugProbe };
}
