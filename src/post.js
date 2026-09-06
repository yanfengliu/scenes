// The post chain: render into a half-float target, bloom the glare and the brightest blossoms, grade and
// vignette, then tone map once at the end.
//
// The order matters. Materials rendering into a target are not tone mapped by three (it applies the tone
// curve only when drawing to the canvas), so the whole chain runs on linear radiance and `OutputPass`
// applies exposure, the ACES curve and the sRGB conversion once, at the end. That is what makes the
// inverse in src/tonemap.js exact: every color in the scene is the radiance that displays as its
// sampled photo mean.
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

// Resize the composer's targets after the renderer's own size or pixel ratio has changed.
export function resizeComposer(composer, renderer) {
  const size = composerSize(renderer);
  // EffectComposer multiplies whatever it is given by its own pixel ratio, which it captured when it was
  // built. The size above is already in device pixels, so that multiplier stays at 1.
  composer.setPixelRatio(1);
  composer.setSize(size.x, size.y);
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
  return { composer, bloom, grade };
}
