import test from 'node:test';
import assert from 'node:assert/strict';
import { configuration, generate } from '../src/world/generate.js';
import { geography } from '../src/world/terrain/relief.js';
import { hydrology } from '../src/world/terrain/hydrology.js';
import { savedGeneration } from '../src/platform/local-save.js';

test('curved channels reproduce, keep their spine wet and drain without cycles or uphill links', () => {
  for (const seed of [1769, 454, 12]) {
    const config = configuration({ seed, size: 512, hydrology: 5 });
    const relief = geography(config, 513);
    const a = hydrology(config, 513, relief);
    const b = hydrology(config, 513, relief);
    assert.deepEqual(a.fields.ground, b.fields.ground);
    assert.deepEqual(a.drainage.downstream, b.drainage.downstream);
    const { order, downstream, filled, flux } = a.drainage;
    const rank = new Int32Array(order.length);
    order.forEach((i, p) => { rank[i] = p; });
    let incoming = 0, outgoing = 0;
    for (let i = 0; i < order.length; i++) {
      const j = downstream[i];
      if (j >= 0) {
        assert.ok(rank[j] < rank[i]);
        assert.ok(filled[j] <= filled[i]);
      } else outgoing += flux[i];
      if (relief.raw[i] > relief.sea) incoming += relief.rain[i] ** 2;
      if (a.fields.river[i]) assert.ok(a.fields.wet[i] > 0);
    }
    assert.ok(Math.abs(incoming - outgoing) / incoming < 1e-5);
    assert.ok(a.fields.edges > 0);
    const legacy = configuration({ ...config, hydrology: 4 });
    const old = hydrology(legacy, 513, geography(legacy, 513));
    assert.notDeepEqual(a.fields.wet, old.fields.wet);
  }
});

test('new generation preserves version 4 saves and produces valid settlement sites', () => {
  const config = configuration({ size: 512 });
  assert.equal(config.hydrology, 8);
  const previous = { ...config, hydrology: 4 };
  const key = 'kingdom:1:' + JSON.stringify(previous);
  const saved = JSON.stringify({ version: 1, removed: ['t:1:2'] });
  assert.deepEqual(savedGeneration(config, { getItem: k => k === key ? saved : null }), previous);
  const world = generate(config);
  assert.equal(world.metrics.brokenRivers, 0);
  assert.equal(world.metrics.invalidSites, 0);
});
