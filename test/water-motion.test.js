import test from 'node:test';
import assert from 'node:assert/strict';
import { waterMotion, waterPhases } from '../src/render/water-motion.js';
import { waterGeometry } from '../src/render/water-geometry.js';

function receiver(kind = 2) {
  const stride = 65, n = stride ** 2;
  return { stride, config: { size: 64 }, ground: new Float32Array(n),
    surface: new Float32Array(n).fill(2), wet: new Float32Array(n).fill(1),
    waterKind: new Uint8Array(n).fill(kind) };
}
const mouth = kind => ({ x: 16, z: 32, dx: 1, dz: 0, level: 2, kind, width: 2, length: 24 });

test('both sea and lake plumes spread and fade without passing through dry ground or other water bodies', () => {
  for (const kind of [1, 2]) {
    const world = receiver(kind), mouths = [mouth(kind)];
    const at = (x, z = 32) => waterMotion(world, x, z, kind, mouths);
    assert.ok(at(18).flow[0] > at(25).flow[0]);
    assert.ok(at(25).flow[0] > at(35).flow[0]);
    assert.ok(at(25, 34).flow[0] > 0);
    assert.deepEqual(at(41).flow, [0, 0]);
    assert.ok(at(25).transition[0] > 0);
    assert.ok(at(18).transition[1] < at(35).transition[1]);
    assert.ok(at(25, 34).transition[2] > 0);
    world.wet[32 * 65 + 23] = -1;
    assert.deepEqual(at(32).flow, [0, 0]);
    world.wet[32 * 65 + 23] = 1;
    world.surface[32 * 65 + 23] = 4;
    assert.deepEqual(at(32).flow, [0, 0]);
    assert.deepEqual(waterMotion(receiver(3 - kind), 25, 32, 3 - kind, mouths).flow, [0, 0]);
  }
});

test('river direction smoothing is unit length and stays local to the same water level', () => {
  const world = receiver(3);
  const index = 32 * 65 + 32;
  world.waterKind[index + 1] = 4;
  const result = waterMotion(world, 32, 32, 3);
  assert.ok(result.flow[0] > 0 && result.flow[1] > 0);
  assert.ok(Math.abs(Math.hypot(...result.flow) - 1) < 1e-9);
  world.surface[index + 1] = 5;
  assert.deepEqual(waterMotion(world, 32, 32, 3).flow, [1, 0]);
});

test('mouth motion attributes agree at chunk edges', () => {
  const world = receiver(1), mouths = [mouth(1)];
  const a = waterGeometry(world, 0, 0, mouths), b = waterGeometry(world, 1, 0, mouths);
  const edge = g => {
    const { position, waterFlow, waterTransition } = g.attributes, entries = new Set();
    for (let i = 0; i < position.count; i++) if (position.getX(i) === 32) {
      entries.add([position.getZ(i), waterFlow.getX(i), waterFlow.getY(i),
        waterTransition.getX(i), waterTransition.getY(i), waterTransition.getZ(i)].join(','));
    }
    return [...entries].sort();
  };
  assert.deepEqual(edge(a), edge(b));
  a.dispose(); b.dispose();
});

test('overlapping flow phases remain bounded and continuous at resets, including long sessions', () => {
  const sample = t => {
    const p = waterPhases(t);
    assert.ok([p.first, p.second, p.blend].every(value => value >= 0 && value <= 1));
    return Math.sin(2.3 - p.first * 3.1) * (1 - p.blend) + Math.sin(2.3 - p.second * 3.1) * p.blend;
  };
  for (const t of [0, 4, 8, 12, 1000000]) {
    assert.ok(Math.abs(sample(t - 1e-6) - sample(t + 1e-6)) < 1e-5);
  }
  assert.ok(Math.abs(sample(1) - sample(1000001)) < 1e-9);
});
