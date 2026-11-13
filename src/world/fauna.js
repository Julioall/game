import { FAUNA_SPECIES, SMALL_FAUNA } from './fauna-catalog.js';
export { FAUNA_SPECIES, SMALL_FAUNA } from './fauna-catalog.js';
import { CHUNK } from './catalog.js';

import { gridSample, hash } from './math.js';

export const FAUNA_GENERATOR_VERSION = 1;

export const FAUNA_CELL_SIZE = 8;

// All 24 species retain the habitat weights from Kingdom Fauna Lab.

function fieldValue(field, index) {
  return ArrayBuffer.isView(field) || Array.isArray(field) ? field[index] : field.at(index);
}

function chooseSpecies(biome, value, allowed) {
  const entries = Object.entries(FAUNA_SPECIES).filter(
    ([id, profile]) => (!allowed || allowed.has(id)) && (profile.biomes[biome] ?? 0) > 0
  );

  const total = entries.reduce((sum, [, profile]) => sum + profile.biomes[biome], 0);

  if (!total) return null;

  let remaining = value * total;

  for (const [id, profile] of entries) {
    remaining -= profile.biomes[biome];

    if (remaining <= 0) return id;
  }

  return entries.at(-1)[0];
}

/** Deterministic, render-only wildlife candidates for one 32 m chunk. */

export function generateChunkFauna(
  world,
  cx,
  cz,
  { density = 0.22, maxPerChunk = 4, allowedSpecies = null, blocked = () => false } = {}
) {
  if (!Number.isInteger(cx) || !Number.isInteger(cz) || cx < 0 || cz < 0)
    throw new RangeError('Chunk inválido');

  if (!Number.isFinite(density) || density < 0 || density > 1)
    throw new RangeError('densidade deve ser 0..1');

  if (!Number.isInteger(maxPerChunk) || maxPerChunk < 0) throw new RangeError('maxPerChunk inválido');

  if (typeof blocked !== 'function') throw new TypeError('blocked deve ser uma função');

  const { config, stride, ground, biome, slope, wet } = world;

  if (!config || !Number.isInteger(stride) || !ground || !biome || !slope || !wet) {
    throw new TypeError('Campos do mundo ausentes');
  }

  if (maxPerChunk === 0) return [];

  const allowed = allowedSpecies ? new Set(allowedSpecies) : null;

  const startX = cx * CHUNK,
    startZ = cz * CHUNK;

  const endX = Math.min(config.size, startX + CHUNK),
    endZ = Math.min(config.size, startZ + CHUNK);

  const firstX = Math.floor(startX / FAUNA_CELL_SIZE),
    firstZ = Math.floor(startZ / FAUNA_CELL_SIZE);

  const lastX = Math.ceil(endX / FAUNA_CELL_SIZE),
    lastZ = Math.ceil(endZ / FAUNA_CELL_SIZE);

  const candidates = [];

  for (let gz = firstZ; gz < lastZ; gz++)
    for (let gx = firstX; gx < lastX; gx++) {
      const seed = config.seed >>> 0;

      if (hash(seed, gx, gz, 101) >= density) continue;

      const x = gx * FAUNA_CELL_SIZE + 1.25 + hash(seed, gx, gz, 102) * 5.5;

      const z = gz * FAUNA_CELL_SIZE + 1.25 + hash(seed, gx, gz, 103) * 5.5;

      if (x < startX || z < startZ || x >= endX || z >= endZ) continue;

      const ix = Math.round(x),
        iz = Math.round(z),
        i = iz * stride + ix;

      const type = fieldValue(biome, i);
      if (type === 0 && fieldValue(wet, i) <= 0) continue;

      if (fieldValue(slope, i) > 0.64 && type !== 0) continue;

      const species = chooseSpecies(type, hash(seed, gx, gz, 104), allowed);

      if (species && ['fish', 'shark'].includes(species) && !aquaticHabitat(world, species, x, z)) continue;
      if (
        !species ||
        (type !== 0 && (fieldValue(wet, i) > 0 || blocked(x, z, FAUNA_SPECIES[species].clearance)))
      )
        continue;

      candidates.push({
        rank: hash(seed, gx, gz, 107),

        record: {
          id: `fa:${FAUNA_GENERATOR_VERSION}:${seed}:${gx}:${gz}`,

          kind: 'animal',
          species,

          seed: Math.floor(hash(seed, gx, gz, 105) * 0x100000000) >>> 0,

          x,
          y: gridSample(type === 0 ? world.surface : ground, stride, x, z),
          z,

          heading: hash(seed, gx, gz, 106) * Math.PI * 2,

          biome: type,

          homeChunk: `${cx},${cz}`
        }
      });
    }

  return candidates
    .sort((a, b) => a.rank - b.rank)
    .slice(0, maxPerChunk)
    .map((item) => item.record);
}

