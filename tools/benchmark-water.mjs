import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { cpus, platform } from 'node:os';
import { generate } from '../src/world/generate.js';
import { CHUNK } from '../src/world/catalog.js';
import { indexTowns } from '../src/world/chunks.js';
import { mouthFlow } from '../src/world/terrain/water-flow.js';
import { stepTraversal, traversalSurface } from '../src/world/traversal.js';

const sizes = process.argv.includes('--max') ? [256, 768, 1024, 5000] : [256, 768, 1024];
const rounds = 3;
const percentile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.ceil(sorted.length * fraction) - 1].toFixed(3));
};
const times = samples => ({ p50Ms: percentile(samples, .5), p95Ms: percentile(samples, .95),
  samplesMs: samples.map(value => Number(value.toFixed(3))) });
const hashWorld = world => {
  const hash = createHash('sha256');
  for (const field of [world.ground, world.wet, world.surface, world.waterKind, world.river]) {
    hash.update(new Uint8Array(field.buffer));
  }
  return hash.digest('hex');
};

// Warm the generation code once. Every measured world is released before the next round.
generate({ size: 128, settlements: 0 }, { compact: true });
const generation = [];
for (const size of sizes) {
  const compact = size > 768;
  const samples = [];
  let signature;
  let metrics;
  let mouths;
  let residentBytes;
  for (let round = 0; round < rounds; round++) {
    globalThis.gc?.();
    let world = generate({ size, seed: 454, style: 'spring' }, { compact });
    const actual = hashWorld(world);
    if (signature) assert.equal(actual, signature, 'Repeated generation changed the world');
    signature = actual;
    assert.equal(world.metrics.brokenRivers, 0);
    assert.equal(world.metrics.invalidSites, 0);
    samples.push(world.metrics.generationMs);
    metrics = world.metrics;
    mouths = world.riverMouths.length;
    residentBytes = process.memoryUsage().rss;
    world = null;
    console.log('Generated', size, 'round', round + 1, 'in', Math.round(samples.at(-1)), 'ms');
  }
  generation.push({ size, seed: 454, compact, rounds, ...times(samples), gridBytes: metrics.gridBytes,
    residentBytes, mouths, ponds: metrics.headwaterPonds, signature });
}
globalThis.gc?.();

const world = generate({ seed: 1769, size: 256 });
const queries = [];
for (const mouth of world.riverMouths) for (const point of mouth.path) {
  queries.push([point.x, point.z]);
  if (queries.length >= 1024) break;
}
assert.ok(queries.length > 0);
while (queries.length < 1024) queries.push(queries[queries.length % Math.min(32, queries.length)]);
queries.length = 1024;

// Add remote mouths without changing any local water. Count work and compare the results.
const localQueries = [];
for (const count of [0, 1000, 10000]) {
  const distant = Array.from({ length: count }, (_, i) => {
    const source = world.riverMouths[i % world.riverMouths.length];
    const offset = 10000 + i * 100;
    return { ...source, x: source.x + offset, z: source.z + offset,
      path: source.path.map(point => ({ ...point, x: point.x + offset, z: point.z + offset })) };
  });
  const started = performance.now();
  const index = indexTowns({ ...world, riverMouths: world.riverMouths.concat(distant) });
  const indexMs = performance.now() - started;
  function batch() {
    const work = { mouthCandidates: 0, pathSegments: 0, connectionSamples: 0, affectedQueries: 0 };
    const values = new Float64Array(queries.length * 3);
    const started = performance.now();
    for (let i = 0; i < queries.length; i++) {
      const [x, z] = queries[i];
      const key = Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK);
      const flow = mouthFlow(world, x, z, index.riverMouths.get(key) ?? [], [0, 0, 0], undefined, work);
      values.set(flow, i * 3);
    }
    const ms = performance.now() - started;
    const signature = createHash('sha256').update(new Uint8Array(values.buffer)).digest('hex');
    return { ms, work, signature };
  }
  batch();
  const measured = Array.from({ length: 7 }, batch);
  const reference = measured[0];
  for (const result of measured) {
    assert.deepEqual(result.work, reference.work);
    assert.equal(result.signature, reference.signature);
  }
  if (localQueries.length) {
    assert.deepEqual(reference.work, localQueries[0].work, 'Remote mouths increased local work');
    assert.equal(reference.signature, localQueries[0].signature, 'Remote mouths changed the local current');
  }
  localQueries.push({ distantMouths: count, queries: queries.length, indexMs: Number(indexMs.toFixed(3)),
    ...times(measured.map(result => result.ms)), work: reference.work, signature: reference.signature });
}

// This is terrain traversal cost, without pathfinding, perception, collision or autonomous tasks.
const traversal = [];
for (const count of [100, 1000, 5000]) for (const activity of [.1, 1]) {
  const active = Math.round(count * activity);
  function batch() {
    const actors = Array.from({ length: count }, () => traversalSurface(world, 122, 117));
    const samples = [];
    let accepted = 0;
    for (let tick = 0; tick < 30; tick++) {
      const started = performance.now();
      const direction = tick < 15 ? 1 : -1;
      for (let i = 0; i < active; i++) {
        const next = stepTraversal(world, actors[i], direction, 0);
        if (next) { actors[i] = next; accepted++; }
      }
      samples.push(performance.now() - started);
    }
    return { samples, accepted };
  }
  batch();
  const result = batch();
  traversal.push({ actors: count, active, ticks: 30, acceptedMoves: result.accepted, ...times(result.samples) });
}

const report = {
  timestamp: new Date().toISOString(), node: process.version, cpu: cpus()[0]?.model, platform: platform(),
  gcExposed: Boolean(globalThis.gc), processPeakRssBytes: process.resourceUsage().maxRSS * 1024,
  generation, localQueries, traversal
};
await mkdir('playtest-output', { recursive: true });
await writeFile('playtest-output/water-benchmark.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
