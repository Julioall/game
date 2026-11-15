import * as T from 'three';
import { CHUNK } from '../world/catalog.js';
import { clipWater, flowDirection, waterVertex } from '../world/terrain/water.js';
import { waterMotion } from './water-motion.js';

// Use the same triangles and shoreline interpolation as the authoritative query.
export function waterGeometry(world, cx, cz, mouths = []) {
  const positions = [], data = [], flows = [], transitions = [], shores = [];
  const cache = new Map();
  const vertex = (x, z) => {
    const i = z * world.stride + x;
    if (!cache.has(i)) {
      const v = waterVertex(world, x, z);
      v.shore = world.coastDistance?.sample(x,z) ?? 128;
      if (v.mask > 0) v.motion = waterMotion(world, x, z, v.kind, mouths);
      cache.set(i, v);
    }
    return cache.get(i);
  };
  function emit(v) {
    positions.push(v.x, v.y + .012, v.z);
    let seaBlend = v.kind === 1 ? 1 : 0;
    // The current plume is the opacity of the river detail layer. It fades
    // continuously along and across the full estuary, never at the beach.
    if (v.kind === 1) {
      const strength = Math.min(1, (v.motion?.transition?.[0] ?? 0) / .94);
      // Ease the lateral edge of the current material instead of exposing
      // the shallow linear tail of the plume at the two beach corners.
      const eased = strength * strength * (3 - 2 * strength);
      seaBlend = 1 - eased;
    }
    data.push(v.depth, v.kind === 2 || !v.kind ? 0 : 1 - seaBlend, seaBlend);
    flows.push(...(v.motion?.flow ?? flowDirection(v.kind)));
    transitions.push(...(v.motion?.transition ?? [0, 0, 0]));
    shores.push(v.shore ?? 0);
  }
  function triangle(a, b, c) {
    const polygon = clipWater(world, a, b, c, (shore, previous, next) => {
      shore.kind = previous.mask > 0 ? previous.kind : next.kind;
      shore.motion = previous.mask > 0 ? previous.motion : next.motion;
      shore.shore = 0;
    });
    if (!polygon) return;
    for (let i = 1; i + 1 < polygon.length; i++) {
      emit(polygon[0]); emit(polygon[i]); emit(polygon[i + 1]);
    }
  }
  const x0 = cx * CHUNK, z0 = cz * CHUNK;
  for (let z = z0; z < Math.min(z0 + CHUNK, world.config.size); z++) {
    for (let x = x0; x < Math.min(x0 + CHUNK, world.config.size); x++) {
      const a = vertex(x, z), b = vertex(x + 1, z), c = vertex(x, z + 1), d = vertex(x + 1, z + 1);
      triangle(a, c, b); triangle(b, c, d);
    }
  }
  if (!positions.length) return null;
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('waterData', new T.Float32BufferAttribute(data, 3));
  geometry.setAttribute('waterFlow', new T.Float32BufferAttribute(flows, 2));
  geometry.setAttribute('waterTransition', new T.Float32BufferAttribute(transitions, 3));
  geometry.setAttribute('shoreFilm', new T.Float32BufferAttribute(new Float32Array(data.length / 3), 1));
  geometry.setAttribute('shoreDistance', new T.Float32BufferAttribute(shores, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

export function outerOceanGeometry(size, margin = 350) {
  const positions = [], data = [], flows = [];
  const rect = (x0, z0, x1, z1) => {
    for (const [x, z] of [[x0,z0],[x0,z1],[x1,z0],[x1,z0],[x0,z1],[x1,z1]]) {
      positions.push(x, .012, z); data.push(6, 0, 1); flows.push(0, 0);
    }
  };
  rect(-margin, -margin, size + margin, 0);
  rect(-margin, size, size + margin, size + margin);
  rect(-margin, 0, 0, size);
  rect(size, 0, size + margin, size);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('waterData', new T.Float32BufferAttribute(data, 3));
  geometry.setAttribute('waterFlow', new T.Float32BufferAttribute(flows, 2));
  geometry.setAttribute('waterTransition', new T.Float32BufferAttribute(new Float32Array(data.length), 3));
  geometry.setAttribute('shoreFilm', new T.Float32BufferAttribute(new Float32Array(data.length / 3), 1));
  geometry.setAttribute('shoreDistance', new T.Float32BufferAttribute(new Float32Array(data.length / 3).fill(128), 1));
  return geometry;
}

// A thin presentation-only film on low sea beaches. Never changes wet/ground.
export function swashGeometry(world, cx, cz) {
  if (!world.beachDistance) return null;
  const positions = [];
  const vertex = (x, z) => {
    const i = z * world.stride + x;
    return { x, z, y: world.ground.at(i), near: world.beachDistance.at(i) <= 3 };
  };
  const emit = (a, b, c) => {
    if (![a,b,c].some(v => v.near && v.y >= 0 && v.y < .32)) return;
    // Reject steep banks instead of letting a coarse triangle climb a cliff.
    if ([a,b,c].some(v => !v.near || v.y > .5)) return;
    for (const v of [a,b,c]) positions.push(v.x, v.y + .018, v.z);
  };
  const x0 = cx * CHUNK, z0 = cz * CHUNK;
  for (let z = z0; z < Math.min(z0 + CHUNK, world.config.size); z++) {
    for (let x = x0; x < Math.min(x0 + CHUNK, world.config.size); x++) {
      const a = vertex(x,z), b = vertex(x+1,z), c = vertex(x,z+1), d = vertex(x+1,z+1);
      emit(a,c,b); emit(b,c,d);
    }
  }
  if (!positions.length) return null;
  const count = positions.length / 3, data = new Float32Array(positions.length);
  for (let i = 0; i < count; i++) { data[i * 3] = -positions[i * 3 + 1] + .018; data[i * 3 + 2] = 1; }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('waterData', new T.Float32BufferAttribute(data, 3));
  geometry.setAttribute('waterFlow', new T.Float32BufferAttribute(new Float32Array(count * 2), 2));
  geometry.setAttribute('waterTransition', new T.Float32BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('shoreFilm', new T.Float32BufferAttribute(new Float32Array(count).fill(1), 1));
  geometry.setAttribute('shoreDistance', new T.Float32BufferAttribute(new Float32Array(count), 1));
  return geometry;
}