/** Chunk-local lookup; a camera query visits only buckets under its view radius. */

export class FaunaSpatialIndex {
  constructor() {
    this.chunks = new Map();

    this.total = 0;

    this.lastQuery = { items: [], chunksVisited: 0, candidatesVisited: 0, indexed: 0 };
  }

  set(key, records) {
    const previous = this.chunks.get(key);

    if (previous) this.total -= previous.length;

    const next = records ?? [];

    if (next.length) this.chunks.set(key, next);
    else this.chunks.delete(key);

    this.total += next.length;
  }

  remove(key) {
    const previous = this.chunks.get(key);

    if (!previous) return false;

    this.total -= previous.length;

    this.chunks.delete(key);

    return true;
  }

  query(x, z, radius) {
    if (![x, z, radius].every(Number.isFinite) || radius < 0)
      throw new RangeError('Consulta de fauna invÃ¡lida');

    const minX = Math.floor((x - radius) / CHUNK),
      maxX = Math.floor((x + radius) / CHUNK);

    const minZ = Math.floor((z - radius) / CHUNK),
      maxZ = Math.floor((z + radius) / CHUNK);

    const radiusSq = radius * radius,
      items = [];

    let chunksVisited = 0,
      candidatesVisited = 0;

    for (let cz = minZ; cz <= maxZ; cz++)
      for (let cx = minX; cx <= maxX; cx++) {
        chunksVisited++;

        const records = this.chunks.get(`${cx},${cz}`);

        if (!records) continue;

        for (const record of records) {
          candidatesVisited++;

          const dx = record.x - x,
            dz = record.z - z,
            d2 = dx * dx + dz * dz;

          if (d2 <= radiusSq) items.push({ record, d2 });
        }
      }

    items.sort((a, b) => a.d2 - b.d2 || a.record.id.localeCompare(b.record.id));

    this.lastQuery = { items, chunksVisited, candidatesVisited, indexed: this.total };

    return this.lastQuery;
  }
}

export function aquaticHabitat(world, species, x, z) {
  const i = Math.round(z) * world.stride + Math.round(x);
  if (fieldValue(world.wet, i) <= 0) return false;
  if (species === 'shark') return world.waterKind && fieldValue(world.waterKind, i) === 1;
  if (species === 'fish') return world.lake && fieldValue(world.lake, i) === 2;
  return true;
}

export const FAUNA_POPULATION_SIZE = 1024;
export function faunaPopulationTargets(total = FAUNA_POPULATION_SIZE) {
  const predators = new Set(['wolf', 'bear', 'eagle', 'lion', 'cheetah', 'shark']);
  const rows = Object.keys(FAUNA_SPECIES).map((species) => ({
    species,
    minimum: SMALL_FAUNA.has(species) ? 10 : 5,
    weight: SMALL_FAUNA.has(species) ? 3 : predators.has(species) ? 0.6 : 1.5
  }));
  const extra = total - rows.reduce((sum, r) => sum + r.minimum, 0);
  if (extra < 0) throw new RangeError('Population below species minimums');
  const weights = rows.reduce((sum, r) => sum + r.weight, 0);
  const targets = {};
  let allocated = 0;
  for (const row of rows) {
    const share = (extra * row.weight) / weights;
    row.fraction = share - Math.floor(share);
    targets[row.species] = row.minimum + Math.floor(share);
    allocated += targets[row.species];
  }
  rows.sort((a, b) => b.fraction - a.fraction || a.species.localeCompare(b.species));
  for (let i = 0; i < total - allocated; i++) targets[rows[i].species]++;
  return targets;
}

