import test from 'node:test';
import assert from 'node:assert/strict';
import { natureKey, natureGeometry } from '../src/render/nature-models.js';
import { modelBank } from '../src/render/vegetation.js';
import { SPECIES } from '../src/world/catalog.js';

test('nature models fit existing species envelopes and keep finite vertex colors', () => {
  for (const species of ['oak', 'birch', 'pine', 'willow']) {
    for (const style of ['spring', 'autumn']) for (let variant = 0; variant < 5; variant++) {
      const g = natureGeometry({ kind: 'tree', species, variant }, style);
      const b = g.boundingBox, r = SPECIES[species].radius;
      assert.ok(Math.abs(b.min.y) < 1e-5);
      assert.ok(Math.abs(b.max.y - SPECIES[species].height) < 1e-5);
      assert.ok(Math.max(Math.abs(b.min.x), Math.abs(b.max.x), Math.abs(b.min.z), Math.abs(b.max.z)) <= r + 1e-5);
      assert.equal(g.attributes.color.count, g.attributes.position.count);
      const colors = g.attributes.color;
      for (let i = 0; i < colors.count; i++)
        assert.ok([colors.getX(i), colors.getY(i), colors.getZ(i)].every(x => Number.isFinite(x) && x >= 0 && x <= 1));
      assert.ok(Array.from(g.index.array).every(x => x < g.attributes.position.count));
      g.dispose();
    }
  }
});

test('nature uses shared variants and keeps procedural fallbacks', () => {
  const bank = modelBank('autumn');
  const tree = { kind: 'tree', species: 'oak', variant: 0 };
  assert.equal(bank.get(tree, false), bank.get({ ...tree, variant: 2 }, false));
  assert.ok(bank.get(tree, false).userData.natureKey);
  for (const species of ['oak', 'birch', 'pine', 'willow']) {
    for (let variant = 0; variant < 5; variant++) {
      const object = { kind: 'tree', species, variant };
      const near = bank.get(object, false), far = bank.get(object, true);
      assert.equal(far.userData.natureKey, near.userData.natureKey);
      assert.ok(far.index.count < near.index.count);
      assert.deepEqual(far.boundingBox, near.boundingBox);
      assert.deepEqual(far.attributes.color.array, near.attributes.color.array);
      assert.deepEqual(far.attributes.natureSurface.array, near.attributes.natureSurface.array);
    }
  }
  assert.equal(natureKey({ ...tree, species: 'acacia' }, 'autumn'), null);
  assert.equal(bank.get({ ...tree, species: 'acacia' }, false).userData.natureKey, undefined);
  for (let variant = 0; variant < 5; variant++) {
    const g = bank.get({ kind: 'rock', variant }, false);
    assert.ok(g.userData.natureKey.startsWith('Rock_'));
    assert.ok(bank.get({ kind: 'rock', variant }, true).index.count <= g.index.count);
  }
  bank.clear();
});
