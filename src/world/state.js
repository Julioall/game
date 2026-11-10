import { STRUCTURES, VERSION } from './catalog.js';
import { addToChunk, chunkKey, indexTowns } from './chunks.js';
import { findResource } from './vegetation.js';
import { gridSample } from './math.js';
import { constructionRules } from './construction.js';

export class WorldState {
  #removed;
  #built = new Map();
  #construction;

  constructor(world, saved = {}) {
    this.world = world;
    this.index = indexTowns(world);
    this.#removed = new Set(saved.removed ?? []);
    this.#construction = constructionRules(world, this.index);
    this.inventory = { wood: 0, stone: 0, ...saved.inventory };
    this.revision = 0;
    for (const building of saved.buildings ?? []) this.#add(building);
  }

  #add(building) {
    const { x, z, footprint } = building ?? {};
    const { size } = this.world.config;
    if (!Number.isFinite(x) || !Number.isFinite(z) || x < 0 || z < 0 || x >= size || z >= size ||
        (footprint !== undefined && (!Number.isFinite(footprint) || footprint < 0 || footprint > size))) return;
    const record = Object.freeze({ ...building });
    addToChunk(this.#built, chunkKey(record.x, record.z), record);
    this.#construction.register(record);
  }

  isRemoved(id) {
    return this.#removed.has(id);
  }

  presentation() {
    return {
      index: this.index,
      isRemoved: id => this.isRemoved(id),
      buildingsAt: key => this.#built.get(key)?.slice() ?? []
    };
  }

  snapshot() {
    return { version: VERSION, removed: [...this.#removed], buildings: [...this.#built.values()].flat(),
      inventory: { ...this.inventory } };
  }

  harvest(id) {
    if (this.#removed.has(id)) return null;
    const object = findResource(this.world, this.index, id);
    if (!object) return null;
    const key = object.kind === 'tree' ? 'wood' : 'stone';
    const amount = key === 'wood' ? 2 + Math.floor(object.age / 28) : 2 + Math.floor(object.scale * 2);
    this.#removed.add(object.id);
    this.inventory[key] += amount;
    this.revision++;
    return { key, amount, chunk: chunkKey(object.x, object.z) };
  }

  placement(x, z) {
    return this.#construction.placement(x, z, this.inventory, id => this.isRemoved(id));
  }

  construct(x, z) {
    const error = this.placement(x, z);
    if (error) return { error };
    const { footprint, cost } = STRUCTURES.cabin;
    const y = gridSample(this.world.ground, this.world.stride, x, z);
    const id = 'c:' + x.toFixed(2) + ':' + z.toFixed(2);
    for (const key of Object.keys(cost)) this.inventory[key] -= cost[key];
    this.#add({ id, kind: 'cabin', x, y, z, footprint });
    this.revision++;
    return { chunk: chunkKey(x, z) };
  }
}
