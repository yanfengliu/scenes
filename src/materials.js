// One factory for every material.
//
// Phases 1 to 3 were unlit: the colors in src/layout.js are means sampled from the photo, so they
// already contain the photo's light, and a MeshBasicMaterial showed them unchanged. Phase 4 lights the
// scene, which would count that light twice. The decision (see the phase 4 devlog) is to keep the
// sampled means as the target *displayed* color and derive each material's albedo from it: the albedo is
// the radiance that, after the rig's irradiance, exposure and the ACES curve, displays as the sampled
// mean again. So the photo view lands back where phase 3 left it, while the rig adds what a flat color
// cannot have: surfaces that turn toward or away from the sun, rim light through the blossoms, specular
// sheen on the tiles, shadows, and the normal and roughness maps that have been parked since phase 2.
//
// `MATERIALS.irradiance` is the irradiance a typical surface receives from the rig (measured, not
// guessed: see the devlog). A material whose orientation gives it more comes out brighter than the
// photo, less comes out darker; that difference is the lighting, and the per-cell ranking is what keeps
// it honest.
import * as THREE from 'three';
import { sceneRadiance } from './tonemap.js';

// `lit` selects the material class. It is not a whole unlit pipeline: the tone curve, the composer and
// the derived albedos stay on, so turning it off renders a scene lit only by the ambient term, not the
// phase 3 render. `irradiance` is the normalisation constant, swept against the per-cell ranking (the
// rig's shares sum to more than it, because no surface faces every light at once).
export const MATERIALS = {
  lit: true,
  exposure: 1.0,
  irradiance: 0.95,
};

const tmpColor = new THREE.Color();

// The albedo color for a material whose displayed mean should be `hex`.
export function albedoOf(hex, { irradiance = MATERIALS.irradiance } = {}) {
  const [r, g, b] = sceneRadiance(hex, { exposure: MATERIALS.exposure, irradiance });
  return tmpColor.setRGB(r, g, b, THREE.LinearSRGBColorSpace).clone();
}

// The scalar tint for a *textured* material whose texels already average to `hex`: the map carries the
// mean, so the material's color scales it to the radiance that displays as that mean. Exact at the mean,
// and close across a texture whose range is narrow (every albedo here is a variation around its mean).
export function albedoScaleOf(hex, { irradiance = MATERIALS.irradiance } = {}) {
  const target = sceneRadiance(hex, { exposure: MATERIALS.exposure, irradiance });
  // The map is decoded to linear from sRGB, so divide by the mean's own linear value.
  const mean = [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255].map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const ratio = (i) => (mean[i] > 1e-6 ? target[i] / mean[i] : 1);
  return tmpColor.setRGB(ratio(0), ratio(1), ratio(2), THREE.LinearSRGBColorSpace).clone();
}

// params: map, color (a photo-sampled sRGB hex), mean (the hex a textured material's map averages to),
// alphaTest, side, transparent, vertexColors, plus normalMap, roughnessMap, roughness and metalness for
// the lit variant, and `unlit` for the distant layers that the rig does not light.
export function makeMaterial(params = {}) {
  const { normalMap, roughnessMap, roughness, metalness, mean, unlit, irradiance, ...rest } = params;
  const clean = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  if (!MATERIALS.lit) return new THREE.MeshBasicMaterial(clean);
  if (unlit) {
    // Unlit but still tone mapped: give it the radiance that displays as its sampled color.
    if (clean.color !== undefined) clean.color = albedoOf(clean.color, { irradiance: 1 });
    else if (mean !== undefined) clean.color = albedoScaleOf(mean, { irradiance: 1 });
    return new THREE.MeshBasicMaterial(clean);
  }
  const lit = { ...clean };
  if (lit.color !== undefined) lit.color = albedoOf(lit.color, { irradiance });
  else if (mean !== undefined) lit.color = albedoScaleOf(mean, { irradiance });
  return new THREE.MeshStandardMaterial({
    ...lit,
    normalMap: normalMap ?? null,
    roughnessMap: roughnessMap ?? null,
    roughness: roughness ?? 0.9,
    metalness: metalness ?? 0,
  });
}

