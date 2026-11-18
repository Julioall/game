// CPU/memory benchmark only. Render FPS and GPU p95 must be collected in
// Chrome through WorldView.diagnostics(), not invented from Node timings.
import { generate } from '../src/world/generate.js';
import { performance } from 'node:perf_hooks';

const large = process.argv.includes('--large');
const sizes = large ? [1024, 5000] : [256, 1024];
const seeds = [1769, 454];
const report = [];
for (const size of sizes) for (const seed of seeds) {
  global.gc?.();
  const rssBefore = process.memoryUsage().rss;
  const started = performance.now();
  const world = generate({ size, seed }, { compact: true });
  const finished = performance.now();
  const row = {
    seed, size, generationMs: +(finished - started).toFixed(1),
    worldGridMiB: +(world.metrics.gridBytes / 2**20).toFixed(1),
    rssDeltaMiB: +((process.memoryUsage().rss - rssBefore) / 2**20).toFixed(1),
    riverPinholeCells: world.repairedRiverCells ?? 0,
    brokenRivers: world.metrics.brokenRivers,
    invalidSites: world.metrics.invalidSites
  };
  report.push(row);
  console.log(JSON.stringify(row));
}
console.log(JSON.stringify({ kind: 'world-cpu-memory-benchmark', large, report }));
