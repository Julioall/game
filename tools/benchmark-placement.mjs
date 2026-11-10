import { cpus } from 'node:os';
import { generate } from '../src/world/generate.js';
import { WorldState } from '../src/world/state.js';

const world = generate({ seed: 1769, size: 768, vegetation: 0, rivers: 0, lakes: 0, settlements: 0 });
const inventory = { wood: 10, stone: 10 };
const reference = new WorldState(world, { inventory });
const lots = [];
for (let z = 4; z < 384 && lots.length < 64; z += 5) {
  for (let x = 4; x < 384 && lots.length < 64; x += 5) {
    if (!reference.placement(x, z)) lots.push([x, z]);
  }
}
if (lots.length !== 64) throw new Error('Não foi possível reproduzir os lotes do benchmark.');

const cases = [0, 1000, 10000].map(count => {
  const buildings = Array.from({ length: count }, (_, i) => ({
    id: 'bench:' + i, kind: 'cabin', x: 470 + (i % 100) * 2.8,
    z: 470 + Math.floor(i / 100) * 2.8, y: 0, footprint: 2.1
  }));
  const started = performance.now();
  const state = new WorldState(world, { inventory, buildings });
  return { count, state, indexMs: performance.now() - started, samples: [] };
});

function batch(state) {
  const started = performance.now();
  for (let repeat = 0; repeat < 16; repeat++) {
    for (const [x, z] of lots) {
      if (state.placement(x, z)) throw new Error('Um objeto distante alterou a decisão do lote.');
    }
  }
  return performance.now() - started;
}

for (const { state } of cases) batch(state);
for (let round = 0; round < 7; round++) {
  for (let step = 0; step < cases.length; step++) {
    const { state, samples } = cases[(round + step) % cases.length];
    samples.push(batch(state));
  }
}
const ms = value => Number(value.toFixed(2));
console.log(JSON.stringify({
  node: process.version, cpu: cpus()[0].model, seed: world.config.seed, size: world.config.size,
  queriesPerBatch: lots.length * 16,
  cases: cases.map(({ count, indexMs, samples }) => {
    const ordered = [...samples].sort((a, b) => a - b);
    return { distantBuildings: count, indexMs: ms(indexMs), p50Ms: ms(ordered[3]),
      p95Ms: ms(ordered.at(-1)), samplesMs: samples.map(ms) };
  })
}, null, 2));
