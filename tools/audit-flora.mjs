import { mkdir, writeFile } from 'node:fs/promises';
import { generate } from '../src/world/generate.js';
import { indexTowns } from '../src/world/chunks.js';
import { chunkObjects } from '../src/world/vegetation.js';
import { floraClimateAt } from '../src/world/flora-climate.js';
import { FLORA_BIOMES } from '../src/world/flora-biomes.js';

const size = Number(process.argv[2] ?? 1024);
const started = performance.now();
const world = generate({ size, seed: 1769, style: 'spring', water: .14, relief: .83, climate: .61, vegetation: .25 }, { compact: true });
const index = indexTowns(world), rows = {}, violations = [];
const stride = size > 2048 ? 4 : 1;
let chunks = 0, trees = 0;
for (let cz = 0; cz < Math.ceil(size / 32); cz += stride) for (let cx = 0; cx < Math.ceil(size / 32); cx += stride) {
  chunks++;
  for (const tree of chunkObjects(world, index, cx, cz, { resourcesOnly: true })) {
    if (tree.kind !== 'tree') continue;
    trees++;
    const { biome, family, renderSpecies } = tree.flora;
    const climate = floraClimateAt(world, tree.x, tree.z);
    const row = rows[biome] ??= { name: FLORA_BIOMES[biome]?.name ?? 'Sem perfil', trees: 0, species: {}, minTemperature: 1, maxTemperature: 0 };
    row.trees++;
    row.species[renderSpecies] = (row.species[renderSpecies] ?? 0) + 1;
    row.minTemperature = Math.min(row.minTemperature, climate.temperature);
    row.maxTemperature = Math.max(row.maxTemperature, climate.temperature);
    const invalid = family === 'PineTree' && !['boreal', 'conifer', 'snowy'].includes(biome)
      || family === 'Willow' && (!['riparian', 'wetland'].includes(biome) || climate.shore > 8)
      || family === 'CommonTree' && !['temperate', 'palm'].includes(biome)
      || family === 'PalmTree' && (climate.temperature <= .67 || climate.moisture <= .42);
    if (invalid) violations.push({ id: tree.id, biome, family, climate });
  }
}
const report = { config: world.config, chunkStride: stride, chunks, trees, rows, violations,
  climateBytes: world.floraThermal.byteLength + world.floraRain.byteLength, elapsedMs: performance.now() - started };
await mkdir('playtest-output', { recursive: true });
await writeFile(`playtest-output/flora-audit-${size}.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
if (violations.length) process.exitCode = 1;
