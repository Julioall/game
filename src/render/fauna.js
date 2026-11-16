import { gridSample } from '../world/math.js';
import { animalArrival } from './fauna-appearance.js';
import { faunaAppearanceOptions } from './fauna-variants.js';
import { createBakedFactory } from './fauna-assets.js';
import { loadFaunaSpecies } from './fauna-species.js';
import { animationPhase } from './fauna-budget.js';

let factoryPromise;
export function preloadAnimalFactory() {
  return factoryPromise ??= import('procedural-animals').then(module => createBakedFactory(
    async (species, options) => module.createAnimal(await loadFaunaSpecies(species), options)));
}

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
    animationInterval = 0,
    presentationProfile = null,
    stagger = true,
    readState = null,
    visible = () => true
  } = {}) {
    if (!THREE?.Vector3 || !scene || !index || !world)
      throw new TypeError('THREE, scene, index e world são obrigatórios');
    Object.assign(this, { THREE, scene, index, world, createAnimal, maximum, radius, quality, visible, animationInterval, presentationProfile });
    this.stagger = stagger;
    this.readState = readState ?? ((id) => this.records?.get(id));

    this.records = new Map();
    this.actors = new Map();
    this.pending = new Map();
    this.desired = new Set();
    this.selection = [];
    this.failedIds = new Set();
    this.libraryPromise = null;
    this.libraryError = null;
    this.closed = false;
    this.lastPlan = -Infinity;
    this.lastFocus = null;
    this.lastRadius = null;
    this.lastQuery = { items: [], chunksVisited: 0, candidatesVisited: 0, indexed: 0 };
    this.stats = { created: 0, disposed: 0, failures: 0, loadFailures: 0 };
    this.ground = (x, z) => gridSample(this.world.ground, this.world.stride, x, z);
  }

  async loadAnimalFactory() {
    if (this.createAnimal) return this.createAnimal;
    if (this.libraryError) throw this.libraryError;
    this.libraryPromise ??= preloadAnimalFactory()
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
        ...faunaAppearanceOptions(record),
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
      animal.setLod?.(0); // Full gait and skeletal animation, not crowd LOD.
      // Simulation can advance while a Worker is building this model.
      const current = this.readState(record.id) ?? record;
      animal.position?.copy?.(current);
      animal.move({ speed: 0, heading: current.heading });
      animal.update(0);
      const inScene = this.visible(current, 1.08);
      if (inScene) this.scene.add(animal.object);
      this.actors.set(record.id, {
        animal,
        inScene,
        animationTime: 0,
        arrival: animalArrival(animal.object),
        arrivalStart: null,
        record: current,
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
          console.warn('Fauna model failed:', record.species, this.lastError);
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
    this.animationUpdates = 0;
    this.offscreenSleeping = 0;
    for (const item of this.actors.values()) {
      item.arrivalStart ??= seconds;
      item.arrival.value = Math.min(1, Math.max(0, (seconds - item.arrivalStart) / .3));
      const { animal, record } = item,
        state = this.readState(record.id) ?? record;
      const inScene = this.visible(state, item.inScene ? 1.15 : 1.08);
      const resumed = inScene && !item.inScene;
      if (inScene !== item.inScene) {
        if (inScene) this.scene.add(animal.object);
        else this.scene.remove(animal.object);
        item.inScene = inScene;
      }
      item.record = state;
      if (!inScene) {
        item.animationTime = 0;
        item.animationPhase = undefined;
        this.offscreenSleeping++;
        continue;
      }
      const profile = this.presentationProfile?.(state);
      const interval = profile?.interval ?? this.animationInterval;
      if (profile && item.coverings !== profile.coverings) {
        animal.setCoverings?.(profile.coverings);
        item.coverings = profile.coverings;
      }
      if (item.animationPhase === undefined || item.interval !== interval) {
        item.animationPhase = this.stagger ? animationPhase(record.id) * interval : 0;
        item.interval = interval;
      }
      item.animationTime = Math.min(.1, item.animationTime + step);
      item.animationPhase += step;
      if (!resumed && item.animationPhase + 1e-8 < interval) continue;
      const animationStep = item.animationTime;
      item.animationTime = 0;
      item.animationPhase = this.stagger && interval > 0 ? item.animationPhase % interval : 0;
      const velocity = state.velocity ?? { x: 0, y: 0, z: 0 };
      animal.position?.copy?.(state);
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
      animal.update(animationStep);
      this.animationUpdates++;
    }
    const moved = !this.lastFocus || Math.hypot(focus.x - this.lastFocus.x, focus.z - this.lastFocus.z) >= 3
      || this.radius !== this.lastRadius;
    if ((!moved && seconds - this.lastPlan < 0.45) || seconds - this.lastPlan < 0.18) {
      this.fill();
      return;
    }

    this.lastPlan = seconds;
    this.lastFocus = { x: focus.x, z: focus.z };
    this.lastRadius = this.radius;
    const retentionRadius = this.radius + Math.max(12, this.radius * .25);
    this.lastQuery = this.index.query(focus.x, focus.z, retentionRadius);
    const stateOf = item => this.readState(item.record.id) ?? item.record;
    const visibleItems = this.lastQuery.items.filter((item) => {
      const state = this.readState(item.record.id) ?? item.record;
      return this.visible(state, 1.4);
    }).sort((a, b) => Number(this.visible(stateOf(b))) - Number(this.visible(stateOf(a)))
      || a.d2 - b.d2 || a.record.id.localeCompare(b.record.id));
    const byId = new Map(this.lastQuery.items.map((item) => [item.record.id, item]));
    const retained = [...this.actors.keys(), ...this.pending.keys()]
      .map((id) => byId.get(id))
      .filter((item) => item && this.visible(stateOf(item), 1.8))
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
    this.selection = selected.sort((a, b) => Number(this.visible(stateOf(b))) - Number(this.visible(stateOf(a)))
      || a.d2 - b.d2 || a.record.id.localeCompare(b.record.id));

    for (const id of [...this.actors.keys(), ...this.pending.keys()]) {
      if (!this.desired.has(id)) this.remove(id);
    }
    this.fill();
  }

  // Fill vacated construction slots every frame, independently of spatial planning.
  fill() {
    if (this.closed || this.libraryError) return;
    for (const { record } of this.selection) {
      if (this.actors.has(record.id) || this.pending.has(record.id) || this.failedIds.has(record.id))
        continue;
      if (this.pending.size >= 2 || this.actors.size + this.pending.size >= this.maximum)
        break;
      void this.add(record);
      break;
    }
  }

  initialReady() {
    return this.lastPlan !== -Infinity && (Boolean(this.libraryError) || this.selection.every(({ record }) =>
      !this.visible(this.readState(record.id) ?? record) || this.actors.has(record.id) || this.failedIds.has(record.id)));
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
      faunaQueued: this.selection.filter(({ record }) => !this.actors.has(record.id) && !this.pending.has(record.id)
        && !this.failedIds.has(record.id)).length,
      faunaCreated: this.stats.created,
      faunaAnimationUpdates: this.animationUpdates ?? 0,
      faunaOffscreenSleeping: this.offscreenSleeping ?? 0,
      faunaDisposed: this.stats.disposed,
      faunaFailures: this.stats.failures + this.stats.loadFailures,
      faunaLastError: this.lastError ?? null,
      faunaBakesLoaded: this.createAnimal?.bakeStats?.loaded ?? 0,
      faunaBakeFailures: this.createAnimal?.bakeStats?.failures ?? 0,
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