// A foliage card material: an alpha-tested, two-sided card texture whose color comes from the instance
// colors, so one texture serves every blossom or leaf tint. The instance colors are already radiances
// (vegetation.js builds them through albedoOf), so the material's own color stays white.
//
// `backlit` adds the term this scene lives on. The sun is behind the canopy, so a lit card facing the
// camera would be showing the card's *dark* side: petals do not work that way, they pass light. The term
// is the cheap standard translucency, how much the card faces away from the sun times how much the
// camera looks into it, times the card's own color. It costs no extra pass and no extra draw call, and
// it is what makes a blossom glow rather than sit there.
//
// `alphaToCoverage` turns the hard alphaTest cutoff into a multisampled one. Three's own
// `alphatest_fragment` chunk special-cases it: with both `USE_ALPHATEST` and `ALPHA_TO_COVERAGE` defined
// it replaces the discard with `diffuseColor.a = smoothstep(alphaTest, alphaTest + fwidth(alpha), alpha)`
// and only discards where that reaches exactly 0, then WebGLState enables `gl.SAMPLE_ALPHA_TO_COVERAGE`
// whenever `material.alphaToCoverage` is true. That GL state only does anything when the bound target is
// actually multisampled, which is why an earlier attempt (see docs/learning/defect-register.md) measured
// no effect: the composer's target had no MSAA samples at the time. It does now (`POST.samples` in
// src/post.js), so the same flag is live here: a card's silhouette edge dithers across the sample mask
// and resolves smooth instead of flipping whole pixels on and off as a triangle or texel boundary crosses
// a sample point.
export function foliageMaterial(map, { alphaTest = 0.5, side = THREE.DoubleSide, vertexColors = false, roughness = 0.85, backlit = 0 } = {}) {
  const mat = makeMaterial({ map, alphaTest, side, transparent: false, vertexColors, roughness, alphaToCoverage: true });
  if (backlit > 0 && MATERIALS.lit) applyBacklight(mat, backlit);
  return mat;
}

// The sun's direction and color for the translucency term, set once by the rig.
export const BACKLIGHT = { direction: new THREE.Vector3(0, 1, -1).normalize(), color: new THREE.Color(1, 1, 1) };

function applyBacklight(material, amount) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBacklitDir = { value: BACKLIGHT.direction };
    shader.uniforms.uBacklitColor = { value: BACKLIGHT.color };
    shader.uniforms.uBacklit = { value: amount };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', [
        '#include <common>',
        'uniform vec3 uBacklitDir;',
        'uniform vec3 uBacklitColor;',
        'uniform float uBacklit;',
      ].join('\n'))
      .replace('#include <opaque_fragment>', [
        '{',
        '  // vViewPosition runs from the fragment to the camera, so looking into the sun is a NEGATIVE',
        '  // dot with the sun direction: the first version of this term had the sign the other way and',
        '  // its main lobe never fired once.',
        '  vec3 viewDir = normalize(vViewPosition);',
        '  vec3 sunView = normalize((viewMatrix * vec4(uBacklitDir, 0.0)).xyz);',
        '  vec3 n = normalize(normal);',
        '  float through = max(0.0, -dot(n, sunView));',
        '  float intoSun = max(0.0, -dot(viewDir, sunView));',
        '  float rim = pow(1.0 - abs(dot(n, viewDir)), 2.0);',
        '  outgoingLight += diffuseColor.rgb * uBacklitColor * uBacklit * intoSun * (0.22 * through + 0.5 * rim);',
        '}',
        '#include <opaque_fragment>',
      ].join('\n'));
  };
  material.customProgramCacheKey = () => `backlit${amount}`;
  return material;
}
