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

export function buildComposer(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    colorSpace: THREE.LinearSRGBColorSpace,
    samples: 4,
  });
  const composer = new EffectComposer(renderer, target);
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
