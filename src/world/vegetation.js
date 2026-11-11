import { BIOMES, CHUNK, HEADWATER_GROVE_RADIUS, SPECIES } from './catalog.js';
import { clamp, gridSample, hash, smooth } from './math.js';
import { insideFort, insideFortFootprint } from './fortifications.js';

const pitch = 3.35;

function resourceCoordinate(seed, gx, gz, stream, cell) {
  return (cell + .38 + hash(seed, gx, gz, stream) * .24) * pitch;
}

export function chunkObjects(world, townIndex, cx, cz, { resourcesOnly = false } = {}) {
  const { config, stride, ground, distance, biome, slope } = world;
  const distanceAt = ArrayBuffer.isView(distance) ? i => distance[i] : distance.at;
  const biomeAt = ArrayBuffer.isView(biome) ? i => biome[i] : biome.at;
  const slopeAt = ArrayBuffer.isView(slope) ? i => slope[i] : slope.at;
  const { roads, buildings, yards } = townIndex;
  const key = cx + ',' + cz;
  const fields = townIndex.fields.get(key) ?? [], districts = townIndex.districts.get(key) ?? [];
  const headwaters = townIndex.headwaters?.get(key) ?? [];
  const nearby = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    nearby.push(...(buildings.get((cx + dx) + ',' + (cz + dz)) ?? []));
  }
  const forts = yards.get(key) ?? [];
  const objects = [], startX = cx * CHUNK, startZ = cz * CHUNK;
  const endX = Math.min(config.size, startX + CHUNK), endZ = Math.min(config.size, startZ + CHUNK);
  const sample = (x, z) => Math.round(z) * stride + Math.round(x);
  const vacant = (x, z, radius) => !roads.has(sample(x, z)) &&
    !districts.some(bounds => insideFort(bounds, x, z, 2.7 + radius * .6)) &&
    !nearby.some(b => Math.hypot(b.x - x, b.z - z) < b.footprint * .68 + radius) &&
    !forts.some(bounds => insideFortFootprint(bounds, x, z, .25 + radius)) &&
    !fields.some(f => Math.abs(f.x - x) < 2.7 + radius && Math.abs(f.z - z) < 2.7 + radius);
  const layers = config.hydrology >= 4 && headwaters.length ? [0, 1] : [0];
  for (const layer of layers) {
    for (let gz = Math.floor(startZ / pitch) - layer; gz <= endZ / pitch; gz++) {
      for (let gx = Math.floor(startX / pitch) - layer; gx <= endX / pitch; gx++) {
        if (gx < 0 || gz < 0) continue;
        const h = stream => hash(config.seed, gx, gz, stream + layer * 128);
        const x = resourceCoordinate(config.seed, gx, gz, 1, gx) + layer * pitch * .5;
        const z = resourceCoordinate(config.seed, gx, gz, 2, gz) + layer * pitch * .5;
        if (x < startX || z < startZ || x >= endX || z >= endZ) continue;
        const i = sample(x, z), type = biomeAt(i);
        if (distanceAt(i) < 2 || slopeAt(i) > .66 || !vacant(x, z, 1.4)) continue;
        const land = BIOMES[type];
        const grove = headwaters.some(source => (source.x - x) ** 2 + (source.z - z) ** 2 < HEADWATER_GROVE_RADIUS ** 2);
        if (layer && (!grove || !land.trees.length)) continue;
        const y = gridSample(ground, stride, x, z);
        const treeChance = layer ? smooth(0, .68, config.vegetation) * .95
          : grove && land.trees.length ? config.vegetation * .86 : land.density * config.vegetation * 1.33;
        if (h(3) < treeChance) {
          const species = land.trees[Math.floor(h(4) * land.trees.length)];
          const matureGrove = grove && config.hydrology >= 4;
          const age = (matureGrove ? 65 : 5) + Math.floor(h(5) ** .8 * (matureGrove ? 70 : 108));
          const scale = clamp(.39 + Math.sqrt(age / 103) * .57 + h(6) * .13, .4, matureGrove ? 1.2 : 1.12);
          const radius = SPECIES[species].radius * scale;
          objects.push({ id: (layer ? 'st:' : 't:') + gx + ':' + gz, kind: 'tree', x, y, z, species, age, scale, radius,
            variant: Math.floor(h(7) * 5), rotation: h(8) * Math.PI * 2 });
        } else if (!layer && h(9) < (grove ? .8 : type === 7 ? .64 : .115)) {
          objects.push({ id: 'r:' + gx + ':' + gz, kind: 'rock', x, y, z,
            scale: grove ? .68 + h(10) * 1.09 : .38 + h(10) * 1.03,
            variant: Math.floor(h(11) * 5), rotation: h(12) * Math.PI * 2 });
        }
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
    const i = sample(x, z), type = biomeAt(i), shore = distanceAt(i);
    const h = hash(config.seed, px, pz, 43);
    if (shore === 0 || type >= 7 && type <= 9 || slopeAt(i) > .59 ||
      h > config.vegetation * .36 || !vacant(x, z, .04)) continue;
    const kind = shore <= 2 ? 'reed' : h < .025 ? 'shrub' : h < .085 ? 'flower' : 'grass';
    objects.push({ id: 'p:' + px + ':' + pz, kind, x, z, y: gridSample(ground, stride, x, z),
      scale: .55 + hash(config.seed, px, pz, 44) * .72,
      variant: Math.floor(hash(config.seed, px, pz, 45) * 5), rotation: h * 87 });
  }
  return objects;
}

export function findResource(world, index, id) {
  const match = typeof id === 'string' && /^(st|[tr]):(\d+):(\d+)$/.exec(id);
  if (!match) return undefined;
  const gx = Number(match[2]), gz = Number(match[3]);
  const offset = match[1] === 'st' ? pitch * .5 : 0;
  const { seed, size } = world.config;
  const x = resourceCoordinate(seed, gx, gz, 1, gx) + offset, z = resourceCoordinate(seed, gx, gz, 2, gz) + offset;
  if (x >= size || z >= size) return undefined;
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
  return chunkObjects(world, index, cx, cz, { resourcesOnly: true }).find(resource => resource.id === id);
}
