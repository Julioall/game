import { CHUNK } from './catalog.js';

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

export function indexTowns(world) {
  const roads = new Set(), paved = new Set(), buildings = new Map(), defenses = new Map(), yards = new Map();
  const fields = new Map(), districts = new Map();
  for (const town of world.towns) {
    for (const r of town.roads) roads.add(r);
    for (const r of town.paved ?? []) paved.add(r);
    for (const building of town.buildings) {
      const key = chunkKey(building.x, building.z);
      addToChunk(buildings, key, building);
    }
    for (const field of town.fields) {
      indexBounds(fields, field, { minX: field.x, maxX: field.x, minZ: field.z, maxZ: field.z }, 4.1);
    }
    if (town.cityWall) {
      indexBounds(districts, town.cityWall.bounds, town.cityWall.bounds, 3.54);
      for (const piece of town.cityWall.pieces) addToChunk(defenses, chunkKey(piece.x, piece.z), piece);
      addToChunk(defenses, chunkKey(town.palace.x, town.palace.z), town.palace);
    }
    if (!town.fort) continue;
    for (const piece of town.fort.pieces) addToChunk(defenses, chunkKey(piece.x, piece.z), piece);
    indexBounds(yards, town.fort.bounds, town.fort.bounds, 4);
  }
  return { roads, paved, buildings, defenses, yards, fields, districts };
}
