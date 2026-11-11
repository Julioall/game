import * as T from 'three';

// Shared by the water and the thin wash over the beach so a front crosses the shoreline continuously.
export const coastGLSL = `
float coastNoise(vec2 p) {
  vec2 cell = floor(p), t = fract(p);
  t = t * t * (3. - 2. * t);
  return mix(mix(hashCell(cell), hashCell(cell + vec2(1., 0.)), t.x),
    mix(hashCell(cell + vec2(0., 1.)), hashCell(cell + 1.), t.x), t.y);
}
vec2 coastalFront(vec2 q, float distance, vec2 coastNormal, float time,
                  vec2 direction, float frequency, float seed, float fragments) {
  float variation = coastNoise(q * .065 + seed);
  float phase = time * frequency + dot(q, vec2(-direction.y, direction.x)) * .035
    + variation * 1.4 + seed;
  float age = fract(phase);
  float exposure = .55 + .45 * abs(dot(coastNormal, direction));
  float strength = smoothstep(.16, .67, variation) * exposure;
  float reach = mix(.65, 1.9, variation) * exposure;
  float advance = smoothstep(.035, .58, age);
  float retreat = smoothstep(.58, .99, age);
  float position = mix(5.2, -reach, advance) + retreat * (reach + .7);
  float life = smoothstep(.02, .17, age) * (1. - smoothstep(.70, 1., age));
  float breaking = 1. - smoothstep(2.3, 4.8, position);
  float front = 1. - smoothstep(.10, .55, abs(distance - position));
  float trail = smoothstep(position - .2, position + .45, distance)
    * (1. - smoothstep(position + .5, position + 2.2, distance));
  float lace = smoothstep(.20 + age * .24, .80, fragments);
  float foam = (front * .8 + trail * .38 * lace) * strength * life * breaking;
  float wet = smoothstep(position - .25, position + .5, distance)
    * strength * life * breaking;
  return vec2(foam, wet);
}
vec2 coastalFoam(vec2 q, float signedDepth, vec2 gradient, float time) {
  float grade = length(gradient);
  vec2 normal = gradient / max(.001, grade);
  float distance = signedDepth / clamp(grade, .055, .65);
  float fragments = coastNoise(q * 1.5 + vec2(time * .08, -time * .045));
  vec2 first = coastalFront(q, distance, normal, time, vec2(.8, .6), .128, 3.7, fragments);
  vec2 second = coastalFront(q, distance, normal, time, vec2(-.38, .925), .151, 17.2, fragments);
  vec2 third = coastalFront(q, distance, normal, time, vec2(.96, -.28), .109, 31.4, fragments);
  return min(vec2(1.), first + second * .78 + third * .62);
}
vec2 coastGradient(vec2 q, float signedDepth) {
  vec2 a = dFdx(q), b = dFdy(q);
  float determinant = a.x * b.y - a.y * b.x;
  if (abs(determinant) < .0000001) return vec2(0.);
  float dx = dFdx(signedDepth), dy = dFdy(signedDepth);
  return vec2(dx * b.y - dy * a.y, dy * a.x - dx * b.x) / determinant;
}
`;

export function beachMesh(world, vertices, triangles, material) {
  const { stride, ground, waterKind } = world;
  const positions = [], masks = [], eligible = [];
  let hasCoast = false;
  for (const vertex of vertices) {
    const i = vertex.z * stride + vertex.x, height = ground.at(i);
    let coast = 0;
    if (world.wet.at(i) <= 0 && height >= .012 && height <= .24) {
      for (let dz = -3; dz <= 3 && !coast; dz++) for (let dx = -3; dx <= 3; dx++) {
        const x = vertex.x + dx, z = vertex.z + dz;
        if (x >= 0 && z >= 0 && x < stride && z < stride && waterKind.at(z * stride + x) === 1) {
          coast = 1;
          break;
        }
      }
    }
    if (coast) hasCoast = true;
    eligible.push(coast);
  }
  if (!hasCoast) return null;
  for (let t = 0; t < triangles.length; t += 3) {
    const indices = triangles.slice(t, t + 3);
    if (!indices.some(i => eligible[i])) continue;
    for (const i of indices) {
      const vertex = vertices[i];
      positions.push(vertex.x, ground.at(vertex.z * stride + vertex.x) + .018, vertex.z);
      masks.push(eligible[i]);
    }
  }
  if (!positions.length) return null;
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('coastMask', new T.Float32BufferAttribute(masks, 1));
  const mesh = new T.Mesh(geometry, material);
  mesh.renderOrder = 1;
  mesh.raycast = () => {};
  return mesh;
}
