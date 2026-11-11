import { gridSample } from '../math.js';
import { DX, DZ } from './drainage.js';

export function waterVertex(world, x, z, ground = world.ground.at(z * world.stride + x)) {
  const i = z * world.stride + x, y = world.surface.at(i);
  return { x, z, y, mask: world.wet.at(i), depth: Math.max(0, y - ground), kind: world.waterKind.at(i) };
}

export function clipWater(world, a, b, c, decorateShore) {
  if (a.mask <= 0 && b.mask <= 0 && c.mask <= 0) return null;
  const polygon = [];
  let previous = c;
  for (const vertex of [a, b, c]) {
    if ((previous.mask > 0) !== (vertex.mask > 0)) {
      const t = previous.mask / (previous.mask - vertex.mask);
      const x = previous.x + (vertex.x - previous.x) * t;
      const z = previous.z + (vertex.z - previous.z) * t;
      const shore = { x, z, y: gridSample(world.ground, world.stride, x, z), mask: 0, depth: 0, kind: 0 };
      decorateShore?.(shore, previous, vertex, t);
      polygon.push(shore);
    }
    if (vertex.mask > 0) polygon.push(vertex);
    previous = vertex;
  }
  return polygon;
}

const still = Object.freeze([0, 0]);
const directions = DX.map((dx, i) => {
  const dz = DZ[i], length = Math.hypot(dx, dz);
  return Object.freeze([dx / length, dz / length]);
});
export const flowDirection = kind => directions[kind - 3] ?? still;

export function sampleWater(world, x, z) {
  const limit = world.stride - 1;
  if (!Number.isFinite(x) || !Number.isFinite(z) || x < 0 || z < 0 || x > limit || z > limit) return null;
  const ix = Math.min(limit - 1, Math.floor(x)), iz = Math.min(limit - 1, Math.floor(z));
  const east = waterVertex(world, ix + 1, iz), south = waterVertex(world, ix, iz + 1);
  const polygon = x - ix + z - iz <= 1
    ? clipWater(world, waterVertex(world, ix, iz), south, east)
    : clipWater(world, east, south, waterVertex(world, ix + 1, iz + 1));
  if (!polygon) return null;
  const a = polygon[0];
  for (let i = 1; i + 1 < polygon.length; i++) {
    const b = polygon[i], c = polygon[i + 1];
    const determinant = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
    if (!determinant) continue;
    const u = ((x - a.x) * (c.z - a.z) - (z - a.z) * (c.x - a.x)) / determinant;
    const v = ((b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x)) / determinant;
    const w = 1 - u - v;
    if (Math.min(u, v, w) < -1e-9) continue;
    const depth = a.depth * w + b.depth * u + c.depth * v;
    if (depth <= 0) return null;
    let kind = a.kind, weight = kind ? w : -1;
    if (b.kind && u > weight) { kind = b.kind; weight = u; }
    if (c.kind && v > weight) kind = c.kind;
    const [ax, az] = flowDirection(a.kind), [bx, bz] = flowDirection(b.kind), [cx, cz] = flowDirection(c.kind);
    return { kind: kind === 1 ? 'sea' : kind === 2 ? 'lake' : 'river',
      surface: a.y * w + b.y * u + c.y * v, depth,
      flowX: ax * w + bx * u + cx * v, flowZ: az * w + bz * u + cz * v };
  }
  return null;
}
