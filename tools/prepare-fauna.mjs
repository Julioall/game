import { buildAnimalData, writeBake, readBake, clearBuildCache } from 'procedural-animals';
import { gzipSync } from 'node:zlib';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { FAUNA_SPECIES } from '../src/world/fauna-catalog.js';

await mkdir('public/fauna', { recursive: true });
const models = [];
for (const species of Object.keys(FAUNA_SPECIES)) for (const seed of [1769, 1770]) {
  const data = await buildAnimalData(species, { seed, quality: 'low', worker: false });
  const bytes = Buffer.from(writeBake(data));
  const restored = readBake(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  if (restored.nV !== data.nV || restored.index.length !== data.index.length || restored.seed !== seed)
    throw new Error(`Bake roundtrip failed: ${species}/${seed}`);
  const compressed = gzipSync(bytes, { level: 9, mtime: 0 });
  const file = `${species}-${seed}.animal.gz`;
  await writeFile('public/fauna/' + file, compressed);
  models.push({ species, seed, file, bytes: compressed.length, vertices: data.nV,
    sha256: createHash('sha256').update(compressed).digest('hex') });
  console.log(`${file}: ${Math.round(compressed.length / 1024)} KiB`);
  clearBuildCache();
}
await writeFile('public/fauna/manifest.json', JSON.stringify({
  revision: 'c95ae49346aa8e140a924376cec6cf0073d99512', quality: 'low', models
}, null, 2) + '\n');
console.log(`Prepared ${models.length} models; ${Math.round(models.reduce((n, m) => n + m.bytes, 0) / 1048576)} MiB compressed.`);
