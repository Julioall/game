import test from 'node:test';
import assert from 'node:assert/strict';
import { configuration, generate } from '../src/world/generate.js';
import { geography } from '../src/world/terrain/relief.js';
import { hydrology } from '../src/world/terrain/hydrology.js';
import { coldWaterMask } from '../src/world/terrain/cold-water.js';
import { savedGeneration } from '../src/platform/local-save.js';

test('cold regions have no freshwater and warm lake outlets stay connected to the sea', () => {
  for (const seed of [1769, 454, 12]) {
    const config = configuration({ size: 512, seed });
    const relief = geography(config, 513);
    const blocked = coldWaterMask(config, relief.raw, relief.heat, 513);
    const { fields, lake, drainage } = hydrology(config, 513, relief);
    assert.ok(blocked.includes(1));
    assert.ok(fields.edges > 0);
    for (let i = 0; i < blocked.length; i++) {
      if (!blocked[i]) continue;
      assert.equal(lake[i], 0);
      assert.equal(fields.river[i], 0);
      assert.ok(fields.waterKind[i] < 2);
    }
    for (const source of fields.headwaters) {
      let i = source, steps = 0;
      while (relief.raw[i] > relief.sea) {
        assert.ok(++steps < lake.length);
        assert.ok(lake[i] || fields.river[i]);
        assert.ok(fields.wet[i] > 0);
        i = drainage.downstream[i];
        assert.ok(i >= 0);
      }
    }
  }
});

test('fully cold terrain rejects freshwater while version 6 saves remain available', () => {
  const config = configuration({ size: 256 });
  assert.equal(config.hydrology, 9);
  const relief = geography(config, 257);
  relief.heat.fill(.1);
  const result = hydrology(config, 257, relief);
  assert.equal(result.count, 0);
  assert.equal(result.fields.edges, 0);
  assert.ok(!result.fields.waterKind.some(value => value >= 2));
  const previous = { ...config, hydrology: 6 };
  const key = 'kingdom:1:' + JSON.stringify(previous);
  assert.deepEqual(savedGeneration(config, { getItem: k => k === key
    ? JSON.stringify({ version: 1, removed: ['t:1:2'] }) : null }), previous);
  const world = generate({ size: 512 });
  assert.equal(world.metrics.brokenRivers, 0);
  assert.equal(world.metrics.invalidSites, 0);
});
