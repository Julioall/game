import { WorldState } from '../src/world/state.js';
import { generate } from '../src/world/generate.js';
import { aquaticHabitat } from '../src/world/fauna.js';
import { faunaPopulationTargets, SMALL_FAUNA } from '../src/world/fauna.js';
import { FaunaMotion } from '../src/world/fauna-motion.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateChunkFauna, FaunaSpatialIndex } from '../src/world/fauna.js';
import { FaunaActors } from '../src/render/fauna.js';
import { faunaAppearanceOptions } from '../src/render/fauna-variants.js';
import { FAUNA_SPECIES } from '../src/world/fauna-catalog.js';

function meadow() {
  const stride = 65;
  return {
    config: { seed: 1769, size: 64 },
    stride,
    ground: new Float32Array(stride * stride).fill(3),
    biome: new Uint8Array(stride * stride).fill(2),
    slope: new Float32Array(stride * stride),
    wet: new Float32Array(stride * stride)
  };
}

test('fauna candidates are stable per seed and chunk and stay on dry gentle land', () => {
  const world = meadow();
  const options = { density: 1, maxPerChunk: 16 };
  const first = generateChunkFauna(world, 0, 0, options);
  assert.deepEqual(generateChunkFauna(world, 0, 0, options), first);
  assert.equal(first.length, 16);
  assert.equal(new Set(first.map((record) => record.id)).size, first.length);
  assert.ok(first.every((record) => record.y === 3 && record.kind === 'animal'));
  assert.ok(first.every((record) => Boolean(record.species)));
  assert.ok(first.every((record) => record.x >= 0 && record.x < 32 && record.z >= 0 && record.z < 32));
});

test('fauna generation rejects water, steep slopes, and occupied positions', () => {
  const world = meadow();
  const options = { density: 1, maxPerChunk: 16 };
  assert.deepEqual(generateChunkFauna(world, 0, 0, { ...options, blocked: () => true }), []);
  world.wet.fill(1);
  assert.deepEqual(generateChunkFauna(world, 0, 0, options), []);
  world.wet.fill(0);
  world.slope.fill(0.7);
  assert.deepEqual(generateChunkFauna(world, 0, 0, options), []);
  world.slope.fill(0);
  world.biome.fill(0);
  assert.deepEqual(generateChunkFauna(world, 0, 0, options), []);
});

test('fauna spatial queries visit local buckets and remove released chunks', () => {
  const index = new FaunaSpatialIndex();
  const near = [{ id: 'fa:near', x: 4, z: 4 }];
  index.set('0,0', near);
  index.set('80,80', [{ id: 'fa:far', x: 2562, z: 2562 }]);
  const query = index.query(5, 5, 10);
  assert.deepEqual(
    query.items.map((item) => item.record.id),
    ['fa:near']
  );
  assert.equal(query.candidatesVisited, 1);
  assert.equal(query.indexed, 2);
  assert.equal(index.remove('0,0'), true);
  assert.equal(index.total, 1);
  assert.equal(index.remove('0,0'), false);
});

test('nearby animal actors are created gradually and disposed when they leave range', async () => {
  class Vector3 {
    constructor(x, y, z) {
      Object.assign(this, { x, y, z });
    }
  }
  const scene = new Set();
  let created = 0,
    disposed = 0;
  const index = new FaunaSpatialIndex();
  index.set('0,0', [
    { id: 'fa:one', species: 'deer', seed: 1, x: 10, y: 3, z: 10, heading: 0 },
    { id: 'fa:two', species: 'fox', seed: 2, x: 14, y: 3, z: 10, heading: 1 }
  ]);
  const actors = new FaunaActors({
    THREE: { Vector3 },
    scene: { add: (value) => scene.add(value), remove: (value) => scene.delete(value) },
    index,
    world: meadow(),
    maximum: 2,
    createAnimal: async () => {
      created++;
      return {
        object: {},
        setLod() {},
        move() {},
        follow() {},
        update() {},
        dispose() {
          disposed++;
        }
      };
    }
  });
  actors.update({ x: 10, z: 10 }, 0.016, 1);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(created, 1);
  assert.equal(actors.actors.size, 1);
  actors.update({ x: 10, z: 10 }, 0.016, 1.6);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(created, 2);
  assert.equal(actors.actors.size, 2);
  actors.update({ x: 100, z: 100 }, 0.016, 2);
  assert.equal(actors.actors.size, 0);
  assert.equal(scene.size, 0);
  assert.equal(disposed, 2);
  actors.dispose();
});

