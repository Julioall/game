import * as T from 'three';
import { loadTerrainAtlas, terrainTextureGLSL } from './terrain-textures.js';

export const makeClock = () => ({ value: 0 });

export function groundcoverMaterial(clock) {
  const texture = new T.TextureLoader().load(new URL('./assets/megakit-plants.png', import.meta.url).href);
  texture.colorSpace = T.SRGBColorSpace;
  texture.magFilter = T.NearestFilter;
  const material = objectMaterial(clock, true);
  material.map = texture;
  material.alphaTest = .45;
  material.side = T.DoubleSide;
  material.flatShading = true;
  const compile = material.onBeforeCompile;
  material.onBeforeCompile = shader => {
    compile(shader);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      // Broad color steps replace fine gradients on the small leaf cards.
      float leafLight = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722));
      if (naturalSurface > 5.5)
        diffuseColor.rgb = mix(diffuseColor.rgb, leafLight * vec3(.92, 1., .72), .25);
      // Quantize brightness rather than RGB channels, which made dark shrubs neon green.
      diffuseColor.rgb *= max(.03, floor(leafLight * 10. + .5) / 10.) / max(.001, leafLight);
    `);
  };
  material.customProgramCacheKey = () => 'groundcover-faceted-v1';
  material.addEventListener('dispose', () => texture.dispose());
  return material;
}

const noiseGLSL = `
float hashCell(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * .1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
// Ordered threshold matrix from the Pixel Plays renderer, expressed for GLSL.
float dither4(vec2 p) {
  const float ranks[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  ivec2 i = ivec2(mod(p, 4.));
  return (ranks[i.y * 4 + i.x] + .5) / 16.;
}
`;

export function terrainMaterial() {
  const material = new T.MeshLambertMaterial({ vertexColors: true });
  const atlas = loadTerrainAtlas();
  material.onBeforeCompile = s => {
    s.uniforms.terrainAtlas = { value: atlas };
    s.vertexShader = 'attribute vec4 terrainBlendA; attribute vec4 terrainBlendB; varying vec4 terrainWeightsA; varying vec4 terrainWeightsB; varying vec3 groundPos;\n' + s.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n groundPos = position; terrainWeightsA = terrainBlendA; terrainWeightsB = terrainBlendB;');
    s.fragmentShader = 'varying vec3 groundPos;\n' + terrainTextureGLSL + noiseGLSL + s.fragmentShader
      .replace('#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>')
      .replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
        'vec3 outgoingLight = diffuseColor.rgb * mix(vec3(.49, .54, .62), vec3(1.), getShadowMask());')
      .replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 terrainUV = groundPos.xz / 8.;
      vec3 texel = vec3(0.);
      float average = 0.;
      // Only the one or two layers present on a triangle need sampling.
      for (int layer = 0; layer < 8; layer++) {
        float weight = layer < 4 ? terrainWeightsA[layer] : terrainWeightsB[layer - 4];
        if (weight > .001) {
          vec3 sampled = terrainSample(float(layer), terrainUV);
          texel += sampled * weight;
          average += dot(sampled, vec3(.2126, .7152, .0722)) * weight;
        }
      }
      // Keep biome palette and lighting while exposing the supplied surface detail.
      float footprint = max(length(dFdx(terrainUV)), length(dFdy(terrainUV))) * 256.;
      float detailStrength = 1. - smoothstep(2., 8., footprint);
      vec3 hue = texel / max(.015, average);
      float reliefTone = clamp(average / .24, .55, 1.65);
      diffuseColor.rgb *= mix(vec3(1.), mix(vec3(1.), hue, .32) * reliefTone, detailStrength * .8);
      vec2 cell = floor(groundPos.xz * 5.);
      float grain = hashCell(cell) - .5;
      float cluster = hashCell(floor(groundPos.xz * 1.6)) - .5;
      float shade = 1. + grain * .045 + cluster * .035 + (dither4(gl_FragCoord.xy) - .5) * .04;
      diffuseColor.rgb *= shade;
      diffuseColor.rgb += vec3(.031, .024, .012) * step(.982, hashCell(cell + 113.));
    `);
  };
  material.customProgramCacheKey = () => 'terrain-textures-v1';
  material.addEventListener('dispose', () => atlas.dispose());
  return material;
}

