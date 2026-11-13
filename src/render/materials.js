import * as T from 'three';
import { coastGLSL } from './coast.js';

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
    uniforms: { kingdomTime: clock, ripple: { value: new T.Vector4() },
      ...T.UniformsUtils.merge([T.UniformsLib.fog, T.UniformsLib.lights]) },
    fog: true,
    lights: true,
    vertexShader: `
      #include <common>
      attribute float waterDepth;
      attribute float bank;
      attribute float waterRiver;
      attribute vec3 waterMotion;
      attribute vec3 waterBed;
      attribute vec3 waterMix;
      varying vec3 p;
      varying vec3 motion;
      varying vec3 bed;
      varying vec3 mixing;
      varying float depth, edge;
      varying float riverStyle;
      #include <fog_pars_vertex>
      #include <shadowmap_pars_vertex>
      void main() {
        p = position;
        depth = waterDepth;
        edge = bank;
        riverStyle = waterRiver;
        motion = waterMotion;
        bed = waterBed;
        mixing = waterMix;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.);
        vec4 worldPosition = modelMatrix * vec4(position, 1.);
        vec3 transformedNormal = normalMatrix * vec3(0., 1., 0.);
        gl_Position = projectionMatrix * mvPosition;
        #include <shadowmap_vertex>
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float kingdomTime;
      uniform vec4 ripple;
      varying vec3 p;
      varying vec3 motion;
      varying vec3 bed;
      varying vec3 mixing;
      varying float depth, edge;
      varying float riverStyle;
      #include <common>
      #include <fog_pars_fragment>
      #include <bsdfs>
      #include <lights_pars_begin>
      #include <shadowmap_pars_fragment>
      #include <shadowmask_pars_fragment>
      ${noiseGLSL}
      ${coastGLSL}
      float waterNoise(vec2 p) {
        vec2 cell = floor(p);
        vec2 t = fract(p);
        t = t * t * (3. - 2. * t);
        return mix(mix(hashCell(cell), hashCell(cell + vec2(1., 0.)), t.x),
                   mix(hashCell(cell + vec2(0., 1.)), hashCell(cell + 1.), t.x), t.y);
      }
      float riverFoam(vec2 p, vec2 flow) {
        vec2 direction=flow/max(length(flow),.001);
        vec2 local=vec2(dot(p,direction),dot(p,vec2(-direction.y,direction.x)));

        return coastNoise(local*vec2(.55,1.3))*.65 + coastNoise(local*vec2(1.1,2.2))* .35;
      }
      float mouthEddy(vec2 local, float time, float spin) {
        float radius = length(local);
        float angle = atan(local.y, local.x + .00001);
        return sin(angle + radius * 7.5 - time * spin) * exp(-radius * radius * 1.9);
      }
      void main() {
        vec2 q = p.xz;
        float sea = motion.z;
        float speed = length(motion.xy);
        float current = smoothstep(.035, .8, speed) * smoothstep(.035, .34, depth);
        float advected = .5;
        if (current > 0.) {
          float a = fract(kingdomTime * .27);
          float b = fract(a + .5);
          vec2 travel = motion.xy * 4.5;
          advected = mix(riverFoam(q - travel * b, motion.xy),
            riverFoam(q - travel * a, motion.xy), 1. - abs(a * 2. - 1.));
        }
        float warp = waterNoise(q * .22);
        // Blend the wave signals instead of the frequency to avoid compressed crests at the mouth.
        vec2 lakeWave = vec2(1.25, 1.73), seaWave = vec2(.46, .74);
        float lakePhase = dot(q, lakeWave) - kingdomTime * .58 + warp * 3.6;
        // Positive depth increases offshore: +time sends crests toward shallower water.
        vec2 seaGradient=coastGradient(q,depth);
        float nearCoast=1.-smoothstep(3.,8.,depth);
        float offshorePhase=dot(q,seaWave)-kingdomTime*1.45+warp*2.8;
        float seaPhase=depth*.85+kingdomTime*1.05+warp*.35;
        float packets=smoothstep(.28,.72,coastNoise(q*.12+vec2(kingdomTime*.025,0.)));
        float seaSignal=mix(sin(offshorePhase),sin(seaPhase),nearCoast)*packets;
        vec2 seaSlope=mix(seaWave*cos(offshorePhase),seaGradient*.85*cos(seaPhase),nearCoast)*packets;
        seaWave=mix(seaWave,normalize(seaGradient+vec2(.00001))*max(.12,length(seaGradient)*2.8),nearCoast);
        float receiver = mix(sin(lakePhase), seaSignal, sea);
        lakePhase += current * (advected - .5) * 5.2;
        seaPhase += current * (advected - .5) * 3.6;
        float fine = dot(q, vec2(1.1, -.65)) - kingdomTime * .7 - warp * 2.;
        float wave = mix(sin(lakePhase), seaSignal, sea) * .8 + sin(fine) * .2;
        vec2 slope = mix(lakeWave * cos(lakePhase) * .026, seaSlope * .085, sea)
          + vec2(.018, -.012) * cos(fine)
          + vec2(.026, .023) * mix(cos(lakePhase * 1.86 + fine * .31), (coastNoise(q*.4+kingdomTime*.06)-.5), sea);
        vec2 acrossFlow = vec2(-motion.y, motion.x);
        slope = slope * (1. - current * .48)
          + motion.xy * (advected - .5) * .24
          + acrossFlow * sin(lakePhase + seaPhase * .35) * current * .045;
        float collision = 0., eddies = 0.;
        float transition = mixing.x * smoothstep(.07, .65, depth);
        if (transition > .01) {
          vec2 local = vec2(mixing.y * 3., mixing.z * 2.8);
          vec2 drift = vec2(sin(kingdomTime * .31), cos(kingdomTime * .27)) * .12;
          eddies = mouthEddy(local - vec2(.8, .8) - drift, kingdomTime, 1.15)
            + mouthEddy(local - vec2(1.55, -.8) + drift, kingdomTime, -.95);
          float meeting = mixing.y * 12.5 + kingdomTime * 1.35
            + sin(mixing.z * 5. + kingdomTime * .47) * 1.6 + warp * 2.;
          collision = smoothstep(.42, .98, sin(meeting))
            * (.45 + .55 * smoothstep(-.5, .85, receiver))
            * smoothstep(.12, .72, waterNoise(q * .72 - motion.xy * kingdomTime * .21));
          slope += transition * (motion.xy * (collision - .35) * .20
            + acrossFlow * eddies * .18);
          wave += transition * (collision * .35 + eddies * .2);
        }
        vec3 normal = normalize(vec3(-slope.x, 1., -slope.y));
        vec3 eye = vec3(viewMatrix[0].z, viewMatrix[1].z, viewMatrix[2].z);
        vec3 halfSun = normalize(eye + normalize(vec3(-.45, .7, -.24)));
        float sky = pow(1. - max(0., dot(eye, normal)), 3.);
        float glint = pow(max(0., dot(normal, halfSun)), 52.) * (.72 + .28 * wave);

        float absorb = 1. - exp(-depth * mix(.94, 1.32, sea));
        vec3 clearWater = mix(vec3(.057, .165, .153), vec3(.043, .165, .174), sea);
        vec3 deepWater = mix(vec3(.018, .062, .071), vec3(.012, .061, .086), sea);
        vec3 color = mix(clearWater, deepWater, absorb);
        float bottom = exp(-depth * mix(1.9, 1.55, sea)) * (.83 - sky * .26);
        float sand = hashCell(floor((q + slope * min(depth, 1.)) * 5.));
        vec3 tintedBed = bed * vec3(.82, .96, .91) * mix(.93, 1.06, sand);
        color = mix(color, tintedBed, bottom);
        color = mix(color, vec3(.26, .38, .43), sky * (.22 + absorb * .26));
        color += vec3(.105, .13, .14) * glint * (1.-riverStyle) * (.32 + absorb * .68) * (.55 + warp * .45);

        float coast = sea * (1. - current * .87);
        vec2 shoreGradient = coastGradient(q, depth);
        float foam = 0.;
        if (coast > .01 && depth < 2.6) {
          foam = coastalFoam(q, depth, shoreGradient, kingdomTime).x * coast;
        }
        float grade = length(vec2(dFdx(p.y), dFdy(p.y)))
          / max(.001, length(vec2(length(dFdx(q)), length(dFdy(q)))));
        if (riverStyle > .01) {
          float shallow = (1. - smoothstep(.13, .55, edge)) * smoothstep(.025, .13, depth);
          float rapids = smoothstep(.14, .72, grade);
          float broadFoam=coastNoise(q*.48-motion.xy*kingdomTime*.32+vec2(kingdomTime*.025,0.));
          float streaks = smoothstep(.60,.80,broadFoam);
          foam += riverStyle * streaks * (.30 + shallow * .08 + rapids * .10);

        }

        foam += transition * smoothstep(.65,.9,collision)*.12;
        color *= mix(vec3(1.), vec3(1.075, 1.025, .94), transition * (.45 + eddies * .16));

        color = mix(color, vec3(.62, .72, .69), clamp(foam, 0., .8));

        if (ripple.w > 0.) {
          float crest = abs(length(q - ripple.xy) - (.18 + ripple.z * 1.8));
          float ring = (1. - smoothstep(.045, .16, crest)) * (1. - ripple.z);
          color += vec3(.23, .35, .32) * ring * ripple.w;
        }
        color *= mix(1.,.985 + dither4(gl_FragCoord.xy) * .03,1.-riverStyle);
        color *= mix(vec3(.38, .51, .63), vec3(1.), getShadowMask());
        gl_FragColor = vec4(color, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`
  });
}

