import * as T from 'three';

export const makeClock = () => ({ value: 0 });

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
  material.onBeforeCompile = s => {
    s.vertexShader = 'varying vec3 groundPos;\n' + s.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\n groundPos = position;');
    s.fragmentShader = 'varying vec3 groundPos;\n' + noiseGLSL + s.fragmentShader
      .replace('#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>')
      .replace('vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;',
        'vec3 outgoingLight = diffuseColor.rgb * mix(vec3(.49, .54, .62), vec3(1.), getShadowMask());')
      .replace('#include <color_fragment>', `
      #include <color_fragment>
      vec2 cell = floor(groundPos.xz * 5.);
      float grain = hashCell(cell) - .5;
      float cluster = hashCell(floor(groundPos.xz * 1.6)) - .5;
      float shade = 1. + grain * .15 + cluster * .12 + (dither4(gl_FragCoord.xy) - .5) * .07;
      diffuseColor.rgb *= shade;
      diffuseColor.rgb += vec3(.031, .024, .012) * step(.982, hashCell(cell + 113.));
    `);
  };
  return material;
}

export function objectMaterial(clock, wind = false) {
  const material = new T.MeshLambertMaterial({ vertexColors: true });
  if (!wind) return material;
  material.onBeforeCompile = s => {
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

export function waterMaterial(clock) {
  return new T.ShaderMaterial({
    uniforms: { kingdomTime: clock, ...T.UniformsUtils.merge([T.UniformsLib.fog, T.UniformsLib.lights]) },
    fog: true,
    lights: true,
    vertexShader: `
      #include <common>
      attribute float waterDepth;
      attribute float bank;
      varying vec3 p;
      varying float depth, edge;
      #include <fog_pars_vertex>
      #include <shadowmap_pars_vertex>
      void main() {
        p = position;
        depth = waterDepth;
        edge = bank;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.);
        vec4 worldPosition = modelMatrix * vec4(position, 1.);
        vec3 transformedNormal = normalMatrix * vec3(0., 1., 0.);
        gl_Position = projectionMatrix * mvPosition;
        #include <shadowmap_vertex>
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float kingdomTime;
      varying vec3 p;
      varying float depth, edge;
      #include <common>
      #include <fog_pars_fragment>
      #include <bsdfs>
      #include <lights_pars_begin>
      #include <shadowmap_pars_fragment>
      #include <shadowmask_pars_fragment>
      ${noiseGLSL}
      void main() {
        vec2 q = floor(p.xz * 7.) / 7.;
        vec2 delta = vec2(q.x - q.y, q.x + q.y);
        float wave = sin(delta.y * 2.65 + sin(delta.x * .92) * 1.3 + kingdomTime * 1.6);
        float glint = smoothstep(.88, .997, wave) * smoothstep(.46, .92, hashCell(floor(vec2(delta.x * .77, delta.y * .71))));
        float crossWave = sin(q.x * 2.23 - q.y * 1.79 - kingdomTime * .81);
        float bands = smoothstep(.1, .96, crossWave * wave);
        vec3 deep = vec3(.021, .128, .155);
        vec3 shallow = vec3(.077, .294, .233);
        vec3 color = mix(shallow, deep, smoothstep(.15, 3.8, depth));
        color += vec3(.120, .175, .129) * glint + vec3(.023, .042, .033) * bands;
        float grade = length(vec2(dFdx(p.y), dFdy(p.y))) / max(.001, length(vec2(length(dFdx(p.xz)), length(dFdy(p.xz)))));
        float foam = (1. - smoothstep(.035, .27, edge + .05 * wave)) * .48 + smoothstep(.35, .78, grade) * (.48 + glint * .32);
        color = mix(color, vec3(.47, .67, .56), clamp(foam, 0., .88));
        color *= .95 + dither4(gl_FragCoord.xy) * .1;
        color *= mix(vec3(.38, .51, .63), vec3(1.), getShadowMask());
        gl_FragColor = vec4(color, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`
  });
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
