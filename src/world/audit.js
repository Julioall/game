import { buildable } from './terrain/placement.js';

export function auditWorld(world) {
  let brokenRivers = 0, steepLand = 0, invalidSites = 0;
  for (let i = 0; i < world.ground.length; i++) {
    if (world.wet[i] <= 0 && world.slope[i] > .63) steepLand++;
    if (!world.river[i]) continue;
    const j = world.downstream[i];
    if (j < 0 || world.wet[j] <= 0 || world.filled[j] > world.filled[i] ||
      Math.abs(i % world.stride - j % world.stride) > 1 ||
      Math.abs(Math.floor(i / world.stride) - Math.floor(j / world.stride)) > 1) brokenRivers++;
  }
  for (const town of world.towns) {
    for (const i of town.roads) if (world.wet[i] > 0) invalidSites++;
    for (const b of town.buildings) if (!buildable(world, b.x, b.z, b.footprint * .5)) invalidSites++;
    for (const f of town.fields) if (!buildable(world, f.x, f.z, 2)) invalidSites++;
    for (const gate of town.cityWall?.gates ?? []) {
      const i = gate.z * world.stride + gate.x, step = gate.dz * world.stride + gate.dx;
      if (![i - step, i, i + step].every(cell => town.roads.includes(cell))) invalidSites++;
    }
    if (town.fort) {
      const { bounds, gate } = town.fort;
      for (let z = bounds.minZ; z <= bounds.maxZ; z++) for (let x = bounds.minX; x <= bounds.maxX; x++) {
        if (world.distance[z * world.stride + x] < 2) invalidSites++;
      }
      const i = gate.z * world.stride + gate.x;
      const step = gate.dz * world.stride + gate.dx;
      if (![i - step, i, i + step].every(cell => town.roads.includes(cell))) invalidSites++;
    }
  }
  return { brokenRivers, steepLand, invalidSites };
}

// Counts substantial canopy intersections in the current render window.
// The lattice gives a conservative bound, so there is no full pairwise scan.
export function crownOverlaps(objects) {
  const cells = new Map();
  let count = 0;
  for (const o of objects) {
    if (o.kind !== 'tree') continue;
    const x = Math.floor(o.x / 4), z = Math.floor(o.z / 4);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      for (const n of cells.get((x + dx) + ',' + (z + dz)) ?? []) {
        if (Math.hypot(n.x - o.x, n.z - o.z) < (n.radius + o.radius) * .83) count++;
      }
    }
    const key = x + ',' + z;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(o);
  }
  return count;
}
