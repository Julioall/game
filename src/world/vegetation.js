import { BIOMES, CHUNK, HEADWATER_GROVE_RADIUS, SPECIES } from './catalog.js';
import { clamp, gridSample, hash, smooth } from './math.js';
import { insideFort, insideFortFootprint } from './fortifications.js';
import { treeFlora } from './flora-biomes.js';
import { groundcoverModel } from './groundcover.js';
import { floraClimateAt } from './flora-climate.js';

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
  const layers = config.hydrology >= 4 && headwaters.length ? [0, 1, 2] : [0, 2];
  for (const layer of layers) {
    for (let gz = Math.floor(startZ / pitch) - layer; gz <= endZ / pitch; gz++) {
      for (let gx = Math.floor(startX / pitch) - layer; gx <= endX / pitch; gx++) {
        if (gx < 0 || gz < 0) continue;
        const h = stream => hash(config.seed, gx, gz, stream + layer * 128);
        const offset = layer === 2 ? pitch * .5 : layer * pitch * .5;
        const x = resourceCoordinate(config.seed, gx, gz, 1, gx) + offset;
        const z = resourceCoordinate(config.seed, gx, gz, 2, gz) + offset;
        if (x < startX || z < startZ || x >= endX || z >= endZ) continue;
        const i = sample(x, z), type = biomeAt(i);
        if (distanceAt(i) < 2 || slopeAt(i) > .66 || !vacant(x, z, 1.4)) continue;
        const land = BIOMES[type];
        const grove = headwaters.some(source => (source.x - x) ** 2 + (source.z - z) ** 2 < HEADWATER_GROVE_RADIUS ** 2);
        if (layer === 1 && (!grove || !land.trees.length)) continue;
        let thicket = 0;
        if (layer === 2) {
          if (![3, 4, 9, 10, 11].includes(type) || !land.trees.length || config.vegetation <= 0) continue;
          const nx = x / 36, nz = z / 36, ix = Math.floor(nx), iz = Math.floor(nz);
          const u = smooth(0, 1, nx-ix), v = smooth(0, 1, nz-iz);
          const n = (a, b) => hash(config.seed, a, b, 2200);
          const patch = (n(ix, iz)*(1-u)+n(ix+1, iz)*u)*(1-v)
            + (n(ix, iz+1)*(1-u)+n(ix+1, iz+1)*u)*v;
          thicket = smooth(.38, .64, patch);
          if (!thicket || grove) continue;
        }
        const y = gridSample(ground, stride, x, z);
        const treeChance = layer === 2 ? thicket * smooth(0, .4, config.vegetation) * .94
          : layer ? smooth(0, .68, config.vegetation) * .95
          : grove && land.trees.length ? config.vegetation * .86 : land.density * config.vegetation * 1.33;
        if (h(3) < treeChance) {
          const species = land.trees[Math.floor(h(4) * land.trees.length)];
          const matureGrove = grove && config.hydrology >= 4;
          const age = (matureGrove ? 65 : 5) + Math.floor(h(5) ** .8 * (matureGrove ? 70 : 108));
          const scale = clamp(.39 + Math.sqrt(age / 103) * .57 + h(6) * .13, .4, matureGrove ? 1.2 : 1.12);
          const radius = SPECIES[species].radius * scale;
          const tree = { id: (layer === 2 ? 'dt:' : layer ? 'st:' : 't:') + gx + ':' + gz, kind: 'tree', x, y, z, species, age, scale, radius,
            variant: Math.floor(h(7) * 5), rotation: h(8) * Math.PI * 2 };
          tree.flora = treeFlora(world, tree);
          objects.push(tree);
        } else if (!layer && h(9) < (grove ? .8 : type === 7 ? .64 : .115)) {
          const rockStyle = type === 8 || type === 9 ? 'snow' : type === 10 || type === 11 ? 'moss' : 'plain';
          const rockStream = rockStyle === 'snow' ? 62 : rockStyle === 'moss' ? 61 : 60;
          objects.push({ id: 'r:' + gx + ':' + gz, kind: 'rock', x, y, z,
            scale: grove ? .68 + h(10) * 1.09 : .38 + h(10) * 1.03,
            variant: Math.floor(hash(config.seed, Math.floor(x / 64), Math.floor(z / 64), rockStream) * 7),
            rockStyle,
            rotation: h(12) * Math.PI * 2 });
        }
      }
    }
  }
  if (resourcesOnly) return objects;
  const coverAnchors = new Map();
  for (const object of objects) {
    const key = Math.floor(object.x / 8) + ',' + Math.floor(object.z / 8);
    if (!coverAnchors.has(key)) coverAnchors.set(key, []);
    coverAnchors.get(key).push(object);
  }
  const coverCache = new Map();
  const coverSample = (x, z) => {
    const key = x + ',' + z;
    if (coverCache.has(key)) return coverCache.get(key);
    const nx = x / 13, nz = z / 13, ix = Math.floor(nx), iz = Math.floor(nz);
    const u = smooth(0, 1, nx - ix), v = smooth(0, 1, nz - iz);
    const n = (a, b) => hash(config.seed, a, b, 1810);
    const noise = (n(ix, iz) * (1-u) + n(ix+1, iz) * u) * (1-v)
      + (n(ix, iz+1) * (1-u) + n(ix+1, iz+1) * u) * v;
    let strength = smooth(.36, .59, noise);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      if (roads.has(sample(x + dx, z + dz))) strength *= smooth(.5, 2.6, Math.hypot(dx, dz));
    }
    const ax = Math.floor(x / 8), az = Math.floor(z / 8);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      for (const anchor of coverAnchors.get((ax+dx) + ',' + (az+dz)) ?? []) {
        const d = Math.hypot(x-anchor.x, z-anchor.z);
        const radius = anchor.kind === 'tree' ? anchor.radius : anchor.scale;
        if (d > radius + 2) continue;
        const shade = anchor.kind === 'tree' && anchor.age > 70;
        if (shade) strength *= .18 + .82 * smooth(radius * .3, radius, d);
        else strength = Math.min(1, strength + .25 * (1-smooth(radius, radius+2, d)));
      }
    }
    coverCache.set(key, strength);
    return strength;
  };
  const coverAt = (x, z) => {
    const ix = Math.floor(x), iz = Math.floor(z), u = x - ix, v = z - iz;
    return (coverSample(ix, iz) * (1-u) + coverSample(ix+1, iz) * u) * (1-v)
      + (coverSample(ix, iz+1) * (1-u) + coverSample(ix+1, iz+1) * u) * v;
  };
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
    // Independent cover selection avoids making every sparse patch a shrub.
    // Broad interpolated patches keep neighbouring plants visually related.
    const patchX = Math.floor(x / 24), patchZ = Math.floor(z / 24);
    const u = smooth(0, 1, x / 24 - patchX), v = smooth(0, 1, z / 24 - patchZ);
    const noise = (a, b) => hash(config.seed, a, b, 850);
    const patch = (noise(patchX, patchZ) * (1 - u) + noise(patchX + 1, patchZ) * u) * (1 - v)
      + (noise(patchX, patchZ + 1) * (1 - u) + noise(patchX + 1, patchZ + 1) * u) * v;
    // Restore the earlier solid green grass as an independent ground layer.
    if ([2, 3, 4, 10, 11].includes(type) && shore > 2 && slopeAt(i) <= .59 && vacant(x, z, .04)) {
      // Packed independent placements keep the denser layer out of the JS object list.
      const placements = [[], [], []];
      const probability = config.vegetation * .8 * (.35 + patch * .9);
      for (let plant = 0; plant < 30; plant++) {
        if (hash(config.seed, px, pz, 1104 + plant * 6) >= probability) continue;
        const gx = px + hash(config.seed, px, pz, 1100 + plant * 6);
        const gz = pz + hash(config.seed, px, pz, 1101 + plant * 6);
        const coverStrength = coverAt(gx, gz);
        if (hash(config.seed, px, pz, 1910 + plant) >= coverStrength) continue;
        const gi = sample(gx, gz);
        if (biomeAt(gi) !== type || distanceAt(gi) <= 2 || slopeAt(gi) > .59 || !vacant(gx, gz, .04)) continue;
        const variant = Math.floor(hash(config.seed, px, pz, 1105 + plant * 6) * 3);
        placements[variant].push(gx, gridSample(ground, stride, gx, gz), gz,
          (.4 + hash(config.seed, px, pz, 1102 + plant * 6) * .65) * (.5 + coverStrength * .5),
          (.3 + hash(config.seed, px, pz, 1103 + plant * 6) * .55) * (.5 + coverStrength * .5),
          plant * 2.39996 + h * 87);
      }
      for (let variant = 0; variant < placements.length; variant++) {
        if (!placements[variant].length) continue;
        objects.push({ id: 'gp:' + px + ':' + pz + ':' + variant, kind: 'grass', biome: type, classicGrass: true,
          grassPlacements: Float32Array.from(placements[variant]),
          x, z, y: gridSample(ground, stride, x, z),
          scale: 1, heightScale: 1, variant, rotation: h * 87 });
      }
    }
    const cover = type === 2 ? .52 : type === 4 ? .72 : type === 3 ? .56 : type === 6 ? .035 : type === 5 ? .12 : type === 1 ? .025 : .36;
    const snowCover = type === 8 && hash(config.seed, px, pz, 46) < .0025;
    if (hash(config.seed, px, pz, 1911) >= coverAt(x, z)) continue;
    const snowyWood = type === 8 && hash(config.seed, px, pz, 47) < .0002;
    if (shore === 0 || type >= 7 && type <= 9 && !snowCover && !snowyWood || slopeAt(i) > .59 ||
      h > config.vegetation * cover * (.35 + patch * 1.3) || !vacant(x, z, .04)) continue;
    const choice = hash(config.seed, px, pz, 851);
    let kind = snowCover ? 'shrub' : shore <= 2 ? 'reed'
      : type === 4 ? (choice < .12 ? 'shrub' : choice < .22 ? 'reed' : 'grass')
      : type === 6 ? (choice < .65 ? 'shrub' : 'grass')
      : choice < .06 ? 'shrub' : choice < .18 ? 'flower' : 'grass';
    if (snowyWood || !snowCover && shore > 2 && [2, 3, 4, 10, 11].includes(type) &&
      hash(config.seed, px, pz, 48) < .0002)
      kind = hash(config.seed, px, pz, 49) < .5 ? 'stump' : 'log';
    objects.push({ id: 'p:' + px + ':' + pz, kind, biome: type, x, z, y: gridSample(ground, stride, x, z),
      scale: .55 + hash(config.seed, px, pz, 44) * .72,
      variant: Math.floor(hash(config.seed, px, pz, 45) * 5), rotation: h * 87 });
    // Separate grass plants, each placed and validated on the terrain.
    if (kind === 'grass' && (type === 3 || type === 4)) {
      const plants = 1 + Math.floor(patch * 18);
      for (let tuft = 1; tuft < plants; tuft++) {
        const tx = px + hash(config.seed, px, pz, 860 + tuft * 3);
        const tz = pz + hash(config.seed, px, pz, 861 + tuft * 3);
        const ti = sample(tx, tz);
        if (hash(config.seed, px, pz, 1940 + tuft) >= coverAt(tx, tz)) continue;
        if (biomeAt(ti) !== type || distanceAt(ti) === 0 || slopeAt(ti) > .59 || !vacant(tx, tz, .04)) continue;
        objects.push({ id: 'pg:' + px + ':' + pz + ':' + tuft, kind: 'grass', biome: type,
          x: tx, z: tz, y: gridSample(ground, stride, tx, tz),
          scale: .35 + hash(config.seed, px, pz, 862 + tuft * 3) * .8,
          heightScale: .45 + hash(config.seed, px, pz, 960 + tuft) * 1.1,
          variant: Math.floor(hash(config.seed, px, pz, 45) * 5), rotation: tuft * 2.39996 + h * 87 });
      }
    }
  }
  for (const object of objects) {
    if (object.biome !== undefined) {
      object.plantModel = object.classicGrass ? undefined
        : groundcoverModel(config.seed, object.x, object.z, object.biome, object.kind, object.variant);
      if (['grass', 'flower', 'reed', 'shrub'].includes(object.kind))
        object.plantWarmth = floraClimateAt(world, object.x, object.z).temperature;
    }
  }
  return objects;
}

export function findResource(world, index, id) {
  const match = typeof id === 'string' && /^(dt|st|[tr]):(\d+):(\d+)$/.exec(id);
  if (!match) return undefined;
  const gx = Number(match[2]), gz = Number(match[3]);
  const offset = ['st', 'dt'].includes(match[1]) ? pitch * .5 : 0;
  const { seed, size } = world.config;
  const x = resourceCoordinate(seed, gx, gz, 1, gx) + offset, z = resourceCoordinate(seed, gx, gz, 2, gz) + offset;
  if (x >= size || z >= size) return undefined;
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
  return chunkObjects(world, index, cx, cz, { resourcesOnly: true }).find(resource => resource.id === id);
}
