import { CHUNK } from './catalog.js';
import { immutableCopy } from './read-only.js';

export const chunkKey = (x, z) => Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK);

export function addToChunk(index, key, value) {
  if (!index.has(key)) index.set(key, []);
  index.get(key).push(value);
}

export function indexBounds(index, value, { minX, maxX, minZ, maxZ }, margin = 0) {
  for (let cz = Math.floor((minZ - margin) / CHUNK); cz <= Math.floor((maxZ + margin) / CHUNK); cz++) {
    for (let cx = Math.floor((minX - margin) / CHUNK); cx <= Math.floor((maxX + margin) / CHUNK); cx++) {
      addToChunk(index, cx + ',' + cz, value);
    }
  }
}

function readOnlyBuckets(buckets) {
  for (const bucket of buckets.values()) Object.freeze(bucket);
  return Object.freeze({ get: key => buckets.get(key) });
}

export function indexTowns(world) {
  const roads = new Set(), paved = new Set(), buildings = new Map(), defenses = new Map(), yards = new Map();
  const fields = new Map(), districts = new Map();
  for (const town of world.towns) {
    for (const r of town.roads) roads.add(r);
    for (const r of town.paved ?? []) paved.add(r);
    for (const building of town.buildings) {
      const key = chunkKey(building.x, building.z);
      addToChunk(buildings, key, immutableCopy(building));
    }
    for (const field of town.fields) {
      indexBounds(fields, immutableCopy(field),
        { minX: field.x, maxX: field.x, minZ: field.z, maxZ: field.z }, 4.1);
    }
    if (town.cityWall) {
      indexBounds(districts, Object.freeze({ ...town.cityWall.bounds }), town.cityWall.bounds, 3.54);
      for (const piece of town.cityWall.pieces) {
        addToChunk(defenses, chunkKey(piece.x, piece.z), immutableCopy(piece));
      }
      addToChunk(defenses, chunkKey(town.palace.x, town.palace.z), immutableCopy(town.palace));
    }
    if (!town.fort) continue;
    for (const piece of town.fort.pieces) {
      addToChunk(defenses, chunkKey(piece.x, piece.z), immutableCopy(piece));
    }
    indexBounds(yards, Object.freeze({ ...town.fort.bounds }), town.fort.bounds, 4);
  }
  return Object.freeze({
    roads: Object.freeze({ has: cell => roads.has(cell) }),
    paved: Object.freeze({ has: cell => paved.has(cell) }),
    buildings: readOnlyBuckets(buildings), defenses: readOnlyBuckets(defenses),
    yards: readOnlyBuckets(yards), fields: readOnlyBuckets(fields), districts: readOnlyBuckets(districts)
  });
}