/** Stable minimum population for the whole map; independent of camera streaming. */
export function generateFaunaPopulation(world, blocked = () => false) {
  const records = [],
    missing = {};
  const targets = faunaPopulationTargets();
  const buckets = new Map(),
    chunkCounts = new Map();
  const spacing = Math.max(2, Math.min(7, world.config.size / 250));
  const near = (x, z) => {
    const cx = Math.floor(x / spacing),
      cz = Math.floor(z / spacing);
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++)
        if (
          (buckets.get(`${cx + dx},${cz + dz}`) ?? []).some(
            (r) => (r.x - x) ** 2 + (r.z - z) ** 2 < spacing ** 2
          )
        )
          return true;
    return false;
  };
  const { seed, size } = world.config;
  const springs = [];
  if (world.lake)
    for (let z = 2; z < size - 2; z++)
      for (let x = 2; x < size - 2; x++) {
        const i = z * world.stride + x;
        if (fieldValue(world.lake, i) === 2 && fieldValue(world.wet, i) > 0) springs.push({ x, z });
      }
  for (const [species, profile] of Object.entries(FAUNA_SPECIES)) {
    const target = targets[species];
    const aquatic = ['fish', 'shark'].includes(species);
    let count = 0;
    for (let attempt = 0; attempt < 160000 && count < target; attempt++) {
      const stream = Object.keys(FAUNA_SPECIES).indexOf(species) + 400;
      if (species === 'fish' && !springs.length) break;
      const spring =
        species === 'fish' ? springs[Math.floor(hash(seed, attempt, stream, 1) * springs.length)] : null;
      const x = spring ? spring.x : 3 + hash(seed, attempt, stream, 1) * (size - 6);
      const z = spring ? spring.z : 3 + hash(seed, attempt, stream, 2) * (size - 6);
      const i = Math.round(z) * world.stride + Math.round(x);
      const wet = fieldValue(world.wet, i) > 0;
      if (wet !== aquatic || (!aquatic && fieldValue(world.slope, i) > 0.55)) continue;
      if (aquatic && !aquaticHabitat(world, species, x, z)) continue;
      const biome = fieldValue(world.biome, i);
      // Prefer each species' habitat; rare/missing biomes fall back to safe terrain.
      if (!aquatic && attempt < 120000 && !profile.biomes[biome]) continue;
      const chunk = `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
      if ((chunkCounts.get(chunk) ?? 0) >= 24 || blocked(x, z, profile.clearance) || near(x, z)) continue;
      records.push({
        id: `population:1:${seed}:${species}:${count}`,
        kind: 'animal',
        species,
        seed: Math.floor(hash(seed, attempt, stream, 3) * 0x100000000) >>> 0,
        x,
        z,
        y: gridSample(aquatic ? world.surface : world.ground, world.stride, x, z),
        heading: hash(seed, attempt, stream, 4) * Math.PI * 2,
        biome,
        homeChunk: `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`
      });
      const record = records.at(-1),
        cell = `${Math.floor(x / spacing)},${Math.floor(z / spacing)}`;
      if (!buckets.has(cell)) buckets.set(cell, []);
      buckets.get(cell).push(record);
      chunkCounts.set(chunk, (chunkCounts.get(chunk) ?? 0) + 1);
      count++;
    }
    if (count < target) missing[species] = target - count;
  }
  return { records, missing, targets };
}
