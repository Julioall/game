import test from 'node:test';
import assert from 'node:assert/strict';
import { waterGeometry, outerOceanGeometry } from '../src/render/water-geometry.js';
import { sampleWater } from '../src/world/terrain/water.js';

function fixture(size = 32) {
  const stride = size + 1, n = stride ** 2;
  return { config: { size }, stride, ground: new Float32Array(n),
    surface: new Float32Array(n).fill(1), wet: new Float32Array(n).fill(-1),
    waterKind: new Uint8Array(n).fill(3) };
}

test('water triangles match clipped physical depth and never cover dry land', () => {
  const world = fixture();
  assert.equal(waterGeometry(world, 0, 0), null);
  world.wet[0] = 1;
  const geometry = waterGeometry(world, 0, 0);
  const { position, waterData, waterFlow } = geometry.attributes;
  assert.equal(position.count, 3);
  let x = 0, y = 0, z = 0, depth = 0;
  for (let i = 0; i < 3; i++) {
    x += position.getX(i) / 3; y += position.getY(i) / 3; z += position.getZ(i) / 3;
    depth += waterData.getX(i) / 3;
    assert.equal(waterFlow.getX(i), 1);
    assert.equal(waterFlow.getY(i), 0);
  }
  const physical = sampleWater(world, x, z);
  assert.ok(physical);
  assert.ok(Math.abs(y - physical.surface - .012) < 1e-6);
  assert.ok(Math.abs(depth - physical.depth) < 1e-6);
  geometry.dispose();
});

test('adjacent wet chunks agree at their boundary and keep water classification', () => {
  const world = fixture(64);
  world.wet.fill(1); world.waterKind.fill(1);
  const a = waterGeometry(world, 0, 0), b = waterGeometry(world, 1, 0);
  const edge = g => {
    const { position, waterData } = g.attributes, vertices = new Set();
    for (let i = 0; i < position.count; i++) if (position.getX(i) === 32) {
      vertices.add([position.getY(i), position.getZ(i), waterData.getX(i), waterData.getZ(i)].join(','));
    }
    return [...vertices].sort();
  };
  assert.deepEqual(edge(a), edge(b));
  assert.equal(edge(a).length, 33);
  a.dispose(); b.dispose();
});

test('external ocean strips exclude the map interior and have consistent sea height', () => {
  const size = 1024, geometry = outerOceanGeometry(size);
  const { position, waterData } = geometry.attributes;
  assert.equal(position.count, 24);
  for (let i = 0; i < position.count; i += 3) {
    let x = 0, z = 0;
    for (let j = i; j < i + 3; j++) {
      x += position.getX(j) / 3; z += position.getZ(j) / 3;
      assert.ok(Math.abs(position.getY(j) - .012) < 1e-6);
      assert.equal(waterData.getY(j), 0);
      assert.equal(waterData.getZ(j), 1);
    }
    assert.ok(x <= 0 || z <= 0 || x >= size || z >= size);
  }
  geometry.dispose();
});
