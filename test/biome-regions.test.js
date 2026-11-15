import test from 'node:test';
import assert from 'node:assert/strict';
import { ecology } from '../src/world/ecology.js';
import { configuration, generate } from '../src/world/generate.js';
import { savedGeneration } from '../src/platform/local-save.js';

function patchStats(biome, stride) {
  const seen = new Uint8Array(biome.length), areas = [];
  const queue = new Int32Array(biome.length);
  let borders = 0;
  for (let i = 0; i < biome.length; i++) {
    const x = i % stride, z = Math.floor(i / stride);
    if (x && biome[i] !== biome[i - 1]) borders++;
    if (z && biome[i] !== biome[i - stride]) borders++;
    if (seen[i]) continue;
    queue[0] = i; seen[i] = 1;
    let size = 1;
    for (let p = 0; p < size; p++) {
      const k = queue[p], a = k % stride, b = Math.floor(k / stride);
      for (const j of [a ? k - 1 : -1, a + 1 < stride ? k + 1 : -1,
        b ? k - stride : -1, b + 1 < stride ? k + stride : -1]) {
        if (j < 0 || seen[j] || biome[j] !== biome[i]) continue;
        seen[j] = 1; queue[size++] = j;
      }
    }
    areas.push(size);
  }
  return { borders, areas: areas.sort((a, b) => b - a) };
}

test('regional biomes form broad connected masses with subordinate small patches', () => {
  const stride = 513, n = stride ** 2;
  const fields = { wet: new Float32Array(n).fill(-1), ground: new Float32Array(n).fill(4) };
  const rain = new Float32Array(n).fill(.57), heat = new Float32Array(n).fill(.6);
  for (const seed of [1769, 454, 12]) {
    const config = configuration({ size: 512, seed });
    const old = ecology({ ...config, hydrology: 7 }, stride, fields, rain, heat);
    const current = ecology(config, stride, fields, rain, heat);
    const before = patchStats(old.biome, stride), after = patchStats(current.biome, stride);
    assert.ok(after.borders < before.borders * .5, 'less fragmentation on the same flat climate');
    assert.ok(after.areas[0] > 10000, 'large continuous region');
    assert.ok(after.areas.some(area => area >= 50 && area <= 2000), 'smaller organic patches remain');
    assert.deepEqual(current.biome, ecology(config, stride, fields, rain, heat).biome);
  }
});

test('regional generation retains hydrology and old progress under its own version', () => {
  const config = configuration({ size: 256 });
  assert.equal(config.hydrology, 8);
  const previous = { ...config, hydrology: 7 };
  const key = 'kingdom:1:' + JSON.stringify(previous);
  assert.deepEqual(savedGeneration(config, { getItem: k => k === key
    ? JSON.stringify({ version: 1, removed: ['t:1:2'] }) : null }), previous);
  const old = generate(previous), current = generate(config);
  for (const field of ['ground', 'wet', 'surface', 'waterKind', 'river', 'lake']) {
    assert.deepEqual(current[field], old[field]);
  }
  assert.equal(current.metrics.brokenRivers, 0);
  assert.equal(current.metrics.invalidSites, 0);
});