export function beachMaterial(clock) {
  return new T.ShaderMaterial({
    uniforms: { kingdomTime: clock, ...T.UniformsUtils.merge([T.UniformsLib.fog]) },
    transparent: true, depthWrite: false, fog: true,
    vertexShader: `
      varying vec3 p;
      varying float mask;
      attribute float coastMask;
      #include <fog_pars_vertex>
      void main() {
        p = position;
        mask = coastMask;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform float kingdomTime;
      varying vec3 p;
      varying float mask;
      #include <common>
      #include <fog_pars_fragment>
      ${noiseGLSL}
      ${coastGLSL}
      void main() {
        float height = p.y - .018;
        vec2 gradient = coastGradient(p.xz, -height);
        if (height < .012 || height > .22 || mask < .05) discard;
        vec2 wash = coastalFoam(p.xz, -height, gradient, kingdomTime);
        float coverage = smoothstep(.05, .8, mask) * (1. - smoothstep(.17, .22, height));
        float alpha = (wash.x * .82 + wash.y * .16) * coverage;
        if (alpha < .002) discard;
        vec3 color = mix(vec3(.035, .065, .057), vec3(.68, .76, .73), clamp(wash.x * 2.2, 0., 1.));
        gl_FragColor = vec4(color, alpha);
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
