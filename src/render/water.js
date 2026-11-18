// GLSL adaptation of #NVJOB Simple Water Shaders v1.6 / Water Surface.
// Copyright (c) 2016 #NVJOB Nicholas Veselov and Unity Technologies. MIT.
// Original notices: public/water/nvjob/. Flow/depth geometry belongs to the game.
import * as T from 'three';
import { coastalWavesGLSL } from './coastal-waves.js';

export function waterMaterial(clock) {
  const loader = new T.TextureLoader();
  const textures = ['albedo-0', 'albedo-1', 'normal-0', 'normal-1', 'height'].map(name => {
    const texture = loader.load(import.meta.env.BASE_URL + 'water/nvjob/' + name + '.png');
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.magFilter = T.LinearFilter;
    texture.minFilter = T.LinearMipmapLinearFilter;
    texture.colorSpace = T.NoColorSpace;
    return texture;
  });
  const uniforms = T.UniformsUtils.merge([T.UniformsLib.fog, {
    albedo0: { value: textures[0] }, albedo1: { value: textures[1] },
    normal0: { value: textures[2] }, normal1: { value: textures[3] }, heightMap: { value: textures[4] },
    shallowColor: { value: new T.Color('#559e92') }, deepColor: { value: new T.Color('#184e61') },
    ripple: { value: new T.Vector4(0, 0, 0, 0) }
  }]);
  uniforms.lakeReflection = { value: textures[0] };
  uniforms.reflectionMatrix = { value: new T.Matrix4() };
  uniforms.reflectionReady = { value: 0 };
  uniforms.reflectionLevel = { value: 0 };
  // Keep original texture objects and the shared clock (merge clones values).
  ['albedo0','albedo1','normal0','normal1','heightMap'].forEach((key, i) => { uniforms[key].value = textures[i]; });
  uniforms.time = clock;
  const material = new T.ShaderMaterial({
    uniforms, transparent: true, depthWrite: true, side: T.DoubleSide, fog: true,
    vertexShader: `
      attribute vec3 waterData;
      attribute vec2 waterFlow;
      attribute vec3 waterTransition;
      attribute float shoreFilm;
      attribute float shoreDistance;
      varying vec3 waterPosition;
      varying vec3 waterInfo;
      varying vec2 flow;
      varying vec3 transition;
      varying float beachFilm;
      varying float coastDistance;
      #include <fog_pars_vertex>
      void main() {
        waterPosition = position; waterInfo = waterData; flow = waterFlow; transition = waterTransition; beachFilm = shoreFilm;
        coastDistance = shoreDistance;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      uniform sampler2D albedo0, albedo1, normal0, normal1, heightMap;
      uniform float time;
      uniform vec3 shallowColor, deepColor;
      uniform vec4 ripple;
      uniform sampler2D lakeReflection;
      uniform mat4 reflectionMatrix;
      uniform float reflectionReady, reflectionLevel;
      varying vec3 waterPosition;
      varying vec3 waterInfo;
      varying vec2 flow;
      varying vec3 transition;
      varying float beachFilm;
      varying float coastDistance;
      #include <fog_pars_fragment>
      ${coastalWavesGLSL}
      void main() {
        float depth = waterInfo.x, river = clamp(waterInfo.y, 0., 1.);
        float sea = clamp(waterInfo.z, 0., 1.);
        // River and sea weights are complementary in the estuary.
        // Their blend must not accidentally activate the lake material.
        float lake = max(0., 1. - sea - river);
        float influence = clamp(length(flow), 0., 1.);
        vec2 current = flow / max(.001, length(flow));
        vec2 drift = vec2(.045, .025) * (1. - influence) * mix(1., .12, lake) + flow * .95;
        // World-space coordinates agree on both sides of a river mouth.
        vec2 uv = waterPosition.xz / 9.;
        float phase0 = fract(time * .125), phase1 = fract(time * .125 + .5);
        float phaseBlend = abs(phase0 * 2. - 1.);
        vec2 movement0 = drift * (phase0 * 8.) / 9.;
        vec2 movement1 = drift * (phase1 * 8.) / 9.;
        vec3 view = normalize(cameraPosition - waterPosition);
        // Crossfade overlapping phases: no unbounded stretching as river turns.
        float h = mix(texture2D(heightMap, uv - movement0).r,
          texture2D(heightMap, uv - movement1).r, phaseBlend) - .5;
        vec2 offset = h * mix(.016, .002, lake * (1. - influence)) * view.xz / max(.35, abs(view.y));
        vec2 uv0 = uv - movement0 - offset, uv1 = uv - movement1 - offset;
        vec2 windUV = waterPosition.xz / 17. - vec2(.006, .0035) * time * mix(1., .12, lake);
        float albedo = mix(texture2D(albedo0, uv0).r, texture2D(albedo0, uv1).r, phaseBlend)
          * texture2D(albedo1, windUV * 1.37).r;
        vec3 n0 = mix(texture2D(normal0, uv0).xyz, texture2D(normal0, uv1).xyz, phaseBlend) * 2. - 1.;
        vec3 n1 = texture2D(normal1, windUV).xyz * 2. - 1.;
        vec3 micro = texture2D(normal1, windUV * 3.7).xyz * 2. - 1.;
        vec3 combined = normalize(n0 + n1 * .55 - micro * .12);
        vec2 p = waterPosition.xz;
        // Long ocean swells cross shorter wind waves. Lakes keep small ripples.
        float warp = (waterNoise(p * .035) - .5) * 3.;
        float swell = dot(p, vec2(.91,.41)) * .23 + warp - time * .57;
        float chop = dot(p, vec2(-.28,.96)) * .51 - warp * .7 - time * .91;
        vec2 waves = vec2(.91,.41) * cos(swell) + vec2(-.28,.96) * cos(chop) * .35;
        // Depth gradient bends nearshore wave fronts toward the local coast.
        vec2 px = dFdx(p), py = dFdy(p);
        float determinant = px.x * py.y - px.y * py.x;
        vec2 gradient = vec2(dFdx(coastDistance) * py.y - dFdy(coastDistance) * px.y,
          px.x * dFdy(coastDistance) - py.x * dFdx(coastDistance)) / (abs(determinant) > .000001 ? determinant : .000001);
        vec2 shoreward = -gradient / max(.001, length(gradient));
        float mouthShelter = sea * smoothstep(.12, .7, influence) * smoothstep(.4, 1.6, depth);
        float coastBand = (1. - mouthShelter) * sea * (1. - smoothstep(12., 24., coastDistance))
          * (1. - smoothstep(1.2, 3., max(0., depth)));
        vec3 fronts = vec3(0.);
        if (coastBand > .001 || beachFilm > .5) fronts = coastalFronts(p, coastDistance, time);
        waves = mix(waves, shoreward * fronts.y * 2.4, coastBand);
        float waveStrength = mix(.003, .016 + coastBand * .07, sea) * (1. - influence * .78) * smoothstep(.02, .35, depth);
        vec2 across = vec2(-current.y, current.x);
        vec2 streamNormal = current * combined.x * .035 + across * combined.y * .075;
        vec2 slope = mix(combined.xy * mix(mix(.075, .028, sea), .006, lake), streamNormal, influence) + waves * waveStrength;
        // Sparse local disturbances expand radially; no sustained lake current.
        vec2 basinCell = floor(p / 96.);
        float seed = fract(sin(dot(basinCell, vec2(127.1,311.7))) * 43758.5453);
        vec2 source = (basinCell + .5) * 96. + vec2(sin(seed * 19.), cos(seed * 23.)) * 7.;
        vec2 radial = p - source;
        float radius = length(radial), age = mod(time + seed * 23., 23.);
        float radialRing = sin(radius * 5.5 - age * 9.) * exp(-abs(radius - age * 1.7) * 2.)
          * smoothstep(.1, .8, age) * (1. - smoothstep(8., 17., age));
        slope += radial / max(.1, radius) * radialRing * .012 * lake * (1. - influence)
          * smoothstep(.02, .5, depth);
        float mixing = transition.x * sin(clamp(transition.y, 0., 1.) * 3.14159265);
        // Two subtle lateral swirls and short interference ripples in the plume.
        slope += vec2(sin(p.y * 2.2 + time * 2.), cos(p.x * 2. - time * 1.7))
          * mixing * .018 * (1. - abs(transition.z) * .5);
        vec3 normal = normalize(vec3(slope.x, 1., slope.y));
        float ringDistance = length(waterPosition.xz - ripple.xy);
        float ring = sin(ringDistance * 12. - ripple.z * 17.) * exp(-abs(ringDistance - ripple.z * 2.4) * 4.)
          * max(0., 1. - ripple.z) * ripple.w;
        normal = normalize(normal + vec3(ring * .025, 0., ring * .025));
        float fresnel = .02 + .98 * pow(1. - max(0., dot(normal, view)), 5.);
        // Freshwater and saltwater share geometry, but not optical absorption.
        vec3 shallow = shallowColor * sea + vec3(.17,.30,.25) * lake + vec3(.25,.34,.22) * river;
        vec3 deep = deepColor * sea + vec3(.045,.12,.12) * lake + vec3(.065,.17,.125) * river;
        vec3 color = mix(shallow, deep, 1. - exp(-depth * .72));
        color = mix(color, shallowColor * .9, influence * (1. - river) * .16);
        color *= mix(mix(.84 + albedo * .6, .97 + albedo * .08, sea), .99 + albedo * .04, lake * (1. - influence));
        float shine = pow(max(0., dot(reflect(normalize(vec3(.5,-.8,.3)), normal), view)), 70.);
        color = mix(color, vec3(.42,.63,.66), fresnel * .45);
        vec4 reflectedPosition = reflectionMatrix * vec4(waterPosition, 1.);
        vec2 reflectionUV = reflectedPosition.xy / max(.001, reflectedPosition.w) + slope * .012;
        float reflectionValid = reflectionReady * (1. - step(.18, abs(waterPosition.y - reflectionLevel)))
          * step(0., reflectionUV.x) * step(reflectionUV.x, 1.) * step(0., reflectionUV.y) * step(reflectionUV.y, 1.);
        reflectionValid *= smoothstep(0., .09, min(min(reflectionUV.x, reflectionUV.y),
          min(1. - reflectionUV.x, 1. - reflectionUV.y)));
        vec3 reflectedScene = texture2D(lakeReflection, clamp(reflectionUV, .001, .999)).rgb;
        color = mix(color, reflectedScene, lake * (1. - influence * .8) * reflectionValid
          * (.19 + fresnel * .24) * smoothstep(.07, .8, depth));
        color += vec3(.7,.8,.72) * shine * mix(.36, .055 + coastBand * .12, sea);
        float crests = fronts.x * coastBand * (1. - influence * .75);
        float streaks = smoothstep(.18,.42,albedo) * smoothstep(.45,.95,
          sin(dot(p, across) * 6. + h * 6.)) * influence;
        color += vec3(.12,.17,.15) * (crests * .23 + streaks * .32);
        // A narrow, broken shore ribbon follows actual clipped depth.
        float shoreBreak = fronts.x * coastBand * (1. - smoothstep(.65, 2.4, depth));
        // Contiguous tonal bands follow the crest, like depth contours.
        float crestSteps = floor(clamp(shoreBreak * 1.4, 0., 1.) * 4.) * .25;
        float foam = sea * crestSteps;
        foam += river * (1. - smoothstep(.025, .2, depth)) * smoothstep(.18,.6,albedo) * .25;
        foam += mixing * smoothstep(.24,.48,albedo) * .42;
        vec3 foamPalette = mix(vec3(.62,.78,.73), vec3(.94,.97,.91), crestSteps);
        color = mix(color, foamPalette, clamp(foam * mix(.55,.92,sea), 0., 1.));
        // Alpha follows the physical bed, not a pulsing displacement band.
        float alpha = (1. - exp(-max(0., depth) * .96)) * .96;
        // Deep sea is opaque: terrain/background differences must not expose
        // the rectangular join between in-map water and the outer ocean.
        alpha = mix(alpha, 1., sea * smoothstep(1.8, 4., depth));
        if (beachFilm > .5) {
          float pulse = fronts.z;
          float reach = .025 + .28 * pow(pulse, 1.6);
          float elevation = waterPosition.y - .018;
          float wetting = 1. - smoothstep(max(0., reach - .12), reach + .035, elevation);
          float ribbon = exp(-abs(elevation - reach + .018) * 95.);
          color = mix(vec3(.16,.34,.32), vec3(.82,.88,.83), ribbon * smoothstep(.3,.7,waterNoise(p * .21)));
          alpha = wetting * (.12 + ribbon * .48) * smoothstep(0., .08, elevation);
        }
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `
  });
  material.addEventListener('dispose', () => textures.forEach(texture => texture.dispose()));
  return material;
}
