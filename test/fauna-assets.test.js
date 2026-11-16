import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { createBakedFactory } from '../src/render/fauna-assets.js';

test('baked fauna shares downloaded data while creating independent animals', async () => {
  let requests = 0;
  const calls = [];
  const factory = createBakedFactory(async (species, options) => {
    calls.push({ species, options }); return { id: calls.length };
  }, { baseUrl: '/game/', fetchAsset: async url => {
    assert.equal(url, '/game/fauna/pig-1769.animal.gz');
    requests++;
    return new Response(gzipSync('PANM-fixture'));
  } });
  const options = { quality: 'low', seed: 1769, position: { x: 5, y: 3, z: 8 } };
  const [a, b] = await Promise.all([factory('pig', options), factory('pig', options)]);
  assert.notEqual(a.id, b.id);
  assert.equal(requests, 1);
  assert.equal(calls[0].options.baked, calls[1].options.baked);
  assert.equal(new TextDecoder().decode(calls[0].options.baked), 'PANM-fixture');
  assert.equal(calls[0].options.position, options.position);
  assert.deepEqual(factory.bakeStats, { loaded: 1, failures: 0 });
});

test('fauna accepts gzip already decoded by the HTTP host', async () => {
  let received;
  const factory = createBakedFactory(async (_, options) => { received = options.baked; }, {
    fetchAsset: async () => new Response('PANM-decoded', { headers: { 'Content-Encoding': 'gzip' } })
  });
  await factory('pig', { quality: 'low', seed: 1769 });
  assert.equal(new TextDecoder().decode(received), 'PANM-decoded');
  assert.equal(factory.bakeStats.failures, 0);
});

test('missing fauna assets fall back once per appearance without blocking other profiles', async () => {
  let requests = 0;
  const calls = [];
  const factory = createBakedFactory(async (_, options) => { calls.push(options); }, {
    fetchAsset: async () => { requests++; return new Response('', { status: 404 }); }
  });
  const options = { quality: 'low', seed: 1769 };
  await factory('pig', options);
  await factory('pig', options);
  await factory('pig', { ...options, quality: 'high' });
  assert.equal(requests, 1);
  assert.equal(calls[0], options);
  assert.equal(calls[1], options);
  assert.equal(calls[2].baked, undefined);
  assert.equal(factory.bakeStats.failures, 1);
});

test('explicit coat variants never load a different baked appearance', async () => {
  let requests = 0;
  let supplied;
  const factory = createBakedFactory(async (_species, options) => {
    supplied = options;
    return {};
  }, { fetchAsset: async () => { requests++; throw new Error('must not load old bake'); } });
  await factory('cow', { seed: 1769, quality: 'low', variant: 'hereford' });
  assert.equal(requests, 0);
  assert.equal(supplied.variant, 'hereford');
  assert.equal(supplied.baked, undefined);
});
