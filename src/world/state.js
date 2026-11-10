import { CHUNK, STRUCTURES, VERSION } from './catalog.js';
import { chunkKey, indexTowns } from './chunks.js';
import { chunkObjects, findResource } from './vegetation.js';
import { gridSample } from './math.js';
import { buildable } from './settlements.js';
import { insideFort, insideFortFootprint } from './fortifications.js';

export class WorldState {
  constructor(world, saved = {}) {
    this.world = world;
    this.index = indexTowns(world);
    this.removed = new Set(saved.removed ?? []);
    this.built = new Map();
    this.inventory = { wood: 0, stone: 0, ...saved.inventory };
    this.revision = 0;
    for (const building of saved.buildings ?? []) this.add(building);
  }

  add(building) {
    const key = chunkKey(building.x, building.z);
    if (!this.built.has(key)) this.built.set(key, []);
    this.built.get(key).push(building);
  }

  snapshot() {
    return { version: VERSION, removed: [...this.removed], buildings: [...this.built.values()].flat(),
      inventory: { ...this.inventory } };
  }

  harvest(id) {
    if (this.removed.has(id)) return null;
    const object = findResource(this.world, this.index, id);
    if (!object) return null;
    const key = object.kind === 'tree' ? 'wood' : 'stone';
    const amount = key === 'wood' ? 2 + Math.floor(object.age / 28) : 2 + Math.floor(object.scale * 2);
    this.removed.add(object.id);
    this.inventory[key] += amount;
    this.revision++;
    return { key, amount, chunk: chunkKey(object.x, object.z) };
  }

  #isOccupied(x, z, clearance) {
    const overlaps = (object, radius) => Math.hypot(x - object.x, z - object.z) < clearance + radius;
    const { world, index } = this;
    if (index.allBuildings.some(b => overlaps(b, b.footprint ?? .8)) ||
        index.fields.some(field => overlaps(field, 3.2))) return true;
    for (const chunk of this.built.values()) {
      if (chunk.some(b => overlaps(b, b.footprint ?? .8))) return true;
    }

    const lastChunk = Math.ceil(world.config.size / CHUNK) - 1;
    const first = center => Math.max(0, Math.floor((center - 4) / CHUNK));
    const last = center => Math.min(lastChunk, Math.floor((center + 4) / CHUNK));
    for (let cz = first(z); cz <= last(z); cz++) {
      for (let cx = first(x); cx <= last(x); cx++) {
        const resources = chunkObjects(world, index, cx, cz, { resourcesOnly: true });
        if (resources.some(o => !this.removed.has(o.id) && overlaps(o, o.radius ?? .8))) return true;
      }
    }
    return false;
  }

  placement(x, z) {
    const { world } = this;
    const { footprint, cost } = STRUCTURES.cabin;
    const i = Math.round(z) * world.stride + Math.round(x);
    if (world.towns.some(town => town.fort && insideFortFootprint(town.fort.bounds, x, z, footprint * .7))) {
      return 'O castelo e seu pátio já estão ocupados.';
    }
    if (world.towns.some(town => town.palace && insideFort(town.palace.bounds, x, z, footprint * .7 + 2))) {
      return 'O castelo central ocupa este terreno.';
    }
    if (world.towns.some(town => town.cityWall && insideFort(town.cityWall.bounds, x, z, 3.4) &&
      !insideFort(town.cityWall.bounds, x, z, -2.6))) return 'A muralha da cidade ocupa este terreno.';
    if (!buildable(world, x, z, footprint * .72)) return 'Procure um terreno firme e plano.';
    if (this.index.roads.has(i) || this.#isOccupied(x, z, footprint * .64)) {
      return 'Libere espaço e preserve os caminhos.';
    }
    if (this.inventory.wood < cost.wood || this.inventory.stone < cost.stone) return 'A cabana requer 3 madeiras e 2 pedras.';
    return '';
  }

  construct(x, z) {
    const error = this.placement(x, z);
    if (error) return { error };
    const { footprint, cost } = STRUCTURES.cabin;
    const y = gridSample(this.world.ground, this.world.stride, x, z);
    const id = 'c:' + x.toFixed(2) + ':' + z.toFixed(2);
    for (const key of Object.keys(cost)) this.inventory[key] -= cost[key];
    this.add({ id, kind: 'cabin', x, y, z, footprint });
    this.revision++;
    return { chunk: chunkKey(x, z) };
  }
}
