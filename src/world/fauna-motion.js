import { FAUNA_BEHAVIOR } from './fauna-catalog.js';
import { aquaticHabitat } from './fauna.js';
import { gridSample, hash } from './math.js';

// Session-local ambient simulation. Presentation supplies occupancy queries only.
export class FaunaMotion {
  constructor(world, blocked = () => false) {
    this.world = world;
    this.blocked = blocked;
    this.states = new Map();
  }
  step(record, dt) {
    let s = this.states.get(record.id);
    if (!s) {
      s = { ...record, homeX: record.x, homeZ: record.z, time: 0, turn: 0, velocity: { x: 0, y: 0, z: 0 } };
      this.states.set(record.id, s);
    }
    s.time += dt;
    const aquatic = ['fish', 'shark'].includes(s.species);
    const speed = ['snake', 'spider', 'rat', 'frog'].includes(s.species)
      ? FAUNA_BEHAVIOR.smallSpeed
      : aquatic
        ? FAUNA_BEHAVIOR.swimSpeed
        : FAUNA_BEHAVIOR.walkSpeed;
    const pause =
      s.time % FAUNA_BEHAVIOR.pausePeriod >= FAUNA_BEHAVIOR.pausePeriod - FAUNA_BEHAVIOR.pauseDuration;
    const heading =
      Math.hypot(s.x - s.homeX, s.z - s.homeZ) > FAUNA_BEHAVIOR.homeRadius
        ? Math.atan2(s.homeX - s.x, s.homeZ - s.z)
        : s.heading;
    s.velocity = { x: 0, y: 0, z: 0 };
    if (pause || dt <= 0) return s;
    for (const angle of [0, 0.55, -0.55, 1.1, -1.1, Math.PI]) {
      const h = heading + angle,
        dx = Math.sin(h),
        dz = Math.cos(h);
      const x = s.x + dx * speed * dt,
        z = s.z + dz * speed * dt;
      const aheadX = x + dx * 1.2,
        aheadZ = z + dz * 1.2;
      const { world } = this;
      if (aheadX < 2 || aheadZ < 2 || aheadX > world.config.size - 2 || aheadZ > world.config.size - 2)
        continue;
      const wet = gridSample(world.wet, world.stride, aheadX, aheadZ) > 0;
      if (wet !== aquatic || (!aquatic && this.blocked(aheadX, aheadZ, 0.65))) continue;
      if (
        aquatic &&
        (!aquaticHabitat(world, s.species, aheadX, aheadZ) || !aquaticHabitat(world, s.species, x, z))
      )
        continue;
      if (!aquatic && gridSample(world.wet, world.stride, x, z) > 0) continue;
      const ground = gridSample(world.ground, world.stride, x, z);
      if (!aquatic && Math.abs(ground - s.y) > speed * dt * 0.65 + 0.015) continue;
      s.x = x;
      s.z = z;
      s.y = aquatic ? gridSample(world.surface, world.stride, x, z) : ground;
      s.heading = h;
      s.velocity = { x: dx * speed, y: 0, z: dz * speed };
      return s;
    }
    s.heading += (hash(s.seed, Math.floor(s.time), 0) > 0.5 ? 1 : -1) * dt;
    return s;
  }
  remove(id) {
    this.states.delete(id);
  }
}
