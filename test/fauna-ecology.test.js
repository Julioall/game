import test from 'node:test';
import assert from 'node:assert/strict';
import { FaunaEcology } from '../src/world/fauna-ecology.js';

function world() {
  const stride = 65, size = 64, n = stride * stride;
  const wet = new Float32Array(n).fill(-1);
  const waterKind = new Uint8Array(n);
  for (let z = 29; z <= 32; z++) for (let x = 29; x <= 32; x++) {
    wet[z * stride + x] = 1;
    waterKind[z * stride + x] = 2;
  }
  return { config: { size, seed: 1769 }, stride, wet, waterKind,
    biome: new Uint8Array(n).fill(2), slope: new Float32Array(n),
    ground: new Float32Array(n).fill(1) };
}
const animal = (species, id, x = 26, z = 29) =>
  ({ id, species, seed: 1769, x, y: 1, z, heading: 0 });

test('same ID/seed has deterministic needs and decision independent of renderer', () => {
  const w = world(), record = animal('cow', 'cow:a');
  const a = new FaunaEcology(w), b = new FaunaEcology(w);
  assert.deepEqual(a.read(record.id), b.read(record.id));
  const first = a.plan(record, .1), second = b.plan(record, .1);
  assert.deepEqual(first, second);
  assert.deepEqual(a.read(record.id), b.read(record.id));
});

test('thirsty cows seek a fresh bank and do not treat sea as drinkable', () => {
  const w = world(), cow = animal('cow', 'cow:drink');
  const ecology = new FaunaEcology(w);
  ecology.state(cow).needs.thirst = .98;
  const plan = ecology.plan(cow, .1);
  assert.equal(plan.goal, 'drink');
  assert.ok(plan.target);
  const target = { ...cow, ...plan.target };
  const stopped = ecology.plan(target, .1);
  assert.equal(stopped.action, 'drink');
  const before = ecology.state(cow).needs.thirst;
  ecology.resolve(cow, target, stopped, .5);
  assert.ok(ecology.state(cow).needs.thirst < before);
  // Replace the entire freshwater body by seawater.
  w.waterKind.fill(1);
  assert.equal(ecology.nearest(cow, 'drink', 0), null);
});

test('chickens flee nearby foxes and fox attacks change prey health', () => {
  const w = world(), ecology = new FaunaEcology(w);
  const chicken = animal('chicken', 'hen', 18, 18);
  const fox = animal('fox', 'fox', 18.3, 18.4);
  assert.equal(ecology.plan(chicken, .1, [fox]).goal, 'flee');
  ecology.state(fox).needs.hunger = .98;
  const attack = ecology.plan(fox, .1, [chicken]);
  assert.equal(attack.goal, 'hunt');
  const before = ecology.state(chicken).needs.health;
  ecology.resolve(fox, fox, attack, .1, [chicken]);
  assert.ok(ecology.state(chicken).needs.health < before);
});

test('forage is shared finite stock, consumption never goes negative', () => {
  const w = world(), ecology = new FaunaEcology(w);
  const amount = ecology.food(12, 12, 0);
  assert.ok(amount > 0);
  assert.equal(ecology.forage.size, 0, 'perception does not allocate resource records');
  let total = 0;
  for (let i = 0; i < 40; i++) total += ecology.food(12, 12, 0, 1);
  assert.ok(total <= amount + 1e-9);
  assert.equal(ecology.food(12, 12, 0), 0);
  assert.ok(ecology.food(12, 12, 100) > 0, 'resource regrows over simulation time');
});