test('ambient motion stops at obstacles and advances over free dry ground', () => {
  const world = meadow();
  const record = { id: 'motion', species: 'deer', seed: 1, x: 16, y: 3, z: 16, heading: 0 };
  const blocked = new FaunaMotion(world, () => true);
  const stopped = blocked.step(record, 0.1);
  assert.equal(stopped.x, 16);
  assert.equal(stopped.z, 16);
  const free = new FaunaMotion(world);
  assert.ok(free.step(record, 0.1).z > 16);
});

test('population quotas total 1024 and preserve all species minimums', () => {
  const quotas = faunaPopulationTargets();
  assert.equal(Object.keys(quotas).length, 22);
  assert.equal(
    Object.values(quotas).reduce((a, b) => a + b, 0),
    1024
  );
  for (const [species, count] of Object.entries(quotas))
    assert.ok(count >= (SMALL_FAUNA.has(species) ? 10 : 5));
  assert.ok(quotas.rabbit > quotas.deer && quotas.deer > quotas.wolf);
});

test('fauna state advances without rendering, uses fixed ticks and exposes detached snapshots', () => {
  const world = generate({ size: 128, seed: 1769 });
  const a = new WorldState(world),
    b = new WorldState(world);
  const pa = a.presentation().fauna,
    pb = b.presentation().fauna;
  const region = { x: 64, z: 64, radius: 180 };
  a.tickFauna(0.1, region);
  b.tickFauna(0.05, region);
  b.tickFauna(0.05, region);
  const qa = pa.query(64, 64, 180),
    qb = pb.query(64, 64, 180);
  assert.deepEqual(qa.items, qb.items);
  assert.equal(pa.diagnostics().ticks, 1);
  const first = qa.items[0].record,
    original = pa.read(first.id);
  first.x = -100;
  first.velocity.x = 999;
  assert.deepEqual(pa.read(first.id), original);
  assert.equal(a.snapshot().version, 1);
  assert.equal('fauna' in a.snapshot(), false);
});

test('aquatic species cannot use each other habitats', () => {
  const world = meadow();
  world.waterKind = new Uint8Array(world.wet.length).fill(1);
  world.lake = new Uint8Array(world.wet.length);
  world.wet.fill(1);
  assert.equal(Boolean(aquaticHabitat(world, 'shark', 10, 10)), true);
  assert.equal(Boolean(aquaticHabitat(world, 'fish', 10, 10)), false);
  world.waterKind.fill(2);
  world.lake.fill(2);
  assert.equal(Boolean(aquaticHabitat(world, 'shark', 10, 10)), false);
  assert.equal(Boolean(aquaticHabitat(world, 'fish', 10, 10)), true);
});

test('presentation forwards supported actions once and preserves native idle instead of following zero velocity', async () => {
  class Vector3 {}
  const index = new FaunaSpatialIndex();
  const record = { id: 'action', species: 'deer', seed: 1, x: 10, y: 3, z: 10, heading: 0 };
  index.set('0,0', [record]);
  let action = 'eat',
    plays = 0,
    follows = 0,
    stops = 0;
  const view = new FaunaActors({
    THREE: { Vector3 },
    scene: { add() {}, remove() {} },
    index,
    world: meadow(),
    readState: () => ({ ...record, action, velocity: { x: 0, y: 0, z: 0 } }),
    createAnimal: async () => ({
      object: {},
      actions: ['eat'],
      gaits: ['walk'],
      move() {},
      setLod() {},
      update() {},
      dispose() {},
      follow() {
        follows++;
      },
      play() {
        plays++;
        return Promise.resolve();
      },
      stopAction() {
        stops++;
      }
    })
  });
  view.update({ x: 10, z: 10 }, 0.1, 1);
  await new Promise((resolve) => setImmediate(resolve));
  view.update({ x: 10, z: 10 }, 0.1, 1.1);
  view.update({ x: 10, z: 10 }, 0.1, 1.2);
  assert.equal(plays, 1);
  assert.equal(follows, 0);
  action = 'idle';
  view.update({ x: 10, z: 10 }, 0.1, 1.3);
  assert.equal(stops, 1);
  view.dispose();
});