export function objectMaterial(clock, wind = false) {
  const material = new T.MeshLambertMaterial({ vertexColors: true });
  // Procedural vegetation has no surface tags and keeps its original finish.
  material.defaultAttributeValues = { natureSurface: [0] };
  material.onBeforeCompile = s => {
    s.vertexShader = 'attribute float natureSurface; varying float naturalSurface; varying vec3 naturalPos;\n' +
      s.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      naturalPos = position;
      naturalSurface = natureSurface;
    `);
    s.fragmentShader = 'varying float naturalSurface; varying vec3 naturalPos;\n' + noiseGLSL +
      s.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      if (naturalSurface > .5) {
        // Object-space pattern stays anchored during camera motion and wind.
        vec2 uv = naturalPos.xz + naturalPos.y * vec2(.37, .61);
        float tone = 1.;
        if (naturalSurface < 1.5) {
          vec2 patches = uv * 3.2;
          float visible = 1. - smoothstep(.5, 1.3, max(fwidth(patches.x), fwidth(patches.y)));
          float clusters = hashCell(floor(patches));
          float leaves = hashCell(floor(uv * 9.));
          float fine = 1. - smoothstep(.4, 1.1, max(fwidth(uv.x * 9.), fwidth(uv.y * 9.)));
          tone += (clusters - .5) * .26 * visible + (leaves - .5) * .13 * fine;
          tone *= mix(.88, 1., smoothstep(.7, 2.8, naturalPos.y));
        } else if (naturalSurface < 2.5) {
          vec2 bark = vec2((naturalPos.x + naturalPos.z) * 14., naturalPos.y * 2.5);
          float visible = 1. - smoothstep(.4, 1.2, max(fwidth(bark.x), fwidth(bark.y)));
          float stripe = hashCell(vec2(floor(bark.x), floor(bark.y * .3)));
          tone += ((stripe - .5) * .36 - .12 * step(.84, fract(bark.x))) * visible;
        } else if (naturalSurface < 3.5) {
          vec2 mineral = uv * 7.;
          float visible = 1. - smoothstep(.4, 1.2, max(fwidth(mineral.x), fwidth(mineral.y)));
          tone += (hashCell(floor(mineral)) - .5) * .26 * visible;
          tone += (hashCell(floor(uv * 2.)) - .5) * .12;
        } else if (naturalSurface < 4.5) {
          vec2 marks = vec2((naturalPos.x + naturalPos.z) * 8., naturalPos.y * 13.);
          float visible = 1. - smoothstep(.4, 1.2, max(fwidth(marks.x), fwidth(marks.y)));
          tone -= step(.86, hashCell(floor(marks))) * .25 * visible;
        } else {
          tone += (hashCell(floor(uv * 3.)) - .5) * .06;
        }
        diffuseColor.rgb *= tone;
      }
    `);
    if (!wind) return;
    s.uniforms.kingdomTime = clock;
    s.vertexShader = 'uniform float kingdomTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        float phase = dot(instanceMatrix[3].xz, vec2(.128, .182));
        float sway = sin(kingdomTime * 1.46 + phase) + .37 * sin(kingdomTime * 2.6 + phase * 2.);
        transformed.xz += vec2(1., .47) * pow(max(position.y, 0.), 1.35) * sway * .009;
      #endif
    `);
  };
  material.customProgramCacheKey = () => 'nature-surface-v1-' + wind;
  return material;
}

export function buildingMaterial() {
  const material = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide });
  material.onBeforeCompile = s => {
    s.vertexShader = 'attribute vec3 craft; varying vec3 surfaceCraft;\n' +
      s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n surfaceCraft = craft;');
    s.fragmentShader = 'varying vec3 surfaceCraft;\n' + noiseGLSL +
      s.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        vec2 uv = surfaceCraft.xy;
        float type = surfaceCraft.z;
        float tone = 1.;
        if (type > .5 && type < 1.5) {
          vec2 q = uv * vec2(16., 4.4);
          float straw = hashCell(vec2(floor(q.x), floor(q.y * 2.)));
          float bundle = hashCell(vec2(floor(q.x * .24), floor(q.y)));
          float band = smoothstep(.72, 1., fract(q.y + bundle * .19));
          float visible = 1. - smoothstep(.72, 1.55, max(fwidth(q.x), fwidth(q.y)));
          float bundleVisible = 1. - smoothstep(.48, 1.15, max(fwidth(q.x * .24), fwidth(q.y)));
          tone += (straw - .44) * .25 * visible;
          tone += ((bundle - .48) * .30 - band * .20) * bundleVisible;
        } else if (type > 1.5 && type < 3.5) {
          bool tile = type < 2.5;
          vec2 q = uv * (tile ? vec2(4.3, 5.) : vec2(2.9, 4.1));
          float row = floor(q.y);
          q.x += mod(row, 2.) * .5;
          vec2 f = fract(q);
          float grout = max(1. - smoothstep(.025, .105, f.x), smoothstep(.80, .96, f.y));
          float visible = 1. - smoothstep(.48, 1.10, max(fwidth(q.x), fwidth(q.y)));
          tone += ((hashCell(floor(q)) - .43) * .27 - grout * (tile ? .29 : .18)) * visible;
        } else if (type > 3.5 && type < 4.5) {
          vec2 q = uv * vec2(7.5, 1.7);
          float visible = 1. - smoothstep(.48, 1.18, fwidth(q.x));
          tone += ((hashCell(vec2(floor(q.x), 4.)) - .5) * .27
            - (1. - smoothstep(.025, .13, fract(q.x))) * .26) * visible;
        } else if (type > 5.5) {
          // Staggered limestone courses, inspired by Stari Most's masonry().
          vec2 q = uv * vec2(1.85, 2.6);
          float row = floor(q.y);
          q.x += mod(row, 2.) * .5;
          vec2 f = fract(q);
          float joint = max(1. - smoothstep(.02, .10, f.x), 1. - smoothstep(.025, .115, f.y));
          float block = hashCell(floor(q));
          float band = block < .24 ? -.24 : block > .73 ? .16 : 0.;
          float visible = 1. - smoothstep(.58, 1.30, max(fwidth(q.x), fwidth(q.y)));
          float patina = hashCell(floor(uv * vec2(1.13, .68))) - .5;
          tone += (band - joint * .33 + (dither4(gl_FragCoord.xy) - .5) * .10) * visible + patina * .17;
        } else if (type > 4.5) {
          tone += (hashCell(floor(uv * 7.)) - .5) * .18 + (dither4(gl_FragCoord.xy) - .5) * .06;
        }
        diffuseColor.rgb *= tone;
      `);
  };
  return material;
}

export const shadowMaterial = () => new T.ShaderMaterial({
  transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  vertexShader: `
    varying vec2 q;
    void main() {
      q = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
    }`,
  fragmentShader: `
    varying vec2 q;
    void main() {
      float a = 1. - smoothstep(.24, 1., length(q));
      gl_FragColor = vec4(.085, .088, .109, a * .29);
    }`
});
