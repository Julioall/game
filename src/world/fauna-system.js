import { FAUNA_BEHAVIOR } from './fauna-catalog.js';
import { CHUNK } from './catalog.js';
import { FaunaSpatialIndex, generateFaunaPopulation } from './fauna.js';
import { FaunaMotion } from './fauna-motion.js';
import { chunkObjects } from './vegetation.js';
import { insideFort, insideFortFootprint } from './fortifications.js';

/** Authoritative session fauna. No Three.js or renderer lifecycle dependencies. */
export class FaunaSystem {
  constructor(world, index, { buildingsAt = () => [], isRemoved = () => false } = {}) {
    Object.assign(this, { world, index, buildingsAt, isRemoved });
    this.objects = new Map();
    this.spatial = new FaunaSpatialIndex();
    this.accumulator = 0;
    this.metrics = { ticks: 0, active: 0, candidatesVisited: 0, obstaclesVisited: 0, obstacleTests: 0 };
    this.population = generateFaunaPopulation(world, (x, z, r) =>
      this.faunaBlocked(Math.floor(x / CHUNK), Math.floor(z / CHUNK), x, z, r, [])
    );
    this.records = new Map(this.population.records.map((r) => [r.id, r]));
    const buckets = new Map();
    for (const record of this.population.records) {
      if (!buckets.has(record.homeChunk)) buckets.set(record.homeChunk, []);
      buckets.get(record.homeChunk).push(record);
    }
    for (const [key, records] of buckets) this.spatial.set(key, records);
    this.motion = new FaunaMotion(world, (x, z, r) => this.blocked(x, z, r));
  }
  blocked(x, z, radius) {
    const cx = Math.floor(x / CHUNK),
      cz = Math.floor(z / CHUNK),
      natural = [];
    // Resource buckets are 8 m; inspect only cells within an obstacle's maximum radius.
    for (let gz = Math.floor((z - 4) / 8); gz <= Math.floor((z + 4) / 8); gz++)
      for (let gx = Math.floor((x - 4) / 8); gx <= Math.floor((x + 4) / 8); gx++) {
        const bx = Math.floor((gx * 8) / CHUNK),
          bz = Math.floor((gz * 8) / CHUNK),
          key = `${bx},${bz}`;
        if (bx < 0 || bz < 0 || bx * CHUNK >= this.world.config.size || bz * CHUNK >= this.world.config.size)
          continue;
        if (!this.objects.has(key)) {
          const cells = new Map();
          for (const object of chunkObjects(this.world, this.index, bx, bz, { resourcesOnly: true })) {
            const cell = `${Math.floor(object.x / 8)},${Math.floor(object.z / 8)}`;
            if (!cells.has(cell)) cells.set(cell, []);
            cells.get(cell).push(object);
          }
          this.objects.set(key, cells);
        }
        for (const object of this.objects.get(key).get(`${gx},${gz}`) ?? []) {
          this.metrics.obstaclesVisited++;
          if (!this.isRemoved(object.id)) natural.push(object);
        }
      }
    while (this.objects.size > 192) this.objects.delete(this.objects.keys().next().value);
    return this.faunaBlocked(cx, cz, x, z, radius, natural);
  }
  tick(dt, region) {
    if (!Number.isFinite(dt) || dt <= 0 || !region) return;
    this.accumulator += Math.min(dt, 0.25);
    while (this.accumulator >= FAUNA_BEHAVIOR.tick) {
      this.accumulator -= FAUNA_BEHAVIOR.tick;
      const query = this.spatial.query(region.x, region.z, region.radius ?? 110);
      this.metrics.candidatesVisited += query.candidatesVisited;
      this.metrics.active = query.items.length;
      this.metrics.ticks++;
      for (const { record } of query.items) {
        const previous = record.homeChunk,
          state = this.motion.step(record, FAUNA_BEHAVIOR.tick);
        Object.assign(record, { x: state.x, y: state.y, z: state.z, heading: state.heading });
        const key = `${Math.floor(record.x / CHUNK)},${Math.floor(record.z / CHUNK)}`;
        if (key !== previous) {
          this.spatial.set(
            previous,
            (this.spatial.chunks.get(previous) ?? []).filter((r) => r.id !== record.id)
          );
          this.spatial.set(key, [...(this.spatial.chunks.get(key) ?? []), record]);
          record.homeChunk = key;
        }
      }
    }
  }
  read(id) {
    const s = this.motion.states.get(id) ?? this.records.get(id);
    if (!s) return null;
    const velocity = { ...(s.velocity ?? { x: 0, y: 0, z: 0 }) };
    return {
      ...s,
      velocity,
      action: s.action ?? (Math.hypot(velocity.x, velocity.z) > 0.001 ? 'walk' : 'idle'),
      ...(s.actionOptions ? { actionOptions: structuredClone(s.actionOptions) } : {})
    };
  }
  presentation() {
    const self = this;
    return Object.freeze({
      get total() {
        return self.spatial.total;
      },
      query: (x, z, r) => {
        const q = self.spatial.query(x, z, r);
        return { ...q, items: q.items.map((item) => ({ ...item, record: self.read(item.record.id) })) };
      },
      read: (id) => self.read(id),
      diagnostics: () => ({ ...self.metrics }),
      population: () => ({
        total: self.records.size,
        missing: { ...self.population.missing },
        targets: { ...self.population.targets }
      })
    });
  }
  faunaBlocked(cx, cz, x, z, radius, natural) {
    const { stride } = this.world;
    const ix = Math.round(x),
      iz = Math.round(z);
    if (
      natural.some((object) => {
        this.metrics.obstacleTests++;
        if (!['tree', 'rock'].includes(object.kind)) return false;
        const obstacle = object.kind === 'tree' ? object.radius : object.scale * 0.48;
        return Math.hypot(object.x - x, object.z - z) < obstacle + radius * 0.55 + 0.55;
      })
    )
      return true;
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const px = ix + dx,
          pz = iz + dz;
        if (px >= 0 && pz >= 0 && px < stride && pz < stride && this.index.roads.has(pz * stride + px))
          return true;
      }
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const key = cx + dx + ',' + (cz + dz);
        const buildings = [...(this.index.buildings.get(key) ?? []), ...this.buildingsAt(key)];
        if (
          buildings.some(
            (building) =>
              Math.hypot(building.x - x, building.z - z) < building.footprint * 0.68 + radius + 0.8
          )
        )
          return true;
        if (
          (this.index.fields.get(key) ?? []).some(
            (field) => Math.abs(field.x - x) < 2.7 + radius && Math.abs(field.z - z) < 2.7 + radius
          )
        )
          return true;
        if ((this.index.districts.get(key) ?? []).some((bounds) => insideFort(bounds, x, z, 2.7 + radius)))
          return true;
        if (
          (this.index.yards.get(key) ?? []).some((bounds) => insideFortFootprint(bounds, x, z, 0.25 + radius))
        )
          return true;
      }
    return false;
  }
}
