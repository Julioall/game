// Independent front spacing/period/width. All visible crests are coastal.
export const COASTAL_FRONTS = Object.freeze([
  Object.freeze({ reach: 9.5, period: 7.7, width: .65, phase: .1 }),
  Object.freeze({ reach: 15.2, period: 18.7, width: 1.05, phase: .47 }),
  Object.freeze({ reach: 20.5, period: 11.9, width: 1.4, phase: .79 })
]);

export const coastalWavesGLSL = `
float waterHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * .1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float waterNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f*f*f*(f*(f*6.-15.)+10.);
  return mix(mix(waterHash(i), waterHash(i+vec2(1.,0.)),f.x),
    mix(waterHash(i+vec2(0.,1.)), waterHash(i+1.),f.x),f.y);
}
// x = broken crest, y = wave slope, z = shared runup/recession pulse.
vec3 coastalFronts(vec2 p, float shore, float t) {
  vec3 result = vec3(0.);
  float broad = waterNoise(p * .047);
  float fine = waterNoise(p * .19 + 17.);
  ${COASTAL_FRONTS.map((front,i) => `{
    float cycle = fract(t / ${front.period} + ${front.phase} + broad * .16 + ${i}.0 * .037);
    float width = ${front.width} * (.65 + .7 * waterNoise(p * .073 + ${i * 29 + 7}.0));
    float warpedDistance = shore + (broad-.5)*2.7 + (fine-.5)*.8;
    float delta = (warpedDistance - (1.-cycle) * ${front.reach}) / width;
    float ridge = exp(-delta*delta*2.);
    float coverage = smoothstep(.38,.75,waterNoise(p * .135 + vec2(${i * 31 + 3}.0, t * .009)))
      * smoothstep(.24,.61,waterNoise(p * .043 + vec2(${i * 17 + 11}.0, t * .003)));
    float envelope = smoothstep(0.,.09,cycle) * (1.-smoothstep(.94,1.,cycle));
    result.x += ridge * coverage * envelope;
    result.y += delta * ridge * coverage * envelope;
    float landing = smoothstep(.73,1.,cycle);
    result.z = max(result.z, sin(landing * 3.14159265) * (.5 + broad*.5));
  }`).join('\n')}
  return result;
}
`;
