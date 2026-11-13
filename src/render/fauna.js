import { gridSample } from '../world/math.js';

/** Render-only adapter for the optional, bounded group of nearby animals. */
export class FaunaActors {
  constructor({
    THREE,
    scene,
    index,
    world,
    createAnimal = null,
    maximum = Infinity,
    radius = 44,
    quality = 'low',
    readState = null,
    visible = () => true
  } = {}) {
    if (!THREE?.Vector3 || !scene || !index || !world)
      throw new TypeError('THREE, scene, index e world são obrigatórios');
    Object.assign(this, { THREE, scene, index, world, createAnimal, maximum, radius, quality, visible });
    this.readState = readState ?? ((id) => this.records?.get(id));

    this.records = new Map();
    this.actors = new Map();
    this.pending = new Map();
    this.desired = new Set();
    this.failedIds = new Set();
    this.libraryPromise = null;
    this.libraryError = null;
    this.closed = false;
    this.lastPlan = -Infinity;
    this.lastFocus = null;
    this.lastQuery = { items: [], chunksVisited: 0, candidatesVisited: 0, indexed: 0 };
    this.stats = { created: 0, disposed: 0, failures: 0, loadFailures: 0 };
    this.ground = (x, z) => gridSample(this.world.ground, this.world.stride, x, z);
  }

  async loadAnimalFactory() {
    if (this.createAnimal) return this.createAnimal;
    if (this.libraryError) throw this.libraryError;
    this.libraryPromise ??= import('procedural-animals')
      .then((module) => module.createAnimal)
      .catch((error) => {
        this.libraryError = error;
        this.stats.loadFailures++;
        throw error;
      });
    this.createAnimal = await this.libraryPromise;
    return this.createAnimal;
  }

  rememberFailure(id) {
    this.failedIds.add(id);
    while (this.failedIds.size > 128) this.failedIds.delete(this.failedIds.values().next().value);
  }

  async add(record) {
    if (this.closed || this.actors.has(record.id) || this.pending.has(record.id)) return;
    this.records.set(record.id, record);
    const token = { cancelled: false };
    this.pending.set(record.id, token);
    try {
      const createAnimal = await this.loadAnimalFactory();
      if (this.closed || token.cancelled || !this.desired.has(record.id)) return;
      const animal = await createAnimal(record.species, {
        seed: 1769 + (record.seed % 2),
        quality: this.quality,
        worker: true,
        ground: this.ground,
        water: (x, z) =>
          gridSample(this.world.wet, this.world.stride, x, z) > 0
            ? gridSample(this.world.surface, this.world.stride, x, z)
            : null,
        position: new this.THREE.Vector3(record.x, record.y, record.z),
        heading: record.heading,
        castShadow: false,
        receiveShadow: false
      });
      if (this.closed || token.cancelled || !this.desired.has(record.id)) {
        animal.dispose();
        this.stats.disposed++;
        return;
      }
      animal.setLod?.(2);
      animal.move({ speed: 0, heading: record.heading });
      this.scene.add(animal.object);
      this.actors.set(record.id, {
        animal,
        record,
        position: new this.THREE.Vector3(),
        velocity: new this.THREE.Vector3(),
        lastAction: null
      });
      this.stats.created++;
    } catch (error) {
      this.lastError = String(error?.message ?? error);
      if (!token.cancelled && !this.closed) {
        if (!this.libraryError) {
          this.rememberFailure(record.id);
          this.stats.failures++;
        }
      }
    } finally {
      if (this.pending.get(record.id) === token) this.pending.delete(record.id);
      if (!this.actors.has(record.id)) this.records.delete(record.id);
    }
  }

  remove(id) {
    const token = this.pending.get(id);
    if (token) token.cancelled = true;
    const item = this.actors.get(id);
    if (!item) return Boolean(token);
    this.scene.remove(item.animal.object);
    item.animal.dispose();
    this.actors.delete(id);
    this.records.delete(id);
    // Keep session positions when a visual model leaves the screen.
    this.stats.disposed++;
    return true;
  }

