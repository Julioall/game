import { BIOMES, CHUNK, SPECIES } from './catalog.js';
import { clamp, gridSample, hash } from './math.js';
import { insideFort, insideFortFootprint } from './fortifications.js';

const pitch = 3.35;

function resourceCoordinate(seed, gx, gz, stream, cell) {
  return (cell + .38 + hash(seed, gx, gz, stream) * .24) * pitch;
}

export function chunkObjects(world, townIndex, cx, cz, { resourcesOnly = false } = {}) {
  const { config, stride, ground, distance, biome, slope } = world;
  const { roads, buildings, yards, fields, districts } = townIndex;
  const nearby = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    nearby.push(...(buildings.get((cx + dx) + ',' + (cz + dz)) ?? []));
  }
  const forts = yards.get(cx + ',' + cz) ?? [];
  const objects = [], startX = cx * CHUNK, startZ = cz * CHUNK;
  const endX = Math.min(config.size, startX + CHUNK), endZ = Math.min(config.size, startZ + CHUNK);
  const sample = (x, z) => Math.round(z) * stride + Math.round(x);
  const vacant = (x, z, radius) => !roads.has(sample(x, z)) &&
    !districts.some(bounds => insideFort(bounds, x, z, 2.7 + radius * .6)) &&
    !nearby.some(b => Math.hypot(b.x - x, b.z - z) < b.footprint * .68 + radius) &&
    !forts.some(bounds => insideFortFootprint(bounds, x, z, .25 + radius)) &&
    !fields.some(f => Math.abs(f.x - x) < 2.7 + radius && Math.abs(f.z - z) < 2.7 + radius);
  for (let gz = Math.floor(startZ / pitch); gz <= endZ / pitch; gz++) {
    for (let gx = Math.floor(startX / pitch); gx <= endX / pitch; gx++) {
      const h = stream => hash(config.seed, gx, gz, stream);
      const x = resourceCoordinate(config.seed, gx, gz, 1, gx);
      const z = resourceCoordinate(config.seed, gx, gz, 2, gz);
      if (x < startX || z < startZ || x >= endX || z >= endZ) continue;
      const i = sample(x, z), land = BIOMES[biome[i]];
      if (distance[i] < 2 || slope[i] > .66 || !vacant(x, z, 1.4)) continue;
      const y = gridSample(ground, stride, x, z);
      if (h(3) < land.density * config.vegetation * 1.33) {
        const species = land.trees[Math.floor(h(4) * land.trees.length)];
        const age = 5 + Math.floor(h(5) ** .8 * 108);
        const scale = clamp(.39 + Math.sqrt(age / 103) * .57 + h(6) * .13, .4, 1.12);
        const radius = SPECIES[species].radius * scale;
        objects.push({ id: 't:' + gx + ':' + gz, kind: 'tree', x, y, z, species, age, scale, radius,
          variant: Math.floor(h(7) * 5), rotation: h(8) * Math.PI * 2 });
      } else if (h(9) < (biome[i] === 7 ? .64 : .115)) {
        objects.push({ id: 'r:' + gx + ':' + gz, kind: 'rock', x, y, z,
          scale: .38 + h(10) * 1.03, variant: Math.floor(h(11) * 5), rotation: h(12) * Math.PI * 2 });
      }
    }
  }
  if (resourcesOnly) return objects;
  for (const plot of fields) for (let dx = -1.85; dx <= 2; dx += 1) {
    for (let dz = -1.8; dz <= 1.9; dz += .55) {
      const x = plot.x + dx, z = plot.z + dz;
      if (x < startX || x >= endX || z < startZ || z >= endZ) continue;
      const h = hash(config.seed, Math.round(x * 10), Math.round(z * 10), 84);
      objects.push({ id: 'crop:' + x + ':' + z, kind: 'crop', x, z,
        y: gridSample(ground, stride, x, z), scale: .75 + h * .53, variant: Math.floor(h * 3), rotation: h * 4 });
    }
  }
  for (let dz = 0; dz < endZ - startZ; dz++) for (let dx = 0; dx < endX - startX; dx++) {
    const px = startX + dx, pz = startZ + dz;
    const x = px + hash(config.seed, px, pz, 41), z = pz + hash(config.seed, px, pz, 42);
    const i = sample(x, z);
    const h = hash(config.seed, px, pz, 43);
    if (distance[i] === 0 || biome[i] >= 7 && biome[i] <= 9 || slope[i] > .59 ||
      h > config.vegetation * .36 || !vacant(x, z, .04)) continue;
    const kind = distance[i] <= 2 ? 'reed' : h < .025 ? 'shrub' : h < .085 ? 'flower' : 'grass';
    objects.push({ id: 'p:' + px + ':' + pz, kind, x, z, y: gridSample(ground, stride, x, z),
      scale: .55 + hash(config.seed, px, pz, 44) * .72,
      variant: Math.floor(hash(config.seed, px, pz, 45) * 5), rotation: h * 87 });
  }
  return objects;
}

export function findResource(world, index, id) {
  const match = typeof id === 'string' && /^[tr]:(\d+):(\d+)$/.exec(id);
  if (!match) return undefined;
  const gx = Number(match[1]), gz = Number(match[2]);
  const { seed, size } = world.config;
  const x = resourceCoordinate(seed, gx, gz, 1, gx), z = resourceCoordinate(seed, gx, gz, 2, gz);
  if (x >= size || z >= size) return undefined;
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
  return chunkObjects(world, index, cx, cz, { resourcesOnly: true }).find(resource => resource.id === id);
}
