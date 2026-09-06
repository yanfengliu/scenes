// The post chain: render into a half-float target, bloom the glare and the brightest blossoms, grade and
// vignette, then tone map once at the end.
//
// The order matters. Materials rendering into a target are not tone mapped by three (it applies the tone
// curve only when drawing to the canvas), so the whole chain runs on linear radiance and `OutputPass`
// applies exposure, the ACES curve and the sRGB conversion once, at the end. That is what makes the
// inverse in src/tonemap.js exact: every color in the scene is the radiance that displays as its
// sampled photo mean.
//
// The chain's output is proved rather than assumed on every size change; see "Proving the chain" below.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Bloom: `threshold` is in linear radiance, so only what is well brighter than a white surface blooms
// (the sun's disc and the glare wrapping the ridge). Every one of these numbers was swept against the
// per-cell ranking: at the first settings (strength 0.24, threshold 1.05, radius 0.6) the glare washed
// the hill beside the sun from the photo's #625e55 to #d7ccbe and cost 0.013 of cell distance on its
// own. Bloom is the one pass here that can quietly ruin the frame, so it is kept tight and weak.
export const POST = {
  // The scene is rendered larger than the drawing buffer and resolved down at the end. This, with the
  // multisampling below, is the fix for the shimmer a user reported when moving the camera: the scene is
  // full of geometry thinner than a pixel (strand tubes about 0.35 px wide at the cherry's distance, tile
  // ridges, lattice slats, and the edges of 30,000 blossom cards). Multisampling catches most of it, but
  // a triangle that lands between the samples covers one or none, so a fraction-of-a-pixel camera move
  // switches whole pixels on and off; supersampling gives those edges more samples still.
  //
  // 1.2 is measured, not chosen: 1.2, 1.35, 1.5, 1.75 and 2.0 all land within noise of each other on the
  // nudge metric, and 1.0 is twice as unstable, so the gain is in resolving above the drawing buffer at
  // all rather than in how far above. 1.2 costs 1.44x the fragments where 1.5 costs 2.25x.
  //
  // These two are what the chain *asks* for. What it gets is the first rung of the ladder below whose
  // output survives on this driver at this size, re-decided from the top on every size change.
  renderScale: 1.2,
  // A ceiling on renderScale times the device pixel ratio, so a dense display does not pay for both. A
  // phone at ratio 2 still gets the supersampling: this only stops the product running away.
  maxDeviceScale: 2.5,
  // Requested multisamples. The driver clamps to its own maximum (SwiftShader gives 4, a desktop GPU 8),
  // and MSAA carries more of this than the supersampling does: turning it off at renderScale 1.2 more
  // than doubles the drastic changes.
  samples: 8,
  bloomStrength: 0.1,
  bloomRadius: 0.35,
  bloomThreshold: 1.6,
  vignette: 0.22,
  grade: { gain: [1.0, 1.0, 1.0], lift: [0.0, 0.0, 0.0] },
};

