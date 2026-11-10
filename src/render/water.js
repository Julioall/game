import * as T from 'three';
import { gridSample } from '../world/math.js';

export function waterMesh(world, vertices, triangles, material) {
  const { ground, stride } = world;
  const water = [], depth = [], banks = [];
  function clipWater(a, b, c) {
    if (a.mask <= 0 && b.mask <= 0 && c.mask <= 0) return;
    const clipped = [];
    let prev = c;
    for (const vertex of [a, b, c]) {
      if ((prev.mask > 0) !== (vertex.mask > 0)) {
        const t = prev.mask / (prev.mask - vertex.mask);
        const x = prev.x + (vertex.x - prev.x) * t, z = prev.z + (vertex.z - prev.z) * t;
        clipped.push({ x, z, y: gridSample(ground, stride, x, z), mask: 0, depth: 0 });
      }
      if (vertex.mask > 0) clipped.push(vertex);
      prev = vertex;
    }
    for (let i = 1; i + 1 < clipped.length; i++) {
      for (const vertex of [clipped[0], clipped[i], clipped[i + 1]]) {
        water.push(vertex.x, vertex.y + .047, vertex.z);
        depth.push(vertex.depth);
        banks.push(vertex.mask);
      }
    }
  }

  for (let i = 0; i < triangles.length; i += 3) {
    clipWater(vertices[triangles[i]], vertices[triangles[i + 1]], vertices[triangles[i + 2]]);
  }
  if (water.length) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(water, 3));
    geometry.setAttribute('waterDepth', new T.Float32BufferAttribute(depth, 1));
    geometry.setAttribute('bank', new T.Float32BufferAttribute(banks, 1));
    const stream = new T.Mesh(geometry, material);
    stream.receiveShadow = true;
    return stream;
  }
  return null;
}
