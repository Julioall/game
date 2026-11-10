import { CHUNK } from './catalog.js';

export const chunkKey = (x, z) => Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK);

export function indexTowns(world) {
  const roads = new Set(), paved = new Set(), buildings = new Map(), defenses = new Map(), yards = new Map(), fields = [];
  const districts = [];
  const add = (map, key, item) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  };
  for (const town of world.towns) {
    for (const r of town.roads) roads.add(r);
    for (const r of town.paved ?? []) paved.add(r);
    for (const building of town.buildings) {
      const key = chunkKey(building.x, building.z);
      add(buildings, key, building);
    }
    fields.push(...town.fields);
    if (town.cityWall) {
      districts.push(town.cityWall.bounds);
      for (const piece of town.cityWall.pieces) add(defenses, chunkKey(piece.x, piece.z), piece);
      add(defenses, chunkKey(town.palace.x, town.palace.z), town.palace);
    }
    if (!town.fort) continue;
    for (const piece of town.fort.pieces) add(defenses, chunkKey(piece.x, piece.z), piece);
    const { bounds } = town.fort;
    for (let cz = Math.floor((bounds.minZ - 4) / CHUNK); cz <= Math.floor((bounds.maxZ + 4) / CHUNK); cz++) {
      for (let cx = Math.floor((bounds.minX - 4) / CHUNK); cx <= Math.floor((bounds.maxX + 4) / CHUNK); cx++) {
        add(yards, cx + ',' + cz, bounds);
      }
    }
  }
  return { roads, paved, buildings, defenses, yards, fields, districts, allBuildings: [...buildings.values()].flat() };
}
