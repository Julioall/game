import { WorldState } from '../src/world/state.js';
import { generate } from '../src/world/generate.js';
import { aquaticHabitat } from '../src/world/fauna.js';
import { faunaPopulationTargets, SMALL_FAUNA } from '../src/world/fauna.js';
import { FaunaMotion } from '../src/world/fauna-motion.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateChunkFauna, FaunaSpatialIndex } from '../src/world/fauna.js';
import { FaunaActors } from '../src/render/fauna.js';

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
  assert.equal(Object.keys(quotas).length, 24);
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