  update(focus, dt, seconds) {
    if (this.closed) return;
    const step = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), 0.1) : 0;
    for (const item of this.actors.values()) {
      const { animal, record } = item,
        state = this.readState(record.id) ?? record;
      const velocity = state.velocity ?? { x: 0, y: 0, z: 0 };
      if (Math.hypot(velocity.x, velocity.z) > 0.001) {
        Object.assign(item.position, { x: state.x, y: state.y, z: state.z });
        Object.assign(item.velocity, velocity);
        animal.follow(item.position, item.velocity, { heading: state.heading });
      } else animal.move({ speed: 0, heading: state.heading });
      const action = state.action ?? 'idle';
      const actionToken = action + ':' + (state.actionRevision ?? 0);
      if (actionToken !== item.lastAction) {
        if (!['idle', 'walk', 'run', 'move'].includes(action) && animal.actions?.includes(action)) {
          const options = {};
          for (const key of ['target', 'direction'])
            if (state.actionOptions?.[key]) {
              const p = state.actionOptions[key];
              options[key] = new this.THREE.Vector3(p.x, p.y, p.z);
            }
          for (const key of ['loop', 'speed'])
            if (state.actionOptions?.[key] !== undefined) options[key] = state.actionOptions[key];
          Promise.resolve(animal.play(action, options)).catch((error) => {
            this.lastError = String(error);
          });
        } else animal.stopAction?.();
        item.lastAction = actionToken;
      }
      item.record = state;
      animal.update(step);
    }
    const moved = !this.lastFocus || Math.hypot(focus.x - this.lastFocus.x, focus.z - this.lastFocus.z) >= 3;
    if (!moved && seconds - this.lastPlan < 0.45) return;
    if (seconds - this.lastPlan < 0.18) return;

    this.lastPlan = seconds;
    this.lastFocus = { x: focus.x, z: focus.z };
    this.lastQuery = this.index.query(focus.x, focus.z, this.radius + 7);
    const visibleItems = this.lastQuery.items.filter((item) => {
      const state = this.readState(item.record.id) ?? item.record;
      return this.visible(state);
    });
    const byId = new Map(visibleItems.map((item) => [item.record.id, item]));
    const retained = [...this.actors.keys(), ...this.pending.keys()]
      .map((id) => byId.get(id))
      .filter((item) => item && item.d2 <= (this.radius + 7) ** 2)
      .sort((a, b) => a.d2 - b.d2 || a.record.id.localeCompare(b.record.id));
    const selected = retained.slice(0, this.maximum);
    const selectedIds = new Set(selected.map((item) => item.record.id));
    for (const item of visibleItems) {
      if (selected.length >= this.maximum) break;
      if (item.d2 > this.radius ** 2 || selectedIds.has(item.record.id)) continue;
      selected.push(item);
      selectedIds.add(item.record.id);
    }
    this.desired = selectedIds;

    for (const id of [...this.actors.keys(), ...this.pending.keys()]) {
      if (!this.desired.has(id)) this.remove(id);
    }
    let started = 0;
    for (const { record } of selected) {
      if (this.actors.has(record.id) || this.pending.has(record.id) || this.failedIds.has(record.id))
        continue;
      if (this.pending.size >= 2 || this.actors.size + this.pending.size >= this.maximum || started >= 1)
        break;
      started++;
      void this.add(record);
    }
  }

  diagnostics() {
    return {
      faunaIndexed: this.index.total,
      faunaNearby: this.lastQuery.items.length,
      faunaActive: this.actors.size,
      faunaVisible: [...this.actors.values()].filter(({ record }) =>
        this.visible(this.readState(record.id) ?? record)
      ).length,
      faunaPending: this.pending.size,
      faunaFailures: this.stats.failures + this.stats.loadFailures,
      faunaLastError: this.lastError ?? null,
      faunaSimulation: this.index.diagnostics?.() ?? null,
      faunaCapabilities: [...this.actors.values()].map(({ record, animal }) => ({
        id: record.id,
        species: record.species,
        actions: [...(animal.actions ?? [])],
        gaits: [...(animal.gaits ?? [])]
      })),
      faunaChunksVisited: this.lastQuery.chunksVisited,
      faunaCandidatesVisited: this.lastQuery.candidatesVisited
    };
  }

  dispose() {
    this.closed = true;
    for (const id of [...this.actors.keys(), ...this.pending.keys()]) this.remove(id);
  }
}
