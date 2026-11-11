import * as T from 'three';
import { clipWater, flowDirection } from '../world/terrain/water.js';
import { DX, DZ } from '../world/terrain/drainage.js';
import { clamp, mix } from '../world/math.js';
import { mouthFlow } from '../world/terrain/water-flow.js';

const WATER_OFFSET = .047;

export function oceanGeometry(size) {
  const margin = (Math.max(1450, size + 800) - size) / 2;
  const far = size + margin;
  const positions = [], indices = [];
  function strip(x0, z0, x1, z1) {
    const i = positions.length / 3;
    positions.push(x0, WATER_OFFSET, z0, x0, WATER_OFFSET, z1,
      x1, WATER_OFFSET, z0, x1, WATER_OFFSET, z1);
    indices.push(i, i + 1, i + 2, i + 2, i + 1, i + 3);
  }
  strip(-margin, -margin, far, 0);
  strip(-margin, size, far, far);
  strip(-margin, 0, 0, size);
  strip(size, 0, far, size);
  const count = positions.length / 3;
  const motion = new Int8Array(count * 3);
  for (let i = 2; i < motion.length; i += 3) motion[i] = 127;
  const geometry = new T.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('waterDepth', new T.Float32BufferAttribute(new Float32Array(count).fill(5), 1));
  geometry.setAttribute('bank', new T.Float32BufferAttribute(new Float32Array(count).fill(2), 1));
  geometry.setAttribute('waterMotion', new T.Int8BufferAttribute(motion, 3, true));
  geometry.setAttribute('waterBed', new T.Uint8BufferAttribute(new Uint8Array(count * 3), 3, true));
  geometry.setAttribute('waterMix', new T.Int8BufferAttribute(new Int8Array(count * 3), 3, true));
  return geometry;
}

function blendedMotion(world, { x, z, kind }) {
  const { stride, waterKind } = world;
  const [dx, dz] = flowDirection(kind);
  let flowX = dx * 4, flowZ = dz * 4, sea = kind === 1 ? 4 : 0, total = 4;
  // Read across chunk boundaries and stop each ray at dry land.
  for (let i = 0; i < DX.length; i++) for (let step = 1; step <= 3; step++) {
    const nx = x + DX[i] * step, nz = z + DZ[i] * step;
    if (nx < 0 || nz < 0 || nx >= stride || nz >= stride) break;
    const neighbor = waterKind.at(nz * stride + nx);
    if (!neighbor) break;
    const weight = 1.25 - step * .25;
    const [sx, sz] = flowDirection(neighbor);
    flowX += sx * weight;
    flowZ += sz * weight;
    if (neighbor === 1) sea += weight;
    total += weight;
  }
  return [flowX / total, flowZ / total, sea / total];
}

function shadeShore(shore, from, to, t) {
  shore.motion = (from.kind ? from : to).motion;
  shore.mixing = [0, 0, 0];
  shore.bed = from.bed.map((value, i) => mix(value, to.bed[i], t));
}

export function waterMesh(world, vertices, triangles, colors, material, mouths = []) {
  const water = [], depth = [], banks = [], motion = [], bed = [], mixing = [];
  for (let i = 0; i < vertices.length; i++) {
    const vertex = vertices[i];
    vertex.bed = colors.slice(i * 3, i * 3 + 3);
    if (vertex.kind) {
      const base = blendedMotion(world, vertex);
      const transition = { strength: 0, progress: 0, lateral: 0 };
      vertex.motion = mouths.length ? mouthFlow(world, vertex.x, vertex.z, mouths, base, transition) : base;
      vertex.mixing = [transition.strength, transition.progress, transition.lateral];
    }
  }
  for (let t = 0; t < triangles.length; t += 3) {
    const clipped = clipWater(world, vertices[triangles[t]], vertices[triangles[t + 1]], vertices[triangles[t + 2]], shadeShore);
    if (!clipped) continue;
    for (let i = 1; i + 1 < clipped.length; i++) {
      for (const vertex of [clipped[0], clipped[i], clipped[i + 1]]) {
        water.push(vertex.x, vertex.y + WATER_OFFSET, vertex.z);
        depth.push(vertex.depth);
        banks.push(vertex.mask);
        const [dx, dz, sea] = vertex.motion;
        motion.push(Math.round(dx * 127), Math.round(dz * 127), Math.round(sea * 127));
        for (const value of vertex.mixing) mixing.push(Math.round(clamp(value, -1, 1) * 127));
        for (const channel of vertex.bed) bed.push(Math.round(clamp(channel) * 255));
      }
    }
  }

  if (water.length) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(water, 3));
    geometry.setAttribute('waterDepth', new T.Float32BufferAttribute(depth, 1));
    geometry.setAttribute('bank', new T.Float32BufferAttribute(banks, 1));
    geometry.setAttribute('waterMotion', new T.Int8BufferAttribute(motion, 3, true));
    geometry.setAttribute('waterBed', new T.Uint8BufferAttribute(bed, 3, true));
    geometry.setAttribute('waterMix', new T.Int8BufferAttribute(mixing, 3, true));
    const stream = new T.Mesh(geometry, material);
    stream.receiveShadow = true;
    return stream;
  }
  return null;
}