// A grade and vignette in linear radiance: a per-channel gain and lift, then a soft corner falloff.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uGain: { value: new THREE.Vector3(1, 1, 1) },
    uLift: { value: new THREE.Vector3(0, 0, 0) },
    uVignette: { value: 0.22 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec3 uGain, uLift;
    uniform float uVignette;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 col = texel.rgb * uGain + uLift;
      vec2 d = vUv - 0.5;
      float r = dot(d, d) * 2.0;
      col *= 1.0 - uVignette * r * r;
      gl_FragColor = vec4(col, texel.a);
    }`,
};

// How much larger than the drawing buffer to render, with the product against the device pixel ratio
// capped. Never below 1: resolving down is the point, resolving up is not.
export function renderScale(renderer) {
  const ratio = Math.max(1, renderer.getPixelRatio());
  return Math.max(1, Math.min(POST.renderScale, POST.maxDeviceScale / ratio));
}

// The composer's target size in real device pixels. It has to come from the drawing buffer, not from
// renderer.getSize(), which is in CSS pixels: at a device pixel ratio of 2 the two differ by a factor of
// two, and sizing from the CSS number rendered the scene at a quarter of the canvas and scaled it up.
export function composerSize(renderer) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  return size.multiplyScalar(renderScale(renderer)).round();
}

// ---------------------------------------------------------------------------------------------------
// Proving the chain
//
// A user reported "giant rectangular blackouts on screen" that stayed after the camera stopped moving
// and cleared when the reset button was clicked. The camera was incidental. The frame is destroyed by
// the *size* of the composer's targets, and a reset only ever appeared to help because whatever else
// changed alongside it changed the size.
//
// What is actually happening, measured on an ANGLE/D3D11 NVIDIA driver at a 1920x1080 drawing buffer
// with the camera stationary. The frame is not black, it is **NaN**: read back as half floats, both of
// the composer's ping-pong targets are 100% NaN, and NaN reaches the canvas as black. Sweeping the
// composer's size from 1.00 to 1.60 times the drawing buffer in hundredths, 14 of the 61 sizes produce
// it at 8 samples and 10 of 61 at 4 samples, and the two sets only partly overlap. It is deterministic:
// the same size gives the same figure to two decimal places on repeat, arriving from a larger or a
// smaller previous size. `gl.getError()` is 0 throughout, the context is never lost and the framebuffer
// reports complete, so nothing in the API admits that anything is wrong.
//
// Three things were held against it, and they say what the fix has to be:
//   - Turning the bloom pass off makes every one of those sizes correct (1.96% dark, the normal figure).
//     Setting its strength to 0, its threshold to 1e6 or its radius to 0 does *not*: NaN times zero is
//     still NaN, so the bloom is the carrier, not the source.
//   - Setting the composer's targets to 0 samples makes every one of those sizes correct, at every
//     size tried. Multisampling is the ingredient.
//   - The scene itself is innocent. Rendered into a fresh target of the same size, multisampled or not,
//     it reads back with no NaN at all and a peak radiance of 1.65.
// And one thing that did *not* work, which is why the fix looks like it does: giving the scene render
// its own multisampled target and leaving the composer's own buffers unmultisampled still produced the
// NaN, even though that scene target itself read back clean. The corruption is not in one buffer that
// can be routed around; a multisampled half-float target of a bad size poisons the frame that is drawn
// beside it.
//
// So there is no rule about sizes to be had, and hardcoding the known-bad ones would only wait for the
// next window size to find another. Aligning the dimensions is worse than useless: of the sizes measured,
// 2304x1296 is the only one whose width and height are both multiples of 16, so an alignment rule would
// steer *toward* the failures.
//
// What is left is to look at the frame. On every size change the chain renders one real frame and both
// of the composer's buffers are sampled on a 32x32 grid through a shader that flags anything that is not
// a finite number, with the frame's own brightness measured against the same scene rendered at 64x64
// with no post chain at all. If the frame is not finite, or the chain has thrown away almost all of the
// light the plain renderer sees, this configuration does not work here and the next rung of the ladder
// is tried. Nothing below knows any size, any driver or any vendor: it renders, it looks, and it steps
// down only as far as it has to -- and it starts again from the top at the next size, so a machine that
// works is never held to a lesser chain.
//
// A synthetic stand-in was tried first and rejected on evidence: painting a bright gradient through the
// same targets, and even through the whole chain, comes back perfectly clean at every one of the bad
// sizes. Only the real scene triggers it. That is why the check costs a frame.
//
// What it costs in practice, dragging a window across 56 widths at a device pixel ratio of 1.5 on the
// driver above: no frame is black, the worst is 1.98% near black which is the normal figure, 37 of the
// 56 sizes keep all eight multisamples and 19 fall to four. Nothing in the sweep lost multisampling
// altogether or lost the supersample, so on this machine the whole of the shimmer fix survives.
// ---------------------------------------------------------------------------------------------------

export const PROBE = {
  // 1024 taps spread over the whole buffer, so a failure over any sizeable region is caught and not only
  // one that takes the entire frame: the worst of the observed sizes leaves 16% of the frame standing.
  grid: 32,
  // The reference render: the same scene, same camera, no post chain, small enough to be free.
  referenceSize: 64,
  // Any non-finite tap at all is a broken frame. A correct render has none, ever.
  maxBadTaps: 0,
  // And the chain may not throw away most of the light the plain renderer sees. This is a ratio, so it
  // holds wherever the camera happens to be pointing when a window is resized.
  minLightKept: 0.3,
};

let rig = null;
function probeRig() {
  if (rig) return rig;
  const geometry = new THREE.PlaneGeometry(2, 2);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const detector = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: { tDiffuse: { value: null } },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    // Red flags a value that is not a finite number, green carries the tap's linear luminance. A NaN
    // fails both of "greater or equal to zero" and "less or equal to zero", which no real number does,
    // and anything past the half-float maximum is an infinity.
    fragmentShader: `
      uniform sampler2D tDiffuse;
      varying vec2 vUv;
      void main() {
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        bool finite = (c.r >= 0.0 || c.r <= 0.0) && (c.g >= 0.0 || c.g <= 0.0) && (c.b >= 0.0 || c.b <= 0.0);
        finite = finite && max(max(abs(c.r), abs(c.g)), abs(c.b)) <= 65504.0;
        float l = clamp(dot(max(c, vec3(0.0)), vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
        gl_FragColor = vec4(finite ? 0.0 : 1.0, l, 0.0, 1.0);
      }`,
  });
  rig = {
    camera,
    detector,
    detectorScene: new THREE.Scene().add(new THREE.Mesh(geometry, detector)),
    // Eight bits is all a verdict needs, and every driver can read this format back.
    readback: new THREE.WebGLRenderTarget(PROBE.grid, PROBE.grid, { depthBuffer: false, stencilBuffer: false }),
    pixels: new Uint8Array(PROBE.grid * PROBE.grid * 4),
    reference: new THREE.WebGLRenderTarget(PROBE.referenceSize, PROBE.referenceSize, { depthBuffer: true, stencilBuffer: false }),
    referencePixels: new Uint8Array(PROBE.referenceSize * PROBE.referenceSize * 4),
  };
  return rig;
}

// Sample one of the composer's buffers on a grid and report what came back.
function inspect(renderer, target) {
  const r = probeRig();
  const wasTarget = renderer.getRenderTarget();
  r.detector.uniforms.tDiffuse.value = target.texture;
  renderer.setRenderTarget(r.readback);
  renderer.render(r.detectorScene, r.camera);
  renderer.setRenderTarget(wasTarget);
  renderer.readRenderTargetPixels(r.readback, 0, 0, PROBE.grid, PROBE.grid, r.pixels);
  const n = PROBE.grid * PROBE.grid;
  let bad = 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    if (r.pixels[i * 4] > 127) bad++;
    sum += r.pixels[i * 4 + 1];
  }
  return { badTaps: (100 * bad) / n, meanLuma: sum / n };
}

// The same scene and camera with no post chain at all, small enough that nobody pays for it, as the
// reference the chain's own brightness is judged against.
function reference(renderer, scene, camera) {
  const r = probeRig();
  const wasTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(r.reference);
  renderer.clear();
  renderer.render(scene, camera);
  renderer.setRenderTarget(wasTarget);
  const size = PROBE.referenceSize;
  renderer.readRenderTargetPixels(r.reference, 0, 0, size, size, r.referencePixels);
  let sum = 0;
  const n = size * size;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    sum += 0.2126 * r.referencePixels[o] + 0.7152 * r.referencePixels[o + 1] + 0.0722 * r.referencePixels[o + 2];
  }
  return sum / n;
}

// Render one real frame through the chain and say whether the frame is there.
export function verifyComposer(renderer, composer, scene, camera) {
  // Both ping-pong buffers are written every frame -- the first holds the graded frame and the second
  // the scene with the bloom on it -- so one frame is enough to have something to look at in each.
  composer.render();
  const a = inspect(renderer, composer.renderTarget1);
  const b = inspect(renderer, composer.renderTarget2);
  const badTaps = Math.max(a.badTaps, b.badTaps);
  const meanLuma = Math.max(a.meanLuma, b.meanLuma);
  const referenceLuma = reference(renderer, scene, camera);
  const lightKept = referenceLuma > 1 ? meanLuma / referenceLuma : 1;
  const why = [];
  if (badTaps > PROBE.maxBadTaps) why.push(`${badTaps.toFixed(1)}% of the frame is not a finite number`);
  if (lightKept < PROBE.minLightKept) {
    why.push(`the chain kept only ${(100 * lightKept).toFixed(1)}% of the light the plain renderer sees (${meanLuma.toFixed(1)} against ${referenceLuma.toFixed(1)})`);
  }
  return { ok: why.length === 0, why, badTaps: +badTaps.toFixed(1), meanLuma: +meanLuma.toFixed(1), referenceLuma: +referenceLuma.toFixed(1), lightKept: +lightKept.toFixed(3) };
}

// The driver clamps the request to its own maximum, so clamp here too: otherwise the rungs that ask for
// 8 and for 4 are the same configuration on a renderer whose maximum is 4 (SwiftShader), and the ladder
// would try it twice and learn nothing.
function clampSamples(renderer, n) {
  return Math.max(0, Math.min(Math.round(n), renderer.capabilities.maxSamples ?? 0));
}

// The rungs, in the order they are tried, each named by what it gives up. The first is the chain as
// designed; every later one is reached only because the frame before it was measured and was not there.
function ladder(renderer, base) {
  const full = clampSamples(renderer, POST.samples);
  const half = clampSamples(renderer, Math.floor(POST.samples / 2));
  const rungs = [
    { scale: base, samples: full, cost: 'nothing: the chain as designed' },
    // Aimed at the ingredient that fails, and it is often enough: the bad sizes at 8 samples and at 4
    // are different sets, and the size that started all of this is clean at 4.
    { scale: base, samples: half, cost: 'half the multisamples, at the same size and the same supersample' },
    // A neighbouring size. A guess rather than a diagnosis, but a cheap one and it is measured like
    // every other rung: about three quarters of sizes are good, so it usually lands.
    { scale: base * 0.99, samples: full, cost: 'one percent of the supersample' },
    { scale: 1, samples: full, cost: 'the supersample, keeping every multisample' },
    // Measured clean at every size tried, and the reason the ladder can promise to terminate.
    { scale: base, samples: 0, cost: 'all multisampling, keeping the supersample' },
    { scale: 1, samples: 0, cost: 'both the multisampling and the supersample' },
  ];
  // Dedupe: the device-ratio cap can already have pushed `base` to 1, and a driver maximum of 4 makes
  // the first two rungs the same request.
  const seen = new Set();
  return rungs.filter((rung) => {
    const key = `${rung.scale.toFixed(4)}@${rung.samples}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function applyRung(composer, buffer, rung) {
  composer.setPixelRatio(1);
  composer.setSize(Math.round(buffer.x * rung.scale), Math.round(buffer.y * rung.scale));
  for (const target of [composer.renderTarget1, composer.renderTarget2]) {
    if (target.samples === rung.samples) continue;
    target.samples = rung.samples;
    // three allocates a target's buffers lazily and reuses them until it is disposed, so a changed
    // sample count only takes effect after this.
    target.dispose();
  }
}

let state = null;
let subject = null;
// What the chain settled on, for `window.__scene.describe()` and for the gates: the size and sample
// count in use, which rung produced them and why, and the numbers the verification measured.
export function postState() {
  return state;
}

// Walk the ladder at the renderer's current drawing buffer and stop at the first rung whose frame is
// actually there. Called on build and on every size change.
export function tuneComposer(renderer, composer) {
  const { scene, camera } = subject;
  const buffer = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rungs = ladder(renderer, renderScale(renderer));
  let chosen = null;
  for (let i = 0; i < rungs.length; i++) {
    applyRung(composer, buffer, rungs[i]);
    const verdict = verifyComposer(renderer, composer, scene, camera);
    chosen = {
      rung: i,
      fallback: i > 0,
      cost: rungs[i].cost,
      width: composer.renderTarget1.width,
      height: composer.renderTarget1.height,
      samples: composer.renderTarget1.samples,
      scale: +rungs[i].scale.toFixed(4),
      buffer: { width: buffer.x, height: buffer.y },
      verdict,
    };
    if (verdict.ok) break;
    // Never silent: a machine that has to step down says so, with the numbers, every time it decides.
    console.warn(
      `post: a ${chosen.width}x${chosen.height} target with ${chosen.samples} samples does not survive on this driver ` +
        `(${verdict.why.join('; ')}). Trying the next configuration, which gives up ${rungs[i + 1] ? rungs[i + 1].cost : 'nothing left to give up'}.`,
    );
  }
  if (!chosen.verdict.ok) {
    console.warn('post: no configuration in the ladder produced a frame; the scene may render black. This is a driver fault, not a scene fault.');
  } else if (chosen.fallback) {
    console.warn(
      `post: settled on a ${chosen.width}x${chosen.height} target with ${chosen.samples} samples for this window size, ` +
        `giving up ${chosen.cost}. The full chain is tried again from the top at the next size.`,
    );
  }
  state = chosen;
  return chosen;
}

// Resize the composer's targets after the renderer's own size or pixel ratio has changed, and decide the
// configuration again for the new size. The decision is per size and always starts from the top rung, so
// a driver that fails at one size is never held to a lesser chain at another.
export function resizeComposer(composer, renderer) {
  const buffer = renderer.getDrawingBufferSize(new THREE.Vector2());
  // A drag across the screen fires dozens of resize events at the same drawing buffer. Nothing about the
  // decision can have changed, and re-deciding would reallocate every target and re-render for nothing.
  if (state && state.buffer.width === buffer.x && state.buffer.height === buffer.y) return state;
  return tuneComposer(renderer, composer);
}

export function buildComposer(renderer, scene, camera) {
  const size = composerSize(renderer);
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    colorSpace: THREE.LinearSRGBColorSpace,
    samples: POST.samples,
  });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(1);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), POST.bloomStrength, POST.bloomRadius, POST.bloomThreshold);
  composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader);
  grade.uniforms.uGain.value.fromArray(POST.grade.gain);
  grade.uniforms.uLift.value.fromArray(POST.grade.lift);
  grade.uniforms.uVignette.value = POST.vignette;
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  // What the verification renders, here and at every later size change.
  subject = { scene, camera };
  // Nothing is shown through this chain before a frame of it has been looked at.
  const post = tuneComposer(renderer, composer);
  return { composer, bloom, grade, post };
}
