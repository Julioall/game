import { FaunaSystem } from './fauna-system.js';
import { STRUCTURES, TRAVERSAL_PROFILE, VERSION } from './catalog.js';
import { addToChunk, chunkKey, indexTowns } from './chunks.js';
import { findResource } from './vegetation.js';
import { gridSample } from './math.js';
import { constructionRules } from './construction.js';
import { readOnlyWorld } from './read-only.js';
import { sampleWater } from './terrain/water.js';
import { stepTraversal, traversalSurface } from './traversal.js';

const validAmount = amount => Number.isSafeInteger(amount) && amount >= 0;

export class WorldState {
  #world;
  #index;
  #inventory;
  #removed;
  #built = new Map();
  #construction;
  #fauna = null;
  #traveler = null;
  #travelTarget = null;

  constructor(world, saved = {}) {
    this.#world = world;
    this.#index = indexTowns(world);
    if (!saved || (saved.version !== undefined && saved.version !== VERSION)) saved = {};
    this.#removed = new Set(Array.isArray(saved.removed) ? saved.removed.filter(id => typeof id === 'string') : []);
    this.#construction = constructionRules(world, this.#index);
    const { wood, stone } = saved.inventory ?? {};
    this.#inventory = { wood: validAmount(wood) ? wood : 0, stone: validAmount(stone) ? stone : 0 };
    this.revision = 0;
    if (Array.isArray(saved.buildings)) {
      const ids = new Set();
      for (const building of saved.buildings) {
        const { id, kind, x, y, z, footprint } = building ?? {};
        if (typeof id !== 'string' || !id || ids.has(id) || kind !== 'cabin' ||
            !Number.isFinite(y) || !Number.isFinite(x) || !Number.isFinite(z) ||
            x < 0 || z < 0 || x >= world.config.size || z >= world.config.size ||
            footprint !== STRUCTURES.cabin.footprint) continue;
        this.#add({ id, kind, x, y, z, footprint });
        ids.add(id);
      }
    }
  }

  #add(building) {
    const record = Object.freeze(building);
    addToChunk(this.#built, chunkKey(record.x, record.z), record);
    this.#construction.register(record);
  }

  isRemoved(id) {
    return this.#removed.has(id);
  }

  get inventory() {
    return { ...this.#inventory };
  }

  waterAt(x, z) {
    return sampleWater(this.#world, x, z);
  }

  beginTraversal(x, z) {
    if (this.#traveler) return false;
    const start = traversalSurface(this.#world, x, z);
    if (!start || start.water) return false;
    this.#traveler = start;
    return true;
  }

  get traveler() {
    const actor = this.#traveler;
    return actor && { x: actor.x, y: actor.y, z: actor.z, mode: actor.mode };
  }

  moveTraveler(dx, dz) {
    if (!this.#traveler || !Number.isFinite(dx) || !Number.isFinite(dz) || !Number.isFinite(Math.hypot(dx, dz))) return null;
    if (dx || dz) this.#travelTarget = null;
    if (this.#travelTarget) {
      dx = this.#travelTarget.x - this.#traveler.x;
      dz = this.#travelTarget.z - this.#traveler.z;
      const distance = Math.hypot(dx, dz);
      if (distance < TRAVERSAL_PROFILE.arrivalDistance) {
        this.#travelTarget = null;
        dx = dz = 0;
      } else {
        dx /= distance;
        dz /= distance;
      }
    }
    const next = stepTraversal(this.#world, this.#traveler, dx, dz);
    if (!next) return null;
    this.#traveler = next;
    return { ...this.traveler, waterSurface: next.water?.surface };
  }

  setTravelTarget(x, z) {
    if (!this.#traveler || !traversalSurface(this.#world, x, z)) return false;
    this.#travelTarget = { x, z };
    return true;
  }

  get hasTravelTarget() {
    return this.#travelTarget !== null;
  }

  cancelTravelTarget() {
    this.#travelTarget = null;
  }

  endTraversal() {
    this.#traveler = null;
    this.#travelTarget = null;
  }

  tickFauna(dt,region) { this.#fauna?.tick(dt,region); }

  presentation() {
    this.#fauna ??= new FaunaSystem(this.#world,this.#index,{
      isRemoved:id=>this.isRemoved(id), buildingsAt:key=>this.#built.get(key)??[]
    });
    return Object.freeze({
      world: readOnlyWorld(this.#world),
      fauna: this.#fauna.presentation(),
      index: this.#index,
      isRemoved: id => this.isRemoved(id),
      buildingsAt: key => this.#built.get(key)?.slice() ?? []
    });
  }

  snapshot() {
    return { version: VERSION, removed: [...this.#removed], buildings: [...this.#built.values()].flat(),
      inventory: this.inventory };
  }

  harvest(id) {
    if (this.#removed.has(id)) return null;
    const object = findResource(this.#world, this.#index, id);
    if (!object) return null;
    const key = object.kind === 'tree' ? 'wood' : 'stone';
    const amount = key === 'wood' ? 2 + Math.floor(object.age / 28) : 2 + Math.floor(object.scale * 2);
    const balance = this.#inventory[key] + amount;
    if (!validAmount(balance)) return null;
    this.#removed.add(object.id);
    this.#inventory[key] = balance;
    this.revision++;
    return { key, amount, chunk: chunkKey(object.x, object.z) };
  }

  placement(x, z) {
    return this.#construction.placement(x, z, this.#inventory, id => this.isRemoved(id));
  }

  construct(x, z) {
    const error = this.placement(x, z);
    if (error) return { error };
    const { footprint, cost } = STRUCTURES.cabin;
    const y = gridSample(this.#world.ground, this.#world.stride, x, z);
    const id = 'c:' + x.toFixed(2) + ':' + z.toFixed(2);
    for (const key of Object.keys(cost)) this.#inventory[key] -= cost[key];
    this.#add({ id, kind: 'cabin', x, y, z, footprint });
    this.revision++;
    return { chunk: chunkKey(x, z) };
  }
}
