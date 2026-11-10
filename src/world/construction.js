import { CHUNK, STRUCTURES } from './catalog.js';
import { chunkKey, indexBounds } from './chunks.js';
import { insideFort, insideFortFootprint, TOWER_DIAMETER } from './fortifications.js';
import { buildable } from './terrain/placement.js';
import { chunkObjects } from './vegetation.js';

const { footprint, cost } = STRUCTURES.cabin;
const clearance = footprint * .64;
const fortMargin = footprint * .7;

export function constructionRules(world, townIndex) {
  const occupied = new Map(), forts = new Map(), palaces = new Map(), walls = new Map();
  const register = (object, radius = object.footprint ?? .8) => {
    const { x, z } = object;
    indexBounds(occupied, { x, z, radius }, { minX: x, maxX: x, minZ: z, maxZ: z }, radius + clearance);
  };
  for (const town of world.towns) {
    for (const building of town.buildings) register(building);
    for (const field of town.fields) register(field, 3.2);
    if (town.fort) indexBounds(forts, { ...town.fort.bounds }, town.fort.bounds, TOWER_DIAMETER / 2 + fortMargin);
    if (town.palace) indexBounds(palaces, { ...town.palace.bounds }, town.palace.bounds, fortMargin + 2);
    if (town.cityWall) indexBounds(walls, { ...town.cityWall.bounds }, town.cityWall.bounds, 3.4);
  }

  function hasResource(x, z, overlaps, isRemoved) {
    const lastChunk = Math.ceil(world.config.size / CHUNK) - 1;
    const first = center => Math.max(0, Math.floor((center - 4) / CHUNK));
    const last = center => Math.min(lastChunk, Math.floor((center + 4) / CHUNK));
    for (let cz = first(z); cz <= last(z); cz++) {
      for (let cx = first(x); cx <= last(x); cx++) {
        const resources = chunkObjects(world, townIndex, cx, cz, { resourcesOnly: true });
        if (resources.some(o => !isRemoved(o.id) && overlaps(o, o.radius ?? .8))) return true;
      }
    }
    return false;
  }

  return {
    register,
    placement(x, z, inventory, isRemoved) {
      if (!Number.isFinite(x) || !Number.isFinite(z)) return 'Procure um terreno firme e plano.';
      const key = chunkKey(x, z);
      if (forts.get(key)?.some(bounds => insideFortFootprint(bounds, x, z, fortMargin))) {
        return 'O castelo e seu pátio já estão ocupados.';
      }
      if (palaces.get(key)?.some(bounds => insideFort(bounds, x, z, fortMargin + 2))) {
        return 'O castelo central ocupa este terreno.';
      }
      if (walls.get(key)?.some(bounds => insideFort(bounds, x, z, 3.4) && !insideFort(bounds, x, z, -2.6))) {
        return 'A muralha da cidade ocupa este terreno.';
      }
      if (!buildable(world, x, z, footprint * .72)) return 'Procure um terreno firme e plano.';
      const i = Math.round(z) * world.stride + Math.round(x);
      const overlaps = (object, radius) => Math.hypot(x - object.x, z - object.z) < clearance + radius;
      if (townIndex.roads.has(i) || occupied.get(key)?.some(o => overlaps(o, o.radius)) ||
          hasResource(x, z, overlaps, isRemoved)) return 'Libere espaço e preserve os caminhos.';
      if (inventory.wood < cost.wood || inventory.stone < cost.stone) return 'A cabana requer 3 madeiras e 2 pedras.';
      return '';
    }
  };
}
