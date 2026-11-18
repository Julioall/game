import { gridSample, hash } from './math.js';

// The first vertical slice of SPEC-FAUNA-001. All decisions are simulated in
// world time and never depend on camera or renderer animation updates.
const PROFILES = Object.freeze({
  cow: { hunger: .00035, thirst: .00048, fatigue: .00029, graze: true, speed: .65 },
  chicken: { hunger: .00052, thirst: .00059, fatigue: .00032, graze: true, speed: .46 },
  fox: { hunger: .00061, thirst: .00054, fatigue: .00039, hunter: true, speed: .93 }
});
const clamp = n => Math.max(0, Math.min(1, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const FRESH = kind => kind === 2 || kind >= 3;
const FOOD_BIOMES = new Set([2, 3, 4, 5, 10, 11]);
const CARDINAL = [[1,0],[-1,0],[0,1],[0,-1]];

export class FaunaEcology {
  constructor(world) {
    this.world = world;
    this.states = new Map();
    this.forage = new Map();
    this.events = { grazing: 0, drinking: 0, resting: 0, attacks: 0, deaths: 0, decisions: 0 };
  }
  state(record) {
    if (this.states.has(record.id)) return this.states.get(record.id);
    const seed = record.seed >>> 0;
    const state = {
      time: 0, nextDecision: 0,
      needs: {
        hunger: .30 + hash(seed, 1, 0, 41) * .24,
        thirst: .25 + hash(seed, 2, 0, 41) * .25,
        fatigue: .2 + hash(seed, 3, 0, 41) * .23,
        fear: 0, health: 1
      },
      traits: {
        caution: .35 + hash(seed, 4, 0, 41) * .6,
        curiosity: .25 + hash(seed, 5, 0, 41) * .7
      },
      brain: { goal: 'explore', target: null, reason: 'initial', revision: 0 },
      memory: [], attackAt: 0, lastX: record.x, lastZ: record.z, stuck: 0
    };
    this.states.set(record.id, state);
    return state;
  }
  sample(x, z) {
    const { world } = this;
    if (!Number.isFinite(x) || !Number.isFinite(z) ||
        x < 2 || z < 2 || x >= world.config.size - 2 || z >= world.config.size - 2) return null;
    const stride = world.stride;
    const i = Math.round(z) * stride + Math.round(x);
    return {
      wet: world.wet.at(i), kind: world.waterKind.at(i),
      biome: world.biome.at(i), slope: world.slope.at(i),
      ground: gridSample(world.ground, stride, x, z)
    };
  }
  cell(x, z) { return Math.floor(x / 4) + ':' + Math.floor(z / 4); }
  food(x, z, now, consume = 0) {
    const point = this.sample(x, z);
    if (!point || point.wet > 0 || point.slope > .62 ||
        !FOOD_BIOMES.has(point.biome)) return 0;
    const key = this.cell(x, z);
    let patch = this.forage.get(key);
    if (!patch) {
      const capacity = 1.8 + hash(this.world.config.seed, Math.floor(x / 4), Math.floor(z / 4), 318) * 3.2;
      patch = { capacity, amount: capacity, updated: now };
    }
    patch.amount = Math.min(patch.capacity, patch.amount + Math.max(0, now - patch.updated) * .006);
    patch.updated = now;
    const consumed = Math.min(patch.amount, Math.max(0, consume));
    patch.amount -= consumed;
    this.forage.set(key, patch);
    return consume > 0 ? consumed : patch.amount;
  }
  nearest(record, kind, now, maxRadius = 18) {
    let best = null, bestD = Infinity;
    // Search coarse, stable positions. Never scan the full map or depend on camera.
    for (let dz = -maxRadius; dz <= maxRadius; dz += 2)
      for (let dx = -maxRadius; dx <= maxRadius; dx += 2) {
        const d2 = dx * dx + dz * dz;
        if (d2 > maxRadius * maxRadius || d2 >= bestD) continue;
        const x = Math.round(record.x + dx), z = Math.round(record.z + dz);
        const cell = this.sample(x, z);
        if (!cell || cell.wet > 0 || cell.slope > .62) continue;
        if (kind === 'forage') {
          if (this.food(x, z, now) <= .12) continue;
        } else {
          let water = false;
          for (const [ox, oz] of CARDINAL) {
            const nearby = this.sample(x + ox, z + oz);
            if (nearby && nearby.wet > .1 && FRESH(nearby.kind)) { water = true; break; }
          }
          if (!water) continue;
        }
        best = { x, z }; bestD = d2;
      }
    return best;
  }
  remember(s, kind, target) {
    if (!target) return;
    s.memory = s.memory.filter(m => m.kind !== kind || distance(m, target) > 4);
    s.memory.unshift({ kind, x: target.x, z: target.z, expires: s.time + 90 });
    s.memory.length = Math.min(s.memory.length, 6);
  }
  choose(record, s, nearby) {
    const profile = PROFILES[record.species], needs = s.needs;
    const fox = record.species === 'chicken'
      ? nearby.filter(a => a.species === 'fox' && this.state(a).needs.health > 0)
        .sort((a,b) => distance(a,record)-distance(b,record) || a.id.localeCompare(b.id))[0] : null;
    const prey = profile.hunter
      ? nearby.filter(a => a.species === 'chicken' && this.state(a).needs.health > 0)
        .sort((a,b) => distance(a,record)-distance(b,record) || a.id.localeCompare(b.id))[0] : null;
    if (fox && distance(record, fox) < 7.5) {
      needs.fear = clamp(needs.fear + .2);
      return { goal: 'flee', target: { x: record.x + (record.x - fox.x) * 2,
        z: record.z + (record.z - fox.z) * 2 }, reason: 'predator-visible' };
    }
    if (prey && needs.hunger >= .38 && distance(record, prey) < 16)
      return { goal: 'hunt', target: { x: prey.x, z: prey.z }, targetId: prey.id, reason: 'prey-visible' };
    const scores = [
      { goal: 'drink', score: clamp((needs.thirst - .2) * 1.65) },
      { goal: profile.graze ? 'forage' : 'explore', score: clamp((needs.hunger - .22) * 1.5) },
      { goal: 'rest', score: clamp((needs.fatigue - .2) * 1.22) },
      { goal: 'explore', score: .24 + s.traits.curiosity * .09 }
    ];
    scores.sort((a,b) => b.score - a.score || a.goal.localeCompare(b.goal));
    let goal = scores[0].goal;
    // Keep a valid active task unless the next one is substantially more urgent.
    if (s.brain.target && s.brain.goal !== 'explore' && s.brain.goal !== 'flee') {
      const old = scores.find(x => x.goal === s.brain.goal)?.score ?? 0;
      if (old * 1.15 >= scores[0].score) goal = s.brain.goal;
    }
    let target = goal === s.brain.goal ? s.brain.target : null;
    if (goal === 'drink' || goal === 'forage') {
      if (!target || s.stuck > 15) target = this.nearest(record, goal, s.time);
      if (!target) goal = 'explore';
    }
    if (goal === 'rest') target = { x: record.x, z: record.z };
    if (goal === 'explore') target = null;
    if (target) this.remember(s, goal, target);
    return { goal, target, reason: scores[0].goal + ':' + scores[0].score.toFixed(2) };
  }
  // Called by the authoritative 10 Hz fauna clock; only decisions use the
  // slower, staggered ~1 Hz schedule. Emergency fear can interrupt sooner.
  plan(record, dt, nearby = []) {
    const profile = PROFILES[record.species];
    if (!profile) return null;
    const s = this.state(record), n = s.needs;
    s.time += dt;
    if (n.health <= 0) return { stop: true, action: 'death' };
    n.hunger = clamp(n.hunger + profile.hunger * dt);
    n.thirst = clamp(n.thirst + profile.thirst * dt);
    n.fatigue = clamp(n.fatigue + profile.fatigue * dt);
    n.fear = clamp(n.fear - dt * .02);
    s.memory = s.memory.filter(m => m.expires > s.time);
    const threatened = record.species === 'chicken' && nearby.some(a =>
      a.species === 'fox' && distance(a, record) < 6);
    if (s.time >= s.nextDecision || threatened) {
      const next = this.choose(record, s, nearby);
      if (next.goal !== s.brain.goal || next.targetId !== s.brain.targetId) s.brain.revision++;
      s.brain = { ...next, revision: s.brain.revision };
      s.nextDecision = s.time + .8 + hash(record.seed, Math.floor(s.time), 0, 55) * .45;
      this.events.decisions++;
    }
    const { goal, target } = s.brain;
    if (goal === 'rest') return { stop: true, action: 'rest' };
    if (!target) return null; // The original constrained wandering is the fallback.
    const dx = target.x - record.x, dz = target.z - record.z, remaining = Math.hypot(dx, dz);
    if (remaining < (goal === 'flee' ? .3 : 1.35) && goal !== 'hunt')
      return { stop: true, action: goal === 'forage' ? 'eat' : goal === 'drink' ? 'drink' : 'idle',
        goal, target };
    return { goal, target, action: goal === 'hunt' || goal === 'flee' ? 'run' : 'walk',
      heading: Math.atan2(dx, dz), speed: profile.speed * (goal === 'hunt' || goal === 'flee' ? 1.65 : 1) };
  }
  resolve(record, position, intent, dt, nearby = []) {
    const profile = PROFILES[record.species];
    if (!profile || !intent) return;
    const s = this.state(record), n = s.needs;
    if (distance(position, s) < .01 && !intent.stop) s.stuck++;
    else s.stuck = 0;
    s.lastX = position.x; s.lastZ = position.z;
    if (intent.goal === 'forage' && intent.stop) {
      const eaten = this.food(position.x, position.z, s.time, dt * .38);
      n.hunger = clamp(n.hunger - eaten * .18);
      if (eaten > 0) this.events.grazing++;
      if (!eaten) { s.brain.target = null; s.nextDecision = 0; }
    } else if (intent.goal === 'drink' && intent.stop) {
      const target = s.brain.target;
      const canDrink = target && this.nearest(position, 'drink', s.time, 2);
      if (canDrink) { n.thirst = clamp(n.thirst - dt * .08); this.events.drinking++; }
      else { s.brain.target = null; s.nextDecision = 0; }
    } else if (intent.action === 'rest') {
      n.fatigue = clamp(n.fatigue - dt * .035);
      this.events.resting++;
    } else if (intent.goal === 'hunt') {
      const prey = nearby.find(a => a.id === s.brain.targetId);
      if (prey && distance(position, prey) < .9 && s.time >= s.attackAt) {
        const state = this.state(prey);
        if (state.needs.health > 0) {
          state.needs.health = clamp(state.needs.health - .24);
          state.needs.fear = clamp(state.needs.fear + .9);
          s.attackAt = s.time + 3;
          n.hunger = clamp(n.hunger - .085);
          this.events.attacks++;
          if (!state.needs.health) this.events.deaths++;
        }
      }
    }
  }
  read(id) {
    const s = this.states.get(id);
    if (!s) return null;
    return { needs: { ...s.needs }, traits: { ...s.traits },
      brain: { ...s.brain, target: s.brain.target ? { ...s.brain.target } : null },
      memory: s.memory.map(m => ({ ...m })), actionRevision: s.brain.revision };
  }
  diagnostics() {
    return { ecologicalActors: this.states.size, forageCells: this.forage.size, ...this.events };
  }
  remove(id) { this.states.delete(id); }
}
