import test from 'node:test';
import assert from 'node:assert/strict';
import { configuration, generate } from '../src/world/generate.js';
import { geography } from '../src/world/terrain/relief.js';
import { hydrology } from '../src/world/terrain/hydrology.js';
import { coastDistances, lakeFedChannels } from '../src/world/terrain/lake-outlets.js';
import { savedGeneration } from '../src/platform/local-save.js';

test('all new river reaches originate in inland lakes and continue to the sea', () => {
  for (const seed of [1769, 454, 12]) {
    const config = configuration({ seed, size: 512, hydrology: 6 });
    const relief = geography(config, 513);
    const { fields, drainage, lake } = hydrology(config, 513, relief);
    const coast = coastDistances(relief.raw, 513, relief.sea);
    const covered = new Uint8Array(lake.length);
    assert.ok(fields.headwaters.length > 0);
    assert.ok(fields.edges > 0);
    assert.ok(!lake.includes(2), 'no artificial source ponds');
    for (const source of fields.headwaters) {
      assert.equal(lake[source], 1);
      assert.ok(coast[source] >= config.size * .08);
      let i = source, steps = 0;
      while (relief.raw[i] > relief.sea) {
        assert.ok(++steps < lake.length, 'no cycle or termination on dry map border');
        assert.ok(lake[i] || fields.river[i], 'no detached channel');
        assert.ok(fields.wet[i] > 0);
        covered[i] = 1;
        const j = drainage.downstream[i];
        assert.ok(j >= 0);
        assert.ok(drainage.filled[j] <= drainage.filled[i]);
        i = j;
      }
      assert.equal(fields.waterKind[i], 1);
    }
    for (let i = 0; i < lake.length; i++) if (fields.river[i]) assert.equal(covered[i], 1);
    const again = hydrology(config, 513, relief);
    assert.deepEqual(fields.headwaters, again.fields.headwaters);
    assert.deepEqual(fields.river, again.fields.river);
  }
});

test('coastal lakes and routes ending on a dry boundary cannot become sources', () => {
  const stride = 65, n = stride ** 2;
  const raw = new Float32Array(n).fill(2), lake = new Uint8Array(n);
  const downstream = new Int32Array(n).fill(-1), flux = new Float32Array(n).fill(1000);
  const filled = raw.slice(), order = Int32Array.from({ length: n }, (_, i) => i);
  // Ocean at x=0, lake only three cells inland, with a complete ocean route.
  for (let z = 0; z < stride; z++) raw[z * stride] = 0;
  lake[3] = 1;
  downstream[3] = 2; downstream[2] = 1; downstream[1] = 0;
  // Inland lake that drains into dry terrain at the map boundary.
  lake[40] = 1;
  downstream[40] = 39;
  const river = new Uint8Array(n).fill(1);
  assert.deepEqual(lakeFedChannels({ size: 64, lakes: 1, rivers: 1 }, raw, lake,
    { downstream, flux, filled, order }, stride, 0, river, 1), []);
  assert.ok(river.every(value => value === 0));
});

test('disabled lakes or rivers leave no channels; version 5 saves retain their generation', () => {
  for (const options of [{ lakes: 0 }, { rivers: 0 }]) {
    const world = generate({ size: 256, ...options });
    assert.equal(world.metrics.riverEdges, 0);
    assert.equal(world.headwaters.length, 0);
  }
  const config = configuration({ size: 512 }), previous = { ...config, hydrology: 5 };
  const key = 'kingdom:1:' + JSON.stringify(previous);
  const saved = JSON.stringify({ version: 1, removed: ['t:1:2'] });
  assert.deepEqual(savedGeneration(config, { getItem: k => k === key ? saved : null }), previous);
  const world = generate(config);
  assert.equal(world.metrics.headwaterPonds, 0);
  assert.ok(world.metrics.lakeOutlets > 0);
  assert.equal(world.metrics.brokenRivers, 0);
  assert.equal(world.metrics.invalidSites, 0);
});


test('version 9 gives every retained lake a river route to the sea', () => {
  for (const seed of [1769, 454, 12]) {
    const config = configuration({ seed, size: 512, hydrology: 9 });
    const relief = geography(config, 513);
    const { fields, drainage, lake, count } = hydrology(config, 513, relief);
    assert.ok(count > 0);
    const coast = coastDistances(relief.raw, 513, relief.sea);
    for (let k = 0; k < lake.length; k++) if (lake[k]) assert.ok(coast[k] >= config.size * .08);
    for (let start = 0; start < lake.length; start++) {
      if (!lake[start]) continue;
      let i = start, steps = 0;
      while (relief.raw[i] > relief.sea) {
        assert.ok(++steps < lake.length);
        assert.ok(lake[i] || fields.river[i], 'continuous outlet after every lake');
        i = drainage.downstream[i];
        assert.ok(i >= 0);
      }
    }
  }
});


test('isolated low depressions are not classified as ocean', () => {
  const stride = 65, raw = new Float32Array(stride ** 2).fill(1);
  for (let z = 0; z < stride; z++) raw[z * stride] = -1;
  const center = 32 * stride + 32;
  raw[center] = -2;
  const relief = { raw, rain: new Float32Array(raw.length).fill(1), heat: new Float32Array(raw.length).fill(.8), sea: 0 };
  const { fields } = hydrology(configuration({size: 64, hydrology: 9}), stride, relief);
  assert.notEqual(fields.waterKind[center], 1);
  assert.equal(fields.waterKind[0], 1);
  assert.equal(raw[center], -2, 'input terrain is not mutated');
});