function actorFixture({ records, createAnimal, readState, visible } = {}) {
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { Object.assign(this, { x, y, z }); }
    copy(p) { Object.assign(this, { x: p.x, y: p.y, z: p.z }); return this; }
  }
  const index = new FaunaSpatialIndex();
  index.set('0,0', records);
  const scene = new Set();
  const makeAnimal = () => ({
    object: {}, position: new Vector3(), move() {}, follow() {}, update() {}, dispose() {}
  });
  const view = new FaunaActors({ THREE: { Vector3 }, index, world: meadow(),
    scene: { add: o => scene.add(o), remove: o => scene.delete(o) },
    createAnimal: createAnimal ?? (async () => makeAnimal()), readState, visible });
  return { view, scene, makeAnimal };
}
const flushActors = () => new Promise(resolve => setImmediate(resolve));

test('animal construction fills free slots between spatial plans and stays bounded', async () => {
  const records = Array.from({ length: 4 }, (_, i) =>
    ({ id: 'queue:' + i, species: 'deer', seed: i, x: 10 + i, y: 3, z: 10, heading: 0 }));
  const completions = [];
  const { view, makeAnimal } = actorFixture({ records,
    createAnimal: () => new Promise(resolve => completions.push(resolve)) });
  view.update({ x: 10, z: 10 }, .016, 1);
  await flushActors();
  assert.equal(view.initialReady(), false);
  view.update({ x: 10, z: 10 }, .016, 1.016);
  await flushActors();
  view.update({ x: 10, z: 10 }, .016, 1.032);
  assert.equal(completions.length, 2);
  assert.equal(view.pending.size, 2);
  completions[0](makeAnimal());
  await flushActors();
  view.update({ x: 10, z: 10 }, .016, 1.048);
  await flushActors();
  assert.equal(completions.length, 3, 'does not wait 450 ms to reuse a free slot');
  assert.equal(view.pending.size, 2);
  view.dispose();
  completions[1](makeAnimal());
  completions[2](makeAnimal());
  await flushActors();
  assert.equal(view.actors.size, 0);
  assert.equal(view.pending.size, 0);
});

test('animals preload outside the screen and survive small camera boundary changes', async () => {
  let screenX = 1.2, builds = 0;
  const record = { id: 'edge', species: 'deer', seed: 1, x: 10, y: 3, z: 10, heading: 0 };
  const { view, makeAnimal } = actorFixture({ records: [record],
    visible: (_, margin = 1.05) => screenX <= margin,
    createAnimal: async () => { builds++; return makeAnimal(); } });
  view.update({ x: 10, z: 10 }, .016, 1);
  await flushActors();
  assert.equal(view.actors.size, 1, 'prepared before entering the viewport');
  screenX = 1.5;
  view.update({ x: 10, z: 10 }, .016, 1.6);
  assert.equal(view.actors.size, 1, 'retention margin avoids disposal at the load boundary');
  screenX = 1.1;
  view.update({ x: 10, z: 10 }, .016, 2.2);
  assert.equal(builds, 1);
  screenX = 2;
  view.update({ x: 10, z: 10 }, .016, 2.8);
  assert.equal(view.actors.size, 0);
  view.dispose();
});

test('late animal builds start at authoritative position and idle stays synchronized', async () => {
  const record = { id: 'late', species: 'deer', seed: 1, x: 10, y: 3, z: 10, heading: 0 };
  let current = { ...record }, finish;
  const { view, scene, makeAnimal } = actorFixture({ records: [record], readState: () => current,
    createAnimal: () => new Promise(resolve => { finish = resolve; }) });
  view.update({ x: 10, z: 10 }, .016, 1);
  await flushActors();
  current = { ...record, x: 18, velocity: { x: 0, y: 0, z: 0 } };
  const animal = makeAnimal();
  finish(animal);
  await flushActors();
  assert.equal(animal.position.x, 18);
  assert.equal(scene.size, 1);
  assert.equal(view.initialReady(), true);
  current = { ...current, x: 19 };
  view.update({ x: 10, z: 10 }, .016, 1.016);
  assert.equal(animal.position.x, 19);
  view.update({ x: 10, z: 10 }, 0, 1.4);
  assert.equal(view.actors.get(record.id).arrival.value, 1, 'arrival completes even when animation dt is zero');
  view.dispose();
});


test('prefetched offscreen animals detach without disposal and resume at current state', async () => {
  let screenX = 0, updates = 0, disposed = 0;
  const record = { id: 'sleeping', species: 'deer', seed: 1, x: 10, y: 3, z: 10, heading: 0 };
  let state = record;
  const { view, scene, makeAnimal } = actorFixture({ records: [record], readState: () => state,
    visible: (_, margin = 1.05) => screenX <= margin,
    createAnimal: async () => ({ ...makeAnimal(), update() { updates++; }, dispose() { disposed++; } }) });
  view.update({ x: 10, z: 10 }, .016, 1);
  await flushActors();
  view.update({ x: 10, z: 10 }, .016, 1.016);
  const before = updates;
  screenX = 1.3;
  view.update({ x: 10, z: 10 }, .016, 1.032);
  assert.equal(scene.size, 0);
  assert.equal(updates, before);
  assert.equal(disposed, 0);
  assert.equal(view.actors.size, 1);
  state = { ...record, x: 18 };
  screenX = 0;
  view.animationInterval = 1 / 30;
  view.update({ x: 10, z: 10 }, .001, 1.033);
  assert.equal(scene.size, 1);
  assert.equal(view.actors.get(record.id).animal.position.x, 18);
  assert.equal(updates, before + 1);
  view.dispose();
});

test('distant animation does less work while conserving elapsed animation time', async () => {
  const record = { id: 'cadence', species: 'deer', seed: 1, x: 10, y: 3, z: 10, heading: 0 };
  let updates = 0, elapsed = 0;
  const { view, makeAnimal } = actorFixture({ records: [record],
    createAnimal: async () => ({ ...makeAnimal(), update(dt) { updates++; elapsed += dt; } }) });
  view.update({ x: 10, z: 10 }, 0, 1);
  await flushActors();
  updates = 0;
  view.animationInterval = 1 / 30;
  for (let i = 1; i <= 120; i++) view.update({ x: 10, z: 10 }, 1 / 120, 1 + i / 120);
  assert.equal(updates, 30);
  assert.ok(Math.abs(elapsed + view.actors.get(record.id).animationTime - 1) < 1e-8);
  assert.equal(view.actors.size, 1);
  view.dispose();
});

test('temperate catalog excludes savanna predators from the world and population', () => {
  assert.equal(FAUNA_SPECIES.lion, undefined);
  assert.equal(FAUNA_SPECIES.cheetah, undefined);
  assert.equal(faunaPopulationTargets().lion, undefined);
  assert.equal(faunaPopulationTargets().cheetah, undefined);
});

test('cows, foxes and chickens receive repeatable individual coat and breed variants', () => {
  for (const species of ['cow', 'fox', 'chicken']) {
    const variants = FAUNA_SPECIES[species].variants;
    const records = Array.from({ length: 128 }, (_, i) => ({
      species, id: `population:1:1769:${species}:${i}`, seed: Math.imul(i + 1, 7919) >>> 0
    }));
    const appearances = records.map(faunaAppearanceOptions);
    assert.deepEqual(records.map(faunaAppearanceOptions), appearances, 'same world and IDs reproduce appearance');
    assert.deepEqual(new Set(appearances.map(a => a.variant)), new Set(variants));
    assert.ok(new Set(appearances.map(a => a.seed + ':' + a.variant)).size > variants.length);
    assert.ok(appearances.every(a => a.seed === 1769 || a.seed === 1770));
  }
  const wolf = { species: 'wolf', id: 'wolf:1', seed: 4 };
  assert.deepEqual(faunaAppearanceOptions(wolf), { seed: 1769 }, 'legacy bakes remain available');
});

test('ambient pauses are staggered per individual, not synchronized to every 15-second cycle', () => {
  const simulation = new FaunaMotion(meadow());
  const first = simulation.step({ id: 'rest-a', species: 'deer', seed: 0,
    x: 16, y: 3, z: 16, heading: 0 }, 0.1);
  const second = simulation.step({ id: 'rest-b', species: 'deer', seed: 1,
    x: 18, y: 3, z: 18, heading: 0 }, 0.1);
  assert.equal(first.z, 16);
  assert.ok(second.z > 18);
});
